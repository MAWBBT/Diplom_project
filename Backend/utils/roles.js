function getRoleTitle(role) {
  const map = {
    admin: 'Администратор',
    professor: 'Научный руководитель',
    postgraduate: 'Аспирант',
    program_admin: 'Администратор программы'
  };
  return map[role] || role || 'Пользователь';
}

module.exports = { getRoleTitle };

