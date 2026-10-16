/**
 * Lets a `node --test` file import a REAL server module (a server action, or
 * lib/storage.ts) with its framework and data-layer imports swapped for small
 * in-memory stand-ins, so the module's own logic runs unmodified.
 *
 * Not a test file itself (the `npm test` glob only picks up *.test.ts).
 *
 * How: Node's synchronous module hooks (`module.registerHooks`, Node >= 22.15)
 * redirect chosen specifiers to virtual modules whose source is given here,
 * and resolve the `@/` alias to real files at the project root for everything
 * that isn't stubbed. Stubs talk to the test through `globalThis.__stubs`,
 * which each test sets before calling into the module.
 */

import * as nodeModule from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

type ResolveFn = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => { url: string },
) => { url: string; shortCircuit?: boolean };
type LoadFn = (
  url: string,
  context: unknown,
  nextLoad: (url: string, context: unknown) => unknown,
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve?: ResolveFn; load?: LoadFn }) => void;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Resolves an extensionless project path the way the bundler would. */
function resolveProjectFile(base: string): string | null {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), base]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) return candidate;
  }
  return null;
}

/**
 * @param stubs map of import specifier (exactly as written in source, e.g.
 *   "next/cache", "@/lib/supabase/admin", "./manage-actions") to the ESM
 *   source of the module that should stand in for it.
 */
export function installServerModuleStubs(stubs: Record<string, string>): void {
  const STUB_PREFIX = "stub:";

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier in stubs) {
        return { url: STUB_PREFIX + encodeURIComponent(specifier), shortCircuit: true };
      }
      if (specifier.startsWith("@/")) {
        const file = resolveProjectFile(path.join(ROOT, specifier.slice(2)));
        if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
      }
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const parent = (context as { parentURL?: string }).parentURL;
        if (parent?.startsWith("file:")) {
          const file = resolveProjectFile(path.resolve(path.dirname(fileURLToPath(parent)), specifier));
          if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith(STUB_PREFIX)) {
        const specifier = decodeURIComponent(url.slice(STUB_PREFIX.length));
        return { format: "module", source: stubs[specifier], shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });
}

/**
 * A tiny chainable stand-in for a Supabase query: `.from(t).select().eq()...`
 * resolves to whatever `globalThis.__stubs.rows[table]` holds. Enough for the
 * single-row lookups the file-access actions make.
 */
export const FAKE_SUPABASE_CLIENT_SOURCE = `
function query(table) {
  const rows = () => (globalThis.__stubs.rows ?? {})[table] ?? null;
  const q = {
    select() { return q; }, eq() { return q; }, is() { return q; }, in() { return q; },
    neq() { return q; }, order() { return q; }, limit() { return q; },
    maybeSingle: async () => ({ data: rows(), error: null }),
    single: async () => ({ data: rows(), error: null }),
    then(resolve) { const r = rows(); resolve({ data: r == null ? [] : [].concat(r), error: null }); },
  };
  return q;
}
export function makeClient() { return { from: query }; }
`;
