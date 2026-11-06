// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Datenformen und der eine Weg zum Server (E-228)
// ═══════════════════════════════════════════════════════════════════════════

export type Rolle = "inhaber" | "buchhaltung";
export interface Ich { email: string; name: string; rolle: Rolle; titel: string }

export type KontoSchluessel = "geschaeft" | "wise";
export interface Konto {
  schluessel: KontoSchluessel; name: string; inhaber: string; iban: string; ibanDisplay: string;
  bic: string; institut: string; seit: string | null; gesperrtSeit: string | null;
}

export type UmsatzArt = "kunde" | "offen" | "sonstiges" | "auszahlung" | "ueberweisung" | "einlage" | "eingang" | "ausgabe" | "korrektur";
export interface Umsatz {
  uid: string; konto: KontoSchluessel; zeit: string; tag: string; cents: number; art: UmsatzArt;
  gegenpartei: string; zweck: string | null; referenz: string | null; beleg: string | null;
  schwebend: boolean; storniert: boolean; zuordnung: string | null; verbucht: boolean; notiz: string | null;
  erfasstVon: string | null; auftragId: number | null; auszahlungId: number | null; abrechnungId: number | null;
  kunde: string | null; saldoNach: number | null;
}

export interface LiveStand { ok: boolean; cents?: number; verfuegbarCents?: number; schwebendCents?: number; stand?: string; grund?: string }
export interface Kasse {
  anfang: { cents: number; am: string; notiz: string; von: string } | null;
  buchCents: number | null; zuflussCents: number; abflussCents: number; unterwegsCents: number;
  abgleich: { cents: number; am: string; von: string; erfasst: string; buchAmTagCents: number | null; differenzCents: number | null } | null;
  live: LiveStand; liveDifferenzCents: number | null;
}

export type AuftragStatus = "entwurf" | "eingereicht" | "freigegeben" | "abgelehnt" | "ausgefuehrt" | "zurueckgezogen";
export interface Auftrag {
  id: number; nummer: string; empfaenger: string; iban: string; bic: string | null; betragCents: number;
  zweck: string; kategorie: string | null; faelligAm: string | null; belegName: string | null; hatBeleg: boolean;
  status: AuftragStatus; erstelltVon: string; erstelltAm: string; eingereichtAm: string | null;
  entschiedenVon: string | null; entschiedenAm: string | null; entscheidungNotiz: string | null;
  freigabeArt: "vier_augen" | "einzel" | null; ausgefuehrtVon: string | null; ausgefuehrtAm: string | null;
  bankReferenz: string | null; hatBestaetigung: boolean; payoutId: number | null;
  // 13.10.2026: Ausführung über die Buchhaltung (Adresse), Freigabe-Mail, Beauftragung und Bestätigung
  ausfuehrungExtern?: string | null; freigabeMailAm?: string | null; externGesendetAm?: string | null;
  externBestaetigtAm?: string | null; externWertAm?: string | null;
  // E-484: Teilbetrag eines Auszahlungsplans, Bank-Referenz der Buchhaltung (freiwillig), Rückruf
  planTeilId?: number | null; externBankReferenz?: string | null;
  zurueckgerufenAm?: string | null; zurueckgerufenVon?: string | null; rueckrufGrund?: string | null;
  // E-484 (Nachbesserung): nach dem Rückruf „doch ausgeführt“ — vom Inhaber mit TAN gebucht; beim Anlegen verrechnet
  dochAusgefuehrtAm?: string | null; dochAusgefuehrtVon?: string | null; dochAusgefuehrtNotiz?: string | null; verrechnetPlanId?: number | null;
}

export interface Auszahlung {
  id: number; agentId: number; name: string; cents: number; status: string; art: "Gehalt" | "Provision";
  ibanMaskiert: string | null; angefordertAm: string | null; ausgezahltAm: string | null; ablehnGrund: string | null;
  abrechnungId: number | null; abrechnungNr: string | null; hatAbrechnungPdf: boolean;
  auftragId: number | null; auftragNr: string | null; auftragStatus: string | null;
  auftragExtern?: boolean; freigabeMailAm?: string | null; gfAbgelehnt?: boolean;
}

export interface Dauerauftrag {
  id: number; empfaenger: string; iban: string; bic: string | null; betragCents: number; zweck: string;
  kategorie: string | null; tagImMonat: number; naechsteAm: string; erstelltVon: string; erstelltAm: string;
  beendetAm: string | null; letzterAuftragId: number | null;
}

export interface Empfaenger {
  schluessel: string; quelle: "karte" | "mitarbeiter"; name: string; iban: string; bic: string | null;
  kategorie: string | null; hinweis: string | null; id?: number; zuletztGenutzt?: string | null;
}

export interface MonatsFluss { monat: string; konto: KontoSchluessel; einCents: number; ausCents: number; anzahl: number }
export interface Uebergabe { bisher: string; stichtag: string; bestaetigtVon?: string; bestaetigtAm?: string }

/** Ein liegengebliebener Eingang mit seiner Trockenprobe (server/lib/fiaon-bank-nachholen.ts). */
export type NachholRegel = "rate" | "erstzahlung" | "regel_b";
export interface NachholZeile {
  id: number; txnId: string; datum: string; betragCents: number; zweck: string | null; absender: string | null;
  zweckRef: string | null; regel: NachholRegel | null; ziel: string | null; bestellung: string | null; kunde: string | null;
  personId: number | null; rateId: number | null; rateNr: number | null; ergebnis: string; buchen: boolean;
  deckung: string | null; provision: string[]; mails: string[]; hinweise: string[]; genannteRate: number | null;
  unklar: string | null; schonVerbucht: boolean;
  // E-277: Ziel vom Menschen, Sammelzahlung, „Nur zuordnen", Vorschlag
  zielVomMenschen?: string | null; dazu?: number[]; summeCents?: number; buchDatum?: string;
  zuordenbar?: boolean; zugeordnet?: string | null; vorschlag?: NachholVorschlag | null;
  // E-278: was „Storno zurücknehmen“ vorher tut, und der Verrechnungsvermerk „mit heutigem Datum“
  stornoZurueck?: string | null; verrechnung?: string | null;
  // E-469: „Als Teilzahlung buchen“ — Rechnungsbetrag, bisher, dieser, danach offen, Abschluss, Überzahlung
  teilzahlung?: {
    ref: string; zahlungsreferenz: string; rechnungsnummer: string | null; sollCents: number; bisherCents: number; dieserCents: number;
    nachherCents: number; offenCents: number; abschluss: boolean; ueberzahlung: boolean; faelligAm: string | null; eingangAm: string;
  } | null;
}

/** E-277: Was ein Handfall ist und was der Knopf tut — gebucht wird erst nach dem Klick des Inhabers. */
export type HandfallArt = "erstzahlung" | "rate" | "nur_zuordnen" | "teilzahlung" | "ueberzahlung" | "rueckzahlung_noetig" | "unbekannt";
export interface NachholVorschlag {
  art: HandfallArt; aktion: "buchen" | "zuordnen" | "aufgabe" | "teilzahlung" | null; ziel: string | null; mitZiel: boolean;
  bestellung: string | null; rateNr: number | null; rateId: number | null; kunde: string | null; personId: number | null;
  dazu: number[]; sicherheit: "sicher" | "wahrscheinlich" | "unklar"; gruende: string[]; text: string; hinweise: string[];
  /** Was die Trockenprobe beim Klick sagen muss — sonst bucht der Server nicht. */
  erwartet: { regel?: NachholRegel | null; ziel: string | null; rateId: number | null } | null;
}

export interface Lage {
  ich: Ich; konten: Konto[]; kasse: Kasse;
  offen: { offenAnzahl: number; offenCents: number; schwebendAnzahl: number; schwebendCents: number };
  nachholen: { anzahl: number; cents: number; gesamtAnzahl?: number; gesamtCents?: number };
  fluss: MonatsFluss[]; letzte: Umsatz[]; auftraege: Auftrag[]; uebergabe: Uebergabe | null;
  dauerauftraege: Dauerauftrag[]; leute: Ich[];
  auszahlungOffen: { anzahl: number; cents: number; ohneAuftrag: number };
  /** E-484: der Auszahlungsplan in Kurzform (Zähler, „Zu tun“, Hinweiszeilen) — null, wenn er gerade nicht lesbar ist. */
  auszahlungsplan?: PlanKurz | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNGSPLAN (E-484, 06.11.2026) — die Antwortformen von
// server/lib/fiaon-auszahlungsplan.ts (planLage, planKandidaten, planVorschau).
// Je Empfänger ein eigener Plan mit eigener Wartezeit. Jeder Knopf-Zustand
// kommt vom Server; die Oberfläche zeigt ihn nur.
// ═══════════════════════════════════════════════════════════════════════════
export type PlanStatus = "aktiv" | "pausiert" | "fertig" | "beendet";
export type PlanZustand = "bereit" | "wartet" | "stau" | "unterwegs" | "konto" | "pausiert" | "fertig" | "beendet";
export type AltpostenModus = "verrechnet" | "zusaetzlich";

/** Was beim Empfänger außerhalb eines Plans offen ist (Vormerkungen, Provisionen, Auszahlungen, Aufträge). */
export interface Altposten {
  agentId: number;
  /** Posten, die beim Verrechnen geschlossen werden (Vormerkungen + Provisionen + Auszahlungen). */
  anzahl: number;
  cents: number;
  vormerkungen: { anzahl: number; cents: number };
  provisionen: { anzahl: number; cents: number };
  auszahlungen: { id: number; cents: number; status: string }[];
  /** Offene Zahlungsaufträge dazu — ihr Betrag steckt in der Auszahlung und zählt nicht in `cents`. */
  auftraege: { id: number; nummer: string; status: string; cents: number; beiBuchhaltung: boolean; auszahlungId: number | null; auszahlungStatus: string | null }[];
  fingerabdruck?: string;
}

/** Die Aufstellung, die beim Anlegen verrechnet wurde (am Plan gespeichert). */
export interface PlanAltpostenDetail {
  vormerkungen?: { anzahl: number; cents: number };
  provisionen?: { anzahl: number; cents: number };
  auszahlungen?: { id: number; cents: number; status: string }[];
  auftraege?: { nummer: string; status: string; cents: number; beiBuchhaltung: boolean; auszahlungStatus: string | null }[];
}

export interface PlanAuftrag extends Auftrag {
  planId: number; planNummer: string; teilNr: number; anzahlTeile: number; agentId: number; empfaengerName: string;
  ausgeloestVon: string | null; ausgeloestVonName: string | null; ausgeloestAm: string | null; selbstfreigabe: boolean;
  /** Wer freigegeben hat — als Name (vom Server). */
  entschiedenVonName: string | null;
  darfFreigeben: boolean;
  /** Warum (noch) nicht freigegeben werden kann — kein grauer Knopf ohne Grund. */
  freigabeGrund: string | null;
  darfAblehnen: boolean; darfZurueckrufen: boolean; darfErneutSenden: boolean;
  beiBuchhaltungSeit: string | null;
  /** Länger als zwei Bankarbeitstage bei der Buchhaltung. */
  ueberfaellig: boolean;
  /** Nach einem Rückruf in Klärung seit — erst die Klärung durch den Inhaber gibt den Teil frei (oder bucht ihn aus). */
  klaerungSeit: string | null;
  darfKlaeren: boolean;
}

/** Ein beim Anlegen verrechneter Auftrag, der bei der Buchhaltung lag (zurückgerufen). */
export interface PlanAltpostenAuftrag {
  id: number; nummer: string; betragCents: number; zurueckgerufenAm: string | null;
  dochAusgefuehrtAm: string | null; dochAusgefuehrtVonName: string | null; bankReferenz: string | null;
  /** „ausgezahlt“: schon vor dem Plan als überwiesen gebucht — steckt nicht im Plan, der Auftrag wurde nur geschlossen. */
  auszahlungStatus: string | null;
  darfDochUeberwiesen: boolean;
}

export interface PlanZeile {
  id: number; nummer: string; status: PlanStatus; zustand: PlanZustand;
  darfAusloesen: boolean;
  /** Warum gerade nicht ausgelöst werden kann (Klartext vom Server), sonst null. */
  sperrGrund: string | null;
  agentId: number; empfaengerName: string; ichBinEmpfaenger: boolean;
  anspruchCents: number; teilCents: number; anzahlTeile: number; abstandMin: number; maxOffen: number;
  altposten: AltpostenModus; altpostenCents: number; altpostenAnzahl: number; altpostenDetail: PlanAltpostenDetail | null;
  hinweisAnInhaber: boolean; grund: string;
  ibanMasked: string | null; kontoArt: string; kontoAktuellMasked: string | null;
  kontoBestaetigtAm: string | null; kontoBestaetigtVonName: string | null;
  angelegtVonName: string; angelegtAm: string;
  statusVonName: string | null; statusAm: string | null; statusGrund: string | null;
  naechsteAb: string; letzteAusloesungAm: string | null; letzteAusloesungVonName: string | null;
  naechsterTeil: { nr: number; betragCents: number } | null;
  ausgefuehrt: { anzahl: number; cents: number };
  zurFreigabe: { anzahl: number; cents: number };
  beiBuchhaltung: { anzahl: number; cents: number };
  offen: { anzahl: number; cents: number };
  /** Nach einem Rückruf in Klärung. */
  klaerung: { anzahl: number; cents: number };
  /** Um so viel ist der Plan gekürzt (ein verrechneter Altposten ging trotz Rückruf raus); entfallene Teile dazu. */
  gekuerztCents: number;
  entfallen: { anzahl: number; cents: number };
  altpostenAuftraege: PlanAltpostenAuftrag[];
  selbstfreigaben: number;
  /** Was außerhalb des Plans neu offen ist — läuft normal über „Auszahlungen“. */
  ausserhalb: Altposten | null;
  darfPausieren: boolean; darfFortsetzen: boolean; darfBeenden: boolean; darfKontoBestaetigen: boolean; darfHinweisSchalten: boolean;
}

export interface PlanTakt {
  id: number; planId: number; planNummer: string; teilNr: number | null; vonName: string; am: string; sperreBis: string;
  auftragId: number | null; auftragNummer: string | null;
  ergebnis: "zur_freigabe" | "bei_buchhaltung" | "ausgefuehrt" | "abgelehnt" | "zurueckgezogen" | "zurueckgerufen" | "in_klaerung" | "unbekannt";
  ergebnisText: string;
}

export interface PlanLage {
  /** Datenbank-Zeit — die Oberfläche zählt mit dem Versatz zu ihrer Uhr herunter und löst nie selbst aus. */
  jetzt: string;
  ich: { email: string; name: string; rolle: Rolle };
  istInhaber: boolean;
  /** Die Adresse der ausführenden Buchhaltung (fest im Server). */
  buchhaltung: string;
  plaene: PlanZeile[];
  zurFreigabe: PlanAuftrag[];
  beiBuchhaltung: PlanAuftrag[];
  /** Nach einem Rückruf in Klärung. */
  inKlaerung: PlanAuftrag[];
  ausgefuehrt: { zeilen: PlanAuftrag[]; gesamt: number; seite: number; proSeite: number };
  verlauf: PlanTakt[];
  badge: number;
}

/** Die Kurzform in der Lage (Übersicht, Zähler am Menüpunkt, Hinweiszeilen). */
export interface PlanKurz {
  jetzt: string; badge: number;
  zurFreigabe: number; darfFreigeben: number; beiBuchhaltung: number; ueberfaellig: number;
  /** Nach einem Rückruf in Klärung (und davon vom Inhaber zu klären). */
  inKlaerung?: number; darfKlaeren?: number;
  auftraegeLaufend: number; auszahlungenOffen: number; auszahlungenOffenCents: number;
  plaene: {
    id: number; nummer: string; empfaengerName: string; ichBinEmpfaenger: boolean; status: PlanStatus; zustand: PlanZustand;
    darfAusloesen: boolean; sperrGrund: string | null; naechsteAb: string; naechsterTeil: { nr: number; betragCents: number } | null;
    anzahlTeile: number; ausgefuehrt: number;
  }[];
}

export interface PlanKandidat {
  agentId: number; name: string; ibanMasked: string | null; auswaehlbar: boolean;
  /** Warum nicht wählbar (kein Konto, gesperrt, schon ein Plan …). */
  grund: string | null;
  offenerPlan: string | null;
  altposten: Altposten | null;
}

export interface PlanVorgaben { teilCents: number; abstandMin: number; maxOffen: number; altposten: AltpostenModus; hinweisAnInhaber: boolean }
export interface PlanGrenzen {
  empfaenger: { min: number; max: number }; anspruchCents: { min: number; max: number }; teilCents: { min: number; max: number };
  abstandMin: { min: number; max: number }; maxOffen: { min: number; max: number }; teile: { max: number }; grund: { min: number; max: number };
}

/** Genau das, was an neu/vorschau, neu/tan und neu geht — dieselbe Eingabe bindet die TAN. */
export interface PlanEingabe {
  empfaenger: { agentId: number; anspruchCents: number }[];
  teilCents: number; abstandMin: number; maxOffen: number; altposten: AltpostenModus; hinweisAnInhaber: boolean; grund: string;
}

export interface PlanVorschauEmpfaenger {
  agentId: number; name: string; ibanMasked: string | null; anspruchCents: number; anzahlTeile: number; letzterTeilCents: number;
  fruehestensTage: number; altposten: Altposten | null; fehler: string | null;
}
export interface PlanVorschau {
  empfaenger: PlanVorschauEmpfaenger[];
  teilCents: number; abstandMin: number; maxOffen: number; altposten: AltpostenModus; hinweisAnInhaber: boolean; grund: string;
  summeCents: number; anzahlTeile: number;
  altpostenCents: number; altpostenAnzahl: number;
  /** ZA-Nummern bei der Buchhaltung, die zurückgerufen würden. */
  zurueckgerufen: string[];
  fehler: string[];
  /** Der Text der TAN-Mail. */
  beschreibung: string;
}

/** Meldet der Oberfläche, dass die Sitzung weg ist — sie zeigt dann die Anmeldung. */
export const SITZUNG_WEG = "fiaon-banking-sitzung-weg";

/**
 * Ein Fehlschlag vom Server. E-484: dazu die Kennung (`code`, z. B. ZU_FRUEH, STAU, ALTPOSTEN_GEAENDERT) und bei
 * „zu früh“ der Zeitpunkt `naechsteAb` — damit die Uhr nach einer Abweisung den richtigen Zeitpunkt zeigt.
 */
export class BankFehler extends Error {
  constructor(message: string, public status: number, public code: string | null = null, public naechsteAb: string | null = null) { super(message); }
}

export async function ruf<T = any>(pfad: string, init?: { method?: string; body?: unknown; hintergrund?: boolean }): Promise<T> {
  // E-484: `hintergrund` — ein Abruf ohne menschliche Eingabe (Auffrischen im Takt). Der Server zählt ihn nicht als
  // Aktivität, sonst griffe die Leerlauf-Grenze bei offenem Reiter nie.
  const kopf: Record<string, string> = {};
  if (init?.body !== undefined) kopf["Content-Type"] = "application/json";
  if (init?.hintergrund) kopf["X-Banking-Hintergrund"] = "1";
  const res = await fetch(`/api/fiaon${pfad}`, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    credentials: "include",
    headers: Object.keys(kopf).length ? kopf : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const j = await res.json().catch(() => null);
  if (res.status === 401 && j?.code === "ANMELDUNG" && !pfad.startsWith("/buchhaltung/pin") && !pfad.startsWith("/buchhaltung/anmelden")) {
    window.dispatchEvent(new CustomEvent(SITZUNG_WEG));
  }
  if (!res.ok || j?.ok === false) {
    throw new BankFehler(j?.error || `Fehler ${res.status}`, res.status,
      typeof j?.code === "string" ? j.code : null, typeof j?.naechsteAb === "string" ? j.naechsteAb : null);
  }
  return j as T;
}
