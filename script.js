// script.js - Основная логика приложения
let currentTheme = localStorage.getItem('theme') || 'light';
let chart = null;
let isConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = 3;
let updateInterval;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('EcoGrow Web Interface v1.0');
    
    // Восстановление сохраненного адреса ESP
    const config = getConfig();
    document.getElementById('esp_address').value = config.ESP_BASE_URL;
    
    // Инициализация темы
    initTheme();
    
    // Инициализация графика
    initChart();
    
    // Инициализация обработчиков событий
    initEventListeners();
    
    // Автоподключение при загрузке
    setTimeout(() => {
        connectToESP();
    }, 1000);
    
    // Запуск периодического обновления
    startAutoUpdate();
});

// Инициализация темы
function initTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
        const icon = currentTheme === 'dark' ? '☀️' : '🌙';
        const text = currentTheme === 'dark' ? ' Светлая тема' : ' Тёмная тема';
        btn.innerHTML = `<i class="fas ${currentTheme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>${text}`;
    }
}

// Инициализация графика
function initChart() {
    const ctx = document.getElementById('moist_chart');
    if (!ctx) {
        console.error('Canvas элемент не найден');
        return;
    }
    
    chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: Array(80).fill(''),
            datasets: [{
                label: 'Влажность %',
                data: Array(80).fill(0),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointBackgroundColor: 'transparent',
                pointBorderColor: 'transparent'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 13 },
                    padding: 10,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { 
                        color: function(context) {
                            return currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                        }
                    },
                    ticks: {
                        color: function(context) {
                            return currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d';
                        },
                        font: { size: 11 },
                        padding: 5
                    }
                },
                x: { display: false }
            },
            interaction: { intersect: false },
            animation: { duration: 800 }
        }
    });
}

// Подключение к ESP8266
async function connectToESP() {
    const addressInput = document.getElementById('esp_address').value.trim();
    
    // Валидация URL
    if (!addressInput) {
        showNotification('⚠️ Введите адрес ESP8266', 'warning');
        return;
    }
    
    // Добавляем протокол если отсутствует
    let espAddress = addressInput;
    if (!espAddress.startsWith('http://') && !espAddress.startsWith('https://')) {
        espAddress = 'http://' + espAddress;
        document.getElementById('esp_address').value = espAddress;
    }
    
    // Обновляем конфигурацию
    updateConfig({ ESP_BASE_URL: espAddress });
    
    showNotification('🔌 Подключаемся к ESP8266...', 'info');
    
    // Тестируем подключение
    try {
        const testUrl = getApiUrl('/state');
        console.log('Попытка подключения к:', testUrl);
        
        const response = await axios.get(testUrl, {
            timeout: getConfig().TIMEOUT,
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.status === 200) {
            isConnected = true;
            connectionRetries = 0;
            updateConnectionStatus(true);
            showNotification('✅ Успешно подключено к ESP8266', 'success');
            
            // Загружаем начальное состояние
            fetchState();
            
            return true;
        }
    } catch (error) {
        console.error('Ошибка подключения:', error);
        isConnected = false;
        connectionRetries++;
        updateConnectionStatus(false);
        
        if (connectionRetries <= MAX_RETRIES) {
            showNotification(`❌ Ошибка подключения (попытка ${connectionRetries}/${MAX_RETRIES})`, 'error');
            setTimeout(() => connectToESP(), 2000);
        } else {
            showNotification('❌ Не удалось подключиться к ESP8266', 'error');
        }
        return false;
    }
}

// Обновление статуса подключения
function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('connection_dot');
    const statusText = document.getElementById('connection_status');
    
    if (connected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Подключено';
        statusText.style.color = '#27ae60';
    } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Отключено';
        statusText.style.color = '#e74c3c';
    }
}

// Запрос состояния системы
async function fetchState() {
    if (!isConnected) return;
    
    try {
        const response = await axios.get(API_ENDPOINTS.STATE(), {
            timeout: getConfig().TIMEOUT
        });
        
        if (response.status === 200) {
            updateUI(response.data);
        }
    } catch (error) {
        console.error('Ошибка получения состояния:', error);
        if (error.code === 'ECONNABORTED' || error.response?.status === 0) {
            isConnected = false;
            updateConnectionStatus(false);
            showNotification('❌ Потеряно соединение с ESP8266', 'error');
        }
    }
}

// Обновление интерфейса
function updateUI(data) {
    // Обновляем влажность
    if (data.moisture !== undefined) {
        document.getElementById('moist_status').textContent = data.moisture + '%';
        document.getElementById('current_moist').textContent = data.moisture + '%';
        document.getElementById('avg_moist').textContent = data.avg_moisture + '%';
        document.getElementById('min_moist').textContent = data.min_moisture + '%';
    }
    
    // Обновляем статус насоса
    if (data.pump !== undefined) {
        const pumpSwitch = document.getElementById('pump_switch');
        const pumpStatus = document.getElementById('pump_status');
        if (pumpSwitch && pumpStatus) {
            pumpSwitch.checked = data.pump;
            pumpStatus.textContent = data.pump ? 'ВКЛ' : 'ВЫКЛ';
            pumpStatus.className = 'status-badge ' + (data.pump ? 'status-on' : 'status-off');
            document.getElementById('pump_mode').textContent = 'Режим: ' + (data.manual_pump ? 'РУЧНОЙ' : 'АВТО');
        }
    }
    
    // Обновляем статус света
    if (data.light !== undefined) {
        const lightSwitch = document.getElementById('light_switch');
        const lightStatus = document.getElementById('light_status');
        if (lightSwitch && lightStatus) {
            lightSwitch.checked = data.light;
            lightStatus.textContent = data.light ? 'ВКЛ' : 'ВЫКЛ';
            lightStatus.className = 'status-badge ' + (data.light ? 'status-on' : 'status-off');
            document.getElementById('light_mode').textContent = 'Режим: ' + (data.manual_light ? 'РУЧНОЙ' : 'АВТО');
        }
    }
    
    // Обновляем режим сна
    if (data.sleep_enabled !== undefined) {
        document.getElementById('sleep_enabled').checked = data.sleep_enabled;
        const sleepStatus = document.getElementById('sleep_status');
        
        const now = new Date();
        const sleepActive = data.sleep_enabled && timeInRange(now, data.sleep_start, data.sleep_end);
        sleepStatus.textContent = sleepActive ? 'Активен' : 'Неактивен';
        sleepStatus.className = 'status-badge ' + (sleepActive ? 'status-on' : 'status-off');
    }
    
    // Обновляем настройки
    if (data.moisture_threshold !== undefined) {
        document.getElementById('moist_threshold').value = data.moisture_threshold;
        document.getElementById('thresh_val').textContent = data.moisture_threshold + '%';
    }
    
    if (data.watering_delay !== undefined) {
        document.getElementById('watering_delay').value = data.watering_delay;
    }
    
    if (data.watering_duration !== undefined) {
        document.getElementById('watering_duration').value = data.watering_duration;
    }
    
    if (data.manual_pump_time !== undefined) {
        document.getElementById('manual_pump_time').value = data.manual_pump_time;
    }
    
    if (data.manual_light_time !== undefined) {
        document.getElementById('manual_light_time').value = data.manual_light_time;
    }
    
    if (data.lamp_start !== undefined) {
        document.getElementById('lamp_start').value = data.lamp_start;
    }
    
    if (data.lamp_end !== undefined) {
        document.getElementById('lamp_end').value = data.lamp_end;
    }
    
    if (data.lamp_enabled !== undefined) {
        document.getElementById('lamp_enabled').checked = data.lamp_enabled;
    }
    
    if (data.sleep_start !== undefined) {
        document.getElementById('sleep_start').value = data.sleep_start;
    }
    
    if (data.sleep_end !== undefined) {
        document.getElementById('sleep_end').value = data.sleep_end;
    }
    
    if (data.sleep_enabled !== undefined) {
        document.getElementById('sleep_enabled').checked = data.sleep_enabled;
    }
    
    if (data.time_manual !== undefined) {
        document.getElementById('time_manual').checked = data.time_manual;
    }
    
    // Обновляем статистику
    if (data.total_waterings !== undefined) {
        document.getElementById('total_waterings').textContent = data.total_waterings;
    }
    
    if (data.total_light_hours !== undefined) {
        document.getElementById('total_light_hours').textContent = data.total_light_hours;
    }
    
    if (data.total_energy !== undefined) {
        document.getElementById('energy_consumption').textContent = data.total_energy;
    }
    
    // Обновляем таймер полива
    if (data.time_since_watering !== undefined && data.watering_delay_ms !== undefined) {
        const timeSinceWatering = data.time_since_watering || 0;
        const wateringDelayMs = data.watering_delay_ms || 1800000;
        const timeLeft = Math.max(0, Math.floor((wateringDelayMs - timeSinceWatering) / 60000));
        document.getElementById('timer_value').textContent = timeLeft;
    }
    
    // Обновляем время
    if (data.current_time !== undefined) {
        document.getElementById('current_time_display').textContent = 'Текущее: ' + data.current_time;
    }
    
    if (data.time_manual !== undefined) {
        const timeMode = document.getElementById('time_mode');
        timeMode.textContent = data.time_manual ? 'Ручное' : 'Авто';
        timeMode.className = 'status-badge ' + (data.time_manual ? 'status-on' : '');
    }
    
    // Обновляем ошибки
    if (data.errors !== undefined) {
        updateErrors(data.errors);
    }
    
    // Обновляем график
    if (data.moisture_history !== undefined && chart) {
        updateChart(data.moisture_history);
    }
}

// Обновление графика
function updateChart(data) {
    if (!chart) initChart();
    
    chart.data.datasets[0].data = data;
    chart.update('none');
}

// Обновление списка ошибок
function updateErrors(errors) {
    const container = document.getElementById('errors_container');
    const errorCount = document.getElementById('error_count');
    
    if (!errors || errors.length === 0) {
        container.innerHTML = '<div class="error-item"><div class="error-msg">✅ Ошибок нет</div></div>';
        errorCount.textContent = '0';
        errorCount.className = 'status-badge';
        return;
    }
    
    errorCount.textContent = errors.length;
    errorCount.className = 'status-badge status-error';
    
    let html = '';
    errors.forEach(error => {
        const criticalIcon = error.critical ? '⚠️ ' : '';
        html += `
            <div class="error-item">
                <div class="error-time"><i class="fas fa-clock"></i> ${error.time}</div>
                <div class="error-msg">${criticalIcon}${error.msg}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Проверка времени в диапазоне
function timeInRange(now, startStr, endStr) {
    if (!startStr || !endStr) return false;
    
    const [startHour, startMin] = startStr.split(':').map(Number);
    const [endHour, endMin] = endStr.split(':').map(Number);
    const nowHour = now.getHours();
    const nowMin = now.getMinutes();
    
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    const current = nowHour * 60 + nowMin;
    
    if (start <= end) {
        return current >= start && current < end;
    } else {
        return current >= start || current < end;
    }
}

// Обновление порога влажности
function updateThreshold(value) {
    document.getElementById('thresh_val').textContent = value + '%';
}

// Сохранение настроек
async function saveSettings() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    const settings = {
        moisture_threshold: parseInt(document.getElementById('moist_threshold').value) || 50,
        watering_delay: parseInt(document.getElementById('watering_delay').value) || 30,
        watering_duration: parseInt(document.getElementById('watering_duration').value) || 2,
        manual_pump_time: parseInt(document.getElementById('manual_pump_time').value) || 10,
        manual_light_time: parseInt(document.getElementById('manual_light_time').value) || 1,
        lamp_start: document.getElementById('lamp_start').value || '08:00',
        lamp_end: document.getElementById('lamp_end').value || '20:00',
        lamp_enabled: document.getElementById('lamp_enabled').checked,
        sleep_start: document.getElementById('sleep_start').value || '23:00',
        sleep_end: document.getElementById('sleep_end').value || '07:00',
        sleep_enabled: document.getElementById('sleep_enabled').checked,
        time_manual: document.getElementById('time_manual').checked
    };
    
    try {
        const response = await axios.post(API_ENDPOINTS.SETTINGS(), settings, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status === 200) {
            showNotification('✅ Настройки сохранены', 'success');
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showNotification('❌ Ошибка сохранения настроек', 'error');
    }
}

// Управление насосом
async function togglePump() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    const on = document.getElementById('pump_switch').checked;
    
    try {
        await axios.post(API_ENDPOINTS.PUMP(), {
            state: on ? 'on' : 'off'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        showNotification(on ? '✅ Насос включен' : '✅ Насос выключен', 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка переключения насоса:', error);
        showNotification('❌ Ошибка переключения насоса', 'error');
    }
}

async function setPumpAuto() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    try {
        await axios.post(API_ENDPOINTS.PUMP_AUTO());
        showNotification('✅ Насос: авторежим', 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка установки авторежима:', error);
        showNotification('❌ Ошибка установки авторежима', 'error');
    }
}

async function manualWatering() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    try {
        await axios.post(API_ENDPOINTS.PUMP_WATER());
        showNotification('💧 Запущен ручной полив', 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка ручного полива:', error);
        showNotification('❌ Ошибка ручного полива', 'error');
    }
}

// Управление светом
async function toggleLight() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    const on = document.getElementById('light_switch').checked;
    
    try {
        await axios.post(API_ENDPOINTS.LIGHT(), {
            state: on ? 'on' : 'off'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        showNotification(on ? '✅ Свет включен' : '✅ Свет выключен', 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка переключения света:', error);
        showNotification('❌ Ошибка переключения света', 'error');
    }
}

async function setLightAuto() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    try {
        await axios.post(API_ENDPOINTS.LIGHT_AUTO());
        showNotification('✅ Свет: авторежим', 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка установки авторежима света:', error);
        showNotification('❌ Ошибка установки авторежима света', 'error');
    }
}

// Очистка ошибок
async function clearErrors() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    try {
        await axios.post(API_ENDPOINTS.ERRORS_CLEAR());
        showNotification('✅ Ошибки очищены', 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка очистки ошибок:', error);
        showNotification('❌ Ошибка очистки ошибок', 'error');
    }
}

function refreshErrors() {
    fetchState();
}

// Управление временем
async function toggleTimeMode() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    const manual = document.getElementById('time_manual').checked;
    
    try {
        await axios.post(API_ENDPOINTS.TIME_MODE(), {
            manual: manual
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        showNotification(manual ? '⏰ Ручная корректировка времени' : '🌐 Автоматическое время', 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка переключения режима времени:', error);
        showNotification('❌ Ошибка переключения режима времени', 'error');
    }
}

async function setCurrentTime() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    try {
        await axios.post(API_ENDPOINTS.TIME_SET(), {
            hours: hours,
            minutes: minutes
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        showNotification(`✅ Установлено время: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`, 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка установки времени:', error);
        showNotification('❌ Ошибка установки времени', 'error');
    }
}

async function setCustomTime() {
    if (!isConnected) {
        showNotification('❌ Нет подключения к ESP8266', 'error');
        return;
    }
    
    const hours = parseInt(document.getElementById('time_hours').value) || 12;
    const minutes = parseInt(document.getElementById('time_minutes').value) || 0;
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        showNotification('❌ Некорректное время', 'error');
        return;
    }
    
    try {
        await axios.post(API_ENDPOINTS.TIME_SET(), {
            hours: hours,
            minutes: minutes
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        showNotification(`✅ Установлено время: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`, 'success');
        fetchState();
    } catch (error) {
        console.error('Ошибка установки времени:', error);
        showNotification('❌ Ошибка установки времени', 'error');
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    // Обработчики для полей ввода
    const inputs = [
        'watering_delay', 'watering_duration', 'manual_pump_time',
        'manual_light_time', 'lamp_start', 'lamp_end',
        'sleep_start', 'sleep_end'
    ];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', saveSettings);
        }
    });
    
    // Обработчики для переключателей
    const switches = ['lamp_enabled', 'sleep_enabled', 'time_manual'];
    switches.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', saveSettings);
        }
    });
    
    // Обработчик для поля адреса ESP (Enter для подключения)
    const espAddressInput = document.getElementById('esp_address');
    if (espAddressInput) {
        espAddressInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                connectToESP();
            }
        });
    }
}

// Запуск периодического обновления
function startAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(() => {
        if (isConnected) {
            fetchState();
        }
    }, getConfig().UPDATE_INTERVAL);
}

// Показать уведомление
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => {
        if (n !== notification) n.remove();
    });
    
    // Устанавливаем тип и сообщение
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Иконка в зависимости от типа
    let icon = '';
    switch(type) {
        case 'success': icon = '✅'; break;
        case 'error': icon = '❌'; break;
        case 'warning': icon = '⚠️'; break;
        case 'info': icon = 'ℹ️'; break;
        default: icon = '💡';
    }
    notification.innerHTML = `${icon} ${message}`;
    
    // Показываем с анимацией
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Скрываем через 3 секунды
    setTimeout(() => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

// Экспорт функций для глобального использования
window.toggleTheme = toggleTheme;
window.updateThreshold = updateThreshold;
window.saveSettings = saveSettings;
window.togglePump = togglePump;
window.setPumpAuto = setPumpAuto;
window.toggleLight = toggleLight;
window.setLightAuto = setLightAuto;
window.manualWatering = manualWatering;
window.clearErrors = clearErrors;
window.refreshErrors = refreshErrors;
window.toggleTimeMode = toggleTimeMode;
window.setCurrentTime = setCurrentTime;
window.setCustomTime = setCustomTime;
window.connectToESP = connectToESP;

console.log('Script loaded successfully');
