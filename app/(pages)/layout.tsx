import type { ReactNode } from "react";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import WhatsNew from "@/components/site/WhatsNew";
import { getReleases } from "@/lib/changelog";

/**
 * Chrome for the standalone pages — privacy, contact.
 *
 * The root layout deliberately renders nothing but the background and its
 * children, so the home page assembles its own header and footer. Two pages
 * needing the identical arrangement is what this layout is: a route group, so
 * the segment never appears in a URL and the routes stay `/privacy` and
 * `/contact`.
 *
 * `WhatsNew` is mounted only so the header's Changelog button has a listener —
 * the trigger dispatches a window event and would otherwise be a dead control
 * on every page but the home one. `autoOpen={false}` is the other half: an
 * unseen release must not throw a changelog over a privacy policy that the
 * Store submission points a reviewer straight at.
 *
 * The props are typed by hand rather than with Next's generated
 * `LayoutProps<…>`, which keys off a single route path and has none to key off
 * for a layout spanning two.
 */
export default function PagesLayout({ children }: { children: ReactNode }) {
  const releases = getReleases();

  return (
    <>
      <SiteHeader />
      {/* `flex-1` against the body's `min-h-full flex flex-col` is what keeps
          the footer at the bottom on a page shorter than the viewport. */}
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsNew releases={releases} autoOpen={false} />
    </>
  );
}
