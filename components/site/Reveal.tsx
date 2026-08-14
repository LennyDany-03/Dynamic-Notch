"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Slides its child up into place the first time it is scrolled into view.
 *
 * An IntersectionObserver rather than a scroll listener: the browser does the
 * work off the main thread and there is no per-frame handler competing with the
 * card grids for it. It unobserves after the first hit, because a card that
 * re-animated every time it passed the fold would turn a scroll back up the page
 * into a light show.
 *
 * `delay` staggers a grid. Applied as `animation-delay`, so the whole row is
 * observed at once and only the painting is offset — staggering the *observation*
 * would mean a card near the bottom of the viewport had already scrolled past
 * before its turn came.
 *
 * Cards start at `opacity: 0` (see `.reveal` in globals.css), which is a real
 * decision and not an oversight: there is no server-rendered "already visible"
 * state to fall back to, so anything above the fold has to be revealed by the
 * observer firing immediately — which it does, synchronously, on the first
 * callback after mount. The `prefers-reduced-motion` block pins them visible.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Milliseconds to hold the animation back, for staggering a grid. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No observer (very old browser, or a test environment): show the content
    // rather than leaving a page of invisible cards behind a feature check.
    //
    // On a frame rather than straight away, because the initial state has to
    // stay `false` on both sides of hydration — the server has no
    // `IntersectionObserver` either, and branching on it during render would
    // mark every card visible in the HTML and unvisible on the client.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      // A little before the edge, so a card is already settled by the time it is
      // properly on screen rather than animating under the reader's eye.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={visible && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
