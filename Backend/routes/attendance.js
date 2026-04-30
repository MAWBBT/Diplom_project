const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { userSupervisesPostgraduate } = require('../utils/supervision');
const { AttendanceSession, AttendanceRecord, User, Subject } = require('../models');

function normalizeDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function canManageSession(user, session) {
  if (!user || !session) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'professor') return session.teacher === user.fullName;
  return false;
}

// POST /api/attendance/sessions - создать занятие для отметки посещаемости (admin, professor)
router.post('/sessions', requireAuth, requireRole('admin', 'professor'), async (req, res) => {
  try {
    const { heldOn, groupName, subjectId, time, teacher, auditorium } = req.body || {};
    const date = normalizeDateOnly(heldOn);
    if (!date) return res.status(400).json({ error: 'Укажите heldOn (YYYY-MM-DD)' });
    if (!groupName || String(groupName).trim() === '') return res.status(400).json({ error: 'Укажите groupName' });
    if (!subjectId) return res.status(400).json({ error: 'Укажите subjectId' });

    const resolvedTeacher =
      req.user.role === 'professor'
        ? req.user.fullName
        : (teacher && String(teacher).trim()) || req.user.fullName;

    const session = await AttendanceSession.create({
      heldOn: date,
      groupName: String(groupName).trim(),
      subjectId: parseInt(subjectId, 10),
      teacher: resolvedTeacher,
      time: time || null,
      auditorium: auditorium || null,
      createdById: req.user.id
    });

    res.status(201).json(session);
  } catch (e) {
    console.error('attendance/sessions create:', e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/attendance/sessions - список занятий (admin, professor)
router.get('/sessions', requireAuth, requireRole('admin', 'professor'), async (req, res) => {
  try {
    const { dateFrom, dateTo, groupName, subjectId, teacher } = req.query || {};
    const where = {};

    const from = normalizeDateOnly(dateFrom);
    const to = normalizeDateOnly(dateTo);
    if (from || to) {
      where.heldOn = {};
      if (from) where.heldOn[Op.gte] = from;
      if (to) where.heldOn[Op.lte] = to;
    }
    if (groupName && String(groupName).trim()) where.groupName = { [Op.iLike]: `%${String(groupName).trim()}%` };
    if (subjectId) where.subjectId = parseInt(subjectId, 10);
    if (teacher && String(teacher).trim()) where.teacher = { [Op.iLike]: `%${String(teacher).trim()}%` };

    if (req.user.role === 'professor') {
      where.teacher = req.user.fullName;
    }

    const rows = await AttendanceSession.findAll({
      where,
      include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }],
      order: [['heldOn', 'DESC'], ['time', 'ASC'], ['createdAt', 'DESC']],
      limit: 200
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/attendance/sessions/:id/roster - список аспирантов группы + текущие отметки
router.get('/sessions/:id/roster', requireAuth, requireRole('admin', 'professor'), async (req, res) => {
  try {
    const session = await AttendanceSession.findByPk(req.params.id, {
      include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }]
    });
    if (!session) return res.status(404).json({ error: 'Занятие не найдено' });
    if (!canManageSession(req.user, session)) return res.status(403).json({ error: 'Нет доступа' });

    const postgraduates = await User.findAll({
      where: { role: 'postgraduate', groupName: session.groupName, isActive: true },
      attributes: ['id', 'fullName', 'login', 'groupName'],
      order: [['fullName', 'ASC']]
    });

    const records = await AttendanceRecord.findAll({
      where: { sessionId: session.id },
      order: [['updatedAt', 'DESC']]
    });
    const byPg = new Map(records.map((r) => [r.postgraduateId, r]));

    res.json({
      session,
      postgraduates: postgraduates.map((u) => u.toSafeJSON()),
      records: records.map((r) => r.toJSON()),
      byPostgraduate: Object.fromEntries(
        postgraduates.map((u) => {
          const r = byPg.get(u.id);
          return [u.id, r ? r.toJSON() : null];
        })
      )
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/attendance/sessions/:id/mark - пакетная отметка посещаемости по группе
// body: { marks: [{ postgraduateId, status, note }] }
router.put('/sessions/:id/mark', requireAuth, requireRole('admin', 'professor'), async (req, res) => {
  try {
    const session = await AttendanceSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ error: 'Занятие не найдено' });
    if (!canManageSession(req.user, session)) return res.status(403).json({ error: 'Нет доступа' });

    const marks = Array.isArray(req.body?.marks) ? req.body.marks : [];
    if (!marks.length) return res.status(400).json({ error: 'marks пуст' });

    const validStatuses = new Set(['present', 'absent', 'late']);
    let updated = 0;
    for (const m of marks) {
      const postgraduateId = parseInt(m.postgraduateId, 10);
      const status = String(m.status || '').trim();
      if (!postgraduateId || !validStatuses.has(status)) continue;

      const [row] = await AttendanceRecord.findOrCreate({
        where: { sessionId: session.id, postgraduateId },
        defaults: {
          status,
          note: m.note || null,
          markedById: req.user.id
        }
      });
      if (row.status !== status || (m.note !== undefined && row.note !== m.note) || row.markedById !== req.user.id) {
        row.status = status;
        if (m.note !== undefined) row.note = m.note || null;
        row.markedById = req.user.id;
        await row.save();
      }
      updated += 1;
    }

    res.json({ updated });
  } catch (e) {
    console.error('attendance mark:', e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/attendance/my - история и статистика для аспиранта
router.get('/my', requireAuth, requireRole('postgraduate'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query || {};
    const whereSession = {};
    const from = normalizeDateOnly(dateFrom);
    const to = normalizeDateOnly(dateTo);
    if (from || to) {
      whereSession.heldOn = {};
      if (from) whereSession.heldOn[Op.gte] = from;
      if (to) whereSession.heldOn[Op.lte] = to;
    }

    const records = await AttendanceRecord.findAll({
      where: { postgraduateId: req.user.id },
      include: [{
        model: AttendanceSession,
        as: 'session',
        where: whereSession,
        include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }]
      }],
      order: [[{ model: AttendanceSession, as: 'session' }, 'heldOn', 'DESC'], ['updatedAt', 'DESC']],
      limit: 500
    });

    const stats = { present: 0, absent: 0, late: 0, total: records.length };
    for (const r of records) stats[r.status] = (stats[r.status] || 0) + 1;

    res.json({ stats, records });
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/attendance/supervised/:postgraduateId - статистика посещаемости аспиранта для руководителя
router.get('/supervised/:postgraduateId', requireAuth, requireRole('professor'), async (req, res) => {
  try {
    const postgraduateId = parseInt(req.params.postgraduateId, 10);
    if (!postgraduateId) return res.status(400).json({ error: 'Некорректный postgraduateId' });
    const ok = await userSupervisesPostgraduate(req.user.id, postgraduateId);
    if (!ok) return res.status(403).json({ error: 'Нет доступа к этому аспиранту' });

    const { dateFrom, dateTo } = req.query || {};
    const whereSession = {};
    const from = normalizeDateOnly(dateFrom);
    const to = normalizeDateOnly(dateTo);
    if (from || to) {
      whereSession.heldOn = {};
      if (from) whereSession.heldOn[Op.gte] = from;
      if (to) whereSession.heldOn[Op.lte] = to;
    }

    const records = await AttendanceRecord.findAll({
      where: { postgraduateId },
      include: [{
        model: AttendanceSession,
        as: 'session',
        where: whereSession,
        include: [{ model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }]
      }],
      order: [[{ model: AttendanceSession, as: 'session' }, 'heldOn', 'DESC'], ['updatedAt', 'DESC']],
      limit: 500
    });
    const stats = { present: 0, absent: 0, late: 0, total: records.length };
    for (const r of records) stats[r.status] = (stats[r.status] || 0) + 1;

    res.json({ stats, records });
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/attendance/admin/summary - агрегированная статистика (admin)
router.get('/admin/summary', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo, groupName } = req.query || {};
    const whereSession = {};
    const from = normalizeDateOnly(dateFrom);
    const to = normalizeDateOnly(dateTo);
    if (from || to) {
      whereSession.heldOn = {};
      if (from) whereSession.heldOn[Op.gte] = from;
      if (to) whereSession.heldOn[Op.lte] = to;
    }
    if (groupName && String(groupName).trim()) {
      whereSession.groupName = { [Op.iLike]: `%${String(groupName).trim()}%` };
    }

    const records = await AttendanceRecord.findAll({
      include: [{
        model: AttendanceSession,
        as: 'session',
        where: whereSession
      }],
      limit: 20000
    });

    const stats = { present: 0, absent: 0, late: 0, total: records.length };
    for (const r of records) stats[r.status] = (stats[r.status] || 0) + 1;
    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

