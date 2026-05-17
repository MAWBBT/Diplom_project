/** Согласовано с Backend/utils/roles.js — преподаватель объединён с научным руководителем */
export const ROLES = {
  STUDENT: "student",
  SUPERVISOR: "supervisor",
  ADMIN: "admin",
};

const ROLE_TITLES = {
  student: "Аспирант",
  postgraduate: "Аспирант",
  supervisor: "Научный руководитель",
  professor: "Научный руководитель",
  admin: "Администратор",
};

export function normalizeRole(role) {
  if (role === "postgraduate") return ROLES.STUDENT;
  if (role === "professor") return ROLES.SUPERVISOR;
  return role;
}

/** Проверка: роль пользователя входит в список разрешённых (с учётом legacy-алиасов) */
export function roleMatches(userRole, allowedRoles) {
  if (!userRole || !allowedRoles?.length) return false;

  const allowed = new Set();
  for (const r of allowedRoles) {
    allowed.add(r);
    allowed.add(normalizeRole(r));
    if (r === ROLES.STUDENT || r === "postgraduate") {
      allowed.add("postgraduate");
      allowed.add(ROLES.STUDENT);
    }
    if (r === ROLES.SUPERVISOR || r === "professor") {
      allowed.add("professor");
      allowed.add(ROLES.SUPERVISOR);
    }
  }

  const normalized = normalizeRole(userRole);
  return allowed.has(userRole) || allowed.has(normalized);
}

export function isStudent(user) {
  return roleMatches(user?.role, [ROLES.STUDENT]);
}

export function isSupervisor(user) {
  return roleMatches(user?.role, [ROLES.SUPERVISOR]);
}

export function isAdmin(user) {
  return roleMatches(user?.role, [ROLES.ADMIN]);
}

export function isTeachingStaff(user) {
  return isSupervisor(user) || isAdmin(user);
}

export function getRoleTitle(role) {
  return ROLE_TITLES[role] || ROLE_TITLES[normalizeRole(role)] || role || "Пользователь";
}
