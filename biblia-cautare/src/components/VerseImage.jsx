import { useEffect, useRef, useState } from 'react';
import { useScrollLock } from '../lib/useScrollLock.js';
import { norm } from '../lib/search.js';

// Temele imaginii: fundal (gradient), culoarea textului și a referinței.
const THEMES = [
  { id: 'dawn', label: 'Răsărit', from: '#f59e0b', to: '#db2777', text: '#ffffff', accent: '#fff7ed' },
  { id: 'sea', label: 'Mare', from: '#0ea5e9', to: '#4338ca', text: '#ffffff', accent: '#e0f2fe' },
  { id: 'olive', label: 'Măslin', from: '#15803d', to: '#14532d', text: '#f0fdf4', accent: '#bbf7d0' },
  { id: 'night', label: 'Noapte', from: '#0f172a', to: '#312e81', text: '#f8fafc', accent: '#fcd34d' },
  { id: 'paper', label: 'Hârtie', from: '#fdf6e3', to: '#efe2c4', text: '#292524', accent: '#92400e' },
];

const FORMATS = [
  { id: 'square', label: 'Pătrat (postare)', w: 1080, h: 1080 },
  { id: 'story', label: 'Vertical (story)', w: 1080, h: 1920 },
];

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

/** Împarte textul în rânduri care încap în lățimea dată. */
function wrap(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function draw(canvas, { text, reference, format, theme, serif }) {
  const { w: W, h: H } = format;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, theme.from);
  g.addColorStop(1, theme.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Lumină discretă în colțul de sus, ca fundalul să nu fie plat.
  const glow = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, W * 0.9);
  glow.addColorStop(0, 'rgba(255,255,255,0.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Textul cât mai mare care încape în zona centrală.
  const family = serif ? SERIF : SANS;
  const pad = 110;
  const maxW = W - pad * 2;
  const maxH = H * (format.id === 'story' ? 0.58 : 0.62);
  const quoted = `„${text}”`;
  let size = format.id === 'story' ? 100 : 84;
  let lines;
  for (;;) {
    ctx.font = `${serif ? 'italic ' : ''}500 ${size}px ${family}`;
    lines = wrap(ctx, quoted, maxW);
    if (lines.length * size * 1.35 <= maxH || size <= 26) break;
    size -= 2;
  }
  const lh = size * 1.35;
  const refSize = Math.max(28, Math.round(size * 0.55));
  const blockH = lines.length * lh + refSize * 2.2;
  let y = (H - blockH) / 2 + size;

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.text;
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = theme.id === 'paper' ? 0 : 12;
  for (const l of lines) {
    ctx.fillText(l, W / 2, y);
    y += lh;
  }

  ctx.shadowBlur = 0;
  ctx.font = `600 ${refSize}px ${SANS}`;
  ctx.fillStyle = theme.accent;
  ctx.fillText(reference, W / 2, y + refSize * 0.8);

  ctx.globalAlpha = 0.55;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillStyle = theme.text;
  ctx.fillText('versetfinder.study', W / 2, H - 56);
  ctx.globalAlpha = 1;
}

/**
 * Fereastra „Imagine": versetul pe un fundal frumos, gata de trimis pe WhatsApp sau
 * pus pe Instagram. Se generează local (canvas), fără server.
 */
export default function VerseImage({ text, reference, onClose }) {
  useScrollLock();
  const canvasRef = useRef(null);
  const [theme, setTheme] = useState(THEMES[0]);
  const [format, setFormat] = useState(FORMATS[0]);
  const [serif, setSerif] = useState(true);
  const [status, setStatus] = useState('');
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, { text, reference, format, theme, serif });
  }, [text, reference, format, theme, serif]);

  // Esc închide doar fereastra asta, nu și cititorul de dedesubt (prins în faza de captură).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const fileName = `verset-${norm(reference).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
  const toBlob = () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'));

  async function download() {
    const blob = await toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus('Imagine descărcată.');
  }

  async function share() {
    const file = new File([await toBlob()], fileName, { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) {
      await download();
      return;
    }
    try {
      await navigator.share({ files: [file], text: `„${text}” — ${reference}` });
    } catch {
      /* utilizatorul a renunțat */
    }
  }

  const pill = (active) =>
    'rounded-full border px-2.5 py-1 text-xs transition ' +
    (active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
      : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Imagine cu versetul"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Imagine cu versetul</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className={'mx-auto w-auto rounded-xl shadow ' + (format.id === 'story' ? 'max-h-[52vh]' : 'max-h-[46vh]')}
          style={{ aspectRatio: `${format.w} / ${format.h}`, maxWidth: '100%' }}
        />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={theme.id === t.id}
              className={pill(theme.id === t.id) + ' inline-flex items-center gap-1.5'}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FORMATS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFormat(f)} aria-pressed={format.id === f.id} className={pill(format.id === f.id)}>
              {f.label}
            </button>
          ))}
          <button type="button" onClick={() => setSerif((v) => !v)} aria-pressed={serif} className={pill(serif) + ' font-serif'}>
            Serif
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={download}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Descarcă PNG
          </button>
          {canShare && (
            <button
              type="button"
              onClick={share}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Distribuie…
            </button>
          )}
          {status && <span className="text-xs text-emerald-600 dark:text-emerald-400">{status}</span>}
        </div>
      </div>
    </div>
  );
}
