// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KEIN GESPRÄCH GEHT MEHR VERLOREN (29.10.2026, E-458 Nr. 11)
//
// ── DER BEFUND (Plan E-458, 29.10.) ────────────────────────────────────────
// Alle drei Global-Gespräche, die es je gab, stehen auf „verpasst“ — ohne Grund.
// Den Status setzte ein Aufräumlauf zwölf Stunden nach dem Termin von selbst
// (runVerpassteTermine), wenn niemand „erledigt“ klickte. Ob gesprochen wurde,
// wusste danach niemand. Vor dem Gespräch kam nur die Privat-Erinnerung
// („Guten Tag {Vorname}“, Rahmen der Privatkunden), danach gar nichts. Der Mail-
// Motor schreibt bald 20 Firmen und Partner je Stunde an — jede positive Antwort
// wird ein Global-Gespräch, und die letzte Meile muss halten.
//
// ── WAS JETZT GILT (Texte von Justin freigegeben, „go Plan“ 29.10.) ─────────
//   1. Am Vortag die Mail „Morgen um … Uhr: Ihr Gespräch mit FIAON Global“
//      (global_termin_erinnerung), eine Stunde vorher die kurze Mail
//      (global_termin_kurz). Die Privat-Erinnerung lässt Global-Gespräche aus.
//   2. Kein Gespräch wird mehr still „verpasst“. Eine halbe Stunde nach dem
//      Ende bekommt die Person, die es geführt hat, die Aufgabe „Ergebnis
//      fehlt“ (stattgefunden / nicht erreicht / verschoben). Ist sie gerade
//      nicht da (Abwesenheit, inaktiv, gesperrt), die Vertretung aus dem
//      Chefbüro (global_vertretung_agent_id — den Namen entscheidet Justin),
//      sonst die Leitung. Steht am nächsten Werktag um 9 Uhr noch kein Ergebnis
//      da, bekommt die Leitung eine Erinnerung.
//   3. „Nicht erreicht“ schickt dem Unternehmen GENAU EINMAL eine gesiezte Mail
//      mit dem Link für eine neue Zeit (global_nicht_erreicht). Danach keine
//      weitere automatische Mail — die zuständige Person ruft an.
//   4. „Verschoben“ setzt die neue Zeit, schickt die Bestätigung und lässt
//      Erinnerungen und Ergebnis-Pflicht für die neue Zeit neu laufen.
//
// ── WAS BEWUSST NICHT PASSIERT ─────────────────────────────────────────────
//   · Firmenangebote (IA-FIRMA-, E-301) bekommen keine automatische Kundenmail —
//     auch hier nicht. Die Marken werden gesetzt, damit nichts nachläuft.
//   · Der Lauf schreibt keinen Zähler „nicht erreicht“ und keinen
//     Privat-Verlauf: Ein Firmenkontakt gehört in keinen dieser Zähler
//     (fiaon-global-termin.ts, globalTerminErgebnis).
//   · Kein Termin wandert automatisch in einen anderen Kalender. Die Vertretung
//     bekommt die Aufgabe und darf das Ergebnis eintragen (fiaon-termin.ts).
//
// Die reine Zeitrechnung steht in fiaon-global-gespraech-regeln.ts; geprüft
// von scripts/pruef-global-gespraech-e458.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { escapeHtml } from "./fiaon-html-pdf";
import { berlinToday } from "./fiaon-time";
import {
  vortagFaellig, kurzFaellig, ergebnisFaellig, leitungAb, gespraechAnrede, gespraechDatum, gespraechUhrzeit,
  nichtErreichtWann, type GespraechSprache,
} from "./fiaon-global-gespraech-regeln";

export const SETTING_VERTRETUNG = "global_vertretung_agent_id";
/** Die Mail „nicht erreicht“ geht nur zu Gesprächen, die höchstens so viele Tage zurückliegen. */
export const NICHT_ERREICHT_HOECHSTENS_TAGE = 3;
/** Der Raum, in dem die Leitung das Ergebnis einträgt (Chefbüro › Global-Kunden, Leiste „Gespräche“). */
export const GESPRAECHE_CHEF_LINK = "/chef/global-kunden?gespraeche=offen";

/** Die Aufgaben eines Gesprächs — derselbe Schlüssel wie bei der Buchung (global-termin:<id>). */
export const aufgabeSchluessel = {
  gespraech: (id: number) => `global-termin:${id}`,
  ergebnis: (id: number) => `global-ergebnis:${id}`,
  leitung: (id: number) => `global-ergebnis-leitung:${id}`,
};

// ───────────────────────────────────────────────────────────────────────────
// Die Spalten — einmal je Prozess, über die DDL-Wache (Katalog zuerst, kurzes Sperrlimit)
// ───────────────────────────────────────────────────────────────────────────

let spaltenBereit: Promise<boolean> | null = null;
export function ensureGlobalGespraechSpalten(): Promise<boolean> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      await sqlPool`
        ALTER TABLE fiaon_termine
          ADD COLUMN IF NOT EXISTS kurz_erinnert_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS ergebnis_aufgabe_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS ergebnis_leitung_am TIMESTAMPTZ`;
      return true;
    })().catch((e) => {
      spaltenBereit = null;
      console.error("[GLOBAL-GESPRAECH] Spalten an fiaon_termine nicht angelegt — Erinnerung und Ergebnis-Pflicht warten:", String(e).slice(0, 200));
      return false;
    });
  }
  return spaltenBereit;
}

// ───────────────────────────────────────────────────────────────────────────
// Wer ruft an, wer trägt das Ergebnis ein?
// ───────────────────────────────────────────────────────────────────────────

export interface GlobalPerson { id: number; name: string; vorname: string }

async function personLesen(id: number, auchTest = false): Promise<(GlobalPerson & { kann: boolean }) | null> {
  const [a] = (await sqlPool`
    SELECT id, name, COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)) AS vorname,
           (COALESCE(active, TRUE) AND zugang_gesperrt_am IS NULL AND (${auchTest}::boolean OR NOT COALESCE(is_test_account, FALSE))) AS kann
      FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
  return a ? { id: Number(a.id), name: String(a.name || ""), vorname: String(a.vorname || a.name || ""), kann: !!a.kann } : null;
}

/** Die Vertretung aus dem Chefbüro — nur, wenn sie arbeiten kann (aktiv, nicht gesperrt, kein Testkonto). */
export async function globalVertretung(): Promise<GlobalPerson | null> {
  const [s] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${SETTING_VERTRETUNG} LIMIT 1`.catch(() => [])) as any[];
  const id = Number(s?.value);
  if (!Number.isInteger(id) || id <= 0) return null;
  const p = await personLesen(id);
  return p?.kann ? { id: p.id, name: p.name, vorname: p.vorname } : null;
}

/** Darf diese Person als Global-Vertretung Ergebnisse eintragen? (fiaon-termin.ts, Zugriffsprüfung) */
export async function istGlobalVertretung(agentId: number): Promise<boolean> {
  const v = await globalVertretung().catch(() => null);
  return !!v && v.id === Number(agentId);
}

async function gruenderId(): Promise<number> {
  try { return await (await import("../routes/fiaon-gruender-termin")).gruenderAgentId(); } catch { return 0; }
}

async function abwesend(agentId: number, zeitpunkt: Date): Promise<boolean> {
  try {
    const abw = await import("./fiaon-abwesenheit");
    return abw.istAbwesend(await abw.abwesenheitJetzt(), agentId, zeitpunkt);
  } catch { return false; }
}

/**
 * Wer zu `zeitpunkt` für das Gespräch da ist: die gebuchte Person, sonst die Vertretung, sonst die Leitung (id null).
 * Der Gründer (Startgespräche aus Individualangeboten) ist immer „selbst“ — seine Aufgaben liegen auf seinem Brett.
 */
export async function globalZustaendigFuer(agentId: number, zeitpunkt: Date): Promise<{
  id: number | null; name: string; vorname: string; wahl: "selbst" | "gruender" | "vertretung" | "leitung"; gebucht: GlobalPerson | null;
}> {
  const gruender = await gruenderId();
  const p = await personLesen(agentId, agentId === gruender);
  const gebucht = p ? { id: p.id, name: p.name, vorname: p.vorname } : null;
  if (p && agentId === gruender) return { ...gebucht!, wahl: "gruender", gebucht };
  if (p?.kann && !(await abwesend(p.id, zeitpunkt))) return { ...gebucht!, wahl: "selbst", gebucht };
  const v = await globalVertretung();
  if (v && v.id !== agentId && !(await abwesend(v.id, zeitpunkt))) return { ...v, wahl: "vertretung", gebucht };
  return { id: null, name: gebucht?.name ?? "", vorname: gebucht?.vorname ?? "", wahl: "leitung", gebucht };
}

// ───────────────────────────────────────────────────────────────────────────
// Ein Gespräch lesen — alles, was Mails und Aufgaben brauchen
// ───────────────────────────────────────────────────────────────────────────

export interface GlobalGespraech {
  id: number; personId: number; agentId: number; beginn: Date; dauerMin: number; status: string;
  stornoToken: string | null; herkunft: string | null; notiz: string; gebuchtAm: Date;
  anrede: string | null; vorname: string | null; nachname: string | null; firma: string | null;
  email: string | null; telefon: string | null; sprache: GespraechSprache;
  /** E-301: Firmenangebot — keine automatische Kundenmail. */
  ohneKundenmail: boolean;
  angebotId: number | null;
}

export async function globalGespraechLesen(id: number): Promise<GlobalGespraech | null> {
  const [t] = (await sqlPool`
    SELECT t.id, t.person_id, t.agent_id, t.beginn, COALESCE(t.dauer_min, 30) AS dauer_min, t.status, t.storno_token,
           t.herkunft, COALESCE(t.notiz, '') AS notiz, t.created_at,
           COALESCE(NULLIF(ga.kunde->>'anrede', ''), p.anrede) AS anrede,
           COALESCE(NULLIF(ga.kunde->>'vorname', ''), NULLIF(p.first_name, '')) AS vorname,
           COALESCE(NULLIF(ga.kunde->>'nachname', ''), NULLIF(p.last_name, ''), NULLIF(p.contact_name, '')) AS nachname,
           NULLIF(p.company_name, '') AS firma,
           COALESCE(NULLIF(p.primary_email, ''), NULLIF(ga.kunde->>'email', '')) AS email,
           COALESCE(NULLIF(p.primary_phone, ''), NULLIF(ga.kunde->>'telefon', '')) AS telefon,
           (ga.sprache = 'en' OR p.sprache = 'en' OR COALESCE(t.notiz, '') ILIKE '%Sprache: Englisch%') AS englisch,
           COALESCE(ga.fassung, '') LIKE 'IA-FIRMA-%' AS ohne_kundenmail,
           ga.id AS angebot_id
      FROM fiaon_termine t
      LEFT JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN LATERAL (
        SELECT id, kunde, fassung, sprache FROM fiaon_global_angebote WHERE startgespraech_termin_id = t.id ORDER BY id DESC LIMIT 1
      ) ga ON TRUE
     WHERE t.id = ${id} AND t.quelle = 'global'
     LIMIT 1`) as any[];
  if (!t) return null;
  return {
    id: Number(t.id), personId: Number(t.person_id), agentId: Number(t.agent_id), beginn: new Date(t.beginn),
    dauerMin: Number(t.dauer_min) || 30, status: String(t.status), stornoToken: t.storno_token ? String(t.storno_token) : null,
    herkunft: t.herkunft ? String(t.herkunft) : null, notiz: String(t.notiz), gebuchtAm: new Date(t.created_at),
    anrede: t.anrede ?? null, vorname: t.vorname ?? null, nachname: t.nachname ?? null, firma: t.firma ?? null,
    email: t.email ?? null, telefon: t.telefon ?? null, sprache: t.englisch ? "en" : "de",
    ohneKundenmail: !!t.ohne_kundenmail, angebotId: t.angebot_id != null ? Number(t.angebot_id) : null,
  };
}

/** Wie das Team das Unternehmen nennt: Firma, sonst der Name. */
export function gespraechName(g: Pick<GlobalGespraech, "firma" | "vorname" | "nachname">): string {
  const name = [g.vorname, g.nachname].filter(Boolean).join(" ");
  return g.firma && !/^(Privatperson|Private individual) · /.test(g.firma) ? g.firma : name || g.firma || "das Unternehmen";
}

// ───────────────────────────────────────────────────────────────────────────
// Die Mails an das Unternehmen
// ───────────────────────────────────────────────────────────────────────────

type GespraechMail = "global_termin_erinnerung" | "global_termin_kurz" | "global_nicht_erreicht";

/** Die Nutzlast — REIN bis auf die Eingaben, damit das Prüfskript dieselbe Mail rendert, die rausgeht. */
export function globalGespraechNutzlast(g: GlobalGespraech, ein: {
  anrufer: { name: string; vorname: string }; jetzt: Date; stornoLink: string; linkKalender?: string | null;
}): Record<string, string> {
  const en = g.sprache === "en";
  const wann = nichtErreichtWann(g.beginn, ein.jetzt, g.sprache);
  return {
    email: String(g.email || ""),
    ...(en ? { sprache: "en" } : {}),
    anrede_zeile: escapeHtml(gespraechAnrede(g, g.sprache)),
    termin_datum: gespraechDatum(g.beginn, g.sprache),
    termin_uhrzeit: gespraechUhrzeit(g.beginn),
    termin_dauer: String(g.dauerMin),
    betreuer_name: escapeHtml(ein.anrufer.name),
    betreuer_vorname: escapeHtml(ein.anrufer.vorname || ein.anrufer.name),
    telefon: escapeHtml(g.telefon || (en ? "the number you gave us" : "Ihrer hinterlegten Nummer")),
    storno_link: ein.stornoLink,
    ...(ein.linkKalender ? { link_kalender: ein.linkKalender } : {}),
    wann_satz: wann.satz,
    wann_kurz: wann.kurz,
  };
}

async function stornoLinkFuer(g: GlobalGespraech): Promise<string> {
  if (!g.stornoToken) return "";
  const { stornoLink } = await import("./fiaon-termine");
  return `${stornoLink(g.stornoToken)}?anrede=sie&bereich=business`;
}

/** Wo das Unternehmen eine neue Zeit wählt: beim Startgespräch Justins Seite mit seinen Daten, sonst der Kalender auf /business. */
async function neueZeitLink(g: GlobalGespraech): Promise<string> {
  const { absoluteUrl } = await import("../fiaon-base-url");
  const start = await import("./fiaon-global-angebot-startgespraech")
    .then((m) => m.startgespraechNeuBuchenLink(g.id)).catch(() => null);
  return start ?? absoluteUrl(g.sprache === "en" ? "/en/business#gespraech" : "/business#gespraech");
}

async function gespraechMailSenden(art: GespraechMail, g: GlobalGespraech, jetzt: Date, verlaufText: string): Promise<{ status: string; grund?: string | null }> {
  const anrufer = await globalZustaendigFuer(g.agentId, g.beginn);
  const nutzlast = globalGespraechNutzlast(g, {
    anrufer: { name: anrufer.name || anrufer.gebucht?.name || "FIAON Global", vorname: anrufer.vorname || anrufer.gebucht?.vorname || "" },
    jetzt, stornoLink: await stornoLinkFuer(g),
    linkKalender: art === "global_nicht_erreicht" ? await neueZeitLink(g) : null,
  });
  const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
  const erg = await versendenUndProtokollieren(art, nutzlast as any, { personId: g.personId, verlaufText });
  await firmenVerlauf(g, `${verlaufText}${erg.status === "versandt" ? "" : ` — NICHT versandt (${erg.grund ?? erg.status}).`}`);
  return { status: erg.status, grund: erg.grund ?? null };
}

/** Eine Zeile im Verlauf des Firmen-Leads (fiaon_firmen_log, Art „global“) — ohne Status oder Wiedervorlage zu ändern. Wirft nie. */
async function firmenVerlauf(g: GlobalGespraech, text: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
    SELECT f.id, NULL, 'System', 'global', 'gespraech_mail', ${text.slice(0, 2000)}
      FROM fiaon_firmen_leads f WHERE f.person_id = ${g.personId} ORDER BY f.updated_at DESC LIMIT 1`.catch(() => {});
}

/**
 * „Nicht erreicht“ — die Mail genau EINMAL je Gespräch (Marke verpasst_mail_am, atomar). Gerufen aus
 * globalTerminErgebnis, wenn ein Mensch „nicht erreicht“ oder „Nummer falsch“ einträgt — nie automatisch.
 */
export async function globalNichtErreichtSenden(terminId: number, jetzt: Date = new Date()): Promise<{ versandt: boolean; satz: string }> {
  const g = await globalGespraechLesen(terminId);
  if (!g) return { versandt: false, satz: "" };
  if (g.ohneKundenmail) return { versandt: false, satz: " Beim Firmenangebot geht keine automatische Mail an den Kunden — bitte persönlich melden." };
  if (!g.email) return { versandt: false, satz: " Es ist keine E-Mail-Adresse hinterlegt — bitte anrufen." };
  // Ein Eintrag zu einem alten Gespräch (z. B. die drei, die der frühere Lauf still auf „verpasst“ setzte) schickt keine
  // Mail mehr: „Am 21.09. haben wir Sie nicht erreicht“ fünf Wochen später wäre peinlich.
  if (jetzt.getTime() - g.beginn.getTime() > NICHT_ERREICHT_HOECHSTENS_TAGE * 86_400_000) {
    return { versandt: false, satz: ` Das Gespräch liegt mehr als ${NICHT_ERREICHT_HOECHSTENS_TAGE} Tage zurück — es geht keine Mail mehr raus; bitte anrufen.` };
  }
  const [frei] = (await sqlPool`
    UPDATE fiaon_termine SET verpasst_mail_am = NOW(), updated_at = NOW()
     WHERE id = ${terminId} AND verpasst_mail_am IS NULL RETURNING id`) as any[];
  if (!frei) return { versandt: false, satz: " Die Mail „nicht erreicht“ ging zu diesem Gespräch schon raus." };
  const erg = await gespraechMailSenden("global_nicht_erreicht", g, jetzt,
    `FIAON Global: Mail „nicht erreicht“ mit dem Link für eine neue Zeit (Gespräch ${gespraechDatum(g.beginn, "de")}, ${gespraechUhrzeit(g.beginn)} Uhr).`);
  if (erg.status === "versandt") return { versandt: true, satz: " Das Unternehmen hat einmal eine Mail mit dem Link für eine neue Zeit bekommen." };
  // Ging sie nicht raus, darf ein zweiter Klick es noch einmal versuchen.
  await sqlPool`UPDATE fiaon_termine SET verpasst_mail_am = NULL WHERE id = ${terminId}`.catch(() => {});
  return { versandt: false, satz: ` Die Mail an das Unternehmen ging NICHT raus (${erg.grund ?? erg.status}) — bitte anrufen.` };
}

// ───────────────────────────────────────────────────────────────────────────
// Aufgaben schließen — jeder Weg zum Ergebnis ruft das
// ───────────────────────────────────────────────────────────────────────────

/** Schließt „Ergebnis fehlt“ und die Erinnerung an die Leitung (und auf Wunsch die Gesprächs-Aufgabe). Wirft nie. */
export async function globalErgebnisAufgabenSchliessen(terminId: number, ein: { ergebnis: string; wer: string; auchGespraech?: boolean }): Promise<void> {
  const schluessel = [aufgabeSchluessel.ergebnis(terminId), aufgabeSchluessel.leitung(terminId), ...(ein.auchGespraech ? [aufgabeSchluessel.gespraech(terminId)] : [])];
  await sqlPool`
    UPDATE fiaon_betreiber_todos
       SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${ein.wer}, ergebnis = ${ein.ergebnis.slice(0, 500)},
           updated_at = NOW(), letzte_aktivitaet = NOW()
     WHERE schluessel = ANY(${schluessel}) AND status <> 'erledigt'`.catch((e) =>
    console.error(`[GLOBAL-GESPRAECH] Aufgaben zu Termin ${terminId} nicht geschlossen:`, String(e).slice(0, 160)));
}

// ───────────────────────────────────────────────────────────────────────────
// Verschieben — die neue Zeit, die Bestätigung, alles läuft neu
// ───────────────────────────────────────────────────────────────────────────

export type VerschiebenErgebnis = { ok: true; meldung: string; hinweis: string; beginn: Date } | { ok: false; status: number; error: string };

/**
 * Ein Global-Gespräch auf eine neue Zeit legen — aus dem Kalender (fiaon-termin.ts) und aus dem Chefbüro.
 * Die Zugriffsprüfung macht der Aufrufer. Die Datenbank verbietet Überschneidungen selbst (23P01).
 */
export async function globalGespraechVerschieben(terminId: number, neu: Date, wer: { id: number | null; name: string }): Promise<VerschiebenErgebnis> {
  if (Number.isNaN(neu.getTime())) return { ok: false, status: 400, error: "Die neue Zeit ist nicht lesbar." };
  if (neu.getTime() < Date.now() + 5 * 60_000) return { ok: false, status: 400, error: "Die neue Zeit muss in der Zukunft liegen." };
  await ensureGlobalGespraechSpalten();
  const alt = await globalGespraechLesen(terminId);
  if (!alt) return { ok: false, status: 404, error: "Gespräch nicht gefunden." };
  if (alt.status !== "gebucht") return { ok: false, status: 409, error: "Dieses Gespräch ist schon abgeschlossen oder abgesagt." };
  // Die Folgenummer der Kalenderdatei (kal_sequenz) zählt der Trigger fiaon_termine_kal_sequenz selbst — nie hier.
  try {
    await sqlPool`
      UPDATE fiaon_termine
         SET beginn = ${neu}, erinnert_am = NULL, kurz_erinnert_am = NULL, ergebnis_aufgabe_am = NULL, ergebnis_leitung_am = NULL,
             updated_at = NOW()
       WHERE id = ${terminId} AND status = 'gebucht'`;
  } catch (err: any) {
    if (String(err?.code) === "23P01") return { ok: false, status: 409, error: `Zu dieser Zeit läuft schon ein Termin — ein Gespräch dauert ${alt.dauerMin} Minuten. Bitte eine andere Zeit wählen.` };
    if (String(err?.code) === "23505") return { ok: false, status: 409, error: "Diese Zeit ist bereits vergeben." };
    throw err;
  }
  void import("./fiaon-google-kalender").then((m) => m.googleKalenderAnstossen()).catch(() => {});
  const g = (await globalGespraechLesen(terminId))!;
  const vorher = `${gespraechDatum(alt.beginn, "de")}, ${gespraechUhrzeit(alt.beginn)} Uhr`;
  const nachher = `${gespraechDatum(neu, "de")}, ${gespraechUhrzeit(neu)} Uhr`;
  await globalErgebnisAufgabenSchliessen(terminId, { ergebnis: `Verschoben auf ${nachher}.`, wer: wer.name });
  // Die Gesprächs-Aufgabe (falls noch offen) zeigt die neue Zeit.
  await sqlPool`
    UPDATE fiaon_betreiber_todos
       SET titel = regexp_replace(titel, ' am [0-9.]+, [0-9:]+ Uhr$', ${` am ${nachher}`}), faellig_am = ${berlinToday(neu)}::date,
           updated_at = NOW(), letzte_aktivitaet = NOW()
     WHERE schluessel = ${aufgabeSchluessel.gespraech(terminId)} AND status <> 'erledigt'`.catch(() => {});
  await sqlPool`
    UPDATE fiaon_termine SET notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${`Verschoben von ${vorher} auf ${nachher} (${wer.name}).`}::text)
     WHERE id = ${terminId}`.catch(() => {});
  const { globalLeadFortschreiben } = await import("../routes/fiaon-firmen");
  await globalLeadFortschreiben({
    personId: g.personId, status: "termin", wiedervorlage: null, ereignis: "termin_verschoben",
    verlauf: `Gespräch verschoben: ${vorher} → ${nachher} (${wer.name}).`,
    agent: wer.id ? { id: wer.id, name: wer.name } : null,
  }).catch((e) => console.error(`[GLOBAL-GESPRAECH] Verschieben von Termin ${terminId} nicht im Firmen-Topf vermerkt:`, String(e).slice(0, 160)));

  // Die Bestätigung an das Unternehmen — beim Erstgespräch die Global-Bestätigung, beim Startgespräch dessen eigene Mail.
  let hinweis = "Das Unternehmen hat die neue Zeit per Mail bekommen.";
  if (g.ohneKundenmail) hinweis = "Beim Firmenangebot geht keine automatische Mail raus — bitte die neue Zeit persönlich mitteilen.";
  else if (g.angebotId) {
    await sqlPool`UPDATE fiaon_global_angebote SET startgespraech_am = ${neu}, startgespraech_mail_am = NULL, updated_at = NOW() WHERE id = ${g.angebotId}`.catch(() => {});
    const r = await import("./fiaon-global-angebot-startgespraech").then((m) => m.startgespraechMitteilen(g.angebotId!)).catch((e) => ({ ok: false, grund: String(e) }));
    if (!r.ok) hinweis = `Die Mail mit der neuen Zeit ging NICHT raus (${r.grund ?? "unbekannt"}) — bitte die neue Zeit persönlich mitteilen.`;
  } else {
    const r = await globalBestaetigungNeu(g).catch((e) => ({ status: "fehlgeschlagen", grund: String(e) }));
    if (r.status !== "versandt") hinweis = `Die Bestätigung ging NICHT raus (${r.grund ?? r.status}) — bitte die neue Zeit persönlich mitteilen.`;
  }
  console.log(`[GLOBAL-GESPRAECH] Termin ${terminId} verschoben: ${vorher} → ${nachher} (${wer.name})`);
  return { ok: true, beginn: neu, meldung: `Verschoben auf ${nachher}.`, hinweis };
}

/** Die Bestätigung des Erstgesprächs (global_termin) mit der neuen Zeit — Firma, Paketwunsch und Sprache aus der Buchung. */
async function globalBestaetigungNeu(g: GlobalGespraech): Promise<{ status: string; grund?: string | null }> {
  if (!g.email || !g.stornoToken) return { status: "uebersprungen", grund: "keine E-Mail-Adresse oder kein Storno-Token" };
  const anrufer = await globalZustaendigFuer(g.agentId, g.beginn);
  const paketText = /Paketwunsch: (?!noch offen)(.+)/.exec(g.notiz)?.[1]?.trim() ?? null;
  const { globalTerminPayload } = await import("./fiaon-global-termin");
  const { berlinDatumText } = await import("./fiaon-termine");
  const name = [g.vorname, g.nachname].filter(Boolean).join(" ") || g.firma || "";
  const nutzlast = globalTerminPayload({
    email: g.email, name: escapeHtml(name), firma: escapeHtml(g.firma ?? name), telefon: escapeHtml(g.telefon ?? ""),
    paketText: paketText ? escapeHtml(paketText) : null,
    ansprechpartner: escapeHtml(anrufer.name || anrufer.gebucht?.name || "FIAON Global"),
    datumText: berlinDatumText(g.beginn), uhrzeit: gespraechUhrzeit(g.beginn), stornoToken: g.stornoToken,
    sprache: g.sprache, beginn: g.beginn, paket: null,
  });
  const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
  const erg = await versendenUndProtokollieren("global_termin", nutzlast as any, {
    personId: g.personId, verlaufText: `Terminbestätigung (FIAON Global) nach dem Verschieben versandt: ${berlinDatumText(g.beginn)} um ${gespraechUhrzeit(g.beginn)} Uhr.`,
  });
  return { status: erg.status, grund: erg.grund ?? null };
}

// ───────────────────────────────────────────────────────────────────────────
// DER LAUF — alle zehn Minuten (routes.ts, tageslauf „global_gespraeche“)
// ───────────────────────────────────────────────────────────────────────────

/** Nimmt eine Marke atomar — nur wer sie bekommt, handelt (zwei Instanzen beim Deploy). */
async function markeNehmen(id: number, spalte: "erinnert_am" | "kurz_erinnert_am" | "ergebnis_aufgabe_am" | "ergebnis_leitung_am"): Promise<boolean> {
  const rows = (await sqlPool`
    UPDATE fiaon_termine SET ${sqlPool(spalte)} = NOW()
     WHERE id = ${id} AND ${sqlPool(spalte)} IS NULL AND status = 'gebucht' AND quelle = 'global'
     RETURNING id`) as any[];
  return rows.length > 0;
}

async function erinnern(jetzt: Date, art: "vortag" | "kurz"): Promise<number> {
  const spalte = art === "vortag" ? "erinnert_am" : "kurz_erinnert_am";
  const bis = new Date(jetzt.getTime() + (art === "vortag" ? 36 : 2) * 3_600_000);
  const kandidaten = (await sqlPool`
    SELECT id, beginn, created_at FROM fiaon_termine
     WHERE quelle = 'global' AND status = 'gebucht' AND ${sqlPool(spalte)} IS NULL
       AND beginn > ${jetzt} AND beginn < ${bis}
     ORDER BY beginn LIMIT 50`) as any[];
  let gesendet = 0;
  for (const k of kandidaten) {
    const zeit = { jetzt, beginn: new Date(k.beginn), gebuchtAm: new Date(k.created_at) };
    const f = art === "vortag" ? vortagFaellig(zeit) : kurzFaellig(zeit);
    if (f === "warten") continue;
    if (!(await markeNehmen(Number(k.id), spalte))) continue;
    if (f === "verfallen") continue;
    const g = await globalGespraechLesen(Number(k.id));
    if (!g || g.ohneKundenmail || !g.email) continue;
    const uhr = gespraechUhrzeit(g.beginn);
    const erg = await gespraechMailSenden(art === "vortag" ? "global_termin_erinnerung" : "global_termin_kurz", g, jetzt,
      art === "vortag"
        ? `FIAON Global: Erinnerung am Vortag versandt (Gespräch morgen um ${uhr} Uhr).`
        : `FIAON Global: kurze Erinnerung versandt (Gespräch heute um ${uhr} Uhr).`);
    if (erg.status === "versandt") gesendet++;
  }
  return gesendet;
}

async function ergebnisAufgaben(jetzt: Date): Promise<number> {
  const kandidaten = (await sqlPool`
    SELECT id, beginn, COALESCE(dauer_min, 30) AS dauer_min FROM fiaon_termine
     WHERE quelle = 'global' AND status = 'gebucht' AND ergebnis_aufgabe_am IS NULL
       AND beginn < ${jetzt} AND beginn > ${new Date(jetzt.getTime() - 14 * 86_400_000)}
     ORDER BY beginn LIMIT 50`) as any[];
  let angelegt = 0;
  for (const k of kandidaten) {
    if (!ergebnisFaellig({ jetzt, beginn: new Date(k.beginn), dauerMin: Number(k.dauer_min) })) continue;
    if (!(await markeNehmen(Number(k.id), "ergebnis_aufgabe_am"))) continue;
    const g = await globalGespraechLesen(Number(k.id));
    if (!g) continue;
    const wer = await globalZustaendigFuer(g.agentId, jetzt);
    const datum = gespraechDatum(g.beginn, "de"); const uhr = gespraechUhrzeit(g.beginn);
    const name = gespraechName(g);
    const kontakt = [[g.vorname, g.nachname].filter(Boolean).join(" "), g.telefon, g.email].filter(Boolean).join(" · ");
    const zumChef = wer.wahl === "gruender" || wer.wahl === "leitung";
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: g.personId, ref: null,
      titel: `Ergebnis fehlt: Gespräch mit ${name} am ${datum}, ${uhr} Uhr`,
      text: [
        `Das Global-Gespräch mit ${name} war am ${datum} um ${uhr} Uhr${wer.gebucht && wer.wahl !== "selbst" && wer.wahl !== "gruender" ? ` (gebucht bei ${wer.gebucht.name})` : ""}.`,
        kontakt ? `Kontakt: ${kontakt}` : null,
        wer.wahl === "vertretung" ? `Du bist als Vertretung eingetragen — ${wer.gebucht?.name ?? "die zuständige Person"} ist gerade nicht da.` : null,
        wer.wahl === "leitung" ? `${wer.gebucht?.name ?? "Die zuständige Person"} ist gerade nicht da, und es ist keine Vertretung eingetragen (Chefbüro › Rückholung › FIAON Global).` : null,
        zumChef
          ? "Bitte eintragen, wie es ausging: Chefbüro › Global-Kunden › Gespräche."
          : "Bitte eintragen, wie es ausging: Kalender › Termin › „Ergebnis“ (der Termin steht unter „Überfällig“).",
        "· Stattgefunden → die Firma steht im Firmen-Cockpit mit Wiedervorlage morgen.",
        "· Nicht erreicht → das Unternehmen bekommt einmal eine Mail mit dem Link für eine neue Zeit; bitte heute noch einmal anrufen.",
        "· Verschoben → neue Zeit eintragen; das Unternehmen bekommt die Bestätigung, die Erinnerungen laufen neu.",
        wer.wahl === "gruender" ? null : "Fehlt das Ergebnis am nächsten Werktag um 9 Uhr noch, bekommt die Leitung eine Erinnerung.",
      ].filter(Boolean).join("\n"),
      faelligAm: berlinToday(jetzt), dringend: true,
      schluessel: aufgabeSchluessel.ergebnis(g.id), bereich: "sonstiges", quelle: "global", autorName: "FIAON Global",
      link: zumChef ? GESPRAECHE_CHEF_LINK : `/agent/kalender?termin=${g.id}`,
      ...(zumChef ? { anBetreiber: true } : { agentId: wer.id, vorrang: wer.wahl === "vertretung" }),
      anlageText: "Global-Gespräch vorbei — das Ergebnis fehlt noch.",
    }).then(() => { angelegt++; }).catch((e) => {
      console.error(`[GLOBAL-GESPRAECH] Aufgabe „Ergebnis fehlt“ zu Termin ${g.id} nicht angelegt:`, String(e).slice(0, 200));
      return sqlPool`UPDATE fiaon_termine SET ergebnis_aufgabe_am = NULL WHERE id = ${g.id}`.catch(() => {});
    });
  }
  return angelegt;
}

async function leitungErinnern(jetzt: Date): Promise<number> {
  const kandidaten = (await sqlPool`
    SELECT id, beginn, agent_id FROM fiaon_termine
     WHERE quelle = 'global' AND status = 'gebucht' AND ergebnis_aufgabe_am IS NOT NULL AND ergebnis_leitung_am IS NULL
       AND beginn < ${jetzt} AND beginn > ${new Date(jetzt.getTime() - 30 * 86_400_000)}
     ORDER BY beginn LIMIT 50`) as any[];
  let erinnert = 0;
  const gruender = await gruenderId();
  for (const k of kandidaten) {
    if (jetzt.getTime() < leitungAb(new Date(k.beginn)).getTime()) continue;
    if (!(await markeNehmen(Number(k.id), "ergebnis_leitung_am"))) continue;
    // Das Startgespräch beim Gründer liegt schon auf seinem Brett — eine zweite Aufgabe an dieselbe Stelle wäre Lärm.
    if (Number(k.agent_id) === gruender) continue;
    const g = await globalGespraechLesen(Number(k.id));
    if (!g) continue;
    const [aufgabe] = (await sqlPool`
      SELECT zustaendig_name FROM fiaon_betreiber_todos WHERE schluessel = ${aufgabeSchluessel.ergebnis(g.id)} LIMIT 1`.catch(() => [])) as any[];
    const bei = String(aufgabe?.zustaendig_name || "") || "niemandem";
    const datum = gespraechDatum(g.beginn, "de"); const uhr = gespraechUhrzeit(g.beginn);
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: g.personId, ref: null,
      titel: `Leitung: Ergebnis fehlt — Gespräch mit ${gespraechName(g)} am ${datum}, ${uhr} Uhr`,
      text: [
        `Zum Global-Gespräch mit ${gespraechName(g)} (${datum}, ${uhr} Uhr) ist seit gestern kein Ergebnis eingetragen. Die Aufgabe „Ergebnis fehlt“ liegt bei ${bei}.`,
        "Bitte klären, ob gesprochen wurde, und das Ergebnis eintragen: Chefbüro › Global-Kunden › Gespräche (stattgefunden / nicht erreicht / verschoben).",
        "Ohne Eintrag bleibt das Gespräch offen — es wird nicht mehr automatisch „verpasst“.",
      ].join("\n"),
      faelligAm: berlinToday(jetzt), dringend: true, anBetreiber: true,
      schluessel: aufgabeSchluessel.leitung(g.id), bereich: "sonstiges", quelle: "global", autorName: "FIAON Global",
      link: GESPRAECHE_CHEF_LINK,
      anlageText: "Global-Gespräch ohne Ergebnis — Erinnerung an die Leitung.",
    }).then(() => { erinnert++; }).catch((e) => {
      console.error(`[GLOBAL-GESPRAECH] Erinnerung an die Leitung zu Termin ${g.id} nicht angelegt:`, String(e).slice(0, 200));
      return sqlPool`UPDATE fiaon_termine SET ergebnis_leitung_am = NULL WHERE id = ${g.id}`.catch(() => {});
    });
  }
  return erinnert;
}

/**
 * Der Lauf. Gibt `true` zurück, wenn er etwas getan hat (stillerLauf schreibt nur dann eine Historienzeile).
 * `jetzt` nur für den Prüfstand. Ohne Mail-Kanal laufen Aufgaben weiter, die Mails warten (keine Marke verbraucht).
 */
export async function globalGespraecheLauf(jetzt: Date = new Date()): Promise<boolean> {
  if (!(await ensureGlobalGespraechSpalten())) return false;
  const { versandErlaubtOderProtokoll } = await import("./fiaon-versandkanal");
  const mailsDuerfen = await versandErlaubtOderProtokoll("Global-Gespräche (Erinnerung)").catch(() => false);
  const vortag = mailsDuerfen ? await erinnern(jetzt, "vortag") : 0;
  const kurz = mailsDuerfen ? await erinnern(jetzt, "kurz") : 0;
  const ergebnis = await ergebnisAufgaben(jetzt);
  const leitung = await leitungErinnern(jetzt);
  const summe = vortag + kurz + ergebnis + leitung;
  if (summe) console.log(`[GLOBAL-GESPRAECH] Vortag ${vortag} · kurz ${kurz} · Ergebnis-Aufgaben ${ergebnis} · Leitung ${leitung}`);
  return summe > 0;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Liste für das Chefbüro (Global-Kunden › Gespräche)
// ───────────────────────────────────────────────────────────────────────────

export interface GespraechZeile {
  id: number; beginn: string; dauerMin: number; status: string; herkunft: string | null;
  name: string; firma: string | null; kontakt: string | null; telefon: string | null; email: string | null;
  wer: string | null; vortagAm: string | null; kurzAm: string | null; ergebnisAufgabeAm: string | null; leitungAm: string | null;
  nichtErreichtMailAm: string | null; erledigtAm: string | null; verpasstGrund: string | null;
}

export async function globalGespraecheListe(jetzt: Date = new Date()): Promise<{ offen: GespraechZeile[]; kommend: GespraechZeile[]; zuletzt: GespraechZeile[] }> {
  await ensureGlobalGespraechSpalten();
  const rows = (await sqlPool`
    SELECT t.id, t.beginn, COALESCE(t.dauer_min, 30) AS dauer_min, t.status, t.herkunft, t.erinnert_am, t.kurz_erinnert_am,
           t.ergebnis_aufgabe_am, t.ergebnis_leitung_am, t.verpasst_mail_am, t.erledigt_am, t.verpasst_grund,
           NULLIF(p.company_name, '') AS firma,
           NULLIF(TRIM(CONCAT_WS(' ', NULLIF(p.first_name, ''), NULLIF(p.last_name, ''))), '') AS person_name, p.contact_name,
           NULLIF(p.primary_phone, '') AS telefon, NULLIF(p.primary_email, '') AS email, ag.name AS wer
      FROM fiaon_termine t
      LEFT JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.quelle = 'global'
       AND t.beginn > ${new Date(jetzt.getTime() - 30 * 86_400_000)} AND t.beginn < ${new Date(jetzt.getTime() + 21 * 86_400_000)}
     ORDER BY t.beginn ASC`) as any[];
  const iso = (v: unknown) => (v ? new Date(v as any).toISOString() : null);
  const zeilen: GespraechZeile[] = rows.map((r) => ({
    id: Number(r.id), beginn: new Date(r.beginn).toISOString(), dauerMin: Number(r.dauer_min), status: String(r.status), herkunft: r.herkunft ?? null,
    name: gespraechName({ firma: r.firma, vorname: null, nachname: r.person_name || r.contact_name }),
    firma: r.firma ?? null, kontakt: r.person_name || r.contact_name || null, telefon: r.telefon ?? null, email: r.email ?? null,
    wer: r.wer ?? null, vortagAm: iso(r.erinnert_am), kurzAm: iso(r.kurz_erinnert_am), ergebnisAufgabeAm: iso(r.ergebnis_aufgabe_am),
    leitungAm: iso(r.ergebnis_leitung_am), nichtErreichtMailAm: iso(r.verpasst_mail_am), erledigtAm: iso(r.erledigt_am), verpasstGrund: r.verpasst_grund ?? null,
  }));
  const jetztMs = jetzt.getTime();
  // Vorbei und noch „gebucht“ — oder vom früheren Lauf still auf „verpasst“ gesetzt (ohne erledigt_am): hier fehlt das Ergebnis.
  const ohneErgebnis = (z: GespraechZeile) => z.status === "gebucht" || (z.status === "verpasst" && !z.erledigtAm);
  return {
    offen: zeilen.filter((z) => ohneErgebnis(z) && new Date(z.beginn).getTime() < jetztMs),
    kommend: zeilen.filter((z) => z.status === "gebucht" && new Date(z.beginn).getTime() >= jetztMs),
    zuletzt: zeilen.filter((z) => !ohneErgebnis(z) && new Date(z.beginn).getTime() < jetztMs).reverse().slice(0, 12),
  };
}
