// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUGE DES POSTMEISTERS (02.09.2026, E-094)
//
// JUSTINS AUFTRAG: „Der Agent muss eben auch HANDELN — also eine Notiz an den
// zuständigen Betreuer: ‚He, der Kunde ist unrund wegen …' oder ‚Der Kunde
// will nicht bezahlen, bitte anrufen bevor ich es eskalieren lasse'. […] Sei
// E-Mail-Agent soll also wirklich VOLL agieren können — neben Notizen machen,
// 100 % menschlich und passend schreiben, agieren, volle Funktion haben,
// stornieren, Accounts aktivieren, Links verschicken, einfach ALLES!"
//
// DIE GRENZE, die das Haus zieht: Ein Werkzeug ist entweder FREI (der Agent
// führt es sofort aus, es ist rückholbar und bewegt kein Geld) oder es braucht
// eine BESTÄTIGUNG (ein Mensch klickt in der Werkbank). Geld buchen, Raten
// erlassen, Rückerstattungen — dafür gibt es hier kein Werkzeug, in keiner
// Stufe. Wer Geld bewegt, ist ein Mensch.
//
// WARUM DAS ÜBERHAUPT GEBAUT WIRD: In der Analyse vom 02.09. versprachen
// Antworten Dinge, die niemand tat — „wir nehmen Sie aus dem Verteiler"
// (Sperre nie gesetzt), „ich habe das weitergeleitet" (nichts weitergeleitet),
// „wir stellen die Erinnerungen ein" (Mahnkette lief weiter). Ein Werkzeug,
// das wirklich ausgeführt wird, ist die einzige ehrliche Form eines
// Versprechens.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import {
  AUSKUNFT_LAGEN, AUSKUNFT_ANTWORT_LAGEN, KEIN_VERKAUF_FLAGS, auskunftLageErlaubt, fragtNachAuskunftSelbst, lehntAuskunftAb,
  bezogenAufAuskunftAngebot, widersprichtWerbung,
  type Flags, type Kundenlage,
} from "@shared/fiaon-postmeister-typen";
import { istGlobalPaket } from "@shared/fiaon-pakete";
import {
  auskunftLeistung, auskunftWort, auskunfteienText, euroText, AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_PREISE_CENTS,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { auskunftArtFuer } from "./fiaon-postmeister-dossier";
import { ANGEBOT_VERMERK, antwortAufAngebot, kundeFragtNachAuskunft } from "./fiaon-auskunft";
import { auskunftAngebotBaustein, ANGEBOT_FASSUNGEN, ANGEBOT_SEGMENTE, ANGEBOT_BETREFF_VARIANTEN } from "../mail/vorlagen/auskunft-verkauf";
import { zeitFuerKunde, bausteinKuendigung, kuendigungRatenAufteilen, abstreitenArt, stoppWunsch, istLoeschwunsch } from "@shared/fiaon-mara-ton";
// E-275 (02.10.2026): die Sätze zum Weg der Karte — dieselben wie in der Einladung und auf WhatsApp.
import { KARTE_ZEIT_SATZ } from "@shared/fiaon-karten-weg";
// E-265 (01.10.2026, Paket Recht): Das Vertragsende beim Altvertrag — Ende des Abrechnungsmonats (vertragsendeLesen).
import { giltZumSatz, tagDeutsch } from "@shared/fiaon-antrag-stand";
import {
  vertretungFuerPerson, anruferFuer, freiePlaetzeVertreter, bisText,
  uebergabeVertretung, uebergabeVertretungAbgeleitet, heikleUebergabe, betreiberKopie, type UebergabeVertretung,
} from "./fiaon-abwesenheit";
import { nennform } from "@shared/fiaon-mitarbeiter-name";
import { antragAbgeschickt } from "@shared/fiaon-antrag-stand";
// E-272 (02.10.2026): Global-Kunde als Merkmal der PERSON — die eine Regel (fiaon-global-kunde.ts).
import { istGlobalKunde } from "./fiaon-global-kunde";
import { produktkategorie } from "./fiaon-produktkategorie";

export type Stufe = "frei" | "bestaetigen";

export interface WerkzeugKontext {
  /** Person und Bestellung, um die es geht (kann leer sein: unbekannter Absender). */
  personId: number | null;
  ref: string | null;
  postfach: string;
  /** Zeile in fiaon_postmeister — jede Handlung wird dort protokolliert. */
  postmeisterId: number | null;
  kundenlage: Kundenlage;
  /** Wörtliches Zitat aus der Kundenmail — Pflicht bei Sperren und Kündigung. */
  zitat?: string | null;
  /** Die Lampen der Einordnung (E-240): Bei Kündigung, Beschwerde, „Stopp" usw. wird nichts verkauft. */
  flags?: Partial<Flags> | null;
  /** Was der Kunde geschrieben hat (gekürzt) — steht in der Aufgabe an den Betreuer (E-240). */
  kundeText?: string | null;
  /** Betreff seiner Mail — „Re: …" auf ein Angebot heißt: er antwortet darauf (gemeinsame Bremse, 25.09.2026). */
  betreff?: string | null;
  /** Gesetzt, sobald der Betreuer in diesem Lauf von der Auskunft erfahren hat — nie zweimal je Mail. */
  auskunftGemeldet?: boolean;
  /**
   * 25.09.2026 (E-241): Antwortet die Mail auf das Angebot der Auskunft („angebot")
   * oder fragt der Kunde selbst danach („frage")? Nur dann verkauft Mara sie auch
   * einem offenen Antrag oder einem Lead (AUSKUNFT_ANTWORT_LAGEN). Rechnet der Lauf
   * (auskunftAntwortArt), nie das Modell.
   */
  auskunftAntwort?: AuskunftAntwort;
  /**
   * 28.09.2026 (E-248): Vertrag nach der Fassung vor dem 03.09.2026 (agb_stand leer
   * oder älter) — laut Hauswissen „monatlich kündbar, formlos". Dann genügt jede
   * klare Aussage („bitte alles stornieren"), kein fester Wortlaut (#5625).
   */
  formlosKuendbar?: boolean;
  /**
   * 28.09.2026 (E-248): Diese Antwort ist KEINE Zahlungsaufforderung (Stopp,
   * Widerruf, Beschwerde, bestrittene Forderung, Anwalt, „kann nicht zahlen",
   * offener Einwand aus einer früheren Mail). Der Grund steht hier; die
   * Zahlungsseite gibt es dann nicht, die Rechnung nur auf ausdrücklichen Wunsch.
   * Rechnet der Server (zahlungsRuhe), nie das Modell.
   */
  ruhe?: string | null;
}

/**
 * Der künftige, gebuchte Termin eines Menschen (E-248) — für Rückruf und Terminlink
 * per Mail. Dieselbe Regel wie auf WhatsApp (kuenftigerTermin): Status „gebucht",
 * Beginn nicht länger als 20 Minuten vorbei. Die Zeit so, wie der Kunde sie liest.
 */
export async function bestehenderTermin(personId: number): Promise<{ id: number; beginn: string; vorname: string | null; kundenText: string } | null> {
  // E-265 (29.09.2026): `vorname` trägt die NENNFORM („Herr Stripling") — der Kunde liest sie so.
  const [t] = (await sqlPool`
    SELECT t.id, t.agent_id, t.beginn, t.quelle, a.name, a.first_name, a.last_name, a.anrede
      FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id
     WHERE t.person_id = ${personId} AND t.status = 'gebucht' AND t.beginn > NOW() - INTERVAL '20 minutes'
     ORDER BY t.beginn LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  const b = new Date(t.beginn);
  // E-260: Liegt der Termin bei einem Abwesenden, nennt Mara den, der wirklich anruft (B2).
  // Vertretung (01.10.2026): Gründer- und Global-Gespräche nie (Quelle mit).
  const vorname = t.name || t.first_name ? await anruferFuer(Number(t.agent_id), b, nennform(t).nom, undefined, t.quelle) : null;
  return { id: Number(t.id), beginn: b.toISOString(), vorname, kundenText: zeitFuerKunde(b) };
}

/** „YYYY-MM-DD HH:MM" als Berliner Zeit lesen — ohne Number(format()) (Zeit-Falle). Null, wenn unlesbar. */
export function berlinZeitLesen(roh: string): Date | null {
  const m = String(roh || "").trim().replace("T", " ").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const [j, mo, t, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(j, mo - 1, t, h, mi);
  // Versatz Berlins zu diesem Zeitpunkt über formatToParts (Sommer- und Winterzeit).
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(utc));
  const w = (n: string) => Number(teile.find((x) => x.type === n)?.value ?? "0");
  const alsBerlin = Date.UTC(w("year"), w("month") - 1, w("day"), w("hour") % 24, w("minute"));
  const d = new Date(utc - (alsBerlin - utc));
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Verlangt der Kunde ausdrücklich eine Rechnung, einen Beleg oder die Zahlungsdaten? Rein. */
export function kundeWillRechnung(text: unknown): boolean {
  return /\b(rechnung\w*|beleg\w*|quittung\w*|invoice|factura|fattura|facture|zahlungsdaten|bankdaten|kontodaten|bankverbindung|iban)\b/i.test(String(text ?? ""));
}

export interface WerkzeugErgebnis {
  ok: boolean;
  /** Was der Agent im Text sagen darf — knapp und wahr. */
  ergebnis: string;
  /** Felder, auf die sich die Antwort berufen darf (Belegpflicht). */
  daten?: Record<string, unknown>;
  fehler?: string;
}

export interface Werkzeug {
  name: string;
  /** Für das Modell: WAS es tut und WANN es zu benutzen ist. */
  beschreibung: string;
  stufe: Stufe;
  /** In welchen Lagen es dem Modell überhaupt angeboten wird. */
  lagen: Kundenlage[] | "alle";
  parameter: Record<string, unknown>;
  ausfuehren: (p: any, k: WerkzeugKontext) => Promise<WerkzeugErgebnis>;
}

// ── Hilfen ────────────────────────────────────────────────────────────────

/** Jede Handlung landet in der Akte UND an der Postmeister-Zeile. */
/** Der Name des Kunden, wie er im Titel einer Aufgabe stehen soll (05.09.2026). */
async function kundenNameFuer(personId: number | null, ref: string | null): Promise<string | null> {
  try {
    if (personId) {
      const [p] = (await sqlPool`SELECT first_name, last_name, company_name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
      const n = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || String(p?.company_name || "").trim();
      if (n) return n;
    }
    if (ref) {
      const [a] = (await sqlPool`SELECT first_name, last_name FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
      const n = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim();
      if (n) return n;
    }
  } catch { /* ohne Namen weiter */ }
  return null;
}

/**
 * Die Referenz, unter der ein Vermerk in der Akte steht (24.09.2026, E-240).
 * `fiaon_contact_log.ref` ist NOT NULL — ohne Bestellung im Vorgang ging jede
 * Handlung Maras bisher still verloren. Jetzt: die Bestellung des Vorgangs,
 * sonst die jüngste der Person (bezahlte zuerst), ohne Person gar nichts.
 */
export async function akteRef(personId: number | null, ref: string | null): Promise<string | null> {
  if (ref) return ref;
  if (!personId) return null;
  const [b] = (await sqlPool`
    SELECT ref FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1
  `.catch(() => [])) as any[];
  return b?.ref ?? null;
}

async function protokoll(k: WerkzeugKontext, werkzeug: string, text: string, sichtbar = true): Promise<void> {
  const ref = sichtbar ? await akteRef(k.personId, k.ref) : null;
  if (ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${ref}, ${k.personId ?? null}, NULL, 'Postmeister', 'system', ${text.slice(0, 900)})
    `.catch(() => {});
  }
  if (k.postmeisterId) {
    await sqlPool`
      UPDATE fiaon_postmeister
         SET handlungen = COALESCE(handlungen, '[]'::jsonb) || ${JSON.stringify([{ werkzeug, ergebnis: text.slice(0, 300), am: new Date().toISOString() }])}::jsonb,
             updated_at = NOW()
       WHERE id = ${k.postmeisterId}
    `.catch(() => {});
  }
}

/**
 * Hat ein früherer Anlauf zu DIESER Mail das Werkzeug schon ausgeführt? (E-246)
 * protokoll() schreibt jede Handlung an die Postmeister-Zeile; legt die KI-Pause
 * eine Mail mitten im Lauf zurück (oder scheitert ein Anlauf), bleiben sie dort
 * stehen. Liefert den Ergebnistext des früheren Laufs oder null.
 */
async function frueherInDieserMail(k: WerkzeugKontext, werkzeug: string): Promise<string | null> {
  if (!k.postmeisterId) return null;
  const [z] = (await sqlPool`SELECT handlungen FROM fiaon_postmeister WHERE id = ${k.postmeisterId}`.catch(() => [])) as any[];
  // Jede Form, die es gibt: jsonb-Text „[…]", Array aus solchen Texten (protokoll hängt Text an), echte Liste.
  const flach = (w: unknown, tiefe = 0): any[] => {
    if (w == null || tiefe > 4) return [];
    if (typeof w === "string") { try { return flach(JSON.parse(w), tiefe + 1); } catch { return []; } }
    if (Array.isArray(w)) return w.flatMap((x) => flach(x, tiefe + 1));
    return typeof w === "object" ? [w] : [];
  };
  const h = flach(z?.handlungen).find((x: any) => x && x.werkzeug === werkzeug && x.ok !== false);
  return h ? String(h.ergebnis ?? "") : null;
}

/**
 * DER ZUSTÄNDIGE MENSCH — dieselbe Ableitung wie für Aufträge.
 *
 * ── DER SCHADEN (04.09.2026, E-116) ─────────────────────────────────────
 * Hier stand eine eigene Abfrage: Betreuer der Person, sonst
 * `rolle IN ('vertriebsleitung', 'leitung', 'admin')`. Die ersten beiden
 * Rollen gibt es nicht — die Abfrage traf null Zeilen, und jede Notiz für
 * einen Kunden ohne Betreuer landete unsichtbar beim Betreiber
 * (zustaendig_art 'betreiber'; /agent/aufgaben liest nur 'agent'). Nach der
 * Korrektur der Namen blieb der zweite Fehler: ZWEI Ableitungen für dieselbe
 * Frage. Praxistest an der echten Datenbank: Kunde 12982 ohne Betreuer —
 * notiz_an_betreuer ging an Daniel (erster nach id), aufgabe_an_betreuer an
 * Florentine (wenigste offene Aufträge). Zwei Antworten auf eine Frage sind
 * die Fehlerklasse aus fiaon-zustaendigkeit.ts.
 *
 * ── JETZT ───────────────────────────────────────────────────────────────
 * `auftragEmpfaenger` (fiaon-betreiber-todo.ts, E-115) entscheidet für
 * Notiz, Eskalation UND Auftrag: der eingetragene Betreuer, sofern aktiv und
 * kein Testkonto — Besitz gewinnt, auch im Rückstand, denn Justins Auftrag im
 * Kopf dieser Datei („bitte anrufen, bevor ich es eskalieren lasse") meint
 * genau ihn (E-045). Ohne Betreuer die Rolle zur Lage über `zustaendigeRolle`
 * (Rückstand → Forderungsmanagement, sonst Vertriebsleitung, je mit der
 * kleinsten Last), sonst der Betreiber. Nie ein beliebiger Bonitätsmanager:
 * niemand besitzt einen Kunden vor dem Mandat, und eine Aufgabe ist keine
 * Zuteilung. Rollen-Literale prüft `scripts/pruef-rollen.ts`.
 */
async function zustaendig(personId: number | null): Promise<{ id: number | null; name: string; kundenName: string; vertretung?: boolean; board?: boolean; vt?: UebergabeVertretung | null; global?: boolean }> {
  // E-272 (02.10.2026): Ein Global-Kunde gehört nicht in den Privatvertrieb — Notiz und Aufgabe liegen beim
  // Betreiber, wie jede Aufgabe aus FIAON Global (fiaon-global-angebot.ts: anBetreiber). Justin zum Fall
  // Hildbrand: „nehme ihn bitte komplett aus den Workflows … Er soll Global bleiben.“
  if (personId && await istGlobalKunde(personId).catch(() => false)) {
    return { id: null, name: "Leitung (FIAON Global)", kundenName: "unsere Leitung", board: true, global: true };
  }
  // E-260 (29.09.2026): Team abwesend — Notiz und Eskalation gehen nicht an Abwesende,
  // und der Kunde liest den Namen dessen, der wirklich anruft.
  // Vertretung (01.10.2026): Ist der Vertreter ein echter Mitarbeiter, bekommt ER sie; ist er der
  // Betreiber, liegen sie auf dessen Board (wie E-260). Auch, wenn nicht der Kunde, aber der
  // abgeleitete Empfänger abwesend ist (uebergabeVertretungAbgeleitet).
  const vt = await uebergabeVertretungAbgeleitet(personId);
  if (vt) {
    const v = vt.ab.vertreter;
    // E-265: der Kunde liest die Nennform des Vertreters („Nikita Boychenko", mit Anrede „Herr Boychenko").
    return { id: vt.anVertreter ? v.id : null, name: `${v.vorname} (Vertretung)`, kundenName: v.anrufName, vertretung: true, board: !vt.anVertreter, vt };
  }
  const { auftragEmpfaenger } = await import("../routes/fiaon-betreiber-todo");
  const wer = await auftragEmpfaenger(personId);
  // `name` = intern (Vorname, „Postmeister an Nikita: …"); `kundenName` = was
  // der Kunde liest („Herr Stripling" oder „Daniel Stripling"), nie nur der Vorname.
  return wer.id
    ? { id: wer.id, name: String(wer.vorname || "").trim() || String(wer.name || "").trim() || "Leitung", kundenName: wer.kundenName || String(wer.name || "").trim() || "unsere Leitung" }
    : { id: null, name: "Leitung", kundenName: "unsere Leitung" };
}

// ── Die Werkzeuge ─────────────────────────────────────────────────────────

/**
 * NOTIZ AN DEN BETREUER — das Werkzeug, das Justin ausdrücklich verlangt hat.
 * Kein Kundenkontakt, keine Mail an den Kunden: eine Nachricht an den
 * Menschen, der diesen Kunden kennt, mit Ton und Dringlichkeit.
 */
export const notizAnBetreuer: Werkzeug = {
  name: "notiz_an_betreuer",
  // E-275 (02.10.2026, Justin: „Mara soll selbstständig arbeiten …“): Die Notiz ist STILL — der Kunde erfährt nichts
  // davon, und sie ersetzt keine Antwort. Unterlagen per Mail gehen seitdem hierüber (vorher Aufgabe + „Herr X prüft“).
  beschreibung: "Schreibt dem zuständigen Betreuer eine kurze, STILLE Nachricht in die Akte (der Kunde erfährt nichts davon). Für alles, was das Team wissen oder nachtragen muss, während DU dem Kunden selbst und vollständig antwortest: eingereichte Unterlagen oder Bilder per Mail (Ausweis, Kontoauszug, Auskunft, Screenshot), ein Hinweis zur Akte, ein Technik-Fehler, den du nicht lösen kannst. NICHT bei Ärger, Zahlungsverweigerung, Anwaltsdrohung, Kündigung oder angeblicher früherer Kündigung — das beantwortest du selbst (Vertrag, offene Rate, Zahlungsseite, Härte-Stufe). Dem Kunden schreibst du danach NIE „Herr X prüft das“ oder „meldet sich“ — du sagst, was du erledigt hast und wie es weitergeht. Schreib die Notiz so, wie du es einem Kollegen sagen würdest.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      text: { type: "string", description: "Die Nachricht an den Kollegen. Konkret, ein bis drei Sätze, mit dem Grund." },
      dringend: { type: "boolean", description: "true, wenn heute jemand handeln muss (Anwaltsdrohung, Beschwerde, drohende Eskalation)." },
      anrufen: { type: "boolean", description: "true, wenn ein Anruf nötig ist — dann wird ein Rückruf eingeplant." },
    },
    required: ["text", "dringend", "anrufen"],
  },
  async ausfuehren(p, k) {
    const wer = await zustaendig(k.personId);
    const text = String(p.text || "").trim().slice(0, 800);
    if (text.length < 10) return { ok: false, ergebnis: "", fehler: "Die Notiz ist zu kurz." };
    await protokoll(k, "notiz_an_betreuer", `Postmeister an ${wer.name}: ${text}`);
    // ── DIE NOTIZ ERREICHT DEN MENSCHEN (24.09.2026, E-240) ───────────────
    // Bis hierher ein nacktes INSERT in fiaon_betreiber_todos: keine Übergabe
    // (agent_gelesen_am, delegiert_am blieben leer), keine Mail an den
    // Betreuer, kein Ereignis in fiaon_agent_events — die Notiz stand nur da,
    // wenn jemand zufällig in seine Aufträge sah (392 von 404 Aufgaben
    // ungelesen). Jetzt derselbe Weg wie aufgabe_an_betreuer: auftragFuerKunden
    // übergibt, schreibt die Mail aufgabe_zugewiesen und das Ereignis, auf das
    // das Betreuer-Popup hört. Idempotent je Person und Tag wie vorher —
    // weitere Notizen hängen sich an und machen die Aufgabe wieder ungelesen.
    const heute = new Date().toISOString().slice(0, 10);
    const kundenName = await kundenNameFuer(k.personId, k.ref);
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: k.personId, ref: k.ref,
      titel: `${kundenName ? `${kundenName}: ` : ""}${p.dringend ? "braucht heute jemanden" : "Hinweis von Mara"}`.slice(0, 160),
      text, dringend: !!p.dringend,
      faelligAm: p.dringend ? heute : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
      schluessel: `postmeister:${k.personId ?? k.ref ?? "unbekannt"}:${heute}`,
      quelle: "postmeister", autorName: "Mara", agentId: wer.id ?? null, anBetreiber: !!wer.board,
      link: k.personId ? `/agent/kunden?person=${k.personId}` : k.ref ? `/agent/kunden?ref=${k.ref}` : null,
    }).catch((e) => console.error("[POSTMEISTER] Notiz an Betreuer:", String(e).slice(0, 160)));
    // Vertretung (01.10.2026): Heikles beim Vertreter sieht der Betreiber zusätzlich auf seinem Board.
    if (wer.vt?.anVertreter && heikleUebergabe(text)) {
      await betreiberKopie({
        personId: k.personId, ref: k.ref, titel: `${kundenName ? `${kundenName}: ` : ""}Hinweis von Mara`, text, dringend: true,
        schluessel: `postmeister:${k.personId ?? k.ref ?? "unbekannt"}:${heute}`, quelle: "postmeister",
        link: k.personId ? `/agent/kunden?person=${k.personId}` : k.ref ? `/agent/kunden?ref=${k.ref}` : null,
      }, wer.vt);
    }
    // E-272: Beim Global-Kunden kein Eintrag in die Rückruf-Liste des Vertriebs (sie geht an Betreuer oder
    // Vertriebsleitung) — die Aufgabe liegt beim Betreiber, der ruft selbst an.
    if (p.anrufen && k.personId && !wer.global) {
      try {
        const { rueckrufAufnehmen } = await import("./fiaon-rueckruf");
        await rueckrufAufnehmen({
          personId: k.personId, quelle: "mail_inbound",
          quelleId: `postmeister-notiz-${k.postmeisterId ?? Date.now()}`,
          anliegen: text.slice(0, 300), kontakt: null,
        } as any);
      } catch { /* Rückruf ist ein Zusatz, kein Muss */ }
    }
    // E-275 (02.10.2026): ohne Anruf ist die Notiz still — das Ergebnis sagt es dem Modell, damit aus ihr kein
    // „Herr X ist informiert und kümmert sich“ in der Kundenmail wird (gemessen: 186 von 400 Antworten nannten einen Mitarbeiter).
    return {
      ok: true,
      ergebnis: p.anrufen ? `${wer.kundenName} ist informiert und ruft Sie an.` : "Intern notiert (still) — dem Kunden nicht erwähnen; beantworte sein Anliegen selbst und vollständig.",
      daten: { betreuer: wer.kundenName, betreuer_intern: wer.name, dringend: !!p.dringend, still: !p.anrufen },
    };
  },
};

/**
 * AUFGABE AN DEN BETREUER — 04.09.2026 (E-115). Eine Notiz ist ein Hinweis;
 * das hier ist ein Auftrag mit Titel, Frist und Mail an den Menschen. Justin:
 * „Mitarbeiter ein TODO bekommt … also dass Handlungen PASSIEREN."
 */
export const aufgabeAnBetreuer: Werkzeug = {
  name: "aufgabe_an_betreuer",
  // E-275 (02.10.2026, Justin: „MARA verweist immer mehr auf die Mitarbeiter … Mara soll selbstständig arbeiten“):
  // Unterlagen stehen hier nicht mehr (die gehen still über notiz_an_betreuer), und die Aufgabe ist kein Ersatz für
  // die Antwort. Gemessen 18.09.–02.10.: 115 Aufgaben, 28 davon nur wegen Unterlagen, 186 von 400 Antworten nannten
  // einen Mitarbeiter.
  beschreibung: "Legt einem Menschen eine echte Aufgabe mit Titel, Auftrag und Frist an (Portal unter Aufträge, dazu eine Mail an ihn). NUR in diesen Fällen: (1) der Kunde will AUSDRÜCKLICH einen Rückruf oder ein Gespräch (rueckruf_am, wenn er eine Zeit nennt), (2) Geld zurück, Erstattung, Widerruf nach Zahlung oder Kulanz (kollege Leitung), (3) ein Zahlungsbeleg oder eine Buchungsfrage (kollege Zahlung — nur sie sieht das Bankbuch), (4) eine Datenänderung oder Bescheinigung, für die du kein Werkzeug hast, (5) ein Technik-Fehler, den du nicht selbst lösen kannst. NIE für Unterlagen oder Bilder per Mail (dafür notiz_an_betreuer, still), nie für Karten-, Zahlungs-, Zugangs- oder Ablauffragen, nie um eine Zahlung, Kündigung oder Beschwerde „prüfen zu lassen“ — das erledigst du selbst. Die Aufgabe ersetzt nie deine Antwort: Du beantwortest trotzdem JETZT alles selbst; „X meldet sich“ schreibst du nur bei einem Rückruf, den er wollte.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      titel: { type: "string", description: "Kurz wie eine Betreffzeile: was zu tun ist, mit Namen des Kunden. Beispiel: „Herrn Köhler zurückrufen — frühere Kündigung prüfen\"." },
      text: { type: "string", description: "Der Auftrag in zwei bis vier Sätzen: Lage, was der Kunde will, was zu tun ist, was du ihm zugesagt hast." },
      faellig_in_tagen: { type: "integer", description: "0 = heute, 1 = morgen, 2 = übermorgen. Höchstens 7." },
      dringend: { type: "boolean", description: "true, wenn heute jemand handeln muss (Anwaltsdrohung, Beschwerde, Kunde wartet auf Rückruf)." },
      kollege: { type: "string", description: "Nennt der Kunde einen Mitarbeiter mit Namen (etwa Frau Rifka oder Herr Stripling), dann dieser Name — die Aufgabe geht an ihn. \"Leitung\" für Entscheidungen über Geld zurück (Widerruf, Kulanz). \"Zahlung\" für Zahlungsbelege und Buchungsfragen (geht an die Zahlungsstelle, nicht an den Betreuer). Sonst leer." },
      rueckruf_am: { type: "string", description: "Nennt der Kunde eine Zeit für den Rückruf („heute 17 Uhr“, „morgen Vormittag“), dann hier als YYYY-MM-DD HH:MM (Berlin). Der Rückruf steht dann als Termin im Kalender des Mitarbeiters. Sonst leer." },
    },
    required: ["titel", "text", "faellig_in_tagen", "dringend", "kollege", "rueckruf_am"],
  },
  async ausfuehren(p, k) {
    const titel = String(p.titel || "").trim().slice(0, 160);
    const text = String(p.text || "").trim().slice(0, 2000);
    if (titel.length < 5 || text.length < 10) return { ok: false, ergebnis: "", fehler: "Titel oder Auftrag zu kurz." };
    const tage = Math.max(0, Math.min(7, Math.round(Number(p.faellig_in_tagen)) || 0));
    const faelligAm = new Date(Date.now() + tage * 864e5).toISOString().slice(0, 10);
    const { auftragFuerKunden, mitarbeiterNachName } = await import("../routes/fiaon-betreiber-todo");
    // Nennt der Kunde jemanden („Frau Rifka"), bekommt der die Aufgabe — nicht die Ableitung.
    // „Leitung" (05.09.2026): Geld-zurück-Entscheidungen gehen an einen
    // Vertriebsleiter mit offenem Zugang, nie an den Betreuer.
    const kollege = String(p.kollege || "");
    const leitungGewollt = /\b(leitung|chef|gesch[äa]ftsf[üu]hr\w*|management)\b/i.test(kollege);
    // „Zahlung" (05.09.2026, Florentine Punkt 5): Ein Zahlungsbeleg geht an
    // die Stelle, die das Bankbuch sieht (Forderungsmanagement), sonst an die
    // Leitung — nie an einen Betreuer, der die Zahlung gar nicht prüfen kann.
    const zahlungGewollt = /\b(zahlung|beleg|buchhaltung|inkasso|forderung|bankbuch)\b/i.test(kollege);
    const nachRolle = async (rollen: string[]) => {
      const [l] = (await sqlPool`
        SELECT id FROM fiaon_agents
         WHERE COALESCE(active, TRUE) = TRUE AND rolle = ANY(${rollen}) AND COALESCE(is_test_account, FALSE) = FALSE AND zugang_gesperrt_am IS NULL
         ORDER BY array_position(${rollen}::text[], rolle), id ASC LIMIT 1
      `.catch(() => [])) as any[];
      return l?.id ? { id: Number(l.id) } : null;
    };
    // E-272 (02.10.2026): Beim Global-Kunden geht die Aufgabe an den Betreiber (wie jede Aufgabe aus FIAON
    // Global, fiaon-global-angebot.ts: anBetreiber) — nie an die Vertriebsleitung oder einen Privat-Betreuer.
    // Nur wer ausdrücklich einen Mitarbeiter mit Namen nennt, bekommt ihn.
    const globalKunde = k.personId ? await istGlobalKunde(k.personId).catch(() => false) : false;
    const gewuenscht = globalKunde
      ? (!zahlungGewollt && !leitungGewollt && p.kollege ? await mitarbeiterNachName(kollege).catch(() => null) : null)
      : zahlungGewollt
      ? await nachRolle(["inkasso", "vertriebsleiter"])
      : leitungGewollt
        ? await nachRolle(["vertriebsleiter"])
        : p.kollege ? await mitarbeiterNachName(kollege).catch(() => null) : null;
    // ── DIE MAIL STEHT IN DER AUFGABE (Florentine Punkt 8) ────────────────
    // „Bei den Tasks sehen wir nicht, wann eine E-Mail geschrieben wurde und
    // von wem." Kopfzeile mit Datum, Absender, Betreff und Vorschau; die
    // Marke [Mail #id] öffnet die ganze Mail im Portal.
    let mailKopf = "";
    if (k.postmeisterId) {
      const [m] = (await sqlPool`
        SELECT von, betreff, empfangen_am, text FROM fiaon_postmeister WHERE id = ${k.postmeisterId} LIMIT 1
      `.catch(() => [])) as any[];
      if (m) {
        const wann = m.empfangen_am ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(m.empfangen_am)) : "";
        const vorschau = String(m.text || "").replace(/\s+/g, " ").trim().slice(0, 220);
        mailKopf = `E-Mail vom ${wann} von ${String(m.von || "").slice(0, 80)} · Betreff: „${String(m.betreff || "").slice(0, 100)}" [Mail #${k.postmeisterId}]\n„${vorschau}${vorschau.length >= 220 ? " …" : ""}"\n\n`;
      }
    }
    // ── DER KUNDE STEHT IM TITEL (05.09.2026, Florentine/Daniel) ──────────
    // „Manche Aufgaben sind ohne Namen — wer ist das?" Das Modell soll den Namen
    // nennen; tut es das nicht, setzt der Server ihn davor.
    const kundenName = await kundenNameFuer(k.personId, k.ref);
    const titelMitName = kundenName && !titel.toLowerCase().includes((kundenName.toLowerCase().split(" ").pop() || "§"))
      ? `${kundenName}: ${titel}`.slice(0, 160) : titel;
    // ── ZAHLUNGEN PRÜFT NUR DIE ZAHLUNGSSTELLE (05.09.2026) ───────────────
    // Florentine: „Kunde schreibt, er habe am 20.08. bezahlt, und die KI sagt,
    // ich solle das kontrollieren." Kein Mitarbeiter sieht das Konto. Solche
    // Aufgaben bleiben bei Justin (Bankbuch); die Bestellung wird als „Zahlung
    // gemeldet" markiert, damit der Kontoabgleich sie kennt.
    let zahlungGemeldet = "";
    if (zahlungGewollt && k.ref) {
      const [o] = (await sqlPool`SELECT payment_status, status, current_step, submitted_at, type, ref, pack_key FROM fiaon_applications WHERE ref = ${k.ref} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
      // E-264: nur eine ABGESCHICKTE Bestellung kann „Zahlung gemeldet" werden — auf einen nie abgeschickten Antrag gibt es keine Rechnung.
      // E-272: beim Global-Kunden nur sein Global-Auftrag — sein Beleg gilt nie einem alten Privatantrag.
      if (o?.payment_status === "pending_payment" && antragAbgeschickt(o) && !(globalKunde && produktkategorie(o) !== "global")) {
        await sqlPool`UPDATE fiaon_applications SET payment_status = 'claimed_paid', claimed_paid_at = COALESCE(claimed_paid_at, NOW()), updated_at = NOW() WHERE ref = ${k.ref}`.catch(() => {});
        zahlungGemeldet = " Die Bestellung steht jetzt auf „Zahlung gemeldet\".";
      }
    }
    // ── E-260 (29.09.2026): TEAM ABWESEND ─────────────────────────────────
    // Ginge die Aufgabe an jemanden, der bis „bis" nicht da ist (Betreuer, die
    // Vertriebsleitung, ein genannter Kollege), liegt sie auf dem Board des
    // Betreibers; der Rückruf kommt in den Kalender des Vertreters, und der
    // Kunde liest dessen Namen. Zahlungsbelege gehen wie immer an die Zahlungsstelle.
    // Vertretung (01.10.2026): Ist der Vertreter ein echter Mitarbeiter, bekommt ER die Aufgabe (nicht das
    // Board); Heikles — und Entscheidungen der Leitung — sieht der Betreiber zusätzlich (betreiberKopie).
    const vtUeb = zahlungGewollt || (globalKunde && !gewuenscht) ? null
      : gewuenscht ? await uebergabeVertretung(k.personId, gewuenscht.id) : await uebergabeVertretungAbgeleitet(k.personId);
    const abw = vtUeb?.ab ?? null;
    const vtPerson = abw && k.personId ? await vertretungFuerPerson(k.personId).catch(() => null) : null;
    const zielAbwesend = !!vtUeb;
    const erg = await auftragFuerKunden({
      personId: k.personId, ref: k.ref, titel: titelMitName, text: mailKopf + text, faelligAm, dringend: !!p.dringend,
      // Eine Aufgabe je Kunde und Tag — drei gleiche Mails (Frau Weber, 25.08.)
      // ergaben drei Aufgaben. Der Text wird an die bestehende angehängt.
      // 07.09.2026 (Daniel, Feedback 5): EIN Auftrag je Kunde, nicht je Mail und Tag. Fünf Mails
      // desselben Menschen hängen sich als Beiträge an denselben Auftrag; erledigt → die nächste
      // Mail öffnet ihn wieder (auftragFuerKunden, ON CONFLICT schluessel).
      schluessel: `postmeister:${k.personId ?? k.ref ?? k.postmeisterId ?? "x"}:aufgabe`,
      quelle: "postmeister", autorName: "Mara",
      agentId: zahlungGewollt ? null : vtUeb ? (vtUeb.anVertreter ? vtUeb.ab.vertreter.id : null) : (gewuenscht?.id ?? null),
      anBetreiber: zahlungGewollt || (!!vtUeb && !vtUeb.anVertreter) || (globalKunde && !gewuenscht),
    });
    if (vtUeb?.anVertreter && (leitungGewollt || heikleUebergabe(`${titelMitName}\n${text}`))) {
      await betreiberKopie({
        personId: k.personId, ref: k.ref, titel: titelMitName, text: mailKopf + text, dringend: true,
        schluessel: `postmeister:${k.personId ?? k.ref ?? k.postmeisterId ?? "x"}:aufgabe`, quelle: "postmeister",
      }, vtUeb);
    }
    const wer = zielAbwesend ? `${abw!.vertreter.vorname} (Vertretung bis ${bisText(abw!.bis)})` : erg.agentName ?? "die Leitung";
    // E-265: Nennform — nie der Vorname (erg.kundenName ist schon „Herr Stripling", E-117).
    const werKunde = zielAbwesend ? abw!.vertreter.anrufName : erg.kundenName ?? erg.agentName ?? "unsere Leitung";
    await protokoll(k, "aufgabe_an_betreuer", `Aufgabe für ${wer}: „${titelMitName}" (fällig ${faelligAm}).${zahlungGemeldet} ${text.slice(0, 300)}`);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    // ── RÜCKRUF ALS TERMIN IM KALENDER (Florentine Punkt 3) ───────────────
    // „Erkannte Rückrufwünsche automatisch als Termin in den Kalender des
    // zuständigen Mitarbeiters eintragen, verknüpft mit Kunde und Mail."
    let terminSatz = "";
    let gebuchtText: string | null = null;
    const rueckrufAm = String(p.rueckruf_am || "").trim();
    // ── E-248: KEIN ZWEITER TERMIN, KEINE ZEIT IN DER VERGANGENHEIT ───────
    // Steht schon ein gebuchter Termin, wird keiner dazugebucht (Fall K. auf
    // WhatsApp: der Kunde hatte selbst gebucht) — Mara nennt den bestehenden, so
    // wie ein Mensch es sagt („morgen um 20 Uhr"). Eine Zeit ohne Vorlauf
    // (weniger als 20 Minuten, wie auf WhatsApp) wird nicht gebucht.
    const bestehend = rueckrufAm && k.personId ? await bestehenderTermin(k.personId) : null;
    const wunschZeit = rueckrufAm ? berlinZeitLesen(rueckrufAm) : null;
    if (bestehend) {
      terminSatz = ` Es steht schon ein Termin: ${bestehend.vorname ? `${bestehend.vorname} ruft Sie ` : ""}${bestehend.kundenText}${bestehend.vorname ? " an" : ""}. Kein zweiter wurde eingetragen.`;
    } else if (rueckrufAm && (!wunschZeit || wunschZeit.getTime() < Date.now() + 20 * 60_000)) {
      terminSatz = ` (Rückruf-Zeit ${rueckrufAm} liegt nicht mindestens 20 Minuten in der Zukunft oder ist unlesbar — kein Termin eingetragen; nenne dem Kunden keine Uhrzeit.)`;
    } else if (rueckrufAm && k.personId && zielAbwesend && wunschZeit && wunschZeit.getTime() < abw!.bis.getTime()) {
      // E-260: in den Kalender des Vertreters — auf seinen nächsten freien Platz im Raster (höchstens
      // 10 Minuten früher, 20 später, wie auf WhatsApp). Kein Platz: keine Uhrzeit zusagen.
      try {
        const t = wunschZeit.getTime();
        const platz = (await freiePlaetzeVertreter(abw!, 20))
          .map((s) => ({ s, d: new Date(s.beginn).getTime() - t }))
          .filter((x) => x.d >= -10 * 60_000 && x.d <= 20 * 60_000)
          .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || b.d - a.d)[0]?.s ?? null;
        if (!platz) {
          terminSatz = ` (Zur Wunschzeit ${rueckrufAm} ist ${abw!.vertreter.anrufName} nicht frei — kein Termin eingetragen; nenne dem Kunden keine Uhrzeit, ${abw!.vertreter.anrufName} meldet sich.)`;
        } else {
          const { terminBuchen } = await import("./fiaon-termine");
          const b = await terminBuchen({ personId: k.personId, agentId: abw!.vertreter.id, beginn: platz.beginn, quelle: "agent_manuell", herkunft: "mara_mail" });
          // E-265: die Notiz nennt beide in der Nennform („in Abwesenheit von Herrn Stripling, bei Nikita Boychenko").
          const fuer = vtPerson?.betreuer?.nenn.dat ?? "dem Team";
          await sqlPool`UPDATE fiaon_termine SET notiz = ${`Rückrufwunsch aus E-Mail [Mail #${k.postmeisterId ?? "?"}] — in Abwesenheit von ${fuer}, bei ${abw!.vertreter.anrufDat}: ${text.slice(0, 300)}`}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
          const { buchungMelden } = await import("./fiaon-termin-meldung");
          await buchungMelden(b.id, b.beginn, "agent_manuell").catch(() => {});
          gebuchtText = zeitFuerKunde(new Date(b.beginn));
          terminSatz = ` Der Rückruf steht im Kalender: ${gebuchtText}.`;
          await protokoll(k, "aufgabe_an_betreuer", `Rückruf-Termin ${b.datumText} ${b.uhrzeit} Uhr für ${abw!.vertreter.name} eingetragen (vertritt ${fuer} bis ${bisText(abw!.bis)}).`);
        }
      } catch (e: any) {
        terminSatz = ` (Rückruf-Termin konnte nicht eingetragen werden: ${String(e?.message || e).slice(0, 100)} — die Aufgabe steht trotzdem; nenne dem Kunden keine Uhrzeit.)`;
      }
    } else if (rueckrufAm && k.personId && (erg.agentId || (zielAbwesend && vtPerson?.betreuerBuchbar && vtPerson.betreuer))) {
      // Vertretung (01.10.2026, Gegenprüfung): Seit der Vertreter ein Mitarbeiter ist, trägt erg.agentId
      // IHN (die Aufgabe liegt bei ihm) — die Regel aus E-260 gilt trotzdem: Nach „bis" gehört der
      // Rückruf zum buchbaren Betreuer. Nur ohne buchbaren Betreuer bleibt er beim Aufgaben-Empfänger.
      const beimBetreuer = zielAbwesend && !!vtPerson?.betreuerBuchbar && !!vtPerson.betreuer;
      try {
        const { terminBuchen } = await import("./fiaon-termine");
        // E-260: Liegt die Wunschzeit nach „bis", ist der Betreuer wieder da — der Termin gehört zu ihm.
        const zielId = beimBetreuer ? vtPerson!.betreuer!.id : Number(erg.agentId);
        const b = await terminBuchen({ personId: k.personId, agentId: zielId, beginn: rueckrufAm, quelle: "agent_manuell", herkunft: "mara_mail" });
        await sqlPool`UPDATE fiaon_termine SET notiz = ${`Rückrufwunsch aus E-Mail [Mail #${k.postmeisterId ?? "?"}]: ${text.slice(0, 300)}`}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
        const { buchungMelden } = await import("./fiaon-termin-meldung");
        await buchungMelden(b.id, b.beginn, "agent_manuell").catch(() => {});
        // E-248: so, wie der Kunde es liest — „morgen um 20 Uhr", nie ISO.
        gebuchtText = zeitFuerKunde(new Date(b.beginn));
        // E-265: der Kunde liest die Nennform des Betreuers („Herr Stripling ruft an"), nie den Vornamen.
        terminSatz = beimBetreuer
          ? ` Der Rückruf steht im Kalender: ${gebuchtText} ruft ${vtPerson!.betreuer!.nenn.nom} an.`
          : ` Der Rückruf steht im Kalender: ${gebuchtText}.`;
        await protokoll(k, "aufgabe_an_betreuer", `Rückruf-Termin ${b.datumText} ${b.uhrzeit} Uhr für ${beimBetreuer ? vtPerson!.betreuer!.name : wer} eingetragen.`);
      } catch (e: any) {
        terminSatz = ` (Rückruf-Termin konnte nicht eingetragen werden: ${String(e?.message || e).slice(0, 100)} — die Aufgabe steht trotzdem; nenne dem Kunden keine Uhrzeit.)`;
      }
    }
    // ── E-275 (02.10.2026): „X MELDET SICH HEUTE“ NUR BEIM RÜCKRUF ───────────
    // Dieser Satz war das Ergebnis JEDER Aufgabe — und das Modell schrieb ihn wörtlich in die Kundenmail
    // („I have asked Nikita Boychenko to check this today“, #6120). Jetzt: Steht ein Rückruf (Wunschzeit,
    // bestehender Termin) oder geht es um Geld zurück, bleibt die Zusage; sonst ist die Aufgabe intern, und
    // das Ergebnis sagt dem Modell, dass es selbst antwortet. Der Satz beginnt weiter mit der Nennform.
    const zusageNoetig = !!rueckrufAm || !!bestehend || leitungGewollt;
    const ergebnisText = zusageNoetig
      ? `${werKunde} meldet sich ${wann} bei Ihnen.${terminSatz}`
      : `${werKunde} meldet sich nur, wenn noch etwas von Ihnen gebraucht wird — die Aufgabe ist intern. Erwähne sie nicht als „meldet sich“, sondern beantworte sein Anliegen selbst und vollständig.${terminSatz}`;
    return {
      ok: true, ergebnis: ergebnisText,
      daten: {
        betreuer: werKunde, betreuer_intern: erg.agentName, aufgabe: titel, faellig: faelligAm, aufgabe_id: erg.id,
        rueckruf_termin: gebuchtText, bestehender_termin: bestehend ? bestehend.kundenText : null,
        // E-275: true = die Aufgabe ist intern — kein „meldet sich“ in der Kundenmail.
        intern: !zusageNoetig,
      },
    };
  },
};

/**
 * RECHNUNG ANHÄNGEN — 04.09.2026 (E-115). Bei einer offenen Zahlung hängt der
 * Lauf die Rechnung ohnehin an, sobald die Zahlungsseite verlinkt ist. Dieses
 * Werkzeug ist für den ausdrücklichen Wunsch: „Schicken Sie mir die Rechnung."
 */
export const rechnungAnhaengen: Werkzeug = {
  name: "rechnung_anhaengen",
  beschreibung: "Hängt die Rechnung zu einer Zahlungsreferenz als PDF an deine Antwort. Nutze es, wenn der Kunde eine Rechnung, einen Beleg oder eine Zahlungsaufforderung als Dokument verlangt — auch zu einer bereits bezahlten Rate. Bei einer offenen Zahlung wird die Rechnung automatisch angehängt, sobald du die Zahlungsseite verlinkst.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: { referenz: { type: "string", description: "Bestellung FIAON-XXXXXX oder Monatsrate FIAON-XXXXXX-N, genau wie in der Akte." } },
    required: ["referenz"],
  },
  async ausfuehren(p, k) {
    const ref = String(p.referenz || "").trim().toUpperCase();
    // E-230: auch das neue Format ohne Bindestrich (FIAONXXXXXX, FIAONXXXXXX-N).
    if (!/^FIAON-?[A-Z0-9]{6}(-\d{1,2})?$/.test(ref)) return { ok: false, ergebnis: "", fehler: "Das ist keine Zahlungsreferenz." };
    // E-248: Auf Stopp, Widerruf, Beschwerde, Bestreiten … geht keine Rechnung mit —
    // außer der Kunde verlangt sie ausdrücklich (#5479: „Stopp" bekam Rechnung und Zahlknopf).
    if (k.ruhe && !kundeWillRechnung(k.kundeText)) {
      return { ok: false, ergebnis: "", fehler: `Diese Antwort ist keine Zahlungsaufforderung (${k.ruhe}) — keine Rechnung anhängen, sein Anliegen beantworten.` };
    }
    const { zahlungsauftragFinden } = await import("./fiaon-zahlungsauftrag");
    const z = await zahlungsauftragFinden(ref);
    if (!z) return { ok: false, ergebnis: "", fehler: "Zu dieser Referenz gibt es keine Rechnung." };
    // E-272: Beim Global-Kunden keine Rechnung einer Privatbestellung.
    const privatBeiGlobal = await privatReferenzBeiGlobal(k, z);
    if (privatBeiGlobal) return { ok: false, ergebnis: "", fehler: privatBeiGlobal };
    // E-248 (#5500): Ohne Betrag gibt es keine Rechnung — sonst „über null €".
    if (!(Number(z.amountDue) > 0)) return { ok: false, ergebnis: "", fehler: "Zu dieser Bestellung ist noch kein Betrag hinterlegt — keine Rechnung und keinen Betrag nennen; der Betreuer trägt Paket und Betrag nach (aufgabe_an_betreuer)." };
    // E-264 (29.09.2026, Gegenlesen): derselbe Riegel wie in zahlungslink_bauen — ohne abgeschickten Antrag
    // gibt es keine Rechnung. Die Referenz kennt er trotzdem (Betreff der Zahlungserinnerung, Rückhol-Mail),
    // und „Interessent" darf automatisch antworten: „AW: … bitte schicken Sie mir die Rechnung" hätte ihm
    // eine Rechnung mit IBAN und Betrag für einen Vertrag gebracht, den es nicht gibt.
    if (z.art === "bestellung" && !(await bestellungAbgeschickt(String(z.paymentReference)))) {
      return { ok: false, ergebnis: "", fehler: "Sein Antrag ist nie abgeschickt — es gibt keine Rechnung. Keine Rechnung anhängen, keinen Betrag nennen; der Schritt ist sein Antrag (Knopf „antrag“)." };
    }
    if (k.postmeisterId) {
      const [r] = (await sqlPool`SELECT anhaenge FROM fiaon_postmeister WHERE id = ${k.postmeisterId}`) as any[];
      const da: any[] = Array.isArray(r?.anhaenge) ? r.anhaenge : [];
      if (!da.some((a) => a && a.art === "rechnung" && String(a.referenz).toUpperCase() === ref)) {
        da.push({ art: "rechnung", referenz: ref, quelle: "werkzeug" });
        await sqlPool`UPDATE fiaon_postmeister SET anhaenge = ${sqlPool.json(da)}, updated_at = NOW() WHERE id = ${k.postmeisterId}`.catch(() => {});
      }
    }
    await protokoll(k, "rechnung_anhaengen", `Rechnung ${ref} (${z.amountDue} €) wird als PDF angehängt.`, false);
    return { ok: true, ergebnis: `Die Rechnung zu ${ref} über ${z.amountDue} € wird als PDF angehängt.`, daten: { rechnung: ref, betrag: z.amountDue, rechnung_status: z.status } };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT ANBIETEN (24.09.2026, E-240)
//
// DER FALL: Doris Hösl (Person 4513) bekam die Unterlagen-Mail „Ihre
// Bonitätsauskunft liegt uns noch nicht vor … sonst antworten Sie kurz" und
// antwortete „Ich hab keine." Mara hatte kein Werkzeug, um die Auskunft zu
// verkaufen, die offene Rate schlug alles, und heraus kam „Sie können sie in
// Ihrem Bereich anfordern" — ein Mensch, der gerade Ja zu uns gesagt hätte,
// bekam den Weg ohne uns gezeigt. Justin: Die Auskunft soll „weggehen wie
// warme Semmeln".
//
// DAS WERKZEUG liefert den ECHTEN Knopf: Preis für genau diesen Menschen
// (auskunftStand/auskunftPreis entscheiden 74 € mit Paket / 149 € einzeln,
// Firma 199/349 €), Leistung und die Auskunfteien seines Landes. Mara nennt
// nur, was hier steht — kein erfundener Link, kein Preis aus dem Gedächtnis.
// Eine bezahlte, gemeldete oder hochgeladene Auskunft wird nicht noch einmal
// verkauft.
//
// ── ANBIETEN IST NICHT BESTELLEN (24.09.2026, E-240, Gegenlesen) ──────────
// Die erste Fassung rief hier auskunftBestellen: Jede Antwort Maras legte eine
// Bestellung an, vergab eine fortlaufende Rechnungsnummer, schickte die Mail
// payment_details und setzte die Zahlungserinnerungen in Gang — bevor der
// Kunde Ja gesagt hatte (Prüfstand: FIAON-INV-2026-00018 für ein bloßes
// Angebot). Eine Zahlungsaufforderung für eine nicht bestellte Leistung ist
// § 241a BGB / UWG Anhang Nr. 29, und ohne Knopf „zahlungspflichtig" und
// Widerrufsbelehrung fehlt die Button-Lösung (§ 312j Abs. 3 BGB).
// Jetzt: Ist nichts bestellt, führt der Knopf auf die signierte
// Bestätigungsseite (kaufLink, fiaon-auskunft-kauf.ts) — derselbe Weg wie
// Unterlagen-Mail und Verkaufstakt. Erst der Klick dort bestellt. Ist schon
// eine Bestellung offen, führt er zu ihrer Zahlungsseite; es entsteht nichts.
//
// DIE GRENZEN stehen im Code, nicht im Prompt: nur in den Lagen mit gebuchtem
// Paket (AUSKUNFT_LAGEN), nie bei Kündigung, Beschwerde, Bestreiten, „Stopp",
// Zahlungsunfähigkeit (KEIN_VERKAUF_FLAGS), nie bei Werbe- oder Vertriebssperre,
// nie bei FIAON Global (Wand unten). Das Angebot ist eine Antwort auf eine Mail
// des Kunden — keine Werbemail an Bestandskunden (§ 7 Abs. 3 UWG).
//
// DER BETREUER erfährt es sofort (auskunftBetreuerMelden): Aufgabe, Mail
// aufgabe_zugewiesen, Ereignis für das Popup — „bitte heute nachfassen".
// ═══════════════════════════════════════════════════════════════════════════

const LAMPE_TEXT: Partial<Record<keyof Flags, string>> = {
  kuendigung: "will kündigen", bestreitet: "bestreitet die Forderung", widerruf: "widerruft",
  beschwerde: "beschwert sich", rechtlich: "hat ein rechtliches Anliegen", stopp: "will keine Nachrichten mehr",
  droht_anwalt: "droht mit rechtlichen Schritten", zahlungsunfaehig: "sagt, er könne nicht zahlen",
};

// ═══════════════════════════════════════════════════════════════════════════
// ANTWORTET ER AUF DAS ANGEBOT — ODER FRAGT ER SELBST? (25.09.2026, E-241)
//
// Seit E-241 geht das Angebot (Mail auskunft_angebot, drei Fassungen) auch an
// offene Anträge und Leads. Deren Antwort ist ein „Re:"/„AW:" auf genau diese
// Betreffs. Die Betreffs stehen EINMAL in der Vorlage
// (server/mail/vorlagen/auskunft-verkauf.ts) — hier werden sie aus ihr gebaut
// (jede Fassung × privat/Firma × Land × Segment, ohne Vornamen), nicht
// abgeschrieben: Ändert jemand dort einen Betreff oder bekommt ein Segment einen
// eigenen, erkennt Mara die Antwort trotzdem.
//
// Bewusst NICHT antwortAufAngebot (fiaon-auskunft.ts): Das zählt auch die
// Unterlagen-Mail („Noch fehlende Unterlagen …") mit — für einen zahlenden
// Kunden ist das richtig (dort steht das Kaufangebot), für einen offenen Antrag
// nicht: Wer darauf seinen Ausweis schickt, hat nicht nach der Auskunft gefragt.
// ═══════════════════════════════════════════════════════════════════════════

export type AuskunftAntwort = "angebot" | "frage" | null;

const ANTWORT_PRAEFIX = /^\s*(?:re|aw|antw|sv)\s*(?:\[\d+\])?\s*:\s*/i;

function betreffNorm(s: unknown): string {
  let t = String(s ?? "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 5; i++) {
    const n = t.replace(ANTWORT_PRAEFIX, "");
    if (n === t) break;
    t = n;
  }
  return t.toLowerCase().replace(/[„“”"'’‚‘]/g, "").trim();
}

let angebotsBetreffs: string[] | null = null;
/** Alle Betreffs der Angebots-Mail, ohne Vornamen, normalisiert. Einmal gebaut, dann gemerkt. */
export function auskunftAngebotsBetreffs(): string[] {
  if (angebotsBetreffs) return angebotsBetreffs;
  const alle = new Set<string>();
  for (const fassung of ANGEBOT_FASSUNGEN) {
    for (const art of ["privat", "firma"]) {
      for (const land of ["DE", "AT", "CH"]) {
        // 26.09.2026 (E-243): alle Segmente der Vorlage (neu: abbrecher) und beide Betreffzeilen je Stufe.
        for (const segment of ANGEBOT_SEGMENTE) {
          for (const mit_abo of [true, false]) {
            for (const betreff_variante of ANGEBOT_BETREFF_VARIANTEN) {
              try {
                const b = betreffNorm(auskunftAngebotBaustein({ fassung, art, land, segment, mit_abo, betreff_variante, vorname: null, nachname: null }).betreff);
                // Ein Betreff aus einem Wort erkennt jede zweite Mail — nur echte Sätze zählen.
                if (b.length >= 15) alle.add(b);
              } catch { /* eine Fassung, die ohne Daten nicht baut, zählt nicht */ }
            }
          }
        }
      }
    }
  }
  angebotsBetreffs = Array.from(alle);
  return angebotsBetreffs;
}

/** „AW: Doris, sehen Sie, was die Bank über Sie sieht" → true. Nur Antworten, keine Weiterleitungen. Rein. */
export function antwortAufAuskunftAngebot(betreff: unknown): boolean {
  const roh = String(betreff ?? "");
  if (!ANTWORT_PRAEFIX.test(roh)) return false;
  const b = betreffNorm(roh);
  return auskunftAngebotsBetreffs().some((v) => b.includes(v));
}

/**
 * Nur, was der Kunde SELBST geschrieben hat — ohne ein Zitat unserer Mails, das
 * ohneZitat (fiaon-postmeister-lauf.ts) nicht erkannt hat. Gemessen (Produktion,
 * nur lesend, 25.09.2026): In 8 von 51 Kundenmails mit „Auskunft" stand das Wort
 * nur im mitgeschickten Zitat — „bei der Prüfung Ihrer Unterlagen ist uns etwas
 * aufgefallen: Ihre Bonitätsauskunft …", „welcome@ fiaon.com : Bitte laden Sie die
 * SCHUFA-Auskunft …". Ein offener Antrag, der darauf nur seinen Ausweis schickt,
 * hat nicht nach der Auskunft gefragt. Rein.
 */
const ZITAT_BEGINN: RegExp[] = [
  /\bAm\s[^\n]{0,90}?\s(?:schrieb|wrote)\b/i,
  /\bschrieb\s+(?:am\b|FIAON|Mara|welcome)/i,
  /-{2,}\s*(?:Original|Ursprüngliche|Forwarded|Weitergeleitet)/i,
  /(?:^|\n)\s*(?:Von|From|Gesendet|Sent|An|To|Betreff|Subject)\s*:\s/i,
  /welcome@\s?fiaon\.com/i,
  /FIAON\s+Welcome/i,
  // Gegenlesen E-241: nur als Zeile (Signatur im Zitat) — „Hallo Mara Lindner, ja gerne" ist SEIN Text.
  /\n[ \t>]*Mara\s+Lindner\b/i,
  /(?:^|\n)\s*>/,
  /ist\s+uns\s+etwas\s+aufgefallen/i,
];
export function kundenTeil(text: unknown): string {
  const t = String(text ?? "");
  let ende = t.length;
  for (const m of ZITAT_BEGINN) {
    const i = t.search(m);
    if (i >= 0 && i < ende) ende = i;
  }
  return t.slice(0, ende).trim();
}

/**
 * Antwortet diese Mail auf das Angebot der Auskunft — oder fragt der Kunde
 * selbst danach? Rein, für Lauf und Prüfstand.
 *   · „frage": er sagt, er habe keine (auskunft_fehlt, E-240), oder fragt nach
 *     der Auskunft selbst (fragtNachAuskunftSelbst) — im Text oder im Betreff
 *     einer neuen Mail.
 *   · „angebot": ein „Re:" auf die Angebots-Mail, das nicht ablehnt und sich
 *     auf das Angebot bezieht (Ja, Rückfrage, das Thema — Gegenlesen E-241).
 *   · null: ein Nein („Nein danke", „habe schon eine"), ein Widerspruch
 *     („Löschen Sie meine Daten"), eine Warnlampe (Kündigung, Beschwerde,
 *     „Stopp" …) oder schlicht ein anderes Anliegen.
 */
export function auskunftAntwortArt(ein: { betreff?: string | null; kundeText?: string | null; flags?: Partial<Flags> | null }): AuskunftAntwort {
  if (KEIN_VERKAUF_FLAGS.some((f) => !!ein.flags?.[f])) return null;
  // Nur sein eigener Text zählt — ein durchgerutschtes Zitat unserer Mail ist keine Frage.
  const text = kundenTeil(ein.kundeText);
  // Gegenlesen E-241: „Woher haben Sie meine Daten? Löschen Sie sie." ist ein Widerspruch —
  // nie ein Verkauf, auch nicht mit „habe keine Auskunft" im selben Satz.
  if (widersprichtWerbung(text)) return null;
  if (ein.flags?.auskunft_fehlt) return "frage";
  if (lehntAuskunftAb(text)) return null;
  // Gegenlesen E-241: Ein „AW:" allein ist noch keine Antwort AUF DAS ANGEBOT — wer auf die
  // Angebots-Mail „Wann bekomme ich meine Karte?" schreibt, bekommt die Karte, kein zweites
  // Angebot. Es zählt ein Ja, eine Rückfrage dazu oder das Thema selbst (bezogenAufAuskunftAngebot).
  if (antwortAufAuskunftAngebot(ein.betreff) && bezogenAufAuskunftAngebot(text)) return "angebot";
  const neueMail = !ANTWORT_PRAEFIX.test(String(ein.betreff ?? ""));
  if (fragtNachAuskunftSelbst(text) || (neueMail && fragtNachAuskunftSelbst(ein.betreff))) return "frage";
  return null;
}

/**
 * Welche Auskunft und welches Land für einen offenen Antrag oder Lead (Gegenlesen
 * 25.09.2026, E-241)? DIESELBE Grundmenge wie der Verkaufstakt (artFuerVerkauf,
 * fiaon-auskunft-verkauf.ts) — denn auf dessen Angebot antwortet er. Vorher:
 * Der Takt bot einem Business-Antrag die Firmen-Auskunft für 349 € an und einem
 * Lead mit österreichischer Nummer die „KSV1870-Auskunft"; auf sein „Ja bitte"
 * nannte Mara 149 € privat und „SCHUFA" — auskunftArtFuer kennt nur bezahlte
 * Pakete, auskunftStand das Land nur aus dem Antrag (ein Lead hat keinen).
 * `land: null` = das Land aus auskunftStand. Steht er in keinem Segment oder
 * scheitert die Abfrage: die alte Regel (auskunftArtFuer, Land aus dem Antrag).
 */
export async function auskunftArtLandVerkauf(personId: number): Promise<{ art: AuskunftArt; land: AuskunftLand | null }> {
  try {
    const { artFuerVerkauf } = await import("./fiaon-auskunft-verkauf");
    const v = await artFuerVerkauf(personId);
    if (v.segment) return { art: v.art, land: v.land };
  } catch (e) {
    console.warn("[POSTMEISTER] Art/Land der Auskunft (Grundmenge):", String((e as Error)?.message || e).slice(0, 160));
  }
  return { art: await auskunftArtFuer(personId), land: null };
}

/**
 * Wer bekommt die Aufgabe, wenn Mara einem offenen Antrag oder Lead die
 * Auskunft anbietet (E-241)? Die Regel des Hauses, in dieser Reihenfolge:
 *   1. sein Betreuer (fiaon_persons.assigned_agent_id — aktiv, kein Testkonto, nicht gesperrt),
 *   2. wer seinen Lead aus der Kartei übernommen hat (fiaon_leads.assigned_agent_id —
 *      die bekannte Falle: der Lead-Betreuer steht nicht immer an der Person),
 *   3. sonst die Ableitung jeder Mara-Aufgabe (auftragEmpfaenger: Vertriebsleitung
 *      mit der kleinsten Last).
 * Findet sich niemand: null — dann KEINE Aufgabe (nicht beim Betreiber abladen).
 * Eine automatische Lead-Zuteilung gibt es seit der offenen Kartei nicht mehr
 * (distributeUnassignedLeads ist ein Leerlauf, sofortZuteilen schließt Stufe 3 aus);
 * hier wird auch niemandem ein Lead ZUGETEILT — nur die Aufgabe adressiert.
 */
export async function auskunftAufgabeAn(personId: number): Promise<{ agentId: number; name: string | null; weg: "betreuer" | "lead" | "leitung" } | null> {
  const [z] = (await sqlPool`
    SELECT pa.id AS p_id, pa.name AS p_name, la.id AS l_id, la.name AS l_name
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents pa ON pa.id = p.assigned_agent_id
             AND COALESCE(pa.active, TRUE) AND NOT COALESCE(pa.is_test_account, FALSE) AND pa.zugang_gesperrt_am IS NULL
      LEFT JOIN LATERAL (
        SELECT a.id, a.name FROM fiaon_leads l JOIN fiaon_agents a ON a.id = l.assigned_agent_id
         WHERE l.person_id = p.id
           AND COALESCE(a.active, TRUE) AND NOT COALESCE(a.is_test_account, FALSE) AND a.zugang_gesperrt_am IS NULL
         ORDER BY l.erstellt_am DESC LIMIT 1
      ) la ON TRUE
     WHERE p.id = ${personId} LIMIT 1
  `.catch(() => [])) as any[];
  if (z?.p_id) return { agentId: Number(z.p_id), name: z.p_name ?? null, weg: "betreuer" };
  if (z?.l_id) return { agentId: Number(z.l_id), name: z.l_name ?? null, weg: "lead" };
  try {
    const { auftragEmpfaenger } = await import("../routes/fiaon-betreiber-todo");
    const wer = await auftragEmpfaenger(personId);
    return wer?.id ? { agentId: Number(wer.id), name: wer.name ?? null, weg: "leitung" } : null;
  } catch {
    return null;
  }
}

/** Darf Mara in diesem Vorgang die Auskunft verkaufen? `null` = ja, sonst der Satz für das Modell. Rein. */
export function auskunftVerkaufGesperrt(k: Pick<WerkzeugKontext, "kundenlage" | "flags"> & Partial<Pick<WerkzeugKontext, "auskunftAntwort">>): string | null {
  if (!auskunftLageErlaubt(k.kundenlage, !!k.auskunftAntwort)) {
    // E-241: Bei einem offenen Antrag oder einem Lead nur als Antwort — ungefragt nie.
    if (AUSKUNFT_ANTWORT_LAGEN.includes(k.kundenlage)) {
      return `In der Lage „${k.kundenlage}" wird die Bonitätsauskunft nur angeboten, wenn der Kunde auf unser Angebot antwortet oder selbst danach fragt — hier tut er keins von beiden. Biete sie nicht an und nenne keinen Preis; beantworte sein Anliegen.`;
    }
    return `In der Lage „${k.kundenlage}" wird die Bonitätsauskunft nicht angeboten (nur mit gebuchtem Paket und laufendem Vertrag). Beantworte das Anliegen des Kunden.`;
  }
  const lampen = KEIN_VERKAUF_FLAGS.filter((f) => !!k.flags?.[f]);
  if (lampen.length) {
    return `Jetzt nichts verkaufen — der Kunde ${lampen.map((f) => LAMPE_TEXT[f] ?? f).join(" und ")}. Beantworte sein Anliegen, ohne Angebot.`;
  }
  return null;
}

/**
 * DEN BETREUER INFORMIEREN — Aufgabe über auftragFuerKunden (Übergabe, Mail
 * aufgabe_zugewiesen, fiaon_agent_events), eine je Kunde (Schlüssel
 * postmeister:auskunft:<person>): Ein zweites Angebot hängt sich an und macht
 * die Aufgabe wieder ungelesen (agent_gelesen_am = NULL) — darauf hört das Popup.
 *
 * Werblich (Stufe nichts/offen) nur ohne Sperre und ohne Warnlampe; ein
 * Service-Fall (bezahlt, Dokument da, der Kunde sagt trotzdem „habe keine")
 * geht immer an den Betreuer — dort fehlt etwas in der Lieferung.
 */
export async function auskunftBetreuerMelden(k: WerkzeugKontext, ein: {
  angeboten: boolean;
  /** „gemeldet" = der Kunde hat die Zahlung für die Auskunft gemeldet, das Geld ist nicht da. */
  stufe: "bezahlt" | "offen" | "dokument" | "nichts" | "gemeldet";
  betragText?: string | null;
  mitAbo?: boolean;
  verwendungszweck?: string | null;
  bezahltRef?: string | null;
  anlass?: string | null;
}): Promise<{ ok: boolean; grund?: string; aufgabeId?: number | null; betreuer?: string | null }> {
  if (!k.personId) return { ok: false, grund: "ohne Person" };
  if (k.auskunftGemeldet) return { ok: false, grund: "in dieser Mail schon gemeldet" };
  if (k.kundenlage === "fremd" || k.kundenlage === "unklar") return { ok: false, grund: `Lage ${k.kundenlage}` };
  // E-272 (02.10.2026): FIAON Global ZUERST — an der Bestellung UND an der Person (istGlobalVorgang).
  // Vorher stand die Prüfung hinter Lage, Warnlampe und Werbe-/Vertriebssperre und kannte nur die
  // Bestellung des Vorgangs: Ein Global-Kunde mit altem Privatantrag als Vorgang und ohne Sperre bekam
  // eine Auskunft-Aufgabe für den Privatvertrieb („bitte heute nachfassen, Karte/Limit“). Bei Hildbrand
  // hielt nur die Vertriebssperre von Hand, die heute früh gesetzt wurde.
  if (await istGlobalVorgang(k)) return { ok: false, grund: "FIAON Global" };
  const service = ein.stufe === "bezahlt" || ein.stufe === "dokument" || ein.stufe === "gemeldet";
  // Erste Zahlung fürs Paket fehlt noch: Kaufen kann er die Auskunft erst danach
  // (angebotLage, Kaufseite) — der Betreuer soll nicht zuerst die Auskunft verkaufen.
  const paketOffen = ["interessent", "unbezahlt", "zahlung_gemeldet"].includes(k.kundenlage);
  if (!service) {
    if (["gesperrt", "gekuendigt", "bestreitet"].includes(k.kundenlage)) return { ok: false, grund: `Lage ${k.kundenlage}` };
    if (KEIN_VERKAUF_FLAGS.some((f) => !!k.flags?.[f])) return { ok: false, grund: "Warnlampe" };
    const [p] = (await sqlPool`SELECT werbung_gesperrt_am, is_blocked FROM fiaon_persons WHERE id = ${k.personId} LIMIT 1`.catch(() => [])) as any[];
    if (p?.werbung_gesperrt_am || p?.is_blocked) return { ok: false, grund: "Werbe- oder Vertriebssperre" };
  }

  // ── E-241: ANGEBOT AN EINEN OFFENEN ANTRAG ODER LEAD ─────────────────────
  // Die Aufgabe geht nach der Regel des Hauses (auskunftAufgabeAn): Betreuer,
  // sonst wer den Lead übernommen hat, sonst die Vertriebsleitung mit der
  // kleinsten Last — findet sich niemand, gibt es keine Aufgabe.
  const alsAntwort = ein.angeboten && AUSKUNFT_ANTWORT_LAGEN.includes(k.kundenlage);
  let agentId: number | null = null;
  if (alsAntwort) {
    const an = await auskunftAufgabeAn(k.personId);
    if (!an) return { ok: false, grund: "niemand zuständig (kein Betreuer, keine Vertriebsleitung) — keine Aufgabe" };
    agentId = an.agentId;
  }

  const name = (await kundenNameFuer(k.personId, k.ref)) ?? "Kunde";
  const titel = alsAntwort
    ? `Mara hat ${name} die Bonitätsauskunft angeboten (${k.kundenlage === "unbezahlt" ? "Antrag offen" : "Interessent"}) — bitte heute nachfassen`
    : ein.angeboten
    ? `Mara hat ${name} die Bonitätsauskunft angeboten — bitte heute nachfassen (Karte/Limit)`
    : service
      ? `${name} schreibt, die Bonitätsauskunft fehle — bitte heute klären`
      : paketOffen
        ? `${name} hat keine Bonitätsauskunft — erste Zahlung fehlt noch, bitte nachfassen`
        : `${name} hat keine Bonitätsauskunft — bitte heute nachfassen (Karte/Limit)`;
  const zitat = String(k.kundeText || "").replace(/\s+/g, " ").trim().slice(0, 220);
  const zeilen = [
    zitat ? `Kunde schrieb${k.postmeisterId ? ` [Mail #${k.postmeisterId}]` : ""}: „${zitat}${zitat.length >= 220 ? " …" : ""}"` : "",
    ein.anlass ? `Anlass: ${String(ein.anlass).slice(0, 200)}` : "",
    alsAntwort
      ? `${k.auskunftAntwort === "angebot" ? "Er hat auf unser Angebot der Bonitätsauskunft geantwortet" : "Er hat selbst nach seiner Bonitätsauskunft gefragt"} — ${k.kundenlage === "unbezahlt" ? "sein Antrag liegt vor, die erste Zahlung fürs Paket ist noch offen" : "er hat noch keinen Antrag"}.`
      : "",
    ein.angeboten
      ? ein.verwendungszweck
        ? `Die Auskunft ist schon beauftragt, die Zahlung über ${ein.betragText ?? "?"} fehlt noch (Verwendungszweck ${ein.verwendungszweck}) — Mara hat den Weg zur Zahlungsseite geschickt.`
        : `Mara hat die Bonitätsauskunft für ${ein.betragText ?? "?"}${ein.mitAbo ? " (Kundenpreis mit Paket)" : " (einzeln)"} angeboten; der Kauflink steht in ihrer Antwort. Beauftragt ist sie erst, wenn der Kunde auf der Bestätigungsseite zahlungspflichtig klickt.`
      : ein.stufe === "bezahlt"
        ? `Laut Akte ist die Auskunft bezahlt${ein.bezahltRef ? ` (${ein.bezahltRef})` : ""} — bitte prüfen, wo die Lieferung steht, und dem Kunden Bescheid geben.`
        : ein.stufe === "gemeldet"
          ? "Der Kunde hat die Zahlung für die Auskunft gemeldet, das Geld ist noch nicht gebucht — bitte mit der Zahlungsstelle klären und dem Kunden Bescheid geben."
          : ein.stufe === "dokument"
            ? "Laut Akte liegt schon ein Auskunft-Dokument vor — bitte klären, ob es aktuell und vollständig ist."
            : ein.stufe === "offen"
              ? "Eine Auskunft ist bestellt, aber noch nicht bezahlt — bitte im Gespräch den Zahlungsweg zeigen."
              : paketOffen
                ? "Die erste Zahlung für das Paket ist noch nicht gebucht — beauftragen kann er die Auskunft erst danach. Bitte zuerst die Zahlung klären, dann die Auskunft anbieten."
                : "Mara konnte sie in dieser Lage nicht selbst anbieten — bitte im Gespräch anbieten.",
    alsAntwort
      ? k.kundenlage === "unbezahlt"
        ? "Bitte heute anrufen: die Auskunft erklären (Datenkopien, Erklärung jeder Zeile, Fristen, Handlungsplan, fertige Schreiben) und die erste Zahlung für sein Paket mitnehmen — keine Zusage zu Karte oder Limit, die Bank entscheidet."
        : "Bitte heute anrufen: die Auskunft erklären (Datenkopien, Erklärung jeder Zeile, Fristen, Handlungsplan, fertige Schreiben) und seinen Antrag mitnehmen — keine Zusage zu Karte oder Limit, die Bank entscheidet."
      : (ein.angeboten || !service) && !paketOffen
      ? "Bitte heute anrufen: die Auskunft erklären (Datenkopien, Erklärung jeder Zeile, Fristen, Handlungsplan, fertige Schreiben) und Karte und Wunschlimit besprechen — keine Zusage, die Bank entscheidet."
      : "",
  ].filter(Boolean);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const erg = await auftragFuerKunden({
    ...(agentId ? { agentId } : {}),
    personId: k.personId, ref: k.ref, titel: titel.slice(0, 160), text: zeilen.join("\n"),
    faelligAm: new Date().toISOString().slice(0, 10), dringend: false,
    schluessel: `postmeister:auskunft:${k.personId}`,
    quelle: "postmeister", autorName: "Mara",
    link: `/agent/kunden?person=${k.personId}`,
    anlageText: "Angelegt von Mara aus dem Postfach (Bonitätsauskunft).",
  });
  k.auskunftGemeldet = true;
  await protokoll(k, "auskunft_betreuer", `Betreuer informiert (${erg.agentName ?? "Leitung"}): ${titel}`);
  return { ok: true, aufgabeId: erg.id, betreuer: erg.agentName };
}

export const auskunftAnbieten: Werkzeug = {
  name: "auskunft_anbieten",
  beschreibung: "Bietet dem Kunden die Bonitätsauskunft über FIAON an und liefert den ECHTEN Knopf dafür (Feld knopf): Preis für genau diesen Kunden (betragText — mit laufendem Paket der Kundenpreis, sonst einzeln), was er bekommt (leistung), bei welchen Auskunfteien wir anfragen (auskunfteien), wie die Auskunft in seinem Land heißt (wort) und wohin der Knopf führt (weg). Das Werkzeug BESTELLT NICHTS: Ist noch nichts beauftragt, führt der Knopf auf die Bestätigungsseite, auf der der Kunde selbst zahlungspflichtig beauftragt; ist schon eine Bestellung offen, direkt zu ihrer Zahlungsseite. Rufe es, wenn der Kunde schreibt, er habe keine Auskunft, SCHUFA oder Datenkopie (auch knapp: „Ich hab keine.“, „nicht vorhanden“), wenn er nach Auskunft, Bonität, Einträgen, Limit oder Karte fragt, oder wenn die Akte unter auskunft die Stufe „nichts“ zeigt. Ist schon eine bezahlt, gemeldet oder in der Akte, sagt es dir das (verkaufen: false) — dann verkaufst du nichts. Bei einem offenen Antrag oder einem Interessenten gibt es das Werkzeug nur, weil er auf unser Angebot der Auskunft antwortet oder selbst danach fragt — dann gilt der Einzelpreis, und das Feld hinweis sagt dir, was zu seinem Antrag in die Mail gehört. Den Betreuer informiert das Werkzeug selbst — dafür keine eigene Aufgabe anlegen.",
  stufe: "frei",
  // E-241: In AUSKUNFT_ANTWORT_LAGEN (unbezahlt, interessent) bietet werkzeugeFuerLage
  // es zusätzlich an — nur, wenn die Mail eine Antwort auf das Angebot ist oder er fragt.
  lagen: AUSKUNFT_LAGEN,
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      anlass: { type: "string", description: "In einem Satz, was der Kunde gesagt hat (z. B. „hat keine SCHUFA-Auskunft“, „fragt nach seinem Kartenrahmen“) — steht in der Aufgabe für den Betreuer." },
    },
    required: ["anlass"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz gibt es kein Angebot — biete nichts an." };
    const sperre = auskunftVerkaufGesperrt(k);
    if (sperre) return { ok: false, ergebnis: "", fehler: sperre };
    const [person] = (await sqlPool`SELECT werbung_gesperrt_am, is_blocked FROM fiaon_persons WHERE id = ${k.personId} LIMIT 1`) as any[];
    if (person?.werbung_gesperrt_am || person?.is_blocked) {
      return { ok: false, ergebnis: "", fehler: "Für diesen Kunden gilt eine Werbe- oder Vertriebssperre — biete nichts an, beantworte nur sein Anliegen." };
    }
    const anlass = String(p.anlass || "").trim().slice(0, 200) || null;
    const { auskunftStand, standZumZeigen } = await import("./fiaon-auskunft");
    // E-241: Ein offener Antrag oder ein Lead, der auf das Angebot antwortet oder
    // selbst fragt (auskunftVerkaufGesperrt oben hat das geprüft), beauftragt zum
    // Einzelpreis — ohne Paket, mit Art und Land wie im Angebot des Takts
    // (auskunftArtLandVerkauf). „Zahlung gemeldet" wartet weiter auf die Buchung
    // (dann gilt der Kundenpreis).
    const alsAntwort = AUSKUNFT_ANTWORT_LAGEN.includes(k.kundenlage);
    const verkauf = alsAntwort ? await auskunftArtLandVerkauf(k.personId) : null;
    const art = verkauf?.art ?? await auskunftArtFuer(k.personId);
    // Integration 26.09.2026 (E-243): standZumZeigen — eine offene Bestellung, die auskunftBestellen nicht wiederverwenden würde (älter als 21 Tage, teurer als heute), zeigt keinen Zahlungslink, sondern den Kauf zum heutigen Preis.
    const stand = standZumZeigen(await auskunftStand(k.personId, sqlPool, art));
    const land = verkauf?.land ?? stand.land;
    const basis = { wort: auskunftWort(land), auskunfteien: auskunfteienText(land), land, art };

    const nichtVerkaufen = async (stufe: "bezahlt" | "dokument" | "gemeldet", bezahltRef: string | null): Promise<WerkzeugErgebnis> => {
      // Sagt der Kunde „habe keine", obwohl eine bezahlt, gemeldet oder da ist, fehlt
      // etwas in der Lieferung — das gehört zum Betreuer, nicht in ein Angebot.
      if (k.flags?.auskunft_fehlt) await auskunftBetreuerMelden(k, { angeboten: false, stufe, bezahltRef, anlass }).catch(() => null);
      return {
        ok: true,
        ergebnis: stufe === "bezahlt"
          ? "Die Bonitätsauskunft ist bereits bezahlt — nicht noch einmal anbieten. Sag dem Kunden, dass FIAON sie für ihn anfordert und sein Betreuer die Auswertung mit ihm durchgeht."
          : stufe === "gemeldet"
            ? "Der Kunde hat die Zahlung für die Auskunft schon gemeldet — nicht noch einmal anbieten und nicht erneut zur Zahlung auffordern. Sag ihm, dass wir den Eingang prüfen und uns melden."
            : "Eine Auskunft liegt schon in der Akte — nichts verkaufen. Sag dem Kunden, dass sie vorliegt und in seine Auswertung einfließt; hat er eine neuere, lädt er sie in seinem Bereich hoch.",
        daten: { ...basis, stufe, verkaufen: false, knopf: null, zahlungsseite: null },
      };
    };
    if (stand.stufe === "bezahlt") return nichtVerkaufen("bezahlt", stand.bezahltRef);
    if (stand.offen?.status === "claimed_paid") return nichtVerkaufen("gemeldet", null);
    // Wie die Unterlagen-Mail (auskunftMailTeil): Wer selbst eine hochgeladen hat,
    // bekommt weder ein Angebot noch eine Zahlungsbitte — auch bei offener Bestellung.
    if (stand.dokumentDa) return nichtVerkaufen("dokument", null);

    const preisHinweis = (mitAbo: boolean) => mitAbo
      ? `Kundenpreis mit laufendem Paket (einzeln ${euroText(AUSKUNFT_PREISE_CENTS[art].einzeln)}) — beide Preise nebeneinander, nie „statt"`
      : "Einzelpreis (kein laufendes Paket)";
    let daten: Record<string, unknown>;
    if (stand.offen?.paymentReference) {
      // Schon beauftragt, Zahlung offen: der Weg zur Zahlung — nichts Neues entsteht.
      const zahlungsseite = absoluteUrl(`/zahlung/${encodeURIComponent(stand.offen.paymentReference)}`);
      const cents = stand.offen.betragCents || stand.preis.cents;
      daten = {
        ...basis, stufe: "offen", verkaufen: true,
        knopf: zahlungsseite, zahlungsseite,
        weg: "Die Auskunft ist schon beauftragt — der Knopf führt direkt zur Zahlungsseite (Betrag, Bankdaten, Verwendungszweck, QR-Code).",
        betragText: euroText(cents),
        // „74.00" — die Belegprüfung vergleicht Beträge in Punktschreibweise.
        betrag: (cents / 100).toFixed(2),
        verwendungszweck: stand.offen.paymentReference,
        mitAbo: stand.preis.mitAbo, preis_hinweis: preisHinweis(stand.preis.mitAbo),
        // E-248: „Rahmen statt Limit" gilt für alle (shared/fiaon-mara-ton.ts, TON_REGELN „limit") —
        // der Nutzen-Satz ohne „Wunschlimit" auch für Kunden mit Paket (vorher E-241 nur für Antrag und Lead).
        leistung: auskunftLeistung(art, land), nutzen: AUSKUNFT_NUTZEN_SATZ_KARTE,
      };
    } else {
      // Neu: nur, wenn die Bestätigungsseite ihn auch beauftragen lässt — sonst
      // endete der Knopf auf „Erst die erste Zahlung für Ihr Paket" (angebotLage)
      // oder „Keine neue Beauftragung möglich" (Kündigung, E-213).
      const { angebotLage, kaufLink } = await import("../routes/fiaon-auskunft-kauf");
      // E-241: B und Lead ohne Paket-Prüfung (alsAntwort, oben).
      const lageA = alsAntwort ? null : await angebotLage(k.personId);
      if (lageA && !lageA.paketBezahlt) {
        return { ok: false, ergebnis: "", fehler: "Die erste Zahlung für das Paket ist noch nicht gebucht — beauftragen kann der Kunde die Auskunft erst danach. Biete sie jetzt nicht an; fragt er, sag in einem Satz, dass FIAON sie nach der ersten Zahlung für ihn holt." };
      }
      const [gek] = (await sqlPool`
        SELECT 1 AS ja FROM fiaon_applications
         WHERE person_id = ${k.personId} AND merged_into IS NULL
           AND gekuendigt_am IS NOT NULL AND kuendigung_zurueckgenommen_am IS NULL LIMIT 1
      `) as any[];
      if (gek) return { ok: false, ergebnis: "", fehler: "Der Kunde hat gekündigt — keine neue Leistung anbieten. Beantworte nur sein Anliegen." };
      // Integration 25.09.2026 (E-240): die gemeinsame Bremse (zuletztAngeboten, fiaon-auskunft.ts).
      // Schreibt der Kunde selbst über die Auskunft („habe keine", SCHUFA, Bonität …) oder antwortet
      // er auf das Angebot bzw. die Unterlagen-Mail („Re: …"), ist der Link seine Antwort — dann gilt sie nicht. Sonst: Kam das Angebot in den letzten drei Tagen schon
      // (Angebots-Mail, Unterlagen-Mail, WhatsApp, Mara), wiederholt Mara es nicht ungefragt.
      // E-241: dazu jede Antwort auf die Angebots-Mail (auch die Betreffs der Segmente) und
      // jede eigene Frage nach der Auskunft (auskunftAntwort, vom Lauf gerechnet).
      if (!k.flags?.auskunft_fehlt && !kundeFragtNachAuskunft(k.kundeText) && !antwortAufAngebot(k.betreff)
        && !k.auskunftAntwort && !antwortAufAuskunftAngebot(k.betreff)) {
        const { zuletztAngeboten } = await import("./fiaon-auskunft");
        const zuletzt = await zuletztAngeboten(k.personId);
        if (zuletzt) {
          return { ok: false, ergebnis: "", fehler: `Die Bonitätsauskunft wurde ihm ${zuletzt.text} schon angeboten — biete sie in dieser Antwort nicht erneut an und nenne keinen Preis. Beantworte sein Anliegen; fragt er selbst danach, hilfst du weiter.` };
        }
      }
      daten = {
        ...basis, stufe: "nichts", verkaufen: true,
        knopf: kaufLink(k.personId, art), zahlungsseite: null,
        weg: "Der Knopf führt auf die Bestätigungsseite: Leistung, Preis, AGB und Widerrufsbelehrung — dort beauftragt der Kunde mit einem Klick zahlungspflichtig und sieht danach Betrag, Bankdaten und Verwendungszweck. Bis zu diesem Klick ist NICHTS bestellt: Schreib nie, er habe bestellt oder es sei eine Rechnung offen.",
        betragText: stand.preis.text,
        betrag: (stand.preis.cents / 100).toFixed(2),
        verwendungszweck: null,
        mitAbo: stand.preis.mitAbo, preis_hinweis: preisHinweis(stand.preis.mitAbo),
        // E-248: „Rahmen statt Limit" gilt für alle (shared/fiaon-mara-ton.ts, TON_REGELN „limit") —
        // der Nutzen-Satz ohne „Wunschlimit" auch für Kunden mit Paket (vorher E-241 nur für Antrag und Lead).
        leistung: auskunftLeistung(art, land), nutzen: AUSKUNFT_NUTZEN_SATZ_KARTE,
        // E-241: Was zu seinem Antrag in dieselbe Mail gehört — ein Satz, nicht mehr.
        ...(alsAntwort ? {
          hinweis: k.kundenlage === "unbezahlt"
            ? "Sein Paket ist noch nicht bezahlt: Die erste Zahlung nennst du in EINEM Satz mit Betrag und Verwendungszweck aus zahlungslink_bauen — die Rechnung hängt an. Der Knopf gehört der Auskunft. Die Auskunft ist keine Voraussetzung für seinen Antrag oder die Karte."
            : "Er hat noch keinen Antrag: Die Auskunft ist ein eigener Auftrag und keine Voraussetzung für Antrag oder Karte. Den Antrag erwähnst du höchstens in einem Satz; der Knopf gehört der Auskunft.",
        } : {}),
      };
    }
    const offen = daten.stufe === "offen";
    await protokoll(k, "auskunft_anbieten", offen
      ? `Bonitätsauskunft: Zahlungsweg der offenen Bestellung geschickt (${daten.betragText}, Verwendungszweck ${daten.verwendungszweck}).`
      // Der Anfang (ANGEBOT_VERMERK) ist die Spur, an der die gemeinsame Bremse Maras Mail-Angebot erkennt.
      : `${ANGEBOT_VERMERK} (${daten.betragText}${daten.mitAbo ? ", Kundenpreis mit Paket" : ", einzeln"}${art === "firma" ? ", Firma" : ""}) — Kauflink zur Bestätigungsseite, noch nichts bestellt.`);
    const meldung = await auskunftBetreuerMelden(k, {
      angeboten: true, stufe: offen ? "offen" : "nichts", betragText: String(daten.betragText), mitAbo: !!daten.mitAbo,
      verwendungszweck: offen ? String(daten.verwendungszweck) : null, anlass,
    }).catch((e) => { console.error("[POSTMEISTER] Auskunft an Betreuer:", String(e).slice(0, 160)); return null; });
    return {
      ok: true,
      ergebnis: offen
        ? `Die Bonitätsauskunft ist schon beauftragt, offen sind ${daten.betragText} (Verwendungszweck ${daten.verwendungszweck}) — der Knopf führt zur Zahlungsseite.${meldung?.ok ? " Der Betreuer ist informiert." : ""}`
        : `Angebot Bonitätsauskunft für ${daten.betragText}${daten.mitAbo ? " (Kundenpreis mit Paket)" : ""}: Der Knopf führt auf die Bestätigungsseite, bestellt ist noch nichts.${meldung?.ok ? " Der Betreuer ist informiert." : ""}`,
      daten,
    };
  },
};

/**
 * KÜNDIGUNG VORMERKEN — nach Justins Regel: kulant entlassen, aber erst nach
 * Zahlung der gestellten Rechnung. Das Werkzeug setzt den Zustand; die
 * Bestätigungsmail kommt aus dem Kündigungsmodul, nicht aus der KI-Feder.
 */
export const kuendigungVormerken: Werkzeug = {
  name: "kuendigung_vormerken",
  // E-248: Die Beschreibung sagt nicht mehr „zwölf Monate" für alle — Verträge vor dem
  // 03.09.2026 sind monatlich und formlos kündbar (shared/fiaon-wissen.ts).
  beschreibung: "Nimmt eine Kündigung oder ein Storno entgegen und bucht es sofort — Urkunde und schriftliche Bestätigung verschickt das Haus selbst (E-213). Rufe es, sobald der Kunde klar sagt, dass er kündigen, stornieren, widerrufen oder nicht mehr weitermachen will — auch formlos, auch mit seinem Namen im Satz („Ich, Max Muster, kündige per sofort“), auch „bitte alles stornieren“. Nie bei Fragen („Wie kann ich kündigen?“) oder Überlegungen („ich überlege …“). Zitat = sein wörtlicher Satz. Eine unbezahlte Bestellung wird storniert (nichts offen). Bei einem laufenden Vertrag bleibt die bereits gestellte Rate zu zahlen; mit ihrer Zahlung endet der Vertrag. Auch wenn er schreibt, er habe schon früher gekündigt: aufrufen. Nie bei Verneinung („ich kündige nicht“), Bedingung („sonst kündige ich“, „bevor ich kündige“), fremden Verträgen (Handy, Bank) oder wenn jemand anderes kündigen will. Ein bloßes „Stopp“ ist KEINE Kündigung (dafür werbesperre_setzen). Lehnt das Werkzeug ab, ist NICHTS gebucht — dann bestätigst du keine Kündigung; nachfragen nur, wenn er selbst kündigen/stornieren geschrieben hat.",
  stufe: "frei",
  // „gesperrt" (05.09.2026): Ein gesperrter Kunde mit unbezahlter Bestellung
  // will meist nur raus — das Storno muss Mara selbst können.
  // E-264 (29.09.2026, Gegenlesen): auch „interessent" — seit heute steht dort, wer eine angefangene,
  // NIE abgeschickte Bestellung hat (vorher „unbezahlt"). „Bitte stornieren Sie das" konnte Mara sonst
  // nicht mehr buchen, und ihr „Ein kurzes Ja genügt" lief ins Leere. Ohne Bestellung lehnt das Werkzeug ab.
  lagen: ["interessent", "unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv", "rate_ueberfaellig", "gekuendigt", "bestreitet", "gesperrt"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      zitat: { type: "string", description: "Der wörtliche Satz des Kunden, der die Kündigung erklärt." },
      grund: { type: "string", description: "Der genannte Grund, in den Worten des Kunden. Leer, wenn keiner genannt wurde." },
    },
    required: ["zitat", "grund"],
  },
  async ausfuehren(p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung kann keine Kündigung vorgemerkt werden." };
    const { istWillenserklaerung } = await import("./fiaon-kuendigung");
    const zitat = String(p.zitat || "");
    // E-248, Nachbesserung 28.09.: Es zählen NUR seine Worte. Das Zitat muss wörtlich
    // in SEINEM Teil der Mail stehen (k.kundeText = kundenTeil, ohne zitierten
    // Verlauf — sonst reichte unser eigener Mahnsatz „… können wir den Vertrag nicht
    // beenden"), und geprüft wird der ganze Satz, aus dem es stammt. Kein Rückgriff
    // mehr auf den ganzen Mailtext.
    const eigen = k.kundeText != null ? String(k.kundeText) : null;
    const pruefText = eigen == null ? zitat : saetzeZumZitat(zitat, eigen);
    const unbezahlt = k.kundenlage === "unbezahlt" || k.kundenlage === "interessent" || k.kundenlage === "gesperrt";
    // E-265 Nachbesserung 2 (01.10.2026, E-264): Bestreiten oder falsche Nummer IRGENDWO in seiner Mail — nie eine
    // Kündigung und nie ein Storno, auch mit Stornobitte daneben; die Leitung übernimmt.
    const bestritten = bestreitetKuendigung(eigen ?? zitat, abstreitenArt);
    if (bestritten) {
      return { ok: false, ergebnis: "", fehler: `Er bestreitet den Vertrag oder schreibt von einer falschen Nummer („${bestritten}") — NICHTS ist gebucht, und es wird nichts gebucht (E-264). Bestätige keine Kündigung und kein Storno; die Leitung übernimmt.` };
    }
    let wille = !!pruefText && kuendigungsWille(pruefText, { unbezahlt, formlos: !!k.formlosKuendbar, istWillenserklaerung })
      // Nachbesserung 2: Eine Rücknahme irgendwo in seiner Mail („… ich nehme das zurück") — nie gebucht.
      && !(eigen && kuendigungRuecknahme(eigen));
    // Ein kurzes „Ja" auf UNSERE Rückfrage („Möchten Sie, dass ich Ihren Vertrag jetzt
    // kündige? Ein kurzes Ja genügt.") ist die Erklärung — sonst Kündigungsschleife.
    if (!wille && eigen && k.personId && eigen.trim().length <= 90) {
      const [letzte] = (await sqlPool`
        SELECT antwort FROM fiaon_postmeister
         WHERE person_id = ${k.personId} AND antwort IS NOT NULL
           AND id <> ${k.postmeisterId ?? -1}
           AND created_at > NOW() - INTERVAL '21 days'
         ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
      wille = jaAufRueckfrage(eigen, letzte?.antwort ?? null);
    }
    if (!wille) {
      return { ok: false, ergebnis: "", fehler: "Das ist keine eindeutige Kündigung — NICHTS ist gebucht. Bestätige keine Kündigung. Hat der Kunde selbst „kündigen“, „stornieren“ oder „widerrufen“ geschrieben (ohne „nicht“), frag in EINEM freundlichen Satz nach, ob du es jetzt für ihn erledigen sollst. Hat er das NICHT selbst geschrieben (z. B. nur „Stopp“, eine Frage, eine Beschwerde), sprich Kündigung und Storno überhaupt NICHT an — beantworte nur sein Anliegen." };
    }
    // ── E-213: DERSELBE VORGANG WIE IN AKTE, KARTEI UND ZENTRALE (28.09.2026, E-248)
    // Vorher rief Mara nur kuendigungSetzen: Wirkung ja, aber keine Urkunde, keine
    // Bestätigung, der Formular-Antrag blieb offen. Jetzt der ganze Vorgang — scheitert
    // nur Urkunde oder Bestätigungsmail, steht die Kündigung trotzdem.
    // Steht die Kündigung schon, gibt es nichts durchzuführen — dann nur der Stand
    // (kuendigungSetzen meldet „bereits"), ohne zweiten Aktenvermerk (E-246).
    const [schon] = (await sqlPool`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = ${k.ref} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
    const { kuendigungSetzen } = await import("./fiaon-kuendigung");
    const { kuendigungDurchfuehren } = await import("../routes/fiaon-kuendigung");
    const erg = schon?.gekuendigt_am
      ? await kuendigungSetzen(k.ref, { quelle: "mail", grund: String(p.grund || "").slice(0, 300) || null, postmeisterId: k.postmeisterId ?? null })
      : await kuendigungDurchfuehren(k.ref, {
        quelle: "mail", grund: String(p.grund || "").slice(0, 300) || null, postmeisterId: k.postmeisterId ?? null,
        personId: k.personId ?? null, unterzeichner: { name: "FIAON LTD", rolle: "automatisch erstellt (digitale Assistentin Mara, E-Mail)" },
      });
    if (!erg.ok) return { ok: false, ergebnis: "", fehler: `${erg.grund} — NICHTS ist gebucht; bestätige keine Kündigung.` };
    // ── E-246: „bereits" aus dem ERSTEN Anlauf DIESER Mail ist keine alte Kündigung.
    // Unterbrach die KI-Pause die Mail nach dem Vormerken, meldet kuendigungSetzen
    // im zweiten Anlauf weg='bereits' — und der Kunde, der zum ersten Mal kündigt,
    // läse „Die Kündigung lag bereits vor". Dann gilt der Satz des ersten Anlaufs
    // (bei „vermerkt" mit den Raten von jetzt), und die Akte bekommt keinen zweiten Vermerk.
    let weg: string = erg.weg;
    let fester: string | null = null;
    let schonVermerkt = false;
    if (erg.weg === "bereits") {
      const frueher = await frueherInDieserMail(k, "kuendigung_vormerken");
      if (frueher != null) {
        schonVermerkt = true;
        const t0 = frueher.replace(/^Kündigung per E-Mail entgegengenommen\.\s*/, "").trim();
        if (/^Die Kündigung ist vermerkt\./.test(t0)) weg = "letzte_rate";
        else if (t0 && !/^Die Kündigung lag bereits vor/.test(t0)) { fester = t0; weg = "frueher"; }
      }
    }
    // 26.09.2026 (E-244): Was offen bleibt, liest das Werkzeug NACH der Buchung
    // aus den Raten — nicht aus dem Ergebnis. Bei „bereits gekündigt" liefert
    // kuendigungSetzen weder Rate noch Betrag; daraus wurde in der Akte und im
    // Werkzeug-Ergebnis für das Modell „Offen bleibt Rate null über 0.00 €"
    // (bis 26.09. 23 Aktenvermerke, keiner davon in einer Kundenmail).
    //
    // Nachbesserung (E-244): Bei „bereits" zuerst der Stand der Bestellung. Ist
    // sie storniert/erstattet oder der Vertrag beendet, fordert Mara NICHTS —
    // auch wenn dort noch eine nicht stornierte Rate „offen" steht (Produktion
    // 26.09.: 4 Bestellungen, z. B. FIAON-MRLWQ2AD-FBJM, Rate 2 über 79,99 €
    // offen, obwohl storniert und beendet). Das ist ein Datenfehler, keine
    // Forderung: Er geht als Prüffall an die Leitung, nie in die Kundenmail.
    let beendet = false;
    const [stand] = (await sqlPool`
      SELECT payment_status, (vertrag_ende_am IS NOT NULL AND vertrag_ende_am <= NOW()) AS vorbei, gekuendigt_am
        FROM fiaon_applications WHERE ref = ${k.ref} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
    if (weg === "bereits") {
      beendet = !!stand && (["cancelled", "canceled", "storniert", "refunded"].includes(String(stand.payment_status)) || stand.vorbei === true);
    }
    const offene = (["letzte_rate", "bereits"].includes(weg)
      ? await sqlPool`
          SELECT rate_nr, betrag_cents, to_char(faellig_am, 'DD.MM.YYYY') AS faellig, to_char(faellig_am, 'YYYY-MM-DD') AS faellig_iso
            FROM fiaon_abo_raten
           WHERE ref = ${k.ref} AND storniert_am IS NULL AND status = 'offen'
           ORDER BY rate_nr ASC`.catch(() => null)
      : []) as any[] | null;
    // ── E-265 Nachbesserung (29.09.2026, Recht): VERTRAG VOR DEM 03.09.2026 ENDET ZUM ENDE DES ABRECHNUNGSMONATS ──
    // Die Raten sind monatlich im Voraus fällig (AGB § 5 Abs. 3), der Altvertrag ist mit 24 Stunden Frist zum Ende des
    // Abrechnungsmonats kündbar (Fassung 04.07.2026 § 6; E-265 (01.10.2026): Fälligkeit zu Fälligkeit, vertragsendeLesen)
    // — eine Rate, die erst NACH dem Vertragsende fällig wird, ist für die Zeit danach und wird nie verlangt (vorher:
    // „gilt zum Monatsende. Ihre offene Rate vom 12.10. … zahlen Sie bitte noch"). Sie bleibt im System offen, bis
    // Justin entscheidet (Geldentscheidung) — Prüffall an den Betreiber, nie in der Kundenmail.
    // Nachbesserung Recht (01.10.2026, Gegenprüfung M2): immer die EINE Lesestelle — nie die rohe Spalte vertrag_ende_am
    // (Altdaten mit Zahltag statt Ende des Abrechnungsmonats).
    const endeTag: string | null = k.formlosKuendbar
      ? (await (await import("./fiaon-kuendigung")).vertragsendeLesen(k.ref)).ende
      : null;
    const { zuZahlen: offenBisEnde, nachEnde } = kuendigungRatenAufteilen(
      (offene ?? []).map((r) => ({ ...r, faellig: r.faellig_iso ?? null })),
      { jahresvertrag: !k.formlosKuendbar, vertragsEnde: endeTag },
    );
    if (!beendet && nachEnde.length) {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: k.personId, ref: k.ref, anBetreiber: true, quelle: "postmeister", autorName: "Mara",
        titel: `Entscheidung: Rate nach Vertragsende (${k.ref})`.slice(0, 160),
        text: `Altvertrag (vor dem 03.09.2026), per E-Mail zum Ende des Abrechnungsmonats (${tagDeutsch(endeTag) ?? "?"}) gekündigt. Diese Rate(n) sind erst NACH dem Vertragsende fällig und bleiben im System offen: `
          + `${nachEnde.map((r: any) => `Rate ${r.rate_nr} über ${rateEuro(Number(r.betrag_cents))}, fällig ${r.faellig_iso ? `${r.faellig_iso.slice(8, 10)}.${r.faellig_iso.slice(5, 7)}.${r.faellig_iso.slice(0, 4)}` : "?"}`).join("; ")}. Mara hat sie dem Kunden NICHT genannt und nicht „danach kommt nichts mehr" geschrieben. Bitte stornieren (Altbestand vor der Nachbesserung 01.10.; neue Kündigungen storniert kuendigungSetzen selbst) — sonst mahnt die Dauermahnung sie ab Fälligkeit.`,
        schluessel: `postmeister:kuendigung-nach-ende:${k.ref}`,
      }).catch((e) => console.error("[POSTMEISTER] Prüffall Rate nach Vertragsende:", String(e).slice(0, 160)));
    }
    const gelesen: OffeneRate[] | null = offene
      ? offenBisEnde.map((r: any) => ({ nr: Number(r.rate_nr), cents: Number(r.betrag_cents), faellig: r.faellig_iso ? `${r.faellig_iso.slice(8, 10)}.${r.faellig_iso.slice(5, 7)}.${r.faellig_iso.slice(0, 4)}` : null }))
      : null;
    if (beendet && gelesen && echteOffeneRaten(gelesen).length) {
      const wider = echteOffeneRaten(gelesen);
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: k.personId, ref: k.ref, anBetreiber: true, quelle: "postmeister", autorName: "Mara",
        titel: `Prüffall: offene Rate trotz beendetem Vertrag (${k.ref})`.slice(0, 160),
        text: `Die Bestellung ${k.ref} ist storniert oder beendet, trotzdem steht noch ${wider.map((r) => `Rate ${r.nr} über ${rateEuro(r.cents)}`).join(", ")} als offen (nicht storniert). `
          + `Mara hat dem Kunden keine Zahlung genannt. Bitte prüfen: Rate stornieren oder Bestellung richtigstellen.`,
        schluessel: `postmeister:kuendigung-raten:${k.ref}`,
      }).catch((e) => console.error("[POSTMEISTER] Prüffall Raten:", String(e).slice(0, 160)));
    }
    const raten: OffeneRate[] | null = beendet ? [] : gelesen;
    const t = fester ?? kuendigungSatz(weg, raten, { beendet, formlos: !!k.formlosKuendbar, endeTag });
    const echte = raten ? echteOffeneRaten(raten) : [];
    const letzte = echte.length ? echte[echte.length - 1] : null;
    await protokoll(k, "kuendigung_vormerken", `Kündigung per E-Mail entgegengenommen. ${t}`, !schonVermerkt);
    // ── E-265 (29.09.2026, Justin: „NEIN, bezahlen Sie Ihre Rate, dann lasse ich Sie aus Kulanz gerne aus dem
    // Vertrag!!!") — der Satz für den Kunden, je Vertragsart: Jahresvertrag mit Kulanz, Altvertrag (vor dem
    // 03.09.2026, monatlich kündbar) OHNE „Kulanz" (§ 5 UWG). Die Kündigung selbst ist gebucht (§ 312k BGB).
    const heuteText = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(new Date());
    // E-265 Nachbesserung (29.09.2026): auch bei mehreren Raten ein fertiger Satz (alle mit Datum und Summe, ohne
    // „danach kommt nichts mehr"); „bereits" + beendet nie „heute eingegangen" (Regression r9.mts — vorher wurde der
    // Weg zu „sofort_beendet" umgebogen: „Ihre Kündigung ist heute … eingegangen", für 174 längst beendete Verträge).
    const soSchreiben = bausteinKuendigung({
      kanal: "mail", weg, beendet: weg === "bereits" && beendet, jahresvertrag: !k.formlosKuendbar, heute: `${heuteText}.`.replace(/\.\.$/, "."),
      raten: echte.map((r) => ({ vom: r.faellig ? String(r.faellig).slice(0, 6) : null, betrag: rateEuro(r.cents), cents: r.cents })),
      bestaetigung: !!(erg as any).mailGesendet,
      // Stopp, Widerruf, Beschwerde, „kann nicht zahlen" … (zahlungsRuhe): nur der Stand, keine Zahlungsbitte.
      ohneZahlung: !!k.ruhe,
      // E-265 Nachbesserung 2 (01.10.2026): „danach kommt nichts mehr" nur, wenn nach diesen Raten nichts mehr offen ist.
      nichtsMehr: !(!beendet && nachEnde.length), nachEnde: !beendet && nachEnde.length > 0,
      // E-265 (01.10.2026, Recht): „… gilt zum Ende Ihres laufenden Abrechnungsmonats, dem <Datum>".
      giltZum: endeTag,
    });
    return {
      ok: true, ergebnis: t,
      daten: {
        weg,
        // E-246: vorgemerkt im ersten, von der KI-Pause unterbrochenen Anlauf DIESER Mail.
        in_diesem_vorgang_vorgemerkt: schonVermerkt,
        vertrag_beendet: beendet,
        letzte_rate: letzte?.nr ?? null,
        betrag: letzte ? (letzte.cents / 100).toFixed(2) : null,
        faellig: letzte?.faellig ?? null,
        offene_raten: echte.map((r) => ({ rate: r.nr, betrag: (r.cents / 100).toFixed(2), faellig: r.faellig })),
        offen_summe: echte.length ? (echte.reduce((s, r) => s + r.cents, 0) / 100).toFixed(2) : null,
        // E-248 (E-213): Was das Haus selbst verschickt hat — nur dann kündigt Mara die Bestätigung an.
        urkunde: !!(erg as any).urkunde,
        bestaetigung_gesendet: !!(erg as any).mailGesendet,
        // E-265: Justins Satz für diese Kündigung (Jahresvertrag: Kulanz; Altvertrag: gilt zum Ende des Abrechnungsmonats) — genau so schreiben.
        ...(soSchreiben ? { so_schreiben: soSchreiben, vertrag: k.formlosKuendbar ? `vor dem 03.09.2026 (kündbar zum Ende des Abrechnungsmonats${tagDeutsch(endeTag) ? `, dem ${tagDeutsch(endeTag)}` : ""} — KEIN „Kulanz“)` : "Jahresvertrag (Kulanz-Satz)" } : {}),
        // E-265 (01.10.2026, Recht): das Vertragsende beim Altvertrag (TT.MM.JJJJ) — für die Prüfung und das Modell.
        ...(endeTag ? { gilt_zum: tagDeutsch(endeTag) } : {}),
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DER KÜNDIGUNGSWILLE (28.09.2026, E-248) — rein, im Prüfstand geprüft.
//
// DIE FÄLLE: #5626 „Ich [Vorname Nachname] kündige per sofort den Vertrag" —
// zweimal abgelehnt, weil istWillenserklaerung (fiaon-kuendigung.ts) „ich
// kündige" direkt nebeneinander verlangt; Mara schrieb trotzdem „Ihre Kündigung
// liegt mir jetzt eindeutig vor". #5625: Vertrag vom 25.08. (formlos kündbar),
// „alles komplett wieder stornieren" — Mara verlangte den festen Wortlaut. 68
// von 116 Aufrufen scheiterten in 14 Tagen an dieser Prüfung.
//
// Die Regel im Kündigungsmodul bleibt (sie gilt auch für Akte und Kartei);
// hier kommen die Formen dazu, die echte Kunden schreiben. Eine Frage oder
// ein Konjunktiv im selben Satz ist weiterhin KEINE Kündigung.
// ═══════════════════════════════════════════════════════════════════════════
const WILLE_UNSICHER = /(würde|wuerde|überlege|ueberlege|\bfalls\b|wenn ich|wie kann ich|wie kündige|wie kuendige|kann ich\b|könnte|koennte|(?:ist|wäre|waere|sei)\s+(?:das|es)\s+m(?:ö|oe)glich|vielleicht|eventuell|\bob\b|informier|welche frist|\bwhether\b|\bif\s+i\b|how\s+(?:can|do)\s+i|\?)/i;
const WILLE_KLAR: RegExp[] = [
  // „Ich, Max Muster, kündige per sofort" — Name oder Füllwörter zwischen „ich" und „kündige"
  /\bich\b[^.!?\n]{0,40}?\bk(?:ü|ue)ndige\b/i,
  // „Ich möchte meinen Vertrag kündigen", „will das bei Ihnen kündigen", „werde kündigen"
  // (Nachbesserung E-248: „beenden" zählt nur mit Vertrag/Abo — „ich werde das heute
  // beenden und die Rate zahlen" ist keine Kündigung; das prüft BEENDEN_ALLEIN.)
  /\b(?:möchte|moechte|möchten|will|wollen|werde)\b[^.!?\n]{0,50}?\b(?:k(?:ü|ue)ndigen|stornieren|beenden|auflösen|aufloesen|widerrufen)\b/i,
  // „Kündigung per sofort / fristlos / zum nächstmöglichen Zeitpunkt"
  /\bk(?:ü|ue)ndigung\b[^.!?\n]{0,40}?\b(?:per\s+sofort|ab\s+sofort|fristlos|mit\s+sofortiger\s+wirkung|zum\s+n(?:ä|ae)chst(?:en|m(?:ö|oe)glichen))/i,
  // „bitte alles komplett stornieren", „den Vertrag bitte beenden" — ein Antrag nur mit
  // „stornieren/zurückziehen" („meinen Antrag beenden" heißt oft: fertig ausfüllen).
  /\b(?:alles|vertrag|vertr(?:ä|ae)ge|bestellung|abo|abonnement|paket|mitgliedschaft|auftrag)\b[^.!?\n]{0,30}?\b(?:stornier\w*|k(?:ü|ue)ndigen|beenden|aufheben|aufl(?:ö|oe)sen)\b/i,
  /\bantrag\b[^.!?\n]{0,30}?\b(?:stornier\w*|zur(?:ü|ue)ckziehen|zur(?:ü|ue)ckgezogen)\b/i,
  // „Ja, bitte kündigen." / „Bitte stornieren Sie alles" / „Kündigen Sie bitte meinen Vertrag"
  /\bbitte\s+(?:(?:alles|den\s+vertrag|mein(?:en)?\s+vertrag|das\s+abo|die\s+bestellung|meine\s+bestellung)\s+)?(?:k(?:ü|ue)ndigen|stornieren)\b/i,
  /\b(?:k(?:ü|ue)ndigen|stornieren)\s+sie\s+(?:bitte\s+)?(?:alles|mein\w*|den|das|die)\b/i,
  // „Hiermit möchte ich … widerrufen"
  /\bhiermit\b[^.!?\n]{0,50}?\bwi(?:e)?der(?:r)?uf\w*/i,
  // Englisch: „I want to cancel", „please cancel my subscription", „I hereby cancel"
  /\b(?:i\s+(?:want|wish|would\s+like|hereby)\s+to\s+cancel|i\s+hereby\s+cancel|please\s+cancel|cancel\s+(?:my|the)\s+(?:subscription|contract|order|membership|plan))\b/i,
];

// ── NACHBESSERUNG E-248 (28.09.2026): WAS NIE EINE KÜNDIGUNG IST ──────────
// Gegenprobe: „Ich kündige nicht, ich will nur wissen …", „Ich will nicht
// kündigen, sondern die Rate verschieben", „Bevor ich kündige, möchte ich mit
// jemandem sprechen", „Sonst werde ich kündigen", „Mein Mann will kündigen, ich
// aber nicht", „Ich möchte meinen Handyvertrag kündigen" — alle galten als
// Kündigung und wären SOFORT mit Urkunde gebucht worden. In echten Mails der
// letzten 45 Tage hatten 67 von 187 Treffern eine Verneinung oder Bedingung.
// Ein Satz mit einer dieser Formen zählt nie — im Zweifel fragt Mara nach, und
// ein kurzes Ja darauf genügt (jaAufRueckfrage).
/** Ein Wort zwischen Verneinung und Kündigungswort — nie über ein Komma oder ein „und/aber" hinweg. */
const W = String.raw`(?:(?!(?:und|aber|sondern|deshalb|daher|darum|also|weil|denn|ich|and|but)\b)[^\s,;:.!?]+)`;
const KWORT = String.raw`\S*(?:k(?:ü|ue)ndig|stornier|beend|wi(?:e)?der(?:r)?uf|aufl(?:ö|oe)s|aufheb|cancel)`;
/**
 * E-265 Nachbesserung 2 (01.10.2026, Gegenprobe g2 K19/K20/K45/K49): auch umgangssprachlich und vertippt —
 * „nich", „net", „ned", „nciht", „nihct", „nicth", „niht". Vorher galt „Ich kündige nich. Ich zahle am Freitag."
 * als Erklärung und wurde gebucht.
 */
const NICHT = String.raw`(?:nicht|nich|net|ned|nciht|nihct|nicth|niht|nichts)`;
/** Ein Wort zwischen Verb und Verneinung — „Kündige ich halt nicht" ja, über „weil/denn/und/aber/wenn/dass" nie
 * („Ich kündige weil ich nicht zufrieden bin" ist eine Kündigung). */
const W_NACH = String.raw`(?:(?!(?:und|aber|sondern|deshalb|daher|darum|also|weil|denn|wenn|dass|da|obwohl|and|but|because)\b)[^\s,;:.!?]+)`;
/** „nicht kündigen", „auf keinen Fall kündigen", „nicht vor, den Vertrag zu kündigen" — „nicht mehr"/„kein Interesse" sind KEINE Verneinung des Kündigens. */
const VERNEINT_VOR = new RegExp(String.raw`\b(?:${NICHT}(?!\s+mehr\b)|kein(?:e[nmrs]?)?(?!\s+(?:interesse|bedarf|lust|geld|mehr)\b)|nie(?:mals)?|keinesfalls|auf\s+keinen\s+fall)\b(?:\s+${W}){0,4}?\s+${KWORT}`, "i");
/**
 * „ich kündige nicht", „storniere das bitte nicht" — und (Nachbesserung 2, Gegenprobe K31/K32) die Sie-Form:
 * „Bitte kündigen Sie nicht meinen Vertrag", „Bitte stornieren Sie das nicht, ich zahle morgen".
 */
const VERNEINT_NACH = new RegExp(String.raw`\b(?:k(?:ü|ue)ndig(?:e|en|t)|stornier(?:e|en|t)|beend(?:e|en|et)|wi(?:e)?der(?:r)?uf(?:e|en|t)|l(?:ö|oe)s(?:e|en|t))\b(?:\s+${W_NACH}){0,3}?\s+(?:${NICHT}(?!\s+mehr\b)|keinesfalls|niemals|nie)\b`, "i");
const VERNEINT_EN = /\b(?:don'?t|do\s+not|won'?t|will\s+not|not)\s+(?:\w+\s+){0,2}?cancel/i;
/** Bedingung oder Vorbehalt im selben Satz: „bevor", „sonst", „wenn … nicht klappt". */
const BEDINGUNG = /\b(?:bevor|sonst|ansonsten|wenn|falls|sofern|solange|au(?:ß|ss)er\s+wenn|es\s+sei\s+denn|unless|before|otherwise)\b/i;
/** Jemand anderes will kündigen: „Mein Mann will kündigen, ich aber nicht." */
const DRITTE = /\b(?:mein(?:e|em|en|er)?|unser(?:e|em|en|er)?)\s+(?:mann|ehemann|frau|ehefrau|partner(?:in)?|freund(?:in)?|lebensgef(?:ä|ae)hrt\w*|sohn|tochter|vater|mutter|papa|mama|bruder|schwester|kolleg\w*|chef\w*|anwalt|anw(?:ä|ae)ltin)\b|\ber\s+(?:will|m(?:ö|oe)chte|wollte|k(?:ü|ue)ndigt)\b|\bmy\s+(?:husband|wife|partner)\b/i;
/** Ein fremder Vertrag: Handy, Strom, das Konto bei seiner Bank (wie heikelAnliegen auf WhatsApp). */
const FREMDER_VERTRAG = /\b(?:handy|mobilfunk|strom|gas|internet|dsl|fitness\w*|miet|versicherungs?|zeitungs?|netflix|spotify|giro|spar|bank|kredit)\w*(?:vertrag|konto|abo|mitgliedschaft|karte)\b|\b(?:konto|karte|kredit\w*|vertrag|abo)\s+bei\s+(?:meiner|meinem|der|dem|einer|einem)\s+\w+|\b(?:bei\s+der|meine[rn]?)\s+(?:sparkasse|volksbank|raiffeisen\w*|commerzbank|postbank|n26|ing|comdirect|targobank|hausbank|bank)\b/i;
/** „beenden" allein (ohne Vertrag/Abo) ist keine Kündigung: „Antrag beenden" = fertig machen. */
function beendenAllein(s: string): boolean {
  return /beend/i.test(s)
    && !/(?:k(?:ü|ue)ndig|stornier|wi(?:e)?der(?:r)?uf|aufl(?:ö|oe)s|nicht\s+mehr|kein\s+interesse|abbrech|zur(?:ü|ue)cktret|l(?:ö|oe)sch|verzicht|cancel|nein\s+danke)/i.test(s)
    && !/\b(?:vertrag\w*|abo|abonnement|mitgliedschaft|zusammenarbeit)\b/i.test(s);
}
/**
 * E-265 Nachbesserung 2 (01.10.2026, Gegenprobe g2 K11/K12/K33–K35, g2b): Er nimmt die Kündigung ZURÜCK —
 * „Kündigung zurücknehmen", „Ich möchte meine Kündigung widerrufen", „Bitte stornieren Sie meine Kündigung",
 * „… rückgängig machen", „Nein doch nicht", „Ach nee, lass mal", „War ein Scherz", „Hat sich erledigt",
 * „Ich nehme das zurück", „Vergessen Sie es". Irgendwo in seinen offenen Nachrichten → nie eine Buchung; vorher
 * las der Wille nur bis zum ersten klaren Satz („Ich kündige! ⏎ War ein Scherz" wurde gebucht).
 * „Ich bleibe bei meiner Kündigung" ist KEINE Rücknahme (istWillenserklaerung).
 */
const RUECKNAHME = new RegExp([
  String.raw`\bdoch\s+${NICHT}\b`, String.raw`\blass(?:en\s+sie)?\s+(?:es\s+|das\s+)?mal\b`, String.raw`\bvergessen\s+sie\s+(?:es|das|meine\s+(?:nachricht|kündigung|kuendigung))\b`,
  String.raw`\bscherz\b`, String.raw`\bhat\s+sich\s+erledigt\b`, String.raw`\b(?:nehme|ziehe)\s+(?:ich\s+)?(?:das|es|die\s+k(?:ü|ue)ndigung|meine\s+k(?:ü|ue)ndigung)?\s*zur(?:ü|ue)ck\b`,
  String.raw`\bzur(?:ü|ue)ck(?:nehmen|ziehen|genommen|gezogen)\b`, String.raw`\br(?:ü|ue)ckg(?:ä|ae)ngig\b`,
  String.raw`\bk(?:ü|ue)ndigung\b(?:\s+[^\s,;:.!?]+){0,3}?\s+(?:wi(?:e)?der(?:r)?ruf\w*|wi(?:e)?der(?:r)?uf\w*|stornier\w*|annullier\w*|aufheben|aufgehoben)\b`,
  String.raw`\b(?:wi(?:e)?der(?:r)?uf\w*|stornier\w*|annullier\w*|aufheben|ignorieren)\s+(?:sie\s+)?(?:bitte\s+)?(?:\S+\s+){0,2}?(?:meine|die|diese)\s+k(?:ü|ue)ndigung\b`,
  String.raw`\bich\s+bleibe\b(?!\s+(?:bei|auf)\s+(?:meiner|der)\s+k(?:ü|ue)ndigung)`, String.raw`\bbleibe\s+(?:doch\s+)?(?:kunde|bei\s+ihnen|bei\s+euch|dabei)\b`,
  String.raw`\bdoch\s+(?:weiter|bleiben|behalten)\b`, String.raw`\bk(?:ü|ue)ndigen\s+sie\s+(?:\S+\s+){0,3}?${NICHT}\b`,
  String.raw`\b(?:never\s+mind|forget\s+it|just\s+kidding|take\s+(?:it|that)\s+back|withdraw\s+my\s+cancellation)\b`,
].join("|"), "i");
/** Nimmt er irgendwo in diesem Text eine Kündigung zurück? Rein (WhatsApp und Postfach lesen dieselbe Regel). */
export function kuendigungRuecknahme(text: string): string | null {
  return String(text ?? "").match(RUECKNAHME)?.[0] ?? null;
}
/**
 * E-265 Nachbesserung 2 (01.10.2026, Gegenprobe g5b, E-264): Bestreiten oder falsche Nummer IRGENDWO im Text —
 * dann nie eine Kündigung und nie ein Storno, auch wenn eine Stornobitte dabeisteht („Falsche Nummer, bitte
 * stornieren", „Ich bin nicht die Person. Bitte kündigen Sie das.", „Das war mein Sohn … Bitte stornieren Sie
 * alles.", „Ich habe das nicht bestellt."). Die Leitung übernimmt (E-264). Rein; `abstreiten` ist abstreitenArt.
 */
const FREMD_ODER_BESTRITTEN = /\bfalsche?n?\s+(?:nummer|person|empf(?:ä|ae)nger)\b|\bnicht\s+(?:die|der|diese|dieser)\s+(?:person|richtige|kunde|kundin)\b|\bbin\s+(?:ich\s+)?nicht\s+(?:\S+\s+){0,2}?(?:kunde|kundin|person)\b|\bhab\w*\s+(?:(?:das|ich|es|hier|da|so|bei\s+ihnen|bei\s+euch)\s+)*(?:nicht|nie|nichts|niemals|nix)\s+(?:\S+\s+){0,2}?(?:bestellt|beantragt|unterschrieben|abgeschlossen)\b|\b(?:nie|nichts|nix)\s+(?:etwas\s+|was\s+)?(?:bestellt|beantragt|abgeschlossen)\b|\bkenne\s+(?:ich|sie|euch)\s+nicht\b|\bwrong\s+number\b/i;
export function bestreitetKuendigung(text: string, abstreiten?: (t: string) => { art?: string } | null | undefined): string | null {
  const t = String(text ?? "");
  // Nur Bestreiten und falsche Nummer — „Wer sind Sie?", eine Datenfrage, Wut oder „in Ruhe lassen" sind kein Bestreiten.
  const ab = abstreiten ? abstreiten(t) : null;
  if (ab && (ab.art === "bestreitet" || ab.art === "falsche_nummer")) return ab.art;
  const m = t.match(FREMD_ODER_BESTRITTEN);
  if (m) return m[0];
  // Jemand anderes (Sohn, Mann …) — im GANZEN Text, nicht nur im Kündigungssatz.
  if (DRITTE.test(t)) return "dritte person";
  return null;
}

/** Ein Satz, der nie als Kündigung gelten darf. Rein, im Prüfstand geprüft. */
export function keinKuendigungsSatz(s: string): string | null {
  if (VERNEINT_VOR.test(s) || VERNEINT_NACH.test(s) || VERNEINT_EN.test(s)) return "verneint";
  if (RUECKNAHME.test(s)) return "zurückgenommen";
  if (BEDINGUNG.test(s)) return "bedingung";
  if (DRITTE.test(s)) return "dritte person";
  if (FREMDER_VERTRAG.test(s)) return "fremder vertrag";
  if (beendenAllein(s)) return "beenden ohne vertrag";
  return null;
}

/** Unsere Rückfrage „Möchten Sie, dass ich Ihren Vertrag jetzt kündige? Ein kurzes Ja genügt." (und die Storno-Fassung). */
export const RUECKFRAGE_KUENDIGUNG = /\b(?:möchten|moechten|wollen)\s+sie[^?]{0,60}?\b(?:k(?:ü|ue)ndige|storniere|k(?:ü|ue)ndigen|stornieren)\b[^?]{0,20}\?|\bsoll\s+ich\b[^?]{0,60}?\b(?:k(?:ü|ue)ndigen|stornieren)\b[^?]{0,20}\?/i;
/**
 * Ein kurzes Ja auf unsere Rückfrage (Nachbesserung E-248): „Ja", „Ja bitte",
 * „Ja genau", „Ja, bitte kündigen." — vorher eine Schleife: Wir verlangten ein Ja
 * und nahmen es nicht an. Nur, wenn unsere letzte Mail die Rückfrage enthielt. Rein.
 */
export function jaAufRueckfrage(eigenerText: string, unsereLetzte: string | null | undefined): boolean {
  if (!unsereLetzte || !RUECKFRAGE_KUENDIGUNG.test(String(unsereLetzte))) return false;
  const t = String(eigenerText || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 90 || /\?/.test(t)) return false;
  if (/\b(?:nicht|nein|kein\w*|doch\s+nicht|no|not)\b/i.test(t)) return false;
  return /^(?:ja|jawohl|jap|genau|korrekt|richtig|gerne?|bitte|yes|s[ií]|oui|evet|tak|da)\b/i.test(t);
}

/**
 * Erklärt der Kunde, dass er kündigen oder stornieren will? Satzweise: Erst fallen
 * Sätze mit Verneinung, Bedingung, fremder Person oder fremdem Vertrag heraus
 * (keinKuendigungsSatz), dann gelten die Regel des Kündigungsmoduls
 * (istWillenserklaerung — bei einem formlos kündbaren Vertrag mit der weiten Liste
 * wie bei einer unbezahlten Bestellung, #5625) und die Formen oben, nie in einem
 * Satz mit Frage oder Konjunktiv.
 */
export function kuendigungsWille(text: string, opt: {
  unbezahlt?: boolean; formlos?: boolean;
  istWillenserklaerung: (t: string, o?: { unbezahlt?: boolean }) => boolean;
}): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  // E-265 Nachbesserung 2 (01.10.2026): Eine Rücknahme IRGENDWO im Text („Ich kündige! ⏎ War ein Scherz") — dann
  // ist der ganze Text keine Erklärung, auch wenn ein früherer Satz klar war (vorher endete die Prüfung dort).
  if (kuendigungRuecknahme(t)) return false;
  const saetze = t.split(/(?<=[.!;\n])\s+|(?<=\?)\s*/).map((s) => s.trim()).filter(Boolean);
  for (const s of saetze) {
    if (keinKuendigungsSatz(s)) continue;
    if (opt.istWillenserklaerung(s, { unbezahlt: !!opt.unbezahlt })) return true;
    if (WILLE_UNSICHER.test(s)) continue;
    if (WILLE_KLAR.some((m) => m.test(s))) return true;
    // Formlos kündbar (Vertrag vor dem 03.09.2026): die klaren Storno-Sätze des Moduls
    // („stornieren Sie alles", „ich will nicht mehr weitermachen") auch bei laufendem Vertrag.
    if (opt.formlos && opt.istWillenserklaerung(s, { unbezahlt: true }) && /(stornier|k(?:ü|ue)ndig|beend|nicht\s+mehr\s+weiter|nicht\s+weiter|aufh(?:ö|oe)ren|wi(?:e)?der(?:r)?uf)/i.test(s)) return true;
  }
  return false;
}

/**
 * Die Sätze SEINES Textes, aus denen das Zitat des Modells stammt (Nachbesserung
 * E-248). Geprüft wird der ganze Satz — ein Zitat „kündigen" aus „ich will nicht
 * kündigen" verliert sonst die Verneinung. Leer, wenn das Zitat nicht in seinem Text steht. Rein.
 */
export function saetzeZumZitat(zitat: string, text: string): string {
  const n = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüßàáâãåæçèéêëìíîïñòóôõøùúûýÿąćęłńśźżăîșțşğıœčďěňřšťůž]+/g, " ").trim();
  const z = n(zitat);
  if (z.length < 6) return "";
  const saetze = String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?;])\s+/).map((s) => s.trim()).filter(Boolean);
  const treffer = saetze.filter((s) => { const ns = n(s); return ns.length >= 3 && (ns.includes(z) || z.includes(ns)); });
  if (treffer.length) return treffer.join(" ");
  return n(text).includes(z) ? String(text) : "";
}

/** Steht das Zitat des Modells wirklich in seiner Mail? (Satzzeichen und Groß/Klein egal.) Rein. */
export function zitatInText(zitat: string, text: string): boolean {
  const n = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüßàáâãåæçèéêëìíîïñòóôõøùúûýÿąćęłńśźżăîșțşğıœčďěňřšťůž]+/g, " ").trim();
  const z = n(zitat);
  return z.length >= 6 && n(text).includes(z);
}

/** Eine offene Rate, wie der Kündigungssatz sie braucht. */
export interface OffeneRate { nr: number; cents: number; faellig: string | null }

/** Immer mit Cent — „59,99 €“, „7,99 €“ (euroText aus shared kürzt glatte Beträge). */
const rateEuro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const echteOffeneRaten = (raten: OffeneRate[]) =>
  raten.filter((r) => Number.isFinite(r.nr) && r.nr > 0 && Number.isFinite(r.cents) && r.cents > 0);

/**
 * DER SATZ NACH DER KÜNDIGUNG (26.09.2026, E-244) — rein, im Prüfstand geprüft.
 *
 * Nennt nur, was wirklich offen ist: keine Rate „null", kein „0,00 €". Ist
 * nichts offen, fällt der Satz über die offene Rate weg. `raten = null` heißt:
 * Die Raten konnten nicht gelesen werden — dann steht dort nur der Stand der
 * Kündigung, keine Zahl.
 */
export function kuendigungSatz(weg: string, raten: OffeneRate[] | null, opt: { beendet?: boolean; formlos?: boolean; endeTag?: string | null } = {}): string {
  if (weg === "storno_unbezahlt") return "Die Bestellung wurde storniert; es bleibt nichts offen.";
  // E-265 (01.10.2026, Recht): Altvertrag — „gilt zum Ende Ihres laufenden Abrechnungsmonats, dem <Datum>" (giltZumSatz).
  const giltZum = giltZumSatz(opt.endeTag);
  // E-265 Nachbesserung 2 (01.10.2026): Altvertrag — die Kündigung gilt zum Ende des Abrechnungsmonats; Raten danach entfallen mit ihr.
  if (weg === "sofort_beendet") return opt.formlos
    ? `Die Kündigung ist vermerkt und ${giltZum}; es ist keine Rate mehr offen (Raten für die Zeit danach entfallen).`
    : "Alle fälligen Raten sind bezahlt — der Vertrag ist beendet.";
  if (weg === "kulanz_sofort") return "Der Vertrag ist beendet; offene Raten entfallen.";
  // Storniert oder beendet: nie ein Betrag, auch wenn die Daten eine Rate zeigen (E-244).
  if (weg === "bereits" && opt.beendet) return "Die Kündigung lag bereits vor; der Vertrag ist beendet.";
  const kopf = weg === "bereits" ? "Die Kündigung lag bereits vor." : "Die Kündigung ist vermerkt.";
  if (raten == null) return `${kopf} Die offenen Raten konnten gerade nicht gelesen werden.`;
  const echte = echteOffeneRaten(raten);
  if (!echte.length) return `${kopf} Es ist keine Rate mehr offen.`;
  if (echte.length === 1) {
    const r = echte[0];
    // E-265 Nachbesserung (29.09.2026, Recht): Beim Vertrag vor dem 03.09.2026 endet der Vertrag zum Ende des
    // Abrechnungsmonats — nie „mit dieser Zahlung endet der Vertrag" (die Beendigung hängt nie an der Zahlung, § 312k BGB).
    return `${kopf} Offen bleibt Rate ${r.nr} über ${rateEuro(r.cents)}${r.faellig ? ` (fällig ${r.faellig})` : ""}; ${opt.formlos ? `sie bleibt zu zahlen, die Kündigung ${giltZum}.` : "mit dieser Zahlung endet der Vertrag."}`;
  }
  const liste = echte.map((r) => `Rate ${r.nr} über ${rateEuro(r.cents)}`);
  const summe = echte.reduce((s, r) => s + r.cents, 0);
  return `${kopf} Offen bleiben ${liste.slice(0, -1).join(", ")} und ${liste[liste.length - 1]}, zusammen ${rateEuro(summe)}; ${opt.formlos ? `sie bleiben zu zahlen, die Kündigung ${giltZum}.` : "mit diesen Zahlungen endet der Vertrag."}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// WERBESPERRE NUR AUF AUSDRÜCKLICHEN WUNSCH — IM EIGENEN TEXT (E-275, 02.10.2026)
//
// Justin: „Mara soll positiv, verkäuferisch und selbstständig agieren.“ Der
// Anlass: Satpal Jhim (Person 4816) hat FIAON Ultra am 02.08. bezahlt und fragt
// seit dem 03.09. nach seiner Karte. Am 09.09. kam eine Mail ohne eigenen Text
// („Sent from Yahoo Mail for iPhone“ + ein Bild); das Modell ordnete sie als
// „abmeldung“ ein und rief werbesperre_setzen. (Richtigstellung, E-275
// Gegenprüfung: Mail 3644 trug im eigenen Betreff „… bitte not again send me e
// mail for rattan ok“ — ein echter Wunsch, die Sperre war richtig; auch die
// Liste unten erkennt ihn.) Seitdem war er für das Postfach
// „gesperrt“ (nur Übergabe) — und die automatische Einladung der Partnerbank
// ließ ihn aus: Den Kartenlink hat er nie bekommen. Gemessen (nur lesend): 39
// zahlende Stufenpaket-Kunden mit Werbesperre, 27 davon ohne Einladung.
//
// Jetzt zählt nur, was ER schreibt: sein eigener Text (ohne Zitat, ohne
// Signaturzeilen wie „Sent from …“, ohne den Anhang-Hinweis des Laufs) und sein
// Betreff, wenn es KEIN „Re:/AW:“ auf unsere Mail ist (dann ist es unser
// Betreff). Eine leere Mail, eine Signatur oder ein Bild sind NIE ein Wunsch.
// Riegel (riegelAnwenden: Merker „stopp“, Kategorie „abmeldung“) und Werkzeug
// lesen dieselbe Regel. Rein, im Prüfstand geprüft.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wo ein Mailprogramm seinen Fuß anhängt — nie ein Wort des Kunden. Auch mitten in der Zeile: Die
 * Postfach-Texte kommen oft ohne Zeilenumbruch („Ich habe kein Interesse  Gesendet von Yahoo Mail …“,
 * „STOPVon meinem/meiner Galaxy gesendet“).
 */
const SIGNATUR_BEGINN = /(?:sent\s+from\b|sent\s+with\b|gesendet\s+(?:von|mit|vom|über|ueber)\b|von\s+meine[mrn]?\S*\s+(?:\S+\s+){0,3}?gesendet\b|enviado\s+(?:desde|do)\b|envoy[ée]\s+(?:de|depuis)\b|inviato\s+da\b|verzonden\s+(?:vanaf|met)\b|wys[łl]ane\s+z\b|get\s+outlook\s+for\b|holen\s+sie\s+sich\s+outlook\b|yahoo\s+mail\s*:|diese\s+e-?mail\s+wurde\s+von\s+avast)/i;

/** Sein eigener Text: ohne Anhang-Hinweis des Laufs, ohne Zitat, ohne Signatur. Rein. */
export function eigenerKundentext(text: unknown): string {
  const ohneAnhang = String(text ?? "").split("\n\n[Der Kunde hat ")[0];
  return kundenTeil(ohneAnhang)
    .replace(/&nbsp;/gi, " ")
    .split("\n")
    .filter((z) => !/^\s*(?:--|_{2,})\s*$/.test(z))
    .map((z) => {
      const i = z.search(SIGNATUR_BEGINN);
      return i >= 0 ? z.slice(0, i) : z;
    })
    .join("\n")
    .trim();
}

/** Der Betreff zählt nur, wenn er SEINER ist — ein „Re:/AW:“ trägt unseren Betreff. Rein. */
export function eigenerBetreff(betreff: unknown): string {
  const b = String(betreff ?? "").trim();
  return /^\s*(?:re|aw|antw|sv|wg|fw|fwd|vs)\s*(?:\[\d+\])?\s*:/i.test(b) ? "" : b;
}

/** Hat er selbst etwas geschrieben? Leer, nur Signatur, nur Satzzeichen → nein. Rein. */
export function hatEigenenText(text: unknown, betreff?: unknown): boolean {
  const t = `${eigenerBetreff(betreff)}\n${eigenerKundentext(text)}`;
  return /[a-zA-ZäöüÄÖÜß]{2,}/.test(t.replace(/\[[^\]]*\]/g, " "));
}

/**
 * Was ein ausdrücklicher Wunsch nach „keine Werbung / keine Mails mehr“ ist —
 * bewusst ohne „keine Mail bekommen“ (eine Service-Frage), ohne „belästigen“
 * allein („Ich will Sie nicht belästigen, aber …“) und ohne „löschen“ allein
 * (das prüft istLoeschwunsch).
 */
const STOPP_AUSDRUECKLICH: RegExp[] = [
  /(?:^|[\s.,!?;:„"(])s\s?t\s?o\s?p\s?p?(?=[\s.,!?;:“")]|$)/i,
  /\b(?:abmeld\w*|abbestell\w*|austragen|unsubscribe\w*|verteiler)\b/i,
  /\bkeine\s+(?:\S+\s+){0,2}?(?:werbung|werbemails?|newsletter|angebote|reklame)\b/i,
  /\bkeine\s+weiteren?\s+(?:\S+\s+){0,1}?(?:e-?mails?|mails?|ma[ei]l\w*|nachrichten|sms|anrufe|post|erinnerungen|kontaktaufnahme\w*|korrespondenz)\b/i,
  /\bkeine\s+(?:\S+\s+){0,1}?(?:e-?mails?|mails?|ma[ei]l\w*|me[ie]l\w*|nachrichten|sms|anrufe|post|informationen|infos?|benachrichtigungen)\s+mehr\b/i,
  /\bbitte\s+keine\s+(?:\S+\s+){0,1}?(?:e-?mails?|mails?|ma[ei]l\w*|me[ie]l\w*|nachrichten|sms|anrufe|post)\b|\bbitte\s+nicht\s+me[a-z]{0,2}h?r\b/i,
  /\b(?:nicht|nie)\s+mehr\s+(?:\S+\s+){0,2}?(?:an)?(?:schreiben|kontaktieren|anrufen|mailen|zuschicken|schicken|senden|belästigen|belaestigen)\b/i,
  /\b(?:kontaktieren|anschreiben|anrufen|schreiben|belästigen|belaestigen|mailen|schicken|senden)\s+(?:sie|ihr|du)\s+mich\s+(?:\S+\s+){0,2}?(?:nicht|nie)\s+mehr\b/i,
  /\bschreib\w*\s+(?:sie\s+|ihr\s+|du\s+)?(?:\S+\s+){0,2}?mir\s+(?:\S+\s+){0,2}?(?:nicht|nie|nichts)\s+mehr\b/i,
  /\bstellen\s+sie\s+(?:\S+\s+){0,3}?\S*(?:mail|nachricht|benachrichtigung|erinnerung)\S*\s+(?:\S+\s+){0,2}?ein\b/i,
  /\bweitere\s+(?:e-?mails?|mails?|nachrichten|schreiben)\s+(?:sind|werden|braucht|bitte)\b|\bw(?:ü|ue)nsche\s+(?:\S+\s+)?keine\b/i,
  /\bwenn\s+(?:ihr|sie|du)\s+mir\s+(?:\S+\s+){0,2}?weiter(?:hin)?\s+(?:\S+\s+){0,2}?(?:schick|schreib|send|mail)/i,
  /\bh(?:ö|oe)r(?:en|t)\s+(?:sie|ihr)\s+(?:\S+\s+){0,4}?auf\b/i,
  /\b(?:nix|nichts)\s+mehr\s+(?:\S+\s+){0,3}?(?:hören|hoeren|bekommen|erhalten|wissen)\b|\bnichts\s+(?:mehr\s+)?mit\s+(?:ihnen|euch|dir|fiaon)\s+zu\s+tun\b/i,
  // Kein Interesse — auch mit Tippfehlern („Keine Interese“, „Nich interesiet“) und in anderen Sprachen.
  /\bkein\w*\s+(?:inter+ess?e?|bedarf)\b|\b(?:nicht|nich)\s+(?:\S+\s+){0,6}?interess?ie?r?t\b|\bnot\s+interested\b|\bnem(?:á|a)m\s+z(?:á|a)ujem\b/i,
  /(?:^|[.!?\n]\s*)n(?:ei|ai)n,?\s+danke\b|\bno,?\s+thanks?\b/i,
  /\b(?:auf\s+(?:das|ihr|dieses)\s+angebot|darauf)\s+verzichten\b|\bhatt?\s+sich\s+(?:\S+\s+)?erledigt\b|\bkenne\s+(?:sie|ihre\s+firma|euch|fiaon)\s+nicht\b/i,
  /\bm(?:ö|oe)chte\s+(?:ihre?n?|die|das|eine?n?)\s+\S+\s+nicht\b(?!\s+(?:verpassen|verlieren|warten|zahlen|bezahlen|vergessen|verpasst|kündigen|kuendigen))/i,
  /\bm(?:ö|oe)chte\s+(?:ich\s+)?(?:\S+\s+)?kein(?:e[nm]?)?\s+(?:abo\w*|vertrag|karte|angebot\w*|dienstleistung\w*)\b|\bbrauche\s+(?:\S+\s+)?keine\s+karte\s+mehr\b/i,
  // Löschen: „Bitte löschen.“, „löschen Sie mich“, „alle Daten zu löschen“ (istLoeschwunsch kennt die ganzen Sätze).
  /^\s*(?:bitte\s+)?l(?:ö|oe)schen[.!]*\s*$|\bbitte\s+l(?:ö|oe)schen\b|\bl(?:ö|oe)schen\s+sie\s+(?:\S+\s+){0,2}?(?:mich|meine|alle|das)\b|\b(?:daten|account|konto|anfrage)\b[^.!?\n]{0,40}\bl(?:ö|oe)schen\b/im,
  /\bnie\s+(?:angemeldet|registriert|angefragt|eingetragen)\b|\b(?:nicht|nichts)\s+(?:angemeldet|registriert|angefragt|eingetragen)\b|\bwiderspreche\w*\b|\bart\.?\s*21\b/i,
  /\bin\s+ruhe\s+lassen\b|\blass\w*\s+(?:sie\s+|ihr\s+)?(?:mich|mir|uns)\s+(?:bitte\s+|endlich\s+)?in\s+ruhe\b/i,
  /\bstop\s+(?:sending|emailing|contacting|writing|messaging)\b|\b(?:do\s+not|don'?t|never)\s+(?:\S+\s+)?(?:send|contact|write|email|e-mail)\s+me\b|\bnot\s+again\s+send\b|\bno\s+more\s+(?:e-?mails?|mails?|messages?)\b|\bremove\s+me\b|\btake\s+me\s+off\b|\bopt\s*-?\s*out\b/i,
];

/**
 * Hat er AUSDRÜCKLICH um „keine Werbung / keine Mails mehr“ gebeten — in SEINEM
 * Text oder SEINEM Betreff? Rein. Für den Riegel (Merker stopp, Kategorie
 * abmeldung) und für werbesperre_setzen.
 */
export function ausdruecklicherStopp(betreff: unknown, text: unknown): boolean {
  const eigen = eigenerKundentext(text);
  const t = `${eigenerBetreff(betreff)}\n${eigen}`.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (STOPP_AUSDRUECKLICH.some((m) => m.test(t)) || stoppWunsch(eigen) || stoppWunsch(eigenerBetreff(betreff))) return true;
  const ab = abstreitenArt(eigen);
  return ab?.art === "in_ruhe" || istLoeschwunsch(eigen);
}

// ── E-275 GEGENPRÜFUNG (02.10.2026, Wahrheit und Recht): DIE LISTE OBEN IST KEIN VETO ──────────
// Justin: „Mara soll positiv, verkäuferisch und selbstständig agieren.“ — und die Wand des Hauses: STOPP heißt keine
// WERBUNG mehr (§ 7 UWG, Art. 21 DSGVO). Gegen die 113 Stopp-Mails seit 01.08. gerechnet (nur lesend) erkennt
// ausdruecklicherStopp 12 nicht — 11 davon mit eigenem Text, darunter echte Wünsche: „schicken sie mir keine Nachricht
// mehr“ (#3149), „jede weitere werbliche Kontaktaufnahme … zu unterlassen“ (#4278), „bittee löschen sie dieses
// account“ (#2797), „Bitte Antrag löschen“ (#5715), „fack off“ (#3879). Als Veto hätte die Liste dort die Werbesperre
// verweigert und den Merker stopp gelöscht (STOPP_KOEPFE: WA-Zentrale, Mara-Aktion, Telefonkartei) — Werbung an
// Menschen, die „Stopp“ gesagt haben. Ein Fehlalarm kostet seit E-275 nur Werbung (der Service für Zahlende läuft
// trotz Sperre), ein verpasster Stopp ist ein Rechtsverstoß. Deshalb: Die Liste verhindert nur, was der 09.09. war —
// eine Sperre aus einer Mail OHNE eigenen Text (Signatur, Bild, leer) oder aus einem Satz, der nicht seiner ist
// (unsere zitierte Mail). Steht das Zitat in SEINEM Text, gilt das Urteil des Modells wie vor E-275.

/** Die Wörter eines Textes (ab drei Buchstaben, klein) — für den Abgleich Zitat ↔ eigener Text. Rein. */
// E-275 (02.10.2026, tsc TS1501): als new RegExp — der tsconfig-Zielstand kennt das Flag „u“ in Literalen nicht; Muster und Flags unverändert.
const WORT_AB_DREI = new RegExp(String.raw`[\p{L}]{3,}`, "gu");
function woerter(text: unknown): string[] {
  return (String(text ?? "").toLowerCase().match(WORT_AB_DREI) ?? []);
}

/**
 * Steht das Zitat (sinngemäß wörtlich) in SEINEM eigenen Text oder Betreff? Mindestens 60 % seiner Wörter — das Modell
 * glättet Tippfehler und Satzzeichen, ein Satz aus unserer zitierten Mail oder eine Signatur trifft so nie. Rein.
 */
export function zitatAusEigenemText(zitat: unknown, betreff: unknown, text: unknown): boolean {
  const z = Array.from(new Set(woerter(zitat)));
  if (!z.length) return false;
  const eigen = new Set(woerter(`${eigenerBetreff(betreff)}\n${eigenerKundentext(text)}`));
  const treffer = z.filter((w) => eigen.has(w)).length;
  return treffer >= Math.min(2, z.length) && treffer / z.length >= 0.6;
}

/**
 * Darf werbesperre_setzen sperren? null = ja, sonst der Satz für das Modell. Ja, wenn die Liste oben den Wunsch
 * erkennt — oder wenn er eigenen Text geschrieben hat und das Zitat daraus stammt (Urteil des Modells, s. o.). Rein.
 */
export function werbesperreUrteil(betreff: unknown, kundeText: unknown, zitat: unknown): string | null {
  if (ausdruecklicherStopp(betreff, kundeText)) return null;
  if (!hatEigenenText(kundeText, betreff)) {
    return "Die Mail hat keinen eigenen Text (nur Signatur, Bild oder leer) — das ist NIE ein Abmeldewunsch. KEINE Werbesperre; sieh in den Betreff und beantworte sein Anliegen.";
  }
  if (zitatAusEigenemText(zitat, betreff, kundeText)) return null;
  return "Das Zitat steht nicht in seinem eigenen Text (Signatur oder unsere zitierte Mail) — KEINE Werbesperre. Bittet er in SEINEN Worten um keine Post mehr, zitiere genau diese Worte; sonst beantworte sein Anliegen.";
}

/** WERBESPERRE — nur auf ausdrücklichen Wunsch, mit Zitat. */
export const werbesperreSetzen: Werkzeug = {
  name: "werbesperre_setzen",
  // E-275 (02.10.2026): Die Prüfung steht jetzt im Werkzeug (ausdruecklicherStopp) — eine leere Mail, eine Signatur
  // oder ein Bild setzten am 09.09. die Sperre, die einem zahlenden Kunden den Kartenlink nahm (Person 4816).
  beschreibung: "Nimmt den Kunden aus allen Werbe- und Erinnerungsmails. NUR wenn er in SEINEM eigenen Text ausdrücklich darum bittet ('keine Mails mehr', 'Stopp', 'abmelden', 'aus dem Verteiler nehmen', 'lassen Sie mich in Ruhe'). Nie bei einer Mail ohne eigenen Text (nur Signatur wie „Sent from …“, nur ein Bild), nie wegen Ärger über eine Mahnung allein, nie wegen eines Satzes aus unserer zitierten Mail. Vertragspost wie Rechnungen bleibt davon unberührt — und der Service für einen zahlenden Kunden (Karte, Zahlung, Fragen) läuft weiter.",
  stufe: "frei",
  // 26.09.2026 (E-244): auch „gesperrt" — dort landen beendete und stornierte
  // Verträge. Genau die schrieben am 24.09. „keine weiteren E-Mails" (Mail 5597)
  // und Mara konnte die Sperre nicht setzen: 5 von 8 offenen Stopp-Entwürfen
  // ohne Werbesperre.
  lagen: ["interessent", "unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv", "rate_ueberfaellig", "gekuendigt", "bestreitet", "gesperrt", "unklar"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { zitat: { type: "string", description: "Der wörtliche Satz, mit dem der Kunde darum bittet." } },
    required: ["zitat"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz nicht möglich." };
    if (String(p.zitat || "").trim().length < 5) return { ok: false, ergebnis: "", fehler: "Zitat fehlt." };
    // E-275 (02.10.2026): nur sein eigener Text (oder sein eigener Betreff) zählt. Ohne Kundentext im Kontext
    // (Werkbank, ältere Aufrufer) gilt das Zitat als sein Text — wie bisher.
    const eigen = k.kundeText != null ? String(k.kundeText) : String(p.zitat);
    // E-275 Gegenprüfung (02.10.2026): kein Veto der Liste über seine eigenen Worte — werbesperreUrteil (Kopf oben).
    const nein = werbesperreUrteil(k.betreff ?? "", eigen, p.zitat);
    if (nein) return { ok: false, ergebnis: "", fehler: nein };
    // Zahlungspost-Freigabe (zweite Prüfung, 08.10.2026): sein Wunsch — werbesperre_quelle 'mensch', auch auf eine
    // stehende Werbesperre der Freigabe (fiaon-mail-frequenz.ts, FREIGABE_WERBESPERRE_PERSONEN_SQL).
    await sqlPool`
      UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()), werbesperre_quelle = 'mensch', updated_at = NOW()
       WHERE id = ${k.personId}
    `;
    await protokoll(k, "werbesperre_setzen", `Kunde bittet um Stopp der Werbe- und Erinnerungsmails („${String(p.zitat).slice(0, 120)}") — Werbesperre gesetzt.`);
    return { ok: true, ergebnis: "Der Kunde ist ab sofort aus allen Werbe- und Erinnerungsmails heraus.", daten: { gesperrt: true } };
  },
};

/** MAHNSTOPP — Erinnerungen zu einer Bestellung anhalten. */
export const mahnstoppSetzen: Werkzeug = {
  name: "mahnstopp_setzen",
  beschreibung: "Hält die automatischen Zahlungserinnerungen zu dieser Bestellung an. NUR wenn der Kunde eine Zahlung belegt, einen konkreten Einwand nennt (falscher Betrag, doppelt abgebucht) oder ausdrücklich um eine Ratenpause bittet. NICHT, weil er nicht zahlen will, wütend ist oder erst eine Antwort möchte — die Forderung bleibt, und die Antwort gibst du selbst.",
  stufe: "frei",
  // 08.09.2026 (E-167, Justin): Mara bekommt dieses Werkzeug nicht mehr angeboten —
  // die Erinnerungen laufen, bis die Zahlung gebucht ist. `lagen: []` statt Löschen,
  // damit alte Entwürfe und das Protokoll (werkzeugFinden) den Namen weiter kennen.
  lagen: [],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { grund: { type: "string", description: "Warum die Erinnerungen anhalten sollen." } },
    required: ["grund"],
  },
  async ausfuehren(p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung nicht möglich." };
    await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = COALESCE(mahnstopp_am, NOW()), updated_at = NOW() WHERE ref = ${k.ref}`;
    await protokoll(k, "mahnstopp_setzen", `Zahlungserinnerungen angehalten — ${String(p.grund || "").slice(0, 200)}`);
    return { ok: true, ergebnis: "Die automatischen Erinnerungen zu dieser Bestellung sind angehalten.", daten: { mahnstopp: true } };
  },
};

/** ZAHLUNGSSEITE — der eine Weg zu Bankdaten. Nie IBAN im Prompt. */
export const zahlungslinkBauen: Werkzeug = {
  name: "zahlungslink_bauen",
  beschreibung: "Liefert die Zahlungsseite zu einer offenen Rechnung: QR-Code, Bankdaten, Verwendungszweck, Betrag. Nutze sie immer, wenn es um eine Zahlung geht — nenne NIE Bankdaten aus dem Gedächtnis, sondern verlinke diese Seite.",
  stufe: "frei",
  lagen: ["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt", "aktiv"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { referenz: { type: "string", description: "Zahlungs- oder Ratenreferenz aus der Akte, z. B. FIAON-ABC123 oder FIAON-ABC123-3." } },
    required: ["referenz"],
  },
  async ausfuehren(p, k) {
    const ref = String(p.referenz || "").trim().toUpperCase();
    if (!/^FIAON-?[A-Z0-9]{6}(-\d{1,2})?$/.test(ref)) return { ok: false, ergebnis: "", fehler: "Referenz sieht nicht wie eine Zahlungsreferenz aus." };
    const { zahlungsauftragFinden } = await import("./fiaon-zahlungsauftrag");
    const z = await zahlungsauftragFinden(ref);
    if (!z) return { ok: false, ergebnis: "", fehler: "Zu dieser Referenz gibt es keinen offenen Auftrag." };
    // E-272: Beim Global-Kunden keine Zahlungsseite einer Privatbestellung — und VOR der Neufreischaltung
    // unten, die eine abgelaufene Privatbestellung wieder öffnet und ihm die Zahlungsdaten erneut mailt.
    const privatBeiGlobal = await privatReferenzBeiGlobal(k, z);
    if (privatBeiGlobal) return { ok: false, ergebnis: "", fehler: privatBeiGlobal };
    if (z.status === "paid") return { ok: false, ergebnis: "", fehler: "Diese Rechnung ist bereits bezahlt — sag das dem Kunden, statt zu einer Zahlung aufzufordern." };
    // E-265 Schluss-Nachbesserung (01.10.2026): Eine stornierte Rate wird nie verlangt (vorher baute das Werkzeug auch ihre Seite).
    if (z.status === "cancelled") return { ok: false, ergebnis: "", fehler: "Diese Rate ist storniert — sie wird nicht verlangt. Keine Zahlungsaufforderung, kein Betrag dazu." };
    // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 M3): Altvertrag gekündigt, die Rate ist erst NACH dem Vertragsende
    // fällig (#5779: gekündigt 06.09., Rate 3 fällig 06.10.) — nie verlangt, also keine Zahlungsseite und nie „letzte Rate".
    if (z.art === "rate") {
      const { rateNachVertragsende } = await import("./fiaon-kuendigung");
      const nach = await rateNachVertragsende(ref).catch(() => null);
      if (nach) return { ok: false, ergebnis: "", fehler: `Rate ${nach.nr} ist erst am ${nach.faellig} fällig — NACH dem Vertragsende (seine Kündigung gilt zum ${nach.ende}, Vertrag vor dem 03.09.2026). Sie wird nie verlangt: keine Zahlungsseite, kein Betrag, nie „letzte Rate“. Sag ihm, dass seine Kündigung zum ${nach.ende} gilt — unabhängig von jeder Zahlung — und dass für die Zeit danach nichts verlangt wird.` };
    }
    // E-248 (#5500): Eine Zahlungsseite „über null €" hilft niemandem.
    if (!(Number(z.amountDue) > 0)) return { ok: false, ergebnis: "", fehler: "Zu dieser Bestellung ist noch kein Betrag hinterlegt — keine Zahlungsaufforderung, keinen Betrag nennen; der Betreuer trägt Paket und Betrag nach (aufgabe_an_betreuer)." };
    // E-248: In einer Antwort auf Stopp, Widerruf, Beschwerde, Bestreiten … keine Zahlungsseite.
    if (k.ruhe) return { ok: false, ergebnis: "", fehler: `Diese Antwort ist keine Zahlungsaufforderung (${k.ruhe}) — beantworte sein Anliegen, ohne Zahlungsseite.` };
    // E-264 (29.09.2026): Ohne abgeschickten Antrag gibt es keinen Vertrag und keine Rechnung — die
    // Bestellung (approved + pending_payment ab Schritt 3–5) ist nur ein Zwischenstand des Formulars.
    if (z.art === "bestellung" && !(await bestellungAbgeschickt(String(z.paymentReference)))) {
      return { ok: false, ergebnis: "", fehler: "Sein Antrag ist nie abgeschickt — es gibt keine Rechnung und keine Zahlungsseite. Kein Wort vom Bezahlen; der Schritt ist sein Antrag (Knopf „antrag“)." };
    }

    // (Bis 19.09.2026 stand hier der Einzugsschutz — GoCardless ist beendet, E-194.
    //  Jede offene Rate wird überwiesen; die Zahlungsseite gilt für alle.)

    // Nachbesserung E-248: Eine ABGELAUFENE Bestellung (payment_status 'expired',
    // 96 in Produktion) zeigt auf der Zahlungsseite das rote Band „abgelaufen …
    // kontaktieren Sie den Support". Der Kunde HAT sich gemeldet — also schaltet
    // Mara sie selbst neu frei (derselbe Weg wie der Knopf im Agentenportal), statt
    // ihm die Sackgasse zu schicken.
    let neuFrei = false;
    if (z.status === "expired") {
      neuFrei = await abgelaufeneBestellungFreischalten(String(z.paymentReference)).catch(() => false);
      if (!neuFrei) return { ok: false, ergebnis: "", fehler: "Die Bestellung ist abgelaufen und konnte nicht neu freigeschaltet werden — schick keine Zahlungsseite; sein Betreuer schaltet sie frei (aufgabe_an_betreuer)." };
      await protokoll(k, "zahlungslink_bauen", `Abgelaufene Bestellung ${z.paymentReference} neu freigeschaltet (neue Zahlungsfrist 7 Tage).`);
    }
    const url = absoluteUrl(`/zahlung/${z.paymentReference}`);
    return {
      ok: true,
      ergebnis: `Zahlungsseite für ${z.paymentReference} über ${z.amountDue} €.${neuFrei ? " Die Bestellung war abgelaufen — ich habe sie gerade neu freigeschaltet, die Zahlungsseite gilt wieder (neue Frist 7 Tage)." : ""}`,
      daten: { zahlungsseite: url, betrag: z.amountDue, verwendungszweck: z.paymentReference, faellig: z.dueDate, art: z.art, rate_nr: z.rateNr ?? null },
    };
  },
};

/** TERMINLINK — der stärkste Hebel im Haus (Faktor 6 bei der Zahlungsquote). */
export const terminlinkBauen: Werkzeug = {
  name: "terminlink_bauen",
  beschreibung: "Liefert einen persönlichen Terminlink für ein 15-Minuten-Gespräch. Nutze ihn, wenn ein Gespräch mehr bringt als eine Erklärung: Unsicherheit, Ärger, komplizierte Lage, Kündigungswunsch.",
  stufe: "frei",
  lagen: "alle",
  parameter: { type: "object", additionalProperties: false, properties: {}, required: [] },
  async ausfuehren(_p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz nicht möglich." };
    // E-248: Steht schon ein Termin, gibt es keinen zweiten Link — Mara nennt den Termin,
    // so wie ein Mensch („Florentine ruft Sie morgen um 20 Uhr an"). Dieselbe Regel wie auf WhatsApp.
    const steht = await bestehenderTermin(k.personId);
    if (steht) {
      return { ok: false, ergebnis: "", fehler: `Er hat schon einen Termin: ${steht.vorname ? `${steht.vorname} ruft ihn ` : ""}${steht.kundenText}${steht.vorname ? " an" : ""}. Keinen Link schicken — nenne ihm genau diesen Termin.` };
    }
    const { terminLink } = await import("./fiaon-termine");
    const url = terminLink(k.personId, "postmeister");
    return { ok: true, ergebnis: "Terminlink erzeugt — sein persönlicher Kalender, er wählt selbst eine Zeit.", daten: { terminlink: url } };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// KARTE SENDEN — DER LINK DER PARTNERBANK VON MARA SELBST (E-275, 02.10.2026)
//
// Justin: „MARA verweist immer mehr auf die Mitarbeiter, Mara soll aber
// selbstständig arbeiten … Mara soll selbst verkaufen." Der Anlass (#6120,
// 02.10.): „I have not your kaditkarte“ — Mara antwortete „The card itself is
// issued and sent by the bank … I have asked Nikita Boychenko to check this
// today". Ein Werkzeug, mit dem sie den Kartenlink selbst schicken kann, gab es
// nicht; gemessen 18.09.–02.10.: 88 Kartenfragen auf WhatsApp, 62 % mit
// Übergabe oder Termin beantwortet.
//
// Das Werkzeug liest zuerst den handgepflegten Bank-Stand der Akte
// (kartenLage: beantragt, in Produktion, versandt …) — dann gibt es keinen
// neuen Link. Sonst ruft es die EINE Funktion aus dem Bereich Karte:
// karteEinladungFuerPerson (server/lib/fiaon-konto-karte.ts). Sie prüft
// Ausschlüsse, Konto, Zahlung und Angaben, schickt die Einladung (oder erneut)
// und liefert den Satz für den Kunden (satz) samt Grund (intern). Aufruf:
// karteEinladungFuerPerson(personId, { erneut, quelle, akteurName, postmeisterId })
// → { ok, aktion, satz, intern, gesendet, grund, schonAm, betreff }.
// Fehlt sie, schickt das Werkzeug NICHTS und sagt das dem Modell — nie „der
// Link ist raus" ohne Versand. Je Mail höchstens ein Versand (E-246).
// ═══════════════════════════════════════════════════════════════════════════

/** Was karteEinladungFuerPerson (Bereich Karte, fiaon-konto-karte.ts) liefert — tolerant gelesen (alle Felder außer ok optional). */
export interface KarteEinladungErgebnis {
  /** Der Kunde hat jetzt seinen Link (oder sein Konto steht schon). */
  ok: boolean;
  /** gesendet · erneut_gesendet · schon_unterwegs · konto_steht · nicht_bereit · gesperrt · fehler */
  aktion?: string | null;
  /** Der Satz für den Kunden (Sie-Form, Deutsch) — null: nichts für ihn, Übergabe. */
  satz?: string | null;
  /** Für Akte, Protokoll und Übergabe — nie an den Kunden. */
  intern?: string | null;
  /** Ging JETZT eine Mail raus? */
  gesendet?: boolean;
  /** Warum nicht. */
  grund?: string | null;
  fehler?: string | null;
  /** Zuletzt geschickt VOR diesem Aufruf (ISO). */
  schonAm?: string | Date | null;
  /** Betreff der Einladung, wie sie rausging. */
  betreff?: string | null;
}
/** Die Signatur aus dem Bereich Karte (E-275), wie das Postfach sie ruft. */
export type KarteEinladungFn = (personId: number, opt?: {
  /** true (Vorgabe): auch wenn schon einmal geschickt (der Kunde hat ihn nicht oder nicht mehr). */
  erneut?: boolean;
  /** Wer auslöst — für Verlauf und Mail-Protokoll. */
  quelle?: string;
  akteurName?: string;
  postmeisterId?: number | null;
}) => Promise<KarteEinladungErgebnis>;

/** Für den Prüfstand: eine Attrappe statt der echten Funktion (undefined = echte laden). */
export const KARTE_EINLADUNG_QUELLE: { fn?: KarteEinladungFn | null } = {};

/** Die Funktion aus dem Bereich Karte — null, wenn sie (noch) nicht da ist. */
export async function karteEinladungLaden(): Promise<KarteEinladungFn | null> {
  if (KARTE_EINLADUNG_QUELLE.fn !== undefined) return KARTE_EINLADUNG_QUELLE.fn;
  try {
    const m: any = await import("./fiaon-konto-karte");
    return typeof m?.karteEinladungFuerPerson === "function" ? (m.karteEinladungFuerPerson as KarteEinladungFn) : null;
  } catch {
    return null;
  }
}

/** Der Satz für den Kunden, wenn der Link jetzt raus ist und die Funktion keinen eigenen liefert — Justins wahrer Weg. Rein. */
export function karteGesendetSatz(ein: { erneut: boolean; betreff?: string | null }): string {
  // Der Betreff der Vorlage endet mit dem Vornamen („…, Satpal“) — zitiert wird nur der feste Teil.
  const betreff = String(ein.betreff || "").split(",")[0].trim() || "Ihr Link zur Karte ist da";
  return `Den fertigen Link unserer Partnerbank für Ihren Kartenantrag habe ich Ihnen ${ein.erneut ? "eben noch einmal" : "eben"} geschickt — in einer eigenen E-Mail mit dem Betreff „${betreff}“. `
    + "Der Antrag bei unserer Partnerbank dauert online nur wenige Minuten, Sie brauchen nur Ihren Ausweis. "
    + KARTE_ZEIT_SATZ;
}

/** Was die Bank-Stände der Akte (fiaon-kartenstatus.ts) für die Antwort heißen — kein neuer Link, wenn die Karte schon unterwegs ist. */
const KARTE_STAND_SATZ: Record<string, string> = {
  beantragt: "Sein Kartenantrag liegt bei der Partnerbank — sie prüft ihn gerade. Nach ihrer Zusage ist die Karte in der Regel in 2–5 Werktagen bei ihm, meist vorher schon in der App mit Apple Pay nutzbar. KEIN neuer Link.",
  in_produktion: "Seine Karte wird gerade hergestellt — sie ist in der Regel in wenigen Werktagen bei ihm, meist vorher schon in der App der Bank mit Apple Pay nutzbar. KEIN neuer Link.",
  versandt: "Seine Karte ist auf dem Postweg zu ihm — in der App der Bank kann er sie meist schon mit Apple Pay nutzen. KEIN neuer Link.",
  zugestellt: "Seine Karte ist laut Akte zugestellt. Frag freundlich, ob sie angekommen ist; PIN und Freischaltung kommen von der Bank (App der Bank). KEIN neuer Link.",
  zurueck: "Die Kartensendung kam zur Bank zurück — er soll seine Anschrift in der App der Bank prüfen; dann schickt die Bank sie erneut. KEIN neuer Link.",
  abgelehnt: "Die Bank hat den Kartenantrag abgelehnt. Sag es ihm ehrlich und warm, ohne Vorwurf, und biete das Gespräch an (terminlink_bauen) — dort besprechen wir die nächsten Schritte. KEIN neuer Link.",
};

export const karteSenden: Werkzeug = {
  name: "karte_senden",
  beschreibung: "Schickt einem ZAHLENDEN Kunden den fertigen Link unserer Partnerbank für Konto und Karte (die Einladung „Ihr Link zur Karte ist da“) — oder schickt ihn erneut, wenn er ihn nicht hat. Rufe es IMMER, wenn ein zahlender Kunde nach seiner Karte fragt („wann kommt meine Karte“, „habe keine Karte / keinen Link bekommen“, „Link verloren“, „I have not your card“). Es prüft vorher selbst den Stand: Ist die Karte schon beantragt, in Produktion, versandt oder sein Konto schon eröffnet, schickt es nichts und sagt dir, was gilt; fehlen Angaben, sagt es dir welche. Liefert es so_schreiben, nimm diesen Satz (in seiner Sprache). Nie „die Bank macht das, nicht wir“, nie „ich habe Herrn X gebeten“.",
  stufe: "frei",
  lagen: ["aktiv", "rate_ueberfaellig", "bezahlt_ohne_startgespraech"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      anlass: { type: "string", description: "In einem Satz, was der Kunde zur Karte geschrieben hat (z. B. „hat keinen Kartenlink bekommen“) — steht im Verlauf." },
    },
    required: ["anlass"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz gibt es keinen Kartenlink." };
    const anlass = String(p.anlass || "").trim().slice(0, 200) || "Kunde fragt nach seiner Karte";
    // E-246: je Mail höchstens EIN Versand — auch wenn das Modell zweimal ruft oder ein Anlauf nach der KI-Pause wiederholt.
    const frueher = await frueherInDieserMail(k, "karte_senden");
    if (frueher != null) {
      return { ok: true, ergebnis: `Zu dieser Mail schon erledigt — nicht noch einmal: ${frueher}`, daten: { gesendet: false, schon_in_dieser_mail: true } };
    }
    // Der handgepflegte Bank-Stand: Ist die Karte schon unterwegs, gibt es keinen neuen Link.
    const { kartenLage } = await import("./fiaon-kartenstatus");
    const bank = await kartenLage(k.personId).catch(() => null);
    const bankStand = bank?.status && KARTE_STAND_SATZ[bank.status] ? bank.status : null;
    if (bankStand) {
      return {
        ok: true,
        ergebnis: `Stand der Karte laut Akte: ${bank!.text}${bank!.am ? ` (seit ${new Date(bank!.am as any).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})` : ""}. ${KARTE_STAND_SATZ[bankStand]}`,
        daten: { gesendet: false, karten_status: bankStand },
      };
    }
    const senden = await karteEinladungLaden();
    if (!senden) {
      return { ok: false, ergebnis: "", fehler: "Der Versand des Kartenlinks ist gerade nicht verfügbar (karteEinladungFuerPerson fehlt) — schreib NICHT, der Link sei raus. Erkläre ihm den Weg positiv und gib dem Team still Bescheid (notiz_an_betreuer: „Kartenlink erneut schicken“)." };
    }
    const erg: KarteEinladungErgebnis = await senden(k.personId, {
      erneut: true, quelle: "postmeister", akteurName: "Mara (Postmeister)", postmeisterId: k.postmeisterId ?? null,
    }).catch((e: any): KarteEinladungErgebnis => ({ ok: false, aktion: "fehler", gesendet: false, grund: String(e?.message || e).slice(0, 200) }));
    const aktion = String(erg?.aktion || (erg?.gesendet ? "gesendet" : erg?.ok ? "schon_unterwegs" : "fehler"));
    const satz = erg?.satz ? String(erg.satz) : null;
    const intern = String(erg?.intern || erg?.grund || erg?.fehler || "").slice(0, 300);
    // Nichts gesendet, aber ein Satz für ihn (Angaben fehlen, Zahlung offen): das ist SEINE Antwort — kein Mensch nötig.
    if (!erg?.ok && aktion === "nicht_bereit" && satz) {
      return { ok: true, ergebnis: satz, daten: { gesendet: false, aktion, so_schreiben: satz, intern } };
    }
    if (!erg?.ok) {
      // Ausschluss (Sperre, Kündigung, Global …) oder Versand gescheitert: ein Fall für das Team — dem Kunden nichts versprechen.
      return {
        ok: false, ergebnis: "",
        fehler: aktion === "gesperrt"
          ? `Für ihn gibt es keinen Kartenlink (${intern || "Ausschluss"}) — schreib NICHT, der Link sei raus. Gib es mit aufgabe_an_betreuer weiter und sag ihm ehrlich, dass sich jemand meldet.`
          : `Der Kartenlink ging nicht raus (${intern || "Versand gescheitert"}) — schreib NICHT, er sei unterwegs. Erkläre den Weg und gib dem Team still Bescheid (notiz_an_betreuer).`,
      };
    }
    const soSchreiben = satz ?? (erg.gesendet ? karteGesendetSatz({ erneut: aktion === "erneut_gesendet" || !!erg.schonAm, betreff: erg.betreff ?? null }) : null);
    // Der Verlauf der Akte bekommt seinen Eintrag von der Funktion selbst — hier nur die Handlung an der Mail-Zeile.
    await protokoll(k, "karte_senden", `Karte (${aktion}): ${intern || (erg.gesendet ? "Link der Partnerbank geschickt" : "kein Versand")} — Anlass: ${anlass}.`, false);
    return {
      ok: true,
      ergebnis: soSchreiben ?? `Stand Konto und Karte: ${intern || aktion}.`,
      daten: { gesendet: !!erg.gesendet, aktion, so_schreiben: soSchreiben, zuerst_am: erg.schonAm ?? null },
    };
  },
};

/** KONTO FREISCHALTEN — nur wenn bezahlt und Startgespräch erledigt. */
export const kontoFreischalten: Werkzeug = {
  name: "konto_freischalten",
  beschreibung: "Schaltet den Kundenbereich frei. Nur möglich, wenn die erste Zahlung eingegangen ist. Nutze das, wenn ein bezahlter Kunde nicht in seinen Bereich kommt, obwohl er dürfte.",
  stufe: "bestaetigen",
  lagen: ["bezahlt_ohne_startgespraech", "aktiv"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { grund: { type: "string", description: "Warum die Freischaltung jetzt richtig ist." } },
    required: ["grund"],
  },
  async ausfuehren(p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung nicht möglich." };
    const [a] = (await sqlPool`SELECT payment_status, account_status FROM fiaon_applications WHERE ref = ${k.ref} LIMIT 1`) as any[];
    if (!a || a.payment_status !== "paid") return { ok: false, ergebnis: "", fehler: "Ohne Zahlungseingang wird nichts freigeschaltet." };
    await sqlPool`
      UPDATE fiaon_applications
         SET account_status = 'active', freigeschaltet_am = COALESCE(freigeschaltet_am, NOW()), updated_at = NOW()
       WHERE ref = ${k.ref}
    `;
    await protokoll(k, "konto_freischalten", `Kundenbereich freigeschaltet — ${String(p.grund || "").slice(0, 200)}`);
    return { ok: true, ergebnis: "Der Kundenbereich ist freigeschaltet.", daten: { login: absoluteUrl("/login") } };
  },
};

/** VERMERK — reine Notiz in der Akte, ohne Aufgabe. */
export const vermerkSchreiben: Werkzeug = {
  name: "vermerk_schreiben",
  beschreibung: "Hält etwas in der Kundenakte fest, ohne jemanden zu behelligen. Nutze das für alles, was ein Kollege beim nächsten Kontakt wissen sollte.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: { text: { type: "string", description: "Was in die Akte soll." } },
    required: ["text"],
  },
  async ausfuehren(p, k) {
    const t = String(p.text || "").trim();
    if (t.length < 5) return { ok: false, ergebnis: "", fehler: "Vermerk zu kurz." };
    await protokoll(k, "vermerk_schreiben", t.slice(0, 800));
    return { ok: true, ergebnis: "In der Akte vermerkt." };
  },
};

/** ESKALATION ANKÜNDIGEN — der Schritt vor dem Inkasso, immer mit Mensch. */
export const eskalationVorbereiten: Werkzeug = {
  name: "eskalation_vorbereiten",
  beschreibung: "Bereitet die Übergabe einer offenen Forderung an das Forderungsmanagement vor: Aufgabe an die Leitung mit allen Zahlen. Nutze das, wenn ein Kunde die Zahlung ausdrücklich verweigert. Die Übergabe selbst entscheidet ein Mensch — kündige dem Kunden nichts an, was noch nicht entschieden ist.",
  stufe: "frei",
  lagen: ["rate_ueberfaellig", "gekuendigt", "bestreitet", "unbezahlt"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { zitat: { type: "string", description: "Der Satz, mit dem der Kunde die Zahlung verweigert." } },
    required: ["zitat"],
  },
  async ausfuehren(p, k) {
    const wer = await zustaendig(k.personId);
    const [z] = k.ref ? (await sqlPool`
      SELECT COALESCE(SUM(betrag_cents), 0)::int AS cents, COUNT(*)::int AS n, MAX(mahnstufe)::int AS stufe
        FROM fiaon_abo_raten WHERE ref = ${k.ref} AND status = 'offen'
    `) as any[] : [null];
    const summe = z ? (Number(z.cents) / 100).toFixed(2) : "0.00";
    const text = `Kunde verweigert die Zahlung: „${String(p.zitat || "").slice(0, 200)}". Offen: ${z?.n ?? 0} Rate(n) über ${summe} €, höchste Mahnstufe ${z?.stufe ?? 0}. Bitte anrufen, bevor die Forderung ins Forderungsmanagement geht.`;
    await protokoll(k, "eskalation_vorbereiten", text);
    // 05.09.2026: Daniel: „hier würde ich gerne anrufen … aber wer ist das?"
    // Der Titel trägt jetzt den Namen, der Link führt in die Mitarbeiter-Akte
    // (vorher /chef/s/akte — für Mitarbeiter unerreichbar), und derselbe Kunde
    // bekommt nicht bei jeder Mail eine weitere Aufgabe (Schlüssel je Referenz).
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const kundenName = await kundenNameFuer(k.personId, k.ref);
    await auftragFuerKunden({
      personId: k.personId, ref: k.ref,
      titel: `${kundenName ? `${kundenName}: ` : ""}Zahlung verweigert — Anruf vor Eskalation`.slice(0, 160),
      text, faelligAm: new Date().toISOString().slice(0, 10), dringend: true,
      schluessel: `postmeister:eskalation:${k.ref ?? k.personId ?? k.postmeisterId ?? "x"}`,
      quelle: "postmeister", autorName: "Mara", agentId: wer.id ?? null, anBetreiber: !!wer.board,
    }).catch(() => {});
    // Vertretung (01.10.2026): Zahlungsverweigerung ist heikel — der Betreiber sieht sie zusätzlich.
    // Gegenprüfung: Die erste Regel erkannte „Kunde verweigert die Zahlung" (Anfang dieses Texts) nicht;
    // heikleUebergabe kennt sie jetzt, und der Titel geht mit in die Prüfung.
    if (wer.vt?.anVertreter && heikleUebergabe(`Zahlung verweigert\n${text}`)) {
      await betreiberKopie({
        personId: k.personId, ref: k.ref, titel: `${kundenName ? `${kundenName}: ` : ""}Zahlung verweigert — Anruf vor Eskalation`,
        text, dringend: true, schluessel: `postmeister:eskalation:${k.ref ?? k.personId ?? k.postmeisterId ?? "x"}`, quelle: "postmeister",
      }, wer.vt);
    }
    return { ok: true, ergebnis: `${wer.kundenName} ruft Sie an, bevor etwas eskaliert.`, daten: { offen_euro: summe, betreuer: wer.kundenName } };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE WAND FÜR FIAON GLOBAL (17.09.2026, E-188)
//
// Ein Firmenkunde von FIAON Global schreibt an dasselbe Postfach — die Mails des
// Bestellwegs bitten ihn sogar darum („Antworten Sie einfach auf diese E-Mail").
// Seine Bestellung ist für die Akte eine Bestellung wie jede andere, seine Lage
// „unbezahlt" oder „aktiv" — und damit bekäme Mara Werkzeuge angeboten, die für
// einen Auftrag über 2.499 € und mehr falsch sind:
//   · kuendigung_vormerken  storniert eine unbezahlte Bestellung SOFORT und spricht
//                           sonst von zwölf Monatsraten — einen Firmenauftrag
//                           storniert nur die Leitung (fiaon-global-storno.ts),
//   · mahnstopp_setzen      gehört zur Mahnkette der Privatkunden; FIAON Global hat
//                           seinen eigenen ruhigen Takt (fiaon-global-zahlungstakt.ts),
//   · eskalation_vorbereiten übergibt an das Forderungsmanagement der Abo-Raten,
//   · konto_freischalten    öffnet den PRIVATKUNDENBEREICH — den es für ihn nicht gibt,
//   · terminlink_bauen      führt in den Kalender des Privatvertriebs.
// Ein Satz im Prompt wäre eine Bitte. Die Wand steht deshalb VOR der Ausführung,
// für jeden Aufrufer (Modell, Vorab-Aufruf, Freigabe in der Werkbank): Sie liest
// die Bestellung des Vorgangs und lehnt mit einem Satz ab, der dem Modell sagt,
// was stattdessen zu tun ist. Erlaubt bleiben Zahlungsseite, Rechnung, Notiz,
// Aufgabe, Vermerk, Werbesperre — und das eigene Werkzeug global_zugang_senden.
// Für jeden Vorgang OHNE Global-Bestellung ändert sich nichts.
//
// E-272 (02.10.2026): Die Wand erkennt FIAON Global jetzt auch an der PERSON
// (istGlobalKunde, fiaon-global-kunde.ts) — nicht nur an der Bestellung des
// Vorgangs. Justin zum Fall Hildbrand: „nehme ihn bitte komplett aus den
// Workflows … Er soll Global bleiben, also keine unnötigen Mails.“ Er hatte
// ein Individualangebot und KEINE Global-Bestellung, sein Vorgang war ein
// alter Privatantrag — die Wand stand für ihn offen. Dazu: Zahlungsseite und
// Rechnung gibt es für einen Global-Kunden nur zu seinem Global-Auftrag (oder
// einer Auskunft), nie zu einer Privatbestellung (privatReferenzBeiGlobal).
// „Gemischte“ (bezahltes Stufenpaket) sind keine Global-Kunden: für sie gilt
// die Wand wie bisher nur an einer Global-Bestellung.
// ═══════════════════════════════════════════════════════════════════════════
// 24.09.2026 (E-240): auskunft_anbieten — die Auskunft zu 74/149 € gehört zur
// Privatkundenlinie; ein Firmenkunde bekommt keine Privat-Auskunft angeboten.
export const NUR_PRIVATKUNDEN_WERKZEUGE = new Set<string>([
  "kuendigung_vormerken", "mahnstopp_setzen", "eskalation_vorbereiten", "konto_freischalten", "terminlink_bauen",
  "auskunft_anbieten",
  // E-275 (02.10.2026): Konto und Karte der Partnerbank sind ein Privatprodukt — nie an einen Kunden von FIAON Global (E-272).
  "karte_senden",
]);

/** Rein: Darf dieses Werkzeug in diesem Vorgang laufen? `null` = ja; sonst der Satz für das Modell. */
export function globalWerkzeugSperre(werkzeug: string, istGlobalVorgang: boolean): string | null {
  if (werkzeug === "global_zugang_senden") {
    return istGlobalVorgang ? null : "Dieses Werkzeug gibt es nur für Firmenaufträge über FIAON Global. Privatkunden melden sich unter fiaon.com/login an.";
  }
  if (!istGlobalVorgang || !NUR_PRIVATKUNDEN_WERKZEUGE.has(werkzeug)) return null;
  // E-272: „Kunde von FIAON Global“ statt „Firmenauftrag“ — die Wand gilt auch ohne Auftrag (nur Angebot).
  return "Das ist ein Kunde von FIAON Global (Firmenauftrag oder Individualangebot) — dieses Werkzeug gehört zur Privatkundenlinie und läuft hier nicht. "
    + "Storno, Beendigung, Erstattung und Zahlungsfragen entscheidet die Leitung mit der zuständigen Person: "
    + "Gib das Anliegen mit aufgabe_an_betreuer weiter (mit Zitat) und sage dem Kunden nur zu, was die Aufgabe deckt. "
    + "Kein Wort über Monatsraten, Kündigungsfristen, Mahnungen oder den Kundenbereich — das alles gibt es bei FIAON Global nicht.";
}

/**
 * Gehört dieser Vorgang zu FIAON Global? Entschieden an der Bestellung — ohne Bestellung an ALLEN Bestellungen der Person.
 * E-272 (02.10.2026): UND an der Person — ist sie ein Global-Kunde (istGlobalKunde: Individualangebot oder
 * lebende Global-Bestellung, kein bezahltes Stufenpaket), gehört jeder ihrer Vorgänge zu FIAON Global, auch ein
 * alter Privatantrag. Die Prüfungen von vorher bleiben (ein Global-Auftrag eines „Gemischten“ bleibt Global).
 */
export async function istGlobalVorgang(k: Pick<WerkzeugKontext, "personId" | "ref">): Promise<boolean> {
  try {
    let personId = k.personId ?? null;
    if (k.ref) {
      const [a] = (await sqlPool`SELECT pack_key, person_id FROM fiaon_applications WHERE ref = ${k.ref} LIMIT 1`) as any[];
      if (istGlobalPaket(a?.pack_key)) return true;
      if (!personId && a?.person_id != null) personId = Number(a.person_id);
    } else if (k.personId) {
      const zeilen = (await sqlPool`
        SELECT pack_key FROM fiaon_applications
         WHERE person_id = ${k.personId} AND merged_into IS NULL AND archived_at IS NULL`) as any[];
      if (zeilen.length > 0 && zeilen.every((z) => istGlobalPaket(z.pack_key))) return true;
    }
    if (personId) return await istGlobalKunde(personId);
  } catch (e) {
    console.error("[POSTMEISTER] Global-Wand konnte die Bestellung nicht lesen:", String(e).slice(0, 160));
  }
  return false;
}

/**
 * E-272 (02.10.2026): Ist der Mensch dieses Vorgangs ein Global-Kunde und gehört die Zahlungs- oder
 * Ratenreferenz zu einer PRIVATBESTELLUNG (Stufenpaket oder dessen Rate)? Dann der Satz für das Modell,
 * sonst null. Sein Global-Auftrag (firmenauftrag) und eine Auskunft (produkt „auskunft“, etwa die Firmen-
 * Auskunft für seinen Kapitalantrag) bleiben frei. Ein bezahltes Stufenpaket gibt es bei einem
 * Global-Kunden nicht (dann wäre er „gemischt“) — eine Privatreferenz ist hier also immer eine offene
 * Privatforderung, und die gehört nicht in eine Antwort an FIAON Global.
 */
export async function privatReferenzBeiGlobal(
  k: Pick<WerkzeugKontext, "personId">, z: { firmenauftrag?: boolean; produkt?: string },
): Promise<string | null> {
  if (!k.personId || z.firmenauftrag || z.produkt === "auskunft") return null;
  if (!(await istGlobalKunde(k.personId).catch(() => false))) return null;
  return "Diese Referenz gehört zu einer Privatbestellung — dieser Mensch ist Kunde von FIAON Global. Keine Zahlungsseite, keine Rechnung "
    + "und kein Betrag aus der Privatkundenlinie. Geht es ihm um diese alte Bestellung, gib das Anliegen mit aufgabe_an_betreuer weiter (mit Zitat).";
}

/**
 * ZUGANG ZU „MEIN AUFTRAG" — der Firmenkunde hat kein Passwort. Ist sein Link
 * abgelaufen oder verloren, bekommt er einen frischen: an die Adresse SEINES
 * Auftrags, nie an eine andere (server/lib/fiaon-global-zugang.ts).
 */
export const globalZugangSendenWerkzeug: Werkzeug = {
  name: "global_zugang_senden",
  beschreibung: "NUR für Firmenaufträge über FIAON Global: schickt dem Kunden einen frischen Link zu seiner Seite „Mein Auftrag“ (Stand, Vertrag, Rechnung, Unterlagen, Fristen). Nutze das, wenn sein Link abgelaufen oder verloren ist oder er fragt, wo er Vertrag, Rechnung oder seine Unterlagen findet. Der Link geht ausschließlich an die E-Mail-Adresse des Auftrags — nenne ihm keine andere Anmeldung, es gibt für ihn kein Passwort.",
  stufe: "frei",
  lagen: "alle",
  parameter: { type: "object", additionalProperties: false, properties: {}, required: [] },
  async ausfuehren(_p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung nicht möglich." };
    // E-246: je Mail höchstens EIN Link — auch wenn das Modell zweimal ruft oder
    // ein Anlauf nach der KI-Pause die Mail noch einmal bearbeitet.
    if ((await frueherInDieserMail(k, "global_zugang_senden")) != null) {
      return { ok: true, ergebnis: "Der Link zu „Mein Auftrag“ ist zu dieser Anfrage schon an die E-Mail-Adresse des Auftrags unterwegs.", daten: { verschickt: 0, schon_verschickt: true } };
    }
    const [g] = (await sqlPool`SELECT email FROM fiaon_global_auftraege WHERE ref = ${k.ref} LIMIT 1`.catch(() => [])) as any[];
    if (!g?.email) return { ok: false, ergebnis: "", fehler: "Zu dieser Bestellung gibt es keinen unterschriebenen Auftrag — gib das Anliegen mit aufgabe_an_betreuer weiter." };
    const { globalZugangSenden } = await import("./fiaon-global-zugang");
    const n = await globalZugangSenden(String(g.email), { ref: k.ref, ohneDrossel: true, ausgeloestVon: "Postmeister (Anfrage des Kunden per E-Mail)" });
    if (n < 1) return { ok: false, ergebnis: "", fehler: "Der Link ließ sich nicht verschicken (Auftrag storniert oder Versand abgelehnt) — gib das Anliegen mit aufgabe_an_betreuer weiter." };
    await protokoll(k, "global_zugang_senden", "Frischer Link zu „Mein Auftrag“ an die Adresse des Auftrags geschickt.", false);
    return { ok: true, ergebnis: "Der Link zu „Mein Auftrag“ ist an die E-Mail-Adresse des Auftrags unterwegs.", daten: { verschickt: n } };
  },
};

/** Stellt die Wand vor ein Werkzeug — die Beschreibung und die Parameter bleiben, wie sie sind. */
function mitGlobalWand(w: Werkzeug): Werkzeug {
  if (!NUR_PRIVATKUNDEN_WERKZEUGE.has(w.name) && w.name !== "global_zugang_senden") return w;
  return {
    ...w,
    async ausfuehren(p, k) {
      const sperre = globalWerkzeugSperre(w.name, await istGlobalVorgang(k));
      if (sperre) return { ok: false, ergebnis: "", fehler: sperre };
      return w.ausfuehren(p, k);
    },
  };
}

/** Alle Werkzeuge, in der Reihenfolge, in der das Modell sie sehen soll. */
// E-275 (02.10.2026): karte_senden direkt nach der Zahlungsseite — Karte und Zahlung sind Maras eigene Arbeit.
export const POSTMEISTER_WERKZEUGE: Werkzeug[] = [
  zahlungslinkBauen, karteSenden, rechnungAnhaengen, auskunftAnbieten, terminlinkBauen, notizAnBetreuer, aufgabeAnBetreuer, vermerkSchreiben,
  kuendigungVormerken, werbesperreSetzen, mahnstoppSetzen, eskalationVorbereiten, kontoFreischalten,
  globalZugangSendenWerkzeug,
].map(mitGlobalWand);

/**
 * Welche Werkzeuge in dieser Lage angeboten werden. 25.09.2026 (E-241):
 * `auskunftAntwort` = die Mail antwortet auf das Angebot der Auskunft oder der
 * Kunde fragt selbst danach — dann gibt es auskunft_anbieten auch bei einem
 * offenen Antrag oder einem Lead (AUSKUNFT_ANTWORT_LAGEN), sonst dort nie.
 */
export function werkzeugeFuerLage(lage: Kundenlage, opts: { auskunftAntwort?: boolean; werbesperre?: boolean } = {}): Werkzeug[] {
  return POSTMEISTER_WERKZEUGE.filter((w) => w.lagen === "alle" || w.lagen.includes(lage)
    || (w.name === "auskunft_anbieten" && !!opts.auskunftAntwort && AUSKUNFT_ANTWORT_LAGEN.includes(lage)))
    // E-275 (02.10.2026): Werbesperre beim zahlenden Kunden — Service ja, Verkauf nein: kein Angebot der Auskunft.
    .filter((w) => !(opts.werbesperre && w.name === "auskunft_anbieten"));
}

/** Das Format, das OpenAI erwartet. */
export function werkzeugeAlsTools(lage: Kundenlage, opts: { auskunftAntwort?: boolean; werbesperre?: boolean } = {}): unknown[] {
  return werkzeugeFuerLage(lage, opts).map((w) => ({
    type: "function",
    function: { name: w.name, description: w.beschreibung, parameters: w.parameter },
  }));
}

export function werkzeugVonName(name: string): Werkzeug | undefined {
  return POSTMEISTER_WERKZEUGE.find((w) => w.name === name);
}

/**
 * E-264 (29.09.2026): Ist die Bestellung zu dieser Zahlungsreferenz ein abgeschickter Antrag
 * (antragAbgeschickt, EINE Regel)? Unbekannte Referenz: false.
 */
export async function bestellungAbgeschickt(zahlungsReferenz: string): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT status, current_step, submitted_at FROM fiaon_applications
     WHERE payment_reference = ${zahlungsReferenz} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
  return !!a && antragAbgeschickt(a);
}

/**
 * Eine abgelaufene Bestellung neu freischalten (Nachbesserung E-248) — für Mara auf
 * Mail und WhatsApp. Derselbe Weg wie der Knopf „Reaktivieren" im Agentenportal
 * (reactivateOrderByRef: neue 7-Tage-Frist, Zahlungsdaten erneut per Mail).
 * true = die Bestellung ist jetzt offen (pending_payment).
 */
export async function abgelaufeneBestellungFreischalten(zahlungsReferenz: string): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT ref, payment_status, status, current_step, submitted_at FROM fiaon_applications
     WHERE payment_reference = ${zahlungsReferenz} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
  if (!a) return false;
  // E-264 (29.09.2026): Eine nie abgeschickte Bestellung ist kein Vertrag — nie reaktivieren, nie „offen".
  if (!antragAbgeschickt(a)) return false;
  if (a.payment_status === "pending_payment") return true;
  if (a.payment_status !== "expired") return false;
  const { reactivateOrderByRef } = await import("../routes/fiaon-antrag");
  const r = await reactivateOrderByRef(String(a.ref));
  if (r) console.log(`[MARA] Abgelaufene Bestellung ${zahlungsReferenz} neu freigeschaltet.`);
  return !!r;
}
