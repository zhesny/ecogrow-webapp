#ifndef FIREBASE_HELPER_H
#define FIREBASE_HELPER_H

#include <FirebaseESP8266.h>
#include <ESP8266WiFi.h>
#include <ArduinoJson.h>

// Конфигурация Firebase
#define FIREBASE_HOST "ecogrow-remote-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "BUZJq4KALKON2yX0HsXZFMz8CPTwA1IYzd2XQnDf"

// Структура для хранения данных Firebase
struct FirebaseData {
  bool connected;
  unsigned long lastUpdate;
  String deviceId;
};

extern FirebaseData fbData;
extern FirebaseData firebaseData;
extern FirebaseJson firebaseJson;

// Функции работы с Firebase
void initFirebase();
bool updateFirebaseState(const String& stateJson);
bool checkFirebaseCommands();
void processFirebaseCommand(const String& command);
String getDeviceId();
void sendErrorToFirebase(const String& errorMsg);

#endif
