// Demo API для имитации работы системы
class DemoAPI {
    constructor() {
        this.baseUrl = 'demo://';
        this.timeout = 1000;
        
        // Демо-данные
        this.demoData = {
            moisture: 65,
            pump: false,
            light: false,
            moisture_threshold: 50,
            watering_delay: 30,
            watering_duration: 10,
            lamp_enabled: true,
            lamp_start: "08:00",
            lamp_end: "20:00",
            sleep_enabled: false,
            sleep_start: "23:00",
            sleep_end: "07:00",
            total_waterings: 142,
            total_light_hours: 856,
            total_energy: 42800,
            errors: []
        };
        
        this.moistureHistory = [];
        this.generateInitialHistory();
    }
    
    generateInitialHistory() {
        const now = Date.now();
        // Генерируем историю за последние 24 часа
        for (let i = 0; i < 24 * 12; i++) { // Каждые 5 минут
            const time = now - (24 * 60 * 60 * 1000) + (i * 5 * 60 * 1000);
            const moisture = 60 + Math.sin(i * 0.1) * 15 + Math.random() * 5;
            this.moistureHistory.push({
                timestamp: time,
                value: Math.max(10, Math.min(90, moisture))
            });
        }
    }
    
    async request(endpoint, options = {}) {
        // Имитация задержки сети
        await new Promise(resolve => setTimeout(resolve, 300));
        
        switch(endpoint) {
            case '/api/info':
                return {
                    version: '4.5.1',
                    ip: 'demo-mode',
                    hostname: 'ecogrow.local',
                    uptime: Math.floor(Math.random() * 1000000)
                };
                
            case '/api/state':
                return this.getDemoState();
                
            default:
                throw new Error(`Demo endpoint ${endpoint} not implemented`);
        }
    }
    
    getDemoState() {
        // Обновляем демо-данные с небольшими случайными изменениями
        const now = new Date();
        const hour = now.getHours();
        
        // Изменяем влажность в зависимости от времени суток
        let moistureChange = 0;
        if (hour >= 22 || hour < 6) {
            // Ночью влажность немного повышается
            moistureChange = 0.1;
        } else if (hour >= 12 && hour < 18) {
            // Днем влажность немного понижается
            moistureChange = -0.2;
        } else {
            // Утренние и вечерние часы
            moistureChange = -0.05;
        }
        
        // Добавляем случайные колебания
        moistureChange += (Math.random() - 0.5) * 0.3;
        
        // Обновляем текущую влажность
        this.demoData.moisture = Math.max(15, Math.min(85, this.demoData.moisture + moistureChange));
        
        // Добавляем в историю
        this.moistureHistory.push({
            timestamp: Date.now(),
            value: this.demoData.moisture
        });
        
        // Удаляем старые данные (старше 24 часов)
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        this.moistureHistory = this.moistureHistory.filter(h => h.timestamp > twentyFourHoursAgo);
        
        // Генерируем историю для графика
        const history = [];
        const interval = 5 * 60 * 1000; // 5 минут
        let currentTime = Date.now() - (24 * 60 * 60 * 1000);
        
        while (currentTime <= Date.now()) {
            // Находим ближайшую точку данных
            const nearest = this.moistureHistory.reduce((prev, curr) => {
                return Math.abs(curr.timestamp - currentTime) < Math.abs(prev.timestamp - currentTime) ? curr : prev;
            });
            history.push(nearest.value);
            currentTime += interval;
        }
        
        // Автоматически включаем/выключаем свет по расписанию
        const currentTimeStr = now.toTimeString().substring(0, 5);
        const [lampStartHour, lampStartMin] = this.demoData.lamp_start.split(':').map(Number);
        const [lampEndHour, lampEndMin] = this.demoData.lamp_end.split(':').map(Number);
        
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const lampStartMinutes = lampStartHour * 60 + lampStartMin;
        const lampEndMinutes = lampEndHour * 60 + lampEndMin;
        
        if (this.demoData.lamp_enabled) {
            if (lampStartMinutes < lampEndMinutes) {
                this.demoData.light = currentMinutes >= lampStartMinutes && currentMinutes < lampEndMinutes;
            } else {
                this.demoData.light = currentMinutes >= lampStartMinutes || currentMinutes < lampEndMinutes;
            }
        }
        
        return {
            moisture: Math.round(this.demoData.moisture),
            moisture_history: history.slice(-80), // Последние 80 точек (24 часа)
            moisture_threshold: this.demoData.moisture_threshold,
            watering_delay: this.demoData.watering_delay,
            watering_duration: this.demoData.watering_duration,
            manual_pump_time: 10,
            manual_light_time: 1,
            watering_delay_ms: this.demoData.watering_delay * 60000,
            time_since_watering: Math.floor(Math.random() * 1800000), // До 30 минут
            current_time: currentTimeStr,
            
            pump: this.demoData.pump,
            light: this.demoData.light,
            manual_pump: false,
            manual_light: false,
            time_manual: false,
            
            lamp_start: this.demoData.lamp_start,
            lamp_end: this.demoData.lamp_end,
            lamp_enabled: this.demoData.lamp_enabled,
            sleep_start: this.demoData.sleep_start,
            sleep_end: this.demoData.sleep_end,
            sleep_enabled: this.demoData.sleep_enabled,
            
            avg_moisture: Math.round(this.demoData.moisture * 0.9),
            min_moisture: Math.round(this.demoData.moisture * 0.8),
            max_moisture: Math.round(this.demoData.moisture * 1.2),
            
            total_waterings: this.demoData.total_waterings,
            total_light_hours: this.demoData.total_light_hours,
            total_energy: this.demoData.total_energy,
            
            errors: this.demoData.errors
        };
    }
    
    setBaseUrl(ip) {
        // Ничего не делаем в демо-режиме
    }
    
    // System Info
    async getInfo(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/info');
    }
    
    // Get State
    async getState(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/state');
    }
    
    // Pump Control
    async controlPump(ip, action) {
        this.demoData.pump = action === 'on';
        if (action === 'on') {
            this.demoData.total_waterings++;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        return { status: 'ok' };
    }
    
    // Light Control
    async controlLight(ip, action) {
        this.demoData.light = action === 'on';
        await new Promise(resolve => setTimeout(resolve, 300));
        return { status: 'ok' };
    }
    
    // Update Settings
    async updateSettings(ip, settings) {
        Object.assign(this.demoData, settings);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { status: 'ok' };
    }
    
    // Set Time
    async setTime(ip, hours, minutes) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { status: 'ok' };
    }
    
    // Sync Time
    async syncTime(ip) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { 
            status: 'ok',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        };
    }
    
    // Clear Errors
    async clearErrors(ip) {
        this.demoData.errors = [];
        await new Promise(resolve => setTimeout(resolve, 300));
        return { status: 'ok' };
    }
    
    // Get Weather Data (external API) - демо версия
    async getWeather(lat, lon, apiKey) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
            weather: [{
                description: 'ясно',
                icon: '01d'
            }],
            main: {
                temp: 22,
                humidity: 65,
                pressure: 1013
            },
            wind: {
                speed: 3
            }
        };
    }
    
    // Send Telegram Notification - демо версия
    async sendTelegramNotification(botToken, chatId, message) {
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('Demo Telegram notification:', message);
        return { ok: true };
    }
}
