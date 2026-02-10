class EcoGrowAPI {
    constructor() {
        this.baseUrl = '';
        this.timeout = 8000;
        this.isLocalEndpoint = false;
    }
    
    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            let url = `${this.baseUrl}${endpoint}`;
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Таймаут соединения (8 секунд)');
            }
            
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                console.error('Сетевая ошибка подключения');
            }
            
            throw error;
        }
    }
    
    setBaseUrl(ip) {
        if (ip === 'demo-mode') {
            this.baseUrl = 'demo://';
            this.isLocalEndpoint = false;
            return;
        }
        
        const cleanIp = ip.replace(/^https?:\/\//, '');
        const isLocalTarget = this.isLocalTarget(cleanIp);
        this.isLocalEndpoint = isLocalTarget;

        if (isLocalTarget) {
            this.baseUrl = `http://${cleanIp}`;
        } else {
            this.baseUrl = `${window.location.protocol}//${cleanIp}`;
        }
        
        console.log(`API URL установлен: ${this.baseUrl}`);
    }

    isLocalTarget(ip) {
        const cleanIp = ip.replace(/^https?:\/\//, '');
        const hostOnly = cleanIp.split('/')[0].split(':')[0];
        const isLocalHost = hostOnly === 'localhost' || hostOnly.endsWith('.local');
        const isPrivateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.0\.0\.1)/.test(hostOnly);
        return isLocalHost || isPrivateIp;
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
        
        this.setBaseUrl(ip);
        
        try {
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
                return true;
            }
            
            return false;
        } catch (error) {
            console.log(`Не удалось подключиться к ${ip}:`, error.message);
            return false;
        }
    }
}
