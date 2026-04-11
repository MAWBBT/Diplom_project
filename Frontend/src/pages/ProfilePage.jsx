import { useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

const roleNames = {
  postgraduate: "Аспирант",
  professor: "Профессор",
  admin: "Администратор",
  program_admin: "Администратор программы",
};

export default function ProfilePage({ user, setUser }) {
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    groupName: user?.groupName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [msg, setMsg] = useState("");

  const save = async () => {
    try {
      const { data } = await api.put("/profile/me", form);
      setUser(data);
      setMsg("Профиль обновлен.");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Профиль">
      <p className="text-slate-300 mb-3">
        Роль: <span className="pill ml-1">{roleNames[user?.role] || user?.role}</span>
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {["fullName", "groupName", "email", "phone"].map((k) => (
          <input
            key={k}
            className="input"
            value={form[k] || ""}
            placeholder={k}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          />
        ))}
      </div>
      <button className="btn mt-4" onClick={save}>
        Сохранить
      </button>
      {msg && <p className="mt-3 text-sm text-slate-300">{msg}</p>}
    </SectionCard>
  );
}
