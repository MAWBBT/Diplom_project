const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { User, Schedule, Grade, Subject } = require('../models');
const { Op } = require('sequelize');

const requireProfessorOrAdmin = (req, res, next) => {
  if (!['professor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Требуются права профессора или администратора' });
  }
  next();
};

router.get('/postgraduates', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  try {
    const list = await User.findAll({
      where: { role: 'postgraduate' },
      attributes: { exclude: ['password'] },
      order: [['groupName', 'ASC'], ['fullName', 'ASC']]
    });
    res.json(list);
  } catch (error) {
    console.error('Ошибка получения аспирантов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/journal/subjects - Получить все предметы
router.get('/subjects', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  try {
    const subjects = await Subject.findAll({
      order: [['name', 'ASC']]
    });
    res.json(subjects);
  } catch (error) {
    console.error('Ошибка получения предметов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/journal/schedule - Получить расписание для журнала (с датами)
router.get('/schedule', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  try {
    const whereClause = {
      date: {
        [Op.not]: null
      }
    };

    if (req.user.role === 'professor') {
      whereClause.teacher = req.user.fullName;
    }

    const schedules = await Schedule.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'fullName', 'groupName']
      }],
      where: whereClause,
      order: [['date', 'ASC'], ['time', 'ASC']]
    });
    res.json(schedules);
  } catch (error) {
    console.error('Ошибка получения расписания для журнала:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/grades/:postgraduateId/:scheduleId', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  try {
    const { postgraduateId, scheduleId } = req.params;
    
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Занятие не найдено' });
    }

    if (req.user.role === 'professor' && schedule.teacher !== req.user.fullName) {
      return res.status(403).json({ error: 'Доступ запрещён. Это не ваше занятие.' });
    }

    const grade = await Grade.findOne({
      where: {
        userId: postgraduateId,
        subject: schedule.subject,
        controlType: {
          [Op.like]: `%${schedule.date || schedule.dayOfWeek}%`
        }
      },
      order: [['createdAt', 'DESC']]
    });

    res.json(grade ? [grade] : []);
  } catch (error) {
    console.error('Ошибка получения оценок:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/grade', requireAuth, async (req, res) => {
  if (req.user.role !== 'professor') {
    return res.status(403).json({ error: 'Только профессор может выставлять оценки' });
  }
  try {
    const postgraduateId = req.body.postgraduateId;
    const { scheduleId, grade, comment } = req.body;

    if (!postgraduateId || !scheduleId || !grade) {
      return res.status(400).json({ error: 'Укажите аспиранта, занятие и оценку' });
    }

    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Занятие не найдено' });
    }

    if (schedule.teacher !== req.user.fullName) {
      return res.status(403).json({ error: 'Можно выставлять оценки только по своим занятиям' });
    }

    // Проверяем, есть ли уже оценка для этого занятия
    // Приоритет отдаем дню недели, если он есть
    const controlTypeStr = schedule.dayOfWeek || (schedule.date ? schedule.date : '');
    const existingGrade = await Grade.findOne({
      where: {
        userId: postgraduateId,
        subject: schedule.subject,
        [Op.or]: [
          { controlType: `Занятие ${controlTypeStr}` },
          { controlType: { [Op.like]: `%${controlTypeStr}%` } }
        ]
      }
    });

    if (existingGrade) {
      // Обновляем существующую оценку
      existingGrade.grade = grade;
      existingGrade.controlType = `Занятие ${controlTypeStr}`; // Обновляем для единообразия
      if (comment !== undefined) existingGrade.comment = comment;
      await existingGrade.save();
      res.json(existingGrade);
    } else {
      // Создаём новую оценку
      // Используем день недели, если он есть, иначе дату
      const controlTypeValue = schedule.dayOfWeek || (schedule.date ? schedule.date : '');
      const newGrade = await Grade.create({
        userId: postgraduateId,
        subject: schedule.subject,
        controlType: `Занятие ${controlTypeValue}`,
        grade: grade,
        comment: comment || ''
      });
      res.status(201).json(newGrade);
    }
  } catch (error) {
    console.error('Ошибка создания/обновления оценки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/journal/grade/:gradeId - Удалить оценку
router.delete('/grade/:gradeId', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.gradeId);
    if (!grade) {
      return res.status(404).json({ error: 'Оценка не найдена' });
    }

    if (req.user.role === 'professor') {
      const schedule = await Schedule.findOne({
        where: {
          userId: grade.userId,
          subject: grade.subject
        },
        order: [['createdAt', 'DESC']]
      });

      if (!schedule || schedule.teacher !== req.user.fullName) {
        return res.status(403).json({ error: 'Можно удалять оценки только по своим занятиям' });
      }
    }

    await grade.destroy();
    res.json({ message: 'Оценка удалена' });
  } catch (error) {
    console.error('Ошибка удаления оценки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;


