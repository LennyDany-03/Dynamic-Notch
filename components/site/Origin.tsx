
export default function Origin() {
  return (
    <section className="relative py-[clamp(48px,8vw,88px)]">
      <div className="mx-auto max-w-[720px] px-[22px] text-center">
        <p className="t-eyebrow">Why the top edge</p>
        <h2 className="t-title mt-3">
          Windows leaves that space empty.
          <span className="text-[var(--heading-tint)]"> We didn&rsquo;t.</span>
        </h2>
        <p className="t-lede mx-auto mt-5 max-w-[38rem]">
          The strip above your desktop is bigger than a menu bar and does
          exactly as much. Crest started as a two-hour experiment to see if
          that space could hold something useful without turning into another
          sidebar, another floating window, another thing competing for room.
          It didn&rsquo;t need to. It just needed to know when to show up.
        </p>
      </div>
    </section>
  );
}
