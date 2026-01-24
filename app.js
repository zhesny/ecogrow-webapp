// EcoGrow Assistant v4.5
class EcoGrowApp {
    constructor() {
        console.log('🚀 Инициализация EcoGrow Assistant');
        
        this.systemData = {
            moisture: 50,
            pump: 0,
            light: 0,
            temperature: 25,
            humidity: 50,
            timestamp: 0
        };
        
        this.chartData = [];
        this.chart = null;
        this.isConnected = false;
        
        // Инициализация при загрузке DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🔧 Запуск инициализации');
        
        // 1. Проверяем элементы
        this.checkElements();
        
        // 2. Инициализируем график
        this.initChart();
        
        // 3. Инициализируем обработчики
        this.initEventListeners();
        
        // 4. Запускаем таймеры
        this.startTimers();
        
        // 5. Подключаемся к Firebase
        this.connectToFirebase();
        
        // 6. Скрываем прелоадер
        setTimeout(() => {
            const preloader = document.getElementById('preloader');
            if (preloader) {
                preloader.style.opacity = '0';
                setTimeout(() => {
                    preloader.style.display = 'none';
                }, 500);
            }
        }, 1000);
        
        console.log('✅ Приложение инициализировано');
    }

    checkElements() {
        console.log('🔍 Проверка элементов:');
        
        const elements = [
            'moistureValue', 'pumpStatus', 'lightStatus',
            'manualPumpBtn', 'manualLightBtn', 'moistureChart',
            'currentTime', 'lastUpdate', 'statusDot', 'statusText'
        ];
        
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`❌ Элемент #${id} не найден`);
            } else {
                console.log(`✅ #${id} найден`);
            }
        });
    }

    initChart() {
        const canvas = document.getElementById('moistureChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 12}, (_, i) => {
                    const hour = new Date().getHours();
                    return `${((hour - 11 + i + 24) % 24).toString().padStart(2, '0')}:00`;
                }),
                datasets: [{
                    label: 'Влажность почвы',
                    data: Array(12).fill(50),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                    y: { 
                        min: 0, 
                        max: 100,
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    }
                }
            }
        });
        
        console.log('📊 График создан');
    }

    initEventListeners() {
        console.log('🎛️ Настройка обработчиков событий');
        
        // Кнопка насоса
        const pumpBtn = document.getElementById('manualPumpBtn');
        if (pumpBtn) {
            console.log('✅ Кнопка насоса найдена');
            pumpBtn.addEventListener('click', () => {
                console.log('👉 Нажата кнопка насоса');
                this.togglePump();
            });
        } else {
            console.error('❌ Кнопка насоса НЕ найдена');
        }
        
        // Кнопка света
        const lightBtn = document.getElementById('manualLightBtn');
        if (lightBtn) {
            console.log('✅ Кнопка света найдена');
            lightBtn.addEventListener('click', () => {
                console.log('👉 Нажата кнопка света');
                this.toggleLight();
            });
        }
        
        // Быстрый полив
        document.getElementById('quickWater5')?.addEventListener('click', () => this.quickWater(5));
        document.getElementById('quickWater10')?.addEventListener('click', () => this.quickWater(10));
        document.getElementById('quickWater30')?.addEventListener('click', () => this.quickWater(30));
        
        // Синхронизация времени
        document.getElementById('syncTimeBtn')?.addEventListener('click', () => this.syncTime());
        
        // Очистка ошибок
        document.getElementById('clearErrorsBtn')?.addEventListener('click', () => this.clearErrors());
        
        // Слайдер влажности
        const thresholdSlider = document.getElementById('moistureThreshold');
        if (thresholdSlider) {
            thresholdSlider.addEventListener('input', (e) => {
                document.getElementById('thresholdValue').textContent = `${e.target.value}%`;
            });
        }
        
        console.log('✅ Все обработчики настроены');
    }

    togglePump() {
        console.log('🔧 Переключение насоса');
        
        // Меняем состояние
        this.systemData.pump = this.systemData.pump ? 0 : 1;
        
        // Обновляем UI
        this.updateUI();
        
        // Отправляем команду
        this.sendCommand('pump', this.systemData.pump ? 'ON' : 'OFF');
        
        // Показываем уведомление
        this.showToast(`Насос ${this.systemData.pump ? 'включен' : 'выключен'}`, 'success');
    }

    toggleLight() {
        console.log('💡 Переключение света');
        
        // Меняем состояние
        this.systemData.light = this.systemData.light ? 0 : 1;
        
        // Обновляем UI
        this.updateUI();
        
        // Отправляем команду
        this.sendCommand('light', this.systemData.light ? 'ON' : 'OFF');
        
        // Показываем уведомление
        this.showToast(`Свет ${this.systemData.light ? 'включен' : 'выключен'}`, 'success');
    }

    quickWater(seconds) {
        console.log(`💧 Быстрый полив на ${seconds} секунд`);
        
        // Включаем насос
        this.systemData.pump = 1;
        this.updateUI();
        
        // Отправляем команду
        this.sendCommand('quickWater', seconds.toString());
        
        // Показываем уведомление
        this.showToast(`Полив на ${seconds} секунд`, 'info');
        
        // Выключаем через время
        setTimeout(() => {
            this.systemData.pump = 0;
            this.updateUI();
            this.showToast('Полив завершен', 'success');
        }, seconds * 1000);
    }

    updateUI() {
        // Влажность
        const moistureEl = document.getElementById('moistureValue');
        if (moistureEl) {
            moistureEl.textContent = `${this.systemData.moisture}%`;
            moistureEl.style.color = this.getMoistureColor(this.systemData.moisture);
        }
        
        // Насос
        const pumpEl = document.getElementById('pumpStatus');
        if (pumpEl) {
            pumpEl.textContent = this.systemData.pump ? 'ВКЛ' : 'ВЫКЛ';
            pumpEl.style.color = this.systemData.pump ? '#10b981' : '#ef4444';
        }
        
        // Свет
        const lightEl = document.getElementById('lightStatus');
        if (lightEl) {
            lightEl.textContent = this.systemData.light ? 'ВКЛ' : 'ВЫКЛ';
            lightEl.style.color = this.systemData.light ? '#f59e0b' : '#94a3b8';
        }
        
        // Кнопки
        this.updateButtons();
        
        // Время
        const now = new Date();
        document.getElementById('currentTime').textContent = now.toLocaleTimeString('ru-RU');
        document.getElementById('lastUpdate').textContent = `Обновлено: ${now.toLocaleTimeString('ru-RU')}`;
        
        // График
        this.updateChart();
    }

    updateButtons() {
        const pumpBtn = document.getElementById('manualPumpBtn');
        const lightBtn = document.getElementById('manualLightBtn');
        const pumpText = document.getElementById('pumpBtnText');
        const lightText = document.getElementById('lightBtnText');
        
        if (pumpBtn && pumpText) {
            if (this.systemData.pump) {
                pumpText.textContent = 'Выключить насос';
                pumpBtn.classList.add('active');
            } else {
                pumpText.textContent = 'Включить насос';
                pumpBtn.classList.remove('active');
            }
        }
        
        if (lightBtn && lightText) {
            if (this.systemData.light) {
                lightText.textContent = 'Выключить свет';
                lightBtn.classList.add('active');
            } else {
                lightText.textContent = 'Включить свет';
                lightBtn.classList.remove('active');
            }
        }
    }

    updateChart() {
        if (!this.chart) return;
        
        // Добавляем новую точку
        this.chartData.push(this.systemData.moisture);
        if (this.chartData.length > 12) {
            this.chartData.shift();
        }
        
        // Обновляем график
        this.chart.data.datasets[0].data = [...this.chartData];
        this.chart.update('none');
        
        // Обновляем статистику
        this.updateStats();
    }

    updateStats() {
        if (this.chartData.length === 0) return;
        
        const avg = Math.round(this.chartData.reduce((a, b) => a + b, 0) / this.chartData.length);
        const min = Math.min(...this.chartData);
        const max = Math.max(...this.chartData);
        
        document.getElementById('avgMoisture').textContent = `${avg}%`;
        document.getElementById('minMoisture').textContent = `${min}%`;
        document.getElementById('maxMoisture').textContent = `${max}%`;
    }

    getMoistureColor(moisture) {
        if (moisture < 30) return '#ef4444';
        if (moisture < 50) return '#f59e0b';
        if (moisture < 70) return '#10b981';
        return '#3b82f6';
    }

    connectToFirebase() {
        if (!window.firebaseDatabase) {
            console.log('⚠️ Firebase не доступен, демо-режим');
            this.startDemoMode();
            return;
        }
        
        console.log('🔥 Подключение к Firebase');
        
        try {
            // Подписываемся на данные
            const dataRef = window.firebaseDatabase.ref('data/current');
            dataRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    console.log('📥 Получены данные:', data);
                    this.systemData.moisture = data.moisture || 50;
                    this.systemData.pump = data.pump || 0;
                    this.systemData.light = data.light || 0;
                    this.updateUI();
                    this.updateConnectionStatus('connected');
                }
            });
            
            // Статус подключения
            window.firebaseDatabase.ref('.info/connected').on('value', (snap) => {
                this.isConnected = snap.val() === true;
                this.updateConnectionStatus(this.isConnected ? 'connected' : 'disconnected');
            });
            
        } catch (error) {
            console.error('❌ Ошибка Firebase:', error);
            this.startDemoMode();
        }
    }

    updateConnectionStatus(status) {
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        
        if (!dot || !text) return;
        
        switch(status) {
            case 'connected':
                dot.className = 'status-dot connected';
                dot.style.background = '#10b981';
                text.textContent = 'Подключено';
                break;
            case 'disconnected':
                dot.className = 'status-dot disconnected';
                dot.style.background = '#ef4444';
                text.textContent = 'Отключено';
                break;
            default:
                dot.className = 'status-dot';
                dot.style.background = '#f59e0b';
                text.textContent = 'Ошибка';
        }
    }

    sendCommand(type, value) {
        console.log(`📤 Отправка команды: ${type}=${value}`);
        
        if (!window.firebaseDatabase) {
            console.log('DEMO: Команда не отправлена (нет Firebase)');
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            try {
                window.firebaseDatabase.ref(`commands/${type}`).set(value)
                    .then(() => {
                        console.log('✅ Команда отправлена');
                        resolve();
                    })
                    .catch(error => {
                        console.error('❌ Ошибка отправки:', error);
                        resolve(); // Разрешаем промис даже при ошибке
                    });
            } catch (error) {
                console.error('❌ Критическая ошибка:', error);
                resolve();
            }
        });
    }

    syncTime() {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        this.sendCommand('setTime', timeString);
        this.showToast('Время синхронизировано', 'success');
    }

    clearErrors() {
        document.getElementById('errorList').innerHTML = `
            <div class="no-data">
                <i class="fas fa-check-circle"></i>
                <p>Ошибок не обнаружено</p>
            </div>
        `;
        this.showToast('История ошибок очищена', 'success');
    }

    startDemoMode() {
        console.log('🔄 Запуск демо-режима');
        
        // Генерируем демо-данные каждые 3 секунды
        setInterval(() => {
            this.systemData.moisture = Math.max(20, Math.min(80, 
                this.systemData.moisture + (Math.random() - 0.5) * 2
            ));
            
            // Случайные изменения
            if (Math.random() > 0.95) {
                this.systemData.pump = 1 - this.systemData.pump;
            }
            if (Math.random() > 0.97) {
                this.systemData.light = 1 - this.systemData.light;
            }
            
            this.updateUI();
        }, 3000);
    }

    startTimers() {
        // Обновление времени
        setInterval(() => {
            const now = new Date();
            document.getElementById('currentTime').textContent = now.toLocaleTimeString('ru-RU');
        }, 1000);
        
        console.log('⏱️ Таймеры запущены');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : 'info'}-circle"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Запуск приложения
window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен');
    window.app = new EcoGrowApp();
});
