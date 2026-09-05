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
import type { Kundenlage } from "@shared/fiaon-postmeister-typen";

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
async function protokoll(k: WerkzeugKontext, werkzeug: string, text: string, sichtbar = true): Promise<void> {
  if (k.ref && sichtbar) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${k.ref}, ${k.personId ?? null}, NULL, 'Postmeister', 'system', ${text.slice(0, 900)})
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
  beschreibung: "Schreibt dem zuständigen Betreuer eine kurze Nachricht in die Akte und legt ihm eine Aufgabe an. Nutze das, wenn ein Mensch etwas wissen oder tun muss: Kunde ist verärgert, will nicht zahlen, droht mit Anwalt, braucht ein Gespräch vor der nächsten Mahnung. Schreib so, wie du es einem Kollegen sagen würdest.",
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
    // Aufgabe für den Menschen — idempotent je Person und Tag.
    await sqlPool`
      INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, faellig_am, link, quelle, status, zustaendig_art, zustaendig_agent_id, zustaendig_name)
      VALUES (${`postmeister:${k.personId ?? k.ref ?? "unbekannt"}:${new Date().toISOString().slice(0, 10)}`},
              ${p.dringend ? "Kunde braucht heute jemanden" : "Hinweis vom Postmeister"},
              ${text}, 'postmeister', ${p.dringend ? 1 : 3},
              ${p.dringend ? new Date() : new Date(Date.now() + 2 * 864e5)},
              ${k.ref ? `/chef/s/akte?ref=${k.ref}` : null}, 'postmeister', 'offen',
              ${wer.id ? "agent" : "betreiber"}, ${wer.id}, ${wer.name})
      ON CONFLICT (schluessel) DO UPDATE SET text = fiaon_betreiber_todos.text || E'\\n\\n' || EXCLUDED.text,
             prioritaet = LEAST(fiaon_betreiber_todos.prioritaet, EXCLUDED.prioritaet), letzte_aktivitaet = NOW()
    `.catch(async () => {
      // Ohne Unique-Index auf schluessel: einfach anlegen.
      await sqlPool`
        INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, quelle, status, zustaendig_art, zustaendig_agent_id, zustaendig_name)
        VALUES (${p.dringend ? "Kunde braucht heute jemanden" : "Hinweis vom Postmeister"}, ${text}, 'postmeister',
                ${p.dringend ? 1 : 3}, 'postmeister', 'offen', ${wer.id ? "agent" : "betreiber"}, ${wer.id}, ${wer.name})
      `.catch(() => {});
    });
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
  beschreibung: "Legt dem zuständigen Betreuer eine echte Aufgabe mit Titel, Auftrag und Frist an. Er sieht sie in seinem Portal unter Aufträge und bekommt eine Mail. Nutze das, wenn ein Mensch etwas TUN muss, das du nicht kannst: Kunde will einen Anruf, braucht eine Bescheinigung, will Daten ändern, hat Unterlagen geschickt, verlangt eine Antwort von einem Menschen, oder eine frühere Kündigung muss geprüft werden. Für einen bloßen Hinweis nimm notiz_an_betreuer.",
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
    const erg = await auftragFuerKunden({
      personId: k.personId, ref: k.ref, titel, text: mailKopf + text, faelligAm, dringend: !!p.dringend,
      // Eine Aufgabe je Kunde und Tag — drei gleiche Mails (Frau Weber, 25.08.)
      // ergaben drei Aufgaben. Der Text wird an die bestehende angehängt.
      schluessel: `postmeister:${k.personId ?? k.ref ?? k.postmeisterId ?? "x"}:aufgabe:${new Date().toISOString().slice(0, 10)}`,
      quelle: "postmeister", autorName: "Mara", agentId: gewuenscht?.id ?? null,
    });
    const wer = erg.agentName ?? "die Leitung";
    const werKunde = erg.kundenName ?? erg.agentName ?? "unsere Leitung";
    await protokoll(k, "aufgabe_an_betreuer", `Aufgabe für ${wer}: „${titel}" (fällig ${faelligAm}). ${text.slice(0, 300)}`);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    // ── RÜCKRUF ALS TERMIN IM KALENDER (Florentine Punkt 3) ───────────────
    // „Erkannte Rückrufwünsche automatisch als Termin in den Kalender des
    // zuständigen Mitarbeiters eintragen, verknüpft mit Kunde und Mail."
    let terminSatz = "";
    const rueckrufAm = String(p.rueckruf_am || "").trim();
    if (rueckrufAm && k.personId && erg.agentId) {
      try {
        const { terminBuchen } = await import("./fiaon-termine");
        const b = await terminBuchen({ personId: k.personId, agentId: Number(erg.agentId), beginn: rueckrufAm, quelle: "agent_manuell", herkunft: "agent" });
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
    if (!/^FIAON-[A-Z0-9]{6}(-\d{1,2})?$/.test(ref)) return { ok: false, ergebnis: "", fehler: "Das ist keine Zahlungsreferenz." };
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
  lagen: ["zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt", "bestreitet", "unbezahlt"],
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
    if (!/^FIAON-[A-Z0-9]{6}(-\d{1,2})?$/.test(ref)) return { ok: false, ergebnis: "", fehler: "Referenz sieht nicht wie eine Zahlungsreferenz aus." };
    const { zahlungsauftragFinden } = await import("./fiaon-zahlungsauftrag");
    const z = await zahlungsauftragFinden(ref);
    if (!z) return { ok: false, ergebnis: "", fehler: "Zu dieser Referenz gibt es keinen offenen Auftrag." };
    if (z.status === "paid") return { ok: false, ergebnis: "", fehler: "Diese Rechnung ist bereits bezahlt — sag das dem Kunden, statt zu einer Zahlung aufzufordern." };

    // ── LÄUFT FÜR DIESE RATE SCHON EIN EINZUG? (02.09.2026) ────────────────
    // Bei der Abnahme gefunden: Dieses Werkzeug ist auch in der Lage „aktiv"
    // freigegeben — also genau für Lastschriftkunden. Der einzige Schutz war
    // bis hierher ein Satz im Prompt („NICHT zur Zahlung auffordern"). Ein
    // Satz im Prompt ist eine Bitte, keine Wand: Fragt der Kunde „wie kann
    // ich zahlen?", holt das Modell die Seite trotzdem — und der Kunde
    // überweist einen Betrag, der drei Tage später abgebucht wird.
    // Der Server entscheidet das jetzt, nicht der Prompt.
    if (/-\d{1,2}$/.test(ref)) {
      const { sqlPool } = await import("./db-pool");
      const { wirdEingezogenSql } = await import("./fiaon-einzug-schutz");
      const [t] = (await sqlPool.unsafe(
        `SELECT ${wirdEingezogenSql("r")} AS ja FROM fiaon_abo_raten r
          WHERE r.zahlungsreferenz = $1 AND r.status = 'offen' LIMIT 1`,
        [ref],
      ).catch(() => [])) as any[];
      if (t?.ja === true) {
        return {
          ok: false, ergebnis: "",
          fehler: "Für diese Rate läuft bereits ein Bankeinzug. Sag dem Kunden, dass der Betrag automatisch abgebucht wird — fordere ihn NICHT zur Überweisung auf.",
        };
      }
    }

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
    await sqlPool`
      INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, quelle, status, zustaendig_art, zustaendig_agent_id, zustaendig_name, link)
      VALUES ('Zahlung verweigert — Anruf vor Eskalation', ${text}, 'postmeister', 1, 'postmeister', 'offen',
              ${wer.id ? "agent" : "betreiber"}, ${wer.id}, ${wer.name}, ${k.ref ? `/chef/s/akte?ref=${k.ref}` : null})
    `.catch(() => {});
    return { ok: true, ergebnis: `${wer.kundenName} ruft Sie an, bevor etwas eskaliert.`, daten: { offen_euro: summe, betreuer: wer.kundenName } };
  },
};

/** Alle Werkzeuge, in der Reihenfolge, in der das Modell sie sehen soll. */
export const POSTMEISTER_WERKZEUGE: Werkzeug[] = [
  zahlungslinkBauen, rechnungAnhaengen, terminlinkBauen, notizAnBetreuer, aufgabeAnBetreuer, vermerkSchreiben,
  kuendigungVormerken, werbesperreSetzen, mahnstoppSetzen, eskalationVorbereiten, kontoFreischalten,
];

/** Welche Werkzeuge in dieser Lage angeboten werden. */
export function werkzeugeFuerLage(lage: Kundenlage): Werkzeug[] {
  return POSTMEISTER_WERKZEUGE.filter((w) => w.lagen === "alle" || w.lagen.includes(lage));
}

/** Das Format, das OpenAI erwartet. */
export function werkzeugeAlsTools(lage: Kundenlage): unknown[] {
  return werkzeugeFuerLage(lage).map((w) => ({
    type: "function",
    function: { name: w.name, description: w.beschreibung, parameters: w.parameter },
  }));
}

export function werkzeugVonName(name: string): Werkzeug | undefined {
  return POSTMEISTER_WERKZEUGE.find((w) => w.name === name);
}
