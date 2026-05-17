import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import { downloadWithAuth } from "../api/downloadWithAuth";
import { displayUploadFilename } from "../utils/uploadFilename";
import CabinetTabBar from "../components/cabinet/CabinetTabBar";
import PostgraduateFullOverview from "../components/cabinet/PostgraduateFullOverview";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";
import { useAuthStore } from "../store/authStore";

function planItemDueInputValue(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

const PLAN_STATUS_RU = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Утверждён",
  rejected: "На доработке",
  archived: "В архиве",
};

const TOPIC_STATUS_RU = {
  draft: "черновик",
  submitted: "на проверке",
  approved: "утверждена",
  rejected: "возвращена",
  archived: "в архиве",
};

const fld =
  "w-full rounded-xl border border-slate-600/55 bg-slate-950/50 text-slate-100 px-3.5 py-2.5 text-sm placeholder:text-slate-500 shadow-[inset_0_1px_2px_rgba(0,0,0,.22)] focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/14 transition-colors";

function IupSectionCard({ step, title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-700/55 bg-gradient-to-br from-slate-950/45 via-slate-900/25 to-slate-950/50 p-5 md:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] ring-1 ring-black/25">
      <div className="flex gap-4 border-b border-slate-700/45 pb-4 mb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/25 to-sky-600/10 text-sm font-bold text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,.28)]">
          {step}
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-[15px] font-semibold text-slate-100 tracking-tight">{title}</h3>
          {description ? <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function PostgraduatePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planDueDate, setPlanDueDate] = useState("");
  const [planFile, setPlanFile] = useState(null);
  const [planYear, setPlanYear] = useState("2026-2027");
  const [planTopicForCreate, setPlanTopicForCreate] = useState("");
  const [planLinkTopicId, setPlanLinkTopicId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("report");
  const [docPlanId, setDocPlanId] = useState("");
  const [pubForm, setPubForm] = useState({ title: "", venue: "", year: "", doi: "", indexing: "" });
  const [grades, setGrades] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      const [dash, gr, notif] = await Promise.all([
        api.get("/postgraduate/dashboard"),
        api.get("/grades"),
        api.get("/notifications"),
      ]);
      setData(dash.data);
      setGrades(Array.isArray(gr.data) ? gr.data : []);
      setNotifications(Array.isArray(notif.data) ? notif.data : []);
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

  useEffect(() => {
    if (selectedPlanId) return;
    const first = data?.individualPlans?.[0]?.id;
    if (first) setSelectedPlanId(String(first));
  }, [data, selectedPlanId]);

  const selectedPlan = useMemo(() => {
    const list = data?.individualPlans || [];
    return list.find((p) => String(p.id) === String(selectedPlanId)) || list[0] || null;
  }, [data, selectedPlanId]);

  const linkableTopics = useMemo(() => {
    return (data?.dissertationTopics || []).filter((t) => t.status !== "archived");
  }, [data]);

  const attachableTopicsKey = useMemo(
    () =>
      [...linkableTopics]
        .map((t) => t.id)
        .sort((a, b) => a - b)
        .join(","),
    [linkableTopics]
  );

  useEffect(() => {
    if (!linkableTopics.length) return;
    setPlanTopicForCreate((prev) => prev || String(linkableTopics[0].id));
  }, [linkableTopics]);

  useEffect(() => {
    if (!selectedPlan) {
      setPlanLinkTopicId("");
      return;
    }
    const tid = selectedPlan.dissertationTopicId ?? selectedPlan.dissertationTopic?.id;
    if (tid != null && tid !== "") {
      setPlanLinkTopicId(String(tid));
      return;
    }
    setPlanLinkTopicId((prev) => {
      if (prev && linkableTopics.some((t) => String(t.id) === prev)) return prev;
      return linkableTopics[0]?.id ? String(linkableTopics[0].id) : "";
    });
  }, [
    selectedPlan?.id,
    selectedPlan?.dissertationTopicId,
    selectedPlan?.dissertationTopic?.id,
    attachableTopicsKey,
  ]);

  const canSubmitPlan = useMemo(() => {
    if (!selectedPlan || selectedPlan.status !== "draft") return false;
    const hasTopic =
      !!(selectedPlan.dissertationTopicId ?? selectedPlan.dissertationTopic?.id);
    const hasItems = Array.isArray(selectedPlan.items) && selectedPlan.items.length > 0;
    return hasTopic && hasItems;
  }, [selectedPlan]);

  const planHasLinkedTopic =
    !!(selectedPlan && (selectedPlan.dissertationTopicId ?? selectedPlan.dissertationTopic?.id));

  const approvedPlansForDocs = useMemo(
    () => (data?.individualPlans || []).filter((p) => p.status === "approved"),
    [data?.individualPlans]
  );

  const planEditingStructure =
    !!(selectedPlan && ["draft", "rejected"].includes(selectedPlan.status));
  const planExecutionOpen =
    !!(selectedPlan && ["draft", "rejected", "approved"].includes(selectedPlan.status));

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

  const createPlan = async () => {
    if (!planYear.trim()) return toast.error("Введите год");
    const tid = parseInt(planTopicForCreate, 10);
    if (!tid) return toast.error("Выберите тему диссертации для плана");
    handleReq(
      () => api.post("/postgraduate/plans", { academicYear: planYear.trim(), dissertationTopicId: tid }),
      "План создан"
    );
    setPlanYear("2026-2027");
  };

  const linkTopicToPlan = async () => {
    if (!selectedPlan?.id) return;
    const tid = parseInt(planLinkTopicId, 10);
    if (!tid) return toast.error("Выберите тему");
    handleReq(() => api.patch(`/postgraduate/plans/${selectedPlan.id}`, { dissertationTopicId: tid }), "Тема привязана к плану");
  };

  const submitPlan = async () => {
    if (!selectedPlan?.id) return toast.error("Выберите план");
    if (!planHasLinkedTopic) return toast.error("Привяжите тему диссертации к плану");
    if (!Array.isArray(selectedPlan.items) || selectedPlan.items.length === 0) {
      return toast.error("Добавьте хотя бы один этап перед отправкой");
    }
    handleReq(() => api.put(`/postgraduate/plans/${selectedPlan.id}/submit`), "План отправлен на проверку");
  };

  const addPlanItem = async () => {
    const planId = selectedPlan?.id;
    if (!planId || !planTitle.trim()) return toast.error("Сначала создайте план или введите название");
    if (!planHasLinkedTopic) return toast.error("Сначала привяжите к плану тему диссертации");
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

  const deletePlanItem = async (id) => {
    if (!id) return;
    if (!window.confirm("Удалить этап?")) return;
    handleReq(() => api.delete(`/postgraduate/plan-items/${id}`), "Этап удалён");
  };

  const uploadItemFile = async (itemId, file) => {
    if (!itemId || !file) return toast.error("Выберите файл");
    const fd = new FormData();
    fd.append("file", file);
    handleReq(
      () => api.post(`/postgraduate/plan-items/${itemId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } }),
      "Файл загружен"
    );
  };

  const updateItemStatus = async (itemId, status) => {
    if (!itemId) return;
    handleReq(() => api.put(`/postgraduate/plan-items/${itemId}`, { status }), "Статус обновлён");
  };

  const updateItemDueDate = async (itemId, dueDate) => {
    if (!itemId) return;
    handleReq(() => api.put(`/postgraduate/plan-items/${itemId}`, { dueDate: dueDate || null }), "Дедлайн обновлён");
  };

  const downloadPlanItemReport = async (itemId, file) => {
    if (!itemId || !file?.id) return;
    try {
      await downloadWithAuth(
        `/postgraduate/plan-items/${itemId}/files/${file.id}/download`,
        file.originalName
      );
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const deletePlanItemFile = async (itemId, file) => {
    if (!itemId || !file?.id) return;
    const name = displayUploadFilename(file.originalName);
    if (!window.confirm(`Удалить файл «${name}»?`)) return;
    handleReq(
      () => api.delete(`/postgraduate/plan-items/${itemId}/files/${file.id}`),
      "Файл удалён"
    );
  };

  const createDocument = async () => {
    if (!docTitle.trim()) return toast.error("Введите название документа");
    const payload = { title: docTitle.trim(), documentType: docType };
    if (docPlanId) {
      const pid = parseInt(docPlanId, 10);
      if (!pid) return toast.error("Выберите утверждённый план или оставьте «без привязки»");
      payload.individualPlanId = pid;
    }
    handleReq(() => api.post("/postgraduate/documents", payload), "Документ создан");
    setDocTitle("");
    setDocPlanId("");
  };

  const exportPersonalArchive = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: data?.profile || null,
      topics: data?.dissertationTopics || [],
      plans: data?.individualPlans || [],
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
      period: a.periodLabel || "—",
      decision: a.decision || "—",
      date: a.attestedAt || "—",
      report: Array.isArray(a.files) && a.files.length ? a.files[0].originalName : "—",
      appealDeadline: a.attestedAt
        ? new Date(new Date(a.attestedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()
        : "—",
    }));
  }, [data]);

  const tabs = [
    ["overview", "Обзор"],
    ["iup", "План работы"],
    ["docs", "Документы"],
    ["pubs", "Публикации"],
    ["exams", "Аттестации"],
  ];

  const supervisor = data?.supervisions?.[0]?.supervisor;
  const dissertationTitle =
    selectedPlan?.dissertationTopic?.title ||
    data?.dissertationTopics?.find((t) => t.status === "approved")?.title ||
    data?.dissertationTopics?.[0]?.title ||
    "—";

  const planProgress = useMemo(() => {
    const items = (data?.individualPlans || []).flatMap((p) => p.items || []);
    if (!items.length) return 0;
    const done = items.filter((i) => i.status === "done" || i.completedAt).length;
    return Math.round((done / items.length) * 100);
  }, [data?.individualPlans]);

  const planItemsSummary = useMemo(() => {
    const items = (data?.individualPlans || []).flatMap((p) => p.items || []);
    const overdue = items.filter((i) => i.status === "overdue").length;
    return { total: items.length, overdue };
  }, [data?.individualPlans]);

  const addPublication = async () => {
    if (!pubForm.title.trim()) return toast.error("Укажите название публикации");
    handleReq(
      () =>
        api.post("/postgraduate/publications", {
          title: pubForm.title.trim(),
          venue: pubForm.venue.trim() || null,
          year: pubForm.year ? parseInt(pubForm.year, 10) : null,
          doi: pubForm.doi.trim() || null,
          indexing: pubForm.indexing.trim() || null,
          status: "submitted",
        }),
      "Публикация добавлена"
    );
    setPubForm({ title: "", venue: "", year: "", doi: "", indexing: "" });
  };

  return (
    <div className="space-y-6">
      {loading && <p className="text-slate-400 text-sm">Загрузка кабинета…</p>}
      {loadError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-rose-100 text-sm">
          {loadError}
        </div>
      )}
      
      <CabinetTabBar tabs={tabs} activeTab={tab} onTabChange={setTab} />

      {tab === "overview" && (
        <PostgraduateFullOverview
          user={user}
          data={data}
          grades={grades}
          notifications={notifications}
          dissertationTitle={dissertationTitle}
          supervisor={supervisor}
          selectedPlan={selectedPlan}
          planProgress={planProgress}
          planItemsSummary={planItemsSummary}
          examRows={examRows}
          publications={data?.publications}
          onOpenTab={setTab}
        />
      )}

      {tab === "iup" && (
        <SectionCard title="Индивидуальный учебный план">
          <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-r from-slate-900/60 to-slate-950/35 px-5 py-4 mb-8 ring-1 ring-white/[0.03]">
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              Укажите тему один раз и привяжите её к учебному году. Этапы исследования (ИОМ) относятся к этой теме — при отправке на
              проверку уходят вместе тема, этапы и сроки.
            </p>
          </div>

          <div className="space-y-6">
            <IupSectionCard
              step="1"
              title="Текущий план"
              description="Выберите план по году, при необходимости привяжите тему — без неё этапы не добавляются. Затем отправьте план на согласование."
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">План (учебный год)</label>
                  <select className={fld} value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
                    {(data?.individualPlans || []).length === 0 ? <option value="">Планов пока нет</option> : null}
                    {(data?.individualPlans || []).map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.academicYear} · {PLAN_STATUS_RU[p.status] || p.status}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPlan?.status === "rejected" && selectedPlan?.rejectReason ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/25 px-4 py-3 text-sm text-rose-100/95">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-300/90">Комментарий руководителя</span>
                    <p className="mt-1.5 text-slate-100/95 leading-relaxed whitespace-pre-wrap">{selectedPlan.rejectReason}</p>
                  </div>
                ) : null}

                {selectedPlan?.dissertationTopic ? (
                  <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/90 mb-1">Тема диссертации</div>
                    <p className="text-sm font-medium text-slate-50 leading-snug">{selectedPlan.dissertationTopic.title}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Статус темы:{" "}
                      <span className="text-slate-300">{TOPIC_STATUS_RU[selectedPlan.dissertationTopic.status] || selectedPlan.dissertationTopic.status}</span>
                    </p>
                  </div>
                ) : selectedPlan && !planHasLinkedTopic ? (
                  <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-950/50 via-orange-950/15 to-transparent p-4 sm:p-5">
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-200 text-xs font-bold border border-amber-400/25">
                        !
                      </div>
                      <div className="min-w-0 space-y-3 flex-1">
                        <p className="text-sm text-amber-100/95 leading-snug">
                          Без привязанной темы этапы добавить нельзя. Выберите тему ниже и нажмите «Привязать».
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                          <select
                            className={`${fld} flex-1 min-w-0 sm:min-h-[42px]`}
                            value={planLinkTopicId}
                            onChange={(e) => setPlanLinkTopicId(e.target.value)}
                            disabled={!linkableTopics.length}
                          >
                            {linkableTopics.length === 0 ? <option value="">Нет доступных тем — создайте тему в шаге 2</option> : null}
                            {linkableTopics.map((t) => (
                              <option key={t.id} value={String(t.id)}>
                                {t.title?.slice(0, 90)}
                                {t.title && t.title.length > 90 ? "…" : ""} · {TOPIC_STATUS_RU[t.status] || t.status}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="shrink-0 rounded-xl border border-sky-400/45 bg-sky-500/15 px-5 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/25 disabled:opacity-40 disabled:hover:bg-sky-500/15 transition-colors whitespace-nowrap"
                            disabled={!linkableTopics.length || !["draft", "rejected"].includes(selectedPlan.status)}
                            onClick={linkTopicToPlan}
                          >
                            Привязать тему
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="pt-4 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-slate-500 max-w-md order-2 sm:order-1">
                    Доступно для черновика: нужны тема и хотя бы один этап.
                  </p>
                  <button
                    type="button"
                    className="order-1 sm:order-2 w-full sm:w-auto sm:min-w-[220px] rounded-xl px-6 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-br from-sky-400 to-sky-500 shadow-[0_8px_28px_rgba(56,189,248,.28)] hover:brightness-105 hover:shadow-[0_10px_32px_rgba(56,189,248,.32)] disabled:opacity-35 disabled:hover:brightness-100 disabled:shadow-none transition-all"
                    disabled={!canSubmitPlan}
                    onClick={submitPlan}
                    title={
                      !selectedPlan
                        ? "Выберите план"
                        : selectedPlan.status !== "draft"
                          ? "Отправить можно только черновик"
                          : !planHasLinkedTopic
                            ? "Привяжите тему диссертации"
                            : !Array.isArray(selectedPlan.items) || selectedPlan.items.length === 0
                              ? "Добавьте этапы"
                              : ""
                    }
                  >
                    Отправить на проверку
                  </button>
                </div>
              </div>
            </IupSectionCard>

            <IupSectionCard step="2" title="Формулировка темы" description="Создайте запись темы — её можно переиспользовать в планах разных лет.">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
                <input className={`${fld} flex-1`} placeholder="Новая тема диссертации" value={topic} onChange={(e) => setTopic(e.target.value)} />
                <button
                  type="button"
                  className="shrink-0 rounded-xl px-6 py-2.5 text-sm font-semibold border border-slate-600/65 bg-slate-800/80 text-slate-100 hover:bg-slate-700/95 transition-colors sm:min-h-[42px]"
                  onClick={addTopic}
                >
                  Добавить тему
                </button>
              </div>
            </IupSectionCard>

            <IupSectionCard step="3" title="Новый план на учебный год" description="Один план соответствует одному учебному году и одной теме.">
              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <div className="sm:col-span-1 space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">Тема для плана</label>
                  <select className={fld} value={planTopicForCreate} onChange={(e) => setPlanTopicForCreate(e.target.value)} disabled={!linkableTopics.length}>
                    {linkableTopics.length === 0 ? <option value="">Сначала добавьте тему (шаг 2)</option> : null}
                    {linkableTopics.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {(t.title || "").slice(0, 80)}
                        {(t.title || "").length > 80 ? "…" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-1 space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">Учебный год</label>
                  <input className={fld} placeholder="Например, 2026-2027" value={planYear} onChange={(e) => setPlanYear(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-violet-400/35 bg-violet-500/12 text-violet-100 hover:bg-violet-500/20 disabled:opacity-40 transition-colors"
                    disabled={!linkableTopics.length || !planYear.trim()}
                    onClick={createPlan}
                  >
                    Создать план на этот год
                  </button>
                </div>
              </div>
            </IupSectionCard>

            <IupSectionCard
              step="4"
              title="Этапы исследования"
              description="Добавьте этапы с датами и при необходимости прикрепите отчёт — они относятся к теме выбранного плана."
            >
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <input className={fld} placeholder="Название этапа" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
                  <input className={fld} placeholder="Описание (опционально)" value={planDesc} onChange={(e) => setPlanDesc(e.target.value)} />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Срок (дедлайн)</label>
                    <input className={fld} type="date" value={planDueDate} onChange={(e) => setPlanDueDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Файл отчёта (опционально)</label>
                    <label className="flex min-h-[42px] cursor-pointer items-center rounded-xl border border-dashed border-slate-600/55 bg-slate-950/40 px-3 py-2 hover:border-slate-500/60 transition-colors">
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg"
                        onChange={(e) => setPlanFile((e.target.files && e.target.files[0]) ? e.target.files[0] : null)}
                      />
                      <span className="text-xs text-slate-400 truncate">
                        {planFile ? planFile.name : "Выберите файл"}
                      </span>
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-br from-sky-400 to-sky-500 shadow-[0_8px_24px_rgba(56,189,248,.22)] hover:brightness-105 disabled:opacity-40 transition-all"
                  disabled={!(selectedPlan && ["draft", "rejected"].includes(selectedPlan.status)) || !planHasLinkedTopic}
                  title={
                    !planHasLinkedTopic
                      ? "Сначала привяжите тему диссертации к плану"
                      : !selectedPlan || !["draft", "rejected"].includes(selectedPlan.status)
                        ? "Добавлять этапы можно только в черновике или после возврата"
                        : ""
                  }
                  onClick={addPlanItem}
                >
                  Добавить этап к текущему плану
                </button>
              </div>
            </IupSectionCard>
          </div>

          <div className="space-y-8 mt-10 pt-10 border-t border-slate-700/50">
            <div>
              <h3 className="text-slate-200 text-xs font-semibold mb-4 uppercase tracking-[0.12em]">Планы (ИУП)</h3>
              <SimpleTable
                rows={(data?.individualPlans || []).map((p) => ({
                  id: p.id,
                  academicYear: p.academicYear,
                  topic: p.dissertationTopic?.title || "—",
                  status: PLAN_STATUS_RU[p.status] || p.status,
                  items: Array.isArray(p.items) ? p.items.length : 0,
                }))}
              />
            </div>
            <div>
              <h3 className="text-slate-200 text-xs font-semibold mb-4 uppercase tracking-[0.12em]">Этапы исследования (ИОМ)</h3>
              {selectedPlan?.status === "approved" ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-4 py-3 text-xs text-emerald-100/95 mb-4 leading-relaxed">
                  План утверждён: загружайте отчёты по этапам и отмечайте статус выполнения. Названия этапов и сроки утверждения менять
                  нельзя — только исполнение.
                </div>
              ) : null}
              <div className="text-slate-500 text-xs mb-4 max-w-2xl leading-relaxed">
                Если дедлайн прошёл, а этап не завершён, статус автоматически становится{" "}
                <span className="text-amber-200/95 font-semibold">overdue</span>.
              </div>
              <div className="overflow-auto border border-slate-700/70 rounded-xl bg-slate-950/55 shadow-inner">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/90">
                    <tr>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Этап</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Статус</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Дедлайн</th>
                      <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">Отчёт</th>
                      <th className="px-3 py-3 text-right uppercase tracking-wide text-[11px] text-slate-400 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPlan?.items || []).map((it) => (
                      <tr key={it.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors">
                        <td className="px-3 py-2.5 text-slate-200">
                          <div className="font-semibold">{it.title}</div>
                          {it.description ? <div className="text-xs text-slate-400 mt-1">{it.description}</div> : null}
                          {it.supervisorNotes ? <div className="text-xs text-amber-200 mt-1">Комментарий НР: {it.supervisorNotes}</div> : null}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {planExecutionOpen ? (
                            it.status === "overdue" ? (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="rounded-md border border-amber-500/50 bg-amber-950/50 px-2 py-1 text-[11px] font-semibold text-amber-200">
                                  overdue
                                </span>
                                <select
                                  className="rounded-lg border border-slate-600/60 bg-slate-950/60 text-slate-100 px-2 py-1.5 text-xs max-w-[200px]"
                                  value=""
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v) updateItemStatus(it.id, v);
                                  }}
                                >
                                  <option value="">Сменить статус…</option>
                                  <option value="planned">planned</option>
                                  <option value="in_progress">in_progress</option>
                                  <option value="done">done</option>
                                </select>
                              </div>
                            ) : (
                              <select
                                className="rounded-lg border border-slate-600/60 bg-slate-950/60 text-slate-100 px-2 py-1.5 text-xs"
                                value={it.status || "planned"}
                                onChange={(e) => updateItemStatus(it.id, e.target.value)}
                              >
                                <option value="planned">planned</option>
                                <option value="in_progress">in_progress</option>
                                <option value="done">done</option>
                              </select>
                            )
                          ) : it.status === "overdue" ? (
                            <span className="rounded-md border border-amber-500/50 bg-amber-950/50 px-2 py-1 text-[11px] font-semibold text-amber-200">
                              overdue
                            </span>
                          ) : (
                            it.status || "planned"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {planEditingStructure ? (
                            <input
                              type="date"
                              className="rounded-lg border border-slate-600/60 bg-slate-950/60 text-slate-100 px-2 py-1.5 text-xs"
                              defaultValue={planItemDueInputValue(it.dueDate)}
                              onBlur={(e) => updateItemDueDate(it.id, e.target.value)}
                            />
                          ) : (
                            it.dueDate || "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {Array.isArray(it.files) && it.files.length ? (
                            <div className="flex flex-col gap-1 items-start">
                              {it.files.map((f) => (
                                <div key={f.id} className="flex flex-wrap items-center gap-2 max-w-full">
                                  <button
                                    type="button"
                                    className="text-sky-200 underline text-xs cursor-pointer bg-transparent border-0 p-0 font-inherit text-left"
                                    onClick={() => downloadPlanItemReport(it.id, f)}
                                  >
                                    {displayUploadFilename(f.originalName)}
                                  </button>
                                  {planExecutionOpen ? (
                                    <button
                                      type="button"
                                      className="text-rose-300 hover:text-rose-200 text-xs shrink-0"
                                      onClick={() => deletePlanItemFile(it.id, f)}
                                    >
                                      Удалить
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {planExecutionOpen ? (
                            <div className="flex justify-end gap-2 items-center flex-wrap">
                              <label className="rounded-lg px-3 py-1.5 text-xs font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg"
                                  onChange={(e) => uploadItemFile(it.id, e.target.files && e.target.files[0])}
                                />
                                Загрузить файл
                              </label>
                              {planEditingStructure ? (
                                <button
                                  className="rounded-lg px-3 py-1.5 text-xs font-medium border border-rose-400/60 bg-rose-950/30 hover:bg-rose-950/45 text-rose-100"
                                  type="button"
                                  onClick={() => deletePlanItem(it.id)}
                                >
                                  Удалить
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(selectedPlan?.items || []).length === 0 ? (
                      <tr className="border-t border-slate-800">
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                          Пока нет этапов.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
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
          <p className="text-xs text-slate-500 mb-5 max-w-2xl leading-relaxed">
            Карточку документа можно привязать к <span className="text-slate-300 font-medium">утверждённому</span> учебному плану — так видно,
            что материал относится к исполнению именно этого ИУП.
          </p>
          <div className="rounded-2xl border border-slate-700/55 bg-slate-950/35 p-5 mb-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Название</label>
                <input className={fld} placeholder="Название документа" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Тип</label>
                <select className={fld} value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="report">Отчёт</option>
                  <option value="application">Заявление</option>
                  <option value="individual_plan">Индивидуальный план</option>
                  <option value="other">Прочее</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Учебный план (опционально)</label>
                <select className={fld} value={docPlanId} onChange={(e) => setDocPlanId(e.target.value)}>
                  <option value="">Не привязывать</option>
                  {approvedPlansForDocs.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.academicYear} ({PLAN_STATUS_RU[p.status] || p.status})
                    </option>
                  ))}
                </select>
                {!approvedPlansForDocs.length ? (
                  <p className="text-[11px] text-slate-500 mt-1">Нет утверждённых планов — привязка станет доступна после согласования ИУП.</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="w-full sm:w-auto rounded-xl px-6 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:brightness-105 transition-all"
              onClick={createDocument}
            >
              Создать документ
            </button>
          </div>
          <SimpleTable
            rows={(data?.documents || []).map((d) => ({
              id: d.id,
              название: d.title,
              тип: d.documentType,
              статус: d.status,
              план_ИУП: d.individualPlan?.academicYear || "—",
              файлов: Array.isArray(d.files) ? d.files.length : 0,
            }))}
          />
        </SectionCard>
      )}

      {tab === "pubs" && (
        <SectionCard title="Публикации и апробации">
          <p className="text-xs text-slate-500 mb-4 max-w-2xl">
            Укажите индексирование (РИНЦ, Scopus, ВАК) и DOI или ссылку на публикацию.
          </p>
          <div className="rounded-2xl border border-slate-700/55 bg-slate-950/35 p-5 mb-6 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <input className={fld} placeholder="Название *" value={pubForm.title} onChange={(e) => setPubForm((s) => ({ ...s, title: e.target.value }))} />
              <input className={fld} placeholder="Издание / конференция" value={pubForm.venue} onChange={(e) => setPubForm((s) => ({ ...s, venue: e.target.value }))} />
              <input className={fld} placeholder="Год" value={pubForm.year} onChange={(e) => setPubForm((s) => ({ ...s, year: e.target.value }))} />
              <input className={fld} placeholder="Индексирование (РИНЦ, Scopus…)" value={pubForm.indexing} onChange={(e) => setPubForm((s) => ({ ...s, indexing: e.target.value }))} />
              <input className={`${fld} md:col-span-2`} placeholder="DOI или ссылка" value={pubForm.doi} onChange={(e) => setPubForm((s) => ({ ...s, doi: e.target.value }))} />
            </div>
            <button
              type="button"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-sky-400 text-slate-950 hover:brightness-105"
              onClick={addPublication}
            >
              Добавить публикацию
            </button>
          </div>
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
        <SectionCard title="Аттестации и отчёты">
          <p className="text-slate-400 text-xs mb-3">
            График кандидатских экзаменов и этапов диссертации; отчёты прикрепляются к записям аттестации.
          </p>
          <SimpleTable rows={examRows} />
        </SectionCard>
      )}

    </div>
  );
}
