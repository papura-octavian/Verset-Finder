import { useEffect } from 'react';
import ChapterView from './ChapterView.jsx';
import { bookName } from '../lib/reader.js';

/**
 * Cititorul ca overlay (modal): fundal + Escape + click pe fundal = închide.
 * Tot conținutul (antet, versete, comparație, setări) e în `ChapterView`,
 * partajat cu pagina Citește (`ReadView`).
 */
export default function Reader({ translation, target, onNavigate, onClose }) {
  // Închide cu Escape (prinde înaintea scurtăturilor globale din App).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Cititor: ${bookName(translation, target.abbrev)} ${target.chapter}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(); // click pe fundal = închide
      }}
    >
      <ChapterView translation={translation} target={target} onNavigate={onNavigate} onClose={onClose} />
    </div>
  );
}
