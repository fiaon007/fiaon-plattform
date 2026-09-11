// ═══════════════════════════════════════════════════════════════════════════
// EINE TÜR FÜR JEDE MAIL
//
// Vor diesem Paket gab es 25 Stellen, die `sendMakeWebhook` direkt riefen —
// ohne Protokoll, ohne Zustandsprüfung, ohne Tageslimit. Danach wusste
// niemand, was rausgegangen war: Der Vorgesetzte suchte im Make-Protokoll, der
// Agent riet.
//
// Diese Funktion ist die Tür. Sie prüft (darf das raus?), sie sendet, sie
// protokolliert, sie schreibt in die Akte, sie merkt sich den Auslöser. Wer
// an ihr vorbeisendet, sendet unbeobachtet — und der Prüfstand meldet es.
//
// Die REGELN stehen woanders und werden hier nur angewandt:
//   Was es gibt        server/lib/fiaon-mail-events.ts (Registry)
//   Wann es darf       server/lib/fiaon-versand.ts (Zustand, Tageslimit)
//   Wie protokolliert  server/lib/fiaon-mail-log.ts
// ═══════════════════════════════════════════════════════════════════════════

import { paketPreisCents } from "@shared/fiaon-pakete";
import { sqlPool } from "./db-pool";
import { mailEvent, type Rolle } from "./fiaon-mail-events";
import { versendenUndProtokollieren, type VersandStatus } from "./fiaon-mail-log";
import { versandErlaubt, type VersandArt } from "./fiaon-versand";
import { terminLink } from "./fiaon-termine";
import type { MakeEventType } from "../make-webhook";

type Lauf = typeof sqlPool;

export interface SendeErgebnis {
  ok: boolean;
  status: VersandStatus | "abgelehnt";
  grund: string | null;
  meldung: string;
}

export interface SendeEingabe {
  event: MakeEventType | string;
  /** Der Mensch, an den es geht. Fehlt er, ist es eine Mitarbeiter-Mail. */
  personId?: number | null;
  /** Zusätzliche oder überschreibende Felder für die Payload. */
  zusatz?: Record<string, unknown>;
  /** Wer sendet — für Rechteprüfung, Protokoll und Akte. */
  akteur: { name: string; agentId: number | null; rolle: Rolle };
  /**
   * Empfänger OHNE Person im Haus (11.09.2026, E-177): ein Bewerber, der kein
   * Kunde ist. Die Nutzlast kommt vollständig aus `zusatz`; Zustandsregeln
   * gibt es nicht, weil es keinen Kundenzustand gibt. Protokolliert wird wie
   * jede andere Mail (fiaon_mail_log, person_id leer). Nur wirksam, wenn
   * keine personId angegeben ist.
   */
  ohnePerson?: { email: string };
  /** Prüfversand: geht an die Testadresse und zählt nicht gegen Limits. */
  test?: boolean;
  testAdresse?: string;
  lauf?: Lauf;
}

/**
 * Baut die Payload aus dem, was das Haus über den Kunden weiß.
 *
 * Bewusst hier und nicht in den 25 Aufrufern: Dort stand jedes Mal eine etwas
 * andere Zusammenstellung, und ein fehlendes Feld fiel erst auf, wenn eine
 * Mail beim Kunden mit „Hallo {{ params.vorname }}" ankam.
 */
async function payloadFuer(personId: number, lauf: Lauf): Promise<Record<string, unknown> | null> {
  const [p] = (await lauf`
    SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS email,
           COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', NULLIF(ag.first_name, ''), NULLIF(ag.last_name, '')))) AS agent_vorname,
           (SELECT a2.ref FROM fiaon_applications a2
             WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
             ORDER BY a2.created_at DESC LIMIT 1) AS ref,
           (SELECT a3.payment_reference FROM fiaon_applications a3
             WHERE a3.person_id = p.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
             ORDER BY a3.created_at DESC LIMIT 1) AS zahlungsreferenz,
           (SELECT a4.amount_due FROM fiaon_applications a4
             WHERE a4.person_id = p.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
             ORDER BY a4.created_at DESC LIMIT 1) AS betrag,
           (SELECT a4.pack_key FROM fiaon_applications a4
             WHERE a4.person_id = p.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
             ORDER BY a4.created_at DESC LIMIT 1) AS pack_key,
           (SELECT a5.pack_name FROM fiaon_applications a5
             WHERE a5.person_id = p.id AND a5.merged_into IS NULL AND a5.archived_at IS NULL
             ORDER BY a5.created_at DESC LIMIT 1) AS paket
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!p) return null;
  return {
    email: String(p.email || ""),
    vorname: p.vorname || null,
    nachname: p.nachname || null,
    antrag_id: p.ref || undefined,
    payment_reference: p.zahlungsreferenz || null,
    // ── DER BETRAG KOMMT AUS DEM KATALOG, NICHT AUS DEM ALTEN BESTELLFELD (11.09.2026, E-181) ──
    // Ilijana Weber bekam am 09.09. DREI Mails mit 79,99 €: die Ratenerinnerung
    // (E-173 hat sie repariert) — und zwei Terminmails, die denselben `betrag`
    // aus `amount_due` der Bestellung nehmen. Ihr Paket ist High-End, 99,99 €;
    // das Feld trug den Wert aus der Stripe-Aera. Drei High-End-Bestellungen
    // tragen 79,99 €, jede Mail mit Betrag haette es wiederholt.
    // Regel: Ist das Paket bekannt, gilt der Katalogpreis. Das Bestellfeld ist
    // nur noch der Rueckfall fuer Bestellungen ohne Paket — und weicht es ab,
    // steht es im Protokoll, damit es jemand geraderueckt.
    betrag: (() => {
      const katalog = paketPreisCents(p.pack_key);
      const feld = p.betrag != null ? Math.round(Number(p.betrag) * 100) : null;
      if (katalog > 0 && feld != null && feld !== katalog) {
        console.warn(`[MAIL] Betrag der Bestellung ${p.ref} weicht vom Katalog ab: ${(feld / 100).toFixed(2)} € statt ${(katalog / 100).toFixed(2)} € (${p.pack_key}) — Katalog gilt.`);
      }
      const cents = katalog > 0 ? katalog : feld;
      return cents != null ? (cents / 100).toFixed(2) : null;
    })(),
    paket: p.paket ? String(p.paket).split("\n")[0].trim() : null,
    // Kunden werden gesiezt — auch im Notnagel, wenn kein Betreuer zugewiesen ist.
    agent_vorname: p.agent_vorname || "Ihr Ansprechpartner",
    _ref: p.ref || null,
  };
}

/**
 * Baut die KOMPLETTE Nutzlast eines Ereignisses für eine Person — Basisdaten
 * plus die Links, die nur der Server bauen kann.
 *
 * Eine Funktion für Versand UND Vorschau (28.08.2026): Die Vorschau in der
 * Akte zeigt nur dann garantiert das, was rausgeht, wenn beide dieselbe
 * Zusammenstellung nehmen. Zwei Fassungen wären der sichere Weg zu einer
 * Vorschau, die lügt.
 */
export async function sendePayloadBauen(
  eventType: string,
  personId: number,
  lauf: Lauf = sqlPool,
): Promise<{ basis: Record<string, unknown>; links: Record<string, unknown>; ref: string | null; fehler?: string } | null> {
  const basis = await payloadFuer(personId, lauf);
  if (!basis) return null;

  // ══════════════════════════════════════════════════════════════════════════
  // DIE RATENERINNERUNG SPRICHT ÜBER DIE RATE, NICHT ÜBER DIE BESTELLUNG
  // (10.09.2026, E-173)
  //
  // ── DER BEFUND ───────────────────────────────────────────────────────────
  // `payloadFuer` nimmt `betrag` aus `fiaon_applications.amount_due` — dem Preis
  // der BESTELLUNG — und `payment_reference` aus derselben Zeile. Für jedes
  // andere Ereignis ist das richtig. Für `abo_payment_reminder` ist es falsch,
  // denn diese Mail meint eine bestimmte MONATSRATE.
  //
  // Was dabei herauskam, steht im Protokoll: Ilijana Weber bekam am 09.09. um
  // 18:55 von Hand eine Erinnerung über 79,99 €, während ihre offene Rate 2
  // 99,99 € beträgt — der automatische Lauf hatte ihr sieben Tage zuvor
  // korrekt 99,99 € geschrieben. Drei weitere Kunden wurden zur Zahlung von
  // 74,00 € aufgefordert; das ist der Preis der Bonitätsauskunft, nicht ihre
  // Rate. In keiner dieser Mails stand eine Ratennummer, und als
  // Verwendungszweck stand die Bestellreferenz statt der RATENreferenz
  // (FIAON-5BNPWZ statt FIAON-5BNPWZ-2) — eine Überweisung darauf hätte sich
  // keiner Rate zuordnen lassen.
  //
  // ── DIE REGEL ────────────────────────────────────────────────────────────
  // Dieses Ereignis baut seinen Inhalt aus der offenen Rate, mit derselben
  // Funktion wie der automatische Takt (`aboErinnerungPayload`). Weil diese
  // Funktion Vorschau UND Versand speist, sieht der Mitarbeiter ab sofort
  // genau das, was rausgeht. Gibt es keine offene Rate, wird nicht gesendet:
  // Eine Mahnung ohne Forderung ist schlimmer als keine Mahnung.
  // ══════════════════════════════════════════════════════════════════════════
  if (eventType === "abo_payment_reminder") {
    const { offeneRateFuerErinnerung, aboErinnerungPayload } = await import("../routes/fiaon-abo");
    const rate = await offeneRateFuerErinnerung(personId);
    if (!rate) {
      return {
        basis: basis as Record<string, unknown>, links: {}, ref: (basis as any)._ref ?? null,
        fehler: "Bei diesem Kunden ist gerade keine Rate offen. Es gibt nichts zu erinnern.",
      };
    }
    const ausRate = aboErinnerungPayload(rate) as Record<string, unknown>;
    const ref = (basis as any)._ref as string | null;
    delete (basis as any)._ref;
    return {
      // Die Rate schlägt die Bestellung. Nur die Adresse bleibt die des
      // Kunden — `payloadFuer` löst sie über die Person auf und findet sie
      // auch dann, wenn an der Bestellung keine steht.
      basis: { ...basis, ...ausRate, email: ausRate.email || (basis as any).email },
      links: {},
      ref: (rate.ref as string) || ref,
    };
  }

  // Links, die nur der Server bauen kann.
  const links: Record<string, unknown> = {};
  // ── HERKUNFT STATT FOLGENLOSER QUELLE (24.08.2026) ────────────────────────
  // VORHER stand hier „onboarding_call" — eine QUELLE, die `terminLink` mit
  // `void quelle;` weggeworfen hat. NACHHER trägt der zweite Parameter die
  // HERKUNFT und landet als `?von=` im Link; die Gesprächsart bleibt abgeleitet.
  if (eventType === "nicht_erreicht_termin") links.termin_link = terminLink(personId, "nicht_erreicht_mail");
  if (eventType === "onboarding_einladung") links.termin_link = terminLink(personId, "onboarding_einladung");
  // NEU 24.08.2026: Auch die No-Show-Mail trägt einen Buchungslink (Herkunft
  // statt folgenloser Quelle; Datum/Uhrzeit liefert nur der automatische Weg).
  if (eventType === "termin_verpasst") links.termin_link = terminLink(personId, "termin_verpasst_mail");

  const ref = (basis as any)._ref as string | null;
  delete (basis as any)._ref;
  return { basis: basis as Record<string, unknown>, links, ref };
}

/**
 * Die Vorschau: exakt die Mail, die `mailSenden` verschicken würde — gleiche
 * Nutzlast, gleiche Vorlage, gleiche Renderfunktion (Mail-Motor).
 *
 * Justins Auftrag 28.08.2026: „bevor man sie versendet soll es eine Vorschau
 * geben damit der Mitarbeiter sieht was er verschickt."
 */
export async function mailVorschau(ein: {
  event: string;
  personId: number;
  rolle: Rolle;
  zusatz?: Record<string, unknown>;
  lauf?: Lauf;
}): Promise<
  | { ok: true; betreff: string; html: string; empfaenger: string; absender: { name: string; email: string }; fehlend: string[] }
  | { ok: false; grund: string }
> {
  const lauf = ein.lauf ?? sqlPool;
  const def = await mailEvent(String(ein.event), lauf);
  if (!def) return { ok: false, grund: `Unbekanntes Ereignis „${ein.event}“.` };
  if (def.deprecated) return { ok: false, grund: `„${def.label}“ ist abgelöst.` };
  if (!def.rollen.includes(ein.rolle)) return { ok: false, grund: `Deine Rolle darf „${def.label}“ nicht senden.` };

  const gebaut = await sendePayloadBauen(def.type, ein.personId, lauf);
  if (!gebaut) return { ok: false, grund: "Kunde nicht gefunden." };
  if (gebaut.fehler) return { ok: false, grund: gebaut.fehler };
  const zusatz = await partnerLinkErgaenzen(def.type, ein.personId, (ein as any).agentId ?? null, ein.zusatz, lauf);
  const payload = { ...gebaut.basis, ...gebaut.links, ...zusatz };

  const { mailRendern } = await import("../mail/motor");
  const mail = mailRendern(def.type, payload);
  if (!mail) return { ok: false, grund: `Für „${def.label}“ gibt es noch keine Quelltext-Vorlage.` };
  return {
    ok: true,
    betreff: mail.betreff,
    html: mail.html,
    empfaenger: String(payload.email || ""),
    absender: mail.absender,
    fehlend: mail.fehlend,
  };
}

/**
 * Sendet eine Mail — der EINZIGE Weg im Haus.
 *
 * Wirft nie. Ein Versand, der einen Vorgang zum Absturz bringt, ist teurer als
 * eine Mail, die nicht rausgeht.
 */
// ── DER PARTNERLINK GEHÖRT ZUR NUTZLAST, NICHT ZUM AUFRUFER (05.09.2026) ──
// Justin: „Die Mail kommt so beim Kunden an, ohne Button, ohne Link." Vier
// Konto-und-Karte-Mails (01.09. und 05.09.) gingen über „Vorlage aus der Akte
// senden" raus — dieser Weg kannte den Link nicht, nur der Knopf im
// Onboarding-Raum brachte ihn als Zusatz mit. Der Motor lässt einen Knopf ohne
// Ziel weg, also stand der Kunde ohne Weg zur Bank da. Jetzt baut der Versand
// den Link selbst, mit Kunden- und Mitarbeiterkennung — für jeden Weg.
async function partnerLinkErgaenzen(
  eventType: string, personId: number | null, agentId: number | null | undefined, zusatz: Record<string, unknown> | undefined, lauf: Lauf,
): Promise<Record<string, unknown>> {
  const z = { ...(zusatz || {}) };
  if (eventType !== "konto_karte_einladung" || !personId || String(z.partner_link || "").trim()) return z;
  try {
    const { partnerLink } = await import("./fiaon-konto-karte");
    let wer = agentId ?? null;
    if (!wer) {
      const [p] = (await lauf`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${personId} LIMIT 1`.catch(() => [] as any[])) as any[];
      wer = p?.assigned_agent_id ? Number(p.assigned_agent_id) : null;
    }
    z.partner_link = partnerLink(personId, wer);
  } catch (e) { console.error("[MAIL] partner_link:", String(e).slice(0, 120)); }
  return z;
}

export async function mailSenden(ein: SendeEingabe): Promise<SendeErgebnis> {
  const lauf = ein.lauf ?? sqlPool;
  const abgelehnt = (grund: string): SendeErgebnis =>
    ({ ok: false, status: "abgelehnt", grund, meldung: grund });

  const def = await mailEvent(String(ein.event), lauf);
  if (!def) return abgelehnt(`Unbekanntes Ereignis „${ein.event}“.`);
  if (def.deprecated) return abgelehnt(`„${def.label}“ ist abgelöst und wird nicht mehr versendet.`);
  if (!def.rollen.includes(ein.akteur.rolle)) {
    return abgelehnt(`Deine Rolle darf „${def.label}“ nicht senden.`);
  }

  // ── Prüfversand ────────────────────────────────────────────────────────
  // Geht an die Testadresse, prüft KEINEN Kundenzustand (es gibt keinen
  // Kunden) und zählt nicht gegen Tageslimits.
  if (ein.test) {
    const an = String(ein.testAdresse || "").trim();
    if (!an) return abgelehnt("Keine Testadresse hinterlegt.");
    const erg = await versendenUndProtokollieren(
      def.type as MakeEventType,
      { ...(def.example as Record<string, unknown>), ...(ein.zusatz || {}), email: an, test: true } as any,
      { personId: null, ausgeloestVon: ein.akteur.name, ausgeloestAgentId: ein.akteur.agentId, lauf },
    );
    await lauf`
      UPDATE fiaon_mail_log SET art = 'test'
      WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE event = ${def.type})
    `.catch((e) => console.error(`[MAIL] Testmarke fuer ${def.type} nicht gesetzt — die Sendung zaehlt damit als echt:`, e));
    return {
      ok: erg.status === "versandt", status: erg.status, grund: erg.grund,
      meldung: erg.status === "versandt" ? `Prüfversand an ${an} raus.` : `Prüfversand fehlgeschlagen: ${erg.grund}`,
    };
  }

  // ── Echter Versand an einen Menschen ohne Person (E-177) ───────────────
  if (!ein.personId && ein.ohnePerson) {
    const an = String(ein.ohnePerson.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(an)) return abgelehnt("Keine gültige E-Mail-Adresse.");
    const erg = await versendenUndProtokollieren(
      def.type as MakeEventType,
      { ...(ein.zusatz || {}), email: an } as any,
      { personId: null, ausgeloestVon: ein.akteur.name, ausgeloestAgentId: ein.akteur.agentId, lauf },
    );
    return {
      ok: erg.status === "versandt", status: erg.status, grund: erg.grund,
      meldung: erg.status === "versandt"
        ? `„${def.label}“ an ${an} verschickt.`
        : `Nicht verschickt: ${erg.grund}. Es steht mit Grund im Protokoll.`,
    };
  }

  // ── Echter Versand ─────────────────────────────────────────────────────
  if (!ein.personId) return abgelehnt("Kein Empfänger angegeben.");

  // Die Zustandsregeln kennt fiaon-versand.ts. Ereignisse, die dort keine
  // eigene Regel haben, kommen durch — sie sind vom Vorgesetzten ausgelöste
  // Einzelfälle (Storno, DSGVO), bei denen der Mensch die Lage kennt.
  // VORHER 24.08.2026: ohne "termin_verpasst" — die Art gab es nicht.
  // NACHHER: mit. Ihre Regel in fiaon-versand.ts lässt sie bewusst durch,
  // auch wenn ein Termin existiert (beim No-Show existiert er ja).
  // GRUND: Auftrag des Inhabers vom 24.08.2026.
  const mitRegel: VersandArt[] = [
    "payment_details", "welcome", "nicht_erreicht_termin", "onboarding_einladung",
    "termin_verpasst", "number_update_request",
  ];
  if (mitRegel.includes(def.type as VersandArt)) {
    const pruefung = await versandErlaubt(ein.personId, def.type as VersandArt, lauf);
    if (!pruefung.erlaubt) return abgelehnt(pruefung.grund || "Nicht erlaubt.");
  }

  const gebaut = await sendePayloadBauen(def.type, ein.personId, lauf);
  if (!gebaut) return abgelehnt("Kunde nicht gefunden.");
  // E-173: Eine Ratenerinnerung ohne offene Rate geht nicht raus.
  if (gebaut.fehler) return abgelehnt(gebaut.fehler);
  const { basis, links, ref } = gebaut;
  if (!basis.email) return abgelehnt("Keine E-Mail-Adresse hinterlegt.");

  const zusatz = await partnerLinkErgaenzen(def.type, ein.personId, ein.akteur.agentId, ein.zusatz, lauf);
  const erg = await versendenUndProtokollieren(
    def.type as MakeEventType,
    { ...basis, ...links, ...zusatz } as any,
    {
      personId: ein.personId,
      verlaufRef: ref,
      verlaufText: `${def.label} versandt${ein.akteur.agentId ? ` (von ${ein.akteur.name})` : ""}.`,
      ausgeloestVon: ein.akteur.name,
      ausgeloestAgentId: ein.akteur.agentId,
      lauf,
    },
  );
  return {
    ok: erg.status === "versandt",
    status: erg.status,
    grund: erg.grund,
    meldung: erg.status === "versandt"
      ? `„${def.label}“ an ${basis.email} verschickt.`
      : `Nicht verschickt: ${erg.grund}. Es steht mit Grund im Protokoll.`,
  };
}
