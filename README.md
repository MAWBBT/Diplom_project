# Цифровой портал аспирантуры

## Семантика проекта (для людей и ИИ)

**Назначение.** Веб-приложение «цифровой кампус» для аспирантуры: несколько ролей пользователей, общие сервисы (профиль, расписание, оценки, сообщения, уведомления) и специализированные кабинеты (аспирант, научный руководитель, администратор системы, администратор образовательной программы). Проект демонстрационный / дипломный; перед публичным развёртыванием нужно сменить секреты и пароли.

**Архитектура.** Классическое разделение на клиент (SPA) и сервер (REST API). Клиент не ходит в БД напрямую — только в `/api/*`. Один процесс Node.js поднимает Express, подключается к PostgreSQL через Sequelize и при наличии сборки отдаёт статику фронтенда и `index.html` для client-side routing.

**Инварианты, которые важно не ломать при правках.**

- Роли в БД и в JWT-проверке — строки: `admin`, `postgraduate`, `professor`, `program_admin` (см. модель `User`). Фронтенд и бэкенд сравнивают роль именно так.
- Токен: JWT, полезная нагрузка содержит `sub` = числовой `id` пользователя. Заголовок: `Authorization: Bearer <token>`. Клиент хранит токен в `localStorage` под ключом `token`.
- Префикс API: `/api`. Список верхнеуровневых роутов отдаёт `GET /api`; живость сервера — `GET /api/health`.
- В dev фронтенд (Vite, порт 5173) проксирует `/api` на бэкенд (по умолчанию `localhost:3000`). В production один сервер может обслуживать и API, и SPA, если рядом с бэкендом лежит каталог со `index.html`.

---

## Стек технологий

| Слой        | Технологии |
|------------|------------|
| Backend    | Node.js, Express 4, Sequelize 6, драйвер `pg`, bcryptjs, jsonwebtoken, multer (загрузки), dotenv, cors |
| Frontend   | React 19, React Router 7, Vite 8, Axios, Tailwind CSS 4 |
| БД         | PostgreSQL 14+ |

---

## Структура репозитория

Корень проекта (в репозитории папки **`Backend`** и **`Frontend`** с заглавной буквы; на Windows путь к фронту также ищется как `frontend` из-за регистра).

```
.
├── Backend/
│   ├── server.js           # точка входа Express, CORS, статика, монтирование роутов, sync БД при старте
│   ├── config/             # database.js, jwt.js
│   ├── models/             # Sequelize-модели и связи (index.js)
│   ├── routes/             # обработчики по доменам (auth, profile, …)
│   ├── middleware/         # requireAuth, requireRole, optionalAuth
│   ├── utils/              # роли (подписи), уведомления, аудит, кураторство
│   ├── scripts/init-db.js  # полный сброс таблиц и демо-данные (опасно для прода)
│   └── tests/              # Jest (например jwt.test.js)
└── Frontend/
    ├── vite.config.js      # dev-proxy /api → :3000, outDir: build
    ├── src/
    │   ├── App.jsx         # меню по ролям, маршруты, Guard / RoleGuard
    │   ├── api/client.js   # axios с baseURL /api и Bearer
    │   └── pages/          # экраны по разделам
    └── build/              # артефакт npm run build (если собран)
```

---

## Модель данных (ORM)

Все сущности объявлены в `Backend/models/` и связаны в `Backend/models/index.js`. Краткий смысл сущностей:

- **User** — логин, хэш пароля, ФИО, **role**, группа, контакты.
- **Schedule**, **Grade**, **Subject** — расписание и успеваемость, привязка к пользователю/предмету.
- **Message** — переписка (отправитель/получатель).
- **Program**, **PostgraduateProfile** — программа аспирантуры и профиль аспиранта в ней.
- **Supervision** — связь аспирант ↔ научный руководитель.
- **DissertationTopic**, **DissertationTopicHistory** — тема диссертации и история изменений.
- **IndividualPlan**, **PlanItem** — индивидуальный учебный план и пункты.
- **Milestone** — вехи/сроки.
- **Publication**, **Attestation** — публикации и аттестации.
- **Document** (академический документ), **DocumentFile** — документы и файлы (в т.ч. кто загрузил).
- **Notification** — уведомления пользователю.
- **AuditLog** — журнал действий (аудит).

При старте сервера вызывается `sequelize.sync(false)` — таблицы создаются/подстраиваются без принудительного дропа. Для жёсткого пересоздания используется `init-db` или переменная окружения `DATABASE_SYNC_ALTER=1` для режима `alter` при обычном старте (см. `models/index.js`).

---

## Авторизация и авторизация (RBAC)

1. **Вход:** `POST /api/auth/login` с телом `{ login, password }`. Опционально клиент может передать `role` — тогда при несовпадении с ролью в БД вернётся 403.
2. **Ответ:** `{ token, user }`, пароль в `user` не отдаётся (`toSafeJSON`).
3. **Защищённые маршруты:** middleware `requireAuth` загружает пользователя по `sub` из JWT и кладёт в `req.user`. `requireRole('admin', …)` режет по `req.user.role`.
4. **Пароли:** bcrypt при `beforeCreate` / при смене пароля в `beforeUpdate`.

На фронтенде после логина вызывается `GET /api/profile/me` для восстановления сессии при обновлении страницы. Редирект со старых URL вида `?page=home` обрабатывается в `App.jsx` (`legacyPageToRoute`).

---

## HTTP API

Базовый префикс: **`/api`**.

| Монтирование в `server.js` | Назначение (домен)        |
|---------------------------|---------------------------|
| `/api/auth`               | вход                      |
| `/api/profile`            | профиль / «я»             |
| `/api/schedule`           | расписание                |
| `/api/grades`             | оценки                    |
| `/api/messages`           | сообщения                 |
| `/api/notifications`      | уведомления               |
| `/api/journal`            | журнал (доступ по правилам роутера) |
| `/api/admin`              | администрирование         |
| `/api/postgraduate`       | кабинет аспиранта         |
| `/api/supervisor`         | кабинет руководителя      |
| `/api/program-admin`      | администратор программы   |

Служебные эндпоинты: `GET /api`, `GET /api/health`. Ошибки API в JSON часто в поле `error`. Не-API пути при наличии фронтенда отдают SPA (`index.html`).

---

## Фронтенд: маршруты и видимость по ролям

React Router. Основные пути:

- `/`, `/index.html` — главная  
- `/login` — вход  
- `/profile`, `/schedule`, `/grades`, `/messages`, `/notifications` — общие (нужна авторизация)  
- `/journal` — только `professor`, `admin`  
- `/admin` — только `admin`  
- `/postgraduate` — только `postgraduate`  
- `/supervisor` — только `professor`  
- `/program-admin` — только `program_admin`  

Меню в шапке строится по `user.role` в `App.jsx`. Защита: компоненты `Guard` (нужен пользователь) и `RoleGuard` (whitelist ролей). Запросы идут через Axios: `baseURL: '/api'`, токен подставляется интерцептором.

---

## Переменные окружения (Backend, `.env`)

| Переменная | Назначение |
|------------|------------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL |
| `PORT` | порт HTTP (по умолчанию 3000) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | подпись и срок JWT |
| `CORS_ORIGIN` | разрешённые Origin через запятую; иначе localhost:5173 и свой `PORT` |
| `FRONTEND_PATH` | путь к каталогу со `index.html` относительно `Backend` (если нестандартно) |
| `DATABASE_SYNC_ALTER=1` | при обычном `sync` использовать `alter: true` (миграции вручную не описаны) |
| `NODE_ENV` | влияет на логирование SQL в `config/database.js` |

Значения по умолчанию для БД см. `Backend/config/database.js` (например имя БД `edu_database`).

---

## Установка и запуск

**Требования:** Node.js 18+, PostgreSQL 14+.

```bash
cd Backend && npm install
cd ../Frontend && npm install
```

Создайте БД (например `edu_database`), задайте `.env` в `Backend` при необходимости.

### Инициализация демо-данных

Скрипт **`npm run init-db`** в каталоге `Backend` вызывает `sync(true)` — **удаляет и пересоздаёт таблицы** и заполняет демо. Не использовать на продакшене с реальными данными.

```bash
cd Backend
npm run init-db
```

В консоли выводятся подсказки по тестовым логинам.

### Режим разработки

Терминал 1 — API:

```bash
cd Backend
npm start
# или: npm run dev   (nodemon)
```

Проверка: `GET http://localhost:3000/api/health`.

Терминал 2 — фронтенд (прокси `/api` → `localhost:3000`):

```bash
cd Frontend
npm run dev
```

Открыть `http://localhost:5173`. Вход по логину и паролю; роль берётся из записи в БД.

### Сборка и продакшен

```bash
cd Frontend
npm run build
```

Артефакт: `Frontend/build/`. Express при старте ищет каталог со `index.html` в `../Frontend`, `../frontend`, `../Frontend/build`, `../frontend/build` или по `FRONTEND_PATH`.

В `Frontend` есть `npm run deploy` — сборка и копирование `build/` (скрипт `scripts/deploy.mjs`) для удобной выкладки статики.

---

## Тестовые учётные записи (после `init-db`)

| Роль | Логин | Пароль |
|------|--------|--------|
| Аспирант | `postgraduate1` | `password123` |
| Профессор | `professor1` | `password123` |
| Администратор | `admin1` | `admin123` |
| Админ программы | `programadmin1` | `password123` |

Дополнительные пользователи (`postgraduate2` …, `professor2` …) создаёт тот же скрипт.

---

## Полезные команды

| Команда | Где | Действие |
|---------|-----|----------|
| `npm start` | Backend | запуск сервера |
| `npm run dev` | Backend | сервер с nodemon |
| `npm run init-db` | Backend | сброс и сид БД |
| `npm test` | Backend | Jest |
| `npm run dev` | Frontend | Vite, порт 5173 |
| `npm run build` | Frontend | production-сборка в `build/` |
| `npm run preview` | Frontend | предпросмотр сборки |

---

## Возможности по ролям (функциональная сводка)

- **Аспирант:** профиль, расписание, оценки, сообщения, уведомления; кабинет аспиранта (ИУП, вехи, документы, публикации, аттестации, выгрузка архива и т.д. — см. `/api/postgraduate` и `PostgraduatePage`).
- **Профессор (руководитель):** журнал, кабинет руководителя (ведомые, согласование планов), сообщения.
- **Администратор:** пользователи, расширенный доступ к журналу и оценкам согласно API.
- **Администратор программы:** сводки, списки аспирантов, просроченные вехи, конструктор справок.

---

## Замечания по безопасности и эксплуатации

Перед выкладкой в сеть: задать надёжный `JWT_SECRET`, пароль БД, ограничить `CORS_ORIGIN` доменом фронта, не оставлять демо-пароли. Проект рассчитан на учебную демонстрацию.

---

## Краткий указатель для ИИ при доработках

- Новый защищённый эндпоинт: роут в `Backend/routes/`, подключить в `server.js`, использовать `requireAuth` / `requireRole` из `middleware/auth.js`.
- Новая сущность: модель в `Backend/models/`, связи в `models/index.js`, экспорт в объекте `db`.
- Новый экран: страница в `Frontend/src/pages/`, маршрут и пункт меню в `App.jsx` согласованно с `user.role`.
- Клиентские вызовы: только через `src/api/client.js` (относительный `/api`).
- Сид-данные: расширять `Backend/scripts/init-db.js`, помня про `sync(true)`.
