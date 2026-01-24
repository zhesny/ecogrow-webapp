// Простая инициализация Firebase
(function() {
    console.log('🔥 Подготовка Firebase');
    
    // Проверяем, загружен ли Firebase
    if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase SDK не загружен');
        window.firebaseDatabase = null;
        return;
    }
    
    // Конфигурация Firebase
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
    
    try {
        // Инициализируем Firebase
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        
        // Делаем доступным глобально
        window.firebaseDatabase = database;
        
        console.log('✅ Firebase инициализирован');
        
        // Проверка подключения
        database.ref('.info/connected').on('value', (snap) => {
            console.log('📡 Статус подключения:', snap.val() ? '✅' : '❌');
        });
        
    } catch (error) {
        console.error('❌ Ошибка инициализации Firebase:', error);
        window.firebaseDatabase = null;
    }
})();
