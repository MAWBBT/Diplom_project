/** Подписи столбцов для SimpleTable и похожих таблиц */
export const COLUMN_LABELS = {
  id: "№",
  date: "Дата",
  heldOn: "Дата",
  dueDate: "Срок",
  attestedAt: "Дата аттестации",
  appealDeadline: "Срок апелляции",
  createdAt: "Создано",
  updatedAt: "Обновлено",
  fullName: "ФИО",
  login: "Логин",
  email: "Email",
  phone: "Телефон",
  role: "Роль",
  groupName: "Группа",
  postgraduate: "Аспирант",
  owner: "Аспирант",
  teacher: "Преподаватель",
  subject: "Дисциплина",
  subjectId: "Дисциплина",
  controlType: "Контроль",
  controlForm: "Форма контроля",
  grade: "Оценка",
  comment: "Комментарий",
  note: "Комментарий",
  status: "Статус",
  title: "Название",
  topic: "Тема",
  name: "Название",
  label: "Метка",
  type: "Тип",
  documentType: "Тип документа",
  venue: "Издание / площадка",
  indexing: "Индексирование",
  year: "Год",
  doi: "DOI",
  authors: "Авторы",
  specialty: "Специальность",
  department: "Кафедра",
  semester: "Семестр",
  hours: "Часы",
  notes: "Примечания",
  auditorium: "Аудитория",
  time: "Время",
  dayOfWeek: "День недели",
  risk: "Риск",
  overduePlanItems: "Просрочено этапов",
  hasPlanPendingApproval: "План на согласовании",
  period: "Период",
  periodLabel: "Период",
  decision: "Решение",
  report: "Отчёт",
  files: "Файлы",
  relevance: "Релевантность",
  action: "Действие",
  academicYear: "Учебный год",
  program: "Программа",
  description: "Описание",
  user: "Пользователь",
  entity: "Сущность",
  entityType: "Тип сущности",
  details: "Детали",
  actionType: "Действие",
  isActive: "Активен",
  supervisor: "Руководитель",
  dissertationTopic: "Тема диссертации",
  plan: "План",
  filesCount: "Файлов",
  файлов: "Файлов",
  название: "Название",
  тип: "Тип",
  статус: "Статус",
  план_ИУП: "План ИУП",
  reportType: "Тип отчёта",
  originalName: "Файл",
  generatedBy: "Кто сформировал",
};

export const REPORT_TYPE_LABELS = {
  grades: "Сводная успеваемость",
  attendance: "Сводная посещаемость",
  plans: "Индивидуальные планы",
  attestations: "Результаты аттестаций",
};

/** Значения перечислений в ячейках */
export const ENUM_LABELS = {
  present: "Присутствовал",
  absent: "Отсутствовал",
  late: "Опоздал",
  sick: "Болеет",
  draft: "Черновик",
  submitted: "Подано",
  approved: "Утверждено",
  rejected: "Отклонено",
  returned: "Возвращено",
  in_progress: "В работе",
  inProgress: "В работе",
  pending: "На рассмотрении",
  review: "На проверке",
  on_review: "На проверке",
  overdue: "Просрочено",
  planned: "Запланировано",
  done: "Выполнено",
  archived: "В архиве",
  completed: "Выполнено",
  cancelled: "Отменено",
  active: "Активен",
  inactive: "Неактивен",
  true: "Да",
  false: "Нет",
  postgraduate: "Аспирант",
  professor: "Преподаватель",
  admin: "Администратор",
  program_admin: "Админ программы",
  programAdmin: "Админ программы",
  passed: "Сдано",
  failed: "Не сдано",
  admitted: "Допущен",
  not_admitted: "Не допущен",
};

const CYRILLIC_RE = /[а-яА-ЯёЁ]/;

export function formatColumnLabel(key, customLabels = {}) {
  if (!key) return "";
  if (customLabels[key]) return customLabels[key];
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  if (CYRILLIC_RE.test(key)) return String(key).replace(/_/g, " ");
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTableCell(key, value) {
  if (value == null || value === "") return "";

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  const str = String(value).trim();
  const lower = str.toLowerCase();

  if (key === "reportType") {
    return REPORT_TYPE_LABELS[lower] || str;
  }

  if (key === "status" || key === "статус" || key === "role" || key === "risk") {
    return ENUM_LABELS[lower] || ENUM_LABELS[str] || str;
  }

  if (ENUM_LABELS[lower]) return ENUM_LABELS[lower];

  return str;
}
