import { useEffect, useMemo, useState } from 'react';
import { CARD, LinkChip, Pill } from './Explore.jsx';
import { EVENTS, ERAS, eraOf, eventTitle, fmtSpan, eventVerses, isLifetime, matchesEvent } from '../lib/events.js';
import { getPerson, personName, personSubtitle } from '../lib/people.js';
import { getPlace, placeName } from '../lib/places.js';
import { parseVerseKey } from '../lib/annotations.js';
import { bookName } from '../lib/reader.js';

/**
 * Pagina „Cronologie": cele ~450 de evenimente ale Bibliei, de la Creație la Pavel la
 * Roma, pe epoci, cu persoanele, locurile și versetele fiecăruia. `eventId` (din URL)
 * derulează la un eveniment și îl evidențiază.
 */
export default function TimelineView({ translation, eventId, onOpenPerson, onOpenPlace, onOpenVerse }) {
  const [query, setQuery] = useState('');
  const [lifetimes, setLifetimes] = useState(false);

  const groups = useMemo(() => {
    const out = ERAS.map((era) => ({ era, events: [] }));
    for (const e of EVENTS) {
      if (!lifetimes && isLifetime(e) && e.id !== eventId) continue;
      if (query.trim() && !matchesEvent(e, query)) continue;
      out.find((g) => g.era.id === eraOf(e).id).events.push(e);
    }
    return out.filter((g) => g.events.length);
  }, [query, lifetimes, eventId]);

  // Evenimentul din URL: derulează la el.
  useEffect(() => {
    if (eventId == null) return;
    const t = setTimeout(() => document.getElementById(`ev-${eventId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    return () => clearTimeout(t);
  }, [eventId]);

  const total = groups.reduce((n, g) => n + g.events.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Istoria Bibliei pe ani, de la Creație până la Pavel la Roma. Anii urmează cronologia tradițională (Ussher) și sunt
        aproximativi, mai ales pentru perioadele vechi.
      </p>

      <div className="space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută un eveniment: potop, Exodul, Cincizecimea…"
          aria-label="Caută un eveniment"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {groups.map((g) => (
            <Pill
              key={g.era.id}
              active={false}
              onClick={() => document.getElementById(`era-${g.era.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
            >
              {g.era.label}
            </Pill>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={lifetimes} onChange={(e) => setLifetimes(e.target.checked)} />
          arată și durata vieții patriarhilor
        </label>
      </div>

      {total === 0 && <p className="py-10 text-center text-slate-500 dark:text-slate-400">Niciun eveniment nu se potrivește cu „{query}”.</p>}

      {groups.map((g) => (
        <section key={g.era.id} id={`era-${g.era.id}`} className="scroll-mt-24">
          <h2 className="sticky top-0 z-10 -mx-1 mb-2 bg-slate-50/95 px-1 py-2 text-lg font-bold text-slate-900 backdrop-blur dark:bg-slate-950/95 dark:text-slate-100">
            {g.era.label}
            <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">
              {fmtSpan({ y: Math.min(...g.events.map((e) => e.y)), ye: Math.max(...g.events.map((e) => e.ye ?? e.y)) })}
            </span>
          </h2>
          <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4 dark:border-slate-800">
            {g.events.map((e) => (
              <EventItem
                key={e.id}
                event={e}
                active={e.id === eventId}
                translation={translation}
                onOpenPerson={onOpenPerson}
                onOpenPlace={onOpenPlace}
                onOpenVerse={onOpenVerse}
              />
            ))}
          </ol>
        </section>
      ))}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Date: Theographic Bible Metadata (CC BY-SA 4.0). Titlurile evenimentelor sunt traduse în română.
      </p>
    </div>
  );
}

function EventItem({ event: e, active, translation, onOpenPerson, onOpenPlace, onOpenVerse }) {
  const people = (e.p || []).map(getPerson).filter((p) => p && p.en !== 'God');
  const places = (e.l || []).map(getPlace).filter(Boolean);
  const verses = eventVerses(e);
  const first = verses[0] ? parseVerseKey(verses[0]) : null;

  return (
    <li id={`ev-${e.id}`} className="relative scroll-mt-24">
      <span
        className={
          'absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full border-2 border-slate-50 dark:border-slate-950 ' +
          (active ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-600')
        }
      />
      <div className={CARD + ' !p-3 ' + (active ? 'ring-2 ring-amber-400' : '')}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">{fmtSpan(e)}</span>
          {e.dur && <span className="text-xs text-slate-400 dark:text-slate-500">· {e.dur}</span>}
        </div>
        <h3 className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{eventTitle(e)}</h3>

        {(people.length > 0 || places.length > 0 || first) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {people.slice(0, 8).map((p) => (
              <LinkChip key={`p${p.id}`} tone={p.g === 'F' ? 'pink' : 'sky'} title={personSubtitle(p)} onClick={() => onOpenPerson(p.slug)}>
                {personName(p)}
              </LinkChip>
            ))}
            {people.length > 8 && <span className="text-xs text-slate-400">+{people.length - 8}</span>}
            {places.slice(0, 5).map((pl) => (
              <LinkChip key={`l${pl.id}`} tone="amber" title="Deschide pe hartă" onClick={() => onOpenPlace(pl.slug)}>
                📍 {placeName(pl)}
              </LinkChip>
            ))}
            {first && (
              <LinkChip onClick={() => onOpenVerse(first)} title="Citește pasajul">
                📖 {bookName(translation, first.abbrev)} {first.chapter}:{first.verse}
                {verses.length > 1 && ` (+${verses.length - 1})`}
              </LinkChip>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
