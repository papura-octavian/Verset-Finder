// Acces sigur la localStorage (poate fi restricționat pe file:// în unele browsere).

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignoră (cota plină / file:// blocat) */
  }
}
