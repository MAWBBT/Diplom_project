import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";
import { useAuthStore } from "../store/authStore";

export default function JournalPage() {
  const { user } = useAuthStore();
  const [postgraduates, setPostgraduates] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [grade, setGrade] = useState({ postgraduateId: "", scheduleId: "", grade: "", comment: "" });
  const canWrite = user?.role === "professor";

  const load = async () => {
    try {
      const [pg, sch] = await Promise.all([api.get("/journal/postgraduates"), api.get("/journal/schedule")]);
      setPostgraduates(pg.data);
      setSchedule(sch.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveGrade = async () => {
    if (!grade.postgraduateId || !grade.scheduleId || !grade.grade) {
      toast.error("Заполните аспиранта, занятие и оценку");
      return;
    }
    
    try {
      await api.post("/journal/grade", {
        ...grade,
        postgraduateId: Number(grade.postgraduateId),
        scheduleId: Number(grade.scheduleId),
      });
      toast.success("Оценка успешно сохранена");
      setGrade({ ...grade, grade: "", comment: "" });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Электронный журнал посещаемости и успеваемости">
      {canWrite && (
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-sky-200 mb-4">Выставить оценку в журнал</h3>
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <label className="sr-only" htmlFor="journal-postgraduate">Аспирант</label>
            <select 
              id="journal-postgraduate"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
              value={grade.postgraduateId} 
              onChange={(e) => setGrade({ ...grade, postgraduateId: e.target.value })}
            >
              <option value="">Выберите аспиранта</option>
              {postgraduates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="journal-schedule">Занятие</label>
            <select 
              id="journal-schedule"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
              value={grade.scheduleId} 
              onChange={(e) => setGrade({ ...grade, scheduleId: e.target.value })}
            >
              <option value="">Выберите занятие</option>
              {schedule.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.subjectRef?.name || s.subject)} ({s.date || s.dayOfWeek})
                </option>
              ))}
            </select>
            <input 
              aria-label="Оценка"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
              placeholder="Оценка (кол-во баллов / статус)" 
              value={grade.grade} 
              onChange={(e) => setGrade({ ...grade, grade: e.target.value })} 
            />
            <input 
              aria-label="Комментарий"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
              placeholder="Комментарий (опционально)" 
              value={grade.comment} 
              onChange={(e) => setGrade({ ...grade, comment: e.target.value })} 
            />
          </div>
          <button 
             className="w-full md:w-auto rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all" 
             onClick={saveGrade}
          >
            Сохранить в журнал
          </button>
        </div>
      )}
      <SimpleTable rows={schedule} />
    </SectionCard>
  );
}
