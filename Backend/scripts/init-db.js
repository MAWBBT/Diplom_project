/**
 * Полная переинициализация БД (npm run init-db).
 * Демо-данные согласованы с личными кабинетами аспиранта и руководителя (учебный год 2026–2027).
 */
const db = require('../models');

const ACADEMIC_YEAR = '2026-2027';
const PREV_YEAR = '2025-2026';
const GROUP = 'Аспирантура 2025';

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function mondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const mondayDate = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), mondayDate);
}

async function seedSubjects() {
  const names = [
    'Методология диссертационного исследования',
    'Академическое письмо и публикационная активность',
    'Философия и история науки',
    'Статистические методы в научной работе',
    'Цифровые инструменты исследователя',
    'Педагогическая практика высшей школы',
    'Научная этика и академическая добросовестность',
    'Подготовка к кандидатским экзаменам'
  ];
  const subjects = [];
  for (const name of names) {
    subjects.push(await db.Subject.create({ name, description: name }));
  }
  return subjects;
}

async function seedProgram(subjects) {
  const program = await db.Program.create({
    code: '05.13.18-ASP',
    name: 'Информатика и вычислительная техника (аспирантура)',
    description: 'Очная форма, кафедра информатики'
  });

  const curriculum = await db.CurriculumPlan.create({
    programId: program.id,
    academicYear: ACADEMIC_YEAR,
    title: `Учебный план ${ACADEMIC_YEAR}`
  });

  await db.CurriculumItem.bulkCreate(
    subjects.map((s, i) => ({
      planId: curriculum.id,
      subjectId: s.id,
      semester: Math.floor(i / 2) + 1,
      hours: 36 + (i % 3) * 12,
      controlForm: i % 2 === 0 ? 'экзамен' : 'зачёт'
    }))
  );

  return program;
}

async function seedUsers() {
  const supervisors = await Promise.all([
    db.User.create({
      login: 'supervisor1',
      password: 'password123',
      fullName: 'Решетников Игорь Петрович',
      role: 'supervisor',
      email: 'supervisor1@example.edu',
      phone: '+7 (999) 211-11-11'
    }),
    db.User.create({
      login: 'supervisor2',
      password: 'password123',
      fullName: 'Корнеева Елена Владимировна',
      role: 'supervisor',
      email: 'supervisor2@example.edu',
      phone: '+7 (999) 211-22-22'
    })
  ]);

  const students = await Promise.all([
    db.User.create({
      login: 'student1',
      password: 'password123',
      fullName: 'Андреев Сергей Викторович',
      role: 'student',
      groupName: GROUP,
      email: 'student1@example.edu',
      phone: '+7 (999) 311-01-01'
    }),
    db.User.create({
      login: 'student2',
      password: 'password123',
      fullName: 'Петрова Мария Сергеевна',
      role: 'student',
      groupName: GROUP,
      email: 'student2@example.edu',
      phone: '+7 (999) 311-02-02'
    }),
    db.User.create({
      login: 'student3',
      password: 'password123',
      fullName: 'Сидоров Алексей Дмитриевич',
      role: 'student',
      groupName: GROUP,
      email: 'student3@example.edu',
      phone: '+7 (999) 311-03-03'
    }),
    db.User.create({
      login: 'student4',
      password: 'password123',
      fullName: 'Козлова Екатерина Андреевна',
      role: 'student',
      groupName: GROUP,
      email: 'student4@example.edu',
      phone: '+7 (999) 311-04-04'
    }),
    db.User.create({
      login: 'student5',
      password: 'password123',
      fullName: 'Морозов Денис Викторович',
      role: 'student',
      groupName: GROUP,
      email: 'student5@example.edu',
      phone: '+7 (999) 311-05-05'
    }),
    db.User.create({
      login: 'student6',
      password: 'password123',
      fullName: 'Федорова Ольга Николаевна',
      role: 'student',
      groupName: GROUP,
      email: 'student6@example.edu',
      phone: '+7 (999) 311-06-06'
    })
  ]);

  const admin = await db.User.create({
    login: 'admin1',
    password: 'admin123',
    fullName: 'Администратор Системы',
    role: 'admin',
    email: 'admin@example.edu',
    phone: '+7 (999) 000-00-00'
  });

  return { supervisors, students, admin };
}

async function seedPostgraduateProfile(pg, programId, supervisor = null, enrollmentYear = 2025) {
  await db.PostgraduateProfile.create({
    userId: pg.id,
    enrollmentYear,
    department: 'Кафедра информатики',
    specialtyCode: '05.13.18',
    studyForm: 'очная',
    programId,
    supervisorId: supervisor?.id || null,
    supervisionStartedAt: supervisor ? '2025-09-01' : null
  });
}

async function seedCabinet(pg, supervisor, programId, today) {
  const topic = await db.DissertationTopic.create({
    userId: pg.id,
    title: pg._topicTitle,
    status: pg._topicStatus || 'approved'
  });

  const prevPlan = await db.IndividualPlan.create({
    userId: pg.id,
    academicYear: PREV_YEAR,
    status: 'archived',
    dissertationTopicId: topic.id
  });
  await db.PlanItem.bulkCreate([
    {
      planId: prevPlan.id,
      title: 'Итоги первого года аспирантуры',
      orderIdx: 1,
      status: 'done',
      dueDate: ymd(addDays(today, -400)),
      completedAt: ymd(addDays(today, -380))
    }
  ]);

  const plan = await db.IndividualPlan.create({
    userId: pg.id,
    academicYear: ACADEMIC_YEAR,
    status: pg._planStatus || 'approved',
    dissertationTopicId: topic.id,
    rejectReason: pg._rejectReason || null
  });

  const items = pg._planItems || [
    {
      title: 'Обзор литературы по теме диссертации',
      orderIdx: 1,
      status: 'done',
      dueDate: ymd(addDays(today, -60)),
      completedAt: ymd(addDays(today, -55)),
      description: 'Систематизация источников РИНЦ и Scopus'
    },
    {
      title: 'Публикация в журнале ВАК',
      orderIdx: 2,
      status: 'in_progress',
      dueDate: ymd(addDays(today, 45)),
      description: 'Статья по результатам исследования'
    },
    {
      title: 'Отчёт о научной деятельности',
      orderIdx: 3,
      status: pg._overdueItem ? 'overdue' : 'planned',
      dueDate: pg._overdueItem ? ymd(addDays(today, -30)) : ymd(addDays(today, 90))
    },
    {
      title: 'Кандидатский экзамен (специальность)',
      orderIdx: 4,
      status: 'planned',
      dueDate: ymd(addDays(today, 120))
    }
  ];

  await db.PlanItem.bulkCreate(items.map((it) => ({ ...it, planId: plan.id })));

  for (const pub of pg._publications || []) {
    await db.Publication.create({ userId: pg.id, ...pub });
  }

  for (const att of pg._attestations || []) {
    await db.Attestation.create({ userId: pg.id, ...att });
  }

  for (const doc of pg._documents || []) {
    await db.AcademicDocument.create({
      userId: pg.id,
      individualPlanId: doc.linkPlan ? plan.id : null,
      ...doc
    });
  }

  for (const n of pg._notifications || []) {
    await db.Notification.create({ userId: pg.id, ...n });
  }

  return { topic, plan };
}

async function seedSchedules(postgraduates, supervisors, subjects) {
  const today = new Date();
  const monday = mondayOfWeek(today);
  const weekDays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
  const pairTimes = ['09:00 – 10:35', '10:45 – 12:20', '12:40 – 14:15', '14:25 – 16:00'];
  const auditoriums = ['Ауд. 210', 'Лаб. 304', 'Науч. зал 112', 'Коллоквиум 405'];
  const teachers = [supervisors[0], supervisors[0], supervisors[1], supervisors[1], supervisors[0]];

  const rows = [];
  for (let day = 0; day < weekDays.length; day += 1) {
    const date = ymd(addDays(monday, day));
    const pairs = day < 4 ? 3 : 2;
    for (let pair = 0; pair < pairs; pair += 1) {
      const subject = subjects[(day * 2 + pair) % subjects.length];
      const prof = teachers[day];
      for (const pg of postgraduates) {
        rows.push({
          userId: pg.id,
          dayOfWeek: weekDays[day],
          time: pairTimes[pair],
          subjectId: subject.id,
          teacher: prof.fullName,
          auditorium: auditoriums[pair],
          date
        });
      }
    }
  }
  await db.Schedule.bulkCreate(rows);
  return rows.length;
}

async function seedGrades(postgraduates, subjects) {
  const samples = [
    { pg: 0, subj: 0, grade: '5', controlType: 'Экзамен', comment: 'Отличное владение методологией исследования.' },
    { pg: 0, subj: 1, grade: '4', controlType: 'Зачёт', comment: 'Требуется доработать оформление публикации.' },
    { pg: 1, subj: 0, grade: '5', controlType: 'Экзамен', comment: 'Чёткая постановка научной задачи.' },
    { pg: 1, subj: 2, grade: 'зачёт', controlType: 'Зачёт', comment: 'Уверенное знание философии науки.' },
    { pg: 2, subj: 3, grade: '5', controlType: 'Экзамен', comment: 'Корректное применение статистических методов.' },
    { pg: 3, subj: 1, grade: '4', controlType: 'Курсовая работа', comment: 'Хороший уровень, усилить обзор литературы.' },
    { pg: 4, subj: 7, grade: '4', controlType: 'Экзамен', comment: 'Подготовка к кандидатскому экзамену на хорошем уровне.' },
    { pg: 5, subj: 5, grade: 'зачёт', controlType: 'Практика', comment: 'Педагогическая практика успешно пройдена.' }
  ];
  await db.Grade.bulkCreate(
    samples.map((s) => ({
      userId: postgraduates[s.pg].id,
      subjectId: subjects[s.subj].id,
      controlType: s.controlType,
      grade: s.grade,
      comment: s.comment
    }))
  );
  return samples.length;
}

async function seedMessages(supervisors, students) {
  const senders = [supervisors[0], supervisors[0], supervisors[1], supervisors[0]];
  const pairs = [
    [0, 0, 'План консультаций', 'Согласуйте график встреч на месяц и пришлите обновлённую главу 1.'],
    [1, 1, 'Публикация', 'Черновик статьи принят к рассмотрению. Доработайте раздел «Методика».'],
    [2, 2, 'Кандидатский экзамен', 'Консультация по билетам — среда, 16:30, ауд. 210.'],
    [3, 3, 'Научный семинар', 'Выступление на семинаре в понедельник, 14:00.']
  ];
  await db.Message.bulkCreate(
    pairs.map(([si, gi, topic, text]) => ({
      senderId: senders[si].id,
      recipientId: students[gi].id,
      topic,
      text,
      isRead: false
    }))
  );
  return pairs.length;
}

async function initDatabase() {
  try {
    console.log('🔄 Пересоздание схемы БД (sync force)...');
    await db.sync(true);
    const { dropLegacyTablesQuiet } = require('./drop-legacy-tables-lib');
    await dropLegacyTablesQuiet(db.sequelize);

    const today = new Date();

    console.log('📚 Предметы и программа...');
    const subjects = await seedSubjects();
    const program = await seedProgram(subjects);

    console.log('👥 Пользователи...');
    const { supervisors, students, admin } = await seedUsers();

    const sup1 = supervisors[0];
    const sup2 = supervisors[1];
    const [pg1, pg2, pg3, pg4, pg5, pg6] = students;

    pg1._topicTitle =
      'Интеллектуальные методы анализа образовательных данных в аспирантуре';
    pg1._topicStatus = 'approved';
    pg1._planStatus = 'approved';
    pg1._publications = [
      {
        title: 'О применении машинного обучения в академическом процессе',
        venue: 'Вестник университета',
        year: 2025,
        indexing: 'ВАК',
        doi: '10.1234/demo.2025.1',
        status: 'verified'
      },
      {
        title: 'Аналитика успеваемости аспирантов',
        venue: 'Proc. IEEE EDUCON',
        year: 2026,
        indexing: 'Scopus',
        doi: '10.1109/demo.2026',
        status: 'submitted'
      }
    ];
    pg1._attestations = [
      {
        periodLabel: '1 год обучения',
        decision: 'Допущен ко 2 году',
        attestedAt: ymd(addDays(today, -200))
      },
      {
        periodLabel: 'Промежуточная аттестация',
        decision: 'Рекомендован к публикационной активности',
        attestedAt: ymd(addDays(today, -30))
      }
    ];
    pg1._documents = [
      { title: 'Индивидуальный план подготовки', documentType: 'individual_plan', status: 'approved', linkPlan: true },
      { title: 'Отчёт о публикационной активности', documentType: 'report', status: 'on_review', linkPlan: true }
    ];
    pg1._notifications = [
      {
        title: 'Дедлайн этапа ИПР',
        body: 'Приближается срок сдачи отчёта о научной деятельности.',
        link: '/postgraduate'
      },
      {
        title: 'Научный семинар',
        body: 'Кафедральный семинар — понедельник, 14:00.',
        link: '/study'
      }
    ];
    pg1._overdueItem = false;

    pg2._topicTitle = 'Цифровая трансформация вузовского образования';
    pg2._topicStatus = 'submitted';
    pg2._planStatus = 'submitted';
    pg2._publications = [
      {
        title: 'Модель цифровой среды аспиранта',
        venue: 'Информатика и образование',
        year: 2026,
        indexing: 'РИНЦ',
        status: 'submitted'
      }
    ];
    pg2._attestations = [
      { periodLabel: '1 год', decision: 'Допущен', attestedAt: ymd(addDays(today, -180)) }
    ];
    pg2._documents = [
      { title: 'Заявление на согласование ИПР', documentType: 'application', status: 'on_review' }
    ];
    pg2._notifications = [
      { title: 'ИПР на согласовании', body: 'План отправлен научному руководителю.', link: '/postgraduate' }
    ];

    pg3._topicTitle = 'Безопасность распределённых информационных систем';
    pg3._topicStatus = 'approved';
    pg3._planStatus = 'approved';
    pg3._planItems = [
      {
        title: 'Монография (черновик)',
        orderIdx: 1,
        status: 'done',
        dueDate: ymd(addDays(today, -90)),
        completedAt: ymd(addDays(today, -85))
      },
      {
        title: 'Статья Scopus Q2',
        orderIdx: 2,
        status: 'done',
        dueDate: ymd(addDays(today, -20)),
        completedAt: ymd(addDays(today, -15))
      }
    ];
    pg3._publications = [
      {
        title: 'Threat modeling в микросервисах',
        venue: 'Journal of Systems Security',
        year: 2025,
        indexing: 'Scopus',
        status: 'verified'
      }
    ];
    pg3._attestations = [
      { periodLabel: 'Кандидатский экзамен (философия)', decision: 'Сдан', attestedAt: ymd(addDays(today, -60)) }
    ];
    pg3._documents = [{ title: 'Отчёт НИР', documentType: 'report', status: 'approved' }];

    pg4._topicTitle = 'ИИ в поддержке научного руководства';
    pg4._topicStatus = 'approved';
    pg4._planStatus = 'rejected';
    pg4._rejectReason =
      'Уточните сроки этапов и добавьте публикацию в журнале из перечня ВАК.';
    pg4._overdueItem = true;
    pg4._notifications = [
      {
        title: 'ИПР возвращён',
        body: pg4._rejectReason,
        link: '/postgraduate'
      }
    ];

    pg5._topicTitle = 'Адаптивные системы дистанционного обучения';
    pg5._topicStatus = 'approved';
    pg5._planStatus = 'approved';

    pg6._topicTitle = 'Обработка естественного языка в научных текстах';
    pg6._topicStatus = 'draft';
    pg6._planStatus = 'draft';

    console.log('🎓 Профили, руководство и кабинеты...');
    for (const pg of students) {
      const supervisor = pg === pg6 ? sup2 : pg === pg5 ? sup1 : [pg1, pg2, pg3, pg4].includes(pg) ? sup1 : null;
      await seedPostgraduateProfile(pg, program.id, supervisor);
    }

    for (const pg of [pg1, pg2, pg3, pg4, pg5, pg6]) {
      const supervisor = pg === pg6 ? sup2 : sup1;
      await seedCabinet(pg, supervisor, program.id, today);
    }

    console.log('📅 Расписание...');
    const scheduleCount = await seedSchedules(students, supervisors, subjects);

    console.log('📊 Оценки...');
    const gradeCount = await seedGrades(students, subjects);

    console.log('💬 Сообщения...');
    const msgCount = await seedMessages(supervisors, students);

    await db.Message.bulkCreate([
      {
        senderId: sup1.id,
        recipientId: pg1.id,
        topic: 'Отзыв по главе 1',
        text: 'Материал изложен последовательно; рекомендую усилить обзор зарубежных работ.',
        messageType: 'supervisor_feedback',
        feedbackKind: 'review',
        isRead: false
      },
      {
        senderId: sup1.id,
        recipientId: pg2.id,
        topic: 'Рекомендация к публикации',
        text: 'Статью можно подавать в журнал после доработки раздела «Методика».',
        messageType: 'supervisor_feedback',
        feedbackKind: 'recommendation',
        isRead: false
      }
    ]);

    await db.Notification.create({
      userId: sup1.id,
      title: 'План на согласовании',
      body: 'Петрова М.С. отправила индивидуальный план на учебный год 2026–2027.',
      link: '/supervisor'
    });

    console.log('\n🎉 База данных инициализирована.\n');
    console.log('Учётные записи (пароль password123, admin — admin123):');
    console.log('  Аспиранты (student): student1 … student6');
    console.log('  Научные руководители (supervisor): supervisor1, supervisor2');
    console.log('  Администратор: admin1 / admin123');
    console.log('\nСтатистика:');
    console.log(`  Предметов: ${subjects.length}, аспирантов: ${students.length}`);
    console.log(`  Расписание: ${scheduleCount}, оценок: ${gradeCount}, сообщений: ${msgCount}`);
    console.log(`  Учебный год ИПР по умолчанию: ${ACADEMIC_YEAR}`);

    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    await db.sequelize.close();
    process.exit(1);
  }
}

initDatabase();
