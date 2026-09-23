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
    ? { type: "URL", text: k.text, url: k.url, example: [k.beispiel] }
    : { type: "QUICK_REPLY", text: k.text }));
  const komponenten: Record<string, unknown>[] = [{
    type: "BODY",
    text: v.text,
    ...(v.beispiele.length ? { example: { body_text: [v.beispiele] } } : {}),
  }];
  if (knoepfe.length) komponenten.push({ type: "BUTTONS", buttons: knoepfe });
  return { name: v.name, language: "de", category: v.kategorie, components: komponenten };
}

/** Was Meta über unsere Vorlagen weiß. */
export async function vorlagenStand(): Promise<{ name: string; status: string; kategorie: string; id: string }[]> {
  const k = waKonfig();
  if (!k.wabaId) return [];
  const a = await graph(`${k.wabaId}/message_templates`, { params: { fields: "name,status,category,language", limit: 100 } });
  return (a?.data ?? []).map((t: any) => ({ name: String(t.name), status: String(t.status), kategorie: String(t.category ?? ""), id: String(t.id) }));
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
  for (const v of WA_VORLAGEN) {
    if (vorhanden.has(v.name)) { erg.schonDa.push(v.name); continue; }
    // Die Hauswand gilt auch hier — eine einmal freigegebene Vorlage bleibt
    // sonst jahrelang mit einem verbotenen Wort im Umlauf.
    const funde = sendePruefung(v.text.replace(/\{\{\d\}\}/g, "Maria Muster"));
    if (funde.length) { erg.fehler.push({ name: v.name, grund: funde.join(" · ") }); continue; }
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
  }
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

  const nutzlast: Record<string, unknown> = inhalt.vorlage
    ? {
        messaging_product: "whatsapp", to: nummer, type: "template",
        template: {
          name: inhalt.vorlage, language: { code: "de" },
          ...(inhalt.werte?.length || inhalt.knopfWert
            ? {
                components: [
                  ...(inhalt.werte?.length ? [{ type: "body", parameters: inhalt.werte.map((t) => ({ type: "text", text: t })) }] : []),
                  ...(inhalt.knopfWert ? [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: inhalt.knopfWert }] }] : []),
                ],
              }
            : {}),
        },
      }
    : { messaging_product: "whatsapp", to: nummer, type: "text", text: { preview_url: false, body: inhalt.text } };

  try {
    const a = await graph(`${k.nummerId}/messages`, { methode: "POST", roherKoerper: nutzlast });
    const waId = String(a?.messages?.[0]?.id ?? "");
    await lauf`
      INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, lead_id, typ, text, vorlage, status, von, gesendet_am)
      VALUES (${waId || null}, 'raus', ${nummer}, ${zusatz.personId ?? null}, ${zusatz.leadId ?? null},
              ${inhalt.vorlage ? "vorlage" : "text"}, ${inhalt.text ?? null}, ${inhalt.vorlage ?? null}, 'gesendet',
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
    const gehoert = await wemGehoert(nummer, lauf);
    const text = String(m?.text?.body ?? m?.button?.text ?? m?.interactive?.button_reply?.title ?? "").slice(0, 4000);
    const knopf = String(m?.button?.payload ?? m?.interactive?.button_reply?.id ?? "") || null;
    const zeilen = (await lauf`
      INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, lead_id, typ, text, knopf, status, empfangen_am)
      VALUES (${String(m?.id ?? "")}, 'rein', ${nummer}, ${gehoert.personId}, ${gehoert.leadId},
              ${String(m?.type ?? "text")}, ${text || null}, ${knopf}, 'empfangen',
              ${m?.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date()})
      ON CONFLICT (wa_id) DO NOTHING RETURNING id`) as any[];
    if (zeilen.length) {
      neu++;
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
