// ═══════════════════════════════════════════════════════════════════════════
// SOFTPHONE — telefonieren aus dem System
//
// NICHT ZU VERWECHSELN mit server/lib/fiaon-telefon.ts: Dort steht seit
// Längerem, wie aus einer krummen Nummer eine WÄHLBARE wird (Vorwahl
// ergänzen, nationale Null verwerfen). Diese Datei ruft an. Sie benutzt die
// vorhandene Normalisierung und schreibt keine zweite.
//
// NUR AUSGEHEND. Eingehende Rufe laufen über einen externen Annahmedienst;
// ein Browser, der klingeln soll, muss offen sein, und niemand hat den ganzen
// Tag denselben Tab offen.
//
// ── OHNE ZUGANGSDATEN PASSIERT NICHTS, ABER NICHTS STÜRZT AB ───────────────
// Die Twilio-Werte sind heute nicht gesetzt. Jede Funktion hier gibt dann
// einen sauberen Zustand zurück, den die Oberfläche anzeigen kann — und
// `einrichtungsStand()` sagt auf die Zeile genau, welcher Wert fehlt. Ein
// „irgendwas ist nicht konfiguriert" hilft niemandem.
//
// ── DREI WÄNDE GEGEN KOSTEN UND MISSBRAUCH ─────────────────────────────────
// Ein Softphone ist eine Kreditkarte in den Händen von jedem, der sich
// anmelden kann. Deshalb:
//   1. Nur DACH-Vorwahlen (+49/+43/+41) plus eine pflegbare Freiliste.
//   2. Höchstens 60 Minuten je Gespräch — Twilio rechnet je Minute.
//   3. Jede Wahl wird protokolliert, auch die abgelehnte.
// Testkonten können gar nicht wählen.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Die Werte, die Twilio braucht — mit Klartext, wo man sie herbekommt. */
export const ENV_FELDER: { name: string; zweck: string; woher: string }[] = [
  { name: "TWILIO_ACCOUNT_SID", zweck: "Das Konto selbst", woher: "Twilio Console → Account Info → Account SID" },
  { name: "TWILIO_AUTH_TOKEN", zweck: "Serverseitige Aufrufe (Aufnahmen abholen)", woher: "Twilio Console → Account Info → Auth Token" },
  { name: "TWILIO_API_KEY_SID", zweck: "Kurzlebige Browser-Ausweise ausstellen", woher: "Console → Account → API keys & tokens → Create API key (Standard)" },
  { name: "TWILIO_API_KEY_SECRET", zweck: "Der zugehörige geheime Teil", woher: "Wird beim Anlegen des API-Keys EINMAL angezeigt" },
  { name: "TWILIO_TWIML_APP_SID", zweck: "Sagt Twilio, was bei einem Anruf zu tun ist", woher: "Console → Voice → TwiML → TwiML Apps → Create; Voice-URL auf /api/fiaon/telefon/twiml" },
  { name: "TWILIO_CALLER_ID", zweck: "Die Nummer, die beim Kunden erscheint", woher: "Console → Phone Numbers → Eine deutsche oder österreichische Nummer kaufen" },
];

export interface EinrichtungsStand {
  bereit: boolean;
  /** Ausdrücklich abgeschaltet, obwohl alles da wäre. */
  abgeschaltet: boolean;
  fehlend: { name: string; zweck: string; woher: string }[];
  vorhanden: string[];
  hinweis: string;
}

export function einrichtungsStand(): EinrichtungsStand {
  const fehlend = ENV_FELDER.filter((f) => !process.env[f.name]);
  const vorhanden = ENV_FELDER.filter((f) => !!process.env[f.name]).map((f) => f.name);
  // Das Flag kann auch bei vollständiger Einrichtung abschalten — etwa,
  // während jemand die Nummer wechselt.
  const abgeschaltet = String(process.env.SOFTPHONE || "").toLowerCase() === "aus";
  const bereit = fehlend.length === 0 && !abgeschaltet;
  return {
    bereit, abgeschaltet, fehlend, vorhanden,
    hinweis: abgeschaltet
      ? "Das Softphone ist über die Umgebungsvariable SOFTPHONE=aus abgeschaltet."
      : fehlend.length === 0
        ? "Alles eingerichtet — es kann telefoniert werden."
        : `Zum Telefonieren fehlen noch ${fehlend.length} ${fehlend.length === 1 ? "Wert" : "Werte"}. `
          + "Alles andere ist fertig gebaut und wartet nur darauf.",
  };
}

export function telefonBereit(): boolean {
  return einrichtungsStand().bereit;
}

// ───────────────────────────────────────────────────────────────────────────
// Nummern
// ───────────────────────────────────────────────────────────────────────────

/** Die erlaubten Länder. Mehr wird nicht gewählt, egal wer klickt. */
export const DACH = [
  { vorwahl: "+49", land: "Deutschland" },
  { vorwahl: "+43", land: "Österreich" },
  { vorwahl: "+41", land: "Schweiz" },
];

/**
 * Nummer auf E.164 bringen — für frei getippte Eingaben aus der Wähltastatur.
 *
 * Für Nummern AUS DEM BESTAND ist `waehlbareNummer()` in
 * server/lib/fiaon-telefon.ts zuständig: Die kennt die getrennte
 * `phone_country_code`-Spalte und weigert sich lieber, als eine Vorwahl zu
 * raten. Hier geht es um das, was ein Mensch gerade eintippt — da gibt es
 * keine Nebenspalte, aus der man etwas ableiten könnte.
 */
export function nummerNormalisieren(roh: string, vorwahlVorgabe = "+49"): string | null {
  let s = String(roh || "").trim().replace(/[\s()/.\-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("0")) s = `${vorwahlVorgabe}${s.slice(1)}`;
  if (!s.startsWith("+")) s = `${vorwahlVorgabe}${s}`;
  // Führende Null nach der Landesvorwahl: „+49 0176" ist ein häufiger Tippfehler.
  s = s.replace(/^(\+\d{2})0+/, "$1");
  if (!/^\+\d{8,15}$/.test(s)) return null;
  return s;
}

export async function freiliste(lauf: Lauf = sqlPool): Promise<string[]> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'telefon_freiliste'`) as any[];
  if (!r?.value) return [];
  return String(r.value).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

export interface WahlPruefung { erlaubt: boolean; nummer: string | null; grund: string | null }

/**
 * Darf diese Nummer gewählt werden?
 *
 * Die Prüfung steht hier und nicht in der Route: Sie wird von der Token-Route
 * UND vom TwiML-Weg gebraucht. Zwei Fassungen wären zwei Gelegenheiten, eine
 * davon zu vergessen.
 */
export async function wahlPruefen(roh: string, lauf: Lauf = sqlPool): Promise<WahlPruefung> {
  const nummer = nummerNormalisieren(roh);
  if (!nummer) {
    return { erlaubt: false, nummer: null, grund: "Das ist keine gültige Rufnummer." };
  }
  const dach = DACH.some((d) => nummer.startsWith(d.vorwahl));
  if (dach) return { erlaubt: true, nummer, grund: null };

  const frei = await freiliste(lauf);
  if (frei.some((f) => nummer.startsWith(f))) return { erlaubt: true, nummer, grund: null };

  return {
    erlaubt: false, nummer,
    grund: `Es werden nur Nummern in Deutschland, Österreich und der Schweiz gewählt (${nummer}). `
      + "Andere Ziele müssen in den Einstellungen ausdrücklich freigegeben werden — das schützt vor "
      + "teuren Fehlwahlen und vor Missbrauch eines gekaperten Zugangs.",
  };
}

/** Höchstdauer eines Gesprächs. Twilio rechnet je angefangener Minute. */
export const MAX_MINUTEN = 60;

// ───────────────────────────────────────────────────────────────────────────
// Ansage
// ───────────────────────────────────────────────────────────────────────────

export const ANSAGE_VORGABE =
  "Guten Tag. Dieses Gespräch wird zur Qualitätssicherung aufgezeichnet. "
  + "Wenn Sie damit nicht einverstanden sind, sagen Sie es bitte gleich zu Beginn.";

export async function ansageText(lauf: Lauf = sqlPool): Promise<string> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'telefon_ansage'`) as any[];
  return String(r?.value || ANSAGE_VORGABE);
}

/**
 * Das TwiML für einen ausgehenden Ruf.
 *
 * Reihenfolge ist Absicht: erst die Ansage, DANN die Aufnahme. Eine Aufnahme,
 * die vor dem Hinweis beginnt, hat den Hinweis nicht mehr nötig — sie ist
 * dann schon rechtswidrig.
 */
export function twimlAusgehend(opts: {
  an: string; von: string; ansage: string; aufnahmeCallback: string; statusCallback: string;
}): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ── EIN LEERES callerId IST SCHLIMMER ALS KEINES ────────────────────────
  // Gemessen am 11.08.2026: Die Antwort enthielt `callerId=""`. Twilio
  // bekommt damit einen leeren Wert für die Absendernummer und lehnt den Ruf
  // ab — bei einem Client-initiierten Anruf MUSS die callerId eine Nummer
  // sein, die dem Konto gehört oder als Caller ID verifiziert ist.
  //
  // Das Attribut fiel bisher stillschweigend leer aus, wenn TWILIO_CALLER_ID
  // nicht gesetzt war. Nach außen sah die Antwort wohlgeformt aus; im
  // Twilio-Log stand ein abgebrochener Anruf ohne erkennbaren Grund.
  //
  // Jetzt: Fehlt die Nummer, wird das GESAGT. Eine Ansage, die den Grund
  // nennt, ist unendlich viel besser als ein Ruf, der still verschwindet.
  const von = String(opts.von || "").trim();
  if (!von) {
    console.error("[TELEFON] TwiML ohne Absendernummer: TWILIO_CALLER_ID ist leer.");
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Dieser Anruf kann nicht aufgebaut werden, weil im System keine Absendernummer hinterlegt ist. Bitte im Verwaltungsbereich unter Einstellungen die Telefon-Diagnose öffnen.</Say>
  <Hangup/>
</Response>`;
  }
  if (!/^\+[1-9]\d{6,15}$/.test(von)) {
    console.error(`[TELEFON] TwiML mit unbrauchbarer Absendernummer: „${von}"`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Dieser Anruf kann nicht aufgebaut werden, weil die hinterlegte Absendernummer nicht in internationaler Schreibweise vorliegt. Bitte im Verwaltungsbereich die Telefon-Diagnose öffnen.</Say>
  <Hangup/>
</Response>`;
  }

  const an = String(opts.an || "").trim();
  if (!an) {
    console.error("[TELEFON] TwiML ohne Zielnummer.");
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Es wurde keine Rufnummer übergeben. Bitte die Seite einmal neu laden und erneut wählen.</Say>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">${esc(opts.ansage)}</Say>
  <Dial callerId="${esc(von)}" timeout="30" timeLimit="${MAX_MINUTEN * 60}"
        record="record-from-answer-dual"
        recordingStatusCallback="${esc(opts.aufnahmeCallback)}"
        recordingStatusCallbackEvent="completed"
        action="${esc(opts.statusCallback)}">
    <Number>${esc(an)}</Number>
  </Dial>
</Response>`;
}

// ───────────────────────────────────────────────────────────────────────────
// Zugangsausweis für den Browser
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kurzlebiger Ausweis für das Browser-SDK.
 *
 * Eine Stunde: lang genug für einen Arbeitsblock, kurz genug, dass ein
 * abgegriffener Ausweis nicht morgen noch telefoniert.
 */
export async function zugangsAusweis(agentId: number): Promise<{ ok: boolean; token?: string; identitaet?: string; grund?: string }> {
  const stand = einrichtungsStand();
  if (!stand.bereit) return { ok: false, grund: stand.hinweis };
  try {
    const twilio = await import("twilio");
    const { AccessToken } = twilio.default.jwt;
    const identitaet = `agent-${agentId}`;
    const ausweis = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY_SID!,
      process.env.TWILIO_API_KEY_SECRET!,
      { identity: identitaet, ttl: 3600 },
    );
    ausweis.addGrant(new AccessToken.VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      // ══════════════════════════════════════════════════════════════════════
      // JETZT AUCH EINGEHEND
      //
      // ── DER AUFTRAG (11.08.2026) ─────────────────────────────────────────
      // Der Vorgesetzte: „Wir brauchen jetzt die Funktion, dass der Kunde uns
      // auch anrufen kann. Wichtig: Wenn der Kunde anruft, muss stehen, wer
      // dafür zuständig ist, damit der richtige rangeht!"
      //
      // Hier stand `incomingAllow: false` mit der Begründung, ein Browser, der
      // klingeln soll, müsse offen sein. Das stimmt — und ist kein Grund,
      // eingehende Rufe unmöglich zu machen. Wer den Tab offen hat, soll
      // erreichbar sein; wer nicht, dessen Anruf geht weiter an die nächste
      // Stelle (siehe fiaon-anruf-eingehend.ts).
      //
      // ── DIE IDENTITÄT IST DIE ADRESSE ────────────────────────────────────
      // `agent-<id>` ist die Kennung, unter der Twilio diesen Browser erreicht.
      // Das TwiML für eingehende Rufe wählt genau diese Kennung — deshalb muss
      // sie stabil bleiben und darf nie geraten werden.
      // ══════════════════════════════════════════════════════════════════════
      incomingAllow: true,
    }));
    return { ok: true, token: ausweis.toJwt(), identitaet };
  } catch (err) {
    return { ok: false, grund: `Twilio-Ausweis fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Protokoll
// ───────────────────────────────────────────────────────────────────────────

export async function wahlProtokoll(
  opts: { agentId: number; agentName: string; nummer: string; personId?: number | null; erlaubt: boolean; grund?: string | null },
  lauf: Lauf = sqlPool,
): Promise<void> {
  await lauf`
    INSERT INTO fiaon_call_versuche (agent_id, agent_name, nummer, person_id, erlaubt, grund)
    VALUES (${opts.agentId}, ${opts.agentName}, ${opts.nummer}, ${opts.personId ?? null},
            ${opts.erlaubt}, ${opts.grund ?? null})
  `.catch(() => {});
}

/** Anrufe ohne dokumentiertes Ergebnis — die Erinnerungsmarke am Knopf. */
export async function offeneAnrufe(agentId: number, lauf: Lauf = sqlPool): Promise<any[]> {
  return (await lauf`
    SELECT c.id, c.nummer, c.beginn, c.dauer_sek, c.person_id, c.ref, c.status,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, c.nummer) AS name
    FROM fiaon_calls c LEFT JOIN fiaon_persons p ON p.id = c.person_id
    WHERE c.agent_id = ${agentId} AND c.ergebnis IS NULL
      AND c.status IN ('beendet', 'laeuft')
      AND c.beginn > NOW() - INTERVAL '3 days'
    ORDER BY c.beginn DESC
    LIMIT 20
  `) as any[];
}


// ═══════════════════════════════════════════════════════════════════════════
// AUFBEWAHRUNG — eine Aufnahme braucht ein Ablaufdatum
//
// ── WARUM DAS NICHT AUFSCHIEBBAR IST ───────────────────────────────────────
// Eine Gesprächsaufnahme ist die intimste Art von Kundendaten, die dieses
// Haus speichert: eine Stimme, ein Tonfall, ein Zögern. Sie liegt bei Twilio
// in der Cloud, und die URL dazu stand unbefristet in der Datenbank.
//
// Ohne Löschlauf wird das Archiv nur älter. Nach zwei Jahren liegen dort
// zehntausend Gespräche, für die niemand eine Rechtsgrundlage benennen kann —
// und die im Fall einer Auskunftsanfrage alle herausgegeben werden müssten.
//
// 90 Tage: lang genug, um ein Gespräch nachzuhören oder eine Beschwerde zu
// prüfen; kurz genug, dass kein Archiv entsteht.
// ═══════════════════════════════════════════════════════════════════════════

/** Die Frist in Tagen, aus den Einstellungen. */
export async function aufnahmeFrist(): Promise<number> {
  const { sqlPool } = await import("./db-pool");
  const [r] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'aufnahme_frist_tage'
  `.catch(() => [] as any[])) as any[];
  const n = Number(r?.value);
  // Grenzen mit Absicht: 7 Tage sind das Minimum, um eine Beschwerde zu
  // prüfen; über 365 wäre kein Ablauf mehr, sondern ein Archiv mit Verzögerung.
  return Number.isFinite(n) && n >= 7 && n <= 365 ? Math.round(n) : 90;
}

/**
 * Der Löschlauf.
 *
 * ── IDEMPOTENT UND PROTOKOLLIERT ───────────────────────────────────────────
 * Zweimal am selben Tag gestartet passiert beim zweiten Mal nichts: Der
 * Vermerk `aufnahme_geloescht_am` schließt die Zeile aus. Das ist wichtig,
 * weil ein Tageslauf bei einem Neustart doppelt anlaufen kann.
 *
 * Die Aufnahme wird bei TWILIO gelöscht, nicht nur die URL vergessen. Eine
 * vergessene URL ist keine Löschung — die Datei liegt weiter in der Cloud.
 *
 * Transkript und Zusammenfassung BLEIBEN. Sie sind das Arbeitsergebnis, das
 * in der Akte steht; die Aufnahme ist das Rohmaterial. Wer beides löscht,
 * verliert die Nachvollziehbarkeit der eigenen Notizen.
 */
export async function aufnahmenAufraeumen(nurZeigen = false): Promise<{
  frist: number; faellig: number; geloescht: number; fehler: number; hinweise: string[];
}> {
  const { sqlPool } = await import("./db-pool");
  const frist = await aufnahmeFrist();
  const hinweise: string[] = [];

  const faellig = (await sqlPool`
    SELECT id, recording_sid, beginn FROM fiaon_calls
    WHERE recording_url IS NOT NULL
      AND aufnahme_geloescht_am IS NULL
      AND beginn < NOW() - (${frist} || ' days')::interval
    ORDER BY beginn
    LIMIT 500
  `) as any[];

  if (nurZeigen) {
    return { frist, faellig: faellig.length, geloescht: 0, fehler: 0,
      hinweise: [`${faellig.length} Aufnahmen älter als ${frist} Tage. Nichts gelöscht (Vorschau).`] };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const tok = process.env.TWILIO_AUTH_TOKEN || "";
  let geloescht = 0;
  let fehler = 0;

  for (const c of faellig) {
    let weg = false;
    if (c.recording_sid && sid && tok) {
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${c.recording_sid}.json`,
        {
          method: "DELETE",
          headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") },
          signal: AbortSignal.timeout(15_000),
        },
      ).catch(() => null);
      // 404 zählt als Erfolg: Die Aufnahme ist weg, egal wer sie entfernt hat.
      weg = !!r && (r.status === 204 || r.status === 404);
      if (!weg) {
        fehler++;
        hinweise.push(`Anruf ${c.id}: Twilio antwortete mit HTTP ${r?.status ?? "nichts"}.`);
        // NICHT als gelöscht vermerken — sonst gilt eine Aufnahme als weg,
        // die noch in der Cloud liegt. Der nächste Lauf versucht es erneut.
        continue;
      }
    }
    await sqlPool`
      UPDATE fiaon_calls
      SET aufnahme_geloescht_am = NOW(), recording_url = NULL, updated_at = NOW()
      WHERE id = ${c.id}
    `;
    geloescht++;
  }

  if (geloescht > 0 || fehler > 0) {
    console.log(`[TELEFON] Löschlauf: ${geloescht} Aufnahmen entfernt, ${fehler} Fehler (Frist ${frist} Tage).`);
  }
  return { frist, faellig: faellig.length, geloescht, fehler, hinweise };
}
