// ═══════════════════════════════════════════════════════════════════════════
// DIE ZENTRALE — Endpunkte für das Postfach (02.09.2026, E-094)
//
// JUSTIN: „die Ansicht VIEL cleaner, weg mit dem 3D-Video […] ich will auch
// immer sehen was der Kunde geschrieben hat — es muss aussehen wie ein E-Mail
// Postfach was eben voll automatisch von unseren Mitarbeitern betreut wird.
// […] Immer als Entwurf speichern, dass ich kurz drüber schauen kann und dann
// markieren kann, oder alle direkt versende."
//
// Eigene Router-Datei, damit die Oberfläche und die Verarbeitungslogik nicht
// dieselbe Datei anfassen.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { akteLesen } from "../lib/fiaon-postmeister-dossier";
import { postmeisterSchema, kostenHeute } from "../lib/fiaon-postmeister-schema";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { postfachProbe } from "../lib/fiaon-gmail";
import { postfachAdressen } from "./fiaon-postmeister";

// Erreichbarkeit der Postfächer — alle zehn Minuten frisch, sonst aus dem Merkzettel.
// 04.09.2026: info@fiaon.com war bei Google kein Nutzer (invalid_grant) und
// scheiterte seit dem Start bei jedem Lauf, ohne dass es jemand im Postfach sah.
let probeMerk: { bis: number; werte: { adresse: string; ok: boolean; fehler: string | null; hinweis: string | null }[] } | null = null;
async function postfaecherProbe() {
  if (probeMerk && probeMerk.bis > Date.now()) return probeMerk.werte;
  const werte = await Promise.all(postfachAdressen().map(async (adresse) => {
    const p = await postfachProbe(adresse);
    const f = p.ok ? null : String(p.fehler || "");
    const hinweis = !f ? null
      : /invalid_grant|Invalid email or User ID/i.test(f) ? "Google kennt dieses Postfach nicht als Nutzer. Entweder als Alias auf welcome@fiaon.com legen und hier austragen, oder als eigenen Nutzer anlegen."
      : /unauthorized_client/i.test(f) ? "Das Dienstkonto darf dieses Postfach nicht öffnen (Domain-weite Delegation prüfen)."
      : "Postfach antwortet nicht — Mara sieht dort keine Mails.";
    return { adresse, ok: p.ok, fehler: f ? f.slice(0, 160) : null, hinweis };
  }));
  probeMerk = { bis: Date.now() + 10 * 60_000, werte };
  return werte;
}

const router = Router();

const jsonOderLeer = (w: unknown, ersatz: any) => {
  if (w == null) return ersatz;
  if (typeof w === "object") return w;
  try { return JSON.parse(String(w)); } catch { return ersatz; }
};

// ── HANDLUNGEN LESEN, AUCH WENN SIE ALS TEXT IM JSONB LIEGEN (05.09.2026) ──
// Der Lauf schrieb `handlungen: JSON.stringify(...)` in eine jsonb-Spalte —
// die Spalte enthielt dann einen JSON-TEXT statt einer Liste. handlungMerken
// hängte seine Einträge mit `||` daran: heraus kam eine Liste, deren erstes
// Element ein Text mit Maras Werkzeugen war. `filter(h => h.ok)` sah Maras
// Werkzeuge nie, die Wand hielt „Kündigung ist vorgemerkt" für ungedeckt, und
// Justin konnte sechs Entwürfe nicht senden. Dieser Leser faltet beides auf.
function handlungenLesen(roh: unknown): any[] {
  let v: any = roh;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  if (!Array.isArray(v)) return [];
  const out: any[] = [];
  for (const e of v) {
    if (typeof e === "string") { try { const p = JSON.parse(e); if (Array.isArray(p)) out.push(...p); } catch { /* kein JSON */ } }
    else if (e && typeof e === "object") out.push(e);
  }
  return out;
}

/** GET /admin/postmeister/postfach — die Liste, wie ein Postfach sie zeigt. */
router.get("/admin/postmeister/postfach", async (req: Request, res: Response) => {
  try {
    await postmeisterSchema();
    const ordner = String(req.query.ordner || "offen"); // offen | gesendet | kein_kunde | alle
    const postfach = String(req.query.postfach || "").trim();
    const suche = String(req.query.suche || "").trim();
    const grenze = Math.min(100, Math.max(10, Number(req.query.limit) || 40));
    const vor = Number(req.query.vor) || 0;

    const wo: string[] = ["1=1"];
    const werte: any[] = [];
    if (ordner === "offen") wo.push("pm.aktion IN ('entwurf','fehler')");
    else if (ordner === "gesendet") wo.push("pm.aktion IN ('gesendet','auto_beantwortet')");
    else if (ordner === "kein_kunde") wo.push("pm.aktion = 'ignoriert'");
    else if (ordner === "geordnet") wo.push("pm.aktion IN ('geordnet','vorgeordnet')");
    if (postfach) { werte.push(postfach); wo.push(`pm.postfach = $${werte.length}`); }
    if (suche) { werte.push(`%${suche}%`); wo.push(`(pm.betreff ILIKE $${werte.length} OR pm.von ILIKE $${werte.length} OR pm.zusammenfassung ILIKE $${werte.length} OR pm.ref ILIKE $${werte.length})`); }
    if (vor) { werte.push(vor); wo.push(`pm.id < $${werte.length}`); }

    const zeilen = (await sqlPool.unsafe(`
      SELECT pm.id, pm.postfach, pm.thread_id, pm.von, pm.betreff, pm.empfangen_am, pm.text,
             pm.zusammenfassung, pm.kategorie, pm.kategorien, pm.flags, pm.kundenlage, pm.dringend,
             pm.aktion, pm.person_id, pm.ref, pm.antwort, pm.antwort_html, pm.belege, pm.handlungen,
             pm.naechster_schritt, pm.pruefung, pm.gesendet_am, pm.begruendung, pm.person_kandidaten,
             p.first_name, p.last_name, ag.first_name AS betreuer,
             (SELECT COUNT(*) FROM fiaon_postmeister x WHERE x.thread_id = pm.thread_id)::int AS im_thread
        FROM fiaon_postmeister pm
        LEFT JOIN fiaon_persons p ON p.id = pm.person_id
        LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
       WHERE ${wo.join(" AND ")}
       ORDER BY pm.dringend DESC NULLS LAST, pm.empfangen_am DESC
       LIMIT ${grenze}
    `, werte)) as any[];

    const [z] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE aktion IN ('entwurf','fehler'))::int AS offen,
             COUNT(*) FILTER (WHERE aktion IN ('gesendet','auto_beantwortet'))::int AS gesendet,
             COUNT(*) FILTER (WHERE aktion = 'ignoriert')::int AS kein_kunde,
             COUNT(*) FILTER (WHERE aktion IN ('geordnet','vorgeordnet'))::int AS geordnet,
             COUNT(*) FILTER (WHERE aktion = 'entwurf' AND dringend)::int AS dringend
        FROM fiaon_postmeister
    `) as any[];

    res.json({
      ok: true,
      ordner,
      zaehler: { offen: z?.offen ?? 0, gesendet: z?.gesendet ?? 0, kein_kunde: z?.kein_kunde ?? 0, geordnet: z?.geordnet ?? 0, dringend: z?.dringend ?? 0 },
      naechsterCursor: zeilen.length === grenze ? zeilen[zeilen.length - 1].id : null,
      zeilen: zeilen.map((r) => ({
        id: r.id, postfach: r.postfach, threadId: r.thread_id,
        von: r.von, vonName: String(r.von || "").replace(/<[^>]*>/g, "").replace(/"/g, "").trim() || r.von,
        betreff: r.betreff, empfangenAm: r.empfangen_am, text: r.text,
        zusammenfassung: r.zusammenfassung,
        kategorien: r.kategorien ?? (r.kategorie ? [r.kategorie] : []),
        flags: jsonOderLeer(r.flags, {}), kundenlage: r.kundenlage, dringend: !!r.dringend,
        aktion: r.aktion, personId: r.person_id, ref: r.ref,
        kundeName: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
        betreuer: r.betreuer ?? null,
        antwort: r.antwort, antwortHtml: r.antwort_html,
        belege: jsonOderLeer(r.belege, []), handlungen: handlungenLesen(r.handlungen),
        naechsterSchritt: jsonOderLeer(r.naechster_schritt, null),
        pruefung: jsonOderLeer(r.pruefung, null),
        gesendetAm: r.gesendet_am, begruendung: r.begruendung,
        kandidaten: jsonOderLeer(r.person_kandidaten, []),
        nachrichtenImThread: r.im_thread ?? 1,
      })),
    });
  } catch (e: any) {
    console.error("[ZENTRALE] postfach:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** GET /admin/postmeister/eintrag/:id — Mail, Verlauf und Akte nebeneinander. */
router.get("/admin/postmeister/eintrag/:id", async (req: Request, res: Response) => {
  try {
    await postmeisterSchema();
    const id = Number(req.params.id);
    const [r] = (await sqlPool`SELECT * FROM fiaon_postmeister WHERE id = ${id} LIMIT 1`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Nicht gefunden" });

    const verlauf = (await sqlPool`
      SELECT id, von, empfangen_am, text, antwort, gesendet_am, aktion, betreff
        FROM fiaon_postmeister WHERE thread_id = ${r.thread_id} ORDER BY empfangen_am ASC LIMIT 20
    `) as any[];
    const akte = await akteLesen(r.person_id ?? null, r.ref ?? null);
    // 04.09.2026 (E-115): Der Vertragsstand für die Schalter im Postfach —
    // ist schon gekündigt? welche Rate bleibt? ist der Vertrag beendet?
    const [v] = r.ref ? ((await sqlPool`
      SELECT gekuendigt_am, letzte_rate_nr, vertrag_ende_am, kuendigung_zurueckgenommen_am, payment_status,
             gc_subscription_ref
        FROM fiaon_applications WHERE ref = ${r.ref} LIMIT 1
    `.catch(() => [])) as any[]) : [null];

    res.json({
      ok: true,
      eintrag: {
        id: r.id, postfach: r.postfach, von: r.von, betreff: r.betreff, empfangenAm: r.empfangen_am,
        anhaenge: jsonOderLeer(r.anhaenge, []), anhaengeEingang: jsonOderLeer(r.anhaenge_eingang, []),
        vertrag: v ? {
          gekuendigtAm: v.gekuendigt_am, letzteRateNr: v.letzte_rate_nr, vertragEndeAm: v.vertrag_ende_am,
          zurueckgenommenAm: v.kuendigung_zurueckgenommen_am, zahlungsstatus: v.payment_status, lastschrift: !!v.gc_subscription_ref,
        } : null,
        text: r.text, zusammenfassung: r.zusammenfassung, kategorien: r.kategorien ?? [],
        flags: jsonOderLeer(r.flags, {}), kundenlage: r.kundenlage, dringend: !!r.dringend,
        aktion: r.aktion, antwort: r.antwort, antwortHtml: r.antwort_html,
        belege: jsonOderLeer(r.belege, []), handlungen: handlungenLesen(r.handlungen),
        pruefung: jsonOderLeer(r.pruefung, null), naechsterSchritt: jsonOderLeer(r.naechster_schritt, null),
        begruendung: r.begruendung, gesendetAm: r.gesendet_am, ref: r.ref, personId: r.person_id,
      },
      verlauf: verlauf.map((v) => ({
        id: v.id, richtung: "ein", von: v.von, am: v.empfangen_am, betreff: v.betreff,
        text: v.text, antwort: v.antwort, antwortGesendet: v.gesendet_am, aktion: v.aktion,
      })),
      akte,
    });
  } catch (e: any) {
    console.error("[ZENTRALE] eintrag:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/**
 * Was der Mensch beim Senden zusätzlich entscheidet (04.09.2026, E-115 — die
 * drei Schalter aus dem Entwurf): Rechnung als PDF, Aufgabe für den Betreuer,
 * Kündigung vormerken (Storno erst nach Zahlungseingang oder Kulanz sofort).
 */
export interface SendeWahl {
  /** false = ausdrücklich ohne Rechnung; sonst Plan + Automatik. */
  anhaenge?: boolean | null;
  aufgabe?: { titel: string; text: string; faelligInTagen?: number; dringend?: boolean } | null;
  kuendigung?: { vormerken: boolean; nachZahlung: boolean; grund?: string | null } | null;
}

async function handlungMerken(id: number, werkzeug: string, ergebnis: string, ok = true): Promise<void> {
  await sqlPool`
    UPDATE fiaon_postmeister
       SET handlungen = (CASE WHEN jsonb_typeof(handlungen) = 'array' THEN handlungen
                              WHEN jsonb_typeof(handlungen) = 'string' AND jsonb_typeof((handlungen #>> '{}')::jsonb) = 'array' THEN (handlungen #>> '{}')::jsonb
                              ELSE '[]'::jsonb END)
                        || ${sqlPool.json([{ werkzeug, ergebnis: ergebnis.slice(0, 300), ok, am: new Date().toISOString(), von: "mensch" }] as any)},
           updated_at = NOW()
     WHERE id = ${id}
  `.catch(() => {});
}

/** Ein Entwurf wird gesendet — mit frischer Prüfung kurz davor. */
async function entwurfSenden(id: number, textNeu?: string | null, wahl: SendeWahl = {}): Promise<{ ok: boolean; grund: string; erledigt?: string[] }> {
  const [r] = (await sqlPool`
    UPDATE fiaon_postmeister SET aktion = 'sendet', updated_at = NOW()
     WHERE id = ${id} AND aktion IN ('entwurf', 'fehler') RETURNING *
  `) as any[];
  if (!r) return { ok: false, grund: "Nicht mehr im Entwurf-Zustand" };

  const text = String(textNeu ?? r.antwort ?? "").trim();
  if (text.length < 20) {
    await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf' WHERE id = ${id}`;
    return { ok: false, grund: "Text ist zu kurz" };
  }

  const erledigt: string[] = [];
  const gelaufen = handlungenLesen(r.handlungen).filter((h) => h.ok).map((h) => String(h.werkzeug));

  // ── TATSACHEN AUS DER AKTE DECKEN ZUSAGEN (05.09.2026) ─────────────────
  // Die Wand verlangt für „Ihre Kündigung ist vorgemerkt" ein Werkzeug aus
  // DIESEM Versand. Beim Freigeben eines Entwurfs lief aber kein Werkzeug —
  // Mara hatte die Kündigung schon beim Schreiben vorgemerkt, oder sie stand
  // seit Tagen in der Akte. Eine Tatsache ist keine ungedeckte Zusage: Was die
  // Datenbank bestätigt, gilt als gedeckt. Steht es NICHT (mehr) in der Akte,
  // etwa nach „Kündigung zurücknehmen", bleibt die Wand zu Recht stehen.
  if (r.ref) {
    const [a] = (await sqlPool`
      SELECT gekuendigt_am, kuendigung_zurueckgenommen_am, payment_status, mahnstopp_am
      FROM fiaon_applications WHERE ref = ${r.ref} LIMIT 1
    `.catch(() => [] as any[])) as any[];
    if (a) {
      const gekuendigt = a.gekuendigt_am && !a.kuendigung_zurueckgenommen_am;
      const storniert = ["cancelled", "canceled", "storniert"].includes(String(a.payment_status || ""));
      if (gekuendigt || storniert) gelaufen.push("kuendigung_vormerken");
      if (a.mahnstopp_am) gelaufen.push("mahnstopp_setzen");
    }
  }
  if (r.person_id) {
    const [p] = (await sqlPool`
      SELECT werbung_gesperrt_am, account_status FROM fiaon_persons WHERE id = ${r.person_id} LIMIT 1
    `.catch(() => [] as any[])) as any[];
    if (p?.werbung_gesperrt_am) gelaufen.push("werbesperre_setzen");
    if (p?.account_status === "active") gelaufen.push("konto_freischalten");
  }

  // Schalter 1: Kündigung — ein Mensch entscheidet, deshalb ohne Willenserklärungs-Wand.
  if (wahl.kuendigung?.vormerken) {
    if (!r.ref) {
      await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf' WHERE id = ${id}`;
      return { ok: false, grund: "Ohne Bestellung kann keine Kündigung vorgemerkt werden." };
    }
    const { kuendigungSetzen } = await import("../lib/fiaon-kuendigung");
    const erg = await kuendigungSetzen(r.ref, {
      quelle: "mail", grund: String(wahl.kuendigung.grund || "").slice(0, 300) || null,
      postmeisterId: id, sofort: wahl.kuendigung.nachZahlung === false,
    });
    if (!erg.ok) {
      await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf', begruendung = ${`Kündigung nicht vorgemerkt: ${erg.grund}`} WHERE id = ${id}`;
      return { ok: false, grund: `Kündigung: ${erg.grund}` };
    }
    const satz = erg.weg === "letzte_rate"
      ? `Kündigung vorgemerkt — Rate ${erg.letzteRateNr} bleibt offen, mit ihrer Zahlung endet der Vertrag.`
      : erg.weg === "kulanz_sofort" ? `Kündigung mit Kulanz — Vertrag sofort beendet, ${erg.stornierteRaten} offene Rate(n) entfallen.`
      : erg.weg === "storno_unbezahlt" ? "Bestellung storniert (war unbezahlt)."
      : erg.weg === "bereits" ? "Kündigung stand bereits."
      : "Vertrag beendet.";
    await handlungMerken(id, "kuendigung_vormerken", satz);
    gelaufen.push("kuendigung_vormerken");
    erledigt.push(satz);
  }

  // Schalter 2: Aufgabe für den Betreuer.
  if (wahl.aufgabe && String(wahl.aufgabe.titel || "").trim().length >= 3) {
    const { auftragFuerKunden } = await import("./fiaon-betreiber-todo");
    const tage = Math.max(0, Math.min(7, Math.round(Number(wahl.aufgabe.faelligInTagen ?? 2)) || 0));
    const a = await auftragFuerKunden({
      personId: r.person_id ?? null, ref: r.ref ?? null,
      titel: String(wahl.aufgabe.titel).trim(), text: String(wahl.aufgabe.text || "").trim(),
      faelligAm: new Date(Date.now() + tage * 864e5).toISOString().slice(0, 10), dringend: !!wahl.aufgabe.dringend,
      schluessel: `postmeister:${id}:aufgabe-mensch`, quelle: "postmeister", autorName: "Postfach",
    });
    const satz = `Aufgabe für ${a.agentName ?? "die Leitung"}: „${String(wahl.aufgabe.titel).trim().slice(0, 80)}" (fällig ${a.faelligAm}).`;
    await handlungMerken(id, "aufgabe_an_betreuer", satz);
    gelaufen.push("aufgabe_an_betreuer");
    erledigt.push(satz);
  }

  // Schalter 3 (Plan): Rechnung als PDF — Plan der Zeile plus Automatik
  // (Zahlungsseite), außer der Mensch sagt nein. Der Plan steht VOR der Wand:
  // „Die Rechnung hängt an" ist gedeckt, wenn sie gleich wirklich anhängt.
  const { anhaengePlanen, anhaengeBauen } = await import("../lib/fiaon-postmeister-anhaenge");
  const plan = wahl.anhaenge === false ? [] : anhaengePlanen(r.anhaenge, jsonOderLeer(r.naechster_schritt, null));
  if (plan.length) gelaufen.push("rechnung_anhaengen");

  // Frische Prüfung: Wand und Bankdaten. Ein Entwurf von gestern kann heute
  // falsch sein — am 02.09. lag einer mit der gesperrten IBAN in der Werkbank.
  const treffer = wandPruefen(text, gelaufen).filter((t) => t.art !== "floskel");
  if (treffer.length) {
    await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'entwurf', begruendung = ${`Nicht gesendet: ${treffer.map((t) => t.treffer).join("; ")}`} WHERE id = ${id}
    `;
    return { ok: false, grund: `Prüfung: ${treffer.map((t) => t.treffer).join("; ")}` };
  }

  try {
    const { nachrichtLesen, antwortSenden, nachrichtLabeln, labelSicherstellen, entwurfLoeschen } = await import("../lib/fiaon-gmail");
    const gebaut = plan.length ? await anhaengeBauen(plan) : { dateien: [], fehler: [] as string[] };
    if (gebaut.fehler.length) erledigt.push(`Nicht angehängt: ${gebaut.fehler.join("; ")}`);
    const mail = await nachrichtLesen(r.postfach, r.gmail_id);
    // Text und HTML aus dem FINALEN Text bauen — nie das alte HTML mit neuem Text.
    const { antwortAusText, grussMitAgent } = await import("../lib/fiaon-postmeister-antworttext");
    const { agentName } = await import("../lib/fiaon-postmeister-agent");
    const { postfachGruss } = await import("./fiaon-postmeister");
    const name = await agentName();
    const grussVorgabe = grussMitAgent(postfachGruss(String(r.postfach)), name);
    const fertig = antwortAusText(text, { schritt: jsonOderLeer(r.naechster_schritt, null), betreff: String(r.betreff || ""), sprache: r.sprache ?? null, agentName: name, gruss: grussVorgabe });
    await antwortSenden(r.postfach, mail, fertig.text, fertig.html, gebaut.dateien);
    if (gebaut.dateien.length) erledigt.push(`Angehängt: ${gebaut.dateien.map((d) => d.dateiname).join(", ")}`);
    if (r.antwort_draft_id) await entwurfLoeschen(r.postfach, r.antwort_draft_id).catch(() => {});
    await nachrichtLabeln(r.postfach, r.gmail_id, [await labelSicherstellen(r.postfach, "FIAON/Beantwortet")], ["UNREAD"]).catch(() => {});
    await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'gesendet', antwort = ${fertig.text}, antwort_html = ${fertig.html}, gesendet_am = NOW(), updated_at = NOW(),
             anhaenge = ${plan.length ? sqlPool.json(plan as any) : null} WHERE id = ${id}
    `;
    if (r.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${r.ref}, ${r.person_id}, NULL, 'Postmeister', 'system', ${`Antwort freigegeben und gesendet${gebaut.dateien.length ? ` (mit ${gebaut.dateien.map((d) => d.dateiname).join(", ")})` : ""}: ${text.slice(0, 400)}`})
      `.catch(() => {});
    }
    return { ok: true, grund: "gesendet", erledigt };
  } catch (e: any) {
    await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf', begruendung = ${String(e?.message || e).slice(0, 300)} WHERE id = ${id}`;
    return { ok: false, grund: String(e?.message || e).slice(0, 200) };
  }
}

router.post("/admin/postmeister/eintrag/:id/senden", async (req: Request, res: Response) => {
  const b = req.body || {};
  const wahl: SendeWahl = {
    anhaenge: typeof b.anhaenge === "boolean" ? b.anhaenge : null,
    aufgabe: b.aufgabe && typeof b.aufgabe === "object" && b.aufgabe.titel
      ? { titel: String(b.aufgabe.titel).slice(0, 160), text: String(b.aufgabe.text || "").slice(0, 4000), faelligInTagen: Number(b.aufgabe.faelligInTagen ?? 2), dringend: b.aufgabe.dringend === true }
      : null,
    kuendigung: b.kuendigung && typeof b.kuendigung === "object" && b.kuendigung.vormerken === true
      ? { vormerken: true, nachZahlung: b.kuendigung.nachZahlung !== false, grund: b.kuendigung.grund ? String(b.kuendigung.grund).slice(0, 300) : null }
      : null,
  };
  const erg = await entwurfSenden(Number(req.params.id), b.text ?? null, wahl);
  res.status(erg.ok ? 200 : 409).json(erg);
});

/** Eine Datei aus der Kundenmail — was der Kunde mitgeschickt hat, sieht der Mensch hier. */
router.get("/admin/postmeister/eintrag/:id/anhang/:idx", async (req: Request, res: Response) => {
  try {
    const [r] = (await sqlPool`SELECT postfach, gmail_id, anhaenge_eingang FROM fiaon_postmeister WHERE id = ${Number(req.params.id)} LIMIT 1`) as any[];
    const liste = jsonOderLeer(r?.anhaenge_eingang, []) as any[];
    const a = liste[Number(req.params.idx)];
    if (!r || !a?.attachmentId) return res.status(404).json({ ok: false, error: "Anhang nicht gefunden" });
    const { anhangLesen } = await import("../lib/fiaon-gmail");
    const inhalt = await anhangLesen(r.postfach, r.gmail_id, a.attachmentId);
    const name = String(a.name || "anhang").replace(/["\r\n]/g, "");
    res.setHeader("Content-Type", String(a.typ || "application/octet-stream"));
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(name)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(inhalt);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Der Kunde bleibt doch (Rettungsgespräch hat gewirkt): Kündigung zurücknehmen. */
router.post("/admin/postmeister/eintrag/:id/kuendigung-zuruecknehmen", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [r] = (await sqlPool`SELECT ref FROM fiaon_postmeister WHERE id = ${id} LIMIT 1`) as any[];
    if (!r?.ref) return res.status(404).json({ ok: false, error: "Keine Bestellung an diesem Vorgang" });
    const { kuendigungZuruecknehmen } = await import("../lib/fiaon-kuendigung");
    const erg = await kuendigungZuruecknehmen(r.ref, "aus dem Postfach zurückgenommen");
    await handlungMerken(id, "kuendigung_zurueckgenommen", `Kündigung zurückgenommen — ${erg.ratenZurueck} Rate(n) leben wieder auf.`, erg.ok);
    res.json({ ok: erg.ok, ratenZurueck: erg.ratenZurueck });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

router.post("/admin/postmeister/eintrag/:id/verwerfen", async (req: Request, res: Response) => {
  try {
    const [r] = (await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'geordnet', begruendung = ${`Verworfen: ${String(req.body?.grund || "ohne Angabe").slice(0, 200)}`}, updated_at = NOW()
       WHERE id = ${Number(req.params.id)} AND aktion IN ('entwurf', 'fehler') RETURNING postfach, antwort_draft_id
    `) as any[];
    if (r?.antwort_draft_id) {
      const { entwurfLoeschen } = await import("../lib/fiaon-gmail");
      await entwurfLoeschen(r.postfach, r.antwort_draft_id).catch(() => {});
    }
    res.json({ ok: !!r });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// E-119 (04.09.2026) — ALLE ENTWÜRFE NEU SCHREIBEN
//
// Justin: „ALLE Entwürfe, die bislang von Mara geschrieben wurden, müssen
// bearbeitet werden — so, dass der Text passt, Aufgaben von Mara erfüllt
// werden UND alles passt. Bitte das nachholen und live stellen!"
//
// Der Lauf nimmt jeden wartenden Entwurf (und jeden Fehler), löscht den alten
// Gmail-Entwurf, setzt die Zeile auf „vorgeordnet" zurück und schickt sie
// noch einmal durch mailBearbeiten — mit dem heutigen Stand: Kundenweg,
// Rettungsgespräch, Namen, Anhänge, Aufgaben, Vorab-Zahlungsseite. Im Modus
// „auto" geht raus, was die Freigaben erlaubt; der Rest wartet als frischer
// Entwurf. Werkzeuge sind idempotent (Aufgabe je Vorgang, Kündigung „bereits",
// Sperren einmalig) — ein zweiter Durchlauf richtet keinen Schaden an.
// Läuft im Server-Hintergrund, zwei Mails gleichzeitig; Fortschritt im Postfach.
// ═══════════════════════════════════════════════════════════════════════════
interface NeuLauf {
  laeuft: boolean; gestartet: string | null; beendet: string | null; abbruch: boolean;
  gesamt: number; fertig: number; gesendet: number; entwurf: number; fehler: number; uebersprungen: number;
  aktuell: string[]; protokoll: { id: number; von: string; aktion: string; grund: string }[];
}
const neuLauf: NeuLauf = { laeuft: false, gestartet: null, beendet: null, abbruch: false, gesamt: 0, fertig: 0, gesendet: 0, entwurf: 0, fehler: 0, uebersprungen: 0, aktuell: [], protokoll: [] };

async function neuLaufStarten(kandidaten: { id: number; postfach: string; gmail_id: string; von: string; antwort_draft_id: string | null }[], parallel: number): Promise<void> {
  Object.assign(neuLauf, { laeuft: true, gestartet: new Date().toISOString(), beendet: null, abbruch: false, gesamt: kandidaten.length, fertig: 0, gesendet: 0, entwurf: 0, fehler: 0, uebersprungen: 0, aktuell: [], protokoll: [] });
  const { mailBearbeiten } = await import("../lib/fiaon-postmeister-lauf");
  const { postfachGruss, postfachModus } = await import("./fiaon-postmeister");
  const { entwurfLoeschen } = await import("../lib/fiaon-gmail");
  const schlange = [...kandidaten];
  const arbeiter = async () => {
    while (schlange.length && !neuLauf.abbruch) {
      const k = schlange.shift()!;
      const kennung = `#${k.id} ${String(k.von || "").replace(/<[^>]*>/g, "").trim().slice(0, 30)}`;
      neuLauf.aktuell.push(kennung);
      try {
        const modus = await postfachModus(k.postfach);
        if (modus === "aus") { neuLauf.uebersprungen++; neuLauf.protokoll.push({ id: k.id, von: kennung, aktion: "uebersprungen", grund: "Postfach aus" }); continue; }
        // Zurücksetzen — nur, wenn nicht gerade ein Mensch sendet ('sendet').
        const [r] = (await sqlPool`
          UPDATE fiaon_postmeister
             SET aktion = 'vorgeordnet', versuche = 0, antwort = NULL, antwort_html = NULL, antwort_draft_id = NULL,
                 anhaenge = NULL, begruendung = 'Neu bearbeitet (E-119)', updated_at = NOW()
           WHERE id = ${k.id} AND aktion IN ('entwurf', 'fehler') RETURNING id
        `) as any[];
        if (!r) { neuLauf.uebersprungen++; neuLauf.protokoll.push({ id: k.id, von: kennung, aktion: "uebersprungen", grund: "nicht mehr im Entwurf" }); continue; }
        if (k.antwort_draft_id) await entwurfLoeschen(k.postfach, k.antwort_draft_id).catch(() => {});
        const erg = await mailBearbeiten({ postfach: k.postfach, gmailId: k.gmail_id, gruss: postfachGruss(k.postfach), modus, nurOrdnen: false });
        if (erg.aktion === "auto_beantwortet") neuLauf.gesendet++;
        else if (erg.aktion === "entwurf") neuLauf.entwurf++;
        else if (erg.aktion === "fehler") neuLauf.fehler++;
        else neuLauf.uebersprungen++;
        neuLauf.protokoll.push({ id: k.id, von: kennung, aktion: erg.aktion, grund: String(erg.grund || "").slice(0, 160) });
      } catch (e: any) {
        neuLauf.fehler++;
        neuLauf.protokoll.push({ id: k.id, von: kennung, aktion: "fehler", grund: String(e?.message || e).slice(0, 160) });
      } finally {
        neuLauf.fertig++;
        neuLauf.aktuell = neuLauf.aktuell.filter((a) => a !== kennung);
        if (neuLauf.protokoll.length > 400) neuLauf.protokoll.splice(0, neuLauf.protokoll.length - 400);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, parallel)) }, () => arbeiter()));
  neuLauf.laeuft = false;
  neuLauf.beendet = new Date().toISOString();
  console.log(`[POSTMEISTER] Neubearbeitung fertig: ${neuLauf.fertig}/${neuLauf.gesamt} — ${neuLauf.gesendet} gesendet, ${neuLauf.entwurf} Entwurf, ${neuLauf.fehler} Fehler, ${neuLauf.uebersprungen} übersprungen`);
}

router.get("/admin/postmeister/neu-bearbeiten", async (_req: Request, res: Response) => {
  const [z] = (await sqlPool`SELECT COUNT(*) FILTER (WHERE aktion = 'entwurf')::int AS entwuerfe, COUNT(*) FILTER (WHERE aktion = 'fehler')::int AS fehler FROM fiaon_postmeister`.catch(() => [{ entwuerfe: 0, fehler: 0 }])) as any[];
  res.json({ ok: true, lauf: { ...neuLauf, protokoll: neuLauf.protokoll.slice(-40) }, wartend: z });
});

router.post("/admin/postmeister/neu-bearbeiten", async (req: Request, res: Response) => {
  try {
    if (neuLauf.laeuft) return res.status(409).json({ ok: false, error: "Läuft bereits", lauf: neuLauf });
    const deckel = Math.max(1, Math.min(500, Number(req.body?.deckel) || 500));
    const parallel = Math.max(1, Math.min(4, Number(req.body?.parallel) || 2));
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
    const postfach = typeof req.body?.postfach === "string" ? req.body.postfach : null;
    const kandidaten = (await sqlPool`
      SELECT id, postfach, gmail_id, von, antwort_draft_id, thread_id, empfangen_am FROM fiaon_postmeister
       WHERE aktion IN ('entwurf', 'fehler') AND gmail_id IS NOT NULL AND gmail_id <> ''
         AND (${ids.length ? sqlPool`id = ANY(${ids})` : sqlPool`TRUE`})
         AND (${postfach ? sqlPool`postfach = ${postfach}` : sqlPool`TRUE`})
       ORDER BY empfangen_am ASC NULLS LAST, id ASC LIMIT ${deckel}
    `) as any[];
    if (!kandidaten.length) return res.json({ ok: true, gestartet: 0 });
    // Dieselbe Nachricht dreimal im selben Thread (Frau Weber, 25./26.08.) bekommt
    // EINE Antwort — die neueste Mail wird beantwortet, die älteren geordnet.
    const nachThread = new Map<string, any[]>();
    for (const k of kandidaten) { const t = String(k.thread_id || k.id); if (!nachThread.has(t)) nachThread.set(t, []); nachThread.get(t)!.push(k); }
    const bearbeiten: any[] = []; let geordnet = 0;
    const { entwurfLoeschen } = await import("../lib/fiaon-gmail");
    for (const gruppe of Array.from(nachThread.values())) {
      gruppe.sort((a, b) => new Date(a.empfangen_am || 0).getTime() - new Date(b.empfangen_am || 0).getTime());
      const neueste = gruppe[gruppe.length - 1];
      for (const alt of gruppe.slice(0, -1)) {
        await sqlPool`
          UPDATE fiaon_postmeister SET aktion = 'geordnet', begruendung = ${`Doppelte Nachricht im selben Thread — beantwortet über #${neueste.id}`}, antwort_draft_id = NULL, updated_at = NOW()
           WHERE id = ${alt.id} AND aktion IN ('entwurf', 'fehler')
        `.catch(() => {});
        if (alt.antwort_draft_id) await entwurfLoeschen(alt.postfach, alt.antwort_draft_id).catch(() => {});
        geordnet++;
      }
      bearbeiten.push(neueste);
    }
    void neuLaufStarten(bearbeiten, parallel).catch((e) => { neuLauf.laeuft = false; console.error("[POSTMEISTER] Neubearbeitung:", e); });
    res.json({ ok: true, gestartet: bearbeiten.length, doppelteGeordnet: geordnet, parallel });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

router.post("/admin/postmeister/neu-bearbeiten/stopp", async (_req: Request, res: Response) => {
  neuLauf.abbruch = true;
  res.json({ ok: true, lauf: neuLauf });
});

/** Mehrere auf einmal — nur ausdrücklich ausgewählte, nie „alles". */
router.post("/admin/postmeister/senden-mehrere", async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean).slice(0, 60) : [];
    if (!ids.length) return res.status(400).json({ ok: false, error: "Keine Auswahl" });
    let gesendet = 0; const fehler: { id: number; grund: string }[] = [];
    for (const id of ids) {
      const e = await entwurfSenden(id);
      if (e.ok) gesendet += 1; else fehler.push({ id, grund: e.grund });
    }
    res.json({ ok: true, gesendet, fehler });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Person zuordnen, wenn der Absender unbekannt war. */
router.post("/admin/postmeister/eintrag/:id/person", async (req: Request, res: Response) => {
  try {
    const personId = Number(req.body?.personId);
    if (!personId) return res.status(400).json({ ok: false, error: "personId fehlt" });
    const [b] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1
    `) as any[];
    await sqlPool`
      UPDATE fiaon_postmeister SET person_id = ${personId}, ref = ${b?.ref ?? null}, updated_at = NOW()
       WHERE id = ${Number(req.params.id)}
    `;
    res.json({ ok: true, ref: b?.ref ?? null });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Der Kopf: Zustand, Rückstand, Kosten. */
router.get("/admin/postmeister/kopf", async (_req: Request, res: Response) => {
  try {
    await postmeisterSchema();
    const [z] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE aktion = 'entwurf')::int AS entwuerfe,
             COUNT(*) FILTER (WHERE aktion = 'entwurf' AND dringend)::int AS dringend,
             COUNT(*) FILTER (WHERE aktion = 'fehler')::int AS fehler,
             COUNT(*) FILTER (WHERE gesendet_am > NOW() - INTERVAL '24 hours')::int AS heute_gesendet,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS heute_gesehen
        FROM fiaon_postmeister
    `) as any[];
    const jePostfach = (await sqlPool`
      SELECT postfach, COUNT(*) FILTER (WHERE aktion = 'entwurf')::int AS offen, COUNT(*)::int AS gesamt
        FROM fiaon_postmeister GROUP BY postfach ORDER BY postfach
    `) as any[];
    const threads = await sqlPool`
      SELECT COUNT(*) FILTER (WHERE status = 'offen')::int AS offen, COUNT(*)::int AS gesamt FROM fiaon_postfach_threads
    `.then((r: any) => r[0] ?? { offen: 0, gesamt: 0 }).catch(() => ({ offen: 0, gesamt: 0 }));
    res.json({
      ok: true, zahlen: z ?? {}, jePostfach,
      rueckstand: threads ?? { offen: 0, gesamt: 0 },
      kostenHeuteEuro: Number((await kostenHeute("postmeister-antwort")).toFixed(2)),
      postfaecher: await postfaecherProbe().catch(() => []),
      agent: await (await import("../lib/fiaon-postmeister-agent")).agentNamen().catch(() => ({ vorname: "Mara", nachname: "", voll: "Mara" })),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** POST /admin/postmeister/aufholen {phase, tage, deckel} — der Berg. */
router.post("/admin/postmeister/aufholen", async (req: Request, res: Response) => {
  try {
    const { phaseOrdnen, phaseAntworten, aufholDeckel } = await import("../lib/fiaon-postmeister-aufholen");
    const phase = String(req.body?.phase || "ordnen");
    const deckelStandard = await aufholDeckel();

    if (phase === "antworten") {
      const gruesse: Record<string, string> = {};
      const pf = (await sqlPool`SELECT DISTINCT postfach FROM fiaon_postmeister`) as any[];
      for (const p of pf) gruesse[p.postfach] = `Freundliche Grüße\nIhr FIAON-Team\n${p.postfach} · fiaon.com`;
      const erg = await phaseAntworten({ deckel: Math.min(60, Number(req.body?.deckel) || deckelStandard.antworten), gruesse });
      return res.json({ ok: true, phase, ...erg });
    }

    const postfach = String(req.body?.postfach || "").trim();
    const alle = postfach ? [postfach] : ["support@fiaon.com", "welcome@fiaon.com", "js@fiaon.com"];
    const staende = [];
    for (const p of alle) {
      const stand = await phaseOrdnen({
        postfach: p, gruss: `Freundliche Grüße\nIhr FIAON-Team\n${p} · fiaon.com`,
        tageZurueck: Math.min(3650, Number(req.body?.tage) || 365),
        deckel: Math.min(200, Number(req.body?.deckel) || deckelStandard.ordnen),
      }).catch((e: any) => ({ phase: "ordnen", postfach: p, gesehen: 0, neu: 0, beantwortet: 0, uebersprungen: { fehler: 1 }, fertig: false, fehlerText: String(e?.message || e).slice(0, 200) }));
      staende.push(stand);
    }
    res.json({ ok: true, phase: "ordnen", staende });
  } catch (e: any) {
    console.error("[ZENTRALE] aufholen:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/**
 * POST /admin/postmeister/altentwuerfe {schreiben, alle}
 * Die Entwürfe der ersten Fassung prüfen. `alle: true` verwirft sie ALLE, nicht
 * nur die mit Wortverstößen — sie sind samt und sonders ungedeckt (siehe die
 * Begründung an `altentwuerfePruefen`). Die Unterhaltungen werden dabei wieder
 * offen, der Aufhol-Lauf schreibt sie neu.
 */
router.post("/admin/postmeister/altentwuerfe", async (req: Request, res: Response) => {
  try {
    const { altentwuerfePruefen } = await import("../lib/fiaon-postmeister-aufholen");
    res.json({ ok: true, ...(await altentwuerfePruefen(req.body?.schreiben === true, req.body?.alle === true)) });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** GET /admin/postmeister/rueckstand — wie viele warten noch? */
router.get("/admin/postmeister/rueckstand", async (_req: Request, res: Response) => {
  try {
    const { offeneUnterhaltungen } = await import("../lib/fiaon-postmeister-aufholen");
    const offen = await offeneUnterhaltungen(500);
    const jeLage: Record<string, number> = {};
    for (const o of offen) {
      const k = o.gekuendigt_am ? "gekuendigt" : (o.payment_status ?? "ohne Bestellung");
      jeLage[k] = (jeLage[k] || 0) + 1;
    }
    res.json({ ok: true, offen: offen.length, jeLage, aelteste: offen[offen.length - 1]?.empfangen_am ?? null });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

export default router;
