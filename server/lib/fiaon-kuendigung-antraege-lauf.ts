// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNGS-ANTRÄGE AUS DEM FORMULAR ABARBEITEN (E-501, 12.11.2026)
//
// Justin (12.11.2026, „Ja zu beiden, mach das selbst“): die wartenden Kündigungs-Anträge aus dem Formular abarbeiten —
// jeden Antrag prüfen, zum Tag des Antrags buchen, mit Urkunde und Bestätigung. Und für die Lücke in der Ratenkette:
// zum Eingangstag buchen, die gestellte Rate bleibt wie gebucht, die nie gestellte wird nicht nachgefordert.
//
// ── WIE ─────────────────────────────────────────────────────────────────────
// Der Lauf erfindet keinen zweiten Weg: Er führt die Karten „Kündigung nie gebucht“ (Mara-Steuerpult) so aus, wie ein
// Klick des Inhabers es täte (`entscheiden` → Werkzeug `kuendigung_buchen` → `antragBuchen` → `kuendigungDurchfuehren`
// bzw. `kuendigungsantrag_schliessen`): Ziel aus antragZiel, Eingangstag, Quelle „formular“, Urkunde, Bestätigung, der
// Antrag geschlossen, die Karte entschieden. Es gilt die Empfehlung der Karte (buchen / keine).
//
// ── SICHER GEBAUT ───────────────────────────────────────────────────────────
// · Schalter „kuendigung_antraege_lauf“: trocken | an | aus — VORGABE TROCKEN: nur der Plan, nichts wird gebucht.
// · Nur der Bestand: Anträge, die vor Justins Ja eingegangen sind (KA_NUR_VOR). Ein späterer Antrag bleibt eine Karte.
// · Der Trockenplan rechnet jede Buchung als Probe (kuendigungSetzen probe) und zeigt je Antrag, was fällig bleibt und
//   was entfällt — ohne Kundentext, ohne Namen (fiaon_settings „kuendigung_antraege_plan“).
// · Höchstens drei je Lauf. Was scheitert, steht mit Grund im Merker und wird nicht endlos wiederholt.
// · Wer ohne Hausbestätigung gebucht ist (Vertrag schon beendet, nichts offen), bekommt Maras kurze Bestätigung
//   (fiaon-kuendigung-nachholen.ts) — einmal je Bestellung.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { ANTRAEGE_LAUF_VERMERK } from "./fiaon-kuendigung-nachholen";

type Lauf = typeof sqlPool;
export const KA = { schalter: "kuendigung_antraege_lauf", plan: "kuendigung_antraege_plan", fehler: "kuendigung_antraege_fehler" } as const;
export type AntraegeModus = "trocken" | "an" | "aus";
/** Justins Ja (12.11.2026 mittags, Berliner Zeit 12:30) — nur Anträge, die davor eingegangen sind. */
export const KA_NUR_VOR = "2026-11-12T11:30:00.000Z";
/** Wer entschieden hat — steht auf der Karte, in der Akte und als Unterzeichner der Urkunde (wie beim Klick des Inhabers). */
export const KA_VON = "Justin Schwarzott";
export const KA_VERMERK = ANTRAEGE_LAUF_VERMERK;
export const KA_JE_LAUF = 3;
const KARTEN_ART = "kuendigung_ungebucht";

export interface AntragPlan {
  antrag: number; karte: number; aktion: "buchen" | "schliessen" | "nichts";
  /** Tag des Eingangs (JJJJ-MM-TT, Berlin). */
  eingang: string;
  weg: string | null; letzteRateNr: number | null; letzteRateCents: number | null; entfallen: number; ende: string | null;
  luecke: boolean; identitaetOffen: boolean; hinweis: string | null;
}

/** „kuendigung_ungebucht:142“ → 142. Rein. */
export function antragNrAusSchluessel(schluessel: unknown): number | null {
  const m = /^kuendigung_ungebucht:(\d+)$/.exec(String(schluessel ?? ""));
  return m ? Number(m[1]) : null;
}

/** Was der Lauf mit einer Karte tut — aus ihrer Empfehlung und der Probe. Rein. */
export function antragAktion(o: { empfehlung: string; hatBuchen: boolean; hatKeine: boolean; eingang: string; nurVor: string; probeOk: boolean | null }): AntragPlan["aktion"] {
  if (o.eingang >= o.nurVor) return "nichts";
  if (o.empfehlung === "buchen" && o.hatBuchen) return o.probeOk === true ? "buchen" : "nichts";
  if (o.empfehlung === "keine" && o.hatKeine) return "schliessen";
  return "nichts";
}

const berlinTag = (v: unknown) => new Date(v as any).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export async function antraegeModus(lauf: Lauf = sqlPool): Promise<AntraegeModus> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${KA.schalter}`.catch(() => [])) as any[];
  const w = String(z?.value ?? "").trim().toLowerCase();
  return w === "an" || w === "aus" ? w : "trocken";
}

/** Der Plan: je offener Karte die Aktion und — beim Buchen — die Probe. Liest nur (die Probe schreibt nichts). */
export async function antraegePlanLesen(lauf: Lauf = sqlPool, opt: { karten?: { id: number; schluessel: string; empfehlung: string; optionen: unknown }[] } = {}): Promise<AntragPlan[]> {
  const { offeneKuendigungsantraege, kuendigungSetzen } = await import("./fiaon-kuendigung");
  // `karten` nur für Vorschau und Prüfstand (frische Karten aus dem Detektor, ohne sie zu speichern).
  const karten = opt.karten ?? (await lauf`
    SELECT id, schluessel, empfehlung, optionen FROM fiaon_mara_entscheidungen
     WHERE art = ${KARTEN_ART} AND status IN ('offen', 'spaeter') ORDER BY id`) as any[];
  const plan: AntragPlan[] = [];
  for (const k of karten) {
    const antragNr = antragNrAusSchluessel(k.schluessel);
    if (antragNr == null) continue;
    const [antrag] = await offeneKuendigungsantraege(null, antragNr);
    if (!antrag) continue;
    let optionen: any[] = k.optionen;
    for (let i = 0; i < 2 && typeof optionen === "string"; i++) { try { optionen = JSON.parse(optionen); } catch { optionen = []; } }
    if (!Array.isArray(optionen)) optionen = [];
    const buchen = optionen.find((o) => o?.key === "buchen" && o?.werkzeug === "kuendigung_buchen");
    const keine = optionen.find((o) => o?.key === "keine" && o?.werkzeug === "kuendigungsantrag_schliessen");
    const luecke = buchen?.args?.lueckeFreigabe === true;
    let probe: any = null;
    if (String(k.empfehlung) === "buchen" && buchen && antrag.ziel.ziel) {
      probe = await kuendigungSetzen(antrag.ziel.ziel, {
        quelle: "formular", am: antrag.am, probe: true,
        widerrufErwaehnt: /widerruf|wiederruf|rücktritt|ruecktritt/i.test(String(antrag.grund ?? "")),
        lueckeFreigabe: luecke ? `Probe — ${KA_VON}` : null,
      }).catch((e: any) => ({ ok: false, weg: "unbekannt", grund: String(e?.message || e).slice(0, 160) }));
    }
    const eingang = new Date(antrag.am).toISOString();
    const aktion = antragAktion({ empfehlung: String(k.empfehlung), hatBuchen: !!buchen, hatKeine: !!keine, eingang, nurVor: KA_NUR_VOR, probeOk: probe ? probe.ok === true : null });
    plan.push({
      antrag: antragNr, karte: Number(k.id), aktion, eingang: berlinTag(antrag.am),
      weg: probe?.weg ?? null, letzteRateNr: probe?.weg === "letzte_rate" ? Number(probe.letzteRateNr) : null,
      letzteRateCents: probe?.weg === "letzte_rate" && probe?.letzteRateBetragCents != null ? Number(probe.letzteRateBetragCents) : null,
      entfallen: Number(probe?.stornierteRaten ?? 0) || 0, ende: probe?.vertragEndeAm ? berlinTag(probe.vertragEndeAm) : null,
      luecke, identitaetOffen: antrag.identitaetOffen === true,
      hinweis: eingang >= KA_NUR_VOR ? "nach dem Stichtag eingegangen — bleibt eine Karte"
        : probe && probe.ok !== true ? String(probe.grund ?? "nicht buchbar").slice(0, 160)
        : aktion === "nichts" ? "die Karte empfiehlt nichts, was der Lauf ausführen darf" : null,
    });
  }
  return plan;
}

export interface AntraegeErgebnis { modus: AntraegeModus; karten: number; buchen: number; schliessen: number; erledigt: number; fehler: number; bestaetigt: number }

async function merkerLesen(lauf: Lauf): Promise<Record<string, string>> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${KA.fehler}`.catch(() => [])) as any[];
  try { const v = JSON.parse(String(z?.value ?? "{}")); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
async function merkerSchreiben(lauf: Lauf, schluessel: string, wert: unknown): Promise<void> {
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, ${JSON.stringify(wert)}, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`.catch(() => {});
}

/** Der Lauf: Karten auffrischen, den Plan ablegen, bei „an“ höchstens drei Karten ausführen. Wirft nie. */
export async function antraegeLauf(o: { lauf?: Lauf } = {}): Promise<AntraegeErgebnis> {
  const lauf = o.lauf ?? sqlPool;
  const modus = await antraegeModus(lauf);
  const erg: AntraegeErgebnis = { modus, karten: 0, buchen: 0, schliessen: 0, erledigt: 0, fehler: 0, bestaetigt: 0 };
  if (modus === "aus") return erg;
  try {
    const E = await import("./fiaon-mara-entscheidungen");
    // Die Karten frisch (auch die Option „Trotz Lücke buchen“) — derselbe Sammler wie im Steuerpult.
    await E.entscheidungenSammeln({ nur: [KARTEN_ART] }).catch((e) => console.warn("[KUENDIGUNG-ANTRAEGE] Sammeln:", String(e).slice(0, 160)));
    const plan = await antraegePlanLesen(lauf);
    const fehler = await merkerLesen(lauf);
    erg.karten = plan.length; erg.buchen = plan.filter((p) => p.aktion === "buchen").length; erg.schliessen = plan.filter((p) => p.aktion === "schliessen").length;
    await merkerSchreiben(lauf, KA.plan, { stand: new Date().toISOString(), modus, faelle: plan.map((p) => ({ ...p, fehler: fehler[String(p.antrag)] ?? null })) });
    if (modus === "an") {
      for (const p of plan.filter((x) => x.aktion !== "nichts" && !fehler[String(x.antrag)]).slice(0, KA_JE_LAUF)) {
        const r = await E.entscheiden(p.karte, p.aktion === "buchen" ? "buchen" : "keine", { von: KA_VON, lauf }).catch((e: any) => ({ ok: false, status: 500, error: String(e?.message || e).slice(0, 200) } as any));
        if (!r?.ok || r.schon) {
          if (!r?.ok) { fehler[String(p.antrag)] = String(r?.error || "nicht ausgeführt").slice(0, 200); erg.fehler++; console.warn(`[KUENDIGUNG-ANTRAEGE] Antrag ${p.antrag}: ${fehler[String(p.antrag)]}`); }
          continue;
        }
        erg.erledigt++;
        // Der Beleg an Karte und Akte: Justins Ja vom 12.11.2026 — und die Marke, an der Maras Bestätigung den Fall findet.
        await lauf`UPDATE fiaon_mara_entscheidungen SET ergebnis = LEFT(COALESCE(ergebnis, '') || ${" — Justin Schwarzott, Ja vom 12.11.2026 (Lauf E-501)"}, 600) WHERE id = ${p.karte}`.catch(() => {});
        const [k] = (await lauf`SELECT person_id, ref FROM fiaon_mara_entscheidungen WHERE id = ${p.karte}`.catch(() => [])) as any[];
        if (k?.ref) {
          await lauf`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
            VALUES (${k.ref}, ${k.person_id ?? null}, NULL, ${KA_VON}, 'system',
                    ${`${KA_VERMERK} (Antrag Nr. ${p.antrag}, ${p.aktion === "buchen" ? `gebucht zum Eingangstag${p.luecke ? ", Lücke in der Ratenkette freigegeben" : ""}` : "ohne Kündigung geschlossen"}) — Justin Schwarzott, Ja vom 12.11.2026.`}, NOW())`.catch(() => {});
        }
        console.log(`[KUENDIGUNG-ANTRAEGE] Antrag ${p.antrag}: ${p.aktion}.`);
      }
      if (erg.fehler) await merkerSchreiben(lauf, KA.fehler, fehler);
      const { nachholBestaetigungenSenden } = await import("./fiaon-kuendigung-nachholen");
      erg.bestaetigt = await nachholBestaetigungenSenden(lauf);
    }
  } catch (err) {
    console.error("[KUENDIGUNG-ANTRAEGE]", String((err as Error)?.message ?? err).slice(0, 200));
  }
  return erg;
}

/** Für den Zeitplan (stillerLauf): eine Historienzeile bei Arbeit oder Fehlern und als Puls alle 6 Stunden. */
let letzterPuls = 0;
export async function antraegeTakt(): Promise<boolean> {
  const e = await antraegeLauf();
  if (e.erledigt || e.fehler || e.bestaetigt) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls > 6 * 3600_000) { letzterPuls = Date.now(); return true; }
  return false;
}
