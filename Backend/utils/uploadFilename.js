/**
 * Имена файлов из multipart часто приходят в UTF-8, а multer/busboy читают их как latin1 → «ÐÐ¾Ð¼…».
 */

const MOJIBAKE_HINT = /(?:Ã.|Ð.){2,}|[\u00C0-\u00DF][\u0080-\u00BF]/;

function normalizeUploadFilename(name) {
  if (!name || typeof name !== 'string') return 'file';
  const s = name.trim() || 'file';

  if (/[\u0400-\u04FF]/.test(s)) {
    return s.normalize('NFC');
  }

  if (!/[^\x00-\x7F]/.test(s)) {
    return s;
  }

  if (MOJIBAKE_HINT.test(s) || /[^\x00-\x7F]/.test(s)) {
    try {
      const decoded = Buffer.from(s, 'latin1').toString('utf8').normalize('NFC');
      if (decoded && !decoded.includes('\uFFFD')) {
        return decoded;
      }
    } catch {
      /* ignore */
    }
  }

  return s.normalize('NFC');
}

function contentDispositionAttachment(filename) {
  const name = normalizeUploadFilename(filename);
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/\\/g, '_').replace(/"/g, "'");
  const encoded = encodeURIComponent(name)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * @param {import('express').Response} res
 * @param {string} filePath
 * @param {string} [downloadName]
 */
function sendFileDownload(res, filePath, downloadName) {
  const path = require('path');
  const abs = path.resolve(filePath);
  const name = normalizeUploadFilename(downloadName || path.basename(abs));
  res.setHeader('Content-Disposition', contentDispositionAttachment(name));
  res.sendFile(abs);
}

module.exports = {
  normalizeUploadFilename,
  contentDispositionAttachment,
  sendFileDownload
};
