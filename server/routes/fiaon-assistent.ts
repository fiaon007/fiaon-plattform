// ═══════════════════════════════════════════════════════════════════════════
// DER FIAON COPILOT — die Engine (30.08.2026)
//
// Justin: „Ein KI-Assistent für Mitarbeiter und Admin, der auf Zuruf echte
// Aufgaben im System ERLEDIGT — nicht nur beantwortet."
//
// ── WIE DIESE ENGINE HANDELT ───────────────────────────────────────────────
// Das Modell (OpenAI-kompatibles Chat-Completions-Format, Tool-Calling,
// Streaming) bekommt AUSSCHLIESSLICH die Werkzeuge aus der Registry
// (server/lib/fiaon-assistent-werkzeuge.ts). Jedes Werkzeug ruft einen
// BESTEHENDEN Endpunkt dieses Hauses über HTTP auf — mit den Cookies der
// laufenden Sitzung. Es gibt keinen zweiten Weg in die Datenbank.
//
// ── DIE ZWEI STUFEN ────────────────────────────────────────────────────────
// „frei" läuft sofort (lesen, notieren). „bestaetigen" wird hier nur
// VORBEREITET: Vorschau bauen, Vorbereitung speichern, Karte an den Client —
// ausgeführt wird erst über POST …/bestaetigen/:id, also nach dem Klick eines
// Menschen. Vorbereitungen verfallen nach 15 Minuten.
//
// ── ZWEI TÜREN, EINE ENGINE ────────────────────────────────────────────────
// /agent/assistent/*  — Mitarbeiter (requireAgent, Rolle aus rolleVon)
// /chef/assistent/*   — Chefbüro (requireChef("geschaeftsfuehrung")).
//   Das Chef-Cookie trägt die Mitarbeiter-Kennung des Menschen; damit stellt
//   die Engine für interne /agent-Aufrufe ein kurzlebiges Agent-Token aus —
//   der Chef handelt also als er selbst, mit seinen Rechten, und jede
//   Serverwand prüft ihn wie jeden anderen. Das ALTE Admin-Cookie trägt keine
//   Kennung: Dann bleiben nur die Chef-Werkzeuge (Mailwerk), und die
//   Oberfläche sagt das.
//
// ── MODELLZUGANG ───────────────────────────────────────────────────────────
// ENV: ASSISTENT_API_KEY, ASSISTENT_MODELL, ASSISTENT_BASIS_URL — mit
// Rückfall auf OPENAI_API_KEY/OPENAI_MODEL, damit der Copilot sofort läuft.
// Ohne Schlüssel antwortet er mit Klartext statt mit einem Serverfehler.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { randomUUID } from "node:crypto";
import { sqlPool } from "../lib/db-pool";
import { formatBerlin } from "../lib/fiaon-time";
import {
  requireAgent, signAgentToken, logAction, type AgentRequest,
} from "./fiaon-agent";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { rolleVon } from "../lib/fiaon-kundenzugriff";
import {
  werkzeugeFuerRolle, werkzeugVonName, type Werkzeug, type WerkzeugKontext,
  type InternerAufruf,
} from "../lib/fiaon-assistent-werkzeuge";

const router = Router();

// ── Grenzen der Engine (Code, nicht Prompt) ─────────────────────────────────
const MAX_RUNDEN = 5;              // Modell-Runden je Auftrag
const MAX_WERKZEUGE_JE_RUNDE = 6;  // Werkzeug-Aufrufe je Runde
const MAX_KUNDEN_JE_AUFTRAG = 5;   // die harte 5-Kunden-Grenze
const MAX_TEXTLAENGE = 4000;       // Zeichen je Nutzer-Nachricht
const VERFALL_MINUTEN = 15;        // Vorbereitungen verfallen danach
const VERLAUF_FENSTER = 24;        // Nachrichten, die das Modell als Kontext sieht

// ── Modellzugang aus der Umgebung ────────────────────────────────────────────
function modellZugang(): { basis: string; schluessel: string; modell: string } {
  return {
    basis: (process.env.ASSISTENT_BASIS_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    schluessel: process.env.ASSISTENT_API_KEY || process.env.OPENAI_API_KEY || "",
    modell: process.env.ASSISTENT_MODELL || process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

// ── Tabellen (additiv, ensure-Muster wie im Haus üblich) ─────────────────────
let tabellenBereit = false;
async function ensureAssistentTabellen(): Promise<void> {
  if (tabellenBereit) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_assistent_sitzungen (
      id SERIAL PRIMARY KEY,
      besitzer_typ VARCHAR NOT NULL,
      besitzer_id INTEGER NOT NULL,
      titel VARCHAR NOT NULL DEFAULT 'Neue Sitzung',
      person_id INTEGER,
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archiviert_am TIMESTAMPTZ
    )
  `;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_assistent_nachrichten (
      id SERIAL PRIMARY KEY,
      sitzung_id INTEGER NOT NULL,
      rolle VARCHAR NOT NULL,
      inhalt TEXT NOT NULL DEFAULT '',
      karten JSONB,
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_assistent_vorbereitungen (
      id VARCHAR PRIMARY KEY,
      sitzung_id INTEGER NOT NULL,
      besitzer_typ VARCHAR NOT NULL,
      besitzer_id INTEGER NOT NULL,
      werkzeug VARCHAR NOT NULL,
      parameter JSONB NOT NULL,
      zusammenfassung TEXT NOT NULL,
      vorschau_html TEXT,
      warnung TEXT,
      status VARCHAR NOT NULL DEFAULT 'offen',
      ergebnis JSONB,
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gueltig_bis TIMESTAMPTZ NOT NULL,
      erledigt_am TIMESTAMPTZ
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS idx_assistent_nachrichten_sitzung ON fiaon_assistent_nachrichten (sitzung_id, id)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS idx_assistent_sitzungen_besitzer ON fiaon_assistent_sitzungen (besitzer_typ, besitzer_id, aktualisiert_am)`;
  tabellenBereit = true;
}

// ── Wer sitzt vor dem Deck? ──────────────────────────────────────────────────
interface Sitzender {
  typ: "agent" | "chef";
  /** Mitarbeiter-Kennung; beim alten Admin-Cookie 0 (kein Agent-Zugang). */
  besitzerId: number;
  name: string;
  /** Rolle für die Werkzeugliste: agent|onboarding|inkasso|vertriebsleiter|admin oder chef. */
  rolle: string;
  istChef: boolean;
  /** Können interne /agent-Aufrufe laufen? */
  hatAgentZugang: boolean;
  /** Cookie-Kopf für interne Aufrufe (bei Chefs plus frisches Agent-Token). */
  cookie: string;
}

async function sitzenderAusAgent(req: AgentRequest): Promise<Sitzender> {
  const rolle = await rolleVon(req.agent!.id);
  return {
    typ: "agent", besitzerId: req.agent!.id, name: req.agent!.name,
    rolle, istChef: false, hatAgentZugang: true,
    cookie: String(req.headers.cookie || ""),
  };
}

async function sitzenderAusChef(req: ChefRequest): Promise<Sitzender> {
  const agentId = req.chef?.agentId ?? null;
  let name = "Geschäftsführung";
  let cookie = String(req.headers.cookie || "");
  let hatAgentZugang = false;
  if (agentId) {
    const [a] = (await sqlPool`
      SELECT id, name, active, session_epoch FROM fiaon_agents WHERE id = ${agentId}
    `) as any[];
    if (a && a.active) {
      name = a.name;
      hatAgentZugang = true;
      // Das kurzlebige Agent-Token: Der Chef handelt als er selbst. requireAgent
      // prüft Kennung und Session-Epoch wie bei jeder normalen Anmeldung.
      cookie = `${cookie}; fiaon_agent_token=${signAgentToken(Number(a.id), Number(a.session_epoch))}`;
    }
  }
  return {
    typ: "chef", besitzerId: agentId ?? 0, name,
    rolle: "chef", istChef: true, hatAgentZugang, cookie,
  };
}

// ── Der interne Selbst-Aufruf: bestehende Endpunkte, echte Cookies ──────────
function internerAufruf(cookie: string): InternerAufruf {
  const port = process.env.PORT || "5000";
  const basis = `http://127.0.0.1:${port}/api/fiaon`;
  return async (methode, pfad, body) => {
    const res = await fetch(basis + pfad, {
      method: methode,
      headers: {
        cookie,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };
}

function kontextFuer(s: Sitzender): WerkzeugKontext {
  return {
    agentId: s.besitzerId || null,
    name: s.name,
    rolle: s.rolle,
    istChef: s.istChef,
    intern: internerAufruf(s.cookie),
  };
}

// ── System-Prompt (deutsch, mit Werkzeugliste aus der Registry) ─────────────
function systemPrompt(s: Sitzender, werkzeuge: Werkzeug[], akte: string | null): string {
  const jetzt = new Date();
  const wochentag = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "Europe/Berlin" }).format(jetzt);
  const liste = werkzeuge
    .map((w) => `- ${w.name} [${w.stufe === "frei" ? "frei" : "BESTÄTIGEN"}]: ${w.beschreibung}`)
    .join("\n");
  return [
    "Du bist der FIAON Copilot — der interne Assistent der FIAON-Plattform. Du ERLEDIGST Aufgaben über deine Werkzeuge, statt nur zu antworten.",
    "",
    "DAS GESCHÄFT: FIAON ist eine Bonitäts-Dienstleistung (DACH). Kunden buchen 12-Monats-Pakete (monatliche Raten) oder die Bonitätsauskunft für 74 Euro. FIAON beschafft Auskünfte (SCHUFA, KSV, CRIF), erklärt Einträge und führt Schriftwechsel. Girokonto und Karte beim Partner sind immer ZIEL, nie Zusage: Die Entscheidung trifft die Bank. FIAON verspricht keine Löschung berechtigter Einträge.",
    "",
    `WER VOR DIR SITZT: ${s.name} (${s.istChef ? "Chefbüro, Geschäftsführung" : `Rolle ${s.rolle}`}). Mitarbeiter duzt du. Texte an KUNDEN sind IMMER in der Sie-Form.`,
    `HEUTE: ${wochentag}, ${formatBerlin(jetzt)} (Europe/Berlin).`,
    akte ? `ANGEHEFTETE AKTE (alle Aufträge ohne anderen Kundenbezug meinen diesen Menschen):\n${akte}` : "",
    "",
    "DEINE WERKZEUGE (mit Stufe):",
    liste,
    "",
    "SO ARBEITEST DU:",
    "1. Wenn nur ein Name genannt wird: erst kunde_suchen, dann mit der personId weiterarbeiten. Bei mehreren Treffern fragst du kurz nach, statt zu raten.",
    "2. Werkzeuge der Stufe „frei“ führst du sofort aus. Werkzeuge der Stufe BESTÄTIGEN werden vorbereitet und erscheinen als Karte — der Mensch klickt selbst auf Ausführen. Du kündigst das an (z. B. „Ich habe die Mail vorbereitet — bitte unten bestätigen.“) und wartest NICHT auf das Ergebnis.",
    "3. Höchstens 5 Kunden je Auftrag. Keine Löschungen, keine DSGVO-Aktionen, keine Zahlungs- oder Ratenbuchungen — solche Werkzeuge hast du nicht und bietest sie nicht an.",
    "4. In Kundentexten verboten: „Beratung/beraten“, „Empfehlung/empfehlen“, „Garantie/garantiert“, „sicher klappt“, „wir verbessern Ihren Score“, „Löschung garantiert“. Der einzige erlaubte Rahmen: die Entscheidung trifft die Bank.",
    "5. Termine: beginn im Format JJJJ-MM-TTTHH:MM in Berliner Zeit. „Morgen 14 Uhr“ rechnest du selbst aus dem heutigen Datum aus.",
    "6. Antworte knapp und in Klartext-Deutsch. Zahlen mit Komma (79,99 Euro). Wenn ein Werkzeug einen Fehler meldet, gib den Grund wieder und schlage den nächsten sinnvollen Schritt vor — erfinde nie Ergebnisse.",
    "",
    "DEIN LEITSATZ: Ich erledige. Alles mit Folgen für Geld, Zugänge oder Kundenkommunikation bereite ich vollständig vor und lasse den Menschen bestätigen.",
  ].filter((z) => z !== "").join("\n");
}

// ── Die angeheftete Akte als Kontextzeile ────────────────────────────────────
async function akteKurz(personId: number, intern: InternerAufruf): Promise<string | null> {
  const r = await intern("GET", `/agent/kunden/liste?person=${personId}&limit=1`).catch(() => null);
  const k = r?.json?.kunden?.[0];
  if (!k) return null;
  const teile = [
    `personId ${k.personId ?? personId}`,
    k.name ? `Name ${k.name}` : null,
    k.email ? `E-Mail ${k.email}` : null,
    k.telefon ? `Telefon ${k.telefon}` : null,
    k.produkt ? `Paket ${k.produkt}` : null,
    k.titel ? `Lage: ${k.titel}` : null,
  ].filter(Boolean);
  return teile.join(" · ");
}

// ── SSE-Helfer ──────────────────────────────────────────────────────────────
function sseStart(res: Response): (ereignis: Record<string, unknown>) => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  return (ereignis) => { res.write(`data: ${JSON.stringify(ereignis)}\n\n`); };
}

// ── Streaming-Aufruf des Modells (OpenAI-kompatibel) ─────────────────────────
interface ModellWerkzeugAufruf { id: string; name: string; argumente: string }
interface ModellAntwort { text: string; werkzeugAufrufe: ModellWerkzeugAufruf[]; abschluss: string | null }

async function modellStrom(
  nachrichten: Array<Record<string, unknown>>,
  werkzeuge: Werkzeug[],
  anClient: (delta: string) => void,
  signal: AbortSignal,
): Promise<ModellAntwort> {
  const { basis, schluessel, modell } = modellZugang();
  const tools = werkzeuge.map((w) => ({
    type: "function",
    function: { name: w.name, description: w.beschreibung, parameters: w.jsonSchema },
  }));
  const res = await fetch(`${basis}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${schluessel}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: modell,
      stream: true,
      temperature: 0.2,
      messages: nachrichten,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Das Modell hat mit HTTP ${res.status} geantwortet${text ? `: ${text.slice(0, 300)}` : ""}`);
  }

  let text = "";
  let abschluss: string | null = null;
  const aufrufe = new Map<number, ModellWerkzeugAufruf>();
  let puffer = "";
  const dekodierer = new TextDecoder();

  const zeileVerarbeiten = (zeile: string) => {
    const glatt = zeile.trim();
    if (!glatt.startsWith("data:")) return;
    const daten = glatt.slice(5).trim();
    if (!daten || daten === "[DONE]") return;
    let j: any = null;
    try { j = JSON.parse(daten); } catch { return; }
    const wahl = j?.choices?.[0];
    if (!wahl) return;
    if (wahl.finish_reason) abschluss = String(wahl.finish_reason);
    const delta = wahl.delta || {};
    if (typeof delta.content === "string" && delta.content) {
      text += delta.content;
      anClient(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const t of delta.tool_calls) {
        const index = Number(t.index ?? 0);
        const bisher = aufrufe.get(index) || { id: "", name: "", argumente: "" };
        if (t.id) bisher.id = String(t.id);
        if (t.function?.name) bisher.name += String(t.function.name);
        if (t.function?.arguments) bisher.argumente += String(t.function.arguments);
        aufrufe.set(index, bisher);
      }
    }
  };

  // Node-Fetch liefert einen Web-Stream; er ist async-iterierbar.
  for await (const stueck of res.body as unknown as AsyncIterable<Uint8Array>) {
    puffer += dekodierer.decode(stueck, { stream: true });
    let umbruch = puffer.indexOf("\n");
    while (umbruch >= 0) {
      zeileVerarbeiten(puffer.slice(0, umbruch));
      puffer = puffer.slice(umbruch + 1);
      umbruch = puffer.indexOf("\n");
    }
  }
  if (puffer) zeileVerarbeiten(puffer);

  const werkzeugAufrufe = Array.from(aufrufe.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, aufruf]) => aufruf)
    .filter((a) => a.name);
  return { text, werkzeugAufrufe, abschluss };
}

// ── Protokoll: jede AUSGEFÜHRTE Bestätigen-Aktion an der Kundenakte ─────────
async function aktionProtokollieren(
  s: Sitzender, werkzeug: Werkzeug, parameter: any, zusammenfassung: string,
): Promise<void> {
  try {
    let ref: string | null = typeof parameter?.ref === "string" && parameter.ref.trim() ? String(parameter.ref).trim() : null;
    if (!ref && typeof parameter?.ersetzenRef === "string" && parameter.ersetzenRef.trim()) ref = String(parameter.ersetzenRef).trim();
    if (!ref) {
      const betroffen = werkzeug.betroffenePersonen?.(parameter) || [];
      const personId = betroffen.find((b) => typeof b === "number") as number | undefined;
      if (personId) {
        const [zeile] = (await sqlPool`
          SELECT ref FROM fiaon_applications
          WHERE person_id = ${personId} AND merged_into IS NULL
          ORDER BY created_at DESC LIMIT 1
        `) as any[];
        ref = zeile?.ref || null;
      }
    }
    if (!ref) return; // Kein Kundenbezug (z. B. Mailwerk) — die Zielroute protokolliert selbst.
    await logAction(ref, { id: s.besitzerId || 0, name: `KI-Assistent im Auftrag von ${s.name}` }, "ki_assistent", {
      note: zusammenfassung.slice(0, 1000),
    });
  } catch (err) {
    console.error("[ASSISTENT] Protokoll:", err);
  }
}

// ── Sitzungs-Helfer ─────────────────────────────────────────────────────────
async function sitzungLaden(id: number, s: Sitzender): Promise<any | null> {
  const [zeile] = (await sqlPool`
    SELECT * FROM fiaon_assistent_sitzungen
    WHERE id = ${id} AND besitzer_typ = ${s.typ} AND besitzer_id = ${s.besitzerId} AND archiviert_am IS NULL
  `) as any[];
  return zeile || null;
}

async function nachrichtSchreiben(sitzungId: number, rolle: string, inhalt: string, karten: unknown[] | null): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_assistent_nachrichten (sitzung_id, rolle, inhalt, karten)
    VALUES (${sitzungId}, ${rolle}, ${inhalt}, ${karten && karten.length ? JSON.stringify(karten) : null})
  `;
  await sqlPool`UPDATE fiaon_assistent_sitzungen SET aktualisiert_am = NOW() WHERE id = ${sitzungId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ROUTEN — einmal geschrieben, an zwei Türen gemountet
// ═══════════════════════════════════════════════════════════════════════════

type SitzenderErmitteln = (req: any) => Promise<Sitzender>;

function routenBauen(pfadBasis: string, wer: SitzenderErmitteln): void {
  // ── Werkzeugliste für die Oberfläche (Legende, ehrlich aus der Registry) ──
  router.get(`${pfadBasis}/werkzeuge`, async (req: any, res: Response) => {
    try {
      const s = await wer(req);
      const werkzeuge = werkzeugeFuerRolle(s.rolle, s.hatAgentZugang).map((w) => ({
        name: w.name, titel: w.titel, stufe: w.stufe, beschreibung: w.beschreibung,
      }));
      res.json({ ok: true, werkzeuge, hatAgentZugang: s.hatAgentZugang, name: s.name });
    } catch (err) {
      console.error("[ASSISTENT] werkzeuge:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  // ── Kundensuche für das Akte-Anheften ────────────────────────────────────
  // Läuft über DASSELBE Werkzeug wie das Modell (kunde_suchen) — damit die
  // Oberfläche exakt sieht, was der Assistent sähe, auch im Chefbüro.
  router.get(`${pfadBasis}/kunden-suche`, async (req: any, res: Response) => {
    try {
      const s = await wer(req);
      const werkzeug = werkzeugVonName("kunde_suchen");
      if (!werkzeug || !s.hatAgentZugang) {
        return res.json({ ok: true, kunden: [], hinweis: "Ohne Mitarbeiter-Kennung keine Kundensuche." });
      }
      const ergebnis = await werkzeug.ausfuehren({ suchtext: String(req.query.q || "") }, kontextFuer(s));
      res.json(ergebnis?.ok === false ? { ok: true, kunden: [], hinweis: ergebnis.error } : ergebnis);
    } catch (err) {
      console.error("[ASSISTENT] kunden-suche:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  // ── Sitzungen ─────────────────────────────────────────────────────────────
  router.get(`${pfadBasis}/sitzungen`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const zeilen = (await sqlPool`
        SELECT id, titel, person_id, erstellt_am, aktualisiert_am
        FROM fiaon_assistent_sitzungen
        WHERE besitzer_typ = ${s.typ} AND besitzer_id = ${s.besitzerId} AND archiviert_am IS NULL
        ORDER BY aktualisiert_am DESC LIMIT 30
      `) as any[];
      res.json({ ok: true, sitzungen: zeilen });
    } catch (err) {
      console.error("[ASSISTENT] sitzungen:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  router.post(`${pfadBasis}/sitzungen`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const [zeile] = (await sqlPool`
        INSERT INTO fiaon_assistent_sitzungen (besitzer_typ, besitzer_id, titel)
        VALUES (${s.typ}, ${s.besitzerId}, 'Neue Sitzung')
        RETURNING id, titel, person_id, erstellt_am, aktualisiert_am
      `) as any[];
      res.json({ ok: true, sitzung: zeile });
    } catch (err) {
      console.error("[ASSISTENT] sitzung anlegen:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  router.get(`${pfadBasis}/sitzungen/:id`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const sitzung = await sitzungLaden(Number(req.params.id), s);
      if (!sitzung) return res.status(404).json({ ok: false, error: "Sitzung nicht gefunden." });
      const nachrichten = (await sqlPool`
        SELECT id, rolle, inhalt, karten, erstellt_am
        FROM fiaon_assistent_nachrichten
        WHERE sitzung_id = ${sitzung.id}
        ORDER BY id ASC LIMIT 200
      `) as any[];
      // Offene Vorbereitungen mitliefern — die Karten sollen nach einem
      // Neuladen bedienbar bleiben, nicht nur im Live-Strom.
      const offene = (await sqlPool`
        SELECT id, werkzeug, zusammenfassung, warnung, status, gueltig_bis
        FROM fiaon_assistent_vorbereitungen
        WHERE sitzung_id = ${sitzung.id} AND status = 'offen' AND gueltig_bis > NOW()
      `) as any[];
      res.json({ ok: true, sitzung, nachrichten, offeneVorbereitungen: offene });
    } catch (err) {
      console.error("[ASSISTENT] sitzung lesen:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  router.post(`${pfadBasis}/sitzungen/:id/umbenennen`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const sitzung = await sitzungLaden(Number(req.params.id), s);
      if (!sitzung) return res.status(404).json({ ok: false, error: "Sitzung nicht gefunden." });
      const titel = String(req.body?.titel || "").trim().slice(0, 80);
      if (!titel) return res.status(400).json({ ok: false, error: "Der Titel ist leer." });
      await sqlPool`UPDATE fiaon_assistent_sitzungen SET titel = ${titel} WHERE id = ${sitzung.id}`;
      res.json({ ok: true });
    } catch (err) {
      console.error("[ASSISTENT] umbenennen:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  // Kein Hard-Delete — die Sitzung wird archiviert (AGENTS.md).
  router.post(`${pfadBasis}/sitzungen/:id/archivieren`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const sitzung = await sitzungLaden(Number(req.params.id), s);
      if (!sitzung) return res.status(404).json({ ok: false, error: "Sitzung nicht gefunden." });
      await sqlPool`UPDATE fiaon_assistent_sitzungen SET archiviert_am = NOW() WHERE id = ${sitzung.id}`;
      res.json({ ok: true });
    } catch (err) {
      console.error("[ASSISTENT] archivieren:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  // ── Kontext anheften: „Arbeite an Kunde 4711" ────────────────────────────
  router.post(`${pfadBasis}/sitzungen/:id/kontext`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const sitzung = await sitzungLaden(Number(req.params.id), s);
      if (!sitzung) return res.status(404).json({ ok: false, error: "Sitzung nicht gefunden." });
      const roh = req.body?.personId;
      if (roh === null || roh === undefined || roh === "") {
        await sqlPool`UPDATE fiaon_assistent_sitzungen SET person_id = NULL WHERE id = ${sitzung.id}`;
        return res.json({ ok: true, kontext: null });
      }
      const personId = Number(roh);
      if (!Number.isFinite(personId) || personId <= 0) {
        return res.status(400).json({ ok: false, error: "personId ist keine Zahl." });
      }
      if (!s.hatAgentZugang) {
        return res.status(400).json({ ok: false, error: "Ohne Mitarbeiter-Kennung lässt sich keine Akte anheften." });
      }
      const zeile = await akteKurz(personId, internerAufruf(s.cookie));
      if (!zeile) return res.status(404).json({ ok: false, error: "Diese Akte ist für dich nicht sichtbar." });
      await sqlPool`UPDATE fiaon_assistent_sitzungen SET person_id = ${personId} WHERE id = ${sitzung.id}`;
      res.json({ ok: true, kontext: { personId, zeile } });
    } catch (err) {
      console.error("[ASSISTENT] kontext:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  // ── Das Herz: der Chat-Strom ──────────────────────────────────────────────
  router.post(`${pfadBasis}/chat`, async (req: any, res: Response) => {
    let sende: ((e: Record<string, unknown>) => void) | null = null;
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const text = String(req.body?.text || "").trim().slice(0, MAX_TEXTLAENGE);
      if (!text) return res.status(400).json({ ok: false, error: "Der Auftrag ist leer." });

      // Sitzung finden oder anlegen
      let sitzung = req.body?.sitzungId ? await sitzungLaden(Number(req.body.sitzungId), s) : null;
      if (!sitzung) {
        const titel = text.slice(0, 64);
        const [neu] = (await sqlPool`
          INSERT INTO fiaon_assistent_sitzungen (besitzer_typ, besitzer_id, titel)
          VALUES (${s.typ}, ${s.besitzerId}, ${titel})
          RETURNING *
        `) as any[];
        sitzung = neu;
      }

      const { schluessel } = modellZugang();
      sende = sseStart(res);
      sende({ art: "sitzung", sitzungId: sitzung.id, titel: sitzung.titel });

      if (!schluessel) {
        // Ohne Schlüssel kein Rätselraten: Klartext, wer was setzen muss.
        sende({ art: "fehler", text: "Der Modellzugang ist noch nicht eingerichtet. Bitte ASSISTENT_API_KEY (und optional ASSISTENT_MODELL, ASSISTENT_BASIS_URL) in der Umgebung setzen." });
        sende({ art: "fertig", sitzungId: sitzung.id });
        return res.end();
      }

      await nachrichtSchreiben(sitzung.id, "nutzer", text, null);

      // Abbruch: Der Browser geht weg → das Modell hört auf zu rechnen.
      const abbruch = new AbortController();
      const zeitgrenze = setTimeout(() => abbruch.abort(), 180_000);
      req.on("close", () => abbruch.abort());

      // Heartbeat gegen stille Proxies
      const puls = setInterval(() => { try { res.write(": puls\n\n"); } catch { /* egal */ } }, 15_000);

      try {
        const werkzeuge = werkzeugeFuerRolle(s.rolle, s.hatAgentZugang);
        const kontext = kontextFuer(s);

        // Angeheftete Akte in den Prompt
        let akte: string | null = null;
        if (sitzung.person_id && s.hatAgentZugang) {
          akte = await akteKurz(Number(sitzung.person_id), kontext.intern).catch(() => null);
        }

        // Verlauf aus der Datenbank (nur Text-Nachrichten, jüngste zuerst geholt, dann gedreht)
        const verlauf = (await sqlPool`
          SELECT rolle, inhalt FROM fiaon_assistent_nachrichten
          WHERE sitzung_id = ${sitzung.id} AND inhalt <> ''
          ORDER BY id DESC LIMIT ${VERLAUF_FENSTER}
        `) as any[];
        const nachrichten: Array<Record<string, unknown>> = [
          { role: "system", content: systemPrompt(s, werkzeuge, akte) },
          ...verlauf.reverse().map((n: any) => ({
            role: n.rolle === "nutzer" ? "user" : "assistant",
            content: String(n.inhalt).slice(0, 6000),
          })),
        ];
        // Die aktuelle Nutzer-Nachricht steht bereits im Verlauf (eben geschrieben).

        const karten: unknown[] = [];
        const beruehrteKunden = new Set<string>();
        let antwortText = "";

        for (let runde = 0; runde < MAX_RUNDEN; runde += 1) {
          sende({ art: "zustand", wert: "denkt" });
          const antwort = await modellStrom(
            nachrichten, werkzeuge,
            (delta) => { antwortText += delta; sende!({ art: "text", delta }); },
            abbruch.signal,
          );

          if (!antwort.werkzeugAufrufe.length) break;

          // Die Assistenten-Nachricht MIT tool_calls gehört ins Transkript,
          // sonst verweigert die API die tool-Antworten.
          nachrichten.push({
            role: "assistant",
            content: antwort.text || null,
            tool_calls: antwort.werkzeugAufrufe.map((a) => ({
              id: a.id || `aufruf_${randomUUID().slice(0, 8)}`,
              type: "function",
              function: { name: a.name, arguments: a.argumente || "{}" },
            })),
          });

          sende({ art: "zustand", wert: "fuehrt_aus" });
          const aufrufe = antwort.werkzeugAufrufe.slice(0, MAX_WERKZEUGE_JE_RUNDE);
          for (const aufruf of aufrufe) {
            const aufrufId = aufruf.id || `aufruf_${randomUUID().slice(0, 8)}`;
            const werkzeug = werkzeugVonName(aufruf.name);
            const antwortAnModell = (inhalt: unknown) => {
              nachrichten.push({
                role: "tool", tool_call_id: aufrufId,
                content: JSON.stringify(inhalt).slice(0, 8000),
              });
            };

            // Nur Werkzeuge aus der Registry — und nur die der eigenen Rolle.
            if (!werkzeug || !werkzeuge.some((w) => w.name === werkzeug.name)) {
              antwortAnModell({ ok: false, error: "Dieses Werkzeug gibt es nicht oder deine Rolle hat es nicht." });
              continue;
            }

            let parameter: any = {};
            try { parameter = aufruf.argumente ? JSON.parse(aufruf.argumente) : {}; }
            catch {
              antwortAnModell({ ok: false, error: "Die Parameter waren kein gültiges JSON." });
              continue;
            }

            // Die 5-Kunden-Grenze — je Auftrag, über alle Runden.
            for (const b of werkzeug.betroffenePersonen?.(parameter) || []) beruehrteKunden.add(String(b));
            if (beruehrteKunden.size > MAX_KUNDEN_JE_AUFTRAG) {
              antwortAnModell({ ok: false, error: `Grenze erreicht: höchstens ${MAX_KUNDEN_JE_AUFTRAG} Kunden je Auftrag. Bitte den Auftrag aufteilen.` });
              sende({ art: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: "fehlgeschlagen", fehler: `Mehr als ${MAX_KUNDEN_JE_AUFTRAG} Kunden je Auftrag sind nicht erlaubt.` });
              karten.push({ typ: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: "fehlgeschlagen", fehler: "5-Kunden-Grenze" });
              continue;
            }

            if (werkzeug.stufe === "frei") {
              sende({ art: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: "laeuft", parameter });
              try {
                const ergebnis = await werkzeug.ausfuehren(parameter, kontext);
                const gut = ergebnis?.ok !== false;
                sende({ art: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: gut ? "erledigt" : "fehlgeschlagen", ergebnis, fehler: gut ? null : (ergebnis?.error || null) });
                karten.push({ typ: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: gut ? "erledigt" : "fehlgeschlagen", ergebnis });
                antwortAnModell(ergebnis);
              } catch (err: any) {
                const grund = String(err?.message || "Unbekannter Fehler");
                sende({ art: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: "fehlgeschlagen", fehler: grund });
                karten.push({ typ: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: "fehlgeschlagen", fehler: grund });
                antwortAnModell({ ok: false, error: grund });
              }
            } else {
              // Stufe BESTÄTIGEN: vollständig vorbereiten, Karte rendern, warten.
              try {
                const vorschau = werkzeug.vorschau
                  ? await werkzeug.vorschau(parameter, kontext)
                  : { zusammenfassung: `${werkzeug.titel} ausführen` };
                const vorbereitungId = randomUUID();
                const gueltigBis = new Date(Date.now() + VERFALL_MINUTEN * 60_000);
                await sqlPool`
                  INSERT INTO fiaon_assistent_vorbereitungen
                    (id, sitzung_id, besitzer_typ, besitzer_id, werkzeug, parameter, zusammenfassung, vorschau_html, warnung, gueltig_bis)
                  VALUES (${vorbereitungId}, ${sitzung.id}, ${s.typ}, ${s.besitzerId}, ${werkzeug.name},
                          ${JSON.stringify(parameter)}, ${vorschau.zusammenfassung},
                          ${vorschau.vorschauHtml || null}, ${vorschau.warnung || null}, ${gueltigBis})
                `;
                sende({
                  art: "bestaetigung", id: vorbereitungId, werkzeug: werkzeug.name, titel: werkzeug.titel,
                  zusammenfassung: vorschau.zusammenfassung, warnung: vorschau.warnung || null,
                  hatVorschau: !!vorschau.vorschauHtml, gueltigBis: gueltigBis.toISOString(),
                });
                karten.push({ typ: "bestaetigung", id: vorbereitungId, werkzeug: werkzeug.name, titel: werkzeug.titel, zusammenfassung: vorschau.zusammenfassung, status: "offen" });
                antwortAnModell({ vorbereitet: true, id: vorbereitungId, zusammenfassung: vorschau.zusammenfassung, hinweis: "Wartet auf die Bestätigung des Menschen. Nicht erneut aufrufen." });
              } catch (err: any) {
                const grund = String(err?.message || "Vorbereitung fehlgeschlagen");
                sende({ art: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: "fehlgeschlagen", fehler: grund });
                karten.push({ typ: "werkzeug", id: aufrufId, name: werkzeug.name, titel: werkzeug.titel, status: "fehlgeschlagen", fehler: grund });
                antwortAnModell({ ok: false, error: grund });
              }
            }
          }
        }

        await nachrichtSchreiben(sitzung.id, "assistent", antwortText, karten);
        sende({ art: "zustand", wert: "fertig" });
        sende({ art: "fertig", sitzungId: sitzung.id });
      } finally {
        clearTimeout(zeitgrenze);
        clearInterval(puls);
      }
      res.end();
    } catch (err: any) {
      console.error("[ASSISTENT] chat:", err);
      if (sende) {
        sende({ art: "zustand", wert: "fehler" });
        sende({ art: "fehler", text: String(err?.message || "Serverfehler") });
        res.end();
      } else if (!res.headersSent) {
        res.status(500).json({ ok: false, error: "Serverfehler" });
      }
    }
  });

  // ── Bestätigen: der Mensch klickt, DANN wird ausgeführt ──────────────────
  router.post(`${pfadBasis}/bestaetigen/:id`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const id = String(req.params.id || "");
      const [v] = (await sqlPool`
        SELECT * FROM fiaon_assistent_vorbereitungen
        WHERE id = ${id} AND besitzer_typ = ${s.typ} AND besitzer_id = ${s.besitzerId}
      `) as any[];
      if (!v) return res.status(404).json({ ok: false, error: "Vorbereitung nicht gefunden." });
      if (v.status !== "offen") return res.status(409).json({ ok: false, error: `Diese Aktion ist bereits ${v.status}.` });
      if (new Date(v.gueltig_bis).getTime() < Date.now()) {
        await sqlPool`UPDATE fiaon_assistent_vorbereitungen SET status = 'abgelaufen', erledigt_am = NOW() WHERE id = ${id}`;
        return res.status(410).json({ ok: false, error: "Die Vorbereitung ist abgelaufen (15 Minuten). Bitte den Auftrag neu stellen." });
      }
      const werkzeug = werkzeugVonName(String(v.werkzeug));
      if (!werkzeug) return res.status(410).json({ ok: false, error: "Dieses Werkzeug gibt es nicht mehr." });
      const erlaubt = werkzeugeFuerRolle(s.rolle, s.hatAgentZugang).some((w) => w.name === werkzeug.name);
      if (!erlaubt) return res.status(403).json({ ok: false, error: "Deine Rolle darf dieses Werkzeug nicht ausführen." });

      const parameter = typeof v.parameter === "string" ? JSON.parse(v.parameter) : v.parameter;
      const ergebnis = await werkzeug.ausfuehren(parameter, kontextFuer(s));
      const gut = ergebnis?.ok !== false;
      await sqlPool`
        UPDATE fiaon_assistent_vorbereitungen
        SET status = ${gut ? "ausgefuehrt" : "fehlgeschlagen"}, ergebnis = ${JSON.stringify(ergebnis ?? null)}, erledigt_am = NOW()
        WHERE id = ${id}
      `;
      if (gut) {
        await aktionProtokollieren(s, werkzeug, parameter, String(v.zusammenfassung || werkzeug.titel));
        await nachrichtSchreiben(Number(v.sitzung_id), "assistent", "", [{
          typ: "werkzeug", id, name: werkzeug.name, titel: werkzeug.titel, status: "erledigt", ergebnis,
        }]);
      }
      res.json({ ok: gut, ergebnis, error: gut ? undefined : (ergebnis?.error || "Ausführung fehlgeschlagen") });
    } catch (err) {
      console.error("[ASSISTENT] bestaetigen:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  // ── Verwerfen: der Mensch sagt Nein ──────────────────────────────────────
  router.post(`${pfadBasis}/verwerfen/:id`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const id = String(req.params.id || "");
      const [v] = (await sqlPool`
        SELECT id, status FROM fiaon_assistent_vorbereitungen
        WHERE id = ${id} AND besitzer_typ = ${s.typ} AND besitzer_id = ${s.besitzerId}
      `) as any[];
      if (!v) return res.status(404).json({ ok: false, error: "Vorbereitung nicht gefunden." });
      if (v.status !== "offen") return res.status(409).json({ ok: false, error: `Diese Aktion ist bereits ${v.status}.` });
      await sqlPool`UPDATE fiaon_assistent_vorbereitungen SET status = 'verworfen', erledigt_am = NOW() WHERE id = ${id}`;
      res.json({ ok: true });
    } catch (err) {
      console.error("[ASSISTENT] verwerfen:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

  // ── Vorschau einer Vorbereitung (Mail-HTML fürs iframe) ──────────────────
  router.get(`${pfadBasis}/vorbereitungen/:id/vorschau`, async (req: any, res: Response) => {
    try {
      await ensureAssistentTabellen();
      const s = await wer(req);
      const [v] = (await sqlPool`
        SELECT vorschau_html FROM fiaon_assistent_vorbereitungen
        WHERE id = ${String(req.params.id || "")} AND besitzer_typ = ${s.typ} AND besitzer_id = ${s.besitzerId}
      `) as any[];
      if (!v) return res.status(404).json({ ok: false, error: "Vorbereitung nicht gefunden." });
      res.json({ ok: true, html: v.vorschau_html || null });
    } catch (err) {
      console.error("[ASSISTENT] vorschau:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });
}

// ── Die zwei Türen ───────────────────────────────────────────────────────────
// Mitarbeiter-Tür: requireAgent schützt alle /agent/assistent-Routen.
router.use("/agent/assistent", requireAgent as any);
routenBauen("/agent/assistent", (req) => sitzenderAusAgent(req as AgentRequest));

// Chef-Tür: requireChef("geschaeftsfuehrung") schützt alle /chef/assistent-Routen.
router.use("/chef/assistent", requireChef("geschaeftsfuehrung") as any);
routenBauen("/chef/assistent", (req) => sitzenderAusChef(req as ChefRequest));

export default router;
