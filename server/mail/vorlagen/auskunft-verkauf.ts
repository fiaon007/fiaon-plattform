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
// ── NEUN TEXTE STATT DREI (25.09.2026, E-241) ─────────────────────────────
// Justin: „… an ALLE, die keine Boni-Auskunft hinterlegt oder gekauft haben …
// ein richtiger Verkaufsprozess … jeden Tag 500 Mails." Das Angebot geht damit
// nicht mehr nur an zahlende Kunden, sondern an Menschen in drei ganz
// verschiedenen Lagen (Stufen A/B/C, auskunft_verkauf_kreis = 'alle'):
//   · kunde  — zahlt ein Paket, hat einen Betreuer und eine Akte; Kundenpreis.
//   · antrag — Antrag fertig, erste Zahlung offen; 149 € einzeln, dazu der
//              Hinweis auf den Preis mit aktivem Paket (paket_preis_hinweis).
//   · lead   — hat sich gemeldet, sonst nichts; 149 € einzeln.
// „In Ihrer Akte fehlt noch …" ist für den Kunden wahr und für den Lead
// falsch — deshalb eigene Einstiege und Betreffzeilen je Segment, in drei
// Fassungen:
//   a) Was die Bank sieht (Nutzen)
//   b) Der Einwand „Das kann ich doch kostenlos selbst anfordern?" — ehrlich
//      beantwortet mit AUSKUNFT_KOSTENLOS_ANTWORT, nie kleingeredet
//   c) Kurz und persönlich — die letzte Erinnerung, ohne Druck, ohne Frist
// Jede der neun hat ihren eigenen Betreff: 500 Mails am Tag mit derselben
// Betreffzeile liest jeder Spamfilter als Welle. Die Firma (art = "firma")
// bekommt in jeder Fassung eigene Sätze — sie liest von ihrem Unternehmen,
// nicht von „Ihrer SCHUFA-Auskunft".
//
// ── DAS IST WERBUNG — MIT ALLEM, WAS DAZUGEHÖRT ───────────────────────────
// · Abmeldelink Pflicht (ABMELDEPFLICHT im Motor, die Tür in make-webhook.ts
//   lehnt ohne ihn ab) und NICHT in PFLICHTMAILS: Werbesperre und Kündigung
//   halten sie auf — auch beim Handversand.
// · Der Widerspruchs-Hinweis (§ 7 Abs. 3 Nr. 4 UWG: bei JEDER Verwendung)
//   steht wörtlich als WIDERSPRUCH_SATZ in der Fußnote jeder Fassung — im
//   HTML und im Text-Teil. WER die Mail bekommen darf, entscheiden Takt und
//   Tür (sperrUrteil in fiaon-mail-frequenz.ts, auskunftAngebotTuerSperre in
//   fiaon-auskunft-lieferung.ts) — nie diese Vorlage.
//
// ── WAS SIE SAGEN DARF (Wortwand, shared/fiaon-wortverbote.ts) ────────────
// Nutzen, Leistung, Auskunfteien und die ehrliche Antwort zur Datenkopie aus
// shared/fiaon-auskunft.ts. Keine Garantie, keine Löschzusage, kein „Score
// verbessern", keine Frist mit Zahl, keine Karten- oder Limitzusage (die Bank
// entscheidet). Österreich und die Schweiz lesen nie „SCHUFA"
// (auskunftWort/auskunfteienText; eine Leistungsliste aus der Nutzlast, die
// dort „SCHUFA" sagt, wird verworfen). Die kostenlose Datenkopie steht ehrlich
// in jeder Fußnote und ausführlich in Fassung b — nie als Hauptweg, nie
// verschwiegen. „Einholen" statt „anfordern": Bis die Schnittstelle steht,
// kaufen wir die Auskunft selbst ein (auskunft_liefermodus = 'einkauf') — der
// Text stimmt so für jeden Liefermodus.
//
// ── WARUM EIN BAUSTEIN AUS DER NUTZLAST ───────────────────────────────────
// Land, Segment, Fassung, Paket und Art entscheiden über jeden Satz. Als
// Platzhalter hieße das 54 Varianten oder ein Satz, der in AT „SCHUFA" sagt.
// Der Motor ruft deshalb auskunftAngebotBaustein(payload). Platzhalter bleiben
// nur für die drei Adressen (kauf_url, upload_url, abmelde_url): Fehlt der
// Kauflink oder der Abmeldelink, meldet der Motor das, statt still einen Knopf
// wegzulassen. Der Hochlade-Weg ist ein Zusatz: Er steht nur da, wenn die
// Nutzlast eine upload_url mitbringt und kein Lead liest (der hat keinen
// Kundenbereich, der Link endete an der Anmeldung) — sonst wäre ein leerer
// Platzhalter eine gemeldete Lücke, die den Versand anhält.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_NUTZEN_SATZ, AUSKUNFT_NUTZEN_SATZ_KARTE, auskunftLand, auskunftLeistung, auskunftPreisCents, auskunftWort,
  auskunfteienFuer, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { anredeMail, vornameFuerBetreff } from "@shared/fiaon-anrede";

export type AngebotFassung = "a" | "b" | "c";
export const ANGEBOT_FASSUNGEN: readonly AngebotFassung[] = ["a", "b", "c"];

/** Wer das Angebot liest (E-241): zahlender Kunde, fertiger Antrag ohne Zahlung, Lead. */
export type AngebotSegment = "kunde" | "antrag" | "lead";
export const ANGEBOT_SEGMENTE: readonly AngebotSegment[] = ["kunde", "antrag", "lead"];

/** Das Segment aus der Nutzlast — ohne Angabe „kunde" (so riefen Takt und Akte bis E-240). */
export function angebotSegment(roh: unknown): AngebotSegment {
  const s = String(roh ?? "").trim().toLowerCase();
  return s === "antrag" || s === "lead" ? s : "kunde";
}

/**
 * Der Hinweis nach § 7 Abs. 3 Nr. 4 UWG — wörtlich in jeder Fassung, im HTML
 * und im Text-Teil (25.09.2026, E-241). Der Prüfstand sucht genau diesen Satz.
 */
export const WIDERSPRUCH_SATZ =
  "Sie können der Verwendung Ihrer E-Mail-Adresse für Werbung jederzeit widersprechen — ein Klick genügt, "
  + "es entstehen keine anderen als die Übermittlungskosten nach den Basistarifen.";

/**
 * Welche Fassung als Nächstes: die nach der zuletzt geschickten. `bisher` =
 * Zahl der schon versandten auskunft_angebot an diese Person (fiaon_mail_log).
 * E-241: Nach c kommt c, nicht wieder a — c ist die letzte Erinnerung, und
 * dieselbe Nutzen-Mail ein zweites Mal wäre genau die Welle, die wir nicht wollen.
 */
export function auskunftAngebotFassung(bisher: number): AngebotFassung {
  const n = Number.isFinite(bisher) && bisher > 0 ? Math.floor(bisher) : 0;
  return ANGEBOT_FASSUNGEN[Math.min(n, ANGEBOT_FASSUNGEN.length - 1)];
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
  /** E-241: kunde | antrag | lead. Ohne Angabe „kunde". */
  segment?: AngebotSegment;
  /**
   * E-241: Den Preis mit aktivem Paket nennen (74 € / Firma 199 €)? Ohne Angabe
   * nur im Segment „antrag". true/ein Satz schaltet ein, false/„0" aus — den
   * Wortlaut setzt die Vorlage (paketHinweis). Beim Segment „kunde" nie.
   */
  paket_preis_hinweis?: boolean | string;
  kauf_url: string;
  /** Leer = kein Hochlade-Weg in der Mail. Beim Segment „lead" nie (kein Kundenbereich). */
  upload_url?: string;
  abmelde_url: string;
  [k: string]: unknown;
}

const sicher = (s: unknown): string => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // Ein Name oder Satz aus der Nutzlast darf keinen Platzhalter in die Mail schmuggeln.
  .replace(/\{\{/g, "{ {");

/** Für die Betreffzeile: kein HTML-Ersatz (ein „&amp;" stünde dort wörtlich), aber auch kein Platzhalter. */
const klar = (s: unknown): string => String(s ?? "").replace(/[<>]/g, "").replace(/\{\{/g, "{ {").trim();

const gross = (s: string): string => s.replace(/^./, (c) => c.toUpperCase());

const ZAHLWORT = ["keine", "eine", "zwei", "drei", "vier", "fünf"];

const JA = ["1", "true", "ja", "an", "on", "yes"];
const NEIN = ["0", "false", "nein", "aus", "off", "no"];

function jaNein(roh: unknown): boolean {
  return roh === true || JA.includes(String(roh ?? "").trim().toLowerCase());
}

/**
 * Der Satz zum Preis mit aktivem Paket — oder null. `paket_preis_hinweis`
 * SCHALTET nur: ohne Angabe steht er beim fertigen Antrag, true/„1"/ein Satz
 * schaltet ihn ein, false/„0"/„nein" aus. Den Wortlaut bestimmt immer diese
 * Vorlage — ein Satz aus der Nutzlast wird nicht gedruckt: Er ginge an
 * Wortwand und Prüfstand vorbei, und „74 € statt 149 €" wäre ein Streichpreis
 * (PAngV § 11; shared/fiaon-auskunft.ts: beide Preise nebeneinander, nie „statt").
 */
function paketHinweis(roh: unknown, segment: AngebotSegment, art: AuskunftArt): string | null {
  if (segment === "kunde") return null;
  const s = typeof roh === "string" ? roh.trim().toLowerCase() : "";
  const an = roh === undefined || roh === null || (typeof roh === "string" && s === "")
    ? segment === "antrag"
    : typeof roh === "string" ? !NEIN.includes(s) : jaNein(roh);
  if (!an) return null;
  const was = art === "firma" ? "die Firmen-Auskunft" : "die Auskunft";
  const preis = euroText(auskunftPreisCents(art, true));
  return segment === "antrag"
    ? `Gut zu wissen: Mit aktivem FIAON-Paket kostet ${was} ${preis} — Ihr Paket aktivieren Sie mit der ersten Zahlung zu Ihrem Antrag.`
    : `Gut zu wissen: Als FIAON-Kunde mit laufendem Paket zahlen Sie für ${was} ${preis}.`;
}

/**
 * Baut die Mail aus der Nutzlast. Fehlt etwas, gilt der sichere Rückfall:
 * Land Deutschland, Privatkunde, Segment „kunde", Fassung a, Preis aus `mit_abo`
 * über shared/fiaon-auskunft.ts, Leistung aus auskunftLeistung — nie ein leerer
 * Satz, nie ein sichtbarer Platzhalter.
 *
 * `opts.mitUpload` setzt den Hochlade-Weg als Platzhalter (der statische
 * Eintrag für Galerie und Vorlagen-Verzeichnis); sonst entscheidet die Nutzlast.
 */
export function auskunftAngebotBaustein(p: Record<string, unknown>, opts: { mitUpload?: boolean } = {}): MailBaustein {
  const land: AuskunftLand = auskunftLand(p.land);
  // Der Takt nennt die Art zusätzlich als `auskunft_art` (Nutzlast-Vertrag E-241) — beide gelten.
  const art: AuskunftArt = (p.art ?? p.auskunft_art) === "firma" ? "firma" : "privat";
  const firma = art === "firma";
  const segment = angebotSegment(p.segment);
  const mitAbo = jaNein(p.mit_abo);
  const fassung: AngebotFassung = ANGEBOT_FASSUNGEN.includes(p.fassung as AngebotFassung) ? (p.fassung as AngebotFassung) : "a";
  const preisRoh = String(p.preis_text ?? "").trim() || euroText(auskunftPreisCents(art, mitAbo));
  const preis = sicher(preisRoh);
  const wort = auskunftWort(land);
  const bei = auskunfteienText(land);
  const anzahl = auskunfteienFuer(land).length;
  const zahl = gross(anzahl < ZAHLWORT.length ? ZAHLWORT[anzahl] : String(anzahl));
  const recht = auskunfteienFuer(land)[0]?.recht ?? "Art. 15 DSGVO";
  // Ein Lead hat keinen Kundenbereich: Der Hochlade-Weg endete für ihn an der Anmeldung.
  const mitUpload = opts.mitUpload === true || (segment !== "lead" && String(p.upload_url ?? "").trim() !== "");

  // Die Leistung: aus der Nutzlast (dieselbe Quelle, vom Server gebaut) — außer
  // sie passt nicht zum Land. Ein „SCHUFA" in Österreich fliegt raus, ehe es gedruckt wird.
  // 25.09.2026 (E-241): ebenso ein „Limit" in einer Mail an Antrag oder Lead (VERBOTENE_WORTE,
  // § 34c GewO) — etwa aus einer Nutzlast, die vor der neuen Leistungsliste gebaut wurde.
  const ausNutzlast = Array.isArray(p.leistung) && p.leistung.length ? (p.leistung as unknown[]).map(String) : null;
  const leistungRoh = ausNutzlast && !(land !== "DE" && ausNutzlast.some((z) => /schufa/i.test(z)))
    && !(segment !== "kunde" && ausNutzlast.some((z) => /limit/i.test(z)))
    ? ausNutzlast : auskunftLeistung(art, land);
  // Punkt und geschütztes Leerzeichen als Zeichen, nicht als HTML-Entität: Der
  // Text-Teil der Mail (mailText) entfernt nur Tags — „&#8226;&nbsp;" stand dort
  // wörtlich (Gegenlesen 24.09.2026).
  const liste = `<b>Das übernehmen wir für Sie:</b>\n${leistungRoh.map((z) => `•  ${sicher(z)}`).join("\n")}`;

  const name = { vorname: p.vorname as string | null, nachname: p.nachname as string | null };
  const anrede = sicher(String(p.anrede ?? "").trim() || anredeMail(name));
  const vorname = vornameFuerBetreff(name);
  const vn = vorname ? `${klar(vorname)}, ` : "";

  // Was gekauft wird — im Akkusativ („Wir holen … ein") und im Dativ („Mit … sehen Sie").
  const was = firma ? "die Firmen-Auskunft" : `Ihre ${wort}`;
  const wasDativ = firma ? "der Firmen-Auskunft" : `Ihrer ${wort}`;
  const woher = firma
    ? `die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien und Ihre persönlichen Daten bei ${sicher(bei)}`
    : `Ihre Daten bei ${sicher(bei)}`;
  // ── KEIN „LIMIT" AN ANTRÄGE UND LEADS (25.09.2026, E-241) ──────────────────
  // „Limit" steht in VERBOTENE_WORTE der Kaltansprache (shared/fiaon-lead-strecke.ts):
  // Werbung mit einer Kreditsumme an Menschen ohne Vertrag wäre Werbung für eine
  // erlaubnispflichtige Leistung (§ 34c GewO). Der zahlende Kunde (Segment „kunde")
  // behält „Karte und Wunschlimit" — Anträge und Leads lesen von der Karte.
  const kundeSegment = segment === "kunde";
  const bankFragt = firma
    ? "bevor eine Bank über Karte und Rahmen für Ihr Unternehmen entscheidet, fragt sie bei den Auskunfteien nach — über die Firma und über Sie persönlich."
    : kundeSegment
      ? "bevor eine Bank über Karte und Limit entscheidet, fragt sie bei den Auskunfteien nach, was dort über Sie gespeichert ist."
      : "bevor eine Bank über eine Karte entscheidet, fragt sie bei den Auskunfteien nach, was dort über Sie gespeichert ist.";

  const kundenpreis = segment === "kunde" && mitAbo;
  const preisSatz = (kundenpreis
    ? `<b>${preis} einmalig</b> — Ihr Preis als FIAON-Kunde mit laufendem Paket. Kein Abo, keine Laufzeit.`
    : `<b>${preis} einmalig</b> — kein Abo, keine Laufzeit.`)
    + " Beauftragt ist erst, wenn Sie auf der nächsten Seite bestätigen.";
  const hinweis = paketHinweis(p.paket_preis_hinweis, segment, art);
  const preisTeil = hinweis ? [preisSatz, hinweis] : [preisSatz];
  const nutzen = `<b>${kundeSegment ? AUSKUNFT_NUTZEN_SATZ : AUSKUNFT_NUTZEN_SATZ_KARTE}</b>`;
  // Die ehrliche Antwort wörtlich aus shared/fiaon-auskunft.ts — der erste Satz („Ja, … kostenlos zu") fett.
  const kostenlosAntwort = AUSKUNFT_KOSTENLOS_ANTWORT.replace(/^([^.]*\.)\s/, "<b>$1</b> ");

  const gemeinsam: Omit<MailBaustein, "betreff" | "preheader" | "titel" | "absaetze"> = {
    marke: kundenpreis ? "Ihr Kundenpreis" : "Einmalig, ohne Abo",
    daten: [
      firma
        ? { label: "Eingeholt bei", wert: `Wirtschaftsauskunfteien, ${sicher(bei)}` }
        : { label: "Auskunfteien", wert: sicher(bei) },
      { label: kundenpreis ? "Ihr Kundenpreis" : "Ihr Preis", wert: `${preis} einmalig` },
      { label: "Laufzeit", wert: "keine — kein Abo" },
    ],
    // Der Preis steht im Knopf: Wer klickt, weiß, was es kostet — die Seite dahinter bestätigt es nur noch.
    knopf: { text: `Auskunft für ${preis} beauftragen`, url: "{{params.kauf_url}}" },
    ...(mitUpload ? { knopf2: { text: "Schon eine aktuelle Auskunft? Hier hochladen", url: "{{params.upload_url}}" } } : {}),
    fussnote: `${firma ? "Ihre persönliche Datenkopie" : "Ihre Datenkopie"} steht Ihnen bei jeder Auskunftei auch kostenlos zu (${recht}) — `
      + "mit dem Auftrag übernehmen wir das Einholen, die Auswertung, den Handlungsplan und die Schreiben für Sie. "
      + (kundeSegment ? "Über Karte und Limit entscheidet am Ende immer die Bank. " : "Über eine Karte entscheidet am Ende immer die Bank. ")
      + `${WIDERSPRUCH_SATZ} Den Abmeldelink finden Sie ganz unten in dieser E-Mail.`,
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  };

  // ══ FASSUNG B — DER EINWAND „DAS GIBT ES DOCH KOSTENLOS" ═════════════════
  // Gegenlesen 25.09.2026 (E-241): Kostenlos ist die DATENKOPIE, nicht unser Auftrag. „Eine Auskunft
  // anbieten, die es auch kostenlos gibt" stimmte so nicht und entwertete die eigene Leistung — der
  // Einstieg stellt jetzt die Frage des Lesers, die Antwort gibt AUSKUNFT_KOSTENLOS_ANTWORT.
  if (fassung === "b") {
    const einstieg = segment === "kunde"
      ? `${anrede} bevor Sie ${was} bei uns beauftragen, sollen Sie eine ehrliche Antwort auf die naheliegende Frage haben.`
      : segment === "antrag"
        ? `${anrede} Ihr Antrag liegt bei uns — und vielleicht fragen Sie sich, wozu Sie ${was} beauftragen sollten, wenn die Datenkopie doch kostenlos ist. Eine berechtigte Frage — hier ist die ehrliche Antwort.`
        : `${anrede} vielleicht fragen Sie sich, wozu Sie uns brauchen, wenn die Datenkopie bei den Auskunfteien doch kostenlos ist. Eine berechtigte Frage — hier ist die ehrliche Antwort.`;
    return {
      ...gemeinsam,
      marke: "Ehrlich gefragt",
      betreff: gross(segment === "kunde"
        ? (firma ? `${vn}warum nicht einfach selbst anfragen? Und wozu dann ${klar(preisRoh)}?` : `${vn}Ihre Datenkopie ist kostenlos — wozu also ${klar(preisRoh)}?`)
        : segment === "antrag"
          ? `${vn}kostenlos selbst anfordern oder beauftragen?`
          : (firma ? `${vn}warum nicht einfach selbst bei den Auskunfteien anfragen?` : `${vn}Ihre Datenkopie ist kostenlos. Wofür gibt es dann uns?`)),
      preheader: "Die ehrliche Antwort: was wir Ihnen abnehmen und was Sie davon haben.",
      titel: "„Das kann ich doch kostenlos selbst anfordern?“",
      absaetze: [
        einstieg,
        kostenlosAntwort,
        // Gegenlesen 25.09.2026: „Wir nehmen Ihnen die Arbeit ab" steht schon im Absatz davor
        // (AUSKUNFT_KOSTENLOS_ANTWORT) — zweimal hintereinander liest sich wie Füllstoff. Und der Nutzen
        // steht VOR der Liste: Deren letzter Punkt (Betreuer, Weg zu Karte und Limit) sagt fast dasselbe.
        "Selbst angefordert heißt: für jede Auskunftei den richtigen Weg finden, einzeln anfragen — und am Ende Listen voller Kürzel, Daten und Fristen selbst auswerten. "
          + "Ob ein Eintrag zu alt ist oder nicht stimmt, sieht man ihm nicht an. Genau hier beginnt unsere Arbeit.",
        nutzen,
        liste,
        ...preisTeil,
      ],
    };
  }

  // ══ FASSUNG C — KURZ UND PERSÖNLICH, DIE LETZTE ERINNERUNG ═══════════════
  // Kein „letzte Chance", keine Frist, kein „nur noch heute" — und auch kein
  // Versprechen, dass nichts mehr kommt: Das entscheidet der Takt, nicht der Text.
  if (fassung === "c") {
    const einstieg = segment === "kunde"
      ? `${anrede} wir möchten Sie nicht drängen — nur sichergehen, dass es nicht untergegangen ist: In Ihrer Akte fehlt noch ${was}.`
      : segment === "antrag"
        ? `${anrede} ein kurzer Gedanke zu Ihrem Antrag, ganz ohne Druck: Bevor die Bank entscheidet, schaut sie in die Daten der Auskunfteien. Wer vorher weiß, was dort steht, geht vorbereitet in diesen Schritt.`
        : `${anrede} eine kurze, persönliche Nachricht von uns: Bevor eine Bank über ${firma ? "eine Karte für Ihr Unternehmen" : "Ihre Karte"} entscheidet, schaut sie in die Daten der Auskunfteien. Mit ${wasDativ} sehen Sie vorher, was dort steht.`;
    return {
      ...gemeinsam,
      marke: "Kurz und persönlich",
      betreff: gross(segment === "kunde"
        ? `${vn}in Ihrer Akte fehlt noch ein Baustein`
        : segment === "antrag"
          ? `${vn}ein kurzer Gedanke zu Ihrem Antrag`
          : `${vn}kurz und ohne Umwege: ${firma ? "die Firmen-Auskunft" : `Ihre ${wort}`}`),
      preheader: firma
        ? "Ein Auftrag für Ihr Unternehmen und Sie — jede Zeile erklärt, mit Handlungsplan."
        : `${zahl} Auskunfteien, ein Auftrag — jede Zeile erklärt, mit Handlungsplan.`,
      titel: segment === "kunde" ? "Ein Baustein fehlt noch" : segment === "antrag" ? "Vorbereitet in die Entscheidung" : "Vorher wissen, was die Bank sieht",
      absaetze: [
        einstieg,
        `Wir holen ${woher} ein, erklären jeden Eintrag, prüfen die Fristen und legen Ihnen Ihren Handlungsplan und, wo nötig, fertige Schreiben zur Freigabe vor.`,
        nutzen,
        ...preisTeil,
        "Passt es gerade nicht, ist das völlig in Ordnung.",
      ],
    };
  }

  // ══ FASSUNG A — WAS DIE BANK SIEHT ══════════════════════════════════════
  const einstieg = segment === "kunde"
    ? `${anrede} ${bankFragt} ${firma ? "In Ihrer Akte bei uns fehlt diese Auskunft bisher." : `Viele haben diese Daten selbst nie gesehen — und in Ihrer Akte bei uns fehlt ${was} bisher.`}`
    : segment === "antrag"
      ? `${anrede} Ihr Antrag liegt bei uns. ${gross(bankFragt)}${firma ? "" : " Viele haben diese Daten selbst nie gesehen."}`
      : `${anrede} Sie haben sich bei FIAON gemeldet — und ${firma ? "der Weg zur Karte für Ihr Unternehmen" : "der Weg zur eigenen Karte"} beginnt mit einer einfachen Frage: Was sieht die Bank? ${gross(bankFragt).replace(/^Bevor eine Bank/, "Bevor sie")}`;
  return {
    ...gemeinsam,
    betreff: gross(segment === "kunde"
      ? (firma ? `${vn}was sehen Banken über Ihr Unternehmen?` : `${vn}was sieht die Bank, bevor sie über Ihre Karte entscheidet?`)
      : segment === "antrag"
        ? (firma ? `${vn}was sieht die Bank über Ihr Unternehmen?` : `${vn}bevor die Bank entscheidet: Wissen Sie, was sie sieht?`)
        : (firma ? `${vn}was Banken über Ihr Unternehmen sehen — und Sie vielleicht nicht` : `${vn}was Banken über Sie sehen — und Sie vielleicht nicht`)),
    preheader: segment === "kunde"
      ? `${gross(was)} fehlt noch in Ihrer Akte — eingeholt, erklärt, mit Handlungsplan.`
      : segment === "antrag"
        ? `Wir holen ${was} ein und erklären jede Zeile — einmalig, ohne Abo.`
        : `${gross(was)}, Zeile für Zeile erklärt — mit persönlichem Handlungsplan.`,
    titel: firma ? "Wissen, was über Ihr Unternehmen gespeichert ist" : "Wissen, was die Bank sieht",
    absaetze: [
      einstieg,
      `Mit dem Auftrag holen wir ${firma ? "die Daten Ihres Unternehmens und Ihre persönlichen Daten" : "Ihre Daten"} ein und gehen sie mit Ihnen durch — was dort steht, was es bedeutet und was Sie jetzt tun können.`,
      // Gegenlesen 25.09.2026: Nutzen vor der Liste (wie Fassung b) — nicht direkt hinter ihrem letzten Punkt.
      nutzen,
      liste,
      ...preisTeil,
    ],
  };
}

/**
 * Der statische Eintrag im Vorlagen-Verzeichnis: Fassung a für Deutschland, mit
 * Platzhaltern. Er macht das Ereignis für hatVorlage, Galerie und Mailwerk
 * sichtbar; gerendert wird immer über auskunftAngebotBaustein (Motor).
 */
export const AUSKUNFT_VERKAUF_VORLAGEN: Record<string, MailBaustein> = {
  auskunft_angebot: auskunftAngebotBaustein({ land: "DE", mit_abo: true, segment: "kunde" }, { mitUpload: true }),
};

/**
 * Die Nutzlast aus bekannten Werten — rein, ohne Datenbank. Die Werte selbst
 * holt fiaon-auskunft-lieferung.ts (auskunftAngebotNutzlast); hier steht nur,
 * wie sie zusammengesetzt wird, damit Takt, Akte und Prüfstand dieselbe bauen.
 * E-241: `segment` (Standard „kunde"), `fassung` (sonst aus bisherGesendet),
 * `paketPreisHinweis` (sonst nur beim Antrag) und eine leere uploadUrl (dann
 * ohne Hochlade-Weg).
 */
export function angebotNutzlastBauen(e: {
  email: string; personId: number; vorname?: string | null; nachname?: string | null;
  land: AuskunftLand; mitAbo: boolean; preisCents: number; art?: AuskunftArt;
  kaufUrl: string; uploadUrl?: string | null; abmeldeUrl: string; bisherGesendet?: number;
  segment?: AngebotSegment; fassung?: AngebotFassung; paketPreisHinweis?: boolean;
}): AngebotNutzlast {
  const art = e.art ?? "privat";
  return {
    email: e.email, person_id: e.personId, vorname: e.vorname ?? null, nachname: e.nachname ?? null,
    anrede: anredeMail({ vorname: e.vorname, nachname: e.nachname }),
    preis_text: euroText(e.preisCents), mit_abo: e.mitAbo, land: e.land,
    auskunfteien: auskunfteienText(e.land), leistung: auskunftLeistung(art, e.land), art,
    segment: angebotSegment(e.segment),
    fassung: e.fassung && ANGEBOT_FASSUNGEN.includes(e.fassung) ? e.fassung : auskunftAngebotFassung(e.bisherGesendet ?? 0),
    ...(e.paketPreisHinweis !== undefined ? { paket_preis_hinweis: e.paketPreisHinweis } : {}),
    kauf_url: e.kaufUrl, upload_url: String(e.uploadUrl ?? "").trim(), abmelde_url: e.abmeldeUrl,
  };
}
