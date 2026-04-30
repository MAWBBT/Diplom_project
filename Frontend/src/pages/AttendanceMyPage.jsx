import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

function normalizeRows(records) {
  return (records || []).map((r, idx) => ({
    id: r.id || idx + 1,
    date: r.session?.heldOn || "—",
    subject: r.session?.subjectRef?.name || "—",
    teacher: r.session?.teacher || "—",
    status: r.status,
    note: r.note || "",
  }));
}

export default function AttendanceMyPage() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "" });

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      const url = params.toString() ? `/attendance/my?${params.toString()}` : "/attendance/my";
      setData((await api.get(url)).data);
      toast.success("Данные посещаемости обновлены");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = data?.stats || { present: 0, absent: 0, late: 0, total: 0 };
  const rows = useMemo(() => normalizeRows(data?.records), [data]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Посещаемость"
        right={
          <button
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={load}
          >
            Обновить
          </button>
        }
      >
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
            <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Всего</p>
            <p className="text-lg font-bold text-sky-100 mt-1">{stats.total}</p>
          </div>
          <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
            <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Присутствия</p>
            <p className="text-lg font-bold text-emerald-200 mt-1">{stats.present}</p>
          </div>
          <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
            <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Опоздания</p>
            <p className="text-lg font-bold text-amber-200 mt-1">{stats.late}</p>
          </div>
          <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
            <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Отсутствия</p>
            <p className="text-lg font-bold text-rose-200 mt-1">{stats.absent}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 mb-6 grid md:grid-cols-3 gap-3 items-end">
          <div>
            <div className="text-xs text-slate-400 mb-1">Период (с)</div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
              value={filters.dateFrom}
              onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Период (по)</div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
              value={filters.dateTo}
              onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))}
            />
          </div>
          <button
            className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 hover:brightness-105 transition-all"
            onClick={load}
          >
            Применить
          </button>
        </div>

        <SimpleTable rows={rows} />
      </SectionCard>
    </div>
  );
}

