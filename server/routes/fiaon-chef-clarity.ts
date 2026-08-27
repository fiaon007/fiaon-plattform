// ═══════════════════════════════════════════════════════════════════════════
// MICROSOFT CLARITY IM CHEFBÜRO (27.08.2026)
//
// Justin: „Bitte ziehe die LIVE Daten, stelle sie uns ins Chef Dashboard —
//          mach es PERFEKT, detailliert so wie möglich."
//
// ── DIE HARTE GRENZE, DIE DEN GANZEN BAU BESTIMMT ─────────────────────────
// Die Datenexport-Schnittstelle von Clarity erlaubt **zehn Abrufe je Projekt
// und Tag**. Nicht zehn pro Minute — zehn pro TAG. Wer sie bei jedem
// Seitenaufruf anspricht, hat sie nach dem elften Blick aufs Dashboard für
// den Rest des Tages verbraucht, und Justin sieht eine leere Seite.
//
// Deshalb ist diese Datei zu drei Vierteln Buchhaltung:
//   · Jede Antwort wird in fiaon_clarity_abrufe gespeichert.
//   · Das Dashboard liest IMMER aus dem Speicher, nie direkt von Clarity.
//   · Nachgeladen wird höchstens alle acht Stunden, und nur, solange das
//     Tagesbudget es hergibt.
//   · Ein Abruf von Hand ist möglich, sagt aber vorher, wie viele Abrufe
//     heute noch übrig sind.
//
// Ein Abruf besteht aus DREI Anfragen (Gesamtbild, Seiten, Aufschlüsselung),
// also drei von zehn. Drei Nachladungen am Tag passen bequem hinein.
//
// ── WAS CLARITY LIEFERT UND WAS NICHT ─────────────────────────────────────
// Clarity kennt nur die letzten drei Tage über diese Schnittstelle
// (numOfDays 1–3). Es gibt keine Historie. Wer einen Verlauf will, muss ihn
// selbst aufbewahren — genau das tut die Tabelle nebenbei: Jeder Abruf
// bleibt stehen, und daraus wächst über Wochen die Zeitreihe, die Clarity
// selbst nicht herausgibt.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef } from "./fiaon-chef-zugang";

const router = Router();

const BASIS = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
/** Zehn Abrufe je Tag laut Clarity. Zwei bleiben als Reserve liegen. */
const TAGESBUDGET = 8;
/** Drei Anfragen je vollständigem Abruf. */
const ANFRAGEN_JE_ABRUF = 3;
/** Von selbst wird höchstens alle acht Stunden nachgeladen. */
const FRISCH_STUNDEN = 8;

let tabelleBereit = false;
async function ensureTabelle(): Promise<void> {
  if (tabelleBereit) return;
  await sqlPool.unsafe(`
    CREATE TABLE IF NOT EXISTS fiaon_clarity_abrufe (
      id            SERIAL PRIMARY KEY,
      geholt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tage          INT NOT NULL,
      anfragen      INT NOT NULL DEFAULT 3,
      von_hand      BOOLEAN NOT NULL DEFAULT FALSE,
      erfolg        BOOLEAN NOT NULL DEFAULT TRUE,
      fehler        TEXT,
      gesamt        JSONB,
      seiten        JSONB,
      aufschluessel JSONB
    )`);
  await sqlPool.unsafe(`CREATE INDEX IF NOT EXISTS fiaon_clarity_zeit_idx ON fiaon_clarity_abrufe (geholt_am DESC)`);
  tabelleBereit = true;
}

function token(): string {
  return String(process.env.CLARITY_API_TOKEN || "").trim();
}

/** Eine Anfrage an Clarity. Wirft mit einem Satz, den ein Mensch versteht. */
async function holen(parameter: string): Promise<any> {
  const t = token();
  if (!t) throw new Error("Für Clarity ist kein Zugangsschlüssel hinterlegt (CLARITY_API_TOKEN).");
  const r = await fetch(`${BASIS}?${parameter}`, {
    headers: { Authorization: `Bearer ${t}` },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await r.text();
  if (r.status === 429) {
    throw new Error("Clarity lässt heute keine Abrufe mehr zu — das Tageslimit von zehn ist erreicht. Morgen wieder.");
  }
  if (!r.ok) {
    throw new Error(`Clarity antwortete mit ${r.status}: ${text.slice(0, 160)}`);
  }
  let daten: any;
  try { daten = JSON.parse(text); } catch { throw new Error("Clarity schickte etwas, das kein JSON ist."); }
  // Bei überschrittenem Limit kommt gelegentlich ein Objekt statt einer Liste.
  if (!Array.isArray(daten)) {
    const hinweis = String(daten?.message || daten?.error || JSON.stringify(daten)).slice(0, 160);
    throw new Error(`Clarity: ${hinweis}`);
  }
  return daten;
}

/** Wie viele Anfragen wurden heute (Berliner Tag) schon verbraucht? */
async function heuteVerbraucht(): Promise<number> {
  const [r] = (await sqlPool`
    SELECT COALESCE(SUM(anfragen), 0)::int AS n
      FROM fiaon_clarity_abrufe
     WHERE (geholt_am AT TIME ZONE 'Europe/Berlin')::date
         = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  return Number(r?.n ?? 0);
}

/** Der jüngste erfolgreiche Abruf. */
async function letzterAbruf(): Promise<any | null> {
  const [r] = (await sqlPool`
    SELECT * FROM fiaon_clarity_abrufe
     WHERE erfolg ORDER BY geholt_am DESC LIMIT 1`) as any[];
  return r ?? null;
}

/**
 * Holt alles und legt es ab. Drei Anfragen:
 *   1. ohne Aufschlüsselung — die Gesamtzahlen und alle neun Metriken
 *   2. nach Adresse — welche Seiten wie oft gesehen wurden
 *   3. Gerät × Land × Herkunft — die Aufschlüsselung in einem Zug
 */
async function abrufen(tage: number, vonHand: boolean): Promise<any> {
  await ensureTabelle();
  const verbraucht = await heuteVerbraucht();
  if (verbraucht + ANFRAGEN_JE_ABRUF > TAGESBUDGET) {
    throw new Error(
      `Heute sind schon ${verbraucht} von ${TAGESBUDGET} Abrufen verbraucht — für einen vollständigen Abruf `
      + `braucht es ${ANFRAGEN_JE_ABRUF}. Die Anzeige zeigt weiter den letzten Stand.`);
  }
  const n = Math.min(3, Math.max(1, Math.floor(tage) || 3));
  const [gesamt, seiten, aufschluessel] = await Promise.all([
    holen(`numOfDays=${n}`),
    holen(`numOfDays=${n}&dimension1=URL`),
    holen(`numOfDays=${n}&dimension1=Device&dimension2=Country&dimension3=Source`),
  ]);
  const [zeile] = (await sqlPool`
    INSERT INTO fiaon_clarity_abrufe (tage, anfragen, von_hand, erfolg, gesamt, seiten, aufschluessel)
    VALUES (${n}, ${ANFRAGEN_JE_ABRUF}, ${vonHand}, TRUE,
            ${JSON.stringify(gesamt)}::jsonb, ${JSON.stringify(seiten)}::jsonb, ${JSON.stringify(aufschluessel)}::jsonb)
    RETURNING *`) as any[];
  console.log(`[CLARITY] Abruf über ${n} Tage abgelegt (${vonHand ? "von Hand" : "selbsttätig"}), heute ${verbraucht + ANFRAGEN_JE_ABRUF}/${TAGESBUDGET}`);
  return zeile;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUS DEN ROHDATEN WIRD EINE AUSSAGE
//
// Clarity liefert neun Metriken als Listen von Listen. Was ein Mensch sehen
// will, sind fünf Zahlen und drei Ranglisten. Das Umrechnen passiert HIER,
// nicht im Browser: Wer die Zahlen im Browser rechnet, hat sie in jeder
// Ansicht anders.
// ═══════════════════════════════════════════════════════════════════════════
const zahl = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function metrik(rohdaten: any[], name: string): any[] {
  const m = (rohdaten || []).find((x: any) => x?.metricName === name);
  return Array.isArray(m?.information) ? m.information : [];
}

/** Summe eines Feldes über alle Zeilen einer Metrik. */
function summe(zeilen: any[], feld: string): number {
  return zeilen.reduce((s, z) => s + zahl(z?.[feld]), 0);
}

function auswerten(abruf: any) {
  const gesamt = abruf?.gesamt ?? [];
  const seitenRoh = abruf?.seiten ?? [];
  const auf = abruf?.aufschluessel ?? [];

  // ── Die Kopfzahlen ──────────────────────────────────────────────────────
  const verkehr = metrik(gesamt, "Traffic")[0] ?? {};
  const sitzungen = zahl(verkehr.totalSessionCount);
  const bots = zahl(verkehr.totalBotSessionCount);
  const menschen = zahl(verkehr.distinctUserCount);
  const seitenJeSitzung = zahl(verkehr.pagesPerSessionPercentage);

  const zeit = metrik(gesamt, "EngagementTime")[0] ?? {};
  const tiefe = metrik(gesamt, "ScrollDepth")[0] ?? {};

  /** Eine Ärgernis-Metrik in der Form, die das Dashboard braucht. */
  const aerger = (name: string, titel: string, satz: string) => {
    const z = metrik(gesamt, name)[0] ?? {};
    return {
      key: name, titel, satz,
      anteil: zahl(z.sessionsWithMetricPercentage),
      seiten: zahl(z.pagesViews),
      vorfaelle: zahl(z.subTotal),
    };
  };

  // ── Die Ranglisten aus der dreifachen Aufschlüsselung ───────────────────
  // Dieselben Zeilen tragen Gerät, Land und Herkunft; für jede Rangliste wird
  // über die anderen beiden zusammengefasst.
  const verkehrZeilen = metrik(auf, "Traffic");
  const nach = (feld: string) => {
    const karte = new Map<string, { name: string; sitzungen: number; menschen: number; bots: number }>();
    for (const z of verkehrZeilen) {
      const name = String(z?.[feld] ?? "").trim() || "ohne Angabe";
      const e = karte.get(name) ?? { name, sitzungen: 0, menschen: 0, bots: 0 };
      e.sitzungen += zahl(z.totalSessionCount);
      e.menschen += zahl(z.distinctUserCount);
      e.bots += zahl(z.totalBotSessionCount);
      karte.set(name, e);
    }
    return Array.from(karte.values()).sort((a, b) => b.sitzungen - a.sitzungen);
  };

  // ── Die Seiten ──────────────────────────────────────────────────────────
  const seitenZeilen = metrik(seitenRoh, "Traffic")
    .map((z: any) => ({
      adresse: String(z?.Url ?? "").trim(),
      sitzungen: zahl(z.totalSessionCount),
      menschen: zahl(z.distinctUserCount),
      bots: zahl(z.totalBotSessionCount),
      seitenJeSitzung: zahl(z.pagesPerSessionPercentage),
    }))
    .filter((z) => z.adresse)
    .sort((a, b) => b.sitzungen - a.sitzungen);

  // Wie tief kommen Besucher auf einer Seite? Aus derselben Aufschlüsselung.
  const tiefeJeSeite = new Map<string, number>();
  for (const z of metrik(seitenRoh, "ScrollDepth")) {
    const a = String(z?.Url ?? "").trim();
    if (a) tiefeJeSeite.set(a, zahl(z.averageScrollDepth));
  }
  const zeitJeSeite = new Map<string, { gesamt: number; aktiv: number }>();
  for (const z of metrik(seitenRoh, "EngagementTime")) {
    const a = String(z?.Url ?? "").trim();
    if (a) zeitJeSeite.set(a, { gesamt: zahl(z.totalTime), aktiv: zahl(z.activeTime) });
  }
  // Wo die Leute wütend klicken — je Seite, das ist die wertvollste Liste.
  const wutJeSeite = new Map<string, { wut: number; tot: number; fehler: number; zurueck: number }>();
  const rein = (name: string, feld: "wut" | "tot" | "fehler" | "zurueck") => {
    for (const z of metrik(seitenRoh, name)) {
      const a = String(z?.Url ?? "").trim();
      if (!a) continue;
      const e = wutJeSeite.get(a) ?? { wut: 0, tot: 0, fehler: 0, zurueck: 0 };
      e[feld] += zahl(z.subTotal);
      wutJeSeite.set(a, e);
    }
  };
  rein("RageClickCount", "wut"); rein("DeadClickCount", "tot");
  rein("ScriptErrorCount", "fehler"); rein("QuickbackClick", "zurueck");
  // „Gesucht und nicht gefunden" — eigene Karte, weil es kein Ärgernis im
  // engeren Sinn ist, sondern ein Hinweis auf eine unklare Seite.
  const scrollSucheJeSeite = new Map<string, number>();
  for (const z of metrik(seitenRoh, "ExcessiveScroll")) {
    const a = String(z?.Url ?? "").trim();
    if (a) scrollSucheJeSeite.set(a, (scrollSucheJeSeite.get(a) ?? 0) + zahl(z.subTotal));
  }

  // ── DER PFAD IST DIE EINHEIT, NICHT DIE ADRESSE ────────────────────────
  // Clarity liefert vollständige Adressen. `/antrag`, `/antrag?utm_source=fb`
  // und `/antrag#schritt2` sind für Clarity drei Zeilen und für einen Menschen
  // eine Seite. Wer sie getrennt lässt, sieht dreimal zwölf Wut-Klicks statt
  // einmal sechsunddreißig — und hält das Problem für klein.
  //
  // Fremde Adressen (Electron, localhost, andere Wirte) fliegen raus: Sie
  // stehen im Clarity-Konto, gehören aber nicht zu dieser Seite.
  const eigenerPfad = (adresse: string): string | null => {
    try {
      const u = new URL(adresse);
      if (!/(^|\.)fiaon\.com$/i.test(u.hostname)) return null;
      const p = (u.pathname || "/").replace(/\/+$/, "") || "/";
      return p;
    } catch { return null; }
  };

  type Sammel = {
    pfad: string; sitzungen: number; menschen: number; bots: number;
    tiefeSumme: number; tiefeGewicht: number; zeitAktiv: number; zeitGesamt: number;
    wut: number; tot: number; fehler: number; zurueck: number; scrollSuche: number;
    adressen: number;
  };
  const nachPfad = new Map<string, Sammel>();
  const hole = (pfad: string): Sammel => {
    const e = nachPfad.get(pfad) ?? {
      pfad, sitzungen: 0, menschen: 0, bots: 0, tiefeSumme: 0, tiefeGewicht: 0,
      zeitAktiv: 0, zeitGesamt: 0, wut: 0, tot: 0, fehler: 0, zurueck: 0,
      scrollSuche: 0, adressen: 0,
    };
    nachPfad.set(pfad, e);
    return e;
  };

  for (const z of seitenZeilen) {
    const pfad = eigenerPfad(z.adresse);
    if (!pfad) continue;
    const e = hole(pfad);
    e.sitzungen += z.sitzungen;
    e.menschen += z.menschen;
    e.bots += z.bots;
    e.adressen += 1;
    // Scrolltiefe MIT DEN SITZUNGEN GEWICHTEN: Der Mittelwert zweier Mittelwerte
    // ist keiner. Eine Adresse mit 900 Sitzungen wiegt schwerer als eine mit 3.
    const t = tiefeJeSeite.get(z.adresse);
    if (t != null && z.sitzungen > 0) { e.tiefeSumme += t * z.sitzungen; e.tiefeGewicht += z.sitzungen; }
    const zt = zeitJeSeite.get(z.adresse);
    if (zt) { e.zeitAktiv += zt.aktiv; e.zeitGesamt += zt.gesamt; }
    const a = wutJeSeite.get(z.adresse);
    if (a) { e.wut += a.wut; e.tot += a.tot; e.fehler += a.fehler; e.zurueck += a.zurueck; }
    const sc = scrollSucheJeSeite.get(z.adresse);
    if (sc) e.scrollSuche += sc;
  }

  const seiten = Array.from(nachPfad.values())
    .map((e) => {
      const jeTausend = (n: number) => (e.sitzungen > 0 ? (n / e.sitzungen) * 1000 : 0);
      return {
        pfad: e.pfad,
        adresse: `https://fiaon.com${e.pfad}`,
        adressen: e.adressen,
        sitzungen: e.sitzungen,
        menschen: e.menschen,
        bots: e.bots,
        scrolltiefe: e.tiefeGewicht > 0 ? e.tiefeSumme / e.tiefeGewicht : null,
        zeit: e.zeitGesamt > 0 || e.zeitAktiv > 0 ? { aktiv: e.zeitAktiv, gesamt: e.zeitGesamt } : null,
        aerger: { wut: e.wut, tot: e.tot, fehler: e.fehler, zurueck: e.zurueck, scrollSuche: e.scrollSuche },
        // ── DIE GEWICHTUNG, DIE AUS ZAHLEN EINE REIHENFOLGE MACHT ────────
        // Nicht die absolute Zahl entscheidet, sondern die Dichte: 36
        // Wut-Klicks bei 3.000 Sitzungen sind ein anderer Befund als 36 bei
        // 50. Gewichte: ein Wut-Klick zählt dreifach (jemand klickt mehrfach
        // wütend auf dieselbe Stelle), ein Skriptfehler doppelt (dort ist
        // objektiv etwas kaputt), toter Klick und Sofort-zurück einfach.
        dichte: jeTausend(e.wut * 3 + e.fehler * 2 + e.tot + e.zurueck),
        gewicht: e.wut * 3 + e.fehler * 2 + e.tot + e.zurueck,
      };
    })
    .sort((a, b) => b.sitzungen - a.sitzungen);

  return {
    stand: abruf?.geholt_am ?? null,
    tage: zahl(abruf?.tage) || 3,
    kopf: {
      sitzungen, menschen, bots,
      botAnteil: sitzungen + bots > 0 ? (bots / (sitzungen + bots)) * 100 : 0,
      seitenJeSitzung,
      // Clarity gibt Zeiten in Millisekunden je Sitzung als Summe.
      zeitGesamtMs: zahl(zeit.totalTime),
      zeitAktivMs: zahl(zeit.activeTime),
      scrolltiefe: zahl(tiefe.averageScrollDepth),
    },
    aergernisse: [
      aerger("RageClickCount", "Wut-Klicks", "Mehrfach schnell auf dieselbe Stelle — dort erwartet jemand eine Reaktion, die ausbleibt."),
      aerger("DeadClickCount", "Tote Klicks", "Geklickt, nichts passiert. Meist sieht etwas aus wie ein Knopf und ist keiner."),
      aerger("ErrorClickCount", "Klicks mit Fehler", "Der Klick löste einen Skriptfehler aus."),
      aerger("ScriptErrorCount", "Skriptfehler", "Etwas im Browser ist gescheitert — der Besucher merkt es als „geht nicht“."),
      aerger("QuickbackClick", "Sofort zurück", "Seite geöffnet und binnen Sekunden zurück — die Erwartung wurde nicht erfüllt."),
      aerger("ExcessiveScroll", "Übermäßiges Scrollen", "Gesucht und nicht gefunden."),
    ].filter((a) => a.vorfaelle > 0 || a.anteil > 0),
    geraete: nach("Device"),
    laender: nach("Country"),
    herkunft: nach("Source"),
    seiten,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /chef/clarity — immer aus dem Speicher, nie direkt von Clarity
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/clarity", requireChef("leitung"), async (_req: Request, res: Response) => {
  try {
    await ensureTabelle();
    if (!token()) {
      return res.json({
        ok: true, eingerichtet: false,
        hinweis: "Für Clarity ist kein Zugangsschlüssel hinterlegt. Er gehört als CLARITY_API_TOKEN in die Umgebung.",
      });
    }

    let abruf = await letzterAbruf();
    const alterStunden = abruf
      ? (Date.now() - new Date(abruf.geholt_am).getTime()) / 3_600_000
      : Infinity;

    // Nachladen, wenn der Stand alt ist — aber nur im Rahmen des Budgets,
    // und ein Fehlschlag darf die Anzeige nicht leeren.
    let nachgeladen = false;
    let ladefehler: string | null = null;
    if (alterStunden > FRISCH_STUNDEN) {
      try { abruf = await abrufen(3, false); nachgeladen = true; }
      catch (e: any) { ladefehler = String(e?.message || e).slice(0, 220); }
    }

    if (!abruf) {
      return res.json({
        ok: true, eingerichtet: true, leer: true,
        hinweis: ladefehler || "Noch kein Abruf vorhanden.",
        budget: { verbrauchtHeute: await heuteVerbraucht(), tagesbudget: TAGESBUDGET, jeAbruf: ANFRAGEN_JE_ABRUF },
      });
    }

    const verbraucht = await heuteVerbraucht();
    res.json({
      ok: true, eingerichtet: true, leer: false,
      nachgeladen, ladefehler,
      alterStunden: Math.round(alterStunden * 10) / 10,
      budget: {
        verbrauchtHeute: verbraucht,
        tagesbudget: TAGESBUDGET,
        jeAbruf: ANFRAGEN_JE_ABRUF,
        nochMoeglich: Math.max(0, Math.floor((TAGESBUDGET - verbraucht) / ANFRAGEN_JE_ABRUF)),
      },
      ...auswerten(abruf),
    });
  } catch (err) {
    console.error("[CLARITY] lesen:", err);
    res.status(500).json({ ok: false, error: "Die Besucherzahlen ließen sich nicht laden." });
  }
});

/** POST /chef/clarity/neu — von Hand nachladen, mit Blick aufs Budget. */
router.post("/chef/clarity/neu", requireChef("leitung"), async (req: Request, res: Response) => {
  try {
    const tage = Math.min(3, Math.max(1, Number(req.body?.tage) || 3));
    const abruf = await abrufen(tage, true);
    const verbraucht = await heuteVerbraucht();
    res.json({
      ok: true,
      budget: {
        verbrauchtHeute: verbraucht, tagesbudget: TAGESBUDGET, jeAbruf: ANFRAGEN_JE_ABRUF,
        nochMoeglich: Math.max(0, Math.floor((TAGESBUDGET - verbraucht) / ANFRAGEN_JE_ABRUF)),
      },
      ...auswerten(abruf),
    });
  } catch (err: any) {
    // Kein 500: Das Budget ist kein Serverfehler, sondern eine Auskunft.
    console.warn("[CLARITY] Abruf von Hand:", String(err?.message).slice(0, 200));
    res.status(429).json({ ok: false, error: String(err?.message || "Der Abruf ist nicht gelungen.") });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUS EINER ZAHL WIRD EINE AUFGABE (27.08.2026)
//
// Justin: „36 Wut-Klicks ist eine Zahl, 36 Wut-Klicks auf /antrag ist eine
//          Aufgabe."
//
// Genau das tut dieser Endpunkt: Er nimmt einen Seitenbefund und legt ihn als
// Eintrag ins TODO-Brett — mit Pfad, Zahlen, Datum und einem Link, der direkt
// auf die betroffene Seite führt. Was dort landet, hat einen Zustand, einen
// Verantwortlichen und ein Fälligkeitsdatum. Eine Kachel im Dashboard hat das
// alles nicht.
//
// DOPPELTE AUFGABEN VERMEIDEN: Solange zu derselben Seite noch eine offene
// Aufgabe steht, wird keine zweite angelegt — sonst füllt sich das Brett bei
// jedem Blick aufs Dashboard mit demselben Satz.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/chef/clarity/aufgabe", requireChef("leitung"), async (req: Request, res: Response) => {
  try {
    const pfad = String(req.body?.pfad || "").trim();
    if (!pfad.startsWith("/")) return res.status(400).json({ ok: false, error: "Kein gültiger Seitenpfad." });
    const a = req.body?.aerger ?? {};
    const sitzungen = Number(req.body?.sitzungen) || 0;

    const teile = [
      Number(a.wut) > 0 ? `${a.wut} Wut-Klicks` : null,
      Number(a.tot) > 0 ? `${a.tot} tote Klicks` : null,
      Number(a.fehler) > 0 ? `${a.fehler} Skriptfehler` : null,
      Number(a.zurueck) > 0 ? `${a.zurueck} Mal sofort zurück` : null,
      Number(a.scrollSuche) > 0 ? `${a.scrollSuche} Mal gesucht und nicht gefunden` : null,
    ].filter(Boolean);
    if (!teile.length) return res.status(400).json({ ok: false, error: "Zu dieser Seite gibt es nichts zu tun." });

    const titel = `${pfad}: ${teile[0]}`;

    // Steht schon eine offene Aufgabe zu dieser Seite?
    const [schon] = (await sqlPool`
      SELECT id, titel FROM fiaon_betreiber_todos
       WHERE status <> 'erledigt' AND titel LIKE ${pfad + ":%"}
       ORDER BY id DESC LIMIT 1`) as any[];
    if (schon) {
      return res.json({ ok: true, schonDa: true, id: Number(schon.id), titel: schon.titel });
    }

    const text = [
      `Microsoft Clarity hat auf ${pfad} in den letzten drei Tagen gemessen: ${teile.join(", ")}.`,
      sitzungen > 0 ? `Grundlage sind ${sitzungen.toLocaleString("de-DE")} Sitzungen auf dieser Seite.` : null,
      "",
      "Was diese Zahlen bedeuten:",
      Number(a.wut) > 0 ? "· Wut-Klicks: Jemand klickt mehrfach schnell auf dieselbe Stelle. Dort wird eine Reaktion erwartet, die ausbleibt." : null,
      Number(a.tot) > 0 ? "· Tote Klicks: Geklickt, nichts passiert. Meist sieht etwas aus wie ein Knopf und ist keiner." : null,
      Number(a.fehler) > 0 ? "· Skriptfehler: Etwas im Browser ist gescheitert. Der Besucher erlebt das als „geht nicht“." : null,
      Number(a.zurueck) > 0 ? "· Sofort zurück: Seite geöffnet und binnen Sekunden zurück — die Erwartung wurde nicht erfüllt." : null,
      Number(a.scrollSuche) > 0 ? "· Übermäßiges Scrollen: Gesucht und nicht gefunden." : null,
      "",
      `Nächster Schritt: In Clarity die Aufzeichnungen zu ${pfad} ansehen — dort sieht man die Stelle, an der geklickt wurde.`,
    ].filter((z) => z !== null).join("\n");

    const [r] = (await sqlPool`
      INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, link, quelle, letzte_aktivitaet)
      VALUES (${titel}, ${text}, 'technik',
              ${Number(a.wut) > 0 || Number(a.fehler) > 0 ? 1 : 2},
              ${pfad}, 'clarity', NOW())
      RETURNING id`) as any[];
    console.log(`[CLARITY] Aufgabe angelegt: ${titel} (#${r.id})`);
    res.json({ ok: true, schonDa: false, id: Number(r.id), titel });
  } catch (err) {
    console.error("[CLARITY] aufgabe:", err);
    res.status(500).json({ ok: false, error: "Die Aufgabe ließ sich nicht anlegen." });
  }
});

/** GET /chef/clarity/verlauf — was wir selbst aufbewahrt haben. */
router.get("/chef/clarity/verlauf", requireChef("leitung"), async (_req: Request, res: Response) => {
  try {
    await ensureTabelle();
    const zeilen = (await sqlPool`
      SELECT geholt_am, tage, von_hand,
             (gesamt -> 0) IS NOT NULL AS hat_daten
        FROM fiaon_clarity_abrufe
       WHERE erfolg ORDER BY geholt_am DESC LIMIT 60`) as any[];
    res.json({ ok: true, zeilen });
  } catch (err) {
    console.error("[CLARITY] verlauf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESLAUF (27.08.2026)
//
// GELERNT AM ERSTEN TAG: Der Abruf hing daran, dass jemand die Seite öffnet.
// Ich selbst habe beim Erkunden der Schnittstelle das Tagesbudget aufgebraucht,
// und danach blieb der Raum leer — weil niemand mehr abrufen KONNTE.
//
// Ein fester Lauf löst beides: Er holt die Daten, sobald das Fenster offen ist,
// er verbraucht genau drei der zehn Anfragen, und weil jeder Abruf stehen
// bleibt, entsteht nebenbei der Verlauf, den Clarity selbst nicht herausgibt.
//
// `alleXStunden: 20` heißt: einmal am Tag, und der Lauf holt sich selbst ein,
// wenn der Server zur üblichen Zeit geschlafen hat.
//
// Clarity setzt sein Tageslimit um Mitternacht UTC zurück. Der Lauf prüft
// deshalb jede Stunde und greift zu, sobald das Budget wieder etwas hergibt —
// er wartet nicht auf eine Uhrzeit, die er verpassen könnte.
// ═══════════════════════════════════════════════════════════════════════════
export async function clarityTageslauf(): Promise<void> {
  if (!token()) return;                       // nicht eingerichtet: still bleiben
  await ensureTabelle();
  const letzter = await letzterAbruf();
  const alterStunden = letzter
    ? (Date.now() - new Date(letzter.geholt_am).getTime()) / 3_600_000
    : Infinity;
  // Höchstens einmal in 20 Stunden — mehr braucht es nicht, und mehr wäre
  // Verschwendung an einem Budget von zehn.
  if (alterStunden < 20) return;
  try {
    await abrufen(3, false);
  } catch (e: any) {
    // Ein erschöpftes Budget ist kein Fehler, sondern eine Auskunft. Der Lauf
    // versucht es in einer Stunde wieder — irgendwann ist das Fenster offen.
    console.log("[CLARITY] Tageslauf: " + String(e?.message).slice(0, 140));
  }
}

export default router;
