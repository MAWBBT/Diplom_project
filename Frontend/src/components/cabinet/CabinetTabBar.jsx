/** Единая панель вкладок личного кабинета (без дублирования в шапке сайта) */
export default function CabinetTabBar({ tabs, activeTab, onTabChange }) {
  return (
    <nav
      aria-label="Разделы личного кабинета"
      className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
    >
      <ul className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onTabChange(id)}
              className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium border transition-all ${
                activeTab === id
                  ? "text-slate-900 border-sky-300 bg-sky-400 shadow-[0_10px_26px_rgba(56,189,248,0.34)]"
                  : "text-slate-200 border-slate-600/65 bg-slate-800/60 hover:bg-slate-700/85"
              }`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
