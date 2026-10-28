// Backup-ul datelor personale: semne de carte, evidențieri, note și predici.
// Totul stă doar în browser, așa că un fișier de backup e singura cale de a nu
// pierde munca la ștergerea datelor browserului sau de a o muta pe alt dispozitiv.

import { exportAnnotations, importAnnotations } from './annotations.js';
import { allSermons, importSermons } from './sermons.js';

const FORMAT = 'versetfinder-backup';

/** Descarcă un fișier .json cu toate datele personale. */
export async function downloadBackup() {
  const data = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    ...exportAnnotations(),
    sermons: await allSermons(),
  };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `versetfinder-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Citește un fișier de backup și îl unește cu datele existente (nu șterge nimic).
 * @returns {Promise<string>} un rezumat pentru utilizator
 */
export async function restoreBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Fișierul nu e un backup Verset Finder valid.');
  }
  if (!data || data.format !== FORMAT) throw new Error('Fișierul nu e un backup Verset Finder valid.');
  const ann = importAnnotations(data);
  const sermons = await importSermons(Array.isArray(data.sermons) ? data.sermons : []);
  if (!ann && !sermons) return 'Backup-ul nu conține nimic nou față de ce ai deja.';
  return `Restaurat: ${ann} adnotări și ${sermons} predici noi sau actualizate.`;
}
