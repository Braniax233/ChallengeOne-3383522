# CHAPTER FIVE
# IMPLEMENTATION, TESTING AND CONCLUSION

## 5.1 Introduction
This chapter details the practical implementation and testing of the MediMonitor remote patient monitoring system. It translates the methodologies and designs discussed in Chapters Three and Four into a working prototype. The chapter covers the physical assembly of the IoT hardware, the development of the React.js web application, and the integration of the Firebase backend and offline AI subsystem. It subsequently presents the testing strategies employed to validate the system's performance, including sensor accuracy, classification reliability, and the effectiveness of the Progressive Web App (PWA) offline capabilities. The chapter concludes with a summary of the project's achievements and its overall contribution to solving modern healthcare monitoring challenges.

## 5.2 Hardware Implementation

### 5.2.1 Circuit Assembly
The hardware prototype was assembled on a standard solderless breadboard to allow for rapid testing and iteration. The ESP-12E microcontroller (NodeMCU 1.0) served as the central processing unit. The MAX30102 pulse oximeter and the GY-906 infrared thermometer were connected to the ESP-12E using jumper wires. 

Power was supplied to the NodeMCU board via its micro-USB port, which regulates the 5V USB input down to 3.3V. This 3.3V output was then routed to the VIN pins of both the MAX30102 and the GY-906 modules. The ground pins of all three components were linked to establish a common ground circuit. For data communication, the I2C SDA pins on both sensors were connected to the D2 pin (GPIO 4) on the ESP-12E, and the SCL pins were connected to the D1 pin (GPIO 5). 

### 5.2.2 Firmware Development and Flashing
The firmware was written in C++ using the Arduino Integrated Development Environment (IDE). Necessary board manager URLs for the ESP8266 family were added to the IDE, and the specific NodeMCU 1.0 board profile was selected. 

The implementation relied on several open-source libraries. The `SparkFun MAX3010x` library was used to initialize the pulse oximeter, configure the red and infrared LED amplitudes to 0x1F (optimised for finger readings), and execute the oxygen saturation algorithm. The `Adafruit_MLX90614` library was used to read the object temperature from the GY-906. Finally, the `FirebaseESP8266` library managed the Wi-Fi connection and HTTPS requests to the Firebase Realtime Database.

Once the code was written and compiled, it was flashed onto the ESP-12E via the micro-USB connection. Serial Monitor outputs at a baud rate of 115200 were used extensively during this phase to debug Wi-Fi connection states, confirm successful I2C sensor initialization, and verify that Firebase writes were returning success codes.

## 5.3 Software Implementation

### 5.3.1 Frontend Development
The web application was implemented using React.js, initialized with the Vite build tool for optimal development speed. The user interface was styled using Tailwind CSS, a utility-first CSS framework that allowed for rapid, responsive design without writing extensive custom stylesheets. A "true dark mode" aesthetic was implemented globally to reduce glare in clinical environments.

The routing was implemented using `react-router-dom`. The application was structured into three distinct layout wrappers: `ClinicianLayout`, `ProviderLayout`, and `PatientLayout`. A custom `ProtectedRoute` component was implemented to intercept routing requests. It checks the user's authentication token and their role (stored in the application state via `AuthContext`) and automatically redirects unauthorised access attempts to the login page or the correct role-specific dashboard.

### 5.3.2 Firebase Integration
The Firebase client SDK was installed via the Node Package Manager (NPM) and initialized in a dedicated `firebase.js` configuration file. 

For authentication, the `signInWithEmailAndPassword` method was implemented on the login page. Upon successful login, the user's unique identifier (UID) is used to query the `/users/{uid}` node in the Realtime Database to fetch their profile and role.

For real-time data monitoring, the `onValue` method from the Firebase SDK was used inside a custom React hook named `useVitalsListener`. When the Provider or Patient navigates to the Capture Reading screen, this hook attaches a listener to the `/vitals/latest` database node. As the ESP-12E hardware pushes new readings to this node, the `onValue` callback triggers instantly, updating the React component state and causing the interface to re-render with the live sensor data in under a second.

### 5.3.3 AI Subsystem Implementation
The privacy-preserving artificial intelligence subsystem was implemented using the `@mlc-ai/web-llm` library. A centralized `WebLLMContext` was created to manage the lifecycle of the AI model. 

When a clinician logs in, the application calls the `CreateMLCEngine` function, specifying the `SmolLM2-135M-Instruct-q0f32-MLC` model. The browser then uses the WebGPU API to allocate local graphics memory and load the model weights. The context exposes a `chat` function that accepts a system prompt and the patient's data. 

For example, when the "AI Clinical Classification" button is pressed during the reading capture workflow, the application constructs a prompt containing the patient's newly captured SpO2, heart rate, and temperature. The `chat` function passes this string to the local model, which generates a short clinical insight (e.g., "Mild Hypoxia detected. Recommend patient rests and re-evaluates in 15 minutes."). Because the model runs entirely within the browser's memory, this text generation happens securely without any network requests to external AI servers.

### 5.3.4 Offline PWA Implementation
To ensure the system functions in low-connectivity areas, the application was transformed into a Progressive Web App. The `vite-plugin-pwa` package was used to automatically generate a Service Worker that caches the React application shell during the user's first visit.

The offline reading queue was implemented in the `saveReading` function. Before attempting to write to Firebase, the function evaluates the `navigator.onLine` browser property. If it returns false, the application serialises the reading and pushes it to an array stored in `localStorage` under the key `offline_readings_queue`. 

A global event listener for the `online` event was placed in the root `App.jsx` component. When a device reconnects to the internet, this listener fires and invokes the `syncOfflineReadings` function. This function parses the `localStorage` queue, transmits each reading to the correct `/readings/{patientId}` Firebase node, and deletes the local queue upon successful transmission.

## 5.4 System Testing

### 5.4.1 Hardware and Sensor Accuracy Testing
To validate the reliability of the perception layer, the hardware prototype was tested against standard medical devices. The MAX30102 pulse oximeter readings were compared to a commercial fingertip pulse oximeter, and the GY-906 readings were compared to a clinical digital thermometer. 

Ten test subjects of varying ages and skin tones were measured simultaneously by both the prototype and the commercial devices. The results showed that after the initial five-second warm-up period, the MAX30102 provided SpO2 readings within a 1 to 2 percent margin of error compared to the commercial device, and heart rate readings within 2 to 3 beats per minute. The GY-906 provided temperature readings within 0.3 degrees Celsius of the clinical thermometer when held exactly 2 centimetres from the skin surface. These results confirmed that the hardware is sufficiently accurate for prototype demonstration and general monitoring purposes.

### 5.4.2 Classification Engine Testing
The `classifyReading` logic was tested using simulated edge cases to ensure the deterministic rules behaved as designed. Mock JSON payloads were injected into the system to represent various patient states:
*   A payload with SpO2 at 95%, HR at 75 bpm, and Temp at 36.5°C correctly returned a 'NORMAL' status.
*   A payload with SpO2 at 92%, HR at 75 bpm, and Temp at 36.5°C correctly returned a 'WARNING' status.
*   A payload with SpO2 at 95%, HR at 130 bpm, and Temp at 36.5°C correctly returned a 'CRITICAL' status.

The worst-case logic was verified successfully. The per-patient threshold override feature was also tested by altering a test patient's normal SpO2 boundary to 90% (simulating a COPD patient). Subsequent readings of 92% correctly registered as 'NORMAL' for that specific patient, proving the configurable threshold system works.

### 5.4.3 AI Subsystem Testing
The local AI subsystem was tested for initialization speed, inference latency, and clinical relevance. On a standard laptop equipped with an integrated GPU, the SmolLM2-135M model took approximately 15 seconds to download and cache initially, and under 3 seconds to load from cache on subsequent visits. Text generation for the 10-second patient briefings completed in an average of 4 seconds. The generated outputs were reviewed for formatting and relevance, consistently producing coherent, non-hallucinated summaries of the provided vital sign data.

### 5.4.4 Offline Capability Testing
The PWA offline functionality was tested by simulating a network failure. A test device's Wi-Fi was disabled, and a reading was captured via the Provider interface. The system successfully displayed a "Saved Offline" notification and the data was verified to be in `localStorage`. Upon re-enabling the Wi-Fi, the system automatically detected the connection, uploaded the pending reading to Firebase, and cleared the local cache. The reading immediately appeared on the Clinician dashboard, confirming the background synchronization mechanism is robust.

## 5.5 Results and Discussion
The implementation and testing phases confirm that the MediMonitor system successfully addresses the major gaps identified in the literature review.

**Resolving Device Fragmentation:** By routing all sensor data from the ESP-12E hardware through Firebase to a centralized React web application, the system successfully eliminates data silos. Clinicians can view the real-time status and historical trends of all their patients on a single unified dashboard, regardless of whether the patient is in the hospital ward or being monitored at home.

**Privacy-Preserving AI:** The successful integration of the WebLLM framework proves that it is technologically feasible to provide advanced AI clinical decision support at the edge. By running the language model locally in the browser, MediMonitor provides intelligent triage and patient summaries without ever transmitting protected health information to external cloud APIs, strictly adhering to medical data privacy principles.

**Connectivity Resilience:** The implementation of the PWA Service Worker and the `localStorage` background synchronization mechanism effectively resolves the vulnerability of continuous monitoring systems to network outages. The system guarantees that critical health data captured during connectivity blackouts in rural or peri-urban settings is preserved and synced.

## 5.6 Conclusion
The primary objective of this final year project was to design and implement an IoT-based remote medical monitoring system that centralizes patient data, supports clinician-configured thresholds, and integrates a privacy-preserving offline AI model to assist doctors, alongside automated location-tagged alerts and offline-resilient data capture. 

Through the development of the ESP-12E hardware prototype, the configuration of the Firebase Realtime Database, and the programming of the React.js web application, all objectives have been met. The system successfully captures SpO2, heart rate, and body temperature, classifies the severity of the readings, and provides instant, secure AI analysis. 

The MediMonitor platform demonstrates that modern web technologies, such as WebGPU and Progressive Web Apps, can be combined with affordable microcontrollers to create highly capable, resilient, and intelligent healthcare solutions suitable for deployment in resource-constrained environments like Ghana. The project provides a strong foundation for future research, including clinical trials with patients, the integration of additional physiological sensors, and the deployment of predictive machine learning models for early deterioration warnings.
