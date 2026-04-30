import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

const TYPES = [
  { id: "grades", label: "Сводная успеваемость" },
  { id: "attendance", label: "Сводная посещаемость" },
  { id: "plans", label: "Состояние индивидуальных планов" },
  { id: "attestations", label: "Результаты аттестаций" },
];

export default function ReportsPage() {
  const [list, setList] = useState([]);
  const [type, setType] = useState("grades");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");

  const load = async () => {
    try {
      setList((await api.get("/reports")).data || []);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    try {
      const payload = { type };
      if (type === "plans") payload.academicYear = academicYear;
      if (type !== "plans") {
        if (dateFrom) payload.dateFrom = dateFrom;
        if (dateTo) payload.dateTo = dateTo;
      }
      await api.post("/reports/generate", payload);
      toast.success("Отчёт сгенерирован");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const rows = useMemo(
    () =>
      (list || []).map((r) => ({
        id: r.id,
        reportType: r.reportType,
        originalName: r.originalName,
        size: r.size,
        createdAt: r.createdAt,
        generatedBy: r.generatedBy?.fullName || r.generatedBy?.login || "—",
        download: `/api/reports/${r.id}/download`,
      })),
    [list]
  );

  return (
    <div className="space-y-6">
      <SectionCard
        title="Отчётность (Excel)"
        right={
          <button
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={load}
          >
            Обновить список
          </button>
        }
      >
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 grid lg:grid-cols-5 gap-3 items-end mb-6">
          <div className="lg:col-span-2">
            <div className="text-xs text-slate-400 mb-1">Тип отчёта</div>
            <select
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {type === "plans" ? (
            <div className="lg:col-span-2">
              <div className="text-xs text-slate-400 mb-1">Учебный год</div>
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <div className="text-xs text-slate-400 mb-1">Период (с)</div>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Период (по)</div>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            className="lg:col-span-1 rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center"
            onClick={generate}
          >
            Сгенерировать
          </button>
        </div>

        <div className="text-slate-400 text-xs mb-3">
          Отчёты сохраняются на сервере и доступны для скачивания позже.
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-950/55 shadow-inner overflow-auto mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/90">
              <tr>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Тип</th>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Файл</th>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Кто</th>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Когда</th>
                <th className="px-3 py-3 text-right uppercase tracking-wide text-[11px] text-slate-400 font-medium">Скачать</th>
              </tr>
            </thead>
            <tbody>
              {(list || []).map((r) => (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                  <td className="px-3 py-2.5 text-slate-200">{r.reportType}</td>
                  <td className="px-3 py-2.5 text-slate-200">{r.originalName}</td>
                  <td className="px-3 py-2.5 text-slate-200">{r.generatedBy?.fullName || r.generatedBy?.login || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-200">{r.createdAt}</td>
                  <td className="px-3 py-2.5 text-right">
                    <a
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105 inline-block"
                      href={`/api/reports/${r.id}/download`}
                    >
                      Скачать
                    </a>
                  </td>
                </tr>
              ))}
              {(list || []).length === 0 ? (
                <tr className="border-t border-slate-800">
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Пока нет отчётов.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <SimpleTable rows={rows} />
      </SectionCard>
    </div>
  );
}

