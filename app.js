// EcoGrow Assistant Web Application
// Created by Kupchenya Evgeniy Andreevich

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
        
        this.historyData = [];
        this.errorHistory = [];
        this.connectionStatus = 'disconnected';
        this.lastUpdateTime = 0;
        
        // Firebase references
        this.db = null;
        this.dataRef = null;
        this.statsRef = null;
        this.systemRef = null;
        this.commandsRef = null;
        
        // Chart instances
        this.moistureChart = null;
        this.miniChart = null;
        
        // Data for charts
        this.moistureHistory = [];
        this.maxHistoryPoints = 24;
        
        this.init();
    }

    async init() {
        console.log('Initializing EcoGrow Assistant...');
        
        try {
            // Initialize Firebase
            await this.initFirebase();
            
            // Initialize components
            this.initCharts();
            this.initEventListeners();
            
            // Start data listeners
            this.startDataListeners();
            
            // Start system timers
            this.startTimers();
            
            // Hide preloader
            this.hidePreloader();
            
            this.showToast('EcoGrow Assistant успешно запущен!', 'success');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('Ошибка инициализации системы: ' + error.message, 'error');
        }
    }

    initFirebase() {
        return new Promise((resolve, reject) => {
            try {
                console.log('Initializing Firebase...');
                
                // Get Firebase database instance
                this.db = window.firebaseDatabase;
                
                if (!this.db) {
                    throw new Error('Firebase database not initialized');
                }
                
                // Set up references
                this.dataRef = this.db.ref('data/current');
                this.statsRef = this.db.ref('stats');
                this.systemRef = this.db.ref('system');
                this.commandsRef = this.db.ref('commands');
                this.errorsRef = this.db.ref('history/errors');
                
                console.log('Firebase initialized successfully');
                resolve();
                
            } catch (error) {
                console.error('Firebase initialization error:', error);
                reject(error);
            }
        });
    }

    startDataListeners() {
        // Listen for real-time data updates
        if (this.dataRef) {
            this.dataRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.updateSystemData(data);
                    this.updateUI();
                    this.addToHistory(data);
                    this.updateChart(data);
                }
            }, (error) => {
                console.error('Data listener error:', error);
                this.connectionStatus = 'error';
                this.updateConnectionStatus();
            });
        }
        
        // Listen for stats updates
        if (this.statsRef) {
            this.statsRef.on('value', (snapshot) => {
                const stats = snapshot.val();
                if (stats) {
                    this.updateStats(stats);
                }
            });
        }
        
        // Listen for system info
        if (this.systemRef) {
            this.systemRef.child('info').on('value', (snapshot) => {
                const info = snapshot.val();
                if (info) {
                    this.updateSystemInfo(info);
                }
            });
            
            // Listen for Arduino connection status
            this.systemRef.child('info/arduinoConnected').on('value', (snapshot) => {
                const status = snapshot.val();
                this.updateArduinoStatus(status);
            });
        }
        
        // Listen for errors
        if (this.errorsRef) {
            this.errorsRef.limitToLast(10).on('value', (snapshot) => {
                const errors = [];
                snapshot.forEach((childSnapshot) => {
                    errors.push(childSnapshot.val());
                });
                this.updateErrorHistory(errors.reverse());
            });
        }
    }

    initCharts() {
        // Initialize main moisture chart
        const ctx = document.getElementById('moistureChart').getContext('2d');
        
        // Generate initial labels (last 24 hours)
        const labels = [];
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(time.getHours().toString().padStart(2, '0') + ':00');
        }
        
        this.moistureChart = new Chart(ctx, {
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
        
        // Initialize mini chart
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

    initEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            this.showToast(`Тема изменена`, 'success');
        });

        // Sleep mode
        document.getElementById('sleepModeBtn').addEventListener('click', () => {
            this.showSleepModeModal();
        });

        // Manual controls
        document.getElementById('manualPumpBtn').addEventListener('click', () => {
            this.togglePump();
        });

        document.getElementById('manualLightBtn').addEventListener('click', () => {
            this.toggleLight();
        });

        // Settings controls
        document.getElementById('moistureThreshold').addEventListener('input', (e) => {
            document.getElementById('thresholdValue').textContent = `${e.target.value}%`;
        });

        document.getElementById('moistureThreshold').addEventListener('change', (e) => {
            this.updateSetting('threshold', e.target.value);
        });

        document.getElementById('pumpDuration').addEventListener('change', (e) => {
            this.updateSetting('pumpTime', e.target.value);
        });

        document.getElementById('autoWateringToggle').addEventListener('change', (e) => {
            this.updateSetting('autoWatering', e.target.checked);
        });

        // Time range buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.changeTimeRange(e.target.dataset.range);
            });
        });

        // Time sync
        document.getElementById('syncTimeBtn').addEventListener('click', () => {
            this.syncTime();
        });

        // Clear errors
        document.getElementById('clearErrorsBtn').addEventListener('click', () => {
            this.clearErrors();
        });

        // Test notification
        document.getElementById('testNotificationBtn').addEventListener('click', () => {
            this.sendTestNotification();
        });

        // Apply light schedule
        document.getElementById('applyScheduleBtn').addEventListener('click', () => {
            this.applyLightSchedule();
        });

        // Modal controls
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

        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    startTimers() {
        // Update clock every second
        setInterval(() => {
            const now = new Date();
            document.getElementById('currentTime').textContent = 
                now.toLocaleTimeString('ru-RU');
                
            // Update uptime if available
            if (this.systemData.timestamp) {
                const uptime = Math.floor((Date.now() - this.systemData.timestamp * 1000) / 1000);
                if (uptime > 0) {
                    const days = Math.floor(uptime / 86400);
                    const hours = Math.floor((uptime % 86400) / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    document.getElementById('uptime').textContent = 
                        `${days}д ${hours}ч ${minutes}м`;
                }
            }
        }, 1000);

        // Check connection every 30 seconds
        setInterval(() => {
            this.checkConnection();
        }, 30000);
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
        
        this.lastUpdateTime = Date.now();
        this.connectionStatus = 'connected';
        this.updateConnectionStatus();
    }

    updateUI() {
        // Update main values
        document.getElementById('moistureValue').textContent = `${this.systemData.moisture}%`;
        document.getElementById('temperatureValue').textContent = `${this.systemData.temperature}°C`;
        document.getElementById('pumpStatus').textContent = this.systemData.pump ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('lightStatus').textContent = this.systemData.light ? 'ВКЛ' : 'ВЫКЛ';
        
        // Update manual control buttons
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
        
        // Update last update time
        if (this.systemData.timestamp) {
            const updateTime = new Date(this.systemData.timestamp * 1000);
            document.getElementById('lastUpdate').textContent = 
                `Обновлено: ${updateTime.toLocaleTimeString('ru-RU')}`;
            document.getElementById('lastSystemUpdate').textContent = 
                updateTime.toLocaleString('ru-RU');
        }
        
        // Update moisture trend
        this.updateMoistureTrend();
    }

    updateStats(stats) {
        if (stats) {
            document.getElementById('wateringsToday').textContent = stats.wateringsToday || 0;
            document.getElementById('waterSaved').textContent = `${(stats.totalWaterUsed || 0).toFixed(1)}л`;
            
            // Calculate light hours (simplified)
            if (stats.totalPowerUsed) {
                const lightHours = (stats.totalPowerUsed / 0.2).toFixed(1);
                document.getElementById('lightHours').textContent = lightHours;
            }
            
            // Update progress bars
            const efficiency = Math.min(100, (stats.wateringsToday || 0) * 15);
            document.getElementById('efficiencyValue').textContent = `${efficiency}%`;
            document.querySelector('#efficiencyValue').parentElement.nextElementSibling
                .querySelector('.progress-fill').style.width = `${efficiency}%`;
        }
    }

    updateSystemInfo(info) {
        if (info) {
            document.getElementById('wifiStatus').textContent = 
                info.wifiRssi < -70 ? 'Слабый сигнал' : 'Подключен';
            
            document.getElementById('ramUsage').textContent = 
                `${Math.round((ESP?.getFreeHeap ? 1 - info.freeHeap / 80000 : 0.5) * 100)}%`;
            
            document.getElementById('sensorStatus').textContent = 
                this.systemData.moisture > 0 ? 'Работает' : 'Ошибка';
        }
    }

    updateArduinoStatus(status) {
        const statusElement = document.getElementById('arduinoStatus');
        const statusItem = document.querySelector('.status-item:nth-child(1)');
        
        if (status === 1) {
            statusElement.textContent = 'Онлайн';
            statusElement.parentElement.className = 'status-item online';
            statusElement.parentElement.querySelector('.status-badge').textContent = 'Онлайн';
        } else {
            statusElement.textContent = 'Офлайн';
            statusElement.parentElement.className = 'status-item error';
            statusElement.parentElement.querySelector('.status-badge').textContent = 'Офлайн';
        }
    }

    updateConnectionStatus() {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-indicator span:last-child');
        
        switch (this.connectionStatus) {
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
            case 'error':
                statusDot.className = 'status-dot';
                statusText.textContent = 'Ошибка';
                statusDot.style.backgroundColor = '#f59e0b';
                break;
        }
    }

    addToHistory(data) {
        // Add to history array
        this.moistureHistory.push({
            timestamp: data.timestamp,
            moisture: data.moisture
        });
        
        // Keep only last N points
        if (this.moistureHistory.length > this.maxHistoryPoints) {
            this.moistureHistory.shift();
        }
        
        // Update chart stats
        if (this.moistureHistory.length > 0) {
            const values = this.moistureHistory.map(h => h.moisture);
            const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const trend = values[values.length - 1] > values[0] ? '↗ Рост' : '↘ Спад';
            
            document.getElementById('avgMoisture').textContent = `${avg}%`;
            document.getElementById('minMoisture').textContent = `${min}%`;
            document.getElementById('maxMoisture').textContent = `${max}%`;
            document.getElementById('moistureTrendValue').textContent = trend;
        }
    }

    updateChart(data) {
        if (!this.moistureChart || !data) return;
        
        const chart = this.moistureChart;
        
        // Add new data point
        const now = new Date(data.timestamp * 1000);
        const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
        
        // Add label if we have space
        if (chart.data.labels.length < this.maxHistoryPoints) {
            chart.data.labels.push(timeLabel);
        } else {
            chart.data.labels.shift();
            chart.data.labels.push(timeLabel);
        }
        
        // Add data point
        if (chart.data.datasets[0].data.length < this.maxHistoryPoints) {
            chart.data.datasets[0].data.push(data.moisture);
        } else {
            chart.data.datasets[0].data.shift();
            chart.data.datasets[0].data.push(data.moisture);
        }
        
        chart.update('none');
        
        // Update mini chart
        if (this.miniChart) {
            const miniData = chart.data.datasets[0].data.slice(-5);
            this.miniChart.data.datasets[0].data = miniData;
            this.miniChart.update('none');
        }
    }

    updateMoistureTrend() {
        if (!this.moistureChart || this.moistureChart.data.datasets[0].data.length < 2) return;
        
        const data = this.moistureChart.data.datasets[0].data;
        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        
        let trend, color;
        if (last > prev) {
            trend = '↗ Рост';
            color = '#10b981';
        } else if (last < prev) {
            trend = '↘ Спад';
            color = '#ef4444';
        } else {
            trend = '→ Стабильно';
            color = '#f59e0b';
        }
        
        document.getElementById('moistureTrend').textContent = trend;
        document.getElementById('moistureTrend').style.color = color;
    }

    updateErrorHistory(errors) {
        const errorsList = document.getElementById('errorsList');
        const noErrors = document.getElementById('noErrors');
        
        if (!errors || errors.length === 0) {
            errorsList.style.display = 'none';
            noErrors.style.display = 'block';
            return;
        }
        
        errorsList.style.display = 'block';
        noErrors.style.display = 'none';
        errorsList.innerHTML = '';
        
        errors.forEach((error, index) => {
            if (index >= 10) return; // Show only last 10 errors
            
            const errorItem = document.createElement('div');
            errorItem.className = 'error-item';
            
            const date = new Date(error.timestamp * 1000);
            const timeString = date.toLocaleString('ru-RU');
            
            errorItem.innerHTML = `
                <div class="error-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <span class="error-type">${error.type || 'system'}</span>
                </div>
                <div class="error-message">${error.message}</div>
                <div class="error-time">${timeString}</div>
            `;
            
            errorsList.appendChild(errorItem);
        });
    }

    async togglePump() {
        try {
            const newState = !this.systemData.pump;
            const command = newState ? 'ON' : 'OFF';
            
            await this.sendCommand('pump', command);
            this.showToast(`Насос ${newState ? 'включен' : 'выключен'}`, 'success');
            
        } catch (error) {
            console.error('Toggle pump error:', error);
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
            console.error('Toggle light error:', error);
            this.showToast('Ошибка отправки команды', 'error');
        }
    }

    async sendCommand(type, value) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.commandsRef) {
                    throw new Error('Firebase not initialized');
                }
                
                // Create command object
                const command = {
                    [type]: value,
                    timestamp: Date.now(),
                    source: 'web'
                };
                
                // Send command to Firebase
                this.commandsRef.update(command)
                    .then(() => {
                        console.log(`Command sent: ${type}=${value}`);
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
            console.error('Update setting error:', error);
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
            console.error('Sync time error:', error);
            this.showToast('Ошибка синхронизации времени', 'error');
        }
    }

    clearErrors() {
        // In a real app, this would clear errors from Firebase
        // For now, just clear the UI
        document.getElementById('errorsList').innerHTML = '';
        document.getElementById('errorsList').style.display = 'none';
        document.getElementById('noErrors').style.display = 'block';
        
        this.showToast('История ошибок очищена', 'success');
    }

    sendTestNotification() {
        this.showToast('Тестовое уведомление отправлено', 'success');
        // In a real app, this would trigger a Telegram notification
    }

    applyLightSchedule() {
        const startTime = document.getElementById('lightStartTime').value;
        const duration = document.getElementById('lightDuration').value;
        
        // Convert to format "HH:MM-HH:MM"
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = (startHour + parseInt(duration)) % 24;
        const schedule = `${startTime}-${endHour.toString().padStart(2, '0')}:00`;
        
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
            console.error('Sleep mode error:', error);
            this.showToast('Ошибка активации режима сна', 'error');
        }
    }

    changeTimeRange(range) {
        // In a real app, this would load different data ranges
        console.log('Changing time range to:', range);
        
        // Simulate loading new data
        this.showToast(`Загружаются данные за ${range}`, 'info');
    }

    checkConnection() {
        if (this.lastUpdateTime && Date.now() - this.lastUpdateTime > 60000) {
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus();
            this.showToast('Нет данных от системы более 1 минуты', 'warning');
        }
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
        
        // Set icon based on type
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        if (type === 'error') icon = 'fas fa-exclamation-circle';
        if (type === 'warning') icon = 'fas fa-exclamation-triangle';
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Remove toast after 5 seconds
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new EcoGrowApp();
});
