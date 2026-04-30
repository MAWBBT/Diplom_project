import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";
import { useAuthStore } from "../store/authStore";

function itemsToRows(items) {
  return (items || []).map((it, idx) => ({
    id: it.id || idx + 1,
    semester: it.semester ?? "—",
    subject: it.subjectRef?.name || `subjectId=${it.subjectId}`,
    hours: it.hours,
    controlForm: it.controlForm,
    notes: it.notes || "",
  }));
}

export default function CurriculumPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [programs, setPrograms] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [planList, setPlanList] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [viewerPlan, setViewerPlan] = useState(null); // for non-admin
  const [year, setYear] = useState("");

  const [createPlan, setCreatePlan] = useState({ programId: "", academicYear: "2026-2027", title: "Учебный план" });
  const [createItem, setCreateItem] = useState({ subjectId: "", hours: 72, controlForm: "экзамен", semester: 1, notes: "" });

  const loadViewer = async () => {
    try {
      const qs = year.trim() ? `?academicYear=${encodeURIComponent(year.trim())}` : "";
      setViewerPlan((await api.get(`/curriculum/me${qs}`)).data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const loadAdminRefs = async () => {
    const [p, s] = await Promise.all([api.get("/curriculum/admin/programs"), api.get("/curriculum/admin/subjects")]);
    setPrograms(p.data || []);
    setSubjects(s.data || []);
    if (!createPlan.programId && p.data?.[0]?.id) setCreatePlan((x) => ({ ...x, programId: String(p.data[0].id) }));
    if (!createItem.subjectId && s.data?.[0]?.id) setCreateItem((x) => ({ ...x, subjectId: String(s.data[0].id) }));
  };

  const loadPlans = async () => {
    const params = new URLSearchParams();
    if (createPlan.programId) params.set("programId", createPlan.programId);
    const url = params.toString() ? `/curriculum/admin/plans?${params.toString()}` : "/curriculum/admin/plans";
    setPlanList((await api.get(url)).data || []);
  };

  const loadPlan = async (planId) => {
    if (!planId) {
      setSelectedPlan(null);
      return;
    }
    setSelectedPlan((await api.get(`/curriculum/admin/plans/${planId}`)).data);
  };

  useEffect(() => {
    if (isAdmin) {
      (async () => {
        try {
          await loadAdminRefs();
          await loadPlans();
        } catch (e) {
          toast.error(getErrorMessage(e));
        }
      })();
    } else {
      loadViewer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedPlanId) return;
    loadPlan(selectedPlanId).catch((e) => toast.error(getErrorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId]);

  const viewerRows = useMemo(() => itemsToRows(viewerPlan?.items), [viewerPlan]);
  const adminRows = useMemo(() => itemsToRows(selectedPlan?.items), [selectedPlan]);

  const addPlan = async () => {
    try {
      if (!createPlan.programId || !createPlan.academicYear.trim() || !createPlan.title.trim()) {
        return toast.error("Укажите programId, academicYear, title");
      }
      const { data } = await api.post("/curriculum/admin/plans", {
        programId: Number(createPlan.programId),
        academicYear: createPlan.academicYear,
        title: createPlan.title,
      });
      toast.success("План создан");
      await loadPlans();
      setSelectedPlanId(String(data.id));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const addItem = async () => {
    try {
      if (!selectedPlanId) return toast.error("Выберите план");
      if (!createItem.subjectId || !createItem.controlForm.trim()) return toast.error("Укажите дисциплину и форму контроля");
      await api.post("/curriculum/admin/items", {
        planId: Number(selectedPlanId),
        subjectId: Number(createItem.subjectId),
        hours: Number(createItem.hours) || 0,
        controlForm: createItem.controlForm,
        semester: createItem.semester ? Number(createItem.semester) : null,
        notes: createItem.notes || null,
      });
      toast.success("Строка добавлена");
      await loadPlan(selectedPlanId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const deleteItem = async (id) => {
    try {
      if (!window.confirm("Удалить строку учебного плана?")) return;
      await api.delete(`/curriculum/admin/items/${id}`);
      toast.success("Удалено");
      await loadPlan(selectedPlanId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <SectionCard
          title="Учебный план"
          right={
            <button
              className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
              onClick={loadViewer}
            >
              Обновить
            </button>
          }
        >
          <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 mb-6 grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <div className="text-xs text-slate-400 mb-1">Учебный год (опционально)</div>
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="например, 2026-2027"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadViewer()}
              />
            </div>
            <button
              className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 hover:brightness-105 transition-all"
              onClick={loadViewer}
            >
              Показать
            </button>
          </div>

          {viewerPlan ? (
            <div className="mb-4 text-slate-300 text-sm">
              <div className="font-semibold text-slate-100">{viewerPlan.title}</div>
              <div className="text-slate-400 text-xs mt-1">
                Программа: {viewerPlan.program?.name || "—"} • Год: {viewerPlan.academicYear}
              </div>
            </div>
          ) : (
            <div className="text-slate-400 mb-4">Учебный план не задан (или не привязана программа в профиле).</div>
          )}

          <SimpleTable rows={viewerRows} />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Учебный план (администрирование)"
        right={
          <button
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={() => loadPlans().catch((e) => toast.error(getErrorMessage(e)))}
          >
            Обновить список
          </button>
        }
      >
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-3">
            <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Создать план</div>
            <div className="grid md:grid-cols-2 gap-3">
              <select
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                value={createPlan.programId}
                onChange={(e) => setCreatePlan((s) => ({ ...s, programId: e.target.value }))}
              >
                <option value="">Программа</option>
                {programs.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="Учебный год"
                value={createPlan.academicYear}
                onChange={(e) => setCreatePlan((s) => ({ ...s, academicYear: e.target.value }))}
              />
              <input
                className="md:col-span-2 w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                placeholder="Название плана"
                value={createPlan.title}
                onChange={(e) => setCreatePlan((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <button
              className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 hover:brightness-105 transition-all"
              onClick={addPlan}
            >
              Создать
            </button>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-3">
            <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Выбор плана</div>
            <select
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              <option value="">— выберите —</option>
              {planList.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  #{p.id} • {p.academicYear} • {p.program?.name || `programId=${p.programId}`}
                </option>
              ))}
            </select>
            {selectedPlan ? (
              <div className="text-slate-400 text-xs">
                {selectedPlan.title} • Программа: {selectedPlan.program?.name || "—"}
              </div>
            ) : null}
          </div>
        </div>

        {selectedPlan ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4 space-y-3">
              <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Добавить дисциплину</div>
              <div className="grid md:grid-cols-5 gap-3 items-end">
                <select
                  className="md:col-span-2 w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={createItem.subjectId}
                  onChange={(e) => setCreateItem((s) => ({ ...s, subjectId: e.target.value }))}
                >
                  <option value="">Дисциплина</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={createItem.hours}
                  onChange={(e) => setCreateItem((s) => ({ ...s, hours: e.target.value }))}
                  placeholder="Часы"
                />
                <input
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={createItem.controlForm}
                  onChange={(e) => setCreateItem((s) => ({ ...s, controlForm: e.target.value }))}
                  placeholder="Форма контроля"
                />
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={createItem.semester}
                  onChange={(e) => setCreateItem((s) => ({ ...s, semester: e.target.value }))}
                  placeholder="Семестр"
                />
                <input
                  className="md:col-span-5 w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm"
                  value={createItem.notes}
                  onChange={(e) => setCreateItem((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Примечания (опционально)"
                />
                <button
                  className="md:col-span-5 rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105 transition-all"
                  onClick={addItem}
                >
                  Добавить строку
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4">
              <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold mb-3">Строки плана</div>
              <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/90">
                    <tr>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Семестр</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Дисциплина</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Часы</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Контроль</th>
                      <th className="px-3 py-3 text-right uppercase tracking-wide text-[11px] text-slate-400 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPlan.items || []).map((it) => (
                      <tr key={it.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                        <td className="px-3 py-2.5 text-slate-200">{it.semester ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-200">{it.subjectRef?.name || it.subjectId}</td>
                        <td className="px-3 py-2.5 text-slate-200">{it.hours}</td>
                        <td className="px-3 py-2.5 text-slate-200">{it.controlForm}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            className="rounded-lg px-3 py-1.5 text-xs font-medium border border-rose-400/60 bg-rose-950/30 hover:bg-rose-950/45 text-rose-100"
                            onClick={() => deleteItem(it.id)}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(selectedPlan.items || []).length === 0 ? (
                      <tr className="border-t border-slate-800">
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                          Пока нет строк.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <SimpleTable rows={adminRows} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-slate-400">Выбери план, чтобы управлять дисциплинами.</div>
        )}
      </SectionCard>
    </div>
  );
}

