import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

/**
 * Lets crawlers index the marketing pages and keeps them out of everything
 * that is either private or per-user: the dashboard, the token upload links,
 * the API, and the auth pages (which carry no indexable content and shouldn't
 * show up in search).
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/onboarding",
        "/onboard/",
        "/billing",
        "/api/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/auth/",
      ],
    },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
