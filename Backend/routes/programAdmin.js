const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { studentRoleWhere } = require('../utils/roles');
const {
  User,
  PostgraduateProfile,
  IndividualPlan,
  PlanItem,
  AcademicDocument,
  Program
} = require('../models');
const {
  syncAndCountAllOverduePlanItems,
  syncAndCountOverduePlanItemsForUser
} = require('../utils/planItemOverdue');

const adminProgOnly = [requireAuth, requireRole('admin')];

router.get('/overview', ...adminProgOnly, async (req, res) => {
  try {
    const [totalPostgraduates, totalProfessors] = await Promise.all([
      User.count({ where: studentRoleWhere() }),
      User.count({ where: { role: { [Op.in]: ['supervisor', 'professor'] } } })
    ]);

    const overduePlanItems = await syncAndCountAllOverduePlanItems(PlanItem, IndividualPlan);

    const plansPending = await IndividualPlan.count({ where: { status: 'submitted' } });
    const docsReview = await AcademicDocument.count({ where: { status: 'on_review' } });

    res.json({
      counts: {
        postgraduates: totalPostgraduates,
        professors: totalProfessors,
        usersTotal: await User.count(),
        overduePlanItems,
        plansPendingApproval: plansPending,
        documentsOnReview: docsReview
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('program-admin/overview:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/postgraduates', ...adminProgOnly, async (req, res) => {
  try {
    const users = await User.findAll({
      where: studentRoleWhere(),
      attributes: { exclude: ['password'] },
      order: [['groupName', 'ASC'], ['fullName', 'ASC']]
    });
    const enriched = await Promise.all(
      users.map(async (u) => {
        const profile = await PostgraduateProfile.findOne({
          where: { userId: u.id },
          include: [{ model: Program, as: 'program', attributes: ['code', 'name'] }]
        });
        const overdue = await syncAndCountOverduePlanItemsForUser(PlanItem, IndividualPlan, u.id);
        const pendingPlan = await IndividualPlan.findOne({
          where: { userId: u.id, status: 'submitted' }
        });
        return {
          user: u.toSafeJSON(),
          profile,
          overduePlanItems: overdue,
          hasPlanPendingApproval: !!pendingPlan
        };
      })
    );
    res.json(enriched);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/** Список просроченных этапов ИУП (admin программы). */
async function overduePlanItemsListHandler(req, res) {
  try {
    await syncAndCountAllOverduePlanItems(PlanItem, IndividualPlan);
    const rows = await PlanItem.findAll({
      where: { status: 'overdue' },
      include: [{
        model: IndividualPlan,
        as: 'plan',
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'fullName', 'groupName', 'email']
        }]
      }],
      order: [['dueDate', 'ASC']]
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

router.get('/plan-items/overdue', ...adminProgOnly, overduePlanItemsListHandler);
// Алиас: старые клиенты и до перезапуска узла могли обращаться сюда
router.get('/milestones/overdue', ...adminProgOnly, overduePlanItemsListHandler);

router.get('/export/postgraduates.csv', ...adminProgOnly, async (req, res) => {
  try {
    const users = await User.findAll({
      where: studentRoleWhere(),
      attributes: ['id', 'login', 'fullName', 'groupName', 'email', 'phone'],
      order: [['fullName', 'ASC']]
    });
    const header = 'id;login;fullName;groupName;email;phone;specialtyCode;department;program\n';
    const lines = await Promise.all(
      users.map(async (u) => {
        const p = await PostgraduateProfile.findOne({ where: { userId: u.id } });
        const prog = p && p.programId
          ? await Program.findByPk(p.programId)
          : null;
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        return [
          u.id,
          esc(u.login),
          esc(u.fullName),
          esc(u.groupName),
          esc(u.email),
          esc(u.phone),
          esc(p ? p.specialtyCode : ''),
          esc(p ? p.department : ''),
          esc(prog ? prog.name : '')
        ].join(';');
      })
    );
    const csv = '\uFEFF' + header + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="postgraduates.csv"');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/programs', ...adminProgOnly, async (_req, res) => {
  try {
    const programs = await Program.findAll({ order: [['name', 'ASC']] });
    res.json(programs);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/programs', ...adminProgOnly, async (req, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Укажите code и name' });
    }
    const p = await Program.create({
      code: String(code).trim(),
      name: String(name).trim(),
      description: description || null
    });
    res.status(201).json(p);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Код программы уже занят' });
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
