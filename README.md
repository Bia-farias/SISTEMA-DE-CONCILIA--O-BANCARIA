<div align="center">

# 🏦 Sistema de Conciliação Bancária

### Conciliação bancária **inteligente** e automática com IA

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <strong>Reduza até 90% do trabalho manual</strong> com nosso motor de conciliação que compara automaticamente extratos bancários com seus registros internos usando inteligência artificial.
</p>

<br/>

[🚀 **Demo ao Vivo**](https://bia-farias.github.io/SISTEMA-DE-CONCILIA--O-BANCARIA/) · [📋 Features](#-features) · [🛠️ Tech Stack](#️-tech-stack) · [📖 Como Usar](#-como-usar)

<br/>

</div>

---

## 📸 Screenshots

<div align="center">

### Tela de Login
<img src="docs/screenshot-login.png" alt="Tela de Login" width="100%">

<br/><br/>

### Dashboard
<img src="docs/screenshot-dashboard.png" alt="Dashboard" width="100%">

</div>

---

## ✨ Features

### 🔄 Motor de Conciliação Automática
- **7 estratégias de comparação** — conciliação exata, tolerância de data, similaridade de texto, faixa de valor, detecção de duplicidades, agrupamento e sugestões de IA
- **4 modos de reconciliação** — 1:1 (padrão), N:1 (agrupamento ERP), 1:N (agrupamento banco), N:N (completo)
- **Subset Sum Algorithm** — encontra combinações de lançamentos que totalizam um valor correspondente
- **Configuração flexível** — tolerância de data (dias) e valor (%) ajustáveis

### 🤖 Inteligência Artificial & OCR
- **Groq Vision (Llama 4 Scout)** — Leitura inteligente de imagens e documentos
- **Extração inteligente de tabelas** de PDFs escaneados ou digitais, imagens e fotos (JPEG/PNG)
- Score de confiança em tempo real para cada correspondência e célula extraída
- Sugestões inteligentes baseadas em padrões de texto e valor
- Similaridade de texto com algoritmo de distância de Levenshtein
- Aprendizado de padrões de conciliação anteriores

### 📊 Dashboard Gerencial
- KPIs em tempo real (conciliados, pendentes, divergentes)
- Gráficos interativos com Chart.js (tendências e distribuição)
- Atividade recente e notificações
- Saudação dinâmica por horário do dia

### 📁 Importação Multi-formato
- **PDF, JPEG e PNG** — Processamento inteligente de extratos em papel/fotos e relatórios em PDF
- **OFX/QFX** — Extrato bancário padrão digital
- **CSV** — Arquivos delimitados com detecção automática de separador
- **XLSX/XLS** — Planilhas Excel
- Drag & drop para upload de arquivos
- Parser inteligente com normalização automática de datas e valores

### 🗄️ Integração Cloud & Banco de Dados
- **Supabase (PostgreSQL)** — Persistência real de transações e logs de importação na nuvem
- RLS (Row Level Security) configurado para garantir a integridade dos dados
- Autenticação e logs persistentes de auditoria

### 📄 Relatórios e Exportação
- Histórico de todas as sessões de conciliação
- Exportação para **Excel** (.xlsx) com formatação profissional
- Exportação para **PDF** com tabelas e resumo
- Filtros por status, busca textual e detalhamento por sessão

### 👥 Gestão de Usuários e Segurança
- **3 perfis de acesso**: Administrador, Analista, Auditor
- RBAC (Role-Based Access Control) com permissões granulares
- Autenticação com hash SHA-256 (Web Crypto API)
- Sessões com expiração automática (8h)
- Log de auditoria completo

### 🎨 Design Premium
- Dark theme com glassmorphism e micro-animações
- Design system com CSS custom properties (60+ tokens)
- Layout responsivo (desktop, tablet, mobile)
- Fonte Inter com tipografia profissional
- Scrollbar e componentes customizados

---

## 🛠️ Tech Stack

| Tecnologia | Uso |
|---|---|
| **HTML5 / CSS3** | Estrutura semântica, Design System, Glassmorphism e responsividade |
| **JavaScript (ES6+)** | Lógica de negócio modularizada e interações dinâmicas |
| **Groq API** | OCR de documentos e visão computacional (Llama 4 Scout) |
| **Supabase** | Banco de dados PostgreSQL em nuvem para armazenamento persistente |
| **PDF.js** | Renderização e processamento local de documentos PDF |
| **Chart.js** | Gráficos interativos (tendência, donut) |
| **PapaParse** | Parser rápido de CSV |
| **SheetJS** | Leitura e escrita de XLSX/XLS |
| **jsPDF** | Geração e exportação de relatórios em PDF |

> 💡 **Client-Side Integrado** — A lógica principal do frontend roda no navegador do usuário, comunicando-se de forma segura e rápida com as APIs e banco de dados Cloud.

---

## 📖 Como Usar

### 💻 Instalação e Execução Local

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Bia-farias/SISTEMA-DE-CONCILIA--O-BANCARIA.git
   cd SISTEMA-DE-CONCILIA--O-BANCARIA
   ```

2. **Execute o script de configuração inicial:**
   - **No Windows (PowerShell):**
     ```powershell
     .\scripts\setup.ps1
     ```
   - **No Linux / macOS (Terminal):**
     ```bash
     chmod +x scripts/setup.sh
     ./scripts/setup.sh
     ```

3. **Configure suas credenciais:**
   Abra o arquivo recém-criado `js/config.js` e cole suas chaves da API **Groq** e **Supabase**.
   *(Siga o guia detalhado em [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)).*

4. **Crie as tabelas no Supabase:**
   Copie e execute o script SQL de [`docs/supabase_schema.sql`](docs/supabase_schema.sql) no SQL Editor do seu projeto Supabase.

5. **Abra o sistema:**
   Abra `index.html` no seu navegador (recomendamos utilizar a extensão **Live Server** no VS Code para desenvolvimento).

---

## 📁 Arquitetura

```
📦 SISTEMA-DE-CONCILIAÇÃO-BANCARIA
├── 📄 index.html            # Tela de Login
├── 📄 dashboard.html        # Dashboard com KPIs e gráficos
├── 📄 conciliacao.html      # Workspace de conciliação (Uploads, OCR & Resultados)
├── 📄 relatorios.html       # Histórico e exportação de relatórios
├── 📄 usuarios.html         # Gestão de usuários do sistema (admin)
│
├── 📁 css/
│   ├── 🎨 global.css        # Design system (tokens, reset, componentes base)
│   ├── 🎨 auth.css          # Estilos da tela de login
│   ├── 🎨 components.css    # Sidebar, header, cards, charts, OCR steps
│   ├── 🎨 conciliacao.css   # Upload, preview, resultados da conciliação
│   └── 🎨 dashboard.css     # KPIs, welcome, gráficos do dashboard
│
├── 📁 js/
│   ├── 🔑 config.js         # Configurações de chaves privadas (ignorado pelo Git)
│   ├── 🔑 config.example.js # Template de configuração de chaves para desenvolvedores
│   ├── ⚙️ storage.js        # Persistência local (localStorage) + Logs de Auditoria
│   ├── 🔐 auth.js           # Controle de autenticação, sessão e RBAC
│   ├── 🗄️ db.js             # Módulo de integração e consultas ao Supabase DB
│   ├── 🤖 ocr.js            # Módulo de processamento de imagem/PDF via Groq Vision
│   ├── 🔧 normalizer.js     # Normalização de datas, valores monetários e textos
│   ├── 📂 parser.js         # Parser para OFX, CSV, XLSX, XLS e gerador de dados demo
│   ├── 🧠 ai.js             # Motor de comparação inteligente (similaridade, sugestões)
│   ├── 📦 grouping.js       # Agrupamento (N:1, 1:N, N:N) e algoritmo Subset Sum
│   ├── 🔄 engine.js         # Motor geral de conciliação (7 estratégias sequenciais)
│   ├── 📊 charts.js         # Geração de gráficos do Chart.js
│   ├── 📄 reports.js        # Utilitários de exportação de dados (Excel + PDF)
│   ├── 🖥️ app.js            # Controladores de UI, Toasts, Sidebar, Notificações
│   └── 👥 usuarios.js       # CRUD e gerenciamento de permissões de usuários
│
├── 📁 docs/
│   ├── 📄 CONFIGURACAO.md   # Guia detalhado de setup do Supabase e Groq
│   ├── 🗄️ supabase_schema.sql# Estrutura de tabelas e views para o PostgreSQL
│   ├── 🖼️ screenshot-login.png
│   └── 🖼️ screenshot-dashboard.png
│
├── 📁 scripts/
│   ├── 📜 setup.ps1         # Script de setup de configuração para Windows
│   └── 📜 setup.sh          # Script de setup de configuração para Linux/macOS
│
├── 📄 .env.example          # Template das variáveis de ambiente
├── 📄 .gitignore            # Regras de ocultação de arquivos sensíveis
├── 📄 LICENSE               # MIT License
└── 📄 README.md             # Documentação principal
```

---

## 🔒 Segurança

- Chaves de API mantidas de forma segura em arquivos ignorados pelo Git (`js/config.js` e `.env`).
- Senhas criptografadas com **SHA-256** utilizando a API nativa Web Crypto.
- Sessões protegidas no navegador com expiração automática de **8 horas**.
- **RBAC (Role-Based Access Control)** com três níveis hierárquicos distintos (Administrador, Analista e Auditor).
- Whitelist de propriedades em payloads de usuários para evitar escalação de privilégios.
- Log de auditoria persistente monitorando todas as ações críticas dos usuários.

---

## 📝 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

<div align="center">

**Feito com 💙 por [Bia Farias](https://github.com/Bia-farias)**

⭐ Se este projeto foi útil, considere dar uma estrela no repositório!

</div>

