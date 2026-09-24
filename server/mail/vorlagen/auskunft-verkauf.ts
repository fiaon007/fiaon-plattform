// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: DAS ANGEBOT DER BONITÄTSAUSKUNFT (24.09.2026, E-240) — Absender „FIAON Welcome"
//
// Justin: Die Auskunft soll „weggehen wie warme Semmeln". Gemessen am 24.09.:
// Am 22.08. fielen die Kaufknöpfe des alten Dashboards weg (97 von 146
// Bestellungen kamen darüber), und die einzige Mail zur Auskunft („Ein
// Dokument fehlt noch") empfahl die kostenlose Datenkopie — ohne Preis, ohne
// Knopf. Diese Vorlage ist das Angebot: was wir tun, bei wem, was es kostet,
// und EIN Knopf, der es beauftragt.
//
// ── DAS IST WERBUNG — MIT ALLEM, WAS DAZUGEHÖRT ───────────────────────────
// · Abmeldelink Pflicht (ABMELDEPFLICHT im Motor, die Tür in make-webhook.ts
//   lehnt ohne ihn ab) und NICHT in PFLICHTMAILS: Werbesperre und Kündigung
//   halten sie auf — auch beim Handversand.
// · § 7 Abs. 3 UWG: Der Widerspruchs-Hinweis steht erst seit 02.09.2026 12:35
//   im Antrag. Automatisch geht diese Mail nur an Menschen, die danach Kunde
//   wurden; die Tür prüft das (sperrUrteil in fiaon-mail-frequenz.ts, dazu der
//   Kaufstand in fiaon-auskunft-lieferung.ts — nie an Käufer). Für alle anderen
//   bleibt das Angebot im Kundenbereich und das Gespräch mit dem Betreuer.
// · Der Hinweis auf das Widerspruchsrecht steht in JEDER Fassung (Fußnote) —
//   § 7 Abs. 3 Nr. 4 UWG verlangt ihn bei jeder Verwendung.
//
// ── WAS SIE SAGEN DARF (Wortwand, shared/fiaon-wortverbote.ts) ────────────
// Nur Sätze aus shared/fiaon-auskunft.ts für Leistung, Nutzen und Auskunfteien.
// Keine Garantie, keine Löschzusage, kein „Score verbessern", keine Frist mit
// Zahl, keine Karten- oder Limitzusage (die Bank entscheidet). Österreich und
// die Schweiz lesen nie „SCHUFA" (auskunftWort/auskunfteienText). Die kostenlose
// Datenkopie steht ehrlich im Kleingedruckten — nie als Hauptweg, nie verschwiegen.
//
// ── DREI FASSUNGEN IM WECHSEL ─────────────────────────────────────────────
// a) Was die Bank sieht (Nutzen)  b) Alte Einträge und Fristen  c) Ohne Brief,
// ohne Formular (Aufwand). Gewählt über die Nutzlast (`fassung`); wer sie
// schickt, nimmt auskunftAngebotFassung(bisher gesendet). Ein Ereignisname für
// alle drei — Protokoll, Frequenzbremse und Werbesperre sehen EINE Mail.
//
// ── WARUM EIN BAUSTEIN AUS DER NUTZLAST ───────────────────────────────────
// Das Land entscheidet über Wort und Auskunfteien, das Paket über den Preis,
// die Art (privat/firma) über die Leistung. Als Platzhalter hieße das zwölf
// Varianten oder ein Satz, der in AT „SCHUFA" sagt. Der Motor ruft deshalb
// auskunftAngebotBaustein(payload) — wie die Lead-Strecke leadStreckenBaustein.
// Platzhalter bleiben nur für die drei Adressen (kauf_url, upload_url,
// abmelde_url): Fehlt eine, meldet der Motor sie, statt still einen Knopf
// wegzulassen.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import {
  AUSKUNFT_NUTZEN_SATZ, auskunftLand, auskunftLeistung, auskunftPreisCents, auskunftWort,
  auskunfteienFuer, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { anredeMail, vornameFuerBetreff } from "@shared/fiaon-anrede";

export type AngebotFassung = "a" | "b" | "c";
export const ANGEBOT_FASSUNGEN: readonly AngebotFassung[] = ["a", "b", "c"];

/**
 * Welche Fassung als Nächstes: die nach der zuletzt geschickten. `bisher` =
 * Zahl der schon versandten auskunft_angebot an diese Person (fiaon_mail_log).
 */
export function auskunftAngebotFassung(bisher: number): AngebotFassung {
  const n = Number.isFinite(bisher) && bisher > 0 ? Math.floor(bisher) : 0;
  return ANGEBOT_FASSUNGEN[n % ANGEBOT_FASSUNGEN.length];
}

/** Die Nutzlast dieses Ereignisses — die Parameter, die der Baustein liest. */
export interface AngebotNutzlast {
  email: string;
  person_id?: number | null;
  vorname?: string | null;
  nachname?: string | null;
  anrede?: string | null;
  /** „74 €" / „149 €" — vom Server (auskunftPreis), nie aus dem Browser. */
  preis_text: string;
  mit_abo: boolean;
  land: AuskunftLand;
  /** Satzteil „SCHUFA, CRIF und Creditreform Boniversum" — zur Anzeige im Protokoll. */
  auskunfteien: string;
  leistung: string[];
  art?: AuskunftArt;
  fassung?: AngebotFassung;
  kauf_url: string;
  upload_url: string;
  abmelde_url: string;
  [k: string]: unknown;
}

const sicher = (s: unknown): string => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // Ein Name oder Satz aus der Nutzlast darf keinen Platzhalter in die Mail schmuggeln.
  .replace(/\{\{/g, "{ {");

const ZAHLWORT = ["keine", "eine", "zwei", "drei", "vier", "fünf"];

function jaNein(roh: unknown): boolean {
  return roh === true || ["1", "true", "ja", "an"].includes(String(roh ?? "").trim().toLowerCase());
}

/**
 * Baut die Mail aus der Nutzlast. Fehlt etwas, gilt der sichere Rückfall:
 * Land Deutschland, Privatkunde, Preis aus `mit_abo` über shared/fiaon-auskunft.ts,
 * Leistung aus auskunftLeistung — nie ein leerer Satz.
 */
export function auskunftAngebotBaustein(p: Record<string, unknown>): MailBaustein {
  const land: AuskunftLand = auskunftLand(p.land);
  const art: AuskunftArt = p.art === "firma" ? "firma" : "privat";
  const mitAbo = jaNein(p.mit_abo);
  const preis = sicher(String(p.preis_text ?? "").trim() || euroText(auskunftPreisCents(art, mitAbo)));
  const wort = auskunftWort(land);
  const bei = auskunfteienText(land);
  const anzahl = auskunfteienFuer(land).length;
  const leistungRoh = Array.isArray(p.leistung) && p.leistung.length ? (p.leistung as unknown[]).map(String) : auskunftLeistung(art, land);
  // Punkt und geschütztes Leerzeichen als Zeichen, nicht als HTML-Entität: Der
  // Text-Teil der Mail (mailText) entfernt nur Tags — „&#8226;&nbsp;" stand dort
  // wörtlich (Gegenlesen 24.09.2026).
  const liste = `<b>Das übernehmen wir für Sie:</b>\n${leistungRoh.map((z) => `•  ${sicher(z)}`).join("\n")}`;
  const name = { vorname: p.vorname as string | null, nachname: p.nachname as string | null };
  const anrede = sicher(String(p.anrede ?? "").trim() || anredeMail(name));
  const vorname = vornameFuerBetreff(name);
  const vn = vorname ? `${sicher(vorname)}, ` : "";
  const fassung: AngebotFassung = ANGEBOT_FASSUNGEN.includes(p.fassung as AngebotFassung) ? (p.fassung as AngebotFassung) : "a";

  const preisSatz = mitAbo
    ? `<b>${preis} einmalig</b> — Ihr Preis als FIAON-Kunde mit laufendem Paket. Kein Abo, keine Laufzeit.`
    : `<b>${preis} einmalig</b> — kein Abo, keine Laufzeit.`;
  const nutzen = `<b>${AUSKUNFT_NUTZEN_SATZ}</b>`;
  const firma = art === "firma";

  const gemeinsam: Omit<MailBaustein, "betreff" | "preheader" | "titel" | "absaetze"> = {
    marke: mitAbo ? "Ihr Kundenpreis" : "Einmalig, ohne Abo",
    daten: [
      { label: "Auskunfteien", wert: sicher(bei) },
      { label: "Ihr Preis", wert: `${preis} einmalig` },
    ],
    knopf: { text: "Auskunft beauftragen", url: "{{params.kauf_url}}" },
    knopf2: { text: "Ich habe schon eine — hochladen", url: "{{params.upload_url}}" },
    fussnote: "Die Datenkopie selbst steht Ihnen bei jeder Auskunftei auch kostenlos zu, und Sie können sie jederzeit selbst anfordern. "
      + "Mit dem Auftrag übernehmen wir Anforderung, Auswertung, Handlungsplan und Schreiben für Sie. "
      + "Über Karte und Limit entscheidet am Ende immer die Bank. "
      + "Der Nutzung Ihrer E-Mail-Adresse für Hinweise auf eigene Leistungen können Sie jederzeit widersprechen — über den Abmeldelink unten oder mit einer Antwort „Stopp“; "
      + "dafür entstehen keine anderen als die Übermittlungskosten nach den Basistarifen.",
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  };

  if (fassung === "b") {
    return {
      ...gemeinsam,
      betreff: firma ? "Stimmen die Daten, die über Ihr Unternehmen gespeichert sind?" : `${vn}dürfen Ihre alten Einträge noch gespeichert sein?`.replace(/^./, (c) => c.toUpperCase()),
      preheader: `Wir fordern Ihre Datenkopien bei ${bei} an und prüfen jede Frist.`,
      titel: "Alte Einträge? Wir prüfen die Fristen",
      absaetze: [
        `${anrede} Auskunfteien dürfen Einträge nicht unbegrenzt speichern. Ob bei Ihnen etwas steht, dessen Speicherfrist abgelaufen ist oder das nicht stimmt, zeigt nur ein Blick in Ihre Datenkopien — und genau den übernehmen wir für Sie.`,
        `Wir fordern Ihre Datenkopien bei ${sicher(bei)} an, erklären jeden Eintrag und prüfen die Fristen. Ist eine Frist abgelaufen oder eine Angabe falsch, liegt das passende Schreiben fertig für Sie bereit: Sie geben frei, wir übermitteln.`,
        liste,
        nutzen,
        preisSatz,
      ],
    };
  }

  if (fassung === "c") {
    const zahl = anzahl < ZAHLWORT.length ? ZAHLWORT[anzahl] : String(anzahl);
    return {
      ...gemeinsam,
      betreff: `${vn}Ihre ${wort} — ohne einen einzigen Brief`.replace(/^./, (c) => c.toUpperCase()),
      // Gegenlesen 24.09.2026: nur versprechen, was wir abnehmen. Die Antwort kommt
      // weiter per Post zum Kunden, und eine Auskunftei kann einen Identitätsnachweis
      // nachfordern — „auf Post warten" und „Ausweis kopieren" nehmen wir ihm nicht ab,
      // „wir erledigen den Rest" stimmte deshalb auch nicht.
      preheader: "Kein Formular, kein Briefeschreiben: Sie unterschreiben am Bildschirm, wir übernehmen Anforderung und Auswertung.",
      titel: `${zahl.charAt(0).toUpperCase()}${zahl.slice(1)} Auskunfteien, ein Auftrag`,
      absaetze: [
        `${anrede} eine Datenkopie anzufordern heißt normalerweise: Anschriften heraussuchen, für jede Auskunftei einen eigenen Brief schreiben — und am Ende eine Liste voller Kürzel verstehen. Das nehmen wir Ihnen ab.`,
        `Sie unterschreiben am Bildschirm mit dem Finger, wir schicken die Anfragen an ${sicher(bei)} und gehen jede Antwort mit Ihnen durch — Zeile für Zeile, in klaren Worten.`,
        liste,
        nutzen,
        preisSatz,
      ],
    };
  }

  // Fassung a — was die Bank sieht.
  return {
    ...gemeinsam,
    betreff: `${vn}sehen Sie, was die Bank über Sie sieht`.replace(/^./, (c) => c.toUpperCase()),
    preheader: `Ihre ${wort}: angefordert, erklärt, mit persönlichem Handlungsplan.`,
    titel: firma ? "Wissen, was über Ihr Unternehmen gespeichert ist" : "Wissen, was über Sie gespeichert ist",
    // Gegenlesen 24.09.2026: „Die meisten Menschen …" war eine Mengenangabe ohne
    // Beleg — „viele" sagt dasselbe, ohne eine Zahl zu behaupten. Die Firma liest
    // von ihrem Unternehmen, nicht von „Ihrer SCHUFA-Auskunft".
    absaetze: [
      `${anrede} bevor eine Bank über Karte und Limit entscheidet, schaut sie in die Daten bei den Auskunfteien. Viele haben diese Daten selbst nie gesehen.`,
      firma
        ? `Mit der Firmen-Auskunft ändern wir das: Wir holen die Daten Ihres Unternehmens und Ihre persönlichen Datenkopien bei ${sicher(bei)} und gehen sie mit Ihnen durch — was dort steht, was es bedeutet und was Sie jetzt tun können.`
        : `Mit Ihrer ${wort} ändern wir das: Wir holen Ihre Datenkopien bei ${sicher(bei)} und gehen sie mit Ihnen durch — was dort steht, was es bedeutet und was Sie jetzt tun können.`,
      liste,
      nutzen,
      preisSatz,
    ],
  };
}

/**
 * Der statische Eintrag im Vorlagen-Verzeichnis: Fassung a für Deutschland, mit
 * Platzhaltern. Er macht das Ereignis für hatVorlage, Galerie und Mailwerk
 * sichtbar; gerendert wird immer über auskunftAngebotBaustein (Motor).
 */
export const AUSKUNFT_VERKAUF_VORLAGEN: Record<string, MailBaustein> = {
  auskunft_angebot: auskunftAngebotBaustein({ land: "DE", mit_abo: true }),
};

/**
 * Die Nutzlast aus bekannten Werten — rein, ohne Datenbank. Die Werte selbst
 * holt fiaon-auskunft-lieferung.ts (auskunftAngebotNutzlast); hier steht nur,
 * wie sie zusammengesetzt wird, damit Takt, Akte und Prüfstand dieselbe bauen.
 */
export function angebotNutzlastBauen(e: {
  email: string; personId: number; vorname?: string | null; nachname?: string | null;
  land: AuskunftLand; mitAbo: boolean; preisCents: number; art?: AuskunftArt;
  kaufUrl: string; uploadUrl: string; abmeldeUrl: string; bisherGesendet?: number;
}): AngebotNutzlast {
  const art = e.art ?? "privat";
  return {
    email: e.email, person_id: e.personId, vorname: e.vorname ?? null, nachname: e.nachname ?? null,
    anrede: anredeMail({ vorname: e.vorname, nachname: e.nachname }),
    preis_text: euroText(e.preisCents), mit_abo: e.mitAbo, land: e.land,
    auskunfteien: auskunfteienText(e.land), leistung: auskunftLeistung(art, e.land), art,
    fassung: auskunftAngebotFassung(e.bisherGesendet ?? 0),
    kauf_url: e.kaufUrl, upload_url: e.uploadUrl, abmelde_url: e.abmeldeUrl,
  };
}
