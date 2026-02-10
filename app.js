class EcoGrowApp {
    constructor() {
        this.api = new EcoGrowAPI();
        this.charts = new ChartsManager();
        this.theme = new ThemeManager();
        this.notifications = new NotificationManager();
        this.config = new ConfigManager();
        
        this.state = {
            connected: false,
            demoMode: false,
            espIp: null,
            currentData: null,
            settings: {},
            lastUpdate: null,
            updateInterval: 5000,
            connectionRetryCount: 0,
            maxRetries: 5,
            lastLatencyMs: null
        };
        
        this.init();
    }
    
    async init() {
        this.theme.init();
        this.showLoading();
        
        await this.tryAutoConnect();
        this.hideLoading();
        
        this.charts.init();
        this.startUpdateLoop();
        this.setupEventListeners();
        this.initPWA();
        this.initNetworkListeners();
    }
    
    initPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            const installBtn = document.getElementById('pwaInstallBtn');
            if (installBtn) {
                installBtn.style.display = 'flex';
                installBtn.addEventListener('click', () => this.installPWA());
            }
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Запущено как PWA');
        }
    }
    
    initNetworkListeners() {
        if (navigator.connection) {
            navigator.connection.addEventListener('change', () => {
                this.handleNetworkChange();
            });
        }
    }
    
    handleNetworkChange() {
        if (navigator.onLine && !this.state.connected && !this.state.demoMode) {
            this.notifications.show('📡 Сеть доступна, проверяем подключение...', 'info');
            this.tryAutoConnect();
        }
    }
    
    async installPWA() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('PWA установлено');
            const installBtn = document.getElementById('pwaInstallBtn');
            if (installBtn) installBtn.style.display = 'none';
        }
        
        this.deferredPrompt = null;
    }
    
    showLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '1';
            loadingScreen.style.pointerEvents = 'all';
        }
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainContainer = document.getElementById('mainContainer');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                if (mainContainer) {
                    mainContainer.style.display = 'block';
                }
            }, 500);
        }
    }
    
    async tryAutoConnect() {
        const savedIp = localStorage.getItem('ecogrow_ip');
        if (savedIp) {
            this.state.espIp = savedIp;
            const connected = await this.connectToESP();
            if (connected) return;
        }
        
        this.showConnectionModal();
    }
    
    showConnectionModal() {
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    hideConnectionModal() {
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    async connectToESP() {
        if (!this.state.espIp) {
            this.notifications.show('❌ Введите IP адрес устройства', 'error');
            this.showConnectionModal();
            return false;
        }
        
        try {
            this.showLoading();
            
            this.state.demoMode = false;
            const isConnected = await this.api.testConnection(this.state.espIp);
            
            if (!isConnected) {
                throw new Error(`Устройство ${this.state.espIp} недоступно`);
            }
            
            const info = await this.api.getInfo(this.state.espIp);
            
            localStorage.setItem('ecogrow_ip', this.state.espIp);
            this.state.connectionRetryCount = 0;
            this.state.connected = true;
            this.updateConnectionStatus();
            
            const demoBanner = document.getElementById('demoBanner');
            if (demoBanner) demoBanner.style.display = 'none';
            
            await this.updateData();
            this.hideConnectionModal();
            
            this.notifications.show(`✅ Успешно подключено к ${info.hostname || this.state.espIp}!`, 'success');
            return true;
            
        } catch (error) {
            console.error('Ошибка подключения:', error);
            
            this.state.connected = false;
            this.updateConnectionStatus();
            this.clearStaleData();
            
            this.state.connectionRetryCount++;
            
            if (this.state.connectionRetryCount < this.state.maxRetries) {
                this.notifications.show(
                    `❌ Попытка ${this.state.connectionRetryCount}/${this.state.maxRetries}: ${error.message}`,
                    'error',
                    5000
                );
            } else {
                this.notifications.show(
                    '❌ Не удалось подключиться к системе',
                    'error',
                    5000
                );
                this.showConnectionModal();
            }
            return false;
        } finally {
            this.hideLoading();
        }
    }
    
    async startDemoMode() {
        this.state.demoMode = true;
        this.state.connected = true;
        this.state.espIp = 'demo-mode';
        
        const randomOffset = Math.random() * 10;
        
        this.state.currentData = {
            moisture: Math.round(50 + Math.sin(Date.now() / 60000) * 15 + randomOffset),
            avg_moisture: Math.round(55 + randomOffset),
            min_moisture: Math.round(40 + randomOffset),
            max_moisture: Math.round(70 + randomOffset),
            pump: false,
            light: false,
            moisture_threshold: 50,
            watering_delay: 30,
            watering_duration: 10,
            manual_pump_time: 10,
            manual_light_time: 1,
            current_time: new Date().toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            sleep_enabled: false,
            sleep_start: "23:00",
            sleep_end: "07:00",
            lamp_enabled: true,
            lamp_start: "08:00",
            lamp_end: "20:00",
            total_waterings: Math.round(124 + Math.random() * 20),
            total_light_hours: Math.round(356 + Math.random() * 50),
            total_energy: Math.round(17800 + Math.random() * 1000),
            errors: [],
            moisture_history: Array.from({length: 20}, (_, i) => 
                60 + Math.sin((i + randomOffset) * 0.5) * 10 + Math.random() * 5
            )
        };
        
        this.state.currentData.min_moisture = this.state.currentData.moisture;
        this.state.currentData.max_moisture = this.state.currentData.moisture;
        
        this.updateConnectionStatus();
        this.updateUI(this.state.currentData);
        this.charts.updateMoistureChart(this.state.currentData.moisture_history);
        
        const demoBanner = document.getElementById('demoBanner');
        if (demoBanner) demoBanner.style.display = 'flex';
        
        this.notifications.show('🔧 Запущен демо-режим', 'info');
        this.hideConnectionModal();
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (this.state.connected) {
                if (this.state.demoMode) {
                    statusElement.innerHTML = `
                        <div class="status-dot" style="background: var(--accent-orange)"></div>
                        <span>Демо-режим</span>
                    `;
                    statusElement.classList.add('connected');
                } else {
                    const shortIp = this.state.espIp ? 
                        (this.state.espIp.length > 20 ? 
                            this.state.espIp.substring(0, 17) + '...' : 
                            this.state.espIp) : 
                        '--';
                    statusElement.innerHTML = `
                        <div class="status-dot"></div>
                        <span>Подключено: ${shortIp}</span>
                    `;
                    statusElement.classList.add('connected');
                }
            } else {
                statusElement.innerHTML = `
                    <div class="status-dot"></div>
                    <span>Не подключено</span>
                `;
                statusElement.classList.remove('connected');
            }
        }

        this.updateConnectionMetrics();
    }
    
    async updateData() {
        if (!this.state.connected) return;
        
        if (this.state.demoMode) {
            const now = new Date();
            const hour = now.getHours();
            
            if (hour >= 8 && hour < 20) {
                this.state.currentData.light = true;
            } else {
                this.state.currentData.light = false;
            }
            
            this.state.currentData.moisture = Math.max(20, Math.min(80, 
                60 + Math.sin(Date.now() / 60000) * 10 + Math.random() * 5
            ));
            
            if (this.state.currentData.moisture < this.state.currentData.min_moisture) {
                this.state.currentData.min_moisture = this.state.currentData.moisture;
            }
            if (this.state.currentData.moisture > this.state.currentData.max_moisture) {
                this.state.currentData.max_moisture = this.state.currentData.moisture;
            }
            
            this.state.currentData.current_time = now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            this.state.currentData.moisture_history.push(this.state.currentData.moisture);
            if (this.state.currentData.moisture_history.length > 20) {
                this.state.currentData.moisture_history.shift();
            }
            
            this.updateUI(this.state.currentData);
            this.charts.updateMoistureChart(this.state.currentData.moisture_history);
            return;
        }
        
        try {
            const startTime = performance.now();
            const data = await this.api.getState(this.state.espIp);
            const endTime = performance.now();
            
            this.state.lastLatencyMs = Math.round(endTime - startTime);
            this.state.currentData = data;
            this.state.lastUpdate = new Date();
            this.state.connectionRetryCount = 0;
            
            this.updateUI(data);
            this.charts.updateMoistureChart(data.moisture_history);
            this.checkNotifications(data);
            
        } catch (error) {
            console.error('Ошибка обновления данных:', error);
            
            this.state.connectionRetryCount++;
            this.updateConnectionMetrics();
            
            if (this.state.connectionRetryCount >= 3) {
                this.state.connected = false;
                this.updateConnectionStatus();
                this.clearStaleData();
                this.notifications.show('❌ Потеряно соединение с устройством', 'error');
                
                setTimeout(() => {
                    if (!this.state.connected && !this.state.demoMode) {
                        this.showConnectionModal();
                    }
                }, 1000);
            }
        }
    }
    
    clearStaleData() {
        const staleElements = [
            'moistureValue', 'avgMoisture', 'minMoisture', 'maxMoisture',
            'pumpStatus', 'lightStatus', 'currentTime', 'systemTime',
            'totalWaterings', 'totalLightHours', 'energyUsed',
            'moistureStatus', 'thresholdValue', 'lightToday'
        ];
        
        staleElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'moistureStatus') {
                    element.textContent = '--%';
                } else if (id === 'thresholdValue') {
                    element.textContent = '50%';
                } else if (id === 'pumpStatus' || id === 'lightStatus') {
                    element.textContent = '--';
                    element.className = 'card-status';
                } else if (id === 'lightToday') {
                    element.textContent = '0 ч';
                } else {
                    element.textContent = '--';
                }
            }
        });
        
        const thresholdSlider = document.getElementById('moistureThreshold');
        if (thresholdSlider) thresholdSlider.value = 50;
        
        const moistureBarFill = document.getElementById('moistureBarFill');
        if (moistureBarFill) moistureBarFill.style.width = '0%';
        
        if (this.charts) {
            this.charts.clearChart();
        }
        
        this.updateErrorsList([]);
    }
    
    updateUI(data) {
        if (!data) return;
        
        this.updateElement('moistureValue', Math.round(data.moisture));
        this.updateElement('avgMoisture', Math.round(data.avg_moisture || data.moisture) + '%');
        this.updateElement('minMoisture', Math.round(data.min_moisture || data.moisture) + '%');
        this.updateElement('maxMoisture', Math.round(data.max_moisture || data.moisture) + '%');
        
        const moistureBarFill = document.getElementById('moistureBarFill');
        if (moistureBarFill) {
            moistureBarFill.style.width = `${data.moisture}%`;
        }
        
        const statusElement = document.getElementById('moistureStatus');
        if (statusElement) {
            let icon = 'fa-leaf';
            if (data.moisture < 30) icon = 'fa-exclamation-triangle';
            else if (data.moisture < 50) icon = 'fa-tint';
            else if (data.moisture > 80) icon = 'fa-flood';
            
            statusElement.innerHTML = `<i class="fas ${icon}"></i> ${Math.round(data.moisture)}%`;
        }
        
        this.updateElement('pumpStatus', data.pump ? 'ВКЛ' : 'ВЫКЛ');
        this.updateElement('lightStatus', data.light ? 'ВКЛ' : 'ВЫКЛ');
        this.updateElement('currentTime', data.current_time || '--:--');
        this.updateElement('systemTime', data.current_time || '--:--');
        this.updateElement('totalWaterings', data.total_waterings || 0);
        this.updateElement('totalLightHours', data.total_light_hours || 0);
        this.updateElement('energyUsed', (data.total_energy || 0) + ' Вт·ч');
        this.updateElement('lightToday', (data.total_light_hours || 0) + ' ч');
        
        const pumpStatus = document.getElementById('pumpStatus');
        if (pumpStatus) {
            pumpStatus.className = data.pump ? 'card-status active' : 'card-status';
        }
        
        const lightStatus = document.getElementById('lightStatus');
        if (lightStatus) {
            lightStatus.className = data.light ? 'card-status active' : 'card-status';
        }
        
        this.updateElement('thresholdValue', (data.moisture_threshold || 50) + '%');
        const thresholdSlider = document.getElementById('moistureThreshold');
        if (thresholdSlider) thresholdSlider.value = data.moisture_threshold || 50;
        
        this.updateElement('wateringDelay', data.watering_delay || 30);
        this.updateElement('wateringDuration', data.watering_duration || 10);
        this.updateElement('manualPumpTime', data.manual_pump_time || 10);
        this.updateElement('manualLightTime', data.manual_light_time || 1);
        
        this.updateElement('lampStart', data.lamp_start || '08:00');
        this.updateElement('lampEnd', data.lamp_end || '20:00');
        this.updateElement('sleepStart', data.sleep_start || '23:00');
        this.updateElement('sleepEnd', data.sleep_end || '07:00');
        
        const lampToggle = document.getElementById('lampEnabled');
        if (lampToggle) lampToggle.checked = data.lamp_enabled;
        
        const sleepToggle = document.getElementById('sleepEnabled');
        if (sleepToggle) sleepToggle.checked = data.sleep_enabled;
        
        this.updateErrorsList(data.errors || []);
        this.updateConnectionMetrics();
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    updateErrorsList(errors) {
        const errorsList = document.getElementById('errorsList');
        if (!errorsList) return;
        
        errorsList.innerHTML = '';
        
        if (!errors || errors.length === 0) {
            errorsList.innerHTML = '<p class="no-errors">✅ Ошибок нет</p>';
            return;
        }
        
        errors.forEach(error => {
            const errorElement = document.createElement('div');
            errorElement.className = `error-item ${error.critical ? 'critical' : ''}`;
            
            errorElement.innerHTML = `
                <div class="error-time">${error.time}</div>
                <div class="error-message">${error.msg}</div>
            `;
            
            errorsList.appendChild(errorElement);
        });
    }
    
    updateConnectionMetrics() {
        const latencyElement = document.getElementById('latencyValue');
        const retryElement = document.getElementById('retryCount');
        
        if (latencyElement) {
            if (this.state.lastLatencyMs !== null) {
                latencyElement.textContent = `${this.state.lastLatencyMs} мс`;
                if (this.state.lastLatencyMs < 100) {
                    latencyElement.style.color = 'var(--success)';
                } else if (this.state.lastLatencyMs < 500) {
                    latencyElement.style.color = 'var(--warning)';
                } else {
                    latencyElement.style.color = 'var(--error)';
                }
            } else {
                latencyElement.textContent = '--';
                latencyElement.style.color = 'var(--text-muted)';
            }
        }
        
        if (retryElement) {
            retryElement.textContent = `${this.state.connectionRetryCount}/${this.state.maxRetries}`;
        }
    }
    
    checkNotifications(data) {
        if (!this.notifications.enabled) return;
        
        if (data.moisture < 30) {
            this.notifications.show('⚠️ Низкий уровень влажности!', 'warning');
        }
        
        if (data.errors && data.errors.length > 0) {
            const criticalErrors = data.errors.filter(error => error.critical);
            if (criticalErrors.length > 0) {
                this.notifications.show('🚨 Обнаружены критические ошибки!', 'error');
            }
        }
    }
    
    setupEventListeners() {
        const manualConnectBtn = document.getElementById('manualConnectBtn');
        if (manualConnectBtn) {
            manualConnectBtn.addEventListener('click', () => {
                this.showConnectionModal();
            });
        }
        
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                const ipInput = document.getElementById('ipAddress');
                if (ipInput) {
                    this.state.espIp = ipInput.value.trim();
                    await this.connectToESP();
                }
            });
        }
        
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                this.startDemoMode();
            });
        }
        
        const pumpOnBtn = document.getElementById('pumpOnBtn');
        const pumpOffBtn = document.getElementById('pumpOffBtn');
        
        if (pumpOnBtn) {
            pumpOnBtn.addEventListener('click', async () => {
                const durationInput = document.getElementById('manualPumpTimeInput');
                const durationSec = Math.max(1, parseInt(durationInput?.value, 10) || 10);
                const durationMs = durationSec * 1000;

                if (this.state.demoMode) {
                    this.state.currentData.pump = true;
                    this.updateUI(this.state.currentData);
                    this.notifications.show(`💧 Полив запущен на ${durationSec} сек (демо)`, 'success');
                    setTimeout(() => {
                        this.state.currentData.pump = false;
                        this.updateUI(this.state.currentData);
                    }, durationMs);
                    return;
                }

                if (!this.state.connected) {
                    this.notifications.show('❌ Нет подключения к системе', 'error');
                    return;
                }

                try {
                    await this.api.controlPump(this.state.espIp, 'on');
                    this.notifications.show(`💧 Полив запущен на ${durationSec} сек`, 'success');
                    setTimeout(async () => {
                        try {
                            await this.api.controlPump(this.state.espIp, 'off');
                            this.notifications.show('✅ Полив завершен', 'success');
                            setTimeout(() => this.updateData(), 1000);
                        } catch (error) {
                            this.notifications.show('❌ Ошибка отключения насоса', 'error');
                        }
                    }, durationMs);
                } catch (error) {
                    this.notifications.show('❌ Ошибка включения насоса', 'error');
                }
            });
        }
        
        if (pumpOffBtn) {
            pumpOffBtn.addEventListener('click', async () => {
                if (this.state.demoMode) {
                    this.state.currentData.pump = false;
                    this.updateUI(this.state.currentData);
                    this.notifications.show('✅ Насос выключен (демо)', 'success');
                } else if (this.state.connected) {
                    try {
                        await this.api.controlPump(this.state.espIp, 'off');
                        this.notifications.show('✅ Насос выключен', 'success');
                        setTimeout(() => this.updateData(), 1000);
                    } catch (error) {
                        this.notifications.show('❌ Ошибка выключения насоса', 'error');
                    }
                }
            });
        }
        
        const lightOnBtn = document.getElementById('lightOnBtn');
        const lightOffBtn = document.getElementById('lightOffBtn');
        
        if (lightOnBtn) {
            lightOnBtn.addEventListener('click', async () => {
                if (this.state.demoMode) {
                    this.state.currentData.light = true;
                    this.updateUI(this.state.currentData);
                    this.notifications.show('💡 Свет включен (демо)', 'success');
                } else if (this.state.connected) {
                    try {
                        await this.api.controlLight(this.state.espIp, 'on');
                        this.notifications.show('💡 Свет включен', 'success');
                        setTimeout(() => this.updateData(), 1000);
                    } catch (error) {
                        this.notifications.show('❌ Ошибка включения света', 'error');
                    }
                }
            });
        }
        
        if (lightOffBtn) {
            lightOffBtn.addEventListener('click', async () => {
                if (this.state.demoMode) {
                    this.state.currentData.light = false;
                    this.updateUI(this.state.currentData);
                    this.notifications.show('✅ Свет выключен (демо)', 'success');
                } else if (this.state.connected) {
                    try {
                        await this.api.controlLight(this.state.espIp, 'off');
                        this.notifications.show('✅ Свет выключен', 'success');
                        setTimeout(() => this.updateData(), 1000);
                    } catch (error) {
                        this.notifications.show('❌ Ошибка выключения света', 'error');
                    }
                }
            });
        }
        
        const syncTimeBtn = document.getElementById('syncTimeBtn');
        if (syncTimeBtn) {
            syncTimeBtn.addEventListener('click', async () => {
                if (this.state.demoMode) {
                    this.notifications.show('🕐 Время синхронизировано (демо)', 'success');
                } else if (this.state.connected) {
                    try {
                        await this.api.syncTime(this.state.espIp);
                        this.notifications.show('🕐 Время синхронизировано', 'success');
                        setTimeout(() => this.updateData(), 1000);
                    } catch (error) {
                        this.notifications.show('❌ Ошибка синхронизации времени', 'error');
                    }
                }
            });
        }

        const setTimeBtn = document.getElementById('setTimeBtn');
        const manualTimeInput = document.getElementById('manualTimeInput');
        if (manualTimeInput) {
            const now = new Date();
            manualTimeInput.value = now.toTimeString().slice(0, 5);
        }

        if (setTimeBtn && manualTimeInput) {
            setTimeBtn.addEventListener('click', async () => {
                if (!manualTimeInput.value) {
                    this.notifications.show('❌ Укажите время для установки', 'error');
                    return;
                }

                const [hours, minutes] = manualTimeInput.value.split(':').map(Number);
                if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                    this.notifications.show('❌ Некорректный формат времени', 'error');
                    return;
                }

                if (this.state.demoMode) {
                    this.updateElement('systemTime', manualTimeInput.value);
                    this.notifications.show('🕐 Время установлено (демо)', 'success');
                    return;
                }

                if (!this.state.connected) {
                    this.notifications.show('❌ Нет подключения к системе', 'error');
                    return;
                }

                try {
                    await this.api.setTime(this.state.espIp, hours, minutes);
                    this.notifications.show('🕐 Время установлено', 'success');
                    setTimeout(() => this.updateData(), 1000);
                } catch (error) {
                    this.notifications.show('❌ Ошибка установки времени', 'error');
                }
            });
        }
        
        const thresholdSlider = document.getElementById('moistureThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        
        if (thresholdSlider && thresholdValue) {
            thresholdSlider.addEventListener('input', (e) => {
                thresholdValue.textContent = e.target.value + '%';
            });
            
            thresholdSlider.addEventListener('change', async (e) => {
                const value = parseInt(e.target.value);
                if (this.state.demoMode) {
                    this.state.currentData.moisture_threshold = value;
                    this.notifications.show('✅ Порог влажности обновлен (демо)', 'success');
                } else if (this.state.connected) {
                    try {
                        await this.api.updateSettings(this.state.espIp, {
                            moisture_threshold: value
                        });
                        this.notifications.show('✅ Порог влажности обновлен', 'success');
                    } catch (error) {
                        this.notifications.show('❌ Ошибка обновления настроек', 'error');
                    }
                }
            });
        }
        
        const clearErrorsBtn = document.getElementById('clearErrorsBtn');
        if (clearErrorsBtn) {
            clearErrorsBtn.addEventListener('click', async () => {
                if (this.state.demoMode) {
                    this.state.currentData.errors = [];
                    this.updateErrorsList([]);
                    this.notifications.show('✅ Ошибки очищены (демо)', 'success');
                } else if (this.state.connected) {
                    try {
                        await this.api.clearErrors(this.state.espIp);
                        this.notifications.show('✅ Ошибки очищены', 'success');
                        setTimeout(() => this.updateData(), 1000);
                    } catch (error) {
                        this.notifications.show('❌ Ошибка очистки ошибок', 'error');
                    }
                }
            });
        }
        
        const resetStatsBtn = document.getElementById('resetStatsBtn');
        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', () => {
                if (this.state.demoMode) {
                    this.state.currentData.total_waterings = 0;
                    this.state.currentData.total_light_hours = 0;
                    this.state.currentData.total_energy = 0;
                    this.state.currentData.min_moisture = this.state.currentData.moisture;
                    this.state.currentData.max_moisture = this.state.currentData.moisture;
                    
                    this.updateUI(this.state.currentData);
                    this.notifications.show('✅ Статистика сброшена (демо)', 'success');
                } else if (this.state.connected) {
                    this.api.resetStats(this.state.espIp)
                        .then(() => {
                            this.notifications.show('✅ Статистика сброшена', 'success');
                            setTimeout(() => this.updateData(), 500);
                        })
                        .catch((error) => {
                            console.error('Ошибка сброса статистики:', error);
                            this.notifications.show('❌ Ошибка сброса статистики', 'error');
                        });
                } else {
                    this.notifications.show('❌ Нет подключения к системе', 'error');
                }
            });
        }
        
        const docsLink = document.getElementById('docsLink');
        if (docsLink) {
            docsLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('https://docs.google.com/document/d/1WqwljHYKqke6uKdL4wd3HSNd9nIVkHLH/edit', '_blank');
            });
        }
        
        const quickGuideBtn = document.getElementById('quickGuideBtn');
        const quickGuideModal = document.getElementById('quickGuideModal');
        if (quickGuideBtn && quickGuideModal) {
            quickGuideBtn.addEventListener('click', () => {
                quickGuideModal.classList.add('active');
            });
        }
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.theme.setTheme(e.target.value);
                this.notifications.show(`✅ Тема изменена на "${e.target.selectedOptions[0].text}"`, 'success');
            });
        }

        const notificationsToggle = document.getElementById('notificationsToggle');
        const silentToggle = document.getElementById('silentNotificationsToggle');

        const syncNotificationControls = () => {
            if (notificationsToggle) {
                notificationsToggle.checked = this.notifications.enabled;
            }
            if (silentToggle) {
                silentToggle.checked = this.notifications.silentMode;
                silentToggle.disabled = !this.notifications.enabled;
            }
        };

        if (notificationsToggle) {
            const notificationsEnabled = localStorage.getItem('notifications_enabled') !== 'false';
            this.notifications.setEnabled(notificationsEnabled);
            notificationsToggle.addEventListener('change', (e) => {
                this.notifications.setEnabled(e.target.checked);
                syncNotificationControls();
            });
        }

        if (silentToggle) {
            const silentEnabled = localStorage.getItem('notifications_silent') === 'true';
            this.notifications.setSilentMode(silentEnabled);
            silentToggle.addEventListener('change', (e) => {
                this.notifications.setSilentMode(e.target.checked);
                syncNotificationControls();
            });
        }

        syncNotificationControls();
        
        const updateIntervalInput = document.getElementById('updateInterval');
        if (updateIntervalInput) {
            updateIntervalInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) * 1000;
                if (value >= 2000 && value <= 60000) {
                    this.state.updateInterval = value;
                    this.notifications.show(`✅ Интервал обновления: ${e.target.value} сек`, 'success');
                }
            });
        }
    }
    
    startUpdateLoop() {
        setInterval(() => {
            if (this.state.connected) {
                this.updateData();
            }
        }, this.state.updateInterval);
        
        setInterval(() => {
            if (this.state.demoMode && this.state.currentData) {
                const now = new Date();
                this.state.currentData.current_time = now.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                this.updateElement('systemTime', this.state.currentData.current_time);
            }
        }, 60000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ecoGrowApp = new EcoGrowApp();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker зарегистрирован:', registration);
            })
            .catch(error => {
                console.log('Ошибка регистрации ServiceWorker:', error);
            });
    });
}

window.addEventListener('online', () => {
    if (window.ecoGrowApp && !window.ecoGrowApp.state.demoMode) {
        window.ecoGrowApp.notifications.show('📡 Соединение восстановлено', 'success');
        if (!window.ecoGrowApp.state.connected) {
            window.ecoGrowApp.tryAutoConnect();
        }
    }
});

window.addEventListener('offline', () => {
    if (window.ecoGrowApp && !window.ecoGrowApp.state.demoMode) {
        window.ecoGrowApp.notifications.show('⚠️ Отсутствует интернет-соединение', 'warning');
        window.ecoGrowApp.state.connected = false;
        window.ecoGrowApp.updateConnectionStatus();
        window.ecoGrowApp.clearStaleData();
    }
});
