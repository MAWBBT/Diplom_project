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

const inputClassName =
  "w-full rounded-xl border border-slate-600/60 bg-slate-900/60 text-slate-100 px-4 py-3 placeholder:text-slate-600 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all shadow-inner";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    groupName: user?.groupName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
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

  const changePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    if (!newPassword.trim()) {
      toast.error("Введите новый пароль");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Новый пароль должен быть не короче 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Новый пароль и подтверждение не совпадают");
      return;
    }
    if (!oldPassword) {
      toast.error("Введите текущий пароль");
      return;
    }
    try {
      const { data } = await api.put("/profile/me", {
        oldPassword,
        newPassword,
      });
      setUser(data);
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Пароль успешно изменён");
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
              className={inputClassName}
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

      <div className="mt-10 pt-8 border-t border-slate-600/40">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Смена пароля</h3>
        <p className="text-xs text-slate-500 mb-4">
          Укажите текущий пароль и новый. Остальные данные профиля можно менять отдельно кнопкой выше.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2 max-w-md">
            <label className="text-xs font-medium text-slate-400 ml-1">Текущий пароль</label>
            <input
              type="password"
              autoComplete="current-password"
              className={inputClassName}
              value={passwordForm.oldPassword}
              placeholder="Текущий пароль"
              onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 ml-1">Новый пароль</label>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClassName}
              value={passwordForm.newPassword}
              placeholder="Не менее 6 символов"
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 ml-1">Подтверждение пароля</label>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClassName}
              value={passwordForm.confirmPassword}
              placeholder="Повторите новый пароль"
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-6">
          <button
            type="button"
            className="rounded-xl px-6 py-3 font-semibold border border-slate-500/60 bg-slate-800/80 text-slate-100 hover:bg-slate-700/80 hover:border-slate-400/60 transition-all"
            onClick={changePassword}
          >
            Обновить пароль
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
