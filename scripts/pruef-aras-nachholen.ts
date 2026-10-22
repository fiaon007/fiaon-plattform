// Prüfstand E-408 (22.10.2026): ARAS holt EINMAL nach, was sie vor e09a0ffe angekündigt, aber nicht getan hat.
// Teil A rein (ohne DB), Teil B gegen die lokale Prüf-DB — nie gegen die Produktion, nie ein echter Versand (Werkzeug-Attrappe):
//   DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_nachholen?sslmode=require' \
//   DATABASE_URL_EXTERN='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_nachholen?sslmode=require' \
//   npx tsx scripts/pruef-aras-nachholen.ts
// Ohne lokale DB (DATABASE_URL zeigt woanders hin) läuft nur Teil A.
import type { NachholZeile } from "../server/lib/fiaon-aras-nachholen";

let gut = 0, schlecht = 0;
const ok = (was: string, b: unknown, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };
const titel = (t: string) => console.log(`\n── ${t}`);

async function main() {
  const N = await import("../server/lib/fiaon-aras-nachholen");
  const leer: NachholZeile = {
    arasAnrufId: 1, callId: 1, personId: 1, ref: "R", nummer: "+491700000001", planId: 1, rateId: 1, spielart: "rate", am: "2026-10-21T12:00:00Z",
    zusammenfassung: null, notiz: null, transkript: null, werkzeugeOk: [], rateOffenFaellig: true, rateWaSeitdem: false, arasAus: false,
  };
  const z = (e: Partial<NachholZeile>): NachholZeile => ({ ...leer, ...e });
  const arten = (e: Partial<NachholZeile>) => N.nachholFaelle(z(e)).map((f) => f.art).join(",");

  titel("A. Erkennen (Sätze aus den echten Gesprächen, ohne Namen)");
  const ankuendigungAras = [
    "I schick Ihnen gleich die Rechnung aufs Handy, dann habens es gleich griffbereit.",
    "I schick Ihnen glei die Rechnung zu, seins so gut und zahlens ma die ein, bitte.",
    "i schick Ihnen die Rechnung schnell per WhatsApp rüber, seins so guat und zahlens ma die ein, bitte.",
    "Der Link kommt gleich per WhatsApp an.",
  ];
  for (const s of ankuendigungAras) ok(`ARAS kündigt an: „${s.slice(0, 50)}…“ → Link`, arten({ transkript: [{ wer: "aras", text: s }] }) === "link");
  const ankuendigungZusammen = [
    "Der KI-Assistent meldete sich bei der Kundin wegen einer offenen Rate. Er kündigte an, ihr einen Link zu schicken.",
    "Er kündigte an, die Rechnung per WhatsApp zu senden und fragte, ob die Zahlung heute möglich sei.",
    "Abschließend wurde vereinbart, dass der Zahlungslink per WhatsApp gesendet wird.",
    "Herr X erhält die Rechnung per WhatsApp und plant die Überweisung für nächsten Dienstag.",
  ];
  for (const s of ankuendigungZusammen) ok(`Zusammenfassung: „${s.slice(0, 50)}…“ → Link`, arten({ zusammenfassung: s }) === "link");
  ok("ohne Ankündigung → nichts", arten({ zusammenfassung: "Der Kunde war in einer Besprechung und bat um einen späteren Anruf." }) === "");
  ok("eine FRAGE („… passt das?“) allein ist keine Zusage → nichts", arten({ transkript: [{ wer: "aras", text: "Ich schick Ihnen den Link gleich aufs Handy — passt das?" }] }) === "");

  titel("A. Was NICHT nachgeholt wird");
  const angekuendigt = { zusammenfassung: "Er kündigte an, ihr einen Link zu schicken." };
  ok("im Gespräch schon geschickt (zahlungslink_senden ok) → nichts", arten({ ...angekuendigt, werkzeugeOk: ["zahlungslink_senden"] }) === "");
  ok("Rate inzwischen bezahlt/storniert/nicht mehr fällig → nichts", arten({ ...angekuendigt, rateOffenFaellig: false }) === "");
  ok("Raten-WhatsApp kam seitdem auf anderem Weg → nichts (kein Doppel)", arten({ ...angekuendigt, rateWaSeitdem: true }) === "");
  ok("„Aras für diesen Kunden aus“ → kein Link", arten({ ...angekuendigt, arasAus: true }) === "");

  titel("A. Betrug/Anzeige und Karte");
  const betrug = { zusammenfassung: "Der Kunde bestätigt, die Rechnung erhalten zu haben. Er teilt mit, eine Betrugsanzeige erstattet zu haben. Aras kündigt an, die Rechnung per WhatsApp zu senden." };
  ok("Betrugsanzeige → NUR Aufgabe für Justin, nie ein Link", arten(betrug) === "aufgabe_betrug");
  ok("Betrug, Aufgabe lief schon → nichts", arten({ ...betrug, werkzeugeOk: ["aufgabe_fuer_justin"] }) === "");
  ok("„Anwalt“ in den Worten des Kunden → Aufgabe", arten({ transkript: [{ wer: "kunde", text: "Das geht jetzt an meinen Anwalt." }] }) === "aufgabe_betrug");
  ok("„Anwalt“ nur in ARAS' Satz zählt nicht", arten({ transkript: [{ wer: "aras", text: "Kein Anwalt nötig, des klären mir." }] }) === "");
  const karte = { notiz: "Kunde sagt, die Karte sei noch nicht angekommen; Aufgabe zur Klärung des Kartenversands zugesagt." };
  ok("Karte nicht angekommen, keine Aufgabe → Aufgabe Karte", arten(karte) === "aufgabe_karte");
  ok("Karte, Aufgabe lief schon → nichts", arten({ ...karte, werkzeugeOk: ["aufgabe_fuer_justin"] }) === "");
  ok("Kunde: „Ich hab noch keine Karte bekommen“ → Aufgabe Karte", arten({ transkript: [{ wer: "kunde", text: "Ich hab noch keine Karte bekommen." }] }) === "aufgabe_karte");
  ok("Link UND Karte zugleich → beides", arten({ ...angekuendigt, ...karte }) === "link,aufgabe_karte");

  titel("A. Fenster und nächster Arbeitstag");
  ok("Do 22.10. 15:00 Berlin → im Fenster", N.imNachholFenster(new Date("2026-10-22T15:00:00+02:00")));
  ok("Do 22.10. 19:45 Berlin → zu spät", !N.imNachholFenster(new Date("2026-10-22T19:45:00+02:00")));
  ok("Do 22.10. 08:00 Berlin → zu früh", !N.imNachholFenster(new Date("2026-10-22T08:00:00+02:00")));
  ok("So 25.10. 12:00 Berlin → Sonntag nie", !N.imNachholFenster(new Date("2026-10-25T12:00:00+01:00")));
  ok("nächster Arbeitstag nach Do 22.10. = Fr 23.10.", N.naechsterArbeitstag("2026-10-22") === "2026-10-23");
  ok("nächster Arbeitstag nach Sa 24.10. = Mo 26.10.", N.naechsterArbeitstag("2026-10-24") === "2026-10-26");

  if (!/(?:127\.0\.0\.1|localhost):54329\//.test(String(process.env.DATABASE_URL))) {
    console.log("\n(Teil B übersprungen: keine lokale Prüf-DB)");
    return;
  }

  titel("B. Einmal-Lauf gegen die lokale Prüf-DB (Werkzeug-Attrappe — nichts geht raus)");
  const { sqlPool } = await import("../server/lib/db-pool");
  const { arasSchema, arasSchemaZuruecksetzen, arasAusweisId } = await import("../server/lib/fiaon-aras-schema");
  arasSchemaZuruecksetzen();
  await arasSchema();
  const ausweis = await arasAusweisId();
  await sqlPool`DELETE FROM fiaon_settings WHERE key = ${N.NACHHOLEN_MERKER}`;
  const am = "2026-10-21T13:30:00Z"; // nach dem Go-live, vor e09a0ffe
  async function fall(n: number, e: { zus?: string; notiz?: string; rate: "offen" | "bezahlt"; werkzeug?: string; ergebnis?: string }) {
    const nummer = `+4917000009${String(n).padStart(2, "0")}`;
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, phone_key9, country, is_blocked, anrede)
      VALUES (${`PRUEF-NACH-${n}`}, 'Test', ${`Nachholkunde${n}`}, ${nummer}, ${nummer.slice(-9)}, 'DE', FALSE, 'herr') RETURNING id`) as any[];
    const ref = `PRUEF-NACH-A${n}`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, payment_status, status, current_step, submitted_at, pack_key, pack_name, type, ist_entwurf, created_at)
      VALUES (${ref}, ${`${ref}-Z`}, ${p.id}, 'paid', 'approved', 9, NOW() - INTERVAL '60 days', 'plus', 'Plus', 'privat', FALSE, NOW() - INTERVAL '60 days')`;
    const [r] = (await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am)
      VALUES (${ref}, 2, ${`${ref}-2`}, 5999, CURRENT_DATE - 30, ${e.rate}, ${e.rate === "bezahlt" ? new Date() : null}) RETURNING id`) as any[];
    const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, twilio_sid, gefuehrt_von, created_at)
      VALUES (${p.id}, ${ausweis}, ${nummer}, 'raus', 'beendet', ${am}, ${`CA-pruef-nach-${n}`}, 'aras', ${am}) RETURNING id`) as any[];
    const [pl] = (await sqlPool`INSERT INTO fiaon_aras_plan (person_id, ref, nummer, land, spielart, prioritaet, grund, rechtsgrund, rate_id, frueh_ab, spaet_bis, status, erzeugt_von, created_at)
      VALUES (${p.id}, ${ref}, ${nummer}, 'DE', 'rate', 3, 'Rate 2 seit 30 Tagen überfällig', 'vertrag', ${r.id}, ${am}, ${am}, 'fertig', 'takt', ${am}) RETURNING id`) as any[];
    const [a] = (await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, plan_id, spielart, briefing, adapter, stimme, prompt_version, ergebnis, ergebnis_notiz, zusammenfassung, ende_grund, sekunden_sitzung, created_at)
      VALUES (${c.id}, ${pl.id}, 'rate', '{}'::jsonb, 'attrappe', 'juni', 'pruefstand', ${e.ergebnis ?? "erreicht_sonstiges"}, ${e.notiz ?? null}, ${e.zus ?? null}, 'kunde_aufgelegt', 90, ${am}) RETURNING id`) as any[];
    if (e.werkzeug) await sqlPool`INSERT INTO fiaon_aras_werkzeug (aras_anruf_id, werkzeug, aufruf_id, eingabe, ergebnis, ok, dauer_ms) VALUES (${a.id}, ${e.werkzeug}, 'pruef', '{}'::jsonb, '{}'::jsonb, TRUE, 5)`;
    return { personId: Number(p.id), anrufId: Number(a.id), planId: Number(pl.id), nummer, ref };
  }
  const f1 = await fall(1, { zus: "Er kündigte an, ihr einen Link zu schicken.", rate: "offen" });
  const f2 = await fall(2, { zus: betrug.zusammenfassung, rate: "offen" });
  const f3 = await fall(3, { zus: "Er kündigte an, die Rechnung per WhatsApp zu senden.", rate: "bezahlt" });
  const f4 = await fall(4, { notiz: karte.notiz, zus: "Der Kunde bedankt sich.", rate: "offen", werkzeug: "zahlungslink_senden" });
  const f5 = await fall(5, { zus: "Er kündigte an, ihr einen Link zu schicken.", rate: "offen", ergebnis: "mailbox" });
  // Ein verfallener Rückruf bei ARAS (der Tagesdeckel war voll)
  const [t] = (await sqlPool`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle) VALUES (${f1.personId}, ${ausweis}, '2026-10-22T09:00:00Z', 'gebucht', 'agent_manuell') RETURNING id`.catch(() => [null])) as any[];
  let rueckrufPlan: number | null = null;
  if (t) {
    const [rp] = (await sqlPool`INSERT INTO fiaon_aras_plan (person_id, ref, nummer, land, spielart, prioritaet, grund, rechtsgrund, termin_id, frueh_ab, spaet_bis, status, erzeugt_von, created_at)
      VALUES (${f1.personId}, ${f1.ref}, ${f1.nummer}, 'DE', 'termin', 1, 'Termin bei Aras 11:00 Uhr', 'einwilligung', ${t.id}, '2026-10-22T08:59:00Z', '2026-10-22T09:30:00Z', 'verfallen', 'takt', '2026-10-22T08:10:00Z') RETURNING id`) as any[];
    rueckrufPlan = Number(rp.id);
  }

  const gerufen: { anruf: number; werkzeug: string; eingabe: any; rate: boolean }[] = [];
  const attrappe = (async (ctx: any, name: any, eingabe: any) => {
    gerufen.push({ anruf: ctx.arasAnrufId, werkzeug: String(name), eingabe, rate: !!ctx.briefing?.offeneRate });
    return { ok: true, vorlesen: "" };
  }) as any;

  ok("außerhalb des Fensters (21:00) → läuft nicht, kein Merker", !(await N.nachholenPruefen(sqlPool, new Date("2026-10-22T21:00:00+02:00"), attrappe))
    && !((await sqlPool`SELECT 1 FROM fiaon_settings WHERE key = ${N.NACHHOLEN_MERKER}`) as any[]).length);
  const lief = await N.nachholenPruefen(sqlPool, new Date("2026-10-22T15:00:00+02:00"), attrappe);
  ok("im Fenster → läuft", lief);
  const von = (id: number) => gerufen.filter((g) => g.anruf === id).map((g) => `${g.werkzeug}${g.eingabe?.weg ? `:${g.eingabe.weg}` : ""}`).join(",");
  ok("Fall 1 (angekündigt, Rate offen) → Link per WhatsApp, mit offener Rate im Briefing", von(f1.anrufId) === "zahlungslink_senden:whatsapp" && gerufen.find((g) => g.anruf === f1.anrufId)?.rate === true, von(f1.anrufId));
  ok("Fall 2 (Betrugsanzeige) → nur Aufgabe für Justin", von(f2.anrufId) === "aufgabe_fuer_justin", von(f2.anrufId));
  const [aus] = (await sqlPool`SELECT aus_am, aus_grund FROM fiaon_aras_person WHERE person_id = ${f2.personId}`) as any[];
  ok("Fall 2 → ARAS für diese Person aus (ein Mensch klärt)", !!aus?.aus_am && /Betrug/.test(String(aus?.aus_grund)));
  ok("Fall 3 (Rate bezahlt) → nichts", von(f3.anrufId) === "", von(f3.anrufId));
  ok("Fall 4 (Link lief, Karte zugesagt) → nur Aufgabe Karte", von(f4.anrufId) === "aufgabe_fuer_justin" && gerufen.find((g) => g.anruf === f4.anrufId)?.eingabe?.art === "karte_nicht_erhalten", von(f4.anrufId));
  ok("Fall 5 (Mailbox) → nichts", von(f5.anrufId) === "");
  if (rueckrufPlan) {
    const [rp] = (await sqlPool`SELECT status, frueh_ab FROM fiaon_aras_plan WHERE id = ${rueckrufPlan}`) as any[];
    ok("verfallener Rückruf → wieder „wartet“, Fr 23.10. ab 09:35 Berlin", rp?.status === "wartet" && new Date(rp.frueh_ab).toISOString() === "2026-10-23T07:35:00.000Z", `${rp?.status} ${rp?.frueh_ab}`);
  } else ok("verfallener Rückruf (Termin-Zeile im Prüfstand anlegbar)", false, "fiaon_termine ließ sich nicht anlegen");
  const vorher = gerufen.length;
  ok("zweiter Lauf → nie wieder (Merker)", !(await N.nachholenPruefen(sqlPool, new Date("2026-10-22T15:05:00+02:00"), attrappe)) && gerufen.length === vorher);
  const [pr] = (await sqlPool`SELECT text FROM fiaon_mara_protokoll WHERE text LIKE 'ARAS nachgeholt%' ORDER BY id DESC LIMIT 1`) as any[];
  ok("Protokoll-Satz für das Cockpit steht", /1 Link\(s\) geschickt.*2 Aufgabe\(n\).*1× ARAS aus.*Rückruf/.test(String(pr?.text)), String(pr?.text));
  await sqlPool.end({ timeout: 2 });
}

main()
  .catch((e) => { schlecht++; console.error("ABBRUCH:", e); })
  .finally(() => {
    console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`);
    process.exit(schlecht ? 1 : 0);
  });
