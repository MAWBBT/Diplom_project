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

const ITEM_STATUS_RU = {
  planned: "Запланирован",
  in_progress: "В работе",
  done: "Выполнен",
  overdue: "Просрочен",
};

export default function PostgraduateFullOverview({
  user,
  data,
  grades,
  notifications,
  dissertationTitle,
  supervisor,
  selectedPlan,
  planProgress,
  planItemsSummary,
  examRows,
  publications,
  onOpenTab,
}) {
  const profile = data?.profile;
  const planItems = (selectedPlan?.items || []).map((it) => ({
    id: it.id,
    title: it.title,
    dueDate: it.dueDate || "—",
    status: ITEM_STATUS_RU[it.status] || it.status,
    completedAt: it.completedAt ? new Date(it.completedAt).toLocaleDateString("ru-RU") : "—",
  }));

  const gradeRows = (grades || []).map((g) => ({
    id: g.id,
    subject: g.subjectRef?.name || g.subjectId,
    controlType: g.controlType,
    grade: g.grade,
    comment: g.comment || "—",
    date: g.createdAt ? new Date(g.createdAt).toLocaleDateString("ru-RU") : "—",
  }));

  const pubRows = (publications || []).map((p) => ({
    id: p.id,
    title: p.title,
    venue: p.venue || "—",
    year: p.year ?? "—",
    indexing: p.indexing || "—",
    doi: p.doi || "—",
    status: p.status,
  }));

  const docRows = (data?.documents || []).map((d) => ({
    id: d.id,
    title: d.title,
    documentType: d.documentType,
    status: d.status,
    plan: d.individualPlan?.academicYear || "—",
    files: Array.isArray(d.files) ? d.files.length : 0,
  }));

  const topicRows = (data?.dissertationTopics || []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
  }));

  return (
    <div className="space-y-6">
      <CabinetOverviewSection
        number="1"
        title="Личные данные"
        description="ФИО, контакты, сведения о программе, тема диссертации"
        footer={<CabinetActionButton to="/profile">Редактировать профиль</CabinetActionButton>}
      >
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-sky-500/25 to-sky-600/10 border border-sky-400/30 grid place-items-center text-2xl font-bold text-sky-100 shrink-0">
            {(user?.fullName || "?").trim().slice(0, 1).toUpperCase()}
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm flex-1">
            <p>
              <span className="text-slate-500">ФИО:</span> <span className="text-slate-100">{user?.fullName || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Логин:</span> <span className="text-slate-100">{user?.login || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Email:</span> <span className="text-slate-100">{user?.email || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Телефон:</span> <span className="text-slate-100">{user?.phone || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Группа:</span> <span className="text-slate-100">{user?.groupName || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Год поступления:</span>{" "}
              <span className="text-slate-100">{profile?.enrollmentYear || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Кафедра:</span> <span className="text-slate-100">{profile?.department || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Специальность:</span>{" "}
              <span className="text-slate-100">{profile?.specialtyCode || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Форма обучения:</span>{" "}
              <span className="text-slate-100">{profile?.studyForm || "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Программа:</span>{" "}
              <span className="text-slate-100">{profile?.program?.name || "—"}</span>
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-500">Тема диссертации:</span>{" "}
              <span className="text-slate-100 font-medium">{dissertationTitle}</span>
            </p>
          </div>
        </div>
        {topicRows.length > 1 ? (
          <div className="mt-6">
            <p className="text-xs font-medium text-slate-400 mb-2">Все формулировки тем</p>
            <SimpleTable rows={topicRows} />
          </div>
        ) : null}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="2"
        title="Индивидуальный план работы"
        description="Этапы, сроки, отметки о выполнении"
        footer={<CabinetActionButton onClick={() => onOpenTab("iup")}>Управление планом</CabinetActionButton>}
      >
        <div className="mb-5">
          <div className="flex flex-wrap justify-between gap-2 text-sm mb-2">
            <span className="text-slate-400">
              План:{" "}
              <span className="text-slate-100 font-medium">
                {selectedPlan
                  ? `${selectedPlan.academicYear} · ${PLAN_STATUS_RU[selectedPlan.status] || selectedPlan.status}`
                  : "не выбран"}
              </span>
            </span>
            <span className="text-sky-200 font-semibold">{planProgress}% выполнено</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${planProgress}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Этапов: {planItemsSummary.total}
            {planItemsSummary.overdue ? ` · просрочено: ${planItemsSummary.overdue}` : ""}
          </p>
        </div>
        {planItems.length ? (
          <SimpleTable rows={planItems} />
        ) : (
          <p className="text-slate-500 text-sm">Этапы не добавлены — перейдите в раздел «План работы».</p>
        )}
      </CabinetOverviewSection>

      <CabinetOverviewSection number="3" title="Научный руководитель" description="ФИО и контакты">
        {supervisor ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <p>
              <span className="text-slate-500">ФИО:</span> {supervisor.fullName || supervisor.login}
            </p>
            <p>
              <span className="text-slate-500">Email:</span> {supervisor.email || "—"}
            </p>
            <p>
              <span className="text-slate-500">Логин:</span> {supervisor.login || "—"}
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Руководитель не закреплён — обратитесь в деканат.</p>
        )}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="4"
        title="Сведения об учёбе"
        description="Оценки по дисциплинам, зачёты"
        footer={
          <>
            <CabinetActionButton to="/grades">Вся успеваемость</CabinetActionButton>
            <CabinetActionButton to="/study">Расписание и учёба</CabinetActionButton>
          </>
        }
      >
        {gradeRows.length ? (
          <SimpleTable rows={gradeRows} />
        ) : (
          <p className="text-slate-500 text-sm">Оценок пока нет.</p>
        )}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="5"
        title="График и отчёты по аттестациям"
        description="Кандидатские экзамены, этапы диссертации"
        footer={<CabinetActionButton onClick={() => onOpenTab("exams")}>Подробнее об аттестациях</CabinetActionButton>}
      >
        {examRows?.length ? <SimpleTable rows={examRows} /> : <p className="text-slate-500 text-sm">Записей нет.</p>}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="6"
        title="Публикации и апробации"
        description="Статьи, тезисы, доклады; РИНЦ / Scopus"
        footer={<CabinetActionButton onClick={() => onOpenTab("pubs")}>Добавить публикацию</CabinetActionButton>}
      >
        {pubRows.length ? <SimpleTable rows={pubRows} /> : <p className="text-slate-500 text-sm">Публикаций нет.</p>}
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="7"
        title="Уведомления и новости"
        description="Конференции, стипендии, дедлайны"
        footer={
          <CabinetActionButton to="/communications" variant="primary">
            Все уведомления
          </CabinetActionButton>
        }
      >
        <div className="space-y-2">
          {(notifications || []).slice(0, 12).map((n) => (
            <div
              key={n.id}
              className={`rounded-xl px-4 py-3 border text-sm ${
                n.readAt
                  ? "border-slate-700/50 bg-slate-900/30 text-slate-400"
                  : "border-amber-500/30 bg-amber-950/20 text-amber-100"
              }`}
            >
              <p className="font-medium">{n.title || "Уведомление"}</p>
              <p className="text-xs mt-1 opacity-80">{n.body || n.text || "—"}</p>
              {n.createdAt ? (
                <p className="text-[11px] mt-2 opacity-60">{new Date(n.createdAt).toLocaleString("ru-RU")}</p>
              ) : null}
            </div>
          ))}
          {!notifications?.length ? <p className="text-slate-500 text-sm">Уведомлений нет.</p> : null}
        </div>
      </CabinetOverviewSection>

      <CabinetOverviewSection
        number="8"
        title="Загрузка документов"
        description="Скан-копии статей, отчётов, рецензий"
        footer={<CabinetActionButton onClick={() => onOpenTab("docs")}>Документооборот</CabinetActionButton>}
      >
        {docRows.length ? <SimpleTable rows={docRows} /> : <p className="text-slate-500 text-sm">Документов нет.</p>}
      </CabinetOverviewSection>
    </div>
  );
}
