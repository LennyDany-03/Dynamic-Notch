const steps = [
  {
    n: "01",
    title: "Install and forget",
    body: "One installer, no setup screen. Crest registers itself to start with Windows and then gets out of the way — there is nothing to configure before it is useful. A thin mark on the top edge shows you where to point until you no longer need it.",
  },
  {
    n: "02",
    title: "Nudge the top of the screen",
    body: "A thin strip at the very top edge is the trigger. Touch it and the pill peeks; keep the cursor there for 600ms and the full card opens. Passing through on your way to a tab does nothing.",
  },
  {
    n: "03",
    title: "Move between panels",
    body: "Chevrons either side of the panel name step through Media, Launcher, Shelf & Notes, Notifications, System, Weather and Calendar — or just scroll over the card. A list that scrolls on its own still scrolls on its own, so reading to the bottom of your notifications never tips you into the next panel. Drag a file at the notch and it jumps straight to the shelf.",
  },
  {
    n: "04",
    title: "Let it come to you",
    body: "Some things do not wait to be hovered. A track starting, a notification arriving, a reminder falling due, a charger going in, or your machine struggling — each drops a small banner down for a few seconds and retracts it. Hover to hold one while you read; keep hovering the ones with a panel behind them and it opens.",
  },
  {
    n: "05",
    title: "Move away",
    body: "Leave the card and it steps back down — expanded, to pill, to nothing — with a short grace period at each step so a slipped cursor doesn't close it. Or switch \"Always on top\" on and the pill simply stays.",
  },
  {
    n: "06",
    title: "Never think about updating it",
    body: "Crest checks for a new version shortly after it starts and again through the day. If there is one, it downloads and installs it on its own — no installer window, no prompts, no wizard. The only sign is a small loader in the notch itself.",
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
