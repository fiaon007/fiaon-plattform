// ═══════════════════════════════════════════════════════════════════════════
// SCHREIBEN — Vorlagen und PDF für die Anträge im Kundenbereich (Scheibe 5)
//
// Reine Funktionen, keine Datenbank. Der Router (fiaon-app-antraege.ts) holt
// Kundendaten und Antworten, ruft `schreibenErzeugen` und speichert das HTML;
// nach der Fingerunterschrift hängt er `unterschriftHtml` an und druckt mit
// `schreibenAlsPdf`.
//
// ── WESSEN ERKLÄRUNG DAS IST ───────────────────────────────────────────────
// Jedes Schreiben ist eine ERKLÄRUNG DES KUNDEN in Ich-Form. Absender ist der
// Kunde mit seiner Anschrift, unterschrieben wird von ihm. FIAON LTD übermittelt
// das unterschriebene Schreiben als Bote und nimmt Antworten entgegen — mehr
// nicht. FIAON gibt keine Rechtsauskunft, stellt keine Bescheinigung aus
// (die nach § 903 ZPO ausdrücklich nicht) und gibt keine eigenen Erklärungen
// im Namen des Kunden ab. Die Vollmacht sagt genau das.
//
// Zwei Arten fallen aus dem Muster und sind deshalb ausdrücklich markiert:
//   · „vollmacht“  — gerichtet AN FIAON, nicht übermittelt (eigene Markenzeile).
//   · „nachfrage“  — die Boten-Nachfrage in WIR-Form: FIAON erkundigt sich als
//                    Übermittler nach dem Bearbeitungsstand (das deckt die
//                    Vollmacht ausdrücklich). Absender ist FIAON, nicht der Kunde.
//   · „nachfass“   — die Erinnerung in ICH-Form bleibt eine Erklärung des Kunden
//                    und darf NUR mit seiner Unterschrift hinausgehen. Der
//                    Fristenwächter nutzt sie deshalb nicht (Prüffund 05.09.2026).
//
// ── SPRACHREGELN (bindend) ─────────────────────────────────────────────────
// Sie-Form gegenüber dem Kunden, Wortwand aus shared/fiaon-wortverbote.ts
// (scripts/pruef-schreiben.ts rendert jede Vorlage und prüft jeden Satz),
// keine Zeitprognose, keine Zahl, die nicht aus einem Datenfeld kommt, kein
// Prozentzeichen. Rechtsnormen werden genannt, nicht ausgelegt.
// ═══════════════════════════════════════════════════════════════════════════

import { renderDocumentPdf, docHash, escapeHtml } from "./fiaon-html-pdf";
import type { Antworten } from "@shared/fiaon-ansprueche";

// ── Arten ───────────────────────────────────────────────────────────────────

/** Die Antragsarten, für die es ein Schreiben und eine Vollmacht-Zeile gibt. */
export type AntragsArt = "p_konto" | "p_konto_umwandlung" | "rundfunk" | "wohngeld" | "kfz" | "handy";

export type SchreibenArt = "vollmacht" | AntragsArt | "nachfass" | "nachfrage";

export const ANTRAGSARTEN: readonly AntragsArt[] = ["p_konto", "p_konto_umwandlung", "rundfunk", "wohngeld", "kfz", "handy"];

/** Klartext je Antragsart — für die Vollmacht-Zeilen und die Kästchen auf der Unterschriftseite. */
export const ANTRAGSART_KLARTEXT: Record<AntragsArt, { titel: string; stelle: string }> = {
  p_konto: { titel: "Höherer Schutzbetrag auf dem P-Konto", stelle: "meine kontoführende Bank" },
  p_konto_umwandlung: { titel: "Umwandlung meines Girokontos in ein P-Konto", stelle: "meine kontoführende Bank" },
  rundfunk: { titel: "Befreiung vom Rundfunkbeitrag", stelle: "ARD ZDF Deutschlandradio Beitragsservice" },
  wohngeld: { titel: "Anschreiben an die Wohngeldstelle", stelle: "die Wohngeldstelle meiner Stadt oder Gemeinde" },
  kfz: { titel: "Kündigung meiner Kfz-Versicherung", stelle: "meinen Kfz-Versicherer" },
  handy: { titel: "Kündigung meines Mobilfunkvertrags", stelle: "meinen Mobilfunkanbieter" },
};

/**
 * Zeilen, die eine Vollmacht umfassen kann — die sechs Antragsarten plus die
 * Selbstauskunft (Vorgangsart aus 080, ohne eigene Vorlage hier). Der Router
 * gibt `vollmachtUmfang` als diese SCHLÜSSEL; unbekannte Werte fallen weg.
 */
export const VOLLMACHT_ZEILEN: Record<string, { titel: string; stelle: string }> = {
  ...ANTRAGSART_KLARTEXT,
  selbstauskunft: { titel: "Selbstauskunft nach Art. 15 DSGVO", stelle: "die Auskunfteien" },
};
export const VOLLMACHT_UMFANG_SCHLUESSEL: readonly string[] = Object.keys(VOLLMACHT_ZEILEN);

/** Regel aus shared/fiaon-ansprueche.ts → Antragsart (Spec: Regel→Vorgangsart). */
const REGEL_ZU_ART: Record<string, AntragsArt> = {
  p_konto_erhoehung: "p_konto",
  p_konto_umwandlung: "p_konto_umwandlung",
  rundfunk_befreiung: "rundfunk",
  wohngeld_pruefung: "wohngeld",
  kfz_vergleich: "kfz",
  handy_vergleich: "handy",
};

export function antragsArtFuerRegel(regelSchluessel: string): AntragsArt | null {
  return REGEL_ZU_ART[String(regelSchluessel || "")] ?? null;
}

export function istAntragsArt(x: unknown): x is AntragsArt {
  return typeof x === "string" && (ANTRAGSARTEN as readonly string[]).includes(x);
}

// ── Daten ───────────────────────────────────────────────────────────────────

export interface SchreibenKunde {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  /** dd.mm.yyyy (ISO wird umgeformt). */
  geburtsdatum?: string | null;
}

export interface SchreibenDaten {
  kunde: SchreibenKunde;
  /** Form „AZ 2026-000123“. */
  aktenzeichen: string;
  /** dd.mm.yyyy — der Tag, an dem das Schreiben erzeugt wird (Berlin). */
  datum: string;
  antworten?: Antworten | null;
  betragCents?: number | null;
  /** Empfänger, wenn bekannt (z. B. Name der Bank aus der Akte). Fehlt er, steht die Stelle allgemein. */
  empfaenger?: { name: string; adresse?: string | null } | null;
  /** Nur Vollmacht: Antragsarten, die die Vollmacht umfasst. Leer = alle. */
  vollmachtUmfang?: string[] | null;
  /** Nur Nachfass: das Schreiben, an das erinnert wird. */
  bezug?: { aktenzeichen: string; versandtAm: string; empfaenger: string } | null;
  /** Nur Kündigungen: Vertrags- oder Kundennummer und Kennzeichen, wenn der Kunde sie angegeben hat. */
  vertrag?: { nummer?: string | null; kennzeichen?: string | null } | null;
}

export interface Schreiben {
  titel: string;
  empfaengerName: string;
  empfaengerAdresse: string | null;
  html: string;
  /** Sie-Form, für die Karte „Was das für Sie heißt“. */
  hinweisFuerKunden: string;
  /** Fußzeile für das PDF — bei Anträgen „Übermittelt durch FIAON LTD …“, bei der Boten-Nachfrage „Nachfrage im Auftrag von …“. */
  fusszeile: string;
  /** Markenzeile im PDF-Kopf — nur gesetzt, wenn die Art nicht „übermittelt“ wird (Vollmacht, Nachfrage). */
  markenzeile?: string;
}

// ── Helfer ──────────────────────────────────────────────────────────────────

const FIAON_NAME = "FIAON LTD";
const FIAON_ADRESSE = "128 City Road\nLondon EC1V 2NX\nVereinigtes Königreich";

export function fusszeileFuer(aktenzeichen: string): string {
  return `Übermittelt durch FIAON LTD im Auftrag des Absenders. Aktenzeichen ${String(aktenzeichen || "").trim()}`;
}

/** Markenzeile im PDF-Kopf je Art — die Vollmacht und die Boten-Nachfrage werden nicht „übermittelt“. */
export function markenzeileFuer(art: SchreibenArt): string {
  if (art === "vollmacht") return "Vollmacht zur Übermittlung – erteilt an FIAON LTD";
  if (art === "nachfrage") return "Nachfrage der FIAON LTD als Übermittler";
  return "Übermittelt durch FIAON LTD im Auftrag des Absenders";
}

/** Ein Aktenzeichen, das gedruckt werden darf — leer oder „–“ (Platzhalter des Routers) zählt nicht. */
function aktenzeichenGesetzt(az: unknown): boolean {
  const s = String(az ?? "").trim();
  return s.length > 0 && s !== "–" && s !== "-";
}

const eur = (cents: number): string =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

const ZAHLWORT = ["keine", "eine", "zwei", "drei", "vier", "fünf"];

/** ISO (yyyy-mm-dd…) → dd.mm.yyyy; alles andere unverändert. */
export function datumDeutsch(roh: string | null | undefined): string {
  const s = String(roh ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}

/** dd.mm.yyyy plus n Monate, Tag auf Monatslänge gekappt — ohne Zeitzone, rein rechnerisch. */
export function datumPlusMonate(datum: string, monate: number): string | null {
  const m = String(datum || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const t = Number(m[1]); const mo = Number(m[2]); const j = Number(m[3]);
  if (!t || !mo || !j) return null;
  const gesamt = mo - 1 + monate;
  const jNeu = j + Math.floor(gesamt / 12);
  const moNeu = ((gesamt % 12) + 12) % 12; // 0-basiert
  const tageImMonat = new Date(Date.UTC(jNeu, moNeu + 1, 0)).getUTCDate();
  const tNeu = Math.min(t, tageImMonat);
  const zz = (n: number) => String(n).padStart(2, "0");
  return `${zz(tNeu)}.${zz(moNeu + 1)}.${jNeu}`;
}

const zeilen = (text: string): string =>
  String(text || "").split(/\r?\n/).map((z) => z.trim()).filter(Boolean).map(escapeHtml).join("<br>");

const absatz = (text: string): string => `<p>${text}</p>`;

function vollerName(k: SchreibenKunde): string {
  return [k.vorname, k.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
}

function absenderBlock(k: SchreibenKunde): string {
  const teile = [vollerName(k), k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter((x) => String(x || "").trim());
  const geb = k.geburtsdatum ? `<br><span class="muted">geboren am ${escapeHtml(datumDeutsch(k.geburtsdatum))}</span>` : "";
  return `<div class="absender" style="margin:0 0 18px;line-height:1.45;">${teile.map(escapeHtml).join("<br>")}${geb}</div>`;
}

function empfaengerBlock(name: string, adresse: string | null): string {
  const inhalt = [escapeHtml(name), adresse ? zeilen(adresse) : ""].filter(Boolean).join("<br>");
  return `<div class="empfaenger" style="margin:0 0 22px;line-height:1.45;">${inhalt}</div>`;
}

function datumZeile(datum: string): string {
  return `<div class="datum" style="text-align:right;margin:0 0 18px;">${escapeHtml(datum)}</div>`;
}

function betreff(text: string): string {
  return `<p class="betreff" style="font-weight:700;margin:0 0 14px;">${text}</p>`;
}

function gruss(k: SchreibenKunde): string {
  return `<p style="margin-top:18px;">Mit freundlichen Grüßen</p>`
    + `<div class="unterschrift-platz" data-unterschrift="hier" style="min-height:24px;"></div>`
    + `<p>${escapeHtml(vollerName(k))}</p>`;
}

function anlagen(liste: string[]): string {
  if (!liste.length) return "";
  return `<p class="muted" style="margin-top:16px;">Anlagen:<br>${liste.map(escapeHtml).join("<br>")}</p>`;
}

/** Kopf jedes Schreibens: Absender, Empfänger, Datum, Betreff. */
function kopf(d: SchreibenDaten, empfName: string, empfAdresse: string | null, betreffText: string): string {
  return absenderBlock(d.kunde) + empfaengerBlock(empfName, empfAdresse) + datumZeile(d.datum) + betreff(betreffText);
}

function empfaengerOder(d: SchreibenDaten, rueckfallName: string, rueckfallAdresse: string | null = null): { name: string; adresse: string | null } {
  const n = String(d.empfaenger?.name || "").trim();
  if (n) return { name: n, adresse: String(d.empfaenger?.adresse || "").trim() || null };
  return { name: rueckfallName, adresse: rueckfallAdresse };
}

function personenText(n: number): string {
  const k = Math.max(0, Math.floor(n));
  const wort = k < ZAHLWORT.length ? ZAHLWORT[k] : String(k);
  return k === 1 ? `${wort} unterhaltsberechtigte Person` : `${wort} unterhaltsberechtigte Personen`;
}

// ── Vorlagen ────────────────────────────────────────────────────────────────

function vollmacht(d: SchreibenDaten): Schreiben {
  // Schlüssel (p_konto, rundfunk, selbstauskunft …) in fester Reihenfolge; leer = die sechs Antragsarten.
  const gewaehlt = (d.vollmachtUmfang ?? []).map((x) => String(x ?? "").trim()).filter((x) => x in VOLLMACHT_ZEILEN);
  const umfang: string[] = gewaehlt.length ? VOLLMACHT_UMFANG_SCHLUESSEL.filter((a) => gewaehlt.includes(a)) : [...ANTRAGSARTEN];
  const gueltigBis = datumPlusMonate(d.datum, 12);
  const name = vollerName(d.kunde);

  const zeilenHtml = umfang.map((a) => {
    const k = VOLLMACHT_ZEILEN[a];
    return `<li>${escapeHtml(k.titel)} – Übermittlung an ${escapeHtml(k.stelle)}</li>`;
  }).join("");

  const html = kopf(d, FIAON_NAME, FIAON_ADRESSE, "Vollmacht zur Übermittlung")
    + absatz(`Ich, ${escapeHtml(name)}, bevollmächtige die ${escapeHtml(FIAON_NAME)}, die von mir unterzeichneten Erklärungen und Anträge an die jeweils genannten Stellen zu übermitteln, den Bearbeitungsstand dieser Erklärungen bei den Stellen zu erfragen sowie Eingangsbestätigungen und Antworten dieser Stellen für mich entgegenzunehmen und mir in meinem Kundenbereich zugänglich zu machen.`)
    + absatz(`Die Vollmacht umfasst folgende Erklärungen:`)
    + `<ul style="margin:0 0 12px 18px;padding:0;">${zeilenHtml}</ul>`
    + absatz(`Die Vollmacht berechtigt nicht dazu, in meinem Namen eigene Erklärungen abzugeben, Anträge zu ändern, Verträge zu schließen oder zu kündigen, Zahlungen entgegenzunehmen oder Rechtsauskünfte zu erteilen. Inhalt und Unterschrift jeder Erklärung stammen von mir.`)
    + absatz(`Die Vollmacht gilt zwölf Monate ab dem Tag meiner Unterschrift${gueltigBis ? `, längstens bis zum ${escapeHtml(gueltigBis)}` : ""}. Ich kann sie jederzeit ohne Angabe von Gründen widerrufen, auch in meinem Kundenbereich. Bereits übermittelte Erklärungen bleiben vom Widerruf unberührt.`)
    + (aktenzeichenGesetzt(d.aktenzeichen) ? absatz(`Aktenzeichen: ${escapeHtml(d.aktenzeichen)}`) : "")
    + gruss(d.kunde);

  return {
    titel: "Vollmacht zur Übermittlung",
    empfaengerName: FIAON_NAME,
    empfaengerAdresse: FIAON_ADRESSE,
    html,
    hinweisFuerKunden: "Mit dieser Vollmacht darf FIAON Ihre unterschriebenen Schreiben an die genannten Stellen übermitteln, dort nach dem Bearbeitungsstand fragen und die Antworten für Sie entgegennehmen. FIAON gibt keine eigenen Erklärungen in Ihrem Namen ab. Sie können die Vollmacht jederzeit unter Mehr › Vollmachten widerrufen.",
    fusszeile: fusszeileFuer(d.aktenzeichen),
    markenzeile: markenzeileFuer("vollmacht"),
  };
}

function pKonto(d: SchreibenDaten): Schreiben {
  const e = empfaengerOder(d, "An meine kontoführende Bank");
  const name = vollerName(d.kunde);
  const n = Math.floor(Number(d.antworten?.unterhalt ?? 0));
  const personen = n > 0 ? personenText(n) : "die in der Bescheinigung genannten unterhaltsberechtigten Personen";
  const betrag = typeof d.betragCents === "number" && d.betragCents > 0
    ? absatz(`Nach der Pfändungsfreigrenzenbekanntmachung ergibt sich für diese Personenzahl eine Erhöhung des geschützten Betrags um ${escapeHtml(eur(d.betragCents))} im Monat. Maßgeblich ist der Betrag, den Sie nach der Bescheinigung feststellen.`)
    : "";

  const html = kopf(d, e.name, e.adresse, "Antrag auf Erhöhung des pfändungsfreien Betrags auf meinem Pfändungsschutzkonto (§ 902 ZPO)")
    + absatz(`Ich, ${escapeHtml(name)}, führe bei Ihnen ein Pfändungsschutzkonto. Ich beantrage, den pfändungsfreien Betrag auf diesem Konto nach § 902 Satz 1 Nr. 1 ZPO in Verbindung mit § 850c ZPO zu erhöhen, weil ich ${escapeHtml(personen)} versorge.`)
    + betrag
    + absatz(`Die dafür erforderliche Bescheinigung nach § 903 ZPO füge ich bei oder reiche sie nach. Sie stammt von einer der dazu berechtigten Stellen – Arbeitgeber, Familienkasse, Jobcenter oder Sozialamt, Rechtsanwalt, Steuerberater oder einer anerkannten Schuldnerberatungsstelle. Die FIAON LTD, die dieses Schreiben für mich übermittelt, stellt keine solche Bescheinigung aus.`)
    + absatz(`Bitte berücksichtigen Sie den erhöhten Freibetrag ab dem Zeitpunkt, den das Gesetz vorsieht, und bestätigen Sie mir die Änderung schriftlich. Bitte richten Sie Ihre Antwort an meine oben genannte Anschrift.`)
    + gruss(d.kunde)
    + anlagen(["Bescheinigung nach § 903 ZPO (beigefügt oder nachgereicht)"]);

  return {
    titel: "Antrag auf höheren Schutzbetrag auf dem P-Konto",
    empfaengerName: e.name,
    empfaengerAdresse: e.adresse,
    html,
    hinweisFuerKunden: "Mit diesem Schreiben beantragen Sie bei Ihrer Bank einen höheren geschützten Betrag auf Ihrem P-Konto. Die Bank braucht dafür eine Bescheinigung nach § 903 ZPO – die bekommen Sie zum Beispiel beim Jobcenter, bei der Familienkasse, beim Arbeitgeber oder bei einer anerkannten Schuldnerberatungsstelle. FIAON stellt diese Bescheinigung nicht aus. Über den Betrag entscheidet die Bank.",
    fusszeile: fusszeileFuer(d.aktenzeichen),
  };
}

function pKontoUmwandlung(d: SchreibenDaten): Schreiben {
  const e = empfaengerOder(d, "An meine kontoführende Bank");
  const name = vollerName(d.kunde);
  const pfaendung = d.antworten?.pfaendung === true
    // Formulierung Dr. Hepp vorlegen (Prüffund 05.09.2026): § 850k Abs. 2 ZPO nennt den vierten Geschäftstag, keine Rückwirkung.
    ? absatz(`Auf mein Konto wirkt derzeit eine Pfändung. Ich bitte Sie deshalb, die Umwandlung zum frühestmöglichen gesetzlichen Zeitpunkt vorzunehmen und mir diesen Tag zu nennen.`)
    : "";

  const html = kopf(d, e.name, e.adresse, "Verlangen auf Führung meines Girokontos als Pfändungsschutzkonto (§ 850k ZPO)")
    + absatz(`Ich, ${escapeHtml(name)}, verlange nach § 850k Absatz 1 ZPO, dass Sie mein bei Ihnen geführtes Girokonto als Pfändungsschutzkonto führen. Nach dem Gesetz haben Sie die Umstellung binnen vier Geschäftstagen nach Zugang dieses Verlangens vorzunehmen.`)
    + pfaendung
    + absatz(`Ich erkläre, dass ich kein weiteres Pfändungsschutzkonto führe. Bitte bestätigen Sie mir die Umstellung und den Tag, ab dem sie gilt, schriftlich. Bitte richten Sie Ihre Antwort an meine oben genannte Anschrift.`)
    + gruss(d.kunde);

  return {
    titel: "Umwandlung in ein P-Konto",
    empfaengerName: e.name,
    empfaengerAdresse: e.adresse,
    html,
    hinweisFuerKunden: "Mit diesem Schreiben verlangen Sie von Ihrer Bank, Ihr Girokonto als P-Konto zu führen. Das Gesetz gibt der Bank dafür vier Geschäftstage. Auf dem P-Konto ist dann ein Grundbetrag im Monat vor Pfändungen geschützt; die Höhe ergibt sich aus dem Gesetz. Sobald die Bestätigung der Bank kommt, fotografieren Sie sie hier.",
    fusszeile: fusszeileFuer(d.aktenzeichen),
  };
}

function rundfunk(d: SchreibenDaten): Schreiben {
  const e = empfaengerOder(d, "ARD ZDF Deutschlandradio Beitragsservice", "50656 Köln");
  const name = vollerName(d.kunde);

  const html = kopf(d, e.name, e.adresse, "Antrag auf Befreiung von der Rundfunkbeitragspflicht (§ 4 Abs. 1 RBStV)")
    + absatz(`Ich, ${escapeHtml(name)}, beantrage die Befreiung von der Rundfunkbeitragspflicht für meine Wohnung unter der oben genannten Anschrift nach § 4 Absatz 1 Rundfunkbeitragsstaatsvertrag.`)
    + absatz(`Ich beziehe eine der dort genannten Sozialleistungen. Den aktuellen Leistungsbescheid füge ich als Anlage bei. Ich bitte darum, die Befreiung ab Beginn des Leistungsbezugs und rückwirkend, soweit das nach § 4 Absatz 4 RBStV zulässig ist, auszusprechen und bereits gezahlte Beiträge für diesen Zeitraum zu erstatten.`)
    + absatz(`Bitte bestätigen Sie mir die Befreiung und den Zeitraum schriftlich. Bitte richten Sie Ihre Antwort an meine oben genannte Anschrift.`)
    + gruss(d.kunde)
    + anlagen(["Aktueller Leistungsbescheid (Kopie)"]);

  return {
    titel: "Befreiung vom Rundfunkbeitrag",
    empfaengerName: e.name,
    empfaengerAdresse: e.adresse,
    html,
    hinweisFuerKunden: "Mit diesem Antrag bitten Sie den Beitragsservice, Sie vom Rundfunkbeitrag zu befreien. Dazu gehört Ihr aktueller Leistungsbescheid als Anlage – ohne ihn kann der Beitragsservice nicht entscheiden. Über die Befreiung und den Zeitraum entscheidet der Beitragsservice.",
    fusszeile: fusszeileFuer(d.aktenzeichen),
  };
}

function wohngeld(d: SchreibenDaten): Schreiben {
  const ort = String(d.kunde.ort || "").trim();
  const e = empfaengerOder(d, ort ? `Wohngeldstelle ${ort}` : "Wohngeldstelle meiner Stadt oder Gemeinde", null);
  const name = vollerName(d.kunde);
  const a = d.antworten ?? {};
  const angaben: string[] = [];
  if (typeof a.haushalt === "number" && a.haushalt > 0) angaben.push(`Personen im Haushalt (mich eingerechnet): ${escapeHtml(String(Math.floor(a.haushalt)))}`);
  if (typeof a.warmmiete_cents === "number" && a.warmmiete_cents > 0) angaben.push(`Warmmiete im Monat: ${escapeHtml(eur(a.warmmiete_cents))}`);
  if (typeof a.netto_cents === "number" && a.netto_cents > 0) angaben.push(`Nettoeinkommen im Monat (alle Einkünfte): ${escapeHtml(eur(a.netto_cents))}`);
  const angabenHtml = angaben.length
    ? absatz(`Zu meiner Situation:`) + `<ul style="margin:0 0 12px 18px;padding:0;">${angaben.map((z) => `<li>${z}</li>`).join("")}</ul>`
    : "";

  const html = kopf(d, e.name, e.adresse, "Wohngeld – Bitte um Antragsunterlagen oder einen Termin")
    + absatz(`Ich, ${escapeHtml(name)}, möchte für meine Wohnung unter der oben genannten Anschrift Wohngeld nach dem Wohngeldgesetz beantragen. Ich bitte Sie, mir die Antragsunterlagen zuzusenden oder mir einen Termin zur Antragstellung zu nennen.`)
    + angabenHtml
    + absatz(`Die Unterlagen, die Sie für die Entscheidung benötigen, reiche ich auf Ihre Nachricht hin ein. Bitte richten Sie Ihre Antwort an meine oben genannte Anschrift.`)
    + gruss(d.kunde);

  return {
    titel: "Anschreiben an die Wohngeldstelle",
    empfaengerName: e.name,
    empfaengerAdresse: e.adresse,
    html,
    hinweisFuerKunden: "Wohngeld-Formulare sind Ländersache. Mit diesem Schreiben bitten Sie Ihre Wohngeldstelle um die Unterlagen oder einen Termin. Ob und wie viel Wohngeld in Frage kommt, entscheidet die Wohngeldstelle nach Miete, Einkommen und Haushaltsgröße.",
    fusszeile: fusszeileFuer(d.aktenzeichen),
  };
}

function kuendigung(d: SchreibenDaten, art: "kfz" | "handy"): Schreiben {
  const istKfz = art === "kfz";
  const e = empfaengerOder(d, istKfz ? "An meinen Kfz-Versicherer" : "An meinen Mobilfunkanbieter");
  const name = vollerName(d.kunde);
  const nummer = String(d.vertrag?.nummer || "").trim();
  const kennzeichen = String(d.vertrag?.kennzeichen || "").trim();
  const kennung: string[] = [];
  if (nummer) kennung.push(`${istKfz ? "Versicherungsschein-Nummer" : "Kunden- oder Vertragsnummer"}: ${escapeHtml(nummer)}`);
  if (istKfz && kennzeichen) kennung.push(`Amtliches Kennzeichen: ${escapeHtml(kennzeichen)}`);
  const kennungHtml = kennung.length ? absatz(kennung.join("<br>")) : absatz(`Zur Zuordnung dienen mein Name, meine Anschrift${d.kunde.geburtsdatum ? " und mein Geburtsdatum" : ""} wie oben angegeben.`);

  const gegenstand = istKfz ? "meine Kfz-Versicherung" : "meinen Mobilfunkvertrag";
  const norm = istKfz
    ? "Maßgeblich ist der nächstmögliche Termin nach den vertraglichen Bestimmungen und § 11 VVG."
    : "Maßgeblich ist der nächstmögliche Termin nach den vertraglichen Bestimmungen und § 56 TKG.";

  const html = kopf(d, e.name, e.adresse, istKfz ? "Kündigung meiner Kfz-Versicherung" : "Kündigung meines Mobilfunkvertrags")
    + kennungHtml
    + absatz(`Ich, ${escapeHtml(name)}, kündige ${gegenstand} zum nächstmöglichen Termin. ${norm} Sollte die Kündigung zu diesem Termin nicht wirksam sein, gilt sie zum nächsten zulässigen Termin.`)
    + absatz(`Bitte nennen Sie mir den Tag des Vertragsendes schriftlich und senden Sie mir eine Eingangsbestätigung. Der Verwendung meiner Daten zu Werbezwecken widerspreche ich (Art. 21 Abs. 2 DSGVO). Bitte richten Sie Ihre Antwort an meine oben genannte Anschrift.`)
    + gruss(d.kunde);

  return {
    titel: istKfz ? "Kündigung der Kfz-Versicherung" : "Kündigung des Mobilfunkvertrags",
    empfaengerName: e.name,
    empfaengerAdresse: e.adresse,
    html,
    hinweisFuerKunden: istKfz
      ? "Mit diesem Schreiben kündigen Sie Ihre bisherige Kfz-Versicherung zum nächstmöglichen Termin. Den neuen Vertrag wählen Sie selbst über den Vergleich in Ihrem Bereich – schließen Sie ihn ab, bevor der alte endet, damit Ihr Fahrzeug durchgehend versichert bleibt. Den Tag des Vertragsendes nennt Ihnen der Versicherer."
      : "Mit diesem Schreiben kündigen Sie Ihren bisherigen Mobilfunkvertrag zum nächstmöglichen Termin. Den neuen Tarif wählen Sie selbst über den Vergleich in Ihrem Bereich. Den Tag des Vertragsendes nennt Ihnen der Anbieter; wenn Sie Ihre Rufnummer mitnehmen möchten, beantragen Sie das beim neuen Anbieter.",
    fusszeile: fusszeileFuer(d.aktenzeichen),
  };
}

/**
 * Erinnerung in ICH-Form — eine Erklärung des Kunden. Sie geht NUR mit seiner
 * Unterschrift hinaus (Unterschrift-Fluss wie beim Antrag). Ohne Unterschrift
 * nimmt der Fristenwächter die Boten-Nachfrage `nachfrage` (Wir-Form).
 */
function nachfass(d: SchreibenDaten): Schreiben {
  const b = d.bezug ?? { aktenzeichen: d.aktenzeichen, versandtAm: "", empfaenger: "" };
  const e = empfaengerOder(d, String(b.empfaenger || "").trim() || "An die angeschriebene Stelle");
  const name = vollerName(d.kunde);
  const versandtAm = datumDeutsch(b.versandtAm);

  const html = kopf(d, e.name, e.adresse, `Erinnerung an mein Schreiben${versandtAm ? ` vom ${escapeHtml(versandtAm)}` : ""} – Aktenzeichen ${escapeHtml(b.aktenzeichen)}`)
    + absatz(`Ich, ${escapeHtml(name)}, habe Ihnen${versandtAm ? ` am ${escapeHtml(versandtAm)}` : ""} ein Schreiben unter dem oben genannten Aktenzeichen übermittelt. Eine Antwort liegt mir bis heute nicht vor.`)
    + absatz(`Ich bitte Sie höflich, mir den Stand der Bearbeitung mitzuteilen und mir Ihre Entscheidung schriftlich zukommen zu lassen. Falls Ihnen Unterlagen fehlen, nennen Sie mir bitte, welche.`)
    + absatz(`Bitte richten Sie Ihre Antwort an meine oben genannte Anschrift.`)
    + gruss(d.kunde);

  return {
    titel: `Erinnerung – ${b.aktenzeichen}`,
    empfaengerName: e.name,
    empfaengerAdresse: e.adresse,
    html,
    hinweisFuerKunden: "Auf Ihr Schreiben ist keine Antwort gekommen. Mit dieser Erinnerung fragen Sie selbst bei der Stelle nach – sie geht erst hinaus, wenn Sie sie unterschrieben haben. Sobald eine Antwort kommt, liegt sie hier in Ihrer Akte.",
    fusszeile: fusszeileFuer(d.aktenzeichen),
  };
}

/**
 * Boten-Nachfrage in WIR-Form: FIAON erkundigt sich als Übermittler nach dem
 * Bearbeitungsstand — keine Erklärung im Namen des Kunden, keine Änderung des
 * Antrags. Genau das deckt die Vollmacht („den Bearbeitungsstand … zu erfragen“).
 * Absender ist FIAON LTD; der Kunde wird mit Name und Anschrift benannt, damit
 * die Stelle das Schreiben zuordnen und ihm direkt antworten kann.
 */
function nachfrage(d: SchreibenDaten): Schreiben {
  const b = d.bezug ?? { aktenzeichen: d.aktenzeichen, versandtAm: "", empfaenger: "" };
  const e = empfaengerOder(d, String(b.empfaenger || "").trim() || "An die angeschriebene Stelle");
  const name = vollerName(d.kunde);
  const anschrift = [d.kunde.strasse, [d.kunde.plz, d.kunde.ort].filter(Boolean).join(" ")].filter((x) => String(x || "").trim()).join(", ");
  const versandtAm = datumDeutsch(b.versandtAm);
  const az = String(b.aktenzeichen || d.aktenzeichen || "").trim();

  const absender = `<div class="absender" style="margin:0 0 18px;line-height:1.45;">${[FIAON_NAME, ...FIAON_ADRESSE.split("\n")].map(escapeHtml).join("<br>")}</div>`;
  const html = absender + empfaengerBlock(e.name, e.adresse) + datumZeile(d.datum)
    + betreff(`Nachfrage zum Schreiben${versandtAm ? ` vom ${escapeHtml(versandtAm)}` : ""} – Aktenzeichen ${escapeHtml(az)}`)
    + absatz(`Sehr geehrte Damen und Herren,`)
    + absatz(`${versandtAm ? `am ${escapeHtml(versandtAm)} haben wir` : "wir haben"} Ihnen im Auftrag von ${escapeHtml(name)}${anschrift ? `, ${escapeHtml(anschrift)}` : ""}, das Schreiben mit dem Aktenzeichen ${escapeHtml(az)} übermittelt. Eine Antwort liegt weder ${escapeHtml(name)} noch uns vor.`)
    + absatz(`Wir bitten um Mitteilung des Bearbeitungsstands – an ${escapeHtml(name)} unter der genannten Anschrift oder an uns als Übermittler. Falls Ihnen Unterlagen fehlen, nennen Sie bitte, welche.`)
    + absatz(`Wir übermitteln dieses Schreiben als Bote. Inhalt und Unterschrift des ursprünglichen Antrags stammen von ${escapeHtml(name)}; eigene Erklärungen geben wir in dieser Sache nicht ab.`)
    + `<p style="margin-top:18px;">Mit freundlichen Grüßen</p>`
    + `<p>${escapeHtml(FIAON_NAME)}<br><span class="muted">im Auftrag von ${escapeHtml(name)}</span></p>`;

  return {
    titel: `Nachfrage – ${az}`,
    empfaengerName: e.name,
    empfaengerAdresse: e.adresse,
    html,
    hinweisFuerKunden: "Auf Ihr Schreiben ist keine Antwort gekommen. Mit dieser Nachfrage erkundigt sich FIAON als Übermittler bei der Stelle nach dem Bearbeitungsstand. Sie müssen nichts tun; sobald eine Antwort kommt, liegt sie hier in Ihrer Akte.",
    fusszeile: `Nachfrage im Auftrag von ${name}. Aktenzeichen ${az}`,
    markenzeile: markenzeileFuer("nachfrage"),
  };
}

// ── Öffentliche Schnittstelle ───────────────────────────────────────────────

export function schreibenErzeugen(art: SchreibenArt, daten: SchreibenDaten): Schreiben {
  switch (art) {
    case "vollmacht": return vollmacht(daten);
    case "p_konto": return pKonto(daten);
    case "p_konto_umwandlung": return pKontoUmwandlung(daten);
    case "rundfunk": return rundfunk(daten);
    case "wohngeld": return wohngeld(daten);
    case "kfz": return kuendigung(daten, "kfz");
    case "handy": return kuendigung(daten, "handy");
    case "nachfass": return nachfass(daten);
    case "nachfrage": return nachfrage(daten);
    default: {
      const nie: never = art;
      throw new Error(`Unbekannte Schreibenart: ${String(nie)}`);
    }
  }
}

/**
 * Unterschriftblock: Bild der Fingerunterschrift, Name in Druckschrift, Zeitpunkt.
 * Ein Bild, das keine PNG-Daten-URL ist, wird nicht eingebettet — dann steht nur der Name.
 */
export function unterschriftHtml(signaturePngDataUrl: string, name: string, datumZeit: string): string {
  const daten = String(signaturePngDataUrl || "");
  const istPng = /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/.test(daten);
  const bild = istPng
    ? `<img class="sig-img" src="${daten}" alt="Unterschrift" style="display:block;max-height:70px;max-width:240px;">`
    : "";
  return `<div class="unterschrift" style="margin:14px 0 6px;">`
    + bild
    + `<div class="sig-line" style="border-top:1px solid #0f172a;max-width:240px;padding-top:4px;font-size:9pt;">${escapeHtml(name)}</div>`
    + `<div class="meta" style="font-size:8pt;color:#64748b;">unterschrieben am ${escapeHtml(datumZeit)}</div>`
    + `</div>`;
}

/** Setzt den Unterschriftblock an die dafür vorgesehene Stelle über dem Namen (oder hängt ihn an). */
export function unterschriftEinsetzen(html: string, unterschriftBlock: string): string {
  const marke = /<div class="unterschrift-platz"[^>]*><\/div>/;
  return marke.test(html) ? html.replace(marke, unterschriftBlock) : html + unterschriftBlock;
}

/**
 * PDF über renderDocumentPdf — liefert immer ein PDF (Playwright, sonst pdfkit).
 * Die Markenzeile im Kopf ist standardmäßig die des Übermittlers; für die
 * Vollmacht (an FIAON gerichtet) und die Boten-Nachfrage übergibt der Aufrufer
 * `markenzeileFuer(art)` bzw. `schreiben.markenzeile`.
 */
export async function schreibenAlsPdf(html: string, titel: string, fusszeile: string, markenzeile?: string): Promise<Buffer> {
  return renderDocumentPdf({
    documentTitle: titel,
    bodyHtml: html,
    markenzeile: markenzeile || markenzeileFuer("p_konto"),
    fusszeile,
  });
}

/** SHA-256 (hex) über den gerenderten Inhalt — Fingerabdruck für fiaon_vollmachten.doc_hash / fiaon_dokumente.doc_hash. */
export function hashVon(html: string): string {
  return docHash(String(html ?? ""));
}
