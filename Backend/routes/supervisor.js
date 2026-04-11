const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { Op } = require('sequelize');
const { userSupervisesPostgraduate } = require('../utils/supervision');
const { notifyUser } = require('../utils/notify');
const { writeAudit } = require('../utils/audit');
const {
  Supervision,
  User,
  PostgraduateProfile,
  DissertationTopic,
  IndividualPlan,
  PlanItem,
  Milestone,
  Publication,
  Attestation,
  AcademicDocument,
  DocumentFile,
  Program,
  DissertationTopicHistory
} = require('../models');

const profOnly = [requireAuth, requireRole('professor')];

async function assertSupervises(res, supervisorId, postgraduateId) {
  const ok = await userSupervisesPostgraduate(supervisorId, postgraduateId);
  if (!ok) {
    res.status(403).json({ error: 'Нет доступа к этому аспиранту' });
    return false;
  }
  return true;
}

async function loadPostgraduateBundle(postgraduateId) {
  const [
    profile,
    topics,
    plans,
    milestones,
    publications,
    attestations,
    documents,
    supervisions,
    topicHistory
  ] = await Promise.all([
    PostgraduateProfile.findOne({
      where: { userId: postgraduateId },
      include: [{ model: Program, as: 'program', attributes: ['id', 'code', 'name'] }]
    }),
    DissertationTopic.findAll({ where: { userId: postgraduateId }, order: [['updatedAt', 'DESC']] }),
    IndividualPlan.findAll({
      where: { userId: postgraduateId },
      include: [{ model: PlanItem, as: 'items' }],
      order: [['academicYear', 'DESC']]
    }),
    Milestone.findAll({ where: { userId: postgraduateId }, order: [['dueDate', 'ASC']] }),
    Publication.findAll({ where: { userId: postgraduateId }, order: [['year', 'DESC']] }),
    Attestation.findAll({ where: { userId: postgraduateId }, order: [['attestedAt', 'DESC']] }),
    AcademicDocument.findAll({
      where: { userId: postgraduateId },
      include: [{ model: DocumentFile, as: 'files' }],
      order: [['updatedAt', 'DESC']]
    }),
    Supervision.findAll({
      where: { postgraduateId, isActive: true },
      include: [
        { model: User, as: 'supervisor', attributes: ['id', 'fullName', 'email', 'login'] }
      ]
    }),
    DissertationTopicHistory.findAll({
      where: { userId: postgraduateId },
      order: [['createdAt', 'DESC']],
      limit: 20,
      include: [{ model: User, as: 'changedBy', attributes: ['id', 'fullName'] }]
    })
  ]);

  const pgUser = await User.findByPk(postgraduateId, {
    attributes: { exclude: ['password'] }
  });

  return {
    user: pgUser,
    profile,
    dissertationTopics: topics,
    individualPlans: plans,
    milestones,
    publications,
    attestations,
    documents,
    supervisions,
    topicHistory
  };
}

router.get('/supervisions', ...profOnly, async (req, res) => {
  try {
    const rows = await Supervision.findAll({
      where: { supervisorId: req.user.id, isActive: true },
      include: [
        {
          model: User,
          as: 'postgraduate',
          attributes: ['id', 'fullName', 'login', 'email', 'groupName']
        }
      ],
      order: [['startedAt', 'DESC']]
    });

    const enriched = await Promise.all(
      rows.map(async (s) => {
        const pg = s.postgraduate;
        const profile = pg
          ? await PostgraduateProfile.findOne({ where: { userId: pg.id } })
          : null;
        const topic = pg
          ? await DissertationTopic.findOne({
              where: { userId: pg.id },
              order: [['updatedAt', 'DESC']]
            })
          : null;
        return {
          supervision: s.toJSON(),
          postgraduate: pg ? pg.toSafeJSON() : null,
          profile,
          latestTopic: topic
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('supervisor/supervisions:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/postgraduate/:userId', ...profOnly, async (req, res) => {
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

router.patch('/plans/:planId', ...profOnly, async (req, res) => {
  try {
    const plan = await IndividualPlan.findByPk(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (!await assertSupervises(res, req.user.id, plan.userId)) return;

    const { status } = req.body;
    if (!status || !['approved', 'rejected', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Укажите status: approved | rejected | archived' });
    }
    if (plan.status !== 'submitted' && status !== 'archived') {
      return res.status(400).json({ error: 'Утверждать можно только отправленный план' });
    }
    plan.status = status;
    await plan.save();
    await notifyUser(
      plan.userId,
      'Индивидуальный план',
      status === 'approved'
        ? `Ваш ИПР на ${plan.academicYear} утверждён научным руководителем.`
        : `ИПР на ${plan.academicYear} возвращён на доработку.`,
      '/postgraduate.html'
    );
    await writeAudit(req.user.id, `plan_${status}`, 'IndividualPlan', plan.id, { postgraduateId: plan.userId });
    const full = await IndividualPlan.findByPk(plan.id, {
      include: [{ model: PlanItem, as: 'items' }]
    });
    res.json(full);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/plan-items/:itemId', ...profOnly, async (req, res) => {
  try {
    const item = await PlanItem.findByPk(req.params.itemId, {
      include: [{ model: IndividualPlan, as: 'plan' }]
    });
    if (!item || !item.plan) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, item.plan.userId)) return;

    const { supervisorNotes } = req.body;
    if (supervisorNotes !== undefined) item.supervisorNotes = supervisorNotes;
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/milestones/:id', ...profOnly, async (req, res) => {
  try {
    const m = await Milestone.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, m.userId)) return;

    const { supervisorComment, status } = req.body;
    if (supervisorComment !== undefined) m.supervisorComment = supervisorComment;
    if (status !== undefined && ['pending', 'in_progress', 'done', 'skipped'].includes(status)) {
      m.status = status;
    }
    await m.save();
    await notifyUser(m.userId, 'Веха в плане подготовки', `Обновлена веха: ${m.title}`, '/postgraduate.html');
    res.json(m);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/topics/:id', ...profOnly, async (req, res) => {
  try {
    const t = await DissertationTopic.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Не найдено' });
    if (!await assertSupervises(res, req.user.id, t.userId)) return;

    const { status, rejectReason } = req.body;
    if (!status || !['approved', 'rejected', 'submitted'].includes(status)) {
      return res.status(400).json({ error: 'Укажите status' });
    }
    if (status === 'approved' || status === 'rejected') {
      if (!['submitted', 'draft'].includes(t.status)) {
        return res.status(400).json({ error: 'Недопустимый переход статуса темы' });
      }
      t.status = status;
      t.rejectReason = status === 'rejected' ? (rejectReason || null) : null;
      await t.save();
      await notifyUser(
        t.userId,
        'Тема диссертации',
        status === 'approved' ? 'Тема диссертации утверждена.' : `Тема отклонена: ${rejectReason || ''}`,
        '/postgraduate.html'
      );
      await writeAudit(req.user.id, `topic_${status}`, 'DissertationTopic', t.id, { postgraduateId: t.userId });
    }
    res.json(t);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/documents/:id', ...profOnly, async (req, res) => {
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

router.patch('/publications/:id', ...profOnly, async (req, res) => {
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

router.get('/documents/:docId/files/:fileId/download', ...profOnly, async (req, res) => {
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
    res.download(fp, f.originalName);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/plans/bulk-approve', ...profOnly, async (req, res) => {
  try {
    const { academicYear } = req.body || {};
    if (!academicYear) {
      return res.status(400).json({ error: 'Укажите academicYear' });
    }

    const rows = await Supervision.findAll({
      where: { supervisorId: req.user.id, isActive: true }
    });
    const postgraduateIds = rows.map((r) => r.postgraduateId);
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
