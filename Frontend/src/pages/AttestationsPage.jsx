import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

function formatDate(value) {
  if (!value) return "";
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export default function AttestationsPage() {
  const [postgraduates, setPostgraduates] = useState([]);
  const [selectedPostgraduateId, setSelectedPostgraduateId] = useState("");
  const [attestations, setAttestations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newFile, setNewFile] = useState(null);
  const [rowFile, setRowFile] = useState({}); // { [attestationId]: File|null }

  const [form, setForm] = useState({
    periodLabel: "",
    decision: "",
    attestedAt: "",
    notes: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState({
    periodLabel: "",
    decision: "",
    attestedAt: "",
    notes: "",
  });

  const selectedPostgraduate = useMemo(() => {
    const id = parseInt(selectedPostgraduateId, 10);
    return postgraduates.find((p) => p.id === id) || null;
  }, [postgraduates, selectedPostgraduateId]);

  const loadPostgraduates = async () => {
    const { data } = await api.get("/attestations/postgraduates");
    setPostgraduates(Array.isArray(data) ? data : []);
    if (Array.isArray(data) && data.length && !selectedPostgraduateId) {
      setSelectedPostgraduateId(String(data[0].id));
    }
  };

  const loadAttestations = async (postgraduateId) => {
    if (!postgraduateId) {
      setAttestations([]);
      return;
    }
    const { data } = await api.get(`/attestations/postgraduate/${postgraduateId}`);
    setAttestations(Array.isArray(data) ? data : []);
  };

  const reload = async () => {
    try {
      setLoading(true);
      await loadPostgraduates();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPostgraduateId) return;
    loadAttestations(selectedPostgraduateId).catch((e) => toast.error(getErrorMessage(e)));
  }, [selectedPostgraduateId]);

  const createAttestation = async () => {
    try {
      if (!selectedPostgraduateId) return toast.error("Выберите аспиранта");
      if (!form.periodLabel.trim()) return toast.error("Укажите период/сессию аттестации");

      const created = (await api.post(`/attestations/postgraduate/${selectedPostgraduateId}`, {
        periodLabel: form.periodLabel,
        decision: form.decision || null,
        attestedAt: form.attestedAt || null,
        notes: form.notes || null,
      })).data;

      if (newFile) {
        const fd = new FormData();
        fd.append("file", newFile);
        await api.post(`/attestations/${created.id}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      toast.success("Аттестация добавлена");
      setForm({ periodLabel: "", decision: "", attestedAt: "", notes: "" });
      setNewFile(null);
      await loadAttestations(selectedPostgraduateId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditing({
      periodLabel: row.periodLabel || "",
      decision: row.decision || "",
      attestedAt: formatDate(row.attestedAt),
      notes: row.notes || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditing({ periodLabel: "", decision: "", attestedAt: "", notes: "" });
  };

  const saveEdit = async () => {
    try {
      if (!editingId) return;
      if (!editing.periodLabel.trim()) return toast.error("periodLabel обязателен");

      await api.put(`/attestations/${editingId}`, {
        periodLabel: editing.periodLabel,
        decision: editing.decision || null,
        attestedAt: editing.attestedAt || null,
        notes: editing.notes || null,
      });
      toast.success("Сохранено");
      cancelEdit();
      await loadAttestations(selectedPostgraduateId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const deleteRow = async (id) => {
    try {
      if (!window.confirm("Удалить аттестацию?")) return;
      await api.delete(`/attestations/${id}`);
      toast.success("Удалено");
      await loadAttestations(selectedPostgraduateId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const uploadRowFile = async (attestationId) => {
    try {
      const f = rowFile[attestationId];
      if (!f) return toast.error("Выберите файл");
      const fd = new FormData();
      fd.append("file", f);
      await api.post(`/attestations/${attestationId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Файл загружен");
      setRowFile((s) => ({ ...s, [attestationId]: null }));
      await loadAttestations(selectedPostgraduateId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Аттестации аспирантов"
        right={
          <button
            onClick={reload}
            className="rounded-xl px-4 py-2 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
          >
            Обновить
          </button>
        }
      >
        {loading ? <p className="text-slate-400 text-sm">Загрузка…</p> : null}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-3">
              <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Аспирант</div>
              <select
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                value={selectedPostgraduateId}
                onChange={(e) => setSelectedPostgraduateId(e.target.value)}
              >
                {postgraduates.length === 0 ? <option value="">Нет доступных аспирантов</option> : null}
                {postgraduates.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.fullName || u.login} {u.groupName ? `(${u.groupName})` : ""}
                  </option>
                ))}
              </select>

              <div className="text-slate-400 text-xs">
                {selectedPostgraduate
                  ? `email: ${selectedPostgraduate.email || "—"}`
                  : "Выберите аспиранта для просмотра аттестаций"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-3">
              <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Новая аттестация</div>
              <input
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder="Период (например, 2026 весна / 1 семестр)"
                value={form.periodLabel}
                onChange={(e) => setForm((s) => ({ ...s, periodLabel: e.target.value }))}
              />
              <select
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                value={form.decision}
                onChange={(e) => setForm((s) => ({ ...s, decision: e.target.value }))}
              >
                <option value="">Решение (не указано)</option>
                <option value="зачтено">Зачтено</option>
                <option value="не зачтено">Не зачтено</option>
                <option value="допущен">Допущен</option>
                <option value="не допущен">Не допущен</option>
                <option value="перенос">Перенос</option>
              </select>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                value={form.attestedAt}
                onChange={(e) => setForm((s) => ({ ...s, attestedAt: e.target.value }))}
              />
              <textarea
                rows={4}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
                placeholder="Примечания (опционально)"
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg"
                className="w-full text-sm text-slate-300"
                onChange={(e) => setNewFile((e.target.files && e.target.files[0]) ? e.target.files[0] : null)}
              />
              <button
                className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center"
                onClick={createAttestation}
              >
                Добавить
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/55 shadow-inner overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/90">
                  <tr>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Период
                    </th>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Решение
                    </th>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Дата
                    </th>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Примечания
                    </th>
                    <th className="px-3 py-3 text-left uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Отчёт
                    </th>
                    <th className="px-3 py-3 text-right uppercase tracking-wide text-[11px] text-slate-400 font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attestations.length === 0 ? (
                    <tr className="border-t border-slate-800">
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Нет аттестаций.
                      </td>
                    </tr>
                  ) : null}

                  {attestations.map((row) => {
                    const isEditing = editingId === row.id;
                    return (
                      <tr key={row.id} className="border-t border-slate-800 hover:bg-sky-950/30 transition-colors align-top">
                        <td className="px-3 py-2.5 text-slate-200">
                          {isEditing ? (
                            <input
                              className="w-full rounded-lg border border-slate-600/60 bg-slate-950/60 text-slate-100 px-2 py-1.5"
                              value={editing.periodLabel}
                              onChange={(e) => setEditing((s) => ({ ...s, periodLabel: e.target.value }))}
                            />
                          ) : (
                            row.periodLabel || "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {isEditing ? (
                            <input
                              className="w-full rounded-lg border border-slate-600/60 bg-slate-950/60 text-slate-100 px-2 py-1.5"
                              value={editing.decision}
                              onChange={(e) => setEditing((s) => ({ ...s, decision: e.target.value }))}
                              placeholder="Решение"
                            />
                          ) : (
                            row.decision || "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {isEditing ? (
                            <input
                              type="date"
                              className="w-full rounded-lg border border-slate-600/60 bg-slate-950/60 text-slate-100 px-2 py-1.5"
                              value={editing.attestedAt}
                              onChange={(e) => setEditing((s) => ({ ...s, attestedAt: e.target.value }))}
                            />
                          ) : (
                            formatDate(row.attestedAt) || "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {isEditing ? (
                            <textarea
                              rows={3}
                              className="w-full rounded-lg border border-slate-600/60 bg-slate-950/60 text-slate-100 px-2 py-1.5"
                              value={editing.notes}
                              onChange={(e) => setEditing((s) => ({ ...s, notes: e.target.value }))}
                              placeholder="Примечания"
                            />
                          ) : (
                            row.notes || "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          {Array.isArray(row.files) && row.files.length ? (
                            <a
                              className="text-sky-200 underline text-xs"
                              href={`/api/attestations/${row.id}/files/${row.files[0].id}/download`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.files[0].originalName}
                            </a>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg"
                                className="w-full text-xs text-slate-300"
                                onChange={(e) =>
                                  setRowFile((s) => ({
                                    ...s,
                                    [row.id]: (e.target.files && e.target.files[0]) ? e.target.files[0] : null,
                                  }))
                                }
                              />
                              <button
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105"
                                onClick={() => uploadRowFile(row.id)}
                              >
                                Загрузить
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-lg px-3 py-1.5 text-xs font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                                onClick={cancelEdit}
                              >
                                Отмена
                              </button>
                              <button
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-transparent bg-sky-400 text-slate-950 hover:brightness-105"
                                onClick={saveEdit}
                              >
                                Сохранить
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-lg px-3 py-1.5 text-xs font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                                onClick={() => startEdit(row)}
                              >
                                Править
                              </button>
                              <button
                                className="rounded-lg px-3 py-1.5 text-xs font-medium border border-rose-400/60 bg-rose-950/30 hover:bg-rose-950/45 text-rose-100"
                                onClick={() => deleteRow(row.id)}
                              >
                                Удалить
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-slate-400 text-xs mt-3">
              Подсказка: профессору доступны только свои аспиранты (по активным связям руководства). Админ видит всех.
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

