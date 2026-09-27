// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: RATEN AN STORNIERTEN BESTELLUNGEN (27.09.2026, E-245)
//
// Der Fall: Rate 1259 bekam am 26.09.2026 06:48 eine Zahlungserinnerung, zwei
// Tage nach dem anerkannten Widerruf. Bei der Bereinigung (E-244) hingen sechs
// offene Raten an stornierten Bestellungen; archivierte, bezahlte Dubletten
// (MRNUIQYK, MRXAFKI5) wurden bis zuletzt gemahnt. Regel: server/lib/fiaon-raten-storno.ts.
//
//   1. Storno-Wege: bestellungStornieren, Dubletten-Storno (Route), Kündigung Weg 1
//      (auch Probe), Erstattung (Route), Abo-Stopp (Route) → offene Raten storniert,
//      mit storniert_am, festem Grund, Mahnstufe 0, ohne Inkasso-Zuständigen;
//      bezahlte Raten (auch „offen“ mit bezahlt_am) unverändert. Rücknahme der
//      Kündigung holt sie NICHT zurück.
//   2. Erinnerungsläufe: der echte Tageslauf (aboTageslauf, force) mit Make-/Brevo-
//      Attrappe — Mahnung, Vorabinfo und „überfällig“ nur für die bezahlte, nicht
//      stornierte, nicht archivierte Bestellung; offeneRateFuerErinnerung ebenso.
//   3. Zählstellen: eine stornierte Rate macht keinen Inkasso-Fall (Zuständigkeit,
//      Zugriff, Mannschaftslast, Verteilung über das SICHTFELD).
//   4. Quelltext: Rücknahmewege kennen nur 'kuendigung' / 'kuendigung_kulanz', und
//      kein Storno-Grund heißt so.
//
// NUR gegen die lokale Test-DB; kein Netz, keine Mail (Make und Brevo sind Attrappen).
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-raten-storno.ts
// Die eigenen Datensätze (Referenzen FIAON-P245…, Personen PRUEF245-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Make- und Brevo-Attrappe VOR jedem Import ──
const MAKE_URL = "https://make.pruefstand.invalid/e245";
process.env.MAKE_WEBHOOK_URL = MAKE_URL;
process.env.BREVO_API_KEY = "pruef-lokal-kein-schluessel";
type Versand = { weg: "make" | "brevo"; ereignis: string; an: string; referenz: string };
const VERSAND: Versand[] = [];
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u === MAKE_URL) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    VERSAND.push({ weg: "make", ereignis: String(b.event_type ?? ""), an: String(b.email ?? "").toLowerCase(), referenz: String(b.payment_reference ?? b.verwendungszweck ?? "") });
    return new Response("Accepted", { status: 200 });
  }
  if (u.startsWith("https://api.brevo.com/")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    const text = `${b.subject ?? ""} ${b.textContent ?? ""} ${b.htmlContent ?? ""}`;
    VERSAND.push({ weg: "brevo", ereignis: String((b.tags ?? [])[0] ?? ""), an: String(b.to?.[0]?.email ?? "").toLowerCase(), referenz: (text.match(/FIAON-P245[A-Z0-9]+-\d+/) ?? [""])[0] });
    return new Response(JSON.stringify({ messageId: `<e245-${VERSAND.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 700)}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const lies = (p: string) => { try { return readFileSync(new URL(`../${p}`, import.meta.url), "utf8"); } catch { return ""; } };

const { sqlPool } = await import("../server/lib/db-pool");
const { berlinToday } = await import("../server/lib/fiaon-time");
const HEUTE = berlinToday();
const tag = (n: number) => { const [y, m, d] = HEUTE.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

const MARKE = "P245";
const personIds: number[] = [];
const refs: string[] = [];
const AGENT_INKASSO = 924501;
let server: Server | null = null;
const alteEinstellung: Record<string, string | null> = {};
const start = new Date();

/** Eine Person mit einer Paket-Bestellung „pro“ (59,99 €) und den angegebenen Raten. */
async function anlegen(kurz: string, bestellung: Record<string, unknown>, raten: Array<Record<string, unknown>>): Promise<{ ref: string; zahlref: string; personId: number; mail: string; ids: number[] }> {
  const ref = `FIAON-${MARKE}${kurz}-TEST`;
  const zahlref = `FIAON-${MARKE}${kurz}`;
  const mail = `e245-${kurz.toLowerCase()}@beispiel-e245.de`;
  const [p] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email)
    VALUES (${`PRUEF245-${kurz}`}, 'Prüf', ${`E245 ${kurz}`}, ${mail}) RETURNING id`) as any[];
  personIds.push(Number(p.id));
  refs.push(ref);
  const b = { payment_status: "paid", paid_at: `${tag(-40)}T10:00:00Z`, cancelled_at: null, archived_at: null, ...bestellung };
  await sqlPool`
    INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due,
                                    first_name, last_name, email, paid_at, cancelled_at, archived_at)
    VALUES (${ref}, ${p.id}, 'private', 'submitted', 'pro', 'FIAON Pro (Standard)', ${zahlref}, ${String(b.payment_status)}, 59.99,
            'Prüf', ${`E245 ${kurz}`}, ${mail}, ${b.paid_at as any}, ${b.cancelled_at as any}, ${b.archived_at as any})`;
  const ids: number[] = [];
  for (const r of raten) {
    const nr = Number(r.rate_nr);
    const [z] = (await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, mahnstufe, quelle,
                                   inkasso_agent_id, inkasso_wiedervorlage, inkasso_zusage_am, storniert_am, storno_grund, letzte_erinnerung_at)
      VALUES (${ref}, ${nr}, ${`${zahlref}-${nr}`}, 5999, ${String(r.faellig_am)}::date, ${String(r.status ?? "offen")}, ${(r.bezahlt_am ?? null) as any},
              ${Number(r.mahnstufe ?? 0)}, 'pruefstand', ${(r.inkasso_agent_id ?? null) as any}, ${(r.inkasso_wiedervorlage ?? null) as any},
              ${(r.inkasso_zusage_am ?? null) as any}, ${(r.storniert_am ?? null) as any}, ${(r.storno_grund ?? null) as any},
              ${(r.letzte_erinnerung_at ?? null) as any})
      RETURNING id`) as any[];
    ids.push(Number(z.id));
  }
  return { ref, zahlref, personId: Number(p.id), mail, ids };
}
const raten = async (ref: string) => (await sqlPool`
  SELECT id, rate_nr, status, bezahlt_am, storniert_am, storno_grund, mahnstufe, inkasso_agent_id, inkasso_wiedervorlage, inkasso_zusage_am,
         letzte_erinnerung_at, letzter_fehler_at, vorab_am, ueberfaellig_seit, erinnerungen
    FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr`) as any[];
const bestellung = async (ref: string) => ((await sqlPool`SELECT payment_status, cancelled_at, refunded_at, gekuendigt_am, abo_gestoppt_am FROM fiaon_applications WHERE ref = ${ref}`) as any[])[0];
const verlauf = async (ref: string) => ((await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${ref} ORDER BY id`) as any[]).map((z) => String(z.note));
const nr = (rs: any[], n: number) => rs.find((r) => Number(r.rate_nr) === n);
/** Storniert nach der Regel: Status, Zeitpunkt, Grund, Mahnstufe 0, kein Inkasso. */
const sauberStorniert = (r: any, grund: string) => !!r && r.status === "storniert" && !!r.storniert_am && r.storno_grund === grund
  && Number(r.mahnstufe) === 0 && r.inkasso_agent_id == null && r.inkasso_wiedervorlage == null && r.inkasso_zusage_am == null;
const bezahltUnberuehrt = (r: any) => !!r && r.status === "bezahlt" && !!r.bezahlt_am && r.storniert_am == null && r.storno_grund == null;

try {
  // Eigener Inkasso-Mitarbeiter (die Rate soll einem Menschen „gehören“).
  await sqlPool`INSERT INTO fiaon_agents (id, name, email, active, rolle, is_test_account)
                VALUES (${AGENT_INKASSO}, 'Ina E245 Inkasso', 'ina-e245@beispiel-e245.de', TRUE, 'inkasso', FALSE)`;
  const inkassoVoll = { mahnstufe: 2, inkasso_agent_id: AGENT_INKASSO, inkasso_wiedervorlage: tag(2), inkasso_zusage_am: tag(1) };

  // ═══ 1. STORNO-WEGE ═════════════════════════════════════════════════════
  abschnitt("1a. bestellungStornieren (Knopf der Zahlungsübersicht, auch FIAON Global)");
  {
    const S = await anlegen("S1", {}, [
      { rate_nr: 1, faellig_am: tag(-40), status: "bezahlt", bezahlt_am: `${tag(-40)}T10:00:00Z` },
      { rate_nr: 2, faellig_am: tag(-10), ...inkassoVoll },
      { rate_nr: 3, faellig_am: tag(20) },
      // „offen“, aber mit bezahlt_am: Geld ist da — der Storno fasst sie nicht an.
      { rate_nr: 4, faellig_am: tag(50), status: "offen", bezahlt_am: `${tag(-1)}T10:00:00Z` },
    ]);
    const { bestellungStornieren } = await import("../server/routes/fiaon-antrag");
    const erg = await bestellungStornieren({ ref: S.ref }, "Prüfstand E245");
    const rs = await raten(S.ref);
    ok("Bestellung storniert", erg?.ref === S.ref && (await bestellung(S.ref))?.payment_status === "cancelled", erg);
    ok("Rate 1 (bezahlt) unverändert", bezahltUnberuehrt(nr(rs, 1)), nr(rs, 1));
    ok("Rate 2 storniert: storniert_am, Grund bestellung_storniert, Mahnstufe 0, Inkasso gelöst", sauberStorniert(nr(rs, 2), "bestellung_storniert"), nr(rs, 2));
    ok("Rate 3 (künftig) storniert", sauberStorniert(nr(rs, 3), "bestellung_storniert"), nr(rs, 3));
    ok("Rate 4 („offen“ mit bezahlt_am) unberührt", nr(rs, 4)?.status === "offen" && !nr(rs, 4)?.storniert_am, nr(rs, 4));
    ok("Verlauf nennt die stornierten Raten", (await verlauf(S.ref)).some((n) => /Bestellung storniert \(Prüfstand E245\).*2 offene Rate\(n\) storniert/.test(n)), await verlauf(S.ref));
    const { kuendigungZuruecknehmen } = await import("../server/lib/fiaon-kuendigung");
    const zurueck = await kuendigungZuruecknehmen(S.ref, "Prüfstand E245");
    const rs2 = await raten(S.ref);
    ok("kuendigungZuruecknehmen holt Storno-Raten NICHT zurück", zurueck.ratenZurueck === 0 && nr(rs2, 2)?.status === "storniert" && nr(rs2, 3)?.status === "storniert", { zurueck, r2: nr(rs2, 2)?.status });
  }

  // Ab hier über HTTP: die Routen, wie der Knopf sie ruft (ohne Admin-Tor — das sitzt in routes.ts).
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/fiaon", (await import("../server/routes/fiaon-antrag")).default);
  app.use("/api/fiaon", (await import("../server/routes/fiaon-team")).default);
  app.use("/api/fiaon", (await import("../server/routes/fiaon-abo")).default);
  server = app.listen(0);
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fiaon`;
  const post = async (pfad: string, body: unknown) => {
    const r = await echtFetch(`${basis}${pfad}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => null) as any };
  };

  abschnitt("1b. Dubletten-Storno POST /admin/duplicates/cancel-open");
  {
    const D = await anlegen("D1", { payment_status: "claimed_paid", paid_at: null }, [
      { rate_nr: 1, faellig_am: tag(-30), status: "bezahlt", bezahlt_am: `${tag(-30)}T10:00:00Z` },
      { rate_nr: 2, faellig_am: tag(-3), ...inkassoVoll },
    ]);
    const a = await post("/admin/duplicates/cancel-open", { confirmed: true, refs: [D.ref] });
    const rs = await raten(D.ref);
    ok("Route antwortet: eine Bestellung storniert", a.status === 200 && a.json?.cancelled === 1, a);
    ok("Rate 2 storniert (dublette_storniert)", sauberStorniert(nr(rs, 2), "dublette_storniert"), nr(rs, 2));
    ok("Rate 1 (bezahlt) unverändert", bezahltUnberuehrt(nr(rs, 1)), nr(rs, 1));
    ok("Verlauf nennt die Rate", (await verlauf(D.ref)).some((n) => /Dubletten-Bestellung storniert.*1 offene Rate\(n\) storniert/.test(n)), await verlauf(D.ref));
  }

  abschnitt("1c. kuendigungSetzen Weg 1 (schon stornierte Bestellung mit bezahlter Rate 1 — Fall MRLWQ2AD)");
  {
    const K = await anlegen("K1", { payment_status: "cancelled", cancelled_at: `${tag(-20)}T10:00:00Z` }, [
      { rate_nr: 1, faellig_am: tag(-50), status: "bezahlt", bezahlt_am: `${tag(-50)}T10:00:00Z` },
      { rate_nr: 2, faellig_am: tag(-20), ...inkassoVoll },
    ]);
    const { kuendigungSetzen, kuendigungZuruecknehmen } = await import("../server/lib/fiaon-kuendigung");
    const probe = await kuendigungSetzen(K.ref, { quelle: "pruefstand", probe: true } as any);
    const vorher = await raten(K.ref);
    ok("Probe: Weg storno_unbezahlt, nennt 1 Rate, ändert nichts", probe.weg === "storno_unbezahlt" && probe.stornierteRaten === 1 && nr(vorher, 2)?.status === "offen", { probe, r2: nr(vorher, 2)?.status });
    const erg = await kuendigungSetzen(K.ref, { quelle: "pruefstand", grund: "Prüfstand E245" } as any);
    const rs = await raten(K.ref);
    ok("Kündigung: storno_unbezahlt, 1 Rate storniert", erg.ok && erg.weg === "storno_unbezahlt" && erg.stornierteRaten === 1, erg);
    ok("Rate 2 storniert (storno_unbezahlt)", sauberStorniert(nr(rs, 2), "storno_unbezahlt"), nr(rs, 2));
    ok("Rate 1 (bezahlt) unverändert", bezahltUnberuehrt(nr(rs, 1)), nr(rs, 1));
    ok("Verlauf nennt die Rate", (await verlauf(K.ref)).some((n) => /unbezahlt und wurde storniert, 1 offene Rate\(n\) storniert/.test(n)), await verlauf(K.ref));
    const zurueck = await kuendigungZuruecknehmen(K.ref, "Prüfstand E245");
    ok("Rücknahme der Kündigung holt die Rate NICHT zurück", zurueck.ratenZurueck === 0 && nr(await raten(K.ref), 2)?.status === "storniert", zurueck);

    const K2 = await anlegen("K2", { payment_status: "pending_payment", paid_at: null }, []);
    const erg2 = await kuendigungSetzen(K2.ref, { quelle: "pruefstand" } as any);
    ok("Weg 1 ohne Raten: wie bisher, 0 Raten", erg2.ok && erg2.weg === "storno_unbezahlt" && erg2.stornierteRaten === 0 && (await bestellung(K2.ref))?.payment_status === "cancelled", erg2);
  }

  abschnitt("1d. Erstattung POST /admin/payments/:paymentRef/refund");
  {
    const E = await anlegen("E1", {}, [
      { rate_nr: 1, faellig_am: tag(-40), status: "bezahlt", bezahlt_am: `${tag(-40)}T10:00:00Z` },
      { rate_nr: 2, faellig_am: tag(-10), ...inkassoVoll },
      { rate_nr: 3, faellig_am: tag(20) },
    ]);
    const a = await post(`/admin/payments/${E.zahlref}/refund`, { reason: "Prüfstand E245" });
    const rs = await raten(E.ref);
    ok("Route: erstattet", a.status === 200 && a.json?.ok && (await bestellung(E.ref))?.payment_status === "refunded", a);
    ok("Rate 2 und 3 storniert (erstattet)", sauberStorniert(nr(rs, 2), "erstattet") && sauberStorniert(nr(rs, 3), "erstattet"), rs);
    ok("Rate 1 (bezahlt) unverändert — über das Geld entscheidet die Erstattung", bezahltUnberuehrt(nr(rs, 1)), nr(rs, 1));
    ok("Verlauf nennt die Raten", (await verlauf(E.ref)).some((n) => /erstattet, 2 offene Rate\(n\) storniert — Grund: Prüfstand E245/.test(n)), await verlauf(E.ref));
    const b = await post(`/admin/payments/${E.zahlref}/refund`, {});
    ok("zweite Erstattung: 404, nichts doppelt", b.status === 404, b);
  }

  abschnitt("1e. Abo-Stopp POST /admin/abo/:ref/stoppen");
  {
    const A = await anlegen("A1", {}, [
      { rate_nr: 1, faellig_am: tag(-40), status: "bezahlt", bezahlt_am: `${tag(-40)}T10:00:00Z` },
      { rate_nr: 2, faellig_am: tag(-5), ...inkassoVoll },
    ]);
    const a = await post(`/admin/abo/${A.ref}/stoppen`, { grund: "Prüfstand E245" });
    const rs = await raten(A.ref);
    ok("Route: Abo gestoppt", a.status === 200 && a.json?.ok && !!(await bestellung(A.ref))?.abo_gestoppt_am, a);
    ok("Rate 2 storniert MIT storniert_am (abo_gestoppt)", sauberStorniert(nr(rs, 2), "abo_gestoppt"), nr(rs, 2));
    ok("Rate 1 (bezahlt) unverändert", bezahltUnberuehrt(nr(rs, 1)), nr(rs, 1));
  }

  // ═══ 2. ERINNERUNGSLÄUFE ════════════════════════════════════════════════
  abschnitt("2. Der echte Tageslauf (Mahnung, Vorabinfo, überfällig) — Make/Brevo sind Attrappen");
  {
    for (const k of ["abo_stichtag", "abo_motor_enabled", "abo_vorab_tage"]) {
      const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[];
      alteEinstellung[k] = z ? String(z.value) : null;
    }
    await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('abo_stichtag', ${tag(-30)}), ('abo_motor_enabled', '1'), ('abo_vorab_tage', '3')
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    const bez = (t: number) => ({ rate_nr: 1, faellig_am: tag(t), status: "bezahlt", bezahlt_am: `${tag(t)}T10:00:00Z` });
    // Kontrollen: So muss es laufen.
    const R1 = await anlegen("R1", {}, [bez(-31), { rate_nr: 2, faellig_am: tag(-1) }]);
    const R2 = await anlegen("R2", {}, [bez(-27), { rate_nr: 2, faellig_am: tag(3) }]);
    // Darf nichts bekommen:
    const R3 = await anlegen("R3", { payment_status: "cancelled", cancelled_at: `${tag(-2)}T10:00:00Z` }, [bez(-31), { rate_nr: 2, faellig_am: tag(-1) }]);
    const R4 = await anlegen("R4", { archived_at: `${tag(-20)}T10:00:00Z` }, [bez(-31), { rate_nr: 2, faellig_am: tag(-1) }]);
    const R5 = await anlegen("R5", { archived_at: `${tag(-20)}T10:00:00Z` }, [bez(-27), { rate_nr: 2, faellig_am: tag(3) }]);
    const R6 = await anlegen("R6", { payment_status: "cancelled", cancelled_at: `${tag(-2)}T10:00:00Z` }, [bez(-27), { rate_nr: 2, faellig_am: tag(3) }]);
    const R7 = await anlegen("R7", { cancelled_at: `${tag(-2)}T10:00:00Z` }, [bez(-31), { rate_nr: 2, faellig_am: tag(-1) }]);
    const R8 = await anlegen("R8", { payment_status: "refunded" }, [bez(-31), { rate_nr: 2, faellig_am: tag(-1) }]);

    const abo = await import("../server/routes/fiaon-abo");
    ok("offeneRateFuerErinnerung: Kontrolle findet Rate 2", (await abo.offeneRateFuerErinnerung(R1.personId))?.rate_nr === 2);
    for (const [name, x] of [["storniert", R3], ["archiviert", R4], ["bezahlt+cancelled_at", R7], ["erstattet", R8]] as const) {
      const r = await abo.offeneRateFuerErinnerung(x.personId);
      ok(`offeneRateFuerErinnerung: ${name} → keine Rate (Knopf „Erinnerung senden“ sendet nichts)`, r == null, r && { ref: r.ref, nr: r.rate_nr });
    }

    const lauf = await abo.aboTageslauf({ force: true });
    console.log(`  (Tageslauf: ${lauf.meldung})`);
    const an = (x: { mail: string }) => VERSAND.filter((v) => v.an === x.mail);
    ok("Kontrolle R1: Mahnung raus, Stufe 1, überfällig gestellt",
      an(R1).some((v) => v.ereignis === "abo_payment_reminder") && Number(nr(await raten(R1.ref), 2)?.mahnstufe) === 1 && !!nr(await raten(R1.ref), 2)?.ueberfaellig_seit,
      { versand: an(R1), r2: nr(await raten(R1.ref), 2) });
    ok("Kontrolle R2: Vorabinfo raus (vorab_am), Stufe bleibt 0",
      an(R2).length === 1 && !!nr(await raten(R2.ref), 2)?.vorab_am && Number(nr(await raten(R2.ref), 2)?.mahnstufe) === 0,
      { versand: an(R2), r2: nr(await raten(R2.ref), 2) });
    for (const [name, x] of [["R3 stornierte Bestellung", R3], ["R4 archivierte bezahlte Dublette", R4], ["R7 bezahlt, aber cancelled_at", R7], ["R8 erstattet", R8]] as const) {
      const r2 = nr(await raten(x.ref), 2);
      ok(`${name}: keine Mahnung, kein Versuch, nicht überfällig gestellt`,
        an(x).length === 0 && r2?.letzte_erinnerung_at == null && r2?.letzter_fehler_at == null && Number(r2?.erinnerungen) === 0 && r2?.ueberfaellig_seit == null,
        { versand: an(x), r2 });
    }
    for (const [name, x] of [["R5 archiviert", R5], ["R6 storniert", R6]] as const) {
      ok(`${name}: keine Vorabinfo`, an(x).length === 0 && nr(await raten(x.ref), 2)?.vorab_am == null, { versand: an(x), r2: nr(await raten(x.ref), 2) });
    }
    ok("keine Mail an irgendeine Adresse außerhalb der Kontrollen", VERSAND.every((v) => v.an === R1.mail || v.an === R2.mail), VERSAND);
  }

  // ═══ 3. ZÄHLSTELLEN ═════════════════════════════════════════════════════
  abschnitt("3. Eine stornierte Rate ist kein Inkasso-Fall");
  {
    const ink = await import("../server/lib/fiaon-inkasso");
    // Die Last VOR der stornierten Rate — der Tageslauf oben hat Ina schon echte Fälle zugeteilt.
    const lastVorher = (await ink.inkassoMannschaft()).find((m) => m.id === AGENT_INKASSO)?.offen ?? -1;
    // Altbestand: storniert (z. B. Kündigung vor E-245), aber mit Mahnstufe und Inkasso-Zuständigem.
    const Z = await anlegen("Z1", {}, [
      { rate_nr: 1, faellig_am: tag(-60), status: "bezahlt", bezahlt_am: `${tag(-60)}T10:00:00Z` },
      { rate_nr: 2, faellig_am: tag(-30), status: "storniert", storniert_am: `${tag(-5)}T10:00:00Z`, storno_grund: "kuendigung_kulanz", ...inkassoVoll },
      { rate_nr: 3, faellig_am: tag(-2), status: "storniert", storniert_am: `${tag(-5)}T10:00:00Z`, storno_grund: "kuendigung_kulanz" },
    ]);
    const { zustaendigeRolle } = await import("../server/lib/fiaon-zustaendigkeit");
    const { darfAnKunde } = await import("../server/lib/fiaon-kundenzugriff");
    const rolle = await zustaendigeRolle(Z.personId);
    ok("Zuständigkeit: nicht Inkasso", rolle?.rolle !== "inkasso", rolle);
    ok("Zugriff Inkasso: nein (keine offene Rate)", (await darfAnKunde(AGENT_INKASSO, "inkasso", Z.personId)) === false);
    const mannschaft = await ink.inkassoMannschaft();
    ok("Mannschaftslast: die stornierte Rate zählt nicht dazu", lastVorher >= 0 && mannschaft.find((m) => m.id === AGENT_INKASSO)?.offen === lastVorher,
      { vorher: lastVorher, nachher: mannschaft.find((m) => m.id === AGENT_INKASSO) });
    const vert = await ink.inkassoVerteilen({ schreiben: false });
    ok("Verteilung (SICHTFELD): stornierte Rate 3 wird niemandem vorgeschlagen", !vert.vorschlag.some((v) => v.ref === Z.ref), vert.vorschlag.filter((v) => v.ref === Z.ref));
  }

  // ═══ 4. QUELLTEXT ═══════════════════════════════════════════════════════
  abschnitt("4. Quelltext: Rücknahmewege und Storno-Gründe");
  {
    const helfer = lies("server/lib/fiaon-raten-storno.ts");
    const gruende = [...(helfer.match(/export type RatenStornoGrund =([\s\S]*?);/)?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    ok("Storno-Gründe fest (5), keiner heißt kuendigung/kuendigung_kulanz", gruende.length === 5 && !gruende.includes("kuendigung") && !gruende.includes("kuendigung_kulanz"), gruende);
    ok("kuendigungZuruecknehmen holt nur storno_grund = 'kuendigung' zurück", /storno_grund = 'kuendigung' AND status = 'storniert'/.test(lies("server/lib/fiaon-kuendigung.ts")));
    ok("Telefonkartei holt nur storno_grund = 'kuendigung_kulanz' zurück", /status = 'storniert' AND storno_grund = 'kuendigung_kulanz'/.test(lies("server/lib/fiaon-telefonkartei.ts")));
    const abo = lies("server/routes/fiaon-abo.ts");
    ok("Abo-Stopp setzt nirgends mehr status 'storniert' ohne storniert_am", !/SET status = 'storniert', notiz/.test(abo));
  }
} catch (e) {
  rot++; fehler.push(`Ausnahme: ${String((e as any)?.message ?? e)}`);
  console.error("AUSNAHME:", e);
} finally {
  abschnitt("Aufräumen");
  if (server) await new Promise((r) => server!.close(() => r(null)));
  const rateIds = ((await sqlPool`SELECT id FROM fiaon_abo_raten WHERE ref = ANY(${refs})`) as any[]).map((z) => Number(z.id));
  await sqlPool`DELETE FROM fiaon_raten_arbeit WHERE rate_id = ANY(${rateIds}) OR ref = ANY(${refs})`;
  await sqlPool`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`;
  await sqlPool`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${personIds}) OR LOWER(COALESCE(empfaenger, '')) LIKE '%@beispiel-e245.de'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs}) OR person_id = ANY(${personIds})`;
  await sqlPool`DELETE FROM fiaon_commissions WHERE ref = ANY(${refs})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE created_at >= ${start} AND (schluessel LIKE ${`%${MARKE}%`} OR text LIKE ${`%${MARKE}%`} OR titel LIKE ${`%${MARKE}%`})`;
  await sqlPool`DELETE FROM fiaon_diagnostics WHERE created_at >= ${start} AND (message LIKE ${`%${MARKE}%`} OR message ILIKE '%beispiel-e245%')`;
  await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${refs})`;
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${personIds})`;
  await sqlPool`DELETE FROM fiaon_agents WHERE id = ${AGENT_INKASSO}`;
  for (const [k, v] of Object.entries(alteEinstellung)) {
    if (v == null) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${k}`;
    else await sqlPool`UPDATE fiaon_settings SET value = ${v} WHERE key = ${k}`;
  }
  const [rest] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`FIAON-${MARKE}%`})::int
         + (SELECT COUNT(*) FROM fiaon_abo_raten WHERE ref LIKE ${`FIAON-${MARKE}%`})::int
         + (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE 'PRUEF245-%')::int
         + (SELECT COUNT(*) FROM fiaon_contact_log WHERE ref LIKE ${`FIAON-${MARKE}%`})::int
         + (SELECT COUNT(*) FROM fiaon_agents WHERE id = ${AGENT_INKASSO})::int AS n`) as any[];
  ok("Aufräumen vollständig (keine P245-Zeilen mehr)", Number(rest.n) === 0, rest);
  ok("kein Netzaufruf außer den Attrappen", FREMD.length === 0, FREMD);
  console.log(`\n${rot ? "ROT" : "GRÜN"}: ${gruen} bestanden, ${rot} fehlgeschlagen${rot ? ` — ${fehler.join(" · ")}` : ""}`);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(rot ? 1 : 0);
}
