import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

export default function SupervisorPage() {
  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState("2026-2027");
  const [selectedPostgraduateId, setSelectedPostgraduateId] = useState("");
  const [grades, setGrades] = useState([]);
  const [gradeFilters, setGradeFilters] = useState({ subjectId: "", dateFrom: "", dateTo: "", q: "" });
  const [bundle, setBundle] = useState(null);

  const load = async () => {
    try {
      const data = (await api.get("/supervisor/supervisions")).data;
      setRows(data);
      const firstId = data?.[0]?.postgraduate?.id;
      if (firstId && !selectedPostgraduateId) setSelectedPostgraduateId(String(firstId));
      toast.success("Данные обновлены");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postgraduates = useMemo(
    () =>
      (rows || [])
        .map((r) => r?.postgraduate)
        .filter(Boolean),
    [rows]
  );

  const loadGrades = async () => {
    try {
      if (!selectedPostgraduateId) {
        setGrades([]);
        return;
      }
      const params = new URLSearchParams();
      if (gradeFilters.subjectId) params.set("subjectId", gradeFilters.subjectId);
      if (gradeFilters.dateFrom) params.set("dateFrom", gradeFilters.dateFrom);
      if (gradeFilters.dateTo) params.set("dateTo", gradeFilters.dateTo);
      if (gradeFilters.q.trim()) params.set("q", gradeFilters.q.trim());

      const url = params.toString()
        ? `/supervisor/grades/${selectedPostgraduateId}?${params.toString()}`
        : `/supervisor/grades/${selectedPostgraduateId}`;
      setGrades((await api.get(url)).data);
      toast.success("Оценки обновлены");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!selectedPostgraduateId) return;
    loadGrades();
    (async () => {
      try {
        setBundle((await api.get(`/supervisor/postgraduate/${selectedPostgraduateId}`)).data);
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostgraduateId]);

  const updatePlanItem = async (itemId, payload) => {
    try {
      await api.patch(`/supervisor/plan-items/${itemId}`, payload);
      toast.success("Этап обновлён");
      setBundle((await api.get(`/supervisor/postgraduate/${selectedPostgraduateId}`)).data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const riskRows = rows.map((r, idx) => ({
    id: r?.supervision?.id || idx + 1,
    postgraduate: r?.postgraduate?.fullName || "—",
    groupName: r?.postgraduate?.groupName || "—",
    topic: r?.latestTopic?.title || "—",
    risk: r?.latestTopic?.status === "approved" ? "В норме" : "Риск",
  }));

  const bulkApprove = async () => {
    try {
      const { data } = await api.post("/supervisor/plans/bulk-approve", { academicYear: selectedYear });
      toast.success(`Подтверждено планов: ${data.updated || 0}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Кабинет научного руководителя">
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 gap-4 grid md:grid-cols-2 lg:grid-cols-3 items-center">
          <select 
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="2025-2026">2025-2026 год</option>
            <option value="2026-2027">2026-2027 год</option>
            <option value="2027-2028">2027-2028 год</option>
          </select>
          <button 
            className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center" 
            onClick={bulkApprove}
          >
            Подтвердить отчеты группы
          </button>
          <button 
            className="w-full rounded-xl px-5 py-2.5 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors" 
            onClick={load}
          >
            Обновить данные
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Список ведомых и мониторинг рисков">
        <SimpleTable rows={riskRows} />
      </SectionCard>

      <SectionCard
        title="Успеваемость аспирантов"
        right={
          <button
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={loadGrades}
          >
            Обновить оценки
          </button>
        }
      >
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 grid lg:grid-cols-5 gap-3 items-end mb-5">
          <div className="lg:col-span-2">
            <div className="text-xs text-slate-400 mb-1">Аспирант</div>
            <select
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              value={selectedPostgraduateId}
              onChange={(e) => setSelectedPostgraduateId(e.target.value)}
            >
              {postgraduates.length === 0 ? <option value="">Нет аспирантов</option> : null}
              {postgraduates.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.fullName} {p.groupName ? `(${p.groupName})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Период (с)</div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              value={gradeFilters.dateFrom}
              onChange={(e) => setGradeFilters((s) => ({ ...s, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Период (по)</div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              value={gradeFilters.dateTo}
              onChange={(e) => setGradeFilters((s) => ({ ...s, dateTo: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Поиск</div>
            <input
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              placeholder="контроль/оценка/коммент"
              value={gradeFilters.q}
              onChange={(e) => setGradeFilters((s) => ({ ...s, q: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && loadGrades()}
            />
          </div>
          <button
            className="lg:col-span-5 rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center"
            onClick={loadGrades}
          >
            Применить фильтры
          </button>
        </div>

        <SimpleTable rows={grades || []} />
      </SectionCard>

      <SectionCard title="Индивидуальные маршруты (этапы исследования)">
        <div className="text-slate-400 text-xs mb-3">
          Статусы: planned → in_progress → done. Статус overdue выставляется автоматически, если дедлайн прошёл и этап не завершён.
        </div>
        <div className="space-y-3">
          {((bundle?.individualPlans?.[0]?.items) || []).map((it) => (
            <div key={it.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[240px]">
                  <div className="text-slate-100 font-semibold">{it.title}</div>
                  {it.description ? <div className="text-slate-400 text-xs mt-1">{it.description}</div> : null}
                  <div className="text-slate-500 text-xs mt-1">
                    Дедлайн: {it.dueDate || "—"} • Завершено: {it.completedAt || "—"}
                  </div>
                  {Array.isArray(it.files) && it.files.length ? (
                    <a
                      className="text-sky-200 underline text-xs mt-2 inline-block"
                      href={`/api/postgraduate/plan-items/${it.id}/files/${it.files[0].id}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Отчёт: {it.files[0].originalName}
                    </a>
                  ) : (
                    <div className="text-slate-500 text-xs mt-2">Отчёт: —</div>
                  )}
                </div>

                <div className="min-w-[260px] space-y-2">
                  <select
                    className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm"
                    value={it.status || "planned"}
                    onChange={(e) => updatePlanItem(it.id, { status: e.target.value })}
                  >
                    <option value="planned">planned</option>
                    <option value="in_progress">in_progress</option>
                    <option value="done">done</option>
                  </select>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500"
                    placeholder="Комментарий руководителя"
                    defaultValue={it.supervisorNotes || ""}
                    onBlur={(e) => updatePlanItem(it.id, { supervisorNotes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          {((bundle?.individualPlans?.[0]?.items) || []).length === 0 ? (
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
              Нет этапов в текущем плане.
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
