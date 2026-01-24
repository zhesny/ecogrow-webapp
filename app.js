// Global variables
let currentDevice = null;
let moistureChart = null;
let statsChart = null;
let currentTheme = 'light';
let deviceState = null;
let deviceSettings = null;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeCharts();
    loadSavedDevice();
    setupEventListeners();
    setupPeriodicUpdates();
});

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update theme button
    const themeBtn = document.querySelector('.btn-primary');
    if (themeBtn) {
        themeBtn.innerHTML = theme === 'dark' 
            ? '<i class="fas fa-sun"></i> Светлая тема'
            : '<i class="fas fa-moon"></i> Тёмная тема';
    }
}

function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Charts initialization
function initializeCharts() {
    // Moisture Chart
    const moistureCtx = document.getElementById('moisture_chart').getContext('2d');
    moistureChart = new Chart(moistureCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Влажность',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5
            }, {
                label: 'Порог',
                data: [],
                borderColor: '#e74c3c',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 13 },
                    padding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                        font: { size: 11 },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                        font: { size: 11 },
                        maxTicksLimit: 8
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // Stats Chart
    const statsCtx = document.getElementById('stats_chart').getContext('2d');
    statsChart = new Chart(statsCtx, {
        type: 'bar',
        data: {
            labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
            datasets: [{
                label: 'Поливы',
                data: [3, 5, 2, 4, 6, 3, 4],
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: '#3498db',
                borderWidth: 1
            }, {
                label: 'Часы света',
                data: [8, 10, 12, 9, 11, 8, 10],
                backgroundColor: 'rgba(243, 156, 18, 0.7)',
                borderColor: '#f39c12',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                        font: { size: 10 }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

// Device management
function loadSavedDevice() {
    const savedDeviceId = localStorage.getItem('last_device_id');
    if (savedDeviceId) {
        connectToDevice(savedDeviceId);
    }
}

async function scanForDevices() {
    showNotification('Поиск устройств...', 'info');
    
    const connectionModal = document.getElementById('connection_modal');
    connectionModal.classList.add('show');
    
    try {
        const devices = await firebaseService.scanForDevices();
        
        if (devices.length === 0) {
            document.getElementById('found_devices_list').innerHTML = `
                <div class="no-devices">
                    <i class="fas fa-search"></i>
                    <p>Устройства не найдены. Убедитесь, что устройство включено и подключено к интернету.</p>
                </div>
            `;
        } else {
            let devicesHTML = '';
            devices.forEach(device => {
                devicesHTML += `
                    <div class="device-item" onclick="connectToDevice('${device.id}')">
                        <div class="device-icon">
                            <i class="fas fa-microchip"></i>
                        </div>
                        <div class="device-details">
                            <div class="device-name">${device.name}</div>
                            <div class="device-ip">${device.ip}</div>
                        </div>
                        <div class="device-status online">Online</div>
                    </div>
                `;
            });
            document.getElementById('found_devices_list').innerHTML = devicesHTML;
        }
    } catch (error) {
        console.error('Error scanning devices:', error);
        showNotification('Ошибка поиска устройств', 'error');
    }
}

function closeModal() {
    document.getElementById('connection_modal').classList.remove('show');
}

async function connectToDevice(deviceId) {
    if (!deviceId) {
        deviceId = document.getElementById('device_id_input').value.trim();
        if (!deviceId) {
            showNotification('Введите ID устройства', 'warning');
            return;
        }
    }
    
    showNotification('Подключение к устройству...', 'info');
    updateConnectionStatus('connecting');
    
    try {
        const isOnline = await firebaseService.checkDeviceOnline(deviceId);
        
        if (!isOnline) {
            throw new Error('Устройство не в сети');
        }
        
        currentDevice = deviceId;
        firebaseService.connectToDevice(deviceId);
        
        // Save device ID
        localStorage.setItem('last_device_id', deviceId);
        
        // Switch to dashboard view
        document.getElementById('device_selector').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        // Update device info
        document.getElementById('display_device_id').textContent = deviceId;
        
        // Start listening for updates
        startListening();
        
        showNotification('Успешно подключено к устройству', 'success');
        updateConnectionStatus('online');
        
        closeModal();
        
    } catch (error) {
        console.error('Error connecting to device:', error);
        showNotification(`Ошибка подключения: ${error.message}`, 'error');
        updateConnectionStatus('offline');
    }
}

function disconnectDevice() {
    if (currentDevice) {
        firebaseService.disconnect();
        currentDevice = null;
        
        // Switch back to device selector
        document.getElementById('device_selector').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        
        showNotification('Отключено от устройства', 'info');
        updateConnectionStatus('offline');
        
        // Clear saved device
        localStorage.removeItem('last_device_id');
    }
}

function startListening() {
    // Listen for state changes
    firebaseService.listenToState((state) => {
        deviceState = state;
        updateUI();
    });
    
    // Listen for settings changes
    firebaseService.listenToSettings((settings) => {
        deviceSettings = settings;
        updateSettingsUI();
    });
}

// UI Updates
function updateUI() {
    if (!deviceState) return;
    
    // Update status values
    document.getElementById('current_moisture').textContent = 
        deviceState.moisture !== undefined ? deviceState.moisture + '%' : '--%';
    
    document.getElementById('pump_status').textContent = 
        deviceState.pump ? 'Вкл' : 'Выкл';
    
    document.getElementById('light_status').textContent = 
        deviceState.light ? 'Вкл' : 'Выкл';
    
    document.getElementById('current_time').textContent = 
        deviceState.time || '--:--';
    
    // Update status badges
    updateStatusBadge('pump_badge', deviceState.pump);
    updateStatusBadge('light_badge', deviceState.light);
    
    // Update device info
    document.getElementById('device_ip').textContent = 
        deviceState.ip ? `IP: ${deviceState.ip}` : 'IP: --.--.--.--';
    
    // Update statistics
    if (deviceState.total_waterings) {
        document.getElementById('total_waterings').textContent = deviceState.total_waterings;
    }
    
    if (deviceState.total_light_hours) {
        document.getElementById('total_light_hours').textContent = deviceState.total_light_hours;
    }
    
    // Update chart
    updateMoistureChart();
}

function updateStatusBadge(badgeId, isActive) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    
    if (isActive) {
        badge.innerHTML = '<span class="badge online">Активно</span>';
    } else {
        badge.innerHTML = '<span class="badge offline">Неактивно</span>';
    }
}

function updateSettingsUI() {
    if (!deviceSettings) return;
    
    // Update threshold
    if (deviceSettings.moistureThreshold) {
        document.getElementById('moisture_threshold').value = deviceSettings.moistureThreshold;
        document.getElementById('threshold_display').textContent = deviceSettings.moistureThreshold + '%';
        document.getElementById('threshold_value').textContent = deviceSettings.moistureThreshold + '%';
    }
    
    // Update pump settings
    if (deviceSettings.wateringDelayMinutes) {
        document.getElementById('watering_delay').value = deviceSettings.wateringDelayMinutes;
    }
    
    if (deviceSettings.wateringDurationSec) {
        document.getElementById('watering_duration').value = deviceSettings.wateringDurationSec;
    }
    
    // Update light settings
    if (deviceSettings.lampEnabled !== undefined) {
        document.getElementById('light_auto_enabled').checked = deviceSettings.lampEnabled;
    }
    
    if (deviceSettings.lamp_start && deviceSettings.lamp_end) {
        document.getElementById('light_start_time').value = deviceSettings.lamp_start;
        document.getElementById('light_end_time').value = deviceSettings.lamp_end;
        document.getElementById('light_schedule_display').textContent = 
            `${deviceSettings.lamp_start} - ${deviceSettings.lamp_end}`;
    }
    
    // Update sleep settings
    if (deviceSettings.sleepEnabled !== undefined) {
        document.getElementById('sleep_mode_enabled').checked = deviceSettings.sleepEnabled;
    }
    
    if (deviceSettings.sleep_start && deviceSettings.sleep_end) {
        document.getElementById('sleep_start_time').value = deviceSettings.sleep_start;
        document.getElementById('sleep_end_time').value = deviceSettings.sleep_end;
    }
}

function updateMoistureChart() {
    if (!deviceState || !moistureChart) return;
    
    // Generate time labels for the last 24 hours
    const labels = [];
    const data = [];
    const thresholdData = [];
    
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
        const time = new Date(now);
        time.setHours(now.getHours() - i);
        labels.push(time.getHours().toString().padStart(2, '0') + ':00');
        
        // Simulate data (in real app, this would come from Firebase)
        const baseValue = deviceState.moisture || 50;
        const variation = Math.sin(i * 0.5) * 10;
        data.push(Math.max(0, Math.min(100, baseValue + variation)));
        
        // Threshold line
        thresholdData.push(deviceSettings?.moistureThreshold || 50);
    }
    
    moistureChart.data.labels = labels;
    moistureChart.data.datasets[0].data = data;
    moistureChart.data.datasets[1].data = thresholdData;
    moistureChart.update();
    
    // Update stats
    if (data.length > 0) {
        const sum = data.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / data.length);
        const min = Math.min(...data);
        const max = Math.max(...data);
        
        document.getElementById('avg_moisture').textContent = avg + '%';
        document.getElementById('min_moisture').textContent = min + '%';
        document.getElementById('max_moisture').textContent = max + '%';
    }
}

// Control functions
function togglePump() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    const isOn = deviceState?.pump || false;
    const command = isOn ? 'pump_off' : 'pump_on';
    
    firebaseService.sendCommand('action', command);
    showNotification(isOn ? 'Насос выключен' : 'Насос включен', 'success');
}

function toggleLight() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    const isOn = deviceState?.light || false;
    const command = isOn ? 'light_off' : 'light_on';
    
    firebaseService.sendCommand('action', command);
    showNotification(isOn ? 'Свет выключен' : 'Свет включен', 'success');
}

function manualWatering() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    firebaseService.sendCommand('action', 'manual_water');
    showNotification('Запущен ручной полив', 'success');
}

function updateThresholdValue(value) {
    document.getElementById('threshold_display').textContent = value + '%';
}

function adjustValue(inputId, delta) {
    const input = document.getElementById(inputId);
    let value = parseInt(input.value) || 0;
    value += delta;
    
    const min = parseInt(input.min) || 0;
    const max = parseInt(input.max) || 100;
    
    if (value < min) value = min;
    if (value > max) value = max;
    
    input.value = value;
}

// Settings save functions
function savePumpSettings() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    const settings = {
        moistureThreshold: parseInt(document.getElementById('moisture_threshold').value),
        wateringDelayMinutes: parseInt(document.getElementById('watering_delay').value),
        wateringDurationSec: parseInt(document.getElementById('watering_duration').value)
    };
    
    firebaseService.updateSettings(settings);
    firebaseService.sendCommand('moistureThreshold', settings.moistureThreshold);
    
    showNotification('Настройки насоса сохранены', 'success');
}

function saveLightSettings() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    const settings = {
        lampEnabled: document.getElementById('light_auto_enabled').checked,
        lamp_start: document.getElementById('light_start_time').value,
        lamp_end: document.getElementById('light_end_time').value
    };
    
    firebaseService.updateSettings(settings);
    showNotification('Настройки света сохранены', 'success');
}

function saveSleepSettings() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    const settings = {
        sleepEnabled: document.getElementById('sleep_mode_enabled').checked,
        sleep_start: document.getElementById('sleep_start_time').value,
        sleep_end: document.getElementById('sleep_end_time').value
    };
    
    firebaseService.updateSettings(settings);
    showNotification('Настройки режима сна сохранены', 'success');
}

// Time functions
function setCurrentTime() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    firebaseService.sendCommand({
        time_hours: hours,
        time_minutes: minutes
    });
    
    showNotification(`Установлено время: ${hours}:${minutes}`, 'success');
}

function setCustomTime() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    const hours = document.getElementById('time_hours').value.padStart(2, '0');
    const minutes = document.getElementById('time_minutes').value.padStart(2, '0');
    
    if (!hours || !minutes) {
        showNotification('Введите корректное время', 'warning');
        return;
    }
    
    firebaseService.sendCommand({
        time_hours: hours,
        time_minutes: minutes
    });
    
    showNotification(`Установлено время: ${hours}:${minutes}`, 'success');
}

// Error management
async function refreshErrors() {
    if (!currentDevice) return;
    
    const errors = await firebaseService.getErrors();
    displayErrors(errors);
}

function displayErrors(errors) {
    const container = document.getElementById('errors_container');
    const countElement = document.getElementById('error_count');
    
    if (!errors || errors.length === 0) {
        container.innerHTML = `
            <div class="no-errors">
                <i class="fas fa-check-circle"></i>
                <p>Ошибок нет</p>
            </div>
        `;
        countElement.textContent = '0';
        return;
    }
    
    let errorsHTML = '';
    errors.slice(0, 5).forEach((error, index) => {
        const time = new Date(parseInt(error.id)).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        errorsHTML += `
            <div class="error-item">
                <div class="error-header">
                    <div class="error-time">
                        <i class="fas fa-clock"></i> ${time}
                    </div>
                </div>
                <div class="error-message">${error.message}</div>
            </div>
        `;
    });
    
    container.innerHTML = errorsHTML;
    countElement.textContent = errors.length;
}

async function clearErrors() {
    if (!currentDevice) {
        showNotification('Сначала подключитесь к устройству', 'warning');
        return;
    }
    
    await firebaseService.clearErrors();
    displayErrors([]);
    showNotification('Ошибки очищены', 'success');
}

// Chart functions
function updateChartRange() {
    const range = document.getElementById('chart_range').value;
    updateMoistureChart(); // In real app, this would fetch different data range
}

// Utility functions
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection_status');
    if (!statusElement) return;
    
    const dot = statusElement.querySelector('.status-dot');
    const text = statusElement.querySelector('.status-text');
    
    dot.className = 'status-dot ' + status;
    
    switch(status) {
        case 'online':
            text.textContent = 'Подключено';
            break;
        case 'offline':
            text.textContent = 'Не подключено';
            break;
        case 'connecting':
            text.textContent = 'Подключение...';
            break;
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification_container');
    const notification = document.createElement('div');
    
    let icon = 'info-circle';
    switch(type) {
        case 'success':
            icon = 'check-circle';
            break;
        case 'error':
            icon = 'exclamation-circle';
            break;
        case 'warning':
            icon = 'exclamation-triangle';
            break;
    }
    
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    container.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

function setupEventListeners() {
    // Device ID input enter key
    document.getElementById('device_id_input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            connectToDevice();
        }
    });
    
    // Real-time clock update
    setInterval(updateRealTimeClock, 1000);
}

function updateRealTimeClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const dateStr = now.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    document.getElementById('system_time_display').textContent = timeStr;
    document.getElementById('system_date_display').textContent = dateStr;
}

function setupPeriodicUpdates() {
    // Update UI every 5 seconds
    setInterval(() => {
        if (currentDevice) {
            updateUI();
        }
    }, 5000);
    
    // Update next watering timer
    setInterval(updateNextWateringTimer, 1000);
}

function updateNextWateringTimer() {
    // In real app, this would calculate based on device state
    const timerElement = document.getElementById('next_watering_timer');
    if (!timerElement) return;
    
    // Simulate countdown (example)
    const currentText = timerElement.textContent;
    if (currentText === '--:--') {
        timerElement.textContent = '30:00';
    } else {
        const [minutes, seconds] = currentText.split(':').map(Number);
        let totalSeconds = minutes * 60 + seconds - 1;
        
        if (totalSeconds < 0) {
            totalSeconds = 30 * 60; // Reset to 30 minutes
        }
        
        const newMinutes = Math.floor(totalSeconds / 60);
        const newSeconds = totalSeconds % 60;
        timerElement.textContent = 
            newMinutes.toString().padStart(2, '0') + ':' + 
            newSeconds.toString().padStart(2, '0');
    }
}

// Initialize real-time clock on load
updateRealTimeClock();
