/**
 * Пересоздаёт занятия расписания на текущую календарную неделю (пн–пт)
 * для всех пользователей с ролью postgraduate — без полного init-db.
 *
 * Запуск из каталога Backend: node scripts/refresh-schedules.js
 */
require('dotenv').config();
const { Op } = require('sequelize');
const db = require('../models');
db.sequelize.options.logging = false;

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/** YYYY-MM-DD по локальному календарю (не UTC — иначе пятница уезжает на четверг в UTC+). */
function localYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const postgraduateActivities = [
  { title: 'Научно-исследовательский семинар', format: 'семинар', professorIndex: 0 },
  { title: 'Методологический семинар по диссертации', format: 'семинар', professorIndex: 1 },
  { title: 'Консультация с научным руководителем', format: 'консультация', professorIndex: 0 },
  { title: 'Академическое письмо и публикационная стратегия', format: 'практикум', professorIndex: 2 },
  { title: 'Анализ данных для диссертационного исследования', format: 'лабораторная', professorIndex: 3 },
  { title: 'Проектный коллоквиум кафедры', format: 'коллоквиум', professorIndex: 4 },
  { title: 'Подготовка к кандидатскому экзамену', format: 'подготовка', professorIndex: 5 },
  { title: 'Научный воркшоп по теме исследования', format: 'воркшоп', professorIndex: 2 }
];

const weekDays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
const pairTimes = ['09:00 – 10:35', '10:45 – 12:20', '12:40 – 14:15', '14:25 – 16:00'];
const dayPairCounts = [4, 3, 4, 3, 4];

const auditoriumsByGroup = {
  'Аспирантура 2024-1': ['Лаб. 304', 'Ауд. 210', 'Науч. зал 112', 'Коллоквиум 405'],
  'Аспирантура 2024-2': ['Лаб. 305', 'Ауд. 211', 'Науч. зал 113', 'Коллоквиум 406'],
  'Аспирантура 2024-3': ['Лаб. 306', 'Ауд. 212', 'Науч. зал 114', 'Коллоквиум 407']
};

async function main() {
  await db.sequelize.authenticate();
  console.log('📅 Обновление расписания на текущую неделю…');

  const professors = await db.User.findAll({
    where: { role: 'professor' },
    order: [['id', 'ASC']]
  });
  const postgraduates = await db.User.findAll({
    where: { role: 'postgraduate' },
    order: [['id', 'ASC']]
  });

  if (!postgraduates.length) {
    console.error('В БД нет аспирантов. Выполните: npm run init-db');
    process.exit(1);
  }
  if (!professors.length) {
    console.error('В БД нет преподавателей. Выполните: npm run init-db');
    process.exit(1);
  }

  const pgIds = postgraduates.map((u) => u.id);
  const removed = await db.Schedule.destroy({ where: { userId: { [Op.in]: pgIds } } });
  console.log(`   Удалено старых записей расписания (аспиранты): ${removed}`);

  const today = new Date();
  const mondayRaw = getMonday(today);
  const monday = new Date(mondayRaw.getFullYear(), mondayRaw.getMonth(), mondayRaw.getDate());

  const weekDates = weekDays.map((_, index) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    return localYmd(d);
  });

  const schedules = [];

  const createGroupSchedule = async (groupPostgraduates, groupName) => {
    let activityCursor = 0;
    for (let dayIndex = 0; dayIndex < weekDays.length; dayIndex += 1) {
      const dayOfWeek = weekDays[dayIndex];
      const date = weekDates[dayIndex];
      const pairsForDay = dayPairCounts[dayIndex];

      for (let pairIndex = 0; pairIndex < pairsForDay; pairIndex += 1) {
        const meta = postgraduateActivities[activityCursor % postgraduateActivities.length];
        activityCursor += 1;
        const professor = professors[meta.professorIndex % professors.length];
        const time = pairTimes[pairIndex];
        const auditorium = (auditoriumsByGroup[groupName] || [])[pairIndex] || 'Ауд. 101';

        for (const pg of groupPostgraduates) {
          const subjectName = `${meta.title} (${meta.format})`;
          // eslint-disable-next-line no-await-in-loop
          const [subjectRow] = await db.Subject.findOrCreate({
            where: { name: subjectName },
            defaults: { name: subjectName }
          });
          schedules.push(
            db.Schedule.create({
              userId: pg.id,
              dayOfWeek,
              time,
              subjectId: subjectRow.id,
              teacher: professor.fullName,
              auditorium,
              date
            })
          );
        }
      }
    }
  };

  const group1 = postgraduates.filter((s) => s.groupName === 'Аспирантура 2024-1');
  const group2 = postgraduates.filter((s) => s.groupName === 'Аспирантура 2024-2');
  const group3 = postgraduates.filter((s) => s.groupName === 'Аспирантура 2024-3');
  const grouped = group1.length + group2.length + group3.length;

  if (grouped > 0) {
    if (group1.length) await createGroupSchedule(group1, 'Аспирантура 2024-1');
    if (group2.length) await createGroupSchedule(group2, 'Аспирантура 2024-2');
    if (group3.length) await createGroupSchedule(group3, 'Аспирантура 2024-3');
  } else {
    await createGroupSchedule(postgraduates, 'Аспирантура 2024-1');
  }

  const created = await Promise.all(schedules);
  console.log(`✅ Создано занятий: ${created.length}`);
  console.log(`   Неделя с ${weekDates[0]} по ${weekDates[4]} (пн–пт)`);
  await db.sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
