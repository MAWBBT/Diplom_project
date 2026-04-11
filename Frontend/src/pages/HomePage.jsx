import { useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

export default function HomePage({ user }) {
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
    <div className="space-y-4">
      {user?.role === "postgraduate" && (
        <>
          {loading && <p className="muted text-sm">Загрузка дашборда…</p>}
          {loadError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-rose-100 text-sm">
              {loadError}
            </div>
          )}
          <SectionCard title="Персональный дашборд">
            <div className="stat-grid mb-4">
              <Metric title="Прогресс ИУП" value={`${planProgress}%`} />
              <Metric title="Публикации" value={(dashboard?.publications || []).length} />
              <Metric title="Документы" value={(dashboard?.documents || []).length} />
              <Metric title="Уведомления" value={notifications.length} />
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-300"
                style={{ width: `${planProgress}%` }}
              />
            </div>
            <p className="text-xs muted mt-2">Процент выполнения индивидуального плана</p>
          </SectionCard>

          <SectionCard title="Персональный таймлайн">
            <div className="space-y-2">
              {timeline.length ? (
                timeline.map((item, idx) => (
                  <div key={`${item.title}-${idx}`} className="surface rounded-xl px-3 py-2 flex justify-between items-center">
                    <div>
                      <p className="text-slate-100">{item.title}</p>
                      <p className="text-xs muted">{item.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{new Date(item.date).toLocaleDateString()}</p>
                      <p className="text-xs muted">{item.status}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Нет данных по вехам.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Блок «Важное»">
            <div className="space-y-2">
              {(notifications || []).slice(0, 6).map((n) => (
                <div key={n.id} className="surface rounded-xl px-3 py-2">
                  <p className="text-slate-100 text-sm">{n.title || "Уведомление"}</p>
                  <p className="muted text-xs">{n.body || n.text || "-"}</p>
                </div>
              ))}
              {!notifications.length && <p className="muted">Важных уведомлений пока нет.</p>}
            </div>
          </SectionCard>
        </>
      )}

      <SectionCard title="О платформе">
        <p className="text-slate-300 mb-5 max-w-3xl text-[15px]">
          Современный портал аспирантуры с единым интерфейсом для аспирантов, профессоров и администраторов.
          Быстрый доступ к учебным процессам, оценкам, коммуникациям и сопровождению научной работы.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <Feature title="Безопасный доступ" text="Авторизация по JWT и разграничение ролей." />
          <Feature title="Единая экосистема" text="Расписание, журнал, сообщения и уведомления в одном месте." />
          <Feature title="Управление процессом" text="Инструменты для научного руководства и администрирования." />
        </div>
      </SectionCard>

      <SectionCard title="Что доступно сейчас">
        <ul className="grid md:grid-cols-2 gap-2 text-slate-300">
          <li className="rounded-xl bg-slate-900/50 px-3 py-2 border border-slate-700/70">Личный кабинет и редактирование профиля</li>
          <li className="rounded-xl bg-slate-900/50 px-3 py-2 border border-slate-700/70">Просмотр расписания и оценок</li>
          <li className="rounded-xl bg-slate-900/50 px-3 py-2 border border-slate-700/70">Чаты между преподавателем и аспирантом</li>
          <li className="rounded-xl bg-slate-900/50 px-3 py-2 border border-slate-700/70">Ролевые кабинеты и администрирование</li>
        </ul>
      </SectionCard>
    </div>
  );
}

function Feature({ title, text }) {
  return (
    <article className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-4 hover:border-sky-500/45 transition-colors">
      <h3 className="text-slate-100 font-semibold mb-1">{title}</h3>
      <p className="text-sm text-slate-400">{text}</p>
    </article>
  );
}

function Metric({ title, value }) {
  return (
    <div className="stat-card">
      <p className="muted text-xs uppercase tracking-wide">{title}</p>
      <p className="value">{value ?? 0}</p>
    </div>
  );
}
