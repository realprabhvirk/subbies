"use client";

import { useSyncExternalStore } from "react";

/**
 * "Good morning / afternoon / evening." for the hero.
 *
 * The time of day is read on the client, in the viewer's own clock: the server
 * would render in UTC and greet an Australian user at breakfast with "Good
 * evening". useSyncExternalStore gives a null server snapshot, so the markup
 * the server sends and the markup hydration expects are identical (an invisible
 * placeholder that holds the line's width and height), and the real greeting
 * replaces it with no mismatch warning and no layout shift.
 */
function greetingNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

const subscribe = () => () => {};

export function Greeting() {
  const text = useSyncExternalStore(subscribe, greetingNow, () => null);
  if (text === null) {
    return (
      <span aria-hidden className="invisible">
        Good afternoon.
      </span>
    );
  }
  return <>{text}</>;
}
