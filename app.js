class EcoGrowWebApp {
    constructor() {
        this.state = {
            moisture: 0,
            pump: false,
            light: false,
            manual_pump: false,
            manual_light: false,
            errors: [],
            moisture_history: []
        };
        
        this.settings = {
            moisture_threshold: 50,
            watering_delay: 30,
            watering_duration: 10
        };
        
        this.connection = {
            type: localStorage.getItem('connection_type') || 'local',
            url: localStorage.getItem('api_url') || '',
            connected: false,
            ws: null
        };
        
        this.chart = null;
        this.init();
    }
    
    async init() {
        this.initChart();
        this.setupEventListeners();
        this.showConnectionModal();
        this.startConnectionCheck();
        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
    }
    
    showConnectionModal() {
        const savedType = localStorage.getItem('connection_type');
        if (!savedType) {
            const modal = new bootstrap.Modal(document.getElementById('connectionModal'));
            modal.show();
        } else {
            this.connect();
        }
    }
    
    setupEventListeners() {
        // Кнопки управления
        document.getElementById('pump-toggle').addEventListener('change', (e) => {
            this.sendCommand('pump', e.target.checked);
        });
        
        document.getElementById('light-toggle').addEventListener('change', (e) => {
            this.sendCommand('light', e.target.checked);
        });
        
        document.getElementById('manual-water').addEventListener('click', () => {
            this.sendCommand('manualWatering', true);
            this.showToast('💧 Запущен ручной полив', 'success');
        });
        
        document.getElementById('pump-auto').addEventListener('click', () => {
            this.sendCommand('pumpAuto', true);
            this.showToast('🔧 Насос переведен в авторежим', 'info');
        });
        
        document.getElementById('light-on-1h').addEventListener('click', () => {
            this.sendCommand('light', true);
            this.showToast('💡 Свет включен на 1 час', 'success');
        });
        
        document.getElementById('light-auto').addEventListener('click', () => {
            this.sendCommand('lightAuto', true);
            this.showToast('🔧 Свет переведен в авторежим', 'info');
        });
        
        // Настройки
        const thresholdSlider = document.getElementById('threshold-slider');
        thresholdSlider.addEventListener('input', (e) => {
            document.getElementById('threshold-display').textContent = e.target.value + '%';
        });
        
        thresholdSlider.addEventListener('change', (e) => {
            this.settings.moisture_threshold = parseInt(e.target.value);
            this.saveSettings();
        });
        
        document.getElementById('watering-delay').addEventListener('change', (e) => {
            this.settings.watering_delay = parseInt(e.target.value);
        });
        
        document.getElementById('watering-duration').addEventListener('change', (e) => {
            this.settings.watering_duration = parseInt(e.target.value);
        });
        
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
            this.showToast('✅ Настройки сохранены', 'success');
        });
        
        document.getElementById('clear-errors').addEventListener('click', () => {
            this.clearErrors();
        });
        
        // Настройка подключения
        document.getElementById('connection-type').addEventListener('change', (e) => {
            const customGroup = document.getElementById('custom-url-group');
            if (e.target.value === 'custom') {
                customGroup.classList.remove('d-none');
            } else {
                customGroup.classList.add('d-none');
            }
        });
        
        document.getElementById('save-connection').addEventListener('click', () => {
            this.saveConnection();
            const modal = bootstrap.Modal.getInstance(document.getElementById('connectionModal'));
            modal.hide();
        });
        
        // Подключение по нажатию Enter в поле URL
        document.getElementById('custom-api-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveConnection();
                const modal = bootstrap.Modal.getInstance(document.getElementById('connectionModal'));
                modal.hide();
            }
        });
    }
    
    saveConnection() {
        const type = document.getElementById('connection-type').value;
        let url = '';
        
        if (type === 'local') {
            url = 'http://ecogrow-api.local/api';
        } else if (type === 'cloud') {
            url = 'https://ваш-прокси-сервер.herokuapp.com/api';
        } else if (type === 'custom') {
            url = document.getElementById('custom-api-url').value.trim();
        }
        
        localStorage.setItem('connection_type', type);
        localStorage.setItem('api_url', url);
        
        this.connection.type = type;
        this.connection.url = url;
        
        this.connect();
    }
    
    async connect() {
        if (!this.connection.url) {
            this.connection.url = this.connection.type === 'local' 
                ? 'http://ecogrow-api.local/api'
                : 'https://ваш-прокси-сервер.herokuapp.com/api';
        }
        
        // Пробуем подключиться по HTTP
        try {
            const response = await fetch(`${this.connection.url}/info`, { 
                timeout: 5000 
            });
            
            if (response.ok) {
                this.connection.connected = true;
                this.updateConnectionStatus(true);
                this.showToast('✅ Подключено к системе', 'success');
                this.startPolling();
                this.connectWebSocket();
            } else {
                throw new Error('API не отвечает');
            }
        } catch (error) {
            this.connection.connected = false;
            this.updateConnectionStatus(false);
            this.showToast('❌ Не удалось подключиться', 'error');
            
            // Пробуем снова через 5 секунд
            setTimeout(() => this.connect(), 5000);
        }
    }
    
    connectWebSocket() {
        if (this.connection.ws) {
            this.connection.ws.close();
        }
        
        let wsUrl;
        if (this.connection.type === 'local') {
            wsUrl = this.connection.url.replace('http', 'ws').replace('/api', ':81');
        } else {
            wsUrl = this.connection.url.replace('http', 'ws') + '/ws';
        }
        
        try {
            this.connection.ws = new WebSocket(wsUrl);
            
            this.connection.ws.onopen = () => {
                console.log('WebSocket подключен');
            };
            
            this.connection.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.updateState(data);
                } catch (error) {
                    console.error('Ошибка парсинга WebSocket:', error);
                }
            };
            
            this.connection.ws.onerror = (error) => {
                console.error('WebSocket ошибка:', error);
            };
            
            this.connection.ws.onclose = () => {
                console.log('WebSocket отключен');
                // Пробуем переподключиться через 3 секунды
                setTimeout(() => this.connectWebSocket(), 3000);
            };
        } catch (error) {
            console.error('Ошибка создания WebSocket:', error);
        }
    }
    
    async startPolling() {
        setInterval(async () => {
            if (this.connection.connected) {
                try {
                    const response = await fetch(`${this.connection.url}/state`);
                    if (response.ok) {
                        const data = await response.json();
                        this.updateState(data);
                    }
                } catch (error) {
                    console.error('Ошибка опроса:', error);
                }
            }
        }, 3000);
    }
    
    updateState(data) {
        this.state = { ...this.state, ...data };
        this.updateUI();
    }
    
    updateUI() {
        // Влажность
        const moistureValue = document.getElementById('moisture-value');
        const moistureBar = document.getElementById('moisture-bar');
        
        moistureValue.textContent = this.state.moisture + '%';
        moistureBar.style.width = this.state.moisture + '%';
        
        // Цвет прогресс-бара в зависимости от значения
        if (this.state.moisture < 30) {
            moistureBar.className = 'progress-bar bg-danger progress-bar-striped progress-bar-animated';
        } else if (this.state.moisture < this.settings.moisture_threshold) {
            moistureBar.className = 'progress-bar bg-warning progress-bar-striped progress-bar-animated';
        } else {
            moistureBar.className = 'progress-bar bg-success progress-bar-striped progress-bar-animated';
        }
        
        // Состояния устройств
        document.getElementById('pump-status').textContent = this.state.pump ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('pump-status').className = `badge ${this.state.pump ? 'bg-success' : 'bg-secondary'}`;
        document.getElementById('pump-toggle').checked = this.state.pump;
        
        document.getElementById('light-status').textContent = this.state.light ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('light-status').className = `badge ${this.state.light ? 'bg-success' : 'bg-secondary'}`;
        document.getElementById('light-toggle').checked = this.state.light;
        
        // Режимы
        document.getElementById('auto-mode').textContent = this.state.manual_pump ? 'РУЧНОЙ' : 'АВТО';
        document.getElementById('auto-mode').className = `badge ${this.state.manual_pump ? 'bg-warning' : 'bg-info'}`;
        
        // Настройки
        document.getElementById('threshold-value').textContent = this.state.moisture_threshold || 50;
        document.getElementById('threshold-slider').value = this.state.moisture_threshold || 50;
        document.getElementById('threshold-display').textContent = (this.state.moisture_threshold || 50) + '%';
        
        if (this.state.watering_delay) {
            document.getElementById('watering-delay').value = this.state.watering_delay;
            this.settings.watering_delay = this.state.watering_delay;
        }
        
        if (this.state.watering_duration) {
            document.getElementById('watering-duration').value = this.state.watering_duration;
            this.settings.watering_duration = this.state.watering_duration;
        }
        
        // Статистика
        document.getElementById('total-waterings').textContent = this.state.total_waterings || 0;
        document.getElementById('total-light-hours').textContent = this.state.total_light_hours || 0;
        document.getElementById('today-waterings').textContent = this.state.today_waterings || 0;
        
        // Ошибки
        this.updateErrors(this.state.errors || []);
        
        // График
        if (this.state.moisture_history && this.state.moisture_history.length > 0) {
            this.updateChart(this.state.moisture_history);
        }
    }
    
    updateErrors(errors) {
        const container = document.getElementById('errors-list');
        
        if (!errors || errors.length === 0) {
            container.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle me-2"></i>
                    Ошибок нет
                </div>
            `;
            return;
        }
        
        let html = '';
        errors.forEach(error => {
            const time = error.time || '--:--';
            const critical = error.critical ? 'alert-danger' : 'alert-warning';
            
            html += `
                <div class="alert ${critical}">
                    <div class="d-flex justify-content-between">
                        <div>
                            <i class="bi ${error.critical ? 'bi-exclamation-triangle' : 'bi-exclamation-circle'} me-2"></i>
                            ${error.msg}
                        </div>
                        <small>${time}</small>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    initChart() {
        const ctx = document.getElementById('moisture-chart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Влажность %',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { color: '#666' }
                    },
                    x: { display: false }
                }
            }
        });
    }
    
    updateChart(data) {
        if (!this.chart) return;
        
        this.chart.data.datasets[0].data = data;
        
        // Создаем временные метки
        const labels = [];
        const now = new Date();
        for (let i = data.length - 1; i >= 0; i--) {
            const minutesAgo = Math.floor(i * 3); // Каждая точка = 3 минуты
            const time = new Date(now - minutesAgo * 60000);
            labels.unshift(`${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`);
        }
        
        this.chart.data.labels = labels;
        this.chart.update('none');
    }
    
    async sendCommand(command, value) {
        if (!this.connection.connected) {
            this.showToast('❌ Нет подключения к системе', 'error');
            return;
        }
        
        try {
            const payload = { [command]: value };
            const response = await fetch(`${this.connection.url}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Команда выполнена:', result);
            } else {
                throw new Error('Ошибка сервера');
            }
        } catch (error) {
            console.error('Ошибка отправки команды:', error);
            this.showToast('❌ Ошибка отправки команды', 'error');
        }
    }
    
    async saveSettings() {
        try {
            const payload = {
                moisture_threshold: this.settings.moisture_threshold,
                watering_delay: this.settings.watering_delay,
                watering_duration: this.settings.watering_duration
            };
            
            const response = await fetch(`${this.connection.url}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error('Ошибка сохранения');
            }
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }
    
    async clearErrors() {
        try {
            await fetch(`${this.connection.url}/errors/clear`, {
                method: 'POST'
            });
            this.showToast('✅ Ошибки очищены', 'success');
        } catch (error) {
            console.error('Ошибка очистки ошибок:', error);
        }
    }
    
    updateConnectionStatus(connected) {
        this.connection.connected = connected;
        const statusElement = document.getElementById('connection-status');
        
        if (connected) {
            statusElement.innerHTML = '<i class="bi bi-wifi"></i> Подключено';
            statusElement.className = 'badge bg-success me-3';
        } else {
            statusElement.innerHTML = '<i class="bi bi-wifi-off"></i> Отключено';
            statusElement.className = 'badge bg-danger me-3';
        }
    }
    
    updateTime() {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        document.getElementById('current-time').textContent = timeString;
    }
    
    startConnectionCheck() {
        setInterval(() => {
            if (!this.connection.connected) {
                this.connect();
            }
        }, 10000); // Проверка каждые 10 секунд
    }
    
    showToast(message, type = 'info') {
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: colors[type] || colors.info,
            stopOnFocus: true
        }).showToast();
    }
}

// Запуск приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EcoGrowWebApp();
});
