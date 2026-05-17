import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";
import { isAdmin, isSupervisor } from "../utils/roles";

function toDateOnly(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function lessonKey(lesson) {
  if (lesson.sessionId) return `session:${lesson.sessionId}`;
  if (lesson.scheduleId) return `schedule:${lesson.scheduleId}`;
  return "";
}

function formatLessonLabel(lesson) {
  const subj = lesson.subjectRef?.name || `subject #${lesson.subjectId}`;
  const date = toDateOnly(lesson.heldOn);
  const time = lesson.time ? ` · ${lesson.time}` : "";
  const aud = lesson.auditorium ? ` · ${lesson.auditorium}` : "";
  return `${date} · ${lesson.groupName} · ${subj}${time}${aud}`;
}

const statusLabels = {
  present: "Присутствовал",
  absent: "Отсутствовал",
  late: "Опоздал",
  sick: "Болеет",
};

const fld =
  "w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner";

export default function AttendancePage() {
  const { user } = useAuthStore();
  const canManage = isSupervisor(user) || isAdmin(user);
  const isProfessor = isSupervisor(user);

  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedLessonKey, setSelectedLessonKey] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [opening, setOpening] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [filters, setFilters] = useState({
    groupName: "",
    teacher: isProfessor ? user?.fullName || "" : "",
    subjectId: "",
    dateFrom: "",
    dateTo: "",
  });

  const [roster, setRoster] = useState(null);
  const [markMap, setMarkMap] = useState({});

  const loadSubjects = async () => {
    try {
      const { data } = await api.get("/journal/subjects");
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
    }
  };

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (filters.groupName.trim()) params.set("groupName", filters.groupName.trim());
    if (filters.teacher.trim()) params.set("teacher", filters.teacher.trim());
    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    return params;
  };

  const loadRoster = useCallback(async (sessionId) => {
    if (!sessionId) {
      setRoster(null);
      setMarkMap({});
      return;
    }
    setRosterLoading(true);
    try {
      const { data } = await api.get(`/attendance/sessions/${sessionId}/roster`);
      setRoster(data);
      const initial = {};
      for (const pg of data?.postgraduates || []) {
        const r = data?.byPostgraduate?.[pg.id];
        initial[pg.id] = {
          postgraduateId: pg.id,
          status: r?.status || "present",
          note: r?.note || "",
        };
      }
      setMarkMap(initial);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setRoster(null);
    } finally {
      setRosterLoading(false);
    }
  }, []);

  const openLesson = useCallback(
    async (key) => {
      if (!key) {
        setSelectedLessonKey("");
        setSelectedSessionId("");
        setRoster(null);
        setMarkMap({});
        return;
      }

      setSelectedLessonKey(key);

      if (key.startsWith("session:")) {
        const sessionId = key.slice("session:".length);
        setSelectedSessionId(sessionId);
        await loadRoster(sessionId);
        return;
      }

      if (!key.startsWith("schedule:")) return;

      const scheduleId = Number(key.slice("schedule:".length));
      setOpening(true);
      setRoster(null);
      try {
        const { data } = await api.post("/attendance/sessions/from-schedule", { scheduleId });
        const sessionId = String(data.id);
        setSelectedSessionId(sessionId);
        setSelectedLessonKey(`session:${sessionId}`);
        await loadRoster(sessionId);
      } catch (e) {
        toast.error(getErrorMessage(e));
        setSelectedSessionId("");
      } finally {
        setOpening(false);
      }
    },
    [loadRoster]
  );

  const loadLessons = async (quiet, openFirst = false) => {
    try {
      if (!filters.groupName.trim()) {
        toast.error("Укажите группу в фильтрах");
        return;
      }

      const params = buildFilterParams();
      const { data } = await api.get(`/attendance/lessons?${params.toString()}`);
      const list = Array.isArray(data) ? data : [];
      setLessons(list);

      if (list.length === 0) {
        setSelectedLessonKey("");
        setSelectedSessionId("");
        setRoster(null);
        if (!quiet) toast.error("Нет занятий по выбранным фильтрам");
        return;
      }

      if (openFirst || !selectedLessonKey) {
        await openLesson(lessonKey(list[0]));
      } else {
        const still = list.find((l) => lessonKey(l) === selectedLessonKey);
        if (still) await openLesson(selectedLessonKey);
        else await openLesson(lessonKey(list[0]));
      }

      if (!quiet) toast.success(`Загружено занятий: ${list.length}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const saveMarks = async () => {
    try {
      if (!selectedSessionId) return;
      const marks = Object.values(markMap || {}).map((m) => ({
        postgraduateId: m.postgraduateId,
        status: m.status,
        note: m.note || "",
      }));
      const { data } = await api.put(`/attendance/sessions/${selectedSessionId}/mark`, { marks });
      toast.success(`Сохранено отметок: ${data.updated || 0}`);
      await loadRoster(selectedSessionId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!canManage) return;
    loadSubjects();
  }, [canManage]);

  const sessionInfo = roster?.session || lessons.find((l) => lessonKey(l) === selectedLessonKey);

  if (!canManage) {
    return (
      <SectionCard title="Посещаемость">
        <div className="text-slate-300">Этот раздел доступен только научному руководителю или администратору.</div>
      </SectionCard>
    );
  }

  const showRoster = selectedSessionId && !opening && !rosterLoading;

  return (
    <SectionCard
      title="Посещаемость — отметка по занятию"
      right={
        <button
          type="button"
          className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
          onClick={() => loadLessons(false, Boolean(selectedLessonKey))}
        >
          Обновить
        </button>
      }
    >
      <p className="text-sm text-slate-400 mb-5">
        Занятия берутся из расписания. Укажите группу, нажмите «Загрузить» — появится список аспирантов для отметки.
      </p>

      <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-3 mb-6">
        <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Фильтры</div>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            className={fld}
            placeholder="Группа (например Аспирантура 2024-1)"
            value={filters.groupName}
            onChange={(e) => setFilters((s) => ({ ...s, groupName: e.target.value }))}
          />
          <input
            className={fld}
            placeholder="Преподаватель"
            value={filters.teacher}
            disabled={isProfessor}
            onChange={(e) => setFilters((s) => ({ ...s, teacher: e.target.value }))}
          />
          <select
            className={fld}
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
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className={fld}
              value={filters.dateFrom}
              onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))}
            />
            <input
              type="date"
              className={fld}
              value={filters.dateTo}
              onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))}
            />
          </div>
        </div>
        <button
          type="button"
          className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105 transition-all"
          onClick={() => loadLessons(false, true)}
        >
          Загрузить из расписания
        </button>

        {lessons.length > 0 ? (
          <>
            <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold pt-2">Занятие</div>
            <select
              className={fld}
              value={selectedLessonKey}
              disabled={opening}
              onChange={(e) => openLesson(e.target.value)}
            >
              {lessons.map((l) => (
                <option key={lessonKey(l)} value={lessonKey(l)}>
                  {formatLessonLabel(l)}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      {(opening || rosterLoading) && (
        <div className="text-slate-400 text-sm py-6 text-center">Загрузка журнала группы…</div>
      )}

      {showRoster ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold mb-1">
                Журнал посещаемости
              </div>
              <div className="text-slate-100 font-semibold">
                {toDateOnly(sessionInfo?.heldOn)} · {sessionInfo?.groupName || filters.groupName} ·{" "}
                {sessionInfo?.subjectRef?.name || "—"}
              </div>
              <div className="text-slate-400 text-xs mt-1">
                {sessionInfo?.teacher || filters.teacher}
                {sessionInfo?.time ? ` · ${sessionInfo.time}` : ""}
                {sessionInfo?.auditorium ? ` · ауд. ${sessionInfo.auditorium}` : ""}
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105"
              onClick={saveMarks}
            >
              Сохранить отметки
            </button>
          </div>

          {roster?.postgraduates?.length ? (
            <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/90">
                  <tr>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Аспирант
                    </th>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Статус
                    </th>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Комментарий
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roster.postgraduates.map((pg) => {
                    const m = markMap?.[pg.id] || { postgraduateId: pg.id, status: "present", note: "" };
                    return (
                      <tr key={pg.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                        <td className="px-3 py-2.5 text-slate-200">
                          <div className="font-medium">{pg.fullName || pg.login}</div>
                          <div className="text-xs text-slate-500">{pg.groupName || "—"}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            className="rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm min-w-[11rem]"
                            value={m.status}
                            onChange={(e) =>
                              setMarkMap((s) => ({
                                ...s,
                                [pg.id]: { ...m, status: e.target.value },
                              }))
                            }
                          >
                            {Object.entries(statusLabels).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500"
                            placeholder="Комментарий"
                            value={m.note}
                            onChange={(e) =>
                              setMarkMap((s) => ({
                                ...s,
                                [pg.id]: { ...m, note: e.target.value },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-400 text-sm">В группе нет активных аспирантов.</div>
          )}
        </div>
      ) : !opening && !rosterLoading && lessons.length === 0 ? (
        <div className="text-slate-400 text-sm">Укажите группу и нажмите «Загрузить из расписания».</div>
      ) : null}
    </SectionCard>
  );
}
