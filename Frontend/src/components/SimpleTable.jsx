import { formatColumnLabel, formatTableCell } from "../utils/tableLabels";

const HIDDEN_KEYS = new Set(["createdAt", "updatedAt", "created_at", "updated_at"]);

export default function SimpleTable({ rows, columnLabels = {}, hiddenKeys = [] }) {
  const hidden = new Set([...HIDDEN_KEYS, ...hiddenKeys]);

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
        Нет данных.
      </div>
    );
  }

  const keys = Object.keys(rows[0])
    .filter((k) => !hidden.has(k))
    .slice(0, 10);

  const renderCell = (key, value) => {
    if (value == null && value !== 0) return "";

    if (Array.isArray(value)) {
      if (!value.length) return "—";

      if (typeof value[0] === "object" && value[0] !== null) {
        const labels = value
          .map((item) =>
            item?.title || item?.name || item?.label || item?.subject || item?.fullName || item?.id
          )
          .filter(Boolean)
          .map(String);
        return labels.length ? labels.join("; ") : `${value.length} элементов`;
      }

      return value.map((v) => formatTableCell(key, v)).join(", ");
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

    const formatted = formatTableCell(key, value);
    return formatted === "" ? "—" : formatted;
  };

  return (
    <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/90">
          <tr>
            {keys.map((k) => (
              <th
                key={k}
                className="px-3 py-3 text-left text-[11px] font-medium text-slate-400 whitespace-nowrap"
              >
                {formatColumnLabel(k, columnLabels)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
              {keys.map((k) => (
                <td key={k} className="px-3 py-2.5 text-slate-200 align-top">
                  {renderCell(k, row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
