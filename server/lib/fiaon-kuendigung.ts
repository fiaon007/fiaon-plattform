// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNG — ein Zustand mit Wirkung (02.09.2026, E-092)
//
// JUSTINS REGEL, wörtlich: „Wenn jemand kündigt, muss das im System ja
// ebenfalls passieren ABER der Kunde muss wenn er heute kündigt dennoch seine
// offene Rate bezahlen, mit bezahlen dieser ist der Vertrag dann offiziell
// aus."
//
// DER BEFUND, aus dem das hier entstanden ist (Analyse 02.09.):
//   · 127 Kündigungsanträge liegen seit dem 25.05. unbearbeitet; die
//     Bearbeitungsseite ist seit einer Umleitung nicht mehr erreichbar.
//   · „Bestätigen" änderte nur den Antrag, nie das Abo. 79 bezahlte Kündiger
//     laufen weiter in Raten und Mahnungen: 89 offene Raten über 5.819 €,
//     55 davon NACH dem Antrag gemahnt, bei 21 legte der Tageslauf sogar noch
//     Rate 3 oder 4 an. Kein einziger hat danach noch gezahlt.
//   · Der einzige Stopp-Endpunkt storniert ALLE offenen Raten — er würde die
//     letzte Rate erlassen, also das Gegenteil von Justins Regel.
//
// WAS HIER PASSIERT: Eine Kündigung setzt `gekuendigt_am`, bestimmt die
// LETZTE RATE (die laufende, offene), storniert alles danach und lässt genau
// diese eine Rate fällig. Der Tageslauf legt keine neue mehr an. Zahlt der
// Kunde sie, endet der Vertrag (`vertrag_ende_am`, Abschlussmail, keine
// Verlängerungsfrage, KEIN Provisions-Clawback — verdientes Geld bleibt).
// Nimmt er die Kündigung zurück, leben die stornierten Raten wieder auf.
//
// WAS HIER BEWUSST NICHT PASSIERT: keine Rückerstattung, kein Erlass, keine
// Kontosperre. Und keine automatische Kündigung auf ein bloßes Wort: Es
// braucht eine Willenserklärung („ich kündige"), kein „ich überlege zu
// kündigen".
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

export type KuendigungQuelle = "mail" | "formular" | "telefon" | "admin" | "altbestand";

export interface KuendigungErgebnis {
  ok: boolean;
  ref: string;
  weg: "storno_unbezahlt" | "letzte_rate" | "sofort_beendet" | "kulanz_sofort" | "bereits" | "prueffall" | "unbekannt";
  letzteRateNr: number | null;
  letzteRateBetragCents: number | null;
  letzteRateFaellig: string | null;
  stornierteRaten: number;
  vertragEndeAm: string | null;
  grund: string;
}

/** Spalten nachrüsten — idempotent, beim ersten Aufruf. */
let spaltenBereit = false;
export async function kuendigungSpalten(): Promise<void> {
  if (spaltenBereit) return;
  await sqlPool`
    ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS gekuendigt_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_quelle TEXT,
      ADD COLUMN IF NOT EXISTS kuendigung_grund TEXT,
      ADD COLUMN IF NOT EXISTS letzte_rate_nr INTEGER,
      ADD COLUMN IF NOT EXISTS vertrag_ende_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_zurueckgenommen_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_bestaetigt_mail_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_rueckhol_bis TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_postmeister_id INTEGER
  `.catch((e) => console.error("[KÜNDIGUNG] Spalten:", String(e).slice(0, 200)));
  spaltenBereit = true;
}

/** Einstellung lesen (Text), mit Vorgabe. */
async function einstellung(schluessel: string, vorgabe: string): Promise<string> {
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel} LIMIT 1`) as any[];
    const v = String(r?.value ?? "").trim();
    return v || vorgabe;
  } catch { return vorgabe; }
}

/**
 * Die Willenserklärung. Ein Kündigungswort allein genügt nicht — „ich überlege
 * zu kündigen" oder „wie kann ich kündigen?" sind keine Kündigung. Diese
 * Prüfung steht bewusst hier und nicht im Prompt: Ein Modell darf sie nicht
 * umgehen können.
 */
export function istWillenserklaerung(text: string, opts: { unbezahlt?: boolean } = {}): boolean {
  const t = String(text || "").toLowerCase().replace(/\s+/g, " ");
  if (!t) return false;
  // ── STORNO-WORTLAUTE (05.09.2026, E-135) ──────────────────────────────
  // „Bitte stornieren Sie alles" scheiterte dreimal an dieser Prüfung, und
  // Mara gab den Fall an Frau Zeller. Wer seine Bestellung nicht bezahlt hat
  // und aussteigen will, sagt das selten juristisch — und ein Storno kostet
  // nichts. Bei unbezahlter Bestellung gilt deshalb die weite Liste; bei
  // laufendem Vertrag nur die klaren Sätze („ich will nicht mehr" eingeschlossen).
  const storno = /(sto?r?nier(en|e|t)? (sie )?(bitte )?(alles|das|den vertrag|die bestellung|mein(e|en)? (antrag|vertrag|bestellung|buchung))|bitte (alles |den vertrag |die bestellung )?stornieren|ich (will|m(ö|oe)ch(t)?e) (das |es |den vertrag |die bestellung )?nicht( mehr)?( weitermachen| fortführen| fortfuehren)?\b|ich (will|m(ö|oe)ch(t)?e) (den vertrag |die bestellung |das )?(nicht|nicht mehr)\b|kein interesse( mehr)?|anders überlegt|anders ueberlegt|(löschen|loeschen) sie (bitte )?(mein(en|e)? |diesen |dieses |das )?(konto|account|antrag|daten|zugang)|nicht weitermachen|abbrechen)/;
  const zweifel = /(würde|wuerde|überlege|ueberlege|vielleicht|eventuell|wie kann ich|falls|\?\s*$)/;
  // Unbezahlte Bestellung: Jede klare Absage genügt — auch mit Tippfehlern
  // („dsd ich dad Angebot nlcht möchte", „wird nicht mehr benötigt",
  // „hiermit wiederufe ich"). Ein Storno kostet nichts; Nachfragen kostet
  // den Kunden Geduld und uns eine Mail.
  const absage = /(^\s*nein[, ]*danke|(nicht|nlcht|kein(e|en|s)?|nein)[^.!?\n]{0,40}(möcht|moecht|will|brauch|benötig|benoetig|interess|angebot|vertrag|bestellung|antrag|auftrag|weiter|nehmen|abschließen|abschliessen|paket|finanzierung|konto bei ihnen)|(möcht|moecht|will|brauch|benötig|benoetig)[^.!?\n]{0,30}(nicht|nlcht|kein)|storn|abbrech|zurücktret|zuruecktret|beenden|lösch|loesch|wie?derr?uf|verzicht)/;
  if (opts.unbezahlt && !zweifel.test(t) && absage.test(t)) return true;
  if (storno.test(t) && !zweifel.test(t)) {
    if (opts.unbezahlt) return true;
    if (/(ich (will|m(ö|oe)ch(t)?e) (den vertrag |das |es )?nicht( mehr)?\b|nicht weitermachen|sto?r?nier(en|e|t)? (sie )?(bitte )?(den vertrag|mein(en)? vertrag|alles))/.test(t)) return true;
  }
  // Konjunktiv oder Frage in der Nähe des Kündigungsworts → keine Erklärung.
  // „möglich" allein wäre zu breit: „zum nächstmöglichen Zeitpunkt" ist eine
  // Kündigung, „ist das möglich?" nicht.
  const unsicher = /(würde|wuerde|überlege|ueberlege|\bfalls\b|wenn ich|wie kann ich|wie kündige|wie kuendige|(ist|wäre|waere) (das |es )?möglich|(ist|wäre|waere) (das |es )?moeglich|erwäge|erwaege|vielleicht|eventuell|gedanken|informier|auskunft|welche frist|kündigungsfrist ist|kuendigungsfrist ist|frist ist)/;
  const erklaerung = /(ich kündige|ich kuendige|hiermit kündige|hiermit kuendige|kündige ich|kuendige ich|kündigung des vertrags|kuendigung des vertrags|hiermit die kündigung|hiermit die kuendigung|vertrag beenden|vertrag kündigen|vertrag kuendigen|abo kündigen|abo kuendigen|widerrufe hiermit|hiermit wie?derr?ufe|wie?derr?ufe ich|trete zurück|trete zurueck|außerordentlich(e|en)? kündigung|ausserordentlich(e|en)? kuendigung|habe (bereits |schon |schriftlich |per e-?mail |per mail |vor \w+ )*(gekündigt|gekuendigt)|(gekündigt|gekuendigt) habe|meine (kündigung|kuendigung) vom|bleibe bei meiner (kündigung|kuendigung))/;
  if (!erklaerung.test(t)) return false;
  // 04.09.2026: „ich habe schriftlich gekündigt!!!" ist eine Erklärung — der
  // Kunde beruft sich auf eine frühere. Bis hierher galt sie als unklar, und
  // Mara antwortete, die Kündigung sei „noch nicht eindeutig hinterlegt".
  // Steht ein Unsicherheitswort im selben Satz wie die Erklärung, gilt sie nicht.
  for (const satz of t.split(/[.!?;\n]/)) {
    if (erklaerung.test(satz) && !unsicher.test(satz)) return true;
  }
  return false;
}

/** Lücke in der Ratenkette (1,3 ohne 2) — dann entscheidet ein Mensch. */
function kettenLuecke(raten: { rate_nr: number }[]): boolean {
  if (raten.length < 2) return false;
  const nrs = raten.map((r) => Number(r.rate_nr)).sort((a, b) => a - b);
  for (let i = 1; i < nrs.length; i++) if (nrs[i] - nrs[i - 1] > 1) return true;
  return false;
}

/**
 * Kündigung setzen — idempotent. Läuft in EINER Transaktion; ein Fehler lässt
 * die Bestellung unverändert.
 */
export async function kuendigungSetzen(ref: string, opts: {
  quelle: KuendigungQuelle;
  grund?: string | null;
  postmeisterId?: number | null;
  /** Datum der ursprünglichen Erklärung (Altbestand) — sonst jetzt. */
  am?: string | null;
  /** true = nur rechnen, nichts schreiben. */
  probe?: boolean;
  /**
   * 04.09.2026 (E-115): Kulanz — Vertrag endet SOFORT, auch offene Raten
   * entfallen. Das ist eine Geldentscheidung; nur ein Mensch im Postfach darf
   * sie treffen (Schalter „Storno erst nach Zahlungseingang" ausgeschaltet).
   * Mara bekommt diesen Weg nicht angeboten.
   */
  sofort?: boolean;
}): Promise<KuendigungErgebnis> {
  await kuendigungSpalten();
  const leer = (weg: KuendigungErgebnis["weg"], grund: string): KuendigungErgebnis =>
    ({ ok: false, ref, weg, letzteRateNr: null, letzteRateBetragCents: null, letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: null, grund });

  const [a] = (await sqlPool`
    SELECT ref, person_id, payment_status, payment_reference, amount_due, pack_name, email,
           first_name, last_name, gekuendigt_am, letzte_rate_nr, vertrag_ende_am, abo_gestoppt_am
    FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1
  `) as any[];
  if (!a) return leer("unbekannt", "Bestellung nicht gefunden");
  if (a.gekuendigt_am && !a.kuendigung_zurueckgenommen_am) {
    return { ok: true, ref, weg: "bereits", letzteRateNr: a.letzte_rate_nr ?? null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: a.vertrag_ende_am ?? null, grund: "bereits gekündigt" };
  }

  const wann = opts.am ? new Date(opts.am) : new Date();
  const rueckholBis = new Date(wann.getTime() + 14 * 24 * 60 * 60 * 1000);

  // ── Weg 1: nie bezahlt → Storno der Bestellung, keine Forderung ─────────
  if (String(a.payment_status) !== "paid") {
    if (opts.probe) return { ok: true, ref, weg: "storno_unbezahlt", letzteRateNr: null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: wann.toISOString(), grund: "unbezahlt — Bestellung wird storniert" };
    await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_applications
           SET payment_status = 'cancelled', cancelled_at = COALESCE(cancelled_at, ${wann}),
               gekuendigt_am = ${wann}, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
               kuendigung_postmeister_id = ${opts.postmeisterId ?? null},
               vertrag_ende_am = ${wann}, mahnstopp_am = COALESCE(mahnstopp_am, ${wann}),
               allow_reminders_despite_paid = FALSE, updated_at = NOW()
         WHERE ref = ${ref}
      `;
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Kündigung (${opts.quelle}) — Bestellung war unbezahlt und wurde storniert. Keine Forderung, Erinnerungen beendet.${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
      `.catch(() => {});
    });
    return { ok: true, ref, weg: "storno_unbezahlt", letzteRateNr: null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: wann.toISOString(), grund: "Bestellung storniert" };
  }

  // ── Weg 2: bezahlt → letzte Rate bestimmen ──────────────────────────────
  const raten = (await sqlPool`
    SELECT id, rate_nr, betrag_cents, status, faellig_am
    FROM fiaon_abo_raten WHERE ref = ${ref} AND storniert_am IS NULL ORDER BY rate_nr ASC
  `) as any[];
  const offen = raten.filter((r) => r.status === "offen");

  if (kettenLuecke(raten)) {
    return leer("prueffall", `Lücke in der Ratenkette (${raten.map((r) => r.rate_nr).join(",")}) — ein Mensch muss entscheiden`);
  }

  // Keine offene Rate → alles bezahlt, Vertrag endet sofort.
  if (offen.length === 0) {
    const hoechste = raten.length ? Math.max(...raten.map((r) => Number(r.rate_nr))) : 0;
    if (opts.probe) return { ok: true, ref, weg: "sofort_beendet", letzteRateNr: hoechste || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: wann.toISOString(), grund: "keine offene Rate — Vertrag endet sofort" };
    await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_applications
           SET gekuendigt_am = ${wann}, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
               kuendigung_postmeister_id = ${opts.postmeisterId ?? null}, letzte_rate_nr = ${hoechste || null},
               vertrag_ende_am = ${wann}, abo_gestoppt_am = COALESCE(abo_gestoppt_am, ${wann}),
               abo_stopp_grund = COALESCE(abo_stopp_grund, 'Kündigung'), kuendigung_rueckhol_bis = ${rueckholBis},
               mahnstopp_am = COALESCE(mahnstopp_am, ${wann}), updated_at = NOW()
         WHERE ref = ${ref}
      `;
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Kündigung (${opts.quelle}) — alle Raten bezahlt, Vertrag endet sofort.${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
      `.catch(() => {});
    });
    return { ok: true, ref, weg: "sofort_beendet", letzteRateNr: hoechste || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: wann.toISOString(), grund: "Vertrag beendet" };
  }

  // ── Kulanz (nur Mensch): sofort beenden, offene Raten entfallen ────────
  if (opts.sofort) {
    const hoechsteBezahlt = raten.filter((r) => r.status === "bezahlt").reduce((m, r) => Math.max(m, Number(r.rate_nr)), 0);
    if (opts.probe) return { ok: true, ref, weg: "kulanz_sofort", letzteRateNr: hoechsteBezahlt || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: offen.length, vertragEndeAm: wann.toISOString(), grund: `Kulanz — ${offen.length} offene Rate(n) entfallen, Vertrag endet sofort` };
    await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_applications
           SET gekuendigt_am = ${wann}, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
               kuendigung_postmeister_id = ${opts.postmeisterId ?? null}, letzte_rate_nr = ${hoechsteBezahlt || null},
               vertrag_ende_am = ${wann}, abo_gestoppt_am = COALESCE(abo_gestoppt_am, ${wann}),
               abo_stopp_grund = COALESCE(abo_stopp_grund, 'Kündigung (Kulanz, sofort)'), kuendigung_rueckhol_bis = ${rueckholBis},
               mahnstopp_am = COALESCE(mahnstopp_am, ${wann}), updated_at = NOW()
         WHERE ref = ${ref}
      `;
      await tx`
        UPDATE fiaon_abo_raten
           SET status = 'storniert', storniert_am = NOW(), storno_grund = 'kuendigung_kulanz', updated_at = NOW()
         WHERE ref = ${ref} AND status = 'offen'
      `;
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Kündigung (${opts.quelle}), KULANZ — Vertrag endet sofort, ${offen.length} offene Rate(n) entfallen. Ein Mensch hat das im Postfach entschieden.${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
      `.catch(() => {});
    });
    await lastschriftBeendenMerken(ref, a.person_id ?? null).catch(() => {});
    return { ok: true, ref, weg: "kulanz_sofort", letzteRateNr: hoechsteBezahlt || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: offen.length, vertragEndeAm: wann.toISOString(), grund: "Vertrag beendet (Kulanz)" };
  }

  // Welche offene Rate ist „die letzte"? Standard: die höchste (der Kunde zahlt
  // den laufenden Monat zu Ende). Umschaltbar, weil es eine Geldfrage ist.
  const regel = await einstellung("kuendigung_letzte_rate", "hoechste");
  const gewaehlt = regel === "niedrigste"
    ? offen.reduce((m, r) => (Number(r.rate_nr) < Number(m.rate_nr) ? r : m), offen[0])
    : offen.reduce((m, r) => (Number(r.rate_nr) > Number(m.rate_nr) ? r : m), offen[0]);
  const letzteNr = Number(gewaehlt.rate_nr);
  const danach = raten.filter((r) => Number(r.rate_nr) > letzteNr && r.status === "offen");

  if (opts.probe) {
    return { ok: true, ref, weg: "letzte_rate", letzteRateNr: letzteNr, letzteRateBetragCents: Number(gewaehlt.betrag_cents),
      letzteRateFaellig: gewaehlt.faellig_am, stornierteRaten: danach.length, vertragEndeAm: null,
      grund: `letzte Rate ${letzteNr} bleibt fällig (${(Number(gewaehlt.betrag_cents) / 100).toFixed(2)} €), ${danach.length} spätere Rate(n) entfallen` };
  }

  await sqlPool.begin(async (tx) => {
    await tx`
      UPDATE fiaon_applications
         SET gekuendigt_am = ${wann}, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
             kuendigung_postmeister_id = ${opts.postmeisterId ?? null}, letzte_rate_nr = ${letzteNr},
             kuendigung_rueckhol_bis = ${rueckholBis}, updated_at = NOW()
       WHERE ref = ${ref}
    `;
    if (danach.length) {
      await tx`
        UPDATE fiaon_abo_raten
           SET status = 'storniert', storniert_am = NOW(), storno_grund = 'kuendigung', updated_at = NOW()
         WHERE ref = ${ref} AND rate_nr > ${letzteNr} AND status = 'offen'
      `;
    }
    await tx`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
              ${`Kündigung (${opts.quelle}) — letzte Rate ${letzteNr} über ${(Number(gewaehlt.betrag_cents) / 100).toFixed(2)} € bleibt fällig${gewaehlt.faellig_am ? ` (fällig ${String(gewaehlt.faellig_am).slice(0, 10)})` : ""}; ${danach.length} spätere Rate(n) storniert. Mit der Zahlung endet der Vertrag.${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
    `.catch(() => {});
  });

  return { ok: true, ref, weg: "letzte_rate", letzteRateNr: letzteNr, letzteRateBetragCents: Number(gewaehlt.betrag_cents),
    letzteRateFaellig: gewaehlt.faellig_am, stornierteRaten: danach.length, vertragEndeAm: null,
    grund: `letzte Rate ${letzteNr} bleibt fällig` };
}

/** Kündigung zurücknehmen — stornierte Raten leben wieder auf. */
export async function kuendigungZuruecknehmen(ref: string, grund?: string | null): Promise<{ ok: boolean; ratenZurueck: number }> {
  await kuendigungSpalten();
  let zurueck = 0;
  await sqlPool.begin(async (tx) => {
    const w = (await tx`
      UPDATE fiaon_abo_raten SET status = 'offen', storniert_am = NULL, storno_grund = NULL, updated_at = NOW()
       WHERE ref = ${ref} AND storno_grund = 'kuendigung' AND status = 'storniert' RETURNING id
    `) as any[];
    zurueck = w.length;
    await tx`
      UPDATE fiaon_applications
         SET kuendigung_zurueckgenommen_am = NOW(), gekuendigt_am = NULL, letzte_rate_nr = NULL,
             vertrag_ende_am = NULL, abo_gestoppt_am = NULL, abo_stopp_grund = NULL, updated_at = NOW()
       WHERE ref = ${ref}
    `;
    await tx`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'System', 'system', ${`Kündigung zurückgenommen — ${zurueck} Rate(n) wieder offen.${grund ? ` ${String(grund).slice(0, 200)}` : ""}`})
    `.catch(() => {});
  });
  return { ok: true, ratenZurueck: zurueck };
}

/**
 * Ist diese bezahlte Rate die letzte des gekündigten Vertrags? Wird aus
 * `rateBezahltBuchen` gerufen — dort steht fest, dass Geld angekommen ist.
 */
export async function vertragEndePruefen(ref: string, rateNr: number): Promise<{ beendet: boolean; person_id?: number | null }> {
  await kuendigungSpalten();
  const [a] = (await sqlPool`
    SELECT ref, person_id, gekuendigt_am, letzte_rate_nr, vertrag_ende_am
    FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1
  `) as any[];
  if (!a?.gekuendigt_am || a.vertrag_ende_am || a.letzte_rate_nr == null) return { beendet: false };
  if (Number(rateNr) < Number(a.letzte_rate_nr)) return { beendet: false };
  await sqlPool`
    UPDATE fiaon_applications
       SET vertrag_ende_am = NOW(), abo_gestoppt_am = COALESCE(abo_gestoppt_am, NOW()),
           abo_stopp_grund = COALESCE(abo_stopp_grund, 'Kündigung — letzte Rate bezahlt'), updated_at = NOW()
     WHERE ref = ${ref}
  `;
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
            ${`Letzte Rate ${rateNr} bezahlt — der Vertrag ist damit beendet. Provisionen bleiben bestehen.`})
  `.catch(() => {});
  await lastschriftBeendenMerken(ref, a.person_id ?? null).catch(() => {});
  return { beendet: true, person_id: a.person_id };
}

/**
 * 04.09.2026 (E-115): Läuft bei GoCardless ein Abo, zieht es nach dem
 * Vertragsende weiter ein — bisher hat das niemand beendet (kein einziger
 * cancel-Aufruf im Haus). Geldbewegungen bei GoCardless führt nach Justins
 * Regel NUR er aus; deshalb keine API-Aktion hier, sondern eine Aufgabe mit
 * Prio 1 auf seinem Brett — mit Abo-Kennung und dem Weg zur Akte.
 */
async function lastschriftBeendenMerken(ref: string, personId: number | null): Promise<void> {
  const [g] = (await sqlPool`
    SELECT gc_subscription_ref, gc_subscription_status, gc_mandate_ref, first_name, last_name
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
  `.catch(() => [])) as any[];
  if (!g?.gc_subscription_ref || /cancel|finished|beendet/i.test(String(g.gc_subscription_status || ""))) return;
  const { todoAnlegen } = await import("../routes/fiaon-betreiber-todo");
  const name = [g.first_name, g.last_name].filter(Boolean).join(" ") || ref;
  await todoAnlegen(`gc-abo-beenden:${ref}`, {
    titel: `GoCardless-Abo beenden: ${name}`,
    text: `Der Vertrag ${ref} ist beendet, bei GoCardless läuft das Abo ${g.gc_subscription_ref} (Mandat ${g.gc_mandate_ref || "—"}) aber weiter und würde weiter einziehen. Bitte im GoCardless-Dashboard das Abo beenden (Subscriptions → ${g.gc_subscription_ref} → Cancel). Das Mandat kann bleiben.${personId ? ` Person ${personId}.` : ""}`,
    bereich: "konten", prioritaet: 1, quelle: "system", link: `/admin/kunde/${ref}`,
  });
}

/** Läuft die Bestellung noch? (für Mahn-, Rückhol- und Werbeläufe) */
export async function istGekuendigt(ref: string): Promise<boolean> {
  const [a] = (await sqlPool`SELECT gekuendigt_am, kuendigung_zurueckgenommen_am FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  return !!(a?.gekuendigt_am && !a?.kuendigung_zurueckgenommen_am);
}
