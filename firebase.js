// Firebase Configuration and Initialization

console.log('🔥 Инициализация Firebase...');

// Firebase configuration - версия 8.10.1
const firebaseConfig = {
    apiKey: "AIzaSyBsZr7vWJDFt_S5i0Rvj6ejp6QT0JX9SPk",
    authDomain: "ecogrow-remote.firebaseapp.com",
    databaseURL: "https://ecogrow-remote-default-rtdb.firebaseio.com",
    projectId: "ecogrow-remote",
    storageBucket: "ecogrow-remote.firebasestorage.app",
    messagingSenderId: "121689275158",
    appId: "1:121689275158:web:f3b1829755c8b8a1fb2e37",
    measurementId: "G-PG5116NH38"
};

// Initialize Firebase - версия 8
try {
    // Проверяем, загружен ли Firebase SDK
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK не загружен');
        // Создаем заглушку для демо-режима
        window.firebaseDatabase = {
            ref: function(path) {
                console.log('DEMO: Ref to ' + path);
                return {
                    on: function() { return null; },
                    set: function() { return Promise.resolve(); },
                    update: function() { return Promise.resolve(); },
                    deleteNode: function() { return Promise.resolve(); },
                    getJSON: function() { return Promise.resolve(); },
                    once: function() { return Promise.resolve({ val: () => null }); }
                };
            }
        };
    } else {
        // Инициализируем Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase инициализирован успешно');
        } else {
            console.log('⚠️ Firebase уже инициализирован');
        }
        
        // Получаем экземпляр базы данных
        const database = firebase.database();
        
        // Делаем доступным глобально для app.js
        window.firebaseDatabase = database;
        
        console.log('📊 Firebase Database готов к использованию');
        
        // Тест подключения
        try {
            const connectedRef = database.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                const status = snap.val() === true ? '✅ Подключено' : '❌ Отключено';
                console.log('Соединение Firebase:', status);
            });
        } catch (connError) {
            console.warn('⚠️ Не удалось проверить соединение Firebase:', connError);
        }
    }
    
} catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error);
    // Создаем заглушку для демо-режима
    window.firebaseDatabase = {
        ref: function(path) {
            console.log('DEMO (fallback): Ref to ' + path);
            return {
                on: function() { return null; },
                set: function() { return Promise.resolve(); },
                update: function() { return Promise.resolve(); },
                deleteNode: function() { return Promise.resolve(); },
                getJSON: function() { return Promise.resolve(); },
                once: function() { return Promise.resolve({ val: () => null }); }
            };
        }
    };
}

// Firebase Service Class (дополнительный функционал)
class FirebaseService {
    constructor() {
        this.db = window.firebaseDatabase;
        this.devicesRef = this.db ? this.db.ref('devices') : null;
        this.currentDeviceId = null;
        this.currentDeviceRef = null;
    }

    // Проверка доступности
    isAvailable() {
        return this.db !== null;
    }

    // Scan for online devices
    scanForDevices() {
        if (!this.devicesRef) return Promise.resolve([]);
        
        return new Promise((resolve) => {
            this.devicesRef.once('value', (snapshot) => {
                const devices = [];
                snapshot.forEach((childSnapshot) => {
                    const device = childSnapshot.val();
                    if (device.online) {
                        devices.push({
                            id: childSnapshot.key,
                            name: device.name || 'EcoGrow Device',
                            ip: device.ip || 'Unknown',
                            online: device.online,
                            lastSeen: device.lastSeen || Date.now()
                        });
                    }
                });
                resolve(devices);
            });
        });
    }

    // Connect to specific device
    connectToDevice(deviceId) {
        if (!this.devicesRef) return null;
        
        this.currentDeviceId = deviceId;
        this.currentDeviceRef = this.devicesRef.child(deviceId);
        
        // Update device last seen
        this.updateDeviceStatus();
        
        return this.currentDeviceRef;
    }

    // Update device status
    updateDeviceStatus() {
        if (this.currentDeviceRef) {
            this.currentDeviceRef.update({
                lastSeen: Date.now(),
                online: true
            });
        }
    }

    // Send command to device
    sendCommand(command, value = null) {
        if (!this.currentDeviceRef) return false;
        
        const commandsRef = this.currentDeviceRef.child('commands');
        
        if (typeof command === 'object') {
            // If command is an object, set multiple values
            return commandsRef.update(command);
        } else {
            // If command is a string, set single value
            const data = {};
            data[command] = value;
            return commandsRef.update(data);
        }
    }

    // Disconnect from device
    disconnect() {
        this.currentDeviceId = null;
        this.currentDeviceRef = null;
    }
}

// Create global instance if Firebase available
if (window.firebaseDatabase) {
    window.firebaseService = new FirebaseService();
    console.log('✅ Firebase Service создан');
}
