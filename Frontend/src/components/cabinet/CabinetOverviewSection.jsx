/** Полноценный раздел обзора личного кабинета (заголовок + содержимое) */
export default function CabinetOverviewSection({ number, title, description, children, footer }) {
  return (
    <section className="rounded-2xl border border-slate-700/55 bg-gradient-to-br from-slate-950/40 via-slate-900/20 to-slate-950/50 overflow-hidden">
      <header className="flex gap-3 border-b border-slate-700/50 px-5 py-4 bg-slate-900/30">
        {number != null ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sm font-bold text-sky-200 ring-1 ring-sky-400/25">
            {number}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          {description ? <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p> : null}
        </div>
      </header>
      <div className="p-5">{children}</div>
      {footer ? <footer className="px-5 pb-4 pt-0 flex flex-wrap gap-2">{footer}</footer> : null}
    </section>
  );
}
