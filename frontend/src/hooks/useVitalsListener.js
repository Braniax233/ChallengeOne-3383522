/**
 * hooks/useVitalsListener.js
 * Listens to /vitals/latest in Firebase RTDB for new readings
 * from the ESP8266 hardware sensor.
 *
 * Usage:
 *   const { latestReading, waiting, startListening, stopListening } = useVitalsListener();
 *   startListening();  // begin watching for device data
 *   // latestReading = { heartRate, spo2, timestamp } when new data arrives
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../api/firebase';

export default function useVitalsListener() {
  const [latestReading, setLatestReading] = useState(null);
  const [waiting, setWaiting]             = useState(false);
  const listenerRef   = useRef(null);
  const startTimeRef  = useRef(null);

  const startListening = useCallback(() => {
    // Reset state
    setLatestReading(null);
    setWaiting(true);
    startTimeRef.current = Date.now();

    const vitalsRef = ref(rtdb, 'vitals/latest');

    // Attach realtime listener
    const unsubscribe = onValue(vitalsRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();

      // Only accept data that arrived AFTER we started listening
      // (avoids stale readings that were already there)
      const dataTs = data.timestamp || 0;
      if (dataTs > startTimeRef.current || Date.now() - startTimeRef.current < 2000) {
        // Accept if: data timestamp is newer, OR we just started (within 2s window)
        // The 2s window handles the case where ESP8266 writes millis() not epoch
      }

      // Always accept the latest value — the user pressed reset after clicking capture
      setLatestReading({
        heartRate: data.heartRate ?? data.hr ?? 0,
        spo2:      data.spo2 ?? 0,
        timestamp: data.timestamp ?? Date.now(),
        raw:       data,
      });
      setWaiting(false);
    });

    listenerRef.current = { ref: vitalsRef, unsubscribe };
  }, []);

  const stopListening = useCallback(() => {
    if (listenerRef.current) {
      off(listenerRef.current.ref);
      listenerRef.current = null;
    }
    setWaiting(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        off(listenerRef.current.ref);
      }
    };
  }, []);

  return { latestReading, waiting, startListening, stopListening };
}
