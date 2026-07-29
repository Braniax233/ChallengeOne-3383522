# CHAPTER TWO
# LITERATURE REVIEW

## 2.1 Introduction
This chapter reviews published research and existing commercial systems in the area of IoT-based remote patient monitoring. The review is structured to first establish the foundational concepts of IoT in healthcare, then examine specific systems that have been proposed or deployed, and finally identify the gaps that the current project seeks to address. Sources include peer-reviewed journal articles, conference proceedings, and documented commercial platforms. The chapter concludes with a summary of the five principal gaps identified across the literature and a comparison table positioning this project against existing work.

## 2.2 Overview of IoT in Healthcare
The Internet of Things refers to the network of physical objects embedded with sensors, software, and connectivity that enables them to collect and exchange data over the internet (Atzori, Luigi, Iera, and Morabito, 2010). In the healthcare domain, IoT devices typically take the form of wearable or bedside sensors that capture physiological parameters and transmit them to a remote server or cloud platform for storage, analysis, and display.

The World Health Organisation has identified remote patient monitoring as a priority strategy for extending healthcare access in low and middle-income countries (WHO, 2019). In these settings, the ratio of healthcare professionals to patients is often critically low, and specialist services are concentrated in urban centres. IoT monitoring addresses this by enabling clinicians to observe patients remotely, reducing the need for frequent hospital visits and allowing earlier intervention when a patient's condition begins to deteriorate.

The typical architecture of an IoT healthcare monitoring system consists of three layers. The perception layer includes the sensors and microcontrollers that capture physiological data. The network layer handles the transmission of that data, usually over Wi-Fi, Bluetooth, or cellular networks. The application layer provides the user interface and data processing logic that clinicians and patients interact with (Riazul Islam, Daehan, Humaun Kabir, and Kyung-Sup, 2015). This three-layer model provides a useful framework for evaluating the strengths and weaknesses of existing systems.

## 2.3 Photoplethysmography and the MAX30102 Sensor
Pulse oximetry relies on the principle of photoplethysmography (PPG), where light at two wavelengths, typically red (660 nm) and infrared (940 nm), is passed through or reflected from tissue. Oxygenated and deoxygenated haemoglobin absorb these wavelengths differently, and the ratio of absorption is used to estimate blood oxygen saturation (SpO2). The pulsatile component of the signal also provides heart rate information (Tamura, Maeda, Sekine, and Yoshida, 2014).

The MAX30102 is a widely used integrated PPG sensor manufactured by Maxim Integrated (now part of Analog Devices). It combines red and infrared LEDs with a photodetector and ambient light cancellation circuitry in a single package. The sensor communicates via the I2C protocol, making it straightforward to interface with common microcontrollers such as the ESP32 and ESP8266 families (Maxim Integrated, 2018). Published evaluations of the MAX30102 report SpO2 accuracy within plus or minus 2 percentage points of clinical-grade pulse oximeters when proper contact is maintained and a warm-up period is observed (Mohan, Kp, and Verma, 2020).

For temperature measurement, the GY-906 module houses the MLX90614 infrared thermometer sensor manufactured by Melexis. This sensor measures surface temperature without physical contact using thermopile-based infrared detection, communicating over I2C at a factory-calibrated accuracy of plus or minus 0.5 degrees Celsius in the medical temperature range of 36 to 39 degrees Celsius (Melexis, 2019). The non-contact nature of this sensor is particularly suited to clinical settings where skin contact with a shared thermometer raises hygiene concerns.

## 2.4 Microcontroller Platforms for IoT Health Devices
The choice of microcontroller determines the connectivity options, processing power, and form factor of an IoT health device. Two platforms dominate the low-cost IoT health prototyping space: the ESP8266 (including its NodeMCU variant, the ESP-12E) and the ESP32.

The ESP-12E module, based on the ESP8266 chip manufactured by Espressif Systems, provides a single-core 80 MHz processor, 4 MB flash memory, and built-in Wi-Fi (802.11 b/g/n). It has a single analog input and a limited number of GPIO pins, but its low cost (typically under 3 US dollars), extensive Arduino library support, and proven reliability in IoT prototyping make it a popular choice for single-sensor or dual-sensor monitoring devices (Espressif Systems, 2020). The ESP-12E is the microcontroller selected for the current project because it provides sufficient processing power and I2C capability for the MAX30102 and GY-906 sensors while keeping hardware costs within the budget constraints of a student project in Ghana.

The ESP32, also manufactured by Espressif Systems, offers a dual-core 240 MHz processor, Bluetooth Low Energy (BLE) in addition to Wi-Fi, and more GPIO pins. It is a more capable platform suited to multi-sensor applications but comes at a higher cost and greater power consumption. Several reviewed systems use the ESP32, particularly those incorporating additional sensors such as ECG modules or accelerometers (Espressif Systems, 2021).

## 2.5 Cloud and Backend Platforms for IoT Health Data
IoT health monitoring systems require a backend platform to receive, store, and serve sensor data. The choice of platform affects system latency, scalability, and development complexity.

Traditional approaches use a self-hosted backend consisting of a web framework (such as Node.js with Express) and a database (such as MongoDB or PostgreSQL). This approach offers maximum flexibility but introduces significant operational overhead in terms of server provisioning, database administration, and API security management (Tilkov and Vinoski, 2010).

Firebase, a platform operated by Google, has emerged as a popular alternative for IoT prototypes. Its Realtime Database service provides a NoSQL cloud database with built-in WebSocket-based synchronization, meaning that data written by an IoT device appears on connected client applications within milliseconds without the developer needing to implement polling or long-polling mechanisms (Firebase Documentation, 2023). Firebase also provides Authentication, Cloud Functions (serverless compute), and Hosting services, which collectively replace the need for a standalone backend server.

For this project, Firebase was adopted as the primary backend platform in place of the originally specified MongoDB and Node.js stack. This decision was driven by three factors: first, the Firebase Arduino library allows the ESP-12E to write sensor data directly to the Realtime Database without an intermediary API server; second, Firebase Authentication provides built-in role management through custom claims, simplifying the implementation of the three-role access control model; and third, the managed nature of Firebase eliminates the server administration overhead that would have consumed development time better spent on application-level features.

## 2.6 Review of Existing IoT Health Monitoring Systems

### 2.6.1 Arduino-Based Remote Health Monitoring (Mohan et al., 2020)
Mohan, Kp, and Verma (2020) developed a health monitoring system using an Arduino Uno connected to a MAX30102 sensor and an ESP8266 Wi-Fi module. The system captures SpO2 and heart rate and transmits readings to the ThingSpeak cloud platform for visualization. The system demonstrated reliable sensor readings and real-time cloud updates. However, it uses fixed population-level thresholds for alerting and does not support per-patient threshold configuration. The system also lacks any form of clinical documentation, trend analysis, or AI-based decision support.

### 2.6.2 ESP32-Based Health Monitoring with Cloud Analytics (Priyadarshini, Mohanty, and Panda, 2021)
Priyadarshini, Mohanty, and Panda (2021) proposed an IoT health monitoring system using the ESP32 microcontroller with a MAX30102 sensor, a DS18B20 temperature sensor, and an ADXL345 accelerometer for fall detection. Data is transmitted to an AWS IoT Core backend, processed by AWS Lambda functions, and displayed on a web dashboard. The system includes email notifications when readings exceed fixed thresholds. While this system is more comprehensive than the Arduino-based approach, it still relies on static threshold boundaries and does not offer trend detection or AI-assisted classification. The use of AWS infrastructure also introduces recurring cloud costs and vendor lock-in that may not be suitable for resource-constrained deployments.

### 2.6.3 IoT Patient Monitoring Using MQTT and Node-RED (Anuradha, Kadam, and Malviya, 2021)
Anuradha, Kadam, and Malviya (2021) implemented a remote patient monitoring system that uses the MQTT messaging protocol to transmit sensor data from an ESP32 to a Node-RED server. The Node-RED visual programming environment processes incoming data, applies threshold logic, and triggers SMS alerts via the Twilio API. The use of MQTT is a noteworthy design choice, as it is a lightweight protocol well-suited to constrained IoT devices. However, the system monitors only heart rate and temperature, does not support multiple user roles, and offers no mechanism for clinical note-taking or patient-specific threshold adjustment.

### 2.6.4 Cloud-Based Intelligent Health Monitoring (Raju, Boiroju, and Varma, 2022)
Raju, Boiroju, and Varma (2022) developed a cloud-based health monitoring system that transmits ESP32 sensor readings to Google Cloud Platform. The system uses a cloud-hosted machine learning model to classify readings as normal or abnormal. While this represents an advance over purely threshold-based systems, the reliance on cloud-hosted AI raises data privacy concerns. Every patient reading is transmitted to and processed by external servers, which presents challenges in jurisdictions with strict health data regulations. The system also does not support offline operation, meaning that readings captured during network outages are lost.

### 2.6.5 Wearable Health Monitoring with Raspberry Pi (Kaur, Jasuja, and Kumar, 2019)
Kaur, Jasuja, and Kumar (2019) built a wearable monitoring system using a Raspberry Pi as the processing unit, with connected pulse, temperature, and blood pressure sensors. The Raspberry Pi runs a local Python script that processes readings and pushes them to a cloud dashboard. The use of a Raspberry Pi provides substantial local processing power but at a significantly higher cost, larger physical size, and greater power consumption compared to microcontroller-based solutions. The system does not include role-based access control or location-tagged alerting.

### 2.6.6 Commercial Platforms: BioHarness, VitalConnect, and Philips IntelliVue
Commercial remote monitoring platforms such as the Zephyr BioHarness, VitalConnect VitalPatch, and Philips IntelliVue Guardian offer advanced multi-parameter monitoring with clinical-grade accuracy. These systems are used in hospital and clinical trial settings and support integration with electronic health record (EHR) systems. However, they share several limitations relevant to the context of this project. First, their high unit cost (typically hundreds to thousands of US dollars per device) makes them inaccessible for widespread deployment in low-resource healthcare settings such as those found in Ghana. Second, they operate as proprietary closed systems, meaning their alerting logic, data formats, and threshold configurations cannot be modified by the end user. Third, while some offer cloud-based analytics, none provide a local, offline AI model that processes data entirely on the clinician's device without transmitting it to external servers (Dias and Paulo Silva Cunha, 2018).

## 2.7 The Problem of Device Fragmentation in Healthcare
A cross-cutting issue that affects both research prototypes and commercial deployments is device fragmentation. In a typical hospital ward, vital sign monitors from different manufacturers operate as standalone units. Each device captures and displays data independently, and there is rarely a mechanism to aggregate readings from multiple devices into a single clinical view (Hiremath, Yang, and Mankodiya, 2014).

This fragmentation creates several practical problems. Clinicians managing multiple patients must physically walk to each bedside monitor to review vital signs, which is time-consuming and limits their ability to detect cross-patient trends or prioritize attention. Historical data is often stored only on the device itself or on a proprietary server, making it difficult to review a patient's vital sign trajectory over days or weeks. When a patient is transferred between wards or discharged for home monitoring, the continuity of their vital sign record is broken because the new monitoring setup does not inherit data from the previous one.

None of the academic systems reviewed in Section 2.6 explicitly address device fragmentation. They focus on individual patient monitoring and do not provide a unified platform where a clinician can view aggregated data from all monitored patients in one interface. This gap is directly addressed by the current project through a centralized web-based dashboard that receives and displays data from all connected monitoring devices, regardless of which patient or location they are associated with.

## 2.8 The Gap in Privacy-Preserving AI for Clinical Decision Support
Artificial intelligence has shown significant promise in healthcare, particularly in the areas of medical image analysis, drug interaction prediction, and vital sign anomaly detection (Topol, 2019). However, the deployment of AI in real-time clinical monitoring faces a fundamental tension between analytical capability and data privacy.

Most existing AI implementations in healthcare rely on cloud-based processing. Patient data is sent to a remote server where a machine learning model analyses it and returns a result. This approach works well from a computational standpoint, as cloud servers can host large, resource-intensive models. However, it creates a data privacy problem. Sending patient vitals, even anonymized ones, to third-party cloud services raises concerns under health data protection regulations such as the US Health Insurance Portability and Accountability Act (HIPAA), the European General Data Protection Regulation (GDPR), and Ghana's Data Protection Act (Act 843) (Abouelmehdi, Beni-Hessane, and Khaloufi, 2018).

A recent development in browser-based machine learning offers a potential solution to this tension. The WebLLM project, developed by the Machine Learning Compilation (MLC) research group, enables pre-trained Large Language Models (LLMs) to run entirely within a web browser using the WebGPU API (MLC Team, 2023). The model weights are downloaded once and cached locally; all inference occurs on the user's device without any data being transmitted to an external server. This approach, often described as "on-device AI" or "edge AI," preserves patient data privacy by construction rather than by policy.

No system reviewed in this chapter integrates a local, offline AI model into a clinical monitoring dashboard. This represents a significant gap in the current landscape. The MediMonitor system addresses this gap by integrating the SmolLM2-135M model via WebLLM into the clinician and provider dashboards. The AI assistant provides 10-second patient briefings, mild anomaly classification (identifying conditions such as mild hypoxia, moderate tachycardia, or low-grade fever), and interactive clinical Q-and-A, all without any patient data leaving the browser. This positions MediMonitor as one of the first IoT health monitoring platforms to offer privacy-preserving AI clinical decision support at the edge.

## 2.9 Offline Capability and Connectivity Resilience
A practical requirement for remote monitoring systems deployed in low and middle-income countries is the ability to function during network outages. Ghana's internet connectivity, while improving, remains inconsistent in rural and peri-urban areas. A monitoring system that loses data when connectivity drops undermines the clinical value of continuous monitoring.

Progressive Web Applications (PWAs) offer a browser-based solution to this problem. A PWA uses a Service Worker, a background script that intercepts network requests, to cache application resources and queue data submissions when the device is offline. When connectivity is restored, the Service Worker replays the queued submissions through a mechanism called Background Sync (Tandel and Jamadar, 2018). This approach allows a patient using the MediMonitor web application on their phone to capture a vital sign reading even when their internet connection is down. The reading is stored locally using the browser's IndexedDB storage and submitted to Firebase automatically when the connection returns.

Among the systems reviewed in this chapter, none implement offline reading capture with automatic background synchronization. Most systems assume continuous connectivity and simply fail silently or display an error when the network is unavailable. This is a critical limitation for deployments in areas with unstable internet infrastructure.

## 2.10 Summary of Identified Gaps
The review of existing IoT-based health monitoring systems, both academic and commercial, reveals five principal gaps that the current project seeks to address.

**Table 2.1: Summary of gaps identified in existing IoT health monitoring systems.**

| Gap | Description | Systems Affected |
| :--- | :--- | :--- |
| Gap 1: Device Fragmentation | No reviewed system provides a centralized platform that aggregates data from all monitored patients and devices into a single clinical dashboard, solving the problem of disconnected bedside monitors. | All reviewed systems |
| Gap 2: Static Thresholds | All reviewed systems use fixed, population-level threshold values for alerting. None support clinician-configurable, per-patient threshold adjustment. | All reviewed systems |
| Gap 3: No Trend Detection | No reviewed system evaluates the direction or rate of change of vital signs over time. Alerting is based solely on whether a single reading crosses a fixed boundary. | All reviewed systems |
| Gap 4: No Privacy-Preserving AI | No reviewed system integrates an AI model that runs locally on the clinician's device. Systems that use AI rely on cloud-based processing, which raises data privacy concerns. | Raju et al. (2022), Commercial platforms |
| Gap 5: No Offline Capability | No reviewed system supports reading capture during network outages with automatic background synchronization when connectivity is restored. | All reviewed systems |

## 2.11 Comparative Analysis of Reviewed Systems

**Table 2.2: Comparison of reviewed IoT health monitoring systems against identified gaps.**

| Feature | Mohan et al. (2020) | Priyadarshini et al. (2021) | Anuradha et al. (2021) | Raju et al. (2022) | Kaur et al. (2019) | Commercial Platforms | MediMonitor (This Project) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| SpO2 Monitoring | Yes | Yes | No | Yes | Yes | Yes | Yes |
| Heart Rate Monitoring | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Temperature Monitoring | No | Yes | Yes | No | Yes | Yes | Yes |
| Centralized Multi-Patient View | No | No | No | No | No | Partial | Yes |
| Per-Patient Thresholds | No | No | No | No | No | No | Yes |
| Trend Detection | No | No | No | No | No | Partial | Yes |
| AI Decision Support | No | No | No | Cloud-based | No | Cloud-based | Local/Offline |
| Data Privacy (AI) | N/A | N/A | N/A | Low | N/A | Low | High |
| SMS Alerting | No | No | Yes (Twilio) | No | No | Varies | Yes (Hubtel) |
| GPS Location in Alerts | No | No | No | No | No | No | Yes |
| Offline Reading Capture | No | No | No | No | No | No | Yes (PWA) |
| Role-Based Access | No | No | No | No | No | Yes | Yes (3 roles) |
| Session Notes | No | No | No | No | No | Partial | Yes |
| Low Hardware Cost | Yes | Moderate | Moderate | Moderate | High | Very High | Yes |

## 2.12 Chapter Summary
This chapter has reviewed the current state of IoT-based remote patient monitoring through an examination of both academic research and commercial platforms. The review identified five principal gaps: device fragmentation and the lack of centralized patient views, the use of static population-level thresholds, the absence of trend-based alerting, the lack of privacy-preserving local AI for clinical decision support, and the absence of offline capability with background synchronization.

The MediMonitor system is designed to address all five of these gaps within a single, integrated platform. It provides a centralized web-based dashboard that aggregates data from all monitored patients. It supports clinician-configurable per-patient thresholds. It implements trend detection logic that evaluates directional change across recent readings. It integrates a local, offline AI model via WebLLM that provides clinical classification and patient briefings without transmitting data to external servers. And it implements Progressive Web App offline capability that allows readings to be captured and queued during network outages.

Chapter Three will describe the methodology and system architecture used to implement these features.
