import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";

function toDateOnly(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

const statusLabels = {
  present: "Присутствовал",
  absent: "Отсутствовал",
  late: "Опоздал",
};

export default function AttendancePage() {
  const { user } = useAuthStore();
  const canManage = ["admin", "professor"].includes(user?.role);

  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const [filters, setFilters] = useState({ groupName: "", teacher: "", subjectId: "", dateFrom: "", dateTo: "" });
  const [createForm, setCreateForm] = useState({
    heldOn: new Date().toISOString().slice(0, 10),
    groupName: user?.groupName || "",
    subjectId: "",
    time: "",
    auditorium: "",
    teacher: user?.fullName || "",
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

  const loadSessions = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.groupName.trim()) params.set("groupName", filters.groupName.trim());
      if (filters.teacher.trim()) params.set("teacher", filters.teacher.trim());
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      const url = params.toString() ? `/attendance/sessions?${params.toString()}` : "/attendance/sessions";
      const { data } = await api.get(url);
      setSessions(Array.isArray(data) ? data : []);
      if (!selectedSessionId && Array.isArray(data) && data[0]?.id) {
        setSelectedSessionId(String(data[0].id));
      }
      toast.success("Занятия обновлены");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const loadRoster = async (sessionId) => {
    if (!sessionId) {
      setRoster(null);
      return;
    }
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
    }
  };

  useEffect(() => {
    if (!canManage) return;
    loadSubjects();
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    loadRoster(selectedSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((s) => String(s.id) === String(selectedSessionId)) || null,
    [sessions, selectedSessionId]
  );

  const createSession = async () => {
    try {
      if (!createForm.groupName.trim()) return toast.error("Укажите группу");
      if (!createForm.subjectId) return toast.error("Выберите дисциплину");
      if (!createForm.heldOn) return toast.error("Укажите дату");

      const payload = {
        heldOn: createForm.heldOn,
        groupName: createForm.groupName,
        subjectId: Number(createForm.subjectId),
        time: createForm.time || null,
        auditorium: createForm.auditorium || null,
      };
      if (user?.role === "admin") payload.teacher = createForm.teacher || null;

      const { data } = await api.post("/attendance/sessions", payload);
      toast.success("Занятие создано");
      await loadSessions();
      setSelectedSessionId(String(data.id));
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

  if (!canManage) {
    return (
      <SectionCard title="Посещаемость">
        <div className="text-slate-300">Этот раздел доступен только для admin / professor.</div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Посещаемость — отметка по занятию"
        right={
          <button
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={loadSessions}
          >
            Обновить
          </button>
        }
      >
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-3">
            <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Создать занятие</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="date"
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                value={createForm.heldOn}
                onChange={(e) => setCreateForm((s) => ({ ...s, heldOn: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="Группа"
                value={createForm.groupName}
                onChange={(e) => setCreateForm((s) => ({ ...s, groupName: e.target.value }))}
              />
              <select
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                value={createForm.subjectId}
                onChange={(e) => setCreateForm((s) => ({ ...s, subjectId: e.target.value }))}
              >
                <option value="">Дисциплина</option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="Время (например 10:00)"
                value={createForm.time}
                onChange={(e) => setCreateForm((s) => ({ ...s, time: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="Аудитория"
                value={createForm.auditorium}
                onChange={(e) => setCreateForm((s) => ({ ...s, auditorium: e.target.value }))}
              />
              {user?.role === "admin" ? (
                <input
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  placeholder="Преподаватель"
                  value={createForm.teacher}
                  onChange={(e) => setCreateForm((s) => ({ ...s, teacher: e.target.value }))}
                />
              ) : (
                <div className="text-slate-400 text-xs flex items-center">
                  Преподаватель: <span className="text-slate-200 ml-1">{user?.fullName}</span>
                </div>
              )}
            </div>
            <button
              className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all"
              onClick={createSession}
            >
              Создать
            </button>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-3">
            <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Фильтры занятий</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="Группа"
                value={filters.groupName}
                onChange={(e) => setFilters((s) => ({ ...s, groupName: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="Преподаватель"
                value={filters.teacher}
                onChange={(e) => setFilters((s) => ({ ...s, teacher: e.target.value }))}
              />
              <select
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
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
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))}
                />
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <button
              className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              onClick={loadSessions}
            >
              Применить
            </button>

            <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold pt-3">Выбор занятия</div>
            <select
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              {sessions.length === 0 ? <option value="">Нет занятий</option> : null}
              {sessions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  #{s.id} • {toDateOnly(s.heldOn)} • {s.groupName} • {s.subjectRef?.name || `subjectId=${s.subjectId}`} •{" "}
                  {s.teacher}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSession ? (
          <div className="mt-6 rounded-xl border border-slate-700/60 bg-slate-950/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-slate-100 font-semibold">
                  {toDateOnly(selectedSession.heldOn)} • {selectedSession.groupName} • {selectedSession.subjectRef?.name || "—"}
                </div>
                <div className="text-slate-400 text-xs mt-1">
                  {selectedSession.teacher} {selectedSession.time ? `• ${selectedSession.time}` : ""}{" "}
                  {selectedSession.auditorium ? `• ауд. ${selectedSession.auditorium}` : ""}
                </div>
              </div>
              <button
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
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Аспирант</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Статус</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Комментарий</th>
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
                          <td className="px-3 py-2.5 text-slate-200">
                            <select
                              className="rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm"
                              value={m.status}
                              onChange={(e) =>
                                setMarkMap((s) => ({
                                  ...s,
                                  [pg.id]: { ...m, status: e.target.value },
                                }))
                              }
                            >
                              {Object.keys(statusLabels).map((k) => (
                                <option key={k} value={k}>
                                  {statusLabels[k]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 text-slate-200">
                            <input
                              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500"
                              placeholder="Комментарий (опционально)"
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
              <div className="text-slate-400">Выберите занятие — список группы загрузится здесь.</div>
            )}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

