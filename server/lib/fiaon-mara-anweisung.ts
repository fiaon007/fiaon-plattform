// ═══════════════════════════════════════════════════════════════════════════
// MARAS HAUSANWEISUNG — JUSTINS STIMME IM KOPF DER AGENTIN (22.09.2026, E-210)
//
// Justin: „ich muss eben auch im DETAIL sehen wie Mara denkt, was sie macht,
// muss sie selbst über eine Seite steuern können, anweisen können — ihre
// Ansprache, ihren gesamten Prompt einsehen und ändern können, aber so, dass
// es wirklich funktioniert."
//
// Der Auftragstext selbst (zwei lange Bauwerke in fiaon-postmeister-agent.ts
// und fiaon-mara-aktion.ts) bleibt im Quelltext: Dort hängen Werkzeuge,
// Pflichtangaben und die Prüfungen daran; ein Fehlgriff im Browser würde die
// Agentin lahmlegen. Was hier dazukommt, ist eine EIGENE Stimme: ein freier
// Text, der GANZ OBEN im Auftrag steht und im Zweifel gewinnt.
//
// Dazu gehört: jede Fassung bleibt erhalten (nichts wird überschrieben), der
// ganze zusammengebaute Auftrag ist im Steuerpult lesbar, und ein Klick holt
// die vorige Fassung zurück.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export type Bereich = "postfach" | "aktion" | "whatsapp";
export const BEREICHE: Bereich[] = ["postfach", "aktion", "whatsapp"];

export const BEREICH_TEXT: Record<Bereich, string> = {
  postfach: "Antworten im Postfach",
  aktion: "Nachfassen per Mail",
  whatsapp: "WhatsApp (sobald die Nummer steht)",
};

/** Höchstlänge — lang genug für jede Anweisung, kurz genug, um den Auftrag nicht zu sprengen. */
export const MAX_ZEICHEN = 4000;

// FALLE (22.09.2026, beim ersten Aufruf gesehen): Drei Bereiche werden
// parallel gelesen — drei gleichzeitige „CREATE TABLE IF NOT EXISTS" mit
// BIGSERIAL laufen in Postgres in einen Wettlauf um die Sequenz
// (23505 auf pg_class). Deshalb EIN Versprechen für alle Aufrufer.
let anlegen: Promise<void> | null = null;
function tabelle(): Promise<void> {
  if (!anlegen) {
    anlegen = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_mara_anweisung (
          id BIGSERIAL PRIMARY KEY,
          bereich TEXT NOT NULL,
          text TEXT NOT NULL,
          von TEXT,
          aktiv BOOLEAN NOT NULL DEFAULT TRUE,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_mara_anweisung_aktiv ON fiaon_mara_anweisung (bereich, aktiv, id DESC)`;
    })().catch((e) => {
      // Zwei Server-Instanzen können es gleichzeitig versuchen — dann hat es
      // der andere getan. Nur ein echter Fehler darf den Aufruf scheitern lassen.
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      anlegen = null;
      throw e;
    });
  }
  return anlegen;
}

/** Kurzer Zwischenspeicher: Der Auftrag wird bei jeder Mail gebaut. */
const speicher = new Map<Bereich, { text: string; bis: number }>();

/** Die gültige Fassung — leer, wenn Justin nichts hinterlegt hat. */
export async function anweisungLesen(bereich: Bereich): Promise<string> {
  const da = speicher.get(bereich);
  if (da && da.bis > Date.now()) return da.text;
  await tabelle();
  const [z] = (await sqlPool`
    SELECT text FROM fiaon_mara_anweisung WHERE bereich = ${bereich} AND aktiv ORDER BY id DESC LIMIT 1`
    .catch(() => [])) as any[];
  const text = String(z?.text ?? "").trim();
  speicher.set(bereich, { text, bis: Date.now() + 60_000 });
  return text;
}

/**
 * Der Block, wie er im Auftrag steht. Bewusst mit Rang: Er steht über den
 * Hausregeln, damit eine Anweisung von Justin nicht unter 200 Zeilen begraben
 * wird — aber unter dem Recht, denn die Wortwand prüft danach trotzdem jeden Satz.
 */
export async function anweisungBlock(bereich: Bereich): Promise<string> {
  const text = await anweisungLesen(bereich);
  if (!text) return "";
  return [
    "═══ ANWEISUNG DER GESCHÄFTSFÜHRUNG — SIE GILT VOR ALLEM ANDEREN ═══",
    text,
    "(Wenn diese Anweisung einer Regel weiter unten widerspricht, folgst du dieser Anweisung — außer die Regel verbietet etwas rechtlich. Verbotene Worte, Zusagen ohne Deckung und Mahnungen auf gesperrten Wegen bleiben verboten.)",
    "═══════════════════════════════════════════════════════════════════",
  ].join("\n");
}

/** Eine neue Fassung — die alte bleibt als Fassung erhalten. */
export async function anweisungSetzen(bereich: Bereich, text: string, von: string): Promise<{ id: number | null; zeichen: number }> {
  await tabelle();
  const sauber = String(text ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_ZEICHEN);
  await sqlPool`UPDATE fiaon_mara_anweisung SET aktiv = FALSE WHERE bereich = ${bereich} AND aktiv`;
  speicher.delete(bereich);
  if (!sauber) return { id: null, zeichen: 0 };
  const [z] = (await sqlPool`
    INSERT INTO fiaon_mara_anweisung (bereich, text, von) VALUES (${bereich}, ${sauber}, ${von}) RETURNING id`) as any[];
  return { id: Number(z?.id ?? 0), zeichen: sauber.length };
}

/** Alle Fassungen — die jüngste zuerst. */
export async function anweisungVerlauf(bereich: Bereich, hoechstens = 20): Promise<any[]> {
  await tabelle();
  return (await sqlPool`
    SELECT id, text, von, aktiv, erstellt_am FROM fiaon_mara_anweisung
     WHERE bereich = ${bereich} ORDER BY id DESC LIMIT ${Math.min(Math.max(hoechstens, 1), 50)}`) as any[];
}

/** Eine frühere Fassung wieder gültig machen (als neue Fassung, nichts geht verloren). */
export async function anweisungZurueck(id: number, von: string): Promise<boolean> {
  await tabelle();
  const [alt] = (await sqlPool`SELECT bereich, text FROM fiaon_mara_anweisung WHERE id = ${id}`) as any[];
  if (!alt) return false;
  await anweisungSetzen(String(alt.bereich) as Bereich, String(alt.text), von);
  return true;
}
