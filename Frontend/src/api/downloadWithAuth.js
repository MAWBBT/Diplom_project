import api from "./client";
import { displayUploadFilename } from "../utils/uploadFilename";

function parseFilenameFromContentDisposition(header) {
  if (!header || typeof header !== "string") return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].replace(/(^")|("$)/g, ""));
    } catch {
      return utf8[1];
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename=([^;\s]+)/i);
  return plain?.[1] ? plain[1].replace(/(^")|("$)/g, "") : null;
}

/**
 * GET по пути относительно axios baseURL (/api), с Bearer из interceptors — для скачивания файлов без открытия новой вкладки без заголовков.
 *
 * @param {string} pathFromApiRoot например `/postgraduate/plan-items/1/files/2/download`
 * @param {string} [fallbackFilename]
 */
export async function downloadWithAuth(pathFromApiRoot, fallbackFilename) {
  const path = pathFromApiRoot.startsWith("/") ? pathFromApiRoot : `/${pathFromApiRoot}`;
  try {
    const res = await api.get(path, { responseType: "blob" });
    const rawName =
      parseFilenameFromContentDisposition(res.headers["content-disposition"]) ||
      fallbackFilename ||
      "file";
    const name = displayUploadFilename(rawName);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    const data = err.response?.data;
    if (data instanceof Blob) {
      const raw = await data.text();
      let message = raw;
      try {
        const j = JSON.parse(raw);
        if (j != null && j.error != null) message = String(j.error);
      } catch (_) {
        /* ответ не JSON */
      }
      throw new Error(message || "Ошибка скачивания");
    }
    throw err;
  }
}
