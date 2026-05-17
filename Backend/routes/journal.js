const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { User, Schedule, Grade, Subject } = require('../models');
const { Op } = require('sequelize');
const {
  getProfessorSubjectIds,
  scheduleBelongsToProfessor,
  professorTeachesSubject
} = require('../utils/professorSubjects');
const { dedupeScheduleSlots } = require('../utils/scheduleSlots');
const { studentRoleWhere } = require('../utils/roles');

const { hasRole, ROLES } = require('../utils/roles');

const requireSupervisorOrAdmin = (req, res, next) => {
  if (!hasRole(req.user, ROLES.SUPERVISOR, ROLES.ADMIN)) {
    return res.status(403).json({ error: 'Требуются права научного руководителя или администратора' });
  }
  next();
};

const isTeachingSupervisor = (user) => hasRole(user, ROLES.SUPERVISOR);

function scheduleMatchesPostgraduateGroup(scheduleRow, postgraduate) {
  if (!scheduleRow || !postgraduate) return false;
  const pgGroup = (postgraduate.groupName || '').trim();
  if (pgGroup) {
    return (scheduleRow.user?.groupName || '').trim() === pgGroup;
  }
  return String(scheduleRow.userId) === String(postgraduate.id);
}

// GET /api/journal/workspace — аспиранты, занятия, дисциплины и оценки одним запросом
router.get('/workspace', requireAuth, requireSupervisorOrAdmin, async (req, res) => {
  try {
    const [postgraduates, schedulesRaw, subjects] = await Promise.all([
      User.findAll({
        where: studentRoleWhere(),
        attributes: { exclude: ['password'] },
        order: [['groupName', 'ASC'], ['fullName', 'ASC']]
      }),
      Schedule.findAll({
        include: [
          { model: User, as: 'user', attributes: ['id', 'fullName', 'groupName'] },
          { model: Subject, as: 'subjectRef', attributes: ['id', 'name'] }
        ],
        order: [['date', 'ASC'], ['time', 'ASC']]
      }),
      (async () => {
        if (isTeachingSupervisor(req.user)) {
          const ids = await getProfessorSubjectIds(req.user);
          if (!ids.length) return [];
          return Subject.findAll({ where: { id: { [Op.in]: ids } }, order: [['name', 'ASC']] });
        }
        return Subject.findAll({ order: [['name', 'ASC']] });
      })()
    ]);

    let schedule =
      isTeachingSupervisor(req.user)
        ? schedulesRaw.filter((s) => scheduleBelongsToProfessor(s, req.user))
        : schedulesRaw;
    schedule = dedupeScheduleSlots(schedule);

    const gradeWhere = {};
    if (isTeachingSupervisor(req.user)) {
      const ids = await getProfessorSubjectIds(req.user);
      if (!ids.length) {
        return res.json({ postgraduates, schedule, subjects, grades: [] });
      }
      gradeWhere.subjectId = { [Op.in]: ids };
    }

    const grades = await Grade.findAll({
      where: gradeWhere,
      include: [
        { model: Subject, as: 'subjectRef', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'fullName', 'login', 'groupName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ postgraduates, schedule, subjects, grades });
  } catch (error) {
    console.error('journal/workspace:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/postgraduates', requireAuth, requireSupervisorOrAdmin, async (req, res) => {
  try {
    const list = await User.findAll({
      where: studentRoleWhere(),
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
router.get('/subjects', requireAuth, requireSupervisorOrAdmin, async (req, res) => {
  try {
    let subjects;
    if (isTeachingSupervisor(req.user)) {
      const ids = await getProfessorSubjectIds(req.user);
      if (!ids.length) {
        return res.json([]);
      }
      subjects = await Subject.findAll({
        where: { id: { [Op.in]: ids } },
        order: [['name', 'ASC']]
      });
    } else {
      subjects = await Subject.findAll({
        order: [['name', 'ASC']]
      });
    }
    res.json(subjects);
  } catch (error) {
    console.error('Ошибка получения предметов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/journal/schedule — занятия для журнала (опционально ?postgraduateId= или ?groupName=)
router.get('/schedule', requireAuth, requireSupervisorOrAdmin, async (req, res) => {
  try {
    const schedules = await Schedule.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'fullName', 'groupName']
      }, {
        model: Subject,
        as: 'subjectRef',
        attributes: ['id', 'name']
      }],
      order: [['date', 'ASC'], ['time', 'ASC']]
    });

    let list =
      isTeachingSupervisor(req.user)
        ? schedules.filter((s) => scheduleBelongsToProfessor(s, req.user))
        : schedules;

    const { postgraduateId, groupName } = req.query;
    if (postgraduateId) {
      const postgraduate = await User.findByPk(postgraduateId, {
        attributes: ['id', 'groupName', 'role']
      });
      if (!postgraduate || !['student', 'postgraduate'].includes(postgraduate.role)) {
        return res.status(404).json({ error: 'Аспирант не найден' });
      }
      list = list.filter((s) => scheduleMatchesPostgraduateGroup(s, postgraduate));
      list = dedupeScheduleSlots(list, postgraduate.id);
    } else if (groupName && String(groupName).trim()) {
      const g = String(groupName).trim();
      list = list.filter((s) => (s.user?.groupName || '').trim() === g);
      list = dedupeScheduleSlots(list);
    }

    res.json(list);
  } catch (error) {
    console.error('Ошибка получения расписания для журнала:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/grades/:postgraduateId/:scheduleId', requireAuth, requireSupervisorOrAdmin, async (req, res) => {
  try {
    const { postgraduateId, scheduleId } = req.params;
    
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Занятие не найдено' });
    }

    if (!scheduleBelongsToProfessor(schedule, req.user)) {
      return res.status(403).json({ error: 'Доступ запрещён. Это не ваше занятие.' });
    }

    const whereClause = {
      userId: postgraduateId,
      subjectId: schedule.subjectId,
      controlType: {
        [Op.like]: `%${schedule.date || schedule.dayOfWeek}%`
      }
    };

    const grade = await Grade.findOne({
      where: {
        ...whereClause
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
  if (!hasRole(req.user, ROLES.SUPERVISOR, ROLES.ADMIN)) {
    return res.status(403).json({ error: 'Недостаточно прав для выставления оценок' });
  }
  try {
    const postgraduateId = req.body.postgraduateId;
    const { scheduleId, grade, comment } = req.body;

    if (!postgraduateId || !scheduleId || !grade) {
      return res.status(400).json({ error: 'Укажите аспиранта, занятие и оценку' });
    }

    const [postgraduate, schedule] = await Promise.all([
      User.findByPk(postgraduateId, { attributes: ['id', 'role', 'groupName', 'fullName'] }),
      Schedule.findByPk(scheduleId, {
        include: [{ model: User, as: 'user', attributes: ['id', 'groupName'] }]
      })
    ]);

    if (!postgraduate || !['student', 'postgraduate'].includes(postgraduate.role)) {
      return res.status(404).json({ error: 'Аспирант не найден' });
    }
    if (!schedule) {
      return res.status(404).json({ error: 'Занятие не найдено' });
    }

    if (isTeachingSupervisor(req.user) && !scheduleBelongsToProfessor(schedule, req.user)) {
      return res.status(403).json({ error: 'Можно выставлять оценки только по своим дисциплинам и занятиям' });
    }

    if (!scheduleMatchesPostgraduateGroup(schedule, postgraduate)) {
      return res.status(400).json({
        error: 'Занятие относится к другой группе. Выберите пару из расписания группы аспиранта.'
      });
    }

    // Проверяем, есть ли уже оценка для этого занятия
    // Приоритет отдаем дню недели, если он есть
    const controlTypeStr = schedule.dayOfWeek || (schedule.date ? schedule.date : '');
    const existingWhere = {
      userId: postgraduateId,
      subjectId: schedule.subjectId,
      [Op.or]: [
        { controlType: `Занятие ${controlTypeStr}` },
        { controlType: { [Op.like]: `%${controlTypeStr}%` } }
      ]
    };

    const existingGrade = await Grade.findOne({
      where: {
        ...existingWhere
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
        subjectId: schedule.subjectId,
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
router.delete('/grade/:gradeId', requireAuth, requireSupervisorOrAdmin, async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.gradeId);
    if (!grade) {
      return res.status(404).json({ error: 'Оценка не найдена' });
    }

    if (isTeachingSupervisor(req.user)) {
      const teaches = await professorTeachesSubject(req.user, grade.subjectId);
      if (!teaches) {
        return res.status(403).json({ error: 'Можно удалять оценки только по своим дисциплинам' });
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


