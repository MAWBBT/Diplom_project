import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";
import { useAuthStore } from "../store/authStore";
import WeekSchedule from "../components/WeekSchedule";

const fieldLabels = {
  dayOfWeek: "День недели (1-7)",
  time: "Время",
  subjectId: "Дисциплина",
  teacher: "Преподаватель",
  auditorium: "Аудитория",
  date: "Дата"
};

export default function SchedulePage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [view, setView] = useState("week"); // week | table
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [filters, setFilters] = useState({
    groupName: "",
    teacher: "",
    subjectId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [form, setForm] = useState({
    dayOfWeek: "",
    time: "",
    subjectId: "",
    teacher: "",
    auditorium: "",
    date: "",
  });
  const [editing, setEditing] = useState(null); // schedule row being edited

  const canCreate = ["admin", "professor"].includes(user?.role);

  const loadSubjects = async () => {
    try {
      // For schedule filters and forms we want a subject directory for any authenticated user.
      // If journal subjects is forbidden for some roles, fallback to empty list.
      const { data } = await api.get("/journal/subjects");
      setSubjects(Array.isArray(data) ? data : []);
    } catch (e) {
      setSubjects([]);
    }
  };
  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.teacher.trim()) params.set("teacher", filters.teacher.trim());
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.groupName.trim() && user?.role !== "postgraduate") params.set("groupName", filters.groupName.trim());

      const url = params.toString() ? `/schedule?${params.toString()}` : "/schedule";
      setRows((await api.get(url)).data);
      toast.success("Расписание обновлено", { id: "refresh" });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: "refresh" });
    }
  };

  useEffect(() => {
    load();
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    try {
      await api.post("/schedule", {
        ...form,
        subjectId: Number(form.subjectId) || null,
      });
      setForm({ dayOfWeek: "", time: "", subjectId: "", teacher: "", auditorium: "", date: "" });
      toast.success("Добавлено в расписание");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const weekStartInputValue = useMemo(() => {
    const yyyy = weekStart.getFullYear();
    const mm = String(weekStart.getMonth() + 1).padStart(2, "0");
    const dd = String(weekStart.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [weekStart]);

  const startEdit = (row) => {
    setEditing({
      id: row.id,
      dayOfWeek: row.dayOfWeek ?? "",
      time: row.time ?? "",
      subjectId: String(row.subjectId ?? ""),
      teacher: row.teacher ?? "",
      auditorium: row.auditorium ?? "",
      date: row.date ?? "",
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    try {
      if (!editing?.id) return;
      await api.put(`/schedule/${editing.id}`, {
        ...editing,
        subjectId: Number(editing.subjectId) || null,
      });
      toast.success("Занятие обновлено");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const removeRow = async (id) => {
    try {
      if (!window.confirm("Удалить занятие из расписания?")) return;
      await api.delete(`/schedule/${id}`);
      toast.success("Удалено");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <SectionCard 
      title="Расписание занятий" 
      right={
        <div className="flex gap-2 flex-wrap items-center justify-end">
          <button
            className={`rounded-xl px-4 py-2 font-medium text-sm border transition-colors ${
              view === "week"
                ? "border-sky-400 bg-sky-400 text-slate-950"
                : "border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200"
            }`}
            onClick={() => setView("week")}
          >
            Неделя
          </button>
          <button
            className={`rounded-xl px-4 py-2 font-medium text-sm border transition-colors ${
              view === "table"
                ? "border-sky-400 bg-sky-400 text-slate-950"
                : "border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200"
            }`}
            onClick={() => setView("table")}
          >
            Таблица
          </button>
          <button 
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors" 
            onClick={load}
          >
            Обновить
          </button>
        </div>
      }
    >
      <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 mb-6 space-y-4">
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <input
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            placeholder="Преподаватель"
            value={filters.teacher}
            onChange={(e) => setFilters((s) => ({ ...s, teacher: e.target.value }))}
          />
          <select
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            value={filters.subjectId}
            onChange={(e) => setFilters((s) => ({ ...s, subjectId: e.target.value }))}
          >
            <option value="">Дисциплина (все)</option>
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            value={filters.dateFrom}
            onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))}
          />
          <input
            type="date"
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            value={filters.dateTo}
            onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))}
          />
          <button
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all"
            onClick={load}
          >
            Применить
          </button>
        </div>

        {user?.role !== "postgraduate" ? (
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <input
              className="md:col-span-2 w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              placeholder="Группа (фильтр)"
              value={filters.groupName}
              onChange={(e) => setFilters((s) => ({ ...s, groupName: e.target.value }))}
            />
            <div className="md:col-span-2 text-xs text-slate-400">
              Фильтры применяются к API `/api/schedule` (group/teacher/subject/period).
            </div>
          </div>
        ) : null}
      </div>

      {canCreate && (
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-sky-200 mb-4">Добавить занятие</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <input
                aria-label={fieldLabels.dayOfWeek}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.dayOfWeek}
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
              />
            </div>
            <div>
              <input
                aria-label={fieldLabels.time}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.time}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="schedule-subject">{fieldLabels.subjectId}</label>
              <select
                id="schedule-subject"
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              >
                <option value="">{fieldLabels.subjectId}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                aria-label={fieldLabels.teacher}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.teacher}
                value={form.teacher}
                onChange={(e) => setForm({ ...form, teacher: e.target.value })}
              />
            </div>
            <div>
              <input
                aria-label={fieldLabels.auditorium}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.auditorium}
                value={form.auditorium}
                onChange={(e) => setForm({ ...form, auditorium: e.target.value })}
              />
            </div>
            <div>
              <input
                aria-label={fieldLabels.date}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.date}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>
          <button 
             className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all" 
             onClick={add}
          >
            Сохранить занятие
          </button>
        </div>
      )}

      {view === "week" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs text-slate-400 mb-1">Неделя (начало)</div>
              <input
                type="date"
                className="rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                value={weekStartInputValue}
                onChange={(e) => setWeekStart(new Date(e.target.value))}
              />
            </div>
            <button
              className="rounded-xl px-4 py-2 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() - 7);
                setWeekStart(d);
              }}
            >
              ← Пред. неделя
            </button>
            <button
              className="rounded-xl px-4 py-2 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + 7);
                setWeekStart(d);
              }}
            >
              След. неделя →
            </button>
          </div>
          <WeekSchedule rows={rows} weekStart={weekStart} />
        </div>
      ) : (
        <div className="space-y-4">
          {canCreate ? (
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4">
              <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold mb-3">Управление занятиями</div>
              <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/90">
                    <tr>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">id</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">дата</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">день</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">время</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">дисциплина</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">преподаватель</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">ауд.</th>
                      <th className="px-3 py-3 text-right uppercase tracking-wide text-[11px] text-slate-400 font-medium">действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                        <td className="px-3 py-2.5 text-slate-200">{r.id}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.date || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.dayOfWeek}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.time}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.subjectRef?.name || r.subjectId}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.teacher || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.auditorium || "—"}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <button
                              className="rounded-lg px-3 py-1.5 text-xs font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                              onClick={() => startEdit(r)}
                            >
                              Править
                            </button>
                            <button
                              className="rounded-lg px-3 py-1.5 text-xs font-medium border border-rose-400/60 bg-rose-950/30 hover:bg-rose-950/45 text-rose-100"
                              onClick={() => removeRow(r.id)}
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr className="border-t border-slate-800">
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                          Нет данных.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {editing ? (
                <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
                  <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Редактирование занятия #{editing.id}</div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <input
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                      value={editing.dayOfWeek}
                      onChange={(e) => setEditing((s) => ({ ...s, dayOfWeek: e.target.value }))}
                      placeholder={fieldLabels.dayOfWeek}
                    />
                    <input
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                      value={editing.time}
                      onChange={(e) => setEditing((s) => ({ ...s, time: e.target.value }))}
                      placeholder={fieldLabels.time}
                    />
                    <select
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                      value={editing.subjectId}
                      onChange={(e) => setEditing((s) => ({ ...s, subjectId: e.target.value }))}
                    >
                      <option value="">{fieldLabels.subjectId}</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                      value={editing.teacher}
                      onChange={(e) => setEditing((s) => ({ ...s, teacher: e.target.value }))}
                      placeholder={fieldLabels.teacher}
                    />
                    <input
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                      value={editing.auditorium}
                      onChange={(e) => setEditing((s) => ({ ...s, auditorium: e.target.value }))}
                      placeholder={fieldLabels.auditorium}
                    />
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                      value={editing.date || ""}
                      onChange={(e) => setEditing((s) => ({ ...s, date: e.target.value }))}
                      placeholder={fieldLabels.date}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl px-4 py-2 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                      onClick={cancelEdit}
                    >
                      Отмена
                    </button>
                    <button
                      className="rounded-xl px-4 py-2 text-sm font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105"
                      onClick={saveEdit}
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <SimpleTable rows={rows} />
        </div>
      )}
    </SectionCard>
  );
}
