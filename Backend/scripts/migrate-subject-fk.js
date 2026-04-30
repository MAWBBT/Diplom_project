const db = require('../models');

async function ensureSubjectsFromColumn({ table, column }) {
  const [rows] = await db.sequelize.query(
    `SELECT DISTINCT TRIM(${column}) AS name
     FROM ${table}
     WHERE ${column} IS NOT NULL AND TRIM(${column}) <> ''`
  );

  for (const r of rows) {
    const name = (r.name || '').trim();
    if (!name) continue;
    // eslint-disable-next-line no-await-in-loop
    await db.Subject.findOrCreate({ where: { name }, defaults: { name } });
  }
}

async function backfillSubjectId({ table }) {
  await db.sequelize.query(
    `UPDATE ${table} t
     SET "subjectId" = s.id
     FROM subjects s
     WHERE t."subjectId" IS NULL
       AND t.subject IS NOT NULL
       AND TRIM(t.subject) <> ''
       AND s.name = TRIM(t.subject)`
  );
}

async function dropSubjectColumn({ table }) {
  await db.sequelize.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS subject;`);
}

async function requireNotNullSubjectId({ table }) {
  await db.sequelize.query(`ALTER TABLE ${table} ALTER COLUMN "subjectId" SET NOT NULL;`);
}

async function main() {
  try {
    await db.sequelize.authenticate();

    // 1) Create subjects from existing string values
    await ensureSubjectsFromColumn({ table: 'schedules', column: 'subject' });
    await ensureSubjectsFromColumn({ table: 'grades', column: 'subject' });

    // 2) Backfill subjectId by matching subject name
    await backfillSubjectId({ table: 'schedules' });
    await backfillSubjectId({ table: 'grades' });

    // 3) Enforce NOT NULL and drop legacy columns
    await requireNotNullSubjectId({ table: 'schedules' });
    await requireNotNullSubjectId({ table: 'grades' });
    await dropSubjectColumn({ table: 'schedules' });
    await dropSubjectColumn({ table: 'grades' });

    // eslint-disable-next-line no-console
    console.log('✅ Subject FK migration completed');
    await db.sequelize.close();
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Subject FK migration failed', err);
    try {
      await db.sequelize.close();
    } catch (_) {
      // ignore
    }
    process.exit(1);
  }
}

main();

