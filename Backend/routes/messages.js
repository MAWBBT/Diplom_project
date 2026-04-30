const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { Message, User, MessageFile } = require('../models');

function canExchangeMessages(_aRole, _bRole) {
  // Требование модуля 6: переписка между любыми пользователями системы.
  return true;
}

function canAccessMessage(user, msg) {
  if (!user || !msg) return false;
  if (user.role === 'admin') return true;
  return msg.senderId === user.id || msg.recipientId === user.id;
}

const uploadRoot = path.join(__dirname, '../uploads/messages');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый формат файла'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
  fileFilter
});

// GET /api/messages/conversations - Получить список диалогов
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';

    // Любые пользователи, кроме себя; можно фильтровать по ФИО/логину/группе
    const userWhere = { id: { [Op.ne]: userId } };
    if (q) {
      userWhere[Op.or] = [
        { fullName: { [Op.iLike]: `%${q}%` } },
        { login: { [Op.iLike]: `%${q}%` } },
        { groupName: { [Op.iLike]: `%${q}%` } }
      ];
    }

    const allUsers = await User.findAll({
      where: userWhere,
      attributes: ['id', 'fullName', 'login', 'groupName', 'role'],
      order: [['fullName', 'ASC']],
      limit: 200
    });
    
    // Получаем последние сообщения для каждого пользователя
    const conversations = await Promise.all(allUsers.map(async (user) => {
      const lastMessage = await Message.findOne({
        where: {
          [Op.or]: [
            { senderId: userId, recipientId: user.id },
            { senderId: user.id, recipientId: userId }
          ]
        },
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, as: 'sender', attributes: ['id', 'fullName'] },
          { model: User, as: 'recipient', attributes: ['id', 'fullName'] }
        ]
      });

      const unreadCount = await Message.count({
        where: {
          senderId: user.id,
          recipientId: userId,
          isRead: false
        }
      });
      
      return {
        userId: user.id,
        fullName: user.fullName,
        login: user.login,
        groupName: user.groupName,
        role: user.role,
        unreadCount,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          text: lastMessage.text,
          topic: lastMessage.topic,
          createdAt: lastMessage.createdAt,
          isRead: lastMessage.isRead,
          senderId: lastMessage.senderId
        } : null
      };
    }));
    
    res.json(conversations.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0)));
  } catch (error) {
    console.error('Ошибка получения диалогов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/messages/:userId - Получить все сообщения с конкретным пользователем
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    
    if (isNaN(otherUserId)) {
      return res.status(400).json({ error: 'Неверный ID пользователя' });
    }
    
    const q = req.query.q ? String(req.query.q).trim() : '';
    const where = {
      [Op.or]: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId }
      ]
    };
    if (q) {
      const qq = `%${q}%`;
      where[Op.or] = [
        ...where[Op.or],
      ];
      where[Op.and] = [{
        [Op.or]: [
          { topic: { [Op.iLike]: qq } },
          { text: { [Op.iLike]: qq } }
        ]
      }];
    }

    // Получаем все сообщения между текущим пользователем и выбранным
    const messages = await Message.findAll({
      where,
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
        },
        {
          model: MessageFile,
          as: 'files',
          attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt']
        }
      ],
      order: [['createdAt', 'ASC']]
    });
    
    // Отмечаем сообщения как прочитанные
    await Message.update(
      { isRead: true },
      {
        where: {
          recipientId: userId,
          senderId: otherUserId,
          isRead: false
        }
      }
    );
    
    // Форматируем ответ
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      topic: msg.topic,
      text: msg.text,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      sender: msg.sender ? msg.sender.fullName : 'Неизвестно',
      recipient: msg.recipient ? msg.recipient.fullName : 'Неизвестно',
      createdAt: msg.createdAt,
      isRead: msg.isRead,
      files: (msg.files || []).map((f) => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size
      }))
    }));
    
    res.json(formattedMessages);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/messages - Получить сообщения текущего пользователя (для обратной совместимости)
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Получаем входящие сообщения
    const messages = await Message.findAll({
      where: { recipientId: userId },
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

    // Форматируем ответ
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      topic: msg.topic,
      text: msg.text,
      recipient: msg.recipient ? msg.recipient.fullName : 'Неизвестно',
      sender: msg.sender ? msg.sender.fullName : 'Неизвестно',
      createdAt: msg.createdAt,
      isRead: msg.isRead
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/messages - Отправить сообщение
router.post('/', requireAuth, upload.array('files', 5), async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipientId, topic, text } = req.body;

    if (!recipientId || !topic || !text) {
      return res.status(400).json({ error: 'Получатель, тема и текст обязательны' });
    }

    // Проверяем, что получатель существует
    const recipientUser = await User.findByPk(recipientId);
    if (!recipientUser) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }

    // Допустимые пары ролей для переписки (аспирантура)
    const sender = await User.findByPk(senderId);
    if (!sender) {
      return res.status(404).json({ error: 'Отправитель не найден' });
    }

    if (!canExchangeMessages(sender.role, recipientUser.role)) {
      return res.status(400).json({ error: 'Недопустимая пара ролей для переписки' });
    }

    const message = await Message.create({
      senderId,
      recipientId: recipientUser.id,
      topic,
      text
    });

    const files = Array.isArray(req.files) ? req.files : [];
    for (const f of files) {
      await MessageFile.create({
        messageId: message.id,
        storedName: f.filename,
        originalName: f.originalname || f.filename,
        mimeType: f.mimetype,
        size: f.size
      });
    }

    // Получаем созданное сообщение с информацией о пользователях
    const createdMessage = await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'fullName', 'login'] },
        { model: User, as: 'recipient', attributes: ['id', 'fullName', 'login'] },
        { model: MessageFile, as: 'files', attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
      ]
    });

    res.status(201).json({
      id: createdMessage.id,
      topic: createdMessage.topic,
      text: createdMessage.text,
      senderId: createdMessage.senderId,
      recipientId: createdMessage.recipientId,
      sender: createdMessage.sender ? createdMessage.sender.fullName : 'Неизвестно',
      recipient: createdMessage.recipient ? createdMessage.recipient.fullName : 'Неизвестно',
      createdAt: createdMessage.createdAt,
      isRead: createdMessage.isRead,
      files: (createdMessage.files || []).map((f) => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size
      }))
    });
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/messages/files/:fileId/download - скачать вложение (доступ: участники диалога или admin)
router.get('/files/:fileId/download', requireAuth, async (req, res) => {
  try {
    const file = await MessageFile.findByPk(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'Файл не найден' });

    const msg = await Message.findByPk(file.messageId);
    if (!msg) return res.status(404).json({ error: 'Сообщение не найдено' });

    if (!canAccessMessage(req.user, msg)) {
      return res.status(403).json({ error: 'Нет доступа к файлу' });
    }

    const fp = path.join(uploadRoot, file.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
    res.download(fp, file.originalName);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

