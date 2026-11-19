@echo off
chcp 65001 >nul
title Server On Thi Trac Nghiem Tin Hoc
echo ==========================================================
echo   DANG KHOI CHAY UNG DUNG ON THI TRAC NGHIEM TIN HOC...
echo   Trinh duyet se tu dong mo tai: http://localhost:3000
echo ==========================================================
start "" "http://localhost:3000"
node server.js
pause
