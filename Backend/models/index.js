const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const User = require('./User')(sequelize);
const Schedule = require('./Schedule')(sequelize);
const Grade = require('./Grade')(sequelize);
const Message = require('./Message')(sequelize);
const Subject = require('./Subject')(sequelize);
const Program = require('./Program')(sequelize);
const PostgraduateProfile = require('./PostgraduateProfile')(sequelize);
const Supervision = require('./Supervision')(sequelize);
const DissertationTopic = require('./DissertationTopic')(sequelize);
const IndividualPlan = require('./IndividualPlan')(sequelize);
const PlanItem = require('./PlanItem')(sequelize);
const Milestone = require('./Milestone')(sequelize);
const Publication = require('./Publication')(sequelize);
const Attestation = require('./Attestation')(sequelize);
const AcademicDocument = require('./Document')(sequelize);
const DocumentFile = require('./DocumentFile')(sequelize);
const Notification = require('./Notification')(sequelize);
const DissertationTopicHistory = require('./DissertationTopicHistory')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const AttendanceSession = require('./AttendanceSession')(sequelize);
const AttendanceRecord = require('./AttendanceRecord')(sequelize);
const MessageFile = require('./MessageFile')(sequelize);
const CurriculumPlan = require('./CurriculumPlan')(sequelize);
const CurriculumItem = require('./CurriculumItem')(sequelize);
const PlanItemFile = require('./PlanItemFile')(sequelize);
const AttestationFile = require('./AttestationFile')(sequelize);
const ReportFile = require('./ReportFile')(sequelize);

User.hasMany(Schedule, { foreignKey: 'userId', as: 'schedules' });
User.hasMany(Grade, { foreignKey: 'userId', as: 'grades' });
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'recipientId', as: 'receivedMessages' });
Schedule.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Grade.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'recipientId', as: 'recipient' });
Message.hasMany(MessageFile, { foreignKey: 'messageId', as: 'files' });
MessageFile.belongsTo(Message, { foreignKey: 'messageId', as: 'message' });

Subject.hasMany(Schedule, { foreignKey: 'subjectId', as: 'schedules' });
Schedule.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subjectRef' });
Subject.hasMany(Grade, { foreignKey: 'subjectId', as: 'grades' });
Grade.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subjectRef' });

Program.hasMany(PostgraduateProfile, { foreignKey: 'programId', as: 'profiles' });
PostgraduateProfile.belongsTo(Program, { foreignKey: 'programId', as: 'program' });

User.hasOne(PostgraduateProfile, { foreignKey: 'userId', as: 'postgraduateProfile' });
PostgraduateProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Supervision, { foreignKey: 'postgraduateId', as: 'supervisionsAsPostgraduate' });
User.hasMany(Supervision, { foreignKey: 'supervisorId', as: 'supervisionsAsSupervisor' });
Supervision.belongsTo(User, { foreignKey: 'postgraduateId', as: 'postgraduate' });
Supervision.belongsTo(User, { foreignKey: 'supervisorId', as: 'supervisor' });

User.hasMany(DissertationTopic, { foreignKey: 'userId', as: 'dissertationTopics' });
DissertationTopic.belongsTo(User, { foreignKey: 'userId', as: 'author' });

User.hasMany(IndividualPlan, { foreignKey: 'userId', as: 'individualPlans' });
IndividualPlan.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
IndividualPlan.hasMany(PlanItem, { foreignKey: 'planId', as: 'items' });
PlanItem.belongsTo(IndividualPlan, { foreignKey: 'planId', as: 'plan' });
PlanItem.hasMany(PlanItemFile, { foreignKey: 'planItemId', as: 'files' });
PlanItemFile.belongsTo(PlanItem, { foreignKey: 'planItemId', as: 'planItem' });
PlanItemFile.belongsTo(User, { foreignKey: 'uploadedById', as: 'uploadedBy' });
User.hasMany(PlanItemFile, { foreignKey: 'uploadedById', as: 'uploadedPlanItemFiles' });

User.hasMany(Milestone, { foreignKey: 'userId', as: 'milestones' });
Milestone.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

User.hasMany(Publication, { foreignKey: 'userId', as: 'publications' });
Publication.belongsTo(User, { foreignKey: 'userId', as: 'author' });

User.hasMany(Attestation, { foreignKey: 'userId', as: 'attestations' });
Attestation.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
Attestation.hasMany(AttestationFile, { foreignKey: 'attestationId', as: 'files' });
AttestationFile.belongsTo(Attestation, { foreignKey: 'attestationId', as: 'attestation' });
AttestationFile.belongsTo(User, { foreignKey: 'uploadedById', as: 'uploadedBy' });
User.hasMany(AttestationFile, { foreignKey: 'uploadedById', as: 'uploadedAttestationFiles' });
User.hasMany(ReportFile, { foreignKey: 'generatedById', as: 'generatedReports' });
ReportFile.belongsTo(User, { foreignKey: 'generatedById', as: 'generatedBy' });

User.hasMany(AcademicDocument, { foreignKey: 'userId', as: 'academicDocuments' });
AcademicDocument.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

AcademicDocument.hasMany(DocumentFile, { foreignKey: 'documentId', as: 'files' });
DocumentFile.belongsTo(AcademicDocument, { foreignKey: 'documentId', as: 'document' });
DocumentFile.belongsTo(User, { foreignKey: 'uploadedById', as: 'uploadedBy' });
User.hasMany(DocumentFile, { foreignKey: 'uploadedById', as: 'uploadedFiles' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });

User.hasMany(DissertationTopicHistory, { foreignKey: 'userId', as: 'topicHistory' });
DissertationTopicHistory.belongsTo(User, { foreignKey: 'userId', as: 'postgraduate' });
DissertationTopicHistory.belongsTo(User, { foreignKey: 'changedById', as: 'changedBy' });
User.hasMany(DissertationTopicHistory, { foreignKey: 'changedById', as: 'topicChangesMade' });

User.hasMany(AuditLog, { foreignKey: 'actorId', as: 'auditActions' });
AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

Subject.hasMany(AttendanceSession, { foreignKey: 'subjectId', as: 'attendanceSessions' });
AttendanceSession.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subjectRef' });
AttendanceSession.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

AttendanceSession.hasMany(AttendanceRecord, { foreignKey: 'sessionId', as: 'records' });
AttendanceRecord.belongsTo(AttendanceSession, { foreignKey: 'sessionId', as: 'session' });
AttendanceRecord.belongsTo(User, { foreignKey: 'postgraduateId', as: 'postgraduate' });
AttendanceRecord.belongsTo(User, { foreignKey: 'markedById', as: 'markedBy' });
User.hasMany(AttendanceRecord, { foreignKey: 'postgraduateId', as: 'attendanceRecords' });

Program.hasMany(CurriculumPlan, { foreignKey: 'programId', as: 'curriculumPlans' });
CurriculumPlan.belongsTo(Program, { foreignKey: 'programId', as: 'program' });
CurriculumPlan.hasMany(CurriculumItem, { foreignKey: 'planId', as: 'items' });
CurriculumItem.belongsTo(CurriculumPlan, { foreignKey: 'planId', as: 'plan' });
Subject.hasMany(CurriculumItem, { foreignKey: 'subjectId', as: 'curriculumItems' });
CurriculumItem.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subjectRef' });

const db = {
  sequelize,
  Sequelize,
  User,
  Schedule,
  Grade,
  Message,
  Subject,
  Program,
  PostgraduateProfile,
  Supervision,
  DissertationTopic,
  IndividualPlan,
  PlanItem,
  Milestone,
  Publication,
  Attestation,
  AcademicDocument,
  DocumentFile,
  Notification,
  DissertationTopicHistory,
  AuditLog,
  AttendanceSession,
  AttendanceRecord,
  MessageFile,
  CurriculumPlan,
  CurriculumItem,
  PlanItemFile,
  AttestationFile,
  ReportFile
};

db.sync = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных установлено.');
    const alter = !force && process.env.DATABASE_SYNC_ALTER === '1';
    await sequelize.sync({ force, alter });
    if (alter) {
      console.log('✅ Синхронизация с alter (DATABASE_SYNC_ALTER=1).');
    } else {
      console.log('✅ Модели синхронизированы с базой данных.');
    }
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    return false;
  }
};

module.exports = db;
