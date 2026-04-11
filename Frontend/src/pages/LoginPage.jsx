import { useState } from "react";
import SectionCard from "../components/SectionCard";

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ login: "", password: "" });

  return (
    <SectionCard title="Вход">
      <p className="text-slate-400 mb-4 text-sm">
        Введите логин и пароль. Роль определяется автоматически по учётной записи.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Логин"
          value={form.login}
          onChange={(e) => setForm({ ...form, login: e.target.value })}
        />
        <input
          className="input"
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <button type="button" className="btn w-full md:w-auto" onClick={() => onLogin(form)}>
          Войти
        </button>
        <span className="text-xs text-slate-500">Например: postgraduate1 / password123</span>
      </div>
    </SectionCard>
  );
}
