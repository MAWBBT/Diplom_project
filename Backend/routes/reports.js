const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { addReportSheet, createWorkbook } = require('../utils/reportSheet');
const {
  User,
  Grade,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  IndividualPlan,
  PlanItem,
  Attestation
} = require('../models');

const router = express.Router();
const adminOnly = [requireAuth, requireRole('admin')];

const reportsRoot = path.join(__dirname, '../uploads/reports');
if (!fs.existsSync(reportsRoot)) {
  fs.mkdirSync(reportsRoot, { recursive: true });
}

function metaPath(storedName) {
  return path.join(reportsRoot, `${storedName}.json`);
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

function createdAtRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const where = {};
  if (dateFrom) where[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
  if (dateTo) where[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
  return { createdAt: where };
}

function heldOnRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const where = {};
  if (dateFrom) where[Op.gte] = dateFrom;
  if (dateTo) where[Op.lte] = dateTo;
  return { heldOn: where };
}

function listReportsFromDisk() {
  if (!fs.existsSync(reportsRoot)) return [];
  const files = fs
    .readdirSync(reportsRoot)
    .filter((f) => f.endsWith('.xlsx'))
    .map((storedName) => {
      const fp = path.join(reportsRoot, storedName);
      const stat = fs.statSync(fp);
      let meta = {};
      const mp = metaPath(storedName);
      if (fs.existsSync(mp)) {
        try {
          meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
        } catch {
          meta = {};
        }
      }
      return {
        id: storedName,
        reportType: meta.reportType || 'unknown',
        originalName: meta.originalName || storedName,
        params: meta.params || null,
        createdAt: stat.mtime,
        generatedBy: meta.generatedBy || null
      };
    });
  return files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
}

async function buildGradesWorkbook(params) {
  const { dateFrom, dateTo } = params;
  const wb = createWorkbook();

  const rows = await Grade.findAll({
    where: createdAtRange(dateFrom, dateTo),
    include: [
      { model: Subject, as: 'subjectRef', attributes: ['id', 'name'] },
      { model: User, as: 'user', attributes: ['id', 'fullName', 'groupName'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: 50000
  });

  addReportSheet(
    wb,
    'Сводная успеваемость',
    params,
    [
      { header: 'Аспирант', key: 'postgraduate' },
      { header: 'Группа', key: 'groupName' },
      { header: 'Дисциплина', key: 'subject' },
      { header: 'Тип контроля', key: 'controlType' },
      { header: 'Оценка', key: 'grade' },
      { header: 'Комментарий', key: 'comment' },
      { header: 'Дата', key: 'createdAt' }
    ],
    rows.map((r) => ({
      postgraduate: r.user?.fullName || '',
      groupName: r.user?.groupName || '',
      subject: r.subjectRef?.name || '',
      controlType: r.controlType || '',
      grade: r.grade || '',
      comment: r.comment || '',
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : ''
    }))
  );

  return wb;
}

async function buildAttendanceWorkbook(params) {
  const { dateFrom, dateTo } = params;
  const wb = createWorkbook();
  const sessionWhere = heldOnRange(dateFrom, dateTo);

  const records = await AttendanceRecord.findAll({
    include: [
      {
        model: AttendanceSession,
        as: 'session',
        where: Object.keys(sessionWhere).length ? sessionWhere : undefined,
        required: Object.keys(sessionWhere).length > 0,
        include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }]
      },
      { model: User, as: 'postgraduate', attributes: ['id', 'fullName', 'groupName'] }
    ],
    order: [[{ model: AttendanceSession, as: 'session' }, 'heldOn', 'DESC']],
    limit: 50000
  });

  addReportSheet(
    wb,
    'Сводная посещаемость',
    params,
    [
      { header: 'Аспирант', key: 'postgraduate' },
      { header: 'Группа', key: 'groupName' },
      { header: 'Дисциплина', key: 'subject' },
      { header: 'Дата занятия', key: 'heldOn' },
      { header: 'Статус', key: 'status' }
    ],
    records.map((r) => ({
      postgraduate: r.postgraduate?.fullName || '',
      groupName: r.postgraduate?.groupName || '',
      subject: r.session?.subjectRef?.name || '',
      heldOn: r.session?.heldOn || '',
      status: r.status || ''
    }))
  );

  return wb;
}

async function buildPlansWorkbook(params) {
  const { academicYear } = params;
  const wb = createWorkbook();
  const planWhere = academicYear ? { academicYear } : {};

  const plans = await IndividualPlan.findAll({
    where: planWhere,
    include: [
      { model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] },
      { model: PlanItem, as: 'items' }
    ],
    order: [['academicYear', 'DESC']],
    limit: 5000
  });

  const rows = [];
  for (const p of plans) {
    for (const it of p.items || []) {
      rows.push({
        postgraduate: p.owner?.fullName || '',
        groupName: p.owner?.groupName || '',
        academicYear: p.academicYear,
        planStatus: p.status,
        itemTitle: it.title,
        itemStatus: it.status,
        dueDate: it.dueDate || ''
      });
    }
  }

  addReportSheet(
    wb,
    'Состояние индивидуальных планов',
    params,
    [
      { header: 'Аспирант', key: 'postgraduate' },
      { header: 'Группа', key: 'groupName' },
      { header: 'Учебный год', key: 'academicYear' },
      { header: 'Статус плана', key: 'planStatus' },
      { header: 'Этап', key: 'itemTitle' },
      { header: 'Статус этапа', key: 'itemStatus' },
      { header: 'Срок', key: 'dueDate' }
    ],
    rows
  );

  return wb;
}

async function buildAttestationsWorkbook(params) {
  const { dateFrom, dateTo } = params;
  const wb = createWorkbook();
  const where = {};
  if (dateFrom || dateTo) {
    where.attestedAt = {};
    if (dateFrom) where.attestedAt[Op.gte] = dateFrom;
    if (dateTo) where.attestedAt[Op.lte] = dateTo;
  }

  const rows = await Attestation.findAll({
    where: Object.keys(where).length ? where : undefined,
    include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] }],
    order: [['attestedAt', 'DESC']],
    limit: 50000
  });

  addReportSheet(
    wb,
    'Результаты аттестаций',
    params,
    [
      { header: 'Аспирант', key: 'postgraduate' },
      { header: 'Группа', key: 'groupName' },
      { header: 'Период', key: 'periodLabel' },
      { header: 'Решение', key: 'decision' },
      { header: 'Дата', key: 'attestedAt' },
      { header: 'Примечания', key: 'notes' },
      { header: 'Создано', key: 'createdAt' }
    ],
    rows.map((a) => ({
      postgraduate: a.owner?.fullName || '',
      groupName: a.owner?.groupName || '',
      periodLabel: a.periodLabel,
      decision: a.decision || '',
      attestedAt: a.attestedAt || '',
      notes: a.notes || '',
      createdAt: a.createdAt ? new Date(a.createdAt).toLocaleString('ru-RU') : ''
    }))
  );

  return wb;
}

const REPORT_TYPES = {
  grades: { title: 'Сводная успеваемость', builder: buildGradesWorkbook },
  attendance: { title: 'Сводная посещаемость', builder: buildAttendanceWorkbook },
  plans: { title: 'Состояние индивидуальных планов', builder: buildPlansWorkbook },
  attestations: { title: 'Результаты аттестаций', builder: buildAttestationsWorkbook }
};

router.get('/', ...adminOnly, async (_req, res) => {
  res.json(listReportsFromDisk());
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

    if (df && dt && df > dt) {
      return res.status(400).json({ error: 'Дата «с» не может быть позже даты «по»' });
    }

    const filterParams =
      type === 'plans' ? { academicYear: ay || null } : { dateFrom: df, dateTo: dt };

    const wb = await spec.builder(filterParams);

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const originalName = `${type}-${ts}.xlsx`;
    const storedName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.xlsx`;
    const fp = path.join(reportsRoot, storedName);
    await wb.xlsx.writeFile(fp);

    const stat = fs.statSync(fp);
    const generatedBy = {
      id: req.user.id,
      fullName: req.user.fullName,
      login: req.user.login
    };
    fs.writeFileSync(
      metaPath(storedName),
      JSON.stringify({
        reportType: type,
        originalName,
        params: filterParams,
        generatedBy
      }),
      'utf8'
    );

    res.status(201).json({
      id: storedName,
      reportType: type,
      storedName,
      originalName,
      size: stat.size,
      params: safeJson(filterParams),
      createdAt: stat.mtime,
      generatedBy
    });
  } catch (e) {
    console.error('reports/generate:', e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/:id/download', ...adminOnly, async (req, res) => {
  const storedName = path.basename(req.params.id);
  const fp = path.join(reportsRoot, storedName);
  if (!storedName.endsWith('.xlsx') || !fs.existsSync(fp)) {
    return res.status(404).json({ error: 'Не найдено' });
  }
  let originalName = storedName;
  const mp = metaPath(storedName);
  if (fs.existsSync(mp)) {
    try {
      const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
      if (meta.originalName) originalName = meta.originalName;
    } catch {
      /* ignore */
    }
  }
  res.download(fp, originalName);
});

module.exports = router;
