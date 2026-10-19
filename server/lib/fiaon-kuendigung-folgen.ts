// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNGSFOLGEN NACHZIEHEN — täglich, ohne Klick (16.10.2026, E-391)
//
// Florentine (16.10.): „Kunden kündigen auf dem Portal, bekommen wir nicht mit, aber müssen wir bestätigen, wäre
// super wenn das automatisiert läuft, wenn er kündigt, kündigt er“ — und zehn Kunden, die „fristgerecht gekündigt“
// haben und trotzdem eine Rate nach dem Vertragsende zahlen sollen.
//
// Befund (nur lesend, 16.10.): 59 Menschen, 76 Raten, 4.719,24 € nach dem Vertragsende gekündigter Altverträge
// standen noch offen — gebucht vor dem 01.10. mit der alten Regel „höchste Rate bleibt fällig“. Seit E-368 mahnt
// sie niemand, aber Forderungsmanagement, Inkasso-Liste, Akte und Kundenbereich zeigten sie weiter. Die Bereinigung
// lag fertig als Sammelkarte (#33) im Mara-Steuerpult und wartete auf einen Klick. Dazu 16 nie gebuchte Anträge aus
// dem Formular (15 eindeutig) und 119 Anträge, die längst gebucht waren, aber noch „pending“ hießen.
//
// Was hier AUTOMATISCH läuft — nur, was AGB und Recht eindeutig vorgeben:
//   1. Raten, die NACH dem Vertragsende eines gekündigten Altvertrags fällig sind, stornieren (AGB § 6 a. F.:
//      niemand schuldet sie). Dieselbe Rechnung wie die Karte (ratenNachEndeFaelle → ratenNachVertragsende-
//      Stornieren, die Grenze steht in der Anweisung). Raten BIS zum Vertragsende bleiben offen (Justin: „offene
//      Rechnung vor Kündigung bleibt“). „Letzte Rate“ wird auf die letzte geschuldete gesetzt — dann beendet der
//      normale Weg (vertragEndePruefen) den Vertrag, sobald sie bezahlt ist.
//   2. Eindeutige Kündigungsanträge aus dem Formular buchen (§ 312k BGB: die Kündigung wirkt mit Zugang) — über
//      denselben Weg wie die Karte „Kündigung nie gebucht“ (antragBuchen → kuendigungDurchfuehren: Urkunde,
//      Bestätigungsmail, Verlauf). Eindeutig heißt: Identität bestätigt (Geburtsdatum passte), ein klares Ziel,
//      kein Widerruf im Text, und KEIN bezahlter Jahresvertrag (dort gewährt die Buchung Justins Kulanz — eine
//      Geldentscheidung, bleibt Karte) und keine bezahlte Bestellung jünger als 14 Tage (möglicher Widerruf mit
//      Erstattung — bleibt Karte).
//   3. Anträge schließen, die längst gebucht sind (der Mensch ist wirksam gekündigt) — sie hießen noch „pending“
//      und sperrten über die Doppelprüfung des Formulars einen neuen Antrag.
//
// Was NIE automatisch läuft: Erstattungen (bezahlte Raten nach dem Vertragsende, Widerrufe) — Geld, Justins
// Entscheidung. Rücknahme bleibt möglich: kuendigungZuruecknehmen holt den Grund „nach_vertragsende“ zurück.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { JAHRESVERTRAG_AB } from "@shared/fiaon-antrag-stand";
import { KUENDIGUNG_ANTRAEGE_SQL, KUENDIGUNG_WIRKSAM_SQL, tagDe } from "@shared/fiaon-kuendigung-regel";
import { ANNAHME_BELEGT_SQL } from "@shared/fiaon-jahresvertrag";

type Lauf = typeof sqlPool;

const WIDERRUFSFRIST_TAGE = 14;
const WIDERRUF_WORT = /widerruf|widerrufe|widerrufen|rücktritt|ruecktritt|zurücktreten/i;

/** Wer im Verlauf und auf der Urkunde als Bucher steht. */
export const AUTOMATIK_NAME = "FIAON (automatisch)";

export interface AutoBuchenLage {
  identitaetOffen: boolean;
  zielBuchbar: boolean;
  grund: string | null;
  /** Die Zielbestellung: Vertragsfassung, Zahlung, Anlage. */
  agbStand: string | null;
  bezahlt: boolean;
  bestellungAm: string | Date | null;
  antragAm: string | Date;
  /**
   * E-396 (19.10.2026): Annahme belegt (Vertrags-PDF oder Knopf). Dann ist die Kündigung eines bezahlten Jahresvertrags
   * keine Kulanzfrage mehr — sie wird zum Laufzeitende gebucht (mit Kulanz-Angebot) und gilt sofort, § 312k BGB.
   */
  annahmeBelegt?: boolean;
}

/**
 * Darf ein Formular-Antrag ohne Menschen gebucht werden? Rein — der Prüfstand hält jede Regel fest.
 * `ja: false` heißt: Er bleibt auf der Karte „Kündigung nie gebucht“ (Mara-Steuerpult), mit `warum`.
 */
export function automatischBuchbar(l: AutoBuchenLage): { ja: boolean; warum: string } {
  if (l.identitaetOffen) return { ja: false, warum: "Identität offen (ohne passendes Geburtsdatum) — das Team prüft zuerst." };
  if (!l.zielBuchbar) return { ja: false, warum: "Kein eindeutiges Paket — die Leitung entscheidet." };
  if (l.grund && WIDERRUF_WORT.test(l.grund)) return { ja: false, warum: "Der Text nennt einen Widerruf — Widerruf und Erstattung entscheidet die Leitung." };
  const agb = l.agbStand ? String(l.agbStand).slice(0, 10) : null;
  if (l.bezahlt && agb && agb >= JAHRESVERTRAG_AB && !l.annahmeBelegt) return { ja: false, warum: "Bezahlter Jahresvertrag ohne belegte Annahme — ein vorzeitiges Ende ist Kulanz, die entscheidet die Leitung." };
  const tage = (Date.parse(String(l.antragAm instanceof Date ? l.antragAm.toISOString() : l.antragAm))
    - Date.parse(String(l.bestellungAm instanceof Date ? l.bestellungAm.toISOString() : l.bestellungAm ?? ""))) / 86_400_000;
  if (l.bezahlt && Number.isFinite(tage) && tage < WIDERRUFSFRIST_TAGE) {
    return { ja: false, warum: "Bezahlt und binnen 14 Tagen nach Vertragsschluss — möglicher Widerruf (Erstattung), die Leitung entscheidet." };
  }
  if (l.bezahlt && agb && agb >= JAHRESVERTRAG_AB) return { ja: true, warum: "Eindeutig: Jahresvertrag mit belegter Annahme — gebucht zum Laufzeitende, mit Kulanz-Angebot (E-396)." };
  return { ja: true, warum: "Eindeutig: Identität bestätigt, ein Paket, keine Kulanz- oder Widerrufsfrage." };
}

/**
 * Einen offenen Formular-Antrag buchen, wenn er eindeutig ist (automatischBuchbar). Sonst nichts — er bleibt
 * Karte. Gibt zurück, was geschah. Wird nach jedem neuen Antrag (cancellation.ts) und im Tageslauf gerufen.
 */
export async function antragAutomatischBuchen(antragId: number): Promise<{ gebucht: boolean; warum: string }> {
  const { offeneKuendigungsantraege } = await import("./fiaon-kuendigung");
  const [antrag] = await offeneKuendigungsantraege(null, antragId);
  if (!antrag) return { gebucht: false, warum: "Antrag nicht mehr offen." };
  const [b] = antrag.ziel.ziel
    ? ((await sqlPool`SELECT agb_stand, payment_status, created_at, ${sqlPool.unsafe(ANNAHME_BELEGT_SQL("fiaon_applications"))} AS belegt
                         FROM fiaon_applications WHERE ref = ${antrag.ziel.ziel} LIMIT 1`) as any[])
    : [null];
  const urteil = automatischBuchbar({
    identitaetOffen: antrag.identitaetOffen, zielBuchbar: !!antrag.ziel.ziel && antrag.ziel.buchbar, grund: antrag.grund,
    agbStand: b?.agb_stand ? (b.agb_stand instanceof Date ? b.agb_stand.toISOString().slice(0, 10) : String(b.agb_stand)) : null,
    bezahlt: String(b?.payment_status ?? "") === "paid", bestellungAm: b?.created_at ?? null, antragAm: antrag.am,
    annahmeBelegt: b?.belegt === true,
  });
  if (!urteil.ja) return { gebucht: false, warum: urteil.warum };
  const { antragBuchen } = await import("../routes/fiaon-kuendigung");
  const erg = await antragBuchen(antrag, {
    grund: `${antrag.grund ? `${String(antrag.grund).slice(0, 160)} ` : ""}(Formular, automatisch gebucht — Kündigung wirkt mit Zugang, § 312k BGB)`,
    personId: antrag.personId,
    unterzeichner: { name: AUTOMATIK_NAME, rolle: "Kündigungseingang" },
    mail: true,
  });
  if (!erg?.ok) return { gebucht: false, warum: String(erg?.error || erg?.grund || "Buchung scheiterte.").slice(0, 200) };
  return { gebucht: true, warum: `${antrag.zielPaket ?? antrag.ziel.ziel} zum ${tagDe(new Date(antrag.am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }))} gekündigt.` };
}

export interface FolgenErgebnis {
  ratenStorniert: number;
  centsStorniert: number;
  vertraege: number;
  letzteRateKorrigiert: number;
  antraegeGebucht: number;
  antraegeOffen: number;
  antraegeGeschlossen: number;
  fehler: number;
}

/** 1 · Raten nach dem Vertragsende stornieren, „letzte Rate“ richtigstellen, Sammelkarte schließen. */
async function ratenNachEndeNachziehen(erg: FolgenErgebnis, lauf: Lauf): Promise<void> {
  const { ratenNachEndeFaelle } = await import("./fiaon-mara-entscheidungen");
  const { ratenNachVertragsendeStornieren } = await import("./fiaon-raten-storno");
  const faelle = await ratenNachEndeFaelle(lauf);
  for (const f of faelle) {
    try {
      const weg = await lauf.begin(async (tx: any) => {
        const w = await ratenNachVertragsendeStornieren(f.ref, f.raten.map((r) => r.id), f.ende, tx);
        if (!w.length) return w;
        // Die letzte GESCHULDETE Rate (fällig bis zum Ende). Nur nach unten korrigieren — nie eine Rate nachfordern.
        const [m] = (await tx`
          SELECT MAX(rate_nr)::int AS nr FROM fiaon_abo_raten
           WHERE ref = ${f.ref} AND faellig_am IS NOT NULL AND faellig_am <= ${f.ende}::date
             AND (storniert_am IS NULL OR storno_grund <> 'nach_vertragsende')`) as any[];
        const geschuldet = m?.nr != null ? Number(m.nr) : null;
        if (geschuldet != null) {
          const k = (await tx`
            UPDATE fiaon_applications SET letzte_rate_nr = ${geschuldet}, updated_at = NOW()
             WHERE ref = ${f.ref} AND letzte_rate_nr IS NOT NULL AND letzte_rate_nr > ${geschuldet} RETURNING ref`) as any[];
          if (k.length) erg.letzteRateKorrigiert++;
        }
        const summe = w.reduce((s, r) => s + r.betrag_cents, 0);
        await tx`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
          VALUES (${f.ref}, ${f.personId}, NULL, ${AUTOMATIK_NAME}, 'system',
                  ${`${w.length === 1 ? "Rate" : "Raten"} ${w.map((r) => r.rate_nr).join(", ")} (${(summe / 100).toFixed(2).replace(".", ",")} €) nach dem Vertragsende (${tagDe(f.ende)}) automatisch storniert — nicht geschuldet (Vertrag vor dem 03.09.2026, AGB § 6). `
                    + `${f.bisEnde.length ? `Bis zum Vertragsende bleibt offen: Rate ${f.bisEnde.map((r) => r.rate_nr).join(", ")}.` : "Bis zum Vertragsende ist nichts mehr offen."}${geschuldet != null ? ` Letzte geschuldete Rate: ${geschuldet}.` : ""}`}, NOW())`;
        return w;
      });
      if (weg.length) {
        erg.ratenStorniert += weg.length;
        erg.centsStorniert += weg.reduce((s: number, r: any) => s + r.betrag_cents, 0);
        erg.vertraege++;
      }
    } catch (e) {
      erg.fehler++;
      console.error(`[KÜNDIGUNGSFOLGEN] Storno nach Vertragsende ${f.ref}:`, String((e as Error)?.message ?? e).slice(0, 200));
    }
  }
  // Die Sammelkarte im Mara-Steuerpult ist damit erledigt — sie schließt sich, statt auf einen Klick zu warten.
  if (erg.vertraege && !(await ratenNachEndeFaelle(lauf)).length) {
    await lauf`
      UPDATE fiaon_mara_entscheidungen
         SET status = 'erledigt_von_selbst', entschieden_am = NOW(), spaeter_bis = NULL, aktualisiert_am = NOW(),
             ergebnis = ${`Automatisch erledigt (Tageslauf): ${erg.ratenStorniert} Raten nach dem Vertragsende storniert, ${(erg.centsStorniert / 100).toFixed(2).replace(".", ",")} €.`}
       WHERE art = 'raten_nach_ende' AND status IN ('offen', 'spaeter')`.catch(() => {});
  }
}

/** 2 · Eindeutige Formular-Anträge buchen. */
async function antraegeBuchen(erg: FolgenErgebnis, lauf: Lauf): Promise<void> {
  const ids = (await lauf.unsafe(`SELECT DISTINCT kr_u.antrag_id FROM (${KUENDIGUNG_ANTRAEGE_SQL}) kr_u ORDER BY kr_u.antrag_id LIMIT 200`)) as any[];
  for (const z of ids) {
    try {
      const r = await antragAutomatischBuchen(Number(z.antrag_id));
      if (r.gebucht) erg.antraegeGebucht++; else erg.antraegeOffen++;
    } catch (e) {
      erg.fehler++;
      console.error(`[KÜNDIGUNGSFOLGEN] Antrag ${z.antrag_id}:`, String((e as Error)?.message ?? e).slice(0, 200));
    }
  }
}

/**
 * 3 · Anträge schließen, die längst gebucht sind: Status „pending“, der Mensch ist wirksam gekündigt (KUENDIGUNG_
 * WIRKSAM_SQL: ein gekündigtes Stufenpaket und KEIN laufendes, bezahltes, ungekündigtes daneben) — es gibt also
 * nichts mehr, worauf der Antrag zielen könnte. Status „confirmed“ wie im Chefbüro beim Buchen.
 */
async function erledigteAntraegeSchliessen(erg: FolgenErgebnis, lauf: Lauf): Promise<void> {
  const z = (await lauf.unsafe(`
    UPDATE cancellation_requests c
       SET status = 'confirmed', processed_by = $1, processed_at = NOW(), updated_at = NOW(),
           admin_note = TRIM(COALESCE(c.admin_note, '') || ' ' || $2)
      FROM (
        SELECT c2.id
          FROM cancellation_requests c2
          JOIN fiaon_applications a ON a.ref = c2.ref
          LEFT JOIN fiaon_persons hp ON hp.id = a.person_id
         WHERE c2.status = 'pending'
           AND a.person_id IS NOT NULL
           AND ${KUENDIGUNG_WIRKSAM_SQL("COALESCE(hp.merged_into_person_id, a.person_id)")}
           AND c2.id NOT IN (SELECT kr_u.antrag_id FROM (${KUENDIGUNG_ANTRAEGE_SQL}) kr_u)
      ) w
     WHERE c.id = w.id
    RETURNING c.id`, [AUTOMATIK_NAME, "[Schon gebucht — Antrag im Tageslauf abgeschlossen (E-391)]"])) as any[];
  erg.antraegeGeschlossen += z.length;
}

let laeuft = false;
/** Der Tagesschritt (aus aboTageslauf). Jede Stufe für sich — scheitert eine, laufen die anderen. */
export async function kuendigungsFolgenNachziehen(lauf: Lauf = sqlPool): Promise<FolgenErgebnis> {
  const erg: FolgenErgebnis = { ratenStorniert: 0, centsStorniert: 0, vertraege: 0, letzteRateKorrigiert: 0, antraegeGebucht: 0, antraegeOffen: 0, antraegeGeschlossen: 0, fehler: 0 };
  if (laeuft) return erg;
  laeuft = true;
  try {
    await ratenNachEndeNachziehen(erg, lauf).catch((e) => { erg.fehler++; console.error("[KÜNDIGUNGSFOLGEN] Raten:", e); });
    await antraegeBuchen(erg, lauf).catch((e) => { erg.fehler++; console.error("[KÜNDIGUNGSFOLGEN] Anträge:", e); });
    await erledigteAntraegeSchliessen(erg, lauf).catch((e) => { erg.fehler++; console.error("[KÜNDIGUNGSFOLGEN] Schließen:", e); });
  } finally { laeuft = false; }
  if (erg.ratenStorniert || erg.antraegeGebucht || erg.antraegeGeschlossen || erg.fehler) {
    console.log(`[KÜNDIGUNGSFOLGEN] ${erg.ratenStorniert} Raten nach Vertragsende storniert (${erg.vertraege} Verträge, ${(erg.centsStorniert / 100).toFixed(2)} €), `
      + `${erg.letzteRateKorrigiert} „letzte Rate“ korrigiert, ${erg.antraegeGebucht} Anträge gebucht (${erg.antraegeOffen} bleiben Karte), ${erg.antraegeGeschlossen} erledigte Anträge geschlossen, ${erg.fehler} Fehler.`);
  }
  return erg;
}
