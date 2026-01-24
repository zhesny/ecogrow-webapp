// Firebase Configuration and Initialization

console.log('🔥 Инициализация Firebase...');

// Firebase configuration
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

// Initialize Firebase
try {
    // Проверяем, не инициализирован ли Firebase уже
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase инициализирован успешно');
    } else {
        console.log('⚠️ Firebase уже инициализирован');
    }
    
    // Get database instance
    const database = firebase.database();
    
    // Make available globally for app.js
    window.firebaseDatabase = database;
    
    console.log('📊 Firebase Database готов к использованию');
    
    // Test connection
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        const status = snap.val() === true ? '✅ Подключено' : '❌ Отключено';
        console.log('Соединение Firebase:', status);
    });
    
} catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error);
    window.firebaseDatabase = null;
}

// Firebase Service Class (дополнительный функционал)
class FirebaseService {
    constructor() {
        this.db = window.firebaseDatabase;
        this.devicesRef = this.db.ref('devices');
        this.currentDeviceId = null;
        this.currentDeviceRef = null;
    }

    // Scan for online devices
    scanForDevices() {
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

// Create global instance if needed
if (window.firebaseDatabase) {
    window.firebaseService = new FirebaseService();
}
