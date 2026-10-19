// ═══════════════════════════════════════════════════════════════════════════
// DER GROSSE HAUSPUTZ — PROBELAUF, LAUF, ZURÜCKHOLEN (E-397, 19.10.2026)
//
// Die Regeln stehen rein in shared/fiaon-hausputz-regeln.ts. Hier läuft, was die
// Datenbank braucht:
//   hausputzProbelauf()   zählt je Regel, ändert NICHTS an Aufgaben; legt nur eine
//                         Zeile mit den Zahlen in fiaon_hausputz_laeufe ab (das
//                         Lagezimmer zeigt sie). Täglich und nach jedem Start.
//   hausputzAusfuehren()  der echte Lauf — NUR mit Freigabe (HAUSPUTZ_FREIGABE, ein
//                         Commit nach Justins „go“ im Chat), genau einmal je Freigabe.
//                         Jede Änderung steht mit dem Zustand VORHER in
//                         fiaon_hausputz_log (dieselbe Transaktion wie die Änderung).
//   hausputzZurueckholen() holt zurück — je Regel, je Lauf oder je Zeile, 30 Tage lang.
//                         Ein zurückgeholter Auftrag gilt als „von Hand wieder geöffnet“:
//                         Kein Ereignis und kein Hausputz schließt ihn danach wieder.
// Produktion wird nie per Skript vom Mac beschrieben (Gedächtnis: mac-last-und-
// produktionsschreiben) — der Lauf ist Plattform-Code.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  HAUSPUTZ_REGELN, hausputzAuftraegeSql, hausputzBewerten, hausputzRegel, hausputzRueckrufeSql, hausputzVermerkeSql, hausputzZaehlen,
  type HausputzDaten, type HausputzEntscheid, type HausputzZahlen,
} from "../../shared/fiaon-hausputz-regeln";

type Lauf = typeof sqlPool;

/**
 * DIE FREIGABE. null = nur Probelauf. Nach Justins „go“ im Chat wird hier in einem eigenen Commit ein Text
 * eingetragen (z. B. „2026-10-20 go Justin (Chat)“) — dann läuft der Hausputz genau einmal auf der Plattform.
 */
export const HAUSPUTZ_FREIGABE: string | null = null;

/** So lange lässt sich eine Änderung des Hausputzes zurückholen. */
export const ZURUECK_TAGE = 30;

let bereit: Promise<void> | null = null;
/** Dieselbe DDL wie db/migrations/113_hausputz.sql — die DDL-Wache prüft vorher im Katalog. */
export function ensureHausputzTabellen(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_hausputz_laeufe (
          id SERIAL PRIMARY KEY,
          art VARCHAR(20) NOT NULL,
          freigabe TEXT,
          gestartet_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          fertig_am TIMESTAMPTZ,
          zahlen JSONB,
          fehler TEXT
        )`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_hausputz_log (
          id BIGSERIAL PRIMARY KEY,
          lauf_id INTEGER NOT NULL,
          tabelle VARCHAR(20) NOT NULL,
          zeile_id INTEGER NOT NULL,
          regel VARCHAR(40) NOT NULL,
          aktion VARCHAR(20) NOT NULL,
          ziel_id INTEGER,
          vorher JSONB,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          zurueck_am TIMESTAMPTZ,
          zurueck_von TEXT
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_hausputz_log_lauf_idx ON fiaon_hausputz_log (lauf_id, regel)`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_hausputz_log_zeile_idx ON fiaon_hausputz_log (tabelle, zeile_id)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Die Kandidaten lesen (drei reine SELECTs, je höchstens 60 s). */
export async function hausputzDaten(lauf: Lauf = sqlPool): Promise<HausputzDaten> {
  const lesen = (sql: string) => lauf.begin("READ ONLY", async (tx: any) => {
    await tx.unsafe("SET LOCAL statement_timeout = 60000");
    return (await tx.unsafe(sql)) as any[];
  }) as Promise<any[]>;
  const auftraege = await lesen(hausputzAuftraegeSql());
  const vermerke = await lesen(hausputzVermerkeSql());
  const rueckrufe = await lesen(hausputzRueckrufeSql());
  return { auftraege, vermerke, rueckrufe };
}

export interface HausputzStand {
  probelauf: { id: number; am: string; zahlen: HausputzZahlen } | null;
  lauf: { id: number; am: string; fertigAm: string | null; freigabe: string | null; zahlen: any; fehler: string | null; zurueckBis: string | null } | null;
  freigabe: string | null;
  regeln: typeof HAUSPUTZ_REGELN;
}

/** Der Probelauf: zählt je Regel, ändert nichts an den Aufgaben. */
export async function hausputzProbelauf(lauf: Lauf = sqlPool): Promise<HausputzZahlen> {
  await ensureHausputzTabellen(lauf);
  const daten = await hausputzDaten(lauf);
  const zahlen = hausputzZaehlen(daten, hausputzBewerten(daten));
  await lauf`INSERT INTO fiaon_hausputz_laeufe (art, fertig_am, zahlen) VALUES ('probelauf', NOW(), ${lauf.json(zahlen as any)})`;
  console.log(`[HAUSPUTZ] Probelauf: ${zahlen.vorher.gesamt} offen → ${zahlen.nachher.gesamt} (bei Justin ${zahlen.vorher.beiJustin} → ${zahlen.nachher.beiJustin}), Rückrufe ${zahlen.vorher.rueckrufe} → ${zahlen.nachher.rueckrufe}.`);
  return zahlen;
}

/** Wer übernimmt einen Eintrag eines gesperrten Mitarbeiters? Betreuer, sonst passende Rolle — nie der Betreiber. */
async function nachfolger(root: number | null): Promise<{ id: number; name: string } | null> {
  if (!root) return null;
  const { auftragEmpfaenger } = await import("../routes/fiaon-betreiber-todo");
  const e = await auftragEmpfaenger(root).catch(() => null);
  return e?.id ? { id: Number(e.id), name: String(e.name || "Mitarbeiter") } : null;
}

/** Eine Entscheidung anwenden — Änderung und Protokoll in EINER Transaktion. false = nichts geändert (Lage hat sich bewegt). */
async function anwenden(laufId: number, e: HausputzEntscheid): Promise<boolean> {
  const regel = hausputzRegel(e.regel);
  if (!regel) return false;
  const grund = `Hausputz: ${regel.grund}`;
  const { auftragErledigen, auftragBeitrag, vermerkErledigen, ensureVermerkErledigtSpalten } = await import("./fiaon-auftraege");
  if (e.tabelle === "vermerk") await ensureVermerkErledigtSpalten();
  const ziel = e.aktion === "umhaengen" ? await nachfolger(e.root ?? null) : null;
  if (e.aktion === "umhaengen" && !ziel) return false;
  return (await sqlPool.begin(async (tx: any) => {
    const log = (vorher: any, zielId: number | null = null) => tx`
      INSERT INTO fiaon_hausputz_log (lauf_id, tabelle, zeile_id, regel, aktion, ziel_id, vorher)
      VALUES (${laufId}, ${e.tabelle}, ${e.id}, ${e.regel}, ${e.aktion}, ${zielId}, ${tx.json(vorher)})`;
    if (e.tabelle === "auftrag") {
      const [v] = (await tx`SELECT id, status, titel, eingang_am, created_at, zustaendig_art, zustaendig_agent_id, zustaendig_name, LEFT(text, 1500) AS text
                              FROM fiaon_betreiber_todos WHERE id = ${e.id} AND status <> 'erledigt' FOR UPDATE`) as any[];
      if (!v) return false;
      if (e.aktion === "umhaengen") {
        await tx`UPDATE fiaon_betreiber_todos SET zustaendig_art = 'agent', zustaendig_agent_id = ${ziel!.id}, zustaendig_name = ${ziel!.name},
                   delegiert_am = NOW(), agent_gelesen_am = NULL, updated_at = NOW() WHERE id = ${e.id}`;
        await auftragBeitrag(e.id, { autorArt: "system", autorName: "System (Hausputz)", art: "status", text: `${grund} — jetzt bei ${ziel!.name}.` }, tx, { doppeltErlaubt: true });
        await log({ zustaendig_art: v.zustaendig_art, zustaendig_agent_id: v.zustaendig_agent_id, zustaendig_name: v.zustaendig_name }, ziel!.id);
        return true;
      }
      if (e.aktion === "zusammenfuehren") {
        const [z] = (await tx`SELECT id FROM fiaon_betreiber_todos WHERE id = ${e.ziel ?? 0} AND status <> 'erledigt'`) as any[];
        if (!z) return false;
        const wann = new Date(v.eingang_am ?? v.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });
        await auftragBeitrag(Number(z.id), { autorArt: "system", autorName: "System (Hausputz)", art: "kommentar",
          text: `Zusammengeführt aus Auftrag #${e.id} („${String(v.titel || "").slice(0, 120)}“, Eingang ${wann}):\n${String(v.text || "").slice(0, 1500)}` }, tx, { doppeltErlaubt: true });
      }
      const ereignis = e.aktion === "zusammenfuehren" ? `${grund} — zusammengeführt in Auftrag #${e.ziel}` : grund;
      const zu = await auftragErledigen(e.id, { art: "hausputz", von: "System (Hausputz)", autorArt: "system", ereignis: ereignis.slice(0, 300), ergebnis: ereignis, beitragText: `${ereignis}. Zurückholen: „Wieder öffnen“ (30 Tage).` }, tx);
      if (!zu) return false;
      await log({ status: v.status }, e.ziel ?? null);
      return true;
    }
    if (e.tabelle === "vermerk") {
      const [v] = (await tx`SELECT id, status, text, created_at, zustaendig_agent_id, fuer_betreiber, sicht, sicht_agenten
                              FROM fiaon_vermerke WHERE id = ${e.id} AND status = 'offen' AND entfernt_am IS NULL FOR UPDATE`) as any[];
      if (!v) return false;
      if (e.aktion === "umhaengen") {
        await tx`UPDATE fiaon_vermerke SET zustaendig_agent_id = ${ziel!.id}, fuer_betreiber = FALSE,
                   sicht_agenten = CASE WHEN ${ziel!.id}::int = ANY(sicht_agenten) THEN sicht_agenten ELSE array_append(sicht_agenten, ${ziel!.id}::int) END,
                   updated_at = NOW() WHERE id = ${e.id}`;
        await log({ zustaendig_agent_id: v.zustaendig_agent_id, fuer_betreiber: v.fuer_betreiber, sicht_agenten: v.sicht_agenten }, ziel!.id);
        return true;
      }
      if (e.aktion === "zusammenfuehren") {
        const wann = new Date(v.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });
        const z = (await tx`UPDATE fiaon_vermerke SET text = text || ${`\n\n— Zusammengeführt aus Eintrag #${e.id} vom ${wann}: ${String(v.text || "").slice(0, 1500)}`}, updated_at = NOW()
                             WHERE id = ${e.ziel ?? 0} AND status = 'offen' RETURNING id`) as any[];
        if (!z.length) return false;
      }
      const g = e.aktion === "zusammenfuehren" ? `${grund} — zusammengeführt in Eintrag #${e.ziel}` : grund;
      const zu = await vermerkErledigen(e.id, { art: "hausputz", von: "System (Hausputz)", grund: g }, tx);
      if (!zu) return false;
      await log({ status: v.status }, e.ziel ?? null);
      return true;
    }
    // Rückruf-Wunsch
    const [r] = (await tx`SELECT id, status FROM fiaon_rueckrufe WHERE id = ${e.id} AND status = 'offen' FOR UPDATE`) as any[];
    if (!r) return false;
    await tx`UPDATE fiaon_rueckrufe SET status = 'erledigt', ergebnis_notiz = ${grund}, erledigt_am = NOW(), erledigt_von = 'System (Hausputz)', updated_at = NOW()
              WHERE id = ${e.id}`;
    await log({ status: r.status });
    return true;
  })) as boolean;
}

let laeuft = false;
/**
 * Der echte Lauf — nur mit Freigabe, genau einmal je Freigabe. Bewertet frisch (nicht die Zahlen des Probelaufs),
 * wendet jede Entscheidung einzeln an und schreibt am Ende die Zahlen (vorher, nachher, je Regel) in den Lauf.
 */
export async function hausputzAusfuehren(freigabe: string | null = HAUSPUTZ_FREIGABE): Promise<{ ok: boolean; grund?: string; laufId?: number; zahlen?: any }> {
  if (!freigabe) return { ok: false, grund: "keine Freigabe" };
  if (laeuft) return { ok: false, grund: "läuft schon" };
  laeuft = true;
  try {
    await ensureHausputzTabellen();
    const [schon] = (await sqlPool`SELECT id FROM fiaon_hausputz_laeufe WHERE art = 'lauf' AND freigabe = ${freigabe} LIMIT 1`) as any[];
    if (schon) return { ok: false, grund: "für diese Freigabe schon gelaufen", laufId: Number(schon.id) };
    const [l] = (await sqlPool`INSERT INTO fiaon_hausputz_laeufe (art, freigabe) VALUES ('lauf', ${freigabe}) RETURNING id`) as any[];
    const laufId = Number(l.id);
    console.log(`[HAUSPUTZ] Lauf #${laufId} beginnt (Freigabe: ${freigabe}).`);
    try {
      const daten = await hausputzDaten();
      const ent = hausputzBewerten(daten);
      const geplant = hausputzZaehlen(daten, ent);
      // Zusammenführen zuletzt: Erst wenn alles andere entschieden ist, steht fest, welches Ziel offen bleibt.
      const reihe = [...ent.filter((e) => e.aktion === "schliessen"), ...ent.filter((e) => e.aktion === "umhaengen"), ...ent.filter((e) => e.aktion === "zusammenfuehren")];
      const jeRegel: Record<string, { geplant: number; erledigt: number }> = {};
      let erledigt = 0, uebersprungen = 0;
      for (const e of reihe) {
        const z = (jeRegel[e.regel] ??= { geplant: 0, erledigt: 0 });
        z.geplant += 1;
        let ok = false;
        try { ok = await anwenden(laufId, e); } catch (err) { console.error(`[HAUSPUTZ] ${e.tabelle} #${e.id} (${e.regel}):`, String(err).slice(0, 200)); }
        if (ok) { z.erledigt += 1; erledigt += 1; } else uebersprungen += 1;
      }
      const nachDaten = await hausputzDaten();
      const zahlen = { geplant, erledigt, uebersprungen, jeRegel, nachher: { auftraege: nachDaten.auftraege.length, vermerke: nachDaten.vermerke.length, rueckrufe: nachDaten.rueckrufe.length, gesamt: nachDaten.auftraege.length + nachDaten.vermerke.length } };
      await sqlPool`UPDATE fiaon_hausputz_laeufe SET fertig_am = NOW(), zahlen = ${sqlPool.json(zahlen as any)} WHERE id = ${laufId}`;
      console.log(`[HAUSPUTZ] Lauf #${laufId} fertig: ${erledigt} geändert, ${uebersprungen} übersprungen; offen jetzt ${zahlen.nachher.gesamt}.`);
      return { ok: true, laufId, zahlen };
    } catch (err) {
      await sqlPool`UPDATE fiaon_hausputz_laeufe SET fertig_am = NOW(), fehler = ${String(err).slice(0, 500)} WHERE id = ${laufId}`.catch(() => {});
      throw err;
    }
  } finally {
    laeuft = false;
  }
}

/**
 * Zurückholen — je Lauf (alle Regeln), je Regel oder eine Zeile; nur, was jünger als ZURUECK_TAGE ist.
 * Aufträge öffnen über den EINEN Weg (auftragWiederOeffnen) mit „von <Name> wieder geöffnet“: Danach schließt
 * kein Ereignis und kein Hausputz sie wieder (Pendelschutz).
 */
export async function hausputzZurueckholen(ein: { laufId: number; regel?: string | null; logId?: number | null }, von: string): Promise<{ zurueck: number }> {
  await ensureHausputzTabellen();
  const zeilen = (await sqlPool`
    SELECT * FROM fiaon_hausputz_log
     WHERE lauf_id = ${ein.laufId} AND zurueck_am IS NULL AND am > NOW() - make_interval(days => ${ZURUECK_TAGE})
       AND (${ein.regel ?? null}::text IS NULL OR regel = ${ein.regel ?? null}::text)
       AND (${ein.logId ?? null}::bigint IS NULL OR id = ${ein.logId ?? null}::bigint)
     ORDER BY id DESC`) as any[];
  const { auftragWiederOeffnen } = await import("./fiaon-auftraege");
  let n = 0;
  for (const z of zeilen) {
    const vorher = typeof z.vorher === "string" ? JSON.parse(z.vorher) : (z.vorher ?? {});
    let ok = false;
    try {
      if (z.tabelle === "auftrag" && z.aktion === "umhaengen") {
        await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_art = ${vorher.zustaendig_art ?? "betreiber"}, zustaendig_agent_id = ${vorher.zustaendig_agent_id ?? null},
                        zustaendig_name = ${vorher.zustaendig_name ?? null}, updated_at = NOW() WHERE id = ${z.zeile_id}`;
        ok = true;
      } else if (z.tabelle === "auftrag") {
        ok = await auftragWiederOeffnen(Number(z.zeile_id), `von ${von} wieder geöffnet (Hausputz zurückgeholt)`, {});
      } else if (z.tabelle === "vermerk" && z.aktion === "umhaengen") {
        await sqlPool`UPDATE fiaon_vermerke SET zustaendig_agent_id = ${vorher.zustaendig_agent_id ?? null}, fuer_betreiber = ${!!vorher.fuer_betreiber},
                        sicht_agenten = ${vorher.sicht_agenten ?? []}::int[], updated_at = NOW() WHERE id = ${z.zeile_id}`;
        ok = true;
      } else if (z.tabelle === "vermerk") {
        const r = (await sqlPool`UPDATE fiaon_vermerke SET status = 'offen', erledigt_am = NULL, erledigt_von = NULL, erledigt_art = NULL, erledigt_grund = NULL, updated_at = NOW()
                                  WHERE id = ${z.zeile_id} AND status = 'erledigt' RETURNING id`) as any[];
        ok = r.length > 0;
      } else if (z.tabelle === "rueckruf") {
        const r = (await sqlPool`UPDATE fiaon_rueckrufe SET status = 'offen', ergebnis_notiz = NULL, erledigt_am = NULL, erledigt_von = NULL, updated_at = NOW()
                                  WHERE id = ${z.zeile_id} AND status = 'erledigt' RETURNING id`) as any[];
        ok = r.length > 0;
      }
    } catch (e) { console.error(`[HAUSPUTZ] Zurückholen #${z.id}:`, String(e).slice(0, 200)); }
    await sqlPool`UPDATE fiaon_hausputz_log SET zurueck_am = NOW(), zurueck_von = ${String(von).slice(0, 120)} WHERE id = ${z.id}`;
    if (ok) n += 1;
  }
  console.log(`[HAUSPUTZ] Zurückgeholt von ${von}: ${n} (Lauf #${ein.laufId}${ein.regel ? `, Regel ${ein.regel}` : ""}).`);
  return { zurueck: n };
}

/** Für das Lagezimmer: letzter Probelauf, letzter Lauf, Freigabe. */
export async function hausputzStand(lauf: Lauf = sqlPool): Promise<HausputzStand> {
  await ensureHausputzTabellen(lauf);
  const [p] = (await lauf`SELECT id, fertig_am, zahlen FROM fiaon_hausputz_laeufe WHERE art = 'probelauf' AND fertig_am IS NOT NULL ORDER BY id DESC LIMIT 1`) as any[];
  const [l] = (await lauf`SELECT id, gestartet_am, fertig_am, freigabe, zahlen, fehler FROM fiaon_hausputz_laeufe WHERE art = 'lauf' ORDER BY id DESC LIMIT 1`) as any[];
  const j = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
  return {
    probelauf: p ? { id: Number(p.id), am: new Date(p.fertig_am).toISOString(), zahlen: j(p.zahlen) } : null,
    lauf: l ? {
      id: Number(l.id), am: new Date(l.gestartet_am).toISOString(), fertigAm: l.fertig_am ? new Date(l.fertig_am).toISOString() : null,
      freigabe: l.freigabe ?? null, zahlen: j(l.zahlen), fehler: l.fehler ?? null,
      zurueckBis: new Date(new Date(l.gestartet_am).getTime() + ZURUECK_TAGE * 864e5).toISOString(),
    } : null,
    freigabe: HAUSPUTZ_FREIGABE,
    regeln: HAUSPUTZ_REGELN,
  };
}
