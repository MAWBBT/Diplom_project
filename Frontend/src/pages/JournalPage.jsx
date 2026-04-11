import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

export default function JournalPage({ user }) {
  const [postgraduates, setPostgraduates] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [grade, setGrade] = useState({ postgraduateId: "", scheduleId: "", grade: "", comment: "" });
  const [msg, setMsg] = useState("");
  const canWrite = user?.role === "professor";

  const load = async () => {
    try {
      const [pg, sch] = await Promise.all([api.get("/journal/postgraduates"), api.get("/journal/schedule")]);
      setPostgraduates(pg.data);
      setSchedule(sch.data);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveGrade = async () => {
    try {
      await api.post("/journal/grade", {
        ...grade,
        postgraduateId: Number(grade.postgraduateId),
        scheduleId: Number(grade.scheduleId),
      });
      setMsg("Оценка сохранена.");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Электронный журнал">
      {canWrite && (
        <div className="grid md:grid-cols-4 gap-2 mb-4">
          <select className="input" value={grade.postgraduateId} onChange={(e) => setGrade({ ...grade, postgraduateId: e.target.value })}>
            <option value="">Аспирант</option>
            {postgraduates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
          <select className="input" value={grade.scheduleId} onChange={(e) => setGrade({ ...grade, scheduleId: e.target.value })}>
            <option value="">Занятие</option>
            {schedule.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject} {s.date || s.dayOfWeek}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Оценка" value={grade.grade} onChange={(e) => setGrade({ ...grade, grade: e.target.value })} />
          <input className="input" placeholder="Комментарий" value={grade.comment} onChange={(e) => setGrade({ ...grade, comment: e.target.value })} />
          <button className="btn md:col-span-4" onClick={saveGrade}>
            Сохранить оценку
          </button>
        </div>
      )}
      <SimpleTable rows={schedule} />
      {msg && <p className="mt-3 text-sm text-slate-300">{msg}</p>}
    </SectionCard>
  );
}
