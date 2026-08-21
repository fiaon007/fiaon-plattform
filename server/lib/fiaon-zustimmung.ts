// ═══════════════════════════════════════════════════════════════════════════
// DIE ZUSTIMMUNG GIBT DER KUNDE — NIEMAND SONST
//
// ── DIE MELDUNG (Betrieb, 21.08.2026) ──────────────────────────────────────
// Screenshot Hans Neumann: Der Zahlungsdaten-Knopf war gesperrt, weil unter
// anderem „AGB-Zustimmung", „SCHUFA-Einwilligung" und „Zustimmung zum Vertrag"
// fehlten. Die Karte bot dafür denselben Weg an wie für einen Tippfehler in
// der Adresse: „Fehlendes am Telefon ergänzen".
//
// ── WARUM DAS NICHT GEHT ───────────────────────────────────────────────────
// Eine Zustimmung ist eine Willenserklärung. Wer sie für einen anderen setzt,
// erzeugt keinen Nachweis, sondern eine Behauptung — und zwar eine, die im
// Streitfall gegen uns steht. Am 06.08.2026 hat ein Playwright-Lauf die
// Verpflichtungserklärung der Vertriebsleitung „echt angenommen"; AGENTS.md
// hält seitdem fest, dass ein Rechtsnachweis, den nicht der Erklärende
// erzeugt, wertlos ist. Ein Mitarbeiter mit einem Häkchen ist derselbe Fall.
//
// ── WAS ES STATTDESSEN GIBT ────────────────────────────────────────────────
// Einen signierten Link an den Kunden. Er trägt keine Anmeldung (der Kunde hat
// oft noch keinen Zugang — er steht ja noch im Antrag), aber ohne den HMAC ist
// er wertlos, und er nennt genau die Erklärungen, die noch fehlen.
//
// Festgehalten wird, was ein Nachweis braucht: Zeitpunkt, IP und Browserkennung
// — dieselben Spalten, die die Antragsstrecke schon füllt (`ip`, `user_agent`).
//
// ── WARUM EINE EIGENE SEITE UND NICHT DIE ANTRAGSSTRECKE ───────────────────
// GEPRÜFT am 21.08.2026: `client/src/pages/antrag.tsx` kann einen bestehenden
// Antrag NICHT fortsetzen — es gibt keinen `?ref=`-Weg hinein, die drei
// Häkchen (`ag1`, `ag2`, `ag3`) leben nur im Formularzustand von Schritt 6.
// Ein Link in die Antragsstrecke hätte den Kunden auf ein LEERES Formular
// geworfen und einen zweiten Antrag erzeugt. Ein Link, der nicht dorthin
// führt, wo er hinführen soll, ist ein Blindgänger — davon hatte dieses Repo
// schon genug (AGENTS.md, „es erscheint NICHTS").
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { fehlendeZustimmungen, NUR_KUNDE_SPALTEN } from "./fiaon-antrag-vollstaendig";

type Lauf = typeof sqlPool;

/** 30 Tage — der Link steht in einer Mail, die jemand auch nächste Woche öffnet. */
export const ZUSTIMMUNG_TAGE = 30;

function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}

/** Token je BESTELLUNG: `ref.exp.signatur`. Die Referenz ist Teil der Signatur. */
export function zustimmungTokenErzeugen(
  ref: string, ttlMs = ZUSTIMMUNG_TAGE * 24 * 60 * 60 * 1000,
): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", geheimnis())
    .update(`zustimmung.${ref}.${exp}`).digest("hex").slice(0, 32);
  return `${ref}.${exp}.${sig}`;
}

export function zustimmungTokenPruefen(
  token: unknown,
): { ref: string; abgelaufen: boolean } | null {
  const teile = String(token ?? "").split(".");
  if (teile.length !== 3) return null;
  const [ref, expRoh, sig] = teile;
  const exp = Number(expRoh);
  if (!ref || !exp) return null;
  const erwartet = createHmac("sha256", geheimnis())
    .update(`zustimmung.${ref}.${exp}`).digest("hex").slice(0, 32);
  const a = Buffer.from(erwartet);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { ref, abgelaufen: exp < Date.now() };
}

export function zustimmungLink(ref: string): string {
  return absoluteUrl(`/zustimmung/${zustimmungTokenErzeugen(ref)}`);
}

export interface ZustimmungsLage {
  ref: string;
  name: string;
  paket: string | null;
  /** Die Namen der fehlenden Erklärungen, in Formular-Reihenfolge. */
  offen: string[];
  /** Die Spalten dazu — die Seite schickt sie zurück, der Server prüft sie. */
  spalten: string[];
  /** Schon alles erteilt? Dann zeigt die Seite eine Bestätigung, kein Formular. */
  fertig: boolean;
}

/** Welche Erklärungen fehlen dieser Bestellung noch? */
export async function zustimmungsLage(
  ref: string, lauf: Lauf = sqlPool,
): Promise<ZustimmungsLage | null> {
  const [a] = (await lauf`
    SELECT ref, type, pack_name,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                    company_name, contact_name, '') AS name,
           consent_agb, consent_schufa, consent_contract
    FROM fiaon_applications
    WHERE ref = ${ref} AND gdpr_deleted_at IS NULL AND merged_into IS NULL
  `) as any[];
  if (!a) return null;
  const offen = fehlendeZustimmungen(a);
  return {
    ref: String(a.ref),
    name: String(a.name || "").trim(),
    paket: a.pack_name ? String(a.pack_name).split("\n")[0].trim() : null,
    offen,
    spalten: NUR_KUNDE_SPALTEN.filter((s) => a[s] !== true),
    fertig: offen.length === 0,
  };
}

/**
 * Die Erklärungen festhalten.
 *
 * ── DREI WÄNDE ────────────────────────────────────────────────────────────
 *  1. Nur die Spalten aus `NUR_KUNDE_SPALTEN` — kein Weg, über diese Route
 *     einen Betrag oder einen Zahlungszustand zu setzen.
 *  2. Nur von FALSE auf TRUE. Eine erteilte Erklärung nimmt diese Route nicht
 *     zurück; ein Widerruf ist ein anderer Vorgang mit anderem Nachweis.
 *  3. Kein Roboter. Dieselbe Prüfung wie bei der Verpflichtungserklärung
 *     (AGENTS.md, 06.08.2026) — sonst erzeugt der nächste Browsertest echte
 *     Willenserklärungen in der Produktionsdatenbank.
 */
export async function zustimmungFesthalten(
  ref: string,
  spalten: string[],
  nachweis: { ip: string | null; userAgent: string | null },
  lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; grund?: string; erteilt?: string[] }> {
  const erlaubt = spalten.filter((s) => NUR_KUNDE_SPALTEN.includes(s));
  if (erlaubt.length === 0) {
    return { ok: false, grund: "Bitte allen Punkten zustimmen — sonst kommt der Vertrag nicht zustande." };
  }

  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  const roboter = istRoboterUnterschrift(nachweis.ip, nachweis.userAgent);
  if (roboter.roboter) {
    return { ok: false, grund: roboter.grund ?? "Diese Zustimmung kann nur ein Mensch erteilen." };
  }

  // Die Spaltennamen kommen aus einer festen Liste in dieser Datei — sie
  // stammen nie aus der Anfrage, auch wenn die Anfrage sie benennt.
  const setzen = erlaubt.map((s) => `${s} = TRUE`).join(", ");
  await lauf.unsafe(`
    UPDATE fiaon_applications
    SET ${setzen},
        ip = COALESCE($2, ip),
        user_agent = COALESCE($3, user_agent),
        updated_at = NOW()
    WHERE ref = $1 AND gdpr_deleted_at IS NULL
  `, [ref, nachweis.ip, nachweis.userAgent]);

  await lauf`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
    VALUES (${ref}, NULL, 'Kunde', 'system',
            ${`Zustimmung vom Kunden erteilt: ${erlaubt.join(", ")} (IP ${nachweis.ip ?? "unbekannt"}).`},
            NOW())
  `.catch((e) => console.error(`[ZUSTIMMUNG] Verlaufseintrag ${ref} nicht geschrieben:`, e));

  return { ok: true, erteilt: erlaubt };
}
