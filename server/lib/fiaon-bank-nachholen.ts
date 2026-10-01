// ═══════════════════════════════════════════════════════════════════════════
// NACHHOLEN LIEGENGEBLIEBENER BANKEINGÄNGE — EINE RECHNUNG, DREI TÜREN (01.10.2026)
//
// Die Einleser (Airwallex, Wise) rufen liveVerbuchen nur für NEUE Zeilen. Was
// schon im Bankbuch liegt — weil E-235 (Referenz ohne Strich) und Regel B
// (Rate ohne Nummer) erst jetzt greifen — bleibt sonst für immer liegen.
//
// Hier steht, was ein liegengebliebener Eingang bedeutet und was beim Buchen
// passieren würde (Trockenprobe) — und der eine Weg, ihn scharf zu buchen.
// Drei Türen rufen genau diese Funktionen:
//   · FIAON Banking, Bankbuch (/buchhaltung → Umsätze): Justin klickt — ohne
//     Admin-Code, mit seiner Banking-Sitzung als Inhaber (fiaon-buchhaltung.ts).
//   · POST /admin/zahlungen/bankeingang-nachholen (Admin-Code oder Chef-Sitzung
//     Inhaber/Geschäftsführung, fiaon-wise.ts) — für Skripte.
//   · scripts/nachholen-bankeingaenge.ts (Vorschau schreibgeschützt gegen die
//     Produktion, Ausführen über die Admin-Route).
//
// Gebucht wird NIE hier, sondern immer über liveVerbuchen → alsBezahltBuchen /
// rateBezahltBuchen: der eine Buchungsweg mit Bestätigungsmail, Ratenkette,
// Provisionsschalter und Rückwärtssperre. Die Trockenprobe rechnet nur vor,
// mit denselben Bausteinen wie die Buchung (abschlussNachZahlung, onRatePaid,
// praemieBuchen) — damit der Mensch VOR dem Klick sieht: Ziel, Regel, Betrag,
// welche Provision vorgemerkt wird, welche Mail der Kunde bekommt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinDatum } from "./fiaon-time";

export interface NachholZeile {
  id: number;
  txnId: string;
  datum: string;
  betragCents: number;
  zweck: string | null;
  absender: string | null;
  zweckRef: string | null;
  regel: "rate" | "erstzahlung" | "regel_b" | null;
  ziel: string | null;
  bestellung: string | null;
  kunde: string | null;
  personId: number | null;
  rateId: number | null;
  rateNr: number | null;
  /** Der Satz aus liveVerbuchen: „würde buchen: …" oder der Grund dagegen. */
  ergebnis: string;
  /** Darf gebucht werden? Nur wenn die Trockenprobe „würde buchen" sagt. */
  buchen: boolean;
  deckung: string | null;
  /** Was an Mitarbeitergeld entstünde — bei Schalter AUS vorgemerkt, nicht gebucht. */
  provision: string[];
  /** Welche Mails der Kunde bekäme. */
  mails: string[];
  /** Was der Mensch vor dem Klick wissen muss (z. B. Kunde nennt eine andere Rate). */
  hinweise: string[];
  /** Kunde nennt im Zweck eine Ratennummer, die nicht die gebuchte ist → Aufgabe an den Betreuer beim Buchen. */
  genannteRate: number | null;
  /** Warum es Handarbeit bleibt (null, wenn buchbar). */
  unklar: string | null;
  schonVerbucht: boolean;
}

export interface NachholAntwort {
  status: number;
  ok: boolean;
  error?: string;
  zeile?: NachholZeile;
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

/**
 * Welche Rate nennt der Kunde im Verwendungszweck? „FIAON J8UU3U 3", „VZ. FIAONMSYOCC. 2.Rate",
 * „Rate 3 FIAON-596FE4". Nur eine kleine Zahl direkt hinter der Referenz oder am Wort „Rate" —
 * Beträge (59,99) und Datumsteile zählen nicht. null = nichts genannt.
 */
export function genannteRate(zweck: string | null | undefined): number | null {
  const t = String(zweck || "");
  const muster = [
    /FIAON[\s-]*[A-Z0-9]{6}[\s.,\-/]+(\d{1,2})(?![\d.,]\d)(?!\d)/i,
    /\brate\s*(?:nr\.?\s*)?(\d{1,2})\b/i,
    /\b(\d{1,2})\s*\.?\s*rate\b/i,
  ];
  for (const m of muster) {
    const t2 = t.match(m);
    if (t2) {
      const n = Number(t2[1]);
      if (Number.isInteger(n) && n >= 1 && n <= 36) return n;
    }
  }
  return null;
}

/** Nur die Zahlungs-Daten, keine Buchung: wer, wie viel, welche Referenz. */
async function kopfLesen(id: number): Promise<{ status: number; ok: boolean; error?: string; z?: any; zeile?: NachholZeile }> {
  const { refErkennen } = await import("../routes/fiaon-wise");
  const [z] = (await sqlPool`
    SELECT id, txn_id, booked_at, amount_cents, payer_name, reference_raw, extracted_ref, applied, note
      FROM fiaon_bank_txns WHERE id = ${id} LIMIT 1
  `) as any[];
  if (!z) return { status: 404, ok: false, error: "Diesen Bankeingang gibt es nicht." };
  const zeile: NachholZeile = {
    id: Number(z.id), txnId: String(z.txn_id), betragCents: Number(z.amount_cents),
    // Buchungstag in Berlin: Airwallex legt Mitternacht UTC ab, ältere Einleser Mitternacht
    // Berlin — beides ergibt so denselben Kalendertag (toISOString hätte den Vortag geliefert).
    datum: z.booked_at ? berlinDatum(new Date(z.booked_at)) : "",
    zweck: z.reference_raw ? String(z.reference_raw) : null,
    absender: z.payer_name ? String(z.payer_name) : null,
    zweckRef: refErkennen(String(z.reference_raw || "")) || (z.extracted_ref ? String(z.extracted_ref) : null),
    regel: null, ziel: null, bestellung: null, kunde: null, personId: null, rateId: null, rateNr: null,
    ergebnis: "", buchen: false, deckung: null, provision: [], mails: [], hinweise: [], genannteRate: null,
    unklar: null, schonVerbucht: !!z.applied,
  };
  if (z.applied) return { status: 409, ok: false, error: "Dieser Eingang ist schon verbucht.", z, zeile: { ...zeile, ergebnis: "schon verbucht", unklar: "schon verbucht" } };
  if (!(zeile.betragCents > 0)) return { status: 409, ok: false, error: "Kein Geldeingang (Betrag ≤ 0).", z, zeile: { ...zeile, ergebnis: "kein Geldeingang", unklar: "kein Geldeingang" } };
  if (String(z.note || "").startsWith("Airwallex: Geld ist UNTERWEGS")) {
    return { status: 409, ok: false, error: "Das Geld ist noch unterwegs — der Einleser bucht es, sobald es da ist.", z, zeile: { ...zeile, ergebnis: "Geld noch unterwegs", unklar: "Geld noch unterwegs" } };
  }
  if (!zeile.datum) return { status: 409, ok: false, error: "Eingang ohne Datum — bitte von Hand buchen.", z, zeile: { ...zeile, ergebnis: "ohne Datum", unklar: "ohne Datum" } };
  return { status: 200, ok: true, z, zeile };
}

/**
 * DIE TROCKENPROBE. Schreibt nichts (liveVerbuchen mit trocken: true setzt keinen
 * Vermerk). Liefert die Zeile mit Ziel, Regel, Betrag, Provision, Mails und Hinweisen.
 * `ueberzahlungBisCents` (höchstens 100): eine ERSTZAHLUNG darf so viele Cent über
 * dem Soll liegen — nie darunter. Vorgabe 100 (Beispiel 01.10.: 100,00 € auf 99,99 €).
 */
export async function bankeingangTrockenprobe(id: number, opts: { ueberzahlungBisCents?: number } = {}): Promise<NachholAntwort> {
  const toleranz = Math.max(0, Math.min(100, Math.floor(Number(opts.ueberzahlungBisCents ?? 100) || 0)));
  const kopf = await kopfLesen(id);
  if (!kopf.ok || !kopf.zeile) return { status: kopf.status, ok: false, error: kopf.error, zeile: kopf.zeile };
  const zeile = kopf.zeile;
  const { liveVerbuchen } = await import("../routes/fiaon-wise");
  const erg = await liveVerbuchen(zeile.txnId, zeile.zweckRef, zeile.betragCents, zeile.datum, {
    trocken: true, ueberzahlungBisCents: toleranz, anlass: "Nachhol-Lauf",
  });
  zeile.regel = erg.regel ?? null;
  zeile.ziel = erg.ziel ?? null;
  zeile.bestellung = erg.bestellung ?? null;
  zeile.rateId = erg.rateId ?? null;
  zeile.rateNr = erg.rateNr ?? null;
  zeile.ergebnis = erg.grund;
  zeile.deckung = erg.deckung?.text ?? null;
  zeile.buchen = erg.grund.startsWith("würde buchen");
  if (!zeile.buchen) zeile.unklar = erg.grund;
  if (zeile.bestellung) {
    const [app] = (await sqlPool`
      SELECT ref, person_id, first_name, last_name, contact_name FROM fiaon_applications WHERE ref = ${zeile.bestellung} LIMIT 1`.catch(() => [])) as any[];
    if (app) {
      zeile.personId = app.person_id != null ? Number(app.person_id) : null;
      zeile.kunde = String([app.first_name, app.last_name].filter(Boolean).join(" ") || app.contact_name || "").trim() || null;
    }
  }
  if (zeile.buchen && zeile.bestellung) await vorschauErgaenzen(zeile);
  return { status: 200, ok: true, zeile };
}

/**
 * Provision und Mails vorrechnen — dieselben Bausteine wie abschlussNachZahlung /
 * onRatePaid / praemieBuchen (fiaon-agent.ts, fiaon-inkasso.ts). Nur lesen.
 */
async function vorschauErgaenzen(zeile: NachholZeile): Promise<void> {
  try {
    const agent = await import("../routes/fiaon-agent");
    const { istGlobalPaket } = await import("@shared/fiaon-pakete");
    const { BUENDEL_WUNSCH_VERMERK } = await import("@shared/fiaon-auskunft-buendel");
    const [sch] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'provision_automatik'`) as any[];
    const automatikAn = String(sch?.value ?? "aus") === "an";
    const wort = automatikAn ? "GEBUCHT" : "vorgemerkt";
    const [vw] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_versandweg'`) as any[];
    const versandweg = String(vw?.value ?? "make");
    const settings = await agent.getSettings();
    const [app] = (await sqlPool`
      SELECT ref, person_id, email, contact_email, billing_email, created_at, assigned_agent_id, pack_key, pack_name,
             payment_reference, amount_due, confirmed_email_sent_at
        FROM fiaon_applications WHERE ref = ${zeile.bestellung} LIMIT 1`) as any[];
    if (!app) return;

    const provisionFuer = async (agentId: number, baseCents: number, art: "Abschluss" | "Rate", zahlRef: string) => {
      const [ag] = (await sqlPool`SELECT id, name, commission_rate_bp, recruited_by, override_rate_bp FROM fiaon_agents WHERE id = ${agentId}`) as any[];
      if (!ag) return [`keine (Mitarbeiter ${agentId} fehlt)`];
      const [schon] = (await sqlPool`
        SELECT id FROM fiaon_commissions WHERE kind IN ('own','override') AND amount_cents > 0 AND status <> 'storniert'
           AND ${art === "Rate" ? sqlPool`payment_reference = ${zahlRef}` : sqlPool`ref = ${app.ref} AND (payment_reference IS NULL OR payment_reference = ${app.payment_reference})`}`) as any[];
      if (schon) return ["keine (schon gebucht)"];
      const global = art === "Abschluss" && istGlobalPaket(app.pack_key);
      const status = agent.partnerStatusFor(await agent.ownRevenueCents(Number(ag.id)), agent.partnerThresholds(settings));
      const bp = global ? Math.round((Number(settings.global_provision_prozent ?? 25) || 25) * 100) : agent.agentRateBp(ag, settings) + status.bonusBp;
      const own = agent.commissionCents(baseCents, bp);
      const zeilenP = [`${ag.name} (#${ag.id}): ${eur(own)} (${bp / 100} % von ${eur(baseCents)}, own) — ${wort}`];
      const ov = await agent.werberOverride(ag, settings, baseCents);
      if (ov) zeilenP.push(`Werber #${ov.werberId}: ${eur(ov.cents)} (${ov.bp / 100} %, override) — ${wort}`);
      return zeilenP;
    };

    if (zeile.regel === "erstzahlung") {
      const anspruch = await agent.ermittleProvisionsAnspruch(app);
      zeile.provision = anspruch.agentId
        ? await provisionFuer(Number(anspruch.agentId), agent.eurToCents(app.amount_due), "Abschluss", String(app.payment_reference))
        : ["keine (Direktzahler — kein dokumentierter Kontakt vor der Zahlung)"];
      const mailAnBestellung = !!(app.email || app.contact_email || app.billing_email);
      if (istGlobalPaket(app.pack_key)) zeile.mails.push("global_start (Firmenauftrag, nach der Start-Aufgabe)");
      else if (app.confirmed_email_sent_at) zeile.mails.push("keine Zugangsmail (schon verschickt)");
      else if (mailAnBestellung) zeile.mails.push(`payment_confirmed „Willkommen & Zugang“ mit Login-Link (Versandweg ${versandweg})`);
      else {
        // Seit 01.10.: sendPaymentConfirmedOnce fällt auf die Adresse der PERSON zurück, wenn die
        // Bestellung keine trägt. Fehlt sie auch dort, geht nichts raus — dann steht es hier.
        const [pm] = (await sqlPool`SELECT NULLIF(TRIM(primary_email), '') AS mail FROM fiaon_persons WHERE id = ${app.person_id}`.catch(() => [])) as any[];
        if (pm?.mail) zeile.mails.push(`payment_confirmed „Willkommen & Zugang“ an die Adresse der Person (Bestellung ohne Adresse; Versandweg ${versandweg})`);
        else {
          zeile.mails.push("KEINE Zugangsmail — weder Bestellung noch Person haben eine Adresse; nach dem Buchen Adresse nachtragen und in der Akte „Zahlung bestätigt“ senden");
          zeile.hinweise.push("Keine E-Mail-Adresse am Kunden: Zugangsmail geht nicht automatisch raus.");
        }
      }
      const [karte] = (await sqlPool`SELECT 1 AS da FROM fiaon_konto_karte WHERE person_id = ${app.person_id} AND kanal <> 'gemeldet' LIMIT 1`.catch(() => [])) as any[];
      if (!istGlobalPaket(app.pack_key)) {
        zeile.mails.push(karte ? "keine Karten-Einladung (schon eingeladen)"
          : "konto_karte_einladung „Ihr Link zur Karte ist da“ — Takt karten_einladungen (≤ 5 Min.), falls Antrag vollständig und keine Sperre");
      }
      const [bund] = (await sqlPool`SELECT 1 AS da FROM fiaon_contact_log WHERE ref = ${app.ref} AND voided_at IS NULL AND note LIKE ${`${BUENDEL_WUNSCH_VERMERK}%`} LIMIT 1`.catch(() => [])) as any[];
      if (bund) zeile.mails.push("Bündel: Auskunft-Bestellung zum Kundenpreis + deren Zahlungsdaten-Mail");
    } else if (zeile.rateId) {
      const [r] = (await sqlPool`SELECT id, rate_nr, zahlungsreferenz, betrag_cents FROM fiaon_abo_raten WHERE id = ${zeile.rateId}`) as any[];
      if (r) {
        zeile.provision = Number(r.rate_nr) >= 2 && app.assigned_agent_id
          ? await provisionFuer(Number(app.assigned_agent_id), Number(r.betrag_cents), "Rate", String(r.zahlungsreferenz))
          : [Number(r.rate_nr) >= 2 ? "keine (kein zuständiger Betreuer)" : "keine (Rate 1 = Abschluss)"];
        // Inkasso-Prämie — dieselben Tore wie praemieBuchen (fiaon-inkasso.ts)
        const [arb] = (await sqlPool`
          SELECT w.agent_id, a.name, a.inkasso_praemie_art, a.inkasso_praemie_wert, a.verguetung_bestaetigt_am, a.active
            FROM fiaon_raten_arbeit w LEFT JOIN fiaon_agents a ON a.id = w.agent_id
           WHERE w.rate_id = ${r.id} AND w.ergebnis IN ('zahlt_am', 'ueberwiesen_beleg', 'nicht_erreicht')
           ORDER BY w.created_at DESC LIMIT 1`.catch(() => [])) as any[];
        if (arb && arb.active && arb.verguetung_bestaetigt_am) {
          const { VERGUETUNG_VORGABE } = await import("./fiaon-inkasso");
          const art = String(arb.inkasso_praemie_art || VERGUETUNG_VORGABE.praemieArt);
          const wert = Number(arb.inkasso_praemie_wert ?? VERGUETUNG_VORGABE.praemieWert);
          const c = art === "prozent" ? Math.round((Number(r.betrag_cents) * wert) / 10_000) : wert;
          if (c > 0) zeile.provision.push(`Inkasso-Prämie ${arb.name ?? `#${arb.agent_id}`}: ${eur(c)} — ${wort}`);
        }
        zeile.mails.push(Number(r.rate_nr) % 12 === 0 ? "abo_verlaengerung_frage (Rate 12)" : "keine (Ratenbuchung schickt keine Mail; Mahnungen zu dieser Rate enden)");
        // ── Der Kunde nennt eine andere Rate (Fall J8UU3U, 01.10.2026) ────────
        // „FIAON J8UU3U 3", Regel B bucht aber die ÄLTESTE offene Rate 2. Das ist
        // richtig (die Kette läuft vorwärts), aber der Betreuer muss es dem Kunden
        // sagen können — beim Buchen entsteht eine Aufgabe für ihn.
        const genannt = genannteRate(zeile.zweck);
        if (zeile.regel === "regel_b" && genannt != null && genannt !== Number(r.rate_nr)) {
          zeile.genannteRate = genannt;
          zeile.hinweise.push(`Kunde nennt Rate ${genannt}, gebucht wird die älteste offene Rate ${r.rate_nr}; Rate ${genannt} bleibt offen. Beim Buchen bekommt der Betreuer eine Aufgabe dazu.`);
        }
      }
    }
  } catch (e: any) {
    zeile.provision.push(`nicht berechenbar: ${String(e?.message || e).slice(0, 120)}`);
  }
}

// Ein Eingang wird nie von zwei Klicks gleichzeitig gebucht (Doppelklick, zwei Fenster).
const inArbeit = new Set<string>();

/**
 * SCHARF BUCHEN — erst die Trockenprobe, dann liveVerbuchen über den einen Weg.
 * `wer`: steht im Bankbuch-Vermerk und in der Ratennotiz („Nachhol-Lauf (Bankbuch js@…)").
 * `erwartet`: Regel, Ziel und Rate aus der Vorschau, die der Mensch gesehen hat — weicht
 * der Server heute davon ab, wird NICHT gebucht (409).
 */
export async function bankeingangBuchen(
  id: number,
  opts: { ueberzahlungBisCents?: number; wer: string; erwartet?: { regel?: string | null; ziel?: string | null; rateId?: number | null } | null },
): Promise<NachholAntwort & { ergebnis?: any; bankbuch?: any; aufgabe?: string | null }> {
  const probe = await bankeingangTrockenprobe(id, { ueberzahlungBisCents: opts.ueberzahlungBisCents });
  if (!probe.ok || !probe.zeile) return probe;
  const zeile = probe.zeile;
  if (!zeile.buchen) return { status: 409, ok: false, error: `Nicht buchbar: ${zeile.ergebnis}`, zeile };
  const e = opts.erwartet;
  if (e && ((e.regel ?? null) !== (zeile.regel ?? null) || (e.ziel ?? null) !== (zeile.ziel ?? null) || (e.rateId ?? null) !== (zeile.rateId ?? null))) {
    return { status: 409, ok: false, error: `Der Stand hat sich seit der Vorschau geändert (jetzt: ${zeile.regel ?? "—"} ${zeile.ziel ?? ""}) — bitte neu prüfen.`, zeile };
  }
  if (inArbeit.has(zeile.txnId)) return { status: 409, ok: false, error: "Dieser Eingang wird gerade schon gebucht.", zeile };
  inArbeit.add(zeile.txnId);
  try {
    const toleranz = Math.max(0, Math.min(100, Math.floor(Number(opts.ueberzahlungBisCents ?? 100) || 0)));
    const { liveVerbuchen } = await import("../routes/fiaon-wise");
    const anlass = `Nachhol-Lauf (${String(opts.wer || "Bankbuch").slice(0, 80)})`;
    const erg = await liveVerbuchen(zeile.txnId, zeile.zweckRef, zeile.betragCents, zeile.datum, { trocken: false, ueberzahlungBisCents: toleranz, anlass });
    const [nach] = (await sqlPool`SELECT applied, matched_ref, match_status, note FROM fiaon_bank_txns WHERE id = ${id} LIMIT 1`) as any[];
    console.log(`[BANK-NACHHOLEN] ${zeile.txnId} (${anlass}): ${erg.gebucht ? "GEBUCHT" : "nicht gebucht"} — ${erg.grund}`);
    let aufgabe: string | null = null;
    if (erg.gebucht && zeile.genannteRate != null && zeile.rateNr != null && zeile.bestellung) {
      aufgabe = await aufgabeAndereRate(zeile, anlass);
    }
    return { status: 200, ok: true, zeile: { ...zeile, schonVerbucht: !!nach?.applied }, ergebnis: erg, bankbuch: nach ?? null, aufgabe };
  } finally {
    inArbeit.delete(zeile.txnId);
  }
}

/** Fall J8UU3U: Der Betreuer erfährt, dass die genannte Rate NICHT die gebuchte ist. */
async function aufgabeAndereRate(zeile: NachholZeile, anlass: string): Promise<string | null> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId: zeile.personId, ref: zeile.bestellung,
      titel: `Kunde nennt Rate ${zeile.genannteRate}, gebucht ist Rate ${zeile.rateNr} (${zeile.bestellung})`.slice(0, 160),
      text: `Bankeingang ${zeile.txnId} vom ${zeile.datum} über ${eur(zeile.betragCents)} mit dem Zweck „${(zeile.zweck || "").slice(0, 120)}“ `
        + `wurde auf die älteste offene Rate ${zeile.rateNr} (${zeile.ziel}) gebucht — die Kette läuft vorwärts, eine Lücke wird nie übersprungen. `
        + `Der Kunde nennt Rate ${zeile.genannteRate}; sie bleibt offen und wird mit der nächsten Zahlung fällig. `
        + `Bitte dem Kunden kurz erklären, welche Rate als bezahlt gilt und welche noch offen ist (Zahlungsseite in der Akte).`,
      schluessel: `bank-nachholen:andere-rate:${zeile.txnId}`,
      quelle: "bankbuch", bereich: "konten", autorName: anlass,
      link: zeile.bestellung ? `/admin/kunde/${zeile.bestellung}` : null,
    });
    return erg.agentName ? `Aufgabe an ${erg.agentName}` : (erg.id ? "Aufgabe beim Betreiber (kein Betreuer)" : null);
  } catch (e: any) {
    console.error("[BANK-NACHHOLEN] Aufgabe andere Rate:", String(e?.message || e).slice(0, 160));
    return null;
  }
}

/**
 * Ab wann liegengebliebene Eingänge im Bankbuch angeboten werden, wenn niemand ein Datum
 * nennt: der 24.09.2026 — der Zeitraum, den die Vorschau und die Gegenprüfung vom 01.10.
 * durchgesehen haben (12 Eingänge, 5 freigegeben). Ältere (seit 01.09.) zeigt das Bankbuch
 * nur auf ausdrücklichen Wunsch („Ältere einbeziehen"), damit „Alle buchen" nie stillschweigend
 * Zeilen mitnimmt, die kein Mensch angesehen hat.
 */
export const NACHHOLEN_SEIT_VORGABE = "2026-09-24";
export const NACHHOLEN_SEIT_AELTESTE = "2026-09-01";

/**
 * Alle liegengebliebenen Eingänge (nicht verbucht, Geld da, nicht unterwegs) seit `seit`
 * — jeder mit seiner Trockenprobe. Für „Alle prüfen" im Bankbuch und die Skript-Vorschau.
 */
export async function nachholListe(opts: { seit?: string | null; ids?: number[]; ueberzahlungBisCents?: number } = {}): Promise<NachholZeile[]> {
  const ids = (opts.ids || []).filter((n) => Number.isInteger(n) && n > 0);
  const seit = opts.seit && /^\d{4}-\d{2}-\d{2}$/.test(opts.seit) ? opts.seit : NACHHOLEN_SEIT_VORGABE;
  const zeilen = (ids.length
    ? await sqlPool`SELECT id FROM fiaon_bank_txns WHERE id = ANY(${ids}) ORDER BY booked_at, id`
    : await sqlPool`SELECT id FROM fiaon_bank_txns
                     WHERE NOT applied AND amount_cents > 0 AND booked_at >= ${seit}::date
                       AND COALESCE(note, '') NOT LIKE 'Airwallex: Geld ist UNTERWEGS%'
                     ORDER BY booked_at, id`) as any[];
  const aus: NachholZeile[] = [];
  for (const z of zeilen) {
    const p = await bankeingangTrockenprobe(Number(z.id), { ueberzahlungBisCents: opts.ueberzahlungBisCents });
    if (p.zeile) aus.push(p.zeile);
  }
  return aus;
}

/** Zähler für die Übersicht: wie viele Eingänge warten überhaupt (ohne Trockenprobe, billig). */
export async function nachholZahl(seit = NACHHOLEN_SEIT_VORGABE): Promise<{ anzahl: number; cents: number }> {
  const [r] = (await sqlPool`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_cents), 0)::bigint AS c
      FROM fiaon_bank_txns
     WHERE NOT applied AND amount_cents > 0 AND booked_at >= ${seit}::date
       AND COALESCE(note, '') NOT LIKE 'Airwallex: Geld ist UNTERWEGS%'`.catch(() => [])) as any[];
  return { anzahl: Number(r?.n || 0), cents: Number(r?.c || 0) };
}
