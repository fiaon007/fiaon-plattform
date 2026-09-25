// ═══════════════════════════════════════════════════════════════════════════
// WOHER DIE AUSKUNFT KOMMT — DER ANSCHLUSS FÜR DIE API (25.09.2026, E-241)
//
// Justin: „Ich kümmere mich heute um die API, bis dahin kaufen wir sie selbst."
//
// ── DIE DREI LIEFERWEGE (fiaon_settings.auskunft_liefermodus) ─────────────
//   einkauf    (Standard) — nach der Zahlung entsteht ein Beschaffungsauftrag
//              (fiaon_auskunft_beschaffung, server/lib/fiaon-auskunft-lieferung.ts).
//              Ein Mensch beschafft die Auskunft und lädt sie im Chefbüro unter
//              „Auskunft-Beschaffung" hoch; der Upload legt sie in die Akte,
//              stößt die Analyse an und schreibt dem Kunden.
//   vollmacht  — der Weg vom 24.09. (E-240): je Auskunftei eine Anfrage als
//              Vorgang, Vollmacht und Anfragen per Unterschrift, Versand per Post.
//   api        — DIESE Datei: auskunftAbrufen() holt die Auskunft über die
//              Schnittstelle. Ist sie nicht angebunden oder scheitert sie, bleibt
//              der Auftrag im Einkauf — nichts geht verloren, niemand wartet still.
//
// ── HIER SETZT JUSTINS API EIN ────────────────────────────────────────────
// Solange AUSKUNFT_API_URL und AUSKUNFT_API_KEY nicht gesetzt sind, wirft
// auskunftAbrufen() AuskunftApiNichtAngebunden („API noch nicht angebunden").
// Sind sie gesetzt, gilt der Vertrag unten (anbieterAbruf): POST an die URL mit
// den Stammdaten als JSON, Antwort entweder direkt application/pdf oder JSON
// { ok, pdf_base64, dateiname, fehler, auskunfteien }. Spricht der Anbieter
// anders, wird NUR anbieterAbruf() ersetzt — Ein- und Ausgabe von
// auskunftAbrufen() bleiben, und damit alles, was die Lieferung danach tut
// (Ablage, Analyse, Mail, Auftrag „fertig").
//
// ── WAS VOR DEM ANSCHALTEN ZU KLÄREN IST ──────────────────────────────────
// · Welche Abfrage die Schnittstelle stellt: Eine Bonitätsprüfung über einen
//   Geschäftskunden-Zugang kann bei der Auskunftei als ANFRAGE gespeichert
//   werden — die Datenkopie des Kunden (Art. 15 DSGVO / Art. 25 DSG) nicht.
// · Ob die dokumentierte Vollmacht (Bestellseite oder Unterschrift) den Abruf
//   deckt. Ohne dokumentierte Einwilligung ruft die Lieferung hier nie ab.
// · Auftragsverarbeitung mit dem Anbieter (Art. 28 DSGVO) — es gehen Name,
//   Geburtsdatum und Anschrift hinaus.
// ═══════════════════════════════════════════════════════════════════════════
import type { AuskunftArt, AuskunftLand } from "@shared/fiaon-auskunft";

/** Die Daten, die eine Auskunftei zum Zuordnen braucht — dieselben, die der Arbeitsplatz zum Bestellen zeigt. */
export interface AuskunftStammdaten {
  vorname: string;
  nachname: string;
  /** Wie in der Akte erfasst (meist TT.MM.JJJJ oder JJJJ-MM-TT). */
  geburtsdatum: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: AuskunftLand;
  /** Frühere Anschrift, wenn der Kunde in den letzten Jahren umgezogen ist. */
  voranschrift: { strasse: string | null; plz: string | null; ort: string | null; land: string | null } | null;
  email: string | null;
  /** Nur bei der Firmen-Auskunft. */
  firma: { name: string | null; rechtsform: string | null } | null;
}

export interface AuskunftAbrufEin {
  /** Die Bestellung der Auskunft (FIAON-SCHUFA-…). */
  ref: string;
  personId: number;
  land: AuskunftLand;
  art: AuskunftArt;
  stammdaten: AuskunftStammdaten;
  /** Welche Auskunfteien gewünscht sind (Schlüssel aus shared/fiaon-auskunft.ts, dazu „firma"). */
  auskunfteien?: string[];
}

export interface AuskunftAbrufErgebnis {
  ok: boolean;
  pdf?: Buffer;
  dateiname?: string;
  /** Welche Auskunfteien das PDF enthält — ohne Angabe: alle gewünschten. */
  auskunfteien?: string[];
  fehler?: string;
}

/** Die Schnittstelle ist (noch) nicht angebunden — die Lieferung fällt auf den Einkauf zurück. */
export class AuskunftApiNichtAngebunden extends Error {
  constructor() {
    super("API noch nicht angebunden");
    this.name = "AuskunftApiNichtAngebunden";
  }
}

/** Ist die Schnittstelle eingerichtet? (Nur die Umgebung — ob sie antwortet, zeigt erst der Abruf.) */
export function auskunftApiAngebunden(): boolean {
  return !!String(process.env.AUSKUNFT_API_URL ?? "").trim() && !!String(process.env.AUSKUNFT_API_KEY ?? "").trim();
}

/** Wie lange ein Abruf dauern darf, bevor er als gescheitert gilt. */
const ABRUF_MS = 60_000;
/** Größer ist keine Auskunft — dieselbe Grenze wie der Upload im Kundenbereich. */
const PDF_MAX = 25 * 1024 * 1024;

const istPdf = (b: Buffer) => b.length > 4 && b.subarray(0, 1024).includes("%PDF", 0, "latin1");

/**
 * Die Auskunft über die Schnittstelle holen. Wirft AuskunftApiNichtAngebunden,
 * solange die Umgebung fehlt; jeder andere Fehler kommt als { ok: false, fehler }.
 */
export async function auskunftAbrufen(ein: AuskunftAbrufEin): Promise<AuskunftAbrufErgebnis> {
  if (!auskunftApiAngebunden()) throw new AuskunftApiNichtAngebunden();
  try {
    const erg = await anbieterAbruf(ein);
    if (!erg.ok) return { ok: false, fehler: erg.fehler || "Die Schnittstelle hat keine Auskunft geliefert." };
    if (!erg.pdf || !istPdf(erg.pdf)) return { ok: false, fehler: "Die Schnittstelle hat kein PDF geliefert." };
    if (erg.pdf.length > PDF_MAX) return { ok: false, fehler: "Das PDF der Schnittstelle ist größer als 25 MB." };
    return erg;
  } catch (e) {
    return { ok: false, fehler: String((e as Error)?.message || e).slice(0, 300) };
  }
}

/**
 * ── DER ANBIETER-TEIL — hier wird Justins API eingesetzt ─────────────────
 * Vertrag bis dahin (bewusst schlicht): POST {AUSKUNFT_API_URL}, Kopf
 * „Authorization: Bearer {AUSKUNFT_API_KEY}", Körper JSON mit referenz, land,
 * art, auskunfteien und person (die Stammdaten). Antwort: application/pdf ODER
 * JSON { ok, pdf_base64, dateiname, fehler, auskunfteien }.
 */
async function anbieterAbruf(ein: AuskunftAbrufEin): Promise<AuskunftAbrufErgebnis> {
  const url = String(process.env.AUSKUNFT_API_URL).trim();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${String(process.env.AUSKUNFT_API_KEY).trim()}`,
      "Content-Type": "application/json",
      Accept: "application/pdf, application/json",
    },
    body: JSON.stringify({
      referenz: ein.ref, land: ein.land, art: ein.art, auskunfteien: ein.auskunfteien ?? null, person: ein.stammdaten,
    }),
    signal: AbortSignal.timeout(ABRUF_MS),
  });
  const typ = String(r.headers.get("content-type") || "").toLowerCase();
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, fehler: `Schnittstelle antwortet mit HTTP ${r.status}${t ? `: ${t.slice(0, 200)}` : ""}` };
  }
  if (typ.includes("application/pdf")) {
    return { ok: true, pdf: Buffer.from(await r.arrayBuffer()), dateiname: `Auskunft_${ein.ref}.pdf` };
  }
  const j: any = await r.json().catch(() => null);
  if (!j) return { ok: false, fehler: "Die Antwort der Schnittstelle ist weder PDF noch JSON." };
  if (j.ok === false) return { ok: false, fehler: String(j.fehler || j.error || "Die Schnittstelle meldet einen Fehler.").slice(0, 300) };
  const b64 = String(j.pdf_base64 ?? "");
  if (!b64) return { ok: false, fehler: "Die Antwort der Schnittstelle enthält kein PDF." };
  return {
    ok: true,
    pdf: Buffer.from(b64, "base64"),
    dateiname: String(j.dateiname || `Auskunft_${ein.ref}.pdf`).slice(0, 120),
    auskunfteien: Array.isArray(j.auskunfteien) ? j.auskunfteien.map(String) : undefined,
  };
}
