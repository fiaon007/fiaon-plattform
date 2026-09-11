// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF — eine Mail von Anfang bis Ende (02.09.2026, E-094)
//
// Was hier anders ist als in der ersten Fassung:
//   · Der GANZE Gesprächsverlauf geht ins Modell, nicht die Einzelmail. Wer
//     nachlegt („hier der Beleg", „ich habe doch gekündigt"), wird nicht mehr
//     still abgelegt.
//   · JEDE Mail wird nachgetragen: Klartext und Zusammenfassung in der Zeile,
//     ein Vermerk in der Kundenakte, die eigene Antwort in der Mailhistorie.
//   · NICHT-KUNDENPOST (Bestellbestätigungen, Lieferanten, Automaten) wandert
//     in einen eigenen Ordner und wird nie beantwortet — Justins ausdrückliche
//     Vorgabe.
//   · JEDE Antwort wird zuerst ENTWURF. Gesendet wird erst, wenn ein Mensch
//     in der Zentrale freigibt oder der Automat ausdrücklich erlaubt ist.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import {
  nachrichtLesen, nachrichtLabeln, labelSicherstellen, entwurfAnlegen, antwortSenden,
  type GmailNachricht,
} from "./fiaon-gmail";
import { einordnen, antwortErzeugen } from "./fiaon-postmeister-agent";
import { personSuchen, akteLesen } from "./fiaon-postmeister-dossier";
import { anredeBestimmen, antwortBauen } from "./fiaon-postmeister-antworttext";
import { postmeisterSchema } from "./fiaon-postmeister-schema";
import { wirdBedient } from "./fiaon-postmeister-postfaecher";
import { AUTOMATEN_DOMAENEN, type Aktion } from "@shared/fiaon-postmeister-typen";

/**
 * Wiedervorlage nach dem n-ten Fehlversuch (11.09.2026, E-184): 15 Minuten,
 * 2 Stunden, 24 Stunden — danach ist Schluss und ein Mensch bekommt die
 * Aufgabe. Dieselbe Tabelle für KI-Fehler (versuche) und Versandfehler
 * (versand_versuche); Erstversuch + drei Wiederholungen = vier Versuche.
 */
const WIEDERVORLAGE_MS: Record<number, number> = { 1: 15 * 60_000, 2: 2 * 3_600_000, 3: 24 * 3_600_000 };

/** „HH:MM" in Berliner Zeit — nur formatToParts, nie Number(format()) (Zeit-Falle Berlin-Stunde). */
function uhrzeitBerlin(d: Date): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const w = (n: string) => t.find((p) => p.type === n)?.value ?? "";
  return `${w("hour")}:${w("minute")}`;
}

/** JSONB kommt als Objekt, Altzeilen als Text — beides lesen, nie werfen. */
function jsonLesen(w: unknown): any {
  if (w == null) return null;
  if (typeof w === "object") return w;
  try { return JSON.parse(String(w)); } catch { return null; }
}

/**
 * Die Aufgabe an einen Menschen, wenn Mara nach vier Versuchen aufgibt (E-184).
 * Idempotent über den Schlüssel: entsteht EINMAL je Mail und Art, nicht in
 * jedem Takt. Ohne Person und Referenz bleibt sie beim Betreiber.
 */
async function aufgabeNachAufgabe(ein: {
  id: number; postfach: string; betreff: string; grund: string;
  personId: number | null; ref: string | null; art: "versand" | "ki-fehler";
}): Promise<void> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const betreff = String(ein.betreff || "(ohne Betreff)").slice(0, 120);
    const text = ein.art === "versand"
      ? `Postfach ${ein.postfach}, Betreff „${betreff}“, Fehler: ${ein.grund}. Die Antwort liegt in der Postmeister-Zentrale (Zu prüfen) und kann von Hand gesendet werden — oder den Kunden anrufen.`
      : `Postfach ${ein.postfach}, Betreff „${betreff}“, Fehler: ${ein.grund}. Mara konnte viermal keine Antwort erzeugen. Die Mail liegt in der Postmeister-Zentrale (Zu prüfen) — bitte von Hand antworten oder den Kunden anrufen.`;
    await auftragFuerKunden({
      personId: ein.personId, ref: ein.ref,
      titel: ein.art === "versand" ? "Mail-Antwort konnte nicht gesendet werden" : "Mail-Antwort konnte nicht erzeugt werden",
      text, dringend: true, schluessel: `postmeister:${ein.id}:${ein.art}`, quelle: "postmeister", autorName: "Mara",
      link: "/chef/s/postmeister", anBetreiber: !ein.personId && !ein.ref,
    });
  } catch (e) {
    console.error("[POSTMEISTER] Aufgabe an Menschen:", String(e).slice(0, 160));
  }
}

/** Vermerk in der Kundenakte — nur mit Referenz, und nie eine Mail daran scheitern lassen. */
async function akteVermerk(ref: string | null, personId: number | null, note: string): Promise<void> {
  if (!ref) return;
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${personId}, NULL, 'Postmeister', 'system', ${note})
  `.catch(() => {});
}

/**
 * Eine Nachricht in einen Ordner legen — und daran NIE eine Mail scheitern lassen.
 *
 * 02.09.2026: Die vier Aufrufstellen sahen so aus:
 *   await nachrichtLabeln(pf, id, [await labelSicherstellen(pf, "…")]).catch(() => {})
 * Das `.catch()` hängt an `nachrichtLabeln` — aber `labelSicherstellen` wird
 * BEIM AUSWERTEN DES ARGUMENTS aufgerufen, also bevor es die Promise-Kette
 * überhaupt gibt. Wirft es (Gmail antwortete mit HTTP 409 „Label name exists or
 * conflicts"), fängt das `.catch()` nichts, und die ganze Mail landete auf
 * 'fehler' — obwohl nur ein Ordner nicht angelegt werden konnte.
 *
 * Der Ordner ist Ablage. Die Antwort an den Kunden ist die Arbeit.
 */
async function ablegen(postfach: string, gmailId: string, ordner: string, weg: string[] = []): Promise<void> {
  try {
    const id = await labelSicherstellen(postfach, ordner);
    await nachrichtLabeln(postfach, gmailId, [id], weg);
  } catch (e: any) {
    console.warn(`[POSTMEISTER] Ordner „${ordner}" nicht gesetzt (${String(e?.message || e).slice(0, 120)}) — die Mail wird trotzdem bearbeitet.`);
  }
}

/** Gmail-Zitatblöcke abschneiden — sonst „liest" das Modell die eigene Rundmail. */
export function ohneZitat(text: string): string {
  const t = String(text || "");
  const marken = [
    /^Am .{0,60} schrieb .{0,80}:$/m,
    /^On .{0,60} wrote:$/m,
    /^-{2,}\s*(Urspr[üu]ngliche|Original|Weitergeleitete) Nachricht\s*-{2,}$/im,
    /^Von:\s.{0,80}$/m,
    /^From:\s.{0,80}$/m,
    /^_{10,}$/m,
  ];
  let ende = t.length;
  for (const m of marken) {
    const treffer = t.match(m);
    if (treffer?.index != null && treffer.index < ende) ende = treffer.index;
  }
  const zeilen = t.slice(0, ende).split("\n").filter((z) => !z.trimStart().startsWith(">"));
  return zeilen.join("\n").trim();
}

/** Post, die nie eine Antwort bekommt. Host-genau, nie als Teilstring. */
export function istFremdpost(mail: GmailNachricht): { fremd: boolean; grund: string } {
  const adresse = String(mail.vonAdresse || "").toLowerCase();
  const host = adresse.split("@")[1] ?? "";
  if (adresse.endsWith("@fiaon.com")) return { fremd: true, grund: "eigene Post" };
  if (mail.autoHinweis) return { fremd: true, grund: "automatische Nachricht (kein Absender, der antwortet)" };
  for (const d of AUTOMATEN_DOMAENEN) {
    if (host === d || host.endsWith(`.${d}`)) return { fremd: true, grund: `Dienstleister (${d})` };
  }
  const zusatz = String(process.env.POSTMEISTER_AUTOMATEN || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const d of zusatz) if (host === d || host.endsWith(`.${d}`)) return { fremd: true, grund: `Dienstleister (${d})` };
  // Typische Absender von Bestellbestätigungen und Systemmeldungen
  if (/^(no-?reply|noreply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce|notifications?|alerts?|newsletter|info@mailer)/.test(adresse.split("@")[0] ?? "")) {
    return { fremd: true, grund: "Absender antwortet nicht" };
  }
  return { fremd: false, grund: "" };
}

/** Der Gesprächsverlauf einer Unterhaltung, wie ihn das Modell braucht. */
async function verlaufLesen(postfach: string, threadId: string, aktuelleId: string): Promise<{ von: string; am: string; text: string }[]> {
  const zeilen = (await sqlPool`
    SELECT von, empfangen_am, text, antwort, gesendet_am, aktion
      FROM fiaon_postmeister
     WHERE thread_id = ${threadId} AND gmail_id <> ${aktuelleId}
     ORDER BY empfangen_am ASC LIMIT 40
  `) as any[];
  const verlauf: { von: string; am: string; text: string }[] = [];
  for (const z of zeilen) {
    if (z.text) verlauf.push({ von: "Kunde", am: new Date(z.empfangen_am).toLocaleDateString("de-DE"), text: String(z.text).slice(0, 3000) });
    if (z.antwort && (z.gesendet_am || z.aktion === "auto_beantwortet")) {
      verlauf.push({ von: "FIAON", am: new Date(z.gesendet_am ?? z.empfangen_am).toLocaleDateString("de-DE"), text: String(z.antwort).slice(0, 3000) });
    }
  }
  return verlauf;
}

export interface LaufErgebnis { aktion: Aktion; grund: string; id: number | null }

/**
 * Eine Mail verarbeiten. `nurOrdnen` schreibt keine Antwort — für den ersten
 * Durchgang über den Altbestand.
 */
export async function mailBearbeiten(ein: {
  postfach: string; gmailId: string; gruss: string;
  modus: "auto" | "hybrid" | "entwurf" | "aus";
  nurOrdnen?: boolean;
}): Promise<LaufErgebnis> {
  await postmeisterSchema();
  const { postfach, gmailId } = ein;

  // ── DIE WAND (09.09.2026, E-171) ────────────────────────────────────────
  // Mara fasst NUR die Postfächer an, die in fiaon-postmeister-postfaecher.ts
  // stehen. Vorher reichte ein Aufruf mit einer beliebigen Adresse — der
  // Aufhol-Lauf trug seine Postfachliste als festen Text und der
  // Antwort-Lauf zog sie aus alten Zeilen der Datenbank. So schrieb sie in
  // Justins persönlichem Postfach. Diese Prüfung steht VOR dem ersten
  // Gmail-Aufruf: Ein nicht bedientes Postfach wird nicht einmal gelesen.
  if (!wirdBedient(postfach)) {
    console.warn(`[POSTMEISTER] Postfach „${postfach}" wird nicht bedient — übersprungen.`);
    return { aktion: "geordnet", grund: `Postfach ${postfach} wird nicht bedient`, id: null };
  }

  // Anspruch — läuft der Takt doppelt, arbeitet nur einer.
  // 11.09.2026 (E-184): Eine 'fehler'-Zeile wird erst wieder beansprucht, wenn
  // ihre Wiedervorlage (naechster_versuch_am) fällig ist — vorher kam sie in
  // JEDEM 5-Minuten-Takt erneut dran, vier KI-Läufe in 20 Minuten. Ein
  // 'in_arbeit' älter als 15 Minuten ist ein abgebrochener Lauf (Neustart).
  let anspruch = (await sqlPool`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, in_arbeit_seit)
    VALUES (${postfach}, ${gmailId}, '', 'in_arbeit', NOW())
    ON CONFLICT (gmail_id) DO NOTHING RETURNING id, versuche, gesendet_am
  `) as any[];
  if (!anspruch.length) {
    anspruch = (await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'in_arbeit', in_arbeit_seit = NOW(), versuche = versuche + 1, updated_at = NOW()
       WHERE gmail_id = ${gmailId}
         AND (aktion = 'vorgeordnet'
              OR (aktion = 'fehler' AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW()))
              OR (aktion = 'in_arbeit' AND COALESCE(in_arbeit_seit, updated_at) < NOW() - INTERVAL '15 minutes'))
         AND versuche < 3
       RETURNING id, versuche, gesendet_am
    `) as any[];
    if (!anspruch.length) return { aktion: "geordnet", grund: "schon bearbeitet", id: null };
  }
  const id = Number(anspruch[0].id);
  /** Bisherige Anläufe (0 beim ersten) — der laufende ist Nummer versuche + 1. */
  const versuche = Number(anspruch[0].versuche ?? 0);

  const fertig = async (felder: Record<string, unknown>, grund: string): Promise<LaufErgebnis> => {
    await sqlPool`
      UPDATE fiaon_postmeister SET ${sqlPool(felder as any)}, in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
    `.catch((e) => console.error("[POSTMEISTER] speichern:", String(e).slice(0, 160)));
    return { aktion: String(felder.aktion) as Aktion, grund, id };
  };

  // ── NIE ZWEIMAL SENDEN (E-184) ────────────────────────────────────────
  // Ein wiederaufgenommener Lauf trifft eine Zeile, deren Antwort schon
  // draußen ist (gesendet_am gesetzt, aber der Abschluss kam nicht mehr):
  // nichts erzeugen, nichts senden — nur den Zustand geradeziehen.
  if (anspruch[0].gesendet_am) {
    return fertig({ aktion: "auto_beantwortet", begruendung: "Antwort war schon gesendet — Wiederaufnahme ohne zweiten Versand (E-184)" }, "schon gesendet");
  }

  // ── KI-FEHLER MIT ZEITPLAN (E-184) ────────────────────────────────────
  // Wer schreibt und worum es geht, merkt sich der Lauf für die Aufgabe, die
  // nach dem vierten Fehlversuch an einen Menschen geht. Vorher blieb die
  // Zeile mit versuche=3 stumm auf 'fehler' stehen — kein Vermerk, keine Aufgabe.
  let fuerAufgabe: { personId: number | null; ref: string | null; betreff: string } = { personId: null, ref: null, betreff: "" };
  const fehlerFelder = async (grund: string): Promise<Record<string, unknown>> => {
    const fehlversuch = versuche + 1;
    const naechster = WIEDERVORLAGE_MS[fehlversuch] ? new Date(Date.now() + WIEDERVORLAGE_MS[fehlversuch]) : null;
    if (naechster) {
      await akteVermerk(fuerAufgabe.ref, fuerAufgabe.personId, `Antwort NICHT erzeugt (Versuch ${fehlversuch}/4, nächster gegen ${uhrzeitBerlin(naechster)}): ${grund}`);
    } else {
      await akteVermerk(fuerAufgabe.ref, fuerAufgabe.personId, `Antwort endgültig nicht erzeugt nach 4 Versuchen: ${grund}`);
      await aufgabeNachAufgabe({ id, postfach, betreff: fuerAufgabe.betreff, grund, personId: fuerAufgabe.personId, ref: fuerAufgabe.ref, art: "ki-fehler" });
    }
    return { aktion: "fehler", begruendung: grund.slice(0, 400), naechster_versuch_am: naechster };
  };

  try {
    const mail = await nachrichtLesen(postfach, gmailId);
    fuerAufgabe.betreff = mail.betreff;
    const neuerText = ohneZitat(mail.text) || mail.snippet || "";
    const basis = {
      thread_id: mail.threadId, von: mail.von, betreff: mail.betreff, empfangen_am: mail.datum,
      text: neuerText.slice(0, 12_000), message_id: mail.messageIdHeader,
      anhaenge_eingang: mail.anhaenge.length ? JSON.stringify(mail.anhaenge) : null,
    };
    // 04.09.2026 (E-115): Dateien an der Mail. Mara kann sie nicht öffnen, aber
    // sie muss wissen, dass sie da sind — ein Mensch sähe den Beleg auch.
    const anhangHinweis = mail.anhaenge.length
      ? `\n\n[Der Kunde hat ${mail.anhaenge.length} Datei(en) mitgeschickt: ${mail.anhaenge.map((a) => `${a.name} (${a.typ}, ${Math.max(1, Math.round(a.groesse / 1024))} KB)`).join("; ")}. Du kannst sie nicht öffnen; im Postfach sieht ein Mensch sie. Zählt der Inhalt, bestätige dem Kunden den Eingang und leg eine Aufgabe an, die Datei zu prüfen: einen Zahlungsbeleg an die Zahlungsstelle (kollege: "Zahlung"), Ausweis, Unterlagen oder Schreiben an den Betreuer.]`
      : "";
    const textFuerMara = neuerText + anhangHinweis;

    // 1. Fremdpost — eigener Ordner, nie beantworten.
    // ── UNGELESEN BLEIBT UNGELESEN (09.09.2026, E-171) ──────────────────
    // Justin: „ALLE Emails die hinein kommen und NICHT Support sind, müssen
    // irgendwie gekennzeichnet werden bzw. nicht auf ‚geöffnet‘."
    // Vorher nahm Mara hier „UNREAD" weg. Was sie falsch einsortierte, war
    // damit unsichtbar: Am 09.09. lag „Re: 550.000 € — Ihre Untergrenze
    // schließt unsere Runde allein" von Freigeist Capital als „automatische
    // Nachricht" gelesen im Postfach. Der Ordner kennzeichnet die Mail; das
    // Auge entscheidet ein Mensch.
    const fremd = istFremdpost(mail);
    if (fremd.fremd) {
      await ablegen(postfach, gmailId, "FIAON/Kein Kunde");
      return fertig({ ...basis, kategorie: "intern", aktion: "ignoriert", begruendung: fremd.grund }, fremd.grund);
    }

    // 2. Dieselbe Mail an zwei Postfächer? Nur einmal bearbeiten.
    if (mail.messageIdHeader) {
      const [doppelt] = (await sqlPool`
        SELECT postfach FROM fiaon_postmeister
         WHERE message_id = ${mail.messageIdHeader} AND id <> ${id} AND aktion NOT IN ('fehler', 'in_arbeit') LIMIT 1
      `) as any[];
      if (doppelt) {
        return fertig({ ...basis, aktion: "geordnet", begruendung: `Dieselbe Mail liegt auch in ${doppelt.postfach}` }, "Doppelzustellung");
      }
    }

    // 3. Wer schreibt da?
    const wer = await personSuchen(mail.von, neuerText);
    fuerAufgabe = { personId: wer.personId, ref: wer.ref, betreff: mail.betreff };
    const alterTage = Math.floor((Date.now() - mail.datum.getTime()) / 86_400_000);

    // 4. Einordnen.
    const einordnung = await einordnen({ betreff: mail.betreff, text: textFuerMara, von: mail.von, alterTage })
      .catch((e) => { throw new Error(`Einordnung: ${String(e?.message || e).slice(0, 160)}`); });

    const gemeinsam = {
      ...basis,
      kategorie: einordnung.kategorien[0] ?? "sonstiges",
      kategorien: einordnung.kategorien,
      flags: JSON.stringify(einordnung.flags),
      dringend: einordnung.dringend,
      sprache: einordnung.sprache,
      zusammenfassung: einordnung.zusammenfassung,
      person_id: wer.personId,
      ref: wer.ref,
      person_kandidaten: wer.kandidaten.length ? JSON.stringify(wer.kandidaten) : null,
    };

    // Werbung ordnen, nicht beantworten.
    // ── WERBUNG UND SPAM IN EIGENE ORDNER (05.09.2026, E-135) ─────────────
    // Justin: „Der Agent muss verstehen, was Werbung ist (die kann in einen
    // Ordner), was Spam ist und was Kunden sind." Beides verlässt den
    // Posteingang; „Kein Kunde" bleibt für Automaten und Dienstleister
    // (Airwallex, GoCardless), die ein Mensch sehen will.
    if (einordnung.kategorien.length === 1 && einordnung.kategorien[0] === "werbung_newsletter") {
      // Aus dem Posteingang ja (E-135), auf gelesen nein (E-171): Der Ordner
      // trägt die Kennzeichnung, die ungelesene Zeile bleibt Justins Kontrolle.
      await ablegen(postfach, gmailId, "FIAON/Werbung", ["INBOX"]);
      return fertig({ ...gemeinsam, aktion: "ignoriert", begruendung: "Werbung" }, "Werbung");
    }
    if (einordnung.kategorien.length === 1 && einordnung.kategorien[0] === "spam") {
      await ablegen(postfach, gmailId, "FIAON/Spam", ["INBOX"]);
      return fertig({ ...gemeinsam, aktion: "ignoriert", begruendung: "Spam" }, "Spam");
    }

    // 5. Akte-Vermerk — JEDE Kundenmail wird nachgetragen.
    const akte = await akteLesen(wer.personId, wer.ref);
    if (wer.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${wer.ref}, ${wer.personId}, NULL, 'Postmeister', 'system',
                ${`E-Mail an ${postfach}: „${mail.betreff.slice(0, 90)}" — ${einordnung.zusammenfassung.slice(0, 400)}`})
      `.catch(() => {});
    }

    const kundenlage = akte.kundenlage;
    if (ein.nurOrdnen || ein.modus === "aus") {
      return fertig({ ...gemeinsam, kundenlage, aktion: "vorgeordnet", begruendung: "nur eingeordnet" }, "nur geordnet");
    }

    // 6. Verlauf und Antwort.
    const verlauf = await verlaufLesen(postfach, mail.threadId, gmailId);
    const erg = await antwortErzeugen({
      postfach, mail: { betreff: mail.betreff, text: textFuerMara, von: mail.von, alterTage },
      verlauf, einordnung, personId: wer.personId, ref: wer.ref, postmeisterId: id,
    });

    if (!erg.ok || !erg.antwort) {
      return fertig({
        ...gemeinsam, kundenlage, ...(await fehlerFelder(erg.grund)),
        handlungen: JSON.stringify(erg.handlungen), pruefung: JSON.stringify(erg.pruefung),
      }, erg.grund);
    }

    // 7. Anrede und HTML im Haus-CI — in der Sprache, in der der Kunde schrieb.
    //    Bis zum 02.09.2026 konnte hier ein englischer Text mit „Guten Tag
    //    Herr Smith," eingeleitet und mit einem deutschen Knopf beendet
    //    werden. Die Sprache reist jetzt bis in die letzte Zeile mit.
    const [vor, ...restName] = String(akte.name || "").split(" ");
    // Was der Kunde GERADE schreibt, schlägt den Vermerk in der Akte — er
    // schreibt ja in dieser Sprache. Der Vermerk greift nur, wenn die Mail
    // nichts hergab (kurze Mail, nur ein Wort) und ein Mensch die Sprache
    // nach einem Telefonat eingetragen hat.
    const sprache = einordnung.sprache && einordnung.sprache.slice(0, 2) !== "de"
      ? einordnung.sprache
      : (akte.sprache || einordnung.sprache);
    const anrede = await anredeBestimmen(wer.personId, vor || null, restName.join(" ") || null, sprache);
    // Der Gruß trägt den Namen des Agenten (04.09.2026): „Freundliche Grüße\nMara\nFIAON Welcome-Team".
    const { agentName } = await import("./fiaon-postmeister-agent");
    const name = await agentName();
    // „Freundliche Grüße / Mara / FIAON Welcome-Team" — das „Ihr" fällt weg,
    // sobald ein Mensch davor steht; „Mara / Ihr Team" liest sich schief.
    const { grussMitAgent } = await import("./fiaon-postmeister-antworttext");
    const grussMitName = grussMitAgent(ein.gruss, name);
    const fertigeAntwort = antwortBauen({
      anrede: anrede.zeile, kern: erg.antwort, gruss: grussMitName, agentName: name,
      schritt: erg.naechsterSchritt, betreff: mail.betreff, sprache,
    });

    // 7b. Anhänge (04.09.2026, E-115): Trägt die Antwort eine Zahlungsseite,
    //     geht die Rechnung als PDF mit — wie bei einem Menschen, der die
    //     Rechnung gleich mitschickt. Dazu, was das Werkzeug rechnung_anhaengen
    //     schon an die Zeile geschrieben hat.
    const { anhaengePlanen, anhaengeBauen } = await import("./fiaon-postmeister-anhaenge");
    const [zeileJetzt] = (await sqlPool`SELECT anhaenge, gesendet_am FROM fiaon_postmeister WHERE id = ${id}`.catch(() => [])) as any[];
    const anhangPlan = anhaengePlanen(zeileJetzt?.anhaenge, erg.naechsterSchritt);
    const gebaut = anhangPlan.length ? await anhaengeBauen(anhangPlan) : { dateien: [], fehler: [] as string[] };
    if (gebaut.fehler.length) console.warn(`[POSTMEISTER] Anhänge ${id}:`, gebaut.fehler.join("; "));

    // 8. Senden oder Entwurf. Im Zweifel Entwurf.
    const darfAuto = ein.modus === "auto" && erg.automatischErlaubt && !ein.nurOrdnen;
    const felder = {
      ...gemeinsam, kundenlage,
      antwort: fertigeAntwort.text, antwort_html: fertigeAntwort.html,
      belege: JSON.stringify(erg.belege), handlungen: JSON.stringify(erg.handlungen),
      pruefung: JSON.stringify(erg.pruefung), naechster_schritt: erg.naechsterSchritt ? JSON.stringify(erg.naechsterSchritt) : null,
      ki_kosten_cents: erg.kostenCents, entwurf_geprueft_am: new Date(),
      anhaenge: anhangPlan.length ? JSON.stringify(anhangPlan) : null,
    };

    // Zweite Sperre gegen den Doppelversand (E-184): Sollte die Antwort
    // während dieses Laufs anderswo hinausgegangen sein, nicht noch einmal.
    if (zeileJetzt?.gesendet_am) {
      return fertig({ ...gemeinsam, kundenlage, aktion: "auto_beantwortet", begruendung: "Antwort war schon gesendet — nicht erneut geschickt (E-184)" }, "schon gesendet");
    }

    if (darfAuto) {
      // ── VERSAND SCHEITERT ≠ ANTWORT SCHEITERT (11.09.2026, E-184) ─────
      // Bis heute landete ein Gmail-Fehler beim Senden im äußeren catch: die
      // fertige Antwort ging verloren, die Zeile auf 'fehler', und der nächste
      // Takt erzeugte alles neu — viermal in 20 Minuten. Jetzt bleibt die
      // Antwort mit allen Feldern in der Zeile und wird nachgeholt (unten,
      // versandNachholen): in 15 Minuten, dann 2 Stunden, dann 24 Stunden.
      try {
        await antwortSenden(postfach, mail, fertigeAntwort.text, fertigeAntwort.html, gebaut.dateien);
      } catch (e: any) {
        const grund = String(e?.message || e).slice(0, 300);
        const naechster = new Date(Date.now() + WIEDERVORLAGE_MS[1]);
        console.error(`[POSTMEISTER] Versand ${postfach}/${gmailId} fehlgeschlagen (Versuch 1/4, nächster ${uhrzeitBerlin(naechster)}):`, grund);
        await akteVermerk(wer.ref, wer.personId, `Antwort NICHT gesendet (Versuch 1/4, nächster gegen ${uhrzeitBerlin(naechster)}): ${grund}`);
        return fertig({
          ...felder, aktion: "versand_wartet", versand_versuche: 1, versand_fehler: grund,
          naechster_versuch_am: naechster, versand_aufgegeben_am: null, begruendung: erg.grund,
        }, `Versand fehlgeschlagen: ${grund}`);
      }
      // Sofort festhalten, dass die Mail draußen ist — auch wenn Ablage oder
      // Vermerk gleich scheitern oder der Server neu startet (E-184).
      await sqlPool`UPDATE fiaon_postmeister SET gesendet_am = NOW(), aktion = 'auto_beantwortet', updated_at = NOW() WHERE id = ${id}`.catch(() => {});
      await ablegen(postfach, gmailId, "FIAON/Auto-beantwortet", ["UNREAD"]);
      if (wer.ref) {
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          VALUES (${wer.ref}, ${wer.personId}, NULL, 'Postmeister', 'system',
                  ${`Antwort gesendet${gebaut.dateien.length ? ` (mit ${gebaut.dateien.map((d) => d.dateiname).join(", ")})` : ""}: ${fertigeAntwort.text.slice(0, 400)}`})
        `.catch(() => {});
      }
      return fertig({ ...felder, aktion: "auto_beantwortet", gesendet_am: new Date(), begruendung: erg.grund }, erg.grund);
    }

    const draftId = await entwurfAnlegen(postfach, mail, fertigeAntwort.text, fertigeAntwort.html, gebaut.dateien).catch(() => null);
    await ablegen(postfach, gmailId, "FIAON/Entwurf wartet");
    return fertig({ ...felder, aktion: "entwurf", antwort_draft_id: draftId, begruendung: erg.grund }, erg.grund);
  } catch (e: any) {
    const grund = String(e?.message || e).slice(0, 300);
    console.error(`[POSTMEISTER] ${postfach}/${gmailId} (Versuch ${versuche + 1}/4):`, grund);
    return fertig(await fehlerFelder(grund), grund);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VERSAND NACHHOLEN (11.09.2026, E-184 — Team-Feedback Punkt 1)
//
// DIE MESSUNG: Scheiterte der Gmail-Versand, landete die Mail auf 'fehler'.
// Das Sieb im 5-Minuten-Takt legte jede 'fehler'-Zeile in JEDEM Takt neu vor,
// und jedes Mal erzeugte die KI die Antwort NEU — vier Versuche in 15 bis 20
// Minuten (343 postmeister-antwort-Aufrufe in drei Tagen, im Schnitt 2,3 ct
// und 12 Sekunden je Aufruf). Danach stand die Zeile mit versuche=3 für immer
// auf 'fehler': kein Vermerk, keine Aufgabe, niemand erfuhr davon. Dazu hingen
// 13 Zeilen nach Server-Neustarts in 'in_arbeit' (01.–07.09.), für Sieb und
// Zentrale unsichtbar.
//
// JETZT: Scheitert nur der Versand, bleibt die fertige Antwort in der Zeile
// (aktion='versand_wartet') und wird hier nachgeholt — DIESELBE Antwort, nie
// eine neue: 15 Minuten, 2 Stunden und 24 Stunden nach dem Erstversuch. Nach
// dem vierten Fehlschlag: 'versand_fehlgeschlagen', Vermerk in der Akte,
// dringende Aufgabe an den Betreuer (Schlüssel postmeister:<id>:versand —
// entsteht einmal, nicht je Takt). In der Zentrale bleibt die Antwort unter
// „Zu prüfen“ und kann jederzeit von Hand gesendet werden.
//
// Läuft am Ende jedes Takts (postmeisterLauf), kein eigener Cron. Beansprucht
// wird wie beim Handversand über aktion='sendet': Wer die Zeile zuerst nimmt,
// sendet — ein zweiter Takt oder ein Mensch findet sie nicht mehr.
// ═══════════════════════════════════════════════════════════════════════════
export async function versandNachholen(ein: { postfaecher?: string[] } = {}):
  Promise<{ geprueft: number; gesendet: number; verschoben: number; aufgegeben: number }> {
  await postmeisterSchema();
  const erg = { geprueft: 0, gesendet: 0, verschoben: 0, aufgegeben: 0 };
  const zeilen = (await sqlPool`
    UPDATE fiaon_postmeister SET aktion = 'sendet', in_arbeit_seit = NOW(), updated_at = NOW()
     WHERE id IN (SELECT id FROM fiaon_postmeister
                   WHERE aktion = 'versand_wartet' AND naechster_versuch_am <= NOW()
                     AND (${ein.postfaecher ? sqlPool`postfach = ANY(${ein.postfaecher})` : sqlPool`TRUE`})
                   ORDER BY naechster_versuch_am ASC LIMIT 10 FOR UPDATE SKIP LOCKED)
     RETURNING *
  `) as any[];

  for (const r of zeilen) {
    erg.geprueft += 1;
    const id = Number(r.id);
    const versuch = Number(r.versand_versuche || 0) + 1;
    const ref: string | null = r.ref ?? null;
    const personId: number | null = r.person_id ?? null;

    const verschieben = async (grund: string, naechster: Date): Promise<void> => {
      await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'versand_wartet', versand_versuche = ${versuch}, versand_fehler = ${grund},
               naechster_versuch_am = ${naechster}, in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
      `.catch((e) => console.error("[POSTMEISTER] nachholen speichern:", String(e).slice(0, 160)));
      await akteVermerk(ref, personId, `Antwort NICHT gesendet (Versuch ${versuch}/4, nächster gegen ${uhrzeitBerlin(naechster)}): ${grund}`);
      console.warn(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} erneut gescheitert (Versuch ${versuch}/4, nächster ${uhrzeitBerlin(naechster)}):`, grund);
      erg.verschoben += 1;
    };
    const aufgeben = async (grund: string): Promise<void> => {
      await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'versand_fehlgeschlagen', versand_versuche = ${versuch}, versand_fehler = ${grund},
               naechster_versuch_am = NULL, versand_aufgegeben_am = NOW(), in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
      `.catch((e) => console.error("[POSTMEISTER] nachholen speichern:", String(e).slice(0, 160)));
      await akteVermerk(ref, personId, `Versand endgültig fehlgeschlagen nach 4 Versuchen: ${grund}`);
      await aufgabeNachAufgabe({ id, postfach: String(r.postfach), betreff: String(r.betreff || ""), grund, personId, ref, art: "versand" });
      console.error(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} endgültig fehlgeschlagen — Aufgabe angelegt:`, grund);
      erg.aufgegeben += 1;
    };

    // Ein nicht bedientes Postfach (E-171) wird nie wieder senden — sofort aufgeben, nicht 26 Stunden warten.
    if (!wirdBedient(String(r.postfach))) {
      await aufgeben(`Postfach ${r.postfach} wird vom Agenten nicht bedient (E-171)`);
      continue;
    }

    try {
      // Genau der Weg des Handversands (Zentrale): Nachricht lesen, Anhänge
      // bauen, antwortSenden — nur der Text kommt aus der Zeile, nicht vom Modell.
      const mail = await nachrichtLesen(String(r.postfach), String(r.gmail_id));
      const { anhaengePlanen, anhaengeBauen } = await import("./fiaon-postmeister-anhaenge");
      const plan = anhaengePlanen(r.anhaenge, jsonLesen(r.naechster_schritt));
      const gebaut = plan.length ? await anhaengeBauen(plan) : { dateien: [], fehler: [] as string[] };
      if (gebaut.fehler.length) console.warn(`[POSTMEISTER] Anhänge ${id} (nachgeholt):`, gebaut.fehler.join("; "));
      const text = String(r.antwort || "");
      if (text.trim().length < 20) throw new Error("Gespeicherte Antwort fehlt oder ist zu kurz");
      // Das HTML aus dem Erstversuch. Fehlt es (Altzeile), wird es aus dem Text
      // gebaut — derselbe Weg wie beim Freigeben eines Entwurfs.
      let html: string | null = r.antwort_html ? String(r.antwort_html) : null;
      if (!html) {
        const { antwortAusText, grussMitAgent } = await import("./fiaon-postmeister-antworttext");
        const { agentName } = await import("./fiaon-postmeister-agent");
        const { postfachGruss } = await import("./fiaon-postmeister-postfaecher");
        const name = await agentName();
        html = antwortAusText(text, {
          schritt: jsonLesen(r.naechster_schritt), betreff: String(r.betreff || ""), sprache: r.sprache ?? null,
          agentName: name, gruss: grussMitAgent(postfachGruss(String(r.postfach)), name),
        }).html;
      }
      await antwortSenden(String(r.postfach), mail, text, html, gebaut.dateien);
      await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'auto_beantwortet', gesendet_am = NOW(), versand_versuche = ${versuch},
               versand_fehler = NULL, naechster_versuch_am = NULL, in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
      `.catch((e) => console.error("[POSTMEISTER] nachholen speichern:", String(e).slice(0, 160)));
      await ablegen(String(r.postfach), String(r.gmail_id), "FIAON/Auto-beantwortet", ["UNREAD"]);
      await akteVermerk(ref, personId, `Antwort gesendet (nachgeholt, Versuch ${versuch}${gebaut.dateien.length ? `, mit ${gebaut.dateien.map((d) => d.dateiname).join(", ")}` : ""}): ${text.slice(0, 400)}`);
      console.log(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} nachgeholt (Versuch ${versuch}).`);
      erg.gesendet += 1;
    } catch (e: any) {
      const grund = String(e?.message || e).slice(0, 300);
      const wartezeit = WIEDERVORLAGE_MS[versuch];
      if (wartezeit) await verschieben(grund, new Date(Date.now() + wartezeit));
      else await aufgeben(grund);
    }
  }
  return erg;
}
