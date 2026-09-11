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
import { pdfSeiten, pdfTextJeSeite, pdfTextUndZeilen, pdfTextBrauchbar } from "./fiaon-pdf-lesen";

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

/** Scheibe 1: das Heuristik-Urteil — schnell, deterministisch, ehrlich. */
export async function dokumentPruefen(art: DokumentArt, pdf: Buffer): Promise<DokumentUrteil> {
  const profil = PROFILE[art];
  const basis: DokumentUrteil = {
    art, pruefbar: false, erkannt: null, vollstaendig: null, fehlt: [],
    seiten: 0, hinweisKunde: null, hinweisIntern: null, quelle: "heuristik",
  };
  try {
    basis.seiten = await pdfSeiten(pdf).catch(() => 0);
    // Ein Lesedurchgang für beides: den Text (Stichwortprofil) und die Zeilen
    // (Zeitraum des Kontoauszugs, E-179). `seitenTexte` ist derselbe Text wie
    // aus pdfTextJeSeite.
    const { seiten: seitenTexte, zeilen } = await pdfTextUndZeilen(pdf);
    const text = seitenTexte.join("\n");
    if (!pdfTextBrauchbar(text)) {
      // Foto-PDF: die einzige Textschicht ist unsere eigene Fußzeile.
      basis.hinweisIntern = `${profil.label}: Foto ohne Textschicht — automatisch nicht prüfbar, bitte von Hand ansehen.`;
      return basis;
    }
    basis.pruefbar = true;
    const klein = text.toLowerCase();
    const trefferzahl = profil.woerter.filter((w) => klein.includes(w)).length;
    basis.erkannt = trefferzahl >= 2 || (trefferzahl >= 1 && basis.seiten >= 2);

    if (!basis.erkannt) {
      // Sieht es stattdessen wie eine ANDERE unserer Arten aus? Dann ist die
      // Meldung präziser („Sie haben vermutlich den Kontoauszug gewählt").
      const andere = (Object.keys(PROFILE) as DokumentArt[])
        .filter((a) => a !== art)
        .find((a) => PROFILE[a].woerter.filter((w) => klein.includes(w)).length >= 2);
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
      // Verlangt sind die letzten drei Monate (Portal-Text) — 75 Tage Spanne
      // lassen Puffer für Monatsanfang/-ende, ohne Halbes durchzuwinken.
      if (tage >= 75) {
        basis.vollstaendig = true;
        basis.hinweisIntern = `Kontoauszug erkannt, Zeitraum ${basis.zeitraumVon} bis ${basis.zeitraumBis} (${basis.seiten} Seiten).`;
      } else {
        basis.vollstaendig = false;
        basis.fehlt = [tage > 0 ? `Der Auszug deckt nur rund ${Math.max(1, Math.round(tage / 30))} Monat(e) ab — benötigt sind die letzten drei Monate` : "Der Zeitraum ließ sich nicht erkennen"];
        basis.hinweisKunde = tage > 0
          ? `Ihr Kontoauszug ist angekommen, deckt aber nur etwa ${Math.max(1, Math.round(tage / 30))} Monat(e) ab. Für die Analyse benötigen wir die letzten drei Monate — bitte laden Sie den vollständigen Zeitraum nach.`
          : null;
        basis.hinweisIntern = `Kontoauszug erkannt, aber Zeitraum ${tage > 0 ? `nur ~${tage} Tage` : "unklar"} — drei Monate sind verlangt.`;
      }
    } else if (art === "ausweis") {
      // 07.09.2026 (Daniel, Feedback 4): „Dokument nicht vollständig. Bitte laden Sie die
      // Rückseite hoch." — aber nur, wenn wir es WISSEN. Ein Reisepass hat eine Datenseite
      // (maschinenlesbare Zone), da fehlt nichts. Beim Personalausweis verrät die Textschicht
      // die Seite: vorn stehen Name/Geburtstag/gültig bis, hinten Anschrift/Ausstellungs-
      // behörde/Zugangsnummer. Nur vorn ohne hinten → Rückseite fehlt. Foto-PDFs ohne Text
      // kommen hier gar nicht an (oben „nicht prüfbar").
      const mrz = text.includes("<<");
      const pass = /reisepass|passport/.test(klein);
      const vorne = ["personalausweis", "identity card", "geburtstag", "gültig bis", "staatsangehörigkeit", "nationality"].filter((w) => klein.includes(w)).length;
      const hinten = ["anschrift", "ausstellungsbehörde", "zugangsnummer", "authority", "address", "ausstellungsdatum", "augenfarbe", "körpergröße"].filter((w) => klein.includes(w)).length;
      if (pass || mrz) {
        basis.vollstaendig = true;
        basis.hinweisIntern = `Ausweisdokument erkannt (${pass ? "Reisepass" : "maschinenlesbare Zone"}, ${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}).`;
      } else if (vorne >= 2 && hinten === 0) {
        basis.vollstaendig = false;
        basis.fehlt = ["Rückseite des Personalausweises fehlt"];
        basis.hinweisKunde = "Dokument nicht vollständig. Bitte laden Sie auch die Rückseite Ihres Personalausweises hoch.";
        basis.hinweisIntern = `Personalausweis: nur die Vorderseite erkannt (${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}) — Rückseite fehlt.`;
      } else if (vorne >= 1 && hinten >= 1) {
        basis.vollstaendig = true;
        basis.hinweisIntern = `Personalausweis erkannt, Vorder- und Rückseite (${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}).`;
      } else {
        basis.vollstaendig = basis.seiten >= 2 ? true : null;
        basis.hinweisIntern = `Ausweisdokument erkannt (${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}) — Seiten nicht sicher zuzuordnen, bitte von Hand ansehen.`;
        if (basis.seiten < 2) {
          basis.fehlt = ["Möglicherweise fehlt die Rückseite"];
          basis.hinweisKunde = "Ihr Ausweis ist angekommen. Falls die Rückseite auf einer eigenen Seite ist, laden Sie bitte beide Seiten hoch.";
        }
      }
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
  ref: string, art: DokumentArt, pdf: Buffer, timeoutMs = 4000,
): Promise<DokumentUrteil | null> {
  try {
    const urteil = await Promise.race([
      dokumentPruefen(art, pdf),
      new Promise<null>((loese) => setTimeout(() => loese(null), timeoutMs)),
    ]);
    if (urteil) {
      void urteilSpeichern(ref, urteil).catch((e) => console.error("[DOK-PRUEFUNG] speichern:", e?.message));
      // Scheibe 2 — nur wo sie etwas beitragen kann: Der Kontoauszug hat seine
      // eigene, reichere KI-Analyse (fiaon-kontoauszug-analyse); doppelt
      // bezahlen wäre Verschwendung.
      if (art !== "kontoauszug" && urteil.pruefbar) {
        void kiVerfeinern(ref, art, pdf, urteil).catch((e) => console.error("[DOK-PRUEFUNG] KI:", e?.message));
      }
      return urteil;
    }
    // Timeout: die Prüfung läuft im Hintergrund zu Ende und speichert selbst.
    void dokumentPruefen(art, pdf)
      .then((u) => urteilSpeichern(ref, u))
      .catch((e) => console.error("[DOK-PRUEFUNG] nachlauf:", e?.message));
    return null;
  } catch (e) {
    console.error("[DOK-PRUEFUNG] anstossen:", String(e).slice(0, 200));
    return null;
  }
}

// ── Scheibe 2: das KI-Urteil (Ausweis + Bonitätsauskunft) ───────────────────
async function kiVerfeinern(ref: string, art: DokumentArt, pdf: Buffer, vorher: DokumentUrteil): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return;
  const modell = process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini";
  const seiten = await pdfTextJeSeite(pdf);
  const text = seiten.join("\n").slice(0, 60_000);
  if (!pdfTextBrauchbar(text)) return;
  const frage = art === "ausweis"
    ? "Ist das ein gültiges Ausweisdokument (Personalausweis/Reisepass)? Sind Vorder- und Rückseite bzw. alle nötigen Angaben (Name, Geburtsdatum, Gültigkeit) enthalten und lesbar?"
    // ── NUR NOCH DIE ART, NICHT DIE VOLLSTAENDIGKEIT (10.09.2026, E-175) ──
    // Hier stand zusaetzlich „Wirken alle Seiten/Abschnitte vollstaendig
    // (Stammdaten, Einträge, ggf. Score)?". Das Modell sieht 60.000 Zeichen —
    // bei Dirk Ladewigs 38 Seiten ein Bruchteil — und antwortete
    // pflichtschuldig „unvollstaendig, es fehlen Stammdaten und Score". Der
    // Mitarbeiter sah eine gelbe Warnung an einer vollstaendigen Auskunft.
    // Ob Seiten fehlen, weiss die Heuristik: Sie zaehlt die Seiten der Datei
    // gegen die Seitennummerierung im Bericht selbst („Seite 2 von 7").
    : "Ist das eine Bonitätsauskunft (SCHUFA/KSV1870/CRIF, z. B. Datenkopie nach Art. 15 DSGVO)?";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modell, temperature: 0, max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Du prüfst ein hochgeladenes Dokument für eine Bonitätsplattform. ${frage} Antworte NUR als JSON: {"erkannt": bool, "vollstaendig": bool, "fehlt": ["…"], "hinweis_kunde": "ein Satz in Sie-Form oder leer"}. Bei einer Bonitätsauskunft zählt nur "erkannt" — du siehst nur den Anfang des Dokuments und kannst Vollständigkeit nicht beurteilen. Keine Namen oder Daten aus dem Dokument in den Hinweis übernehmen.` },
        { role: "user", content: `DOKUMENTTEXT:\n${text}` },
      ],
    }),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) { console.error("[DOK-PRUEFUNG] KI", r.status, j?.error?.message); return; }
  let b: any = null; try { b = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")); } catch { return; }
  if (typeof b?.erkannt !== "boolean") return;
  // Bei der Bonitätsauskunft behaelt das Urteil der Heuristik seine Kraft: Sie
  // hat gezaehlt, das Modell hat geraten. Das Modell steuert genau eine Sache
  // bei, die die Wortliste nicht kann — ob es wirklich eine Auskunft IST.
  const istAuskunft = art === "schufa";
  const urteil: DokumentUrteil = {
    art, pruefbar: true, quelle: "ki",
    erkannt: b.erkannt,
    vollstaendig: istAuskunft ? vorher.vollstaendig : (typeof b.vollstaendig === "boolean" ? b.vollstaendig : null),
    fehlt: istAuskunft ? vorher.fehlt : (Array.isArray(b.fehlt) ? b.fehlt.map(String).slice(0, 6) : []),
    seiten: seiten.length,
    hinweisKunde: istAuskunft ? vorher.hinweisKunde : (b.hinweis_kunde ? String(b.hinweis_kunde).slice(0, 300) : null),
    // ── KEINE VOLLSTAENDIGKEITS-BEHAUPTUNG MEHR (10.09.2026, E-175) ────────
    // Hier stand „erkannt, unvollstaendig — fehlt: Stammdaten, Score". Der
    // Mitarbeiter las das als gelbe Warnung an einer Auskunft, die vollstaendig
    // war. Diese Pruefung sieht nur die ersten 60.000 Zeichen und darf mit 400
    // Token antworten; bei 38 Seiten ist das ein Bruchteil. Sie kann sagen, ob
    // ein Dokument eine Bonitaetsauskunft IST — nicht, ob es vollstaendig ist.
    // Was drinsteht, sagt die Analyse (fiaon-schufa-analyse.ts).
    hinweisIntern: istAuskunft
      ? (b.erkannt
          ? (vorher.hinweisIntern || `Bonitätsauskunft erkannt (${seiten.length} Seiten).`)
          : `Bonitätsauskunft (KI): NICHT erkannt — bitte von Hand ansehen.`)
      : `${PROFILE[art].label} (KI): ${b.erkannt ? "erkannt" : "NICHT erkannt"}${
          !b.erkannt && Array.isArray(b.fehlt) && b.fehlt.length ? ` — fehlt: ${b.fehlt.slice(0, 3).join(", ")}` : ""}`,
  };
  await urteilSpeichern(ref, urteil);
  console.log(`[DOK-PRUEFUNG] KI-Urteil ${ref}/${art}: erkannt=${urteil.erkannt} vollstaendig=${urteil.vollstaendig}`);
}
