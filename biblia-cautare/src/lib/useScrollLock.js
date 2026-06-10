import { useEffect } from 'react';

// Blocaj de scroll pe <body> cât timp un overlay (cititor, sertar) e deschis.
// Numărat la nivel de modul ca să suporte suprapuneri (se restaurează doar când
// ultimul blocaj dispare). Compensează lățimea scrollbar-ului cu padding-right,
// ca layout-ul să nu „salte" la deschidere/închidere.

let locks = 0;
let saved = null;

function lock() {
  if (locks === 0) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    saved = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
  }
  locks++;
}

function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks === 0 && saved) {
    document.body.style.overflow = saved.overflow;
    document.body.style.paddingRight = saved.paddingRight;
    saved = null;
  }
}

/** Blochează scroll-ul paginii cât timp `active` e true (și componenta e montată). */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lock();
    return unlock;
  }, [active]);
}
