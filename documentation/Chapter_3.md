# CHAPTER THREE

# METHODOLOGY

## 3.1 Introduction

This chapter presents the methodology adopted for the design, development, and evaluation of MediMonitor, an IoT-based remote medical monitoring system. It describes the research approach, the system architecture, the rationale behind hardware and software design choices, and the strategies employed for data classification, artificial intelligence integration, offline operation, deployment, and testing. The purpose of this chapter is to provide a clear and reproducible account of how each component of the system was conceived, built, and validated. By detailing the methods used at every stage of development, this chapter establishes the technical foundation upon which the results presented in later chapters are built.

## 3.2 Research Approach

The research approach adopted for this project is development-based research, which centres on the creation of a functional artifact (in this case, a complete IoT health monitoring system) as the primary means of investigating the research problem. Unlike purely theoretical or survey-based approaches, development-based research produces a working system that can be evaluated against defined requirements and performance criteria. This approach is well suited to Computer Science projects where the contribution lies in the design, implementation, and demonstration of a novel or improved technical solution.

Within this broader approach, the Rapid Application Development (RAD) methodology was selected to guide the software development lifecycle. RAD is an iterative development framework that emphasises short development cycles, continuous prototyping, and regular user feedback over rigid upfront planning (Martin, 1991). The RAD methodology organises development into four main phases: requirements planning, user design, construction, and cutover.

RAD was chosen for several reasons specific to this project. First, the system spans multiple domains, including embedded hardware, cloud databases, web application development, and on-device AI, and it was not possible to fully specify all requirements at the outset. Iterative prototyping allowed the team to discover integration issues early and adjust the design accordingly. For instance, the original backend architecture was planned around a MongoDB database with a Node.js Express REST API, but during prototyping it became clear that Firebase Realtime Database offered significant advantages for direct microcontroller communication, real-time synchronisation, and managed authentication. The RAD approach made it straightforward to pivot to this new architecture without derailing the project timeline.

Second, the hardware component required a trial-and-error approach. Sensor readings needed to be calibrated, sampling parameters tuned, and communication protocols tested on physical breadboard prototypes. RAD's emphasis on working prototypes over documentation-heavy planning aligned naturally with this kind of hands-on experimentation.

Third, the web application needed to support three distinct user roles (Clinician, Healthcare Provider, and Patient), each with different interface requirements. Building the frontend iteratively, starting with core data display and progressively adding role-specific features, AI integration, and offline support, allowed each feature to be tested in isolation before being integrated into the larger system.

## 3.3 System Architecture Overview

MediMonitor follows a three-tier IoT architecture, which is a widely adopted pattern for connected health systems. The three tiers are the Perception Layer, the Network Layer, and the Application Layer. This layered architecture promotes modularity, making it possible to modify or replace components in one layer without affecting the others.

### 3.3.1 Perception Layer

The Perception Layer is responsible for collecting physiological data from the patient. It consists of the ESP-12E microcontroller (based on the NodeMCU 1.0 platform and the ESP8266 Wi-Fi SoC), the MAX30102 pulse oximeter sensor, and the GY-906 (MLX90614) infrared thermometer. The ESP-12E serves as the central processing unit at this layer. It initialises the sensors, collects raw readings, runs the signal processing algorithms to compute heart rate, blood oxygen saturation (SpO2), and body temperature, and then formats the processed data for transmission. The sensors communicate with the ESP-12E over the I2C (Inter-Integrated Circuit) bus, a two-wire serial protocol that allows multiple peripherals to share a single data line (SDA) and clock line (SCL).

The firmware, written in C++ using the Arduino IDE, follows a straightforward operational loop. On boot, the microcontroller connects to a configured Wi-Fi network, initialises its Firebase connection, and then initialises each sensor. Once initialised, it enters its main loop: it waits for a finger to be placed on the MAX30102 sensor (detected when the infrared signal exceeds a threshold of 50,000), collects 50 samples of red and infrared light intensity, runs the SparkFun maxim_heart_rate_and_oxygen_saturation algorithm to derive heart rate and SpO2 values, reads the object temperature from the GY-906, packages the results into a JSON object, and writes this object to the Firebase Realtime Database at the path /vitals/latest. The system then waits 30 seconds before repeating the cycle. The first five seconds of sensor data after finger placement are discarded to allow the readings to stabilise.

### 3.3.2 Network Layer

The Network Layer handles the transmission of data from the Perception Layer to the cloud and the subsequent delivery of that data to end-user applications. MediMonitor uses the ESP-12E's built-in Wi-Fi capability to connect to a local wireless network. From there, the FirebaseESP8266 library provides a lightweight HTTPS client that writes JSON payloads directly to the Firebase Realtime Database.

Firebase Realtime Database was selected as the cloud data store. It is a NoSQL, JSON-structured database hosted and managed by Google. Its key advantage for this project is its real-time synchronisation capability: when the ESP-12E writes a new reading to /vitals/latest, all connected web clients receive the updated data within milliseconds via persistent WebSocket connections. This eliminates the need for the frontend to poll the server and enables a genuinely live monitoring experience. Firebase also provides built-in authentication services, which are used to manage user accounts and enforce access control.

### 3.3.3 Application Layer

The Application Layer is the interface through which clinicians, healthcare providers, and patients interact with the system. It is implemented as a React.js single-page application (SPA) built with the Vite build tool. The web application reads patient vital signs from Firebase in real time, displays them through interactive dashboards and charts, applies classification logic to flag abnormal readings, and provides AI-powered clinical decision support through a locally running language model. The application is designed as a Progressive Web App (PWA), which means it can be installed on a device, cache its core assets for offline use, and queue readings taken while offline for synchronisation when connectivity is restored.

## 3.4 Hardware Design Methodology

### 3.4.1 Microcontroller Selection

The ESP-12E (NodeMCU 1.0) was selected as the project's microcontroller. It is based on the Espressif ESP8266 Wi-Fi system-on-chip, which integrates a 32-bit Tensilica L106 processor running at 80 MHz, 4 MB of flash memory, and a full TCP/IP Wi-Fi stack. Several factors informed this choice over alternatives such as the ESP32.

First, the ESP-12E is widely available in Ghana and is significantly less expensive than the ESP32, which was an important consideration given the project's budget constraints. Second, the ESP8266 has mature library support for Firebase through the FirebaseESP8266 library, which simplified direct database writes from the microcontroller. Third, the project's I/O requirements are modest: only two I2C peripherals and a Wi-Fi connection. The ESP32's additional capabilities, such as Bluetooth Low Energy, dual-core processing, and a larger number of GPIO pins, were not needed for this application. Using a simpler microcontroller reduced complexity and cost without sacrificing any required functionality.

### 3.4.2 Sensor Selection

Two sensors were selected to capture three vital signs.

The MAX30102 is a reflectance-based pulse oximeter and heart rate sensor manufactured by Maxim Integrated. It contains red and infrared LEDs and a photodetector, all integrated into a single package with an I2C digital interface (address 0x57). It was chosen because it can measure both SpO2 and heart rate from a single fingertip contact point, it is widely used in wearable health devices, and well-documented open-source libraries (SparkFun MAX3010x) are available for signal processing. The sensor outputs raw red and infrared photoplethysmography (PPG) signals, which are processed by the maxim_heart_rate_and_oxygen_saturation algorithm to extract pulse rate and oxygen saturation values.

The GY-906, based on the Melexis MLX90614 infrared thermometer IC, was selected for non-contact body temperature measurement. It communicates over I2C at address 0x5A and provides factory-calibrated temperature readings with an accuracy of plus or minus 0.5 degrees Celsius in the relevant body temperature range. Non-contact measurement was preferred over contact-based alternatives (such as the DS18B20) for hygiene reasons, as the same device may be used across multiple patients in a clinical setting.

### 3.4.3 I2C Bus Design

Both sensors share the I2C bus on the ESP-12E's default SDA (D2) and SCL (D1) pins. Because the MAX30102 and GY-906 have different, non-conflicting I2C addresses (0x57 and 0x5A respectively), they can coexist on the same bus without requiring an I2C multiplexer. Pull-up resistors are integrated on the sensor breakout boards, so no external pull-ups were needed. This simple bus topology kept the wiring minimal and made the breadboard prototype straightforward to assemble and debug.

### 3.4.4 Prototyping Approach

The hardware was prototyped on a standard solderless breadboard. This approach was chosen because it allows rapid reconfiguration of wiring, easy replacement of components, and quick debugging during development. Components were connected using jumper wires, and the entire assembly was powered via the ESP-12E's micro-USB port. While a breadboard prototype is not suitable for long-term deployment (due to loose connections and lack of environmental protection), it is entirely appropriate for a proof-of-concept system intended to demonstrate feasibility.

## 3.5 Software Development Methodology

### 3.5.1 Frontend Framework and Tooling

The web application was built using React.js, a component-based JavaScript library for building user interfaces. React was chosen for its large ecosystem, its suitability for building single-page applications with complex state management, and the team's prior familiarity with it. Vite was used as the build tool and development server. Compared to older tools like Create React App (which uses Webpack), Vite offers significantly faster hot module replacement during development and optimised production builds, which improved the development experience throughout the project.

### 3.5.2 Component-Based Architecture

The application is structured as a tree of reusable React components. Each page (for example, the Clinician Dashboard, the Patient History page, or the Provider CaptureReading workflow) is a top-level component that composes smaller, focused components such as vital sign cards, sparkline charts, data tables, and form elements. This component-based approach promotes code reuse and makes the codebase easier to maintain. For instance, a SpO2 display card component is reused across the Clinician Dashboard, PatientDetail page, and Patient Dashboard, ensuring consistent presentation of oxygen saturation data throughout the application.

Data visualisation is handled by the Recharts library, which provides declarative, composable chart components that integrate naturally with React's rendering model. Charts are used extensively across the application to show health trends, historical readings, and live overviews.

### 3.5.3 State Management

Application-wide state is managed using React Context, a built-in mechanism for sharing data across the component tree without manually passing props through every level. Two primary contexts are used:

1. **AuthContext**: This context wraps the entire application and manages the current user's authentication state. It listens to Firebase Authentication's onAuthStateChanged observer, stores the authenticated user object and their role (retrieved from /users/{uid} in the Realtime Database), and provides login and logout functions to all components. Every component in the app can access the current user and their role through this context.

2. **WebLLMContext**: This context manages the lifecycle of the in-browser AI model. It provides an init() function to load and initialise the SmolLM2-135M-Instruct model, a chat() function to send prompts and receive completions, and an isReady flag that components can check before attempting to use the AI. By centralising AI state in a context, the model is loaded once and shared across all components that need it, rather than being loaded separately in each component.

### 3.5.4 Firebase as Backend-as-a-Service

Firebase serves as the project's entire backend infrastructure, replacing the originally planned MongoDB and Node.js Express stack. This decision was made during the prototyping phase for several compelling reasons. First, the FirebaseESP8266 library allows the ESP-12E to write data directly to the Realtime Database over HTTPS, eliminating the need for a custom REST API server to receive sensor data. Second, Firebase Realtime Database provides built-in WebSocket-based synchronisation, so the React frontend receives new readings in real time without any polling logic or custom WebSocket server. Third, Firebase Authentication provides a complete, production-ready authentication system with email and password support, removing the need to implement password hashing, session management, or token validation from scratch. Fourth, as a managed service, Firebase requires no server provisioning, patching, or scaling by the development team, which was a significant advantage given the project's time constraints.

## 3.6 Role-Based Access Control Design

MediMonitor implements a role-based access control (RBAC) system with three user roles: Clinician, Healthcare Provider, and Patient. Each role has access to a different set of pages and features, reflecting the different needs and responsibilities of each user type in a clinical workflow.

### 3.6.1 Role Storage and Retrieval

When a new user account is created, their role is stored in the Firebase Realtime Database at the path /users/{uid}, where {uid} is the unique identifier assigned by Firebase Authentication. The role is stored as a simple string field (for example, "clinician", "provider", or "patient"). On login, the AuthContext retrieves this role and makes it available throughout the application.

### 3.6.2 Route Protection

The application uses a ProtectedRoute component to enforce access control at the routing level. This component wraps each protected page and performs two checks before rendering the page content. First, it checks whether the user is authenticated by inspecting the AuthContext. If the user is not logged in, they are redirected to the login page. Second, it checks whether the user's role matches the role required by the requested route. If the roles do not match, the user is redirected to their own role's dashboard. This two-layer check ensures that, for example, a Patient cannot access Clinician pages even if they know the URL.

### 3.6.3 Role-Specific Layouts

Each role has its own layout component that provides role-appropriate navigation, sidebar items, and page structure. The Clinician layout includes navigation links to the Dashboard, Patient List, Alerts, Reports, and Settings pages. The Provider layout provides access to the Dashboard, Capture Reading workflow, and Patients list. The Patient layout offers a Dashboard, History, and Capture Reading page. This separation ensures that each user type sees only the features relevant to their role, reducing interface clutter and potential confusion.

## 3.7 Classification Engine Design

A core function of MediMonitor is to classify each vital sign reading as Normal, Warning, or Critical based on clinically informed thresholds. This classification drives the alert system and helps clinicians quickly identify patients who may need attention.

### 3.7.1 The classifyReading Function

The classification logic is implemented in a JavaScript function called classifyReading, which accepts three parameters: SpO2 (percentage), heart rate (beats per minute), and temperature (degrees Celsius). The function evaluates each parameter against predefined thresholds and returns the highest severity level found across all three.

The thresholds are defined as follows:

| Vital Sign | Critical | Warning | Normal |
|---|---|---|---|
| SpO2 | Below 90% | Below 94% | 94% and above |
| Heart Rate | Above 120 bpm or below 40 bpm | Above 100 bpm or below 60 bpm | 60 to 100 bpm |
| Temperature | 39.5°C and above or 35.0°C and below | 38.0°C and above or below 36.0°C | 36.0°C to 37.9°C |

These threshold values are based on widely accepted clinical ranges for adult vital signs. The classification function applies a "worst-case" logic: if any single parameter falls into the Critical range, the entire reading is classified as Critical, even if the other parameters are normal. Similarly, a Warning classification is assigned if any parameter is in the Warning range and none are Critical.

### 3.7.2 Configurable Thresholds

While the default thresholds are appropriate for the general adult population, individual patients may have baseline values that differ from population norms. For example, a well-trained athlete may have a resting heart rate below 60 bpm, which is normal for them but would trigger a Warning under the default thresholds. To accommodate this, MediMonitor allows clinicians to configure alert thresholds on a per-patient basis through the PatientDetail page. Custom thresholds, when set, override the defaults for that specific patient, reducing false alerts and improving the clinical relevance of the classification system.

## 3.8 AI Integration Methodology

### 3.8.1 Rationale for Local AI

A distinctive feature of MediMonitor is its integration of artificial intelligence for clinical decision support. However, rather than using a cloud-based AI service (such as OpenAI's API or Google's Gemini API), the project runs a language model entirely within the user's web browser. This decision was driven primarily by privacy concerns. Patient health data is sensitive and subject to data protection regulations. Sending vital signs, patient names, or clinical notes to a third-party AI service introduces data governance risks that are difficult to manage, especially in a healthcare context. By running the AI model locally, no patient data ever leaves the user's device. This "privacy by design" approach eliminates an entire category of data breach risk.

A secondary consideration was cost and availability. Cloud AI APIs charge per request, which would impose ongoing costs on a system intended for resource-constrained healthcare settings. A locally running model, once downloaded, operates without any per-query cost and does not require an internet connection to function.

### 3.8.2 WebLLM and WebGPU

The in-browser AI is powered by the @mlc-ai/web-llm library, which compiles large language models to run natively in the browser using the WebGPU API. WebGPU is a modern web standard that provides low-level access to the device's graphics processing unit (GPU), enabling the kind of parallel computation that language model inference requires. When a user first loads MediMonitor on a device with a WebGPU-capable browser, the model weights are downloaded and cached locally by the browser. On subsequent visits, the model loads directly from the cache, eliminating the need to re-download it.

### 3.8.3 Model Selection

The SmolLM2-135M-Instruct-q0f32-MLC model was selected for this project. SmolLM2 is a compact, instruction-tuned language model with 135 million parameters. The "q0f32" suffix indicates that the model uses 32-bit floating point quantisation, which preserves inference quality at the cost of a larger download size compared to more aggressively quantised variants. This model was chosen because it is small enough to load and run in a browser on a standard laptop or desktop computer, yet capable enough to generate coherent, contextually relevant clinical summaries and classifications when given structured prompts.

### 3.8.4 AI Use Cases

The AI model is used in four specific features within MediMonitor:

1. **Clinician AI Assistant**: On the PatientDetail page, clinicians can request a 10-second patient briefing that summarises the patient's recent vital signs, trends, and any alerts. They can also ask follow-up clinical questions through an interactive chat interface.

2. **Alert Triage**: On the Alerts page, clinicians can trigger an AI Triage analysis for any alert. The model evaluates the alert's vital sign values and provides a severity assessment with suggested clinical actions.

3. **Session Note Enhancement**: When a clinician writes a session note on the PatientDetail page, they can use the AI Enhance feature to expand their brief notes into a more structured clinical note format.

4. **Clinical Classification**: In the Provider's CaptureReading workflow, after a reading is captured, the AI provides a clinical classification of the results, identifying conditions such as mild hypoxia, moderate tachycardia, or fever based on the measured values.

In all four cases, the prompts are constructed programmatically by embedding the relevant vital sign data into a template prompt. The model's response is then displayed to the user within the relevant interface component.

## 3.9 Offline Capability Design

Reliable internet connectivity cannot be assumed in all clinical settings, particularly in rural or underserved areas. MediMonitor addresses this through a Progressive Web App (PWA) architecture that provides meaningful offline functionality.

### 3.9.1 Service Worker and App Shell Caching

A Service Worker is registered when the application first loads. The Service Worker intercepts network requests and serves cached responses when the network is unavailable. The application's core assets (HTML, CSS, JavaScript bundles, and static images) are cached during the Service Worker's install phase, forming what is known as the "app shell." This means the application's interface loads and is usable even when the device has no internet connection.

### 3.9.2 Offline Reading Queue

When a user (typically a Provider or Patient) captures a vital sign reading while offline, the saveReading() function detects the absence of network connectivity by checking the navigator.onLine property. Instead of attempting a Firebase write that would fail, the function serialises the reading as a JSON object and appends it to a queue stored in the browser's localStorage. This queue persists across browser restarts, so readings are not lost if the device is powered off before connectivity is restored.

### 3.9.3 Background Synchronisation

The main App.jsx component registers a listener for the browser's "online" event, which fires when network connectivity is restored. When this event is detected, the application calls the syncOfflineReadings() function, which iterates through the localStorage queue and writes each queued reading to Firebase. Successfully synchronised readings are removed from the queue. This approach ensures that no data is lost during periods of disconnection, and readings eventually reach the central database without manual intervention from the user.

## 3.10 Deployment Strategy

### 3.10.1 Frontend Deployment

The React web application is deployed on Vercel, a cloud platform optimised for frontend frameworks. Vercel was selected for its seamless integration with GitHub, its support for automatic deployments, and its generous free tier, which is sufficient for a project of this scale. The deployment pipeline works as follows: the project's source code is hosted in a GitHub repository. Vercel is connected to this repository and configured to monitor the master branch. When new commits are pushed to master (either directly or through a merged pull request), Vercel automatically triggers a new build. It runs the Vite build process, generates optimised static assets, and deploys them to its global CDN. This continuous integration and continuous deployment (CI/CD) setup means that every code change is automatically tested, built, and deployed without manual intervention.

### 3.10.2 Database Hosting

The Firebase Realtime Database is hosted and managed entirely by Google's Firebase infrastructure. It requires no provisioning, scaling, or maintenance by the development team. Firebase provides automatic scaling, data replication, and 99.95% uptime SLA on paid plans. For this project, the free Spark plan was used during development, which provides sufficient capacity for prototyping and testing.

### 3.10.3 Firmware Deployment

The ESP-12E firmware is compiled using the Arduino IDE and uploaded to the microcontroller via USB serial connection. Unlike the web application, the firmware does not have an automated deployment pipeline. Updates require physical access to the device and a manual upload through the Arduino IDE. For a production version of the system, over-the-air (OTA) firmware updates would be considered, but this was deemed unnecessary for the current proof-of-concept stage.

## 3.11 Testing Methodology

A multi-faceted testing strategy was employed to validate the system across its hardware, software, and user experience dimensions.

### 3.11.1 Unit Testing

Individual software components were tested in isolation to verify their correctness. The classifyReading function, for example, was tested with a range of input values covering normal, warning, and critical ranges for each vital sign, as well as edge cases at the boundaries between classification levels. React components were tested to ensure they render correctly with various props and respond appropriately to user interactions. These tests help catch regressions when code is modified and provide confidence that individual building blocks function correctly before they are integrated.

### 3.11.2 Integration Testing

Integration tests were conducted to verify that the system's components work together correctly. Key integration points include the ESP-12E writing data to Firebase, the React frontend receiving and displaying that data in real time, the authentication flow from login through to role-based routing, and the offline queue and synchronisation cycle. These tests were performed manually by operating the complete system end-to-end and observing the data flow through each layer.

### 3.11.3 Sensor Accuracy Benchmarking

The accuracy of the MAX30102 and GY-906 sensors was evaluated by comparing their readings against reference medical devices. Heart rate and SpO2 readings from the MAX30102 were compared with those from a commercially available, FDA-cleared pulse oximeter. Temperature readings from the GY-906 were compared with a clinical-grade digital thermometer. Multiple readings were taken from several volunteers under controlled conditions, and the mean absolute error and standard deviation were calculated to quantify the sensors' accuracy relative to the reference devices.

### 3.11.4 Usability Testing

Usability testing was planned using the System Usability Scale (SUS), a widely used, standardised questionnaire for assessing the perceived usability of a system (Brooke, 1996). The SUS consists of ten statements rated on a five-point Likert scale, producing a single composite score between 0 and 100. A score above 68 is generally considered above average usability. Test participants, drawn from healthcare professionals and patients, were asked to perform a set of representative tasks (such as viewing a patient's vital signs, capturing a new reading, and reviewing alerts) and then complete the SUS questionnaire. The results provide a quantitative measure of the system's usability and highlight areas for improvement.

### 3.11.5 Performance Testing

The web application's performance was evaluated using Google's Lighthouse auditing tool, which measures metrics such as First Contentful Paint, Time to Interactive, and Total Blocking Time. The AI model's inference speed was measured by timing the interval between sending a prompt and receiving a complete response. These performance measurements ensure that the application is responsive enough for real-time clinical use.

## 3.12 Chapter Summary

This chapter has detailed the methodology employed in the design and development of MediMonitor. The project follows a development-based research approach using the Rapid Application Development methodology, which allowed iterative prototyping and flexible adaptation to emerging requirements. The system architecture is organised into three IoT layers: a Perception Layer comprising the ESP-12E microcontroller with MAX30102 and GY-906 sensors, a Network Layer built on Wi-Fi and Firebase Realtime Database, and an Application Layer implemented as a React.js Progressive Web App with in-browser AI capabilities.

Key design decisions were discussed in detail, including the selection of the ESP-12E over the ESP32 for cost and simplicity, the pivot from a custom MongoDB and Node.js backend to Firebase for its direct microcontroller integration and real-time synchronisation, the implementation of role-based access control for three user types, the design of a threshold-based vital sign classification engine, and the adoption of local AI inference via WebLLM to protect patient data privacy. The chapter also described the offline capability design, the CI/CD deployment pipeline, and the multi-dimensional testing strategy encompassing unit tests, integration tests, sensor accuracy benchmarking, usability evaluation, and performance measurement. The next chapter presents the implementation details and the results obtained from the testing programme described here.
