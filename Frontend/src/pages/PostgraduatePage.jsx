import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

export default function PostgraduatePage() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("iup");
  const [topic, setTopic] = useState("");
  const [milestone, setMilestone] = useState("");
  const [search, setSearch] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planDueDate, setPlanDueDate] = useState("");
  const [planFile, setPlanFile] = useState(null);
  const [planYear, setPlanYear] = useState("2026-2027");
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("report");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      setData((await api.get("/postgraduate/dashboard")).data);
    } catch (e) {
      setLoadError(getErrorMessage(e));
      toast.error("Ошибка при загрузке кабинета");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReq = async (reqFunc, successMsg) => {
    try {
      await reqFunc();
      toast.success(successMsg);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  const addTopic = () => {
    if (!topic.trim()) return toast.error("Введите тему");
    handleReq(() => api.post("/postgraduate/topics", { title: topic }), "Тема добавлена");
    setTopic("");
  };

  const addMilestone = () => {
    if (!milestone.trim()) return toast.error("Введите веху");
    handleReq(() => api.post("/postgraduate/milestones", { title: milestone }), "Веха добавлена");
    setMilestone("");
  };

  const createPlan = async () => {
    if (!planYear.trim()) return toast.error("Введите год");
    handleReq(() => api.post("/postgraduate/plans", { academicYear: planYear }), "План создан");
    setPlanYear("2026-2027");
  };

  const addPlanItem = async () => {
    const planId = data?.individualPlans?.[0]?.id;
    if (!planId || !planTitle.trim()) return toast.error("Сначала создайте план или введите название");
    const fd = new FormData();
    fd.append("planId", String(planId));
    fd.append("title", planTitle);
    if (planDesc.trim()) fd.append("description", planDesc.trim());
    if (planDueDate) fd.append("dueDate", planDueDate);
    if (planFile) fd.append("file", planFile);

    handleReq(
      () => api.post("/postgraduate/plan-items-with-file", fd, { headers: { "Content-Type": "multipart/form-data" } }),
      "Этап добавлен"
    );
    setPlanTitle("");
    setPlanDesc("");
    setPlanDueDate("");
    setPlanFile(null);
  };

  const createDocument = async () => {
    if (!docTitle.trim()) return toast.error("Введите название документа");
    handleReq(() => api.post("/postgraduate/documents", { title: docTitle, documentType: docType }), "Документ создан");
    setDocTitle("");
  };

  const exportPersonalArchive = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: data?.profile || null,
      topics: data?.dissertationTopics || [],
      plans: data?.individualPlans || [],
      milestones: data?.milestones || [],
      publications: data?.publications || [],
      documents: data?.documents || [],
      attestations: data?.attestations || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Архив скачан");
  };

  const filteredPublications = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.publications || [];
    if (!q) return list;
    return list.filter((p) =>
      [p.title, p.venue, p.indexing, p.status].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [data, search]);

  const examRows = useMemo(() => {
    return (data?.attestations || []).map((a, i) => ({
      id: a.id || i + 1,
      exam: a.periodLabel || "Кандидатский экзамен",
      status: a.decision || "Не сдан",
      validUntil: a.attestedAt || "—",
      report: Array.isArray(a.files) && a.files.length ? a.files[0].originalName : "—",
      appealDeadline: a.attestedAt
        ? new Date(new Date(a.attestedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()
        : "—",
    }));
  }, [data]);

  const tabs = [
    ["iup", "ИУП"],
    ["docs", "Документооборот"],
    ["pubs", "Публикации"],
    ["exams", "Экзамены"],
    ["finance", "Финансы/Льготы"],
    ["events", "Мероприятия"],
    ["tools", "Инструменты"],
  ];

  return (
    <div className="space-y-6">
      {loading && <p className="text-slate-400 text-sm">Загрузка кабинета…</p>}
      {loadError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-rose-100 text-sm">
          {loadError}
        </div>
      )}
      
      <SectionCard title="Кабинет аспиранта">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([id, title]) => (
            <button
              key={id}
              className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium border transition-all duration-200 ${
                tab === id 
                  ? "text-slate-900 border-sky-300 bg-sky-400 font-medium shadow-[0_10px_26px_rgba(56,189,248,0.34)]"
                  : "text-slate-200 border-slate-600/65 bg-slate-800/60 hover:bg-slate-700/85 hover:-translate-y-px"
              }`}
              onClick={() => setTab(id)}
            >
              {title}
            </button>
          ))}
        </div>
      </SectionCard>

      {tab === "iup" && (
        <SectionCard title="Индивидуальный учебный план">
          <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 mb-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-3 items-center">
              <input className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" placeholder="Новая тема диссертации" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <button className="rounded-xl px-5 py-2 font-semibold border border-transparent bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors" onClick={addTopic}>Добавить тему</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 items-center">
              <input className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" placeholder="Новая веха" value={milestone} onChange={(e) => setMilestone(e.target.value)} />
              <button className="rounded-xl px-5 py-2 font-semibold border border-transparent bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors" onClick={addMilestone}>Добавить веху</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 items-center">
              <input className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" placeholder="Учебный год (например, 2026-2027)" value={planYear} onChange={(e) => setPlanYear(e.target.value)} />
              <button className="rounded-xl px-5 py-2 font-semibold border border-transparent bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors" onClick={createPlan}>Создать план</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 items-center">
              <input className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" placeholder="Этап диссертационного исследования (название)" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
              <input className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" placeholder="Описание этапа (опционально)" value={planDesc} onChange={(e) => setPlanDesc(e.target.value)} />
            </div>
            <div className="grid md:grid-cols-2 gap-3 items-center">
              <input className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" type="date" value={planDueDate} onChange={(e) => setPlanDueDate(e.target.value)} />
              <input className="w-full text-sm text-slate-300" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg" onChange={(e) => setPlanFile((e.target.files && e.target.files[0]) ? e.target.files[0] : null)} />
            </div>
            <button className="rounded-xl px-4 py-2 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all w-full" onClick={addPlanItem}>Добавить этап к текущему плану</button>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-slate-300 text-sm font-semibold mb-3 uppercase tracking-wider">Планы (ИУП)</h3>
              <SimpleTable rows={data?.individualPlans || []} />
            </div>
            <div>
              <h3 className="text-slate-300 text-sm font-semibold mb-3 uppercase tracking-wider">Этапы исследования (ИОМ)</h3>
              <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/90">
                    <tr>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Этап</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Статус</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Дедлайн</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Отчёт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.individualPlans?.[0]?.items || []).map((it) => (
                      <tr key={it.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                        <td className="px-3 py-2.5 text-slate-200">
                          <div className="font-semibold">{it.title}</div>
                          {it.description ? <div className="text-xs text-slate-400 mt-1">{it.description}</div> : null}
                          {it.supervisorNotes ? <div className="text-xs text-amber-200 mt-1">Комментарий НР: {it.supervisorNotes}</div> : null}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">{it.status || "planned"}</td>
                        <td className="px-3 py-2.5 text-slate-200">{it.dueDate || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {Array.isArray(it.files) && it.files.length ? (
                            <a
                              className="text-sky-200 underline text-xs"
                              href={`/api/postgraduate/plan-items/${it.id}/files/${it.files[0].id}/download`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {it.files[0].originalName}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                    {(data?.individualPlans?.[0]?.items || []).length === 0 ? (
                      <tr className="border-t border-slate-800">
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                          Пока нет этапов.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-slate-300 text-sm font-semibold mb-3 uppercase tracking-wider">Вехи</h3>
              <SimpleTable rows={data?.milestones || []} />
            </div>
            <div>
              <h3 className="text-slate-300 text-sm font-semibold mb-3 uppercase tracking-wider">История тем диссертаций</h3>
              <SimpleTable rows={data?.dissertationTopics || []} />
            </div>
          </div>
        </SectionCard>
      )}

      {tab === "docs" && (
        <SectionCard title="Документооборот и архив">
          <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 mb-5 grid md:grid-cols-3 gap-3">
            <input className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" placeholder="Название документа" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            <select className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="report">Отчет</option>
              <option value="application">Заявление</option>
              <option value="individual_plan">Индивидуальный план</option>
              <option value="other">Прочее</option>
            </select>
            <button className="rounded-xl px-5 py-2 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all" onClick={createDocument}>Создать документ</button>
          </div>
          <SimpleTable rows={data?.documents || []} />
        </SectionCard>
      )}

      {tab === "pubs" && (
        <SectionCard title="Библиотека и публикации">
          <div className="grid lg:grid-cols-3 gap-3 mb-5">
            <div className="lg:col-span-2">
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder="Сквозной поиск по публикациям..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2 text-sm text-sky-200 flex items-center justify-center font-medium">
              Всего публикаций: {(data?.publications || []).length}
            </div>
          </div>
          <SimpleTable rows={filteredPublications} />
        </SectionCard>
      )}

      {tab === "exams" && (
        <SectionCard title="Кандидатские экзамены">
          <div className="text-slate-400 text-xs mb-3">
            Если к аттестации прикреплён отчёт, он отображается в колонке <span className="text-slate-200 font-semibold">report</span>.
          </div>
          <SimpleTable rows={examRows} />
        </SectionCard>
      )}

      {tab === "finance" && (
        <SectionCard title="Финансы и льготы">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
              <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Стипендия</p>
              <p className="text-lg font-bold text-sky-100 mt-1">Доступна</p>
            </div>
            <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
              <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Матпомощь</p>
              <p className="text-lg font-bold text-sky-100 mt-1">Онлайн-заявка</p>
            </div>
            <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
              <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Общежитие</p>
              <p className="text-lg font-bold text-sky-100 mt-1">Статус в личном деле</p>
            </div>
          </div>
        </SectionCard>
      )}

      {tab === "events" && (
        <SectionCard title="Конференции и мероприятия">
          <SimpleTable
            rows={[
              { id: 1, title: "PhD Research Days", type: "Конференция", relevance: "Высокая", action: "Подать заявку на командировку" },
              { id: 2, title: "Научный семинар кафедры", type: "Семинар", relevance: "Средняя", action: "Добавить в календарь" },
            ]}
          />
        </SectionCard>
      )}

      {tab === "tools" && (
        <SectionCard title="Инструменты">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <button className="rounded-xl px-5 py-3 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-sm" onClick={exportPersonalArchive}>Скачать личное дело</button>
            <button className="rounded-xl px-5 py-3 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors" onClick={load}>Обновить данные</button>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-300 flex items-center col-span-full md:col-span-1">
              Дедлайны отображаются на дашборде.
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
