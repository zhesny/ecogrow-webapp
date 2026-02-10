class EcoGrowLocalAPI {
  constructor() {
    // Автоматически определяем IP сервера
    this.serverIP = window.location.hostname;
    this.serverPort = window.location.port || 8080;
    this.ws = null;
    this.connected = false;
    
    // Если открыто через localhost, используем WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.wsUrl = `${protocol}://${this.serverIP}:${this.serverPort}`;
    
    console.log(`🌐 Локальный сервер: ${this.wsUrl}`);
  }
  
  async init() {
    return this.connectWebSocket();
  }
  
  connectWebSocket() {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(`${this.wsUrl}/?device=ecogrow_main`);
        
        this.ws.onopen = () => {
          console.log('✅ Подключились к локальному серверу');
          this.connected = true;
          
          // Запрашиваем список устройств
          this.ws.send(JSON.stringify({
            type: 'get_devices'
          }));
          
          resolve(true);
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
              case 'welcome':
                console.log('Сервер:', data.message);
                break;
                
              case 'data':
                // Данные от ESP8266
                if (window.ecoGrowApp) {
                  window.ecoGrowApp.handleDeviceData(data);
                }
                break;
                
              case 'init':
                // Инициализация
                console.log('Доступные устройства:', data.devices);
                break;
            }
          } catch (error) {
            console.error('Ошибка парсинга:', error);
          }
        };
        
        this.ws.onclose = () => {
          console.log('❌ Отключились от сервера');
          this.connected = false;
          setTimeout(() => this.connectWebSocket(), 5000);
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket ошибка:', error);
        };
        
      } catch (error) {
        console.error('Ошибка подключения:', error);
        resolve(false);
      }
    });
  }
  
  // Команды для ESP8266
  async sendCommand(deviceId, command, value) {
    if (!this.connected || !this.ws) {
      console.error('Нет подключения к серверу');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify({
        type: 'command',
        device: deviceId,
        command: command,
        value: value
      }));
      
      return true;
    } catch (error) {
      console.error('Ошибка отправки команды:', error);
      return false;
    }
  }
  
  // HTTP методы
  async getDeviceList() {
    try {
      const response = await fetch(`http://${this.serverIP}:${this.serverPort}/api/devices`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка получения списка устройств:', error);
      return { devices: [] };
    }
  }
  
  async getDeviceData(deviceId) {
    try {
      const response = await fetch(`http://${this.serverIP}:${this.serverPort}/api/data/${deviceId}`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка получения данных:', error);
      return null;
    }
  }
  
  async controlPump(deviceId, action) {
    return this.sendCommand(deviceId, 'pump', action === 'on' ? 1 : 0);
  }
  
  async controlLight(deviceId, action) {
    return this.sendCommand(deviceId, 'light', action === 'on' ? 1 : 0);
  }
  
  async testConnection() {
    try {
      const response = await fetch(`http://${this.serverIP}:${this.serverPort}/api/status`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
