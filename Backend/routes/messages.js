const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { Op, QueryTypes } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { Message, User, MessageFile, sequelize } = require('../models');
const { normalizeUploadFilename, sendFileDownload } = require('../utils/uploadFilename');

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
    const ext = path.extname(normalizeUploadFilename(file.originalname || '')).slice(0, 12);
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

async function buildConversationRow(userId, peer) {
  const lastMessage = await Message.findOne({
    where: {
      [Op.or]: [
        { senderId: userId, recipientId: peer.id },
        { senderId: peer.id, recipientId: userId }
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
      senderId: peer.id,
      recipientId: userId,
      isRead: false
    }
  });

  return {
    userId: peer.id,
    fullName: peer.fullName,
    login: peer.login,
    groupName: peer.groupName,
    role: peer.role,
    unreadCount,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          text: lastMessage.text,
          topic: lastMessage.topic,
          createdAt: lastMessage.createdAt,
          isRead: lastMessage.isRead,
          senderId: lastMessage.senderId
        }
      : null
  };
}

// GET /api/messages/conversations — только реальные диалоги; при q — поиск пользователей для нового диалога
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = req.query.q ? String(req.query.q).trim() : '';

    let peers;
    if (!q) {
      const partnerRows = await sequelize.query(
        `SELECT DISTINCT (CASE WHEN "senderId" = :uid THEN "recipientId" ELSE "senderId" END) AS "partnerId"
         FROM messages WHERE "senderId" = :uid OR "recipientId" = :uid`,
        { replacements: { uid: userId }, type: QueryTypes.SELECT }
      );
      const ids = partnerRows.map((r) => r.partnerId).filter(Boolean);
      if (!ids.length) {
        return res.json([]);
      }
      peers = await User.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ['id', 'fullName', 'login', 'groupName', 'role'],
        order: [['fullName', 'ASC']]
      });
    } else {
      const qq = `%${q}%`;
      peers = await User.findAll({
        where: {
          id: { [Op.ne]: userId },
          [Op.or]: [
            { fullName: { [Op.iLike]: qq } },
            { login: { [Op.iLike]: qq } },
            { groupName: { [Op.iLike]: qq } }
          ]
        },
        attributes: ['id', 'fullName', 'login', 'groupName', 'role'],
        order: [['fullName', 'ASC']],
        limit: 80
      });
    }

    const conversations = await Promise.all(peers.map((peer) => buildConversationRow(userId, peer)));
    conversations.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.unreadCount || 0) - (a.unreadCount || 0);
    });
    res.json(conversations);
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
    const threadOr = [
      { senderId: userId, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: userId }
    ];
    const where = q
      ? {
          [Op.and]: [
            { [Op.or]: threadOr },
            {
              [Op.or]: [
                { topic: { [Op.iLike]: `%${q}%` } },
                { text: { [Op.iLike]: `%${q}%` } }
              ]
            }
          ]
        }
      : { [Op.or]: threadOr };

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

    const formattedMessages = messages.map((msg) => ({
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
        originalName: normalizeUploadFilename(f.originalname || f.filename),
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
    sendFileDownload(res, fp, file.originalName);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

