@echo off
chcp 65001 >nul
title RPG Master - servidor da mesa online
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao foi encontrado neste computador.
  echo  Baixe e instale ^(gratis, versao LTS^) em https://nodejs.org e abra este arquivo de novo.
  echo.
  pause
  exit /b
)
node server/servidor.js
pause
