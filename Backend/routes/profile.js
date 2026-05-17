const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { getRoleTitle, studentRoleWhere, ROLES } = require('../utils/roles');
const {
  User,
  Notification,
  Message,
  IndividualPlan,
  PlanItem,
  AcademicDocument
} = require('../models');
const { supervisedPostgraduateIds } = require('../utils/supervision');
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
      where: {
        recipientId: u.id,
        isRead: false,
        messageType: { [Op.ne]: 'supervisor_feedback' }
      }
    });

    if (u.role === ROLES.ADMIN) {
      const [usersTotal, students, supervisors] = await Promise.all([
        User.count(),
        User.count({ where: studentRoleWhere() }),
        User.count({ where: { role: { [Op.in]: [ROLES.SUPERVISOR, 'professor'] } } })
      ]);
      const [overduePlanItems, plansPending, docsReview] = await Promise.all([
        syncAndCountAllOverduePlanItems(PlanItem, IndividualPlan),
        IndividualPlan.count({ where: { status: 'submitted' } }),
        AcademicDocument.count({ where: { status: 'on_review' } })
      ]);
      return res.json({
        role: u.role,
        unreadNotifications,
        unreadMessages,
        metrics: {
          usersTotal,
          students,
          supervisors,
          professors: supervisors,
          postgraduates: students,
          overduePlanItems,
          plansPendingApproval: plansPending,
          documentsOnReview: docsReview
        }
      });
    }

    if (u.role === ROLES.SUPERVISOR) {
      const pgIds = await supervisedPostgraduateIds(u.id);
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

    if (fullName !== undefined) user.fullName = fullName;
    if (groupName !== undefined) user.groupName = groupName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;

    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Требуется текущий пароль для смены' });
      }

      const isValidPassword = await user.checkPassword(oldPassword);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Текущий пароль введён неверно' });
      }

      user.password = newPassword;
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
