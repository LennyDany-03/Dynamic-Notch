import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
  Satori can't resolve `/crest-logo.png` against a relative URL, so the app icon
  is inlined as a data URI. Read once at module scope: this runs at build time
  for a static route, so the cost is paid once, not per request.
*/
const logo = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "crest-logo.png")
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#07070b",
          // Satori supports only a subset of CSS — no filters, so the aurora
          // is faked with two stacked radial gradients.
          backgroundImage:
            "radial-gradient(1000px 700px at 42% -22%, rgba(124,58,237,.78), transparent 72%), radial-gradient(760px 560px at 104% 0%, rgba(27,0,181,.85), transparent 72%), radial-gradient(620px 420px at -8% 108%, rgba(168,85,247,.3), transparent 70%)",
          color: "#ededf2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={76} height={76} alt="" style={{ borderRadius: 18 }} />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {site.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 82,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            The dynamic notch, built for Windows.
          </div>
          <div style={{ fontSize: 32, color: "rgba(237,237,242,.62)", maxWidth: 880 }}>
            Music, apps, clipboard, files and notes — one hover away, zero
            taskbar presence.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 26 }}>
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.14)",
            }}
          >
            Free · Open source
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.14)",
            }}
          >
            Windows 10 & 11
          </div>
        </div>
      </div>
    ),
    size
  );
}
