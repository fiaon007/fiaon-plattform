// ═══════════════════════════════════════════════════════════════════════════
// CONTENT-ENGINE — der Feed lebt von Tag eins
//
// ── DAS PROBLEM MIT LEEREN RÄUMEN ──────────────────────────────────────────
// Ein soziales Netzwerk, in dem drei angepinnte Regelposts stehen, ist kein
// Raum, sondern ein Aushang. Niemand schreibt als Erster in eine Leere — und
// wer zweimal nachsieht und nichts findet, sieht kein drittes Mal nach.
//
// ── ZWEI ARTEN VON BEITRÄGEN ───────────────────────────────────────────────
// EREIGNIS-POSTS entstehen aus echten Vorgängen: ein Abschluss, ein Rekord,
//   ein Neuzugang. Sie sind der eigentliche Grund, hier zu sein — und sie
//   enthalten NIEMALS Kundendaten, nur Vornamen des Teams und Zahlen.
// CONTENT-POSTS füllen die Lücken: Gedanke des Tages, Verkaufs-Impulse,
//   „Heute weltweit". Sie sind das Grundrauschen, vor dem ein Ereignis
//   auffällt.
//
// ── DIE DICHTE ─────────────────────────────────────────────────────────────
// Der Vorgesetzte stellt ein, wie viele Beiträge pro Tag erscheinen sollen
// (Vorgabe 20). Die Engine verteilt sie zwischen 07:00 und 19:00 und lässt
// zwischen zwei Beiträgen mindestens zwanzig Minuten. Zwanzig Beiträge um
// Mitternacht wären kein Feed, sondern ein Datenabzug.
//
// Ereignis-Posts kommen ON TOP: Sie entstehen, wenn sie entstehen.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { GEDANKEN, gedankeFuer } from "./fiaon-gedanken";
import { EINWAENDE } from "./fiaon-einwaende";

type Lauf = typeof sqlPool;

export const DICHTE_VORGABE = 20;
export const DICHTE_MIN = 5;
export const DICHTE_MAX = 100;

/** Das Fenster, in dem Content-Posts erscheinen. Nachts schläft der Feed. */
export const FENSTER_VON = 7;
export const FENSTER_BIS = 19;
/** Mindestabstand zwischen zwei Content-Posts. */
export const ABSTAND_MINUTEN = 20;

export async function dichte(lauf: Lauf = sqlPool): Promise<number> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'space_dichte'`) as any[];
  const n = Number(r?.value);
  if (!Number.isFinite(n)) return DICHTE_VORGABE;
  return Math.min(DICHTE_MAX, Math.max(DICHTE_MIN, Math.round(n)));
}

// ───────────────────────────────────────────────────────────────────────────
// Verkaufs-Impulse — aus den kuratierten Einwand-Bausteinen
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kurz-Tipps aus `fiaon-einwaende.ts`.
 *
 * Bewusst KEINE eigene Textsammlung: Die Antworten dort sind von Menschen
 * geschrieben und compliance-geprüft. Eine zweite Sammlung daneben wäre eine
 * zweite Sammlung, die jemand prüfen müsste — und niemand würde es tun.
 */
export function verkaufsImpuls(nr: number): { titel: string; text: string } {
  const e = EINWAENDE[((nr % EINWAENDE.length) + EINWAENDE.length) % EINWAENDE.length];
  return {
    titel: `Wenn der Kunde sagt: „${e.sagt}“`,
    text: `${e.antwort}\n\nDen ganzen Katalog findest du im Gesprächsblatt einer Kundenkarte — `
      + "dort schlägt das System dir die passenden Antworten zur Lage vor.",
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Der Bauplan eines Tages
// ───────────────────────────────────────────────────────────────────────────

export interface Beitrag {
  art: string;
  schluessel: string;
  text: string;
  /** Wann er erscheinen soll (ISO). */
  am: Date;
}

/**
 * Wie viele Minuten nach Tagesbeginn erscheint Beitrag Nummer i von n?
 *
 * Gleichmäßig über das Fenster, aber mit einem festen Versatz je Tag, damit
 * nicht jeden Tag um 07:00, 08:12, 09:24 dasselbe Muster läuft. Der Versatz
 * kommt aus dem Datum — dieselbe Eingabe ergibt dieselbe Ausgabe, sonst wäre
 * der Lauf nicht wiederholbar.
 */
function zeitpunkt(datum: string, i: number, n: number): Date {
  const basis = new Date(`${datum}T00:00:00Z`);
  const spanne = (FENSTER_BIS - FENSTER_VON) * 60;
  const schritt = Math.max(ABSTAND_MINUTEN, Math.floor(spanne / Math.max(1, n)));
  const versatz = (Date.parse(`${datum}T00:00:00Z`) / 86_400_000) % 17;
  const minuten = FENSTER_VON * 60 + Math.min(spanne - 5, i * schritt + versatz);
  basis.setUTCMinutes(minuten);
  return basis;
}

/**
 * Der Bauplan für einen Tag — was WÜRDE erscheinen.
 *
 * Getrennt vom Schreiben, damit sowohl der Tageslauf als auch das Seed-Skript
 * und der Prüfstand dieselbe Rechnung benutzen. Drei Fassungen wären drei
 * Gelegenheiten, unterschiedlich viele Beiträge zu erzeugen.
 */
export function tagesBauplan(datum: string, ziel: number): Beitrag[] {
  const tage = Math.floor(Date.parse(`${datum}T00:00:00Z`) / 86_400_000);
  const liste: Beitrag[] = [];

  // 1. Der Gedanke des Tages — immer der erste.
  const g = gedankeFuer(datum);
  liste.push({
    art: "gedanke", schluessel: `${datum}-${g.nr}`,
    text: g.text, am: new Date(`${datum}T00:00:00Z`),
  });

  // 2. Weitere Beiträge, bis das Ziel erreicht ist.
  const weitere = Math.max(0, ziel - 1);
  for (let i = 0; i < weitere; i++) {
    // Jeder fünfte ist ein Verkaufs-Impuls. Nicht jeder dritte: Es gibt nur
    // zehn kuratierte Einwand-Bausteine — bei sieben Impulsen am Tag käme
    // fast jeder täglich dran, und das Team überliest sie nach drei Tagen.
    if (i % 5 === 4) {
      const v = verkaufsImpuls(tage * 3 + Math.floor(i / 5));
      liste.push({
        art: "impuls", schluessel: `${datum}-i${i}`,
        text: `${v.titel}\n\n${v.text}`, am: new Date(),
      });
    } else {
      // SCHRITTWEITE 23, nicht 7: Bei zwanzig Beiträgen am Tag und Schritt 7
      // überlappten zwei aufeinanderfolgende Tage in zehn von achtzehn
      // Sätzen — das Team hätte gemerkt, dass sich alles wiederholt.
      // 23 ist prim und größer als jede sinnvolle Tagesmenge.
      const idx = ((tage * 23 + i + 1) % GEDANKEN.length + GEDANKEN.length) % GEDANKEN.length;
      const gg = GEDANKEN[idx];
      liste.push({
        art: "gedanke", schluessel: `${datum}-g${gg.nr}`,
        text: gg.text, am: new Date(),
      });
    }
  }

  // Zeitpunkte vergeben — der Gedanke des Tages zuerst.
  return liste.map((b, i) => ({ ...b, am: zeitpunkt(datum, i, liste.length) }));
}

// ───────────────────────────────────────────────────────────────────────────
// Schreiben
// ───────────────────────────────────────────────────────────────────────────

/**
 * Einen Beitrag anlegen — idempotent über `auto_schluessel`.
 *
 * `am` erlaubt Rückdatierung. Das braucht der Seed-Lauf: Ein Feed, dessen
 * ältester Beitrag von heute Morgen ist, sieht aus wie ein frisch
 * aufgesetztes System — und genau das soll er nicht.
 */
export async function beitragAnlegen(
  b: Beitrag, lauf: Lauf = sqlPool,
): Promise<boolean> {
  const rows = (await lauf`
    INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text, angepinnt, auto_art, auto_schluessel, created_at)
    VALUES (NULL, 'system', ${b.text}, FALSE, ${b.art}, ${b.schluessel}, ${b.am})
    ON CONFLICT (auto_art, auto_schluessel) WHERE auto_art IS NOT NULL AND auto_schluessel IS NOT NULL
    DO NOTHING
    RETURNING id
  `) as any[];
  return rows.length > 0;
}

/**
 * Der stündliche Lauf: Was ist bis jetzt fällig und fehlt noch?
 *
 * Prüft nicht „ist es genau 08:12", sondern „welche Beiträge dieses Tages
 * hätten schon erscheinen sollen". Ein ausgefallener Lauf holt damit von
 * selbst nach, statt eine Lücke zu hinterlassen.
 */
export async function engineLauf(
  jetzt = new Date(), lauf: Lauf = sqlPool,
): Promise<{ angelegt: number; faellig: number; ziel: number }> {
  const datum = berlinToday(jetzt);
  const ziel = await dichte(lauf);
  const plan = tagesBauplan(datum, ziel);
  const faellig = plan.filter((b) => b.am <= jetzt);

  let angelegt = 0;
  for (const b of faellig) {
    if (await beitragAnlegen(b, lauf)) angelegt++;
  }
  if (angelegt > 0) console.log(`[SPACE-ENGINE] ${angelegt} Beiträge angelegt (${datum}, Ziel ${ziel})`);
  return { angelegt, faellig: faellig.length, ziel };
}

// ───────────────────────────────────────────────────────────────────────────
// Ereignis-Posts
// ───────────────────────────────────────────────────────────────────────────

/**
 * „[Vorname] hat heute den N. Abschluss geholt."
 *
 * Wird aus der Provisionsbuchung gerufen. KEINE Kundendaten: nur der Vorname
 * des Kollegen und eine Zahl. Idempotent je Mensch und Tag und Zahl — ein
 * zweiter Aufruf für denselben Abschluss erzeugt nichts.
 */
export async function postAbschluss(
  agentId: number, lauf: Lauf = sqlPool,
): Promise<boolean> {
  const heute = berlinToday();
  const [a] = (await lauf`
    SELECT COALESCE(NULLIF(first_name, ''), name) AS vorname, is_test_account
    FROM fiaon_agents WHERE id = ${agentId}
  `) as any[];
  if (!a || a.is_test_account) return false;

  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_commissions
    WHERE agent_id = ${agentId} AND status <> 'storniert' AND kind <> 'stunden'
      AND created_at >= date_trunc('day', ${heute}::date)
  `) as any[];
  const n = Number(z.n);
  if (n < 1) return false;

  const text = n === 1
    ? `${a.vorname} hat den ersten Abschluss des Tages geholt.`
    : `${a.vorname} hat heute den ${n}. Abschluss geholt.`;
  return beitragAnlegen({
    art: "abschluss", schluessel: `${heute}-${agentId}-${n}`, text, am: new Date(),
  }, lauf);
}

/** Die Tages-Rangliste, 18:00. Nur Vornamen und Zahlen. */
export async function postRangliste(
  datum = berlinToday(), lauf: Lauf = sqlPool,
): Promise<boolean> {
  const zeilen = (await lauf`
    SELECT COALESCE(NULLIF(a.first_name, ''), a.name) AS vorname,
           COUNT(c.id)::int AS abschluesse
    FROM fiaon_agents a
    JOIN fiaon_commissions c ON c.agent_id = a.id
      AND c.status <> 'storniert' AND c.kind <> 'stunden'
      AND c.created_at >= date_trunc('day', ${datum}::date)
      AND c.created_at < date_trunc('day', ${datum}::date) + INTERVAL '1 day'
    WHERE a.active AND NOT a.is_test_account
    GROUP BY a.id, vorname
    HAVING COUNT(c.id) > 0
    ORDER BY abschluesse DESC, vorname
    LIMIT 5
  `) as any[];
  // Ein Tag ohne Abschluss bekommt KEINEN Post. „Heute niemand" ist keine
  // Nachricht, sondern ein Vorwurf.
  if (zeilen.length === 0) return false;

  const liste = zeilen
    .map((z, i) => `${i + 1}. ${z.vorname} — ${z.abschluesse} ${z.abschluesse === 1 ? "Abschluss" : "Abschlüsse"}`)
    .join("\n");
  const gesamt = zeilen.reduce((s, z) => s + Number(z.abschluesse), 0);
  return beitragAnlegen({
    art: "rangliste", schluessel: datum,
    text: `Der Tag in Zahlen\n\n${liste}\n\nZusammen ${gesamt} ${gesamt === 1 ? "Abschluss" : "Abschlüsse"}. Gute Arbeit.`,
    am: new Date(`${datum}T16:00:00Z`),
  }, lauf);
}

/** Der Wochenrückblick, Montag früh. */
export async function postWoche(
  datum = berlinToday(), lauf: Lauf = sqlPool,
): Promise<boolean> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS abschluesse,
           COALESCE(SUM(base_amount_cents), 0)::bigint AS umsatz,
           COUNT(DISTINCT agent_id)::int AS beteiligt
    FROM fiaon_commissions
    WHERE status <> 'storniert' AND kind <> 'stunden'
      AND created_at >= ${datum}::date - INTERVAL '7 days'
      AND created_at < ${datum}::date
  `) as any[];
  if (Number(z.abschluesse) === 0) return false;

  const [k] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_contact_log
    WHERE type <> 'system' AND created_at >= ${datum}::date - INTERVAL '7 days'
      AND created_at < ${datum}::date
  `) as any[];

  return beitragAnlegen({
    art: "woche", schluessel: datum,
    text: `Die Woche in Zahlen\n\n`
      + `${z.abschluesse} ${Number(z.abschluesse) === 1 ? "Abschluss" : "Abschlüsse"} `
      + `von ${z.beteiligt} ${Number(z.beteiligt) === 1 ? "Person" : "Personen"}\n`
      + `${(Number(z.umsatz) / 100).toFixed(2).replace(".", ",")} € Umsatz\n`
      + `${k.n} dokumentierte Kundenkontakte\n\n`
      + "Neue Woche, neue Liste. Fangt oben an.",
    am: new Date(`${datum}T05:30:00Z`),
  }, lauf);
}

/** Meilensteine: der 100., 250., 500. zahlende Kunde. */
export async function postMeilenstein(lauf: Lauf = sqlPool): Promise<boolean> {
  const [z] = (await lauf`
    SELECT COUNT(DISTINCT person_id)::int AS n FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND person_id IS NOT NULL
  `) as any[];
  const n = Number(z.n);
  // Nur runde Zahlen, und nur einmal je Zahl.
  const marken = [50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000];
  const erreicht = marken.filter((m) => n >= m).pop();
  if (!erreicht) return false;
  return beitragAnlegen({
    art: "meilenstein", schluessel: String(erreicht),
    text: `${erreicht} zahlende Kunden\n\nDiese Marke ist heute gefallen. `
      + "Jeder einzelne davon hat mit jemandem aus diesem Team gesprochen.",
    am: new Date(),
  }, lauf);
}

/** Rekordtag: mehr Abschlüsse als je zuvor. */
export async function postRekord(
  datum = berlinToday(), lauf: Lauf = sqlPool,
): Promise<boolean> {
  const [heute] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_commissions
    WHERE status <> 'storniert' AND kind <> 'stunden'
      AND created_at >= date_trunc('day', ${datum}::date)
      AND created_at < date_trunc('day', ${datum}::date) + INTERVAL '1 day'
  `) as any[];
  const [bester] = (await lauf`
    SELECT COALESCE(MAX(n), 0)::int AS n FROM (
      SELECT COUNT(*)::int AS n FROM fiaon_commissions
      WHERE status <> 'storniert' AND kind <> 'stunden'
        AND created_at < date_trunc('day', ${datum}::date)
      GROUP BY date_trunc('day', created_at)
    ) t
  `) as any[];
  if (Number(heute.n) < 3 || Number(heute.n) <= Number(bester.n)) return false;
  return beitragAnlegen({
    art: "rekord", schluessel: datum,
    text: `Rekordtag\n\n${heute.n} Abschlüsse — mehr als an jedem Tag zuvor `
      + `(bisher ${bester.n}). Das war das ganze Team.`,
    am: new Date(),
  }, lauf);
}
