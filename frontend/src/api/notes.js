import { ref, get, push, set } from 'firebase/database';
import { rtdb } from './firebase';

export async function getNotes(patientId) {
  const snap = await get(ref(rtdb, `notes/${patientId}`));
  if (!snap.exists()) return [];
  const notes = [];
  snap.forEach((child) => {
    notes.push({ _id: child.key, ...child.val() });
  });
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addNote(patientId, noteData) {
  const newRef = push(ref(rtdb, `notes/${patientId}`));
  const note = {
    ...noteData,
    createdAt: Date.now(),
  };
  await set(newRef, note);
  return { _id: newRef.key, ...note };
}
