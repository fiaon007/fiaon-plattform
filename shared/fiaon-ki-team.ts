// ═══════════════════════════════════════════════════════════════════════════
// DAS KI-TEAM (E-409, 19.10.2026) — Dienste, Ampel, Oberflächen-Formen
//
// Justin: „ein eigener Bereich (wie ein ‚Labs‘, einfach geil gemacht) für ALLE
// KI-Mitarbeiter — Mara und ARAS — in dem wir ins Detail steuern können, mit
// allen Sachen, die auch wirklich funktionieren.“
//
// Diese Datei ist REIN (keine Datenbank, kein Netz): die Liste der KI-Dienste
// (so heißen sie in fiaon_ki_nutzung), die Werkzeug-Ampel für Mara und die
// JSON-Formen, die der Raum /chef/ki von den Routen bekommt (SCHNITTSTELLE § 5).
// Die ARAS-Formen sind die des Vertrags — strukturgleich zu dem, was Team 1 in
// shared/fiaon-aras.ts baut. Solange ARAS nicht angebunden ist (Anbindung in
// server/lib/fiaon-ki-aras-anbindung.ts), zeigt der Raum den Leerzustand
// „Aras ist noch nicht verbunden“.
// ═══════════════════════════════════════════════════════════════════════════

/** Die drei Stufen der Werkzeug-Ampel: grün = macht es allein · gelb = macht es, steht in „Heute“ · rot = nur Karte. */
export type AmpelStufe = "gruen" | "gelb" | "rot";
export const AMPEL_STUFEN: readonly AmpelStufe[] = ["gruen", "gelb", "rot"];
export const AMPEL_TEXT: Record<AmpelStufe, string> = { gruen: "macht es allein", gelb: "macht es — steht in „Heute“", rot: "nur per Karte" };

export interface AmpelWerkzeug {
  key: string;
  label: string;
  /** Ein Satz: was das Werkzeug tut. ≤ 80 Zeichen. */
  satz: string;
  /** Welche Stufen der Server wirklich durchsetzt — nur die werden angeboten. */
  stufen: AmpelStufe[];
  vorgabe: AmpelStufe;
  /** Fest = nicht umschaltbar (Geld, Erstattung, Pflicht nach UWG). */
  fest?: boolean;
  /** Wo es wirkt: WhatsApp, Postfach, Aufträge (Mara anweisen). */
  kanal: "whatsapp" | "mail" | "auftrag" | "alle";
}

/**
 * MARAS WERKZEUG-AMPEL — jede Zeile hat einen Code-Pfad, der die Stufe liest
 * (server/lib/fiaon-ki-ampel.ts: ampelStufe → fiaon-whatsapp-mara.ts werkzeugAusfuehren,
 * fiaon-postmeister-agent.ts Werkzeug-Rufe, fiaon-mara-auftrag.ts auftragAusfuehren).
 * Rot = das Werkzeug meldet dem Modell „gesperrt“ und Mara übergibt; gelb = läuft,
 * steht aber als Zeile in „Heute“ (Protokoll-Art ampel_gelb). Was heute von Haus aus
 * eine Freigabe braucht (konto_freischalten), bleibt gelb oder rot — eine Ampel macht
 * nichts freier, als der Code es heute ist.
 */
export const MARA_AMPEL: readonly AmpelWerkzeug[] = [
  // WhatsApp (fiaon-whatsapp-mara.ts, E-236 …)
  { key: "freie_zeiten", label: "Freie Zeiten holen", satz: "Liest freie Termine des Betreuers für ein Zeitangebot.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "whatsapp" },
  { key: "rueckruf_eintragen", label: "Rückruf eintragen", satz: "Bucht den Rückruf in die Arbeitszeit des Betreuers.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp" },
  { key: "zahlungszusage_merken", label: "Zahlungszusage merken", satz: "Trägt „zahlt am …“ in die Akte, mit Wiedervorlage.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp" },
  { key: "terminlink_schicken", label: "Terminlink schicken", satz: "Schickt den Buchungslink, wenn keine Zeit passt.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp" },
  { key: "kuendigung_aufnehmen", label: "Kündigung aufnehmen", satz: "Nimmt eine klare Kündigung auf — Bestätigung folgt.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp" },
  { key: "karte_link_schicken", label: "Kartenlink schicken", satz: "Schickt dem bezahlten Kunden den Link zur Partnerbank.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp" },
  { key: "ratenpause_setzen", label: "Ratenpause setzen", satz: "Setzt eine Ratenpause nach Regel (Sperre, Höchstmonate).", stufen: ["gruen", "gelb", "rot"], vorgabe: "gelb", kanal: "whatsapp" },
  { key: "angaben_eintragen", label: "Angaben ändern", satz: "Neue Nummer oder Anschrift — nur vom hinterlegten Absender.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "whatsapp" },
  // Postfach (fiaon-postmeister-werkzeuge.ts)
  { key: "notiz_an_betreuer", label: "Notiz an Betreuer", satz: "Schreibt den Vermerk in die Akte.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "mail" },
  { key: "aufgabe_an_betreuer", label: "Aufgabe an Betreuer", satz: "Legt eine Aufgabe an, wenn ein Mensch ran muss.", stufen: ["gruen", "gelb"], vorgabe: "gruen", kanal: "mail" },
  { key: "rechnung_anhaengen", label: "Rechnung anhängen", satz: "Hängt die Rechnung an, wenn er sie verlangt.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  { key: "auskunft_anbieten", label: "Auskunft anbieten", satz: "Bietet die Bonitätsauskunft an (nur erlaubte Lagen).", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle" },
  { key: "kuendigung_vormerken", label: "Kündigung vormerken", satz: "Merkt eine Kündigung aus der Mail vor — Karte folgt.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  { key: "werbesperre_setzen", label: "Werbesperre setzen", satz: "„Keine Werbung mehr“ — sofort, dauerhaft.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "mail" },
  { key: "mahnstopp_setzen", label: "Mahnstopp setzen", satz: "Hält die Mahnkette an, wenn er bestreitet.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  { key: "zahlungslink_bauen", label: "Zahlungslink", satz: "Baut den Link zur Zahlungsseite in die Antwort.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  { key: "terminlink_bauen", label: "Terminlink", satz: "Baut den Terminlink des Betreuers in die Antwort.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  { key: "karte_senden", label: "Kartenlink per Mail", satz: "Schickt den Kartenlink an den bezahlten Kunden.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  { key: "konto_freischalten", label: "Konto freischalten", satz: "Braucht heute die Freigabe eines Menschen.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "mail" },
  { key: "vermerk_schreiben", label: "Vermerk schreiben", satz: "Kurzer Vermerk zur Mail in der Akte.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "mail" },
  { key: "eskalation_vorbereiten", label: "Eskalation vorbereiten", satz: "Bereitet den Fall für die Leitung vor — ohne Drohung.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  { key: "global_zugang_senden", label: "Global-Zugang senden", satz: "Schickt Firmenkunden den Zugang zum Mandat.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "mail" },
  // Aufträge — „Mara anweisen“ (fiaon-mara-auftrag.ts)
  { key: "whatsapp_senden", label: "WhatsApp senden (Auftrag)", satz: "Schickt eine Vorlage im Auftrag — nur nach deinem Klick.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "auftrag" },
  { key: "kunde_kuendigen", label: "Kunde kündigen (Auftrag)", satz: "Bucht eine Kündigung im Auftrag — nur nach deinem Klick.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "auftrag" },
  { key: "wiedervorlage_setzen", label: "Wiedervorlage (Auftrag)", satz: "Setzt eine Wiedervorlage in der Akte.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "auftrag" },
  { key: "notiz_schreiben", label: "Notiz (Auftrag)", satz: "Schreibt eine Notiz in die Akte.", stufen: ["gruen", "gelb"], vorgabe: "gruen", kanal: "auftrag" },
  { key: "aufgabe_anlegen", label: "Aufgabe (Auftrag)", satz: "Legt eine Aufgabe fürs Team an.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "auftrag" },
  { key: "einstellung_setzen", label: "Einstellung setzen (Auftrag)", satz: "Ändert nur Schalter aus dem Register — nach deinem Klick.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "auftrag" },
  // Fest rot — nie ein Werkzeug (Geld, Erstattung, Storno, Vertrag, Lastschrift)
  { key: "geld_buchen", label: "Geld buchen", satz: "Nie durch eine KI — nur über das Bankbuch und deine Karte.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle" },
  { key: "erstattung", label: "Erstattung", satz: "Nie durch eine KI — nur per Karte an dich.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle" },
  { key: "raten_storno", label: "Raten stornieren", satz: "Nie durch eine KI — nur per Karte an dich.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle" },
  { key: "vertrag_schliessen", label: "Vertrag schließen", satz: "Nie durch eine KI — der Kunde unterschreibt selbst am Handy.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle" },
  { key: "lastschrift", label: "Lastschrift", satz: "Ausgeschlossen — der Kunde überweist aktiv und selbst.", stufen: ["rot"], vorgabe: "rot", fest: true, kanal: "alle" },
];

export const MARA_AMPEL_SCHALTER = "mara_ampel";
export const ARAS_AMPEL_SCHALTER = "aras_ampel";

/** Das JSON unter fiaon_settings.mara_ampel / aras_ampel. */
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

/** Den gespeicherten Stand lesen — kaputtes JSON oder fremde Form = leer. Rein. */
export function ampelStandLesen(roh: unknown): AmpelStand {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  const stufen: Record<string, AmpelStufe> = {};
  if (o && typeof o === "object" && o.stufen && typeof o.stufen === "object") {
    for (const [k, v] of Object.entries(o.stufen)) if ((AMPEL_STUFEN as readonly string[]).includes(String(v))) stufen[k] = v as AmpelStufe;
  }
  const verlauf = Array.isArray(o?.verlauf) ? o.verlauf.slice(-50) : [];
  return { stufen, verlauf };
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
export interface KostenDienst { dienst: string; label: string; wer: KiDienst["wer"]; euro: number; deckel: number | null; anteil: number }

export interface KiHeute {
  tag: string;
  mara: {
    mails: { geschrieben: number; entwuerfe: number; reinHeute: number };
    whatsapps: { raus: number; rein: number; menschen: number };
    termine: number;
    auftraege: { gelaufen: number; wartend: number };
    entscheidungen: { offen: number; geldRecht: number };
    an: { aktion: boolean; whatsapp: boolean; postfach: boolean };
    /** Gelbe Werkzeuge, die heute liefen (Protokoll-Art ampel_gelb) — zum Nachsehen. */
    gelb: { am: string; kanal: string; text: string; personId: number | null }[];
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
export type ArasSpielart = "termin" | "lead" | "zuruf" | "stufe_b" | "stufe_a" | "rate" | "zusage" | "rueckholung" | "eingehend" | "probe";
export const ARAS_SPIELARTEN: readonly ArasSpielart[] = ["termin", "lead", "zuruf", "stufe_b", "stufe_a", "rate", "zusage", "rueckholung", "eingehend", "probe"];
export const SPIELART_TEXT: Record<ArasSpielart, string> = {
  termin: "Rückruf/Termin", lead: "Lead frisch", zuruf: "Verkauf nach JA", stufe_b: "Stufe B kalt", stufe_a: "Zahlung gemeldet",
  rate: "Rate fällig", zusage: "Zusage nachfassen", rueckholung: "Rückholung", eingehend: "Eingehend", probe: "Probe",
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
