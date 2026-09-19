// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE IM B2B-AUFTRAG — „FIAON Global" (17.09.2026, E-188)
//
// Justin: „Wenn man seine Firma eingibt, soll sich ein Register öffnen, der
// Kunde klickt auf seine Firma und alle Daten füllen sich aus."
//
// FÜNF ROUTEN, ÖFFENTLICH OHNE LOGIN (der Auftrag /business/start hat keins):
//   GET  /firmensuche?land=DE|AT|CH&q=…           die Trefferliste beim Tippen
//   GET  /firmensuche/detail?land=&quelle=&id=    der ausgefüllte Firmenbogen
//   POST /firmensuche/impressum { url, land? }    Website → Impressum auslesen
//   GET  /firmensuche/ustid?nr=…                  USt-IdNr. prüfen (VIES/UID)
//   GET  /firmensuche/lage                        welches Land hat eine Namenssuche?
//
// WAS HEUTE GEHT — und was einen Schlüssel braucht (server/lib/firmensuche):
//   · Schweiz: voll, ohne Schlüssel (UID-Register des BFS, Rückfall LINDAS).
//   · Deutschland/Österreich: Trefferliste erst mit OPENREGISTER_API_KEY,
//     HANDELSREGISTER_AI_KEY bzw. JUSTIZ_FBW_API_KEY. Bis dahin ist die Liste
//     leer und der Hinweis „website" führt auf den Impressum-Weg.
//
// DIE SUCHE ANTWORTET IMMER MIT ok:true. Ein ausgefallener Anbieter, ein
// leerer Eimer, eine tote Datenbank — nichts davon darf den Auftrag aufhalten.
// Im schlimmsten Fall ist die Liste leer und der Kunde tippt selbst.
//
// BEWUSSTE GRENZEN:
//  · KEIN SCHATTENREGISTER. Die Cache-Tabelle hält Antworten höchstens 24 h
//    (die Grenze aus den AGB von handelsregister.ai, einheitlich für alle
//    Quellen) und räumt beim Schreiben auf. Dauerhaft gespeichert wird nur,
//    was der Kunde im Auftrag bestätigt — das macht der Bestellweg, nicht
//    diese Datei. Das Aufräumen ist ein echtes DELETE: Ein Cache ist kein
//    Kundenvorgang, und hier ist das Löschen die Pflicht, nicht der Schaden.
//  · Im Log stehen Land, Anbieter, Dauer und Ausgang — NIE der Suchbegriff
//    (bei Einzelunternehmen ist er ein Personenname), nie eine Adresse, nie
//    ein Schlüssel.
//  · Bremse je IP-Adresse; je Anbieter ein Token-Eimer (in index.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { alsLand, sucheSaeubern, SUCHE_MIN, AnbieterFehler, type Land } from "../lib/firmensuche/typen";
import { firmenSuchen, firmaDetail, anbieterLage, REIHENFOLGE, type SuchErgebnis } from "../lib/firmensuche/index";
import { impressumLesen } from "../lib/firmensuche/impressum";
import { istFiaonSelbst } from "@shared/fiaon-global";
import { ustIdPruefen } from "../lib/firmensuche/vies";
import { ustIdErkennen } from "../lib/firmensuche/formate";

const router = Router();

// ── Die Cache-Tabelle ───────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
function ensureFirmensucheCache(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_firmensuche_cache (
          schluessel TEXT PRIMARY KEY,
          antwort JSONB NOT NULL,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmensuche_cache_alter_idx ON fiaon_firmensuche_cache (erstellt_am)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// Haltbarkeit: 24 Stunden — die Grenze aus den AGB von handelsregister.ai, für alle Quellen gleich.
interface CacheFund<T> { antwort: T; alterMin: number }

/**
 * Der Cache darf die Suche nie aufhalten: Antwortet die Datenbank nicht binnen 600 ms (Last, Ausfall,
 * Verbindungsaufbau), gilt das als „nichts gemerkt" und der Anbieter wird gefragt.
 */
function cacheLesen<T>(schluessel: string): Promise<CacheFund<T> | null> {
  return new Promise((ja) => {
    const wecker = setTimeout(() => ja(null), 600);
    cacheLesenOhneFrist<T>(schluessel).then((fund) => { clearTimeout(wecker); ja(fund); });
  });
}

async function cacheLesenOhneFrist<T>(schluessel: string): Promise<CacheFund<T> | null> {
  try {
    await ensureFirmensucheCache();
    const [z] = (await sqlPool`
      SELECT antwort, EXTRACT(EPOCH FROM (NOW() - erstellt_am)) / 60 AS alter_min
      FROM fiaon_firmensuche_cache
      WHERE schluessel = ${schluessel} AND erstellt_am > NOW() - INTERVAL '24 hours'
    `) as any[];
    return z ? { antwort: z.antwort as T, alterMin: Number(z.alter_min) } : null;
  } catch (e: any) {
    console.warn("[FIRMENSUCHE] Cache lesen:", String(e?.message || e).slice(0, 120));
    return null;
  }
}

async function cacheSchreiben(schluessel: string, antwort: unknown): Promise<void> {
  try {
    await ensureFirmensucheCache();
    await sqlPool`
      INSERT INTO fiaon_firmensuche_cache (schluessel, antwort, erstellt_am)
      VALUES (${schluessel}, ${sqlPool.json(antwort as any)}, NOW())
      ON CONFLICT (schluessel) DO UPDATE SET antwort = EXCLUDED.antwort, erstellt_am = NOW()
    `;
    // Aufräumen beim Schreiben, begrenzt — nie ein langer Lauf in einer Besucheranfrage.
    await sqlPool`
      DELETE FROM fiaon_firmensuche_cache
      WHERE schluessel IN (
        SELECT schluessel FROM fiaon_firmensuche_cache
        WHERE erstellt_am < NOW() - INTERVAL '24 hours'
        ORDER BY erstellt_am LIMIT 200
      )
    `;
  } catch (e: any) {
    console.warn("[FIRMENSUCHE] Cache schreiben:", String(e?.message || e).slice(0, 120));
  }
}

// ── Bremse je IP-Adresse (Muster: fiaon-gruender-termin.ts) ─────────────────
const toepfe: Record<string, Map<string, number[]>> = { suche: new Map(), detail: new Map(), impressum: new Map(), ustid: new Map() };
const GRENZEN: Record<string, { max: number; fensterMs: number }> = {
  suche: { max: 40, fensterMs: 5 * 60_000 },
  detail: { max: 30, fensterMs: 5 * 60_000 },
  impressum: { max: 8, fensterMs: 10 * 60_000 },
  ustid: { max: 12, fensterMs: 10 * 60_000 },
};

function zuViel(topf: keyof typeof GRENZEN, ip: string): boolean {
  const { max, fensterMs } = GRENZEN[topf];
  const karte = toepfe[topf];
  const jetzt = Date.now();
  const liste = (karte.get(ip) ?? []).filter((t) => jetzt - t < fensterMs);
  if (liste.length >= max) { karte.set(ip, liste); return true; }
  liste.push(jetzt);
  karte.set(ip, liste);
  // Die Karte wächst nicht ewig: Ab 5.000 Adressen fliegen die abgelaufenen raus.
  if (karte.size > 5000) for (const [k, v] of Array.from(karte.entries())) if (!v.some((t) => jetzt - t < fensterMs)) karte.delete(k);
  return false;
}

const ipVon = (req: Request): string =>
  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "";

/** Ins Log geht nur der Ablauf — kein Suchbegriff, keine Firma, keine Adresse. */
function ablaufMelden(was: string, land: string, versuche: { anbieter: string; ms: number; ergebnis: string }[]): void {
  if (!versuche.some((v) => v.ergebnis !== "treffer" && v.ergebnis !== "leer")) return;
  console.warn(`[FIRMENSUCHE] ${was} ${land}: ${versuche.map((v) => `${v.anbieter}=${v.ergebnis}/${v.ms}ms`).join(" → ")}`);
}

// ── GET /firmensuche — die Trefferliste ─────────────────────────────────────
router.get("/firmensuche", async (req: Request, res: Response) => {
  const land = alsLand(req.query.land);
  if (!land) return res.status(400).json({ ok: false, error: "Bitte ein Land angeben: DE, AT oder CH." });
  const q = sucheSaeubern(req.query.q);
  const leer = (grund: string, hinweis?: "website") =>
    res.json({ ok: true, land, quelle: "keine", quelleText: "", treffer: [], ...(hinweis ? { hinweis } : {}), grund });
  try {
    if (q.length < SUCHE_MIN) return leer("zu_kurz");
    // Ohne aktiven Anbieter gibt es nichts zu bremsen und nichts zu cachen.
    if (!REIHENFOLGE[land].some((a) => a.aktiv())) return leer("kein_anbieter", "website");
    if (zuViel("suche", ipVon(req))) return leer("zu_schnell", "website");

    const schluessel = `suche:${land}:${q.toLowerCase()}`;
    const fund = await cacheLesen<Pick<SuchErgebnis, "quelle" | "quelleText" | "treffer">>(schluessel);
    const gemerkt = fund?.antwort;
    // Eine leere Liste gilt nur eine Stunde — eine Neugründung von heute soll morgen nicht noch fehlen.
    if (fund && gemerkt && Array.isArray(gemerkt.treffer) && (gemerkt.treffer.length || fund.alterMin <= 60)) {
      return res.json({ ok: true, land, quelle: gemerkt.quelle, quelleText: gemerkt.quelleText, treffer: gemerkt.treffer,
        ...(gemerkt.treffer.length ? {} : { hinweis: "website", grund: "keine_treffer" }), ausCache: true });
    }

    const erg = await firmenSuchen(land, q, {
      spaeteTreffer: (a, treffer) => { void cacheSchreiben(schluessel, { quelle: a.kennung, quelleText: a.quelleText, treffer }); },
    });
    ablaufMelden("Suche", land, erg.versuche);
    // Gecacht wird nur, was ein gesunder Anbieter gesagt hat — ein Ausfall ist keine Antwort.
    if (erg.quelle !== "keine") void cacheSchreiben(schluessel, { quelle: erg.quelle, quelleText: erg.quelleText, treffer: erg.treffer });
    res.json({ ok: true, land, quelle: erg.quelle, quelleText: erg.quelleText, treffer: erg.treffer,
      ...(erg.hinweis ? { hinweis: erg.hinweis } : {}), ...(erg.grund ? { grund: erg.grund } : {}) });
  } catch (err: any) {
    console.error("[FIRMENSUCHE] suche:", String(err?.message || err).slice(0, 160));
    if (!res.headersSent) leer("anbieter_ausgefallen", "website");
  }
});

// ── GET /firmensuche/lage — wo gibt es eine Namenssuche? ────────────────────
router.get("/firmensuche/lage", (_req: Request, res: Response) => {
  const lage = anbieterLage();
  const laender = {} as Record<Land, { namenssuche: boolean }>;
  for (const land of Object.keys(lage) as Land[]) laender[land] = { namenssuche: lage[land].some((a) => a.aktiv) };
  res.json({ ok: true, laender });
});

// ── GET /firmensuche/detail — der Firmenbogen ───────────────────────────────
router.get("/firmensuche/detail", async (req: Request, res: Response) => {
  const land = alsLand(req.query.land);
  const quelle = String(req.query.quelle ?? "").trim().toLowerCase().slice(0, 40);
  const id = String(req.query.id ?? "").trim().slice(0, 128);
  if (!land || !id || !/^[a-z-]{3,40}$/.test(quelle) || !/^[\w .~-]{2,128}$/.test(id)) {
    return res.status(400).json({ ok: false, error: "Bitte Land, Quelle und Kennung der Firma angeben." });
  }
  if (!REIHENFOLGE[land].some((a) => a.kennung === quelle)) return res.status(400).json({ ok: false, error: "Diese Quelle gibt es für das Land nicht." });
  if (zuViel("detail", ipVon(req))) return res.status(429).json({ ok: false, error: "Bitte versuchen Sie es in ein paar Minuten noch einmal — oder tragen Sie die Angaben selbst ein.", grund: "zu_schnell" });
  try {
    const schluessel = `detail:${land}:${quelle}:${id.toLowerCase()}`;
    const fund = await cacheLesen<any>(schluessel);
    if (fund?.antwort?.name) return res.json({ ok: true, firma: fund.antwort, ausCache: true });

    const erg = await firmaDetail(land, quelle, id);
    ablaufMelden("Detail", land, erg.versuche);
    if (!erg.firma) {
      const gefragt = erg.versuche.some((v) => v.ergebnis === "leer");
      return res.status(gefragt ? 404 : 503).json({
        ok: false, grund: gefragt ? "nicht_gefunden" : "anbieter_ausgefallen",
        error: gefragt ? "Zu dieser Firma liegen keine Angaben vor. Bitte tragen Sie sie selbst ein."
          : "Das Register antwortet gerade nicht. Bitte tragen Sie die Angaben selbst ein.",
      });
    }
    void cacheSchreiben(schluessel, erg.firma);
    res.json({ ok: true, firma: erg.firma });
  } catch (err: any) {
    console.error("[FIRMENSUCHE] detail:", String(err?.message || err).slice(0, 160));
    res.status(503).json({ ok: false, grund: "anbieter_ausgefallen", error: "Das Register antwortet gerade nicht. Bitte tragen Sie die Angaben selbst ein." });
  }
});

// ── POST /firmensuche/impressum — Website → Impressum ───────────────────────
// Höchstens vier Läufe gleichzeitig: Jeder hält bis zu drei fremde Seiten und
// eine KI-Anfrage offen. Mehr wäre eine Einladung, den Server zu beschäftigen.
let impressumLaeufe = 0;

router.post("/firmensuche/impressum", async (req: Request, res: Response) => {
  const url = String(req.body?.url ?? "").trim().slice(0, 300);
  const land = alsLand(req.body?.land);
  if (url.length < 4) return res.status(400).json({ ok: false, error: "Bitte die Adresse Ihrer Website angeben.", grund: "eingabe" });
  // 19.09.2026: Das Impressum von FIAON ergäbe FIAON als Kunden — und damit einen Vertrag mit sich selbst.
  if (istFiaonSelbst(url.replace(/^https?:\/\//i, "").split("/")[0])) return res.status(400).json({ ok: false, error: "Das ist die Website von FIAON — bitte nennen Sie die Website Ihres eigenen Unternehmens.", grund: "eingabe" });
  if (zuViel("impressum", ipVon(req))) return res.status(429).json({ ok: false, error: "Das waren viele Versuche. Bitte tragen Sie die Angaben selbst ein oder versuchen Sie es in zehn Minuten noch einmal.", grund: "zu_schnell" });
  if (impressumLaeufe >= 4) return res.status(429).json({ ok: false, error: "Gerade ist viel los. Bitte versuchen Sie es gleich noch einmal.", grund: "ausgelastet" });
  impressumLaeufe += 1;
  try {
    const schluessel = `impressum:${land ?? "-"}:${url.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
    const fund = await cacheLesen<any>(schluessel);
    if (fund?.antwort?.ok) return res.json({ ...fund.antwort, ausCache: true });

    const start = Date.now();
    const erg = await impressumLesen(url, land);
    if (!erg.ok) {
      console.warn(`[FIRMENSUCHE] Impressum: ${erg.grund} nach ${Date.now() - start} ms`);
      const status = erg.grund === "eingabe" || erg.grund === "schema" || erg.grund === "hostname" || erg.grund === "port" || erg.grund === "zugangsdaten" || erg.grund === "private_adresse" ? 400 : 422;
      return res.status(status).json({ ok: false, error: erg.error, grund: erg.grund });
    }
    const antwort = { ok: true, firma: erg.firma, belege: erg.belege, seite: erg.seite, seiten: erg.seiten, warnungen: erg.warnungen };
    void cacheSchreiben(schluessel, antwort);
    res.json(antwort);
  } catch (err: any) {
    console.error("[FIRMENSUCHE] impressum:", String(err?.message || err).slice(0, 160));
    res.status(500).json({ ok: false, error: "Die Website ließ sich nicht auslesen. Bitte tragen Sie die Angaben selbst ein.", grund: "serverfehler" });
  } finally {
    impressumLaeufe -= 1;
  }
});

// ── GET /firmensuche/ustid — USt-IdNr. prüfen ───────────────────────────────
router.get("/firmensuche/ustid", async (req: Request, res: Response) => {
  const erkannt = ustIdErkennen(req.query.nr);
  if (!erkannt) return res.status(400).json({ ok: false, error: "Bitte eine USt-IdNr. im Format DE123456789, ATU12345678 oder CHE-123.456.789 angeben." });
  if (zuViel("ustid", ipVon(req))) return res.status(429).json({ ok: false, error: "Bitte versuchen Sie es in ein paar Minuten noch einmal.", grund: "zu_schnell" });
  try {
    const schluessel = `ustid:${erkannt.nummer}`;
    const fund = await cacheLesen<any>(schluessel);
    if (fund && typeof fund.antwort?.gueltig === "boolean") return res.json({ ok: true, ...fund.antwort, ausCache: true });
    const erg = await ustIdPruefen(erkannt.nummer);
    // „Weiß nicht" (null) wird nicht gemerkt — beim nächsten Mal antwortet der Dienst vielleicht.
    if (erg.gueltig !== null) void cacheSchreiben(schluessel, erg);
    res.json({ ok: true, ...erg });
  } catch (err: any) {
    if (err instanceof AnbieterFehler && err.art === "eingabe") return res.status(400).json({ ok: false, error: err.message });
    console.error("[FIRMENSUCHE] ustid:", String(err?.message || err).slice(0, 160));
    res.json({ ok: true, gueltig: null, quelle: erkannt.land === "CH" ? "UID-Register" : "VIES" });
  }
});

export default router;
