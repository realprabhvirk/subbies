import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = "Subbies: contractor compliance, without the chasing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Design-system tokens (see app/globals.css / lib/email/template.ts).
const CANVAS = "#f8f6f4";
const SURFACE = "#fcfcfa";
const INK = "#120e0e";
const INK_MUTED = "#7a736f";
const LINE = "#ebe7e3";

// The site's own typeface, Mona Sans (SIL Open Font License; licence alongside
// in app/_fonts). Bundled as static WOFF because the image renderer can't read
// the variable WOFF2 file next/font serves to browsers.
async function loadAssets() {
  const dir = join(process.cwd(), "app/_fonts");
  const [bold, regular, icon] = await Promise.all([
    readFile(join(dir, "MonaSans-Bold-latin.woff")),
    readFile(join(dir, "MonaSans-Regular-latin.woff")),
    readFile(join(process.cwd(), "public/brand/subbies-icon.png")),
  ]);
  return {
    fonts: [
      { name: "Mona Sans", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Mona Sans", data: regular, weight: 400 as const, style: "normal" as const },
    ],
    iconSrc: `data:image/png;base64,${icon.toString("base64")}`,
  };
}

export default async function OpengraphImage() {
  const { fonts, iconSrc } = await loadAssets();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CANVAS,
          padding: "72px 80px",
          fontFamily: "Mona Sans",
        }}
      >
        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={iconSrc} width={64} height={64} alt="" />
          <div style={{ fontSize: 40, fontWeight: 700, color: INK, fontFamily: "Mona Sans" }}>
            Subbies
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              fontFamily: "Mona Sans",
              color: INK,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 940,
            }}
          >
            Contractor compliance, without the chasing.
          </div>
          <div style={{ fontSize: 34, color: INK_MUTED, maxWidth: 900, lineHeight: 1.35 }}>
            Collect, review and track your subcontractors&rsquo; licences and
            insurance in one place.
          </div>
        </div>

        {/* Footer chip row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {["Secure upload links", "Expiry reminders", "One dashboard"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                background: SURFACE,
                border: `1px solid ${LINE}`,
                borderRadius: 999,
                padding: "12px 22px",
                fontSize: 26,
                color: INK,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
