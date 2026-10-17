import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

/** The public marketing pages only — nothing private or per-user. */
const PATHS = ["", "/how-it-works", "/pricing", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return [];
  const lastModified = new Date();
  return PATHS.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
