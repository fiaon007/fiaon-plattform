// ═══════════════════════════════════════════════════════════════════════════
// VERPFLICHTUNGSERKLÄRUNG DER VERTRIEBSLEITUNG
//
// Wer den Bereich „Vertrieb" öffnet, sieht ALLE Kundendaten des Unternehmens —
// Namen, Rufnummern, Adressen, Geburtsdaten, Beträge, Gesprächsverläufe. Das ist
// eine andere Größenordnung als der eigene Bestand, und sie ist rechtlich eine
// andere Sache: Ab hier verarbeitet jemand personenbezogene Daten von Menschen,
// die ihn nie beauftragt haben.
//
// WARUM DIESE DATEI EXISTIERT
// Eine Rolle zu vergeben und zu hoffen, dass die Verantwortung mitwächst, ist
// keine Grundlage. Deshalb steht vor dem ersten Blick in die Daten eine
// Erklärung, die gelesen und ausdrücklich angenommen werden muss. Ohne Annahme
// liefert KEIN Endpunkt des Bereichs Daten aus (403). Das ist kein Vorhang: Die
// Prüfung sitzt in derselben Kette wie die Rollenprüfung, im Server.
//
// WARUM DER TEXT HIER LIEGT UND NICHT IN DER OBERFLÄCHE
// Der Nachweis muss belegen, WAS jemand angenommen hat. Läge der Text im
// Client, könnte später niemand mehr sagen, welche Fassung auf dem Bildschirm
// stand. Also: EINE Quelle, ein Prüfwert (SHA-256) über genau diese Fassung, und
// beides wird mit der Annahme gespeichert. Ändert sich der Text, ändert sich der
// Prüfwert und die Fassung — dann wird erneut gefragt. Eine stillschweigend
// geänderte Erklärung wäre wertlos.
//
// HINWEIS AN DEN BETREIBER
// Dieser Text ist als betriebliche Verpflichtungserklärung formuliert (Weisung
// und Vertraulichkeit im Sinne von Art. 29, 32 DSGVO, § 53 BDSG). Er ist keine
// Rechtsberatung. Vor dem breiten Einsatz sollte ihn jemand mit
// arbeitsrechtlicher Zulassung gegenlesen — insbesondere die Abschnitte zu
// Haftung und Folgen, weil deren Reichweite von der Vertragsart abhängt
// (Angestellter, freier Handelsvertreter, Werkvertrag).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";

/**
 * Fassung der Erklärung. Wird sie erhöht, muss JEDER erneut annehmen — auch wer
 * die alte Fassung schon angenommen hat. Datum im Namen, damit in Protokollen
 * ohne Nachschlagen erkennbar ist, wann diese Fassung galt.
 */
export const ZUSAGE_VERSION = "2.0-2026-08-06";

/**
 * Bereiche mit eigener Verpflichtungserklärung.
 *
 * Die Maschinerie darunter ist dieselbe — Fassung, Prüfwert, getippter Name,
 * Roboterabwehr, Widerruf. Nur der TEXT unterscheidet sich, weil sich die
 * Verantwortung unterscheidet: Die Vertriebsleitung sieht den ganzen Bestand
 * und bucht Geld, das Onboarding führt Gespräche und sieht Lagebilder.
 *
 * Eine zweite Kopie dieser Datei für den zweiten Bereich wäre der Anfang vom
 * Auseinanderlaufen: Sobald jemand die Roboterabwehr an einer Stelle
 * verbessert, fehlt sie an der anderen.
 */
export type ZusageBereich = "vertrieb" | "onboarding" | "inkasso";
// Fassung 2.0 (noch am selben Tag): Die Vertriebsleitung darf jetzt Zahlungen
// buchen, Unterlagen-Stände und Zugangsprobleme einsehen. Genau dafür ist die
// Versionierung da — Fassung 1.0 verbot das Buchen ausdrücklich, wer sie
// angenommen hat, hat einer anderen Abmachung zugestimmt. Deshalb wird erneut
// gefragt, statt die alte Zusage stillschweigend auszuweiten.

export interface ZusageText {
  version: string;
  ueberschrift: string;
  gratulation: string;
  einleitung: string;
  /** Was der Bereich kann — kurz, damit die Einführung nicht im Rechtstext untergeht. */
  kann: { titel: string; text: string }[];
  /** Was ausdrücklich NICHT geht. Grenzen zu kennen ist Teil der Verantwortung. */
  kannNicht: string[];
  /** Die eigentlichen Zusagen, nummeriert. */
  pflichten: { nr: number; titel: string; text: string }[];
  schlusssatz: string;
  hinweisProtokoll: string;
}

export const ZUSAGE_TEXT: ZusageText = {
  version: ZUSAGE_VERSION,
  ueberschrift: "Vertriebsleitung",
  gratulation: "Glückwunsch — dir ist die Vertriebsleitung übertragen.",
  einleitung:
    "Das ist eine Auszeichnung und eine Verpflichtung. Ab jetzt siehst du nicht mehr nur deine "
    + "eigenen Kunden, sondern alle Kunden des Unternehmens: Namen, Rufnummern, Adressen, Beträge "
    + "und Gesprächsverläufe von Menschen, die dich nicht kennen. Sie haben uns ihre Daten "
    + "gegeben, weil sie uns vertrauen. Dieses Vertrauen liegt ab heute auch in deiner Hand. "
    + "Bevor du den Bereich öffnest, lies bitte die folgende Erklärung und nimm sie an.",
  kann: [
    {
      titel: "Alle Kunden sehen",
      text: "Eine Tabelle über den gesamten Bestand: Status, zuständiger Mitarbeiter, dokumentierter "
        + "Betreuer, letzter Kontakt, Zusagedatum und Betrag. Mit denselben Filtern wie in der "
        + "Kundenliste, zusätzlich nach Mitarbeiter.",
    },
    {
      titel: "Kunden zuweisen",
      text: "Einzeln oder als Mehrfachauswahl. Eine Zuweisung verschiebt die Zuständigkeit, nicht "
        + "den Provisionsanspruch — der folgt dem dokumentierten Kontakt.",
    },
    {
      titel: "Stammdaten berichtigen",
      text: "Name, Rufnummer, E-Mail und Adresse. Jede Änderung wird mit altem und neuem Wert "
        + "protokolliert.",
    },
    {
      titel: "Dokumentieren und sperren",
      text: "Ergebnisse festhalten wie ein Mitarbeiter, Zahlungsdaten senden, einen Kunden sperren "
        + "oder entsperren.",
    },
    {
      titel: "Zahlungen prüfen und buchen",
      text: "Offene Zahlungen mit Verwendungszweck, Betrag und Frist, dazu die passenden Bankeingänge. "
        + "Stimmt der Nachweis, setzt du den Kunden selbst auf „bezahlt“ — das schaltet sein Konto frei "
        + "und schickt ihm die Bestätigung. Jede Buchung verlangt einen benannten Nachweis und das "
        + "tatsächliche Eingangsdatum.",
    },
    {
      titel: "Unterlagen-Stand sehen",
      text: "Bei welchen bezahlten Kunden noch Ausweis, Kontoauszug oder SCHUFA-Auskunft fehlt. Du "
        + "siehst, WAS fehlt — die Dokumente selbst bleiben beim Vorgesetzter.",
    },
    {
      titel: "Zugangsprobleme klären",
      text: "Warum ein Kunde nicht in sein Konto kommt: kein Passwort gesetzt, Zahlung noch offen, Konto "
        + "gesperrt. Die Auskunft stammt aus derselben Prüfung wie der echte Login, dazu der konkrete "
        + "nächste Schritt für das Telefonat.",
    },
  ],
  kannNicht: [
    "Eine Buchung zurücknehmen, stornieren oder erstatten — wer buchen darf, darf nicht spurlos zurückbuchen.",
    "Provisionen, Provisionssätze oder Auszahlungen ändern.",
    "Kundendokumente öffnen oder herunterladen (Ausweis, Kontoauszug, SCHUFA) — sichtbar ist nur, ob sie vorliegen.",
    "Passwörter von Kunden setzen oder einsehen.",
    "Mitarbeiter anlegen, löschen oder deren Rolle ändern.",
    "Bankdaten anderer Mitarbeiter einsehen.",
  ],
  pflichten: [
    {
      nr: 1,
      titel: "Zweckbindung",
      text: "Ich greife auf Kundendaten ausschließlich zu, soweit es für die Betreuung und Steuerung "
        + "des Vertriebs von FIAON erforderlich ist. Ich sehe keine Daten aus Neugier an und suche "
        + "nicht nach Personen, mit denen ich privat zu tun habe.",
    },
    {
      nr: 2,
      titel: "Vertraulichkeit",
      text: "Ich gebe Kundendaten an niemanden weiter — auch nicht an Kollegen ohne Zuständigkeit, "
        + "nicht an Familie, nicht an Dritte. Ich erstelle keine Kopien, Listen, Fotos, "
        + "Bildschirmaufnahmen oder Exporte außerhalb der Plattform und speichere keine Kundendaten "
        + "auf privaten Geräten oder in privaten Cloud-Diensten. Diese Pflicht gilt unbefristet und "
        + "auch nach dem Ende meiner Tätigkeit weiter.",
    },
    {
      nr: 3,
      titel: "Weisungsgebundenheit",
      text: "Ich verarbeite die Daten nur im Rahmen der Weisungen des Vorgesetzten. Bin ich unsicher, "
        + "ob eine Handlung erlaubt ist, frage ich vorher nach, statt es zu versuchen.",
    },
    {
      nr: 4,
      titel: "Keine Selbstbevorteilung",
      text: "Ich nutze Zuweisungen nicht, um mir oder anderen Provisionsansprüche zu verschaffen oder "
        + "zu entziehen. Mir ist bekannt, dass der Anspruch dem dokumentierten Kontakt folgt und dass "
        + "jede Zuweisung mit meinem Namen protokolliert wird.",
    },
    {
      nr: 5,
      titel: "Grenzen der Rolle",
      text: "Ich ändere keine Provisionen, storniere keine Buchungen, öffne keine Kundendokumente und "
        + "lege keine Zugänge an. Ich versuche nicht, diese Grenzen technisch oder über andere Personen "
        + "zu umgehen.",
    },
    {
      nr: 6,
      titel: "Zahlungen nur mit Nachweis",
      text: "Ich setze einen Kunden ausschließlich dann auf „bezahlt“, wenn mir der Geldeingang belegt "
        + "ist — durch einen Bankeingang mit passendem Verwendungszweck oder durch einen "
        + "Überweisungsbeleg, den ich selbst gesehen habe. Ich trage das tatsächliche Eingangsdatum ein, "
        + "nicht das Datum meines Klicks, und beschreibe wahrheitsgemäß, was ich geprüft habe. Mir ist "
        + "bewusst, dass eine Buchung das Konto freischaltet, eine Kundenmail auslöst, die Ratenkette "
        + "startet und eine Provision bucht.",
    },
    {
      nr: 7,
      titel: "Keine Buchung im eigenen Interesse",
      text: "Ich buche keine Zahlung, um einen Abschluss, eine Provision, eine Rangliste oder eine "
        + "Zielerreichung zu beeinflussen — weder für mich noch für andere. Bin ich mir beim Nachweis "
        + "nicht sicher, buche ich nicht, sondern frage nach. Jede Buchung wird protokolliert und vom "
        + "Vorgesetzter gegen den Kontoeingang geprüft.",
    },
    {
      nr: 8,
      titel: "Sorgfalt gegenüber Kunden",
      text: "Was ich einem Kunden über Zahlungen, Fristen oder Verträge sage, muss der Wahrheit "
        + "entsprechen. Ich mache keine Zusagen, die durch den tatsächlichen Sachstand nicht gedeckt "
        + "sind, und dokumentiere Gespräche wahrheitsgemäß.",
    },
    {
      nr: 9,
      titel: "Meldepflicht",
      text: "Bemerke ich einen möglichen Datenschutzvorfall — verlorenes oder gestohlenes Gerät, "
        + "Fehlversand, unbefugter Zugriff, offener Zugang — melde ich das unverzüglich, spätestens "
        + "innerhalb von 24 Stunden, an die Geschäftsführung. Auch einen Verdacht melde ich; die "
        + "Bewertung ist nicht meine Aufgabe.",
    },
    {
      nr: 10,
      titel: "Zugangsschutz",
      text: "Mein Zugang ist persönlich. Ich gebe Passwort und Sitzung an niemanden weiter, lasse "
        + "kein Gerät unbeaufsichtigt eingeloggt und nutze für die Plattform kein gemeinsam genutztes "
        + "Konto.",
    },
    {
      nr: 11,
      titel: "Folgen von Verstößen",
      text: "Mir ist bewusst, dass Verstöße arbeits- beziehungsweise vertragsrechtliche Folgen bis zur "
        + "Beendigung des Verhältnisses haben können und dass bei Vorsatz oder grober Fahrlässigkeit "
        + "eine Haftung für entstandene Schäden nach den gesetzlichen Regeln in Betracht kommt. "
        + "Datenschutzverstöße können zudem behördliche Bußgelder und Ansprüche betroffener Personen "
        + "auslösen.",
    },
    {
      nr: 12,
      titel: "Widerruf der Rolle",
      text: "Die Vertriebsleitung kann mir jederzeit und ohne Angabe von Gründen entzogen werden. "
        + "Meine Pflicht zur Vertraulichkeit bleibt davon unberührt und besteht weiter.",
    },
  ],
  schlusssatz:
    "Ich habe diese Erklärung gelesen und verstanden. Ich nehme die zusätzliche Verantwortung an und "
    + "verpflichte mich, mich an die Punkte 1 bis 12 zu halten.",
  hinweisProtokoll:
    "Mit der Annahme werden Datum und Uhrzeit, die Fassung dieser Erklärung, ihr Prüfwert, dein "
    + "eingegebener Name, deine IP-Adresse und die Browserkennung gespeichert. Das ist der Nachweis, "
    + "dass diese Erklärung in genau dieser Fassung vorgelegen hat — für dich wie für uns.",
};

/**
 * Prüfwert über die ausgelieferte Fassung.
 *
 * Absichtlich über das JSON des gesamten Textobjekts: So fällt jede Änderung
 * auf, auch eine an einem einzelnen Wort in einem Nebensatz. Wer den Text
 * ändert, ohne die Version zu erhöhen, erzeugt einen Prüfwert, der nicht mehr
 * zu den bereits gespeicherten Annahmen passt — und genau das soll auffallen.
 */
export function zusageHash(text: ZusageText = ZUSAGE_TEXT): string {
  return createHash("sha256").update(JSON.stringify(text)).digest("hex");
}

let bereit: Promise<void> | null = null;
export function ensureZusageTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_vertrieb_zusagen (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          version TEXT NOT NULL,
          text_hash TEXT NOT NULL,
          -- Der getippte Name ist die Unterschrift. Er wird im Wortlaut
          -- gespeichert, nicht normalisiert: Der Nachweis soll zeigen, was die
          -- Person geschrieben hat, nicht was ein Programm daraus gemacht hat.
          name_getippt TEXT NOT NULL,
          ip TEXT,
          user_agent TEXT,
          accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sqlPool`
        CREATE INDEX IF NOT EXISTS fiaon_vertrieb_zusagen_agent_idx
        ON fiaon_vertrieb_zusagen (agent_id, version)
      `;
      // Widerruf einer Annahme (08.08.2026). Doppelt zu db/migrations/036 —
      // die Spalten müssen auch existieren, wenn der Prozess vor dem
      // Migrationslauf hochkommt.
      await sqlPool.unsafe(`
        ALTER TABLE fiaon_vertrieb_zusagen
          ADD COLUMN IF NOT EXISTS widerrufen_am  TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS widerruf_grund TEXT,
          ADD COLUMN IF NOT EXISTS widerrufen_von TEXT,
          ADD COLUMN IF NOT EXISTS bereich        TEXT NOT NULL DEFAULT 'vertrieb'
      `);
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

export interface ZusageStand {
  offen: boolean;
  version: string;
  akzeptiertAm: string | null;
  /** Frühere Fassung angenommen? Dann ist es eine Neufassung, keine Erstannahme. */
  neufassung: boolean;
}

export async function zusageStand(
  agentId: number,
  bereich: ZusageBereich = "vertrieb",
  version: string = ZUSAGE_VERSION,
): Promise<ZusageStand> {
  await ensureZusageTabelle();
  // `widerrufen_am IS NULL`: Eine entwertete Annahme zählt nicht. Am 08.08.2026
  // hatte ein Playwright-Roboter die Fassung 2.0 als „Daniel Stripling" gegen
  // die Produktionsdatenbank angenommen (IP 127.0.0.1, HeadlessChrome). Die
  // Zeile bleibt als Beleg stehen, dass es diese Unterschrift gab — gültig ist
  // sie nicht, und der Bereich fragt wieder.
  const [aktuell] = await sqlPool`
    SELECT accepted_at FROM fiaon_vertrieb_zusagen
    WHERE agent_id = ${agentId} AND bereich = ${bereich} AND version = ${version}
      AND widerrufen_am IS NULL
    ORDER BY id DESC LIMIT 1
  `;
  if (aktuell) {
    return { offen: false, version, akzeptiertAm: aktuell.accepted_at, neufassung: false };
  }
  const [frueher] = await sqlPool`
    SELECT accepted_at FROM fiaon_vertrieb_zusagen
    WHERE agent_id = ${agentId} AND bereich = ${bereich} AND widerrufen_am IS NULL
    ORDER BY id DESC LIMIT 1
  `;
  return { offen: true, version, akzeptiertAm: null, neufassung: !!frueher };
}

/**
 * Kommt diese Annahme von einem Menschen an einem Browser — oder von einem Skript?
 *
 * Der Anlass ist echt: Ein Browser-Test hat die Erklärung angenommen, weil
 * nichts das verhindert hat. Ein Rechtsnachweis, den ein Roboter erzeugen kann,
 * ist keiner. Erkannt wird an zwei unbestreitbaren Merkmalen:
 *
 *   · Die Anfrage kommt von der Maschine selbst (127.0.0.1 / ::1). In Betrieb
 *     sitzt vor einer echten Annahme ein Browser mit öffentlicher Adresse.
 *   · Die Browserkennung nennt sich selbst automatisiert (HeadlessChrome,
 *     Playwright, Puppeteer, Selenium, phantomjs, „bot").
 *
 * Bewusst KEIN Ausschluss über fehlende Kennung allein: Ein sparsamer Browser
 * ohne User-Agent wäre sonst ausgesperrt.
 */
export function istRoboterUnterschrift(ip: string | null, userAgent: string | null): { roboter: boolean; grund: string | null } {
  const adresse = String(ip ?? "").trim().toLowerCase().replace(/^::ffff:/, "");
  const kennung = String(userAgent ?? "").toLowerCase();
  if (adresse === "127.0.0.1" || adresse === "::1" || adresse === "localhost") {
    return { roboter: true, grund: `Anfrage von der Maschine selbst (${adresse})` };
  }
  const automat = ["headlesschrome", "playwright", "puppeteer", "selenium", "phantomjs", "webdriver", "bot/", " bot", "curl/", "node-fetch", "axios/"]
    .find((m) => kennung.includes(m));
  if (automat) return { roboter: true, grund: `Automatisierte Browserkennung (${automat.trim()})` };
  return { roboter: false, grund: null };
}

/**
 * Annahme speichern. Gibt einen Klartext-Grund zurück, wenn sie nicht gilt —
 * eine stillschweigend verworfene Zusage wäre schlimmer als keine.
 */
export async function zusageSpeichern(opts: {
  agentId: number;
  agentName: string;
  version: string;
  nameGetippt: string;
  gelesen: boolean;
  ip: string | null;
  userAgent: string | null;
  bereich?: ZusageBereich;
  /** Die Fassung, die tatsächlich auf dem Bildschirm stand. */
  sollVersion?: string;
  /** Der Text, über den der Prüfwert gebildet wird. */
  text?: ZusageText;
}): Promise<{ ok: boolean; grund?: string; akzeptiertAm?: string }> {
  await ensureZusageTabelle();
  const bereich: ZusageBereich = opts.bereich ?? "vertrieb";
  const sollVersion = opts.sollVersion ?? ZUSAGE_VERSION;
  const text = opts.text ?? ZUSAGE_TEXT;
  if (opts.version !== sollVersion) {
    return { ok: false, grund: "Die Erklärung wurde zwischenzeitlich geändert. Bitte die Seite neu laden und die aktuelle Fassung lesen." };
  }
  if (!opts.gelesen) {
    return { ok: false, grund: "Bitte bestätige, dass du die Erklärung gelesen und verstanden hast." };
  }
  // Der getippte Name ist die Unterschrift. Verglichen wird nachsichtig
  // (Groß-/Kleinschreibung, doppelte Leerzeichen), aber er MUSS der Name des
  // angemeldeten Kontos sein: Eine Unterschrift mit fremdem Namen ist keine.
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm(opts.nameGetippt) !== norm(opts.agentName)) {
    return { ok: false, grund: `Bitte den vollständigen Namen genau so eingeben, wie er im Konto steht: ${opts.agentName}` };
  }
  // Kein Roboter unterschreibt hier. Am 06.08.2026 hat ein Playwright-Testlauf
  // die Fassung 2.0 als „Daniel Stripling" angenommen — gegen die
  // Produktionsdatenbank. Der Nachweis war wertlos, aber er stand in der
  // Tabelle und der Bereich war offen. Diese Prüfung ist die Wand davor: Sie
  // gehört in den Server, nicht in die Testregeln, denn eine Regel, die man
  // vergessen kann, hat man schon vergessen.
  const roboter = istRoboterUnterschrift(opts.ip, opts.userAgent);
  if (roboter.roboter) {
    console.warn(`[VERTRIEB-ZUSAGE] Annahme abgelehnt (${roboter.grund}) für Agent #${opts.agentId}`);
    return {
      ok: false,
      grund: "Diese Annahme kann nicht gespeichert werden: Sie kommt nicht von einem Browser eines Menschen "
        + `(${roboter.grund}). Eine Verpflichtungserklärung muss eine Person lesen und annehmen.`,
    };
  }
  const [row] = await sqlPool`
    INSERT INTO fiaon_vertrieb_zusagen (agent_id, bereich, version, text_hash, name_getippt, ip, user_agent)
    VALUES (${opts.agentId}, ${bereich}, ${sollVersion}, ${zusageHash(text)},
            ${opts.nameGetippt.trim()}, ${opts.ip}, ${opts.userAgent})
    RETURNING accepted_at
  `;
  console.log(`[ZUSAGE/${bereich}] ${opts.agentName} (#${opts.agentId}) hat Fassung ${sollVersion} angenommen`);
  return { ok: true, akzeptiertAm: row.accepted_at };
}
