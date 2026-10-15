// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSWERTUNG ALS GESCHLOSSENER ABLAUF (14.10.2026, E-365)
//
// Justin: „kläre den GESAMTEN Prozess ab, überall wo es um Bonitätsauskunft geht (auch der Weg, wo der
// Kunde sie um 149 € kaufen kann) … der gesamte Prozess muss ein geschlossenes System sein, wo Mails
// verschickt werden, wo die Leute, die keine FIAON-Kunden sind, auch Ausweis und Kontoauszug hochladen
// … auch auf der Kundenseite perfekt angezeigt.“
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Seit E-353 ist die FIAON-Bonitätsauswertung das Produkt hinter 74 € / 149 €. Nach der Zahlung lief aber
// noch der alte Weg (lieferungStarten → Beschaffungsauftrag bei den Auskunfteien, Mail „wir beschaffen
// Ihre Auskunft … Sie müssen nichts weiter tun“). Niemand bat den Käufer um Ausweis und Kontoauszug, der
// Kundenbereich kannte die Auswertung nicht (Kaufkarte „wir fordern Ihre Datenkopien an“ auch nach der
// Lieferung), und die Widerrufswahl („Ohne diesen Haken beginnen wir nach Ablauf der Widerrufsfrist“)
// sperrte nichts, weil die Auswertung keinen Versand an eine Auskunftei kennt.
//
// ── DER ABLAUF JETZT ──────────────────────────────────────────────────────
//   1. Zahlung gebucht → onCustomerPaid → lieferungStarten → (privat) auswertungLieferungStarten:
//      fehlen Ausweis oder Kontoauszug, geht SOFORT der Upload-Link ohne Anmeldung hinaus (dieselbe
//      Anforderung wie aus der Akte, Anlass-Satz „Für Ihre FIAON-Bonitätsauswertung …“).
//   2. Liegen beide vor (gleich oder später, über Link, Kundenbereich oder Mitarbeiter):
//      auswertungStartklarMelden legt die Aufgabe „Bonitätsauswertung entwickeln“ an (Schlüssel
//      unterlagen-eingang:<Person>, dieselbe wie beim Upload-Link — nie zwei), fällig ab dem Tag, an dem
//      das Team beginnen darf (Widerrufsfrist, wenn der frühere Beginn nicht verlangt wurde).
//   3. Das Team drückt „Bonität jetzt entwickeln“ (nie automatisch — Justin E-352), prüft und gibt frei
//      (E-358). auswertungStartSperre hält den Knopf bis zum Fristende, wenn der Kunde es so gewählt hat.
//   4. Freigabe → Mail mit PDF (E-357), Beschaffung zu (E-355), Aufgabe zu (auswertungFreigegeben).
//   5. Fehlt nach drei Tagen noch etwas: Erinnerung mit neuem Link (auswertungUnterlagenErinnern, im Takt
//      der Zahlungserinnerung), höchstens drei Mal, dann übernimmt die Arbeitsliste (Chefbüro).
//
// ── DIE PREISREGEL (E-365) ────────────────────────────────────────────────
// Wartet der Kartenlink eines zahlenden Paketkunden auf die Bonität (E-363), ist sie INKLUSIVE — nie
// verkaufen, nur die Unterlagen erbitten (BONITAET_INKLUSIVE_SQL, auskunftStand „inklusive“). Ein
// Vertragsschritt darf nie an einer Zusatzzahlung hängen.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { AUSKUNFT_SCHLUESSEL, euroText, type AuswertungKundenStand } from "@shared/fiaon-auskunft";
import { auswertungNummer } from "@shared/fiaon-finanzauswertung";

type Lauf = typeof sqlPool;

const FIRMA_SCHLUESSEL = [AUSKUNFT_SCHLUESSEL.firma.einzeln, AUSKUNFT_SCHLUESSEL.firma.mitAbo];

/** Die Marke im Verlauf der Bestellung: Der Ablauf nach der Zahlung lief für diese Bestellung (Idempotenz). */
export const AUSWERTUNG_ABLAUF_VERMERK = "Bonitätsauswertung: Ablauf nach der Zahlung gestartet";

/** Der Satz über der Liste in der Unterlagen-Mail — Anlass, kein Angebot, kein Preis. */
export const AUSWERTUNG_ANLASS_SATZ =
  "Das brauchen wir für Ihre FIAON-Bonitätsauswertung. Sobald beides da ist, entwickelt Ihr FIAON-Team Ihren Bericht — Sie bekommen ihn als PDF per E-Mail und in Ihrem FIAON-Bereich.";

/** Der Schlüssel der Aufgabe „Unterlagen da — Bonitätsauswertung entwickeln“ (derselbe wie beim Upload-Link). */
export const entwickelnSchluessel = (personId: number) => `unterlagen-eingang:${personId}`;

export interface AuswertungKauf {
  ref: string;
  bezahltAm: string | null;
  betragCents: number | null;
  personId: number;
}

async function familieVon(personId: number, lauf: Lauf): Promise<number[]> {
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  return personFamilie(personId, lauf).catch(() => [personId]);
}

/** Die jüngste bezahlte, nicht stornierte Bonitätsauswertung (privat) der Person samt Dubletten — null, wenn keine. */
export async function auswertungKauf(personId: number, lauf: Lauf = sqlPool): Promise<AuswertungKauf | null> {
  const familie = await familieVon(personId, lauf);
  const [z] = (await lauf`
    SELECT ref, paid_at, amount_due, person_id FROM fiaon_applications
     WHERE person_id = ANY(${familie}) AND merged_into IS NULL
       AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
       AND payment_status = 'paid' AND cancelled_at IS NULL AND gdpr_deleted_at IS NULL
       AND LOWER(TRIM(COALESCE(pack_key, ''))) <> ALL(${FIRMA_SCHLUESSEL})
     ORDER BY paid_at DESC NULLS LAST, created_at DESC LIMIT 1`) as any[];
  if (!z) return null;
  return {
    ref: String(z.ref), personId: Number(z.person_id),
    bezahltAm: z.paid_at ? new Date(z.paid_at).toISOString() : null,
    betragCents: z.amount_due != null ? Math.round(Number(z.amount_due) * 100) : null,
  };
}

/**
 * Darf das Team die Auswertung heute entwickeln? null = ja, sonst der Satz für den Mitarbeiter.
 * Gesperrt nur, wenn die Person sie GEKAUFT hat, den Beginn vor Ablauf der Widerrufsfrist nicht verlangt hat
 * und die Frist noch läuft — und sie nicht ohnehin im Paket enthalten ist (dort gilt der Paketvertrag).
 */
export async function auswertungStartSperre(personId: number, lauf: Lauf = sqlPool): Promise<{ satz: string; ab: string; abText: string } | null> {
  const kauf = await auswertungKauf(personId, lauf);
  if (!kauf) return null;
  const { auskunftWiderrufStand } = await import("./fiaon-auskunft-lieferung");
  const w = await auskunftWiderrufStand(kauf.ref, lauf).catch(() => null);
  if (!w?.warten || !w.ab || !w.abText) return null;
  const karte = await import("./fiaon-konto-karte");
  await karte.bonitaetBereit().catch(() => {});
  const pid = String(Math.trunc(personId));
  const [i] = (await lauf`SELECT ${lauf.unsafe(karte.BONITAET_INKLUSIVE_SQL(pid))} AS ja`.catch(() => [])) as any[];
  if (i?.ja) return null;
  return {
    ab: w.ab, abText: w.abText,
    satz: `Der Kunde hat bei der Bestellung (${kauf.ref}) nicht verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen. Die Bonitätsauswertung darf erst ab dem ${w.abText} entwickelt werden.`,
  };
}

export interface AuswertungLage {
  stand: AuswertungKundenStand;
  /** Zahlender Paketkunde, dessen Kartenlink auf die Bonität wartet — nichts verkaufen. */
  inklusive: boolean;
  /** Läuft ein bezahltes Privatpaket? (Für das Folgeangebot nach der Lieferung.) */
  paketLaeuft: boolean;
  kauf: AuswertungKauf | null;
  /** Was für den Start noch fehlt — nur bei „unterlagen_fehlen“. */
  fehlt: ("ausweis" | "kontoauszug")[];
  /** Erster Tag, an dem das Team beginnen darf („16.10.2026“) — nur bei „beginnt_ab“. */
  abText: string | null;
  /** Preis für diesen Menschen (74 € mit Paket, sonst 149 €). */
  preisText: string;
  mitAbo: boolean;
  /** Die offene Bestellung (bestellt, nicht bezahlt). */
  offen: { betragText: string; gemeldet: boolean; zahlungsseite: string | null } | null;
  /** Die freigegebene Fassung — `gelesen`: der Kunde hat sie in seinem Bereich geöffnet. */
  aktuell: { nummer: string; freigegebenAm: string | null; gelesen: boolean } | null;
}

/**
 * Wo steht dieser Mensch mit seiner FIAON-Bonitätsauswertung? EINE Antwort für Kundenbereich, Kaufkarte,
 * Kauflink und Mara — ohne Kosten (liest nur, startet nichts).
 */
export async function auswertungLage(personId: number, lauf: Lauf = sqlPool): Promise<AuswertungLage> {
  const { auskunftStand, standZumZeigen } = await import("./fiaon-auskunft");
  const st = standZumZeigen(await auskunftStand(personId, lauf, "privat", { land: false }));
  const { absoluteUrl } = await import("../fiaon-base-url");
  const offen = st.stufe === "offen" && st.offen
    ? {
        betragText: euroText(st.offen.betragCents || st.preis.cents), gemeldet: st.offen.status === "claimed_paid",
        zahlungsseite: st.offen.paymentReference ? absoluteUrl(`/zahlung/${encodeURIComponent(st.offen.paymentReference)}`) : null,
      }
    : null;
  const familie = await familieVon(personId, lauf);
  const { ensureFinanzauswertungTabellen } = await import("./fiaon-finanzauswertung");
  await ensureFinanzauswertungTabellen();
  const [fa] = (await lauf`
    SELECT person_id, fassung, freigegeben_am, kunde_gelesen_am FROM fiaon_finanzauswertungen
     WHERE person_id = ANY(${familie}) AND status = 'freigegeben' ORDER BY freigegeben_am DESC NULLS LAST, id DESC LIMIT 1`) as any[];
  const { hatLaufendesPaket } = await import("./fiaon-auskunft");
  const paketLaeuft = await hatLaufendesPaket(personId, lauf).catch(() => false);
  const basis = {
    inklusive: !!st.inklusive, paketLaeuft, preisText: st.preis.text, mitAbo: st.preis.mitAbo, offen,
    aktuell: fa ? {
      nummer: auswertungNummer(Number(fa.person_id), Number(fa.fassung)),
      freigegebenAm: fa.freigegeben_am ? new Date(fa.freigegeben_am).toISOString() : null, gelesen: !!fa.kunde_gelesen_am,
    } : null,
  };
  const kauf = await auswertungKauf(personId, lauf);
  if (fa || st.auswertungDa) return { ...basis, stand: "liegt_vor", kauf, fehlt: [], abText: null };
  if (kauf || st.inklusive) {
    const { eingabenSammeln } = await import("./fiaon-finanzauswertung");
    const e = await eingabenSammeln(personId, lauf).catch(() => null);
    if (!e?.voraussetzungen.bereit) {
      const fehlt: ("ausweis" | "kontoauszug")[] = [];
      if (!e?.ausweis.vorhanden) fehlt.push("ausweis");
      // Ein vorhandener, aber nachweislich unlesbarer Auszug zählt wie ein fehlender (beides da, trotzdem nicht bereit).
      if (!e?.auszug.vorhanden || (e.ausweis.vorhanden && !e.voraussetzungen.bereit)) fehlt.push("kontoauszug");
      return { ...basis, stand: "unterlagen_fehlen", kauf, fehlt, abText: null };
    }
    const sperre = kauf ? await auswertungStartSperre(personId, lauf).catch(() => null) : null;
    if (sperre) return { ...basis, stand: "beginnt_ab", kauf, fehlt: [], abText: sperre.abText };
    return { ...basis, stand: "wird_entwickelt", kauf, fehlt: [], abText: null };
  }
  if (offen) return { ...basis, stand: "zahlung_offen", kauf: null, fehlt: [], abText: null };
  return { ...basis, stand: "nicht_bestellt", kauf: null, fehlt: [], abText: null };
}

/** Die Aufgabe ans Team, wenn eine bezahlte oder inklusive Auswertung startklar ist — idempotent je Person. */
export async function auswertungStartklarMelden(personId: number, anlass: string, lauf: Lauf = sqlPool): Promise<{ angelegt: boolean; grund: string }> {
  const lage = await auswertungLage(personId, lauf);
  if (lage.stand !== "wird_entwickelt" && lage.stand !== "beginnt_ab") return { angelegt: false, grund: `Stand ${lage.stand}` };
  // Läuft schon ein Entwurf (oder ein Lauf)? Dann hat das Team sie in der Hand — keine zweite Aufgabe.
  const familie = await familieVon(personId, lauf);
  const [lauft] = (await lauf`SELECT 1 FROM fiaon_finanzauswertungen WHERE person_id = ANY(${familie}) AND status IN ('laeuft', 'entwurf') LIMIT 1`) as any[];
  if (lauft) return { angelegt: false, grund: "Entwurf oder Lauf vorhanden" };
  const [p] = (await lauf`SELECT first_name, last_name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || `Person ${personId}`;
  const sperre = lage.stand === "beginnt_ab" ? await auswertungStartSperre(personId, lauf).catch(() => null) : null;
  const { werktageSpaeter } = await import("../routes/fiaon-app");
  const faellig = sperre?.ab ?? werktageSpaeter(1);
  const grundSatz = lage.kauf
    ? `Der Kunde hat die FIAON-Bonitätsauswertung bezahlt (${lage.kauf.ref}${lage.kauf.betragCents ? `, ${euroText(lage.kauf.betragCents)}` : ""}).`
    : "Die FIAON-Bonitätsauswertung ist im Paket des Kunden enthalten — sein Link zum Kartenantrag wartet auf sie (E-363).";
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const { beschaffungVerantwortlich } = await import("./fiaon-auskunft-lieferung");
  const verantwortlich = await beschaffungVerantwortlich(lauf).catch(() => null);
  const ref = lage.kauf?.ref ?? (await lauf`SELECT ref FROM fiaon_applications WHERE person_id = ANY(${familie}) AND merged_into IS NULL
                                              ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1` as any[])[0]?.ref ?? null;
  try {
    await auftragFuerKunden({
      personId, ref, agentId: verantwortlich?.id ?? null, faelligAm: faellig,
      schluessel: entwickelnSchluessel(personId),
      titel: `${name}: Bonitätsauswertung entwickeln${lage.kauf ? " (bezahlt)" : " (inklusive)"}`,
      text: `${grundSatz} Ausweis und Kontoauszug liegen vor (${anlass}).\n\n`
        + "Akte öffnen → Überblick → „Bonität jetzt entwickeln“. Danach PDF prüfen und „Freigeben & an den Kunden“ — der Kunde bekommt Mail und PDF, die Aufgabe schließt sich."
        + (sperre ? `\n\nWIDERRUFSFRIST: ${sperre.satz}` : ""),
      quelle: "bestellung", bereich: "pruefen", autorName: "Bonitätsauswertung",
      anlageText: `Angelegt, weil die Unterlagen für die Bonitätsauswertung vollständig sind (${anlass}).`,
    });
    return { angelegt: true, grund: "Aufgabe angelegt" };
  } catch (e) {
    console.error(`[BONITAET-ABLAUF] Aufgabe für Person ${personId}:`, String((e as Error)?.message || e).slice(0, 200));
    return { angelegt: false, grund: "Aufgabe nicht angelegt" };
  }
}

/** Nach der Freigabe: die Aufgabe „entwickeln“ schließt sich (wie die Beschaffung, E-355). */
export async function auswertungFreigegeben(personId: number, nummer: string, von: string, lauf: Lauf = sqlPool): Promise<number> {
  const { systemAufgabenErledigen } = await import("./fiaon-auskunft-lieferung");
  const familie = await familieVon(personId, lauf);
  return systemAufgabenErledigen(familie.map(entwickelnSchluessel), `Bonitätsauswertung ${nummer} freigegeben`, von, lauf).catch(() => 0);
}

export interface AblaufErgebnis {
  ok: boolean;
  text: string;
  /** Upload-Link verschickt? */
  anforderung: "gesendet" | "nicht_noetig" | "abgelehnt" | "fehlgeschlagen" | "schon_gelaufen";
  aufgabe: boolean;
}

/**
 * Nach der Zahlung einer Bonitätsauswertung (privat): Unterlagen anfordern oder gleich die Aufgabe ans Team.
 * Idempotent je Bestellung (Marke im Verlauf, Sperre je Bestellung). `mail: false` = keine Mail (Nachholen von Hand).
 */
export async function auswertungLieferungStarten(ref: string, personId: number, opts: { mail?: boolean; von?: string } = {}, lauf: Lauf = sqlPool): Promise<AblaufErgebnis> {
  const erstesMal = await lauf.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`bonitaet-ablauf:${ref}`}))`;
    const [da] = (await tx`SELECT 1 FROM fiaon_contact_log WHERE ref = ${ref} AND note LIKE ${`${AUSWERTUNG_ABLAUF_VERMERK}%`} AND voided_at IS NULL LIMIT 1`) as any[];
    if (da) return false;
    await tx`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
             VALUES (${ref}, ${personId}, NULL, ${opts.von ?? "System"}, 'system', ${`${AUSWERTUNG_ABLAUF_VERMERK}.`})`;
    return true;
  });
  if (!erstesMal) return { ok: true, text: `Der Ablauf für ${ref} lief schon — nichts doppelt.`, anforderung: "schon_gelaufen", aufgabe: false };

  const lage = await auswertungLage(personId, lauf);
  const vermerk = (text: string) => lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${personId}, NULL, ${opts.von ?? "System"}, 'system', ${text.slice(0, 1900)})`.catch(() => {});

  if (lage.stand === "liegt_vor") {
    // Bezahlt, obwohl schon eine Auswertung beim Kunden liegt — das klärt ein Mensch (neue Fassung oder Erstattung).
    const { todoMeldung } = await import("../routes/fiaon-betreiber-todo");
    await todoMeldung(`bonitaet-doppelt:${ref}`, {
      titel: `Bonitätsauswertung bezahlt, obwohl schon eine vorliegt (${ref})`,
      text: `Die Bestellung ${ref} ist bezahlt, beim Kunden liegt aber schon die Bonitätsauswertung ${lage.aktuell?.nummer ?? ""}. Bitte klären: neue Fassung mit aktuellen Kontoauszügen erstellen oder den Betrag erstatten.`,
      bereich: "pruefen", link: `/akte/${encodeURIComponent(ref)}`,
    }, { name: "Bonitätsauswertung", agentId: null }).catch(() => {});
    await vermerk("Bonitätsauswertung bezahlt, beim Kunden liegt schon eine — Meldung an die Leitung.");
    return { ok: true, text: `${ref}: Auswertung liegt schon vor — Meldung an die Leitung.`, anforderung: "nicht_noetig", aufgabe: false };
  }

  if (lage.stand === "unterlagen_fehlen" && lage.fehlt.length) {
    if (opts.mail === false) {
      await vermerk(`Bonitätsauswertung bezahlt — es fehlen ${lage.fehlt.join(" und ")}; keine Mail (von Hand gestartet).`);
      return { ok: true, text: `${ref}: Unterlagen fehlen (${lage.fehlt.join(", ")}) — ohne Mail.`, anforderung: "nicht_noetig", aufgabe: false };
    }
    const { eingabenSammeln } = await import("./fiaon-finanzauswertung");
    const e = await eingabenSammeln(personId, lauf).catch(() => null);
    const saetze: Partial<Record<"ausweis" | "kontoauszug", string>> = {};
    if (e?.voraussetzungen.ausweis.bitte) saetze.ausweis = e.voraussetzungen.ausweis.bitte;
    if (e?.voraussetzungen.kontoauszug.bitte) saetze.kontoauszug = e.voraussetzungen.kontoauszug.bitte;
    const { unterlagenAnfrageSenden } = await import("./fiaon-unterlagen-link");
    const r = await unterlagenAnfrageSenden({
      personId, arten: lage.fehlt, kanaele: ["mail"], saetze, quelle: "auskunft", anlassSatz: AUSWERTUNG_ANLASS_SATZ,
      akteur: { name: "Bonitätsauswertung", agentId: null, rolle: "admin" /* System-Absender wie Monatsbericht und Kartenlink */ }, lauf,
    }).catch((err: unknown) => ({ ok: false, status: "fehlgeschlagen", meldung: String((err as Error)?.message || err) } as any));
    const anforderung: AblaufErgebnis["anforderung"] = r.ok ? "gesendet" : r.status === "abgelehnt" ? "abgelehnt" : "fehlgeschlagen";
    if (!r.ok) {
      // Ging die Bitte nicht hinaus, muss ein Mensch nachfassen — sonst wartet der Käufer still.
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId, ref, schluessel: `bonitaet-unterlagen-fehlen:${ref}`, bereich: "pruefen", quelle: "bestellung", autorName: "Bonitätsauswertung",
        titel: "Bonitätsauswertung bezahlt — Unterlagen anfordern",
        text: `Die FIAON-Bonitätsauswertung ${ref} ist bezahlt. Die automatische Bitte um ${lage.fehlt.join(" und ")} ging NICHT hinaus: ${String(r.meldung ?? "").slice(0, 300)}\n\nBitte den Kunden anrufen oder in der Akte → Dokumente → „Beim Kunden anfordern“.`,
        anlageText: "Angelegt, weil die Unterlagen-Bitte nach der Zahlung nicht zugestellt werden konnte.",
      }).catch(() => {});
    }
    await vermerk(`Bonitätsauswertung bezahlt — Ausweis/Kontoauszug angefordert (${lage.fehlt.join(", ")}): ${r.ok ? "Upload-Link per Mail gesendet" : `NICHT gesendet (${String(r.meldung ?? "").slice(0, 200)})`}.`);
    return { ok: true, text: `${ref}: Unterlagen angefordert — ${anforderung}.`, anforderung, aufgabe: false };
  }

  const a = await auswertungStartklarMelden(personId, "nach der Zahlung", lauf);
  await vermerk(`Bonitätsauswertung bezahlt — Unterlagen liegen vor${lage.stand === "beginnt_ab" ? `, Beginn ab ${lage.abText} (Widerrufsfrist)` : ""}. Aufgabe ans Team: ${a.angelegt ? "angelegt" : a.grund}.`);
  return { ok: true, text: `${ref}: Unterlagen da — Aufgabe ${a.angelegt ? "angelegt" : a.grund}.`, anforderung: "nicht_noetig", aufgabe: a.angelegt };
}

// ═══════════════════════════════════════════════════════════════════════════
// ERINNERUNG: UNTERLAGEN FEHLEN NOCH
//
// Wer bezahlt hat und nach drei Tagen noch keinen Ausweis oder Kontoauszug geschickt hat, bekommt die
// Bitte erneut — mit frischem Link (der alte gilt 14 Tage). Höchstens drei Erinnerungen je Bestellung
// (Tag 3, 7, 14 nach der vorigen Bitte grob), danach steht er in der Arbeitsliste „Unterlagen fehlen“.
// Pflichtpost (keine Werbung): Die Bitte gilt der bezahlten Leistung. Werktags-Fenster wie die Zahlungserinnerung.
// ═══════════════════════════════════════════════════════════════════════════
export const ERINNERUNG_HOECHSTENS = 3;
const ABSTAND_TAGE = [3, 4, 7];

export async function auswertungUnterlagenErinnern(lauf: Lauf = sqlPool, opts: { hoechstens?: number; jetzt?: Date } = {}): Promise<{ geprueft: number; gesendet: number; texte: string[] }> {
  // Nur tagsüber (Berlin, über formatToParts — Zeit-Falle Berlin-Stunde): 09:00–19:00.
  const stunde = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(opts.jetzt ?? new Date()).find((p) => p.type === "hour")?.value ?? "12");
  if (!opts.jetzt && (stunde < 9 || stunde >= 19)) return { geprueft: 0, gesendet: 0, texte: ["außerhalb 09–19 Uhr"] };
  const { ensureUnterlagenLinkTabellen } = await import("./fiaon-unterlagen-link");
  await ensureUnterlagenLinkTabellen();
  const { ensureFinanzauswertungTabellen } = await import("./fiaon-finanzauswertung");
  await ensureFinanzauswertungTabellen();
  // Bezahlte Bonitätsauswertungen (privat) ohne freigegebene Fassung, die den Ablauf schon hatten.
  const faelle = (await lauf`
    SELECT a.ref, a.person_id,
           (SELECT COUNT(*)::int FROM fiaon_unterlagen_anfragen u WHERE u.person_id = a.person_id AND u.quelle = 'auskunft') AS bitten,
           (SELECT MAX(u.am) FROM fiaon_unterlagen_anfragen u WHERE u.person_id = a.person_id) AS letzte
      FROM fiaon_applications a
     WHERE a.merged_into IS NULL AND (COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
       AND a.payment_status = 'paid' AND a.cancelled_at IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
       AND LOWER(TRIM(COALESCE(a.pack_key, ''))) <> ALL(${FIRMA_SCHLUESSEL})
       AND EXISTS (SELECT 1 FROM fiaon_contact_log c WHERE c.ref = a.ref AND c.note LIKE ${`${AUSWERTUNG_ABLAUF_VERMERK}%`} AND c.voided_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM fiaon_finanzauswertungen f WHERE f.person_id = a.person_id AND f.status IN ('freigegeben', 'ersetzt', 'entwurf', 'laeuft'))
     ORDER BY a.paid_at ASC NULLS LAST
     LIMIT 200`) as any[];
  const jetzt = (opts.jetzt ?? new Date()).getTime();
  const hoechstens = opts.hoechstens ?? 10;
  let gesendet = 0;
  const texte: string[] = [];
  for (const f of faelle) {
    if (gesendet >= hoechstens) break;
    const bitten = Number(f.bitten || 0);
    if (bitten < 1 || bitten > ERINNERUNG_HOECHSTENS) continue;
    const abstand = ABSTAND_TAGE[Math.min(bitten - 1, ABSTAND_TAGE.length - 1)];
    if (f.letzte && jetzt - new Date(f.letzte).getTime() < abstand * 86_400_000) continue;
    const personId = Number(f.person_id);
    const lage = await auswertungLage(personId, lauf).catch(() => null);
    if (!lage || lage.stand !== "unterlagen_fehlen" || !lage.fehlt.length) continue;
    const { unterlagenAnfrageSenden } = await import("./fiaon-unterlagen-link");
    const r = await unterlagenAnfrageSenden({
      personId, arten: lage.fehlt, kanaele: ["mail"], quelle: "auskunft",
      anlassSatz: `Kurze Erinnerung: ${AUSWERTUNG_ANLASS_SATZ}`,
      akteur: { name: "Bonitätsauswertung (Erinnerung)", agentId: null, rolle: "admin" }, lauf,
    }).catch((err: unknown) => ({ ok: false, meldung: String((err as Error)?.message || err) } as any));
    if (r.ok) gesendet++;
    texte.push(`${f.ref}: Erinnerung ${bitten} — ${r.ok ? "gesendet" : `nicht gesendet (${String(r.meldung ?? "").slice(0, 120)})`}`);
  }
  return { geprueft: faelle.length, gesendet, texte };
}
