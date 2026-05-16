import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import { downloadWithAuth } from "../api/downloadWithAuth";
import { displayUploadFilename } from "../utils/uploadFilename";
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

export default function SupervisorPage() {
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

  useEffect(() => {
    setRejectReturnOpen(false);
    setRejectReason("");
  }, [selectedYear, selectedPostgraduateId]);

  const load = async () => {
    try {
      const data = (await api.get("/supervisor/supervisions")).data;
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

  const riskRows = rows.map((r, idx) => ({
    id: r?.supervision?.id || idx + 1,
    postgraduate: r?.postgraduate?.fullName || "—",
    groupName: r?.postgraduate?.groupName || "—",
    topic: r?.latestTopic?.title || "—",
    risk: r?.latestTopic?.status === "approved" ? "В норме" : "Риск",
  }));

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

  return (
    <div className="space-y-6">
      <SectionCard title="Кабинет научного руководителя">
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
            className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center" 
            onClick={bulkApprove}
          >
            Подтвердить отчеты группы
          </button>
          <button 
            className="w-full rounded-xl px-5 py-2.5 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors" 
            onClick={load}
          >
            Обновить данные
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Список ведомых и мониторинг рисков">
        <SimpleTable rows={riskRows} />
      </SectionCard>

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
    </div>
  );
}
