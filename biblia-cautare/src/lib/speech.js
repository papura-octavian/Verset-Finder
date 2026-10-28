// Citire cu voce tare prin vocile sistemului (Web Speech API): merge offline, fără server.
// Vocile depind de dispozitiv: Android și Edge au voci românești, Windows le are după
// ce adaugi limba română la „Vorbire"; Chrome pe desktop are de obicei doar engleză.

import { useEffect, useState } from 'react';

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Lista de voci, actualizată când browserul termină de le încărcat. */
export function useVoices() {
  const [voices, setVoices] = useState(() => (speechSupported ? speechSynthesis.getVoices() : []));
  useEffect(() => {
    if (!speechSupported) return undefined;
    const update = () => setVoices(speechSynthesis.getVoices());
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

/** Cea mai bună voce pentru o limbă („ro"/„en"): întâi cele naturale/online, apoi oricare. */
export function pickVoice(voices, lang) {
  const match = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  const rank = (v) => (/natural|online|neural|google/i.test(v.name) ? 0 : 1);
  return match.sort((a, b) => rank(a) - rank(b))[0] || null;
}

/**
 * Citește o listă de fragmente pe rând (câte un verset: vocile din Chrome se opresc
 * singure la texte lungi, iar așa știm ce verset se aude). Întoarce funcția de oprire.
 * @param {{ id: any, text: string }[]} parts
 */
export function speakParts(parts, { voice, lang, rate = 1, onPart, onEnd }) {
  if (!speechSupported) return () => {};
  speechSynthesis.cancel();
  let i = 0;
  let stopped = false;
  const next = () => {
    if (stopped) return;
    if (i >= parts.length) {
      onEnd?.();
      return;
    }
    const part = parts[i++];
    const u = new SpeechSynthesisUtterance(part.text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || (lang === 'ro' ? 'ro-RO' : 'en-US');
    u.rate = rate;
    u.onstart = () => onPart?.(part.id);
    u.onend = next;
    u.onerror = (e) => {
      // „interrupted"/„canceled" vin din oprirea noastră; altfel trecem la următorul.
      if (!stopped && e.error !== 'interrupted' && e.error !== 'canceled') next();
    };
    speechSynthesis.speak(u);
  };
  next();
  return () => {
    stopped = true;
    speechSynthesis.cancel();
  };
}

export const pauseSpeech = () => speechSupported && speechSynthesis.pause();
export const resumeSpeech = () => speechSupported && speechSynthesis.resume();
