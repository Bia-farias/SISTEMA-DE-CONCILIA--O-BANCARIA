/**
 * storage.js – Data Persistence Layer (localStorage)
 * Manages reconciliation sessions, imported data, audit logs
 */

const STORAGE = (() => {
  const KEYS = {
    SESSIONS: 'scb_recon_sessions',
    CURRENT_SESSION: 'scb_current_recon',
    AUDIT_LOG: 'scb_audit_log',
    AI_PATTERNS: 'scb_ai_patterns',
    SETTINGS: 'scb_settings',
    NOTIFICATIONS: 'scb_notifications',
  };

  // ---- Generic helpers ----
  function get(key, fallback = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage full:', e);
      try {
        const sessions = getSessions();
        if (sessions.length > 10) {
          sessions.splice(10);
          localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
          // Try again
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        }
      } catch (innerErr) {
        console.error('Cleanup failed:', innerErr);
      }
      if (typeof APP !== 'undefined' && APP.toast) {
        APP.toast('Armazenamento cheio. Considere excluir sessões antigas.', 'error');
      }
      return false;
    }
  }

  function remove(key) {
    localStorage.removeItem(key);
  }

  // ---- Reconciliation Sessions ----
  function getSessions() {
    return get(KEYS.SESSIONS, []);
  }

  function saveSession(session) {
    const sessions = getSessions();
    const existing = sessions.findIndex(s => s.id === session.id);
    if (existing >= 0) {
      sessions[existing] = session;
    } else {
      sessions.unshift(session);
    }
    // Keep only last 50 sessions
    if (sessions.length > 50) sessions.splice(50);
    set(KEYS.SESSIONS, sessions);
    return session;
  }

  function getSession(id) {
    return getSessions().find(s => s.id === id) || null;
  }

  function deleteSession(id) {
    const sessions = getSessions().filter(s => s.id !== id);
    set(KEYS.SESSIONS, sessions);
  }

  function getCurrentSession() {
    return get(KEYS.CURRENT_SESSION, null);
  }

  function setCurrentSession(session) {
    set(KEYS.CURRENT_SESSION, session);
  }

  function clearCurrentSession() {
    remove(KEYS.CURRENT_SESSION);
  }

  // ---- Create new reconciliation session ----
  function createReconSession(bankData, systemData, config = {}) {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const session = {
      id: 'recon-' + uuid,
      createdAt: new Date().toISOString(),
      status: 'pending', // pending | running | completed | error
      config: {
        dateTolerance: 3,
        valueTolerance: 0.5,
        ...config,
      },
      bankData: bankData ? { fileName: bankData.fileName, rowCount: bankData.rowCount } : null,
      systemData: systemData ? { fileName: systemData.fileName, rowCount: systemData.rowCount } : null,
      results: [],
      summary: null,
      userId: null,
    };

    // Attach current user
    try {
      const userSession = JSON.parse(localStorage.getItem('scb_session'));
      if (userSession) session.userId = userSession.userId;
    } catch {}

    return session;
  }

  // ---- Dashboard stats ----
  function getDashboardStats() {
    const sessions = getSessions().filter(s => s.status === 'completed');

    let totalConciliado = 0;
    let totalPendente = 0;
    let totalDivergente = 0;
    let valorConciliado = 0;
    let valorPendente = 0;

    sessions.forEach(s => {
      if (!s.summary) return;
      totalConciliado += (s.summary.conciliado || 0) + (s.summary.conciliadoData || 0);
      totalPendente   += (s.summary.naoRegistrado || 0) + (s.summary.naoCompensado || 0);
      totalDivergente += (s.summary.divergenciaValor || 0) + (s.summary.divergenciaData || 0) +
                         (s.summary.duplicidade || 0) + (s.summary.provavelCorrespondencia || 0);
      valorConciliado += s.summary.valorConciliado || 0;
      valorPendente   += s.summary.valorPendente || 0;
    });

    const total = totalConciliado + totalPendente + totalDivergente;
    const pct = total > 0 ? Math.round((totalConciliado / total) * 100) : 0;

    return {
      totalConciliado,
      totalPendente,
      totalDivergente,
      valorConciliado,
      valorPendente,
      percentualConciliacao: pct,
      totalSessions: sessions.length,
    };
  }

  // ---- Trend data for charts ----
  function getTrendData(period = 'daily', days = 30) {
    const sessions = getSessions().filter(s => s.status === 'completed');
    const now = new Date();
    const map = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { conciliado: 0, pendente: 0, divergente: 0 };
    }

    sessions.forEach(s => {
      const key = s.createdAt.slice(0, 10);
      if (map[key]) {
        map[key].conciliado += (s.summary?.conciliado || 0);
        map[key].pendente   += (s.summary?.naoRegistrado || 0) + (s.summary?.naoCompensado || 0);
        map[key].divergente += (s.summary?.divergenciaValor || 0);
      }
    });

    return {
      labels: Object.keys(map),
      datasets: {
        conciliado: Object.values(map).map(v => v.conciliado),
        pendente: Object.values(map).map(v => v.pendente),
        divergente: Object.values(map).map(v => v.divergente),
      },
    };
  }

  // ---- Settings ----
  function getSettings() {
    return get(KEYS.SETTINGS, {
      dateTolerance: 3,
      valueTolerance: 0.5,
      autoSuggest: true,
      notificationsEnabled: true,
      theme: 'dark',
      language: 'pt-BR',
    });
  }

  function saveSettings(settings) {
    set(KEYS.SETTINGS, { ...getSettings(), ...settings });
  }

  // ---- Notifications ----
  function getNotifications() {
    return get(KEYS.NOTIFICATIONS, []);
  }

  function addNotification(notif) {
    const notifs = getNotifications();
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    notifs.unshift({
      id: 'notif-' + uuid,
      createdAt: new Date().toISOString(),
      read: false,
      ...notif,
    });
    if (notifs.length > 50) notifs.splice(50);
    set(KEYS.NOTIFICATIONS, notifs);
  }

  function markNotificationsRead() {
    const notifs = getNotifications().map(n => ({ ...n, read: true }));
    set(KEYS.NOTIFICATIONS, notifs);
  }

  function getUnreadCount() {
    return getNotifications().filter(n => !n.read).length;
  }

  // ---- AI Patterns ----
  function getAIPatterns() {
    return get(KEYS.AI_PATTERNS, []);
  }

  function saveAIPattern(pattern) {
    const patterns = getAIPatterns();
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    patterns.unshift({ ...pattern, id: 'pat-' + uuid, createdAt: new Date().toISOString() });
    if (patterns.length > 200) patterns.splice(200);
    set(KEYS.AI_PATTERNS, patterns);
  }

  return {
    get, set, remove,
    getSessions, saveSession, getSession, deleteSession,
    getCurrentSession, setCurrentSession, clearCurrentSession,
    createReconSession,
    getDashboardStats, getTrendData,
    getSettings, saveSettings,
    getNotifications, addNotification, markNotificationsRead, getUnreadCount,
    getAIPatterns, saveAIPattern,
    KEYS,
  };
})();

// ---- Audit Log ----
const AUDIT = (() => {
  const KEY = 'scb_audit_log';

  function log(action, description, meta = {}) {
    try {
      const logs = JSON.parse(localStorage.getItem(KEY) || '[]');
      const session = JSON.parse(localStorage.getItem('scb_session') || 'null');
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      logs.unshift({
        id: 'audit-' + uuid,
        action,
        description,
        meta,
        userId: session?.userId || 'system',
        userName: session?.name || 'Sistema',
        timestamp: new Date().toISOString(),
      });
      // Keep last 1000 entries
      if (logs.length > 1000) logs.splice(1000);
      localStorage.setItem(KEY, JSON.stringify(logs));
    } catch {}
  }

  function getLogs(limit = 100) {
    try {
      const logs = JSON.parse(localStorage.getItem(KEY) || '[]');
      return logs.slice(0, limit);
    } catch {
      return [];
    }
  }

  function clearLogs() {
    localStorage.removeItem(KEY);
  }

  return { log, getLogs, clearLogs };
})();
