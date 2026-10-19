// ═══════════════════════════════════════════════════════════════════════════
// DIE STICHPROBE — JEDE WOCHE 20 MARA-HANDLUNGEN FÜR DIE TRAINERIN (E-406 B3, 19.10.2026)
//
// Justin, Vorschlag 3: „Die Stichprobe macht ein Mensch: 10 Minuten pro Woche, 20 Fälle. Vorschlag: Diana als
// Trainerin (E-161).“ Ort: die Seite der Schulungsleitung (/agent/schulung) — keine neue Seite.
//
//   · Ziehen: montags (oder beim ersten Öffnen der Woche) 20 Handlungen der VORWOCHE aus derselben Liste wie
//     „Mara heute“ (handlungenLesen, fiaon-mara-heute.ts) — gleichmäßig über die Werkzeuge (stichprobeZiehen, rein).
//     Testpersonen fallen heraus. Einmal je Woche (Sperre per Advisory-Lock, eindeutig je Woche und Quelle).
//   · Datensparsam: Die Tabelle merkt sich nur WELCHE Handlung (Quelle, Nummer, Person) — keine Kopie von Kunden-
//     oder Mara-Texten. Die Texte liest die Seite beim Öffnen aus der Quelle (texteLesen); ist sie gelöscht, steht da
//     „nicht mehr vorhanden“. So bleibt keine zweite Abschrift, wenn ein Kunde seine Daten löschen lässt.
//   · Bewerten: ok oder nicht ok, bei „nicht ok“ mit Grund (urteilPruefen). Ändern geht, wer zuletzt bewertet hat, steht da.
//   · Fehlerquote je Werkzeug (fehlerquoten, rein) — auf dieser Seite und in der Ampel im Mara-Steuerpult; dort auch
//     der Vorschlag „auf Grün“ nach 4 Wochen unter 2 % (aufstiegVorschlag) — nur ein Vorschlag, kein Automatismus.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  HANDLUNG_ARTEN, MARA_AMPEL, STICHPROBE_ZAHL, AUFSTIEG_WOCHEN,
  aufstiegVorschlag, fehlerquoten, stichprobeZiehen, urteilPruefen, wocheBerlin, wochePlus,
  type AmpelKey, type AmpelStand, type AufstiegUrteil, type WerkzeugQuote,
} from "@shared/fiaon-mara-ampel";
import { handlungenLesen, type Handlung } from "./fiaon-mara-heute";

type Lauf = typeof sqlPool;

let bereit: Promise<void> | null = null;
export function stichprobeTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_mara_stichprobe (
          id BIGSERIAL PRIMARY KEY,
          woche DATE NOT NULL,
          werkzeug TEXT NOT NULL,
          art TEXT NOT NULL,
          quelle TEXT NOT NULL,
          quelle_id TEXT NOT NULL,
          person_id INTEGER,
          kanal TEXT,
          am TIMESTAMPTZ,
          urteil TEXT,
          grund TEXT,
          bewertet_von TEXT,
          bewertet_von_id INTEGER,
          bewertet_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (woche, quelle, quelle_id)
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_mara_stichprobe_woche ON fiaon_mara_stichprobe (woche, werkzeug)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Montag 00:00 Berlin einer Woche (YYYY-MM-DD) als Zeitpunkt. */
async function wocheBeginn(woche: string, lauf: Lauf): Promise<Date> {
  const [z] = (await lauf.unsafe(`SELECT ($1::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS ab`, [woche])) as any[];
  return new Date(z.ab);
}

/** Die Kandidaten einer Woche: alle stichproben-fähigen Handlungen mit Werkzeug. */
export async function kandidatenLesen(woche: string, lauf: Lauf = sqlPool): Promise<(Handlung & { werkzeug: AmpelKey })[]> {
  const von = await wocheBeginn(woche, lauf);
  const bis = await wocheBeginn(wochePlus(woche, 1), lauf);
  const h = await handlungenLesen(von, bis, { lauf, mitText: true });
  return h.filter((x): x is Handlung & { werkzeug: AmpelKey } => !!x.werkzeug && !!HANDLUNG_ARTEN[x.art]?.stichprobe);
}

/**
 * Die Stichprobe der laufenden Woche ziehen, wenn es sie noch nicht gibt — aus den Handlungen der VORWOCHE.
 * Liefert die Zahl der Fälle der Woche (gezogen oder schon da). `zufall` und `jetzt` sind austauschbar (Prüfstand).
 */
export async function stichprobeZiehenWennFaellig(o: { lauf?: Lauf; jetzt?: Date; zufall?: () => number } = {}): Promise<{ woche: string; neu: number; gesamt: number }> {
  const lauf = o.lauf ?? sqlPool;
  await stichprobeTabelle(lauf);
  const woche = wocheBerlin(o.jetzt ?? new Date());
  return await lauf.begin(async (tx: any) => {
    // Nur EIN Ziehen je Woche, auch wenn zwei Instanzen gleichzeitig kommen.
    await tx`SELECT pg_advisory_xact_lock(406003)`;
    const [da] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_mara_stichprobe WHERE woche = ${woche}::date`) as any[];
    if (Number(da?.n) > 0) return { woche, neu: 0, gesamt: Number(da.n) };
    const kandidaten = await kandidatenLesen(wochePlus(woche, -1), tx);
    const zug = stichprobeZiehen(kandidaten, STICHPROBE_ZAHL, o.zufall ?? Math.random);
    let neu = 0;
    for (const h of zug) {
      const r = (await tx`
        INSERT INTO fiaon_mara_stichprobe (woche, werkzeug, art, quelle, quelle_id, person_id, kanal, am)
        VALUES (${woche}::date, ${h.werkzeug}, ${h.art}, ${h.quelle}, ${h.quelleId}, ${h.personId}, ${h.kanal}, ${h.am})
        ON CONFLICT (woche, quelle, quelle_id) DO NOTHING RETURNING id`) as any[];
      neu += r.length;
    }
    if (neu) console.log(`[MARA-STICHPROBE] Woche ab ${woche}: ${neu} Fälle gezogen (aus ${kandidaten.length}).`);
    return { woche, neu, gesamt: neu };
  });
}

export interface StichprobeFall {
  id: number; woche: string; werkzeug: string; werkzeugText: string; art: string; artText: string; quelle: string; quelleId: string;
  personId: number | null; name: string | null; kanal: string | null; am: string | null; titel: string | null;
  kundeText: string | null; maraText: string | null;
  urteil: "ok" | "nicht_ok" | null; grund: string | null; bewertetVon: string | null; bewertetAm: string | null;
}

const NAME_SQL = `NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(p.first_name), ''), NULLIF(TRIM(p.last_name), ''))), '')`;
const isoOderNull = (v: unknown) => (v ? new Date(v as any).toISOString() : null);
const wocheText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 10));

/** Kunden- und Mara-Text je Fall — aus der Quelle gelesen (keine Abschrift in der Stichprobe). */
type Texte = { titel: string | null; kunde: string | null; mara: string | null };
const T = (v: unknown, n: number) => (v == null || v === "" ? null : String(v).slice(0, n));

export async function texteLesen(faelle: { quelle: string; quelle_id: string }[], lauf: Lauf = sqlPool): Promise<Map<string, Texte>> {
  const aus = new Map<string, Texte>();
  const ids = (q: string) => faelle.filter((f) => f.quelle === q).map((f) => f.quelle_id);
  const zahlen = (l: string[]) => l.map((x) => Number(String(x).split(":")[0])).filter((n) => Number.isInteger(n) && n > 0);
  const { tabellenDa } = await import("./fiaon-mara-heute");
  const da = await tabellenDa(lauf);
  const kundeWa = (nummer: string, bis: string) => `(SELECT r.text FROM fiaon_whatsapp r WHERE r.nummer = ${nummer} AND r.richtung = 'rein'
      AND COALESCE(r.empfangen_am, r.created_at) <= ${bis} ORDER BY COALESCE(r.empfangen_am, r.created_at) DESC LIMIT 1)`;
  const pm = zahlen([...ids("postmeister"), ...ids("postmeister_ablage"), ...ids("postmeister_handlung")]);
  if (pm.length && da.fiaon_postmeister) {
    const z = (await lauf.unsafe(`SELECT id, betreff, text, antwort, begruendung, handlungen FROM fiaon_postmeister WHERE id = ANY($1::int[])`, [pm])) as any[];
    const je = new Map(z.map((r) => [Number(r.id), r]));
    for (const id of ids("postmeister")) { const r = je.get(Number(id)); if (r) aus.set(`postmeister:${id}`, { titel: T(r.betreff, 200), kunde: T(r.text, 1500), mara: T(r.antwort, 2500) }); }
    for (const id of ids("postmeister_ablage")) { const r = je.get(Number(id)); if (r) aus.set(`postmeister_ablage:${id}`, { titel: T(r.betreff, 200), kunde: T(r.text, 1500), mara: T(r.begruendung, 600) }); }
    for (const qid of ids("postmeister_handlung")) {
      const [id, werkzeug] = String(qid).split(":");
      const r = je.get(Number(id));
      if (!r) continue;
      let h: any[] = [];
      try { const v = typeof r.handlungen === "string" ? JSON.parse(r.handlungen) : r.handlungen; h = Array.isArray(v) ? v : typeof v === "string" ? JSON.parse(v) : []; } catch { h = []; }
      const e = h.find((x) => x?.werkzeug === werkzeug);
      aus.set(`postmeister_handlung:${qid}`, { titel: T(r.betreff, 200), kunde: T(r.text, 1500), mara: T(e?.ergebnis, 1500) });
    }
  }
  const wa = zahlen(ids("whatsapp"));
  if (wa.length && da.fiaon_whatsapp) {
    const z = (await lauf.unsafe(`SELECT w.id, w.text, ${kundeWa("w.nummer", "COALESCE(w.gesendet_am, w.created_at)")} AS kunde FROM fiaon_whatsapp w WHERE w.id = ANY($1::bigint[])`, [wa])) as any[];
    for (const r of z) aus.set(`whatsapp:${r.id}`, { titel: null, kunde: T(r.kunde, 1500), mara: T(r.text, 2500) });
  }
  const ak = zahlen(ids("aktion"));
  if (ak.length && da.fiaon_mara_aktion) {
    const z = (await lauf.unsafe(`SELECT id, betreff, text FROM fiaon_mara_aktion WHERE id = ANY($1::int[])`, [ak])) as any[];
    for (const r of z) aus.set(`aktion:${r.id}`, { titel: T(r.betreff, 200), kunde: null, mara: T(r.text, 2500) });
  }
  const pr = zahlen(ids("protokoll"));
  if (pr.length && da.fiaon_mara_protokoll) {
    const z = (await lauf.unsafe(`SELECT p.id, p.text, (CASE WHEN p.nummer IS NULL THEN NULL ELSE ${kundeWa("p.nummer", "p.am")} END) AS kunde
                                    FROM fiaon_mara_protokoll p WHERE p.id = ANY($1::bigint[])`, [pr])) as any[];
    for (const r of z) aus.set(`protokoll:${r.id}`, { titel: null, kunde: T(r.kunde, 1500), mara: T(r.text, 1500) });
  }
  const an = zahlen(ids("angaben"));
  if (an.length && da.fiaon_mara_angaben) {
    const z = (await lauf.unsafe(`SELECT id, feld, vorher, nachher, stand FROM fiaon_mara_angaben WHERE id = ANY($1::bigint[])`, [an])) as any[];
    for (const r of z) aus.set(`angaben:${r.id}`, { titel: T(r.feld, 40), kunde: null, mara: T(`${r.feld}: ${r.vorher ?? "—"} → ${r.nachher ?? "—"} (${r.stand})`, 600) });
  }
  const fu = zahlen(ids("funde"));
  if (fu.length && da.fiaon_mara_zahlung_funde) {
    const z = (await lauf.unsafe(`SELECT id, stand, wege, quelle FROM fiaon_mara_zahlung_funde WHERE id = ANY($1::bigint[])`, [fu])) as any[];
    for (const r of z) aus.set(`funde:${r.id}`, { titel: T(r.stand, 40), kunde: null, mara: T(`${r.wege}${r.quelle ? ` · ${r.quelle}` : ""}`, 600) });
  }
  const nf = ids("nachfass");
  if (nf.length && da.fiaon_nicht_erreicht_nachfass) {
    const z = (await lauf.unsafe(`SELECT person_id, to_char(vorgemerkt_am, 'YYYYMMDDHH24MISS') AS ts, grund FROM fiaon_nicht_erreicht_nachfass WHERE person_id = ANY($1::int[])`, [zahlen(nf)])) as any[];
    for (const r of z) aus.set(`nachfass:${r.person_id}:${r.ts}`, { titel: "Nach 2× nicht erreicht", kunde: null, mara: T(r.grund, 600) });
  }
  return aus;
}

function fallAusZeile(z: any): StichprobeFall {
  const w = MARA_AMPEL.find((x) => x.key === z.werkzeug);
  const a = (HANDLUNG_ARTEN as Record<string, { eins: string }>)[String(z.art)];
  return {
    id: Number(z.id), woche: wocheText(z.woche), werkzeug: String(z.werkzeug), werkzeugText: w?.label ?? String(z.werkzeug),
    art: String(z.art), artText: a?.eins ?? String(z.art), quelle: String(z.quelle), quelleId: String(z.quelle_id),
    personId: z.person_id != null ? Number(z.person_id) : null, name: z.name ?? null, kanal: z.kanal ?? null, am: isoOderNull(z.am),
    titel: z.titel ?? null, kundeText: z.kunde_text ?? null, maraText: z.mara_text ?? (z.texte_fehlen ? "(nicht mehr vorhanden)" : null),
    urteil: z.urteil === "ok" || z.urteil === "nicht_ok" ? z.urteil : null, grund: z.grund ?? null,
    bewertetVon: z.bewertet_von ?? null, bewertetAm: isoOderNull(z.bewertet_am),
  };
}

/** Die Fälle einer Woche (Vorgabe: die laufende). */
export async function stichprobeLesen(woche: string, lauf: Lauf = sqlPool): Promise<StichprobeFall[]> {
  await stichprobeTabelle(lauf);
  const z = (await lauf.unsafe(`
    SELECT s.*, ${NAME_SQL} AS name FROM fiaon_mara_stichprobe s LEFT JOIN fiaon_persons p ON p.id = s.person_id
     WHERE s.woche = $1::date ORDER BY s.werkzeug, s.am DESC, s.id`, [woche])) as any[];
  const texte = await texteLesen(z.map((r) => ({ quelle: String(r.quelle), quelle_id: String(r.quelle_id) })), lauf).catch(() => new Map<string, Texte>());
  return z.map((r) => {
    const t = texte.get(`${r.quelle}:${r.quelle_id}`);
    return fallAusZeile({ ...r, titel: t?.titel ?? null, kunde_text: t?.kunde ?? null, mara_text: t?.mara ?? null, texte_fehlen: !t });
  });
}

/** Ein Urteil speichern (auch ändern). */
export async function stichprobeBewerten(id: number, urteil: unknown, grund: unknown, wer: { name: string; id: number | null }, lauf: Lauf = sqlPool): Promise<{ ok: boolean; status: number; error?: string; fall?: StichprobeFall }> {
  await stichprobeTabelle(lauf);
  const fehler = urteilPruefen(urteil, grund);
  if (fehler) return { ok: false, status: 400, error: fehler };
  const g = String(grund ?? "").trim().slice(0, 600) || null;
  const [z] = (await lauf`
    UPDATE fiaon_mara_stichprobe SET urteil = ${String(urteil)}, grund = ${g}, bewertet_von = ${wer.name.slice(0, 120)},
           bewertet_von_id = ${wer.id}, bewertet_am = NOW()
     WHERE id = ${id} RETURNING id`) as any[];
  if (!z) return { ok: false, status: 404, error: "Diesen Fall gibt es nicht." };
  const [neu] = (await lauf.unsafe(`SELECT s.*, ${NAME_SQL} AS name FROM fiaon_mara_stichprobe s LEFT JOIN fiaon_persons p ON p.id = s.person_id WHERE s.id = $1`, [id])) as any[];
  const texte = await texteLesen([{ quelle: String(neu.quelle), quelle_id: String(neu.quelle_id) }], lauf).catch(() => new Map<string, Texte>());
  const t = texte.get(`${neu.quelle}:${neu.quelle_id}`);
  return { ok: true, status: 200, fall: fallAusZeile({ ...neu, titel: t?.titel ?? null, kunde_text: t?.kunde ?? null, mara_text: t?.mara ?? null, texte_fehlen: !t }) };
}

/**
 * Fehlerquoten je Werkzeug über die letzten `wochen` VOLLEN Wochen (neueste zuerst; die laufende Woche zählt nicht —
 * sie wird ja noch bewertet) und die laufende Woche getrennt.
 */
export async function quotenLesen(o: { lauf?: Lauf; jetzt?: Date; wochen?: number } = {}): Promise<{ wochen: string[]; quoten: WerkzeugQuote[]; laufend: WerkzeugQuote[] }> {
  const lauf = o.lauf ?? sqlPool;
  await stichprobeTabelle(lauf);
  const diese = wocheBerlin(o.jetzt ?? new Date());
  const n = Math.max(AUFSTIEG_WOCHEN, o.wochen ?? 8);
  const wochen = Array.from({ length: n }, (_, i) => wochePlus(diese, -(i + 1)));
  const z = (await lauf`
    SELECT werkzeug, woche, urteil FROM fiaon_mara_stichprobe
     WHERE woche >= ${wochen[wochen.length - 1]}::date AND urteil IS NOT NULL`) as any[];
  const bew = z.map((r) => ({ werkzeug: String(r.werkzeug), woche: wocheText(r.woche), urteil: String(r.urteil) }));
  return { wochen, quoten: fehlerquoten(bew, wochen), laufend: fehlerquoten(bew, [diese]) };
}

export interface AmpelStichprobe { werkzeug: AmpelKey; quote4: { n: number; nichtOk: number; quote: number | null }; aufstieg: AufstiegUrteil }

/** Für die Ampel: Quote der letzten 4 vollen Wochen je Werkzeug und der Vorschlag Gelb → Grün. */
export async function ampelStichprobe(stand: AmpelStand, o: { lauf?: Lauf; jetzt?: Date } = {}): Promise<AmpelStichprobe[]> {
  const { quoten } = await quotenLesen({ lauf: o.lauf, jetzt: o.jetzt, wochen: AUFSTIEG_WOCHEN });
  return MARA_AMPEL.map((w) => {
    const q = quoten.find((x) => x.werkzeug === w.key);
    const wochen = q?.wochen ?? [];
    const n = wochen.reduce((s, x) => s + x.n, 0), f = wochen.reduce((s, x) => s + x.nichtOk, 0);
    return { werkzeug: w.key, quote4: { n, nichtOk: f, quote: n ? Math.round((f / n) * 1000) / 1000 : null }, aufstieg: aufstiegVorschlag(stand[w.key], wochen) };
  });
}
