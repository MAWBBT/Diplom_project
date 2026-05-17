const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const planItemUploadRoot = path.join(__dirname, '../uploads/plan-items');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Op } = require('sequelize');
const {
  userSupervisesPostgraduate,
  supervisedPostgraduateIds,
  supervisionsForPostgraduate
} = require('../utils/supervision');
const { messageToFeedback } = require('../utils/feedbackMessage');
const { notifyUser } = require('../utils/notify');
const { writeAudit } = require('../utils/audit');
const {
  User,
  PostgraduateProfile,
  DissertationTopic,
  IndividualPlan,
  PlanItem,
  PlanItemFile,
  Publication,
  Attestation,
  AttestationFile,
  Grade,
  Subject,
  AcademicDocument,
  DocumentFile,
  Program,
  Message
} = require('../models');
const { markOverduePlanItems, calendarTodayISO, dateOnlyString } = require('../utils/planItemOverdue');
const { sendFileDownload } = require('../utils/uploadFilename');

const supervisorOnly = [requireAuth, requireRole('supervisor')];

async function assertSupervises(res, supervisorId, postgraduateId) {
  const ok = await userSupervisesPostgraduate(supervisorId, postgraduateId);
  if (!ok) {
    res.status(403).json({ error: 'Нет доступа к этому аспиранту' });
    return false;
  }
  return true;
}

function daysUntilDate(isoDate) {
  if (!isoDate) return null;
  const today = calendarTodayISO();
  const a = new Date(today);
  const b = new Date(String(isoDate).slice(0, 10));
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

async function buildSupervisorCalendar(pgIds) {
  const events = [];
  if (!pgIds.length) return events;

  const plansWithItems = await IndividualPlan.findAll({
    where: { userId: { [Op.in]: pgIds } },
    include: [
      { model: PlanItem, as: 'items' },
      { model: User, as: 'owner', attributes: ['id', 'fullName'] }
    ]
  });
  for (const plan of plansWithItems) {
    const pgName = plan.owner?.fullName || '—';
    for (const it of plan.items || []) {
      if (!it.dueDate) continue;
      const daysUntil = daysUntilDate(it.dueDate);
      events.push({
        id: `pi-${it.id}`,
        postgraduateId: plan.userId,
        postgraduate: pgName,
        date: it.dueDate,
        title: it.title,
        type: 'Этап ИПР / отчёт',
        status: it.status,
        daysUntil,
        reminder: daysUntil !== null && daysUntil >= 0 && daysUntil <= 14
      });
    }
  }

  const attestations = await Attestation.findAll({
    where: { userId: { [Op.in]: pgIds } },
    include: [{ model: User, as: 'owner', attributes: ['id', 'fullName'] }],
    order: [['attestedAt', 'DESC']]
  });
  for (const a of attestations) {
    if (!a.attestedAt) continue;
    const daysUntil = daysUntilDate(a.attestedAt);
    events.push({
      id: `att-${a.id}`,
      postgraduateId: a.userId,
      postgraduate: a.owner?.fullName || '—',
      date: a.attestedAt,
      title: a.periodLabel || a.decision || 'Аттестация',
      type: 'Аттестация',
      status: a.decision || '—',
      daysUntil,
      reminder: daysUntil !== null && daysUntil >= 0 && daysUntil <= 30
    });
  }

  events.sort((x, y) => new Date(x.date) - new Date(y.date));
  return events;
}

async function loadPostgraduateBundle(postgraduateId) {
  // Autoupdate overdue plan items for this postgraduate
  try {
    const plans = await IndividualPlan.findAll({ where: { userId: postgraduateId }, attributes: ['id'] });
    const planIds = plans.map((p) => p.id);
    await markOverduePlanItems(PlanItem, planIds);
  } catch {
    // non-critical
  }

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
      where: { userId: postgraduateId },
      include: [{ model: Program, as: 'program', attributes: ['id', 'code', 'name'] }]
    }),
    DissertationTopic.findAll({ where: { userId: postgraduateId }, order: [['updatedAt', 'DESC']] }),
    IndividualPlan.findAll({
      where: { userId: postgraduateId },
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
    Publication.findAll({ where: { userId: postgraduateId }, order: [['year', 'DESC']] }),
    Attestation.findAll({
      where: { userId: postgraduateId },
      include: [{ model: AttestationFile, as: 'files' }],
      order: [['attestedAt', 'DESC']]
    }),
    AcademicDocument.findAll({
      where: { userId: postgraduateId },
      include: [
        { model: IndividualPlan, as: 'individualPlan', attributes: ['id', 'academicYear', 'status'] },
        { model: DocumentFile, as: 'files' }
      ],
      order: [['updatedAt', 'DESC']]
    }),
    supervisionsForPostgraduate(postgraduateId)
  ]);

  const pgUser = await User.findByPk(postgraduateId, {
    attributes: { exclude: ['password'] }
  });

  return {
    user: pgUser,
    profile,
    dissertationTopics: topics,
    individualPlans: plans,
    publications,
    attestations,
    documents,
    supervisions,
    topicHistory: []
  };
}

router.get('/overview', ...supervisorOnly, async (req, res) => {
  try {
    const profiles = await PostgraduateProfile.findAll({
      where: { supervisorId: req.user.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'login', 'email', 'groupName']
        }
      ],
      order: [['supervisionStartedAt', 'DESC']]
    });

    const pgIds = profiles.map((p) => p.userId).filter(Boolean);
    if (!pgIds.length) {
      return res.json({
        students: [],
        pendingPlans: [],
        documentsOnReview: [],
        publicationsPending: [],
        overduePlanItems: [],
        upcomingEvents: [],
        recentGrades: []
      });
    }

    for (const pgId of pgIds) {
      const plans = await IndividualPlan.findAll({ where: { userId: pgId }, attributes: ['id'] });
      await markOverduePlanItems(PlanItem, plans.map((p) => p.id));
    }

    const { supervisionRow } = require('../utils/supervisionProfile');
    const students = await Promise.all(
      profiles.map(async (profile) => {
        const pg = profile.user;
        const topic = pg
          ? await DissertationTopic.findOne({
              where: { userId: pg.id },
              order: [['updatedAt', 'DESC']]
            })
          : null;
        const activePlan = pg
          ? await IndividualPlan.findOne({
              where: { userId: pg.id },
              order: [['academicYear', 'DESC']]
            })
          : null;
        return {
          supervision: supervisionRow(profile, 'primary'),
          postgraduate: pg ? pg.toSafeJSON() : null,
          profile,
          latestTopic: topic,
          latestPlanStatus: activePlan?.status ?? null,
          latestPlanYear: activePlan?.academicYear ?? null
        };
      })
    );

    const [pendingPlans, documentsOnReview, publicationsPending, overduePlanItems, recentGrades] =
      await Promise.all([
        IndividualPlan.findAll({
          where: { userId: { [Op.in]: pgIds }, status: 'submitted' },
          include: [
            { model: User, as: 'owner', attributes: ['id', 'fullName'] },
            { model: DissertationTopic, as: 'dissertationTopic', attributes: ['id', 'title'] }
          ],
          order: [['updatedAt', 'DESC']]
        }),
        AcademicDocument.findAll({
          where: { userId: { [Op.in]: pgIds }, status: 'on_review' },
          include: [{ model: User, as: 'owner', attributes: ['id', 'fullName'] }],
          order: [['updatedAt', 'DESC']]
        }),
        Publication.findAll({
          where: { userId: { [Op.in]: pgIds }, status: 'submitted' },
          include: [{ model: User, as: 'author', attributes: ['id', 'fullName'] }],
          order: [['updatedAt', 'DESC']]
        }),
        PlanItem.findAll({
          where: { status: 'overdue' },
          include: [
            {
              model: IndividualPlan,
              as: 'plan',
              where: { userId: { [Op.in]: pgIds } },
              required: true,
              attributes: ['id', 'academicYear', 'userId'],
              include: [{ model: User, as: 'owner', attributes: ['id', 'fullName'] }]
            }
          ],
          order: [['dueDate', 'ASC']],
          limit: 30
        }),
        Grade.findAll({
          where: { userId: { [Op.in]: pgIds } },
          include: [
            { model: Subject, as: 'subjectRef', attributes: ['id', 'name'] },
            { model: User, as: 'user', attributes: ['id', 'fullName'] }
          ],
          order: [['createdAt', 'DESC']],
          limit: 40
        })
      ]);

    const upcomingEvents = [];
    const plansWithItems = await IndividualPlan.findAll({
      where: { userId: { [Op.in]: pgIds } },
      include: [
        { model: PlanItem, as: 'items' },
        { model: User, as: 'owner', attributes: ['id', 'fullName'] }
      ]
    });
    for (const plan of plansWithItems) {
      const pgName = plan.owner?.fullName || '—';
      for (const it of plan.items || []) {
        if (it.dueDate) {
          upcomingEvents.push({
            id: `pi-${it.id}`,
            postgraduate: pgName,
            date: it.dueDate,
            title: it.title,
            type: 'Этап ИПР',
            status: it.status
          });
        }
      }
    }
    const attestations = await Attestation.findAll({
      where: { userId: { [Op.in]: pgIds } },
      include: [{ model: User, as: 'owner', attributes: ['id', 'fullName'] }],
      order: [['attestedAt', 'DESC']],
      limit: 20
    });
    for (const a of attestations) {
      if (a.attestedAt) {
        upcomingEvents.push({
          id: `att-${a.id}`,
          postgraduate: a.owner?.fullName || '—',
          date: a.attestedAt,
          title: a.periodLabel || a.decision || 'Аттестация',
          type: 'Аттестация',
          status: '—'
        });
      }
    }
    upcomingEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      students,
      pendingPlans,
      documentsOnReview,
      publicationsPending,
      overduePlanItems,
      upcomingEvents: upcomingEvents.slice(0, 40),
      recentGrades
    });
  } catch (error) {
    console.error('supervisor/overview:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/supervisions', ...supervisorOnly, async (req, res) => {
  try {
    const { supervisionsForSupervisor } = require('../utils/supervisionProfile');
    const enriched = await supervisionsForSupervisor(req.user.id);
    await Promise.all(
      enriched.map(async (row) => {
        const pgId = row.postgraduate?.id;
        if (!pgId) return;
        row.latestTopic = await DissertationTopic.findOne({
          where: { userId: pgId },
          order: [['updatedAt', 'DESC']]
        });
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('supervisor/supervisions:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/postgraduate/:userId', ...supervisorOnly, async (req, res) => {
  try {
    const pgId = parseInt(req.params.userId, 10);
    if (!await assertSupervises(res, req.user.id, pgId)) return;
    const bundle = await loadPostgraduateBundle(pgId);
    res.json(bundle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/supervisor/grades/:postgraduateId - оценки аспиранта (только для руководителя этого аспиранта)
router.get('/grades/:postgraduateId', ...supervisorOnly, async (req, res) => {
  try {
    const postgraduateId = parseInt(req.params.postgraduateId, 10);
    if (!postgraduateId) {
      return res.status(400).json({ error: 'Некорректный postgraduateId' });
    }
    if (!await assertSupervises(res, req.user.id, postgraduateId)) return;

    const { subjectId, dateFrom, dateTo, q } = req.query || {};
    const where = { userId: postgraduateId };

    if (subjectId) where.subjectId = parseInt(subjectId, 10);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(String(dateFrom));
      if (dateTo) {
        const d = new Date(String(dateTo));
        d.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = d;
      }
    }
    if (q && String(q).trim()) {
      const qq = `%${String(q).trim()}%`;
      where[Op.or] = [
        { controlType: { [Op.iLike]: qq } },
        { grade: { [Op.iLike]: qq } },
        { comment: { [Op.iLike]: qq } }
      ];
    }

    const rows = await Grade.findAll({
      where,
      include: [{
        model: Subject,
        as: 'subjectRef',
        attributes: ['id', 'name']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(rows);
  } catch (error) {
    console.error('supervisor/grades:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/plans/:planId', ...supervisorOnly, async (req, res) => {
  try {
    const plan = await IndividualPlan.findByPk(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (!await assertSupervises(res, req.user.id, plan.userId)) return;

    const { status, rejectReason } = req.body;
    if (!status || !['approved', 'rejected', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Укажите status: approved | rejected | archived' });
    }
    if (plan.status !== 'submitted' && status !== 'archived') {
      return res.status(400).json({ error: 'Утверждать можно только отправленный план' });
    }
    plan.status = status;
    if (status === 'rejected') {
      const reason = rejectReason != null ? String(rejectReason).trim() : '';
      if (!reason) {
        return res.status(400).json({ error: 'Укажите причину возврата плана на доработку' });
      }
      plan.rejectReason = reason;
    }
    if (status === 'approved') plan.rejectReason = null;
    await plan.save();
    const notificationBody =
      status === 'approved'
        ? `Ваш ИПР на ${plan.academicYear} утверждён научным руководителем.`
        : status === 'rejected'
          ? `ИПР на ${plan.academicYear} возвращён на доработку.${plan.rejectReason ? ` Комментарий: ${plan.rejectReason}` : ''}`
          : `ИПР на ${plan.academicYear} переведён в архив.`;
    await notifyUser(plan.userId, 'Индивидуальный план', notificationBody, '/postgraduate.html');
    await writeAudit(req.user.id, `plan_${status}`, 'IndividualPlan', plan.id, { postgraduateId: plan.userId });
    const full = await IndividualPlan.findByPk(plan.id, {
      include: [
        { model: DissertationTopic, as: 'dissertationTopic', attributes: ['id', 'title', 'status'] },
        { model: PlanItem, as: 'items' }
      ]
    });
    res.json(full);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/plan-items/:itemId', ...supervisorOnly, async (req, res) => {
  try {
    const item = await PlanItem.findByPk(req.params.itemId, {
      include: [{ model: IndividualPlan, as: 'plan' }]
    });
    if (!item || !item.plan) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, item.plan.userId)) return;

    const planStatus = item.plan.status;
    const canEditContent = planStatus === 'submitted';

    const { supervisorNotes, status, title, description, dueDate, notes, orderIdx } = req.body || {};

    if (title !== undefined && canEditContent) {
      const t = String(title).trim();
      if (!t) return res.status(400).json({ error: 'Название этапа не может быть пустым' });
      item.title = t;
    } else if (title !== undefined && !canEditContent) {
      return res.status(400).json({ error: 'Правки текста этапа доступны только для плана «на согласовании»' });
    }

    if (description !== undefined && canEditContent) {
      item.description = description === null || description === '' ? null : String(description);
    } else if (description !== undefined && !canEditContent) {
      return res.status(400).json({ error: 'Правки описания доступны только для плана «на согласовании»' });
    }

    if (dueDate !== undefined && canEditContent) {
      item.dueDate = dueDate === null || dueDate === '' ? null : String(dueDate).trim().slice(0, 10);
    } else if (dueDate !== undefined && !canEditContent) {
      return res.status(400).json({ error: 'Правки дедлайна доступны только для плана «на согласовании»' });
    }

    if (notes !== undefined && canEditContent) {
      item.notes = notes === null || notes === '' ? null : String(notes);
    } else if (notes !== undefined && !canEditContent) {
      return res.status(400).json({ error: 'Правки примечаний доступны только для плана «на согласовании»' });
    }

    if (orderIdx !== undefined && canEditContent) {
      const n = parseInt(orderIdx, 10);
      if (Number.isFinite(n)) item.orderIdx = n;
    } else if (orderIdx !== undefined && !canEditContent) {
      return res.status(400).json({ error: 'Порядок этапов менять можно только при согласовании плана' });
    }

    if (supervisorNotes !== undefined) item.supervisorNotes = supervisorNotes === '' ? null : String(supervisorNotes);

    if (status !== undefined) {
      const allowed = ['planned', 'in_progress', 'done'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'status: planned | in_progress | done' });
      }
      item.status = status;
      if (status === 'done') {
        item.completedAt = calendarTodayISO();
      } else {
        item.completedAt = null;
      }
    }

    if (item.status === 'overdue') {
      const d = dateOnlyString(item.dueDate);
      if (!d || d >= calendarTodayISO()) item.status = 'planned';
    }

    await item.save();
    await markOverduePlanItems(PlanItem, [item.plan.id]);
    await item.reload();

    const contentTouched =
      title !== undefined || description !== undefined || dueDate !== undefined || notes !== undefined || orderIdx !== undefined;
    if (canEditContent && contentTouched) {
      await writeAudit(req.user.id, 'supervisor_plan_item_edit', 'PlanItem', item.id, {
        postgraduateId: item.plan.userId,
        planId: item.plan.id
      });
      await notifyUser(
        item.plan.userId,
        'ИПР: правки руководителя',
        `Научный руководитель уточнил этап плана («${item.title}»). Откройте кабинет аспиранта.`,
        '/postgraduate.html'
      );
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/plan-items/:itemId/files/:fileId/download', ...supervisorOnly, async (req, res) => {
  try {
    const item = await PlanItem.findByPk(req.params.itemId, {
      include: [{ model: IndividualPlan, as: 'plan' }]
    });
    if (!item || !item.plan) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, item.plan.userId)) return;

    const f = await PlanItemFile.findOne({
      where: { id: req.params.fileId, planItemId: item.id }
    });
    if (!f) return res.status(404).json({ error: 'Файл не найден' });
    const fp = path.join(planItemUploadRoot, f.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
    sendFileDownload(res, fp, f.originalName);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/topics/:id', ...supervisorOnly, async (req, res) => {
  try {
    const t = await DissertationTopic.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, t.userId)) return;

    const { status, rejectReason, title } = req.body || {};
    let titleOnlyNotify = false;

    if (title !== undefined) {
      const trimmed = String(title).trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Название темы не может быть пустым' });
      }
      if (!['draft', 'submitted'].includes(t.status)) {
        return res.status(400).json({ error: 'Формулировку можно править только до утверждения темы' });
      }
      t.title = trimmed;
      titleOnlyNotify = true;
    }

    if (status) {
      if (!['approved', 'rejected', 'submitted'].includes(status)) {
        return res.status(400).json({ error: 'Укажите корректный status' });
      }
      if (status === 'approved' || status === 'rejected') {
        if (!['submitted', 'draft'].includes(t.status)) {
          return res.status(400).json({ error: 'Недопустимый переход статуса темы' });
        }
        t.status = status;
        t.rejectReason = status === 'rejected' ? (rejectReason || null) : null;
        await notifyUser(
          t.userId,
          'Тема диссертации',
          status === 'approved' ? 'Тема диссертации утверждена.' : `Тема отклонена: ${rejectReason || ''}`,
          '/postgraduate.html'
        );
        await writeAudit(req.user.id, `topic_${status}`, 'DissertationTopic', t.id, { postgraduateId: t.userId });
        titleOnlyNotify = false;
      }
    }

    if (title === undefined && !status) {
      return res.status(400).json({ error: 'Укажите title и/или status' });
    }

    await t.save();

    if (titleOnlyNotify) {
      await notifyUser(
        t.userId,
        'Тема диссертации',
        'Научный руководитель уточнил формулировку темы.',
        '/postgraduate.html'
      );
      await writeAudit(req.user.id, 'topic_title_supervisor', 'DissertationTopic', t.id, { postgraduateId: t.userId });
    }

    res.json(t);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/documents/:id', ...supervisorOnly, async (req, res) => {
  try {
    const d = await AcademicDocument.findByPk(req.params.id);
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, d.userId)) return;

    const { status, notes } = req.body;
    if (status !== undefined && ['draft', 'on_review', 'approved', 'rejected'].includes(status)) {
      d.status = status;
    }
    if (notes !== undefined) d.notes = notes;
    await d.save();
    await notifyUser(
      d.userId,
      'Документ',
      `Статус документа «${d.title}»: ${d.status}`,
      '/postgraduate.html'
    );
    res.json(d);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/publications/:id', ...supervisorOnly, async (req, res) => {
  try {
    const p = await Publication.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, p.userId)) return;

    const { status } = req.body;
    if (status !== undefined && ['draft', 'submitted', 'verified', 'rejected'].includes(status)) {
      p.status = status;
      await p.save();
      await notifyUser(p.userId, 'Публикация', `Статус публикации обновлён: ${status}`, '/postgraduate.html');
    }
    res.json(p);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/documents/:docId/files/:fileId/download', ...supervisorOnly, async (req, res) => {
  try {
    const d = await AcademicDocument.findByPk(req.params.docId);
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, d.userId)) return;

    const f = await DocumentFile.findOne({ where: { id: req.params.fileId, documentId: d.id } });
    if (!f) return res.status(404).json({ error: 'Файл не найден' });
    const pathMod = require('path');
    const fs = require('fs');
    const uploadRoot = pathMod.join(__dirname, '../uploads/documents');
    const fp = pathMod.join(uploadRoot, f.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует' });
    sendFileDownload(res, fp, f.originalName);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/supervisor/calendar — календарь событий по всем подопечным
router.get('/calendar', ...supervisorOnly, async (req, res) => {
  try {
    const pgIds = await supervisedPostgraduateIds(req.user.id);
    const events = await buildSupervisorCalendar(pgIds);
    const reminders = events.filter((e) => e.reminder);
    res.json({ events, reminders, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('supervisor/calendar:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/supervisor/attestations — график аттестаций всех подопечных
router.get('/attestations', ...supervisorOnly, async (req, res) => {
  try {
    const pgIds = await supervisedPostgraduateIds(req.user.id);
    if (!pgIds.length) return res.json([]);

    const rows = await Attestation.findAll({
      where: { userId: { [Op.in]: pgIds } },
      include: [
        { model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName'] },
        { model: AttestationFile, as: 'files' }
      ],
      order: [['attestedAt', 'DESC'], ['createdAt', 'DESC']]
    });

    const enriched = rows.map((a) => {
      const json = a.toJSON();
      const daysUntil = daysUntilDate(a.attestedAt);
      return {
        ...json,
        daysUntil,
        reminder: daysUntil !== null && daysUntil >= 0 && daysUntil <= 30
      };
    });
    res.json(enriched);
  } catch (error) {
    console.error('supervisor/attestations:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/supervisor/feedback — отзывы и заключения
router.get('/feedback', ...supervisorOnly, async (req, res) => {
  try {
    const pgIds = await supervisedPostgraduateIds(req.user.id);
    if (!pgIds.length) return res.json([]);

    const postgraduateId = req.query.postgraduateId
      ? parseInt(req.query.postgraduateId, 10)
      : null;
    const msgWhere = {
      messageType: 'supervisor_feedback',
      senderId: req.user.id
    };
    if (postgraduateId) {
      if (!pgIds.includes(postgraduateId)) {
        return res.status(403).json({ error: 'Нет доступа к этому аспиранту' });
      }
      msgWhere.recipientId = postgraduateId;
    } else {
      msgWhere.recipientId = { [Op.in]: pgIds };
    }
    const rows = await Message.findAll({
      where: msgWhere,
      include: [{ model: User, as: 'recipient', attributes: ['id', 'fullName', 'groupName'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(rows.map(messageToFeedback));
  } catch (error) {
    console.error('supervisor/feedback GET:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/supervisor/feedback — создать отзыв / заключение / рекомендацию
router.post('/feedback', ...supervisorOnly, async (req, res) => {
  try {
    const { postgraduateId, kind, title, body } = req.body || {};
    const pgId = parseInt(postgraduateId, 10);
    if (!pgId) return res.status(400).json({ error: 'Укажите postgraduateId' });
    if (!await assertSupervises(res, req.user.id, pgId)) return;

    const trimmedTitle = String(title || '').trim();
    const trimmedBody = String(body || '').trim();
    if (!trimmedTitle || !trimmedBody) {
      return res.status(400).json({ error: 'Укажите заголовок и текст' });
    }
    const feedbackKind = ['review', 'conclusion', 'recommendation'].includes(kind)
      ? kind
      : 'review';

    const row = await Message.create({
      senderId: req.user.id,
      recipientId: pgId,
      topic: trimmedTitle,
      text: trimmedBody,
      messageType: 'supervisor_feedback',
      feedbackKind: feedbackKind,
      isRead: false
    });

    const kindRu =
      feedbackKind === 'conclusion'
        ? 'Заключение'
        : feedbackKind === 'recommendation'
          ? 'Рекомендация'
          : 'Отзыв';
    await notifyUser(
      pgId,
      'Обратная связь от руководителя',
      `${kindRu}: ${trimmedTitle}`,
      '/postgraduate'
    );
    await writeAudit(req.user.id, 'supervisor_feedback_create', 'Message', row.id, {
      postgraduateId: pgId,
      kind: feedbackKind
    });

    res.status(201).json(messageToFeedback(row));
  } catch (error) {
    console.error('supervisor/feedback POST:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/plans/bulk-approve', ...supervisorOnly, async (req, res) => {
  try {
    const { academicYear } = req.body || {};
    if (!academicYear) {
      return res.status(400).json({ error: 'Укажите academicYear' });
    }

    const postgraduateIds = await supervisedPostgraduateIds(req.user.id);
    if (!postgraduateIds.length) {
      return res.json({ updated: 0 });
    }

    const plans = await IndividualPlan.findAll({
      where: {
        userId: { [Op.in]: postgraduateIds },
        academicYear: String(academicYear).trim(),
        status: 'submitted'
      }
    });

    let updated = 0;
    for (const p of plans) {
      p.status = 'approved';
      await p.save();
      updated += 1;
    }

    res.json({ updated });
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
