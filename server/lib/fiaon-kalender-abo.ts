// ═══════════════════════════════════════════════════════════════════════════
// TERMINE IM EIGENEN KALENDER — ABO, EINZELTERMIN, KUNDENDATEI (29.09.2026, E-263)
//
// Justin: „wenn ich so ne Email bekomme von FIAON (Termin-Mail) dann muss ich
// die auch mit 1 Klick in mein Google oder Apple Kalender hinzufügen können …
// ‚Alle Termine zu Kalender hinzufügen' … pflegen sich automatisch ein … wenn
// ich nochmal drauf klicke und 1 neuer Termin ist hinzugekommen dann nur der 1
// Termin, nicht alle anderen doppelt."
//
// ── DREI WEGE, EINE DATEI (fiaon-ics.ts) ──────────────────────────────────
//   ABO          /kalender/<token>.ics — die Kalender-App holt selbst ab. Jeder
//                Termin trägt die feste UID termin-<id>@fiaon.com: neu kommt
//                dazu, verschoben wird geändert, abgesagt fällt heraus. Nichts
//                doppelt. „Eigene" = die Termine eines Mitarbeiters; „team" =
//                die Termine aller ANDEREN Mitarbeiter, NUR für den Chef — die
//                eigenen stehen im eigenen Abo (Gegenprüfung 29.09.2026: beide
//                abonniert, stand sonst jeder Gründer-Termin zweimal da).
//   EINZELTERMIN /kalender/t/<id>-<sig>.ics — der Knopf in der Termin-Mail.
//                Gilt, solange der Termin bei diesem Mitarbeiter liegt; ist er
//                abgesagt, liefert derselbe Link METHOD:CANCEL. Läuft das Abo,
//                zeigt die Mail diesen Knopf nicht (Abo ODER Knopf, nie beides).
//   KUNDE        /kalender/k/<storno-token>.ics — die Zeile in Bestätigung und
//                Erinnerung. Der Storno-Token ist das Geheimnis, das der Kunde
//                in derselben Mail ohnehin hält. Abgesagt → METHOD:CANCEL mit
//                derselben UID (auch die Zeile in der Absage-Mail und auf der
//                Absage-Seite zeigt dorthin).
//
// ── WER EIN ABO HABEN DARF (Gegenprüfung 29.09.2026) ──────────────────────
// Ein Abo darf nie mehr zeigen, als der Inhaber im Portal sehen dürfte.
// kontoDarfAbo ist die EINE Regel — geprüft bei JEDEM Abruf (aboPruefen), beim
// Anlegen (aboHolen) und bei jedem Einzel-Link (einzelIcs):
//   eigene  nicht gesperrt UND (aktiv ODER Stufe „inhaber" — der Inhaber kommt
//           auch mit deaktiviertem Konto ins Chefbüro und sieht dort alles)
//   team    nicht gesperrt UND Stufe „inhaber"
// Dazu widerruft ein Trigger an fiaon_agents (Migration 085) jedes Abo, sobald
// eine Sperre, Deaktivierung oder der Entzug der Stufe es unzulässig macht —
// ein späteres Entsperren belebt den alten Link nicht wieder.
//
// ── WAS IM KALENDER STEHT (Datensparsamkeit) ──────────────────────────────
// Name, Uhrzeit, Art, Weg und der Link zur Akte. NIE Telefonnummer, Notiz,
// Beträge oder Bestellnummer: Angerufen wird über das FIAON-Telefon in der
// Akte (E-216 — halbe Gespräche liefen übers Privathandy), und Notizen tragen
// die Finanzlage. Im Google-Einzellink (landet in Googles Protokollen und im
// Browserverlauf) steht nicht einmal der Name — nur Art und Nummer:
// „FIAON · Rückruf · Kunde #ID" (Global: „Firma #ID").
//
// ── DER TOKEN ─────────────────────────────────────────────────────────────
// token = base64url(HMAC-SHA256(SESSION_SECRET, „kalender-abo.<id>.<zufall>"))
// — 43 Zeichen, 256 Bit. In der Tabelle steht nur sha256(token). Geprüft wird
// über den Hash (Index-Treffer) UND danach mit timingSafeEqual gegen die neu
// berechnete Ableitung. Wechselt SESSION_SECRET, passt die Ableitung nicht
// mehr zum Hash: aboHolen widerruft die alte Zeile und legt eine neue an —
// die nächste Mail trägt dann den neuen Link (Selbstheilung).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { icsKalender, googleKalenderLink, type IcsEreignis } from "./fiaon-ics";
import { echteMitarbeiterSql } from "./fiaon-mitarbeiter-sicht";
import { HERKUENFTE } from "./fiaon-termine";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";
import { maraMarke } from "../../shared/fiaon-mara-marke";
import {
  kalenderClientAus, KALENDER_ABO_AKTIV_STUNDEN,
  type KalenderAboUmfang, type KalenderAboLinks, type KalenderAboSicht, type KalenderClient,
} from "../../shared/fiaon-kalender-abo";

type Lauf = typeof sqlPool;

/** Das Fenster eines Abos: ein Monat Rückblick, zwei Monate voraus. */
export const ABO_TAGE_ZURUECK = 30;
export const ABO_TAGE_VORAUS = 60;
/**
 * Höchstens so viele Termine je Abo. GEMESSEN 29.09.2026 (Produktion, nur lesend): Team-Abo −30…+60 Tage
 * = 448 Termine, der Stärkste allein (Florentine) 140 — der Bauplan nannte 500 bei „169 für −14 Tage".
 * Deshalb 800, und wenn es doch mehr werden, fallen die ÄLTESTEN heraus, nie die kommenden.
 */
export const ABO_HOECHSTENS = 800;
/** Standarddauer, wenn ein Termin keine trägt (wie überall im Haus). */
const DAUER_VORGABE = 20;
const ORT = "Telefon (FIAON)";

function geheim(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-kalender-secret";
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/** Nur die letzten sechs Zeichen — ein Token gehört nie ganz in ein Log. */
export const tokenKurz = (t: string) => `…${String(t).slice(-6)}`;

/** Die Form eines Abo-Tokens: 43 Zeichen base64url. Alles andere ist „unbekannt", ohne Datenbank. */
export const ABO_TOKEN_FORM = /^[A-Za-z0-9_-]{43}$/;

export interface AboZeile {
  id: number;
  agent_id: number;
  umfang: KalenderAboUmfang;
  zufall: string;
  token_hash: string;
  erstellt_am: Date;
  widerrufen_am: Date | null;
  zuletzt_abgerufen_am: Date | null;
  abrufe: number;
  letzter_client: string | null;
}

/** Der Stand des Mitarbeiterkontos, soweit er über ein Abo entscheidet. null = Konto gibt es nicht (mehr). */
export interface KontoStand { aktiv: boolean; gesperrt: boolean; stufe: string | null }

/** DIE Regel (siehe oben): Darf dieses Konto ein Abo dieses Umfangs haben? */
export function kontoDarfAbo(umfang: KalenderAboUmfang, k: KontoStand | null | undefined): boolean {
  if (!k || k.gesperrt) return false;
  const inhaber = String(k.stufe ?? "").trim() === "inhaber";
  return umfang === "team" ? inhaber : (k.aktiv || inhaber);
}

function kontoAus(r: any): KontoStand | null {
  if (!r || r.ag_da == null) return null;
  return { aktiv: r.ag_aktiv === true, gesperrt: r.ag_gesperrt === true, stufe: r.ag_stufe ?? null };
}

async function kontoLesen(agentId: number, lauf: Lauf): Promise<KontoStand | null> {
  const [r] = (await lauf`
    SELECT TRUE AS ag_da, COALESCE(active, FALSE) AS ag_aktiv, (zugang_gesperrt_am IS NOT NULL) AS ag_gesperrt, admin_stufe AS ag_stufe
      FROM fiaon_agents WHERE id = ${agentId} LIMIT 1`) as any[];
  return kontoAus(r);
}

/** Den Token aus Kennung und Zufall ableiten — für jede Mail neu, er steht nirgends. */
export function aboTokenAus(id: number | string, zufall: string): string {
  return createHmac("sha256", geheim()).update(`kalender-abo.${id}.${zufall}`).digest("base64url");
}
export function aboToken(z: Pick<AboZeile, "id" | "zufall">): string {
  return aboTokenAus(z.id, z.zufall);
}

function zeile(r: any): AboZeile {
  return {
    id: Number(r.id), agent_id: Number(r.agent_id), umfang: r.umfang === "team" ? "team" : "eigene",
    zufall: String(r.zufall), token_hash: String(r.token_hash), erstellt_am: new Date(r.erstellt_am),
    widerrufen_am: r.widerrufen_am ? new Date(r.widerrufen_am) : null,
    zuletzt_abgerufen_am: r.zuletzt_abgerufen_am ? new Date(r.zuletzt_abgerufen_am) : null,
    abrufe: Number(r.abrufe ?? 0), letzter_client: r.letzter_client ?? null,
  };
}

/** Gibt es die Tabelle schon? (Vor der Migration 085: nein — dann „Abo noch nicht eingerichtet".) */
export async function aboTabelleDa(lauf: Lauf = sqlPool): Promise<boolean> {
  const [r] = (await lauf`SELECT to_regclass('public.fiaon_kalender_abo') IS NOT NULL AS da`) as any[];
  return !!r?.da;
}

/**
 * Das aktive Abo eines Mitarbeiters (je Umfang höchstens eins) — legt es an,
 * wenn es fehlt. Idempotent: Ein Doppelklick auf „Abo" ergibt dieselbe Zeile
 * und denselben Token (die Wand ist der Teilindex fiaon_kalender_abo_aktiv).
 */
export async function aboHolen(agentId: number, umfang: KalenderAboUmfang, von: string | null, lauf: Lauf = sqlPool): Promise<AboZeile | null> {
  if (!Number.isInteger(agentId) || agentId <= 0) return null;
  if (!(await aboTabelleDa(lauf))) return null;
  // Gesperrt, deaktiviert, keine Inhaber-Stufe (Team): kein Abo — auch keins aus einer Termin-Mail.
  if (!kontoDarfAbo(umfang, await kontoLesen(agentId, lauf))) return null;
  for (let versuch = 0; versuch < 3; versuch++) {
    const [r] = (await lauf`
      SELECT * FROM fiaon_kalender_abo
       WHERE agent_id = ${agentId} AND umfang = ${umfang} AND widerrufen_am IS NULL
       LIMIT 1`) as any[];
    if (r) {
      const z = zeile(r);
      if (sha256(aboToken(z)) === z.token_hash) return z;
      // Das Geheimnis hat gewechselt — der alte Link ist ohnehin tot. Neue Zeile.
      await lauf`
        UPDATE fiaon_kalender_abo SET widerrufen_am = NOW(), widerrufen_von = 'System (Geheimnis gewechselt)'
         WHERE id = ${z.id} AND widerrufen_am IS NULL`;
      zwischenspeicherVergessen(z.id);
      continue;
    }
    const [n] = (await lauf`SELECT nextval(pg_get_serial_sequence('fiaon_kalender_abo', 'id')) AS id`) as any[];
    const id = Number(n.id);
    const zufall = randomBytes(16).toString("hex");
    const [neu] = (await lauf`
      INSERT INTO fiaon_kalender_abo (id, agent_id, umfang, zufall, token_hash, erstellt_von)
      VALUES (${id}, ${agentId}, ${umfang}, ${zufall}, ${sha256(aboTokenAus(id, zufall))}, ${von ? String(von).slice(0, 120) : null})
      ON CONFLICT (agent_id, umfang) WHERE widerrufen_am IS NULL DO NOTHING
      RETURNING *`) as any[];
    if (neu) return zeile(neu);
    // Jemand war schneller (zweiter Klick, zweite Mail) — seine Zeile gilt.
  }
  return null;
}

/**
 * Ein vorgelegter Token → das aktive Abo, sonst null. Wirft nie über die Form.
 * Prüft bei JEDEM Abruf auch das Konto (kontoDarfAbo): Ein gesperrter oder
 * deaktivierter Mitarbeiter kommt nicht mehr ins Portal — sein Abo darf ihm
 * die Namen und Zeiten nicht weiter liefern.
 */
export async function aboPruefen(token: string, lauf: Lauf = sqlPool): Promise<AboZeile | null> {
  const t = String(token ?? "");
  if (!ABO_TOKEN_FORM.test(t)) return null;
  if (!(await aboTabelleDa(lauf))) return null;
  const [r] = (await lauf`
    SELECT k.*, (ag.id IS NOT NULL) AS ag_da, COALESCE(ag.active, FALSE) AS ag_aktiv,
           (ag.zugang_gesperrt_am IS NOT NULL) AS ag_gesperrt, ag.admin_stufe AS ag_stufe
      FROM fiaon_kalender_abo k
      LEFT JOIN fiaon_agents ag ON ag.id = k.agent_id
     WHERE k.token_hash = ${sha256(t)} AND k.widerrufen_am IS NULL LIMIT 1`) as any[];
  if (!r) return null;
  const z = zeile(r);
  if (!kontoDarfAbo(z.umfang, r.ag_da ? kontoAus(r) : null)) return null;
  const soll = Buffer.from(aboToken(z));
  const ist = Buffer.from(t);
  if (soll.length !== ist.length || !timingSafeEqual(soll, ist)) return null;
  return z;
}

/** „Neuen Link erzeugen": die alte Zeile widerrufen (der alte Link hört sofort auf), eine neue anlegen. */
export async function aboErneuern(agentId: number, umfang: KalenderAboUmfang, von: string, lauf: Lauf = sqlPool): Promise<AboZeile | null> {
  if (!(await aboTabelleDa(lauf))) return null;
  const alt = (await lauf`
    UPDATE fiaon_kalender_abo SET widerrufen_am = NOW(), widerrufen_von = ${String(von).slice(0, 120)}
     WHERE agent_id = ${agentId} AND umfang = ${umfang} AND widerrufen_am IS NULL
     RETURNING id`) as any[];
  for (const a of alt) zwischenspeicherVergessen(Number(a.id));
  return aboHolen(agentId, umfang, von, lauf);
}

/** „Abo beenden": widerrufen, keine neue Zeile. true = es war eins aktiv. */
export async function aboBeenden(agentId: number, umfang: KalenderAboUmfang, von: string, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!(await aboTabelleDa(lauf))) return false;
  const alt = (await lauf`
    UPDATE fiaon_kalender_abo SET widerrufen_am = NOW(), widerrufen_von = ${String(von).slice(0, 120)}
     WHERE agent_id = ${agentId} AND umfang = ${umfang} AND widerrufen_am IS NULL
     RETURNING id`) as any[];
  for (const a of alt) zwischenspeicherVergessen(Number(a.id));
  return alt.length > 0;
}

/** Ein Abruf durch eine Kalender-App: Zeit, Zähler, Client-Klasse. Ein Browser zählt nicht. */
export async function aboAbruf(z: AboZeile, userAgent: string | null | undefined, lauf: Lauf = sqlPool): Promise<KalenderClient | null> {
  const client = kalenderClientAus(userAgent);
  if (!client) return null;
  await lauf`
    UPDATE fiaon_kalender_abo
       SET zuletzt_abgerufen_am = NOW(), abrufe = abrufe + 1, letzter_client = ${client}
     WHERE id = ${z.id}`;
  return client;
}

export function aboLinks(z: Pick<AboZeile, "id" | "zufall">): KalenderAboLinks {
  const token = aboToken(z);
  const ics = absoluteUrl(`/kalender/${token}.ics`);
  const webcal = ics.replace(/^https?:/, "webcal:");
  return {
    seite: absoluteUrl(`/kalender/${token}`),
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    ics,
  };
}

export function aboSicht(z: AboZeile, jetzt: Date = new Date()): KalenderAboSicht {
  const zuletzt = z.zuletzt_abgerufen_am;
  const client = (["apple", "google", "outlook", "andere"] as const).find((c) => c === z.letzter_client) ?? null;
  return {
    umfang: z.umfang,
    links: aboLinks(z),
    erstelltAm: z.erstellt_am.toISOString(),
    zuletztAbgerufenAm: zuletzt ? zuletzt.toISOString() : null,
    abrufe: z.abrufe,
    client,
    aktiv: !!zuletzt && jetzt.getTime() - zuletzt.getTime() <= KALENDER_ABO_AKTIV_STUNDEN * 3_600_000,
  };
}

/**
 * Holt eine Kalender-App das EIGENE Abo dieses Mitarbeiters gerade ab (letzte 48 Stunden)?
 * Nur „eigene": Das Team-Abo enthält die Termine seines Inhabers bewusst NICHT — wer nur das
 * Team abonniert hat, bekommt seine eigenen Termine nicht von selbst.
 */
export async function aboAktiv(agentId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!(await aboTabelleDa(lauf))) return false;
  const [r] = (await lauf`
    SELECT 1 AS da FROM fiaon_kalender_abo
     WHERE agent_id = ${agentId} AND umfang = 'eigene' AND widerrufen_am IS NULL
       AND zuletzt_abgerufen_am > NOW() - make_interval(hours => ${KALENDER_ABO_AKTIV_STUNDEN}::int)
     LIMIT 1`) as any[];
  return !!r;
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN TERMIN ALS KALENDEREINTRAG
// ═══════════════════════════════════════════════════════════════════════════

/** Die Spalten, die ein Kalendereintrag braucht — eine Liste für Abo und Einzeltermin. */
const TERMIN_SPALTEN = (lauf: Lauf) => lauf`
  t.id, t.person_id, t.agent_id, t.beginn, COALESCE(t.dauer_min, ${DAUER_VORGABE}) AS dauer, t.status, t.quelle,
  t.herkunft, t.created_at, t.abgesagt_am, COALESCE(t.kal_sequenz, 0) AS kal_sequenz,
  GREATEST(t.created_at, t.updated_at, COALESCE(t.kal_geaendert_am, t.created_at)) AS stand,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(p.company_name), ''),
           NULLIF(TRIM(p.contact_name), '')) AS name,
  NULLIF(TRIM(p.company_name), '') AS firma,
  COALESCE(NULLIF(ag.first_name, ''), split_part(ag.name, ' ', 1)) AS bei_vorname`;

interface TerminZeileKal {
  id: number; person_id: number; agent_id: number; beginn: Date; dauer: number; status: string; quelle: string;
  herkunft: string | null; created_at: Date; abgesagt_am: Date | null; kal_sequenz: number; stand: Date;
  name: string | null; firma: string | null; bei_vorname: string | null;
}

function terminZeile(r: any): TerminZeileKal {
  return {
    id: Number(r.id), person_id: Number(r.person_id), agent_id: Number(r.agent_id), beginn: new Date(r.beginn),
    dauer: Number(r.dauer) || DAUER_VORGABE, status: String(r.status), quelle: String(r.quelle ?? ""),
    herkunft: r.herkunft ? String(r.herkunft) : null, created_at: new Date(r.created_at),
    abgesagt_am: r.abgesagt_am ? new Date(r.abgesagt_am) : null, kal_sequenz: Number(r.kal_sequenz) || 0,
    stand: new Date(r.stand), name: r.name ? String(r.name) : null, firma: r.firma ? String(r.firma) : null,
    bei_vorname: r.bei_vorname ? String(r.bei_vorname) : null,
  };
}

/** Der Link zur Akte — Global ins Firmen-Cockpit, sonst die Kundenakte. */
export function akteLink(quelle: string, personId: number): string {
  return quelle === "global" ? absoluteUrl(`/agent/firmen?person=${personId}`) : absoluteUrl(`/agent/kunden?person=${personId}`);
}

const ende = (t: Pick<TerminZeileKal, "beginn" | "dauer">) => new Date(t.beginn.getTime() + t.dauer * 60_000);

/**
 * Ein Termin als VEVENT. Titel: „Rückruf: Max Mustermann", im Team-Abo mit
 * Mitarbeiter davor („Daniel · Rückruf: …"), Mara-Termine mit „(Mara)",
 * Vergangenes mit „Erledigt – …" / „Nicht zustande gekommen – …".
 */
export function terminEreignis(t: TerminZeileKal, opts: { team?: boolean } = {}): IcsEreignis {
  const art = terminArtAusQuelle(t.quelle);
  const mara = maraMarke(t.herkunft);
  const name = t.quelle === "global" ? (t.firma ?? t.name ?? `Firma #${t.person_id}`) : (t.name ?? `Kunde #${t.person_id}`);
  let titel = `${art.text}: ${name}${mara ? " (Mara)" : ""}`;
  if (opts.team && t.bei_vorname) titel = `${t.bei_vorname} · ${titel}`;
  if (t.status === "erledigt") titel = `Erledigt – ${titel}`;
  else if (t.status === "verpasst") titel = `Nicht zustande gekommen – ${titel}`;
  const weg = mara ? mara.titel
    : t.herkunft && t.herkunft !== "unbekannt" ? (HERKUENFTE as Record<string, string>)[t.herkunft] ?? null : null;
  const akte = akteLink(t.quelle, t.person_id);
  const beschreibung = [
    `${art.text}${t.bei_vorname ? ` bei ${t.bei_vorname}` : ""}`,
    weg ? `Weg: ${weg}` : null,
    t.status === "erledigt" ? "Stand: erledigt" : t.status === "verpasst" ? "Stand: nicht zustande gekommen" : null,
    "Anrufen über das FIAON-Telefon in der Akte (nicht vom Privathandy).",
    `Akte: ${akte}`,
  ].filter(Boolean).join("\n");
  return {
    uid: `termin-${t.id}@fiaon.com`,
    stempel: t.stand,
    geaendert: t.stand,
    erstellt: t.created_at,
    sequenz: t.kal_sequenz,
    beginn: t.beginn,
    ende: ende(t),
    titel,
    beschreibung,
    ort: ORT,
    url: akte,
    status: "CONFIRMED",
    alarme: t.status === "gebucht" ? [{ minutenVorher: 10, text: titel }] : [],
  };
}

/**
 * Google „Termin speichern" für einen Mitarbeiter — ohne Kundennamen (landet in Googles Protokollen),
 * aber mit der ART: „FIAON · Onboarding · Kunde #625", „FIAON · FIAON Global · Firma #608".
 */
export function googleTerminLink(t: { id?: number; person_id: number; quelle: string; beginn: Date | string; dauer?: number | null }): string {
  const beginn = new Date(t.beginn);
  const quelle = String(t.quelle ?? "");
  const akte = akteLink(quelle, t.person_id);
  return googleKalenderLink({
    text: `FIAON · ${terminArtAusQuelle(quelle).text} · ${quelle === "global" ? "Firma" : "Kunde"} #${t.person_id}`,
    beginn,
    ende: new Date(beginn.getTime() + (Number(t.dauer) || DAUER_VORGABE) * 60_000),
    details: `Akte: ${akte}`,
    ort: "Telefon",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS ABO (Feed)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kein „Last-Modified" (Gegenprüfung 29.09.2026): Das Maximum über die Zeilen, die NOCH
 * im Feed stehen, SINKT, wenn der jüngste Termin abgesagt wird — ein Client, der nur
 * If-Modified-Since schickt, bekam 304 und behielt den abgesagten Termin. Das
 * Inhalts-ETag allein entscheidet über 304.
 */
export interface AboFeed { ics: string; etag: string; anzahl: number }

/** Die Namen der beiden Abos — im Kalender, auf der Seite und im Prüfstand dieselben. */
export const ABO_NAMEN: Record<KalenderAboUmfang, string> = {
  eigene: "FIAON · meine Termine",
  team: "FIAON · Termine des Teams",
};

/**
 * Der Feed eines Abos. EINE Abfrage, höchstens 800 Termine (die jüngsten), −30 bis +60 Tage.
 * Nur gebucht/erledigt/verpasst — ABGESAGTE werden WEGGELASSEN: Ein Abo ist ein
 * Spiegel, und Weglassen heißt in jeder App „löschen". (STATUS:CANCELLED lassen
 * manche Apps durchgestrichen stehen.)
 * Team: jeder Termin bei einem echten Mitarbeiter OHNE die des Abo-Inhabers — die
 * stehen in seinem eigenen Abo. Zwei Abos, keine gemeinsame UID: Wer beide
 * abonniert, hat jeden Termin genau einmal (Gegenprüfung 29.09.2026).
 */
export async function aboFeed(z: AboZeile, lauf: Lauf = sqlPool): Promise<AboFeed> {
  const team = z.umfang === "team";
  const zeilen = ((await lauf`
    SELECT ${TERMIN_SPALTEN(lauf)}
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.beginn >= NOW() - make_interval(days => ${ABO_TAGE_ZURUECK}::int)
       AND t.beginn < NOW() + make_interval(days => ${ABO_TAGE_VORAUS}::int)
       AND t.status IN ('gebucht', 'erledigt', 'verpasst') AND t.abgesagt_am IS NULL
       AND ((NOT ${team}::boolean AND t.agent_id = ${z.agent_id})
            OR (${team}::boolean AND t.agent_id <> ${z.agent_id} AND ag.id IS NOT NULL AND ${lauf.unsafe(echteMitarbeiterSql("ag"))}))
     ORDER BY t.beginn DESC, t.id DESC
     LIMIT ${ABO_HOECHSTENS}`) as any[]).map(terminZeile).reverse();
  const ereignisse = zeilen.map((t) => terminEreignis(t, { team }));
  const ics = icsKalender({
    abo: team
      ? { name: ABO_NAMEN.team, beschreibung: "Die Termine der Mitarbeiter (deine eigenen stehen in „FIAON · meine Termine“) — hält sich selbst aktuell." }
      : { name: ABO_NAMEN.eigene, beschreibung: "Deine FIAON-Termine — hält sich selbst aktuell." },
    ereignisse,
  });
  return { ics, etag: `"${createHash("sha1").update(ics).digest("hex")}"`, anzahl: zeilen.length };
}

/**
 * Die Antwort für einen gültig GEFORMTEN, aber unbekannten, widerrufenen oder
 * gesperrten Abo-Link: ein LEERER Kalender (200), keine 404 (Gegenprüfung
 * 29.09.2026). Eine Kalender-App behält bei einem Abruffehler den letzten Stand
 * eingefroren — ein leerer Kalender leert sie wirklich. Für jeden solchen Link
 * dieselbe Datei: Sie verrät nicht, ob es ihn je gab. Abgerufen wird nur täglich.
 */
export function leererKalenderIcs(): string {
  return icsKalender({
    abo: {
      name: "FIAON · Link gilt nicht mehr",
      beschreibung: "Dieser Kalender-Link gilt nicht mehr. Den aktuellen gibt es im FIAON-Portal (Calendar → „In meinen Kalender“).",
      abruf: "P1D",
    },
    ereignisse: [],
  });
}

// Zwischenspeicher je Abo (60 s): Apple fragt je Gerät alle paar Minuten — die
// Datenbank muss dafür nicht jedes Mal rechnen. Erneuern/Beenden verwirft ihn.
const MERKEN_MS = 60_000;
const gemerkt = new Map<number, { am: number; feed: AboFeed }>();
export function zwischenspeicherVergessen(aboId?: number): void {
  if (aboId == null) gemerkt.clear(); else gemerkt.delete(aboId);
}
export async function aboFeedGemerkt(z: AboZeile, lauf: Lauf = sqlPool): Promise<AboFeed> {
  const m = gemerkt.get(z.id);
  if (m && Date.now() - m.am < MERKEN_MS) return m.feed;
  const feed = await aboFeed(z, lauf);
  gemerkt.set(z.id, { am: Date.now(), feed });
  if (gemerkt.size > 500) for (const [k, v] of Array.from(gemerkt)) if (Date.now() - v.am >= MERKEN_MS) gemerkt.delete(k);
  return feed;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER EINZELTERMIN (Knopf in der Mail an den Mitarbeiter)
// ═══════════════════════════════════════════════════════════════════════════

/** Signatur je Termin UND Mitarbeiter — nach einer Übergabe gilt der alte Link nicht mehr. */
export function einzelSignatur(terminId: number, agentId: number): string {
  return createHmac("sha256", geheim()).update(`kal-termin.${terminId}.${agentId}`).digest("hex").slice(0, 32);
}
export function einzelLink(terminId: number, agentId: number): string {
  return absoluteUrl(`/kalender/t/${terminId}-${einzelSignatur(terminId, agentId)}.ics`);
}

/**
 * Die Datei zu einem Einzel-Link. null = unbekannt, falsche Signatur oder der
 * Termin liegt nicht mehr bei diesem Mitarbeiter (Übergabe). Ist er abgesagt
 * (oder `absage`), kommt METHOD:CANCEL mit höherer SEQUENCE — Apple und
 * Outlook nehmen ihn damit aus dem Kalender; bei Google muss man von Hand löschen.
 */
export async function einzelIcs(datei: string, opts: { absage?: boolean } = {}, lauf: Lauf = sqlPool): Promise<{ ics: string; abgesagt: boolean } | null> {
  const m = /^(\d{1,10})-([0-9a-f]{32})(?:\.ics)?$/.exec(String(datei ?? ""));
  if (!m) return null;
  const id = Number(m[1]);
  const [r] = (await lauf`
    SELECT ${TERMIN_SPALTEN(lauf)}, (ag.id IS NOT NULL) AS ag_da, COALESCE(ag.active, FALSE) AS ag_aktiv,
           (ag.zugang_gesperrt_am IS NOT NULL) AS ag_gesperrt, ag.admin_stufe AS ag_stufe
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.id = ${id}
     LIMIT 1`) as any[];
  if (!r) return null;
  const t = terminZeile(r);
  const soll = Buffer.from(einzelSignatur(t.id, t.agent_id));
  const ist = Buffer.from(m[2]);
  if (soll.length !== ist.length || !timingSafeEqual(soll, ist)) return null;
  // Dieselbe Regel wie beim Abo: Ein gesperrtes oder deaktiviertes Konto bekommt keine Datei mehr.
  if (!kontoDarfAbo("eigene", kontoAus(r))) return null;
  const abgesagt = t.status === "abgesagt" || !!t.abgesagt_am || opts.absage === true;
  const e = terminEreignis(t);
  if (!abgesagt) return { ics: icsKalender({ ereignisse: [e] }), abgesagt: false };
  return {
    abgesagt: true,
    ics: icsKalender({
      methode: "CANCEL",
      ereignisse: [{
        ...e, status: "CANCELLED", sequenz: t.kal_sequenz + 1, alarme: [],
        titel: `Abgesagt – ${e.titel}`, veranstalter: { name: "FIAON", mail: "welcome@fiaon.com" },
      }],
    }),
  };
}

/** Die Felder für Mailwerk-Vorlagen an Mitarbeiter (Erinnerung, Übergabe): Einzeldatei + Google. */
export function mitarbeiterKalenderFelder(t: { id: number; agent_id: number; person_id: number; quelle: string; beginn: Date | string; dauer?: number | null }): Record<string, string> {
  return {
    kalender_ics_url: einzelLink(t.id, t.agent_id),
    google_kalender_url: googleTerminLink(t),
  };
}

/**
 * Wie oben — aber LEER, wenn das eigene Abo des Mitarbeiters läuft: Dann kommt der
 * Termin von selbst, und ein Klick auf die Zeile legte ihn ein zweites Mal an. Ohne
 * Felder lässt der Mail-Motor die Kalender-Zeile weg (ohne sie als Lücke zu zählen).
 */
export async function mitarbeiterKalenderFelderFuer(
  t: { id: number; agent_id: number; person_id: number; quelle: string; beginn: Date | string; dauer?: number | null },
  lauf: Lauf = sqlPool,
): Promise<Record<string, string>> {
  if (await aboAktiv(t.agent_id, lauf).catch(() => false)) return {};
  return mitarbeiterKalenderFelder(t);
}

// ═══════════════════════════════════════════════════════════════════════════
// DER KUNDE (Zeile in Bestätigung und Erinnerung, Scheibe C)
// ═══════════════════════════════════════════════════════════════════════════

const KUNDE_TITEL = "Gespräch mit FIAON — wir rufen Sie an";
const STORNO_FORM = /^[0-9a-f]{16,96}$/;

/** Die Nutzlast-Felder für termin_bestaetigung / termin_erinnerung: Datei + Google (ohne Daten im Link). */
export function kundenKalenderFelder(t: { stornoToken: string | null | undefined; beginn: Date | string; dauerMin?: number | null }): Record<string, string> {
  if (!t.stornoToken || !STORNO_FORM.test(String(t.stornoToken))) return {};
  const beginn = new Date(t.beginn);
  if (Number.isNaN(beginn.getTime())) return {};
  return {
    kalender_url: absoluteUrl(`/kalender/k/${t.stornoToken}.ics`),
    google_kalender_url: googleKalenderLink({
      text: KUNDE_TITEL,
      beginn,
      ende: new Date(beginn.getTime() + (Number(t.dauerMin) || DAUER_VORGABE) * 60_000),
      details: "Ihr Ansprechpartner bei FIAON ruft Sie zur vereinbarten Zeit an. Verschieben oder absagen: über den Link in Ihrer Bestätigungsmail.",
      ort: "Telefon",
    }),
  };
}

/**
 * Die Datei für den Kunden. 404 unbekannt. Ein Global-Gespräch bekommt seine eigene Datei.
 * ABGESAGT → METHOD:CANCEL mit derselben UID kunde-termin-<id>, höherer SEQUENCE und
 * ORGANIZER (Gegenprüfung 29.09.2026; vorher 410): Wer den Termin aus Bestätigung
 * oder Erinnerung übernommen hat, nimmt ihn damit wieder heraus — Apple und Outlook
 * löschen, bei Google von Hand. Derselbe Link steht in der Absage-Mail und auf der
 * Absage-Seite („Aus Ihrem Kalender entfernen").
 */
export async function kundenIcs(datei: string, lauf: Lauf = sqlPool): Promise<{ status: 200 | 404; ics?: string; dateiname?: string; abgesagt?: boolean }> {
  const token = String(datei ?? "").replace(/\.ics$/i, "");
  if (!STORNO_FORM.test(token)) return { status: 404 };
  const [r] = (await lauf`
    SELECT t.id, t.beginn, COALESCE(t.dauer_min, ${DAUER_VORGABE}) AS dauer, t.status, t.quelle, t.abgesagt_am, t.created_at,
           GREATEST(t.created_at, t.updated_at, COALESCE(t.kal_geaendert_am, t.created_at)) AS stand,
           COALESCE(t.kal_sequenz, 0) AS kal_sequenz
      FROM fiaon_termine t WHERE t.storno_token = ${token} LIMIT 1`) as any[];
  if (!r) return { status: 404 };
  if (String(r.quelle) === "global") {
    const { globalKalenderZuToken } = await import("./fiaon-global-termin");
    const g = await globalKalenderZuToken(token);
    if (!g) return { status: 404 };
    return { status: 200, ics: g.datei, abgesagt: g.abgesagt, dateiname: g.abgesagt ? "fiaon-global-absage.ics" : "fiaon-global-gespraech.ics" };
  }
  const abgesagt = String(r.status) === "abgesagt" || !!r.abgesagt_am;
  const { stornoLink } = await import("./fiaon-termine");
  const beginn = new Date(r.beginn);
  const e: IcsEreignis = {
    uid: `kunde-termin-${Number(r.id)}@fiaon.com`,
    stempel: new Date(r.stand), geaendert: new Date(r.stand), erstellt: new Date(r.created_at),
    sequenz: Number(r.kal_sequenz) || 0,
    beginn, ende: new Date(beginn.getTime() + (Number(r.dauer) || DAUER_VORGABE) * 60_000),
    titel: KUNDE_TITEL,
    beschreibung: [
      "Ihr Ansprechpartner bei FIAON ruft Sie zur vereinbarten Zeit an. Sie brauchen nichts vorzubereiten — halten Sie einfach Ihr Telefon bereit.",
      // ?anrede=sie: Die Absage-Seite duzt ohne den Zusatz — der Eintrag selbst siezt (Gegenprüfung 29.09.2026, wie E-236).
      `Verschieben oder absagen: ${stornoLink(token)}?anrede=sie`,
    ].join("\n"),
    ort: "Telefon",
    status: "CONFIRMED",
    alarme: [{ minutenVorher: 15, text: KUNDE_TITEL }],
  };
  if (!abgesagt) return { status: 200, ics: icsKalender({ ereignisse: [e] }), dateiname: "fiaon-termin.ics" };
  return {
    status: 200, abgesagt: true, dateiname: "fiaon-termin-absage.ics",
    ics: icsKalender({
      methode: "CANCEL",
      ereignisse: [{
        ...e, status: "CANCELLED", sequenz: (Number(r.kal_sequenz) || 0) + 1, alarme: [],
        titel: `Abgesagt – ${KUNDE_TITEL}`,
        beschreibung: "Dieser Termin wurde abgesagt. Einen neuen wählen Sie über den Link in der Mail.",
        veranstalter: { name: "FIAON", mail: "welcome@fiaon.com" },
      }],
    }),
  };
}

/**
 * Hat die Person einen FRÜHEREN Termin, der abgesagt oder verschoben wurde (letzte 14 Tage,
 * Zeit noch nicht vorbei)? Dann ein Satz für Bestätigung und Erinnerung: Ein Kunde, der den
 * alten Termin in seinen Kalender übernommen hat, bekommt bei Maras Verschieben keine Mail —
 * und der neue Termin hat eine neue Kennung. Leer, wenn es keinen gibt.
 */
export async function kalenderAltSatz(personId: number, terminId: number | null, lauf: Lauf = sqlPool): Promise<string> {
  if (!Number.isInteger(personId) || personId <= 0) return "";
  const [r] = (await lauf`
    SELECT beginn FROM fiaon_termine
     WHERE person_id = ${personId} AND id <> ${terminId ?? -1}
       AND abgesagt_am > NOW() - INTERVAL '14 days' AND beginn > NOW() - INTERVAL '1 hour'
     ORDER BY abgesagt_am DESC LIMIT 1`) as any[];
  if (!r) return "";
  const { berlinDatumText, berlinUhrzeit } = await import("./fiaon-termine");
  return `Ihr früherer Termin am ${berlinDatumText(r.beginn)} um ${berlinUhrzeit(r.beginn)} Uhr entfällt — steht er noch in Ihrem Kalender, löschen Sie ihn dort bitte.`;
}
