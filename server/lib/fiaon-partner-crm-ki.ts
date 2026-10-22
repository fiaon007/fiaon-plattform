// ═══════════════════════════════════════════════════════════════════════════
// GESCHÄFTSPARTNER-CRM — KI (E-425, 22.10.2026)
//
// Zwei Dinge, beide freiwillig — ohne KI arbeitet das CRM vollständig weiter:
//   1. „Aus E-Mail übernehmen“: Mail oder Signatur → strukturierter Vorschlag.
//      NIE gespeichert: Die Oberfläche zeigt eine Vorschau, ein Mensch prüft und
//      bestätigt (uebernehmen in fiaon-partner-crm.ts). Ist die KI aus (kein
//      Schlüssel, Pause E-246/E-279), liefern die Regeln (regelVorschlag) einen
//      kleineren, aber nie erfundenen Vorschlag — und die Oberfläche sagt warum.
//   2. „Was steht an?“: kurze Lage je Partner aus Aufgaben, Verlauf, Dokumenten.
//      Ohne KI: dieselben Hinweise als Liste (partnerHinweise).
//
// Weg: openaiFetch (fiaon-ki-pause.ts) — die eine Wand für Pause und
// Anbieter-Weiche (KI_ANBIETER). Jede Antwort läuft durch kiVorschlagBereinigen:
// Was nicht wörtlich im Text steht (E-Mail, Telefon, Website), fällt weg.
// ═══════════════════════════════════════════════════════════════════════════
import { openaiFetch, istKiPause, kiLesenMoeglich, kiPausiert, kiPauseLesen, kiPauseMeldung, aktiverAnbieter } from "./fiaon-ki-pause";
import {
  KI_MAIL_ANWEISUNG, KI_MAIL_MAX_ZEICHEN, KI_LAGE_ANWEISUNG, kiVorschlagBereinigen, regelVorschlag, vorschlagErgaenzen, firmenTreffer, lageText,
  partnerHinweise, mehrzeilig, type MailVorschlag, type Treffer, type LageHinweis,
} from "@shared/fiaon-partner-crm";
import { bestandFuerTreffer, lageEingang, type PartnerAkte } from "./fiaon-partner-crm";

const DIENST = "partner-crm";
const MODELL = () => process.env.PARTNER_CRM_MODELL || "gpt-4.1-mini";

export interface KiStand { bereit: boolean; grund: string | null }
/** Kann die KI gerade? Der Grund steht als Satz da (AGENTS.md: ein gesperrter Knopf ohne sichtbaren Grund ist ein Rätsel). */
export async function kiStand(): Promise<KiStand> {
  if (!kiLesenMoeglich()) return { bereit: false, grund: `Für die KI fehlt der Schlüssel (${aktiverAnbieter() === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"}).` };
  try {
    if (await kiPausiert()) {
      const z = await kiPauseLesen();
      return { bereit: false, grund: kiPauseMeldung(z.art ?? null, aktiverAnbieter()) };
    }
  } catch (e) {
    console.error("[PARTNER-CRM] KI-Pause nicht lesbar:", e instanceof Error ? e.message : e);
    return { bereit: false, grund: "Der Stand der KI ist gerade nicht lesbar." };
  }
  return { bereit: true, grund: null };
}

async function kiJson(system: string, nutzer: string, maxTokens: number, json: boolean): Promise<{ ok: true; text: string } | { ok: false; grund: string }> {
  const stand = await kiStand();
  if (!stand.bereit) return { ok: false, grund: stand.grund ?? "KI aus." };
  const modell = MODELL();
  const t0 = Date.now();
  try {
    const res = await openaiFetch(DIENST, "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modell, temperature: 0.1, max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "system", content: system }, { role: "user", content: nutzer }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const roh: any = await res.json().catch(() => null);
    const text = String(roh?.choices?.[0]?.message?.content ?? "").trim();
    const { nutzungMerken } = await import("./fiaon-postmeister-schema");
    await nutzungMerken({ dienst: DIENST, modell, usage: roh?.usage, dauerMs: Date.now() - t0, ok: res.ok && !!text, fehler: res.ok ? null : JSON.stringify(roh?.error ?? "").slice(0, 200) })
      .catch((e) => console.error("[PARTNER-CRM] Nutzung nicht gemerkt:", e instanceof Error ? e.message : e));
    if (!res.ok) return { ok: false, grund: `Die KI antwortet gerade nicht (HTTP ${res.status}).` };
    if (!text) return { ok: false, grund: "Die KI hat nichts geliefert." };
    return { ok: true, text };
  } catch (e: any) {
    if (istKiPause(e)) return { ok: false, grund: String(e?.message ?? "KI pausiert.") };
    console.error("[PARTNER-CRM] KI-Aufruf:", String(e?.message ?? e).slice(0, 200));
    return { ok: false, grund: e?.name === "TimeoutError" || e?.name === "AbortError" ? "Die KI hat zu lange gebraucht." : "Die KI ist gerade nicht erreichbar." };
  }
}

export interface MailAuswertung { vorschlag: MailVorschlag; quelle: "ki" | "regeln"; hinweis: string | null; treffer: Treffer[] }
/** Mail/Signatur → Vorschlag + mögliche bestehende Partner. Speichert nichts. */
export async function mailAuswerten(textRoh: unknown): Promise<{ ok: true; auswertung: MailAuswertung } | { ok: false; status: number; error: string }> {
  const text = mehrzeilig(textRoh, KI_MAIL_MAX_ZEICHEN + 1);
  if (text.length < 20) return { ok: false, status: 400, error: "Bitte die Mail oder Signatur einfügen (mindestens ein paar Zeilen)." };
  if (text.length > KI_MAIL_MAX_ZEICHEN) return { ok: false, status: 400, error: `Der Text ist zu lang (höchstens ${KI_MAIL_MAX_ZEICHEN.toLocaleString("de-DE")} Zeichen) — bitte nur die Mail mit Signatur einfügen.` };
  const regel = regelVorschlag(text);
  const ki = await kiJson(KI_MAIL_ANWEISUNG, text, 1800, true);
  let vorschlag: MailVorschlag; let quelle: "ki" | "regeln"; let hinweis: string | null = null;
  if (ki.ok) {
    const sauber = kiVorschlagBereinigen(ki.text, text);
    vorschlag = vorschlagErgaenzen(sauber, regel);
    quelle = "ki";
    if (!sauber.firma.name && !sauber.kontakte.length) hinweis = "Die KI hat in diesem Text keinen Partner erkannt — bitte prüfen und ergänzen.";
  } else {
    vorschlag = regel; quelle = "regeln";
    hinweis = `${ki.grund} Ausgewertet wurde ohne KI (E-Mail, Telefon, Website, Adresse, Signatur) — bitte den Rest ergänzen.`;
  }
  const bestand = await bestandFuerTreffer();
  const treffer = firmenTreffer({ name: vorschlag.firma.name, website: vorschlag.firma.website, email: vorschlag.firma.email, kontaktEmails: vorschlag.kontakte.map((k) => k.email) }, bestand);
  return { ok: true, auswertung: { vorschlag, quelle, hinweis, treffer } };
}

/** „Was steht an?“ — KI-Satz, wenn möglich; die Hinweise ohne KI kommen immer mit. */
export async function lageZusammenfassen(akte: PartnerAkte): Promise<{ text: string | null; quelle: "ki" | "regeln"; hinweis: string | null; hinweise: LageHinweis[] }> {
  const ein = lageEingang(akte);
  const hinweise = partnerHinweise(ein);
  const ki = await kiJson(KI_LAGE_ANWEISUNG, lageText({ ...ein, name: akte.firma.name }), 320, false);
  if (ki.ok) return { text: mehrzeilig(ki.text, 900), quelle: "ki", hinweis: null, hinweise };
  return { text: null, quelle: "regeln", hinweis: ki.grund, hinweise };
}
