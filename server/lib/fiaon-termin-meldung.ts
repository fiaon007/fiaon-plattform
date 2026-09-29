// ═══════════════════════════════════════════════════════════════════════════
// WER EINEN TERMIN HAT, ERFÄHRT DAVON — BEI BUCHUNG UND BEI ABSAGE
//
// ── DER BEFUND (16.08.2026) ────────────────────────────────────────────────
// Ein Kunde bucht über seinen Link eine Uhrzeit. Er bekommt eine Bestätigung.
// Der ZUSTÄNDIGE bekommt: nichts. Es entstand ein Verlaufseintrag in der Akte
// des Kunden — den liest niemand, der nicht ohnehin schon hinsieht.
//
// Umgekehrt genauso: GEMESSEN waren 10 Termine abgesagt, und keine einzige
// Absage wurde jemandem gemeldet. Der Termin verschwand im selben Augenblick
// aus jeder Ansicht (der Kalender filterte auf „gebucht"). Der Zuständige saß
// zur vereinbarten Zeit da und wartete auf jemanden, der abgesagt hatte.
//
// ── WARUM DIREKT ÜBER BREVO UND NICHT ÜBER MAKE ────────────────────────────
// Das ist eine Mail an einen MITARBEITER, kein Kunden-Ereignis. Ein neuer
// Make-Zweig wäre eine weitere Stelle, die der Betreiber pflegen müsste — und
// bis er sie anlegt, käme nichts an. `eigeneMailSenden` geht sofort, mit dem
// FIAON-Rahmen (`rahmen`), und protokolliert sich selbst.
//
// ── DIE MAIL DARF NIE EINEN TERMIN VERHINDERN ──────────────────────────────
// Alles hier wirft nie. Eine Buchung, die daran scheitert, dass ein
// Mailserver hustet, wäre ein verlorener Kunde für eine Benachrichtigung.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinDatumText, berlinUhrzeit } from "./fiaon-termine";

/** „Donnerstag" — Wochentag eines Zeitpunkts in Berlin. */
export function berlinWochentagName(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(d);
}
import { absoluteUrl } from "../fiaon-base-url";

type Lauf = typeof sqlPool;

/** Die Quelle im Klartext — der Zuständige soll wissen, woher der Termin kommt. */
const QUELLE_TEXT: Record<string, string> = {
  onboarding_call: "Startgespräch (Pflichttermin nach der Zahlung)",
  onboarding: "Onboarding-Termin",
  nichterreicht_mail: "Rückruf-Termin (zweimal nicht erreicht)",
  agent_manuell: "Rückruf/Termin, von Hand eingetragen",
  gruender: "Gespräch mit dem Gründer — selbst gebucht über fiaon.com/justin",
  // E-188: Die BUCHUNG eines Global-Gesprächs meldet der Auftrag
  // (fiaon-global-termin.ts), nicht diese Datei — die ABSAGE läuft hier durch.
  global: "FIAON Global – Erstgespräch mit einem Unternehmen (gebucht über fiaon.com/business)",
};

interface Beteiligte {
  agentId: number;
  agentMail: string | null;
  agentVorname: string;
  kunde: string;
  kundeTelefon: string | null;
  /** Was der Kunde beim Buchen als Anliegen hinterlassen hat (05.09.2026). */
  notiz: string | null;
  ref: string | null;
  personId: number;
  /** Der Weg der Buchung (HERKUENFTE) — entscheidet, wie die Mail den Termin beschreibt. */
  herkunft: string | null;
}

async function beteiligteZu(terminId: number, lauf: Lauf): Promise<Beteiligte | null> {
  const [r] = (await lauf`
    SELECT t.agent_id, t.person_id,
           ag.email AS agent_mail,
           COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, 'Ohne Namen') AS kunde,
           p.primary_phone AS kunde_telefon,
           t.notiz, t.herkunft,
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = t.person_id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS ref
    FROM fiaon_termine t
    JOIN fiaon_persons p ON p.id = t.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.id = ${terminId}
  `) as any[];
  if (!r) return null;
  return {
    agentId: Number(r.agent_id),
    agentMail: r.agent_mail ?? null,
    agentVorname: String(r.agent_vorname ?? "du"),
    kunde: String(r.kunde),
    kundeTelefon: r.kunde_telefon ?? null,
    notiz: r.notiz ? String(r.notiz) : null,
    ref: r.ref ?? null,
    personId: Number(r.person_id),
    herkunft: r.herkunft ? String(r.herkunft) : null,
  };
}

/** Die eine Mailform für beide Fälle — damit sie nicht auseinanderlaufen. */
async function melden(opts: {
  terminId: number;
  art: "buchung" | "absage";
  beginn: Date | string;
  quelle: string;
  wer?: string | null;
  lauf: Lauf;
}): Promise<{ gemeldet: boolean; grund?: string }> {
  const b = await beteiligteZu(opts.terminId, opts.lauf);
  if (!b) return { gemeldet: false, grund: "Termin nicht gefunden" };

  // Wochentag dazu (24.09.2026): „24.09.2026 um 12:25 Uhr" allein wird schnell verlesen;
  // mit „Donnerstag" fällt ein verrutschter Tag sofort auf.
  const wann = `${berlinWochentagName(opts.beginn)}, ${berlinDatumText(opts.beginn)} um ${berlinUhrzeit(opts.beginn)} Uhr`;
  // ══════════════════════════════════════════════════════════════════════
  // WER HAT GEBUCHT? (24.09.2026, E-236)
  // Die Mail sagte bei JEDEM Termin „hat sich selbst einen Termin bei dir
  // ausgesucht" — auch, wenn Mara (WhatsApp oder Mail) einen Rückruf
  // vereinbart hatte, und dazu „Art: von dir selbst angelegt". Beides falsch.
  // Justin: „Die Mails mit den Buchungen müssen die Zeiten und alles stimmen."
  // ══════════════════════════════════════════════════════════════════════
  const vonMara = b.herkunft === "mara_whatsapp" || b.herkunft === "mara_mail";
  const kanal = b.herkunft === "mara_mail" ? "E-Mail" : "WhatsApp";
  const einleitung = vonMara
    ? `Mara hat per ${kanal} einen Rückruf mit ${b.kunde} für dich vereinbart. Ruf bitte pünktlich an; was Mara mit dem Kunden besprochen hat, steht unten.`
    : b.herkunft === "mara_whatsapp_link"
      ? `${b.kunde} hat sich über den Terminlink, den Mara per WhatsApp geschickt hat, selbst einen Termin bei dir ausgesucht.`
      : opts.quelle === "agent_manuell"
        ? `Für ${b.kunde} wurde ein Termin bei dir eingetragen.`
        : `${b.kunde} hat sich selbst einen Termin bei dir ausgesucht.`;
  // E-188: Ein Global-Gespräch hängt an einem Firmen-Lead — seine „Akte" ist
  // das Firmen-Cockpit, die Kundenakte wäre für einen Firmenkontakt leer.
  const akte = !b.personId ? absoluteUrl("/agent/kalender")
    : opts.quelle === "global" ? absoluteUrl(`/agent/firmen?person=${b.personId}`)
    : absoluteUrl(`/agent/kunden?person=${b.personId}`);
  const quelle = vonMara ? `Rückruf — von Mara per ${kanal} vereinbart` : (QUELLE_TEXT[opts.quelle] ?? opts.quelle);

  // E-260 (29.09.2026, B8): Mara hat den Termin auf Wunsch des Kunden verlegt —
  // der neue kommt als eigene Buchungsmail. Kein „ABGESAGT", kein „Der Kunde hat
  // einen Link bekommen" (er bekommt keinen: Er hat die neue Zeit ja schon).
  const verschoben = opts.art === "absage" && String(opts.wer ?? "").startsWith("verschoben");
  const betreff = opts.art === "buchung"
    ? `Neuer Termin${vonMara ? " (von Mara)" : ""}: ${b.kunde} — ${wann}`
    : verschoben ? `Termin verschoben (Mara): ${b.kunde} — war ${wann}` : `Termin ABGESAGT: ${b.kunde} — ${wann}`;

  const text = verschoben
    ? `Hallo ${b.agentVorname},\n\n`
      + `Mara hat den Termin mit ${b.kunde} auf Wunsch des Kunden verschoben.\n\n`
      + `Der alte Termin war: ${wann}\n`
      + `Die neue Zeit kommt als eigene Mail „Neuer Termin (von Mara)“ — dort steht auch, wer anruft.\n`
      + `\nZur Akte: ${akte}\n`
    : opts.art === "buchung"
    ? `Hallo ${b.agentVorname},\n\n`
      + `${einleitung}\n\n`
      + `Wann: ${wann}\n`
      + `Art: ${quelle}\n`
      + (b.kundeTelefon ? `Telefon: ${b.kundeTelefon}\n` : "")
      + (b.ref ? `Bestellung: ${b.ref}\n` : "")
      + (b.notiz ? `\n${vonMara ? "Worum es geht" : "Anliegen"}:\n${b.notiz}\n` : "")
      + `\nZur Akte: ${akte}\n\n`
      // E-263: „in deinem Kalender" stand direkt über den Knöpfen „In Apple-/Outlook-Kalender" — gemeint ist das Portal.
      + `Der Termin steht im FIAON-Calendar (Portal) und meldet sich dort 30 Minuten vorher.`
    : `Hallo ${b.agentVorname},\n\n`
      + `${b.kunde} hat den Termin ABGESAGT${opts.wer === "kunde" ? "" : ` (${opts.wer ?? "System"})`}.\n\n`
      + `Der Termin war: ${wann}\n`
      + `Art: ${quelle}\n`
      + (b.kundeTelefon ? `Telefon: ${b.kundeTelefon}\n` : "")
      + `\nZur Akte: ${akte}\n\n`
      + `Die Zeit ist bei dir wieder frei. Der Kunde hat einen Link bekommen, `
      + `um neu zu buchen — wenn er sich nicht meldet, ruf ihn an.`;

  // Der Verlaufseintrag steht IMMER, auch wenn die Mail scheitert. Sonst
  // verschwindet die Absage doppelt: erst aus der Ansicht, dann aus der Akte.
  if (b.ref) {
    await opts.lauf`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${b.personId}, ${b.ref}, NULL, 'System', 'system',
              ${opts.art === "buchung"
                ? `Termin gebucht: ${wann} (${quelle}). Der Zuständige wurde benachrichtigt.`
                : verschoben ? `Termin ${wann} von Mara auf Wunsch des Kunden verschoben. Der Zuständige wurde benachrichtigt.`
                : `Termin abgesagt (${opts.wer ?? "System"}): ${wann}. Der Zuständige wurde benachrichtigt.`})
    `.catch((e) => console.error(`[TERMIN-MELDUNG] Verlaufseintrag (${opts.art}) fuer Termin ${opts.terminId} nicht geschrieben — die Akte kennt die Meldung nicht:`, e));
  }

  if (!b.agentMail) return { gemeldet: false, grund: "Der Zuständige hat keine E-Mail-Adresse." };

  // E-263 (29.09.2026): die Kalender-Knöpfe. Wirft nie — ohne Links geht die Mail wie vorher raus.
  const kalender = await kalenderTeile(opts.terminId, b.agentId, opts.art, opts.lauf).catch((e) => {
    console.error(`[TERMIN-MELDUNG] Kalender-Knöpfe fuer Termin ${opts.terminId} nicht gebaut — die Mail geht ohne sie:`, String(e?.message ?? e).slice(0, 160));
    return null;
  });

  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const erg = await eigeneMailSenden({
      an: b.agentMail, name: b.agentVorname, betreff, text,
      ...(kalender ?? {}),
    });
    if (erg.ok) {
      await opts.lauf`
        UPDATE fiaon_termine
        SET ${opts.lauf.unsafe(opts.art === "buchung" ? "gemeldet_buchung_am" : "gemeldet_absage_am")} = NOW(),
            updated_at = NOW()
        WHERE id = ${opts.terminId}
      `.catch((e) => console.error(`[TERMIN-MELDUNG] Merker fuer Termin ${opts.terminId} nicht gesetzt — die Meldung geht beim naechsten Lauf ERNEUT raus:`, e));
      return { gemeldet: true };
    }
    return { gemeldet: false, grund: erg.grund };
  } catch (err) {
    console.error("[TERMIN-MELDUNG]", err);
    return { gemeldet: false, grund: err instanceof Error ? err.message : String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KALENDER-KNÖPFE (29.09.2026, E-263)
//
// Justin: „wenn ich so ne Email bekomme von FIAON (Termin-Mail) dann muss ich
// die auch mit 1 Klick in mein Google oder Apple Kalender hinzufügen können."
//   Buchung  OHNE laufendes Abo:
//            · „In Apple-/Outlook-Kalender" (Einzeldatei, UID termin-<id>)
//            · „In Google Kalender" (Vorlagenlink, ohne Kundennamen)
//            · „Alle meine Termine automatisch in den Kalender" (Abo-Seite, leise)
//            MIT laufendem eigenem Abo (Abruf < 48 h): KEINE Einzelknöpfe — der Termin
//            kommt von selbst, und ein Klick legte ihn in einem zweiten Kalender ein
//            zweites Mal an (Gegenprüfung 29.09.2026: Apple und Google führen über
//            Kalendergrenzen nichts zusammen). Nur der Satz und leise die Abo-Seite.
//   Absage   · „Aus dem Kalender entfernen" — derselbe Einzel-Link liefert für einen
//            abgesagten Termin METHOD:CANCEL. Google löscht man von Hand. Mit Abo leise
//            („nur, falls du ihn zusätzlich selbst eingetragen hattest").
// ═══════════════════════════════════════════════════════════════════════════
async function kalenderTeile(
  terminId: number, agentId: number, art: "buchung" | "absage", lauf: Lauf,
): Promise<{ knoepfe: { text: string; url: string; leise?: boolean }[]; hinweis?: string; knopfFuss?: string } | null> {
  const k = await import("./fiaon-kalender-abo");
  const { KALENDER_TEXT } = await import("../../shared/fiaon-kalender-abo");
  const [t] = (await lauf`
    SELECT id, agent_id, person_id, quelle, beginn, COALESCE(dauer_min, 20) AS dauer FROM fiaon_termine WHERE id = ${terminId}`) as any[];
  if (!t) return null;
  const einzel = k.einzelLink(Number(t.id), Number(t.agent_id));
  // Das Abo ist Zugabe: Fehlt die Tabelle (vor Migration 085) oder hakt die Abfrage, bleiben die Einzelknöpfe.
  let aktiv = false;
  let aboSeite: string | null = null;
  try {
    aktiv = await k.aboAktiv(agentId, lauf);
    const abo = art === "buchung" ? await k.aboHolen(agentId, "eigene", "Termin-Mail", lauf) : null;
    aboSeite = abo ? k.aboLinks(abo).seite : null;
  } catch (e) {
    console.error(`[TERMIN-MELDUNG] Kalender-Abo fuer Agent ${agentId} nicht lesbar:`, String((e as Error)?.message ?? e).slice(0, 160));
  }
  if (art === "buchung") {
    if (aktiv) {
      return {
        hinweis: KALENDER_TEXT.mailAktiv,
        knoepfe: aboSeite ? [{ text: "Mein Kalender-Abo ansehen", url: aboSeite, leise: true }] : [],
      };
    }
    return {
      knoepfe: [
        { text: "In Apple-/Outlook-Kalender", url: einzel },
        { text: "In Google Kalender", url: k.googleTerminLink({ person_id: Number(t.person_id), quelle: String(t.quelle ?? ""), beginn: t.beginn, dauer: Number(t.dauer) }) },
        ...(aboSeite ? [{ text: "Alle meine Termine automatisch in den Kalender", url: aboSeite, leise: true }] : []),
      ],
      // Der Abo-Satz nur, wenn es den Abo-Knopf auch gibt (vor Migration 085 oder bei einem Lesefehler fehlt er).
      knopfFuss: aboSeite
        ? `${KALENDER_TEXT.googleEinmal} Richtest du das Abo ein („Alle meine Termine …“), kommen alle Termine von selbst — `
          + "dann die beiden Knöpfe für diesen Termin nicht mehr nutzen, sonst steht er doppelt."
        : KALENDER_TEXT.googleEinmal,
    };
  }
  if (aktiv) {
    return {
      hinweis: "Dein Kalender-Abo nimmt den Termin von selbst heraus. Nur falls du ihn zusätzlich selbst eingetragen hattest:",
      knoepfe: [{ text: "Aus dem Kalender entfernen (Apple/Outlook)", url: einzel, leise: true }],
      knopfFuss: "Über Google eingetragen? Dann dort bitte von Hand löschen.",
    };
  }
  return {
    knoepfe: [{ text: "Aus dem Kalender entfernen (Apple/Outlook)", url: einzel }],
    knopfFuss: "Hast du ihn über Google eingetragen, lösch ihn dort bitte von Hand.",
  };
}

/** Ein Kunde hat gebucht — der Zuständige erfährt es sofort. */
export async function buchungMelden(
  terminId: number, beginn: Date | string, quelle: string, lauf: Lauf = sqlPool,
): Promise<{ gemeldet: boolean; grund?: string }> {
  return melden({ terminId, art: "buchung", beginn, quelle, lauf });
}

/** Ein Termin wurde abgesagt — der Zuständige erfährt es sofort. */
export async function absageMelden(
  terminId: number, beginn: Date | string, quelle: string,
  wer: string | null, lauf: Lauf = sqlPool,
): Promise<{ gemeldet: boolean; grund?: string }> {
  return melden({ terminId, art: "absage", beginn, quelle, wer, lauf });
}
