/**
 * The compliance report as a react-pdf document (D2). Written with
 * createElement rather than JSX so it runs under plain `node --test`.
 *
 * A4 portrait, 18 mm margins. Navy header band with the white logo, a footer
 * on every page with the generated time, page x of y and the disclaimer.
 * Status is always printed as words, so the report reads in greyscale;
 * red, amber and green only reinforce statuses and appear nowhere else.
 * Contractor blocks and the photo row never split across pages.
 */
import { createElement as h } from "react";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ReportModel } from "./report-model.ts";
import { CONTRACTOR_STATUS_TEXT, STATUS_TEXT } from "./report-model.ts";
import type { ProjectContractorStatus, RequirementState } from "../compliance/project.ts";

const ASSETS = path.join(process.cwd(), "lib", "pdf", "assets");
let fontsReady = false;

/** Fonts and logo come from the repo, never the network. */
export function registerPdfAssets() {
  if (fontsReady) return;
  Font.register({
    family: "Mona Sans",
    fonts: [400, 500, 600, 700].map((w) => ({ src: path.join(ASSETS, `mona-sans-latin-${w}-normal.woff`), fontWeight: w })),
  });
  // Names and document types read better unbroken than hyphenated.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

export const LOGO_PATH = path.join(ASSETS, "subbies-logo-white.png");

export const DISCLAIMER =
  "This report reflects documents recorded in Subbies at the time of generation. It is not legal certification of regulatory compliance.";

const MM = 2.834645669;
const NAVY = "#1E3A5F";
const INK = "#1d1a18";
const MUTED = "#6b625b";
const LINE = "#e7e0d8";
const SOFT = "#f6f1ea";

const STATE_COLOUR: Record<RequirementState, { fg: string; bg: string }> = {
  valid: { fg: "#1d6b35", bg: "#ddefe0" },
  expiring: { fg: "#9a5b00", bg: "#fcebc8" },
  pending_review: { fg: "#2f5476", bg: "#e4edf6" },
  rejected: { fg: "#b42318", bg: "#fbe0dd" },
  expired: { fg: "#b42318", bg: "#fbe0dd" },
  missing: { fg: "#b42318", bg: "#fbe0dd" },
};
const NEUTRAL = { fg: "#5c544e", bg: "#efe9e2" };
const CONTRACTOR_COLOUR: Record<ProjectContractorStatus, { fg: string; bg: string }> = {
  compliant: STATE_COLOUR.valid,
  expiring: STATE_COLOUR.expiring,
  pending_review: STATE_COLOUR.pending_review,
  not_cleared: STATE_COLOUR.expired,
};

const s = StyleSheet.create({
  page: { fontFamily: "Mona Sans", fontSize: 9.5, color: INK, paddingTop: 18 * MM + 34, paddingBottom: 18 * MM + 20, paddingHorizontal: 18 * MM },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 18 * MM + 22, backgroundColor: NAVY, paddingHorizontal: 18 * MM, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 12 },
  logo: { height: 24, width: 90 },
  bandTitle: { color: "#ffffff", fontSize: 11, fontWeight: 600 },
  footer: { position: "absolute", bottom: 10 * MM, left: 18 * MM, right: 18 * MM, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
  disclaimer: { fontSize: 7, color: MUTED, marginTop: 3 },
  eyebrow: { fontSize: 8, color: MUTED, letterSpacing: 0.8, textTransform: "uppercase" },
  h1: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  sub: { fontSize: 10, color: MUTED, marginTop: 4 },
  row: { flexDirection: "row" },
  figure: { fontSize: 34, fontWeight: 700, color: NAVY },
  metric: { flexGrow: 1, flexBasis: 0, borderWidth: 0.75, borderColor: LINE, borderRadius: 4, padding: 6, marginLeft: 5 },
  metricValue: { fontSize: 15, fontWeight: 700 },
  metricLabel: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 8 },
  box: { borderWidth: 0.75, borderColor: LINE, borderRadius: 4 },
  detailLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  detailValue: { fontSize: 10, marginTop: 2, marginBottom: 8 },
  pill: { fontSize: 8, fontWeight: 600, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  block: { borderWidth: 0.75, borderColor: LINE, borderRadius: 4, marginBottom: 8 },
  blockHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8, backgroundColor: SOFT, borderBottomWidth: 0.75, borderBottomColor: LINE },
  th: { fontSize: 7.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: LINE },
});

const col = { doc: { width: "36%" }, status: { width: "20%" }, expiry: { width: "18%" }, note: { width: "26%" } } as const;

function Pill({ text, colour }: { text: string; colour: { fg: string; bg: string } }) {
  return h(View, { style: { flexDirection: "row" } }, h(Text, { style: [s.pill, { color: colour.fg, backgroundColor: colour.bg }] }, text));
}

function Header() {
  return h(
    View,
    { style: s.band, fixed: true },
    h(Image, { src: LOGO_PATH, style: s.logo }),
    h(Text, { style: s.bandTitle }, "Compliance report"),
  );
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return h(
    View,
    { style: s.footer, fixed: true },
    h(
      View,
      { style: s.footerRow },
      h(Text, null, `Generated ${generatedAt}`),
      h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }),
      h(Text, null, "Subbies"),
    ),
    h(Text, { style: s.disclaimer }, DISCLAIMER),
  );
}

function Summary({ m }: { m: ReportModel }) {
  return h(
    View,
    null,
    h(Text, { style: s.eyebrow }, m.companyName),
    h(Text, { style: s.h1 }, m.projectName),
    h(Text, { style: s.sub }, [m.address, `Generated ${m.generatedAt}`].filter(Boolean).join("  ·  ")),
    h(
      View,
      { style: [s.row, { marginTop: 14, alignItems: "stretch" }] },
      h(
        View,
        { style: { width: 110, justifyContent: "center" } },
        h(Text, { style: s.figure }, m.percent === null ? "–" : `${m.percent}%`),
        h(Text, { style: s.metricLabel }, m.percent === null ? "No contractors assigned" : "Contractors cleared"),
      ),
      ...m.metrics.map((x) =>
        h(View, { key: x.label, style: s.metric }, h(Text, { style: s.metricValue }, String(x.value)), h(Text, { style: s.metricLabel }, x.label)),
      ),
    ),
  );
}

function MapAndDetails({ m }: { m: ReportModel }) {
  const detail = (label: string, value: string | null) =>
    value ? h(View, { key: label }, h(Text, { style: s.detailLabel }, label), h(Text, { style: s.detailValue }, value)) : null;
  return h(
    View,
    { style: [s.row, { marginTop: 16 }], wrap: false },
    h(
      View,
      { style: [s.box, { width: "56%", height: 150, overflow: "hidden", justifyContent: "center", alignItems: "center", backgroundColor: SOFT }] },
      m.map
        ? h(Image, { src: { data: m.map, format: "png" }, style: { width: "100%", height: "100%", objectFit: "cover" } })
        : h(Text, { style: { color: MUTED, fontSize: 9 } }, m.hasLocation ? "Map unavailable" : "Location not provided"),
    ),
    h(
      View,
      { style: { width: "44%", paddingLeft: 14 } },
      detail("Company", m.companyName),
      detail("Address", m.address),
      detail("Project status", m.projectStatus),
      detail("Dates", m.dates),
      detail("Checked against", m.mode === "requirements" ? "This project's requirements" : "Each contractor's overall status"),
    ),
  );
}

function Photos({ m }: { m: ReportModel }) {
  if (m.photos.length === 0) return null;
  return h(
    View,
    { wrap: false },
    h(Text, { style: s.h2 }, "Jobsite photos"),
    h(
      View,
      { style: s.row },
      ...m.photos.map((buf, i) =>
        h(
          View,
          { key: i, style: [s.box, { width: "32%", height: 130, marginLeft: i === 0 ? 0 : "2%", padding: 3, justifyContent: "center", alignItems: "center" }] },
          h(Image, { src: { data: buf, format: "jpg" }, style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" } }),
        ),
      ),
    ),
  );
}

function Contractors({ m }: { m: ReportModel }) {
  const heading = h(Text, { style: s.h2 }, "Contractor breakdown");
  if (m.contractors.length === 0) {
    return h(View, { wrap: false }, heading, h(Text, { style: { color: MUTED } }, "No contractors are assigned to this project."));
  }
  const blocks = m.contractors.map((c, i) =>
      h(
        View,
        { key: i, style: s.block, wrap: false },
        h(
          View,
          { style: s.blockHead },
          h(
            View,
            { style: { flexShrink: 1, paddingRight: 8 } },
            h(Text, { style: { fontSize: 10.5, fontWeight: 600 } }, c.name),
            c.trade ? h(Text, { style: { fontSize: 8, color: MUTED, marginTop: 1 } }, c.trade) : null,
          ),
          h(Pill, { text: CONTRACTOR_STATUS_TEXT[c.status], colour: CONTRACTOR_COLOUR[c.status] }),
        ),
        c.rows.length === 0
          ? h(Text, { style: { padding: 8, color: MUTED, fontSize: 9 } }, "No documents recorded.")
          : h(
              View,
              null,
              h(
                View,
                { style: [s.row, { paddingVertical: 4, paddingHorizontal: 8 }] },
                h(Text, { style: [s.th, col.doc] }, "Document"),
                h(Text, { style: [s.th, col.status] }, "Status"),
                h(Text, { style: [s.th, col.expiry] }, "Expiry"),
                h(Text, { style: [s.th, col.note] }, "Note"),
              ),
              ...c.rows.map((r, j) =>
                h(
                  View,
                  { key: j, style: s.tr },
                  h(Text, { style: [col.doc, { paddingRight: 6 }] }, r.document),
                  h(
                    View,
                    { style: col.status },
                    h(Pill, {
                      text: STATUS_TEXT[r.status],
                      // A missing optional document isn't a compliance problem: neutral, not red.
                      colour: !r.mandatory && r.status === "missing" ? NEUTRAL : STATE_COLOUR[r.status],
                    }),
                  ),
                  h(Text, { style: col.expiry }, r.expiry),
                  h(Text, { style: [col.note, { color: MUTED }] }, r.note),
                ),
              ),
            ),
      ),
  );
  // The heading travels with the first block, so it's never left alone at a page foot.
  return h(View, null, h(View, { wrap: false }, heading, blocks[0]), ...blocks.slice(1));
}

export function ReportDocument({ model }: { model: ReportModel }) {
  registerPdfAssets();
  return h(
    Document,
    { title: `${model.projectName}: compliance report`, author: "Subbies", creator: "Subbies", producer: "Subbies" },
    h(
      Page,
      { size: "A4", style: s.page },
      h(Header),
      h(Footer, { generatedAt: model.generatedAt }),
      h(Summary, { m: model }),
      h(MapAndDetails, { m: model }),
      h(Photos, { m: model }),
      h(Contractors, { m: model }),
    ),
  );
}
