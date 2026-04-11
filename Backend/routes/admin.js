const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { User, Schedule, Grade, Message, Subject, Supervision } = require('../models');

const ALLOWED_ROLES = ['admin', 'postgraduate', 'professor', 'program_admin'];

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
};
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { login, password, fullName, role, groupName, email, phone } = req.body;
    if (!login || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Логин, пароль, ФИО и роль обязательны' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    const existingUser = await User.findOne({ where: { login } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }
    const user = await User.create({
      login,
      password,
      fullName,
      role,
      groupName,
      email,
      phone
    });
    res.status(201).json(user.toSafeJSON());
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const { login, password, fullName, role, groupName, email, phone } = req.body;
    if (login && login !== user.login) {
      const existingUser = await User.findOne({ where: { login } });
      if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
      }
      user.login = login;
    }
    if (password) user.password = password;
    if (fullName) user.fullName = fullName;
    if (role) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Недопустимая роль' });
      }
      user.role = role;
    }
    if (groupName !== undefined) user.groupName = groupName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    await user.save();
    res.json(user.toSafeJSON());
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    await user.destroy();
    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.get('/schedule', requireAuth, requireAdmin, async (req, res) => {
  try {
    const schedules = await Schedule.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'fullName', 'login', 'groupName']
      }],
      order: [['dayOfWeek', 'ASC'], ['time', 'ASC']]
    });
    res.json(schedules);
  } catch (error) {
    console.error('Ошибка получения расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.put('/schedule/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Запись расписания не найдена' });
    }
    const { userId, dayOfWeek, time, subject, teacher, auditorium, date } = req.body;
    if (userId) schedule.userId = userId;
    if (dayOfWeek) schedule.dayOfWeek = dayOfWeek;
    if (time) schedule.time = time;
    if (subject) schedule.subject = subject;
    if (teacher !== undefined) schedule.teacher = teacher;
    if (auditorium !== undefined) schedule.auditorium = auditorium;
    if (date !== undefined) schedule.date = date;
    await schedule.save();
    res.json(schedule);
  } catch (error) {
    console.error('Ошибка обновления расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.delete('/schedule/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Запись расписания не найдена' });
    }
    await schedule.destroy();
    res.json({ message: 'Запись расписания удалена' });
  } catch (error) {
    console.error('Ошибка удаления расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.get('/grades', requireAuth, requireAdmin, async (req, res) => {
  try {
    const grades = await Grade.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'fullName', 'login', 'groupName']
      }],
      order: [['createdAt', 'DESC']]
    });
    res.json(grades);
  } catch (error) {
    console.error('Ошибка получения оценок:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.put('/grades/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.id);
    if (!grade) {
      return res.status(404).json({ error: 'Оценка не найдена' });
    }
    const { userId, subject, controlType, grade: gradeValue, comment } = req.body;
    if (userId) grade.userId = userId;
    if (subject) grade.subject = subject;
    if (controlType) grade.controlType = controlType;
    if (gradeValue) grade.grade = gradeValue;
    if (comment !== undefined) grade.comment = comment;
    await grade.save();
    res.json(grade);
  } catch (error) {
    console.error('Ошибка обновления оценки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.delete('/grades/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.id);
    if (!grade) {
      return res.status(404).json({ error: 'Оценка не найдена' });
    }
    await grade.destroy();
    res.json({ message: 'Оценка удалена' });
  } catch (error) {
    console.error('Ошибка удаления оценки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.get('/messages', requireAuth, requireAdmin, async (req, res) => {
  try {
    const messages = await Message.findAll({
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'fullName', 'login']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'fullName', 'login']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(messages);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.delete('/messages/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    await message.destroy();
    res.json({ message: 'Сообщение удалено' });
  } catch (error) {
    console.error('Ошибка удаления сообщения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.get('/subjects', requireAuth, requireAdmin, async (req, res) => {
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
router.get('/subjects/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    res.json(subject);
  } catch (error) {
    console.error('Ошибка получения предмета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.post('/subjects', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Название предмета обязательно' });
    }
    const subject = await Subject.create({
      name,
      description: description || null
    });
    res.status(201).json(subject);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Предмет с таким названием уже существует' });
    }
    console.error('Ошибка создания предмета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.put('/subjects/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    const { name, description } = req.body;
    if (name !== undefined) subject.name = name;
    if (description !== undefined) subject.description = description;
    await subject.save();
    res.json(subject);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Предмет с таким названием уже существует' });
    }
    console.error('Ошибка обновления предмета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
router.delete('/subjects/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    await subject.destroy();
    res.json({ message: 'Предмет удалён' });
  } catch (error) {
    console.error('Ошибка удаления предмета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/supervisions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { postgraduateId, supervisorId, supervisionKind, startedAt } = req.body;
    if (!postgraduateId || !supervisorId) {
      return res.status(400).json({ error: 'Укажите postgraduateId и supervisorId' });
    }
    const pg = await User.findByPk(postgraduateId);
    const sup = await User.findByPk(supervisorId);
    if (!pg || pg.role !== 'postgraduate') {
      return res.status(400).json({ error: 'Некорректный аспирант' });
    }
    if (!sup || sup.role !== 'professor') {
      return res.status(400).json({ error: 'Некорректный профессор' });
    }
    const kind = supervisionKind === 'co_supervisor' ? 'co_supervisor' : 'primary';
    const row = await Supervision.create({
      postgraduateId,
      supervisorId,
      supervisionKind: kind,
      startedAt: startedAt || new Date().toISOString().slice(0, 10),
      isActive: true
    });
    res.status(201).json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/supervisions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const row = await Supervision.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Не найдено' });
    const { isActive, endedAt } = req.body;
    if (isActive !== undefined) row.isActive = !!isActive;
    if (endedAt !== undefined) row.endedAt = endedAt;
    await row.save();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;