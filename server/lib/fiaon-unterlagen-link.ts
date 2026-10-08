// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN ANFORDERN UND ANNEHMEN — DER UPLOAD-LINK OHNE ANMELDUNG
// (E-IT-D, 08.10.2026, Punkt 4c des Team-Feedbacks)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Die Anforderung gab es (POST /dokumente/:personId/anfordern), aber nur in der
// Betreiber-Akte, ohne genauen Grund („Kontoauszüge der letzten drei Monate"
// statt „es fehlen August und September") und mit einer Hürde: Der Knopf der
// Mail führte auf /login bzw. „Passwort festlegen". Wer kein Passwort hatte,
// kam an den Upload nicht heran.
//
// ── DIE LÖSUNG ────────────────────────────────────────────────────────────
// · EIN Link je Person und Unterlagenart: signiert (HMAC, SESSION_SECRET), mit
//   der Id einer Zeile in fiaon_unterlagen_links — deshalb widerrufbar und
//   wiederholbar (dasselbe Token entsteht aus Id + Ablauf neu; gespeichert wird
//   es nirgends). 14 Tage gültig, mehrfach nutzbar, NUR für die angeforderten
//   Arten. Ein neuer Link für weitere Arten ersetzt den alten (Widerruf mit Grund).
// · EINE Anforderung (unterlagenAnfrageSenden) für die Mitarbeiter-Akte UND die
//   Betreiber-Akte: Zustandsregel (versandErlaubt), Drossel (3 je Tag, 15 Min.),
//   Mail über das bestehende Ereignis documents_change_request (Pflichtmail-Weg,
//   dieselbe 72-Stunden-Zählung wie der alte Knopf), WhatsApp nur im offenen
//   24-Stunden-Fenster über waSenden, Protokoll in fiaon_unterlagen_anfragen,
//   Verlauf in der Akte.
// · EINE Annahme (unterlageAnnehmen): dieselbe Ablage wie der Upload im
//   Kundenbereich und durch Mitarbeiter (Spalte der Paket-Bestellung, Archiv der
//   vorigen Fassung, Prüfung, Analyse). Neu: Ausweis und Kontoauszug werden
//   ANGEHÄNGT (alte + neue Datei zu einer PDF), nicht ersetzt — sonst löschte
//   der August den Juli (Punkt 3, „Hinzufügen statt Ersetzen").
//   ANSCHLUSS FÜR STRANG (3): Stellt der Upload im Kundenbereich auf eine
//   eigene Ablage je Datei um, ruft diese Funktion dieselbe Ablage auf — es
//   bleibt bei EINER Annahmefunktion für Link, Portal und Mitarbeiter.
// · Der Token steht nie im Klartext im Protokoll: Zugriffslog (server/index.ts)
//   und Mail-Protokoll (payloadSchwaerzen) verbergen /unterlagen/<token>.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import {
  LINK_GUELTIG_TAGE, LINK_ART_TEXT, LINK_UNTERLAGE_MAX_MB, anfrageDrossel, bitteSatz, uploadSatz, whatsappText, istLinkArt, type LinkArt,
} from "@shared/fiaon-unterlagen-anfrage";

type Lauf = typeof sqlPool;

// ───────────────────────────────────────────────────────────────────────────
// Tabellen (Migration 100 legt dieselben an — Reihenfolge gleichgültig)
// ───────────────────────────────────────────────────────────────────────────
let tabellenBereit: Promise<void> | null = null;
export function ensureUnterlagenLinkTabellen(): Promise<void> {
  if (!tabellenBereit) {
    tabellenBereit = (async () => {
      const [t] = (await sqlPool`SELECT to_regclass('fiaon_unterlagen_links') IS NOT NULL AS a, to_regclass('fiaon_unterlagen_anfragen') IS NOT NULL AS b,
                                       to_regclass('fiaon_unterlagen_sichtpruefung') IS NOT NULL AS c, to_regclass('fiaon_unterlagen_teile') IS NOT NULL AS d`) as any[];
      if (t?.a && t?.b && t?.c && t?.d) return;
      // E-254: Laufzeit-DDL nur auf NEUEN Tabellen und mit kurzer Sperrfrist.
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_unterlagen_links (
          id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, ref TEXT, arten TEXT[] NOT NULL, gueltig_bis TIMESTAMPTZ NOT NULL,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(), erstellt_von TEXT, erstellt_von_id BIGINT,
          nutzungen INTEGER NOT NULL DEFAULT 0, dateien INTEGER NOT NULL DEFAULT 0, letzte_nutzung TIMESTAMPTZ,
          widerrufen_am TIMESTAMPTZ, widerruf_grund TEXT)`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_unterlagen_links_person_idx ON fiaon_unterlagen_links (person_id, erstellt_am DESC)`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_unterlagen_anfragen (
          id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, link_id BIGINT, arten TEXT[] NOT NULL, quelle TEXT NOT NULL DEFAULT 'akte',
          mail_status TEXT, whatsapp_status TEXT, adresse TEXT, nummer TEXT, grund TEXT, von TEXT, von_id BIGINT,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_unterlagen_anfragen_person_idx ON fiaon_unterlagen_anfragen (person_id, am DESC)`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_unterlagen_sichtpruefung (
          id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, art TEXT NOT NULL DEFAULT 'ausweis', doc_hash TEXT NOT NULL,
          dokumenttyp TEXT NOT NULL CHECK (dokumenttyp IN ('reisepass', 'personalausweis', 'aufenthaltstitel_pass')),
          von TEXT, von_id BIGINT, am TIMESTAMPTZ NOT NULL DEFAULT NOW(), widerrufen_am TIMESTAMPTZ)`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_unterlagen_sichtpruefung_person_idx ON fiaon_unterlagen_sichtpruefung (person_id, am DESC)`;
        // Gegenprüfung 08.10.: welche hochgeladenen Dateien in der zusammengesetzten Datei stecken (Prüfwert je Teil).
        await tx`CREATE TABLE IF NOT EXISTS fiaon_unterlagen_teile (
          id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, art TEXT NOT NULL, ergebnis_hash TEXT NOT NULL, teile TEXT[] NOT NULL,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_unterlagen_teile_idx ON fiaon_unterlagen_teile (person_id, art, ergebnis_hash)`;
      });
    })().catch((e) => { tabellenBereit = null; throw e; });
  }
  return tabellenBereit;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Person und ihre zusammengeführten Dubletten (Nachprüfung 08.10.2026)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Der Kopf einer Person (über merged_into_person_id, mehrere Stufen) und alle Personen,
 * die in ihn zusammengeführt sind — Kopf zuerst. Die Zusammenführung hängt nur Bestellungen
 * und Leads um; Links, Anfragen, Sichtprüfungen, Fassungen und Beschaffungsaufträge bleiben an
 * der alten Person. Wer über diese Liste sucht, findet sie trotzdem. Ohne Treffer: [personId].
 */
export async function personFamilie(personId: number, lauf: Lauf = sqlPool): Promise<number[]> {
  if (!Number.isFinite(personId) || personId <= 0) return [personId];
  const [r] = (await lauf`
    WITH RECURSIVE hoch AS (
      SELECT id, merged_into_person_id, 0 AS tiefe FROM fiaon_persons WHERE id = ${personId}
      UNION ALL
      SELECT n.id, n.merged_into_person_id, h.tiefe + 1 FROM fiaon_persons n JOIN hoch h ON n.id = h.merged_into_person_id WHERE h.tiefe < 10
    ), kopf AS (SELECT id FROM hoch ORDER BY tiefe DESC LIMIT 1),
    runter AS (
      SELECT id, 0 AS tiefe FROM kopf
      UNION ALL
      SELECT n.id, r.tiefe + 1 FROM fiaon_persons n JOIN runter r ON n.merged_into_person_id = r.id WHERE r.tiefe < 10
    )
    SELECT (SELECT id FROM kopf) AS kopf, ARRAY(SELECT DISTINCT id FROM runter) AS alle`.catch(() => [] as any[])) as any[];
  if (!r?.kopf) return [personId];
  const kopf = Number(r.kopf);
  const rest = (Array.isArray(r.alle) ? r.alle : []).map(Number).filter((x: number) => x !== kopf);
  return [kopf, ...rest];
}

// ───────────────────────────────────────────────────────────────────────────
// Das Token
// ───────────────────────────────────────────────────────────────────────────

function geheimnis(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // Wie der Kauflink der Auskunft: ohne eigenes Geheimnis in Produktion AUS — ein
  // Rückfallwert, den jeder im Quelltext lesen kann, wäre kein Schutz.
  if (process.env.NODE_ENV === "production") throw new Error("Upload-Links sind ohne SESSION_SECRET abgeschaltet.");
  return "fiaon-dev-unterlagen-link";
}

const b64 = (b: Buffer) => b.toString("base64url");

function signatur(id: number, ablaufSek: number, arten: readonly string[]): string {
  return b64(createHmac("sha256", geheimnis()).update(`unterlagen.${id}.${ablaufSek}.${[...arten].sort().join(",")}`).digest()).slice(0, 32);
}

/** Das Token eines Links — entsteht aus Id, Ablauf und Arten immer gleich (so geht derselbe Link zweimal raus). */
export function linkToken(id: number, gueltigBis: Date, arten: readonly string[]): string {
  const ablauf = Math.floor(gueltigBis.getTime() / 1000);
  return `${id}.${ablauf}.${signatur(id, ablauf, arten)}`;
}

/** Zerlegt ein Token (ohne Datenbank). Gültigkeit von Ablauf und Widerruf prüft linkLesen. */
export function tokenZerlegen(token: string): { id: number; ablaufSek: number; sig: string } | null {
  const m = /^(\d{1,12})\.(\d{9,11})\.([A-Za-z0-9_-]{32})$/.exec(String(token ?? "").trim());
  if (!m) return null;
  return { id: Number(m[1]), ablaufSek: Number(m[2]), sig: m[3] };
}

export function linkUrl(token: string): string {
  return absoluteUrl(`/unterlagen/${token}`);
}

export interface LinkZeile {
  id: number; personId: number; ref: string | null; arten: LinkArt[]; gueltigBis: Date; widerrufenAm: Date | null;
  /** „ersetzt durch Link #…" (neuerer Link zugestellt) oder der Grund eines Widerrufs von Hand. */
  widerrufGrund: string | null;
  nutzungen: number; dateien: number; erstelltAm: Date;
}

function zeileAus(r: any): LinkZeile {
  return {
    id: Number(r.id), personId: Number(r.person_id), ref: r.ref ?? null,
    arten: (Array.isArray(r.arten) ? r.arten : []).filter(istLinkArt),
    gueltigBis: new Date(r.gueltig_bis), widerrufenAm: r.widerrufen_am ? new Date(r.widerrufen_am) : null,
    widerrufGrund: r.widerruf_grund ?? null,
    nutzungen: Number(r.nutzungen || 0), dateien: Number(r.dateien || 0), erstelltAm: new Date(r.erstellt_am),
  };
}

export type LinkPruefung =
  | { ok: true; link: LinkZeile }
  | { ok: false; grund: "ungueltig" | "abgelaufen" | "widerrufen"; link?: LinkZeile };

/** Prüft ein Token: Signatur, Ablauf, Widerruf. Die Signatur zuerst — ohne sie keine Datenbankabfrage. */
export async function linkLesen(token: string, lauf: Lauf = sqlPool): Promise<LinkPruefung> {
  const t = tokenZerlegen(token);
  if (!t) return { ok: false, grund: "ungueltig" };
  await ensureUnterlagenLinkTabellen();
  const [r] = (await lauf`SELECT * FROM fiaon_unterlagen_links WHERE id = ${t.id} LIMIT 1`) as any[];
  if (!r) return { ok: false, grund: "ungueltig" };
  const link = zeileAus(r);
  const erwartet = Buffer.from(signatur(link.id, Math.floor(link.gueltigBis.getTime() / 1000), link.arten));
  const echt = Buffer.from(t.sig);
  if (erwartet.length !== echt.length || !timingSafeEqual(erwartet, echt) || Math.floor(link.gueltigBis.getTime() / 1000) !== t.ablaufSek) {
    return { ok: false, grund: "ungueltig" };
  }
  if (link.widerrufenAm) return { ok: false, grund: "widerrufen", link };
  if (link.gueltigBis.getTime() < Date.now()) return { ok: false, grund: "abgelaufen", link };
  // Nachprüfung 08.10.: Wurde die Person inzwischen in eine andere zusammengeführt, gilt der Link für den Kopf —
  // sonst zeigte die Seite „Fehlt noch“ und der Upload endete mit „keine Bestellung“.
  const [kopf] = await personFamilie(link.personId, lauf);
  if (kopf && kopf !== link.personId) link.personId = kopf;
  return { ok: true, link };
}

/**
 * Der Link für eine Anforderung: Ein gültiger Link, der alle verlangten Arten
 * schon trägt, wird WIEDERVERWENDET (gleicher Link, gleiche Mail-Adresse — kein
 * zweiter Zugang). Sonst entsteht ein neuer mit allen Arten des alten und den
 * neuen. Die alten bleiben gültig, bis der neue ZUGESTELLT ist — dann ruft der
 * Aufrufer vorgaengerWiderrufen (Gegenprüfung 08.10.: scheiterte die Mail, war
 * sonst der Link aus der letzten Mail tot, ohne dass ein neuer ankam).
 */
export async function linkFuerAnfrage(
  personId: number, arten: LinkArt[], wer: { name: string; agentId: number | null }, lauf: Lauf = sqlPool,
): Promise<{ link: LinkZeile; token: string; url: string; neu: boolean }> {
  await ensureUnterlagenLinkTabellen();
  const aktive = ((await lauf`
    SELECT * FROM fiaon_unterlagen_links
     WHERE person_id = ${personId} AND widerrufen_am IS NULL AND gueltig_bis > NOW() + INTERVAL '1 day'
     ORDER BY erstellt_am DESC`) as any[]).map(zeileAus);
  const passt = aktive.find((l) => arten.every((a) => l.arten.includes(a)));
  if (passt) {
    const token = linkToken(passt.id, passt.gueltigBis, passt.arten);
    return { link: passt, token, url: linkUrl(token), neu: false };
  }
  const alle = Array.from(new Set<LinkArt>([...arten, ...aktive.flatMap((l) => l.arten)]));
  const [anker] = (await lauf`
    SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL
     ORDER BY (payment_status = 'paid') DESC, (COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%') DESC, created_at DESC LIMIT 1`) as any[];
  const gueltigBis = new Date(Date.now() + LINK_GUELTIG_TAGE * 86_400_000);
  gueltigBis.setMilliseconds(0);
  const [neu] = (await lauf`
    INSERT INTO fiaon_unterlagen_links (person_id, ref, arten, gueltig_bis, erstellt_von, erstellt_von_id)
    VALUES (${personId}, ${anker?.ref ?? null}, ${alle}, ${gueltigBis}, ${wer.name}, ${wer.agentId})
    RETURNING *`) as any[];
  const link = zeileAus(neu);
  const token = linkToken(link.id, link.gueltigBis, link.arten);
  return { link, token, url: linkUrl(token), neu: true };
}

/**
 * Nach erfolgreicher Zustellung eines Links: die älteren Links derselben Person,
 * deren Arten der zugestellte vollständig trägt, gelten nicht mehr. Nur ältere
 * (id kleiner) — ein gleichzeitig entstandener neuerer bleibt unberührt.
 */
export async function vorgaengerWiderrufen(personId: number, linkId: number, lauf: Lauf = sqlPool): Promise<number> {
  await ensureUnterlagenLinkTabellen();
  const r = (await lauf`
    UPDATE fiaon_unterlagen_links SET widerrufen_am = NOW(), widerruf_grund = ${`ersetzt durch Link #${linkId}`}
     WHERE person_id = ${personId} AND id < ${linkId} AND widerrufen_am IS NULL
       AND arten <@ (SELECT arten FROM fiaon_unterlagen_links WHERE id = ${linkId} AND person_id = ${personId})
     RETURNING id`) as any[];
  return r.length;
}

/** Widerruf von Hand (Akte): der Link gilt sofort nicht mehr. */
export async function linkWiderrufen(personId: number, grund: string, lauf: Lauf = sqlPool): Promise<number> {
  await ensureUnterlagenLinkTabellen();
  const familie = await personFamilie(personId, lauf);
  const r = (await lauf`
    UPDATE fiaon_unterlagen_links SET widerrufen_am = NOW(), widerruf_grund = ${grund.slice(0, 200)}
     WHERE person_id = ANY(${familie}) AND widerrufen_am IS NULL AND gueltig_bis > NOW() RETURNING id`) as any[];
  return r.length;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Lage je Art — für die Seite ohne Anmeldung (nie Inhalte, nur der Stand)
// ───────────────────────────────────────────────────────────────────────────

export type ArtStand = "liegt_vor" | "fehlt" | "wird_geprueft" | "bitte_neu";

export async function artenStand(personId: number, arten: readonly LinkArt[], lauf: Lauf = sqlPool): Promise<Record<string, { stand: ArtStand; satz: string }>> {
  const { dokumentStand } = await import("./fiaon-dokumente");
  const d = await dokumentStand({ personId, rolle: "kunde" }, lauf).catch(() => null);
  const aus: Record<string, { stand: ArtStand; satz: string }> = {};
  for (const art of arten) {
    const x = d?.dokumente.find((y) => y.art === art);
    if (!x?.vorhanden) { aus[art] = { stand: "fehlt", satz: "Fehlt noch." }; continue; }
    // Nachprüfung 08.10.: Hat die Verwaltung die Unterlage neu angefordert, ist sie nicht „Liegt vor“.
    if (x.erneutAngefordert) { aus[art] = { stand: "bitte_neu", satz: "Wir haben diese Unterlage neu angefordert — bitte laden Sie sie noch einmal hoch." }; continue; }
    if (x.pruefung) { aus[art] = { stand: "bitte_neu", satz: "Liegt vor, ist aber unvollständig oder nicht lesbar — bitte laden Sie die fehlenden Seiten hoch." }; continue; }
    aus[art] = { stand: "liegt_vor", satz: x.seit ? `Liegt vor (seit ${new Date(x.seit).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}). Weitere Seiten können Sie hinzufügen.` : "Liegt vor. Weitere Seiten können Sie hinzufügen." };
  }
  return aus;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Anforderung — EIN Weg für Mitarbeiter-Akte, Betreiber-Akte und den Kunden
// ───────────────────────────────────────────────────────────────────────────

/** Die Bitten je Art, wenn die Akte keinen genaueren Satz liefert (Sie-Form, ohne Frist). */
export const BITTE_STANDARD: Record<LinkArt, string> = {
  ausweis: "eine gut lesbare Kopie Ihres Ausweises: beim Personalausweis Vorder- und Rückseite, beim Reisepass die Seite mit Ihrem Foto und Ihren Daten",
  kontoauszug: "Ihre Kontoauszüge der letzten drei Monate vom Girokonto, auf dem Ihr Einkommen eingeht",
  schufa: "Ihre Bonitätsauskunft (alle Seiten)",
};

export interface AnfrageErgebnis {
  ok: boolean;
  status: "gesendet" | "abgelehnt" | "fehlgeschlagen";
  meldung: string;
  mail: { status: "gesendet" | "fehlgeschlagen" | "abgelehnt" | "keine_adresse" | "aus"; grund: string | null; adresse: string | null };
  whatsapp: { status: "gesendet" | "fenster_zu" | "keine_nummer" | "fehlgeschlagen" | "aus"; grund: string | null; nummer: string | null };
  gueltigBis: string | null;
  linkNeu: boolean;
  /** Nur für die Leitung im Prüfstand — nie an den Browser eines Mitarbeiters (Route gibt ihn nicht heraus). */
  _url?: string;
}

/**
 * Unterlagen beim Kunden anfordern: Mail mit Upload-Link (und WhatsApp im
 * offenen Fenster). `saetze` sind die genauen Bitten je Art aus den
 * Voraussetzungen der Auswertung („Ihre Kontoauszüge für August und September").
 */
export async function unterlagenAnfrageSenden(ein: {
  personId: number;
  arten: LinkArt[];
  kanaele: ("mail" | "whatsapp")[];
  saetze?: Partial<Record<LinkArt, string>>;
  akteur: { name: string; agentId: number | null; rolle: string };
  quelle: "akte" | "betreiber" | "kunde_neu";
  /** Ohne Drossel (nur der alte Betreiber-Knopf, der seine eigene 72-Stunden-Sperre hat). */
  ohneDrossel?: boolean;
  lauf?: Lauf;
}): Promise<AnfrageErgebnis> {
  const lauf = ein.lauf ?? sqlPool;
  await ensureUnterlagenLinkTabellen();
  const arten = ein.arten.filter(istLinkArt);
  const leerMail = { status: "aus" as const, grund: null, adresse: null };
  const leerWa = { status: "aus" as const, grund: null, nummer: null };
  const abgelehnt = (meldung: string): AnfrageErgebnis => ({ ok: false, status: "abgelehnt", meldung, mail: leerMail, whatsapp: leerWa, gueltigBis: null, linkNeu: false });
  if (!arten.length) return abgelehnt("Keine Unterlage gewählt.");

  // 1. Die Zustandsregel der Unterlagen-Mail gilt für beide Kanäle (gekündigt, Vertrag beendet, Test, Archiv, Kontaktsperre).
  const { versandErlaubt } = await import("./fiaon-versand");
  const regel = await versandErlaubt(ein.personId, "documents_change_request");
  if (!regel.erlaubt) return abgelehnt(regel.grund || "Nicht erlaubt.");

  // 2. Die Drossel: höchstens drei je Tag, mindestens 15 Minuten Abstand.
  if (!ein.ohneDrossel) {
    const zeilen = (await lauf`
      SELECT am, date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin' AS tag_beginn
        FROM fiaon_unterlagen_anfragen
       WHERE person_id = ${ein.personId} AND am > NOW() - INTERVAL '2 days'
         AND (mail_status = 'gesendet' OR whatsapp_status = 'gesendet')`) as any[];
    const [tb] = (await lauf`SELECT date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin' AS t`) as any[];
    const d = anfrageDrossel(zeilen.map((z) => new Date(z.am)), new Date(), new Date(tb.t));
    if (!d.erlaubt) return abgelehnt(d.grund!);
  }

  // 3. Der Link.
  let lk: Awaited<ReturnType<typeof linkFuerAnfrage>>;
  try {
    lk = await linkFuerAnfrage(ein.personId, arten, { name: ein.akteur.name, agentId: ein.akteur.agentId }, lauf);
  } catch (e) {
    return { ...abgelehnt(`Der Upload-Link ließ sich nicht anlegen: ${String((e as Error)?.message || e)}`), status: "fehlgeschlagen" };
  }
  const posten = arten.map((a) => String(ein.saetze?.[a] || BITTE_STANDARD[a]));
  const hinweis = bitteSatz(posten);

  // 4. Mail — das bestehende Ereignis der Unterlagen-Bitte (Pflichtmail-Weg, Zustandsregel, 72-h-Zählung).
  let mail: AnfrageErgebnis["mail"] = leerMail;
  if (ein.kanaele.includes("mail")) {
    const { empfaengerFuer } = await import("./fiaon-massgebliche-bestellung");
    const adresse = (await empfaengerFuer(ein.personId, null, lauf).catch(() => ({ adresse: null }))).adresse;
    if (!adresse) mail = { status: "keine_adresse", grund: "Keine E-Mail-Adresse hinterlegt.", adresse: null };
    else {
      const { mailSenden } = await import("./fiaon-mail-senden");
      const v = await mailSenden({
        event: "documents_change_request", personId: ein.personId,
        zusatz: {
          hinweis,
          angebot_text: "", widerspruch_text: "",
          knopf_text: "Jetzt hochladen (ohne Anmeldung)", knopf_url: lk.url,
          knopf2_text: "", knopf2_url: "",
          upload_satz: uploadSatz(lk.link.gueltigBis),
          unterlagen_arten: arten.join(","),
          auskunft_modus: "", auskunft_betrag: "",
        },
        akteur: { name: ein.akteur.name, agentId: ein.akteur.agentId, rolle: ein.akteur.rolle as any },
        lauf,
      }).catch((e: unknown) => ({ ok: false, status: "fehlgeschlagen", grund: String((e as Error)?.message || e), meldung: "" } as any));
      mail = (v as any).ok
        ? { status: "gesendet", grund: null, adresse }
        : { status: (v as any).status === "abgelehnt" ? "abgelehnt" : "fehlgeschlagen", grund: String((v as any).grund ?? (v as any).meldung ?? "unbekannt"), adresse };
    }
  }

  // 5. WhatsApp — nur Freitext im offenen 24-Stunden-Fenster (keine Vorlage für diese Bitte freigegeben).
  let whatsapp: AnfrageErgebnis["whatsapp"] = leerWa;
  if (ein.kanaele.includes("whatsapp")) {
    const [p] = (await lauf`SELECT primary_phone, first_name FROM fiaon_persons WHERE id = ${ein.personId} LIMIT 1`) as any[];
    const { nummerFuerWhatsApp } = await import("@shared/fiaon-whatsapp-erlaubnis");
    const nummer = nummerFuerWhatsApp(p?.primary_phone);
    if (!nummer) whatsapp = { status: "keine_nummer", grund: "Keine Nummer, über die WhatsApp läuft.", nummer: null };
    else {
      const wa = await import("./fiaon-whatsapp");
      const offen = await wa.fensterOffen(nummer, lauf).catch(() => false);
      if (!offen) whatsapp = { status: "fenster_zu", grund: "Das 24-Stunden-Fenster ist zu — WhatsApp nur, wenn der Kunde in den letzten 24 Stunden geschrieben hat.", nummer };
      else {
        const vorname = String(p?.first_name ?? "").trim() || null;
        const erg = await wa.waSenden(nummer, { text: whatsappText(vorname, posten, lk.url) }, { personId: ein.personId, von: ein.akteur.name }, lauf)
          .catch((e: unknown) => ({ ok: false, grund: String((e as Error)?.message || e) }));
        whatsapp = erg.ok ? { status: "gesendet", grund: null, nummer } : { status: "fehlgeschlagen", grund: erg.grund ?? "unbekannt", nummer };
      }
    }
  }

  // 6. Protokoll und Verlauf — wer, wann, an welche Adresse, mit welchem Ergebnis.
  await lauf`
    INSERT INTO fiaon_unterlagen_anfragen (person_id, link_id, arten, quelle, mail_status, whatsapp_status, adresse, nummer, grund, von, von_id)
    VALUES (${ein.personId}, ${lk.link.id}, ${arten}, ${ein.quelle}, ${mail.status}, ${whatsapp.status}, ${mail.adresse}, ${whatsapp.nummer},
            ${[mail.grund, whatsapp.grund].filter(Boolean).join(" · ") || null}, ${ein.akteur.name}, ${ein.akteur.agentId})`;
  const artenText = arten.map((a) => LINK_ART_TEXT[a].titel).join(", ");
  const kanalText = [
    ein.kanaele.includes("mail") ? `Mail ${mail.status === "gesendet" ? `an ${mail.adresse}` : `NICHT gesendet (${mail.grund})`}` : null,
    ein.kanaele.includes("whatsapp") ? `WhatsApp ${whatsapp.status === "gesendet" ? `an ${whatsapp.nummer}` : `nicht gesendet (${whatsapp.grund})`}` : null,
  ].filter(Boolean).join(" · ");
  const bis = lk.link.gueltigBis.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${lk.link.ref}, ${ein.personId}, ${ein.akteur.agentId}, ${ein.akteur.name}, 'system',
            ${`Unterlagen angefordert (${artenText}) mit Upload-Link ohne Anmeldung (Link #${lk.link.id}, gültig bis ${bis}${lk.neu ? "" : ", derselbe Link wie zuvor"}): ${kanalText}.`})`
    .catch((e: unknown) => console.error("[UNTERLAGEN-LINK] Verlauf:", String((e as Error)?.message || e).slice(0, 160)));

  const gesendet = mail.status === "gesendet" || whatsapp.status === "gesendet";
  // Erst jetzt, da der Link beim Kunden ist, gelten die älteren nicht mehr.
  if (gesendet) {
    await vorgaengerWiderrufen(ein.personId, lk.link.id, lauf)
      .catch((e: unknown) => console.error("[UNTERLAGEN-LINK] Vorgänger:", String((e as Error)?.message || e).slice(0, 160)));
  }
  return {
    ok: gesendet, status: gesendet ? "gesendet" : "fehlgeschlagen",
    meldung: gesendet
      ? `Angefordert: ${artenText}. ${kanalText}. Der Link gilt bis ${bis}.`
      : `Nichts ging raus — ${kanalText || "kein Kanal gewählt"}.`,
    mail, whatsapp, gueltigBis: lk.link.gueltigBis.toISOString(), linkNeu: lk.neu,
    _url: lk.url,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Die Annahme der Dateien
// ───────────────────────────────────────────────────────────────────────────

export interface AnnahmeErgebnis {
  ok: boolean;
  /** Für den Kunden (Sie-Form). */
  meldung: string;
  /** Für die Akte. */
  intern: string;
  angehaengt: boolean;
}

const SPALTE: Record<LinkArt, string> = { ausweis: "id_card_pdf", kontoauszug: "bank_statement_pdf", schufa: "schufa_pdf" };
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/**
 * Ist die vorhandene Datei dieser Art das FALSCHE Dokument? (Nachprüfung 08.10.2026)
 * Ausweis nicht erkannt („kein Ausweisdokument“), Kontoauszug Nebenkonto oder unlesbar. Fehlende
 * Monate, eine fehlende Rückseite oder eine Neuanforderung der Verwaltung (Grund unbekannt) heißen
 * dagegen: ergänzen — dann wird angehängt.
 */
export async function altIstMangel(personId: number, art: "ausweis" | "kontoauszug", traeger: string | null, lauf: Lauf = sqlPool): Promise<boolean> {
  void personId; void lauf;
  if (!traeger) return false;
  try {
    if (art === "ausweis") {
      const { urteileLesen } = await import("./fiaon-dokument-pruefung");
      const u = (await urteileLesen([traeger]).catch(() => ({} as any))).ausweis;
      return u?.erkannt === false;
    }
    const { analyseFuer } = await import("./fiaon-kontoauszug-analyse");
    const a = await analyseFuer(traeger).catch(() => null);
    return !!a && (a.status === "unlesbar" || !!a.nebenkonto);
  } catch {
    return false;
  }
}

/**
 * Eine oder mehrere Dateien einer Art in die Akte legen — dieselbe Ablage wie
 * der Upload im Kundenbereich: Spalte der Paket-Bestellung, vorige Fassung ins
 * Archiv (unterlageSichern), Prüfung, Analyse. Ausweis und Kontoauszug werden
 * an die vorhandene Datei ANGEHÄNGT; eine Bonitätsauskunft ersetzt die alte.
 */
export async function unterlageAnnehmen(ein: {
  personId: number; art: LinkArt; dateien: { buffer: Buffer; name: string; mimetype: string }[];
  quelle: { art: "link"; linkId: number } | { art: "mitarbeiter"; name: string; agentId: number };
  lauf?: Lauf;
}): Promise<AnnahmeErgebnis> {
  const lauf = ein.lauf ?? sqlPool;
  await ensureUnterlagenLinkTabellen();
  const { dateiArt, zuEinerPdf, BindeFehler, bindeSatz } = await import("./fiaon-pdf-binden");
  const { istBild, istHeic, bildAlsPdf } = await import("./fiaon-bild-zu-pdf");
  const { unterlageSichern, dokumentTraeger } = await import("./fiaon-dokumente");
  const titel = LINK_ART_TEXT[ein.art].titel;
  const fehler = (meldung: string, intern = meldung): AnnahmeErgebnis => ({ ok: false, meldung, intern, angehaengt: false });
  if (!ein.dateien.length) return fehler("Es wurde keine Datei mitgeschickt.");

  // Jede Datei für sich: Foto → PDF; HEIC und Unbekanntes mit klarem Satz.
  // `hash` = Prüfwert der hochgeladenen Datei, wie sie kam (vor der Umwandlung in PDF).
  const teile: { buffer: Buffer; name: string; hash: string }[] = [];
  for (const d of ein.dateien) {
    const name = d.name || "Datei";
    if (istHeic(d.mimetype) || /\.(heic|heif)$/i.test(name)) {
      return fehler(`„${name}“ ist ein iPhone-Foto im HEIC-Format. Bitte stellen Sie in den Kamera-Einstellungen „Maximale Kompatibilität“ ein oder wählen Sie das Foto als JPG bzw. die Datei als PDF.`);
    }
    const artD = dateiArt(d.buffer);
    if (!artD) return fehler(`„${name}“: Bitte laden Sie PDF-, JPG- oder PNG-Dateien hoch.`);
    if (artD === "pdf") teile.push({ buffer: d.buffer, name, hash: sha(d.buffer) });
    else {
      try { teile.push({ buffer: await bildAlsPdf(d.buffer, name), name, hash: sha(d.buffer) }); }
      catch { return fehler(`„${name}“: Dieses Bild konnten wir nicht verarbeiten. Bitte versuchen Sie es mit einem anderen Foto oder laden Sie eine PDF-Datei hoch.`); }
    }
    void istBild;
  }

  // Die Bestellung, an der die Unterlagen hängen — dieselbe Reihenfolge wie Akte und Mitarbeiter-Upload.
  const [antrag] = (await lauf`
    SELECT ref FROM fiaon_applications
     WHERE person_id = ${ein.personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL
     ORDER BY (payment_status = 'paid') DESC, (COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%') DESC, created_at DESC LIMIT 1`) as any[];
  if (!antrag?.ref) return fehler("Zu Ihrer Person liegt keine Bestellung vor. Bitte wenden Sie sich an Ihre Ansprechperson.", "Keine Bestellung an der Person.");
  const ref = String(antrag.ref);
  const spalte = SPALTE[ein.art];

  // Hinzufügen statt Ersetzen (Punkt 3): die vorhandene Datei vorn, die neuen dahinter.
  let alt: Buffer | null = null;
  let altTraeger: string | null = null;
  if (ein.art !== "schufa") {
    altTraeger = await dokumentTraeger({ personId: ein.personId }, ein.art, lauf);
    if (altTraeger) {
      const [r] = (await lauf.unsafe(`SELECT ${spalte} AS d FROM fiaon_applications WHERE ref = $1 LIMIT 1`, [altTraeger])) as any[];
      alt = r?.d ? Buffer.from(r.d) : null;
    }
  }
  // Doppelt? (Gegenprüfung 08.10.) Nicht nur gegen die GANZE bisherige Datei — nach dem
  // ersten Anhängen ist sie zusammengesetzt. fiaon_unterlagen_teile kennt je Ergebnis die
  // Prüfwerte der Dateien darin; gilt nur, solange die Spalte genau dieses Ergebnis hält
  // (hat ein anderer Weg sie ersetzt, zählt nur die Datei selbst). Auch innerhalb einer
  // Sendung zählt jede Datei einmal (Teilfehler, zweiter Versuch mit derselben Auswahl).
  const altHash = alt ? sha(alt) : null;
  let altTeile: string[] = altHash ? [altHash] : [];
  if (altHash) {
    const [z] = (await lauf`
      SELECT teile FROM fiaon_unterlagen_teile WHERE person_id = ${ein.personId} AND art = ${ein.art} AND ergebnis_hash = ${altHash}
       ORDER BY id DESC LIMIT 1`.catch(() => [] as any[])) as any[];
    if (Array.isArray(z?.teile) && z.teile.length) altTeile = [altHash, ...z.teile.map(String)];
  }
  // ── ERSETZEN STATT ANHÄNGEN, WENN DIE VORHANDENE DATEI DAS FALSCHE DOKUMENT IST (Nachprüfung 08.10.) ──
  // Nebenkonto statt Gehaltskonto, „kein Ausweisdokument“ oder unlesbar:
  // Hinter die falsche Datei geklebt, läse die Analyse zwei Konten als eines, und der Mangel bliebe stehen.
  // Gilt nur für die Datei, die VOR dem Link da war — was schon über den Link kam, wird weiter ergänzt.
  // Die alte Fassung geht nie verloren (unterlageSichern legt sie ins Archiv der Akte).
  let ersetzen = false;
  if (alt && altHash && (ein.art === "ausweis" || ein.art === "kontoauszug")) {
    const [ueberLink] = (await lauf`
      SELECT 1 AS ja FROM fiaon_unterlagen_teile WHERE person_id = ${ein.personId} AND art = ${ein.art} AND ergebnis_hash = ${altHash} LIMIT 1`
      .catch(() => [] as any[])) as any[];
    if (!ueberLink) ersetzen = await altIstMangel(ein.personId, ein.art, altTraeger, lauf);
  }
  if (ersetzen) { alt = null; altTeile = []; }
  const bekannt = new Set<string>(altTeile);
  const neuOhneDoppel: typeof teile = [];
  for (const t of teile) {
    const h2 = sha(t.buffer);
    if (bekannt.has(t.hash) || bekannt.has(h2)) continue;
    bekannt.add(t.hash); bekannt.add(h2);
    neuOhneDoppel.push(t);
  }
  if (!neuOhneDoppel.length) return { ok: true, meldung: `Diese Datei liegt uns schon vor — zu „${titel}“ ist nichts doppelt abgelegt.`, intern: `${titel}: dieselbe Datei erneut hochgeladen — nichts geändert.`, angehaengt: false };

  // Obergrenze je Unterlage: die Spalte wächst mit jedem Anhängen (Upload ohne Anmeldung).
  const neuBytes = neuOhneDoppel.reduce((n, t) => n + t.buffer.length, 0);
  if ((alt?.length ?? 0) + neuBytes > LINK_UNTERLAGE_MAX_MB * 1024 * 1024) {
    return fehler(`Zu „${titel}“ liegen schon sehr viele Seiten vor. Bitte laden Sie nur die Seiten hoch, die noch fehlen — bei Fragen hilft Ihnen Ihre Ansprechperson.`,
      `${titel}: Upload abgelehnt — zusammen über ${LINK_UNTERLAGE_MAX_MB} MB.`);
  }

  let pdf: Buffer;
  let angehaengt = false;
  let altDrin = false;
  let hinweisAlt = "";
  try {
    pdf = neuOhneDoppel.length === 1 && !alt ? neuOhneDoppel[0].buffer : await zuEinerPdf([...(alt ? [{ buffer: alt, name: `bisheriger ${titel}` }] : []), ...neuOhneDoppel]);
    angehaengt = !!alt;
    altDrin = !!alt;
  } catch (e) {
    if (e instanceof BindeFehler && alt && e.datei === `bisheriger ${titel}`) {
      // Die ALTE Datei ist von der Bank verschlüsselt — dann die neuen für sich (die alte bleibt im Archiv).
      try { pdf = neuOhneDoppel.length === 1 ? neuOhneDoppel[0].buffer : await zuEinerPdf(neuOhneDoppel); }
      catch (e2) { if (e2 instanceof BindeFehler) return fehler(bindeSatz(e2, "sie")); throw e2; }
      hinweisAlt = " Die bisherige Datei war von der Bank geschützt und liegt weiter im Archiv der Akte.";
    } else if (e instanceof BindeFehler) {
      return fehler(bindeSatz(e, "sie"));
    } else throw e;
  }

  await unterlageSichern(ref, ein.art, lauf);
  if (ersetzen && altTraeger && altTraeger !== ref) await unterlageSichern(altTraeger, ein.art, lauf);
  await lauf.unsafe(`UPDATE fiaon_applications SET ${spalte} = $1, documents_uploaded_at = NOW() WHERE ref = $2`, [pdf, ref]);
  // Welche Dateien jetzt in der Spalte stecken — für die Doppelprüfung beim nächsten Upload.
  const teileJetzt = Array.from(new Set([...(altDrin ? altTeile : []), ...neuOhneDoppel.map((t) => t.hash)]));
  await lauf`INSERT INTO fiaon_unterlagen_teile (person_id, art, ergebnis_hash, teile) VALUES (${ein.personId}, ${ein.art}, ${sha(pdf)}, ${teileJetzt})`
    .catch((e: unknown) => console.error("[UNTERLAGEN-LINK] Teile:", String((e as Error)?.message || e).slice(0, 160)));
  await lauf`
    UPDATE fiaon_applications SET status = 'documents_submitted'
     WHERE ref = ${ref} AND bank_statement_pdf IS NOT NULL AND id_card_pdf IS NOT NULL AND status IN ('pending', 'documents_requested')`.catch(() => {});
  // ── DER KYC-STAND WIE BEIM UPLOAD IM BEREICH (/upload-kyc) — Nachprüfung 08.10. ──
  // Hatte die Verwaltung die Unterlage neu angefordert (kyc_status 'changes_requested', reupload_*),
  // blieb der Kunde sonst aus der Prüfliste „KYC offen“ draußen und die Akte sagte „erneut angefordert“.
  // Die Flags gelten je Person (dokumentStand rechnet bool_or) — also an allen Bestellungen zurücksetzen.
  if (ein.art === "ausweis" || ein.art === "kontoauszug") {
    const flag = ein.art === "kontoauszug" ? "reupload_bank_statement" : "reupload_id_card";
    const familie = await personFamilie(ein.personId, lauf);
    await lauf.unsafe(`UPDATE fiaon_applications SET ${flag} = FALSE, updated_at = NOW() WHERE person_id = ANY($1::bigint[]) AND ${flag} IS TRUE`, [familie])
      .catch((e: unknown) => console.error("[UNTERLAGEN-LINK] KYC-Flag:", String((e as Error)?.message || e).slice(0, 160)));
    await lauf`
      UPDATE fiaon_applications SET kyc_status = 'pending', updated_at = NOW()
       WHERE person_id = ANY(${familie}) AND kyc_status = 'changes_requested'
         AND NOT COALESCE(reupload_bank_statement, FALSE) AND NOT COALESCE(reupload_id_card, FALSE)`
      .catch((e: unknown) => console.error("[UNTERLAGEN-LINK] KYC-Stand:", String((e as Error)?.message || e).slice(0, 160)));
  }

  // Prüfung (synchron, mit Zeitgrenze) — der Kunde erfährt sofort, wenn etwas fehlt.
  let kundenSatz = "";
  let internSatz = "";
  try {
    const { pruefungAnstossen } = await import("./fiaon-dokument-pruefung");
    const u = await pruefungAnstossen(ref, ein.art, pdf);
    if (u?.hinweisKunde) kundenSatz = ` ${u.hinweisKunde}`;
    if (u && (u.erkannt === false || u.vollstaendig === false) && u.hinweisIntern) internSatz = ` ⚠ ${u.hinweisIntern}`;
  } catch (e) {
    console.error("[UNTERLAGEN-LINK] Prüfung:", String(e).slice(0, 160));
  }
  if (ein.art === "kontoauszug") {
    void import("./fiaon-kontoauszug-analyse").then(({ kontoauszugAnalysieren }) => kontoauszugAnalysieren(ref, { erzwingen: true }))
      .catch((e) => console.error("[UNTERLAGEN-LINK] Analyse:", e?.message));
  }
  if (ein.art === "schufa") {
    void import("./fiaon-schufa-analyse").then(({ schufaAnalysieren }) => schufaAnalysieren(ref, { erzwingen: true }))
      .catch((e) => console.error("[UNTERLAGEN-LINK] Auskunft-Analyse:", e?.message));
    // 4a: Liegt ein offener Beschaffungsauftrag, ist das jetzt eine Leistungsfrage — nicht still weiter beschaffen.
    const { beschaffungBeiEigenemUpload } = await import("./fiaon-auskunft-lieferung");
    await beschaffungBeiEigenemUpload(ein.personId, ein.quelle.art === "link" ? "kunde" : "mitarbeiter", ein.quelle.art === "mitarbeiter" ? ein.quelle.name : null, lauf)
      .catch((e: unknown) => console.error("[UNTERLAGEN-LINK] Beschaffung:", String((e as Error)?.message || e).slice(0, 160)));
  }

  const n = neuOhneDoppel.length;
  const herkunft = ein.quelle.art === "link" ? `über den Upload-Link (#${ein.quelle.linkId}, ohne Anmeldung)` : `von ${ein.quelle.name}`;
  const intern = `${titel} ${herkunft} hochgeladen: ${n} Datei${n === 1 ? "" : "en"}${angehaengt ? ", an die vorhandene angehängt" : ersetzen ? ", ersetzt die bisherige (falsches Dokument: Nebenkonto, unlesbar oder kein Ausweis — alte Fassung im Archiv)" : ""} (${Math.max(1, Math.round(pdf.length / 1024))} KB).${hinweisAlt}${internSatz}`;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${ein.personId}, ${ein.quelle.art === "mitarbeiter" ? ein.quelle.agentId : null}, ${ein.quelle.art === "mitarbeiter" ? ein.quelle.name : "Kunde (Upload-Link)"}, 'system', ${intern})`
    .catch(() => {});
  // Die Prüfaufgabe der Verwaltung — derselbe Vermerk wie beim Upload im Bereich (/upload-kyc).
  await lauf`
    INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
    VALUES ('aufgabe', ${ref},
            ${`Unterlagen eingegangen (${titel}, ${herkunft}) — bitte prüfen und freigeben (Verwaltung → Kunden → Prüfung).${internSatz ? ` Automatische Prüfung meldet:${internSatz}` : ""}`},
            'betreiber', TRUE, ${!!internSatz}, 'offen', 'system', 'System', ((NOW() AT TIME ZONE 'Europe/Berlin')::date + 2))`
    .catch((e: unknown) => console.error("[UNTERLAGEN-LINK] Verwaltungs-Aufgabe:", String((e as Error)?.message || e).slice(0, 160)));
  if (ein.quelle.art === "link") {
    await lauf`UPDATE fiaon_unterlagen_links SET nutzungen = nutzungen + 1, dateien = dateien + ${n}, letzte_nutzung = NOW() WHERE id = ${ein.quelle.linkId}`.catch(() => {});
    // Eine Aufgabe an den Betreuer — idempotent je Person: „Unterlagen eingegangen – Auswertung erzeugen".
    try {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: ein.personId, ref, schluessel: `unterlagen-eingang:${ein.personId}`,
        titel: "Unterlagen eingegangen — Auswertung erzeugen",
        text: `${intern}\n\nAkte → Dokumente: Die Voraussetzungen der „FIAON Finanz- und Bonitätsauswertung“ werden neu geprüft. Sind Ausweis und Kontoauszug vollständig, „Auswertung erzeugen“ drücken, Vorschau prüfen und freigeben.`,
        quelle: "bestellung", bereich: "pruefen", autorName: "Upload-Link",
        anlageText: "Angelegt, weil der Kunde über den Upload-Link Unterlagen hochgeladen hat.",
      });
    } catch (e) {
      console.error("[UNTERLAGEN-LINK] Aufgabe:", String((e as Error)?.message || e).slice(0, 160));
    }
  }
  return {
    ok: true, angehaengt, intern,
    meldung: `Vielen Dank — ${n === 1 ? "Ihre Datei" : `Ihre ${n} Dateien`} zu „${titel}“ ${n === 1 ? "ist" : "sind"} angekommen${angehaengt ? ` und ${n === 1 ? "liegt" : "liegen"} bei Ihren bisherigen Unterlagen` : ersetzen ? ` und ${n === 1 ? "ersetzt" : "ersetzen"} die bisherige Datei` : ""}.${kundenSatz}${hinweisAlt}`,
  };
}
