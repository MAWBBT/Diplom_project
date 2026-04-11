import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "./api/client";
import SectionCard from "./components/SectionCard";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SchedulePage from "./pages/SchedulePage";
import GradesPage from "./pages/GradesPage";
import MessagesPage from "./pages/MessagesPage";
import NotificationsPage from "./pages/NotificationsPage";
import JournalPage from "./pages/JournalPage";
import AdminPage from "./pages/AdminPage";
import PostgraduatePage from "./pages/PostgraduatePage";
import SupervisorPage from "./pages/SupervisorPage";
import ProgramAdminPage from "./pages/ProgramAdminPage";

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
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [alert, setAlert] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoadingAuth(false);
        return;
      }
      try {
        const { data } = await api.get("/profile/me");
        setUser(data);
      } catch {
        localStorage.removeItem("token");
      } finally {
        setLoadingAuth(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!alert) return undefined;
    const timerId = window.setTimeout(() => setAlert(""), 2500);
    return () => window.clearTimeout(timerId);
  }, [alert]);

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
    if (user.role === "admin") items.push({ to: "/admin", label: "Админка" });
    if (user.role === "postgraduate") items.push({ to: "/postgraduate", label: "Кабинет аспиранта" });
    if (user.role === "professor") items.push({ to: "/supervisor", label: "Руководитель" });
    if (user.role === "program_admin") items.push({ to: "/program-admin", label: "Админ программы" });

    return [...base, ...items];
  }, [user]);

  const onLogin = async (payload) => {
    try {
      const { data } = await api.post("/auth/login", payload);
      localStorage.setItem("token", data.token);
      const me = await api.get("/profile/me");
      setUser(me.data);
      setAlert("Вход выполнен успешно.");
      navigate("/profile", { replace: true });
    } catch (error) {
      setAlert(getErrorMessage(error));
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/", { replace: true });
  };

  if (loadingAuth) {
    return (
      <div className="app-shell">
        <div className="glass rounded-2xl p-8 text-slate-300">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="app-shell space-y-5">
      <header className="glass rounded-2xl p-4 md:p-5 flex flex-wrap items-center gap-4 justify-between shadow-[0_20px_60px_rgba(2,6,23,0.5)]">
        <div className="space-y-2">
          <div className="pill">Digital Campus</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight title-gradient">Цифровой портал аспирантуры</h1>
          <p className="muted text-sm">Личные кабинеты, журнал, коммуникации и аналитика</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
          {user && (
            <button
              onClick={logout}
              className="px-3 py-2 rounded-xl text-sm border border-rose-400/70 text-rose-200 hover:bg-rose-500/20 transition-colors"
            >
              Выйти
            </button>
          )}
        </div>
      </header>

      {user && (
        <section className="surface rounded-2xl p-4 md:p-5 fade-up">
          <div className="stat-grid">
            <div className="stat-card">
              <p className="muted text-xs uppercase tracking-wide">Пользователь</p>
              <p className="value">{user.fullName || user.login}</p>
            </div>
            <div className="stat-card">
              <p className="muted text-xs uppercase tracking-wide">Роль</p>
              <p className="value">{user.role}</p>
            </div>
            <div className="stat-card">
              <p className="muted text-xs uppercase tracking-wide">Группа</p>
              <p className="value">{user.groupName || "—"}</p>
            </div>
            <div className="stat-card">
              <p className="muted text-xs uppercase tracking-wide">Email</p>
              <p className="value">{user.email || "—"}</p>
            </div>
          </div>
        </section>
      )}

      {alert && (
        <div className="glass border-amber-500/40 rounded-xl px-4 py-3 text-amber-200 text-sm">
          {alert}
        </div>
      )}

      <LegacyRedirect />
      <MainContent
        user={user}
        setUser={setUser}
        onLogin={onLogin}
        currentPath={location.pathname}
      />
    </div>
  );
}

function MainContent({ user, setUser, onLogin, currentPath }) {
  const needsAuth = !user && currentPath !== "/" && currentPath !== "/login" && currentPath !== "/index.html";
  if (needsAuth) {
    return (
      <SectionCard title="Требуется авторизация">
        <p className="text-slate-300 mb-4">Для доступа к разделу выполните вход.</p>
        <NavLink to="/login" className="btn">
          Перейти ко входу
        </NavLink>
      </SectionCard>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage user={user} />} />
      <Route path="/index.html" element={<HomePage user={user} />} />
      <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
      <Route path="/profile" element={<Guard user={user}><ProfilePage user={user} setUser={setUser} /></Guard>} />
      <Route path="/schedule" element={<Guard user={user}><SchedulePage user={user} /></Guard>} />
      <Route path="/grades" element={<Guard user={user}><GradesPage user={user} /></Guard>} />
      <Route path="/messages" element={<Guard user={user}><MessagesPage user={user} /></Guard>} />
      <Route path="/notifications" element={<Guard user={user}><NotificationsPage /></Guard>} />
      <Route
        path="/journal"
        element={
          <Guard user={user}>
            <RoleGuard user={user} roles={["professor", "admin"]}>
              <JournalPage user={user} />
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
      <Route path="*" element={<SectionCard title="Страница не найдена">Выберите раздел из меню.</SectionCard>} />
    </Routes>
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
        <NavLink to="/" className="btn">
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