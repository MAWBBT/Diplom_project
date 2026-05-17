import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import { downloadWithAuth } from "../api/downloadWithAuth";
import { displayUploadFilename } from "../utils/uploadFilename";
import CabinetTabBar from "../components/cabinet/CabinetTabBar";
import SupervisorFullOverview from "../components/cabinet/SupervisorFullOverview";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

function planItemDueInputValue(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

const PLAN_STATUS_LABEL = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Утверждён",
  rejected: "Возвращён на доработку",
  archived: "В архиве",
};

const SUPERVISOR_TABS = [
  ["overview", "Обзор"],
  ["students", "Аспиранты"],
  ["plans", "ИПР"],
  ["attestations", "Аттестации"],
  ["reports", "Отчётность"],
  ["feedback", "Обратная связь"],
  ["performance", "Успеваемость"],
  ["calendar", "Календарь"],
  ["notifications", "Уведомления"],
  ["templates", "Шаблоны"],
];

const FEEDBACK_KIND_LABEL = {
  review: "Отзыв",
  conclusion: "Заключение",
  recommendation: "Рекомендация",
};

const DOC_TEMPLATES = [
  { id: 1, title: "Отзыв научного руководителя", note: "Шаблон для заключения по диссертации" },
  { id: 2, title: "Рецензия", note: "Форма внешней рецензии" },
  { id: 3, title: "Отчёт о научной работе", note: "Годовой отчёт аспиранта" },
];

export default function SupervisorPage() {
  const [tab, setTab] = useState("overview");
  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState("2026-2027");
  const [selectedPostgraduateId, setSelectedPostgraduateId] = useState("");
  const [grades, setGrades] = useState([]);
  const [gradeFilters, setGradeFilters] = useState({ subjectId: "", dateFrom: "", dateTo: "", q: "" });
  const [bundle, setBundle] = useState(null);
  const [rejectReturnOpen, setRejectReturnOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [itemDrafts, setItemDrafts] = useState({});
  const [topicDrafts, setTopicDrafts] = useState({});
  const [overview, setOverview] = useState(null);
  const [homeSummary, setHomeSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [allAttestations, setAllAttestations] = useState([]);
  const [calendarData, setCalendarData] = useState({ events: [], reminders: [] });
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ kind: "review", title: "", body: "" });

  useEffect(() => {
    setRejectReturnOpen(false);
    setRejectReason("");
  }, [selectedYear, selectedPostgraduateId]);

  const loadSupervisorExtras = async () => {
    try {
      const [att, cal, fb] = await Promise.all([
        api.get("/supervisor/attestations"),
        api.get("/supervisor/calendar"),
        api.get("/supervisor/feedback"),
      ]);
      setAllAttestations(Array.isArray(att.data) ? att.data : []);
      setCalendarData(cal.data || { events: [], reminders: [] });
      setFeedbackList(Array.isArray(fb.data) ? fb.data : []);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const loadOverview = async () => {
    try {
      const [ov, summary, notif] = await Promise.all([
        api.get("/supervisor/overview"),
        api.get("/profile/home-summary"),
        api.get("/notifications"),
      ]);
      setOverview(ov.data);
      setHomeSummary(summary.data);
      setNotifications(Array.isArray(notif.data) ? notif.data : []);
      await loadSupervisorExtras();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const submitFeedback = async () => {
    if (!selectedPostgraduateId) {
      toast.error("Выберите аспиранта");
      return;
    }
    const title = feedbackForm.title.trim();
    const body = feedbackForm.body.trim();
    if (!title || !body) {
      toast.error("Заполните заголовок и текст");
      return;
    }
    try {
      await api.post("/supervisor/feedback", {
        postgraduateId: Number(selectedPostgraduateId),
        kind: feedbackForm.kind,
        title,
        body,
      });
      toast.success("Обратная связь сохранена");
      setFeedbackForm((s) => ({ ...s, title: "", body: "" }));
      await loadSupervisorExtras();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const load = async () => {
    try {
      const [data] = await Promise.all([
        api.get("/supervisor/supervisions").then((r) => r.data),
        loadOverview(),
      ]);
      setRows(data);
      const firstId = data?.[0]?.postgraduate?.id;
      if (firstId && !selectedPostgraduateId) setSelectedPostgraduateId(String(firstId));
      toast.success("Данные обновлены");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postgraduates = useMemo(
    () =>
      (rows || [])
        .map((r) => r?.postgraduate)
        .filter(Boolean),
    [rows]
  );

  const planForYear = useMemo(() => {
    const plans = bundle?.individualPlans || [];
    return plans.find((p) => p.academicYear === selectedYear) || plans[0] || null;
  }, [bundle?.individualPlans, selectedYear]);

  useEffect(() => {
    const plans = bundle?.individualPlans || [];
    const p = plans.find((pl) => pl.academicYear === selectedYear) || plans[0] || null;
    if (!p?.items || p.status !== "submitted") {
      setItemDrafts({});
      return;
    }
    const d = {};
    for (const it of p.items) {
      d[it.id] = {
        title: it.title ?? "",
        description: it.description ?? "",
        dueDate: planItemDueInputValue(it.dueDate),
        notes: it.notes ?? "",
      };
    }
    setItemDrafts(d);

    const td = {};
    for (const topic of bundle?.dissertationTopics || []) {
      if (["draft", "submitted"].includes(topic.status)) td[topic.id] = topic.title ?? "";
    }
    setTopicDrafts(td);
  }, [bundle, selectedYear]);

  const loadGrades = async () => {
    try {
      if (!selectedPostgraduateId) {
        setGrades([]);
        return;
      }
      const params = new URLSearchParams();
      if (gradeFilters.subjectId) params.set("subjectId", gradeFilters.subjectId);
      if (gradeFilters.dateFrom) params.set("dateFrom", gradeFilters.dateFrom);
      if (gradeFilters.dateTo) params.set("dateTo", gradeFilters.dateTo);
      if (gradeFilters.q.trim()) params.set("q", gradeFilters.q.trim());

      const url = params.toString()
        ? `/supervisor/grades/${selectedPostgraduateId}?${params.toString()}`
        : `/supervisor/grades/${selectedPostgraduateId}`;
      const data = (await api.get(url)).data;
      const list = Array.isArray(data) ? data : [];
      const selectedPg = (postgraduates || []).find((p) => String(p.id) === String(selectedPostgraduateId));
      const postgraduateLabel = selectedPg?.fullName || selectedPg?.login || selectedPostgraduateId;
      const normalized = list.map((r) => ({
        id: r.id,
        postgraduate: postgraduateLabel,
        subject: r?.subjectRef?.name || r?.subject?.name || r?.subjectId,
        controlType: r.controlType,
        grade: r.grade,
        comment: r.comment,
      }));
      setGrades(normalized);
      toast.success("Оценки обновлены");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!selectedPostgraduateId) return;
    loadGrades();
    (async () => {
      try {
        setBundle((await api.get(`/supervisor/postgraduate/${selectedPostgraduateId}`)).data);
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostgraduateId]);

  const refreshBundle = async () => {
    if (!selectedPostgraduateId) return;
    setBundle((await api.get(`/supervisor/postgraduate/${selectedPostgraduateId}`)).data);
  };

  const savePlanItemEdits = async (itemId) => {
    const d = itemDrafts[itemId];
    if (!d || planForYear?.status !== "submitted") return;
    const title = d.title.trim();
    if (!title) {
      toast.error("Укажите название этапа");
      return;
    }
    try {
      await api.patch(`/supervisor/plan-items/${itemId}`, {
        title,
        description: d.description.trim() || null,
        dueDate: d.dueDate.trim() ? d.dueDate.trim().slice(0, 10) : null,
        notes: d.notes.trim() || null,
      });
      toast.success("Правки этапа сохранены");
      await refreshBundle();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const saveTopicEdit = async (topicId, titleStr) => {
    const trimmed = titleStr.trim();
    if (!trimmed) {
      toast.error("Введите формулировку темы");
      return;
    }
    try {
      await api.patch(`/supervisor/topics/${topicId}`, { title: trimmed });
      toast.success("Тема обновлена");
      await refreshBundle();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const updatePlanItem = async (itemId, payload) => {
    try {
      await api.patch(`/supervisor/plan-items/${itemId}`, payload);
      toast.success("Этап обновлён");
      await refreshBundle();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const downloadSupervisorPlanItemReport = async (itemId, file) => {
    if (!itemId || !file?.id) return;
    try {
      await downloadWithAuth(
        `/supervisor/plan-items/${itemId}/files/${file.id}/download`,
        file.originalName
      );
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const studentRows = rows.map((r, idx) => ({
    id: r?.supervision?.id || idx + 1,
    postgraduate: r?.postgraduate?.fullName || "—",
    enrollmentYear: r?.profile?.enrollmentYear || "—",
    groupName: r?.postgraduate?.groupName || "—",
    topic: r?.latestTopic?.title || "—",
    risk: r?.latestTopic?.status === "approved" ? "В норме" : "Риск",
  }));

  const calendarEvents = useMemo(() => {
    const events = [];
    for (const p of bundle?.individualPlans || []) {
      if (p.academicYear !== selectedYear && selectedYear) continue;
      for (const it of p.items || []) {
        if (it.dueDate) {
          events.push({
            id: `plan-${it.id}`,
            date: it.dueDate,
            title: it.title,
            type: "Этап ИПР",
            status: it.status,
          });
        }
      }
    }
    for (const a of bundle?.attestations || []) {
      if (a.attestedAt) {
        events.push({
          id: `att-${a.id}`,
          date: a.attestedAt,
          title: a.periodLabel || a.decision || "Аттестация",
          type: "Аттестация",
          status: "—",
        });
      }
    }
    return events
      .filter((e) => e.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [bundle, selectedYear]);

  const updateDocumentStatus = async (docId, status) => {
    try {
      await api.patch(`/supervisor/documents/${docId}`, { status });
      toast.success("Статус документа обновлён");
      await Promise.all([refreshBundle(), loadOverview()]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const verifyPublication = async (pubId, status) => {
    try {
      await api.patch(`/supervisor/publications/${pubId}`, { status });
      toast.success("Статус публикации обновлён");
      await Promise.all([refreshBundle(), loadOverview()]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const bulkApprove = async () => {
    try {
      const { data } = await api.post("/supervisor/plans/bulk-approve", { academicYear: selectedYear });
      toast.success(`Подтверждено планов: ${data.updated || 0}`);
      await refreshBundle();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const updateIndividualPlan = async (planId, body, successMessage) => {
    try {
      await api.patch(`/supervisor/plans/${planId}`, body);
      toast.success(successMessage || "План обновлён");
      setRejectReturnOpen(false);
      setRejectReason("");
      await refreshBundle();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const showSupervisorToolbar = ["overview", "plans", "reports", "performance"].includes(tab);

  return (
    <div className="space-y-6">
      <CabinetTabBar tabs={SUPERVISOR_TABS} activeTab={tab} onTabChange={setTab} />

      {showSupervisorToolbar ? (
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 gap-4 grid md:grid-cols-2 lg:grid-cols-3 items-center">
          <select
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="2025-2026">2025-2026 год</option>
            <option value="2026-2027">2026-2027 год</option>
            <option value="2027-2028">2027-2028 год</option>
          </select>
          <button
            type="button"
            className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center"
            onClick={bulkApprove}
          >
            Подтвердить отчеты группы
          </button>
          <button
            type="button"
            className="w-full rounded-xl px-5 py-2.5 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={load}
          >
            Обновить данные
          </button>
        </div>
      ) : null}

      {tab === "overview" && (
        <SupervisorFullOverview
          overview={overview}
          homeSummary={homeSummary}
          notifications={notifications}
          onOpenTab={setTab}
          onSelectPostgraduate={(id) => setSelectedPostgraduateId(String(id))}
          onVerifyPublication={verifyPublication}
          onUpdateDocument={updateDocumentStatus}
        />
      )}

      {tab === "students" && (
        <SectionCard title="Список закреплённых аспирантов">
          <p className="text-xs text-slate-500 mb-4">ФИО, год поступления, тема диссертации, учебная группа.</p>
          <SimpleTable rows={studentRows} />
        </SectionCard>
      )}

      {(tab === "plans" || tab === "reports" || tab === "performance" || tab === "feedback") && (
        <SectionCard title="Выбор аспиранта">
          <select
            className="w-full max-w-md rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm"
            value={selectedPostgraduateId}
            onChange={(e) => setSelectedPostgraduateId(e.target.value)}
          >
            {postgraduates.length === 0 ? <option value="">Нет аспирантов</option> : null}
            {postgraduates.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.fullName} {p.groupName ? `(${p.groupName})` : ""}
              </option>
            ))}
          </select>
        </SectionCard>
      )}

      {tab === "performance" && (
      <>
      <SectionCard
        title="Успеваемость аспирантов"
        right={
          <button
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={loadGrades}
          >
            Обновить оценки
          </button>
        }
      >
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 grid lg:grid-cols-5 gap-3 items-end mb-5">
          <div className="lg:col-span-2">
            <div className="text-xs text-slate-400 mb-1">Аспирант</div>
            <select
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              value={selectedPostgraduateId}
              onChange={(e) => setSelectedPostgraduateId(e.target.value)}
            >
              {postgraduates.length === 0 ? <option value="">Нет аспирантов</option> : null}
              {postgraduates.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.fullName} {p.groupName ? `(${p.groupName})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Период (с)</div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              value={gradeFilters.dateFrom}
              onChange={(e) => setGradeFilters((s) => ({ ...s, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Период (по)</div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              value={gradeFilters.dateTo}
              onChange={(e) => setGradeFilters((s) => ({ ...s, dateTo: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Поиск</div>
            <input
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              placeholder="контроль/оценка/коммент"
              value={gradeFilters.q}
              onChange={(e) => setGradeFilters((s) => ({ ...s, q: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && loadGrades()}
            />
          </div>
          <button
            className="lg:col-span-5 rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center"
            onClick={loadGrades}
          >
            Применить фильтры
          </button>
        </div>

        <SimpleTable rows={grades || []} />
      </SectionCard>

      <SectionCard title="Публикации и конференции">
        <p className="text-xs text-slate-500 mb-3">Статьи и выступления (поле «Издание»).</p>
        <SimpleTable
          rows={(bundle?.publications || []).map((p) => ({
            id: p.id,
            title: p.title,
            venue: p.venue || "—",
            year: p.year ?? "—",
            indexing: p.indexing || "—",
            status: p.status,
          }))}
        />
      </SectionCard>
      </>
      )}

      {tab === "reports" && (
      <>
      <SectionCard title="Отчётность аспирантов">
        <p className="text-xs text-slate-500 mb-4">Просмотр, проверка, подписание или отклонение отчётов.</p>
        <SimpleTable
          rows={(bundle?.documents || []).map((d) => ({
            id: d.id,
            title: d.title,
            documentType: d.documentType,
            status: d.status,
            files: Array.isArray(d.files) ? d.files.length : 0,
          }))}
        />
        <div className="mt-4 space-y-2">
          {(bundle?.documents || []).filter((d) => d.status === "on_review").map((d) => (
            <div key={d.id} className="flex flex-wrap gap-2 items-center text-sm">
              <span className="text-slate-300">{d.title}</span>
              <button type="button" className="rounded-lg px-3 py-1 text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/40" onClick={() => updateDocumentStatus(d.id, "approved")}>Подписать / утвердить</button>
              <button type="button" className="rounded-lg px-3 py-1 text-xs bg-rose-500/20 text-rose-200 border border-rose-500/40" onClick={() => updateDocumentStatus(d.id, "rejected")}>Отклонить</button>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Публикации на проверке">
        <div className="space-y-2">
          {(bundle?.publications || []).filter((p) => p.status === "submitted").map((p) => (
            <div key={p.id} className="flex flex-wrap gap-2 items-center text-sm">
              <span className="text-slate-300 truncate max-w-md">{p.title}</span>
              <button type="button" className="rounded-lg px-3 py-1 text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/40" onClick={() => verifyPublication(p.id, "verified")}>Подтвердить</button>
              <button type="button" className="rounded-lg px-3 py-1 text-xs bg-rose-500/20 text-rose-200 border border-rose-500/40" onClick={() => verifyPublication(p.id, "rejected")}>Отклонить</button>
            </div>
          ))}
          {!(bundle?.publications || []).some((p) => p.status === "submitted") ? <p className="text-slate-500 text-sm">Нет публикаций на проверке.</p> : null}
        </div>
      </SectionCard>
      </>
      )}

      {tab === "attestations" && (
        <SectionCard title="График аттестаций и отчётов">
          {(calendarData.reminders || []).length > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              <p className="font-medium mb-1">Напоминания о сроках</p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {(calendarData.reminders || []).slice(0, 8).map((ev) => (
                  <li key={ev.id}>{ev.postgraduate}: {ev.title} — {new Date(ev.date).toLocaleDateString("ru-RU")}{ev.daysUntil != null ? ` (через ${ev.daysUntil} дн.)` : ""}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <SimpleTable rows={allAttestations.map((a) => ({ id: a.id, postgraduate: a.owner?.fullName || "—", periodLabel: a.periodLabel, decision: a.decision || "—", attestedAt: a.attestedAt ? new Date(a.attestedAt).toLocaleDateString("ru-RU") : "—", reminder: a.reminder ? "Скоро" : "—" }))} />
        </SectionCard>
      )}

      {tab === "feedback" && (
        <>
          <SectionCard title="Обратная связь">
            <p className="text-xs text-slate-500 mb-4">Отзывы, заключения и рекомендации.</p>
            <div className="grid md:grid-cols-2 gap-3 mb-4 max-w-3xl">
              <select className="rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm" value={feedbackForm.kind} onChange={(e) => setFeedbackForm((st) => ({ ...st, kind: e.target.value }))}>
                <option value="review">Отзыв</option><option value="conclusion">Заключение</option><option value="recommendation">Рекомендация</option>
              </select>
              <input className="rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm" placeholder="Заголовок" value={feedbackForm.title} onChange={(e) => setFeedbackForm((st) => ({ ...st, title: e.target.value }))} />
            </div>
            <textarea rows={5} className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-3 text-sm mb-3" placeholder="Текст" value={feedbackForm.body} onChange={(e) => setFeedbackForm((st) => ({ ...st, body: e.target.value }))} />
            <button type="button" className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-sky-400 text-slate-950" onClick={submitFeedback}>Сохранить и отправить аспиранту</button>
          </SectionCard>
          <SectionCard title="Ранее созданные">
            <SimpleTable rows={feedbackList.map((f) => ({ id: f.id, postgraduate: f.postgraduate?.fullName || "—", kind: FEEDBACK_KIND_LABEL[f.kind] || f.kind, title: f.title, createdAt: f.createdAt ? new Date(f.createdAt).toLocaleDateString("ru-RU") : "—" }))} />
          </SectionCard>
        </>
      )}

      {tab === "notifications" && (
        <SectionCard title="Уведомления">
          <p className="text-xs text-slate-500 mb-4">Новые отчёты, сообщения от аспирантов и деканата.</p>
          <div className="space-y-2">
            {(notifications || []).map((n) => (
              <div key={n.id} className={`rounded-xl px-4 py-3 border text-sm ${n.readAt ? "border-slate-700/50 bg-slate-900/30 text-slate-400" : "border-sky-500/30 bg-sky-950/20 text-sky-100"}`}>
                <p className="font-medium">{n.title || "Уведомление"}</p>
                <p className="text-xs mt-1 opacity-80">{n.body || "—"}</p>
              </div>
            ))}
            {!notifications?.length ? <p className="text-slate-500 text-sm">Уведомлений нет.</p> : null}
          </div>
        </SectionCard>
      )}

      {tab === "plans" && (
      <>
      <SectionCard title="Индивидуальный план работы (ИПР)">
        {!selectedPostgraduateId ? (
          <div className="text-slate-400 text-sm">Выберите аспиранта выше.</div>
        ) : !planForYear ? (
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-6 text-center text-slate-400 text-sm">
            Нет индивидуального плана для выбранного учебного года ({selectedYear}).
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-400">Учебный год:</span>
              <span className="text-slate-100 font-semibold">{planForYear.academicYear}</span>
              <span
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${
                  planForYear.status === "submitted"
                    ? "bg-amber-500/10 text-amber-200 border-amber-500/30"
                    : planForYear.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
                      : planForYear.status === "rejected"
                        ? "bg-rose-500/10 text-rose-200 border-rose-500/30"
                        : "bg-slate-500/10 text-slate-300 border-slate-500/25"
                }`}
              >
                {PLAN_STATUS_LABEL[planForYear.status] || planForYear.status}
              </span>
            </div>

            {planForYear.dissertationTopic ? (
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Тема диссертации (этапы привязаны к плану с этой темой):</span>{" "}
                <span className="text-slate-100 font-medium">{planForYear.dissertationTopic.title}</span>
                <span className="text-slate-500 text-xs ml-2">({planForYear.dissertationTopic.status})</span>
              </div>
            ) : (
              <div className="text-xs text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2">
                К плану не привязана тема диссертации — этапы должны относиться к выбранной теме.
              </div>
            )}

            {planForYear.status === "rejected" && planForYear.rejectReason ? (
              <div className="rounded-xl border border-rose-500/35 bg-rose-950/25 px-4 py-3 text-sm">
                <div className="text-rose-200/90 font-medium text-xs uppercase tracking-wide mb-1">Причина возврата</div>
                <div className="text-slate-100 whitespace-pre-wrap">{planForYear.rejectReason}</div>
              </div>
            ) : null}

            {planForYear.status === "submitted" ? (
              <div className="space-y-3">
                <p className="text-slate-400 text-xs">
                  План отправлен аспирантом на согласование. Утвердите его или верните на доработку с комментарием. Пока статус «На
                  согласовании», вы можете править формулировку темы и поля этапов (см. блок ниже) — аспирант получит уведомление о
                  правках.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-emerald-500 text-slate-950 shadow-[0_8px_24px_rgba(16,185,129,0.25)] hover:brightness-105 transition-all"
                    onClick={() =>
                      updateIndividualPlan(planForYear.id, { status: "approved" }, "План утверждён")
                    }
                  >
                    Утвердить план
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-rose-500/60 bg-rose-950/40 text-rose-100 hover:bg-rose-900/50 transition-all"
                    onClick={() => {
                      setRejectReturnOpen((o) => {
                        const next = !o;
                        if (!next) setRejectReason("");
                        return next;
                      });
                    }}
                  >
                    {rejectReturnOpen ? "Скрыть форму возврата" : "Вернуть на доработку"}
                  </button>
                </div>
                {rejectReturnOpen ? (
                  <div className="rounded-xl border border-slate-600/60 bg-slate-950/40 p-4 space-y-3">
                    <label className="block text-xs font-medium text-slate-400">
                      Комментарий / причина возврата <span className="text-rose-300">*</span>
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 text-slate-100 px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                      placeholder="Опишите, что нужно исправить в плане…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-sky-400/60 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30 transition-all"
                      onClick={() => {
                        const t = rejectReason.trim();
                        if (!t) {
                          toast.error("Укажите причину возврата");
                          return;
                        }
                        updateIndividualPlan(
                          planForYear.id,
                          { status: "rejected", rejectReason: t },
                          "План возвращён на доработку"
                        );
                      }}
                    >
                      Отправить возврат аспиранту
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {planForYear.status !== "submitted" && planForYear.status !== "draft" ? (
              <p className="text-slate-500 text-xs">
                {planForYear.status === "approved"
                  ? "План утверждён. При необходимости изменения согласуются повторно после корректировок со стороны аспиранта."
                  : planForYear.status === "rejected"
                    ? "После доработки аспирант может снова отправить план на согласование."
                    : null}
              </p>
            ) : null}

            {planForYear.status === "draft" ? (
              <p className="text-slate-400 text-sm">
                План ещё в работе у аспиранта (черновик). Согласование станет доступно после отправки.
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      {selectedPostgraduateId &&
      (bundle?.dissertationTopics || []).some((t) => ["draft", "submitted"].includes(t.status)) ? (
        <SectionCard title="Темы диссертации (правки формулировки)">
          <p className="text-slate-400 text-xs mb-4">
            Доступно для тем со статусом «черновик» или «отправлена»: вы можете исправить формулировку до утверждения темы.
          </p>
          <div className="space-y-4">
            {(bundle?.dissertationTopics || [])
              .filter((t) => ["draft", "submitted"].includes(t.status))
              .map((topic) => (
                <div key={topic.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500">Статус темы:</span>
                    <span className="text-sky-200 font-medium">{topic.status}</span>
                  </div>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500"
                    placeholder="Формулировка темы"
                    value={topicDrafts[topic.id] ?? topic.title ?? ""}
                    onChange={(e) => setTopicDrafts((s) => ({ ...s, [topic.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rounded-xl px-4 py-2 text-sm font-semibold border border-sky-400/50 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25 transition-colors"
                    onClick={() => saveTopicEdit(topic.id, topicDrafts[topic.id] ?? topic.title ?? "")}
                  >
                    Сохранить формулировку
                  </button>
                </div>
              ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Индивидуальные маршруты (этапы исследования)">
        <div className="text-slate-400 text-xs mb-3">
          Этапы плана на выбранный учебный год ({selectedYear}
          {planForYear && planForYear.academicYear !== selectedYear ? ` — показан план ${planForYear.academicYear}` : ""}
          ). Статусы этапов: planned → in_progress → done. Статус overdue выставляется автоматически при просрочке.
          {planForYear?.status === "submitted" ? (
            <span className="block mt-2 text-sky-200/90">
              При статусе плана «На согласовании» измените ниже текст этапов и сохраните — аспирант увидит обновление и получит уведомление.
            </span>
          ) : null}
        </div>
        <div className="space-y-3">
          {(planForYear?.items || []).map((it) => (
            <div key={it.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[240px] space-y-2">
                  {planForYear.status === "submitted" ? (
                    <>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">Правки этапа для аспиранта</div>
                      <label className="text-xs text-slate-400">Название</label>
                      <input
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm"
                        value={itemDrafts[it.id]?.title ?? it.title ?? ""}
                        onChange={(e) =>
                          setItemDrafts((s) => ({
                            ...s,
                            [it.id]: {
                              ...(s[it.id] || {
                                title: it.title ?? "",
                                description: it.description ?? "",
                                dueDate: planItemDueInputValue(it.dueDate),
                                notes: it.notes ?? "",
                              }),
                              title: e.target.value,
                            },
                          }))
                        }
                      />
                      <label className="text-xs text-slate-400 pt-1 block">Описание</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500"
                        placeholder="Описание этапа"
                        value={itemDrafts[it.id]?.description ?? it.description ?? ""}
                        onChange={(e) =>
                          setItemDrafts((s) => ({
                            ...s,
                            [it.id]: {
                              ...(s[it.id] || {
                                title: it.title ?? "",
                                description: it.description ?? "",
                                dueDate: planItemDueInputValue(it.dueDate),
                                notes: it.notes ?? "",
                              }),
                              description: e.target.value,
                            },
                          }))
                        }
                      />
                      <label className="text-xs text-slate-400 pt-1 block">Дедлайн</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm"
                        value={itemDrafts[it.id]?.dueDate ?? planItemDueInputValue(it.dueDate)}
                        onChange={(e) =>
                          setItemDrafts((s) => ({
                            ...s,
                            [it.id]: {
                              ...(s[it.id] || {
                                title: it.title ?? "",
                                description: it.description ?? "",
                                dueDate: planItemDueInputValue(it.dueDate),
                                notes: it.notes ?? "",
                              }),
                              dueDate: e.target.value,
                            },
                          }))
                        }
                      />
                      <label className="text-xs text-slate-400 pt-1 block">Примечания</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500"
                        placeholder="Внутренние примечания к этапу"
                        value={itemDrafts[it.id]?.notes ?? it.notes ?? ""}
                        onChange={(e) =>
                          setItemDrafts((s) => ({
                            ...s,
                            [it.id]: {
                              ...(s[it.id] || {
                                title: it.title ?? "",
                                description: it.description ?? "",
                                dueDate: planItemDueInputValue(it.dueDate),
                                notes: it.notes ?? "",
                              }),
                              notes: e.target.value,
                            },
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105 transition-all"
                        onClick={() => savePlanItemEdits(it.id)}
                      >
                        Сохранить правки этапа
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-slate-100 font-semibold">{it.title}</div>
                      {it.description ? <div className="text-slate-400 text-xs mt-1">{it.description}</div> : null}
                      <div className="text-slate-500 text-xs mt-1">
                        Дедлайн: {it.dueDate || "—"} • Завершено: {it.completedAt || "—"}
                      </div>
                    </>
                  )}
                  {Array.isArray(it.files) && it.files.length ? (
                    <button
                      type="button"
                      className="text-sky-200 underline text-xs mt-2 inline-block cursor-pointer bg-transparent border-0 p-0 font-inherit text-left"
                      onClick={() => downloadSupervisorPlanItemReport(it.id, it.files[0])}
                    >
                      Отчёт: {displayUploadFilename(it.files[0].originalName)}
                    </button>
                  ) : (
                    <div className="text-slate-500 text-xs mt-2">Отчёт: —</div>
                  )}
                </div>

                <div className="min-w-[260px] space-y-2">
                  {it.status === "overdue" ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-amber-500/50 bg-amber-950/50 px-3 py-2 text-sm font-semibold text-amber-200">
                        overdue
                      </div>
                      <select
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm"
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) updatePlanItem(it.id, { status: v });
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
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm"
                      value={it.status || "planned"}
                      onChange={(e) => updatePlanItem(it.id, { status: e.target.value })}
                    >
                      <option value="planned">planned</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                    </select>
                  )}
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500"
                    placeholder="Комментарий руководителя"
                    defaultValue={it.supervisorNotes || ""}
                    onBlur={(e) => updatePlanItem(it.id, { supervisorNotes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          {(planForYear?.items || []).length === 0 ? (
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
              Нет этапов в плане на этот период.
            </div>
          ) : null}
        </div>
      </SectionCard>
      </>
      )}


      {tab === "calendar" && (
        <SectionCard title="Календарь ключевых событий">
          <select
            className="w-full max-w-md rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm mb-4"
            value={selectedPostgraduateId}
            onChange={(e) => setSelectedPostgraduateId(e.target.value)}
          >
            {postgraduates.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.fullName}
              </option>
            ))}
          </select>
          <div className="space-y-2">
            {(calendarData.events?.length ? calendarData.events : calendarEvents).map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-950/35 px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-slate-100 font-medium">{ev.title}</p>
                  <p className="text-xs text-slate-500">
                    {ev.postgraduate ? `${ev.postgraduate} · ` : ""}
                    {ev.type}
                  </p>
                </div>
                <span className={`text-sm ${ev.reminder ? "text-amber-300" : "text-sky-200"}`}>
                  {new Date(ev.date).toLocaleDateString("ru-RU")}
                  {ev.reminder && ev.daysUntil != null ? ` · через ${ev.daysUntil} дн.` : ""}
                  {ev.status ? ` · ${ev.status}` : ""}
                </span>
              </div>
            ))}
            {!(calendarData.events?.length || calendarEvents.length) ? (
              <p className="text-slate-500 text-sm">Нет событий на {selectedYear}.</p>
            ) : null}
          </div>
        </SectionCard>
      )}

      {tab === "templates" && (
        <SectionCard title="Шаблоны документов">
          <p className="text-xs text-slate-500 mb-4">
            Типовые формы отзывов, рецензий и отчётов. Файлы можно разместить в общей папке кафедры; здесь — справочник.
          </p>
          <div className="space-y-3">
            {DOC_TEMPLATES.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-4 py-3">
                <p className="text-slate-100 font-medium">{t.title}</p>
                <p className="text-xs text-slate-500 mt-1">{t.note}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
