/**
 * api/sms.js
 * SasuSync SMS API helper for MediMonitor.
 *
 * Endpoint: POST https://sms.sasusync.com/api/v1/send
 * Header:   X-API-Key: <your key>
 * Body:     { sender, recipients: ["+233..."], message }
 *
 * All Ghanaian numbers must be in international format: 233XXXXXXXXX
 */

const SASUSYNC_API_KEY = "ss_ae1532ce19a2928d402d701b8477d688b05061109abdfe04bdf9481e108e69fa";
const SASUSYNC_BASE    = "/api/sasusync"; // Proxied by Vite locally and Vercel in production
const SENDER_ID        = "Vitalx"; // The name recipients see on their phone

/**
 * Normalize a Ghanaian phone number to international format (233XXXXXXXXX).
 * Accepts: 0XXXXXXXXX, +233XXXXXXXXX, 233XXXXXXXXX
 * Returns null if the number is missing or unrecognizable.
 */
function normalizeGhanaNumber(phone) {
  if (!phone || typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, ""); // strip everything except digits
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0")   && digits.length === 10) return "233" + digits.slice(1);
  if (digits.length === 9) return "233" + digits; // bare 9-digit number
  return null;
}

/**
 * Send an SMS via SasuSync.
 * @param {string|string[]} recipients  Phone number(s) – any Ghanaian format.
 * @param {string}          message     The SMS text to send.
 * @returns {{ success: boolean, error?: string }}
 */
export async function sendSMS(recipients, message) {
  const numbers = (Array.isArray(recipients) ? recipients : [recipients])
    .map(normalizeGhanaNumber)
    .filter(Boolean);

  if (numbers.length === 0) {
    return { success: false, error: "No valid phone numbers provided." };
  }

  try {
    const res = await fetch(SASUSYNC_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": SASUSYNC_API_KEY,
      },
      body: JSON.stringify({
        sender: SENDER_ID,
        recipients: numbers,
        message,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.detail || data?.message || `HTTP ${res.status}`;
      console.error("[SasuSync] Error:", errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true, data };
  } catch (err) {
    console.error("[SasuSync] Network error:", err);
    return { success: false, error: "Network error. Could not reach the SMS gateway." };
  }
}

/**
 * Build a fallback (non-AI) alert message.
 */
function buildFallbackMessage(patient, reading, location) {
  const status = (reading.status || "WARNING").toUpperCase();
  const urgency = status === "CRITICAL" ? "URGENT" : "Warning";
  const locStr  = location
    ? ` Location: https://maps.google.com/?q=${location.lat.toFixed(5)},${location.lng.toFixed(5)}`
    : "";

  return (
    `[MediMonitor ${urgency}] ${patient.name} has an abnormal reading. ` +
    `HR: ${reading.heartRate} bpm, SpO2: ${reading.spo2}%, ` +
    `Temp: ${(reading.temperature || 0).toFixed(1)}°C. ` +
    `Please seek medical attention immediately.` +
    locStr
  );
}

/**
 * Build an AI-enhanced alert message.
 * Falls back to template if AI takes too long or fails.
 */
async function buildAIMessage(patient, reading, location, chatFn) {
  if (!chatFn) return null;

  try {
    const status = (reading.status || "WARNING").toUpperCase();
    const prompt =
      `You are an emergency medical SMS assistant. Write a short, clear SMS alert for a patient named ${patient.name}. ` +
      `Their vitals are: Heart Rate ${reading.heartRate} bpm, SpO2 ${reading.spo2}%, ` +
      `Temp ${(reading.temperature || 0).toFixed(1)}°C. Status: ${status}. ` +
      `Keep it under 120 characters. Be calm but urgent. Do not add disclaimers.`;

    // Race the AI against a 6 second timeout
    const aiResponse = await Promise.race([
      chatFn(prompt, "Write an SMS alert."),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
    ]);

    if (!aiResponse) return null;

    // Append location if available
    const locStr = location
      ? ` Location: https://maps.google.com/?q=${location.lat.toFixed(5)},${location.lng.toFixed(5)}`
      : "";

    return `[MediMonitor] ${aiResponse.trim()}${locStr}`;
  } catch {
    return null; // Fall back to template
  }
}

/**
 * sendSmartAlert — The main function.
 * Reads the patient's SMS settings, gets their location if allowed,
 * builds a message (AI-enhanced if available), and sends to all contacts.
 *
 * @param {object}   patient    – { uid, name, phone }
 * @param {object}   reading    – { heartRate, spo2, temperature, status }
 * @param {object}   settings   – The patient's SMS settings (from getSmsSettings)
 * @param {function|null} chatFn – The WebLLM chat() function, or null if AI is not ready
 * @param {object|null}  location – { lat, lng } already fetched, or null
 * @returns {Promise<void>}
 */
export async function sendSmartAlert(patient, reading, settings, chatFn = null, location = null) {
  if (!settings?.enabled) return;

  const status = (reading.status || "NORMAL").toUpperCase();
  if (status === "NORMAL") return;
  if (status === "WARNING"  && !settings.notifyOnWarning)  return;
  if (status === "CRITICAL" && !settings.notifyOnCritical) return;

  // Collect all recipient numbers: patient's own phone + all added contacts
  const recipients = [];
  if (patient.phone) recipients.push(patient.phone);
  for (const c of settings.contacts || []) {
    if (c.phone) recipients.push(c.phone);
  }
  if (recipients.length === 0) return;

  // Build message
  let message;
  if (chatFn) {
    message = await buildAIMessage(patient, reading, location, chatFn);
  }
  if (!message) {
    message = buildFallbackMessage(patient, reading, location);
  }

  // Send to all recipients
  await sendSMS(recipients, message);
}

/**
 * Send a plain alert SMS to a patient (used manually from Alerts page).
 */
export async function sendAlertSMS(patient, reading) {
  const status = (reading.status || "WARNING").toUpperCase();
  const emoji  = status === "CRITICAL" ? "URGENT" : "Warning";

  const message =
    `[MediMonitor ${emoji}] Dear ${patient.name}, ` +
    `an abnormal vital sign has been detected. ` +
    `HR: ${reading.heartRate} bpm, SpO2: ${reading.spo2}%, ` +
    `Temp: ${(reading.temperature || 0).toFixed(1)}°C. ` +
    `Please consult your clinician immediately.`;

  return sendSMS(patient.phone, message);
}

/**
 * Send an alert SMS to the clinician on duty.
 */
export async function sendClinicianAlertSMS(clinicianPhone, patient, reading) {
  const status = (reading.status || "WARNING").toUpperCase();

  const message =
    `[MediMonitor Alert] PATIENT: ${patient.name} (ID: ${patient.memberId || "N/A"}) ` +
    `has a ${status} reading. ` +
    `HR: ${reading.heartRate} bpm, SpO2: ${reading.spo2}%, ` +
    `Temp: ${(reading.temperature || 0).toFixed(1)}°C. ` +
    `Please review on the dashboard.`;

  return sendSMS(clinicianPhone, message);
}

