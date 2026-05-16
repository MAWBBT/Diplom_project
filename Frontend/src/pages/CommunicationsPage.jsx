import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import SectionCard from "../components/SectionCard";
import MessagesPage from "./MessagesPage";
import NotificationsPage from "./NotificationsPage";

const TABS = [
  { id: "messages", label: "Сообщения" },
  { id: "notifications", label: "Уведомления" },
];

function tabFromLocationState(location) {
  const t = location?.state?.tab;
  if (t && TABS.some((x) => x.id === t)) return t;
  return null;
}

export default function CommunicationsPage() {
  const location = useLocation();
  const tabFromState = useMemo(() => tabFromLocationState(location), [location.key, location.state]);
  const [tab, setTab] = useState(() => tabFromLocationState(location) || "messages");

  useEffect(() => {
    if (tabFromState) setTab(tabFromState);
  }, [tabFromState]);

  return (
    <div className="space-y-6">
      <SectionCard title="Коммуникации">
        <div className="flex gap-2 flex-wrap mb-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-4 py-2 font-medium text-sm border transition-colors ${
                tab === t.id
                  ? "border-sky-400 bg-sky-400 text-slate-950"
                  : "border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "messages" ? <MessagesPage /> : <NotificationsPage />}
      </SectionCard>
    </div>
  );
}

