-- ================================================================
-- SCHEMA SQL – Sistema de Conciliação Bancária
-- Execute este script no painel SQL Editor do Supabase
-- Painel: https://supabase.com → seu projeto → SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Tabela de log de importações OCR
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ocr_imports (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid,  -- referência ao usuário (se usar auth Supabase)
  file_name   text NOT NULL,
  file_type   text NOT NULL CHECK (file_type IN ('pdf','jpg','jpeg','png','csv','xlsx')),
  source_type text NOT NULL CHECK (source_type IN ('bank','system')),
  row_count   integer DEFAULT 0,
  confidence  numeric(5,2),   -- % de confiança do OCR (0-100)
  raw_json    jsonb,           -- metadados da extração
  imported_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------
-- 2. Tabela de transações do extrato bancário
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id   uuid REFERENCES ocr_imports(id) ON DELETE CASCADE,
  user_id     uuid,
  date        date,
  value       numeric(15,2),
  description text,
  reference   text,
  raw_row     jsonb,           -- linha bruta original
  created_at  timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------
-- 3. Tabela de transações do sistema/ERP
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id   uuid REFERENCES ocr_imports(id) ON DELETE CASCADE,
  user_id     uuid,
  date        date,
  value       numeric(15,2),
  description text,
  reference   text,
  raw_row     jsonb,
  created_at  timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------
-- 4. Índices para performance
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bank_transactions_import_id   ON bank_transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date        ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user        ON bank_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_system_transactions_import_id ON system_transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_system_transactions_date      ON system_transactions(date);
CREATE INDEX IF NOT EXISTS idx_system_transactions_user      ON system_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_ocr_imports_user              ON ocr_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_imports_imported_at       ON ocr_imports(imported_at DESC);

-- ----------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- OPCIONAL: Ative se quiser que cada usuário veja apenas seus dados.
-- Se não usar autenticação Supabase, comente as linhas abaixo.
-- ----------------------------------------------------------------

-- ALTER TABLE ocr_imports         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bank_transactions   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE system_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: usuário autenticado vê/edita apenas seus dados
-- CREATE POLICY "users_own_imports" ON ocr_imports
--   FOR ALL TO authenticated
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- CREATE POLICY "users_own_bank_txs" ON bank_transactions
--   FOR ALL TO authenticated
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- CREATE POLICY "users_own_system_txs" ON system_transactions
--   FOR ALL TO authenticated
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 6. Policy para acesso anônimo (se NÃO usar RLS)
-- Necessário se o sistema não usa autenticação Supabase
-- ----------------------------------------------------------------
ALTER TABLE ocr_imports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_transactions ENABLE ROW LEVEL SECURITY;

-- Permite acesso total com a anon key (sem autenticação)
CREATE POLICY "anon_full_access_imports" ON ocr_imports
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_bank" ON bank_transactions
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_system" ON system_transactions
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 7. View útil: importações com contagem de transações
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_import_summary AS
SELECT
  i.id,
  i.file_name,
  i.file_type,
  i.source_type,
  i.row_count,
  i.confidence,
  i.imported_at,
  COALESCE(b.count, 0) AS bank_count,
  COALESCE(s.count, 0) AS system_count
FROM ocr_imports i
LEFT JOIN (
  SELECT import_id, COUNT(*) AS count FROM bank_transactions GROUP BY import_id
) b ON b.import_id = i.id
LEFT JOIN (
  SELECT import_id, COUNT(*) AS count FROM system_transactions GROUP BY import_id
) s ON s.import_id = i.id
ORDER BY i.imported_at DESC;
