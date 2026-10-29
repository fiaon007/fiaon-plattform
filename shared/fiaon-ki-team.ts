// ═══════════════════════════════════════════════════════════════════════════
// DAS KI-TEAM (E-409, 19.10.2026) — Dienste, Ampel, Oberflächen-Formen
//
// Justin: „ein eigener Bereich (wie ein ‚Labs‘, einfach geil gemacht) für ALLE
// KI-Mitarbeiter — Mara und ARAS — in dem wir ins Detail steuern können, mit
// allen Sachen, die auch wirklich funktionieren.“
//
// Diese Datei ist REIN (keine Datenbank, kein Netz): die Liste der KI-Dienste
// (so heißen sie in fiaon_ki_nutzung), die EINE Werkzeug-Ampel für Mara und die
// JSON-Formen, die der Raum /chef/ki von den Routen bekommt (SCHNITTSTELLE § 5).
// Die ARAS-Formen sind die des Vertrags — strukturgleich zu dem, was Team 1 in
// shared/fiaon-aras.ts baut. Solange ARAS nicht angebunden ist (Anbindung in
// server/lib/fiaon-ki-aras-anbindung.ts), zeigt der Raum den Leerzustand
// „Aras ist noch nicht verbunden“.
//
// E-409 × E-406 (Integration, 20.10.2026): Es gibt EINE Ampel — diese Liste,
// ein Speicher-Schlüssel (fiaon_settings.mara_ampel), bedient nur in
// KI-Team › Werkzeuge. Die Namen sind die ECHTEN Werkzeugnamen aus dem Code
// (WhatsApp: werkzeugAusfuehren, Postfach: fiaon-postmeister-werkzeuge.ts,
// Aufträge: fiaon-mara-auftrag.ts) und die echten Namen der Server-Schritte
// (antwort_senden, vereinbarten_termin_eintragen, angaben_aendern, zahlung_suchen).
// Die zweite Ampel aus E-406 B3 (eigene Namen wie termin_eintragen) gibt es
// nicht mehr — und auch keine Stichprobe durch Mitarbeiter: die Qualität prüft
// Prüf-Mara automatisch (Justin 19.10.: „warum Diana? … Die ist ja gar nicht Thema“).
// ═══════════════════════════════════════════════════════════════════════════

/** Die drei Stufen: grün = macht es allein · gelb = macht es, steht in „Heute“ · rot = macht es nicht selbst (Zeile sagt, was dann passiert). */
export type AmpelStufe = "gruen" | "gelb" | "rot";
export const AMPEL_STUFEN: readonly AmpelStufe[] = ["gruen", "gelb", "rot"];
export const AMPEL_TEXT: Record<AmpelStufe, string> = { gruen: "macht es allein", gelb: "macht es — steht in „Heute“", rot: "macht es nicht selbst" };

export interface AmpelWerkzeug {
  key: string;
  label: string;
  /** Ein Satz: was das Werkzeug tut. ≤ 80 Zeichen. */
  satz: string;
  /** Welche Stufen der Server wirklich durchsetzt — nur die werden angeboten. */
  stufen: AmpelStufe[];
  vorgabe: AmpelStufe;
  /** Fest = nicht umschaltbar (Geld, Erstattung, Pflicht nach UWG/BGB). Die Garantie setzt der Code selbst durch. */
  fest?: boolean;
  /** Wo es wirkt: WhatsApp, Postfach, Aufträge (Mara anweisen) oder überall. */
  kanal: "whatsapp" | "mail" | "auftrag" | "alle";
  /** Was Rot hier WIRKLICH tut — ehrlich (Karte an dich oder Mara lässt es weg). */
  rot?: string;
  /** Rot führt zu einer echten Karte an Justin (Vorgabe) — oder Mara lässt das Werkzeug weg (kein Kartenberg). */
  rotWeg?: "karte" | "weglassen";
  /** Was Gelb hier mehr tut als „steht in Heute“ (z. B. 24 h rückgängig). */
  gelb?: string;
  /** Ein Satz, warum es fest ist oder eine Stufe fehlt. */
  hinweis?: string;
}

const KARTE_WA = "Mara tut es nicht — der Wunsch kommt als Karte an dich.";
const KARTE_MAIL = "Mara tut es nicht — ihre Antwort kommt als Karte an dich.";
const AUFTRAG_ROT = "Der Schritt läuft nicht — du siehst es sofort im Auftrag.";

/**
 * MARAS WERKZEUG-AMPEL — die EINE Liste. Jede umschaltbare Zeile hat einen Code-Pfad, der die Stufe liest
 * (server/lib/fiaon-ki-ampel.ts): WhatsApp werkzeugAusfuehren, Postfach-Werkzeugrufe, Aufträge, und die
 * Server-Schritte (Senden im Postfach, genannter Termin, Angaben). Gelb = läuft und steht danach in „Heute“
 * (nur, wenn es wirklich lief). Rot = Mara tut es nicht; was dann passiert, steht in `rot`. Feste Zeilen sind
 * Garantien, die der Code ohnehin durchsetzt. Eine Ampel macht nichts freier, als der Code es heute ist.
 */
export const MARA_AMPEL: readonly AmpelWerkzeug[] = [
  // ── WhatsApp (fiaon-whatsapp-mara.ts werkzeugAusfuehren) ─────────────────
  { key: "freie_zeiten", label: "Freie Zeiten holen", satz: "Liest freie Termine des Betreuers für ein Zeitangebot.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "whatsapp", hinweis: "Liest nur." },
  { key: "zahlungszusage_merken", label: "Zahlungszusage merken", satz: "Trägt „zahlt am …“ in die Akte, mit Wiedervorlage.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp", rot: KARTE_WA, rotWeg: "karte" },
  { key: "terminlink_schicken", label: "Terminlink schicken", satz: "Schickt den Buchungslink, wenn keine Zeit passt.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp", rot: KARTE_WA, rotWeg: "karte" },
  { key: "kuendigung_aufnehmen", label: "Kündigung aufnehmen", satz: "Nimmt eine klare Kündigung auf — Bestätigung folgt.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "whatsapp", hinweis: "Eine Kündigung nimmt Mara immer an (§ 312k BGB) — nie umschaltbar." },
  { key: "karte_link_schicken", label: "Kartenlink schicken", satz: "Schickt dem bezahlten Kunden den Link zur Partnerbank.", stufen: ["gruen", "gelb"], vorgabe: "gruen", kanal: "whatsapp", hinweis: "Kein Rot: Der Link ist Vertragsleistung (E-365)." },
  { key: "ratenpause_setzen", label: "Ratenpause setzen", satz: "Verschiebt offene Raten einmal um einen Monat (Regeln der Akte).", stufen: ["gruen", "gelb", "rot"], vorgabe: "gelb", kanal: "whatsapp", gelb: "Steht in „Heute“ — dem Kunden ist die Pause schon zugesagt.", rot: "Keine Pause — die Bitte kommt als Karte „Pause setzen“ an dich.", rotWeg: "karte" },
  { key: "angaben_eintragen", label: "Antragsangaben eintragen", satz: "Trägt fehlende Angaben ein (E-Mail, Anschrift, Geburtsdatum).", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp", rot: KARTE_WA, rotWeg: "karte" },
  // ── Überall (WhatsApp und Mail) ──────────────────────────────────────────
  { key: "rueckruf_eintragen", label: "Rückruf eintragen", satz: "Bucht den Rückruf in die Arbeitszeit des Betreuers (WhatsApp, Mail).", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle", gelb: "Steht in „Heute“ — 24 h „Termin absagen“.", rot: "Kein Termin: auf WhatsApp eine Karte an dich, per Mail macht der Betreuer die Zeit fest.", rotWeg: "karte" },
  { key: "vereinbarten_termin_eintragen", label: "Genannten Termin eintragen", satz: "Trägt einen Termin ein, den der Kunde mit uns vereinbart hat.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle", gelb: "Steht in „Heute“ — 24 h „Termin absagen“.", rot: "Mara trägt nichts ein — Karte „Termin eintragen?“ an dich.", rotWeg: "karte" },
  { key: "angaben_aendern", label: "Anschrift, E-Mail, Telefon ändern", satz: "Ändert Angaben auf Wunsch — nur vom hinterlegten Absender.", stufen: ["gruen", "gelb"], vorgabe: "gruen", kanal: "alle", gelb: "Steht in „Heute“ — 24 h „Zurück auf alt“ (Anschrift, Telefon).", hinweis: "Rot gibt es hier noch nicht: Dafür fehlt die Karte „Übernehmen“." },
  { key: "auskunft_anbieten", label: "Auskunft anbieten", satz: "Bietet die Bonitätsauskunft an (nur erlaubte Lagen).", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle", rot: "Mara bietet die Auskunft nicht an — keine Karte nötig.", rotWeg: "weglassen" },
  { key: "zahlung_suchen", label: "Zahlung im Bankbuch suchen", satz: "Bei „habe bezahlt“: sieht im Bankbuch nach — liest nur.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle", hinweis: "Gebucht wird immer erst mit deinem Klick (Karte „Geld eingegangen“)." },
  // ── Postfach (fiaon-postmeister-lauf.ts / -werkzeuge.ts) ─────────────────
  { key: "antwort_senden", label: "Mails beantworten", satz: "Sendet Maras fertige Antwort im Postfach selbst.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail", gelb: "Wartet 24 h als Entwurf („Nicht senden“ in „Heute“), dann sendet Mara; sonst Karte.", rot: "Jede Antwort wird eine Karte „Maras Antwort senden?“ an dich.", rotWeg: "karte" },
  { key: "notiz_an_betreuer", label: "Notiz an Betreuer", satz: "Schreibt den Vermerk in die Akte.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "mail", hinweis: "Nur ein Vermerk — nichts geht an den Kunden." },
  { key: "aufgabe_an_betreuer", label: "Aufgabe an Betreuer", satz: "Legt eine Aufgabe an, wenn ein Mensch ran muss.", stufen: ["gruen", "gelb"], vorgabe: "gruen", kanal: "mail", hinweis: "Kein Rot: Eine Übergabe an einen Menschen darf nie hängen bleiben." },
  { key: "rechnung_anhaengen", label: "Rechnung anhängen", satz: "Hängt die Rechnung an, wenn er sie verlangt.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail", rot: KARTE_MAIL, rotWeg: "karte" },
  { key: "kuendigung_vormerken", label: "Kündigung vormerken", satz: "Merkt eine Kündigung aus der Mail vor — Bestätigung folgt.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "mail", hinweis: "Eine Kündigung nimmt Mara immer an (§ 312k BGB) — nie umschaltbar." },
  { key: "werbesperre_setzen", label: "Werbesperre setzen", satz: "„Keine Werbung mehr“ — sofort, dauerhaft.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "mail", hinweis: "Der Wunsch des Kunden gilt sofort (§ 7 UWG)." },
  { key: "mahnstopp_setzen", label: "Mahnstopp setzen", satz: "Hält die Mahnkette an, wenn er bestreitet.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail", rot: KARTE_MAIL, rotWeg: "karte" },
  { key: "zahlungslink_bauen", label: "Zahlungslink", satz: "Baut den Link zur Zahlungsseite in die Antwort.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail", rot: KARTE_MAIL, rotWeg: "karte" },
  { key: "terminlink_bauen", label: "Terminlink", satz: "Baut den Terminlink des Betreuers in die Antwort.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail", rot: KARTE_MAIL, rotWeg: "karte" },
  { key: "karte_senden", label: "Kartenlink per Mail", satz: "Schickt den Kartenlink an den bezahlten Kunden.", stufen: ["gruen", "gelb"], vorgabe: "gruen", kanal: "mail", hinweis: "Kein Rot: Der Link ist Vertragsleistung (E-365)." },
  { key: "konto_freischalten", label: "Konto freischalten", satz: "Schaltet den Kundenbereich frei.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "mail", hinweis: "Braucht immer die Freigabe eines Menschen — Mara schaltet nie selbst frei." },
  { key: "vermerk_schreiben", label: "Vermerk schreiben", satz: "Kurzer Vermerk zur Mail in der Akte.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "mail", hinweis: "Nur ein Vermerk — nichts geht an den Kunden." },
  { key: "eskalation_vorbereiten", label: "Eskalation vorbereiten", satz: "Bereitet den Fall für die Leitung vor — ohne Drohung.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail", rot: KARTE_MAIL, rotWeg: "karte" },
  { key: "global_zugang_senden", label: "Global-Zugang senden", satz: "Schickt Firmenkunden den Zugang zum Mandat.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail", rot: KARTE_MAIL, rotWeg: "karte" },
  // ── Aufträge — „Mara anweisen“ (fiaon-mara-auftrag.ts) ───────────────────
  { key: "whatsapp_senden", label: "WhatsApp senden (Auftrag)", satz: "Schickt eine Vorlage im Auftrag — nur nach deinem Klick.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "auftrag", rot: AUFTRAG_ROT, rotWeg: "weglassen" },
  { key: "kunde_kuendigen", label: "Kunde kündigen (Auftrag)", satz: "Bucht eine Kündigung im Auftrag — nur nach deinem Klick.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "auftrag", rot: AUFTRAG_ROT, rotWeg: "weglassen" },
  { key: "wiedervorlage_setzen", label: "Wiedervorlage (Auftrag)", satz: "Setzt eine Wiedervorlage in der Akte.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "auftrag", rot: AUFTRAG_ROT, rotWeg: "weglassen" },
  { key: "notiz_schreiben", label: "Notiz (Auftrag)", satz: "Schreibt eine Notiz in die Akte.", stufen: ["gruen", "gelb"], vorgabe: "gruen", kanal: "auftrag" },
  { key: "aufgabe_anlegen", label: "Aufgabe (Auftrag)", satz: "Legt eine Aufgabe fürs Team an.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "auftrag", rot: AUFTRAG_ROT, rotWeg: "weglassen" },
  { key: "einstellung_setzen", label: "Einstellung setzen (Auftrag)", satz: "Ändert nur Schalter aus dem Register — nach deinem Klick.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "auftrag", rot: AUFTRAG_ROT, rotWeg: "weglassen" },
  // ── Fest rot — nie ein Werkzeug (Geld, Erstattung, Storno, Vertrag, Lastschrift) ──
  { key: "geld_buchen", label: "Geld buchen", satz: "Eingänge auf Raten buchen.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle", hinweis: "Nie durch eine KI — nur über das Bankbuch und deinen Klick." },
  { key: "erstattung", label: "Erstattung", satz: "Geld an Kunden zurück.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle", hinweis: "Nie automatisch — nur per Karte an dich." },
  { key: "raten_storno", label: "Raten stornieren", satz: "Storno oder Erlass einer Rate.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle", hinweis: "Nie durch eine KI — nur mit deinem Klick im Chefbüro." },
  { key: "vertrag_schliessen", label: "Vertrag schließen", satz: "Einen Vertrag abschließen.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle", hinweis: "Nie durch eine KI — der Kunde unterschreibt selbst am Handy." },
  { key: "lastschrift", label: "Lastschrift", satz: "Geld per Lastschrift einziehen.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle", hinweis: "Ausgeschlossen — der Kunde überweist aktiv und selbst." },
];

export const MARA_AMPEL_SCHALTER = "mara_ampel";
export const ARAS_AMPEL_SCHALTER = "aras_ampel";

/** Das JSON unter fiaon_settings.mara_ampel / aras_ampel (Verlauf: älteste zuerst, höchstens 50). */
export interface AmpelStand {
  stufen: Record<string, AmpelStufe>;
  verlauf: { am: string; key: string; von: AmpelStufe; nach: AmpelStufe; wer: string }[];
}

/** Die wirksame Stufe eines Werkzeugs — rein: gespeicherter Wert nur, wenn er zu den erlaubten Stufen gehört. */
export function ampelStufeAus(liste: readonly AmpelWerkzeug[], stand: AmpelStand | null | undefined, key: string): AmpelStufe {
  const w = liste.find((x) => x.key === key);
  if (!w) return "gruen";
  if (w.fest) return w.vorgabe;
  const s = stand?.stufen?.[key];
  return s && w.stufen.includes(s) ? s : w.vorgabe;
}

/**
 * Lesefehler (Datenbank nicht erreichbar): die STRENGSTE Stufe, die das Werkzeug kennt — nie „grün aus Versehen“.
 * Feste Zeilen bleiben, wie sie sind (ihre Garantie setzt der Code selbst durch). Rein.
 */
export function ampelStrengste(w: AmpelWerkzeug): AmpelStufe {
  if (w.fest) return w.vorgabe;
  return w.stufen.includes("rot") ? "rot" : w.stufen.includes("gelb") ? "gelb" : w.vorgabe;
}

/** Darf diese Stufe gesetzt werden? null = ja, sonst der Satz für Justin. Rein. */
export function ampelSetzenPruefen(liste: readonly AmpelWerkzeug[], key: string, stufe: string): string | null {
  const w = liste.find((x) => x.key === key);
  if (!w) return "Dieses Werkzeug gibt es nicht.";
  if (!(AMPEL_STUFEN as readonly string[]).includes(stufe)) return "Diese Stufe gibt es nicht.";
  if (w.fest) return w.hinweis ?? "Diese Stufe ist fest — sie lässt sich nicht umschalten.";
  if (!w.stufen.includes(stufe as AmpelStufe)) return w.hinweis ?? `Erlaubt für „${w.label}“: ${w.stufen.join(", ")}.`;
  return null;
}

/** Den gespeicherten Stand lesen — kaputtes JSON oder fremde Form = leer. Unbekannte Schlüssel bleiben erhalten. Rein. */
export function ampelStandLesen(roh: unknown): AmpelStand {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  const stufen: Record<string, AmpelStufe> = {};
  if (o && typeof o === "object" && o.stufen && typeof o.stufen === "object") {
    for (const [k, v] of Object.entries(o.stufen)) if ((AMPEL_STUFEN as readonly string[]).includes(String(v))) stufen[k] = v as AmpelStufe;
  }
  const verlauf = Array.isArray(o?.verlauf) ? o.verlauf.filter((v: any) => v && typeof v.key === "string").slice(-50) : [];
  return { stufen, verlauf };
}

/**
 * Eine Stufe setzen — rein: der neue Stand. ALLE anderen gespeicherten Stufen bleiben (auch Schlüssel, die diese
 * Liste nicht kennt) — ein Klick überschreibt nie eine andere Zeile. Wirft bei einer Stufe, die nicht geht.
 */
export function ampelStandSetzen(liste: readonly AmpelWerkzeug[], stand: AmpelStand, key: string, stufe: AmpelStufe, wer: string, jetzt: Date = new Date()): { stand: AmpelStand; vorher: AmpelStufe } {
  const fehler = ampelSetzenPruefen(liste, key, stufe);
  if (fehler) throw new Error(fehler);
  const vorher = ampelStufeAus(liste, stand, key);
  const neu: AmpelStand = {
    stufen: { ...stand.stufen, [key]: stufe },
    verlauf: vorher === stufe ? stand.verlauf
      : [...stand.verlauf, { am: jetzt.toISOString(), key, von: vorher, nach: stufe, wer: String(wer || "Chefbüro").slice(0, 80) }].slice(-50),
  };
  return { stand: neu, vorher };
}

/** Eine Zeile der Werkzeuge-Seite: Werkzeug + wirksame Stufe + wann zuletzt geändert. */
export interface AmpelZeile extends AmpelWerkzeug { stufe: AmpelStufe; geaendertAm: string | null }

export function ampelZeilen(liste: readonly AmpelWerkzeug[], stand: AmpelStand): AmpelZeile[] {
  return liste.map((w) => ({
    ...w,
    stufe: ampelStufeAus(liste, stand, w.key),
    geaendertAm: [...stand.verlauf].reverse().find((v) => v.key === w.key)?.am ?? null,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE DIENSTE — so heißen sie in fiaon_ki_nutzung.dienst (nutzungMerken)
// ═══════════════════════════════════════════════════════════════════════════
export interface KiDienst { dienst: string; label: string; wer: "mara" | "aras" | "pruef" | "haus"; deckelSchluessel?: string }
export const KI_DIENSTE: readonly KiDienst[] = [
  { dienst: "mara-aktion", label: "Mara · Mail-Aktion", wer: "mara", deckelSchluessel: "mara_aktion_tag_euro" },
  { dienst: "mara-whatsapp", label: "Mara · WhatsApp", wer: "mara", deckelSchluessel: "mara_wa_tag_euro" },
  { dienst: "postmeister-antwort", label: "Mara · Postfach (Antwort)", wer: "mara", deckelSchluessel: "postmeister_tag_euro" },
  { dienst: "postmeister-einordnen", label: "Mara · Postfach (Einordnen)", wer: "mara" },
  { dienst: "mara-auftrag", label: "Mara · Aufträge", wer: "mara" },
  { dienst: "pruef-mara", label: "Prüf-Mara", wer: "pruef", deckelSchluessel: "pruef_mara_tag_euro" },
  { dienst: "aras-stimme", label: "Aras · Stimme", wer: "aras", deckelSchluessel: "aras_tag_euro" },
  { dienst: "aras-gehirn", label: "Aras · Gehirn", wer: "aras", deckelSchluessel: "aras_tag_euro" },
  { dienst: "aras-nachbereitung", label: "Aras · Nachbereitung", wer: "aras", deckelSchluessel: "aras_tag_euro" },
  { dienst: "telefon", label: "Telefon (Twilio, Schätzung)", wer: "haus" },
  { dienst: "transkript", label: "Transkripte", wer: "haus" },
  { dienst: "telefonkartei", label: "Telefonkartei", wer: "haus" },
  { dienst: "chefbuero", label: "Copilot", wer: "haus" },
  { dienst: "radar", label: "Firmen-Radar", wer: "haus" },
  { dienst: "mara-anliegen", label: "Mara · Anliegen", wer: "mara" },
  { dienst: "mara-nacharbeit", label: "Mara · Nach dem Anruf", wer: "mara" },
  { dienst: "partner-crm", label: "Partner-CRM", wer: "haus" },
  { dienst: "finanzauswertung", label: "Finanzauswertung", wer: "haus" },
  { dienst: "ki-kasse", label: "KI-Kasse (Bremsungen)", wer: "haus" },
  { dienst: "ratgeber", label: "Ratgeber", wer: "haus" },
  { dienst: "ocr", label: "Texterkennung", wer: "haus" },
  { dienst: "dokument-pruefung", label: "Dokumentprüfung", wer: "haus" },
  { dienst: "kontoauszug", label: "Kontoauszug-Analyse", wer: "haus" },
  { dienst: "schufa", label: "Auskunft-Analyse", wer: "haus" },
  { dienst: "gespraechsanalyse", label: "Gesprächsanalyse", wer: "haus" },
  { dienst: "gespraechsblatt", label: "Gesprächsblatt", wer: "haus" },
  { dienst: "notiz-analyse", label: "Notiz-Analyse", wer: "haus" },
  { dienst: "mail-ki", label: "Mail-KI", wer: "haus" },
  { dienst: "ki-pause", label: "KI-Probe", wer: "haus" },
];
export function dienstLabel(dienst: string): string {
  return KI_DIENSTE.find((d) => d.dienst === dienst)?.label ?? dienst;
}
export function dienstWer(dienst: string): KiDienst["wer"] {
  const d = KI_DIENSTE.find((x) => x.dienst === dienst);
  if (d) return d.wer;
  if (/^aras/.test(dienst)) return "aras";
  if (/^(mara|postmeister)/.test(dienst)) return "mara";
  return "haus";
}

/** Twilio-Minutenpreis (Schätzwert, Cent je Minute, DE) — Ist monatlich aus der Rechnung nachziehen (Vertrag § 12). */
export const TWILIO_MIN_CENTS = 4.3;

// ═══════════════════════════════════════════════════════════════════════════
// JSON-FORMEN DES RAUMS (SCHNITTSTELLE § 5)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Kosten eines Dienstes heute. E-458 (29.10.2026): `euro` heißt aus Gewohnheit so — für KI-Dienste sind es echte DOLLAR
 * (Listenpreis, wie OpenAI abrechnet), nur die Telefon-Zeile ist Euro (Twilio-Schätzung). `waehrung` sagt es genau.
 */
export interface KostenDienst { dienst: string; label: string; wer: KiDienst["wer"]; euro: number; deckel: number | null; anteil: number; waehrung?: "USD" | "EUR"; bereich?: string }

/** Ein gelber Eintrag in „Heute“ (server/lib/fiaon-mara-heute.ts gelbListe) — mit Rückgängig, wo es sicher geht. */
export interface GelbSicht {
  art: string; id: string; werkzeug: string; am: string; personId: number | null; name: string | null; text: string;
  knoepfe: { art: string; label: string; vorsicht?: boolean }[]; ohne: string | null;
  erledigt: { am: string; von: string | null; ergebnis: string | null } | null;
}

export interface KiHeute {
  tag: string;
  /** Darf der Betrachter Namen sehen und entscheiden (Inhaber/Geschäftsführung)? Die Leitung sieht keine Kundennamen. */
  darf: { namen: boolean; entscheiden: boolean; rueckgaengig: boolean; notaus: boolean };
  mara: {
    mails: { geschrieben: number; entwuerfe: number; reinHeute: number };
    whatsapps: { raus: number; rein: number; menschen: number };
    termine: number;
    auftraege: { gelaufen: number; wartend: number };
    entscheidungen: { offen: number; geldRecht: number };
    an: { aktion: boolean; whatsapp: boolean; postfach: boolean };
    /** Not-Aus über ALLE Mara-Wege — und was „Wieder an“ genau zurückstellt (E-409 Funde 2 + 9). */
    notaus: {
      aktiv: boolean; seit: string | null; von: string | null; wege: { schluessel: string; label: string; an: boolean; vorherAn: boolean | null }[];
      /** E-409 × E-408: Aras im selben Not-Aus — sein EINER Schlüssel aras_notaus (an = angehalten); null = Aras gibt es hier nicht. */
      aras?: { verbunden: boolean; angehalten: boolean; vorherAngehalten: boolean | null } | null;
    };
    /** Aus derselben Quelle wie das Lagezimmer (maraHeuteLesen): selbst erledigt, je Art, Geld, Aufräumen, wo es hängt, KI. */
    erledigt: number;
    zeilen: { art: string; n: number; text: string; link: string; werkzeug: string | null }[];
    geld: { heuteCents: number; zahlungen: number; nachMaraCents: number; nachMaraZahlungen: number } | null;
    aufraeumen: { art: string; anzahl: number; titel: string }[];
    haengt: { agentId: number; name: string; termineOhneErgebnis: number; aeltesterTermin: string | null; auftraegeUeberfaellig: number; auftraegeOffen: number }[];
    /** Gelb der letzten 24 h — Termine, Angaben, Mail-Entwürfe mit Rückgängig, dazu jedes gelbe Werkzeug, das lief. */
    gelb: GelbSicht[];
  };
  aras: null | { verbunden: boolean; an: boolean; notaus: boolean; gewaehlt: number; erreicht: number; gespraeche: number; zusagen: number; euro: number; laufend: number };
  karten: unknown[];
  kiBand: { an: boolean; art: string | null; seit: string | null; anbieter: string } | null;
  waBremse: { pause: boolean; qualitaet: string | null; satz: string | null } | null;
  kosten: KostenDienst[];
  pruefung: { heute: number; auffaellig: number; offenKarten: number };
}

/** Ein Prüf-Punkt in fiaon_ki_pruefung.punkte. */
export interface PruefPunkt { regel: string; schwere: "hart" | "weich"; treffer: string; hinweis: string }

export interface PruefZeile {
  id: number; am: string; kanal: "telefon" | "mail" | "whatsapp"; bezugArt: string; bezugId: number;
  personId: number | null; name: string | null; urteil: "ok" | "auffaellig" | "fehler";
  punkte: PruefPunkt[]; begruendung: string | null; modell: string | null; kostenCents: number;
  schluessel: string | null; karteSchluessel: string | null; entschieden: string | null; entschiedenAm: string | null;
}

export interface Fehlerquote {
  tage: number;
  je: { kanal: string; schluessel: string; n: number; auffaellig: number; quote: number }[];
  gesamt: { n: number; auffaellig: number; quote: number };
  vorschlaege: string[];
}

/** ARAS-Formen (Vertrag § 5) — strukturgleich zu shared/fiaon-aras.ts (Team 1). */
export type ArasSpielart = "termin" | "willkommen" | "lead" | "zuruf" | "stufe_b" | "stufe_a" | "rate" | "zusage" | "rueckholung" | "auftrag" | "eingehend" | "probe";
export const ARAS_SPIELARTEN: readonly ArasSpielart[] = ["termin", "willkommen", "lead", "zuruf", "stufe_b", "stufe_a", "rate", "zusage", "rueckholung", "auftrag", "eingehend", "probe"];
export const SPIELART_TEXT: Record<ArasSpielart, string> = {
  termin: "Termin bei ARAS", willkommen: "Willkommen nach Antrag", lead: "Lead frisch", zuruf: "Verkauf nach JA", stufe_b: "Stufe B kalt", stufe_a: "Zahlung gemeldet",
  rate: "Rate offen", zusage: "Zusage nachfassen", rueckholung: "Rückholung", auftrag: "Auftrag vom Team", eingehend: "Eingehend", probe: "Probe",
};
export interface LiveSitzung { callId: number; personId: number | null; spielart: ArasSpielart; seitSek: number; zustand: string; letzteZeilen: { wer: "kunde" | "aras"; text: string }[] }
export interface PlanZeile { id: number; personId: number | null; name: string | null; spielart: ArasSpielart; prioritaet: number; grund: string; fruehAb: string; spaetBis: string; status: string; versuchNr: number; rechtsgrund: string }
export interface AnrufZeile { id: number; callId: number; am: string; spielart: ArasSpielart; personId?: number | null; name: string | null; ergebnis: string | null; dauerSek: number; kostenCents: number; pruefung: string | null; uebergabe: string | null }
export interface HoerprobeZeile { id: number; adapter: string; stimme: string; beschreibung: string | null; text: string; dauerMs: number | null; bewertung: number | null; kommentar: string | null; gewaehltAm: string | null; createdAt: string }
export interface ArasLage {
  verbunden: boolean; an: boolean; notaus: boolean; leerlauf?: boolean; adapter: string | null; stimme: string | null;
  plan: unknown; laufend: LiveSitzung[];
  heute: { gewaehlt: number; erreicht: number; gespraeche: number; zusagen: number; euroKi: number; euroTelefon: number; deckel: number | null };
}
