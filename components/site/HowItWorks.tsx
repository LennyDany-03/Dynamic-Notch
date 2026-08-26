const steps = [
  {
    n: "01",
    title: "Install and forget",
    body: "One installer, no setup screen. Crest registers itself to start with Windows and then gets out of the way: there is nothing to configure before it is useful. A thin mark on the top edge shows you where to point until you no longer need it.",
  },
  {
    n: "02",
    title: "Nudge the top of the screen",
    body: "A thin strip at the very top edge is the trigger. Touch it and the pill peeks; keep the cursor there for 600ms and the full card opens. Passing through on your way to a tab does nothing.",
  },
  {
    n: "03",
    title: "Move between panels",
    body: "Chevrons either side of the panel name step through Media, Launcher, Shelf & Notes, Notifications, System, Weather and Calendar, or just scroll over the card. A list that scrolls on its own still scrolls on its own, so reading to the bottom of your notifications never tips you into the next panel. Drag a file at the notch and it jumps straight to the shelf.",
  },
  {
    n: "04",
    title: "Let it come to you",
    body: "Some things do not wait to be hovered. A track starting, a notification arriving, a reminder falling due, a charger going in, or your machine struggling: each drops a small banner down for a few seconds and retracts it. Hover to hold one while you read; keep hovering the ones with a panel behind them and it opens.",
  },
  {
    n: "05",
    title: "Move away",
    body: "Leave the card and it steps back down (expanded, to pill, to nothing) with a short grace period at each step so a slipped cursor doesn't close it. Or switch \"Always on top\" on and the pill simply stays.",
  },
  {
    n: "06",
    title: "Never think about updating it",
    body: "Crest checks for a new version shortly after it starts and again through the day. If there is one, it downloads and installs it on its own: no installer window, no prompts, no wizard. The only sign is a small loader in the notch itself.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="t-eyebrow">How it works</p>
            <h2 className="t-title mt-3">No shortcut to learn.</h2>
            <p className="t-lede mt-5">
              The whole interface is one motion you already make a hundred times
              a day: moving the cursor to the top of the screen. Crest is a
              cursor-driven overlay, not another window to manage.
            </p>
          </div>

          
          <ol className="panel overflow-hidden divide-y divide-[var(--hairline)]">
            {steps.map((step) => (
              <li
                key={step.n}
                className="flex gap-5 px-6 py-7 transition-colors duration-200 hover:bg-[var(--surface-raised)] sm:px-8"
              >
                <span className="tnum mt-[3px] shrink-0 text-[13px] font-semibold tracking-[-0.01em] text-[var(--text-faint)]">
                  {step.n}
                </span>
                <div className="min-w-0">
                  <h3 className="t-heading">{step.title}</h3>
                  <p className="t-body mt-1.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
