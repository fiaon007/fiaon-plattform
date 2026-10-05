// ═══════════════════════════════════════════════════════════════════════════
// LIMIT-GESPRÄCH — DIE TATSACHEN AUS DER DATENBANK (05.10.2026, E-283)
//
// Justin (05.10.2026): „Limit-Gespräch muss der Kunde buchen in der App, also
// sowas wie ‚Limit-Erhöhung anfragen', das geht aber nur alle 3 Monate."
//
// Die REGEL steht rein in shared/fiaon-limit-gespraech.ts (limitAnspruchAus).
// Diese Datei sammelt nur die Tatsachen, die die Regel braucht, aus denselben
// Quellen wie der Kundenbereich:
//   Paket und Zahlung   → die Bestellung, auf der die Sitzung steht (wie /bereich)
//   Global-Kunde        → istGlobalKunde (E-272, fiaon-global-kunde.ts)
//   Startgespräch       → startgespraechGefuehrt — dieselbe Abfrage, die /bereich
//                         als onboardingGelaufen liest (sie wohnt jetzt HIER, der
//                         Bereich ruft sie; eine Fassung, nicht zwei)
//   Rückstand           → älteste offene Rate vor heute (Berlin), personenweit wie
//                         die Situation der Akte (fiaon-office-vertrieb.ts)
//   Vertrag beendet     → gekündigt UND Vertragsende erreicht (wie vertrag.beendet)
//   Anker               → aboAnker (fiaon-abo.ts): paid_at → Bankbuchung → Abschluss
//   Limit-Gespräche     → fiaon_termine quelle „limit_gespraech"; gezählt wird mit
//                         limitGezaehlt (die EINE Fassung, in shared/)
//
// Gebucht wird über den gemeinsamen Buchungsteil der öffentlichen Terminroute
// (kundenBuchungAusfuehren, server/routes/fiaon-termin.ts): Zeit war angeboten,
// Vertretungs-Notiz, buchungAnwenden, Bestätigung, Protokoll. Es gibt KEINE
// zweite Buchungslogik — nur die Art steht hier fest auf „limit_gespraech".
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { nennformSql } from "@shared/fiaon-mitarbeiter-name";
import {
  limitAnspruchAus, limitGezaehlt, paketMitLimit, LIMIT_HERKUNFT, LIMIT_PAKETE, LIMIT_QUELLE,
  type LimitAnspruch, type LimitGebucht, type LimitTermin,
} from "@shared/fiaon-limit-gespraech";

type Lauf = typeof sqlPool;

export interface LimitStand extends LimitAnspruch {
  ref: string;
  personId: number | null;
}

/**
 * Hat das Startgespräch stattgefunden? Zwei Belege, beide belastbar: ein als
 * erledigt vermerkter Onboarding-Termin oder ein dokumentiertes Gespräch im
 * Verlauf. Wörtlich die Abfrage, die bis E-283 in GET /kunde/:ref/bereich
 * stand (onboardingGelaufen, Begründung dort) — der Bereich ruft jetzt diese
 * Funktion, damit Bereich und Limit-Gespräch nie verschieden antworten.
 */
export async function startgespraechGefuehrt(personId: number | null, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!personId) return false;
  const [ob] = (await lauf`
    SELECT
      EXISTS (SELECT 1 FROM fiaon_termine t
               WHERE t.person_id = ${personId}
                 AND t.quelle = 'onboarding_call' AND t.status = 'erledigt') AS termin_erledigt,
      EXISTS (SELECT 1 FROM fiaon_contact_log cl
               WHERE cl.person_id = ${personId}
                 AND cl.type IN ('onboarding', 'startgespraech')) AS gespraech_im_verlauf
  `) as any[];
  return !!(ob?.termin_erledigt || ob?.gespraech_im_verlauf);
}

/** Nummer der ältesten überfälligen Rate (Berliner Tag) — personenweit, ohne Person an der Bestellung. */
async function rueckstandNr(ref: string, personId: number | null, lauf: Lauf): Promise<number | null> {
  const [r] = (personId
    ? await lauf`
        SELECT r.rate_nr FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL
          AND r.status <> 'bezahlt' AND r.storniert_am IS NULL
          AND r.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date
        ORDER BY r.faellig_am LIMIT 1`
    : await lauf`
        SELECT r.rate_nr FROM fiaon_abo_raten r
        WHERE r.ref = ${ref} AND r.status <> 'bezahlt' AND r.storniert_am IS NULL
          AND r.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date
        ORDER BY r.faellig_am LIMIT 1`) as any[];
  return r ? Number(r.rate_nr) : null;
}

/**
 * Der Anspruch für die Bestellung `ref` (die Sitzung des Kunden). null, wenn es
 * die Bestellung nicht gibt. `opts.startGefuehrt` übernimmt der Bereich, der die
 * Tatsache schon gelesen hat — dieselbe Abfrage, kein zweiter Weg.
 */
export async function limitAnspruchFuer(
  ref: string, lauf: Lauf = sqlPool, opts: { startGefuehrt?: boolean } = {},
): Promise<LimitStand | null> {
  const [a] = (await lauf`
    SELECT ref, person_id, pack_key, payment_status, gekuendigt_am, vertrag_ende_am
    FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1
  `) as any[];
  if (!a) return null;
  const personId = a.person_id ? Number(a.person_id) : null;
  const heuteIso = berlinToday();
  const bezahlt = String(a.payment_status) === "paid";
  const beendet = !!a.gekuendigt_am && !!a.vertrag_ende_am && new Date(a.vertrag_ende_am).getTime() <= Date.now();

  // E-272: Global-Kunden stehen in keinem Privat-Ablauf. Der Rest wird für sie
  // gar nicht erst gelesen.
  let globalKunde = false;
  if (personId) {
    const { istGlobalKunde } = await import("./fiaon-global-kunde");
    globalKunde = await istGlobalKunde(personId, lauf);
  }
  const leer = { startGefuehrt: false, ankerIso: null, rueckstandNr: null, letztesGezaehltIso: null, gebucht: null, letztes: null };
  if (globalKunde || !paketMitLimit(a.pack_key)) {
    return { ...limitAnspruchAus({ paketKey: a.pack_key, bezahlt, globalKunde, beendet, heuteIso, ...leer }), ref, personId };
  }

  // Die Limit-Gespräche dieser Person — wenige Zeilen; gezählt wird in TypeScript
  // mit limitGezaehlt, damit die Regel nur EINMAL existiert.
  const termine = personId ? ((await lauf`
    SELECT t.id, t.beginn, t.status, t.erledigt_am, t.storno_token, t.agent_id, t.quelle,
           ${lauf.unsafe(nennformSql("ag"))} AS mit_nom, ${lauf.unsafe(nennformSql("ag", "dat"))} AS mit_dat
    FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.person_id = ${personId} AND t.quelle = ${LIMIT_QUELLE}
    ORDER BY t.beginn DESC LIMIT 50
  `) as any[]) : [];
  const { berlinDatumText, berlinUhrzeit } = await import("./fiaon-termine");
  const alsTermin = (t: any, mit: string | null): LimitTermin => ({
    beginn: new Date(t.beginn).toISOString(),
    datumText: berlinDatumText(new Date(t.beginn)),
    uhrzeit: berlinUhrzeit(new Date(t.beginn)),
    mit,
  });

  // Das gebuchte, offene Gespräch (der Index in Migration 092 lässt nur eines zu;
  // vor der Migration das früheste). Liegt es bei einem Abwesenden, ruft der
  // Vertreter an — die Seite nennt ihn wie Terminseite und Bestätigung.
  const offen = termine.filter((t) => String(t.status) === "gebucht")
    .sort((x, y) => new Date(x.beginn).getTime() - new Date(y.beginn).getTime())[0] ?? null;
  let gebucht: LimitGebucht | null = null;
  if (offen) {
    let mit: string | null = offen.mit_dat ? String(offen.mit_dat) : null;
    if (offen.agent_id && mit) {
      try {
        const { anruferNennform } = await import("./fiaon-abwesenheit");
        mit = (await anruferNennform(Number(offen.agent_id), offen.beginn,
          { nom: String(offen.mit_nom || mit), dat: mit }, lauf, LIMIT_QUELLE)).dat;
      } catch { /* ohne Abwesenheit: der Gebuchte */ }
    }
    const vorbei = new Date(offen.beginn).getTime() <= Date.now();
    gebucht = {
      ...alsTermin(offen, mit),
      vorbei,
      // Die Absage-Seite in der Sie-Form — der Kundenbereich siezt (E-236).
      absageLink: !vorbei && offen.storno_token ? `/termin/absagen/${offen.storno_token}?anrede=sie` : null,
    };
  }
  const gezaehlt = termine.find((t) => limitGezaehlt({ status: t.status, erledigtAm: t.erledigt_am })) ?? null;

  const [startGefuehrt, rueckstand, anker] = await Promise.all([
    opts.startGefuehrt ?? startgespraechGefuehrt(personId, lauf),
    rueckstandNr(ref, personId, lauf),
    bezahlt
      ? import("../routes/fiaon-abo").then((m) => m.aboAnker(ref)).then((x) => x.tag)
      : Promise.resolve(null),
  ]);

  return {
    ...limitAnspruchAus({
      paketKey: a.pack_key, bezahlt, globalKunde, beendet, heuteIso,
      startGefuehrt, ankerIso: anker, rueckstandNr: rueckstand,
      // Gezählt wird der TAG des Gesprächs (Berlin), nicht der Tag des Abhakens.
      letztesGezaehltIso: gezaehlt ? berlinToday(new Date(gezaehlt.beginn)) : null,
      gebucht,
      letztes: gezaehlt ? alsTermin(gezaehlt, gezaehlt.mit_dat ? String(gezaehlt.mit_dat) : null) : null,
    }),
    ref, personId,
  };
}

/**
 * Welche Bestellung trägt das Limit-Gespräch dieser Person? Für die Akte der
 * Mitarbeiter, die eine Person und keine Sitzung kennt: zuerst ein bezahltes
 * Paket mit Limit-Gespräch, dann irgendein bezahltes, dann die jüngste lebende
 * Bestellung.
 */
export async function limitRefFuerPerson(personId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const [z] = (await lauf`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND (archived_at IS NULL OR payment_status = 'paid')
    ORDER BY (payment_status = 'paid' AND LOWER(COALESCE(pack_key, '')) = ANY(${LIMIT_PAKETE as string[]})) DESC,
             (payment_status = 'paid') DESC, paid_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  `) as any[];
  return z?.ref ? String(z.ref) : null;
}

/** Der Anspruch für eine Person (Akte der Mitarbeiter). */
export async function limitAnspruchFuerPerson(personId: number, lauf: Lauf = sqlPool): Promise<LimitStand | null> {
  const ref = await limitRefFuerPerson(personId, lauf);
  return ref ? limitAnspruchFuer(ref, lauf) : null;
}

/**
 * Anspruch und — nur wenn buchbar — die freien Zeiten. Dieselbe Slot-Rechnung
 * wie die Terminseite (freieSlots), mit fester Art „limit_gespraech": Bei
 * Betreuer nur seine Zeiten, ohne Betreuer der Verteilpool, in der Abwesenheit
 * der Vertreter. Die Annahme prüft gegen dieselbe Funktion.
 */
export async function limitSlots(ref: string): Promise<{
  anspruch: LimitStand | null;
  auskunft: import("./fiaon-termine").SlotAuskunft | null;
}> {
  const anspruch = await limitAnspruchFuer(ref);
  if (!anspruch?.buchbar || !anspruch.personId) return { anspruch, auskunft: null };
  const { freieSlots } = await import("./fiaon-termine");
  return { anspruch, auskunft: await freieSlots(anspruch.personId, sqlPool, LIMIT_QUELLE) };
}

export type LimitBuchenErgebnis =
  | { ok: true; buchung: import("./fiaon-termine").Buchung; bestaetigt: boolean }
  | { ok: false; grund: "kein_anspruch"; anspruch: LimitStand | null }
  | { ok: false; grund: "nicht_angeboten"; nochFrei: number };

/**
 * Bucht ein Limit-Gespräch für den Kunden der Sitzung. Der Anspruch wird HIER
 * noch einmal geprüft — die Seite kann veraltet sein, und eine Anfrage lässt
 * sich selbst bauen. TerminFehler (belegt, zu früh, limit_offen …) wirft
 * terminBuchen; die Route übersetzt sie in Sätze.
 */
export async function limitBuchen(ref: string, beginn: string, agentId: number): Promise<LimitBuchenErgebnis> {
  const anspruch = await limitAnspruchFuer(ref);
  if (!anspruch?.buchbar || !anspruch.personId) return { ok: false, grund: "kein_anspruch", anspruch };
  const { kundenBuchungAusfuehren } = await import("../routes/fiaon-termin");
  const erg = await kundenBuchungAusfuehren({
    personId: anspruch.personId, beginn, agentId,
    quelle: LIMIT_QUELLE, herkunft: LIMIT_HERKUNFT, sie: true,
  });
  if (!erg.ok) return { ok: false, grund: "nicht_angeboten", nochFrei: erg.nochFrei };
  return { ok: true, buchung: erg.buchung, bestaetigt: erg.bestaetigt };
}
