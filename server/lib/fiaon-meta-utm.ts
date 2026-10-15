// ═══════════════════════════════════════════════════════════════════════════
// META-AUTOMATIK: UTM-PARAMETER AN JEDER WEBSITE-ANZEIGE (15.10.2026, E-380)
//
// Justin (15.10.2026): „Setz die UTM-Parameter bei den Meta-Anzeigen selbst" und
// „gib dem Plattform-Zugang das Schreibrecht … es muss automatisiert erfolgen".
// Seit heute ist das Werbekonto dem Systemnutzer „FIAON Plattform" zugewiesen
// (MANAGE/ADVERTISE/ANALYZE/DRAFT) — Anzeigenfassungen lassen sich anlegen.
//
// Stündlich: Jede LAUFENDE Anzeige, die auf fiaon.com führt und noch keine
// utm-Parameter trägt, bekommt eine neue Fassung mit denselben Inhalten plus
// UTM_TAGS (shared/fiaon-social-meta.ts) und wird auf diese Fassung umgestellt.
// Danach kennt Chefbüro › Besucher Kampagne, Anzeigengruppe und Anzeige, und die
// Kostenzuordnung (fiaon-meta-kosten, utm_id) trifft die Kampagne sicher.
//
// Leitplanken: je Anzeige höchstens EIN Wechsel (fiaon_meta_utm_protokoll),
// höchstens fünf je Lauf, nie pausierte/beendete Anzeigen, nie Lead-Formulare,
// Profilbesuche oder Nachrichten-Anzeigen. Eine neue Fassung schickt die Anzeige
// erneut durch Metas Prüfung — deshalb lieber früh (neue Anzeigen innerhalb einer
// Stunde) und nur einmal. Not-Aus: Einstellung meta_utm_automatik = aus.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { graph, graphAlle, MetaFehler } from "./fiaon-meta";
import { werbekonten } from "./fiaon-meta-kosten";
import { ensureMetaAutomatikTabellen, type GraphFn } from "./fiaon-social-meta";
import { UTM_JE_LAUF, fassungMitTags, utmSperre, type AnzeigeSicht } from "@shared/fiaon-social-meta";

const FELDER = [
  "id", "name", "effective_status",
  "adset{effective_status,end_time,destination_type}",
  "creative{id,name,url_tags,object_story_id,object_story_spec,asset_feed_spec,degrees_of_freedom_spec,contextual_multi_ads,instagram_user_id,link_url}",
].join(",");

export interface UtmErgebnis { zustand: "aus" | "kein_konto" | "gelaufen"; geprueft: number; geaendert: number; fehler: number }

export async function utmLauf(jetzt: Date = new Date(), g: GraphFn = graph, alle: typeof graphAlle = graphAlle): Promise<UtmErgebnis> {
  const [schalter] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'meta_utm_automatik' LIMIT 1`.catch(() => [])) as any[];
  if (String(schalter?.value ?? "").trim() === "aus") return { zustand: "aus", geprueft: 0, geaendert: 0, fehler: 0 };
  await ensureMetaAutomatikTabellen();
  const { konten } = await werbekonten();
  if (!konten.length) return { zustand: "kein_konto", geprueft: 0, geaendert: 0, fehler: 0 };

  const erg: UtmErgebnis = { zustand: "gelaufen", geprueft: 0, geaendert: 0, fehler: 0 };
  const erledigt = new Set(((await sqlPool`
    SELECT anzeige_id FROM fiaon_meta_utm_protokoll WHERE ergebnis = 'ok' OR versuche >= 3`) as any[]).map((r) => String(r.anzeige_id)));

  for (const konto of konten) {
    const anzeigen = (await alle(`${konto}/ads`, {
      params: { fields: FELDER, limit: 100, filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]) },
      hoechstens: 500,
    })) as (AnzeigeSicht & { name?: string })[];
    for (const a of anzeigen) {
      erg.geprueft++;
      if (erg.geaendert + erg.fehler >= UTM_JE_LAUF) break;
      if (erledigt.has(String(a.id))) continue;
      if (utmSperre(a, jetzt.getTime()) !== null) continue;
      const name = String(a.name ?? a.creative?.id ?? a.id);
      await sqlPool`
        INSERT INTO fiaon_meta_utm_protokoll (anzeige_id, anzeige_name, alte_fassung, ergebnis, versuche, am)
        VALUES (${String(a.id)}, ${name}, ${String(a.creative!.id)}, 'offen', 1, NOW())
        ON CONFLICT (anzeige_id) DO UPDATE SET versuche = fiaon_meta_utm_protokoll.versuche + 1, am = NOW()`;
      try {
        const neu = await g(`${konto}/adcreatives`, { methode: "POST", params: fassungMitTags(a.creative!, name) });
        await g(String(a.id), { methode: "POST", params: { creative: JSON.stringify({ creative_id: String(neu.id) }) } });
        await sqlPool`
          UPDATE fiaon_meta_utm_protokoll SET neue_fassung = ${String(neu.id)}, ergebnis = 'ok', fehler = NULL, am = NOW() WHERE anzeige_id = ${String(a.id)}`;
        erg.geaendert++;
      } catch (e: any) {
        erg.fehler++;
        const text = e instanceof MetaFehler ? e.klartext : String(e?.message ?? e);
        await sqlPool`UPDATE fiaon_meta_utm_protokoll SET ergebnis = 'fehler', fehler = ${text.slice(0, 500)}, am = NOW() WHERE anzeige_id = ${String(a.id)}`;
      }
    }
  }
  if (erg.geaendert || erg.fehler) console.log(`[META-UTM] ${erg.geaendert} Anzeigen mit Parametern versehen, ${erg.fehler} Fehler`);
  return erg;
}
