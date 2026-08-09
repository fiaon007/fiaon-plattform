// ═══════════════════════════════════════════════════════════════════════════
// TELEFON-RICHTLINIE — die Zusage vor dem ersten Anruf
//
// ── WARUM DAS NICHT NUR EINE INFO-TAFEL IST ────────────────────────────────
// Ein Softphone in fremden Händen ist zweierlei: eine Kreditkarte und ein
// Aufnahmegerät. Das Zweite ist das gefährlichere. Wer ein Gespräch
// aufzeichnet, ohne den anderen zu informieren, verletzt in Deutschland und
// Österreich die Vertraulichkeit des Wortes — § 201 StGB, bis zu drei Jahre
// Freiheitsstrafe. Das trifft die Person, die aufzeichnet, persönlich.
//
// Deshalb ist die Richtlinie eine ZUSAGE mit Nachweis: Sie wird angenommen,
// die Annahme wird mit Zeitpunkt, Fassung, IP und Browserkennung
// festgehalten, und ohne sie ist das Wählen serverseitig gesperrt.
//
// ── WAS SIE NICHT IST ──────────────────────────────────────────────────────
// Sie ist kein Rechtsgutachten. Der Wortlaut ist so gebaut, dass er die
// Pflichten benennt, die aus § 201 StGB und der DSGVO folgen — die
// abschließende Prüfung gehört zur Rechtsberatung. Das steht als Fußnote
// darunter, damit niemand mehr Sicherheit annimmt, als da ist.
// ═══════════════════════════════════════════════════════════════════════════

import type { ZusageText } from "./fiaon-vertrieb-zusage";

export const TELEFON_ZUSAGE_VERSION = "1.0-2026-08-11";

/**
 * Der Satz, den das Team am Gesprächsbeginn sagt.
 *
 * Er steht in den Einstellungen und ist änderbar — aber er ist NICHT leer
 * lassbar: Die automatische Twilio-Ansage allein reicht nicht, wenn der
 * Angerufene sie überhört oder das Gespräch schon läuft.
 */
export const HINWEIS_VORGABE =
  "Hinweis: Dieses Gespräch wird zur Qualitätssicherung aufgezeichnet — "
  + "sind Sie damit einverstanden?";

export const TELEFON_ZUSAGE_TEXT: ZusageText = {
  version: TELEFON_ZUSAGE_VERSION,
  ueberschrift: "Telefon-Richtlinie",
  gratulation: "Du kannst jetzt über FIAON telefonieren.",
  einleitung:
    "Bevor du zum ersten Mal wählst, lies das hier einmal in Ruhe. Es sind vier "
    + "Absätze, und sie betreffen dich persönlich — nicht die Firma. Ein Gespräch "
    + "aufzuzeichnen, ohne den anderen zu informieren, ist in Deutschland und "
    + "Österreich strafbar. Wenn du die Richtlinie annimmst, weiß FIAON, dass du "
    + "das gelesen hast, und du weißt, worauf du achten musst.",

  kann: [
    {
      titel: "Aus dem Browser anrufen",
      text: "Kein Handy, keine eigene Nummer. Du wählst aus der Kundenkarte, und beim "
        + "Kunden erscheint die FIAON-Nummer. Deine private Nummer sieht niemand.",
    },
    {
      titel: "Das Gespräch wird mitgeschrieben",
      text: "Aufnahme, Transkript und eine kurze Zusammenfassung landen in der Akte. "
        + "Du musst nach dem Auflegen nichts tippen — nur das Ergebnis wählen.",
    },
    {
      titel: "Ohne Aufzeichnung weitersprechen",
      text: "Widerspricht der Kunde, drückst du im Panel „Ohne Aufzeichnung fortsetzen“. "
        + "Die Aufnahme stoppt sofort, das Gespräch läuft weiter, und am Anruf steht, "
        + "dass es so war.",
    },
  ],

  kannNicht: [
    "Keine Kaltakquise. Du rufst ausschließlich Menschen an, die im System stehen und "
      + "deren Kontakt geschäftlich veranlasst ist — weil sie einen Antrag gestellt, "
      + "einen Rückruf erbeten oder gezahlt haben.",
    "Keine privaten Anrufe über FIAON-Nummern. Auch nicht kurz, auch nicht einmal.",
    "Keine Nummern außerhalb von Deutschland, Österreich und der Schweiz.",
    "Keine Aufzeichnung ohne Hinweis. Nie.",
    "Kein Weitergeben von Aufnahmen oder Transkripten. Sie bleiben im System.",
  ],

  pflichten: [
    {
      nr: 1,
      titel: "Du sagst den Hinweis, bevor es zur Sache geht",
      text: "Zu Beginn jedes Gesprächs: „Dieses Gespräch wird zur Qualitätssicherung "
        + "aufgezeichnet — sind Sie damit einverstanden?“ Der Satz steht im Panel über "
        + "der Tastatur, damit du ihn nicht suchen musst. FIAON spielt zusätzlich eine "
        + "automatische Ansage ein; sie ersetzt deinen Satz NICHT. Zwei Wege sind hier "
        + "besser als einer, weil eine überhörte Ansage niemandem hilft.",
    },
    {
      nr: 2,
      titel: "Widerspruch beendet die Aufzeichnung — sofort",
      text: "Sagt der Kunde Nein oder zögert er, drückst du „Ohne Aufzeichnung "
        + "fortsetzen“. Kein Nachfragen, kein Überreden. Das Gespräch darfst du "
        + "weiterführen, die Aufnahme nicht.",
    },
    {
      nr: 3,
      titel: "Du kennst die Rechtsgrundlage",
      text: "Die Vertraulichkeit des gesprochenen Wortes ist in § 201 StGB geschützt: "
        + "Wer das nichtöffentlich gesprochene Wort eines anderen unbefugt auf einen "
        + "Tonträger aufnimmt, macht sich strafbar. „Unbefugt“ entfällt, wenn alle "
        + "Beteiligten Kenntnis haben und einverstanden sind — genau darum geht es bei "
        + "dem Satz aus Punkt 1. Dazu kommt die Informationspflicht der DSGVO "
        + "(Art. 13): Der Kunde muss wissen, dass aufgezeichnet wird und warum.",
    },
    {
      nr: 4,
      titel: "Du rufst nur an, wer im System steht",
      text: "Die Nummer kommt aus der Kundenkarte, nicht aus einer Liste, einem Chat "
        + "oder deinem Gedächtnis. Wenn du eine Nummer von Hand eintippst, muss sie zu "
        + "einem Menschen gehören, der in FIAON steht und mit dem der Kontakt "
        + "geschäftlich veranlasst ist.",
    },
    {
      nr: 5,
      titel: "Du behandelst Aufnahmen wie Kundenakten",
      text: "Nicht herunterladen, nicht weiterschicken, nicht in einen Chat kopieren. "
        + "Sie stehen in der Akte, und dort bleiben sie. Aufnahmen werden nach der in "
        + "den Einstellungen hinterlegten Frist automatisch gelöscht.",
    },
    {
      nr: 6,
      titel: "Ein Verstoß ist ein Melde- und Disziplinarfall",
      text: "Wer ohne Hinweis aufzeichnet, privat telefoniert oder Aufnahmen "
        + "weitergibt, muss damit rechnen, dass der Telefonzugang entzogen wird — und "
        + "im Fall von § 201 StGB, dass es nicht bei einer internen Sache bleibt. Jede "
        + "Wahl wird protokolliert, auch die abgelehnte.",
    },
  ],

  schlusssatz:
    "Wenn du das annimmst, wird das Telefon freigeschaltet. Deine Annahme wird mit "
    + "Zeitpunkt, Fassung und Gerätekennung festgehalten — so wie bei der "
    + "Verpflichtungserklärung.",

  hinweisProtokoll:
    "Fassung 1.0 — zur Prüfung durch die Rechtsberatung freigegeben. Der Wortlaut "
    + "benennt die Pflichten, die aus § 201 StGB und Art. 13 DSGVO folgen; die "
    + "abschließende juristische Bewertung steht noch aus.",
};


/**
 * Darf dieser Mensch wählen — hat er die Richtlinie angenommen?
 *
 * ── WARUM DAS EINE EIGENE FUNKTION IST ─────────────────────────────────────
 * Die Prüfung sitzt in der Token-Route, HINTER der Einrichtungsprüfung. Das
 * ist inhaltlich richtig (wer nicht telefonieren kann, braucht keine
 * Richtlinie), macht die Wand aber gegen einen Server ohne Twilio-Werte
 * unprüfbar: Der Aufruf endet mit HTTP 503, bevor die Richtlinie an die Reihe
 * kommt. Genau so ist es mir beim ersten Prüfversuch ergangen.
 *
 * Als eigene Funktion lässt sie sich direkt messen — ohne Twilio, ohne
 * Browser, ohne echten Anruf.
 */
export async function darfWaehlen(agentId: number): Promise<{
  erlaubt: boolean; neufassung: boolean; grund: string | null;
}> {
  const { zusageStand } = await import("./fiaon-vertrieb-zusage");
  const stand = await zusageStand(agentId, "telefon", TELEFON_ZUSAGE_VERSION);
  if (!stand.offen) return { erlaubt: true, neufassung: false, grund: null };
  return {
    erlaubt: false,
    neufassung: stand.neufassung,
    grund: stand.neufassung
      ? "Die Telefon-Richtlinie liegt in einer neuen Fassung vor. Bitte einmal lesen und annehmen."
      : "Bevor du zum ersten Mal wählst, musst du die Telefon-Richtlinie annehmen.",
  };
}
