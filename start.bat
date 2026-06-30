@echo off
cd /d "%~dp0"
echo 🚀 AI Radar 启动中...
start "" http://localhost:3000
npm run dev
