import { memo, useEffect, useMemo, useRef, useState } from 'react';
import basemap from '../data/basemap.json';
import { PLACES, hasCoords, placeName } from '../lib/places.js';

// Proiecție echirectangulară cu scara longitudinii corectată la latitudinea Țării Sfinte:
// destul de fidelă pentru o regiune cât Orientul Apropiat, și simplă (x = lon·cos φ0, y = −lat).
const K = Math.cos((32 * Math.PI) / 180);
const px = (lon) => lon * K;
const py = (lat) => -lat;

// Vederea de pornire: Țara Sfântă, cu Delta Nilului și Damascul la margini.
const START = { x: px(31.6), y: py(35.2), w: px(38.6) - px(31.6) };
const MIN_W = 0.25; // zoom maxim (grade proiectate pe lățime)
const MAX_W = px(62) - px(-10);

const TYPE_COLOR = {
  city: '#dc2626',
  region: '#7c3aed',
  water: '#0284c7',
  mountain: '#92400e',
  valley: '#15803d',
  island: '#0d9488',
  landmark: '#d97706',
  path: '#64748b',
  place: '#64748b',
};

const toPath = (rings, close) =>
  rings.map((r) => 'M' + r.map(([x, y]) => `${(x * K).toFixed(2)},${(-y).toFixed(2)}`).join('L') + (close ? 'Z' : '')).join('');

// Fundalul nu se schimbă niciodată: căile SVG se construiesc o singură dată.
const LAND = toPath(basemap.land, true);
const LAKES = toPath(basemap.lakes, true);
const RIVERS = toPath(basemap.rivers, false);

const PLOTTED = PLACES.filter(hasCoords);

/**
 * Harta lumii biblice: uscat, ape și toate locurile cu coordonate. Se trage cu
 * mouse-ul / degetul, zoom cu rotița, cu două degete sau cu + / −. Etichetele arată
 * cele mai pomenite locuri din zona vizibilă, ca harta să rămână lizibilă la orice zoom.
 * `focus` (un loc) centrează harta pe el; `highlight` (listă de id-uri) le scoate în evidență.
 */
function BibleMap({ selectedId = null, focus = null, highlight = null, onSelect, className = '' }) {
  const svgRef = useRef(null);
  const [view, setView] = useState(START);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const viewH = view.w * (size.h / size.w);

  // Dimensiunea reală a hărții (pentru raportul de aspect și mărimea punctelor în pixeli).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Centrare pe locul ales (din listă sau din URL); zoom mai aproape dacă harta e prea departe.
  useEffect(() => {
    if (!focus || !hasCoords(focus)) return;
    setView((v) => {
      const w = Math.min(v.w, focus.t === 'region' ? 6 : 3.5);
      const h = w * (size.h / size.w);
      return { x: px(focus.lon) - w / 2, y: py(focus.lat) - h / 2, w };
    });
  }, [focus, size.w, size.h]);

  // --- trasul și zoom-ul ---
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const moved = useRef(false);

  const unitsPerPx = view.w / size.w;

  function clampW(w) {
    return Math.min(MAX_W, Math.max(MIN_W, w));
  }

  function zoomAt(factor, clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    setView((v) => {
      const w = clampW(v.w * factor);
      const h = w * (size.h / size.w);
      const oldH = v.w * (size.h / size.w);
      return { x: v.x + fx * (v.w - w), y: v.y + fy * (oldH - h), w };
    });
  }

  function onWheel(e) {
    e.preventDefault();
    zoomAt(e.deltaY > 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
  }
  // React atașează wheel ca pasiv; harta are nevoie de preventDefault ca pagina să nu deruleze.
  useEffect(() => {
    const el = svgRef.current;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  function onPointerDown(e) {
    try {
      svgRef.current.setPointerCapture(e.pointerId);
    } catch {
      /* pointerul a dispărut deja; tragerea merge și fără captură */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    gesture.current = { view, pts: new Map(pointers.current) };
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    const start = [...g.pts.values()];
    if (pts.length === 1 && start.length >= 1) {
      const dx = pts[0].x - start[0].x;
      const dy = pts[0].y - start[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      const k = g.view.w / size.w;
      setView({ ...g.view, x: g.view.x - dx * k, y: g.view.y - dy * k });
    } else if (pts.length >= 2 && start.length >= 2) {
      // Ciupit cu două degete: zoom în jurul mijlocului.
      moved.current = true;
      const d0 = Math.hypot(start[0].x - start[1].x, start[0].y - start[1].y);
      const d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!d0 || !d1) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((start[0].x + start[1].x) / 2 - rect.left) / rect.width;
      const my = ((start[0].y + start[1].y) / 2 - rect.top) / rect.height;
      const w = clampW(g.view.w * (d0 / d1));
      const oldH = g.view.w * (size.h / size.w);
      const h = w * (size.h / size.w);
      setView({ x: g.view.x + mx * (g.view.w - w), y: g.view.y + my * (oldH - h), w });
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    gesture.current = { view, pts: new Map(pointers.current) };
  }

  // --- etichetele: cele mai pomenite locuri din zona vizibilă, fără să se suprapună ---
  const labels = useMemo(() => {
    const k = view.w / size.w;
    const fs = 12 * k;
    const inView = PLOTTED.filter((p) => {
      const x = px(p.lon);
      const y = py(p.lat);
      return x >= view.x && x <= view.x + view.w && y >= view.y && y <= view.y + viewH;
    });
    const sel = selectedId != null ? PLOTTED.find((p) => p.id === selectedId) : null;
    const ordered = [...(sel ? [sel] : []), ...inView.filter((p) => p !== sel).sort((a, b) => b.vc - a.vc)];
    const boxes = [];
    const chosen = [];
    for (const p of ordered) {
      if (chosen.length >= 60) break;
      // Cutia aproximativă a textului (lățimea medie a unui caracter ≈ 0,58 em), plus punctul.
      const x0 = px(p.lon) - 4 * k;
      const w = placeName(p).length * fs * 0.58 + 12 * k;
      const y0 = py(p.lat) - fs * 0.7;
      const box = [x0, y0, x0 + w, y0 + fs * 1.4];
      if (p !== sel && boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      boxes.push(box);
      chosen.push(p);
    }
    return chosen;
  }, [view, viewH, size.w, selectedId]);

  const hl = useMemo(() => new Set(highlight || []), [highlight]);
  const r = (p) => (Math.min(7, 2.2 + Math.log10(p.vc + 1) * 1.6) + (p.id === selectedId ? 2 : 0)) * unitsPerPx;
  const font = 12 * unitsPerPx;

  return (
    <div
      className={
        'relative overflow-hidden rounded-xl border border-slate-200 bg-sky-100 [--map-halo:#f7f1e1] dark:border-slate-800 dark:bg-slate-950 dark:[--map-halo:#1b2333] ' +
        className
      }
    >
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${viewH}`}
        className="h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Harta locurilor din Biblie"
      >
        <path d={LAND} className="fill-[#efe6cf] stroke-[#cdbf9a] dark:fill-[#2a3446] dark:stroke-slate-600" strokeWidth={0.6 * unitsPerPx} />
        <path d={LAKES} className="fill-sky-100 dark:fill-slate-950" />
        <path d={RIVERS} className="fill-none stroke-sky-400/70 dark:stroke-sky-800" strokeWidth={1.1 * unitsPerPx} />

        {PLOTTED.map((p) => (
          <circle
            key={p.id}
            cx={px(p.lon)}
            cy={py(p.lat)}
            r={r(p)}
            fill={TYPE_COLOR[p.t] || TYPE_COLOR.place}
            fillOpacity={p.id === selectedId || hl.has(p.id) ? 1 : 0.7}
            stroke={p.id === selectedId || hl.has(p.id) ? '#fff' : 'none'}
            strokeWidth={1.5 * unitsPerPx}
            className="cursor-pointer"
            onClick={() => !moved.current && onSelect?.(p.slug)}
          >
            <title>{placeName(p)}</title>
          </circle>
        ))}

        {labels.map((p) => (
          <text
            key={p.id}
            x={px(p.lon) + r(p) + 2 * unitsPerPx}
            y={py(p.lat) + font * 0.35}
            fontSize={p.id === selectedId ? font * 1.2 : font}
            fontWeight={p.id === selectedId ? 700 : 500}
            fontStyle={p.t === 'region' ? 'italic' : 'normal'}
            className="pointer-events-none fill-slate-800 dark:fill-slate-100"
            stroke="currentColor"
            style={{ paintOrder: 'stroke', color: 'var(--map-halo)' }}
            strokeWidth={3 * unitsPerPx}
          >
            {placeName(p)}
          </text>
        ))}
      </svg>

      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        {[
          ['+', 1 / 1.6, 'Apropie'],
          ['−', 1.6, 'Depărtează'],
        ].map(([label, f, title]) => (
          <button
            key={label}
            type="button"
            title={title}
            aria-label={title}
            onClick={() => {
              const rect = svgRef.current.getBoundingClientRect();
              zoomAt(f, rect.left + rect.width / 2, rect.top + rect.height / 2);
            }}
            className="h-8 w-8 text-lg leading-none text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          title="Vederea inițială"
          aria-label="Vederea inițială"
          onClick={() => setView(START)}
          className="h-8 w-8 text-sm leading-none text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          ⌂
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-1 left-2 text-[10px] text-slate-500 dark:text-slate-400">
        Hartă: Natural Earth · locuri: OpenBible.info / Theographic
      </p>
    </div>
  );
}

export default memo(BibleMap);
