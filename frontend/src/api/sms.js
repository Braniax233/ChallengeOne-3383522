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
const SASUSYNC_BASE    = "https://sms.sasusync.com/api/v1";
const SENDER_ID        = "MediMonitor"; // The name recipients see on their phone

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
    const res = await fetch(`${SASUSYNC_BASE}/send`, {
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
 * Send an alert SMS to a patient's registered phone number.
 * Call this when a CRITICAL or WARNING reading is saved.
 *
 * @param {object} patient   – Must have: name, phone
 * @param {object} reading   – Must have: heartRate, spo2, temperature, status
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
 * @param {string} clinicianPhone  Clinician phone number.
 * @param {object} patient         Must have: name, memberId
 * @param {object} reading         Must have: heartRate, spo2, temperature, status
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
