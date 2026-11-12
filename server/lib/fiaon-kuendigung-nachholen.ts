// ═══════════════════════════════════════════════════════════════════════════
// ALTE KÜNDIGUNGEN NACHHOLEN (E-499, 12.11.2026)
//
// Bis E-499 lehnte kuendigung_vormerken viele klare Kündigungen als „nicht eindeutig“ ab — die Kunden haben erklärt, dass
// sie raus wollen, gebucht ist bis heute nichts. Dieser Lauf findet diese Mails mit DERSELBEN Regel wie Maras Werkzeug
// heute (austrittsWille bzw. das Ja auf unsere Rückfrage) und bucht sie über DENSELBEN Vorgang (kuendigungDurchfuehren:
// Wirkung, Urkunde, schriftliche Bestätigung) — zum Tag, an dem seine Mail einging.
//
// ── SICHER GEBAUT ───────────────────────────────────────────────────────────
// · Schalter „kuendigung_nachholen“: trocken | an | aus — VORGABE TROCKEN: nur rechnen, den Plan ablegen, nichts buchen.
//   Gebucht wird erst, wenn Justin den Schalter auf „an“ stellt (KI-Team › Einstellungen).
// · Zwei Unterschriften wie im Lauf: Die Mail war als Kündigung eingeordnet ODER Mara hatte das Werkzeug gerufen — und
//   die Regel liest die Erklärung in seinen eigenen Worten.
// · Nie bei Widerruf nach einer Zahlung, Bestreiten, Anwalt/Behörde (dort entscheidet ein Mensch) — der Widerruf einer
//   UNBEZAHLTEN Bestellung ist ein Storno und zählt (rechtlichNurWegenWiderruf); nie bei einer späteren Rücknahme oder
//   einem späteren „ich kündige nicht“, nie bei FIAON Global, nie bei Testpersonen.
// · Nur der ALTBESTAND: Mails vor dem 12.11.2026 09:09 (seitdem bucht Maras Lauf selbst) — „an“ kann nie mehr buchen als das.
// · Je Bestellung die FRÜHESTE klare Mail. Höchstens fünf Buchungen je Lauf. Was scheitert, steht mit Grund im Merker
//   und wird nicht endlos wiederholt.
// · Nach der Buchung: wartende Antwort-Entwürfe mit einer Kündigungs-Rückfrage werden abgelegt (nicht gesendet).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  kundenTeil, eigenerKern, austrittsWille, austrittZurueckgenommen, austrittsFrageGestellt, bejahtAustritt, bestreitetKuendigung,
  keinKuendigungsSatz, austrittsGrund, zitierterTeil, frageImZitat, rechtlichNurWegenWiderruf,
} from "./fiaon-postmeister-werkzeuge";
import { abstreitenArt } from "@shared/fiaon-mara-ton";
import { istGlobalPaket } from "@shared/fiaon-pakete";

type Lauf = typeof sqlPool;
export const KN = { schalter: "kuendigung_nachholen", plan: "kuendigung_nachholen_plan", fehler: "kuendigung_nachholen_fehler" } as const;
export type NachholModus = "trocken" | "an" | "aus";
export const NACHHOL_JE_LAUF = 5;
export const NACHHOL_TAGE = 60;
/**
 * Nur ALTE Mails: Seit diesem Zeitpunkt (E-499 live, 12.11.2026 09:09 Berliner Zeit) bucht Maras Lauf klare Kündigungen
 * selbst. Der Nachhol-Lauf nimmt deshalb nur Mails davor — steht der Schalter auf „an“, kann er nie mehr buchen als den
 * Altbestand, den Justin im Trockenplan gesehen hat (spätere Mails zählen nur noch als Rücknahme).
 */
export const NACHHOL_NUR_VOR = "2026-11-12T08:09:00.000Z";

export interface NachholZeile {
  id: number; personId: number; ref: string; text: string; empfangenAm: string; davor: string | null;
  flags: Record<string, unknown> | null; bezahlt: boolean;
}
export interface NachholFall { postmeisterId: number; personId: number; ref: string; am: string; art: "klar" | "ja"; bezahlt: boolean; grund: string; widerruf: boolean }

function ohneAnhang(x: string): string { const i = x.indexOf("[Der Kunde hat "); return i >= 0 ? x.slice(0, i) : x; }
const MENSCH_FLAGS = ["widerruf", "bestreitet", "rechtlich", "droht_anwalt"] as const;

/**
 * Welche Bestellungen haben eine klare, nie gebuchte Kündigung in den Mails? Rein. `zeilen` = alle Kundenmails der
 * offenen Bestellungen, älteste zuerst. Ergebnis: je Bestellung der früheste Fall; `zurueck` = Bestellungen, bei denen
 * er es später zurücknahm oder verneinte (nie buchen).
 */
export function nachholFaelle(zeilen: NachholZeile[], opt: { nurVor?: string | null } = {}): { faelle: NachholFall[]; zurueck: string[] } {
  const jeRef = new Map<string, NachholFall>();
  const zurueck = new Set<string>();
  for (const z of [...zeilen].sort((a, b) => a.empfangenAm.localeCompare(b.empfangenAm) || a.id - b.id)) {
    const roh = ohneAnhang(String(z.text ?? ""));
    const eigen = (kundenTeil(roh) || roh).slice(0, 1500);
    const kern = eigenerKern(eigen);
    if (!kern.trim()) continue;
    // Eine spätere Rücknahme oder ein späteres „ich kündige nicht“ hebt eine frühere Erklärung auf.
    if (jeRef.has(z.ref)) {
      const verneint = kern.split(/(?<=[.!?])\s+|\n+/).some((s) => /k(?:ü|ue)ndig|storn|wi(?:e)?derr?uf/i.test(s) && keinKuendigungsSatz(s) === "verneint");
      if (austrittZurueckgenommen(kern, { unbezahlt: !z.bezahlt }) || verneint) { jeRef.delete(z.ref); zurueck.add(z.ref); }
      continue;
    }
    if (zurueck.has(z.ref)) continue;
    // Nur der Altbestand: Eine Mail ab dem Stichtag begründet keinen Fall mehr (die bucht Maras Lauf selbst).
    if (opt.nurVor && z.empfangenAm >= opt.nurVor) continue;
    // Der Widerruf einer UNBEZAHLTEN Bestellung ist ein Storno (E-369/E-372) — außer mit Anwalt, Bestreiten, Löschwunsch, Geld zurück.
    const widerrufStorno = !z.bezahlt && rechtlichNurWegenWiderruf(z.flags, roh);
    if (!widerrufStorno && MENSCH_FLAGS.some((f) => !!z.flags?.[f])) continue;
    if (bestreitetKuendigung(eigen, abstreitenArt)) continue;
    const u = austrittsWille(kern.slice(0, 700), { unbezahlt: !z.bezahlt });
    const gefragt = austrittsFrageGestellt(z.davor) || frageImZitat(zitierterTeil(roh));
    const ja = gefragt && bejahtAustritt(kern);
    if (!(u.urteil === "klar" && !austrittZurueckgenommen(kern, { unbezahlt: !z.bezahlt })) && !ja) continue;
    jeRef.set(z.ref, {
      postmeisterId: z.id, personId: z.personId, ref: z.ref, am: z.empfangenAm, art: u.urteil === "klar" ? "klar" : "ja", bezahlt: z.bezahlt,
      grund: austrittsGrund(kern), widerruf: /wi(?:e)?der(?:r)?uf|r(?:ü|ue)cktritt/i.test(eigen),
    });
  }
  return { faelle: Array.from(jeRef.values()), zurueck: Array.from(zurueck) };
}

function jsonObjekt(wert: unknown): Record<string, unknown> | null {
  let v: any = wert;
  for (let i = 0; i < 2 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return null; } }
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

export async function nachholModus(lauf: Lauf = sqlPool): Promise<NachholModus> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${KN.schalter}`.catch(() => [])) as any[];
  const w = String(z?.value ?? "").trim().toLowerCase();
  return w === "an" || w === "aus" ? w : "trocken";
}

/** Liest die Kandidaten aus der Datenbank (nur lesen) und rechnet die Fälle. */
export async function nachholFaelleLesen(lauf: Lauf = sqlPool): Promise<{ faelle: NachholFall[]; zurueck: string[] }> {
  const zeilen = (await lauf`
    SELECT p.id, p.person_id, p.ref, p.text, COALESCE(p.empfangen_am, p.created_at) AS am, p.flags::text AS flags,
           (a.payment_status = 'paid') AS bezahlt, a.pack_key,
           (SELECT v.antwort FROM fiaon_postmeister v
             WHERE v.person_id = p.person_id AND v.antwort IS NOT NULL AND v.id <> p.id AND v.created_at < p.created_at
               AND v.created_at > p.created_at - INTERVAL '21 days'
             ORDER BY v.created_at DESC LIMIT 1) AS davor
      FROM fiaon_postmeister p
      JOIN fiaon_applications a ON a.ref = p.ref AND a.merged_into IS NULL
      JOIN fiaon_persons pe ON pe.id = p.person_id
     WHERE COALESCE(p.empfangen_am, p.created_at) > NOW() - (${NACHHOL_TAGE} || ' days')::interval
       AND p.person_id IS NOT NULL AND p.ref IS NOT NULL AND p.text IS NOT NULL AND p.aktion <> 'ignoriert'
       AND pe.ist_test_am IS NULL
       AND a.gekuendigt_am IS NULL AND a.kuendigung_zurueckgenommen_am IS NULL
       AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'canceled', 'storniert', 'refunded')
       AND COALESCE(a.status, '') NOT IN ('cancelled', 'canceled', 'storniert')
       AND EXISTS (SELECT 1 FROM fiaon_postmeister k
                    WHERE k.ref = p.ref AND k.created_at > NOW() - (${NACHHOL_TAGE} || ' days')::interval
                      AND (k.kategorie = 'kuendigung' OR k.handlungen::text LIKE '%kuendigung_vormerken%'))
     ORDER BY COALESCE(p.empfangen_am, p.created_at), p.id`) as any[];
  return nachholFaelle(zeilen.filter((z) => !istGlobalPaket(z.pack_key)).map((z) => ({
    id: Number(z.id), personId: Number(z.person_id), ref: String(z.ref), text: String(z.text ?? ""), empfangenAm: new Date(z.am).toISOString(),
    davor: z.davor ?? null, flags: jsonObjekt(z.flags), bezahlt: z.bezahlt === true,
  })), { nurVor: NACHHOL_NUR_VOR });
}

async function merkerLesen(lauf: Lauf): Promise<Record<string, string>> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${KN.fehler}`.catch(() => [])) as any[];
  return (jsonObjekt(z?.value) ?? {}) as Record<string, string>;
}
async function merkerSchreiben(lauf: Lauf, schluessel: string, wert: unknown): Promise<void> {
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, ${JSON.stringify(wert)}, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`.catch(() => {});
}

export interface NachholErgebnis { modus: NachholModus; faelle: number; bezahlt: number; unbezahlt: number; zurueck: number; gebucht: number; fehler: number }

/**
 * Der Lauf: rechnet den Plan (immer, außer „aus“) und bucht bei „an“ höchstens fünf Fälle. Der Plan (ohne Kundentext:
 * Mail-Nummer, Person, Bestellung, Tag, Art) liegt in fiaon_settings „kuendigung_nachholen_plan“. Wirft nie.
 */
export async function nachholLauf(o: { lauf?: Lauf } = {}): Promise<NachholErgebnis> {
  const lauf = o.lauf ?? sqlPool;
  const modus = await nachholModus(lauf);
  const leer: NachholErgebnis = { modus, faelle: 0, bezahlt: 0, unbezahlt: 0, zurueck: 0, gebucht: 0, fehler: 0 };
  if (modus === "aus") return leer;
  try {
    const { faelle, zurueck } = await nachholFaelleLesen(lauf);
    const fehler = await merkerLesen(lauf);
    await merkerSchreiben(lauf, KN.plan, {
      stand: new Date().toISOString(), modus,
      faelle: faelle.map((f) => ({ mail: f.postmeisterId, person: f.personId, ref: f.ref, am: f.am.slice(0, 10), art: f.art, bezahlt: f.bezahlt, fehler: fehler[String(f.postmeisterId)] ?? null })),
      zurueckgenommen: zurueck.length,
    });
    const erg: NachholErgebnis = { ...leer, faelle: faelle.length, bezahlt: faelle.filter((f) => f.bezahlt).length, unbezahlt: faelle.filter((f) => !f.bezahlt).length, zurueck: zurueck.length };
    if (modus !== "an") return erg;
    const { kuendigungDurchfuehren } = await import("../routes/fiaon-kuendigung");
    for (const f of faelle.filter((x) => !fehler[String(x.postmeisterId)]).slice(0, NACHHOL_JE_LAUF)) {
      const tag = new Date(f.am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
      const r = await kuendigungDurchfuehren(f.ref, {
        quelle: "mail", am: f.am, postmeisterId: f.postmeisterId, personId: f.personId, widerrufErwaehnt: f.widerruf,
        grund: `${f.grund ? `${f.grund} ` : ""}(aus seiner E-Mail vom ${tag} nachgeholt — Mara, E-499)`.slice(0, 300),
        unterzeichner: { name: "FIAON LTD", rolle: "automatisch erstellt (digitale Assistentin Mara, E-Mail)" },
      }).catch((e: any) => ({ ok: false, grund: String(e?.message || e).slice(0, 200) }));
      if (!r?.ok) {
        fehler[String(f.postmeisterId)] = String(r?.grund || "nicht gebucht").slice(0, 200);
        erg.fehler++;
        console.warn(`[KUENDIGUNG-NACHHOLEN] Mail #${f.postmeisterId}: nicht gebucht — ${fehler[String(f.postmeisterId)]}`);
        continue;
      }
      erg.gebucht++;
      console.log(`[KUENDIGUNG-NACHHOLEN] Mail #${f.postmeisterId}: gebucht (${r.weg ?? "ok"}).`);
      await entwuerfeMitRueckfrageAblegen(f.personId, lauf).catch(() => {});
    }
    if (erg.fehler) await merkerSchreiben(lauf, KN.fehler, fehler);
    return erg;
  } catch (err) {
    console.error("[KUENDIGUNG-NACHHOLEN]", String((err as Error)?.message ?? err).slice(0, 200));
    return leer;
  }
}

/** Wartende Antwort-Entwürfe dieses Kunden, die noch nach der Kündigung fragen — nach der Buchung nicht mehr senden. */
async function entwuerfeMitRueckfrageAblegen(personId: number, lauf: Lauf): Promise<number> {
  const offen = (await lauf`
    SELECT id, betreff, antwort FROM fiaon_postmeister
     WHERE person_id = ${personId} AND aktion = 'entwurf' AND gesendet_am IS NULL AND antwort IS NOT NULL`) as any[];
  const { entwurfAblegen } = await import("./fiaon-postmeister-frist");
  let n = 0;
  for (const z of offen) {
    if (!austrittsFrageGestellt(z.antwort)) continue;
    if (await entwurfAblegen({ id: Number(z.id), betreff: z.betreff ?? null } as any, "die Kündigung ist inzwischen gebucht (E-499)", "Mara (Kündigung nachgeholt)").catch(() => false)) n++;
  }
  return n;
}

/** Für den Zeitplan (stillerLauf): eine Historienzeile bei Buchungen oder Fehlern und als Puls alle 6 Stunden. */
let letzterPuls = 0;
export async function nachholTakt(): Promise<boolean> {
  const e = await nachholLauf();
  if (e.gebucht || e.fehler) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls > 6 * 3600_000) { letzterPuls = Date.now(); return true; }
  return false;
}
