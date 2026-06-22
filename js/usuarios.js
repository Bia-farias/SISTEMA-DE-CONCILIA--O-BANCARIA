/**
 * usuarios.js – User Management Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const session = AUTH.requireAuth(['admin']);
  if (!session) return;

  const users = () => AUTH.getAllUsers();
  let editingId = null;

  // ---- Render user table ----
  function renderUsers(filter = '') {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    let list = users();
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }

    tbody.innerHTML = '';
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
          Nenhum usuário encontrado.
        </td></tr>
      `;
      return;
    }

    list.forEach(u => {
      const roleColors = { admin: 'badge-danger', analista: 'badge-brand', auditor: 'badge-info' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="flex items-center gap-3">
            <div class="user-avatar" style="width:36px;height:36px;font-size:0.8rem">${escapeHTML(u.avatar)}</div>
            <div>
              <div style="font-weight:600;font-size:0.875rem">${escapeHTML(u.name)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escapeHTML(u.email)}</div>
            </div>
          </div>
        </td>
        <td><code style="font-size:0.8rem;color:var(--brand-secondary)">${escapeHTML(u.username)}</code></td>
        <td><span class="badge ${roleColors[u.role] || 'badge-secondary'}">${AUTH.getRoleLabel(u.role)}</span></td>
        <td>
          <span class="badge ${u.active ? 'badge-success' : 'badge-secondary'} badge-dot">
            ${u.active ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td style="font-size:0.8rem;color:var(--text-muted)">
          ${u.lastLogin ? NORMALIZER.formatDateBR(u.lastLogin.slice(0,10)) + ' ' + u.lastLogin.slice(11,16) : '—'}
        </td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="editUser('${u.id}')"
              data-tooltip="Editar">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            ${u.active
              ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="toggleUser('${u.id}', false)"
                  style="color:var(--warning)" data-tooltip="Desativar">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                </button>`
              : `<button class="btn btn-ghost btn-icon btn-sm" onclick="toggleUser('${u.id}', true)"
                  style="color:var(--success)" data-tooltip="Ativar">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </button>`
            }
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Update count
    const countEl = document.getElementById('users-count');
    if (countEl) countEl.textContent = `${list.length} usuário(s)`;
  }

  // ---- Search ----
  document.getElementById('user-search')?.addEventListener('input', (e) => {
    renderUsers(e.target.value);
  });

  // ---- Open create modal ----
  document.getElementById('btn-new-user')?.addEventListener('click', () => {
    editingId = null;
    openModal();
  });

  function openModal(user = null) {
    const overlay = document.getElementById('user-modal');
    const title   = document.getElementById('modal-user-title');
    const form    = document.getElementById('user-form');

    if (!overlay) return;
    title.textContent = user ? 'Editar Usuário' : 'Novo Usuário';

    if (user) {
      form.querySelector('#u-name').value     = user.name;
      form.querySelector('#u-email').value    = user.email;
      form.querySelector('#u-username').value = user.username;
      form.querySelector('#u-role').value     = user.role;
      form.querySelector('#u-password').value = '';
      form.querySelector('#u-password').placeholder = 'Deixe em branco para manter';
    } else {
      form.reset();
      form.querySelector('#u-password').placeholder = 'Senha';
    }

    overlay.classList.add('active');
  }

  window.editUser = function(id) {
    const user = AUTH.getAllUsers().find(u => u.id === id);
    if (!user) return;
    editingId = id;
    openModal(user);
  };

  window.toggleUser = async function(id, activate) {
    const action = activate ? 'ativar' : 'desativar';
    const ok = await APP.confirm(`Deseja ${action} este usuário?`);
    if (!ok) return;
    if (activate) {
      AUTH.activateUser(id);
    } else {
      AUTH.deactivateUser(id);
    }
    renderUsers();
    APP.toast(`Usuário ${activate ? 'ativado' : 'desativado'} com sucesso.`, 'success');
  };

  // ---- Close modal ----
  document.querySelectorAll('.modal-close, #modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('user-modal')?.classList.remove('active');
    });
  });

  // ---- Save user ----
  document.getElementById('user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('u-name').value.trim();
    const email    = document.getElementById('u-email').value.trim();
    const username = document.getElementById('u-username').value.trim();
    const password = document.getElementById('u-password').value;
    const role     = document.getElementById('u-role').value;

    if (!name || !email || !username || !role) {
      APP.toast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      APP.toast('Insira um e-mail válido.', 'warning');
      return;
    }

    if (editingId) {
      const updates = { name, email, username, role };
      if (password) updates.password = password;
      const res = await AUTH.updateUser(editingId, updates);
      if (!res.success) { APP.toast(res.error, 'error'); return; }
      APP.toast('Usuário atualizado com sucesso!', 'success');
    } else {
      if (!password) { APP.toast('Informe uma senha.', 'warning'); return; }
      const res = await AUTH.createUser({ name, email, username, password, role });
      if (!res.success) { APP.toast(res.error, 'error'); return; }
      APP.toast('Usuário criado com sucesso!', 'success');
    }

    document.getElementById('user-modal')?.classList.remove('active');
    renderUsers();
  });

  // ---- Audit Log ----
  function renderAuditLog() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    const logs = AUDIT.getLogs(50);
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted)">Sem registros.</td></tr>`;
      return;
    }

    logs.forEach(log => {
      const tr = document.createElement('tr');
      const dt = new Date(log.timestamp);
      tr.innerHTML = `
        <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">
          ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
        </td>
        <td style="font-size:0.8rem;font-weight:600">${escapeHTML(log.userName)}</td>
        <td style="font-size:0.8rem">${escapeHTML(log.description)}</td>
        <td><span class="badge badge-secondary" style="font-size:0.65rem;font-family:monospace">${escapeHTML(log.action)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---- Init ----
  renderUsers();
  renderAuditLog();
});
