import { useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";

const roleNames = {
  postgraduate: "Аспирант",
  professor: "Профессор",
  admin: "Администратор",
  program_admin: "Администратор программы",
};

const labels = {
  fullName: "ФИО",
  groupName: "Учебная группа",
  email: "Электронная почта",
  phone: "Номер телефона"
};

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    groupName: user?.groupName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const save = async () => {
    try {
      const { data } = await api.put("/profile/me", form);
      setUser(data);
      toast.success("Профиль успешно обновлен");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Настройки профиля">
      <div className="mb-6 flex items-center">
        <span className="text-slate-400 mr-3">Ваша роль:</span>
        <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 shadow-sm">
          {roleNames[user?.role] || user?.role}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {["fullName", "groupName", "email", "phone"].map((k) => (
          <div key={k} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 ml-1">{labels[k]}</label>
            <input
              className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 text-slate-100 px-4 py-3 placeholder:text-slate-600 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all shadow-inner"
              value={form[k] || ""}
              placeholder={labels[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="mt-8">
        <button 
          className="rounded-xl px-6 py-3 font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(14,165,233,0.35)] hover:shadow-[0_10px_28px_rgba(14,165,233,0.45)] hover:brightness-105 transition-all" 
          onClick={save}
        >
          Сохранить изменения
        </button>
      </div>
    </SectionCard>
  );
}
