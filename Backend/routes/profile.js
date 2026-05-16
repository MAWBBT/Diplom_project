const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { getRoleTitle } = require('../utils/roles');
const {
  User,
  Notification,
  Message,
  IndividualPlan,
  PlanItem,
  Supervision,
  AcademicDocument
} = require('../models');
const { syncAndCountAllOverduePlanItems } = require('../utils/planItemOverdue');

// GET /api/profile/me - Получить текущего пользователя
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const userData = user.toSafeJSON();
    userData.roleTitle = getRoleTitle(user.role);
    
    res.json(userData);
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/profile/home-summary — краткая сводка для главной (все роли)
router.get('/home-summary', requireAuth, async (req, res) => {
  try {
    const u = req.user;
    const unreadNotifications = await Notification.count({
      where: { userId: u.id, readAt: null }
    });
    const unreadMessages = await Message.count({
      where: { recipientId: u.id, isRead: false }
    });

    if (u.role === 'admin') {
      const [usersTotal, postgraduates, professors] = await Promise.all([
        User.count(),
        User.count({ where: { role: 'postgraduate' } }),
        User.count({ where: { role: 'professor' } })
      ]);
      return res.json({
        role: u.role,
        unreadNotifications,
        unreadMessages,
        metrics: { usersTotal, postgraduates, professors }
      });
    }

    if (u.role === 'program_admin') {
      const [postgraduates, overduePlanItems, plansPending, docsReview] = await Promise.all([
        User.count({ where: { role: 'postgraduate' } }),
        syncAndCountAllOverduePlanItems(PlanItem, IndividualPlan),
        IndividualPlan.count({ where: { status: 'submitted' } }),
        AcademicDocument.count({ where: { status: 'on_review' } })
      ]);
      return res.json({
        role: u.role,
        unreadNotifications,
        unreadMessages,
        metrics: {
          postgraduates,
          overduePlanItems,
          plansPendingApproval: plansPending,
          documentsOnReview: docsReview
        }
      });
    }

    if (u.role === 'professor') {
      const sup = await Supervision.findAll({
        where: { supervisorId: u.id, isActive: true },
        attributes: ['postgraduateId'],
        raw: true
      });
      const pgIds = [...new Set(sup.map((r) => r.postgraduateId))];
      const plansPending =
        pgIds.length > 0
          ? await IndividualPlan.count({
              where: { userId: { [Op.in]: pgIds }, status: 'submitted' }
            })
          : 0;
      return res.json({
        role: u.role,
        unreadNotifications,
        unreadMessages,
        metrics: {
          supervisedPostgraduates: pgIds.length,
          plansPendingApproval: plansPending
        }
      });
    }

    return res.json({
      role: u.role,
      unreadNotifications,
      unreadMessages,
      metrics: {}
    });
  } catch (error) {
    console.error('Ошибка home-summary:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/profile/me - Обновить профиль
router.put('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { fullName, groupName, email, phone, oldPassword, newPassword } = req.body;

    // Обновляем основные данные
    if (fullName !== undefined) user.fullName = fullName;
    if (groupName !== undefined) user.groupName = groupName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;

    // Обновляем пароль, если указан
    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Требуется текущий пароль для смены' });
      }

      const isValidPassword = await user.checkPassword(oldPassword);
      if (!isValidPassword) {
        // 400, не 401: иначе клиент воспринимает как «сессия недействительна» и разлогинивает
        return res.status(400).json({ error: 'Текущий пароль введён неверно' });
      }

      user.password = newPassword; // Хук в модели автоматически захеширует
    }

    await user.save();

    const userData = user.toSafeJSON();
    userData.roleTitle = getRoleTitle(user.role);

    res.json(userData);
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

