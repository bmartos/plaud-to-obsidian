@echo off
title PlaudToObsidian Launcher
echo ===================================================
echo   Iniciando PlaudToObsidian...
echo ===================================================
echo.

:: Verificar se o Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao foi encontrado no sistema!
    echo Por favor, instale o Node.js para rodar esta aplicacao.
    echo.
    pause
    exit /b
)

:: Mudar para o diretorio do site
cd /d "%~dp0packages\web"

:: Iniciar o navegador com um atraso de 3 segundos (enquanto o servidor sobe)
echo Abrindo o navegador em http://localhost:3000/dashboard...
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000/dashboard"

:: Rodar o servidor de desenvolvimento
echo Iniciando o servidor de desenvolvimento Next.js...
echo.
npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] O servidor parou ou ocorreu um erro na inicializacao.
    pause
)
