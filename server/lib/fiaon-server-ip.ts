// ═══════════════════════════════════════════════════════════════════════════
// SERVER-IPs — die Adressen, unter denen dieser Dienst nach außen auftritt
//
// ── DAS PROBLEM ────────────────────────────────────────────────────────────
// Brevo lehnt Anfragen von nicht freigegebenen IPs ab. Der Betreiber sah:
//   „0 verschickt, 1 fehlgeschlagen (Grund steht im Protokoll)"
// Im Protokoll stand: „Brevo-Sicherheit blockiert diesen Server — die Adresse
// 74.220.50.221 steht nicht auf der Freigabeliste."
//
// Er trägt sie ein — und beim nächsten Neustart hat Render eine ANDERE. Auf
// einer Plattform ohne feste Ausgangs-IP ist eine IP-Freigabeliste ein Fass
// ohne Boden.
//
// ── WAS DIESE DATEI TUT ────────────────────────────────────────────────────
// Sie merkt sich JEDE Adresse, unter der dieser Dienst je aufgetreten ist —
// aus dem eigenen Abruf beim Start und aus jeder Brevo-Fehlermeldung, die
// eine IP nennt. Die Diagnose zeigt daraus eine Liste zum Kopieren.
//
// Damit hat der Betreiber zwei ehrliche Wege:
//   1. Alle gesehenen Adressen eintragen (hilft, solange sie sich nicht
//      ändern — bei Render tun sie das).
//   2. Die Beschränkung abschalten. Das ist bei einer Plattform mit
//      wechselnden Ausgangs-IPs die einzige Lösung, die hält. Der Schlüssel
//      bleibt geheim; die IP-Sperre schützt nur gegen gestohlene Schlüssel.
// Die Diagnose sagt beides — und nennt Weg 2 als den empfohlenen.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Ein einfaches Schlüssel-Wert-Feld reicht; eine eigene Tabelle wäre zu viel. */
const SCHLUESSEL = "brevo_gesehene_ips";

async function feldLesen(lauf: Lauf = sqlPool): Promise<string[]> {
  const [r] = (await lauf`
    SELECT value FROM fiaon_settings WHERE key = ${SCHLUESSEL}
  `.catch(() => [] as any[])) as any[];
  if (!r?.value) return [];
  try {
    const v = JSON.parse(String(r.value));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Eine Adresse vormerken. Idempotent — dieselbe IP wird nicht doppelt
 * gespeichert, und ein Fehler beim Merken darf nie den Aufrufer stören:
 * Wir sind hier im Fehlerpfad, der ohnehin schon schlecht läuft.
 */
export async function ipVormerken(ip: string, lauf: Lauf = sqlPool): Promise<void> {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return;
  try {
    const alle = await feldLesen(lauf);
    if (alle.includes(ip)) return;
    // Höchstens zwanzig. Eine Liste mit hundert Adressen liest niemand mehr,
    // und sie wäre der Beweis, dass Weg 1 nicht funktioniert.
    const neu = [...alle, ip].slice(-20);
    await lauf`
      INSERT INTO fiaon_settings (key, value) VALUES (${SCHLUESSEL}, ${JSON.stringify(neu)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(neu)}
    `;
    console.log(`[SERVER-IP] Neue Ausgangsadresse gesehen: ${ip} (insgesamt ${neu.length})`);
  } catch {
    /* Ein misslungener Merker ist kein Grund, irgendetwas abzubrechen. */
  }
}

export async function gesehenIPs(lauf: Lauf = sqlPool): Promise<string[]> {
  return feldLesen(lauf);
}

/**
 * Die eigene Außenadresse ermitteln und vormerken.
 *
 * Läuft beim Start. Schlägt der Abruf fehl, passiert nichts — die Adresse
 * ist eine Bequemlichkeit, kein Betriebsmittel.
 */
export async function eigeneIPMerken(): Promise<string | null> {
  try {
    const abbruch = AbortSignal.timeout(6000);
    const r = await fetch("https://api.ipify.org?format=json", { signal: abbruch });
    const j = (await r.json()) as { ip?: string };
    if (!j?.ip) return null;
    await ipVormerken(String(j.ip));
    return String(j.ip);
  } catch {
    return null;
  }
}

/**
 * Die Karte für die System-Diagnose.
 *
 * `blockiert` sagt, ob Brevo schon einmal wegen der IP abgelehnt hat. Nur
 * dann ist das eine Warnung — sonst ist es eine Randnotiz, und Randnotizen
 * gehören nicht in eine Diagnose, die man ernst nehmen soll.
 */
export async function ipDiagnose(lauf: Lauf = sqlPool): Promise<{
  ips: string[];
  blockiert: boolean;
  zuletzt: string | null;
  titel: string;
  empfehlung: string;
  anleitung: string[];
}> {
  const ips = await gesehenIPs(lauf);
  const [b] = (await lauf`
    SELECT grund, created_at FROM fiaon_mail_log
    WHERE grund ILIKE '%Freigabeliste%' ORDER BY created_at DESC LIMIT 1
  `.catch(() => [] as any[])) as any[];

  return {
    ips,
    blockiert: !!b,
    zuletzt: b?.created_at ? String(b.created_at) : null,
    titel: b
      ? "Brevo blockiert diesen Server wegen seiner IP-Adresse"
      : "Ausgangsadressen dieses Servers",
    empfehlung: b
      ? "Schalte die IP-Beschränkung bei Brevo ab. Diese Plattform bekommt bei "
        + "jedem Neustart eine andere Adresse — eine Freigabeliste ist hier ein "
        + "Fass ohne Boden. Der Schlüssel bleibt geheim; die IP-Sperre schützt "
        + "nur zusätzlich gegen einen gestohlenen Schlüssel."
      : "Falls Brevo eine IP-Beschränkung verlangt, sind das die Adressen, "
        + "unter denen dieser Dienst bisher aufgetreten ist.",
    anleitung: [
      "Öffne app.brevo.com/security/authorised_ips",
      ips.length > 0
        ? `Entweder: alle ${ips.length} Adressen eintragen (${ips.join(", ")})`
        : "Entweder: die unten gezeigte Adresse eintragen",
      "Oder — empfohlen: die Beschränkung dort ganz abschalten",
      "Danach in der Mail-Zentrale „Test an mich“ drücken",
    ],
  };
}
