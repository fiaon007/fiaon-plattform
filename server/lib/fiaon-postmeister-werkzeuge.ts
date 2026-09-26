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
  auskunftLeistung, auskunftWort, auskunfteienText, euroText, AUSKUNFT_NUTZEN_SATZ, AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_PREISE_CENTS,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { auskunftArtFuer } from "./fiaon-postmeister-dossier";
import { ANGEBOT_VERMERK, antwortAufAngebot, kundeFragtNachAuskunft } from "./fiaon-auskunft";
import { auskunftAngebotBaustein, ANGEBOT_FASSUNGEN, ANGEBOT_SEGMENTE, ANGEBOT_BETREFF_VARIANTEN } from "../mail/vorlagen/auskunft-verkauf";

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
async function zustaendig(personId: number | null): Promise<{ id: number | null; name: string; kundenName: string }> {
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
  beschreibung: "Schreibt dem zuständigen Betreuer eine kurze Nachricht in die Akte und legt ihm eine Aufgabe an. NUR wenn ein Mensch etwas wissen MUSS, das du nicht selbst erledigst: ausdrücklicher Rückrufwunsch, eingereichte Unterlagen (Ausweis, Kontoauszug, Bescheid), Datenänderung ohne Werkzeug, Geld-zurück-Frage. NICHT bei Ärger, Zahlungsverweigerung, Anwaltsdrohung, Kündigung oder angeblicher früherer Kündigung — das beantwortest du selbst (Vertrag, offene Rate, Zahlungsseite, Härte-Stufe). Schreib so, wie du es einem Kollegen sagen würdest.",
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
      quelle: "postmeister", autorName: "Mara", agentId: wer.id ?? null,
      link: k.personId ? `/agent/kunden?person=${k.personId}` : k.ref ? `/agent/kunden?ref=${k.ref}` : null,
    }).catch((e) => console.error("[POSTMEISTER] Notiz an Betreuer:", String(e).slice(0, 160)));
    if (p.anrufen && k.personId) {
      try {
        const { rueckrufAufnehmen } = await import("./fiaon-rueckruf");
        await rueckrufAufnehmen({
          personId: k.personId, quelle: "mail_inbound",
          quelleId: `postmeister-notiz-${k.postmeisterId ?? Date.now()}`,
          anliegen: text.slice(0, 300), kontakt: null,
        } as any);
      } catch { /* Rückruf ist ein Zusatz, kein Muss */ }
    }
    return { ok: true, ergebnis: `${wer.kundenName} ist informiert${p.anrufen ? " und ruft Sie an" : ""}.`, daten: { betreuer: wer.kundenName, betreuer_intern: wer.name, dringend: !!p.dringend } };
  },
};

/**
 * AUFGABE AN DEN BETREUER — 04.09.2026 (E-115). Eine Notiz ist ein Hinweis;
 * das hier ist ein Auftrag mit Titel, Frist und Mail an den Menschen. Justin:
 * „Mitarbeiter ein TODO bekommt … also dass Handlungen PASSIEREN."
 */
export const aufgabeAnBetreuer: Werkzeug = {
  name: "aufgabe_an_betreuer",
  beschreibung: "Legt dem zuständigen Betreuer eine echte Aufgabe mit Titel, Auftrag und Frist an. Er sieht sie in seinem Portal unter Aufträge und bekommt eine Mail. Nutze das NUR, wenn ein Mensch etwas TUN muss, das du nicht kannst: Kunde will ausdrücklich einen Anruf, braucht eine Bescheinigung, will Daten ändern, hat Unterlagen (Ausweis, Kontoauszug, Bescheid) geschickt, oder es geht um Geld zurück (kollege Leitung) bzw. einen Zahlungsbeleg (kollege Zahlung). NIE, um eine Zahlung, eine Kündigung, einen Widerruf oder eine Beschwerde „prüfen zu lassen“ — das erledigst du selbst. Für einen bloßen Hinweis nimm notiz_an_betreuer.",
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
    const gewuenscht = zahlungGewollt
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
      const [o] = (await sqlPool`SELECT payment_status FROM fiaon_applications WHERE ref = ${k.ref} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
      if (o?.payment_status === "pending_payment") {
        await sqlPool`UPDATE fiaon_applications SET payment_status = 'claimed_paid', claimed_paid_at = COALESCE(claimed_paid_at, NOW()), updated_at = NOW() WHERE ref = ${k.ref}`.catch(() => {});
        zahlungGemeldet = " Die Bestellung steht jetzt auf „Zahlung gemeldet\".";
      }
    }
    const erg = await auftragFuerKunden({
      personId: k.personId, ref: k.ref, titel: titelMitName, text: mailKopf + text, faelligAm, dringend: !!p.dringend,
      // Eine Aufgabe je Kunde und Tag — drei gleiche Mails (Frau Weber, 25.08.)
      // ergaben drei Aufgaben. Der Text wird an die bestehende angehängt.
      // 07.09.2026 (Daniel, Feedback 5): EIN Auftrag je Kunde, nicht je Mail und Tag. Fünf Mails
      // desselben Menschen hängen sich als Beiträge an denselben Auftrag; erledigt → die nächste
      // Mail öffnet ihn wieder (auftragFuerKunden, ON CONFLICT schluessel).
      schluessel: `postmeister:${k.personId ?? k.ref ?? k.postmeisterId ?? "x"}:aufgabe`,
      quelle: "postmeister", autorName: "Mara", agentId: zahlungGewollt ? null : (gewuenscht?.id ?? null),
      anBetreiber: zahlungGewollt,
    });
    const wer = erg.agentName ?? "die Leitung";
    const werKunde = erg.kundenName ?? erg.agentName ?? "unsere Leitung";
    await protokoll(k, "aufgabe_an_betreuer", `Aufgabe für ${wer}: „${titelMitName}" (fällig ${faelligAm}).${zahlungGemeldet} ${text.slice(0, 300)}`);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    // ── RÜCKRUF ALS TERMIN IM KALENDER (Florentine Punkt 3) ───────────────
    // „Erkannte Rückrufwünsche automatisch als Termin in den Kalender des
    // zuständigen Mitarbeiters eintragen, verknüpft mit Kunde und Mail."
    let terminSatz = "";
    const rueckrufAm = String(p.rueckruf_am || "").trim();
    if (rueckrufAm && k.personId && erg.agentId) {
      try {
        const { terminBuchen } = await import("./fiaon-termine");
        const b = await terminBuchen({ personId: k.personId, agentId: Number(erg.agentId), beginn: rueckrufAm, quelle: "agent_manuell", herkunft: "mara_mail" });
        await sqlPool`UPDATE fiaon_termine SET notiz = ${`Rückrufwunsch aus E-Mail [Mail #${k.postmeisterId ?? "?"}]: ${text.slice(0, 300)}`}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
        const { buchungMelden } = await import("./fiaon-termin-meldung");
        await buchungMelden(b.id, b.beginn, "agent_manuell").catch(() => {});
        terminSatz = ` Der Rückruf steht als Termin am ${b.datumText} um ${b.uhrzeit} Uhr im Kalender.`;
        await protokoll(k, "aufgabe_an_betreuer", `Rückruf-Termin ${b.datumText} ${b.uhrzeit} Uhr für ${wer} eingetragen.`);
      } catch (e: any) {
        terminSatz = ` (Rückruf-Termin ${rueckrufAm} konnte nicht eingetragen werden: ${String(e?.message || e).slice(0, 100)} — die Aufgabe steht trotzdem.)`;
      }
    }
    return { ok: true, ergebnis: `${werKunde} hat die Aufgabe „${titel}" bekommen und meldet sich ${wann}.${terminSatz}`, daten: { betreuer: werKunde, betreuer_intern: erg.agentName, aufgabe: titel, faellig: faelligAm, aufgabe_id: erg.id, rueckruf_termin: terminSatz ? rueckrufAm : null } };
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
    const { zahlungsauftragFinden } = await import("./fiaon-zahlungsauftrag");
    const z = await zahlungsauftragFinden(ref);
    if (!z) return { ok: false, ergebnis: "", fehler: "Zu dieser Referenz gibt es keine Rechnung." };
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
  if (await istGlobalVorgang(k)) return { ok: false, grund: "FIAON Global" };

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
      anlass: { type: "string", description: "In einem Satz, was der Kunde gesagt hat (z. B. „hat keine SCHUFA-Auskunft“, „fragt nach seinem Limit“) — steht in der Aufgabe für den Betreuer." },
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
        // E-241: „Limit“ nur für Kunden mit laufendem Paket — Antrag und Lead lesen den Satz ohne (VERBOTENE_WORTE).
        leistung: auskunftLeistung(art, land), nutzen: stand.preis.mitAbo ? AUSKUNFT_NUTZEN_SATZ : AUSKUNFT_NUTZEN_SATZ_KARTE,
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
        // E-241: „Limit“ nur für Kunden mit laufendem Paket — Antrag und Lead lesen den Satz ohne (VERBOTENE_WORTE).
        leistung: auskunftLeistung(art, land), nutzen: stand.preis.mitAbo ? AUSKUNFT_NUTZEN_SATZ : AUSKUNFT_NUTZEN_SATZ_KARTE,
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
  beschreibung: "Nimmt eine Kündigung entgegen. Nur bei einer eindeutigen Willenserklärung des Kunden ('ich kündige', 'hiermit kündige ich'), niemals bei Fragen oder Überlegungen. Der Vertrag läuft zwölf Monate; wir entlassen kulant vorzeitig, aber die bereits gestellte Rate bleibt zu zahlen — der Vertrag endet erst mit ihrer Zahlung (Storno erst nach Zahlungseingang). Auch wenn der Kunde schreibt, er habe schon früher gekündigt: aufrufen — das System merkt es jetzt vor. Nach dem Aufruf nennst du in der Antwort die offene Rate mit Betrag und Zahlungsseite.",
  stufe: "frei",
  // „gesperrt" (05.09.2026): Ein gesperrter Kunde mit unbezahlter Bestellung
  // will meist nur raus — das Storno muss Mara selbst können.
  lagen: ["unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv", "rate_ueberfaellig", "gekuendigt", "bestreitet", "gesperrt"],
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
    const { istWillenserklaerung, kuendigungSetzen } = await import("./fiaon-kuendigung");
    const zitat = String(p.zitat || "");
    if (!istWillenserklaerung(zitat, { unbezahlt: k.kundenlage === "unbezahlt" || k.kundenlage === "interessent" || k.kundenlage === "gesperrt" })) {
      return { ok: false, ergebnis: "", fehler: "Das ist keine eindeutige Kündigung — frag nach oder informiere nur." };
    }
    const erg = await kuendigungSetzen(k.ref, { quelle: "mail", grund: String(p.grund || "").slice(0, 300) || null, postmeisterId: k.postmeisterId ?? null });
    if (!erg.ok) return { ok: false, ergebnis: "", fehler: erg.grund };
    const t = erg.weg === "storno_unbezahlt"
      ? "Die Bestellung wurde storniert; es bleibt nichts offen."
      : erg.weg === "sofort_beendet"
        ? "Alle Raten sind bezahlt — der Vertrag ist beendet."
        : `Die Kündigung ist vermerkt. Offen bleibt Rate ${erg.letzteRateNr} über ${((erg.letzteRateBetragCents ?? 0) / 100).toFixed(2)} €; mit dieser Zahlung endet der Vertrag.`;
    await protokoll(k, "kuendigung_vormerken", `Kündigung per E-Mail entgegengenommen. ${t}`);
    return { ok: true, ergebnis: t, daten: { weg: erg.weg, letzte_rate: erg.letzteRateNr, betrag: erg.letzteRateBetragCents ? (erg.letzteRateBetragCents / 100).toFixed(2) : null, faellig: erg.letzteRateFaellig } };
  },
};

/** WERBESPERRE — nur auf ausdrücklichen Wunsch, mit Zitat. */
export const werbesperreSetzen: Werkzeug = {
  name: "werbesperre_setzen",
  beschreibung: "Nimmt den Kunden aus allen Werbe- und Erinnerungsmails. Nur wenn er ausdrücklich darum bittet ('keine Mails mehr', 'Stopp', 'aus dem Verteiler nehmen'). Vertragspost wie Rechnungen bleibt davon unberührt.",
  stufe: "frei",
  lagen: ["interessent", "unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv", "rate_ueberfaellig", "gekuendigt", "bestreitet", "unklar"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { zitat: { type: "string", description: "Der wörtliche Satz, mit dem der Kunde darum bittet." } },
    required: ["zitat"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz nicht möglich." };
    if (String(p.zitat || "").trim().length < 5) return { ok: false, ergebnis: "", fehler: "Zitat fehlt." };
    await sqlPool`
      UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()), updated_at = NOW()
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
    if (z.status === "paid") return { ok: false, ergebnis: "", fehler: "Diese Rechnung ist bereits bezahlt — sag das dem Kunden, statt zu einer Zahlung aufzufordern." };

    // (Bis 19.09.2026 stand hier der Einzugsschutz — GoCardless ist beendet, E-194.
    //  Jede offene Rate wird überwiesen; die Zahlungsseite gilt für alle.)

    const url = absoluteUrl(`/zahlung/${z.paymentReference}`);
    return {
      ok: true,
      ergebnis: `Zahlungsseite für ${z.paymentReference} über ${z.amountDue} €.`,
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
    const { terminLink } = await import("./fiaon-termine");
    const url = terminLink(k.personId, "postmeister");
    return { ok: true, ergebnis: "Terminlink erzeugt.", daten: { terminlink: url } };
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
      quelle: "postmeister", autorName: "Mara", agentId: wer.id ?? null,
    }).catch(() => {});
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
// ═══════════════════════════════════════════════════════════════════════════
// 24.09.2026 (E-240): auskunft_anbieten — die Auskunft zu 74/149 € gehört zur
// Privatkundenlinie; ein Firmenkunde bekommt keine Privat-Auskunft angeboten.
export const NUR_PRIVATKUNDEN_WERKZEUGE = new Set<string>([
  "kuendigung_vormerken", "mahnstopp_setzen", "eskalation_vorbereiten", "konto_freischalten", "terminlink_bauen",
  "auskunft_anbieten",
]);

/** Rein: Darf dieses Werkzeug in diesem Vorgang laufen? `null` = ja; sonst der Satz für das Modell. */
export function globalWerkzeugSperre(werkzeug: string, istGlobalVorgang: boolean): string | null {
  if (werkzeug === "global_zugang_senden") {
    return istGlobalVorgang ? null : "Dieses Werkzeug gibt es nur für Firmenaufträge über FIAON Global. Privatkunden melden sich unter fiaon.com/login an.";
  }
  if (!istGlobalVorgang || !NUR_PRIVATKUNDEN_WERKZEUGE.has(werkzeug)) return null;
  return "Das ist ein Firmenauftrag über FIAON Global — dieses Werkzeug gehört zur Privatkundenlinie und läuft hier nicht. "
    + "Storno, Beendigung, Erstattung und Zahlungsfragen entscheidet die Leitung mit der zuständigen Person: "
    + "Gib das Anliegen mit aufgabe_an_betreuer weiter (mit Zitat) und sage dem Kunden nur zu, was die Aufgabe deckt. "
    + "Kein Wort über Monatsraten, Kündigungsfristen, Mahnungen oder den Kundenbereich — das alles gibt es bei FIAON Global nicht.";
}

/** Gehört dieser Vorgang zu FIAON Global? Entschieden an der Bestellung — ohne Bestellung an ALLEN Bestellungen der Person. */
export async function istGlobalVorgang(k: Pick<WerkzeugKontext, "personId" | "ref">): Promise<boolean> {
  try {
    if (k.ref) {
      const [a] = (await sqlPool`SELECT pack_key FROM fiaon_applications WHERE ref = ${k.ref} LIMIT 1`) as any[];
      return istGlobalPaket(a?.pack_key);
    }
    if (k.personId) {
      const zeilen = (await sqlPool`
        SELECT pack_key FROM fiaon_applications
         WHERE person_id = ${k.personId} AND merged_into IS NULL AND archived_at IS NULL`) as any[];
      return zeilen.length > 0 && zeilen.every((z) => istGlobalPaket(z.pack_key));
    }
  } catch (e) {
    console.error("[POSTMEISTER] Global-Wand konnte die Bestellung nicht lesen:", String(e).slice(0, 160));
  }
  return false;
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
export const POSTMEISTER_WERKZEUGE: Werkzeug[] = [
  zahlungslinkBauen, rechnungAnhaengen, auskunftAnbieten, terminlinkBauen, notizAnBetreuer, aufgabeAnBetreuer, vermerkSchreiben,
  kuendigungVormerken, werbesperreSetzen, mahnstoppSetzen, eskalationVorbereiten, kontoFreischalten,
  globalZugangSendenWerkzeug,
].map(mitGlobalWand);

/**
 * Welche Werkzeuge in dieser Lage angeboten werden. 25.09.2026 (E-241):
 * `auskunftAntwort` = die Mail antwortet auf das Angebot der Auskunft oder der
 * Kunde fragt selbst danach — dann gibt es auskunft_anbieten auch bei einem
 * offenen Antrag oder einem Lead (AUSKUNFT_ANTWORT_LAGEN), sonst dort nie.
 */
export function werkzeugeFuerLage(lage: Kundenlage, opts: { auskunftAntwort?: boolean } = {}): Werkzeug[] {
  return POSTMEISTER_WERKZEUGE.filter((w) => w.lagen === "alle" || w.lagen.includes(lage)
    || (w.name === "auskunft_anbieten" && !!opts.auskunftAntwort && AUSKUNFT_ANTWORT_LAGEN.includes(lage)));
}

/** Das Format, das OpenAI erwartet. */
export function werkzeugeAlsTools(lage: Kundenlage, opts: { auskunftAntwort?: boolean } = {}): unknown[] {
  return werkzeugeFuerLage(lage, opts).map((w) => ({
    type: "function",
    function: { name: w.name, description: w.beschreibung, parameters: w.parameter },
  }));
}

export function werkzeugVonName(name: string): Werkzeug | undefined {
  return POSTMEISTER_WERKZEUGE.find((w) => w.name === name);
}
