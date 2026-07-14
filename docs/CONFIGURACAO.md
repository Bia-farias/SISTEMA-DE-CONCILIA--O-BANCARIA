# ⚙️ Guia de Configuração e Instalação

Este guia descreve os passos necessários para configurar as integrações de Inteligência Artificial (**Groq API**) e Banco de Dados (**Supabase**) no **Sistema de Conciliação Bancária**.

---

## 🚀 Como Iniciar (Setup Automático)

Para facilitar a configuração inicial, disponibilizamos scripts automatizados de configuração.

### No Windows (PowerShell):
Execute o comando a seguir na pasta raiz do projeto:
```powershell
.\scripts\setup.ps1
```

### No Linux / macOS (Terminal):
Execute o comando a seguir na pasta raiz do projeto:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Esses scripts criarão automaticamente o arquivo `js/config.js` com base no template seguro `js/config.example.js`.

---

## 🔑 Passo 1: Configuração das Credenciais no `js/config.js`

Abra o arquivo `js/config.js` e preencha as variáveis correspondentes com suas chaves reais:

```javascript
const CONFIG = {
  // GROQ – OCR e Visão Computacional por Inteligência Artificial
  GROQ_API_KEY:  'gsk_SUA_CHAVE_GROQ_AQUI',
  GROQ_MODEL:    'meta-llama/llama-4-scout-17b-16e-instruct',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',

  // SUPABASE – Banco de Dados Relacional PostgreSQL
  SUPABASE_URL:      'https://SEU_PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY_AQUI',

  // Configurações de Limites do OCR
  OCR_MAX_PDF_PAGES: 10,
  OCR_MAX_IMAGE_SIZE: 4 * 1024 * 1024,
  PDF_RENDER_SCALE: 2.0
};
```

---

## 🤖 Passo 2: Como Obter a Chave da API Groq

1. Acesse o **Groq Console**: [console.groq.com](https://console.groq.com/)
2. Crie uma conta ou faça login.
3. No menu lateral esquerdo, clique em **API Keys**.
4. Clique em **Create API Key**.
5. Dê um nome à chave (ex: `conciliador-bancario`) e clique em **Create**.
6. Copie a chave gerada (ela começa com `gsk_`) e cole no campo `GROQ_API_KEY` do arquivo `js/config.js`.

---

## 🗄️ Passo 3: Configuração do Supabase (Banco de Dados)

O Supabase fornece uma infraestrutura PostgreSQL instantânea e gratuita de até 500MB, ideal para este projeto.

### 1. Criar o Projeto:
1. Acesse o site do **Supabase**: [supabase.com](https://supabase.com/) e crie uma conta gratuita.
2. No painel de controle, clique em **New Project** (Novo Projeto).
3. Selecione a sua organização, dê um nome para o projeto (ex: `Sistema Conciliacao`), crie uma senha segura para o banco de dados e escolha uma região próxima (ex: `South America (São Paulo)`).
4. Aguarde a finalização da criação do banco de dados (geralmente leva de 1 a 2 minutos).

### 2. Obter as Chaves de Conexão:
1. No painel do seu projeto no Supabase, acesse **Project Settings** (ícone de engrenagem) no menu lateral e depois selecione **API**.
2. Copie a **Project URL** e cole no campo `SUPABASE_URL` do `js/config.js`.
3. Copie a **anon public key** (geralmente começa com `eyJ...` ou `sb_publishable_...`) e cole no campo `SUPABASE_ANON_KEY` do `js/config.js`.

### 3. Criar as Tabelas e Estrutura (SQL):
1. No menu lateral do Supabase, clique em **SQL Editor**.
2. Clique em **New query** para abrir um editor de consultas em branco.
3. Abra o arquivo [`docs/supabase_schema.sql`](file:///c:/Users/Biasf/OneDrive/Área de Trabalho/SISTEMA DE CONCILIAÇÃO BANCARIA/docs/supabase_schema.sql) do projeto.
4. Copie todo o conteúdo do arquivo SQL e cole-o no editor de consultas do Supabase.
5. Clique no botão **Run** (ou pressione `Ctrl + Enter` / `Cmd + Enter`) no canto inferior direito.
6. Você verá uma mensagem indicando sucesso (`Success, no rows returned`).

Pronto! As tabelas `ocr_imports`, `bank_transactions`, `system_transactions` e a View `v_import_summary` foram criadas com políticas de segurança apropriadas para uso anônimo (Anon RLS).

---

## 🛡️ Segurança no GitHub / Git

Por questões de segurança, **nunca envie suas chaves de API para repositórios públicos**. 

- O arquivo `js/config.js` já está adicionado ao arquivo `.gitignore` e não será rastreado pelo Git.
- Caso precise publicar o projeto, certifique-se de manter apenas o `js/config.example.js` e o `.env.example` públicos, para que outros desenvolvedores possam clonar o projeto e configurar as próprias credenciais.
