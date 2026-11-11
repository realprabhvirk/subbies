"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Crosshair, MapPin, RotateCcw, Search } from "lucide-react";

import { Button } from "@/app/components/button";
import { fieldClasses } from "@/app/components/input";
import { permanentGeocodeWith } from "@/lib/mapbox/geocode";
import { saveProjectLocation, clearProjectLocation } from "../location-actions";

export interface SavedLocation {
  lat: number;
  lng: number;
  address: string | null;
  placeId: string | null;
  manual: boolean;
}

interface Suggestion {
  id: string;
  main: string;
  secondary: string;
}

const API = "https://api.mapbox.com/search/searchbox/v1";
const AUSTRALIA: [number, number] = [134.0, -26.5];
const NAVY = "#1E3A5F";

function newSession() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

/**
 * The map editor. Loaded with next/dynamic (ssr: false) inside the location
 * dialog only, so map JavaScript never loads on normal pages.
 *
 * Two ways in, one editable pin:
 *  - Search (ARIA combobox): 250 ms debounce, 3+ characters, 5 suggestions,
 *    Australia only, one Search Box session per search. Choosing a result
 *    moves the pin and fills the address; the pin stays draggable.
 *  - By hand: click the map, drag the pin, or (easier on a phone, where
 *    dragging fights scrolling) pan under a fixed crosshair and confirm.
 * After a pin move the nearest address is offered, never applied without a
 * click.
 */
export default function LocationPicker({
  projectId,
  token,
  saved,
  prefill,
  onDone,
}: {
  projectId: string;
  token: string;
  saved: SavedLocation | null;
  /** The project's free-text address, offered as the starting search. */
  prefill: string | null;
  onDone: () => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const session = useRef(newSession());
  const listId = useId();

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(saved ? { lat: saved.lat, lng: saved.lng } : null);
  const [address, setAddress] = useState(saved?.address ?? "");
  const [placeId, setPlaceId] = useState<string | null>(saved?.placeId ?? null);
  const [manual, setManual] = useState(saved?.manual ?? false);
  const [query, setQuery] = useState(saved ? "" : prefill ?? "");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [crosshair, setCrosshair] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, start] = useTransition();

  // Reverse-geocode a hand-placed pin (debounced) and offer the address.
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offerAddress = useCallback(
    (lat: number, lng: number) => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      reverseTimer.current = setTimeout(async () => {
        try {
          const url = `${API}/reverse?longitude=${lng}&latitude=${lat}&limit=1&language=en&country=au&access_token=${encodeURIComponent(token)}`;
          const res = await fetch(url);
          if (!res.ok) return;
          const body = (await res.json()) as { features?: { properties?: { full_address?: string; name?: string; place_formatted?: string } }[] };
          const p = body.features?.[0]?.properties;
          const text = p?.full_address ?? [p?.name, p?.place_formatted].filter(Boolean).join(", ");
          setSuggested(text || null);
        } catch {
          /* suggestion is optional */
        }
      }, 400);
    },
    [token],
  );

  // The marker's dragend handler is bound once; it calls through this ref so
  // it always reaches the current placePin.
  const onDragEnd = useRef<(lat: number, lng: number) => void>(() => {});
  const placePin = useCallback(
    (lat: number, lng: number, opts: { byHand: boolean; fly?: boolean }) => {
      setPin({ lat, lng });
      if (opts.byHand) {
        setManual(true);
        setPlaceId(null);
        offerAddress(lat, lng);
      }
      const m = map.current;
      if (!m) return;
      if (!marker.current) {
        marker.current = new mapboxgl.Marker({ color: NAVY, draggable: true }).setLngLat([lng, lat]).addTo(m);
        marker.current.on("dragend", () => {
          const ll = marker.current!.getLngLat();
          onDragEnd.current(ll.lat, ll.lng);
        });
      } else {
        marker.current.setLngLat([lng, lat]);
      }
      if (opts.fly) m.flyTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 16), essential: true });
    },
    [offerAddress],
  );

  useEffect(() => {
    onDragEnd.current = (lat, lng) => placePin(lat, lng, { byHand: true });
  }, [placePin]);

  // Map setup, once.
  useEffect(() => {
    if (!mapEl.current) return;
    try {
      mapboxgl.accessToken = token;
      const m = new mapboxgl.Map({
        container: mapEl.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: saved ? [saved.lng, saved.lat] : AUSTRALIA,
        zoom: saved ? 16 : 3.4,
        cooperativeGestures: true,
      });
      m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      m.on("error", (e) => {
        if (String((e as { error?: { status?: number } }).error?.status ?? "").startsWith("4")) setMapError(true);
      });
      m.on("click", (e) => placePin(e.lngLat.lat, e.lngLat.lng, { byHand: true }));
      map.current = m;
      if (saved) m.once("load", () => placePin(saved.lat, saved.lng, { byHand: false }));
      return () => {
        marker.current = null;
        m.remove();
        map.current = null;
      };
    } catch {
      // WebGL unavailable or a bad token: show the fallback after this render.
      queueMicrotask(() => setMapError(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Search suggestions (debounced 250 ms, 3+ characters).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const url = `${API}/suggest?q=${encodeURIComponent(q)}&language=en&country=au&limit=5&session_token=${session.current}&access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { suggestions?: { mapbox_id: string; name: string; place_formatted?: string; full_address?: string }[] };
        const list = (body.suggestions ?? []).slice(0, 5).map((s) => ({ id: s.mapbox_id, main: s.name, secondary: s.place_formatted ?? s.full_address ?? "" }));
        setResults(list);
        setOpen(list.length > 0);
        setActive(-1);
      } catch {
        /* aborted or offline */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, token]);

  // Fewer than 3 characters: no suggestions (stale results are hidden, not cleared).
  const shown = query.trim().length >= 3 ? results : [];

  const choose = async (s: Suggestion) => {
    setOpen(false);
    setError(null);
    try {
      const url = `${API}/retrieve/${encodeURIComponent(s.id)}?session_token=${session.current}&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      session.current = newSession();
      if (!res.ok) return setError("Couldn't load that address. Try another, or place the pin yourself.");
      const body = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] }; properties?: { full_address?: string; mapbox_id?: string } }[] };
      const f = body.features?.[0];
      const c = f?.geometry?.coordinates;
      if (!c) return setError("Couldn't load that address. Try another, or place the pin yourself.");
      const full = f?.properties?.full_address ?? [s.main, s.secondary].filter(Boolean).join(", ");
      setAddress(full);
      setQuery(full);
      setPlaceId(f?.properties?.mapbox_id ?? s.id);
      setManual(false);
      setSuggested(null);
      placePin(c[1], c[0], { byHand: false, fly: true });
    } catch {
      setError("Couldn't load that address. Check your connection and try again.");
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuggested(null);
    if (saved) {
      setAddress(saved.address ?? "");
      setPlaceId(saved.placeId);
      setManual(saved.manual);
      placePin(saved.lat, saved.lng, { byHand: false, fly: true });
    } else {
      setPin(null);
      setAddress("");
      marker.current?.remove();
      marker.current = null;
    }
  };

  const save = () =>
    start(async () => {
      if (!pin) return setError("Place the pin on the map first.");
      setError(null);
      // A searched address is confirmed here with permanent geocoding and
      // the public token (Mapbox only allows storing permanent results).
      // The pin moves to the confirmed point. If this fails, the server
      // tries with its own token when one is configured.
      let confirmed: { lat: number; lng: number; mapboxId: string | null } | null = null;
      if (!manual && address.trim()) {
        const r = await permanentGeocodeWith(token, address, pin);
        if (r.ok) {
          confirmed = { lat: r.lat, lng: r.lng, mapboxId: r.mapboxId };
          placePin(r.lat, r.lng, { byHand: false });
        }
      }
      const r = await saveProjectLocation(projectId, { address, lat: pin.lat, lng: pin.lng, placeId, manual, confirmed });
      if (!r.ok) return setError(r.error);
      onDone();
    });

  const remove = () =>
    start(async () => {
      const r = await clearProjectLocation(projectId);
      if (!r.ok) return setError(r.error);
      onDone();
    });

  const dirty =
    !!pin &&
    (!saved || saved.lat !== pin.lat || saved.lng !== pin.lng || (saved.address ?? "") !== address || saved.manual !== manual);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <label htmlFor={`${listId}-input`} className="mb-1.5 block text-xs font-semibold text-ink">
          Search for an address
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" strokeWidth={2} aria-hidden />
          <input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => shown.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Street address, suburb or site name"
            className={`${fieldClasses()} pl-9`}
          />
        </div>
        {open && shown.length > 0 && (
          <ul id={`${listId}-list`} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-lg">
            {shown.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className={`cursor-pointer px-3 py-2.5 ${i === active ? "bg-surface-muted" : "hover:bg-surface-muted"}`}
              >
                <span className="block truncate text-sm font-semibold text-ink">{s.main}</span>
                {s.secondary && <span className="block truncate text-xs text-ink-muted">{s.secondary}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-line bg-surface-muted">
        {mapError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <MapPin className="h-6 w-6 text-ink-subtle" strokeWidth={2} aria-hidden />
            <p className="text-sm font-semibold text-ink">Map unavailable</p>
            <p className="text-xs text-ink-muted">The map couldn&apos;t load. Check the Mapbox token, then try again.</p>
          </div>
        ) : (
          <div ref={mapEl} className="h-full w-full" aria-label="Map. Click to place the pin, or drag the pin to move it." />
        )}
        {crosshair && !mapError && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Crosshair className="h-10 w-10 text-brand drop-shadow" strokeWidth={2} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!crosshair ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setCrosshair(true)} disabled={mapError}>
            <Crosshair className="h-4 w-4" strokeWidth={2} aria-hidden />
            Pan to place
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const c = map.current?.getCenter();
                if (c) placePin(c.lat, c.lng, { byHand: true });
                setCrosshair(false);
              }}
            >
              Confirm location
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setCrosshair(false)}>
              Cancel
            </Button>
          </>
        )}
        <p className="text-xs text-ink-muted">Or click the map, then drag the pin to adjust.</p>
      </div>

      {/* Address */}
      <div>
        <label htmlFor={`${listId}-address`} className="mb-1.5 block text-xs font-semibold text-ink">
          Address shown on the project
        </label>
        <input
          id={`${listId}-address`}
          value={address}
          maxLength={300}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 12 Goodwin Terrace, Burleigh Heads QLD"
          className={fieldClasses()}
        />
        {suggested && suggested !== address && (
          <p className="mt-2 text-sm text-ink-muted">
            Suggested address: <span className="text-ink">{suggested}</span>{" "}
            <button type="button" onClick={() => { setAddress(suggested); setSuggested(null); }} className="font-semibold text-brand hover:underline">
              Use this address
            </button>
          </p>
        )}
        {pin && (
          <p className="mt-2 font-mono text-2xs text-ink-muted">
            {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}{manual ? " · placed by hand" : " · from search"}
          </p>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-expired">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={reset} disabled={pending}>
            <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden />
            Reset
          </Button>
          {saved &&
            (confirmRemove ? (
              <Button type="button" variant="danger-outline" size="sm" onClick={remove} pending={pending}>
                Confirm remove
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmRemove(true)} disabled={pending}>
                Remove location
              </Button>
            ))}
        </div>
        <Button type="button" onClick={save} pending={pending} disabled={!dirty}>
          {saved ? "Save location" : "Add location"}
        </Button>
      </div>
    </div>
  );
}
