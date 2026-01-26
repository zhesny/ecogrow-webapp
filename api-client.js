class EcoGrowAPI {
    constructor() {
        this.baseUrl = '';
        this.timeout = 10000;
    }
    
    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    setBaseUrl(ip) {
        if (!ip.startsWith('http://') && !ip.startsWith('https://')) {
            this.baseUrl = `http://${ip}`;
        } else {
            this.baseUrl = ip;
        }
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
        this.setBaseUrl(ip);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${this.baseUrl}/api/info`, {
                method: 'HEAD',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}
