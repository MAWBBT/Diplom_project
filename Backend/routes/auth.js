const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { signToken } = require('../config/jwt');
const { getRoleTitle } = require('../utils/roles');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, password, role } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    const user = await User.findOne({ where: { login } });

    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const isValidPassword = await user.checkPassword(password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ error: 'Неверная роль пользователя' });
    }

    const userData = user.toSafeJSON();
    userData.roleTitle = getRoleTitle(user.role);
    const token = signToken(user.id);

    res.json({
      token,
      user: userData
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

