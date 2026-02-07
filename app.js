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
            maxRetries: 3,
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
            this.notifications.show('📡 Сеть доступна, пытаемся подключиться...', 'info');
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
            await this.connectToESP();
            return;
        }
        
        const commonIPs = [
            'ecogrow.local',
            '192.168.1.100',
            '192.168.0.187',
            '192.168.4.1',
            '10.108.130.89'
        ];
        
        for (const ip of commonIPs) {
            try {
                const isConnected = await this.api.testConnection(ip);
                if (isConnected) {
                    this.state.espIp = ip;
                    await this.connectToESP();
                    return;
                }
            } catch (error) {
                continue;
            }
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
            return;
        }
        
        try {
            this.showLoading();
            
            this.state.demoMode = false;
            const isConnected = await this.api.testConnection(this.state.espIp);
            
            if (!isConnected) {
                throw new Error('Устройство недоступно');
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
            
        } catch (error) {
            console.error('Connection failed:', error);
            
            this.state.connected = false;
            this.updateConnectionStatus();
            this.clearStaleData();
            
            this.state.connectionRetryCount++;
            
            if (this.state.connectionRetryCount < this.state.maxRetries) {
                this.notifications.show(`❌ Попытка ${this.state.connectionRetryCount}/${this.state.maxRetries}: ${error.message}`, 'error');
                setTimeout(() => this.connectToESP(), 2000);
            } else {
                this.notifications.show('❌ Не удалось подключиться к системе. Запускаю демо-режим.', 'error');
                this.startDemoMode();
            }
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
        
        // Инициализируем начальные значения для min/max
        this.state.currentData.min_moisture = this.state.currentData.moisture;
        this.state.currentData.max_moisture = this.state.currentData.moisture;
        
        this.updateConnectionStatus();
        this.updateUI(this.state.currentData);
        this.charts.updateMoistureChart(this.state.currentData.moisture_history);
        
        document.getElementById('demoBanner').style.display = 'flex';
        
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
                    statusElement.innerHTML = `
                        <div class="status-dot"></div>
                        <span>Подключено к ${this.state.espIp}</span>
                    `;
                    statusElement.classList.add('connected');
                }
            } else {
                statusElement.innerHTML = `
                    <div class="status-dot"></div>
                    <span>Нет подключения</span>
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
            
            // Автоматическое управление светом по времени
            if (hour >= 8 && hour < 20) {
                this.state.currentData.light = true;
            } else {
                this.state.currentData.light = false;
            }
            
            // Генерируем реалистичные данные влажности
            this.state.currentData.moisture = Math.max(20, Math.min(80, 
                60 + Math.sin(Date.now() / 60000) * 10 + Math.random() * 5
            ));
            
            // Обновляем min/max
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
            const isConnected = await this.api.testConnection(this.state.espIp);
            if (!isConnected) {
                throw new Error('Устройство недоступно');
            }
            
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
            console.error('Update failed:', error);
            
            this.state.connectionRetryCount++;
            this.updateConnectionMetrics();
            
            if (this.state.connectionRetryCount >= this.state.maxRetries) {
                this.state.connected = false;
                this.updateConnectionStatus();
                this.clearStaleData();
                this.notifications.show('❌ Потеряно соединение с устройством', 'error');
                
                setTimeout(() => {
                    if (!this.state.connected && !this.state.demoMode) {
                        if (confirm('Не удается подключиться к устройству. Хотите перейти в демо-режим?')) {
                            this.startDemoMode();
                        }
                    }
                }, 1000);
            } else {
                this.notifications.show(`⚠️ Проблема с подключением (попытка ${this.state.connectionRetryCount}/${this.state.maxRetries})`, 'warning');
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
        const pumpStatusElement = document.getElementById('pumpStatus');
        if (pumpStatusElement) {
            pumpStatusElement.className = `card-status ${data.pump ? 'status-on' : 'status-off'}`;
        }
        
        this.updateElement('lightStatus', data.light ? 'ВКЛ' : 'ВЫКЛ');
        const lightStatusElement = document.getElementById('lightStatus');
        if (lightStatusElement) {
            lightStatusElement.className = `card-status ${data.light ? 'status-on' : 'status-off'}`;
        }
        
        const thresholdSlider = document.getElementById('moistureThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        if (thresholdSlider && thresholdValue && data.moisture_threshold) {
            thresholdSlider.value = data.moisture_threshold;
            thresholdValue.textContent = data.moisture_threshold + '%';
        }
        
        this.updateElement('currentTime', data.current_time);
        this.updateElement('systemTime', data.current_time);
        
        this.updateElement('totalWaterings', data.total_waterings || 0);
        this.updateElement('totalLightHours', data.total_light_hours || 0);
        this.updateElement('energyUsed', data.total_energy || '0');

        this.updateConnectionMetrics();
        
        this.updateErrorsList(data.errors || []);
    }

    updateConnectionMetrics() {
        const retryLabel = document.getElementById('retryCount');
        if (retryLabel) {
            retryLabel.textContent = `${this.state.connectionRetryCount}/${this.state.maxRetries}`;
        }

        const latencyLabel = document.getElementById('latencyValue');
        if (latencyLabel) {
            latencyLabel.textContent = this.state.lastLatencyMs ? `${this.state.lastLatencyMs} мс` : '--';
        }
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            if (typeof value === 'number' && !isNaN(parseFloat(element.textContent))) {
                this.animateValue(element, parseFloat(element.textContent), value, 500);
            } else {
                element.textContent = value;
            }
        }
    }
    
    animateValue(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = Math.floor(progress * (end - start) + start);
            element.textContent = current;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
    
    updateErrorsList(errors) {
        const errorsList = document.getElementById('errorsList');
        const errorCount = document.getElementById('errorCount');
        
        if (!errors || errors.length === 0) {
            errorsList.innerHTML = `
                <div class="error-item empty">
                    <i class="fas fa-check-circle"></i>
                    <span>Ошибок нет, система работает стабильно</span>
                </div>
            `;
            if (errorCount) errorCount.textContent = '0';
            return;
        }
        
        if (errorCount) errorCount.textContent = errors.length;
        
        let html = '';
        errors.slice(0, 5).forEach(error => {
            const criticalClass = error.critical ? 'critical' : '';
            html += `
                <div class="error-item ${criticalClass}">
                    <div class="error-time">${error.time || 'Неизвестно'}</div>
                    <div class="error-message">${error.message || error}</div>
                </div>
            `;
        });
        
        errorsList.innerHTML = html;
    }
    
    checkNotifications(data) {
        if (!data || !data.errors) return;
        
        if (data.errors.length > 0) {
            const lastError = data.errors[0];
            const message = lastError.message || lastError;
            const severity = lastError.critical ? 'error' : 'warning';
            
            this.notifications.show(`⚠️ ${message}`, severity);
        }
    }
    
    async loadSettings() {
        if (this.state.demoMode) return;
        
        try {
            const settings = await this.api.getSettings(this.state.espIp);
            this.state.settings = settings;
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    
    setupEventListeners() {
        const connectBtn = document.getElementById('connectBtn');
        const demoBtn = document.getElementById('demoBtn');
        const ipInput = document.getElementById('ipAddress');
        
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                const ip = ipInput.value.trim();
                if (ip) {
                    this.state.espIp = ip;
                    this.connectToESP();
                } else {
                    this.notifications.show('❌ Введите IP адрес устройства', 'error');
                }
            });
        }
        
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                this.startDemoMode();
            });
        }
        
        const closeConnectionModal = document.getElementById('closeConnectionModal');
        if (closeConnectionModal) {
            closeConnectionModal.addEventListener('click', () => {
                this.hideConnectionModal();
            });
        }
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.theme.toggle();
            });
        }
        
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                document.getElementById('settingsModal').classList.add('active');
            });
        }
        
        const pumpOnBtn = document.getElementById('pumpOnBtn');
        const pumpOffBtn = document.getElementById('pumpOffBtn');
        const waterNowBtn = document.getElementById('waterNowBtn');
        
        if (pumpOnBtn) {
            pumpOnBtn.addEventListener('click', async () => {
                if (this.state.demoMode) {
                    this.state.currentData.pump = true;
                    this.updateUI(this.state.currentData);
                    this.notifications.show('💧 Насос включен (демо)', 'success');
                    setTimeout(() => {
                        this.state.currentData.pump = false;
                        this.updateUI(this.state.currentData);
                    }, 10000);
                } else if (this.state.connected) {
                    try {
                        await this.api.controlPump(this.state.espIp, 'on');
                        this.notifications.show('💧 Насос включен', 'success');
                        setTimeout(() => this.updateData(), 1000);
                    } catch (error) {
                        this.notifications.show('❌ Ошибка включения насоса', 'error');
                    }
                }
            });
        }

        if (waterNowBtn) {
            waterNowBtn.addEventListener('click', async () => {
                const durationInput = document.getElementById('wateringDuration');
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
        
        // ИСПРАВЛЕННЫЙ И ПРОСТОЙ ОБРАБОТЧИК ДЛЯ СБРОСА СТАТИСТИКИ
        const resetStatsBtn = document.getElementById('resetStatsBtn');
        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', () => {
                console.log('Сброс статистики нажата');
                
                if (this.state.demoMode) {
                    // ПРОСТОЙ СБРОС В ДЕМО-РЕЖИМЕ
                    this.state.currentData.total_waterings = 0;
                    this.state.currentData.total_light_hours = 0;
                    this.state.currentData.total_energy = 0;
                    // Сброс min/max
                    this.state.currentData.min_moisture = this.state.currentData.moisture;
                    this.state.currentData.max_moisture = this.state.currentData.moisture;
                    
                    // Сразу обновляем интерфейс
                    this.updateUI(this.state.currentData);
                    this.notifications.show('✅ Статистика сброшена (демо)', 'success');
                    console.log('Статистика сброшена в демо-режиме');
                } else if (this.state.connected) {
                    // Для реального устройства используем API
                    console.log('Попытка сброса статистики через API');
                    this.api.resetStats(this.state.espIp)
                        .then(() => {
                            this.notifications.show('✅ Статистика сброшена', 'success');
                            console.log('Статистика сброшена через API');
                            // Обновляем данные через 500мс
                            setTimeout(() => this.updateData(), 500);
                        })
                        .catch((error) => {
                            console.error('Ошибка сброса статистики:', error);
                            this.notifications.show('❌ Ошибка сброса статистики. Проверьте подключение.', 'error');
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
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
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
