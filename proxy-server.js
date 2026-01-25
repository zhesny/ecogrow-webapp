const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);

// WebSocket сервер для проксирования
const wss = new WebSocket.Server({ server });

// Хранилище клиентов
const clients = new Map();

app.use(cors());
app.use(express.json());

// Конфигурация
const ESP_CONFIG = {
    LOCAL_URL: 'http://192.168.0.187', // Локальный IP вашего ESP8266
    LOCAL_WS_URL: 'ws://192.168.0.187:81',
    PING_INTERVAL: 30000,
    RECONNECT_DELAY: 5000
};

// Middleware для логирования
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Проверка доступности ESP
async function checkESP() {
    try {
        const response = await axios.get(`${ESP_CONFIG.LOCAL_URL}/api/info`, {
            timeout: 5000
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// HTTP прокси маршруты
app.use('/api/:endpoint', async (req, res) => {
    const { endpoint } = req.params;
    const url = `${ESP_CONFIG.LOCAL_URL}/api/${endpoint}`;
    
    try {
        const espAvailable = await checkESP();
        if (!espAvailable) {
            return res.status(503).json({ 
                error: 'ESP8266 недоступен',
                code: 'ESP_OFFLINE'
            });
        }
        
        const response = await axios({
            method: req.method,
            url: url,
            data: req.body,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Ошибка проксирования:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            res.status(503).json({ 
                error: 'Не удалось подключиться к ESP8266',
                code: 'CONNECTION_FAILED'
            });
        } else if (error.code === 'ETIMEDOUT') {
            res.status(504).json({ 
                error: 'Таймаут подключения',
                code: 'TIMEOUT'
            });
        } else {
            res.status(500).json({ 
                error: 'Внутренняя ошибка сервера',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});

// WebSocket проксирование
wss.on('connection', (ws, req) => {
    const clientId = Date.now();
    console.log(`Новое WebSocket подключение: ${clientId}`);
    
    let espWs = null;
    let pingInterval;
    
    // Подключаемся к ESP
    function connectToESP() {
        espWs = new WebSocket(ESP_CONFIG.LOCAL_WS_URL);
        
        espWs.on('open', () => {
            console.log(`Подключено к ESP WebSocket через клиента ${clientId}`);
            ws.send(JSON.stringify({ type: 'connected', message: 'Подключено к системе' }));
            
            // Отправляем пинги для поддержания соединения
            pingInterval = setInterval(() => {
                if (espWs.readyState === WebSocket.OPEN) {
                    espWs.send(JSON.stringify({ type: 'ping' }));
                }
            }, ESP_CONFIG.PING_INTERVAL);
        });
        
        espWs.on('message', (data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data.toString());
            }
        });
        
        espWs.on('close', () => {
            console.log(`Соединение с ESP разорвано для клиента ${clientId}`);
            clearInterval(pingInterval);
            
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    type: 'disconnected', 
                    message: 'Потеряно соединение с системой' 
                }));
            }
            
            // Пытаемся переподключиться
            setTimeout(connectToESP, ESP_CONFIG.RECONNECT_DELAY);
        });
        
        espWs.on('error', (error) => {
            console.error(`Ошибка WebSocket ESP для клиента ${clientId}:`, error.message);
        });
    }
    
    // Перенаправление сообщений от клиента к ESP
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Если это команда управления, отправляем на ESP
            if (espWs && espWs.readyState === WebSocket.OPEN) {
                espWs.send(JSON.stringify(data));
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });
    
    ws.on('close', () => {
        console.log(`Клиент ${clientId} отключился`);
        clearInterval(pingInterval);
        
        if (espWs) {
            espWs.close();
        }
    });
    
    // Начинаем подключение к ESP
    connectToESP();
});

// Статистика сервера
app.get('/api/proxy/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        clients: wss.clients.size,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Обслуживание фронтенда (если нужно)
app.use(express.static('public'));

// Главная страница
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>EcoGrow Proxy Server</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .status { padding: 20px; border-radius: 5px; }
                .online { background: #d4edda; color: #155724; }
                .offline { background: #f8d7da; color: #721c24; }
            </style>
        </head>
        <body>
            <h1>🌱 EcoGrow Proxy Server</h1>
            <p>Этот сервер проксирует запросы к вашей системе EcoGrow</p>
            
            <div class="status online">
                <h3>✅ Сервер работает</h3>
                <p>Время: ${new Date().toLocaleString()}</p>
                <p>Клиентов WebSocket: ${wss.clients.size}</p>
            </div>
            
            <h3>Эндпоинты API:</h3>
            <ul>
                <li><code>GET /api/proxy/status</code> - статус прокси-сервера</li>
                <li><code>GET /api/state</code> - состояние системы</li>
                <li><code>POST /api/control</code> - управление системой</li>
                <li><code>POST /api/settings</code> - настройки системы</li>
                <li><code>WebSocket /</code> - реальное время обновлений</li>
            </ul>
            
            <h3>Для фронтенда:</h3>
            <p>Используйте URL: <code>${req.protocol}://${req.get('host')}/api</code></p>
        </body>
        </html>
    `);
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({ 
        error: 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Прокси-сервер запущен на порту ${PORT}`);
    console.log(`🌐 URL для фронтенда: http://localhost:${PORT}/api`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
});

// Проверка ESP при запуске
checkESP().then(available => {
    if (available) {
        console.log('✅ ESP8266 доступен в локальной сети');
    } else {
        console.log('⚠️ ESP8266 недоступен. Проверьте подключение.');
    }
});
