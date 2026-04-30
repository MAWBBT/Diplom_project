const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  ReportFile,
  User,
  Grade,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  IndividualPlan,
  Attestation
} = require('../models');

const router = express.Router();
const adminOnly = [requireAuth, requireRole('admin')];

const reportsRoot = path.join(__dirname, '../uploads/reports');
if (!fs.existsSync(reportsRoot)) {
  fs.mkdirSync(reportsRoot, { recursive: true });
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

function styleHeaderRow(ws) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle' };
  ws.columns.forEach((c) => {
    c.width = Math.min(48, Math.max(12, (c.header ? String(c.header).length : 12) + 4));
  });
}

async function buildGradesWorkbook({ dateFrom, dateTo }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Digital Campus';
  wb.created = new Date();

  const ws = wb.addWorksheet('Успеваемость');
  ws.columns = [
    { header: 'Аспирант', key: 'postgraduate' },
    { header: 'Группа', key: 'groupName' },
    { header: 'Дисциплина', key: 'subject' },
    { header: 'Тип контроля', key: 'controlType' },
    { header: 'Оценка', key: 'grade' },
    { header: 'Комментарий', key: 'comment' },
    { header: 'Дата', key: 'createdAt' }
  ];

  const where = {};
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) where.createdAt[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
  }

  const rows = await Grade.findAll({
    where,
    include: [
      { model: Subject, as: 'subjectRef', attributes: ['id', 'name'] },
      { model: User, as: 'user', attributes: ['id', 'fullName', 'groupName'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: 50000
  });

  for (const r of rows) {
    ws.addRow({
      postgraduate: r.user?.fullName || '',
      groupName: r.user?.groupName || '',
      subject: r.subjectRef?.name || '',
      controlType: r.controlType || '',
      grade: r.grade || '',
      comment: r.comment || '',
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : ''
    });
  }
  styleHeaderRow(ws);
  return wb;
}

async function buildAttendanceWorkbook({ dateFrom, dateTo }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Digital Campus';
  wb.created = new Date();

  const ws = wb.addWorksheet('Посещаемость');
  ws.columns = [
    { header: 'Дата', key: 'heldOn' },
    { header: 'Группа', key: 'groupName' },
    { header: 'Дисциплина', key: 'subject' },
    { header: 'Преподаватель', key: 'teacher' },
    { header: 'Аспирант', key: 'postgraduate' },
    { header: 'Статус', key: 'status' },
    { header: 'Комментарий', key: 'note' }
  ];

  const whereSession = {};
  if (dateFrom || dateTo) {
    whereSession.heldOn = {};
    if (dateFrom) whereSession.heldOn[Op.gte] = dateFrom;
    if (dateTo) whereSession.heldOn[Op.lte] = dateTo;
  }

  const records = await AttendanceRecord.findAll({
    include: [
      {
        model: AttendanceSession,
        as: 'session',
        where: whereSession,
        include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }]
      },
      { model: User, as: 'postgraduate', attributes: ['id', 'fullName'] }
    ],
    order: [[{ model: AttendanceSession, as: 'session' }, 'heldOn', 'DESC']],
    limit: 50000
  });

  for (const r of records) {
    ws.addRow({
      heldOn: r.session?.heldOn || '',
      groupName: r.session?.groupName || '',
      subject: r.session?.subjectRef?.name || '',
      teacher: r.session?.teacher || '',
      postgraduate: r.postgraduate?.fullName || '',
      status: r.status,
      note: r.note || ''
    });
  }
  styleHeaderRow(ws);
  return wb;
}

async function buildPlansWorkbook({ academicYear }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Digital Campus';
  wb.created = new Date();

  const ws = wb.addWorksheet('Индивидуальные планы');
  ws.columns = [
    { header: 'Аспирант', key: 'postgraduate' },
    { header: 'Группа', key: 'groupName' },
    { header: 'Учебный год', key: 'academicYear' },
    { header: 'Статус', key: 'status' },
    { header: 'Обновлено', key: 'updatedAt' }
  ];

  const where = {};
  if (academicYear) where.academicYear = String(academicYear).trim();

  const plans = await IndividualPlan.findAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] }],
    order: [['updatedAt', 'DESC']],
    limit: 50000
  });

  for (const p of plans) {
    ws.addRow({
      postgraduate: p.owner?.fullName || '',
      groupName: p.owner?.groupName || '',
      academicYear: p.academicYear,
      status: p.status,
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleString('ru-RU') : ''
    });
  }
  styleHeaderRow(ws);
  return wb;
}

async function buildAttestationsWorkbook({ dateFrom, dateTo }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Digital Campus';
  wb.created = new Date();

  const ws = wb.addWorksheet('Аттестации');
  ws.columns = [
    { header: 'Аспирант', key: 'postgraduate' },
    { header: 'Группа', key: 'groupName' },
    { header: 'Период', key: 'periodLabel' },
    { header: 'Результат', key: 'decision' },
    { header: 'Дата аттестации', key: 'attestedAt' },
    { header: 'Примечания', key: 'notes' },
    { header: 'Создано', key: 'createdAt' }
  ];

  const where = {};
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) where.createdAt[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
  }

  const rows = await Attestation.findAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] }],
    order: [['createdAt', 'DESC']],
    limit: 50000
  });

  for (const a of rows) {
    ws.addRow({
      postgraduate: a.owner?.fullName || '',
      groupName: a.owner?.groupName || '',
      periodLabel: a.periodLabel,
      decision: a.decision || '',
      attestedAt: a.attestedAt || '',
      notes: a.notes || '',
      createdAt: a.createdAt ? new Date(a.createdAt).toLocaleString('ru-RU') : ''
    });
  }
  styleHeaderRow(ws);
  return wb;
}

const REPORT_TYPES = {
  grades: { title: 'Сводная успеваемость', builder: buildGradesWorkbook },
  attendance: { title: 'Сводная посещаемость', builder: buildAttendanceWorkbook },
  plans: { title: 'Состояние индивидуальных планов', builder: buildPlansWorkbook },
  attestations: { title: 'Результаты аттестаций', builder: buildAttestationsWorkbook }
};

router.get('/', ...adminOnly, async (_req, res) => {
  const rows = await ReportFile.findAll({
    order: [['createdAt', 'DESC']],
    limit: 50,
    include: [{ model: User, as: 'generatedBy', attributes: ['id', 'fullName', 'login'] }]
  });
  res.json(rows);
});

router.post('/generate', ...adminOnly, async (req, res) => {
  try {
    const { type, dateFrom, dateTo, academicYear } = req.body || {};
    const spec = REPORT_TYPES[type];
    if (!spec) {
      return res.status(400).json({ error: 'type: grades | attendance | plans | attestations' });
    }

    const df = normalizeDateOnly(dateFrom);
    const dt = normalizeDateOnly(dateTo);
    const ay = academicYear ? String(academicYear).trim() : null;

    const wb = await spec.builder({ dateFrom: df, dateTo: dt, academicYear: ay });

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const originalName = `${type}-${ts}.xlsx`;
    const storedName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.xlsx`;
    const fp = path.join(reportsRoot, storedName);
    await wb.xlsx.writeFile(fp);

    const stat = fs.statSync(fp);
    const row = await ReportFile.create({
      reportType: type,
      storedName,
      originalName,
      size: stat.size,
      generatedById: req.user.id,
      params: safeJson({ dateFrom: df, dateTo: dt, academicYear: ay })
    });

    res.status(201).json(row);
  } catch (e) {
    console.error('reports/generate:', e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/:id/download', ...adminOnly, async (req, res) => {
  const row = await ReportFile.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Не найдено' });
  const fp = path.join(reportsRoot, row.storedName);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
  res.download(fp, row.originalName);
});

module.exports = router;

