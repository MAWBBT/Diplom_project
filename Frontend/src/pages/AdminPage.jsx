import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ login: "", password: "", fullName: "", role: "postgraduate" });
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const load = async () => {
    try {
      if (q.trim() || roleFilter) {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (roleFilter) params.set("role", roleFilter);
        setUsers((await api.get(`/admin/users-search?${params.toString()}`)).data);
      } else {
        setUsers((await api.get("/admin/users")).data);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!form.login || !form.password || !form.fullName) {
      toast.error("Заполните все поля");
      return;
    }
    try {
      await api.post("/admin/users", form);
      toast.success("Пользователь создан");
      setForm({ ...form, login: "", password: "", fullName: "" });
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("Пользователь удален");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const setActive = async (id, nextActive) => {
    try {
      await api.patch(`/admin/users/${id}/${nextActive ? "activate" : "deactivate"}`);
      toast.success(nextActive ? "Пользователь активирован" : "Пользователь деактивирован");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Администрирование пользователей">
      <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-sky-200 mb-4">Создать пользователя</h3>
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <input 
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
            placeholder="Логин" 
            value={form.login} 
            onChange={(e) => setForm({ ...form, login: e.target.value })} 
          />
          <input 
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
            placeholder="Пароль" 
            value={form.password} 
            onChange={(e) => setForm({ ...form, password: e.target.value })} 
          />
          <input 
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
            placeholder="ФИО" 
            value={form.fullName} 
            onChange={(e) => setForm({ ...form, fullName: e.target.value })} 
          />
          <select 
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
            value={form.role} 
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="postgraduate">Аспирант</option>
            <option value="professor">Профессор</option>
            <option value="admin">Администратор</option>
            <option value="program_admin">Админ программы</option>
          </select>
          <button 
             className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all" 
             onClick={add}
          >
            Добавить
          </button>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-sky-200 mb-4">Поиск и фильтрация</h3>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <input
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            placeholder="Поиск по ФИО или логину"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Все роли</option>
            <option value="postgraduate">Аспирант</option>
            <option value="professor">Профессор</option>
            <option value="admin">Администратор</option>
            <option value="program_admin">Админ программы</option>
          </select>
          <button
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all"
            onClick={load}
          >
            Применить
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border border-slate-700/60 rounded-xl p-4 bg-slate-900/40 hover:bg-slate-800/40 transition-colors">
            <div>
              <div className="font-semibold text-slate-100 text-[15px]">{u.fullName}</div>
              <div className="text-slate-400 text-sm mt-0.5">
                Логин: <span className="text-sky-200/80">{u.login}</span> • Роль:{" "}
                <span className="text-emerald-300">{u.role}</span> • Статус:{" "}
                <span className={u.isActive === false ? "text-rose-300" : "text-emerald-300"}>
                  {u.isActive === false ? "деактивирован" : "активен"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-all"
                onClick={() => setActive(u.id, u.isActive === false)}
              >
                {u.isActive === false ? "Активировать" : "Деактивировать"}
              </button>
              <button
                className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium border border-rose-900/50 bg-rose-950/30 text-rose-300 hover:bg-rose-500/20 transition-all"
                onClick={() => remove(u.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="text-center text-slate-500 py-4">Список пользователей пуст</div>}
      </div>
    </SectionCard>
  );
}
