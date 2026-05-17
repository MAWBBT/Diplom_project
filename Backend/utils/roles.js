/** Канонические роли системы (преподаватель = научный руководитель) */
const ROLES = Object.freeze({
  STUDENT: 'student',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin'
});

const LEGACY_ALIASES = Object.freeze({
  postgraduate: ROLES.STUDENT,
  professor: ROLES.SUPERVISOR
});

const ALL_ROLES = Object.freeze([ROLES.STUDENT, ROLES.SUPERVISOR, ROLES.ADMIN]);

const { Op } = require('sequelize');

function normalizeRole(role) {
  if (!role) return role;
  return LEGACY_ALIASES[role] || role;
}

function expandRoles(roles) {
  const out = new Set();
  for (const r of roles) {
    out.add(r);
    if (r === ROLES.STUDENT) out.add('postgraduate');
    if (r === 'postgraduate') out.add(ROLES.STUDENT);
    if (r === ROLES.SUPERVISOR) out.add('professor');
    if (r === 'professor') out.add(ROLES.SUPERVISOR);
  }
  return [...out];
}

function hasRole(user, ...roles) {
  if (!user?.role) return false;
  const allowed = expandRoles(roles);
  return allowed.includes(user.role);
}

function getRoleTitle(role) {
  const r = normalizeRole(role);
  const map = {
    [ROLES.ADMIN]: 'Администратор',
    [ROLES.SUPERVISOR]: 'Научный руководитель',
    [ROLES.STUDENT]: 'Аспирант'
  };
  return map[r] || role || 'Пользователь';
}

function studentRoleWhere() {
  return { role: { [Op.in]: [ROLES.STUDENT, 'postgraduate'] } };
}

function supervisorRoleWhere() {
  return { role: { [Op.in]: [ROLES.SUPERVISOR, 'professor'] } };
}

module.exports = {
  ROLES,
  ALL_ROLES,
  LEGACY_ALIASES,
  normalizeRole,
  expandRoles,
  hasRole,
  getRoleTitle,
  studentRoleWhere,
  supervisorRoleWhere
};
