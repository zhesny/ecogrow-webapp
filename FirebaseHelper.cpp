#include "FirebaseHelper.h"
#include <FirebaseESP8266.h>

FirebaseData fbData;
FirebaseData firebaseData;
FirebaseJson firebaseJson;

void initFirebase() {
  Serial.println("Initializing Firebase...");
  
  // Настройка Firebase
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Firebase.reconnectWiFi(true);
  
  // Установка размера буфера
  firebaseData.setBSSLBufferSize(1024, 1024);
  firebaseData.setResponseSize(1024);
  
  // Проверка подключения
  String path = "/test";
  if (Firebase.setString(firebaseData, path.c_str(), "test")) {
    fbData.connected = true;
    fbData.lastUpdate = millis();
    fbData.deviceId = String(ESP.getChipId());
    
    Serial.println("Firebase connected successfully!");
    
    // Регистрация устройства
    FirebaseJson deviceInfo;
    deviceInfo.set("device_id", fbData.deviceId);
    deviceInfo.set("ip_address", WiFi.localIP().toString());
    deviceInfo.set("mac_address", WiFi.macAddress());
    deviceInfo.set("firmware_version", "4.0");
    deviceInfo.set("last_seen", time(nullptr));
    
    String regPath = "/devices/" + fbData.deviceId + "/info";
    Firebase.setJSON(firebaseData, regPath.c_str(), deviceInfo);
    
  } else {
    fbData.connected = false;
    Serial.println("Firebase connection failed: " + firebaseData.errorReason());
  }
}

bool updateFirebaseState(const String& stateJson) {
  if (!fbData.connected) {
    if (millis() - fbData.lastUpdate > 60000) {
      // Попытка переподключения каждые 60 секунд
      initFirebase();
    }
    return false;
  }
  
  String path = "/devices/" + fbData.deviceId + "/state";
  if (Firebase.setString(firebaseData, path.c_str(), stateJson)) {
    fbData.lastUpdate = millis();
    return true;
  } else {
    Serial.println("Failed to update Firebase: " + firebaseData.errorReason());
    fbData.connected = false;
    return false;
  }
}

bool checkFirebaseCommands() {
  if (!fbData.connected) return false;
  
  String path = "/devices/" + fbData.deviceId + "/commands";
  
  if (Firebase.getString(firebaseData, path.c_str())) {
    String commands = firebaseData.stringData();
    if (commands.length() > 2) { // Проверяем, что не пустой JSON {}
      processFirebaseCommand(commands);
      
      // Очищаем команды после обработки
      Firebase.setString(firebaseData, path.c_str(), "{}");
      return true;
    }
  }
  return false;
}

void processFirebaseCommand(const String& command) {
  Serial.println("Processing Firebase command: " + command);
  
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, command);
  
  if (error) {
    Serial.println("Failed to parse command JSON");
    return;
  }
  
  // Здесь добавьте обработку команд
  // Например:
  if (doc.containsKey("pump")) {
    String pumpCmd = doc["pump"].as<String>();
    // Обработка команды насоса
  }
  
  if (doc.containsKey("light")) {
    String lightCmd = doc["light"].as<String>();
    // Обработка команды света
  }
}

String getDeviceId() {
  return fbData.deviceId;
}

void sendErrorToFirebase(const String& errorMsg) {
  if (!fbData.connected) return;
  
  FirebaseJson json;
  json.set("timestamp", time(nullptr));
  json.set("message", errorMsg);
  json.set("device_id", fbData.deviceId);
  
  String path = "/devices/" + fbData.deviceId + "/errors";
  Firebase.pushJSON(firebaseData, path.c_str(), json);
}
