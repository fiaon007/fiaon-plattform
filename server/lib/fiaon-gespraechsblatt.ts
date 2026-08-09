// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHSBLATT — was ich über diesen Menschen wissen muss, bevor es klingelt
//
// Ein Agent hat vor dem Anruf zwei Möglichkeiten: die Akte lesen (zwei
// Minuten, wenn er weiß wo) oder blind wählen. Meistens wird blind gewählt.
//
// Das Blatt ist der dritte Weg: ein Klick, fünf Sekunden lesen.
//
// ── WAS DIE KI TUT UND WAS NICHT ───────────────────────────────────────────
// Die Fakten (Profil, Aufhänger, nächste Aktion) baut der SERVER aus der
// Datenbank — deterministisch, ohne Modell. Da gibt es nichts zu formulieren
// und nichts zu erfinden.
//
// Die KI bekommt genau EINE Aufgabe: die letzten zwanzig Verlaufseinträge zu
// vier bis sechs Sätzen verdichten. Das ist Textarbeit, dafür ist sie gut.
// Fällt sie aus, steht das Blatt trotzdem — nur die Verdichtung fehlt.
//
// Die Einwand-Hilfen wählt sie aus einer kuratierten Datei aus
// (fiaon-einwaende.ts). Sie formuliert sie nicht.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { entschaerfen } from "./fiaon-mail-ki";
import { einwaendeFuer, type Einwand } from "./fiaon-einwaende";
import { statusAusTierGrund, stufeAusTier } from "../../shared/fiaon-kundenstatus";

type Lauf = typeof sqlPool;

export const FUSSSATZ = "Automatisch erstellt — prüfe Fakten im Zweifel in der Akte.";

export interface Gespraechsblatt {
  personId: number;
  profil: { zeile: string; werte: { was: string; wert: string }[] };
  aufhaenger: string[];
  historie: string;
  historieHerkunft: "ki" | "roh" | "leer";
  naechsteAktion: { titel: string; warum: string };
  einwaende: Einwand[];
  fussSatz: string;
  erstelltAm: string;
  ausCache: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Cache
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kurzer Zwischenspeicher gegen Doppelklicks.
 *
 * 60 Sekunden: lang genug, dass ein zweiter Klick nichts kostet, kurz genug,
 * dass ein gerade dokumentiertes Ergebnis im nächsten Blatt steht.
 */
const CACHE_MS = 60_000;
const cache = new Map<number, { blatt: Gespraechsblatt; bis: number }>();

// ───────────────────────────────────────────────────────────────────────────

function alterAus(geburt: unknown): number | null {
  const s = String(geburt ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const g = new Date(s.slice(0, 10));
  const heute = new Date();
  let a = heute.getFullYear() - g.getFullYear();
  const m = heute.getMonth() - g.getMonth();
  if (m < 0 || (m === 0 && heute.getDate() < g.getDate())) a--;
  return a > 0 && a < 120 ? a : null;
}

function tageBisGeburtstag(geburt: unknown): number | null {
  const s = String(geburt ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const heute = new Date();
  const g = new Date(s.slice(0, 10));
  const naechster = new Date(heute.getFullYear(), g.getMonth(), g.getDate());
  if (naechster < heute) naechster.setFullYear(heute.getFullYear() + 1);
  return Math.ceil((naechster.getTime() - heute.getTime()) / 86_400_000);
}

const SYSTEM_HISTORIE = `Du verdichtest den Gesprächsverlauf mit einem Kunden zu 4 bis 6 Sätzen für den Mitarbeiter, der gleich anruft.

DU BESCHREIBST NUR, WAS IN DEN EINTRÄGEN STEHT. Nichts hinzufügen, nichts vermuten.

Beantworte in dieser Reihenfolge, soweit die Einträge es hergeben:
- Was wurde bisher besprochen?
- Welche Einwände kamen?
- Welche Zusagen wurden gemacht und wurden sie gehalten?
- Was ist offen geblieben?

VERBOTEN:
- Bewertungen der Person ("schwieriger Kunde", "wirkt unentschlossen")
- Empfehlungen oder Handlungsanweisungen
- Aussagen zu Limits, Bewilligungen, Kreditzusagen
- Die Wörter Beratung, Berater, beraten
- Details, die nicht in den Einträgen stehen

Wenn die Einträge nichts Inhaltliches hergeben (nur Systemmeldungen, nur Fehlversuche), schreibe genau: "Bisher kein inhaltliches Gespräch dokumentiert."

Antworte NUR mit dem Text, ohne Aufzählungszeichen und ohne Vorrede.`;

async function historieVerdichten(eintraege: string[]): Promise<{ text: string; herkunft: "ki" | "roh" | "leer" }> {
  if (eintraege.length === 0) return { text: "Bisher ist zu dieser Person nichts dokumentiert.", herkunft: "leer" };
  if (!process.env.OPENAI_API_KEY) {
    // Ohne Modell die letzten fünf im Original — besser als nichts, und
    // ehrlich gekennzeichnet.
    return { text: eintraege.slice(0, 5).join("\n"), herkunft: "roh" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_HISTORIE },
          { role: "user", content: eintraege.join("\n").slice(0, 8000) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { text: eintraege.slice(0, 5).join("\n"), herkunft: "roh" };
    const json = (await res.json()) as any;
    const roh = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!roh) return { text: eintraege.slice(0, 5).join("\n"), herkunft: "roh" };
    return { text: entschaerfen(roh).text, herkunft: "ki" };
  } catch {
    return { text: eintraege.slice(0, 5).join("\n"), herkunft: "roh" };
  }
}

/**
 * Das Blatt bauen.
 *
 * Liest ausdrücklich KEINE Dokumentinhalte (BYTEA) und keine fremden Kunden —
 * die Eingabe ans Modell ist auf das Nötige beschnitten.
 */
export async function gespraechsblatt(
  personId: number, lauf: Lauf = sqlPool,
): Promise<Gespraechsblatt | null> {
  const treffer = cache.get(personId);
  if (treffer && treffer.bis > Date.now()) return { ...treffer.blatt, ausCache: true };

  const [p] = (await lauf`
    SELECT p.id, p.first_name, p.last_name, p.company_name, p.contact_name, p.birthdate,
           p.city, p.zip, p.priority_tier, p.tier_reason, p.promised_payment_date,
           p.follow_up_date, p.unreachable_count, p.first_source, p.first_campaign,
           p.created_at, p.betreuung_seit, p.primary_phone,
           COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent,
           (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS ref,
           (SELECT a.payment_reference FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS zahlungsreferenz,
           (SELECT SPLIT_PART(a.pack_name, E'\\n', 1) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.pack_name IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS paket,
           (SELECT a.amount_due FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS betrag,
           (SELECT COUNT(*)::int FROM fiaon_applications a WHERE a.person_id = p.id
             AND a.merged_into IS NULL AND a.documents_uploaded_at IS NOT NULL) AS mit_unterlagen,
           (SELECT COUNT(*)::int FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'verpasst') AS verpasst,
           (SELECT MIN(t.beginn) FROM fiaon_termine t WHERE t.person_id = p.id
             AND t.status = 'gebucht' AND t.beginn > NOW()) AS naechster_termin
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!p) return null;

  const name = String(
    [p.first_name, p.last_name].filter(Boolean).join(" ") || p.company_name || p.contact_name || `Person ${p.id}`,
  ).trim();
  const status = statusAusTierGrund(p.tier_reason);
  const stufe = stufeAusTier(p.priority_tier);
  const alter = alterAus(p.birthdate);

  // ── Kurzprofil ──────────────────────────────────────────────────────────
  const werte: { was: string; wert: string }[] = [
    { was: "Stufe", wert: stufe ? `${stufe.marke} — ${stufe.text}` : "—" },
    { was: "Status", wert: status.anzeige },
    { was: "Produkt", wert: String(p.paket || "—") },
    { was: "Betrag", wert: p.betrag != null ? `${Number(p.betrag).toFixed(2).replace(".", ",")} €` : "—" },
    // Der Verwendungszweck ist das Feld, nach dem am Telefon am häufigsten
    // gefragt wird — er gehört ins Kurzprofil, nicht drei Klicks tiefer.
    { was: "Verwendungszweck", wert: String(p.zahlungsreferenz || "—") },
    { was: "Zuständig", wert: String(p.agent || "niemand") },
  ];
  const profilZeile = [
    name,
    alter ? `${alter} Jahre` : null,
    p.city ? String(p.city) : null,
  ].filter(Boolean).join(" · ");

  // ── Aufhänger: nur echte Fakten ─────────────────────────────────────────
  const aufhaenger: string[] = [];
  const bisGeburtstag = tageBisGeburtstag(p.birthdate);
  if (bisGeburtstag != null && bisGeburtstag <= 14) {
    aufhaenger.push(bisGeburtstag === 0
      ? "Hat heute Geburtstag."
      : `Geburtstag in ${bisGeburtstag} ${bisGeburtstag === 1 ? "Tag" : "Tagen"}.`);
  }
  if (p.first_campaign) aufhaenger.push(`Kam über die Kampagne „${p.first_campaign}".`);
  else if (p.first_source) aufhaenger.push(`Kam über ${p.first_source}.`);
  if (p.created_at) {
    const tage = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000);
    if (tage > 30) aufhaenger.push(`Seit ${Math.round(tage / 30)} Monaten im Bestand.`);
    else aufhaenger.push(`Seit ${tage} Tagen im Bestand.`);
  }
  if (p.naechster_termin) {
    aufhaenger.push(`Hat einen gebuchten Termin am ${new Date(p.naechster_termin)
      .toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Uhr.`);
  }
  if (Number(p.verpasst) > 0) {
    aufhaenger.push(`${p.verpasst} vereinbarte${Number(p.verpasst) === 1 ? "r Termin" : " Termine"} nicht wahrgenommen.`);
  }
  if (Number(p.unreachable_count) >= 2) {
    aufhaenger.push(`${p.unreachable_count} erfolglose Anrufversuche bisher.`);
  }
  if (p.promised_payment_date) {
    aufhaenger.push(`Hat Zahlung für den ${new Date(p.promised_payment_date)
      .toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} zugesagt.`);
  }

  // ── Historie ────────────────────────────────────────────────────────────
  const eintraege = (await lauf`
    SELECT cl.created_at, cl.type, cl.outcome, cl.note, cl.agent_name
    FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
    WHERE a.person_id = ${personId}
    ORDER BY cl.created_at DESC LIMIT 20
  `) as any[];
  const anrufNotizen = (await lauf`
    SELECT zusammenfassung, beginn FROM fiaon_calls
    WHERE person_id = ${personId} AND zusammenfassung IS NOT NULL
    ORDER BY beginn DESC LIMIT 5
  `) as any[];

  const roh = [
    ...anrufNotizen.map((c) => `${new Date(c.beginn).toLocaleDateString("de-DE")} Anruf: ${c.zusammenfassung}`),
    ...eintraege
      .filter((e) => e.note || e.outcome)
      .map((e) => `${new Date(e.created_at).toLocaleDateString("de-DE")} ${e.outcome || e.type}: ${String(e.note || "").slice(0, 300)}`),
  ];
  const historie = await historieVerdichten(roh);

  // ── Nächste beste Aktion ────────────────────────────────────────────────
  // Aus dem Zustand abgeleitet, nicht geraten.
  let aktion = { titel: "Zuhören, was er braucht", warum: "Kein besonderer Zustand — offenes Gespräch." };
  if (Number(p.priority_tier) === 1) {
    aktion = {
      titel: "Zahlungsbeleg anfordern",
      warum: "Der Kunde hat gezahlt gemeldet, das Geld ist nicht gebucht. Mit Beleg schaltest du sofort frei.",
    };
  } else if (Number(p.verpasst) > 0 && !p.naechster_termin) {
    aktion = { titel: "Neuen Termin anbieten", warum: "Ein vereinbarter Termin ist geplatzt — ein neuer ist verbindlicher als ein Rückruf irgendwann." };
  } else if (Number(p.mit_unterlagen) === 0 && Number(p.priority_tier) <= 2) {
    aktion = { titel: "An die Unterlagen erinnern", warum: "Ohne Ausweis und Kontoauszug kann die Prüfung nicht starten." };
  } else if (Number(p.priority_tier) === 2) {
    aktion = { titel: "Zahlungsdaten senden", warum: "Antrag fertig, Rechnung offen — häufig fehlt schlicht der Verwendungszweck." };
  } else if (Number(p.priority_tier) === 3) {
    aktion = { titel: "Zum Antrag führen", warum: "Lead ohne Antrag — der Link geht in einer Minute raus." };
  } else if (Number(p.unreachable_count) >= 2) {
    aktion = { titel: "Terminlink schicken", warum: "Mehrfach nicht erreicht — lass ihn selbst eine Uhrzeit wählen." };
  }

  const blatt: Gespraechsblatt = {
    personId,
    profil: { zeile: profilZeile, werte },
    aufhaenger,
    historie: historie.text,
    historieHerkunft: historie.herkunft,
    naechsteAktion: aktion,
    einwaende: einwaendeFuer({
      tier: Number(p.priority_tier),
      grund: String(p.tier_reason || ""),
      hatUnterlagen: Number(p.mit_unterlagen) > 0,
      verpassterTermin: Number(p.verpasst) > 0,
    }),
    fussSatz: FUSSSATZ,
    erstelltAm: new Date().toISOString(),
    ausCache: false,
  };

  cache.set(personId, { blatt, bis: Date.now() + CACHE_MS });
  return blatt;
}

/** Nur für den Prüfstand: den Zwischenspeicher leeren. */
export function cacheLeeren(): void { cache.clear(); }
