const ROLE_TITLES = {
  admin: 'Администратор',
  postgraduate: 'Аспирант',
  professor: 'Профессор',
  program_admin: 'Администратор программы'
};

function getRoleTitle(role) {
  return ROLE_TITLES[role] || role;
}

module.exports = {
  ROLE_TITLES,
  getRoleTitle
};
