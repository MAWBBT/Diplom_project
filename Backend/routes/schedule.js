const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Schedule, User } = require('../models');

// GET /api/schedule - Получить расписание
// Аспиранты видят только своё расписание; профессора и администраторы — полное
router.get('/', requireAuth, async (req, res) => {
  try {
    let schedules;
    
    if (req.user.role === 'postgraduate') {
      schedules = await Schedule.findAll({
        where: { userId: req.user.id },
        order: [
          ['date', 'ASC'],
          ['dayOfWeek', 'ASC'],
          ['time', 'ASC']
        ]
      });
    } else {
      // Профессора и администраторы видят все расписания
      schedules = await Schedule.findAll({
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'login', 'groupName']
        }],
        order: [
          ['date', 'ASC'],
          ['dayOfWeek', 'ASC'],
          ['time', 'ASC']
        ]
      });
    }

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

    const { userId, dayOfWeek, time, subject, teacher, auditorium, date } = req.body;

    if (!dayOfWeek || !time || !subject) {
      return res.status(400).json({ error: 'День недели, время и предмет обязательны' });
    }

    const schedule = await Schedule.create({
      userId: userId || req.user.id,
      dayOfWeek,
      time,
      subject,
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

module.exports = router;

