// ═══════════════════════════════════════════════════════════════════════════
// MARA FORDERT FEHLENDE KYC-UNTERLAGEN SELBST NACH — DIE REGEL (E-406 B2, 19.10.2026)
//
// Justin (19.10.2026, Vorschlag 3 „Mara führt den Betrieb“): „starte Etappe A und alle anderen gleichzeitig,
// damit alles fertig wird … mach einfach mal“. Baustein B2: KYC nachfordern und Unterlagen vorprüfen —
// selbst, und nicht mehr bei Justin.
//
// ── DER BEFUND (Produktion, nur lesend, 19.10.2026) ─────────────────────────
// · „KYC zu prüfen“ zeigte 194 Personen; 72 davon haben einen beendeten Vertrag (storniert, archiviert,
//   Abo gestoppt, Vertragsende erreicht ODER gekündigt). E-397 nahm nur die ersten vier heraus (154 blieben) —
//   die 32 Gekündigten standen weiter in der Prüfliste. Mit KYC_VERTRAG_LAEUFT_SQL sind es 122.
// · 319 Menschen haben ein bezahltes, laufendes Privat-Paket; bei 228 fehlt Ausweis oder Kontoauszug ganz.
//   Niemand fordert nach — der Upload-Link ohne Anmeldung (E-IT-D) geht nur auf Klick.
//
// ── DIE REGEL ───────────────────────────────────────────────────────────────
// Mara schickt dem Kunden die bestehende Unterlagen-Mail (documents_change_request) mit dem Upload-Link
// ohne Anmeldung — über den EINEN Weg unterlagenAnfrageSenden (Zustandsregel, Drossel, Protokoll, Verlauf):
//   · nur bei einem bezahlten, LAUFENDEN Privat-Paket — nie bei beendetem oder gekündigtem Vertrag,
//     nie bei einem eingegangenen, noch nicht gebuchten Kündigungsantrag;
//   · nur, was in seinem Kundenbereich „fehlt“ oder „bitte neu“ heißt (Ausweis, Kontoauszug — die
//     KYC-Unterlagen, die die Verwaltung mit kyc_status freigibt);
//   · höchstens KYC_HOECHSTENS Erinnerungen je Mensch, mindestens KYC_ABSTAND_TAGE auseinander — und
//     ebenso lange nach der Zahlung und nach jeder anderen Unterlagen-Bitte (Akte, Verwaltung, Auswertung);
//   · 08:00–20:00 Uhr Berlin (dasselbe Fenster wie das Nachfassen, E-401), keine zweite Mail binnen
//     KYC_MAIL_ABSTAND_STUNDEN nach irgendeiner anderen Mail an ihn (Frequenzbremse);
//   · die Werbesperre ist KEINE Wand: Die Bitte um eine Unterlage für den laufenden Vertrag ist Service
//     (dieselbe Regel wie versandErlaubt, E-240);
//   · nie bei FIAON Global, Testkonto, Vertriebssperre (is_blocked = kein Kontakt), ohne E-Mail-Adresse;
//   · nicht bei Käufern der Bonitätsauswertung, deren Ablauf schon selbst erinnert (Quelle „auskunft“).
// Freigeben („Geprüft“) tut weiter ein Mensch — Mara fordert nur an (Vier-Augen bleibt).
//
// Hier steht nur die REGEL — rein, ohne Datenbank, im Prüfstand geprüft (scripts/pruef-mara-kyc.ts).
// Kandidaten lesen und senden tut der Server (server/lib/fiaon-mara-kyc.ts), nie ein Modell.
// ═══════════════════════════════════════════════════════════════════════════
import { imVersandfenster, naechstesFenster } from "./fiaon-nicht-erreicht-nachfass";

/** Die KYC-Unterlagen: Ausweis und Kontoauszug (beide gibt die Verwaltung mit kyc_status frei). */
export type KycArt = "ausweis" | "kontoauszug";
export const KYC_ARTEN: readonly KycArt[] = ["ausweis", "kontoauszug"];
export function istKycArt(v: unknown): v is KycArt {
  return v === "ausweis" || v === "kontoauszug";
}

/** Der Schalter im Chefbüro (fiaon_settings). Fehlt er, ist Mara AN (Justin 15.10.: „du erledigst alles“). */
export const KYC_SCHALTER = "mara_kyc_nachfordern";
/** Die Quelle in fiaon_unterlagen_anfragen — so zählt die Plattform Maras Bitten getrennt von Akte und Verwaltung. */
export const KYC_QUELLE = "mara_kyc";
/** Höchstens so viele Erinnerungen je Mensch. */
export const KYC_HOECHSTENS = 2;
/** So viele Tage nach der Zahlung, nach jeder Unterlagen-Bitte und zwischen Maras Erinnerungen. */
export const KYC_ABSTAND_TAGE = 4;
/** Keine Erinnerung binnen so vieler Stunden nach irgendeiner anderen Mail an ihn (Frequenzbremse). */
export const KYC_MAIL_ABSTAND_STUNDEN = 20;
/** Nach einem gescheiterten Versuch frühestens nach so vielen Stunden wieder — und höchstens so oft. */
export const KYC_FEHL_ABSTAND_STUNDEN = 24;
export const KYC_FEHL_HOECHSTENS = 3;
/** Höchstens so viele Erinnerungen am Tag (Berlin) und je Lauf — der Altbestand verteilt sich über Tage. */
export const KYC_TAG_DECKEL = 30;
export const KYC_LAUF_DECKEL = 10;

/** Schalterwert lesen: fehlt er, ist Mara an. „aus“, „0“, „nein“, „false“, „off“ schalten ab. */
export function kycSchalterAn(wert: unknown): boolean {
  const w = String(wert ?? "").trim().toLowerCase();
  return !["aus", "0", "nein", "false", "off"].includes(w);
}

// ═══════════════════════════════════════════════════════════════════════════
// „DER VERTRAG LÄUFT“ — EINE Regel für die Prüfliste „KYC zu prüfen“ und für Mara
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Läuft diese Bestellung (Alias `a` auf fiaon_applications)? Nicht storniert, nicht archiviert, Abo nicht
 * gestoppt, Vertragsende nicht erreicht — und nicht gekündigt (außer die Kündigung wurde zurückgenommen).
 * Der kyc_status bleibt gespeichert; die Bestellung fällt nur aus Liste und Nachforderung.
 */
export function kycVertragLaeuftSql(a = "a"): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(a)) throw new Error(`[KYC] Ungültiger Alias: ${a}`);
  return `(${a}.cancelled_at IS NULL AND ${a}.archived_at IS NULL AND ${a}.abo_gestoppt_am IS NULL`
    + ` AND (${a}.vertrag_ende_am IS NULL OR ${a}.vertrag_ende_am > NOW())`
    + ` AND (${a}.gekuendigt_am IS NULL OR ${a}.kuendigung_zurueckgenommen_am IS NOT NULL))`;
}

/** Ein bezahltes Privat-Paket (keine reine Auskunftsbestellung, keine Firma), nicht Entwurf, nicht gelöscht. */
export function kycPrivatPaketSql(a = "a"): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(a)) throw new Error(`[KYC] Ungültiger Alias: ${a}`);
  return `(${a}.merged_into IS NULL AND ${a}.payment_status = 'paid' AND NOT COALESCE(${a}.ist_entwurf, FALSE)`
    + ` AND ${a}.gdpr_deleted_at IS NULL AND COALESCE(${a}.type, '') = 'private' AND ${a}.ref NOT LIKE 'FIAON-SCHUFA-%')`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS URTEIL
// ═══════════════════════════════════════════════════════════════════════════
/** Was der Server über den Menschen weiß — vollständig, damit die Regel nichts erraten muss. */
export interface KycFakten {
  /** Gibt es die Person noch (nicht zusammengeführt, nicht gelöscht)? */
  personDa: boolean;
  /** Bezahltes, laufendes Privat-Paket (kycPrivatPaketSql + kycVertragLaeuftSql)? */
  vertragLaeuft: boolean;
  testkonto: boolean;
  globalKunde: boolean;
  /** Vertriebssperre (fiaon_persons.is_blocked) — kein Kontakt. */
  gesperrt: boolean;
  /** Ein eingegangener, noch nicht gebuchter Kündigungsantrag (KUENDIGUNG_UNGEBUCHT_SQL). */
  kuendigungOffen: boolean;
  hatEmail: boolean;
  /** Der Ablauf der Bonitätsauswertung (Quelle „auskunft“) erinnert diesen Menschen schon selbst. */
  auswertungAblauf: boolean;
  /** Was in seinem Kundenbereich „fehlt“ oder „bitte neu“ heißt (unterlagenStand, Sicht Kunde). */
  fehlt: KycArt[];
  /** Die erste Zahlung eines laufenden Privat-Pakets. */
  bezahltAm: Date | string | null;
  /** Maras GESENDETE Erinnerungen bisher. */
  maraGesendet: number;
  /** Maras gescheiterte Versuche (abgelehnt/fehlgeschlagen) seit der letzten gesendeten. */
  maraFehlversuche: number;
  /** Die jüngste GESENDETE Unterlagen-Bitte irgendeines Weges (Akte, Verwaltung, Auswertung, Mara). */
  letzteBitteAm: Date | string | null;
  /**
   * Maras jüngste gezählte Erinnerung (gesendet, gerade in Arbeit oder beim Senden unterbrochen) — auch wenn dazu keine
   * Zeile in fiaon_unterlagen_anfragen steht (Absturz mitten im Senden): Der Abstand gilt trotzdem.
   */
  letzteMaraAm?: Date | string | null;
  /** Maras jüngster Versuch, auch ein gescheiterter. */
  letzterVersuchAm: Date | string | null;
  /** Die jüngste versandte Mail irgendeiner Art an ihn (fiaon_mail_log). */
  letzteMailAm: Date | string | null;
}

export type KycUrteil =
  | { art: "senden"; nummer: number; arten: KycArt[] }
  | { art: "warten"; nichtVor: Date; grund: string }
  | { art: "auslassen"; grund: string }
  | { art: "erledigt"; grund: string };

export const KYC_GRUND = {
  personWeg: "Person nicht mehr da (zusammengeführt oder gelöscht)",
  vertragAus: "kein laufendes Privat-Paket — nichts nachzufordern",
  test: "Testkonto",
  global: "Kunde von FIAON Global — sein Ansprechpartner fordert selbst an",
  gesperrt: "Vertriebssperre — kein Kontakt",
  kuendigung: "Kündigung eingegangen — keine Bitte um Unterlagen",
  vollstaendig: "Ausweis und Kontoauszug liegen vor",
  genug: `schon ${KYC_HOECHSTENS} Erinnerungen von Mara — jetzt ist das Team dran`,
  auswertung: "die Bonitätsauswertung erinnert selbst",
  keineMail: "keine E-Mail-Adresse hinterlegt",
  fehlversuche: `${KYC_FEHL_HOECHSTENS} Versuche gescheitert — bitte in der Akte ansehen`,
  frischBezahlt: `bezahlt vor weniger als ${KYC_ABSTAND_TAGE} Tagen — die Begrüßung bittet schon darum`,
  abstand: `vor weniger als ${KYC_ABSTAND_TAGE} Tagen kam schon eine Bitte um Unterlagen`,
  fehlAbstand: "der letzte Versuch scheiterte vor kurzem",
  mailAbstand: `vor weniger als ${KYC_MAIL_ABSTAND_STUNDEN} Stunden ging schon eine Mail an ihn`,
  fenster: "außerhalb 08:00–20:00 — geht ab 8 Uhr raus",
} as const;

const zeit = (v: Date | string | null | undefined): number => {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};

/**
 * Die eine Regel: Was tut Mara jetzt mit diesem Menschen? Rein — dieselbe Prüfung im Takt und im Probelauf.
 * Reihenfolge: erst, was den Fall beendet (erledigt/auslassen), dann, was nur aufschiebt (warten).
 */
export function kycUrteil(f: KycFakten, jetzt: Date = new Date()): KycUrteil {
  if (!f.personDa) return { art: "auslassen", grund: KYC_GRUND.personWeg };
  if (!f.vertragLaeuft) return { art: "erledigt", grund: KYC_GRUND.vertragAus };
  if (f.testkonto) return { art: "auslassen", grund: KYC_GRUND.test };
  if (f.globalKunde) return { art: "auslassen", grund: KYC_GRUND.global };
  if (f.gesperrt) return { art: "auslassen", grund: KYC_GRUND.gesperrt };
  if (f.kuendigungOffen) return { art: "auslassen", grund: KYC_GRUND.kuendigung };
  const arten = KYC_ARTEN.filter((a) => (f.fehlt ?? []).includes(a));
  if (!arten.length) return { art: "erledigt", grund: KYC_GRUND.vollstaendig };
  if (Number(f.maraGesendet || 0) >= KYC_HOECHSTENS) return { art: "erledigt", grund: KYC_GRUND.genug };
  if (f.auswertungAblauf) return { art: "auslassen", grund: KYC_GRUND.auswertung };
  if (!f.hatEmail) return { art: "auslassen", grund: KYC_GRUND.keineMail };
  if (Number(f.maraFehlversuche || 0) >= KYC_FEHL_HOECHSTENS) return { art: "auslassen", grund: KYC_GRUND.fehlversuche };

  const tag = 86_400_000;
  const jetztMs = jetzt.getTime();
  const spaetestens: { ab: number; grund: string }[] = [];
  const bezahlt = zeit(f.bezahltAm);
  if (Number.isFinite(bezahlt)) spaetestens.push({ ab: bezahlt + KYC_ABSTAND_TAGE * tag, grund: KYC_GRUND.frischBezahlt });
  const bitte = zeit(f.letzteBitteAm);
  if (Number.isFinite(bitte)) spaetestens.push({ ab: bitte + KYC_ABSTAND_TAGE * tag, grund: KYC_GRUND.abstand });
  const mara = zeit(f.letzteMaraAm);
  if (Number.isFinite(mara)) spaetestens.push({ ab: mara + KYC_ABSTAND_TAGE * tag, grund: KYC_GRUND.abstand });
  const versuch = zeit(f.letzterVersuchAm);
  if (Number.isFinite(versuch) && Number(f.maraFehlversuche || 0) > 0) {
    spaetestens.push({ ab: versuch + KYC_FEHL_ABSTAND_STUNDEN * 3_600_000, grund: KYC_GRUND.fehlAbstand });
  }
  const mail = zeit(f.letzteMailAm);
  if (Number.isFinite(mail)) spaetestens.push({ ab: mail + KYC_MAIL_ABSTAND_STUNDEN * 3_600_000, grund: KYC_GRUND.mailAbstand });
  const sperre = spaetestens.filter((s) => s.ab > jetztMs).sort((x, y) => y.ab - x.ab)[0];
  if (sperre) return { art: "warten", nichtVor: naechstesFenster(new Date(sperre.ab)), grund: sperre.grund };
  if (!imVersandfenster(jetzt)) return { art: "warten", nichtVor: naechstesFenster(jetzt), grund: KYC_GRUND.fenster };
  return { art: "senden", nummer: Number(f.maraGesendet || 0) + 1, arten };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WORTE IN DER MAIL (Sie-Form, kein Preis, keine Frist, keine Drohung)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Die Bitte je Unterlage für die Liste „fehlt uns noch: …“ (bitteSatz, shared/fiaon-unterlagen-anfrage.ts).
 * „bitte_neu“ sagt ehrlich, dass die bisherige Fassung nicht reicht — ohne Schuld beim Kunden.
 * null = der Standardsatz (BITTE_STANDARD in fiaon-unterlagen-link.ts) für „fehlt“.
 */
export function kycBitte(art: KycArt, stand: "fehlt" | "bitte_neu"): string | null {
  if (stand === "fehlt") return null;
  return art === "ausweis"
    ? "eine neue, gut lesbare Kopie Ihres Ausweises (die bisherige reicht uns leider nicht): beim Personalausweis Vorder- und Rückseite, beim Reisepass die Seite mit Ihrem Foto und Ihren Daten"
    : "Ihre Kontoauszüge der letzten drei Monate vom Girokonto, auf dem Ihr Einkommen eingeht (die bisherigen reichen uns leider nicht — fehlende Monate laden Sie einfach dazu)";
}

/** Der Satz unter der Liste: die 1. und die 2. Erinnerung. Nie „letzte Erinnerung“ (E-368), nie eine Folge. */
export function kycAnlassSatz(nummer: number): string {
  return nummer <= 1
    ? "Kurze Erinnerung: Diese Unterlagen fehlen uns noch für Ihren laufenden Vertrag."
    : "Wir möchten Sie noch einmal kurz daran erinnern: Diese Unterlagen fehlen uns weiterhin für Ihren laufenden Vertrag.";
}
