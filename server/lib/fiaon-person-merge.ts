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
import { betreuerLageAus, type BetreuerLage, type BetreuerSeite } from "../../shared/fiaon-betreuer-lage";

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
  /**
   * Pflicht NUR, wenn beide Personen einen VERSCHIEDENEN, AKTIVEN, ECHTEN
   * Betreuer haben (E-IT-E, 08.10.2026 — Regel in shared/fiaon-betreuer-lage.ts).
   */
  betreuer?: "gewinner" | "verlierer";
}

export interface MergeAkteur {
  /** Klartext, steht im Protokoll: „Vorgesetzter (Admin)" oder „Sabine M. (Vertriebsleitung)". */
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
  /**
   * „keiner" (E-IT-E): keine Seite hat einen aktiven Betreuer — die Zuständigkeit
   * des Gewinners bleibt, wie sie ist (auch leer). Nie wieder „Agent 0".
   */
  betreuer: { agentId: number | null; quelle: "gewinner" | "verlierer" | "unstrittig" | "keiner"; text: string; hinweise: string[] };
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

// ── Wer betreut danach? — EINE Quelle für Server, Liste und Oberfläche ─────
//
// E-IT-E (08.10.2026), Punkt 10. Hier wurde der Betreuer jeder Seite als
// „Stempel betreuung_seit gesetzt → Zahl aus assigned_agent_id" gelesen — und
// die Umwandlung von NULL in eine Zahl ergibt 0. Eine Pool-Person mit Stempel `betreuung_seit` (3.029
// von 5.781 am 07.10.2026) galt damit als „von Agent 0 betreut" — gegen jeden
// echten Betreuer hieß das „zwei Betreuer, bitte wählen", und wo keine Wahl
// verlangt wurde, landete die 0 in `assigned_agent_id` (Person 13458).
// Jetzt zählt nur ein AKTIVER, ECHTER Betreuer, und die Regel steht in
// shared/fiaon-betreuer-lage.ts — dieselbe, mit der die Kandidatenliste den
// Streit anzeigt. Oberfläche und Server können nicht mehr auseinanderlaufen.

/** Die Betreuer-Seite einer Person aus ihrer Zeile und den Agenten-Zeilen. */
function betreuerSeiteAus(person: any, agenten: Map<number, any>): BetreuerSeite {
  const roh = person?.assigned_agent_id;
  const id = roh == null ? null : Number(roh);
  const ag = id != null && id > 0 ? agenten.get(id) : undefined;
  return {
    agentId: id,
    agentName: ag?.name ?? null,
    agentGibtEs: !!ag,
    aktiv: ag?.active === true,
    testkonto: ag?.is_test_account === true,
    gesperrt: ag?.zugang_gesperrt_am != null,
    mandatSeit: person?.mandat_seit ?? null,
  };
}

/** Die Agenten-Zeilen beider Seiten — EIN Lookup, in der laufenden Transaktion. */
async function agentenZeilen(personen: any[], lauf: Lauf): Promise<Map<number, any>> {
  const ids = Array.from(new Set(personen
    .map((p) => (p?.assigned_agent_id == null ? NaN : Number(p.assigned_agent_id)))
    .filter((n) => Number.isFinite(n) && n > 0)));
  const karte = new Map<number, any>();
  if (ids.length === 0) return karte;
  const zeilen = (await lauf`
    SELECT id, name, active, is_test_account, zugang_gesperrt_am
    FROM fiaon_agents WHERE id = ANY(${ids}::int[])
  `) as any[];
  for (const z of zeilen) karte.set(Number(z.id), z);
  return karte;
}

/**
 * Die Betreuer-Lage zweier Personen (Zeilen aus fiaon_persons). Wird vom Merge
 * und von der Gegenüberstellung benutzt — eine Regel, ein Ergebnis.
 */
export async function betreuerLage(
  gewinner: any, verlierer: any, lauf: Lauf = sqlPool, wahl?: "gewinner" | "verlierer" | null,
): Promise<BetreuerLage & { seiten: { gewinner: BetreuerSeite; verlierer: BetreuerSeite } }> {
  const agenten = await agentenZeilen([gewinner, verlierer], lauf);
  const seiten = { gewinner: betreuerSeiteAus(gewinner, agenten), verlierer: betreuerSeiteAus(verlierer, agenten) };
  return { ...betreuerLageAus(seiten.gewinner, seiten.verlierer, wahl ?? null), seiten };
}

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

  // ── Zuständigkeit: nur ein AKTIVER Betreuer zählt (E-IT-E, 08.10.2026) ──
  // Gewählt werden muss nur, wenn zwei verschiedene, aktive, echte Betreuer
  // hinterlegt sind — eine Geldfrage (Provision folgt dem dokumentierten
  // Kontakt), die ein Mensch entscheidet. Sonst übernimmt der eine lebende
  // Betreuer automatisch; lebt keiner, bleibt der Gewinner, wie er ist.
  // `betreuung_seit` entscheidet nicht mehr, WER betreut (siehe oben).
  const lage = await betreuerLage(gewinner, verlierer, lauf, entscheidungen.betreuer ?? null);
  if (lage.wahlNoetig) {
    throw new MergeVerboten("betreuer_entscheidung_fehlt",
      `${lage.text} Das ist eine Geldfrage (die Provision folgt dem dokumentierten Kontakt) ` +
      "und keine Automatik — bitte ausdrücklich wählen.");
  }
  const betreuerAgentId: number | null = lage.agentId;
  const betreuerQuelle = lage.quelle;
  // Harte Wand: Nie wieder eine 0 (oder etwas anderes als eine echte Nummer)
  // in assigned_agent_id — dieselbe Klasse wie Person 13458.
  if (betreuerAgentId != null && !(Number.isInteger(betreuerAgentId) && betreuerAgentId > 0)) {
    throw new MergeVerboten("betreuer_ungueltig",
      `Ungültige Betreuer-Nummer „${betreuerAgentId}“ — es wurde nichts geändert.`);
  }

  // ── Zählprobe, Teil 1: der Stand VOR dem Merge ──────────────────────────
  const vorher = await zaehle(lauf, [verliererId, gewinnerId]);

  // ── Aliase ZUERST umhängen ──────────────────────────────────────────────
  //
  // Reihenfolge mit Grund (08.08.2026): Auf `fiaon_person_aliases.value_norm`
  // liegt ein GLOBAL eindeutiger Index für `kind='email'` — eine Adresse gehört
  // im ganzen Haus genau einer Person. Sicherte der Merge zuerst die abweichende
  // Adresse des Verlierers beim Gewinner, kollidierte er mit dem Verlierer, der
  // sie noch hielt: „duplicate key value violates unique constraint
  // fiaon_person_email_unique". Bei der Massen-Zusammenführung fiel dadurch jede
  // Gruppe mit zwei Adressen aus — darunter die größten.
  //
  // Hängt man die Aliase VORHER um, gehört die Adresse bereits dem Gewinner und
  // die Sicherung findet sie vor.
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
      -- E-242 (01.10.2026): kein password mehr — die Person trägt keins (nur die Bestellzeile).
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

  // Primäradressen des Verlierers als Alias sichern, falls sie noch nicht drin sind.
  for (const [kind, wert] of [["email", verlierer.primary_email], ["phone", verlierer.primary_phone]] as const) {
    if (leer(wert)) continue;
    const norm = kind === "email"
      ? String(wert).trim().toLowerCase()
      : String(wert).replace(/\D/g, "").slice(-9);
    if (!norm) continue;
    await sichereAlias(lauf, gewinnerId, kind, norm, String(wert), verliererId);
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
  // Nur wenn ein lebender Betreuer feststeht; sonst bleibt der Gewinner, wie
  // er ist (Fall „keiner" — kein Raten aus betreuung_seit, keine 0).
  // assigned_at stempelt der BEFORE-Trigger (033) bei jedem Wechsel selbst.
  const gewinnerAgent: number | null = gewinner.assigned_agent_id == null ? null : Number(gewinner.assigned_agent_id);
  const wechsel = betreuerAgentId != null && gewinnerAgent !== betreuerAgentId;

  if (betreuerAgentId != null) {
    // Der Besitzer-Trigger (033) schreibt jeden Wechsel als person_owner_changed
    // mit Grund — ohne diese Zeile stand dort „unbekannt".
    if (wechsel) {
      await lauf`SELECT set_config('fiaon.reason', 'person_merge', true)`;
      await lauf`SELECT set_config('fiaon.actor', ${`merge:${akteur.name}`.slice(0, 120)}, true)`;
    }
    await lauf`
      UPDATE fiaon_persons SET
        assigned_agent_id = ${betreuerAgentId},
        updated_at = NOW()
      WHERE id = ${gewinnerId}
    `;
  }
  // Die Bestellungen folgen dem Betreuer wie in der Basis: Der Trigger (033)
  // zieht sie bei einem Wechsel nach, der stündliche Lauf „betreuer-kopie-
  // angleich" gleicht den Rest an. Der Merge schreibt an den Bestellungen
  // selbst keinen Mitarbeiter um (Integrator 08.10.2026: Zuordnung von
  // Bestellungen/Provision bleibt wie in der Basis).

  // Der Besitzschutz-Stempel bleibt erhalten (COALESCE), entscheidet aber
  // nicht mehr, wer betreut. Neu gestempelt wird nur, wenn die Betreuung die
  // Hand wechselt (übernommen oder ausdrücklich gewählt).
  await lauf`
    UPDATE fiaon_persons SET
      betreuung_seit = COALESCE(betreuung_seit, ${verlierer.betreuung_seit ?? null}::timestamptz,
                                CASE WHEN ${wechsel} THEN NOW() ELSE NULL END),
      updated_at = NOW()
    WHERE id = ${gewinnerId}
  `;

  // ── Was am Verlierer hängt und nicht verloren gehen darf (E-IT-E) ──────
  // Gegenprüfung 07.10.2026: Der Merge übertrug die Werbesperre des Verlierers
  // NICHT — 8 zusammengeführte Verlierer hatten eine, ihr Kopf nicht (UWG § 7,
  // DSGVO Art. 21). Weil das Zusammenführen jetzt leichter geht, wandert sie
  // in derselben Scheibe mit: die frühere Sperre gilt. Ebenso das
  // Forderungsmanagement (inkasso_ab): Die überfälligen Raten des Verlierers
  // hängen ab jetzt am Gewinner.
  // Das Mandat (E-066) folgt der QUELLE der Betreuung, nie der Gewinner-Wahl
  // (Gegenprüfung 08.10.2026): Sonst trüge ein Betreuer, der übernimmt oder
  // gewählt wird, das Mandat der anderen Seite still mit.
  //   gewinner   → Mandat des Gewinners      verlierer → Mandat des Verlierers (auch leer)
  //   unstrittig → das frühere beider        keiner    → unverändert
  // Ein Mandat, das nicht mitgeht, nennt der Hinweis (betreuer-lage); der alte
  // Stempel steht im Protokoll (meta.mandat).
  await lauf`
    UPDATE fiaon_persons SET
      werbung_gesperrt_am = CASE
        WHEN werbung_gesperrt_am IS NULL THEN ${verlierer.werbung_gesperrt_am ?? null}::timestamptz
        WHEN ${verlierer.werbung_gesperrt_am ?? null}::timestamptz IS NULL THEN werbung_gesperrt_am
        ELSE LEAST(werbung_gesperrt_am, ${verlierer.werbung_gesperrt_am ?? null}::timestamptz) END,
      inkasso_ab = COALESCE(inkasso_ab, ${verlierer.inkasso_ab ?? null}::timestamptz),
      inkasso_von = CASE WHEN inkasso_ab IS NULL THEN ${verlierer.inkasso_von ?? null} ELSE inkasso_von END,
      inkasso_grund = CASE WHEN inkasso_ab IS NULL THEN ${verlierer.inkasso_grund ?? null} ELSE inkasso_grund END,
      mandat_seit = CASE ${betreuerQuelle}::text
                         WHEN 'verlierer' THEN ${verlierer.mandat_seit ?? null}::timestamptz
                         WHEN 'unstrittig' THEN LEAST(mandat_seit, ${verlierer.mandat_seit ?? null}::timestamptz)
                         ELSE mandat_seit END,
      updated_at = NOW()
    WHERE id = ${gewinnerId}
  `;

  // Beteiligte Agenten festhalten — als Historie, auch ausgeschiedene. Eine
  // Konfliktmarke entsteht nicht mehr: Zwei LEBENDE, verschiedene Betreuer
  // verlangen oben eine Wahl, alles andere ist eindeutig entschieden. Eine
  // SCHON BESTEHENDE Marke (agentPruefen, z. B. Lead eines anderen Agenten)
  // bleibt stehen — der Merge entscheidet diesen Konflikt nicht (Gegenprüfung
  // 08.10.2026: vorher setzte er sie still auf FALSE).
  // `lauf.json` statt `JSON.stringify(...)::jsonb` (JSONB-Falle: Letzteres
  // legt einen JSON-TEXT ab, und „objekt || text" wird zum Array). Ein
  // Altbestand als Text wird dabei gelesen und als Objekt zurückgeschrieben.
  const agenten = Array.from(new Set(
    [gewinner.assigned_agent_id, verlierer.assigned_agent_id]
      .filter((v) => v != null && Number(v) > 0).map(Number),
  ));
  if (agenten.length > 1) {
    const alt = qualityFlagsLesen(gewinner.quality_flags);
    const bisher = Array.isArray(alt.agents) ? alt.agents.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : [];
    const neu = { ...alt, agents: Array.from(new Set([...bisher, ...agenten])) };
    await lauf`
      UPDATE fiaon_persons SET
        quality_flags = ${lauf.json(neu as any)},
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
  const hinweise = [...lage.hinweise];
  const meta = {
    verliererId, gewinnerId,
    verliererRef: verlierer.person_ref, gewinnerRef: gewinner.person_ref,
    bestellungen: refs,
    felder: uebernommeneFelder,
    gesichert: gesicherteWerte,
    betreuer: { agentId: betreuerAgentId, quelle: betreuerQuelle, fall: lage.fall, text: lage.text, hinweise },
    mandat: { gewinnerVorher: gewinner.mandat_seit ?? null, verliererVorher: verlierer.mandat_seit ?? null },
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
      `Betreuung: ${lage.text}`,
      ...hinweise,
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
    betreuer: { agentId: betreuerAgentId, quelle: betreuerQuelle, text: lage.text, hinweise },
    zaehlprobe, notizRef,
  };
}

/**
 * quality_flags tolerant lesen: Objekt, JSON-Text (Altbestand der JSONB-Falle)
 * oder Array aus „objekt || text" — immer ein Objekt zurück, nie ein Fehler.
 */
function qualityFlagsLesen(q: unknown): Record<string, any> {
  if (q == null) return {};
  if (typeof q === "string") {
    try { return qualityFlagsLesen(JSON.parse(q)); } catch { return {}; }
  }
  if (Array.isArray(q)) {
    const raus: Record<string, any> = {};
    const agents: number[] = [];
    for (const teil of q) {
      const o = qualityFlagsLesen(teil);
      if (Array.isArray(o.agents)) agents.push(...o.agents);
      Object.assign(raus, o);
    }
    if (agents.length) raus.agents = Array.from(new Set(agents.map(Number)));
    return raus;
  }
  return typeof q === "object" ? { ...(q as Record<string, any>) } : {};
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
  await sichereAlias(lauf, personId, kind, norm, wert, quellePersonId);
}

/**
 * Einen Alias anlegen — ohne am eindeutigen Index zu zerschellen.
 *
 * Für `kind='email'` gilt hausweit: eine Adresse, eine Person
 * (`fiaon_person_email_unique`). Hält sie bereits jemand, wird NICHT eingefügt:
 *
 *   · Hält sie der Gewinner selbst — dann ist ohnehin alles gut.
 *   · Hält sie ein Dritter — dann wäre das Wegnehmen schlimmer als das
 *     Auslassen. Die Adresse führt weiter zu dieser Person; der Wert bleibt
 *     zusätzlich in `fiaon_persons` des Verlierers stehen, der als Wegweiser
 *     erhalten bleibt. Verloren geht nichts, es wandert nur nicht mit.
 */
async function sichereAlias(
  lauf: Lauf, personId: number, kind: string, norm: string, wert: string, quellePersonId: number,
): Promise<void> {
  if (kind === "email") {
    await lauf`
      INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, feld_wert, source, quelle_person_id)
      SELECT ${personId}, ${kind}, ${norm}, ${wert}, ${wert}, ${"merge:" + quellePersonId}, ${quellePersonId}
      WHERE NOT EXISTS (
        SELECT 1 FROM fiaon_person_aliases x WHERE x.kind = 'email' AND x.value_norm = ${norm}
      )
    `;
    return;
  }
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
