import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

export default function SupervisorPage() {
  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState("2026-2027");
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      setRows((await api.get("/supervisor/supervisions")).data);
    } catch (e) {
      setLoadError(getErrorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const riskRows = rows.map((r, idx) => ({
    id: r?.supervision?.id || idx + 1,
    postgraduate: r?.postgraduate?.fullName || "—",
    groupName: r?.postgraduate?.groupName || "—",
    topic: r?.latestTopic?.title || "—",
    risk: r?.latestTopic?.status === "approved" ? "green" : "red",
  }));

  const bulkApprove = async () => {
    try {
      const { data } = await api.post("/supervisor/plans/bulk-approve", { academicYear: selectedYear });
      setMsg(`Подтверждено планов: ${data.updated || 0}`);
    } catch (e) {
      setMsg(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Кабинет научного руководителя">
        <div className="grid md:grid-cols-3 gap-2">
          <select className="input" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
            <option value="2027-2028">2027-2028</option>
          </select>
          <button className="btn" onClick={bulkApprove}>Подтвердить отчеты всех аспирантов года</button>
          <button className="btn btn-secondary" onClick={load}>Обновить</button>
        </div>
        {loadError && <p className="text-rose-200 text-sm mt-2">{loadError}</p>}
        {msg && <p className="muted text-sm mt-2">{msg}</p>}
      </SectionCard>

      <SectionCard title="Список ведомых и риски">
        <SimpleTable rows={riskRows} />
      </SectionCard>
    </div>
  );
}
