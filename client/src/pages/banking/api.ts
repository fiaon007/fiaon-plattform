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
}

export interface Auszahlung {
  id: number; agentId: number; name: string; cents: number; status: string; art: "Gehalt" | "Provision";
  ibanMaskiert: string | null; angefordertAm: string | null; ausgezahltAm: string | null; ablehnGrund: string | null;
  abrechnungId: number | null; abrechnungNr: string | null; hatAbrechnungPdf: boolean;
  auftragId: number | null; auftragNr: string | null; auftragStatus: string | null;
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

export interface Lage {
  ich: Ich; konten: Konto[]; kasse: Kasse;
  offen: { offenAnzahl: number; offenCents: number; schwebendAnzahl: number; schwebendCents: number };
  fluss: MonatsFluss[]; letzte: Umsatz[]; auftraege: Auftrag[]; uebergabe: Uebergabe | null;
  dauerauftraege: Dauerauftrag[]; leute: Ich[];
  auszahlungOffen: { anzahl: number; cents: number; ohneAuftrag: number };
}

/** Meldet der Oberfläche, dass die Sitzung weg ist — sie zeigt dann die Anmeldung. */
export const SITZUNG_WEG = "fiaon-banking-sitzung-weg";

export class BankFehler extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function ruf<T = any>(pfad: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/fiaon${pfad}`, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    credentials: "include",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const j = await res.json().catch(() => null);
  if (res.status === 401 && j?.code === "ANMELDUNG" && !pfad.startsWith("/buchhaltung/pin") && !pfad.startsWith("/buchhaltung/anmelden")) {
    window.dispatchEvent(new CustomEvent(SITZUNG_WEG));
  }
  if (!res.ok || j?.ok === false) throw new BankFehler(j?.error || `Fehler ${res.status}`, res.status);
  return j as T;
}
