import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * `site.url` is `NEXT_PUBLIC_SITE_URL` or a localhost fallback, so a host that
 * has not been given the variable produces a sitemap full of localhost URLs.
 * That is the same failure `metadataBase` has, and the same fix: set the
 * variable on the host once the real domain is live.
 *
 * `/privacy` is not here for search engines alone — it is the URL submitted to
 * the Microsoft Store, so it needs to be discoverable and stay that way.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${site.url}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${site.url}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
