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
  const users = await User.findAll({
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']]
  });
  res.json(users);
});

router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ['password'] }
  });
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json(user);
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
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
});

router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
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
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  }
  await user.destroy();
  res.json({ message: 'Пользователь удалён' });
});

// PATCH /api/admin/users/:id/deactivate - деактивация учётной записи
router.patch('/users/:id/deactivate', requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя деактивировать самого себя' });
  }
  user.isActive = false;
  await user.save();
  res.json(user.toSafeJSON());
});

// PATCH /api/admin/users/:id/activate - активация учётной записи
router.patch('/users/:id/activate', requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  user.isActive = true;
  await user.save();
  res.json(user.toSafeJSON());
});

// GET /api/admin/users-search?role=...&q=... - поиск/фильтрация по роли и ФИО/логину
router.get('/users-search', requireAuth, requireAdmin, async (req, res) => {
  const role = req.query.role ? String(req.query.role) : '';
  const q = req.query.q ? String(req.query.q).trim() : '';

  const where = {};
  if (role && ALLOWED_ROLES.includes(role)) where.role = role;
  if (q) {
    where[require('sequelize').Op.or] = [
      { fullName: { [require('sequelize').Op.iLike]: `%${q}%` } },
      { login: { [require('sequelize').Op.iLike]: `%${q}%` } }
    ];
  }

  const users = await User.findAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
    limit: 200
  });
  res.json(users);
});

router.get('/schedule', requireAuth, requireAdmin, async (req, res) => {
  const schedules = await Schedule.findAll({
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'fullName', 'login', 'groupName']
    }, {
      model: Subject,
      as: 'subjectRef',
      attributes: ['id', 'name']
    }],
    order: [['dayOfWeek', 'ASC'], ['time', 'ASC']]
  });
  res.json(schedules);
});

router.put('/schedule/:id', requireAuth, requireAdmin, async (req, res) => {
  const schedule = await Schedule.findByPk(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: 'Запись расписания не найдена' });
  }
  const { userId, dayOfWeek, time, subjectId, teacher, auditorium, date } = req.body;
  
  if (userId) schedule.userId = userId;
  if (dayOfWeek) schedule.dayOfWeek = dayOfWeek;
  if (time) schedule.time = time;
  if (subjectId) schedule.subjectId = subjectId;
  if (teacher !== undefined) schedule.teacher = teacher;
  if (auditorium !== undefined) schedule.auditorium = auditorium;
  if (date !== undefined) schedule.date = date;
  await schedule.save();
  res.json(schedule);
});

router.delete('/schedule/:id', requireAuth, requireAdmin, async (req, res) => {
  const schedule = await Schedule.findByPk(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: 'Запись расписания не найдена' });
  }
  await schedule.destroy();
  res.json({ message: 'Запись расписания удалена' });
});

router.get('/grades', requireAuth, requireAdmin, async (req, res) => {
  const grades = await Grade.findAll({
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'fullName', 'login', 'groupName']
    }, {
      model: Subject,
      as: 'subjectRef',
      attributes: ['id', 'name']
    }],
    order: [['createdAt', 'DESC']]
  });
  res.json(grades);
});

router.put('/grades/:id', requireAuth, requireAdmin, async (req, res) => {
  const grade = await Grade.findByPk(req.params.id);
  if (!grade) {
    return res.status(404).json({ error: 'Оценка не найдена' });
  }
  const { userId, subjectId, controlType, grade: gradeValue, comment } = req.body;
  if (userId) grade.userId = userId;
  if (subjectId) grade.subjectId = subjectId;
  if (controlType) grade.controlType = controlType;
  if (gradeValue) grade.grade = gradeValue;
  if (comment !== undefined) grade.comment = comment;
  
  await grade.save();
  res.json(grade);
});

router.delete('/grades/:id', requireAuth, requireAdmin, async (req, res) => {
  const grade = await Grade.findByPk(req.params.id);
  if (!grade) {
    return res.status(404).json({ error: 'Оценка не найдена' });
  }
  await grade.destroy();
  res.json({ message: 'Оценка удалена' });
});

router.get('/messages', requireAuth, requireAdmin, async (req, res) => {
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
});

router.delete('/messages/:id', requireAuth, requireAdmin, async (req, res) => {
  const message = await Message.findByPk(req.params.id);
  if (!message) {
    return res.status(404).json({ error: 'Сообщение не найдено' });
  }
  await message.destroy();
  res.json({ message: 'Сообщение удалено' });
});

router.get('/subjects', requireAuth, requireAdmin, async (req, res) => {
  const subjects = await Subject.findAll({
    order: [['name', 'ASC']]
  });
  res.json(subjects);
});

router.get('/subjects/:id', requireAuth, requireAdmin, async (req, res) => {
  const subject = await Subject.findByPk(req.params.id);
  if (!subject) {
    return res.status(404).json({ error: 'Предмет не найден' });
  }
  res.json(subject);
});

router.post('/subjects', requireAuth, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Название предмета обязательно' });
  }
  const subject = await Subject.create({
    name,
    description: description || null
  });
  res.status(201).json(subject);
});

router.put('/subjects/:id', requireAuth, requireAdmin, async (req, res) => {
  const subject = await Subject.findByPk(req.params.id);
  if (!subject) {
    return res.status(404).json({ error: 'Предмет не найден' });
  }
  const { name, description } = req.body;
  if (name !== undefined) subject.name = name;
  if (description !== undefined) subject.description = description;
  await subject.save();
  res.json(subject);
});

router.delete('/subjects/:id', requireAuth, requireAdmin, async (req, res) => {
  const subject = await Subject.findByPk(req.params.id);
  if (!subject) {
    return res.status(404).json({ error: 'Предмет не найден' });
  }
  await subject.destroy();
  res.json({ message: 'Предмет удалён' });
});

router.post('/supervisions', requireAuth, requireAdmin, async (req, res) => {
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
});

router.patch('/supervisions/:id', requireAuth, requireAdmin, async (req, res) => {
  const row = await Supervision.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Не найдено' });
  const { isActive, endedAt } = req.body;
  if (isActive !== undefined) row.isActive = !!isActive;
  if (endedAt !== undefined) row.endedAt = endedAt;
  await row.save();
  res.json(row);
});

module.exports = router;