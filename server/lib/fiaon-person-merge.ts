// ═══════════════════════════════════════════════════════════════════════════
// PERSONEN ZUSAMMENFÜHREN — verlustfrei, in einer Transaktion, mit Zählprobe
//
// WARUM DIESE DATEI EXISTIERT
// Der Bestand hat Dubletten: „Axel Conrad" lag zweimal, „Mario Fricker"
// neunmal. Der Dubletten-Erkenner findet sie seit Wochen — aber es gab kein
// Werkzeug, mit dem ein Mensch einen Zusammenschluss entscheiden und ausführen
// kann. Frühere Versuche haben Daten verloren, und seither traut niemand mehr
// dem Zusammenführen. Zu Recht: Ein Merge, der einen Gesprächsverlauf
// verschluckt, kostet einen Abschluss und das Vertrauen in jede Liste.
//
// DAS VERSPRECHEN, DAS DIESE FUNKTION EINLÖSEN MUSS
// EIN Merge darf NICHTS verlieren. Deshalb:
//
//   1. EINE Transaktion. Schlägt irgendein Schritt fehl, ist nichts passiert.
//      Kein halb zusammengeführter Kunde, der in zwei Listen verschieden
//      aussieht — das war der schlimmste Zustand der alten Versuche.
//
//   2. ZÄHLPROBE als Teil der Funktion, nicht als Prüfstand daneben. Vor dem
//      Umhängen werden alle Einträge beider Personen gezählt, danach am
//      Gewinner erneut. Stimmt die Summe nicht, wird die Transaktion
//      abgebrochen. Die Funktion darf nicht behaupten können, sie habe nichts
//      verloren — sie muss es belegen, bei jedem einzelnen Aufruf.
//
//   3. KEIN WERT WIRD ÜBERSCHRIEBEN UND VERGESSEN. Der Gewinner behält seine
//      Stammdaten; jeder abweichende Wert des Verlierers wandert nach
//      `fiaon_person_aliases` (mit `quelle_person_id`). Die Suche trifft auch
//      über Aliase — wer die alte Adresse eingibt, findet die Person weiter.
//
//   4. KEIN HARD-DELETE. Der Verlierer bleibt als Datensatz bestehen und zeigt
//      per `merged_into_person_id` auf den Gewinner. Ein falscher Zusammenschluss
//      ist damit rekonstruierbar.
//
// WAS DIESE FUNKTION AUSDRÜCKLICH NICHT TUT
// Sie legt keine Bestellung still und löscht keine. Ein Kunde mit drei
// Bestellungen hat nach dem Merge drei Bestellungen — an einer Person. Ob eine
// davon fachlich überflüssig ist (Produkt-Hygiene), ist eine andere Frage mit
// einer anderen Entscheidung (Archiv, Teil 3).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

/** Ein laufender Transaktionskontext von postgres.js (oder der Pool selbst). */
type Lauf = typeof sqlPool;

/** Felder, deren abweichende Werte gesichert werden müssen. */
export const STAMMFELDER = [
  "first_name", "last_name", "company_name", "contact_name",
  "primary_email", "primary_phone", "birthdate",
  "street", "zip", "city", "country", "nationality",
] as const;
export type Stammfeld = (typeof STAMMFELDER)[number];

/** Klartext-Namen für Protokoll und Oberfläche. */
export const FELD_NAME: Record<string, string> = {
  first_name: "Vorname", last_name: "Nachname", company_name: "Firma",
  contact_name: "Ansprechpartner", primary_email: "E-Mail", primary_phone: "Telefon",
  birthdate: "Geburtsdatum", street: "Straße", zip: "PLZ", city: "Ort",
  country: "Land", nationality: "Staatsangehörigkeit",
};

export interface MergeEntscheidungen {
  /** Pro Feld: von welcher Seite der Wert stehen bleibt. Vorgabe: Gewinner. */
  felder?: Partial<Record<Stammfeld, "gewinner" | "verlierer">>;
  /** Pflicht, wenn BEIDE Personen einen dokumentierten Betreuer haben. */
  betreuer?: "gewinner" | "verlierer";
}

export interface MergeAkteur {
  /** Klartext, steht im Protokoll: „Betreiber (Admin)" oder „Sabine M. (Vertriebsleitung)". */
  name: string;
  agentId?: number | null;
}

export interface Zaehlprobe {
  bestellungen: { vorher: number; nachher: number };
  verlauf: { vorher: number; nachher: number };
  termine: { vorher: number; nachher: number };
  zusagen: { vorher: number; nachher: number };
  wiedervorlagen: { vorher: number; nachher: number };
  provisionen: { vorher: number; nachher: number };
  leads: { vorher: number; nachher: number };
  leadVerlauf: { vorher: number; nachher: number };
  aliase: { vorher: number; nachher: number };
}

export interface MergeErgebnis {
  gewinnerId: number;
  verliererId: number;
  bestellungenUebernommen: string[];
  gesicherteWerte: { feld: string; feldName: string; wert: string }[];
  uebernommeneFelder: { feld: string; feldName: string; von: string; nach: string }[];
  betreuer: { agentId: number | null; quelle: "gewinner" | "verlierer" | "unstrittig" };
  zaehlprobe: Zaehlprobe;
  notizRef: string | null;
}

/** Fachlicher Fehler mit Klartext für die Oberfläche. */
export class MergeVerboten extends Error {
  code: string;
  constructor(code: string, nachricht: string) {
    super(nachricht);
    this.name = "MergeVerboten";
    this.code = code;
  }
}

// ── Testkonto-Erkennung ────────────────────────────────────────────────────
// Ein Testdatensatz und ein echter Kunde dürfen nie verschmelzen: Entweder
// verschwindet ein echter Kunde in einem Testkonto, oder Testdaten landen in
// einer echten Kundenakte. Beides ist nicht mehr sauber auflösbar.
const TEST_MUSTER = [/@fiaon-internal\.dev$/i, /\.invalid$/i, /@example\.(com|org)$/i];
const TEST_REF_MUSTER = [/^FIA-DEV-/i, /^FIAON-TEST-/i, /^FIAON-P-TEST/i];

export function istTestperson(person: any, refs: string[] = []): boolean {
  const mails = [person?.primary_email, ...(person?.__aliasMails ?? [])].filter(Boolean);
  if (mails.some((m: string) => TEST_MUSTER.some((r) => r.test(String(m))))) return true;
  if (TEST_REF_MUSTER.some((r) => r.test(String(person?.person_ref ?? "")))) return true;
  return refs.some((ref) => TEST_REF_MUSTER.some((r) => r.test(String(ref))));
}

// ── Zählungen: alles, was an einer Person hängt ────────────────────────────
//
// Der Verlauf hängt im Datenmodell an der BESTELLUNG (`fiaon_contact_log.ref`),
// nicht an der Person. Er wandert also automatisch mit, sobald die Bestellung
// umgehängt ist. „Automatisch" ist aber genau die Annahme, an der frühere
// Merges gescheitert sind — deshalb wird sie hier gezählt statt geglaubt.
async function zaehle(lauf: Lauf, personIds: number[]): Promise<Record<keyof Zaehlprobe, number>> {
  const ids = personIds.filter((n) => Number.isFinite(n));
  const [r] = await lauf`
    WITH refs AS (
      SELECT ref FROM fiaon_applications WHERE person_id = ANY(${ids}::int[])
    ), leads AS (
      SELECT id FROM fiaon_leads WHERE person_id = ANY(${ids}::int[])
    )
    SELECT
      (SELECT COUNT(*) FROM refs)::int AS bestellungen,
      (SELECT COUNT(*) FROM fiaon_contact_log c WHERE c.ref IN (SELECT ref FROM refs))::int AS verlauf,
      (SELECT COUNT(*) FROM fiaon_contact_log c
        WHERE c.ref IN (SELECT ref FROM refs) AND c.scheduled_at IS NOT NULL)::int AS termine,
      (SELECT COUNT(*) FROM fiaon_contact_log c
        WHERE c.ref IN (SELECT ref FROM refs) AND c.promised_date IS NOT NULL)::int AS zusagen,
      (SELECT COUNT(*) FROM fiaon_persons p
        WHERE p.id = ANY(${ids}::int[]) AND p.follow_up_date IS NOT NULL)::int AS wiedervorlagen,
      (SELECT COUNT(*) FROM fiaon_commissions k WHERE k.ref IN (SELECT ref FROM refs))::int AS provisionen,
      (SELECT COUNT(*) FROM leads)::int AS leads,
      (SELECT COUNT(*) FROM fiaon_lead_log g WHERE g.lead_id IN (SELECT id FROM leads))::int AS lead_verlauf,
      (SELECT COUNT(*) FROM fiaon_person_aliases x WHERE x.person_id = ANY(${ids}::int[]))::int AS aliase
  `;
  return {
    bestellungen: Number(r.bestellungen), verlauf: Number(r.verlauf),
    termine: Number(r.termine), zusagen: Number(r.zusagen),
    wiedervorlagen: Number(r.wiedervorlagen), provisionen: Number(r.provisionen),
    leads: Number(r.leads), leadVerlauf: Number(r.lead_verlauf), aliase: Number(r.aliase),
  };
}

const leer = (v: unknown): boolean =>
  v == null || (typeof v === "string" && v.trim() === "");

/**
 * Zwei Personen zusammenführen.
 *
 * @param verliererId Person, die aufgeht (bleibt als Wegweiser bestehen)
 * @param gewinnerId  Person, die bestehen bleibt
 * @param entscheidungen Feld- und Betreuerwahl eines Menschen
 * @param akteur Wer das entschieden hat — steht im Protokoll
 * @param opts.tx Optionaler Transaktionskontext (der Prüfstand rollt damit alles zurück)
 */
export async function personenZusammenfuehren(
  verliererId: number,
  gewinnerId: number,
  entscheidungen: MergeEntscheidungen,
  akteur: MergeAkteur,
  opts: { tx?: Lauf } = {},
): Promise<MergeErgebnis> {
  if (opts.tx) return fuehreAus(opts.tx, verliererId, gewinnerId, entscheidungen, akteur);
  // Eine Transaktion um ALLES. Ein Merge ist entweder ganz passiert oder gar nicht.
  return sqlPool.begin((tx) => fuehreAus(tx as Lauf, verliererId, gewinnerId, entscheidungen, akteur)) as Promise<MergeErgebnis>;
}

async function fuehreAus(
  lauf: Lauf,
  verliererId: number,
  gewinnerId: number,
  entscheidungen: MergeEntscheidungen,
  akteur: MergeAkteur,
): Promise<MergeErgebnis> {
  // ── Wälle: was gar nicht passieren darf ─────────────────────────────────
  if (!Number.isFinite(verliererId) || !Number.isFinite(gewinnerId)) {
    throw new MergeVerboten("ungueltig", "Beide Personen müssen benannt sein.");
  }
  if (verliererId === gewinnerId) {
    throw new MergeVerboten("selbst_merge",
      "Eine Person kann nicht mit sich selbst zusammengeführt werden.");
  }

  // FOR UPDATE: Zwei gleichzeitige Merges auf dieselbe Person würden sonst
  // beide ihre Zählprobe bestehen und zusammen doch Unsinn erzeugen.
  const [verlierer] = await lauf`SELECT * FROM fiaon_persons WHERE id = ${verliererId} FOR UPDATE`;
  const [gewinner] = await lauf`SELECT * FROM fiaon_persons WHERE id = ${gewinnerId} FOR UPDATE`;
  if (!verlierer) throw new MergeVerboten("nicht_gefunden", `Person ${verliererId} gibt es nicht.`);
  if (!gewinner) throw new MergeVerboten("nicht_gefunden", `Person ${gewinnerId} gibt es nicht.`);

  if (verlierer.merged_into_person_id != null) {
    throw new MergeVerboten("bereits_gemergt",
      `Person ${verliererId} ist schon in Person ${verlierer.merged_into_person_id} aufgegangen.`);
  }
  if (gewinner.merged_into_person_id != null) {
    throw new MergeVerboten("bereits_gemergt",
      `Person ${gewinnerId} ist selbst schon in Person ${gewinner.merged_into_person_id} aufgegangen — ` +
      `ein Zusammenschluss darauf würde eine Kette erzeugen, die keine Liste mehr auflöst.`);
  }

  // Bestellungen beider Seiten — gebraucht für Testerkennung, Notiz und Zählprobe.
  const bestellungenVerlierer = await lauf`
    SELECT ref, pack_name, payment_status, created_at FROM fiaon_applications
    WHERE person_id = ${verliererId} ORDER BY created_at ASC
  `;
  const bestellungenGewinner = await lauf`
    SELECT ref FROM fiaon_applications WHERE person_id = ${gewinnerId} ORDER BY created_at DESC
  `;

  const testV = istTestperson(verlierer, (bestellungenVerlierer as any[]).map((b) => b.ref));
  const testG = istTestperson(gewinner, (bestellungenGewinner as any[]).map((b) => b.ref));
  if (testV !== testG) {
    throw new MergeVerboten("test_und_echt",
      "Ein Testkonto lässt sich nicht mit einem echten Kunden zusammenführen. " +
      "Testeinträge gehören ins Archiv (Grund „Testeintrag“), nicht in eine Kundenakte.");
  }

  // ── Zuständigkeit: Besitzschutz vor Bequemlichkeit ──────────────────────
  // `betreuung_seit` ist der dokumentierte Betreuer. Hat nur eine Seite einen,
  // gewinnt der — da ist nichts zu entscheiden. Haben beide VERSCHIEDENE, ist
  // das eine Geldfrage (Provision folgt dem dokumentierten Kontakt), und die
  // entscheidet ein Mensch, nicht diese Funktion.
  const betreuungV = verlierer.betreuung_seit != null ? Number(verlierer.assigned_agent_id) : null;
  const betreuungG = gewinner.betreuung_seit != null ? Number(gewinner.assigned_agent_id) : null;
  let betreuerAgentId: number | null = gewinner.assigned_agent_id != null ? Number(gewinner.assigned_agent_id) : null;
  let betreuerQuelle: "gewinner" | "verlierer" | "unstrittig" = "unstrittig";

  if (betreuungV != null && betreuungG != null && betreuungV !== betreuungG) {
    if (entscheidungen.betreuer !== "gewinner" && entscheidungen.betreuer !== "verlierer") {
      throw new MergeVerboten("betreuer_entscheidung_fehlt",
        `Beide Personen haben einen dokumentierten Betreuer (Agent ${betreuungG} und Agent ${betreuungV}). ` +
        `Wer künftig zuständig ist, muss ausdrücklich gewählt werden — das ist eine Geldfrage und ` +
        `keine Automatik.`);
    }
    betreuerQuelle = entscheidungen.betreuer;
    betreuerAgentId = entscheidungen.betreuer === "verlierer" ? betreuungV : betreuungG;
  } else if (betreuungG == null && betreuungV != null) {
    betreuerAgentId = betreuungV;
    betreuerQuelle = "verlierer";
  } else if (betreuungG != null) {
    betreuerQuelle = "gewinner";
  } else if (betreuerAgentId == null && verlierer.assigned_agent_id != null) {
    // Keiner dokumentiert, aber der Verlierer hat eine Zuweisung — sie ist besser
    // als keine, und sie ist umkehrbar.
    betreuerAgentId = Number(verlierer.assigned_agent_id);
    betreuerQuelle = "verlierer";
  }

  // ── Zählprobe, Teil 1: der Stand VOR dem Merge ──────────────────────────
  const vorher = await zaehle(lauf, [verliererId, gewinnerId]);

  // ── Stammdaten: nichts überschreiben, alles sichern ─────────────────────
  const gesicherteWerte: MergeErgebnis["gesicherteWerte"] = [];
  const uebernommeneFelder: MergeErgebnis["uebernommeneFelder"] = [];
  const neueWerte: Record<string, unknown> = {};

  for (const feld of STAMMFELDER) {
    const wertG = gewinner[feld];
    const wertV = verlierer[feld];
    if (leer(wertV)) continue;

    const gleich = !leer(wertG) && String(wertG).trim().toLowerCase() === String(wertV).trim().toLowerCase();
    if (gleich) continue;

    if (leer(wertG)) {
      // Lücke des Gewinners füllen — hier geht nichts verloren.
      neueWerte[feld] = wertV;
      uebernommeneFelder.push({ feld, feldName: FELD_NAME[feld] ?? feld, von: "Verlierer (Lücke gefüllt)", nach: String(wertV) });
      continue;
    }

    const wahl = entscheidungen.felder?.[feld] ?? "gewinner";
    if (wahl === "verlierer") {
      neueWerte[feld] = wertV;
      uebernommeneFelder.push({ feld, feldName: FELD_NAME[feld] ?? feld, von: String(wertG), nach: String(wertV) });
      // Der bisherige Wert des GEWINNERS wird jetzt zum Alias — sonst hätte die
      // ausdrückliche Feldwahl einen Datenverlust zur Folge.
      gesicherteWerte.push({ feld, feldName: FELD_NAME[feld] ?? feld, wert: String(wertG) });
      await sichere(lauf, gewinnerId, feld, String(wertG), gewinnerId);
    } else {
      gesicherteWerte.push({ feld, feldName: FELD_NAME[feld] ?? feld, wert: String(wertV) });
      await sichere(lauf, gewinnerId, feld, String(wertV), verliererId);
    }
  }

  if (Object.keys(neueWerte).length > 0) {
    await lauf`UPDATE fiaon_persons SET ${lauf(neueWerte)}, updated_at = NOW() WHERE id = ${gewinnerId}`;
  }

  // phone_key9 nachziehen, wenn die Rufnummer gewechselt hat — sonst findet der
  // Dubletten-Erkenner die Person über ihre eigene Nummer nicht mehr.
  if (neueWerte.primary_phone) {
    await lauf`
      UPDATE fiaon_persons
      SET phone_key9 = RIGHT(regexp_replace(COALESCE(primary_phone, ''), '\\D', '', 'g'), 9),
          updated_at = NOW()
      WHERE id = ${gewinnerId} AND COALESCE(primary_phone, '') <> ''
    `;
  }

  // Kontostand: 'active' schlägt 'pending'. Eine Sperre bleibt eine Sperre —
  // ein Merge ist keine Entscheidung über ein Konto (Teil 0).
  await lauf`
    UPDATE fiaon_persons SET
      account_status = CASE
        WHEN account_status = 'suspended' OR ${verlierer.account_status} = 'suspended' THEN 'suspended'
        WHEN account_status = 'active' OR ${verlierer.account_status} = 'active' THEN 'active'
        ELSE account_status END,
      first_seen_at = LEAST(COALESCE(first_seen_at, ${verlierer.first_seen_at}),
                            COALESCE(${verlierer.first_seen_at}, first_seen_at)),
      password = COALESCE(password, ${verlierer.password}),
      gc_customer_ref = COALESCE(gc_customer_ref, ${verlierer.gc_customer_ref}),
      gc_mandate_ref = COALESCE(gc_mandate_ref, ${verlierer.gc_mandate_ref}),
      gc_mandate_status = COALESCE(gc_mandate_status, ${verlierer.gc_mandate_status}),
      -- Arbeitsstände: das jeweils dringendere Datum überlebt. Eine Zusage oder
      -- Wiedervorlage zu verlieren heißt, einen zugesagten Anruf zu verlieren.
      promised_payment_date = LEAST(COALESCE(promised_payment_date, ${verlierer.promised_payment_date}),
                                    COALESCE(${verlierer.promised_payment_date}, promised_payment_date)),
      follow_up_date = LEAST(COALESCE(follow_up_date, ${verlierer.follow_up_date}),
                             COALESCE(${verlierer.follow_up_date}, follow_up_date)),
      unreachable_count = GREATEST(COALESCE(unreachable_count, 0), ${Number(verlierer.unreachable_count || 0)}),
      invoice_sent_count = GREATEST(COALESCE(invoice_sent_count, 0), ${Number(verlierer.invoice_sent_count || 0)}),
      -- Eine Sperre durch einen Agenten („Kunde will nicht") gilt weiter, egal
      -- auf welcher der beiden Seiten sie dokumentiert wurde.
      is_blocked = (is_blocked OR ${!!verlierer.is_blocked}),
      updated_at = NOW()
    WHERE id = ${gewinnerId}
  `;

  // ── Aliase: jede je genutzte Adresse bleibt auffindbar ──────────────────
  await lauf`
    UPDATE fiaon_person_aliases
    SET person_id = ${gewinnerId},
        quelle_person_id = COALESCE(quelle_person_id, ${verliererId})
    WHERE person_id = ${verliererId}
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_person_aliases x
        WHERE x.person_id = ${gewinnerId} AND x.kind = fiaon_person_aliases.kind
          AND x.value_norm = fiaon_person_aliases.value_norm
      )
  `;
  // Dubletten unter den Aliasen bleiben beim Verlierer stehen (nichts löschen);
  // sie sind über quelle_person_id weiter zuordenbar.
  await lauf`
    UPDATE fiaon_person_aliases SET quelle_person_id = COALESCE(quelle_person_id, ${verliererId})
    WHERE person_id = ${verliererId}
  `;
  // Primäradressen des Verlierers als Alias sichern, falls sie noch nicht drin sind.
  for (const [kind, wert] of [["email", verlierer.primary_email], ["phone", verlierer.primary_phone]] as const) {
    if (leer(wert)) continue;
    const norm = kind === "email"
      ? String(wert).trim().toLowerCase()
      : String(wert).replace(/\D/g, "").slice(-9);
    if (!norm) continue;
    await lauf`
      INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source, quelle_person_id)
      SELECT ${gewinnerId}, ${kind}, ${norm}, ${String(wert)}, ${"merge:" + verliererId}, ${verliererId}
      WHERE NOT EXISTS (
        SELECT 1 FROM fiaon_person_aliases x
        WHERE x.person_id = ${gewinnerId} AND x.kind = ${kind} AND x.value_norm = ${norm}
      )
    `;
  }

  // ── Bestellungen und Leads umhängen ────────────────────────────────────
  // Der Verlauf (fiaon_contact_log), die Provisionen (fiaon_commissions), die
  // Vermerke und die Login-Historie hängen an `ref` und wandern damit mit.
  // KEINE Bestellung wird gelöscht oder stillgelegt.
  const umgehaengt = await lauf`
    UPDATE fiaon_applications
    SET person_id = ${gewinnerId}, updated_at = NOW()
    WHERE person_id = ${verliererId}
    RETURNING ref
  `;
  await lauf`UPDATE fiaon_leads SET person_id = ${gewinnerId} WHERE person_id = ${verliererId}`;
  // Der Lead-Verlauf (fiaon_lead_log) hängt an lead_id und wandert mit dem Lead.

  // Zuständigkeit setzen — erst jetzt, damit der Trigger
  // (033_person_ownership_trigger) die Bestellungen in einem Zug nachzieht.
  if (betreuerAgentId != null) {
    await lauf`
      UPDATE fiaon_persons SET
        assigned_agent_id = ${betreuerAgentId},
        betreuung_seit = COALESCE(betreuung_seit,
                                  ${verlierer.betreuung_seit ?? null},
                                  CASE WHEN ${betreuerQuelle} = 'unstrittig' THEN NULL ELSE NOW() END),
        updated_at = NOW()
      WHERE id = ${gewinnerId}
    `;
  }

  // Beteiligte Agenten festhalten. Ein Konflikt wird markiert, nicht entschieden —
  // außer ein Mensch hat oben ausdrücklich gewählt.
  const agenten = Array.from(new Set(
    [gewinner.assigned_agent_id, verlierer.assigned_agent_id].filter((v) => v != null).map(Number),
  ));
  if (agenten.length > 1) {
    await lauf`
      UPDATE fiaon_persons SET
        agent_conflict = ${betreuerQuelle === "unstrittig"},
        quality_flags = COALESCE(quality_flags, '{}'::jsonb) || ${JSON.stringify({ agents: agenten })}::jsonb,
        updated_at = NOW()
      WHERE id = ${gewinnerId}
    `;
  }

  // ── Der Verlierer wird Wegweiser, nicht Leiche ─────────────────────────
  await lauf`
    UPDATE fiaon_persons SET
      merged_into_person_id = ${gewinnerId},
      account_status = 'merged',
      is_blocked = TRUE,
      promised_payment_date = NULL,
      follow_up_date = NULL,
      updated_at = NOW()
    WHERE id = ${verliererId}
  `;

  // ── Zählprobe, Teil 2: der Stand NACH dem Merge ────────────────────────
  const nachher = await zaehle(lauf, [gewinnerId]);
  const zaehlprobe: Zaehlprobe = {
    bestellungen: { vorher: vorher.bestellungen, nachher: nachher.bestellungen },
    verlauf: { vorher: vorher.verlauf, nachher: nachher.verlauf },
    termine: { vorher: vorher.termine, nachher: nachher.termine },
    zusagen: { vorher: vorher.zusagen, nachher: nachher.zusagen },
    wiedervorlagen: { vorher: vorher.wiedervorlagen, nachher: nachher.wiedervorlagen },
    provisionen: { vorher: vorher.provisionen, nachher: nachher.provisionen },
    leads: { vorher: vorher.leads, nachher: nachher.leads },
    leadVerlauf: { vorher: vorher.leadVerlauf, nachher: nachher.leadVerlauf },
    aliase: { vorher: vorher.aliase, nachher: nachher.aliase },
  };

  // Die Wiedervorlage ist ein Feld an der Person, kein Eintrag — zwei Personen
  // mit je einer Wiedervorlage ergeben danach EINE (das dringendere Datum
  // überlebt, siehe LEAST oben). Deshalb wird hier nur geprüft, dass keine
  // verschwindet, wo vorher eine war.
  const verstoss: string[] = [];
  for (const feld of ["bestellungen", "verlauf", "termine", "zusagen", "provisionen", "leads", "leadVerlauf"] as const) {
    if (zaehlprobe[feld].nachher < zaehlprobe[feld].vorher) {
      verstoss.push(`${feld}: vorher ${zaehlprobe[feld].vorher}, nachher ${zaehlprobe[feld].nachher}`);
    }
  }
  if (zaehlprobe.wiedervorlagen.vorher > 0 && zaehlprobe.wiedervorlagen.nachher < 1) {
    verstoss.push("wiedervorlagen: die Wiedervorlage ist verschwunden");
  }
  if (zaehlprobe.aliase.nachher < 1 && zaehlprobe.aliase.vorher > 0) {
    verstoss.push(`aliase: vorher ${zaehlprobe.aliase.vorher}, nachher ${zaehlprobe.aliase.nachher}`);
  }
  if (verstoss.length > 0) {
    // Abbruch = Rücknahme der ganzen Transaktion. Lieber kein Merge als ein
    // Merge, der etwas verliert.
    throw new MergeVerboten("zaehlprobe_fehlgeschlagen",
      `Zusammenführen abgebrochen — die Zählprobe stimmt nicht: ${verstoss.join("; ")}. ` +
      `Es wurde nichts geändert.`);
  }

  // Einstufung des Gewinners neu berechnen: Er hat jetzt möglicherweise die
  // dringendere Bestellung der beiden. Ohne diesen Schritt stünde der Kunde im
  // falschen Fach der Anrufliste — mit Daten, die längst eine andere Priorität
  // begründen.
  const { personTierAktualisieren } = await import("./tier");
  await personTierAktualisieren(lauf, { personId: gewinnerId }).catch(() => {});

  // ── Protokoll: zweimal, für zwei verschiedene Leser ────────────────────
  const refs = (umgehaengt as any[]).map((r) => String(r.ref));
  const meta = {
    verliererId, gewinnerId,
    verliererRef: verlierer.person_ref, gewinnerRef: gewinner.person_ref,
    bestellungen: refs,
    felder: uebernommeneFelder,
    gesichert: gesicherteWerte,
    betreuer: { agentId: betreuerAgentId, quelle: betreuerQuelle },
    zaehlprobe,
    akteur: akteur.name,
  };
  await lauf`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (${akteur.agentId ?? null}, 'person_merge', ${JSON.stringify(meta)}, ${akteur.name},
            ${`Person ${verliererId} in Person ${gewinnerId} zusammengeführt`})
  `;

  // Klartext in den Verlauf des Gewinners — dort schaut der Agent hin, nicht in
  // eine Ereignistabelle. Ohne diese Zeile wäre für ihn unerklärlich, warum
  // plötzlich fremde Bestellungen in seiner Akte stehen.
  const notizRef = (bestellungenGewinner as any[])[0]?.ref ?? refs[0] ?? null;
  if (notizRef) {
    const teile = [
      `Zusammengeführt mit Person ${verlierer.person_ref ?? verliererId}`,
      refs.length ? `Bestellungen übernommen: ${refs.join(", ")}` : "keine Bestellungen übernommen",
      gesicherteWerte.length
        ? `Abweichende Angaben gesichert (auffindbar über die Suche): ${gesicherteWerte.map((g) => `${g.feldName} „${g.wert}"`).join(", ")}`
        : "keine abweichenden Angaben",
      `Entschieden von: ${akteur.name}`,
    ];
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
      VALUES (${notizRef}, ${akteur.agentId ?? null}, ${akteur.name}, 'system', 'person_merge',
              ${teile.join(". ") + "."})
    `;
  }

  return {
    gewinnerId, verliererId,
    bestellungenUebernommen: refs,
    gesicherteWerte, uebernommeneFelder,
    betreuer: { agentId: betreuerAgentId, quelle: betreuerQuelle },
    zaehlprobe, notizRef,
  };
}

/** Einen abweichenden Wert sichern — der Kern des Versprechens „nichts geht verloren". */
async function sichere(lauf: Lauf, personId: number, feld: string, wert: string, quellePersonId: number): Promise<void> {
  const norm = feld === "primary_email"
    ? wert.trim().toLowerCase()
    : feld === "primary_phone"
      ? wert.replace(/\D/g, "").slice(-9)
      : wert.trim().toLowerCase();
  if (!norm) return;
  // `kind` bleibt bei E-Mail/Telefon 'email'/'phone', damit die bestehende
  // Alias-Auflösung (fiaon-person-model) sie weiter findet. Alle anderen Felder
  // bekommen ihren Spaltennamen als Art.
  const kind = feld === "primary_email" ? "email" : feld === "primary_phone" ? "phone" : feld;
  await lauf`
    INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, feld_wert, source, quelle_person_id)
    SELECT ${personId}, ${kind}, ${norm}, ${wert}, ${wert}, ${"merge:" + quellePersonId}, ${quellePersonId}
    WHERE NOT EXISTS (
      SELECT 1 FROM fiaon_person_aliases x
      WHERE x.person_id = ${personId} AND x.kind = ${kind} AND x.value_norm = ${norm}
    )
  `;
}

/**
 * Aliase einer Person — für die Akte („frühere Angaben") und den Prüfstand.
 */
export async function aliaseDerPerson(personId: number, lauf: Lauf = sqlPool): Promise<any[]> {
  return await lauf`
    SELECT kind, value_norm, COALESCE(feld_wert, value_raw) AS wert, quelle_person_id, source, created_at
    FROM fiaon_person_aliases
    WHERE person_id = ${personId}
    ORDER BY created_at DESC
  `;
}
