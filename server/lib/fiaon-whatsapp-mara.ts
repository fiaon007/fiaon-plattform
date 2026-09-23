// ═══════════════════════════════════════════════════════════════════════════
// MARA AUF WHATSAPP (23.09.2026, E-210)
//
// Justin: „Unsere Kunden sind am besten über WhatsApp abzuschließen, also die
// Idee MARA hier 100 % zu trainieren und zu Verkaufsmaschine machen ist der
// 100 % richtige Weg." Und: „natürlich soll MARA IMMER arbeiten, Tag und Nacht."
//
// Sie antwortet NUR, wenn der Mensch gerade selbst geschrieben hat. Das ist
// keine Bremse, sondern die Regel von WhatsApp: Im 24-Stunden-Fenster ist
// freier Text erlaubt, davor und danach nur freigegebene Vorlagen. Eine
// Antwort auf eine Nachricht ist also immer erlaubt — und immer erwünscht.
//
// Vier Wände, bevor etwas rausgeht:
//   1. Der Schalter am Gespräch (`mara_an`). Schreibt ein Mensch aus dem Team,
//      schaltet der Raum ihn selbst ab — dann schweigt sie hier.
//   2. Der Tagesdeckel für KI-Kosten (mara_wa_tag_euro, Vorgabe 15 €).
//   3. Höchstens vier eigene Antworten in Folge ohne neue Frage — sonst
//      redet sie gegen eine Wand.
//   4. Wortwand, Sie-Form, Längengrenze und die WhatsApp-Richtlinie
//      (keine Mahnung, keine Forderung) — `sendePruefung` in fiaon-whatsapp.ts.
//
// Kann sie nicht helfen oder wünscht der Mensch einen Menschen, legt sie eine
// Aufgabe beim Betreuer an und sagt das im Chat.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { kiAufruf, antwortLesen, MODELL, agentNamen } from "./fiaon-postmeister-agent";
import { kostenHeute, kostenCentsAus } from "./fiaon-postmeister-schema";
import { waSenden, sendePruefung, fensterOffen } from "./fiaon-whatsapp";
import { anweisungBlock } from "./fiaon-mara-anweisung";
import { gedaechtnisText, gedaechtnisMerken } from "./fiaon-mara-gedaechtnis";
import { KARTE_LINK_SATZ, KARTE_ZEIT_KURZ } from "@shared/fiaon-karten-weg";

export const DIENST_WA = "mara-whatsapp";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["antwort", "gemerkt", "mensch"],
  properties: {
    antwort: { type: "string", description: "Die WhatsApp-Nachricht an den Menschen. Höchstens 4 Sätze." },
    gemerkt: { type: "string", description: "Ein Satz, den sich FIAON über diesen Menschen merken soll — oder leer." },
    mensch: { type: "boolean", description: "true, wenn ein Mensch aus dem Team übernehmen muss." },
  },
} as const;

async function einstellung(key: string, vorgabe: string): Promise<string> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key}`.catch(() => [])) as any[];
  return String(r?.value ?? vorgabe);
}

/**
 * Der Auftrag für den Chat. Kurz, weil WhatsApp kurz ist — und auf VERKAUF
 * gestellt, nicht auf Datenaufnahme.
 *
 * 23.09.2026, nach Justins erstem Test: Mara fragte per Chat Name,
 * Geburtsdatum, E-Mail und Telefon ab und nannte in neun Nachrichten kein
 * einziges Mal den Nutzen, keine Zahl und keinen Link. Das ist das Gegenteil
 * von Verkauf. Diese Regeln stehen deshalb ganz oben und sind hart:
 *   · KEINE Datenabfrage. Der Antrag holt Name, Geburtsdatum, Mail und
 *     Telefon in zwei Minuten selbst — und sicherer.
 *   · JEDE Antwort hat ein Ziel: den Link öffnen.
 *   · Zahlen und Nutzen nennen, nicht Verwaltung.
 */
async function auftrag(ein: {
  name: string; wer: string; lage: string; verlauf: string; gedaechtnis: string; link: string;
}): Promise<string> {
  const hausanweisung = await anweisungBlock("whatsapp").catch(() => "");
  return [
    hausanweisung,
    `Du heißt ${ein.name} und arbeitest bei FIAON. Du schreibst auf WhatsApp und dein Ziel ist EIN Satz weit: Der Mensch soll den Antrag öffnen und ausfüllen.`,
    `Du bist eine digitale Assistentin. Fragt jemand danach, sagst du es offen und bietest sofort an, eine Kollegin oder einen Kollegen dazuzuholen.`,
    ``,
    `DAS WICHTIGSTE — DEIN LINK: ${ein.link}`,
    `Diesen Link schickst du, sobald ein Interesse erkennbar ist. Nicht erst nach Rückfragen, nicht nach einem Formular — sofort.`,
    `Für Unternehmen (GmbH, Firma, Gewerbe, US-Gesellschaft) gilt stattdessen: https://fiaon.com/global`,
    ``,
    `WAS DU NIE TUST:`,
    `· Du fragst NIEMALS nach Name, Geburtsdatum, Adresse, E-Mail oder Telefonnummer. Das erledigt der Antrag in zwei Minuten, und er erledigt es besser.`,
    `· Du spielst kein Menü („Privat oder Geschäftlich?"). Was du nicht weißt, erkennst du aus dem, was er schreibt — oder du schickst einfach den Privat-Link.`,
    `· Du sagst nie „Wie kann ich Ihnen weiterhelfen?", „Danke für Ihre Nachricht" oder „Gerne helfe ich Ihnen". Solche Sätze sagt kein Mensch.`,
    `· Du mahnst nicht, du treibst keine Forderung ein, du nennst keine offene Rate. Geht es ums Geld, sagst du, dass sich die Kollegin per E-Mail meldet, und setzt das Feld mensch auf true.`,
    ``,
    `SO SCHREIBST DU:`,
    `· Ein bis drei Sätze. Kurz wie am Telefon. Kein Brief, keine Aufzählung, keine Emojis, keine Grußformel, keine Unterschrift.`,
    `· Immer Sie. Warm, direkt, ohne Anbiederung.`,
    `· Nenne den Nutzen in konkreten Zahlen, wenn es passt: vier Pakete ab 7,99 € im Monat, Ziel-Rahmen bis 25.000 €, Antrag in unter zwei Minuten, Ergebnis sofort am Ende des Antrags.`,
    `· Die Entscheidung über eine Karte trifft am Ende immer die Bank — das sagst du, wenn jemand nach Sicherheit fragt, aber nie ungefragt und nie als Einleitung.`,
    `· Auf „Wie geht das?" antwortest du mit dem Weg UND dem Link, nicht mit einer Gegenfrage.`,
    `· Auf Small Talk antwortest du in einem halben Satz und führst zurück zum Thema.`,
    ``,
    `EINWÄNDE:`,
    `· „Ist das seriös?" → FIAON ist eine britische Gesellschaft mit Sitz in London, alles steht im Antrag und im Vertrag. Dann zurück zum nächsten Schritt.`,
    `· „Was kostet das?" → Vier Pakete ab 7,99 € im Monat; welches passt, sieht er im Antrag mit seinem Ziel-Rahmen.`,
    `· „Ich habe Schufa-Einträge" → Genau dafür ist FIAON da: Wir sehen uns die Einträge an, erklären jeden und bereiten den Weg vor.`,
    `· „Keine Zeit" → Zwei Minuten, der Link bleibt offen, er kann jederzeit weitermachen.`,
    ``,
    `ÜBER DEN WEG ZUR KARTE (nur auf Nachfrage): ${KARTE_LINK_SATZ} Danach ${KARTE_ZEIT_KURZ}.`,
    ``,
    `WER DIR SCHREIBT: ${ein.wer}`,
    `SEINE LAGE: ${ein.lage}`,
    ein.gedaechtnis ? `WAS WIR ÜBER IHN WISSEN: ${ein.gedaechtnis}` : ``,
    ``,
    `DIE LETZTEN NACHRICHTEN (oben alt, unten neu):`,
    ein.verlauf,
  ].filter(Boolean).join("\n");
}

/**
 * Antwortet auf eine eingegangene WhatsApp. Läuft im Hintergrund, wirft nie —
 * eine misslungene Antwort darf den Empfang nicht stören.
 */
export async function maraAntwortet(nummer: string): Promise<{ gesendet: boolean; grund?: string }> {
  try {
    const an = (await einstellung("mara_wa_an", "an")) === "an";
    if (!an) return { gesendet: false, grund: "Mara ist auf WhatsApp abgeschaltet." };

    const [g] = (await sqlPool`SELECT mara_an FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => [])) as any[];
    if (g && g.mara_an === false) return { gesendet: false, grund: "In diesem Gespräch schreibt ein Mensch." };

    if (!(await fensterOffen(nummer))) return { gesendet: false, grund: "Das Fenster ist zu." };

    const deckel = Number(await einstellung("mara_wa_tag_euro", "15")) || 15;
    const heute = await kostenHeute(DIENST_WA).catch(() => 0);
    if (heute >= deckel) return { gesendet: false, grund: `Kostendeckel erreicht (${heute.toFixed(2)} € von ${deckel} €).` };

    const verlauf = (await sqlPool`
      SELECT richtung, text, vorlage, COALESCE(empfangen_am, gesendet_am, created_at) AS am, person_id, lead_id
        FROM fiaon_whatsapp WHERE nummer = ${nummer} ORDER BY id DESC LIMIT 12`) as any[];
    if (!verlauf.length) return { gesendet: false, grund: "Kein Verlauf." };
    const neueste = verlauf[0];
    if (neueste.richtung !== "rein") return { gesendet: false, grund: "Die letzte Nachricht war unsere." };

    // Vier eigene Antworten in Folge ohne neue Frage: dann schweigt sie.
    let amStueck = 0;
    for (const v of verlauf) { if (v.richtung === "raus") amStueck++; else break; }
    if (amStueck >= 4) return { gesendet: false, grund: "Vier Antworten ohne Rückmeldung — sie wartet." };

    const personId = verlauf.find((v) => v.person_id)?.person_id ?? null;
    const leadId = verlauf.find((v) => v.lead_id)?.lead_id ?? null;

    let wer = "Ein Interessent, den wir noch nicht kennen.";
    let lage = "Noch kein Antrag.";
    // Der Link ist das Ziel jeder Nachricht. Kennen wir den Menschen, ist er
    // persönlich und füllt den Antrag vor; sonst die öffentliche Startseite.
    let link = "https://fiaon.com/start";
    if (personId) {
      const [p] = (await sqlPool`
        SELECT TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name, a.name AS betreuer,
               (SELECT pack_name FROM fiaon_applications WHERE person_id = p.id AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1) AS paket,
               (SELECT payment_status FROM fiaon_applications WHERE person_id = p.id AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1) AS zahlung,
               (SELECT COALESCE(current_step, 0) FROM fiaon_applications WHERE person_id = p.id AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1) AS schritt
          FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id WHERE p.id = ${personId}`) as any[];
      if (p) {
        wer = `${String(p.name || "").trim() || "Ein Kunde"}${p.betreuer ? `, betreut von ${p.betreuer}` : ""}.`;
        lage = p.zahlung === "paid" ? `Kunde mit ${p.paket ?? "einem Paket"}, bezahlt.`
          : Number(p.schritt) >= 8 ? `Antrag fertig (${p.paket ?? "Paket offen"}), noch nicht bezahlt.`
            : `Antrag angefangen, bei Schritt ${p.schritt ?? 0} stehen geblieben.`;
        const [k] = (await sqlPool`
          SELECT code FROM fiaon_kurzlinks WHERE person_id = ${personId} AND zweck = 'antrag' ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
        if (k?.code) link = `https://fiaon.com/a/${String(k.code)}/w`;
      }
    } else if (leadId) {
      const [l] = (await sqlPool`
        SELECT TRIM(COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) AS name, link_code, anzeige FROM fiaon_leads WHERE id = ${leadId}`) as any[];
      if (l) {
        wer = `${String(l.name || "").trim() || "Ein Interessent"} — kam über eine Anzeige${l.anzeige ? ` (${l.anzeige})` : ""}.`;
        lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet.";
        if (l.link_code) link = `https://fiaon.com/a/${String(l.link_code)}/w`;
      }
    }

    const namen = await agentNamen();
    const text = await auftrag({
      name: namen.voll,
      wer, lage, link,
      gedaechtnis: personId ? await gedaechtnisText(personId).catch(() => "") : "",
      verlauf: verlauf.slice().reverse()
        .map((v) => `${v.richtung === "rein" ? "ER" : "DU"}: ${String(v.text ?? (v.vorlage ? `(Vorlage ${v.vorlage})` : "")).slice(0, 500)}`)
        .join("\n"),
    });

    const j = await kiAufruf({
      dienst: DIENST_WA, modell: MODELL(), aufwand: "low", maxTokens: 900, schema: SCHEMA,
      nachrichten: [{ role: "system", content: text }, { role: "user", content: "Antworte jetzt auf die letzte Nachricht." }],
    });
    void kostenCentsAus(MODELL(), j?.usage);
    const roh = antwortLesen(j, "Mara-WhatsApp");
    const antwort = String(roh?.antwort ?? "").trim();
    if (!antwort) return { gesendet: false, grund: "Kein Text erzeugt." };

    const funde = sendePruefung(antwort);
    if (funde.length) {
      console.warn(`[MARA-WA] Antwort zurückgehalten (${nummer}): ${funde.join(" · ")}`);
      await aufgabeFuerMenschen(nummer, personId, `Mara konnte nicht antworten: ${funde.join(" · ")}`);
      return { gesendet: false, grund: funde.join(" · ") };
    }

    // ── SIE ANTWORTET NICHT IN FÜNF SEKUNDEN (23.09.2026) ────────────────
    // Justins Test: „Schreibt sie viel zu schnell zurück, das ist kaum
    // menschlich." Die Antwort wird deshalb nur VORBEREITET und mit einer
    // Verzögerung fällig gestellt — lesen, denken, tippen. Der Versandtakt
    // (fiaon-whatsapp-mara: versandLauf) schickt sie dann ab; kommt bis dahin
    // eine neue Nachricht, wird die Antwort verworfen und neu gedacht.
    const faellig = new Date(Date.now() + verzoegerungMs(antwort, String(neueste.text ?? "")));
    await sqlPool`
      INSERT INTO fiaon_whatsapp_gespraech (nummer, antwort_text, antwort_faellig_am, antwort_auf_id, updated_at)
      VALUES (${nummer}, ${antwort}, ${faellig}, ${Number(neueste.id ?? 0) || null}, NOW())
      ON CONFLICT (nummer) DO UPDATE SET
        antwort_text = ${antwort}, antwort_faellig_am = ${faellig},
        antwort_auf_id = ${Number(neueste.id ?? 0) || null}, updated_at = NOW()`;

    if (personId && String(roh?.gemerkt ?? "").trim()) {
      await gedaechtnisMerken(personId, String(roh.gemerkt).trim(), "whatsapp").catch(() => {});
    }
    if (roh?.mensch === true) await aufgabeFuerMenschen(nummer, personId, "Der Mensch möchte mit jemandem aus dem Team sprechen (WhatsApp).");
    return { gesendet: false, grund: `Antwort liegt bereit, geht in ${Math.round((faellig.getTime() - Date.now()) / 1000)} Sekunden raus.` };
  } catch (e) {
    console.error("[MARA-WA]", e);
    return { gesendet: false, grund: String(e).slice(0, 200) };
  }
}

/** Ein Mensch muss übernehmen — als Aufgabe beim Betreuer, nicht als Zuruf. */
async function aufgabeFuerMenschen(nummer: string, personId: number | null, grund: string): Promise<void> {
  if (!personId) return;
  await sqlPool`
    INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note)
    VALUES (${personId}, NULL, 'Mara', 'system', ${`WhatsApp (+${nummer}): ${grund}`})`.catch(() => {});
  // Dieselbe Aufgabenkette wie im Postfach — nicht noch ein zweiter Weg.
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId, ref: null, titel: "WhatsApp: bitte übernehmen", text: grund, quelle: "mara-whatsapp",
    // Ein Auftrag je Mensch und Tag — nicht je Nachricht.
    schluessel: `wa-${personId}-${new Date().toISOString().slice(0, 10)}`,
  }).catch((e) => console.error("[MARA-WA] Aufgabe:", e));
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS TEMPO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wie lange ein Mensch für diese Antwort bräuchte: lesen, denken, tippen.
 * Grundlage: ~13 Zeichen je Sekunde am Handy, dazu eine Denkpause, die mit der
 * Länge der Frage wächst, plus Streuung — nie zweimal dieselbe Zahl.
 */
export function verzoegerungMs(antwort: string, frage: string): number {
  const lesen = Math.min(6000, String(frage).length * 45);
  const denken = 4000 + Math.random() * 6000;
  const tippen = Math.min(45_000, (String(antwort).length / 13) * 1000);
  const streuung = 0.85 + Math.random() * 0.4;
  return Math.round(Math.min(90_000, Math.max(20_000, (lesen + denken + tippen) * streuung)));
}

let versandLaeuft = false;

/**
 * Schickt die fälligen Antworten. Läuft im Takt (alle 20 Sekunden) und prüft
 * vorher noch einmal alles, was sich in der Wartezeit geändert haben kann:
 * neue Nachricht des Menschen, ein Mensch aus dem Team hat geschrieben, das
 * Fenster ist zugefallen.
 */
export async function versandLauf(): Promise<{ gesendet: number; verworfen: number }> {
  if (versandLaeuft) return { gesendet: 0, verworfen: 0 };
  versandLaeuft = true;
  let gesendet = 0, verworfen = 0;
  try {
    const faellig = (await sqlPool`
      SELECT nummer, antwort_text, antwort_auf_id, mara_an FROM fiaon_whatsapp_gespraech
       WHERE antwort_text IS NOT NULL AND antwort_faellig_am IS NOT NULL AND antwort_faellig_am <= NOW()
       LIMIT 25`.catch(() => [])) as any[];
    for (const g of faellig) {
      const nummer = String(g.nummer);
      const leeren = async () => {
        await sqlPool`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL, antwort_auf_id = NULL WHERE nummer = ${nummer}`;
      };
      if (g.mara_an === false) { await leeren(); verworfen++; continue; }
      const [letzte] = (await sqlPool`
        SELECT id, richtung FROM fiaon_whatsapp WHERE nummer = ${nummer} ORDER BY id DESC LIMIT 1`) as any[];
      // Inzwischen etwas Neues? Dann ist die vorbereitete Antwort veraltet.
      if (!letzte || Number(letzte.id) !== Number(g.antwort_auf_id)) {
        await leeren();
        verworfen++;
        void maraAntwortet(nummer).catch(() => {});
        continue;
      }
      if (!(await fensterOffen(nummer))) { await leeren(); verworfen++; continue; }
      const [w] = (await sqlPool`SELECT person_id, lead_id FROM fiaon_whatsapp WHERE nummer = ${nummer} ORDER BY id DESC LIMIT 1`) as any[];
      const namen = await agentNamen();
      const erg = await waSenden(nummer, { text: String(g.antwort_text) }, { personId: w?.person_id ?? null, leadId: w?.lead_id ?? null, von: namen.voll });
      await leeren();
      if (erg.ok) gesendet++; else console.warn(`[MARA-WA] ${nummer}: ${erg.grund}`);
    }
  } catch (e) {
    console.error("[MARA-WA] Versandtakt:", e);
  } finally {
    versandLaeuft = false;
  }
  return { gesendet, verworfen };
}
