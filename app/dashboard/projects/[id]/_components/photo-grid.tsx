"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImagePlus, RefreshCw, Trash2, X } from "lucide-react";

import { IconButton } from "@/app/components/icon-button";
import { ConfirmDialog } from "@/app/components/confirm-dialog";
import { downscaleForUpload, uploadWithProgress } from "@/lib/photos/downscale";
import type { PhotoView } from "../_lib/photos";
import { deleteProjectPhoto, moveProjectPhoto } from "../photo-actions";

const SLOTS = 3;
const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Three photo slots. Filled: thumbnail, Replace, Delete, move left/right.
 * Empty: dashed "Add photo". Click a photo for the lightbox. The same grid is
 * used on the overview; the cap is enforced by the database, this only
 * reflects it.
 */
export function PhotoGrid({ projectId, photos, editable = true }: { projectId: string; photos: PhotoView[]; editable?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ slot: number; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PhotoView | null>(null);
  const [pending, start] = useTransition();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<{ slot: number; replace: string | null }>({ slot: 1, replace: null });

  const bySlot = new Map(photos.map((p) => [p.position, p]));
  const filled = photos.length;

  const pick = (slot: number, replace: string | null) => {
    target.current = { slot, replace };
    setError(null);
    input.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const { slot, replace } = target.current;
    setBusy({ slot, progress: 0 });
    const blob = await downscaleForUpload(file);
    const form = new FormData();
    form.append("file", blob, file.name.replace(/\.[^.]+$/, "") + ".jpg");
    if (replace) form.append("replace", replace);
    const res = await uploadWithProgress(`/api/projects/${projectId}/photos`, form, (p) => setBusy({ slot, progress: p }));
    setBusy(null);
    if (input.current) input.current.value = "";
    if (!res.ok) return setError(res.error ?? "Upload failed. Try again.");
    router.refresh();
  };

  return (
    <div>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: SLOTS }, (_, i) => i + 1).map((slot) => {
          const p = bySlot.get(slot);
          const uploading = busy?.slot === slot;
          if (!p) {
            return (
              <li key={slot} className="aspect-square">
                {editable ? (
                  <button
                    type="button"
                    onClick={() => pick(slot, null)}
                    disabled={Boolean(busy) || pending}
                    className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong text-xs font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
                  >
                    {uploading ? (
                      <Progress value={busy!.progress} />
                    ) : (
                      <>
                        <ImagePlus className="h-5 w-5" strokeWidth={2} aria-hidden />
                        Add photo
                      </>
                    )}
                  </button>
                ) : (
                  <div className="h-full w-full rounded-lg border-2 border-dashed border-line" aria-hidden />
                )}
              </li>
            );
          }
          return (
            <li key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-muted">
              <button type="button" onClick={() => setLightbox(slot)} className="block h-full w-full" aria-label={`Open photo ${slot} of ${filled}`}>
                {p.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbUrl} alt={`Jobsite photo ${slot}`} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-xs text-ink-muted">Photo unavailable</span>
                )}
              </button>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
                  <Progress value={busy!.progress} />
                </div>
              )}
              {editable && !uploading && (
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/55 to-transparent p-1.5">
                  <div className="flex gap-1">
                    <IconButton tone="overlay" aria-label="Move photo left" disabled={slot === 1 || pending} onClick={() => start(async () => { const r = await moveProjectPhoto(projectId, p.id, -1); if (!r.ok) setError(r.error); else router.refresh(); })}>
                      <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
                    </IconButton>
                    <IconButton tone="overlay" aria-label="Move photo right" disabled={slot === SLOTS || pending} onClick={() => start(async () => { const r = await moveProjectPhoto(projectId, p.id, 1); if (!r.ok) setError(r.error); else router.refresh(); })}>
                      <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                    </IconButton>
                  </div>
                  <div className="flex gap-1">
                    <IconButton tone="overlay" aria-label="Replace photo" disabled={Boolean(busy) || pending} onClick={() => pick(slot, p.id)}>
                      <RefreshCw className="h-4 w-4" strokeWidth={2.25} />
                    </IconButton>
                    <IconButton tone="overlay" aria-label="Delete photo" disabled={pending} onClick={() => setConfirmDelete(p)}>
                      <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                    </IconButton>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 font-mono text-xs text-ink-muted">{filled} of {SLOTS} photos</p>
      {error && <p role="alert" className="mt-2 text-sm text-expired">{error}</p>}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this photo?"
          confirmLabel="Delete photo"
          pendingLabel="Deleting…"
          pending={pending}
          error={null}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() =>
            start(async () => {
              const r = await deleteProjectPhoto(projectId, confirmDelete.id);
              setConfirmDelete(null);
              if (!r.ok) setError(r.error);
              else router.refresh();
            })
          }
        >
          <p>The photo is removed from this project for good. This can&apos;t be undone.</p>
        </ConfirmDialog>
      )}

      {lightbox !== null && (
        <Lightbox photos={photos} start={photos.findIndex((p) => p.position === lightbox)} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function Progress({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="flex w-3/4 flex-col items-center gap-1.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Uploading">
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-2xs text-ink-muted">{pct < 100 ? `${pct}%` : "Processing"}</span>
    </span>
  );
}

/** Native <dialog>: focus is trapped, Esc closes, arrow keys page through. */
function Lightbox({ photos, start, onClose }: { photos: PhotoView[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(Math.max(0, start));
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  const prev = () => setI((x) => (x - 1 + photos.length) % photos.length);
  const next = () => setI((x) => (x + 1) % photos.length);
  const p = photos[i];
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
      className="m-auto max-h-[92vh] w-[min(92vw,1100px)] rounded-card bg-warm-900 p-0 text-white backdrop:bg-black/80"
      aria-label={`Photo ${i + 1} of ${photos.length}`}
    >
      <div className="relative flex items-center justify-center">
        {p?.fullUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.fullUrl} alt={`Jobsite photo ${i + 1}`} className="max-h-[86vh] w-auto object-contain" />
        )}
        <form method="dialog" className="absolute right-2 top-2">
          <IconButton tone="overlay" aria-label="Close" type="submit">
            <X className="h-5 w-5" strokeWidth={2.25} />
          </IconButton>
        </form>
        {photos.length > 1 && (
          <>
            <span className="absolute left-2 top-1/2 -translate-y-1/2">
              <IconButton tone="overlay" aria-label="Previous photo" onClick={prev}>
                <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
              </IconButton>
            </span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              <IconButton tone="overlay" aria-label="Next photo" onClick={next}>
                <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
              </IconButton>
            </span>
          </>
        )}
      </div>
      <p className="px-4 py-2 text-center font-mono text-xs text-white/70">{i + 1} of {photos.length}</p>
    </dialog>
  );
}
