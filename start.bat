@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   AI Radar 启动中...
echo.
echo   浏览器已打开等待页，服务就绪后会自动跳转，无需手动刷新。
echo   关闭这个窗口即可停止服务。
echo.
rem 先开等待页而不是直接开 localhost:3000 —— 服务还没起来时
rem 直接打开会撞上浏览器的“无法访问”错误页，只能手动刷新。
start "" "%~dp0launcher.html"
npm run dev
