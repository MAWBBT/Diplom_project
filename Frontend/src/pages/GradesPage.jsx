import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";
import { useAuthStore } from "../store/authStore";
import { ROLES, roleMatches } from "../utils/roles";
import { COLUMN_LABELS, formatTableCell } from "../utils/tableLabels";

const fld =
  "w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner";

function formatScheduleWhen(s) {
  if (s.date) return new Date(s.date).toLocaleDateString("ru-RU");
  if (s.dayOfWeek != null) return `День ${s.dayOfWeek}`;
  return "—";
}

function formatScheduleLabel(s) {
  const subj = s.subjectRef?.name || s.subject || "—";
  return `${subj} · ${formatScheduleWhen(s)}${s.time ? ` · ${s.time}` : ""}`;
}

function scheduleMatchesPostgraduate(scheduleRow, pg) {
  if (!scheduleRow || !pg) return false;
  const group = (pg.groupName || "").trim();
  if (group) return (scheduleRow.user?.groupName || "").trim() === group;
  return String(scheduleRow.userId) === String(pg.id);
}

/** Один слот расписания на группу (в БД — по записи на каждого аспиранта). */
function scheduleSlotKey(s) {
  const group = (s.user?.groupName || "").trim();
  const dateKey = s.date ? String(s.date).slice(0, 10) : "";
  return [s.subjectId, dateKey, s.dayOfWeek ?? "", s.time ?? "", (s.teacher || "").trim(), (s.auditorium || "").trim(), group].join("|");
}

function dedupeScheduleSlots(rows, preferredUserId) {
  const byKey = new Map();
  for (const row of rows) {
    const key = scheduleSlotKey(row);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
    } else if (preferredUserId && String(row.userId) === String(preferredUserId)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

function gradeForSlot(grades, postgraduateId, schedule) {
  if (!postgraduateId || !schedule) return null;
  const tag = String(schedule.dayOfWeek ?? schedule.date ?? "");
  return grades.find(
    (g) =>
      String(g.userId) === String(postgraduateId) &&
      g.subjectId === schedule.subjectId &&
      (g.controlType || "").includes(tag)
  );
}

function normalizeGradeRows(list, user) {
  return (Array.isArray(list) ? list : []).map((r) => ({
    id: r.id,
    postgraduate: r?.user?.fullName || r?.user?.login || user?.fullName || r?.userId,
    subject: r?.subjectRef?.name || r?.subject?.name || r?.subjectId,
    controlType: r.controlType,
    grade: r.grade,
    comment: r.comment || "",
  }));
}

const STAFF_TABS = [
  { id: "journal", label: "По занятиям" },
  { id: "list", label: "Все оценки" },
  { id: "manual", label: "Вручную", adminOnly: true },
];

const GRADE_TABLE_KEYS = ["postgraduate", "subject", "controlType", "grade", "comment"];

export default function GradesPage() {
  const { user } = useAuthStore();
  const location = useLocation();
  const isStaff = roleMatches(user?.role, [ROLES.SUPERVISOR, ROLES.ADMIN]);
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState(() => location.state?.tab || "journal");
  const [loading, setLoading] = useState(true);
  const [postgraduates, setPostgraduates] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [gradeRows, setGradeRows] = useState([]);
  const [filterPg, setFilterPg] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [search, setSearch] = useState("");

  const [entry, setEntry] = useState({ postgraduateId: "", scheduleId: "", grade: "", comment: "" });
  const [manual, setManual] = useState({ userId: "", subjectId: "", controlType: "", grade: "", comment: "" });

  useEffect(() => {
    if (!user?.role) return;
    if (location.state?.tab) {
      setTab(location.state.tab);
      return;
    }
    if (roleMatches(user.role, [ROLES.STUDENT])) setTab("list");
  }, [user?.id, user?.role, location.state?.tab]);

  const loadStaff = useCallback(async (quiet) => {
    const applyWorkspace = (data) => {
      setPostgraduates(data.postgraduates || []);
      setSchedule(data.schedule || []);
      setSubjects(data.subjects || []);
      setGradeRows(data.grades || []);
    };

    try {
      try {
        const { data } = await api.get("/journal/workspace");
        applyWorkspace(data);
      } catch (err) {
        if (err.response?.status !== 404) throw err;
        const gradesPath = user?.role === "admin" ? "/admin/grades" : "/grades";
        const [pg, sch, subj, gradesRes] = await Promise.all([
          api.get("/journal/postgraduates"),
          api.get("/journal/schedule"),
          api.get("/journal/subjects"),
          api.get(gradesPath),
        ]);
        applyWorkspace({
          postgraduates: pg.data,
          schedule: sch.data,
          subjects: subj.data,
          grades: Array.isArray(gradesRes.data) ? gradesRes.data : [],
        });
      }
      if (!quiet) toast.success("Данные обновлены", { id: "grades-refresh" });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: "grades-refresh" });
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  const loadPostgraduate = useCallback(async (quiet) => {
    try {
      const { data } = await api.get("/grades");
      setGradeRows(Array.isArray(data) ? data : []);
      if (!quiet) toast.success("Оценки обновлены", { id: "grades-refresh" });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: "grades-refresh" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (isStaff) loadStaff(true);
    else loadPostgraduate(true);
  }, [isStaff, user?.id, loadStaff, loadPostgraduate]);

  const refresh = () => {
    setLoading(true);
    if (isStaff) loadStaff(false);
    else loadPostgraduate(false);
  };

  const selectedPostgraduate = useMemo(
    () => postgraduates.find((p) => String(p.id) === String(entry.postgraduateId)),
    [postgraduates, entry.postgraduateId]
  );

  const groupSchedule = useMemo(() => {
    if (!selectedPostgraduate) return [];
    const forGroup = schedule.filter((s) => scheduleMatchesPostgraduate(s, selectedPostgraduate));
    return dedupeScheduleSlots(forGroup, selectedPostgraduate.id);
  }, [schedule, selectedPostgraduate]);

  const selectedSchedule = useMemo(
    () => groupSchedule.find((s) => String(s.id) === String(entry.scheduleId)),
    [groupSchedule, entry.scheduleId]
  );

  const existingSlotGrade = useMemo(
    () => gradeForSlot(gradeRows, entry.postgraduateId, selectedSchedule),
    [gradeRows, entry.postgraduateId, selectedSchedule]
  );

  const tableRows = useMemo(() => normalizeGradeRows(gradeRows, user), [gradeRows, user]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (filterPg) {
        const pg = postgraduates.find((p) => String(p.id) === filterPg);
        if (!pg || row.postgraduate !== pg.fullName) return false;
      }
      if (filterSubject) {
        const sub = subjects.find((s) => String(s.id) === filterSubject);
        if (sub && row.subject !== sub.name) return false;
      }
      if (!q) return true;
      return [row.postgraduate, row.subject, row.controlType, row.grade, row.comment]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [tableRows, filterPg, filterSubject, search, postgraduates, subjects]);

  const saveByLesson = async () => {
    if (!entry.postgraduateId || !entry.scheduleId || !entry.grade) {
      toast.error("Укажите аспиранта, занятие и оценку");
      return;
    }
    try {
      await api.post("/journal/grade", {
        postgraduateId: Number(entry.postgraduateId),
        scheduleId: Number(entry.scheduleId),
        grade: entry.grade,
        comment: entry.comment,
      });
      toast.success("Оценка сохранена");
      setEntry((prev) => ({ ...prev, grade: "", comment: "" }));
      await loadStaff(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const saveManual = async () => {
    try {
      await api.post("/grades", {
        ...manual,
        userId: Number(manual.userId) || null,
        subjectId: Number(manual.subjectId) || null,
      });
      toast.success("Оценка выставлена");
      setManual({ userId: "", subjectId: "", controlType: "", grade: "", comment: "" });
      await loadStaff(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const removeGrade = async (id) => {
    if (!window.confirm("Удалить эту оценку?")) return;
    try {
      await api.delete(`/journal/grade/${id}`);
      toast.success("Оценка удалена");
      if (isStaff) await loadStaff(true);
      else await loadPostgraduate(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const onPostgraduateChange = (postgraduateId) => {
    setEntry((prev) => {
      const pg = postgraduates.find((p) => String(p.id) === postgraduateId);
      const next = { ...prev, postgraduateId };
      if (
        prev.scheduleId &&
        pg &&
        !schedule.some((s) => String(s.id) === String(prev.scheduleId) && scheduleMatchesPostgraduate(s, pg))
      ) {
        next.scheduleId = "";
      }
      return next;
    });
  };

  const pickLesson = (scheduleId) => {
    if (!entry.postgraduateId) {
      toast.error("Сначала выберите аспиранта");
      return;
    }
    setEntry((prev) => ({ ...prev, scheduleId: String(scheduleId) }));
    setTab("journal");
    requestAnimationFrame(() => {
      document.getElementById("grade-entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const visibleTabs = STAFF_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <SectionCard
      title="Успеваемость"
      right={
        <button
          type="button"
          className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
          onClick={refresh}
          disabled={loading}
        >
          Обновить
        </button>
      }
    >
      {isStaff ? (
        <>
          <p className="text-sm text-slate-400 mb-4">
            Выставляйте оценки по занятию из расписания или просматривайте полный список. Журнал и реестр оценок
            объединены в одном разделе.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-4 py-2 font-medium text-sm border transition-colors ${
                  tab === t.id
                    ? "border-sky-400 bg-sky-400 text-slate-950"
                    : "border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "journal" && (
            <div className="space-y-6">
              <div id="grade-entry-form" className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-sky-200 mb-2">Оценка по занятию</h3>
                <p className="text-xs text-slate-400 mb-4">
                  {selectedPostgraduate
                    ? `Занятия группы «${selectedPostgraduate.groupName || "без группы"}» с вашим преподавателем.`
                    : "Сначала выберите аспиранта — отобразятся только занятия его группы."}
                </p>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <select
                    className={fld}
                    value={entry.postgraduateId}
                    onChange={(e) => onPostgraduateChange(e.target.value)}
                    aria-label="Аспирант"
                  >
                    <option value="">Аспирант</option>
                    {postgraduates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                        {p.groupName ? ` (${p.groupName})` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    className={fld}
                    value={entry.scheduleId}
                    disabled={!selectedPostgraduate}
                    onChange={(e) => setEntry({ ...entry, scheduleId: e.target.value })}
                    aria-label="Занятие"
                  >
                    <option value="">
                      {selectedPostgraduate ? "Занятие" : "Сначала выберите аспиранта"}
                    </option>
                    {groupSchedule.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatScheduleLabel(s)}
                      </option>
                    ))}
                  </select>
                  <input
                    className={fld}
                    placeholder="Оценка / баллы / зачёт"
                    value={entry.grade}
                    onChange={(e) => setEntry({ ...entry, grade: e.target.value })}
                    aria-label="Оценка"
                  />
                  <input
                    className={fld}
                    placeholder="Комментарий"
                    value={entry.comment}
                    onChange={(e) => setEntry({ ...entry, comment: e.target.value })}
                    aria-label="Комментарий"
                  />
                </div>
                {existingSlotGrade ? (
                  <p className="text-xs text-amber-200/90 mb-3">
                    Уже есть оценка: <strong>{existingSlotGrade.grade}</strong>
                    {existingSlotGrade.comment ? ` — ${existingSlotGrade.comment}` : ""}. Сохранение обновит её.
                  </p>
                ) : null}
                <button
                  type="button"
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:brightness-105 transition-all"
                  onClick={saveByLesson}
                >
                  Сохранить
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-sky-200 mb-3">
                  {selectedPostgraduate
                    ? `Занятия — ${selectedPostgraduate.groupName || "группа не указана"}`
                    : "Занятия (выберите аспиранта)"}
                </h3>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/55 shadow-inner overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900/90">
                      <tr>
                        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                          Дисциплина
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                          Дата / день
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                          Время
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                          Преподаватель
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                          Группа
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                          Аудитория
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                          Действие
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupSchedule.map((s) => {
                        const slot =
                          entry.postgraduateId && gradeForSlot(gradeRows, entry.postgraduateId, s);
                        return (
                          <tr key={s.id} className="border-t border-slate-800 hover:bg-sky-950/25 transition-colors">
                            <td className="px-3 py-2.5 text-slate-200">{s.subjectRef?.name || s.subject || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{formatScheduleWhen(s)}</td>
                            <td className="px-3 py-2.5 text-slate-300">{s.time || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{s.teacher || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{s.user?.groupName || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{s.auditorium || "—"}</td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                className="text-sky-300 hover:text-sky-200 text-xs font-medium"
                                onClick={() => pickLesson(s.id)}
                              >
                                Оценить
                              </button>
                              {slot ? (
                                <span className="ml-2 text-xs text-slate-400" title={slot.comment || ""}>
                                  {slot.grade}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                      {groupSchedule.length === 0 ? (
                        <tr className="border-t border-slate-800">
                          <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                            {selectedPostgraduate
                              ? "Нет занятий для этой группы с вашим преподавателем."
                              : "Выберите аспиранта, чтобы увидеть занятия его группы."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "list" && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select className={fld} value={filterPg} onChange={(e) => setFilterPg(e.target.value)}>
                  <option value="">Все аспиранты</option>
                  {postgraduates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
                <select className={fld} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
                  <option value="">Все дисциплины</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  className={`${fld} sm:col-span-2`}
                  placeholder="Поиск по таблице"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filteredRows.length === 0 ? (
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
                  Нет оценок по выбранным фильтрам.
                </div>
              ) : (
                <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900/90">
                      <tr>
                        {GRADE_TABLE_KEYS.map((k) => (
                          <th
                            key={k}
                            className="px-3 py-3 text-left text-[11px] font-medium text-slate-400"
                          >
                            {COLUMN_LABELS[k]}
                          </th>
                        ))}
                        <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                          <td className="px-3 py-2.5 text-slate-200">{row.postgraduate}</td>
                          <td className="px-3 py-2.5 text-slate-200">{row.subject}</td>
                          <td className="px-3 py-2.5 text-slate-300">{formatTableCell("controlType", row.controlType)}</td>
                          <td className="px-3 py-2.5 text-slate-200 font-medium">{formatTableCell("grade", row.grade)}</td>
                          <td className="px-3 py-2.5 text-slate-400">{row.comment || "—"}</td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              className="text-rose-300 hover:text-rose-200 text-xs"
                              onClick={() => removeGrade(row.id)}
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "manual" && isAdmin && (
            <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-sky-200 mb-2">Оценка без привязки к занятию</h3>
              <p className="text-xs text-slate-400 mb-4">
                Для привязки к расписанию используйте вкладку «По занятиям».
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <select
                  className={fld}
                  value={manual.userId}
                  onChange={(e) => setManual({ ...manual, userId: e.target.value })}
                >
                  <option value="">Аспирант</option>
                  {postgraduates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
                <select
                  className={fld}
                  value={manual.subjectId}
                  onChange={(e) => setManual({ ...manual, subjectId: e.target.value })}
                >
                  <option value="">Дисциплина</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  className={fld}
                  placeholder="Тип контроля"
                  value={manual.controlType}
                  onChange={(e) => setManual({ ...manual, controlType: e.target.value })}
                />
                <input
                  className={fld}
                  placeholder="Оценка"
                  value={manual.grade}
                  onChange={(e) => setManual({ ...manual, grade: e.target.value })}
                />
                <input
                  className={fld}
                  placeholder="Комментарий"
                  value={manual.comment}
                  onChange={(e) => setManual({ ...manual, comment: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-sky-400 text-slate-950 hover:brightness-105 transition-all"
                onClick={saveManual}
              >
                Сохранить
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-slate-400 mb-4">Ваши оценки по дисциплинам.</p>
          <SimpleTable rows={tableRows} />
        </>
      )}
    </SectionCard>
  );
}
