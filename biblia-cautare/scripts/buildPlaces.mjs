// Construiește datele pentru paginile „Locuri" și „Cronologie" + harta de fundal.
//
// Surse (descărcate manual, NU intră în git):
//   - Theographic Bible Metadata (CC BY-SA 4.0), https://github.com/robertrouse/theographic-bible-metadata
//     json/{places,events,people,verses}.json → <repo>/data-src/theographic/
//   - Natural Earth 1:10m (domeniu public), https://github.com/nvkelso/natural-earth-vector (geojson/)
//     ne_10m_land, ne_10m_lakes, ne_10m_rivers_lake_centerlines → <repo>/data-src/naturalearth/
//
// Rulare (din biblia-cautare/, după buildPeople.mjs):  node scripts/buildPlaces.mjs
// Ieșire:
//   src/data/places.json  — { id, slug, en, ro, t: tip, lat, lon, v, vc, dict }
//   src/data/events.json  — { id, ro, en, y: an început, ye: an sfârșit, dur, p: [persoane],
//                             l: [locuri], v: [versete], part: id-ul evenimentului părinte }
//   src/data/basemap.json — { land: [inele], lakes: [inele], rivers: [linii] }, coordonate [lon, lat]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatcher, loadRccv, osisToKey } from './lib/roNames.mjs';
import { EVENT_TITLES } from './eventsRo.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'data-src');
const DATA = join(here, '..', 'src', 'data');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const places = read(join(SRC, 'theographic', 'places.json'));
const events = read(join(SRC, 'theographic', 'events.json'));
const rawPeople = read(join(SRC, 'theographic', 'people.json'));
const verses = read(join(SRC, 'theographic', 'verses.json'));
const people = read(join(DATA, 'people.json'));
const rccv = loadRccv(join(DATA, 'rccv.json'));

const verseKey = new Map();
const order = new Map();
verses.forEach((r, i) => {
  const key = osisToKey(r.fields.osisRef);
  if (!key) return;
  verseKey.set(r.id, key);
  order.set(key, i);
});
const keysOf = (ids) => [...new Set((ids || []).map((r) => verseKey.get(r)).filter(Boolean))].sort((a, b) => order.get(a) - order.get(b));

// Nume pe care potrivirea automată le nimerește greșit sau deloc.
const PLACE_OVERRIDES = {
  Egypt: 'Egipt',
  Jerusalem: 'Ierusalim',
  Jordan: 'Iordan',
  'Jordan River': 'Iordan',
  Israel: 'Israel',
  Judah: 'Iuda',
  'Sea of Galilee': 'Marea Galileii',
  'Red Sea': 'Marea Roșie',
  'Dead Sea': 'Marea Moartă',
  'Salt Sea': 'Marea Sărată',
  'Great Sea': 'Marea cea Mare',
  'Mediterranean Sea': 'Marea Mediterană',
  Rome: 'Roma',
  'Mount of Olives': 'Muntele Măslinilor',
  Melita: 'Malta',
  Greece: 'Grecia',
};

// Forma de afișare: fără articolul rămas din text („Libiei" → „Libia") și cu felul
// locului în față, ca în română („Mount Hor" → „Muntele Hor", „Valley of Aijalon" → „Valea Aialon").
function placeLabel(en, ro) {
  if (!ro) return null;
  let n = ro.replace(/ului$/, '').replace(/iei$/, 'ia').replace(/eii$/, 'eea');
  if (/^Mount /.test(en) && !/^Munte/.test(n)) n = `Muntele ${n}`;
  else if (/^Valley of /.test(en) && !/^Vale/.test(n)) n = `Valea ${n}`;
  else if (/^Brook /.test(en) && !/^Pârâ/.test(n)) n = `Pârâul ${n}`;
  return n;
}

// --- Locuri ---
const TYPES = { City: 'city', Region: 'region', Water: 'water', Mountain: 'mountain', Valley: 'valley', Island: 'island', Landmark: 'landmark', Path: 'path' };
const placeMatcher = createMatcher(rccv, { articles: true });
const placeIdOf = new Map(places.map((p) => [p.id, p.fields.placeID]));
let placeNames = 0;
const outPlaces = places.map((p) => {
  const f = p.fields;
  const keys = keysOf(f.verses);
  const en = f.displayTitle || f.kjvName;
  const ro = PLACE_OVERRIDES[en] || placeLabel(en, placeMatcher(f.kjvName || en, keys));
  if (ro) placeNames++;
  const lat = Number(f.openBibleLat || f.latitude);
  const lon = Number(f.openBibleLong || f.longitude);
  const dict = (f.dictText || f.dictionaryText ? [].concat(f.dictText || f.dictionaryText).join('\n') : '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
  return {
    id: f.placeID,
    slug: f.slug,
    en,
    ro: ro || undefined,
    t: TYPES[f.featureType] || 'place',
    lat: Number.isFinite(lat) && lat ? Math.round(lat * 1e4) / 1e4 : undefined,
    lon: Number.isFinite(lon) && lon ? Math.round(lon * 1e4) / 1e4 : undefined,
    v: keys.join(' ') || undefined,
    vc: keys.length,
    dict: dict || undefined,
  };
});

// --- Evenimente ---
const personIdOf = new Map(rawPeople.map((p) => [p.id, p.fields.personID]));
const rawNameOf = new Map(rawPeople.map((p) => [p.fields.personID, p.fields.name]));
const personById = new Map(people.map((p) => [p.id, p]));
const eventIdOf = new Map(events.map((e) => [e.id, e.fields.eventID]));

const roName = (p) => p.ro || p.en.replace(/\s*\(.*\)$/, '');
// „lui David" / „Sarei" (genitivul pentru nume de femei terminate în -a).
function genitive(p) {
  const n = roName(p);
  if (p.g === 'F' && /a$/.test(n)) return n.replace(/a$/, 'ei');
  return `lui ${n}`;
}

const TEMPLATES = [
  [/^Birth of (.+)$/, (x) => `Nașterea ${x}`],
  [/^Death of (.+)$/, (x) => `Moartea ${x}`],
  [/^Lifetime of (.+)$/, (x) => `Viața ${x}`],
  [/^Reign of (.+)$/, (x) => `Domnia ${x}`],
  [/^Prophecies of (.+)$/, (x) => `Proorociile ${x}`],
  [/^Judgeship of (.+)$/, (x) => `Judecătoria ${x}`],
  [/^Subjugation by (.+)$/, (x, raw) => `Asuprirea sub ${raw}`],
  [/^Deliverance by (.+)$/, (x, raw) => `Izbăvirea prin ${raw}`],
];

let untranslated = 0;
function eventTitle(f, participants) {
  if (EVENT_TITLES[f.eventID]) return EVENT_TITLES[f.eventID];
  for (const [re, make] of TEMPLATES) {
    const m = f.title.match(re);
    if (!m) continue;
    // „Barak And Deborah", „Ahaziah (Jehoahaz)": fiecare nume se caută printre participanți.
    const names = m[1].replace(/\s*\(.*\)$/, '').split(/\s+and\s+/i);
    const found = names.map((n) => {
      const key = n.trim().toLowerCase();
      const pid = participants.find((id) => rawNameOf.get(id)?.toLowerCase() === key)
        ?? people.find((p) => rawNameOf.get(p.id)?.toLowerCase() === key)?.id;
      return pid != null ? personById.get(pid) : null;
    });
    if (found.every(Boolean)) {
      const gen = found.map(genitive).join(' și ');
      const raw = found.map(roName).join(' și ');
      return make(gen, raw);
    }
  }
  untranslated++;
  return null;
}

function parseYear(s) {
  const m = String(s).match(/^(-?)0*(\d+)/);
  return m ? Number(m[1] + m[2]) : null;
}

function durationYears(d) {
  const y = String(d || '').match(/^([\d.]+)Y$/);
  return y ? Number(y[1]) : 0;
}

function durationText(d) {
  const m = String(d || '').match(/^([\d.]+)([YMWD])$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = { Y: ['an', 'ani'], M: ['lună', 'luni'], W: ['săptămână', 'săptămâni'], D: ['zi', 'zile'] }[m[2]];
  if (n === 1) return `1 ${unit[0]}`;
  return `${n}${n >= 20 ? ' de' : ''} ${unit[1]}`;
}

const outEvents = events
  .map((e) => {
    const f = e.fields;
    const participants = (f.participants || []).map((r) => personIdOf.get(r)).filter((x) => x != null);
    const y = parseYear(f.startDate);
    const span = durationYears(f.duration);
    return {
      id: f.eventID,
      ro: eventTitle(f, participants) || undefined,
      en: f.title,
      y,
      ye: span >= 1 ? Math.round(y + span) : undefined,
      dur: durationText(f.duration),
      p: participants.length ? participants : undefined,
      l: (f.locations || []).map((r) => placeIdOf.get(r)).filter((x) => x != null),
      v: keysOf(f.verses),
      part: f.partOf ? eventIdOf.get(f.partOf[0]) : undefined,
      s: f.sortKey,
    };
  })
  .sort((a, b) => a.s - b.s)
  .map(({ s, l, v, ...rest }) => ({ ...rest, l: l.length ? l : undefined, v: v.length ? v.join(' ') : undefined }));

// --- Harta de fundal (Natural Earth): decupată pe lumea biblică și simplificată ---
const BOX = { w: -10, e: 62, s: 8, n: 47 };
const TOL = 0.02; // ~2 km: destul pentru o hartă de studiu, mic ca fișier

function clipRing(ring) {
  // Sutherland–Hodgman pe cele patru laturi ale dreptunghiului.
  const edges = [
    [(p) => p[0] >= BOX.w, (a, b) => cut(a, b, 0, BOX.w)],
    [(p) => p[0] <= BOX.e, (a, b) => cut(a, b, 0, BOX.e)],
    [(p) => p[1] >= BOX.s, (a, b) => cut(a, b, 1, BOX.s)],
    [(p) => p[1] <= BOX.n, (a, b) => cut(a, b, 1, BOX.n)],
  ];
  let out = ring;
  for (const [inside, inter] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(inter(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(inter(prev, cur));
      }
    }
    if (!out.length) return [];
  }
  return out;
}

function cut(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return axis === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v];
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let max = 0;
    let idx = -1;
    const [ax, ay] = pts[i];
    const [bx, by] = pts[j];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs(dy * pts[k][0] - dx * pts[k][1] + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        idx = k;
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([i, idx], [idx, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

const round = (pts) => pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);

function polygons(file, minPts = 4) {
  const fc = read(join(SRC, 'naturalearth', file));
  const rings = [];
  for (const ft of fc.features) {
    const g = ft.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      for (const ring of poly.slice(0, 1)) {
        const clipped = clipRing(ring);
        if (clipped.length < 3) continue;
        const simple = round(simplify(clipped, TOL));
        if (simple.length >= minPts) rings.push(simple);
      }
    }
  }
  return rings;
}

function lines(file, maxRank) {
  const fc = read(join(SRC, 'naturalearth', file));
  const out = [];
  for (const ft of fc.features) {
    if ((ft.properties.scalerank ?? 99) > maxRank) continue;
    const g = ft.geometry;
    if (!g) continue;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const line of parts) {
      let cur = [];
      for (const p of line) {
        const inside = p[0] >= BOX.w && p[0] <= BOX.e && p[1] >= BOX.s && p[1] <= BOX.n;
        if (inside) cur.push(p);
        else if (cur.length) {
          out.push(cur);
          cur = [];
        }
      }
      if (cur.length > 1) out.push(cur);
    }
  }
  return out.map((l) => round(simplify(l, TOL))).filter((l) => l.length > 1);
}

const basemap = {
  land: polygons('ne_10m_land.geojson'),
  lakes: polygons('ne_10m_lakes.geojson', 3),
  rivers: lines('ne_10m_rivers_lake_centerlines.geojson', 6),
};

const write = (name, data) => {
  const json = JSON.stringify(data);
  writeFileSync(join(DATA, name), json);
  console.log(`→ src/data/${name} (${(json.length / 1024).toFixed(0)} KB)`);
};
write('places.json', outPlaces);
write('events.json', outEvents);
write('basemap.json', basemap);
console.log(`locuri: ${outPlaces.length}, nume românești: ${placeNames} (${Math.round((placeNames / outPlaces.length) * 100)}%)`);
console.log(`evenimente: ${outEvents.length}, fără titlu românesc: ${untranslated}`);
