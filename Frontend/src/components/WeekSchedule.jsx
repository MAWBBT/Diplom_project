/** Понедельник календарной недели, в которой лежит `date` (локальная дата). */
export function mondayOfCalendarWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Парсинг YYYY-MM-DD в локальную полночь (без сдвига из-за UTC). */
export function parseDateOnlyLocal(iso) {
  if (!iso) return null;
  const s = String(iso).trim().split("T")[0];
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const da = parseInt(m[3], 10);
  return new Date(y, mo, da);
}

function isoDateOnly(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const RU_WEEKDAY_TO_INDEX = {
  Понедельник: 0,
  Вторник: 1,
  Среда: 2,
  Четверг: 3,
  Пятница: 4,
  Суббота: 5,
  Воскресенье: 6,
};

const COLUMN_ACCENTS = [
  "border-l-sky-400/90",
  "border-l-emerald-400/85",
  "border-l-amber-400/85",
  "border-l-fuchsia-400/80",
  "border-l-indigo-400/85",
];

function parseTimeToMinutes(value) {
  if (!value) return 0;
  const s = String(value).trim();
  const m = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!m) return 0;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + mm;
}

/** Индекс колонки пн–пт (0..4) или null, если не учебный день. */
function getWeekdayColumnIndex(row) {
  if (row?.date) {
    const d = parseDateOnlyLocal(row.date);
    if (!d || Number.isNaN(d.getTime())) return null;
    const js = d.getDay();
    const idx = js === 0 ? 6 : js - 1;
    return idx >= 0 && idx <= 4 ? idx : null;
  }
  if (typeof row?.dayOfWeek === "string" && RU_WEEKDAY_TO_INDEX[row.dayOfWeek] !== undefined) {
    const idx = RU_WEEKDAY_TO_INDEX[row.dayOfWeek];
    return idx <= 4 ? idx : null;
  }
  const n = parseInt(row?.dayOfWeek, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n - 1;
  return null;
}

export default function WeekSchedule({ rows, weekStart }) {
  const monday = mondayOfCalendarWeek(weekStart);
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const weekEndExclusive = addDays(monday, 5);

  const inWeekRows = (rows || []).filter((r) => {
    if (r?.date) {
      const d = parseDateOnlyLocal(r.date);
      if (!d || Number.isNaN(d.getTime())) return false;
      return d >= monday && d < weekEndExclusive;
    }
    return true;
  });

  const byDay = Array.from({ length: 5 }, () => []);
  for (const r of inWeekRows) {
    const idx = getWeekdayColumnIndex(r);
    if (idx == null) continue;
    byDay[idx].push(r);
  }
  for (const list of byDay) {
    list.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-950/80 via-slate-900/40 to-slate-950/60 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-3 lg:gap-4">
          {days.map((d, idx) => (
            <div
              key={isoDateOnly(d)}
              className="group/col flex flex-col rounded-2xl border border-slate-700/55 bg-slate-950/50 overflow-hidden shadow-[0_12px_40px_rgba(2,6,23,0.45)] ring-1 ring-white/[0.03]"
            >
              <div
                className={`relative px-3.5 py-3 border-b border-slate-800/90 bg-gradient-to-br from-slate-800/95 to-slate-900/90 border-l-4 ${COLUMN_ACCENTS[idx]}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {d.toLocaleDateString("ru-RU", { weekday: "short" })}
                </div>
                <div className="mt-0.5 text-base font-bold text-slate-50 leading-tight">
                  {d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 capitalize">
                  {d.toLocaleDateString("ru-RU", { weekday: "long" })}
                </div>
              </div>
              <div className="p-3 space-y-2.5 flex-1 min-h-[168px] bg-slate-950/30">
                {byDay[idx].length === 0 ? (
                  <div className="h-full min-h-[120px] flex items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-900/20">
                    <span className="text-slate-500 text-sm text-center px-2">Нет занятий</span>
                  </div>
                ) : null}
                {byDay[idx].map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-700/60 bg-gradient-to-b from-slate-900/90 to-slate-950/90 px-3 py-2.5 shadow-md hover:border-sky-500/35 hover:shadow-[0_8px_28px_rgba(14,165,233,0.12)] transition-all duration-200 hover:-translate-y-px"
                  >
                    <div className="flex justify-end mb-1.5">
                      <div className="inline-flex rounded-lg bg-sky-500/15 border border-sky-400/25 px-2.5 py-1 text-[11px] font-bold text-sky-200 tabular-nums tracking-tight">
                        {r.time || "—"}
                      </div>
                    </div>
                    <div className="text-slate-100 font-semibold text-[13px] leading-snug">
                      {r.subjectRef?.name || `subjectId=${r.subjectId}`}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-2 leading-relaxed space-y-0.5">
                      {r.teacher ? <div>Преподаватель: {r.teacher}</div> : null}
                      {r.auditorium ? <div>Аудитория: {r.auditorium}</div> : null}
                      {r.user?.groupName ? <div className="text-slate-500">Группа: {r.user.groupName}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-slate-500">
        Учебная неделя: понедельник — пятница. Даты в календаре вашего браузера (локально).
      </p>
    </div>
  );
}
