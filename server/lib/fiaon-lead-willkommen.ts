// ═══════════════════════════════════════════════════════════════════════════
// DIE BEGRÜSSUNG EINES NEUEN LEADS (22.09.2026, E-210)
//
// Der Mensch hat eben ein Formular abgeschickt. Das ist der heißeste Moment,
// den es gibt — GEMESSEN (2.799 Facebook-Leads, 01.07.–02.09.): nur 2 %
// beginnen den Antrag in der ersten Stunde, 69 % nie. Bis heute kam die Antwort
// aus Make: zwei Mails auf einmal (Gmail und Brevo-Vorlage 9), beide mit
// Sätzen, die wir nicht sagen dürfen, und eine davon immer mit „Schönen guten
// Abend". Seit SuperChat weg ist, kam gar nichts mehr.
//
// Jetzt: EINE Mail aus dem Mail-Motor (Vorlage `lead_willkommen`), sofort, mit
// dem persönlichen Link — Name, E-Mail und Telefon stehen im Antrag schon drin.
//
// ── WER SIE NICHT BEKOMMT ──────────────────────────────────────────────────
//   · Schalter aus (`lead_willkommen_an`, Vorgabe AUS) — solange in Make der
//     Brevo-Weg noch läuft, bekäme der Mensch sonst zwei Begrüßungen
//   · ohne E-Mail · Rückläufer · abgemeldet · Testeinträge
//   · wer schon einen FERTIGEN oder bezahlten Antrag hat (der steckt in anderen
//     Strecken; eine Begrüßung wäre falsch)
//   · wer in den letzten 24 Stunden schon begrüßt wurde (zweites Formular)
//   · Leads, die älter als 14 Tage sind (Nachholläufe über lange Zeiträume)
// Nachgeholte Leads (älter als 30 Minuten) bekommen einen ehrlichen Einstieg:
// „Sie hatten sich am … gemeldet — entschuldigen Sie, dass Sie erst jetzt von
// uns hören."
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { anredeMail, nameFuerAnrede } from "../../shared/fiaon-anrede";
import { kurzlinkFuerLead, kurzlinkUrl } from "./fiaon-kurzlink";

type Lauf = typeof sqlPool;

export const WILLKOMMEN_SCHALTER = "lead_willkommen_an";
/** Ab wann ein Lead als „nachgeholt" gilt — dann entschuldigt sich der Einstieg. */
const NACHTRAG_AB_MIN = 30;
/** Älter als das wird nicht mehr begrüßt, sondern nur in die Strecke genommen. */
const HOECHSTENS_TAGE = 14;
const HOECHSTENS_VERSUCHE = 3;

let bereit = false;
export async function willkommenSpalten(lauf: Lauf = sqlPool): Promise<void> {
  if (bereit) return;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS willkommen_am TIMESTAMPTZ`;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS willkommen_status TEXT`;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS willkommen_grund TEXT`;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS willkommen_versuche INTEGER NOT NULL DEFAULT 0`;
  bereit = true;
}

export async function willkommenAn(lauf: Lauf = sqlPool): Promise<boolean> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${WILLKOMMEN_SCHALTER} LIMIT 1`.catch(() => [])) as any[];
  return String(r?.value ?? "0").trim() === "1";
}

/** „A, B und C" */
function aufzaehlen(teile: string[]): string {
  if (teile.length <= 1) return teile.join("");
  return `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
}

const WOCHENTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** „Montag, 21.09." in Berliner Zeit — nie Number(Intl.format()) (Zeit-Falle Berlin-Stunde). */
export function tagText(d: Date): string {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" }).formatToParts(d);
  const wert = (t: string) => teile.find((p) => p.type === t)?.value ?? "";
  const kurz = wert("weekday").replace(".", "");
  const index = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].indexOf(kurz);
  return `${index >= 0 ? WOCHENTAG[index] : kurz}, ${wert("day")}.${wert("month")}.`;
}

export interface WillkommenTexte { anrede: string; betreff: string; einstieg: string }

/** Anrede, Betreff und Einstieg — eine reine Funktion, damit der Prüfstand jeden Fall durchspielt. */
export function willkommenTexte(l: {
  vorname?: string | null; nachname?: string | null; anrede?: string | null;
  email?: string | null; telefonDach?: boolean; erstelltAm?: Date | null; jetzt?: Date;
}): WillkommenTexte {
  const name = nameFuerAnrede({ vorname: l.vorname, nachname: l.nachname, anrede: l.anrede });
  const eingetragen: string[] = [];
  if (name.vorname || name.nachname) eingetragen.push("Ihren Namen");
  if (l.email) eingetragen.push("Ihre E-Mail-Adresse");
  if (l.telefonDach) eingetragen.push("Ihre Telefonnummer");
  const vorbereitet = eingetragen.length
    ? `Ihr Antrag ist schon vorbereitet: ${aufzaehlen(eingetragen)} haben wir für Sie eingetragen.`
    : "Ihr Antrag ist schon für Sie vorbereitet.";
  const jetzt = l.jetzt ?? new Date();
  const nachtrag = l.erstelltAm && (jetzt.getTime() - l.erstelltAm.getTime()) > NACHTRAG_AB_MIN * 60_000;
  const einstieg = nachtrag
    ? `Sie hatten sich am ${tagText(l.erstelltAm!)} bei uns gemeldet — entschuldigen Sie, dass Sie erst jetzt von uns hören. ${vorbereitet}`
    : `Ihre Anfrage ist bei uns angekommen. ${vorbereitet}`;
  return {
    anrede: anredeMail({ vorname: l.vorname, nachname: l.nachname, anrede: l.anrede }),
    betreff: name.vorname ? `${name.vorname}, Ihr Antrag bei FIAON ist vorbereitet` : "Ihr Antrag bei FIAON ist vorbereitet",
    einstieg,
  };
}

export type WillkommenErgebnis = { status: "gesendet" | "uebersprungen" | "fehler"; grund: string };

/**
 * Die Begrüßung für EINEN Lead. Idempotent: Ein zweiter Aufruf für denselben
 * Lead tut nichts. `pruefung` ignoriert den Schalter und schreibt nichts an den
 * Lead — für den Prüfversand aus dem Steuerpult an die Testadresse.
 */
export async function willkommenSenden(
  leadId: number,
  opts: { pruefungAn?: string } = {},
  lauf: Lauf = sqlPool,
): Promise<WillkommenErgebnis> {
  await willkommenSpalten(lauf);
  const pruefung = !!opts.pruefungAn;
  if (!pruefung && !(await willkommenAn(lauf))) {
    await lauf`UPDATE fiaon_leads SET willkommen_status = 'aus', willkommen_grund = 'Schalter aus' WHERE id = ${leadId} AND willkommen_status IS NULL`;
    return { status: "uebersprungen", grund: "Begrüßungsmail ist ausgeschaltet (Lead-Motor)." };
  }
  const [l] = (await lauf`
    SELECT l.id, l.vorname, l.nachname, l.email, l.telefon, l.quelle, l.person_id, l.erstellt_am,
           l.abgemeldet_am, l.bounce_am, l.willkommen_am, l.willkommen_status, p.anrede AS person_anrede,
           EXISTS (
             SELECT 1 FROM fiaon_applications a
              WHERE a.merged_into IS NULL AND a.cancelled_at IS NULL
                AND (a.payment_reference IS NOT NULL OR a.payment_status = 'paid')
                AND (a.person_id = l.person_id
                     OR (NULLIF(TRIM(COALESCE(l.email, '')), '') IS NOT NULL AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email))))
           ) AS hat_fertigen_antrag,
           EXISTS (
             SELECT 1 FROM fiaon_leads x
              WHERE x.id <> l.id AND x.willkommen_am > NOW() - INTERVAL '24 hours'
                AND ((l.person_id IS NOT NULL AND x.person_id = l.person_id)
                     OR (NULLIF(TRIM(COALESCE(l.email, '')), '') IS NOT NULL AND LOWER(TRIM(x.email)) = LOWER(TRIM(l.email))))
           ) AS schon_begruesst
      FROM fiaon_leads l
      LEFT JOIN fiaon_persons p ON p.id = l.person_id
     WHERE l.id = ${leadId}`) as any[];
  if (!l) return { status: "uebersprungen", grund: "Lead nicht gefunden." };

  const auslassen = async (grund: string): Promise<WillkommenErgebnis> => {
    if (!pruefung) await lauf`UPDATE fiaon_leads SET willkommen_status = 'ausgelassen', willkommen_grund = ${grund} WHERE id = ${leadId} AND willkommen_am IS NULL`;
    return { status: "uebersprungen", grund };
  };
  if (!pruefung) {
    if (l.willkommen_am || l.willkommen_status === "gesendet") return { status: "uebersprungen", grund: "Schon begrüßt." };
    if (!l.email) return auslassen("Keine E-Mail-Adresse.");
    if (String(l.quelle || "") === "test") return auslassen("Testeintrag.");
    if (l.bounce_am) return auslassen("Adresse unzustellbar (Rückläufer).");
    if (l.abgemeldet_am) return auslassen("Abgemeldet.");
    if (l.hat_fertigen_antrag) return auslassen("Hat schon einen fertigen oder bezahlten Antrag.");
    if (l.schon_begruesst) return auslassen("In den letzten 24 Stunden schon begrüßt (zweites Formular).");
    if (l.erstellt_am && Date.now() - new Date(l.erstellt_am).getTime() > HOECHSTENS_TAGE * 86_400_000) {
      return auslassen(`Älter als ${HOECHSTENS_TAGE} Tage — nur Nachfass-Strecke.`);
    }
    // Beanspruchen: Zwei Wege (Meta-Webhook und Make) können denselben Lead
    // gleichzeitig melden — nur einer schickt.
    const beansprucht = (await lauf`
      UPDATE fiaon_leads SET willkommen_status = 'laeuft', willkommen_versuche = willkommen_versuche + 1, updated_at = NOW()
       WHERE id = ${leadId} AND willkommen_am IS NULL
         AND COALESCE(willkommen_status, '') NOT IN ('laeuft', 'gesendet')
         AND willkommen_versuche < ${HOECHSTENS_VERSUCHE}
      RETURNING id`) as any[];
    if (!beansprucht.length) return { status: "uebersprungen", grund: "Läuft bereits oder Versuche erschöpft." };
  }

  try {
    const code = await kurzlinkFuerLead(leadId, lauf);
    const { abmeldeLink } = await import("./fiaon-lead-strecke");
    const { nummerFuerFormular } = await import("../routes/fiaon-kurzlink");
    const texte = willkommenTexte({
      vorname: l.vorname, nachname: l.nachname, anrede: l.person_anrede,
      email: l.email, telefonDach: !!nummerFuerFormular(l.telefon),
      erstelltAm: l.erstellt_am ? new Date(l.erstellt_am) : null,
    });
    const { sendMakeWebhookMitGrund } = await import("../make-webhook");
    const erg = await sendMakeWebhookMitGrund("lead_willkommen", {
      email: pruefung ? opts.pruefungAn! : l.email,
      person_id: pruefung ? null : l.person_id ?? null,
      lead_id: pruefung ? null : leadId,
      vorname: l.vorname, nachname: l.nachname,
      anrede: texte.anrede, betreff: pruefung ? `[Prüfung] ${texte.betreff}` : texte.betreff, einstieg: texte.einstieg,
      antrag_url: kurzlinkUrl(code, "m"),
      abmelde_url: await abmeldeLink(leadId, lauf),
      ...(pruefung ? { test: true } : {}),
    } as any);
    if (pruefung) return erg.ok ? { status: "gesendet", grund: `Prüfversand an ${opts.pruefungAn}` } : { status: "fehler", grund: erg.grund || "unbekannt" };
    if (erg.ok) {
      await lauf`UPDATE fiaon_leads SET willkommen_am = NOW(), willkommen_status = 'gesendet', willkommen_grund = NULL WHERE id = ${leadId}`;
      const { logLead } = await import("../routes/fiaon-leads");
      await logLead(leadId, { id: null, name: "System" }, "email_sent", { note: "Begrüßungsmail mit persönlichem Antragslink gesendet (lead_willkommen)" }).catch(() => {});
      return { status: "gesendet", grund: "gesendet" };
    }
    await lauf`UPDATE fiaon_leads SET willkommen_status = 'fehler', willkommen_grund = ${String(erg.grund || "unbekannt").slice(0, 300)} WHERE id = ${leadId}`;
    return { status: "fehler", grund: erg.grund || "unbekannt" };
  } catch (err) {
    const grund = err instanceof Error ? err.message : String(err);
    if (!pruefung) await lauf`UPDATE fiaon_leads SET willkommen_status = 'fehler', willkommen_grund = ${grund.slice(0, 300)} WHERE id = ${leadId}`.catch(() => {});
    return { status: "fehler", grund };
  }
}

/**
 * Der Nachhol-Takt (alle 5 Minuten): Fehlgeschlagene Begrüßungen der letzten
 * zwei Stunden noch einmal versuchen (höchstens drei Versuche je Lead), und
 * „läuft"-Zeilen, die ein Neustart hat hängen lassen, wieder freigeben.
 */
export async function willkommenNachholen(lauf: Lauf = sqlPool): Promise<{ versucht: number; gesendet: number }> {
  await willkommenSpalten(lauf);
  if (!(await willkommenAn(lauf))) return { versucht: 0, gesendet: 0 };
  await lauf`
    UPDATE fiaon_leads SET willkommen_status = 'fehler', willkommen_grund = 'hing nach Neustart'
     WHERE willkommen_status = 'laeuft' AND willkommen_am IS NULL AND updated_at < NOW() - INTERVAL '10 minutes'
       AND erstellt_am > NOW() - INTERVAL '2 days'`;
  const zeilen = (await lauf`
    SELECT id FROM fiaon_leads
     WHERE willkommen_status = 'fehler' AND willkommen_am IS NULL
       AND willkommen_versuche < ${HOECHSTENS_VERSUCHE} AND erstellt_am > NOW() - INTERVAL '2 hours'
     ORDER BY erstellt_am DESC LIMIT 20`) as any[];
  let gesendet = 0;
  for (const z of zeilen) {
    const e = await willkommenSenden(Number(z.id), {}, lauf);
    if (e.status === "gesendet") gesendet++;
  }
  return { versucht: zeilen.length, gesendet };
}
