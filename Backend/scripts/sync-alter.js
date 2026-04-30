const db = require('../models');

async function main() {
  try {
    process.env.DATABASE_SYNC_ALTER = process.env.DATABASE_SYNC_ALTER || '1';
    await db.sync(false);
    // eslint-disable-next-line no-console
    console.log('✅ Sync alter completed');
    await db.sequelize.close();
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Sync alter failed', err);
    try {
      await db.sequelize.close();
    } catch (_) {
      // ignore
    }
    process.exit(1);
  }
}

main();

