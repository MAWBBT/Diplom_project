const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Grade, Subject, User } = require('../models');
const { Op } = require('sequelize');
const { getProfessorSubjectIds, professorTeachesSubject } = require('../utils/professorSubjects');

router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'professor') {
      const subjectIds = await getProfessorSubjectIds(req.user);
      if (!subjectIds.length) {
        return res.json([]);
      }
      const grades = await Grade.findAll({
        include: [
          {
            model: Subject,
            as: 'subjectRef',
            attributes: ['id', 'name']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'fullName', 'login', 'groupName']
          }
        ],
        where: { subjectId: { [Op.in]: subjectIds } },
        order: [['createdAt', 'DESC']]
      });
      return res.json(grades);
    }

    const grades = await Grade.findAll({
      include: [{
        model: Subject,
        as: 'subjectRef',
        attributes: ['id', 'name']
      }],
      where: { userId: req.user.id },
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

    const sid = parseInt(subjectId, 10);
    if (req.user.role === 'professor') {
      const teaches = await professorTeachesSubject(req.user, sid);
      if (!teaches) {
        return res.status(403).json({
          error: 'Можно выставлять оценки только по дисциплинам из вашего расписания'
        });
      }
    }

    const gradeRecord = await Grade.create({
      userId,
      subjectId: sid,
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
