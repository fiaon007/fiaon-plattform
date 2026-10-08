// ═══════════════════════════════════════════════════════════════════════════
// AUFTRÄGE: ARTEN, EREIGNISSE, REIHENFOLGE, ANZEIGE — EINE QUELLE
// E-IT-F (08.10.2026), Punkte (6) bis (9) aus dem IT-Feedback
//
// ── DER BEFUND (gemessen 07.10.2026, nur lesend) ───────────────────────────
// 608 offene Aufträge beim Team. 53 % zeigten keinen Kundennamen, weil die
// Tabelle keinen Kunden kannte — der Name wurde aus dem Link geraten, und der
// Rater kannte die häufigste Linkform (/agent/kunden?person=…) nicht. Sortiert
// wurde nach Priorität und Fälligkeit, beide waren entwertet (64 % „dringend",
// 90 % überfällig), der Eingang war unsichtbar. Erledigt wurde fast nur in
// Schüben per Hand: 29 % der offenen Aufträge hatten nach ihrer Anlage schon
// ein Gesprächsergebnis, einen geführten Termin oder eine WhatsApp-Antwort in
// der Akte — geschlossen hatte sie niemand, weil kein Ereignis „seine"
// Aufträge finden konnte.
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
// Was Server UND Oberfläche gleich wissen müssen, an EINEM Ort:
//   · AUFTRAG_ARTEN: je Art Beschriftung, ob nur von Hand geschlossen werden
//     darf (Recht, Geld, Vorgänge), ob ein Ergebnissatz Pflicht ist, und bei
//     welchen Ereignissen in der Akte sie AUTOMATISCH erledigt ist.
//   · auftragArtVon(): die Art aus Schlüssel, Quelle und Titel — für alle rund
//     30 Wege, die Aufträge anlegen, ohne dass jeder Weg sie kennen muss.
//   · kundeAusAuftrag(): Person, Referenz und Mail-Marke aus Link und
//     Schlüssel — in der Reihenfolge, die keinen falschen Kunden erzeugt.
//   · auftraegeSortieren() / naechsterAuftrag(): die EINE Reihenfolge der
//     Liste, des „nächsten Auftrags" und der Akte-Leiste.
//   · auftragStatus() und eingangText(): was in den Spalten „Status" und
//     „Eingang" steht.
//
// Justins Entscheidungen vom 08.10.2026, hier umgesetzt:
//   · Reihenfolge: dringend zuerst, innerhalb nach Eingang die ÄLTESTEN zuerst;
//     umschaltbar auf „neueste zuerst"; der Eingang ist immer sichtbar.
//   · Spalten Kunde · Art · Eingang · Status; der Kundenname steht immer da.
//   · Automatische Erledigung über definierte Ereignisse — je Art hier eine
//     Zuordnung; im Verlauf steht „Automatisch erledigt durch …".
// ═══════════════════════════════════════════════════════════════════════════

import { ERGEBNIS_LISTE } from "./fiaon-kontakt-ergebnis-liste";

/** Ereignisse in der Akte, die Aufträge automatisch erledigen können. */
export const AUFTRAG_EREIGNISSE = {
  ergebnis_erreicht: { label: "Gesprächsergebnis erfasst" },
  /** Schließt NIE — steht nur als Versuch im Verlauf des Auftrags. */
  ergebnis_versuch: { label: "Anrufversuch ohne Erfolg" },
  rueckruf_erledigt: { label: "Rückruf erledigt" },
  termin_gefuehrt: { label: "Termin geführt" },
  whatsapp_beantwortet: { label: "Per WhatsApp geantwortet" },
  zahlung_gebucht: { label: "Zahlung gebucht" },
  kartenlink_gesendet: { label: "Kartenlink gesendet" },
  unterlage_angefordert: { label: "Unterlage angefordert" },
  unterlage_erhalten: { label: "Unterlage erhalten" },
} as const;
export type AuftragEreignis = keyof typeof AUFTRAG_EREIGNISSE;

export function istAuftragEreignis(v: unknown): v is AuftragEreignis {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(AUFTRAG_EREIGNISSE, v);
}

export interface AuftragArtRegel {
  /** Spalte „Art" — kurz, wie ein Mitarbeiter es sagen würde. */
  label: string;
  /**
   * true = nur ein Mensch schließt (Recht, Geld, Vorgänge mit eigener Strecke).
   * Kein Ereignis in der Akte und kein Sammel-Erledigen fasst sie an.
   */
  nurHand: boolean;
  /** true = „Erledigt" braucht einen Satz, was herausgekommen ist (Server prüft). */
  ergebnisPflicht: boolean;
  /**
   * true = ein Lage-Auftrag: Der Erzeuger meldet ihn erneut, solange die Lage
   * besteht (Adresse unzustellbar, Einladung fehlt). Er öffnet einen erledigten
   * Auftrag dann erst nach ZUSTAND_WIEDER_OFFEN_TAGE wieder — sichtbar, mit Grund.
   */
  zustand: boolean;
  /** Bei diesen Ereignissen ist der Auftrag automatisch erledigt. */
  schliesstBei: readonly AuftragEreignis[];
  /**
   * Woran ein Ereignis „seinen" Auftrag erkennt: an der Person (Standard) oder
   * an der Bestellung (Zahlung einer bestimmten Bestellung).
   */
  bezug: "person" | "ref";
  /**
   * Nur schließen, wenn für den Kunden KEIN Antwortentwurf von Mara mehr wartet —
   * sonst sendet die Zentrale ihn später doch noch (E-244).
   */
  nurOhneOffenenEntwurf?: boolean;
  /**
   * true = Recht mit Frist (Kündigung, Widerruf, Beschwerde, Löschantrag, Eskalation):
   * steht in der Reihenfolge vor allem anderen beim Mitarbeiter — auch vor
   * dringenden Altfällen (Gegenprüfung 08.10.: Widerrufs- und DSGVO-Fristen).
   */
  frist?: boolean;
}

const KONTAKT: readonly AuftragEreignis[] = ["ergebnis_erreicht", "rueckruf_erledigt", "termin_gefuehrt", "whatsapp_beantwortet"];
/**
 * Ein Rückrufwunsch (und Maras Hinweis) ist erst mit einem GESPRÄCH erledigt — eine WhatsApp-Zeile
 * („Ich rufe Sie morgen an“) ist kein Rückruf (Gegenprüfung 08.10.: Justins Liste kennt sie dafür nicht).
 */
const GESPRAECH: readonly AuftragEreignis[] = ["ergebnis_erreicht", "rueckruf_erledigt", "termin_gefuehrt"];

/**
 * Ein Kontakt (Gespräch, Rückruf, Termin, WhatsApp) schließt nur Aufträge, die beim
 * Handelnden SELBST liegen (Gegenprüfung 08.10.: Forderungsmanagement oder Leitung
 * schlossen Maras Aufträge des Betreuers, über deren Anliegen nie gesprochen wurde).
 * Bei fremden Aufträgen steht nur ein Beitrag „Kontakt durch … – bitte prüfen".
 * Tatsachen (Zahlung, Unterlage, Kartenlink) gelten unabhängig davon, wer sie auslöst.
 */
export function istKontaktEreignis(e: AuftragEreignis): boolean {
  return KONTAKT.includes(e);
}

export const AUFTRAG_ARTEN = {
  mara_mail: { label: "Kunde hat geschrieben (E-Mail)", nurHand: false, ergebnisPflicht: false, zustand: false,
    schliesstBei: GESPRAECH, bezug: "person", nurOhneOffenenEntwurf: true },
  // Übergabe mit einem Grund, den ein Gespräch nicht erledigt (Beschwerde, Widerruf, bestreitet, rechtlich,
  // Kündigung angesprochen, kann nicht zahlen, braucht einen Menschen, Global) — E-244 lässt sie beim
  // Senden offen; Justins Regel: Heikles schließt nie das System (Gegenprüfung 08.10.).
  mara_mail_heikel: { label: "Kunde hat geschrieben: Beschwerde, Widerruf o. Ä.", nurHand: true, ergebnisPflicht: true, zustand: false, schliesstBei: [], bezug: "person" },
  mara_rueckruf: { label: "Rückruf oder Klärung (Mara)", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: GESPRAECH, bezug: "person" },
  // Eine konkrete Handlung („Adresse ändern", „Abmeldung umsetzen") — ein Gespräch
  // allein heißt nicht, dass sie getan ist. Deshalb kein Ereignis, nur der Knopf.
  mara_aufgabe: { label: "Aufgabe von Mara", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
  mara_hinweis: { label: "Hinweis von Mara", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: GESPRAECH, bezug: "person" },
  // Kein „Unterlage erhalten": Ein Ausweis oder Kontoauszug liefert keine Auskunft, und eine
  // EIGENE Auskunft des Kunden heißt „Leistung klären" (Entscheidung 4a) — nur ein Beitrag.
  mara_auskunft: { label: "Bonitätsauskunft fehlt", nurHand: false, ergebnisPflicht: false, zustand: false,
    schliesstBei: ["ergebnis_erreicht"], bezug: "person" },
  // Die Auskunft ist bezahlt oder die Zahlung gemeldet (74-€-Rückstand, Entscheidung 4a): Erledigt ist
  // das erst, wenn die Leistung geliefert bzw. das Geld geklärt ist — kein Gespräch, kein Upload schließt.
  auskunft_lieferung: { label: "Bonitätsauskunft: Lieferung oder Zahlung klären", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
  mara_eskalation: { label: "Zahlung verweigert – Anruf vor Eskalation", nurHand: true, ergebnisPflicht: true, zustand: false, schliesstBei: [], bezug: "person", frist: true },
  mara_wa_anliegen: { label: "WhatsApp: Anliegen", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: KONTAKT, bezug: "person" },
  mara_wa_rueckruf: { label: "WhatsApp: Rückrufwunsch", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: GESPRAECH, bezug: "person" },
  mara_wa_pruefung: { label: "WhatsApp: Mara war unsicher", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: KONTAKT, bezug: "person" },
  mara_wa_heikel: { label: "WhatsApp: Kündigung, Widerruf, Beschwerde", nurHand: true, ergebnisPflicht: true, zustand: false, schliesstBei: [], bezug: "person", frist: true },
  mara_wa_geld: { label: "WhatsApp: Zahlung oder Geld", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
  unzustellbar_erstzahlung: { label: "Erstzahlung: E-Mail unzustellbar", nurHand: false, ergebnisPflicht: true, zustand: true, schliesstBei: ["zahlung_gebucht"], bezug: "ref" },
  // Eine bezahlte Rate heilt die Adresse NICHT: Für die nächste Rate geht wieder keine Mail raus
  // (UNZUSTELLBAR_SQL). Zu ist der Auftrag erst, wenn ein Mensch die Adresse geklärt hat — mit Satz.
  // (Bei der Erstzahlung oben ist die Zahlung das Ende der Sache: danach keine Erstzahlungs-Mail mehr.)
  unzustellbar_rate: { label: "Rate: E-Mail unzustellbar", nurHand: false, ergebnisPflicht: true, zustand: true, schliesstBei: [], bezug: "ref" },
  einladung_fehlt: { label: "Einladung zum Startgespräch fehlt", nurHand: false, ergebnisPflicht: true, zustand: true,
    schliesstBei: ["ergebnis_erreicht", "termin_gefuehrt"], bezug: "person" },
  unterlage: { label: "Unterlage anfordern", nurHand: false, ergebnisPflicht: false, zustand: false,
    schliesstBei: ["unterlage_angefordert", "unterlage_erhalten"], bezug: "person" },
  konto_karte: { label: "Konto & Karte", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: ["kartenlink_gesendet"], bezug: "person" },
  kontakt: { label: "Kontaktanfrage", nurHand: false, ergebnisPflicht: false, zustand: false, schliesstBei: ["ergebnis_erreicht", "rueckruf_erledigt"], bezug: "person" },
  loeschantrag: { label: "Löschantrag an die Auskunftei", nurHand: true, ergebnisPflicht: true, zustand: false, schliesstBei: [], bezug: "ref", frist: true },
  kuendigung: { label: "Kündigung oder Widerruf", nurHand: true, ergebnisPflicht: true, zustand: false, schliesstBei: [], bezug: "person", frist: true },
  beschwerde: { label: "Beschwerde, Recht, Löschung oder Erstattung", nurHand: true, ergebnisPflicht: true, zustand: false, schliesstBei: [], bezug: "person", frist: true },
  vorgang: { label: "Vorgang im Kundenbereich", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
  zahlung: { label: "Zahlung prüfen", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "ref" },
  auskunft: { label: "Bonitätsauskunft beschaffen", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "ref" },
  global: { label: "FIAON Global", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "ref" },
  bewerbung: { label: "Bewerbung", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
  hand: { label: "Von Hand übergeben", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
  verwaltung: { label: "Verwaltung", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
  sonstiges: { label: "Sonstiges", nurHand: true, ergebnisPflicht: false, zustand: false, schliesstBei: [], bezug: "person" },
} as const satisfies Record<string, AuftragArtRegel>;

export type AuftragArt = keyof typeof AUFTRAG_ARTEN;
export const AUFTRAG_ART_LISTE = Object.keys(AUFTRAG_ARTEN) as AuftragArt[];

export function istAuftragArt(v: unknown): v is AuftragArt {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(AUFTRAG_ARTEN, v);
}

export function artRegel(art: unknown): AuftragArtRegel {
  return istAuftragArt(art) ? AUFTRAG_ARTEN[art] : AUFTRAG_ARTEN.sonstiges;
}

/**
 * Ein Gesprächsergebnis (Akte, Telefon, Telefonkartei, WhatsApp-Raum) als Ereignis.
 * Abgeleitet aus der EINEN Ergebnisliste (shared/fiaon-kontakt-ergebnis-liste.ts),
 * nicht aus einer zweiten Aufzählung: „erreicht…" und der vereinbarte Rückruf
 * (das Ergebnis, das einen Termin braucht) sind ein Kontakt; was den Kunden
 * abgibt (blockiert), ist keins; alles andere ist ein Versuch ohne Erfolg.
 */
export function ereignisAusErgebnis(ergebnis: string | null | undefined): AuftragEreignis | null {
  const a = ERGEBNIS_LISTE.find((x) => x.art === ergebnis);
  if (!a) return null;
  if (a.art.startsWith("erreicht") || a.braucht === "termin") return "ergebnis_erreicht";
  if (a.gibtAb) return null;
  return "ergebnis_versuch";
}

/** Ein Ratenergebnis aus dem Forderungsmanagement (fiaon-inkasso.ts) — Kontakt, Versuch oder nichts. */
export function ereignisAusRatenErgebnis(ergebnis: string | null | undefined): AuftragEreignis | null {
  const e = String(ergebnis || "");
  if (e === "zahlt_am" || e === "ueberwiesen_beleg" || e === "ratenpause" || e === "eskalation") return "ergebnis_erreicht";
  if (e === "nicht_erreicht") return "ergebnis_versuch";
  return null;
}

/** Welche Arten schließt dieses Ereignis? (nie eine nurHand-Art) */
export function artenFuerEreignis(e: AuftragEreignis): AuftragArt[] {
  return AUFTRAG_ART_LISTE.filter((a) => {
    const r: AuftragArtRegel = AUFTRAG_ARTEN[a];
    return !r.nurHand && r.schliesstBei.includes(e);
  });
}

/**
 * Passt die erhaltene/angeforderte Unterlage zum Auftrag „Unterlage anfordern"?
 * Gegenprüfung 08.10.: Ein Ausweis schloss „Kontoauszug fehlt". Jetzt nur, wenn eine Unterlage aus
 * dem Ereignis im Titel steht (nennt der Titel keine, im Text). Nennt der Auftrag keine bekannte
 * Unterlage, schließt nichts — lieber offen mit Beitrag als still erledigt.
 */
const UNTERLAGE_TYPEN: { typ: string; wort: RegExp }[] = [
  { typ: "kontoauszug", wort: /kontoausz/i },
  { typ: "ausweis", wort: /(ausweis|reisepass|aufenthaltstitel)/i },
  { typ: "auskunft", wort: /(bonitätsauskunft|schufa|selbstauskunft|datenkopie)/i },
];
function unterlageTypen(s: string): Set<string> {
  return new Set(UNTERLAGE_TYPEN.filter((u) => u.wort.test(s)).map((u) => u.typ));
}
export function unterlagePasst(auftrag: { titel?: string | null; text?: string | null }, detail: string | null | undefined): boolean {
  const kam = unterlageTypen(String(detail || ""));
  if (!kam.size) return false;
  let braucht = unterlageTypen(String(auftrag.titel || ""));
  if (!braucht.size) braucht = unterlageTypen(String(auftrag.text || ""));
  return Array.from(braucht).some((t) => kam.has(t));
}

/** Ein Lage-Auftrag öffnet sich frühestens nach so vielen Tagen wieder, wenn die Lage fortbesteht. */
export const ZUSTAND_WIEDER_OFFEN_TAGE = 7;

/** Ab wann ein Auftrag als „Altfall" gilt — nur für die Anzeige („vor 33 Tagen"). */
export const AUFTRAG_ALT_TAGE = 14;

// ───────────────────────────────────────────────────────────────────────────
// DIE ART AUS DEM, WAS JEDER AUFTRAG HAT
// ───────────────────────────────────────────────────────────────────────────

/** Titel, die einen Rückruf oder eine Klärung verlangen — keine konkrete Handlung. */
const RUECKRUF_WORTE = /(rückruf|zurückruf|zurückrufen|anrufen|\banruf\b|kontakt aufnehmen|melden|klären|nachfassen|bitte antworten)/i;
/** Titel mit einer konkreten Handlung, die ein Gespräch allein nicht erledigt. */
const HANDLUNG_WORTE = /(ändern|umsetzen|stornier|kündig|abmeld|widerruf|erstatt|gutschrift|löschen|sperren|buchen|überweis|zahlung|bezahlt)/i;
/** Recht mit Frist: nie durch ein Gespräch erledigt, vorn in der Reihenfolge (Gegenprüfung 08.10.). */
const RECHT_WORTE = /(beschwerde|beschwer(t|en)\b|anwalt|anwält|datenschutz|dsgvo|verbraucherzentrale)/i;
const UNTERLAGE_WORTE = /(kontoauszug|ausweis|unterlage|dokument|nachweis|gehaltsabrechnung|reisepass|aufenthaltstitel)/i;
const ANFORDERN_WORTE = /(anfordern|nachfordern|nachreichen|fehlt|fehlen|neu hochladen|bitte hochladen)/i;
const VERWALTUNG_QUELLEN = ["system", "meldung", "termintreue", "telefon-abgleich", "lead-motor", "ki-pause", "office-bau", "wa-pause"];

/** Die Auskunft ist bezahlt oder gemeldet (Wortlaut aus fiaon-postmeister-werkzeuge.ts, Stufen bezahlt/gemeldet/dokument). */
const AUSKUNFT_LIEFERUNG_TITEL = /die Bonitätsauskunft fehle/i;
const AUSKUNFT_LIEFERUNG_TEXT = /(ist die Auskunft bezahlt|Zahlung für die Auskunft gemeldet)/i;

// ── HEIKLES SCHLIESST NIE DAS SYSTEM (Justin, 08.10.2026; Gegenprüfung 08.10.) ──
/**
 * Die Übergabe-Gründe aus „Kunde hat geschrieben“ (UEBERGABE_GRUND in fiaon-postmeister-lauf.ts, wörtlich —
 * der Prüfstand gleicht sie ab), bei denen ein Gespräch die Sache erledigt: Es fehlte nur eine Antwort, es
 * war eilig, oder der Kunde wollte seinen Ansprechpartner sprechen. Jeder andere Grund (Beschwerde,
 * Widerruf, bestreitet, rechtlich, Kündigung angesprochen, kann nicht zahlen, braucht einen Menschen,
 * Vorgeschichte, Global) heißt „nur von Hand“.
 */
export const MAIL_GRUENDE_KONTAKT: readonly string[] = [
  "Mara hat einen Entwurf vorbereitet, aber nicht gesendet.",
  "Kunde wartet auf eine Antwort (Entwurf lag in der Zentrale)",
  "dringend",
  "Kunde möchte mit seinem Ansprechpartner sprechen",
];
/** Die Gründe der Blöcke „<Grund>. Betreff „…“ … [Mail #id]“ — dieselbe Lesart wie uebergabeBloecke. null = nicht lesbar. */
export function mailUebergabeGruende(text: string | null | undefined): string[] | null {
  const t = String(text || "");
  const gruende: string[] = [];
  const marke = /\[Mail #(\d+)\]/g;
  let start = 0;
  for (let m = marke.exec(t); m; m = marke.exec(t)) {
    const stueck = t.slice(start, m.index).trim();
    start = m.index + m[0].length;
    const i = stueck.indexOf(". Betreff „");
    if (i <= 0) return null;
    gruende.push(stueck.slice(0, i).trim());
  }
  if (!gruende.length || t.slice(start).trim()) return null;
  return gruende;
}
/** Trägt die Übergabe einen Grund, den ein Gespräch nicht erledigt? Unlesbarer Text gilt als heikel (lieber offen). */
export function mailUebergabeHeikel(text: string | null | undefined): boolean {
  if (!String(text || "").trim()) return false;
  const g = mailUebergabeGruende(text);
  return !g || g.some((x) => !MAIL_GRUENDE_KONTAKT.includes(x));
}

/**
 * Heikles im Titel ODER Text eines Auftrags, den sonst ein Kontakt schließen dürfte (Rückruf, Hinweis,
 * WhatsApp, Kontaktformular, Auskunft-Nachfassen): Kündigung/Widerruf/Storno → „kuendigung“, Beschwerde,
 * Recht, Bestreiten, Löschwunsch/DSGVO, Erstattung → „beschwerde“ — beide nur von Hand, mit Pflichtsatz.
 * Lieber ein Auftrag zu viel von Hand als ein Widerruf, der still zugeht. Nicht „Rückzahlung“: Das ist bei
 * uns meist die Rate des Kunden (Messung 08.10.: „sagt Rückzahlung zu“), keine Erstattung.
 */
// Fertigstellung 08.10. (Messung am Produktionsabzug): „möchte sein Starter-Abo beenden“, „Vertrag beenden“ ist eine
// Kündigung; „Löschung seiner Anfrage und Daten“, „Kontaktdaten gelöscht“, „nicht mehr kontaktiert werden“ ein
// Lösch- bzw. Werbewiderspruch; „rechtliche Schritte“, Gericht, Mahnbescheid Rechtliches. „\bgericht“ mit Wortgrenze —
// sonst träfe „eingerichtet“.
const KUENDIGUNG_WORTE = /(kündig|kuendig|widerruf|storn|(?:vertrag|abo|abonnement|mitgliedschaft|paket|starter|zusammenarbeit)\w*\s+(?:\S+\s+){0,3}beenden)/i;
const HEIKEL_WORTE = /(beschwer|anwalt|anwält|klage|widerspruch|widersprech|bestreit|betrug|betrüg|abzock|fake|polizei|strafanzeige|verbraucherzentrale|datenschutz|dsgvo|lösch|loesch|erstatt|geld\s+zurück|rechtlich|\bgericht|mahnbescheid|abmahn|schlichtung|bafin|nicht\s+mehr\s+kontaktiert|keine\s+(?:weitere[n]?\s+)?kontaktaufnahme|keinen\s+(?:weiteren\s+)?kontakt\s+mehr|in\s+ruhe\s+(?:ge)?lassen)/i;
export function heikelArt(s: string | null | undefined): "kuendigung" | "beschwerde" | null {
  // „Ankündigung“ (der Rate, des Termins) ist keine Kündigung.
  const t = String(s || "").replace(/an(kündig|kuendig)/gi, "");
  if (KUENDIGUNG_WORTE.test(t)) return "kuendigung";
  if (HEIKEL_WORTE.test(t)) return "beschwerde";
  return null;
}
/**
 * „Kunde hat geschrieben“ ist heikel, wenn ein Block einen heiklen GRUND trägt ODER der Inhalt (Betreff,
 * Zusammenfassung) Heikles nennt. Nachprüfung 08.10.: Der Sammelgrund „Kunde wartet auf eine Antwort
 * (Entwurf lag in der Zentrale)“ und „Ansprechpartner“ stehen VOR dem Kündigungs-/Widerrufszweig — #1835
 * (Betreff „Widerruf liegt lange vor“), #1854 (Anwalt), #1818 (bestreitet) wären sonst still zugegangen.
 */
export function mailUebergabeIstHeikel(z: { titel?: string | null; text?: string | null }): boolean {
  return mailUebergabeHeikel(z.text) || !!heikelArt(`${z.titel || ""}\n${z.text || ""}`);
}
/** Arten, die ein Kontakt schließen dürfte — bei ihnen entscheidet zusätzlich der Inhalt (heikelArt). */
const INHALT_PRUEFEN: readonly AuftragArt[] = ["mara_rueckruf", "mara_hinweis", "mara_wa_anliegen", "mara_wa_rueckruf", "mara_wa_pruefung", "kontakt", "mara_auskunft"];
/** WhatsApp-Klassen (AufgabenKlasse in fiaon-whatsapp-mara.ts), die ein Kontakt schließen darf — alle anderen nie. */
const WA_KONTAKT_KLASSEN = ["anliegen", "rueckruf", "pruefung", "ki", "pause", "deckel", "versand"];
/** Heikle WhatsApp-Klassen (HEIKLE_KLASSEN): Kündigung/Widerruf/Beschwerde, Bestreiten, Löschwunsch, „keinen Kontakt mehr“, Wut. */
const WA_HEIKEL_KLASSEN = ["heikel", "bestreitet", "loeschen", "in_ruhe", "wut"];

/**
 * Die strengere zweier Arten: Ist die gespeicherte Art automatisch schließbar, die jetzt abgeleitete aber
 * „nur von Hand“ (z. B. weil seit der Einordnung ein Widerruf angehängt wurde), gilt die abgeleitete.
 * Nie umgekehrt — ein Hand-Auftrag wird nie automatisch schließbar.
 */
export function artStrenger(gespeichert: unknown, abgeleitet: AuftragArt): AuftragArt {
  if (!istAuftragArt(gespeichert)) return abgeleitet;
  const g: AuftragArtRegel = AUFTRAG_ARTEN[gespeichert];
  const a: AuftragArtRegel = AUFTRAG_ARTEN[abgeleitet];
  return !g.nurHand && a.nurHand && !["sonstiges", "hand", "verwaltung"].includes(abgeleitet) ? abgeleitet : gespeichert;
}

/**
 * Die Art, die JETZT gilt — vor jedem automatischen Schließen und beim Erledigen von Hand: die gespeicherte
 * Art, gegengeprüft am heutigen Titel und Text (seit der Einordnung kann Heikles angehängt worden sein).
 * Die strengere gewinnt (artStrenger); eine gespeicherte Kontakt-Art mit heiklem Inhalt wird „nur von Hand“,
 * auch wenn Schlüssel oder Quelle für sich nichts mehr verraten.
 */
export function artNachInhalt(gespeichert: unknown, z: { schluessel?: string | null; quelle?: string | null; bereich?: string | null; titel?: string | null; text?: string | null }): AuftragArt {
  if (istAuftragArt(gespeichert)) {
    if (gespeichert === "mara_mail" && mailUebergabeIstHeikel(z)) return "mara_mail_heikel";
    if (INHALT_PRUEFEN.includes(gespeichert)) {
      const h = heikelArt(`${z.titel || ""}\n${z.text || ""}`);
      if (h) return h;
    }
  }
  return artStrenger(gespeichert, auftragArtVon(z));
}

export function auftragArtVon(z: { schluessel?: string | null; quelle?: string | null; bereich?: string | null; titel?: string | null; text?: string | null }): AuftragArt {
  const art = artAusSchluessel(z);
  if (INHALT_PRUEFEN.includes(art)) {
    const h = heikelArt(`${z.titel || ""}\n${z.text || ""}`);
    if (h) return h;
  }
  return art;
}

function artAusSchluessel(z: { schluessel?: string | null; quelle?: string | null; bereich?: string | null; titel?: string | null; text?: string | null }): AuftragArt {
  const k = String(z.schluessel || "");
  const q = String(z.quelle || "").trim().toLowerCase();
  const t = String(z.titel || "");
  const recht = RECHT_WORTE.test(t);
  if (/^postmeister:eskalation:/.test(k)) return "mara_eskalation";
  if (/^postmeister:antwort:/.test(k)) return mailUebergabeIstHeikel(z) ? "mara_mail_heikel" : "mara_mail";
  if (/^postmeister:auskunft:/.test(k)) {
    return AUSKUNFT_LIEFERUNG_TITEL.test(t) || AUSKUNFT_LIEFERUNG_TEXT.test(String(z.text || "")) ? "auskunft_lieferung" : "mara_auskunft";
  }
  if (/^wa-auskunft-/.test(k)) return "mara_auskunft";
  if (/^postmeister:kuendigung/.test(k)) return "kuendigung";
  // „Beschwerde – bitte zurückrufen" war ein Rückruf und schloss beim nächsten erreichten Anruf.
  if (recht && /^postmeister:/.test(k)) return "beschwerde";
  if (/^postmeister:[^:]+:aufgabe/.test(k)) return RUECKRUF_WORTE.test(t) && !HANDLUNG_WORTE.test(t) ? "mara_rueckruf" : "mara_aufgabe";
  if (/^postmeister:[^:]+:(\d{4}-\d{2}-\d{2}|hinweis)/.test(k)) return "mara_hinweis";
  const wa = k.match(/^wa-n?\d+-([a-z_]+)-\d{4}-\d{2}-\d{2}/);
  if (wa) {
    // Gegenprüfung 08.10.: Löschwunsch (DSGVO), Bestreiten, „keinen Kontakt mehr“ und Wut liefen als
    // „Anliegen“ und schlossen beim nächsten Kontakt. Jetzt eine ausdrückliche Liste je Richtung.
    if (WA_HEIKEL_KLASSEN.includes(wa[1])) return "mara_wa_heikel";
    if (wa[1] === "geld" || wa[1] === "rueckfrage") return "mara_wa_geld";
    if (wa[1] === "auskunft") return "mara_auskunft";
    if (wa[1] === "global") return "global";
    // Falsche Nummer und jede künftige Klasse: eine konkrete Handlung, kein Gespräch schließt sie.
    if (!WA_KONTAKT_KLASSEN.includes(wa[1])) return "mara_aufgabe";
    if (recht) return "beschwerde";
    if (wa[1] === "rueckruf") return "mara_wa_rueckruf";
    if (wa[1] === "pruefung") return "mara_wa_pruefung";
    return "mara_wa_anliegen";
  }
  if (/^wa-n?\d+-\d{4}-\d{2}-\d{2}/.test(k)) return recht ? "beschwerde" : "mara_wa_anliegen";
  if (/^antrag:[^:]+:unzustellbar/.test(k)) return "unzustellbar_erstzahlung";
  if (/^abo:[^:]+:unzustellbar/.test(k)) return "unzustellbar_rate";
  if (/^einladung-nachholen:/.test(k)) return "einladung_fehlt";
  if (/^bonitaet:[^:]+:loeschantrag/.test(k)) return "loeschantrag";
  if (/^(app-[a-z-]+|frist7|nachfass|eskalation):/.test(k)) return "vorgang";
  if (/^bewerbung:/.test(k)) return "bewerbung";
  if (/^global[a-z-]*:/.test(k) || q === "global") return "global";
  if (/^bank-(nachholen|unklar)/.test(k) || q === "bankbuch") return "zahlung";
  if (/^auskunft[a-z-]*:/.test(k) || q === "auskunft" || q === "bestellung") return "auskunft";
  if (/^kuendigung:/.test(k) || q === "kuendigung") return "kuendigung";
  if (recht && !VERWALTUNG_QUELLEN.includes(q) && !q.startsWith("claude")) return "beschwerde";
  if (q === "kontakt") return "kontakt";
  if (q === "postmeister" || q.startsWith("mara")) {
    if (/eskalation/i.test(t)) return "mara_eskalation";
    if (/^mara-termin/.test(k)) return "verwaltung";
    return RUECKRUF_WORTE.test(t) && !HANDLUNG_WORTE.test(t) ? "mara_rueckruf" : "mara_aufgabe";
  }
  if (UNTERLAGE_WORTE.test(t) && ANFORDERN_WORTE.test(t)) return "unterlage";
  if (/(konto\s*(&|und)\s*karte|kartenlink|karte\s+bestellen)/i.test(t)) return "konto_karte";
  if (/(kündig|widerruf)/i.test(t)) return "kuendigung";
  if (q === "hand") return "hand";
  if (VERWALTUNG_QUELLEN.includes(q) || q.startsWith("claude")) return "verwaltung";
  return "sonstiges";
}

// ───────────────────────────────────────────────────────────────────────────
// DER KUNDE AUS LINK UND SCHLÜSSEL — OHNE FALSCHEN TREFFER
//
// Die Reihenfolge ist die Sicherung (Gegenprüfung 07.10.2026): In
// „postmeister:<n>:aufgabe" ist <n> teils eine MAIL-Kennung (Rückfall
// k.postmeisterId) — bei 10 von 201 prüfbaren Aufträgen zeigte sie auf einen
// ANDEREN Menschen. Ein falscher Name samt Telefonnummer führt zum Anruf beim
// falschen Kunden. Deshalb wird <n> dort NIE als Person gelesen; sicher sind der
// Link, die Referenz, der WhatsApp-Schlüssel (dort steht immer die Person) und
// die Mail-Marke „[Mail #id]" im Text (über fiaon_postmeister.person_id).
// Unsicheres bleibt „ohne Kundenbezug", statt falsch benannt zu werden.
// ───────────────────────────────────────────────────────────────────────────

/** Die Kundenreferenz aus einem Link — /admin/kunde/<ref>, ?ref=<ref> oder irgendwo FIAON-… */
export function refAusLink(link: unknown): string | null {
  const l = String(link || "");
  const m = l.match(/[?&]ref=(FIAON-[A-Z0-9-]+)/i) || l.match(/\/kunde\/(FIAON-[A-Z0-9-]+)/i) || l.match(/(FIAON-[A-Z0-9]{6,}(?:-[A-Z0-9]+)*)/i);
  return m ? m[1].toUpperCase() : null;
}

export interface KundeKandidat {
  /** Person aus dem Link (?person=) oder dem WhatsApp-Schlüssel — muss noch existieren. */
  personId: number | null;
  personQuelle: "link" | "schluessel" | null;
  /** Referenz aus Link oder Schlüssel (antrag:/abo:/einladung-nachholen:/…:<ref>). */
  ref: string | null;
  /** „[Mail #id]" im Text — über fiaon_postmeister.person_id auflösbar. */
  mailId: number | null;
}

export function kundeAusAuftrag(z: { link?: string | null; schluessel?: string | null; text?: string | null }): KundeKandidat {
  const link = String(z.link || "");
  const k = String(z.schluessel || "");
  let personId: number | null = null;
  let personQuelle: KundeKandidat["personQuelle"] = null;
  const lp = link.match(/[?&]person=(\d+)/);
  if (lp) { personId = Number(lp[1]); personQuelle = "link"; }
  if (!personId) {
    // Mara auf WhatsApp: „wa-<person>-<Grund>-<Tag>" bzw. „wa-auskunft-<person>-<Tag>".
    // Ohne Person heißt er „wa-n<nummer>-…" und trifft hier nicht.
    const w = k.match(/^wa-(\d+)-/) || k.match(/^wa-auskunft-(\d+)-/);
    if (w) { personId = Number(w[1]); personQuelle = "schluessel"; }
  }
  let ref = refAusLink(link);
  if (!ref) {
    const r = k.match(/(FIAON-[A-Z0-9]+(?:-[A-Z0-9]+)*)/i);
    if (r) ref = r[1].toUpperCase();
  }
  const m = String(z.text || "").match(/\[Mail #(\d+)\]/);
  return { personId: personId && personId > 0 ? personId : null, personQuelle, ref, mailId: m ? Number(m[1]) : null };
}

/**
 * Ein Name, wenn es keinen Kunden gibt: „Bewerbung: Alexander K. — Produkt"
 * oder „Andrea Höfer: Hinweis von Mara" tragen ihn im Titel. Sonst null.
 */
export function nameAusTitel(titel: unknown): string | null {
  const t = String(titel || "").trim();
  const bewerbung = t.match(/^Bewerbung:\s+(.+?)\s+[—–-]\s/);
  if (bewerbung) return bewerbung[1];
  // Ein Name sind zwei bis vier GROSS beginnende Wörter (Namenspartikel wie „von“ erlaubt) — so
  // wird aus „… — Adresse klären oder anrufen“ kein Name. Ohne u-Flag (Ziel des Typchecks < ES6):
  // die Buchstaben ausdrücklich, wie mitarbeiterNachName.
  const W = "[A-ZÄÖÜÀ-ÖØ-ÞĀ-ŽА-ЯЁ][A-Za-zÀ-ÖØ-öø-ÿĀ-žА-яЁё'’-]+";
  const NAME = `${W}(?:\\s+(?:(?:von|van|de|der|den|da|di|del|zu|ten|el|al)\\s+)*${W}){1,3}`;
  const vorn = t.match(new RegExp(`^(${NAME}):\\s`));
  if (vorn && !/^(WhatsApp|Rate|Erstzahlung|Zur Kenntnis|Rückruf|Entscheidung|Make|Brevo|Auskunft)/i.test(vorn[1])) return vorn[1];
  const hinten = t.match(new RegExp(`\\s[—–-]\\s(${NAME})$`));
  return hinten ? hinten[1] : null;
}

// ───────────────────────────────────────────────────────────────────────────
// DIE EINE REIHENFOLGE
//
//   1. „Justin fragt dich" — eine offene Frage an den Mitarbeiter.
//   2. Alles, was beim Mitarbeiter liegt (nicht „wartet auf Justin").
//   3. Darin dringend zuerst (Justins Entscheidung vom 08.10.2026).
//   4. Darin nach Eingang — Standard die ältesten zuerst, damit der ganze
//      Rückstand drankommt; umschaltbar auf „neueste zuerst".
//   5. Die Kennung als letzter, stabiler Schlüssel: zweimal laden ergibt
//      dieselbe Reihenfolge (gemessen: 422 Schlüssel für 427 Aufträge).
// Liste, „nächster Auftrag" (Server) und Akte-Leiste benutzen nur diese Funktion.
// ───────────────────────────────────────────────────────────────────────────

export type AuftragRichtung = "alt" | "neu";

export interface SortierbarerAuftrag {
  id: number;
  status: string;
  frageAnAgent?: boolean;
  frageOffen?: boolean;
  prioritaet?: number | null;
  /** Die Art — Recht mit Frist (Katalog: frist) steht vor allem Dringenden. */
  art?: string | null;
  /** ISO — Beginn der jetzigen offenen Episode. */
  eingangAm?: string | null;
  createdAt?: string | null;
}

function zeitwert(v: string | null | undefined): number {
  const n = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
}

function rangDringend(a: SortierbarerAuftrag): number {
  if (istAuftragArt(a.art) && (AUFTRAG_ARTEN[a.art] as AuftragArtRegel).frist) return 0;
  return Number(a.prioritaet) === 1 ? 1 : 2;
}

export function auftragVergleich(richtung: AuftragRichtung = "alt") {
  return (a: SortierbarerAuftrag, b: SortierbarerAuftrag): number => {
    // Erledigtes ganz ans Ende — die Liste zeigt es nicht, aber die Funktion bleibt ehrlich.
    const ea0 = a.status === "erledigt" ? 1 : 0, eb0 = b.status === "erledigt" ? 1 : 0;
    if (ea0 !== eb0) return ea0 - eb0;
    const fa = a.frageAnAgent ? 0 : 1, fb = b.frageAnAgent ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const wa = a.status === "wartet" || a.frageOffen ? 1 : 0, wb = b.status === "wartet" || b.frageOffen ? 1 : 0;
    if (wa !== wb) return wa - wb;
    // Recht mit Frist (Widerruf, Kündigung, Beschwerde, Löschantrag, Eskalation) zählt als dringend und
    // steht darin vorn — sonst landet ein neuer Widerruf hinter rund 400 dringenden Altfällen.
    const da = rangDringend(a), db = rangDringend(b);
    if (da !== db) return da - db;
    const ea = zeitwert(a.eingangAm ?? a.createdAt), eb = zeitwert(b.eingangAm ?? b.createdAt);
    if (ea !== eb) return richtung === "alt" ? ea - eb : eb - ea;
    return richtung === "alt" ? a.id - b.id : b.id - a.id;
  };
}

export function auftraegeSortieren<T extends SortierbarerAuftrag>(liste: readonly T[], richtung: AuftragRichtung = "alt"): T[] {
  return [...liste].sort(auftragVergleich(richtung));
}

/**
 * Der nächste WIRKLICH offene Auftrag: nicht erledigt, nicht „wartet auf
 * Justin", nicht einer der eben geschlossenen. Gleiche Reihenfolge wie die Liste.
 */
export function naechsterAuftrag<T extends SortierbarerAuftrag>(liste: readonly T[], ohne: readonly number[] = [], richtung: AuftragRichtung = "alt"): T | null {
  const weg = new Set(ohne.map(Number));
  return auftraegeSortieren(liste.filter((a) => a.status !== "erledigt" && a.status !== "wartet" && !a.frageOffen && !weg.has(Number(a.id))), richtung)[0] ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// SPALTEN „EINGANG" UND „STATUS"
// ───────────────────────────────────────────────────────────────────────────

/**
 * „08.10. 14:32" in Berliner Zeit. Über formatToParts — nie über
 * Number(Intl.format()), das liefert in Node „14 Uhr" (Gedächtnis: Zeit-Falle).
 */
export function berlinTagZeit(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const w = (typ: string) => teile.find((p) => p.type === typ)?.value ?? "";
  return `${w("day")}.${w("month")}. ${w("hour")}:${w("minute")}`;
}

/** „Eingang: 08.10. 14:32" — die Zeile, die Justin auf jeder Karte sehen will. */
export function eingangText(iso: string | Date | null | undefined): string {
  const z = berlinTagZeit(iso);
  return z ? `Eingang: ${z}` : "Eingang: unbekannt";
}

/** „heute", „gestern", „vor 12 Tagen" — nach Kalendertagen, nicht nach Stunden. */
export function vorTagen(iso: string | Date | null | undefined, jetzt: Date = new Date()): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const tag = (x: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(x);
  const tage = Math.round((new Date(`${tag(jetzt)}T12:00:00Z`).getTime() - new Date(`${tag(d)}T12:00:00Z`).getTime()) / 864e5);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  return `vor ${tage} Tagen`;
}

export interface StatusQuelle {
  status: string;
  frageAnAgent?: boolean;
  frageOffen?: boolean;
  /** Mitarbeiter hat den Auftrag (seit der letzten Neuigkeit) noch nicht gesehen. */
  ungelesen?: boolean;
  wiederOffenAm?: string | null;
  wiederOffenGrund?: string | null;
  erledigtVon?: string | null;
  erledigtArt?: string | null;
  erledigtEreignis?: string | null;
}

export type StatusTon = "frage" | "neu" | "wieder" | "arbeit" | "offen" | "wartet" | "erledigt";

/** Spalte „Status" — ein Wort und, wo nötig, der Grund. */
export function auftragStatus(a: StatusQuelle): { text: string; ton: StatusTon; grund: string | null } {
  if (a.status === "erledigt") {
    const auto = a.erledigtArt === "auto";
    return {
      text: auto ? "Automatisch erledigt" : "Erledigt",
      ton: "erledigt",
      grund: auto ? (a.erledigtEreignis || a.erledigtVon || null) : (a.erledigtVon ? `von ${a.erledigtVon}` : null),
    };
  }
  if (a.frageAnAgent) return { text: "Justin fragt dich", ton: "frage", grund: null };
  if (a.status === "wartet" || a.frageOffen) return { text: "Wartet auf Justin", ton: "wartet", grund: null };
  if (a.wiederOffenAm) return { text: "Wieder offen", ton: "wieder", grund: a.wiederOffenGrund || null };
  if (a.ungelesen) return { text: "Neu", ton: "neu", grund: null };
  if (a.status === "in_arbeit") return { text: "In Arbeit", ton: "arbeit", grund: null };
  return { text: "Offen", ton: "offen", grund: null };
}

/** „Automatisch erledigt: Gesprächsergebnis erfasst – Daniel Stripling, 08.10. 14:32" */
export function autoErledigtText(ereignis: AuftragEreignis, wer: string, am: Date = new Date(), detail?: string | null): string {
  const was = AUFTRAG_EREIGNISSE[ereignis].label;
  return `Automatisch erledigt durch ${was}${detail ? ` (${detail})` : ""} – ${wer || "System"}, ${berlinTagZeit(am)}`;
}

// ───────────────────────────────────────────────────────────────────────────
// HERKUNFT — „von Mara · E-Mail", „Antrag", „Zahlungen"
// (vorher nur im Popup, fiaon-agent-aufgaben-popup.ts quelleVon — jetzt hier,
// das Popup reicht es durch)
// ───────────────────────────────────────────────────────────────────────────
export function auftragHerkunft(quelle: unknown): { vonMara: boolean; kanal: string | null } {
  const q = String(quelle ?? "").trim().toLowerCase();
  if (q === "postmeister") return { vonMara: true, kanal: "E-Mail" };
  if (q.includes("whatsapp")) return { vonMara: q.startsWith("mara"), kanal: "WhatsApp" };
  if (q.startsWith("mara")) return { vonMara: true, kanal: null };
  const HAUS: Record<string, string> = {
    antrag: "Antrag", abo: "Zahlungen", bonitaet: "Bonität", global: "FIAON Global",
    website: "Website", hand: "Verwaltung", system: "System", meldung: "Meldung",
    bestellung: "Bestellung", kundenbereich: "Kundenbereich", bankbuch: "Bankbuch", kontakt: "Kontaktformular",
  };
  return { vonMara: false, kanal: HAUS[q] ?? "Verwaltung" };
}
