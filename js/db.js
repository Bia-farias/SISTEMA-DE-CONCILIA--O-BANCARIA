/**
 * db.js – Supabase Database Module
 * Salva e carrega transações importadas via OCR no banco PostgreSQL.
 * Depende de: @supabase/supabase-js (CDN), CONFIG
 */

const DB = (() => {

  let _client = null;

  // ---- Inicializar cliente Supabase ----
  function init() {
    if (_client) return _client;

    if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('COLE_SEU')) {
      console.warn('[DB] Supabase não configurado. Dados serão armazenados apenas localmente.');
      return null;
    }

    if (!CONFIG.SUPABASE_ANON_KEY ||
        CONFIG.SUPABASE_ANON_KEY.includes('COLE_SUA') ||
        CONFIG.SUPABASE_ANON_KEY.length < 20) {
      console.warn('[DB] Chave Supabase inválida ou não configurada.');
      return null;
    }

    if (typeof window.supabase === 'undefined') {
      console.warn('[DB] SDK Supabase não carregado ainda. Verifique a CDN.');
      return null;
    }

    try {
      _client = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,  // Sem sessão persistente (sistema usa própria auth)
            autoRefreshToken: false,
          }
        }
      );
      console.info('[DB] Supabase inicializado com sucesso. URL:', CONFIG.SUPABASE_URL);
    } catch (e) {
      console.error('[DB] Erro ao inicializar Supabase:', e);
      _client = null;
    }
    return _client;
  }

  function getClient() {
    return _client || init();
  }

  function isAvailable() {
    return !!getClient();
  }

  // ---- Salvar importação OCR (log) ----
  async function saveOCRImport({ fileName, fileType, sourceType, rowCount, confidence, rawJson }) {
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client
      .from('ocr_imports')
      .insert([{
        file_name:   fileName,
        file_type:   fileType,
        source_type: sourceType,   // 'bank' ou 'system'
        row_count:   rowCount,
        confidence:  confidence,
        raw_json:    rawJson,
      }])
      .select('id')
      .single();

    if (error) {
      console.error('[DB] Erro ao salvar ocr_import:', error);
      return null;
    }
    return data?.id || null;
  }

  // ---- Salvar transações bancárias ----
  async function saveBankTransactions(rows, importId) {
    const client = getClient();
    if (!client) return false;

    const records = rows.map(r => ({
      import_id:   importId,
      date:        r.date,
      value:       r.value,
      description: r.desc,
      reference:   r.ref || null,
      raw_row:     r._raw || {},
    }));

    const { error } = await client
      .from('bank_transactions')
      .insert(records);

    if (error) {
      console.error('[DB] Erro ao salvar bank_transactions:', error);
      return false;
    }
    return true;
  }

  // ---- Salvar transações do sistema/ERP ----
  async function saveSystemTransactions(rows, importId) {
    const client = getClient();
    if (!client) return false;

    const records = rows.map(r => ({
      import_id:   importId,
      date:        r.date,
      value:       r.value,
      description: r.desc,
      reference:   r.ref || null,
      raw_row:     r._raw || {},
    }));

    const { error } = await client
      .from('system_transactions')
      .insert(records);

    if (error) {
      console.error('[DB] Erro ao salvar system_transactions:', error);
      return false;
    }
    return true;
  }

  // ---- Salvar lote completo (importação + transações) ----
  async function saveImportedRows(rows, sourceType, meta = {}) {
    const client = getClient();
    if (!client) {
      console.warn('[DB] Supabase indisponível — dados apenas em memória.');
      return { success: false, importId: null, message: 'Supabase não configurado' };
    }

    try {
      // 1) Salvar log da importação
      const importId = await saveOCRImport({
        fileName:   meta.fileName || 'desconhecido',
        fileType:   meta.fileType || 'unknown',
        sourceType: sourceType,
        rowCount:   rows.length,
        confidence: meta.confidence || null,
        rawJson:    meta.rawJson   || null,
      });

      if (!importId) {
        return { success: false, importId: null, message: 'Falha ao criar registro de importação' };
      }

      // 2) Salvar transações
      let saved = false;
      if (sourceType === 'bank') {
        saved = await saveBankTransactions(rows, importId);
      } else {
        saved = await saveSystemTransactions(rows, importId);
      }

      return {
        success:  saved,
        importId: importId,
        message:  saved ? `${rows.length} registros salvos no Supabase.` : 'Erro ao salvar transações.',
      };

    } catch (err) {
      console.error('[DB] Erro inesperado:', err);
      return { success: false, importId: null, message: err.message };
    }
  }

  // ---- Carregar últimas importações (histórico) ----
  async function loadRecentImports(limit = 20) {
    const client = getClient();
    if (!client) return [];

    const { data, error } = await client
      .from('ocr_imports')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[DB] Erro ao carregar histórico:', error);
      return [];
    }
    return data || [];
  }

  // ---- Carregar transações de uma importação específica ----
  async function loadTransactionsByImport(importId, sourceType) {
    const client = getClient();
    if (!client) return [];

    const table = sourceType === 'bank' ? 'bank_transactions' : 'system_transactions';

    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('import_id', importId)
      .order('date', { ascending: true });

    if (error) {
      console.error('[DB] Erro ao carregar transações:', error);
      return [];
    }

    // Converter para formato padrão do sistema
    return (data || []).map((r, idx) => ({
      _id:   idx,
      _raw:  r.raw_row || {},
      date:  r.date,
      value: parseFloat(r.value),
      desc:  r.description || '',
      ref:   r.reference   || '',
      _extra: {},
      _dbId:  r.id,
    }));
  }

  // ---- Deletar importação (e cascata nas transações) ----
  async function deleteImport(importId) {
    const client = getClient();
    if (!client) return false;

    const { error } = await client
      .from('ocr_imports')
      .delete()
      .eq('id', importId);

    if (error) {
      console.error('[DB] Erro ao deletar importação:', error);
      return false;
    }
    return true;
  }

  // ---- Status da conexão ----
  async function checkConnection() {
    const client = getClient();
    if (!client) return { ok: false, message: 'Supabase não configurado' };

    try {
      const { error } = await client.from('ocr_imports').select('id').limit(1);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: 'Conectado ao Supabase' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => init());

  return {
    init,
    isAvailable,
    saveImportedRows,
    saveOCRImport,
    saveBankTransactions,
    saveSystemTransactions,
    loadRecentImports,
    loadTransactionsByImport,
    deleteImport,
    checkConnection,
  };
})();
