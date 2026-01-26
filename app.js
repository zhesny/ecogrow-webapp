// Main Application Logic
class EcoGrowApp {
    constructor() {
        this.api = new EcoGrowAPI();
        this.demoApi = new DemoAPI();
        this.charts = new ChartsManager();
        this.theme = new ThemeManager();
        this.notifications = new NotificationManager();
        this.config = new ConfigManager();
        
        this.state = {
            connected: false,
            espIp: null,
            currentData: null,
            settings: {},
            lastUpdate: null,
            version: '4.5.1',
            demoMode: false,
            autoUpdateInterval: null,
            timeUpdateInterval: null
        };
        
        this.init();
    }
    
    async init() {
        console.log('Initializing EcoGrow App v4.5.1');
        
        // Initialize theme
        this.theme.init();
        
        // Show loading screen
        this.showLoading();
        
        // Try to auto-connect
        await this.tryAutoConnect();
        
        // Initialize charts
        this.charts.init();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('App initialized');
    }
    
    showLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainContainer = document.getElementById('mainContainer');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
            loadingScreen.style.pointerEvents = 'all';
        }
        if (mainContainer) {
            mainContainer.style.display = 'none';
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
        } else if (mainContainer) {
            mainContainer.style.display = 'block';
        }
    }
    
    async tryAutoConnect() {
        console.log('Trying to auto-connect...');
        
        // First check localStorage for saved IP
        const savedIp = localStorage.getItem('ecogrow_ip');
        const savedDemo = localStorage.getItem('ecogrow_demo_mode') === 'true';
        
        if (savedDemo) {
            console.log('Found saved demo mode, enabling...');
            await this.enableDemoMode();
            return;
        }
        
        if (savedIp) {
            console.log('Found saved IP:', savedIp);
            this.state.espIp = savedIp;
            await this.connectToESP();
            return;
        }
        
        // Try mDNS connection
        console.log('Trying mDNS connection...');
        try {
            // Use timeout for connection attempt
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch('http://ecogrow.local/api/info', { 
                signal: controller.signal,
                mode: 'no-cors'
            }).catch(() => null);
            
            clearTimeout(timeoutId);
            
            if (response && response.ok) {
                this.state.espIp = 'ecogrow.local';
                await this.connectToESP();
                return;
            }
        } catch (error) {
            console.log('mDNS connection failed:', error);
        }
        
        // If nothing works, show connection modal
        console.log('No connection found, showing modal');
        this.hideLoading();
        this.showConnectionModal();
    }
    
    showConnectionModal() {
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    async connectToESP() {
        if (!this.state.espIp) {
            this.showConnectionModal();
            return;
        }
        
        try {
            // Test connection
            console.log('Connecting to:', this.state.espIp);
            const info = await this.api.getInfo(this.state.espIp);
            console.log('Connection successful:', info);
            
            // Save to localStorage
            localStorage.setItem('ecogrow_ip', this.state.espIp);
            localStorage.removeItem('ecogrow_demo_mode');
            
            // Update connection status
            this.state.connected = true;
            this.state.demoMode = false;
            this.updateConnectionStatus();
            
            // Get initial data
            await this.updateData();
            
            // Close modal if open
            this.hideConnectionModal();
            
            // Show success notification
            this.notifications.show('✅ Успешно подключено к системе!', 'success');
            
            // Hide loading screen
            this.hideLoading();
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.state.connected = false;
            this.updateConnectionStatus();
            this.notifications.show('❌ Не удалось подключиться к системе', 'error');
            this.hideLoading();
            this.showConnectionModal();
        }
    }
    
    async enableDemoMode() {
        console.log('Enabling demo mode...');
        
        // Show loading screen
        this.showLoading();
        
        this.state.connected = true;
        this.state.demoMode = true;
        this.state.espIp = 'demo-mode';
        
        // Show demo badge
        const demoBadge = document.getElementById('demoBadge');
        if (demoBadge) {
            demoBadge.style.display = 'block';
        }
        
        // Update connection status
        this.updateConnectionStatus();
        
        // Get initial demo data
        await this.updateData();
        
        // Close modal if open
        this.hideConnectionModal();
        
        // Save demo mode preference
        localStorage.setItem('ecogrow_demo_mode', 'true');
        
        // Show notification
        this.notifications.show('🔮 Демо-режим активирован', 'info');
        
        // Start demo update loop
        this.startDemoUpdateLoop();
        
        // Hide loading screen
        setTimeout(() => {
            this.hideLoading();
        }, 1000);
        
        console.log('Demo mode enabled');
    }
    
    disableDemoMode() {
        console.log('Disabling demo mode...');
        
        this.state.demoMode = false;
        this.state.connected = false;
        
        // Hide demo badge
        const demoBadge = document.getElementById('demoBadge');
        if (demoBadge) {
            demoBadge.style.display = 'none';
        }
        
        // Remove demo mode preference
        localStorage.removeItem('ecogrow_demo_mode');
        
        // Stop demo update loop
        this.stopDemoUpdateLoop();
        
        // Show connection modal
        this.showConnectionModal();
        
        console.log('Demo mode disabled');
    }
    
    hideConnectionModal() {
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (this.state.demoMode) {
                statusElement.innerHTML = `
                    <div class="status-dot demo"></div>
                    <span>Демо-режим</span>
                `;
                statusElement.classList.add('connected');
            } else if (this.state.connected) {
                statusElement.innerHTML = `
                    <div class="status-dot"></div>
                    <span>Подключено к ${this.state.espIp}</span>
                `;
                statusElement.classList.add('connected');
            } else {
                statusElement.innerHTML = `
                    <div class="status-dot"></div>
                    <span>Нет подключения</span>
                `;
                statusElement.classList.remove('connected');
            }
        }
        
        // Add manual refresh button if not exists
        this.addManualRefreshButton();
    }
    
    addManualRefreshButton() {
        const statusContainer = document.querySelector('.header-controls');
        if (!statusContainer) return;
        
        // Check if button already exists
        if (document.getElementById('manualRefreshBtn')) return;
        
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'manualRefreshBtn';
        refreshBtn.className = 'header-btn';
        refreshBtn.title = 'Обновить данные';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('refreshing');
            await this.updateData();
            setTimeout(() => {
                refreshBtn.classList.remove('refreshing');
            }, 1000);
        });
        
        // Add after connection status
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement && statusElement.parentNode === statusContainer) {
            statusContainer.insertBefore(refreshBtn, statusElement.nextSibling);
        } else {
            statusContainer.appendChild(refreshBtn);
        }
    }
    
    async updateData() {
        if (!this.state.connected) return;
        
        try {
            let data;
            
            if (this.state.demoMode) {
                // Use demo API
                data = await this.demoApi.getState(this.state.espIp);
            } else {
                // Use real API
                data = await this.api.getState(this.state.espIp);
            }
            
            this.state.currentData = data;
            this.state.lastUpdate = new Date();
            
            // Update UI
            this.updateUI(data);
            
            // Update charts
            if (data.moisture_history && data.moisture_history.length > 0) {
                this.charts.updateMoistureChart(data.moisture_history, data.current_time);
            }
            
            // Update notifications if needed
            this.checkNotifications(data);
            
            // Update last update time
            this.updateLastUpdateTime();
            
        } catch (error) {
            console.error('Update failed:', error);
            if (!this.state.demoMode) {
                this.state.connected = false;
                this.updateConnectionStatus();
                this.notifications.show('❌ Потеряно соединение с системой', 'error');
            }
        }
    }
    
    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Find and update the time in connection status
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement && this.state.connected) {
            const span = statusElement.querySelector('span');
            if (span) {
                if (this.state.demoMode) {
                    span.textContent = `Демо-режим • ${timeString}`;
                } else {
                    span.textContent = `Подключено • ${timeString}`;
                }
            }
        }
    }
    
    updateUI(data) {
        // Update moisture values
        this.updateElement('moistureValue', data.moisture);
        this.updateElement('avgMoisture', data.avg_moisture + '%');
        this.updateElement('minMoisture', data.min_moisture + '%');
        this.updateElement('maxMoisture', data.max_moisture || '--%');
        
        // Update moisture bar
        const moistureBarFill = document.getElementById('moistureBarFill');
        if (moistureBarFill) {
            moistureBarFill.style.width = `${data.moisture}%`;
        }
        
        // Update moisture status
        const statusElement = document.getElementById('moistureStatus');
        if (statusElement) {
            statusElement.textContent = `${data.moisture}%`;
            statusElement.className = `card-status ${data.moisture < 30 ? 'status-off' : 'status-on'}`;
        }
        
        // Update pump status
        this.updateElement('pumpStatus', data.pump ? 'ВКЛ' : 'ВЫКЛ');
        document.getElementById('pumpStatus').className = 
            `card-status ${data.pump ? 'status-on' : 'status-off'}`;
        
        // Update light status
        this.updateElement('lightStatus', data.light ? 'ВКЛ' : 'ВЫКЛ');
        document.getElementById('lightStatus').className = 
            `card-status ${data.light ? 'status-on' : 'status-off'}`;
        
        // Update sleep status
        const sleepActive = data.sleep_enabled && this.isTimeInRange(
            new Date(), 
            data.sleep_start, 
            data.sleep_end
        );
        this.updateElement('sleepStatus', sleepActive ? 'Активен' : 'Неактивен');
        document.getElementById('sleepStatus').className = 
            `card-status ${sleepActive ? 'status-on' : 'status-off'}`;
        
        // Update statistics
        this.updateElement('totalWaterings', data.total_waterings);
        this.updateElement('totalLightHours', data.total_light_hours);
        this.updateElement('energyUsed', data.total_energy || '0');
        
        // Update current time
        this.updateElement('systemTime', data.current_time);
        
        // Update threshold value from system - ВАЖНОЕ ИСПРАВЛЕНИЕ
        if (data.moisture_threshold !== undefined) {
            const thresholdSlider = document.getElementById('moistureThreshold');
            const thresholdValue = document.getElementById('thresholdValue');
            
            if (thresholdSlider && thresholdSlider.value != data.moisture_threshold) {
                thresholdSlider.value = data.moisture_threshold;
            }
            if (thresholdValue) {
                thresholdValue.textContent = data.moisture_threshold + '%';
            }
        }
        
        // Update errors list
        this.updateErrorsList(data.errors);
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
            errorCount.textContent = '0';
            return;
        }
        
        errorCount.textContent = errors.length;
        
        let html = '';
        errors.slice(0, 5).forEach(error => {
            const criticalClass = error.critical ? 'critical' : '';
            html += `
                <div class="error-item ${criticalClass}">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="error-content">
                        <div class="error-time">${error.time}</div>
                        <div class="error-message">${error.msg}</div>
                    </div>
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
        
        errorsList.innerHTML = html;
    }
    
    checkNotifications(data) {
        if (data.moisture < 20) {
            this.notifications.show(
                `⚠️ Низкая влажность: ${data.moisture}%`, 
                'warning'
            );
        }
        
        if (data.moisture === 0) {
            this.notifications.show(
                '❌ Ошибка датчика влажности!', 
                'error'
            );
        }
        
        if (data.pump) {
            this.notifications.show(
                '💧 Насос работает...', 
                'info'
            );
        }
    }
    
    isTimeInRange(now, startStr, endStr) {
        const [startHour, startMin] = startStr.split(':').map(Number);
        const [endHour, endMin] = endStr.split(':').map(Number);
        
        const nowHour = now.getHours();
        const nowMin = now.getMinutes();
        
        const start = startHour * 60 + startMin;
        const end = endHour * 60 + endMin;
        const current = nowHour * 60 + nowMin;
        
        if (start <= end) {
            return current >= start && current < end;
        } else {
            return current >= start || current < end;
        }
    }
    
    setupEventListeners() {
        console.log('Setting up event listeners');
        
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
        
        // Start demo mode button in modal
        const startDemoModeBtn = document.getElementById('startDemoMode');
        if (startDemoModeBtn) {
            startDemoModeBtn.addEventListener('click', () => {
                this.enableDemoMode();
            });
        }
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.theme.toggle();
            });
        }
        
        // Pump controls
        const pumpOnBtn = document.getElementById('pumpOnBtn');
        const pumpOffBtn = document.getElementById('pumpOffBtn');
        
        if (pumpOnBtn) {
            pumpOnBtn.addEventListener('click', async () => {
                try {
                    if (this.state.demoMode) {
                        await this.demoApi.controlPump(this.state.espIp, 'on');
                    } else {
                        await this.api.controlPump(this.state.espIp, 'on');
                    }
                    this.notifications.show('💧 Насос включен', 'success');
                    await this.updateData();
                } catch (error) {
                    this.notifications.show('❌ Ошибка включения насоса', 'error');
                }
            });
        }
        
        if (pumpOffBtn) {
            pumpOffBtn.addEventListener('click', async () => {
                try {
                    if (this.state.demoMode) {
                        await this.demoApi.controlPump(this.state.espIp, 'off');
                    } else {
                        await this.api.controlPump(this.state.espIp, 'off');
                    }
                    this.notifications.show('✅ Насос выключен', 'success');
                    await this.updateData();
                } catch (error) {
                    this.notifications.show('❌ Ошибка выключения насоса', 'error');
                }
            });
        }
        
        // Light controls
        const lightOnBtn = document.getElementById('lightOnBtn');
        const lightOffBtn = document.getElementById('lightOffBtn');
        
        if (lightOnBtn) {
            lightOnBtn.addEventListener('click', async () => {
                try {
                    if (this.state.demoMode) {
                        await this.demoApi.controlLight(this.state.espIp, 'on');
                    } else {
                        await this.api.controlLight(this.state.espIp, 'on');
                    }
                    this.notifications.show('💡 Свет включен', 'success');
                    await this.updateData();
                } catch (error) {
                    this.notifications.show('❌ Ошибка включения света', 'error');
                }
            });
        }
        
        if (lightOffBtn) {
            lightOffBtn.addEventListener('click', async () => {
                try {
                    if (this.state.demoMode) {
                        await this.demoApi.controlLight(this.state.espIp, 'off');
                    } else {
                        await this.api.controlLight(this.state.espIp, 'off');
                    }
                    this.notifications.show('✅ Свет выключен', 'success');
                    await this.updateData();
                } catch (error) {
                    this.notifications.show('❌ Ошибка выключения света', 'error');
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
                try {
                    const value = parseInt(e.target.value);
                    if (this.state.demoMode) {
                        await this.demoApi.updateSettings(this.state.espIp, {
                            moisture_threshold: value
                        });
                    } else {
                        await this.api.updateSettings(this.state.espIp, {
                            moisture_threshold: value
                        });
                    }
                    this.notifications.show('✅ Порог влажности обновлен', 'success');
                } catch (error) {
                    this.notifications.show('❌ Ошибка обновления настроек', 'error');
                }
            });
        }
        
        // Clear errors button
        const clearErrorsBtn = document.getElementById('clearErrorsBtn');
        if (clearErrorsBtn) {
            clearErrorsBtn.addEventListener('click', async () => {
                try {
                    if (this.state.demoMode) {
                        await this.demoApi.clearErrors(this.state.espIp);
                    } else {
                        await this.api.clearErrors(this.state.espIp);
                    }
                    this.notifications.show('✅ Ошибки очищены', 'success');
                    await this.updateData();
                } catch (error) {
                    this.notifications.show('❌ Ошибка очистки ошибок', 'error');
                }
            });
        }
        
        // Reset statistics button
        const resetStatsBtn = document.getElementById('resetStatsBtn');
        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', async () => {
                if (confirm('Вы уверены, что хотите сбросить всю статистику?')) {
                    try {
                        if (this.state.demoMode) {
                            this.demoApi.resetStats();
                            this.notifications.show('✅ Статистика сброшена', 'success');
                        } else {
                            // Для реальной системы
                            this.notifications.show('⚠️ Сброс статистики для реальной системы пока не поддерживается', 'warning');
                        }
                        await this.updateData();
                    } catch (error) {
                        this.notifications.show('❌ Ошибка сброса статистики', 'error');
                    }
                }
            });
        }
        
        // Sync time button
        const syncTimeBtn = document.getElementById('syncTimeBtn');
        if (syncTimeBtn) {
            syncTimeBtn.addEventListener('click', async () => {
                try {
                    if (this.state.demoMode) {
                        await this.demoApi.syncTime(this.state.espIp);
                    } else {
                        await this.api.syncTime(this.state.espIp);
                    }
                    this.notifications.show('🕐 Время синхронизировано', 'success');
                    await this.updateData();
                } catch (error) {
                    this.notifications.show('❌ Ошибка синхронизации времени', 'error');
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
        const quickGuideModal = document.getElementById('guideModal');
        if (quickGuideBtn && quickGuideModal) {
            quickGuideBtn.addEventListener('click', () => {
                quickGuideModal.classList.add('active');
            });
        }
        
        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        if (settingsBtn && settingsModal) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.classList.add('active');
            });
        }
        
        // Widgets guide button
        const widgetsGuideBtn = document.getElementById('widgetsGuideBtn');
        const widgetsModal = document.getElementById('widgetsModal');
        if (widgetsGuideBtn && widgetsModal) {
            widgetsGuideBtn.addEventListener('click', () => {
                widgetsModal.classList.add('active');
                // Generate QR code when modal opens
                generateQRCode();
            });
        }
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
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
        
        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                this.theme.setTheme(theme);
                
                // Update active button
                document.querySelectorAll('.theme-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                
                this.notifications.show(`✅ Тема изменена: ${this.theme.themes[theme].name}`, 'success');
            });
        });
        
        // Time range buttons for chart - ВАЖНОЕ ИСПРАВЛЕНИЕ
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Time button clicked:', e.target.dataset.hours);
                const hours = parseInt(e.target.dataset.hours);
                if (this.charts) {
                    this.charts.setTimeRange(hours);
                }
                
                // Update active button
                document.querySelectorAll('.time-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
            });
        });
        
        console.log('Event listeners set up');
    }
    
    startUpdateLoop() {
        // Clear existing intervals
        if (this.state.autoUpdateInterval) {
            clearInterval(this.state.autoUpdateInterval);
        }
        if (this.state.timeUpdateInterval) {
            clearInterval(this.state.timeUpdateInterval);
        }
        
        // Update data every 5 seconds
        this.state.autoUpdateInterval = setInterval(() => {
            if (this.state.connected && !this.state.demoMode) {
                this.updateData();
            }
        }, 5000);
        
        // Update time every minute
        this.state.timeUpdateInterval = setInterval(() => {
            this.updateCurrentTime();
        }, 60000);
        
        console.log('Update loops started');
    }
    
    startDemoUpdateLoop() {
        // Stop any existing demo loop
        this.stopDemoUpdateLoop();
        
        // Update demo data more frequently
        this.demoUpdateInterval = setInterval(() => {
            if (this.state.demoMode) {
                this.updateData();
            }
        }, 3000);
        
        console.log('Demo update loop started');
    }
    
    stopDemoUpdateLoop() {
        if (this.demoUpdateInterval) {
            clearInterval(this.demoUpdateInterval);
            this.demoUpdateInterval = null;
        }
    }
    
    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    }
}

// Generate QR code for PWA
function generateQRCode() {
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;
    
    const currentUrl = window.location.href;
    // Используем сервис для генерации QR кода
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;
    
    qrContainer.innerHTML = `
        <img src="${qrUrl}" 
             alt="QR Code для установки PWA" 
             style="width: 100%; height: 100%; border-radius: var(--radius-md);"
             onerror="this.onerror=null; this.src='https://via.placeholder.com/200?text=QR+Code';">
    `;
}

// Show widgets guide link in footer (only when connected)
function showWidgetsLink() {
    const widgetsLink = document.getElementById('widgetsGuideBtn');
    if (widgetsLink) {
        widgetsLink.style.display = 'flex';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app');
    window.ecoGrowApp = new EcoGrowApp();
    
    // Show widgets link
    showWidgetsLink();
    
    // Listen for theme changes to update charts
    window.addEventListener('themechange', () => {
        if (window.ecoGrowApp && window.ecoGrowApp.charts) {
            window.ecoGrowApp.charts.recreateCharts();
            if (window.ecoGrowApp.state.currentData && window.ecoGrowApp.state.currentData.moisture_history) {
                window.ecoGrowApp.charts.updateMoistureChart(window.ecoGrowApp.state.currentData.moisture_history);
            }
        }
    });
});

// Service Worker registration
if ('serviceWorker' in navigator && window.location.protocol === 'https:' && 
    !window.location.hostname.includes('github.io')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
} else {
    console.log('Service Worker не регистрируется (GitHub Pages или не HTTPS)');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+T to toggle theme
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        window.ecoGrowApp?.theme?.toggle();
    }
    
    // F5 to refresh data
    if (e.key === 'F5') {
        e.preventDefault();
        window.ecoGrowApp?.updateData();
    }
    
    // Ctrl+D to toggle demo mode
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (window.ecoGrowApp?.state.demoMode) {
            window.ecoGrowApp.disableDemoMode();
        } else {
            window.ecoGrowApp.enableDemoMode();
        }
    }
    
    // Ctrl+R to manual refresh
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        window.ecoGrowApp?.updateData();
    }
});
