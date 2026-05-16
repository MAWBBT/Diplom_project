/** То же правило, что на бэкенде — для отображения старых записей с битой кодировкой. */
const MOJIBAKE_HINT = /(?:Ã.|Ð.){2,}|[\u00C0-\u00DF][\u0080-\u00BF]/;

export function displayUploadFilename(name) {
  if (!name || typeof name !== "string") return "—";
  const s = name.trim();
  if (!s) return "—";

  if (/[\u0400-\u04FF]/.test(s)) return s;

  if (!/[^\x00-\x7F]/.test(s)) return s;

  if (MOJIBAKE_HINT.test(s) || /[^\x00-\x7F]/.test(s)) {
    try {
      const bytes = new Uint8Array([...s].map((ch) => ch.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (decoded && !decoded.includes("\uFFFD")) return decoded;
    } catch {
      /* ignore */
    }
  }

  return s;
}
