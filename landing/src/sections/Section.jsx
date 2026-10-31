/** Shared section frame: anchor id, eyebrow label, heading and optional lede. */
export default function Section({ id, eyebrow, title, lede, children, className = '' }) {
  return (
    <section id={id} className={`border-t border-app-border ${className}`}>
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6 md:py-24">
        <div className="mb-10 max-w-2xl md:mb-14">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {eyebrow}
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-app-strong md:text-4xl">
            {title}
          </h2>
          {lede && <p className="mt-4 text-base leading-relaxed text-app-soft">{lede}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}
