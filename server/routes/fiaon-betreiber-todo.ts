// ═══════════════════════════════════════════════════════════════════════════
// JUSTINS LISTE — Aufgaben des Betreibers, mit Pipeline und Übergabe
// (E-025 vom 22.08.2026, Ausbau E-028 am selben Tag)
//
// Erste Fassung: eine flache Liste zum Abhaken. Justin: „Wenn ich auf
// erledigt klicke, passiert nichts. Denke das weiter — Pipeline, Übergabe,
// die Gegenseite muss Fragen stellen können."
//
// Jetzt: Jede Aufgabe hat einen STATUS (offen → in_arbeit → wartet → erledigt)
// und einen ZUSTÄNDIGEN (Justin selbst oder ein Mitarbeiter). Übergibt Justin
// eine Aufgabe, erscheint sie im Agentenportal unter „Aufgaben → Aufträge".
// Der Mitarbeiter nimmt an, stellt Rückfragen (→ Status „wartet", zurück bei
// Justin), meldet ein Ergebnis oder gibt die Aufgabe zurück. Jede Bewegung
// ist ein BEITRAG in der Zeitleiste — Kommentar, Frage, Antwort, Ergebnis,
// Statuswechsel. So sieht jeder, wo die Aufgabe steht und warum.
//
// Getrennt von den Kundenaufgaben (fiaon_vermerke): Das hier hat keinen
// Kundenbezug, sondern ist Klickarbeit, Entscheidung, Konto, Prüfung.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";

const router = Router();
export const TODO_BEREICHE = ["make", "brevo", "konten", "entscheidung", "pruefen", "partner", "sonstiges"] as const;
export const TODO_STATUS = ["offen", "in_arbeit", "wartet", "erledigt"] as const;
type Status = (typeof TODO_STATUS)[number];
const BETREIBER_NAME = "Justin";

let geprueft = false;
export async function ensureTodoTabelle(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_betreiber_todos (
      id SERIAL PRIMARY KEY,
      schluessel VARCHAR UNIQUE,
      titel TEXT NOT NULL,
      text TEXT,
      bereich VARCHAR NOT NULL DEFAULT 'sonstiges',
      prioritaet INTEGER NOT NULL DEFAULT 2,
      faellig_am DATE,
      link TEXT,
      quelle VARCHAR NOT NULL DEFAULT 'hand',
      erledigt_am TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Pipeline-Spalten (E-028). Bestehende Einträge bleiben, erledigte werden nachgetragen.
  await sqlPool`ALTER TABLE fiaon_betreiber_todos
    ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'offen',
    ADD COLUMN IF NOT EXISTS zustaendig_art VARCHAR NOT NULL DEFAULT 'betreiber',
    ADD COLUMN IF NOT EXISTS zustaendig_agent_id INTEGER,
    ADD COLUMN IF NOT EXISTS zustaendig_name TEXT,
    ADD COLUMN IF NOT EXISTS delegiert_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS angenommen_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS erledigt_von TEXT,
    ADD COLUMN IF NOT EXISTS ergebnis TEXT,
    ADD COLUMN IF NOT EXISTS frage_offen BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS letzte_aktivitaet TIMESTAMPTZ`;
  await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt' WHERE erledigt_am IS NOT NULL AND status <> 'erledigt'`;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_betreiber_todo_beitraege (
      id SERIAL PRIMARY KEY,
      todo_id INTEGER NOT NULL REFERENCES fiaon_betreiber_todos(id) ON DELETE CASCADE,
      autor_art VARCHAR NOT NULL,
      autor_name TEXT NOT NULL,
      autor_agent_id INTEGER,
      art VARCHAR NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS idx_todo_beitraege_todo ON fiaon_betreiber_todo_beitraege(todo_id)`;
  geprueft = true;
}

type BeitragArt = "kommentar" | "frage" | "antwort" | "ergebnis" | "status";
async function beitrag(todoId: number, b: { autorArt: "betreiber" | "agent" | "system"; autorName: string; autorAgentId?: number | null; art: BeitragArt; text: string }): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, autor_agent_id, art, text)
    VALUES (${todoId}, ${b.autorArt}, ${b.autorName}, ${b.autorAgentId ?? null}, ${b.art}, ${b.text})`;
  await sqlPool`UPDATE fiaon_betreiber_todos SET letzte_aktivitaet = NOW(), updated_at = NOW() WHERE id = ${todoId}`;
}

/** Vom Server angelegt — idempotent über den Schlüssel. Ein erledigter Eintrag bleibt erledigt. */
export async function todoAnlegen(schluessel: string, t: { titel: string; text?: string; bereich?: string; prioritaet?: number; faelligAm?: string | null; link?: string | null; quelle?: string }): Promise<void> {
  await ensureTodoTabelle();
  await sqlPool`
    INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, faellig_am, link, quelle)
    VALUES (${schluessel}, ${t.titel}, ${t.text ?? null}, ${t.bereich ?? "sonstiges"}, ${t.prioritaet ?? 2}, ${t.faelligAm ?? null}, ${t.link ?? null}, ${t.quelle ?? "system"})
    ON CONFLICT (schluessel) DO UPDATE SET titel = EXCLUDED.titel, text = EXCLUDED.text, link = EXCLUDED.link, updated_at = NOW()
  `;
}

/** Was bei Justin liegt: eigene offene Aufgaben plus alles, wo ein Mitarbeiter eine Frage gestellt hat. */
export async function todoOffenZahl(): Promise<number> {
  await ensureTodoTabelle();
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos
    WHERE status <> 'erledigt' AND (zustaendig_art = 'betreiber' OR frage_offen = TRUE)`) as any[];
  return Number(z?.n || 0);
}

/** Was bei einem Mitarbeiter liegt: übergebene, nicht erledigte Aufträge. */
export async function agentAuftraegeOffen(agentId: number): Promise<number> {
  await ensureTodoTabelle();
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos
    WHERE zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId} AND status <> 'erledigt'`) as any[];
  return Number(z?.n || 0);
}

/** Die Liste vom 22.08.2026 — aus 04_Fahrplan/JUSTIN_TODO.md. */
const START: { s: string; titel: string; text: string; bereich: string; prio: number; link?: string }[] = [
  { s: "make-antrag-erinnerung", bereich: "make", prio: 1, titel: "Make: Zweig „antrag_erinnerung“ anlegen + Brevo-Vorlage (Sie-Form)",
    text: "Variablen: vorname, paket, schritt_text, weiter_link, erinnerung_nr. Beispiel-Nutzlast unter Events. Ohne Zweig bleibt die Erinnerungskette nach Antragsabbruch still.", link: "/admin/events" },
  { s: "make-abo-verlaengerung", bereich: "make", prio: 1, titel: "Make: Zweig „abo_verlaengerung_frage“ + Brevo-Vorlage",
    text: "Variablen: vorname, paket, betrag, portal_url. Wird mit der Buchung der 12. Rate ausgelöst.", link: "/admin/events" },
  { s: "make-template-39", bereich: "make", prio: 1, titel: "Make: Template 39 trennen, Route „schufa_requested“ anlegen, Fallback-Zweig ergänzen",
    text: "schufa_rejected / account_activated / account_suspended teilen sich heute eine Vorlage (Audit 22.08.)." },
  { s: "handy-check-menue", bereich: "pruefen", prio: 1, titel: "Am Handy prüfen: mobiles Menü und das E-Mail-Feld oben im Antrag",
    text: "Nach dem Umbau vom 22.08. — der Browser-Test konnte nicht abgeschlossen werden." },
  { s: "gocardless-bad", bereich: "konten", prio: 1, titel: "GoCardless Bank Account Data registrieren, Secrets übergeben",
    text: "Eigenes Portal (bankaccountdata.gocardless.com). Ohne die Secrets gibt es keine Kontoanbindung (PSD2)." },
  { s: "crif-b2b", bereich: "partner", prio: 2, titel: "CRIF-B2B anfragen — eine Bonitäts-API für DE/AT/CH", text: "Entscheidung E-015. Antwort an den Entwickler weitergeben." },
  { s: "brevo-sie", bereich: "brevo", prio: 2, titel: "23 Brevo-Vorlagen auf Sie umstellen", text: "Entscheidung E-002. Liste: 01_Plattform/MAKE_BLUEPRINT_AUDIT.md." },
  { s: "dkb-partner", bereich: "partner", prio: 2, titel: "DKB-Partnerschaft (Girokonto-Referral) anstoßen", text: "Ansprechpartner, Konditionen, Tracking-Link." },
  { s: "entscheid-scheibe-4", bereich: "entscheidung", prio: 2, titel: "Entscheidung Agentenportal Scheibe 4",
    text: "Darf die Vertriebsleitung Betreuer/Provision setzen? Paket/Betrag ändern? Persönliche Admin-Zugänge für Florentine/Daniel statt geteiltem Code?" },
  { s: "doppelzahler-gutschrift", bereich: "entscheidung", prio: 2, titel: "Doppelzahler-Gutschrift freigeben (E-011)", text: "Sobald die Liste steht." },
  { s: "website-freigeben", bereich: "pruefen", prio: 1, titel: "Neue Website ansehen und freigeben",
    text: "fiaon.com (Startseite), /investoren, /presse, /datenraum, /partner, /karriere — Texte, Zahlen, Tonalität. Zahlen für Investoren/Presse stehen als „auf Anfrage“, bis du sie bestätigst.", link: "https://www.fiaon.com/" },
  { s: "antrag-pruefen", bereich: "pruefen", prio: 1, titel: "Antrag am Handy durchspielen (Sie-Form, 5 Schritte, neue Prüfung)", text: "fiaon.com/antrag — bis zur Zahlungsseite.", link: "https://www.fiaon.com/antrag" },
  { s: "presse-fakten", bereich: "sonstiges", prio: 3, titel: "Presse-Fakten bestätigen für /presse und /investoren", text: "Gründung, Sitz, Teamgröße, Kundenzahl, ARR-Run-Rate." },
  { s: "higgsfield-guthaben", bereich: "konten", prio: 3, titel: "Higgsfield-Guthaben prüfen (65,5 Credits)", text: "Bei Bedarf aufladen, wenn die Website-Szenen gefallen." },
  { s: "footer-disclaimer", bereich: "entscheidung", prio: 2, titel: "Fußzeilen-Disclaimer an die neue Ausrichtung anpassen lassen",
    text: "Der rechtliche Text in der Fußzeile sagt noch „keine Provisionen von Banken, keine Vermittlung“. Die Website beschreibt jetzt Partnerprovisionen und Zugang zu Konto/Karte. Bitte mit dem Anwaltsteam neu fassen — der Entwickler ändert Rechtstexte nicht eigenmächtig." },
  { s: "kundenstimmen-echt", bereich: "entscheidung", prio: 2, titel: "Kundenstimmen auf der Startseite durch echte ersetzen oder freigeben",
    text: "Die drei Stimmen (Sara W., Markus R., Julia B.) sind Platzhalter. Echte Zitate mit Einwilligung wären rechtlich sauberer (UWG)." },
];

async function startliste(): Promise<void> {
  for (const t of START) {
    await sqlPool`
      INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, link, quelle)
      VALUES (${t.s}, ${t.titel}, ${t.text}, ${t.bereich}, ${t.prio}, ${t.link ?? null}, 'system')
      ON CONFLICT (schluessel) DO NOTHING
    `;
  }
}

/** Die Spalte der Pipeline — aus Status und Zuständigkeit abgeleitet, damit die Oberfläche nicht rechnen muss. */
function spalte(r: any): "offen" | "team" | "rueckfrage" | "erledigt" {
  if (r.status === "erledigt") return "erledigt";
  if (r.frage_offen) return "rueckfrage";
  if (r.zustaendig_art === "agent") return "team";
  return "offen";
}

function zeile(r: any) {
  return {
    id: Number(r.id), schluessel: r.schluessel ?? null, titel: r.titel, text: r.text ?? null, bereich: r.bereich,
    prioritaet: Number(r.prioritaet || 2), faelligAm: r.faellig_am ? String(r.faellig_am).slice(0, 10) : null,
    link: r.link ?? null, quelle: r.quelle, erledigtAm: r.erledigt_am ?? null, createdAt: r.created_at,
    status: (r.status || "offen") as Status, spalte: spalte(r),
    zustaendig: r.zustaendig_art === "agent"
      ? { art: "agent" as const, agentId: Number(r.zustaendig_agent_id), name: r.zustaendig_name || "Mitarbeiter" }
      : { art: "betreiber" as const, agentId: null, name: BETREIBER_NAME },
    delegiertAm: r.delegiert_am ?? null, angenommenAm: r.angenommen_am ?? null,
    erledigtVon: r.erledigt_von ?? null, ergebnis: r.ergebnis ?? null, frageOffen: !!r.frage_offen,
    letzteAktivitaet: r.letzte_aktivitaet ?? r.updated_at ?? null,
    beitraege: Number(r.beitraege_zahl || 0),
    letzterBeitrag: r.lb_text ? { art: r.lb_art, autor: r.lb_autor, text: String(r.lb_text).slice(0, 160), am: r.lb_am } : null,
  };
}

function beitragZeile(b: any) {
  return { id: Number(b.id), todoId: Number(b.todo_id), autorArt: b.autor_art, autorName: b.autor_name, art: b.art, text: b.text, am: b.created_at };
}

const LISTE_SQL = sqlPool`
  SELECT t.*, bz.n AS beitraege_zahl, lb.art AS lb_art, lb.autor_name AS lb_autor, lb.text AS lb_text, lb.created_at AS lb_am
  FROM fiaon_betreiber_todos t
  LEFT JOIN LATERAL (SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = t.id) bz ON TRUE
  LEFT JOIN LATERAL (SELECT art, autor_name, text, created_at FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = t.id ORDER BY created_at DESC LIMIT 1) lb ON TRUE
`;

async function todoLaden(id: number) {
  const [r] = (await sqlPool`${LISTE_SQL} WHERE t.id = ${id}`) as any[];
  if (!r) return null;
  const beitraege = (await sqlPool`SELECT * FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ${id} ORDER BY created_at ASC`) as any[];
  return { ...zeile(r), zeitleiste: beitraege.map(beitragZeile) };
}

async function agentenListe() {
  const rows = (await sqlPool`
    SELECT id, name, COALESCE(rolle, 'agent') AS rolle
    FROM fiaon_agents
    WHERE COALESCE(active, TRUE) = TRUE AND COALESCE(is_test_account, FALSE) = FALSE AND password_hash IS NOT NULL
    ORDER BY (COALESCE(rolle,'agent') = 'vertriebsleiter') DESC, name ASC`) as any[];
  return rows.map((a) => ({ id: Number(a.id), name: a.name, rolle: a.rolle }));
}

// ─── Betreiber ──────────────────────────────────────────────────────────────

router.get("/admin/todo", async (_req: Request, res: Response) => {
  try {
    await ensureTodoTabelle(); await startliste();
    const rows = (await sqlPool`${LISTE_SQL}
      ORDER BY (t.status = 'erledigt') ASC, t.frage_offen DESC, t.prioritaet ASC, t.faellig_am ASC NULLS LAST, t.created_at ASC`) as any[];
    res.json({ ok: true, todos: rows.map(zeile), bereiche: TODO_BEREICHE, agenten: await agentenListe().catch(() => []) });
  } catch (err) { console.error("[TODO] liste:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.get("/admin/todo/:id", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await todoLaden(Number(req.params.id));
    if (!t) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true, todo: t });
  } catch (err) { console.error("[TODO] detail:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/admin/todo", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const titel = String(req.body?.titel || "").trim();
    if (titel.length < 3) return res.status(400).json({ ok: false, error: "Bitte einen Titel eingeben." });
    const bereich = TODO_BEREICHE.includes(req.body?.bereich) ? req.body.bereich : "sonstiges";
    const prio = [1, 2, 3].includes(Number(req.body?.prioritaet)) ? Number(req.body.prioritaet) : 2;
    const faellig = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.faelligAm || "")) ? String(req.body.faelligAm) : null;
    const [r] = (await sqlPool`
      INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, faellig_am, link, quelle, letzte_aktivitaet)
      VALUES (${titel}, ${String(req.body?.text || "").trim() || null}, ${bereich}, ${prio}, ${faellig}, ${String(req.body?.link || "").trim() || null}, 'hand', NOW())
      RETURNING id`) as any[];
    const agentId = Number(req.body?.agentId || 0);
    if (agentId > 0) await delegieren(Number(r.id), agentId, String(req.body?.hinweis || ""));
    res.json({ ok: true, todo: await todoLaden(Number(r.id)) });
  } catch (err) { console.error("[TODO] anlegen:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

async function delegieren(id: number, agentId: number | null, hinweis: string): Promise<string | null> {
  if (agentId) {
    const [a] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${agentId} AND COALESCE(active, TRUE) = TRUE`) as any[];
    if (!a) return "Mitarbeiter nicht gefunden.";
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_art = 'agent', zustaendig_agent_id = ${a.id}, zustaendig_name = ${a.name},
      delegiert_am = NOW(), angenommen_am = NULL, status = 'offen', frage_offen = FALSE, erledigt_am = NULL, updated_at = NOW() WHERE id = ${id}`;
    await beitrag(id, { autorArt: "system", autorName: "System", art: "status", text: `An ${a.name} übergeben.` });
    if (hinweis.trim()) await beitrag(id, { autorArt: "betreiber", autorName: BETREIBER_NAME, art: "kommentar", text: hinweis.trim().slice(0, 2000) });
  } else {
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_art = 'betreiber', zustaendig_agent_id = NULL, zustaendig_name = NULL,
      status = CASE WHEN status = 'erledigt' THEN 'erledigt' ELSE 'offen' END, frage_offen = FALSE, updated_at = NOW() WHERE id = ${id}`;
    await beitrag(id, { autorArt: "system", autorName: "System", art: "status", text: `Zurück bei ${BETREIBER_NAME}.` });
  }
  return null;
}

router.post("/admin/todo/:id/delegieren", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const agentId = req.body?.agentId ? Number(req.body.agentId) : null;
    const fehler = await delegieren(id, agentId, String(req.body?.hinweis || ""));
    if (fehler) return res.status(400).json({ ok: false, error: fehler });
    res.json({ ok: true, todo: await todoLaden(id) });
  } catch (err) { console.error("[TODO] delegieren:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/admin/todo/:id/beitrag", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const text = String(req.body?.text || "").trim();
    if (text.length < 2) return res.status(400).json({ ok: false, error: "Bitte etwas schreiben." });
    const [t] = (await sqlPool`SELECT frage_offen, zustaendig_art, status FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const art: BeitragArt = t.frage_offen ? "antwort" : "kommentar";
    await beitrag(id, { autorArt: "betreiber", autorName: BETREIBER_NAME, art, text: text.slice(0, 4000) });
    if (t.frage_offen) {
      // Die Antwort geht zurück an den Mitarbeiter — die Aufgabe läuft weiter.
      await sqlPool`UPDATE fiaon_betreiber_todos SET frage_offen = FALSE,
        status = CASE WHEN zustaendig_art = 'agent' THEN 'in_arbeit' ELSE 'offen' END, updated_at = NOW() WHERE id = ${id}`;
    }
    res.json({ ok: true, todo: await todoLaden(id) });
  } catch (err) { console.error("[TODO] beitrag:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.patch("/admin/todo/:id", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const b = req.body || {};
    const [vorher] = (await sqlPool`SELECT * FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
    if (!vorher) return res.status(404).json({ ok: false, error: "Nicht gefunden." });

    if (b.erledigt === true) {
      const ergebnis = String(b.ergebnis || "").trim().slice(0, 4000) || null;
      await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${BETREIBER_NAME},
        ergebnis = COALESCE(${ergebnis}, ergebnis), frage_offen = FALSE, updated_at = NOW() WHERE id = ${id}`;
      await beitrag(id, { autorArt: "betreiber", autorName: BETREIBER_NAME, art: ergebnis ? "ergebnis" : "status", text: ergebnis || "Erledigt." });
    } else if (b.erledigt === false) {
      await sqlPool`UPDATE fiaon_betreiber_todos SET status = CASE WHEN zustaendig_art = 'agent' THEN 'in_arbeit' ELSE 'offen' END,
        erledigt_am = NULL, erledigt_von = NULL, updated_at = NOW() WHERE id = ${id}`;
      await beitrag(id, { autorArt: "betreiber", autorName: BETREIBER_NAME, art: "status", text: "Wieder geöffnet." });
    }
    if (typeof b.status === "string" && ["offen", "in_arbeit"].includes(b.status) && vorher.status !== "erledigt") {
      await sqlPool`UPDATE fiaon_betreiber_todos SET status = ${b.status}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (typeof b.titel === "string" && b.titel.trim()) await sqlPool`UPDATE fiaon_betreiber_todos SET titel = ${b.titel.trim()}, updated_at = NOW() WHERE id = ${id}`;
    if (typeof b.text === "string") await sqlPool`UPDATE fiaon_betreiber_todos SET text = ${b.text.trim() || null}, updated_at = NOW() WHERE id = ${id}`;
    if (typeof b.link === "string") await sqlPool`UPDATE fiaon_betreiber_todos SET link = ${b.link.trim() || null}, updated_at = NOW() WHERE id = ${id}`;
    if ([1, 2, 3].includes(Number(b.prioritaet))) await sqlPool`UPDATE fiaon_betreiber_todos SET prioritaet = ${Number(b.prioritaet)}, updated_at = NOW() WHERE id = ${id}`;
    if (typeof b.bereich === "string" && (TODO_BEREICHE as readonly string[]).includes(b.bereich)) await sqlPool`UPDATE fiaon_betreiber_todos SET bereich = ${b.bereich}, updated_at = NOW() WHERE id = ${id}`;
    if (b.faelligAm !== undefined) {
      const f = /^\d{4}-\d{2}-\d{2}$/.test(String(b.faelligAm || "")) ? String(b.faelligAm) : null;
      await sqlPool`UPDATE fiaon_betreiber_todos SET faellig_am = ${f}, updated_at = NOW() WHERE id = ${id}`;
    }
    res.json({ ok: true, todo: await todoLaden(id) });
  } catch (err) { console.error("[TODO] patch:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.delete("/admin/todo/:id", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// ─── Mitarbeiter: Aufträge der Leitung ──────────────────────────────────────

async function meinAuftrag(req: AgentRequest, res: Response): Promise<any | null> {
  const id = Number(req.params.id);
  const [t] = (await sqlPool`SELECT * FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
  if (!t || t.zustaendig_art !== "agent" || Number(t.zustaendig_agent_id) !== Number(req.agent!.id)) {
    res.status(404).json({ ok: false, error: "Dieser Auftrag liegt nicht bei dir." });
    return null;
  }
  return t;
}

router.get("/agent/auftraege", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const rows = (await sqlPool`${LISTE_SQL}
      WHERE t.zustaendig_art = 'agent' AND t.zustaendig_agent_id = ${req.agent!.id}
        AND (t.status <> 'erledigt' OR t.erledigt_am > NOW() - INTERVAL '14 days')
      ORDER BY (t.status = 'erledigt') ASC, t.prioritaet ASC, t.faellig_am ASC NULLS LAST, t.delegiert_am ASC`) as any[];
    const ids = rows.map((r) => Number(r.id));
    const beitraege = ids.length ? (await sqlPool`SELECT * FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ANY(${ids}) ORDER BY created_at ASC`) as any[] : [];
    const nachTodo = new Map<number, any[]>();
    for (const b of beitraege) { const l = nachTodo.get(Number(b.todo_id)) || []; l.push(beitragZeile(b)); nachTodo.set(Number(b.todo_id), l); }
    res.json({ ok: true, auftraege: rows.map((r) => ({ ...zeile(r), zeitleiste: nachTodo.get(Number(r.id)) || [] })) });
  } catch (err) { console.error("[TODO] agent liste:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/auftraege/:id/annehmen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    if (t.status === "erledigt") return res.status(400).json({ ok: false, error: "Schon erledigt." });
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'in_arbeit', angenommen_am = COALESCE(angenommen_am, NOW()), updated_at = NOW() WHERE id = ${t.id}`;
    await beitrag(Number(t.id), { autorArt: "system", autorName: "System", art: "status", text: `${req.agent!.name} hat den Auftrag angenommen.` });
    res.json({ ok: true, todo: await todoLaden(Number(t.id)) });
  } catch (err) { console.error("[TODO] annehmen:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/auftraege/:id/frage", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const text = String(req.body?.text || "").trim();
    if (text.length < 3) return res.status(400).json({ ok: false, error: "Bitte die Frage ausformulieren." });
    if (t.status === "erledigt") return res.status(400).json({ ok: false, error: "Schon erledigt." });
    await beitrag(Number(t.id), { autorArt: "agent", autorName: req.agent!.name, autorAgentId: req.agent!.id, art: "frage", text: text.slice(0, 4000) });
    await sqlPool`UPDATE fiaon_betreiber_todos SET frage_offen = TRUE, status = 'wartet', angenommen_am = COALESCE(angenommen_am, NOW()), updated_at = NOW() WHERE id = ${t.id}`;
    res.json({ ok: true, todo: await todoLaden(Number(t.id)) });
  } catch (err) { console.error("[TODO] frage:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/auftraege/:id/kommentar", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const text = String(req.body?.text || "").trim();
    if (text.length < 2) return res.status(400).json({ ok: false, error: "Bitte etwas schreiben." });
    await beitrag(Number(t.id), { autorArt: "agent", autorName: req.agent!.name, autorAgentId: req.agent!.id, art: "kommentar", text: text.slice(0, 4000) });
    res.json({ ok: true, todo: await todoLaden(Number(t.id)) });
  } catch (err) { console.error("[TODO] kommentar:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/auftraege/:id/erledigt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const ergebnis = String(req.body?.ergebnis || "").trim();
    if (ergebnis.length < 5) return res.status(400).json({ ok: false, error: "Bitte kurz festhalten, was das Ergebnis ist — Justin liest es." });
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${req.agent!.name},
      ergebnis = ${ergebnis.slice(0, 4000)}, frage_offen = FALSE, updated_at = NOW() WHERE id = ${t.id}`;
    await beitrag(Number(t.id), { autorArt: "agent", autorName: req.agent!.name, autorAgentId: req.agent!.id, art: "ergebnis", text: ergebnis.slice(0, 4000) });
    res.json({ ok: true, todo: await todoLaden(Number(t.id)) });
  } catch (err) { console.error("[TODO] erledigt:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/auftraege/:id/zurueck", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 3) return res.status(400).json({ ok: false, error: "Bitte kurz sagen, warum." });
    await beitrag(Number(t.id), { autorArt: "agent", autorName: req.agent!.name, autorAgentId: req.agent!.id, art: "kommentar", text: `Zurückgegeben: ${grund.slice(0, 2000)}` });
    await delegieren(Number(t.id), null, "");
    res.json({ ok: true });
  } catch (err) { console.error("[TODO] zurueck:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

export default router;
