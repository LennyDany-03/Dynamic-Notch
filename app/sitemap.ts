import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * `site.url` resolves to the custom domain if one is configured, otherwise the
 * Vercel production domain, and only falls back to localhost off-host — see the
 * comment on `origin` in `lib/site.ts`. It used to be the variable or localhost
 * with nothing in between, which shipped a live sitemap full of
 * `http://localhost:3000` URLs whenever nobody had set the variable.
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
