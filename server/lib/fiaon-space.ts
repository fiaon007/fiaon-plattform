// ═══════════════════════════════════════════════════════════════════════════
// FIAON SPACE — der gemeinsame Raum
//
// Ein wachsendes Team, das sich über vier Städte verteilt, hat kein
// Treppenhaus und keine Kaffeeküche. Der Space ersetzt sie nicht, aber er ist
// der Ort, an dem etwas steht, das nicht in einer Kundenakte steht.
//
// DIE EINE HARTE REGEL: HIER STEHEN KEINE KUNDENDATEN.
// Nicht aus Prinzipienreiterei — der Space ist für JEDE Mitarbeiterrolle
// sichtbar, auch für die, die den betreffenden Kunden nie betreuen dürfte.
// Wer hier eine Rufnummer hineinschreibt, hebelt die Zuständigkeitsgrenzen des
// ganzen Hauses aus, ohne es zu merken. Deshalb steht die Prüfung im SERVER
// und nicht nur als Hinweis am Eingabefeld: Ein Hinweis, den man überlesen
// kann, hat man schon überlesen.
//
// Was die Prüfung NICHT kann: Namen erkennen. „Herr Müller zahlt nicht" geht
// durch, und das ist die ehrliche Grenze einer Textprüfung. Deshalb steht der
// Hinweis TROTZDEM am Feld — die Wand fängt das Grobe, die Kultur den Rest.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { gedankeFuer } from "./fiaon-gedanken";

type Lauf = typeof sqlPool;

/** Die vier Marken. Eigene SVG im Client, hier nur die Schlüssel. */
// ── ZWEI REAKTIONEN, NICHT VIER (11.08.2026) ───────────────────────────────
// „Daumen, Herz, Stern, Blitz" klang nach Auswahl und war keine: Niemand
// konnte sagen, wofür Stern statt Herz steht, und die Zahlen verteilten sich
// auf vier Töpfe, sodass keine aussagekräftig war.
export const REAKTIONEN = ["gut", "schlecht"] as const;
export type Reaktion = (typeof REAKTIONEN)[number];
export function istReaktion(v: unknown): v is Reaktion {
  return typeof v === "string" && (REAKTIONEN as readonly string[]).includes(v);
}

export const HINWEIS_AM_FELD =
  "Keine Kundendaten hier — keine Namen, keine Beträge, keine Nummern. Die gehören in die Akte.";

// ───────────────────────────────────────────────────────────────────────────
// Die Wand gegen Kundendaten
// ───────────────────────────────────────────────────────────────────────────

export interface Befund { erlaubt: boolean; grund: string | null; }

/**
 * Prüft einen Beitrag auf Muster, die eindeutig Kundendaten sind.
 *
 * Bewusst eng gefasst: Ein Filter, der zu viel abfängt, wird zum Ärgernis und
 * damit umgangen („dann schreibe ich es eben in WhatsApp") — und das ist genau
 * das Gegenteil dessen, was hier erreicht werden soll.
 *
 * Erkannt werden Dinge, die man nicht versehentlich schreibt:
 *   · Rufnummern (auch mit Leerzeichen, Punkten, Schrägstrichen)
 *   · IBAN
 *   · E-Mail-Adressen
 *   · Verwendungszwecke im Hausformat (FIAON-…)
 */
export function pruefeBeitrag(text: string): Befund {
  const roh = String(text ?? "");
  if (roh.trim().length < 2) return { erlaubt: false, grund: "Der Beitrag ist leer." };
  if (roh.length > 4000) return { erlaubt: false, grund: "Der Beitrag ist zu lang (höchstens 4000 Zeichen)." };

  // IBAN: zwei Buchstaben, zwei Ziffern, dann mindestens elf weitere Zeichen —
  // Leerzeichen erlaubt, weil so gut wie jeder sie mit Leerzeichen kopiert.
  if (/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/i.test(roh.replace(/\u00a0/g, " "))) {
    return { erlaubt: false, grund: "Das sieht nach einer IBAN aus. Bankdaten gehören in die Akte, nicht in den Space." };
  }

  // E-Mail.
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(roh)) {
    return { erlaubt: false, grund: "Das sieht nach einer E-Mail-Adresse aus. Kontaktdaten gehören in die Akte." };
  }

  // Verwendungszweck im Hausformat.
  if (/\bFIAON-[A-Z0-9-]{4,}\b/i.test(roh)) {
    return { erlaubt: false, grund: "Das sieht nach einem Verwendungszweck aus. Bestelldaten gehören in die Akte." };
  }

  // Rufnummer: mindestens neun Ziffern am Stück, Trennzeichen erlaubt.
  // Jahreszahlen, Beträge und Uhrzeiten fallen dadurch nicht darunter.
  const ziffernfolge = roh.replace(/[^\d+]/g, (z) => (/[ .\-/()]/.test(z) ? "" : "\u0000"));
  if (/(?:\+\d{9,}|\d{9,})/.test(ziffernfolge)) {
    return { erlaubt: false, grund: "Das sieht nach einer Telefonnummer aus. Kundendaten gehören in die Akte, nicht in den Space." };
  }
  return { erlaubt: true, grund: null };
}

// ───────────────────────────────────────────────────────────────────────────
// Feed
// ───────────────────────────────────────────────────────────────────────────

export interface Post {
  id: number;
  autorAgentId: number | null;
  autorTyp: string;
  autorName: string | null;
  autorAvatar: string | null;
  text: string;
  angepinnt: boolean;
  autoArt: string | null;
  am: string;
  akteRef: string | null;
  aktePerson: number | null;
  hatBild: boolean;
  bearbeitet: boolean;
  meiner: boolean;
  bearbeitbarBis: string | null;
  reaktionen: Record<string, number>;
  /** Die eigene Reaktion, falls es eine gibt. */
  meine: string | null;
  kommentare: {
    id: number; agentId: number; name: string; avatar: string | null;
    text: string; am: string; antwortAuf: number | null;
    bearbeitet: boolean; meiner: boolean;
  }[];
}

/**
 * Der Feed, seitenweise.
 *
 * `vorId` ist der Anker fürs Nachladen: „gib mir, was VOR diesem Beitrag
 * kommt". Ein Zahlen-Offset wäre falsch, sobald während des Scrollens ein
 * neuer Beitrag oben erscheint — dann rutscht alles um eins und der Leser
 * sieht eine Zeile doppelt.
 *
 * ── WARUM DER ANKER AUS ZWEI TEILEN BESTEHT ────────────────────────────────
 * Die erste Fassung verglich nur `p.id < vorId`. Das ist falsch, sobald
 * Kennung und Zeitstempel auseinanderlaufen — und genau das tut der
 * Seed-Lauf: Er legt sechzig Tage Vergangenheit mit aufsteigenden Kennungen
 * an. Gemessen: Seite zwei überschnitt sich in sechs von 25 Beiträgen mit
 * Seite eins.
 *
 * Der zusammengesetzte Vergleich `(created_at, id) < (vorAm, vorId)` folgt
 * exakt der Sortierung. Er ist die einzige Fassung, die auch dann stimmt,
 * wenn zwei Beiträge dieselbe Sekunde tragen.
 *
 * Angepinntes kommt NUR auf der ersten Seite: Sonst stünde es auf jeder Seite
 * wieder oben.
 */
/**
 * Der Tageskopf — echte Zahlen, je Rolle die passenden.
 *
 * ── WAS HIER STAND UND WARUM ES WEG MUSSTE ─────────────────────────────────
 * In der rechten Spalte stand „HEUTE · Sonntag, 9. August · Was hier steht,
 * kommt aus echten Zahlen des Teams" — ein Versprechen ohne eine einzige
 * Zahl. Und darunter „DER RAUM: keine Kundendaten hier" — die Hausordnung,
 * die schon am Schreibfeld steht.
 *
 * Zwei Karten, die Platz kosten und nichts sagen. Jetzt stehen dort die
 * Zahlen, die das Versprechen einlösen.
 */
export async function tageszahlen(
  agentId: number, alsAdmin: boolean, lauf: Lauf = sqlPool,
): Promise<{ titel: string; wert: string; hinweis?: string }[]> {
  const heute = berlinToday();

  if (alsAdmin) {
    const [u] = (await lauf`
      SELECT COALESCE(SUM(base_amount_cents) FILTER (WHERE COALESCE(kind,'') <> 'stunden'), 0)::bigint AS umsatz,
             COUNT(*) FILTER (WHERE COALESCE(kind,'') <> 'stunden')::int AS abschluesse
      FROM fiaon_commissions
      WHERE status <> 'storniert' AND created_at >= date_trunc('day', ${heute}::date)
    `) as any[];
    const [z] = (await lauf`
      SELECT COUNT(*)::int AS offen FROM fiaon_applications
      WHERE payment_status <> 'paid' AND merged_into IS NULL AND archived_at IS NULL
        AND claimed_paid_at IS NOT NULL
    `) as any[];
    const [d] = (await lauf`
      SELECT COUNT(*)::int AS n FROM fiaon_mail_log
      WHERE status = 'fehlgeschlagen' AND created_at > NOW() - INTERVAL '24 hours'
    `.catch(() => [{ n: 0 }] as any[])) as any[];
    const [k] = (await lauf`
      SELECT COUNT(*)::int AS n FROM fiaon_contact_log
      WHERE type <> 'system' AND created_at >= date_trunc('day', ${heute}::date)
    `) as any[];
    return [
      { titel: "Umsatz heute", wert: `${(Number(u.umsatz) / 100).toFixed(2).replace(".", ",")} €`,
        hinweis: `${u.abschluesse} ${Number(u.abschluesse) === 1 ? "Abschluss" : "Abschlüsse"}` },
      { titel: "Zahlung angekündigt", wert: String(z.offen), hinweis: "noch nicht eingegangen" },
      { titel: "Kontakte heute", wert: String(k.n), hinweis: "vom ganzen Team" },
      { titel: "Mails gescheitert", wert: String(d.n), hinweis: "letzte 24 Stunden" },
    ];
  }

  // Team: die eigenen Zahlen.
  const [m] = (await lauf`
    SELECT
      COALESCE((SELECT SUM(amount_cents) FROM fiaon_commissions c
                WHERE c.agent_id = ${agentId} AND c.status <> 'storniert'
                  AND c.created_at >= date_trunc('month', ${heute}::date)), 0)::bigint AS verdienst,
      (SELECT COUNT(*)::int FROM fiaon_contact_log cl
        WHERE cl.agent_id = ${agentId} AND cl.type <> 'system'
          AND cl.created_at >= date_trunc('day', ${heute}::date)) AS kontakte,
      -- 24.08.2026 (Justin: „Wie kann da stehen Stufe A 4 offen? Jeder hat ja
      -- nur das 2+2+2-Modell!"): Diese Zahl zählt ALLE Stufe-A-Kunden im
      -- Bestand, nicht die Arbeitsliste. Sie war damit rechnerisch richtig und
      -- trotzdem falsch, weil die Beschriftung „warten auf dich" nach der
      -- Arbeitsliste klang. Sie bleibt als HINWEIS erhalten, die große Zahl
      -- ist jetzt die Arbeitsliste selbst (siehe unten).
      (SELECT COUNT(*)::int FROM fiaon_persons p
        WHERE p.assigned_agent_id = ${agentId} AND p.merged_into_person_id IS NULL
          AND p.priority_tier = 1 AND NOT p.is_blocked) AS stufe_a,
      -- Die Arbeitsliste: höchstens 2 je Stufe, höchstens 6 gesamt — dieselbe
      -- Rechnung wie in GET /agent/vertrieb/arbeitsliste (SLOTS=6, JE_GRUPPE=2).
      LEAST(6,
        LEAST(2, (SELECT COUNT(*)::int FROM fiaon_persons p WHERE p.assigned_agent_id = ${agentId}
                    AND p.merged_into_person_id IS NULL AND NOT p.is_blocked AND p.priority_tier = 1))
      + LEAST(2, (SELECT COUNT(*)::int FROM fiaon_persons p WHERE p.assigned_agent_id = ${agentId}
                    AND p.merged_into_person_id IS NULL AND NOT p.is_blocked AND p.priority_tier = 2))
      + LEAST(2, (SELECT COUNT(*)::int FROM fiaon_persons p WHERE p.assigned_agent_id = ${agentId}
                    AND p.merged_into_person_id IS NULL AND NOT p.is_blocked AND p.priority_tier = 3))
      )::int AS arbeitsliste,
      (SELECT COUNT(*)::int FROM fiaon_commissions c
        WHERE c.agent_id = ${agentId} AND c.status <> 'storniert'
          AND COALESCE(c.kind,'') <> 'stunden'
          AND c.created_at >= date_trunc('month', ${heute}::date)) AS abschluesse
  `) as any[];
  return [
    { titel: "Verdienst Monat", wert: `${(Number(m.verdienst) / 100).toFixed(2).replace(".", ",")} €`,
      hinweis: `${m.abschluesse} ${Number(m.abschluesse) === 1 ? "Abschluss" : "Abschlüsse"}` },
    { titel: "Kontakte heute", wert: String(m.kontakte), hinweis: "von dir dokumentiert" },
    // VORHER: „Stufe A offen · warten auf dich" mit der Bestandszahl — las sich
    // wie die Arbeitsliste und widersprach dem 2+2+2-Modell. NACHHER steht dort
    // die Arbeitsliste, und der Bestand steht als Hinweis daneben.
    { titel: "In deiner Arbeitsliste", wert: String(m.arbeitsliste),
      hinweis: `von ${m.stufe_a} Stufe A im Bestand` },
  ];
}

export async function feedLesen(
  agentId: number, limit = 40, lauf: Lauf = sqlPool, vorId: number | null = null,
): Promise<Post[]> {
  let anker: { am: string; id: number } | null = null;
  if (vorId) {
    const [v] = (await lauf`SELECT created_at, id FROM fiaon_posts WHERE id = ${vorId}`) as any[];
    if (v) anker = { am: v.created_at, id: Number(v.id) };
  }

  const posts = (await lauf`
    SELECT p.id, p.autor_agent_id, p.autor_typ, p.text, p.angepinnt, p.auto_art, p.created_at,
           p.akte_ref, p.akte_person, p.bild_typ, p.bearbeitet_am,
           (p.bild IS NOT NULL) AS hat_bild,
           COALESCE(NULLIF(a.first_name, ''), a.name) AS autor_name, a.avatar AS avatar_url
    FROM fiaon_posts p
    LEFT JOIN fiaon_agents a ON a.id = p.autor_agent_id
    WHERE p.geloescht_at IS NULL
      ${anker
        ? lauf`AND (p.created_at, p.id) < (${anker.am}::timestamptz, ${anker.id}) AND NOT p.angepinnt`
        : lauf``}
    ORDER BY ${anker ? lauf`p.created_at DESC` : lauf`p.angepinnt DESC, p.created_at DESC`}, p.id DESC
    LIMIT ${limit}
  `) as any[];
  if (posts.length === 0) return [];
  const ids = posts.map((p) => Number(p.id));

  const [reaktionen, kommentare] = await Promise.all([
    lauf`SELECT post_id, art, agent_id FROM fiaon_post_reaktionen WHERE post_id = ANY(${ids})` as any,
    lauf`
      SELECT k.id, k.post_id, k.agent_id, k.text, k.created_at, k.antwort_auf, k.bearbeitet_am,
             COALESCE(NULLIF(a.first_name, ''), a.name) AS name, a.avatar AS avatar_url
      FROM fiaon_post_kommentare k
      LEFT JOIN fiaon_agents a ON a.id = k.agent_id
      WHERE k.post_id = ANY(${ids}) AND k.geloescht_at IS NULL
      ORDER BY k.created_at ASC
    ` as any,
  ]);

  return posts.map((p) => {
    const eigene = (reaktionen as any[]).filter((r) => Number(r.post_id) === Number(p.id));
    const zaehler: Record<string, number> = {};
    for (const r of eigene) zaehler[r.art] = (zaehler[r.art] || 0) + 1;
    return {
      id: Number(p.id),
      autorAgentId: p.autor_agent_id ? Number(p.autor_agent_id) : null,
      autorTyp: String(p.autor_typ),
      autorName: p.autor_typ === "system" ? "FIAON" : (p.autor_name || null),
      autorAvatar: p.avatar_url || null,
      text: String(p.text),
      angepinnt: !!p.angepinnt,
      autoArt: p.auto_art || null,
      am: p.created_at,
      // Der Akten-Chip: NUR die Referenz, kein Name, kein Betrag. Wer klickt
      // und nicht berechtigt ist, bekommt eine freundliche 404 — die Prüfung
      // sitzt in der Akte, nicht hier.
      akteRef: p.akte_ref || null,
      aktePerson: p.akte_person ? Number(p.akte_person) : null,
      // Nur ob ein Bild da ist. Die Bytes holt der Browser einzeln ab, sonst
      // trüge jede Feed-Antwort ein paar Megabyte mit sich.
      hatBild: !!p.hat_bild,
      bearbeitet: !!p.bearbeitet_am,
      // Der Autor darf löschen, und binnen 15 Minuten bearbeiten. Danach
      // nicht mehr: Wer einen Beitrag gelesen und darauf reagiert hat, soll
      // sich darauf verlassen können, dass er noch dasselbe sagt.
      meiner: p.autor_agent_id != null && Number(p.autor_agent_id) === agentId,
      bearbeitbarBis: p.autor_agent_id != null && Number(p.autor_agent_id) === agentId
        ? new Date(new Date(p.created_at).getTime() + 15 * 60_000).toISOString()
        : null,
      reaktionen: zaehler,
      meine: eigene.find((r) => Number(r.agent_id) === agentId)?.art ?? null,
      kommentare: (kommentare as any[])
        .filter((k) => Number(k.post_id) === Number(p.id))
        .map((k) => ({
          id: Number(k.id), agentId: Number(k.agent_id),
          name: k.name || "Teammitglied", avatar: k.avatar_url || null,
          text: String(k.text), am: k.created_at,
          antwortAuf: k.antwort_auf ? Number(k.antwort_auf) : null,
          bearbeitet: !!k.bearbeitet_am,
          // Darf ich diesen Kommentar löschen? Der Autor immer.
          meiner: Number(k.agent_id) === agentId,
        })),
    };
  });
}

/** Wie viele Beiträge seit dem letzten Besuch? Grundlage der Ungelesen-Marke. */
export async function ungelesen(agentId: number, lauf: Lauf = sqlPool): Promise<number> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_posts p
    WHERE p.geloescht_at IS NULL
      AND p.created_at > COALESCE(
        (SELECT space_gesehen_am FROM fiaon_agents WHERE id = ${agentId}),
        NOW() - INTERVAL '14 days')
      AND COALESCE(p.autor_agent_id, -1) <> ${agentId}
  `) as any[];
  return Number(z?.n || 0);
}

// ───────────────────────────────────────────────────────────────────────────
// Auto-Posts
// ───────────────────────────────────────────────────────────────────────────

/**
 * Legt einen automatischen Post an — genau einmal je Art und Schlüssel.
 *
 * Die Eindeutigkeit erzwingt der Index in der Datenbank (Migration 042), nicht
 * eine Prüfung davor: Zwei Prozesse, die gleichzeitig hochfahren, kommen beide
 * durch jede Vorabprüfung. `ON CONFLICT DO NOTHING` macht den zweiten Versuch
 * zu einem stillen Nichts statt zu einem Fehler.
 *
 * @returns true, wenn wirklich ein Post entstanden ist.
 */
export async function autoPost(
  art: string, schluessel: string, text: string, lauf: Lauf = sqlPool,
): Promise<boolean> {
  const rows = (await lauf`
    INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text, auto_art, auto_schluessel)
    VALUES (NULL, 'system', ${text}, ${art}, ${schluessel})
    ON CONFLICT (auto_art, auto_schluessel) WHERE auto_art IS NOT NULL AND auto_schluessel IS NOT NULL
    DO NOTHING
    RETURNING id
  `) as any[];
  return rows.length > 0;
}

/** Der Gedanke des Tages. */
export async function postGedanke(datum = berlinToday(), lauf: Lauf = sqlPool): Promise<boolean> {
  const g = gedankeFuer(datum);
  return autoPost("gedanke", datum, `Gedanke des Tages\n\n${g.text}`, lauf);
}

/**
 * Feiertage weltweit über die freie Nager.Date-API.
 *
 * DACH zuerst und ausgeschrieben — das betrifft die Kollegen unmittelbar
 * (Banken zu, niemand geht ans Telefon). Der Rest der Welt als eine Zeile,
 * weil es interessant, aber nicht wichtig ist.
 *
 * SCHEITERT DIE API, FÄLLT DER POST STUMM AUS. Ein Post „Feiertage konnten
 * nicht geladen werden" ist Müll im Feed und hilft niemandem.
 */
export async function postFeiertage(datum = berlinToday(), lauf: Lauf = sqlPool): Promise<boolean> {
  const DACH = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
  const jahr = datum.slice(0, 4);
  let welt: any[] = [];
  try {
    const res = await fetch(`https://date.nager.at/api/v3/NextPublicHolidaysWorldwide`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    welt = (await res.json()) as any[];
    if (!Array.isArray(welt)) return false;
  } catch {
    // Kein Netz, kein Post. Absichtlich still.
    return false;
  }

  const heute = welt.filter((h) => String(h?.date) === datum);
  const dach = heute.filter((h) => Object.keys(DACH).includes(String(h?.countryCode)));
  const rest = heute.filter((h) => !Object.keys(DACH).includes(String(h?.countryCode)));
  if (heute.length === 0) return false;

  const zeilen: string[] = ["Heute weltweit"];
  zeilen.push("");
  if (dach.length > 0) {
    for (const h of dach) {
      zeilen.push(`${DACH[h.countryCode as keyof typeof DACH]}: ${h.localName}${h.counties ? ` (regional)` : ""}`);
    }
    zeilen.push("");
    zeilen.push("Heißt: Dort geht heute kaum jemand ans Telefon.");
  } else {
    zeilen.push("In Deutschland, Österreich und der Schweiz ist heute ein normaler Arbeitstag.");
  }
  if (rest.length > 0) {
    const laender = Array.from(new Set(rest.map((h) => String(h.countryCode)))).sort();
    zeilen.push("");
    zeilen.push(`Außerdem Feiertag in: ${laender.join(", ")}.`);
  }
  return autoPost("feiertage", datum, zeilen.join("\n"), lauf);
}

/**
 * Drei Schlagzeilen aus dem tagesschau-RSS — nur hinter dem Flag SPACE_NEWS.
 *
 * Standardmäßig AUS. Nachrichten in einem Arbeitsraum sind eine Entscheidung
 * mit Nebenwirkungen: Sie ziehen Aufmerksamkeit und laden zu Diskussionen ein,
 * die nicht hierher gehören. Deshalb muss sie jemand bewusst einschalten.
 */
export async function postNews(datum = berlinToday(), lauf: Lauf = sqlPool): Promise<boolean> {
  if (String(process.env.SPACE_NEWS || "").toLowerCase() !== "an") return false;
  try {
    const res = await fetch("https://www.tagesschau.de/index~rss2.xml", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const xml = await res.text();
    const eintraege: { titel: string; link: string }[] = [];
    // Kein `for…of` über matchAll: `target` liegt unter ES2015 (AGENTS.md),
    // die Iteration wird dort nicht übersetzt.
    const bloecke: string[] = [];
    const muster = /<item>([\s\S]*?)<\/item>/g;
    let treffer: RegExpExecArray | null;
    while ((treffer = muster.exec(xml)) !== null) bloecke.push(treffer[1]);
    for (const block of bloecke) {
      const titel = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
      const link = block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1]?.trim();
      if (titel && link) eintraege.push({ titel, link });
      if (eintraege.length >= 3) break;
    }
    if (eintraege.length === 0) return false;
    const text = ["Drei Schlagzeilen", "", ...eintraege.map((e) => `${e.titel}\n${e.link}`)].join("\n");
    return autoPost("news", datum, text, lauf);
  } catch {
    return false;
  }
}

/**
 * Neue Einträge aus /agent/updates als Verweis in den Feed.
 *
 * Ausdrücklich ein VERWEIS und keine Kopie: Der Changelog bleibt die eine
 * Quelle für Produktneuigkeiten. Stünde der volle Text hier, gäbe es zwei
 * Fassungen derselben Ankündigung — und die zweite wäre irgendwann die alte.
 */
export async function postUpdateVerweis(
  updateId: string, titel: string, lauf: Lauf = sqlPool,
): Promise<boolean> {
  return autoPost(
    "update", updateId,
    `Neu in der Plattform\n\n${titel}\n\nWas sich genau geändert hat und wie du es bedienst, steht unter „Updates“.`,
    lauf,
  );
}

/**
 * Der Lauf des Space. STÜNDLICH, nicht täglich.
 *
 * Die Content-Engine verteilt zwanzig Beiträge über den Tag; ein Tageslauf um
 * Mitternacht würde sie alle auf einmal setzen. Der stündliche Aufruf legt
 * jeweils an, was bis jetzt fällig war — und holt eine ausgefallene Stunde
 * von selbst nach.
 */
export async function spaceTageslauf(datum = berlinToday()): Promise<{
  gedanke: boolean; feiertage: boolean; news: boolean; engine: number;
}> {
  // Der „Gedanke des Tages" bleibt als eigener Post: Er ist der einzige, der
  // eine Überschrift trägt und morgens ganz oben stehen soll.
  const gedanke = await postGedanke(datum).catch(() => false);
  const feiertage = await postFeiertage(datum).catch(() => false);
  const news = await postNews(datum).catch(() => false);

  const { engineLauf, postRangliste, postWoche, postMeilenstein, postRekord } =
    await import("./fiaon-space-engine");
  const lauf = await engineLauf().catch(() => ({ angelegt: 0 }));

  // Ereignis-Posts kommen ON TOP. Jeder ist über seinen Schlüssel idempotent,
  // also darf der Aufruf jede Stunde stehen bleiben.
  const jetzt = new Date();
  const stunde = Number(new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", hour12: false,
  }).format(jetzt));
  const wochentag = jetzt.getDay();

  if (stunde >= 18) await postRangliste(datum).catch(() => false);
  if (wochentag === 1 && stunde >= 6) await postWoche(datum).catch(() => false);
  await postMeilenstein().catch(() => false);
  await postRekord(datum).catch(() => false);

  if (gedanke || feiertage || news || lauf.angelegt) {
    console.log(`[SPACE] ${datum}: Gedanke ${gedanke}, Feiertage ${feiertage}, `
      + `News ${news}, Engine ${lauf.angelegt}`);
  }
  return { gedanke, feiertage, news, engine: lauf.angelegt };
}

/**
 * Die drei angepinnten Startposts. Idempotent über den Auto-Schlüssel, also
 * kann der Aufruf beim Hochfahren stehen bleiben.
 */
export async function spaceSeed(lauf: Lauf = sqlPool): Promise<number> {
  const posts: [string, string][] = [
    ["willkommen",
      "Willkommen im Space\n\n"
      + "Das hier ist unser gemeinsamer Raum — für alle im Team, egal ob Vertrieb, "
      + "Vertriebsleitung oder Onboarding.\n\n"
      + "Wir arbeiten verteilt und sehen uns selten alle am selben Tag. Der Space ist "
      + "der Ort, an dem trotzdem etwas steht: ein Erfolg, eine Frage, ein Hinweis, "
      + "der allen hilft. Kein Pflichtprogramm, keine Meldekette — schreib, wenn du "
      + "etwas zu sagen hast."],
    ["spielregeln",
      "Was hierher gehört — und was nicht\n\n"
      + "Hierher gehört: was gut lief und warum, ein Kniff aus einem Gespräch, eine "
      + "Frage an alle, ein Hinweis auf etwas, das nicht rundläuft.\n\n"
      + "Nicht hierher gehören KUNDENDATEN. Keine Namen, keine Rufnummern, keine "
      + "Beträge, keine Verwendungszwecke. Das ist keine Förmlichkeit: Den Space "
      + "sieht jede Rolle im Haus, auch die, die diesen einen Kunden nie betreuen "
      + "darf. Kundendaten gehören in die Akte — dort stehen sie richtig und sind "
      + "für die Zuständigen jederzeit da.\n\n"
      + "Beiträge mit Rufnummern, IBANs oder E-Mail-Adressen weist das System ab."],
    ["updates",
      "Produktneuigkeiten stehen unter „Updates“\n\n"
      + "Was sich an der Plattform ändert — neue Ansichten, neue Knöpfe, geänderte "
      + "Abläufe — findest du unter „Mehr“ → „Updates“, mit einer Anleitung Schritt "
      + "für Schritt.\n\n"
      + "Sobald es dort etwas Neues gibt, erscheint hier ein kurzer Verweis. Der "
      + "ausführliche Text bleibt drüben, damit es nicht zwei Fassungen davon gibt."],
  ];
  let neu = 0;
  for (const [schluessel, text] of posts) {
    const rows = (await lauf`
      INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text, angepinnt, auto_art, auto_schluessel)
      VALUES (NULL, 'system', ${text}, TRUE, 'seed', ${schluessel})
      ON CONFLICT (auto_art, auto_schluessel) WHERE auto_art IS NOT NULL AND auto_schluessel IS NOT NULL
      DO NOTHING
      RETURNING id
    `) as any[];
    if (rows.length > 0) neu++;
  }
  return neu;
}
