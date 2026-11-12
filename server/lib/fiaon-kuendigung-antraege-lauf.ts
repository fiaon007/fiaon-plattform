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

// ═══════════════════════════════════════════════════════════════════════════
// DER REST: ANTRÄGE OHNE KARTE (E-501 Nachtrag, 12.11.2026)
//
// Acht wartende Anträge wurden nie eine Karte. Gelesen stellte sich heraus, warum:
//   · Die Bestellung des Antrags ist längst gekündigt (auch zusammengeführt) oder der Mensch, den nur die Mail-Adresse
//     findet, ist längst gekündigt → nur der Status hängt („status_nachziehen“).
//   · Weder Bestellung noch Mensch zu finden → mit Vermerk schließen („schliessen“).
//   · Der Antrag hängt an einem ANDEREN Produkt (der einmaligen Bonitätsauskunft), der Mensch hat aber genau EIN
//     laufendes, bezahltes Paket: Das ist eine echte Kündigung dieses Pakets („abo_kuendigen“) — die Zuordnung der
//     Karten kennt nur Anträge, deren Referenz selbst ein Paket ist. Gebucht wird wie jede Formular-Kündigung
//     (antragBuchen: Eingangstag, Urkunde, Bestätigung), aber NUR in der Stufe „an“.
// Alles andere bleibt liegen („halten“): mehrere laufende Pakete, Identität nicht bestätigt, Geld-zurück/Widerruf im Text.
//
// Schalter „kuendigung_antraege_rest“: trocken | status | an | aus — VORGABE TROCKEN. „status“ führt nur aus, was keinen
// Kunden berührt (Status nachziehen, schließen); „an“ bucht zusätzlich die Paket-Kündigungen. Nur Anträge vor dem Stichtag.
// ═══════════════════════════════════════════════════════════════════════════
export const KR = { schalter: "kuendigung_antraege_rest", plan: "kuendigung_antraege_rest_plan", fehler: "kuendigung_antraege_rest_fehler" } as const;
export type RestModus = "trocken" | "status" | "an" | "aus";
export type RestAktion = "status_nachziehen" | "schliessen" | "abo_kuendigen" | "halten";
const GELD_ZURUECK = /geld\s+zur(?:ü|ue)ck|erstatt|r(?:ü|ue)ck(?:zahl|(?:ü|ue)berweis|erstatt)|zur(?:ü|ue)ck\s*(?:ü|ue)berweis|wi(?:e)?derr?uf|r(?:ü|ue)cktritt/i;

/** Was mit einem Antrag ohne Karte geschieht. Rein. */
export function restAktion(o: {
  /** Die Bestellung des Antrags (über seine Referenz) ist gekündigt. */
  bestellungGekuendigt: boolean;
  /** Ein Mensch ist gefunden (über die Bestellung oder die Mail-Adresse). */
  person: boolean;
  /** Dieser Mensch hat mindestens eine gekündigte Bestellung. */
  personGekuendigt: boolean;
  /** Seine laufenden, bezahlten Pakete (ohne Einmalprodukte, nicht gekündigt, nicht zusammengeführt). */
  laufendePakete: number;
  /** Identität über das Geburtsdatum bestätigt. */
  identBestaetigt: boolean;
  text: string | null | undefined;
}): { aktion: RestAktion; warum: string } {
  if (o.laufendePakete > 1) return { aktion: "halten", warum: "mehrere laufende Pakete — welches gemeint ist, entscheidet ein Mensch" };
  if (o.laufendePakete === 1) {
    if (GELD_ZURUECK.test(String(o.text ?? ""))) return { aktion: "halten", warum: "der Text nennt Geld zurück oder Widerruf — entscheidet die Leitung" };
    if (!o.identBestaetigt) return { aktion: "halten", warum: "Identität nicht über das Geburtsdatum bestätigt" };
    return { aktion: "abo_kuendigen", warum: "der Antrag hängt an einem anderen Produkt, gemeint ist das eine laufende Paket" };
  }
  if (o.bestellungGekuendigt || (o.person && o.personGekuendigt)) return { aktion: "status_nachziehen", warum: "längst gekündigt — nur der Status des Antrags hängt" };
  if (!o.person) return { aktion: "schliessen", warum: "keiner Bestellung und keinem Kunden zuzuordnen" };
  return { aktion: "halten", warum: "Kunde gefunden, aber kein laufendes Paket und keine Kündigung — ein Mensch sieht es an" };
}

export interface RestPlan {
  antrag: number; eingang: string; aktion: RestAktion; warum: string;
  weg: string | null; letzteRateNr: number | null; letzteRateCents: number | null; entfallen: number; ende: string | null;
}
interface RestFall extends RestPlan { personId: number | null; antragRef: string | null; zielRef: string | null; zielPaket: string | null; am: string; grund: string | null }

export async function restModus(lauf: Lauf = sqlPool): Promise<RestModus> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${KR.schalter}`.catch(() => [])) as any[];
  const w = String(z?.value ?? "").trim().toLowerCase();
  return w === "an" || w === "aus" || w === "status" ? w : "trocken";
}

/** Die Anträge ohne Karte vor dem Stichtag — mit Aktion und (bei der Paket-Kündigung) der Probe. Liest nur. */
async function restFaelleLesen(lauf: Lauf): Promise<RestFall[]> {
  const { KUENDIGUNG_ANTRAEGE_SQL } = await import("@shared/fiaon-kuendigung-regel");
  const { kuendigungSetzen } = await import("./fiaon-kuendigung");
  const zeilen = (await lauf.unsafe(`
    SELECT c.id, c.ref, c.reason, c.created_at::timestamptz AS am, c.identifiziert_ueber,
           a.person_id AS a_person, (a.gekuendigt_am IS NOT NULL) AS a_gekuendigt,
           (SELECT p.id FROM fiaon_persons p WHERE LOWER(TRIM(COALESCE(p.primary_email, ''))) = LOWER(TRIM(COALESCE(c.email, '')))
               AND TRIM(COALESCE(c.email, '')) <> '' AND p.merged_into_person_id IS NULL ORDER BY p.id LIMIT 1) AS mail_person
      FROM cancellation_requests c LEFT JOIN fiaon_applications a ON a.ref = c.ref
     WHERE c.status = 'pending' AND c.created_at::timestamptz < $1::timestamptz
       AND NOT EXISTS (SELECT 1 FROM (${KUENDIGUNG_ANTRAEGE_SQL}) kr_x WHERE kr_x.antrag_id = c.id)
     ORDER BY c.id`, [KA_NUR_VOR])) as any[];
  const aus: RestFall[] = [];
  for (const z of zeilen) {
    const personId = z.a_person != null ? Number(z.a_person) : z.mail_person != null ? Number(z.mail_person) : null;
    const bestellungen = personId == null ? [] : (await lauf`
      SELECT ref, type, pack_name, payment_status, (gekuendigt_am IS NOT NULL) AS gekuendigt, (merged_into IS NOT NULL) AS merged, (ist.id IS NOT NULL) AS test
        FROM fiaon_applications LEFT JOIN fiaon_persons ist ON ist.id = fiaon_applications.person_id AND ist.ist_test_am IS NOT NULL
       WHERE person_id = ${personId}`) as any[];
    if (bestellungen.some((b) => b.test === true)) continue;
    const laufend = bestellungen.filter((b) => String(b.type) !== "schufa" && String(b.payment_status) === "paid" && b.gekuendigt !== true && b.merged !== true);
    const urteil = restAktion({
      bestellungGekuendigt: z.a_gekuendigt === true, person: personId != null, personGekuendigt: bestellungen.some((b) => b.gekuendigt === true),
      laufendePakete: laufend.length, identBestaetigt: String(z.identifiziert_ueber ?? "") === "geburtsdatum", text: z.reason,
    });
    const am = new Date(z.am).toISOString();
    let probe: any = null;
    if (urteil.aktion === "abo_kuendigen") {
      probe = await kuendigungSetzen(String(laufend[0].ref), { quelle: "formular", am, probe: true })
        .catch((e: any) => ({ ok: false, weg: "unbekannt", grund: String(e?.message || e).slice(0, 160) }));
    }
    const buchbar = urteil.aktion !== "abo_kuendigen" || probe?.ok === true;
    aus.push({
      antrag: Number(z.id), eingang: berlinTag(z.am), aktion: buchbar ? urteil.aktion : "halten",
      warum: buchbar ? urteil.warum : `Probe: ${String(probe?.grund ?? "nicht buchbar").slice(0, 140)}`,
      weg: probe?.weg ?? null, letzteRateNr: probe?.letzteRateNr != null ? Number(probe.letzteRateNr) : null,
      letzteRateCents: probe?.letzteRateBetragCents != null ? Number(probe.letzteRateBetragCents) : null,
      entfallen: Number(probe?.stornierteRaten ?? 0) || 0, ende: probe?.vertragEndeAm ? berlinTag(probe.vertragEndeAm) : null,
      personId, antragRef: z.ref ? String(z.ref) : null, zielRef: laufend.length === 1 ? String(laufend[0].ref) : null,
      zielPaket: laufend.length === 1 && laufend[0].pack_name ? String(laufend[0].pack_name).split("\n")[0] : null, am, grund: z.reason ? String(z.reason) : null,
    });
  }
  return aus;
}

export async function restPlanLesen(lauf: Lauf = sqlPool): Promise<RestPlan[]> {
  return (await restFaelleLesen(lauf)).map(({ antrag, eingang, aktion, warum, weg, letzteRateNr, letzteRateCents, entfallen, ende }) =>
    ({ antrag, eingang, aktion, warum, weg, letzteRateNr, letzteRateCents, entfallen, ende }));
}

export interface RestErgebnis { modus: RestModus; faelle: number; erledigt: number; fehler: number; bestaetigt: number }

/** Der Rest-Lauf: den Plan ablegen; „status“ zieht nach und schließt, „an“ bucht zusätzlich die Paket-Kündigungen. Wirft nie. */
export async function restLauf(o: { lauf?: Lauf } = {}): Promise<RestErgebnis> {
  const lauf = o.lauf ?? sqlPool;
  const modus = await restModus(lauf);
  const erg: RestErgebnis = { modus, faelle: 0, erledigt: 0, fehler: 0, bestaetigt: 0 };
  if (modus === "aus") return erg;
  try {
    const faelle = await restFaelleLesen(lauf);
    erg.faelle = faelle.length;
    const [fz] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${KR.fehler}`.catch(() => [])) as any[];
    let fehler: Record<string, string> = {};
    try { const v = JSON.parse(String(fz?.value ?? "{}")); if (v && typeof v === "object") fehler = v; } catch { /* leer */ }
    await merkerSchreiben(lauf, KR.plan, {
      stand: new Date().toISOString(), modus,
      faelle: faelle.map(({ antrag, eingang, aktion, warum, weg, letzteRateNr, letzteRateCents, entfallen, ende }) =>
        ({ antrag, eingang, aktion, warum, weg, letzteRateNr, letzteRateCents, entfallen, ende, fehler: fehler[String(antrag)] ?? null })),
    });
    if (modus === "trocken") return erg;
    const beleg = "Justin Schwarzott, Ja vom 12.11.2026 (Lauf E-501)";
    const darf = (a: RestAktion) => a === "status_nachziehen" || a === "schliessen" || (a === "abo_kuendigen" && modus === "an");
    for (const f of faelle.filter((x) => darf(x.aktion) && !fehler[String(x.antrag)]).slice(0, KA_JE_LAUF)) {
      let ok = false; let grund = "";
      if (f.aktion === "status_nachziehen") {
        const z = (await lauf`
          UPDATE cancellation_requests SET status = 'confirmed', processed_at = NOW(), processed_by = ${KA_VON}, updated_at = NOW(),
                 admin_note = TRIM(COALESCE(admin_note, '') || ' ' || ${`[Längst gekündigt — Status nachgezogen: ${beleg}]`})
           WHERE id = ${f.antrag} AND status = 'pending' RETURNING id`) as any[];
        ok = z.length > 0; grund = ok ? "" : "nicht mehr offen";
      } else if (f.aktion === "schliessen") {
        const { kuendigungsantragSchliessen } = await import("./fiaon-kuendigung");
        ok = await kuendigungsantragSchliessen(f.antrag, { von: KA_VON, grund: `Keiner Bestellung und keinem Kunden zuzuordnen — ${beleg}`, personId: null });
        grund = ok ? "" : "nicht mehr offen";
      } else if (f.aktion === "abo_kuendigen" && f.zielRef && f.personId != null) {
        const { antragBuchen } = await import("../routes/fiaon-kuendigung");
        const r = await antragBuchen({
          id: f.antrag, am: f.am, ref: f.antragRef ?? f.zielRef, grund: f.grund, wunsch: null, personId: f.personId,
          ziel: { ziel: f.zielRef, buchbar: true, satz: `Gebucht wird ${f.zielPaket ?? "das laufende Paket"}.` } as any, zielPaket: f.zielPaket, identitaetOffen: false,
        }, {
          grund: `${f.grund ? `${f.grund.slice(0, 160)} ` : ""}(Formular; der Antrag hing an einem anderen Produkt, gemeint ist das laufende Paket — ${KA_VON}, Lauf E-501)`,
          personId: f.personId, alsLeitung: true, unterzeichner: { name: KA_VON, rolle: "Geschäftsführung" }, mail: true,
        }).catch((e: any) => ({ ok: false, grund: String(e?.message || e).slice(0, 200) }));
        ok = r?.ok === true; grund = ok ? "" : String(r?.error || r?.grund || "nicht gebucht").slice(0, 200);
        if (ok) {
          await lauf`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
            VALUES (${f.zielRef}, ${f.personId}, NULL, ${KA_VON}, 'system',
                    ${`${KA_VERMERK} (Antrag Nr. ${f.antrag}, hing an einem anderen Produkt — gebucht auf das laufende Paket zum Eingangstag) — ${beleg}.`}, NOW())`.catch(() => {});
        }
      }
      if (ok) { erg.erledigt++; console.log(`[KUENDIGUNG-ANTRAEGE] Rest, Antrag ${f.antrag}: ${f.aktion}.`); }
      else { fehler[String(f.antrag)] = grund || "nicht ausgeführt"; erg.fehler++; console.warn(`[KUENDIGUNG-ANTRAEGE] Rest, Antrag ${f.antrag}: ${fehler[String(f.antrag)]}`); }
    }
    if (erg.fehler) await merkerSchreiben(lauf, KR.fehler, fehler);
    if (modus === "an") {
      const { nachholBestaetigungenSenden } = await import("./fiaon-kuendigung-nachholen");
      erg.bestaetigt = await nachholBestaetigungenSenden(lauf);
    }
  } catch (err) {
    console.error("[KUENDIGUNG-ANTRAEGE] Rest:", String((err as Error)?.message ?? err).slice(0, 200));
  }
  return erg;
}

/** Für den Zeitplan (stillerLauf): beide Läufe; eine Historienzeile bei Arbeit oder Fehlern und als Puls alle 6 Stunden. */
let letzterPuls = 0;
export async function antraegeTakt(): Promise<boolean> {
  const e = await antraegeLauf();
  const r = await restLauf();
  if (e.erledigt || e.fehler || e.bestaetigt || r.erledigt || r.fehler || r.bestaetigt) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls > 6 * 3600_000) { letzterPuls = Date.now(); return true; }
  return false;
}
