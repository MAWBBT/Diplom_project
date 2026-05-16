function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Админ — любая запись; профессор — только где teacher совпадает с ФИО пользователя. */
function canManageScheduleRow(user, row) {
  if (!user || !row) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'professor') {
    const t = normName(row.teacher);
    const me = normName(user.fullName);
    if (!t || !me) return false;
    return t === me;
  }
  return false;
}

module.exports = { normName, canManageScheduleRow };
