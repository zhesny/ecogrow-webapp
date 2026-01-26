// Main Application Logic
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
            maxRetries: 3
        };
        
        this.init();
    }
    
    async init() {
        // Initialize theme
        this.theme.init();
        
        // Show loading screen
        this.showLoading();
        
        // Try to auto-connect
        await this.tryAutoConnect();
        
        // Initialize charts
        this.charts.init();
        
        // Start update loop
        this.startUpdateLoop();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Hide loading screen
        setTimeout(() => this.hideLoading(), 1500);
        
        // Initialize PWA
        this.initPWA();
        
        // Initialize network status listeners
        this.initNetworkListeners();
    }
    
    initPWA() {
        // PWA installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            const installBtn = document.getElementById('pwaInstallBtn');
            if (installBtn) {
                installBtn.style.display = 'flex';
                installBtn.addEventListener('click', () => this.installPWA());
            }
        });

        // Check if running as PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Запущено как PWA');
        }
    }
    
    initNetworkListeners() {
        // Detect network changes
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
        // Try saved IP first
        const savedIp = localStorage.getItem('ecogrow_ip');
        if (savedIp) {
            this.state.espIp = savedIp;
            await this.connectToESP();
            return;
        }
        
        // Try common local IPs
        const commonIPs = [
            'ecogrow.local',
            '192.168.1.100',
            '192.168.0.100',
            '192.168.4.1',
            '10.0.0.100'
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
        
        // Show connection modal
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
            
            // Normalize IP address
            let normalizedIp = this.state.espIp;
            if (!normalizedIp.includes('://')) {
                normalizedIp = `http://${normalizedIp}`;
            }
            
            // Test connection
            this.state.demoMode = false;
            const isConnected = await this.api.testConnection(this.state.espIp);
            
            if (!isConnected) {
                throw new Error('Устройство недоступно');
            }
            
            // Get device info
            const info = await this.api.getInfo(this.state.espIp);
            
            // Save to localStorage
            localStorage.setItem('ecogrow_ip', this.state.espIp);
            
            // Reset retry count on successful connection
            this.state.connectionRetryCount = 0;
            
            // Update connection status
            this.state.connected = true;
            this.updateConnectionStatus();
            
            // Hide demo banner
            const demoBanner = document.getElementById('demoBanner');
            if (demoBanner) demoBanner.style.display = 'none';
            
            // Get initial data
            await this.updateData();
            
            // Close modal if open
            this.hideConnectionModal();
            
            // Show success notification
            this.notifications.show(`✅ Успешно подключено к ${info.hostname || this.state.espIp}!`, 'success');
            
        } catch (error) {
            console.error('Connection failed:', error);
            
            this.state.connected = false;
            this.updateConnectionStatus();
            
            // Clear stale data immediately
            this.clearStaleData();
            
            // Check if we should retry
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
        
        // Generate demo data
        this.state.currentData = {
            moisture: 65,
            avg_moisture: 62,
            min_moisture: 58,
            max_moisture: 70,
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
            total_waterings: 124,
            total_light_hours: 356,
            total_energy: 17800,
            errors: [],
            moisture_history: Array.from({length: 20}, (_, i) => 60 + Math.sin(i * 0.5) * 10 + Math.random() * 5)
        };
        
        this.updateConnectionStatus();
        this.updateUI(this.state.currentData);
        this.charts.updateMoistureChart(this.state.currentData.moisture_history);
        
        // Show demo banner
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
    }
    
    async updateData() {
        if (!this.state.connected) return;
        
        if (this.state.demoMode) {
            // Update demo data
            const now = new Date();
            const hour = now.getHours();
            
            // Simulate day/night cycle
            if (hour >= 8 && hour < 20) {
                this.state.currentData.light = true;
            } else {
                this.state.currentData.light = false;
            }
            
            // Simulate moisture changes
            this.state.currentData.moisture = Math.max(20, Math.min(80, 
                60 + Math.sin(Date.now() / 60000) * 10 + Math.random() * 5
            ));
            
            // Update time
            this.state.currentData.current_time = now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Update history data
            this.state.currentData.moisture_history.push(this.state.currentData.moisture);
            if (this.state.currentData.moisture_history.length > 20) {
                this.state.currentData.moisture_history.shift();
            }
            
            this.updateUI(this.state.currentData);
            this.charts.updateMoistureChart(this.state.currentData.moisture_history);
            return;
        }
        
        try {
            // Quick connection test before full request
            const isConnected = await this.api.testConnection(this.state.espIp);
            if (!isConnected) {
                throw new Error('Устройство недоступно');
            }
            
            // Get current state
            const data = await this.api.getState(this.state.espIp);
            this.state.currentData = data;
            this.state.lastUpdate = new Date();
            this.state.connectionRetryCount = 0; // Reset retry count on successful update
            
            // Update UI
            this.updateUI(data);
            
            // Update charts
            this.charts.updateMoistureChart(data.moisture_history);
            
            // Update notifications if needed
            this.checkNotifications(data);
            
        } catch (error) {
            console.error('Update failed:', error);
            
            this.state.connectionRetryCount++;
            
            if (this.state.connectionRetryCount >= this.state.maxRetries) {
                this.state.connected = false;
                this.updateConnectionStatus();
                this.clearStaleData();
                this.notifications.show('❌ Потеряно соединение с устройством', 'error');
                
                // Ask user if they want to switch to demo mode
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
        // Clear all displayed data
        const staleElements = [
            'moistureValue', 'avgMoisture', 'minMoisture', 'maxMoisture',
            'pumpStatus', 'lightStatus', 'currentTime', 'systemTime',
            'totalWaterings', 'totalLightHours', 'energyUsed',
            'moistureStatus', 'thresholdValue'
        ];
        
        staleElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'moistureStatus') {
                    element.textContent = '--%';
                } else if (id === 'thresholdValue') {
                    element.textContent = '--%';
                } else if (id === 'pumpStatus' || id === 'lightStatus') {
                    element.textContent = '--';
                    element.className = 'card-status';
                } else {
                    element.textContent = '--';
                }
            }
        });
        
        // Clear moisture bar
        const moistureBarFill = document.getElementById('moistureBarFill');
        if (moistureBarFill) {
            moistureBarFill.style.width = '0%';
        }
        
        // Clear chart
        if (this.charts.moistureChart) {
            this.charts.moistureChart.data.labels = ['Нет данных'];
            this.charts.moistureChart.data.datasets[0].data = [0];
            this.charts.moistureChart.update();
        }
        
        // Clear errors list
        this.updateErrorsList([]);
    }
    
    updateUI(data) {
        if (!data) return;
        
        // Update moisture values
        this.updateElement('moistureValue', Math.round(data.moisture));
        this.updateElement('avgMoisture', Math.round(data.avg_moisture || data.moisture) + '%');
        this.updateElement('minMoisture', Math.round(data.min_moisture || data.moisture) + '%');
        this.updateElement('maxMoisture', Math.round(data.max_moisture || data.moisture) + '%');
        
        // Update moisture bar
        const moistureBarFill = document.getElementById('moistureBarFill');
        if (moistureBarFill) {
            moistureBarFill.style.width = `${data.moisture}%`;
        }
        
        // Update moisture status
        const statusElement = document.getElementById('moistureStatus');
        if (statusElement) {
            let icon = 'fa-leaf';
            if (data.moisture < 30) icon = 'fa-exclamation-triangle';
            else if (data.moisture < 50) icon = 'fa-tint';
            else if (data.moisture > 80) icon = 'fa-flood';
            
            statusElement.innerHTML = `<i class="fas ${icon}"></i> ${Math.round(data.moisture)}%`;
        }
        
        // Update pump status
        this.updateElement('pumpStatus', data.pump ? 'ВКЛ' : 'ВЫКЛ');
        const pumpStatusElement = document.getElementById('pumpStatus');
        if (pumpStatusElement) {
            pumpStatusElement.className = `card-status ${data.pump ? 'status-on' : 'status-off'}`;
        }
        
        // Update light status
        this.updateElement('lightStatus', data.light ? 'ВКЛ' : 'ВЫКЛ');
        const lightStatusElement = document.getElementById('lightStatus');
        if (lightStatusElement) {
            lightStatusElement.className = `card-status ${data.light ? 'status-on' : 'status-off'}`;
        }
        
        // Update threshold from system data
        const thresholdSlider = document.getElementById('moistureThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        if (thresholdSlider && thresholdValue && data.moisture_threshold) {
            thresholdSlider.value = data.moisture_threshold;
            thresholdValue.textContent = data.moisture_threshold + '%';
        }
        
        // Update current time
        this.updateElement('currentTime', data.current_time);
        this.updateElement('systemTime', data.current_time);
        
        // Update statistics
        this.updateElement('totalWaterings', data.total_waterings || 0);
        this.updateElement('totalLightHours', data.total_light_hours || 0);
        this.updateElement('energyUsed', data.total_energy || '0');
        
        // Update errors list
        this.updateErrorsList(data.errors || []);
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            // Animate number changes
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
                    <div class="error-time">${error.time || '--:--'}</div>
                    <div class="error-msg">${error.msg || error.message || 'Неизвестная ошибка'}</div>
                </div>
            `;
        });
        
        if (errors.length > 5) {
            html += `
                <div class="error-item more">
                    <span>... и еще ${errors.length - 5} ошибок</span>
                </div>
            `;
        }
        
        if (errorsList) errorsList.innerHTML = html;
    }
    
    checkNotifications(data) {
        // Check for low moisture
        if (data.moisture < 20) {
            this.notifications.show(
                `⚠️ Низкая влажность: ${data.moisture}%`, 
                'warning'
            );
        }
        
        // Check for sensor error
        if (data.moisture === 0) {
            this.notifications.show(
                '❌ Ошибка датчика влажности!', 
                'error'
            );
        }
        
        // Check for pump running
        if (data.pump) {
            this.notifications.show(
                '💧 Насос работает...', 
                'info'
            );
        }
    }
    
    setupEventListeners() {
        // Connect button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                const ipInput = document.getElementById('ipAddress');
                if (ipInput && ipInput.value) {
                    this.state.espIp = ipInput.value;
                    this.connectToESP();
                }
            });
        }
        
        // Demo button
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                this.startDemoMode();
            });
        }
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.theme.toggle();
            });
        }
        
        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                document.getElementById('settingsModal').classList.add('active');
            });
        }
        
        // Pump controls
        const pumpOnBtn = document.getElementById('pumpOnBtn');
        const pumpOffBtn = document.getElementById('pumpOffBtn');
        
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
        
        // Light controls - FIXED BUTTON STYLE
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
        
        // Sync time button
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
        
        // Settings sliders
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
        
        // Clear errors button
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
        
        // NEW: Reset statistics button
        const resetStatsBtn = document.getElementById('resetStatsBtn');
        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', async () => {
                if (this.state.demoMode) {
                    this.state.currentData.total_waterings = 0;
                    this.state.currentData.total_light_hours = 0;
                    this.state.currentData.total_energy = 0;
                    this.updateUI(this.state.currentData);
                    this.notifications.show('✅ Статистика сброшена (демо)', 'success');
                } else if (this.state.connected) {
                    try {
                        await this.api.resetStats(this.state.espIp);
                        this.notifications.show('✅ Статистика сброшена', 'success');
                        setTimeout(() => this.updateData(), 1000);
                    } catch (error) {
                        this.notifications.show('❌ Ошибка сброса статистики', 'error');
                    }
                }
            });
        }
        
        // Documentation link
        const docsLink = document.getElementById('docsLink');
        if (docsLink) {
            docsLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('https://docs.google.com/document/d/1WqwljHYKqke6uKdL4wd3HSNd9nIVkHLH/edit', '_blank');
            });
        }
        
        // Quick guide button
        const quickGuideBtn = document.getElementById('quickGuideBtn');
        const quickGuideModal = document.getElementById('quickGuideModal');
        if (quickGuideBtn && quickGuideModal) {
            quickGuideBtn.addEventListener('click', () => {
                quickGuideModal.classList.add('active');
            });
        }
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });
        
        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Theme selector
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.theme.setTheme(e.target.value);
                this.notifications.show(`✅ Тема изменена на "${e.target.selectedOptions[0].text}"`, 'success');
            });
        }
        
        // Update interval
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
        // Update data periodically
        setInterval(() => {
            if (this.state.connected) {
                this.updateData();
            }
        }, this.state.updateInterval);
        
        // Update time every minute
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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ecoGrowApp = new EcoGrowApp();
});

// Add service worker for PWA
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

// Online/offline detection
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
