const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const os = require('os');
const ip = require('ip');
const bonjour = require('bonjour-service')();
const open = require('open');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Настройки
const PORT = 8080;
const APP_NAME = 'EcoGrow Server';
const VERSION = '1.0.0';

// Хранение данных
const espDevices = new Map(); // ESP8266 устройства
const webClients = new Set(); // Веб-клиенты
const deviceData = new Map(); // Данные устройств

// Получаем IP адреса ноутбука
const networkInterfaces = os.networkInterfaces();
let localIP = ip.address();

console.log(`
╔═══════════════════════════════════════════════╗
║            🌱 ECOGROW LOCAL SERVER           ║
║               Версия ${VERSION}                   ║
╚═══════════════════════════════════════════════╝
`);

// WebSocket сервер
wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress.replace('::ffff:', '');
  const url = new URL(req.url, `http://${req.headers.host}`);
  const deviceId = url.searchParams.get('device') || 'ecogrow_default';
  const clientType = url.searchParams.get('type') || 'web';

  console.log(`📡 Новое подключение от ${clientIP}: ${clientType} (${deviceId})`);

  if (clientType === 'esp8266') {
    // Подключение ESP8266
    espDevices.set(deviceId, { ws, ip: clientIP, lastSeen: Date.now() });
    
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to local server',
      server: APP_NAME,
      version: VERSION,
      time: new Date().toISOString()
    }));

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        
        // Обновляем данные устройства
        deviceData.set(deviceId, {
          ...parsed,
          timestamp: Date.now(),
          deviceId: deviceId,
          ip: clientIP
        });

        console.log(`📊 Данные от ${deviceId}:`, parsed);

        // Рассылаем веб-клиентам
        webClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'data',
              device: deviceId,
              data: parsed
            }));
          }
        });
      } catch (error) {
        console.error('❌ Ошибка парсинга данных:', error);
      }
    });

    ws.on('close', () => {
      espDevices.delete(deviceId);
      console.log(`📴 ESP8266 отключился: ${deviceId}`);
    });

    ws.on('error', (error) => {
      console.error(`⚠️ Ошибка WebSocket (ESP):`, error);
    });

  } else {
    // Подключение веб-клиента
    webClients.add(ws);

    // Отправляем приветствие
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to EcoGrow Server',
      server: APP_NAME,
      version: VERSION,
      devices: Array.from(espDevices.keys()),
      localIP: localIP,
      port: PORT
    }));

    // Отправляем текущие данные устройств
    if (deviceData.has(deviceId)) {
      ws.send(JSON.stringify({
        type: 'init',
        device: deviceId,
        data: deviceData.get(deviceId)
      }));
    }

    ws.on('message', (data) => {
      try {
        const command = JSON.parse(data);
        
        if (command.device && espDevices.has(command.device)) {
          const esp = espDevices.get(command.device).ws;
          if (esp.readyState === WebSocket.OPEN) {
            esp.send(JSON.stringify({
              type: 'command',
              command: command.command,
              value: command.value,
              timestamp: Date.now()
            }));
            
            console.log(`📤 Команда для ${command.device}:`, command);
          }
        }
      } catch (error) {
        console.error('❌ Ошибка команды:', error);
      }
    });

    ws.on('close', () => {
      webClients.delete(ws);
      console.log('🌐 Веб-клиент отключился');
    });

    ws.on('error', (error) => {
      console.error(`⚠️ Ошибка WebSocket (web):`, error);
    });
  }
});

// HTTP API
app.use(express.json());
app.use(express.static('public'));

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${APP_NAME} v${VERSION}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; padding: 20px; }
        .card { 
          background: rgba(255,255,255,0.1); 
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 20px;
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .status { 
          display: inline-block;
          padding: 5px 15px;
          background: #10b981;
          border-radius: 20px;
          font-weight: bold;
        }
        .links { margin-top: 20px; }
        .link { 
          display: block;
          background: white;
          color: #667eea;
          padding: 15px;
          border-radius: 10px;
          text-decoration: none;
          margin: 10px 0;
          font-weight: bold;
          transition: transform 0.3s;
        }
        .link:hover { transform: translateY(-2px); }
        .info-grid { 
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }
        .info-item { 
          background: rgba(255,255,255,0.1);
          padding: 15px;
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${APP_NAME}</h1>
          <p>Локальный сервер для системы автоматического полива</p>
          <div class="status">✅ Сервер работает</div>
        </div>
        
        <div class="card">
          <h2>📡 Доступные интерфейсы:</h2>
          <div class="links">
            <a href="http://${localIP}:${PORT}/app" class="link">
              🌐 Основной интерфейс управления
            </a>
            <a href="http://${localIP}:${PORT}/api/status" class="link">
              📊 Статус сервера (JSON)
            </a>
            <a href="http://${localIP}:${PORT}/admin" class="link">
              ⚙️ Панель администратора
            </a>
          </div>
        </div>
        
        <div class="card">
          <h2>🖥️ Информация о сервере:</h2>
          <div class="info-grid">
            <div class="info-item">
              <strong>IP адрес:</strong><br>
              ${localIP}:${PORT}
            </div>
            <div class="info-item">
              <strong>Устройств:</strong><br>
              ${espDevices.size} подключено
            </div>
            <div class="info-item">
              <strong>Версия:</strong><br>
              ${VERSION}
            </div>
            <div class="info-item">
              <strong>Система:</strong><br>
              ${os.platform()} ${os.arch()}
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2>📱 Как подключить ESP8266:</h2>
          <p>В коде ESP8266 укажите:</p>
          <pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; margin: 10px 0;">
const char* server = "${localIP}";
const int port = ${PORT};
WebSocket: ws://${localIP}:${PORT}/?type=esp8266&device=ecogrow_001
          </pre>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Админ-панель
app.get('/admin', (req, res) => {
  const devices = Array.from(espDevices.entries()).map(([id, info]) => ({
    id,
    ip: info.ip,
    lastSeen: new Date(info.lastSeen).toLocaleString(),
    online: info.ws.readyState === 1
  }));
  
  const clients = Array.from(webClients).map((ws, i) => ({
    id: `client_${i}`,
    online: ws.readyState === 1
  }));
  
  res.json({
    server: { name: APP_NAME, version: VERSION, uptime: process.uptime() },
    network: { ip: localIP, port: PORT, hostname: os.hostname() },
    devices: devices,
    webClients: clients,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// API для веб-интерфейса
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: VERSION,
    devices: espDevices.size,
    webClients: webClients.size,
    uptime: process.uptime(),
    serverTime: new Date().toISOString(),
    endpoints: {
      webSocket: `ws://${localIP}:${PORT}`,
      http: `http://${localIP}:${PORT}`,
      api: `http://${localIP}:${PORT}/api`
    }
  });
});

app.get('/api/devices', (req, res) => {
  const devices = Array.from(espDevices.keys()).map(id => ({
    id,
    online: espDevices.get(id).ws.readyState === 1,
    ip: espDevices.get(id).ip,
    lastData: deviceData.get(id) || null
  }));
  
  res.json({ success: true, devices });
});

app.get('/api/data/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const data = deviceData.get(deviceId);
  
  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({ success: false, error: 'Device not found' });
  }
});

app.post('/api/command/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const { command, value } = req.body;
  
  if (espDevices.has(deviceId)) {
    const esp = espDevices.get(deviceId).ws;
    
    if (esp.readyState === 1) {
      esp.send(JSON.stringify({ command, value }));
      res.json({ success: true, message: 'Command sent' });
    } else {
      res.status(503).json({ success: false, error: 'Device not connected' });
    }
  } else {
    res.status(404).json({ success: false, error: 'Device not found' });
  }
});

// Статические файлы веб-интерфейса
app.use('/app', express.static(__dirname + '/web-interface'));

// Запуск сервера
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
✅ Сервер запущен!
───────────────────────────────────────
🌐 Локальный адрес: http://localhost:${PORT}
📡 Сетевой адрес:   http://${localIP}:${PORT}
📱 Для других устройств в сети: http://${localIP}:${PORT}
───────────────────────────────────────
  `);
  
  // Автоматическое открытие в браузере
  open(`http://localhost:${PORT}`);
  
  // Bonjour/Zeroconf для автоматического обнаружения в сети
  bonjour.publish({
    name: 'EcoGrow Server',
    type: 'http',
    port: PORT,
    txt: {
      version: VERSION,
      type: 'ecogrow-server'
    }
  });
  
  console.log('🔍 Сервис обнаружения Bonjour запущен');
});

// Обработка завершения
process.on('SIGINT', () => {
  console.log('\n🛑 Остановка сервера...');
  bonjour.unpublishAll();
  process.exit(0);
});
