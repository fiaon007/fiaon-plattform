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
import { WA_VORLAGEN, type WaVorlage } from "../../shared/fiaon-lead-texte";
import { nummerFuerWhatsApp } from "../../shared/fiaon-whatsapp-erlaubnis";
import { wandPruefen } from "../../shared/fiaon-wortverbote";

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
const INKASSO = /\b(mahn\w*|inkasso|forderung\w*|zahlungsverzug|überfällig|verzugszins\w*|offene\s+rate|rückstand\w*|zwangs\w*)\b/i;

export function inkassoVerdacht(text: string): boolean {
  return INKASSO.test(String(text ?? ""));
}

/** Alles, was gegen eine Regel verstößt — leer heißt: darf raus. */
export function sendePruefung(text: string): string[] {
  const funde: string[] = [];
  if (inkassoVerdacht(text)) funde.push("Klingt nach Mahnung oder Forderung — WhatsApp verbietet das (Mail, Telefon oder Brief nehmen).");
  for (const w of wandPruefen(text).filter((x) => x.art === "verboten")) funde.push(`Verbotenes Wort: ${w.treffer}`);
  if (/\b(du|dich|dir|dein|deine|euch)\b/i.test(text)) funde.push("Du-Form — Kunden werden gesiezt.");
  if (text.trim().length > 1024) funde.push("Länger als 1.024 Zeichen.");
  return funde;
}

// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN
// ═══════════════════════════════════════════════════════════════════════════

/** Unsere Vorlage im Format von Meta. */
export function vorlageAlsMeta(v: WaVorlage): Record<string, unknown> {
  const knoepfe = v.knoepfe.map((k) => (k.typ === "URL"
    // E-214: `example` NUR bei einer URL mit Platzhalter — bei einer festen
    // URL weist Meta die Vorlage mit „example not allowed" zurück.
    ? { type: "URL", text: k.text, url: k.url, ...(k.beispiel ? { example: [k.beispiel] } : {}) }
    : { type: "QUICK_REPLY", text: k.text }));
  // E-221: Kopf und Fußzeile. Justin mit dem echten Chat vor Augen: „Das sieht
  // so super billig aus." Die Nachricht begann mitten im Satz, ohne Absender
  // und ohne Abschluss — Meta erlaubt beides, wir hatten es nur nie genutzt.
  const komponenten: Record<string, unknown>[] = [];
  if (v.kopf) komponenten.push({ type: "HEADER", format: "TEXT", text: v.kopf.slice(0, 60) });
  komponenten.push({
    type: "BODY",
    text: v.text,
    ...(v.beispiele.length ? { example: { body_text: [v.beispiele] } } : {}),
  });
  if (v.fuss) komponenten.push({ type: "FOOTER", text: v.fuss.slice(0, 60) });
  if (knoepfe.length) komponenten.push({ type: "BUTTONS", buttons: knoepfe });
  return { name: v.name, language: "de", category: v.kategorie, components: komponenten };
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
  // E-217: vier gleichzeitig statt eine nach der anderen — 94 Sekunden waren
  // länger als jede Geduld.
  await inWellen(offen.map((v) => async () => {
    try {
      const body = vorlageAlsMeta(v);
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

  for (const v of WA_VORLAGEN) {
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
  await inWellen([
    ...neuEinreichen.map((v) => async () => {
      try {
        const body = vorlageAlsMeta(v);
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
        const body = vorlageAlsMeta(v);
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
  const aktuell = new Set(WA_VORLAGEN.map((v) => v.name));
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
  const n = nummerFuerWhatsApp(nummer);
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
export async function waSenden(
  an: string,
  inhalt: { text?: string; vorlage?: string; werte?: string[]; knopfWert?: string },
  zusatz: { personId?: number | null; leadId?: number | null; von?: string | null } = {},
  lauf: Lauf = sqlPool,
): Promise<SendeErgebnis> {
  const k = waKonfig();
  if (!k.bereit) return { ok: false, grund: `WhatsApp ist noch nicht eingerichtet (${k.fehlt.join(", ")}).` };
  const nummer = nummerFuerWhatsApp(an);
  if (!nummer) return { ok: false, grund: "Keine brauchbare Nummer." };
  await waTabellen(lauf);

  const probe = inhalt.text ?? WA_VORLAGEN.find((v) => v.name === inhalt.vorlage)?.text ?? "";
  const funde = sendePruefung(probe.replace(/\{\{\d\}\}/g, (m) => inhalt.werte?.[Number(m[2]) - 1] ?? "Maria Muster"));
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
  const vorlage = inhalt.vorlage ? WA_VORLAGEN.find((v) => v.name === inhalt.vorlage) ?? null : null;
  const urlKnopf = vorlage?.knoepfe.find((x) => x.typ === "URL" && x.url.includes("{{")) as { typ: "URL"; url: string } | undefined;
  let knopfWert = inhalt.knopfWert ?? null;
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
          ...(inhalt.werte?.length || knopfWert
            ? {
                components: [
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
    await lauf`
      INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, lead_id, typ, text, vorlage, status, fehler, von)
      VALUES ('raus', ${nummer}, ${zusatz.personId ?? null}, ${zusatz.leadId ?? null},
              ${inhalt.vorlage ? "vorlage" : "text"}, ${inhalt.text ?? null}, ${inhalt.vorlage ?? null}, 'fehler',
              ${grund.slice(0, 400)}, ${zusatz.von ?? "Mara"})`.catch(() => {});
    return { ok: false, grund };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPFANGEN
// ═══════════════════════════════════════════════════════════════════════════

/** Wer gehört zu dieser Nummer? Person zuerst, sonst Lead. */
export async function wemGehoert(nummer: string, lauf: Lauf = sqlPool): Promise<{ personId: number | null; leadId: number | null; name: string | null }> {
  const n = nummerFuerWhatsApp(nummer);
  if (!n) return { personId: null, leadId: null, name: null };
  const letzte = n.slice(-9);
  const [p] = (await lauf`
    SELECT id, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS name
      FROM fiaon_persons
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + letzte}
     ORDER BY updated_at DESC NULLS LAST LIMIT 1`.catch(() => [])) as any[];
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
    const nummer = nummerFuerWhatsApp(m?.from);
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
      await lauf`
        UPDATE fiaon_whatsapp SET status = 'fehler', fehler = ${String(s?.errors?.[0]?.title ?? "abgelehnt").slice(0, 300)}
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
  const n = nummerFuerWhatsApp(opts.nummer);
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
