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
const CommunicationsPage = lazy(() => import("./pages/CommunicationsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const PostgraduatePage = lazy(() => import("./pages/PostgraduatePage"));
const SupervisorPage = lazy(() => import("./pages/SupervisorPage"));
const ProgramAdminPage = lazy(() => import("./pages/ProgramAdminPage"));
const AttestationsPage = lazy(() => import("./pages/AttestationsPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const AttendanceMyPage = lazy(() => import("./pages/AttendanceMyPage"));
const StudyPage = lazy(() => import("./pages/StudyPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));

const legacyPageToRoute = {
  home: "/",
  login: "/login",
  profile: "/profile",
  schedule: "/schedule",
  grades: "/grades",
  messages: "/messages",
  notifications: "/notifications",
  journal: "/grades",
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
      { to: "/study", label: "Учёба" },
      { to: "/grades", label: "Успеваемость" },
      { to: "/communications", label: "Коммуникации" },
    ];
    if (["professor", "admin"].includes(user.role)) items.push({ to: "/attestations", label: "Аттестации" });
    if (["professor", "admin"].includes(user.role)) items.push({ to: "/attendance", label: "Посещаемость" });
    if (user.role === "postgraduate") items.push({ to: "/attendance", label: "Посещаемость" });
    if (user.role === "admin") items.push({ to: "/admin", label: "Админка" });
    if (user.role === "admin") items.push({ to: "/reports", label: "Отчётность" });
    if (user.role === "program_admin") items.push({ to: "/program-admin", label: "Админ программы" });

    return [...base, ...items];
  }, [user]);

  const cabinetAction = useMemo(() => {
    if (!user) return null;
    if (user.role === "professor") return { to: "/supervisor", label: "Кабинет Руководителя" };
    if (user.role === "postgraduate") return { to: "/postgraduate", label: "Кабинет Аспиранта" };
    return null;
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

      <header className="bg-slate-900/80 border border-slate-700/50 backdrop-blur-md rounded-2xl p-5 shadow-[0_20px_60px_rgba(2,6,23,0.5)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6 justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-200 via-sky-300 to-blue-300 bg-clip-text text-transparent">
              Цифровой портал аспирантуры
            </h1>
            <p className="text-slate-400 text-sm">Личные кабинеты, журнал, коммуникации и аналитика</p>
          </div>

          {user ? (
            <section className="w-full lg:w-[420px] rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-950/35 via-slate-900/45 to-slate-950/20 p-4 shadow-inner">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-sky-500/15 border border-sky-400/30 grid place-items-center shrink-0">
                  <span className="text-sky-200 font-black text-sm">
                    {(user.fullName || user.login || "U").trim().slice(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-slate-200 font-semibold leading-tight truncate">
                    {user.fullName || user.login}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200">
                      роль: {user.role}
                    </span>
                    {user.groupName ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200">
                        группа: {user.groupName}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-[12px] text-slate-400 truncate">
                    {user.email || "—"}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <nav aria-label="Основная навигация" className="min-w-0">
            <ul className="flex gap-2 flex-wrap">
              {menu.map((item) => (
                <li key={item.to}>
                  <NavLink
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
                </li>
              ))}
            </ul>
          </nav>

          {user ? (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {cabinetAction ? (
                <NavLink
                  to={cabinetAction.to}
                  end
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-xl text-sm border transition duration-150 ${
                      isActive
                        ? "text-slate-950 font-medium border-sky-400 bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                        : "border-slate-600/65 text-slate-200 bg-slate-800/60 hover:bg-slate-700/85 hover:-translate-y-px"
                    }`
                  }
                >
                  {cabinetAction.label}
                </NavLink>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="px-4 py-2 rounded-xl text-sm border border-rose-400/70 text-rose-200 hover:bg-rose-500/20 transition-colors"
              >
                Выйти
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <LegacyRedirect />
      <main id="main" className="contents">
        <MainContent user={user} currentPath={location.pathname} />
      </main>
    </div>
  );
}

function MainContent({ user, currentPath }) {
  const publicPaths = new Set(["/", "/login", "/index.html"]);
  const protectedPaths = new Set([
    "/profile",
    "/schedule",
    "/study",
    "/grades",
    "/messages",
    "/notifications",
    "/communications",
    "/journal",
    "/admin",
    "/postgraduate",
    "/supervisor",
    "/program-admin",
    "/attestations",
    "/attendance",
    "/curriculum",
    "/reports",
  ]);

  if (!user && !publicPaths.has(currentPath)) {
    if (protectedPaths.has(currentPath)) {
      return (
        <PageTransition>
          <SectionCard title="Требуется авторизация">
            <p className="text-slate-300 mb-4">Для доступа к разделу выполните вход.</p>
            <NavLink
              to="/login"
              className="rounded-xl px-5 py-3 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(14,165,233,0.35)] hover:shadow-[0_10px_28px_rgba(14,165,233,0.45)] hover:brightness-105 transition-all"
            >
              Перейти ко входу
            </NavLink>
          </SectionCard>
        </PageTransition>
      );
    }

    return (
      <PageTransition>
        <SectionCard title="Страница не найдена">Выберите раздел из меню.</SectionCard>
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
          <Route path="/study" element={<Guard user={user}><StudyPage /></Guard>} />
          <Route path="/schedule" element={<Navigate to="/study" replace />} />
          <Route path="/grades" element={<Guard user={user}><GradesPage /></Guard>} />
          <Route path="/journal" element={<Navigate to="/grades" replace state={{ tab: "journal" }} />} />
          <Route path="/communications" element={<Guard user={user}><CommunicationsPage /></Guard>} />
          <Route path="/messages" element={<Navigate to="/communications" replace state={{ tab: "messages" }} />} />
          <Route path="/notifications" element={<Navigate to="/communications" replace state={{ tab: "notifications" }} />} />
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
          <Route path="/curriculum" element={<Navigate to="/study" replace />} />
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
