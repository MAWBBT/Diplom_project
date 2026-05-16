/** Русские подписи значений в Excel-отчётах */
const LABELS = {
  present: 'Присутствовал',
  absent: 'Отсутствовал',
  late: 'Опоздал',
  sick: 'Болеет',
  draft: 'Черновик',
  submitted: 'Подано',
  approved: 'Утверждено',
  rejected: 'Отклонено',
  archived: 'В архиве',
  planned: 'Запланировано',
  in_progress: 'В работе',
  done: 'Выполнено',
  overdue: 'Просрочено'
};

function labelEnum(value) {
  if (value == null || value === '') return '';
  const key = String(value).trim().toLowerCase();
  return LABELS[key] || String(value);
}

function formatPeriodMeta({ dateFrom, dateTo, academicYear }) {
  if (academicYear) return `Учебный год: ${academicYear}`;
  const from = dateFrom || 'не задано';
  const to = dateTo || 'не задано';
  return `Период: с ${from} по ${to}`;
}

module.exports = { labelEnum, formatPeriodMeta, LABELS };
