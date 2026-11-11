/**
 * An in-memory stand-in for Supabase (tables + the migration 0020 RPCs) and
 * Resend, shared between a test file and the stubbed modules it installs.
 *
 * Stubs re-export it by file URL (see `fakeModuleSource`), so the test and
 * the code under test talk to the same instance. Not a test file itself.
 *
 * The RPCs mirror the SQL in supabase/migrations/0020_security_audit_fixes.sql
 * closely enough to drive the TypeScript paths; the SQL itself is proven by
 * supabase/tests/0020_security_audit_fixes.sql against real Postgres.
 */
import { pathToFileURL, fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number | null };

export interface SentEmail {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface FakeState {
  tables: Record<string, Row[]>;
  sent: SentEmail[];
  company: { id: string; name: string; user_id?: string } | null;
  user: { id: string; email: string | null } | null;
  /** Wall clock the RPCs use, so a test can move time forward. */
  now: () => number;
  /** Force an RPC to return a database error (fail-open paths). */
  rpcErrors: Record<string, string>;
}

const g = globalThis as unknown as { __fakeSupabase?: FakeState };

export function fake(): FakeState {
  g.__fakeSupabase ??= {
    tables: {},
    sent: [],
    company: null,
    user: null,
    now: () => Date.now(),
    rpcErrors: {},
  };
  return g.__fakeSupabase;
}

export function resetFake(seed: Partial<FakeState> = {}): FakeState {
  const s = fake();
  s.tables = {};
  s.sent = [];
  s.company = null;
  s.user = null;
  s.now = () => Date.now();
  s.rpcErrors = {};
  Object.assign(s, seed);
  return s;
}

function table(name: string): Row[] {
  const s = fake();
  s.tables[name] ??= [];
  return s.tables[name];
}

class Query implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private conflictKey = "id";
  private payload: Row | Row[] | null = null;
  private head = false;
  private wantCount = false;

  private name: string;
  constructor(name: string) { this.name = name; }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.wantCount = Boolean(opts?.count);
      this.head = Boolean(opts?.head);
    }
    return this;
  }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = p;
    this.conflictKey = opts?.onConflict ?? "id";
    return this;
  }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  gt(c: string, v: string) { this.filters.push((r) => String(r[c]) > v); return this; }
  lt(c: string, v: string) { this.filters.push((r) => String(r[c]) < v); return this; }
  not(c: string, op: string, v: unknown) {
    if (op === "is") this.filters.push((r) => (r[c] ?? null) !== v);
    else this.filters.push((r) => r[c] !== v);
    return this;
  }
  /** Supports the PostgREST `or` forms the app uses: col.is.null, col.lt.value. */
  or(expr: string) {
    const parts = expr.split(",").map((p) => {
      const [col, op, ...rest] = p.split(".");
      const val = rest.join(".");
      return (r: Row) => {
        if (op === "is" && val === "null") return (r[col] ?? null) === null;
        if (op === "lt") return r[col] != null && String(r[col]) < val;
        throw new Error(`fake: unsupported or() part ${p}`);
      };
    });
    this.filters.push((r) => parts.some((f) => f(r)));
    return this;
  }
  private window: [number, number] | null = null;
  range(from: number, to: number) { this.window = [from, to]; return this; }
  order() { return this; }
  limit() { return this; }

  private exec(): Result {
    const rows = table(this.name);
    const match = (r: Row) => this.filters.every((f) => f(r));
    if (this.op === "insert") {
      const list = ([] as Row[]).concat(this.payload as Row | Row[]).map((r) => ({ id: randomUUID(), ...r }));
      rows.push(...list);
      return { data: list, error: null };
    }
    if (this.op === "upsert") {
      const out: Row[] = [];
      for (const r of ([] as Row[]).concat(this.payload as Row | Row[])) {
        const hit = rows.find((x) => x[this.conflictKey] === r[this.conflictKey]);
        if (hit) { Object.assign(hit, r); out.push(hit); }
        else { const row = { id: randomUUID(), ...r }; rows.push(row); out.push(row); }
      }
      return { data: out.map((r) => structuredClone(r)), error: null };
    }
    if (this.op === "update") {
      const hit = rows.filter(match);
      for (const r of hit) Object.assign(r, this.payload);
      return { data: hit, error: null };
    }
    if (this.op === "delete") {
      const keep = rows.filter((r) => !match(r));
      const gone = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { data: null, error: null, count: gone };
    }
    let hit = rows.filter(match);
    if (this.window) hit = hit.slice(this.window[0], this.window[1] + 1);
    // Copies, like a real response: later writes don't change what was read.
    const copies = hit.map((r) => structuredClone(r));
    return { data: this.head ? null : copies, error: null, count: this.wantCount ? hit.length : null };
  }

  async maybeSingle(): Promise<Result> {
    const r = this.exec();
    return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
  }
  async single(): Promise<Result> {
    const r = this.exec();
    const list = Array.isArray(r.data) ? r.data : [];
    if (list.length !== 1) return { data: null, error: { code: "PGRST116", message: "not exactly one row" } };
    return { ...r, data: list[0] };
  }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.exec()).then(ok, bad);
  }
}

/** The migration 0020/0021 functions the app calls, re-done in memory. */
function rpc(name: string, args: Record<string, unknown>): Result {
  const s = fake();
  if (s.rpcErrors[name]) return { data: null, error: { code: "XX000", message: s.rpcErrors[name] } };
  const nowMs = s.now();

  switch (name) {
    case "claim_email_send": {
      const log = table("email_send_log");
      const since = nowMs - Number(args.p_window_seconds) * 1000;
      const used = log.filter((r) => r.company_id === args.p_company_id && Number(r.created_ms) > since).length;
      if (used >= Number(args.p_cap)) return { data: null, error: null };
      const id = randomUUID();
      log.push({ id, company_id: args.p_company_id, kind: args.p_kind, created_ms: nowMs });
      return { data: id, error: null };
    }
    case "claim_request_cooldown": {
      const cd = table("contractor_request_cooldowns");
      const row = cd.find((r) => r.contractor_id === args.p_contractor_id);
      const windowMs = Number(args.p_window_seconds) * 1000;
      if (row && Number(row.last_ms) > nowMs - windowMs) return { data: false, error: null };
      if (row) {
        row.last_ms = nowMs;
        row.last_sent_at = new Date(nowMs).toISOString();
      } else {
        cd.push({ contractor_id: args.p_contractor_id, last_ms: nowMs, last_sent_at: new Date(nowMs).toISOString() });
      }
      return { data: true, error: null };
    }
    case "release_request_cooldown": {
      const cd = table("contractor_request_cooldowns");
      const keep = cd.filter((r) => !(r.contractor_id === args.p_contractor_id && Number(r.last_ms) > nowMs - 120_000));
      cd.splice(0, cd.length, ...keep);
      return { data: null, error: null };
    }
    case "create_contractor": {
      if (!s.company) return { data: null, error: { code: "P0001", message: "SUBBIES_NO_COMPANY" } };
      const contractor = { id: randomUUID(), company_id: s.company.id, business_name: args.p_business_name, contact_name: args.p_contact_name, email: args.p_email, phone: args.p_phone, trade: args.p_trade, status: "pending" };
      table("contractors").push(contractor);
      for (const dt of args.p_document_type_ids as string[]) {
        table("contractor_documents").push({ id: randomUUID(), contractor_id: contractor.id, document_type_id: dt, status: "requested", archived_at: null, replaces_document_id: null });
      }
      const token = randomUUID();
      table("contractor_tokens").push({ id: randomUUID(), contractor_id: contractor.id, token });
      return { data: [{ contractor_id: contractor.id, token }], error: null };
    }
    // Migration 0021. Same rules: caller's company only, restore re-checks
    // the plan limit counting live (unarchived) contractors.
    case "archive_contractor": {
      if (!s.company) return { data: null, error: { code: "P0001", message: "SUBBIES_NO_COMPANY" } };
      const row = table("contractors").find((r) => r.id === args.p_contractor_id && r.company_id === s.company!.id);
      if (!row) return { data: null, error: { code: "P0001", message: "SUBBIES_NOT_FOUND" } };
      row.archived_at ??= new Date(nowMs).toISOString();
      return { data: row.archived_at, error: null };
    }
    case "restore_contractor": {
      if (!s.company) return { data: null, error: { code: "P0001", message: "SUBBIES_NO_COMPANY" } };
      const companyId = s.company.id;
      const row = table("contractors").find((r) => r.id === args.p_contractor_id && r.company_id === companyId);
      if (!row) return { data: null, error: { code: "P0001", message: "SUBBIES_NOT_FOUND" } };
      if ((row.archived_at ?? null) === null) return { data: null, error: null };
      const sub = table("subscriptions").find((r) => r.company_id === companyId);
      if (!sub || !["trialing", "active", "past_due"].includes(String(sub.status))) {
        return { data: null, error: { code: "P0001", message: "SUBBIES_NO_ACCESS" } };
      }
      const limits: Record<string, number | null> = { starter: 5, business: 25, pro: null };
      const lim = String(sub.plan) in limits ? limits[String(sub.plan)] : 0;
      const live = table("contractors").filter((r) => r.company_id === companyId && (r.archived_at ?? null) === null).length;
      if (lim !== null && live >= lim) return { data: null, error: { code: "P0001", message: "SUBBIES_LIMIT_REACHED" } };
      row.archived_at = null;
      return { data: null, error: null };
    }
    case "check_rate_limit": {
      const hits = table("rate_limit_hits");
      const used = hits.filter((r) => r.bucket === args.p_bucket && r.key === args.p_key).length;
      if (used >= Number(args.p_limit)) return { data: false, error: null };
      hits.push({ bucket: args.p_bucket, key: args.p_key, created_ms: nowMs });
      return { data: true, error: null };
    }
    case "purge_rate_limit_hits": {
      const hits = table("rate_limit_hits");
      const cutoff = nowMs - Number(args.p_older_than_seconds) * 1000;
      const keep = hits.filter((r) => Number(r.created_ms) >= cutoff);
      const removed = hits.length - keep.length;
      hits.splice(0, hits.length, ...keep);
      return { data: removed, error: null };
    }
    case "claim_trial_fingerprint": {
      const ledger = table("trial_card_fingerprints");
      let row = ledger.find((r) => r.fingerprint === args.p_fingerprint);
      if (!row) {
        row = { fingerprint: args.p_fingerprint, first_company_id: args.p_company_id };
        ledger.push(row);
      }
      return { data: row.first_company_id === args.p_company_id, error: null };
    }
    case "consume_deletion_code_attempt": {
      const row = table("account_deletion_codes").find(
        (r) => r.user_id === args.p_user_id && Number(r.attempts) < Number(args.p_max_attempts),
      );
      if (!row) return { data: [], error: null };
      row.attempts = Number(row.attempts) + 1;
      return { data: [{ code_hash: row.code_hash, expires_at: row.expires_at, attempts: row.attempts }], error: null };
    }
    default:
      return { data: null, error: { code: "42883", message: `fake: no rpc ${name}` } };
  }
}

class RpcCall implements PromiseLike<Result> {
  private name: string;
  private args: Record<string, unknown>;
  constructor(name: string, args: Record<string, unknown>) { this.name = name; this.args = args; }
  async single(): Promise<Result> {
    const r = rpc(this.name, this.args);
    return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
  }
  async maybeSingle(): Promise<Result> { return this.single(); }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(rpc(this.name, this.args)).then(ok, bad);
  }
}

export function makeClient() {
  return {
    from: (name: string) => new Query(name),
    rpc: (name: string, args: Record<string, unknown> = {}) => new RpcCall(name, args),
    auth: { getClaims: async () => ({ data: null, error: null }) },
  };
}

/** A stand-in for the `resend` package that records instead of sending. */
export class FakeResend {
  emails = {
    send: async (payload: SentEmail) => {
      fake().sent.push(payload);
      return { data: { id: `em_${fake().sent.length}` }, error: null };
    },
  };
}

/** ESM source for a stub that re-exports names from this module. */
export function fakeModuleSource(body: string): string {
  const url = pathToFileURL(fileURLToPath(import.meta.url)).href;
  return `import * as F from ${JSON.stringify(url)};\n${body}`;
}
