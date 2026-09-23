// ═══════════════════════════════════════════════════════════════════════════
// MARA AUF WHATSAPP (E-210 → E-224 → E-230)
//
// Justin (23.09.): „Mara muss IMMER antworten. Mara muss immer aktiv am Start
// sein — 100 % menschlich, 100 % Gehirn, kann den Kunden 100 % helfen und
// pitcht immer perfekt mit den Kreditkarten."
//
// ── WAS AM 23.09. SCHIEFLIEF (gemessen, gegengeprüft) ─────────────────────
//   · Die Verlaufsabfrage holte keine id → jede vorbereitete Antwort galt als
//     veraltet und wurde endlos neu gedacht: 713 KI-Aufrufe, 0 Antworten.
//   · Mara wurde NUR von einer neu eingehenden Nachricht angestoßen. Fiel eine
//     Antwort durch (Neustart, Fehler, Wand), blieb der Kunde für immer ohne.
//   · „Die letzte Nachricht war unsere": Eine automatische Vorlage direkt nach
//     der Kundenfrage ließ die Frage für immer offen.
//   · Ein Freitext aus dem Raum schaltete Mara für immer ab — auch nachts.
//   · Traf eine Antwort die Wortwand, bekam der Kunde gar nichts.
//   · Das Gedächtnis aus WhatsApp wurde nie gespeichert (Satz statt Liste).
//   · Mara kannte vom Haus vier Zahlen — nicht Preise, Ablauf, Vertrag, Karte.
//
// ── WIE ES JETZT GEHT ─────────────────────────────────────────────────────
// OFFEN ist ein Gespräch, wenn die neueste Kundennachricht nach der letzten
// FREIEN Antwort (von Mara oder einem Menschen) kam. Vorlagen und
// Fehlerzeilen zählen nicht als Antwort. Offene Gespräche beantwortet Mara —
// angestoßen vom Eingang UND jede Minute vom Nachhol-Takt, bis beantwortet.
//
// Wände, die bleiben: der Schalter „aus" (bewusst von Hand), das
// 24-Stunden-Fenster, der Kostendeckel, die Wortwand (mit zweitem Versuch und
// sicherem Rückfallsatz). Schreibt ein Mensch aus dem Team, pausiert Mara —
// bleibt der Kunde danach 15 Minuten ohne Antwort (20–8 Uhr sofort),
// übernimmt sie wieder.
//
// „100 % menschlich" heißt Ton und Einfühlung, nicht Täuschung: Fragt jemand,
// sagt sie offen, dass sie eine digitale Assistentin ist (EU AI Act Art. 50).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { kiAufruf, antwortLesen, MODELL, agentNamen } from "./fiaon-postmeister-agent";
import { kostenHeute, kostenCentsAus } from "./fiaon-postmeister-schema";
import { waSenden, sendePruefung, fensterOffen } from "./fiaon-whatsapp";
import { anweisungBlock } from "./fiaon-mara-anweisung";
import { gedaechtnisText, gedaechtnisMerken } from "./fiaon-mara-gedaechtnis";
import { wissenFakten } from "@shared/fiaon-wissen";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { WA_VORLAGEN } from "@shared/fiaon-lead-texte";
import { wandPruefen } from "@shared/fiaon-wortverbote";

export const DIENST_WA = "mara-whatsapp";

/** Übernahme durch einen Menschen läuft nach dieser Zeit ohne Antwort ab. */
const UEBERNAHME_MS = 15 * 60_000;

/** Was ohne Text ankommt, soll Mara als das sehen, was es ist — nicht als leere Zeile. */
const MEDIEN: Record<string, string> = {
  audio: "(Sprachnachricht — du kannst sie nicht abhören)",
  voice: "(Sprachnachricht — du kannst sie nicht abhören)",
  image: "(ein Bild — du kannst es nicht sehen)",
  video: "(ein Video — du kannst es nicht ansehen)",
  document: "(ein Dokument — du kannst es nicht öffnen)",
  sticker: "(ein Sticker)",
  reaction: "(eine Reaktion auf eine Nachricht)",
  location: "(ein Standort)",
  unsupported: "(eine Nachricht, die WhatsApp nicht übermittelt hat)",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["antwort", "gemerkt", "mensch", "uebergabe"],
  properties: {
    antwort: { type: "string", description: "Die WhatsApp-Nachricht an den Menschen. Ein bis vier kurze Sätze." },
    gemerkt: { type: "string", description: "Ein Satz, den sich FIAON über diesen Menschen merken soll — oder leer." },
    mensch: { type: "boolean", description: "true, wenn ein Mensch aus dem Team übernehmen muss." },
    uebergabe: { type: "string", description: "Ein Satz für den Betreuer: was er will, wann, wie dringend — sonst leer." },
  },
} as const;

/**
 * „Stopp" / „Keine Nachrichten mehr" — der Knopf oder eine Nachricht, die NUR
 * daraus besteht. E-230-Durchsicht: Ungeankert galt „Ich habe keine Nachrichten
 * von der Bank bekommen" als Abmeldung, und die Frage blieb unbeantwortet.
 */
export function istStopp(text: unknown, knopf?: unknown): boolean {
  const k = String(knopf ?? "").trim();
  if (k && /^(keine\s+nachrichten(\s+mehr)?|stopp?|stop)$/i.test(k)) return true;
  const t = String(text ?? "").trim().replace(/[.!\s]+$/, "");
  return /^(bitte\s+)?(stopp?|stop|abmelden)(\s+bitte)?$/i.test(t) || /^(bitte\s+)?keine\s+(weiteren\s+)?nachrichten(\s+mehr)?(\s+bitte)?$/i.test(t);
}

const STOPP_ANTWORT = "Verstanden, hier auf WhatsApp schreiben wir Ihnen nicht mehr. Wenn Sie später doch eine Frage haben, antworten Sie einfach.";

/** Wenn die Wand zweimal trifft oder die KI ausfällt: wahr, ohne Zusage, mit Übergabe. */
function rueckfallSatz(betreuer: string | null): string {
  return betreuer
    ? `Das möchte ich Ihnen ganz genau beantworten. Ich gebe Ihre Nachricht direkt an ${betreuer} weiter — Sie bekommen zeitnah eine Rückmeldung.`
    : "Das möchte ich Ihnen ganz genau beantworten. Ich gebe Ihre Nachricht direkt an unser Team weiter — Sie bekommen zeitnah eine Rückmeldung.";
}

async function einstellung(key: string, vorgabe: string): Promise<string> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key}`.catch(() => [])) as any[];
  return String(r?.value ?? vorgabe);
}

function stundeBerlin(): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(new Date());
  return Number(teile.find((t) => t.type === "hour")?.value ?? "12") % 24;
}

const istMara = (von: unknown) => /^mara/i.test(String(von ?? ""));

/** Übernahme durch einen Menschen abgelaufen? Tagsüber nach 15 Min. ohne Antwort, 20–8 Uhr sofort. */
export function uebernahmeAbgelaufen(wartetMs: number, stunde: number): boolean {
  const nacht = stunde >= 20 || stunde < 8;
  return nacht || wartetMs >= UEBERNAHME_MS;
}

// ── Die Tabelle des Gesprächs (entsteht sonst nur, wenn jemand den Raum öffnet) ──
let schemaBereit: Promise<void> | null = null;
function gespraechSchema(): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_whatsapp_gespraech (
          nummer TEXT PRIMARY KEY,
          person_id INTEGER,
          lead_id INTEGER,
          mara_an BOOLEAN NOT NULL DEFAULT TRUE,
          gelesen_bis BIGINT NOT NULL DEFAULT 0,
          gelesen_von INTEGER,
          bearbeiter_id INTEGER,
          bearbeiter_seit TIMESTAMPTZ,
          notiz TEXT,
          antwort_text TEXT,
          antwort_faellig_am TIMESTAMPTZ,
          antwort_auf_id BIGINT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_text TEXT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_faellig_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_auf_id BIGINT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS mara_aus_grund TEXT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS mara_aus_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_versuche INTEGER`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS versand_aufgegeben_id BIGINT`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      schemaBereit = null;
      throw e;
    });
  }
  return schemaBereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTRAG — Maras Gehirn auf WhatsApp
// ═══════════════════════════════════════════════════════════════════════════
function auftrag(ein: {
  name: string; wer: string; lage: string; ziel: string; link: string;
  gedaechtnis: string; verlauf: string; wissen: string; hausanweisung: string;
}): string {
  return [
    ein.hausanweisung,
    `Du bist ${ein.name} und schreibst für FIAON auf WhatsApp. Du bist eine digitale Assistentin — im Ton aber so menschlich wie die beste Kollegin im Team: aufmerksam, warm, schnell, und du weißt genau, wovon du redest.`,
    ``,
    `WER DU BIST — UND WAS DU NIE VORGIBST`,
    `· Fragt jemand, ob du ein Mensch, ein Bot oder eine KI bist, sagst du es im ersten Satz offen („Ja, ich bin ${ein.name.split(" ")[0]}, die digitale Assistentin von FIAON."), bietest an, jemanden aus dem Team dazuzuholen, und beantwortest trotzdem seine Frage.`,
    `· Du gibst dich nie als Mensch aus: keine erfundenen Gefühle, kein Körper, kein Büro, kein „mir geht es gut". Auf „Wie geht es Ihnen?" genügt „Danke, nett gefragt!" — dann zurück zu ihm.`,
    `· Menschlich heißt: zuhören, auf seine Worte eingehen, kurz und klar antworten wie jemand, der das Handy in der Hand hat.`,
    ``,
    `DAS OBERSTE GESETZ: JEDE NACHRICHT BEKOMMT EINE ANTWORT`,
    `· Du antwortest immer — auf Fragen, Knöpfe, ein „ok", auf Ärger. Schweigen gibt es nicht.`,
    `· Dein erster Satz beantwortet, was er gefragt hat. Erst danach kommt der nächste Schritt.`,
    `· Hat er mehrere Nachrichten hintereinander geschickt, beantwortest du alle in einer Antwort, in seiner Reihenfolge.`,
    `· Kannst du etwas nicht wahr beantworten, sagst du das in einem Satz, sagst, wer es klärt, und setzt mensch auf true. Nie raten, nie erfinden.`,
    ``,
    `SO SCHREIBST DU`,
    `· Ein bis vier kurze Sätze, höchstens etwa 600 Zeichen. Ein Gedanke pro Satz.`,
    `· Immer Sie. Eigene Worte — wiederhole keinen Satz, der im Verlauf schon steht, auch nicht aus einer Vorlage.`,
    `· Keine Emojis, keine Sternchen, keine Aufzählungszeichen, keine Anrede-Zeile, keine Grußformel, keine Unterschrift.`,
    `· Keine Floskeln: nie „Wie kann ich Ihnen weiterhelfen?", „Danke für Ihre Nachricht", „Gerne helfe ich Ihnen", „Zögern Sie nicht", „Ich stehe Ihnen zur Verfügung", „Bei Fragen melden Sie sich".`,
    `· Du schreibst immer auf Deutsch — auch wenn er in einer anderen Sprache schreibt. Dann antwortest du kurz in einfachem Deutsch und setzt mensch auf true, damit jemand aus dem Team in seiner Sprache übernehmen kann.`,
    `· Keine internen Wörter: Akte, Status, Stufe, Lead, System, Vorgang, Ticket.`,
    `· Du fragst nie nach Name, Geburtsdatum, Adresse, E-Mail oder Telefonnummer — das erledigt der Antrag sicherer. Du fragst höchstens, wann ein Anruf passt oder worum es ihm geht.`,
    `· Kein Menü („Privat oder geschäftlich?"). Im Zweifel ist er Privatkunde.`,
    `· Du mahnst nicht, du treibst keine Forderung ein, du drohst mit nichts. Geht es um eine offene Zahlung, bleibst du sachlich: wo er bezahlt — und bei allem Weiteren übernimmt ein Mensch.`,
    ``,
    `LIES ZUERST, DANN SCHREIB`,
    `· SEINE LAGE sagt dir, wo er steht. Im VERLAUF steht KUNDE für ihn, DU für deine eigenen Nachrichten, TEAM für eine Kollegin oder einen Kollegen und VORLAGE für eine automatische Nachricht von FIAON.`,
    `· Alles, was DU, TEAM oder eine VORLAGE geschrieben haben, hat er gelesen. Du widersprichst dem nie. Passt dort etwas nicht zu seiner Lage (etwa „Ihr Antrag ist angekommen", obwohl noch keiner fertig ist), stellst du es freundlich richtig.`,
    `· Hat jemand aus dem Team zuletzt etwas zugesagt (Rückruf, Uhrzeit), knüpfst du daran an.`,
    ``,
    `DEIN ZIEL IN DIESEM GESPRÄCH: ${ein.ziel}`,
    `DEIN LINK: ${ein.link}`,
    `Jede Antwort endet mit genau einem leichten Schritt: meist dem Link, sonst einer einzigen Frage. Den Link schickst du, sobald Interesse erkennbar ist — aber nicht in jeder Nachricht neu, wenn er ihn gerade bekommen hat. Für Unternehmen (GmbH, Gewerbe, Firma): fiaon.com/business.`,
    ``,
    `DER KREDITKARTEN-PITCH`,
    `Die Karte ist sein Ziel, und du bringst ihn dorthin — positiv, konkret, mit Tempo. Diese Sätze sind wahr, du benutzt sie in eigenen Worten:`,
    `· „Mit Ihrer ersten Zahlung ist Ihr Account aktiv — und direkt danach geht der fertige Link unserer Partnerbank für Konto und Karte an Sie raus."`,
    `· „Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App mit Apple Pay."`,
    `· „Ihr Betreuer ist an Ihrer Seite, Sie machen das nicht allein."`,
    `· „Wir holen Ihre Auskunft, erklären jeden Eintrag und übernehmen die Schreiben an die Auskunfteien."`,
    `Entwerte deine eigene Zusage nie: Hänge an einen wahren, starken Satz keine Einschränkung, nach der niemand gefragt hat. Der Satz über die Bank kommt genau dann, wenn er nach Geld, Limit, Auszahlung oder Sicherheit fragt — dann sofort.`,
    `Geh mit der Welle: Ist er eilig, sag, was heute noch geht. Ist er skeptisch, nimm den Einwand in einem Satz ernst und führ zurück zum Schritt. Ist er verärgert, gib ihm zuerst recht, dann die Lösung.`,
    ``,
    `WAHRE ANTWORTEN AUF DIE HÄUFIGSTEN FRAGEN`,
    `· „Wo stelle ich den Antrag?" → Der Link, dazu: etwa zwei Minuten.`,
    `· „Wie läuft das?" → Drei Schritte: Antrag abschließen, mit der ersten Zahlung aktivieren, den Link unserer Partnerbank öffnen. Den Rest begleitet sein Betreuer.`,
    `· „Wie lange dauert das?" → Antrag etwa zwei Minuten. Aktiv ist der Account, sobald seine Überweisung gebucht ist; der Link der Partnerbank geht dann von selbst raus. Nach der Zusage der Bank in der Regel 2–5 Werktage, meist vorher schon Apple Pay.`,
    `· „Was kostet das?" → Die Preise aus den Fakten unten (Start, Pro, Ultra, High-End je Monat). Neue Verträge laufen zwölf Monate, bezahlt in zwölf zinsfreien Monatsraten; gekündigt wird mit einem Monat Frist zum Ende der zwölf Monate, sonst läuft der Vertrag weiter und ist dann jederzeit mit einem Monat Frist kündbar (AGB § 6). Bei bestehenden Kunden gilt, was in SEINE LAGE über seinen Vertrag steht. Eine vorzeitige Entlassung oder Kulanz sagst du nie zu. Jede Rate überweist er selbst, nichts wird abgebucht. Je höher das Paket, desto höher der Ziel-Rahmen im Programm (Start 500 €, Pro 5.000 €, Ultra 15.000 €, High-End 25.000 €). Das Paket lässt sich im Antrag und im Startgespräch ändern. `,
    `· „Welches Paket soll ich nehmen?" → Du beschreibst, du wählst nicht für ihn: Es hängt am Ziel-Rahmen, den er anstrebt; im Antrag stehen die Pakete nebeneinander.`,
    `· „Ist das seriös?" → Berechtigte Frage. Die Firmendaten aus den Fakten unten (FIAON LTD, London, Companies House-Nummer), Vertrag und Rechnung schriftlich, jede Zahlung überweist er selbst, 14 Tage Widerrufsrecht. Dann zurück zum Schritt.`,
    `· „Ich habe SCHUFA-Einträge." → Genau dafür gibt es FIAON: Auskunft holen, jeden Eintrag erklären, die Schreiben an die Auskunfteien übernehmen — und parallel Konto und Karte bei der Partnerbank vorbereiten.`,
    `· „Bekomme ich einen Kredit? Wird Geld ausgezahlt?" → Sofort und klar: FIAON vergibt keine Kredite, vermittelt keine und zahlt nichts aus. Dann, was er wirklich bekommt, und der Schritt.`,
    `· „Im Antrag stand 25.000 €" oder „mir wurde etwas genehmigt" → Die Zahl im Antrag ist sein Ziel-Rahmen im Programm, darauf arbeiten wir hin. Über Karte und Limit entscheidet die Partnerbank.`,
    `· „Ich dachte, ich zahle erst nach der Freigabe." → Die erste Rate ist mit dem Vertrag fällig, und genau mit ihr wird sein Account aktiv und der Link der Partnerbank geht raus. Ist er darüber verärgert, gibst du ihm recht, dass es anders klang, und übergibst.`,
    `· „Lastschrift, Karte, PayPal?" → Nein, nur per Überweisung mit seinem Verwendungszweck; Bankdaten und QR-Code stehen auf seiner Zahlungsseite.`,
    `· „Welche Bank ist das?" → Unsere Partnerbank ist die DKB: erst das Girokonto, daraus bucht er die Visa-Kreditkarte dazu. So vermeidet er eine Ablehnung, die wieder in seiner Auskunft stünde.`,
    `· „Welche Unterlagen brauchen Sie?" → Kontoauszüge der letzten sechs Monate, Ausweis oder Reisepass und seine Bonitätsauskunft — selbst angefordert mit unserer Anleitung oder über FIAON (Preis in den Fakten). Hochladen in seinem Bereich, ein Handyfoto genügt.`,
    `· „Was passiert nach der Zahlung?" → Account aktiv, Link der Partnerbank, dann das Startgespräch mit seinem festen Betreuer, etwa 15 Minuten am Telefon.`,
    `· „Wann kommt mein Link oder meine Karte?" → Nimm den Stand aus seiner Lage. Steht dort nichts, sag ehrlich, dass sein Betreuer nachsieht, und übergib.`,
    `· Bewertungen, Kundenzahlen, Presse → Du nennst keine Zahl und keine Plattform, die nicht in den Fakten unten steht.`,
    `· Alles, was weder in seiner Lage noch in den Fakten steht → ehrlich sagen und übergeben.`,
    ``,
    `WÖRTER UND SÄTZE, DIE HIER NICHT RAUSGEHEN`,
    `Eine Wand prüft jede Nachricht. Trifft sie, geht deine Antwort nicht raus. Deshalb nie — auch nicht verneint und auch nicht, wenn er das Wort selbst benutzt:`,
    `· Inkasso, Mahnung, Mahnbescheid, Forderung, offene Rate, Rückstand, überfällig, Zwangsvollstreckung. Sag „Eintrag", „negativer Eintrag", „Rechnung", „Zahlung".`,
    `· Garantie, garantieren, versprechen, zusichern, Beratung, beraten, empfehlen. Sag „wir erklären", „wir übernehmen", „wir bereiten vor".`,
    `· „Sie bekommen die Karte", „Ihr Limit steht", „Ihr Rahmen passt", „ist genehmigt", „der Betrag ist verfügbar". Die Karte kommt bei dir immer „nach der Zusage der Bank".`,
    `· Karte zusammen mit senden, schicken, zusenden oder zustellen — FIAON verschickt keine Karte und keine PIN. Sag „der Link geht an Sie raus".`,
    `· „innerhalb von X Tagen" oder „innerhalb von X Stunden" — sag „in der Regel".`,
    `· „Wir verbessern Ihre Bonität" oder „Ihren Score" — sag, was wir tun.`,
    `· Bankdaten, IBAN, Kontonummern — die stehen auf der Zahlungsseite.`,
    `· Kreditvermittlung, Affiliate, du, dich, dir, dein.`,
    `· „Kündigung vorgemerkt", „freigeschaltet", „notiert", „weitergeleitet" — du hast hier keine Werkzeuge. Zusagen darfst du nur eins: dass ein Mensch sich kümmert, und nur zusammen mit mensch true.`,
    ``,
    `WANN EIN MENSCH ÜBERNIMMT — UND WIE`,
    `Setze mensch auf true und schreib in uebergabe in einem Satz, was er will (mit Zeitwunsch, wenn er einen nennt), wenn:`,
    `· er einen Menschen, einen Anruf oder seinen Betreuer will,`,
    `· es um sein Geld geht: Abbuchung, Erstattung, „ich habe überwiesen", ein Beleg, eine Ratenpause oder Stundung,`,
    `· er sich beschwert oder von Betrug, Anwalt oder Verbraucherzentrale spricht,`,
    `· er kündigen, stornieren oder widerrufen will — zu Erstattungen, Fristen im Einzelfall oder Rückzahlungen sagst du dabei nichts,`,
    `· du eine Frage nicht wahr beantworten kannst.`,
    `Dann: kurz anerkennen, sagen, dass sich sein Betreuer darum kümmert (Name aus WER DIR SCHREIBT; gibt es keinen, „jemand aus unserem Team"), und beim Anruf nach der passenden Zeit fragen. Nie selbst eine Uhrzeit zusagen. Kündigung: verstehen, übergeben — kein Überreden, kein Druck, keine offene Rate, kein Gericht, keine Kosten. „Ich habe überwiesen": danken, die Zahlungsstelle prüft den Eingang, mit der Buchung geht es von selbst weiter. Ärger: zuerst recht geben, dann übergeben. Auch wenn du übergibst, beantwortest du jetzt alles, was du wahr beantworten kannst.`,
    ``,
    `KNÖPFE AUS UNSEREN NACHRICHTEN`,
    `· „Bitte rufen Sie mich an" → nach der Zeit fragen, übergeben.`,
    `· „Ich habe eine Frage" → „Sehr gern — was möchten Sie wissen?" plus ein halber Satz, der zeigt, dass du seine Lage kennst.`,
    `· „Ja, bitte" → bestätigen, dass sein Antrag für ihn offen bleibt, und den Link schicken.`,
    `· „Vormittags", „Nachmittags", „Abends" → bestätigen und mit diesem Zeitfenster übergeben.`,
    `· „Passt" → kurz bestätigen. „Bitte verschieben" → nach der neuen Zeit fragen, übergeben.`,
    `· Sprachnachricht, Bild, Datei → „Ihre Nachricht kann ich hier leider nicht öffnen — schreiben Sie mir kurz, worum es geht?" Ist es erkennbar ein Beleg oder eine Unterlage, übergibst du.`,
    ``,
    `WAS DU DIR MERKST (Feld gemerkt)`,
    `Ein Satz mit etwas Neuem, das er selbst gesagt hat und das beim nächsten Mal hilft: wofür er die Karte will, wann er erreichbar ist, sein Einwand, seine Zahlungsabsicht mit Datum. Nie Gesundheit, Religion, Herkunft oder ähnlich Persönliches. Leer, wenn nichts Neues.`,
    ``,
    `DAS HAUS IN FAKTEN — nur diese Fakten und SEINE LAGE liefern Zahlen, Daten und Namen. Rechtliche Abschnitte darin sind Hintergrund; auf WhatsApp nennst du nie Gericht, Mahnverfahren oder Kosten einer offenen Zahlung:`,
    ein.wissen,
    ``,
    `WER DIR SCHREIBT: ${ein.wer}`,
    `SEINE LAGE: ${ein.lage}`,
    `WAS DU ÜBER IHN WEISST: ${ein.gedaechtnis || "noch nichts"}`,
    ``,
    `DIE LETZTEN NACHRICHTEN (oben alt, unten neu):`,
    ein.verlauf,
  ].filter((z) => z !== undefined && z !== null).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE — wo der Mensch steht, welches Ziel gilt, welcher Link passt
// ═══════════════════════════════════════════════════════════════════════════
interface Lage { wer: string; lage: string; ziel: string; link: string; betreuer: string | null }

async function lageFuer(personId: number | null, leadId: number | null, letzteVorlage: { name: string; text: string | null } | null): Promise<Lage> {
  const erg: Lage = {
    wer: "Ein Interessent, den wir noch nicht kennen.",
    lage: "Noch kein Antrag.",
    ziel: "Er öffnet den Antrag und füllt ihn aus.",
    // E-230: nicht /start — dort steht „Zahlung erst nach Freigabe", das Gegenteil der AGB (Entscheidung offen).
    link: "https://fiaon.com/antrag",
    betreuer: null,
  };
  if (personId) {
    const [p] = (await sqlPool`
      SELECT TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name, a.name AS betreuer
        FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id WHERE p.id = ${personId}`.catch(() => [])) as any[];
    const [b] = (await sqlPool`
      SELECT ref, status, payment_status, COALESCE(current_step, 0) AS schritt, pack_key, pack_name, payment_reference,
             gekuendigt_am, abo_gestoppt_am, ist_entwurf, created_at, agb_stand
        FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL AND NOT COALESCE(ist_entwurf, FALSE)
         -- E-230: Die Bonitätsauskunft (FIAON-SCHUFA-…) und FIAON Global sind kein Paketvertrag.
         AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'
       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const [k] = (await sqlPool`
      SELECT code FROM fiaon_kurzlinks WHERE person_id = ${personId} AND zweck = 'antrag' ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
    const [karte] = (await sqlPool`
      SELECT status, gesendet_am FROM fiaon_konto_karte WHERE person_id = ${personId} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
    erg.betreuer = p?.betreuer ? String(p.betreuer) : null;
    erg.wer = `${String(p?.name || "").trim() || "Ein Kunde"}${erg.betreuer ? `, sein fester Betreuer ist ${erg.betreuer}` : ", noch ohne festen Betreuer"}.`;
    if (k?.code) erg.link = `https://fiaon.com/a/${String(k.code)}/w`;

    const UNFERTIG = ["started", "personal_data", "finances", "config", "verifying", "approved", "contract", "processing"];
    const abgeschickt = b && (Number(b.schritt) >= 8 || !UNFERTIG.includes(String(b.status || "")));
    const paket = b?.pack_name || b?.pack_key || null;
    if (!b) {
      // E-230: Fast jeder Meta-Lead hat eine Person. Ohne Antrag gilt dann die Lage des Leads —
      // die Begrüßung hat ihm gesagt, sein Antrag sei vorbereitet und seine Angaben stünden drin.
      const [l] = (await sqlPool`
        SELECT link_code, anzeige, quelle FROM fiaon_leads WHERE person_id = ${personId} ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
      if (l && l.quelle !== "whatsapp_eingang") {
        erg.lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.";
        if (!k?.code && l.link_code) erg.link = `https://fiaon.com/a/${String(l.link_code)}/w`;
      } else {
        erg.lage = "Hat noch keinen Antrag.";
      }
    } else if (b.gekuendigt_am || b.abo_gestoppt_am || ["cancelled", "refunded", "superseded"].includes(String(b.payment_status))) {
      erg.lage = `Vertrag ${b.gekuendigt_am ? "gekündigt" : "beendet oder storniert"}${paket ? ` (${paket})` : ""}.`;
      erg.ziel = "Kein Verkauf, keine Zahlung. Du beantwortest seine Frage; will er wieder einsteigen oder geht es um Geld, übergibst du.";
      erg.link = "https://fiaon.com/login";
    } else if (b.payment_status === "paid") {
      const kartenStand = karte?.gesendet_am
        ? `Der Link der Partnerbank für Konto und Karte ging am ${new Date(karte.gesendet_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} an ihn raus${karte.status ? ` (Stand: ${karte.status})` : ""}.`
        : "Ob der Link der Partnerbank schon raus ist, steht hier nicht — das sieht sein Betreuer nach.";
      const seit = b.created_at ? new Date(b.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : null;
      const neu = String(b.agb_stand || "") >= "2026-09-03";
      const vertrag = neu
        ? `Jahresvertrag${seit ? ` vom ${seit}` : ""}: zwölf Monate, Kündigung mit einem Monat Frist zum Ende, danach monatlich.`
        : `Vertrag${seit ? ` vom ${seit}` : ""} (vor dem 03.09.2026): monatlich zum Ende des laufenden Monats kündbar, formlos.`;
      erg.lage = `Kunde mit ${paket ?? "einem Paket"}, erste Zahlung gebucht, Account aktiv. ${vertrag} ${kartenStand}`;
      erg.ziel = "Es geht um Karte, Unterlagen und Startgespräch. Sein Bereich: fiaon.com/login.";
      erg.link = "https://fiaon.com/login";
      // Hat er zuletzt unsere Raten-Erinnerung bekommen: GENAU diese Rate (Referenz aus dem gesendeten Text),
      // nicht „die älteste offene" — sonst zeigte Mara nach der Zahlung auf die nächste, noch nicht fällige Rate.
      const ratenRef = letzteVorlage && /^fiaon_kkb?_rate$/.test(letzteVorlage.name)
        ? (String(letzteVorlage.text ?? "").match(/FIAON-?[A-Z0-9]{6}-\d{1,2}/i)?.[0] ?? null) : null;
      if (ratenRef) {
        const [r] = (await sqlPool`
          SELECT r.zahlungsreferenz, r.betrag_cents, r.status, r.faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date AS faellig
            FROM fiaon_abo_raten r WHERE UPPER(r.zahlungsreferenz) = ${ratenRef.toUpperCase()} ORDER BY r.id DESC LIMIT 1`.catch(() => [])) as any[];
        if (r?.status === "offen" && r.faellig) {
          erg.lage += ` Er hat unsere Erinnerung an seine Monatsrate über ${(Number(r.betrag_cents) / 100).toFixed(2).replace(".", ",")} € bekommen (Verwendungszweck ${r.zahlungsreferenz}).`;
          erg.ziel = "Du beantwortest seine Frage zur Rate sachlich und zeigst ihm seine Zahlungsseite. Ratenpause, Stundung, Kulanz oder Kündigung sagst du nie zu — das übergibst du. „Schon überwiesen“: danken, die Zahlungsstelle prüft den Eingang.";
          erg.link = `https://fiaon.com/zahlung/${String(r.zahlungsreferenz)}`;
        } else if (r?.status === "bezahlt") {
          erg.lage += ` Die Monatsrate aus unserer Erinnerung (${r.zahlungsreferenz}) ist inzwischen bezahlt — danke ihm dafür; es ist nichts weiter zu tun.`;
        }
      }
    } else if (b.payment_status === "claimed_paid") {
      erg.lage = `Antrag fertig (${paket ?? "Paket offen"}), er hat seine Zahlung gemeldet — die Buchung steht noch aus.`;
      erg.ziel = "Kein Wort vom Bezahlen. Danken, der Eingang wird geprüft, mit der Buchung ist der Account aktiv und der Link der Partnerbank geht von selbst raus.";
      erg.link = "https://fiaon.com/login";
    } else if (abgeschickt && b.payment_reference) {
      const cents = paketPreisCents(b.pack_key);
      erg.lage = `Antrag fertig und abgeschickt (${paket ?? "Paket offen"}), die erste Zahlung${cents ? ` über ${(cents / 100).toFixed(2).replace(".", ",")} €` : ""} ist noch offen.`;
      erg.ziel = "Er aktiviert seinen Account mit der ersten Zahlung. Der Link ist seine Zahlungsseite mit Betrag, Verwendungszweck und QR-Code.";
      erg.link = `https://fiaon.com/zahlung/${String(b.payment_reference)}`;
    } else {
      erg.lage = `Antrag angefangen, bei Schritt ${b.schritt ?? 0} stehen geblieben${paket ? ` (${paket})` : ""}. Seine Angaben sind gespeichert.`;
      erg.ziel = "Er macht seinen Antrag fertig — dort, wo er aufgehört hat.";
    }
  } else if (leadId) {
    const [l] = (await sqlPool`
      SELECT TRIM(COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) AS name, link_code, anzeige FROM fiaon_leads WHERE id = ${leadId}`.catch(() => [])) as any[];
    if (l) {
      erg.wer = `${String(l.name || "").trim() || "Ein Interessent"} — kam über eine Anzeige${l.anzeige ? ` (${l.anzeige})` : ""}, noch ohne festen Betreuer.`;
      erg.lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.";
      if (l.link_code) erg.link = `https://fiaon.com/a/${String(l.link_code)}/w`;
    }
  }
  return erg;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTWORTEN
// ═══════════════════════════════════════════════════════════════════════════
const inArbeit = new Set<string>();
/** Kostendeckel: eine Aufgabe je Nummer und Tag, nicht alle fünf Minuten eine neue. */
const deckelGemeldet = new Set<string>();

type Ergebnis = { gesendet: boolean; grund?: string };

/**
 * Antwortet auf ein offenes Gespräch. Läuft im Hintergrund, wirft nie — eine
 * misslungene Antwort darf den Empfang nicht stören. Die Antwort wird
 * vorbereitet und nach 6–18 Sekunden vom Versandtakt geschickt.
 */
export async function maraAntwortet(nummer: string): Promise<Ergebnis> {
  if (inArbeit.has(nummer)) return { gesendet: false, grund: "Mara denkt gerade schon über dieses Gespräch nach." };
  inArbeit.add(nummer);
  try {
    await gespraechSchema();
    if ((await einstellung("mara_wa_an", "an")) !== "an") return { gesendet: false, grund: "Mara ist auf WhatsApp abgeschaltet." };

    const verlauf = (await sqlPool`
      SELECT id, richtung, text, typ, vorlage, status, von, knopf, COALESCE(empfangen_am, gesendet_am, created_at) AS am, person_id, lead_id
        FROM fiaon_whatsapp WHERE nummer = ${nummer} AND status <> 'fehler' ORDER BY id DESC LIMIT 16`) as any[];
    // Fehlerzeilen bleiben draußen: Sie zählen nicht als Antwort und dürfen die Kundennachricht nicht aus dem Fenster drängen.
    if (!verlauf.length) return { gesendet: false, grund: "Kein Verlauf." };

    // OFFEN: neueste Kundennachricht nach der letzten freien Antwort (Vorlagen und Fehler zählen nicht).
    const neuesteRein = verlauf.find((v) => v.richtung === "rein");
    if (!neuesteRein) return { gesendet: false, grund: "Der Kunde hat nichts geschrieben." };
    const letzteAntwort = verlauf.find((v) => v.richtung === "raus" && !v.vorlage && v.status !== "fehler");
    if (letzteAntwort && Number(letzteAntwort.id) > Number(neuesteRein.id)) return { gesendet: false, grund: "Beantwortet." };

    const [g] = (await sqlPool`SELECT mara_an, mara_aus_grund, mara_aus_am, versand_aufgegeben_id FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => [])) as any[];
    // Nach dreimal gescheitertem Versand: erst eine NEUE Kundennachricht versucht es wieder (sonst KI-Kosten im Kreis).
    if (g?.versand_aufgegeben_id != null && Number(g.versand_aufgegeben_id) >= Number(neuesteRein.id)) {
      return { gesendet: false, grund: "Versand an diese Nummer scheiterte dreimal — ein Mensch ist informiert." };
    }
    // Die ERSTE Kundennachricht nach der letzten freien Antwort: ab ihr wartet der Kunde.
    const offeneRein = verlauf.filter((v) => v.richtung === "rein" && (!letzteAntwort || Number(v.id) > Number(letzteAntwort.id)));
    const ersteOffene = offeneRein[offeneRein.length - 1] ?? neuesteRein;
    if (g && g.mara_an === false) {
      if (g.mara_aus_grund === "schalter") return { gesendet: false, grund: "Mara ist in diesem Gespräch von Hand abgeschaltet." };
      if (g.mara_aus_grund === "deckel") {
        const heuteBerlin = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
        const amBerlin = g.mara_aus_am ? new Date(g.mara_aus_am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : "";
        if (amBerlin === heuteBerlin) return { gesendet: false, grund: "Zu viele Antworten an diese Nummer heute — ein Mensch ist informiert." };
      }
      // Ein Mensch führt — läuft ab: 15 Minuten ohne Antwort (ab der ersten offenen Nachricht), 20–8 Uhr
      // sofort, und spätestens zwei Stunden nach der Übernahme.
      const wartet = Date.now() - new Date(ersteOffene.am).getTime();
      const pauseAlt = g.mara_aus_am && Date.now() - new Date(g.mara_aus_am).getTime() > 2 * 60 * 60_000;
      if (g.mara_aus_grund !== "deckel" && !pauseAlt && !uebernahmeAbgelaufen(wartet, stundeBerlin())) {
        return { gesendet: false, grund: `Ein Mensch führt das Gespräch — Mara übernimmt in ${Math.ceil((UEBERNAHME_MS - wartet) / 60_000)} Min., falls niemand antwortet.` };
      }
      await sqlPool`
        UPDATE fiaon_whatsapp_gespraech SET mara_an = TRUE, mara_aus_grund = NULL, mara_aus_am = NULL, updated_at = NOW()
         WHERE nummer = ${nummer} AND COALESCE(mara_aus_grund, 'mensch') <> 'schalter'`;
      console.log(`[MARA-WA] ${nummer.slice(-4)}: Übernahme abgelaufen (Kunde wartet ${Math.round(wartet / 60_000)} Min.) — Mara antwortet.`);
    }

    if (!(await fensterOffen(nummer))) return { gesendet: false, grund: "Das Fenster ist zu." };

    const personId = verlauf.find((v) => v.person_id)?.person_id ?? null;
    const leadId = verlauf.find((v) => v.lead_id)?.lead_id ?? null;

    // STOPP: genau eine kurze Bestätigung, ohne Pitch — und nur, solange sie frisch ist.
    if (istStopp(neuesteRein.text, neuesteRein.knopf)) {
      if (Date.now() - new Date(neuesteRein.am).getTime() > 60 * 60_000) return { gesendet: false, grund: "STOPP — zu alt für eine Bestätigung." };
      await vorbereiten(nummer, STOPP_ANTWORT, Number(neuesteRein.id), String(neuesteRein.text ?? ""));
      return { gesendet: false, grund: "STOPP bestätigt (liegt bereit)." };
    }

    const lv = verlauf.find((v) => v.richtung === "raus" && v.vorlage);
    const letzteVorlage = lv ? { name: String(lv.vorlage), text: lv.text ?? null } : null;
    const lage = await lageFuer(personId ? Number(personId) : null, leadId ? Number(leadId) : null, letzteVorlage);

    const deckel = Number(await einstellung("mara_wa_tag_euro", "15")) || 15;
    const heute = await kostenHeute(DIENST_WA).catch(() => 0);
    if (heute >= deckel) {
      const schluessel = `${nummer}-${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })}`;
      if (!deckelGemeldet.has(schluessel)) {
        deckelGemeldet.add(schluessel);
        console.warn(`[MARA-WA] Kostendeckel erreicht (${heute.toFixed(2)} € von ${deckel} €) — ${nummer.slice(-4)} geht an einen Menschen.`);
        await aufgabeFuerMenschen(nummer, personId, leadId, "Mara hat heute ihren KI-Kostendeckel erreicht — bitte selbst antworten.", true);
      }
      return { gesendet: false, grund: `Kostendeckel erreicht (${heute.toFixed(2)} € von ${deckel} €) — Aufgabe an einen Menschen.` };
    }
    // Obergrenze je Gespräch: ein Autoresponder auf der Gegenseite darf kein Pingpong auslösen,
    // das das Tagesbudget aller Kunden aufbraucht. 6 Antworten in 30 Minuten, 30 am Tag.
    const [anzahl] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 minutes')::int AS halbe,
             COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS tag
        FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'raus' AND vorlage IS NULL AND status <> 'fehler' AND von ILIKE 'Mara%'`.catch(() => [{}])) as any[];
    if (Number(anzahl?.halbe || 0) >= 6 || Number(anzahl?.tag || 0) >= 30) {
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, mara_an, mara_aus_grund, mara_aus_am, updated_at) VALUES (${nummer}, FALSE, 'deckel', NOW(), NOW())
        ON CONFLICT (nummer) DO UPDATE SET mara_an = FALSE, mara_aus_grund = 'deckel', mara_aus_am = NOW(), updated_at = NOW()`;
      console.warn(`[MARA-WA] ${nummer.slice(-4)}: Obergrenze je Gespräch erreicht (${anzahl?.halbe}/30 Min., ${anzahl?.tag}/Tag) — pausiert bis morgen.`);
      await aufgabeFuerMenschen(nummer, personId, leadId, "Mara hat diesem Kontakt sehr viele Antworten in kurzer Zeit geschrieben (Autoresponder?) — sie pausiert hier bis morgen. Bitte ansehen.", true);
      return { gesendet: false, grund: "Obergrenze je Gespräch erreicht — pausiert, ein Mensch ist informiert." };
    }

    const namen = await agentNamen();
    const text = auftrag({
      name: namen.voll,
      wer: lage.wer, lage: lage.lage, ziel: lage.ziel, link: lage.link,
      gedaechtnis: personId ? await gedaechtnisText(Number(personId)).catch(() => "") : "",
      wissen: wissenFuerWhatsApp(),
      hausanweisung: await anweisungBlock("whatsapp").catch(() => ""),
      verlauf: verlauf.slice().reverse()
        .filter((v) => v.status !== "fehler")
        .map((v) => {
          const wer = v.richtung === "rein" ? "KUNDE" : v.vorlage ? "VORLAGE" : istMara(v.von) ? "DU" : "TEAM";
          const inhalt = String(v.text || (v.vorlage ? vorlagenKopf(String(v.vorlage)) : MEDIEN[String(v.typ)] ?? (v.typ && v.typ !== "text" ? `(${v.typ})` : ""))).replace(/\s+/g, " ").slice(0, 600);
          return `${wer}: ${inhalt}`;
        })
        .join("\n"),
    });

    const frage = String(neuesteRein.text ?? "");
    let roh = await denken(text, []);
    let antwort = String(roh?.antwort ?? "").trim();
    let funde = antwort ? sendePruefung(antwort) : ["Kein Text erzeugt."];
    // Zweiter Versuch: die Wand sagt, was nicht ging — Mara schreibt es neu.
    if (funde.length) {
      console.warn(`[MARA-WA] ${nummer.slice(-4)}: erster Entwurf zurückgehalten (${funde.join(" · ")}) — zweiter Versuch.`);
      roh = await denken(text, antwort ? [
        { role: "assistant", content: JSON.stringify({ antwort }) },
        { role: "user", content: `Diese Antwort darf so nicht raus: ${funde.join("; ")}. Schreib sie neu — gleicher Inhalt, ohne diese Wörter und Wendungen.` },
      ] : []);
      antwort = String(roh?.antwort ?? "").trim();
      funde = antwort ? sendePruefung(antwort) : ["Kein Text erzeugt."];
    }
    let mensch = roh?.mensch === true;
    let uebergabe = String(roh?.uebergabe ?? "").trim();
    // Rückfall: wahr, ohne Zusage, und ein Mensch übernimmt — Schweigen gibt es nicht.
    if (funde.length) {
      console.warn(`[MARA-WA] ${nummer.slice(-4)}: Rückfallsatz (${funde.join(" · ")}).`);
      antwort = rueckfallSatz(lage.betreuer);
      mensch = true;
      uebergabe = `Mara konnte nicht selbst antworten (${funde.join(" · ")}). Letzte Nachricht: „${frage.slice(0, 200)}"`;
    }

    // Zusagen („Ihr Betreuer ruft Sie an", „weitergeleitet", „vorgemerkt") müssen eingelöst werden:
    // Wer so etwas schreibt, übergibt — unabhängig davon, was das Modell im Feld mensch gesetzt hat.
    const zusagen = wandPruefen(antwort).filter((x) => x.art === "zusage").map((x) => x.treffer);
    if (zusagen.length || /betreuer.{0,40}(kümmert|meldet|ruft)|team.{0,40}(kümmert|meldet|ruft)/i.test(antwort)) {
      if (!mensch) uebergabe = uebergabe || `Mara hat zugesagt (${zusagen.join(", ") || "Rückmeldung"}) — bitte einlösen. Kunde: „${frage.slice(0, 200)}"`;
      mensch = true;
    }
    const offenerText = offeneRein.map((v) => String(v.text ?? "")).join(" ");
    const heikel = /kündig|widerruf|storn|erstatt|zurücküberweis|geld zurück|anwalt|verbraucherzentrale|betrug|abzocke|polizei/i.test(offenerText);
    if (heikel && !mensch) {
      mensch = true;
      uebergabe = uebergabe || `Heikles Anliegen (Kündigung/Widerruf/Erstattung/Beschwerde): „${offenerText.slice(0, 240)}"`;
    }

    await vorbereiten(nummer, antwort, Number(neuesteRein.id), frage);

    if (personId && String(roh?.gemerkt ?? "").trim()) {
      await gedaechtnisMerken(Number(personId), [String(roh.gemerkt).trim()], "whatsapp").catch(() => {});
    }
    if (mensch) {
      await aufgabeFuerMenschen(nummer, personId, leadId, uebergabe || "Der Mensch möchte mit jemandem aus dem Team sprechen (WhatsApp).", funde.length > 0 || heikel || /anruf|rückruf|beschwer|kündig|widerruf|betrug|anwalt/i.test(uebergabe));
    }
    return { gesendet: false, grund: "Antwort liegt bereit." };
  } catch (e) {
    console.error("[MARA-WA]", e);
    return { gesendet: false, grund: String(e).slice(0, 200) };
  } finally {
    inArbeit.delete(nummer);
  }
}

/**
 * Das Hauswissen, zugeschnitten auf WhatsApp. Drei Zeilen aus wissenFakten()
 * dürfen hier nicht wirken: der Gerichtsabsatz (WhatsApp verbietet
 * Forderungseinzug), der Kulanzsatz (AGB § 6 Abs. 4: kein Anspruch) und der
 * Erstattungssatz beim Widerruf (widerspricht der Widerrufsbelehrung).
 */
export function wissenFuerWhatsApp(): string {
  return wissenFakten()
    .split("\n")
    .filter((z) => !/^- Bleibt eine offene Rate trotz Aufforderung unbezahlt/.test(z))
    .map((z) => /^- Verträge ab dem 03\.09\.2026 laufen über zwölf Monatsraten/.test(z)
      ? "- Verträge ab dem 03.09.2026: zwölf Monate, zwölf zinsfreie Monatsraten; Kündigung mit einem Monat Frist zum Ende der zwölf Monate, sonst läuft der Vertrag weiter und ist dann jederzeit mit einem Monat Frist kündbar (AGB § 6). Eine vorzeitige Aufhebung ist kein Anspruch — darüber entscheidet ein Mensch."
      : /^- Widerruf: 14 Tage ab Vertragsschluss/.test(z)
        ? "- Widerruf: 14 Tage ab Vertragsschluss (gesetzliches Widerrufsrecht). Zu Erstattungen äußerst du dich nie — ein Widerruf geht immer an einen Menschen."
        : z)
    .join("\n");
}

/** Die Überschrift einer Vorlage — damit der Verlauf lesbar bleibt, wenn der Text fehlt. */
function vorlagenKopf(name: string): string {
  const v = WA_VORLAGEN.find((x) => x.name === name);
  return v ? `(Vorlage „${v.kopf || name}")` : `(Vorlage ${name})`;
}

/** Ein KI-Aufruf; bei einem Fehler genau ein zweiter Versuch. */
async function denken(system: string, nachtrag: { role: "assistant" | "user"; content: string }[]): Promise<any> {
  const nachrichten = [
    { role: "system", content: system },
    { role: "user", content: "Antworte jetzt auf seine letzte Nachricht — und auf alles davor, was noch offen ist." },
    ...nachtrag,
  ];
  for (let versuch = 1; versuch <= 2; versuch++) {
    try {
      const j = await kiAufruf({ dienst: DIENST_WA, modell: MODELL(), aufwand: "low", maxTokens: 2500, schema: SCHEMA, nachrichten: nachrichten as any });
      void kostenCentsAus(MODELL(), j?.usage);
      return antwortLesen(j, "Mara-WhatsApp");
    } catch (e) {
      console.warn(`[MARA-WA] KI-Aufruf ${versuch} gescheitert:`, String((e as Error)?.message || e).slice(0, 160));
    }
  }
  return null;
}

/**
 * SIE ANTWORTET NICHT IN EINER SEKUNDE (E-224): Die Antwort wird vorbereitet
 * und nach 6–18 Sekunden fällig — lesen, denken, tippen. Kommt bis dahin eine
 * neue Nachricht, denkt sie neu (versandLauf).
 */
async function vorbereiten(nummer: string, antwort: string, aufId: number, frage: string): Promise<void> {
  const faellig = new Date(Date.now() + verzoegerungMs(antwort, frage));
  await sqlPool`
    INSERT INTO fiaon_whatsapp_gespraech (nummer, antwort_text, antwort_faellig_am, antwort_auf_id, updated_at)
    VALUES (${nummer}, ${antwort}, ${faellig}, ${aufId}, NOW())
    ON CONFLICT (nummer) DO UPDATE SET
      antwort_text = ${antwort}, antwort_faellig_am = ${faellig}, antwort_auf_id = ${aufId}, updated_at = NOW()`;
  weckerStellen(faellig.getTime() - Date.now());
}

/** Ein Mensch muss übernehmen — als Aufgabe beim Betreuer (oder beim Team, wenn es keinen gibt). */
async function aufgabeFuerMenschen(nummer: string, personId: number | null, leadId: number | null, grund: string, dringend = false): Promise<void> {
  const tag = new Date().toISOString().slice(0, 10);
  if (personId) {
    const { waAktenvermerk } = await import("./fiaon-whatsapp");
    await waAktenvermerk(personId, `WhatsApp (+${nummer}): ${grund}`);
  }
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: personId ?? null, ref: null,
    titel: dringend ? "WhatsApp: bitte jetzt übernehmen" : "WhatsApp: bitte übernehmen",
    text: `${grund}${personId ? "" : ` · Nummer +${nummer}${leadId ? ` · Lead ${leadId}` : ""}`}`,
    quelle: "mara-whatsapp", dringend,
    link: "/chef/s/whatsapp",
    // Eine Aufgabe je Mensch (oder Nummer) und Tag — nicht je Nachricht.
    schluessel: personId ? `wa-${personId}-${tag}` : `wa-n${nummer}-${tag}`,
  }).catch((e) => console.error("[MARA-WA] Aufgabe:", e));
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS TEMPO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wie lange ein Mensch für diese Antwort bräuchte: lesen, denken, tippen —
 * 6 bis 18 Sekunden (E-224), mit Streuung, nie zweimal dieselbe Zahl.
 */
export function verzoegerungMs(antwort: string, frage: string): number {
  const lesen = Math.min(2500, String(frage).length * 18);
  const denkpause = 2000 + Math.random() * 2500;
  const tippen = Math.min(9000, (String(antwort).length / 28) * 1000);
  const streuung = 0.85 + Math.random() * 0.3;
  return Math.round(Math.min(18_000, Math.max(6000, (lesen + denkpause + tippen) * streuung)));
}

let versandLaeuft = false;

/** Genau dann senden, wenn es so weit ist (E-224) — der Takt bleibt als Netz. */
function weckerStellen(ms: number): void {
  setTimeout(() => { void versandLauf().catch((e) => console.error("[MARA-WA] Wecker:", e)); }, Math.max(500, ms + 300));
}

/**
 * Schickt die fälligen Antworten (Takt alle 20 Sekunden + Wecker) und prüft
 * vorher, was sich in der Wartezeit geändert haben kann: eine neue
 * Kundennachricht (→ neu denken), eine Antwort aus dem Team (→ verwerfen),
 * Schalter von Hand aus, Fenster zu.
 */
export async function versandLauf(): Promise<{ gesendet: number; verworfen: number }> {
  if (versandLaeuft) return { gesendet: 0, verworfen: 0 };
  versandLaeuft = true;
  let gesendet = 0, verworfen = 0;
  try {
    await gespraechSchema();
    const faellig = (await sqlPool`
      SELECT nummer, antwort_text, antwort_auf_id, mara_an, mara_aus_grund, COALESCE(antwort_versuche, 0) AS versuche FROM fiaon_whatsapp_gespraech
       WHERE antwort_text IS NOT NULL AND antwort_faellig_am IS NOT NULL AND antwort_faellig_am <= NOW()
       LIMIT 25`.catch(() => [])) as any[];
    for (const g of faellig) {
      const nummer = String(g.nummer);
      const aufId = g.antwort_auf_id != null ? Number(g.antwort_auf_id) : null;
      // Nur leeren, was wir gelesen haben — eine inzwischen neu vorbereitete Antwort bleibt.
      const leeren = async () => {
        await sqlPool`
          UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL, antwort_auf_id = NULL
           WHERE nummer = ${nummer} AND antwort_auf_id IS NOT DISTINCT FROM ${aufId}`;
      };
      if (g.mara_an === false && g.mara_aus_grund === "schalter") { await leeren(); verworfen++; continue; }
      const [neuesteRein] = (await sqlPool`
        SELECT id FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'rein' ORDER BY id DESC LIMIT 1`) as any[];
      // Neue Kundennachricht inzwischen? Dann neu denken — sofort, ohne die Uhr zurückzudrehen.
      if (!neuesteRein || Number(neuesteRein.id) !== aufId) {
        await leeren();
        verworfen++;
        void maraAntwortet(nummer).catch(() => {});
        continue;
      }
      // Hat inzwischen jemand aus dem Team frei geantwortet? Dann nicht doppelt.
      const [schonBeantwortet] = (await sqlPool`
        SELECT 1 FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'raus' AND vorlage IS NULL AND status <> 'fehler' AND id > ${aufId} LIMIT 1`) as any[];
      if (schonBeantwortet) { await leeren(); verworfen++; continue; }
      if (!(await fensterOffen(nummer))) { await leeren(); verworfen++; continue; }
      const [w] = (await sqlPool`SELECT person_id, lead_id FROM fiaon_whatsapp WHERE nummer = ${nummer} AND (person_id IS NOT NULL OR lead_id IS NOT NULL) ORDER BY id DESC LIMIT 1`) as any[];
      const namen = await agentNamen();
      const erg = await waSenden(nummer, { text: String(g.antwort_text) }, { personId: w?.person_id ?? null, leadId: w?.lead_id ?? null, von: namen.voll });
      if (erg.ok) {
        await leeren();
        await sqlPool`UPDATE fiaon_whatsapp_gespraech SET antwort_versuche = 0 WHERE nummer = ${nummer}`;
        gesendet++;
      } else if (Number(g.versuche) + 1 < 3) {
        // Die fertige Antwort bleibt — nur der Versand wird in 5 Minuten wiederholt, ohne neu zu denken.
        await sqlPool`
          UPDATE fiaon_whatsapp_gespraech SET antwort_versuche = COALESCE(antwort_versuche, 0) + 1, antwort_faellig_am = NOW() + INTERVAL '5 minutes'
           WHERE nummer = ${nummer} AND antwort_auf_id IS NOT DISTINCT FROM ${aufId}`;
        console.warn(`[MARA-WA] ${nummer}: Versand gescheitert (${erg.grund}) — neuer Versuch in 5 Minuten.`);
      } else {
        await leeren();
        await sqlPool`UPDATE fiaon_whatsapp_gespraech SET antwort_versuche = 0, versand_aufgegeben_id = ${aufId} WHERE nummer = ${nummer}`;
        console.warn(`[MARA-WA] ${nummer}: Versand dreimal gescheitert (${erg.grund}) — aufgegeben, Aufgabe an einen Menschen.`);
        await aufgabeFuerMenschen(nummer, w?.person_id ?? null, w?.lead_id ?? null, `Maras Antwort ging dreimal nicht raus (${String(erg.grund ?? "").slice(0, 200)}). Bitte selbst antworten.`, true);
      }
    }
  } catch (e) {
    console.error("[MARA-WA] Versandtakt:", e);
  } finally {
    versandLaeuft = false;
  }
  return { gesendet, verworfen };
}

// ═══════════════════════════════════════════════════════════════════════════
// NIEMAND BLEIBT UNBEANTWORTET (E-230)
//
// Jede Minute: jedes Gespräch der letzten 23,5 Stunden, dessen neueste
// Kundennachricht nach der letzten freien Antwort kam, älter als 90 Sekunden,
// ohne vorbereitete Antwort und nicht von Hand abgeschaltet → Mara denkt.
// Höchstens ein Versuch je Nachricht alle fünf Minuten. Nachts (22–7 Uhr) nur
// Frisches (< 30 Minuten), Älteres ab 7 Uhr. „STOPP" wird nicht nachgeholt.
// ═══════════════════════════════════════════════════════════════════════════
const versucht = new Map<string, { id: number; am: number }>();

export const OFFENE_GESPRAECHE_SQL = `
  SELECT r.nummer, r.id, r.text, r.knopf, r.am, g.mara_an, g.mara_aus_grund
    FROM (
      SELECT DISTINCT ON (nummer) nummer, id, text, knopf, COALESCE(empfangen_am, created_at) AS am
        FROM fiaon_whatsapp
       WHERE richtung = 'rein' AND created_at > NOW() - INTERVAL '23 hours 30 minutes'
       ORDER BY nummer, id DESC
    ) r
    LEFT JOIN fiaon_whatsapp_gespraech g ON g.nummer = r.nummer
   WHERE NOT EXISTS (
           SELECT 1 FROM fiaon_whatsapp o
            WHERE o.nummer = r.nummer AND o.richtung = 'raus' AND o.vorlage IS NULL AND o.status <> 'fehler' AND o.id > r.id)
     AND g.antwort_text IS NULL
     AND COALESCE(g.mara_aus_grund, '') <> 'schalter'
     AND (g.versand_aufgegeben_id IS NULL OR g.versand_aufgegeben_id < r.id)`;

export async function nachholLauf(): Promise<{ angestossen: number }> {
  let angestossen = 0;
  await gespraechSchema();
  const stunde = stundeBerlin();
  const nacht = stunde >= 22 || stunde < 7;
  // Kostendeckel erreicht? Dann gar nicht erst anstoßen — die Aufgaben sind schon angelegt.
  const deckel = Number(await einstellung("mara_wa_tag_euro", "15")) || 15;
  if ((await kostenHeute(DIENST_WA).catch(() => 0)) >= deckel) return { angestossen: 0 };
  const offen = (await sqlPool.unsafe(`${OFFENE_GESPRAECHE_SQL} AND r.am < NOW() - INTERVAL '90 seconds' ORDER BY r.am LIMIT 20`)
    .catch((e) => { console.error("[MARA-WA] Nachholen:", e); return []; })) as any[];
  for (const o of offen) {
    const nummer = String(o.nummer);
    const alt = Date.now() - new Date(o.am).getTime();
    if (nacht && alt > 30 * 60_000) continue;
    if (istStopp(o.text, o.knopf)) continue;
    const v = versucht.get(nummer);
    if (v && v.id === Number(o.id) && Date.now() - v.am < 5 * 60_000) continue;
    versucht.set(nummer, { id: Number(o.id), am: Date.now() });
    angestossen++;
    const r = await maraAntwortet(nummer).catch((e) => ({ gesendet: false, grund: String(e) }));
    console.log(`[MARA-WA] Nachgeholt ${nummer.slice(-4)}: ${r.grund ?? (r.gesendet ? "gesendet" : "—")}`);
  }
  return { angestossen };
}
