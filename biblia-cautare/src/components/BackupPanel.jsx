import { useRef, useState } from 'react';
import { downloadBackup, restoreBackup } from '../lib/backup.js';

/**
 * Backup și restaurare pentru datele personale (note, evidențieri, semne de
 * carte, predici). Totul e salvat doar în browserul curent, deci fișierul de
 * backup e și singura cale de a le muta pe alt telefon/calculator.
 */
export default function BackupPanel({ compact = false }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  async function onExport() {
    try {
      await downloadBackup();
      setMsg({ ok: true, text: 'Backup descărcat. Păstrează fișierul într-un loc sigur.' });
    } catch {
      setMsg({ ok: false, text: 'Backup-ul nu a putut fi creat.' });
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setMsg({ ok: true, text: await restoreBackup(file) });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  const btn =
    'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'}>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Backup</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Notele, evidențierile, salvatele și predicile stau doar în acest browser. Fă un backup ca să nu le pierzi
          sau ca să le muți pe alt dispozitiv.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExport} className={btn}>
          Descarcă backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
          Restaurează…
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImport} className="hidden" />
      </div>
      {msg && (
        <p role="status" className={'text-xs ' + (msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
