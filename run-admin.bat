@echo off
title Ajyal Al-Iman - Admin Panel Server
chcp 65001 >nul
echo ===================================================
echo   تشغيل لوحة تحكم أجيال الإيمان (Admin Panel)
echo ===================================================
cd /d "%~dp0ajyal-admin"
npm run dev -- --port 5173 --host
pause
