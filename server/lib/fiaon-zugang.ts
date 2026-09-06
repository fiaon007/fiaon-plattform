// ═══════════════════════════════════════════════════════════════════════════
// ZUGANG RETTEN — der Kunde hängt in der Leitung und kommt nicht rein
//
// Die Diagnose (`zugangsLage`) sagt seit Längerem präzise, WARUM jemand nicht
// hineinkommt. Was fehlte, war der Knopf daneben. Ein Mitarbeiter las „Für
// dieses Konto ist kein Passwort gesetzt" und konnte nichts tun außer den
// Kunden auf „Passwort vergessen" zu verweisen — wo dieser Vorname, Nachname,
// E-Mail UND Geburtsdatum eingeben muss und bei einem Tippfehler im
// Geburtsdatum wieder scheitert.
//
// ZWEI WEGE, BEIDE PROTOKOLLIERT:
//   SETZ-LINK        60 Minuten gültig, signiert, einmalig. Für den Kunden,
//                    der eine Mail lesen kann.
//   EINMAL-PASSWORT  24 Stunden gültig, genau einmal im Klartext angezeigt,
//                    erzwungener Wechsel beim ersten Login. Für den Kunden am
//                    Telefon, der gerade keine Mail findet.
//
// WARUM DAS EINMAL-PASSWORT EINEN WECHSEL ERZWINGT
// Ein am Telefon diktiertes Passwort kennt mindestens eine Person zu viel.
// Ohne Zwang bliebe es für immer gültig — und niemand würde es je ändern.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { passwortHashen } from "./fiaon-kunde-session";
import { absoluteUrl } from "../fiaon-base-url";

type Lauf = typeof sqlPool;

/** So lange gilt ein Setz-Link. Kurz, weil er ein Notbehelf ist. */
export const LINK_MINUTEN = 60;
/** So lange gilt ein Einmal-Passwort. */
export const EINMAL_STUNDEN = 24;

function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}

// ───────────────────────────────────────────────────────────────────────────
// Setz-Link
// ───────────────────────────────────────────────────────────────────────────

/**
 * Signierter Link nach dem Muster der Rechnungs- und Terminlinks.
 *
 * Die `ref` ist Teil der Signatur: Ein Link für Kunde A lässt sich nicht auf
 * Kunde B umschreiben.
 */
export function setzLinkErzeugen(ref: string, ttlMs = LINK_MINUTEN * 60_000): string {
  const exp = Date.now() + ttlMs;
  const einmal = randomBytes(8).toString("hex");
  const sig = createHmac("sha256", geheimnis())
    .update(`zugang.${ref}.${exp}.${einmal}`).digest("hex").slice(0, 32);
  return absoluteUrl(`/zugang/${encodeURIComponent(ref)}?exp=${exp}&e=${einmal}&sig=${sig}`);
}

export function setzLinkPruefen(
  ref: string, exp: string, einmal: string, sig: string,
): { gueltig: boolean; grund: string | null } {
  const expNum = Number(exp);
  if (!expNum) return { gueltig: false, grund: "Dieser Link ist unvollständig." };
  if (expNum < Date.now()) {
    return {
      gueltig: false,
      grund: `Dieser Link ist abgelaufen — er gilt ${LINK_MINUTEN} Minuten. `
        + "Bitte melde dich noch einmal bei uns, dann schicken wir dir sofort einen neuen.",
    };
  }
  const erwartet = createHmac("sha256", geheimnis())
    .update(`zugang.${ref}.${expNum}.${einmal}`).digest("hex").slice(0, 32);
  const a = Buffer.from(erwartet);
  const b = Buffer.from(String(sig || ""));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { gueltig: false, grund: "Dieser Link ist ungültig." };
  }
  return { gueltig: true, grund: null };
}

// ───────────────────────────────────────────────────────────────────────────
// Einmal-Passwort
// ───────────────────────────────────────────────────────────────────────────

/**
 * Ein Passwort, das man am Telefon vorlesen kann.
 *
 * Bewusst keine Sonderzeichen und keine verwechselbaren Zeichen (0/O, 1/l/I):
 * Am Telefon buchstabiert man sonst dreimal. Vier Blöcke zu vier Zeichen sind
 * lang genug, um in 24 Stunden nicht geraten zu werden.
 */
export function einmalPasswortErzeugen(): string {
  const zeichen = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let aus = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) aus += "-";
    aus += zeichen[bytes[i] % zeichen.length];
  }
  return aus;
}

export interface RettungsErgebnis {
  ok: boolean;
  grund?: string;
  /** Nur beim Einmal-Passwort — GENAU EINMAL im Klartext. */
  passwort?: string;
  gueltigBis?: string;
  link?: string;
}

/**
 * Setzt ein Einmal-Passwort auf ALLE Bestellungen der Login-Familie.
 *
 * Auf alle, weil der Login jede Zeile der Familie prüft: Läge das Passwort nur
 * auf einer, käme der Kunde trotzdem rein — aber der erzwungene Wechsel hinge
 * an einer anderen Zeile und liefe ins Leere.
 */
export async function einmalPasswortSetzen(
  ref: string, von: string, grund: string, lauf: Lauf = sqlPool,
): Promise<RettungsErgebnis> {
  const [a] = (await lauf`
    SELECT ref, COALESCE(NULLIF(email,''), NULLIF(contact_email,''), NULLIF(billing_email,'')) AS email
    FROM fiaon_applications WHERE ref = ${ref} AND gdpr_deleted_at IS NULL
  `) as any[];
  if (!a) return { ok: false, grund: "Bestellung nicht gefunden." };
  if (!a.email) return { ok: false, grund: "Für dieses Konto ist keine E-Mail hinterlegt — ohne sie gibt es keinen Login." };

  const passwort = einmalPasswortErzeugen();
  const bis = new Date(Date.now() + EINMAL_STUNDEN * 3600_000);
  const norm = String(a.email).trim().toLowerCase();

  await lauf`
    UPDATE fiaon_applications
    -- 06.09.2026: gehasht statt Klartext, und keine Kopie mehr in utm (die Anmeldung liest die Spalte).
    SET password = ${passwortHashen(passwort)},
        utm = COALESCE(utm, '{}'::jsonb) - 'password',
        einmal_passwort_bis = ${bis},
        passwort_wechsel_noetig = TRUE,
        updated_at = NOW()
    WHERE gdpr_deleted_at IS NULL
      AND (LOWER(TRIM(COALESCE(email, ''))) = ${norm}
        OR LOWER(TRIM(COALESCE(contact_email, ''))) = ${norm}
        OR LOWER(TRIM(COALESCE(billing_email, ''))) = ${norm})
  `;
  await protokoll("zugang_einmalpasswort", ref, von, grund, lauf);
  return { ok: true, passwort, gueltigBis: bis.toISOString() };
}

/** Passwort endgültig setzen — über den Setz-Link oder nach erzwungenem Wechsel. */
export async function passwortSetzen(
  ref: string, neu: string, lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; grund?: string; konto?: any }> {
  if (String(neu).length < 8) return { ok: false, grund: "Das Passwort braucht mindestens 8 Zeichen." };
  const [a] = (await lauf`
    SELECT ref, COALESCE(NULLIF(email,''), NULLIF(contact_email,''), NULLIF(billing_email,'')) AS email
    FROM fiaon_applications WHERE ref = ${ref} AND gdpr_deleted_at IS NULL
  `) as any[];
  if (!a?.email) return { ok: false, grund: "Konto nicht gefunden." };
  const norm = String(a.email).trim().toLowerCase();

  await lauf`
    UPDATE fiaon_applications
    SET password = ${passwortHashen(neu)},
        utm = COALESCE(utm, '{}'::jsonb) - 'password',
        einmal_passwort_bis = NULL,
        passwort_wechsel_noetig = FALSE,
        updated_at = NOW()
    WHERE gdpr_deleted_at IS NULL
      AND (LOWER(TRIM(COALESCE(email, ''))) = ${norm}
        OR LOWER(TRIM(COALESCE(contact_email, ''))) = ${norm}
        OR LOWER(TRIM(COALESCE(billing_email, ''))) = ${norm})
  `;

  // Direkt eingeloggt: Der Kunde hat gerade sein Passwort gesetzt — ihn jetzt
  // auf ein Anmeldeformular zu schicken, wäre eine Hürde ohne Zweck. Die
  // Antwort trägt dieselben Felder wie ein erfolgreicher Login, damit die
  // Portalseite sie unverändert in ihre Sitzung legen kann.
  const { loadLoginFamily } = await import("../routes/fiaon-antrag");
  const { decideLogin } = await import("../fiaon-login-logic");
  const familie = await loadLoginFamily(norm);
  const urteil = decideLogin(familie, neu);
  if (!urteil.granted) {
    return { ok: true, grund: urteil.error ?? undefined };
  }
  const konto = urteil.account;
  return {
    ok: true,
    konto: {
      ref: konto.ref, firstName: konto.first_name, lastName: konto.last_name,
      email: konto.email, packName: konto.pack_name,
    },
  };
}

/**
 * Zugang freischalten, wenn bezahlt wurde, aber der Kontozustand klemmt.
 *
 * Die drei Fälle aus der Diagnose: `status` steht auf einem Wert, der kein
 * Zugangsrecht gibt, obwohl `payment_status='paid'`. Das ist eine
 * Datenschieflage, kein Kundenproblem — sie darf ein Mensch geradeziehen,
 * aber nur mit Begründung.
 */
export async function zugangFreischalten(
  ref: string, von: string, grund: string, lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; grund?: string }> {
  if (String(grund || "").trim().length < 5) {
    return { ok: false, grund: "Bitte in einem Satz begründen, warum du freischaltest." };
  }
  const [a] = (await lauf`
    SELECT ref, status, payment_status, account_status FROM fiaon_applications
    WHERE ref = ${ref} AND gdpr_deleted_at IS NULL
  `) as any[];
  if (!a) return { ok: false, grund: "Bestellung nicht gefunden." };
  // Ohne Zahlung keine Freischaltung. Das ist die Grenze zwischen „Schieflage
  // geradeziehen" und „Ware verschenken".
  if (a.payment_status !== "paid") {
    return { ok: false, grund: "Für diese Bestellung ist keine Zahlung gebucht. Erst buchen, dann öffnet sich das Konto von selbst." };
  }
  if (a.account_status === "suspended") {
    return { ok: false, grund: "Das Konto ist gesperrt. Eine Sperre hebt nur der Vorgesetzte auf." };
  }
  await lauf`
    UPDATE fiaon_applications SET status = 'completed', updated_at = NOW() WHERE ref = ${ref}
  `;
  await protokoll("zugang_freigeschaltet", ref, von, grund, lauf);
  return { ok: true };
}

async function protokoll(art: string, ref: string, von: string, grund: string, lauf: Lauf): Promise<void> {
  await lauf`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (NULL, ${art}, ${JSON.stringify({ ref })}, ${von}, ${grund})
  `.catch(() => {});
  await lauf`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
    VALUES (${ref}, NULL, ${von}, 'system',
            ${`${art === "zugang_einmalpasswort" ? "Einmal-Passwort erzeugt" : art === "zugang_freigeschaltet" ? "Zugang freigeschaltet" : "Setz-Link verschickt"} von ${von}. Grund: ${grund}`},
            NOW())
  `.catch(() => {});
}

export { protokoll as zugangProtokoll };
