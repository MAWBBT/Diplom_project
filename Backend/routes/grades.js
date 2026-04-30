const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Grade, Subject } = require('../models');
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const grades = await Grade.findAll({
      include: [{
        model: Subject,
        as: 'subjectRef',
        attributes: ['id', 'name']
      }],
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
    res.json(grades);
  } catch (error) {
    console.error('Ошибка получения оценок:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'professor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    const { userId, subjectId, controlType, grade, comment } = req.body;
    if (!userId || !subjectId || !controlType || !grade) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    const gradeRecord = await Grade.create({
      userId,
      subjectId,
      controlType,
      grade,
      comment
    });
    res.status(201).json(gradeRecord);
  } catch (error) {
    console.error('Ошибка создания оценки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
module.exports = router;