// ═══════════════════════════════════════════════════════════════════════════
// DER WHATSAPP-KANAL (22.09.2026, E-210) — Cloud API, direkt bei Meta
//
// Justin: „Unsere Kunden sind am besten über WhatsApp abzuschließen."
// Nummer: +49 1511 0761284 (FIAON Ltd), Konto und Nummern-Kennung stehen in
// der Render-Umgebung (WHATSAPP_WABA_ID, WHATSAPP_PHONE_ID).
//
// ── DIE ZWEI REGELN, DIE ALLES BESTIMMEN ──────────────────────────────────
// 1. VORLAGEN: Wer uns in den letzten 24 Stunden NICHT geschrieben hat, darf
//    nur eine von Meta freigegebene Vorlage bekommen. Freitext geht erst,
//    wenn der Mensch geantwortet hat — dann 24 Stunden lang.
// 2. RICHTLINIE: WhatsApp verbietet Inkasso („debt collection"). Mahnungen,
//    Ratenrückstände und Forderungen gehen NIE über diesen Kanal — dafür
//    bleiben Mail, Telefon und Brief. Das prüft `inkassoVerdacht` hier, bevor
//    irgendetwas rausgeht.
//
// Jede Nachricht — rein wie raus — steht in fiaon_whatsapp und im Verlauf der
// Akte. Nichts geht an der Akte vorbei.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { graph, MetaFehler } from "./fiaon-meta";
import { WA_VORLAGEN, INKASSO_AUSNAHME, AUSKUNFT_VORLAGEN_ALLE, bildName, waBildUrl, type WaVorlage, type WaBild } from "../../shared/fiaon-lead-texte";
import { nummerFuerWhatsApp, waKanonisch } from "../../shared/fiaon-whatsapp-erlaubnis";
import { wandPruefen } from "../../shared/fiaon-wortverbote";
import { waFehlerText } from "./fiaon-wa-unzustellbar";

type Lauf = typeof sqlPool;

export interface WaKonfig { bereit: boolean; fehlt: string[]; wabaId: string | null; nummerId: string | null; nummer: string | null }

export function waKonfig(): WaKonfig {
  const wabaId = String(process.env.WHATSAPP_WABA_ID ?? "").trim() || null;
  const nummerId = String(process.env.WHATSAPP_PHONE_ID ?? "").trim() || null;
  const nummer = String(process.env.WHATSAPP_NUMMER ?? "").trim() || null;
  const fehlt: string[] = [];
  if (!wabaId) fehlt.push("WHATSAPP_WABA_ID");
  if (!nummerId) fehlt.push("WHATSAPP_PHONE_ID");
  return { bereit: fehlt.length === 0, fehlt, wabaId, nummerId, nummer };
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEICHER
// ═══════════════════════════════════════════════════════════════════════════
let anlegen: Promise<void> | null = null;
export function waTabellen(lauf: Lauf = sqlPool): Promise<void> {
  if (!anlegen) {
    anlegen = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_whatsapp (
          id BIGSERIAL PRIMARY KEY,
          wa_id TEXT UNIQUE,
          richtung TEXT NOT NULL,
          nummer TEXT NOT NULL,
          person_id INTEGER,
          lead_id INTEGER,
          typ TEXT NOT NULL DEFAULT 'text',
          text TEXT,
          vorlage TEXT,
          knopf TEXT,
          status TEXT NOT NULL DEFAULT 'offen',
          fehler TEXT,
          von TEXT,
          empfangen_am TIMESTAMPTZ,
          gesendet_am TIMESTAMPTZ,
          zugestellt_am TIMESTAMPTZ,
          gelesen_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_whatsapp_nummer ON fiaon_whatsapp (nummer, id DESC)`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_whatsapp_person ON fiaon_whatsapp (person_id, id DESC)`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      anlegen = null;
      throw e;
    });
  }
  return anlegen;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WAND VOR DEM SENDEN
// ═══════════════════════════════════════════════════════════════════════════

/** Worte, die WhatsApp als Inkasso liest — hier gilt die Richtlinie, nicht unser Geschmack. */
// E-230: \b greift vor „ü" nie (kein \w), und „Inkassobüro"/„Zahlungsrückstand" rutschten
// als Wortteile durch. Jetzt mit ausdrücklicher Buchstabenklasse statt \b, und das Gericht
// (Amtsgericht, Mahnverfahren, Betreibungsamt) gehört auf WhatsApp ebenfalls nicht hin.
const BUCHST = "[A-Za-zÄÖÜäöüß]";
const INKASSO = new RegExp(
  `(?<!${BUCHST})(mahn${BUCHST}*|${BUCHST}*inkasso${BUCHST}*|forderung${BUCHST}*|${BUCHST}*verzug${BUCHST}*|überfällig${BUCHST}*|offene\\s+rate${BUCHST}*|${BUCHST}*rückst[aä]nd${BUCHST}*|zwangs${BUCHST}*|${BUCHST}*gericht${BUCHST}*|betreibungsamt|mahnverfahren)(?!${BUCHST})`,
  "i",
);

export function inkassoVerdacht(text: string): boolean {
  return INKASSO.test(String(text ?? ""));
}

// ── E-253 (28.09.2026): EIN NAME AUS DER AKTE IST KEIN SATZ VON UNS ──────────
// Gemessen am Lauf Lmul3u5la: „Du-Form — Kunden werden gesiezt." bei einer
// sauberen Vorlage. Getroffen hatte die Wand den NACHNAMEN des Empfängers — er
// endet auf „…ğdu", und \b kennt in JavaScript nur ASCII-Buchstaben (auch mit
// u-Flag): Das „ğ" galt als Wortgrenze, die Endsilbe „du" als Wort. Ein zweiter
// Mensch trägt die Namenspartikel „du" (wie in „du Toit") — da hilft keine
// Wortgrenze. Deshalb zwei Dinge:
//   · Wortgrenzen über Unicode-Buchstaben (\p{L}) statt \b, und die volle
//     Liste der Du-Formen (deinen/deinem/deiner/deines/euer/eure fehlten —
//     „deinen Ausweis" kam durch; Postmeister und Mara-Aktion hatten sie schon).
//   · Die Namen des Empfängers (aus der Akte, nie vom Menschen oder der KI
//     getippt) werden vor der Prüfung als Ganzes durch „Muster" ersetzt — für
//     ALLE drei Wände (Inkasso-Wand, Wortwand, Du-Wand) und überall im Text,
//     also auch in freien Texten von Mara, aus dem Raum oder einem frei
//     getippten Platzhalter, sobald der Name darin steht. Geprüft wird alles
//     außer diesen Namen voll. Ein Name, der nur aus Funktionswörtern besteht
//     („von", „de", „Sie" …) oder kürzer als drei Buchstaben ist, wird nie
//     maskiert (Nachtrag E-253, siehe namenMaskieren). Die Länge misst die Wand
//     am echten Text.
const NICHT_WORT_VOR = "(?<![\\p{L}\\p{N}_])";
const NICHT_WORT_NACH = "(?![\\p{L}\\p{N}_])";
const DU_WOERTER = "du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure";
export const DU_FORM = new RegExp(`${NICHT_WORT_VOR}(${DU_WOERTER})${NICHT_WORT_NACH}`, "iu");
const NUR_DU_WORT = new RegExp(`^(${DU_WOERTER})$`, "iu");
// E-253 (28.09.2026, Nachtrag nach der Gegenprüfung): Funktionswörter sind keine Namen, die die Wand übersehen
// darf. In der Produktion steht der Vorname exakt „von" (eine Person, zwei Leads) — maskiert, fiel „innerhalb
// von 24 Stunden" nicht mehr unter die Wortwand (Frist-Regel, shared/fiaon-wortverbote.ts). Namenspartikel,
// Artikel, Pronomen, Präpositionen und Bindewörter werden deshalb allein nie maskiert; „von Probe" als Ganzes schon.
const FUNKTIONSWOERTER = new Set([
  "von", "vom", "van", "der", "den", "dem", "des", "de", "di", "da", "del", "della", "do", "dos", "la", "le", "les", "lo",
  "zu", "zum", "zur", "ter", "ten", "und", "oder", "im", "in", "am", "an", "auf", "aus", "bei", "mit", "nach", "vor", "für",
  "ab", "bis", "ob", "als", "wie", "so", "the", "of", "and", "sie", "ihr", "ihre", "ihnen", "ihren", "ihrem", "ihrer",
  "wir", "uns", "es", "er", "ich", "das", "die", "ein", "eine", "einen", "einem", "einer", "ist", "sind", "hat", "nicht",
  "kein", "keine", "noch", "nur", "auch",
]);
/** Taugt `n` als Name für die Maske? Mindestens drei Buchstaben und nicht nur Funktions- oder Du-Wörter. */
const KEIN_BUCHSTABE = new RegExp("[^\\p{L}]", "gu");
function maskierbarerName(n: string): boolean {
  if (n.length > 200 || n.replace(KEIN_BUCHSTABE, "").length < 3) return false;
  return !n.toLowerCase().split(" ").every((w) => FUNKTIONSWOERTER.has(w) || NUR_DU_WORT.test(w));
}

/**
 * Die bekannten Namen des Empfängers als Ganzes durch „Muster" ersetzen — den
 * vollen Vornamen, den vollen Nachnamen und beide zusammen, ohne Rücksicht auf
 * Groß-/Kleinschreibung und Leerzeichen (schoenerName schreibt um). NIE
 * einzelne Namensteile: Die Partikel „du" aus „du Toit" würde sonst auch ein
 * echtes „du" im Text verstecken. Aus demselben Grund bleibt ein Name, der nur
 * aus einer Du-Form oder aus Funktionswörtern besteht („Du", „von", „de la"),
 * oder der kürzer als drei Buchstaben ist, unmaskiert (maskierbarerName).
 */
export function namenMaskieren(text: string, namen: readonly (string | null | undefined)[] = []): string {
  const teile = Array.from(new Set(namen
    .map((n) => String(n ?? "").replace(/\s+/g, " ").trim())
    .filter(maskierbarerName)))
    .sort((a, b) => b.length - a.length);
  let aus = String(text ?? "");
  for (const n of teile) {
    const muster = n.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("\\s+");
    aus = aus.replace(new RegExp(`${NICHT_WORT_VOR}${muster}${NICHT_WORT_NACH}`, "giu"), "Muster");
  }
  return aus;
}

/**
 * Alles, was gegen eine Regel verstößt — leer heißt: darf raus.
 * `namen`: die Namen des Empfängers aus der Akte (E-253, empfaengerNamen) — sie
 * zählen für keine der drei Wände als unser Text (Inkasso, Wortwand, Du-Form),
 * wo immer sie im Text stehen; alles andere prüft die Wand voll.
 */
export function sendePruefung(text: string, opts: { namen?: readonly (string | null | undefined)[] } = {}): string[] {
  const funde: string[] = [];
  const t = opts.namen?.length ? namenMaskieren(text, opts.namen) : String(text ?? "");
  if (inkassoVerdacht(t)) funde.push("Klingt nach Mahnung oder Forderung — WhatsApp verbietet das (Mail, Telefon oder Brief nehmen).");
  for (const w of wandPruefen(t).filter((x) => x.art === "verboten")) funde.push(`Verbotenes Wort: ${w.treffer}`);
  // E-230: Die Du-Prüfung nur für deutsche Texte — das französische „du"
  // („du soutien") hielt eine korrekte Antwort in der Sprache des Kunden zurück.
  const fremd = /\b(vous|votre|nous|merci|bonjour|pour|avec|les|une|est|soutien)\b/i.test(t)
    && !/\b(Sie|Ihr|Ihre|Ihnen|und|nicht|ist|wir|ich|der|das|mit|kannst|bist|hast)\b/.test(t);
  if (!fremd && DU_FORM.test(t)) funde.push("Du-Form — Kunden werden gesiezt.");
  // Die Länge am echten Text: Meta misst den gefüllten Text, nicht unsere Maske.
  if (String(text ?? "").trim().length > 1024) funde.push("Länger als 1.024 Zeichen.");
  return funde;
}

/**
 * Die Wand für eine VORLAGE (E-253, aus waSenden herausgezogen, damit der
 * Prüfstand sie ohne Meta prüfen kann): Platzhalter mit den echten Werten
 * gefüllt (fehlt einer: „Maria Muster"), dann sendePruefung mit den Namen des
 * Empfängers; die Inkasso-Wand fällt nur für ausdrücklich erlaubte Vorlagen weg.
 */
export function vorlageWandFunde(
  text: string, werte: readonly string[] | undefined,
  opts: { namen?: readonly (string | null | undefined)[]; inkassoOk?: boolean } = {},
): string[] {
  const gefuellt = String(text ?? "").replace(/\{\{(\d+)\}\}/g, (_m, n) => werte?.[Number(n) - 1] ?? "Maria Muster");
  return sendePruefung(gefuellt, { namen: opts.namen })
    .filter((f) => !(opts.inkassoOk && /Mahnung oder Forderung/.test(f)));
}

/**
 * Die Namen des Empfängers aus der Akte (E-253): Vor- und Nachname der Person
 * (und ihres Kopfes) sowie des Leads — getrennt UND zusammen, so wie sie in
 * einer Anrede stehen können. Nur lesend; bei einer Störung leer (dann prüft
 * die Wand wie bisher, also eher zu streng als zu lax).
 */
export async function empfaengerNamen(
  zusatz: { personId?: number | null; leadId?: number | null } = {},
  lauf: Lauf = sqlPool,
): Promise<string[]> {
  const personId = zusatz.personId && Number(zusatz.personId) > 0 ? Number(zusatz.personId) : null;
  const leadId = zusatz.leadId && Number(zusatz.leadId) > 0 ? Number(zusatz.leadId) : null;
  if (!personId && !leadId) return [];
  try {
    const zeilen = (await lauf`
      SELECT p.first_name AS vorname, p.last_name AS nachname FROM fiaon_persons p
       WHERE p.id = ${personId} OR p.id = (SELECT merged_into_person_id FROM fiaon_persons WHERE id = ${personId})
      UNION ALL
      SELECT l.vorname, l.nachname FROM fiaon_leads l
       WHERE l.id = ${leadId} OR (${personId}::int IS NOT NULL AND l.person_id = ${personId})
       LIMIT 20`) as any[];
    const aus: string[] = [];
    for (const z of zeilen) {
      const v = String(z.vorname ?? "").trim();
      const n = String(z.nachname ?? "").trim();
      if (v) aus.push(v);
      if (n) aus.push(n);
      if (v && n) aus.push(`${v} ${n}`);
    }
    return Array.from(new Set(aus));
  } catch (e) {
    console.error("[WHATSAPP] Empfängernamen:", String((e as Error)?.message || e).slice(0, 160));
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN PLATZ JE MENSCH UND TAG (28.09.2026, E-253 — Nachtrag nach der Gegenprüfung)
//
// „Höchstens EINE Nachricht je Person und Tag, egal von wem" prüfte bisher
// jeder Weg für sich — VOR dem Senden, gegen das, was schon in fiaon_whatsapp
// stand. Zwei Wege in derselben Sekunde sahen beide nichts: Am 24.09. bekam ein
// Mensch fiaon_kk_anfrage zweimal, 66 ms auseinander (Automatik der Zentrale
// und Begrüßung neuer Leads). Genauso konnte der Verkaufstakt den nächsten
// Menschen eines laufenden 25er-Happens der Zentrale anschreiben — der Lauf
// hatte ihn Sekunden vorher geprüft und schrieb ihn trotzdem an.
//
// Jetzt nimmt jeder Weg, der UNAUFGEFORDERT eine Vorlage schickt (Zentrale:
// Lauf, Automatik, Verkaufstakt; Lead-Begrüßung; Lead-Kette), direkt vor Meta
// den Tagesplatz des Menschen: je eine Zeile für die Person und die Nummer mit
// eindeutigem Schlüssel (Tag in Berlin) — genau ein Weg bekommt sie, wer leer
// ausgeht, sendet nicht. Dazu der Blick in fiaon_whatsapp: Hat ein anderer Weg
// (Mara, Raum, Akte) heute schon geschrieben, bleibt es bei dieser einen
// Nachricht. Antworten im offenen Fenster brauchen keinen Platz. Bei einer
// Störung: kein Platz — lieber keine Nachricht als zwei.
// ═══════════════════════════════════════════════════════════════════════════
let tagesplatzBereit: Promise<void> | null = null;
let tagesplatzGeraeumt = "";
function tagesplatzTabelle(lauf: Lauf): Promise<void> {
  if (!tagesplatzBereit) {
    tagesplatzBereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_wa_tagesplatz (
          schluessel TEXT NOT NULL,
          tag DATE NOT NULL,
          weg TEXT NOT NULL,
          person_id INTEGER,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (schluessel, tag)
        )`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      tagesplatzBereit = null;
      throw e;
    });
  }
  return tagesplatzBereit;
}

/** Die Grund-Zeile, wenn ein anderer Weg heute schneller war (Prüfstand und Laufkarte erkennen sie). */
export const TAGESPLATZ_BELEGT = "Heute schon eine WhatsApp auf einem anderen Weg — keine zweite am selben Tag.";

/**
 * Den Tagesplatz des Menschen nehmen — DIREKT vor dem Senden einer Vorlage, die
 * er nicht angefordert hat. `ok: false` = heute bekommt er schon etwas (anderer
 * Weg) oder die Prüfung ist gestört; dann nicht senden. Ein genommener Platz
 * bleibt für den Tag, auch wenn die Sendung danach an einer Wand scheitert —
 * wie „höchstens ein Versuch je Person und Tag" in der BASIS der Zentrale.
 */
export async function waTagesplatz(
  ein: { personId?: number | null; nummer?: string | null; weg: string },
  lauf: Lauf = sqlPool,
): Promise<{ ok: true } | { ok: false; grund: string }> {
  const personId = ein.personId && Number(ein.personId) > 0 ? Number(ein.personId) : null;
  const nummer = waKanonisch(ein.nummer ?? null);
  const schluessel = [...(personId ? [`p:${personId}`] : []), ...(nummer ? [`n:${nummer}`] : [])];
  if (!schluessel.length) return { ok: false, grund: "Kein Mensch und keine Nummer für den Tagesplatz." };
  try {
    await tagesplatzTabelle(lauf);
    const genommen = (await lauf`
      INSERT INTO fiaon_wa_tagesplatz (schluessel, tag, weg, person_id)
      SELECT s, (NOW() AT TIME ZONE 'Europe/Berlin')::date, ${String(ein.weg).slice(0, 60)}, ${personId}::int
        FROM unnest(${schluessel}::text[]) AS s
      ON CONFLICT (schluessel, tag) DO NOTHING
      RETURNING schluessel`) as any[];
    if (genommen.length < schluessel.length) return { ok: false, grund: TAGESPLATZ_BELEGT };
    const [schon] = (await lauf`
      SELECT 1 AS x FROM fiaon_whatsapp w
       WHERE w.richtung = 'raus' AND COALESCE(w.status, '') <> 'fehler'
         AND (w.created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date
         AND (w.person_id = ${personId}::int OR w.nummer = ${nummer ?? ""})
       LIMIT 1`) as any[];
    if (schon) return { ok: false, grund: TAGESPLATZ_BELEGT };
    // Alte Plätze einmal am Tag abräumen — nur diese eigene Tabelle, eine Woche Rückblick bleibt.
    const heute = new Date().toISOString().slice(0, 10);
    if (tagesplatzGeraeumt !== heute) {
      tagesplatzGeraeumt = heute;
      await lauf`DELETE FROM fiaon_wa_tagesplatz WHERE tag < (NOW() AT TIME ZONE 'Europe/Berlin')::date - 7`.catch(() => {});
    }
    return { ok: true };
  } catch (e) {
    console.error("[WHATSAPP] Tagesplatz:", String((e as Error)?.message || e).slice(0, 160));
    return { ok: false, grund: "Tagesplatz nicht prüfbar — lieber keine Nachricht als zwei." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN
// ═══════════════════════════════════════════════════════════════════════════

/** Unsere Vorlage im Format von Meta. */
export function vorlageAlsMeta(v: WaVorlage, bildHandles: Partial<Record<WaBild, string>> = {}): Record<string, unknown> {
  const knoepfe = v.knoepfe.map((k) => (k.typ === "URL"
    // E-214: `example` NUR bei einer URL mit Platzhalter — bei einer festen
    // URL weist Meta die Vorlage mit „example not allowed" zurück.
    ? { type: "URL", text: k.text, url: k.url, ...(k.beispiel ? { example: [k.beispiel] } : {}) }
    : { type: "QUICK_REPLY", text: k.text }));
  // E-221: Kopf und Fußzeile. Justin mit dem echten Chat vor Augen: „Das sieht
  // so super billig aus." Die Nachricht begann mitten im Satz, ohne Absender
  // und ohne Abschluss — Meta erlaubt beides, wir hatten es nur nie genutzt.
  const komponenten: Record<string, unknown>[] = [];
  if (v.kopfBild) {
    // E-229: Kopfbild. Meta verlangt beim Einreichen ein Beispiel als
    // hochgeladenes Handle; beim Senden holt es sich das Bild über die Adresse.
    const handle = bildHandles[v.kopfBild];
    if (!handle) throw new Error(`Für das Kopfbild „${v.kopfBild}“ fehlt das Upload-Handle.`);
    komponenten.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [handle] } });
  } else if (v.kopf) {
    komponenten.push({ type: "HEADER", format: "TEXT", text: v.kopf.slice(0, 60) });
  }
  komponenten.push({
    type: "BODY",
    text: v.text,
    ...(v.beispiele.length ? { example: { body_text: [v.beispiele] } } : {}),
  });
  if (v.fuss) komponenten.push({ type: "FOOTER", text: v.fuss.slice(0, 60) });
  if (knoepfe.length) komponenten.push({ type: "BUTTONS", buttons: knoepfe });
  return { name: v.name, language: "de", category: v.kategorie, components: komponenten };
}

/**
 * ALLE VORLAGEN — Haus und Werkstatt (23.09.2026, E-222)
 *
 * Die vierzehn aus dem Quelltext werden namentlich aufgerufen und bleiben dort.
 * Die selbst gebauten stehen in der Datenbank. Für alles, was Vorlagen
 * EINREICHT, AUFRÄUMT oder SENDET, sind beide dasselbe — deshalb gibt es
 * genau eine Funktion, die sie zusammenlegt. Bei Namensgleichheit gewinnt der
 * Quelltext: Was der Code aufruft, darf niemand aus der Oberfläche umbiegen.
 */
export async function alleVorlagen(): Promise<WaVorlage[]> {
  try {
    const { eigeneVorlagen } = await import("./fiaon-whatsapp-werkstatt");
    const eigen = await eigeneVorlagen();
    const haus = new Set(WA_VORLAGEN.map((v) => v.name));
    return [...WA_VORLAGEN, ...eigen.filter((v) => !haus.has(v.name))];
  } catch (e) {
    console.error("[WHATSAPP] Eigene Vorlagen nicht lesbar:", e);
    return [...WA_VORLAGEN];
  }
}

/**
 * DAS KOPFBILD HOCHLADEN (E-229) — für die Einreichung einer Bildvorlage.
 * Derselbe zweistufige Weg wie beim Profilbild (fiaon-whatsapp-werkstatt.ts):
 * Upload-Sitzung am App-Konto öffnen, Bytes senden, Handle zurück.
 */
async function bildHandle(bild: WaBild): Promise<string> {
  const appId = process.env.META_APP_ID;
  const token = process.env.META_SYSTEM_TOKEN || process.env.META_TOKEN || "";
  if (!appId || !token) throw new Error("META_APP_ID oder META_SYSTEM_TOKEN fehlt — ohne sie nimmt Meta kein Kopfbild an.");
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  let daten: Buffer | null = null;
  for (const ordner of ["client/public/wa", "dist/public/wa", "public/wa"]) {
    try { daten = await readFile(join(process.cwd(), ordner, `fiaon-${bild}.png`)); break; } catch { /* nächster Ort */ }
  }
  if (!daten) {
    const r = await fetch(waBildUrl(bild), { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Kopfbild ${bild} nicht lesbar (HTTP ${r.status}).`);
    daten = Buffer.from(await r.arrayBuffer());
  }
  const sitzung = await graph(`${appId}/uploads`, { methode: "POST", params: { file_length: String(daten.length), file_type: "image/png" } });
  const id = String(sitzung?.id ?? "");
  if (!id) throw new Error("Meta hat keine Upload-Sitzung eröffnet.");
  const basis = (process.env.META_GRAPH_URL || "https://graph.facebook.com").replace(/\/+$/, "");
  const antwort = await fetch(`${basis}/v25.0/${id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0", "Content-Type": "image/png" },
    body: new Uint8Array(daten),
    signal: AbortSignal.timeout(60_000),
  });
  const j: any = await antwort.json().catch(() => null);
  if (!antwort.ok || !j?.h) throw new Error(`Kopfbild ${bild} abgelehnt (HTTP ${antwort.status}): ${String(j?.error?.message ?? "").slice(0, 160)}`);
  return String(j.h);
}

/** Handles für alle Kopfbilder, die in dieser Liste vorkommen. Fehler landen je Vorlage, nicht für alle. */
async function bildHandlesFuer(vorlagen: WaVorlage[]): Promise<{ handles: Partial<Record<WaBild, string>>; fehler: Partial<Record<WaBild, string>> }> {
  const handles: Partial<Record<WaBild, string>> = {};
  const fehler: Partial<Record<WaBild, string>> = {};
  const noetig = Array.from(new Set(vorlagen.map((v) => v.kopfBild).filter(Boolean))) as WaBild[];
  for (const b of noetig) {
    try { handles[b] = await bildHandle(b); } catch (e) { fehler[b] = String((e as Error)?.message || e).slice(0, 200); }
  }
  return { handles, fehler };
}

/**
 * Welche Vorlagen hat Meta freigegeben? Fünf Minuten zwischengespeichert —
 * waSenden fragt das bei jeder Nachricht, und Meta soll nicht bei jeder
 * Nachricht die ganze Liste schicken müssen.
 */
let freigabeCache: { bis: number; namen: Set<string> } | null = null;
export async function freigegebeneVorlagen(): Promise<Set<string>> {
  if (freigabeCache && freigabeCache.bis > Date.now()) return freigabeCache.namen;
  try {
    const namen = new Set((await vorlagenStand()).filter((t) => t.status === "APPROVED").map((t) => t.name));
    freigabeCache = { bis: Date.now() + 5 * 60_000, namen };
    return namen;
  } catch {
    freigabeCache = { bis: Date.now() + 60_000, namen: freigabeCache?.namen ?? new Set() };
    return freigabeCache.namen;
  }
}

/** Was Meta über unsere Vorlagen weiß. */
export async function vorlagenStand(): Promise<{ name: string; status: string; kategorie: string; id: string; komponenten?: any[] }[]> {
  const k = waKonfig();
  if (!k.wabaId) return [];
  const a = await graph(`${k.wabaId}/message_templates`, { params: { fields: "name,status,category,language,components", limit: 100 } });
  return (a?.data ?? []).map((t: any) => ({
    name: String(t.name), status: String(t.status), kategorie: String(t.category ?? ""), id: String(t.id),
    // E-221: Für den Abgleich „hat sie schon Kopf und Fuß?" — sonst würden wir
    // bei jedem Lauf alle Vorlagen zur Neuprüfung schicken.
    komponenten: Array.isArray(t.components) ? t.components : [],
  }));
}

/**
 * Alle fehlenden Vorlagen einreichen. Meta prüft danach selbst (Minuten bis
 * Stunden) — der Stand steht im Steuerpult und kommt zusätzlich per Webhook
 * (message_template_status_update).
 */
export async function vorlagenEinreichen(): Promise<{ eingereicht: string[]; schonDa: string[]; fehler: { name: string; grund: string }[] }> {
  const k = waKonfig();
  const erg = { eingereicht: [] as string[], schonDa: [] as string[], fehler: [] as { name: string; grund: string }[] };
  if (!k.wabaId) { erg.fehler.push({ name: "—", grund: "WHATSAPP_WABA_ID fehlt in der Umgebung." }); return erg; }
  const vorhanden = new Set((await vorlagenStand().catch(() => [])).map((t) => t.name));
  const offen = WA_VORLAGEN.filter((v) => {
    if (vorhanden.has(v.name)) { erg.schonDa.push(v.name); return false; }
    // Die Hauswand gilt auch hier — eine einmal freigegebene Vorlage bleibt
    // sonst jahrelang mit einem verbotenen Wort im Umlauf.
    const funde = sendePruefung(v.text.replace(/\{\{\d\}\}/g, "Maria Muster"));
    if (funde.length) { erg.fehler.push({ name: v.name, grund: funde.join(" · ") }); return false; }
    return true;
  });
  lauf.gesamt = offen.length;
  const bilder = await bildHandlesFuer(offen);
  // E-217: vier gleichzeitig statt eine nach der anderen — 94 Sekunden waren
  // länger als jede Geduld.
  await inWellen(offen.map((v) => async () => {
    try {
      if (v.kopfBild && bilder.fehler[v.kopfBild]) throw new Error(bilder.fehler[v.kopfBild]);
      const body = vorlageAlsMeta(v, bilder.handles);
      await graph(`${k.wabaId}/message_templates`, {
        methode: "POST",
        params: {
          name: String(body.name), language: String(body.language), category: String(body.category),
          components: JSON.stringify(body.components),
        },
      });
      erg.eingereicht.push(v.name);
    } catch (e) {
      erg.fehler.push({ name: v.name, grund: e instanceof MetaFehler ? e.klartext : String(e) });
    }
  }));
  return erg;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF IM HINTERGRUND (23.09.2026, E-217)
//
// Justin: „Wenn ich auf einreichen klicke, passiert nichts."
//
// GEMESSEN im Protokoll: Es ist etwas passiert — `POST /vorlagen/einreichen`
// lief durch und meldete „14 neu, 0 Fehler". Es dauerte nur **94 Sekunden**.
// Vierzehn Vorlagen, eine nach der anderen an Meta, jede rund sieben Sekunden.
// Der Knopf stand anderthalb Minuten auf „Reicht ein …", und wer so lange
// wartet, hält das für kaputt — zu Recht.
//
// Zwei Dinge ändern sich deshalb:
//   1. PARALLEL statt nacheinander, vier auf einmal. Aus 94 Sekunden werden
//      rund 25. Mehr als vier gleichzeitig reizt Metas Drosselung.
//   2. IM HINTERGRUND. Der Knopf startet den Lauf und bekommt sofort Antwort;
//      die Seite fragt danach den Stand ab. Ein Auftrag, der länger dauert als
//      die Geduld eines Menschen, darf nicht an einer offenen Verbindung hängen.
//
// Der Stand liegt im Arbeitsspeicher und nicht in der Datenbank: Er lebt
// Sekunden, und ein Neustart des Dienstes macht ihn ohnehin gegenstandslos —
// dann zeigt die Liste den echten Stand bei Meta, was die bessere Wahrheit ist.
// ═══════════════════════════════════════════════════════════════════════════
export interface VorlagenLauf {
  laeuft: boolean;
  was: "einreichen" | "aufraeumen" | null;
  gesamt: number;
  fertig: number;
  seit: string | null;
  ergebnis: Record<string, unknown> | null;
  fehler: string | null;
}
let lauf: VorlagenLauf = { laeuft: false, was: null, gesamt: 0, fertig: 0, seit: null, ergebnis: null, fehler: null };

export function vorlagenLaufStand(): VorlagenLauf {
  return { ...lauf };
}

/** Mehrere Aufträge gleichzeitig, aber nicht alle: Meta drosselt sonst. */
async function inWellen<T>(stuecke: (() => Promise<T>)[], breite = 4): Promise<T[]> {
  const raus: T[] = [];
  for (let i = 0; i < stuecke.length; i += breite) {
    raus.push(...(await Promise.all(stuecke.slice(i, i + breite).map((f) => f()))));
    lauf.fertig = Math.min(lauf.gesamt, i + breite);
  }
  return raus;
}

/**
 * Den Lauf starten. Läuft schon einer, wird KEIN zweiter gestartet — sonst
 * reicht ein ungeduldiger Doppelklick dieselbe Vorlage zweimal ein, und Meta
 * antwortet auf die zweite mit einem Fehler, den niemand versteht.
 */
export function vorlagenLaufStarten(was: "einreichen" | "aufraeumen", opts: { ausfuehren?: boolean } = {}): VorlagenLauf {
  if (lauf.laeuft) return vorlagenLaufStand();
  lauf = { laeuft: true, was, gesamt: 0, fertig: 0, seit: new Date().toISOString(), ergebnis: null, fehler: null };
  void (async () => {
    try {
      // E-221: „Einreichen" heißt jetzt auch „auffrischen". Wer Kopf und Fuß
      // ergänzt, will sie auch bei den Vorlagen haben, die schon durch sind —
      // und muss sie nicht umbenennen. Meta lässt genehmigte Vorlagen
      // bearbeiten; nur die in Prüfung nicht.
      const erg = was === "einreichen" ? await vorlagenEinreichenUndAuffrischen() : await vorlagenAufraeumen({ probe: opts.ausfuehren !== true });
      lauf = { ...lauf, laeuft: false, ergebnis: erg as any, fertig: lauf.gesamt };
    } catch (e) {
      lauf = { ...lauf, laeuft: false, fehler: String((e as Error)?.message || e).slice(0, 300) };
    }
  })();
  return vorlagenLaufStand();
}

/**
 * VORLAGEN AUFFRISCHEN (23.09.2026, E-221)
 *
 * Eine Vorlage, die bei Meta auf APPROVED oder REJECTED steht, lässt sich
 * bearbeiten — nur eine in Prüfung nicht. Deshalb: einreichen, was fehlt, und
 * auffrischen, was sich geändert hat. Sonst müsste jede Textänderung einen
 * neuen Namen bekommen, und der Vorlagenmanager füllte sich mit Leichen.
 *
 * Verglichen wird an Kopf, Text und Fußzeile. Wer nur die Reihenfolge der
 * Knöpfe ändert, löst keine neue Prüfung aus.
 */
export async function vorlagenEinreichenUndAuffrischen(): Promise<{
  eingereicht: string[]; schonDa: string[]; aufgefrischt: string[]; fehler: { name: string; grund: string }[];
}> {
  const k = waKonfig();
  const erg = { eingereicht: [] as string[], schonDa: [] as string[], aufgefrischt: [] as string[], fehler: [] as { name: string; grund: string }[] };
  if (!k.wabaId) { erg.fehler.push({ name: "—", grund: "WHATSAPP_WABA_ID fehlt in der Umgebung." }); return erg; }

  const beiMeta = await vorlagenStand().catch(() => []);
  const nachName = new Map(beiMeta.map((t) => [t.name, t]));
  const neuEinreichen: WaVorlage[] = [];
  const auffrischen: { v: WaVorlage; id: string }[] = [];
  const alle = await alleVorlagen();

  for (const v of alle) {
    const funde = sendePruefung(v.text.replace(/\{\{\d\}\}/g, "Maria Muster"));
    if (funde.length) { erg.fehler.push({ name: v.name, grund: funde.join(" · ") }); continue; }
    const da = nachName.get(v.name);
    if (!da) { neuEinreichen.push(v); continue; }
    erg.schonDa.push(v.name);
    if (da.status !== "APPROVED" && da.status !== "REJECTED") continue; // in Prüfung: nicht anfassbar
    const teile = (da.komponenten ?? []) as any[];
    const kopfDa = String(teile.find((c) => c?.type === "HEADER")?.text ?? "");
    const textDa = String(teile.find((c) => c?.type === "BODY")?.text ?? "");
    const fussDa = String(teile.find((c) => c?.type === "FOOTER")?.text ?? "");
    if (kopfDa === (v.kopf ?? "") && textDa === v.text && fussDa === (v.fuss ?? "")) continue;
    auffrischen.push({ v, id: da.id });
  }

  lauf.gesamt = neuEinreichen.length + auffrischen.length;
  const bilder = await bildHandlesFuer([...neuEinreichen, ...auffrischen.map((a) => a.v)]);
  await inWellen([
    ...neuEinreichen.map((v) => async () => {
      try {
        if (v.kopfBild && bilder.fehler[v.kopfBild]) throw new Error(bilder.fehler[v.kopfBild]);
        const body = vorlageAlsMeta(v, bilder.handles);
        await graph(`${k.wabaId}/message_templates`, {
          methode: "POST",
          params: {
            name: String(body.name), language: String(body.language), category: String(body.category),
            components: JSON.stringify(body.components),
          },
        });
        erg.eingereicht.push(v.name);
      } catch (e) { erg.fehler.push({ name: v.name, grund: e instanceof MetaFehler ? e.klartext : String(e) }); }
    }),
    ...auffrischen.map(({ v, id }) => async () => {
      try {
        if (v.kopfBild && bilder.fehler[v.kopfBild]) throw new Error(bilder.fehler[v.kopfBild]);
        const body = vorlageAlsMeta(v, bilder.handles);
        // Beim Bearbeiten nimmt Meta NUR die Komponenten (und ggf. die
        // Kategorie) — Name und Sprache stehen fest.
        await graph(id, { methode: "POST", params: { components: JSON.stringify(body.components) } });
        erg.aufgefrischt.push(v.name);
      } catch (e) { erg.fehler.push({ name: v.name, grund: e instanceof MetaFehler ? e.klartext : String(e) }); }
    }),
  ]);
  console.log(`[WHATSAPP] Vorlagen: ${erg.eingereicht.length} neu, ${erg.aufgefrischt.length} aufgefrischt, ${erg.fehler.length} Fehler.`);
  return erg;
}

/**
 * ALTE VORLAGEN LÖSCHEN (23.09.2026, E-214)
 *
 * Justin: „Die META-Vorlagen sind Müll, kannst alle löschen!"
 *
 * Gelöscht wird nur, was NICHT mehr in WA_VORLAGEN steht — der Quelltext ist
 * die Wahrheit, Meta die Kopie. Eine Vorlage, die wir gerade erst eingereicht
 * haben, darf ein Aufräumlauf nicht mitnehmen; deshalb der Abgleich und nicht
 * ein „alles weg".
 *
 * Meta löscht per Name, nicht per ID, und entfernt damit ALLE Sprachfassungen
 * dieses Namens. Das ist hier richtig: Wir führen nur Deutsch.
 */
export async function vorlagenAufraeumen(opts: { probe?: boolean } = {}): Promise<{
  behalten: string[]; geloescht: string[]; fehler: { name: string; grund: string }[]; probe: boolean;
}> {
  const k = waKonfig();
  const erg = { behalten: [] as string[], geloescht: [] as string[], fehler: [] as { name: string; grund: string }[], probe: opts.probe === true };
  if (!k.wabaId) { erg.fehler.push({ name: "—", grund: "WHATSAPP_WABA_ID fehlt in der Umgebung." }); return erg; }
  const aktuell = new Set((await alleVorlagen()).map((v) => v.name));
  const beiMeta = await vorlagenStand().catch(() => []);
  const weg = beiMeta.filter((t) => {
    if (aktuell.has(t.name)) { erg.behalten.push(t.name); return false; }
    return true;
  });
  if (opts.probe) {
    erg.geloescht.push(...weg.map((t) => t.name));
  } else {
    lauf.gesamt = weg.length;
    await inWellen(weg.map((t) => async () => {
      try {
        await graph(`${k.wabaId}/message_templates`, { methode: "DELETE", params: { name: t.name } });
        erg.geloescht.push(t.name);
      } catch (e) {
        erg.fehler.push({ name: t.name, grund: e instanceof MetaFehler ? e.klartext : String(e) });
      }
    }));
  }
  console.log(`[WHATSAPP] Aufräumen${opts.probe ? " (Probe)" : ""}: ${erg.geloescht.length} gelöscht, ${erg.behalten.length} behalten.`);
  return erg;
}

// ═══════════════════════════════════════════════════════════════════════════
// SENDEN
// ═══════════════════════════════════════════════════════════════════════════

/** Hat uns dieser Mensch in den letzten 24 Stunden geschrieben? Dann ist Freitext erlaubt. */
export async function fensterOffen(nummer: string, lauf: Lauf = sqlPool): Promise<boolean> {
  const n = waKanonisch(nummer);
  if (!n) return false;
  await waTabellen(lauf);
  const [z] = (await lauf`
    SELECT 1 FROM fiaon_whatsapp
     WHERE nummer = ${n} AND richtung = 'rein' AND empfangen_am > NOW() - INTERVAL '24 hours' LIMIT 1`) as any[];
  return !!z;
}

export interface SendeErgebnis { ok: boolean; waId?: string; grund?: string }

/**
 * Eine Nachricht senden. Ohne offenes Fenster MUSS eine Vorlage genommen
 * werden — sonst lehnt Meta ab, und jede Ablehnung drückt die Qualität.
 */
/**
 * Ein Vermerk in der Akte — aber nur, wo die Akte ihn auch zeigt (E-229).
 *
 * fiaon_contact_log.ref ist Pflicht, und die Akte liest den Verlauf über die
 * Bestellnummern der Person. Bis heute schrieben Kette und Mara OHNE ref — jede
 * Zeile scheiterte still am NOT NULL (gemessen: 0 Vermerke in drei Tagen trotz
 * gesendeter Vorlagen). Jetzt: die jüngste Bestellung der Person trägt den
 * Vermerk. Hat sie keine (reiner Lead), steht der Verlauf im WhatsApp-Raum.
 */
export async function waAktenvermerk(personId: number | null | undefined, text: string, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!personId) return false;
  const [a] = (await lauf`
    SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND ref IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (!a?.ref) return false;
  try {
    await lauf`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${personId}, ${String(a.ref)}, NULL, 'Mara', 'system', ${text.slice(0, 1000)})`;
    return true;
  } catch (e) {
    console.error("[WA] Aktenvermerk:", String((e as Error)?.message || e).slice(0, 160));
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SPERRE GILT AUCH AUF WHATSAPP (25.09.2026, E-240)
//
// Justin: „Bekommt der eine Sperre, dass wir dem nichts weiter schicken? Macht
// Mara das auch wirklich?" Mara-Aktion, WA-Zentrale und Maras Antworten prüften
// die Sperre je für sich — waSenden selbst nicht. Raum, Akte („WhatsApp
// schicken") und Mara-Auftrag schickten jede Vorlage an jeden. Gemessen
// (Produktion, 23.–24.09.2026, 142 werbliche Vorlagen): 22 davon an 10 Menschen
// mit Werbesperre vor dem Versand (13), Vertriebssperre nach heutigem Stand
// (20) oder Kündigung (2) — Mehrfachnennung möglich.
//
// Jetzt hier, an der einen Tür, durch die jede WhatsApp muss:
//   · WERBLICHE Vorlage (waVorlageWerblich — alles außer Rate, Termin,
//     Aktivierung) an einen Menschen mit Werbesperre, Vertriebssperre oder
//     Kündigung ohne laufenden Vertrag (werbungVerboten) → abgelehnt.
//   · Service-Vorlagen (Monatsrate, Termin, Termin morgen, „Konto aktiviert")
//     gehen weiter raus — das ist Vertrags- und Zahlungspost.
//   · Freier Text geht nur im offenen 24-Stunden-Fenster, also nur als Antwort
//     auf seine eigene Nachricht — bleibt erlaubt (was darin steht, regelt
//     Maras Lage: bei Werbesperre ohne Verkauf, fiaon-whatsapp-mara.ts).
//   · Der Mensch ist die Person des Aufrufs, sonst die des Leads, sonst die
//     der Nummer (wemGehoert); mit allen zusammengeführten Personen — die
//     Werbesperre wandert beim Zusammenführen nicht mit.
//   · E-253 (28.09.2026): Die Vertriebssperre zählt NUR an der führenden
//     Person (menschSperre, fiaon-mail-frequenz.ts). Bis heute las diese Tür
//     is_blocked über die ganze Familie — und jede zusammengeführte Dublette
//     trägt is_blocked = TRUE als Wegweiser-Marke (fiaon-person-merge.ts). So
//     wurden 46 Vorlagen an 26 Menschen „wegen Vertriebssperre" übersprungen,
//     von denen keiner gesperrt war; 376 Menschen standen dahinter.
//   · Testkonten bleiben erreichbar: An ihnen prüft Justin die Vorlagen.
// Bei einer Störung der Prüfung geht die Vorlage NICHT raus — Werbung darf
// warten, ein gebrochenes „Stopp" nicht.
// ═══════════════════════════════════════════════════════════════════════════
export async function waVorlagenSperre(
  vorlage: string,
  nummer: string,
  zusatz: { personId?: number | null; leadId?: number | null } = {},
  lauf: Lauf = sqlPool,
): Promise<string | null> {
  const { waVorlageWerblich, menschSperre, werbungVerboten } = await import("./fiaon-mail-frequenz");
  if (!waVorlageWerblich(vorlage)) return null;
  try {
    let personId = zusatz.personId && Number(zusatz.personId) > 0 ? Number(zusatz.personId) : null;
    if (!personId && zusatz.leadId) {
      const [l] = (await lauf`SELECT person_id FROM fiaon_leads WHERE id = ${Number(zusatz.leadId)} LIMIT 1`) as any[];
      if (l?.person_id) personId = Number(l.person_id);
    }
    if (!personId) personId = (await wemGehoert(nummer, lauf)).personId;
    if (!personId) return null; // Unbekannter Mensch: Es gibt keine Sperre, die wir kennen könnten.
    // E-253: EINE Lesart — Kopf über Ketten, Vertriebssperre nur dort, Werbesperre/Kündigung über die Familie.
    const s = await menschSperre(personId, lauf);
    const grund = werbungVerboten(s ? { ...s, test: false } : null);
    if (grund) return `${grund}: Keine werbliche WhatsApp-Vorlage („${vorlage}“) an diesen Menschen. Schreibt er selbst, geht eine Antwort im offenen 24-Stunden-Fenster.`;
    return null;
  } catch (e) {
    console.error("[WHATSAPP] Sperrprüfung:", String((e as Error)?.message || e).slice(0, 200));
    return "Die Sperre dieses Menschen ließ sich gerade nicht prüfen — die werbliche Vorlage geht nicht raus. Bitte später erneut.";
  }
}

export async function waSenden(
  an: string,
  inhalt: { text?: string; vorlage?: string; werte?: string[]; knopfWert?: string },
  zusatz: { personId?: number | null; leadId?: number | null; von?: string | null } = {},
  lauf: Lauf = sqlPool,
): Promise<SendeErgebnis> {
  const k = waKonfig();
  if (!k.bereit) return { ok: false, grund: `WhatsApp ist noch nicht eingerichtet (${k.fehlt.join(", ")}).` };
  // E-230: Alle Aufrufer übergeben eine fertige Nummer (aus nummerFuerWhatsApp
  // oder fiaon_whatsapp.nummer). Noch einmal umrechnen machte aus jeder
  // ausländischen Nummer eine falsche +49-Nummer.
  const nummer = waKanonisch(an);
  if (!nummer) return { ok: false, grund: "Keine brauchbare Nummer." };
  await waTabellen(lauf);

  // E-240 (25.09.2026): Werbesperre, Vertriebssperre, Kündigung — vor allem
  // anderen, auch vor jeder Frage an Meta (waVorlagenSperre, oben).
  if (inhalt.vorlage) {
    const sperre = await waVorlagenSperre(inhalt.vorlage, nummer, zusatz, lauf);
    if (sperre) return { ok: false, grund: sperre };
  }

  const katalog = await alleVorlagen();
  // E-229: Die Aufrufer nennen die Textfassung. Ist die Bildfassung bei Meta
  // freigegeben, geht sie raus — mit denselben Werten, denn der Wortlaut und
  // die Platzhalter sind dieselben, nur in Absätze gegliedert.
  if (inhalt.vorlage && !inhalt.vorlage.startsWith("fiaon_kkb_")) {
    const bild = bildName(inhalt.vorlage);
    if (bild !== inhalt.vorlage && katalog.some((v) => v.name === bild) && (await freigegebeneVorlagen()).has(bild)) {
      inhalt = { ...inhalt, vorlage: bild };
    }
  }
  const gewaehlt = inhalt.vorlage ? katalog.find((v) => v.name === inhalt.vorlage) ?? null : null;
  const probe = inhalt.text ?? gewaehlt?.text ?? "";
  // E-222: Die Inkasso-Wand gilt — außer für die Vorlagen, die ausdrücklich
  // als Zahlungserinnerung zur EIGENEN Rechnung gebaut wurden. Erlaubt ist das
  // benannt: im Quelltext über INKASSO_AUSNAHME, in der Werkstatt über einen
  // Haken, den ein Mensch gesetzt hat. Nie pauschal.
  const inkassoOk = !!inhalt.vorlage
    && ((INKASSO_AUSNAHME as readonly string[]).includes(inhalt.vorlage) || (gewaehlt as any)?.inkassoErlaubt === true);
  // E-253 (28.09.2026): Die Namen des Empfängers aus der Akte zählen für keine der drei Wände
  // (Inkasso, Wortwand, Du-Form) als unser Text — ein Nachname auf „…ğdu" oder mit der Partikel
  // „du" ist keine Du-Form. Das gilt überall im gefüllten Text, auch in frei getippten Platzhaltern
  // und Freitext, wenn der Name darin steht; alles außer diesen Namen prüft die Wand voll.
  // Funktionswörter („von", „de" …) und Namen unter drei Buchstaben werden nie maskiert.
  const namenVon = zusatz.personId || zusatz.leadId ? zusatz : await wemGehoert(nummer, lauf).catch(() => ({ personId: null, leadId: null }));
  const namen = await empfaengerNamen({ personId: namenVon.personId, leadId: namenVon.leadId }, lauf);
  const funde = vorlageWandFunde(probe, inhalt.werte, { namen, inkassoOk });
  if (funde.length) return { ok: false, grund: funde.join(" · ") };

  const offen = await fensterOffen(nummer, lauf);
  if (!inhalt.vorlage && !offen) {
    return { ok: false, grund: "Das 24-Stunden-Fenster ist zu — hier geht nur eine freigegebene Vorlage." };
  }

  // ══════════════════════════════════════════════════════════════════════
  // DER KNOPFWERT — SONST LEHNT META AB (23.09.2026, E-220)
  //
  // Gemessen an einer echten Sendung: „(#131008) Required parameter is missing".
  // Ursache: Mehrere Vorlagen haben einen URL-Knopf mit Platzhalter
  // (https://fiaon.com/a/{{1}}). Für den verlangt Meta beim Senden eine eigene
  // Komponente vom Typ `button` — der Textteil allein genügt nicht.
  //
  // Der Aufrufer soll das NICHT wissen müssen. Welche Vorlage einen Knopf mit
  // Platzhalter hat, steht im Quelltext; also holt sich der Sendeweg den Wert
  // selbst: der persönliche Link dieses Menschen, sonst der allgemeine Weg.
  // Sonst müsste jede der sieben Aufrufstellen dieselbe Regel kennen, und sechs
  // davon würden sie beim nächsten Umbau vergessen.
  // ══════════════════════════════════════════════════════════════════════
  const vorlage = gewaehlt;

  // ══════════════════════════════════════════════════════════════════════
  // DIE PLATZHALTER — VOLLZÄHLIG, SONST LEHNT META AB (23.09.2026, E-229)
  //
  // Gemessen: „(#132000) Number of parameters does not match" bei
  // fiaon_kk_rueckfrage — die Vorlage hat zwei Platzhalter (Name, Absender),
  // der Knopf im Raum schickte einen. Dieselbe Regel wie beim Knopfwert: Der
  // Aufrufer soll die Vorlage nicht auswendig kennen müssen. Aufgefüllt wird
  // aber NUR, was sich ehrlich füllen lässt — die Anrede und der Absender.
  // Fehlt ein Betrag oder eine Referenz, geht die Nachricht nicht raus: Ein
  // Beispielwert aus der Vorlage darf nie bei einem Kunden landen.
  // ══════════════════════════════════════════════════════════════════════
  if (vorlage && inhalt.vorlage) {
    const noetig = Math.max(0, ...Array.from(vorlage.text.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1])));
    const werte = [...(inhalt.werte ?? [])];
    const absender = String(zusatz.von || "").trim();
    const absenderName = absender && !/^(leitung|system|automatik|mara-automatik)$/i.test(absender) ? absender.split(" ")[0] : "Mara";
    for (let i = werte.length; i < noetig; i++) {
      if (i === 0) werte.push("und willkommen");
      else if (inhalt.vorlage === "fiaon_kk_rueckfrage" && i === 1) werte.push(absenderName);
      else return { ok: false, grund: `Für die Vorlage „${inhalt.vorlage}“ fehlt die Angabe {{${i + 1}}} — so ginge sie nicht raus.` };
    }
    inhalt = { ...inhalt, werte: werte.slice(0, noetig) };
  }

  const urlKnopf = vorlage?.knoepfe.find((x) => x.typ === "URL" && x.url.includes("{{")) as { typ: "URL"; url: string } | undefined;
  let knopfWert = inhalt.knopfWert ?? null;
  // E-230: Die Raten-Erinnerung braucht die Referenz GENAU dieser Rate. Ohne
  // sie griffe die Rückfallebene unten zur Referenz der Erstbestellung — deren
  // Seite sagt „Ihr Konto ist aktiv", und der Kunde sähe die falsche Zahlung.
  if (inhalt.vorlage && /^fiaon_kkb?_rate$/.test(inhalt.vorlage) && !/^FIAON-?[A-Z0-9]{6}-\d{1,2}$/i.test(String(knopfWert ?? ""))) {
    return { ok: false, grund: "Die Raten-Erinnerung braucht die Referenz der Rate (FIAON-XXXXXX-N)." };
  }
  // E-241 (25.09.2026): Die Auskunft-Vorlagen (fiaon_kk_auskunft, fiaon_kk_auskunft_lead und ihre
  // Bildfassungen) sind WERBUNG — waVorlageWerblich kennt sie nicht als Service-Post, die Sperre oben
  // greift also. Ihr Knopf braucht den signierten Kurz-Kauflink GENAU dieses Menschen (kaufKurzToken);
  // ohne ihn griffe die Rückfallebene unten zu „start" und der Knopf führte auf eine tote Seite — und
  // Preis und Auskunfteien hätte ein Mensch von Hand getippt. Sie gehen nur über WA-Zentrale und Verkaufstakt.
  if (inhalt.vorlage && AUSKUNFT_VORLAGEN_ALLE.includes(inhalt.vorlage)
    && !/^\d{1,10}-[pf]-[0-9a-z]{6,12}-[0-9a-f]{32}$/.test(String(knopfWert ?? ""))) {
    return { ok: false, grund: "Die Auskunft-Vorlage braucht den Kauflink dieses Menschen — sie geht über die WhatsApp-Zentrale oder den Verkaufstakt, nicht von Hand." };
  }
  if (urlKnopf && !knopfWert) {
    // Der Platzhalter ist der Teil der Adresse NACH dem festen Anfang.
    if (urlKnopf.url.includes("/a/") && zusatz.personId) {
      const [l] = (await lauf`
        SELECT link_code FROM fiaon_leads WHERE person_id = ${zusatz.personId} AND link_code IS NOT NULL
         ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
      if (l?.link_code) knopfWert = `${l.link_code}/w`;
    }
    if (!knopfWert && urlKnopf.url.includes("/zahlung/") && zusatz.personId) {
      const [a] = (await lauf`
        SELECT payment_reference FROM fiaon_applications WHERE person_id = ${zusatz.personId}
           AND merged_into IS NULL AND payment_reference IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
      if (a?.payment_reference) knopfWert = String(a.payment_reference);
    }
    // Ohne eigenen Wert führt der Knopf auf den allgemeinen Weg. Ein Knopf,
    // der irgendwohin führt, ist besser als eine Nachricht, die nicht rausgeht.
    if (!knopfWert) knopfWert = urlKnopf.url.includes("/zahlung/") ? "start" : "start";
  }

  const nutzlast: Record<string, unknown> = inhalt.vorlage
    ? {
        messaging_product: "whatsapp", to: nummer, type: "template",
        template: {
          name: inhalt.vorlage, language: { code: "de" },
          ...(inhalt.werte?.length || knopfWert || vorlage?.kopfBild
            ? {
                components: [
                  ...(vorlage?.kopfBild ? [{ type: "header", parameters: [{ type: "image", image: { link: waBildUrl(vorlage.kopfBild) } }] }] : []),
                  ...(inhalt.werte?.length ? [{ type: "body", parameters: inhalt.werte.map((t) => ({ type: "text", text: t })) }] : []),
                  ...(knopfWert ? [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: knopfWert }] }] : []),
                ],
              }
            : {}),
        },
      }
    : { messaging_product: "whatsapp", to: nummer, type: "text", text: { preview_url: false, body: inhalt.text } };

  // E-220: Der Verlauf soll lesen, was der Kunde gelesen hat. „(Vorlagentext —
  // siehe Vorlagenname oben)" hilft niemandem, der nachvollziehen will, was
  // geschrieben wurde.
  const gerendert = vorlage
    ? vorlage.text.replace(/\{\{(\d)\}\}/g, (_m, n) => inhalt.werte?.[Number(n) - 1] ?? vorlage.beispiele[Number(n) - 1] ?? "")
    : null;

  try {
    const a = await graph(`${k.nummerId}/messages`, { methode: "POST", roherKoerper: nutzlast });
    const waId = String(a?.messages?.[0]?.id ?? "");
    await lauf`
      INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, lead_id, typ, text, vorlage, status, von, gesendet_am)
      VALUES (${waId || null}, 'raus', ${nummer}, ${zusatz.personId ?? null}, ${zusatz.leadId ?? null},
              ${inhalt.vorlage ? "vorlage" : "text"}, ${inhalt.text ?? gerendert}, ${inhalt.vorlage ?? null}, 'gesendet',
              ${zusatz.von ?? "Mara"}, NOW())
      ON CONFLICT (wa_id) DO NOTHING`;
    return { ok: true, waId };
  } catch (e) {
    const grund = e instanceof MetaFehler ? e.klartext : String(e);
    // E-244: auch hier mit Meta-Code, damit die Unzustellbar-Regel ihn lesen kann.
    const gespeichert = e instanceof MetaFehler && e.code ? `(#${e.code}) ${grund}` : grund;
    await lauf`
      INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, lead_id, typ, text, vorlage, status, fehler, von)
      VALUES ('raus', ${nummer}, ${zusatz.personId ?? null}, ${zusatz.leadId ?? null},
              ${inhalt.vorlage ? "vorlage" : "text"}, ${inhalt.text ?? null}, ${inhalt.vorlage ?? null}, 'fehler',
              ${gespeichert.slice(0, 400)}, ${zusatz.von ?? "Mara"})`.catch(() => {});
    return { ok: false, grund };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPFANGEN
// ═══════════════════════════════════════════════════════════════════════════

/** Wer gehört zu dieser Nummer? Person zuerst, sonst Lead. */
export async function wemGehoert(nummer: string, lauf: Lauf = sqlPool): Promise<{ personId: number | null; leadId: number | null; name: string | null }> {
  const n = waKanonisch(nummer);
  if (!n) return { personId: null, leadId: null, name: null };
  const letzte = n.slice(-9);
  // E-230: Hier stand `phone` — die Spalte gibt es nicht (sie heißt primary_phone,
  // der Suchschlüssel phone_key9). Der Fehler wurde vom .catch verschluckt, und
  // jede Person ohne Lead mit derselben Nummer galt als unbekannt: 323 von 466
  // zahlenden Kunden. Sie bekamen dann einen neuen Lead und die Werbe-Begrüßung.
  const [p] = (await lauf`
    SELECT id, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS name
      FROM fiaon_persons
     WHERE merged_into_person_id IS NULL
       AND (phone_key9 = ${letzte} OR regexp_replace(COALESCE(primary_phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + letzte})
     ORDER BY (ist_test_am IS NULL) DESC, updated_at DESC NULLS LAST LIMIT 1`.catch((e) => { console.error("[WHATSAPP] wemGehoert Person:", e); return []; })) as any[];
  if (p?.id) return { personId: Number(p.id), leadId: null, name: String(p.name || "").trim() || null };
  const [l] = (await lauf`
    SELECT id, person_id, TRIM(COALESCE(vorname, '') || ' ' || COALESCE(nachname, '')) AS name
      FROM fiaon_leads
     WHERE regexp_replace(COALESCE(telefon, ''), '[^0-9]', '', 'g') LIKE ${"%" + letzte}
     ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
  if (l?.id) return { personId: l.person_id ? Number(l.person_id) : null, leadId: Number(l.id), name: String(l.name || "").trim() || null };
  return { personId: null, leadId: null, name: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE UNBEKANNTE NUMMER IST EIN LEAD, KEIN NIEMAND (23.09.2026, E-214)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Sophia Handler hat am 23.09. um 15:19 Uhr auf unsere WhatsApp geschrieben.
// Mara fragte sie Feld für Feld ab — Name, Geburtsdatum, E-Mail, Telefon —,
// Sophia antwortete auf alles, und danach existierte: nichts. Das Gespräch hatte
// keine Person, keinen Lead, keinen Antrag, keinen Betreuer. Vier Angaben eines
// echten Interessenten lagen in einem herrenlosen Chat, den niemand aufmacht.
//
// Die Ursache: `wemGehoert` sucht eine Person oder einen Lead zur Nummer.
// Findet es nichts, wurde die Nachricht mit person_id = NULL gespeichert — und
// das war das Ende. Keine Anlage, keine Zuteilung, keine Arbeitsliste.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Wer uns schreibt, ist ein Lead. Punkt. Angelegt wird er über DENSELBEN Weg
// wie ein Lead aus der Anzeige (`leadEingang` → `processIntake`): dieselbe
// Namensreinigung, dieselbe Dublettenprüfung über 24 Stunden, dieselbe Bindung
// an eine bestehende Person, dasselbe Protokoll. Quelle: `whatsapp_eingang`.
//
// Danach greift alles Übrige von selbst — Zuteilung, Arbeitsliste, Stufe C.
// Kein eigener Sonderweg, der beim nächsten Umbau vergessen wird.
// ═══════════════════════════════════════════════════════════════════════════
async function leadAusEingang(nummer: string, ersterText: string): Promise<{ personId: number | null; leadId: number | null; name: string | null }> {
  try {
    const { leadEingang } = await import("../routes/fiaon-leads");
    const erg: any = await leadEingang({
      telefon: nummer.startsWith("+") ? nummer : `+${nummer}`,
      quelle: "whatsapp_eingang",
      // Ein Name steht hier ausdrücklich NICHT: Maras erste Nachricht ist kein
      // Formular, und ein aus dem Fließtext geratener Name wäre falscher als
      // gar keiner. Sobald der Mensch seinen Namen nennt, trägt ihn
      // `namenAusGespraech` nach (unten).
    });
    if (!erg?.ok) { console.error("[WHATSAPP] Lead-Anlage abgelehnt:", erg?.error); return { personId: null, leadId: null, name: null }; }
    const leadId = Number(erg.id ?? erg.leadId ?? 0) || null;
    const [l] = leadId
      ? (await sqlPool`SELECT person_id FROM fiaon_leads WHERE id = ${leadId} LIMIT 1`.catch(() => [])) as any[]
      : [];
    console.log(`[WHATSAPP] Unbekannte Nummer ${nummer} → Lead ${leadId} angelegt.`);
    return { personId: l?.person_id ? Number(l.person_id) : null, leadId, name: null };
  } catch (e) {
    console.error("[WHATSAPP] Lead-Anlage:", e);
    return { personId: null, leadId: null, name: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS DER MENSCH VON SELBST SAGT, GEHT NICHT MEHR VERLOREN (E-214)
//
// Sophia Handler hat „Sophia Handler", „25.09.1998" und „handler710@gmail.com"
// geschrieben. Alles drei stand hinterher nirgends. Ab jetzt wird es am Lead
// nachgetragen — aber NUR, wenn die Nachricht eindeutig ist und das Feld leer:
//
//   · eine Nachricht, die AUSSCHLIESSLICH eine E-Mail-Adresse ist
//   · eine Nachricht aus zwei bis drei reinen Wortteilen, die wie ein Name aussieht
//   · ein Datum in deutscher Schreibweise als Geburtsdatum
//
// Bewusst kein Herauslesen aus Fließtext: „Ich habe mit Herrn Müller gesprochen"
// würde sonst zu „Herr Müller". Ein falscher Name in der Akte ist schlimmer als
// gar keiner — er wandert in Anreden, Verträge und Schreiben.
//
// Und bewusst nur bei LEEREN Feldern: Was ein Mensch im Antrag angegeben hat,
// schlägt eine beiläufige Chatnachricht immer.
// ═══════════════════════════════════════════════════════════════════════════
const NUR_MAIL = /^[^\s@]{1,64}@[^\s@]{2,63}\.[A-Za-z]{2,10}$/;
const NUR_NAME = /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß'-]{1,24}(?:\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß'-]{1,24}){1,2}$/;
const NUR_DATUM = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/;
const NICHT_NAME = new Set(["guten tag", "guten morgen", "guten abend", "vielen dank", "danke schön", "alles klar", "kein interesse", "ja bitte", "nein danke", "bitte anrufen"]);

async function angabeNachtragen(leadId: number | null, personId: number | null, text: string, lauf: Lauf = sqlPool): Promise<void> {
  if (!leadId && !personId) return;
  const t = text.trim();
  if (!t || t.length > 80) return;
  try {
    if (NUR_MAIL.test(t)) {
      if (leadId) await lauf`UPDATE fiaon_leads SET email = ${t.toLowerCase()} WHERE id = ${leadId} AND NULLIF(TRIM(COALESCE(email,'')),'') IS NULL`;
      if (personId) await lauf`UPDATE fiaon_persons SET primary_email = ${t.toLowerCase()}, updated_at = NOW() WHERE id = ${personId} AND NULLIF(TRIM(COALESCE(primary_email,'')),'') IS NULL`.catch(() => {});
      return;
    }
    const d = NUR_DATUM.exec(t);
    if (d) {
      const jahr = Number(d[3]);
      // Ein Geburtsdatum, das kein Geburtsdatum sein kann, ist keins.
      // `fiaon_leads` führt kein Geburtsdatum — es gehört an den Menschen.
      if (personId && jahr >= 1920 && jahr <= new Date().getFullYear() - 16) {
        const iso = `${d[3]}-${String(d[2]).padStart(2, "0")}-${String(d[1]).padStart(2, "0")}`;
        await lauf`UPDATE fiaon_persons SET birthdate = ${iso}, updated_at = NOW() WHERE id = ${personId} AND birthdate IS NULL`.catch(() => {});
      }
      return;
    }
    if (NUR_NAME.test(t) && !NICHT_NAME.has(t.toLowerCase())) {
      const teile = t.split(/\s+/);
      const vor = teile[0]; const nach = teile.slice(1).join(" ");
      if (leadId) {
        await lauf`
          UPDATE fiaon_leads SET vorname = ${vor}, nachname = ${nach}
           WHERE id = ${leadId}
             AND NULLIF(TRIM(COALESCE(vorname,'')),'') IS NULL
             AND NULLIF(TRIM(COALESCE(nachname,'')),'') IS NULL`;
      }
      if (personId) {
        await lauf`
          UPDATE fiaon_persons SET first_name = ${vor}, last_name = ${nach}, updated_at = NOW()
           WHERE id = ${personId}
             AND NULLIF(TRIM(COALESCE(first_name,'')),'') IS NULL
             AND NULLIF(TRIM(COALESCE(last_name,'')),'') IS NULL`.catch(() => {});
      }
    }
  } catch (e) { console.error("[WHATSAPP] Angabe nachtragen:", e); }
}

/**
 * HERRENLOSE GESPRÄCHE NACHZIEHEN (23.09.2026, E-214)
 *
 * Die Regel oben gilt ab jetzt. Sophia Handler hat vorher geschrieben — ihr
 * Gespräch hängt an keinem Menschen. Diese Funktion holt das nach: Sie sucht
 * Gespräche ohne Person und ohne Lead, legt den Lead an und trägt nach, was
 * der Mensch in seinen eigenen Nachrichten genannt hat.
 *
 * Sie läuft beim Öffnen des WhatsApp-Raums mit — gedeckelt und idempotent. Ein
 * eigener Knopf wäre ein Knopf, den niemand drückt; ein Aufräumlauf im
 * Tageslauf ließe Sophia bis morgen früh liegen.
 */
export async function verwaisteNachziehen(hoechstens = 25, lauf: Lauf = sqlPool): Promise<number> {
  await waTabellen(lauf);
  const offen = (await lauf`
    SELECT nummer FROM fiaon_whatsapp_gespraech
     WHERE person_id IS NULL AND lead_id IS NULL
     ORDER BY updated_at DESC NULLS LAST LIMIT ${Math.min(Math.max(hoechstens, 1), 100)}`.catch(() => [])) as any[];
  let angelegt = 0;
  for (const g of offen) {
    const nummer = String(g.nummer);
    // Zwischendurch könnte jemand von Hand zugeordnet haben.
    const jetzt = await wemGehoert(nummer, lauf);
    if (jetzt.personId || jetzt.leadId) {
      await lauf`UPDATE fiaon_whatsapp_gespraech SET person_id = ${jetzt.personId}, lead_id = ${jetzt.leadId} WHERE nummer = ${nummer}`.catch(() => {});
      continue;
    }
    const [erste] = (await lauf`
      SELECT text FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'rein' ORDER BY id ASC LIMIT 1`.catch(() => [])) as any[];
    const neu = await leadAusEingang(nummer, String(erste?.text ?? ""));
    if (!neu.leadId && !neu.personId) continue;
    angelegt++;
    await lauf`
      UPDATE fiaon_whatsapp_gespraech SET person_id = ${neu.personId}, lead_id = ${neu.leadId}, updated_at = NOW()
       WHERE nummer = ${nummer}`.catch(() => {});
    await lauf`
      UPDATE fiaon_whatsapp SET person_id = COALESCE(person_id, ${neu.personId}), lead_id = COALESCE(lead_id, ${neu.leadId})
       WHERE nummer = ${nummer}`.catch(() => {});
    // Alles, was der Mensch von sich aus geschrieben hat, in der Reihenfolge
    // des Eingangs nachtragen — so gewinnt die erste Nennung, nicht die letzte.
    const eigene = (await lauf`
      SELECT text FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'rein' AND text IS NOT NULL
       ORDER BY id ASC LIMIT 40`.catch(() => [])) as any[];
    for (const z of eigene) await angabeNachtragen(neu.leadId, neu.personId, String(z.text), lauf);
  }
  if (angelegt) console.log(`[WHATSAPP] ${angelegt} herrenlose(s) Gespräch(e) nachgezogen.`);
  return angelegt;
}

/**
 * Eine Meldung von Meta verarbeiten (Feld „messages"): eingehende Nachrichten
 * und Zustellstände. Idempotent über die Nachrichten-Kennung von WhatsApp.
 */
export async function waEingang(wert: any, lauf: Lauf = sqlPool): Promise<{ neu: number; status: number }> {
  await waTabellen(lauf);
  let neu = 0, status = 0;

  for (const m of wert?.messages ?? []) {
    // E-230: Meta liefert die Absender-ID immer MIT Landesvorwahl (ohne Plus).
    // Sie ist schon fertig — nicht noch einmal als deutsche Eingabe deuten.
    const nummer = waKanonisch(m?.from);
    if (!nummer) continue;
    const text = String(m?.text?.body ?? m?.button?.text ?? m?.interactive?.button_reply?.title ?? "").slice(0, 4000);
    let gehoert = await wemGehoert(nummer, lauf);
    // E-214: Kennen wir die Nummer nicht, legen wir einen Lead an — sonst
    // landet der Mensch in einem Chat, den niemand besitzt.
    if (!gehoert.personId && !gehoert.leadId) {
      gehoert = await leadAusEingang(nummer, text);
    }
    const knopf = String(m?.button?.payload ?? m?.interactive?.button_reply?.id ?? "") || null;
    const zeilen = (await lauf`
      INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, lead_id, typ, text, knopf, status, empfangen_am)
      VALUES (${String(m?.id ?? "")}, 'rein', ${nummer}, ${gehoert.personId}, ${gehoert.leadId},
              ${String(m?.type ?? "text")}, ${text || null}, ${knopf}, 'empfangen',
              ${m?.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date()})
      ON CONFLICT (wa_id) DO NOTHING RETURNING id`) as any[];
    if (zeilen.length) {
      neu++;
      // E-214: Was der Mensch von selbst nennt, wird am Lead nachgetragen.
      await angabeNachtragen(gehoert.leadId, gehoert.personId, text, lauf);
      // Mara antwortet — im Hintergrund, damit der Webhook in Millisekunden
      // fertig ist (Meta wiederholt sonst die Meldung). Sie prüft selbst, ob
      // sie darf: Schalter am Gespräch, Fenster, Kostendeckel, Wortwand.
      void import("./fiaon-whatsapp-mara")
        .then((m) => m.maraAntwortet(nummer))
        .then((r) => { if (!r.gesendet && r.grund) console.log(`[MARA-WA] ${nummer}: ${r.grund}`); })
        .catch((e) => console.error("[MARA-WA] Aufruf:", e));
    }
  }

  for (const s of wert?.statuses ?? []) {
    const feld = s?.status === "delivered" ? "zugestellt_am" : s?.status === "read" ? "gelesen_am" : null;
    if (feld) {
      await lauf.unsafe(
        `UPDATE fiaon_whatsapp SET ${feld} = COALESCE(${feld}, NOW()), status = $2 WHERE wa_id = $1`,
        [String(s?.id ?? ""), String(s?.status)],
      ).catch(() => {});
      status++;
    } else if (s?.status === "failed") {
      // E-244 (26.09.2026): mit Meta-Code — „(#131026) Message undeliverable — …". Der Titel bleibt
      // drin (Leser prüfen auf „undeliverable"); fiaon-wa-unzustellbar.ts sperrt die Nummer danach.
      await lauf`
        UPDATE fiaon_whatsapp SET status = 'fehler', fehler = ${waFehlerText(s?.errors?.[0])}
         WHERE wa_id = ${String(s?.id ?? "")}`.catch(() => {});
      status++;
    }
  }
  return { neu, status };
}

/** Der Verlauf einer Nummer oder eines Menschen — für Akte und Steuerpult. */
export async function waVerlauf(opts: { personId?: number | null; nummer?: string | null; hoechstens?: number }, lauf: Lauf = sqlPool): Promise<any[]> {
  await waTabellen(lauf);
  const grenze = Math.min(Math.max(opts.hoechstens ?? 50, 1), 200);
  if (opts.personId) {
    return (await lauf`
      SELECT * FROM fiaon_whatsapp WHERE person_id = ${opts.personId} ORDER BY id DESC LIMIT ${grenze}`) as any[];
  }
  const n = waKanonisch(opts.nummer);
  if (!n) return [];
  return (await lauf`SELECT * FROM fiaon_whatsapp WHERE nummer = ${n} ORDER BY id DESC LIMIT ${grenze}`) as any[];
}

/** Zahlen für das Steuerpult. */
export async function waZahlen(lauf: Lauf = sqlPool): Promise<Record<string, number>> {
  await waTabellen(lauf);
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE richtung = 'raus' AND gesendet_am > NOW() - INTERVAL '24 hours')::int AS raus,
           COUNT(*) FILTER (WHERE richtung = 'rein' AND empfangen_am > NOW() - INTERVAL '24 hours')::int AS rein,
           COUNT(*) FILTER (WHERE status = 'fehler' AND created_at > NOW() - INTERVAL '7 days')::int AS fehler,
           COUNT(DISTINCT nummer) FILTER (WHERE richtung = 'rein' AND empfangen_am > NOW() - INTERVAL '24 hours')::int AS offene_fenster
      FROM fiaon_whatsapp`) as any[];
  return { raus: Number(z?.raus || 0), rein: Number(z?.rein || 0), fehler: Number(z?.fehler || 0), offeneFenster: Number(z?.offene_fenster || 0) };
}
