function normName(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Админ — любая запись; профессор — только свои (по полю teacher). */
export function canManageScheduleRow(user, row) {
  if (!user || !row) return false;
  if (user.role === "admin") return true;
  if (user.role === "professor") {
    const t = normName(row.teacher);
    const me = normName(user.fullName);
    if (!t || !me) return false;
    return t === me;
  }
  return false;
}
