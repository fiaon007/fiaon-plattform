// ═══════════════════════════════════════════════════════════════════════════
// /APP — SERVERSEITE DES NEUEN KUNDENBEREICHS (Scheibe 2, 05.09.2026)
//
// Der Bereich /app liest seinen Stand weiter aus GET /kunde/:ref/bereich
// (fiaon-kunde-bereich.ts). HIER steht nur, was es dort nicht gibt und was der
// Detailplan „Weg zum Rahmen" neu verlangt:
//
//   · Anspruchs-Check   — zehn Fragen, Befunde mit Betrag, Quelle, Stand
//                         (Regeln: shared/fiaon-ansprueche.ts, EINE Quelle)
//   · Brief-Knopf       — der Kunde fotografiert einen Brief, ein Mensch liest
//                         ihn binnen zwei Werktagen (Auftrag an den Betreuer,
//                         E-115), der Kunde sieht den Stand unter „Post"
//   · Post              — was hereinkam (Briefe) und was hinausging (Anträge),
//                         jeder Vorgang mit Stand und Frist
//
// Alle Endpunkte hinter `requireKunde`; die Referenz in der URL muss zum Cookie
// passen (prüft requireKunde). Alles hängt am MENSCHEN (person_id), nicht am
// Antrag — 427 Anträge ohne person_id bekommen eine ehrliche Antwort
// (`grund: "keine_person"`), keinen Fehler 500.
//
// Tabellen: db/migrations/080_app_kundenbereich.sql — dieselbe DDL unten in
// ensureAppTabellen (idempotent, läuft beim ersten Aufruf nach dem Deploy).
// Berliner Datum ausschließlich über formatToParts (Zeit-Falle, 01.09.2026).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { bildAlsPdf, istBild, istHeic } from "../lib/fiaon-bild-zu-pdf";
import { FRAGEN, REGELN, befunde, beantwortet, summeMonatlichCents, type Antworten, type Befund } from "@shared/fiaon-ansprueche";

const router = Router();

// ── Tabellen ────────────────────────────────────────────────────────────────
let tabellenBereit: Promise<void> | null = null;
export function ensureAppTabellen(): Promise<void> {
  if (!tabellenBereit) {
    tabellenBereit = (async () => {
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_anspruch_antworten (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, frage_schluessel TEXT NOT NULL, wert JSONB, termin_id BIGINT,
        erhoben_am TIMESTAMPTZ NOT NULL DEFAULT NOW(), erhoben_von_agent_id BIGINT,
        quelle TEXT NOT NULL DEFAULT 'kunde' CHECK (quelle IN ('kunde','startgespraech','antrag')),
        UNIQUE (person_id, frage_schluessel))`;
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_ansprueche (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, regel_schluessel TEXT NOT NULL,
        stand TEXT NOT NULL DEFAULT 'offen' CHECK (stand IN ('offen','verworfen','beantragt','bewilligt','abgelehnt','nicht_zutreffend')),
        betrag_cents INTEGER, monatlich BOOLEAN NOT NULL DEFAULT TRUE, begruendung TEXT, frist_am DATE, vorgang_id BIGINT,
        erkannt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(), aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (person_id, regel_schluessel))`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_ansprueche_person_idx ON fiaon_ansprueche (person_id, stand)`;
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_vorgaenge (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL,
        art TEXT NOT NULL CHECK (art IN ('brief','p_konto','p_konto_umwandlung','rundfunk','selbstauskunft','wohngeld','kfz','handy')),
        titel TEXT NOT NULL, anspruch_id BIGINT,
        stand TEXT NOT NULL DEFAULT 'eingegangen' CHECK (stand IN ('eingegangen','gelesen','entwurf','unterschrift_offen','versandbereit','versandt','nachfrage','bewilligt','abgelehnt','zurueckgezogen','erledigt')),
        stand_text TEXT, empfaenger_name TEXT, empfaenger_adresse TEXT, versandt_am TIMESTAMPTZ, frist_am DATE, behoerden_az TEXT, aktenzeichen TEXT,
        erinnert_am TIMESTAMPTZ, eskaliert_am TIMESTAMPTZ, zustaendig_agent_id BIGINT, notiz_kunde TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vorgaenge_person_idx ON fiaon_vorgaenge (person_id, created_at DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vorgaenge_frist_idx ON fiaon_vorgaenge (stand, frist_am) WHERE stand IN ('versandt','nachfrage')`;
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_dokumente (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, ref TEXT, vorgang_id BIGINT, art TEXT NOT NULL, dateiname TEXT NOT NULL,
        mime TEXT NOT NULL, bytes INTEGER NOT NULL, inhalt BYTEA NOT NULL,
        quelle TEXT NOT NULL CHECK (quelle IN ('kunde','mitarbeiter','erzeugt','eingegangen')),
        aktenzeichen TEXT, doc_hash TEXT NOT NULL, hochgeladen_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        geprueft_am TIMESTAMPTZ, geprueft_von_agent_id BIGINT, urteil JSONB, gesendet_am TIMESTAMPTZ, gesendet_an TEXT,
        sende_anzahl INTEGER NOT NULL DEFAULT 0, ersetzt_dokument_id BIGINT, geloescht_am TIMESTAMPTZ)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dokumente_person_idx ON fiaon_dokumente (person_id, hochgeladen_am DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dokumente_vorgang_idx ON fiaon_dokumente (vorgang_id)`;
    })().catch((e) => { tabellenBereit = null; throw e; });
  }
  return tabellenBereit;
}

// ── Helfer ──────────────────────────────────────────────────────────────────
const tag = (d: any): string | null => {
  if (!d) return null;
  const x = new Date(d); if (Number.isNaN(x.getTime())) return null;
  return x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
};

/** Heutiges Datum in Berlin — über formatToParts, nie über Number(format()). */
function berlinHeute(): { j: number; m: number; t: number } {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const wert = (art: string) => Number(teile.find((p) => p.type === art)?.value ?? "0");
  return { j: wert("year"), m: wert("month"), t: wert("day") };
}

/** Datum in n Werktagen (Mo–Fr, ohne Feiertage) als YYYY-MM-DD. */
export function werktageSpaeter(n: number): string {
  const h = berlinHeute();
  const d = new Date(Date.UTC(h.j, h.m - 1, h.t, 12));
  let rest = Math.max(0, n);
  while (rest > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) rest--; }
  return d.toISOString().slice(0, 10);
}

/**
 * Der Mensch hinter der Referenz — oder null (427 Anträge ohne person_id, Detailplan 3.4).
 * `name` nach dem Muster kundenNameFuer() aus fiaon-postmeister-werkzeuge.ts: Person, sonst Antrag.
 */
async function personFuerRef(ref: string): Promise<{ personId: number; vorname: string | null; name: string } | null> {
  const [a] = (await sqlPool`SELECT a.person_id, a.first_name, a.last_name, p.first_name AS p_vor, p.last_name AS p_nach, p.company_name
                                FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
                               WHERE a.ref = ${ref} LIMIT 1`) as any[];
  if (!a?.person_id) return null;
  const name = [a.p_vor, a.p_nach].filter(Boolean).join(" ").trim() || String(a.company_name || "").trim() || [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || ref;
  return { personId: Number(a.person_id), vorname: a.p_vor ?? a.first_name ?? null, name };
}

/** Dateinamen nie ungeprüft in Header oder Text — nur Buchstaben, Ziffern, Punkt, Strich. */
const sauberName = (roh: string, rueckfall: string): string => {
  const n = String(roh || "").replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
  return n && n !== "." && n !== ".." ? n : rueckfall;
};

function keinePerson(res: Response) {
  // 200, nicht 4xx: Das ist ein Zustand, den die Seite zeichnet, kein Fehler.
  res.json({ ok: false, grund: "keine_person", text: "Ihre Akte wird gerade mit Ihrer Person verknüpft. Dieser Bereich steht Ihnen in Kürze zur Verfügung." });
}

// ── Anspruchs-Check ─────────────────────────────────────────────────────────
const FRAGE_KEYS = new Set<string>(FRAGEN.map((f) => f.schluessel));

async function antwortenLaden(personId: number): Promise<Antworten> {
  const zeilen = (await sqlPool`SELECT frage_schluessel, wert FROM fiaon_anspruch_antworten WHERE person_id = ${personId}`) as any[];
  const a: Record<string, unknown> = {};
  for (let i = 0; i < zeilen.length; i++) a[zeilen[i].frage_schluessel] = zeilen[i].wert;
  return a as Antworten;
}

async function anspruecheStand(personId: number): Promise<Record<string, { stand: string; fristAm: string | null; vorgangId: number | null }>> {
  const zeilen = (await sqlPool`SELECT regel_schluessel, stand, frist_am, vorgang_id FROM fiaon_ansprueche WHERE person_id = ${personId}`) as any[];
  const m: Record<string, { stand: string; fristAm: string | null; vorgangId: number | null }> = {};
  for (let i = 0; i < zeilen.length; i++) m[zeilen[i].regel_schluessel] = { stand: zeilen[i].stand, fristAm: tag(zeilen[i].frist_am), vorgangId: zeilen[i].vorgang_id ? Number(zeilen[i].vorgang_id) : null };
  return m;
}

/** Befunde in fiaon_ansprueche schreiben: neue „offen", laufende behalten, weggefallene „nicht_zutreffend". */
async function befundeSpeichern(personId: number, liste: Befund[]): Promise<void> {
  const aktuelle: string[] = [];
  for (let i = 0; i < liste.length; i++) {
    const b = liste[i]; aktuelle.push(b.regel.schluessel);
    await sqlPool`
      INSERT INTO fiaon_ansprueche (person_id, regel_schluessel, stand, betrag_cents, monatlich, begruendung)
      VALUES (${personId}, ${b.regel.schluessel}, 'offen', ${b.betragCents}, ${b.rhythmus === "monatlich"}, ${b.begruendung})
      ON CONFLICT (person_id, regel_schluessel) DO UPDATE SET
        betrag_cents = EXCLUDED.betrag_cents, monatlich = EXCLUDED.monatlich, begruendung = EXCLUDED.begruendung,
        stand = CASE WHEN fiaon_ansprueche.stand IN ('beantragt','bewilligt','abgelehnt','verworfen') THEN fiaon_ansprueche.stand ELSE 'offen' END,
        aktualisiert_am = NOW()`;
  }
  // Was nach neuen Antworten nicht mehr zutrifft und noch nicht beantragt ist, wird stumm.
  const alle = (await sqlPool`SELECT regel_schluessel FROM fiaon_ansprueche WHERE person_id = ${personId} AND stand = 'offen'`) as any[];
  for (let i = 0; i < alle.length; i++) {
    const s = String(alle[i].regel_schluessel);
    if (aktuelle.indexOf(s) === -1) await sqlPool`UPDATE fiaon_ansprueche SET stand = 'nicht_zutreffend', aktualisiert_am = NOW() WHERE person_id = ${personId} AND regel_schluessel = ${s}`;
  }
}

function checkAntwort(a: Antworten, staende: Record<string, { stand: string; fristAm: string | null; vorgangId: number | null }>) {
  const liste = befunde(a);
  return {
    ok: true,
    fragen: FRAGEN,
    antworten: a,
    beantwortet: beantwortet(a),
    fragenGesamt: FRAGEN.length,
    befunde: liste.map((b) => ({
      schluessel: b.regel.schluessel, titel: b.regel.titel, kategorie: b.regel.kategorie,
      betragCents: b.betragCents, rhythmus: b.rhythmus, begruendung: b.begruendung, naechsterSchritt: b.naechsterSchritt,
      stelle: b.regel.stelle, wasWirTun: b.regel.wasWirTun, rechtsgrundlage: b.regel.rechtsgrundlage, quelleUrl: b.regel.quelleUrl, geprueftAm: b.regel.geprueftAm,
      stand: staende[b.regel.schluessel]?.stand ?? "offen", fristAm: staende[b.regel.schluessel]?.fristAm ?? null, vorgangId: staende[b.regel.schluessel]?.vorgangId ?? null,
    })),
    summeMonatlichCents: summeMonatlichCents(liste),
    regelnStand: REGELN.filter((r) => r.aktiv).map((r) => ({ schluessel: r.schluessel, geprueftAm: r.geprueftAm })),
  };
}

/** GET /kunde/:ref/app/ansprueche — Fragen, gegebene Antworten, Befunde mit Stand. */
router.get("/kunde/:ref/app/ansprueche", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const [a, st] = await Promise.all([antwortenLaden(p.personId), anspruecheStand(p.personId)]);
    res.json(checkAntwort(a, st));
  } catch (e: any) {
    console.error("[APP] ansprueche laden:", e?.message || e);
    res.status(500).json({ ok: false, error: "Der Anspruchs-Check konnte gerade nicht geladen werden." });
  }
});

/**
 * POST /kunde/:ref/app/ansprueche { antworten: { frage: wert, … } }
 * Jede Antwort geht SOFORT in die Datenbank (Detailplan Station 3: nichts mehr
 * nur im localStorage). Danach werden die Befunde neu gerechnet und gespeichert.
 */
router.post("/kunde/:ref/app/ansprueche", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const roh = (req.body?.antworten ?? {}) as Record<string, unknown>;
    const schluessel = Object.keys(roh).filter((k) => FRAGE_KEYS.has(k));
    for (let i = 0; i < schluessel.length; i++) {
      const k = schluessel[i]; const w = roh[k];
      if (w === undefined) continue;
      if (w === null) { await sqlPool`DELETE FROM fiaon_anspruch_antworten WHERE person_id = ${p.personId} AND frage_schluessel = ${k}`; continue; }
      await sqlPool`
        INSERT INTO fiaon_anspruch_antworten (person_id, frage_schluessel, wert, quelle)
        VALUES (${p.personId}, ${k}, ${sqlPool.json(w as any)}, 'kunde')
        ON CONFLICT (person_id, frage_schluessel) DO UPDATE SET wert = EXCLUDED.wert, erhoben_am = NOW(), quelle = 'kunde'`;
    }
    const a = await antwortenLaden(p.personId);
    await befundeSpeichern(p.personId, befunde(a));
    res.json(checkAntwort(a, await anspruecheStand(p.personId)));
  } catch (e: any) {
    console.error("[APP] ansprueche speichern:", e?.message || e);
    res.status(500).json({ ok: false, error: "Ihre Antwort konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

// ── Brief-Knopf ─────────────────────────────────────────────────────────────
const briefUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const art = String(file.mimetype || "").toLowerCase();
    if (art === "application/pdf" || istBild(art)) cb(null, true);
    else if (istHeic(art)) cb(new Error("Dieses Foto liegt im iPhone-Format HEIC vor. Bitte stellen Sie in den iPhone-Einstellungen unter Kamera → Formate auf „Maximale Kompatibilität“ und fotografieren Sie den Brief noch einmal."));
    else cb(new Error("Wir können Fotos (JPG, PNG) und PDF-Dateien lesen. Bitte fotografieren Sie den Brief mit der Kamera."));
  },
});

/**
 * POST /kunde/:ref/app/brief  (multipart: brief=Datei, notiz=Text optional)
 * Foto → PDF → fiaon_dokumente → Vorgang „brief" (eingegangen, Frist 2 Werktage)
 * → Auftrag an den Betreuer (E-115). Der Kunde bekommt Vorgang und Frist zurück
 * und sieht beides unter „Post". Nichts wird automatisch beantwortet.
 */
router.post("/kunde/:ref/app/brief", requireKunde, (req, res, next) => {
  briefUpload.array("brief", 10)(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ ok: false, error: "Das Foto ist größer als 25 MB. Bitte fotografieren Sie den Brief mit geringerer Auflösung noch einmal." });
      return res.status(400).json({ ok: false, error: err.message || "Die Datei konnte nicht angenommen werden." });
    }
    next();
  });
}, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const seiten = ((req as any).files as Express.Multer.File[] | undefined) ?? [];
    if (!seiten.length || !seiten[0]?.buffer?.length) return res.status(400).json({ ok: false, error: "Es ist kein Foto angekommen. Bitte versuchen Sie es noch einmal." });
    const notiz = String(req.body?.notiz ?? "").trim().slice(0, 500);
    // Dringend-Kästchen (Bauvorlage 3.4): Frist, Gericht, Gerichtsvollzieher, Inkasso → Aufgabe heute fällig.
    const dringend = ["1", "true", "ja", "on"].indexOf(String(req.body?.dringend ?? "").toLowerCase()) !== -1;
    const heute = berlinHeute();
    const datum = `${String(heute.t).padStart(2, "0")}.${String(heute.m).padStart(2, "0")}.${heute.j}`;
    const frist = dringend ? werktageSpaeter(0) : werktageSpaeter(2);

    const [v] = (await sqlPool`
      INSERT INTO fiaon_vorgaenge (person_id, art, titel, stand, stand_text, frist_am, notiz_kunde)
      VALUES (${p.personId}, 'brief', ${`Brief vom ${datum}`}, 'eingegangen', ${dringend ? "Eingegangen – als eilig vermerkt, wird heute gelesen." : "Eingegangen – wird von Ihrem Ansprechpartner gelesen."}, ${frist}, ${notiz || null})
      RETURNING id`) as any[];
    const vorgangId = Number(v.id);
    // Das Aktenzeichen vergibt FIAON selbst — es ist später der zuverlässigste Anker
    // für den Postmeister, wenn eine Antwort mit diesem Zeichen im Betreff eintrifft.
    const aktenzeichen = `AZ ${heute.j}-${String(vorgangId).padStart(6, "0")}`;
    await sqlPool`UPDATE fiaon_vorgaenge SET aktenzeichen = ${aktenzeichen} WHERE id = ${vorgangId}`;

    // Je Seite eine Zeile in fiaon_dokumente (Bilder werden zu PDF, PDF bleibt PDF).
    const dokIds: number[] = [];
    for (let i = 0; i < seiten.length; i++) {
      const f = seiten[i];
      const pdf = istBild(f.mimetype) ? await bildAlsPdf(f.buffer, sauberName(f.originalname, `brief-${i + 1}.jpg`)) : f.buffer;
      const hash = createHash("sha256").update(pdf).digest("hex");
      const [d] = (await sqlPool`
        INSERT INTO fiaon_dokumente (person_id, ref, vorgang_id, art, dateiname, mime, bytes, inhalt, quelle, aktenzeichen, doc_hash)
        VALUES (${p.personId}, ${req.kundeRef!}, ${vorgangId}, 'brief_eingang', ${`Brief_${datum.replace(/\./g, "-")}_Seite${i + 1}.pdf`}, 'application/pdf', ${pdf.length}, ${pdf}, 'kunde', ${aktenzeichen}, ${hash})
        RETURNING id`) as any[];
      dokIds.push(Number(d.id));
    }
    const d = { id: dokIds[0] };

    // Der Mensch dahinter — Betreuer, sonst Ableitung, sonst Betreiber. Mit Frist.
    let anWen: string | null = null;
    try {
      const { auftragFuerKunden } = await import("./fiaon-betreiber-todo");
      const erg = await auftragFuerKunden({
        personId: p.personId, ref: req.kundeRef!,
        titel: `${dringend ? "EILIG: " : ""}Brief lesen und zuordnen – ${p.name} (${aktenzeichen})`,
        link: `/admin/kunde/${encodeURIComponent(req.kundeRef!)}`,
        text: `Der Kunde hat einen Brief fotografiert und in seinem Bereich hochgeladen (${aktenzeichen}, Vorgang #${vorgangId}, ${seiten.length} ${seiten.length === 1 ? "Seite" : "Seiten"}, Dokumente #${dokIds.join(", #")}).${notiz ? ` Notiz des Kunden: „${notiz}“` : ""}${dringend ? " Der Kunde hat angegeben: Der Brief nennt eine Frist oder kommt von Gericht, Gerichtsvollzieher oder Inkasso." : ""} Bitte lesen, zuordnen und dem Kunden unter „Vorgänge" in einem Satz sagen, was wir daraus machen. Frist: ${dringend ? "heute" : `zwei Werktage (${frist})`}.`,
        faelligAm: frist, dringend, schluessel: `app-brief:${vorgangId}`, quelle: "kundenbereich", bereich: "kunden", autorName: "Kundenbereich",
      });
      anWen = erg.kundenName ?? erg.agentName ?? null;
      if (erg.agentId) await sqlPool`UPDATE fiaon_vorgaenge SET zustaendig_agent_id = ${erg.agentId}, updated_at = NOW() WHERE id = ${vorgangId}`;
    } catch (e: any) {
      console.error("[APP] Auftrag für Brief:", e?.message || e);
    }

    res.json({ ok: true, vorgangId, aktenzeichen, dringend, seiten: seiten.length, dokumentIds: dokIds, fristAm: tag(frist), anWen,
      text: `Ihr Brief ist bei uns. Aktenzeichen ${aktenzeichen}.`,
      text2: anWen ? `${anWen} ordnet ihn Ihrer Akte zu. Unter Vorgänge sehen Sie bis zum ${tag(frist)}, was wir daraus machen – mit Datum.` : `Wir ordnen ihn Ihrer Akte zu. Unter Vorgänge sehen Sie bis zum ${tag(frist)}, was wir daraus machen – mit Datum.` });
  } catch (e: any) {
    console.error("[APP] brief:", e?.message || e);
    res.status(500).json({ ok: false, error: "Der Brief konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

// ── Post: alle Vorgänge des Menschen ────────────────────────────────────────
const STAND_TEXT: Record<string, string> = {
  eingegangen: "Eingegangen – wird gelesen", gelesen: "Gelesen – wird bearbeitet", entwurf: "Entwurf – wird vorbereitet",
  unterschrift_offen: "Wartet auf Ihre Unterschrift", versandbereit: "Versandbereit", versandt: "Versandt – wartet auf Antwort",
  nachfrage: "Überfällig – wir haken nach", bewilligt: "Bewilligt", abgelehnt: "Abgelehnt", zurueckgezogen: "Zurückgezogen", erledigt: "Erledigt",
};
const ART_TEXT: Record<string, string> = {
  brief: "Ihr Brief", p_konto: "Antrag: höherer Schutzbetrag (P-Konto)", p_konto_umwandlung: "Umwandlung in ein P-Konto", rundfunk: "Antrag: Befreiung vom Rundfunkbeitrag",
  selbstauskunft: "Selbstauskunft (Art. 15 DSGVO)", wohngeld: "Anschreiben Wohngeldstelle", kfz: "Kündigung Kfz-Versicherung", handy: "Kündigung Handyvertrag",
};

/** GET /kunde/:ref/app/post — Briefe und Anträge, neueste zuerst, mit Stand, Frist, Dokumenten. */
router.get("/kunde/:ref/app/post", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const zeilen = (await sqlPool`
      SELECT v.id, v.art, v.titel, v.stand, v.stand_text, v.frist_am, v.versandt_am, v.empfaenger_name, v.aktenzeichen, v.created_at, v.updated_at,
             (SELECT COUNT(*) FROM fiaon_dokumente d WHERE d.vorgang_id = v.id AND d.geloescht_am IS NULL) AS dokumente,
             a.name AS zustaendig
        FROM fiaon_vorgaenge v
        LEFT JOIN fiaon_agents a ON a.id = v.zustaendig_agent_id
       WHERE v.person_id = ${p.personId}
       ORDER BY v.created_at DESC LIMIT 100`) as any[];
    res.json({
      ok: true,
      vorgaenge: zeilen.map((z) => ({
        id: Number(z.id), art: z.art, artText: ART_TEXT[z.art] ?? z.art, titel: z.titel, stand: z.stand,
        standText: z.stand_text || STAND_TEXT[z.stand] || z.stand, fristAm: tag(z.frist_am), versandtAm: tag(z.versandt_am),
        empfaenger: z.empfaenger_name ?? null, zustaendig: z.zustaendig ?? null, aktenzeichen: z.aktenzeichen ?? null, eingegangenAm: tag(z.created_at), aktualisiertAm: tag(z.updated_at),
        dokumente: Number(z.dokumente ?? 0),
        offen: ["eingegangen", "gelesen", "entwurf", "unterschrift_offen", "versandbereit", "versandt", "nachfrage"].indexOf(String(z.stand)) !== -1,
      })),
    });
  } catch (e: any) {
    console.error("[APP] post:", e?.message || e);
    res.status(500).json({ ok: false, error: "Ihre Post konnte gerade nicht geladen werden." });
  }
});

/** GET /kunde/:ref/app/dokument/:id — das eigene Dokument als PDF (nur eigene Person). */
router.get("/kunde/:ref/app/dokument/:id", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return res.status(404).end();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).end();
    const [d] = (await sqlPool`SELECT dateiname, mime, inhalt FROM fiaon_dokumente WHERE id = ${id} AND person_id = ${p.personId} AND geloescht_am IS NULL LIMIT 1`) as any[];
    if (!d) return res.status(404).end();
    res.setHeader("Content-Type", d.mime || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${sauberName(d.dateiname, "dokument.pdf")}"`);
    res.send(Buffer.from(d.inhalt));
  } catch (e: any) {
    console.error("[APP] dokument:", e?.message || e);
    res.status(500).end();
  }
});

export default router;
