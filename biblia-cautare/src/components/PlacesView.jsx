import { useEffect, useMemo, useState } from 'react';
import BibleMap from './BibleMap.jsx';
import { CARD, SECTION_TITLE, VerseMentions, EastonNote, Pill } from './Explore.jsx';
import { PLACES, PLACE_TYPES, placeBySlug, placeName, placeVerses, findPlaces, hasCoords } from '../lib/places.js';
import { eventsAtPlace, eventTitle, fmtSpan } from '../lib/events.js';

const PAGE = 60;

/**
 * Pagina „Locuri": harta lumii biblice cu toate locurile, lista cu căutare și o
 * pagină pentru fiecare loc (ce s-a întâmplat acolo, versetele, dicționarul).
 * `slug` alege locul (null = lista).
 */
export default function PlacesView({ translation, slug, onOpenPlace, onOpenVerse, onOpenEvent, onSearch }) {
  const place = slug ? placeBySlug(slug) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <BibleMap
        className="h-[45vh] lg:sticky lg:top-4 lg:h-[calc(100vh-7rem)]"
        selectedId={place?.id ?? null}
        focus={place}
        onSelect={onOpenPlace}
      />
      <div className="min-w-0">
        {place ? (
          <PlacePage
            key={place.id}
            place={place}
            translation={translation}
            onOpenPlace={onOpenPlace}
            onOpenVerse={onOpenVerse}
            onOpenEvent={onOpenEvent}
            onSearch={onSearch}
          />
        ) : (
          <PlacesList onOpenPlace={onOpenPlace} />
        )}
      </div>
    </div>
  );
}

const TYPE_FILTERS = ['all', 'city', 'region', 'water', 'mountain', 'valley', 'island'];

function PlacesList({ onOpenPlace }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(() => findPlaces(query, { type }), [query, type]);
  useEffect(() => setLimit(PAGE), [query, type]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {PLACES.length.toLocaleString('ro-RO')} de locuri din Scriptură, de la Ur și Eden până la Roma. Atinge un punct pe
        hartă sau caută un nume.
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Caută un loc: Betleem, Efes, Iordan…"
        aria-label="Caută un loc"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
      />
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((t) => (
          <Pill key={t} active={type === t} onClick={() => setType(t)}>
            {t === 'all' ? 'Toate' : PLACE_TYPES[t]}
          </Pill>
        ))}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {list.length.toLocaleString('ro-RO')} {list.length === 1 ? 'loc' : 'locuri'}
      </p>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {list.slice(0, limit).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onOpenPlace(p.slug)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">{placeName(p)}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {PLACE_TYPES[p.t]}
                  {!hasCoords(p) && ' · poziție necunoscută'}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500" title="Versete în care apare">
                {p.vc}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {list.length > limit && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Arată încă {Math.min(PAGE, list.length - limit)}
          </button>
        </div>
      )}
    </div>
  );
}

function PlacePage({ place: p, translation, onOpenPlace, onOpenVerse, onOpenEvent, onSearch }) {
  const name = placeName(p);
  const verses = useMemo(() => placeVerses(p), [p]);
  const events = useMemo(() => eventsAtPlace(p.id), [p]);

  return (
    <article className="space-y-4">
      <button
        type="button"
        onClick={() => onOpenPlace(null)}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ‹ Toate locurile
      </button>

      <header className={CARD}>
        <h2 className="text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100">{name}</h2>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{PLACE_TYPES[p.t]}</span>
          {p.en !== name && <span title="Numele în engleză">EN: {p.en}</span>}
          <span>
            {p.vc} {p.vc === 1 ? 'verset' : 'versete'}
          </span>
          {hasCoords(p) ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100"
            >
              vezi azi pe Google Maps ↗
            </a>
          ) : (
            <span>poziția nu e cunoscută</span>
          )}
        </p>
      </header>

      {events.length > 0 && (
        <section className={CARD}>
          <h3 className={'mb-3 ' + SECTION_TITLE}>Ce s-a întâmplat aici</h3>
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2">
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">{fmtSpan(e)}</span>
                <button
                  type="button"
                  onClick={() => onOpenEvent(e.id)}
                  className="text-left text-sm text-slate-800 underline-offset-2 hover:underline dark:text-slate-200"
                >
                  {eventTitle(e)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <VerseMentions
        keys={verses}
        translation={translation}
        onOpenVerse={onOpenVerse}
        title={`Apare în ${verses.length} ${verses.length === 1 ? 'verset' : 'versete'}`}
        action={
          <button
            type="button"
            onClick={() => onSearch(name)}
            className="text-xs text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            caută „{name}” în toată Biblia
          </button>
        }
      />

      <EastonNote text={p.dict} />

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Date: Theographic Bible Metadata (CC BY-SA 4.0), coordonate OpenBible.info. Numele românești sunt deduse automat
        din Cornilescu; poziția multor locuri antice e aproximativă sau disputată.
      </p>
    </article>
  );
}
