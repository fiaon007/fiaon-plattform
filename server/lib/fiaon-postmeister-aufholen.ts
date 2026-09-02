// ═══════════════════════════════════════════════════════════════════════════
// DER AUFHOL-LAUF — alle Postfächer, von Anfang an (02.09.2026, E-094)
//
// JUSTIN: „das gesamte Postfach (ALLE) müssen gescannt werden, die, was nie
// eine Antwort erhalten haben erhalten eine […] Und das ALLE Nachrichten von
// Anfang bis ende."
//
// DER BEFUND: In support@ liegen 1.254 Kundenmails, drei wurden je beantwortet.
// In welcome@ 2.363. Der alte Takt sah nur die letzten zwei Tage und nur die
// erste Seite von 100 Treffern.
//
// ZWEI PHASEN, damit nichts überstürzt wird:
//   1 ORDNEN  — jede Nachricht einlesen, einordnen, in der Akte nachtragen.
//               Keine Antwort. Läuft über den ganzen Bestand.
//   2 ANTWORTEN — nur für Unterhaltungen, in denen der Kunde zuletzt schrieb
//               und wir nie geantwortet haben. Jüngste zuerst (dort ist die
//               Chance am größten), gedeckelt, mit Nachtruhe.
//
// WAS ALS „BEANTWORTET" GILT: eine Nachricht von uns NACH der letzten
// Kundennachricht — aus Gmail (gesendet oder Auto-Antwort) ODER aus unserer
// eigenen Mailhistorie. Serienmails zählen dabei NICHT: Eine Mahnung, die nach
// der Kundenfrage rausging, ist keine Antwort auf sie.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { nachrichtenSuchen, nachrichtLesen } from "./fiaon-gmail";
import { mailBearbeiten, istFremdpost } from "./fiaon-postmeister-lauf";
import { postmeisterSchema } from "./fiaon-postmeister-schema";

/** Serienmails — sie beantworten nie eine Kundenfrage. */
const KEINE_ANTWORT = [
  "payment_reminder", "abo_payment_reminder", "lead_followup", "sepa_einrichten",
  "bankverbindung_neu", "rueckhol_s1", "rueckhol_s2", "rueckhol_s3", "rueckhol_s4", "rueckhol_s5",
  "termin_erinnerung", "abo_rate_faellig", "welcome", "onboarding_einladung",
];

function berlinStunde(): number {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(t.find((p) => p.type === "hour")?.value);
  return Number.isFinite(h) ? h % 24 : -1; // im Zweifel Nachtruhe
}

/**
 * Eine Zahl aus den Einstellungen — mit der Vorgabe, wenn nichts dasteht.
 *
 * 02.09.2026, bei der Abnahme gefunden: Fehlte der Schlüssel, kam nicht die
 * Vorgabe heraus, sondern NULL. Denn `String(undefined ?? "")` ist der leere
 * Text, `Number("")` ist 0, und `Number.isFinite(0)` ist wahr — die Vorgabe
 * wurde nie erreicht.
 *
 * Die Folge war still und vollständig: Der Rückstands-Takt bekam Deckel 0 und
 * arbeitete nie, obwohl in der Historie „erfolg" stand. Dasselbe galt für den
 * Aufruf von Hand und für das Ordnen. Eine Bremse, die niemand angezogen hat,
 * stand fest — und man sah es nicht, weil nichts scheiterte.
 *
 * Jetzt gilt: leerer Text = nicht gesetzt = Vorgabe. Eine ausdrücklich
 * geschriebene 0 bleibt eine 0, damit das Abschalten weiter möglich ist.
 */
async function einstellung(schluessel: string, vorgabe: number): Promise<number> {
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel} LIMIT 1`) as any[];
    const roh = String(r?.value ?? "").trim();
    if (roh === "") return vorgabe;
    const n = Number(roh);
    return Number.isFinite(n) ? n : vorgabe;
  } catch { return vorgabe; }
}

export interface AufholStand {
  phase: "ordnen" | "antworten";
  postfach: string;
  gesehen: number;
  neu: number;
  beantwortet: number;
  uebersprungen: Record<string, number>;
  fertig: boolean;
}

/**
 * PHASE 1 — ordnen. Liest ein Zeitfenster, legt jede Nachricht an, ordnet ein
 * und trägt sie in der Akte nach. Antwortet nie.
 */
export async function phaseOrdnen(ein: {
  postfach: string; gruss: string; tageZurueck: number; deckel: number;
}): Promise<AufholStand> {
  await postmeisterSchema();
  const stand: AufholStand = { phase: "ordnen", postfach: ein.postfach, gesehen: 0, neu: 0, beantwortet: 0, uebersprungen: {}, fertig: false };
  const q = `in:anywhere newer_than:${Math.max(1, Math.min(3650, ein.tageZurueck))}d -in:sent -in:draft`;

  const alle: string[] = [];
  let seite: string | null = null;
  for (let s = 0; s < 15; s++) {
    const r: any = await nachrichtenSuchen(ein.postfach, q, 100, seite);
    alle.push(...(r?.ids ?? []));
    seite = r?.nextPageToken ?? null;
    if (!seite) { stand.fertig = true; break; }
    if (alle.length >= 1500) break;
  }
  stand.gesehen = alle.length;
  if (!alle.length) { stand.fertig = true; return stand; }

  const bekannt = new Set(((await sqlPool`
    SELECT gmail_id FROM fiaon_postmeister WHERE gmail_id = ANY(${alle}) AND aktion NOT IN ('fehler', 'in_arbeit')
  `) as any[]).map((r) => String(r.gmail_id)));
  const offen = alle.filter((id) => !bekannt.has(id)).slice(0, ein.deckel);

  for (const id of offen) {
    const erg = await mailBearbeiten({ postfach: ein.postfach, gmailId: id, gruss: ein.gruss, modus: "entwurf", nurOrdnen: true });
    stand.neu += 1;
    stand.uebersprungen[erg.aktion] = (stand.uebersprungen[erg.aktion] || 0) + 1;
  }
  return stand;
}

/**
 * Wer wartet noch auf eine Antwort? Aus den geordneten Zeilen: die letzte
 * Nachricht je Unterhaltung, wenn wir dort nie geantwortet haben.
 */
export async function offeneUnterhaltungen(grenze = 200): Promise<any[]> {
  return (await sqlPool`
    WITH letzte AS (
      SELECT DISTINCT ON (thread_id) id, thread_id, postfach, gmail_id, von, betreff,
             empfangen_am, person_id, ref, aktion, kategorie
        FROM fiaon_postmeister
       WHERE aktion IN ('vorgeordnet', 'geordnet')
       ORDER BY thread_id, empfangen_am DESC
    )
    SELECT l.*,
           (SELECT COUNT(*) FROM fiaon_postmeister x
             WHERE x.thread_id = l.thread_id AND (x.gesendet_am IS NOT NULL OR x.aktion = 'auto_beantwortet'))::int AS eigene,
           (SELECT COUNT(*) FROM fiaon_mail_log m
             WHERE m.person_id = l.person_id AND m.created_at > l.empfangen_am
               AND m.status = 'versandt' AND NOT (m.event = ANY(${KEINE_ANTWORT})))::int AS echte_mails,
           a.payment_status, a.gekuendigt_am
      FROM letzte l
      LEFT JOIN fiaon_applications a ON a.ref = l.ref
     WHERE l.kategorie IS DISTINCT FROM 'werbung_newsletter'
     ORDER BY
       -- Nach Ertrag: wer Geld melden will oder offen hat, zuerst; dann nach Alter.
       CASE
         WHEN a.payment_status = 'claimed_paid' THEN 1
         WHEN a.payment_status = 'pending_payment' THEN 2
         WHEN a.gekuendigt_am IS NOT NULL THEN 3
         WHEN a.payment_status = 'paid' THEN 4
         ELSE 5
       END,
       l.empfangen_am DESC
     LIMIT ${grenze}
  `) as any[];
}

/**
 * PHASE 2 — antworten. Nur Unterhaltungen ohne eigene Antwort, jüngste zuerst,
 * mit Deckel und Nachtruhe. Jede Antwort wird ein Entwurf.
 */
export async function phaseAntworten(ein: { deckel: number; gruesse: Record<string, string> }): Promise<{
  bearbeitet: number; entwuerfe: number; uebersprungen: Record<string, number>;
}> {
  await postmeisterSchema();
  const stunde = berlinStunde();
  if (stunde < 8 || stunde >= 20) return { bearbeitet: 0, entwuerfe: 0, uebersprungen: { nachtruhe: 1 } };

  const kandidaten = await offeneUnterhaltungen(ein.deckel * 3);
  const uebersprungen: Record<string, number> = {};
  let bearbeitet = 0, entwuerfe = 0;

  for (const k of kandidaten) {
    if (bearbeitet >= ein.deckel) break;
    if (Number(k.eigene) > 0) { uebersprungen.schon_beantwortet = (uebersprungen.schon_beantwortet || 0) + 1; continue; }
    if (Number(k.echte_mails) > 0) { uebersprungen.mail_nach_der_frage = (uebersprungen.mail_nach_der_frage || 0) + 1; continue; }

    // Fremdpost noch einmal prüfen — die alte Fassung kannte den Filter nicht.
    try {
      const mail = await nachrichtLesen(k.postfach, k.gmail_id);
      const fremd = istFremdpost(mail);
      if (fremd.fremd) {
        await sqlPool`UPDATE fiaon_postmeister SET aktion = 'ignoriert', begruendung = ${fremd.grund} WHERE id = ${k.id}`;
        uebersprungen.kein_kunde = (uebersprungen.kein_kunde || 0) + 1;
        continue;
      }
    } catch { /* Nachricht weg — dann eben ohne Vorprüfung */ }

    // Zeile wieder freigeben, damit der Lauf sie neu bearbeitet.
    await sqlPool`UPDATE fiaon_postmeister SET aktion = 'vorgeordnet', versuche = 0 WHERE id = ${k.id}`;
    const gruss = ein.gruesse[k.postfach] ?? "Freundliche Grüße\nIhr FIAON-Team";
    const erg = await mailBearbeiten({ postfach: k.postfach, gmailId: k.gmail_id, gruss, modus: "entwurf" });
    bearbeitet += 1;
    if (erg.aktion === "entwurf") entwuerfe += 1;
    uebersprungen[erg.aktion] = (uebersprungen[erg.aktion] || 0) + 1;
  }
  return { bearbeitet, entwuerfe, uebersprungen };
}

/** Deckel aus den Einstellungen, damit Justin die Geschwindigkeit steuert. */
export async function aufholDeckel(): Promise<{ ordnen: number; antworten: number }> {
  return {
    ordnen: await einstellung("postmeister_aufhol_ordnen", 60),
    antworten: await einstellung("postmeister_aufhol_antworten", 20),
  };
}

/**
 * Die alten Entwürfe aus der ersten Fassung prüfen. Sie wurden ohne Wand und
 * ohne Belegpflicht erzeugt; einer trug am 02.09. noch die gesperrte IBAN.
 */
export async function altentwuerfePruefen(schreiben: boolean, alleVerwerfen = false): Promise<{
  geprueft: number; verworfen: number; behalten: number; gruende: Record<string, number>;
}> {
  const { wandPruefen } = await import("@shared/fiaon-wortverbote");
  const zeilen = (await sqlPool`
    SELECT id, postfach, von, antwort, antwort_draft_id, belege
      FROM fiaon_postmeister
     WHERE aktion = 'entwurf' AND antwort IS NOT NULL AND belege IS NULL
     ORDER BY id ASC LIMIT 200
  `) as any[];
  const gruende: Record<string, number> = {};
  let verworfen = 0;
  for (const z of zeilen) {
    // Ohne Belege gab es keine Werkzeuge — jede Zusage ist ungedeckt.
    const treffer = wandPruefen(String(z.antwort ?? ""), []).filter((t) => t.art !== "floskel");
    // ── WARUM ES EIN `alleVerwerfen` GIBT (02.09.2026) ──────────────────────
    // Am 02.09. stellte sich heraus: Der neue Agent hatte NIE eine Antwort
    // erzeugt (die API lehnte Werkzeuge mit Denkleistung ab). Alle 73 Entwürfe
    // im Postfach stammten also aus der ersten Fassung — ohne Werkzeuge, ohne
    // Belegpflicht, ohne HTML, und 25 davon existierten nicht einmal als
    // Gmail-Entwurf. Sie einzeln auf Wortverstöße zu prüfen greift zu kurz:
    // Auch ein sprachlich sauberer Entwurf dieser Fassung ist ungedeckt.
    // Zudem erreicht der Aufhol-Lauf sie nie wieder — `offeneUnterhaltungen`
    // sucht nur 'vorgeordnet' und 'geordnet'. Sie lägen für immer.
    const grund = alleVerwerfen && !treffer.length
      ? "Alt-Entwurf ohne Belege (erste Fassung, ungedeckt)"
      : treffer.length ? `Alt-Entwurf verworfen (${treffer.map((t) => t.treffer).slice(0, 2).join("; ")})` : "";
    if (!grund) continue;
    const schluessel = treffer.length ? treffer[0].treffer.slice(0, 40) : "ohne Belege";
    gruende[schluessel] = (gruende[schluessel] || 0) + 1;
    verworfen += 1;
    if (schreiben) {
      // 'geordnet' statt 'entwurf': Damit wird die Unterhaltung wieder zu einer
      // offenen, und der Aufhol-Lauf schreibt eine neue Antwort — diesmal mit
      // Werkzeugen, Belegen und im Haus-HTML.
      await sqlPool`
        UPDATE fiaon_postmeister
           SET aktion = 'geordnet', antwort = NULL, antwort_draft_id = NULL,
               begruendung = ${grund}, updated_at = NOW()
         WHERE id = ${z.id}
      `;
      if (z.antwort_draft_id) {
        const { entwurfLoeschen } = await import("./fiaon-gmail");
        await entwurfLoeschen(z.postfach, z.antwort_draft_id).catch(() => {});
      }
    }
  }
  return { geprueft: zeilen.length, verworfen, behalten: zeilen.length - verworfen, gruende };
}
