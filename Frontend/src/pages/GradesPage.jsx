import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";
import { useAuthStore } from "../store/authStore";

const fieldLabels = {
  userId: "ID Студента",
  subjectId: "Дисциплина",
  controlType: "Тип контроля (экзамен/зачет)",
  grade: "Оценка / Статус",
  comment: "Комментарий"
};

export default function GradesPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ userId: "", subjectId: "", controlType: "", grade: "", comment: "" });
  const canCreate = ["admin", "professor"].includes(user?.role);

  const loadSubjects = async () => {
    if (!canCreate) return;
    try {
      setSubjects((await api.get("/journal/subjects")).data);
    } catch (e) {
      toast.error(getErrorMessage(e), { id: "subjects-load" });
    }
  };

  const load = async () => {
    try {
      const path = user?.role === "admin" ? "/admin/grades" : "/grades";
      setRows((await api.get(path)).data);
      toast.success("Оценки обновлены", { id: "grades-refresh" });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: "grades-refresh" });
    }
  };

  useEffect(() => {
    load();
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    try {
      await api.post("/grades", {
        ...form,
        userId: Number(form.userId) || null,
        subjectId: Number(form.subjectId) || null
      });
      setForm({ userId: "", subjectId: "", controlType: "", grade: "", comment: "" });
      toast.success("Оценка выставлена");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <SectionCard 
      title="Академическая успеваемость" 
      right={
        <button 
          className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors" 
          onClick={load}
        >
          Обновить
        </button>
      }
    >
      {canCreate && (
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-sky-200 mb-4">Выставить оценку</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <input
                aria-label={fieldLabels.userId}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.userId}
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="grades-subject">{fieldLabels.subjectId}</label>
              <select
                id="grades-subject"
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
                aria-label={fieldLabels.controlType}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.controlType}
                value={form.controlType}
                onChange={(e) => setForm({ ...form, controlType: e.target.value })}
              />
            </div>
            <div>
              <input
                aria-label={fieldLabels.grade}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.grade}
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
              />
            </div>
            <div>
              <input
                aria-label={fieldLabels.comment}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder={fieldLabels.comment}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>
          </div>
          <button 
            className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all" 
            onClick={add}
          >
            Сохранить оценку
          </button>
        </div>
      )}
      <SimpleTable rows={rows} />
    </SectionCard>
  );
}
