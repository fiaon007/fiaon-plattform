// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNGSSEITE: WER IST ES? — E-IT-G (08.10.2026), Punkt (14)
// Rein (keine Datenbank), damit der Prüfstand (scripts/pruef-it-g.ts) jeden
// Fall ohne Verbindung durchspielt. Aufrufer: POST /abo-kuendigen
// (server/routes/cancellation.ts) — dort steht das Warum.
//
// ── DIE REGEL (nach der Gegenprüfung 08.10.) ───────────────────────────────
// Der Kündigungsbutton (§ 312k BGB) darf nie an der Identifikation scheitern,
// wenn Name und E-Mail eindeutig zu einer Bestellung passen:
//   · Geburtsdatum passt (Bestellung ODER Person)  → 'geburtsdatum'
//   · bei uns steht keines                          → 'name_email'
//   · bei uns steht eines, die Eingabe widerspricht
//     oder fehlt                                    → 'name_email_abweichend'
// In beiden name_email-Fällen nimmt die Seite die Kündigung an, und das Team
// prüft die Identität (Aufgabe „Identität prüfen“, cancellation.ts). Nur wenn
// Name UND E-Mail nicht passen, gibt es „keine Übereinstimmung“ — und diese
// Meldung ist nach außen immer dieselbe (keine Auskunft, ob jemand Kunde ist).
//
// Der Name wird zusätzlich ZUSAMMENGESETZT verglichen: Die alte Akte teilte
// am letzten Leerzeichen („Anna Maria von“ / „Berg“) — die Kundin tippt
// „Anna Maria“ / „von Berg“. Beides ist „anna maria von berg“.
// ═══════════════════════════════════════════════════════════════════════════
import { geburtsdatumIso } from "../../shared/fiaon-geburtsdatum";

const glatt = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss").replace(/\s+/g, " ").trim();

/** Wie die Kündigung identifiziert wurde (Spalte cancellation_requests.identifiziert_ueber). */
export type KuendigungUeber = "geburtsdatum" | "name_email" | "name_email_abweichend";

/**
 * Passen Vor- und Nachname — einzeln oder als ganzer Name (anders geteilte
 * Altdaten)? Akzente, ß und Groß/klein zählen nicht. Auch der Einmal-Lauf
 * (scripts/it-g-einmal.ts) prüft damit, ob eine Bestellung zur Person passt.
 */
export function vollerNamePasst(k: { first_name: unknown; last_name: unknown }, eingabe: { firstName: unknown; lastName: unknown }): boolean {
  const vor = glatt(eingabe.firstName), nach = glatt(eingabe.lastName);
  if (!vor || !nach) return false;
  if (glatt(k.first_name) === vor && glatt(k.last_name) === nach) return true;
  const ganz = glatt(`${String(k.first_name ?? "")} ${String(k.last_name ?? "")}`);
  return ganz.length > 0 && ganz === glatt(`${vor} ${nach}`);
}

/** Der eine Abgleich der Kündigungsseite — auch für den Prüfstand exportiert. */
type KuendigungKandidat = { ref: string; first_name: string | null; last_name: string | null; app_geburt: unknown; person_geburt: unknown; merged_into?: string | null };
export function kuendigungIdentitaet<K extends KuendigungKandidat>(
  kandidaten: K[],
  eingabe: { firstName: unknown; lastName: unknown; geburt: string | null },
): {
  treffer: K | null;
  ueber: KuendigungUeber | null;
  grund: "kein_konto" | null;
  /** Was bei uns steht, wenn die Eingabe nicht passt — NUR für den internen Vermerk, nie nach außen. */
  hinterlegt: string | null;
} {
  const namePasst = kandidaten.filter((k) => vollerNamePasst(k, eingabe));
  if (!namePasst.length) return { treffer: null, ueber: null, grund: "kein_konto", hinterlegt: null };
  const lebend = (k: K) => !k.merged_into;
  const sortiert = [...namePasst].sort((a, b) => Number(lebend(b)) - Number(lebend(a)));
  const bekannt = sortiert.map((k) => ({ k, geb: geburtsdatumIso(k.person_geburt) ?? geburtsdatumIso(k.app_geburt) }));
  const passt = eingabe.geburt ? bekannt.find((x) => x.geb === eingabe.geburt || geburtsdatumIso(x.k.app_geburt) === eingabe.geburt) : undefined;
  if (passt) return { treffer: passt.k, ueber: "geburtsdatum", grund: null, hinterlegt: null };
  if (bekannt.every((x) => !x.geb)) return { treffer: sortiert[0], ueber: "name_email", grund: null, hinterlegt: null };
  // Widerspruch oder keine Eingabe: trotzdem annehmen, das Team prüft (Gegenprüfung 08.10., § 312k BGB).
  return { treffer: sortiert[0], ueber: "name_email_abweichend", grund: null, hinterlegt: bekannt.find((x) => x.geb)?.geb ?? null };
}

// ── ZUSAMMENGEFÜHRT: BIS ZUM KOPF DER KETTE (Gegenprüfung 08.10.) ──────────
// Ein Treffer kann in eine Bestellung aufgegangen sein, die selbst wieder
// zusammengeführt wurde (gemessen 08.10.: 10 solche Ketten). Ein Schritt
// reichte nicht: Der Antrag zeigte dann auf eine tote Bestellung, und Listen
// mit merged_into IS NULL fanden ihn nie. Höchstens 10 Schritte, ein Kreis
// bricht ab. `naechstes` liest merged_into einer ref (im Prüfstand ein Map).
export async function kopfDerKette(
  ref: string, mergedInto: string | null | undefined, naechstes: (ref: string) => Promise<string | null>, max = 10,
): Promise<string> {
  let kopf = ref;
  let ziel = mergedInto ? String(mergedInto) : null;
  const gesehen = new Set([ref]);
  for (let i = 0; ziel && i < max && !gesehen.has(ziel); i++) {
    gesehen.add(ziel);
    kopf = ziel;
    ziel = await naechstes(ziel);
  }
  return kopf;
}

// ── DROSSEL DER KÜNDIGUNGSSEITE (Gegenprüfung 08.10.) ──────────────────────
// Die Seite ist öffentlich. Ohne Bremse ließe sich durchprobieren, zu welcher
// E-Mail welcher Name passt. Gezählt werden nur FEHLSCHLÄGE („keine
// Übereinstimmung“): höchstens 10 je Adresse (IP) und 5 je E-Mail in 15
// Minuten, danach 429 mit neutralem Text. Erfolgreiche Prüfungen zählen nicht
// — ein Kunde, der sich einmal vertippt, kommt weiter durch. Der Zeitpunkt ist
// ein Parameter, damit der Prüfstand das Fenster verschieben kann.
export const KUENDIGUNG_DROSSEL = { fensterMs: 15 * 60_000, jeIp: 10, jeMail: 5 } as const;
export function kuendigungDrossel(grenzen: { fensterMs: number; jeIp: number; jeMail: number } = KUENDIGUNG_DROSSEL) {
  const fehl = new Map<string, number[]>();
  const frisch = (k: string, jetzt: number) => (fehl.get(k) ?? []).filter((t) => jetzt - t < grenzen.fensterMs);
  return {
    /** true = zu viele Fehlschläge — die Anfrage gar nicht erst prüfen. */
    gesperrt(ip: string, mail: string, jetzt: number = Date.now()): boolean {
      return frisch(`ip:${ip}`, jetzt).length >= grenzen.jeIp || frisch(`mail:${glatt(mail)}`, jetzt).length >= grenzen.jeMail;
    },
    fehlschlag(ip: string, mail: string, jetzt: number = Date.now()): void {
      for (const k of [`ip:${ip}`, `mail:${glatt(mail)}`]) fehl.set(k, [...frisch(k, jetzt), jetzt]);
      // Die Karte darf nicht unbegrenzt wachsen.
      if (fehl.size > 5000) for (const [k, l] of Array.from(fehl.entries())) if (!l.some((t) => jetzt - t < grenzen.fensterMs)) fehl.delete(k);
    },
  };
}

// ── KEINE SACKGASSE (Querprüfung 08.10.2026, § 312k BGB) ───────────────────
// Passen Name oder E-Mail nicht, oder greift die Drossel, nennt die Meldung den
// zweiten Weg: die formlose Kündigung an support@fiaon.com (Postfach mit Antwort
// am selben Werktag, Kontaktseite). Sie gilt mit dem Eingang — die Seite darf
// nie die einzige Tür sein. Die Meldung bleibt für jeden Fall gleich und sagt
// weiter nicht, ob es die Adresse bei uns gibt.
export const KUENDIGUNG_AUSWEG_ADRESSE = "support@fiaon.com";
export const KUENDIGUNG_AUSWEG_SATZ =
  `Klappt es nicht, kündigen Sie formlos an ${KUENDIGUNG_AUSWEG_ADRESSE} — mit Ihrem Namen und der Adresse, mit der Sie bestellt haben. Die Kündigung gilt mit dem Eingang.`;

/** Die eine Meldung nach außen, wenn Name und E-Mail nicht passen — für jeden Fall gleich. */
export const KUENDIGUNG_KEIN_TREFFER =
  "Keine Übereinstimmung gefunden. Bitte prüfen Sie Vor- und Nachname sowie die E-Mail-Adresse, mit der Sie bestellt haben. " + KUENDIGUNG_AUSWEG_SATZ;
export const KUENDIGUNG_ZU_VIELE =
  "Zu viele Versuche. Bitte versuchen Sie es in 15 Minuten erneut. " + KUENDIGUNG_AUSWEG_SATZ;

// ── DIE EINGANGSBESTÄTIGUNG (Querprüfung 08.10.2026, § 312k Abs. 4 BGB) ────
// Nach jedem angenommenen Antrag geht SOFORT eine Bestätigung in Textform raus:
// Inhalt der Erklärung, Datum und Uhrzeit des Eingangs, der Zeitpunkt, zu dem
// gekündigt werden soll, und dass die Kündigung ab dem Eingang gilt. Vorher kam
// die einzige Mail erst mit der Buchung (kuendigung_bestaetigt) — bei offener
// Identität erst nach der Prüfung. Rein (kein Netz), Werte HTML-sicher.
const htmlSicher = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function kuendigungEingangInhalt(ein: {
  am: Date; wunsch: string | null | undefined; paket: string | null | undefined; grund: string | null | undefined;
  antragNr: number; name: string;
}): Record<string, string> {
  const tag = ein.am.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
  const zeit = ein.am.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const w = String(ein.wunsch ?? "").slice(0, 10);
  const wunschDe = /^\d{4}-\d{2}-\d{2}$/.test(w) ? `${w.slice(8, 10)}.${w.slice(5, 7)}.${w.slice(0, 4)}` : null;
  const paket = String(ein.paket ?? "").split("\n")[0].trim();
  const grund = String(ein.grund ?? "").trim().slice(0, 300);
  return {
    eingang_text: `${tag} um ${zeit} Uhr`,
    zeitpunkt_text: wunschDe ?? "nächstmöglicher Zeitpunkt",
    zeitpunkt_satz: `Sie haben die Kündigung ${wunschDe ? `zum ${wunschDe}` : "zum nächstmöglichen Zeitpunkt"} erklärt${paket ? ` — für Ihren Vertrag ${htmlSicher(paket)}` : ""}.`,
    erklaerung_text: `Kündigung von ${htmlSicher(String(ein.name).trim().slice(0, 120))}${grund ? `, Grund: „${htmlSicher(grund)}“` : ""}`,
    antrag_nr: String(ein.antragNr),
  };
}
