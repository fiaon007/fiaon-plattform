// ═══════════════════════════════════════════════════════════════════════════
// Der Zustand des neuen Antrags im Browser (05.10.2026, E-282)
//
// Die Angaben selbst haben die Form aus shared/fiaon-antrag-neu.ts
// (AntragNeuDaten) — dieselbe, die der Server speichert. Dazu kommt, was nur
// die Seite braucht: Referenz, Prüfergebnis, Haken, Annahme, Zahlung.
//
// Gemerkt wird im Sitzungsspeicher (ein Neuladen verliert nichts). NIE darin:
// die PIN und die Unterschrift. Die Referenz steht zusätzlich im lokalen
// Speicher — mit dem Antrags-Cookie (48 Stunden) holt ein neuer Tab den Stand
// vom Server (GET /antrag-neu/:ref/stand).
// ═══════════════════════════════════════════════════════════════════════════
import {
  ANTRAG_NEU_LEER, ANTRAG_NEU_PAKETE, BERUF_TEXT, EINTRAG_TEXT, LANDNAME, SEIT_TEXT, WOHNEN_TEXT, ZWECK_TEXT,
  antragNeuDatenSauber, antragNeuPaket, geburtText, staatAnzeige,
  type AntragNeuDaten, type AntragNeuPaket, type AntragNeuSchritt,
} from "@shared/fiaon-antrag-neu";
import type { AuskunftVorab } from "@shared/fiaon-auskunft-buendel";

export type PruefPunkt = { id: string; titel: string; text: string; ok: boolean };

export interface Zustand extends AntragNeuDaten {
  ref: string | null;
  /** Adresse: Felder offen (gewählt oder selbst eingegeben). */
  adresseOffen: boolean;
  geprueftAm: string | null;
  pruefPunkte: PruefPunkt[] | null;
  doppelt: boolean;
  pinGesetzt: boolean;
  // Haken bei der Annahme
  ag1: boolean; ag3: boolean; ag4: boolean;
  /** E-284: Der gemeinsame Haken (AGB + Bestellung geprüft) wurde in DIESEM Stand gesetzt. */
  hakenKombi: boolean;
  angenommenAm: string | null;
  sofortBeginn: boolean | null;
  paymentReference: string | null;
  betrag: string | null;
  faellig: string | null;
  verknuepft: boolean;
  zahlungGemeldet: boolean;
  /** Wann „Ich habe überwiesen" gedrückt wurde (für „So geht es weiter"). */
  zahlungGemeldetAm: string | null;
  bezahlt: boolean;
  /** Nach „Angaben ändern": wohin es danach zurückgeht. */
  rueckZu: AntragNeuSchritt | "";
  /** Danke-Seite */
  auskunft: "" | "bestellt" | "selbst" | "habe";
  /**
   * Was die Adresse zur Auskunft mitbrachte (E-283, auskunftVorabAus): „gewuenscht" wählt
   * „Wir besorgen sie für Sie" vor (bestellt wird nie von selbst), „bestellt"/„da" bieten keine
   * zweite an. Gelesen beim Laden der Seite, wie das Paket.
   */
  auskunftVorab: AuskunftVorab;
  ak1: boolean; ak2: boolean;
  termin: { text: string; mit: string | null } | null;
  rueckruf: { text: string; mit: string | null } | null;
  passwort: boolean;
}

export const ZUSTAND_LEER: Zustand = {
  ...ANTRAG_NEU_LEER,
  ref: null, adresseOffen: false, geprueftAm: null, pruefPunkte: null, doppelt: false, pinGesetzt: false,
  ag1: false, ag3: false, ag4: false, hakenKombi: false, angenommenAm: null, sofortBeginn: null,
  paymentReference: null, betrag: null, faellig: null, verknuepft: false, zahlungGemeldet: false, zahlungGemeldetAm: null, bezahlt: false,
  rueckZu: "", auskunft: "", auskunftVorab: "", ak1: false, ak2: false, termin: null, rueckruf: null, passwort: false,
};

const SITZUNG = "fiaon_antrag_neu";
const REF_DAUERHAFT = "fiaon_antrag_neu_ref";

export function zustandLaden(): Zustand {
  try {
    const roh = JSON.parse(sessionStorage.getItem(SITZUNG) || "null");
    if (roh && typeof roh === "object") {
      const daten = antragNeuDatenSauber(roh, ANTRAG_NEU_LEER);
      const z: Zustand = { ...ZUSTAND_LEER, ...daten };
      for (const k of Object.keys(ZUSTAND_LEER) as (keyof Zustand)[]) {
        if (k in ANTRAG_NEU_LEER) continue;
        const v = roh[k], vorgabe = (ZUSTAND_LEER as any)[k];
        if (v === undefined) continue;
        if (vorgabe === null || typeof v === typeof vorgabe) (z as any)[k] = v;
      }
      return z;
    }
  } catch { /* leerer Start */ }
  return { ...ZUSTAND_LEER };
}

export function zustandMerken(z: Zustand): void {
  try { sessionStorage.setItem(SITZUNG, JSON.stringify(z)); } catch { /* privat — egal */ }
  try { if (z.ref) localStorage.setItem(REF_DAUERHAFT, JSON.stringify({ ref: z.ref, bis: Date.now() + 48 * 3600_000 })); } catch { /* egal */ }
}

export function dauerhafteRef(): string | null {
  try {
    const r = JSON.parse(localStorage.getItem(REF_DAUERHAFT) || "null");
    if (r && typeof r.ref === "string" && Number(r.bis) > Date.now()) return r.ref;
  } catch { /* egal */ }
  return null;
}

export function zustandVergessen(): void {
  try { sessionStorage.removeItem(SITZUNG); } catch { /* egal */ }
  try { localStorage.removeItem(REF_DAUERHAFT); } catch { /* egal */ }
}

/** Nur die Angaben (für den Server). */
export function datenAus(z: Zustand): AntragNeuDaten {
  return antragNeuDatenSauber(z, ANTRAG_NEU_LEER);
}

// ── Anzeige ──────────────────────────────────────────────────────────────
const PARTIKEL = ["von", "van", "der", "den", "de", "di", "da", "du", "del", "la", "le", "zu", "zum", "zur", "ten", "ter", "y"];
/** Schreibweise respektieren: nur ganz klein oder ganz GROSS Geschriebenes wird angepasst; „von", „de" bleiben klein. */
export function schoen(t: string): string {
  return String(t || "").trim().replace(/\s+/g, " ").split(" ").map((w) => {
    const klein = w === w.toLocaleLowerCase("de-DE"), gross = w.length > 1 && w === w.toLocaleUpperCase("de-DE");
    if (!klein && !gross) return w;
    if (klein && PARTIKEL.includes(w)) return w;
    return w.split("-").map((x) => (x ? x.charAt(0).toLocaleUpperCase("de-DE") + x.slice(1).toLocaleLowerCase("de-DE") : x)).join("-");
  }).join(" ");
}
export function kartenName(z: Pick<Zustand, "vorname" | "nachname">): string {
  const v = schoen(z.vorname), n = schoen(z.nachname);
  let voll = `${v} ${n}`.trim();
  if (voll.length > 26) {
    const t = v.split(" ");
    voll = `${t[0]} ${t.slice(1).map((x) => `${x.charAt(0)}.`).join(" ")} ${n}`.replace(/\s+/g, " ").trim();
  }
  return voll;
}
export function anredeWort(z: Pick<Zustand, "anrede">): string { return z.anrede === "Frau" || z.anrede === "Herr" ? `${z.anrede} ` : ""; }
export function anredeDativ(z: Pick<Zustand, "anrede">): string { return z.anrede === "Herr" ? "Herrn " : z.anrede === "Frau" ? "Frau " : ""; }
export function anrede(z: Pick<Zustand, "anrede" | "vorname" | "nachname">): string {
  return z.anrede === "Frau" || z.anrede === "Herr" ? `${z.anrede} ${schoen(z.nachname)}` : schoen(`${z.vorname} ${z.nachname}`);
}
export function anredeKurz(z: Pick<Zustand, "anrede" | "vorname" | "nachname">): string { const a = anrede(z); return a ? `, ${a}` : ""; }
export function anschriftText(z: Pick<Zustand, "strasse" | "nr" | "plz" | "ort">): string { return z.strasse ? `${z.strasse} ${z.nr}, ${z.plz} ${z.ort}` : ""; }
export function telefonText(z: Pick<Zustand, "vorwahl" | "telefon">): string { return z.telefon ? `${z.vorwahl} ${z.telefon}` : ""; }
export function einkommenText(z: Pick<Zustand, "einkommen">): string { return z.einkommen ? `${Number(z.einkommen).toLocaleString("de-DE")} € netto im Monat` : ""; }

export function paket(key: string): AntragNeuPaket { return antragNeuPaket(key) ?? ANTRAG_NEU_PAKETE[1]; }
export function paketIndex(key: string): number { const i = ANTRAG_NEU_PAKETE.findIndex((p) => p.key === key); return i < 0 ? 1 : i; }
export function naechstesPaket(key: string): AntragNeuPaket | null { return ANTRAG_NEU_PAKETE[paketIndex(key) + 1] ?? null; }
/** E-299: das nächstkleinere Paket (High-End → Ultra → Pro → Start) — für das Rettungsfenster an der Unterschrift. */
export function kleineresPaket(key: string): AntragNeuPaket | null { const i = paketIndex(key); return i > 0 ? ANTRAG_NEU_PAKETE[i - 1] ?? null : null; }

export function euro(n: number, dez = true): string {
  return `${Number(n).toLocaleString("de-DE", { minimumFractionDigits: dez ? 2 : 0, maximumFractionDigits: dez ? 2 : 0 })} €`;
}
export function datum(d: Date): string { return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }); }
export function uhr(d: Date): string { return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }); }

/** Die Angaben als Liste (Vertrag „Ihre Angaben", Sheet „Ihre Angaben"). */
export function datenZeilen(z: Zustand): [string, string][] {
  const beruf = z.beruf ? BERUF_TEXT[z.beruf] : "";
  const zusatz = (z.beruf === "angestellt" || z.beruf === "beamt") && z.arbeitgeber ? ` · ${z.arbeitgeber}` : z.beruf === "selbst" && z.branche ? ` · ${z.branche}` : "";
  const seit = z.seit && (z.beruf === "angestellt" || z.beruf === "beamt" || z.beruf === "selbst") ? ` · seit ${SEIT_TEXT[z.seit].replace("Jahre", "Jahren")}` : "";
  return ([
    ["Name", `${anredeWort(z)}${kartenName(z)}`],
    ["E-Mail", z.email],
    ["Mobil", telefonText(z)],
    ["Geboren", geburtText(z)],
    ["Anschrift", anschriftText(z) ? `${anschriftText(z)}, ${LANDNAME[z.land]}` : ""],
    ["Staatsangehörigkeit", staatAnzeige(z)],
    ["Beruf", beruf + zusatz + seit],
    ["Einkommen", einkommenText(z)],
    ["Wohnen", z.wohnen ? WOHNEN_TEXT[z.wohnen] : ""],
    ["Einträge", z.eintraege ? EINTRAG_TEXT[z.eintraege] : ""],
  ] as [string, string][]).filter(([, w]) => w && w.trim());
}

/** „mit Herrn Stripling" — die Terminseite liefert die Nennform im Nominativ („Herr Stripling"). */
export function mitWem(name: string | null | undefined): string {
  const n = String(name || "").trim();
  return n ? ` mit ${n.replace(/^Herr\s/, "Herrn ")}` : "";
}

export function zweckText(z: Pick<Zustand, "zweck">): string { return z.zweck.map((x) => ZWECK_TEXT[x]).join(", "); }

/** Gerade „ruhig" (System oder Aa-Knopf)? */
export function ruhigSystem(): boolean {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { return false; }
}
