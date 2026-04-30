const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Schedule, User, Subject } = require('../models');
const { Op } = require('sequelize');

function normalizeDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function canManageScheduleRow(user, row) {
  if (!user || !row) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'professor') {
    // Simple ownership rule: professor can manage only own lessons (by teacher name match)
    return !!row.teacher && row.teacher === user.fullName;
  }
  return false;
}

// GET /api/schedule - Получить расписание
// Аспиранты видят только своё расписание; профессора и администраторы — полное
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      groupName,
      subjectId,
      teacher,
      dateFrom,
      dateTo
    } = req.query || {};

    const where = {};
    const include = [{
      model: Subject,
      as: 'subjectRef',
      attributes: ['id', 'name']
    }];
    
    if (req.user.role === 'postgraduate') {
      where.userId = req.user.id;
    } else {
      include.unshift({
        model: User,
        as: 'user',
        attributes: ['id', 'fullName', 'login', 'groupName']
      });
    }

    if (subjectId) where.subjectId = parseInt(subjectId, 10);
    if (teacher) where.teacher = { [Op.iLike]: `%${String(teacher).trim()}%` };

    const from = normalizeDateOnly(dateFrom);
    const to = normalizeDateOnly(dateTo);
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }

    // groupName filter requires join on User; available only for non-postgraduate requesters
    if (groupName && req.user.role !== 'postgraduate') {
      const gn = String(groupName).trim();
      if (gn) {
        include[0].where = { groupName: { [Op.iLike]: `%${gn}%` } };
        include[0].required = true;
      }
    }

    const schedules = await Schedule.findAll({
        include,
        where,
        order: [
          ['date', 'ASC'],
          ['dayOfWeek', 'ASC'],
          ['time', 'ASC']
        ]
      });

    res.json(schedules);
  } catch (error) {
    console.error('Ошибка получения расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/schedule — создание записи (администратор, профессор)
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'professor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const { userId, dayOfWeek, time, subjectId, teacher, auditorium, date } = req.body;

    if (!dayOfWeek || !time || !subjectId) {
      return res.status(400).json({ error: 'День недели, время и предмет обязательны' });
    }

    const schedule = await Schedule.create({
      userId: userId || req.user.id,
      dayOfWeek,
      time,
      subjectId,
      teacher,
      auditorium,
      date
    });

    res.status(201).json(schedule);
  } catch (error) {
    console.error('Ошибка создания расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/schedule/:id — редактирование занятия (admin, professor)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'professor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const row = await Schedule.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Запись расписания не найдена' });

    if (!canManageScheduleRow(req.user, row)) {
      return res.status(403).json({ error: 'Нет прав на изменение этой записи' });
    }

    const { userId, dayOfWeek, time, subjectId, teacher, auditorium, date } = req.body || {};

    // admin can reassign; professor cannot change userId
    if (req.user.role === 'admin' && userId !== undefined) row.userId = userId;
    if (dayOfWeek !== undefined) row.dayOfWeek = dayOfWeek;
    if (time !== undefined) row.time = time;
    if (subjectId !== undefined) row.subjectId = subjectId;
    if (teacher !== undefined) row.teacher = teacher;
    if (auditorium !== undefined) row.auditorium = auditorium;
    if (date !== undefined) row.date = date;

    await row.save();
    res.json(row);
  } catch (error) {
    console.error('Ошибка обновления расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/schedule/:id — удаление занятия (admin, professor)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'professor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const row = await Schedule.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Запись расписания не найдена' });

    if (!canManageScheduleRow(req.user, row)) {
      return res.status(403).json({ error: 'Нет прав на удаление этой записи' });
    }

    await row.destroy();
    res.status(204).end();
  } catch (error) {
    console.error('Ошибка удаления занятия:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

