import { useEffect, useMemo, useState } from "react";
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addTopic = async () => {
    await api.post("/postgraduate/topics", { title: topic });
    setTopic("");
    await load();
  };

  const addMilestone = async () => {
    await api.post("/postgraduate/milestones", { title: milestone });
    setMilestone("");
    await load();
  };

  const createPlan = async () => {
    if (!planYear.trim()) return;
    await api.post("/postgraduate/plans", { academicYear: planYear });
    setPlanYear("2026-2027");
    await load();
  };

  const addPlanItem = async () => {
    const planId = data?.individualPlans?.[0]?.id;
    if (!planId || !planTitle.trim()) return;
    await api.post("/postgraduate/plan-items", { planId, title: planTitle });
    setPlanTitle("");
    await load();
  };

  const createDocument = async () => {
    if (!docTitle.trim()) return;
    await api.post("/postgraduate/documents", { title: docTitle, documentType: docType });
    setDocTitle("");
    await load();
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
    a.download = `postgraduate-archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      appealDeadline: a.attestedAt
        ? new Date(new Date(a.attestedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()
        : "—",
    }));
  }, [data]);

  const tabs = [
    ["iup", "Индивидуальный план"],
    ["docs", "Документооборот"],
    ["pubs", "Публикации"],
    ["exams", "Кандидатские экзамены"],
    ["finance", "Финансы и льготы"],
    ["events", "Конференции"],
    ["tools", "Сервисы аспиранта"],
  ];

  return (
    <div className="space-y-4">
      {loading && <p className="muted text-sm">Загрузка кабинета…</p>}
      {loadError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-rose-100 text-sm">
          {loadError}
        </div>
      )}
      <SectionCard title="Кабинет аспиранта — полный контур">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([id, title]) => (
            <button
              key={id}
              className={`nav-btn ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {title}
            </button>
          ))}
        </div>
      </SectionCard>

      {tab === "iup" && (
        <SectionCard title="Мой индивидуальный план (ИУП)">
          <div className="grid md:grid-cols-2 gap-2 mb-3">
            <input className="input" placeholder="Новая тема диссертации" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <button className="btn" onClick={addTopic}>Добавить тему</button>
            <input className="input" placeholder="Новая веха" value={milestone} onChange={(e) => setMilestone(e.target.value)} />
            <button className="btn" onClick={addMilestone}>Добавить веху</button>
            <input className="input" placeholder="Учебный год (например, 2026-2027)" value={planYear} onChange={(e) => setPlanYear(e.target.value)} />
            <button className="btn" onClick={createPlan}>Создать план по шаблону</button>
            <input className="input md:col-span-1" placeholder="Пункт плана" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
            <button className="btn" onClick={addPlanItem}>Добавить этап</button>
          </div>
          <SimpleTable rows={data?.individualPlans || []} />
          <div className="mt-3" />
          <SimpleTable rows={data?.milestones || []} />
        </SectionCard>
      )}

      {tab === "docs" && (
        <SectionCard title="Документооборот и архив">
          <div className="grid md:grid-cols-3 gap-2 mb-3">
            <input className="input" placeholder="Название документа" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="report">Отчет</option>
              <option value="application">Заявление</option>
              <option value="individual_plan">Индивидуальный план</option>
              <option value="other">Прочее</option>
            </select>
            <button className="btn" onClick={createDocument}>Создать документ</button>
          </div>
          <SimpleTable rows={data?.documents || []} />
        </SectionCard>
      )}

      {tab === "pubs" && (
        <SectionCard title="Библиотека и публикационная активность">
          <div className="grid md:grid-cols-2 gap-2 mb-3">
            <input
              className="input"
              placeholder="Сквозной поиск по публикациям (title/venue/status/indexing)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="surface rounded-xl px-3 py-2 text-sm">
              ВАК/РИНЦ/Scopus/WoS: {(data?.publications || []).length} записей
            </div>
          </div>
          <SimpleTable rows={filteredPublications} />
        </SectionCard>
      )}

      {tab === "exams" && (
        <SectionCard title="Кандидатские экзамены">
          <SimpleTable rows={examRows} />
        </SectionCard>
      )}

      {tab === "finance" && (
        <SectionCard title="Финансы и льготы">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="stat-card">
              <p className="muted text-xs uppercase tracking-wide">Стипендия</p>
              <p className="value">Ведомость доступна</p>
            </div>
            <div className="stat-card">
              <p className="muted text-xs uppercase tracking-wide">Матпомощь</p>
              <p className="value">Онлайн-заявка</p>
            </div>
            <div className="stat-card">
              <p className="muted text-xs uppercase tracking-wide">Общежитие</p>
              <p className="value">Статус в личном деле</p>
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
        <SectionCard title="Обязательные сервисы">
          <div className="grid md:grid-cols-3 gap-2">
            <button className="btn" onClick={exportPersonalArchive}>Скачать личное дело архивом</button>
            <button className="btn btn-secondary" onClick={load}>Обновить данные</button>
            <div className="surface rounded-xl px-3 py-2 text-sm">
              Дедлайны и уведомления отображаются на дашборде и в разделе «Уведомления».
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="История изменений темы">
        <SimpleTable rows={data?.dissertationTopics || []} />
      </SectionCard>
    </div>
  );
}
