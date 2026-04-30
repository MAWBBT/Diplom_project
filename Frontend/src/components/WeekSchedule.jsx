function parseTimeToMinutes(value) {
  if (!value) return 0;
  const s = String(value).trim();
  const m = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!m) return 0;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + mm;
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDateOnly(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayLabel(date) {
  return date.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function getDayIndexFromSchedule(row) {
  if (row?.date) {
    const d = new Date(row.date);
    const js = d.getDay(); // 0..6
    return js === 0 ? 6 : js - 1; // Mon=0..Sun=6
  }
  const n = parseInt(row?.dayOfWeek, 10);
  if (!Number.isFinite(n)) return null;
  // accept 1..7 (Mon..Sun)
  if (n >= 1 && n <= 7) return n - 1;
  return null;
}

export default function WeekSchedule({ rows, weekStart }) {
  const ws = startOfWeek(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const inWeekRows = (rows || []).filter((r) => {
    if (r?.date) {
      const d = new Date(r.date);
      return d >= ws && d < addDays(ws, 7);
    }
    // recurring: always show by dayOfWeek
    return true;
  });

  const byDay = Array.from({ length: 7 }, () => []);
  for (const r of inWeekRows) {
    const idx = getDayIndexFromSchedule(r);
    if (idx == null) continue;
    byDay[idx].push(r);
  }
  for (const list of byDay) {
    list.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {days.map((d, idx) => (
        <div key={isoDateOnly(d)} className="rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-900/70 text-xs uppercase tracking-wider text-slate-300 font-semibold">
            {dayLabel(d)}
          </div>
          <div className="p-3 space-y-2 min-h-[140px]">
            {byDay[idx].length === 0 ? (
              <div className="text-slate-500 text-sm">Нет занятий</div>
            ) : null}
            {byDay[idx].map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-700/70 bg-slate-900/50 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-slate-100 font-semibold text-sm">
                    {r.subjectRef?.name || `subjectId=${r.subjectId}`}
                  </div>
                  <div className="text-sky-200 text-xs font-semibold">{r.time || "—"}</div>
                </div>
                <div className="text-slate-400 text-xs mt-1">
                  {r.teacher ? `Преп.: ${r.teacher}` : null}
                  {r.teacher && r.auditorium ? " • " : null}
                  {r.auditorium ? `Ауд.: ${r.auditorium}` : null}
                </div>
                <div className="text-slate-500 text-[11px] mt-1">
                  {r.user?.groupName ? `Группа: ${r.user.groupName}` : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

