// EcoGrow Assistant - Рабочая версия
class EcoGrowApp {
    constructor() {
        // Проверяем, не инициализировано ли приложение уже
        if (window.ecoGrowApp) {
            console.warn('⚠️ Экземпляр EcoGrowApp уже существует');
            return;
        }
        
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
        
        // Флаг инициализации
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        if (this.isInitialized) {
            console.warn('⚠️ Приложение уже инициализировано');
            return;
        }
        
        console.log('🚀 Инициализация EcoGrow Assistant...');
        this.isInitialized = true;
        
        try {
            // Сначала инициализируем Firebase
            await this.initFirebase();
            
            // Затем инициализируем компоненты
            this.initCharts();
            this.initEventListeners();
            
            // Запуск таймеров
            this.startTimers();
            
            // Скрытие прелоадера
            this.hidePreloader();
            
            this.showToast('✅ Система запущена успешно!', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            
            // Все равно инициализируем остальные компоненты
            this.initCharts();
            this.initEventListeners();
            this.startTimers();
            this.hidePreloader();
            
            this.showToast('Ошибка подключения к Firebase. Включаю демо-режим.', 'warning');
            
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
                
                if (window.firebaseDatabase && typeof window.firebaseDatabase.ref === 'function') {
                    console.log('✅ Firebase обнаружен и готов к работе');
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
                    const delay = attempts < 10 ? 200 : 500;
                    setTimeout(checkFirebase, delay);
                }
            };
            
            // Даем время на загрузку Firebase
            setTimeout(checkFirebase, 500);
        });
    }

    startFirebaseListeners() {
        if (!this.db) return;
        
        console.log('👂 Запуск слушателей Firebase...');
        
        try {
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
            
        } catch (error) {
            console.error('❌ Ошибка слушателей Firebase:', error);
        }
    }

    initCharts() {
        // Проверяем, не существует ли уже графиков
        const mainCanvas = document.getElementById('moistureChart');
        const miniCanvas = document.getElementById('miniMoistureChart');
        
        if (!mainCanvas || !miniCanvas) {
            console.error('❌ Canvas элементы не найдены');
            return;
        }
        
        // Уничтожаем существующие графики если они есть
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        if (this.miniChart) {
            this.miniChart.destroy();
            this.miniChart = null;
        }
        
        // Очищаем контексты
        const mainCtx = mainCanvas.getContext('2d');
        const miniCtx = miniCanvas.getContext('2d');
        
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
        
        try {
            // Основной график влажности
            this.chart = new Chart(mainCtx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 24}, (_, i) => {
                        const hour = (new Date().getHours() - (23 - i) + 24) % 24;
                        return hour.toString().padStart(2, '0') + ':00';
                    }),
                    datasets: [{
                        label: 'Влажность почвы',
                        data: Array(24).fill(null),
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
            this.miniChart = new Chart(miniCtx, {
                type: 'line',
                data: {
                    labels: ['', '', '', '', ''],
                    datasets: [{
                        data: [null, null, null, null, null],
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
            
            console.log('📊 Графики инициализированы');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации графиков:', error);
        }
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
        try {
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
            
        } catch (error) {
            console.error('❌ Ошибка обновления UI:', error);
        }
    }

    updateControlButtons() {
        try {
            const pumpBtn = document.getElementById('manualPumpBtn');
            const lightBtn = document.getElementById('manualLightBtn');
            
            if (pumpBtn) {
                if (this.systemData.pump) {
                    pumpBtn.innerHTML = '<i class="fas fa-water"></i><span>Выключить насос</span>';
                    pumpBtn.classList.add('active');
                } else {
                    pumpBtn.innerHTML = '<i class="fas fa-water"></i><span>Включить насос</span>';
                    pumpBtn.classList.remove('active');
                }
            }
            
            if (lightBtn) {
                if (this.systemData.light) {
                    lightBtn.innerHTML = '<i class="fas fa-lightbulb"></i><span>Выключить свет</span>';
                    lightBtn.classList.add('active');
                } else {
                    lightBtn.innerHTML = '<i class="fas fa-lightbulb"></i><span>Включить свет</span>';
                    lightBtn.classList.remove('active');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обновления кнопок:', error);
        }
    }

    updateStats(stats) {
        if (!stats) return;
        
        try {
            this.stats = stats;
            
            const wateringsEl = document.getElementById('wateringsToday');
            const waterSavedEl = document.getElementById('waterSaved');
            const lightHoursEl = document.getElementById('lightHours');
            const efficiencyEl = document.getElementById('efficiencyValue');
            
            if (wateringsEl) wateringsEl.textContent = stats.wateringsToday || 0;
            if (waterSavedEl) waterSavedEl.textContent = `${(stats.totalWaterUsed || 0).toFixed(1)}л`;
            
            // Расчет часов света (упрощенный)
            if (lightHoursEl && stats.totalPowerUsed) {
                const lightHours = (stats.totalPowerUsed / 0.2).toFixed(1);
                lightHoursEl.textContent = lightHours;
            }
            
            // Обновление прогресс-баров
            if (efficiencyEl) {
                const efficiency = Math.min(100, (stats.wateringsToday || 0) * 15);
                efficiencyEl.textContent = `${efficiency}%`;
                const progressFill = document.querySelector('#efficiencyValue').parentElement.nextElementSibling?.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = `${efficiency}%`;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обновления статистики:', error);
        }
    }

    updateSystemInfo(info) {
        if (!info) return;
        
        try {
            // Обновление статуса WiFi
            const wifiStatus = document.getElementById('wifiStatus');
            const wifiItem = document.getElementById('wifiStatusItem');
            
            if (wifiStatus && wifiItem && info.wifiRssi) {
                wifiStatus.textContent = info.wifiRssi > -70 ? 'Отличный' : 'Слабый';
                wifiItem.className = info.wifiRssi > -70 ? 'status-item online' : 'status-item warning';
            }
            
            // Обновление времени системы
            const lastUpdateEl = document.getElementById('lastSystemUpdate');
            if (lastUpdateEl && info.time) {
                lastUpdateEl.textContent = info.time;
            }
            
            // Обновление аптайма
            const uptimeEl = document.getElementById('uptime');
            const daysRunningEl = document.getElementById('daysRunning');
            if (uptimeEl && daysRunningEl && info.uptime) {
                const days = Math.floor(info.uptime / 86400);
                const hours = Math.floor((info.uptime % 86400) / 3600);
                const minutes = Math.floor((info.uptime % 3600) / 60);
                uptimeEl.textContent = `${days}д ${hours}ч ${minutes}м`;
                daysRunningEl.textContent = days + 1;
            }
            
            // Обновление загрузки системы
            const systemLoadEl = document.getElementById('systemLoad');
            if (systemLoadEl && info.freeHeap) {
                const load = Math.round((1 - info.freeHeap / 80000) * 100);
                systemLoadEl.textContent = `${load}%`;
                const progressFill = document.querySelector('#systemLoad').parentElement.nextElementSibling?.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = `${load}%`;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обновления информации системы:', error);
        }
    }

    updateArduinoStatus(status) {
        try {
            const arduinoStatus = document.getElementById('arduinoStatus');
            const arduinoItem = document.getElementById('arduinoStatusItem');
            
            if (arduinoStatus && arduinoItem) {
                if (status === 1) {
                    arduinoStatus.textContent = 'Онлайн';
                    arduinoItem.className = 'status-item online';
                } else {
                    arduinoStatus.textContent = 'Офлайн';
                    arduinoItem.className = 'status-item error';
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обновления статуса Arduino:', error);
        }
    }

    updateConnectionStatus(status) {
        try {
            const statusDot = document.querySelector('.status-dot');
            const statusText = document.querySelector('.status-indicator span:last-child');
            
            if (statusDot && statusText) {
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
        } catch (error) {
            console.error('❌ Ошибка обновления статуса подключения:', error);
        }
    }

    updateSensorStatus() {
        try {
            const sensorStatus = document.getElementById('sensorStatus');
            const sensorItem = document.getElementById('sensorStatusItem');
            const rtcStatus = document.getElementById('rtcStatus');
            const rtcItem = document.getElementById('rtcStatusItem');
            
            // Статус датчика влажности
            if (sensorStatus && sensorItem) {
                if (this.systemData.moisture > 0) {
                    sensorStatus.textContent = 'Работает';
                    sensorItem.className = 'status-item online';
                } else {
                    sensorStatus.textContent = 'Ошибка';
                    sensorItem.className = 'status-item error';
                }
            }
            
            // Статус RTC
            if (rtcStatus && rtcItem) {
                if (this.systemData.timestamp > 0) {
                    rtcStatus.textContent = 'Синхронизировано';
                    rtcItem.className = 'status-item online';
                } else {
                    rtcStatus.textContent = 'Ошибка';
                    rtcItem.className = 'status-item error';
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обновления статуса датчиков:', error);
        }
    }

    updateMoistureTrend() {
        try {
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
            
            const trendElement = document.getElementById('moistureTrend');
            const trendValueElement = document.getElementById('moistureTrendValue');
            
            if (trendElement) {
                trendElement.textContent = trend;
                trendElement.style.color = color;
            }
            
            if (trendValueElement) {
                trendValueElement.textContent = trend;
                trendValueElement.style.color = color;
            }
        } catch (error) {
            console.error('❌ Ошибка обновления тренда:', error);
        }
    }

    updateChart() {
        if (!this.chart) return;
        
        try {
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
            
        } catch (error) {
            console.error('❌ Ошибка обновления графика:', error);
        }
    }

    updateChartStats() {
        if (this.chartData.length === 0) return;
        
        try {
            const sum = this.chartData.reduce((a, b) => a + b, 0);
            const avg = Math.round(sum / this.chartData.length);
            const min = Math.min(...this.chartData);
            const max = Math.max(...this.chartData);
            
            const avgElement = document.getElementById('avgMoisture');
            const minElement = document.getElementById('minMoisture');
            const maxElement = document.getElementById('maxMoisture');
            
            if (avgElement) avgElement.textContent = `${avg}%`;
            if (minElement) minElement.textContent = `${min}%`;
            if (maxElement) maxElement.textContent = `${max}%`;
            
        } catch (error) {
            console.error('❌ Ошибка обновления статистики графика:', error);
        }
    }

    initEventListeners() {
        try {
            // Переключение темы
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.addEventListener('change', (e) => {
                    document.body.classList.toggle('dark-theme', e.target.checked);
                    this.showToast(`Тема изменена`, 'success');
                });
            }

            // Режим сна
            const sleepBtn = document.getElementById('sleepModeBtn');
            if (sleepBtn) {
                sleepBtn.addEventListener('click', () => {
                    this.showSleepModeModal();
                });
            }

            // Ручное управление насосом
            const pumpBtn = document.getElementById('manualPumpBtn');
            if (pumpBtn) {
                pumpBtn.addEventListener('click', () => {
                    this.togglePump();
                });
            }

            // Ручное управление светом
            const lightBtn = document.getElementById('manualLightBtn');
            if (lightBtn) {
                lightBtn.addEventListener('click', () => {
                    this.toggleLight();
                });
            }

            // Настройки
            const thresholdSlider = document.getElementById('moistureThreshold');
            if (thresholdSlider) {
                thresholdSlider.addEventListener('input', (e) => {
                    const valueDisplay = document.getElementById('thresholdValue');
                    if (valueDisplay) {
                        valueDisplay.textContent = `${e.target.value}%`;
                    }
                });

                thresholdSlider.addEventListener('change', (e) => {
                    this.updateSetting('threshold', e.target.value);
                });
            }

            const pumpDuration = document.getElementById('pumpDuration');
            if (pumpDuration) {
                pumpDuration.addEventListener('change', (e) => {
                    this.updateSetting('pumpTime', e.target.value);
                });
            }

            const checkInterval = document.getElementById('checkInterval');
            if (checkInterval) {
                checkInterval.addEventListener('change', (e) => {
                    this.updateSetting('checkInterval', e.target.value);
                });
            }

            // Автополив
            const autoWateringToggle = document.getElementById('autoWateringToggle');
            if (autoWateringToggle) {
                autoWateringToggle.addEventListener('change', (e) => {
                    this.updateSetting('autoWatering', e.target.checked);
                });
            }

            // Диапазоны времени
            document.querySelectorAll('.time-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.changeTimeRange(e.target.dataset.range);
                });
            });

            // Синхронизация времени
            const syncBtn = document.getElementById('syncTimeBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => {
                    this.syncTime();
                });
            }

            // Очистка ошибок
            const clearErrorsBtn = document.getElementById('clearErrorsBtn');
            if (clearErrorsBtn) {
                clearErrorsBtn.addEventListener('click', () => {
                    this.clearErrors();
                });
            }

            // Тестовое уведомление
            const testNotificationBtn = document.getElementById('testNotificationBtn');
            if (testNotificationBtn) {
                testNotificationBtn.addEventListener('click', () => {
                    this.sendTestNotification();
                });
            }

            // Расписание света
            const applyScheduleBtn = document.getElementById('applyScheduleBtn');
            if (applyScheduleBtn) {
                applyScheduleBtn.addEventListener('click', () => {
                    this.applyLightSchedule();
                });
            }

            // Модальные окна
            const confirmSleepBtn = document.getElementById('confirmSleepBtn');
            if (confirmSleepBtn) {
                confirmSleepBtn.addEventListener('click', () => {
                    this.activateSleepMode();
                });
            }

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
            
            console.log('🎛️ Слушатели событий инициализированы');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации слушателей событий:', error);
        }
    }

    startTimers() {
        // Обновление времени каждую секунду
        setInterval(() => {
            try {
                const now = new Date();
                const timeElement = document.getElementById('currentTime');
                if (timeElement) {
                    timeElement.textContent = now.toLocaleTimeString('ru-RU');
                }
            } catch (error) {
                console.error('❌ Ошибка обновления времени:', error);
            }
        }, 1000);

        // Проверка подключения каждые 30 секунд
        setInterval(() => {
            this.checkConnection();
        }, 30000);
        
        // Обновление визуализации света
        setInterval(() => {
            this.updateLightVisualization();
        }, 60000);
        
        console.log('⏱️ Таймеры запущены');
    }

    checkConnection() {
        if (this.lastUpdate && Date.now() - this.lastUpdate > 60000) {
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus(this.connectionStatus);
            this.showToast('Нет данных от системы более 1 минуты', 'warning');
        }
    }

    updateLightVisualization() {
        try {
            const lightPeriod = document.getElementById('lightPeriod');
            const startTime = document.getElementById('lightStartTime').value;
            const duration = parseInt(document.getElementById('lightDuration').value);
            
            if (!lightPeriod || !startTime || !duration) return;
            
            const [hours, minutes] = startTime.split(':').map(Number);
            const startPercent = (hours * 60 + minutes) / (24 * 60) * 100;
            const widthPercent = (duration * 60) / (24 * 60) * 100;
            
            lightPeriod.style.left = `${startPercent}%`;
            lightPeriod.style.width = `${widthPercent}%`;
        } catch (error) {
            console.error('❌ Ошибка обновления визуализации света:', error);
        }
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
        try {
            const errorsList = document.getElementById('errorsList');
            const noErrors = document.getElementById('noErrors');
            
            if (errorsList && noErrors) {
                errorsList.innerHTML = '';
                errorsList.style.display = 'none';
                noErrors.style.display = 'block';
            }
            
            this.showToast('История ошибок очищена', 'success');
        } catch (error) {
            console.error('❌ Ошибка очистки ошибок:', error);
        }
    }

    sendTestNotification() {
        this.showToast('Тестовое уведомление отправлено', 'success');
    }

    applyLightSchedule() {
        try {
            const startTime = document.getElementById('lightStartTime').value;
            const duration = document.getElementById('lightDuration').value;
            
            if (!startTime || !duration) {
                this.showToast('Заполните все поля расписания', 'warning');
                return;
            }
            
            const schedule = `${startTime}-${duration}`;
            this.updateSetting('lightSchedule', schedule);
        } catch (error) {
            console.error('❌ Ошибка применения расписания:', error);
            this.showToast('Ошибка применения расписания', 'error');
        }
    }

    showSleepModeModal() {
        try {
            const modal = document.getElementById('sleepModeModal');
            if (modal) {
                modal.classList.add('active');
            }
        } catch (error) {
            console.error('❌ Ошибка открытия модального окна:', error);
        }
    }

    async activateSleepMode() {
        try {
            const duration = document.getElementById('sleepDuration').value;
            await this.sendCommand('sleepMode', 'true');
            
            const modal = document.getElementById('sleepModeModal');
            if (modal) {
                modal.classList.remove('active');
            }
            
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
            try {
                const preloader = document.querySelector('.preloader');
                if (preloader) {
                    preloader.style.opacity = '0';
                    setTimeout(() => {
                        preloader.style.display = 'none';
                    }, 500);
                }
            } catch (error) {
                console.error('❌ Ошибка скрытия прелоадера:', error);
            }
        }, 1500);
    }

    showToast(message, type = 'info') {
        try {
            const container = document.getElementById('toastContainer');
            if (!container) return;
            
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
            
        } catch (error) {
            console.error('❌ Ошибка показа уведомления:', error);
        }
    }
}

// Убираем авто-инициализацию, она теперь в index.html
// Приложение будет инициализировано через index.html
