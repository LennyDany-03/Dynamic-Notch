const steps = [
  {
    n: "01",
    title: "Install and forget",
    body: "One installer, no setup screen. Crest registers itself to start with Windows and then gets out of the way — there is nothing to configure before it is useful.",
  },
  {
    n: "02",
    title: "Nudge the top of the screen",
    body: "A thin strip at the very top edge is the trigger. Touch it and the pill peeks; keep the cursor there for 600ms and the full card opens. Passing through on your way to a tab does nothing.",
  },
  {
    n: "03",
    title: "Move between panels",
    body: "Chevrons either side of the panel name step through Media, Launcher, and Shelf & Notes. Drag a file at the notch and it jumps straight to the shelf.",
  },
  {
    n: "04",
    title: "Move away",
    body: "Leave the card and it steps back down — expanded, to pill, to nothing — with a short grace period at each step so a slipped cursor doesn't close it.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-white/[.06] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="section-label">How it works</p>
            <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
              No shortcut to learn.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-[var(--muted)]">
              The whole interface is one motion you already make a hundred times
              a day: moving the cursor to the top of the screen. Crest is a
              cursor-driven overlay, not another window to manage.
            </p>
          </div>

          <ol className="relative space-y-3">
            {steps.map((step) => (
              <li key={step.n} className="pane rounded-2xl p-6 sm:p-7">
                <div className="relative z-[1] flex gap-5">
                  <span className="font-mono text-[13px] font-semibold text-[var(--accent-bright)]">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--muted)]">
                      {step.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
