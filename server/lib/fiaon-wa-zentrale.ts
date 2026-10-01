// ═══════════════════════════════════════════════════════════════════════════
// MARAS WHATSAPP-ZENTRALE (23.09.2026, E-229)
//
// Justin: „Mara muss ja eigentlich die ganze Zeit mit Kunden chatten — Kunden,
// die eine Zahlung offen haben, Leads, die keinen Antrag gestellt haben,
// Kunden, die im Antragsprozess abgebrochen haben. Ich muss das managen
// können: ein Knopf wie ‚WhatsApp starten (50)', dann wähle ich Kundengruppe
// und Vorlage. Oder eine Automatik: jede Stunde von 07:40 bis 20:45 schreibt
// Mara fünf Kunden an."
//
// ── WAS HIER ENTSCHIEDEN WIRD ──────────────────────────────────────────────
// Wer in welche Gruppe gehört, welche Vorlage zu welcher Gruppe passt und
// wann jemand in Ruhe gelassen wird. Gesendet wird ausschließlich über
// waSenden() — mit Wortwand, Inkasso-Wand, Platzhalter-Prüfung und der
// Bildfassung, sobald Meta sie freigegeben hat. Antworten übernimmt Mara wie
// bisher (fiaon-whatsapp-mara.ts).
//
// ── DIE REGELN, DIE IMMER GELTEN (Hand und Automatik gleich) ──────────────
//   · Nie nachts: nur zwischen 07:00 und 21:00 Berliner Zeit — die Automatik
//     zusätzlich nur in ihrem eigenen Fenster.
//   · Höchstens EINE Nachricht je Person und Tag, egal von wem.
//   · Abstand je Gruppe zur letzten Vorlage, höchstens acht Vorlagen je Person
//     in 30 Tagen.
//   · „STOPP" oder „Keine Nachrichten mehr" ist endgültig. Werbesperre,
//     Sperre, Testkonto, zusammengeführte Personen: nie.
//   · Wer bezahlt oder eine Zahlung gemeldet hat, bekommt nichts von hier —
//     außer den zwei benannten Gruppen „Monatsrate fällig" und „Auskunft fehlt".
//   · Eine Rechnung nur mit echtem Betrag (Katalogpreis) und echter Referenz.
//   · Nur Vorlagen, die Meta freigegeben hat (Text- oder Bildfassung).
//
// ── DIE MONATSRATE (E-230) ─────────────────────────────────────────────────
// fiaon_kk_rechnung verspricht die Aktivierung — bei Bestandskunden gelogen.
// Deshalb gibt es für sie eine eigene Vorlage (fiaon_kk_rate): welche Rate,
// wann fällig, welcher Verwendungszweck, Knopf zur Zahlungsseite genau dieser
// Rate. Gruppe „Monatsrate fällig": bezahlte Bestellung, Rate offen und fällig,
// nicht gekündigt, kein Abo-/Mahnstopp, keine Zahlungszusage offen, nicht
// eskaliert; höchstens alle 7 Tage und zweimal je Rate. Anfangs nur von Hand —
// die Automatik nimmt die Gruppe erst, wenn Justin sie dazuschaltet.
//
// ── DIE AUSKUNFT FEHLT (24.09.2026, E-240) ─────────────────────────────────
// Zweite Ausnahme von „wer bezahlt, bekommt nichts": zahlende Kunden mit
// laufendem Paket, denen die Bonitätsauskunft fehlt (weder bestellt noch
// hochgeladen). Hier geht es nicht um Geld, das sie uns schulden, sondern um
// die Leistung, ohne die ihr Weg zur Karte nicht weitergeht — und die seit dem
// 22.08. niemand mehr per Knopf kaufen kann. Werbung bleibt es trotzdem:
// Deshalb nur, wer nach dem 02.09.2026 12:35 zum ersten Mal beantragt hat
// (§ 7 Abs. 3 UWG, Widerspruchs-Hinweis im Antrag), einmal je Kunde, und nur mit der Vorlage
// fiaon_kk_auskunft — die als ENTWURF bereitliegt (WA_VORLAGEN_ENTWURF) und
// erst nach Justins Durchsicht bei Meta eingereicht wird. Bis Meta sie
// freigibt, zeigt die Gruppe nur, wer dran wäre. Der Verkaufstakt
// (fiaon-auskunft-verkauf.ts) sendet über auskunftWhatsAppSenden — mit allen
// Regeln dieser Datei und zusätzlich nur bei nachgewiesener Einwilligung.
//
// E-241 (25.09.2026): Wer in der Gruppe steht, entscheidet der KREIS des
// Verkaufstakts (auskunft_verkauf_kreis, /chef/s/auskunft) — dieselbe
// Grundmenge, die der Takt anschreibt (grundmengeIdsSql, fiaon-auskunft-verkauf.ts),
// gelesen aus derselben Einstellung. „uwg" = wie oben (zahlende Kunden nach dem
// Stichtag); „alle" = dazu fertige, unbezahlte Anträge (B) und Leads ohne
// Antrag (C) — Justins Entscheidung vom 25.09. Die harten Regeln der BASIS
// (Werbesperre, Sperre, STOPP, Test) gelten unverändert für alle drei.
// Die Vorlagen (fiaon_kk_auskunft für Kunden, fiaon_kk_auskunft_lead für B und
// C) stehen seit E-241 in WA_VORLAGEN, nicht mehr im Entwurf — gesendet wird
// trotzdem erst, wenn Meta genau die Vorlage des Segments freigegeben hat.
//
// E-243 (26.09.2026): Der Kreis „alle" umfasst jetzt auch die Abbrecher (Antrag
// begonnen, nicht abgeschickt; Vorlage fiaon_kk_auskunft_lead). Die gemeinsame
// Angebots-Bremse gilt für diese Gruppe mit EINEM Tag (WA_ANGEBOT_ABSTAND_TAGE)
// statt drei — die WhatsApp folgt der Angebots-Mail a am nächsten Tag. Und der
// Handversand nimmt dieselbe Reihenfolge wie der Takt (waRangSql: Kauflink
// geöffnet, Kunde, Antrag, Abbrecher, Lead).
//
// ── E-253 (28.09.2026): SPERRE, LAUF, DU-FORM ─────────────────────────────
// Justin (28.09., Screenshot): „Das steht seit 5 Minuten. Warum? Warum steht da,
// dass wir nicht schreiben dürfen?" Drei Dinge zugleich:
//   · Die „Vertriebssperre" war falsch — gesperrt war nur die Wegweiser-Marke
//     einer zusammengeführten Dublette (fiaon-mail-frequenz.ts, menschSperre).
//     Die BASIS unten und die Tür in waSenden lesen jetzt dieselbe Regel, und
//     die Gruppen zählen niemanden mehr, den die Tür danach ablehnen müsste.
//   · Der Lauf lebte nur im Arbeitsspeicher und verschwand beim Deploy — er
//     steht jetzt in fiaon_wa_lauf (Abschnitt SENDEN, dort die Deploy-Wache).
//   · Der Name eines Empfängers löste die Du-Wand aus (fiaon-whatsapp.ts).
//
// ── E-261 (29.09.2026): DIE BREMSE ─────────────────────────────────────────
// Metas Qualität liest hier niemand mehr selbst: Sie steht gespeichert in
// fiaon_settings.wa_meta_stand (Takt wa_meta_stand, fiaon-wa-bremse.ts), alle
// Instanzen lesen denselben Stand. Statt „ROT sperrt alles" fragt jeder Weg
// waBremse(): ROT stoppt WERBE-Vorlagen (die Monatsrate läuft weiter), GELB
// halbiert Automatik und Hand-Lauf, die Notbremse (wa_pause, z. B. #131042)
// stoppt jede Vorlage. Automatik, Hand-Lauf und Verkaufstakt steigen in der
// Pause FRÜH aus — ohne je Mensch eine „übersprungen"-Zeile (sonst verlöre er
// seinen Tag, BASIS: ein Versuch je Person und Tag).
// Gegenprüfung 29.09.: Hier zählt bei ROT und GELB die GRUPPE (gruppenBremse),
// nicht der Vorlagenname — Service ist in der Zentrale nur die Monatsrate.
// fiaon_kk_termin heißt zwar Service (WA_NICHT_WERBLICH), ist aber eine
// Verkaufseinladung; an „neu", „ohne_antrag" oder „abbrecher" wäre das bei ROT
// ein Massenversand an kalte Leads (bis 500 je Lauf) — genau das drückt die
// Qualität weiter. Einzeln (Akte, Raum) darf sie bei ROT weiter raus.
//
// ── DIE ALTE STUNDENKETTE ──────────────────────────────────────────────────
// Ist die Automatik hier AN, pausiert whatsappKetteLaufen() — sonst würde
// zweimal geschrieben und Justins „5 pro Stunde" wäre wertlos. Die
// Sofort-Begrüßung neuer Leads (ersteWhatsAppFuerLead) läuft unabhängig
// weiter: Speed-to-Lead ist der eine Hebel, den wir nie drosseln.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";
import { WA_VORLAGEN, WA_VORLAGEN_ENTWURF, AUSKUNFT_VORLAGE, AUSKUNFT_LEAD_VORLAGE, type WaVorlage } from "@shared/fiaon-lead-texte";
import { WHATSAPP_MOEGLICH_SQL, WHATSAPP_EINWILLIGUNG_SQL } from "@shared/fiaon-whatsapp-erlaubnis";
import { WA_NUMMER_UNZUSTELLBAR_SQL, WA_WERBUNG_ABBESTELLT_SQL } from "./fiaon-wa-unzustellbar";
import { waBremse, waBremseLage, metaStandLesen, mitFaktor, wirksameQualitaet, type WaBremseErgebnis } from "./fiaon-wa-bremse";
import { grundmengeIdsSql, waRangSql, tabellenBereit as verkaufTabellenBereit, WA_ANGEBOT_ABSTAND_TAGE } from "./fiaon-auskunft-verkauf";
import { angebotSpurenSql } from "./fiaon-auskunft";
import { OHNE_VERTRAG_SQL, WERBESPERRE_KOEPFE_SQL, STOPP_KOEPFE_SQL } from "./fiaon-mail-frequenz";
import { hostname } from "node:os";

export type Gruppe = "neu" | "ohne_antrag" | "abbrecher" | "zahlung_offen" | "rate_offen" | "auskunft_fehlt";

/** Eine Vorlage des Hauses — eingereicht oder als Entwurf bereitgelegt (E-240). */
export function vorlageDef(name: string): WaVorlage | undefined {
  return WA_VORLAGEN.find((v) => v.name === name) ?? WA_VORLAGEN_ENTWURF.find((v) => v.name === name);
}

export interface GruppenRegel {
  titel: string;
  satz: string;
  /** Vorlagen, die zu dieser Gruppe passen. „stufen" = je nach Tagen seit Eingang. */
  vorlagen: string[];
  standard: string;
  abstandTage: number;
}

export const GRUPPEN: Record<Gruppe, GruppenRegel> = {
  neu: {
    titel: "Neue Leads ohne Nachricht",
    satz: "Aus den letzten 30 Tagen, noch nie angeschrieben, noch kein Antrag.",
    vorlagen: ["fiaon_kk_anfrage", "fiaon_kk_tag1", "fiaon_kk_termin"],
    standard: "fiaon_kk_anfrage",
    abstandTage: 0,
  },
  ohne_antrag: {
    titel: "Leads ohne Antrag",
    satz: "Schon angeschrieben (vor mindestens 2 Tagen) oder älter als 30 Tage — bis heute kein Antrag.",
    vorlagen: ["stufen", "fiaon_kk_tag1", "fiaon_kk_tag3", "fiaon_kk_tag7", "fiaon_kk_letzte", "fiaon_kk_termin", "fiaon_kk_rueckfrage"],
    standard: "stufen",
    abstandTage: 2,
  },
  abbrecher: {
    titel: "Im Antrag abgebrochen",
    satz: "Antrag begonnen und gespeichert, aber nicht abgeschickt.",
    vorlagen: ["fiaon_kk_antrag_offen", "fiaon_kk_termin", "fiaon_kk_rueckfrage"],
    standard: "fiaon_kk_antrag_offen",
    abstandTage: 1,
  },
  zahlung_offen: {
    titel: "Erste Zahlung offen",
    satz: "Antrag abgeschickt, erste Zahlung noch nicht da und nicht als gezahlt gemeldet.",
    vorlagen: ["fiaon_kk_rechnung", "fiaon_kk_aktivierung", "fiaon_kk_rueckfrage"],
    standard: "fiaon_kk_rechnung",
    abstandTage: 2,
  },
  rate_offen: {
    titel: "Monatsrate fällig",
    satz: "Bestandskunden mit fälliger, unbezahlter Monatsrate — nicht gekündigt, kein Abo- oder Mahnstopp. Höchstens alle 7 Tage, zweimal je Rate.",
    vorlagen: ["fiaon_kk_rate"],
    standard: "fiaon_kk_rate",
    abstandTage: 7,
  },
  // E-240 (24.09.2026): Begründung der Ausnahme im Kopf dieser Datei.
  auskunft_fehlt: {
    titel: "Auskunft fehlt",
    // E-241: Die Menge folgt dem Kreis des Verkaufstakts (Einstellung auskunft_verkauf_kreis).
    satz: "Menschen ohne Bonitätsauskunft (nicht bestellt, nicht hochgeladen) im Kreis des Verkaufstakts: bei „uwg“ zahlende Kunden, "
      + "die nach dem 02.09.2026 12:35 zum ersten Mal beantragt haben (§ 7 Abs. 3 UWG); bei „alle“ dazu fertige, unbezahlte Anträge, "
      + "begonnene Anträge (Abbrecher) und Leads ohne Antrag — nie Stornierte oder Gekündigte. Ohne Sperre, einmal je Mensch, "
      + "frühestens einen Tag nach einem Angebot, auch nach der dritten Angebots-Mail noch. Wer den Kauflink geöffnet und nicht bestellt hat, steht vorn. "
      + "Die Vorlage folgt dem Segment: Kunden fiaon_kk_auskunft, Anträge, Abbrecher und Leads fiaon_kk_auskunft_lead — gesendet wird erst, wenn Meta sie freigibt.",
    // E-241: Die Wahl ist nur der Einstieg — vorlageFuerKandidat nimmt immer die Vorlage des Segments.
    vorlagen: [AUSKUNFT_VORLAGE, AUSKUNFT_LEAD_VORLAGE],
    standard: AUSKUNFT_VORLAGE,
    abstandTage: 3,
  },
};

export const GRUPPEN_REIHE: Gruppe[] = ["neu", "zahlung_offen", "abbrecher", "ohne_antrag", "rate_offen", "auskunft_fehlt"];
export const istGruppe = (g: unknown): g is Gruppe => typeof g === "string" && (GRUPPEN_REIHE as string[]).includes(g);

/** Was „stufen" je Kandidat bedeutet — für die Anzeige. */
export const STUFEN_TEXT = "Passend zum Alter: bis Tag 2 Erinnerung 1, bis Tag 5 Erinnerung 2, bis Tag 12 Erinnerung 3, danach die letzte Nachricht.";

// ── Tabelle ─────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function zentraleSchema(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_wa_aktion (
          id BIGSERIAL PRIMARY KEY,
          person_id INTEGER,
          gruppe TEXT NOT NULL,
          vorlage TEXT NOT NULL,
          quelle TEXT NOT NULL,
          lauf_id TEXT,
          ausgeloest_von TEXT,
          wa_id TEXT,
          ok BOOLEAN NOT NULL,
          grund TEXT,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_wa_aktion_zeit_idx ON fiaon_wa_aktion (erstellt_am DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_wa_aktion_person_idx ON fiaon_wa_aktion (person_id, erstellt_am DESC)`;
      // E-253 (28.09.2026): der Lauf von Hand in der Datenbank (Abschnitt SENDEN). Bewusst ohne jsonb
      // (Falle E-238) — die Gründe stehen je Zeile in fiaon_wa_aktion.grund.
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_wa_lauf (
          id TEXT PRIMARY KEY,
          quelle TEXT NOT NULL,
          gruppe TEXT NOT NULL,
          vorlage TEXT NOT NULL,
          ausgeloest_von TEXT,
          plan INTEGER[] NOT NULL,
          pos INTEGER NOT NULL DEFAULT 0,
          in_arbeit INTEGER,
          entfallen INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'laeuft',
          schluss TEXT,
          instanz TEXT,
          herzschlag TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          anhalten_am TIMESTAMPTZ,
          anhalten_von TEXT,
          fortsetzungen INTEGER NOT NULL DEFAULT 0,
          unterbrochen_am TIMESTAMPTZ,
          seit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          bis TIMESTAMPTZ
        )`;
      // Höchstens EIN Lauf gleichzeitig — über alle Instanzen (23505 = „Es läuft schon ein Versand").
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_wa_lauf_einer ON fiaon_wa_lauf ((TRUE)) WHERE status IN ('laeuft', 'unterbrochen')`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_wa_aktion_lauf_idx ON fiaon_wa_aktion (lauf_id) WHERE lauf_id IS NOT NULL`;
      // E-261 (29.09.2026): Die Zeile folgt dem Status-Webhook (fiaon-whatsapp.ts, waEingang) — Metas Code und
      // wann der Fehler kam. Dieselben Anweisungen wie Migration 086, für frische Datenbanken.
      await sqlPool`ALTER TABLE fiaon_wa_aktion ADD COLUMN IF NOT EXISTS fehler_code INTEGER`;
      await sqlPool`ALTER TABLE fiaon_wa_aktion ADD COLUMN IF NOT EXISTS fehler_am TIMESTAMPTZ`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_wa_aktion_wa_idx ON fiaon_wa_aktion (wa_id) WHERE wa_id IS NOT NULL`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      bereit = null;
      throw e;
    });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// WER IST IN WELCHER GRUPPE
// ═══════════════════════════════════════════════════════════════════════════
export interface Kandidat {
  personId: number;
  name: string;
  telefon: string;
  /** E-244: Land der Person (fiaon_persons.country) — für nummerFuerVersand, nie als +1 raten. */
  land?: string | null;
  leadId: number | null;
  eingang: string;
  tage: number;
  letzteVorlageAm: string | null;
  betrag: string | null;       // „99,99" für {{2}} der Rechnung bzw. der Rate
  referenz: string | null;     // Verwendungszweck der ersten Zahlung bzw. der Rate
  faelligAm: string | null;    // „22.09.2026" — nur bei der Monatsrate
  /** Nur Gruppe „auskunft_fehlt" (E-240): {{2}}–{{4}} und der Knopf der Vorlage fiaon_kk_auskunft. */
  auskunft?: { wort: string; bei: string; preis: string; token: string; segment?: string; vorlage?: string } | null;
}

/** „ANNA VON DER HEIDE" / „max mustermann" → „Anna von der Heide" / „Max Mustermann". Gemischte Schreibung bleibt. */
export function schoenerName(roh: string): string {
  const s = String(roh || "").replace(/\s+/g, " ").trim();
  if (!s || (s !== s.toUpperCase() && s !== s.toLowerCase())) return s;
  const klein = new Set(["von", "van", "der", "den", "de", "zu", "zur", "di", "da", "del", "la", "le"]);
  return s.toLowerCase().split(" ").map((w, i) => (i > 0 && klein.has(w)) ? w
    : w.split("-").map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("-")).join(" ");
}

/** Die Menschen, die überhaupt in Frage kommen — die harten Regeln oben. */
export const BASIS = `
  WITH basis AS (
    SELECT p.id AS person_id,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
           p.primary_phone AS telefon,
           p.country AS land,
           p.created_at,
           (SELECT MAX(w.created_at) FROM fiaon_whatsapp w
             WHERE w.person_id = p.id AND w.richtung = 'raus' AND w.vorlage IS NOT NULL AND w.status <> 'fehler') AS letzte_vorlage,
           (SELECT COUNT(*) FROM fiaon_whatsapp w
             WHERE w.person_id = p.id AND w.richtung = 'raus' AND w.vorlage IS NOT NULL AND w.status <> 'fehler'
               AND w.created_at > NOW() - INTERVAL '30 days')::int AS vorlagen_30,
           (SELECT le.id FROM fiaon_leads le WHERE le.person_id = p.id ORDER BY le.erstellt_am DESC LIMIT 1) AS lead_id
      FROM fiaon_persons p
      -- Die eine WhatsApp-Regel des Hauses (shared/fiaon-whatsapp-erlaubnis.ts):
      -- ein ausdrückliches Nein im Lead-Formular schließt aus, Festnetz auch.
      CROSS JOIN LATERAL (
        SELECT p.primary_phone AS telefon,
               (SELECT bool_and(le.whatsapp_erlaubt) FROM fiaon_leads le
                 WHERE le.person_id = p.id AND le.whatsapp_erlaubt IS NOT NULL) AS whatsapp_erlaubt
      ) wx
     WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
       AND p.primary_phone IS NOT NULL AND TRIM(p.primary_phone) <> '' AND p.werbung_gesperrt_am IS NULL
       -- E-253 (28.09.2026): die Werbesperre des MENSCHEN — auch an einer zusammengeführten Dublette,
       -- dieselbe Lesart wie die Tür in waSenden (menschSperre, fiaon-mail-frequenz.ts). Die
       -- Vertriebssperre zählt wie dort nur am Kopf, und p ist hier immer der Kopf.
       AND p.id NOT IN ${WERBESPERRE_KOEPFE_SQL}
       AND ${WHATSAPP_MOEGLICH_SQL("wx")}
       -- E-244 (26.09.2026): Nummer unzustellbar (Meta 131026, seitdem kein Lebenszeichen) oder in der
       -- 131049-Pause — fiaon-wa-unzustellbar.ts. Bis dahin zählten gescheiterte Vorlagen hier nicht als
       -- angeschrieben, und dieselben 39 Nummern bekamen 72 Vorlagen, 10 davon an drei Tagen hintereinander.
       -- Verglichen wird die volle Versandnummer (nummerFuerVersand mit p.country, wie einzelnSenden).
       AND NOT ${WA_NUMMER_UNZUSTELLBAR_SQL("p.primary_phone", "p.country")}
       -- 24.09.2026, Justin: „Wir schreiben alle per WhatsApp an, die wir haben, nicht nur die mit
       -- Einwilligung." Kein Einwilligungs-Filter — die Seite zeigt je Gruppe, wie viele nachweislich
       -- eingewilligt haben (Risiko: Meta-Qualität, bei Werbung an Website-Abbrecher § 7 UWG).
       -- Höchstens ein Versuch je Person und Tag — auch ein übersprungener
       -- (sonst griffe die Automatik alle fünf Minuten nach demselben Fall).
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_wa_aktion x WHERE x.person_id = p.id
            AND (x.erstellt_am AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_whatsapp w WHERE w.person_id = p.id AND w.richtung = 'raus'
            AND (w.created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)
       -- „STOPP" ist endgültig. E-253 (28.09.2026, Nachtrag nach der Gegenprüfung): über die ganze Familie
       -- (ein „STOPP" an einer Dublette — fiaon_whatsapp wird beim Zusammenführen nicht umgehängt) UND das
       -- Stopp aus dem Postfach (Postmeister: „will keine Nachrichten mehr"). Vorher las die BASIS nur das
       -- WhatsApp-„STOPP" am Kopf; 9 Menschen mit Postfach-Stopp schützte allein die Wegweiser-Marke einer
       -- Dublette. Dieselbe Regel wie die Tür (menschSperre → werbungVerboten, fiaon-mail-frequenz.ts).
       AND p.id NOT IN ${STOPP_KOEPFE_SQL}
       -- E-230: Wer gerade mit uns schreibt, bekommt keine Vorlage mitten ins Gespräch — dort antwortet Mara.
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_whatsapp e WHERE e.person_id = p.id AND e.richtung = 'rein' AND e.created_at > NOW() - INTERVAL '24 hours')
  )`;

// Für die vier Gruppen VOR der ersten Zahlung (neu, ohne Antrag, abgebrochen,
// erste Zahlung offen): nicht älter als 120 Tage, nichts bezahlt oder gemeldet.
// Stand bis E-229 in BASIS — dort hätte es die Monatsrate (nur Bezahlte) leer gemacht.
const VOR_DER_ZAHLUNG = `b.created_at > NOW() - INTERVAL '120 days'
  AND NOT EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = b.person_id AND ap.merged_into IS NULL
                     AND ap.payment_status IN ('paid', 'claimed_paid'))`;

/**
 * Eine Rate, an die erinnert werden darf. `r` ist fiaon_abo_raten, `a` die
 * Bestellung, `person` der Ausdruck für die Personen-ID. Gruppe UND Auswahl der
 * Rate nutzen genau diesen Baustein — sonst liefen „höchstens zweimal je Rate"
 * und die gewählte Rate auseinander (E-230-Durchsicht).
 */
export const RATE_ERINNERBAR = (r: string, a: string, person: string) => `(
  ${RATE_OFFEN_FAELLIG(r)}
  -- höchstens zwei WhatsApp je Rate
  AND (SELECT COUNT(*) FROM fiaon_whatsapp wr WHERE wr.person_id = ${person} AND wr.richtung = 'raus'
         AND wr.vorlage IN ('fiaon_kk_rate', 'fiaon_kkb_rate') AND wr.status <> 'fehler'
         AND wr.text LIKE '%' || ${r}.zahlungsreferenz || '%') < 2
  -- keine Erinnerung, wenn ein passender Eingang unverbucht im Bankbuch liegt (Regel der Rückholung)
  AND NOT EXISTS (
    SELECT 1 FROM fiaon_bank_txns t
     WHERE t.applied = FALSE AND t.amount_cents > 0 AND t.booked_at > NOW() - INTERVAL '30 days'
       AND (t.matched_ref = ${a}.ref
            OR UPPER(REGEXP_REPLACE(COALESCE(t.extracted_ref, ''), '[^A-Za-z0-9]', '', 'g'))
               LIKE UPPER(REGEXP_REPLACE(COALESCE(${a}.payment_reference, ${a}.ref), '[^A-Za-z0-9]', '', 'g')) || '%'
            OR (LENGTH(TRIM(COALESCE(${a}.last_name, ''))) >= 4 AND t.payer_name ILIKE '%' || TRIM(${a}.last_name) || '%')))
  -- ein zugesagtes Zahldatum abwarten (steht an der Person)
  AND NOT EXISTS (SELECT 1 FROM fiaon_persons pz WHERE pz.id = ${person}
                    AND pz.promised_payment_date >= (NOW() AT TIME ZONE 'Europe/Berlin')::date)
)`;

/** Rate offen, fällig, zahlbar über /zahlung/, nicht eskaliert, kein Beleg „überwiesen" in 14 Tagen. */
const RATE_OFFEN_FAELLIG = (r: string) => `(
  ${r}.status = 'offen' AND ${r}.storniert_am IS NULL AND ${r}.bezahlt_am IS NULL
  AND ${r}.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date
  AND UPPER(${r}.zahlungsreferenz) ~ '^FIAON-?[A-Z0-9]{6}-[0-9]{1,2}$'
  AND (${r}.inkasso_zusage_am IS NULL OR ${r}.inkasso_zusage_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date)
  AND ${r}.eskaliert_am IS NULL
  AND NOT EXISTS (SELECT 1 FROM fiaon_raten_arbeit ra WHERE ra.rate_id = ${r}.id AND ra.ergebnis = 'ueberwiesen_beleg'
                    AND ra.created_at > NOW() - INTERVAL '14 days'))`;

/** Die Bestellung eines Bestandskunden, an dessen Rate erinnert werden darf. `a` ist fiaon_applications. */
const BESTAND = (a: string) => `(${a}.merged_into IS NULL AND NOT COALESCE(${a}.ist_entwurf, FALSE) AND ${a}.payment_status = 'paid'
  AND ${a}.archived_at IS NULL AND ${a}.gdpr_deleted_at IS NULL
  AND (${a}.gekuendigt_am IS NULL OR ${a}.kuendigung_zurueckgenommen_am IS NOT NULL)
  AND ${a}.abo_gestoppt_am IS NULL AND ${a}.mahnstopp_am IS NULL)`;

// „Abgeschickt" — dieselbe Regel wie der Wiedereinstieg in fiaon-antrag.ts
// (E-210): Schritt 8 erreicht oder ein Status außerhalb der unfertigen. Die
// Zahlungsreferenz taugt NICHT als Zeichen — ein Trigger füllt sie seit dem
// 08.08.2026 schon beim ersten Speichern.
// Offen heißt: abgeschickt und weder bezahlt, gemeldet, storniert noch
// archiviert — auch „pending" (so führt kundenstatus() es als „Rechnung offen").
// E-264 (29.09.2026): die Regel steht jetzt EINMAL in shared/fiaon-antrag-stand.ts (dazu submitted_at) —
// Mara (stufeAusAntrag) las bis heute pending_payment als „abgeschickt", diese Datei nie.
const abgeschickt = (t: string) => abgeschicktSql(t);

const OHNE_ANTRAG = `NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = b.person_id AND a.merged_into IS NULL)`;

export function gruppenBedingung(g: Gruppe, ohneAbstand = false): string {
  const kern = gruppenKern(g, ohneAbstand);
  // E-253 (28.09.2026): Wer gekündigt hat oder dessen Vertrag vorbei ist (und kein laufendes,
  // ungekündigtes Paket hat), bekommt keine werbliche Vorlage — die Tür in waSenden lehnt sie ab
  // (werbungVerboten). Dann zählt er hier gar nicht erst, sonst stünde er als „übersprungen" im Lauf.
  // Die Monatsrate ist Vertragspost und bleibt ausgenommen (die Tür lässt sie durch).
  // E-261 (29.09.2026): Wer Werbung von uns in WhatsApp abbestellt hat (Meta #131050), bekommt keine
  // Werbe-Vorlage mehr — nur die Monatsrate (Service) bleibt (fiaon-wa-unzustellbar.ts).
  return g === "rate_offen" ? kern
    : `(${kern}) AND NOT ${OHNE_VERTRAG_SQL("b.person_id")} AND NOT ${WA_WERBUNG_ABBESTELLT_SQL("b.telefon", "b.land")}`;
}

function gruppenKern(g: Gruppe, ohneAbstand = false): string {
  // ohneAbstand (E-250): dieselbe Gruppe, nur ohne die Wartezeit seit der letzten Vorlage — zeigt,
  // wie viele gerade nur warten und ab wann sie wieder dran sind.
  const abstand = ohneAbstand ? "TRUE" : `(b.letzte_vorlage IS NULL OR b.letzte_vorlage < NOW() - INTERVAL '${GRUPPEN[g].abstandTage} days')`;
  const deckel = `b.vorlagen_30 < 8`;
  switch (g) {
    case "neu":
      // „Noch nie angeschrieben" heißt: gar kein WhatsApp-Kontakt — auch keine Antwort von Mara, kein eigener Eingang.
      return `${VOR_DER_ZAHLUNG} AND b.created_at > NOW() - INTERVAL '30 days' AND b.letzte_vorlage IS NULL AND ${OHNE_ANTRAG}
              AND NOT EXISTS (SELECT 1 FROM fiaon_whatsapp wk WHERE wk.person_id = b.person_id AND (wk.richtung = 'rein' OR wk.status <> 'fehler'))`;
    case "ohne_antrag":
      return `${VOR_DER_ZAHLUNG} AND ${OHNE_ANTRAG} AND b.created_at > NOW() - INTERVAL '90 days' AND ${deckel}
              AND ((b.letzte_vorlage IS NOT NULL AND b.letzte_vorlage < NOW() - INTERVAL '2 days')
                   OR (b.letzte_vorlage IS NULL AND b.created_at <= NOW() - INTERVAL '30 days'))`;
    case "abbrecher":
      // Abgebrochen = eine Bestellung, die noch vor dem Abschicken steht, seit
      // mindestens 30 Minuten unberührt — und keine abgeschickte daneben.
      // (Entwürfe mit ist_entwurf haben keine Person; sie sind hier nie dabei.)
      return `${VOR_DER_ZAHLUNG} AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = b.person_id AND a.merged_into IS NULL AND NOT a.ist_entwurf
                        AND NOT ${abgeschickt("a")} AND a.payment_status NOT IN ('paid', 'claimed_paid', 'cancelled', 'superseded')
                        AND a.gekuendigt_am IS NULL AND COALESCE(a.updated_at, a.created_at) < NOW() - INTERVAL '30 minutes')
              AND NOT EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id = b.person_id AND a2.merged_into IS NULL
                        AND NOT a2.ist_entwurf AND ${abgeschickt("a2")})
              AND b.created_at > NOW() - INTERVAL '90 days' AND ${abstand} AND ${deckel}`;
    case "zahlung_offen":
      // E-244 (26.09.2026): Auskunft-Bestellungen zählen hier nicht — die Vorlage spricht vom Paket.
      // Zwei offene Auskünfte tragen den Paketschlüssel „highend"; erkannt wird wie IST_AUSKUNFT
      // (fiaon-auskunft-verkauf.ts). An die Auskunft-Zahlung erinnert ein eigener Lauf.
      return `${VOR_DER_ZAHLUNG} AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = b.person_id AND a.merged_into IS NULL AND NOT a.ist_entwurf
                        AND ${abgeschickt("a")} AND a.payment_status IN ('pending_payment', 'expired', 'pending') AND a.mahnstopp_am IS NULL
                        AND a.gekuendigt_am IS NULL AND a.payment_reference IS NOT NULL
                        AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%')
              AND ${abstand} AND ${deckel}`;
    case "rate_offen":
      // Höchstens zwei WhatsApp je Rate: Erinnerung, kein Dauermahnen (die Mail erinnert ohnehin, E-182).
      return `EXISTS (SELECT 1 FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
                       WHERE a.person_id = b.person_id AND ${BESTAND("a")} AND ${RATE_ERINNERBAR("r", "a", "b.person_id")})
              AND ${abstand} AND ${deckel}`;
    case "auskunft_fehlt":
      // E-241 (25.09.2026): EINE Definition mit dem Verkaufstakt — die Grundmenge im Kreis der
      // Einstellung (grundmengeIdsSql, fiaon-auskunft-verkauf.ts: Segment, keine Auskunft, kein
      // Sperrgrund; bei „uwg" nur Kunden nach dem Stichtag). Die Unterabfrage hat keinen Bezug auf
      // b und entsteht einmal je Abfrage. Einmal je Mensch (eine gesendete Vorlage dieser Gruppe
      // beendet es). E-243 (Justin 26.09.2026, „jeden Tag 20 WhatsApp"): auch nach der dritten
      // Angebots-Mail noch — dieselbe Regel wie der Takt (WA_FAELLIG_SQL, fiaon-auskunft-verkauf.ts).
      return `b.person_id IN (${grundmengeIdsSql()})
              AND NOT EXISTS (SELECT 1 FROM fiaon_wa_aktion xa WHERE xa.person_id = b.person_id AND xa.gruppe = 'auskunft_fehlt' AND xa.ok)
              -- Integration 25.09.2026 (E-240): die gemeinsame Bremse (fiaon-auskunft.ts) — kein zweites
              -- Angebot kurz nach einer Angebots- oder Unterlagen-Mail oder Maras Angebot. E-243 (26.09.2026):
              -- für die WhatsApp EIN Tag (WA_ANGEBOT_ABSTAND_TAGE) statt drei — sie folgt der Mail a am nächsten Tag.
              AND NOT EXISTS (SELECT 1 FROM (${angebotSpurenSql("b.person_id", WA_ANGEBOT_ABSTAND_TAGE)}) ap_spur)
              AND ${abstand} AND ${deckel}`;
  }
}

/** Reihenfolge je Gruppe: Neue die frischesten zuerst, sonst wer am längsten nichts bekam. */
const ORDNUNG: Record<Gruppe, string> = {
  neu: "b.created_at DESC",
  ohne_antrag: "b.letzte_vorlage ASC NULLS FIRST, b.created_at DESC",
  abbrecher: "b.created_at DESC",
  zahlung_offen: "b.letzte_vorlage ASC NULLS FIRST, b.created_at DESC",
  rate_offen: "b.letzte_vorlage ASC NULLS FIRST, b.created_at DESC",
  auskunft_fehlt: "b.letzte_vorlage ASC NULLS FIRST, b.created_at DESC",
};

export async function gruppenZahlen(): Promise<Record<Gruppe, number>> {
  return (await gruppenZahlenMitEinwilligung()).alle;
}

/** Je Gruppe: alle — und wie viele davon nachweislich eingewilligt haben (Meta-Formular mit Hinweis oder selbst geschrieben). */
export async function gruppenZahlenMitEinwilligung(): Promise<{
  alle: Record<Gruppe, number>; einwilligung: Record<Gruppe, number>;
  wartend: Record<Gruppe, number>; wiederAb: Record<Gruppe, string | null>;
}> {
  await zentraleSchema();
  const alle = {} as Record<Gruppe, number>;
  const einwilligung = {} as Record<Gruppe, number>;
  const wartend = {} as Record<Gruppe, number>;
  const wiederAb = {} as Record<Gruppe, string | null>;
  await Promise.all(GRUPPEN_REIHE.map(async (g) => {
    // E-250 (28.09.2026): Eine leere Gruppe sagt, warum — wer nur die Wartezeit abwartet und ab wann er
    // wieder dran ist. „Neu" hat keine Wartezeit (dort zählt, ob überhaupt ein Lead kam).
    const mitWarten = g !== "neu" && GRUPPEN[g].abstandTage > 0;
    // Wartend = gehörte zur Gruppe, bekam aber innerhalb der Wartezeit eine Vorlage.
    const warten = `(${gruppenBedingung(g, true)}) AND b.letzte_vorlage >= NOW() - INTERVAL '${GRUPPEN[g].abstandTage} days'`;
    const [r] = (await sqlPool.unsafe(`${BASIS}
      SELECT COUNT(*) FILTER (WHERE ${gruppenBedingung(g)})::int AS n,
             COUNT(*) FILTER (WHERE (${gruppenBedingung(g)}) AND ${WHATSAPP_EINWILLIGUNG_SQL("b.person_id")})::int AS e
             ${mitWarten ? `, COUNT(*) FILTER (WHERE ${warten})::int AS w, MIN(b.letzte_vorlage) FILTER (WHERE ${warten}) AS frueheste` : ""}
        FROM basis b`)) as any[];
    alle[g] = Number(r?.n || 0);
    einwilligung[g] = Number(r?.e || 0);
    wartend[g] = mitWarten ? Number(r?.w || 0) : 0;
    wiederAb[g] = mitWarten && wartend[g] > 0 && r?.frueheste
      ? new Date(new Date(r.frueheste).getTime() + GRUPPEN[g].abstandTage * 86_400_000).toISOString() : null;
  }));
  return { alle, einwilligung, wartend, wiederAb };
}

/**
 * Die Zeilen der Gruppe — EINE Abfrage für die Liste, den Plan eines Laufs (nur IDs) und die
 * Neuprüfung eines Happens (E-253: `nur` = genau diese Personen, sofern sie noch dran sind).
 */
async function kandidatenZeilen(g: Gruppe, anzahl: number, ohne: number[] = [], nur?: number[]): Promise<any[]> {
  await zentraleSchema();
  const n = Math.min(LAUF_HOECHSTENS, Math.max(1, Math.round(anzahl)));
  const ausschluss = ohne.filter((x) => Number.isInteger(x));
  const nurListe = nur ? nur.filter((x) => Number.isInteger(x)) : null;
  if (nurListe && !nurListe.length) return [];
  // E-243 (26.09.2026): „Auskunft fehlt" in der Reihenfolge des Verkaufstakts (waRangSql) — wer den Kauflink
  // geöffnet hat, zuerst; dann Kunde, Antrag, Abbrecher, Lead, je die frischeste Aktivität zuerst.
  const rang = g === "auskunft_fehlt";
  if (rang) await verkaufTabellenBereit();
  const werte: unknown[] = [];
  const filter: string[] = [];
  if (ausschluss.length) { werte.push(ausschluss); filter.push(`AND b.person_id <> ALL($${werte.length}::int[])`); }
  if (nurListe) { werte.push(nurListe); filter.push(`AND b.person_id = ANY($${werte.length}::int[])`); }
  return (await sqlPool.unsafe(`
    ${BASIS}
    SELECT b.*, EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400 AS tage_roh
      FROM basis b
      ${rang ? `LEFT JOIN (${waRangSql()}) ax_rang ON ax_rang.person_id = b.person_id` : ""}
     WHERE ${gruppenBedingung(g)} ${filter.join(" ")}
     ORDER BY ${rang ? "ax_rang.rang ASC NULLS LAST, ax_rang.klick_am DESC NULLS LAST, ax_rang.aktiv_am DESC NULLS LAST, " : ""}${ORDNUNG[g]}
     LIMIT ${n}`, werte as any[])) as any[];
}

export async function kandidaten(g: Gruppe, anzahl: number, ohne: number[] = [], nur?: number[]): Promise<Kandidat[]> {
  const rows = await kandidatenZeilen(g, anzahl, ohne, nur);
  const aus: Kandidat[] = [];
  for (const r of rows) aus.push(await zeileZuKandidat(g, r));
  return aus;
}

/** E-253: nur die Personen-IDs in Versandreihenfolge — der Plan eines Laufs, ohne die Werte je Vorlage. */
export async function kandidatenIds(g: Gruppe, anzahl: number): Promise<number[]> {
  return (await kandidatenZeilen(g, anzahl)).map((r) => Number(r.person_id)).filter((x) => Number.isInteger(x) && x > 0);
}

/**
 * Genau ein Mensch aus der Gruppe „auskunft_fehlt" — oder null, wenn eine
 * Regel ihn heute ausschließt (E-240). `mitEinwilligung` verlangt zusätzlich
 * die nachgewiesene WhatsApp-Einwilligung: Der Verkaufstakt schreibt von sich
 * aus, dort gilt die strengere Regel.
 */
export async function auskunftKandidat(personId: number, opts: { mitEinwilligung?: boolean } = {}): Promise<Kandidat | null> {
  await zentraleSchema();
  const [r] = (await sqlPool.unsafe(`
    ${BASIS}
    SELECT b.*, EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400 AS tage_roh
      FROM basis b
     WHERE b.person_id = $1 AND ${gruppenBedingung("auskunft_fehlt")}
       ${opts.mitEinwilligung ? `AND ${WHATSAPP_EINWILLIGUNG_SQL("b.person_id")}` : ""}
     LIMIT 1`, [personId])) as any[];
  return r ? zeileZuKandidat("auskunft_fehlt", r) : null;
}

/** Eine Zeile der BASIS → Kandidat, mit den Werten, die die Vorlage der Gruppe braucht. */
async function zeileZuKandidat(g: Gruppe, r: any): Promise<Kandidat> {
  {
    // (Bis E-240 der Rumpf der Schleife in kandidaten() — unverändert, nur herausgezogen,
    //  damit auskunftKandidat() dieselbe Umrechnung benutzt.)
    let auskunft: Kandidat["auskunft"] = null;
    if (g === "auskunft_fehlt") {
      // Preis, Wort und Auskunfteien je Land; der Knopf trägt den signierten Kauflink als Pfadstück.
      const { waVorlagenWerte } = await import("./fiaon-auskunft-verkauf");
      auskunft = await waVorlagenWerte(Number(r.person_id)).catch((e) => {
        console.error("[WA-ZENTRALE] Auskunft-Werte:", e);
        return null;
      });
    }
    let betrag: string | null = null;
    let referenz: string | null = null;
    let faelligAm: string | null = null;
    if (g === "rate_offen") {
      // Die älteste fällige Rate — Betrag wie auf der Zahlungsseite (betrag_cents), nicht der Katalogpreis.
      const [ra] = (await sqlPool.unsafe(`
        SELECT r.zahlungsreferenz, r.betrag_cents, to_char(r.faellig_am, 'DD.MM.YYYY') AS faellig
          FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
         WHERE a.person_id = $1 AND ${BESTAND("a")} AND ${RATE_ERINNERBAR("r", "a", "$1::int")}
         ORDER BY r.faellig_am ASC, r.rate_nr ASC LIMIT 1`, [Number(r.person_id)])) as any[];
      if (ra) {
        betrag = (Number(ra.betrag_cents) / 100).toFixed(2).replace(".", ",");
        referenz = String(ra.zahlungsreferenz);
        faelligAm = String(ra.faellig);
      }
    } else if (g === "zahlung_offen") {
      const [a] = (await sqlPool`
        SELECT payment_reference, pack_key, amount_due FROM fiaon_applications
         WHERE person_id = ${r.person_id} AND merged_into IS NULL AND NOT ist_entwurf
           AND payment_status IN ('pending_payment', 'expired', 'pending') AND payment_reference IS NOT NULL
           AND mahnstopp_am IS NULL AND gekuendigt_am IS NULL
           AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
           AND ${sqlPool.unsafe(abgeschicktSql(""))}
         ORDER BY created_at DESC LIMIT 1`) as any[];
      if (a) {
        // E-181: Der Katalogpreis gilt; amount_due nur, wenn das Paket unbekannt ist.
        const cents = paketPreisCents(a.pack_key) || (a.amount_due != null ? Math.round(Number(a.amount_due) * 100) : 0);
        betrag = cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : null;
        referenz = String(a.payment_reference);
      }
    }
    return {
      personId: Number(r.person_id),
      name: schoenerName(String(r.name || "")),
      telefon: String(r.telefon || ""),
      land: r.land != null ? String(r.land) : null,
      leadId: r.lead_id != null ? Number(r.lead_id) : null,
      eingang: new Date(r.created_at).toISOString(),
      tage: Math.floor(Number(r.tage_roh || 0)),
      letzteVorlageAm: r.letzte_vorlage ? new Date(r.letzte_vorlage).toISOString() : null,
      betrag, referenz, faelligAm,
      ...(g === "auskunft_fehlt" ? { auskunft } : {}),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE UND WERTE
// ═══════════════════════════════════════════════════════════════════════════
function stufenVorlage(tage: number): string {
  if (tage <= 2) return "fiaon_kk_tag1";
  if (tage <= 5) return "fiaon_kk_tag3";
  if (tage <= 12) return "fiaon_kk_tag7";
  return "fiaon_kk_letzte";
}

export function vorlageFuerKandidat(gewaehlt: string, k: Kandidat): string {
  // E-241: Die Auskunft-Vorlage folgt dem Segment (waVorlagenWerte, fiaon-auskunft-verkauf.ts) — ein Lead
  // liest nie „In Ihrer Akte … Ihr Preis als FIAON-Kunde", auch wenn von Hand die andere gewählt wurde.
  if ((gewaehlt === AUSKUNFT_VORLAGE || gewaehlt === AUSKUNFT_LEAD_VORLAGE) && k.auskunft?.vorlage) return k.auskunft.vorlage;
  return gewaehlt === "stufen" ? stufenVorlage(k.tage) : gewaehlt;
}

/** Die Werte für {{1}}, {{2}}, {{3}} — oder ein Grund, warum es nicht geht. */
export function werteFuer(vorlage: string, k: Kandidat): { werte: string[]; knopfWert?: string } | { grund: string } {
  const anrede = k.name || "und willkommen";
  if (vorlage === "fiaon_kk_rate") {
    // Bestandskunden bekommen kein „Hallo und willkommen".
    if (!k.name) return { grund: "Kein Name — bei Bestandskunden kein „und willkommen“" };
    if (!k.betrag || !k.referenz || !k.faelligAm) return { grund: "Keine fällige Rate gefunden" };
    return { werte: [k.name, k.betrag, k.faelligAm, k.referenz], knopfWert: k.referenz };
  }
  if (vorlage === "fiaon_kk_rechnung") {
    if (!k.betrag || !k.referenz) return { grund: "Kein Betrag oder keine Referenz" };
    return { werte: [anrede, k.betrag, k.referenz], knopfWert: k.referenz };
  }
  if (vorlage === AUSKUNFT_VORLAGE || vorlage === AUSKUNFT_LEAD_VORLAGE) {
    // E-240: Bestandskunden — kein „Hallo und willkommen"; Preis und Kauflink nur vom Server.
    if (!k.name) return { grund: "Kein Name — bei Bestandskunden kein „und willkommen“" };
    if (!k.auskunft) return { grund: "Kein Preis oder Kauflink — Auskunft inzwischen bestellt oder nicht mehr im Kreis des Verkaufs" };
    return { werte: [k.name, k.auskunft.wort, k.auskunft.bei, k.auskunft.preis], knopfWert: k.auskunft.token };
  }
  // {{2}} ist bei diesen Vorlagen der Absender: „hier ist Mara von FIAON".
  if (["fiaon_kk_rueckfrage", "fiaon_kk_termin", "fiaon_kk_nicht_erreicht"].includes(vorlage)) return { werte: [anrede, "Mara"] };
  return { werte: [anrede] };
}

export function vorlagePasst(g: Gruppe, vorlage: string): boolean {
  if (!GRUPPEN[g].vorlagen.includes(vorlage)) return false;
  // Ein Entwurf (E-240) „passt" — gesendet wird er trotzdem erst, wenn Meta ihn freigibt (istFrei).
  return vorlage === "stufen" || !!vorlageDef(vorlage);
}

/** Freigegeben heißt: die Textfassung oder ihre Bildfassung ist bei Meta APPROVED. */
export function istFrei(vorlage: string, frei: Set<string>): boolean {
  return frei.has(vorlage) || frei.has(vorlage.replace(/^fiaon_kk_/, "fiaon_kkb_"));
}

async function freigabeSatz(): Promise<Set<string>> {
  const { freigegebeneVorlagen } = await import("./fiaon-whatsapp");
  return freigegebeneVorlagen().catch(() => new Set<string>());
}

// ── Uhr ─────────────────────────────────────────────────────────────────────
// Nur formatToParts — Number(Intl.format()) ergibt NaN (Zeit-Falle, Gedächtnis).
export function berlinMinutenJetzt(): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const w = (art: string) => Number(teile.find((p) => p.type === art)?.value ?? "0");
  return (w("hour") === 24 ? 0 : w("hour")) * 60 + w("minute");
}
const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

/** Harte Ruhezeit für jede Sendung, auch von Hand: nur 07:00 bis 21:00. */
export function tagsueber(): boolean {
  const m = berlinMinutenJetzt();
  return m >= 7 * 60 && m < 21 * 60;
}

// ═══════════════════════════════════════════════════════════════════════════
// META-TAGESRAUM
//
// Meta erlaubt je Nummer nur so viele Gespräche mit NEUEN Empfängern in 24
// Stunden, wie die Stufe hergibt (50, 250, 1.000 …). Wer darüber schreibt,
// bekommt Fehler — und jede Häufung drückt die Qualitätsbewertung, bis Meta
// die Nummer drosselt. Deshalb zählt hier jede Vorlage der letzten 24 Stunden
// (Begrüßung, Kette, Zentrale, Hand) gegen 80 % der Stufe. Unbekannte Stufe:
// wir rechnen mit 250.
//
// E-250 (28.09.2026): Meta führt die Stufe seit der Umstellung auf das
// Geschäftskonto nicht mehr an der Nummer (messaging_limit_tier fehlt dort),
// sondern am WhatsApp-Konto als whatsapp_business_manager_messaging_limit
// (live: TIER_2K). Bis heute las die Seite nur die Nummer, fiel auf 250 zurück
// und bremste Mara auf 200 statt 1.600 in 24 Stunden.
// ═══════════════════════════════════════════════════════════════════════════
const STUFEN: Record<string, number> = { TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 100000 };

/**
 * E-261 (29.09.2026): Stufe, Qualität und Name aus dem GESPEICHERTEN Stand
 * (fiaon_settings.wa_meta_stand, Takt wa_meta_stand alle 5 Min.). Bis heute las
 * nur, wer den Tagesraum rief — 10 Minuten im Speicher je Instanz; war die
 * Automatik aus und niemand auf der Seite, las niemand die Qualität. Älter als
 * 15 Minuten → metaStandLesen holt einmal frisch (fiaon-wa-bremse.ts).
 * E-250 bleibt: Stufe am WhatsApp-Konto, Qualität an der Nummer.
 */
export async function metaStand(): Promise<{ stufe: string | null; qualitaet: string | null; name: string | null }> {
  const m = await metaStandLesen().catch(() => null);
  // ROT bleibt (01.10.2026): die WIRKSAME Qualität — „UNKNOWN" nach ROT zeigt und zählt als ROT.
  return { stufe: m?.stufe ?? null, qualitaet: m ? wirksameQualitaet(m).q : null, name: m?.name ?? null };
}

export async function tagesRaum(): Promise<{ grenze: number; verbraucht: number; frei: number; stufe: string | null; qualitaet: string | null }> {
  const m = await metaStand();
  const grenze = Math.floor((STUFEN[m.stufe ?? ""] ?? 250) * 0.8);
  const [z] = (await sqlPool`
    SELECT COUNT(DISTINCT nummer)::int AS n FROM fiaon_whatsapp
     WHERE richtung = 'raus' AND vorlage IS NOT NULL AND status <> 'fehler' AND created_at > NOW() - INTERVAL '24 hours'`.catch(() => [{ n: 0 }])) as any[];
  const verbraucht = Number(z?.n || 0);
  return { grenze, verbraucht, frei: Math.max(0, grenze - verbraucht), stufe: m.stufe, qualitaet: m.qualitaet };
}

// ═══════════════════════════════════════════════════════════════════════════
// SENDEN
//
// ── DER LAUF STEHT IN DER DATENBANK (28.09.2026, E-253) ────────────────────
// Justin (28.09., Screenshot): „Versand läuft … 34 gesendet · 4 übersprungen ·
// von 50 — das steht seit 5 Minuten. Warum?" Gemessen: Um 12:29:41 schaltete
// Render beim Deploy den Verkehr auf den neuen Server. Der Lauf lebte nur im
// Arbeitsspeicher des alten (aktuellerLauf); der neue antwortete auf jede
// Abfrage „kein Lauf", und die Seite blieb auf dem letzten Stand stehen.
// Gesendet hatte der alte Server trotzdem alle 50 (44 gesendet, 6
// übersprungen, bis 12:29:58). Ein Lauf über 200 hätte den Deploy nicht
// überlebt: Render beendet den alten Prozess 60 s nach dem Umschalten
// (SIGTERM), 30 s später hart (SIGKILL) — der Rest wäre ohne Spur weggefallen.
// Und „Anhalten" meldete „hält an", während der alte Server weiter sendete.
//
// Jetzt:
//   · Jeder Lauf von Hand ist eine Zeile in fiaon_wa_lauf: Plan (die Personen
//     in Versandreihenfolge), Position, wer ihn trägt (instanz), Herzschlag,
//     Stopp-Wunsch. Die Zahlen kommen aus fiaon_wa_aktion (lauf_id). Jede
//     Instanz antwortet dasselbe, und „Anhalten" wirkt, egal wo es ankommt.
//   · Höchstens EIN Lauf gleichzeitig über alle Instanzen (eindeutiger Index).
//   · SIGTERM (server/index.ts): Der alte Prozess sendet die laufende Nachricht
//     zu Ende und übergibt („unterbrochen"). Der Takt wa_zentrale_fortsetzen
//     (jede Minute, server/routes.ts, nur im Betrieb) übernimmt — atomar, nur
//     einer gewinnt. Ohne SIGTERM (Absturz) übernimmt er, sobald der Herzschlag
//     älter als drei Minuten ist (HERZSCHLAG_ALT_S). Einen Lauf, den derselbe
//     Prozess noch trägt, übernimmt er nie (Nachtrag nach der Gegenprüfung).
//   · Kein Doppelversand durch einen Neustart: Vor JEDER Sendung prüft der
//     Träger, dass der Lauf noch ihm gehört (sonst hört er auf); die Person
//     mitten im Senden ist reserviert (in_arbeit) und wird nach einem Neustart
//     nicht noch einmal angeschrieben; die BASIS lässt ohnehin nur einen Versuch
//     je Person und Tag.
//   · Kein Doppelversand mit ANDEREN Wegen (Nachtrag): Direkt vor Meta nimmt
//     einzelnSenden den Tagesplatz des Menschen (waTagesplatz, fiaon-whatsapp.ts)
//     — Verkaufstakt, Automatik, Lead-Begrüßung und Lead-Kette nehmen ihn auch;
//     genau einer bekommt ihn. Der Verkaufstakt setzt während eines Laufs aus,
//     die Automatik fragt vor jeder Sendung nach einem Lauf von Hand.
//   · Je Happen (25 Personen) wird neu geprüft: Gruppe und BASIS (wer
//     inzwischen schrieb oder zahlte, fällt raus — „entfallen"), Ruhezeit,
//     Metas Tagesraum und Qualität, Freigabe der Vorlage.
//   · Größe: bis LAUF_HOECHSTENS (500), nie mehr als Metas freier Tagesraum.
//
// DEPLOY-WACHE (lesend, vor jedem Push — Datei scratchpad e253/deploy-wache.sql):
//   SELECT id, status, cardinality(plan) - pos AS rest,
//          EXTRACT(EPOCH FROM NOW() - herzschlag)::int AS herzschlag_s
//     FROM fiaon_wa_lauf WHERE status IN ('laeuft', 'unterbrochen');
// Seit E-253 ist ein Deploy mitten im Lauf nur eine Pause von ein, zwei
// Minuten. Für den Deploy VON E-253 selbst gilt die Wache noch: Ein Lauf im
// alten Speicher-Code ist für den neuen unsichtbar (dafür die Zeilen der
// letzten 90 s in fiaon_wa_aktion zählen), und ein offener Tab behält das alte
// JavaScript — die Seite danach einmal neu laden.
// ═══════════════════════════════════════════════════════════════════════════
export type LaufZustand = "laeuft" | "unterbrochen" | "fertig" | "angehalten" | "verfallen";

export interface Lauf {
  id: string;
  /** läuft oder ist unterbrochen (geht gleich von selbst weiter) — die Seite fragt weiter nach */
  laeuft: boolean;
  zustand: LaufZustand;
  quelle: "hand" | "automatik";
  gruppe: Gruppe;
  vorlage: string;
  gesamt: number;
  /** so viele Plan-Einträge sind erledigt (gesendet, übersprungen, Fehler oder entfallen) */
  erledigt: number;
  gesendet: number;
  uebersprungen: number;
  fehler: number;
  /** inzwischen nicht mehr dran (Gruppe/BASIS neu geprüft) — nicht angeschrieben, keine Zeile */
  entfallen: number;
  gruende: Record<string, number>;
  seit: string;
  bis: string | null;
  ausgeloestVon: string | null;
  abgebrochen: boolean;
  /** Stopp-Wunsch liegt vor, der Träger hält nach der laufenden Nachricht an */
  anhaltenAm: string | null;
  /** wie oft ein anderer Prozess den Lauf nach einem Neustart übernommen hat */
  fortsetzungen: number;
  unterbrochenAm: string | null;
  /** warum er vor dem Plan endete (Ruhezeit, Meta-Limit, Tageswechsel …) */
  schluss: string | null;
  /** Sekunden seit dem letzten Lebenszeichen des Trägers */
  herzschlagS: number;
  /** geschätzte Restdauer in Sekunden */
  restS: number;
}

/** E-253: höchstens so viele je Lauf — und nie mehr, als Meta heute noch zulässt (tagesRaum). */
export const LAUF_HOECHSTENS = 500;
/** Je Person ≈ 1,7 s (Sendung + 1,2 s Abstand) — für die Restzeit auf der Seite. */
export const LAUF_SEKUNDEN_JE_PERSON = 1.7;
const LAUF_HAPPEN = 25;
const LAUF_FORTSETZUNGEN = 5;
/**
 * Älter als das = der Träger lebt nicht mehr. E-253 (Nachtrag nach der Gegenprüfung): 180 statt 120 s.
 * Eine Sendung dauert bei einer Meta-Störung bis ≈ 104 s (freigegebeneVorlagen in waSenden 52 s, dazu
 * der POST 3 × 15 s + 7 s), der Anfang eines Happens bis ≈ 116 s (metaStand 2 × 31 s, Freigabe 52 s).
 */
const HERZSCHLAG_ALT_S = 180;

/** Wer diesen Lauf trägt: Render-Instanz (sonst Rechnername), Prozess, Startzeit. */
let instanz = `${String(process.env.RENDER_INSTANCE_ID || "").trim() || hostname()}:${process.pid}:${Date.now().toString(36)}`;
let herunterfahren = false;
let pauseMs = 1200;
let happenGroesse = LAUF_HAPPEN;
export type SendeFn = typeof einzelnSenden;
let senderHuelle: ((echt: SendeFn) => SendeFn) | null = null;
/** Die Läufe, die DIESER Prozess gerade abarbeitet (für die Übergabe bei SIGTERM). */
const inArbeit = new Map<string, Promise<void>>();

/**
 * Nur für den Prüfstand (scripts/pruef-wa-sperre-lauf.ts): eine zweite
 * „Instanz" im selben Prozess (neuer Name UND leerer Speicher — wie ein neuer
 * Server), das Herunterfahren zurücksetzen, Pausen und Happen kürzen, den
 * Versand hüllen (anhalten, zählen). Im Betrieb ruft das niemand.
 */
export function laufPruefstand(o: {
  instanz?: string; herunterfahren?: boolean; pauseMs?: number; happen?: number; huelle?: ((echt: SendeFn) => SendeFn) | null;
} = {}): { instanz: string } {
  if (o.instanz) { instanz = o.instanz; inArbeit.clear(); }
  if (typeof o.herunterfahren === "boolean") herunterfahren = o.herunterfahren;
  if (typeof o.pauseMs === "number") pauseMs = Math.max(0, o.pauseMs);
  if (typeof o.happen === "number") happenGroesse = Math.max(1, Math.round(o.happen));
  if (o.huelle !== undefined) senderHuelle = o.huelle;
  return { instanz };
}

const LAUF_ALT_SQL = `(status = 'unterbrochen' OR (status = 'laeuft' AND herzschlag < NOW() - INTERVAL '${HERZSCHLAG_ALT_S} seconds'))`;
/**
 * E-253 (Nachtrag nach der Gegenprüfung): Ein Lauf, den DIESER Prozess gerade abarbeitet, ist nie „alt" —
 * auch wenn eine lange Sendung den Herzschlag älter als HERZSCHLAG_ALT_S werden lässt. Sonst übernahm der
 * Minutentakt (auf Render dieselbe, einzige Instanz) den eigenen Lauf: „Neustart während des Sendens" für
 * einen Menschen, dessen Nachricht gleich darauf doch rausging, pos zählte doppelt weiter, und der nächste
 * Mensch fiel ohne Zeile aus dem Plan. $1 = instanz, $2 = die ids in inArbeit.
 */
const NICHT_EIGEN_SQL = `NOT (status = 'laeuft' AND instanz = $1 AND id = ANY($2::text[]))`;
const eigeneParameter = (): [string, string[]] => [instanz, Array.from(inArbeit.keys())];
const HEUTE_BERLIN_SQL = (spalte: string) => `(${spalte} AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`;

/** Der Stand eines Laufs aus der Datenbank — ohne id der offene, sonst der jüngste der letzten 12 Stunden. */
export async function laufStand(id?: string | null): Promise<Lauf | null> {
  await zentraleSchema();
  const [l] = (id
    ? await sqlPool`
        SELECT id, quelle, gruppe, vorlage, ausgeloest_von, cardinality(plan) AS gesamt, pos, entfallen, status, schluss,
               anhalten_am, fortsetzungen, unterbrochen_am, seit, bis, EXTRACT(EPOCH FROM (NOW() - herzschlag))::int AS herzschlag_s
          FROM fiaon_wa_lauf WHERE id = ${String(id).slice(0, 40)}`
    : await sqlPool`
        SELECT id, quelle, gruppe, vorlage, ausgeloest_von, cardinality(plan) AS gesamt, pos, entfallen, status, schluss,
               anhalten_am, fortsetzungen, unterbrochen_am, seit, bis, EXTRACT(EPOCH FROM (NOW() - herzschlag))::int AS herzschlag_s
          FROM fiaon_wa_lauf
         WHERE status IN ('laeuft', 'unterbrochen') OR seit > NOW() - INTERVAL '12 hours'
         ORDER BY (status IN ('laeuft', 'unterbrochen')) DESC, seit DESC LIMIT 1`) as any[];
  if (!l) return null;
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE ok)::int AS gesendet,
           COUNT(*) FILTER (WHERE NOT ok AND COALESCE(grund, '') NOT LIKE 'Fehler: %')::int AS uebersprungen,
           COUNT(*) FILTER (WHERE NOT ok AND COALESCE(grund, '') LIKE 'Fehler: %')::int AS fehler
      FROM fiaon_wa_aktion WHERE lauf_id = ${l.id}`) as any[];
  const gruende: Record<string, number> = {};
  for (const r of (await sqlPool`
    SELECT LEFT(COALESCE(grund, 'unbekannt'), 90) AS g, COUNT(*)::int AS n
      FROM fiaon_wa_aktion WHERE lauf_id = ${l.id} AND NOT ok GROUP BY 1 ORDER BY 2 DESC LIMIT 12`) as any[]) {
    gruende[String(r.g)] = Number(r.n);
  }
  const zustand = (["laeuft", "unterbrochen", "fertig", "angehalten", "verfallen"].includes(String(l.status)) ? String(l.status) : "fertig") as LaufZustand;
  const gesamt = Number(l.gesamt || 0);
  const erledigt = Math.min(gesamt, Number(l.pos || 0));
  const laeuft = zustand === "laeuft" || zustand === "unterbrochen";
  return {
    id: String(l.id), laeuft, zustand,
    quelle: l.quelle === "automatik" ? "automatik" : "hand",
    gruppe: (istGruppe(l.gruppe) ? l.gruppe : "neu") as Gruppe,
    vorlage: String(l.vorlage),
    gesamt, erledigt,
    gesendet: Number(z?.gesendet || 0), uebersprungen: Number(z?.uebersprungen || 0), fehler: Number(z?.fehler || 0),
    entfallen: Number(l.entfallen || 0),
    gruende,
    seit: new Date(l.seit).toISOString(),
    bis: l.bis ? new Date(l.bis).toISOString() : null,
    ausgeloestVon: l.ausgeloest_von ?? null,
    abgebrochen: zustand === "angehalten",
    anhaltenAm: l.anhalten_am ? new Date(l.anhalten_am).toISOString() : null,
    fortsetzungen: Number(l.fortsetzungen || 0),
    unterbrochenAm: l.unterbrochen_am ? new Date(l.unterbrochen_am).toISOString() : null,
    schluss: l.schluss ?? null,
    herzschlagS: Math.max(0, Number(l.herzschlag_s || 0)),
    restS: laeuft ? Math.round((gesamt - erledigt) * LAUF_SEKUNDEN_JE_PERSON) : 0,
  };
}

/**
 * Aufräumen, was niemand mehr trägt (unterbrochen oder Herzschlag zu alt):
 * von gestern → verfallen; mit Stopp-Wunsch → angehalten; in der Ruhezeit oder
 * nach zu vielen Neustarts → fertig mit Grund. Danach gilt der eindeutige Index
 * wieder nur für echte, lebende Läufe.
 */
async function laufAufraeumen(): Promise<void> {
  const eigen = eigeneParameter();
  await sqlPool.unsafe(`
    UPDATE fiaon_wa_lauf SET status = 'verfallen', bis = NOW(), schluss = 'Tageswechsel — der Rest wird nicht mehr gesendet.'
     WHERE ${LAUF_ALT_SQL} AND ${NICHT_EIGEN_SQL} AND NOT ${HEUTE_BERLIN_SQL("seit")}`, eigen);
  await sqlPool.unsafe(`
    UPDATE fiaon_wa_lauf SET status = 'angehalten', bis = NOW()
     WHERE ${LAUF_ALT_SQL} AND ${NICHT_EIGEN_SQL} AND anhalten_am IS NOT NULL`, eigen);
  if (!tagsueber()) {
    await sqlPool.unsafe(`
      UPDATE fiaon_wa_lauf SET status = 'fertig', bis = NOW(), schluss = 'Ruhezeit begonnen (21 Uhr) — der Rest wurde nicht gesendet.'
       WHERE ${LAUF_ALT_SQL} AND ${NICHT_EIGEN_SQL}`, eigen);
  }
  await sqlPool.unsafe(`
    UPDATE fiaon_wa_lauf SET status = 'fertig', bis = NOW(),
           schluss = 'Nach ${LAUF_FORTSETZUNGEN} Neustarts beendet — der Rest wurde nicht gesendet.'
     WHERE ${LAUF_ALT_SQL} AND ${NICHT_EIGEN_SQL} AND fortsetzungen >= ${LAUF_FORTSETZUNGEN}`, eigen);
}

/** Läuft (oder wartet nach einem Neustart) gerade ein Lauf — egal auf welcher Instanz? */
async function offenerLauf(): Promise<{ id: string; status: string } | null> {
  const [l] = (await sqlPool`SELECT id, status FROM fiaon_wa_lauf WHERE status IN ('laeuft', 'unterbrochen') LIMIT 1`) as any[];
  return l ? { id: String(l.id), status: String(l.status) } : null;
}

/**
 * Läuft gerade ein Versand von Hand (oder wartet er nach einem Neustart)? Für andere Wege, die
 * so lange aussetzen (Verkaufstakt, E-253). Bei einer Störung: nein — dann schützt der Tagesplatz.
 */
export async function waLaufOffen(): Promise<boolean> {
  try {
    await zentraleSchema();
    return !!(await offenerLauf());
  } catch {
    return false;
  }
}

/** Für die Bremse zählt die Art der Vorlage: „stufen" sind die Erinnerungen tag1…letzte — alle Werbung. */
function bremsVorlage(gewaehlt: string): string {
  return gewaehlt === "stufen" ? "fiaon_kk_tag1" : gewaehlt;
}

/**
 * E-261 (Gegenprüfung 29.09.): die Bremse für eine GRUPPE der Zentrale. Bei ROT und GELB
 * zählt die Gruppe: Service ist nur die Monatsrate (rate_offen) — jede andere Gruppe gilt
 * als Werbung, auch mit einer Termin-Vorlage. Die Pause gilt für alle Gruppen gleich.
 * Dieselbe Regel für Hand-Lauf (laufStarten, laufArbeiten), Automatik und die Seite (zentraleLage).
 */
export async function gruppenBremse(g: Gruppe, vorlage: string, weg: string): Promise<WaBremseErgebnis> {
  const b = await waBremse({ vorlage: bremsVorlage(vorlage), werbung: g !== "rate_offen", weg });
  if (!b.erlaubt && !b.pause && g !== "rate_offen") {
    return {
      ...b,
      grund: "Meta-Qualität ROT — die Zentrale schickt gerade nur die Monatsrate. Diese Gruppe gilt als Werbung an viele "
        + "(auch mit der Termin-Vorlage) und wartet, bis Meta wieder GELB oder GRÜN meldet.",
    };
  }
  return b;
}

/** Die Schlusszeile eines Laufs, den die Bremse beendet (E-261). */
function bremsSchluss(b: { pause: boolean; grund: string | null }): string {
  if (b.pause) {
    const code = /\(#(\d+)\)/.exec(String(b.grund ?? ""))?.[1];
    return `WhatsApp pausiert${code ? ` (#${code})` : ""} — der Rest wurde nicht gesendet.`;
  }
  return "Meta bewertet die Nummer mit ROT — Werbe-Vorlagen gestoppt, der Rest wurde nicht gesendet.";
}

function laufAnstossen(id: string): void {
  if (inArbeit.has(id)) return;
  const p = laufArbeiten(id)
    .catch((e) => console.error(`[WA-ZENTRALE] Lauf ${id}:`, e))
    .finally(() => { inArbeit.delete(id); });
  inArbeit.set(id, p);
}

async function protokoll(k: Kandidat, g: Gruppe, vorlage: string, quelle: string, laufId: string, von: string | null, ok: boolean, grund: string | null, waId: string | null = null, fehlerCode: number | null = null) {
  // E-261: Metas Code eines synchronen Fehlers steht in fehler_code (der asynchrone kommt über waEingang).
  // Fehlen die Spalten noch (Migration 086 nicht durch, 42703), steht die Zeile trotzdem da — ohne Code.
  const zeile = grund ? grund.slice(0, 300) : null;
  await sqlPool`
    INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, lauf_id, ausgeloest_von, wa_id, ok, grund, fehler_code, fehler_am)
    VALUES (${k.personId}, ${g}, ${vorlage}, ${quelle}, ${laufId}, ${von}, ${waId}, ${ok}, ${zeile},
            ${fehlerCode}, ${fehlerCode ? new Date() : null})`.catch(async (e) => {
    if (String((e as any)?.code ?? "") !== "42703") return void console.error("[WA-ZENTRALE] Protokoll:", e);
    await sqlPool`
      INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, lauf_id, ausgeloest_von, wa_id, ok, grund)
      VALUES (${k.personId}, ${g}, ${vorlage}, ${quelle}, ${laufId}, ${von}, ${waId}, ${ok}, ${zeile})`.catch((e2) => console.error("[WA-ZENTRALE] Protokoll:", e2));
  });
}

async function einzelnSenden(
  g: Gruppe, gewaehlt: string, k: Kandidat, quelle: "hand" | "automatik" | "verkaufstakt", laufId: string, von: string | null, frei: Set<string>,
): Promise<{ ok: boolean; grund?: string; gebremst?: boolean }> {
  const vorlage = vorlageFuerKandidat(gewaehlt, k);
  if (!istFrei(vorlage, frei)) {
    const grund = "Vorlage bei Meta noch nicht freigegeben";
    await protokoll(k, g, vorlage, quelle, laufId, von, false, grund);
    return { ok: false, grund };
  }
  const w = werteFuer(vorlage, k);
  if ("grund" in w) {
    await protokoll(k, g, vorlage, quelle, laufId, von, false, w.grund);
    return { ok: false, grund: w.grund };
  }
  const { waSenden } = await import("./fiaon-whatsapp");
  // E-244: mit dem Land der Person; „+15…" aus dem Meta-Formular ist eine deutsche Handynummer, kein +1.
  const { nummerFuerVersand } = await import("@shared/fiaon-whatsapp-erlaubnis");
  const nummer = nummerFuerVersand(k.telefon, k.land);
  if (!nummer) {
    await protokoll(k, g, vorlage, quelle, laufId, von, false, "Keine WhatsApp-Nummer");
    return { ok: false, grund: "Keine WhatsApp-Nummer" };
  }
  // E-253 (28.09.2026, Nachtrag nach der Gegenprüfung): der Tagesplatz DIREKT vor Meta — die Prüfung am
  // Anfang des Happens ist bis zu 40 s alt. Genau ein Weg bekommt ihn (Lauf, Automatik, Verkaufstakt,
  // Lead-Begrüßung, Lead-Kette); wer leer ausgeht, sendet nicht (fiaon-whatsapp.ts, waTagesplatz).
  const { waTagesplatz } = await import("./fiaon-whatsapp");
  const platz = await waTagesplatz({ personId: k.personId, nummer, weg: `zentrale_${quelle}`, vorlage });
  // E-261: Hält die Bremse (Pause oder ROT) an, steht KEINE Zeile da — der Mensch behält seinen Tag,
  // der Aufrufer hört auf (Lauf mit Schlusszeile, Automatik und Verkaufstakt bis zum nächsten Takt).
  if (!platz.ok && platz.gebremst) return { ok: false, grund: platz.grund, gebremst: true };
  if (!platz.ok) {
    await protokoll(k, g, vorlage, quelle, laufId, von, false, platz.grund);
    return { ok: false, grund: platz.grund };
  }
  const r = await waSenden(nummer, { vorlage, werte: w.werte, knopfWert: w.knopfWert }, { personId: k.personId, leadId: k.leadId, von: "Mara" });
  if (!r.ok && r.gebremst) return { ok: false, grund: r.grund, gebremst: true };
  // E-261: Lehnt Meta sofort ab (mit Code), ist das ein Fehler, kein „übersprungen" — Präfix wie die Lauf-Zählung.
  const metaText = String(r.grund || "");
  const grundZeile = r.ok ? null
    : r.code ? `Fehler: ${/^\(#\d+\)/.test(metaText) ? metaText : `(#${r.code}) ${metaText}`}` : (metaText || "Senden fehlgeschlagen");
  await protokoll(k, g, vorlage, quelle, laufId, von, r.ok, grundZeile, r.waId ?? null, r.ok ? null : r.code ?? null);
  if (r.ok) {
    const { waAktenvermerk } = await import("./fiaon-whatsapp");
    await waAktenvermerk(k.personId, `WhatsApp „${vorlage}“ gesendet (${GRUPPEN[g].titel}, ${quelle === "hand" ? `von Hand gestartet${von ? ` durch ${von}` : ""}` : quelle === "verkaufstakt" ? "Verkaufstakt Bonitätsauskunft" : "Automatik"}).`);
  }
  return r.ok ? { ok: true } : { ok: false, grund: r.grund };
}

/**
 * DIE WHATSAPP DES VERKAUFSTAKTS (24.09.2026, E-240) — eine Nachricht an
 * genau einen Menschen der Gruppe „auskunft_fehlt". Dieselben Wände wie jeder
 * Versand hier (Ruhezeit, Meta-Freigabe, Tagesraum, Qualität, BASIS), dazu
 * die nachgewiesene Einwilligung. Protokolliert als quelle „verkaufstakt" —
 * so zehrt sie nicht vom Stundenkontingent der Automatik, wohl aber vom
 * Meta-Tagesraum (der zählt jede Vorlage).
 */
export async function auskunftWhatsAppSenden(personId: number, opts: { laufId: string; von: string }): Promise<{ ok: boolean; grund?: string; gebremst?: boolean }> {
  if (!tagsueber()) return { ok: false, grund: "Ruhezeit (21–7 Uhr)" };
  // E-261: die Auskunft-Vorlagen sind Werbung — in der Pause und bei ROT wartet die WhatsApp-Stufe (die Mail läuft weiter).
  const bremse = await waBremse({ werbung: true, weg: "verkaufstakt" });
  if (!bremse.erlaubt) return { ok: false, grund: bremse.grund ?? "WhatsApp pausiert", gebremst: true };
  // E-253 (Nachtrag): Solange ein Versand von Hand läuft, wartet der Verkaufstakt (er fragt waLaufOffen
  // vor jeder WhatsApp und hört dann auf, ohne den Menschen für heute zu verbrauchen). Kommt der Lauf
  // dazwischen, schützt der Tagesplatz in einzelnSenden.
  if (await waLaufOffen()) return { ok: false, grund: "Ein Versand der WhatsApp-Zentrale läuft — der Verkaufstakt wartet." };
  const { waKonfig } = await import("./fiaon-whatsapp");
  if (!waKonfig().bereit) return { ok: false, grund: "WhatsApp nicht eingerichtet" };
  const frei = await freigabeSatz();
  if (!istFrei(AUSKUNFT_VORLAGE, frei) && !istFrei(AUSKUNFT_LEAD_VORLAGE, frei)) return { ok: false, grund: "Vorlage bei Meta noch nicht freigegeben" };
  const raum = await tagesRaum();
  if (raum.frei <= 0) return { ok: false, grund: "Meta-Tageslimit erreicht" };
  const k = await auskunftKandidat(personId, { mitEinwilligung: true });
  if (!k) return { ok: false, grund: "Heute nicht in der Gruppe (Regeln der Zentrale, Einwilligung oder Kreis des Verkaufs)" };
  // E-241: die Vorlage des Segments — ist genau sie nicht frei, wartet dieser Mensch (einzelnSenden protokolliert es).
  const vorlage = vorlageFuerKandidat(AUSKUNFT_VORLAGE, k);
  if (!istFrei(vorlage, frei)) return { ok: false, grund: `Vorlage „${vorlage}“ bei Meta noch nicht freigegeben` };
  return einzelnSenden("auskunft_fehlt", vorlage, k, "verkaufstakt", opts.laufId, opts.von, frei);
}

/**
 * Ein Lauf von Hand: die nächsten `anzahl` aus der Gruppe, eine Nachricht nach
 * der anderen mit kurzem Abstand. Läuft schon einer (auf irgendeiner Instanz),
 * startet kein zweiter. E-253: Der Plan steht VOR der Antwort fest und in der
 * Datenbank — die erste Antwort nennt schon die richtige Gesamtzahl.
 */
export async function laufStarten(opts: { gruppe: Gruppe; vorlage: string; anzahl: number; quelle: "hand" | "automatik"; von: string | null }): Promise<{ ok: true; lauf: Lauf } | { ok: false; grund: string }> {
  await zentraleSchema();
  if (herunterfahren) return { ok: false, grund: "Der Server startet gerade neu. Bitte in einer Minute noch einmal." };
  await laufAufraeumen();
  const offen = await offenerLauf();
  if (offen) {
    return { ok: false, grund: offen.status === "unterbrochen"
      ? "Ein Versand wurde durch einen Neustart des Servers unterbrochen und geht gleich von selbst weiter. Bitte warten — oder ihn anhalten."
      : "Es läuft schon ein Versand. Bitte warten, bis er fertig ist." };
  }
  if (!vorlagePasst(opts.gruppe, opts.vorlage)) return { ok: false, grund: "Diese Vorlage passt nicht zu dieser Gruppe." };
  if (!tagsueber()) return { ok: false, grund: "Zwischen 21:00 und 07:00 schreiben wir niemanden an." };
  // E-261: zuerst die Bremse (Pause: keine Vorlage; ROT: nur die Monatsrate; GELB: höchstens halber freier Tagesraum).
  const bremse = await gruppenBremse(opts.gruppe, opts.vorlage, "zentrale_hand");
  if (!bremse.erlaubt) return { ok: false, grund: bremse.grund ?? "WhatsApp pausiert." };
  const frei = await freigabeSatz();
  if (opts.vorlage !== "stufen" && !istFrei(opts.vorlage, frei)) return { ok: false, grund: "Diese Vorlage ist bei Meta noch nicht freigegeben." };
  const raum = await tagesRaum();
  if (raum.frei <= 0) return { ok: false, grund: `Das Tageslimit von Meta ist ausgeschöpft (${raum.verbraucht} von ${raum.grenze} in 24 Stunden). Morgen geht es weiter.` };
  // E-253: bis 500 statt 200 — gekoppelt an Metas freien Tagesraum (E-250: Stufe 2K, also 1.600 in 24 h).
  // E-261: bei GELB höchstens der halbe freie Tagesraum.
  const gelbDeckel = Math.max(1, mitFaktor(raum.frei, bremse.faktor));
  const anzahl = Math.min(LAUF_HOECHSTENS, raum.frei, Math.max(1, Math.round(Number(opts.anzahl) || 0)), gelbDeckel);
  const plan = await kandidatenIds(opts.gruppe, anzahl);
  if (!plan.length) return { ok: false, grund: "In dieser Gruppe ist gerade niemand dran." };
  const id = `L${Date.now().toString(36)}`;
  try {
    await sqlPool`
      INSERT INTO fiaon_wa_lauf (id, quelle, gruppe, vorlage, ausgeloest_von, plan, instanz)
      VALUES (${id}, ${opts.quelle}, ${opts.gruppe}, ${opts.vorlage}, ${opts.von}, ${plan}::int[], ${instanz})`;
  } catch (e) {
    if (String((e as any)?.code ?? "") === "23505") return { ok: false, grund: "Es läuft schon ein Versand. Bitte warten, bis er fertig ist." };
    throw e;
  }
  laufAnstossen(id);
  const stand = await laufStand(id);
  return stand ? { ok: true, lauf: stand } : { ok: false, grund: "Der Versand ließ sich nicht anlegen." };
}

/**
 * Die Arbeit eines Laufs — EIN Weg für Start und Fortsetzung. Liest den Plan ab
 * `pos` und hört sofort auf, sobald der Lauf nicht mehr dieser Instanz gehört.
 */
async function laufArbeiten(id: string): Promise<void> {
  const ich = instanz; // festgehalten: Übernimmt ein anderer, findet jedes UPDATE unten 0 Zeilen
  const [l] = (await sqlPool`
    SELECT id, quelle, gruppe, vorlage, ausgeloest_von, plan, pos FROM fiaon_wa_lauf
     WHERE id = ${id} AND instanz = ${ich} AND status = 'laeuft'`) as any[];
  if (!l || !istGruppe(l.gruppe)) return;
  const g: Gruppe = l.gruppe;
  const gewaehlt = String(l.vorlage);
  const quelle: "hand" | "automatik" = l.quelle === "automatik" ? "automatik" : "hand";
  const von: string | null = l.ausgeloest_von ?? null;
  const plan: number[] = (Array.isArray(l.plan) ? l.plan : []).map(Number);
  let pos = Number(l.pos) || 0;
  const senden: SendeFn = senderHuelle ? senderHuelle(einzelnSenden) : einzelnSenden;
  let beendetVonMir = false; // nur wer den Lauf beendet, schreibt die Schlusszeile ins Protokoll
  const beenden = async (status: LaufZustand, schluss: string | null = null) => {
    const r = (await sqlPool`
      UPDATE fiaon_wa_lauf SET status = ${status}, schluss = COALESCE(${schluss}, schluss), bis = NOW(), in_arbeit = NULL, herzschlag = NOW()
       WHERE id = ${id} AND instanz = ${ich} AND status = 'laeuft' RETURNING id`) as any[];
    beendetVonMir = r.length > 0;
  };
  const uebergeben = async () => {
    await sqlPool`
      UPDATE fiaon_wa_lauf SET status = 'unterbrochen', unterbrochen_am = NOW(), in_arbeit = NULL
       WHERE id = ${id} AND instanz = ${ich} AND status = 'laeuft'`;
  };
  try {
    while (pos < plan.length) {
      // ── Vor jedem Happen: was sich unterwegs ändern kann ──────────────────
      if (herunterfahren) return void await uebergeben();
      if (!tagsueber()) return void await beenden("fertig", "Ruhezeit begonnen (21 Uhr) — der Rest wurde nicht gesendet.");
      // E-261: die Bremse vor jedem Happen (und unten vor jedem Menschen) — Schlusszeile statt „übersprungen" je Mensch.
      const bremse = await gruppenBremse(g, gewaehlt, "zentrale_lauf");
      if (!bremse.erlaubt) return void await beenden("fertig", bremsSchluss(bremse));
      const raum = await tagesRaum();
      let freiRest = raum.frei;
      if (freiRest <= 0) return void await beenden("fertig", "Metas Tageslimit ist erreicht — der Rest wurde nicht gesendet.");
      const frei = await freigabeSatz();
      if (gewaehlt !== "stufen" && !istFrei(gewaehlt, frei)) return void await beenden("fertig", "Die Vorlage ist bei Meta nicht mehr freigegeben — der Rest wurde nicht gesendet.");
      const happen = plan.slice(pos, pos + happenGroesse);
      // Gruppe und BASIS neu: wer inzwischen schrieb, zahlte, „STOPP" sagte oder heute schon etwas bekam, fällt raus.
      const gueltig = new Map((await kandidaten(g, happen.length, [], happen)).map((k) => [k.personId, k] as const));
      for (const personId of happen) {
        if (herunterfahren) return void await uebergeben();
        if (!tagsueber()) return void await beenden("fertig", "Ruhezeit begonnen (21 Uhr) — der Rest wurde nicht gesendet.");
        if (freiRest <= 0) return void await beenden("fertig", "Metas Tageslimit ist erreicht — der Rest wurde nicht gesendet.");
        const bremseJetzt = await gruppenBremse(g, gewaehlt, "zentrale_lauf");
        if (!bremseJetzt.erlaubt) return void await beenden("fertig", bremsSchluss(bremseJetzt));
        // Herzschlag + Reservierung — und die Frage, ob der Lauf noch uns gehört (Fencing).
        const [h] = (await sqlPool`
          UPDATE fiaon_wa_lauf SET herzschlag = NOW(), in_arbeit = ${personId}
           WHERE id = ${id} AND instanz = ${ich} AND status = 'laeuft' AND plan[pos + 1] = ${personId}
           RETURNING anhalten_am`) as any[];
        if (!h) return; // Jemand anders trägt den Lauf (oder er ist beendet) — sofort aufhören.
        if (h.anhalten_am) return void await beenden("angehalten");
        const k = gueltig.get(personId);
        if (!k) {
          const [w] = (await sqlPool`
            UPDATE fiaon_wa_lauf SET pos = pos + 1, in_arbeit = NULL, entfallen = entfallen + 1
             WHERE id = ${id} AND instanz = ${ich} AND status = 'laeuft'
               AND in_arbeit = ${personId} AND plan[pos + 1] = ${personId} RETURNING pos`) as any[];
          if (!w) return;
          pos++;
          continue;
        }
        try {
          const r = await senden(g, gewaehlt, k, quelle, id, von, frei);
          if (r.ok) freiRest--;
          // E-261: Die Bremse griff zwischen Prüfung und Sendung — keine Zeile für diesen Menschen, der Lauf endet hier.
          if (!r.ok && r.gebremst) {
            return void await beenden("fertig", bremsSchluss({ pause: /^WhatsApp pausiert/.test(String(r.grund ?? "")), grund: r.grund ?? null }));
          }
        } catch (e) {
          // Jede Ausnahme steht als Zeile da — „höchstens ein Versuch je Person und Tag" gilt auch hier.
          await protokoll(k, g, vorlageFuerKandidat(gewaehlt, k), quelle, id, von, false, `Fehler: ${String((e as Error)?.message || e)}`);
        }
        // E-253 (Nachtrag): pos zählt nur weiter, wenn die Reservierung noch genau dieser Mensch ist —
        // nie doppelt, falls unterwegs jemand anders den Platz schon weitergezählt hat.
        const [w] = (await sqlPool`
          UPDATE fiaon_wa_lauf SET pos = pos + 1, in_arbeit = NULL, herzschlag = NOW()
           WHERE id = ${id} AND instanz = ${ich} AND status = 'laeuft'
             AND in_arbeit = ${personId} AND plan[pos + 1] = ${personId} RETURNING pos`) as any[];
        if (!w) return;
        pos++;
        if (pos < plan.length) await new Promise((res) => setTimeout(res, pauseMs));
      }
    }
    await beenden("fertig");
  } catch (e) {
    // Eine Störung (Datenbank, Netz): nicht liegen lassen, sondern übergeben — der Takt setzt fort (höchstens fünfmal).
    console.error(`[WA-ZENTRALE] Lauf ${id} gestört:`, e);
    await sqlPool`
      UPDATE fiaon_wa_lauf SET status = 'unterbrochen', unterbrochen_am = NOW(),
             schluss = ${`Störung: ${String((e as Error)?.message || e).slice(0, 200)}`}
       WHERE id = ${id} AND instanz = ${ich} AND status = 'laeuft'`.catch(() => {});
  } finally {
    const s = beendetVonMir ? await laufStand(id).catch(() => null) : null;
    if (s && !s.laeuft) {
      console.log(`[WA-ZENTRALE] Lauf ${id} (${s.quelle}, ${s.gruppe}, ${s.vorlage}): ${s.gesendet} gesendet, ${s.uebersprungen} übersprungen, `
        + `${s.entfallen} entfallen, ${s.fehler} Fehler — ${s.zustand}${s.fortsetzungen ? `, ${s.fortsetzungen}× fortgesetzt` : ""}${s.schluss ? ` (${s.schluss})` : ""}`);
    }
  }
}

/**
 * „Anhalten" — wirkt auf jeder Instanz: Der Wunsch steht in der Datenbank, der
 * Träger hält nach der laufenden Nachricht an. Ein unterbrochener Lauf (niemand
 * trägt ihn) ist sofort angehalten. `angehalten` = es gab etwas anzuhalten.
 */
export async function laufAbbrechen(von: string | null = null): Promise<{ angehalten: boolean; id: string | null; zustand: LaufZustand | null }> {
  await zentraleSchema();
  const [z] = (await sqlPool`
    UPDATE fiaon_wa_lauf
       SET anhalten_am = NOW(), anhalten_von = ${von},
           status = CASE WHEN status = 'unterbrochen' THEN 'angehalten' ELSE status END,
           bis = CASE WHEN status = 'unterbrochen' THEN NOW() ELSE bis END
     WHERE status IN ('laeuft', 'unterbrochen') AND anhalten_am IS NULL
     RETURNING id, status`) as any[];
  if (z) console.log(`[WA-ZENTRALE] Lauf ${z.id}: Anhalten durch ${von ?? "?"} (${z.status})`);
  return z ? { angehalten: true, id: String(z.id), zustand: String(z.status) as LaufZustand } : { angehalten: false, id: null, zustand: null };
}

/**
 * SIGTERM (server/index.ts): nichts Neues mehr anfangen, die laufende Nachricht
 * zu Ende senden (höchstens `maxMs`), dann „unterbrochen" — der Takt einer
 * anderen Instanz übernimmt. Hängt die Sendung länger, bleibt die Person
 * reserviert (in_arbeit) und wird nicht noch einmal angeschrieben.
 */
export async function laufUebergeben(maxMs = 15_000): Promise<{ uebergeben: number }> {
  herunterfahren = true;
  // Trägt dieser Prozess keinen Lauf, gibt es nichts zu übergeben (auch keine Datenbank-Frage beim Beenden).
  if (!inArbeit.size) return { uebergeben: 0 };
  const bis = Date.now() + maxMs;
  while (inArbeit.size && Date.now() < bis) {
    await Promise.race([...Array.from(inArbeit.values()), new Promise((r) => setTimeout(r, 250))]);
  }
  const zeilen = (await sqlPool`
    UPDATE fiaon_wa_lauf SET status = 'unterbrochen', unterbrochen_am = NOW()
     WHERE instanz = ${instanz} AND status = 'laeuft' RETURNING id`.catch((e) => {
    console.error("[WA-ZENTRALE] Übergabe:", e);
    return [];
  })) as any[];
  const [u] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_wa_lauf WHERE instanz = ${instanz} AND status = 'unterbrochen'
       AND unterbrochen_am > NOW() - INTERVAL '1 minute'`.catch(() => [{ n: zeilen.length }])) as any[];
  return { uebergeben: Number(u?.n ?? zeilen.length) };
}

/**
 * Der Takt „wa_zentrale_fortsetzen" (jede Minute, nur im Betrieb): räumt auf und
 * übernimmt einen unterbrochenen oder verwaisten Lauf von heute — atomar: Bei
 * zwei Instanzen gewinnt genau eine (READ COMMITTED prüft die Bedingung nach
 * der Zeilensperre neu). Die reservierte Person wird nicht noch einmal gesendet.
 */
export async function laufFortsetzen(): Promise<{ id: string | null; grund?: string }> {
  if (herunterfahren) return { id: null, grund: "fährt herunter" };
  await zentraleSchema();
  await laufAufraeumen();
  // E-253 (Nachtrag): nie den eigenen, noch lebenden Lauf (NICHT_EIGEN_SQL) — $1 ist zugleich die neue instanz.
  const [l] = (await sqlPool.unsafe(`
    UPDATE fiaon_wa_lauf
       SET status = 'laeuft', instanz = $1, herzschlag = NOW(), fortsetzungen = fortsetzungen + 1,
           unterbrochen_am = COALESCE(unterbrochen_am, NOW()), schluss = NULL
     WHERE anhalten_am IS NULL AND fortsetzungen < ${LAUF_FORTSETZUNGEN}
       AND ${LAUF_ALT_SQL} AND ${NICHT_EIGEN_SQL} AND ${HEUTE_BERLIN_SQL("seit")}
     RETURNING id, gruppe, vorlage, quelle, ausgeloest_von, pos, in_arbeit, cardinality(plan) AS gesamt`, eigeneParameter())) as any[];
  if (!l) return { id: null, grund: "nichts zu übernehmen" };
  const ich = instanz;
  if (l.in_arbeit != null) {
    // Die Person mitten im Senden: Hat sie in diesem Lauf schon eine Zeile, ist sie erledigt. Sonst ist offen,
    // ob die Nachricht bei Meta ankam — lieber keine als zwei: heute nicht noch einmal, mit einer ehrlichen Zeile.
    const p = Number(l.in_arbeit);
    const [da] = (await sqlPool`SELECT 1 AS x FROM fiaon_wa_aktion WHERE lauf_id = ${l.id} AND person_id = ${p} LIMIT 1`) as any[];
    if (!da) {
      await sqlPool`
        INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, lauf_id, ausgeloest_von, ok, grund)
        VALUES (${p}, ${l.gruppe}, ${l.vorlage}, ${l.quelle}, ${l.id}, ${l.ausgeloest_von ?? null}, FALSE,
                'Neustart während des Sendens — heute nicht noch einmal (ob sie rausging, steht im Verlauf)')`;
    }
    await sqlPool`
      UPDATE fiaon_wa_lauf SET pos = pos + 1, in_arbeit = NULL
       WHERE id = ${l.id} AND instanz = ${ich} AND status = 'laeuft' AND in_arbeit = ${p} AND plan[pos + 1] = ${p}`;
  }
  console.log(`[WA-ZENTRALE] Lauf ${l.id} nach Neustart übernommen (${Number(l.pos)} von ${Number(l.gesamt)} erledigt${l.in_arbeit != null ? ", eine Person war mitten im Senden" : ""})`);
  laufAnstossen(String(l.id));
  return { id: String(l.id) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUTOMATIK
// ═══════════════════════════════════════════════════════════════════════════
export interface Automatik {
  an: boolean;
  von: string;       // „07:40"
  bis: string;       // „20:45"
  jeStunde: number;  // 5
  gruppen: Gruppe[]; // Reihenfolge = Vorrang
  vorlagen: Partial<Record<Gruppe, string>>;
  geaendertVon?: string | null;
  geaendertAm?: string | null;
}

const AUTOMATIK_KEY = "wa_zentrale_automatik";
export const AUTOMATIK_VORGABE: Automatik = {
  an: false, von: "07:40", bis: "20:45", jeStunde: 5,
  gruppen: ["neu", "zahlung_offen", "abbrecher", "ohne_antrag"],
  vorlagen: { neu: "fiaon_kk_anfrage", zahlung_offen: "fiaon_kk_rechnung", abbrecher: "fiaon_kk_antrag_offen", ohne_antrag: "stufen", rate_offen: "fiaon_kk_rate" },
};

export async function automatik(): Promise<Automatik> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${AUTOMATIK_KEY}`.catch(() => [] as any[])) as any[];
  if (!r?.value) return { ...AUTOMATIK_VORGABE, vorlagen: { ...AUTOMATIK_VORGABE.vorlagen } };
  try {
    const roh = JSON.parse(String(r.value));
    const a: Automatik = { ...AUTOMATIK_VORGABE, ...roh, vorlagen: { ...AUTOMATIK_VORGABE.vorlagen, ...(roh?.vorlagen || {}) } };
    a.gruppen = (a.gruppen || []).filter(istGruppe);
    return a;
  } catch { return { ...AUTOMATIK_VORGABE, vorlagen: { ...AUTOMATIK_VORGABE.vorlagen } }; }
}

/** Für die alte Stundenkette: Ist die Zentrale-Automatik an, pausiert sie. */
export async function automatikAn(): Promise<boolean> {
  return (await automatik()).an === true;
}

export async function automatikSetzen(neu: Partial<Automatik>, von: string | null): Promise<{ ok: true; automatik: Automatik } | { ok: false; grund: string }> {
  const alt = await automatik();
  const a: Automatik = {
    ...alt,
    ...(typeof neu.an === "boolean" ? { an: neu.an } : {}),
    ...(typeof neu.von === "string" ? { von: neu.von } : {}),
    ...(typeof neu.bis === "string" ? { bis: neu.bis } : {}),
    ...(neu.jeStunde != null ? { jeStunde: Number(neu.jeStunde) } : {}),
    ...(Array.isArray(neu.gruppen) ? { gruppen: neu.gruppen } : {}),
    vorlagen: { ...alt.vorlagen, ...(neu.vorlagen && typeof neu.vorlagen === "object" ? neu.vorlagen : {}) },
  };
  if (!/^\d{2}:\d{2}$/.test(a.von) || !/^\d{2}:\d{2}$/.test(a.bis)) return { ok: false, grund: "Zeiten bitte als HH:MM." };
  if (hhmm(a.von) < 7 * 60 || hhmm(a.bis) > 21 * 60 || hhmm(a.von) >= hhmm(a.bis)) return { ok: false, grund: "Das Fenster muss zwischen 07:00 und 21:00 liegen." };
  if (!Number.isFinite(a.jeStunde) || a.jeStunde < 1 || a.jeStunde > 30) return { ok: false, grund: "Je Stunde sind 1 bis 30 Nachrichten möglich." };
  a.jeStunde = Math.round(a.jeStunde);
  a.gruppen = Array.from(new Set((a.gruppen || []).filter(istGruppe)));
  if (a.an && !a.gruppen.length) return { ok: false, grund: "Mindestens eine Gruppe muss dabei sein." };
  for (const g of Object.keys(a.vorlagen)) {
    const v = a.vorlagen[g as Gruppe];
    if (!istGruppe(g) || !v || !vorlagePasst(g, v)) delete a.vorlagen[g as Gruppe];
  }
  a.geaendertVon = von;
  a.geaendertAm = new Date().toISOString();
  const wert = JSON.stringify(a);
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${AUTOMATIK_KEY}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${wert}, updated_at = NOW()`;
  if (alt.an !== a.an) console.log(`[WA-ZENTRALE] Automatik ${a.an ? "AN" : "AUS"} durch ${von ?? "?"} (${a.von}–${a.bis}, ${a.jeStunde}/h)`);
  return { ok: true, automatik: a };
}

/**
 * Die erlaubte Menge bis zu dieser Minute — gleichmäßig verteilt. Angebrochene
 * Stunden am Rand des Fensters bekommen ihren Anteil: 07:40–08:00 sind bei
 * „5 je Stunde" zwei Nachrichten, nicht fünf auf einen Schlag.
 */
export function sollBisMinute(jeStunde: number, minute: number, vonMin: number, bisMin: number): number {
  const stundenAnfang = Math.floor(minute / 60) * 60;
  const anfang = Math.max(stundenAnfang, vonMin);
  const ende = Math.min(stundenAnfang + 60, bisMin);
  if (ende <= anfang || minute < anfang) return 0;
  const jeMinute = jeStunde / 60;
  return Math.min(Math.ceil(jeMinute * (ende - anfang)), Math.ceil(jeMinute * (minute - anfang + 5)));
}

let taktLaeuft = false;
/**
 * Der Takt (alle 5 Minuten). Um xx:00 darf die erste raus, um xx:30 etwa die
 * Hälfte, um xx:55 alle. Wer die Stunde schon voll hat, wartet auf die
 * nächste. Gezählt werden nur erfolgreiche Automatik-Sendungen.
 */
export async function automatikTakt(): Promise<{ gesendet: number; grund?: string }> {
  if (taktLaeuft) return { gesendet: 0, grund: "Takt läuft noch" };
  taktLaeuft = true;
  try {
    await zentraleSchema();
    const a = await automatik();
    if (!a.an) return { gesendet: 0, grund: "aus" };
    const m = berlinMinutenJetzt();
    if (m < hhmm(a.von) || m >= hhmm(a.bis) || !tagsueber()) return { gesendet: 0, grund: "außerhalb des Fensters" };
    // E-253: ein Lauf von Hand auf IRGENDEINER Instanz (auch einer, der nach einem Neustart gleich weitergeht).
    if (await offenerLauf()) return { gesendet: 0, grund: "ein Lauf von Hand läuft" };
    const { waKonfig } = await import("./fiaon-whatsapp");
    if (!waKonfig().bereit) return { gesendet: 0, grund: "WhatsApp nicht eingerichtet" };
    // E-261: In der Pause steigt der Takt sofort aus — keine Kandidaten, keine Zeilen. Bei ROT läuft nur noch
    // die Gruppe Monatsrate (gruppenBremse), GELB halbiert die Stundenmenge (25 → 13).
    const pause = await waBremse({ werbung: true, weg: "zentrale_automatik" });
    if (pause.pause) return { gesendet: 0, grund: pause.grund ?? "WhatsApp pausiert" };
    const [z] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_wa_aktion
       WHERE quelle = 'automatik' AND ok
         AND date_trunc('hour', erstellt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('hour', NOW() AT TIME ZONE 'Europe/Berlin')`) as any[];
    const schon = Number(z?.n || 0);
    const jeStunde = mitFaktor(a.jeStunde, pause.faktor || 1);
    let frei = sollBisMinute(jeStunde, m, hhmm(a.von), hhmm(a.bis)) - schon;
    if (frei <= 0) return { gesendet: 0, grund: "Stundenmenge erreicht" };
    const raum = await tagesRaum();
    frei = Math.min(frei, raum.frei);
    if (frei <= 0) return { gesendet: 0, grund: "Meta-Tageslimit erreicht" };
    const freigabe = await freigabeSatz();
    let gesendet = 0;
    const versucht: number[] = [];
    const laufId = `A${Date.now().toString(36)}`;
    let stoppGrund: string | null = null;
    let bremsGrund: string | null = null; // E-261: warum Werbe-Gruppen warten (ROT) — für Log und Rückgabe
    for (const g of a.gruppen) {
      if (frei <= 0 || herunterfahren || stoppGrund) break;
      const vorlage = a.vorlagen[g] ?? GRUPPEN[g].standard;
      if (!vorlagePasst(g, vorlage)) continue;
      // E-261: ROT → nur die Monatsrate (rate_offen); jede andere Gruppe wartet ohne Zeile, auch mit Termin-Vorlage.
      const gruppeBremse = await gruppenBremse(g, vorlage, "zentrale_automatik");
      if (!gruppeBremse.erlaubt) { if (gruppeBremse.pause) stoppGrund = gruppeBremse.grund; else bremsGrund = gruppeBremse.grund; continue; }
      if (vorlage !== "stufen" && !istFrei(vorlage, freigabe)) continue;
      // Etwas mehr holen als nötig — wer an einer Regel scheitert, soll den Platz nicht blockieren.
      const liste = await kandidaten(g, frei + 3, versucht);
      for (const k of liste) {
        if (frei <= 0 || herunterfahren) break; // E-253: bei SIGTERM nichts Neues anfangen
        // E-253 (Nachtrag): vor JEDER Sendung — ein Lauf von Hand, der während des Takts startet, hat Vorrang.
        if (await offenerLauf().catch(() => null)) { stoppGrund = "ein Lauf von Hand läuft"; break; }
        versucht.push(k.personId);
        const r: { ok: boolean; grund?: string; gebremst?: boolean } = await einzelnSenden(g, vorlage, k, "automatik", laufId, "Automatik", freigabe).catch(() => ({ ok: false }));
        if (r.ok) { gesendet++; frei--; }
        // E-261: Die Bremse griff mitten im Takt (z. B. die zweite #131042) — sofort aufhören, ohne Zeile.
        if (!r.ok && r.gebremst) { stoppGrund = r.grund ?? "WhatsApp pausiert"; break; }
        await new Promise((res) => setTimeout(res, 1200));
      }
    }
    if (gesendet) console.log(`[WA-ZENTRALE] Automatik: ${gesendet} gesendet (${schon + gesendet}/${jeStunde} in dieser Stunde${jeStunde !== a.jeStunde ? `, GELB: halbiert von ${a.jeStunde}` : ""})`);
    if (stoppGrund) return { gesendet, grund: stoppGrund };
    return !gesendet && bremsGrund ? { gesendet, grund: bremsGrund } : { gesendet };
  } finally {
    taktLaeuft = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE — alles, was die Seite zeigt, in einem Zug
// ═══════════════════════════════════════════════════════════════════════════
export async function zentraleLage() {
  await zentraleSchema();
  const [zaehlung, a, frei, raum, bremseLage] = await Promise.all([gruppenZahlenMitEinwilligung(), automatik(), freigabeSatz(), tagesRaum(), waBremseLage()]);
  // E-261 (Gegenprüfung 29.09.): die Bremse JE GRUPPE — dieselbe Regel wie laufStarten; die Seite sperrt den Start
  // und rechnet die GELB-Grenze damit (nicht mit dem Vorlagennamen).
  const gruppenBremsen = new Map(await Promise.all(GRUPPEN_REIHE.map(async (g) =>
    [g, await gruppenBremse(g, GRUPPEN[g].standard, "zentrale_lage").catch(() => null)] as const)));
  const zahlen = zaehlung.alle;
  // E-230: Wer wartet gerade auf eine Antwort? Justin soll Stille sehen, bevor ein Kunde sie spürt.
  // E-250: Warum „Neue Leads" leer ist — wann kam der letzte Lead?
  const [ll] = (await sqlPool`SELECT MAX(erstellt_am) AS am FROM fiaon_leads`.catch(() => [{ am: null }])) as any[];
  const letzterLead = ll?.am ? new Date(ll.am).toISOString() : null;
  const { OFFENE_GESPRAECHE_SQL } = await import("./fiaon-whatsapp-mara");
  const [wartend] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n, COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - o.am)) / 60), 0)::int AS laengste
      FROM (${OFFENE_GESPRAECHE_SQL} AND r.am < NOW() - INTERVAL '2 minutes') o`).catch(() => [{ n: 0, laengste: 0 }])) as any[];
  const { waKonfig } = await import("./fiaon-whatsapp");
  const { ketteAn } = await import("./fiaon-lead-whatsapp");
  const kette = await ketteAn().catch(() => false);

  const [heute] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE ok)::int AS gesendet,
           COUNT(*) FILTER (WHERE NOT ok)::int AS nicht,
           COUNT(*) FILTER (WHERE ok AND quelle = 'automatik')::int AS automatik,
           COUNT(*) FILTER (WHERE ok AND quelle = 'hand')::int AS hand
      FROM fiaon_wa_aktion
     WHERE (erstellt_am AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  const [stunde] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_wa_aktion
     WHERE quelle = 'automatik' AND ok
       AND date_trunc('hour', erstellt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('hour', NOW() AT TIME ZONE 'Europe/Berlin')`) as any[];
  // Alles, was heute über WhatsApp lief — auch Begrüßung und Kette, damit Justin das Ganze sieht.
  const [alle] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE richtung = 'raus' AND vorlage IS NOT NULL AND status <> 'fehler')::int AS vorlagen,
           COUNT(*) FILTER (WHERE richtung = 'raus' AND vorlage IS NULL AND von ILIKE 'Mara%')::int AS mara_antworten,
           COUNT(*) FILTER (WHERE richtung = 'rein')::int AS rein,
           COUNT(DISTINCT person_id) FILTER (WHERE richtung = 'rein')::int AS menschen_rein,
           COUNT(*) FILTER (WHERE richtung = 'raus' AND status = 'fehler')::int AS fehler
      FROM fiaon_whatsapp
     WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`.catch(() => [{}])) as any[];
  // E-244 (26.09.2026): „gezahlt" zählte gemeldete Zahlungen mit, und COALESCE(paid_at, updated_at)
  // wanderte bei jeder Änderung am Antrag. Jetzt gebuchtes Geld aus Maras Bilanz-Logik.
  const { waWirkung7 } = await import("./fiaon-mara-bilanz");
  const wirkung = await waWirkung7();
  const letzte = (await sqlPool`
    SELECT x.id, x.person_id, x.gruppe, x.vorlage, x.quelle, x.ok, x.grund, x.erstellt_am, x.ausgeloest_von,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
           w.status AS zustellung,
           EXISTS (SELECT 1 FROM fiaon_whatsapp w2 WHERE w2.person_id = x.person_id AND w2.richtung = 'rein' AND w2.created_at > x.erstellt_am) AS geantwortet
      FROM fiaon_wa_aktion x
      LEFT JOIN fiaon_persons p ON p.id = x.person_id
      LEFT JOIN fiaon_whatsapp w ON w.wa_id = x.wa_id AND x.wa_id IS NOT NULL
     ORDER BY x.erstellt_am DESC LIMIT 60`) as any[];

  // E-240: Die Entwürfe (WA_VORLAGEN_ENTWURF) stehen mit in der Liste — mit „entwurf", damit
  // Auswahl und Vorschau sie zeigen können; frei sind sie erst, wenn Meta sie freigibt.
  const vorlagenListe = [...WA_VORLAGEN.filter((v) => !v.varianteVon && v.name.startsWith("fiaon_kk_")), ...WA_VORLAGEN_ENTWURF].map((v) => ({
    name: v.name, kopf: v.kopf ?? "", zweck: v.zweck, text: v.text,
    frei: istFrei(v.name, frei),
    bild: frei.has(v.name.replace(/^fiaon_kk_/, "fiaon_kkb_")),
    kopfBild: WA_VORLAGEN.find((x) => x.varianteVon === v.name)?.kopfBild ?? null,
    fuss: v.fuss ?? "",
    entwurf: WA_VORLAGEN_ENTWURF.includes(v),
  }));

  return {
    whatsappBereit: waKonfig().bereit,
    meta: raum,
    // E-261: die Bremse in Worten — Pause (Notbremse), Qualität und was davon folgt.
    bremse: {
      pause: bremseLage.pause.an, art: bremseLage.pause.art, code: bremseLage.pause.code, seit: bremseLage.pause.seit,
      qualitaet: bremseLage.qualitaet, faktor: bremseLage.faktor, satz: bremseLage.satz,
      werbungGestoppt: bremseLage.werbungGestoppt, allesGestoppt: bremseLage.allesGestoppt,
      jeStundeGelb: bremseLage.faktor > 0 && bremseLage.faktor < 1 ? mitFaktor(a.jeStunde, bremseLage.faktor) : null,
      standAm: bremseLage.stand.am,
    },
    wartend: { anzahl: Number(wartend?.n || 0), laengsteMin: Number(wartend?.laengste || 0) },
    gruppen: GRUPPEN_REIHE.map((g) => ({
      schluessel: g, ...GRUPPEN[g], anzahl: zahlen[g], mitEinwilligung: zaehlung.einwilligung[g],
      wartend: zaehlung.wartend[g], wiederAb: zaehlung.wiederAb[g],
      letzterLead: g === "neu" ? letzterLead : null,
      bremse: (() => { const x = gruppenBremsen.get(g); return x ? { erlaubt: x.erlaubt, faktor: x.faktor, grund: x.grund } : null; })(),
    })),
    stufenText: STUFEN_TEXT,
    vorlagen: vorlagenListe,
    automatik: { ...a, dieseStunde: Number(stunde?.n || 0) },
    kette: { an: kette, pausiert: kette && a.an },
    tagsueber: tagsueber(),
    uhr: berlinMinutenJetzt(),
    heute: {
      gesendet: Number(heute?.gesendet || 0), nicht: Number(heute?.nicht || 0),
      automatik: Number(heute?.automatik || 0), hand: Number(heute?.hand || 0),
      vorlagenGesamt: Number(alle?.vorlagen || 0), maraAntworten: Number(alle?.mara_antworten || 0),
      rein: Number(alle?.rein || 0), menschenRein: Number(alle?.menschen_rein || 0), fehler: Number(alle?.fehler || 0),
    },
    wirkung7: { menschen: Number(wirkung?.menschen || 0), geantwortet: Number(wirkung?.geantwortet || 0), antrag: Number(wirkung?.antrag || 0), gezahlt: Number(wirkung?.gezahlt || 0), gezahltCents: Number(wirkung?.gezahlt_cents || 0) },
    // E-253: aus der Datenbank — jede Instanz zeigt denselben Stand, auch nach einem Neustart.
    lauf: await laufStand().catch((e) => { console.error("[WA-ZENTRALE] Laufstand:", e); return null; }),
    laufHoechstens: LAUF_HOECHSTENS,
    laufSekundenJePerson: LAUF_SEKUNDEN_JE_PERSON,
    letzte: letzte.map((r) => ({
      id: Number(r.id), personId: r.person_id != null ? Number(r.person_id) : null, name: String(r.name || "").trim() || "Ohne Namen",
      gruppe: String(r.gruppe), vorlage: String(r.vorlage), quelle: String(r.quelle), ok: !!r.ok, grund: r.grund ?? null,
      am: new Date(r.erstellt_am).toISOString(), von: r.ausgeloest_von ?? null, zustellung: r.zustellung ?? null, geantwortet: !!r.geantwortet,
    })),
  };
}

/** Vorschau: die nächsten Empfänger mit genau dem Text, den sie bekämen. */
export async function vorschau(g: Gruppe, vorlage: string, anzahl: number) {
  const frei = await freigabeSatz();
  const liste = await kandidaten(g, Math.min(Math.max(anzahl, 1), 50));
  return liste.map((k) => {
    const v = vorlageFuerKandidat(vorlage, k);
    const w = werteFuer(v, k);
    const def = vorlageDef(v);
    const text = def && !("grund" in w) ? def.text.replace(/\{\{(\d)\}\}/g, (_m, n) => w.werte[Number(n) - 1] ?? "") : null;
    const hinderung = !istFrei(v, frei) ? "Vorlage bei Meta noch nicht freigegeben" : "grund" in w ? w.grund : null;
    return {
      personId: k.personId, name: k.name || "Ohne Namen", tage: k.tage, vorlage: v,
      letzteVorlageAm: k.letzteVorlageAm, betrag: k.betrag, referenz: k.referenz, faelligAm: k.faelligAm, text, hinderung,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE BILDVORLAGEN EINMAL BEI META EINREICHEN (E-229)
//
// Die 15 Bildfassungen (fiaon_kkb_*) müssen bei Meta geprüft werden, bevor
// waSenden auf sie umsteigt. Das geschieht EINMAL nach dem Ausrollen — die
// Zeile in fiaon_settings wird zuerst beansprucht, damit ein zweiter Dienst
// oder Neustart nicht doppelt einreicht. Bewusst NUR „einreichen, was fehlt"
// (vorlagenEinreichen) und NICHT „auffrischen": Weicht der bei Meta gespeicherte
// Text auch nur um ein Leerzeichen ab, schickte das Auffrischen eine
// freigegebene Textvorlage zurück in die Prüfung — und die Sendungen stünden
// stundenlang. Das Ergebnis steht in der Zeile.
// ═══════════════════════════════════════════════════════════════════════════
const BILD_KEY = "wa_bildvorlagen_eingereicht_e229";
export const bildvorlagenEinmalEinreichen = () => vorlagenEinmalEinreichen(BILD_KEY);

/** Einmal je Schlüssel: nur fehlende Vorlagen einreichen (E-230: fiaon_kk_rate + fiaon_kkb_rate). */
export async function vorlagenEinmalEinreichen(schluessel: string): Promise<void> {
  const { waKonfig, vorlagenEinreichen } = await import("./fiaon-whatsapp");
  if (!waKonfig().bereit) return;
  const beansprucht = (await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, 'laeuft', NOW())
    ON CONFLICT (key) DO NOTHING RETURNING key`.catch(() => [])) as any[];
  if (!beansprucht.length) return;
  try {
    const erg = await vorlagenEinreichen();
    const wert = JSON.stringify({ am: new Date().toISOString(), eingereicht: erg.eingereicht, schonDa: erg.schonDa.length, fehler: erg.fehler });
    await sqlPool`UPDATE fiaon_settings SET value = ${wert}, updated_at = NOW() WHERE key = ${schluessel}`;
    console.log(`[WA-ZENTRALE] Vorlagen eingereicht (${schluessel}): ${erg.eingereicht.length} neu, ${erg.schonDa.length} schon da, ${erg.fehler.length} Fehler${erg.fehler.length ? ` — ${erg.fehler.map((f) => `${f.name}: ${f.grund}`).join(" | ").slice(0, 400)}` : ""}`);
  } catch (e) {
    const wert = JSON.stringify({ am: new Date().toISOString(), abbruch: String((e as Error)?.message || e).slice(0, 300) });
    await sqlPool`UPDATE fiaon_settings SET value = ${wert}, updated_at = NOW() WHERE key = ${schluessel}`.catch(() => {});
    console.error(`[WA-ZENTRALE] Vorlagen einreichen (${schluessel}):`, e);
  }
}
