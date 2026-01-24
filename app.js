class EcoGrowApp {
    constructor() {
        this.init();
        this.firebaseData = {
            moisture: 0,
            pump: 0,
            light: 0,
            temperature: 0,
            humidity: 0,
            timestamp: 0
        };
        this.historyData = [];
        this.systemStats = {};
        this.connectionStatus = 'disconnected';
    }

    async init() {
        try {
            // Инициализация Firebase
            await this.initFirebase();
            
            // Инициализация компонентов
            this.initCharts();
            this.initEventListeners();
            this.initRealTimeListeners();
            
            // Загрузка данных
            await this.loadInitialData();
            
            // Запуск таймеров
            this.startTimers();
            
            // Скрыть прелоадер
            this.hidePreloader();
            
            this.showToast('Система подключена к реальным данным!', 'success');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('Ошибка инициализации системы', 'error');
        }
    }

    async initFirebase() {
        // Проверка подключения к Firebase
        const connectedRef = window.firebaseRef(this.db, '.info/connected');
        window.firebaseOnValue(connectedRef, (snapshot) => {
            this.connectionStatus = snapshot.val() ? 'connected' : 'disconnected';
            this.updateConnectionStatus();
        });
    }

    async loadInitialData() {
        try {
            // Загрузка текущих данных
            const dataRef = window.firebaseRef(this.db, 'data/current');
            const snapshot = await window.firebaseGet(dataRef);
            
            if (snapshot.exists()) {
                this.firebaseData = snapshot.val();
                this.updateUIFromFirebase();
            }
            
            // Загрузка статистики
            const statsRef = window.firebaseRef(this.db, 'stats');
            const statsSnap = await window.firebaseGet(statsRef);
            if (statsSnap.exists()) {
                this.systemStats = statsSnap.val();
                this.updateStatsUI();
            }
            
            // Загрузка истории ошибок
            await this.loadErrorHistory();
            
            // Загрузка истории влажности
            await this.loadMoistureHistory();
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    initRealTimeListeners() {
        // Слушатель реального времени для основных данных
        const dataRef = window.firebaseRef(this.db, 'data/current');
        window.firebaseOnValue(dataRef, (snapshot) => {
            if (snapshot.exists()) {
                this.firebaseData = snapshot.val();
                this.updateUIFromFirebase();
                
                // Добавить точку в график
                this.addDataToChart(this.firebaseData);
            }
        });
        
        // Слушатель для статистики
        const statsRef = window.firebaseRef(this.db, 'stats');
        window.firebaseOnValue(statsRef, (snapshot) => {
            if (snapshot.exists()) {
                this.systemStats = snapshot.val();
                this.updateStatsUI();
            }
        });
        
        // Слушатель для системной информации
        const systemRef = window.firebaseRef(this.db, 'system/info');
        window.firebaseOnValue(systemRef, (snapshot) => {
            if (snapshot.exists()) {
                this.systemInfo = snapshot.val();
                this.updateSystemInfo();
            }
        });
        
        // Слушатель для истории ошибок
        const errorsRef = window.firebaseRef(this.db, 'history/errors');
        window.firebaseOnValue(errorsRef, (snapshot) => {
            if (snapshot.exists()) {
                this.updateErrorHistory(snapshot.val());
            }
        });
    }

    updateUIFromFirebase() {
        // Обновление основных показателей
        document.getElementById('moistureValue').textContent = `${this.firebaseData.moisture}%`;
        document.getElementById('temperatureValue').textContent = `${this.firebaseData.temperature}°C`;
        document.getElementById('pumpStatus').textContent = this.firebaseData.pump ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('lightStatus').textContent = this.firebaseData.light ? 'ВКЛ' : 'ВЫКЛ';
        
        // Обновление времени последнего обновления
        const lastUpdate = new Date(this.firebaseData.timestamp * 1000);
        document.getElementById('lastUpdate').textContent = 
            `Обновлено: ${lastUpdate.toLocaleTimeString()}`;
        
        // Обновление тренда влажности
        this.updateMoistureTrend();
        
        // Обновление статусов
        this.updateStatusIndicators();
    }

    updateStatsUI() {
        if (this.systemStats) {
            document.getElementById('wateringsToday').textContent = this.systemStats.wateringsToday || 0;
            document.getElementById('lightHours').textContent = this.systemStats.lightHours || 0;
            document.getElementById('waterSaved').textContent = `${this.systemStats.waterSaved || 0}л`;
            document.getElementById('daysRunning').textContent = this.systemStats.daysRunning || 1;
            
            // Обновление прогресс-баров
            this.updateProgressBars();
        }
    }

    async loadMoistureHistory() {
        try {
            const historyRef = window.firebaseRef(this.db, 'history/moisture');
            const snapshot = await window.firebaseGet(historyRef);
            
            if (snapshot.exists()) {
                const history = [];
                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val();
                    history.push({
                        timestamp: data.timestamp,
                        moisture: data.moisture
                    });
                });
                
                // Сортировка по времени
                history.sort((a, b) => a.timestamp - b.timestamp);
                
                // Обновление графика
                this.updateChartWithHistory(history);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    updateChartWithHistory(history) {
        const labels = [];
        const data = [];
        
        // Берем последние 24 точки
        const recentHistory = history.slice(-24);
        
        recentHistory.forEach(point => {
            const date = new Date(point.timestamp * 1000);
            labels.push(date.getHours() + ':' + date.getMinutes().toString().padStart(2, '0'));
            data.push(point.moisture);
        });
        
        if (this.moistureChart) {
            this.moistureChart.data.labels = labels;
            this.moistureChart.data.datasets[0].data = data;
            this.moistureChart.update();
            
            // Обновление статистики графика
            this.updateChartStats(data);
        }
    }

    addDataToChart(data) {
        if (!this.moistureChart) return;
        
        const chart = this.moistureChart;
        const now = new Date(data.timestamp * 1000);
        const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
        
        // Добавить новую точку
        chart.data.labels.push(timeLabel);
        chart.data.datasets[0].data.push(data.moisture);
        
        // Удалить старые точки, если больше 24
        if (chart.data.labels.length > 24) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        chart.update('none');
        
        // Обновить статистику
        this.updateChartStats(chart.data.datasets[0].data);
    }

    async sendCommand(type, value) {
        try {
            const commandRef = window.firebaseRef(this.db, 'commands');
            const command = {
                type: type,
                value: value,
                timestamp: Date.now(),
                status: 'pending'
            };
            
            await window.firebaseSet(commandRef, command);
            
            this.showToast(`Команда отправлена: ${type} = ${value}`, 'success');
            
            // Ожидание подтверждения
            await this.waitForAck();
            
        } catch (error) {
            console.error('Error sending command:', error);
            this.showToast('Ошибка отправки команды', 'error');
        }
    }

    async waitForAck() {
        return new Promise((resolve) => {
            const ackRef = window.firebaseRef(this.db, 'system/lastAck');
            const unsubscribe = window.firebaseOnValue(ackRef, (snapshot) => {
                if (snapshot.exists()) {
                    const ack = snapshot.val();
                    console.log('Command acknowledged:', ack);
                    unsubscribe();
                    resolve();
                }
            }, { onlyOnce: true });
            
            // Таймаут 5 секунд
            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 5000);
        });
    }

    updateMoistureTrend() {
        if (!this.moistureChart) return;
        
        const data = this.moistureChart.data.datasets[0].data;
        if (data.length < 2) return;
        
        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        const trend = last > prev ? '↗ Рост' : last < prev ? '↘ Спад' : '→ Стабильно';
        
        document.getElementById('moistureTrend').textContent = trend;
        
        // Цвет тренда
        const trendElement = document.getElementById('moistureTrend');
        if (last > prev) {
            trendElement.style.color = 'var(--success-color)';
        } else if (last < prev) {
            trendElement.style.color = 'var(--danger-color)';
        } else {
            trendElement.style.color = 'var(--warning-color)';
        }
    }

    updateStatusIndicators() {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-indicator span:last-child');
        
        if (this.connectionStatus === 'connected') {
            statusDot.classList.add('connected');
            statusText.textContent = 'Подключено';
            statusDot.style.background = 'var(--success-color)';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Отключено';
            statusDot.style.background = 'var(--danger-color)';
        }
        
        // Проверка свежести данных
        const now = Math.floor(Date.now() / 1000);
        const dataAge = now - this.firebaseData.timestamp;
        
        if (dataAge > 60) { // Больше 60 секунд
            this.showToast('Данные устарели. Проверьте соединение.', 'warning');
        }
    }

    startTimers() {
        // Таймер для обновления времени
        setInterval(() => {
            const now = new Date();
            document.getElementById('currentTime').textContent = 
                now.toLocaleTimeString();
        }, 1000);
        
        // Проверка соединения каждые 30 секунд
        setInterval(() => {
            this.checkConnection();
        }, 30000);
    }

    async checkConnection() {
        const timeRef = window.firebaseRef(this.db, 'system/lastUpdate');
        const snapshot = await window.firebaseGet(timeRef);
        
        if (snapshot.exists()) {
            const lastUpdate = snapshot.val();
            const now = Math.floor(Date.now() / 1000);
            
            if (now - lastUpdate > 120) { // 2 минуты без обновления
                this.connectionStatus = 'disconnected';
                this.updateStatusIndicators();
                this.showToast('Потеря связи с системой', 'warning');
            } else {
                this.connectionStatus = 'connected';
                this.updateStatusIndicators();
            }
        }
    }

    async loadErrorHistory() {
        try {
            const errorsRef = window.firebaseRef(this.db, 'history/errors');
            const snapshot = await window.firebaseGet(errorsRef);
            
            if (snapshot.exists()) {
                const errors = [];
                snapshot.forEach((childSnapshot) => {
                    const error = childSnapshot.val();
                    errors.push({
                        message: error.message,
                        timestamp: error.timestamp,
                        type: error.type
                    });
                });
                
                // Сортировка по времени (новые первыми)
                errors.sort((a, b) => b.timestamp - a.timestamp);
                
                // Отображение ошибок
                this.displayErrors(errors.slice(0, 10)); // Показать 10 последних
            }
        } catch (error) {
            console.error('Error loading errors:', error);
        }
    }

    displayErrors(errors) {
        const errorsList = document.getElementById('errorsList');
        const noErrors = document.getElementById('noErrors');
        
        if (errors.length === 0) {
            errorsList.style.display = 'none';
            noErrors.style.display = 'block';
            return;
        }
        
        errorsList.style.display = 'block';
        noErrors.style.display = 'none';
        errorsList.innerHTML = '';
        
        errors.forEach(error => {
            const date = new Date(error.timestamp * 1000);
            const timeString = date.toLocaleString();
            
            const errorItem = document.createElement('div');
            errorItem.className = 'error-item';
            errorItem.innerHTML = `
                <div class="error-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <span class="error-type">${error.type}</span>
                </div>
                <div class="error-message">${error.message}</div>
                <div class="error-time">${timeString}</div>
            `;
            
            errorsList.appendChild(errorItem);
        });
    }

    // Обновленные обработчики команд
    async togglePump() {
        const newState = !this.firebaseData.pump;
        await this.sendCommand('pump', newState ? 'ON' : 'OFF');
    }

    async toggleLight() {
        const newState = !this.firebaseData.light;
        await this.sendCommand('light', newState ? 'ON' : 'OFF');
    }

    async updateSetting(setting, value) {
        await this.sendCommand(setting, value.toString());
    }

    hidePreloader() {
        setTimeout(() => {
            document.querySelector('.preloader').style.opacity = '0';
            setTimeout(() => {
                document.querySelector('.preloader').style.display = 'none';
            }, 500);
        }, 1000);
    }

    showToast(message, type = 'success') {
        // Существующий код toast
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
        
        // Удалить toast через 5 секунд
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.5s ease forwards';
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 5000);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.ecoGrowApp = new EcoGrowApp();
    
    // Настройка Firebase
    const app = window.firebaseApp;
    const database = window.firebaseDatabase;
    
    // Сделать Firebase доступным глобально
    window.db = database;
    window.firebaseApp = app;
});
