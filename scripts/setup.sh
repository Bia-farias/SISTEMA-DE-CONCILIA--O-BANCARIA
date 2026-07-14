#!/bin/bash
# setup.sh — Script de configuração inicial (Linux / macOS)
# =================================================================
# Execute no terminal na raiz do projeto:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
# =================================================================

# Cores para o terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Sistema de Conciliação Bancária — Setup Inicial       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo -e ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="$SCRIPT_DIR/../js/config.js"
EXAMPLE_PATH="$SCRIPT_DIR/../js/config.example.js"

if [ -f "$CONFIG_PATH" ]; then
    echo -e "${YELLOW}[!] js/config.js já existe.${NC}"
    read -p "    Deseja sobrescrever? (s/N): " overwrite
    if [[ "$overwrite" != "s" && "$overwrite" != "S" ]]; then
        echo -e "${GRAY}    Setup cancelado. Seu config.js foi preservado.${NC}"
        exit 0
    fi
fi

# Copiar template
cp "$EXAMPLE_PATH" "$CONFIG_PATH"
echo -e "${GREEN}[✓] js/config.js criado a partir do template.${NC}"
echo -e ""
echo -e "Próximos passos:"
echo -e "  1. Abra js/config.js e preencha suas chaves de API"
echo -e "  2. GROQ_API_KEY  → https://console.groq.com/keys"
echo -e "  3. SUPABASE_URL + SUPABASE_ANON_KEY → https://supabase.com"
echo -e "  4. Execute o SQL em docs/supabase_schema.sql no painel do Supabase"
echo -e "  5. Abra index.html no navegador (ou use Live Server no VS Code)"
echo -e ""
echo -e "${CYAN}Guia completo: docs/CONFIGURACAO.md${NC}"
echo -e ""
