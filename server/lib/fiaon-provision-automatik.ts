// ═══════════════════════════════════════════════════════════════════════════
// DIE PROVISIONSAUTOMATIK — EIN SCHALTER, NICHTS GEHT VERLOREN (23.09.2026)
//
// Justin: „Stelle es einstweilen ab, dass die Provision den Mitarbeitern
// automatisch gebucht wird."
//
// Der naive Weg wäre, den Aufruf zu löschen. Dann wüsste hinterher niemand
// mehr, welche Provision in der Zwischenzeit entstanden WÄRE — und beim
// Wiedereinschalten fehlten Wochen. Deshalb:
//
//   Schalter AN  → alles wie bisher, die Provision wird gebucht.
//   Schalter AUS → die Provision wird nicht gebucht, sondern VORGEMERKT:
//                  wer, wofür, wie viel, auf welcher Grundlage. Ein Klick im
//                  Chefbüro bucht sie später nach — oder verwirft sie.
//
// Die Vormerkung ist bewusst eine eigene Tabelle und keine Zeile in
// fiaon_commissions mit Sonderstatus: Was dort steht, fließt in Abrechnungen,
// Auszahlungen und Kennzahlen. Eine Vormerkung darf das ausdrücklich NICHT.
//
// WAS DER SCHALTER ERFASST (01.10.2026, Justin: „Raten live stellen, aber
// NICHT die Mitarbeiter-Provision buchen — die buche ich am 05.10."):
// jeder Weg, auf dem eine gebuchte Zahlung Mitarbeitergeld erzeugt —
//   · Abschluss-Provision (erste Zahlung, abschlussNachZahlung)  Art own
//   · Ratenprovision (Rate ≥ 2, onRatePaid)                         Art own
//   · Override des direkten Werbers (bei beiden)                    Art override
//   · Inkasso-Prämie (rateBezahltBuchen → praemieBuchen)            Art inkasso
// Bis 01.10. gingen zwei davon am Schalter vorbei: der Override fiel bei AUS
// ersatzlos weg (weder gebucht noch vorgemerkt), die Inkasso-Prämie wurde
// trotz AUS gebucht. Nicht betroffen, weil keine Buchung sie auslöst: die 10 €
// je Kontoeröffnung (fiaon_konto_karte, erst mit der Bestätigung der
// Partnerbank auszahlbar), die Onboarding-Vergütung (Startgespräch), Gehalt und
// Handbuchungen. Der Kunde merkt vom Schalter nichts — Freischaltung,
// Bestätigungsmail, Ratenkette und Karten-Einladung laufen unverändert.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export const SCHALTER = "provision_automatik";

let anlegen: Promise<void> | null = null;
function tabelle(): Promise<void> {
  if (!anlegen) {
    anlegen = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_provision_vormerkung (
          id BIGSERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          ref TEXT,
          payment_reference TEXT,
          pack_name TEXT,
          base_amount_cents INTEGER NOT NULL DEFAULT 0,
          rate_bp INTEGER NOT NULL DEFAULT 0,
          amount_cents INTEGER NOT NULL DEFAULT 0,
          kind TEXT NOT NULL,
          source_agent_id INTEGER,
          note TEXT,
          anlass TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'offen',
          erledigt_am TIMESTAMPTZ,
          erledigt_von TEXT,
          commission_id INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_provision_vormerkung_offen ON fiaon_provision_vormerkung (status, id DESC)`;
      // Zweimal dieselbe Zahlung darf nur EINE Vormerkung ergeben.
      await sqlPool`
        CREATE UNIQUE INDEX IF NOT EXISTS fiaon_provision_vormerkung_einmal
          ON fiaon_provision_vormerkung (payment_reference, agent_id, kind)
          WHERE payment_reference IS NOT NULL AND status = 'offen'`;
      // E-484 (06.11.2026): Im Auszahlungsplan verrechnet — die Vormerkung steht auf „verworfen“ UND trägt den Plan.
      // Der Merker ist dauerhaft: Dieselbe Zahlung ergibt danach keine neue Vormerkung mehr (zweiter Index, der auch
      // die verrechneten Zeilen einschließt; vormerken() fängt den Konflikt mit ON CONFLICT DO NOTHING ab).
      await sqlPool`ALTER TABLE fiaon_provision_vormerkung ADD COLUMN IF NOT EXISTS verrechnet_plan_id BIGINT`;
      await sqlPool`
        CREATE UNIQUE INDEX IF NOT EXISTS fiaon_provision_vormerkung_einmal_verrechnet
          ON fiaon_provision_vormerkung (payment_reference, agent_id, kind)
          WHERE payment_reference IS NOT NULL AND (status = 'offen' OR verrechnet_plan_id IS NOT NULL)`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      anlegen = null;
      throw e;
    });
  }
  return anlegen;
}

/** Wer liest und schreibt — der Pool oder eine laufende Transaktion (praemieBuchen(rateId, tx)). */
type Lauf = typeof sqlPool;

/** E-484: Die Tabelle samt Merker „im Auszahlungsplan verrechnet“ — für den Auszahlungsplan vor seiner Transaktion. */
export const vormerkungSchema = (): Promise<void> => tabelle();

// ═══════════════════════════════════════════════════════════════════════════
// IM AUSZAHLUNGSPLAN VERRECHNET (E-484, 06.11.2026)
//
// Legt der Inhaber einen Auszahlungsplan „verrechnet“ an, enthält der zugesagte Betrag die offenen Altposten des
// Empfängers. Sie werden geschlossen: Vormerkungen „verworfen“, Provisionen „storniert“ — beides mit dem Merker
// verrechnet_plan_id. Genau diese Status gelten sonst überall als „nicht vorhanden“: Ohne den Merker legte ein
// zweiter Durchlauf derselben Kundenzahlung (Nachbuchungs-Center, Kontoabgleich, „Override nachtragen“) die
// Provision neu an, und der Sammellauf am 15. zahlte sie ZUSÄTZLICH zum Plan aus (Prüfer GELD, 06.11.2026).
//
// Deshalb zählt jede Idempotenz-Prüfung eine verrechnete Zeile als VORHANDEN — eine Definition, hier:
//   provisionVorhandenSql("c") für fiaon_commissions, VORMERKUNG_VERRECHNET für fiaon_provision_vormerkung.
// Gibt es die Spalten noch nicht (frischer Start, besetzte Tabelle), kann auch nichts verrechnet sein — dann gilt
// die alte Prüfung (verrechnetBereit). Der Zahlungsweg bricht also nie an einer fehlenden Spalte.
// ═══════════════════════════════════════════════════════════════════════════
let verrechnetDa = false;

/** Gibt es den Merker an beiden Tabellen? Einmal ja, bleibt ja (Spalten verschwinden nicht). */
export async function verrechnetBereit(lauf: Lauf = sqlPool): Promise<boolean> {
  if (verrechnetDa) return true;
  try {
    const [r] = (await lauf`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
       WHERE table_schema = current_schema() AND column_name = 'verrechnet_plan_id'
         AND table_name IN ('fiaon_commissions', 'fiaon_provision_vormerkung')`) as any[];
    verrechnetDa = Number(r?.n) === 2;
  } catch (e) {
    console.warn("[PROVISION] Merker „verrechnet“ nicht prüfbar — es gilt die Prüfung ohne ihn:", String(e).slice(0, 140));
  }
  return verrechnetDa;
}

/** Eine Provisionszeile (Kürzel `c`) zählt als vorhanden: nicht storniert — oder storniert, weil im Plan verrechnet. */
export function provisionVorhandenSql(c = "c", mitVerrechnet = true): string {
  return mitVerrechnet ? `(${c}.status <> 'storniert' OR ${c}.verrechnet_plan_id IS NOT NULL)` : `${c}.status <> 'storniert'`;
}

/** Eine Vormerkung (Kürzel `v`), die im Auszahlungsplan verrechnet wurde. */
export const vormerkungVerrechnetSql = (v = "v") => `${v}.verrechnet_plan_id IS NOT NULL`;

/** Läuft die Automatik? Vorgabe seit 23.09.2026: AUS. `lauf`: innerhalb einer Transaktion deren Sicht. */
export async function automatikAn(lauf: Lauf = sqlPool): Promise<boolean> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${SCHALTER}`.catch(() => [])) as any[];
  return String(r?.value ?? "aus") === "an";
}

export async function automatikSetzen(an: boolean, von: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${SCHALTER}, ${an ? "an" : "aus"}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  console.log(`[PROVISION] Automatik ${an ? "AN" : "AUS"} (${von})`);
}

export interface Vormerkung {
  agentId: number;
  ref?: string | null;
  zahlungsreferenz?: string | null;
  paket?: string | null;
  basisCents: number;
  satzBp: number;
  betragCents: number;
  art: string;
  quelleAgentId?: number | null;
  notiz?: string | null;
  /** Woraus sie entstanden wäre: „erste Zahlung" oder „Rate 3" — für die Anzeige. */
  anlass: string;
}

/**
 * Statt zu buchen: merken. Gibt zurück, ob eine neue Vormerkung entstand.
 * `lauf` (01.10.2026): Wer innerhalb einer Transaktion bucht (praemieBuchen(rateId, tx)),
 * merkt auch in ihr vor — sonst überlebte die Vormerkung ein Zurückrollen.
 */
export async function vormerken(v: Vormerkung, lauf: Lauf = sqlPool): Promise<boolean> {
  await tabelle();
  const zeilen = (await lauf`
    INSERT INTO fiaon_provision_vormerkung
      (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, kind, source_agent_id, note, anlass)
    VALUES (${v.agentId}, ${v.ref ?? null}, ${v.zahlungsreferenz ?? null}, ${v.paket ?? null},
            ${Math.round(v.basisCents)}, ${Math.round(v.satzBp)}, ${Math.round(v.betragCents)},
            ${v.art}, ${v.quelleAgentId ?? null}, ${v.notiz ?? null}, ${v.anlass})
    ON CONFLICT DO NOTHING
    RETURNING id`) as any[];
  if (zeilen.length) {
    console.log(`[PROVISION] Vorgemerkt statt gebucht: ${(v.betragCents / 100).toFixed(2)} € für Agent ${v.agentId} (${v.anlass}).`);
  }
  return zeilen.length > 0;
}

/** Was offen ist — für das Chefbüro. */
export async function vormerkungen(status = "offen", hoechstens = 200): Promise<any[]> {
  await tabelle();
  return (await sqlPool`
    SELECT v.*, a.name AS agent_name, q.name AS quelle_name,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
      FROM fiaon_provision_vormerkung v
      LEFT JOIN fiaon_agents a ON a.id = v.agent_id
      LEFT JOIN fiaon_agents q ON q.id = v.source_agent_id
      LEFT JOIN fiaon_applications app ON app.ref = v.ref AND app.merged_into IS NULL
      LEFT JOIN fiaon_persons p ON p.id = app.person_id
     WHERE v.status = ${status}
     ORDER BY v.id DESC LIMIT ${Math.min(Math.max(hoechstens, 1), 500)}`) as any[];
}

/** Die Zahlen für den Kopf der Seite. */
export async function vormerkungZahlen(): Promise<{ offen: number; offenEuro: number; gebucht: number; verworfen: number }> {
  await tabelle();
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE status = 'offen')::int AS offen,
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'offen'), 0)::int AS offen_cents,
           COUNT(*) FILTER (WHERE status = 'gebucht')::int AS gebucht,
           COUNT(*) FILTER (WHERE status = 'verworfen')::int AS verworfen
      FROM fiaon_provision_vormerkung`) as any[];
  return {
    offen: Number(z?.offen || 0), offenEuro: Number(z?.offen_cents || 0) / 100,
    gebucht: Number(z?.gebucht || 0), verworfen: Number(z?.verworfen || 0),
  };
}

/**
 * Offenes je Mitarbeiter (14.10.2026, Justin: „Buche Hans-Jürgen seine Provision nach, aber nur
 * Hans-Jürgen und Daniel“) — damit sich gezielt EINE Person nachbuchen lässt statt alle oder Zeile für Zeile.
 */
export async function vormerkungJeMitarbeiter(): Promise<Array<{ agentId: number; name: string; anzahl: number; euro: number; arten: Record<string, number> }>> {
  await tabelle();
  const zeilen = (await sqlPool`
    SELECT v.agent_id, COALESCE(a.name, '#' || v.agent_id) AS name, v.kind, COUNT(*)::int AS n, COALESCE(SUM(v.amount_cents), 0)::int AS cents
      FROM fiaon_provision_vormerkung v
      LEFT JOIN fiaon_agents a ON a.id = v.agent_id
     WHERE v.status = 'offen'
     GROUP BY 1, 2, 3`) as any[];
  const je = new Map<number, { agentId: number; name: string; anzahl: number; euro: number; arten: Record<string, number> }>();
  for (const z of zeilen) {
    const id = Number(z.agent_id);
    const e = je.get(id) ?? { agentId: id, name: String(z.name), anzahl: 0, euro: 0, arten: {} };
    e.anzahl += Number(z.n);
    e.euro = Math.round((e.euro + Number(z.cents) / 100) * 100) / 100;
    e.arten[String(z.kind)] = Math.round(((e.arten[String(z.kind)] ?? 0) + Number(z.cents) / 100) * 100) / 100;
    je.set(id, e);
  }
  return Array.from(je.values()).sort((a, b) => b.euro - a.euro);
}

/**
 * Eine Vormerkung nachbuchen — sie wird zu einer echten Provision. Derselbe
 * Weg wie die Automatik, nur von Hand ausgelöst.
 *
 * E-484 (06.11.2026): in EINER Transaktion mit Zeilensperre auf die Vormerkung. Vorher las sie ohne Sperre, legte
 * die Provision an und setzte danach ohne Statusbedingung „gebucht“ — lief das gleichzeitig mit der Anlage eines
 * Auszahlungsplans, überschrieb es dessen „verworfen“, und eine schon verrechnete Provision wurde trotzdem gebucht.
 * Jetzt: erst sperren, dann prüfen, dann buchen, und „gebucht“ nur, solange sie noch offen ist. Ist dieselbe Zahlung
 * im Auszahlungsplan schon verrechnet, wird nichts gebucht — die Vormerkung schließt sich mit Vermerk.
 */
export async function nachbuchen(id: number, von: string): Promise<{ ok: boolean; grund?: string; commissionId?: number }> {
  await tabelle();
  const mitV = await verrechnetBereit();
  try {
    return await sqlPool.begin(async (tx: any) => {
      const [v] = (await tx`SELECT * FROM fiaon_provision_vormerkung WHERE id = ${id} AND status = 'offen' FOR UPDATE`) as any[];
      if (!v) return { ok: false, grund: "Diese Vormerkung gibt es nicht mehr." };
      // Schon im Auszahlungsplan verrechnet (als Provision oder als Vormerkung derselben Zahlung)? Dann nie buchen.
      if (mitV) {
        const [verr] = (await tx`
          SELECT verrechnet_plan_id AS plan FROM fiaon_commissions
           WHERE agent_id = ${v.agent_id} AND kind = ${v.kind} AND amount_cents > 0 AND verrechnet_plan_id IS NOT NULL
             AND (payment_reference = ${v.payment_reference} OR (${v.payment_reference}::text IS NULL AND ref = ${v.ref}))
          UNION ALL
          SELECT verrechnet_plan_id FROM fiaon_provision_vormerkung
           WHERE id <> ${id} AND agent_id = ${v.agent_id} AND kind = ${v.kind} AND verrechnet_plan_id IS NOT NULL
             AND (payment_reference = ${v.payment_reference} OR (${v.payment_reference}::text IS NULL AND ref = ${v.ref}))
          LIMIT 1`) as any[];
        if (verr) {
          // Verworfen OHNE eigenen Merker: Verrechnet ist schon die ursprüngliche Zeile derselben Zahlung — trüge diese
          // Doppelung den Merker auch, entstünden bei einer Erstattung zwei Gegenbuchungen für eine Zahlung.
          const r = (await tx`
            UPDATE fiaon_provision_vormerkung
               SET status = 'verworfen', erledigt_am = NOW(), erledigt_von = ${von},
                   note = TRIM(COALESCE(note, '') || ${` · schon im Auszahlungsplan verrechnet (Plan #${Number(verr.plan)}) — nicht gebucht`})
             WHERE id = ${id} AND status = 'offen' RETURNING id`) as any[];
          if (!r.length) return { ok: false, grund: "Die Vormerkung hat sich gerade verändert. Bitte neu laden." };
          console.log(`[PROVISION] Vormerkung ${id}: dieselbe Zahlung ist im Auszahlungsplan verrechnet — nicht gebucht (${von}).`);
          return { ok: true, grund: "Dieselbe Zahlung ist schon im Auszahlungsplan verrechnet — nichts gebucht, die Vormerkung ist erledigt." };
        }
      }
      // Doppelt buchen ist ausgeschlossen: Dieselbe Zahlung, derselbe Mensch, dieselbe Art.
      const [da] = (await tx`
        SELECT id FROM fiaon_commissions
         WHERE payment_reference = ${v.payment_reference} AND agent_id = ${v.agent_id} AND kind = ${v.kind}
           AND status <> 'storniert' LIMIT 1`) as any[];
      if (da) {
        const r = (await tx`
          UPDATE fiaon_provision_vormerkung SET status = 'gebucht', erledigt_am = NOW(), erledigt_von = ${von}, commission_id = ${Number(da.id)}
           WHERE id = ${id} AND status = 'offen' RETURNING id`) as any[];
        if (!r.length) return { ok: false, grund: "Die Vormerkung hat sich gerade verändert. Bitte neu laden." };
        return { ok: true, commissionId: Number(da.id), grund: "Es gab sie schon — die Vormerkung ist erledigt." };
      }
      // 01.10.2026: Status 'bestaetigt' wie bei der Automatik. Vorher stand hier 'offen' — diesen
      // Status kennt fiaon_commissions nicht (bestaetigt | in_auszahlung | ausgezahlt | storniert |
      // vorgemerkt), und der Auszahlungslauf liest nur 'bestaetigt': Nachgebuchtes wäre im Wallet
      // aufgetaucht und am 15. nie ausgezahlt worden. Bis heute wurde keine Vormerkung nachgebucht.
      const [neu] = (await tx`
        INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, source_agent_id, note)
        VALUES (${v.agent_id}, ${v.ref}, ${v.payment_reference}, ${v.pack_name}, ${v.base_amount_cents}, ${v.rate_bp}, ${v.amount_cents},
                'bestaetigt', ${v.kind}, ${v.source_agent_id}, ${`${v.note ?? ""} (von Hand gebucht am ${new Date().toLocaleDateString("de-DE")} durch ${von}, ${v.anlass})`.trim()})
        RETURNING id`) as any[];
      const r = (await tx`
        UPDATE fiaon_provision_vormerkung SET status = 'gebucht', erledigt_am = NOW(), erledigt_von = ${von}, commission_id = ${Number(neu.id)}
         WHERE id = ${id} AND status = 'offen' RETURNING id`) as any[];
      // Trifft das nichts, hat jemand die Vormerkung inzwischen geschlossen — dann rollt die Buchung mit zurück.
      if (!r.length) throw new NachbuchenAbbruch("Die Vormerkung wurde gerade anderweitig erledigt — nichts gebucht. Bitte neu laden.");
      console.log(`[PROVISION] Vormerkung ${id} nachgebucht von ${von} (${(Number(v.amount_cents) / 100).toFixed(2)} €).`);
      return { ok: true, commissionId: Number(neu.id) };
    });
  } catch (e) {
    if (e instanceof NachbuchenAbbruch) return { ok: false, grund: e.message };
    throw e;
  }
}

/** Abbruch in der Nachbuch-Transaktion — rollt zurück und wird außen zur Antwort. */
class NachbuchenAbbruch extends Error {
  constructor(grund: string) {
    super(grund);
    Object.setPrototypeOf(this, NachbuchenAbbruch.prototype);
  }
}

/** Eine Vormerkung verwerfen — sie bleibt als Spur stehen. */
export async function verwerfen(id: number, von: string, grund: string): Promise<boolean> {
  await tabelle();
  const zeilen = (await sqlPool`
    UPDATE fiaon_provision_vormerkung
       SET status = 'verworfen', erledigt_am = NOW(), erledigt_von = ${von},
           note = TRIM(COALESCE(note, '') || ' · verworfen: ' || ${String(grund || "ohne Grund").slice(0, 200)})
     WHERE id = ${id} AND status = 'offen' RETURNING id`) as any[];
  return zeilen.length > 0;
}
