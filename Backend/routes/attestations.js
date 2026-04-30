const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { userSupervisesPostgraduate } = require('../utils/supervision');
const { notifyUser } = require('../utils/notify');
const { writeAudit } = require('../utils/audit');
const { Attestation, AttestationFile, User } = require('../models');

function normalizeDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Accept YYYY-MM-DD (DATEONLY). If a full ISO is passed, cut it.
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

async function assertCanManagePostgraduate(req, postgraduateId) {
  if (req.user.role === 'admin') return true;
  if (req.user.role !== 'professor') return false;
  return userSupervisesPostgraduate(req.user.id, postgraduateId);
}

function canAccessAttestation(req, attestation) {
  if (!req.user || !attestation) return false;
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'postgraduate') return attestation.userId === req.user.id;
  if (req.user.role === 'professor') return true; // checked via assertCanManagePostgraduate when needed
  return false;
}

const uploadRoot = path.join(__dirname, '../uploads/attestations');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ];
  if (allowedMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Недопустимый формат файла'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter
});

// GET /api/attestations/me - список аттестаций текущего аспиранта
router.get('/me', requireAuth, requireRole('postgraduate'), async (req, res) => {
  const rows = await Attestation.findAll({
    where: { userId: req.user.id },
    include: [{ model: AttestationFile, as: 'files' }],
    order: [['attestedAt', 'DESC'], ['createdAt', 'DESC']]
  });
  res.json(rows);
});

// GET /api/attestations/postgraduates - список доступных аспирантов (для профессора/админа)
router.get('/postgraduates', requireAuth, requireRole('professor', 'admin'), async (req, res) => {
  if (req.user.role === 'admin') {
    const list = await User.findAll({
      where: { role: 'postgraduate' },
      attributes: ['id', 'fullName', 'login', 'groupName', 'email'],
      order: [['groupName', 'ASC'], ['fullName', 'ASC']]
    });
    return res.json(list.map((u) => u.toSafeJSON()));
  }

  // professor: показываем только тех, кем руководит (через таблицу supervision)
  const { Supervision } = require('../models');
  const links = await Supervision.findAll({
    where: { supervisorId: req.user.id, isActive: true },
    attributes: ['postgraduateId']
  });
  const postgraduateIds = links.map((l) => l.postgraduateId).filter(Boolean);
  if (!postgraduateIds.length) return res.json([]);

  const list = await User.findAll({
    where: { id: { [Op.in]: postgraduateIds } },
    attributes: ['id', 'fullName', 'login', 'groupName', 'email'],
    order: [['groupName', 'ASC'], ['fullName', 'ASC']]
  });
  res.json(list.map((u) => u.toSafeJSON()));
});

// GET /api/attestations/postgraduate/:userId - список аттестаций аспиранта
router.get('/postgraduate/:userId', requireAuth, requireRole('professor', 'admin'), async (req, res) => {
  const postgraduateId = parseInt(req.params.userId, 10);
  if (!postgraduateId) return res.status(400).json({ error: 'Некорректный userId' });

  const ok = await assertCanManagePostgraduate(req, postgraduateId);
  if (!ok) return res.status(403).json({ error: 'Нет доступа к этому аспиранту' });

  const rows = await Attestation.findAll({
    where: { userId: postgraduateId },
    include: [{ model: AttestationFile, as: 'files' }],
    order: [['attestedAt', 'DESC'], ['createdAt', 'DESC']]
  });
  res.json(rows);
});

// POST /api/attestations/postgraduate/:userId - создать аттестацию аспиранта
router.post('/postgraduate/:userId', requireAuth, requireRole('professor', 'admin'), async (req, res) => {
  const postgraduateId = parseInt(req.params.userId, 10);
  if (!postgraduateId) return res.status(400).json({ error: 'Некорректный userId' });

  const ok = await assertCanManagePostgraduate(req, postgraduateId);
  if (!ok) return res.status(403).json({ error: 'Нет доступа к этому аспиранту' });

  const { periodLabel, decision, notes, attestedAt } = req.body || {};
  if (!periodLabel || String(periodLabel).trim() === '') {
    return res.status(400).json({ error: 'Укажите период (periodLabel)' });
  }

  const row = await Attestation.create({
    userId: postgraduateId,
    periodLabel: String(periodLabel).trim(),
    decision: decision != null && String(decision).trim() !== '' ? String(decision).trim() : null,
    notes: notes != null && String(notes).trim() !== '' ? String(notes).trim() : null,
    attestedAt: normalizeDateOnly(attestedAt)
  });

  await writeAudit(req.user.id, 'attestation_create', 'Attestation', row.id, { postgraduateId });
  await notifyUser(
    postgraduateId,
    'Аттестация',
    `Добавлена аттестация: ${row.periodLabel}${row.decision ? ` (${row.decision})` : ''}`,
    '/attestations'
  );

  res.status(201).json(row);
});

// POST /api/attestations/:id/files — загрузить отчёт к аттестации (professor/admin)
router.post('/:id/files', requireAuth, requireRole('professor', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Некорректный id' });

    const att = await Attestation.findByPk(id);
    if (!att) return res.status(404).json({ error: 'Аттестация не найдена' });

    const ok = await assertCanManagePostgraduate(req, att.userId);
    if (!ok) return res.status(403).json({ error: 'Нет доступа' });
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

    const row = await AttestationFile.create({
      attestationId: att.id,
      storedName: req.file.filename,
      originalName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.user.id
    });

    await writeAudit(req.user.id, 'attestation_file_upload', 'AttestationFile', row.id, { attestationId: att.id, postgraduateId: att.userId });
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/attestations/:id/files/:fileId/download — скачать отчёт (postgraduate owner, supervisor, admin)
router.get('/:id/files/:fileId/download', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const fileId = parseInt(req.params.fileId, 10);
    if (!id || !fileId) return res.status(400).json({ error: 'Некорректный id' });

    const att = await Attestation.findByPk(id);
    if (!att) return res.status(404).json({ error: 'Аттестация не найдена' });

    if (req.user.role === 'postgraduate' && att.userId !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (req.user.role === 'professor') {
      const ok = await assertCanManagePostgraduate(req, att.userId);
      if (!ok) return res.status(403).json({ error: 'Нет доступа' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'postgraduate' && req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (!canAccessAttestation(req, att)) return res.status(403).json({ error: 'Нет доступа' });

    const f = await AttestationFile.findOne({ where: { id: fileId, attestationId: att.id } });
    if (!f) return res.status(404).json({ error: 'Файл не найден' });
    const fp = path.join(uploadRoot, f.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
    res.download(fp, f.originalName);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/attestations/:id - обновить аттестацию
router.put('/:id', requireAuth, requireRole('professor', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Некорректный id' });

  const row = await Attestation.findByPk(id);
  if (!row) return res.status(404).json({ error: 'Аттестация не найдена' });

  const ok = await assertCanManagePostgraduate(req, row.userId);
  if (!ok) return res.status(403).json({ error: 'Нет доступа к этой аттестации' });

  const { periodLabel, decision, notes, attestedAt } = req.body || {};
  if (periodLabel !== undefined) row.periodLabel = String(periodLabel).trim();
  if (decision !== undefined) row.decision = decision != null && String(decision).trim() !== '' ? String(decision).trim() : null;
  if (notes !== undefined) row.notes = notes != null && String(notes).trim() !== '' ? String(notes).trim() : null;
  if (attestedAt !== undefined) row.attestedAt = normalizeDateOnly(attestedAt);

  if (!row.periodLabel || row.periodLabel.trim() === '') {
    return res.status(400).json({ error: 'periodLabel обязателен' });
  }

  await row.save();
  await writeAudit(req.user.id, 'attestation_update', 'Attestation', row.id, { postgraduateId: row.userId });

  await notifyUser(
    row.userId,
    'Аттестация',
    `Обновлена аттестация: ${row.periodLabel}${row.decision ? ` (${row.decision})` : ''}`,
    '/attestations'
  );

  res.json(row);
});

// DELETE /api/attestations/:id - удалить аттестацию
router.delete('/:id', requireAuth, requireRole('professor', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Некорректный id' });

  const row = await Attestation.findByPk(id);
  if (!row) return res.status(404).json({ error: 'Аттестация не найдена' });

  const ok = await assertCanManagePostgraduate(req, row.userId);
  if (!ok) return res.status(403).json({ error: 'Нет доступа к этой аттестации' });

  const pgId = row.userId;
  const label = row.periodLabel;
  await row.destroy();

  await writeAudit(req.user.id, 'attestation_delete', 'Attestation', id, { postgraduateId: pgId });
  await notifyUser(pgId, 'Аттестация', `Удалена аттестация: ${label}`, '/attestations');

  res.status(204).end();
});

module.exports = router;

