/**
 * Renders the report and keeps it inside the size budget. Images are
 * re-encoded for print first (about 1000px, moderate JPEG quality); if the
 * PDF still comes out over ~4 MB, they're squeezed harder and it's rendered
 * once more. A map or photo that won't decode is dropped, never fatal.
 */
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";

import type { ReportModel } from "./report-model.ts";
import { ReportDocument } from "./report-document.ts";

export const PDF_BUDGET_BYTES = 4 * 1024 * 1024;

async function prepare(buf: Buffer, edge: number, quality: number, format: "jpeg" | "png"): Promise<Buffer | null> {
  try {
    const img = sharp(buf, { failOn: "error", limitInputPixels: 40_000_000 }).rotate().resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true });
    return format === "png" ? await img.png({ compressionLevel: 9 }).toBuffer() : await img.jpeg({ quality, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}

async function withImages(model: ReportModel, edge: number, quality: number): Promise<ReportModel> {
  const photos = (await Promise.all(model.photos.map((p) => prepare(p, edge, quality, "jpeg")))).filter((p): p is Buffer => p !== null);
  const map = model.map ? await prepare(model.map, 1000, quality, "png") : null;
  return { ...model, photos, map };
}

export async function renderReport(model: ReportModel): Promise<Buffer> {
  // react-pdf's types want a <Document> element; ReportDocument returns one.
  const render = async (m: ReportModel) =>
    renderToBuffer(createElement(ReportDocument, { model: m }) as unknown as Parameters<typeof renderToBuffer>[0]);
  let pdf = await render(await withImages(model, 1000, 70));
  if (pdf.length > PDF_BUDGET_BYTES) {
    pdf = await render(await withImages(model, 700, 45));
  }
  return pdf;
}
