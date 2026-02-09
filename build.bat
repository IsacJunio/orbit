@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Orbit - Build System v6.4 (No-Admin)

:: ============================================
:: CONFIGURAÇÕES - ATUALIZADO EM 09/02/2026
:: ============================================
set "VERSION=1.5.0"
set "PROJECT_DIR=%~dp0"
set "TEMP_BUILD=C:\temp\OrbitBuild"

cls
echo.
echo    ╔═══════════════════════════════════════════════════════════╗
echo    ║       ORBIT BUILD SYSTEM v6.4 - SEM ADMINISTRADOR         ║
echo    ╠═══════════════════════════════════════════════════════════╣
echo    ║   Versao: %VERSION%                                          ║
echo    ║   Metodo: Build em pasta local (fora do OneDrive)         ║
echo    ║   Data:   09/02/2026                                      ║
echo    ╚═══════════════════════════════════════════════════════════╝
echo.

:: ============================================
:: VERIFICAR AMBIENTE
:: ============================================
echo    [0/7] Verificando ambiente...

:: Verifica se Node está instalado
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo    [!] ERRO: Node.js nao encontrado no PATH
    echo        Instale o Node.js e tente novamente.
    pause
    exit /b 1
)

:: Encerra processos que podem travar arquivos
taskkill /F /IM Orbit.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1

echo    [OK] Ambiente verificado

:: ============================================
:: PREPARAR PASTA TEMPORÁRIA
:: ============================================
echo.
echo    [1/7] Preparando pasta temporaria...

:: Limpa pasta anterior se existir
if exist "%TEMP_BUILD%" rmdir /s /q "%TEMP_BUILD%" 2>nul

:: Cria pasta temporária
mkdir "%TEMP_BUILD%"
if !errorlevel! neq 0 (
    echo    [!] ERRO: Nao foi possivel criar %TEMP_BUILD%
    echo        Tente criar manualmente e rodar novamente.
    pause
    exit /b 1
)

echo    [OK] Pasta criada: %TEMP_BUILD%

:: ============================================
:: COPIAR PROJETO (EXCETO node_modules e pastas grandes)
:: ============================================
echo.
echo    [2/7] Copiando projeto para pasta local...
echo          (Isso pode levar alguns segundos)

:: Copia estrutura essencial
xcopy "%PROJECT_DIR%src" "%TEMP_BUILD%\src" /E /I /Q /Y >nul
xcopy "%PROJECT_DIR%resources" "%TEMP_BUILD%\resources" /E /I /Q /Y >nul
copy "%PROJECT_DIR%package.json" "%TEMP_BUILD%\" /Y >nul
copy "%PROJECT_DIR%package-lock.json" "%TEMP_BUILD%\" /Y >nul 2>nul
copy "%PROJECT_DIR%tsconfig.json" "%TEMP_BUILD%\" /Y >nul
copy "%PROJECT_DIR%tsconfig.node.json" "%TEMP_BUILD%\" /Y >nul 2>nul
copy "%PROJECT_DIR%electron.vite.config.ts" "%TEMP_BUILD%\" /Y >nul
copy "%PROJECT_DIR%tailwind.config.js" "%TEMP_BUILD%\" /Y >nul
copy "%PROJECT_DIR%postcss.config.js" "%TEMP_BUILD%\" /Y >nul
copy "%PROJECT_DIR%generate-icon.mjs" "%TEMP_BUILD%\" /Y >nul

echo    [OK] Projeto copiado

:: ============================================
:: MUDAR PARA PASTA TEMPORÁRIA
:: ============================================
cd /d "%TEMP_BUILD%"

:: ============================================
:: INSTALAR DEPENDÊNCIAS
:: ============================================
echo.
echo    [3/7] Instalando dependencias (npm install)...
echo          (Primeira vez pode demorar alguns minutos)

call npm install --no-audit --no-fund --legacy-peer-deps
if !errorlevel! neq 0 (
    echo    [!] Erro no npm install
    goto :error_exit
)

:: ============================================
:: GERAR ÍCONE
:: ============================================
echo.
echo    [4/7] Gerando icone...
call npm run generate-icon >nul 2>&1
echo    [OK] Icone gerado

:: ============================================
:: COMPILAR APLICAÇÃO
:: ============================================
echo.
echo    [5/7] Compilando aplicacao (Vite)...
call npx electron-vite build
if !errorlevel! neq 0 (
    echo    [!] Erro na compilacao Vite
    goto :error_exit
)

:: ============================================
:: GERAR INSTALADOR
:: ============================================
echo.
echo    [6/7] Gerando instalador e portable...
set "NODE_ENV=production"
set "CSC_IDENTITY_AUTO_DISCOVERY=false"

call npx electron-builder --win --x64 --publish never -c.npmRebuild=false
if !errorlevel! neq 0 (
    echo    [!] Erro no electron-builder
    goto :error_exit
)

:: ============================================
:: COPIAR RESULTADOS DE VOLTA
:: ============================================
echo.
echo    [7/7] Copiando instaladores para pasta original...

:: Garante que a pasta release existe no projeto original
if not exist "%PROJECT_DIR%release" mkdir "%PROJECT_DIR%release"

:: Limpa TODOS os releases antigos (executáveis e yamls)
echo    [*] Limpando arquivos antigos da pasta release...
del /q "%PROJECT_DIR%release\*.exe" 2>nul
del /q "%PROJECT_DIR%release\*.yaml" 2>nul
del /q "%PROJECT_DIR%release\*.yml" 2>nul
del /q "%PROJECT_DIR%release\*.blockmap" 2>nul

:: Copia todos os executáveis gerados
copy "%TEMP_BUILD%\release\*.exe" "%PROJECT_DIR%release\" /Y >nul
copy "%TEMP_BUILD%\release\*.yaml" "%PROJECT_DIR%release\" /Y >nul 2>nul

echo    [OK] Arquivos copiados para: %PROJECT_DIR%release\

:: ============================================
:: SUCESSO
:: ============================================
cls
echo.
echo    ╔═══════════════════════════════════════════════════════════╗
echo    ║                                                           ║
echo    ║       BUILD CONCLUIDO COM SUCESSO!                        ║
echo    ║                                                           ║
echo    ╠═══════════════════════════════════════════════════════════╣
echo    ║                                                           ║
echo    ║   Arquivos gerados em: release\                           ║
echo    ║                                                           ║
echo    ║   - Orbit Setup %VERSION%.exe  (Instalador)                  ║
echo    ║   - Orbit %VERSION%.exe        (Portable)                    ║
echo    ║                                                           ║
echo    ╚═══════════════════════════════════════════════════════════╝
echo.

:: Volta para pasta original
cd /d "%PROJECT_DIR%"

:: Pergunta se quer limpar pasta temporária
set /p cleanup=Deseja limpar a pasta temporaria %TEMP_BUILD%? (S/N): 
if /i "%cleanup%"=="S" rmdir /s /q "%TEMP_BUILD%" 2>nul

set /p choice=Deseja abrir a pasta release? (S/N): 
if /i "%choice%"=="S" explorer "%PROJECT_DIR%release"

goto :end

:: ============================================
:: ERRO
:: ============================================
:error_exit
echo.
echo    ╔═══════════════════════════════════════════════════════════╗
echo    ║   [!] BUILD FALHOU                                        ║
echo    ║                                                           ║
echo    ║   A pasta temporaria foi mantida para debug:              ║
echo    ║   %TEMP_BUILD%
echo    ╚═══════════════════════════════════════════════════════════╝
echo.
cd /d "%PROJECT_DIR%"
pause
exit /b 1

:end
endlocal
exit /b 0
