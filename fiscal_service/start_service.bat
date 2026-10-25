@echo off
echo ===================================================
echo   Iniciando Zenite OS - Micro-servico Fiscal (NF-e)
echo ===================================================
cd /d "%~dp0"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
