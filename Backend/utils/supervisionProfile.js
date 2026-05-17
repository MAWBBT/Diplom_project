const { Op } = require('sequelize');
const { PostgraduateProfile, User } = require('../models');

const supervisorAttrs = ['id', 'fullName', 'email', 'login'];
const postgraduateAttrs = ['id', 'fullName', 'login', 'email', 'groupName'];

function supervisionRow(profile, kind) {
  const isPrimary = kind === 'primary';
  const supervisor = isPrimary ? profile.supervisor : profile.coSupervisor;
  const supervisorId = isPrimary ? profile.supervisorId : profile.coSupervisorId;
  if (!supervisorId) return null;
  return {
    id: profile.id * 10 + (isPrimary ? 1 : 2),
    postgraduateId: profile.userId,
    supervisorId,
    startedAt: profile.supervisionStartedAt,
    endedAt: null,
    isActive: true,
    supervisionKind: kind,
    supervisor
  };
}

async function userSupervisesPostgraduate(supervisorId, postgraduateId) {
  const profile = await PostgraduateProfile.findOne({
    where: { userId: postgraduateId },
    attributes: ['supervisorId', 'coSupervisorId']
  });
  if (!profile) return false;
  return profile.supervisorId === supervisorId || profile.coSupervisorId === supervisorId;
}

async function supervisedPostgraduateIds(supervisorId) {
  const rows = await PostgraduateProfile.findAll({
    where: {
      [Op.or]: [{ supervisorId }, { coSupervisorId: supervisorId }]
    },
    attributes: ['userId'],
    raw: true
  });
  return [...new Set(rows.map((r) => r.userId).filter(Boolean))];
}

async function supervisionsForPostgraduate(userId) {
  const profile = await PostgraduateProfile.findOne({
    where: { userId },
    include: [
      { model: User, as: 'supervisor', attributes: supervisorAttrs },
      { model: User, as: 'coSupervisor', attributes: supervisorAttrs }
    ]
  });
  if (!profile) return [];
  return [supervisionRow(profile, 'primary'), supervisionRow(profile, 'co_supervisor')].filter(Boolean);
}

async function supervisionsForSupervisor(supervisorId) {
  const profiles = await PostgraduateProfile.findAll({
    where: {
      [Op.or]: [{ supervisorId }, { coSupervisorId: supervisorId }]
    },
    include: [{ model: User, as: 'user', attributes: postgraduateAttrs }],
    order: [['supervisionStartedAt', 'DESC']]
  });

  const out = [];
  for (const profile of profiles) {
    const kind =
      profile.supervisorId === supervisorId
        ? 'primary'
        : profile.coSupervisorId === supervisorId
          ? 'co_supervisor'
          : null;
    if (!kind) continue;
    const row = supervisionRow(profile, kind);
    if (!row) continue;
    out.push({
      supervision: row,
      postgraduate: profile.user ? profile.user.toSafeJSON() : null,
      profile,
      latestTopic: null
    });
  }
  return out;
}

async function supervisorOverviewStudents(supervisorId) {
  const profiles = await PostgraduateProfile.findAll({
    where: { supervisorId },
    include: [{ model: User, as: 'user', attributes: postgraduateAttrs }],
    order: [['supervisionStartedAt', 'DESC']]
  });

  return profiles.map((profile) => {
    const pg = profile.user;
    const row = supervisionRow(profile, 'primary');
    return {
      supervision: row,
      postgraduate: pg ? pg.toSafeJSON() : null,
      profile,
      latestTopic: null,
      latestPlanStatus: null,
      latestPlanYear: null
    };
  });
}

module.exports = {
  userSupervisesPostgraduate,
  supervisedPostgraduateIds,
  supervisionsForPostgraduate,
  supervisionsForSupervisor,
  supervisorOverviewStudents,
  supervisionRow
};
