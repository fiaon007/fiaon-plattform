// ═══════════════════════════════════════════════════════════════════════════
// MARA ANWEISEN — BEFEHL, PLAN, BESTÄTIGUNG, AUSFÜHRUNG (23.09.2026, E-219)
//
// Justin: „Ich möchte quasi mit Mara kommunizieren und ihr sagen: ‚Ab morgen
// suche bitte weitere 5 Firmenkunden, alle offenen Rechnungen der Privatkunden
// nochmal verschicken, und schau, ob jemand Geburtstag hat.‘ … Wenn ich sage
// ‚Kündige den Kunden XY‘, dann macht Mara das, schickt ihm eine WhatsApp, eine
// E-Mail, kündigt ihn im System, protokolliert alles korrekt. Ich soll aber eben
// alles steuern und nachvollziehen können."
//
// ── DER ABLAUF, UND WARUM ER SO IST ───────────────────────────────────────
// Justin schreibt einen Satz. Daraus wird KEINE sofortige Handlung, sondern
// erst ein PLAN: benannte Schritte mit benannten Menschen und Nummern. Er
// sieht ihn, klickt einmal, und dann läuft er ganz durch.
//
// Justins Entscheidung vom 23.09. auf die Frage, wie weit Mara allein gehen
// darf: „Plan zeigen, du bestätigst mit einem Klick." Genau das ist gebaut.
//
// ── DIE KLASSEN ───────────────────────────────────────────────────────────
//   lesen       Suchen, zählen, nachsehen. Läuft ohne Rückfrage, auch beim Planen.
//   umkehrbar   Nachricht schicken, Wiedervorlage setzen, Notiz schreiben,
//               Aufgabe anlegen. Läuft nach einem Klick.
//   endgueltig  Kündigen, sperren, löschen. Läuft NUR nach einem Klick und
//               steht im Plan besonders gekennzeichnet.
//
// ── DIE WICHTIGSTE SICHERUNG: KEINE ERFUNDENEN MENSCHEN ───────────────────
// Ein Modell, das „Müller" in eine Kunden-Nummer übersetzt, erfindet
// irgendwann eine. Deshalb läuft es in ZWEI Durchgängen:
//   1. Das Modell liest den Befehl und sagt nur, WELCHE NAMEN darin vorkommen.
//   2. Der Server SUCHT diese Namen in der Datenbank und gibt die Treffer
//      zurück. Erst dann baut das Modell den Plan — und darf ausschließlich
//      Kennungen aus dieser Trefferliste verwenden.
// Steht ein Name nicht in der Liste, kann er auch nicht im Plan landen. Ist er
// mehrdeutig, wird der Plan zur Rückfrage und nicht zur Handlung.
//
// ── WAS MARA AUSDRÜCKLICH NICHT KANN ──────────────────────────────────────
// Texte im Quelltext der Website ändern. Justin hat danach gefragt; es geht
// nicht, ohne ihr Schreibrechte auf den laufenden Code zu geben, und ein
// fehlerhafter Satz im Quelltext nimmt die ganze Seite mit. Was sie ändern
// kann, sind Texte, die in der Datenbank stehen (Einstellungen, Vorlagen,
// ihre eigene Anweisung) — dafür gibt es ein eigenes Werkzeug.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export type Klasse = "lesen" | "umkehrbar" | "endgueltig";

export interface AuftragWerkzeug {
  name: string;
  /** Für das Modell: was es tut und wann es zu benutzen ist. */
  beschreibung: string;
  klasse: Klasse;
  /** Welche Felder es erwartet — im Klartext für das Modell. */
  felder: string;
  ausfuehren: (p: any, von: string) => Promise<{ ok: boolean; text: string; daten?: unknown }>;
}

const name = (v: any) => String([v?.first_name, v?.last_name].filter(Boolean).join(" ") || v?.company_name || "").trim();

// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUGE
//
// Jedes ruft eine bestehende Hausfunktion auf. Kein Werkzeug schreibt selbst
// in Tabellen, für die es schon einen Weg gibt — sonst hätte die Kündigung
// bald zwei Fassungen, und eine davon wäre falsch.
// ═══════════════════════════════════════════════════════════════════════════
export const WERKZEUGE: AuftragWerkzeug[] = [
  {
    name: "whatsapp_senden",
    beschreibung: "Schickt einem Menschen eine WhatsApp. Außerhalb des 24-Stunden-Fensters nur mit einer freigegebenen Vorlage.",
    klasse: "umkehrbar",
    felder: "personId (Zahl), text (Freitext, nur im offenen Fenster) ODER vorlage (Name) und werte (Liste)",
    async ausfuehren(p, von) {
      const { waSenden } = await import("./fiaon-whatsapp");
      const { nummerFuerWhatsApp } = await import("../../shared/fiaon-whatsapp-erlaubnis");
      const [m] = (await sqlPool`SELECT primary_phone, first_name, last_name FROM fiaon_persons WHERE id = ${Number(p.personId)}`) as any[];
      const nummer = nummerFuerWhatsApp(m?.primary_phone);
      if (!nummer) return { ok: false, text: "Zu diesem Menschen ist keine Nummer hinterlegt, über die WhatsApp läuft." };
      const erg = await waSenden(nummer, p.vorlage ? { vorlage: String(p.vorlage), werte: (p.werte ?? []).map(String) } : { text: String(p.text ?? "") },
        { personId: Number(p.personId), von: `Mara (${von})` });
      return erg.ok ? { ok: true, text: `WhatsApp an ${name(m)} raus.` } : { ok: false, text: erg.grund ?? "ging nicht raus" };
    },
  },
  {
    name: "kunde_kuendigen",
    beschreibung: "Kündigt den Vertrag eines Kunden: letzte Rate bleibt fällig, alles danach entfällt, Urkunde und Bestätigung gehen raus.",
    klasse: "endgueltig",
    felder: "personId (Zahl), grund (ein Satz)",
    async ausfuehren(p, von) {
      const { kuendigungDurchfuehren } = await import("../routes/fiaon-kuendigung");
      const [a] = (await sqlPool`
        SELECT ref FROM fiaon_applications WHERE person_id = ${Number(p.personId)} AND merged_into IS NULL
           AND (archived_at IS NULL OR payment_status = 'paid')
         ORDER BY (pack_key IS NOT NULL) DESC, (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
      if (!a?.ref) return { ok: false, text: "Zu diesem Menschen gibt es keine Bestellung, die gekündigt werden könnte." };
      const erg = await kuendigungDurchfuehren(String(a.ref), {
        quelle: "admin", grund: `${String(p.grund ?? "Auf Anweisung").slice(0, 250)} (über Mara, ${von})`,
        personId: Number(p.personId),
        unterzeichner: { name: `FIAON LTD (${von})`, rolle: "Geschäftsführung" },
      });
      return erg.ok
        ? { ok: true, text: `Gekündigt (${erg.weg}). Urkunde ${erg.urkunde ? "ausgefertigt" : "FEHLT"}, Bestätigung ${erg.mailGesendet ? "raus" : "nicht gesendet"}.`, daten: erg }
        : { ok: false, text: erg.grund ?? "Die Kündigung ging nicht durch." };
    },
  },
  {
    name: "wiedervorlage_setzen",
    beschreibung: "Legt fest, wann sich jemand den Menschen wieder vornimmt.",
    klasse: "umkehrbar",
    felder: "personId (Zahl), datum (JJJJ-MM-TT)",
    async ausfuehren(p) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.datum ?? ""))) return { ok: false, text: "Kein gültiges Datum." };
      await sqlPool`UPDATE fiaon_persons SET follow_up_date = ${String(p.datum)}::date, updated_at = NOW() WHERE id = ${Number(p.personId)}`;
      return { ok: true, text: `Wiedervorlage auf den ${p.datum} gesetzt.` };
    },
  },
  {
    name: "notiz_schreiben",
    beschreibung: "Schreibt einen Vermerk in den Verlauf eines Menschen. Nie für Zusagen — dafür gibt es die Wiedervorlage.",
    klasse: "umkehrbar",
    felder: "personId (Zahl), text",
    async ausfuehren(p, von) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (person_id, agent_name, type, note, created_at)
        VALUES (${Number(p.personId)}, ${`Mara (${von})`}, 'system', ${String(p.text ?? "").slice(0, 1000)}, NOW())`;
      return { ok: true, text: "Vermerk geschrieben." };
    },
  },
  {
    name: "aufgabe_anlegen",
    beschreibung: "Legt eine Aufgabe für einen Menschen aus dem Team an — wenn etwas ein Mensch tun muss.",
    klasse: "umkehrbar",
    felder: "titel, text, agentId (Zahl, optional), personId (Zahl, optional), tage (Zahl, Frist)",
    async ausfuehren(p, von) {
      // Der Hausweg für Aufgaben ist die TODO-Pipeline (E-028). Eine eigene
      // Tabelle wäre ein zweiter Ort, in den niemand schaut.
      const frist = new Date(Date.now() + Math.max(0, Math.min(60, Number(p.tage) || 2)) * 86400000).toISOString().slice(0, 10);
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: p.personId ? Number(p.personId) : null,
        ref: null,
        titel: String(p.titel ?? "Aufgabe").slice(0, 160),
        text: String(p.text ?? "").slice(0, 4000),
        faelligAm: frist,
        quelle: `Mara (${von})`,
      });
      return { ok: true, text: `Aufgabe „${String(p.titel ?? "").slice(0, 60)}" angelegt, fällig ${frist}.` };
    },
  },
  {
    name: "einstellung_setzen",
    beschreibung: "Ändert einen Text oder Schalter, der in der Datenbank steht (z. B. Maras eigene Anweisung oder ein Schalter). NICHT für Texte im Quelltext der Website.",
    klasse: "endgueltig",
    felder: "schluessel, wert",
    async ausfuehren(p, von) {
      const k = String(p.schluessel ?? "").trim();
      if (!k) return { ok: false, text: "Ohne Schlüssel geht das nicht." };
      await sqlPool`
        INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${String(p.wert ?? "")}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      console.log(`[MARA-AUFTRAG] Einstellung ${k} gesetzt (${von}).`);
      return { ok: true, text: `Einstellung „${k}" gesetzt.` };
    },
  },
];

export function werkzeugFinden(n: string): AuftragWerkzeug | null {
  return WERKZEUGE.find((w) => w.name === n) ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TABELLEN
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
export function auftragTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_mara_auftrag (
          id BIGSERIAL PRIMARY KEY,
          befehl TEXT NOT NULL,
          absicht TEXT,
          plan JSONB NOT NULL DEFAULT '[]'::jsonb,
          rueckfrage TEXT,
          status TEXT NOT NULL DEFAULT 'entwurf',
          ergebnis JSONB NOT NULL DEFAULT '[]'::jsonb,
          von TEXT NOT NULL,
          dauerauftrag_id BIGINT,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          bestaetigt_am TIMESTAMPTZ,
          fertig_am TIMESTAMPTZ
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_mara_auftrag_zeit ON fiaon_mara_auftrag (erstellt_am DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_mara_dauerauftrag (
          id BIGSERIAL PRIMARY KEY,
          befehl TEXT NOT NULL,
          takt TEXT NOT NULL DEFAULT 'taeglich',
          uhrzeit TEXT NOT NULL DEFAULT '09:00',
          an BOOLEAN NOT NULL DEFAULT TRUE,
          von TEXT NOT NULL,
          letzter_lauf TIMESTAMPTZ,
          letzte_meldung TEXT,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
    })().catch((e) => {
      const c = String((e as any)?.code ?? "");
      if (c === "23505" || c === "42P07") return;
      bereit = null;
      throw e;
    });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS MODELL
// ═══════════════════════════════════════════════════════════════════════════
const MODELL = () => process.env.MARA_MODELL || "gpt-5.5";

async function modell(auftrag: string, eingabe: string, tokens = 2500): Promise<{ ok: true; text: string } | { ok: false; grund: string }> {
  const schluessel = process.env.OPENAI_API_KEY;
  if (!schluessel) return { ok: false, grund: "Für die KI fehlt der Schlüssel OPENAI_API_KEY." };
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 60_000);
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${schluessel}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELL(), instructions: auftrag, input: eingabe, max_output_tokens: tokens, reasoning: { effort: "medium" } }),
      signal: abbruch.signal,
    });
    const roh: any = await res.json().catch(() => null);
    try {
      const { nutzungMerken } = await import("./fiaon-postmeister-schema");
      const u = roh?.usage ?? {};
      await nutzungMerken({
        dienst: "mara-auftrag", modell: MODELL(), dauerMs: Date.now() - start, ok: res.ok,
        usage: { prompt_tokens: u.input_tokens, completion_tokens: u.output_tokens },
        fehler: res.ok ? null : JSON.stringify(roh?.error ?? "").slice(0, 200),
      });
    } catch { /* Kostenzählung darf den Auftrag nicht aufhalten */ }
    if (!res.ok) return { ok: false, grund: `Die KI antwortet gerade nicht (HTTP ${res.status}).` };
    let text = "";
    for (const teil of Array.isArray(roh?.output) ? roh.output : []) {
      if (teil?.type !== "message" || !Array.isArray(teil.content)) continue;
      for (const c of teil.content) if (c?.type === "output_text" && typeof c.text === "string") text += c.text;
    }
    text = (text || String(roh?.output_text ?? "")).trim();
    return text ? { ok: true, text } : { ok: false, grund: "Die KI hat nichts geliefert." };
  } catch (e: any) {
    return { ok: false, grund: e?.name === "AbortError" ? "Die KI hat zu lange gebraucht." : "Die KI ist gerade nicht erreichbar." };
  } finally { clearTimeout(uhr); }
}

function jsonAus(text: string): any {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* weiter unten */ }
  const a = t.indexOf("{"); const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* aufgeben */ } }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DURCHGANG 1 — WELCHE NAMEN STEHEN IM BEFEHL?
// ═══════════════════════════════════════════════════════════════════════════
const AUFTRAG_NAMEN = `Du liest eine Anweisung des Inhabers einer deutschen Firma an seine Assistentin.
Nenne AUSSCHLIESSLICH die Eigennamen von Menschen oder Firmen, die in der Anweisung vorkommen und die in der
Datenbank gesucht werden müssen. Keine Erklärungen, keine erfundenen Namen.
Antworte als JSON: {"namen": ["..."], "absicht": "ein Satz, was gewollt ist"}`;

async function namenFinden(befehl: string): Promise<{ namen: string[]; absicht: string }> {
  const a = await modell(AUFTRAG_NAMEN, befehl, 600);
  if (!a.ok) return { namen: [], absicht: "" };
  const j = jsonAus(a.text);
  return {
    namen: Array.isArray(j?.namen) ? j.namen.map(String).slice(0, 8) : [],
    absicht: String(j?.absicht ?? "").slice(0, 300),
  };
}

/** Die Treffer aus der echten Datenbank — nur daraus darf der Plan schöpfen. */
async function treffer(namen: string[]): Promise<{ art: string; id: number; name: string; zusatz: string }[]> {
  const raus: { art: string; id: number; name: string; zusatz: string }[] = [];
  for (const n of namen) {
    const muster = `%${n.trim()}%`;
    if (n.trim().length < 2) continue;
    const menschen = (await sqlPool`
      SELECT p.id, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name,
             p.primary_email, COALESCE(p.priority_tier, 3) AS stufe, a.name AS betreuer
        FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
       WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
         AND (TRIM(CONCAT_WS(' ', p.first_name, p.last_name)) ILIKE ${muster} OR p.company_name ILIKE ${muster})
       ORDER BY p.updated_at DESC NULLS LAST LIMIT 6`.catch(() => [])) as any[];
    for (const m of menschen) {
      raus.push({ art: "kunde", id: Number(m.id), name: String(m.name || "").trim() || `#${m.id}`,
        zusatz: `Stufe ${m.stufe}${m.betreuer ? `, Betreuer ${m.betreuer}` : ""}${m.primary_email ? `, ${m.primary_email}` : ""}` });
    }
    const leute = (await sqlPool`
      SELECT id, name, rolle FROM fiaon_agents WHERE name ILIKE ${muster} LIMIT 4`.catch(() => [])) as any[];
    for (const l of leute) raus.push({ art: "mitarbeiter", id: Number(l.id), name: String(l.name), zusatz: String(l.rolle ?? "") });
  }
  return raus;
}

// ═══════════════════════════════════════════════════════════════════════════
// DURCHGANG 2 — DER PLAN
// ═══════════════════════════════════════════════════════════════════════════
function auftragPlan(): string {
  const liste = WERKZEUGE.map((w) => `- ${w.name} [${w.klasse}] — ${w.beschreibung} Felder: ${w.felder}`).join("\n");
  return `Du bist Mara, die Assistentin von FIAON. Der Inhaber gibt dir eine Anweisung. Mache daraus einen PLAN.

DEINE WERKZEUGE:
${liste}

REGELN, die nicht verhandelbar sind:
1. Verwende als personId oder agentId AUSSCHLIESSLICH Kennungen aus der Trefferliste, die dir gegeben wird.
   Erfinde NIEMALS eine Kennung. Steht der gesuchte Mensch nicht in der Liste, mache daraus eine Rückfrage.
2. Ist ein Name mehrdeutig (mehrere Treffer), mache daraus eine Rückfrage — keinen Plan.
3. Schritte der Klasse "endgueltig" nur, wenn die Anweisung sie eindeutig verlangt.
4. Kein Schritt ohne Werkzeug aus der Liste. Was kein Werkzeug abdeckt, wird eine Rückfrage.
5. Schreibe alles auf Deutsch, in der Sie-Form gegenüber Kunden, ohne Emojis.
6. Halte dich kurz: so wenige Schritte wie möglich, so viele wie nötig.

Antworte als JSON:
{"zusammenfassung": "ein Satz für den Inhaber",
 "rueckfrage": "nur wenn du nicht handeln kannst, sonst null",
 "schritte": [{"werkzeug": "name", "argumente": {...}, "wen": "Name des Menschen oder leer", "warum": "ein halber Satz"}]}`;
}

export interface Plan {
  zusammenfassung: string;
  rueckfrage: string | null;
  schritte: { werkzeug: string; argumente: any; wen: string; warum: string; klasse: Klasse }[];
}

/** Aus einem Satz einen Plan machen. Schreibt nichts — nur lesen und denken. */
export async function planErstellen(befehl: string): Promise<{ ok: boolean; plan?: Plan; absicht?: string; grund?: string }> {
  const { namen, absicht } = await namenFinden(befehl);
  const gefunden = namen.length ? await treffer(namen) : [];
  const eingabe = [
    `ANWEISUNG: ${befehl}`,
    namen.length ? `GESUCHTE NAMEN: ${namen.join(", ")}` : "",
    gefunden.length
      ? `TREFFER AUS DER DATENBANK (nur diese Kennungen sind erlaubt):\n${gefunden.map((t) => `- ${t.art} #${t.id}: ${t.name} (${t.zusatz})`).join("\n")}`
      : namen.length ? "TREFFER AUS DER DATENBANK: keine. Mache daraus eine Rückfrage." : "",
  ].filter(Boolean).join("\n\n");

  const a = await modell(auftragPlan(), eingabe, 2500);
  if (!a.ok) return { ok: false, grund: a.grund };
  const j = jsonAus(a.text);
  if (!j) return { ok: false, grund: "Die Antwort der KI war nicht lesbar. Bitte den Satz anders formulieren." };

  const erlaubt = new Set(gefunden.map((t) => `${t.art}:${t.id}`));
  const schritte: Plan["schritte"] = [];
  for (const s of Array.isArray(j.schritte) ? j.schritte : []) {
    const w = werkzeugFinden(String(s?.werkzeug ?? ""));
    if (!w) continue;
    // ── DIE WICHTIGSTE PRÜFUNG ──────────────────────────────────────────
    // Eine Kennung, die nicht aus der Trefferliste stammt, kommt nicht in den
    // Plan. Damit kann eine erfundene Nummer gar nicht erst ausgeführt werden.
    const pid = Number(s?.argumente?.personId ?? 0);
    const aid = Number(s?.argumente?.agentId ?? 0);
    if (pid && !erlaubt.has(`kunde:${pid}`)) continue;
    if (aid && !erlaubt.has(`mitarbeiter:${aid}`)) continue;
    schritte.push({
      werkzeug: w.name, argumente: s?.argumente ?? {}, klasse: w.klasse,
      wen: String(s?.wen ?? "").slice(0, 120), warum: String(s?.warum ?? "").slice(0, 200),
    });
  }
  const rueckfrage = String(j.rueckfrage ?? "").trim() || (schritte.length === 0 ? "Daraus kann ich keinen Schritt bauen — bitte sag mir genauer, wen oder was du meinst." : "");
  return {
    ok: true,
    absicht: absicht || String(j.zusammenfassung ?? ""),
    plan: {
      zusammenfassung: String(j.zusammenfassung ?? "").slice(0, 500),
      rueckfrage: rueckfrage || null,
      schritte,
    },
  };
}

/** Den Plan speichern — als Entwurf, noch ohne Wirkung. */
export async function auftragAnlegen(befehl: string, von: string, dauerauftragId: number | null = null): Promise<any> {
  await auftragTabellen();
  const erg = await planErstellen(befehl);
  if (!erg.ok || !erg.plan) {
    const [z] = (await sqlPool`
      INSERT INTO fiaon_mara_auftrag (befehl, absicht, plan, rueckfrage, status, von, dauerauftrag_id)
      VALUES (${befehl}, NULL, '[]'::jsonb, ${erg.grund ?? "Kein Plan"}, 'rueckfrage', ${von}, ${dauerauftragId})
      RETURNING *`) as any[];
    return z;
  }
  const [z] = (await sqlPool`
    INSERT INTO fiaon_mara_auftrag (befehl, absicht, plan, rueckfrage, status, von, dauerauftrag_id)
    VALUES (${befehl}, ${erg.absicht ?? null}, ${sqlPool.json(erg.plan.schritte as any)}, ${erg.plan.rueckfrage},
            ${erg.plan.rueckfrage ? "rueckfrage" : "entwurf"}, ${von}, ${dauerauftragId})
    RETURNING *`) as any[];
  return { ...z, zusammenfassung: erg.plan.zusammenfassung };
}

/**
 * Den Plan ausführen. Ein Schritt, der scheitert, hält die folgenden NICHT auf —
 * aber er steht als gescheitert im Ergebnis. Ein halb ausgeführter Plan, der
 * so tut, als sei er ganz gelaufen, wäre das Schlimmste.
 */
export async function auftragAusfuehren(id: number, von: string): Promise<{ ok: boolean; ergebnis: any[]; grund?: string }> {
  await auftragTabellen();
  const [a] = (await sqlPool`SELECT * FROM fiaon_mara_auftrag WHERE id = ${id} AND status IN ('entwurf','bestaetigt')`) as any[];
  if (!a) return { ok: false, ergebnis: [], grund: "Diesen Auftrag gibt es nicht mehr oder er ist schon gelaufen." };
  await sqlPool`UPDATE fiaon_mara_auftrag SET status = 'laeuft', bestaetigt_am = NOW() WHERE id = ${id}`;

  const schritte = (typeof a.plan === "string" ? JSON.parse(a.plan) : a.plan) ?? [];
  const ergebnis: any[] = [];
  for (const s of schritte) {
    const w = werkzeugFinden(String(s.werkzeug));
    if (!w) { ergebnis.push({ ...s, ok: false, text: "Dieses Werkzeug gibt es nicht mehr." }); continue; }
    try {
      const r = await w.ausfuehren(s.argumente ?? {}, von);
      ergebnis.push({ werkzeug: w.name, wen: s.wen, ok: r.ok, text: r.text });
      console.log(`[MARA-AUFTRAG] ${id} · ${w.name} · ${r.ok ? "ok" : "FEHLER"}: ${r.text}`);
    } catch (e) {
      ergebnis.push({ werkzeug: w.name, wen: s.wen, ok: false, text: String((e as Error)?.message || e).slice(0, 200) });
    }
  }
  const alleOk = ergebnis.every((r) => r.ok);
  await sqlPool`
    UPDATE fiaon_mara_auftrag SET status = ${alleOk ? "fertig" : "teilweise"}, ergebnis = ${sqlPool.json(ergebnis)}, fertig_am = NOW()
     WHERE id = ${id}`;
  return { ok: alleOk, ergebnis };
}

export async function auftragVerwerfen(id: number, von: string): Promise<boolean> {
  await auftragTabellen();
  const z = (await sqlPool`
    UPDATE fiaon_mara_auftrag SET status = 'verworfen', fertig_am = NOW(),
           ergebnis = ${sqlPool.json([{ text: `Verworfen von ${von}` }])}
     WHERE id = ${id} AND status IN ('entwurf','rueckfrage') RETURNING id`) as any[];
  return z.length > 0;
}

export async function auftraege(hoechstens = 40): Promise<any[]> {
  await auftragTabellen();
  return (await sqlPool`SELECT * FROM fiaon_mara_auftrag ORDER BY id DESC LIMIT ${Math.min(Math.max(hoechstens, 1), 200)}`) as any[];
}

// ═══════════════════════════════════════════════════════════════════════════
// DAUERAUFTRÄGE
//
// „Ab morgen suche bitte weitere 5 Firmenkunden" — das ist kein einmaliger
// Auftrag, sondern einer, der wiederkehrt. Er wird bei jedem Lauf NEU geplant:
// Die Lage ändert sich, und ein eingefrorener Plan von vorletzter Woche würde
// Menschen anschreiben, die längst bezahlt haben.
//
// WICHTIG: Ein Dauerauftrag führt NIEMALS einen endgültigen Schritt allein aus.
// Enthält sein Plan einen, wartet der ganze Auftrag auf Justins Klick. Sonst
// hätte er über die Hintertür genau die Vollmacht, die er vorn nicht hat.
// ═══════════════════════════════════════════════════════════════════════════
export async function dauerauftraege(): Promise<any[]> {
  await auftragTabellen();
  return (await sqlPool`SELECT * FROM fiaon_mara_dauerauftrag ORDER BY id DESC`) as any[];
}

export async function dauerauftragAnlegen(befehl: string, takt: string, uhrzeit: string, von: string): Promise<any> {
  await auftragTabellen();
  const [z] = (await sqlPool`
    INSERT INTO fiaon_mara_dauerauftrag (befehl, takt, uhrzeit, von)
    VALUES (${befehl}, ${["taeglich", "werktags", "woechentlich"].includes(takt) ? takt : "taeglich"},
            ${/^\d{2}:\d{2}$/.test(uhrzeit) ? uhrzeit : "09:00"}, ${von})
    RETURNING *`) as any[];
  return z;
}

export async function dauerauftragSchalten(id: number, an: boolean): Promise<void> {
  await auftragTabellen();
  await sqlPool`UPDATE fiaon_mara_dauerauftrag SET an = ${an} WHERE id = ${id}`;
}

export async function dauerauftragLoeschen(id: number): Promise<void> {
  await auftragTabellen();
  await sqlPool`DELETE FROM fiaon_mara_dauerauftrag WHERE id = ${id}`;
}

/** Welche Daueraufträge sind jetzt dran? Läuft im Tageslauf. */
export async function dauerauftraegeLaufen(): Promise<{ geplant: number; ausgefuehrt: number; wartend: number }> {
  await auftragTabellen();
  const [jetzt] = (await sqlPool`
    SELECT TO_CHAR(NOW() AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS uhr,
           EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::int AS wochentag,
           (NOW() AT TIME ZONE 'Europe/Berlin')::date::text AS heute`) as any[];
  const faellig = (await sqlPool`
    SELECT * FROM fiaon_mara_dauerauftrag
     WHERE an = TRUE AND uhrzeit <= ${String(jetzt.uhr)}
       AND (letzter_lauf IS NULL OR (letzter_lauf AT TIME ZONE 'Europe/Berlin')::date < ${String(jetzt.heute)}::date)`) as any[];

  let geplant = 0, ausgefuehrt = 0, wartend = 0;
  for (const d of faellig) {
    if (d.takt === "werktags" && Number(jetzt.wochentag) > 5) continue;
    if (d.takt === "woechentlich" && Number(jetzt.wochentag) !== 1) continue;
    const auftrag = await auftragAnlegen(String(d.befehl), `Dauerauftrag ${d.id}`, Number(d.id));
    geplant++;
    const schritte = (typeof auftrag.plan === "string" ? JSON.parse(auftrag.plan) : auftrag.plan) ?? [];
    const endgueltig = schritte.some((s: any) => s.klasse === "endgueltig");
    let meldung = "";
    if (auftrag.status === "rueckfrage") {
      meldung = "Rückfrage — nichts getan.";
      wartend++;
    } else if (endgueltig) {
      meldung = "Enthält einen endgültigen Schritt — wartet auf Bestätigung.";
      wartend++;
    } else {
      const r = await auftragAusfuehren(Number(auftrag.id), `Dauerauftrag ${d.id}`);
      meldung = r.ergebnis.map((x: any) => x.text).join(" · ").slice(0, 400) || "nichts zu tun";
      ausgefuehrt++;
    }
    await sqlPool`UPDATE fiaon_mara_dauerauftrag SET letzter_lauf = NOW(), letzte_meldung = ${meldung} WHERE id = ${d.id}`;
  }
  if (geplant) console.log(`[MARA-AUFTRAG] Daueraufträge: ${geplant} geplant, ${ausgefuehrt} gelaufen, ${wartend} warten.`);
  return { geplant, ausgefuehrt, wartend };
}

// ═══════════════════════════════════════════════════════════════════════════
// MARAS TAGESBERICHT (23.09.2026, E-219)
//
// Justin: „Ich möchte außerdem von Mara einen Arbeitsbericht haben, jeden Tag
// zur gleichen Zeit, pünktlich und 100 % vollständig, sodass ich wirklich ALLES
// einsehe und gegebenenfalls steuern kann."
//
// Der Bericht rechnet nichts nach. Er trägt zusammen, was ohnehin protokolliert
// ist: Mails, WhatsApp, Aufträge, Kosten. Eine eigene Zählung wäre eine zweite
// Wahrheit, und die erste steht schon in den Tabellen.
// ═══════════════════════════════════════════════════════════════════════════
export interface MaraTag {
  tag: string;
  mails: { geschrieben: number; entwuerfe: number };
  whatsapp: { raus: number; rein: number; menschen: number };
  auftraege: { gelaufen: number; wartend: number; verworfen: number };
  dauerauftraege: { an: number; heuteGelaufen: number };
  kostenEuro: number;
  offen: { was: string; wieviel: number }[];
}

export async function maraTag(tag?: string): Promise<MaraTag> {
  await auftragTabellen();
  const [z] = (await sqlPool`
    SELECT COALESCE(${tag ?? null}::text, (NOW() AT TIME ZONE 'Europe/Berlin')::date::text) AS tag`) as any[];
  const t = String(z.tag);

  const [mails] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE gesendet_am IS NOT NULL)::int AS geschrieben,
           COUNT(*) FILTER (WHERE gesendet_am IS NULL AND entwurf IS NOT NULL)::int AS entwuerfe
      FROM fiaon_postmeister
     WHERE (COALESCE(gesendet_am, created_at) AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`
    .catch(() => [{ geschrieben: 0, entwuerfe: 0 }])) as any[];

  const [wa] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE richtung = 'raus')::int AS raus,
           COUNT(*) FILTER (WHERE richtung = 'rein')::int AS rein,
           COUNT(DISTINCT nummer)::int AS menschen
      FROM fiaon_whatsapp
     WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`
    .catch(() => [{ raus: 0, rein: 0, menschen: 0 }])) as any[];

  const [auf] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE status IN ('fertig','teilweise'))::int AS gelaufen,
           COUNT(*) FILTER (WHERE status IN ('entwurf','rueckfrage'))::int AS wartend,
           COUNT(*) FILTER (WHERE status = 'verworfen')::int AS verworfen
      FROM fiaon_mara_auftrag
     WHERE (erstellt_am AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`) as any[];

  const [dauer] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE an)::int AS an,
           COUNT(*) FILTER (WHERE (letzter_lauf AT TIME ZONE 'Europe/Berlin')::date = ${t}::date)::int AS heute
      FROM fiaon_mara_dauerauftrag`) as any[];

  let kostenEuro = 0;
  try {
    const { kostenHeute } = await import("./fiaon-postmeister-schema");
    kostenEuro = (await kostenHeute("postmeister").catch(() => 0)) + (await kostenHeute("mara-auftrag").catch(() => 0));
  } catch { /* ohne Kosten weiter */ }

  // Was liegen geblieben ist — das ist der Teil, für den Justin den Bericht will.
  const offen: { was: string; wieviel: number }[] = [];
  const [w1] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_mara_auftrag WHERE status IN ('entwurf','rueckfrage')`) as any[];
  if (Number(w1?.n)) offen.push({ was: "Aufträge warten auf deine Bestätigung", wieviel: Number(w1.n) });
  const [w2] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_whatsapp_gespraech g
     WHERE EXISTS (SELECT 1 FROM fiaon_whatsapp w WHERE w.nummer = g.nummer AND w.richtung = 'rein'
                     AND w.id > COALESCE(g.gelesen_bis, 0))`.catch(() => [])) as any[];
  if (Number(w2?.n)) offen.push({ was: "WhatsApp-Gespräche ungelesen", wieviel: Number(w2.n) });

  return {
    tag: t,
    mails: { geschrieben: Number(mails?.geschrieben || 0), entwuerfe: Number(mails?.entwuerfe || 0) },
    whatsapp: { raus: Number(wa?.raus || 0), rein: Number(wa?.rein || 0), menschen: Number(wa?.menschen || 0) },
    auftraege: { gelaufen: Number(auf?.gelaufen || 0), wartend: Number(auf?.wartend || 0), verworfen: Number(auf?.verworfen || 0) },
    dauerauftraege: { an: Number(dauer?.an || 0), heuteGelaufen: Number(dauer?.heute || 0) },
    kostenEuro: Math.round(kostenEuro * 100) / 100,
    offen,
  };
}
