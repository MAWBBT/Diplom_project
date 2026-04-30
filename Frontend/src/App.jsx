import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "./api/client";
import { useAuthStore } from "./store/authStore";
import SectionCard from "./components/SectionCard";

const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const GradesPage = lazy(() => import("./pages/GradesPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const PostgraduatePage = lazy(() => import("./pages/PostgraduatePage"));
const SupervisorPage = lazy(() => import("./pages/SupervisorPage"));
const ProgramAdminPage = lazy(() => import("./pages/ProgramAdminPage"));
const AttestationsPage = lazy(() => import("./pages/AttestationsPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const AttendanceMyPage = lazy(() => import("./pages/AttendanceMyPage"));
const CurriculumPage = lazy(() => import("./pages/CurriculumPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));

const legacyPageToRoute = {
  home: "/",
  login: "/login",
  profile: "/profile",
  schedule: "/schedule",
  grades: "/grades",
  messages: "/messages",
  notifications: "/notifications",
  journal: "/journal",
  admin: "/admin",
  postgraduate: "/postgraduate",
  supervisor: "/supervisor",
  programAdmin: "/program-admin",
  attestations: "/attestations",
  attendance: "/attendance",
  curriculum: "/curriculum",
  reports: "/reports",
};

export default function App() {
  const { user, setUser, token, logout } = useAuthStore();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [ToasterComponent, setToasterComponent] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoadingAuth(false);
        return;
      }
      try {
        const { data } = await api.get("/profile/me");
        setUser(data);
      } catch {
        logout();
      } finally {
        setLoadingAuth(false);
      }
    })();
  }, [token, setUser, logout]);

  useEffect(() => {
    // Defer toast UI to reduce initial JS/CPU work (improves LCP on mobile).
    let cancelled = false;
    const load = async () => {
      const mod = await import("react-hot-toast");
      if (!cancelled) setToasterComponent(() => mod.Toaster);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      // eslint-disable-next-line no-undef
      window.requestIdleCallback(() => load(), { timeout: 1500 });
    } else {
      setTimeout(load, 600);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const menu = useMemo(() => {
    const base = [{ to: "/", label: "Главная" }];
    if (!user) return [...base, { to: "/login", label: "Вход" }];

    const items = [
      { to: "/profile", label: "Профиль" },
      { to: "/schedule", label: "Расписание" },
      { to: "/grades", label: "Оценки" },
      { to: "/messages", label: "Сообщения" },
      { to: "/notifications", label: "Уведомления" },
    ];
    if (["professor", "admin"].includes(user.role)) items.push({ to: "/journal", label: "Журнал" });
    if (["professor", "admin"].includes(user.role)) items.push({ to: "/attestations", label: "Аттестации" });
    if (["professor", "admin"].includes(user.role)) items.push({ to: "/attendance", label: "Посещаемость" });
    if (user.role === "postgraduate") items.push({ to: "/attendance", label: "Посещаемость" });
    items.push({ to: "/curriculum", label: "Учебный план" });
    if (user.role === "admin") items.push({ to: "/admin", label: "Админка" });
    if (user.role === "admin") items.push({ to: "/reports", label: "Отчётность" });
    if (user.role === "postgraduate") items.push({ to: "/postgraduate", label: "Кабинет аспиранта" });
    if (user.role === "professor") items.push({ to: "/supervisor", label: "Руководитель" });
    if (user.role === "program_admin") items.push({ to: "/program-admin", label: "Админ программы" });

    return [...base, ...items];
  }, [user]);

  if (loadingAuth) {
    return (
      <div className="max-w-7xl mx-auto p-6 md:p-12 min-h-screen">
        <div className="bg-slate-900/80 border border-slate-700/50 backdrop-blur-md rounded-2xl p-8 text-slate-300">
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-6 md:py-12 space-y-6">
      {ToasterComponent ? (
        <ToasterComponent
          position="top-right"
          toastOptions={{ style: { background: "#1e293b", color: "#f8fafc", border: "1px solid #334155" } }}
        />
      ) : null}

      <header className="bg-slate-900/80 border border-slate-700/50 backdrop-blur-md rounded-2xl p-5 flex flex-wrap items-center gap-5 justify-between shadow-[0_20px_60px_rgba(2,6,23,0.5)]">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full px-3 py-1 text-xs text-sky-200 border border-sky-400/40 bg-sky-600/15">
            Digital Campus
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-200 via-sky-300 to-blue-300 bg-clip-text text-transparent">
            Цифровой портал аспирантуры
          </h1>
          <p className="text-slate-400 text-sm">Личные кабинеты, журнал, коммуникации и аналитика</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `inline-flex items-center no-underline rounded-xl px-4 py-2 text-sm border transition duration-150 ${
                  isActive
                    ? "text-slate-950 font-medium border-sky-400 bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                    : "text-slate-200 border-slate-600/65 bg-slate-800/60 hover:bg-slate-700/85 hover:-translate-y-px"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user && (
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="px-4 py-2 rounded-xl text-sm border border-rose-400/70 text-rose-200 hover:bg-rose-500/20 transition-colors"
            >
              Выйти
            </button>
          )}
        </div>
      </header>

      {user && (
        <section className="bg-slate-950/40 border border-slate-700/70 rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
              <p className="text-slate-300 text-xs uppercase tracking-wide">Пользователь</p>
              <p className="text-sky-100 text-lg font-bold">{user.fullName || user.login}</p>
            </div>
            <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
              <p className="text-slate-300 text-xs uppercase tracking-wide">Роль</p>
              <p className="text-sky-100 text-lg font-bold">{user.role}</p>
            </div>
            <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
              <p className="text-slate-300 text-xs uppercase tracking-wide">Группа</p>
              <p className="text-sky-100 text-lg font-bold">{user.groupName || "—"}</p>
            </div>
            <div className="rounded-[0.9rem] p-4 border border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70">
              <p className="text-slate-300 text-xs uppercase tracking-wide">Email</p>
              <p className="text-sky-100 text-lg font-bold">{user.email || "—"}</p>
            </div>
          </div>
        </section>
      )}

      <LegacyRedirect />
      <main id="main" className="contents">
        <MainContent key={location.pathname} user={user} currentPath={location.pathname} />
      </main>
    </div>
  );
}

function MainContent({ user, currentPath }) {
  const needsAuth = !user && currentPath !== "/" && currentPath !== "/login" && currentPath !== "/index.html";
  if (needsAuth) {
    return (
      <PageTransition>
        <SectionCard title="Требуется авторизация">
          <p className="text-slate-300 mb-4">Для доступа к разделу выполните вход.</p>
          <NavLink to="/login" className="rounded-xl px-5 py-3 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(14,165,233,0.35)] hover:shadow-[0_10px_28px_rgba(14,165,233,0.45)] hover:brightness-105 transition-all">
            Перейти ко входу
          </NavLink>
        </SectionCard>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <Suspense fallback={<SectionCard title="Загрузка">Загрузка…</SectionCard>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/index.html" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<Guard user={user}><ProfilePage /></Guard>} />
          <Route path="/schedule" element={<Guard user={user}><SchedulePage /></Guard>} />
          <Route path="/grades" element={<Guard user={user}><GradesPage /></Guard>} />
          <Route path="/messages" element={<Guard user={user}><MessagesPage /></Guard>} />
          <Route path="/notifications" element={<Guard user={user}><NotificationsPage /></Guard>} />
          <Route
            path="/journal"
            element={
              <Guard user={user}>
                <RoleGuard user={user} roles={["professor", "admin"]}>
                  <JournalPage />
                </RoleGuard>
              </Guard>
            }
          />
          <Route
            path="/admin"
            element={
              <Guard user={user}>
                <RoleGuard user={user} roles={["admin"]}>
                  <AdminPage />
                </RoleGuard>
              </Guard>
            }
          />
          <Route
            path="/postgraduate"
            element={
              <Guard user={user}>
                <RoleGuard user={user} roles={["postgraduate"]}>
                  <PostgraduatePage />
                </RoleGuard>
              </Guard>
            }
          />
          <Route
            path="/supervisor"
            element={
              <Guard user={user}>
                <RoleGuard user={user} roles={["professor"]}>
                  <SupervisorPage />
                </RoleGuard>
              </Guard>
            }
          />
          <Route
            path="/program-admin"
            element={
              <Guard user={user}>
                <RoleGuard user={user} roles={["program_admin"]}>
                  <ProgramAdminPage />
                </RoleGuard>
              </Guard>
            }
          />
          <Route
            path="/attestations"
            element={
              <Guard user={user}>
                <RoleGuard user={user} roles={["professor", "admin"]}>
                  <AttestationsPage />
                </RoleGuard>
              </Guard>
            }
          />
          <Route
            path="/attendance"
            element={
              <Guard user={user}>
                {user?.role === "postgraduate" ? (
                  <RoleGuard user={user} roles={["postgraduate"]}>
                    <AttendanceMyPage />
                  </RoleGuard>
                ) : (
                  <RoleGuard user={user} roles={["professor", "admin"]}>
                    <AttendancePage />
                  </RoleGuard>
                )}
              </Guard>
            }
          />
          <Route
            path="/curriculum"
            element={
              <Guard user={user}>
                <CurriculumPage />
              </Guard>
            }
          />
          <Route
            path="/reports"
            element={
              <Guard user={user}>
                <RoleGuard user={user} roles={["admin"]}>
                  <ReportsPage />
                </RoleGuard>
              </Guard>
            }
          />
          <Route path="*" element={<SectionCard title="Страница не найдена">Выберите раздел из меню.</SectionCard>} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
}

function PageTransition({ children }) {
  return (
    <div className="opacity-100 translate-y-0 transition-opacity duration-150 ease-out">
      {children}
    </div>
  );
}

function Guard({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleGuard({ user, roles, children }) {
  if (!roles.includes(user.role)) {
    return (
      <SectionCard title="Доступ запрещён">
        <p className="text-slate-300 mb-4">Этот раздел недоступен для вашей роли.</p>
        <NavLink to="/" className="rounded-xl px-5 py-3 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(14,165,233,0.35)] hover:shadow-[0_10px_28px_rgba(14,165,233,0.45)] hover:brightness-105 transition-all">
          На главную
        </NavLink>
      </SectionCard>
    );
  }
  return children;
}

function LegacyRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const legacyPage = params.get("page");
    if (!legacyPage) return;

    const target = legacyPageToRoute[legacyPage];
    if (!target) return;

    navigate({ pathname: target, search: "", hash: "" }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
