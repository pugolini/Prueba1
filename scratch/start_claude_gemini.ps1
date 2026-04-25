# Script para iniciar Claude Code con Gemini (Browser Login)
# Requisitos: gcloud auth application-default login

$env:ANTHROPIC_BASE_URL = "http://localhost:4000"
$env:ANTHROPIC_AUTH_TOKEN = "sk-ant-dummy-token-for-proxy"
$env:ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"

Write-Host "--- Iniciando Proxy LiteLLM (Gemini) ---" -ForegroundColor Cyan
Start-Process litellm -ArgumentList "--config ./scratch/gemini_proxy.yaml --port 4000" -NoNewWindow

Write-Host "--- Iniciando Claude Code ---" -ForegroundColor Green
claude
