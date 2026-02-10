
class EcoGrowAPI {
    constructor() {
        this.baseUrl = '';
        this.timeout = 8000;
        this.connectionAttempts = 0;
        this.maxAttempts = 3;
    }
    
 
    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const url = `${this.baseUrl}${endpoint}`;
            console.log(`Отправка запроса: ${url}`);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                },
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                console.error(`Ошибка HTTP ${response.status}: ${errorText}`);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            this.connectionAttempts++;
            
            if (error.name === 'AbortError') {
                throw new Error('Таймаут соединения (8 секунд)');
            }
            
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                console.error('Сетевая ошибка подключения');
                console.log('Возможные причины:');
                console.log('1. Устройство не включено или не подключено к сети');
                console.log('2. Неправильный IP адрес устройства');
                console.log('3. Устройство в другой подсети');
                console.log('4. Брандмауэр блокирует подключение');
            }
            
            throw error;
        }
    }
    

    setBaseUrl(ip) {
        if (ip === 'demo-mode') {
            this.baseUrl = 'demo://';
            return;
        }
        

        const cleanIp = ip.replace(/^https?:\/\//, '');
        
        
        if (cleanIp.includes('.local') || this.isPrivateIP(cleanIp)) {
            // Для локальных устройств используем текущий протокол страницы
            this.baseUrl = `${window.location.protocol}//${cleanIp}`;
        } else {

            this.baseUrl = `https://${cleanIp}`;
        }
        
        console.log(`Установлен API URL: ${this.baseUrl}`);
    }
    
    
    isPrivateIP(ip) {
        const host = ip.split('/')[0].split(':')[0];
        
        
        const isLocal = host === 'localhost' || 
                       host.endsWith('.local') || 
                       host === '127.0.0.1';
        
        // Проверка приватных диапазонов
        const isPrivateRange = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
        
        return isLocal || isPrivateRange;
    }
    
   
    async getInfo(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/info');
    }
    

    async getState(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/state');
    }
    

    async controlPump(ip, action) {
        this.setBaseUrl(ip);
        return await this.request('/api/pump', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    

    async controlLight(ip, action) {
        this.setBaseUrl(ip);
        return await this.request('/api/light', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    

    async updateSettings(ip, settings) {
        this.setBaseUrl(ip);
        return await this.request('/api/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }
    
   
    async setTime(ip, hours, minutes) {
        this.setBaseUrl(ip);
        return await this.request('/api/time', {
            method: 'POST',
            body: JSON.stringify({ hours, minutes })
        });
    }
    
    
    async syncTime(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/time/sync', {
            method: 'POST'
        });
    }
    
    
    async clearErrors(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/errors/clear', {
            method: 'POST'
        });
    }
    
    
    async resetStats(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/stats/reset', {
            method: 'POST'
        });
    }
    
    
    async testConnection(ip) {
        if (ip === 'demo-mode') {
            return true;
        }
        
        try {
            this.setBaseUrl(ip);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(`${this.baseUrl}/api/info`, {
                method: 'GET',
                signal: controller.signal,
                mode: 'cors'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                console.log(`Успешное подключение к ${ip}:`, data);
                this.connectionAttempts = 0;
                return true;
            }
            
            return false;
        } catch (error) {
            console.log(`Ошибка подключения к ${ip}:`, error.message);
            return false;
        }
    }
    
    
    resetConnectionAttempts() {
        this.connectionAttempts = 0;
    }
}
