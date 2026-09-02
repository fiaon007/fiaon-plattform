// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF — eine Mail von Anfang bis Ende (03.09.2026, E-094)
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
import { AUTOMATEN_DOMAENEN, type Aktion } from "@shared/fiaon-postmeister-typen";

/**
 * Eine Nachricht in einen Ordner legen — und daran NIE eine Mail scheitern lassen.
 *
 * 03.09.2026: Die vier Aufrufstellen sahen so aus:
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
     ORDER BY empfangen_am ASC LIMIT 8
  `) as any[];
  const verlauf: { von: string; am: string; text: string }[] = [];
  for (const z of zeilen) {
    if (z.text) verlauf.push({ von: "Kunde", am: new Date(z.empfangen_am).toLocaleDateString("de-DE"), text: String(z.text).slice(0, 900) });
    if (z.antwort && (z.gesendet_am || z.aktion === "auto_beantwortet")) {
      verlauf.push({ von: "FIAON", am: new Date(z.gesendet_am ?? z.empfangen_am).toLocaleDateString("de-DE"), text: String(z.antwort).slice(0, 900) });
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

  // Anspruch — läuft der Takt doppelt, arbeitet nur einer.
  let anspruch = (await sqlPool`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, in_arbeit_seit)
    VALUES (${postfach}, ${gmailId}, '', 'in_arbeit', NOW())
    ON CONFLICT (gmail_id) DO NOTHING RETURNING id
  `) as any[];
  if (!anspruch.length) {
    anspruch = (await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'in_arbeit', in_arbeit_seit = NOW(), versuche = versuche + 1, updated_at = NOW()
       WHERE gmail_id = ${gmailId} AND (aktion IN ('vorgeordnet', 'fehler') OR (aktion = 'in_arbeit' AND in_arbeit_seit < NOW() - INTERVAL '15 minutes'))
         AND versuche < 3
       RETURNING id
    `) as any[];
    if (!anspruch.length) return { aktion: "geordnet", grund: "schon bearbeitet", id: null };
  }
  const id = Number(anspruch[0].id);

  const fertig = async (felder: Record<string, unknown>, grund: string): Promise<LaufErgebnis> => {
    await sqlPool`
      UPDATE fiaon_postmeister SET ${sqlPool(felder as any)}, in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
    `.catch((e) => console.error("[POSTMEISTER] speichern:", String(e).slice(0, 160)));
    return { aktion: String(felder.aktion) as Aktion, grund, id };
  };

  try {
    const mail = await nachrichtLesen(postfach, gmailId);
    const neuerText = ohneZitat(mail.text) || mail.snippet || "";
    const basis = {
      thread_id: mail.threadId, von: mail.von, betreff: mail.betreff, empfangen_am: mail.datum,
      text: neuerText.slice(0, 12_000), message_id: mail.messageIdHeader,
    };

    // 1. Fremdpost — eigener Ordner, nie beantworten.
    const fremd = istFremdpost(mail);
    if (fremd.fremd) {
      await ablegen(postfach, gmailId, "FIAON/Kein Kunde", ["UNREAD"]);
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
    const alterTage = Math.floor((Date.now() - mail.datum.getTime()) / 86_400_000);

    // 4. Einordnen.
    const einordnung = await einordnen({ betreff: mail.betreff, text: neuerText, von: mail.von, alterTage })
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
    if (einordnung.kategorien.includes("werbung_newsletter") && einordnung.kategorien.length === 1) {
      await ablegen(postfach, gmailId, "FIAON/Kein Kunde", ["UNREAD"]);
      return fertig({ ...gemeinsam, aktion: "ignoriert", begruendung: "Werbung" }, "Werbung");
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
      postfach, mail: { betreff: mail.betreff, text: neuerText, von: mail.von, alterTage },
      verlauf, einordnung, personId: wer.personId, ref: wer.ref, postmeisterId: id,
    });

    if (!erg.ok || !erg.antwort) {
      return fertig({
        ...gemeinsam, kundenlage, aktion: "fehler", begruendung: erg.grund.slice(0, 400),
        handlungen: JSON.stringify(erg.handlungen), pruefung: JSON.stringify(erg.pruefung),
      }, erg.grund);
    }

    // 7. Anrede und HTML im Haus-CI — in der Sprache, in der der Kunde schrieb.
    //    Bis zum 03.09.2026 konnte hier ein englischer Text mit „Guten Tag
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
    const fertigeAntwort = antwortBauen({
      anrede: anrede.zeile, kern: erg.antwort, gruss: ein.gruss,
      schritt: erg.naechsterSchritt, betreff: mail.betreff, sprache,
    });

    // 8. Senden oder Entwurf. Im Zweifel Entwurf.
    const darfAuto = ein.modus === "auto" && erg.automatischErlaubt && !ein.nurOrdnen;
    const felder = {
      ...gemeinsam, kundenlage,
      antwort: fertigeAntwort.text, antwort_html: fertigeAntwort.html,
      belege: JSON.stringify(erg.belege), handlungen: JSON.stringify(erg.handlungen),
      pruefung: JSON.stringify(erg.pruefung), naechster_schritt: erg.naechsterSchritt ? JSON.stringify(erg.naechsterSchritt) : null,
      ki_kosten_cents: erg.kostenCents, entwurf_geprueft_am: new Date(),
    };

    if (darfAuto) {
      await antwortSenden(postfach, mail, fertigeAntwort.text, fertigeAntwort.html);
      await ablegen(postfach, gmailId, "FIAON/Auto-beantwortet", ["UNREAD"]);
      if (wer.ref) {
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          VALUES (${wer.ref}, ${wer.personId}, NULL, 'Postmeister', 'system',
                  ${`Antwort gesendet: ${fertigeAntwort.text.slice(0, 400)}`})
        `.catch(() => {});
      }
      return fertig({ ...felder, aktion: "auto_beantwortet", gesendet_am: new Date(), begruendung: erg.grund }, erg.grund);
    }

    const draftId = await entwurfAnlegen(postfach, mail, fertigeAntwort.text, fertigeAntwort.html).catch(() => null);
    await ablegen(postfach, gmailId, "FIAON/Entwurf wartet");
    return fertig({ ...felder, aktion: "entwurf", antwort_draft_id: draftId, begruendung: erg.grund }, erg.grund);
  } catch (e: any) {
    const grund = String(e?.message || e).slice(0, 300);
    console.error(`[POSTMEISTER] ${postfach}/${gmailId}:`, grund);
    return fertig({ aktion: "fehler", begruendung: grund }, grund);
  }
}
