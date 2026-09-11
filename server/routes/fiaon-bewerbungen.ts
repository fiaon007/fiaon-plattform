// ═══════════════════════════════════════════════════════════════════════════
// BEWERBUNGEN — von der Website bis zur Einladung als Mitarbeiter
// (E-177, 11.09.2026)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Zehn Bewerbungen über /karriere seit dem 22.08., sieben echte, alle sieben
// Kunden — und keine einzige wurde je angefasst. Die Tabelle fiaon_anfragen
// hatte keine Status-Spalte, die Aufgabe entstand ohne Zuständigen und ohne
// Mail, die einzige Liste lag zugeklappt in einer Werkstatt-Karte. Die
// Website versprach dazu vier verschiedene Dinge (Rückruf in zwei Werktagen,
// „direkt an Florentine", „Aufgabe bei der Leitung", Kommentar „an Justin").
//
// ── DER EINE WEG (jetzt) ──────────────────────────────────────────────────
//   /karriere → POST /api/fiaon/anfrage (fiaon-anfragen.ts)
//     → Zeile in fiaon_anfragen mit status = 'neu'
//     → Auftrag an die ZUSTÄNDIGE PERSON (auftragFuerKunden, Schlüssel
//       bewerbung:<id>, Bereich „entscheidung", Mail „Neuer Auftrag für dich")
//   Zuständig ist Florentine Lombardi (Agent 10) — so sagt es die Website.
//   Änderbar ohne Code: fiaon_settings.bewerbung_zustaendig_agent_id.
//   Die Liste: /chef/s/bewerbungen (Chefbüro, Raum Team) und /admin/team →
//   Reiter „Bewerbungen". Dort: Übernehmen, Übergeben, Zusagen, Absagen,
//   als Test markieren, Notiz. Zusage und Absage schicken je EINE Mail
//   (bewerbung_zusage / bewerbung_absage, gesiezt, ohne Fristen) über die
//   eine Mail-Tür (mailSenden). Die Zusage öffnet danach die bestehende
//   Mitarbeiter-Einladung (InviteModal → POST /admin/agents mit bewerbungId).
//
// ── WAS HIER BEWUSST NICHT PASSIERT ───────────────────────────────────────
//   · Keine Mail an Bewerber ohne Klick eines Menschen.
//   · Keine automatische Eingangsbestätigung — die Aussage an den Bewerber
//     ist „<Zuständige> meldet sich persönlich", und die muss ein Mensch
//     einlösen, nicht ein Roboter.
//   · Kein Löschen: „Als Test markieren" versteckt, ein Testeintrag bleibt
//     in der Tabelle (AGENTS.md: keine Hard-Deletes).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { auftragFuerKunden, empfaengerNachId } from "./fiaon-betreiber-todo";

const router = Router();

export const BEWERBUNG_STATUS = ["neu", "in_gespraech", "zugesagt", "abgesagt", "zurueckgezogen"] as const;
export type BewerbungStatus = (typeof BEWERBUNG_STATUS)[number];

/** Florentine Lombardi — die Website sagt es so. Änderbar in fiaon_settings. */
const STANDARD_ZUSTAENDIG = 10;
const SETTING_ZUSTAENDIG = "bewerbung_zustaendig_agent_id";
const LAND: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

// ── Schema: die Tabelle und ihre neuen Spalten ─────────────────────────────
// Muster ensureSchufaTabelle: CREATE TABLE IF NOT EXISTS ergänzt keine
// Spalte, deshalb ALTER … ADD COLUMN IF NOT EXISTS mit lock_timeout
// (Vorbild ensureAustauschSpalten in fiaon-betreiber-todo.ts).
let spaltenBereit: Promise<void> | null = null;
export function ensureAnfragenSpalten(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_anfragen (
          id SERIAL PRIMARY KEY, art VARCHAR NOT NULL, name TEXT, email TEXT, firma TEXT, telefon TEXT, rolle TEXT, land TEXT,
          kunde TEXT, erfahrung TEXT, text TEXT, person_id INTEGER, ip TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_anfragen
          ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'neu',
          ADD COLUMN IF NOT EXISTS zustaendig_agent_id INTEGER,
          ADD COLUMN IF NOT EXISTS bearbeitet_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS bearbeitet_von TEXT,
          ADD COLUMN IF NOT EXISTS notiz TEXT,
          ADD COLUMN IF NOT EXISTS ist_test BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS agent_id INTEGER`;
      });
    })().catch((e) => { spaltenBereit = null; throw e; });
  }
  return spaltenBereit;
}

// ── Kleine Helfer ──────────────────────────────────────────────────────────
/** Die Zusatzfelder liegen als Zeilen „feld: wert" im Text (fiaon-anfragen.ts). */
export function textZerlegen(text: string | null | undefined): { freitext: string; felder: Record<string, string> } {
  const felder: Record<string, string> = {};
  const frei: string[] = [];
  for (const zeile of String(text || "").split("\n")) {
    const m = zeile.match(/^(anstellung|start|stunden|linkedin|sprache):\s*(.*)$/i);
    if (m) felder[m[1].toLowerCase()] = m[2].trim();
    else frei.push(zeile);
  }
  return { freitext: frei.join("\n").trim(), felder };
}

function nameTeilen(name: string): { vorname: string; nachname: string } {
  const teile = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (teile.length <= 1) return { vorname: teile[0] || "", nachname: "" };
  return { vorname: teile[0], nachname: teile.slice(1).join(" ") };
}

/** Wer im Chefbüro klickt — Name für Protokoll und Zeitleiste. */
async function chefPerson(req: ChefRequest): Promise<{ name: string; agentId: number | null }> {
  const id = req.chef?.agentId ?? null;
  if (id) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return { name: String(a.name), agentId: id };
  }
  return { name: "Justin (Chefbüro)", agentId: null };
}

export async function bewerbungZustaendigerStandard(): Promise<number> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${SETTING_ZUSTAENDIG} LIMIT 1`.catch(() => [])) as any[];
  const n = Number(r?.value);
  return Number.isInteger(n) && n > 0 ? n : STANDARD_ZUSTAENDIG;
}

/** Wer Bewerbungen übernehmen darf: Leitung (Chef-Stufe) und Vertriebsleitung — aktiv, echt, nicht gesperrt. */
async function zustaendigeLaden(): Promise<{ id: number; name: string }[]> {
  const rows = (await sqlPool`
    SELECT id, name FROM fiaon_agents
     WHERE COALESCE(active, TRUE) = TRUE AND COALESCE(is_test_account, FALSE) = FALSE AND zugang_gesperrt_am IS NULL
       AND (admin_stufe IS NOT NULL OR rolle = 'vertriebsleiter')
     ORDER BY name ASC`) as any[];
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

interface Zeile {
  id: number; name: string; email: string; telefon: string | null; bereich: string | null; land: string | null;
  erfahrung: string | null; text: string | null; person_id: number | null; created_at: string;
  status: BewerbungStatus; zustaendig_agent_id: number | null; zustaendig_name: string | null;
  bearbeitet_am: string | null; bearbeitet_von: string | null; notiz: string | null; ist_test: boolean;
  agent_id: number | null; mitarbeiter_name: string | null;
  kunde_vorname: string | null; kunde_nachname: string | null; betreuer: string | null; ref: string | null; bezahlt: boolean;
  auftrag_id: number | null; auftrag_status: string | null;
}

async function bewerbungLaden(id: number): Promise<Zeile | null> {
  const [r] = (await sqlPool`
    SELECT a.id, a.name, a.email, a.telefon, a.rolle AS bereich, a.land, a.erfahrung, a.text, a.person_id, a.created_at,
           a.status, a.zustaendig_agent_id, z.name AS zustaendig_name, a.bearbeitet_am, a.bearbeitet_von, a.notiz, a.ist_test,
           a.agent_id, m.name AS mitarbeiter_name,
           p.first_name AS kunde_vorname, p.last_name AS kunde_nachname, ag.name AS betreuer,
           (SELECT x.ref FROM fiaon_applications x
             WHERE x.person_id = a.person_id AND x.merged_into IS NULL AND x.archived_at IS NULL
             ORDER BY (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1) AS ref,
           EXISTS (SELECT 1 FROM fiaon_applications y WHERE y.person_id = a.person_id AND y.payment_status = 'paid') AS bezahlt,
           t.id AS auftrag_id, t.status AS auftrag_status
      FROM fiaon_anfragen a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      LEFT JOIN fiaon_agents z ON z.id = a.zustaendig_agent_id
      LEFT JOIN fiaon_agents m ON m.id = a.agent_id
      LEFT JOIN fiaon_betreiber_todos t ON t.schluessel = 'bewerbung:' || a.id::text
     WHERE a.id = ${id} AND a.art = 'karriere'
     LIMIT 1`) as any[];
  return r ? zeileBauen(r) : null;
}

function zeileBauen(r: any): Zeile {
  return {
    id: Number(r.id), name: String(r.name || ""), email: String(r.email || ""), telefon: r.telefon ?? null,
    bereich: r.bereich ?? null, land: r.land ?? null, erfahrung: r.erfahrung ?? null, text: r.text ?? null,
    person_id: r.person_id != null ? Number(r.person_id) : null, created_at: new Date(r.created_at).toISOString(),
    status: (BEWERBUNG_STATUS as readonly string[]).includes(String(r.status)) ? (r.status as BewerbungStatus) : "neu",
    zustaendig_agent_id: r.zustaendig_agent_id != null ? Number(r.zustaendig_agent_id) : null,
    zustaendig_name: r.zustaendig_name ?? null,
    bearbeitet_am: r.bearbeitet_am ? new Date(r.bearbeitet_am).toISOString() : null, bearbeitet_von: r.bearbeitet_von ?? null,
    notiz: r.notiz ?? null, ist_test: !!r.ist_test,
    agent_id: r.agent_id != null ? Number(r.agent_id) : null, mitarbeiter_name: r.mitarbeiter_name ?? null,
    kunde_vorname: r.kunde_vorname ?? null, kunde_nachname: r.kunde_nachname ?? null, betreuer: r.betreuer ?? null,
    ref: r.ref ?? null, bezahlt: !!r.bezahlt,
    auftrag_id: r.auftrag_id != null ? Number(r.auftrag_id) : null, auftrag_status: r.auftrag_status ?? null,
  };
}

/** Was die Oberfläche bekommt — mit den Zusatzfeldern aus dem Text aufgelöst. */
function fuerOberflaeche(z: Zeile) {
  const { freitext, felder } = textZerlegen(z.text);
  return {
    ...z,
    text: undefined,
    freitext,
    anstellung: felder.anstellung || null, start: felder.start || null, stunden: felder.stunden || null,
    linkedin: felder.linkedin || null, sprache: felder.sprache || null,
    landName: z.land ? (LAND[z.land] ?? z.land) : null,
    istKunde: z.person_id != null,
    kundeName: [z.kunde_vorname, z.kunde_nachname].filter(Boolean).join(" ").trim() || null,
  };
}

/** Die Nutzlast beider Bewerber-Mails — Vorschau UND Versand nehmen dieselbe. */
function bewerbungPayload(z: Zeile, ansprechpartner: string): Record<string, string> {
  const { felder } = textZerlegen(z.text);
  const { vorname, nachname } = nameTeilen(z.name);
  return {
    email: z.email, vorname, nachname,
    bereich: z.bereich || "—",
    anstellung: felder.anstellung || "—",
    land: z.land ? (LAND[z.land] ?? z.land) : "—",
    ansprechpartner,
  };
}

async function ansprechpartnerName(z: Zeile): Promise<string> {
  if (z.zustaendig_name) return z.zustaendig_name;
  const id = await bewerbungZustaendigerStandard();
  const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
  return a?.name ? String(a.name) : "FIAON Team";
}

/**
 * Der Auftrag an die zuständige Person — beim Eingang und beim Übernehmen.
 * Idempotent über den Schlüssel bewerbung:<id>; ein anderer Empfänger heißt
 * Übergabe (auftragFuerKunden delegiert neu). personId bleibt hier bewusst
 * leer: Die Ableitung über den Kunden gäbe sonst den BETREUER des Kunden,
 * und eine Bewerbung ist keine Kundensache.
 */
export async function bewerbungAuftrag(id: number, agentId?: number | null, autorName = "Website"): Promise<{ agentId: number | null; agentName: string | null }> {
  await ensureAnfragenSpalten();
  const z = await bewerbungLaden(id);
  if (!z) return { agentId: null, agentName: null };
  const { freitext, felder } = textZerlegen(z.text);
  const zeilen = [
    `Bewerbung #${z.id} über die Website (${new Date(z.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}).`,
    `Name: ${z.name} · E-Mail: ${z.email}${z.telefon ? ` · Telefon: ${z.telefon}` : ""}`,
    `Bereich: ${z.bereich || "—"} · Land: ${z.land ? (LAND[z.land] ?? z.land) : "—"} · Erfahrung: ${z.erfahrung || "—"}`,
    `Zusammenarbeit: ${felder.anstellung || "—"} · Start: ${felder.start || "offen"} · Stunden/Woche: ${felder.stunden || "—"}`,
    felder.linkedin ? `LinkedIn/Website: ${felder.linkedin}` : null,
    z.person_id ? `Ist Kunde${z.ref ? ` (${z.ref})` : ""}${z.betreuer ? `, Betreuer ${z.betreuer}` : ""}${z.bezahlt ? ", bezahlt" : ""}.` : "Kein Kunde.",
    freitext ? `\nWarum FIAON: ${freitext.slice(0, 1200)}` : null,
    "\nBitte melden, Gespräch führen und in der Bewerbungsliste zusagen oder absagen.",
  ].filter(Boolean).join("\n");
  const wunsch = agentId ?? await bewerbungZustaendigerStandard();
  const erg = await auftragFuerKunden({
    personId: null, ref: z.ref,
    titel: `Bewerbung: ${z.name} — ${z.bereich || "Bereich offen"}`,
    text: zeilen,
    schluessel: `bewerbung:${z.id}`,
    bereich: "entscheidung",
    link: `/chef/s/bewerbungen?id=${z.id}`,
    quelle: "website",
    autorName,
    agentId: wunsch,
    anlageText: autorName === "Website"
      ? "Bewerbung über die Website eingegangen."
      : `${autorName} hat die Bewerbung übergeben.`,
  });
  await sqlPool`UPDATE fiaon_anfragen SET zustaendig_agent_id = ${erg.agentId} WHERE id = ${z.id}`.catch(() => {});
  return { agentId: erg.agentId, agentName: erg.agentName };
}

/** Bewerbung entschieden: alter Vermerk und Auftrag werden erledigt, die Zeitleiste bekommt das Ergebnis. */
async function abschliessen(id: number, wer: { name: string; agentId: number | null }, ergebnis: string): Promise<void> {
  // Der Vermerk aus der Zeit vor dieser Seite (fiaon_vermerke, autor „Website").
  await sqlPool`
    UPDATE fiaon_vermerke SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${wer.name}, updated_at = NOW()
     WHERE art = 'aufgabe' AND autor_name = 'Website' AND status <> 'erledigt'
       AND text LIKE ${`Bewerbung (Werde Teil des Teams) #${id} über%`}`.catch(() => {});
  const [t] = (await sqlPool`
    UPDATE fiaon_betreiber_todos
       SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${wer.name}, ergebnis = ${ergebnis},
           updated_at = NOW(), letzte_aktivitaet = NOW()
     WHERE schluessel = ${`bewerbung:${id}`} AND status <> 'erledigt'
     RETURNING id`.catch(() => [])) as any[];
  if (t?.id) {
    await sqlPool`
      INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, autor_agent_id, art, text)
      VALUES (${Number(t.id)}, ${wer.agentId ? "agent" : "betreiber"}, ${wer.name}, ${wer.agentId}, 'ergebnis', ${ergebnis})`.catch(() => {});
  }
}

async function bewerbungMailSenden(z: Zeile, event: "bewerbung_zusage" | "bewerbung_absage", wer: { name: string; agentId: number | null }) {
  const { mailSenden } = await import("../lib/fiaon-mail-senden");
  const zusatz = bewerbungPayload(z, await ansprechpartnerName(z));
  const akteur = { name: wer.name, agentId: wer.agentId, rolle: "admin" as const };
  if (z.person_id) {
    const erg = await mailSenden({ event, personId: z.person_id, zusatz, akteur });
    // Person zusammengeführt oder weg: dann wie ein Mensch ohne Akte.
    if (!(erg.status === "abgelehnt" && erg.grund === "Kunde nicht gefunden.")) return erg;
  }
  return mailSenden({ event, ohnePerson: { email: zusatz.email }, zusatz, akteur });
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/bewerbungen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const rows = (await sqlPool`
      SELECT a.id, a.name, a.email, a.telefon, a.rolle AS bereich, a.land, a.erfahrung, a.text, a.person_id, a.created_at,
             a.status, a.zustaendig_agent_id, z.name AS zustaendig_name, a.bearbeitet_am, a.bearbeitet_von, a.notiz, a.ist_test,
             a.agent_id, m.name AS mitarbeiter_name,
             p.first_name AS kunde_vorname, p.last_name AS kunde_nachname, ag.name AS betreuer,
             (SELECT x.ref FROM fiaon_applications x
               WHERE x.person_id = a.person_id AND x.merged_into IS NULL AND x.archived_at IS NULL
               ORDER BY (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1) AS ref,
             EXISTS (SELECT 1 FROM fiaon_applications y WHERE y.person_id = a.person_id AND y.payment_status = 'paid') AS bezahlt,
             t.id AS auftrag_id, t.status AS auftrag_status
        FROM fiaon_anfragen a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
        LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
        LEFT JOIN fiaon_agents z ON z.id = a.zustaendig_agent_id
        LEFT JOIN fiaon_agents m ON m.id = a.agent_id
        LEFT JOIN fiaon_betreiber_todos t ON t.schluessel = 'bewerbung:' || a.id::text
       WHERE a.art = 'karriere'
       ORDER BY a.created_at DESC`) as any[];
    const zeilen = rows.map((r) => fuerOberflaeche(zeileBauen(r)));
    const zustaendige = await zustaendigeLaden();
    const standardId = await bewerbungZustaendigerStandard();
    const standard = zustaendige.find((a) => a.id === standardId) ?? null;
    res.json({
      ok: true,
      zeilen,
      zustaendige,
      standard: standard ? { agentId: standard.id, name: standard.name } : { agentId: standardId, name: null },
      ich: { agentId: req.chef?.agentId ?? null, stufe: req.chef?.stufe ?? null },
    });
  } catch (err) {
    console.error("[BEWERBUNGEN] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Wer neue Bewerbungen bekommt — nur die Geschäftsführung ändert das. */
router.post("/chef/bewerbungen/standard", requireChef("geschaeftsfuehrung"), async (req: ChefRequest, res: Response) => {
  try {
    const agentId = Number(req.body?.agentId);
    const erlaubt = (await zustaendigeLaden()).find((a) => a.id === agentId);
    if (!erlaubt) return res.status(400).json({ ok: false, error: "Diese Person kann keine Bewerbungen übernehmen (nicht aktiv, Testkonto oder ohne Leitungsrolle)." });
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${SETTING_ZUSTAENDIG}, ${String(agentId)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    res.json({ ok: true, standard: { agentId: erlaubt.id, name: erlaubt.name }, meldung: `Neue Bewerbungen gehen ab jetzt an ${erlaubt.name}.` });
  } catch (err) {
    console.error("[BEWERBUNGEN] standard:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Übernehmen (ich) oder übergeben (agentId): Auftrag an die Person, Status „im Gespräch". */
router.post("/chef/bewerbungen/:id/uebernehmen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const id = Number(req.params.id);
    const z = await bewerbungLaden(id);
    if (!z) return res.status(404).json({ ok: false, error: "Bewerbung nicht gefunden." });
    if (z.ist_test) return res.status(400).json({ ok: false, error: "Ein Testeintrag wird nicht übernommen." });
    const wer = await chefPerson(req);
    const wunsch = Number(req.body?.agentId) || wer.agentId || await bewerbungZustaendigerStandard();
    const ziel = await empfaengerNachId(wunsch);
    if (!ziel?.id) return res.status(400).json({ ok: false, error: "Diese Person ist nicht aktiv oder ein Testkonto." });
    const erg = await bewerbungAuftrag(id, ziel.id, wer.name);
    await sqlPool`
      UPDATE fiaon_anfragen
         SET status = CASE WHEN status = 'neu' THEN 'in_gespraech' ELSE status END,
             bearbeitet_am = NOW(), bearbeitet_von = ${wer.name}
       WHERE id = ${id}`;
    res.json({ ok: true, zeile: fuerOberflaeche((await bewerbungLaden(id))!), meldung: `${erg.agentName || ziel.name} hat die Bewerbung von ${z.name} jetzt als Auftrag.` });
  } catch (err) {
    console.error("[BEWERBUNGEN] uebernehmen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Statuswechsel ohne Mail: im Gespräch, zurückgezogen, wieder neu. */
router.post("/chef/bewerbungen/:id/status", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const id = Number(req.params.id);
    const status = String(req.body?.status || "");
    if (!["neu", "in_gespraech", "zurueckgezogen"].includes(status)) return res.status(400).json({ ok: false, error: "Zusage und Absage gehen über ihre eigenen Knöpfe — sie schicken eine Mail." });
    const z = await bewerbungLaden(id);
    if (!z) return res.status(404).json({ ok: false, error: "Bewerbung nicht gefunden." });
    const wer = await chefPerson(req);
    await sqlPool`UPDATE fiaon_anfragen SET status = ${status}, bearbeitet_am = NOW(), bearbeitet_von = ${wer.name} WHERE id = ${id}`;
    if (status === "zurueckgezogen") await abschliessen(id, wer, "Bewerbung zurückgezogen.");
    res.json({ ok: true, zeile: fuerOberflaeche((await bewerbungLaden(id))!) });
  } catch (err) {
    console.error("[BEWERBUNGEN] status:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/chef/bewerbungen/:id/notiz", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const id = Number(req.params.id);
    const notiz = String(req.body?.notiz ?? "").trim().slice(0, 2000) || null;
    const [r] = (await sqlPool`UPDATE fiaon_anfragen SET notiz = ${notiz} WHERE id = ${id} AND art = 'karriere' RETURNING id`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Bewerbung nicht gefunden." });
    res.json({ ok: true, zeile: fuerOberflaeche((await bewerbungLaden(id))!) });
  } catch (err) {
    console.error("[BEWERBUNGEN] notiz:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Test markieren oder aufheben. Ein Test bleibt in der Tabelle, verschwindet aber aus der Arbeit. */
router.post("/chef/bewerbungen/:id/test", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const id = Number(req.params.id);
    const istTest = req.body?.istTest !== false;
    const z = await bewerbungLaden(id);
    if (!z) return res.status(404).json({ ok: false, error: "Bewerbung nicht gefunden." });
    const wer = await chefPerson(req);
    await sqlPool`UPDATE fiaon_anfragen SET ist_test = ${istTest}, bearbeitet_am = NOW(), bearbeitet_von = ${wer.name} WHERE id = ${id}`;
    if (istTest) await abschliessen(id, wer, "Als Test markiert — keine echte Bewerbung.");
    res.json({ ok: true, zeile: fuerOberflaeche((await bewerbungLaden(id))!) });
  } catch (err) {
    console.error("[BEWERBUNGEN] test:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Die Vorschau: exakt die Mail, die Zusagen/Absagen verschicken würde. */
router.get("/chef/bewerbungen/:id/vorschau", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const id = Number(req.params.id);
    const art = String(req.query.art || "");
    if (art !== "zusage" && art !== "absage") return res.status(400).json({ ok: false, error: "art muss zusage oder absage sein." });
    const z = await bewerbungLaden(id);
    if (!z) return res.status(404).json({ ok: false, error: "Bewerbung nicht gefunden." });
    const { mailRendern } = await import("../mail/motor");
    const payload = bewerbungPayload(z, await ansprechpartnerName(z));
    const mail = mailRendern(`bewerbung_${art}`, payload);
    if (!mail) return res.status(500).json({ ok: false, error: "Für diese Mail gibt es keine Vorlage." });
    res.json({ ok: true, betreff: mail.betreff, html: mail.html, empfaenger: payload.email, absender: mail.absender, fehlend: mail.fehlend });
  } catch (err) {
    console.error("[BEWERBUNGEN] vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Zusagen: Mail „Wir möchten mit Ihnen arbeiten", Status „zugesagt", Auftrag
 * erledigt — und die Antwort trägt die Vorbelegung für die Mitarbeiter-
 * Einladung, die die Oberfläche direkt danach öffnet. Geht die Mail nicht
 * raus, bleibt alles, wie es war: Ein Status ohne Mail wäre eine Zusage,
 * von der der Bewerber nichts weiß.
 */
router.post("/chef/bewerbungen/:id/zusagen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const id = Number(req.params.id);
    const z = await bewerbungLaden(id);
    if (!z) return res.status(404).json({ ok: false, error: "Bewerbung nicht gefunden." });
    if (z.ist_test) return res.status(400).json({ ok: false, error: "Ein Testeintrag bekommt keine Mail." });
    if (z.status === "zugesagt") return res.status(400).json({ ok: false, error: "Diese Bewerbung ist schon zugesagt." });
    const wer = await chefPerson(req);
    const mail = await bewerbungMailSenden(z, "bewerbung_zusage", wer);
    if (!mail.ok) return res.status(400).json({ ok: false, error: mail.meldung });
    const notiz = String(req.body?.notiz ?? "").trim().slice(0, 2000);
    await sqlPool`
      UPDATE fiaon_anfragen
         SET status = 'zugesagt', bearbeitet_am = NOW(), bearbeitet_von = ${wer.name},
             notiz = COALESCE(NULLIF(${notiz}, ''), notiz)
       WHERE id = ${id}`;
    await abschliessen(id, wer, `Zugesagt von ${wer.name} — Mail an ${z.email} ist raus.`);
    const { vorname, nachname } = nameTeilen(z.name);
    res.json({
      ok: true, meldung: mail.meldung,
      zeile: fuerOberflaeche((await bewerbungLaden(id))!),
      einladung: { firstName: vorname, lastName: nachname, email: z.email, phone: z.telefon || "", bewerbungId: z.id },
    });
  } catch (err) {
    console.error("[BEWERBUNGEN] zusagen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/chef/bewerbungen/:id/absagen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    await ensureAnfragenSpalten();
    const id = Number(req.params.id);
    const z = await bewerbungLaden(id);
    if (!z) return res.status(404).json({ ok: false, error: "Bewerbung nicht gefunden." });
    if (z.ist_test) return res.status(400).json({ ok: false, error: "Ein Testeintrag bekommt keine Mail." });
    if (z.status === "abgesagt") return res.status(400).json({ ok: false, error: "Diese Bewerbung ist schon abgesagt." });
    const wer = await chefPerson(req);
    const mail = await bewerbungMailSenden(z, "bewerbung_absage", wer);
    if (!mail.ok) return res.status(400).json({ ok: false, error: mail.meldung });
    const notiz = String(req.body?.notiz ?? "").trim().slice(0, 2000);
    await sqlPool`
      UPDATE fiaon_anfragen
         SET status = 'abgesagt', bearbeitet_am = NOW(), bearbeitet_von = ${wer.name},
             notiz = COALESCE(NULLIF(${notiz}, ''), notiz)
       WHERE id = ${id}`;
    await abschliessen(id, wer, `Abgesagt von ${wer.name} — Mail an ${z.email} ist raus.`);
    res.json({ ok: true, meldung: mail.meldung, zeile: fuerOberflaeche((await bewerbungLaden(id))!) });
  } catch (err) {
    console.error("[BEWERBUNGEN] absagen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VORBELEGUNG FÜR KUNDEN AUF /karriere
//
// Die Kachel im Kundenbereich verspricht seit dem 22.08. „Ihre Daten sind
// schon eingetragen" — und /karriere las die Referenz nie aus. Jetzt holt
// die Seite Name, E-Mail, Telefon und Land hier ab. Nur mit Kundensitzung
// (requireKunde, E-152): Die Referenz allein öffnet keine Daten.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/kunde/:ref/bewerbung-vorbelegung", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const [a] = (await sqlPool`
      SELECT a.first_name, a.last_name, a.email, a.phone, a.phone_country_code, a.country,
             p.first_name AS p_vorname, p.last_name AS p_nachname, p.primary_email, p.primary_phone, p.country AS p_land
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.ref = ${req.kundeRef} LIMIT 1`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const name = [a.p_vorname || a.first_name, a.p_nachname || a.last_name].filter(Boolean).join(" ").trim();
    const telefonRoh = String(a.primary_phone || a.phone || "").trim();
    const vorwahl = String(a.phone_country_code || "").trim();
    const telefon = telefonRoh && vorwahl && !telefonRoh.startsWith("+") && !telefonRoh.startsWith("00") ? `${vorwahl} ${telefonRoh}` : telefonRoh;
    const landRoh = String(a.p_land || a.country || "").trim().toLowerCase();
    const land = /^(de|deutschland|germany)$/.test(landRoh) ? "DE" : /^(at|österreich|oesterreich|austria)$/.test(landRoh) ? "AT" : /^(ch|schweiz|switzerland)$/.test(landRoh) ? "CH" : "";
    res.json({ ok: true, name, email: String(a.primary_email || a.email || "").trim().toLowerCase(), telefon, land });
  } catch (err) {
    console.error("[BEWERBUNGEN] vorbelegung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
