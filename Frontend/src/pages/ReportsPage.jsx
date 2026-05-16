import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import { downloadWithAuth } from "../api/downloadWithAuth";
import SectionCard from "../components/SectionCard";
import { formatTableCell } from "../utils/tableLabels";

const TYPES = [
  { id: "grades", label: "Сводная успеваемость" },
  { id: "attendance", label: "Сводная посещаемость" },
  { id: "plans", label: "Состояние индивидуальных планов" },
  { id: "attestations", label: "Результаты аттестаций" },
];

function formatReportParams(paramsJson, reportType) {
  if (!paramsJson) return "—";
  let p;
  try {
    p = typeof paramsJson === "string" ? JSON.parse(paramsJson) : paramsJson;
  } catch {
    return "—";
  }
  if (!p || typeof p !== "object") return "—";
  if (reportType === "plans" && p.academicYear) {
    return `Учебный год: ${p.academicYear}`;
  }
  const from = p.dateFrom || "не задано";
  const to = p.dateTo || "не задано";
  return `с ${from} по ${to}`;
}

function formatCreatedAt(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU");
  } catch {
    return String(value);
  }
}

export default function ReportsPage() {
  const [list, setList] = useState([]);
  const [type, setType] = useState("grades");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setList((await api.get("/reports")).data || []);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    if (type !== "plans" && dateFrom && dateTo && dateFrom > dateTo) {
      toast.error("Дата «с» не может быть позже даты «по»");
      return;
    }

    setGenerating(true);
    try {
      const payload = { type };
      if (type === "plans") {
        payload.academicYear = academicYear.trim() || "2026-2027";
      } else {
        if (dateFrom) payload.dateFrom = dateFrom;
        if (dateTo) payload.dateTo = dateTo;
      }
      const { data: created } = await api.post("/reports/generate", payload);
      toast.success("Отчёт сформирован");
      await load();
      if (created?.id) {
        await downloadWithAuth(`/reports/${created.id}/download`, created.originalName);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (reportId, filename) => {
    try {
      await downloadWithAuth(`/reports/${reportId}/download`, filename || "report.xlsx");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Отчётность (Excel)"
        right={
          <button
            type="button"
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors disabled:opacity-50"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Загрузка…" : "Обновить список"}
          </button>
        }
      >
        <p className="text-slate-300 text-sm mb-4 leading-relaxed">
          Формирование сводных отчётов в Excel для роли администратора: успеваемость, посещаемость,
          статусы индивидуальных планов (включая этапы), результаты аттестаций. В файле указаны
          параметры фильтрации, заголовки столбцов и данные; после генерации файл можно скачать
          сразу или позже из списка.
        </p>

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
                placeholder="2026-2027"
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
            type="button"
            className="lg:col-span-1 rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center disabled:opacity-60"
            onClick={generate}
            disabled={generating}
          >
            {generating ? "Формирование…" : "Сгенерировать"}
          </button>
        </div>

        <div className="text-slate-400 text-xs mb-3">
          Отчёты сохраняются на сервере. Пустой период — все записи по выбранному типу (для планов —
          по учебному году).
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-950/55 shadow-inner overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/90">
              <tr>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                  Тип
                </th>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                  Параметры
                </th>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                  Файл
                </th>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                  Сформирован
                </th>
                <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                  Кто
                </th>
                <th className="px-3 py-3 text-right uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                  Скачать
                </th>
              </tr>
            </thead>
            <tbody>
              {(list || []).map((r) => (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                  <td className="px-3 py-2.5 text-slate-200">{formatTableCell("reportType", r.reportType)}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs max-w-[200px]">
                    {formatReportParams(r.params, r.reportType)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-200 break-all">{r.originalName}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {formatCreatedAt(r.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-200">
                    {r.generatedBy?.fullName || r.generatedBy?.login || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105"
                      onClick={() => downloadReport(r.id, r.originalName)}
                    >
                      Скачать
                    </button>
                  </td>
                </tr>
              ))}
              {(list || []).length === 0 && !loading ? (
                <tr className="border-t border-slate-800">
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Пока нет отчётов. Выберите тип, задайте период и нажмите «Сгенерировать».
                  </td>
                </tr>
              ) : null}
              {loading && (list || []).length === 0 ? (
                <tr className="border-t border-slate-800">
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Загрузка…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
