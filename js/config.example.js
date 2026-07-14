/**
 * config.example.js — Template de configuração
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  INSTRUÇÕES DE CONFIGURAÇÃO                              ║
 * ║                                                          ║
 * ║  1. Copie este arquivo:                                  ║
 * ║     cp js/config.example.js js/config.js                 ║
 * ║     (Windows: copy js\config.example.js js\config.js)    ║
 * ║                                                          ║
 * ║  2. Preencha suas chaves em js/config.js                 ║
 * ║                                                          ║
 * ║                                                          ║
 * ║  Guia completo: docs/CONFIGURACAO.md                     ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Obter chaves:
 *   Groq:     https://console.groq.com/keys
 *   Supabase: https://supabase.com → projeto → Settings → API
 */

const CONFIG = {

  // -------------------------------------------------------------------
  // GROQ — OCR / Leitura de documentos por IA (Llama 4 Scout)
  // -------------------------------------------------------------------
  GROQ_API_KEY: 'gsk_COLE_SUA_CHAVE_GROQ_AQUI',
  GROQ_MODEL: 'meta-llama/llama-4-scout-17b-16e-instruct',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',

  // -------------------------------------------------------------------
  // SUPABASE — Banco de Dados PostgreSQL
  // -------------------------------------------------------------------
  SUPABASE_URL: 'https://SEU_PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'COLE_SUA_ANON_KEY_AQUI',

  // -------------------------------------------------------------------
  // Configurações de comportamento OCR (ajuste conforme necessário)
  // -------------------------------------------------------------------

  /** Máximo de páginas de PDF processadas por importação */
  OCR_MAX_PDF_PAGES: 10,

  /** Tamanho máximo da imagem base64 enviada ao Groq (4MB = limite da API) */
  OCR_MAX_IMAGE_SIZE: 4 * 1024 * 1024,

  /** Escala de renderização do PDF → imagem (2.0 = boa qualidade, ~200 DPI) */
  PDF_RENDER_SCALE: 2.0,
};
