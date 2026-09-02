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

/** Der zuständige Mensch — Betreuer der Person, sonst Vertriebsleitung. */
async function zustaendig(personId: number | null): Promise<{ id: number | null; name: string }> {
  if (personId) {
    const [r] = (await sqlPool`
      SELECT a.id, COALESCE(a.first_name, a.name, a.email) AS name
        FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
       WHERE p.id = ${personId} AND a.active IS NOT FALSE LIMIT 1
    `) as any[];
    if (r?.id) return { id: Number(r.id), name: String(r.name) };
  }
  const [l] = (await sqlPool`
    SELECT id, COALESCE(first_name, name, email) AS name FROM fiaon_agents
     WHERE active IS NOT FALSE AND rolle IN ('vertriebsleitung', 'leitung', 'admin')
     ORDER BY (rolle = 'vertriebsleitung') DESC, id ASC LIMIT 1
  `) as any[];
  return l?.id ? { id: Number(l.id), name: String(l.name) } : { id: null, name: "Leitung" };
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
    return { ok: true, ergebnis: `${wer.name} ist informiert${p.anrufen ? " und ruft an" : ""}.`, daten: { betreuer: wer.name, dringend: !!p.dringend } };
  },
};

/**
 * KÜNDIGUNG VORMERKEN — nach Justins Regel: kulant entlassen, aber erst nach
 * Zahlung der gestellten Rechnung. Das Werkzeug setzt den Zustand; die
 * Bestätigungsmail kommt aus dem Kündigungsmodul, nicht aus der KI-Feder.
 */
export const kuendigungVormerken: Werkzeug = {
  name: "kuendigung_vormerken",
  beschreibung: "Nimmt eine Kündigung entgegen. Nur bei einer eindeutigen Willenserklärung des Kunden ('ich kündige', 'hiermit kündige ich'), niemals bei Fragen oder Überlegungen. Der Vertrag läuft zwölf Monate; wir entlassen kulant vorzeitig, aber die bereits gestellte Rate bleibt zu zahlen. Nach dem Aufruf nennst du in der Antwort die offene Rate mit Betrag und Zahlungsseite.",
  stufe: "frei",
  lagen: ["unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv", "rate_ueberfaellig", "gekuendigt", "bestreitet"],
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
    if (!istWillenserklaerung(zitat)) {
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
  beschreibung: "Hält die automatischen Zahlungserinnerungen zu dieser Bestellung an. Nutze das, wenn der Kunde einen Klärungsbedarf hat (bestreitet die Forderung, hat nachweislich gezahlt, braucht eine Ratenpause) — nicht als Gefälligkeit. Die Forderung bleibt bestehen.",
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
    return { ok: true, ergebnis: `${wer.name} ruft an, bevor etwas eskaliert.`, daten: { offen_euro: summe, betreuer: wer.name } };
  },
};

/** Alle Werkzeuge, in der Reihenfolge, in der das Modell sie sehen soll. */
export const POSTMEISTER_WERKZEUGE: Werkzeug[] = [
  zahlungslinkBauen, terminlinkBauen, notizAnBetreuer, vermerkSchreiben,
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
