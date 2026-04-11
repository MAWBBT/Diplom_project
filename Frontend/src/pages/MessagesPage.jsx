import { useEffect, useState } from "react";
import api from "../api/client";
import SectionCard from "../components/SectionCard";

export default function MessagesPage({ user }) {
  const [conversations, setConversations] = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");

  const loadConversations = async () => setConversations((await api.get("/messages/conversations")).data);
  const loadMessages = async (uid) => setMessages((await api.get(`/messages/${uid}`)).data);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeUserId) loadMessages(activeUserId);
  }, [activeUserId]);

  const send = async () => {
    if (!activeUserId || !text.trim()) return;
    await api.post("/messages", { recipientId: activeUserId, topic: topic || "Сообщение", text });
    setText("");
    await loadMessages(activeUserId);
    await loadConversations();
  };

  return (
    <SectionCard title="Сообщения">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          {conversations.map((c) => (
            <button
              key={c.userId}
              onClick={() => setActiveUserId(c.userId)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                activeUserId === c.userId
                  ? "bg-sky-500/15 border-sky-400 shadow-[0_8px_24px_rgba(56,189,248,0.2)]"
                  : "bg-slate-900/45 border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <div className="font-semibold">{c.fullName}</div>
              <div className="text-xs text-slate-400">{c.lastMessage?.text || "Нет сообщений"}</div>
            </button>
          ))}
        </div>
        <div className="md:col-span-2">
          <div className="h-80 overflow-auto bg-slate-950/75 border border-slate-700 rounded-xl p-3 space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl border ${
                  m.senderId === user?.id
                    ? "bg-sky-500/15 border-sky-400/40 ml-8"
                    : "bg-slate-800/80 border-slate-700 mr-8"
                }`}
              >
                <div className="text-xs text-slate-400">{m.topic}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
            <input className="input md:col-span-1" placeholder="Тема" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <input className="input md:col-span-2" placeholder="Текст сообщения" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn" onClick={send}>Отправить</button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
