// ═══════════════════════════════════════════════════════════════════════════
// DIE VORLAGEN-WERKSTATT UND DAS GESCHÄFTSPROFIL (23.09.2026, E-222)
//
// Justin: „Mache das bitte fertig und SUPER seriös, damit das zur
// Verkaufsmaschine wird … und gib mir auch die Möglichkeit mit allen
// Funktionen, die Meta anbietet, dass wir selbst Vorlagen anlegen, bearbeiten
// und gestalten können."
//
// ── ZWEI SORTEN VORLAGEN, UND WARUM ───────────────────────────────────────
// Die vierzehn Haus-Vorlagen stehen im Quelltext (shared/fiaon-lead-texte.ts).
// Das bleibt so: Sie werden an sieben Stellen NAMENTLICH aufgerufen — von der
// Nachfass-Strecke, von Mara, aus der Akte. Wären sie in der Datenbank
// änderbar, könnte ein Klick den Namen ändern, und sieben Aufrufe liefen ins
// Leere.
//
// Daneben gibt es ab jetzt EIGENE Vorlagen: frei angelegt, frei gestaltet,
// frei gelöscht. Sie stehen in der Datenbank, gehen denselben Weg zu Meta und
// erscheinen überall dort, wo Vorlagen auswählbar sind. Der Unterschied ist
// nur die Herkunft — für den Mitarbeiter im WhatsApp-Raum sieht beides gleich
// aus.
//
// ── DAS GESCHÄFTSPROFIL ───────────────────────────────────────────────────
// Im Chat sah der Kunde bisher „Unternehmenskonto · Beigetreten im letzten
// Monat" und ein beliebiges Bild. Das ist das Erste, was er sieht, bevor er
// ein Wort liest. Meta hält dafür ein eigenes Profil bereit — Beschreibung,
// Adresse, E-Mail, Website, Branche, Bild. Das war nie gesetzt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { graph, MetaFehler } from "./fiaon-meta";
import { waKonfig, sendePruefung, inkassoVerdacht } from "./fiaon-whatsapp";
import type { WaVorlage, WaKnopf } from "../../shared/fiaon-lead-texte";

let bereit: Promise<void> | null = null;
export function werkstattTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_wa_vorlage (
          name TEXT PRIMARY KEY,
          kategorie TEXT NOT NULL DEFAULT 'UTILITY',
          zweck TEXT NOT NULL DEFAULT '',
          wann TEXT NOT NULL DEFAULT '',
          kopf TEXT,
          text TEXT NOT NULL,
          fuss TEXT,
          beispiele JSONB NOT NULL DEFAULT '[]'::jsonb,
          knoepfe JSONB NOT NULL DEFAULT '[]'::jsonb,
          -- Eine Ausnahme, die ein Mensch ausdrücklich gesetzt hat, mit Grund.
          inkasso_erlaubt BOOLEAN NOT NULL DEFAULT FALSE,
          erstellt_von TEXT,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          geaendert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
    })().catch((e) => {
      const c = String((e as any)?.code ?? "");
      if (c === "23505" || c === "42P07") return;
      bereit = null;
      throw e;
    });
  }
  return bereit;
}

/** Ein Name, den Meta annimmt: klein, Ziffern, Unterstriche, höchstens 512. */
export function nameSauber(roh: string): string {
  return String(roh ?? "")
    .toLowerCase()
    .replace(/[äöüß]/g, (m) => ({ "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[m] ?? m))
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

export interface EigeneVorlage extends WaVorlage {
  inkassoErlaubt?: boolean;
  erstelltVon?: string | null;
  eigen: true;
}

function ausZeile(z: any): EigeneVorlage {
  return {
    name: String(z.name),
    kategorie: String(z.kategorie) === "MARKETING" ? "MARKETING" : "UTILITY",
    zweck: String(z.zweck ?? ""),
    wann: String(z.wann ?? ""),
    kopf: z.kopf ?? undefined,
    fuss: z.fuss ?? undefined,
    text: String(z.text ?? ""),
    beispiele: (typeof z.beispiele === "string" ? JSON.parse(z.beispiele) : z.beispiele ?? []).map(String),
    knoepfe: (typeof z.knoepfe === "string" ? JSON.parse(z.knoepfe) : z.knoepfe ?? []) as WaKnopf[],
    inkassoErlaubt: z.inkasso_erlaubt === true,
    erstelltVon: z.erstellt_von ?? null,
    eigen: true,
  };
}

export async function eigeneVorlagen(): Promise<EigeneVorlage[]> {
  await werkstattTabelle();
  const z = (await sqlPool`SELECT * FROM fiaon_wa_vorlage ORDER BY geaendert_am DESC`) as any[];
  return z.map(ausZeile);
}

/**
 * Anlegen oder ändern. Geprüft wird IMMER — auch eine selbst gebaute Vorlage
 * geht durch die Hauswand. Der einzige Unterschied: Wer eine Zahlungserinnerung
 * bauen will, kann die Inkasso-Regel ausdrücklich abwählen, und das wird
 * festgehalten.
 */
export async function vorlageSpeichern(
  v: Partial<EigeneVorlage> & { name: string },
  von: string,
): Promise<{ ok: boolean; name?: string; grund?: string }> {
  await werkstattTabelle();
  const name = nameSauber(v.name);
  if (name.length < 4) return { ok: false, grund: "Der Name braucht mindestens vier Zeichen (klein, ohne Leerzeichen)." };
  const text = String(v.text ?? "").trim();
  if (text.length < 10) return { ok: false, grund: "Ohne Text geht es nicht." };

  // ── DIE WAND ──────────────────────────────────────────────────────────
  // `sendePruefung` prüft Inkasso, Wortverbote, Sie-Form und Länge. Die
  // Inkasso-Regel lässt sich abwählen (siehe unten); alles andere nicht.
  const probe = text.replace(/\{\{\d\}\}/g, "Maria Muster");
  const funde = sendePruefung(probe).filter((f) => !(v.inkassoErlaubt && /Mahnung oder Forderung/.test(f)));
  if (funde.length) return { ok: false, grund: funde.join(" · ") };

  if ((v.kopf ?? "").length > 60) return { ok: false, grund: "Die Kopfzeile darf höchstens 60 Zeichen haben." };
  if ((v.fuss ?? "").length > 60) return { ok: false, grund: "Die Fußzeile darf höchstens 60 Zeichen haben." };
  const knoepfe = (v.knoepfe ?? []) as WaKnopf[];
  if (knoepfe.some((k) => k.text.length > 25)) return { ok: false, grund: "Ein Knopftext darf höchstens 25 Zeichen haben." };
  if (knoepfe.filter((k) => k.typ === "URL").length > 2) return { ok: false, grund: "Meta erlaubt höchstens zwei Link-Knöpfe." };
  const varianten = (text.match(/\{\{\d\}\}/g) ?? []).length;
  const beispiele = (v.beispiele ?? []).map(String);
  if (beispiele.length !== varianten) return { ok: false, grund: `Es braucht genau ein Beispiel je Platzhalter (${varianten}).` };
  if (/^\s*\{\{/.test(text) || /\}\}\s*[.!?]?\s*$/.test(text)) {
    return { ok: false, grund: "Meta erlaubt keinen Platzhalter am Anfang oder Ende des Textes." };
  }

  await sqlPool`
    INSERT INTO fiaon_wa_vorlage (name, kategorie, zweck, wann, kopf, text, fuss, beispiele, knoepfe, inkasso_erlaubt, erstellt_von)
    VALUES (${name}, ${v.kategorie === "MARKETING" ? "MARKETING" : "UTILITY"}, ${String(v.zweck ?? "").slice(0, 300)},
            ${String(v.wann ?? "").slice(0, 300)}, ${v.kopf ?? null}, ${text}, ${v.fuss ?? null},
            ${sqlPool.json(beispiele)}, ${sqlPool.json(knoepfe as any)}, ${v.inkassoErlaubt === true}, ${von})
    ON CONFLICT (name) DO UPDATE SET
      kategorie = EXCLUDED.kategorie, zweck = EXCLUDED.zweck, wann = EXCLUDED.wann,
      kopf = EXCLUDED.kopf, text = EXCLUDED.text, fuss = EXCLUDED.fuss,
      beispiele = EXCLUDED.beispiele, knoepfe = EXCLUDED.knoepfe,
      inkasso_erlaubt = EXCLUDED.inkasso_erlaubt, geaendert_am = NOW()`;
  console.log(`[WA-WERKSTATT] Vorlage ${name} gespeichert (${von}).`);
  return { ok: true, name };
}

export async function vorlageLoeschen(name: string): Promise<void> {
  await werkstattTabelle();
  await sqlPool`DELETE FROM fiaon_wa_vorlage WHERE name = ${name}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS GESCHÄFTSPROFIL BEI META
//
// Was der Kunde im Chat oben sieht, bevor er ein Wort liest. Meta nimmt:
// `about` (Statuszeile), `description`, `address`, `email`, `websites` (bis 2),
// `vertical` (Branche). Das Bild geht einen eigenen Weg (Upload-Handle).
// ═══════════════════════════════════════════════════════════════════════════
export interface Profil {
  about: string; description: string; address: string; email: string;
  websites: string[]; vertical: string; profileBild: string | null;
}

export async function profilLesen(): Promise<Profil | null> {
  const k = waKonfig();
  if (!k.nummerId) return null;
  const a = await graph(`${k.nummerId}/whatsapp_business_profile`, {
    params: { fields: "about,address,description,email,profile_picture_url,websites,vertical" },
  });
  const p = a?.data?.[0] ?? {};
  return {
    about: String(p.about ?? ""), description: String(p.description ?? ""),
    address: String(p.address ?? ""), email: String(p.email ?? ""),
    websites: Array.isArray(p.websites) ? p.websites.map(String) : [],
    vertical: String(p.vertical ?? ""), profileBild: p.profile_picture_url ?? null,
  };
}

/** Justins Vorgabe für ein Profil, das seriös wirkt — als Vorschlag, nicht als Zwang. */
export const PROFIL_VORSCHLAG: Omit<Profil, "profileBild"> = {
  about: "Ihr Weg zur eigenen Kreditkarte",
  description:
    "FIAON begleitet Privatpersonen auf dem Weg zur eigenen Kreditkarte: Wir holen Ihre Bonitätsauskunft, "
    + "erklären jeden Eintrag und übernehmen die Schreiben an die Auskunfteien. Über Konto und Karte entscheidet die Bank.",
  address: "FIAON LTD · 124 City Road · London EC1V 2NX · United Kingdom",
  email: "support@fiaon.com",
  websites: ["https://fiaon.com", "https://fiaon.com/start"],
  vertical: "FINANCE",
};

export async function profilSetzen(p: Partial<Profil>): Promise<{ ok: boolean; grund?: string }> {
  const k = waKonfig();
  if (!k.nummerId) return { ok: false, grund: "WHATSAPP_PHONE_ID fehlt in der Umgebung." };
  const koerper: Record<string, unknown> = { messaging_product: "whatsapp" };
  if (p.about !== undefined) koerper.about = String(p.about).slice(0, 139);
  if (p.description !== undefined) koerper.description = String(p.description).slice(0, 512);
  if (p.address !== undefined) koerper.address = String(p.address).slice(0, 256);
  if (p.email !== undefined) koerper.email = String(p.email).slice(0, 128);
  if (p.websites !== undefined) koerper.websites = p.websites.filter(Boolean).slice(0, 2);
  if (p.vertical !== undefined) koerper.vertical = String(p.vertical);
  try {
    await graph(`${k.nummerId}/whatsapp_business_profile`, { methode: "POST", roherKoerper: koerper });
    console.log("[WA-WERKSTATT] Geschäftsprofil gesetzt.");
    return { ok: true };
  } catch (e) {
    return { ok: false, grund: e instanceof MetaFehler ? e.klartext : String(e) };
  }
}

/**
 * Das Profilbild. Meta will es in zwei Schritten: erst eine Sitzung beim
 * Upload-Dienst öffnen, dann die Bytes senden — heraus kommt ein Handle, das
 * ins Profil geschrieben wird.
 */
export async function profilBildSetzen(bild: Buffer, typ: string): Promise<{ ok: boolean; grund?: string }> {
  const k = waKonfig();
  const appId = process.env.META_APP_ID;
  if (!k.nummerId) return { ok: false, grund: "WHATSAPP_PHONE_ID fehlt in der Umgebung." };
  if (!appId) return { ok: false, grund: "META_APP_ID fehlt in der Umgebung — ohne sie nimmt Meta kein Bild an." };
  if (bild.length > 5 * 1024 * 1024) return { ok: false, grund: "Das Bild ist größer als 5 MB." };
  try {
    // Schritt 1: Upload-Sitzung eröffnen — ein gewöhnlicher Graph-Aufruf.
    const sitzung = await graph(`${appId}/uploads`, {
      methode: "POST", params: { file_length: String(bild.length), file_type: typ },
    });
    const id = String(sitzung?.id ?? "");
    if (!id) return { ok: false, grund: "Meta hat keine Upload-Sitzung eröffnet." };

    // Schritt 2: die Bytes. Das ist KEIN Graph-Aufruf im üblichen Sinn —
    // rohe Binärdaten, ein `file_offset`-Kopf und der Token als
    // Authorization: OAuth. `graph()` kann das nicht und soll es auch nicht;
    // eine Ausnahme in der gemeinsamen Funktion wäre eine Ausnahme für alle.
    const token = process.env.META_SYSTEM_TOKEN || process.env.META_TOKEN || "";
    if (!token) return { ok: false, grund: "META_SYSTEM_TOKEN fehlt in der Umgebung." };
    const basis = (process.env.META_GRAPH_URL || "https://graph.facebook.com").replace(/\/+$/, "");
    const antwort = await fetch(`${basis}/v25.0/${id}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${token}`, file_offset: "0", "Content-Type": typ },
      body: new Uint8Array(bild),
      signal: AbortSignal.timeout(60_000),
    });
    const roh = await antwort.text();
    let hoch: any = null;
    try { hoch = roh ? JSON.parse(roh) : null; } catch { hoch = null; }
    if (!antwort.ok) return { ok: false, grund: `Meta hat das Bild abgelehnt (HTTP ${antwort.status}): ${String(hoch?.error?.message ?? roh).slice(0, 200)}` };
    const handle = String(hoch?.h ?? "");
    if (!handle) return { ok: false, grund: "Meta hat kein Bild-Handle geliefert." };
    await graph(`${k.nummerId}/whatsapp_business_profile`, {
      methode: "POST", roherKoerper: { messaging_product: "whatsapp", profile_picture_handle: handle },
    });
    console.log("[WA-WERKSTATT] Profilbild gesetzt.");
    return { ok: true };
  } catch (e) {
    return { ok: false, grund: e instanceof MetaFehler ? e.klartext : String(e) };
  }
}

/** Für die Oberfläche: Was ist an einer Vorlage noch nicht in Ordnung? */
export function vorlagePruefen(v: Partial<EigeneVorlage>): string[] {
  const funde: string[] = [];
  const text = String(v.text ?? "");
  if (text.trim().length < 10) funde.push("Der Text fehlt noch.");
  const probe = text.replace(/\{\{\d\}\}/g, "Maria Muster");
  for (const f of sendePruefung(probe)) {
    if (v.inkassoErlaubt && /Mahnung oder Forderung/.test(f)) continue;
    funde.push(f);
  }
  if (!v.inkassoErlaubt && inkassoVerdacht(probe)) funde.push("Für eine Zahlungserinnerung bitte den Haken setzen.");
  return funde;
}
