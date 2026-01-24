// config.js - Конфигурация приложения
const DEFAULT_CONFIG = {
    // Базовый URL для локального тестирования
    ESP_BASE_URL: "http://192.168.1.100",
    
    // Порт ESP8266
    PORT: 80,
    
    // Интервал обновления данных (мс)
    UPDATE_INTERVAL: 3000,
    
    // Таймаут запросов (мс)
    TIMEOUT: 5000,
    
    // Сохранение настроек в localStorage
    SAVE_SETTINGS: true
};

// Получение сохраненной конфигурации из localStorage
function getConfig() {
    const saved = localStorage.getItem('ecogrow_config');
    if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
    return DEFAULT_CONFIG;
}

// Сохранение конфигурации в localStorage
function saveConfig(config) {
    localStorage.setItem('ecogrow_config', JSON.stringify(config));
}

// Обновление конфигурации
function updateConfig(newConfig) {
    const current = getConfig();
    const updated = { ...current, ...newConfig };
    saveConfig(updated);
    return updated;
}

// Получение полного URL API
function getApiUrl(endpoint = '') {
    const config = getConfig();
    const base = config.ESP_BASE_URL.replace(/\/$/, ''); // Удаляем слеш в конце
    const port = config.PORT === 80 ? '' : `:${config.PORT}`;
    return `${base}${port}${endpoint}`;
}

// Эндпоинты API
const API_ENDPOINTS = {
    STATE: () => getApiUrl('/state'),
    SETTINGS: () => getApiUrl('/settings'),
    PUMP: () => getApiUrl('/pump'),
    PUMP_AUTO: () => getApiUrl('/pump/auto'),
    PUMP_WATER: () => getApiUrl('/pump/water'),
    LIGHT: () => getApiUrl('/light'),
    LIGHT_AUTO: () => getApiUrl('/light/auto'),
    ERRORS_CLEAR: () => getApiUrl('/errors/clear'),
    TIME_MODE: () => getApiUrl('/time/mode'),
    TIME_SET: () => getApiUrl('/time/set')
};

// Экспорт функций для использования в script.js
window.getConfig = getConfig;
window.saveConfig = saveConfig;
window.updateConfig = updateConfig;
window.getApiUrl = getApiUrl;
window.API_ENDPOINTS = API_ENDPOINTS;
