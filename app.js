class EcoGrowApp {
    constructor() {
        this.apiClient = new EcoGrowAPI();
        this.chartManager = new ChartsManager();
        this.themeManager = new ThemeManager();
        this.notificationManager = new NotificationManager();
        this.configManager = new ConfigManager();
        
        this.appState = {
            connected: false,
            demoMode: false,
            deviceAddress: null,
            currentSystemData: null,
            userSettings: {},
            lastDataUpdate: null,
            updateFrequency: 5000,
            connectionAttempts: 0,
            maxConnectionAttempts: 5,
            lastResponseTime: null
        };
        
        this.initializeApplication();
    }
    
    async initializeApplication() {
        this.themeManager.init();
        this.showLoadingScreen();
        
        await this.attemptAutoConnection();
        this.hideLoadingScreen();
        
        this.chartManager.init();
        this.startDataUpdateCycle();
        this.setupUserInteractions();
        this.initializePWA();
        this.setupNetworkMonitoring();
    }
    
    initializePWA() {
        window.addEventListener('beforeinstallprompt', (installEvent) => {
            installEvent.preventDefault();
            this.pwaInstallPrompt = installEvent;
            
            const installButton = document.getElementById('pwaInstallBtn');
            if (installButton) {
                installButton.style.display = 'flex';
                installButton.addEventListener('click', () => this.installPWAApplication());
            }
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Запущено как PWA');
        }
    }
    
    setupNetworkMonitoring() {
        if (navigator.connection) {
            navigator.connection.addEventListener('change', () => {
                this.handleNetworkStatusChange();
            });
        }
    }
    
    handleNetworkStatusChange() {
        if (navigator.onLine && !this.appState.connected && !this.appState.demoMode) {
            this.notificationManager.show('📡 Сеть доступна, проверяем подключение...', 'info');
            this.attemptAutoConnection();
        }
    }
    
    async installPWAApplication() {
        if (!this.pwaInstallPrompt) return;
        
        this.pwaInstallPrompt.prompt();
        const userChoice = await this.pwaInstallPrompt.userChoice;
        
        if (userChoice.outcome === 'accepted') {
            console.log('PWA установлено');
            const installButton = document.getElementById('pwaInstallBtn');
            if (installButton) installButton.style.display = 'none';
        }
        
        this.pwaInstallPrompt = null;
    }
    
    showLoadingScreen() {
        const loadingElement = document.getElementById('loadingScreen');
        if (loadingElement) {
            loadingElement.style.opacity = '1';
            loadingElement.style.pointerEvents = 'all';
        }
    }
    
    hideLoadingScreen() {
        const loadingElement = document.getElementById('loadingScreen');
        const mainInterface = document.getElementById('mainContainer');
        
        if (loadingElement) {
            loadingElement.style.opacity = '0';
            setTimeout(() => {
                loadingElement.style.display = 'none';
                if (mainInterface) {
                    mainInterface.style.display = 'block';
                }
            }, 500);
        }
    }
    
    async attemptAutoConnection() {
        const savedAddress = localStorage.getItem('ecogrow_ip');
        if (savedAddress) {
            this.appState.deviceAddress = savedAddress;
            const connectionSuccessful = await this.connectToDevice();
            if (connectionSuccessful) return;
        }
        
        this.showConnectionDialog();
    }
    
    showConnectionDialog() {
        const connectionDialog = document.getElementById('connectionModal');
        if (connectionDialog) {
            connectionDialog.classList.add('active');
        }
    }
    
    hideConnectionDialog() {
        const connectionDialog = document.getElementById('connectionModal');
        if (connectionDialog) {
            connectionDialog.classList.remove('active');
        }
    }
    
    async connectToDevice() {
        if (!this.appState.deviceAddress) {
            this.notificationManager.show('❌ Введите IP адрес устройства', 'error');
            this.showConnectionDialog();
            return false;
        }
        
        console.log(`Попытка подключения к: ${this.appState.deviceAddress}`);
        
        try {
            this.showLoadingScreen();
            
            this.appState.demoMode = false;
            const deviceAvailable = await this.apiClient.testDeviceConnection(this.appState.deviceAddress);
            
            if (!deviceAvailable) {
                throw new Error(`Устройство ${this.appState.deviceAddress} недоступно`);
            }
            
            const deviceInfo = await this.apiClient.getSystemInfo(this.appState.deviceAddress);
            
            localStorage.setItem('ecogrow_ip', this.appState.deviceAddress);
            this.appState.connectionAttempts = 0;
            this.appState.connected = true;
            this.updateConnectionDisplay();
            
            const demoIndicator = document.getElementById('demoBanner');
            if (demoIndicator) demoIndicator.style.display = 'none';
            
            await this.refreshSystemData();
            this.hideConnectionDialog();
            
            this.notificationManager.show(`✅ Успешно подключено к ${deviceInfo.hostname || this.appState.deviceAddress}!`, 'success');
            return true;
            
        } catch (error) {
            console.error('Ошибка подключения:', error);
            
            this.appState.connected = false;
            this.updateConnectionDisplay();
            this.clearDisplayedData();
            
            this.appState.connectionAttempts++;
            
            let errorDescription = error.message;
            
            if (error.message.includes('Mixed Content')) {
                errorDescription = 'Ошибка Mixed Content: HTTPS страница не может получить доступ к HTTP ресурсу.';
                errorDescription += ' Попробуйте открыть ESP8266 по адресу http://' + this.appState.deviceAddress;
            }
            
            if (this.appState.connectionAttempts < this.appState.maxConnectionAttempts) {
                this.notificationManager.show(
                    `❌ Попытка ${this.appState.connectionAttempts}/${this.appState.maxConnectionAttempts}: ${errorDescription}`,
                    'error',
                    8000
                );
            } else {
                this.notificationManager.show(
                    '❌ Не удалось подключиться к системе\n' +
                    'Проверьте:\n' +
                    '• Устройство включено и подключено к Wi-Fi\n' +
                    '• Правильный IP адрес (попробуйте http://' + this.appState.deviceAddress + ')\n' +
                    '• Устройство в той же сети\n' +
                    '• Для GitHub Pages используйте ngrok',
                    'error',
                    10000
                );
                this.showConnectionDialog();
            }
            return false;
        } finally {
            this.hideLoadingScreen();
        }
    }
    
    async startDemoMode() {
        this.appState.demoMode = true;
        this.appState.connected = true;
        this.appState.deviceAddress = 'demo-mode';
        
        const randomVariation = Math.random() * 10;
        
        this.appState.currentSystemData = {
            moisture: Math.round(50 + Math.sin(Date.now() / 60000) * 15 + randomVariation),
            avg_moisture: Math.round(55 + randomVariation),
            min_moisture: Math.round(40 + randomVariation),
            max_moisture: Math.round(70 + randomVariation),
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
            moisture_history: Array.from({length: 20}, (_, index) => 
                60 + Math.sin((index + randomVariation) * 0.5) * 10 + Math.random() * 5
            )
        };
        
        this.appState.currentSystemData.min_moisture = this.appState.currentSystemData.moisture;
        this.appState.currentSystemData.max_moisture = this.appState.currentSystemData.moisture;
        
        this.updateConnectionDisplay();
        this.updateInterface(this.appState.currentSystemData);
        this.chartManager.updateMoistureChart(this.appState.currentSystemData.moisture_history);
        
        const demoIndicator = document.getElementById('demoBanner');
        if (demoIndicator) demoIndicator.style.display = 'flex';
        
        this.notificationManager.show('🔧 Запущен демо-режим', 'info');
        this.hideConnectionDialog();
    }
    
    updateConnectionDisplay() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (this.appState.connected) {
                if (this.appState.demoMode) {
                    statusElement.innerHTML = `
                        <div class="status-dot" style="background: var(--accent-orange)"></div>
                        <span>Демо-режим</span>
                    `;
                    statusElement.classList.add('connected');
                } else {
                    const shortAddress = this.appState.deviceAddress ? 
                        (this.appState.deviceAddress.length > 20 ? 
                            this.appState.deviceAddress.substring(0, 17) + '...' : 
                            this.appState.deviceAddress) : 
                        '--';
                    statusElement.innerHTML = `
                        <div class="status-dot"></div>
                        <span>Подключено: ${shortAddress}</span>
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
    
    async refreshSystemData() {
        if (!this.appState.connected) return;
        
        if (this.appState.demoMode) {
            const currentTime = new Date();
            const currentHour = currentTime.getHours();
            
            if (currentHour >= 8 && currentHour < 20) {
                this.appState.currentSystemData.light = true;
            } else {
                this.appState.currentSystemData.light = false;
            }
            
            this.appState.currentSystemData.moisture = Math.max(20, Math.min(80, 
                60 + Math.sin(Date.now() / 60000) * 10 + Math.random() * 5
            ));
            
            if (this.appState.currentSystemData.moisture < this.appState.currentSystemData.min_moisture) {
                this.appState.currentSystemData.min_moisture = this.appState.currentSystemData.moisture;
            }
            if (this.appState.currentSystemData.moisture > this.appState.currentSystemData.max_moisture) {
                this.appState.currentSystemData.max_moisture = this.appState.currentSystemData.moisture;
            }
            
            this.appState.currentSystemData.current_time = currentTime.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            this.appState.currentSystemData.moisture_history.push(this.appState.currentSystemData.moisture);
            if (this.appState.currentSystemData.moisture_history.length > 20) {
                this.appState.currentSystemData.moisture_history.shift();
            }
            
            this.updateInterface(this.appState.currentSystemData);
            this.chartManager.updateMoistureChart(this.appState.currentSystemData.moisture_history);
            return;
        }
        
        try {
            const requestStart = performance.now();
            const systemData = await this.apiClient.getSystemState(this.appState.deviceAddress);
            const requestEnd = performance.now();
            
            this.appState.lastResponseTime = Math.round(requestEnd - requestStart);
            this.appState.currentSystemData = systemData;
            this.appState.lastDataUpdate = new Date();
            this.appState.connectionAttempts = 0;
            
            this.updateInterface(systemData);
            this.chartManager.updateMoistureChart(systemData.moisture_history);
            this.checkSystemNotifications(systemData);
            
        } catch (error) {
            console.error('Ошибка обновления данных:', error);
            
            this.appState.connectionAttempts++;
            this.updateConnectionMetrics();
            
            if (this.appState.connectionAttempts >= 3) {
                this.appState.connected = false;
                this.updateConnectionDisplay();
                this.clearDisplayedData();
                this.notificationManager.show('❌ Потеряно соединение с устройством', 'error');
                
                setTimeout(() => {
                    if (!this.appState.connected && !this.appState.demoMode) {
                        this.showConnectionDialog();
                    }
                }, 1000);
            }
        }
    }
    
    clearDisplayedData() {
        const displayElements = [
            'moistureValue', 'avgMoisture', 'minMoisture', 'maxMoisture',
            'pumpStatus', 'lightStatus', 'currentTime', 'systemTime',
            'totalWaterings', 'totalLightHours', 'energyUsed',
            'moistureStatus', 'thresholdValue', 'lightToday'
        ];
        
        displayElements.forEach(elementId => {
            const displayElement = document.getElementById(elementId);
            if (displayElement) {
                if (elementId === 'moistureStatus') {
                    displayElement.textContent = '--%';
                } else if (elementId === 'thresholdValue') {
                    displayElement.textContent = '50%';
                } else if (elementId === 'pumpStatus' || elementId === 'lightStatus') {
                    displayElement.textContent = '--';
                    displayElement.className = 'card-status';
                } else if (elementId === 'lightToday') {
                    displayElement.textContent = '0 ч';
                } else {
                    displayElement.textContent = '--';
                }
            }
        });
        
        const thresholdControl = document.getElementById('moistureThreshold');
        if (thresholdControl) thresholdControl.value = 50;
        
        const moistureIndicator = document.getElementById('moistureBarFill');
        if (moistureIndicator) moistureIndicator.style.width = '0%';
        
        if (this.chartManager) {
            this.chartManager.clearChart();
        }
        
        this.updateErrorDisplay([]);
    }
    
    updateInterface(systemData) {
        if (!systemData) return;
        
        this.updateDisplayElement('moistureValue', Math.round(systemData.moisture));
        this.updateDisplayElement('avgMoisture', Math.round(systemData.avg_moisture || systemData.moisture) + '%');
        this.updateDisplayElement('minMoisture', Math.round(systemData.min_moisture || systemData.moisture) + '%');
        this.updateDisplayElement('maxMoisture', Math.round(systemData.max_moisture || systemData.moisture) + '%');
        
        const moistureIndicator = document.getElementById('moistureBarFill');
        if (moistureIndicator) {
            moistureIndicator.style.width = `${systemData.moisture}%`;
        }
        
        const statusDisplay = document.getElementById('moistureStatus');
        if (statusDisplay) {
            let statusIcon = 'fa-leaf';
            if (systemData.moisture < 30) statusIcon = 'fa-exclamation-triangle';
            else if (systemData.moisture < 50) statusIcon = 'fa-tint';
            else if (systemData.moisture > 80) statusIcon = 'fa-flood';
            
            statusDisplay.innerHTML = `<i class="fas ${statusIcon}"></i> ${Math.round(systemData.moisture)}%`;
        }
        
        this.updateDisplayElement('pumpStatus', systemData.pump ? 'ВКЛ' : 'ВЫКЛ');
        this.updateDisplayElement('lightStatus', systemData.light ? 'ВКЛ' : 'ВЫКЛ');
        this.updateDisplayElement('currentTime', systemData.current_time || '--:--');
        this.updateDisplayElement('systemTime', systemData.current_time || '--:--');
        this.updateDisplayElement('totalWaterings', systemData.total_waterings || 0);
        this.updateDisplayElement('totalLightHours', systemData.total_light_hours || 0);
        this.updateDisplayElement('energyUsed', (systemData.total_energy || 0) + ' Вт·ч');
        this.updateDisplayElement('lightToday', (systemData.total_light_hours || 0) + ' ч');
        
        const pumpStatusElement = document.getElementById('pumpStatus');
        if (pumpStatusElement) {
            pumpStatusElement.className = systemData.pump ? 'card-status active' : 'card-status';
        }
        
        const lightStatusElement = document.getElementById('lightStatus');
        if (lightStatusElement) {
            lightStatusElement.className = systemData.light ? 'card-status active' : 'card-status';
        }
        
        this.updateDisplayElement('thresholdValue', (systemData.moisture_threshold || 50) + '%');
        const thresholdControl = document.getElementById('moistureThreshold');
        if (thresholdControl) thresholdControl.value = systemData.moisture_threshold || 50;
        
        this.updateDisplayElement('wateringDelay', systemData.watering_delay || 30);
        this.updateDisplayElement('wateringDuration', systemData.watering_duration || 10);
        this.updateDisplayElement('manualPumpTime', systemData.manual_pump_time || 10);
        this.updateDisplayElement('manualLightTime', systemData.manual_light_time || 1);
        
        this.updateDisplayElement('lampStart', systemData.lamp_start || '08:00');
        this.updateDisplayElement('lampEnd', systemData.lamp_end || '20:00');
        this.updateDisplayElement('sleepStart', systemData.sleep_start || '23:00');
        this.updateDisplayElement('sleepEnd', systemData.sleep_end || '07:00');
        
        const lampToggle = document.getElementById('lampEnabled');
        if (lampToggle) lampToggle.checked = systemData.lamp_enabled;
        
        const sleepToggle = document.getElementById('sleepEnabled');
        if (sleepToggle) sleepToggle.checked = systemData.sleep_enabled;
        
        this.updateErrorDisplay(systemData.errors || []);
        this.updateConnectionMetrics();
    }
    
    updateDisplayElement(elementId, displayValue) {
        const displayElement = document.getElementById(elementId);
        if (displayElement) {
            displayElement.textContent = displayValue;
        }
    }
    
    updateErrorDisplay(errorList) {
        const errorContainer = document.getElementById('errorsList');
        if (!errorContainer) return;
        
        errorContainer.innerHTML = '';
        
        if (!errorList || errorList.length === 0) {
            errorContainer.innerHTML = '<p class="no-errors">✅ Ошибок нет</p>';
            return;
        }
        
        errorList.forEach(errorItem => {
            const errorElement = document.createElement('div');
            errorElement.className = `error-item ${errorItem.critical ? 'critical' : ''}`;
            
            errorElement.innerHTML = `
                <div class="error-time">${errorItem.time}</div>
                <div class="error-message">${errorItem.msg}</div>
            `;
            
            errorContainer.appendChild(errorElement);
        });
    }
    
    updateConnectionMetrics() {
        const latencyDisplay = document.getElementById('latencyValue');
        const retryDisplay = document.getElementById('retryCount');
        
        if (latencyDisplay) {
            if (this.appState.lastResponseTime !== null) {
                latencyDisplay.textContent = `${this.appState.lastResponseTime} мс`;
                if (this.appState.lastResponseTime < 100) {
                    latencyDisplay.style.color = 'var(--success)';
                } else if (this.appState.lastResponseTime < 500) {
                    latencyDisplay.style.color = 'var(--warning)';
                } else {
                    latencyDisplay.style.color = 'var(--error)';
                }
            } else {
                latencyDisplay.textContent = '--';
                latencyDisplay.style.color = 'var(--text-muted)';
            }
        }
        
        if (retryDisplay) {
            retryDisplay.textContent = `${this.appState.connectionAttempts}/${this.appState.maxConnectionAttempts}`;
        }
    }
    
    checkSystemNotifications(systemData) {
        if (!this.notificationManager.enabled) return;
        
        if (systemData.moisture < 30) {
            this.notificationManager.show('⚠️ Низкий уровень влажности!', 'warning');
        }
        
        if (systemData.errors && systemData.errors.length > 0) {
            const criticalIssues = systemData.errors.filter(error => error.critical);
            if (criticalIssues.length > 0) {
                this.notificationManager.show('🚨 Обнаружены критические ошибки!', 'error');
            }
        }
    }
    
    setupUserInteractions() {
        const connectButton = document.getElementById('manualConnectBtn');
        if (connectButton) {
            connectButton.addEventListener('click', () => {
                this.showConnectionDialog();
            });
        }
        
        const confirmConnectButton = document.getElementById('connectBtn');
        if (confirmConnectButton) {
            confirmConnectButton.addEventListener('click', async () => {
                const addressInput = document.getElementById('ipAddress');
                if (addressInput) {
                    this.appState.deviceAddress = addressInput.value.trim();
                    await this.connectToDevice();
                }
            });
        }
        
        const demoButton = document.getElementById('demoBtn');
        if (demoButton) {
            demoButton.addEventListener('click', () => {
                this.startDemoMode();
            });
        }
        
        const pumpStartButton = document.getElementById('pumpOnBtn');
        const pumpStopButton = document.getElementById('pumpOffBtn');
        
        if (pumpStartButton) {
            pumpStartButton.addEventListener('click', async () => {
                const durationInput = document.getElementById('manualPumpTimeInput');
                const pumpDuration = Math.max(1, parseInt(durationInput?.value, 10) || 10);
                const pumpDurationMs = pumpDuration * 1000;

                if (this.appState.demoMode) {
                    this.appState.currentSystemData.pump = true;
                    this.updateInterface(this.appState.currentSystemData);
                    this.notificationManager.show(`💧 Полив запущен на ${pumpDuration} сек (демо)`, 'success');
                    setTimeout(() => {
                        this.appState.currentSystemData.pump = false;
                        this.updateInterface(this.appState.currentSystemData);
                    }, pumpDurationMs);
                    return;
                }

                if (!this.appState.connected) {
                    this.notificationManager.show('❌ Нет подключения к системе', 'error');
                    return;
                }

                try {
                    await this.apiClient.controlPumpOperation(this.appState.deviceAddress, 'on');
                    this.notificationManager.show(`💧 Полив запущен на ${pumpDuration} сек`, 'success');
                    setTimeout(async () => {
                        try {
                            await this.apiClient.controlPumpOperation(this.appState.deviceAddress, 'off');
                            this.notificationManager.show('✅ Полив завершен', 'success');
                            setTimeout(() => this.refreshSystemData(), 1000);
                        } catch (error) {
                            this.notificationManager.show('❌ Ошибка отключения насоса', 'error');
                        }
                    }, pumpDurationMs);
                } catch (error) {
                    this.notificationManager.show('❌ Ошибка включения насоса', 'error');
                }
            });
        }
        
        if (pumpStopButton) {
            pumpStopButton.addEventListener('click', async () => {
                if (this.appState.demoMode) {
                    this.appState.currentSystemData.pump = false;
                    this.updateInterface(this.appState.currentSystemData);
                    this.notificationManager.show('✅ Насос выключен (демо)', 'success');
                } else if (this.appState.connected) {
                    try {
                        await this.apiClient.controlPumpOperation(this.appState.deviceAddress, 'off');
                        this.notificationManager.show('✅ Насос выключен', 'success');
                        setTimeout(() => this.refreshSystemData(), 1000);
                    } catch (error) {
                        this.notificationManager.show('❌ Ошибка выключения насоса', 'error');
                    }
                }
            });
        }
        
        const lightStartButton = document.getElementById('lightOnBtn');
        const lightStopButton = document.getElementById('lightOffBtn');
        
        if (lightStartButton) {
            lightStartButton.addEventListener('click', async () => {
                if (this.appState.demoMode) {
                    this.appState.currentSystemData.light = true;
                    this.updateInterface(this.appState.currentSystemData);
                    this.notificationManager.show('💡 Свет включен (демо)', 'success');
                } else if (this.appState.connected) {
                    try {
                        await this.apiClient.controlLightOperation(this.appState.deviceAddress, 'on');
                        this.notificationManager.show('💡 Свет включен', 'success');
                        setTimeout(() => this.refreshSystemData(), 1000);
                    } catch (error) {
                        this.notificationManager.show('❌ Ошибка включения света', 'error');
                    }
                }
            });
        }
        
        if (lightStopButton) {
            lightStopButton.addEventListener('click', async () => {
                if (this.appState.demoMode) {
                    this.appState.currentSystemData.light = false;
                    this.updateInterface(this.appState.currentSystemData);
                    this.notificationManager.show('✅ Свет выключен (демо)', 'success');
                } else if (this.appState.connected) {
                    try {
                        await this.apiClient.controlLightOperation(this.appState.deviceAddress, 'off');
                        this.notificationManager.show('✅ Свет выключен', 'success');
                        setTimeout(() => this.refreshSystemData(), 1000);
                    } catch (error) {
                        this.notificationManager.show('❌ Ошибка выключения света', 'error');
                    }
                }
            });
        }
        
        const timeSyncButton = document.getElementById('syncTimeBtn');
        if (timeSyncButton) {
            timeSyncButton.addEventListener('click', async () => {
                if (this.appState.demoMode) {
                    this.notificationManager.show('🕐 Время синхронизировано (демо)', 'success');
                } else if (this.appState.connected) {
                    try {
                        await this.apiClient.synchronizeTime(this.appState.deviceAddress);
                        this.notificationManager.show('🕐 Время синхронизировано', 'success');
                        setTimeout(() => this.refreshSystemData(), 1000);
                    } catch (error) {
                        this.notificationManager.show('❌ Ошибка синхронизации времени', 'error');
                    }
                }
            });
        }

        const setTimeButton = document.getElementById('setTimeBtn');
        const manualTimeInput = document.getElementById('manualTimeInput');
        if (manualTimeInput) {
            const currentTime = new Date();
            manualTimeInput.value = currentTime.toTimeString().slice(0, 5);
        }

        if (setTimeButton && manualTimeInput) {
            setTimeButton.addEventListener('click', async () => {
                if (!manualTimeInput.value) {
                    this.notificationManager.show('❌ Укажите время для установки', 'error');
                    return;
                }

                const [hoursValue, minutesValue] = manualTimeInput.value.split(':').map(Number);
                if (Number.isNaN(hoursValue) || Number.isNaN(minutesValue)) {
                    this.notificationManager.show('❌ Некорректный формат времени', 'error');
                    return;
                }

                if (this.appState.demoMode) {
                    this.updateDisplayElement('systemTime', manualTimeInput.value);
                    this.notificationManager.show('🕐 Время установлено (демо)', 'success');
                    return;
                }

                if (!this.appState.connected) {
                    this.notificationManager.show('❌ Нет подключения к системе', 'error');
                    return;
                }

                try {
                    await this.apiClient.setDeviceTime(this.appState.deviceAddress, hoursValue, minutesValue);
                    this.notificationManager.show('🕐 Время установлено', 'success');
                    setTimeout(() => this.refreshSystemData(), 1000);
                } catch (error) {
                    this.notificationManager.show('❌ Ошибка установки времени', 'error');
                }
            });
        }
        
        const thresholdSlider = document.getElementById('moistureThreshold');
        const thresholdDisplay = document.getElementById('thresholdValue');
        
        if (thresholdSlider && thresholdDisplay) {
            thresholdSlider.addEventListener('input', (sliderEvent) => {
                thresholdDisplay.textContent = sliderEvent.target.value + '%';
            });
            
            thresholdSlider.addEventListener('change', async (sliderEvent) => {
                const thresholdValue = parseInt(sliderEvent.target.value);
                if (this.appState.demoMode) {
                    this.appState.currentSystemData.moisture_threshold = thresholdValue;
                    this.notificationManager.show('✅ Порог влажности обновлен (демо)', 'success');
                } else if (this.appState.connected) {
                    try {
                        await this.apiClient.updateSystemSettings(this.appState.deviceAddress, {
                            moisture_threshold: thresholdValue
                        });
                        this.notificationManager.show('✅ Порог влажности обновлен', 'success');
                    } catch (error) {
                        this.notificationManager.show('❌ Ошибка обновления настроек', 'error');
                    }
                }
            });
        }
        
        const clearErrorsButton = document.getElementById('clearErrorsBtn');
        if (clearErrorsButton) {
            clearErrorsButton.addEventListener('click', async () => {
                if (this.appState.demoMode) {
                    this.appState.currentSystemData.errors = [];
                    this.updateErrorDisplay([]);
                    this.notificationManager.show('✅ Ошибки очищены (демо)', 'success');
                } else if (this.appState.connected) {
                    try {
                        await this.apiClient.clearErrorLog(this.appState.deviceAddress);
                        this.notificationManager.show('✅ Ошибки очищены', 'success');
                        setTimeout(() => this.refreshSystemData(), 1000);
                    } catch (error) {
                        this.notificationManager.show('❌ Ошибка очистки ошибок', 'error');
                    }
                }
            });
        }
        
        const resetStatsButton = document.getElementById('resetStatsBtn');
        if (resetStatsButton) {
            resetStatsButton.addEventListener('click', () => {
                if (this.appState.demoMode) {
                    this.appState.currentSystemData.total_waterings = 0;
                    this.appState.currentSystemData.total_light_hours = 0;
                    this.appState.currentSystemData.total_energy = 0;
                    this.appState.currentSystemData.min_moisture = this.appState.currentSystemData.moisture;
                    this.appState.currentSystemData.max_moisture = this.appState.currentSystemData.moisture;
                    
                    this.updateInterface(this.appState.currentSystemData);
                    this.notificationManager.show('✅ Статистика сброшена (демо)', 'success');
                } else if (this.appState.connected) {
                    this.apiClient.resetSystemStatistics(this.appState.deviceAddress)
                        .then(() => {
                            this.notificationManager.show('✅ Статистика сброшена', 'success');
                            setTimeout(() => this.refreshSystemData(), 500);
                        })
                        .catch((error) => {
                            console.error('Ошибка сброса статистики:', error);
                            this.notificationManager.show('❌ Ошибка сброса статистики', 'error');
                        });
                } else {
                    this.notificationManager.show('❌ Нет подключения к системе', 'error');
                }
            });
        }
        
        const documentationLink = document.getElementById('docsLink');
        if (documentationLink) {
            documentationLink.addEventListener('click', (clickEvent) => {
                clickEvent.preventDefault();
                window.open('https://docs.google.com/document/d/1WqwljHYKqke6uKdL4wd3HSNd9nIVkHLH/edit', '_blank');
            });
        }
        
        const quickGuideButton = document.getElementById('quickGuideBtn');
        const quickGuideDialog = document.getElementById('quickGuideModal');
        if (quickGuideButton && quickGuideDialog) {
            quickGuideButton.addEventListener('click', () => {
                quickGuideDialog.classList.add('active');
            });
        }
        
        document.querySelectorAll('.modal-close').forEach(closeButton => {
            closeButton.addEventListener('click', () => {
                closeButton.closest('.modal').classList.remove('active');
            });
        });
        
        document.querySelectorAll('.modal').forEach(dialogElement => {
            dialogElement.addEventListener('click', (clickEvent) => {
                if (clickEvent.target === dialogElement) {
                    dialogElement.classList.remove('active');
                }
            });
        });
        
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.addEventListener('change', (selectionEvent) => {
                this.themeManager.setTheme(selectionEvent.target.value);
                this.notificationManager.show(`✅ Тема изменена на "${selectionEvent.target.selectedOptions[0].text}"`, 'success');
            });
        }

        const notificationsToggle = document.getElementById('notificationsToggle');
        const silentToggle = document.getElementById('silentNotificationsToggle');

        const updateNotificationControls = () => {
            if (notificationsToggle) {
                notificationsToggle.checked = this.notificationManager.enabled;
            }
            if (silentToggle) {
                silentToggle.checked = this.notificationManager.silentMode;
                silentToggle.disabled = !this.notificationManager.enabled;
            }
        };

        if (notificationsToggle) {
            const notificationsEnabled = localStorage.getItem('notifications_enabled') !== 'false';
            this.notificationManager.setEnabled(notificationsEnabled);
            notificationsToggle.addEventListener('change', (toggleEvent) => {
                this.notificationManager.setEnabled(toggleEvent.target.checked);
                updateNotificationControls();
            });
        }

        if (silentToggle) {
            const silentEnabled = localStorage.getItem('notifications_silent') === 'true';
            this.notificationManager.setSilentMode(silentEnabled);
            silentToggle.addEventListener('change', (toggleEvent) => {
                this.notificationManager.setSilentMode(toggleEvent.target.checked);
                updateNotificationControls();
            });
        }

        updateNotificationControls();
        
        const updateIntervalInput = document.getElementById('updateInterval');
        if (updateIntervalInput) {
            updateIntervalInput.addEventListener('change', (inputEvent) => {
                const intervalValue = parseInt(inputEvent.target.value) * 1000;
                if (intervalValue >= 2000 && intervalValue <= 60000) {
                    this.appState.updateFrequency = intervalValue;
                    this.notificationManager.show(`✅ Интервал обновления: ${inputEvent.target.value} сек`, 'success');
                }
            });
        }
    }
    
    startDataUpdateCycle() {
        setInterval(() => {
            if (this.appState.connected) {
                this.refreshSystemData();
            }
        }, this.appState.updateFrequency);
        
        setInterval(() => {
            if (this.appState.demoMode && this.appState.currentSystemData) {
                const currentTime = new Date();
                this.appState.currentSystemData.current_time = currentTime.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                this.updateDisplayElement('systemTime', this.appState.currentSystemData.current_time);
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
    if (window.ecoGrowApp && !window.ecoGrowApp.appState.demoMode) {
        window.ecoGrowApp.notificationManager.show('📡 Соединение восстановлено', 'success');
        if (!window.ecoGrowApp.appState.connected) {
            window.ecoGrowApp.attemptAutoConnection();
        }
    }
});

window.addEventListener('offline', () => {
    if (window.ecoGrowApp && !window.ecoGrowApp.appState.demoMode) {
        window.ecoGrowApp.notificationManager.show('⚠️ Отсутствует интернет-соединение', 'warning');
        window.ecoGrowApp.appState.connected = false;
        window.ecoGrowApp.updateConnectionDisplay();
        window.ecoGrowApp.clearDisplayedData();
    }
});
