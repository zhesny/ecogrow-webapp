// EcoGrow Assistant Web Application
// Created by Kupchenya Evgeniy Andreevich

class EcoGrowApp {
    constructor() {
        this.init();
    }

    async init() {
        // Initialize Firebase
        this.db = window.firebaseDatabase;
        this.ref = window.firebaseRef;
        this.onValue = window.firebaseOnValue;
        this.set = window.firebaseSet;
        this.update = window.firebaseUpdate;
        this.push = window.firebasePush;

        // Initialize components
        await this.initComponents();
        this.initEventListeners();
        this.startDataPolling();
        this.startSystemClock();

        // Hide preloader
        setTimeout(() => {
            document.querySelector('.preloader').style.opacity = '0';
            setTimeout(() => {
                document.querySelector('.preloader').style.display = 'none';
            }, 500);
        }, 1500);

        this.showToast('Система EcoGrow Assistant успешно запущена!', 'success');
    }

    async initComponents() {
        // Initialize charts
        this.initMoistureChart();
        this.initMiniChart();

        // Load initial data
        await this.loadInitialData();

        // Update UI
        this.updateUI();
    }

    initMoistureChart() {
        const ctx = document.getElementById('moistureChart').getContext('2d');
        
        // Generate mock data for last 24 hours
        const labels = [];
        const data = [];
        const now = new Date();
        
        for (let i = 23; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(time.getHours().toString().padStart(2, '0') + ':00');
            
            // Generate realistic moisture data
            const baseMoisture = 50 + Math.sin(i * 0.5) * 10;
            const random = Math.random() * 5 - 2.5;
            data.push(Math.max(10, Math.min(90, Math.round(baseMoisture + random))));
        }

        this.moistureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Влажность почвы (%)',
                    data: data,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return `Влажность: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(148, 163, 184)'
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(148, 163, 184)',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                animations: {
                    tension: {
                        duration: 1000,
                        easing: 'linear'
                    }
                }
            }
        });

        // Update chart stats
        this.updateChartStats(data);
    }

    initMiniChart() {
        const ctx = document.getElementById('miniMoistureChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['', '', '', '', ''],
                datasets: [{
                    data: [65, 60, 55, 50, 45],
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                }
            }
        });
    }

    async loadInitialData() {
        try {
            // Simulate loading data from Firebase
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Mock data
            this.systemData = {
                moisture: 65,
                temperature: 24.5,
                pumpStatus: false,
                lightStatus: true,
                autoWatering: true,
                threshold: 50,
                pumpDuration: 10,
                checkInterval: 10,
                nextWatering: '2:30',
                lightTimer: '4:12',
                wateringsToday: 3,
                lightHours: 8.5,
                waterSaved: 12,
                daysRunning: 15,
                errors: [
                    { type: 'sensor', message: 'Калибровка датчика влажности', time: '10:30' },
                    { type: 'pump', message: 'Задержка запуска насоса', time: '09:15' }
                ]
            };

            this.connectionStatus = 'connected';
            this.lastUpdate = new Date();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showToast('Ошибка загрузки данных системы', 'error');
        }
    }

    updateUI() {
        // Update main stats
        document.getElementById('moistureValue').textContent = `${this.systemData.moisture}%`;
        document.getElementById('temperatureValue').textContent = `${this.systemData.temperature}°C`;
        document.getElementById('pumpStatus').textContent = this.systemData.pumpStatus ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('lightStatus').textContent = this.systemData.lightStatus ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('nextWatering').textContent = this.systemData.nextWatering;
        document.getElementById('lightTimer').textContent = this.systemData.lightTimer;
        
        // Update statistics
        document.getElementById('wateringsToday').textContent = this.systemData.wateringsToday;
        document.getElementById('lightHours').textContent = this.systemData.lightHours;
        document.getElementById('waterSaved').textContent = `${this.systemData.waterSaved}л`;
        document.getElementById('daysRunning').textContent = this.systemData.daysRunning;
        
        // Update controls
        document.getElementById('moistureThreshold').value = this.systemData.threshold;
        document.getElementById('thresholdValue').textContent = `${this.systemData.threshold}%`;
        document.getElementById('pumpDuration').value = this.systemData.pumpDuration;
        document.getElementById('checkInterval').value = this.systemData.checkInterval;
        document.getElementById('autoWateringToggle').checked = this.systemData.autoWatering;
        
        // Update manual controls
        const pumpBtn = document.getElementById('manualPumpBtn');
        const lightBtn = document.getElementById('manualLightBtn');
        
        if (this.systemData.pumpStatus) {
            pumpBtn.innerHTML = '<i class="fas fa-water"></i><span>Выключить насос</span>';
            pumpBtn.classList.add('active');
        } else {
            pumpBtn.innerHTML = '<i class="fas fa-water"></i><span>Включить насос</span>';
            pumpBtn.classList.remove('active');
        }
        
        if (this.systemData.lightStatus) {
            lightBtn.innerHTML = '<i class="fas fa-lightbulb"></i><span>Выключить свет</span>';
            lightBtn.classList.add('active');
        } else {
            lightBtn.innerHTML = '<i class="fas fa-lightbulb"></i><span>Включить свет</span>';
            lightBtn.classList.remove('active');
        }
        
        // Update connection status
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-indicator span:last-child');
        
        if (this.connectionStatus === 'connected') {
            statusDot.classList.add('connected');
            statusText.textContent = 'Подключено';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Подключение...';
        }
        
        // Update last update time
        document.getElementById('lastUpdate').textContent = 
            `Обновлено: ${this.lastUpdate.toLocaleTimeString()}`;
        
        // Update errors list
        this.updateErrorsList();
        
        // Update chart stats
        const currentData = this.moistureChart.data.datasets[0].data;
        this.updateChartStats(currentData);
    }

    updateChartStats(data) {
        const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
        const min = Math.min(...data);
        const max = Math.max(...data);
        const trend = data[data.length - 1] > data[0] ? '↗ Рост' : '↘ Спад';
        
        document.getElementById('avgMoisture').textContent = `${avg}%`;
        document.getElementById('minMoisture').textContent = `${min}%`;
        document.getElementById('maxMoisture').textContent = `${max}%`;
        document.getElementById('moistureTrendValue').textContent = trend;
        
        // Update trend color
        const trendElement = document.getElementById('moistureTrendValue');
        trendElement.className = 'value ' + (data[data.length - 1] > data[0] ? 'trend-up' : 'trend-down');
    }

    updateErrorsList() {
        const errorsList = document.getElementById('errorsList');
        const noErrors = document.getElementById('noErrors');
        
        if (this.systemData.errors.length === 0) {
            errorsList.style.display = 'none';
            noErrors.style.display = 'block';
        } else {
            errorsList.style.display = 'block';
            noErrors.style.display = 'none';
            
            errorsList.innerHTML = '';
            this.systemData.errors.forEach(error => {
                const errorItem = document.createElement('div');
                errorItem.className = 'error-item';
                errorItem.innerHTML = `
                    <div class="error-message">${error.message}</div>
                    <div class="error-time">${error.time}</div>
                `;
                errorsList.appendChild(errorItem);
            });
        }
    }

    initEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            this.showToast(`Тема переключена на ${e.target.checked ? 'темную' : 'светлую'}`, 'success');
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

        // Sliders and inputs
        document.getElementById('moistureThreshold').addEventListener('input', (e) => {
            document.getElementById('thresholdValue').textContent = `${e.target.value}%`;
        });

        document.getElementById('moistureThreshold').addEventListener('change', (e) => {
            this.updateSetting('threshold', parseInt(e.target.value));
        });

        document.getElementById('pumpDuration').addEventListener('change', (e) => {
            this.updateSetting('pumpDuration', parseInt(e.target.value));
        });

        document.getElementById('checkInterval').addEventListener('change', (e) => {
            this.updateSetting('checkInterval', parseInt(e.target.value));
        });

        // Auto watering toggle
        document.getElementById('autoWateringToggle').addEventListener('change', (e) => {
            this.updateSetting('autoWatering', e.target.checked);
        });

        // Time range buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                // In real app, this would update the chart data
            });
        });

        // Time sync
        document.getElementById('syncTimeBtn').addEventListener('click', () => {
            this.syncSystemTime();
        });

        // Clear errors
        document.getElementById('clearErrorsBtn').addEventListener('click', () => {
            this.clearErrors();
        });

        // Test notification
        document.getElementById('testNotificationBtn').addEventListener('click', () => {
            this.sendTestNotification();
        });

        // Apply schedule
        document.getElementById('applyScheduleBtn').addEventListener('click', () => {
            this.applyLightSchedule();
        });

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.classList.remove('active');
                });
            });
        });

        // Confirm sleep mode
        document.getElementById('confirmSleepBtn').addEventListener('click', () => {
            this.activateSleepMode();
        });

        // Update values on input changes
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const valueSpan = e.target.parentElement.querySelector('.slider-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value + (e.target.id === 'moistureThreshold' ? '%' : '');
                }
            });
        });
    }

    togglePump() {
        this.systemData.pumpStatus = !this.systemData.pumpStatus;
        this.updateUI();
        
        const action = this.systemData.pumpStatus ? 'включен' : 'выключен';
        this.showToast(`Насос ${action} вручную`, 'success');
        
        // In real app, send command to Arduino
        this.sendCommand('pump', this.systemData.pumpStatus ? 'ON' : 'OFF');
    }

    toggleLight() {
        this.systemData.lightStatus = !this.systemData.lightStatus;
        this.updateUI();
        
        const action = this.systemData.lightStatus ? 'включен' : 'выключен';
        this.showToast(`Свет ${action} вручную`, 'success');
        
        // In real app, send command to Arduino
        this.sendCommand('light', this.systemData.lightStatus ? 'ON' : 'OFF');
    }

    updateSetting(setting, value) {
        this.systemData[setting] = value;
        this.showToast(`Настройка "${setting}" обновлена`, 'success');
        
        // In real app, update Firebase
        console.log(`Setting updated: ${setting} = ${value}`);
    }

    syncSystemTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        document.getElementById('currentTime').textContent = timeString;
        
        this.showToast('Время синхронизировано', 'success');
        
        // In real app, send time to Arduino
        this.sendCommand('time', now);
    }

    clearErrors() {
        this.systemData.errors = [];
        this.updateErrorsList();
        this.showToast('История ошибок очищена', 'success');
    }

    sendTestNotification() {
        this.showToast('Тестовое уведомление отправлено в Telegram', 'success');
        
        // In real app, send notification via Firebase Cloud Functions
        console.log('Sending test notification...');
    }

    applyLightSchedule() {
        const startTime = document.getElementById('lightStartTime').value;
        const duration = document.getElementById('lightDuration').value;
        
        this.showToast(`Расписание света обновлено: ${startTime} на ${duration} часов`, 'success');
        
        // In real app, update schedule in Firebase
        console.log(`Light schedule: ${startTime} for ${duration} hours`);
    }

    showSleepModeModal() {
        document.getElementById('sleepModeModal').classList.add('active');
    }

    activateSleepMode() {
        const duration = document.getElementById('sleepDuration').value;
        document.getElementById('sleepModeModal').classList.remove('active');
        
        this.showToast(`Режим сна активирован на ${duration} часов`, 'warning');
        
        // In real app, send sleep command to Arduino
        this.sendCommand('sleep', duration);
    }

    sendCommand(type, value) {
        // In real app, this would send command to Firebase
        // which would be picked up by ESP8266 and sent to Arduino
        console.log(`Sending command: ${type} = ${value}`);
        
        // Simulate sending to Firebase
        if (window.firebaseUpdate) {
            const commandRef = window.firebaseRef(window.firebaseDatabase, `commands/${type}`);
            window.firebaseUpdate(commandRef, {
                value: value,
                timestamp: new Date().toISOString()
            }).then(() => {
                console.log('Command sent to Firebase');
            }).catch(error => {
                console.error('Error sending command:', error);
            });
        }
    }

    startDataPolling() {
        // Simulate real-time data updates
        setInterval(() => {
            // Simulate moisture change
            const change = Math.random() * 2 - 1; // -1 to +1
            this.systemData.moisture = Math.max(10, Math.min(90, 
                Math.round((this.systemData.moisture + change) * 10) / 10
            ));
            
            // Simulate temperature fluctuation
            const tempChange = Math.random() * 0.2 - 0.1;
            this.systemData.temperature = Math.round((this.systemData.temperature + tempChange) * 10) / 10;
            
            // Update chart with new data point
            if (this.moistureChart) {
                const chart = this.moistureChart;
                const now = new Date();
                const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                                now.getMinutes().toString().padStart(2, '0');
                
                // Add new data point
                chart.data.labels.push(timeLabel);
                chart.data.datasets[0].data.push(this.systemData.moisture);
                
                // Remove first data point if too many
                if (chart.data.labels.length > 24) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }
                
                chart.update('none');
                
                // Update stats
                this.updateChartStats(chart.data.datasets[0].data);
            }
            
            // Update UI
            this.updateUI();
            
            // Simulate occasional errors
            if (Math.random() < 0.01) { // 1% chance
                const errorTypes = [
                    { type: 'sensor', message: 'Временная ошибка датчика влажности' },
                    { type: 'network', message: 'Потеря связи с модулем WiFi' },
                    { type: 'pump', message: 'Превышено время работы насоса' }
                ];
                const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
                const now = new Date();
                const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                                 now.getMinutes().toString().padStart(2, '0');
                
                this.systemData.errors.push({
                    ...error,
                    time: timeString
                });
                
                this.updateErrorsList();
                
                if (error.type === 'sensor' || error.type === 'pump') {
                    this.showToast(`Обнаружена ошибка: ${error.message}`, 'error');
                }
            }
            
        }, 5000); // Update every 5 seconds
    }

    startSystemClock() {
        setInterval(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            document.getElementById('currentTime').textContent = timeString;
            
            // Update last update time periodically
            if (now.getSeconds() % 30 === 0) {
                this.lastUpdate = now;
                document.getElementById('lastUpdate').textContent = 
                    `Обновлено: ${now.toLocaleTimeString()}`;
            }
            
            // Update uptime
            document.getElementById('uptime').textContent = 
                `${Math.floor(now.getHours() / 24)}д ${now.getHours() % 24}ч ${now.getMinutes()}м`;
            
        }, 1000);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fas fa-check-circle';
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
                toast.remove();
            }, 500);
        }, 5000);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ecoGrowApp = new EcoGrowApp();
});

// Firebase Data Listener Example (for real implementation)
function setupFirebaseListeners() {
    // This would be the real implementation for Firebase data sync
    
    const dataRef = window.firebaseRef(window.firebaseDatabase, 'data');
    
    window.firebaseOnValue(dataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Update local state with Firebase data
            window.ecoGrowApp.systemData = {
                ...window.ecoGrowApp.systemData,
                moisture: data.moisture,
                temperature: data.temperature || 24.5,
                pumpStatus: data.pump === 1,
                lightStatus: data.light === 1
            };
            
            window.ecoGrowApp.updateUI();
        }
    }, (error) => {
        console.error('Firebase error:', error);
        window.ecoGrowApp.showToast('Ошибка подключения к серверу', 'error');
    });
}

// Uncomment this when Firebase is properly configured
// setupFirebaseListeners();
