// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER RUHIGE ZAHLUNGSTAKT FÜR UNTERNEHMEN (17.09.2026, E-188)
//
// ── DIE LÜCKE ─────────────────────────────────────────────────────────────
// Offene Global-Bestellungen sind bewusst aus der Erinnerungsmaschine der
// Privatkunden genommen (fiaon-antrag.ts claimReminderBatch, Rückholung S1–S5):
// Die Texte dort sprechen von Auskunft, Einträgen und Raten, und seit E-182
// gehen sie zweimal täglich ohne Obergrenze raus. An ein Unternehmen mit einem
// Auftrag über 2.499 € und mehr gehört davon nichts. Nur: Danach passierte GAR
// nichts mehr — ein unterschriebener Auftrag ohne Zahlung lag still, bis es
// jemandem auffiel.
//
// ── DER TAKT ──────────────────────────────────────────────────────────────
//   Tag  3 nach dem Auftrag → Mail global_zahlung_erinnerung (Stufe 1)
//   Tag  7                  → dieselbe Mail, Stufe 2 („zweite und letzte")
//   Tag 10                  → KEINE Mail mehr, sondern eine dringende Aufgabe an
//                             die zuständige Person: „… anrufen".
// Gezählt werden Kalendertage in Berlin. Jede Stufe geht genau einmal raus
// (Marken-Spalten an der Auftragsakte, gesetzt VOR dem Versand und bei einem
// Fehlschlag zurückgenommen), nur solange der Auftrag offen ist, nur im
// Sendefenster der Kundenmails (Berlin 8–20 Uhr, Montag bis Samstag). Fällt ein
// Stichtag auf einen Sonntag oder in die Nacht, holt der nächste Takt ihn nach.
//
// ── WAS DER TAKT NICHT TUT ────────────────────────────────────────────────
//   · Er mahnt nicht. Kein „letzte Frist", keine Gebühr, keine Stufe 3.
//   · Er erinnert niemanden, der auf der Zahlungsseite „überwiesen" gemeldet
//     hat — der bekommt keine Mail „Zahlung steht aus", während seine
//     Überweisung unterwegs ist. Die Aufgabe am zehnten Tag entsteht trotzdem
//     und sagt es der zuständigen Person.
//   · Er schreibt nie an eine hart unzustellbare Adresse (Rückläufer, Spam-
//     Meldung): Die Stufe gilt dann als erledigt, der Grund steht in der Akte
//     und in der Aufgabe. Die Werbesperre hält ihn NICHT auf — es ist
//     Zahlungspost aus einem unterschriebenen Vertrag (fiaon-mail-frequenz.ts).
//   · Er fasst kein Geld an und ändert keinen Status.
//
// ── PRÜFBAR OHNE DATENBANK ────────────────────────────────────────────────
// Die Entscheidung „welche Stufe ist jetzt dran?" ist eine reine Funktion
// (zahlungstaktStufe). scripts/pruef-global-querschnitt.ts spielt sie durch:
// Tag 3/7/10, Wochenende, Nacht, Zeitumstellung, Idempotenz, bezahlt/storniert.
//
// Registriert in routes.ts als tageslauf("global_zahlung_takt", …, 30 Minuten).
// ═══════════════════════════════════════════════════════════════════════════
import { berlinOffsetMinutes, berlinDatum, berlinWochentag } from "./fiaon-time";

/** Tag nach dem Auftrag (Berliner Kalendertage), an dem die Stufe frühestens fällig wird. */
export const TAKT_TAGE = { erinnerung1: 3, erinnerung2: 7, aufgabe: 10 } as const;
/** Zwischen zwei Erinnerungen liegen mindestens so viele Kalendertage — auch wenn Stufe 1 verspätet rausging. */
export const TAKT_MINDESTABSTAND_TAGE = 2;
/** Nach einem gescheiterten Versuch ruht der Auftrag so lange — sonst stünde alle 30 Minuten ein Fehlschlag im Protokoll. */
const RUHE_NACH_FEHLVERSUCH_STUNDEN = 6;

export type TaktStufe = "erinnerung_1" | "erinnerung_2" | "aufgabe";

export interface TaktStand {
  /** Der Stand der Bestellung, wie ihn die Auftragsseite zeigt: nur „offen" wird erinnert. */
  status: "offen" | "bezahlt" | "gestartet" | "abgeschlossen" | "storniert" | string;
  erstelltAm: Date;
  erinnerung1Am: Date | null;
  erinnerung2Am: Date | null;
  aufgabeAm: Date | null;
  /** Der Kunde hat auf der Zahlungsseite gemeldet, dass er überwiesen hat. */
  zahlungGemeldetAm?: Date | null;
}

// ── Reine Zeitrechnung (Berlin) ──────────────────────────────────────────────
/** Minuten seit Mitternacht in Berlin — über den Offset-Helfer des Hauses, nie über Number(format()). */
function berlinMinuten(at: Date): number {
  const m = at.getUTCHours() * 60 + at.getUTCMinutes() + berlinOffsetMinutes(at);
  return ((m % 1440) + 1440) % 1440;
}

/** Ganze Kalendertage zwischen zwei Zeitpunkten, gezählt an der Berliner Tagesgrenze. */
export function berlinTageSeit(von: Date, bis: Date): number {
  const [y1, m1, d1] = berlinDatum(von).split("-").map(Number);
  const [y2, m2, d2] = berlinDatum(bis).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Das Sendefenster der Kundenmails: Berlin 8–20 Uhr, Montag bis Samstag. */
export function imSendefenster(jetzt: Date): boolean {
  const min = berlinMinuten(jetzt);
  if (min < 8 * 60 || min >= 20 * 60) return false;
  return berlinWochentag(berlinDatum(jetzt)) <= 6;
}

/**
 * Welche Stufe ist JETZT dran? `null` = nichts zu tun.
 *
 * Rein: keine Datenbank, keine Uhr außer dem Parameter. Dieselbe Eingabe ergibt
 * dieselbe Antwort — und sobald die Marke einer Stufe gesetzt ist, liefert die
 * Funktion diese Stufe nie wieder (Idempotenz).
 */
export function zahlungstaktStufe(stand: TaktStand, jetzt: Date): TaktStufe | null {
  if (stand.status !== "offen") return null;
  if (!imSendefenster(jetzt)) return null;
  const tage = berlinTageSeit(stand.erstelltAm, jetzt);
  if (tage >= TAKT_TAGE.aufgabe) return stand.aufgabeAm ? null : "aufgabe";
  // Wer „überwiesen" gemeldet hat, bekommt keine Mail „Zahlung steht aus" — nur die Aufgabe am zehnten Tag.
  if (stand.zahlungGemeldetAm) return null;
  if (tage >= TAKT_TAGE.erinnerung2) {
    if (stand.erinnerung2Am) return null;
    // Stufe 1 ging verspätet raus (Sonntag, Ausfall)? Dann nicht am nächsten Tag gleich die zweite hinterher.
    if (stand.erinnerung1Am && berlinTageSeit(stand.erinnerung1Am, jetzt) < TAKT_MINDESTABSTAND_TAGE) return null;
    return "erinnerung_2";
  }
  if (tage >= TAKT_TAGE.erinnerung1) return stand.erinnerung1Am ? null : "erinnerung_1";
  return null;
}

/**
 * Welcher Anlass-Satz in die Mail gehört. Stufe 2 sagt „zweite und letzte
 * Erinnerung" — das stimmt nur, wenn es eine erste GAB. Ging Stufe 1 nie raus
 * (Dienst stand, Adresse war vorübergehend gesperrt), spricht die Mail wie eine erste.
 */
export function taktAnlassStufe(stufe: TaktStufe, ersteGingRaus: boolean): 1 | 2 {
  return stufe === "erinnerung_2" && ersteGingRaus ? 2 : 1;
}

// ── Schema: die Marken an der Auftragsakte ───────────────────────────────────
let spaltenBereit: Promise<void> | null = null;
export async function ensureTaktSpalten(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      const { sqlPool } = await import("./db-pool");
      // lock_timeout wie im Bestellweg: Diese Zeile darf nie hinter einer langen Transaktion Schlange stehen.
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(`
          ALTER TABLE fiaon_global_auftraege
            ADD COLUMN IF NOT EXISTS zahlung_erinnerung_1_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS zahlung_erinnerung_2_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS zahlung_aufgabe_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS zahlung_takt_versuch_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS zahlung_takt_hinweis TEXT`);
      });
    })().catch((e) => { spaltenBereit = null; throw e; });
  }
  return spaltenBereit;
}

export interface TaktErgebnis {
  geprueft: number; erinnerung1: number; erinnerung2: number; aufgaben: number; zurueckgehalten: number; fehler: number;
  grund?: string;
}

const MARKE: Record<TaktStufe, string> = {
  erinnerung_1: "zahlung_erinnerung_1_am",
  erinnerung_2: "zahlung_erinnerung_2_am",
  aufgabe: "zahlung_aufgabe_am",
};

/** Der Lauf. Wirft bei einem Datenbankfehler — die Lauf-Historie (fiaon-crons.ts) hält ihn fest. */
export async function globalZahlungTaktLauf(jetzt: Date = new Date()): Promise<TaktErgebnis> {
  const erg: TaktErgebnis = { geprueft: 0, erinnerung1: 0, erinnerung2: 0, aufgaben: 0, zurueckgehalten: 0, fehler: 0 };
  if (!imSendefenster(jetzt)) return { ...erg, grund: "außerhalb des Sendefensters (Berlin 8–20 Uhr, Mo–Sa)" };

  const { sqlPool } = await import("./db-pool");
  // Solange es keinen einzigen Global-Auftrag gab, gibt es die Tabelle nicht — dann legt dieser Lauf sie auch nicht an.
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_auftraege') AS tabelle`) as any[];
  if (!t?.tabelle) return { ...erg, grund: "noch kein Global-Auftrag" };
  await ensureTaktSpalten();

  const zeilen = (await sqlPool`
    SELECT g.ref, g.created_at, g.zahlung_erinnerung_1_am, g.zahlung_erinnerung_2_am, g.zahlung_aufgabe_am,
           a.payment_status, a.cancelled_at, a.archived_at, a.claimed_paid_at
      FROM fiaon_global_auftraege g
      JOIN fiaon_applications a ON a.ref = g.ref
     WHERE g.status = 'offen'
       AND a.merged_into IS NULL
       AND g.zahlung_aufgabe_am IS NULL
       AND g.created_at < NOW() - INTERVAL '2 days'
       AND (g.zahlung_takt_versuch_am IS NULL OR g.zahlung_takt_versuch_am < NOW() - (${RUHE_NACH_FEHLVERSUCH_STUNDEN} || ' hours')::interval)
     ORDER BY g.created_at ASC
     LIMIT 200`) as any[];

  for (const z of zeilen) {
    erg.geprueft++;
    const ref = String(z.ref);
    const offen = !z.cancelled_at && !z.archived_at && !["paid", "cancelled", "superseded"].includes(String(z.payment_status));
    const stufe = zahlungstaktStufe({
      status: offen ? "offen" : "nicht_offen",
      erstelltAm: new Date(z.created_at),
      erinnerung1Am: z.zahlung_erinnerung_1_am ? new Date(z.zahlung_erinnerung_1_am) : null,
      erinnerung2Am: z.zahlung_erinnerung_2_am ? new Date(z.zahlung_erinnerung_2_am) : null,
      aufgabeAm: z.zahlung_aufgabe_am ? new Date(z.zahlung_aufgabe_am) : null,
      zahlungGemeldetAm: z.claimed_paid_at ? new Date(z.claimed_paid_at) : null,
    }, jetzt);
    if (!stufe) continue;
    try {
      const was = stufe === "aufgabe" ? await aufgabeAnlegen(ref) : await erinnerungSenden(ref, stufe, !!z.zahlung_erinnerung_1_am);
      if (was === "erledigt") {
        if (stufe === "erinnerung_1") erg.erinnerung1++; else if (stufe === "erinnerung_2") erg.erinnerung2++; else erg.aufgaben++;
      } else if (was === "zurueckgehalten") erg.zurueckgehalten++;
    } catch (e) {
      erg.fehler++;
      console.error(`[GLOBAL-ZAHLUNGSTAKT] ${ref}: ${stufe} abgebrochen:`, e);
      await sqlPool`UPDATE fiaon_global_auftraege SET zahlung_takt_versuch_am = NOW(), zahlung_takt_hinweis = ${`Fehler bei ${stufe}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500)} WHERE ref = ${ref}`.catch(() => {});
    }
  }
  if (erg.erinnerung1 + erg.erinnerung2 + erg.aufgaben + erg.fehler > 0) {
    console.log(`[GLOBAL-ZAHLUNGSTAKT] ${erg.geprueft} offene Aufträge geprüft: ${erg.erinnerung1}× Erinnerung 1, ${erg.erinnerung2}× Erinnerung 2, ${erg.aufgaben}× Aufgabe „anrufen“, ${erg.zurueckgehalten} zurückgehalten, ${erg.fehler} Fehler.`);
  }
  return erg;
}

/**
 * Die Marke einer Stufe nehmen — EIN UPDATE mit Bedingung, damit zwei Instanzen
 * oder ein überholender Takt dieselbe Stufe nicht zweimal auslösen.
 */
async function markeNehmen(ref: string, stufe: TaktStufe): Promise<boolean> {
  const { sqlPool } = await import("./db-pool");
  const spalte = MARKE[stufe];
  const frei = (await sqlPool.unsafe(
    `UPDATE fiaon_global_auftraege SET ${spalte} = NOW(), zahlung_takt_versuch_am = NULL, updated_at = NOW()
      WHERE ref = $1 AND ${spalte} IS NULL AND status = 'offen' RETURNING ref`, [ref])) as any[];
  return frei.length > 0;
}
async function markeZurueck(ref: string, stufe: TaktStufe, hinweis: string): Promise<void> {
  const { sqlPool } = await import("./db-pool");
  await sqlPool.unsafe(
    `UPDATE fiaon_global_auftraege SET ${MARKE[stufe]} = NULL, zahlung_takt_versuch_am = NOW(), zahlung_takt_hinweis = $2, updated_at = NOW() WHERE ref = $1`,
    [ref, hinweis.slice(0, 500)]).catch(() => {});
}

async function erinnerungSenden(ref: string, stufe: "erinnerung_1" | "erinnerung_2", ersteGingRaus: boolean): Promise<"erledigt" | "zurueckgehalten" | "nichts"> {
  const { sqlPool } = await import("./db-pool");
  const { globalAkteLesen, globalBestellungLesen, globalMailSenden, globalSpracheVon, globalVerlauf } = await import("./fiaon-global-auftrag");
  const { GLOBAL_ERINNERUNG_ANLASS } = await import("../mail/vorlagen/global");
  const akte = await globalAkteLesen(ref);
  const b = await globalBestellungLesen(ref);
  if (!akte || !b || !b.payment_reference) return "nichts";
  const an = String(akte.email || "").trim().toLowerCase();
  const nr = stufe === "erinnerung_1" ? 1 : 2;

  // ── Die Frequenzbremse — dieselbe Frage wie an der einen Mail-Tür ──────────
  // Global-Mails gehen direkt über den Motor (Anhänge, eigene Nutzlast) und damit an
  // sendMakeWebhookMitGrund vorbei; die Prüfung steht deshalb ausdrücklich hier.
  const { darfAnEmpfaenger } = await import("./fiaon-mail-frequenz");
  const urteil = await darfAnEmpfaenger(an, "global_zahlung_erinnerung");
  if (!urteil.ok) {
    const hart = /unzustellbar/i.test(String(urteil.grund));
    if (hart) {
      // Dorthin kommt nie wieder etwas an — die Stufe gilt als erledigt, der Grund steht in Akte und Aufgabe.
      if (await markeNehmen(ref, stufe)) {
        await sqlPool`UPDATE fiaon_global_auftraege SET zahlung_takt_hinweis = ${`Erinnerung ${nr} NICHT versandt: ${urteil.grund}`} WHERE ref = ${ref}`.catch(() => {});
        await globalVerlauf(ref, `FIAON Global: Zahlungserinnerung ${nr} NICHT verschickt — ${urteil.grund}. Bitte die E-Mail-Adresse am Telefon klären.`);
      }
      return "zurueckgehalten";
    }
    await sqlPool`UPDATE fiaon_global_auftraege SET zahlung_takt_versuch_am = NOW(), zahlung_takt_hinweis = ${`Erinnerung ${nr} zurückgehalten: ${urteil.grund}`} WHERE ref = ${ref}`.catch(() => {});
    return "zurueckgehalten";
  }

  if (!(await markeNehmen(ref, stufe))) return "nichts";
  const sprache = globalSpracheVon(akte);
  const mail = await globalMailSenden("global_zahlung_erinnerung", akte, b, {
    zusatz: { anlass: GLOBAL_ERINNERUNG_ANLASS[sprache][taktAnlassStufe(stufe, ersteGingRaus)] },
    ausgeloestVon: "System (FIAON Global, Zahlungstakt)",
  });
  if (!mail.ok) {
    await markeZurueck(ref, stufe, `Erinnerung ${nr} ging nicht raus: ${mail.grund}`);
    throw new Error(`Erinnerung ${nr} ging nicht raus: ${mail.grund}`);
  }
  await globalVerlauf(ref, `FIAON Global: Zahlungserinnerung ${nr} von 2 an ${an || "den Kunden"} verschickt (Tag ${stufe === "erinnerung_1" ? TAKT_TAGE.erinnerung1 : TAKT_TAGE.erinnerung2} nach dem Auftrag, mit Knopf zur Zahlungsseite und Link zu „Mein Auftrag“).`);
  return "erledigt";
}

async function aufgabeAnlegen(ref: string): Promise<"erledigt" | "nichts"> {
  const { sqlPool } = await import("./db-pool");
  const { globalAkteLesen, globalBestellungLesen, globalEinstellungen, globalVerlauf, globalEur } = await import("./fiaon-global-auftrag");
  const { paket: katalogPaket } = await import("@shared/fiaon-pakete");
  const { absoluteUrl } = await import("../fiaon-base-url");
  const akte = await globalAkteLesen(ref);
  const b = await globalBestellungLesen(ref);
  if (!akte || !b) return "nichts";
  // Die Marke zuerst: auftragFuerKunden öffnet eine erledigte Aufgabe mit demselben Schlüssel wieder —
  // diese hier soll genau einmal entstehen.
  if (!(await markeNehmen(ref, "aufgabe"))) return "nichts";

  const [marken] = (await sqlPool`
    SELECT zahlung_erinnerung_1_am, zahlung_erinnerung_2_am, zahlung_takt_hinweis FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  const ap = typeof akte.ansprechpartner === "object" && akte.ansprechpartner ? akte.ansprechpartner : (() => { try { return JSON.parse(String(akte.ansprechpartner)); } catch { return {}; } })();
  const firma = String(akte.firma_name || b.company_name || b.contact_name || ref);
  const kat = katalogPaket(akte.paket_key);
  const tagText = (v: unknown) => new Date(String(v)).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  const erinnert = [
    marken?.zahlung_erinnerung_1_am ? `Erinnerung 1 am ${tagText(marken.zahlung_erinnerung_1_am)}` : null,
    marken?.zahlung_erinnerung_2_am ? `Erinnerung 2 am ${tagText(marken.zahlung_erinnerung_2_am)}` : null,
  ].filter(Boolean).join(", ");
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const anlage = await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref,
      titel: `FIAON Global: offener Auftrag seit zehn Tagen — ${firma} anrufen`,
      text: [
        `${firma} hat am ${tagText(akte.created_at)} ${kat?.label ?? String(b.pack_name || akte.paket_key)} für ${globalEur(Math.round(Number(b.amount_due || 0) * 100))} einmalig unterschrieben — ein Zahlungseingang ist bis heute nicht gebucht.`,
        `Ansprechpartner: ${[ap.anrede, ap.vorname, ap.nachname].filter(Boolean).join(" ") || String(b.contact_name || "—")}${ap.funktion ? `, ${ap.funktion}` : ""} · ${ap.email ?? akte.email ?? "—"} · ${ap.telefon ?? "—"}`,
        erinnert ? `Per Mail erinnert: ${erinnert}. Weitere Erinnerungsmails gehen NICHT raus — ab jetzt zählt dein Anruf.` : "Per Mail wurde NICHT erinnert — ab jetzt zählt dein Anruf.",
        marken?.zahlung_takt_hinweis ? `Hinweis aus dem Takt: ${marken.zahlung_takt_hinweis}` : null,
        b.claimed_paid_at ? `Der Kunde hat am ${tagText(b.claimed_paid_at)} auf der Zahlungsseite gemeldet, dass er überwiesen hat — deshalb bekam er keine Erinnerung. Bitte freundlich nach dem Überweisungsbeleg fragen; den Eingang bucht die Zahlungsstelle.` : null,
        `Bitte anrufen und klären: Kommt die Zahlung, gibt es Fragen zum Auftrag, oder will das Unternehmen den Auftrag nicht mehr? Zahlungsseite für den Kunden: ${b.payment_reference ? absoluteUrl(`/zahlung/${b.payment_reference}`) : "—"} (Verwendungszweck ${b.payment_reference ?? "—"}).`,
        "Will der Kunde nicht mehr: bitte der Leitung Bescheid geben — sie storniert den Auftrag unter /chef/s/global-auftraege (Knopf „Auftrag stornieren“).",
      ].filter(Boolean).join("\n"),
      dringend: true, schluessel: `global:${ref}:zahlung-tag10`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      agentId: akte.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : (await globalEinstellungen()).zustaendigAgentId,
      anlageText: "Zehn Tage nach dem Auftrag ist keine Zahlung gebucht.",
    });
    if (!anlage.id) throw new Error("Aufgabe wurde nicht angelegt");
  } catch (e) {
    await markeZurueck(ref, "aufgabe", `Aufgabe „anrufen“ nicht angelegt: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
  await globalVerlauf(ref, "FIAON Global: Zehn Tage nach dem Auftrag ist keine Zahlung gebucht — dringende Aufgabe „anrufen“ an die zuständige Person. Keine weiteren Erinnerungsmails.");
  return "erledigt";
}
