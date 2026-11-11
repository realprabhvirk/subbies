"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, Trash2 } from "lucide-react";

import { SectionCard } from "@/app/components/section-card";
import { Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";
import { ConfirmDialog } from "@/app/components/confirm-dialog";
import { fieldClasses } from "@/app/components/input";
import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import type { PlanError } from "@/lib/billing/plans";
import { addRequirement, removeRequirement, updateRequirement } from "../workspace-actions";

export interface RequirementView {
  id: string;
  documentTypeName: string;
  isMandatory: boolean;
  minDaysValid: number | null;
  /** Contractors with a valid (or expiring) copy, of all assigned. */
  covered: number;
  assigned: number;
}

function Segmented({ value, onChange, disabled, label }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {[
        { v: true, text: "Mandatory" },
        { v: false, text: "Optional" },
      ].map((o) => (
        <button
          key={o.text}
          type="button"
          aria-pressed={value === o.v}
          disabled={disabled}
          onClick={() => value !== o.v && onChange(o.v)}
          className={`min-h-10 rounded-[10px] px-3 text-xs font-semibold transition-colors ${
            value === o.v ? "bg-brand text-white" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

function Row({ projectId, r }: { projectId: string; r: RequirementView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mandatory, setMandatory] = useState(r.isMandatory);
  const [minDays, setMinDays] = useState(r.minDaysValid === null ? "" : String(r.minDaysValid));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = (nextMandatory: boolean, nextMin: string) =>
    start(async () => {
      setError(null);
      const res = await updateRequirement(projectId, r.id, nextMandatory, nextMin === "" ? null : nextMin);
      if (!res.ok) {
        setError(res.error);
        setMandatory(r.isMandatory);
        return;
      }
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-3 px-card py-4 sm:px-6 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold text-ink">{r.documentTypeName}</p>
        <p className="mt-0.5 font-mono text-xs text-ink-muted">
          {r.assigned === 0 ? "No contractors assigned" : `${r.covered} of ${r.assigned} contractors valid`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label={`${r.documentTypeName}: mandatory or optional`}
          value={mandatory}
          disabled={pending}
          onChange={(v) => {
            setMandatory(v);
            save(v, minDays);
          }}
        />
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span>Valid for at least</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={3650}
            value={minDays}
            onChange={(e) => setMinDays(e.target.value)}
            onBlur={() => {
              const before = r.minDaysValid === null ? "" : String(r.minDaysValid);
              if (minDays !== before) save(mandatory, minDays);
            }}
            placeholder="–"
            aria-label={`${r.documentTypeName}: must stay valid for at least this many days`}
            className={`${fieldClasses()} !h-10 !w-20 !px-2 text-center font-mono`}
          />
          <span>days</span>
        </label>
        <IconButton tone="danger" onClick={() => setConfirming(true)} disabled={pending} aria-label={`Remove ${r.documentTypeName} from this project's requirements`}>
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </IconButton>
      </div>
      {error && <p role="alert" className="text-sm text-expired lg:basis-full">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title={`Remove ${r.documentTypeName}?`}
          confirmLabel="Remove requirement"
          pendingLabel="Removing…"
          pending={pending}
          error={error}
          onClose={() => setConfirming(false)}
          onConfirm={() =>
            start(async () => {
              const res = await removeRequirement(projectId, r.id);
              if (!res.ok) return setError(res.error);
              setConfirming(false);
              router.refresh();
            })
          }
        >
          <p>
            Contractors on this project will no longer need {r.documentTypeName} to be cleared here. Their documents
            aren&apos;t touched, and other projects aren&apos;t affected.
          </p>
        </ConfirmDialog>
      )}
    </li>
  );
}

export function RequirementsManager({
  projectId,
  requirements,
  availableTypes,
  canCreateType,
}: {
  projectId: string;
  requirements: RequirementView[];
  availableTypes: { id: string; name: string }[];
  canCreateType: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [minDays, setMinDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<PlanError | null>(null);

  const add = () =>
    start(async () => {
      setError(null);
      const res = await addRequirement(projectId, pick, mandatory, minDays === "" ? null : minDays);
      if (!res.ok) {
        setError(res.error);
        setPlanError(res.planError ?? null);
        return;
      }
      setPick("");
      setMinDays("");
      setMandatory(true);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <SectionCard
        id="requirements"
        icon={ListChecks}
        tone="brand"
        title="Requirements"
        subtitle="The documents every contractor on this project needs. Mandatory ones decide whether they're cleared for site."
        flush={requirements.length > 0}
      >
        {requirements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-card py-8 text-center text-sm text-ink-muted">
            No requirements yet. Until you add some, this project uses each contractor&apos;s overall status.
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {requirements.map((r) => (
              <Row key={r.id} projectId={projectId} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard id="add-requirement" icon={Plus} tone="neutral" title="Add requirement">
        {availableTypes.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Every document type you have is already required here.{" "}
            {canCreateType ? (
              <Link href="/dashboard/document-types" className="font-medium text-brand hover:underline">
                Create a new document type
              </Link>
            ) : (
              "You're at your plan's document type limit."
            )}
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <label htmlFor="req-type" className="block text-xs font-semibold text-ink">
                Document type
              </label>
              <select id="req-type" value={pick} onChange={(e) => setPick(e.target.value)} className={fieldClasses()}>
                <option value="">Select…</option>
                {availableTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Segmented label="New requirement: mandatory or optional" value={mandatory} onChange={setMandatory} disabled={pending} />
            <div className="w-44 space-y-1.5">
              <label htmlFor="req-min" className="block text-xs font-semibold text-ink">
                Min. days valid <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input id="req-min" type="number" inputMode="numeric" min={0} max={3650} value={minDays} onChange={(e) => setMinDays(e.target.value)} className={`${fieldClasses()} font-mono`} />
            </div>
            <Button type="button" onClick={add} disabled={!pick} pending={pending}>
              <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
              Add requirement
            </Button>
          </div>
        )}
        {availableTypes.length > 0 && canCreateType && (
          <p className="mt-3 text-xs text-ink-muted">
            Need something else?{" "}
            <Link href="/dashboard/document-types" className="font-medium text-brand hover:underline">
              Create a document type
            </Link>
            .
          </p>
        )}
        {error && !planError && <p role="alert" className="mt-3 text-sm text-expired">{error}</p>}
      </SectionCard>
      {planError && <UpgradePrompt error={planError} />}
    </div>
  );
}
