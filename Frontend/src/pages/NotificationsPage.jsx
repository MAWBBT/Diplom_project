import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

function isUnread(n) {
  return !n.readAt;
}

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    try {
      setRows((await api.get("/notifications")).data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 20000);
    return () => clearInterval(id);
  }, [load]);

  const markOne = async (n) => {
    if (!isUnread(n)) return;
    try {
      await api.patch(`/notifications/${n.id}/read`);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <SectionCard
      title="Ваши уведомления"
      right={
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            type="button"
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={() => void load()}
          >
            Обновить
          </button>
          <button
            type="button"
            className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={async () => {
              try {
                await api.post("/notifications/read-all");
                toast.success("Все уведомления прочитаны");
                await load();
              } catch (e) {
                toast.error(getErrorMessage(e));
              }
            }}
          >
            Прочитать все
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {rows.map((n) => {
          const unread = isUnread(n);
          const body = n.body || n.text || n.message || "—";
          const link = n.link && String(n.link).trim();
          const internal = link && link.startsWith("/");

          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => void markOne(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void markOne(n);
                }
              }}
              className={`p-4 rounded-xl border text-left w-full cursor-pointer transition-colors ${
                unread
                  ? "border-sky-500/40 bg-sky-950/25 hover:bg-sky-950/35"
                  : "border-slate-700/60 bg-slate-900/40 hover:bg-slate-800/40"
              }`}
            >
              <div className="font-semibold text-slate-100 flex items-center gap-2 flex-wrap">
                <span className={`w-2 h-2 rounded-full shrink-0 ${unread ? "bg-sky-400" : "bg-slate-600"}`} />
                {n.title || "Уведомление"}
                {unread ? (
                  <span className="text-[10px] uppercase tracking-wider text-sky-300 border border-sky-500/40 rounded-full px-2 py-0.5">
                    новое
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">прочитано</span>
                )}
              </div>
              <div className="text-slate-300 mt-2 text-[15px] leading-relaxed">{body}</div>
              {link ? (
                <div className="mt-3">
                  {internal ? (
                    <Link
                      to={link}
                      className="text-sm text-sky-300 hover:text-sky-200 underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Перейти
                    </Link>
                  ) : (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-300 hover:text-sky-200 underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Открыть ссылку
                    </a>
                  )}
                </div>
              ) : null}
              <div className="text-[11px] text-slate-500 mt-2">
                {n.createdAt ? new Date(n.createdAt).toLocaleString("ru-RU") : ""}
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <div className="text-center py-10">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-slate-400">Уведомлений пока нет.</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
