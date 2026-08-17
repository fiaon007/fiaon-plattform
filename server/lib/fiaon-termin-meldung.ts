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
import { absoluteUrl } from "../fiaon-base-url";

type Lauf = typeof sqlPool;

/** Die Quelle im Klartext — der Zuständige soll wissen, woher der Termin kommt. */
const QUELLE_TEXT: Record<string, string> = {
  onboarding_call: "Startgespräch (Pflichttermin nach der Zahlung)",
  onboarding: "Onboarding-Termin",
  nichterreicht_mail: "Rückruf-Termin (zweimal nicht erreicht)",
  agent_manuell: "von dir selbst angelegt",
};

interface Beteiligte {
  agentId: number;
  agentMail: string | null;
  agentVorname: string;
  kunde: string;
  kundeTelefon: string | null;
  ref: string | null;
  personId: number;
}

async function beteiligteZu(terminId: number, lauf: Lauf): Promise<Beteiligte | null> {
  const [r] = (await lauf`
    SELECT t.agent_id, t.person_id,
           ag.email AS agent_mail,
           COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, 'Ohne Namen') AS kunde,
           p.primary_phone AS kunde_telefon,
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
    ref: r.ref ?? null,
    personId: Number(r.person_id),
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

  const wann = `${berlinDatumText(opts.beginn)} um ${berlinUhrzeit(opts.beginn)} Uhr`;
  const akte = b.personId ? absoluteUrl(`/agent/kunden?person=${b.personId}`) : absoluteUrl("/agent/kalender");
  const quelle = QUELLE_TEXT[opts.quelle] ?? opts.quelle;

  const betreff = opts.art === "buchung"
    ? `Neuer Termin: ${b.kunde} — ${wann}`
    : `Termin ABGESAGT: ${b.kunde} — ${wann}`;

  const text = opts.art === "buchung"
    ? `Hallo ${b.agentVorname},\n\n`
      + `${b.kunde} hat sich selbst einen Termin bei dir ausgesucht.\n\n`
      + `Wann: ${wann}\n`
      + `Art: ${quelle}\n`
      + (b.kundeTelefon ? `Telefon: ${b.kundeTelefon}\n` : "")
      + (b.ref ? `Bestellung: ${b.ref}\n` : "")
      + `\nZur Akte: ${akte}\n\n`
      + `Der Termin steht in deinem Kalender und meldet sich 30 Minuten vorher.`
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
                : `Termin abgesagt (${opts.wer ?? "System"}): ${wann}. Der Zuständige wurde benachrichtigt.`})
    `.catch(() => {});
  }

  if (!b.agentMail) return { gemeldet: false, grund: "Der Zuständige hat keine E-Mail-Adresse." };

  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const erg = await eigeneMailSenden({
      an: b.agentMail, name: b.agentVorname, betreff, text,
    });
    if (erg.ok) {
      await opts.lauf`
        UPDATE fiaon_termine
        SET ${opts.lauf.unsafe(opts.art === "buchung" ? "gemeldet_buchung_am" : "gemeldet_absage_am")} = NOW(),
            updated_at = NOW()
        WHERE id = ${opts.terminId}
      `.catch(() => {});
      return { gemeldet: true };
    }
    return { gemeldet: false, grund: erg.grund };
  } catch (err) {
    console.error("[TERMIN-MELDUNG]", err);
    return { gemeldet: false, grund: err instanceof Error ? err.message : String(err) };
  }
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
