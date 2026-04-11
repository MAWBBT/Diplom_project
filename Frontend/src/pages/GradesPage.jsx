import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

export default function GradesPage({ user }) {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ userId: "", subject: "", controlType: "", grade: "", comment: "" });
  const canCreate = ["admin", "professor"].includes(user?.role);

  const load = async () => {
    try {
      const path = user?.role === "admin" ? "/admin/grades" : "/grades";
      setRows((await api.get(path)).data);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    try {
      await api.post("/grades", { ...form, userId: Number(form.userId) || null });
      load();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Оценки" right={<button className="btn btn-secondary" onClick={load}>Обновить</button>}>
      {canCreate && (
        <div className="grid md:grid-cols-3 gap-2 mb-4">
          {Object.keys(form).map((k) => (
            <input
              key={k}
              className="input"
              placeholder={k}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ))}
          <button className="btn" onClick={add}>
            Выставить
          </button>
        </div>
      )}
      <SimpleTable rows={rows} />
      {msg && <p className="mt-3 text-sm text-rose-300">{msg}</p>}
    </SectionCard>
  );
}
