/**
 * Удаляет таблицы старой схемы, не используемые текущими Sequelize-моделями.
 * Sequelize sync/alter их не удаляет — они остаются «висячими» в pgAdmin.
 *
 * npm run drop-legacy-tables
 */
const db = require('../models');
const { LEGACY_TABLES, dropLegacyTablesQuiet } = require('./drop-legacy-tables-lib');

async function dropLegacyTables() {
  await db.sequelize.authenticate();
  console.log('Удаление устаревших таблиц...');
  await dropLegacyTablesQuiet(db.sequelize);
  for (const table of LEGACY_TABLES) {
    console.log(`  ✓ ${table}`);
  }
  console.log('Готово. Актуальная схема — 22 таблицы из models/index.js.');
}

dropLegacyTables()
  .then(() => db.sequelize.close())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await db.sequelize.close();
    process.exit(1);
  });
