// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — DIE REIHENFOLGE DER ANBIETER (17.09.2026, E-188)
//
//   SCHWEIZ      zefix (nur mit Konto) → uid-register → lindas
//   DEUTSCHLAND  openregister → handelsregister-ai      (beide nur mit Schlüssel)
//   ÖSTERREICH   firmenbuch                             (nur mit Schlüssel)
//
// DIE REGEL: Die Suche scheitert nie. Fällt ein Anbieter aus — Eimer leer,
// 429, Zeit um, kaputte Antwort —, ist der nächste dran. Ist keiner mehr da,
// ist die Trefferliste leer und der Hinweis „website" sagt der Oberfläche:
// Biete „Website eintragen → Impressum auslesen" an. Der Auftrag blockiert nie.
//
// GESAMTFRIST 2,5 s je Suche. LINDAS braucht länger (4–6 s, gemessen) und darf
// deshalb im Hintergrund zu Ende laufen: Die späte Antwort geht an
// „spaeteTreffer" und füllt den Cache — der nächste Tastendruck hat sie dann.
//
// Eine LEERE Antwort eines gesunden Anbieters ist eine Antwort, kein Ausfall:
// Dann wird nicht weitergefragt (das kostete in Deutschland Credits und in der
// Schweiz sechs Sekunden für dasselbe Ergebnis).
// ═══════════════════════════════════════════════════════════════════════════
import { type Anbieter, type Firma, type Land, type Treffer, AnbieterFehler, Eimer } from "./typen";
import { zefix } from "./zefix";
import { uidRegister } from "./uid-register";
import { lindas } from "./lindas";
import { openregister } from "./openregister";
import { handelsregisterAi } from "./handelsregister-ai";
import { firmenbuch } from "./firmenbuch";

export const REIHENFOLGE: Record<Land, Anbieter[]> = {
  CH: [zefix, uidRegister, lindas],
  DE: [openregister, handelsregisterAi],
  AT: [firmenbuch],
};

export const SUCH_FRIST_MS = 2500;
export const DETAIL_FRIST_MS = 8000;

const eimer = new Map<string, Eimer>();
function eimerFuer(a: Anbieter): Eimer {
  let e = eimer.get(a.kennung);
  if (!e) { e = new Eimer(a.proMinute); eimer.set(a.kennung, e); }
  return e;
}

export interface Versuch { anbieter: string; ms: number; ergebnis: "treffer" | "leer" | FehlerText }
type FehlerText = "drossel" | "zeit" | "netz" | "antwort" | "schluessel" | "eingabe" | "eimer_leer";

export interface SuchErgebnis {
  quelle: string;
  quelleText: string;
  treffer: Treffer[];
  hinweis?: "website";
  /** Warum die Liste leer ist — für die Oberfläche und fürs Log (ohne Suchbegriff). */
  grund?: "kein_anbieter" | "anbieter_ausgefallen" | "keine_treffer";
  versuche: Versuch[];
}

export interface SuchWunsch {
  fristMs?: number;
  anbieter?: Anbieter[];
  /** Eine Antwort, die erst NACH der Frist kam — für den Cache. */
  spaeteTreffer?: (anbieter: Anbieter, treffer: Treffer[]) => void;
}

const ZEIT_UM = Symbol("zeit_um");

export async function firmenSuchen(land: Land, q: string, wunsch: SuchWunsch = {}): Promise<SuchErgebnis> {
  const aktive = (wunsch.anbieter ?? REIHENFOLGE[land]).filter((a) => a.aktiv());
  const versuche: Versuch[] = [];
  const leer = (grund: SuchErgebnis["grund"]): SuchErgebnis =>
    ({ quelle: "keine", quelleText: "", treffer: [], hinweis: "website", grund, versuche });
  if (!aktive.length) return leer("kein_anbieter");

  const schluss = Date.now() + (wunsch.fristMs ?? SUCH_FRIST_MS);
  for (const a of aktive) {
    const rest = schluss - Date.now();
    if (rest < 150) break;
    if (!eimerFuer(a).nehmen()) { versuche.push({ anbieter: a.kennung, ms: 0, ergebnis: "eimer_leer" }); continue; }

    const start = Date.now();
    const abbruch = new AbortController();
    const darfNachlaufen = a.zeitMs > rest;
    const lauf = a.suchen(q, abbruch.signal);
    let wecker: ReturnType<typeof setTimeout> | undefined;
    const frist = new Promise<typeof ZEIT_UM>((ja) => { wecker = setTimeout(() => ja(ZEIT_UM), rest); });
    try {
      const erg = await Promise.race([lauf, frist]);
      if (erg === ZEIT_UM) {
        versuche.push({ anbieter: a.kennung, ms: Date.now() - start, ergebnis: "zeit" });
        if (darfNachlaufen && wunsch.spaeteTreffer) {
          lauf.then((t) => { if (t.length) wunsch.spaeteTreffer!(a, t); }).catch(() => {});
        } else {
          abbruch.abort();
          lauf.catch(() => {});
        }
        break;
      }
      versuche.push({ anbieter: a.kennung, ms: Date.now() - start, ergebnis: erg.length ? "treffer" : "leer" });
      if (!erg.length) return { quelle: a.kennung, quelleText: a.quelleText, treffer: [], hinweis: "website", grund: "keine_treffer", versuche };
      return { quelle: a.kennung, quelleText: a.quelleText, treffer: erg, versuche };
    } catch (e) {
      versuche.push({ anbieter: a.kennung, ms: Date.now() - start, ergebnis: e instanceof AnbieterFehler ? e.art : "antwort" });
    } finally {
      if (wecker) clearTimeout(wecker);
    }
  }
  return leer("anbieter_ausgefallen");
}

export interface DetailErgebnis { firma: Firma | null; versuche: Versuch[] }

/** Details: zuerst der Anbieter, aus dessen Liste der Treffer stammt; dann jeder andere des Landes, der die id versteht. */
export async function firmaDetail(land: Land, quelle: string, id: string, wunsch: { fristMs?: number; anbieter?: Anbieter[] } = {}): Promise<DetailErgebnis> {
  const alle = (wunsch.anbieter ?? REIHENFOLGE[land]).filter((a) => a.aktiv() && a.kenntId(id));
  const reihe = [...alle.filter((a) => a.kennung === quelle), ...alle.filter((a) => a.kennung !== quelle)];
  const versuche: Versuch[] = [];
  const schluss = Date.now() + (wunsch.fristMs ?? DETAIL_FRIST_MS);
  for (const a of reihe) {
    const rest = schluss - Date.now();
    if (rest < 300) break;
    if (!eimerFuer(a).nehmen()) { versuche.push({ anbieter: a.kennung, ms: 0, ergebnis: "eimer_leer" }); continue; }
    const start = Date.now();
    const abbruch = new AbortController();
    const wecker = setTimeout(() => abbruch.abort(), rest);
    try {
      const firma = await a.detail(id, abbruch.signal);
      versuche.push({ anbieter: a.kennung, ms: Date.now() - start, ergebnis: firma ? "treffer" : "leer" });
      if (firma) return { firma, versuche };
    } catch (e) {
      versuche.push({ anbieter: a.kennung, ms: Date.now() - start, ergebnis: e instanceof AnbieterFehler ? e.art : "antwort" });
    } finally {
      clearTimeout(wecker);
    }
  }
  return { firma: null, versuche };
}

/** Für die Statusroute und den Prüfstand: Welche Anbieter sind je Land gerade aktiv? */
export function anbieterLage(): Record<Land, { kennung: string; aktiv: boolean }[]> {
  const lage = {} as Record<Land, { kennung: string; aktiv: boolean }[]>;
  for (const land of Object.keys(REIHENFOLGE) as Land[]) lage[land] = REIHENFOLGE[land].map((a) => ({ kennung: a.kennung, aktiv: a.aktiv() }));
  return lage;
}
