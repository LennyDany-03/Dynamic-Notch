"use client";

import { useEffect, useRef } from "react";

type Layer = {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  depth: number;
  blur: number;
  driftX: number;
  driftY: number;
  driftDuration: number;
  driftDelay: number;
};

const LAYERS: Layer[] = [
  { x: 20, y: 8, size: 52, color: "#2f6fed", opacity: 0.32, depth: 0.18, blur: 90, driftX: 18, driftY: 12, driftDuration: 24, driftDelay: 0 },
  { x: 80, y: 16, size: 44, color: "#5b90f5", opacity: 0.26, depth: 0.32, blur: 80, driftX: -14, driftY: 16, driftDuration: 29, driftDelay: -6 },
  { x: 62, y: 55, size: 58, color: "#123a9e", opacity: 0.3, depth: 0.46, blur: 100, driftX: 16, driftY: -14, driftDuration: 21, driftDelay: -3 },
  { x: 8, y: 68, size: 42, color: "#5b90f5", opacity: 0.22, depth: 0.6, blur: 70, driftX: -16, driftY: -10, driftDuration: 27, driftDelay: -12 },
  { x: 42, y: 92, size: 50, color: "#2f6fed", opacity: 0.24, depth: 0.74, blur: 85, driftX: 10, driftY: 14, driftDuration: 23, driftDelay: -9 },
  { x: 92, y: 78, size: 38, color: "#5b90f5", opacity: 0.2, depth: 0.88, blur: 65, driftX: -12, driftY: -16, driftDuration: 33, driftDelay: -18 },
];

const LERP = 0.06;

export default function ParallaxBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0, scroll: 0 });
  const current = useRef({ x: 0, y: 0, scroll: 0 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const handlePointerMove = (event: PointerEvent) => {
      target.current.x = event.clientX / window.innerWidth - 0.5;
      target.current.y = event.clientY / window.innerHeight - 0.5;
    };

    const handleScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target.current.scroll = max > 0 ? window.scrollY / max : 0;
    };

    const tick = () => {
      const c = current.current;
      const t = target.current;
      c.x += (t.x - c.x) * LERP;
      c.y += (t.y - c.y) * LERP;
      c.scroll += (t.scroll - c.scroll) * LERP;

      root.style.setProperty("--px", c.x.toFixed(4));
      root.style.setProperty("--py", c.y.toFixed(4));
      root.style.setProperty("--pscroll", c.scroll.toFixed(4));

      frame.current = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    frame.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="parallax-bg fixed inset-0 overflow-hidden pointer-events-none"
      style={{ "--px": 0, "--py": 0, "--pscroll": 0 } as React.CSSProperties}
    >
      <div className="parallax-bg__stage">
        {LAYERS.map((layer, i) => (
          <div
            key={i}
            className="parallax-bg__orbit"
            style={
              {
                "--depth": layer.depth,
                left: `${layer.x}%`,
                top: `${layer.y}%`,
              } as React.CSSProperties
            }
          >
            <div
              className="parallax-bg__drift"
              style={{
                animationDuration: `${layer.driftDuration}s`,
                animationDelay: `${layer.driftDelay}s`,
                "--drift-x": `${layer.driftX}px`,
                "--drift-y": `${layer.driftY}px`,
              } as React.CSSProperties}
            >
              <div
                className="parallax-bg__orb"
                style={{
                  width: `${layer.size}vmax`,
                  height: `${layer.size}vmax`,
                  filter: `blur(${layer.blur}px)`,
                  background: `radial-gradient(circle at 50% 50%, ${layer.color} 0%, transparent 70%)`,
                  opacity: layer.opacity,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
