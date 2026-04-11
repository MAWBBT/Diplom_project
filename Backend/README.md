# Backend - Система личных кабинетов

Backend сервер на Express.js с Sequelize ORM и PostgreSQL.

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Настройте базу данных:
   - Откройте файл `config/database.js`
   - Измените параметры подключения к вашей PostgreSQL базе данных:
   ```javascript
   username: 'your_username',        // Ваш пользователь PostgreSQL
   password: 'your_password',        // Ваш пароль PostgreSQL
   database: 'edu_database',        // Название базы данных
   host: 'localhost',               // Хост БД
   port: 5432,                      // Порт БД
   ```

3. Создайте базу данных в PostgreSQL:
```sql
CREATE DATABASE edu_database;
```

## Запуск

### Режим разработки (с автоперезагрузкой):
```bash
npm run dev
```

### Продакшн режим:
```bash
npm start
```

Сервер запустится на порту 3000.

## API Endpoints

### Авторизация
- `POST /api/auth/login` - Вход в систему

### Профиль
- `GET /api/profile/me` - Получить текущего пользователя
- `PUT /api/profile/me` - Обновить профиль

### Расписание
- `GET /api/schedule` - Получить расписание
- `POST /api/schedule` - Создать запись в расписании (требуются права)

### Оценки
- `GET /api/grades` - Получить оценки
- `POST /api/grades` - Создать оценку (требуются права)

### Сообщения
- `GET /api/messages` - Получить сообщения
- `POST /api/messages` - Отправить сообщение

## Структура проекта

```
Backend/
├── config/
│   └── database.js      # Конфигурация БД (измените параметры подключения здесь)
├── models/
│   ├── index.js         # Инициализация Sequelize
│   ├── User.js          # Модель пользователя
│   ├── Schedule.js      # Модель расписания
│   ├── Grade.js         # Модель оценок
│   └── Message.js       # Модель сообщений
├── routes/
│   ├── auth.js          # Роуты авторизации
│   ├── profile.js        # Роуты профиля
│   ├── schedule.js       # Роуты расписания
│   ├── grades.js         # Роуты оценок
│   └── messages.js       # Роуты сообщений
├── middleware/
│   └── auth.js          # Middleware авторизации
├── server.js            # Главный файл сервера
└── package.json         # Зависимости
```

## Первоначальная настройка БД

После первого запуска таблицы будут созданы автоматически. 

### Автоматическая инициализация тестовыми данными

Для быстрого старта можно использовать скрипт инициализации:

```bash
npm run init-db
```

Этот скрипт создаст:
- Тестовых пользователей (аспиранты, профессора, администратор)
- Примеры расписания
- Примеры оценок
- Примеры сообщений

**Тестовые учетные записи:**
- Аспирант: `login=postgraduate1`, `password=password123`
- Профессор: `login=professor1`, `password=password123`
- Администратор: `login=admin1`, `password=admin123`

**Внимание:** Скрипт пересоздаёт все таблицы (удаляет существующие данные)!

### Ручное создание пользователей

Если вы хотите создать пользователей вручную через SQL, пароль должен быть захеширован с помощью bcrypt:

```sql
INSERT INTO users (login, password, "fullName", role, "groupName", email, "createdAt", "updatedAt")
VALUES ('postgraduate1', '$2a$10$...', 'Андреев Сергей Викторович', 'postgraduate', 'Аспирантура 2024-1', 'postgraduate1@example.edu', NOW(), NOW());
```

