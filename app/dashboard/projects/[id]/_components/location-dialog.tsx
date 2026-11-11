"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Search } from "lucide-react";

import { Button } from "@/app/components/button";
import { DialogFrame } from "@/app/components/dialog";
import type { SavedLocation } from "./location-picker";

// Map JavaScript (mapbox-gl) only loads when this dialog opens.
const LocationPicker = dynamic(() => import("./location-picker"), {
  ssr: false,
  loading: () => <div className="aspect-[16/10] animate-pulse rounded-lg bg-surface-muted" aria-label="Loading map" />,
});

/** "Add location", "Find this address" or "Edit location", opening the map editor. */
export function LocationDialogButton({
  projectId,
  token,
  saved,
  prefill,
  mode,
}: {
  projectId: string;
  token: string;
  saved: SavedLocation | null;
  prefill: string | null;
  mode: "add" | "find" | "edit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const label = mode === "edit" ? "Edit location" : mode === "find" ? "Find this address" : "Add location";
  const Icon = mode === "edit" ? Pencil : mode === "find" ? Search : MapPin;
  return (
    <>
      <Button type="button" variant={mode === "edit" ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        {label}
      </Button>
      {open && (
        <DialogFrame
          titleId={titleId}
          title={saved ? "Edit map location" : "Add map location"}
          description="Search for the address, or place the pin yourself."
          size="xl"
          onClose={() => setOpen(false)}
        >
          <LocationPicker
            projectId={projectId}
            token={token}
            saved={saved}
            prefill={mode === "find" ? prefill : null}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </DialogFrame>
      )}
    </>
  );
}
