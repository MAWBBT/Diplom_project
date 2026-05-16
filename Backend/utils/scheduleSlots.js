function scheduleSlotKey(row) {
  const group = (row.user?.groupName || '').trim();
  const dateKey = row.date ? String(row.date).slice(0, 10) : '';
  return [
    row.subjectId,
    dateKey,
    row.dayOfWeek ?? '',
    row.time ?? '',
    (row.teacher || '').trim(),
    (row.auditorium || '').trim(),
    group
  ].join('|');
}

function dedupeScheduleSlots(rows, preferredUserId = null) {
  const byKey = new Map();
  for (const row of rows) {
    const key = scheduleSlotKey(row);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
    } else if (preferredUserId && String(row.userId) === String(preferredUserId)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

module.exports = { scheduleSlotKey, dedupeScheduleSlots };
