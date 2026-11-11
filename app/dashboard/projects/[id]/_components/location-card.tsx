import { MapPin } from "lucide-react";

import { SectionCard } from "@/app/components/section-card";
import { publicMapboxToken, staticMapUrl } from "@/lib/mapbox/static-map";
import type { SavedLocation } from "./location-picker";
import { LocationDialogButton } from "./location-dialog";

/**
 * Overview location: a static map image (no map JavaScript here), the
 * address, and the way into the editor. Without a usable token it says "Map
 * unavailable" and still shows the address.
 */
export function LocationCard({
  projectId,
  location,
  freeTextAddress,
}: {
  projectId: string;
  location: SavedLocation | null;
  freeTextAddress: string | null;
}) {
  const token = publicMapboxToken();
  const shownAddress = location?.address ?? freeTextAddress;

  return (
    <SectionCard id="location" icon={MapPin} tone="neutral" title="Location">
      {!token ? (
        <div className="space-y-2">
          <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface-muted text-center">
            <p className="text-sm font-semibold text-ink">Map unavailable</p>
            <p className="mt-1 px-4 text-xs text-ink-muted">Maps aren&apos;t set up for this account yet.</p>
          </div>
          {shownAddress && <p className="break-words text-sm text-ink">{shownAddress}</p>}
        </div>
      ) : location ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={staticMapUrl({ lat: location.lat, lng: location.lng, token, width: 480, height: 270 })}
            alt={`Map of ${shownAddress ?? "the project location"}`}
            width={480}
            height={270}
            loading="lazy"
            className="aspect-video w-full rounded-lg border border-line object-cover"
          />
          {shownAddress && <p className="break-words text-sm text-ink">{shownAddress}</p>}
          <LocationDialogButton projectId={projectId} token={token} saved={location} prefill={freeTextAddress} mode="edit" />
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-muted px-4 text-center">
          <MapPin className="h-6 w-6 text-ink-subtle" strokeWidth={2} aria-hidden />
          <p className="text-sm text-ink-muted">{freeTextAddress ? "This project's address isn't on the map yet." : "No map location yet."}</p>
          <LocationDialogButton
            projectId={projectId}
            token={token}
            saved={null}
            prefill={freeTextAddress}
            mode={freeTextAddress ? "find" : "add"}
          />
        </div>
      )}
    </SectionCard>
  );
}
