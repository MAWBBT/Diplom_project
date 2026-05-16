const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { labelEnum } = require('../utils/reportLabels');
const { addReportSheet, createWorkbook } = require('../utils/reportSheet');
const {
  ReportFile,
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
      { header: 'Дата занятия', key: 'heldOn' },
      { header: 'Группа', key: 'groupName' },
      { header: 'Дисциплина', key: 'subject' },
      { header: 'Преподаватель', key: 'teacher' },
      { header: 'Аспирант', key: 'postgraduate' },
      { header: 'Статус', key: 'status' },
      { header: 'Комментарий', key: 'note' }
    ],
    records.map((r) => ({
      heldOn: r.session?.heldOn || '',
      groupName: r.session?.groupName || '',
      subject: r.session?.subjectRef?.name || '',
      teacher: r.session?.teacher || '',
      postgraduate: r.postgraduate?.fullName || '',
      status: labelEnum(r.status),
      note: r.note || ''
    }))
  );

  return wb;
}

async function buildPlansWorkbook(params) {
  const { academicYear } = params;
  const wb = createWorkbook();

  const planWhere = {};
  if (academicYear) planWhere.academicYear = String(academicYear).trim();

  const plans = await IndividualPlan.findAll({
    where: planWhere,
    include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] }],
    order: [['updatedAt', 'DESC']],
    limit: 50000
  });

  addReportSheet(
    wb,
    'Состояние планов',
    params,
    [
      { header: 'Аспирант', key: 'postgraduate' },
      { header: 'Группа', key: 'groupName' },
      { header: 'Учебный год', key: 'academicYear' },
      { header: 'Статус плана', key: 'status' },
      { header: 'Обновлено', key: 'updatedAt' }
    ],
    plans.map((p) => ({
      postgraduate: p.owner?.fullName || '',
      groupName: p.owner?.groupName || '',
      academicYear: p.academicYear,
      status: labelEnum(p.status),
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleString('ru-RU') : ''
    }))
  );

  const items = await PlanItem.findAll({
    include: [
      {
        model: IndividualPlan,
        as: 'plan',
        where: planWhere,
        required: true,
        include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] }]
      }
    ],
    order: [
      [{ model: IndividualPlan, as: 'plan' }, 'academicYear', 'DESC'],
      ['orderIdx', 'ASC']
    ],
    limit: 50000
  });

  addReportSheet(
    wb,
    'Этапы индивидуальных планов',
    params,
    [
      { header: 'Аспирант', key: 'postgraduate' },
      { header: 'Группа', key: 'groupName' },
      { header: 'Учебный год', key: 'academicYear' },
      { header: 'Этап', key: 'title' },
      { header: 'Статус этапа', key: 'status' },
      { header: 'Срок', key: 'dueDate' },
      { header: 'Выполнено', key: 'completedAt' }
    ],
    items.map((it) => ({
      postgraduate: it.plan?.owner?.fullName || '',
      groupName: it.plan?.owner?.groupName || '',
      academicYear: it.plan?.academicYear || '',
      title: it.title,
      status: labelEnum(it.status),
      dueDate: it.dueDate || '',
      completedAt: it.completedAt || ''
    }))
  );

  return wb;
}

async function buildAttestationsWorkbook(params) {
  const { dateFrom, dateTo } = params;
  const wb = createWorkbook();

  const rows = await Attestation.findAll({
    where: createdAtRange(dateFrom, dateTo),
    include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] }],
    order: [['createdAt', 'DESC']],
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
      { header: 'Результат', key: 'decision' },
      { header: 'Дата аттестации', key: 'attestedAt' },
      { header: 'Примечания', key: 'notes' },
      { header: 'Запись создана', key: 'createdAt' }
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

    if (df && dt && df > dt) {
      return res.status(400).json({ error: 'Дата «с» не может быть позже даты «по»' });
    }

    const filterParams =
      type === 'plans'
        ? { academicYear: ay || null }
        : { dateFrom: df, dateTo: dt };

    const wb = await spec.builder(filterParams);

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
      params: safeJson(filterParams)
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
