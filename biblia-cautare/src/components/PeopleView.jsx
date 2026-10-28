import { useEffect, useMemo, useState } from 'react';
import {
  PEOPLE,
  personBySlug,
  getPerson,
  personName,
  personSubtitle,
  personVerses,
  ancestry,
  descendantCount,
  findPeople,
  fmtYear,
  fatherLabel,
} from '../lib/people.js';
import { parseVerseKey } from '../lib/annotations.js';
import { getChapterVerses, bookName } from '../lib/reader.js';
import { eventsOfPerson, eventTitle, fmtSpan } from '../lib/events.js';

const PAGE = 60;
const CARD = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900';

/**
 * Pagina „Personaje": toate persoanele numite în Biblie (de la Adam la ultimul
 * nume din epistole), cu o pagină de tip wiki pentru fiecare: familie, linia de
 * strămoși până la Adam, urmași, toate versetele în care apare și articolul din
 * dicționarul Easton. `slug` alege persoana (null = lista).
 */
export default function PeopleView({ translation, slug, onOpenPerson, onOpenEvent, onOpenVerse, onSearch }) {
  const person = slug ? personBySlug(slug) : null;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);
  if (person) {
    return (
      <PersonPage
        key={person.id}
        person={person}
        translation={translation}
        onOpenPerson={onOpenPerson}
        onOpenVerse={onOpenVerse}
        onSearch={onSearch}
        onOpenEvent={onOpenEvent}
      />
    );
  }
  return <PeopleList onOpenPerson={onOpenPerson} />;
}

function PeopleList({ onOpenPerson }) {
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('all');
  const [sort, setSort] = useState('mentions');
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(() => findPeople(query, { gender, sort }), [query, gender, sort]);
  useEffect(() => setLimit(PAGE), [query, gender, sort]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {PEOPLE.length.toLocaleString('ro-RO')} de persoane numite în Scriptură, de la Adam până la ultimii frați salutați în
        epistole. Fiecare are familia, linia de strămoși, versetele în care apare și o notă de dicționar.
      </p>

      <div className="space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută un personaj: Avraam, Rut, Onisim…"
          aria-label="Caută un personaj"
          autoFocus
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
        />
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['all', 'Toți'],
            ['M', 'Bărbați'],
            ['F', 'Femei'],
          ].map(([id, label]) => (
            <Chip key={id} active={gender === id} onClick={() => setGender(id)}>
              {label}
            </Chip>
          ))}
          {!query.trim() && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Ordinea listei"
              className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="mentions">Cele mai menționate</option>
              <option value="alpha">Alfabetic</option>
              <option value="time">Cronologic (cu ani cunoscuți)</option>
            </select>
          )}
        </div>
      </div>

      {!query.trim() && gender === 'all' && sort === 'mentions' && (
        <div className={CARD}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Începe de aici</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['adam_78', 'Adam și urmașii lui'],
              ['jesus_905', 'Genealogia lui Isus'],
              ['abraham_58', 'Avraam'],
              ['david_994', 'David'],
              ['paul_2479', 'Pavel'],
            ].map(([s, label]) =>
              personBySlug(s) ? (
                <button
                  key={s}
                  type="button"
                  onClick={() => onOpenPerson(s)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {label}
                </button>
              ) : null
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {list.length.toLocaleString('ro-RO')} {list.length === 1 ? 'persoană' : 'persoane'}
      </p>
      {list.length === 0 ? (
        <p className="py-10 text-center text-slate-500 dark:text-slate-400">Niciun personaj nu se potrivește cu „{query}”.</p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {list.slice(0, limit).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpenPerson(p.slug)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Avatar person={p} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">{personName(p)}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {personSubtitle(p) || `în ${p.vc} ${p.vc === 1 ? 'verset' : 'versete'}`}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500" title="Versete în care apare">
                  {p.vc}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
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

function PersonPage({ person: p, translation, onOpenPerson, onOpenEvent, onOpenVerse, onSearch }) {
  const events = useMemo(() => eventsOfPerson(p.id), [p]);
  const name = personName(p);
  const verses = useMemo(() => personVerses(p), [p]);
  const line = useMemo(() => ancestry(p), [p]);
  const descendants = useMemo(() => descendantCount(p), [p]);
  const [showVerses, setShowVerses] = useState(20);
  const [lineOpen, setLineOpen] = useState(false);

  const rel = (ids) => (ids || []).map(getPerson).filter(Boolean);
  const father = p.f != null ? getPerson(p.f) : null;
  const mother = p.m != null ? getPerson(p.m) : null;
  const spouses = rel(p.sp);
  const siblings = rel(p.sib);
  const children = rel(p.ch);

  const verseRow = (key) => {
    const { abbrev, chapter, verse } = parseVerseKey(key);
    return {
      key,
      abbrev,
      chapter,
      verse,
      ref: `${bookName(translation, abbrev)} ${chapter}:${verse}`,
      text: getChapterVerses(translation, abbrev, chapter)?.[verse - 1] ?? '',
    };
  };

  // Linia de strămoși: lungă (Isus are ~75 de generații), deci mijlocul se strânge.
  const ancestors = line.slice(0, -1);
  const collapsed = !lineOpen && ancestors.length > 10;
  const shownLine = collapsed ? [...ancestors.slice(0, 3), null, ...ancestors.slice(-4)] : ancestors;

  const years = p.y && [fmtYear(p.y[0]), fmtYear(p.y[1])];

  return (
    <article className="space-y-4">
      <button
        type="button"
        onClick={() => onOpenPerson(null)}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ‹ Toate personajele
      </button>

      <header className={CARD + ' flex items-start gap-4'}>
        <Avatar person={p} large />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100">{name}</h2>
          {personSubtitle(p) && <p className="mt-0.5 text-slate-600 dark:text-slate-300">{personSubtitle(p)}</p>}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {p.en !== name && <span title="Numele în engleză">EN: {p.en}</span>}
            <span>
              {p.vc} {p.vc === 1 ? 'verset' : 'versete'}
            </span>
            {years && (years[0] || years[1]) && (
              <span title="Ani aproximativi, după cronologia tradițională (Ussher)">
                cca. {years[0] ?? '?'} – {years[1] ?? '?'}
              </span>
            )}
            {descendants > 0 && <span>{descendants.toLocaleString('ro-RO')} urmași cunoscuți</span>}
          </p>
        </div>
      </header>

      {!!(father || mother || spouses.length || siblings.length || children.length) && (
        <section className={CARD}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Familia</h3>
          <dl className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <FamilyRow label={fatherLabel(p)} people={father ? [father] : []} onOpen={onOpenPerson} />
            <FamilyRow label="Mamă" people={mother ? [mother] : []} onOpen={onOpenPerson} />
            <FamilyRow label={p.g === 'F' ? (spouses.length > 1 ? 'Soți' : 'Soț') : spouses.length > 1 ? 'Soții' : 'Soție'} people={spouses} onOpen={onOpenPerson} />
            <FamilyRow label="Frați și surori" people={siblings} onOpen={onOpenPerson} />
            <FamilyRow label="Copii" people={children} onOpen={onOpenPerson} />
          </dl>
        </section>
      )}

      {ancestors.length > 0 && (
        <section className={CARD}>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Linia strămoșilor · {ancestors.length} {ancestors.length === 1 ? 'generație' : 'generații'}
          </h3>
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">De la cel mai vechi strămoș numit până la {name}.</p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {shownLine.map((a, i) =>
              a ? (
                <li key={a.id} className="flex items-center gap-1.5">
                  <PersonChip person={a} onOpen={onOpenPerson} />
                  <span className="text-slate-300 dark:text-slate-600">›</span>
                </li>
              ) : (
                <li key="gap" className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLineOpen(true)}
                    className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    … încă {ancestors.length - 7} …
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">›</span>
                </li>
              )
            )}
            <li className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">{name}</li>
          </ol>
        </section>
      )}

      {children.length > 0 && (
        <section className={CARD}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Urmași</h3>
          <DescendantTree ids={p.ch} depth={0} onOpen={onOpenPerson} seen={new Set([p.id])} />
        </section>
      )}

      {events.length > 0 && (
        <section className={CARD}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Evenimente</h3>
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

      {verses.length > 0 && (
        <section className={CARD}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Apare în {verses.length} {verses.length === 1 ? 'verset' : 'versete'}
            </h3>
            <button
              type="button"
              onClick={() => onSearch(name)}
              className="text-xs text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              caută „{name}” în toată Biblia
            </button>
          </div>
          <ul className="space-y-2">
            {verses.slice(0, showVerses).map((k) => {
              const r = verseRow(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => onOpenVerse(r)}
                    className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.ref}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">{r.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {verses.length > showVerses && (
            <button
              type="button"
              onClick={() => setShowVerses((n) => n + 50)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Arată încă {Math.min(50, verses.length - showVerses)}
            </button>
          )}
        </section>
      )}

      {p.dict && (
        <details className={CARD}>
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Dicționar biblic (Easton, în engleză)
          </summary>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300" lang="en">
            {p.dict.split(/\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </details>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Date: Theographic Bible Metadata (Viz.Bible), CC BY-SA 4.0; numele românești sunt deduse automat din textul
        Cornilescu și pot avea mici greșeli.
      </p>
    </article>
  );
}

/** Urmașii pe generații: copiii vizibili, nepoții la cerere (arborii pot fi uriași). */
function DescendantTree({ ids, depth, onOpen, seen }) {
  const kids = (ids || []).map(getPerson).filter((k) => k && !seen.has(k.id));
  return (
    <ul className={depth ? 'mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-700' : 'space-y-1'}>
      {kids.map((k) => (
        <DescendantNode key={k.id} person={k} depth={depth} onOpen={onOpen} seen={new Set([...seen, k.id])} />
      ))}
    </ul>
  );
}

function DescendantNode({ person: k, depth, onOpen, seen }) {
  const [open, setOpen] = useState(false);
  const hasKids = (k.ch || []).some((id) => !seen.has(id));
  return (
    <li>
      <span className="flex items-center gap-1.5">
        {hasKids ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Ascunde urmașii' : 'Arată urmașii'}
            className="grid h-5 w-5 place-items-center rounded text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <PersonChip person={k} onOpen={onOpen} />
        {hasKids && !open && <span className="text-xs text-slate-400 dark:text-slate-500">{k.ch.length} {k.ch.length === 1 ? 'copil' : 'copii'}</span>}
      </span>
      {open && depth < 12 && <DescendantTree ids={k.ch} depth={depth + 1} onOpen={onOpen} seen={seen} />}
    </li>
  );
}

function FamilyRow({ label, people, onOpen }) {
  if (!people.length) return null;
  return (
    <>
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {people.map((o) => (
          <PersonChip key={o.id} person={o} onOpen={onOpen} />
        ))}
      </dd>
    </>
  );
}

function PersonChip({ person, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(person.slug)}
      title={personSubtitle(person) || undefined}
      className={
        'rounded-full border px-2.5 py-1 text-xs font-medium transition ' +
        (person.g === 'F'
          ? 'border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-950/40 dark:text-pink-200 dark:hover:bg-pink-900/40'
          : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/40')
      }
    >
      {personName(person)}
    </button>
  );
}

function Avatar({ person, large = false }) {
  const initial = personName(person).replace(/^\W+/, '').charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className={
        'grid shrink-0 place-items-center rounded-full font-bold ' +
        (large ? 'h-14 w-14 text-2xl ' : 'h-9 w-9 text-sm ') +
        (person.g === 'F'
          ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300'
          : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300')
      }
    >
      {initial}
    </span>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-3 py-1 text-sm transition ' +
        (active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
      }
    >
      {children}
    </button>
  );
}
