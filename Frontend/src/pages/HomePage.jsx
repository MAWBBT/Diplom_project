import { useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";

export default function HomePage() {
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "postgraduate") {
      setDashboard(null);
      setNotifications([]);
      setLoadError("");
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [d, n] = await Promise.all([
          api.get("/postgraduate/dashboard"),
          api.get("/notifications"),
        ]);
        if (!cancelled) {
          setDashboard(d.data);
          setNotifications(n.data || []);
        }
      } catch (e) {
        if (!cancelled) setLoadError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const timeline = useMemo(() => {
    if (!dashboard) return [];
    const milestones = (dashboard.milestones || []).map((m) => ({
      date: m.dueDate || m.createdAt,
      title: m.title,
      type: "Веха",
      status: m.status,
    }));
    const attest = (dashboard.attestations || []).map((a) => ({
      date: a.attestedAt || a.createdAt,
      title: a.decision || a.periodLabel,
      type: "Аттестация",
      status: "done",
    }));
    return [...milestones, ...attest]
      .filter((x) => x.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 8);
  }, [dashboard]);

  const planProgress = useMemo(() => {
    const plans = dashboard?.individualPlans || [];
    const items = plans.flatMap((p) => p.items || []);
    if (!items.length) return 0;
    const done = items.filter((i) => !!i.completedAt).length;
    return Math.round((done / items.length) * 100);
  }, [dashboard]);

  return (
    <div className="space-y-6">
      {user?.role === "postgraduate" && (
        <>
          {loading && <p className="text-slate-400 text-sm">Загрузка дашборда…</p>}
          {loadError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-rose-100 text-sm">
              {loadError}
            </div>
          )}
          <SectionCard title="Персональный дашборд">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Metric title="Прогресс ИУП" value={`${planProgress}%`} />
              <Metric title="Публикации" value={(dashboard?.publications || []).length} />
              <Metric title="Документы" value={(dashboard?.documents || []).length} />
              <Metric title="Уведомления" value={notifications.length} />
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 relative overflow-hidden"
                style={{ width: `${planProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Процент выполнения индивидуального плана</p>
          </SectionCard>

          <SectionCard title="Персональный таймлайн">
            <div className="space-y-3">
              {timeline.length ? (
                timeline.map((item, idx) => (
                  <div key={`${item.title}-${idx}`} className="bg-slate-900/40 border border-slate-700/60 rounded-xl px-4 py-3 flex justify-between items-center hover:bg-slate-800/40 transition-colors">
                    <div>
                      <p className="text-slate-100 font-medium">{item.title}</p>
                      <p className="text-xs text-slate-400 uppercase tracking-widest mt-0.5">{item.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-sky-100">{new Date(item.date).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">{item.status}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">Нет данных по вехам.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Блок «Важное»">
            <div className="space-y-3">
              {(notifications || []).slice(0, 6).map((n) => (
                <div key={n.id} className="bg-amber-950/20 border border-amber-900/40 rounded-xl px-4 py-3">
                  <p className="text-amber-100 font-medium text-sm">{n.title || "Уведомление"}</p>
                  <p className="text-amber-200/60 text-xs mt-1">{n.body || n.text || "-"}</p>
                </div>
              ))}
              {!notifications.length && <p className="text-slate-400">Важных уведомлений пока нет.</p>}
            </div>
          </SectionCard>
        </>
      )}

      <SectionCard title="О платформе">
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-3">
            <p className="text-slate-300 leading-relaxed max-w-4xl text-[15px]">
              Современный портал аспирантуры с единым интерфейсом для аспирантов, профессоров и администраторов.
              Быстрый доступ к учебным процессам, оценкам, коммуникациям и сопровождению научной работы.
            </p>
          </div>
          <Feature title="Безопасный доступ" text="Валидация, лимиты запросов JWT и разграничение ролей." />
          <Feature title="Единая экосистема" text="Расписание, журнал, сообщения и уведомления в одном месте." />
          <Feature title="Управление процессом" text="Инструменты для научного руководства и администрирования." />
        </div>
      </SectionCard>

      <SectionCard title="Что доступно сейчас">
        <ul className="grid sm:grid-cols-2 gap-3 text-slate-300">
          <li className="rounded-xl bg-slate-900/50 px-4 py-3 border border-slate-700/60 hover:border-sky-500/40 transition-colors flex items-center gap-3">
             <span className="w-2 h-2 rounded-full bg-sky-400"></span> Личный кабинет и редактирование профиля
          </li>
          <li className="rounded-xl bg-slate-900/50 px-4 py-3 border border-slate-700/60 hover:border-sky-500/40 transition-colors flex items-center gap-3">
             <span className="w-2 h-2 rounded-full bg-sky-400"></span> Просмотр расписания и оценок
          </li>
          <li className="rounded-xl bg-slate-900/50 px-4 py-3 border border-slate-700/60 hover:border-sky-500/40 transition-colors flex items-center gap-3">
             <span className="w-2 h-2 rounded-full bg-sky-400"></span> Чаты между преподавателем и аспирантом
          </li>
          <li className="rounded-xl bg-slate-900/50 px-4 py-3 border border-slate-700/60 hover:border-sky-500/40 transition-colors flex items-center gap-3">
             <span className="w-2 h-2 rounded-full bg-sky-400"></span> Ролевые кабинеты и администрирование
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

function Feature({ title, text }) {
  return (
    <article className="rounded-xl border border-slate-700/60 bg-gradient-to-b from-slate-800/40 to-slate-900/40 p-5 hover:border-sky-500/45 hover:-translate-y-1 transition-all duration-300 shadow-lg">
      <h3 className="text-slate-100 font-bold mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
    </article>
  );
}

function Metric({ title, value }) {
  return (
    <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70 hover:border-sky-400/50 transition-colors">
      <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">{title}</p>
      <p className="text-2xl font-black text-sky-100 mt-1 drop-shadow-md">{value ?? 0}</p>
    </div>
  );
}
