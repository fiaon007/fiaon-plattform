// ═══════════════════════════════════════════════════════════════════════════
// /APP — MONATSBERICHT UND EREIGNISPROTOKOLL (Scheibe 6, Module A + E, 06.09.2026)
//
//   · Berichte     — GET /kunde/:ref/app/berichte, …/berichte/:monat,
//                    …/bericht-letzter. Die Rechnung steht in
//                    ../lib/fiaon-monatsbericht.ts; hier wird nur gelesen und
//                    „gelesen_am“ gesetzt. Ein Bericht wird nie hier erzeugt —
//                    das tut der Tageslauf am 1. bis 3. eines Monats.
//   · Ereignisse   — POST /kunde/:ref/app/ereignis: nur Bildschirm, Knopf und
//                    Zeit (Bauvorlage 8.3, die Messlücke). Keine Inhalte, keine
//                    Beträge, kein freier Text. Deckel 60 je Person und Stunde.
//
// Alle Endpunkte hinter `requireKunde`; Basis /kunde/:ref/app. Alles hängt am
// MENSCHEN (person_id) — ohne Person die ehrliche Antwort keinePerson().
// Tabellen: db/migrations/082_app_bericht_push_login.sql (Abschnitte A und E),
// dieselbe DDL in ensureBerichtTabelle (lib) und ensureEreignisTabelle (hier).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireKunde, kundeAusCookie, type KundeRequest } from "../lib/fiaon-kunde-session";
import { personFuerRef, keinePerson } from "./fiaon-app";
import {
  ensureBerichtTabelle, berichtLaden, berichteListe, letzterBericht, berichtGelesen,
  monatIsoVon, monatText, monatVerschieben, aktuellerMonatIso, type Monatsbericht,
} from "../lib/fiaon-monatsbericht";

const router = Router();

// ── Tabelle Ereignisse (Modul E) ────────────────────────────────────────────
let ereignisseBereit: Promise<void> | null = null;
export function ensureEreignisTabelle(): Promise<void> {
  if (!ereignisseBereit) {
    ereignisseBereit = (async () => {
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_app_ereignisse (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, bildschirm TEXT NOT NULL, ereignis TEXT NOT NULL,
        am TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_app_ereignisse_person_idx ON fiaon_app_ereignisse (person_id, am DESC)`;
    })().catch((e) => { ereignisseBereit = null; throw e; });
  }
  return ereignisseBereit;
}

/** Beide Tabellen dieses Routers — für routes.ts beim Start. */
export async function ensureBerichtTabellen(): Promise<void> {
  await ensureBerichtTabelle();
  await ensureEreignisTabelle();
}

// ── Antwortformen ───────────────────────────────────────────────────────────
function kurz(b: Monatsbericht) {
  return { monat: b.monat, monatText: b.monatText, grosseZahlCents: b.grosseZahlCents, grosseZahlText: b.grosseZahlText, gelesenAm: b.gelesenAm };
}

function voll(b: Monatsbericht) {
  return {
    monat: b.monat, monatText: b.monatText, grosseZahlCents: b.grosseZahlCents, grosseZahlText: b.grosseZahlText,
    beantragtCents: b.beantragtCents, gezahltCents: b.gezahltCents,
    posten: b.kennzahlen.posten, einmaligCents: b.kennzahlen.einmaligCents,
    unterwegs: b.kennzahlen.unterwegs, beantragtMonatlichCents: b.kennzahlen.beantragtMonatlichCents, beantragtEinmaligCents: b.kennzahlen.beantragtEinmaligCents,
    raten: b.kennzahlen.raten, weg: b.kennzahlen.weg, naechstes: b.kennzahlen.naechstes,
    erzeugtAm: b.erzeugtAm, versandtAm: b.versandtAm, gelesenAm: b.gelesenAm,
  };
}

const KEIN_BERICHT = "Für diesen Monat gibt es in Ihrer Akte keinen Bericht.";
const STOERUNG = "Ihr Bericht konnte gerade nicht geladen werden. Bitte versuchen Sie es gleich noch einmal.";

// ── Berichte ────────────────────────────────────────────────────────────────
/** GET /kunde/:ref/app/berichte — alle Berichte, neuester zuerst. */
router.get("/kunde/:ref/app/berichte", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureBerichtTabelle();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const liste = await berichteListe(p.personId);
    res.json({ ok: true, berichte: liste.map(kurz) });
  } catch (e: any) {
    console.error("[APP] berichte:", e?.message || e);
    res.status(500).json({ ok: false, error: STOERUNG });
  }
});

/**
 * GET /kunde/:ref/app/berichte/:monat (YYYY-MM) — ein Bericht mit Kennzahlen;
 * setzt gelesen_am beim ersten Öffnen. Aktueller Monat ohne Bericht: „kommt“.
 */
router.get("/kunde/:ref/app/berichte/:monat", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureBerichtTabelle();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const monat = monatIsoVon(req.params.monat);
    if (!monat) return res.status(404).json({ ok: false, error: KEIN_BERICHT });
    const b = await berichtLaden(p.personId, monat);
    if (!b) {
      const aktuell = aktuellerMonatIso();
      if (monat === aktuell) {
        const folge = monatVerschieben(monat, 1);
        return res.json({ ok: true, kommt: true, monat: monat.slice(0, 7), monatText: monatText(monat), text: `Der Bericht für ${monatText(monat)} wird am 1. ${monatText(folge)} erstellt.` });
      }
      return res.status(404).json({ ok: false, error: KEIN_BERICHT });
    }
    // gelesen_am nur bei einer ECHTEN Kundensitzung: requireKunde lässt auch die
    // Als-Kunde-Ansicht der Leitung (Cookie fiaon_kundenansicht) für GET durch —
    // deren Öffnen ist kein „der Kunde hat den Bericht gesehen“, und die „Zahl
    // des Monats“ auf Heute verschwände, bevor der Kunde sie sah.
    if (!b.gelesenAm && kundeAusCookie(req) === req.kundeRef) {
      await berichtGelesen(b.id, p.personId).catch((e: any) => console.error("[APP] bericht gelesen:", e?.message || e));
    }
    res.json({ ok: true, bericht: voll(b) });
  } catch (e: any) {
    console.error("[APP] bericht:", e?.message || e);
    res.status(500).json({ ok: false, error: STOERUNG });
  }
});

/** GET /kunde/:ref/app/bericht-letzter — der jüngste Bericht für „Zahl des Monats“ auf Heute, sonst null. */
router.get("/kunde/:ref/app/bericht-letzter", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureBerichtTabelle();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const b = await letzterBericht(p.personId);
    res.json({ ok: true, letzter: b ? { monat: b.monat, monatText: b.monatText, grosseZahlCents: b.grosseZahlCents, grosseZahlText: b.grosseZahlText, gelesen: !!b.gelesenAm } : null });
  } catch (e: any) {
    console.error("[APP] bericht-letzter:", e?.message || e);
    res.status(500).json({ ok: false, error: STOERUNG });
  }
});

// ── Ereignisprotokoll (Modul E) ─────────────────────────────────────────────
const BILDSCHIRME = new Set(["heute", "weg", "brief", "geld", "mehr", "vorgaenge", "ansprueche", "unterlagen", "zahlen", "bericht", "hilfe", "termine", "vollmacht", "mitteilungen", "daten", "abo", "konto"]);
const EREIGNISSE = new Set(["geoeffnet", "knopf", "fertig"]);
const DECKEL_JE_STUNDE = 60;

/**
 * POST /kunde/:ref/app/ereignis { bildschirm, ereignis } → 204.
 * Nur Werte aus der Liste; alles andere wird still verworfen (400 wäre für den
 * Kunden ohne Nutzen — er hat den Aufruf nie selbst gemacht). Über dem Deckel: 429.
 */
router.post("/kunde/:ref/app/ereignis", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const bildschirm = String(req.body?.bildschirm ?? "").trim().toLowerCase();
    const ereignis = String(req.body?.ereignis ?? "").trim().toLowerCase();
    if (!BILDSCHIRME.has(bildschirm) || !EREIGNISSE.has(ereignis)) return res.status(204).end();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return res.status(204).end();
    await ensureEreignisTabelle();
    const [z] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_app_ereignisse WHERE person_id = ${p.personId} AND am > NOW() - INTERVAL '1 hour'`) as any[];
    if (Number(z?.n || 0) >= DECKEL_JE_STUNDE) return res.status(429).json({ ok: false });
    await sqlPool`INSERT INTO fiaon_app_ereignisse (person_id, bildschirm, ereignis) VALUES (${p.personId}, ${bildschirm}, ${ereignis})`;
    res.status(204).end();
  } catch (e: any) {
    console.error("[APP] ereignis:", e?.message || e);
    // Ein Protokoll, das den Bildschirm stört, wäre das falsche Protokoll.
    res.status(204).end();
  }
});

/** Löschlauf (TFO-Vorgabe 06.09.): Ereignisse älter als 90 Tage verschwinden — nur Bildschirm/Zeit, kein Grund für längere Aufbewahrung. */
export async function ereignisseAufraeumen(): Promise<number> {
  await ensureEreignisTabelle();
  const rows = (await sqlPool`DELETE FROM fiaon_app_ereignisse WHERE am < NOW() - INTERVAL '90 days' RETURNING id`) as any[];
  return rows.length;
}

export default router;
