// EcoGrow Assistant - Рабочая версия
class EcoGrowApp {
    constructor() {
        // Проверяем, не инициализировано ли приложение уже
        if (window.ecoGrowApp) {
            console.warn('⚠️ Экземпляр EcoGrowApp уже существует');
            return;
        }
        
        this.systemData = {
            moisture: 50,  // Начальное значение для демо
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
            
            this.showToast('Firebase не подключен. Включаю демо-режим.', 'warning');
            
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
                
                if (window.firebaseDatabase && window.firebaseDatabase.ref) {
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
            setTimeout(checkFirebase, 1000);
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
                    console.log('📥 Данные получены из Firebase:', data);
                    this.updateSystemData(data);
                    this.lastUpdate = Date.now();
                } else {
                    console.log('📭 Нет данных в Firebase');
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
            
        } catch (error) {
            console.error('❌ Ошибка слушателей Firebase:', error);
        }
    }

    initCharts() {
        // Проверяем, не существует ли уже графиков
        const mainCanvas = document.getElementById('moistureChart');
        const miniCanvas = document.getElementById('miniMoistureChart');
        
        if (!mainCanvas) {
            console.error('❌ Canvas элемент moistureChart не найден');
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
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        
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
                        data: Array(24).fill(50),
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
            
            console.log('📊 График инициализирован');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации графиков:', error);
        }
    }

    updateSystemData(data) {
        // Обновляем данные
        this.systemData.moisture = data.moisture || 50;
        this.systemData.pump = data.pump || 0;
        this.systemData.light = data.light || 0;
        this.systemData.temperature = data.temperature || 25;
        this.systemData.humidity = data.humidity || 50;
        this.systemData.timestamp = data.timestamp || Date.now();
        
        console.log('📊 Обновление данных:', this.systemData);
        
        this.updateUI();
        this.updateChart();
    }

    updateUI() {
        try {
            // Основные показатели
            const moistureEl = document.getElementById('moistureValue');
            const temperatureEl = document.getElementById('temperatureValue');
            const pumpStatusEl = document.getElementById('pumpStatus');
            const lightStatusEl = document.getElementById('lightStatus');
            
            if (moistureEl) moistureEl.textContent = `${this.systemData.moisture}%`;
            if (temperatureEl) temperatureEl.textContent = `${this.systemData.temperature}°C`;
            if (pumpStatusEl) pumpStatusEl.textContent = this.systemData.pump ? 'ВКЛ' : 'ВЫКЛ';
            if (lightStatusEl) lightStatusEl.textContent = this.systemData.light ? 'ВКЛ' : 'ВЫКЛ';
            
            // Обновление времени
            const now = new Date();
            const lastUpdateEl = document.getElementById('lastUpdate');
            const currentTimeEl = document.getElementById('currentTime');
            
            if (lastUpdateEl) {
                lastUpdateEl.textContent = `Обновлено: ${now.toLocaleTimeString('ru-RU')}`;
            }
            
            if (currentTimeEl) {
                currentTimeEl.textContent = now.toLocaleTimeString('ru-RU');
            }
            
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
            const pumpBtn = document.getElementById('togglePumpBtn');
            const lightBtn = document.getElementById('toggleLightBtn');
            const pumpBtnText = document.getElementById('pumpBtnText');
            const lightBtnText = document.getElementById('lightBtnText');
            
            if (pumpBtn && pumpBtnText) {
                if (this.systemData.pump) {
                    pumpBtnText.textContent = 'Выключить насос';
                    pumpBtn.classList.add('active');
                } else {
                    pumpBtnText.textContent = 'Включить насос';
                    pumpBtn.classList.remove('active');
                }
            }
            
            if (lightBtn && lightBtnText) {
                if (this.systemData.light) {
                    lightBtnText.textContent = 'Выключить свет';
                    lightBtn.classList.add('active');
                } else {
                    lightBtnText.textContent = 'Включить свет';
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
            
            // Расчет часов света
            if (lightHoursEl) {
                const lightHours = (stats.totalPowerUsed || 0).toFixed(1);
                lightHoursEl.textContent = lightHours;
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления статистики:', error);
        }
    }

    updateSystemInfo(info) {
        if (!info) return;
        
        try {
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
                        break;
                    case 'disconnected':
                        statusDot.className = 'status-dot';
                        statusText.textContent = 'Отключено';
                        break;
                    default:
                        statusDot.className = 'status-dot';
                        statusText.textContent = 'Ошибка';
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
            
            const trendElement = document.getElementById('trendValue');
            
            if (trendElement) {
                trendElement.textContent = trend;
                trendElement.style.color = color;
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
            
            // Обновляем метки времени
            this.chart.data.labels.shift();
            this.chart.data.labels.push(timeLabel);
            
            // Обновляем данные
            this.chart.data.datasets[0].data = [...this.chartData];
            this.chart.update('none');
            
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
            console.log('🎛️ Инициализация слушателей событий...');

            // Управление насосом
            const pumpBtn = document.getElementById('togglePumpBtn');
            if (pumpBtn) {
                pumpBtn.addEventListener('click', () => {
                    this.togglePump();
                });
            }

            // Управление светом
            const lightBtn = document.getElementById('toggleLightBtn');
            if (lightBtn) {
                lightBtn.addEventListener('click', () => {
                    this.toggleLight();
                });
            }

            // Порог влажности
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

            // Длительность полива
            const pumpDuration = document.getElementById('pumpDuration');
            if (pumpDuration) {
                pumpDuration.addEventListener('change', (e) => {
                    this.updateSetting('pumpTime', e.target.value);
                });
            }

            // Автополив
            const autoWateringToggle = document.getElementById('autoWateringToggle');
            if (autoWateringToggle) {
                autoWateringToggle.addEventListener('change', (e) => {
                    this.updateSetting('autoWatering', e.target.checked);
                });
            }

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

            // Кнопки быстрого полива
            const quickWaterButtons = document.querySelectorAll('[onclick^="quickWater"]');
            quickWaterButtons.forEach(btn => {
                const onclick = btn.getAttribute('onclick');
                const seconds = onclick.match(/quickWater\((\d+)\)/)[1];
                btn.addEventListener('click', () => {
                    this.quickWater(parseInt(seconds));
                });
            });
            
            console.log('✅ Слушатели событий инициализированы');
            
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
        
        console.log('⏱️ Таймеры запущены');
    }

    checkConnection() {
        if (this.lastUpdate && Date.now() - this.lastUpdate > 60000) {
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus(this.connectionStatus);
            this.showToast('Нет данных от системы более 1 минуты', 'warning');
        }
    }

    async togglePump() {
        try {
            const newState = !this.systemData.pump;
            const command = newState ? 'ON' : 'OFF';
            
            await this.sendCommand('pump', command);
            this.systemData.pump = newState ? 1 : 0;
            this.updateUI();
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
            this.systemData.light = newState ? 1 : 0;
            this.updateUI();
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
                    console.log('DEMO: Отправка команды', type, '=', value);
                    // В демо-режиме симулируем отправку команды
                    setTimeout(() => {
                        this.showToast(`Команда отправлена: ${type}=${value}`, 'success');
                        resolve();
                    }, 500);
                    return;
                }
                
                const commandRef = this.db.ref(`commands/${type}`);
                commandRef.set(value)
                    .then(() => {
                        console.log(`✅ Команда отправлена: ${type}=${value}`);
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
            const errorList = document.getElementById('errorList');
            if (errorList) {
                errorList.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-check-circle"></i>
                        <p>Ошибок не обнаружено</p>
                    </div>
                `;
            }
            
            this.showToast('История ошибок очищена', 'success');
        } catch (error) {
            console.error('❌ Ошибка очистки ошибок:', error);
        }
    }

    quickWater(seconds) {
        this.sendCommand('quickWater', seconds.toString())
            .then(() => {
                this.showToast(`Быстрый полив на ${seconds} секунд`, 'info');
                // Временное включение насоса в UI
                this.systemData.pump = 1;
                this.updateUI();
                
                // Автоматическое выключение через указанное время
                setTimeout(() => {
                    this.systemData.pump = 0;
                    this.updateUI();
                    this.showToast('Полив завершен', 'success');
                }, seconds * 1000);
            })
            .catch(error => {
                console.error('Ошибка быстрого полива:', error);
                this.showToast('Ошибка полива', 'error');
            });
    }

    startDemoMode() {
        console.log('🔄 Запуск демо-режима');
        
        // Симуляция получения данных каждые 3 секунды
        setInterval(() => {
            // Генерация реалистичных данных
            const moistureChange = (Math.random() - 0.5) * 2; // -1 до +1
            this.systemData.moisture = Math.max(20, Math.min(80, 
                this.systemData.moisture + moistureChange
            ));
            
            // Случайное включение/выключение насоса и света
            if (Math.random() > 0.95) {
                this.systemData.pump = 1 - this.systemData.pump;
            }
            if (Math.random() > 0.97) {
                this.systemData.light = 1 - this.systemData.light;
            }
            
            // Температура и влажность
            this.systemData.temperature = 22 + Math.sin(Date.now() / 100000) * 3;
            this.systemData.humidity = 40 + Math.cos(Date.now() / 150000) * 20;
            
            this.systemData.timestamp = Date.now();
            
            this.updateUI();
            this.updateChart();
            
        }, 3000);
    }

    hidePreloader() {
        setTimeout(() => {
            try {
                const preloader = document.getElementById('preloader');
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
            if (!container) {
                console.log('Toast container не найден, создаю...');
                // Создаем контейнер если его нет
                const newContainer = document.createElement('div');
                newContainer.id = 'toastContainer';
                newContainer.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1000;';
                document.body.appendChild(newContainer);
                this.showToast(message, type);
                return;
            }
            
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.style.cssText = `
                background: #1e293b;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 10px;
                animation: slideIn 0.3s ease;
                max-width: 350px;
            `;
            
            // Добавляем анимацию если ее нет
            if (!document.querySelector('#toast-animations')) {
                const style = document.createElement('style');
                style.id = 'toast-animations';
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100px); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideOut {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100px); opacity: 0; }
                    }
                    .toast { border-left: 4px solid #3b82f6; }
                    .toast.success { border-left-color: #10b981; }
                    .toast.error { border-left-color: #ef4444; }
                    .toast.warning { border-left-color: #f59e0b; }
                `;
                document.head.appendChild(style);
            }
            
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
                toast.style.animation = 'slideOut 0.5s ease forwards';
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

// Инициализация приложения при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен, запуск приложения...');
    window.ecoGrowApp = new EcoGrowApp();
});
