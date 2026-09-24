// ═══════════════════════════════════════════════════════════════════════════
// WAS KOSTET EIN ZAHLENDER KUNDE AUS META? (24.09.2026, E-239)
//
// Justin: Er will eine Kampagne auf „Kaufen" spielen und cent-genau sehen, was
// ein ECHTER zahlender Kunde kostet. Bis heute stand kein einziger Werbe-Euro
// in der Datenbank — jede Aussage über Kosten je Kunde war geschätzt.
//
// ── ZWEI HÄLFTEN ──────────────────────────────────────────────────────────
//   1. kostenAbruf(): holt die Ausgaben je Anzeige und Tag bei Meta
//      (Insights, nur lesend, Recht ads_read) und legt sie in
//      fiaon_meta_kosten ab — je Tag dreimal: Anzeige, Anzeigengruppe,
//      Kampagne. Meta korrigiert die letzten Tage nach; deshalb wird das
//      Fenster jedes Mal ganz neu geschrieben (Löschen + Upsert in EINER
//      Buchung), nie nur ergänzt.
//   2. kostenBericht(): legt die Ausgaben neben unser echtes Geld. Je
//      Kampagne: Leads bei Meta, Leads bei uns, Anträge fertig, zahlende
//      Kunden, Umsatz, bezahlte Auskünfte — und daraus die Kosten je Lead,
//      je Antrag und je zahlendem Kunden in Cent.
//
// ── DIE REGELN DER ZÄHLUNG ────────────────────────────────────────────────
// · Zahlender Kunde = Rate 1 mit status 'bezahlt' und bezahlt_am gesetzt.
//   NIE claimed_paid — das ist nur „Kunde sagt, er hat bezahlt".
// · Gezählt wird nach Eingang (Kohorte): Leads, die im Zeitraum kamen, und
//   alles, was diese Menschen seitdem getan haben — auch nach dem Zeitraum.
//   Kosten im Zeitraum ÷ Zahlende aus diesem Zeitraum.
// · Ein Mensch zählt einmal: mehrere Leads derselben Person im Zeitraum sind
//   EIN Mensch, sein erster Lead bestimmt die Kampagne.
// · Antrag und Zahlung müssen NACH dem Lead liegen (Spielraum ein Tag, weil
//   Make Leads verspätet angelegt hat — gemessen: 167 von 718 Anträgen lagen
//   bis zu sechs Minuten VOR ihrem Lead — und weil bezahlt_am den Buchungstag
//   um 12:00 trägt, also auch Stunden vor einem Lead desselben Tages liegen
//   kann). Wer schon vorher Kunde war, ist kein Kunde dieser Kampagne.
// · „Antrag fertig" = Hausregel Stufe B oder höher (dieselbe CASE-Regel wie
//   im WhatsApp-Raum, fiaon-whatsapp-postfach.ts).
// · Umsatz = bezahlte Raten + bezahlte Bonitätsauskünfte — dieselbe Regel wie
//   die Geld-Wahrheit (/chef/zahlen). Testkonten zählen nie.
// · Leads aus der ALTEN Make-Kampagne („DE Kampagne 2" u. a.) tragen nur den
//   Kampagnennamen und liegen in einem fremden Werbekonto — ihre Kosten sind
//   nicht abrufbar. Sie stehen als eigene Zeile da, ohne Kosten, nie mit einer
//   erfundenen Zahl.
// · Website-Besucher mit Meta-Klick (fbc) zählen nur dann zu einer Kampagne,
//   wenn utm_campaign/utm_id eine Kampagnen-ID oder ihren Namen trägt —
//   sonst „Website (Meta-Klick), Kampagne unbekannt". Auch ein unbezahlter
//   Klick aus einem Facebook-Beitrag trägt diese Kennung.
// · Keine Division durch null: kein zahlender Kunde → null, nie ∞.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { graph, graphAlle, metaKonfig, MetaFehler } from "./fiaon-meta";
import { berlinToday, berlinPlusTage } from "./fiaon-time";
import { produktkategorieSql } from "./fiaon-produktkategorie";

type Lauf = typeof sqlPool;

/** Die Einstellung mit dem Werbekonto (act_…, mehrere mit Komma). */
export const WERBEKONTO_SCHLUESSEL = "meta_werbekonto";
/** Der letzte Abruf als JSON — damit die Seite den Stand auch nach einem Neustart kennt. */
export const KOSTEN_STAND_SCHLUESSEL = "meta_kosten_stand";
/** Spielraum zwischen Lead und Antrag/Zahlung (Make legte Leads verspätet an). */
const SPIELRAUM = "INTERVAL '1 day'";
/** Die Felder je Anzeige und Tag. */
export const INSIGHT_FELDER = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions";

// ═══════════════════════════════════════════════════════════════════════════
// DIE TABELLE
// ═══════════════════════════════════════════════════════════════════════════
let tabelleDa = false;
export async function kostenTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (tabelleDa) return;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_meta_kosten (
      tag DATE NOT NULL,
      ebene TEXT NOT NULL CHECK (ebene IN ('kampagne', 'gruppe', 'anzeige')),
      objekt_id TEXT NOT NULL,
      name TEXT,
      kampagne_id TEXT,
      gruppe_id TEXT,
      werbekonto TEXT,
      ausgaben_cents INTEGER NOT NULL DEFAULT 0,
      impressionen INTEGER NOT NULL DEFAULT 0,
      klicks INTEGER NOT NULL DEFAULT 0,
      leads_meta INTEGER NOT NULL DEFAULT 0,
      aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tag, ebene, objekt_id)
    )`;
  await lauf`CREATE INDEX IF NOT EXISTS fiaon_meta_kosten_kampagne ON fiaon_meta_kosten (ebene, kampagne_id, tag)`;
  await lauf`CREATE INDEX IF NOT EXISTS fiaon_meta_kosten_konto ON fiaon_meta_kosten (werbekonto, tag)`;
  tabelleDa = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS WERBEKONTO — nie im Quelltext, sondern aus Umgebung, Einstellung oder
// den Kampagnen unserer eigenen Leads
// ═══════════════════════════════════════════════════════════════════════════
/** „28238021102547230" oder „act_28238021102547230" → „act_28238021102547230"; Unsinn → null. */
export function kontoNormal(roh: unknown): string | null {
  const ziffern = String(roh ?? "").trim().replace(/^act_/i, "");
  return /^\d{6,25}$/.test(ziffern) ? `act_${ziffern}` : null;
}

const kontenListe = (roh: unknown): string[] =>
  Array.from(new Set(String(roh ?? "").split(",").map(kontoNormal).filter((k): k is string => !!k)));

async function einstellung(key: string, lauf: Lauf = sqlPool): Promise<string | null> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`.catch(() => [])) as any[];
  const v = String(r?.value ?? "").trim();
  return v || null;
}
async function einstellungSetzen(key: string, wert: string, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/** Zu welchem Werbekonto gehört eine Kampagne? Nur lesend bei Meta. */
export async function kontoAusKampagne(kampagneId: string): Promise<string | null> {
  const j = await graph(String(kampagneId), { params: { fields: "account_id" } });
  return kontoNormal(j?.account_id);
}

/** Kampagnen, deren Konto in diesem Prozess schon nachgeschlagen wurde — Meta nicht bei jedem Lauf erneut fragen. */
const nachgeschlagen = new Set<string>();

/**
 * Die Werbekonten, deren Kosten abgerufen werden.
 *   1. Umgebung META_WERBEKONTO (Render) — schlägt alles.
 *   2. Einstellung meta_werbekonto.
 *   3. Ergänzt um die Konten der Kampagnen, aus denen unsere Leads kamen
 *      (fiaon_leads.meta_kampagne_id → GET /<kampagne>?fields=account_id).
 *      Was neu gefunden wird, wird in die Einstellung geschrieben.
 * /me/adaccounts bleibt für den Systemnutzer leer — deshalb dieser Weg.
 */
export async function werbekonten(lauf: Lauf = sqlPool): Promise<{ konten: string[]; herkunft: "umgebung" | "einstellung" | "leads" | null; hinweis: string | null }> {
  const ausUmgebung = kontenListe(process.env.META_WERBEKONTO);
  if (ausUmgebung.length) return { konten: ausUmgebung, herkunft: "umgebung", hinweis: null };

  const gespeichert = kontenListe(await einstellung(WERBEKONTO_SCHLUESSEL, lauf));
  const konten = new Set(gespeichert);
  let hinweis: string | null = null;

  // Kampagnen unserer Leads (90 Tage), die noch in keinem abgerufenen Konto stehen.
  await kostenTabelle(lauf);
  const offen = (await lauf`
    SELECT l.meta_kampagne_id AS id, MAX(l.erstellt_am) AS zuletzt
      FROM fiaon_leads l
     WHERE l.meta_kampagne_id IS NOT NULL AND l.erstellt_am > NOW() - INTERVAL '90 days'
       AND NOT EXISTS (SELECT 1 FROM fiaon_meta_kosten k WHERE k.ebene = 'kampagne' AND k.objekt_id = l.meta_kampagne_id)
     GROUP BY l.meta_kampagne_id ORDER BY 2 DESC LIMIT 10`) as any[];
  for (const z of offen) {
    const id = String(z.id);
    if (nachgeschlagen.has(id)) continue;
    nachgeschlagen.add(id);
    try {
      const konto = await kontoAusKampagne(id);
      if (konto) konten.add(konto);
    } catch (e) {
      // Nicht abbrechen: Die übrigen Konten liefern trotzdem ihre Kosten.
      hinweis = `Kampagne ${id}: ${e instanceof MetaFehler ? e.klartext : String(e).slice(0, 200)}`;
      nachgeschlagen.delete(id);
    }
  }
  const liste = Array.from(konten);
  if (liste.join(",") !== gespeichert.join(",") && liste.length) await einstellungSetzen(WERBEKONTO_SCHLUESSEL, liste.join(","), lauf);
  return {
    konten: liste,
    herkunft: liste.length ? (gespeichert.length ? "einstellung" : "leads") : null,
    hinweis: liste.length ? hinweis : (hinweis ?? "Kein Werbekonto bekannt — es kam noch kein Lead über eine Kampagne mit Kennung. In Render META_WERBEKONTO=act_… eintragen oder die Einstellung meta_werbekonto setzen."),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ABRUF — Meta-Zeilen je Anzeige und Tag → drei Ebenen
// ═══════════════════════════════════════════════════════════════════════════
export interface KostenZeile {
  tag: string;
  ebene: "kampagne" | "gruppe" | "anzeige";
  objektId: string;
  name: string | null;
  kampagneId: string;
  gruppeId: string | null;
  werbekonto: string;
  ausgabenCents: number;
  impressionen: number;
  klicks: number;
  leadsMeta: number;
}

const ganz = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/**
 * Leads laut Meta: die Aktion „lead" (alle Leads der Anzeige); fehlt sie,
 * „onsite_conversion.lead_grouped" (Leads aus dem Sofortformular).
 */
export function leadsAusAktionen(aktionen: unknown): number {
  const liste = Array.isArray(aktionen) ? aktionen : [];
  const wert = (typ: string) => {
    const a = liste.find((x: any) => x?.action_type === typ);
    return a ? ganz(a.value) : null;
  };
  return wert("lead") ?? wert("onsite_conversion.lead_grouped") ?? 0;
}

/**
 * Rohzeilen (level=ad, time_increment=1) → Zeilen für alle drei Ebenen.
 * Ausgaben, Impressionen, Klicks und Leads sind je Tag additiv — die Summe
 * der Anzeigen IST die Anzeigengruppe und die Kampagne. Rein, ohne Datenbank.
 */
export function kostenZeilenBilden(roh: any[], werbekonto: string): KostenZeile[] {
  const summen = new Map<string, KostenZeile>();
  const dazu = (z: KostenZeile) => {
    const schluessel = `${z.tag}|${z.ebene}|${z.objektId}`;
    const da = summen.get(schluessel);
    if (!da) { summen.set(schluessel, { ...z }); return; }
    da.ausgabenCents += z.ausgabenCents;
    da.impressionen += z.impressionen;
    da.klicks += z.klicks;
    da.leadsMeta += z.leadsMeta;
    if (!da.name && z.name) da.name = z.name;
  };
  for (const r of roh) {
    const tag = String(r?.date_start ?? "");
    const kampagneId = String(r?.campaign_id ?? "");
    const anzeigeId = String(r?.ad_id ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !kampagneId || !anzeigeId) continue;
    const gruppeId = r?.adset_id ? String(r.adset_id) : null;
    // spend kommt als Text in der Kontowährung („13.02") — Cent sofort ganzzahlig.
    const werte = {
      ausgabenCents: Math.round(Number(r?.spend ?? 0) * 100) || 0,
      impressionen: ganz(r?.impressions),
      klicks: ganz(r?.clicks),
      leadsMeta: leadsAusAktionen(r?.actions),
    };
    const basis = { tag, kampagneId, gruppeId, werbekonto };
    dazu({ ...basis, ...werte, ebene: "anzeige", objektId: anzeigeId, name: r?.ad_name ? String(r.ad_name) : null });
    if (gruppeId) dazu({ ...basis, ...werte, ebene: "gruppe", objektId: gruppeId, name: r?.adset_name ? String(r.adset_name) : null });
    dazu({ ...basis, ...werte, gruppeId: null, ebene: "kampagne", objektId: kampagneId, name: r?.campaign_name ? String(r.campaign_name) : null });
  }
  return Array.from(summen.values());
}

/** Die Insights eines Kontos für ein Datumsfenster (JJJJ-MM-TT, Kontozeit) — alle Seiten. Nur lesend. */
export async function insightsHolen(konto: string, seit: string, bis: string): Promise<any[]> {
  return graphAlle(`${konto}/insights`, {
    params: {
      level: "ad", time_increment: 1,
      time_range: JSON.stringify({ since: seit, until: bis }),
      fields: INSIGHT_FELDER, limit: 500,
    },
    hoechstens: 50_000,
    zeitMs: 30_000,
  });
}

export interface AbrufErgebnis {
  ok: boolean;
  am: string;
  seit: string;
  bis: string;
  konten: string[];
  zeilen: number;
  ausgabenCents: number;
  fehler: string[];
  hinweis: string | null;
}

/**
 * Holt die Kosten der letzten `tage` Tage (heute eingeschlossen) und schreibt
 * sie in fiaon_meta_kosten. Das Fenster wird je Konto ERST gelöscht und dann
 * neu geschrieben — in einer Buchung: Eine Anzeige, deren Ausgaben Meta auf
 * null korrigiert, verschwindet aus den Insights und darf dann auch hier
 * nicht stehen bleiben. Scheitert der Abruf eines Kontos, bleibt sein alter
 * Stand unangetastet.
 */
export async function kostenAbruf(tage = 7, lauf: Lauf = sqlPool): Promise<AbrufErgebnis> {
  const n = Math.max(1, Math.min(90, Math.floor(Number(tage) || 7)));
  const seit = berlinPlusTage(-(n - 1));
  const bis = berlinToday();
  const erg: AbrufErgebnis = { ok: false, am: new Date().toISOString(), seit, bis, konten: [], zeilen: 0, ausgabenCents: 0, fehler: [], hinweis: null };
  const k = metaKonfig();
  if (!k.bereit) {
    // Ohne Zugang (Prüfstand, lokale Läufe) still bleiben — kein Fehler in der Lauf-Historie.
    erg.hinweis = `Meta-Zugang fehlt (${k.fehlt.join(", ")}).`;
    return erg;
  }
  await kostenTabelle(lauf);
  const w = await werbekonten(lauf);
  erg.konten = w.konten;
  erg.hinweis = w.hinweis;
  for (const konto of w.konten) {
    try {
      // Gegenlesen 24.09.2026 (E-239): Der Tageslauf holt nur 7 Tage, der Bericht
      // zeigt aber 30 und 90. Beim ERSTEN Abruf eines Kontos (noch keine Zeile
      // von ihm) deshalb 90 Tage — sonst stünden in der 30-Tage-Ansicht Leads
      // aus 30 Tagen neben Kosten aus 7, und „je Lead" wäre zu billig.
      const [schonDa] = (await lauf`SELECT 1 AS da FROM fiaon_meta_kosten WHERE werbekonto = ${konto} LIMIT 1`) as any[];
      const seitKonto = schonDa ? seit : berlinPlusTage(-89);
      if (seitKonto < erg.seit) erg.seit = seitKonto;
      const roh = await insightsHolen(konto, seitKonto, bis);
      const zeilen = kostenZeilenBilden(roh, konto);
      await lauf.begin(async (tx: any) => {
        await tx`DELETE FROM fiaon_meta_kosten WHERE werbekonto = ${konto} AND tag BETWEEN ${seitKonto}::date AND ${bis}::date`;
        for (const z of zeilen) {
          await tx`
            INSERT INTO fiaon_meta_kosten (tag, ebene, objekt_id, name, kampagne_id, gruppe_id, werbekonto,
                                           ausgaben_cents, impressionen, klicks, leads_meta, aktualisiert_am)
            VALUES (${z.tag}::date, ${z.ebene}, ${z.objektId}, ${z.name}, ${z.kampagneId}, ${z.gruppeId}, ${konto},
                    ${z.ausgabenCents}, ${z.impressionen}, ${z.klicks}, ${z.leadsMeta}, NOW())
            ON CONFLICT (tag, ebene, objekt_id) DO UPDATE SET
              name = COALESCE(EXCLUDED.name, fiaon_meta_kosten.name),
              kampagne_id = EXCLUDED.kampagne_id, gruppe_id = EXCLUDED.gruppe_id, werbekonto = EXCLUDED.werbekonto,
              ausgaben_cents = EXCLUDED.ausgaben_cents, impressionen = EXCLUDED.impressionen,
              klicks = EXCLUDED.klicks, leads_meta = EXCLUDED.leads_meta, aktualisiert_am = NOW()`;
        }
      });
      erg.zeilen += zeilen.length;
      erg.ausgabenCents += zeilen.filter((z) => z.ebene === "kampagne").reduce((s, z) => s + z.ausgabenCents, 0);
    } catch (e) {
      erg.fehler.push(`${konto}: ${e instanceof MetaFehler ? e.klartext : String(e instanceof Error ? e.message : e).slice(0, 240)}`);
    }
  }
  erg.ok = erg.konten.length > 0 && erg.fehler.length === 0;
  await einstellungSetzen(KOSTEN_STAND_SCHLUESSEL, JSON.stringify(erg), lauf).catch(() => {});
  if (erg.fehler.length) console.warn(`[META-KOSTEN] Abruf ${seit}–${bis}: ${erg.fehler.join(" · ")}`);
  // Der Lauf soll in der Historie als Fehler stehen, wenn KEIN Konto lieferte — sonst merkt es niemand.
  if (erg.konten.length && erg.fehler.length === erg.konten.length) throw new Error(`Meta-Kosten nicht abrufbar: ${erg.fehler.join(" · ")}`);
  return erg;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER BERICHT — Ausgaben neben echtem Geld
// ═══════════════════════════════════════════════════════════════════════════

/** Die unfertigen Antragsstatus — dieselbe Liste wie die Stufen-Regel im WhatsApp-Raum. */
const UNFERTIG = `('started','personal_data','finances','config','verifying','approved','contract','processing')`;

/**
 * Die eine Abfrage des Berichts. $1 = von, $2 = bis (JJJJ-MM-TT, Berliner Tage, beide eingeschlossen).
 *
 * `kostenQuelle` ist nur für den Prüfstand austauschbar (eine leere Tabelle,
 * wenn fiaon_meta_kosten dort noch nicht existiert). `mitMessung` /
 * `mitZuordnung` schalten die Website-Hälfte ab, solange ihre Tabellen fehlen
 * (sie entstehen erst beim ersten Pixel-Aufruf bzw. der ersten Zuordnung).
 */
export function berichtSql(opts: { kostenQuelle?: string; mitMessung: boolean; mitZuordnung: boolean }): string {
  const kosten = opts.kostenQuelle ?? "SELECT * FROM fiaon_meta_kosten";
  const zuordnung = opts.mitZuordnung
    ? `LEFT JOIN LATERAL (
         SELECT z.utm_campaign FROM fiaon_werbe_zuordnung z
          WHERE z.art = 'auftrag' AND z.bezug = m.ref AND z.utm_campaign IS NOT NULL
          ORDER BY z.id DESC LIMIT 1) z ON TRUE`
    : `LEFT JOIN LATERAL (SELECT NULL::text AS utm_campaign) z ON TRUE`;
  const website = opts.mitMessung
    ? `
    web_zeilen AS (
      SELECT m.ref, COALESCE(m.person_id, a.person_id) AS person_id, m.erstellt_am,
             COALESCE('p' || COALESCE(m.person_id, a.person_id), 'r' || m.ref) AS einheit,
             NULLIF(TRIM(COALESCE(z.utm_campaign,
               -- E-239: die Kampagnen-Kennung, die der Browser mit Einwilligung am Messsatz ablegt
               CASE WHEN jsonb_typeof(m.kampagne) = 'object' THEN COALESCE(m.kampagne ->> 'utm_id', m.kampagne ->> 'utm_campaign') END,
               CASE WHEN jsonb_typeof(a.utm) = 'object' THEN COALESCE(a.utm ->> 'utm_id', a.utm ->> 'utm_campaign') END)), '') AS utm_wert
        FROM fiaon_meta_messung m
        CROSS JOIN grenzen g
        LEFT JOIN fiaon_applications a ON a.ref = m.ref
        LEFT JOIN fiaon_persons p ON p.id = COALESCE(m.person_id, a.person_id)
        ${zuordnung}
       WHERE m.fbc IS NOT NULL AND m.erstellt_am >= g.ab AND m.erstellt_am < g.bis
         AND m.ref NOT LIKE 'FIAON-TEST%' AND p.ist_test_am IS NULL
    ),
    web_einheiten AS (
      SELECT w.einheit,
             (ARRAY_AGG(COALESCE('meta:' || ku.id, 'website') ORDER BY w.erstellt_am))[1] AS schluessel,
             MIN(w.erstellt_am) AS ab, MAX(w.person_id) AS person_id, ARRAY_AGG(w.ref) AS refs
        FROM web_zeilen w
        LEFT JOIN LATERAL (
          SELECT kk.id FROM kampagnen kk WHERE kk.id = w.utm_wert OR LOWER(kk.name) = LOWER(w.utm_wert) LIMIT 1
        ) ku ON w.utm_wert IS NOT NULL
       -- Wer auch als Lead kam, gehört zur Kampagne seines Leads.
       WHERE NOT EXISTS (SELECT 1 FROM lead_einheiten e WHERE e.einheit = w.einheit)
       GROUP BY w.einheit
    ),`
    : `
    web_einheiten AS (
      SELECT NULL::text AS einheit, NULL::text AS schluessel, NULL::timestamptz AS ab, NULL::int AS person_id, NULL::text[] AS refs WHERE FALSE
    ),`;
  const antragFilter = `a.merged_into IS NULL AND a.ref NOT LIKE 'FIAON-TEST%' AND ${produktkategorieSql("a")} = 'konto'`;
  return `
    WITH
    grenzen AS (
      SELECT ($1::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS ab,
             (($2::date) + 1)::timestamp AT TIME ZONE 'Europe/Berlin' AS bis
    ),
    k AS (${kosten}),
    kampagnen AS (
      SELECT DISTINCT ON (objekt_id) objekt_id AS id, name
        FROM k WHERE ebene = 'kampagne' ORDER BY objekt_id, tag DESC
    ),
    kosten AS (
      SELECT objekt_id AS id, SUM(ausgaben_cents)::bigint AS ausgaben, SUM(impressionen)::bigint AS impressionen,
             SUM(klicks)::bigint AS klicks, SUM(leads_meta)::bigint AS leads_meta
        FROM k WHERE ebene = 'kampagne' AND tag BETWEEN $1::date AND $2::date
       GROUP BY objekt_id
    ),
    lead_zeilen AS (
      SELECT l.id, l.person_id, l.converted_order_id, l.erstellt_am, NULLIF(TRIM(l.kampagne), '') AS kampagne_text,
             CASE WHEN l.meta_kampagne_id IS NOT NULL THEN 'meta:' || l.meta_kampagne_id
                  WHEN kn.id IS NOT NULL THEN 'meta:' || kn.id
                  ELSE 'extern:' || COALESCE(NULLIF(TRIM(l.kampagne), ''), '') END AS schluessel,
             COALESCE('p' || l.person_id, 'l' || l.id) AS einheit
        FROM fiaon_leads l
        CROSS JOIN grenzen g
        LEFT JOIN fiaon_persons p ON p.id = l.person_id
        -- Make-Leads tragen nur den Namen: steht die Kampagne im Konto, gehören sie dazu.
        LEFT JOIN LATERAL (
          SELECT kk.id FROM kampagnen kk WHERE LOWER(kk.name) = LOWER(TRIM(l.kampagne)) LIMIT 1
        ) kn ON l.meta_kampagne_id IS NULL
       WHERE l.erstellt_am >= g.ab AND l.erstellt_am < g.bis
         AND (l.quelle = 'facebook_lead_ads' OR l.meta_kampagne_id IS NOT NULL OR l.eingangsweg LIKE 'meta%')
         AND COALESCE(l.eingangsweg, '') <> 'test'
         AND p.ist_test_am IS NULL
    ),
    lead_einheiten AS (
      SELECT einheit,
             (ARRAY_AGG(schluessel ORDER BY erstellt_am))[1] AS schluessel,
             MIN(erstellt_am) AS ab, MAX(person_id) AS person_id,
             ARRAY_REMOVE(ARRAY_AGG(converted_order_id::text), NULL) AS refs
        FROM lead_zeilen GROUP BY einheit
    ),
    ${website}
    einheiten AS (
      SELECT einheit, schluessel, ab, person_id, refs, 'lead' AS herkunft FROM lead_einheiten
      UNION ALL
      SELECT einheit, schluessel, ab, person_id, refs, 'web' AS herkunft FROM web_einheiten
    ),
    -- Auch der direkt verknüpfte Antrag muss NACH dem Lead entstanden sein: Ein
    -- Bestandskunde, der ein Formular ausfüllt, bekommt seinen alten Antrag
    -- verknüpft (gemessen 22 von 718 mehr als einen Tag älter) — der ist kein
    -- Ergebnis dieser Kampagne.
    antraege AS (
      SELECT e.einheit, a.ref, a.current_step, a.status, a.payment_status, a.claimed_paid_at
        FROM einheiten e JOIN fiaon_applications a ON a.ref = ANY(e.refs)
       WHERE (a.created_at AT TIME ZONE 'UTC') >= e.ab - ${SPIELRAUM}
         AND ${antragFilter}
      UNION
      SELECT e.einheit, a.ref, a.current_step, a.status, a.payment_status, a.claimed_paid_at
        FROM einheiten e JOIN fiaon_applications a ON a.person_id = e.person_id
       WHERE e.person_id IS NOT NULL AND (a.created_at AT TIME ZONE 'UTC') >= e.ab - ${SPIELRAUM}
         AND ${antragFilter}
    ),
    je_einheit AS (
      SELECT e.einheit, e.schluessel, e.herkunft,
             EXISTS (
               SELECT 1 FROM antraege x WHERE x.einheit = e.einheit AND (
                 COALESCE(x.current_step, 0) >= 8
                 OR x.payment_status IN ('pending_payment', 'claimed_paid', 'paid') OR x.claimed_paid_at IS NOT NULL
                 OR x.status NOT IN ${UNFERTIG})
             ) AS fertig,
             EXISTS (
               SELECT 1 FROM antraege x JOIN fiaon_abo_raten r ON r.ref = x.ref
                WHERE x.einheit = e.einheit AND r.rate_nr = 1 AND r.status = 'bezahlt'
                  AND r.bezahlt_am IS NOT NULL AND r.bezahlt_am >= e.ab - ${SPIELRAUM}
             ) AS zahlend,
             COALESCE((
               SELECT SUM(r.betrag_cents) FROM antraege x JOIN fiaon_abo_raten r ON r.ref = x.ref
                WHERE x.einheit = e.einheit AND r.status = 'bezahlt'
                  AND r.bezahlt_am IS NOT NULL AND r.bezahlt_am >= e.ab - ${SPIELRAUM}
             ), 0)::bigint AS raten_cents,
             au.n AS auskuenfte, au.cents AS auskunft_cents
        FROM einheiten e
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS n, COALESCE(SUM(ROUND(s.amount_due * 100)), 0)::bigint AS cents
            FROM fiaon_applications s
           WHERE s.ref LIKE 'FIAON-SCHUFA-%' AND s.payment_status = 'paid' AND s.merged_into IS NULL
             AND (s.ref = ANY(e.refs) OR (e.person_id IS NOT NULL AND s.person_id = e.person_id))
             AND COALESCE(s.paid_at, s.completed_at AT TIME ZONE 'UTC', s.created_at AT TIME ZONE 'UTC') >= e.ab - ${SPIELRAUM}
        ) au ON TRUE
    ),
    ergebnis AS (
      SELECT schluessel, COUNT(*)::int AS menschen,
             COUNT(*) FILTER (WHERE herkunft = 'web')::int AS web_menschen,
             COUNT(*) FILTER (WHERE fertig)::int AS antraege,
             COUNT(*) FILTER (WHERE zahlend)::int AS zahlende,
             SUM(raten_cents)::bigint AS umsatz_raten_cents,
             SUM(auskuenfte)::int AS auskuenfte,
             SUM(auskunft_cents)::bigint AS auskunft_cents
        FROM je_einheit GROUP BY schluessel
    ),
    lead_zahl AS (
      SELECT schluessel, COUNT(*)::int AS leads, MAX(kampagne_text) AS name_text FROM lead_zeilen GROUP BY schluessel
    ),
    alle AS (
      SELECT 'meta:' || id AS schluessel FROM kosten
      UNION SELECT schluessel FROM lead_zahl
      UNION SELECT schluessel FROM ergebnis
    )
    SELECT s.schluessel,
           CASE WHEN s.schluessel LIKE 'meta:%' THEN SUBSTRING(s.schluessel FROM 6) END AS kampagne_id,
           COALESCE(kn.name, lz.name_text) AS name,
           (kn.id IS NOT NULL) AS im_konto,
           ko.ausgaben, ko.impressionen, ko.klicks, ko.leads_meta,
           COALESCE(lz.leads, 0) AS leads,
           COALESCE(er.menschen, 0) AS menschen,
           COALESCE(er.web_menschen, 0) AS web_menschen,
           COALESCE(er.antraege, 0) AS antraege,
           COALESCE(er.zahlende, 0) AS zahlende,
           COALESCE(er.umsatz_raten_cents, 0) AS umsatz_raten_cents,
           COALESCE(er.auskuenfte, 0) AS auskuenfte,
           COALESCE(er.auskunft_cents, 0) AS auskunft_cents
      FROM alle s
      LEFT JOIN kosten ko ON 'meta:' || ko.id = s.schluessel
      LEFT JOIN kampagnen kn ON 'meta:' || kn.id = s.schluessel
      LEFT JOIN lead_zahl lz ON lz.schluessel = s.schluessel
      LEFT JOIN ergebnis er ON er.schluessel = s.schluessel
     ORDER BY (kn.id IS NOT NULL) DESC, COALESCE(ko.ausgaben, 0) DESC, COALESCE(lz.leads, 0) DESC, COALESCE(er.menschen, 0) DESC`;
}

export type ZeilenArt = "konto" | "extern" | "website";

export interface BerichtZeile {
  schluessel: string;
  art: ZeilenArt;
  kampagneId: string | null;
  name: string;
  /** null = Kosten nicht abrufbar (Kampagne außerhalb des Kontos oder Website ohne Kampagne). */
  ausgabenCents: number | null;
  impressionen: number | null;
  klicks: number | null;
  leadsMeta: number | null;
  /**
   * Leads in fiaon_leads (Zeilen, wie Meta sie zählt) plus Menschen, die über
   * die Website mit dieser Kampagnenkennung einen Antrag begannen; bei der
   * Website-Zeile: Menschen mit Meta-Klick.
   */
  leads: number;
  /** Davon über die Website (Antrag mit utm_campaign dieser Kampagne). */
  ueberWebsite: number;
  /** Menschen (eine Person zählt einmal). */
  menschen: number;
  antraege: number;
  zahlende: number;
  umsatzRatenCents: number;
  auskuenfte: number;
  auskunftCents: number;
  kostenJeLeadCents: number | null;
  kostenJeAntragCents: number | null;
  kostenJeZahlendemCents: number | null;
  hinweis: string | null;
}

export interface KostenBericht {
  von: string;
  bis: string;
  /** Wann zuletzt Kosten in der Tabelle landeten (null = noch nie abgerufen). */
  stand: string | null;
  letzterAbruf: AbrufErgebnis | null;
  werbekonten: string[];
  zeilen: BerichtZeile[];
  /** Summe der Kampagnen im Werbekonto — nur dort sind die Kosten bekannt. */
  summe: Omit<BerichtZeile, "schluessel" | "art" | "kampagneId" | "name" | "hinweis"> & { ausgabenCents: number };
}

/** Kosten ÷ Anzahl in Cent — null, wenn es nichts zu teilen gibt (nie ∞, nie 0 als Ersatz). */
export function jeStueck(cents: number | null, anzahl: number): number | null {
  return cents != null && anzahl > 0 ? Math.round(cents / anzahl) : null;
}

const zahl = (v: unknown): number => Number(v ?? 0) || 0;
const zahlOderNull = (v: unknown): number | null => (v == null ? null : Number(v) || 0);

/** Gültiges JJJJ-MM-TT oder null. */
export function datumOderNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export async function kostenBericht(von: string, bis: string, lauf: Lauf = sqlPool): Promise<KostenBericht> {
  await kostenTabelle(lauf);
  // Die Spalte kampagne am Messsatz entsteht in capiTabellen — vor dem Bericht sicherstellen.
  await (await import("./fiaon-meta-capi")).capiTabellen(lauf).catch(() => {});
  const [da] = (await lauf`
    SELECT to_regclass('public.fiaon_meta_messung') IS NOT NULL AS messung,
           to_regclass('public.fiaon_werbe_zuordnung') IS NOT NULL AS zuordnung`) as any[];
  const roh = (await lauf.unsafe(berichtSql({ mitMessung: !!da?.messung, mitZuordnung: !!da?.zuordnung }), [von, bis])) as any[];
  const [st] = (await lauf`SELECT MAX(aktualisiert_am) AS am FROM fiaon_meta_kosten`) as any[];
  let letzterAbruf: AbrufErgebnis | null = null;
  try { letzterAbruf = JSON.parse((await einstellung(KOSTEN_STAND_SCHLUESSEL, lauf)) ?? "null"); } catch { letzterAbruf = null; }
  const werbekontenListe = letzterAbruf?.konten?.length
    ? letzterAbruf.konten
    : kontenListe(String(process.env.META_WERBEKONTO ?? "").trim() || (await einstellung(WERBEKONTO_SCHLUESSEL, lauf)));
  return berichtBauen(roh, {
    von, bis, stand: st?.am ? new Date(st.am).toISOString() : null, letzterAbruf, werbekonten: werbekontenListe,
  });
}

/**
 * Die Zeilen der Abfrage → der Bericht mit Kosten je Stück und Summe.
 * Rein, ohne Datenbank — damit der Prüfstand dieselbe Rechnung fährt.
 */
export function berichtBauen(
  roh: any[],
  rahmen: Pick<KostenBericht, "von" | "bis" | "stand" | "letzterAbruf" | "werbekonten">,
): KostenBericht {
  const zeilen: BerichtZeile[] = roh.map((r) => {
    const schluessel = String(r.schluessel);
    const art: ZeilenArt = schluessel === "website" ? "website" : r.im_konto ? "konto" : "extern";
    const ausgaben = art === "konto" ? zahl(r.ausgaben) : null;
    const antraege = zahl(r.antraege);
    const zahlende = zahl(r.zahlende);
    const menschen = zahl(r.menschen);
    const ueberWebsite = zahl(r.web_menschen);
    const leads = art === "website" ? menschen : zahl(r.leads) + ueberWebsite;
    const name = art === "website"
      ? "Website (Meta-Klick), Kampagne unbekannt"
      : String(r.name ?? "").trim() || (schluessel.startsWith("meta:") ? `Kampagne ${schluessel.slice(5)}` : "(ohne Kampagnennamen)");
    // Gegenlesen 24.09.2026: Eine Kampagne mit Kennung (Lead über unsere App)
    // ohne gespeicherte Kosten liegt NICHT zwingend außerhalb des Kontos — vor
    // dem ersten Abruf stand „Kampagne #2" genau so da. Nur Make-Leads mit
    // bloßem Namen sind sicher außerhalb.
    const hinweis = art === "extern"
      ? (schluessel.startsWith("meta:")
          ? "Keine Kosten gespeichert — noch nicht abgerufen oder Werbekonto ohne Zugriff"
          : schluessel === "extern:"
            ? "Lead ohne Kampagnenangabe — Kosten nicht zuordenbar"
            : "Kampagne außerhalb des Kontos — Kosten nicht abrufbar")
      : art === "website"
        ? "Antrag mit Meta-Klick ohne Kampagnenkennung (utm_campaign) — auch unbezahlte Klicks aus Beiträgen tragen diese Kennung"
        : zahlende === 0 ? "noch kein zahlender Kunde" : null;
    return {
      schluessel, art, kampagneId: r.kampagne_id ?? null, name,
      ausgabenCents: ausgaben,
      impressionen: art === "konto" ? zahl(r.impressionen) : null,
      klicks: art === "konto" ? zahl(r.klicks) : null,
      leadsMeta: art === "konto" ? zahlOderNull(r.leads_meta) ?? 0 : null,
      leads, ueberWebsite, menschen, antraege, zahlende,
      umsatzRatenCents: zahl(r.umsatz_raten_cents),
      auskuenfte: zahl(r.auskuenfte),
      auskunftCents: zahl(r.auskunft_cents),
      kostenJeLeadCents: jeStueck(ausgaben, leads),
      kostenJeAntragCents: jeStueck(ausgaben, antraege),
      kostenJeZahlendemCents: jeStueck(ausgaben, zahlende),
      hinweis,
    };
  });

  const konto = zeilen.filter((z) => z.art === "konto");
  const summiere = (f: (z: BerichtZeile) => number | null) => konto.reduce((s, z) => s + (f(z) ?? 0), 0);
  const ausgabenCents = summiere((z) => z.ausgabenCents);
  const s = {
    ausgabenCents,
    impressionen: summiere((z) => z.impressionen),
    klicks: summiere((z) => z.klicks),
    leadsMeta: summiere((z) => z.leadsMeta),
    leads: summiere((z) => z.leads),
    ueberWebsite: summiere((z) => z.ueberWebsite),
    menschen: summiere((z) => z.menschen),
    antraege: summiere((z) => z.antraege),
    zahlende: summiere((z) => z.zahlende),
    umsatzRatenCents: summiere((z) => z.umsatzRatenCents),
    auskuenfte: summiere((z) => z.auskuenfte),
    auskunftCents: summiere((z) => z.auskunftCents),
  };
  return {
    ...rahmen,
    zeilen,
    summe: {
      ...s,
      kostenJeLeadCents: jeStueck(ausgabenCents, s.leads),
      kostenJeAntragCents: jeStueck(ausgabenCents, s.antraege),
      kostenJeZahlendemCents: jeStueck(ausgabenCents, s.zahlende),
    },
  };
}
