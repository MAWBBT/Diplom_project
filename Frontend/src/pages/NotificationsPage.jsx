import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      setRows((await api.get("/notifications")).data);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SectionCard
      title="Уведомления"
      right={
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            try {
              await api.post("/notifications/read-all");
              await load();
            } catch (e) {
              setError(getErrorMessage(e));
            }
          }}
        >
          Прочитать все
        </button>
      }
    >
      {error && <p className="text-sm text-rose-300 mb-3">{error}</p>}
      <div className="space-y-2">
        {rows.map((n) => (
          <div key={n.id} className="p-3 rounded-xl border border-slate-700 bg-slate-900/55">
            <div className="font-semibold text-slate-100">{n.title || "Уведомление"}</div>
            <div className="text-slate-300 mt-1">{n.text || n.body || n.message || "-"}</div>
          </div>
        ))}
        {!rows.length && !error && <p className="muted text-sm">Уведомлений пока нет.</p>}
      </div>
    </SectionCard>
  );
}
