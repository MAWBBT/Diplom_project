const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  CurriculumPlan,
  CurriculumItem,
  Subject,
  Program,
  PostgraduateProfile
} = require('../models');

function normalizeYear(value) {
  if (!value) return null;
  const s = String(value).trim();
  return s ? s : null;
}

async function resolveProgramIdForUser(user) {
  if (!user) return null;
  if (user.role === 'postgraduate') {
    const p = await PostgraduateProfile.findOne({ where: { userId: user.id } });
    return p?.programId || null;
  }
  return null;
}

// GET /api/curriculum/me - просмотр учебного плана для текущего аспиранта (по programId) или пусто
router.get('/me', requireAuth, async (req, res) => {
  try {
    const academicYear = normalizeYear(req.query.academicYear);
    const programId = await resolveProgramIdForUser(req.user);
    if (!programId) return res.json(null);

    const where = { programId };
    if (academicYear) where.academicYear = academicYear;

    const plan = await CurriculumPlan.findOne({
      where,
      include: [
        { model: Program, as: 'program', attributes: ['id', 'code', 'name'] },
        { model: CurriculumItem, as: 'items', include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }] }
      ],
      order: [[{ model: CurriculumItem, as: 'items' }, 'semester', 'ASC'], [{ model: CurriculumItem, as: 'items' }, 'id', 'ASC']]
    });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/curriculum/program/:programId - просмотр плана по программе (для любой авторизованной роли)
router.get('/program/:programId', requireAuth, async (req, res) => {
  try {
    const programId = parseInt(req.params.programId, 10);
    if (!programId) return res.status(400).json({ error: 'Некорректный programId' });
    const academicYear = normalizeYear(req.query.academicYear);
    const where = { programId };
    if (academicYear) where.academicYear = academicYear;

    const plan = await CurriculumPlan.findOne({
      where,
      include: [
        { model: Program, as: 'program', attributes: ['id', 'code', 'name'] },
        { model: CurriculumItem, as: 'items', include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }] }
      ],
      order: [[{ model: CurriculumItem, as: 'items' }, 'semester', 'ASC'], [{ model: CurriculumItem, as: 'items' }, 'id', 'ASC']]
    });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Админ-часть: управление учебным планом
router.get('/admin/plans', requireAuth, requireRole('admin'), async (req, res) => {
  const { programId, academicYear } = req.query || {};
  const where = {};
  if (programId) where.programId = parseInt(programId, 10);
  if (academicYear) where.academicYear = normalizeYear(academicYear);

  const plans = await CurriculumPlan.findAll({
    where,
    include: [{ model: Program, as: 'program', attributes: ['id', 'code', 'name'] }],
    order: [['academicYear', 'DESC'], ['id', 'DESC']],
    limit: 200
  });
  res.json(plans);
});

router.post('/admin/plans', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { programId, academicYear, title } = req.body || {};
    if (!programId || !academicYear || !title) {
      return res.status(400).json({ error: 'Укажите programId, academicYear, title' });
    }
    const plan = await CurriculumPlan.create({
      programId: parseInt(programId, 10),
      academicYear: String(academicYear).trim(),
      title: String(title).trim()
    });
    res.status(201).json(plan);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'План для этой программы и года уже существует' });
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/admin/plans/:planId', requireAuth, requireRole('admin'), async (req, res) => {
  const plan = await CurriculumPlan.findByPk(req.params.planId, {
    include: [
      { model: Program, as: 'program', attributes: ['id', 'code', 'name'] },
      { model: CurriculumItem, as: 'items', include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }] }
    ],
    order: [[{ model: CurriculumItem, as: 'items' }, 'semester', 'ASC'], [{ model: CurriculumItem, as: 'items' }, 'id', 'ASC']]
  });
  if (!plan) return res.status(404).json({ error: 'План не найден' });
  res.json(plan);
});

router.put('/admin/plans/:planId', requireAuth, requireRole('admin'), async (req, res) => {
  const plan = await CurriculumPlan.findByPk(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'План не найден' });
  const { academicYear, title, programId } = req.body || {};
  if (academicYear !== undefined) plan.academicYear = String(academicYear).trim();
  if (title !== undefined) plan.title = String(title).trim();
  if (programId !== undefined) plan.programId = parseInt(programId, 10);
  await plan.save();
  res.json(plan);
});

router.delete('/admin/plans/:planId', requireAuth, requireRole('admin'), async (req, res) => {
  const plan = await CurriculumPlan.findByPk(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'План не найден' });
  await CurriculumItem.destroy({ where: { planId: plan.id } });
  await plan.destroy();
  res.status(204).end();
});

router.post('/admin/items', requireAuth, requireRole('admin'), async (req, res) => {
  const { planId, subjectId, hours, controlForm, semester, notes } = req.body || {};
  if (!planId || !subjectId || !controlForm) {
    return res.status(400).json({ error: 'Укажите planId, subjectId, controlForm' });
  }
  const plan = await CurriculumPlan.findByPk(planId);
  if (!plan) return res.status(404).json({ error: 'План не найден' });
  const item = await CurriculumItem.create({
    planId: plan.id,
    subjectId: parseInt(subjectId, 10),
    hours: hours != null ? parseInt(hours, 10) : 0,
    controlForm: String(controlForm).trim(),
    semester: semester != null ? parseInt(semester, 10) : null,
    notes: notes || null
  });
  res.status(201).json(item);
});

router.put('/admin/items/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const item = await CurriculumItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Не найдено' });
  const { subjectId, hours, controlForm, semester, notes } = req.body || {};
  if (subjectId !== undefined) item.subjectId = parseInt(subjectId, 10);
  if (hours !== undefined) item.hours = parseInt(hours, 10);
  if (controlForm !== undefined) item.controlForm = String(controlForm).trim();
  if (semester !== undefined) item.semester = semester != null ? parseInt(semester, 10) : null;
  if (notes !== undefined) item.notes = notes || null;
  await item.save();
  res.json(item);
});

router.delete('/admin/items/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const item = await CurriculumItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Не найдено' });
  await item.destroy();
  res.status(204).end();
});

// GET /api/curriculum/admin/programs - справочник программ (admin)
router.get('/admin/programs', requireAuth, requireRole('admin'), async (_req, res) => {
  const programs = await Program.findAll({ order: [['name', 'ASC']] });
  res.json(programs);
});

// GET /api/curriculum/admin/subjects - справочник дисциплин (admin)
router.get('/admin/subjects', requireAuth, requireRole('admin'), async (req, res) => {
  const q = req.query.q ? String(req.query.q).trim() : '';
  const where = q
    ? { name: { [Op.iLike]: `%${q}%` } }
    : {};
  const subjects = await Subject.findAll({ where, order: [['name', 'ASC']], limit: 200 });
  res.json(subjects);
});

module.exports = router;

