// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-487 (09.11.2026): „IHR VORSORGE-ÜBERBLICK“ — Selbstbuchung beim Partner, Maras Mail und Justins Knopf
//
//   A  REIN (immer, ohne Datenbank — db-pool bekommt eine Adresse, zu der nie verbunden wird):
//      1. Persönlicher Link: gültig, abgelaufen, gefälscht, fremd (Termin-Link), Vorschau; im Protokoll verborgen.
//      2. Das Kästchen: Wortlaut buchstabengetreu gegen eine ausgeschriebene Kopie, eigene Fassung, nie vorangekreuzt
//         (Quelltext-Wachen), ohne echtes „true“ entsteht nichts (vor jeder Datenbankarbeit), der Wortlaut steht nur in shared/.
//      3. Kreis-Filter als reine Regel: jeder Sperrgrund, Grün / Grün + Gelb, je Mensch eine Mail, nie A/B/C, AT/CH, Global,
//         Gesperrte, Abgemeldete; Vorgabe AUS; die Fakten-Abfrage trägt jede Regel.
//      4. Die Mail: Vorlage im Motor, Absender welcome@ mit Maras Karte, Abmeldelink + List-Unsubscribe (Brevo abgefangen),
//         Wortwand (kein „bis zu“, kein Bank-Satz, keine Chancen/Finanzierung, FIAON empfiehlt nichts, Sie-Form), Rot-Proben.
//      5. Takt: Fenster 09–19 Uhr Berlin (Winter und Sommer), Tagesdeckel 60, gleichmäßig über 20 Läufe, Aufholbremse.
//      6. Tür und Verdrahtung: Freigabe-Pflicht in make-webhook.ts (schließt bei Störung), nur Motor, Global-Wand, Werbung
//         immer, Takt im Tageslauf, Chefbüro-Wege, Kanal-Texte (Partnerbrief, Kundenbestätigung), Kundentexte ohne Interna.
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus BREVO_API_KEY=pruef node_modules/.bin/tsx scripts/pruef-vorsorge.ts
//
// Nichts wird versendet: fetch zu api.brevo.com wird abgefangen und nur protokolliert.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

// db-pool verlangt beim Laden eine Adresse — Teil A verbindet nie.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "pruef-vorsorge";
process.env.CRONS = "aus";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra).slice(0, 400)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Kommentare raus — wer Quelltext prüft, darf die Begründung nicht treffen (AGENTS.md). */
const ohneKommentare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

// ── Brevo abfangen ──────────────────────────────────────────────────────────
const brevo: { an: string; betreff: string; headers: Record<string, string>; text: string; html: string }[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).includes("api.brevo.com")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    brevo.push({ an: b.to?.[0]?.email, betreff: b.subject, headers: b.headers ?? {}, text: String(b.textContent ?? ""), html: String(b.htmlContent ?? "") });
    return new Response(JSON.stringify({ messageId: `<pruef-${brevo.length}@brevo>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  return echtFetch(url, init);
}) as typeof fetch;

/** Ein Berliner Zeitpunkt „JJJJ-MM-TT HH:MM“ — über die Zeitzonenangabe, nie über die Rechneruhr. */
function berlin(tag: string, hhmm: string, sommer = false): Date {
  return new Date(`${tag}T${hhmm}:00${sommer ? "+02:00" : "+01:00"}`);
}

async function main() {
  const S = await import("../shared/fiaon-vorsorge");
  const KL = await import("../shared/fiaon-koop-lieferung");
  const V = await import("../server/lib/fiaon-vorsorge");
  const E = await import("../server/lib/fiaon-vorsorge-einladung");
  const L = await import("../server/lib/fiaon-koop-lieferung");
  const T = await import("../server/lib/fiaon-termine");
  const motor = await import("../server/mail/motor");
  const { vorsorgeMailWand } = await import("../server/mail/vorlagen/vorsorge-wand");
  const { payloadSchwaerzen } = await import("../server/lib/fiaon-mail-log");
  const F = await import("../server/lib/fiaon-mail-frequenz");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const { koopParameterAus } = await import("../shared/fiaon-global-angebot-koop");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("1 · Der persönliche Link");
  // ═════════════════════════════════════════════════════════════════════════
  const jetzt = Date.now();
  const tok = V.vorsorgeTokenErzeugen(4711);
  const t1 = V.vorsorgeTokenPruefen(tok);
  ok(t1?.art === "person" && t1.personId === 4711 && !t1.abgelaufen, "gültiger Link öffnet genau diese Person", t1);
  const exp = Number(tok.split(".")[1]);
  ok(Math.abs(exp - jetzt - 30 * 864e5) < 60_000, "gültig 30 Tage");
  const alt = V.vorsorgeTokenErzeugen(4711, 1_000, jetzt - 10_000);
  const t2 = V.vorsorgeTokenPruefen(alt);
  ok(t2?.art === "person" && t2.abgelaufen === true, "abgelaufener Link wird erkannt (freundliche Seite statt Fehler)");
  const fremd = T.terminTokenErzeugen(4711);
  ok(V.vorsorgeTokenPruefen(fremd) === null, "fremd: ein Termin-Link öffnet die Vorsorge-Seite nicht (eigenes Präfix)");
  ok(T.terminTokenPruefen(tok) === null, "… und ein Vorsorge-Link keine Terminbuchung");
  const [pid, ab, sig] = tok.split(".");
  ok(V.vorsorgeTokenPruefen(`${pid}.${ab}.${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`) === null, "gefälschte Signatur → nichts");
  ok(V.vorsorgeTokenPruefen(`4712.${ab}.${sig}`) === null, "andere Person mit fremder Signatur → nichts");
  ok(V.vorsorgeTokenPruefen(`${pid}.${Number(ab) + 1}.${sig}`) === null, "verlängerter Ablauf → nichts");
  ok(["", "abc", "1.2", "0.1799999999000.0f3a", "-1.1799999999000.00000000000000000000000000000000", `${pid}.${ab}.${sig}.x`].every((x) => V.vorsorgeTokenPruefen(x) === null), "Müll und kaputte Formen → nichts");
  const vorschau = V.vorsorgeVorschauLink().split("/vorsorge/")[1];
  const tv = V.vorsorgeTokenPruefen(vorschau);
  ok(tv?.art === "vorschau" && !tv.abgelaufen, "Vorschau-Link aus dem Chefbüro ist eine Vorschau (keine Person)");
  ok(V.vorsorgeTokenPruefen(vorschau.replace(/^v\./, "1.")) === null, "aus einer Vorschau wird keine Person");
  ok(/\/vorsorge\/4711\.\d{13}\.[0-9a-f]{32}$/.test(V.vorsorgeLink(4711)), "Link-Form /vorsorge/<id>.<ablauf>.<signatur>");
  ok(payloadSchwaerzen({ link: V.vorsorgeLink(4711), vorname: "Max" }).link === "[verborgen]", "im Mail-Protokoll ist der Link verborgen (bucht im Namen des Kunden)");
  const idx = lies("server/index.ts");
  ok(idx.includes('.replace(/\\/koop\\/vorsorge\\/[^/?]+/, "/koop/vorsorge/…")') && /koop\\\/vorsorge\\\//.test(idx), "im Server-Protokoll steht kein Token und keine Antwort der Seite");
  const routes = lies("server/routes.ts");
  ok(/app\.get\(\['\/vorsorge', '\/vorsorge\/\*'\][\s\S]{0,200}noindex, nofollow/.test(routes), "Seite /vorsorge/* mit X-Robots-Tag noindex und ohne Referer");
  ok(/Disallow: \/vorsorge\//.test(lies("client/public/robots.txt")), "robots.txt: /vorsorge/ gesperrt");
  const koopRoute = ohneKommentare(lies("server/routes/fiaon-koop.ts"));
  ok(/vorsorgeDrossel = fensterDrossel\(60, 10 \* 60_000\)/.test(koopRoute) && /vorsorgeSchreibDrossel = fensterDrossel\(20, 10 \* 60_000\)/.test(koopRoute), "Drossel: 60 Aufrufe und 20 Handlungen je IP in 10 Minuten");
  ok(/z\.art === "vorschau"\) return res\.status\(403\)/.test(koopRoute), "die Vorschau speichert und bucht nie (403)");
  ok(/status\(410\)[^\n]*abgelaufen/.test(koopRoute), "abgelaufen antwortet 410 mit eigener Kennung");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2 · Das Kästchen");
  // ═════════════════════════════════════════════════════════════════════════
  const herr = { anrede: "Herr", vorname: "Paul", nachname: "Partner", firma: "" };
  const KOPIE = "Ich möchte ein kostenloses Gespräch zum Thema „Krankenzusatzversicherung“ mit Herrn Paul Partner, einem selbstständigen Berater und Partner von FIAON. "
    + "Dafür übermittelt FIAON meinen Vor- und Nachnamen, meine Telefonnummer, meine E-Mail-Adresse, mein Wunschthema und den gebuchten Termin an den Berater. "
    + "Ich willige ein, dass der Berater mich zu diesem Gespräch telefonisch und per E-Mail kontaktiert. "
    + "FIAON berät nicht zu Versicherungen oder Geldanlagen und erhält keine Provision. Meine FIAON-Leistungen hängen nicht davon ab. "
    + "Ich kann die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen — formlos, z. B. an support@fiaon.com oder telefonisch bei FIAON.";
  ok(S.vorsorgeEinwilligungText(herr, "Krankenzusatzversicherung") === KOPIE, "Wortlaut buchstabengetreu (Ich-Form von koopEinwilligungText, Partner mit Namen)", S.vorsorgeEinwilligungText(herr, "Krankenzusatzversicherung"));
  const frau = S.vorsorgeEinwilligungText({ anrede: "Frau", vorname: "Petra", nachname: "Muster", firma: "Muster Vorsorge" }, "Vermögensaufbau");
  ok(frau.includes("mit Frau Petra Muster (Muster Vorsorge), einer selbstständigen Beraterin und Partnerin von FIAON") && frau.includes("an die Beraterin") && frau.includes("dass die Beraterin mich"), "Partnerin: Beraterin, mit Geschäftsbezeichnung");
  ok(S.VORSORGE_FASSUNG === "KOOP-EW-SELBST-2026-11-09" && S.VORSORGE_FASSUNG !== KL.KOOP_EINWILLIGUNG_FASSUNG && S.VORSORGE_FASSUNG.length <= 40, "eigene Fassungs-Kennung (passt in fiaon_koop_einwilligungen.fassung)");
  const wl = S.vorsorgeWortlaut(KOPIE, ["wohnsitz_de", "volljaehrig"]);
  ok(wl.startsWith(KOPIE) && /nicht vorangekreuzt/.test(wl) && wl.includes("Ich wohne in Deutschland.") && wl.includes("Ich bin volljährig."), "gespeichert: Wortlaut + wie erteilt + selbst bestätigte Angaben");
  const buchung = ohneKommentare(lies("client/src/components/kunde/VorsorgeBuchung.tsx"));
  ok(/const \[ja, setJa\] = useState\(false\)/.test(buchung) && /checked=\{ja\}/.test(buchung) && !/defaultChecked/.test(buchung), "Kästchen startet leer (useState(false)), kein defaultChecked");
  ok(/useEffect\(\(\) => \{ setJa\(false\); \}, \[thema, p\?\.angebotId\]\)/.test(buchung), "neues Thema oder neuer Partner → Kästchen wieder leer (der Wortlaut ändert sich)");
  ok(/einwilligung: ja/.test(buchung) && /vorsorgeEinwilligungText\(p\.partnerFuerText, thema\)/.test(buchung), "die Seite zeigt den Wortlaut aus shared/ und schickt den Zustand des Kästchens");
  ok(/const \[bestaetigt, setBestaetigt\] = useState<string\[\]>\(\[\]\)/.test(buchung), "Wohnsitz/Volljährigkeit: eigene Kästchen, leer");
  ok(/gehtAn\} \{koopPartnerImSatz\(p\.partnerFuerText\)\}/.test(buchung) && KL.koopPartnerImSatz({ anrede: "Herr", vorname: "Paul", nachname: "Partner" }) === "Herrn Paul Partner", "„Geht an Herrn …“ — der Empfänger steht im richtigen Fall");
  const anzeigeDateien = ["client/src/components/kunde/VorsorgeBuchung.tsx", "client/src/pages/vorsorge.tsx", "client/src/components/kunde/PartnerGespraechKarte.tsx", "server/lib/fiaon-vorsorge.ts", "server/routes/fiaon-koop.ts"];
  ok(anzeigeDateien.every((d) => !lies(d).includes("übermittelt FIAON meinen Vor- und Nachnamen")), "der Wortlaut steht genau einmal (shared/fiaon-vorsorge.ts), nicht in Seite, Karte oder Server");
  const ohneHaken = await V.vorsorgeBuchen(4711, { einwilligung: "true", angebotId: 1, thema: "x", termin: "x", art: "telefon" }, { quelle: "link", ip: null, userAgent: null });
  ok(!ohneHaken.ok && ohneHaken.status === 400 && /Häkchen/.test(ohneHaken.error), "„true“ als Text ist kein Häkchen → 400, nichts gespeichert (vor jeder Datenbankarbeit)");
  const ohneFeld = await V.vorsorgeBuchen(4711, { angebotId: 1 }, { quelle: "kundenbereich", ip: null, userAgent: null });
  ok(!ohneFeld.ok && ohneFeld.status === 400, "fehlendes Feld → 400");
  const kern = await L.koopKontaktAnlegen(4711, { angebotId: 1, thema: "x", termin: "x", art: "telefon", einwilligung: false, kanal: "kundenbereich" }, { name: "Prüf", agentId: null });
  ok(!kern.ok && kern.code === "einwilligung" && /Kästchen/.test(kern.error), "auch der Kern lehnt ohne Ja ab (Kennung „einwilligung“, Satz der Selbstbuchung)");
  const kernTel = await L.koopKontaktAnlegen(4711, { angebotId: 1, thema: "x", termin: "x", art: "telefon", einwilligung: false }, { name: "Prüf", agentId: null });
  ok(!kernTel.ok && /Ohne ausdrückliches Ja des Kunden/.test(kernTel.error), "der Telefon-Weg behält seinen Satz");
  const kernQ = ohneKommentare(lies("server/lib/fiaon-koop-lieferung.ts"));
  ok(/const kanal: KoopKanal = selbst \? "kundenbereich" : "telefon"/.test(kernQ) && /\$\{kanal\}, \$\{wortlaut\}, \$\{ewFassung\}, \$\{jetzt\}, \$\{wer\.name\}, \$\{wer\.agentId\}, \$\{ip\}, \$\{userAgent\}/.test(kernQ), "Kern speichert Kanal, Wortlaut, Fassung, Zeit, IP und Browser-Kennung (vorher stand „telefon“ fest)");
  ok(/selbst && d\.parameter\.bereich !== "vorsorge"/.test(kernQ) && /const notiz = selbst \? "" :/.test(kernQ), "Selbstbuchung nur bei Vorsorge-Partnern und ohne Notiz");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3 · Der Kreis — eine reine Regel");
  // ═════════════════════════════════════════════════════════════════════════
  const sauber: import("../shared/fiaon-vorsorge").VorsorgeMerkmale = {
    bezahlt: true, ungekuendigt: true, land: "DE", mailOk: true, telefonOk: true, test: false, vertriebssperre: false, ausgeschlossen: false,
    minderjaehrig: false, werbesperre: false, abgemeldet: false, stopp: false, unzustellbar: false, dsgvo: false, global: false,
    keinInteresse: false, widerrufen: false, kontaktKuerzlich: false, rateUeberfaellig: false, storniert: false, nachStichtag: true, versandt: false,
  };
  ok(S.vorsorgeSperrgrund(sauber) === null && S.vorsorgeEmpfaenger(sauber, "gruen") && S.vorsorgeEmpfaenger(sauber, "gruen_gelb"), "bezahlt, DE, ungekündigt, mit Hinweis → in beiden Kreisen");
  const gelb = { ...sauber, nachStichtag: false };
  ok(!S.vorsorgeEmpfaenger(gelb, "gruen") && S.vorsorgeEmpfaenger(gelb, "gruen_gelb"), "ohne Hinweis bei der Erhebung → nur Grün + Gelb");
  ok(!S.vorsorgeEmpfaenger({ ...sauber, versandt: true }, "gruen") && !S.vorsorgeEmpfaenger({ ...sauber, versandt: true }, "gruen_gelb"), "je Mensch genau eine Mail: schon bekommen → in keinem Kreis");
  const faelle: [string, Partial<typeof sauber>, string][] = [
    ["A/B/C (kein bezahltes Stufenpaket)", { bezahlt: false }, "nicht_bezahlt"],
    ["gekündigt / Vertrag beendet", { ungekuendigt: false }, "gekuendigt"],
    ["Österreich", { land: "AT" }, "ausland"], ["Schweiz", { land: "CH" }, "ausland"], ["anderes Land", { land: "PL" }, "ausland"],
    ["FIAON Global", { global: true }, "global"], ["Werbesperre", { werbesperre: true }, "werbesperre"], ["abgemeldet", { abgemeldet: true }, "abgemeldet"],
    ["„Stopp“", { stopp: true }, "stopp"], ["Vertriebssperre", { vertriebssperre: true }, "vertriebssperre"], ["Testkonto", { test: true }, "test"],
    ["DSGVO", { dsgvo: true }, "dsgvo"], ["minderjährig", { minderjaehrig: true }, "minderjaehrig"], ["ohne Mail", { mailOk: false }, "ohne_mail"],
    ["ohne Telefon", { telefonOk: false }, "ohne_telefon"], ["unzustellbar", { unzustellbar: true }, "unzustellbar"],
    ["„kein Interesse“", { keinInteresse: true }, "kein_interesse"], ["Widerruf", { widerrufen: true }, "widerrufen"],
    ["Partner-Kontakt in 6 Monaten", { kontaktKuerzlich: true }, "kontakt"], ["Rate überfällig", { rateUeberfaellig: true }, "rate_ueberfaellig"],
    ["Telefonkartei storniert", { storniert: true }, "storniert"], ["ausgeschlossen (Stufe −1)", { ausgeschlossen: true }, "ausgeschlossen"],
  ];
  for (const [name, aend, grund] of faelle) {
    const m = { ...sauber, ...aend };
    ok(S.vorsorgeSperrgrund(m) === grund && !S.vorsorgeEmpfaenger(m, "gruen") && !S.vorsorgeEmpfaenger(m, "gruen_gelb"), `nie: ${name} (Grund „${grund}“)`, S.vorsorgeSperrgrund(m));
  }
  ok(["", "DE", "deu", " Deutschland ", "germany"].every((l) => S.vorsorgeLandOk(l)) && !["AT", "CH", "AUT", "ÖSTERREICH", "LI"].some((l) => S.vorsorgeLandOk(l)), "Land: Deutschland oder kein Hinweis — AT/CH nie");
  ok(Object.keys(S.VORSORGE_SPERRGRUND_TEXT).length === 20 && faelle.every(([, , g]) => g in S.VORSORGE_SPERRGRUND_TEXT), "jeder Sperrgrund hat einen Satz für das Chefbüro");
  ok(S.vorsorgeKreisAus("gruen_gelb") === "gruen_gelb" && S.vorsorgeKreisAus(" GRUEN_GELB ") === "gruen_gelb" && S.vorsorgeKreisAus("alle") === "gruen" && S.vorsorgeKreisAus(undefined) === "gruen", "Kreis: unbekannt heißt der engere („gruen“)");
  const leerE = S.vorsorgeEinstellungenAus({});
  ok(leerE.an === false && leerE.kreis === "gruen" && leerE.freigabe === null, "Vorgabe AUS: ohne Zeile geht nichts raus");
  ok(S.vorsorgeEinstellungenAus({ vorsorge_mail_an: "1" }).an && S.vorsorgeEinstellungenAus({ vorsorge_mail_an: " 1 " }).an
    && !S.vorsorgeEinstellungenAus({ vorsorge_mail_an: "true" }).an && !S.vorsorgeEinstellungenAus({ vorsorge_mail_an: "ja" }).an, "nur „1“ schaltet ein");
  const fg = S.vorsorgeEinstellungenAus({ vorsorge_mail_freigabe: JSON.stringify({ am: "2026-11-09T10:00:00.000Z", von: "Prüf", kreis: "gruen_gelb" }) });
  ok(fg.freigabe?.kreis === "gruen_gelb" && fg.freigabe.von === "Prüf" && fg.freigabe.angehaltenAm === null, "Freigabe merkt wer, wann, welcher Kreis");
  const rueck = { mail6h: false, werbung20h: false, fehlversuch24h: false, fehlversuche: 0 };
  ok(S.vorsorgeHeuteNicht(rueck) === null && !!S.vorsorgeHeuteNicht({ ...rueck, mail6h: true }) && !!S.vorsorgeHeuteNicht({ ...rueck, werbung20h: true })
    && !!S.vorsorgeHeuteNicht({ ...rueck, fehlversuch24h: true }) && !!S.vorsorgeHeuteNicht({ ...rueck, fehlversuche: 3 }), "Rücksicht: andere Mail 6 h, Werbung 20 h, Fehlversuch 24 h, höchstens drei Versuche");
  const sql = E.merkmaleSql({ personenParam: "$1", mitRaten: true, mitKartei: true });
  const brauchtSql = ["a.payment_status = 'paid'", "= 'konto'", "a.refunded_at IS NULL", "FIAON-TEST%", "fiaon_global_angebote", "werbung_gesperrt_am", "abgemeldet_am",
    "strecke_stopp = 'abgemeldet'", "'gebounct', 'blockiert', 'spam'", "bounce_am", "gdpr_deleted_at", "ist_test_am", "is_blocked", "priority_tier",
    "fiaon_koop_einwilligungen", "'abgelehnt'", "widerrufen_am", "fiaon_koop_kontakte", "fiaon_abo_raten", "fiaon_telefonkartei_storno",
    "2026-09-02T12:35:00+02:00", "'vorsorge_ueberblick'", "INTERVAL '6 hours'", "INTERVAL '20 hours'", "INTERVAL '24 hours'", "'auskunft_angebot'", "'rueckhol%'",
    "a.person_id = ANY($1::int[])", "INTERVAL '18 years'"];
  const fehltSql = brauchtSql.filter((x) => !sql.includes(x));
  ok(!fehltSql.length, "die Fakten-Abfrage trägt jede Regel (Grundmenge bezahlt, Sperren, Partner, Rate, Kartei, Stichtag, Rücksicht)", fehltSql);
  ok(!/claimed_paid|pending_payment/.test(sql), "Grundmenge nur „paid“ — „Zahlung gemeldet“ (A) und offene Anträge (B) gar nicht erst darin");
  ok(!E.merkmaleSql({ mitRaten: false, mitKartei: false }).includes("fiaon_abo_raten") && E.merkmaleSql({ mitRaten: false, mitKartei: false }).includes("FALSE AS rate_ueberfaellig"), "fehlt die Ratentabelle (lokal), steht dort FALSE statt eines Fehlers");
  let wirft = false; try { E.merkmaleSql({ personenParam: "1; DROP TABLE x", mitRaten: false, mitKartei: false }); } catch { wirft = true; }
  ok(wirft, "Personen-Filter nimmt nur „$n“ — nie freien Text");
  const mensch = E.menschAus({ person_id: 7, ref: "FIAON-PRUEF-1", vorname: "Klara", nachname: "Kundin", email: "klara@pruefstand.test", land: "DE", bezahlt: true, ungekuendigt: true, mail_ok: true, telefon_ok: true, nach_stichtag: false, versandt: false, fehlversuche: "2" });
  ok(mensch.merkmale.bezahlt && !mensch.merkmale.test && mensch.ruecksicht.fehlversuche === 2 && S.vorsorgeEmpfaenger(mensch.merkmale, "gruen_gelb") && !S.vorsorgeEmpfaenger(mensch.merkmale, "gruen"), "Zeile → Fakten → dieselbe Entscheidung");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4 · Die Mail „Ihr Vorsorge-Überblick“");
  // ═════════════════════════════════════════════════════════════════════════
  const ev = E.VORSORGE_EVENT;
  ok(ev === "vorsorge_ueberblick" && motor.hatVorlage(ev) && motor.ABMELDEPFLICHT.has(ev), "Vorlage im Mailwerk-Motor, Abmeldepflicht");
  const abs = motor.absenderFuer(ev);
  ok(abs.name === "FIAON Welcome" && abs.email === "welcome@fiaon.com", "Absender welcome@ (FIAON Welcome)");
  const reg = MAKE_EVENT_REGISTRY.find((e) => e.type === ev);
  ok(!!reg && /abmelde_url/.test(JSON.stringify(reg.example)) && /link/.test(JSON.stringify(reg.example)), "im Register mit Beispiel (link, abmelde_url)");
  const beispiel = reg!.example as Record<string, unknown>;
  const m = motor.mailRendern(ev, beispiel)!;
  ok(m && m.fehlend.length === 0 && !m.knopfEntfallen, "Beispiel füllt jeden Platzhalter und den Knopf", m?.fehlend);
  ok(m.html.includes(`href="${beispiel.link}"`) && /Vorsorge-Überblick öffnen/.test(m.html), "Knopf zur persönlichen Seite");
  ok(m.html.includes(`href="${beispiel.abmelde_url}"`) && m.text.includes(`Abmelden: ${beispiel.abmelde_url}`), "persönlicher Abmeldelink im HTML-Fuß und im Text-Teil");
  ok(/mail\/signatur\/mara\.png/.test(m.html) && /Mara Lindner/.test(m.html) && /Digitale Assistentin/.test(m.html) && /FIAON Welcome-Team/.test(m.html), "Maras Karte (Bild, Name, digitale Assistentin, Welcome-Team)");
  ok(/Mara Lindner\nDigitale Assistentin · FIAON Welcome-Team/.test(m.text), "Unterschrift auch im Text-Teil");
  ok(m.betreff === "Neu in Ihrem Kundenbereich: Ihr Vorsorge-Überblick", "Betreff", m.betreff);
  const { WIDERSPRUCH_SATZ } = await import("../server/mail/vorlagen/auskunft-verkauf");
  ok(m.text.includes(WIDERSPRUCH_SATZ), "Widerspruchs-Hinweis bei jeder Verwendung (§ 7 Abs. 3 Nr. 4 UWG)");
  const { KARTE_SATZ } = await import("../server/mail/geruest");
  ok(!m.html.includes(KARTE_SATZ) && !m.text.includes(KARTE_SATZ), "kein Karten-Block (sein Satz trägt den Bank-Vorbehalt)");
  const leserText = `${m.betreff}\n${motor.VORLAGEN[ev].preheader}\n${m.text}`;
  const wand = vorsorgeMailWand(leserText);
  ok(wand.length === 0, "Wortwand: kein „bis zu“, kein Bank-Satz, keine Chancen/Finanzierung/Kredit, FIAON empfiehlt nichts, Sie-Form, Hauswand", wand);
  ok(!/Herrn? |Frau [A-ZÄÖÜ]/.test(m.text.replace("Guten Tag Max Mustermann", "")) && !/\{\{params\.(partner|berater)/.test(JSON.stringify(motor.VORLAGEN[ev])), "kein Partnername in der Mail (erst auf der Seite)");
  ok(/\bSie\b/.test(m.text) && !/Antworte einfach/.test(m.html), "Sie-Form bis in den Fuß");
  // Rot-Proben: Die Wand muss rot werden können (AGENTS.md).
  ok(vorsorgeMailWand("Bis zu drei Termine frei.").length > 0, "Rot-Probe: „bis zu“ fällt");
  ok(vorsorgeMailWand("Mit der passenden Absicherung erhöhen Sie Ihre Finanzierungschancen.").length > 0, "Rot-Probe: Absicherung + Finanzierungschancen fällt");
  ok(vorsorgeMailWand("Über Ihre Karte entscheidet am Ende die Bank.").length > 0, "Rot-Probe: Bank-Satz fällt");
  ok(vorsorgeMailWand("FIAON empfiehlt Ihnen eine Rentenversicherung.").length > 0 && vorsorgeMailWand("FIAON berät nicht und empfiehlt keine Produkte.").length === 0, "Rot-Probe: „FIAON empfiehlt“ fällt, „empfiehlt keine Produkte“ nicht");
  ok(vorsorgeMailWand("Hier kannst du deinen Termin buchen.").length > 0, "Rot-Probe: Du-Form fällt");
  const ohneAbmelden = motor.mailRendern(ev, { ...beispiel, abmelde_url: "" })!;
  ok(ohneAbmelden.fehlend.includes("abmelde_url") && !/Hier abmelden/.test(ohneAbmelden.html), "ohne Abmeldelink: Zeile weg und als Lücke gemeldet (die Tür lehnt dann ab)");
  const mw = ohneKommentare(lies("server/make-webhook.ts"));
  ok(/ABMELDEPFLICHT\.has\(eventType\) && !String\(payload\.abmelde_url/.test(mw), "Tür: Werbe-Mail ohne Abmeldelink geht nicht raus");
  const vor = brevo.length;
  const d1 = await motor.mailDirektSenden(ev, { ...beispiel, email: "pruef@pruefstand.test" });
  const gesendet = brevo[vor];
  ok(d1.ok && gesendet && gesendet.headers["List-Unsubscribe"]?.includes(String(beispiel.abmelde_url)) && /mailto:welcome@fiaon\.com/.test(gesendet.headers["List-Unsubscribe"] ?? "")
    && gesendet.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click", "One-Click-Kopfzeilen List-Unsubscribe / List-Unsubscribe-Post (Brevo abgefangen)", gesendet?.headers);
  const nl = await E.vorsorgeNutzlast({ personId: 4711, email: "klara@pruefstand.test", vorname: "Klara", nachname: "Kundin" });
  ok(String(nl.link).includes("/vorsorge/4711.") && String(nl.abmelde_url).includes("/api/fiaon/abmelden/p/4711.") && nl.person_id === 4711, "Nutzlast: persönlicher Link und persönlicher Abmeldelink");
  const nv = await E.vorsorgeNutzlast({ personId: 4711, email: "klara@pruefstand.test", vorname: "Klara", nachname: "Kundin" }, { vorschau: true, an: "test@pruefstand.test" });
  ok(nv.email === "test@pruefstand.test" && String(nv.link).includes("/vorsorge/v.") && String(nv.abmelde_url).includes("/vorsorge/v.") && !("person_id" in nv), "Vorschau/Prüfversand: kein Kundenlink, keine fremde Abmeldung, an die Testadresse");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5 · Der Takt");
  // ═════════════════════════════════════════════════════════════════════════
  ok(S.VORSORGE_TAGESDECKEL === 60 && S.VORSORGE_LAEUFE_JE_TAG === 20 && S.VORSORGE_TAKT_MINUTEN === 30, "Deckel 60, 20 Läufe (09:00 … 18:30), alle 30 Minuten");
  ok(!S.vorsorgeSendezeit(berlin("2026-11-10", "08:59")) && S.vorsorgeSendezeit(berlin("2026-11-10", "09:00")) && S.vorsorgeSendezeit(berlin("2026-11-10", "18:59")) && !S.vorsorgeSendezeit(berlin("2026-11-10", "19:00")), "Fenster 09:00–18:59 Berlin (Winterzeit)");
  ok(!S.vorsorgeSendezeit(berlin("2026-07-10", "08:59", true)) && S.vorsorgeSendezeit(berlin("2026-07-10", "09:00", true)) && !S.vorsorgeSendezeit(berlin("2026-07-10", "19:00", true)), "… und in der Sommerzeit");
  ok(!S.vorsorgeSendezeit(new Date(Number.NaN)), "unlesbare Uhr heißt Nachtruhe");
  ok(S.vorsorgeLaufDeckel(60, berlin("2026-11-10", "09:00")) === 3 && S.vorsorgeLaufDeckel(57, berlin("2026-11-10", "09:30")) === 3, "gleichmäßig: 3 je Lauf");
  ok(S.vorsorgeLaufDeckel(60, berlin("2026-11-10", "08:30")) === 0 && S.vorsorgeLaufDeckel(60, berlin("2026-11-10", "19:05")) === 0 && S.vorsorgeLaufDeckel(0, berlin("2026-11-10", "12:00")) === 0, "außerhalb des Fensters oder ohne Rest: 0");
  ok(S.vorsorgeLaufDeckel(60, berlin("2026-11-10", "18:00")) === 8, "Freigabe um 18 Uhr: höchstens 8 in einem Lauf (nicht 57)");
  let rest = 60, summe = 0, maxLauf = 0;
  for (let i = 0; i < 24; i++) {
    const min = 9 * 60 + 7 + i * 30;
    const d = berlin("2026-11-10", `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
    const n = S.vorsorgeLaufDeckel(rest, d);
    summe += n; rest -= n; maxLauf = Math.max(maxLauf, n);
  }
  ok(summe === 60 && maxLauf <= 8, `ein ganzer Tag (Läufe um :07/:37): genau 60, höchstens ${maxLauf} je Lauf`);
  rest = 60; summe = 0;
  for (let i = 0; i < 20; i++) { const n = S.vorsorgeLaufDeckel(rest, berlin("2026-11-10", `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`)); summe += n; rest -= n; }
  ok(summe <= S.VORSORGE_TAGESDECKEL, "der Tagesdeckel wird nie überschritten");
  const takt = ohneKommentare(lies("server/lib/fiaon-vorsorge-einladung.ts"));
  ok(/if \(!opts\.trocken && !e\.an\) return leer\(/.test(takt) && /const nochAn = async \(\): Promise<boolean> => \(await vorsorgeEinstellungen\(\)\)\.an/.test(takt) && /if \(!\(await nochAn\(\)\)\)/.test(takt), "ohne Freigabe nichts; „Anhalten“ wirkt vor jeder Mail");
  ok(/const nein = await vorsorgeSperre\(f\.personId, e\.kreis\)/.test(takt) && /versendenUndProtokollieren\(VORSORGE_EVENT, nutzlast, \{\s*personId: f\.personId, verlaufRef: f\.ref/.test(takt), "vor jeder Mail die Sperren frisch; Versand mit Protokoll und Akte-Verlauf");
  ok(/vorsorgeLaufDeckel\(rest, opts\.jetzt\)/.test(takt) && /VORSORGE_TAGESDECKEL - heute/.test(takt), "Takt rechnet mit Tagesdeckel und gleichmäßigem Lauf-Deckel");
  ok(/tageslauf\('vorsorge_mail', async \(\) => await \(await import\('\.\/lib\/fiaon-vorsorge-einladung'\)\)\.vorsorgeTakt\(\), 30 \* 60 \* 1000/.test(routes), "im Tageslauf alle 30 Minuten");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6 · Tür, Verdrahtung, Texte");
  // ═════════════════════════════════════════════════════════════════════════
  ok(/eventType === "vorsorge_ueberblick"\) \{\s*let sperre: string \| null;[\s\S]{0,400}vorsorgeTuerSperre\(personId\)[\s\S]{0,120}catch \(e\) \{\s*sperre = `Sperre: Prüfung nicht möglich/.test(mw), "Tür: ohne Freigabe/Kreis/Sperrprüfung keine Mail — bei einer Störung geschlossen");
  ok(/"agent_auszahlungsplan_stand", "vorsorge_ueberblick"\]\.includes\(eventType\)/.test(mw), "nur über den Motor (Make kennt die Mail nicht)");
  ok(/"lead_application_link", "vorsorge_ueberblick",/.test(mw), "Global-Wand je Mensch (PRIVATLINIE_PERSON)");
  ok(F.istWerbungImmer(ev), "Werbung immer: auch von Hand nie an eine Werbesperre");
  ok(/"konto_karte_einladung",\s*\/\/[^\n]*\n[^\n]*\n\s*"vorsorge_ueberblick",\s*\];/.test(lies("server/lib/fiaon-auskunft-verkauf.ts")), "der Auskunft-Takt wartet 20 h nach dieser Werbemail (und umgekehrt)");
  const tuer = ohneKommentare(lies("server/lib/fiaon-vorsorge-einladung.ts"));
  ok(/if \(!e\.an\) return "Sperre: Die Mail „Ihr Vorsorge-Überblick“ ist nicht freigegeben/.test(tuer) && /werbungVerboten\(await menschSperre\(personId\)\)/.test(tuer) && /k\.sperren\.length/.test(tuer), "Tür prüft Freigabe, Kreis, koopKandidat und die Werbe-Regel des Menschen");
  const mailwerk = ohneKommentare(lies("server/routes/fiaon-mailwerk.ts"));
  ok(["/chef/mailwerk/vorsorge\"", "/chef/mailwerk/vorsorge/vorschau", "/chef/mailwerk/vorsorge/pruefversand", "/chef/mailwerk/vorsorge/freigeben", "/chef/mailwerk/vorsorge/anhalten"].every((p) => mailwerk.includes(p))
    && (mailwerk.match(/requireChef\("geschaeftsfuehrung"\)/g) ?? []).length >= 8, "Chefbüro › Mailwerk: Stand, Vorschau, Prüfversand, Freigeben, Anhalten — nur Leitung");
  ok(/chefProtokoll\(req, "vorsorge-mail:freigabe"/.test(mailwerk) && /chefProtokoll\(req, "vorsorge-mail:anhalten"/.test(mailwerk), "wer freigibt oder anhält, steht im Protokoll");
  const vorschauFn = takt.slice(takt.indexOf("export async function vorsorgeVorschau("), takt.indexOf("export async function vorsorgePruefversand("));
  ok(vorschauFn.length > 100 && /mailRendern\(VORSORGE_EVENT/.test(vorschauFn) && !/mailDirektSenden|versendenUndProtokollieren|fetch\(/.test(vorschauFn), "die Vorschau rendert nur — kein Versandaufruf");
  const neueWege = mailwerk.slice(mailwerk.indexOf("async function chefName"));
  ok(neueWege.length > 100 && !/mailDirektSenden|versendenUndProtokollieren/.test(neueWege), "die Chefbüro-Wege selbst senden nichts (Prüfversand nur über vorsorgePruefversand an die Testadresse)");
  const karte = ohneKommentare(lies("client/src/components/admin/MailwerkVorsorge.tsx"));
  ok(/window\.confirm\(frage\)/.test(karte) && /Höchstens \$\{stand!\.heute\.deckel\} am Tag/.test(karte) && /data-mailwerk-vorsorge/.test(karte), "Karte: Grenze und Zahl VOR dem Klick, Rückfrage beim Freigeben");
  ok(/RUNDGANG_MAILWERK/.test(lies("client/src/pages/agent/rundgaenge.ts")) && /<Rundgang raum="mailwerk"/.test(lies("client/src/components/admin/ChefMailwerk.tsx")) && /data-mailwerk-vorsorge/.test(lies("client/src/pages/agent/rundgaenge.ts")), "Rundgang des Raums mitgezogen (mit dem Vorsorge-Schritt)");
  ok(/<Route path="\/vorsorge\/:token" component=\{VorsorgePage\} \/>/.test(lies("client/src/App.tsx")), "Seite /vorsorge/:token im Client");
  ok(/<VorsorgeBuchung basis=\{basis\} lage=\{lage\} setLage=\{setLage\} kontext="karte"/.test(lies("client/src/components/kunde/PartnerGespraechKarte.tsx")), "Kundenbereich-Karte bucht über denselben Weg");

  // Kanal-Texte (rein): Partnerbrief und Kundenbestätigung
  const d = { ref: "FIAON-IA-KPRUEF1", fassung: "IA-KOOP-2026-10-16-A", partner: { ...herr, art: "unternehmer", strasse: "Teststraße 1", plz: "10115", ort: "Berlin", land: "DE", email: "paul@pruefstand.test", telefon: "" }, parameter: koopParameterAus({}), gueltigBis: "2026-12-31" } as any;
  const k = { vorname: "Klara", nachname: "Kundin", telefon: "+49 170 0000001", email: "klara@pruefstand.test", thema: "Krankenzusatzversicherung", termin_beginn: new Date("2026-11-20T10:00:00+01:00"), termin_dauer_min: 60, termin_art: "telefon", notiz: null, ersatz_fuer_id: null, anschrift: null };
  const briefSelbst = L.koopPartnerBriefText(d, k, { kanal: "kundenbereich", erteilt_am: new Date("2026-11-10T09:00:00+01:00"), fassung: S.VORSORGE_FASSUNG }, "https://fiaon.com/partner/x");
  const briefTel = L.koopPartnerBriefText(d, k, { kanal: "telefon", erteilt_am: new Date("2026-11-10T09:00:00+01:00"), fassung: KL.KOOP_EINWILLIGUNG_FASSUNG }, "https://fiaon.com/partner/x");
  ok(/im FIAON-Kundenbereich selbst erteilt \(Fassung KOOP-EW-SELBST-2026-11-09\)/.test(briefSelbst.text) && !/am Telefon erteilt/.test(briefSelbst.text) && /selbst gebucht/.test(briefSelbst.text), "Partnerbrief: „im FIAON-Kundenbereich selbst erteilt“");
  ok(/am Telefon erteilt/.test(briefTel.text) && !/selbst erteilt/.test(briefTel.text), "Partnerbrief am Telefon: Wort für Wort wie bisher");
  ok(!/Schulden|Einkommen|SCHUFA|Notiz aus unserem Gespräch/.test(briefSelbst.text), "Partnerbrief der Selbstbuchung: keine Notiz, nichts zu Schulden/Einkommen");
  const kSelbst = L.koopKundeBestaetigungText(d, k, "kundenbereich");
  const kTel = L.koopKundeBestaetigungText(d, k, "telefon");
  ok(/^Sie haben ein kostenloses Gespräch zum Thema „Krankenzusatzversicherung“ gebucht/.test(kSelbst.text) && !/wie besprochen/.test(kSelbst.text) && /Kundenbereich ab/.test(kSelbst.text), "Kundenbestätigung: „Sie haben … gebucht“ und Absage im Kundenbereich");
  ok(/^wie besprochen haben wir für Sie ein kostenloses Gespräch/.test(kTel.text) && kTel.betreff === kSelbst.betreff, "am Telefon: „wie besprochen …“ wie bisher, derselbe Betreff");
  ok(KL.KOOP_INTERESSE.text.includes("selbstständigen Berater") && !KL.KOOP_INTERESSE.text.includes("unabhängig"), "Kundenbereich-Text: „selbstständigen Berater“ statt „unabhängigen“");
  const codes = ["einwilligung", "thema", "art", "termin", "nicht_frei", "sperre", "exklusiv", "bestaetigen", "partner", "kandidat", "speichern", undefined];
  ok(codes.every((c) => { const t = S.vorsorgeFehlerText(c, ["wohnsitz_de"]); return !!t && !/\bder Kunde\b|Akte|Wunschmenge|Start-Rahmen|Vertriebssperre|Werbesperre/.test(t); }), "jeder Fehler hat einen Kundensatz — nie „der Kunde“, Wunschmenge oder Sperr-Interna");
  const seitenTexte = Object.values(S.VORSORGE_TEXTE).join("\n");
  const seitenWand = vorsorgeMailWand(seitenTexte);
  ok(seitenWand.length === 0 && !/Finanzierung|Chance|bis zu/i.test(seitenTexte), "Texte der Seite: Sie-Form, kein „bis zu“, keine Verknüpfung mit Finanzierung", seitenWand);
  ok(S.vorsorgeRollenZeile("", "Herr") === "selbstständiger Berater, Partner von FIAON" && S.vorsorgeRollenZeile("selbstständiger Vermögensberater", "Herr") === "selbstständiger Vermögensberater, Partner von FIAON"
    && S.vorsorgeRollenZeile(null, "Frau") === "selbstständige Beraterin, Partnerin von FIAON", "Rolle unter dem Namen: vom Vertrag (schalter.rolle), sonst die Vorgabe");
  ok(S.vorsorgeRolleGueltig("selbstständiger Vermögensberater") && S.vorsorgeRolleGueltig("") && !S.vorsorgeRolleGueltig("<b>x</b>") && !S.vorsorgeRolleGueltig("x".repeat(61)), "Rolle: nur Buchstaben, höchstens 60 Zeichen");
  ok(S.vorsorgePartnerName(herr) === "Herr Paul Partner" && S.vorsorgeThemenAus(["Vermögensaufbau", "Bausparen", "Krankenzusatzversicherung", "Vermögensaufbau"], ["Krankenzusatzversicherung", "Vermögensaufbau"]).join("|") === "Krankenzusatzversicherung|Vermögensaufbau", "Name im Nominativ; Überblick nimmt nur Themen der Liste, einmal, in ihrer Reihenfolge");
  const mig = lies("db/migrations/132_vorsorge_ueberblick.sql");
  ok(/CREATE TABLE IF NOT EXISTS fiaon_vorsorge_ueberblick/.test(mig) && !/DROP|TRUNCATE|REFERENCES/i.test(mig), "Migration 132: neue Tabelle, wiederholbar, ohne DROP und ohne Fremdschlüssel");
  const oeffentlich = [lies("shared/fiaon-vorsorge.ts"), lies("server/lib/fiaon-vorsorge.ts"), lies("server/lib/fiaon-vorsorge-einladung.ts"), lies("server/mail/vorlagen/vorsorge.ts"), lies("client/src/pages/vorsorge.tsx"), lies("client/src/components/kunde/VorsorgeBuchung.tsx")].join("\n");
  ok(!/FIAON-IA-K[A-Z0-9]{6}|FIAON-[A-Z0-9]{8}-[A-Z0-9]{4}|Person \d{3,}/.test(oeffentlich), "öffentliches Repo: keine Vertrags-, Antrags- oder Personennummern in den neuen Dateien");

  ok(brevo.length === 1 && brevo[0].an === "pruef@pruefstand.test", `Mails abgefangen: ${brevo.length} (nur der Prüfversand an die Prüfadresse, keine ging raus)`);
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (Teil A, rein)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
