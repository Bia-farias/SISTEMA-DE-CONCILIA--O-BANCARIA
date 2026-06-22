/**
 * auth.js – Authentication, Session Management, User Roles
 */

const AUTH = (() => {
  const USERS_KEY = 'scb_users';
  const SESSION_KEY = 'scb_session';

  // Helper to hash password using SHA-256 Web Crypto API
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Default users seeded on first load
  const DEFAULT_USERS = [
    {
      id: 'usr-001',
      name: 'Administrador',
      email: 'admin@conciliacao.com',
      username: 'admin',
      password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // admin123
      role: 'admin',
      avatar: 'AD',
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    },
    {
      id: 'usr-002',
      name: 'Analista Financeiro',
      email: 'analista@conciliacao.com',
      username: 'analista',
      password: '9cd268397030111adacb4268e51f0dbbb0dbc8c59eb34f8f7d55f72d4c888349', // analista123
      role: 'analista',
      avatar: 'AF',
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    },
    {
      id: 'usr-003',
      name: 'Auditor',
      email: 'auditor@conciliacao.com',
      username: 'auditor',
      password: '5b92db4dfb561dc69c949f34d36f5db0f8b30811be3a2949d85c5001279e9b1a', // auditor123
      role: 'auditor',
      avatar: 'AU',
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    },
  ];

  const ROLE_LABELS = {
    admin: 'Administrador',
    analista: 'Analista Financeiro',
    auditor: 'Auditor',
  };

  const ROLE_PERMISSIONS = {
    admin: ['dashboard', 'conciliacao', 'relatorios', 'usuarios', 'configuracoes'],
    analista: ['dashboard', 'conciliacao', 'relatorios'],
    auditor: ['dashboard', 'relatorios'],
  };

  function seedUsers() {
    if (!localStorage.getItem(USERS_KEY)) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    }
  }

  function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async function login(username, password) {
    const users = getUsers();
    const hashed = await hashPassword(password);
    const user = users.find(
      u => u.username === username.trim() && u.password === hashed && u.active
    );
    if (!user) return { success: false, error: 'Usuário ou senha incorretos.' };

    // Update last login
    user.lastLogin = new Date().toISOString();
    saveUsers(users);

    const session = {
      userId: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Audit log
    AUDIT.log('login', `Login realizado por ${user.name}`, { userId: user.id });

    return { success: true, user: session };
  }

  function logout() {
    const session = getSession();
    if (session) {
      AUDIT.log('logout', `Logout realizado por ${session.name}`, { userId: session.userId });
    }
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!session) return null;
      // Expirar sessão após 8 horas
      const loginTime = new Date(session.loginTime).getTime();
      if (Date.now() - loginTime > 8 * 60 * 60 * 1000) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      // Verificar se o usuário ainda está ativo
      const users = getUsers();
      const user = users.find(u => u.id === session.userId);
      if (!user || !user.active) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function requireAuth(allowedRoles = []) {
    const session = getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      window.location.href = 'dashboard.html';
      return null;
    }
    return session;
  }

  function hasPermission(page) {
    const session = getSession();
    if (!session) return false;
    const perms = ROLE_PERMISSIONS[session.role] || [];
    return perms.includes(page);
  }

  function getRoleLabel(role) {
    return ROLE_LABELS[role] || role;
  }

  function getAllUsers() {
    return getUsers();
  }

  async function createUser(userData) {
    const users = getUsers();
    if (users.find(u => u.username === userData.username)) {
      return { success: false, error: 'Nome de usuário já existe.' };
    }

    // Whitelist allowed fields to prevent privilege escalation
    const allowed = ['name', 'email', 'username', 'password', 'role'];
    const safe = {};
    for (const key of allowed) {
      if (userData[key] !== undefined) safe[key] = userData[key];
    }

    // Ensure role is valid
    if (safe.role && !['admin', 'analista', 'auditor'].includes(safe.role)) {
      return { success: false, error: 'Perfil inválido.' };
    }

    // Hash password
    if (safe.password) {
      safe.password = await hashPassword(safe.password);
    }

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const newUser = {
      id: 'usr-' + uuid,
      ...safe,
      avatar: safe.name ? safe.name.slice(0, 2).toUpperCase() : 'US',
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };
    users.push(newUser);
    saveUsers(users);
    AUDIT.log('usuario_criado', `Usuário ${newUser.name} criado`, { userId: newUser.id });
    return { success: true, user: newUser };
  }

  async function updateUser(id, updates) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return { success: false, error: 'Usuário não encontrado.' };

    // Whitelist fields
    const allowed = ['name', 'email', 'username', 'password', 'role', 'active'];
    const safe = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safe[key] = updates[key];
    }

    // Check username uniqueness if changed
    if (safe.username && safe.username !== users[idx].username) {
      if (users.find(u => u.username === safe.username)) {
        return { success: false, error: 'Nome de usuário já existe.' };
      }
    }

    // Validate role
    if (safe.role && !['admin', 'analista', 'auditor'].includes(safe.role)) {
      return { success: false, error: 'Perfil inválido.' };
    }

    // Hash password if updated
    if (safe.password) {
      safe.password = await hashPassword(safe.password);
    }

    users[idx] = { ...users[idx], ...safe };
    saveUsers(users);
    AUDIT.log('usuario_atualizado', `Usuário ${users[idx].name} atualizado`, { userId: id });
    return { success: true, user: users[idx] };
  }

  async function deactivateUser(id) {
    return await updateUser(id, { active: false });
  }

  async function activateUser(id) {
    return await updateUser(id, { active: true });
  }

  // Initialize
  seedUsers();

  return {
    login, logout, getSession, requireAuth, hasPermission,
    getRoleLabel, getAllUsers, createUser, updateUser,
    deactivateUser, activateUser, ROLE_LABELS, ROLE_PERMISSIONS, hashPassword
  };
})();
