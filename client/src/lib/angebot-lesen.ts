// ═══════════════════════════════════════════════════════════════════════════
// E-406 (19.10.2026): Welcher Abschnitt eines persönlichen Angebots stand wie lange auf dem Bildschirm?
// Jede Sekunde: der Abschnitt (<section aria-label>) in der Bildschirmmitte bekommt eine Sekunde — nur wenn die Seite
// sichtbar ist UND sich in der letzten Minute etwas bewegt hat. Alle 15 s und beim Verlassen gehen die SUMMEN an
// POST /api/fiaon/global/angebot/:token/lesen. Kein Cookie, kein Speicher im Browser: der Besuch ist eine Zufallszahl
// im Speicher dieser offenen Seite. Gegenstück: server/lib/fiaon-global-angebot-lesen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";

const RUHE_MS = 60_000;
const SENDEN_MS = 15_000;

function schluessel(el: HTMLElement): string {
  const roh = el.id || el.getAttribute("aria-label") || "";
  return roh.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss")
    .replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "abschnitt";
}
function besuchsNummer(): string {
  try { if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID(); } catch { /* unten */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Misst, solange `aktiv` (die Seite ist geladen). Ohne Token oder auf dem Server: nichts. */
export function useAngebotLesen(token: string, aktiv: boolean): void {
  useEffect(() => {
    if (!token || !aktiv || typeof window === "undefined" || typeof document === "undefined") return;
    const besuch = besuchsNummer();
    const url = `/api/fiaon/global/angebot/${encodeURIComponent(token)}/lesen`;
    const summen = new Map<string, { t: string; o: number; s: number }>();
    let gesamt = 0; let anzahl = 0; let neu = false; let zuletztGesendet = Date.now();
    let regung = Date.now();
    const bewegt = () => { regung = Date.now(); };
    const arten = ["scroll", "pointermove", "pointerdown", "keydown", "touchstart", "wheel"] as const;
    arten.forEach((a) => window.addEventListener(a, bewegt, { passive: true }));

    const senden = (ende: boolean) => {
      if (!neu && !ende) return;
      if (!gesamt) return;
      neu = false; zuletztGesendet = Date.now();
      const body = JSON.stringify({ besuch, gesamt, ende, anzahl, abschnitte: Array.from(summen, ([k, v]) => ({ k, ...v })) });
      try {
        if (ende && typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
          return;
        }
        void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "include" }).catch(() => {});
      } catch { /* Messen darf nie stören */ }
    };

    const tick = () => {
      if (document.visibilityState !== "visible" || Date.now() - regung > RUHE_MS) return;
      gesamt++; neu = true;
      const alle = Array.from(document.querySelectorAll<HTMLElement>("section[aria-label]"));
      anzahl = alle.length;
      const mitte = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.45);
      const el = (mitte?.closest("section[aria-label]") as HTMLElement | null) ?? null;
      if (el) {
        const k = schluessel(el);
        const v = summen.get(k);
        summen.set(k, { t: (el.getAttribute("aria-label") || k).slice(0, 80), o: Math.max(0, alle.indexOf(el)), s: (v?.s ?? 0) + 1 });
      }
      if (Date.now() - zuletztGesendet >= SENDEN_MS) senden(false);
    };
    const uhr = window.setInterval(tick, 1000);
    const sichtbarkeit = () => { if (document.visibilityState === "hidden") senden(true); };
    const weg = () => senden(true);
    document.addEventListener("visibilitychange", sichtbarkeit);
    window.addEventListener("pagehide", weg);
    return () => {
      window.clearInterval(uhr);
      arten.forEach((a) => window.removeEventListener(a, bewegt));
      document.removeEventListener("visibilitychange", sichtbarkeit);
      window.removeEventListener("pagehide", weg);
      senden(true);
    };
  }, [token, aktiv]);
}
