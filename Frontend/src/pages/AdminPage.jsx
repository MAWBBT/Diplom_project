import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ login: "", password: "", fullName: "", role: "postgraduate" });

  const load = async () => {
    try {
      setUsers((await api.get("/admin/users")).data);
      setMsg("");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    try {
      await api.post("/admin/users", form);
      await load();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      await load();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Администрирование пользователей">
      <div className="grid md:grid-cols-5 gap-2 mb-4">
        <input className="input" placeholder="login" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        <input className="input" placeholder="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input className="input" placeholder="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="postgraduate">postgraduate</option>
          <option value="professor">professor</option>
          <option value="admin">admin</option>
          <option value="program_admin">program_admin</option>
        </select>
        <button className="btn" onClick={add}>Создать</button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between border border-slate-700 rounded-xl p-3 bg-slate-900/55">
            <div>
              {u.fullName} <span className="text-slate-400">({u.login}, {u.role})</span>
            </div>
            <button className="btn btn-danger py-2" onClick={() => remove(u.id)}>
              Удалить
            </button>
          </div>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm text-rose-300">{msg}</p>}
    </SectionCard>
  );
}
