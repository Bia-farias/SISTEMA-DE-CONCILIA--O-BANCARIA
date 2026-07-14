# setup.ps1 — Script de configuração inicial (Windows PowerShell)
# =================================================================
# Execute no terminal PowerShell na raiz do projeto:
#   .\scripts\setup.ps1
# =================================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Sistema de Conciliação Bancária — Setup Inicial       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar se config.js já existe
$configPath = Join-Path $PSScriptRoot "..\js\config.js"
$examplePath = Join-Path $PSScriptRoot "..\js\config.example.js"

if (Test-Path $configPath) {
    Write-Host "[!] js/config.js já existe." -ForegroundColor Yellow
    $overwrite = Read-Host "    Deseja sobrescrever? (s/N)"
    if ($overwrite -ne 's' -and $overwrite -ne 'S') {
        Write-Host "    Setup cancelado. Seu config.js foi preservado." -ForegroundColor Gray
        exit 0
    }
}

# Copiar template
Copy-Item $examplePath $configPath -Force
Write-Host "[✓] js/config.js criado a partir do template." -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor White
Write-Host "  1. Abra js\config.js e preencha suas chaves de API" -ForegroundColor Gray
Write-Host "  2. GROQ_API_KEY  → https://console.groq.com/keys" -ForegroundColor Gray
Write-Host "  3. SUPABASE_URL + SUPABASE_ANON_KEY → https://supabase.com" -ForegroundColor Gray
Write-Host "  4. Execute o SQL em docs\supabase_schema.sql no painel do Supabase" -ForegroundColor Gray
Write-Host "  5. Abra index.html no navegador (ou use Live Server no VS Code)" -ForegroundColor Gray
Write-Host ""
Write-Host "Guia completo: docs\CONFIGURACAO.md" -ForegroundColor Cyan
Write-Host ""
