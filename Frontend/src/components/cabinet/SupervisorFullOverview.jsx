import SimpleTable from "../SimpleTable";
import CabinetOverviewSection from "./CabinetOverviewSection";
import { CabinetActionButton } from "../CabinetRequirementBlock";

const PLAN_STATUS_RU = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Утверждён",
  rejected: "На доработке",
  archived: "В архиве",
};

const DOC_TEMPLATES = [
  { id: 1, title: "Отзыв научного руководителя", note: "Заключение по диссертации" },
  { id: 2, title: "Рецензия", note: "Форма внешней рецензии" },
  { id: 3, title: "Отчёт о научной работе", note: "Годовой отчёт аспиранта" },
];

export default function SupervisorFullOverview({
  overview,
  homeSummary,
  notifications,
  onOpenTab,
  onSelectPostgraduate,
  onVerifyPublication,
  onUpdateDocument,
}) {
  const students = (overview?.students || []).map((r, idx) => ({
    id: r?.supervision?.id || idx + 1,
    postgraduate: r?.postgraduate?.fullName || "—",
    enrollmentYear: r?.profile?.enrollmentYear || "—",
    groupName: r?.postgraduate?.groupName || "—",
    topic: r?.latestTopic?.title || "—",
    planYear: r?.latestPlanYear || "—",
    planStatus: r?.latestPlanStatus ? PLAN_STATUS_RU[r.latestPlanStatus] || r.latestPlanStatus : "—",
    risk: r?.latestTopic?.status === "approved" ? "В норме" : "Риск",
  }));

  const pendingPlanRows = (overview?.pendingPlans || []).map((p) => ({
    id: p.id,
    postgraduate: p.owner?.fullName || "—",
    academicYear: p.academicYear,
    status: PLAN_STATUS_RU[p.status] || p.status,
    topic: p.dissertationTopic?.title?.slice(0, 80) || "—",
  }));

  const docReviewRows = (overview?.documentsOnReview || []).map((d) => ({
    id: d.id,
    postgraduate: d.owner?.fullName || "—",
    title: d.title,
    documentType: d.documentType,
    status: d.status,
  }));

  const pubPendingRows = (overview?.publicationsPending || []).map((p) => ({
    id: p.id,
    postgraduate: p.author?.fullName || "—",
    title: p.title,
    indexing: p.indexing || "—",
    year: p.year ?? "—",
    status: p.status,
  }));

  const overdueRows = (overview?.overduePlanItems || []).map((it) => ({
    id: it.id,
    postgraduate: it.plan?.owner?.fullName || "—",
    title: it.title,
    dueDate: it.dueDate || "—",
    planYear: it.plan?.academicYear || "—",
  }));

  const gradeRows = (overview?.recentGrades || []).map((g) => ({
    id: g.id,
    postgraduate: g.user?.fullName || "—",
    subject: g.subjectRef?.name || g.subjectId,
    controlType: g.controlType,
    grade: g.grade,
    date: g.createdAt ? new Date(g.createdAt).toLocaleDateString("ru-RU") : "—",
  }));

  const calendarRows = (overview?.upcomingEvents || []).map((ev) => ({
    id: ev.id,
    postgraduate: ev.postgraduate,
    date: ev.date ? new Date(ev.date).toLocaleDateString("ru-RU") : "—",
    title: ev.title,
    type: ev.type,
    status: ev.status,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Аспирантов", value: students.length },
          { label: "Планов на согласовании", value: pendingPlanRows.length },
          { label: "Документов на проверке", value: docReviewRows.length },
          { label: "Непрочит. уведомлений", value: homeSummary?.unreadNotifications ?? "—" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-slate-600/60 bg-slate-900/50 px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{m.label}</p>
            <p className="text-xl font-bold text-sky-100 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <CabinetOverviewSection
        number="1"
        title="Закреплённые аспиранты"
        description="ФИО, год поступления, темы диссертаций"
        footer={<CabinetActionButton onClick={() => onOpenTab("students")}>Полный список</CabinetActionButton>}
      >
        {students.length ? (
          <SimpleTable rows={students} />
        ) : (
          <p className="text-slate-500 text-sm">Нет закреплённых аспирантов.</p>
        )}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="2"
        title="Индивидуальные планы"
        description="Просмотр и согласование"
        footer={<CabinetActionButton onClick={() => onOpenTab("plans")}>Работа с планами</CabinetActionButton>}
      >
        {pendingPlanRows.length ? (
          <SimpleTable rows={pendingPlanRows} />
        ) : (
          <p className="text-slate-500 text-sm">Нет планов, ожидающих согласования.</p>
        )}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="3"
        title="График аттестаций и сроки"
        description="Дедлайны этапов и даты аттестаций"
        footer={<CabinetActionButton onClick={() => onOpenTab("attestations")}>График аттестаций</CabinetActionButton>}
      >
        {overdueRows.length > 0 ? (
          <>
            <p className="text-xs text-amber-200/90 mb-2 font-medium">Просроченные этапы</p>
            <SimpleTable rows={overdueRows} />
          </>
        ) : null}
        <div className={overdueRows.length ? "mt-6" : ""}>
          <p className="text-xs text-slate-400 mb-2">Ближайшие события</p>
          {calendarRows.length ? (
            <SimpleTable rows={calendarRows} />
          ) : (
            <p className="text-slate-500 text-sm">Событий нет.</p>
          )}
        </div>
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="4"
        title="Отчётность аспирантов"
        description="Проверка, подписание, отклонение"
        footer={<CabinetActionButton onClick={() => onOpenTab("reports")}>Вся отчётность</CabinetActionButton>}
      >
        <p className="text-xs font-medium text-slate-400 mb-2">Документы на проверке</p>
        {docReviewRows.length ? (
          <>
            <SimpleTable rows={docReviewRows} />
            <div className="mt-4 space-y-2">
              {overview.documentsOnReview.map((d) => (
                <div key={d.id} className="flex flex-wrap gap-2 items-center text-sm">
                  <span className="text-slate-300">{d.owner?.fullName}: {d.title}</span>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1 text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                    onClick={() => {
                      onSelectPostgraduate?.(d.userId);
                      onUpdateDocument?.(d.id, "approved");
                    }}
                  >
                    Утвердить
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1 text-xs bg-rose-500/20 text-rose-200 border border-rose-500/40"
                    onClick={() => {
                      onSelectPostgraduate?.(d.userId);
                      onUpdateDocument?.(d.id, "rejected");
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-slate-500 text-sm mb-4">Нет документов на проверке.</p>
        )}
        <p className="text-xs font-medium text-slate-400 mb-2 mt-6">Публикации на проверке</p>
        {pubPendingRows.length ? (
          <>
            <SimpleTable rows={pubPendingRows} />
            <div className="mt-4 space-y-2">
              {overview.publicationsPending.map((p) => (
                <div key={p.id} className="flex flex-wrap gap-2 items-center text-sm">
                  <span className="text-slate-300">{p.author?.fullName}: {p.title}</span>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1 text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                    onClick={() => {
                      onSelectPostgraduate?.(p.userId);
                      onVerifyPublication?.(p.id, "verified");
                    }}
                  >
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1 text-xs bg-rose-500/20 text-rose-200 border border-rose-500/40"
                    onClick={() => {
                      onSelectPostgraduate?.(p.userId);
                      onVerifyPublication?.(p.id, "rejected");
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-slate-500 text-sm">Нет публикаций на проверке.</p>
        )}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="5"
        title="Обратная связь"
        description="Отзывы, заключения, рекомендации"
        footer={<CabinetActionButton onClick={() => onOpenTab("feedback")}>Форма обратной связи</CabinetActionButton>}
      >
        <p className="text-sm text-slate-400">
          Непрочитанных сообщений:{" "}
          <span className="text-sky-200 font-semibold">{homeSummary?.unreadMessages ?? 0}</span>
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Создавайте отзывы, заключения и рекомендации в разделе «Обратная связь»; переписка — в «Коммуникации».
        </p>
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="6"
        title="Успеваемость и публикации"
        description="Оценки и научные публикации аспирантов"
        footer={<CabinetActionButton onClick={() => onOpenTab("performance")}>Успеваемость и публикации</CabinetActionButton>}
      >
        {gradeRows.length ? (
          <SimpleTable rows={gradeRows} />
        ) : (
          <p className="text-slate-500 text-sm">Оценок пока нет.</p>
        )}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="7"
        title="Календарь ключевых событий"
        description="Защиты, экзамены, сдача рукописей"
        footer={<CabinetActionButton onClick={() => onOpenTab("calendar")}>Открыть календарь</CabinetActionButton>}
      >
        {calendarRows.length ? <SimpleTable rows={calendarRows} /> : <p className="text-slate-500 text-sm">Событий нет.</p>}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="8"
        title="Уведомления"
        description="Новые отчёты, сообщения от аспирантов и деканата"
        footer={<CabinetActionButton onClick={() => onOpenTab("notifications")}>Все уведомления</CabinetActionButton>}
      >
        <div className="space-y-2">
          {(notifications || []).slice(0, 10).map((n) => (
            <div
              key={n.id}
              className={`rounded-xl px-4 py-3 border text-sm ${
                n.readAt
                  ? "border-slate-700/50 bg-slate-900/30 text-slate-400"
                  : "border-sky-500/30 bg-sky-950/20 text-sky-100"
              }`}
            >
              <p className="font-medium">{n.title || "Уведомление"}</p>
              <p className="text-xs mt-1 opacity-80">{n.body || n.text || "—"}</p>
            </div>
          ))}
          {!notifications?.length ? <p className="text-slate-500 text-sm">Уведомлений нет.</p> : null}
        </div>
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="9"
        title="Шаблоны документов"
        description="Отзывы, рецензии, отчёты о работе"
        footer={<CabinetActionButton onClick={() => onOpenTab("templates")}>Раздел шаблонов</CabinetActionButton>}
      >
        <div className="space-y-3">
          {DOC_TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-4 py-3">
              <p className="text-slate-100 font-medium">{t.title}</p>
              <p className="text-xs text-slate-500 mt-1">{t.note}</p>
            </div>
          ))}
        </div>
      </CabinetOverviewSection>
    </div>
  );
}
