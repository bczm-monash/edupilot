(function () {
  const menu = document.querySelector('.navigationBar .menu');
  if (!menu) return;

  const isAdminView = typeof isAdminModeActive === 'function'
    ? isAdminModeActive()
    : (() => {
        try {
          return sessionStorage.getItem('adminMode') === 'true';
        } catch (err) {
          return false;
        }
      })();

  if (!isAdminView) return;

  if (menu.querySelector('.admin-nav-button')) return;

  const adminBtn = document.createElement('button');
  adminBtn.className = 'admin-nav-button';
  adminBtn.type = 'button';
  adminBtn.textContent = 'Admin';
  adminBtn.addEventListener('click', () => {
    if (typeof clearAdminModeFlag === 'function') {
      clearAdminModeFlag();
    } else {
      try {
        sessionStorage.removeItem('adminMode');
      } catch (err) {
        /* ignore */
      }
    }

    if (typeof toAdmin === 'function') {
      toAdmin();
    } else {
      window.location.href = '/EduPilot/html/admin/adminpage.html';
    }
  });

  menu.prepend(adminBtn);
})();
