/**
 * app.js – Global App Logic: Sidebar, Header, Toasts, Navigation
 */

const APP = (() => {

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  window.escapeHTML = escapeHTML;

  // ---- Toast System ----
  let toastContainer = null;

  function initToasts() {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  function toast(message, type = 'info', duration = 4000) {
    if (!toastContainer) initToasts();
    const icons = {
      success: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      error:   `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      warning: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info:    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    };

    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHTML(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    toastContainer.appendChild(t);
    if (duration > 0) {
      setTimeout(() => {
        t.classList.add('toast-hide');
        setTimeout(() => t.remove(), 300);
      }, duration);
    }
    return t;
  }

  // ---- Sidebar ----
  function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const header  = document.querySelector('.header');
    const main    = document.querySelector('.main-content');
    const toggle  = document.getElementById('sidebar-toggle');

    if (!sidebar) return;

    const collapsed = localStorage.getItem('scb_sidebar_collapsed') === 'true';
    if (collapsed) {
      sidebar.classList.add('collapsed');
      header?.classList.add('sidebar-collapsed');
      main?.classList.add('sidebar-collapsed');
    }

    toggle?.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      header?.classList.toggle('sidebar-collapsed', isCollapsed);
      main?.classList.toggle('sidebar-collapsed', isCollapsed);
      localStorage.setItem('scb_sidebar_collapsed', isCollapsed);
    });

    // Highlight active nav item
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href') || '';
      if (href === current || href.endsWith(current)) {
        item.classList.add('active');
      }
    });
  }

  // ---- User dropdown ----
  function initUserDropdown() {
    const btn      = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => dropdown.classList.remove('active'));
  }

  // ---- Notification panel ----
  function initNotifications() {
    const btn   = document.getElementById('notif-btn');
    const panel = document.getElementById('notif-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('active');
      if (panel.classList.contains('active')) {
        STORAGE.markNotificationsRead();
        updateNotifBadge();
      }
    });

    document.addEventListener('click', () => panel?.classList.remove('active'));
    updateNotifBadge();
  }

  function updateNotifBadge() {
    const dot = document.querySelector('.notif-dot');
    const count = STORAGE.getUnreadCount();
    if (dot) dot.style.display = count > 0 ? 'block' : 'none';
  }

  // ---- Session UI ----
  function populateUserUI(session) {
    if (!session) return;

    // Sidebar avatar
    document.querySelectorAll('.user-avatar').forEach(el => {
      el.textContent = session.avatar || session.name.slice(0, 2).toUpperCase();
    });
    document.querySelectorAll('.sidebar-user-name, .user-name').forEach(el => {
      el.textContent = session.name;
    });
    document.querySelectorAll('.sidebar-user-role').forEach(el => {
      el.textContent = AUTH.getRoleLabel(session.role);
    });

    // Hide admin-only items
    if (session.role !== 'admin') {
      document.querySelectorAll('[data-role="admin"]').forEach(el => {
        el.style.display = 'none';
      });
    }
    // Hide items that require conciliacao role
    if (session.role === 'auditor') {
      document.querySelectorAll('[data-role="analista"]').forEach(el => {
        el.style.display = 'none';
      });
    }
  }

  // ---- Logout ----
  function initLogout() {
    document.querySelectorAll('#logout-btn, .logout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        APP.toast('Saindo...', 'info', 1500);
        setTimeout(() => AUTH.logout(), 800);
      });
    });
  }

  // ---- Format relative time ----
  function timeAgo(isoStr) {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 0) return 'agora';
    if (diff < 60)  return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + ' min atrás';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h atrás';
    return Math.floor(diff / 86400) + 'd atrás';
  }

  // ---- Confirm dialog ----
  function confirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3 class="modal-title">${escapeHTML(title)}</h3>
          </div>
          <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:0">${escapeHTML(message)}</p>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cfm-cancel">Cancelar</button>
            <button class="btn btn-danger"    id="cfm-ok">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#cfm-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
      overlay.querySelector('#cfm-ok').addEventListener('click',     () => { overlay.remove(); resolve(true); });
    });
  }

  // ---- Initialize everything ----
  function init() {
    initToasts();
    initSidebar();
    initUserDropdown();
    initNotifications();
    initLogout();

    const session = AUTH.getSession();
    if (session) populateUserUI(session);
  }

  return { init, toast, timeAgo, confirm, updateNotifBadge };
})();

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => APP.init());
