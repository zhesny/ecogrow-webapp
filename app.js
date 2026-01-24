// EcoGrow Assistant - Рабочая версия
class EcoGrowApp {
    constructor() {
        this.systemData = {
            moisture: 0,
            pump: 0,
            light: 0,
            temperature: 25,
            humidity: 50,
            timestamp: 0
        };
        
        this.stats = {
            wateringsToday: 0,
            waterUsed: 0,
            powerUsed: 0,
            errorsToday: 0,
            uptime: 0
        };
        
        this.connectionStatus = 'disconnected';
        this.isFirebaseReady = false;
        this.lastUpdate = 0;
        this.chartData = [];
        this.maxChartPoints = 24;
        
        this.chart = null;
        this.miniChart = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация EcoGrow Assistant...');
        
        try {
            // Инициализация компонентов
            this.initCharts();
            this.initEventListeners();
            
            // Проверка и подключение к Firebase
            await this.initFirebase();
            
            // Запуск таймеров
            this.startTimers();
            
            // Скрытие прелоадера
            this.hidePreloader();
            
            this.showToast('✅ Система запущена успешно!', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showToast('Ошибка запуска: ' + error.message, 'error');
            
            // Запуск демо-режима
            this.startDemoMode();
        }
    }

    async initFirebase() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 30;
            let attempts = 0;
            
            const checkFirebase = () => {
                attempts++;
                
                if (window.firebaseDatabase) {
                    console.log('✅ Firebase обнаружен');
                    this.db = window.firebaseDatabase;
                    this.isFirebaseReady = true;
                    
                    // Запуск слушателей Firebase
                    this.startFirebaseListeners();
                    
                    // Обновление статуса
                    this.updateConnectionStatus('connected');
                    
                    resolve();
                    
                } else if (attempts >= maxAttempts) {
                    console.warn('⚠️ Firebase не обнаружен, переходим в демо-режим');
                    this.updateConnectionStatus('disconnected');
                    reject(new Error('Firebase не загрузился'));
                    
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            
            checkFirebase();
        });
    }

    startFirebaseListeners() {
        if (!this.db) return;
        
        console.log('👂 Запуск слушателей Firebase...');
        
        // Основные данные системы
        const dataRef = this.db.ref('data/current');
        dataRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.updateSystemData(data);
                this.lastUpdate = Date.now();
            }
        });
        
        // Статистика
        const statsRef = this.db.ref('stats');
        statsRef.on('value', (snapshot) => {
            const stats = snapshot.val();
            if (stats) {
                this.updateStats(stats);
            }
        });
        
        // Информация о системе
        const systemRef = this.db.ref('system/info');
        systemRef.on('value', (snapshot) => {
            const info = snapshot.val();
            if (info) {
                this.updateSystemInfo(info);
            }
        });
        
        // Статус Arduino
        const arduinoRef = this.db.ref('system/arduinoAlive');
        arduinoRef.on('value', (snapshot) => {
            const status = snapshot.val();
            this.updateArduinoStatus(status);
        });
        
        // Проверка подключения
        const connectedRef = this.db.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            this.connectionStatus = snap.val() === true ? 'connected' : 'disconnected';
            this.updateConnectionStatus(this.connectionStatus);
        });
    }

    updateSystemData(data) {
        this.systemData = {
            moisture: data.moisture || 0,
            pump: data.pump || 0,
            light: data.light || 0,
            temperature: data.temperature || 25,
            humidity: data.humidity || 50,
            timestamp: data.timestamp || 0
        };
        
        this.updateUI();
        this.updateChart();
    }

    updateUI() {
        // Основные показатели
        document.getElementById('moistureValue').textContent = `${this.systemData.moisture}%`;
        document.getElementById('temperatureValue').textContent = `${this.systemData.temperature}°C`;
        document.getElementById('pumpStatus').textContent = this.systemData.pump ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('lightStatus').textContent = this.systemData.light ? 'ВКЛ' : 'ВЫКЛ';
        
        // Обновление времени
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            `Обновлено: ${now.toLocaleTimeString('ru-RU')}`;
        
        document.getElementById('currentTime').textContent = 
            now.toLocaleTimeString('ru-RU');
        
        // Обновление кнопок управления
        this.updateControlButtons();
        
        // Обновление тренда
        this.updateMoistureTrend();
        
        // Обновление статуса датчиков
        this.updateSensorStatus();
    }

    updateControlButtons() {
        const pumpBtn = document.getElementById('manualPumpBtn');
        const lightBtn = document.getElementById('manualLightBtn');
        
        if (this.systemData.pump) {
            pumpBtn.innerHTML = '<i class="fas fa-water"></i><span>Выключить насос</span>';
            pumpBtn.classList.add('active');
        } else {
            pumpBtn.innerHTML = '<i class="fas fa-water"></i><span>Включить насос</span>';
            pumpBtn.classList.remove('active');
        }
        
        if (this.systemData.light) {
            lightBtn.innerHTML = '<i class="fas fa-lightbulb"></i><span>Выключить свет</span>';
            lightBtn.classList.add('active');
        } else {
            lightBtn.innerHTML = '<i class="fas fa-lightbulb"></i><span>Включить свет</span>';
            lightBtn.classList.remove('active');
        }
    }

    updateStats(stats) {
        if (!stats) return;
        
        this.stats = stats;
        
        document.getElementById('wateringsToday').textContent = stats.wateringsToday || 0;
        document.getElementById('waterSaved').textContent = `${(stats.totalWaterUsed || 0).toFixed(1)}л`;
        
        // Расчет часов света (упрощенный)
        if (stats.totalPowerUsed) {
            const lightHours = (stats.totalPowerUsed / 0.2).toFixed(1);
            document.getElementById('lightHours').textContent = lightHours;
        }
        
        // Обновление прогресс-баров
        const efficiency = Math.min(100, (stats.wateringsToday || 0) * 15);
        document.getElementById('efficiencyValue').textContent = `${efficiency}%`;
        document.querySelector('#efficiencyValue').parentElement.nextElementSibling
            .querySelector('.progress-fill').style.width = `${efficiency}%`;
    }

    updateSystemInfo(info) {
        if (!info) return;
        
        // Обновление статуса WiFi
        const wifiStatus = document.getElementById('wifiStatus');
        const wifiItem = document.getElementById('wifiStatusItem');
        
        if (info.wifiRssi) {
            wifiStatus.textContent = info.wifiRssi > -70 ? 'Отличный' : 'Слабый';
            wifiItem.className = info.wifiRssi > -70 ? 'status-item online' : 'status-item warning';
        }
        
        // Обновление времени системы
        if (info.time) {
            document.getElementById('lastSystemUpdate').textContent = info.time;
        }
        
        // Обновление аптайма
        if (info.uptime) {
            const days = Math.floor(info.uptime / 86400);
            const hours = Math.floor((info.uptime % 86400) / 3600);
            const minutes = Math.floor((info.uptime % 3600) / 60);
            document.getElementById('uptime').textContent = `${days}д ${hours}ч ${minutes}м`;
            document.getElementById('daysRunning').textContent = days + 1;
        }
        
        // Обновление загрузки системы
        if (info.freeHeap) {
            const load = Math.round((1 - info.freeHeap / 80000) * 100);
            document.getElementById('systemLoad').textContent = `${load}%`;
            document.querySelector('#systemLoad').parentElement.nextElementSibling
                .querySelector('.progress-fill').style.width = `${load}%`;
        }
    }

    updateArduinoStatus(status) {
        const arduinoStatus = document.getElementById('arduinoStatus');
        const arduinoItem = document.getElementById('arduinoStatusItem');
        
        if (status === 1) {
            arduinoStatus.textContent = 'Онлайн';
            arduinoItem.className = 'status-item online';
        } else {
            arduinoStatus.textContent = 'Офлайн';
            arduinoItem.className = 'status-item error';
        }
    }

    updateConnectionStatus(status) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-indicator span:last-child');
        
        switch (status) {
            case 'connected':
                statusDot.className = 'status-dot connected';
                statusText.textContent = 'Подключено';
                statusDot.style.backgroundColor = '#10b981';
                break;
            case 'disconnected':
                statusDot.className = 'status-dot';
                statusText.textContent = 'Отключено';
                statusDot.style.backgroundColor = '#ef4444';
                break;
            default:
                statusDot.className = 'status-dot';
                statusText.textContent = 'Ошибка';
                statusDot.style.backgroundColor = '#f59e0b';
        }
    }

    updateSensorStatus() {
        const sensorStatus = document.getElementById('sensorStatus');
        const sensorItem = document.getElementById('sensorStatusItem');
        const rtcStatus = document.getElementById('rtcStatus');
        const rtcItem = document.getElementById('rtcStatusItem');
        
        // Статус датчика влажности
        if (this.systemData.moisture > 0) {
            sensorStatus.textContent = 'Работает';
            sensorItem.className = 'status-item online';
        } else {
            sensorStatus.textContent = 'Ошибка';
            sensorItem.className = 'status-item error';
        }
        
        // Статус RTC (всегда онлайн, если есть данные)
        if (this.systemData.timestamp > 0) {
            rtcStatus.textContent = 'Синхронизировано';
            rtcItem.className = 'status-item online';
        } else {
            rtcStatus.textContent = 'Ошибка';
            rtcItem.className = 'status-item error';
        }
    }

    updateMoistureTrend() {
        if (this.chartData.length < 2) return;
        
        const current = this.systemData.moisture;
        const previous = this.chartData[this.chartData.length - 2] || current;
        
        let trend, color;
        if (current > previous) {
            trend = '↗ Рост';
            color = '#10b981';
        } else if (current < previous) {
            trend = '↘ Спад';
            color = '#ef4444';
        } else {
            trend = '→ Стабильно';
            color = '#f59e0b';
        }
        
        document.getElementById('moistureTrend').textContent = trend;
        document.getElementById('moistureTrend').style.color = color;
        document.getElementById('moistureTrendValue').textContent = trend;
        document.getElementById('moistureTrendValue').style.color = color;
    }

    initCharts() {
        // Основной график влажности
        const ctx = document.getElementById('moistureChart').getContext('2d');
        
        // Генерация меток времени (последние 24 часа)
        const labels = [];
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(time.getHours().toString().padStart(2, '0') + ':00');
        }
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Влажность почвы',
                    data: Array(24).fill(0),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 3
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
                        callbacks: {
                            label: (context) => `Влажность: ${context.parsed.y}%`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: { color: 'rgb(148, 163, 184)' }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: {
                            color: 'rgb(148, 163, 184)',
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
        
        // Мини-график
        const miniCtx = document.getElementById('miniMoistureChart').getContext('2d');
        this.miniChart = new Chart(miniCtx, {
            type: 'line',
            data: {
                labels: ['', '', '', '', ''],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } },
                elements: { point: { radius: 0 } }
            }
        });
    }

    updateChart() {
        if (!this.chart) return;
        
        // Добавление данных в историю
        this.chartData.push(this.systemData.moisture);
        if (this.chartData.length > this.maxChartPoints) {
            this.chartData.shift();
        }
        
        // Обновление основного графика
        const now = new Date();
        const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
        
        // Добавление новой точки
        if (this.chart.data.labels.length < this.maxChartPoints) {
            this.chart.data.labels.push(timeLabel);
        } else {
            this.chart.data.labels.shift();
            this.chart.data.labels.push(timeLabel);
        }
        
        this.chart.data.datasets[0].data = [...this.chartData];
        this.chart.update('none');
        
        // Обновление мини-графика
        if (this.miniChart) {
            const miniData = this.chartData.slice(-5);
            this.miniChart.data.datasets[0].data = miniData;
            this.miniChart.update('none');
        }
        
        // Обновление статистики графика
        this.updateChartStats();
    }

    updateChartStats() {
        if (this.chartData.length === 0) return;
        
        const sum = this.chartData.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / this.chartData.length);
        const min = Math.min(...this.chartData);
        const max = Math.max(...this.chartData);
        
        document.getElementById('avgMoisture').textContent = `${avg}%`;
        document.getElementById('minMoisture').textContent = `${min}%`;
        document.getElementById('maxMoisture').textContent = `${max}%`;
    }

    initEventListeners() {
        // Переключение темы
        document.getElementById('themeToggle').addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            this.showToast(`Тема изменена`, 'success');
        });

        // Режим сна
        document.getElementById('sleepModeBtn').addEventListener('click', () => {
            this.showSleepModeModal();
        });

        // Ручное управление насосом
        document.getElementById('manualPumpBtn').addEventListener('click', () => {
            this.togglePump();
        });

        // Ручное управление светом
        document.getElementById('manualLightBtn').addEventListener('click', () => {
            this.toggleLight();
        });

        // Настройки
        document.getElementById('moistureThreshold').addEventListener('input', (e) => {
            document.getElementById('thresholdValue').textContent = `${e.target.value}%`;
        });

        document.getElementById('moistureThreshold').addEventListener('change', (e) => {
            this.updateSetting('threshold', e.target.value);
        });

        document.getElementById('pumpDuration').addEventListener('change', (e) => {
            this.updateSetting('pumpTime', e.target.value);
        });

        document.getElementById('checkInterval').addEventListener('change', (e) => {
            this.updateSetting('checkInterval', e.target.value);
        });

        // Автополив
        document.getElementById('autoWateringToggle').addEventListener('change', (e) => {
            this.updateSetting('autoWatering', e.target.checked);
        });

        // Диапазоны времени
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.changeTimeRange(e.target.dataset.range);
            });
        });

        // Синхронизация времени
        document.getElementById('syncTimeBtn').addEventListener('click', () => {
            this.syncTime();
        });

        // Очистка ошибок
        document.getElementById('clearErrorsBtn').addEventListener('click', () => {
            this.clearErrors();
        });

        // Тестовое уведомление
        document.getElementById('testNotificationBtn').addEventListener('click', () => {
            this.sendTestNotification();
        });

        // Расписание света
        document.getElementById('applyScheduleBtn').addEventListener('click', () => {
            this.applyLightSchedule();
        });

        // Модальные окна
        document.getElementById('confirmSleepBtn').addEventListener('click', () => {
            this.activateSleepMode();
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.classList.remove('active');
                });
            });
        });

        // Закрытие модального окна по клику вне его
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    startTimers() {
        // Обновление времени каждую секунду
        setInterval(() => {
            const now = new Date();
            document.getElementById('currentTime').textContent = 
                now.toLocaleTimeString('ru-RU');
        }, 1000);

        // Проверка подключения каждые 30 секунд
        setInterval(() => {
            this.checkConnection();
        }, 30000);
        
        // Обновление визуализации света
        setInterval(() => {
            this.updateLightVisualization();
        }, 60000);
    }

    checkConnection() {
        if (this.lastUpdate && Date.now() - this.lastUpdate > 60000) {
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus(this.connectionStatus);
            this.showToast('Нет данных от системы более 1 минуты', 'warning');
        }
    }

    updateLightVisualization() {
        const lightPeriod = document.getElementById('lightPeriod');
        const startTime = document.getElementById('lightStartTime').value;
        const duration = parseInt(document.getElementById('lightDuration').value);
        
        if (!startTime || !duration) return;
        
        const [hours, minutes] = startTime.split(':').map(Number);
        const startPercent = (hours * 60 + minutes) / (24 * 60) * 100;
        const widthPercent = (duration * 60) / (24 * 60) * 100;
        
        lightPeriod.style.left = `${startPercent}%`;
        lightPeriod.style.width = `${widthPercent}%`;
    }

    async togglePump() {
        try {
            const newState = !this.systemData.pump;
            const command = newState ? 'ON' : 'OFF';
            
            await this.sendCommand('pump', command);
            this.showToast(`Насос ${newState ? 'включен' : 'выключен'}`, 'success');
            
        } catch (error) {
            console.error('Ошибка управления насосом:', error);
            this.showToast('Ошибка отправки команды', 'error');
        }
    }

    async toggleLight() {
        try {
            const newState = !this.systemData.light;
            const command = newState ? 'ON' : 'OFF';
            
            await this.sendCommand('light', command);
            this.showToast(`Свет ${newState ? 'включен' : 'выключен'}`, 'success');
            
        } catch (error) {
            console.error('Ошибка управления светом:', error);
            this.showToast('Ошибка отправки команды', 'error');
        }
    }

    async sendCommand(type, value) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    throw new Error('Firebase не подключен');
                }
                
                const commandRef = this.db.ref(`commands/${type}`);
                commandRef.set(value)
                    .then(() => {
                        console.log(`Команда отправлена: ${type}=${value}`);
                        resolve();
                    })
                    .catch(reject);
                    
            } catch (error) {
                reject(error);
            }
        });
    }

    async updateSetting(setting, value) {
        try {
            await this.sendCommand(setting, value.toString());
            this.showToast(`Настройка обновлена`, 'success');
        } catch (error) {
            console.error('Ошибка обновления настройки:', error);
            this.showToast('Ошибка обновления настройки', 'error');
        }
    }

    async syncTime() {
        try {
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            await this.sendCommand('setTime', timeString);
            this.showToast('Время синхронизировано', 'success');
            
        } catch (error) {
            console.error('Ошибка синхронизации времени:', error);
            this.showToast('Ошибка синхронизации времени', 'error');
        }
    }

    clearErrors() {
        const errorsList = document.getElementById('errorsList');
        const noErrors = document.getElementById('noErrors');
        
        errorsList.innerHTML = '';
        errorsList.style.display = 'none';
        noErrors.style.display = 'block';
        
        this.showToast('История ошибок очищена', 'success');
    }

    sendTestNotification() {
        this.showToast('Тестовое уведомление отправлено', 'success');
    }

    applyLightSchedule() {
        const startTime = document.getElementById('lightStartTime').value;
        const duration = document.getElementById('lightDuration').value;
        
        if (!startTime || !duration) {
            this.showToast('Заполните все поля расписания', 'warning');
            return;
        }
        
        const schedule = `${startTime}-${duration}`;
        this.updateSetting('lightSchedule', schedule);
    }

    showSleepModeModal() {
        document.getElementById('sleepModeModal').classList.add('active');
    }

    async activateSleepMode() {
        try {
            const duration = document.getElementById('sleepDuration').value;
            await this.sendCommand('sleepMode', 'true');
            
            document.getElementById('sleepModeModal').classList.remove('active');
            this.showToast(`Режим сна активирован на ${duration} часов`, 'warning');
            
        } catch (error) {
            console.error('Ошибка режима сна:', error);
            this.showToast('Ошибка активации режима сна', 'error');
        }
    }

    changeTimeRange(range) {
        console.log('Изменение диапазона времени:', range);
        this.showToast(`Загружаются данные за ${range}`, 'info');
    }

    startDemoMode() {
        console.log('🔄 Запуск демо-режима');
        this.showToast('Демо-режим: Используются тестовые данные', 'info');
        
        // Генерация тестовых данных
        setInterval(() => {
            this.systemData.moisture = Math.max(10, Math.min(90, 
                this.systemData.moisture + (Math.random() - 0.5) * 2
            ));
            
            this.systemData.temperature = 22 + Math.sin(Date.now() / 100000) * 3;
            this.systemData.humidity = 40 + Math.cos(Date.now() / 150000) * 20;
            
            this.systemData.timestamp = Date.now() / 1000;
            
            this.updateUI();
            this.updateChart();
            
        }, 3000);
    }

    hidePreloader() {
        setTimeout(() => {
            const preloader = document.querySelector('.preloader');
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }, 1500);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        if (type === 'error') icon = 'fas fa-exclamation-circle';
        if (type === 'warning') icon = 'fas fa-exclamation-triangle';
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Удаление через 5 секунд
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.5s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 500);
        }, 5000);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен, запускаем приложение...');
    window.ecoGrowApp = new EcoGrowApp();
});
