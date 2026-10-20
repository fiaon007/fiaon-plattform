// ═══════════════════════════════════════════════════════════════════════════
// DAS SCHALTER-REGISTER (E-409, 19.10.2026) — jeder Schalter, der wirklich wirkt
//
// Justin: „… mit allen Sachen, die auch wirklich funktionieren.“ Darum steht
// hier NUR, was einen Setzer (die eine Route, die den Schlüssel schreibt) UND
// einen Leser (den Code-Pfad, der ihn liest) hat. Die Einstellungen-Seite im
// KI-Raum rendert ausschließlich dieses Register; scripts/pruef-ki-schalter.ts
// prüft für jeden Eintrag: Setzer-Route im Code, Leser-Datei vorhanden,
// Vorgabe innerhalb der Grenze. Ein Schalter ohne Setzer kommt nicht hinein —
// er wäre tot. Bestehende Setzer bleiben (Mail-Aktion, Postmeister, Rückholung,
// Auskunft); nur die bisher oberflächenlosen Schlüssel setzt die neue Route
// POST /chef/ki/einstellung (Erlaubnisliste KI_SCHLUESSEL).
//
// Rein: keine Datenbank, kein Netz. `wertPruefen` ist die Grenze, die auch der
// Server anwendet — eine Wahrheit für Oberfläche und Route.
// ═══════════════════════════════════════════════════════════════════════════

import { ARAS_SCHLUESSEL as ARAS_KERN_SCHLUESSEL } from "./fiaon-aras";

export type SchalterGruppe = "mara_mail" | "mara_whatsapp" | "aras" | "leitplanken" | "kasse";
export const GRUPPEN: { key: SchalterGruppe; label: string; satz: string }[] = [
  { key: "mara_mail", label: "Mara · Mail", satz: "Postfach, Mail-Aktion, Nachfassen, Rückholung." },
  { key: "mara_whatsapp", label: "Mara · WhatsApp", satz: "Antworten, Nachfassen, Auskunft-Verkauf." },
  { key: "aras", label: "Aras · Telefon", satz: "Stimme, Regie, Spielarten, Zeiten, Mengen." },
  { key: "leitplanken", label: "Leitplanken", satz: "Prüf-Mara, Bremsen, Termine bei Justin." },
  { key: "kasse", label: "Kasse", satz: "Deckel je Dienst und Tag." },
];

export type SchalterTyp = "an_aus" | "eins_null" | "zahl" | "text" | "enum" | "json";

export interface Setzer {
  /** Pfad unter /api/fiaon. */
  route: string;
  /** Wie die Route den Wert erwartet. */
  form: "schluessel_wert" | "key_value" | "an_boolean" | "altbestand_boolean";
  mindest: "inhaber" | "geschaeftsfuehrung" | "leitung";
}

export interface RegisterEintrag {
  schluessel: string;
  gruppe: SchalterGruppe;
  /** ≤ 40 Zeichen. */
  label: string;
  /** Ein Satz, ≤ 80 Zeichen. */
  satz: string;
  typ: SchalterTyp;
  vorgabe: string;
  min?: number;
  max?: number;
  enum?: readonly string[];
  /** Beschriftung je Enum-Wert (optional). */
  enumText?: Record<string, string>;
  maxZeichen?: number;
  /** Pflicht-Muster für Text (z. B. der KI-Hinweis muss „KI“ enthalten). */
  muss?: RegExp;
  mussText?: string;
  setzer: Setzer;
  /** datei.ts:funktion — der Code-Pfad, der den Schlüssel liest. */
  leser: string;
  dienst: "mara" | "aras" | "pruef";
  /** Für JSON: was drinstehen darf. */
  jsonPruefen?: (o: unknown) => string | null;
  /** E-409 Fund 11: eine persönliche Telefonnummer — überall nur die letzten 3 Ziffern (Anzeige, Protokoll, Logs). */
  geheim?: boolean;
}

const KI: Setzer = { route: "/chef/ki/einstellung", form: "schluessel_wert", mindest: "inhaber" };
const MARA_AKTION: Setzer = { route: "/chef/mara/einstellung", form: "schluessel_wert", mindest: "inhaber" };
const POSTMEISTER: Setzer = { route: "/admin/postmeister/einstellung", form: "schluessel_wert", mindest: "inhaber" };
const RUECKHOLUNG: Setzer = { route: "/chef/rueckholung/einstellung", form: "key_value", mindest: "geschaeftsfuehrung" };
const AUSKUNFT: Setzer = { route: "/chef/auskunft/einstellung", form: "key_value", mindest: "inhaber" };

const MODUS = ["auto", "hybrid", "entwurf", "aus"] as const;
const MODUS_TEXT = { auto: "antwortet selbst", hybrid: "Entwurf bei Unsicherheit", entwurf: "nur Entwürfe", aus: "aus" };

/** ARAS-Vorgaben (Vertrag § 3) — ENTWURF § 2 für die beiden Sätze. */
// Die beiden Pflicht-Sätze kommen aus dem ARAS-Kern (EINE Quelle): Aras liest genau diese Vorgabe, wenn nichts
// gespeichert ist — sonst zeigte der KI-Raum einen anderen Satz (mit Platzhalter „[Nachname]“), als Aras sagt.
export const ARAS_KI_HINWEIS_VORGABE = String(ARAS_KERN_SCHLUESSEL.aras_ki_hinweis_satz.vorgabe);
export const ARAS_AUFNAHME_FRAGE_VORGABE = String(ARAS_KERN_SCHLUESSEL.aras_aufnahme_frage.vorgabe);
export const ARAS_SPIELARTEN_VORGABE = { termin: "an", zuruf: "an", stufe_a: "an", rate: "an", zusage: "an", probe: "an", lead: "aus", stufe_b: "aus", rueckholung: "aus", eingehend: "aus" };
export const ARAS_FENSTER_VORGABE = { verkauf: { "1-5": ["09:00", "19:00"], "6": ["10:00", "16:00"] }, rate: { "1-5": ["09:00", "19:00"] } };

const jsonObjekt = (o: unknown) => (o && typeof o === "object" && !Array.isArray(o) ? null : "Erwartet wird ein Objekt { … }.");
const quoteJson = (o: unknown): string | null => {
  const f = jsonObjekt(o); if (f) return f;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (!["telefon", "mail", "whatsapp"].includes(k)) return `Unbekannter Kanal „${k}“.`;
    const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 100) return `${k}: 0–100.`;
  }
  return null;
};
const spielartenJson = (o: unknown): string | null => {
  const f = jsonObjekt(o); if (f) return f;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (!(k in ARAS_SPIELARTEN_VORGABE)) return `Unbekannte Spielart „${k}“.`;
    if (v !== "an" && v !== "aus") return `${k}: an oder aus.`;
  }
  return null;
};
const zeit = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const fensterJson = (o: unknown): string | null => {
  const f = jsonObjekt(o); if (f) return f;
  for (const [art, tage] of Object.entries(o as Record<string, unknown>)) {
    if (art !== "verkauf" && art !== "rate") return `Unbekannt: „${art}“ (verkauf, rate).`;
    const g = jsonObjekt(tage); if (g) return g;
    for (const [tag, zeiten] of Object.entries(tage as Record<string, unknown>)) {
      if (tag === "0") return "Sonntag (0) ist nie erlaubt.";
      if (!/^[1-6](?:-[1-6])?$/.test(tag)) return `Tag „${tag}“: 1–6 oder 1-5.`;
      if (!Array.isArray(zeiten) || zeiten.length !== 2 || !zeit.test(String(zeiten[0])) || !zeit.test(String(zeiten[1]))) return `${tag}: ["HH:MM","HH:MM"].`;
      if (String(zeiten[0]) < "08:00" || String(zeiten[1]) > "20:00") return `${tag}: nur zwischen 08:00 und 20:00.`;
    }
  }
  return null;
};
const taktJson = (o: unknown): string | null => {
  if (!Array.isArray(o) || !o.length || o.length > 4) return "Liste mit 1–4 Tagen, z. B. [3,10,20].";
  for (const n of o) if (!Number.isInteger(n) || n < 1 || n > 30) return "Jeder Takt 1–30 Tage.";
  return null;
};
const uebergabeJson = (o: unknown): string | null => {
  const f = jsonObjekt(o); if (f) return f;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (k === "sonst") { if (v !== "betreuer") return "sonst: „betreuer“."; continue; }
    if (k !== "rate" && k !== "verkauf") return `Unbekannt: „${k}“ (rate, verkauf, sonst).`;
    if (!Array.isArray(v) || v.some((x) => !Number.isInteger(x))) return `${k}: Liste von Mitarbeiter-Nummern.`;
  }
  return null;
};

export const REGISTER: readonly RegisterEintrag[] = [
  // ── Mara · Mail ───────────────────────────────────────────────────────────
  { schluessel: "mara_aktion_an", gruppe: "mara_mail", label: "Mail-Aktion", satz: "Maras persönliche Mails an Stufe A und B (08–21 Uhr).", typ: "an_aus", vorgabe: "an", setzer: MARA_AKTION, leser: "fiaon-mara-aktion.ts:einstellungenLesen", dienst: "mara" },
  { schluessel: "mara_aktion_je_stunde", gruppe: "mara_mail", label: "Mails je Stunde", satz: "Höchstens so viele Aktionsmails je Stunde (Deckel 60).", typ: "zahl", vorgabe: "60", min: 0, max: 60, setzer: MARA_AKTION, leser: "fiaon-mara-aktion.ts:einstellungenLesen", dienst: "mara" },
  { schluessel: "mara_aktion_stufen", gruppe: "mara_mail", label: "Stufen", satz: "Wen die Aktion anschreibt: A (gemeldet), B (Antrag offen).", typ: "enum", vorgabe: "A,B", enum: ["A,B", "A", "B"], setzer: MARA_AKTION, leser: "fiaon-mara-aktion.ts:einstellungenLesen", dienst: "mara" },
  { schluessel: "mara_aktion_emojis", gruppe: "mara_mail", label: "Emojis", satz: "Darf die Aktion Emojis nutzen?", typ: "an_aus", vorgabe: "aus", setzer: MARA_AKTION, leser: "fiaon-mara-aktion.ts:einstellungenLesen", dienst: "mara" },
  { schluessel: "mara_aktion_postfach", gruppe: "mara_mail", label: "Absender-Postfach", satz: "Von welcher Adresse die Aktion schreibt.", typ: "text", vorgabe: "support@fiaon.com", maxZeichen: 80, setzer: MARA_AKTION, leser: "fiaon-mara-aktion.ts:einstellungenLesen", dienst: "mara" },
  { schluessel: "mara_aktion_runde_seit", gruppe: "mara_mail", label: "Runde", satz: "„jetzt“ startet eine Runde an alle offenen Erstzahler, „aus“ beendet sie.", typ: "text", vorgabe: "", maxZeichen: 40, setzer: MARA_AKTION, leser: "fiaon-mara-aktion.ts:rundeAktiv", dienst: "mara" },
  { schluessel: "mara_nicht_erreicht_mail", gruppe: "mara_mail", label: "Nachfassen nach 2× nicht erreicht", satz: "Nach dem zweiten Fehlversuch eine Mail mit Terminlink.", typ: "an_aus", vorgabe: "an", setzer: { route: "/chef/mara/nicht-erreicht", form: "an_boolean", mindest: "inhaber" }, leser: "fiaon-mara-nicht-erreicht.ts:schalterLesen", dienst: "mara" },
  // E-409 × E-406 (20.10.2026): die Wege aus Welle 1 und 2 — derselbe Schalter wie im Mara-Steuerpult (dessen Route).
  { schluessel: "mara_rate_erinnerung", gruppe: "mara_mail", label: "Raten-Mail (frisch fällig)", satz: "Tag 1–3 nach der Fälligkeit: eine persönliche Mail je Rate.", typ: "an_aus", vorgabe: "an", setzer: { route: "/chef/mara/raten-erinnerung", form: "an_boolean", mindest: "inhaber" }, leser: "fiaon-mara-rate-erinnerung.ts:schalterLesen", dienst: "mara" },
  { schluessel: "mara_anliegen", gruppe: "mara_mail", label: "Anliegen beantworten", satz: "Mara beantwortet Anliegen aus dem Kundenbereich selbst.", typ: "an_aus", vorgabe: "an", setzer: { route: "/chef/mara/anliegen", form: "an_boolean", mindest: "inhaber" }, leser: "fiaon-mara-anliegen.ts:anliegenSchalterLesen", dienst: "mara" },
  { schluessel: "mara_nacharbeit_mail", gruppe: "mara_mail", label: "Zusammenfassung nach dem Anruf", satz: "Nach dem Ergebnis-Klick schickt Mara dem Kunden die Zusammenfassung.", typ: "an_aus", vorgabe: "an", setzer: { route: "/chef/mara/nacharbeit", form: "an_boolean", mindest: "inhaber" }, leser: "fiaon-mara-nacharbeit.ts:schalterLesen", dienst: "mara" },
  { schluessel: "mara_kyc_nachfordern", gruppe: "mara_mail", label: "Unterlagen nachfordern", satz: "Mara erinnert an fehlenden Ausweis oder Kontoauszug (höchstens 2×).", typ: "an_aus", vorgabe: "an", setzer: { route: "/chef/mara/unterlagen/kyc", form: "an_boolean", mindest: "inhaber" }, leser: "fiaon-mara-kyc.ts:kycSchalterLesen", dienst: "mara" },
  { schluessel: "postmeister_an", gruppe: "mara_mail", label: "Postfach (Not-Aus)", satz: "Aus hält ALLES an — auch das Ordnen der Postfächer.", typ: "an_aus", vorgabe: "an", setzer: POSTMEISTER, leser: "fiaon-postmeister.ts:wirksamerModus", dienst: "mara" },
  { schluessel: "postmeister_modus_support", gruppe: "mara_mail", label: "Modus support@", satz: "Wie Mara im Support-Postfach arbeitet.", typ: "enum", vorgabe: "auto", enum: MODUS, enumText: MODUS_TEXT, setzer: POSTMEISTER, leser: "fiaon-postmeister.ts:wirksamerModus", dienst: "mara" },
  { schluessel: "postmeister_modus_welcome", gruppe: "mara_mail", label: "Modus welcome@", satz: "Wie Mara im Welcome-Postfach arbeitet.", typ: "enum", vorgabe: "auto", enum: MODUS, enumText: MODUS_TEXT, setzer: POSTMEISTER, leser: "fiaon-postmeister.ts:wirksamerModus", dienst: "mara" },
  { schluessel: "postmeister_name", gruppe: "mara_mail", label: "Vorname in Mails", satz: "So unterschreibt Mara im Postfach.", typ: "text", vorgabe: "Mara", maxZeichen: 40, setzer: POSTMEISTER, leser: "fiaon-postmeister-agent.ts:agentNamen", dienst: "mara" },
  { schluessel: "postmeister_nachname", gruppe: "mara_mail", label: "Nachname in Mails", satz: "Der Nachname unter der Mail.", typ: "text", vorgabe: "Lindner", maxZeichen: 40, setzer: POSTMEISTER, leser: "fiaon-postmeister-agent.ts:agentNamen", dienst: "mara" },
  { schluessel: "postmeister_aufhol_ordnen", gruppe: "mara_mail", label: "Rückstand: Ordnen je Lauf", satz: "Wie viele alte Mails ein Aufhol-Lauf einordnet.", typ: "zahl", vorgabe: "60", min: 0, max: 300, setzer: KI, leser: "fiaon-postmeister-aufholen.ts:aufholDeckel", dienst: "mara" },
  { schluessel: "postmeister_aufhol_antworten", gruppe: "mara_mail", label: "Rückstand: Antworten je Lauf", satz: "Wie viele alte Mails ein Aufhol-Lauf beantwortet.", typ: "zahl", vorgabe: "20", min: 0, max: 100, setzer: KI, leser: "fiaon-postmeister-aufholen.ts:aufholDeckel", dienst: "mara" },
  { schluessel: "postmeister_altbestand_ablegen", gruppe: "mara_mail", label: "Alte Entwürfe ablegen", satz: "Entwürfe, die nicht mehr nötig sind, legt Mara ab (nie senden).", typ: "an_aus", vorgabe: "aus", setzer: { route: "/admin/postmeister/frist", form: "altbestand_boolean", mindest: "inhaber" }, leser: "fiaon-postmeister-frist.ts:altbestandSchalterLesen", dienst: "mara" },
  { schluessel: "auskunft_verkauf_an", gruppe: "mara_mail", label: "Auskunft-Verkauf", satz: "Der Takt verkauft die Bonitätsauskunft per Mail.", typ: "eins_null", vorgabe: "0", setzer: AUSKUNFT, leser: "fiaon-auskunft-verkauf.ts:verkaufEinstellungen", dienst: "mara" },
  { schluessel: "auskunft_verkauf_kreis", gruppe: "mara_mail", label: "Auskunft: Kreis", satz: "uwg = nur mit Einwilligung, alle = jeder im Bestand.", typ: "enum", vorgabe: "uwg", enum: ["uwg", "alle"], setzer: AUSKUNFT, leser: "fiaon-auskunft-verkauf.ts:verkaufEinstellungen", dienst: "mara" },
  { schluessel: "auskunft_verkauf_mails_pro_tag", gruppe: "mara_mail", label: "Auskunft: Mails je Tag", satz: "Deckel der Auskunft-Mails je Tag.", typ: "zahl", vorgabe: "500", min: 0, max: 500, setzer: AUSKUNFT, leser: "fiaon-auskunft-verkauf.ts:verkaufEinstellungen", dienst: "mara" },
  { schluessel: "auskunft_liefermodus", gruppe: "mara_mail", label: "Auskunft: Lieferung", satz: "Wie die bezahlte Auskunft beschafft wird.", typ: "enum", vorgabe: "einkauf", enum: ["einkauf", "vollmacht", "api"], setzer: AUSKUNFT, leser: "fiaon-auskunft-verkauf.ts:verkaufEinstellungen", dienst: "mara" },
  { schluessel: "auskunft_erinnerung_an", gruppe: "mara_mail", label: "Auskunft: Zahlungserinnerung", satz: "Erinnert, wer die Auskunft bestellt und nicht bezahlt hat.", typ: "eins_null", vorgabe: "1", setzer: AUSKUNFT, leser: "fiaon-auskunft-erinnerung.ts", dienst: "mara" },
  { schluessel: "auskunft_erinnerung_pro_tag", gruppe: "mara_mail", label: "Auskunft: Erinnerungen je Tag", satz: "Deckel der Erinnerungsmails je Tag.", typ: "zahl", vorgabe: "50", min: 0, max: 200, setzer: AUSKUNFT, leser: "fiaon-auskunft-erinnerung.ts", dienst: "mara" },
  { schluessel: "auskunft_erinnerung_dauer_tage", gruppe: "mara_mail", label: "Auskunft: Abstand nach Tag 18", satz: "Danach alle N Tage weiter; 0 = Schluss nach Tag 18.", typ: "zahl", vorgabe: "7", min: 0, max: 60, setzer: AUSKUNFT, leser: "fiaon-auskunft-erinnerung.ts", dienst: "mara" },
  { schluessel: "rueckhol_pro_tag", gruppe: "mara_mail", label: "Rückholung je Tag", satz: "Deckel der Rückhol-Mails je Tag; 0 = aus.", typ: "zahl", vorgabe: "0", min: 0, max: 500, setzer: RUECKHOLUNG, leser: "fiaon-rueckholung.ts:rueckholLauf", dienst: "mara" },
  { schluessel: "rueckhol_s1_an", gruppe: "mara_mail", label: "Rückholung S1 frisch", satz: "Frische offene Bestellungen.", typ: "eins_null", vorgabe: "1", setzer: RUECKHOLUNG, leser: "fiaon-rueckholung.ts:segmentAn", dienst: "mara" },
  { schluessel: "rueckhol_s2_an", gruppe: "mara_mail", label: "Rückholung S2 behauptet", satz: "„Habe überwiesen“, nichts gebucht.", typ: "eins_null", vorgabe: "1", setzer: RUECKHOLUNG, leser: "fiaon-rueckholung.ts:segmentAn", dienst: "mara" },
  { schluessel: "rueckhol_s3_an", gruppe: "mara_mail", label: "Rückholung S3 Preis fehlt", satz: "Bestellung ohne Betrag.", typ: "eins_null", vorgabe: "0", setzer: RUECKHOLUNG, leser: "fiaon-rueckholung.ts:segmentAn", dienst: "mara" },
  { schluessel: "rueckhol_s4_an", gruppe: "mara_mail", label: "Rückholung S4 nie gemahnt", satz: "Offen, nie erinnert.", typ: "eins_null", vorgabe: "1", setzer: RUECKHOLUNG, leser: "fiaon-rueckholung.ts:segmentAn", dienst: "mara" },
  { schluessel: "rueckhol_s5_an", gruppe: "mara_mail", label: "Rückholung S5 Altbestand", satz: "Dauerpflege für den Altbestand.", typ: "eins_null", vorgabe: "0", setzer: RUECKHOLUNG, leser: "fiaon-rueckholung.ts:segmentAn", dienst: "mara" },
  { schluessel: "rueckhol_dauerpflege_abstand_tage", gruppe: "mara_mail", label: "Dauerpflege: Abstand", satz: "Tage zwischen zwei Dauerpflege-Mails (nie unter 21).", typ: "zahl", vorgabe: "28", min: 21, max: 120, setzer: RUECKHOLUNG, leser: "fiaon-rueckholung.ts:dauerpflegeAbstandTage", dienst: "mara" },
  // ── Mara · WhatsApp ───────────────────────────────────────────────────────
  { schluessel: "mara_wa_an", gruppe: "mara_whatsapp", label: "WhatsApp-Antworten", satz: "Mara antwortet im offenen Fenster — aus = sie schweigt.", typ: "an_aus", vorgabe: "an", setzer: KI, leser: "fiaon-whatsapp-mara.ts:einstellung", dienst: "mara" },
  { schluessel: "mara_wa_nachfass", gruppe: "mara_whatsapp", label: "WhatsApp-Nachfassen", satz: "Einmal nachfassen, 4–23 h nach seiner letzten Nachricht.", typ: "an_aus", vorgabe: "an", setzer: KI, leser: "fiaon-mara-nachfass.ts:nachfassLauf", dienst: "mara" },
  { schluessel: "mara_wa_nachfass_tag", gruppe: "mara_whatsapp", label: "Nachfassen je Tag", satz: "Deckel der Nachfass-Nachrichten je Tag.", typ: "zahl", vorgabe: "40", min: 0, max: 500, setzer: KI, leser: "fiaon-mara-nachfass.ts:nachfassLauf", dienst: "mara" },
  { schluessel: "auskunft_verkauf_wa_pro_tag", gruppe: "mara_whatsapp", label: "Auskunft: WhatsApp je Tag", satz: "Deckel der Auskunft-Vorlagen je Tag.", typ: "zahl", vorgabe: "20", min: 0, max: 200, setzer: AUSKUNFT, leser: "fiaon-auskunft-verkauf.ts:verkaufEinstellungen", dienst: "mara" },
  // ── Leitplanken ───────────────────────────────────────────────────────────
  { schluessel: "pruef_mara_an", gruppe: "leitplanken", label: "Prüf-Mara", satz: "Eine zweite KI prüft Maras und Aras’ Arbeit — Karten nur bei Auffälligem.", typ: "an_aus", vorgabe: "an", setzer: KI, leser: "fiaon-ki-pruefung.ts:pruefungTakt", dienst: "pruef" },
  { schluessel: "pruef_mara_quote", gruppe: "leitplanken", label: "Prüfquote je Kanal", satz: "Anteil in %: Telefon 100, Mail 20, WhatsApp 20 (Stichprobe).", typ: "json", vorgabe: JSON.stringify({ telefon: 100, mail: 20, whatsapp: 20 }), setzer: KI, leser: "fiaon-ki-pruefung.ts:pruefungTakt", dienst: "pruef", jsonPruefen: quoteJson },
  { schluessel: "frequenzbremse_an", gruppe: "leitplanken", label: "Empfänger-Bremse", satz: "Höchstens so viele Mails je Empfänger (Tag/Woche/Monat).", typ: "eins_null", vorgabe: "1", setzer: RUECKHOLUNG, leser: "fiaon-mail-frequenz.ts:bremseAn", dienst: "mara" },
  { schluessel: "frequenz_pro_tag", gruppe: "leitplanken", label: "Mails je Empfänger und Tag", satz: "Deckel je Empfänger und Tag.", typ: "zahl", vorgabe: "2", min: 0, max: 20, setzer: RUECKHOLUNG, leser: "fiaon-mail-frequenz.ts", dienst: "mara" },
  { schluessel: "frequenz_pro_woche", gruppe: "leitplanken", label: "Mails je Empfänger und Woche", satz: "Deckel je Empfänger und Woche.", typ: "zahl", vorgabe: "4", min: 0, max: 50, setzer: RUECKHOLUNG, leser: "fiaon-mail-frequenz.ts", dienst: "mara" },
  { schluessel: "frequenz_pro_monat", gruppe: "leitplanken", label: "Mails je Empfänger und Monat", satz: "Deckel je Empfänger und Monat.", typ: "zahl", vorgabe: "8", min: 0, max: 100, setzer: RUECKHOLUNG, leser: "fiaon-mail-frequenz.ts", dienst: "mara" },
  { schluessel: "inkasso_anruf_tage", gruppe: "leitplanken", label: "Anruf statt Mahnung ab Tag", satz: "Nach Stufe 3 plus N Tagen wird angerufen statt gemahnt.", typ: "zahl", vorgabe: "7", min: 0, max: 60, setzer: KI, leser: "fiaon-inkasso.ts:anrufPflichtTage", dienst: "mara" },
  { schluessel: "gruender_termin_pro_tag", gruppe: "leitplanken", label: "Termine bei Justin je Tag", satz: "Wählbare und buchbare Zeiten auf /justin je Tag.", typ: "zahl", vorgabe: "3", min: 1, max: 12, setzer: KI, leser: "fiaon-gruender-termin.ts:einstellungen", dienst: "mara" },
  { schluessel: "gruender_termin_vorlauf_stunden", gruppe: "leitplanken", label: "Termine bei Justin: Vorlauf", satz: "Frühestens in N Stunden — kein Anruf aus dem Nichts.", typ: "zahl", vorgabe: "4", min: 0, max: 72, setzer: KI, leser: "fiaon-gruender-termin.ts:einstellungen", dienst: "mara" },
  { schluessel: "gruender_termin_titel", gruppe: "leitplanken", label: "Termine bei Justin: Titel", satz: "Der Titel auf der Buchungsseite.", typ: "text", vorgabe: "Gründer & Geschäftsführer", maxZeichen: 60, setzer: KI, leser: "fiaon-gruender-termin.ts:einstellungen", dienst: "mara" },
  // ── Kasse ─────────────────────────────────────────────────────────────────
  { schluessel: "mara_aktion_tag_euro", gruppe: "kasse", label: "Deckel Mail-Aktion", satz: "KI-Kosten der Mail-Aktion je Tag in Euro.", typ: "zahl", vorgabe: "15", min: 0, max: 500, setzer: MARA_AKTION, leser: "fiaon-mara-aktion.ts:einstellungenLesen", dienst: "mara" },
  { schluessel: "mara_wa_tag_euro", gruppe: "kasse", label: "Deckel WhatsApp", satz: "KI-Kosten der WhatsApp-Antworten je Tag in Euro.", typ: "zahl", vorgabe: "30", min: 0, max: 200, setzer: KI, leser: "fiaon-whatsapp-mara.ts:einstellung", dienst: "mara" },
  { schluessel: "postmeister_tag_euro", gruppe: "kasse", label: "Deckel Postfach", satz: "KI-Kosten der Postfach-Antworten je Tag in Euro.", typ: "zahl", vorgabe: "35", min: 0, max: 200, setzer: KI, leser: "fiaon-postmeister-agent.ts:postmeisterTagEuro", dienst: "mara" },
  { schluessel: "pruef_mara_tag_euro", gruppe: "kasse", label: "Deckel Prüf-Mara", satz: "KI-Kosten der Prüfung je Tag in Euro.", typ: "zahl", vorgabe: "10", min: 0, max: 100, setzer: KI, leser: "fiaon-ki-pruefung.ts:pruefungTakt", dienst: "pruef" },
  // ── Aras · Telefon (Vertrag § 3) — Setzer POST /chef/ki/einstellung → einstellungSetzen (Team 1, über die Anbindung) ──
  { schluessel: "aras_an", gruppe: "aras", label: "Aras wählt", satz: "Ohne „an“ wählt Aras nicht (Probeanrufe gehen trotzdem).", typ: "an_aus", vorgabe: "aus", setzer: KI, leser: "fiaon-aras-waehler.ts:waehlerTakt", dienst: "aras" },
  { schluessel: "aras_leerlauf", gruppe: "aras", label: "Leerlauf", satz: "Kein neues Wählen, laufende Gespräche enden normal (vor jedem Deploy).", typ: "an_aus", vorgabe: "aus", setzer: KI, leser: "fiaon-aras-waehler.ts:waehlerTakt", dienst: "aras" },
  { schluessel: "aras_adapter", gruppe: "aras", label: "Stimm-Technik", satz: "Welcher Anbieter spricht: openai_live (Standard) oder Rückfall.", typ: "enum", vorgabe: "openai_live", enum: ["openai_live", "openai_realtime", "kaskade_sonic", "attrappe"], setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_delegation", gruppe: "aras", label: "Werkzeug-Weg", satz: "responses = Hintergrund-Modell entscheidet, unser Code führt aus.", typ: "enum", vorgabe: "responses", enum: ["responses", "client"], setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_modell_stimme", gruppe: "aras", label: "Modell Stimme", satz: "Das Telefon-Modell (gpt-live-1).", typ: "text", vorgabe: "gpt-live-1", maxZeichen: 60, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_modell_gehirn", gruppe: "aras", label: "Modell Gehirn", satz: "Hintergrund-Modell für Werkzeuge; leer = Maras Modell.", typ: "text", vorgabe: "", maxZeichen: 60, setzer: KI, leser: "fiaon-aras-adapter-openai-live.ts", dienst: "aras" },
  { schluessel: "aras_stimme", gruppe: "aras", label: "Stimme", satz: "flitz (männlich), nuri, juni (weiblich) oder eigene:<name>.", typ: "text", vorgabe: "flitz", maxZeichen: 60, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_stimme_beschreibung", gruppe: "aras", label: "Stimme beschreiben", satz: "Freitext für eine eigene Stimme (nur ohne EU-Region).", typ: "text", vorgabe: "", maxZeichen: 400, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_name", gruppe: "aras", label: "Vorname", satz: "So stellt er sich vor: „Aras von FIAON“.", typ: "text", vorgabe: "Aras", maxZeichen: 40, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_nachname", gruppe: "aras", label: "Nachname", satz: "Leer = keiner (eine KI braucht keinen).", typ: "text", vorgabe: "", maxZeichen: 40, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_fuellwoerter", gruppe: "aras", label: "Füllwörter", satz: "„hm“, „also“, „genau“ — sparsam, normal oder viel.", typ: "enum", vorgabe: "normal", enum: ["sparsam", "normal", "viel"], setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_lachen", gruppe: "aras", label: "Kurzes Lachen", satz: "Nur als Antwort auf etwas Lustiges, nie als Einstieg.", typ: "an_aus", vorgabe: "an", setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_tempo", gruppe: "aras", label: "Tempo", satz: "Sprechtempo: ruhig, normal, zügig.", typ: "enum", vorgabe: "normal", enum: ["ruhig", "normal", "zuegig"], enumText: { zuegig: "zügig" }, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_zuhoerlaute", gruppe: "aras", label: "Zuhör-Laute", satz: "„mhm“, „ja“ während der Kunde spricht.", typ: "enum", vorgabe: "normal", enum: ["sparsam", "normal"], setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  // E-409 × E-408 (20.10.2026): die zwei Ton-Regler aus Aras Teil 1 (shared/fiaon-aras.ts ARAS_SCHLUESSEL, Nachtrag
  // „Persona & Skalierung“) — derselbe Schlüssel wie auf der Probe-Seite, dieselben Werte; gesetzt über Team 1s Setzer.
  { schluessel: "aras_energie", gruppe: "aras", label: "Energie", satz: "Wie viel Schwung: ruhig, lebendig oder Vollgas — erst nach dem Test.", typ: "enum", vorgabe: "lebendig", enum: ["ruhig", "lebendig", "vollgas"], enumText: { vollgas: "Vollgas" }, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_abschluss", gruppe: "aras", label: "Nachfragen nach einem Nein", satz: "sanft 0, klar 1, hartnäckig 2 — nie 3.", typ: "enum", vorgabe: "klar", enum: ["sanft", "klar", "hartnaeckig"], enumText: { hartnaeckig: "hartnäckig" }, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_ki_hinweis_satz", gruppe: "aras", label: "Erster Satz (KI-Hinweis)", satz: "Pflicht nach KI-VO Art. 50 — muss „KI“ oder „digitale“ enthalten.", typ: "text", vorgabe: ARAS_KI_HINWEIS_VORGABE, maxZeichen: 400, muss: /\b(?:KI|digitale)\b/, mussText: "Der Satz muss „KI“ oder „digitale“ enthalten.", setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_aufnahme_frage", gruppe: "aras", label: "Aufnahme-Frage", satz: "Aufnahme nur nach hörbarem Ja — der Satz muss „Ja“ enthalten.", typ: "text", vorgabe: ARAS_AUFNAHME_FRAGE_VORGABE, maxZeichen: 400, muss: /\bJa\b/, mussText: "Der Satz muss „Ja“ enthalten.", setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_spielarten", gruppe: "aras", label: "Spielarten", satz: "Welche Gesprächsarten Aras führt (lead/stufe_b/rueckholung erst nach LEXR).", typ: "json", vorgabe: JSON.stringify(ARAS_SPIELARTEN_VORGABE), setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras", jsonPruefen: spielartenJson },
  { schluessel: "aras_parallel", gruppe: "aras", label: "Gleichzeitig", satz: "Höchstens so viele Gespräche zugleich (1–5).", typ: "zahl", vorgabe: "2", min: 1, max: 5, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_je_stunde", gruppe: "aras", label: "Wählversuche je Stunde", satz: "Deckel der Wählversuche je Stunde.", typ: "zahl", vorgabe: "40", min: 1, max: 120, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_fenster", gruppe: "aras", label: "Zeitfenster", satz: "Mo–Fr 09–19, Sa 10–16 (Verkauf); Raten Mo–Fr. Nie Sonntag.", typ: "json", vorgabe: JSON.stringify(ARAS_FENSTER_VORGABE), setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras", jsonPruefen: fensterJson },
  { schluessel: "aras_raten_takte", gruppe: "aras", label: "Raten-Takte", satz: "Tage nach Fälligkeit, an denen Aras anruft: [3,10,20].", typ: "json", vorgabe: JSON.stringify([3, 10, 20]), setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras", jsonPruefen: taktJson },
  { schluessel: "aras_je_person_tag", gruppe: "aras", label: "Versuche je Person und Tag", satz: "Mensch und Aras zusammen gezählt.", typ: "zahl", vorgabe: "1", min: 1, max: 2, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_je_person_woche", gruppe: "aras", label: "Versuche je Person und Woche", satz: "Mensch und Aras zusammen gezählt.", typ: "zahl", vorgabe: "3", min: 1, max: 5, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_versuche_ende", gruppe: "aras", label: "Serie ohne Erreichen", satz: "Nach so vielen Fehlversuchen: 7 Tage Pause, anderer Kanal.", typ: "zahl", vorgabe: "6", min: 1, max: 10, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_mailbox_nachricht", gruppe: "aras", label: "Mailbox-Nachricht", satz: "Aus = auflegen ohne Nachricht (Dritte könnten mithören).", typ: "an_aus", vorgabe: "aus", setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_eingehend_modus", gruppe: "aras", label: "Eingehend", satz: "aus · nach_team (Team zuerst, dann Aras) · immer (Aras nimmt ab).", typ: "enum", vorgabe: "nach_team", enum: ["aus", "nach_team", "immer"], setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_uebergabe", gruppe: "aras", label: "Übergabe an Menschen", satz: "{ rate: [Ids], verkauf: [Ids], sonst: \"betreuer\" }.", typ: "json", vorgabe: JSON.stringify({ sonst: "betreuer" }), setzer: KI, leser: "fiaon-aras-werkzeuge.ts:mensch_verbinden", dienst: "aras", jsonPruefen: uebergabeJson },
  { schluessel: "aras_probe_nummer", gruppe: "aras", label: "Probe-Nummer", satz: "Die einzige Nummer für Probeanrufe (deine, E.164).", typ: "text", vorgabe: "", maxZeichen: 20, muss: /^(?:\+(?:49|43|41)\d{6,14})?$/, mussText: "E.164 aus DE/AT/CH, z. B. +4915112345678 — oder leer.", setzer: KI, leser: "fiaon-aras-nachbereitung.ts:probeanruf", dienst: "aras", geheim: true },
  { schluessel: "aras_lernen_an", gruppe: "aras", label: "Wochen-Lernvorschlag", satz: "Sonntags ein Vorschlag zur Stundenverteilung — nur Anzeige.", typ: "an_aus", vorgabe: "an", setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_caller_id_at", gruppe: "aras", label: "Absendernummer AT", satz: "Leer = die deutsche Nummer (ARAS_CALLER_ID).", typ: "text", vorgabe: "", maxZeichen: 20, muss: /^(?:\+43\d{6,14})?$/, mussText: "E.164 aus AT oder leer.", setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_caller_id_ch", gruppe: "aras", label: "Absendernummer CH", satz: "Nur eine im Schweizer Verzeichnis eingetragene Nummer (UWG).", typ: "text", vorgabe: "", maxZeichen: 20, muss: /^(?:\+41\d{6,14})?$/, mussText: "E.164 aus CH oder leer.", setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
  { schluessel: "aras_tag_euro", gruppe: "kasse", label: "Deckel Aras", satz: "KI + Telefon je Tag in Euro — davor wählt Aras nicht mehr.", typ: "zahl", vorgabe: "60", min: 0, max: 300, setzer: KI, leser: "fiaon-aras.ts:einstellungenAnwenden", dienst: "aras" },
];

/**
 * DER NOT-AUS (E-409 Funde 2 + 9, 20.10.2026): ALLE Wege, auf denen Mara selbst handelt — „Mara anhalten“ stellt sie
 * in einem Zug auf „aus“, „Wieder an“ stellt GENAU den Stand von vorher her (server/lib/fiaon-ki-einstellungen.ts).
 * vorgabeAn = was gilt, wenn der Schlüssel fehlt.
 */
export const NOTAUS_SCHALTER: readonly { schluessel: string; label: string; vorgabeAn: boolean }[] = [
  { schluessel: "mara_aktion_an", label: "Mail-Aktion", vorgabeAn: true },
  { schluessel: "mara_wa_an", label: "WhatsApp-Antworten", vorgabeAn: true },
  { schluessel: "postmeister_an", label: "Postfach", vorgabeAn: true },
  { schluessel: "mara_wa_nachfass", label: "WhatsApp-Nachfassen", vorgabeAn: true },
  { schluessel: "mara_nicht_erreicht_mail", label: "Nachfass-Mail nach 2× nicht erreicht", vorgabeAn: true },
  { schluessel: "mara_rate_erinnerung", label: "Raten-Mail (frisch fällig)", vorgabeAn: true },
  { schluessel: "mara_anliegen", label: "Anliegen beantworten", vorgabeAn: true },
  { schluessel: "mara_nacharbeit_mail", label: "Zusammenfassung nach dem Anruf", vorgabeAn: true },
  { schluessel: "mara_kyc_nachfordern", label: "Unterlagen nachfordern", vorgabeAn: true },
  { schluessel: "unterlagen_umhaengen", label: "Prüf-Aufgaben umhängen", vorgabeAn: false },
];

/**
 * ARAS IM SELBEN NOT-AUS (E-409 × E-408, 20.10.2026): Aras hat GENAU EINEN Not-Aus-Schlüssel — aras_notaus aus seinem
 * Kern (an = angehalten). Der KI-Team-Not-Aus schreibt ihn nicht selbst, sondern ruft Team 1s waehler.notaus / .start
 * über die Anbindung (laufende Gespräche enden mit dem Abschiedssatz, notausAlle). aras_an ist der Betriebsschalter —
 * den fasst der Not-Aus nicht an. Darum steht aras_notaus auch NICHT im Register (kein zweiter Knopf für denselben Schlüssel).
 */
export const ARAS_NOTAUS = "aras_notaus";

/** Die Schlüssel, die POST /chef/ki/einstellung SELBST schreibt (ohne ARAS — die gehen über die Anbindung). */
export const KI_SCHLUESSEL: readonly string[] = REGISTER.filter((e) => e.setzer.route === KI.route && e.dienst !== "aras").map((e) => e.schluessel);
/** Alle aras_*-Schlüssel — gesetzt über einstellungSetzen (Team 1), erreicht über POST /chef/ki/einstellung. */
export const ARAS_SCHLUESSEL: readonly string[] = REGISTER.filter((e) => e.dienst === "aras").map((e) => e.schluessel);

/** E-409 Fund 11: eine Nummer verdecken — nur die letzten 3 Ziffern („••• 678“). Leer bleibt leer. Rein. */
export function nummerMaskiert(n: string | null | undefined): string {
  const ziffern = String(n ?? "").replace(/\D/g, "");
  return ziffern ? `••• ${ziffern.slice(-3)}` : "";
}

/** Der Wert, wie er in Anzeige, Chef-Protokoll und Log stehen darf (geheime Schlüssel verdeckt). Rein. */
export function wertOeffentlich(schluessel: string, wert: string | null | undefined): string {
  const e = REGISTER.find((x) => x.schluessel === schluessel);
  return e?.geheim ? nummerMaskiert(wert) : String(wert ?? "");
}

export function registerEintrag(schluessel: string): RegisterEintrag | null {
  return REGISTER.find((e) => e.schluessel === schluessel) ?? null;
}

/** Der Setzer eines Schlüssels — null, wenn er nicht im Register steht. */
export function registerSetzer(schluessel: string): Setzer | null {
  return registerEintrag(schluessel)?.setzer ?? null;
}

/** Den Anzeigewert normieren (an/aus, 1/0) — rein. */
export function wertAnzeige(e: RegisterEintrag, roh: unknown): string {
  const w = roh == null ? "" : String(roh).trim();
  if (!w) return e.vorgabe;
  if (e.typ === "an_aus") return /^(an|1|true|ja)$/i.test(w) ? "an" : "aus";
  if (e.typ === "eins_null") return /^(an|1|true|ja)$/i.test(w) ? "1" : "0";
  return w;
}

/**
 * Prüft einen Wert gegen das Register — die EINE Grenze für Oberfläche und Route.
 * Liefert den normierten Wert oder den Fehlersatz. Rein.
 */
export function wertPruefen(e: RegisterEintrag, roh: unknown): { ok: true; wert: string } | { ok: false; fehler: string } {
  const w = roh == null ? "" : String(roh).trim();
  switch (e.typ) {
    case "an_aus":
      if (/^(an|1|true|ja)$/i.test(w)) return { ok: true, wert: "an" };
      if (/^(aus|0|false|nein)$/i.test(w)) return { ok: true, wert: "aus" };
      return { ok: false, fehler: "Erlaubt sind an und aus." };
    case "eins_null":
      if (/^(an|1|true|ja)$/i.test(w)) return { ok: true, wert: "1" };
      if (/^(aus|0|false|nein)$/i.test(w)) return { ok: true, wert: "0" };
      return { ok: false, fehler: "Erlaubt sind 1 (an) und 0 (aus)." };
    case "zahl": {
      if (!/^-?\d{1,7}$/.test(w)) return { ok: false, fehler: "Bitte eine ganze Zahl." };
      const n = Number(w);
      if (e.min != null && n < e.min) return { ok: false, fehler: `Mindestens ${e.min}.` };
      if (e.max != null && n > e.max) return { ok: false, fehler: `Höchstens ${e.max}.` };
      return { ok: true, wert: String(n) };
    }
    case "enum":
      if (!e.enum?.includes(w)) return { ok: false, fehler: `Erlaubt: ${(e.enum ?? []).join(", ")}.` };
      return { ok: true, wert: w };
    case "text": {
      const t = w.replace(/[\r\n<>]/g, " ").replace(/\s+/g, " ").trim();
      if (e.maxZeichen != null && t.length > e.maxZeichen) return { ok: false, fehler: `Höchstens ${e.maxZeichen} Zeichen.` };
      if (e.muss && !e.muss.test(t)) return { ok: false, fehler: e.mussText ?? "Der Wert passt nicht." };
      return { ok: true, wert: t };
    }
    case "json": {
      let o: unknown;
      try { o = JSON.parse(w || "null"); } catch { return { ok: false, fehler: "Kein gültiges JSON." }; }
      if (o == null) return { ok: false, fehler: "Leer ist nicht erlaubt — die Vorgabe steht im Tooltip." };
      const f = e.jsonPruefen?.(o) ?? null;
      if (f) return { ok: false, fehler: f };
      return { ok: true, wert: JSON.stringify(o) };
    }
  }
}

/** Den Körper für den Setzer bauen — rein; die Oberfläche und der Prüfstand nutzen dieselbe Rechnung. */
export function setzerKoerper(e: RegisterEintrag, wert: string): Record<string, unknown> {
  switch (e.setzer.form) {
    case "schluessel_wert": return { schluessel: e.schluessel, wert };
    case "key_value": return { key: e.schluessel, value: wert };
    case "an_boolean": return { an: wert === "an" || wert === "1" };
    case "altbestand_boolean": return { altbestand: wert === "an" || wert === "1" };
  }
}

/** Grenze und Vorgabe als kurzer Tooltip-Text. Rein. */
export function grenzeText(e: RegisterEintrag): string {
  const teile: string[] = [`Vorgabe: ${e.vorgabe === "" ? "leer" : e.vorgabe.length > 60 ? `${e.vorgabe.slice(0, 57)}…` : e.vorgabe}`];
  if (e.typ === "zahl") teile.push(`Grenze: ${e.min ?? "–"} bis ${e.max ?? "–"}`);
  if (e.typ === "enum") teile.push(`Erlaubt: ${(e.enum ?? []).join(", ")}`);
  if (e.typ === "text" && e.maxZeichen) teile.push(`höchstens ${e.maxZeichen} Zeichen`);
  if (e.mussText) teile.push(e.mussText);
  teile.push(`Setzer: ${e.setzer.route}`, `Leser: ${e.leser}`);
  return teile.join(" · ");
}
