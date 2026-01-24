// EcoGrow Assistant - Рабочая версия
class EcoGrowApp {
    constructor() {
        // Проверяем, не инициализировано ли приложение уже
        if (window.ecoGrowApp) {
            console.warn('⚠️ Экземпляр EcoGrowApp уже существует');
            return;
        }
        
        this.systemData = {
            moisture: 50,
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
        this.isInitialized = false;
        
        // Сохраняем экземпляр в глобальной области
        window.ecoGrowApp = this;
        window.app = this;
        
        // Инициализация при загрузке DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        if (this.isInitialized) {
            console.warn('⚠️ Приложение уже инициализировано');
            return;
        }
        
        console.log('🚀 Инициализация EcoGrow Assistant...');
        this.isInitialized = true;
        
        try {
            // Обновляем статус прелоадера
            const preloaderStatus = document.getElementById('preloaderStatus');
            if (preloaderStatus) {
                preloaderStatus.textContent = 'Проверка элементов...';
            }
            
            // Проверяем основные элементы
            this.checkEssentialElements();
            
            // Инициализируем Firebase
            await this.initFirebase();
            
            // Инициализируем компоненты
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

    checkEssentialElements() {
        console.log('🔍 Проверка элементов...');
        
        const essentialElements = [
            'moistureValue', 'pumpStatus', 'lightStatus',
            'manualPumpBtn', 'manualLightBtn', 'moistureChart',
            'currentTime', 'lastUpdate', 'statusDot', 'statusText'
        ];
        
        essentialElements.forEach(id => {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`❌ Критический элемент #${id} не найден!`);
            } else {
                console.log(`✅ Элемент #${id} найден`);
            }
        });
    }

    async initFirebase() {
        return new Promise((resolve, reject) => {
            console.log('🔌 Подключение к Firebase...');
            
            const checkFirebase = () => {
                if (window.firebaseDatabase && typeof window.firebaseDatabase.ref === 'function') {
                    console.log('✅ Firebase готов к работе');
                    this.db = window.firebaseDatabase;
                    this.isFirebaseReady = true;
                    
                    // Запуск слушателей Firebase
                    this.startFirebaseListeners();
                    
                    // Обновление статуса
                    this.updateConnectionStatus('connected');
                    
                    resolve();
                } else {
                    console.log('⏳ Ожидание Firebase...');
                    setTimeout(checkFirebase, 500);
                }
            };
            
            // Даем время на загрузку Firebase
            setTimeout(() => {
                if (!window.firebaseDatabase) {
                    console.warn('⚠️ Firebase не загрузился');
                    reject(new Error('Firebase не загрузился'));
                } else {
                    checkFirebase();
                }
            }, 3000);
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
                    console.log('📥 Данные из Firebase:', data);
                    this.updateSystemData(data);
                    this.lastUpdate = Date.now();
                    this.updateConnectionStatus('connected');
                }
            }, (error) => {
                console.error('❌ Ошибка чтения данных:', error);
                this.updateConnectionStatus('error');
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
        const mainCanvas = document.getElementById('moistureChart');
        if (!mainCanvas) {
            console.error('❌ Canvas элемент не найден');
            return;
        }
        
        try {
            // Уничтожаем старый график если есть
            if (this.chart) {
                this.chart.destroy();
            }
            
            // Создаем новый график
            const ctx = mainCanvas.getContext('2d');
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 12}, (_, i) => {
                        const hour = new Date().getHours();
                        return `${((hour - 11 + i + 24) % 24).toString().padStart(2, '0')}:00`;
                    }),
                    datasets: [{
                        label: 'Влажность почвы',
                        data: Array(12).fill(50),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: 'rgb(59, 130, 246)',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
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
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#e2e8f0',
                            bodyColor: '#cbd5e1',
                            callbacks: {
                                label: (context) => `Влажность: ${context.parsed.y}%`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { 
                                color: 'rgba(148, 163, 184, 0.1)',
                                drawBorder: false
                            },
                            ticks: { 
                                color: '#94a3b8',
                                maxRotation: 0
                            }
                        },
                        y: {
                            min: 0,
                            max: 100,
                            grid: { 
                                color: 'rgba(148, 163, 184, 0.1)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#94a3b8',
                                callback: (value) => value + '%'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
            
            console.log('📊 График инициализирован');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации графика:', error);
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
        
        console.log('🔄 Обновление данных:', {
            moisture: this.systemData.moisture,
            pump: this.systemData.pump,
            light: this.systemData.light
        });
        
        this.updateUI();
        this.updateChart();
    }

    updateUI() {
        try {
            // Основные показатели
            const moistureEl = document.getElementById('moistureValue');
            const pumpStatusEl = document.getElementById('pumpStatus');
            const lightStatusEl = document.getElementById('lightStatus');
            
            if (moistureEl) {
                moistureEl.textContent = `${this.systemData.moisture}%`;
                moistureEl.style.color = this.getMoistureColor(this.systemData.moisture);
            }
            
            if (pumpStatusEl) {
                pumpStatusEl.textContent = this.systemData.pump ? 'ВКЛ' : 'ВЫКЛ';
                pumpStatusEl.style.color = this.systemData.pump ? '#10b981' : '#ef4444';
            }
            
            if (lightStatusEl) {
                lightStatusEl.textContent = this.systemData.light ? 'ВКЛ' : 'ВЫКЛ';
                lightStatusEl.style.color = this.systemData.light ? '#f59e0b' : '#94a3b8';
            }
            
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
            
        } catch (error) {
            console.error('❌ Ошибка обновления UI:', error);
        }
    }

    getMoistureColor(moisture) {
        if (moisture < 30) return '#ef4444'; // Красный
        if (moisture < 50) return '#f59e0b'; // Оранжевый
        if (moisture < 70) return '#10b981'; // Зеленый
        return '#3b82f6'; // Синий
    }

    updateControlButtons() {
        try {
            const pumpBtn = document.getElementById('manualPumpBtn');
            const lightBtn = document.getElementById('manualLightBtn');
            const pumpBtnText = document.getElementById('pumpBtnText');
            const lightBtnText = document.getElementById('lightBtnText');
            
            if (pumpBtn && pumpBtnText) {
                if (this.systemData.pump) {
                    pumpBtnText.textContent = 'Выключить насос';
                    pumpBtn.classList.add('active');
                    pumpBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                } else {
                    pumpBtnText.textContent = 'Включить насос';
                    pumpBtn.classList.remove('active');
                    pumpBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
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
            
            if (wateringsEl) wateringsEl.textContent = stats.wateringsToday || 0;
            if (waterSavedEl) waterSavedEl.textContent = `${(stats.totalWaterUsed || 0).toFixed(1)}л`;
            
        } catch (error) {
            console.error('❌ Ошибка обновления статистики:', error);
        }
    }

    updateSystemInfo(info) {
        if (!info) return;
        
        try {
            // Обновление аптайма
            const uptimeEl = document.getElementById('uptime');
            if (uptimeEl && info.uptime) {
                const days = Math.floor(info.uptime / 86400);
                const hours = Math.floor((info.uptime % 86400) / 3600);
                const minutes = Math.floor((info.uptime % 3600) / 60);
                uptimeEl.textContent = `${days}д ${hours}ч ${minutes}м`;
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления информации системы:', error);
        }
    }

    updateArduinoStatus(status) {
        try {
            const arduinoStatus = document.getElementById('arduinoStatus');
            if (arduinoStatus) {
                arduinoStatus.textContent = status ? 'Онлайн' : 'Офлайн';
                arduinoStatus.style.color = status ? '#10b981' : '#ef4444';
            }
        } catch (error) {
            console.error('❌ Ошибка обновления статуса Arduino:', error);
        }
    }

    updateConnectionStatus(status) {
        try {
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            
            if (statusDot && statusText) {
                switch(status) {
                    case 'connected':
                        statusDot.className = 'status-dot connected';
                        statusDot.style.background = '#10b981';
                        statusText.textContent = 'Подключено';
                        break;
                    case 'disconnected':
                        statusDot.className = 'status-dot disconnected';
                        statusDot.style.background = '#ef4444';
                        statusText.textContent = 'Отключено';
                        break;
                    case 'error':
                        statusDot.className = 'status-dot';
                        statusDot.style.background = '#f59e0b';
                        statusText.textContent = 'Ошибка';
                        break;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обновления статуса подключения:', error);
        }
    }

    updateMoistureTrend() {
        try {
            if (this.chartData.length < 2) return;
            
            const current = this.systemData.moisture;
            const previous = this.chartData[this.chartData.length - 2] || current;
            
            let trend, color;
            if (current > previous + 2) {
                trend = '↗';
                color = '#10b981';
            } else if (current < previous - 2) {
                trend = '↘';
                color = '#ef4444';
            } else {
                trend = '→';
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
            // Добавляем данные в историю
            this.chartData.push(this.systemData.moisture);
            if (this.chartData.length > this.maxChartPoints) {
                this.chartData.shift();
            }
            
            // Обновляем график
            const now = new Date();
            const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                             now.getMinutes().toString().padStart(2, '0');
            
            // Сдвигаем метки времени
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
        console.log('🎛️ Инициализация слушателей событий...');
        
        try {
            // 1. Ручное управление насосом
            const pumpBtn = document.getElementById('manualPumpBtn');
            if (pumpBtn) {
                console.log('✅ Обработчик кнопки насоса');
                pumpBtn.addEventListener('click', () => {
                    console.log('👉 Кнопка насоса нажата');
                    this.togglePump();
                });
            }

            // 2. Ручное управление светом
            const lightBtn = document.getElementById('manualLightBtn');
            if (lightBtn) {
                console.log('✅ Обработчик кнопки света');
                lightBtn.addEventListener('click', () => {
                    console.log('👉 Кнопка света нажата');
                    this.toggleLight();
                });
            }

            // 3. Быстрый полив
            document.querySelectorAll('.quick-water-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const seconds = parseInt(e.target.dataset.seconds);
                    console.log(`👉 Быстрый полив на ${seconds} секунд`);
                    this.quickWater(seconds);
                });
            });

            // 4. Слайдер порога влажности
            const thresholdSlider = document.getElementById('moistureThreshold');
            if (thresholdSlider) {
                const valueDisplay = document.getElementById('thresholdValue');
                
                thresholdSlider.addEventListener('input', (e) => {
                    if (valueDisplay) {
                        valueDisplay.textContent = `${e.target.value}%`;
                    }
                });

                thresholdSlider.addEventListener('change', (e) => {
                    console.log('📊 Изменение порога влажности:', e.target.value);
                    this.updateSetting('threshold', e.target.value);
                });
            }

            // 5. Длительность полива
            const pumpDuration = document.getElementById('pumpDuration');
            if (pumpDuration) {
                pumpDuration.addEventListener('change', (e) => {
                    console.log('⏱️ Изменение длительности полива:', e.target.value);
                    this.updateSetting('pumpTime', e.target.value);
                });
            }

            // 6. Автополив
            const autoWateringToggle = document.getElementById('autoWateringToggle');
            if (autoWateringToggle) {
                autoWateringToggle.addEventListener('change', (e) => {
                    console.log('🤖 Изменение автополива:', e.target.checked);
                    this.updateSetting('autoWatering', e.target.checked);
                });
            }

            // 7. Синхронизация времени
            const syncBtn = document.getElementById('syncTimeBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => {
                    console.log('⏰ Синхронизация времени');
                    this.syncTime();
                });
            }

            // 8. Очистка ошибок
            const clearErrorsBtn = document.getElementById('clearErrorsBtn');
            if (clearErrorsBtn) {
                clearErrorsBtn.addEventListener('click', () => {
                    console.log('🧹 Очистка ошибок');
                    this.clearErrors();
                });
            }

            console.log('✅ Все обработчики событий инициализированы');
            
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
            this.updateConnectionStatus('disconnected');
            this.showToast('Нет данных от системы более 1 минуты', 'warning');
        }
    }

    async togglePump() {
        console.log('🔧 Переключение насоса...');
        
        try {
            const newState = !this.systemData.pump;
            const command = newState ? 'ON' : 'OFF';
            
            await this.sendCommand('pump', command);
            
            // Локальное обновление UI
            this.systemData.pump = newState ? 1 : 0;
            this.updateControlButtons();
            
            const pumpStatusEl = document.getElementById('pumpStatus');
            if (pumpStatusEl) {
                pumpStatusEl.textContent = newState ? 'ВКЛ' : 'ВЫКЛ';
                pumpStatusEl.style.color = newState ? '#10b981' : '#ef4444';
            }
            
            this.showToast(`Насос ${newState ? 'включен' : 'выключен'}`, 'success');
            
        } catch (error) {
            console.error('❌ Ошибка управления насосом:', error);
            this.showToast('Ошибка отправки команды', 'error');
        }
    }

    async toggleLight() {
        console.log('💡 Переключение света...');
        
        try {
            const newState = !this.systemData.light;
            const command = newState ? 'ON' : 'OFF';
            
            await this.sendCommand('light', command);
            
            // Локальное обновление UI
            this.systemData.light = newState ? 1 : 0;
            this.updateControlButtons();
            
            const lightStatusEl = document.getElementById('lightStatus');
            if (lightStatusEl) {
                lightStatusEl.textContent = newState ? 'ВКЛ' : 'ВЫКЛ';
                lightStatusEl.style.color = newState ? '#f59e0b' : '#94a3b8';
            }
            
            this.showToast(`Свет ${newState ? 'включен' : 'выключен'}`, 'success');
            
        } catch (error) {
            console.error('❌ Ошибка управления светом:', error);
            this.showToast('Ошибка отправки команды', 'error');
        }
    }

    async sendCommand(type, value) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    console.log('DEMO: Отправка команды', type, '=', value);
                    // В демо-режиме симулируем отправку
                    setTimeout(() => {
                        console.log('✅ Демо-команда выполнена');
                        resolve();
                    }, 300);
                    return;
                }
                
                console.log(`📤 Отправка команды в Firebase: ${type}=${value}`);
                
                const commandRef = this.db.ref(`commands/${type}`);
                commandRef.set(value)
                    .then(() => {
                        console.log(`✅ Команда отправлена в Firebase`);
                        resolve();
                    })
                    .catch(error => {
                        console.error('❌ Ошибка отправки в Firebase:', error);
                        reject(error);
                    });
                    
            } catch (error) {
                console.error('❌ Критическая ошибка отправки:', error);
                reject(error);
            }
        });
    }

    quickWater(seconds) {
        console.log(`💧 Быстрый полив на ${seconds} секунд`);
        
        // Временное включение насоса в UI
        const originalState = this.systemData.pump;
        this.systemData.pump = 1;
        this.updateControlButtons();
        
        const pumpStatusEl = document.getElementById('pumpStatus');
        if (pumpStatusEl) {
            pumpStatusEl.textContent = 'ВКЛ';
            pumpStatusEl.style.color = '#10b981';
        }
        
        this.showToast(`⏱️ Полив на ${seconds} секунд`, 'info');
        
        // Отправляем команду в фоновом режиме
        this.sendCommand('quickWater', seconds.toString())
            .then(() => {
                console.log(`✅ Команда быстрого полива отправлена`);
            })
            .catch(error => {
                console.error('❌ Ошибка быстрого полива:', error);
            });
        
        // Автоматическое выключение через указанное время
        setTimeout(() => {
            this.systemData.pump = originalState;
            this.updateControlButtons();
            
            if (pumpStatusEl) {
                pumpStatusEl.textContent = originalState ? 'ВКЛ' : 'ВЫКЛ';
                pumpStatusEl.style.color = originalState ? '#10b981' : '#ef4444';
            }
            
            this.showToast('✅ Полив завершен', 'success');
        }, seconds * 1000);
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

    startDemoMode() {
        console.log('🔄 Запуск демо-режима');
        
        // Симуляция получения данных каждые 3 секунды
        setInterval(() => {
            // Генерация реалистичных данных
            const moistureChange = (Math.random() - 0.5) * 2;
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
                const newContainer = document.createElement('div');
                newContainer.id = 'toastContainer';
                newContainer.style.cssText = `
                    position: fixed;
                    bottom: 25px;
                    right: 25px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    align-items: flex-end;
                `;
                document.body.appendChild(newContainer);
                this.showToast(message, type);
                return;
            }
            
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

// Автоматическая инициализация при загрузке
window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен, запуск приложения...');
    if (!window.ecoGrowApp) {
        window.ecoGrowApp = new EcoGrowApp();
    }
});

// Глобальная функция для быстрого полива (для совместимости)
window.quickWater = function(seconds) {
    if (window.ecoGrowApp) {
        window.ecoGrowApp.quickWater(seconds);
    }
};
