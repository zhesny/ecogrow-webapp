// config.js
const CONFIG = {
    // Если используете прокси-сервер
    API_URL: 'https://ваш-прокси-сервер.herokuapp.com/api',
    // Если напрямую к ESP (только в локальной сети)
    LOCAL_API_URL: 'http://ecogrow-api.local/api',
    LOCAL_WS_URL: 'ws://ecogrow-api.local:81',
    
    // Настройки по умолчанию
    DEFAULT_SETTINGS: {
        moisture_threshold: 50,
        watering_delay: 30,
        watering_duration: 10,
        manual_pump_time: 10,
        manual_light_time: 1,
        lamp_enabled: true,
        lamp_start: '08:00',
        lamp_end: '20:00',
        sleep_enabled: false,
        sleep_start: '23:00',
        sleep_end: '07:00'
    },
    
    // Стили
    THEME: {
        primary: '#27ae60',
        secondary: '#3498db',
        danger: '#e74c3c',
        warning: '#f39c12',
        success: '#2ecc71'
    }
};

// Определяем, локальный ли доступ
function isLocalNetwork() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.endsWith('.local');
}

// Получаем текущий URL API
function getApiUrl() {
    if (isLocalNetwork()) {
        return CONFIG.LOCAL_API_URL;
    }
    return CONFIG.API_URL;
}

function getWsUrl() {
    if (isLocalNetwork()) {
        return CONFIG.LOCAL_WS_URL;
    }
    // Для облачного доступа WebSocket через прокси
    return CONFIG.API_URL.replace('http', 'ws') + '/ws';
}

export { CONFIG, getApiUrl, getWsUrl, isLocalNetwork };
