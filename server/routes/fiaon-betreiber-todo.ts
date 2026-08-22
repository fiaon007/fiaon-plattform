// ═══════════════════════════════════════════════════════════════════════════
// JUSTINS TODO-LISTE — was der Betreiber selbst tun muss (E-025, 22.08.2026)
//
// „Wenn ich was zu tun habe (Make-Events, Brevo-Templates, …), schreibe mir
// eine TODO-Liste bzw. baue mir eine im Admin-Dashboard." Hier ist sie: eine
// eigene Tabelle, getrennt von den Kundenaufgaben (fiaon_vermerke), weil sie
// etwas anderes ist — kein Kundenbezug, sondern Klickarbeit, Entscheidungen,
// Konten. Der Server kann selbst Einträge anlegen (z. B. wenn ein Make-Zweig
// fehlt), Einträge sind über einen Schlüssel idempotent.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";

const router = Router();
export const TODO_BEREICHE = ["make", "brevo", "konten", "entscheidung", "pruefen", "partner", "sonstiges"] as const;

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
  geprueft = true;
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

export async function todoOffenZahl(): Promise<number> {
  await ensureTodoTabelle();
  const [z] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE erledigt_am IS NULL`) as any[];
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
  { s: "presse-fakten", bereich: "sonstiges", prio: 3, titel: "Presse-Fakten bestätigen für /presse und /investoren", text: "Gründung, Sitz, Teamgröße, Kundenzahl, ARR-Run-Rate." },
  { s: "higgsfield-guthaben", bereich: "konten", prio: 3, titel: "Higgsfield-Guthaben prüfen (65,5 Credits)", text: "Bei Bedarf aufladen, wenn die Website-Szenen gefallen." },
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

function zeile(r: any) {
  return {
    id: Number(r.id), schluessel: r.schluessel ?? null, titel: r.titel, text: r.text ?? null, bereich: r.bereich,
    prioritaet: Number(r.prioritaet || 2), faelligAm: r.faellig_am ? String(r.faellig_am).slice(0, 10) : null,
    link: r.link ?? null, quelle: r.quelle, erledigtAm: r.erledigt_am ?? null, createdAt: r.created_at,
  };
}

router.get("/admin/todo", async (_req: Request, res: Response) => {
  try {
    await ensureTodoTabelle(); await startliste();
    const rows = (await sqlPool`
      SELECT * FROM fiaon_betreiber_todos
      ORDER BY (erledigt_am IS NULL) DESC, prioritaet ASC, faellig_am ASC NULLS LAST, created_at ASC`) as any[];
    res.json({ ok: true, todos: rows.map(zeile), bereiche: TODO_BEREICHE });
  } catch (err) { console.error("[TODO] liste:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
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
      INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, faellig_am, link, quelle)
      VALUES (${titel}, ${String(req.body?.text || "").trim() || null}, ${bereich}, ${prio}, ${faellig}, ${String(req.body?.link || "").trim() || null}, 'hand')
      RETURNING *`) as any[];
    res.json({ ok: true, todo: zeile(r) });
  } catch (err) { console.error("[TODO] anlegen:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.patch("/admin/todo/:id", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    if (req.body?.erledigt !== undefined) {
      await sqlPool`UPDATE fiaon_betreiber_todos SET erledigt_am = ${req.body.erledigt ? new Date() : null}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (typeof req.body?.titel === "string" && req.body.titel.trim()) await sqlPool`UPDATE fiaon_betreiber_todos SET titel = ${req.body.titel.trim()}, updated_at = NOW() WHERE id = ${id}`;
    if (typeof req.body?.text === "string") await sqlPool`UPDATE fiaon_betreiber_todos SET text = ${req.body.text.trim() || null}, updated_at = NOW() WHERE id = ${id}`;
    if ([1, 2, 3].includes(Number(req.body?.prioritaet))) await sqlPool`UPDATE fiaon_betreiber_todos SET prioritaet = ${Number(req.body.prioritaet)}, updated_at = NOW() WHERE id = ${id}`;
    const [r] = (await sqlPool`SELECT * FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true, todo: zeile(r) });
  } catch (err) { console.error("[TODO] patch:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.delete("/admin/todo/:id", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

export default router;
