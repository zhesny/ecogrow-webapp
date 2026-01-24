// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBsZr7vWJDFt_S5i0Rvj6ejp6QT0JX9SPk",
    authDomain: "ecogrow-remote.firebaseapp.com",
    databaseURL: "https://ecogrow-remote-default-rtdb.firebaseio.com",
    projectId: "ecogrow-remote",
    storageBucket: "ecogrow-remote.firebasestorage.app",
    messagingSenderId: "121689275158",
    appId: "1:121689275158:web:f3b1829755c8b8a1fb2e37",
    measurementId: "G-PG5116NH38"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Переменные приложения
let moistureChart = null;
let lastDataUpdate = 0;
let isConnected = false;
let moistureHistory = [];

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initChart();
    setupFirebaseListeners();
    
    // Проверка соединения каждые 10 секунд
    setInterval(checkConnection, 10000);
    
    // Инициализация элементов управления
    initControls();
});

// Настройка графика
function initChart() {
    const ctx = document.getElementById('moistureChart').getContext('2d');
    moistureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(10).fill(''),
            datasets: [{
                label: 'Влажность %',
                data: Array(10).fill(0),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: '#3498db'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Влажность: ${context.raw}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        callback: function(value, index) {
                            return index + 1;
                        }
                    }
                }
            }
        }
    });
}

// Настройка слушателей Firebase
function setupFirebaseListeners() {
    // Слушаем данные устройства
    database.ref('data').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateUI(data);
            lastDataUpdate = Date.now();
            updateConnectionStatus(true);
        }
    });
    
    // Слушаем настройки
    database.ref('settings').on('value', (snapshot) => {
        const settings = snapshot.val();
        if (settings) {
            updateSettingsUI(settings);
        }
    });
    
    // Слушаем статистику
    database.ref('stats').on('value', (snapshot) => {
        const stats = snapshot.val();
        if (stats) {
            updateStatsUI(stats);
        }
    });
    
    // Слушаем историю влажности
    database.ref('history/moisture').on('value', (snapshot) => {
        const history = snapshot.val();
        if (history) {
            updateHistoryChart(history);
        }
    });
    
    // Слушаем информацию об устройстве
    database.ref('device').on('value', (snapshot) => {
        const device = snapshot.val();
        if (device) {
            updateDeviceInfo(device);
        }
    });
}

// Инициализация элементов управления
function initControls() {
    // Слайдер порога
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdValue = document.getElementById('thresholdValue');
    
    thresholdSlider.addEventListener('input', function() {
        thresholdValue.textContent = this.value + '%';
    });
    
    // Кнопка установки порога
    document.getElementById('setThresholdBtn').addEventListener('click', function() {
        const threshold = thresholdSlider.value;
        sendCommand('threshold', threshold);
    });
    
    // Кнопки быстрых команд
    document.querySelectorAll('[onclick^="quickCommand"]').forEach(button => {
        button.addEventListener('click', function(e) {
            const command = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];
            executeQuickCommand(command);
        });
    });
}

// Обновление интерфейса
function updateUI(data) {
    // Влажность
    const moisture = data.moisture || 0;
    document.getElementById('moistureValue').textContent = moisture + '%';
    
    // Позиция указателя
    const pointer = document.getElementById('moisturePointer');
    pointer.style.left = moisture + '%';
    
    // Статус влажности
    const moistureStatus = document.getElementById('moistureStatus');
    if (moisture < 30) {
        moistureStatus.textContent = '⚠️ Низкая влажность';
        moistureStatus.className = 'text-danger';
    } else if (moisture < 60) {
        moistureStatus.textContent = '✅ Нормальная влажность';
        moistureStatus.className = 'text-success';
    } else {
        moistureStatus.textContent = '💧 Высокая влажность';
        moistureStatus.className = 'text-primary';
    }
    
    // Насос
    const pumpAlert = document.getElementById('pumpAlert');
    const pumpStatusText = document.getElementById('pumpStatusText');
    
    if (data.pump) {
        pumpAlert.className = 'alert alert-success';
        pumpStatusText.textContent = 'ВКЛЮЧЕН';
    } else {
        pumpAlert.className = 'alert alert-secondary';
        pumpStatusText.textContent = 'ВЫКЛЮЧЕН';
    }
    
    // Свет
    const lightAlert = document.getElementById('lightAlert');
    const lightStatusText = document.getElementById('lightStatusText');
    
    if (data.light) {
        lightAlert.className = 'alert alert-warning';
        lightStatusText.textContent = 'ВКЛЮЧЕН';
    } else {
        lightAlert.className = 'alert alert-secondary';
        lightStatusText.textContent = 'ВЫКЛЮЧЕН';
    }
    
    // Ошибка датчика
    if (data.sensorError) {
        showNotification('⚠️ Ошибка датчика влажности! Проверьте соединение.', 'danger');
    }
    
    // Время последнего обновления
    if (data.lastUpdate) {
        const date = new Date(parseInt(data.lastUpdate));
        document.getElementById('lastUpdate').textContent = 
            'Обновлено: ' + date.toLocaleTimeString('ru-RU');
    }
    
    // Системное время
    if (data.time) {
        document.getElementById('systemTime').textContent = data.time;
    }
    
    // Добавляем в историю для графика
    moistureHistory.push(moisture);
    if (moistureHistory.length > 10) {
        moistureHistory.shift();
    }
    
    // Обновляем график
    updateChart();
}

// Обновление настроек в UI
function updateSettingsUI(settings) {
    // Порог влажности
    if (settings.moistureThreshold) {
        document.getElementById('thresholdSlider').value = settings.moistureThreshold;
        document.getElementById('thresholdValue').textContent = settings.moistureThreshold + '%';
    }
    
    // Длительность полива
    if (settings.wateringDuration) {
        document.getElementById('wateringDuration').value = settings.wateringDuration;
    }
    
    // Задержка полива
    if (settings.wateringDelay) {
        document.getElementById('wateringDelay').value = settings.wateringDelay;
    }
    
    // Расписание света
    if (settings.lampStart) {
        document.getElementById('lampStart').value = settings.lampStart;
    }
    if (settings.lampEnd) {
        document.getElementById('lampEnd').value = settings.lampEnd;
    }
    
    // Режим сна
    if (settings.sleepEnabled !== undefined) {
        document.getElementById('sleepEnabled').checked = settings.sleepEnabled;
    }
    if (settings.sleepStart) {
        document.getElementById('sleepStart').value = settings.sleepStart;
    }
    if (settings.sleepEnd) {
        document.getElementById('sleepEnd').value = settings.sleepEnd;
    }
}

// Обновление статистики
function updateStatsUI(stats) {
    if (stats.totalWaterings) {
        document.getElementById('totalWaterings').textContent = stats.totalWaterings;
    }
    
    if (stats.totalLightHours) {
        document.getElementById('totalLightHours').textContent = stats.totalLightHours;
    }
    
    if (stats.todayWaterings) {
        document.getElementById('todayWaterings').textContent = stats.todayWaterings;
    }
    
    // Расчёт энергии (примерно 50Вт * часы)
    if (stats.totalLightHours) {
        const energy = stats.totalLightHours * 50;
        document.getElementById('energyUsed').textContent = energy;
    }
}

// Обновление информации об устройстве
function updateDeviceInfo(device) {
    if (device.ip) {
        document.getElementById('deviceIP').textContent = device.ip;
    }
    
    if (device.status === 'online') {
        document.getElementById('deviceStatus').innerHTML = '<i class="bi bi-check-circle"></i> Online';
        document.getElementById('deviceStatus').style.background = '#28a745';
    } else {
        document.getElementById('deviceStatus').innerHTML = '<i class="bi bi-x-circle"></i> Offline';
        document.getElementById('deviceStatus').style.background = '#dc3545';
    }
    
    if (device.lastSeen) {
        const lastSeen = Date.now() - device.lastSeen;
        if (lastSeen > 30000) { // 30 секунд
            document.getElementById('deviceStatus').innerHTML = '<i class="bi bi-exclamation-triangle"></i> Нет связи';
            document.getElementById('deviceStatus').style.background = '#ffc107';
        }
    }
}

// Обновление графика истории
function updateHistoryChart(history) {
    const values = Object.values(history).filter(v => v > 0);
    if (values.length > 0) {
        moistureChart.data.datasets[0].data = values.slice(-10); // Последние 10 значений
        moistureChart.update();
    }
}

// Обновление графика из истории в памяти
function updateChart() {
    if (moistureChart && moistureHistory.length > 0) {
        moistureChart.data.datasets[0].data = moistureHistory;
        moistureChart.update();
    }
}

// Отправка команды
function sendCommand(device, action) {
    database.ref('commands/' + device).set(action)
        .then(() => {
            showNotification(`✅ Команда отправлена: ${getCommandName(device)} → ${action}`, 'success');
        })
        .catch((error) => {
            showNotification(`❌ Ошибка отправки: ${error.message}`, 'danger');
        });
}

// Обновление настройки
function updateSetting(setting) {
    const element = document.getElementById(setting);
    if (element && element.value) {
        database.ref('settings/' + setting).set(element.value)
            .then(() => {
                showNotification(`✅ Настройка обновлена: ${getSettingName(setting)} = ${element.value}`, 'success');
            })
            .catch((error) => {
                showNotification(`❌ Ошибка: ${error.message}`, 'danger');
            });
    }
}

// Обновление расписания света
function updateLightSchedule() {
    const start = document.getElementById('lampStart').value;
    const end = document.getElementById('lampEnd').value;
    
    if (start && end) {
        database.ref('commands/lightSchedule').set(`${start}-${end}`)
            .then(() => {
                showNotification('✅ Расписание света обновлено', 'success');
            })
            .catch((error) => {
                showNotification(`❌ Ошибка: ${error.message}`, 'danger');
            });
    } else {
        showNotification('⚠️ Заполните время начала и окончания', 'warning');
    }
}

// Ручной полив
function manualWatering() {
    sendCommand('pump', 'ON');
    showNotification('💧 Запущен ручной полив на 10 секунд', 'info');
    
    setTimeout(() => {
        sendCommand('pump', 'OFF');
    }, 10000);
}

// Быстрые команды
function executeQuickCommand(command) {
    switch(command) {
        case 'PUMP_ON_10':
            sendCommand('pump', 'ON');
            setTimeout(() => sendCommand('pump', 'OFF'), 10000);
            showNotification('💧 Быстрый полив 10 секунд', 'info');
            break;
            
        case 'LIGHT_ON_1H':
            sendCommand('light', 'ON');
            showNotification('💡 Свет включён на 1 час', 'info');
            setTimeout(() => sendCommand('light', 'OFF'), 3600000);
            break;
            
        case 'ALL_OFF':
            sendCommand('pump', 'OFF');
            sendCommand('light', 'OFF');
            showNotification('⛔ Все устройства выключены', 'warning');
            break;
            
        case 'ALL_AUTO':
            sendCommand('pump', 'AUTO');
            sendCommand('light', 'AUTO');
            showNotification('🤖 Включён авторежим', 'success');
            break;
    }
}

// Синхронизация настроек
function syncSettings() {
    database.ref('settings').once('value')
        .then((snapshot) => {
            const settings = snapshot.val();
            if (settings) {
                updateSettingsUI(settings);
                showNotification('✅ Настройки синхронизированы', 'success');
            }
        })
        .catch((error) => {
            showNotification(`❌ Ошибка синхронизации: ${error.message}`, 'danger');
        });
}

// Проверка соединения
function checkConnection() {
    const now = Date.now();
    if (now - lastDataUpdate > 30000 && lastDataUpdate > 0) { // 30 секунд
        updateConnectionStatus(false);
    }
}

// Обновление статуса соединения
function updateConnectionStatus(connected) {
    isConnected = connected;
    const statusElement = document.getElementById('connectionStatus');
    
    if (connected) {
        statusElement.innerHTML = '<i class="bi bi-cloud-check"></i> Firebase (онлайн)';
        statusElement.className = 'connection-badge connection-firebase';
    } else {
        statusElement.innerHTML = '<i class="bi bi-cloud-slash"></i> Firebase (офлайн)';
        statusElement.className = 'connection-badge connection-firebase';
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show notification`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(alert);
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
        if (alert.parentNode === container) {
            alert.remove();
        }
    }, 5000);
}

// Вспомогательные функции
function getCommandName(command) {
    const names = {
        'pump': 'Насос',
        'light': 'Свет',
        'threshold': 'Порог влажности',
        'pumpTime': 'Время полива',
        'lightSchedule': 'Расписание света',
        'setTime': 'Установка времени'
    };
    return names[command] || command;
}

function getSettingName(setting) {
    const names = {
        'wateringDuration': 'Длительность полива',
        'wateringDelay': 'Задержка полива',
        'moistureThreshold': 'Порог влажности'
    };
    return names[setting] || setting;
}
