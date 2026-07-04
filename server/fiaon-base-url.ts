// ═══════════════════════════════════════════════════════════════════
// Zentrale Base-URL für ALLE generierten absoluten FIAON-Links
// (Invite, Passwort-Reset, Rechnungs-Downloads, Zahlungsseiten in E-Mails).
//
// Quelle: APP_BASE_URL (bevorzugt) → FIAON_BASE_URL (legacy) → Fallback.
// Der Fallback ist IMMER https://www.fiaon.com — niemals die alte
// .de-Domain, niemals localhost (Bugfix: Reset-Links zeigten auf die
// falsche Domain, Safari: „Seite nicht gefunden").
// Siehe MIGRATION_INVENTORY.md / SITE_MAP.md
// ═══════════════════════════════════════════════════════════════════

const FALLBACK_BASE_URL = "https://www.fiaon.com";

let warnedMissing = false;

/** Effektive Base-URL ohne trailing Slash. */
export function fiaonBaseUrl(): string {
  const raw = process.env.APP_BASE_URL || process.env.FIAON_BASE_URL;
  if (!raw) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn(
        `[FIAON-BASE-URL] WARNUNG: APP_BASE_URL ist nicht gesetzt — Fallback auf ${FALLBACK_BASE_URL}. ` +
          `Bitte APP_BASE_URL (z. B. https://www.fiaon.com) im Deployment-Environment setzen.`,
      );
    }
    return FALLBACK_BASE_URL;
  }
  return raw.replace(/\/+$/, "");
}

/**
 * Einziger erlaubter Weg, eine absolute URL zu bauen.
 * absoluteUrl("/agent/passwort?token=x") → "https://www.fiaon.com/agent/passwort?token=x"
 */
export function absoluteUrl(path: string): string {
  return `${fiaonBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Diagnose für /admin/einstellungen: Wert + Quelle der Base-URL. */
export function baseUrlDiagnostics(): { value: string; source: "APP_BASE_URL" | "FIAON_BASE_URL" | "fallback" } {
  if (process.env.APP_BASE_URL) return { value: fiaonBaseUrl(), source: "APP_BASE_URL" };
  if (process.env.FIAON_BASE_URL) return { value: fiaonBaseUrl(), source: "FIAON_BASE_URL" };
  return { value: FALLBACK_BASE_URL, source: "fallback" };
}
