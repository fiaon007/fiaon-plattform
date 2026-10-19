// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN: VORPRÜFUNG, WER PRÜFT, UMHÄNGEN (E-406 B2, 19.10.2026)
//
// Die Regeln stehen rein in shared/fiaon-unterlagen-vorpruefung.ts. Hier läuft, was die Datenbank braucht:
//   vorpruefen()            nach Prüfung und Analyse einer Unterlage (anstossAusfuehren, fiaon-unterlagen.ts):
//                           Namensabgleich auf der Textschicht (ohne KI, ohne Ausweisbilder) + die Notiz in
//                           fiaon_unterlagen_vorpruefung (eine Zeile je Mensch und Unterlage). Wirft nie.
//   prueferLesen()          wer die Prüf-Aufgaben bekommt (Einstellung, sonst Vorschlag, sonst niemand).
//   umhaengenProbelauf()    wie viele alte Prüf-Aufgaben bei Justin umgehängt würden — ändert nichts.
//   umhaengenAusfuehren()   NUR mit dem Schalter (Standard AUS): hängt sie über den Hausputz-Motor (E-397) um —
//                           jede Änderung mit dem Zustand VORHER in fiaon_hausputz_log, 30 Tage zurückholbar
//                           (hausputzZurueckholen). Produktion wird nie per Skript beschrieben — das ist Plattform-Code.
// Mara gibt NIE frei: „Geprüft“ klickt weiter ein Mensch (kategorieGeprueft), Vier-Augen bleibt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  PRUEFER_EINSTELLUNG, UMHAENGEN_LAUF_ART, UMHAENGEN_REGEL, UMHAENGEN_SCHALTER, prueferWaehlen, umhaengenAn, umhaengenPasst,
  vorpruefName, vorpruefNotiz, type PrueferKandidat, type PrueferWahl, type VorpruefKategorie, type VorpruefUrteil, type Vorpruefung,
} from "@shared/fiaon-unterlagen-vorpruefung";
import { kycVertragLaeuftSql } from "@shared/fiaon-kyc-nachfordern";

type Lauf = typeof sqlPool;

// ───────────────────────────────────────────────────────────────────────────
// Die Tabelle der Vorprüfungen — NEU, darum Laufzeit-DDL mit kurzer Sperrfrist (E-254), Katalog zuerst.
// ───────────────────────────────────────────────────────────────────────────
let tabelleBereit: Promise<boolean> | null = null;
export function vorpruefTabelle(lauf: Lauf = sqlPool): Promise<boolean> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      const [t] = (await lauf`SELECT to_regclass('fiaon_unterlagen_vorpruefung') IS NOT NULL AS da`) as any[];
      if (t?.da) return true;
      await lauf.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_unterlagen_vorpruefung (
          person_id BIGINT NOT NULL,
          kategorie TEXT NOT NULL,
          notiz TEXT NOT NULL,
          ampel TEXT NOT NULL DEFAULT 'gelb',
          befund JSONB,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (person_id, kategorie))`;
      });
      return true;
    })().catch((e) => {
      console.error("[UNTERLAGEN-PRÜFER] Tabelle nicht bereit:", String(e?.message || e).slice(0, 200));
      tabelleBereit = null;
      return false;
    });
  }
  return tabelleBereit;
}

/** Text der ersten Seiten — nur die Textschicht (keine Texterkennung, keine KI, nie ein Ausweisbild). */
async function textschicht(pdf: Buffer): Promise<string | null> {
  try {
    if (!pdf?.length || !pdf.subarray(0, 1024).includes("%PDF", 0, "latin1")) return null;
    const { pdfTextJeSeite } = await import("./fiaon-pdf-lesen");
    const { ohneFotoVermerk } = await import("./fiaon-ocr");
    const seiten = await pdfTextJeSeite(pdf);
    // Ein Foto bekommt beim Wandeln einen Vermerk als Text („Vom Kunden als Bilddatei eingereicht …“) — der ist kein Inhalt.
    return ohneFotoVermerk(seiten.slice(0, 3).join("\n")).slice(0, 12_000);
  } catch {
    return null;
  }
}

/**
 * Die Vorprüfung einer Unterlage schreiben. `pdf` = die gebundene Akte-Fassung (Ausweis, Kontoauszug, Auskunft);
 * bei „Weitere“ oder ohne Fassung null. Wirft nie — die Vorprüfung hält keinen Upload und keine Aufgabe auf.
 */
export async function vorpruefen(
  personId: number, kategorie: VorpruefKategorie, urteil: VorpruefUrteil | null, pdf: Buffer | null, lauf: Lauf = sqlPool,
): Promise<Vorpruefung | null> {
  try {
    if (!(await vorpruefTabelle(lauf))) return null;
    let namePasst: boolean | null = null;
    if (pdf && kategorie !== "weitere") {
      const [p] = (await lauf`SELECT first_name, last_name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
      namePasst = vorpruefName(await textschicht(pdf), { vorname: p?.first_name ?? null, nachname: p?.last_name ?? null });
    }
    const vp = vorpruefNotiz({ kategorie, urteil, namePasst });
    const befund = {
      erkannt: urteil?.erkannt ?? null, vollstaendig: urteil?.vollstaendig ?? null, pruefbar: urteil?.pruefbar ?? null,
      klasse: urteil?.klasse ?? null, ausweisArt: urteil?.ausweisArt ?? null, namePasst,
    };
    await lauf`
      INSERT INTO fiaon_unterlagen_vorpruefung (person_id, kategorie, notiz, ampel, befund, am)
      VALUES (${personId}, ${kategorie}, ${vp.notiz}, ${vp.ampel}, ${lauf.json(befund as any)}, NOW())
      ON CONFLICT (person_id, kategorie) DO UPDATE SET notiz = EXCLUDED.notiz, ampel = EXCLUDED.ampel, befund = EXCLUDED.befund, am = NOW()`;
    return vp;
  } catch (e) {
    console.error("[UNTERLAGEN-PRÜFER] Vorprüfung:", String((e as Error)?.message || e).slice(0, 200));
    return null;
  }
}

/** Die Vorprüfungen eines Menschen je Unterlage (für Akte und Aufgabe). */
export async function vorpruefungenLesen(personId: number, lauf: Lauf = sqlPool): Promise<Record<string, { notiz: string; ampel: string; am: string }>> {
  try {
    const [t] = (await lauf`SELECT to_regclass('fiaon_unterlagen_vorpruefung') IS NOT NULL AS da`) as any[];
    if (!t?.da) return {};
    const rows = (await lauf`SELECT kategorie, notiz, ampel, am FROM fiaon_unterlagen_vorpruefung WHERE person_id = ${personId}`) as any[];
    const aus: Record<string, { notiz: string; ampel: string; am: string }> = {};
    for (const r of rows) aus[String(r.kategorie)] = { notiz: String(r.notiz), ampel: String(r.ampel || "gelb"), am: new Date(r.am).toISOString() };
    return aus;
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WER PRÜFT
// ═══════════════════════════════════════════════════════════════════════════
export async function prueferKandidaten(lauf: Lauf = sqlPool): Promise<PrueferKandidat[]> {
  const rows = (await lauf`
    SELECT ag.id, ag.name, ag.rolle, ag.admin_stufe,
           COALESCE(ag.active, TRUE) AS aktiv, (ag.zugang_gesperrt_am IS NOT NULL) AS gesperrt, COALESCE(ag.is_test_account, FALSE) AS test,
           (SELECT COUNT(*)::int FROM fiaon_dokumente d
             WHERE d.geprueft_von_agent_id = ag.id AND d.art = 'unterlage' AND d.geprueft_am > NOW() - INTERVAL '30 days') AS geprueft30
      FROM fiaon_agents ag
     WHERE ag.rolle IN ('vertriebsleiter', 'admin')
     ORDER BY ag.id`) as any[];
  return rows.map((r) => ({
    id: Number(r.id), name: String(r.name || `Mitarbeiter ${r.id}`), rolle: String(r.rolle || ""), stufe: r.admin_stufe ?? null,
    aktiv: !!r.aktiv, gesperrt: !!r.gesperrt, test: !!r.test, geprueft30: Number(r.geprueft30 || 0),
  }));
}

/** Die eingestellte Person (fiaon_settings) — null, wenn keine eingestellt ist. */
async function eingestellt(lauf: Lauf = sqlPool): Promise<number | null> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${PRUEFER_EINSTELLUNG}`.catch(() => [])) as any[];
  const n = Number(String(z?.value ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Wer bekommt die Prüf-Aufgaben? null = niemand passt — dann bleibt es (wie bisher) beim Betreiber. Wirft nie. */
export async function prueferLesen(lauf: Lauf = sqlPool): Promise<PrueferWahl | null> {
  try {
    return prueferWaehlen(await prueferKandidaten(lauf), await eingestellt(lauf));
  } catch (e) {
    console.error("[UNTERLAGEN-PRÜFER] Prüfer nicht lesbar:", String((e as Error)?.message || e).slice(0, 160));
    return null;
  }
}

/** Im Chefbüro gewählt (null = zurück auf den Vorschlag). Nur erlaubte Personen. */
export async function prueferSetzen(agentId: number | null): Promise<{ ok: boolean; grund?: string }> {
  if (agentId == null) {
    await sqlPool`DELETE FROM fiaon_settings WHERE key = ${PRUEFER_EINSTELLUNG}`;
    return { ok: true };
  }
  const k = (await prueferKandidaten()).find((x) => x.id === agentId);
  const { darfPruefen } = await import("@shared/fiaon-unterlagen-vorpruefung");
  if (!k || !darfPruefen(k)) return { ok: false, grund: "Diese Person kann die Unterlagen nicht prüfen (nur Leitung, aktiv, nicht der Inhaber)." };
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${PRUEFER_EINSTELLUNG}, ${String(agentId)})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// UMHÄNGEN DER ALTEN PRÜF-AUFGABEN — Schalter, Probelauf, Lauf (Hausputz-Motor)
// ═══════════════════════════════════════════════════════════════════════════
export async function umhaengenSchalterLesen(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${UMHAENGEN_SCHALTER}`) as any[];
    return umhaengenAn(z?.value);
  } catch {
    return false;
  }
}

export async function umhaengenSchalterSetzen(an: boolean): Promise<void> {
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${UMHAENGEN_SCHALTER}, ${an ? "an" : "aus"})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

/** Die offenen „Unterlagen eingegangen“ mit allem, was umhaengenPasst braucht (ein reines SELECT). */
export async function umhaengenZeilen(lauf: Lauf = sqlPool): Promise<{ id: number; personId: number | null; passt: boolean }[]> {
  // Einmal zurückgeholt = bleibt, wo es ist: Der Takt hängt eine zurückgeholte Aufgabe nie wieder um (kein Pendeln).
  const [lg] = (await lauf`SELECT to_regclass('fiaon_hausputz_log') IS NOT NULL AS da`) as any[];
  const nieWieder = lg?.da
    ? `AND NOT EXISTS (SELECT 1 FROM fiaon_hausputz_log g WHERE g.tabelle = 'vermerk' AND g.zeile_id = v.id
                         AND g.regel = '${UMHAENGEN_REGEL}' AND g.zurueck_am IS NOT NULL)`
    : "";
  const rows = (await lauf.unsafe(`
    WITH v AS (
      SELECT v.id, v.text, v.status, (v.fuer_betreiber OR v.zustaendig_agent_id IS NULL) AS bei_justin,
             (SELECT a.person_id FROM fiaon_applications a WHERE a.ref = v.ref LIMIT 1) AS person_id
        FROM fiaon_vermerke v
       WHERE v.art = 'aufgabe' AND v.status = 'offen' AND v.entfernt_am IS NULL AND v.text LIKE 'Unterlagen eingegangen%'
         ${nieWieder}
    )
    SELECT v.id, v.text, v.status, v.bei_justin, v.person_id,
           (SELECT COUNT(*)::int FROM fiaon_dokumente d
             WHERE d.person_id = v.person_id AND d.art = 'unterlage' AND d.quelle = 'kunde'
               AND d.geprueft_am IS NULL AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL) AS ungeprueft,
           EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = v.person_id AND a.merged_into IS NULL
                     AND NOT COALESCE(a.ist_entwurf, FALSE) AND ${kycVertragLaeuftSql("a")}) AS laeuft,
           EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = v.person_id AND p.ist_test_am IS NOT NULL) AS test
      FROM v ORDER BY v.id`)) as any[];
  return rows.map((r) => ({
    id: Number(r.id), personId: r.person_id != null ? Number(r.person_id) : null,
    passt: umhaengenPasst({ text: String(r.text || ""), status: String(r.status || ""), beiJustin: !!r.bei_justin, ungeprueft: Number(r.ungeprueft || 0), vertragLaeuft: !!r.laeuft, test: !!r.test }),
  }));
}

/** Der Probelauf: wie viele alte Prüf-Aufgaben bei Justin gingen an die prüfende Person? Ändert nichts. */
export async function umhaengenProbelauf(lauf: Lauf = sqlPool): Promise<{ beiJustin: number; umhaengen: number; personen: number }> {
  const zeilen = await umhaengenZeilen(lauf);
  const passt = zeilen.filter((z) => z.passt);
  const [j] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_vermerke
                           WHERE art = 'aufgabe' AND status = 'offen' AND entfernt_am IS NULL AND text LIKE 'Unterlagen eingegangen%'
                             AND (fuer_betreiber OR zustaendig_agent_id IS NULL)`) as any[];
  return { beiJustin: Number(j?.n || 0), umhaengen: passt.length, personen: new Set(passt.map((z) => z.personId)).size };
}

let laeuft = false;
/**
 * Der Lauf — nur mit dem Schalter und mit einer prüfenden Person. Jede Zeile in EINER Transaktion: Umhängen und
 * Protokoll (fiaon_hausputz_log, regel „unterlagen_pruefer“, Zustand vorher) — so holt „Zurückholen“ (Hausputz-Motor)
 * jede Zeile 30 Tage lang zurück. Ein Lauf-Eintrag nur, wenn etwas umgehängt wurde.
 */
export async function umhaengenAusfuehren(opt: { von?: string; ohneSchalter?: boolean } = {}): Promise<{ ok: boolean; grund?: string; laufId?: number; umgehaengt: number; an?: string }> {
  if (laeuft) return { ok: false, grund: "läuft schon", umgehaengt: 0 };
  laeuft = true;
  try {
    if (!opt.ohneSchalter && !(await umhaengenSchalterLesen())) return { ok: false, grund: "Schalter aus", umgehaengt: 0 };
    const pruefer = await prueferLesen();
    if (!pruefer) return { ok: false, grund: "Niemand prüft Unterlagen — bitte eine Person wählen.", umgehaengt: 0 };
    const kandidaten = (await umhaengenZeilen()).filter((z) => z.passt);
    if (!kandidaten.length) return { ok: true, umgehaengt: 0, an: pruefer.name };
    const { ensureHausputzTabellen } = await import("./fiaon-hausputz");
    await ensureHausputzTabellen();
    const [l] = (await sqlPool`INSERT INTO fiaon_hausputz_laeufe (art, freigabe) VALUES (${UMHAENGEN_LAUF_ART}, ${`Schalter ${opt.von ?? "Chefbüro"}`.slice(0, 200)}) RETURNING id`) as any[];
    const laufId = Number(l.id);
    let n = 0;
    for (const z of kandidaten) {
      try {
        const ok = (await sqlPool.begin(async (tx: any) => {
          const [v] = (await tx`SELECT id, zustaendig_agent_id, fuer_betreiber, sicht_agenten FROM fiaon_vermerke
                                 WHERE id = ${z.id} AND status = 'offen' AND entfernt_am IS NULL AND (fuer_betreiber OR zustaendig_agent_id IS NULL)
                                 FOR UPDATE`) as any[];
          if (!v) return false;
          await tx`UPDATE fiaon_vermerke SET zustaendig_agent_id = ${pruefer.id}, fuer_betreiber = FALSE,
                     sicht_agenten = CASE WHEN ${pruefer.id}::int = ANY(sicht_agenten) THEN sicht_agenten ELSE array_append(sicht_agenten, ${pruefer.id}::int) END,
                     updated_at = NOW()
                   WHERE id = ${z.id}`;
          await tx`INSERT INTO fiaon_hausputz_log (lauf_id, tabelle, zeile_id, regel, aktion, ziel_id, vorher)
                   VALUES (${laufId}, 'vermerk', ${z.id}, ${UMHAENGEN_REGEL}, 'umhaengen', ${pruefer.id},
                           ${tx.json({ zustaendig_agent_id: v.zustaendig_agent_id, fuer_betreiber: v.fuer_betreiber, sicht_agenten: v.sicht_agenten } as any)})`;
          return true;
        })) as boolean;
        if (ok) n += 1;
      } catch (e) {
        console.error(`[UNTERLAGEN-PRÜFER] Umhängen #${z.id}:`, String((e as Error)?.message || e).slice(0, 160));
      }
    }
    await sqlPool`UPDATE fiaon_hausputz_laeufe SET fertig_am = NOW(), zahlen = ${sqlPool.json({ umgehaengt: n, geplant: kandidaten.length, an: pruefer } as any)} WHERE id = ${laufId}`;
    console.log(`[UNTERLAGEN-PRÜFER] Lauf #${laufId}: ${n} von ${kandidaten.length} Prüf-Aufgaben an ${pruefer.name} umgehängt.`);
    return { ok: true, laufId, umgehaengt: n, an: pruefer.name };
  } finally {
    laeuft = false;
  }
}

/** Takt (routes.ts): nur mit Schalter — holt nach, was seit dem letzten Lauf bei Justin gelandet ist. */
export async function umhaengenTakt(): Promise<{ umgehaengt: number } | null> {
  if (!(await umhaengenSchalterLesen())) return null;
  const r = await umhaengenAusfuehren({ von: "Takt" });
  return r.umgehaengt > 0 ? { umgehaengt: r.umgehaengt } : null;
}

/** Die Läufe des Umhängens (für „Zurückholen“) — nur, was noch keine 30 Tage alt ist. */
export async function umhaengenLaeufe(lauf: Lauf = sqlPool): Promise<{ id: number; am: string; umgehaengt: number; zurueck: number }[]> {
  try {
    const [t] = (await lauf`SELECT to_regclass('fiaon_hausputz_laeufe') IS NOT NULL AS da`) as any[];
    if (!t?.da) return [];
    const rows = (await lauf`
      SELECT l.id, l.gestartet_am,
             (SELECT COUNT(*)::int FROM fiaon_hausputz_log g WHERE g.lauf_id = l.id) AS n,
             (SELECT COUNT(*)::int FROM fiaon_hausputz_log g WHERE g.lauf_id = l.id AND g.zurueck_am IS NOT NULL) AS zurueck
        FROM fiaon_hausputz_laeufe l
       WHERE l.art = ${UMHAENGEN_LAUF_ART} AND l.gestartet_am > NOW() - INTERVAL '30 days'
         AND EXISTS (SELECT 1 FROM fiaon_hausputz_log g WHERE g.lauf_id = l.id)
       ORDER BY l.id DESC LIMIT 10`) as any[];
    return rows.map((r) => ({ id: Number(r.id), am: new Date(r.gestartet_am).toISOString(), umgehaengt: Number(r.n || 0), zurueck: Number(r.zurueck || 0) }));
  } catch {
    return [];
  }
}
