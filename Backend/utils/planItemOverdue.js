const { Op } = require('sequelize');

/**
 * «Сегодня» как календарная дата YYYY-MM-DD в заданном часовом поясе (без смешения с UTC-сутками из toISOString()).
 */
function calendarTodayISO() {
  try {
    const timeZone = process.env.APP_CALENDAR_TIMEZONE || 'Europe/Moscow';
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = fmt.formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (!y || !m || !d) throw new Error('incomplete Intl date');
    return `${y}-${m}-${d}`;
  } catch (_e) {
    return new Date().toISOString().slice(0, 10);
  }
}

/** ISO YYYY-MM-DD из значения Sequelize/DATE или строки из API */
function dateOnlyString(val) {
  if (val == null || val === '') return null;
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Помечает этапы как overdue: дедлайн (DATE) строго раньше сегодняшней календарной даты,
 * завершение не указано, статус planned или in_progress.
 */
async function markOverduePlanItems(PlanItem, planIds) {
  if (!planIds?.length) return;
  const today = calendarTodayISO();
  await PlanItem.update(
    { status: 'overdue' },
    {
      where: {
        planId: { [Op.in]: planIds },
        completedAt: null,
        dueDate: { [Op.lt]: today },
        status: { [Op.in]: ['planned', 'in_progress'] }
      }
    }
  );
}

/** Пометить просрочку по всем планам в БД и вернуть число этапов со статусом overdue. */
async function syncAndCountAllOverduePlanItems(PlanItem, IndividualPlan) {
  const plans = await IndividualPlan.findAll({ attributes: ['id'] });
  const planIds = plans.map((p) => p.id);
  await markOverduePlanItems(PlanItem, planIds);
  return PlanItem.count({ where: { status: 'overdue' } });
}

async function syncAndCountOverduePlanItemsForUser(PlanItem, IndividualPlan, userId) {
  const plans = await IndividualPlan.findAll({ where: { userId }, attributes: ['id'] });
  const planIds = plans.map((p) => p.id);
  if (!planIds.length) return 0;
  await markOverduePlanItems(PlanItem, planIds);
  return PlanItem.count({ where: { planId: { [Op.in]: planIds }, status: 'overdue' } });
}

module.exports = {
  markOverduePlanItems,
  calendarTodayISO,
  dateOnlyString,
  syncAndCountAllOverduePlanItems,
  syncAndCountOverduePlanItemsForUser
};
