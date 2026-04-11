export default function SimpleTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
        Нет данных.
      </div>
    );
  }

  const keys = Object.keys(rows[0]).slice(0, 8);

  const renderCell = (value) => {
    if (value == null) return "";

    if (Array.isArray(value)) {
      if (!value.length) return "—";

      // For arrays of objects (like plan items), show concise readable labels.
      if (typeof value[0] === "object" && value[0] !== null) {
        const labels = value
          .map((item) =>
            item?.title ||
            item?.name ||
            item?.label ||
            item?.subject ||
            item?.id
          )
          .filter(Boolean)
          .map(String);
        return labels.length ? labels.join("; ") : `${value.length} элементов`;
      }

      return value.map(String).join(", ");
    }

    if (typeof value === "object") {
      const label =
        value.title ||
        value.name ||
        value.fullName ||
        value.label ||
        value.email ||
        value.id;
      return label ? String(label) : "Объект";
    }

    return String(value);
  };

  return (
    <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/90">
          <tr>
            {keys.map((k) => (
              <th key={k} className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
              {keys.map((k) => (
                <td key={k} className="px-3 py-2.5 text-slate-200 align-top">
                  {renderCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
