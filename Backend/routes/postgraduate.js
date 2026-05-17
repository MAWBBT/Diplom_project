const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { markOverduePlanItems, calendarTodayISO, dateOnlyString } = require('../utils/planItemOverdue');
const { normalizeUploadFilename, sendFileDownload } = require('../utils/uploadFilename');
const {
  User,
  PostgraduateProfile,
  DissertationTopic,
  IndividualPlan,
  PlanItem,
  PlanItemFile,
  Publication,
  Attestation,
  AcademicDocument,
  DocumentFile,
  Program,
  AttestationFile
} = require('../models');

const { supervisionsForPostgraduate } = require('../utils/supervision');
const pgOnly = [requireAuth, requireRole('student')];

const uploadRoot = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(normalizeUploadFilename(file.originalname || '')).slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 
    'image/png'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый формат файла'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter
});

const planItemUploadRoot = path.join(__dirname, '../uploads/plan-items');
if (!fs.existsSync(planItemUploadRoot)) {
  fs.mkdirSync(planItemUploadRoot, { recursive: true });
}

const planItemStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, planItemUploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(normalizeUploadFilename(file.originalname || '')).slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const planItemFileFilter = (_req, file, cb) => {
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

const uploadPlanItemFile = multer({
  storage: planItemStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: planItemFileFilter
});

async function applyOverdueForUserPlans(userId) {
  try {
    const plans = await IndividualPlan.findAll({ where: { userId }, attributes: ['id'] });
    const planIds = plans.map((p) => p.id);
    await markOverduePlanItems(PlanItem, planIds);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[applyOverdueForUserPlans]', err);
  }
}

async function loadDashboardPayload(userId) {
  await applyOverdueForUserPlans(userId);
  const [
    profile,
    topics,
    plans,
    publications,
    attestations,
    documents,
    supervisions
  ] = await Promise.all([
    PostgraduateProfile.findOne({
      where: { userId },
      include: [{ model: Program, as: 'program', attributes: ['id', 'code', 'name'] }]
    }),
    DissertationTopic.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] }),
    IndividualPlan.findAll({
      where: { userId },
      include: [
        {
          model: DissertationTopic,
          as: 'dissertationTopic',
          attributes: ['id', 'title', 'status']
        },
        {
          model: PlanItem,
          as: 'items',
          include: [{ model: PlanItemFile, as: 'files' }]
        }
      ],
      order: [['academicYear', 'DESC']]
    }),
    Publication.findAll({ where: { userId }, order: [['year', 'DESC'], ['createdAt', 'DESC']] }),
    Attestation.findAll({
      where: { userId },
      include: [{ model: AttestationFile, as: 'files' }],
      order: [['attestedAt', 'DESC']]
    }),
    AcademicDocument.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']],
      include: [
        { model: IndividualPlan, as: 'individualPlan', attributes: ['id', 'academicYear', 'status'] },
        { model: DocumentFile, as: 'files' }
      ]
    }),
    supervisionsForPostgraduate(userId)
  ]);

  return {
    profile,
    dissertationTopics: topics,
    individualPlans: plans,
    publications,
    attestations,
    documents,
    supervisions
  };
}

router.get('/dashboard', ...pgOnly, async (req, res) => {
  
    const data = await loadDashboardPayload(req.user.id);
    res.json(data);
  
});

router.get('/programs', ...pgOnly, async (_req, res) => {
  
    const programs = await Program.findAll({ order: [['name', 'ASC']] });
    res.json(programs);
  
});

router.put('/profile', ...pgOnly, async (req, res) => {
  
    const { enrollmentYear, department, specialtyCode, studyForm, programId } = req.body;
    let profile = await PostgraduateProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await PostgraduateProfile.create({
        userId: req.user.id,
        enrollmentYear: enrollmentYear ?? null,
        department: department ?? null,
        specialtyCode: specialtyCode ?? null,
        studyForm: studyForm ?? null,
        programId: programId ?? null
      });
    } else {
      if (enrollmentYear !== undefined) profile.enrollmentYear = enrollmentYear;
      if (department !== undefined) profile.department = department;
      if (specialtyCode !== undefined) profile.specialtyCode = specialtyCode;
      if (studyForm !== undefined) profile.studyForm = studyForm;
      if (programId !== undefined) profile.programId = programId || null;
      await profile.save();
    }
    await writeAudit(req.user.id, 'postgraduate_profile_update', 'PostgraduateProfile', profile.id, {});
    const fresh = await PostgraduateProfile.findOne({
      where: { userId: req.user.id },
      include: [{ model: Program, as: 'program', attributes: ['id', 'code', 'name'] }]
    });
    res.json(fresh);
  
});

router.post('/publications', ...pgOnly, async (req, res) => {
  
    const { title, venue, year, doi, indexing, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Укажите название' });
    const p = await Publication.create({
      userId: req.user.id,
      title,
      venue: venue || null,
      year: year != null ? parseInt(year, 10) : null,
      doi: doi || null,
      indexing: indexing || null,
      status: status && ['draft', 'submitted', 'verified', 'rejected'].includes(status) ? status : 'draft'
    });
    await writeAudit(req.user.id, 'publication_create', 'Publication', p.id, {});
    res.status(201).json(p);
  
});

router.put('/publications/:id', ...pgOnly, async (req, res) => {
  
    const p = await Publication.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!p) return res.status(404).json({ error: 'Не найдено' });
    const { title, venue, year, doi, indexing, status } = req.body;
    if (title !== undefined) p.title = title;
    if (venue !== undefined) p.venue = venue;
    if (year !== undefined) p.year = year != null ? parseInt(year, 10) : null;
    if (doi !== undefined) p.doi = doi;
    if (indexing !== undefined) p.indexing = indexing;
    if (status !== undefined && ['draft', 'submitted', 'verified', 'rejected'].includes(status)) p.status = status;
    await p.save();
    res.json(p);
  
});

router.delete('/publications/:id', ...pgOnly, async (req, res) => {
  
    const p = await Publication.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!p) return res.status(404).json({ error: 'Не найдено' });
    await p.destroy();
    res.status(204).end();
  
});

router.post('/documents', ...pgOnly, async (req, res) => {
  
    const { title, documentType, notes, individualPlanId } = req.body;
    if (!title || !documentType) {
      return res.status(400).json({ error: 'Укажите название и тип документа' });
    }
    let planFk = null;
    if (individualPlanId != null && individualPlanId !== '') {
      const pid = parseInt(individualPlanId, 10);
      if (!pid) return res.status(400).json({ error: 'Некорректный идентификатор плана' });
      const plan = await IndividualPlan.findOne({ where: { id: pid, userId: req.user.id } });
      if (!plan) return res.status(404).json({ error: 'План не найден' });
      if (plan.status !== 'approved') {
        return res.status(400).json({
          error: 'Привязать документ к плану можно только после утверждения плана научным руководителем'
        });
      }
      planFk = pid;
    }
    const d = await AcademicDocument.create({
      userId: req.user.id,
      title,
      documentType,
      status: 'draft',
      notes: notes || null,
      individualPlanId: planFk
    });
    await writeAudit(req.user.id, 'document_create', 'AcademicDocument', d.id, {});
    const fresh = await AcademicDocument.findByPk(d.id, {
      include: [
        { model: IndividualPlan, as: 'individualPlan', attributes: ['id', 'academicYear', 'status'] },
        { model: DocumentFile, as: 'files' }
      ]
    });
    res.status(201).json(fresh);
  
});

router.put('/documents/:id', ...pgOnly, async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    const { title, notes, status } = req.body;
    const editable = ['draft', 'rejected', 'on_review'].includes(d.status);
    if (!editable && d.status === 'approved') {
      return res.status(400).json({ error: 'Утверждённый документ нельзя изменить' });
    }
    if (title !== undefined) d.title = title;
    if (notes !== undefined) d.notes = notes;
    if (status !== undefined) {
      if (!['draft', 'on_review'].includes(status)) {
        return res.status(400).json({ error: 'Аспирант может переводить документ только в draft или on_review' });
      }
      if (status === 'on_review' && ['draft', 'rejected'].includes(d.status)) d.status = 'on_review';
      if (status === 'draft' && d.status === 'rejected') d.status = 'draft';
    }
    await d.save();
    res.json(d);
  
});

router.post('/documents/:id/submit-review', ...pgOnly, async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    if (!['draft', 'rejected'].includes(d.status)) {
      return res.status(400).json({ error: 'Отправка на проверку недоступна' });
    }
    d.status = 'on_review';
    await d.save();
    res.json(d);
  
});

router.post('/documents/:id/files', ...pgOnly, upload.single('file'), async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Документ не найден' });
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });
    const row = await DocumentFile.create({
      documentId: d.id,
      storedName: req.file.filename,
      originalName: normalizeUploadFilename(req.file.originalname || req.file.filename),
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.user.id
    });
    res.status(201).json(row);
  
});

router.get('/documents/:id/files/:fileId/download', ...pgOnly, async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    const f = await DocumentFile.findOne({ where: { id: req.params.fileId, documentId: d.id } });
    if (!f) return res.status(404).json({ error: 'Файл не найден' });
    const fp = path.join(uploadRoot, f.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
    sendFileDownload(res, fp, f.originalName);
  
});

router.put('/plans/:planId/submit', ...pgOnly, async (req, res) => {
  
    const plan = await IndividualPlan.findOne({
      where: { id: req.params.planId, userId: req.user.id },
      include: [{ model: DissertationTopic, as: 'dissertationTopic' }]
    });
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (plan.status !== 'draft') {
      return res.status(400).json({ error: 'Отправить можно только черновик' });
    }
    if (!plan.dissertationTopicId) {
      return res.status(400).json({
        error: 'Привяжите к плану тему диссертации и заполните этапы перед отправкой'
      });
    }
    const itemCount = await PlanItem.count({ where: { planId: plan.id } });
    if (itemCount < 1) {
      return res.status(400).json({ error: 'Добавьте хотя бы один этап исследования с датами' });
    }

    const topic = plan.dissertationTopic || (await DissertationTopic.findByPk(plan.dissertationTopicId));
    if (topic && ['draft', 'rejected'].includes(topic.status)) {
      topic.status = 'submitted';
      topic.rejectReason = null;
      await topic.save();
    }

    plan.status = 'submitted';
    await plan.save();
    await writeAudit(req.user.id, 'plan_submit', 'IndividualPlan', plan.id, {});
    const full = await IndividualPlan.findByPk(plan.id, {
      include: [
        { model: DissertationTopic, as: 'dissertationTopic', attributes: ['id', 'title', 'status'] },
        { model: PlanItem, as: 'items' }
      ]
    });
    res.json(full);
  
});

router.post('/plan-items', ...pgOnly, async (req, res) => {
  
    const { planId, title, orderIdx, dueDate, notes } = req.body;
    if (!planId || !title) return res.status(400).json({ error: 'Укажите план и название пункта' });
    const plan = await IndividualPlan.findOne({ where: { id: planId, userId: req.user.id } });
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (!['draft', 'rejected'].includes(plan.status)) {
      return res.status(400).json({ error: 'Пункты можно добавлять только в черновик или после возврата' });
    }
    if (!plan.dissertationTopicId) {
      return res.status(400).json({ error: 'Сначала привяжите к плану тему диссертации' });
    }
    const item = await PlanItem.create({
      planId: plan.id,
      title: String(title).trim(),
      orderIdx: orderIdx != null ? parseInt(orderIdx, 10) : 0,
      dueDate: dueDate || null,
      notes: notes || null,
      description: req.body.description || null,
      status: 'planned'
    });
    res.status(201).json(item);
  
});

// POST /api/postgraduate/plan-items-with-file (multipart) — создание этапа + файл отчёта
router.post('/plan-items-with-file', ...pgOnly, uploadPlanItemFile.single('file'), async (req, res) => {
  try {
    const { planId, title, orderIdx, dueDate, notes, description } = req.body || {};
    if (!planId || !title) return res.status(400).json({ error: 'Укажите planId и title' });
    const plan = await IndividualPlan.findOne({ where: { id: planId, userId: req.user.id } });
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (!['draft', 'rejected'].includes(plan.status)) {
      return res.status(400).json({ error: 'Пункты можно добавлять только в черновик или после возврата' });
    }
    if (!plan.dissertationTopicId) {
      return res.status(400).json({ error: 'Сначала привяжите к плану тему диссертации' });
    }

    const item = await PlanItem.create({
      planId: plan.id,
      title: String(title).trim(),
      orderIdx: orderIdx != null ? parseInt(orderIdx, 10) : 0,
      dueDate: dueDate || null,
      notes: notes || null,
      description: description || null,
      status: 'planned'
    });

    if (req.file) {
      await PlanItemFile.create({
        planItemId: item.id,
        storedName: req.file.filename,
        originalName: normalizeUploadFilename(req.file.originalname || req.file.filename),
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: req.user.id
      });
    }

    const fresh = await PlanItem.findByPk(item.id, { include: [{ model: PlanItemFile, as: 'files' }] });
    res.status(201).json(fresh);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.put('/plan-items/:id', ...pgOnly, async (req, res) => {
  
    const item = await PlanItem.findByPk(req.params.id, { include: [{ model: IndividualPlan, as: 'plan' }] });
    if (!item || !item.plan || item.plan.userId !== req.user.id) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    const planStatus = item.plan.status;
    const structureEditable = ['draft', 'rejected'].includes(planStatus);
    const executionEditable = planStatus === 'approved';

    if (!structureEditable && !executionEditable) {
      return res.status(400).json({ error: 'Редактирование пункта недоступно' });
    }

    const { title, orderIdx, dueDate, notes, completedAt, description, status } = req.body;

    if (structureEditable) {
      if (title !== undefined) item.title = String(title).trim();
      if (orderIdx !== undefined) item.orderIdx = parseInt(orderIdx, 10);
      if (dueDate !== undefined) item.dueDate = dueDate || null;
      if (notes !== undefined) item.notes = notes;
      if (description !== undefined) item.description = description;
      if (completedAt !== undefined) item.completedAt = completedAt;
      if (status !== undefined) {
        if (!['planned', 'in_progress', 'done'].includes(status)) {
          return res.status(400).json({ error: 'status: planned | in_progress | done' });
        }
        item.status = status;
        if (status === 'done' && !item.completedAt) {
          item.completedAt = calendarTodayISO();
        }
        if (status !== 'done') item.completedAt = null;
      }
    } else {
      const forbidden =
        title !== undefined ||
        orderIdx !== undefined ||
        dueDate !== undefined ||
        description !== undefined ||
        completedAt !== undefined;
      if (forbidden) {
        return res.status(400).json({
          error: 'После утверждения плана можно менять только статус выполнения этапа и примечания'
        });
      }
      if (notes !== undefined) item.notes = notes;
      if (status !== undefined) {
        if (!['planned', 'in_progress', 'done'].includes(status)) {
          return res.status(400).json({ error: 'status: planned | in_progress | done' });
        }
        item.status = status;
        if (status === 'done' && !item.completedAt) {
          item.completedAt = calendarTodayISO();
        }
        if (status !== 'done') item.completedAt = null;
      }
    }

    if (item.status === 'overdue') {
      const d = dateOnlyString(item.dueDate);
      if (!d || d >= calendarTodayISO()) item.status = 'planned';
    }
    await item.save();
    res.json(item);
  
});

// POST /api/postgraduate/plan-items/:id/files — загрузить файл отчёта к этапу
router.post('/plan-items/:id/files', ...pgOnly, uploadPlanItemFile.single('file'), async (req, res) => {
  try {
    const item = await PlanItem.findByPk(req.params.id, { include: [{ model: IndividualPlan, as: 'plan' }] });
    if (!item || !item.plan || item.plan.userId !== req.user.id) return res.status(404).json({ error: 'Не найдено' });
    if (!['draft', 'rejected', 'approved'].includes(item.plan.status)) {
      return res.status(400).json({ error: 'Загрузка файла недоступна для этого плана' });
    }
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

    const row = await PlanItemFile.create({
      planItemId: item.id,
      storedName: req.file.filename,
      originalName: normalizeUploadFilename(req.file.originalname || req.file.filename),
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.user.id
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/postgraduate/plan-items/:id/files/:fileId/download — скачать файл этапа
router.get('/plan-items/:id/files/:fileId/download', ...pgOnly, async (req, res) => {
  try {
    const item = await PlanItem.findByPk(req.params.id, { include: [{ model: IndividualPlan, as: 'plan' }] });
    if (!item || !item.plan || item.plan.userId !== req.user.id) return res.status(404).json({ error: 'Не найдено' });
    const f = await PlanItemFile.findOne({ where: { id: req.params.fileId, planItemId: item.id } });
    if (!f) return res.status(404).json({ error: 'Файл не найден' });
    const fp = path.join(planItemUploadRoot, f.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
    sendFileDownload(res, fp, f.originalName);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/postgraduate/plan-items/:id/files/:fileId — удалить файл отчёта этапа
router.delete('/plan-items/:id/files/:fileId', ...pgOnly, async (req, res) => {
  try {
    const item = await PlanItem.findByPk(req.params.id, { include: [{ model: IndividualPlan, as: 'plan' }] });
    if (!item || !item.plan || item.plan.userId !== req.user.id) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    if (!['draft', 'rejected', 'approved'].includes(item.plan.status)) {
      return res.status(400).json({ error: 'Удаление файла недоступно для этого плана' });
    }
    const f = await PlanItemFile.findOne({ where: { id: req.params.fileId, planItemId: item.id } });
    if (!f) return res.status(404).json({ error: 'Файл не найден' });

    const fp = path.join(planItemUploadRoot, f.storedName);
    await f.destroy();
    if (fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch (unlinkErr) {
        console.error('plan-item file unlink:', unlinkErr);
      }
    }
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/plan-items/:id', ...pgOnly, async (req, res) => {
  
    const item = await PlanItem.findByPk(req.params.id, { include: [{ model: IndividualPlan, as: 'plan' }] });
    if (!item || !item.plan || item.plan.userId !== req.user.id) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    if (!['draft', 'rejected'].includes(item.plan.status)) {
      return res.status(400).json({ error: 'Удаление недоступно' });
    }
    await item.destroy();
    res.status(204).end();
  
});

router.post('/topics', ...pgOnly, async (req, res) => {
  
    const { title } = req.body;
    if (!title || String(title).trim() === '') {
      return res.status(400).json({ error: 'Укажите тему' });
    }
    const t = await DissertationTopic.create({
      userId: req.user.id,
      title: String(title).trim(),
      status: 'draft'
    });
    res.status(201).json(t);
  
});

router.put('/topics/:id', ...pgOnly, async (req, res) => {
  
    const t = await DissertationTopic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!t) return res.status(404).json({ error: 'Не найдено' });
    const { title, status } = req.body;
    if (title !== undefined && String(title).trim() !== t.title) {
      if (t.status === 'approved') {
        t.title = String(title).trim();
        t.status = 'draft';
        t.rejectReason = null;
      } else if (['draft', 'submitted', 'rejected'].includes(t.status)) {
        t.title = String(title).trim();
      } else {
        return res.status(400).json({ error: 'Нельзя изменить тему в текущем статусе' });
      }
    }
    if (status !== undefined && ['draft', 'submitted'].includes(status)) {
      if (t.status === 'draft' || t.status === 'rejected') t.status = status;
    }
    await t.save();
    res.json(t);
  
});

router.post('/plans', ...pgOnly, async (req, res) => {
  
    const { academicYear, dissertationTopicId } = req.body;
    if (!academicYear) return res.status(400).json({ error: 'Укажите учебный год' });
    const topicId = dissertationTopicId != null ? parseInt(dissertationTopicId, 10) : NaN;
    if (!topicId) {
      return res.status(400).json({ error: 'Выберите тему диссертации — этапы исследования относятся к ней' });
    }
    const topic = await DissertationTopic.findOne({ where: { id: topicId, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
    if (topic.status === 'archived') {
      return res.status(400).json({ error: 'Нельзя привязать архивную тему' });
    }
    const existing = await IndividualPlan.findOne({
      where: { userId: req.user.id, academicYear: String(academicYear).trim() }
    });
    if (existing) {
      return res.status(400).json({ error: 'План на этот учебный год уже существует' });
    }
    const plan = await IndividualPlan.create({
      userId: req.user.id,
      academicYear: String(academicYear).trim(),
      status: 'draft',
      rejectReason: null,
      dissertationTopicId: topicId
    });
    await writeAudit(req.user.id, 'plan_create', 'IndividualPlan', plan.id, { dissertationTopicId: topicId });
    const full = await IndividualPlan.findByPk(plan.id, {
      include: [
        { model: DissertationTopic, as: 'dissertationTopic', attributes: ['id', 'title', 'status'] },
        { model: PlanItem, as: 'items', include: [{ model: PlanItemFile, as: 'files' }] }
      ]
    });
    res.status(201).json(full);
  
});

router.patch('/plans/:planId', ...pgOnly, async (req, res) => {
  
    const plan = await IndividualPlan.findOne({ where: { id: req.params.planId, userId: req.user.id } });
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (!['draft', 'rejected'].includes(plan.status)) {
      return res.status(400).json({ error: 'Привязать тему можно только к черновику или возвращённому плану' });
    }
    const { dissertationTopicId } = req.body || {};
    const topicId = dissertationTopicId != null ? parseInt(dissertationTopicId, 10) : NaN;
    if (!topicId) return res.status(400).json({ error: 'Укажите dissertationTopicId' });
    const topic = await DissertationTopic.findOne({ where: { id: topicId, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
    if (topic.status === 'archived') {
      return res.status(400).json({ error: 'Нельзя привязать архивную тему' });
    }
    plan.dissertationTopicId = topicId;
    await plan.save();
    await writeAudit(req.user.id, 'plan_link_topic', 'IndividualPlan', plan.id, { dissertationTopicId: topicId });
    const full = await IndividualPlan.findByPk(plan.id, {
      include: [
        { model: DissertationTopic, as: 'dissertationTopic', attributes: ['id', 'title', 'status'] },
        { model: PlanItem, as: 'items', include: [{ model: PlanItemFile, as: 'files' }] }
      ]
    });
    res.json(full);
  
});

router.get('/topic-history', ...pgOnly, async (_req, res) => {
  res.json([]);
});

router.get('/plan', ...pgOnly, async (req, res) => {
  
    await applyOverdueForUserPlans(req.user.id);
    const plans = await IndividualPlan.findAll({
      where: { userId: req.user.id },
      include: [
        { model: DissertationTopic, as: 'dissertationTopic', attributes: ['id', 'title', 'status'] },
        { model: PlanItem, as: 'items' }
      ],
      order: [['academicYear', 'DESC']]
    });
    res.json(plans);
  
});

router.get('/topics', ...pgOnly, async (req, res) => {
  
    const topics = await DissertationTopic.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']]
    });
    res.json(topics);
  
});

module.exports = router;
