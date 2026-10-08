// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATISCHE DOKUMENTPRÜFUNG BEIM UPLOAD (01.09.2026, Team-Feedback P9)
//
// DER BEFUND: Ein Kunde lädt die falsche SCHUFA-Auskunft, einen halben
// Kontoauszug oder ein beliebiges PDF als „Ausweis" hoch — und niemand merkt
// es, bis die Verwaltung Tage später von Hand prüft. Dafür musste eigens die
// Lösch-Funktion (P12 vom 27.08.) gebaut werden.
//
// WAS DIESES MODUL TUT — ZWEI SCHEIBEN:
//   Scheibe 1 (sofort, ohne KI): Stichwortprofil auf der PDF-Textschicht je
//     Dokumentart + Zeitraum-Erkennung beim Kontoauszug. Läuft SYNCHRON mit
//     hartem Timeout in der Upload-Antwort — der Kunde erfährt SOFORT, wenn
//     etwas nicht passt.
//   Scheibe 2 (nachgelagert, KI): Der Text geht an das Analyse-Modell
//     (gleiche Anbindung wie die Kontoauszug-Analyse) und verfeinert das
//     Urteil. Fire-and-forget — ein KI-Ausfall ändert nichts am Upload.
//
// DREI EHRLICHKEITS-REGELN:
//   · Ein Foto-PDF hat keine Textschicht — das Urteil ist dann „nicht
//     prüfbar", NIEMALS „falsches Dokument". Sonst weisen wir zahlende
//     Kunden mit echten Ausweisfotos ab.
//   · Die Prüfung setzt NIE kyc_status oder weist zurück — sie meldet nur.
//     Die Entscheidung bleibt bei der Verwaltung.
//   · Sie darf den Upload nie scheitern lassen: jeder Fehler wird geschluckt
//     und protokolliert.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { pdfSeiten, pdfTextUndZeilen, textBrauchbarFuer } from "./fiaon-pdf-lesen";
import { ocrLesen, ocrZeilen, ohneFotoVermerk } from "./fiaon-ocr";
import { openaiFetch, kiPausiert, istKiPause, kiLesenMoeglich, kiSchluessel } from "./fiaon-ki-pause";
import { ausweisBewerten, type AusweisTextBefund, type UnterlagenKategorie } from "@shared/fiaon-unterlagen";
import { istLeseFehler, lesefehlerSatz, type LeseKlasse } from "@shared/fiaon-lesefehler";

/**
 * Der Text eines Dokuments — aus der Textschicht, sonst aus der Texterkennung
 * (18.09.2026). Ein Handyfoto hat keine Textschicht; bis heute hieß das hier
 * „automatisch nicht prüfbar" — bei Ausweisen fast immer. Die Erkennung ist im
 * Prozess zwischengespeichert: Heuristik und KI-Urteil lesen dieselbe Datei
 * nur einmal.
 *
 * E-IT-C (08.10.2026, Punkt 13):
 *   · Kontoauszüge zählen mit der Auszugsregel (Beträge), nicht mit der
 *     Vokalregel — dieselbe Regel wie die Analyse (textBrauchbarFuer).
 *   · Ausweise gehen NIE an die Texterkennung: ocrLesen liefert für „ausweis"
 *     null (keine Ausweisbilder an eine KI, Entscheidung Justin 08.10.).
 *   · `ohneOcr` — der Sofortblick beim Upload liest nur die Textschicht.
 *   · Ein Fehler der Texterkennung kommt als Klasse zurück (`klasse`), nicht
 *     als „unlesbar".
 */
async function lesbarerText(pdf: Buffer, art: DokumentArt, opt: { ohneOcr?: boolean } = {}): Promise<{ seiten: string[]; zeilen: string[][]; ocr: string | null; pause?: boolean; klasse?: LeseKlasse }> {
  const { seiten, zeilen } = await pdfTextUndZeilen(pdf);
  const eigen = ohneFotoVermerk(seiten.join("\n"));
  if (eigen.length >= 40 && textBrauchbarFuer(art, eigen)) return { seiten, zeilen, ocr: null };
  if (opt.ohneOcr || art === "ausweis") return { seiten, zeilen, ocr: null };
  try {
    const e = await ocrLesen(pdf, art);
    if (e && textBrauchbarFuer(art, e.seiten.join("\n"))) return { seiten: e.seiten, zeilen: ocrZeilen(e), ocr: e.modell };
  } catch (err) {
    // E-246: In der KI-Pause hat niemand gelesen — das Urteil darf nicht „nicht lesbar" lauten.
    if (istKiPause(err)) return { seiten, zeilen, ocr: null, pause: true };
    if (istLeseFehler(err)) return { seiten, zeilen, ocr: null, klasse: err.klasse };
    console.warn("[DOK-PRUEFUNG] Texterkennung:", String((err as Error)?.message || err).slice(0, 200));
    return { seiten, zeilen, ocr: null, klasse: "technisch" };
  }
  return { seiten, zeilen, ocr: null };
}

export type DokumentArt = "kontoauszug" | "ausweis" | "schufa";

export interface DokumentUrteil {
  art: DokumentArt;
  /** Konnte die Textschicht überhaupt gelesen werden? */
  pruefbar: boolean;
  /** Sieht es nach der richtigen Dokumentart aus? NULL = nicht prüfbar. */
  erkannt: boolean | null;
  /** Vollständig nach den Regeln der Art? NULL = nicht beurteilbar. */
  vollstaendig: boolean | null;
  fehlt: string[];
  seiten: number;
  zeitraumVon?: string | null;
  zeitraumBis?: string | null;
  /** Satz für den Kunden, Sie-Form. NULL = nichts zu melden. */
  hinweisKunde: string | null;
  /** Kurzzeile für die Verwaltung/Mitarbeiter. */
  hinweisIntern: string | null;
  quelle: "heuristik" | "ki";
  /**
   * E-246: Das Urteil entstand in der KI-Pause ohne Texterkennung bzw. ohne
   * KI-Urteil. pausePruefungenNachholen prüft es nach dem Aktivieren neu.
   */
  kiPause?: boolean;
  /** E-IT-C: Die Heuristik ist sich SICHER (Reisepass, MRZ, beide Seiten, viele Treffer) — kein KI-Urteil überstimmt sie. */
  eindeutig?: boolean;
  /** E-IT-C: Klasse eines Lesefehlers (passwort, beschaedigt, technisch …) — shared/fiaon-lesefehler.ts. */
  klasse?: LeseKlasse | null;
  /** E-IT-C: Ausweis — welche Art erkannt bzw. gewählt wurde. */
  ausweisArt?: string | null;
}

let tabelleBereit: Promise<void> | null = null;
function ensureTabelle(): Promise<void> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dokument_pruefungen (
          id SERIAL PRIMARY KEY,
          ref TEXT NOT NULL,
          art TEXT NOT NULL,
          urteil JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (ref, art)
        )`;
    })().catch((e) => { tabelleBereit = null; throw e; });
  }
  return tabelleBereit;
}

// ── Die Stichwortprofile — bewusst konservativ ──────────────────────────────
// Zwei Treffer machen ein „erkannt". EIN Wort kann Zufall sein („Saldo" steht
// auch auf einer Rechnung); zwei aus dem Profil sind es praktisch nie.
const PROFILE: Record<DokumentArt, { woerter: string[]; label: string }> = {
  kontoauszug: { label: "Kontoauszug", woerter: ["kontoauszug", "iban", "buchungstag", "wertstellung", "saldo", "kontostand", "umsatzanzeige", "buchungen"] },
  ausweis: { label: "Ausweisdokument", woerter: ["personalausweis", "identity card", "reisepass", "passport", "identitätskarte", "aufenthaltstitel", "carte d'identit"] },
  schufa: { label: "Bonitätsauskunft", woerter: ["schufa", "bonitätsauskunft", "datenkopie", "auskunft nach art. 15", "basisscore", "ksv1870", "crif", "score"] },
};

// ═══════════════════════════════════════════════════════════════════════════
// DER ZEITRAUM EINES KONTOAUSZUGS (11.09.2026, E-179)
//
// ── DER BEFUND ──────────────────────────────────────────────────────────────
// Dogan Cengiz (FIAON-MT70UE7U-CK6B) hat nur den JUNI-Auszug hochgeladen,
// drei Seiten. Die Prüfung meldete „vollständig, 10.06. bis 10.09.2026" —
// sie nahm das kleinste und das größte Datum im ganzen Text, und das größte
// war das Druckdatum „… am 10.09.2026". 92 Tage Spanne, kein Hinweis an den
// Kunden, keiner an die Verwaltung.
//
// Der Praxistest über die 130 jüngsten Auszüge fand dieselbe Sorte Randdatum
// bei fast jeder Bank: das Druckdatum auf jeder Seite (Revolut, Tomorrow, N26,
// Sparkasse-Fußzeile mit Uhrzeit), „Datum geöffnet" der Kontoeröffnung (N26),
// der Gebührenzeitraum „Abrechnungszeitraum vom 01.04. bis 30.06." mitten im
// Juni-Auszug (Sparkasse), „Abschluss vom 01.01. bis 31.03." (VR), der
// Kontostand „per" Abfragetag, eine Rechnung von 2023 (PayPal). „Mehrfach
// vorkommend" hilft nicht: Das Druckdatum steht auf JEDER Seite.
//
// ── DIE REGEL — DREI STUFEN, DIE ERSTE, DIE TRÄGT, GILT ─────────────────────
//   1. Buchungstage. Ein Datum ist ein Buchungstag, wenn in SEINER Zeile ein
//      Betrag steht, es nicht Teil einer Spanne „… bis …" ist und kein
//      Kontostand, Saldo oder Druckvermerk davorsteht. Ab drei verschiedenen
//      Buchungstagen ist das der Zeitraum. Eine Spanne, die der Auszug selbst
//      nennt, darf ihn um höchstens zehn Tage über die Buchungen hinaus
//      ergänzen — Monatsanfang ohne Umsatz, mehr nicht.
//   2. Ausdrücklich genannte Auszugszeiträume („Kontoauszug vom … bis …",
//      „Zeitraum: … – …", „Umsätze von … bis …"). Nötig für Auszüge ohne
//      messbare Buchungstage: Bei der Postbank-Art steht „02.02" oben und
//      „2026" in der Zeile darunter, bei VR und Sparda fehlt das Jahr ganz.
//      Gebühren-, Abschluss- und Vertragsspannen zählen hier nie.
//   3. Alle übrigen Daten ohne Druck- und Kontostandsvermerk.
// Auf Stufe 1 und 3 fallen einzelne Ausreißer am Rand weg (bis zu zwei Tage,
// durch eine große Lücke vom Rest getrennt): der Vertrag von 2025 in einer
// Buchungszeile, die Karten-Uhrzeit von 2021.
// ═══════════════════════════════════════════════════════════════════════════

const MS_TAG = 86_400_000;
/** Dieselbe Datumsform wie bisher: TT.MM.JJJJ, Tag und Monat auch einstellig. */
const DATUM = /\b([0-3]?\d)\.([01]?\d)\.(20\d\d)\b/g;
/**
 * Was nach Datum oder Uhrzeit aussieht, fliegt vor der Betragssuche aus der
 * Zeile — sonst hält „18.08" aus „18.08.2026" oder „20.42 UHR" als Betrag her.
 */
const DATUM_ODER_ZEIT = new RegExp([
  String.raw`\b(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])(?:\.(?:20)?\d{2}(?!\d)|\.|(?![\d,]))`,
  String.raw`\b\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*uhr\b`,
  String.raw`\b\d{1,2}:\d{2}(?::\d{2})?\b`,
  String.raw`\b20\d\d-\d\d-\d\d\b`,
].join("|"), "gi");
/** Ein Betrag: „1.234,56", „-29,24", „9,99-", „1'000.00", „-195 ,00". Kein Prozentsatz, kein Wechselkurs. */
const BETRAG = /(?<![\d.,'’])\d{1,3}(?:[.'’ ]?\d{3})*\s?[,.]\s?\d{2}(?![\d%]|\s?%|[.,]\d)/;
/** Steht das vor einem Datum, ist es ein Stand oder ein Druckvermerk, kein Buchungstag. */
const RANDVERMERK = /kontostand|saldo|\bstand\b|erstellt|gedruckt|druckdatum|ausdruck|ausgestellt|abgerufen|abfrage|eröffn|geöffnet|gültig|created|generated|printed|issued|opened|balance|\bas of\b/;
/** Zwei Daten, nur durch „bis", „-" oder „to" getrennt, sind eine Spanne. */
const VERBINDER = /^\s*(?:(?:bis|to|until|till|through)(?:\s+(?:zum|einschl\.?|einschließlich))?|[-–—])\s*$/i;
/** Diese Spannen beschreiben Gebühren, Zinsen oder Verträge — nie den Auszug. */
const FREMDE_SPANNE = /abrechnungszeitraum|abschluss|entgelt|zins|gebühr|gültig|laufzeit|versicherung|vertrag|freistell/i;
/** Direkt vor (oder hinter) einer Spanne: Hier nennt der Auszug seinen eigenen Zeitraum. */
const AUSZUG_DAVOR = /(?:kontoauszug|auszug|zeitraum|umsätze|umsatz|buchungsdatum|buchungszeitraum|statement|period)\s*(?:vom|von|from)?\s*:?\s*$/i;
const AUSZUG_DAHINTER = /^\s*(?:buchungsdatum|buchungszeitraum)/i;

export type ZeitraumQuelle = "buchungen" | "auszugsangabe" | "uebrige_daten" | "keine";

function tagesNummer(tag: number, monat: number, jahr: number): number | null {
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  // 31.02. gibt es nicht — Date.UTC würde still den 03.03. daraus machen.
  if (d.getUTCDate() !== tag || d.getUTCMonth() !== monat - 1) return null;
  return Math.round(d.getTime() / MS_TAG);
}

/** Einzelne Randtage, durch eine große Lücke vom Rest getrennt, gehören nicht zum Zeitraum. */
function randBereinigt(tage: number[]): number[] {
  const t = Array.from(new Set(tage)).sort((a, b) => a - b);
  if (t.length < 4) return t;
  const luecken = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
  // „Groß" misst sich an der üblichen Lücke dieses Auszugs: Ein Konto mit
  // zwei Buchungen im Monat hat andere Abstände als eines mit zwanzig.
  const schwelle = Math.max(21, 4 * luecken[Math.floor(luecken.length / 2)]);
  let lo = 0; let hi = t.length - 1;
  for (let runde = 0; runde < 3; runde++) {
    let weg = false;
    for (let k = 1; k <= 2 && !weg; k++) {
      if (hi - (lo + k) + 1 >= 3 && t[lo + k] - t[lo + k - 1] > schwelle) { lo += k; weg = true; }
    }
    for (let k = 1; k <= 2 && !weg; k++) {
      if ((hi - k) - lo + 1 >= 3 && t[hi - k + 1] - t[hi - k] > schwelle) { hi -= k; weg = true; }
    }
    if (!weg) break;
  }
  return t.slice(lo, hi + 1);
}

/**
 * Der Zeitraum eines Kontoauszugs aus seinen Zeilen. Rein — liest nichts,
 * schreibt nichts. `jetzt` nur für den Prüfstand.
 */
export function auszugsZeitraum(zeilen: string[], jetzt: number = Date.now()): { von: string | null; bis: string | null; tage: number; quelle: ZeitraumQuelle } {
  const heute = Math.floor((jetzt + MS_TAG) / MS_TAG);
  // Daten vor 2020 sind fast immer Geburts- oder Vertragsdaten, Daten in der
  // Zukunft Laufzeiten — beides kein Umsatz (wie bisher).
  const brauchbar = (t: number | null): t is number => t != null && t <= heute && t >= 18_262; // 01.01.2020
  const buchungen: number[] = [];
  const uebrige: number[] = [];
  const spannen: { von: number | null; bis: number | null; auszug: boolean; fremd: boolean }[] = [];

  for (const zeile of zeilen) {
    const funde = Array.from(zeile.matchAll(DATUM)).map((m) => ({
      start: m.index ?? 0, ende: (m.index ?? 0) + m[0].length,
      tag: tagesNummer(Number(m[1]), Number(m[2]), Number(m[3])), inSpanne: false,
    }));
    if (!funde.length) continue;
    for (let i = 0; i + 1 < funde.length; i++) {
      if (!VERBINDER.test(zeile.slice(funde[i].ende, funde[i + 1].start))) continue;
      funde[i].inSpanne = funde[i + 1].inSpanne = true;
      const davor = zeile.slice(Math.max(0, funde[i].start - 40), funde[i].start);
      const umfeld = davor + " " + zeile.slice(funde[i + 1].ende, funde[i + 1].ende + 25);
      spannen.push({
        von: funde[i].tag, bis: funde[i + 1].tag,
        fremd: FREMDE_SPANNE.test(umfeld),
        auszug: AUSZUG_DAVOR.test(davor) || AUSZUG_DAHINTER.test(zeile.slice(funde[i + 1].ende)),
      });
    }
    const mitBetrag = BETRAG.test(zeile.replace(DATUM_ODER_ZEIT, " "));
    for (const f of funde) {
      if (f.inSpanne || !brauchbar(f.tag)) continue;
      if (RANDVERMERK.test(zeile.slice(Math.max(0, f.start - 40), f.start).toLowerCase())) continue;
      (mitBetrag ? buchungen : uebrige).push(f.tag);
    }
  }

  const ergebnis = (von: number, bis: number, quelle: ZeitraumQuelle) => ({
    von: new Date(von * MS_TAG).toISOString().slice(0, 10),
    bis: new Date(bis * MS_TAG).toISOString().slice(0, 10),
    tage: bis - von, quelle,
  });
  const eigene = spannen.filter((s) => !s.fremd && brauchbar(s.von) && brauchbar(s.bis) && s.von <= s.bis) as { von: number; bis: number; auszug: boolean }[];

  // Stufe 1 — die Buchungen
  const kern = randBereinigt(buchungen);
  if (kern.length >= 3) {
    let von = kern[0]; let bis = kern[kern.length - 1];
    for (const s of eigene) {
      if (s.von < von && von - s.von <= 10) von = s.von;
      if (s.bis > bis && s.bis - bis <= 10) bis = s.bis;
    }
    return ergebnis(von, bis, "buchungen");
  }
  // Stufe 2 — was der Auszug über sich selbst sagt
  const angaben = eigene.filter((s) => s.auszug);
  if (angaben.length) {
    return ergebnis(Math.min(...angaben.map((s) => s.von)), Math.max(...angaben.map((s) => s.bis)), "auszugsangabe");
  }
  // Stufe 3 — alles Übrige, ohne Druck- und Kontostandsvermerke
  const rest = randBereinigt([...buchungen, ...uebrige, ...eigene.flatMap((s) => [s.von, s.bis])]);
  if (rest.length) return ergebnis(rest[0], rest[rest.length - 1], "uebrige_daten");
  return { von: null, bis: null, tage: 0, quelle: "keine" };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUSWEIS AUS DER TEXTSCHICHT (E-IT-C, 08.10.2026, Punkt 13 D)
//
// Die maschinenlesbare Zone (MRZ) verrät die Art: „P<" ist ein Reisepass,
// „I…"/„ID…"/„C…" die RÜCKSEITE eines Personalausweises (dort steht sie beim
// deutschen Ausweis), „AR…" ein Aufenthaltstitel (eAT). Bisher hieß „<<" pauschal
// „vollständig" — auch bei einer Rückseite ohne Vorderseite und bei einem
// Aufenthaltstitel, der allein nicht genügt.
// ═══════════════════════════════════════════════════════════════════════════
const AUSWEIS_VORNE = ["personalausweis", "identity card", "geburtstag", "gültig bis", "staatsangehörigkeit", "nationality", "date of birth", "date of expiry"];
const AUSWEIS_HINTEN = ["anschrift", "ausstellungsbehörde", "zugangsnummer", "authority", "address", "ausstellungsdatum", "augenfarbe", "körpergröße", "eye colour", "height"];
const AUFENTHALT = /aufenthaltstitel|residence permit|aufenthaltserlaubnis|niederlassungserlaubnis|aufenthaltskarte|titre de s[ée]jour|daueraufenthalt/i;

export function ausweisTextBefund(text: string): AusweisTextBefund {
  const klein = text.toLowerCase();
  const mrz = text.split(/\n/).map((z) => z.replace(/\s+/g, "").toUpperCase()).filter((z) => z.length >= 20 && z.includes("<<"));
  const mrzPass = mrz.some((z) => /^P[A-Z<]/.test(z));
  const mrzTitel = mrz.some((z) => /^A[R<]/.test(z));
  const mrzAusweis = mrz.some((z) => /^(I[A-Z<]|C[A-Z<])/.test(z));
  const titel = AUFENTHALT.test(text) || mrzTitel;
  const pass = (/reisepass|passport|passeport/.test(klein) && !titel) || mrzPass;
  const vorne = AUSWEIS_VORNE.filter((w) => klein.includes(w)).length >= 2;
  const hinten = AUSWEIS_HINTEN.filter((w) => klein.includes(w)).length >= 1 || mrzAusweis;
  return { pass, vorne: vorne && !pass, hinten: hinten && !pass, aufenthaltstitel: titel };
}

/**
 * Der Sofortblick auf eine Textschicht — rein, ohne KI. Dieselbe Regel für die
 * ganze Akte-Fassung (dokumentPruefen) und für jede einzelne Datei beim Upload
 * (fiaon-unterlagen.ts): erkannt? sieht es aus wie etwas anderes? Zeitraum?
 */
export function textBefund(art: DokumentArt, text: string, zeilen: string[]): {
  erkannt: boolean; treffer: number; aehnlich: DokumentArt | null;
  zeitraumVon: string | null; zeitraumBis: string | null; tage: number; ausweis: AusweisTextBefund | null;
} {
  const klein = text.toLowerCase();
  const treffer = PROFILE[art].woerter.filter((w) => klein.includes(w)).length;
  const ausweis = art === "ausweis" ? ausweisTextBefund(text) : null;
  const erkannt = treffer >= 2 || (art === "ausweis" && !!ausweis && (ausweis.pass || ausweis.aufenthaltstitel || (ausweis.vorne && ausweis.hinten)));
  const aehnlich = erkannt ? null : ((Object.keys(PROFILE) as DokumentArt[])
    .filter((a) => a !== art)
    .find((a) => PROFILE[a].woerter.filter((w) => klein.includes(w)).length >= 2) ?? null);
  const z = art === "kontoauszug" ? auszugsZeitraum(zeilen) : { von: null, bis: null, tage: 0 };
  return { erkannt, treffer, aehnlich, zeitraumVon: z.von, zeitraumBis: z.bis, tage: z.tage, ausweis };
}

/** Was der Mensch je Ausweis-Datei gewählt hat — die Prüfung kennt nur die gebundene Akte-Fassung. */
export interface PruefKontext {
  /** Gewählte Ausweisart je aktiver Datei (null = nicht gewählt). */
  erklaert?: (string | null)[];
  aufenthaltstitelUnterWeitere?: boolean;
  /** Sofortblick: nur Textschicht, keine Texterkennung. */
  ohneOcr?: boolean;
}

/** Scheibe 1: das Heuristik-Urteil — schnell, deterministisch, ehrlich. */
export async function dokumentPruefen(art: DokumentArt, pdf: Buffer, ctx: PruefKontext = {}): Promise<DokumentUrteil> {
  const profil = PROFILE[art];
  const basis: DokumentUrteil = {
    art, pruefbar: false, erkannt: null, vollstaendig: null, fehlt: [],
    seiten: 0, hinweisKunde: null, hinweisIntern: null, quelle: "heuristik",
  };
  try {
    // E-IT-C: Ein Öffnungspasswort ist eine eigene Klasse — vorher endete es in
    // „Prüfung fehlgeschlagen" (Prüfung) bzw. „zu unscharf" (Analyse).
    let passwort = false;
    basis.seiten = await pdfSeiten(pdf).catch((e: any) => { passwort = String(e?.name || "") === "PasswordException"; return 0; });
    if (passwort) {
      basis.klasse = "passwort";
      basis.hinweisKunde = lesefehlerSatz("passwort", "sie");
      basis.hinweisIntern = lesefehlerSatz("passwort", "du");
      basis.vollstaendig = false;
      return basis;
    }
    // Ein Lesedurchgang für beides: den Text (Stichwortprofil) und die Zeilen
    // (Zeitraum des Kontoauszugs, E-179). `seitenTexte` ist derselbe Text wie
    // aus pdfTextJeSeite.
    const { seiten: seitenTexte, zeilen, pause, klasse } = await lesbarerText(pdf, art, { ohneOcr: ctx.ohneOcr });
    const text = seitenTexte.join("\n");
    const brauchbar = textBrauchbarFuer(art, ohneFotoVermerk(text));
    // ── AUSWEIS ALS FOTO (E-IT-C) ──────────────────────────────────────────
    // Ausweisbilder liest keine KI. Ohne Textschicht entscheidet die feste Regel
    // aus der gewählten Art und der Seitenzahl — nie ein „unvollständig", das
    // niemand gesehen hat.
    if (art === "ausweis" && !brauchbar) {
      const r = ausweisBewerten({ erklaert: ctx.erklaert ?? [], text: null, seiten: basis.seiten, aufenthaltstitelUnterWeitere: ctx.aufenthaltstitelUnterWeitere });
      return { ...basis, erkannt: r.erkannt, vollstaendig: r.vollstaendig, fehlt: r.fehlt, hinweisKunde: r.hinweisKunde,
        hinweisIntern: r.hinweisIntern, ausweisArt: r.art, klasse: "von_hand" };
    }
    if (!brauchbar && pause) {
      // Den Kunden NICHT um eine neue Datei bitten — die Prüfung holt sich das nach dem Aktivieren selbst.
      basis.hinweisIntern = `${profil.label}: Foto oder Scan — die Texterkennung wartet, weil die KI pausiert ist. Wird nach dem Aktivieren automatisch geprüft.`;
      basis.kiPause = true;
      return basis;
    }
    if (!brauchbar) {
      // E-IT-C: Ein Fehler der Technik (Zeitgrenze, zu große Seite, kaputte Datei)
      // ist keine Schuld des Kunden — nur „unscharf" ist es, wenn wirklich gelesen wurde.
      if (klasse && klasse !== "unscharf") {
        basis.klasse = klasse;
        basis.hinweisIntern = `${profil.label}: ${lesefehlerSatz(klasse, "du")}`;
        if (klasse === "passwort" || klasse === "beschaedigt") { basis.hinweisKunde = lesefehlerSatz(klasse, "sie"); basis.vollstaendig = false; }
        return basis;
      }
      // Foto-PDF, und auch die Texterkennung fand nichts Lesbares.
      basis.klasse = ctx.ohneOcr ? null : "unscharf";
      basis.hinweisIntern = `${profil.label}: auch mit Texterkennung nicht lesbar (unscharf, abgeschnitten oder leer) — bitte von Hand ansehen.`;
      return basis;
    }
    basis.pruefbar = true;
    const klein = text.toLowerCase();
    const tb = textBefund(art, text, zeilen.flat());
    const trefferzahl = tb.treffer;
    basis.erkannt = tb.erkannt || (trefferzahl >= 1 && basis.seiten >= 2);
    // Sicher: viele Treffer. Beim Ausweis entscheidet die Regel unten (Pass, MRZ, beide Seiten).
    basis.eindeutig = trefferzahl >= 4;

    if (!basis.erkannt) {
      // Sieht es stattdessen wie eine ANDERE unserer Arten aus? Dann ist die
      // Meldung präziser („Sie haben vermutlich den Kontoauszug gewählt").
      const andere = tb.aehnlich;
      basis.klasse = "falsche_art";
      basis.vollstaendig = false;
      basis.fehlt = [`Das Dokument sieht nicht wie ${profil.label === "Ausweisdokument" ? "ein" : "eine"} ${profil.label} aus`];
      basis.hinweisKunde = andere
        ? `Diese Datei sieht wie ${PROFILE[andere].label === "Ausweisdokument" ? "ein Ausweisdokument" : `eine ${PROFILE[andere].label}`} aus — hochgeladen wurde sie aber als ${profil.label}. Bitte prüfen Sie die Auswahl und laden Sie die richtige Datei hoch.`
        : `Diese Datei konnten wir nicht als ${profil.label} erkennen. Bitte prüfen Sie, ob Sie die richtige Datei gewählt haben.`;
      basis.hinweisIntern = `${profil.label}: NICHT erkannt${andere ? ` (sieht aus wie ${PROFILE[andere].label})` : ""} — bitte prüfen.`;
      return basis;
    }

    if (art === "kontoauszug") {
      // E-179: nicht mehr kleinstes bis größtes Datum im Text — das Druckdatum
      // hat so aus einem Monat drei gemacht. Siehe auszugsZeitraum() oben.
      const zeitraum = auszugsZeitraum(zeilen.flat());
      basis.zeitraumVon = zeitraum.von;
      basis.zeitraumBis = zeitraum.bis;
      const tage = zeitraum.tage;
      basis.eindeutig = trefferzahl >= 3;
      // Verlangt sind die letzten drei Monate (Portal-Text) — 75 Tage Spanne
      // lassen Puffer für Monatsanfang/-ende, ohne Halbes durchzuwinken.
      if (tage >= 75) {
        basis.vollstaendig = true;
        basis.hinweisIntern = `Kontoauszug erkannt, Zeitraum ${basis.zeitraumVon} bis ${basis.zeitraumBis} (${basis.seiten} Seiten).`;
      } else {
        basis.vollstaendig = false;
        basis.fehlt = [tage > 0 ? `Der Auszug deckt nur rund ${Math.max(1, Math.round(tage / 30))} Monat(e) ab — benötigt sind die letzten drei Monate` : "Der Zeitraum ließ sich nicht erkennen"];
        basis.hinweisKunde = tage > 0
          // E-IT-C: „nachladen" führt jetzt zu einem Knopf, der ANHÄNGT — der Satz sagt es.
          ? `Ihr Kontoauszug ist angekommen, deckt aber nur etwa ${Math.max(1, Math.round(tage / 30))} Monat(e) ab. Für die Auswertung brauchen wir die letzten drei Monate — laden Sie die fehlenden Monate einfach dazu, Ihre bisherigen Dateien bleiben.`
          : null;
        basis.hinweisIntern = `Kontoauszug erkannt, aber Zeitraum ${tage > 0 ? `nur ~${tage} Tage` : "unklar"} — drei Monate sind verlangt.`;
      }
    } else if (art === "ausweis") {
      // 07.09.2026 (Daniel, Feedback 4): „Dokument nicht vollständig. Bitte laden Sie die
      // Rückseite hoch." — aber nur, wenn wir es WISSEN.
      // E-IT-C (08.10.2026, Punkt 13 D): Die Regel steht jetzt EINMAL in
      // shared/fiaon-unterlagen.ts (ausweisBewerten): Reisepass — Datenseite genügt;
      // Personalausweis — Vorder- und Rückseite, gezählt über ALLE Dateien der Akte-
      // Fassung (auch eine später angehängte Rückseite); Aufenthaltstitel nur mit
      // Reisepass. Die gewählte Art je Datei (ctx.erklaert) zählt mit.
      // E-IT-C Nachbesserung: je SEITE werten und vereinigen (wie je Datei in fiaon-unterlagen.ts) — über den
      // ganzen Text verdeckte ein Aufenthaltstitel auf Seite 1 den Reisepass auf Seite 2 („Reisepass" zählt nur
      // ohne Titel-Wort), und seit die bloße Wahl nicht mehr „vollständig" macht, stand die Fassung auf „von Hand".
      const jeSeite = seitenTexte.filter((t) => t.trim()).map((t) => ausweisTextBefund(t));
      const ab = jeSeite.length
        ? jeSeite.reduce((x, y) => ({ pass: x.pass || y.pass, vorne: x.vorne || y.vorne, hinten: x.hinten || y.hinten, aufenthaltstitel: x.aufenthaltstitel || y.aufenthaltstitel }))
        : (tb.ausweis ?? { pass: false, vorne: false, hinten: false, aufenthaltstitel: false });
      const r = ausweisBewerten({ erklaert: ctx.erklaert ?? [], text: ab, seiten: basis.seiten, aufenthaltstitelUnterWeitere: ctx.aufenthaltstitelUnterWeitere });
      basis.erkannt = r.erkannt ?? basis.erkannt;
      basis.vollstaendig = r.vollstaendig;
      basis.fehlt = r.fehlt;
      basis.hinweisKunde = r.hinweisKunde;
      basis.hinweisIntern = r.hinweisIntern;
      basis.ausweisArt = r.art;
      basis.eindeutig = ab.pass || ab.aufenthaltstitel || ab.vorne || ab.hinten;
      if (r.vollstaendig === false) basis.klasse = "unvollstaendig";
    } else {
      basis.vollstaendig = basis.seiten >= 2 ? true : null;
      basis.hinweisIntern = `Bonitätsauskunft erkannt (${basis.seiten} Seiten).`;
      // 07.09.2026 (Justin zu einer KSV-Auskunft: „Wenn wir den ganzen Bericht haben, dann
      // richtig"): SCHUFA, KSV1870 und CRIF nummerieren ihre Seiten („Seite 2 von 7", „Page 2
      // of 7"). Steht eine höhere Gesamtzahl im Text, als die Datei Seiten hat, fehlt etwas.
      const nummern = [...klein.matchAll(/(?:seite|page)\s+(\d{1,3})\s+(?:von|of|\/)\s+(\d{1,3})/g)].map((m) => Number(m[2])).filter((n) => n > 0 && n < 400);
      const gesamt = nummern.length ? Math.max(...nummern) : 0;
      const quelle = /ksv1870|kreditschutzverband/.test(klein) ? "KSV-Auskunft" : /crif/.test(klein) ? "CRIF-Auskunft" : "Auskunft";
      if (gesamt > basis.seiten) {
        basis.vollstaendig = false;
        basis.fehlt = [`${quelle}: laut Seitenzählung ${gesamt} Seiten, in der Datei sind ${basis.seiten}`];
        basis.hinweisKunde = `Ihre ${quelle} ist angekommen, aber nicht vollständig: Der Bericht hat ${gesamt} Seiten, in Ihrer Datei sind ${basis.seiten}. Bitte laden Sie den ganzen Bericht hoch.`;
        basis.hinweisIntern = `${quelle} erkannt, aber unvollständig: ${basis.seiten} von ${gesamt} Seiten.`;
      } else if (basis.seiten === 1) {
        basis.fehlt = ["Eine vollständige Auskunft hat meist mehrere Seiten"];
        basis.hinweisKunde = `Ihre ${quelle} ist angekommen, umfasst aber nur eine Seite. Bitte prüfen Sie, ob alle Seiten der Auskunft in der Datei sind.`;
      } else {
        basis.vollstaendig = true;
        basis.hinweisIntern = `${quelle} erkannt, ${basis.seiten} Seiten${gesamt ? ` (Seitenzählung bis ${gesamt} passt)` : ""}.`;
      }
    }
    return basis;
  } catch (e) {
    console.error("[DOK-PRUEFUNG] Heuristik:", String(e).slice(0, 200));
    basis.hinweisIntern = `${profil.label}: Prüfung fehlgeschlagen — bitte von Hand ansehen.`;
    return basis;
  }
}

export async function urteilSpeichern(ref: string, urteil: DokumentUrteil): Promise<void> {
  await ensureTabelle();
  // ─────────────────────────────────────────────────────────────────────────
  // 02.09.2026 — WARUM HIER KEIN JSON.stringify MEHR STEHT
  //
  // Florentine fragte am 02.09.: „Wie war das, uns wird angezeigt wenn ein
  // Dokument nicht richtig/vollständig ist?" Die Anzeige ist gebaut — aber sie
  // hat nie etwas gezeigt, und zwar wegen dieser einen Zeile.
  //
  // `${JSON.stringify(urteil)}::jsonb` verpackt doppelt: postgres.js kodiert
  // den übergebenen Text noch einmal als JSON, der Cast wirkt dann auf das
  // bereits verpackte Ergebnis. In der Tabelle stand deshalb ein JSON-STRING
  // statt eines Objekts — nachgemessen am 02.09.: `jsonb_typeof(urteil)` ist
  // bei allen drei vorhandenen Zeilen 'string'. Jeder Feldzugriff lief damit
  // ins Leere, und die Anzeige blieb stumm, obwohl das Urteil dastand.
  //
  // Das Objekt direkt übergeben ist der richtige Weg — `sqlPool.json` sagt dem
  // Treiber ausdrücklich, dass hier ein JSON-Wert steht.
  // ─────────────────────────────────────────────────────────────────────────
  await sqlPool`
    INSERT INTO fiaon_dokument_pruefungen (ref, art, urteil)
    VALUES (${ref}, ${urteil.art}, ${sqlPool.json(urteil as any)})
    ON CONFLICT (ref, art) DO UPDATE SET urteil = EXCLUDED.urteil, updated_at = NOW()
  `;
}

/** Eine Zeile, die noch in der alten, doppelt verpackten Form liegt, lesbar machen. */
function urteilEntpacken(wert: any): DokumentUrteil | null {
  if (!wert) return null;
  if (typeof wert === "string") {
    try { return JSON.parse(wert) as DokumentUrteil; } catch { return null; }
  }
  return wert as DokumentUrteil;
}

export async function urteileLesen(refs: string[]): Promise<Record<string, DokumentUrteil>> {
  if (!refs.length) return {};
  await ensureTabelle();
  const rows = (await sqlPool`
    SELECT ref, art, urteil FROM fiaon_dokument_pruefungen WHERE ref = ANY(${refs})
  `) as any[];
  const aus: Record<string, DokumentUrteil> = {};
  for (const r of rows) {
    // Die Zeilen vom 01./02.09. liegen noch doppelt verpackt vor. Sie beim
    // Lesen zu entpacken ist billiger, als sie neu prüfen zu lassen.
    const u = urteilEntpacken(r.urteil);
    if (u) aus[String(r.art)] = u;
  }
  return aus;
}

/**
 * Der eine Einstieg für beide Upload-Wege: Heuristik synchron (mit Timeout),
 * Speichern + KI-Verfeinerung nachgelagert. Gibt das Heuristik-Urteil zurück
 * oder null, wenn nichts rechtzeitig fertig wurde.
 */
export async function pruefungAnstossen(
  ref: string, art: DokumentArt, pdf: Buffer, timeoutMs = 4000, ctxEin?: PruefKontext,
): Promise<DokumentUrteil | null> {
  try {
    // E-IT-C: Beim Ausweis zählt, was der Mensch je Datei gewählt hat (Personalausweis/Reisepass)
    // und ob unter „Weitere Unterlagen" ein Aufenthaltstitel liegt — die Akte-Fassung allein weiß es nicht.
    const ctx: PruefKontext = ctxEin ?? (art === "ausweis"
      ? await import("./fiaon-unterlagen").then((m) => m.ausweisKontextFuerRef(ref)).catch(() => ({}))
      : {});
    const urteil = await Promise.race([
      dokumentPruefen(art, pdf, ctx),
      new Promise<null>((loese) => setTimeout(() => loese(null), timeoutMs)),
    ]);
    if (urteil) {
      // Scheibe 2 — nur wo sie etwas beitragen kann: Der Kontoauszug hat seine
      // eigene, reichere KI-Analyse (fiaon-kontoauszug-analyse); doppelt
      // bezahlen wäre Verschwendung.
      void speichernUndVerfeinern(ref, art, pdf, urteil).catch((e) => console.error("[DOK-PRUEFUNG] speichern/KI:", e?.message));
      return urteil;
    }
    // Timeout: die Prüfung läuft im Hintergrund zu Ende und speichert selbst.
    // 18.09.2026: Mit der Texterkennung ist das bei Fotos der Normalfall — das
    // KI-Urteil muss deshalb auch hier folgen, nicht nur im schnellen Weg.
    void dokumentPruefen(art, pdf, ctx)
      .then((u) => speichernUndVerfeinern(ref, art, pdf, u))
      .catch((e) => console.error("[DOK-PRUEFUNG] nachlauf:", e?.message));
    return null;
  } catch (e) {
    console.error("[DOK-PRUEFUNG] anstossen:", String(e).slice(0, 200));
    return null;
  }
}

/**
 * Heuristik-Urteil speichern und — wo es etwas beiträgt — das KI-Urteil folgen
 * lassen. E-246: In der KI-Pause bleibt das Heuristik-Urteil stehen, markiert
 * mit kiPause — pausePruefungenNachholen holt das KI-Urteil nach dem Aktivieren.
 */
/**
 * Braucht dieses Urteil die KI? (E-IT-C, 08.10.2026, Punkt 13 D)
 *   · Kontoauszug nie — er hat seine eigene, reichere Analyse.
 *   · Ausweis nur, wenn die Heuristik ihn NICHT erkannt hat (Rettung) — die KI
 *     sieht dabei nur Text, nie ein Bild, und entscheidet nie über die Seiten.
 *   · Auskunft wie seit E-175: Die KI sagt, ob es eine Auskunft IST — außer die
 *     Heuristik ist sich sicher.
 */
export function kiGefragt(art: DokumentArt, u: DokumentUrteil): boolean {
  if (art === "kontoauszug" || !u.pruefbar) return false;
  if (art === "ausweis") return u.erkannt === false;
  return !u.eindeutig;
}

async function speichernUndVerfeinern(ref: string, art: DokumentArt, pdf: Buffer, urteil: DokumentUrteil): Promise<void> {
  const mitKi = kiGefragt(art, urteil) && kiLesenMoeglich();
  if (mitKi && await kiPausiert()) urteil = { ...urteil, kiPause: true };
  await urteilSpeichern(ref, urteil);
  if (mitKi && !urteil.kiPause) await kiVerfeinern(ref, art, pdf, urteil);
}

/**
 * Nach der KI-Pause (Nachprüfung 27.09.2026, E-246): Urteile, die in der Pause
 * ohne Texterkennung oder ohne KI-Urteil entstanden (kiPause), neu prüfen —
 * statt den Kunden grundlos um einen neuen Upload zu bitten. Hängt am Takt
 * schufa_nachholen (20 Min.) und läuft nach dem Aktivieren; in der Pause nichts.
 * Liegt die Datei nicht mehr an der Bestellung, fällt nur die Markierung weg.
 */
const PDF_SPALTE: Record<DokumentArt, string> = { kontoauszug: "bank_statement_pdf", ausweis: "id_card_pdf", schufa: "schufa_pdf" };
let pauseNachholenLaeuft = false;
export async function pausePruefungenNachholen(grenze = 10): Promise<{ geprueft: number; offen: number }> {
  if (await kiPausiert()) return { geprueft: 0, offen: 0 };
  if (pauseNachholenLaeuft) return { geprueft: 0, offen: 0 };
  pauseNachholenLaeuft = true;
  try {
    await ensureTabelle();
    const zeilen = (await sqlPool`
      SELECT id, ref, art FROM fiaon_dokument_pruefungen
       WHERE jsonb_typeof(urteil) = 'object' AND urteil->>'kiPause' = 'true'
       ORDER BY updated_at ASC LIMIT ${grenze}`) as any[];
    let geprueft = 0;
    for (const z of zeilen) {
      if (await kiPausiert()) break;
      const art = String(z.art) as DokumentArt;
      const spalte = PDF_SPALTE[art];
      if (!spalte) continue;
      // Anspruch: Markierung atomar abnehmen — zwei Läufe prüfen dasselbe Urteil nie doppelt.
      const [anspruch] = (await sqlPool`
        UPDATE fiaon_dokument_pruefungen SET urteil = urteil - 'kiPause', updated_at = NOW()
         WHERE id = ${z.id} AND urteil->>'kiPause' = 'true' RETURNING id`) as any[];
      if (!anspruch) continue;
      const [d] = (await sqlPool.unsafe(
        `SELECT ${spalte} AS pdf FROM fiaon_applications WHERE ref = $1 AND gdpr_deleted_at IS NULL LIMIT 1`, [String(z.ref)],
      )) as any[];
      if (!d?.pdf) continue; // Datei weg — Markierung ist abgenommen, nichts zu prüfen
      const pdf: Buffer = Buffer.isBuffer(d.pdf) ? d.pdf : Buffer.from(d.pdf);
      try {
        const ctx = art === "ausweis" ? await import("./fiaon-unterlagen").then((m) => m.ausweisKontextFuerRef(String(z.ref))).catch(() => ({})) : {};
        const u = await dokumentPruefen(art, pdf, ctx);
        await speichernUndVerfeinern(String(z.ref), art, pdf, u);
        geprueft++;
      } catch (e) {
        console.error("[DOK-PRUEFUNG] nach der Pause", z.ref, art, String(e).slice(0, 200));
      }
    }
    if (geprueft) console.log(`[DOK-PRUEFUNG] Nach der KI-Pause neu geprüft: ${geprueft}`);
    return { geprueft, offen: zeilen.length };
  } finally {
    pauseNachholenLaeuft = false;
  }
}

// ── Scheibe 2: das KI-Urteil (Ausweis + Bonitätsauskunft) ───────────────────
async function kiVerfeinern(ref: string, art: DokumentArt, pdf: Buffer, vorher: DokumentUrteil): Promise<void> {
  try {
    await kiVerfeinernInnen(ref, art, pdf, vorher);
  } catch (e) {
    // E-246: Pausiert die KI mitten in der Verfeinerung, bleibt das Heuristik-Urteil — markiert zum Nachholen.
    if (istKiPause(e)) { await urteilSpeichern(ref, { ...vorher, kiPause: true }); return; }
    throw e;
  }
}
/**
 * KI-Urteil und Heuristik zusammenführen — rein, für den Prüfstand exportiert
 * (E-IT-C, 08.10.2026, Punkt 13 D).
 *
 * ── DER BEFUND ──────────────────────────────────────────────────────────────
 * Beim Ausweis überschrieb das KI-Urteil `vollstaendig` und `hinweisKunde`. Das
 * Modell bekam den OCR-Text ohne Seitenmarken und die Frage „Sind Vorder- und
 * Rückseite enthalten?" — auch beim Reisepass. 34 von 34 KI-Urteilen sagten
 * „unvollständig", 30-mal „Rückseite" (19-mal bei Dateien mit 2+ Seiten); ein
 * Aufenthaltstitel hieß „reicht nicht aus", während die Heuristik ihn annahm.
 * Dazu ging der freie KI-Satz (300 Zeichen) ungefiltert an den Kunden.
 *
 * ── DIE REGEL ───────────────────────────────────────────────────────────────
 * Die KI steuert genau EINE Sache bei: ob das Dokument die verlangte Art IST.
 * Vollständigkeit, „was fehlt" und der Kundensatz kommen immer aus der festen
 * Regel. Ist die Heuristik eindeutig, überstimmt die KI auch „erkannt" nicht —
 * ihr Zweifel steht dann nur intern. Rettet die KI ein „nicht erkannt", bleibt
 * die Vollständigkeit offen (von Hand), und der Kunde bekommt keinen Satz.
 * Bei der Auskunft galt das schon seit E-175 (10.09.2026): Die Prüfung sieht nur
 * die ersten 60.000 Zeichen; ob Seiten fehlen, zählt die Heuristik gegen die
 * Seitennummerierung („Seite 2 von 7"), was drinsteht, sagt die Analyse.
 */
export function kiUrteilZusammenfuehren(art: DokumentArt, vorher: DokumentUrteil, ki: { erkannt: boolean }, seiten: number): DokumentUrteil {
  const label = PROFILE[art].label;
  const sicher = vorher.eindeutig === true && vorher.erkannt === true;
  if (sicher) {
    return { ...vorher, quelle: "ki",
      hinweisIntern: ki.erkannt ? vorher.hinweisIntern : `${vorher.hinweisIntern ?? label} · KI zweifelt, ob es ein${art === "ausweis" ? "" : "e"} ${label} ist — bitte kurz ansehen.` };
  }
  if (ki.erkannt && vorher.erkannt === false) {
    // Gerettet: die Art stimmt, die Wortliste kannte das Dokument nicht. Die Seiten beurteilt ein Mensch.
    return { ...vorher, quelle: "ki", erkannt: true, vollstaendig: art === "schufa" && vorher.vollstaendig === true ? true : null,
      fehlt: [], hinweisKunde: null, klasse: null, seiten,
      hinweisIntern: `${label} (KI): erkannt — ${art === "ausweis" ? "Seiten bitte von Hand ansehen" : (vorher.hinweisIntern || "bitte kurz ansehen")}.` };
  }
  if (!ki.erkannt) {
    return { ...vorher, quelle: "ki", erkannt: false,
      vollstaendig: vorher.vollstaendig === true ? null : vorher.vollstaendig,
      hinweisIntern: `${label} (KI): NICHT erkannt — bitte von Hand ansehen.` };
  }
  return { ...vorher, quelle: "ki", erkannt: true, hinweisIntern: vorher.hinweisIntern || `${label} (KI): erkannt.` };
}

async function kiVerfeinernInnen(ref: string, art: DokumentArt, pdf: Buffer, vorher: DokumentUrteil): Promise<void> {
  if (!kiLesenMoeglich()) return;
  if (await kiPausiert()) { await urteilSpeichern(ref, { ...vorher, kiPause: true }); return; } // E-246: das Urteil der Heuristik bleibt stehen
  const modell = process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini";
  const { seiten } = await lesbarerText(pdf, art);
  // E-IT-C: Seitenmarken bleiben in jedem Text, den ein Modell sieht.
  const text = seiten.map((t, i) => `=== Seite ${i + 1} ===\n${t}`).join("\n").slice(0, 60_000);
  if (!textBrauchbarFuer(art, text)) return;
  // E-IT-C: Nur noch die ART — nie die Seiten (die zählt die feste Regel, auch über mehrere Dateien).
  const frage = art === "ausweis"
    ? "Ist das ein Ausweisdokument (Personalausweis, Reisepass oder Aufenthaltstitel)? Beurteile NICHT, ob Seiten fehlen."
    // ── NUR NOCH DIE ART, NICHT DIE VOLLSTAENDIGKEIT (10.09.2026, E-175) ──
    // Hier stand zusaetzlich „Wirken alle Seiten/Abschnitte vollstaendig
    // (Stammdaten, Einträge, ggf. Score)?". Das Modell sieht 60.000 Zeichen —
    // bei Dirk Ladewigs 38 Seiten ein Bruchteil — und antwortete
    // pflichtschuldig „unvollstaendig, es fehlen Stammdaten und Score". Der
    // Mitarbeiter sah eine gelbe Warnung an einer vollstaendigen Auskunft.
    // Ob Seiten fehlen, weiss die Heuristik: Sie zaehlt die Seiten der Datei
    // gegen die Seitennummerierung im Bericht selbst („Seite 2 von 7").
    : "Ist das eine Bonitätsauskunft (SCHUFA/KSV1870/CRIF, z. B. Datenkopie nach Art. 15 DSGVO)?";
  const start = Date.now();
  const r = await openaiFetch("dokument-pruefung", "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${kiSchluessel()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modell, temperature: 0, max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Du prüfst ein hochgeladenes Dokument für eine Bonitätsplattform. ${frage} Antworte NUR als JSON: {"erkannt": bool}. Es zählt nur, ob das Dokument diese Art IST — du siehst nur Text und kannst nicht beurteilen, ob Seiten fehlen. Gib keine Namen oder Daten aus dem Dokument wieder.` },
        { role: "user", content: `DOKUMENTTEXT:\n${text}` },
      ],
    }),
  });
  const j: any = await r.json().catch(() => null);
  // E-IT-C: Kosten und Modell dieser Prüfung stehen in fiaon_ki_nutzung (vorher blind, Gegenprüfung Punkt 6).
  void import("./fiaon-postmeister-schema").then(({ nutzungMerken }) => nutzungMerken({
    dienst: "dokument-pruefung", modell: String(j?.model || modell), usage: j?.usage ?? null, dauerMs: Date.now() - start,
    ok: r.ok, fehler: r.ok ? null : String(j?.error?.message || r.status).slice(0, 200),
  })).catch(() => {});
  if (!r.ok) { console.error("[DOK-PRUEFUNG] KI", r.status, j?.error?.message); return; }
  let b: any = null; try { b = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")); } catch { return; }
  if (typeof b?.erkannt !== "boolean") return;
  const urteil = kiUrteilZusammenfuehren(art, vorher, { erkannt: b.erkannt }, seiten.length);
  await urteilSpeichern(ref, urteil);
  console.log(`[DOK-PRUEFUNG] KI-Urteil ${ref}/${art}: erkannt=${urteil.erkannt} vollstaendig=${urteil.vollstaendig}`);
}
