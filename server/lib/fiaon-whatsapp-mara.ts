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

/** Der Auftrag für den Chat — kurz, weil WhatsApp kurz ist. */
async function auftrag(ein: {
  name: string; wer: string; lage: string; verlauf: string; gedaechtnis: string; link: string | null;
}): Promise<string> {
  const hausanweisung = await anweisungBlock("whatsapp").catch(() => "");
  return [
    hausanweisung,
    `Du heißt ${ein.name} und arbeitest bei FIAON im Kundendienst. Du schreibst auf WhatsApp — kurz, warm, klar.`,
    `Du bist eine digitale Assistentin. Wenn jemand fragt, ob er mit einem Menschen spricht, sagst du ehrlich, dass du digital bist und jederzeit eine Kollegin oder einen Kollegen dazuholst.`,
    ``,
    `SO SCHREIBST DU:`,
    `· Höchstens vier Sätze. Ein Gedanke pro Satz. Keine Absatzmonster, kein Brief.`,
    `· Immer Sie. Keine Emojis. Keine Aufzählungszeichen. Kein Betreff, keine Grußformel, keine Unterschrift.`,
    `· Beantworte zuerst die Frage, dann kommt ein einziger nächster Schritt.`,
    `· Du duzt nie, du versprichst nie, du garantierst nie, du empfiehlst nie.`,
    `· Nenne keine Adresse (URL) im Text${ein.link ? " — der Link steht bereits in der Unterhaltung" : ""}.`,
    ``,
    `WAS DU NIE TUST: mahnen, eine Forderung eintreiben, eine offene Rate anmahnen. Das ist auf WhatsApp verboten und kostet uns die Nummer. Geht es ums Geld, sag freundlich, dass die Kollegin sich per E-Mail meldet, und setze das Feld mensch auf true.`,
    ``,
    `ÜBER DEN WEG ZUR KARTE (nur wenn er danach fragt): ${KARTE_LINK_SATZ} Danach ${KARTE_ZEIT_KURZ}. Die Entscheidung trifft die Bank.`,
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
    let link: string | null = null;
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
      }
    } else if (leadId) {
      const [l] = (await sqlPool`
        SELECT TRIM(COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) AS name, link_code, anzeige FROM fiaon_leads WHERE id = ${leadId}`) as any[];
      if (l) {
        wer = `${String(l.name || "").trim() || "Ein Interessent"} — kam über eine Anzeige${l.anzeige ? ` (${l.anzeige})` : ""}.`;
        lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet.";
        link = l.link_code ? String(l.link_code) : null;
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

    const erg = await waSenden(nummer, { text: antwort }, { personId, leadId, von: namen.voll });
    if (!erg.ok) return { gesendet: false, grund: erg.grund };

    if (personId && String(roh?.gemerkt ?? "").trim()) {
      await gedaechtnisMerken(personId, String(roh.gemerkt).trim(), "whatsapp").catch(() => {});
    }
    if (roh?.mensch === true) await aufgabeFuerMenschen(nummer, personId, "Der Mensch möchte mit jemandem aus dem Team sprechen (WhatsApp).");
    return { gesendet: true };
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
