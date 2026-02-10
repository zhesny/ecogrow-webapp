const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Настройка автозапуска сервера...');

// Создаем bat файл для запуска
const batContent = `@echo off
echo 🚀 Запуск EcoGrow Local Server...
cd "${__dirname}"
npm start
pause`;

fs.writeFileSync('start-server.bat', batContent);

// Команда для добавления в автозагрузку (Windows)
const startupPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'EcoGrow Server.lnk');

console.log(`
✅ Готово!

📋 Инструкция:
1. Для запуска сервера двойным кликом: start-server.bat
2. Для автозапуска при включении компьютера:
   - Нажмите Win+R
   - Введите: shell:startup
   - Скопируйте start-server.bat в открывшуюся папку

🌐 После запуска откройте: http://localhost:8080
📱 Для других устройств: http://[IP-ноутбука]:8080
`);

exec('explorer .'); // Открыть текущую папку
