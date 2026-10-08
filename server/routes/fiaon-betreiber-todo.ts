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
// E-IT-F (08.10.2026): Kunde, Art, Reihenfolge und Status kommen aus EINER Quelle
// (shared/fiaon-auftrag-arten.ts); Erledigen, Wieder-Öffnen, Zuordnen und die
// automatische Erledigung durch Ereignisse aus server/lib/fiaon-auftraege.ts.
import {
  AUFTRAG_ARTEN, artNachInhalt, artRegel, auftragArtVon, auftragHerkunft, auftraegeSortieren, naechsterAuftrag,
  nameAusTitel, refAusLink as refAusLinkQuelle, ZUSTAND_WIEDER_OFFEN_TAGE, berlinTagZeit, type AuftragRichtung,
} from "../../shared/fiaon-auftrag-arten";
import {
  auftragBeitrag, auftragErledigen, auftragWiederOeffnen, auftraegeZuordnen, auftraegeZuordnenNachholen,
  ensureAuftragSpalten, personWurzel, statusWandDa, uebergabeEntwuerfeUebernehmen,
} from "../lib/fiaon-auftraege";

const router = Router();

// E-IT-F (08.10.2026): Kunde und Art für Aufträge ohne Zuordnung nachtragen — der Altbestand
// beim ersten Lauf nach dem Deploy, danach, was Wege ohne Kundenwissen angelegt haben.
// Über tageslauf: nur mit scharfen Läufen (CRONS_AN), nie in Prüfständen. Die Listen
// ordnen beim Laden ihre eigenen Zeilen ohnehin selbst zu.
import("../lib/fiaon-crons").then(({ tageslauf }) => {
  tageslauf("auftraege-zuordnen", () => auftraegeZuordnenNachholen(), 3 * 3600_000, { beimStartNach: 90_000 });
}).catch((e) => console.error("[AUFTRÄGE] Zuordnungslauf nicht angemeldet:", e));
// E-030 (24.08.2026): VORHER gab es sieben Bereiche, alle aus Justins eigener
// Liste — für einen technischen Fehler, den ein MITARBEITER meldet, war keiner
// davon ehrlich („sonstiges" verschwindet zwischen Presse-Fakten und
// Higgsfield-Guthaben). NACHHER gibt es „technik": alles, was aus dem Haus
// gemeldet wird und repariert werden muss. Grund: Justins Auftrag vom
// 24.08.2026, ein unzustellbarer Brief soll an die IT gehen können.
// 04.09.2026 (E-115): „postmeister" — Aufgaben, die Mara aus dem Postfach
// anlegt. Die Werkzeuge schrieben den Bereich schon seit dem 02.09., er war
// hier nur nicht eingetragen: keine Farbe, kein Label, PATCH lehnte ihn ab.
export const TODO_BEREICHE = ["make", "brevo", "konten", "entscheidung", "pruefen", "partner", "technik", "postmeister", "sonstiges"] as const;
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
  // E-IT-F (08.10.2026): VORHER setzte dieser Start JEDE Zeile mit erledigt_am auf „erledigt" — eine
  // zweite Wahrheit, die wieder geöffnete Aufträge nach dem nächsten Deploy still zurückschloss (#967).
  // NACHHER entscheidet die Wand in der Datenbank (Migration 102, Trigger fiaon_todo_status_wand): status
  // ist die eine Quelle, erledigt_am folgt ihm. Nur wo die Wand fehlt (lokale Datenbank ohne Migration),
  // bleibt der alte Abgleich als Notbehelf.
  if (!(await statusWandDa())) {
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt' WHERE erledigt_am IS NOT NULL AND status <> 'erledigt'`;
  }
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
  await ensureAustauschSpalten();
  await ensureAuftragSpalten();
  geprueft = true;
  // 04.09.2026 (E-117): Die Anrede der Mitarbeiter braucht der Postmeister bei
  // jedem Auftrag — die Spalte muss da sein, bevor irgendeine Team-Route lief.
  await sqlPool`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS anrede VARCHAR`.catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// E-029 (24.08.2026) — DER AUSTAUSCH GEHT IN BEIDE RICHTUNGEN
//
// VORHER: Der Mitarbeiter konnte fragen, Justin konnte antworten. Was fehlte:
//   1. Justin konnte selbst KEINE Frage stellen, die eine Antwort verlangt —
//      seine Nachricht war immer nur ein Kommentar, den niemand beantworten
//      musste. Ein Austausch, der nur in eine Richtung eine Pflicht kennt,
//      ist ein Briefkasten.
//   2. Niemand sah, ob die Gegenseite das Geschriebene schon GELESEN hat.
//      Der Mitarbeiter wusste nicht, dass Justin geantwortet hat, bis er
//      zufällig die Zeitleiste aufklappte.
//
// NACHHER: drei additive Spalten.
//   frage_an_agent       Justin hat eine Frage gestellt, die der Mitarbeiter
//                        beantworten muss. Seine nächste Nachricht ist die
//                        Antwort und löscht die Marke.
//   agent_gelesen_am     Wann der Mitarbeiter den Verlauf zuletzt gesehen hat.
//   betreiber_gelesen_am Wann Justin ihn zuletzt gesehen hat.
//
// Aus den beiden Zeitpunkten wird die Marke abgeleitet, statt sie zu zählen:
// Was nach dem Lesezeitpunkt geschrieben wurde, ist neu — sonst nicht. So
// verschwindet die Marke ZWANGSLÄUFIG, sobald jemand hingesehen hat, und
// kann nie eine Zahl anzeigen, die es nicht mehr gibt (Justins Kritik vom
// 24.08. an Marken, die stehen bleiben).
//
// Grund für den eigenen Lauf mit lock_timeout: Vorbild ensureVertriebSpalten
// in fiaon-office-vertrieb.ts. Ein ALTER hinter einer langen Transaktion
// legt sonst alle folgenden Abfragen auf die Tabelle still.
// ═══════════════════════════════════════════════════════════════════════════
let austauschBereit: Promise<void> | null = null;
function ensureAustauschSpalten(): Promise<void> {
  if (!austauschBereit) {
    austauschBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_betreiber_todos
          ADD COLUMN IF NOT EXISTS frage_an_agent BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS agent_gelesen_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS betreiber_gelesen_am TIMESTAMPTZ`;
      });
    })().catch((e) => { austauschBereit = null; throw e; });
  }
  return austauschBereit;
}

type BeitragArt = "kommentar" | "frage" | "antwort" | "ergebnis" | "status";
// E-IT-F: Menschen schreiben, so oft sie wollen; das System schreibt denselben Text
// nie zweimal hintereinander (524 gleiche Systemzeilen an 12 Einladungs-Aufträgen).
async function beitrag(todoId: number, b: { autorArt: "betreiber" | "agent" | "system"; autorName: string; autorAgentId?: number | null; art: BeitragArt; text: string }): Promise<void> {
  await auftragBeitrag(todoId, b, sqlPool, { doppeltErlaubt: b.autorArt !== "system" });
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

// ═══════════════════════════════════════════════════════════════════════════
// E-115 (04.09.2026) — AUFGABE FÜR DEN BETREUER EINES KUNDEN, VOM SERVER
//
// VORHER: Wer aus einem Modul heraus einem Mitarbeiter eine Aufgabe geben
// wollte, schrieb selbst ein INSERT (Postmeister, Rückruf, Nicht-erreicht) —
// jedes mit eigener Zuständigkeits-Regel, eins davon mit Rollen, die es gar
// nicht gibt („vertriebsleitung", „leitung"). Und keiner schickte die Mail,
// die /admin/vermerke schickt: der Mitarbeiter sah die Aufgabe erst beim
// nächsten Portalbesuch.
//
// NACHHER: Eine Funktion. Betreuer über die eine Zuständigkeitsableitung
// (fiaon-zustaendigkeit.ts), sonst — je nach Lage — der Forderungsmanager
// oder die Vertriebsleitung mit den wenigsten offenen Aufträgen, sonst der
// Betreiber. Übergabe über `delegieren()` (Zeitleiste, ungelesen-Zustand),
// Mail „Neuer Auftrag für dich" über denselben Weg wie die Vermerke.
// ═══════════════════════════════════════════════════════════════════════════
export interface AuftragEin {
  personId: number | null;
  ref: string | null;
  titel: string;
  text: string;
  /** YYYY-MM-DD — sonst +2 Tage (dringend: heute). */
  faelligAm?: string | null;
  dringend?: boolean;
  /** Idempotenz-Schlüssel — ohne ihn wird immer neu angelegt. */
  schluessel?: string | null;
  quelle?: string;
  bereich?: string;
  link?: string | null;
  /** Wer die Aufgabe stellt — steht in der Zeitleiste. */
  autorName?: string;
  /** true = bleibt beim Betreiber (Justin), wird NICHT an einen Mitarbeiter
   *  übergeben — für alles, was nur die Zahlungsstelle prüfen kann (05.09.2026). */
  anBetreiber?: boolean;
  /** Ausdrücklich dieser Mitarbeiter (z. B. weil der Kunde ihn nennt) — statt der Ableitung. */
  agentId?: number | null;
  /**
   * E-IT-F (Gegenprüfung 08.10.): agentId ist eine AUSDRÜCKLICHE Zuweisung (Leitung, vom Kunden genannt) —
   * sie gilt auch, wenn der Auftrag schon bei einem aktiven Kollegen liegt. Ohne vorrang hängt ein
   * bestehender Auftrag nur um, wenn der Zuständige nicht arbeiten kann.
   */
  vorrang?: boolean;
  /**
   * Der erste Satz in der Zeitleiste (11.09.2026, E-177). Ohne ihn steht dort
   * „Angelegt von … aus dem Postfach" — für eine Bewerbung von der Website
   * wäre das falsch.
   */
  anlageText?: string;
  /**
   * E-248 (28.09.2026): still anhängen — gibt es die Aufgabe schon, kommt der Text als Beitrag
   * dazu, OHNE sie wieder auf „ungelesen" zu setzen (keine neue Meldung „Neu von Mara") und
   * ohne eine erledigte Aufgabe wieder zu öffnen. Für Maras Nachträge zur selben Sache
   * (Fall K.: jede Nachricht setzte dieselbe Aufgabe neu auf ungelesen).
   */
  still?: boolean;
  /**
   * E-IT-F (08.10.2026): Was meldet der Erzeuger, wenn es die Aufgabe schon gibt?
   *   'neu'     eine NEUE Sache (Kundenmail, WhatsApp, neue Rate) — öffnet eine
   *             erledigte Aufgabe wieder, SICHTBAR mit Grund („Wieder offen: …").
   *   'zustand' eine fortbestehende LAGE (Adresse unzustellbar, Einladung fehlt) —
   *             öffnet eine erledigte Aufgabe erst nach ZUSTAND_WIEDER_OFFEN_TAGE
   *             wieder; vorher bleibt sie zu (sonst Pendeln: #966 fünfmal erledigt).
   * Standard: 'neu'.
   */
  anlass?: "neu" | "zustand";
}

/** Ein bestimmter aktiver Mitarbeiter als Empfänger. */
export async function empfaengerNachId(agentId: number): Promise<Empfaenger | null> {
  const [a] = (await sqlPool`
    SELECT id, name, email, first_name, last_name, anrede FROM fiaon_agents
     WHERE id = ${agentId} AND COALESCE(active, TRUE) = TRUE AND COALESCE(is_test_account, FALSE) = FALSE LIMIT 1
  `.catch(() => [])) as any[];
  return a?.id ? { id: Number(a.id), name: String(a.name), email: a.email ?? null, vorname: a.first_name ?? null, nachname: a.last_name ?? null, anrede: a.anrede ?? null, kundenName: kundenName(a) } : null;
}

/**
 * Den Mitarbeiter finden, den ein Kunde nennt („Frau Rifka", „Herr Stripling",
 * „Daniel") — Vor- oder Nachname, ohne Anrede, unscharf. Nur aktive, echte Konten.
 * Mehrdeutig (zwei Treffer) = kein Treffer: lieber die Ableitung als der Falsche.
 */
export async function mitarbeiterNachName(roh: string): Promise<Empfaenger | null> {
  const name = String(roh || "").replace(/\b(herrn?|frau|mr\.?|ms\.?|mrs\.?)\b/gi, "").replace(/[^A-Za-zÀ-ÿĀ-žА-яЁё\s-]/g, " ").trim().toLowerCase();
  if (name.length < 3) return null;
  const teile = name.split(/\s+/).filter((t) => t.length >= 3);
  if (!teile.length) return null;
  const alle = (await sqlPool`
    SELECT id, name, email, first_name, last_name, anrede FROM fiaon_agents
     WHERE COALESCE(active, TRUE) = TRUE AND COALESCE(is_test_account, FALSE) = FALSE
  `.catch(() => [])) as any[];
  const treffer = alle.filter((a) => {
    const vor = String(a.first_name || "").toLowerCase(), nach = String(a.last_name || "").toLowerCase(), voll = String(a.name || "").toLowerCase();
    return teile.every((t) => vor.startsWith(t) || nach.startsWith(t) || voll.includes(t));
  });
  if (treffer.length !== 1) return null;
  const a = treffer[0];
  return { id: Number(a.id), name: String(a.name), email: a.email ?? null, vorname: a.first_name ?? null, nachname: a.last_name ?? null, anrede: a.anrede ?? null, kundenName: kundenName(a) };
}
export interface AuftragErgebnis {
  id: number | null;
  agentId: number | null;
  agentName: string | null;
  /** So heißt der Mitarbeiter dem Kunden gegenüber („Herr Stripling"). */
  kundenName: string | null;
  anBetreiber: boolean;
  faelligAm: string;
}

/**
 * Der Mensch für diese Aufgabe: Betreuer, sonst Rolle passend zur Lage, sonst Betreiber.
 *
 * Exportiert (E-116, 04.09.2026): Die Werkzeuge des Postmeisters (`zustaendig()`
 * in fiaon-postmeister-werkzeuge.ts) nutzen DIESELBE Ableitung. Vorher gab es
 * dort eine zweite — und der Praxistest an der echten Datenbank zeigte für
 * denselben Kunden ohne Betreuer zwei Antworten: Notiz an Daniel (erster nach
 * id), Auftrag an Florentine (wenigste offene Aufträge).
 */
export interface Empfaenger { id: number | null; name: string | null; email: string | null; vorname: string | null; nachname: string | null; anrede: string | null; kundenName: string | null }

/**
 * So heißt der Mitarbeiter dem KUNDEN gegenüber (04.09.2026, Justin: „eher den
 * Nachnamen des Mitarbeiters"): „Herr Stripling", wenn die Anrede gepflegt ist,
 * sonst der volle Name „Daniel Stripling" — nie nur der Vorname.
 */
export function kundenName(a: { anrede?: string | null; first_name?: string | null; last_name?: string | null; name?: string | null }): string | null {
  const nach = String(a.last_name || "").trim();
  const vor = String(a.first_name || "").trim();
  const anrede = String(a.anrede || "").trim();
  if (anrede && nach) return `${anrede} ${nach}`;
  if (vor && nach) return `${vor} ${nach}`;
  return String(a.name || "").trim() || null;
}

export async function auftragEmpfaenger(personId: number | null): Promise<Empfaenger> {
  await ensureTodoTabelle().catch(() => {});
  if (personId) {
    try {
      const { zustaendigeRolle } = await import("../lib/fiaon-zustaendigkeit");
      const z = await zustaendigeRolle(personId);
      if (z?.agentId) {
        const [a] = (await sqlPool`
          SELECT id, name, email, first_name, last_name, anrede FROM fiaon_agents
           WHERE id = ${z.agentId} AND COALESCE(active, TRUE) = TRUE AND COALESCE(is_test_account, FALSE) = FALSE AND zugang_gesperrt_am IS NULL LIMIT 1
        `) as any[];
        if (a?.id) return { id: Number(a.id), name: String(a.name), email: a.email ?? null, vorname: a.first_name ?? null, nachname: a.last_name ?? null, anrede: a.anrede ?? null, kundenName: kundenName(a) };
      }
      // Niemand eingetragen: die Rolle, die zur Lage passt, mit der kleinsten Last.
      const rollen = z?.rolle === "inkasso" ? ["inkasso", "vertriebsleiter"] : ["vertriebsleiter"];
      const [f] = (await sqlPool`
        SELECT ag.id, ag.name, ag.email, ag.first_name, ag.last_name, ag.anrede,
               (SELECT COUNT(*)::int FROM fiaon_betreiber_todos t
                 WHERE t.zustaendig_agent_id = ag.id AND t.status <> 'erledigt') AS offene
          FROM fiaon_agents ag
         WHERE COALESCE(ag.active, TRUE) = TRUE AND ag.rolle = ANY(${rollen})
           AND COALESCE(ag.is_test_account, FALSE) = FALSE
           AND ag.zugang_gesperrt_am IS NULL
         ORDER BY (ag.rolle = ${rollen[0]}) DESC, offene ASC, ag.id ASC LIMIT 1
      `) as any[];
      if (f?.id) return { id: Number(f.id), name: String(f.name), email: f.email ?? null, vorname: f.first_name ?? null, nachname: f.last_name ?? null, anrede: f.anrede ?? null, kundenName: kundenName(f) };
    } catch (e) {
      console.error("[TODO] Empfänger:", String(e).slice(0, 160));
    }
  }
  const [l] = (await sqlPool`
    SELECT id, name, email, first_name, last_name, anrede FROM fiaon_agents
     WHERE COALESCE(active, TRUE) = TRUE AND rolle = 'vertriebsleiter' AND COALESCE(is_test_account, FALSE) = FALSE AND zugang_gesperrt_am IS NULL
     ORDER BY id ASC LIMIT 1
  `.catch(() => [])) as any[];
  return l?.id ? { id: Number(l.id), name: String(l.name), email: l.email ?? null, vorname: l.first_name ?? null, nachname: l.last_name ?? null, anrede: l.anrede ?? null, kundenName: kundenName(l) } : { id: null, name: null, email: null, vorname: null, nachname: null, anrede: null, kundenName: null };
}

export async function auftragFuerKunden(ein: AuftragEin): Promise<AuftragErgebnis> {
  await ensureTodoTabelle();
  const titel = String(ein.titel || "").trim().slice(0, 160) || "Aufgabe aus dem Postfach";
  const text = String(ein.text || "").trim().slice(0, 4000);
  const heute = new Date();
  const faelligAm = ein.faelligAm && /^\d{4}-\d{2}-\d{2}$/.test(ein.faelligAm)
    ? ein.faelligAm
    : new Date(heute.getTime() + (ein.dringend ? 0 : 2) * 864e5).toISOString().slice(0, 10);
  const prioritaet = ein.dringend ? 1 : 2;
  const bereich = ein.bereich && (TODO_BEREICHE as readonly string[]).includes(ein.bereich) ? ein.bereich : "postmeister";
  const link = ein.link ?? (ein.ref ? `/admin/kunde/${ein.ref}` : null);
  const quelle = ein.quelle ?? "postmeister";
  // Zahlungen prüft nur die Zahlungsstelle (Justin, Bankbuch). Florentine
  // (05.09.): „Kunde schreibt, er habe am 20.08. bezahlt, und die KI sagt, ich
  // solle das kontrollieren" — sie kann es nicht, sie sieht kein Konto.
  const wer: Empfaenger = ein.anBetreiber
    ? { id: null, name: null, email: null, vorname: null, nachname: null, anrede: null, kundenName: null } as Empfaenger
    : (ein.agentId ? await empfaengerNachId(ein.agentId) : null) ?? await auftragEmpfaenger(ein.personId);

  // E-IT-F (08.10.2026): Kunde und Art stehen ab der Anlage als Datenfeld — die Liste muss sie
  // nicht mehr aus dem Link raten. Die Person wird zur Wurzel aufgelöst (zusammengeführte Dubletten).
  const personId = ein.personId ? (await personWurzel(Number(ein.personId)).catch(() => null)) ?? null : null;
  const refFeld = ein.ref ? String(ein.ref).toUpperCase() : refAusLinkQuelle(link);
  const art = auftragArtVon({ schluessel: ein.schluessel ?? null, quelle, bereich, titel, text });
  // Meldet der Erzeuger jetzt eine Art, die nur ein Mensch schließt (Auskunft bezahlt, Beschwerde), gilt
  // sie auch für den bestehenden Auftrag — nie umgekehrt (ein Hand-Auftrag wird nie automatisch schließbar).
  const artNurHand = artRegel(art).nurHand && !["sonstiges", "hand", "verwaltung"].includes(art);
  const anlass = ein.anlass ?? "neu";

  let id: number | null = null;
  if (ein.schluessel) {
    const [neuZeile] = (await sqlPool`
      INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, faellig_am, link, quelle, status,
                                         person_id, ref, art, zugeordnet_am, eingang_am, neu_seit)
      VALUES (${ein.schluessel}, ${titel}, ${text}, ${bereich}, ${prioritaet}, ${faelligAm}, ${link}, ${quelle}, 'offen',
              ${personId}, ${refFeld}, ${art}, ${personId || refFeld ? new Date() : null}, NOW(), NOW())
      ON CONFLICT (schluessel) DO NOTHING
      RETURNING id
    `) as any[];
    id = neuZeile?.id ? Number(neuZeile.id) : null;
    if (!id) {
      // ── DIE AUFGABE GIBT ES SCHON ─────────────────────────────────────────
      // VORHER (bis 07.10.2026): ON CONFLICT setzte „erledigt" still auf „offen", hängte den Text bei
      // JEDEM Lauf erneut an (bis 156× derselbe Hinweis) und übergab neu, wenn die Ableitung gerade
      // einen anderen Menschen lieferte — #967 pendelte sechsmal zwischen Daniel und Florentine.
      // NACHHER: Text nur, wenn er neu ist; wieder öffnen nur nach Anlass und immer mit Grund; nie gegen
      // einen aktiven Zuständigen umhängen (Hand-Übergabe, Umverteilung, Vertretung bleiben stehen).
      const [alt] = (await sqlPool`
        SELECT id, status, text, erledigt_am, zustaendig_art, zustaendig_agent_id, person_id, ref, art
          FROM fiaon_betreiber_todos WHERE schluessel = ${ein.schluessel}`) as any[];
      if (!alt) return { id: null, agentId: null, agentName: null, kundenName: null, anBetreiber: true, faelligAm };
      id = Number(alt.id);
      const altText = String(alt.text ?? "");
      const textNeu = !!text && !altText.includes(text);
      // Fertigstellung 08.10. (Gegenprüfung, Fund 13): ATOMAR anhängen — zwei Meldungen desselben Schlüssels
      // zugleich (zwei Webhooks, zwei Postfach-Läufe) lasen beide altText, die spätere überschrieb den Block der
      // ersten; ohne ihre „[Mail #id]“ hätte uebergabeSchliessen den Auftrag trotz offener Mail geschlossen.
      // Die Datenbank entscheidet am gesperrten Stand der Zeile; textNeu dient nur noch Beitrag und Wieder-Öffnen.
      await sqlPool`
        UPDATE fiaon_betreiber_todos
           SET text = CASE WHEN ${text}::text = '' OR strpos(COALESCE(text, ''), ${text}::text) > 0 THEN text
                           ELSE CONCAT_WS(E'\n\n', NULLIF(text, ''), ${text}::text) END,
               prioritaet = LEAST(prioritaet, ${prioritaet}),
               faellig_am = LEAST(COALESCE(faellig_am, ${faelligAm}::date), ${faelligAm}::date),
               person_id = COALESCE(person_id, ${personId}), ref = COALESCE(ref, ${refFeld}),
               art = CASE WHEN ${artNurHand} THEN ${art} ELSE COALESCE(art, ${art}) END, zugeordnet_am = COALESCE(zugeordnet_am, CASE WHEN ${!!(personId || refFeld)} THEN NOW() END),
               updated_at = NOW()
         WHERE id = ${id}`;
      const erledigt = alt.status === "erledigt";
      const zustandAbgelaufen = !!alt.erledigt_am && Date.now() - new Date(alt.erledigt_am).getTime() > ZUSTAND_WIEDER_OFFEN_TAGE * 864e5;
      let geoeffnet = false;
      if (erledigt && !ein.still && (anlass === "neu" ? textNeu : zustandAbgelaufen)) {
        geoeffnet = await auftragWiederOeffnen(id, anlass === "neu"
          ? `neue Meldung von ${ein.autorName ?? "Mara"} – ${titel}`
          : `Lage besteht weiter (${ZUSTAND_WIEDER_OFFEN_TAGE} Tage nach dem Erledigen) – ${titel}`, { neu: true });
      } else if (!erledigt && !ein.still && anlass === "neu" && textNeu) {
        // 18.09.2026 (Team-Feedback Priorität 6) / 25.09.2026 (E-240): Eine zweite Nachricht desselben
        // Kunden ist NEU für den Mitarbeiter — sie steht wieder als ungelesen da (Popup „Neu von Mara").
        // E-IT-F: über neu_seit, nicht über letzte_aktivitaet — eine Übergabe oder Systemzeile ist keine Neuigkeit.
        await sqlPool`UPDATE fiaon_betreiber_todos SET agent_gelesen_am = NULL, neu_seit = NOW(), letzte_aktivitaet = NOW(), updated_at = NOW() WHERE id = ${id}`.catch(() => {});
      }
      if (textNeu) await beitrag(id, { autorArt: "system", autorName: ein.autorName ?? "Mara", art: "kommentar", text: text.slice(0, 2000) }).catch(() => {});
      // Umhängen nur, wenn der jetzige Zuständige nicht mehr arbeiten kann (inaktiv, gesperrt, Testkonto,
      // laut Abwesenheit vertreten). Was beim Betreiber liegt, bleibt dort: Zahlungsprüfungen
      // (anBetreiber) und zurückgegebene Aufgaben dürfen nicht zurück an einen Mitarbeiter springen.
      const jetzt = alt.zustaendig_art === "agent" ? Number(alt.zustaendig_agent_id) : null;
      // Fertigstellung 08.10. (Nachprüfung, Fund 10 Teil 3): Ein WIEDER GEÖFFNETER Auftrag ist eine neue Sache — er geht
      // an den, der JETZT zuständig ist (Betreuer bzw. Ableitung, Vertreter; Zahlungsprüfung/Global: das Board), nicht an
      // den früheren Bearbeiter (vor dem Umbau ebenso). Nur beim Wieder-Öffnen: Ein offener Auftrag hängt weiter nie um.
      if (geoeffnet) {
        const ziel = ein.anBetreiber ? null : wer.id;
        if (ziel && ziel !== jetzt && (await kannArbeiten(ziel))) {
          await delegieren(id, ziel, "", { neu: true });
          await beitrag(id, { autorArt: "system", autorName: "System", art: "kommentar", text: `Wieder geöffnet und an ${wer.name} gegeben — ${wer.name} ist jetzt zuständig.` }).catch(() => {});
          await zuweisungMelden(id, wer, ein, titel, text, faelligAm, quelle);
          return { id, agentId: wer.id, agentName: wer.name, kundenName: wer.kundenName, anBetreiber: false, faelligAm };
        }
        if (ein.anBetreiber && jetzt) {
          await delegieren(id, null, "");
          return { id, agentId: null, agentName: null, kundenName: null, anBetreiber: true, faelligAm };
        }
      }
      if (jetzt && wer.id !== jetzt && (geoeffnet || !erledigt) && !(await kannArbeiten(jetzt))) {
        if (wer.id) {
          await delegieren(id, wer.id, "", { neu: true });
          await zuweisungMelden(id, wer, ein, titel, text, faelligAm, quelle);
          return { id, agentId: wer.id, agentName: wer.name, kundenName: wer.kundenName, anBetreiber: false, faelligAm };
        }
        // Niemand im Team übernimmt (Zahlungsstelle, kein Betreuer): zurück aufs Board des Betreibers —
        // bei einem gesperrten Mitarbeiter wäre der Auftrag sonst unsichtbar (Gedächtnis 05.09.2026).
        await delegieren(id, null, "");
        return { id, agentId: null, agentName: null, kundenName: null, anBetreiber: true, faelligAm };
      }
      // Ausdrücklich gewünscht (Mara „an die Leitung“, der Kunde nennt jemanden): gilt auch gegen einen aktiven
      // Zuständigen (Gegenprüfung 08.10.: die Beschwerde landete beim Betreuer, die Leitung erfuhr nichts).
      // Nur mit `vorrang` — eine abgeleitete oder nach Last gewählte Person hängt nie um (kein Pendeln).
      if (ein.vorrang && ein.agentId && wer.id && wer.id === Number(ein.agentId) && jetzt && jetzt !== wer.id && (geoeffnet || !erledigt)) {
        await delegieren(id, wer.id, "", { neu: true });
        await beitrag(id, { autorArt: "system", autorName: ein.autorName ?? "Mara", art: "kommentar", text: `Ausdrücklich an ${wer.name} übergeben (${ein.autorName ?? "Mara"}): ${titel}` }).catch(() => {});
        await zuweisungMelden(id, wer, ein, titel, text, faelligAm, quelle);
        return { id, agentId: wer.id, agentName: wer.name, kundenName: wer.kundenName, anBetreiber: false, faelligAm };
      }
      const [stand] = (await sqlPool`SELECT zustaendig_art, zustaendig_agent_id, zustaendig_name FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
      const beiAgent = stand?.zustaendig_art === "agent" && stand?.zustaendig_agent_id;
      const e = beiAgent ? await empfaengerNachId(Number(stand.zustaendig_agent_id)) : null;
      return { id, agentId: beiAgent ? Number(stand.zustaendig_agent_id) : null, agentName: beiAgent ? String(stand.zustaendig_name || e?.name || "") || null : null, kundenName: e?.kundenName ?? null, anBetreiber: !beiAgent, faelligAm };
    }
  } else {
    const [r] = (await sqlPool`
      INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, faellig_am, link, quelle, status,
                                         person_id, ref, art, zugeordnet_am, eingang_am, neu_seit)
      VALUES (${titel}, ${text}, ${bereich}, ${prioritaet}, ${faelligAm}, ${link}, ${quelle}, 'offen',
              ${personId}, ${refFeld}, ${art}, ${personId || refFeld ? new Date() : null}, NOW(), NOW())
      RETURNING id
    `) as any[];
    id = r?.id ? Number(r.id) : null;
  }
  if (!id) return { id: null, agentId: null, agentName: null, kundenName: null, anBetreiber: true, faelligAm };

  if (wer.id) {
    await delegieren(id, wer.id, "", { neu: true });
    await beitrag(id, { autorArt: "system", autorName: ein.autorName ?? "Mara", art: "kommentar", text: ein.anlageText ?? `Angelegt von ${ein.autorName ?? "Mara"} aus dem Postfach.` }).catch(() => {});
    await zuweisungMelden(id, wer, ein, titel, text, faelligAm, quelle);
  }
  return { id, agentId: wer.id, agentName: wer.name, kundenName: wer.kundenName, anBetreiber: !wer.id, faelligAm };
}

/** Kann dieser Mitarbeiter gerade Aufträge bearbeiten? Aktiv, echt, nicht gesperrt, nicht laut Abwesenheit vertreten. */
async function kannArbeiten(agentId: number): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT id FROM fiaon_agents
     WHERE id = ${agentId} AND COALESCE(active, TRUE) = TRUE AND COALESCE(is_test_account, FALSE) = FALSE AND zugang_gesperrt_am IS NULL
  `.catch(() => [])) as any[];
  if (!a) return false;
  try {
    const abw = await import("../lib/fiaon-abwesenheit");
    return !abw.istAbwesend(await abw.abwesenheitJetzt(), agentId);
  } catch { return true; }
}

/** Die Mail „Neuer Auftrag für dich" und das Ereignis — nur bei einer ECHTEN Zuweisung, nie beim Anhängen. */
async function zuweisungMelden(id: number, wer: Empfaenger, ein: AuftragEin, titel: string, text: string, faelligAm: string, quelle: string): Promise<void> {
  if (!wer.id) return;
  {
    // Die Mail an den Mitarbeiter — derselbe Weg wie bei /admin/vermerke.
    if (wer.email) {
      let kunde: string | null = null;
      if (ein.ref) {
        const [k] = (await sqlPool`SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS n FROM fiaon_applications WHERE ref = ${ein.ref} LIMIT 1`.catch(() => [])) as any[];
        kunde = k?.n || null;
      }
      // 18.09.2026: Ohne Bestellung (z. B. Gesprächsanfrage FIAON Global) stand
      // „Platzhalter ohne Wert: kunde" im Protokoll — der Name kommt dann von der Person.
      if (!kunde && ein.personId) {
        const [p] = (await sqlPool`SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS n FROM fiaon_persons WHERE id = ${ein.personId} LIMIT 1`.catch(() => [])) as any[];
        kunde = p?.n || null;
      }
      if (!kunde) kunde = "ohne Kundenbezug";
      try {
        const { sendMakeWebhook } = await import("../make-webhook");
        const { absoluteUrl } = await import("../fiaon-base-url");
        await sendMakeWebhook("aufgabe_zugewiesen", {
          email: wer.email, vorname: wer.vorname || wer.name,
          aufgabe: `${titel}${text ? ` — ${text.slice(0, 600)}` : ""}`, kunde,
          faellig_am: faelligAm,
          faellig_am_text: new Date(`${faelligAm}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
          dringend: !!ein.dringend, portal_url: absoluteUrl("/agent/aufgaben"),
        });
      } catch { /* die Aufgabe steht — die Mail ist ein Zusatz */ }
      await sqlPool`
        INSERT INTO fiaon_agent_events (agent_id, type, meta)
        VALUES (${wer.id}, 'aufgabe_zugewiesen', ${JSON.stringify({ todo_id: id, ref: ein.ref || null, faellig_am: faelligAm, quelle })})
      `.catch(() => {});
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// E-030 (24.08.2026) — MELDUNGEN AUS DEM HAUS AN DIE IT
//
// ── VORHER ────────────────────────────────────────────────────────────────
// Stiess ein Mitarbeiter im Alltag auf einen technischen Fehler — etwa eine
// Mail, die beim Kunden nicht ankommt —, stand der Hinweis in seinem
// Posteingang und endete dort. Ein Satz ohne Empfänger. Wer es trotzdem
// melden wollte, schrieb es irgendwohin oder liess es bleiben.
//
// ── NACHHER (Auftrag Justin, 24.08.2026 wörtlich: es muss in der
//    Fehlermeldung etwas geben wie „Problem an die IT senden", und dann kommt
//    das zu den Admins) ───────────────────────────────────────────────────
// Die Meldung wird eine Aufgabe des Betreibers im Bereich „technik" — auf
// demselben Brett, das der Betreiber ohnehin täglich ansieht, mit Status,
// Übergabe an einen Mitarbeiter und Zeitleiste. Weil zustaendig_art auf
// „betreiber" steht, zählt todoOffenZahl() sie sofort mit: die Meldung ist
// unübersehbar, ohne dass irgendwo ein zweiter Zähler entsteht.
//
// KEINE dritte Tabelle, und bewusst KEIN Ticket (fiaon_tickets): Ein Ticket
// hängt immer an einer Kundenkennung, und der Kunde LIEST seine Tickets in
// seinem Bereich (GET /kunde/:ref/tickets). Eine interne Fehlermeldung über
// ihn hätte dort nichts zu suchen.
//
// ── DOPPELTE MELDUNGEN ────────────────────────────────────────────────────
// Verhindert der SCHLÜSSEL, nicht die Oberfläche. Er wird aus dem gemeldeten
// Datensatz gebildet (etwa aus der Kennung der Protokollzeile) und ist in der
// Tabelle eindeutig. Ein zweiter Klick — auch von einem Kollegen, auch morgen
// — trifft auf ON CONFLICT DO NOTHING und legt nichts Neues an. Ein
// mitgeschickter Satz geht trotzdem nicht verloren: er wird an die Zeitleiste
// der bestehenden Meldung gehängt.
// ═══════════════════════════════════════════════════════════════════════════
export async function todoMeldung(
  schluessel: string,
  t: { titel: string; text: string; bereich?: string; prioritaet?: number; link?: string | null },
  melder: { name: string; agentId: number | null; notiz?: string | null },
): Promise<{ id: number; neu: boolean }> {
  await ensureTodoTabelle();
  const bereich = (TODO_BEREICHE as readonly string[]).includes(String(t.bereich)) ? String(t.bereich) : "technik";
  const notiz = String(melder.notiz ?? "").trim().slice(0, 2000);
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, link, quelle, letzte_aktivitaet)
    VALUES (${schluessel}, ${t.titel}, ${t.text}, ${bereich}, ${t.prioritaet ?? 2}, ${t.link ?? null}, 'meldung', NOW())
    ON CONFLICT (schluessel) DO NOTHING
    RETURNING id`) as any[];
  if (neu) {
    await beitrag(Number(neu.id), {
      autorArt: "agent", autorName: melder.name, autorAgentId: melder.agentId, art: "kommentar",
      text: notiz ? `Gemeldet von ${melder.name}: ${notiz}` : `Gemeldet von ${melder.name}.`,
    });
    return { id: Number(neu.id), neu: true };
  }
  const [alt] = (await sqlPool`SELECT id FROM fiaon_betreiber_todos WHERE schluessel = ${schluessel}`) as any[];
  if (!alt) throw new Error("Die Meldung konnte nicht abgelegt werden.");
  if (notiz) {
    await beitrag(Number(alt.id), {
      autorArt: "agent", autorName: melder.name, autorAgentId: melder.agentId, art: "kommentar",
      text: `Noch einmal beobachtet von ${melder.name}: ${notiz}`,
    });
  }
  return { id: Number(alt.id), neu: false };
}

/** Welche dieser Schlüssel sind schon gemeldet? Für Knöpfe, die „gemeldet" zeigen sollen. */
export async function todoSchluesselVorhanden(schluessel: string[]): Promise<Set<string>> {
  if (schluessel.length === 0) return new Set();
  await ensureTodoTabelle();
  const rows = (await sqlPool`SELECT schluessel FROM fiaon_betreiber_todos WHERE schluessel = ANY(${schluessel})`) as any[];
  return new Set(rows.map((r) => String(r.schluessel)));
}

/** Was bei Justin liegt: eigene offene Aufgaben plus alles, wo ein Mitarbeiter eine Frage gestellt hat. */
export async function todoOffenZahl(): Promise<number> {
  await ensureTodoTabelle();
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos
    WHERE status <> 'erledigt' AND (zustaendig_art = 'betreiber' OR frage_offen = TRUE)`) as any[];
  return Number(z?.n || 0);
}

// E-029 (24.08.2026): VORHER zählte diese Zahl JEDEN nicht erledigten Auftrag —
// auch die, die auf Justins Antwort warten. Der Mitarbeiter sah eine Marke für
// Arbeit, die er gar nicht tun konnte. NACHHER zählt sie nur, was wirklich bei
// IHM liegt: nicht erledigt UND keine Frage bei Justin offen. Stellt er eine
// Frage, fällt der Auftrag aus der Zahl; antwortet Justin, kommt er zurück.
// Grund: Justins Kritik vom 24.08. — eine Marke darf nur zählen, was offen ist.
/** Was wirklich beim Mitarbeiter liegt: übergeben, nicht erledigt, nicht bei Justin wartend. */
export async function agentAuftraegeOffen(agentId: number): Promise<number> {
  await ensureTodoTabelle();
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos
    WHERE zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId}
      AND status <> 'erledigt' AND frage_offen = FALSE`) as any[];
  return Number(z?.n || 0);
}

/** Die ganze Lage eines Mitarbeiters — für Zähler und Reiter, ohne Doppelzählung. */
export async function agentAuftraegeLage(agentId: number): Promise<{ offen: number; wartet: number; neu: number; frageAnMich: number }> {
  await ensureTodoTabelle();
  const [z] = (await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'erledigt' AND frage_offen = FALSE)::int AS offen,
      COUNT(*) FILTER (WHERE status <> 'erledigt' AND frage_offen = TRUE)::int AS wartet,
      COUNT(*) FILTER (WHERE status <> 'erledigt' AND frage_an_agent = TRUE)::int AS frage_an_mich,
      COUNT(*) FILTER (WHERE status <> 'erledigt' AND EXISTS (
        SELECT 1 FROM fiaon_betreiber_todo_beitraege b
        WHERE b.todo_id = t.id AND b.autor_art = 'betreiber'
          AND b.created_at > COALESCE(t.agent_gelesen_am, TIMESTAMPTZ 'epoch')))::int AS neu
    FROM fiaon_betreiber_todos t
    WHERE zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId}`) as any[];
  return { offen: Number(z?.offen || 0), wartet: Number(z?.wartet || 0), neu: Number(z?.neu || 0), frageAnMich: Number(z?.frage_an_mich || 0) };
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
  // 19.09.2026 (E-194): „gocardless-bad“ (Bank Account Data registrieren) ist raus — GoCardless ist beendet.
  { s: "crif-b2b", bereich: "partner", prio: 2, titel: "CRIF-B2B anfragen — eine Bonitäts-API für DE/AT/CH", text: "Entscheidung E-015. Antwort an den Entwickler weitergeben." },
  { s: "brevo-sie", bereich: "brevo", prio: 2, titel: "23 Brevo-Vorlagen auf Sie umstellen", text: "Entscheidung E-002. Liste: 01_Plattform/MAKE_BLUEPRINT_AUDIT.md." },
  { s: "dkb-partner", bereich: "partner", prio: 2, titel: "DKB-Partnerschaft (Girokonto-Referral) anstoßen", text: "Ansprechpartner, Konditionen, Tracking-Link." },
  { s: "entscheid-scheibe-4", bereich: "entscheidung", prio: 2, titel: "Entscheidung Agentenportal Scheibe 4",
    text: "Darf die Vertriebsleitung Betreuer/Provision setzen? Paket/Betrag ändern? Persönliche Admin-Zugänge für Florentine/Daniel statt geteiltem Code?" },
  { s: "doppelzahler-gutschrift", bereich: "entscheidung", prio: 2, titel: "Doppelzahler-Gutschrift freigeben (E-011)", text: "Sobald die Liste steht." },
  { s: "website-freigeben", bereich: "pruefen", prio: 1, titel: "Neue Website ansehen und freigeben",
    text: "fiaon.com (Startseite), /investoren, /presse, /datenraum, /partner, /karriere — Texte, Zahlen, Tonalität. Zahlen für Investoren/Presse stehen als „auf Anfrage“, bis du sie bestätigst.", link: "https://www.fiaon.com/" },
  // E-283 (05.10.2026): /antrag führt in den neuen Antrag — Ablauf und Abbruchpunkt angeglichen.
  { s: "antrag-pruefen", bereich: "pruefen", prio: 1, titel: "Antrag am Handy durchspielen (neuer Antrag: Angaben, Prüfung, PIN, Paket, Vertrag)", text: "fiaon.com/antrag — bis zur Unterschrift, dort abbrechen: „Zahlungspflichtig annehmen“ schließt einen echten Vertrag.", link: "https://www.fiaon.com/antrag" },
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

/** Die Kundenreferenz aus dem Link — /admin/kunde/<ref>, ?ref=<ref> oder irgendwo FIAON-… (05.09.2026).
 *  E-IT-F: Die Regel steht in shared/fiaon-auftrag-arten.ts; dieser Export bleibt für bestehende Importe. */
export function refAusLink(link: unknown): string | null {
  return refAusLinkQuelle(link);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE STRECKE (07.09.2026, Justin: „man bekommt Aufgaben, die man selbst nicht
// lösen kann — es steht ‚machen Sie dies oder jenes', aber wie? Es muss eine
// nachvollziehbare Strecke geben.")
//
// Jeder Auftrag trägt ab jetzt seine Schritte: Was öffnen, was tun, wo das
// Ergebnis hin. Abgeleitet aus dem Schlüssel (app-brief:…, frist7:…) bzw. dem
// Bereich — dieselbe Quelle, die den Auftrag anlegt. Der letzte Schritt ist
// immer derselbe: Geht es nicht, Rückfrage stellen — Justin antwortet HIER.
// ═══════════════════════════════════════════════════════════════════════════
export function streckeFuer(r: { schluessel?: string | null; bereich?: string | null; link?: string | null; titel?: string | null }): string[] {
  const k = String(r.schluessel || "");
  const vorgang = r.link && String(r.link).startsWith("/agent/app-vorgaenge/") ? "„Vorgang öffnen“ drücken" : "Kunde öffnen → Reiter Vorgänge";
  const ende = "Geht es nicht weiter: „Rückfrage“ drücken — Justin antwortet direkt hier im Auftrag.";
  if (k.startsWith("app-brief:")) return [vorgang, "Den fotografierten Brief lesen: Absender, Aktenzeichen, Frist", "Im Vorgang die Stelle zuordnen und dem Kunden in einem Satz sagen, was wir daraus machen", "Auftrag hier mit Ergebnis abschließen", ende];
  if (k.startsWith("app-antrag-versand:")) return [vorgang, "Das unterschriebene PDF prüfen; fehlt die Anschrift der Stelle, beim Kunden erfragen", "Per Post oder E-Mail an die Stelle senden", "Im Vorgang „Versandt“ quittieren — erst dann sieht der Kunde es und die Frist läuft", ende];
  if (k.startsWith("app-antrag-stopp:")) return ["NICHT versenden — der Kunde hat zurückgezogen", vorgang, "Prüfen, ob der Brief schon im Umschlag ist; wenn ja, herausnehmen", "Auftrag hier abschließen", ende];
  if (k.startsWith("app-bescheid:")) return [vorgang, "Den Bescheid lesen: bewilligt oder abgelehnt, Betrag, Datum", "Im Vorgang das Ergebnis eintragen — mit einem Satz für den Kunden", "Auftrag hier abschließen", ende];
  if (k.startsWith("app-ablehnung:")) return ["Kunden anrufen und die Ablehnung erklären (Satz steht im Auftrag)", "Klären: Widerspruch beim Kunden selbst, andere Stelle oder Punkt schließen", vorgang + " → Ergebnis als Notiz eintragen", ende];
  if (k.startsWith("frist7:") || k.startsWith("nachfass:") || k.startsWith("eskalation:")) return ["Postfach und Akte prüfen: Ist eine Antwort der Stelle eingegangen?", vorgang, "Antwort da → Ergebnis eintragen; keine Antwort → Nachfrage senden und „Nachgefragt“ quittieren", ende];
  if (k.startsWith("dringend:") || k.startsWith("dringend-ref:")) return ["Kunde öffnen → Anliegen lesen (Frist, Gericht, Inkasso?)", "Heute anrufen — der Kunde hat es als dringend markiert", "Antwort im Anliegen oder hier als Ergebnis eintragen", ende];
  if (k.startsWith("postmeister:eskalation:")) return ["Kunde öffnen → Verlauf und die Mail von Mara lesen", "Kunden anrufen und klären, was Mara nicht klären konnte", "Ergebnis hier in einem Satz eintragen — Mara antwortet dem Kunden danach nicht mehr von selbst", ende];
  if (k.startsWith("postmeister:") || r.bereich === "postmeister") return ["Kunde öffnen → Verlauf lesen (Mara hat die Lage zusammengefasst)", "Das Nötige tun: Rückruf, Datei prüfen, Datenänderung — steht im Auftragstext", "Ergebnis hier in einem Satz eintragen", ende];
  // Angebot-Aufrufe (01.10.2026, Gegenprüfung F4): Die Meldung „… hat sein Angebot geöffnet" steht im Bereich „konten",
  // ist aber kein Zahlungsfall — eigene Strecke vor der Zahlungs-Regel. Die Aufgabe gehört Justin selbst.
  if (k.startsWith("global-angebot:")) return ["„Öffnen“ drücken: Reiter „Angebote“ — dort jeder Aufruf mit Zeit, Gerät und Ort", "Nachfassen, solange es frisch ist: anrufen oder kurz schreiben, offene Fragen zum Angebot klären — ohne Druck", "Angenommen: Aufgabe abschließen. Sonst das Ergebnis in einem Satz hier eintragen"];
  if (r.bereich === "konten" || /zahlung/i.test(String(r.titel || ""))) return ["Kunde öffnen → Zahlungen: Steht die Zahlung im Bankbuch?", "Nein: Kunden nach Datum, Betrag und Verwendungszweck fragen und hier eintragen — die Verwaltung bucht", "Ja: Kunden informieren, Auftrag abschließen", ende];
  return ["Kunde öffnen und den Verlauf lesen", "Das tun, was im Auftrag steht (Anruf, Mail, Notiz)", "Ergebnis hier in einem Satz eintragen", ende];
}

function zeile(r: any) {
  const art = istArt(r.art) ? r.art : auftragArtVon({ schluessel: r.schluessel, quelle: r.quelle, bereich: r.bereich, titel: r.titel });
  const regel = artRegel(art);
  const herkunft = auftragHerkunft(r.quelle);
  const fragen = !!r.frage_offen || !!r.frage_an_agent || Number(r.fragen_zahl || 0) > 0;
  const kundeName = r.kunde_name ? String(r.kunde_name).trim() || null : null;
  return {
    id: Number(r.id), schluessel: r.schluessel ?? null, titel: r.titel, text: r.text ?? null, bereich: r.bereich,
    strecke: streckeFuer(r),
    /** Kunde hinter der Aufgabe — Daniel (05.09.): „würde gerne anrufen, aber wer ist das?"
     *  E-IT-F: aus der Spalte person_id (Wurzel), nicht mehr aus dem Link geraten. */
    ref: r.kunde_ref ?? r.ref ?? refAusLink(r.link), kunde: kundeName, kundeTelefon: r.kunde_telefon ?? null,
    personId: r.kunde_person_id ? Number(r.kunde_person_id) : null,
    /** Ohne Kunden: ein Name aus dem Titel („Bewerbung: …") oder „ohne Kundenbezug" — die Spalte ist nie leer. */
    kundeAnzeige: kundeName || nameAusTitel(r.titel) || "ohne Kundenbezug",
    art, artLabel: regel.label, nurHand: regel.nurHand, zustand: regel.zustand,
    herkunft: herkunft.vonMara ? `von Mara${herkunft.kanal ? ` · ${herkunft.kanal}` : ""}` : (herkunft.kanal || "Verwaltung"),
    prioritaet: Number(r.prioritaet || 2), dringend: Number(r.prioritaet || 2) === 1, faelligAm: r.faellig_am ? String(r.faellig_am).slice(0, 10) : null,
    link: r.link ?? null, quelle: r.quelle, erledigtAm: r.erledigt_am ?? null, createdAt: r.created_at,
    eingangAm: r.eingang_am ?? r.created_at ?? null, neuSeit: r.neu_seit ?? null,
    ungelesen: !!r.neu_seit && (!r.agent_gelesen_am || new Date(r.neu_seit).getTime() > new Date(r.agent_gelesen_am).getTime()),
    status: (r.status || "offen") as Status, spalte: spalte(r),
    zustaendig: r.zustaendig_art === "agent"
      ? { art: "agent" as const, agentId: Number(r.zustaendig_agent_id), name: r.zustaendig_name || "Mitarbeiter" }
      : { art: "betreiber" as const, agentId: null, name: BETREIBER_NAME },
    delegiertAm: r.delegiert_am ?? null, angenommenAm: r.angenommen_am ?? null,
    erledigtVon: r.erledigt_von ?? null, erledigtArt: r.erledigt_art ?? null, erledigtEreignis: r.erledigt_ereignis ?? null,
    ergebnis: r.ergebnis ?? null, frageOffen: !!r.frage_offen,
    // E-IT-F: Wieder geöffnet — wann, wie oft und warum (die Wand in der Datenbank schreibt es mit).
    wiederOffenAm: r.status !== "erledigt" && r.wieder_offen_am
      && (!r.agent_gelesen_am || new Date(r.wieder_offen_am).getTime() > new Date(r.agent_gelesen_am).getTime()) ? r.wieder_offen_am : null,
    wiederOffenGrund: r.wieder_offen_grund ?? null, wiederOffenZahl: Number(r.wieder_offen_zahl || 0),
    letzteAktivitaet: r.letzte_aktivitaet ?? r.updated_at ?? null,
    beitraege: Number(r.beitraege_zahl || 0),
    letzterBeitrag: r.lb_text ? { art: r.lb_art, autor: r.lb_autor, text: String(r.lb_text).slice(0, 160), am: r.lb_am } : null,
    // E-029 (24.08.2026): der Austausch in beide Richtungen, abgeleitet statt gezählt.
    frageAnAgent: !!r.frage_an_agent,
    neuFuerAgent: Number(r.neu_agent || 0),
    neuFuerBetreiber: Number(r.neu_betreiber || 0),
    // Pflicht-Ergebnis dort, wo eine Frage im Spiel war (Justins Regel vom 24.08.: „Der Satz ist
    // Pflicht, wenn die Aufgabe eine Frage war") — E-IT-F: und bei Arten, die es laut Katalog
    // verlangen (Recht: Widerruf/Beschwerde/Löschantrag; Lage-Aufträge: unzustellbar, Einladung fehlt —
    // wer sie ohne neues Ereignis schließt, sagt in einem Satz, was geklärt ist).
    ergebnisPflicht: fragen || regel.ergebnisPflicht,
  };
}
function istArt(v: unknown): boolean { return typeof v === "string" && Object.prototype.hasOwnProperty.call(AUFTRAG_ARTEN, v); }

function beitragZeile(b: any) {
  return { id: Number(b.id), todoId: Number(b.todo_id), autorArt: b.autor_art, autorName: b.autor_name, art: b.art, text: b.text, am: b.created_at };
}

// E-029 (24.08.2026): VORHER zählte der seitliche Lauf nur die Beiträge.
// NACHHER liefert derselbe Lauf zusätzlich, wie viel jede Seite noch nicht
// gelesen hat und ob je eine Frage gestellt wurde. Ein Lauf statt drei —
// die Liste wird bei jedem Aufruf des Portals geladen.
// E-IT-F (08.10.2026): der Kunde aus person_id (eine Stufe weiter, falls die Person
// inzwischen zusammengeführt wurde) — EIN Join für Liste, Akte-Leiste, Popup und Board.
/** Der Kunde eines Auftrags: Person (eine Stufe weiter, falls inzwischen zusammengeführt), sonst die Bestellung. */
const KUNDE_JOIN = sqlPool`
  LEFT JOIN LATERAL (
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(p.company_name), '')) AS name,
           NULLIF(TRIM(COALESCE(p.primary_phone, '')), '') AS telefon,
           (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY (a.archived_at IS NOT NULL), a.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p0
      JOIN fiaon_persons p ON p.id = COALESCE(p0.merged_into_person_id, p0.id)
     WHERE p0.id = t.person_id
  ) kp0 ON TRUE
  LEFT JOIN LATERAL (
    SELECT NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), '') AS name, NULLIF(TRIM(COALESCE(a.contact_phone, '')), '') AS telefon
      FROM fiaon_applications a
     WHERE t.person_id IS NULL AND t.ref IS NOT NULL AND a.ref = t.ref
     LIMIT 1
  ) ka ON TRUE
  LEFT JOIN LATERAL (SELECT kp0.id, COALESCE(kp0.name, ka.name) AS name, COALESCE(kp0.telefon, ka.telefon) AS telefon, kp0.ref) kp ON TRUE
`;

const LISTE_SQL = sqlPool`
  SELECT t.*, bz.n AS beitraege_zahl, bz.neu_agent, bz.neu_betreiber, bz.fragen_zahl,
         lb.art AS lb_art, lb.autor_name AS lb_autor, lb.text AS lb_text, lb.created_at AS lb_am,
         kp.id AS kunde_person_id, kp.name AS kunde_name, kp.telefon AS kunde_telefon, COALESCE(t.ref, kp.ref) AS kunde_ref
  FROM fiaon_betreiber_todos t
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE b.autor_art = 'betreiber' AND b.created_at > COALESCE(t.agent_gelesen_am, TIMESTAMPTZ 'epoch'))::int AS neu_agent,
      COUNT(*) FILTER (WHERE b.autor_art = 'agent' AND b.created_at > COALESCE(t.betreiber_gelesen_am, TIMESTAMPTZ 'epoch'))::int AS neu_betreiber,
      COUNT(*) FILTER (WHERE b.art = 'frage')::int AS fragen_zahl
    FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = t.id) bz ON TRUE
  LEFT JOIN LATERAL (SELECT art, autor_name, text, created_at FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = t.id ORDER BY created_at DESC LIMIT 1) lb ON TRUE
  ${KUNDE_JOIN}
`;

async function todoLaden(id: number) {
  await auftraegeZuordnen({ ids: [id] }).catch(() => 0);
  const [r] = (await sqlPool`${LISTE_SQL} WHERE t.id = ${id}`) as any[];
  if (!r) return null;
  const beitraege = (await sqlPool`SELECT * FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ${id} ORDER BY created_at ASC, id ASC`) as any[];
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
    // E-IT-F: neue Zeilen ohne Kunde/Art einordnen, bevor das Board sie zeigt.
    await auftraegeZuordnen({ nurOffen: true, grenze: 100 }).catch(() => 0);
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
    if (agentId > 0) await delegieren(Number(r.id), agentId, String(req.body?.hinweis || ""), { neu: true });
    res.json({ ok: true, todo: await todoLaden(Number(r.id)) });
  } catch (err) { console.error("[TODO] anlegen:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

async function delegieren(id: number, agentId: number | null, hinweis: string, opt: { neu?: boolean } = {}): Promise<string | null> {
  if (agentId) {
    const [a] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${agentId} AND COALESCE(active, TRUE) = TRUE`) as any[];
    if (!a) return "Mitarbeiter nicht gefunden.";
    // E-029 (24.08.2026): agent_gelesen_am wird zurückgesetzt — für den NEUEN
    // Zuständigen ist der ganze Verlauf ungelesen, auch wenn ein Vorgänger ihn
    // schon kannte. frage_an_agent fällt weg: die alte Frage galt einem anderen.
    // E-IT-F (08.10.2026): Ein erledigter Auftrag, der so neu übergeben wird, ist WIEDER OFFEN —
    // mit Grund in der Zeitleiste (die Wand schreibt ihn). neu_seit nur bei einer echten Übergabe
    // (Justin, neue Aufgabe): Ein Übertrag in Masse ist keine Neuigkeit fürs Popup.
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_art = 'agent', zustaendig_agent_id = ${a.id}, zustaendig_name = ${a.name},
      delegiert_am = NOW(), angenommen_am = NULL, status = 'offen', frage_offen = FALSE, frage_an_agent = FALSE,
      agent_gelesen_am = NULL, erledigt_am = NULL,
      wieder_offen_grund = CASE WHEN status = 'erledigt' THEN ${`neu übergeben an ${a.name} (${berlinTagZeit(new Date())})`} ELSE wieder_offen_grund END,
      neu_seit = CASE WHEN ${!!opt.neu} THEN NOW() ELSE neu_seit END,
      updated_at = NOW() WHERE id = ${id}`;
    await beitrag(id, { autorArt: "system", autorName: "System", art: "status", text: `An ${a.name} übergeben.` });
    if (hinweis.trim()) await beitrag(id, { autorArt: "betreiber", autorName: BETREIBER_NAME, art: "kommentar", text: hinweis.trim().slice(0, 2000) });
  } else {
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_art = 'betreiber', zustaendig_agent_id = NULL, zustaendig_name = NULL,
      status = CASE WHEN status = 'erledigt' THEN 'erledigt' ELSE 'offen' END, frage_offen = FALSE, frage_an_agent = FALSE, updated_at = NOW() WHERE id = ${id}`;
    await beitrag(id, { autorArt: "system", autorName: "System", art: "status", text: `Zurück bei ${BETREIBER_NAME}.` });
  }
  return null;
}

router.post("/admin/todo/:id/delegieren", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const agentId = req.body?.agentId ? Number(req.body.agentId) : null;
    const fehler = await delegieren(id, agentId, String(req.body?.hinweis || ""), { neu: true });
    if (fehler) return res.status(400).json({ ok: false, error: fehler });
    res.json({ ok: true, todo: await todoLaden(id) });
  } catch (err) { console.error("[TODO] delegieren:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// E-029 (24.08.2026): VORHER war jede Nachricht Justins entweder eine Antwort
// auf eine offene Frage oder ein Kommentar, den niemand beantworten musste.
// NACHHER kann er mit art='frage' selbst eine Frage stellen, die beim
// Mitarbeiter als Bitte um Antwort steht (frage_an_agent). Grund: Justins
// Auftrag „das es Austausch zwischen Admins und Mitarbeiter gibt" — Austausch
// heißt, dass beide Seiten fragen dürfen, nicht nur eine.
router.post("/admin/todo/:id/beitrag", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const text = String(req.body?.text || "").trim();
    if (text.length < 2) return res.status(400).json({ ok: false, error: "Bitte etwas schreiben." });
    const [t] = (await sqlPool`SELECT frage_offen, zustaendig_art, status FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const willFragen = String(req.body?.art || "") === "frage" && t.zustaendig_art === "agent" && t.status !== "erledigt";
    const art: BeitragArt = willFragen ? "frage" : t.frage_offen ? "antwort" : "kommentar";
    await beitrag(id, { autorArt: "betreiber", autorName: BETREIBER_NAME, art, text: text.slice(0, 4000) });
    // Wer schreibt, hat gelesen: die Marke „neu vom Mitarbeiter" fällt hier weg.
    await sqlPool`UPDATE fiaon_betreiber_todos SET betreiber_gelesen_am = NOW() WHERE id = ${id}`;
    if (willFragen) {
      // Justins Gegenfrage beendet das Warten auf ihn und legt den Ball beim
      // Mitarbeiter ab — kein Zustand ohne sichtbaren nächsten Schritt.
      await sqlPool`UPDATE fiaon_betreiber_todos SET frage_an_agent = TRUE, frage_offen = FALSE,
        status = 'in_arbeit', updated_at = NOW() WHERE id = ${id}`;
    } else if (t.frage_offen) {
      // Die Antwort geht zurück an den Mitarbeiter — die Aufgabe läuft weiter.
      await sqlPool`UPDATE fiaon_betreiber_todos SET frage_offen = FALSE,
        status = CASE WHEN zustaendig_art = 'agent' THEN 'in_arbeit' ELSE 'offen' END, updated_at = NOW() WHERE id = ${id}`;
    }
    res.json({ ok: true, todo: await todoLaden(id) });
  } catch (err) { console.error("[TODO] beitrag:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// E-029 (24.08.2026): NEU — „ich habe es gesehen". Ohne diesen Punkt könnte
// die Marke „neu vom Mitarbeiter" nur beim Antworten verschwinden; Justin
// liest aber oft, ohne zu schreiben, und die Marke stünde weiter da.
router.post("/admin/todo/:id/gelesen", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const [t] = (await sqlPool`SELECT id FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    await sqlPool`UPDATE fiaon_betreiber_todos SET betreiber_gelesen_am = NOW() WHERE id = ${id}`;
    res.json({ ok: true, todo: await todoLaden(id) });
  } catch (err) { console.error("[TODO] gelesen:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.patch("/admin/todo/:id", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const b = req.body || {};
    const [vorher] = (await sqlPool`SELECT * FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
    if (!vorher) return res.status(404).json({ ok: false, error: "Nicht gefunden." });

    // E-IT-F (08.10.2026): Erledigen und Wieder-Öffnen über den EINEN Weg (server/lib/fiaon-auftraege.ts) —
    // mit Art „verwaltung" und Grund; die Zeile „Wieder offen: …" schreibt die Wand in der Datenbank.
    if (b.erledigt === true) {
      const ergebnis = String(b.ergebnis || "").trim().slice(0, 4000) || null;
      await auftragErledigen(id, { art: "verwaltung", von: BETREIBER_NAME, autorArt: "betreiber", ergebnis, beitragText: ergebnis || "Erledigt." });
    } else if (b.erledigt === false) {
      await auftragWiederOeffnen(id, `von ${BETREIBER_NAME} wieder geöffnet`, { status: vorher.zustaendig_art === "agent" ? "in_arbeit" : "offen" });
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
    // E-IT-F: Die Liste kann veraltet sein (Übertrag, Umverteilung). Der Code sagt der Oberfläche,
    // dass sie die Karte entfernen soll — statt einer Fehlermeldung, die stehen bleibt.
    res.status(404).json({ ok: false, code: "NICHT_BEI_DIR", error: t ? "Dieser Auftrag liegt inzwischen nicht mehr bei dir." : "Dieser Auftrag liegt nicht bei dir." });
    return null;
  }
  return t;
}

// ── E-IT-F (08.10.2026): DIE LISTE DES MITARBEITERS ─────────────────────────
// VORHER lud jeder Aufruf ALLE Beiträge aller Aufträge mit (Daniel: rund 600.000
// Zeichen Rohtext je Laden), ungekürzt und in der Reihenfolge Priorität/Fälligkeit.
// Die erledigte Karte blieb bis zum Ende dieses Ladens mit aktivem Knopf stehen —
// ein zweiter Klick ergab „Schon erledigt.". NACHHER: die Liste trägt je Auftrag den
// Kunden, die Art, den Eingang und nur die letzten Beiträge; die ganze Zeitleiste
// kommt beim Aufklappen (GET /agent/auftraege/:id). Reihenfolge: shared
// auftraegeSortieren — dieselbe Funktion wie der „nächste Auftrag" und die Oberfläche.
const LISTE_TEXT_GRENZE = 2400;
const LISTE_BEITRAEGE = 6;
const ERLEDIGT_TAGE = 30;

async function agentAuftraegeLaden(agentId: number, opt: { erledigt?: boolean } = {}) {
  const ohne = (await sqlPool`
    SELECT id FROM fiaon_betreiber_todos
     WHERE zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId} AND zugeordnet_am IS NULL
     ORDER BY (status <> 'erledigt') DESC, id DESC LIMIT 60`) as any[];
  if (ohne.length) await auftraegeZuordnen({ ids: ohne.map((o) => Number(o.id)) }).catch(() => 0);
  const rows = (await sqlPool`${LISTE_SQL}
    WHERE t.zustaendig_art = 'agent' AND t.zustaendig_agent_id = ${agentId}
      AND (t.status <> 'erledigt' OR (${!!opt.erledigt} AND t.erledigt_am > NOW() - (${ERLEDIGT_TAGE}::int * INTERVAL '1 day')))`) as any[];
  const offenIds = rows.filter((r) => r.status !== "erledigt").map((r) => Number(r.id));
  // Nur die letzten Beiträge — und jede Frage/Antwort eines Menschen aus den letzten 30, damit „Justin fragt dich"
  // auch hinter einer Flut von Systemzeilen sichtbar bleibt.
  const beitraege = offenIds.length ? (await sqlPool`
    SELECT * FROM (
      SELECT b.*, ROW_NUMBER() OVER (PARTITION BY b.todo_id ORDER BY b.created_at DESC, b.id DESC) AS rn
        FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = ANY(${offenIds}::int[])) x
     WHERE x.rn <= ${LISTE_BEITRAEGE} OR (x.autor_art <> 'system' AND x.rn <= 30)
     ORDER BY x.created_at ASC, x.id ASC`) as any[] : [];
  const nachTodo = new Map<number, any[]>();
  for (const b of beitraege) {
    const l = nachTodo.get(Number(b.todo_id)) || [];
    l.push({ ...beitragZeile(b), text: String(b.text ?? "").slice(0, 800) });
    nachTodo.set(Number(b.todo_id), l);
  }
  const alle = rows.map((r) => {
    const z = zeile(r);
    const text = z.text ? String(z.text) : null;
    const gekuerzt = !!text && text.length > LISTE_TEXT_GRENZE;
    return {
      ...z,
      // Das Neue steht am Ende (Nachträge werden angehängt) — gekürzt wird vorn.
      text: gekuerzt ? `… ${text!.slice(-LISTE_TEXT_GRENZE)}` : text, textGekuerzt: gekuerzt,
      zeitleiste: z.status === "erledigt" ? [] : (nachTodo.get(z.id) || []),
      zeitleisteGekuerzt: z.status !== "erledigt" && z.beitraege > (nachTodo.get(z.id) || []).length,
    };
  });
  const offen = auftraegeSortieren(alle.filter((a) => a.status !== "erledigt"), "alt");
  // Je Kunde: wie viele offene Aufträge es sonst noch gibt — die Karte sagt „+2 weitere zu diesem Kunden".
  const jePerson = new Map<number, number>();
  for (const a of offen) if (a.personId) jePerson.set(a.personId, (jePerson.get(a.personId) || 0) + 1);
  const mitZahl = offen.map((a) => ({ ...a, weitereZumKunden: a.personId ? Math.max(0, (jePerson.get(a.personId) || 1) - 1) : 0 }));
  const erledigt = alle.filter((a) => a.status === "erledigt")
    .sort((a, b) => new Date(b.erledigtAm || 0).getTime() - new Date(a.erledigtAm || 0).getTime());
  return { offen: mitZahl, erledigt };
}

/** Der nächste wirklich offene Auftrag dieses Mitarbeiters — knapp, für Liste und Akte-Leiste. */
async function naechsterFuer(agentId: number, ohne: number[], richtung: AuftragRichtung = "alt") {
  const rows = (await sqlPool`${LISTE_SQL}
    WHERE t.zustaendig_art = 'agent' AND t.zustaendig_agent_id = ${agentId} AND t.status <> 'erledigt'`) as any[];
  const n = naechsterAuftrag(rows.map(zeile), ohne, richtung);
  return n ? { id: n.id, personId: n.personId, ref: n.ref, kunde: n.kundeAnzeige, art: n.art, artLabel: n.artLabel, titel: n.titel } : null;
}

function richtungAus(v: unknown): AuftragRichtung { return v === "neu" ? "neu" : "alt"; }

/** Justin schließt eine Aufgabe aus der Verwaltung (05.09.2026) — z. B. Doppel oder erledigt am Telefon. */
router.post("/admin/todo/:id/erledigt", async (req: Request, res: Response) => {
  try {
    await ensureTodoTabelle();
    const id = Number(req.params.id);
    const ergebnis = String(req.body?.ergebnis || "").trim().slice(0, 2000);
    const [t] = (await sqlPool`SELECT id, status FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    // E-IT-F: idempotent — ein zweiter Klick ändert nichts und meldet keinen Fehler.
    const zu = await auftragErledigen(id, { art: "verwaltung", von: BETREIBER_NAME, autorArt: "betreiber", ergebnis: ergebnis || null, beitragText: ergebnis ? `Erledigt: ${ergebnis}` : "Erledigt." });
    res.json({ ok: true, schonErledigt: !zu, todo: await todoLaden(id) });
  } catch (err) { console.error("[TODO] admin erledigt:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.get("/agent/auftraege", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const { offen, erledigt } = await agentAuftraegeLaden(Number(req.agent!.id), { erledigt: true });
    res.json({
      ok: true,
      auftraege: offen,
      erledigt,
      erledigtTage: ERLEDIGT_TAGE,
      naechster: naechsterAuftrag(offen, [], richtungAus(req.query.richtung))?.id ?? null,
      lage: await agentAuftraegeLage(req.agent!.id),
    });
  } catch (err) { console.error("[TODO] agent liste:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

/** E-IT-F: der nächste wirklich offene Auftrag — für die Akte-Leiste („Nächster Auftrag →"). */
router.get("/agent/auftraege/naechster", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const nach = Number(req.query.nach || 0);
    res.json({ ok: true, naechster: await naechsterFuer(Number(req.agent!.id), nach > 0 ? [nach] : [], richtungAus(req.query.richtung)) });
  } catch (err) { console.error("[TODO] agent nächster:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

/** E-IT-F: ein Auftrag mit voller Zeitleiste und ungekürztem Text — beim Aufklappen und für die Akte-Leiste. */
router.get("/agent/auftraege/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const todo = await todoLaden(Number(t.id));
    const [w] = todo?.personId && todo.status !== "erledigt" ? (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos
       WHERE zustaendig_art = 'agent' AND zustaendig_agent_id = ${req.agent!.id} AND status <> 'erledigt'
         AND person_id = ${todo.personId} AND id <> ${t.id}`) as any[] : [{ n: 0 }];
    res.json({ ok: true, todo: todo ? { ...todo, weitereZumKunden: Number(w?.n || 0) } : null });
  } catch (err) { console.error("[TODO] agent detail:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// E-029 (24.08.2026): NEU — „ich habe den Verlauf gesehen". Die Oberfläche ruft
// das auf, sobald die Zeitleiste offen ist. Ohne diesen Punkt bliebe die Marke
// „Justin hat geantwortet" stehen, bis der Mitarbeiter zufällig selbst schreibt.
router.post("/agent/auftraege/:id/gelesen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    await sqlPool`UPDATE fiaon_betreiber_todos SET agent_gelesen_am = NOW() WHERE id = ${t.id}`;
    res.json({ ok: true, todo: await todoLaden(Number(t.id)) });
  } catch (err) { console.error("[TODO] agent gelesen:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// E-IT-F (08.10.2026): Die Oberfläche bietet „Ich mach das" nicht mehr an — erledigt wird mit einem Klick.
// Die Route bleibt für alte Tabs; ist der Auftrag inzwischen erledigt, antwortet sie ohne Fehler.
router.post("/agent/auftraege/:id/annehmen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    if (t.status === "erledigt") return res.json({ ok: true, schonErledigt: true, todo: await todoLaden(Number(t.id)) });
    // Wer annimmt, hat die Aufgabe gelesen — die Marke fällt hier weg (E-029).
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'in_arbeit', angenommen_am = COALESCE(angenommen_am, NOW()),
      agent_gelesen_am = NOW(), updated_at = NOW() WHERE id = ${t.id}`;
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
    if (t.status === "erledigt") return res.status(409).json({ ok: false, code: "SCHON_ERLEDIGT", error: "Dieser Auftrag ist schon erledigt — unter „Erledigt“ kannst du ihn wieder öffnen.", todo: await todoLaden(Number(t.id)) });
    await beitrag(Number(t.id), { autorArt: "agent", autorName: req.agent!.name, autorAgentId: req.agent!.id, art: "frage", text: text.slice(0, 4000) });
    // E-029: frage_an_agent fällt weg — wer zurückfragt, hat Justins Frage
    // gesehen und die Aufgabe liegt jetzt bei ihm, nicht mehr beim Mitarbeiter.
    await sqlPool`UPDATE fiaon_betreiber_todos SET frage_offen = TRUE, frage_an_agent = FALSE, status = 'wartet',
      angenommen_am = COALESCE(angenommen_am, NOW()), agent_gelesen_am = NOW(), updated_at = NOW() WHERE id = ${t.id}`;
    res.json({ ok: true, todo: await todoLaden(Number(t.id)), naechster: await naechsterFuer(Number(req.agent!.id), [Number(t.id)], richtungAus(req.body?.richtung)) });
  } catch (err) { console.error("[TODO] frage:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// E-029 (24.08.2026): VORHER war jede Nachricht des Mitarbeiters ein Kommentar
// ohne Wirkung. NACHHER ist sie die ANTWORT, wenn Justin gefragt hat: die
// Marke frage_an_agent fällt weg und die Aufgabe läuft weiter. Grund: sonst
// wäre Justins Frage eine Sackgasse, aus der nur er selbst wieder herauskommt.
router.post("/agent/auftraege/:id/kommentar", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const text = String(req.body?.text || "").trim();
    if (text.length < 2) return res.status(400).json({ ok: false, error: "Bitte etwas schreiben." });
    const istAntwort = !!t.frage_an_agent && t.status !== "erledigt";
    await beitrag(Number(t.id), { autorArt: "agent", autorName: req.agent!.name, autorAgentId: req.agent!.id, art: istAntwort ? "antwort" : "kommentar", text: text.slice(0, 4000) });
    await sqlPool`UPDATE fiaon_betreiber_todos SET agent_gelesen_am = NOW() WHERE id = ${t.id}`;
    if (istAntwort) {
      await sqlPool`UPDATE fiaon_betreiber_todos SET frage_an_agent = FALSE,
        status = CASE WHEN status = 'wartet' THEN 'wartet' ELSE 'in_arbeit' END,
        angenommen_am = COALESCE(angenommen_am, NOW()), updated_at = NOW() WHERE id = ${t.id}`;
    }
    res.json({ ok: true, todo: await todoLaden(Number(t.id)) });
  } catch (err) { console.error("[TODO] kommentar:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// E-029 (24.08.2026): VORHER war das Ergebnis IMMER Pflicht (mindestens fünf
// Zeichen) — bei „Guthaben geprüft" schreibt dann jeder „ok" hin, und der Satz
// verliert seinen Sinn. NACHHER Justins Regel vom 24.08.: Pflicht, wenn eine
// Frage im Spiel war (Justin hat gefragt, oder der Mitarbeiter hat gefragt und
// eine Antwort bekommen) — sonst freiwillig. Die Prüfung liegt HIER, nicht nur
// in der Oberfläche.
// E-IT-F (08.10.2026): Pflicht auch bei Arten, die es laut Katalog verlangen (Recht, Lage-Aufträge).
// Erledigen ist IDEMPOTENT: War der Auftrag schon erledigt (im Hintergrund: Antwort gesendet,
// Ereignis in der Akte, Verwaltung), antwortet die Route 200 mit schonErledigt — die Karte geht
// weg, statt mit „Schon erledigt." stehen zu bleiben. Jede Antwort trägt den NÄCHSTEN Auftrag.
router.post("/agent/auftraege/:id/erledigt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const richtung = richtungAus(req.body?.richtung);
    if (t.status === "erledigt") {
      return res.json({ ok: true, schonErledigt: true, todo: await todoLaden(Number(t.id)), naechster: await naechsterFuer(Number(req.agent!.id), [Number(t.id)], richtung) });
    }
    const ergebnis = String(req.body?.ergebnis || "").trim();
    const [f] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ${t.id} AND art = 'frage'`) as any[];
    const frage = !!t.frage_offen || !!t.frage_an_agent || Number(f?.n || 0) > 0;
    // Die strengere Art aus Speicher und jetzigem Text (Gegenprüfung 08.10.: ein angehängter Widerruf verlangt den Satz).
    const artJetzt = artNachInhalt(t.art, { schluessel: t.schluessel, quelle: t.quelle, bereich: t.bereich, titel: t.titel, text: t.text });
    const regel = artRegel(artJetzt);
    if ((frage || regel.ergebnisPflicht) && ergebnis.length < 5) {
      return res.status(400).json({
        ok: false, code: "ERGEBNIS_PFLICHT",
        error: frage
          ? "Zu diesem Auftrag gab es eine Frage — bitte in einem Satz festhalten, wie sie ausgegangen ist."
          : regel.zustand
            ? "Bitte in einem Satz festhalten, was geklärt ist (z. B. neue Adresse eingetragen, Kunde erreicht) — sonst meldet sich der Auftrag wieder."
            : "Bei Kündigung, Widerruf, Beschwerde oder Löschantrag bitte in einem Satz festhalten, was veranlasst ist.",
      });
    }
    if (ergebnis.length > 0 && ergebnis.length < 2) {
      return res.status(400).json({ ok: false, error: "Bitte etwas mehr schreiben oder das Feld leer lassen." });
    }
    const text = ergebnis.slice(0, 4000);
    const zu = await auftragErledigen(Number(t.id), {
      art: "hand", von: req.agent!.name, autorArt: "agent", autorAgentId: req.agent!.id,
      ergebnis: text || null, beitragText: text || "Als erledigt gemeldet.", gelesen: true,
    });
    // „Kunde hat geschrieben“ von Hand erledigt = vom Betreuer übernommen: Maras wartender Entwurf wird
    // verworfen (wie unter E-Mails „Übernommen“) — sonst kann ihn die Zentrale später doch noch senden.
    if (zu && (artJetzt === "mara_mail" || artJetzt === "mara_mail_heikel" || /^postmeister:antwort:/.test(String(t.schluessel || "")))) {
      try {
        const verworfen = await uebergabeEntwuerfeUebernehmen(t.text, req.agent!.name, text || "im Auftrag als erledigt gemeldet");
        if (verworfen.length) {
          const { entwurfLoeschen } = await import("../lib/fiaon-gmail");
          for (const v of verworfen) if (v.draftId) await entwurfLoeschen(v.postfach, v.draftId).catch(() => {});
          await beitrag(Number(t.id), { autorArt: "system", autorName: "System", art: "kommentar",
            text: `Maras Entwurf zu ${verworfen.map((v) => `Mail #${v.id}`).join(", ")} verworfen — vom Betreuer übernommen (${req.agent!.name}).` });
        }
      } catch (e) { console.error("[TODO] erledigt: Entwurf verwerfen:", String(e).slice(0, 200)); }
    }
    res.json({ ok: true, todo: await todoLaden(Number(t.id)), naechster: await naechsterFuer(Number(req.agent!.id), [Number(t.id)], richtung) });
  } catch (err) { console.error("[TODO] erledigt:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

/** E-IT-F: Wieder öffnen — aus dem Reiter „Erledigt". Der Grund steht in der Zeitleiste, nichts geht still. */
router.post("/agent/auftraege/:id/wieder-oeffnen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    if (t.status !== "erledigt") return res.json({ ok: true, schonOffen: true, todo: await todoLaden(Number(t.id)) });
    const grund = String(req.body?.grund || "").trim().slice(0, 300);
    await auftragWiederOeffnen(Number(t.id), `von ${req.agent!.name} wieder geöffnet${grund ? `: ${grund}` : ""}`, { gelesen: true, status: "in_arbeit" });
    res.json({ ok: true, todo: await todoLaden(Number(t.id)) });
  } catch (err) { console.error("[TODO] wieder öffnen:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/auftraege/:id/zurueck", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTodoTabelle();
    const t = await meinAuftrag(req, res); if (!t) return;
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 3) return res.status(400).json({ ok: false, error: "Bitte kurz sagen, warum." });
    await beitrag(Number(t.id), { autorArt: "agent", autorName: req.agent!.name, autorAgentId: req.agent!.id, art: "kommentar", text: `Zurückgegeben: ${grund.slice(0, 2000)}` });
    await delegieren(Number(t.id), null, "");
    res.json({ ok: true, naechster: await naechsterFuer(Number(req.agent!.id), [Number(t.id)], richtungAus(req.body?.richtung)) });
  } catch (err) { console.error("[TODO] zurueck:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

export default router;
