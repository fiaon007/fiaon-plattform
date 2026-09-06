// ═══════════════════════════════════════════════════════════════════════════
// /APP — ANMELDE-LINK OHNE PASSWORT (Scheibe 6, Modul C, 06.09.2026)
//
// Bauvorlage 3.12: Der Kunde tippt seine E-Mail-Adresse, bekommt einen Link,
// klickt — und ist angemeldet. Kein Passwort, kein „Passwort vergessen“.
// Gemessen (27.08.2026): jeder fünfte Passwort-Reset endete in einer
// Abweisung; die Kunden hier haben oft kein Passwort mehr im Kopf, aber immer
// ein Postfach in der Hand.
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
// · KEINE AUFZÄHLBARKEIT. POST /app/login-link antwortet IMMER gleich —
//   bekannte Adresse, unbekannte Adresse, Tippfehler, Bremse: derselbe Satz,
//   derselbe Status, und die Antwort geht raus, BEVOR die Datenbank gefragt
//   wird (sonst verrät die Antwortzeit, ob es ein Konto gibt).
// · DIESELBE KONTOAUFLÖSUNG WIE DER PASSWORT-LOGIN: `loadLoginFamily` +
//   `pickAccountRow` (fiaon-login-logic.ts). Eine zweite Suche würde eines
//   Tages ein anderes Konto finden als der Login — genau daran blieb die
//   Login-Sperre 2026 monatelang unentdeckt.
// · DER LINK IST EIN GEHEIMNIS, KEINE SIGNATUR: 32 Zufallsbytes; in
//   fiaon_login_links liegt nur der SHA-256 davon. 60 Minuten gültig, genau
//   einmal nutzbar — die Einlösung ist EIN UPDATE mit Bedingung, damit ein
//   Doppelklick nicht zwei Sitzungen erzeugt.
//   EHRLICH GESAGT (Prüfung 06.09.2026): Der Klartext-Link wandert als
//   `login_link_url` in die Mail-Nutzlast, und die schreibt
//   versendenUndProtokollieren als JSONB nach fiaon_mail_log.payload; auf dem
//   Standard-Versandweg „make“ liegt sie zusätzlich in der Make-Historie. Wer
//   fiaon_mail_log lesen kann, hat den Link also 60 Minuten lang. Abhilfe
//   gehört in server/lib/fiaon-mail-log.ts (Schlüssel *_url/*_token vor dem
//   INSERT schwärzen) und in fiaon_settings.mail_direkt_ausnahmen bzw.
//   mail_versandweg (app_login_link nie an Make) — beides Hauptsitzung.
// · Die Bremse (3 je Adresse, 10 je IP, je Stunde) läuft im Speicher mit
//   Verfall — ein Neustart vergisst sie, das ist hier verkraftbar. Die IP
//   kommt aus req.ip (trust proxy 1, server/index.ts), nie aus dem ERSTEN
//   X-Forwarded-For-Eintrag — den setzt der Client selbst.
// · Der Link in der Mail zeigt DIREKT auf die API-Route
//   /api/fiaon/app/login/link/:token — sie antwortet mit 302, eine Client-
//   Route ist dafür nicht nötig (und App.tsx hat keine; der Catch-all /app/*
//   würde den Klick in den Login-Bildschirm umleiten, Prüfung 06.09.2026).
// · Das Klartext-Passwort wird NICHT angefasst. Nachhashen macht allein der
//   Passwort-Login (fiaon-antrag.ts), der das eingegebene Passwort kennt.
// · Mail NUR über mailSenden (Mailwerk E-070). Akteur „System“ mit der Rolle
//   admin — so machen es die anderen Systemversände (fiaon-kundenansicht.ts);
//   ein Ereignis ohne ZUSATZ-Eintrag in fiaon-mail-events.ts erlaubt genau
//   diese Rolle.
//
// Tabelle: db/migrations/082_app_bericht_push_login.sql, Abschnitt C — dieselbe
// DDL unten in ensureLoginLinkTabelle (idempotent).
// Mount: routes.ts unter /api/fiaon (macht die Hauptsitzung).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request } from "express";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { kundenSitzungSetzen } from "../lib/fiaon-kunde-session";
import { mailSenden } from "../lib/fiaon-mail-senden";
import { absoluteUrl } from "../fiaon-base-url";
import { maskEmailForLog, pickAccountRow } from "../fiaon-login-logic";
import { loadLoginFamily } from "./fiaon-antrag";

const router = Router();

// ── Tabelle ─────────────────────────────────────────────────────────────────
let tabelleBereit: Promise<void> | null = null;
export function ensureLoginLinkTabelle(): Promise<void> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_login_links (
        id BIGSERIAL PRIMARY KEY, ref TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(), gueltig_bis TIMESTAMPTZ NOT NULL,
        genutzt_am TIMESTAMPTZ, ip TEXT, user_agent TEXT)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_login_links_ref_idx ON fiaon_login_links (ref, erstellt_am DESC)`;
    })().catch((e) => { tabelleBereit = null; throw e; });
  }
  return tabelleBereit;
}

// ── Konstanten ──────────────────────────────────────────────────────────────
/** Gültigkeit eines Links. Steht auch im Kundentext und in der Mail-Fußnote — bei Änderung alle drei Stellen. */
export const LOGIN_LINK_MINUTEN = 60;
const LINK_MS = LOGIN_LINK_MINUTEN * 60 * 1000;
/** Die EINE Antwort des POST — für jede Eingabe dieselbe. */
export const LOGIN_LINK_ANTWORT = {
  ok: true as const,
  text: `Wenn zu dieser Adresse ein Zugang gehört, ist der Anmelde-Link unterwegs. Er gilt ${LOGIN_LINK_MINUTEN} Minuten. Bitte prüfen Sie auch den Spam-Ordner.`,
};
const BREMSE_FENSTER_MS = 15 * 60 * 1000;          // IP: 5 je 15 Minuten (TFO-Vorgabe 06.09.)
const BREMSE_JE_EMAIL = 3;                        // E-Mail: 3 je Stunde
const BREMSE_FENSTER_EMAIL_MS = 60 * 60 * 1000;
const BREMSE_JE_IP = 5;
/** Basis64-URL-Form von 32 Zufallsbytes: genau 43 Zeichen. */
const TOKEN_MUSTER = /^[A-Za-z0-9_-]{43}$/;
/** Der Pfad, den die Mail verlinkt — die API-Route selbst (Mount /api/fiaon in routes.ts). */
export const LOGIN_LINK_PFAD = "/api/fiaon/app/login/link";

// ── Die Bremse (Speicher, mit Verfall) ──────────────────────────────────────
const bremse = new Map<string, number[]>();
let letzteBremsenPflege = 0;

/** Zählt einen Versuch und sagt, ob er noch im Deckel liegt. */
function bremseErlaubt(schluessel: string, deckel: number, jetzt = Date.now(), fenster = BREMSE_FENSTER_MS): boolean {
  if (jetzt - letzteBremsenPflege > 5 * 60 * 1000) {
    letzteBremsenPflege = jetzt;
    const alt: string[] = [];
    const laengstes = Math.max(BREMSE_FENSTER_MS, BREMSE_FENSTER_EMAIL_MS);
    bremse.forEach((zeiten, k) => { if (!zeiten.some((t) => jetzt - t < laengstes)) alt.push(k); });
    for (let i = 0; i < alt.length; i++) bremse.delete(alt[i]);
  }
  const frisch = (bremse.get(schluessel) ?? []).filter((t) => jetzt - t < fenster);
  if (frisch.length >= deckel) { bremse.set(schluessel, frisch); return false; }
  frisch.push(jetzt);
  bremse.set(schluessel, frisch);
  return true;
}

/** Nur für Tests/Prüfstand: Bremse leeren. */
export function bremseZuruecksetzen(): void { bremse.clear(); }

// ── Helfer ──────────────────────────────────────────────────────────────────
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Die Adresse des Anfragenden — Muster absenderIp (fiaon-app-antraege.ts):
 * req.ip zuerst (server/index.ts setzt `trust proxy 1`, das ist die Adresse
 * hinter dem Render-Proxy). X-Forwarded-For nur als Rückfall, und dann der
 * LETZTE Eintrag: den hängt der Proxy an, den ersten schickt der Client selbst
 * mit — mit einem frei erfundenen ersten Eintrag wäre die Bremse 10 je IP
 * wertlos und die gespeicherte IP kein Beweis.
 */
function clientIp(req: Request): string {
  if (req.ip) return String(req.ip);
  const weiter = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return weiter.length ? weiter[weiter.length - 1] : (req.socket?.remoteAddress || "");
}

/**
 * Ziel nach der Anmeldung: nur Pfade innerhalb von /app, nichts Absolutes,
 * kein „//“, kein Protokoll — sonst wäre der Anmelde-Link ein offener Umleiter.
 */
export function weiterZiel(roh: unknown): string {
  const w = String(roh ?? "").trim();
  if (!w) return "/app";
  if (!/^\/app(\/[A-Za-z0-9_\-./]*)?(\?[A-Za-z0-9_\-.=&%]*)?$/.test(w)) return "/app";
  if (w.includes("//") || w.includes("..") || w.includes("\\") || w.startsWith("/app/login/link")) return "/app";
  return w;
}

/** Konto zur Adresse — exakt die Auswahlregel des Passwort-Logins, ohne Passwort. */
export async function kontoFuerAdresse(normalizedEmail: string): Promise<{ ref: string; personId: number | null; gesperrt: boolean } | null> {
  const family = await loadLoginFamily(normalizedEmail);
  if (!family.length) return null;
  const account = pickAccountRow(family);
  if (!account?.ref) return null;
  // Der Mensch hinter dem Konto — notfalls aus einer Zeile, die zu DIESEM Konto
  // gehört (die Kontozeile selbst oder eine in sie zusammengeführte Bestellung).
  // NIE aus einer beliebigen Familienzeile: Die Familie umfasst alles, was die
  // Adresse teilt (email, contact_email, billing_email, Person) — gehört so eine
  // Zeile einem anderen Menschen, bekäme DER die Anmeldung für dieses Konto.
  let personId: number | null = account.person_id ? Number(account.person_id) : null;
  if (!personId) {
    const mit = family.find((r: any) => r.person_id && (r.ref === account.ref || r.merged_into === account.ref));
    personId = mit?.person_id ? Number(mit.person_id) : null;
  }
  return { ref: String(account.ref), personId, gesperrt: account.account_status === "suspended" };
}

/**
 * Link erzeugen und verschicken. Gibt zurück, was geschah — für Protokoll und
 * Prüfstand, NIE für die HTTP-Antwort (die ist immer dieselbe).
 */
export async function loginLinkAnfordern(ein: { email: string; ip: string; userAgent: string; weiter?: unknown }):
  Promise<{ ergebnis: "versandt" | "kein_konto" | "gesperrt" | "keine_person" | "mail_abgelehnt"; ref: string | null; grund?: string }> {
  await ensureLoginLinkTabelle();
  const konto = await kontoFuerAdresse(ein.email);
  if (!konto) return { ergebnis: "kein_konto", ref: null };
  if (konto.gesperrt) return { ergebnis: "gesperrt", ref: konto.ref };
  if (!konto.personId) return { ergebnis: "keine_person", ref: konto.ref };

  const token = randomBytes(32).toString("base64url");
  const gueltigBis = new Date(Date.now() + LINK_MS);
  await sqlPool`INSERT INTO fiaon_login_links (ref, token_hash, gueltig_bis, ip, user_agent)
                VALUES (${konto.ref}, ${sha256(token)}, ${gueltigBis}, ${ein.ip || null}, ${String(ein.userAgent || "").slice(0, 300) || null})`;

  const ziel = weiterZiel(ein.weiter);
  // Direkt die API-Route: Sie löst ein und antwortet mit 302. Ein Link auf
  // /app/login/link/… liefe in den Client-Catch-all /app/* und von dort in den
  // Login-Bildschirm — der Token würde nie eingelöst.
  const url = absoluteUrl(`${LOGIN_LINK_PFAD}/${token}${ziel !== "/app" ? `?weiter=${encodeURIComponent(ziel)}` : ""}`);
  const versand = await mailSenden({
    event: "app_login_link",
    personId: konto.personId,
    akteur: { rolle: "admin", name: "System (Anmelde-Link)", agentId: null },
    zusatz: {
      // Die getippte Adresse ist nur der LETZTE Rückfall: Den Empfänger bestimmt
      // adresseBestimmen (make-webhook.ts → fiaon-empfaenger.ts) — primary_email
      // der Person, dann Alias, dann die Bestellung. Wer seine contact_email
      // tippt, bekommt den Link also auf die Adresse der Person. Wer die getippte
      // Adresse erzwingen will, baut das in make-webhook.ts bewusst als Ausnahme
      // für app_login_link — nicht hier stillschweigend.
      email: ein.email,
      login_link_url: url,
      login_url: absoluteUrl("/app/login"),
      gueltig_minuten: String(LOGIN_LINK_MINUTEN),
    },
  });
  if (!versand.ok) {
    // Nicht versandt = nicht einlösbar. Sonst läge ein gültiges Geheimnis herum, das nie ankam.
    await sqlPool`UPDATE fiaon_login_links SET genutzt_am = NOW() WHERE token_hash = ${sha256(token)} AND genutzt_am IS NULL`.catch(() => undefined);
    return { ergebnis: "mail_abgelehnt", ref: konto.ref, grund: versand.grund ?? versand.meldung };
  }
  return { ergebnis: "versandt", ref: konto.ref };
}

/**
 * Link einlösen — EIN UPDATE mit allen Bedingungen (Hash, gültig, ungenutzt).
 * Zwei gleichzeitige Klicks: einer gewinnt, der andere sieht „abgelaufen“.
 */
export async function loginLinkEinloesen(token: unknown, ip: string, userAgent: string): Promise<{ ref: string } | null> {
  const t = String(token ?? "");
  if (!TOKEN_MUSTER.test(t)) return null;
  await ensureLoginLinkTabelle();
  const hash = sha256(t);
  const [z] = (await sqlPool`
    UPDATE fiaon_login_links SET genutzt_am = NOW(), ip = COALESCE(${ip || null}, ip), user_agent = COALESCE(${String(userAgent || "").slice(0, 300) || null}, user_agent)
     WHERE token_hash = ${hash} AND genutzt_am IS NULL AND gueltig_bis > NOW()
     RETURNING ref, token_hash`) as any[];
  if (!z) return null;
  // Die Datenbank hat den Hash schon verglichen; der zweite Vergleich hier ist
  // nur die Form, in der dieses Haus Geheimnisse vergleicht (timingSafeEqual).
  const a = Buffer.from(String(z.token_hash)); const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  // Das Konto muss es noch geben und es darf nicht gesperrt sein — dieselbe
  // einzige Sperre wie beim Passwort-Login (account_status = 'suspended').
  const [k] = (await sqlPool`SELECT account_status, gdpr_deleted_at FROM fiaon_applications WHERE ref = ${z.ref} LIMIT 1`) as any[];
  if (!k || k.gdpr_deleted_at || k.account_status === "suspended") return null;
  return { ref: String(z.ref) };
}

// ── Endpunkte ───────────────────────────────────────────────────────────────

/**
 * POST /api/fiaon/app/login-link { email, weiter? } — ÖFFENTLICH.
 * Antwortet sofort und immer gleich; die Arbeit läuft danach im Hintergrund.
 */
router.post("/app/login-link", (req, res) => {
  const ip = clientIp(req);
  const userAgent = String(req.headers["user-agent"] || "");
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const weiter = req.body?.weiter;

  // Erst die Antwort — dann die Arbeit. Kein Zweig darf die Antwort verändern.
  res.json(LOGIN_LINK_ANTWORT);

  const plausibel = email.length >= 5 && email.length <= 200 && email.includes("@") && !/\s/.test(email);
  if (!plausibel) return;
  if (!bremseErlaubt(`ip:${ip || "unbekannt"}`, BREMSE_JE_IP)) {
    console.log(`[APP-LOGIN-LINK] Bremse IP — ${maskEmailForLog(email)}`);
    return;
  }
  if (!bremseErlaubt(`email:${sha256(email)}`, BREMSE_JE_EMAIL, Date.now(), BREMSE_FENSTER_EMAIL_MS)) {
    console.log(`[APP-LOGIN-LINK] Bremse Adresse — ${maskEmailForLog(email)}`);
    return;
  }

  void loginLinkAnfordern({ email, ip, userAgent, weiter })
    .then((erg) => {
      console.log(`[APP-LOGIN-LINK] ${erg.ergebnis} — ${maskEmailForLog(email)}${erg.ref ? ` (${erg.ref})` : ""}${erg.grund ? ` — ${erg.grund}` : ""}`);
    })
    .catch((e) => console.error("[APP-LOGIN-LINK] Fehler:", e instanceof Error ? e.message : e));
});

/**
 * GET /api/fiaon/app/login/link/:token[?weiter=/app/…] — der Klick aus der Mail.
 * Setzt die Kundensitzung (30 Tage, wie „angemeldet bleiben“) und leitet um.
 */
router.get("/app/login/link/:token", async (req, res) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  const abgelaufen = () => res.redirect(302, "/app/login?link=abgelaufen");
  try {
    const erg = await loginLinkEinloesen(req.params.token, clientIp(req), String(req.headers["user-agent"] || ""));
    if (!erg) return abgelaufen();
    kundenSitzungSetzen(res, erg.ref, { bleiben: true });
    console.log(`[APP-LOGIN-LINK] angemeldet (${erg.ref})`);
    return res.redirect(302, weiterZiel(req.query.weiter));
  } catch (e) {
    console.error("[APP-LOGIN-LINK] einlösen:", e instanceof Error ? e.message : e);
    return abgelaufen();
  }
});

export default router;
