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
            espIp: null,
            currentData: null,
            settings: {},
            lastUpdate: null
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
        // Try mDNS first
        try {
            const response = await fetch('http://ecogrow.local/api/info', { 
                timeout: 2000 
            });
            if (response.ok) {
                this.state.espIp = 'ecogrow.local';
                await this.connectToESP();
                return;
            }
        } catch (error) {
            // Try local storage
            const savedIp = localStorage.getItem('ecogrow_ip');
            if (savedIp) {
                this.state.espIp = savedIp;
                await this.connectToESP();
                return;
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
    
    async connectToESP() {
        if (!this.state.espIp) return;
        
        try {
            // Test connection
            const info = await this.api.getInfo(this.state.espIp);
            
            // Save to localStorage
            localStorage.setItem('ecogrow_ip', this.state.espIp);
            
            // Update connection status
            this.state.connected = true;
            this.updateConnectionStatus();
            
            // Get initial data
            await this.updateData();
            
            // Close modal if open
            this.hideConnectionModal();
            
            // Show success notification
            this.notifications.show('✅ Успешно подключено к системе!', 'success');
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.state.connected = false;
            this.updateConnectionStatus();
            this.notifications.show('❌ Не удалось подключиться к системе', 'error');
            this.showConnectionModal();
        }
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
            if (this.state.connected) {
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
    }
    
    async updateData() {
        if (!this.state.connected) return;
        
        try {
            // Get current state
            const data = await this.api.getState(this.state.espIp);
            this.state.currentData = data;
            this.state.lastUpdate = new Date();
            
            // Update UI
            this.updateUI(data);
            
            // Update charts
            this.charts.updateMoistureChart(data.moisture_history);
            
            // Update notifications if needed
            this.checkNotifications(data);
            
        } catch (error) {
            console.error('Update failed:', error);
            this.state.connected = false;
            this.updateConnectionStatus();
        }
    }
    
    updateUI(data) {
        // Update moisture values
        this.updateElement('moistureValue', data.moisture);
        this.updateElement('avgMoisture', data.avg_moisture + '%');
        this.updateElement('minMoisture', data.min_moisture + '%');
        this.updateElement('maxMoisture', data.max_moisture || '--%');
        
        // Update moisture circle
        const circle = document.querySelector('.circle-progress');
        if (circle) {
            const circumference = 2 * Math.PI * 54;
            const offset = circumference - (data.moisture / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        }
        
        // Update moisture status
        const statusElement = document.getElementById('moistureStatus');
        if (statusElement) {
            let icon = 'fa-leaf';
            if (data.moisture < 30) icon = 'fa-exclamation-triangle';
            else if (data.moisture < 50) icon = 'fa-tint';
            else if (data.moisture > 80) icon = 'fa-flood';
            
            statusElement.innerHTML = `<i class="fas ${icon}"></i>`;
        }
        
        // Update pump status
        this.updateElement('pumpStatus', data.pump ? 'ВКЛ' : 'ВЫКЛ');
        document.getElementById('pumpStatus').className = 
            `status-badge ${data.pump ? 'online' : ''}`;
        
        // Update light status
        this.updateElement('lightStatus', data.light ? 'ВКЛ' : 'ВЫКЛ');
        document.getElementById('lightStatus').className = 
            `status-badge ${data.light ? 'online' : ''}`;
        
        // Update sleep status
        const sleepActive = data.sleep_enabled && this.isTimeInRange(
            new Date(), 
            data.sleep_start, 
            data.sleep_end
        );
        this.updateElement('sleepStatus', sleepActive ? 'Активен' : 'Неактивен');
        document.getElementById('sleepStatus').className = 
            `status-badge ${sleepActive ? 'online' : ''}`;
        
        // Update statistics
        this.updateElement('totalWaterings', data.total_waterings);
        this.updateElement('totalLightHours', data.total_light_hours);
        this.updateElement('energyConsumption', data.total_energy || '0');
        
        // Update current time
        this.updateElement('currentTime', data.current_time);
        this.updateElement('systemTime', data.current_time);
        
        // Update next watering timer
        this.updateNextWateringTimer(data);
        
        // Update errors list
        this.updateErrorsList(data.errors);
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
    
    updateNextWateringTimer(data) {
        const timerElement = document.getElementById('nextWateringTimer');
        if (!timerElement || !data.time_since_watering || !data.watering_delay_ms) return;
        
        const timeSinceWatering = data.time_since_watering;
        const delayMs = data.watering_delay_ms;
        const timeLeft = Math.max(0, delayMs - timeSinceWatering);
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update circle animation
        const progress = Math.min(timeSinceWatering / delayMs, 1);
        const timerCircle = document.querySelector('.timer-circle');
        if (timerCircle) {
            const circumference = 2 * Math.PI * 40;
            const offset = circumference * (1 - progress);
            timerCircle.style.strokeDashoffset = offset;
        }
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
                    await this.api.controlPump(this.state.espIp, 'on');
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
                    await this.api.controlPump(this.state.espIp, 'off');
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
                    await this.api.controlLight(this.state.espIp, 'on');
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
                    await this.api.controlLight(this.state.espIp, 'off');
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
                    await this.api.updateSettings(this.state.espIp, {
                        moisture_threshold: parseInt(e.target.value)
                    });
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
                    await this.api.clearErrors(this.state.espIp);
                    this.notifications.show('✅ Ошибки очищены', 'success');
                    await this.updateData();
                } catch (error) {
                    this.notifications.show('❌ Ошибка очистки ошибок', 'error');
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
    }
    
    startUpdateLoop() {
        // Update every 5 seconds
        setInterval(() => {
            if (this.state.connected) {
                this.updateData();
            }
        }, 5000);
        
        // Update time every minute
        setInterval(() => {
            this.updateCurrentTime();
        }, 60000);
    }
    
    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.querySelector('span').textContent = timeString;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ecoGrowApp = new EcoGrowApp();
});

// Add service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
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
});
