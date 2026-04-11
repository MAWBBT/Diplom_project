const db = require('../models');
const bcrypt = require('bcryptjs');
async function initDatabase() {
  try {
    console.log('🔄 Синхронизация базы данных...');
    await db.sync(true);
    console.log('📚 Создание предметов...');
    const subjects = await Promise.all([
      db.Subject.create({
        name: 'Методология диссертационного исследования',
        description: 'Методы, дизайн и организация научного исследования в аспирантуре'
      }),
      db.Subject.create({
        name: 'Академическое письмо и публикационная активность',
        description: 'Подготовка научных статей, работа с рецензиями и публикационными требованиями'
      }),
      db.Subject.create({
        name: 'Философия и история науки',
        description: 'Философские основания науки и эволюция научного знания'
      }),
      db.Subject.create({
        name: 'Статистические методы в научной работе',
        description: 'Анализ данных, проверка гипотез, интерпретация научных результатов'
      }),
      db.Subject.create({
        name: 'Цифровые инструменты исследователя',
        description: 'Программные и информационные средства для научной деятельности'
      }),
      db.Subject.create({
        name: 'Педагогическая практика высшей школы',
        description: 'Подготовка и проведение учебных занятий в вузе'
      }),
      db.Subject.create({
        name: 'Научная этика и академическая добросовестность',
        description: 'Этические нормы публикаций, цитирования и исследовательской работы'
      }),
      db.Subject.create({
        name: 'Подготовка к кандидатским экзаменам',
        description: 'Системная подготовка к кандидатским экзаменам по специальности и философии'
      })
    ]);
    console.log('✅ Предметы созданы:', subjects.length);
    console.log('📋 Программы аспирантуры...');
    const programInf = await db.Program.create({
      code: 'INF-ASP',
      name: 'Информатика и вычислительная техника (аспирантура)',
      description: 'Очная форма, кафедра информатики'
    });
    const programPed = await db.Program.create({
      code: 'PED-ASP',
      name: 'Педагогические науки (аспирантура)',
      description: 'Дополнительная программа (демо)'
    });
    console.log('✅ Программы:', 2);
    console.log('📝 Создание тестовых пользователей...');
    const professors = await Promise.all([
      db.User.create({
        login: 'professor1',
        password: 'password123',
        fullName: 'Решетников Игорь Петрович',
        role: 'professor',
        email: 'professor1@example.edu',
        phone: '+7 (999) 211-11-11'
      }),
      db.User.create({
        login: 'professor2',
        password: 'password123',
        fullName: 'Корнеева Елена Владимировна',
        role: 'professor',
        email: 'korneeva@example.edu',
        phone: '+7 (999) 211-22-22'
      }),
      db.User.create({
        login: 'professor3',
        password: 'password123',
        fullName: 'Петров Сергей Анатольевич',
        role: 'professor',
        email: 'petrov@example.edu',
        phone: '+7 (999) 211-33-33'
      }),
      db.User.create({
        login: 'professor4',
        password: 'password123',
        fullName: 'Смирнова Анна Игоревна',
        role: 'professor',
        email: 'smirnova@example.edu',
        phone: '+7 (999) 211-44-44'
      }),
      db.User.create({
        login: 'professor5',
        password: 'password123',
        fullName: 'Волков Дмитрий Олегович',
        role: 'professor',
        email: 'volkov@example.edu',
        phone: '+7 (999) 211-55-55'
      }),
      db.User.create({
        login: 'professor6',
        password: 'password123',
        fullName: 'Новикова Мария Петровна',
        role: 'professor',
        email: 'novikova@example.edu',
        phone: '+7 (999) 211-66-66'
      })
    ]);

    const postgraduates = await Promise.all([
      db.User.create({
        login: 'postgraduate1',
        password: 'password123',
        fullName: 'Андреев Сергей Викторович',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-1',
        email: 'postgraduate1@example.edu',
        phone: '+7 (999) 311-01-01'
      }),
      db.User.create({
        login: 'postgraduate2',
        password: 'password123',
        fullName: 'Петрова Мария Сергеевна',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-1',
        email: 'petrova@example.edu',
        phone: '+7 (999) 123-45-68'
      }),
      db.User.create({
        login: 'postgraduate3',
        password: 'password123',
        fullName: 'Сидоров Алексей Дмитриевич',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-1',
        email: 'sidorov@example.edu',
        phone: '+7 (999) 123-45-69'
      }),
      db.User.create({
        login: 'postgraduate4',
        password: 'password123',
        fullName: 'Козлова Екатерина Андреевна',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-1',
        email: 'kozlova@example.edu',
        phone: '+7 (999) 123-45-70'
      }),
      db.User.create({
        login: 'postgraduate5',
        password: 'password123',
        fullName: 'Морозов Денис Викторович',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-1',
        email: 'morozov@example.edu',
        phone: '+7 (999) 123-45-71'
      }),
      db.User.create({
        login: 'postgraduate6',
        password: 'password123',
        fullName: 'Федорова Ольга Николаевна',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-2',
        email: 'fedorova@example.edu',
        phone: '+7 (999) 123-45-72'
      }),
      db.User.create({
        login: 'postgraduate7',
        password: 'password123',
        fullName: 'Николаев Артем Сергеевич',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-2',
        email: 'nikolaev@example.edu',
        phone: '+7 (999) 123-45-73'
      }),
      db.User.create({
        login: 'postgraduate8',
        password: 'password123',
        fullName: 'Соколова Виктория Александровна',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-2',
        email: 'sokolova@example.edu',
        phone: '+7 (999) 123-45-74'
      }),
      db.User.create({
        login: 'postgraduate9',
        password: 'password123',
        fullName: 'Лебедев Максим Игоревич',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-2',
        email: 'lebedev@example.edu',
        phone: '+7 (999) 123-45-75'
      }),
      db.User.create({
        login: 'postgraduate10',
        password: 'password123',
        fullName: 'Кузнецова Анастасия Владимировна',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-2',
        email: 'kuznetsova@example.edu',
        phone: '+7 (999) 123-45-76'
      }),
      db.User.create({
        login: 'postgraduate11',
        password: 'password123',
        fullName: 'Попов Роман Олегович',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-3',
        email: 'popov@example.edu',
        phone: '+7 (999) 123-45-77'
      }),
      db.User.create({
        login: 'postgraduate12',
        password: 'password123',
        fullName: 'Васильева Татьяна Петровна',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-3',
        email: 'vasilyeva@example.edu',
        phone: '+7 (999) 123-45-78'
      }),
      db.User.create({
        login: 'postgraduate13',
        password: 'password123',
        fullName: 'Семенов Игорь Борисович',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-3',
        email: 'semenov@example.edu',
        phone: '+7 (999) 123-45-79'
      }),
      db.User.create({
        login: 'postgraduate14',
        password: 'password123',
        fullName: 'Голубева Юлия Михайловна',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-3',
        email: 'golubeva@example.edu',
        phone: '+7 (999) 123-45-80'
      }),
      db.User.create({
        login: 'postgraduate15',
        password: 'password123',
        fullName: 'Виноградов Павел Алексеевич',
        role: 'postgraduate',
        groupName: 'Аспирантура 2024-3',
        email: 'vinogradov@example.edu',
        phone: '+7 (999) 123-45-81'
      })
    ]);

    // Создаём администратора
    const admin = await db.User.create({
      login: 'admin1',
      password: 'admin123',
      fullName: 'Администратор Системы',
      role: 'admin',
      email: 'admin@example.edu',
      phone: '+7 (999) 000-00-00'
    });

    const professorPg = professors[0];
    const postgraduatePg = postgraduates[0];

    const programAdmin1 = await db.User.create({
      login: 'programadmin1',
      password: 'password123',
      fullName: 'Смирнова Елена Олеговна',
      role: 'program_admin',
      email: 'programadmin@example.edu',
      phone: '+7 (999) 444-44-44'
    });

    await db.PostgraduateProfile.create({
      userId: postgraduatePg.id,
      enrollmentYear: 2024,
      department: 'Кафедра информатики',
      specialtyCode: '05.13.18',
      studyForm: 'очная',
      programId: programInf.id
    });

    await db.Supervision.create({
      postgraduateId: postgraduatePg.id,
      supervisorId: professorPg.id,
      startedAt: new Date().toISOString().slice(0, 10),
      isActive: true,
      supervisionKind: 'primary'
    });

    await db.Supervision.create({
      postgraduateId: postgraduatePg.id,
      supervisorId: professors[1].id,
      startedAt: new Date().toISOString().slice(0, 10),
      isActive: true,
      supervisionKind: 'co_supervisor'
    });

    const plan = await db.IndividualPlan.create({
      userId: postgraduatePg.id,
      academicYear: '2025-2026',
      status: 'approved'
    });

    await db.PlanItem.bulkCreate([
      { planId: plan.id, title: 'Публикация по теме диссертации (ВАК / Scopus)', orderIdx: 1, dueDate: '2026-06-01' },
      { planId: plan.id, title: 'Предзащита на кафедре', orderIdx: 2, dueDate: '2026-12-01', completedAt: null }
    ]);

    await db.DissertationTopic.create({
      userId: postgraduatePg.id,
      title: 'Интеллектуальные методы анализа данных в образовательной среде',
      status: 'approved'
    });

    await db.Milestone.create({
      userId: postgraduatePg.id,
      title: 'Кандидатский экзамен по специальности',
      milestoneType: 'exam',
      dueDate: '2026-03-01',
      status: 'pending'
    });

    await db.Milestone.create({
      userId: postgraduatePg.id,
      title: 'Сдача отчёта по публикационной активности (демо просрочки)',
      milestoneType: 'report',
      dueDate: '2025-01-15',
      status: 'pending'
    });

    await db.Publication.create({
      userId: postgraduatePg.id,
      title: 'О применении машинного обучения в академическом процессе',
      venue: 'Вестник университета',
      year: 2025,
      indexing: 'ВАК',
      status: 'verified'
    });

    await db.Attestation.create({
      userId: postgraduatePg.id,
      periodLabel: '2024–2025',
      decision: 'Допущен к итоговой аттестации',
      attestedAt: '2025-06-30'
    });

    await db.AcademicDocument.create({
      userId: postgraduatePg.id,
      title: 'Индивидуальный план подготовки',
      documentType: 'individual_plan',
      status: 'approved'
    });

    console.log('✅ Пользователи созданы:');
    console.log('   - Профессора:', professors.length);
    console.log('   - Аспиранты:', postgraduates.length);
    console.log('   - Администратор: 1');
    console.log('   - Администратор программы: 1');

    // Форматы и активности расписания аспирантуры
    const postgraduateActivities = [
      { title: 'Научно-исследовательский семинар', format: 'семинар', professor: professors[0] },
      { title: 'Методологический семинар по диссертации', format: 'семинар', professor: professors[1] },
      { title: 'Консультация с научным руководителем', format: 'консультация', professor: professors[0] },
      { title: 'Академическое письмо и публикационная стратегия', format: 'практикум', professor: professors[2] },
      { title: 'Анализ данных для диссертационного исследования', format: 'лабораторная', professor: professors[3] },
      { title: 'Проектный коллоквиум кафедры', format: 'коллоквиум', professor: professors[4] },
      { title: 'Подготовка к кандидатскому экзамену', format: 'подготовка', professor: professors[5] },
      { title: 'Научный воркшоп по теме исследования', format: 'воркшоп', professor: professors[2] }
    ];

    console.log('✅ Распределение активностей по ведущим:');
    postgraduateActivities.forEach((item) => {
      console.log(`   - ${item.title} (${item.format}) → ${item.professor.fullName}`);
    });

    // Создаём расписание с датами на текущую неделю
    console.log('📅 Создание расписания на текущую неделю...');
    const today = new Date();
    
    // Получаем понедельник текущей недели
    const getMonday = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // корректируем для понедельника
      return new Date(d.setDate(diff));
    };
    
    const monday = getMonday(today);
    monday.setHours(0, 0, 0, 0);
    
    const schedules = [];
    
    // Дни недели для расписания
    const weekDays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
    const weekDates = weekDays.map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date.toISOString().split('T')[0];
    });

    // 3-4 пары в день; интервалы по требованиям:
    // 1->2 перерыв 10 минут, 2->3 перерыв 20 минут, 3->4 перерыв 10 минут
    const pairTimes = ['09:00 – 10:35', '10:45 – 12:20', '12:40 – 14:15', '14:25 – 16:00'];
    const dayPairCounts = [4, 3, 4, 3, 4]; // Пн-Пт
    const auditoriumsByGroup = {
      'Аспирантура 2024-1': ['Лаб. 304', 'Ауд. 210', 'Науч. зал 112', 'Коллоквиум 405'],
      'Аспирантура 2024-2': ['Лаб. 305', 'Ауд. 211', 'Науч. зал 113', 'Коллоквиум 406'],
      'Аспирантура 2024-3': ['Лаб. 306', 'Ауд. 212', 'Науч. зал 114', 'Коллоквиум 407']
    };

    const createGroupSchedule = (groupPostgraduates, groupName) => {
      let activityCursor = 0;
      for (let dayIndex = 0; dayIndex < weekDays.length; dayIndex += 1) {
        const dayOfWeek = weekDays[dayIndex];
        const date = weekDates[dayIndex];
        const pairsForDay = dayPairCounts[dayIndex];

        for (let pairIndex = 0; pairIndex < pairsForDay; pairIndex += 1) {
          const item = postgraduateActivities[activityCursor % postgraduateActivities.length];
          activityCursor += 1;
          const time = pairTimes[pairIndex];
          const auditorium = (auditoriumsByGroup[groupName] || [])[pairIndex] || 'Ауд. 101';

          for (const pg of groupPostgraduates) {
            schedules.push(db.Schedule.create({
              userId: pg.id,
              dayOfWeek: dayOfWeek,
              time: time,
              subject: `${item.title} (${item.format})`,
              teacher: item.professor.fullName,
              auditorium: auditorium,
              date: date
            }));
          }
        }
      }
    };

    const group1 = postgraduates.filter(s => s.groupName === 'Аспирантура 2024-1');
    const group2 = postgraduates.filter(s => s.groupName === 'Аспирантура 2024-2');
    const group3 = postgraduates.filter(s => s.groupName === 'Аспирантура 2024-3');

    createGroupSchedule(group1, 'Аспирантура 2024-1');
    createGroupSchedule(group2, 'Аспирантура 2024-2');
    createGroupSchedule(group3, 'Аспирантура 2024-3');

    const createdSchedules = await Promise.all(schedules);
    console.log('✅ Расписание создано:', createdSchedules.length, 'занятий');

    // Создаём оценки (только для предметов текущей недели)
    console.log('📊 Создание оценок...');
    const grades = [];
    
    // Создаем несколько примерных оценок для демонстрации
    // Оценки соответствуют расписанию и предметам текущей недели
    const sampleGrades = [
      {
        postgraduateIndex: 0,
        subjectIndex: 0,
        dayOfWeek: 'Понедельник',
        grade: '5',
        comment: 'Чётко сформулированы цель, задачи и методология диссертационного исследования.'
      },
      {
        postgraduateIndex: 0,
        subjectIndex: 1,
        dayOfWeek: 'Вторник',
        grade: '4',
        comment: 'Требуется доработать структуру статьи и оформление списка источников.'
      },
      {
        postgraduateIndex: 1,
        subjectIndex: 0,
        dayOfWeek: 'Понедельник',
        grade: '5',
        comment: 'Отличная аргументация научной новизны и практической значимости.'
      },
      {
        postgraduateIndex: 1,
        subjectIndex: 1,
        dayOfWeek: 'Вторник',
        grade: '4',
        comment: 'Материал подготовлен хорошо, рекомендовано усилить аналитический обзор.'
      },
      {
        postgraduateIndex: 2,
        subjectIndex: 0,
        dayOfWeek: 'Понедельник',
        grade: '4',
        comment: 'Нужно уточнить объект и предмет исследования, а также критерии оценки результатов.'
      },
      {
        postgraduateIndex: 3,
        subjectIndex: 2,
        dayOfWeek: 'Среда',
        grade: 'зачёт',
        comment: 'Показано понимание философских оснований выбранной научной школы.'
      },
      {
        postgraduateIndex: 5,
        subjectIndex: 3,
        dayOfWeek: 'Четверг',
        grade: '5',
        comment: 'Корректно применены статистические методы и интерпретация полученных данных.'
      },
      {
        postgraduateIndex: 10,
        subjectIndex: 7,
        dayOfWeek: 'Пятница',
        grade: '4',
        comment: 'Подготовка к кандидатскому экзамену на хорошем уровне, требуется усилить теоретический блок.'
      }
    ];

    // Создаем оценки на основе примеров
    for (const sample of sampleGrades) {
      if (sample.postgraduateIndex < postgraduates.length && sample.subjectIndex < subjects.length) {
        const pg = postgraduates[sample.postgraduateIndex];
        const subject = subjects[sample.subjectIndex];

        grades.push(db.Grade.create({
          userId: pg.id,
          subject: subject.name,
          controlType: `Занятие ${sample.dayOfWeek}`,
          grade: sample.grade,
          comment: sample.comment
        }));
      }
    }

    await Promise.all(grades);
    console.log('✅ Оценки созданы:', grades.length);

    // Создаём сообщения
    console.log('💬 Создание сообщений...');
    const messages = await Promise.all([
      db.Message.create({
        senderId: professors[1].id,
        recipientId: postgraduates[0].id,
        topic: 'План консультации по диссертации',
        text: 'Согласуйте план консультаций на месяц и подготовьте обновлённую структуру главы 1 к 12.12.2025.',
        isRead: false
      }),
      db.Message.create({
        senderId: professors[1].id,
        recipientId: postgraduates[1].id,
        topic: 'Комментарий к статье',
        text: 'Черновик статьи рассмотрен. Требуется доработать разделы «Методика» и «Обсуждение результатов».',
        isRead: false
      }),
      db.Message.create({
        senderId: professors[2].id,
        recipientId: postgraduates[2].id,
        topic: 'Подготовка к кандидатскому экзамену',
        text: 'Подойдите на консультацию по билетам кандидатского экзамена в среду в 16:30.',
        isRead: false
      }),
      db.Message.create({
        senderId: professors[3].id,
        recipientId: postgraduates[0].id,
        topic: 'Напоминание о научном семинаре',
        text: 'Напоминаю о выступлении на кафедральном научном семинаре в понедельник в 14:00.',
        isRead: false
      })
    ]);

    console.log('✅ Сообщения созданы:', messages.length);

    console.log('\n🎉 База данных успешно инициализирована!');
    console.log('\n📋 Тестовые учетные записи:');
    console.log('   Аспиранты: login=postgraduate1..postgraduate15, password=password123');
    console.log('   Профессора: login=professor1..professor6, password=password123');
    console.log('   Администратор: login=admin1, password=admin123');
    console.log('   Аспирант: login=postgraduate1, password=password123');
    console.log('   Профессор: login=professor1, password=password123');
    console.log('   Админ программы: login=programadmin1, password=password123');
    console.log('\n📊 Статистика:');
    console.log('   - Предметов:', subjects.length);
    console.log('   - Профессоров:', professors.length);
    console.log('   - Аспирантов:', postgraduates.length);
    console.log('   - Расписаний:', createdSchedules.length);
    console.log('   - Оценок:', grades.length);
    console.log('   - Сообщений:', messages.length);

    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    await db.sequelize.close();
    process.exit(1);
  }
}

initDatabase();