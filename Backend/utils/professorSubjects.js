const { Op } = require('sequelize');
const { Schedule } = require('../models');
const { normName } = require('./scheduleAccess');

/** subjectId из расписания, где преподаватель указан в teacher. */
async function getProfessorSubjectIds(user) {
  if (!user || user.role !== 'professor') return [];
  const me = normName(user.fullName);
  if (!me) return [];

  const rows = await Schedule.findAll({
    attributes: ['subjectId', 'teacher'],
    where: { subjectId: { [Op.ne]: null } }
  });

  const ids = new Set();
  for (const row of rows) {
    if (row.subjectId && normName(row.teacher) === me) {
      ids.add(row.subjectId);
    }
  }
  return [...ids];
}

async function professorTeachesSubject(user, subjectId) {
  if (!user || user.role !== 'professor') return false;
  const sid = parseInt(subjectId, 10);
  if (!sid) return false;
  const allowed = await getProfessorSubjectIds(user);
  return allowed.includes(sid);
}

function scheduleBelongsToProfessor(schedule, user) {
  if (!schedule || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'professor') return false;
  return normName(schedule.teacher) === normName(user.fullName);
}

module.exports = {
  getProfessorSubjectIds,
  professorTeachesSubject,
  scheduleBelongsToProfessor
};
