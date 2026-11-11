import { createClient } from "@/lib/supabase/server";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import { can, isPlanId } from "@/lib/billing/plans";
import { checkRateLimit, RATE_LIMITS, TOO_MANY_REQUESTS_MESSAGE } from "@/lib/rate-limit";
import { computeProjectCompliance } from "@/lib/compliance/project";
import { loadComplianceInputs } from "@/lib/projects/compliance-data";
import { complianceToday } from "@/lib/time/compliance-today";
import { publicMapboxToken, staticMapUrl } from "@/lib/mapbox/static-map";
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos/constants";
import { buildReportModel } from "@/lib/pdf/report-model";
import { renderReport } from "@/lib/pdf/render";
import { isUuid } from "@/lib/onboarding";
import { loadProjectLocation } from "@/app/dashboard/projects/[id]/_lib/location";

export const runtime = "nodejs";
export const maxDuration = 30;

const json = (status: number, error: string) => Response.json({ ok: false, error }, { status });

/** The static map, fetched server-side with a 4 s timeout. null on any failure. */
async function fetchMap(lat: number, lng: number): Promise<Buffer | null> {
  const token = process.env.MAPBOX_SERVER_TOKEN?.trim() || publicMapboxToken();
  if (!token) return null;
  try {
    const res = await fetch(staticMapUrl({ lat, lng, token, width: 640, height: 360, zoom: 15 }), {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * GET /api/projects/[id]/report: the project's compliance report as a PDF
 * (Business and up). Same loader and engine as the workspace, so the PDF
 * matches the screen. A missing map or photo never fails the report.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/report">) {
  const { id: projectId } = await ctx.params;
  if (!isUuid(projectId)) return json(404, "Couldn't find that project.");

  const access = await requireActiveCompany();
  if (!access.ok) return json(403, access.error);
  const company = access.company;

  const sub = await getSubscriptionRow(company.id);
  const plan = isPlanId(sub?.plan) ? sub!.plan : null;
  if (!can(plan, "pdfExport")) return json(403, "PDF reports are on the Business plan.");

  if (!(await checkRateLimit(RATE_LIMITS.pdfReport, company.id))) return json(429, TOO_MANY_REQUESTS_MESSAGE);

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, address, status, start_date, end_date")
    .eq("id", projectId)
    .eq("company_id", company.id)
    .maybeSingle<{ id: string; name: string; address: string | null; status: string; start_date: string | null; end_date: string | null }>();
  if (!project) return json(404, "Couldn't find that project.");

  const [{ byProject, error }, location, photoRows] = await Promise.all([
    loadComplianceInputs(supabase, [projectId]),
    loadProjectLocation(projectId, company.id),
    supabase.from("project_photos").select("storage_path").eq("project_id", projectId).order("position", { ascending: true }),
  ]);
  if (error) return json(500, "Couldn't load the project's compliance. Try again.");
  const inputs = byProject.get(projectId)!;
  const now = complianceToday();
  const compliance = computeProjectCompliance({
    requirements: inputs.requirements,
    contractors: inputs.contractors,
    documents: inputs.documents,
    now,
    mode: can(plan, "requirements") ? "requirements" : "basic",
  });

  // Map and photos are fetched independently; any failure just leaves it out.
  const bucket = supabase.storage.from(PROJECT_PHOTOS_BUCKET);
  const [map, ...photos] = await Promise.all([
    location ? fetchMap(location.lat, location.lng) : Promise.resolve(null),
    ...((photoRows.data ?? []) as { storage_path: string }[]).slice(0, 3).map(async (r) => {
      try {
        const { data } = await bucket.download(r.storage_path);
        return data ? Buffer.from(await data.arrayBuffer()) : null;
      } catch {
        return null;
      }
    }),
  ]);

  const model = buildReportModel({
    companyName: company.name,
    project,
    locationAddress: location?.address ?? null,
    compliance,
    documents: inputs.documents,
    now,
    generatedAt: new Date(),
    map,
    hasLocation: location !== null,
    photos: photos.filter((p) => p !== null) as Buffer[],
  });

  let pdf: Buffer;
  try {
    pdf = await renderReport(model);
  } catch (err) {
    console.error("report: render failed", { err: String(err) });
    return json(500, "Couldn't create the report. Try again.");
  }

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "project";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date());
  // Streamed in chunks (the platform's response-size cap doesn't apply to streams).
  const CHUNK = 64 * 1024;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= pdf.length) return controller.close();
      controller.enqueue(new Uint8Array(pdf.subarray(offset, offset + CHUNK)));
      offset += CHUNK;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}-compliance-report-${date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
