// ═══════════════════════════════════════════════════════════════════════════
// NACHHOL-LAUF FÜR UNVERBUCHTE BANKEINGÄNGE (01.10.2026)
//
// Justins Go vom 01.10.2026: „Raten live stellen, aber NICHT die Mitarbeiter-
// Provision buchen, die buche ich am 05.10."
//
// ZWEI SCHRITTE, nie in einem:
//
// 1. VORSCHAU (Vorgabe, schreibt nichts):
//      npx tsx scripts/nachholen-bankeingaenge.ts --seit=2026-09-24 --json=<vorschau.json>
//    Liest die Produktion über eine SCHREIBGESCHÜTZTE Verbindung
//    (default_transaction_read_only=on, Probe vor dem Lesen, statement_timeout 60 s)
//    und fährt jeden unverbuchten Eingang durch liveVerbuchen(..., { trocken: true })
//    — also durch DIESELBE Regel, die nach dem Deploy bucht. Dazu je Eingang:
//    welche Provision entstünde (bei Schalter AUS: vorgemerkt, nicht gebucht) und
//    welche Mails der Kunde bekäme. Unklares (Betrag weicht ab, Referenz unbekannt,
//    Kündigung, Deckung unklar) bekommt buchen=false — das bleibt Handarbeit.
//    DATABASE_URL_EXTERN aus der Umgebung oder aus ./.env.
//
// 2. AUSFÜHREN (erst nach dem Deploy dieses Stands und nach Prüfung der Vorschau):
//      FIAON_ADMIN_CODE=… npx tsx scripts/nachholen-bankeingaenge.ts --ausfuehren \
//        --freigabe=<vorschau.json> --basis=https://fiaon.com --protokoll=<protokoll.json>
//    Bucht NUR die Einträge mit buchen=true aus der Freigabe-Datei, einen nach dem
//    anderen, über die Produktions-Route POST /api/fiaon/admin/zahlungen/
//    bankeingang-nachholen — die ruft liveVerbuchen, also alsBezahltBuchen bzw.
//    rateBezahltBuchen: der EINE Buchungsweg, mit Bestätigungsmail, Ratenkette,
//    Provisionsschalter, Rückwärtssperre. Vor jeder Buchung fragt das Skript den
//    Server trocken; weicht seine Antwort (Regel, Ziel, Rate) von der Freigabe ab,
//    bricht es ab, ohne zu buchen. Nach jedem Eingang wird das Protokoll
//    geschrieben — ein Abbruch hinterlässt nie einen unprotokollierten Zustand.
//    Zugang: FIAON_ADMIN_CODE (Admin-Code → Cookie) oder ADMIN_TOKEN (Kopfzeile).
//
// Eine Datenbank-Transaktion über eine ganze Buchung gibt es nicht — alsBezahlt-
// Buchen/rateBezahltBuchen schreiben über den Pool (Mail, Ratenkette, Provision
// sind eigene Schritte). Dafür ist jeder Schritt einzeln idempotent (Status-
// Prüfung, „Bankeingang <txn>" in der Ratennotiz, applied im Bankbuch,
// confirmed_email_sent_at) — ein zweiter Lauf bucht nichts doppelt.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from "fs";

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args.set(m[1], m[2] ?? "1");
}
const ausfuehren = args.has("ausfuehren");
const ueberzahlungBisCents = Math.max(0, Math.min(100, Number(args.get("ueberzahlung-bis") ?? 100)));

// ── Gemeinsames Format von Vorschau und Freigabe ────────────────────────────
interface Zeile {
  id: number;
  txnId: string;
  datum: string;
  betragCents: number;
  zweckRef: string | null;
  regel: string | null;
  ziel: string | null;
  bestellung: string | null;
  rateId: number | null;
  rateNr: number | null;
  ergebnis: string;
  buchen: boolean;
  deckung: string | null;
  provision: string[];
  mails: string[];
  unklar: string | null;
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

// ═══════════════════════════════ VORSCHAU ═══════════════════════════════════
async function vorschau(): Promise<void> {
  let extern = String(process.env.DATABASE_URL_EXTERN || "").trim();
  if (!extern && existsSync(".env")) {
    const m = readFileSync(".env", "utf8").match(/^DATABASE_URL_EXTERN=(.+)$/m);
    if (m) extern = m[1].trim().replace(/^["']|["']$/g, "");
  }
  if (!extern) throw new Error("DATABASE_URL_EXTERN fehlt (Umgebung oder ./.env).");
  // Schreibschutz + Zeitlimits (E-254) als Verbindungsparameter — postgres.js reicht
  // unbekannte URL-Parameter als Startparameter an den Server weiter.
  const u = new URL(extern);
  u.searchParams.set("default_transaction_read_only", "on");
  u.searchParams.set("statement_timeout", "60000");
  u.searchParams.set("lock_timeout", "5000");
  u.searchParams.set("idle_in_transaction_session_timeout", "60000");
  u.searchParams.set("application_name", "nachholen-vorschau");
  process.env.DATABASE_URL = u.toString();
  process.env.CRONS = "aus";
  process.env.WISE_AUS = "1";
  process.env.NODE_ENV = "development";
  process.env.POOL_MAX = "2"; // eine Vorschau braucht keine zwölf Produktionsverbindungen

  const { sqlPool } = await import("../server/lib/db-pool");
  const [ro] = (await sqlPool`SHOW default_transaction_read_only`) as any[];
  if (ro?.default_transaction_read_only !== "on") throw new Error("Verbindung ist NICHT schreibgeschützt — Abbruch.");
  let gesperrt = false;
  try { await sqlPool`UPDATE fiaon_bank_txns SET note = note WHERE false`; } catch (e: any) { gesperrt = /read-only/.test(String(e?.message)); }
  if (!gesperrt) throw new Error("Schreibprobe ging durch — Abbruch.");
  console.log("Verbindung: schreibgeschützt (SHOW + Schreibprobe abgewiesen).");

  const { liveVerbuchen, refErkennen } = await import("../server/routes/fiaon-wise");
  const { berlinDatum } = await import("../server/lib/fiaon-time");
  const agent = await import("../server/routes/fiaon-agent");
  const { istGlobalPaket } = await import("../shared/fiaon-pakete");
  const { BUENDEL_WUNSCH_VERMERK } = await import("../shared/fiaon-auskunft-buendel");

  const [sch] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'provision_automatik'`) as any[];
  const automatikAn = String(sch?.value ?? "aus") === "an";
  const wort = automatikAn ? "GEBUCHT" : "vorgemerkt";
  console.log(`Provisionsautomatik: ${automatikAn ? "AN — Provision würde GEBUCHT" : "AUS — Provision wird nur vorgemerkt"}.`);
  const [vw] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_versandweg'`) as any[];
  const versandweg = String(vw?.value ?? "make");

  const ids = String(args.get("ids") || "").split(",").map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
  const seit = String(args.get("seit") || "2026-09-24");
  const zeilen = (ids.length
    ? await sqlPool`SELECT id, txn_id, booked_at, amount_cents, reference_raw, extracted_ref, note, applied FROM fiaon_bank_txns WHERE id = ANY(${ids}) ORDER BY booked_at, id`
    : await sqlPool`SELECT id, txn_id, booked_at, amount_cents, reference_raw, extracted_ref, note, applied FROM fiaon_bank_txns
                     WHERE NOT applied AND amount_cents > 0 AND booked_at >= ${seit}::date ORDER BY booked_at, id`) as any[];

  const settings = await agent.getSettings();
  const aus: Zeile[] = [];
  for (const z of zeilen) {
    const datum = z.booked_at ? berlinDatum(new Date(z.booked_at)) : "";
    const ref = refErkennen(String(z.reference_raw || "")) || (z.extracted_ref ? String(z.extracted_ref) : null);
    const cents = Number(z.amount_cents);
    const zeile: Zeile = {
      id: Number(z.id), txnId: String(z.txn_id), datum, betragCents: cents, zweckRef: ref,
      regel: null, ziel: null, bestellung: null, rateId: null, rateNr: null, ergebnis: "", buchen: false,
      deckung: null, provision: [], mails: [], unklar: null,
    };
    if (z.applied) { zeile.ergebnis = "schon verbucht"; aus.push(zeile); continue; }
    if (String(z.note || "").startsWith("Airwallex: Geld ist UNTERWEGS")) { zeile.ergebnis = "Geld noch unterwegs"; aus.push(zeile); continue; }
    const erg = await liveVerbuchen(String(z.txn_id), ref, cents, datum, { trocken: true, ueberzahlungBisCents, anlass: "Nachhol-Lauf" });
    zeile.regel = erg.regel ?? null;
    zeile.ziel = erg.ziel ?? null;
    zeile.bestellung = erg.bestellung ?? null;
    zeile.rateId = erg.rateId ?? null;
    zeile.rateNr = erg.rateNr ?? null;
    zeile.ergebnis = erg.grund;
    zeile.deckung = erg.deckung?.text ?? null;
    zeile.buchen = erg.grund.startsWith("würde buchen");
    if (!zeile.buchen) zeile.unklar = erg.grund;

    if (zeile.buchen && zeile.bestellung) {
      try {
        const [app] = (await sqlPool`
          SELECT ref, person_id, email, contact_email, billing_email, created_at, assigned_agent_id, pack_key, pack_name,
                 payment_reference, amount_due, confirmed_email_sent_at
            FROM fiaon_applications WHERE ref = ${zeile.bestellung} LIMIT 1`) as any[];
        // ── Provision: dieselben Bausteine wie abschlussNachZahlung / onRatePaid / praemieBuchen ──
        const provisionFuer = async (agentId: number, baseCents: number, art: "Abschluss" | "Rate", zahlRef: string) => {
          const [ag] = (await sqlPool`SELECT id, name, commission_rate_bp, recruited_by, override_rate_bp FROM fiaon_agents WHERE id = ${agentId}`) as any[];
          if (!ag) return [`keine (Agent ${agentId} fehlt)`];
          const [schon] = (await sqlPool`
            SELECT id FROM fiaon_commissions WHERE kind IN ('own','override') AND amount_cents > 0 AND status <> 'storniert'
               AND ${art === "Rate" ? sqlPool`payment_reference = ${zahlRef}` : sqlPool`ref = ${app.ref} AND (payment_reference IS NULL OR payment_reference = ${app.payment_reference})`}`) as any[];
          if (schon) return ["keine (schon gebucht)"];
          const global = art === "Abschluss" && istGlobalPaket(app.pack_key);
          const status = agent.partnerStatusFor(await agent.ownRevenueCents(Number(ag.id)), agent.partnerThresholds(settings));
          const bp = global ? Math.round((Number(settings.global_provision_prozent ?? 25) || 25) * 100) : agent.agentRateBp(ag, settings) + status.bonusBp;
          const own = agent.commissionCents(baseCents, bp);
          const zeilenP = [`Agent ${ag.id}: ${eur(own)} (${bp / 100} % von ${eur(baseCents)}, own) — ${wort}`];
          if (ag.recruited_by) {
            const obp = ag.override_rate_bp ?? Number(settings.partner_override_bp) ?? 500;
            const oc = agent.commissionCents(baseCents, obp);
            if (oc > 0) zeilenP.push(`Werber Agent ${ag.recruited_by}: ${eur(oc)} (${obp / 100} %, override) — ${wort}`);
          }
          return zeilenP;
        };
        if (zeile.regel === "erstzahlung") {
          const anspruch = await agent.ermittleProvisionsAnspruch(app);
          zeile.provision = anspruch.agentId
            ? await provisionFuer(Number(anspruch.agentId), agent.eurToCents(app.amount_due), "Abschluss", String(app.payment_reference))
            : ["keine (Direktzahler — kein dokumentierter Kontakt vor der Zahlung)"];
          const mailDa = !!(app.email || app.contact_email || app.billing_email);
          if (istGlobalPaket(app.pack_key)) zeile.mails.push("global_start (Firmenauftrag, nach der Start-Aufgabe)");
          else if (!app.confirmed_email_sent_at && mailDa) zeile.mails.push(`payment_confirmed „Willkommen & Zugang“ mit Login-Link (Versandweg ${versandweg})`);
          else if (app.confirmed_email_sent_at) zeile.mails.push("keine Zugangsmail (schon verschickt)");
          else {
            // sendPaymentConfirmedOnce liest nur die Adressen an der BESTELLUNG. Steht die Adresse nur an
            // der Person, geht automatisch nichts raus — dann den Nachversand aus der Akte nennen.
            const [pm] = (await sqlPool`SELECT (COALESCE(primary_email, '') <> '') AS da FROM fiaon_persons WHERE id = ${app.person_id}`.catch(() => [])) as any[];
            zeile.mails.push(pm?.da
              ? `KEINE Zugangsmail automatisch (Bestellung ohne Adresse, Person hat eine) → nach der Buchung von Hand: GET /api/fiaon/admin/mail/${app.person_id}/payment_confirmed/vorschau, dann POST /api/fiaon/admin/mail/${app.person_id}/payment_confirmed`
              : "keine Zugangsmail (weder Bestellung noch Person haben eine Adresse)");
            if (pm?.da) zeile.unklar = "Zugangsmail nur per Nachversand (Adresse fehlt an der Bestellung)";
          }
          const [karte] = (await sqlPool`SELECT 1 AS da FROM fiaon_konto_karte WHERE person_id = ${app.person_id} AND kanal <> 'gemeldet' LIMIT 1`.catch(() => [])) as any[];
          if (!istGlobalPaket(app.pack_key)) {
            zeile.mails.push(karte ? "keine Karten-Einladung (schon eingeladen)"
              : "konto_karte_einladung „Ihr Link zur Karte ist da“ — Takt karten_einladungen (≤ 5 Min.), falls Antrag vollständig und keine Sperre");
          }
          const [bund] = (await sqlPool`SELECT 1 AS da FROM fiaon_contact_log WHERE ref = ${app.ref} AND voided_at IS NULL AND note LIKE ${`${BUENDEL_WUNSCH_VERMERK}%`} LIMIT 1`) as any[];
          if (bund) zeile.mails.push("Bündel: Auskunft-Bestellung zum Kundenpreis + deren Zahlungsdaten-Mail");
        } else if (zeile.rateId) {
          const [r] = (await sqlPool`SELECT id, rate_nr, zahlungsreferenz, betrag_cents FROM fiaon_abo_raten WHERE id = ${zeile.rateId}`) as any[];
          zeile.provision = Number(r.rate_nr) >= 2 && app.assigned_agent_id
            ? await provisionFuer(Number(app.assigned_agent_id), Number(r.betrag_cents), "Rate", String(r.zahlungsreferenz))
            : [Number(r.rate_nr) >= 2 ? "keine (kein zuständiger Betreuer)" : "keine (Rate 1 = Abschluss)"];
          // Inkasso-Prämie — dieselben Tore wie praemieBuchen (fiaon-inkasso.ts)
          const [arb] = (await sqlPool`
            SELECT w.agent_id, a.inkasso_praemie_art, a.inkasso_praemie_wert, a.verguetung_bestaetigt_am, a.active
              FROM fiaon_raten_arbeit w LEFT JOIN fiaon_agents a ON a.id = w.agent_id
             WHERE w.rate_id = ${r.id} AND w.ergebnis IN ('zahlt_am', 'ueberwiesen_beleg', 'nicht_erreicht')
             ORDER BY w.created_at DESC LIMIT 1`.catch(() => [])) as any[];
          if (arb && arb.active && arb.verguetung_bestaetigt_am) {
            const { VERGUETUNG_VORGABE } = await import("../server/lib/fiaon-inkasso");
            const art = String(arb.inkasso_praemie_art || VERGUETUNG_VORGABE.praemieArt);
            const wert = Number(arb.inkasso_praemie_wert ?? VERGUETUNG_VORGABE.praemieWert);
            const c = art === "prozent" ? Math.round((Number(r.betrag_cents) * wert) / 10_000) : wert;
            if (c > 0) zeile.provision.push(`Inkasso-Prämie Agent ${arb.agent_id}: ${eur(c)} — ${wort}`);
          }
          zeile.mails.push(Number(r.rate_nr) % 12 === 0 ? "abo_verlaengerung_frage (Rate 12)" : "keine (Ratenbuchung schickt keine Mail; Mahnungen zu dieser Rate enden)");
        }
      } catch (e: any) {
        zeile.provision.push(`nicht berechenbar: ${String(e?.message || e).slice(0, 120)}`);
      }
    }
    aus.push(zeile);
  }

  // ── Ausgabe ────────────────────────────────────────────────────────────
  console.log("");
  for (const z of aus) {
    console.log(`${z.buchen ? "BUCHEN " : "LIEGT  "} #${z.id} ${z.datum} ${eur(z.betragCents).padStart(9)}  ${String(z.zweckRef ?? "—").padEnd(16)} → ${z.regel ?? "—"} ${z.ziel ?? ""}`);
    console.log(`         ${z.ergebnis}`);
    if (z.deckung) console.log(`         ${z.deckung}`);
    for (const p of z.provision) console.log(`         Provision: ${p}`);
    for (const m of z.mails) console.log(`         Kunde: ${m}`);
  }
  const b = aus.filter((z) => z.buchen);
  console.log(`\n${aus.length} Eingänge, davon ${b.length} buchbar (${eur(b.reduce((s, z) => s + z.betragCents, 0))}), ${aus.length - b.length} bleiben Handarbeit.`);
  const ziel = args.get("json");
  if (ziel) {
    writeFileSync(ziel, JSON.stringify({ erstellt: new Date().toISOString(), automatikAn, ueberzahlungBisCents, zeilen: aus }, null, 1));
    console.log(`Vorschau gespeichert: ${ziel} (dient als --freigabe für --ausfuehren).`);
  }
  await sqlPool.end({ timeout: 5 });
}

// ═══════════════════════════════ AUSFÜHREN ══════════════════════════════════
async function ausfuehrenLauf(): Promise<void> {
  const freigabePfad = args.get("freigabe");
  if (!freigabePfad || !existsSync(freigabePfad)) throw new Error("--freigabe=<vorschau.json> fehlt.");
  const freigabe = JSON.parse(readFileSync(freigabePfad, "utf8")) as { zeilen: Zeile[]; ueberzahlungBisCents?: number };
  const basis = String(args.get("basis") || "https://fiaon.com").replace(/\/+$/, "");
  const protokollPfad = String(args.get("protokoll") || `nachholen-protokoll-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const toleranz = Math.max(0, Math.min(100, Number(freigabe.ueberzahlungBisCents ?? ueberzahlungBisCents)));

  // Zugang: Kopfzeilen-Token (nur wenn ADMIN_TOKEN gesetzt) oder Admin-Code → Cookie.
  const kopf: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.ADMIN_TOKEN) kopf["x-admin-token"] = process.env.ADMIN_TOKEN;
  else if (process.env.FIAON_ADMIN_CODE) {
    const r = await fetch(`${basis}/api/fiaon/zugang/oeffnen`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: process.env.FIAON_ADMIN_CODE }),
    });
    const keks = (r.headers.get("set-cookie") || "").split(";")[0];
    if (!r.ok || !keks) throw new Error(`Admin-Zugang abgelehnt (HTTP ${r.status}).`);
    kopf.cookie = keks;
  } else throw new Error("FIAON_ADMIN_CODE oder ADMIN_TOKEN fehlt.");

  const rufe = async (id: number, trocken: boolean) => {
    const r = await fetch(`${basis}/api/fiaon/admin/zahlungen/bankeingang-nachholen`, {
      method: "POST", headers: kopf, body: JSON.stringify({ id, trocken, ueberzahlungBisCents: toleranz }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}, keine JSON-Antwort` }));
    return { status: r.status, ...j } as any;
  };

  const auftrag = freigabe.zeilen.filter((z) => z.buchen);
  const protokoll: any = { start: new Date().toISOString(), basis, freigabe: freigabePfad, toleranz, schritte: [] as any[] };
  const sichern = () => writeFileSync(protokollPfad, JSON.stringify(protokoll, null, 1));
  console.log(`${auftrag.length} freigegebene Buchungen. Protokoll: ${protokollPfad}`);
  sichern();

  for (const z of auftrag) {
    const schritt: any = { id: z.id, txnId: z.txnId, betragCents: z.betragCents, erwartet: { regel: z.regel, ziel: z.ziel, rateId: z.rateId } };
    protokoll.schritte.push(schritt);
    // 1) Trocken fragen: sagt der Server heute dasselbe wie die geprüfte Vorschau?
    const t = await rufe(z.id, true);
    schritt.trocken = { status: t.status, grund: t.ergebnis?.grund ?? t.error, regel: t.ergebnis?.regel, ziel: t.ergebnis?.ziel, rateId: t.ergebnis?.rateId ?? null };
    const gleich = t.ok && String(t.ergebnis?.grund || "").startsWith("würde buchen")
      && t.ergebnis?.regel === z.regel && t.ergebnis?.ziel === z.ziel && (t.ergebnis?.rateId ?? null) === (z.rateId ?? null);
    if (!gleich) {
      schritt.ergebnis = "ABBRUCH — Server weicht von der Freigabe ab, nichts gebucht";
      sichern();
      console.error(`#${z.id}: Server sagt „${schritt.trocken.grund}“ (${schritt.trocken.regel} ${schritt.trocken.ziel}) statt ${z.regel} ${z.ziel} — Abbruch.`);
      process.exitCode = 2;
      break;
    }
    // 2) Buchen — ein Eingang, ein Aufruf.
    const s = await rufe(z.id, false);
    schritt.scharf = { status: s.status, gebucht: !!s.ergebnis?.gebucht, grund: s.ergebnis?.grund ?? s.error, bankbuch: s.bankbuch ?? null, am: new Date().toISOString() };
    schritt.ergebnis = s.ergebnis?.gebucht ? "GEBUCHT" : "NICHT GEBUCHT";
    sichern();
    console.log(`#${z.id} ${z.txnId.slice(0, 16)} ${eur(z.betragCents)} → ${z.ziel}: ${schritt.ergebnis} (${schritt.scharf.grund})`);
    if (!s.ergebnis?.gebucht) { console.error("Unerwartet nicht gebucht — Abbruch, Rest bleibt liegen."); process.exitCode = 3; break; }
  }
  protokoll.ende = new Date().toISOString();
  sichern();
}

(ausfuehren ? ausfuehrenLauf() : vorschau())
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error("FEHLER:", e?.message || e); process.exit(1); });
