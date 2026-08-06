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
export const ZUSAGE_VERSION = "1.0-2026-08-06";

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
  ],
  kannNicht: [
    "Zahlungen buchen oder Zahlungsstatus setzen — das bleibt beim Betreiber.",
    "Provisionen, Provisionssätze oder Auszahlungen ändern.",
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
      text: "Ich verarbeite die Daten nur im Rahmen der Weisungen des Betreibers. Bin ich unsicher, "
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
      text: "Ich buche keine Zahlungen, ändere keine Provisionen und lege keine Zugänge an. Ich "
        + "versuche nicht, diese Grenzen technisch oder über andere Personen zu umgehen.",
    },
    {
      nr: 6,
      titel: "Sorgfalt gegenüber Kunden",
      text: "Was ich einem Kunden über Zahlungen, Fristen oder Verträge sage, muss der Wahrheit "
        + "entsprechen. Ich mache keine Zusagen, die durch den tatsächlichen Sachstand nicht gedeckt "
        + "sind, und dokumentiere Gespräche wahrheitsgemäß.",
    },
    {
      nr: 7,
      titel: "Meldepflicht",
      text: "Bemerke ich einen möglichen Datenschutzvorfall — verlorenes oder gestohlenes Gerät, "
        + "Fehlversand, unbefugter Zugriff, offener Zugang — melde ich das unverzüglich, spätestens "
        + "innerhalb von 24 Stunden, an die Geschäftsführung. Auch einen Verdacht melde ich; die "
        + "Bewertung ist nicht meine Aufgabe.",
    },
    {
      nr: 8,
      titel: "Zugangsschutz",
      text: "Mein Zugang ist persönlich. Ich gebe Passwort und Sitzung an niemanden weiter, lasse "
        + "kein Gerät unbeaufsichtigt eingeloggt und nutze für die Plattform kein gemeinsam genutztes "
        + "Konto.",
    },
    {
      nr: 9,
      titel: "Folgen von Verstößen",
      text: "Mir ist bewusst, dass Verstöße arbeits- beziehungsweise vertragsrechtliche Folgen bis zur "
        + "Beendigung des Verhältnisses haben können und dass bei Vorsatz oder grober Fahrlässigkeit "
        + "eine Haftung für entstandene Schäden nach den gesetzlichen Regeln in Betracht kommt. "
        + "Datenschutzverstöße können zudem behördliche Bußgelder und Ansprüche betroffener Personen "
        + "auslösen.",
    },
    {
      nr: 10,
      titel: "Widerruf der Rolle",
      text: "Die Vertriebsleitung kann mir jederzeit und ohne Angabe von Gründen entzogen werden. "
        + "Meine Pflicht zur Vertraulichkeit bleibt davon unberührt und besteht weiter.",
    },
  ],
  schlusssatz:
    "Ich habe diese Erklärung gelesen und verstanden. Ich nehme die zusätzliche Verantwortung an und "
    + "verpflichte mich, mich an die Punkte 1 bis 10 zu halten.",
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
export function zusageHash(): string {
  return createHash("sha256").update(JSON.stringify(ZUSAGE_TEXT)).digest("hex");
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

export async function zusageStand(agentId: number): Promise<ZusageStand> {
  await ensureZusageTabelle();
  const [aktuell] = await sqlPool`
    SELECT accepted_at FROM fiaon_vertrieb_zusagen
    WHERE agent_id = ${agentId} AND version = ${ZUSAGE_VERSION}
    ORDER BY id DESC LIMIT 1
  `;
  if (aktuell) {
    return { offen: false, version: ZUSAGE_VERSION, akzeptiertAm: aktuell.accepted_at, neufassung: false };
  }
  const [frueher] = await sqlPool`
    SELECT accepted_at FROM fiaon_vertrieb_zusagen WHERE agent_id = ${agentId} ORDER BY id DESC LIMIT 1
  `;
  return { offen: true, version: ZUSAGE_VERSION, akzeptiertAm: null, neufassung: !!frueher };
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
}): Promise<{ ok: boolean; grund?: string; akzeptiertAm?: string }> {
  await ensureZusageTabelle();
  if (opts.version !== ZUSAGE_VERSION) {
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
  const [row] = await sqlPool`
    INSERT INTO fiaon_vertrieb_zusagen (agent_id, version, text_hash, name_getippt, ip, user_agent)
    VALUES (${opts.agentId}, ${ZUSAGE_VERSION}, ${zusageHash()},
            ${opts.nameGetippt.trim()}, ${opts.ip}, ${opts.userAgent})
    RETURNING accepted_at
  `;
  console.log(`[VERTRIEB-ZUSAGE] ${opts.agentName} (#${opts.agentId}) hat Fassung ${ZUSAGE_VERSION} angenommen`);
  return { ok: true, akzeptiertAm: row.accepted_at };
}
