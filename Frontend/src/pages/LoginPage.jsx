import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import SectionCard from "../components/SectionCard";
import api, { getErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const [form, setForm] = useState({ login: "", password: "" });
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.login || !form.password) {
      toast.error("Введите логин и пароль");
      return;
    }
    
    try {
      const { data } = await api.post("/auth/login", form);
      setAuth(data.user, data.token);
      toast.success("Вход выполнен успешно");
      navigate("/profile", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <SectionCard title="Вход в систему">
      <p className="text-slate-400 mb-6 text-sm">
        Введите логин и пароль. Роль определяется автоматически по учётной записи.
      </p>
      <form onSubmit={handleLogin} className="space-y-4 max-w-lg">
        <div className="grid sm:grid-cols-2 gap-4">
          <input
            className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 text-slate-100 px-4 py-3 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all shadow-inner"
            placeholder="Ваш логин"
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value })}
          />
          <input
            className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 text-slate-100 px-4 py-3 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all shadow-inner"
            type="password"
            placeholder="Ваш пароль"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
          <button type="submit" className="w-full sm:w-auto rounded-xl px-6 py-3 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(14,165,233,0.35)] hover:shadow-[0_10px_28px_rgba(14,165,233,0.45)] hover:brightness-105 transition-all">
            Войти
          </button>
          <span className="text-[13px] text-slate-500">Например: postgraduate1 / password123</span>
        </div>
      </form>
    </SectionCard>
  );
}
