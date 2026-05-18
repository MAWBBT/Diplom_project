const LEGACY_TABLES = [
  'supervisor_feedback',
  'supervisions',
  'audit_logs',
  'dissertation_topic_histories',
  'milestones',
  'report_files'
];

async function dropLegacyTablesQuiet(sequelize) {
  for (const table of LEGACY_TABLES) {
    await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
  }
}

module.exports = { LEGACY_TABLES, dropLegacyTablesQuiet };
