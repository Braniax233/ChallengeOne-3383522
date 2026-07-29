# CHAPTER ONE
# INTRODUCTION

## 1.1 Background of the Study
The integration of Internet of Things (IoT) technologies into healthcare has gradually changed what continuous patient monitoring looks like outside the hospital ward. Sensors embedded in small, wearable devices can now measure physiological parameters such as blood oxygen saturation (SpO2), heart rate, and body temperature, pushing those readings to a remote server in real time. For countries like Ghana, where specialist services are concentrated in urban centres and many patients in rural or peri-urban communities have limited access to regular clinical review, this kind of remote monitoring carries practical significance beyond its technical novelty. 

However, existing healthcare facilities face a major challenge with the fragmentation of medical devices. Most hospitals rely on standalone bedside monitors that do not communicate with one another or feed into a central, accessible platform. This creates data silos where a patient's vital signs are only visible to the nurse standing directly in front of the machine. When patient data is fragmented across different unconnected devices, it becomes nearly impossible for doctors to get a holistic, real-time view of a patient's condition, especially when they are managing multiple wards or monitoring patients remotely.

Furthermore, existing IoT-based monitoring systems are typically built around fixed population-level thresholds. A single SpO2 cut-off, for example, is applied to every patient on the platform regardless of their underlying condition. This is a recognised clinical problem. A patient living with chronic obstructive pulmonary disease may function normally at oxygen saturation levels that would indicate an emergency in a healthy adult. Applying one universal alert boundary to both individuals generates false alarms for the COPD patient and may miss clinically important drops in others whose baseline is naturally higher. The result is alert fatigue on the clinician side and degraded confidence in the monitoring system overall. 

A less-discussed but equally important limitation is the absence of trend detection and predictive intelligence. Most systems only compare a single reading against a fixed boundary. They do not consider whether a patient's values have been drifting steadily downward over the past thirty minutes. Current systems cannot distinguish between a stable reading and a rapidly deteriorating one because they discard the temporal relationship between readings. 

There is also a gap in clinical documentation and modern Artificial Intelligence (AI) assistance. When a clinician reviews a patient, there is rarely a mechanism to record observations directly alongside the sensor data. More importantly, while AI has shown massive potential in healthcare, most existing AI diagnostic tools rely on cloud-based processing. Sending sensitive patient vitals to third-party cloud AI servers raises severe data privacy and HIPAA compliance concerns. 

This project addresses these gaps by building a unified remote medical monitoring system developed by Kofi Abordo Benyah and Zulfawu Mohammed as a final year BSc Computer Science project at KNUST. The system solves device fragmentation by centralizing patient data into a single web-based platform. It centres on the principles that thresholds should be set per patient, trends should be actively monitored, and AI should be brought directly to the clinician securely. The hardware utilizes an ESP12E microcontroller paired with a MAX30102 pulse oximeter and a GY-906 temperature sensor. The software features a React.js web application backed by Firebase. Crucially, it integrates a powerful, offline local AI model running entirely in the browser to provide instant clinical triage and patient summaries without ever sending medical data to external servers, making it stand out significantly from existing market solutions.

## 1.2 Problem Statement
Healthcare providers managing patients with chronic or post-acute conditions need reliable, continuous visibility of vital signs when those patients are not physically present in a clinic. A review of current IoT healthcare monitoring systems reveals that the current generation of platforms falls short of this requirement in several specific ways. 

First, device fragmentation in hospitals severely limits the effectiveness of continuous monitoring. Vital sign monitors are largely unconnected, meaning doctors cannot track a patient's historical trends or receive remote alerts unless they are physically in the ward. 

Second, threshold values in existing systems are drawn from general population standards and cannot be adjusted per patient. This means the system cannot account for individuals whose normal physiological baseline falls outside the standard range, leading to both missed events and unnecessary alerts. 

Third, no current system evaluates reading trends over time. Platforms compare each incoming measurement against a fixed boundary and respond only if that boundary is crossed. A patient whose SpO2 has dropped four percentage points in twenty minutes receives no alert, even though a clinician reviewing that sequence manually would recognise it as a deterioration pattern requiring attention. 

Fourth, the integration of Artificial Intelligence in current market solutions is severely hindered by privacy constraints. Systems that offer AI analysis usually send patient data to remote third-party servers like OpenAI or Google, violating strict medical data privacy laws. There is a lack of platforms offering private, on-device AI analysis to assist doctors with mild classification and quick patient briefings.

Fifth, emergency alert systems often do not include location data. When a critical alert fires for a home-monitored patient, the clinician or emergency contact receives a notification with no indication of where the patient is physically located. This limits the practical utility of the alert when emergency services need to be dispatched. 

Finally, connectivity dependency in home monitoring remains unresolved. Current IoT monitoring platforms require continuous internet connectivity to submit readings. In Ghana's rural and peri-urban environments where network coverage is intermittent, a patient who loses connectivity at the moment of reading capture loses that data entirely.

## 1.3 Objectives of the Study

### 1.3.1 Main Objective
To design and implement a unified, IoT-based remote medical monitoring system that centralizes patient data, supports clinician-configured personalised thresholds, detects reading trends over time, and integrates a privacy-preserving offline AI model to assist doctors with mild classification, alongside automated location-tagged SMS alerts and offline-resilient data capture.

### 1.3.2 Specific Objectives
1. To design and build an IoT device using an ESP12E microcontroller, MAX30102 pulse oximeter, and GY-906 temperature sensor to capture real-time vitals and combat device fragmentation.
2. To implement a three-role authentication system for Clinicians, Healthcare Providers, and Patients using Firebase Authentication.
3. To develop a patient identification system using barcode scanning and membership ID input for clinical accuracy.
4. To implement a BMI calculator integrated into patient records for clinical assessment and threshold recommendations.
5. To develop a clinician-configurable threshold system with default clinical ranges adjustable per patient.
6. To implement a trend-based alerting engine that evaluates directional change across recent readings and escalates alert levels before absolute thresholds are crossed.
7. To develop a session notes feature that allows clinicians to attach observations to consultation records within the monitoring platform.
8. To integrate a private, offline local AI model (WebLLM) running directly in the browser to provide instant 10-second patient briefings, AI clinical classification, and triage assistance without compromising data privacy.
9. To build a tiered alert system distinguishing between Warning (in-app notification) and Critical (SMS and GPS alert).
10. To integrate browser-based GPS location tracking into emergency SMS alerts via the Hubtel API.
11. To implement Progressive Web App (PWA) offline capability allowing home monitoring patients to capture readings without internet connectivity, with automatic background synchronization to Firebase when connectivity is restored.

## 1.4 Research Questions
1. How can an IoT system resolve device fragmentation by centralizing SpO2, heart rate, and temperature data into a unified, accessible platform?
2. How can an IoT system be designed to support clinician-configured, patient-specific threshold monitoring?
3. How can a trend-based alerting engine be implemented to detect directional deterioration before absolute threshold boundaries are crossed?
4. How can an offline, browser-based AI model be successfully integrated to provide doctors with mild classification and clinical insights without sending sensitive data to third-party servers?
5. How can GPS location be integrated into Hubtel SMS alerts to improve emergency response in home monitoring scenarios?
6. How can offline reading capture and background synchronization be implemented to ensure that home monitoring continues uninterrupted in low-connectivity environments?

## 1.5 Significance of the Study
This study makes significant contributions across clinical practice, technology, local context, and academic research. 

Clinically, the introduction of a centralized platform solves the widespread issue of device fragmentation in hospitals, allowing doctors to view comprehensive patient data from anywhere. The use of per-patient configurable thresholds reduces the false alert rate that accompanies population-level boundaries. The addition of trend-based alerting means that clinicians receive earlier warning of deterioration. 

Technologically, this project stands out in the market through its integration of a local, offline AI model. By running a Large Language Model directly in the browser, the system provides advanced clinical decision support, mild anomaly classification, and triage analysis while guaranteeing 100% data privacy. This is a massive leap forward compared to existing market solutions that compromise patient confidentiality by relying on cloud AI APIs.

Within the Ghanaian healthcare context, the use of Hubtel SMS ensures that emergency alerts reach clinicians and emergency contacts through infrastructure that is already well-established locally. Furthermore, the inclusion of Progressive Web App offline capabilities ensures the system functions reliably in both urban and rural settings where consistent internet access may not always be available. 

## 1.6 Scope and Delimitation of the Study

### 1.6.1 Scope
The system monitors SpO2, heart rate, and body temperature as its primary vital signs, using an ESP12E microcontroller, a MAX30102 pulse oximeter, and a GY-906 temperature sensor. The software platform supports three role-authenticated user types: Clinician, Healthcare Provider, and Home Monitoring Patient. 

Core system capabilities include clinician-configurable per-patient thresholds with BMI-informed recommendations, a trend-based alerting engine, automated Normal, Warning, and Critical status classification, and Hubtel SMS escalation with real-time GPS location tagging. The platform also includes a session notes feature attached to clinician consultation records, historical vital sign logging, and BMI calculation.

Crucially, the scope includes an integrated offline AI assistant powered by WebLLM, which runs securely in the browser to analyze vitals, provide brief clinical summaries, and offer mild classification insights to assist the doctor. The system also includes a Progressive Web App (PWA) offline mode that allows patients to queue captured readings locally when the internet is down and automatically sync them to Firebase once connectivity returns. 

### 1.6.2 Delimitations
* The system monitors SpO2, heart rate, and temperature only. Blood pressure, ECG, and respiratory rate are not included in this phase and are identified as future extensions.
* Clinical validation through formal hospital trials with enrolled patients under ethics board approval is outside the scope of this BSc project. Evaluation will be conducted through controlled prototype testing.
* The system is delivered as a responsive web browser application. A dedicated native mobile application for Android or iOS from the app stores is not included in this phase, as the PWA approach sufficiently covers mobile accessibility.
* Offline buffering at the firmware level where the ESP12E device itself stores readings locally is deferred to future work. Offline capability in this project is instead implemented at the application layer through the PWA for spot-check readings.
* The AI classifications and triage insights provided by the local LLM are designed to assist and augment the doctor's workflow, not to replace professional medical judgement or serve as a standalone diagnostic tool.

## 1.7 Brief Methodology
The project follows a development-based research approach executed across five phases:

1. Requirements Analysis: Literature review of IoT healthcare systems to identify capability gaps, specifically regarding device fragmentation, trend detection, and privacy-preserving AI.
2. Hardware Design: Development of the ESP12E, MAX30102, and GY-906 based monitoring device, including firmware for continuous reading capture and Wi-Fi transmission.
3. Software Development: Implementation of the React.js frontend, Firebase Realtime Database integration, Firebase Authentication, and the trend detection engine. This phase also covers the integration of the WebLLM offline AI model, Hubtel SMS service, and Progressive Web App offline synchronization.
4. System Integration: Integration of the IoT device, web application, local AI, Hubtel SMS, and browser-based GPS into a unified operational system.
5. Evaluation: Testing of measurement accuracy, trend detection responsiveness, AI classification relevance, alert performance, and overall usability.

## 1.8 Organisation of the Report
The remainder of this report is structured as follows:
* Chapter Two presents a review of related IoT healthcare monitoring systems, synthesising their approaches and identifying the gaps that motivate this project.
* Chapter Three describes the system methodology, overall architecture, and the key design decisions that shaped the implementation.
* Chapter Four covers the detailed system design, including data flow diagrams, the database structure, schematic diagrams, and UI design specifications.
* Chapter Five documents the implementation of both hardware and software components, including the offline AI model and Progressive Web App features.
* Chapter Six presents the testing approach, results, and evaluation findings, including usability and system performance.
* Chapter Seven concludes the report with a discussion of limitations, research contributions, and directions for future work.
