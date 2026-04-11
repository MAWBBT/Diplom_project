import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

export default function ProgramAdminPage() {
  const [overview, setOverview] = useState(null);
  const [postgraduates, setPostgraduates] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [docType, setDocType] = useState("gibdd");
  const [personName, setPersonName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyHint, setCopyHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [o, p, red] = await Promise.all([
          api.get("/program-admin/overview"),
          api.get("/program-admin/postgraduates"),
          api.get("/program-admin/milestones/overdue"),
        ]);
        if (!cancelled) {
          setOverview(o.data);
          setPostgraduates(p.data);
          setOverdue(red.data || []);
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyReference = async (text) => {
    setCopyHint("");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyHint("Скопировано в буфер обмена.");
        return;
      }
    } catch {
      /* fallback below */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyHint("Скопировано в буфер обмена.");
    } catch {
      window.prompt("Скопируйте текст справки:", text);
    }
  };

  const counts = overview?.counts || {};
  const pgRows = postgraduates.map((item, idx) => ({
    id: item?.user?.id ?? idx + 1,
    fullName: item?.user?.fullName ?? "—",
    groupName: item?.user?.groupName ?? "—",
    email: item?.user?.email ?? "—",
    specialty: item?.profile?.specialtyCode ?? "—",
    department: item?.profile?.department ?? "—",
    overdueMilestones: item?.overdueMilestones ?? 0,
    hasPlanPendingApproval: item?.hasPlanPendingApproval ? "Да" : "Нет",
  }));
  const generatedReference = `СПРАВКА\nТип: ${docType}\nФИО: ${personName || "Не указано"}\nДата: ${new Date().toLocaleDateString()}\nСтатус: обучается в аспирантуре`;

  if (loading) {
    return (
      <SectionCard title="Администратор программы">
        <p className="muted">Загрузка данных…</p>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Администратор программы">
        <p className="text-rose-200 text-sm">{error}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Администратор программы">
        <div className="stat-grid">
          <Metric title="Всего пользователей" value={counts.usersTotal} />
          <Metric title="Аспирантов" value={counts.postgraduates} />
          <Metric title="Профессоров" value={counts.professors} />
          <Metric title="Просроченных вех" value={counts.overdueMilestones} />
          <Metric title="Планов на согласовании" value={counts.plansPendingApproval} />
          <Metric title="Документов на проверке" value={counts.documentsOnReview} />
        </div>
        <p className="muted text-xs mt-3">
          Данные сформированы: {overview?.generatedAt ? new Date(overview.generatedAt).toLocaleString() : "—"}
        </p>
      </SectionCard>

      <SectionCard title="Список аспирантов">
        <SimpleTable rows={pgRows} />
      </SectionCard>

      <SectionCard title="Мониторинг неуспевающих — Красная зона">
        <SimpleTable
          rows={overdue.map((m, idx) => ({
            id: m.id || idx + 1,
            owner: m.owner?.fullName || "—",
            groupName: m.owner?.groupName || "—",
            title: m.title,
            dueDate: m.dueDate,
            status: m.status,
          }))}
        />
      </SectionCard>

      <SectionCard title="Конструктор справок">
        <div className="grid md:grid-cols-3 gap-2 mb-3">
          <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="gibdd">Для ГИБДД (отсрочка)</option>
            <option value="social">Для соцзащиты</option>
          </select>
          <input
            className="input"
            placeholder="ФИО аспиранта"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={() => copyReference(generatedReference)}>
            Скопировать справку
          </button>
        </div>
        {copyHint && <p className="text-xs text-emerald-300/90 mb-2">{copyHint}</p>}
        <pre className="text-xs bg-slate-950/75 border border-slate-700 rounded-xl p-3 overflow-auto text-slate-300">
          {generatedReference}
        </pre>
      </SectionCard>
    </div>
  );
}

function Metric({ title, value }) {
  return (
    <div className="stat-card">
      <p className="muted text-xs uppercase tracking-wide">{title}</p>
      <p className="value">{value ?? 0}</p>
    </div>
  );
}
