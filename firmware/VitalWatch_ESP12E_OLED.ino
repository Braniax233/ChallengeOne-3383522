/*
 * VitalWatch ESP8266 (ESP-12E) Firmware - WITH OLED
 * ─────────────────────────────────────────────────────────────────────────────
 * Sensors:
 *   - MAX30102  (I2C 0x57) → Heart Rate & SpO2
 *   - GY-906   (I2C 0x5A) → Body Temperature
 *   - SSD1306  (I2C 0x3C) → OLED Display
 *
 * Writes to /vitals/latest using Firebase.setJSON() (overwrite, not push).
 * Web app listens to /vitals/latest and grabs the data when capture is active.
 * ─────────────────────────────────────────────────────────────────────────────
 */

#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include "heartRate.h"
#include <Adafruit_MLX90614.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ── WiFi ─────────────────────────────────────────────────────────────────────
#define WIFI_SSID     "Braniax"
#define WIFI_PASSWORD "aaaaaaaa"

// ── Firebase ─────────────────────────────────────────────────────────────────
#define FIREBASE_HOST "vitalwatch123-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "AIzaSyDHbSqJ0CPPGget2JsRZxXwCDY_A7uwC5E"
#define USER_EMAIL    "braniax123@gmail.com"
#define USER_PASSWORD "aaaaaaaa"

// ── Objects ──────────────────────────────────────────────────────────────────
FirebaseData   fbdo;
FirebaseAuth   fireAuth;
FirebaseConfig fireConfig;

MAX30105          pulseSensor;
Adafruit_MLX90614 tempSensor;

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ── Buffers ──────────────────────────────────────────────────────────────────
#define SAMPLES 100
uint32_t irBuf[SAMPLES];
uint32_t redBuf[SAMPLES];

// ── Flags ────────────────────────────────────────────────────────────────────
bool tempOK   = false;
bool pulseOK  = false;
bool oledOK   = false;

// ── Heart Rate Algorithm ─────────────────────────────────────────────────────
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE]; 
byte rateSpot = 0;
long lastBeat = 0;     
float beatsPerMinute;
int beatAvg;

// ── External Reset Button ────────────────────────────────────────────────────
#define RESET_BTN_PIN D5 // Connect an external push button between D5 and GND

volatile bool shouldReset = false;

ICACHE_RAM_ATTR void handleResetButton() {
  shouldReset = true;
}

void smartDelay(long ms) {
  long start = millis();
  while (millis() - start < (unsigned long)ms) {
    if (shouldReset) {
      Serial.println("\n[System] External Reset Button Pressed! Restarting...");
      if (oledOK) {
        display.clearDisplay();
        display.setCursor(0,0);
        display.println("Restarting...");
        display.display();
      }
      ESP.restart();
    }
    delay(50);
  }
}

void updateOLED(String line1, String line2, String line3) {
  if (!oledOK) return;
  display.clearDisplay();
  display.setCursor(0,0);
  display.println(line1);
  display.println(line2);
  display.println(line3);
  display.display();
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  delay(100);

  // Configure external reset button interrupt
  pinMode(RESET_BTN_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(RESET_BTN_PIN), handleResetButton, FALLING);

  // ── OLED ───────────────────────────────────────────────────────────────────
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
  } else {
    oledOK = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    updateOLED("VitalWatch", "Booting...", "");
  }

  Serial.println("\n\n--- VitalWatch Booting ---");

  // ── WiFi ───────────────────────────────────────────────────────────────────
  updateOLED("WiFi:", "Connecting...", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  updateOLED("WiFi:", "Connected!", WiFi.localIP().toString());
  delay(1000);

  // ── Firebase ───────────────────────────────────────────────────────────────
  updateOLED("Firebase:", "Connecting...", "");
  fireConfig.api_key      = FIREBASE_AUTH;
  fireConfig.database_url = FIREBASE_HOST;
  fireAuth.user.email     = USER_EMAIL;
  fireAuth.user.password  = USER_PASSWORD;
  Firebase.begin(&fireConfig, &fireAuth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase ready.");

  // ── MAX30102 ───────────────────────────────────────────────────────────────
  if (pulseSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    pulseOK = true;
    pulseSensor.setup(60, 4, 2, 100, 411, 4096);
    pulseSensor.setPulseAmplitudeRed(0x1F);
    pulseSensor.setPulseAmplitudeIR(0x1F);
    Serial.println("[MAX30102] Ready.");
  } else {
    Serial.println("[MAX30102] NOT FOUND! Check wiring.");
  }

  // ── GY-906 (MLX90614) ─────────────────────────────────────────────────────
  if (tempSensor.begin(0x5A)) {
    tempOK = true;
    Serial.println("[GY-906] Ready.");
  } else {
    Serial.println("[GY-906] NOT FOUND! Check wiring.");
  }

  Serial.println("\nSetup complete. Place finger on sensor to start.");
  updateOLED("Setup Complete", "Place finger on", "sensor to start");
}

void loop() {
  if (!pulseOK) {
    Serial.println("Error: MAX30102 is missing. Cannot read vitals.");
    updateOLED("Error:", "MAX30102 Missing", "Check Wiring!");
    smartDelay(5000);
    return;
  }

  // ── Wait for finger ────────────────────────────────────────────────────────
  long irVal = pulseSensor.getIR();
  if (irVal < 50000) {
    Serial.println("Waiting for finger...");
    updateOLED("Status:", "Waiting for finger...", "");
    smartDelay(500);
    return;
  }

  // ── Collect samples ────────────────────────────────────────────────────────
  Serial.println("\nReading vitals... Hold still.");
  updateOLED("Status:", "Reading vitals...", "Hold still.");
  beatAvg = 0;

  for (byte i = 0; i < SAMPLES; i++) {
    while (!pulseSensor.available()) pulseSensor.check();
    redBuf[i] = pulseSensor.getRed();
    irBuf[i]  = pulseSensor.getIR();
    
    // Check for a heartbeat peak
    if (checkForBeat(irBuf[i]) == true) {
      long delta = millis() - lastBeat;
      lastBeat = millis();
      beatsPerMinute = 60 / (delta / 1000.0);
      
      if (beatsPerMinute < 255 && beatsPerMinute > 20) {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;
        
        // Take average of valid readings
        beatAvg = 0;
        byte count = 0;
        for (byte x = 0; x < RATE_SIZE; x++) {
          if (rates[x] > 0) {
            beatAvg += rates[x];
            count++;
          }
        }
        if (count > 0) beatAvg /= count;
      }
    }
    
    pulseSensor.nextSample();
  }

  // ── Calculate HR & SpO2 ────────────────────────────────────────────────────
  int32_t spo2Val;
  int8_t  spo2Valid;
  int32_t hrVal;
  int8_t  hrValid;

  maxim_heart_rate_and_oxygen_saturation(
    irBuf, SAMPLES, redBuf,
    &spo2Val, &spo2Valid, &hrVal, &hrValid
  );

  // Override the Maxim HR with our robust beatAvg if we detected valid beats
  if (beatAvg > 20 && beatAvg < 200) {
    hrVal = beatAvg;
    hrValid = 1;
  }

  // ── Read temperature ───────────────────────────────────────────────────────
  float tempC = 0.0;
  if (tempOK) {
    tempC = tempSensor.readObjectTempC();
  }

  // ── Print to Serial ────────────────────────────────────────────────────────
  Serial.println("──────────────────────────");
  Serial.print("HR:   "); Serial.print(hrValid ? String(hrVal) : "--");   Serial.println(" BPM");
  Serial.print("SpO2: "); Serial.print(spo2Valid ? String(spo2Val) : "--"); Serial.println(" %");
  Serial.print("Temp: "); Serial.print(tempC, 1); Serial.println(" C");
  Serial.println("──────────────────────────");

  // ── Update OLED ────────────────────────────────────────────────────────────
  String hrStr = hrValid ? String(hrVal) + " BPM" : "-- BPM";
  String spo2Str = spo2Valid ? String(spo2Val) + " %" : "-- %";
  String tempStr = String(tempC, 1) + " C";
  
  if (oledOK) {
    display.clearDisplay();
    display.setCursor(0,0);
    display.setTextSize(2);
    display.println(hrStr);
    display.println(spo2Str);
    display.println(tempStr);
    display.display();
    display.setTextSize(1);
  }

  // ── Send to Firebase ───────────────────────────────────────────────────────
  if (Firebase.ready()) {
    FirebaseJson json;
    json.set("heartRate",    hrValid   ? (int)hrVal   : 0);
    json.set("spo2",         spo2Valid ? (int)spo2Val : 0);
    json.set("temperature",  tempC);
    json.set("timestamp",    (int)millis());

    if (Firebase.setJSON(fbdo, "/vitals/latest", json)) {
      Serial.println("Successfully sent to Firebase!");
      if (oledOK) {
        display.setCursor(0,54);
        display.print("Sent to Cloud!");
        display.display();
      }
    } else {
      Serial.print("Firebase error: ");
      Serial.println(fbdo.errorReason());
    }
  }

  // ── Wait before next reading ───────────────────────────────────────────────
  Serial.println("\nNext reading in 30s. Press the RESET button on the board for an immediate capture.");
  smartDelay(30000);
}
