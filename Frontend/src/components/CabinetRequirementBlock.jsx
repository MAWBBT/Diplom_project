import { Link } from "react-router-dom";

/** Блок «пункт требований» для обзора личного кабинета */
export function CabinetRequirementBlock({ number, title, description, children, actions }) {
  return (
    <article className="rounded-2xl border border-slate-700/55 bg-gradient-to-br from-slate-950/50 via-slate-900/30 to-slate-950/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
      <div className="flex gap-3 border-b border-slate-700/45 pb-3 mb-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sm font-bold text-sky-200 ring-1 ring-sky-400/25">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-slate-100">{title}</h3>
          {description ? <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="text-sm text-slate-300 space-y-2">{children}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}

export function CabinetActionButton({ type = "button", onClick, to, children, variant = "secondary" }) {
  const base =
    "inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium border transition-colors";
  const styles =
    variant === "primary"
      ? `${base} border-transparent bg-sky-400 text-slate-950 hover:brightness-105`
      : `${base} border-slate-600/65 bg-slate-800/70 text-slate-200 hover:bg-slate-700/90`;

  if (to) {
    return (
      <Link to={to} className={styles}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={styles} onClick={onClick}>
      {children}
    </button>
  );
}
