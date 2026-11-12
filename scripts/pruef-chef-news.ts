// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND — Chefbüro › Global-Lage › News (E-508 Scheibe 2, 12.11.2026)
//
// Teil 1 (immer, ohne Datenbank und ohne Netz): Feed lesen (RSS und Atom), Stichworte je Quelle, EZB-Kurs, Prüfung der
//   KI-Antwort, die Quellenliste selbst. Mit Rotproben.
// Teil 2 (--lokal): gegen eine LOKALE Prüf-Datenbank — Abruf mit Attrappen statt Netz (zweimal: der zweite legt nichts
//   doppelt an), eine ausgefallene Quelle hält die anderen nicht auf, Kurzfassungen mit einer KI-Attrappe (gute Antwort,
//   unlesbare Antwort, Pause), Anzeige, Ausblenden. Es geht KEIN Aufruf ins Netz und keiner an eine KI.
//   Der Prüfstand weigert sich, wenn DATABASE_URL nicht auf 127.0.0.1 oder localhost zeigt.
// ═══════════════════════════════════════════════════════════════════════════
import {
  NEWS_QUELLEN, NEWS_EZB_KURS_URL, NEWS_KI_VERSUCHE_MAX, feldText, feedDatum, feedLesen, postenPasst, ezbKursLesen, kursStand, newsKiLesen, newsKiEingabe,
  type NewsQuelle,
} from "../shared/fiaon-chef-news";

let gut = 0; let schlecht = 0;
const ok = (name: string, bedingung: unknown, zusatz = "") => { if (bedingung) { gut++; return; } schlecht++; console.error(`  ✗ ${name}${zusatz ? ` — ${zusatz}` : ""}`); };
const gleich = (name: string, ist: unknown, soll: unknown) => ok(name, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const rot = (name: string, stimmt: boolean) => ok(`Rotprobe: ${name}`, !stimmt, "die falsche Annahme wurde nicht erkannt");

const RSS = (posten: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Prüf</title>${posten}</channel></rss>`;
const POSTEN = (titel: string, link: string, datum: string, text = "") => `<item><title>${titel}</title><link><![CDATA[${link}]]></link><description><![CDATA[${text}]]></description><pubDate><![CDATA[${datum}]]></pubDate></item>`;

console.log("Teil 1 — Regeln ohne Datenbank");
gleich("Feld: CDATA und Zeichenkürzel", feldText("<![CDATA[Board&#39;s &amp; Co. &ndash; neu]]>"), "Board's & Co. – neu");
gleich("Feld: doppelt verpackte Auszeichnung", feldText("&lt;p&gt;Erster Satz.&lt;/p&gt; &lt;a href=&quot;x&quot;&gt;mehr&lt;/a&gt;"), "Erster Satz. mehr");
gleich("Datum: RFC 822", feedDatum("Thu, 12 Nov 2026 17:45:00 GMT"), "2026-11-12T17:45:00.000Z");
gleich("Datum: zweistelliges Jahr", feedDatum("Fri, 06 Nov 26 15:57:01 -0500"), "2026-11-06T20:57:01.000Z");
gleich("Datum: ISO (Atom)", feedDatum("2026-11-10T09:59:00+01:00"), "2026-11-10T08:59:00.000Z");
gleich("Datum: Unsinn", feedDatum("bald"), null);
const rss = feedLesen(RSS(POSTEN("Erste Meldung", "https://beispiel.invalid/a", "Thu, 12 Nov 2026 17:45:00 GMT", "Text der ersten Meldung.")
  + POSTEN("Titel gleich Text", "https://beispiel.invalid/b", "Wed, 11 Nov 2026 10:00:00 GMT", "Titel gleich Text")
  + POSTEN("", "https://beispiel.invalid/c", "Wed, 11 Nov 2026 10:00:00 GMT")
  + POSTEN("Ohne sichere Adresse", "http://beispiel.invalid/d", "Wed, 11 Nov 2026 10:00:00 GMT")
  + POSTEN("Doppelter Schrägstrich", "https://beispiel.invalid//press/e", "Wed, 11 Nov 2026 10:00:00 GMT", "Inhalt. Der Beitrag Doppelter Schrägstrich erschien zuerst auf Prüf .")));
gleich("RSS: nur vollständige Posten mit https-Adresse", rss.map((p) => p.link), ["https://beispiel.invalid/a", "https://beispiel.invalid/b", "https://beispiel.invalid/press/e"]);
gleich("RSS: Titel, Datum, Text", [rss[0].titel, rss[0].datum, rss[0].text], ["Erste Meldung", "2026-11-12T17:45:00.000Z", "Text der ersten Meldung."]);
gleich("RSS: Text, der nur den Titel wiederholt, zählt nicht", rss[1].text, "");
gleich("RSS: der Feed-Zusatz „erschien zuerst auf“ fällt weg", rss[2].text, "Inhalt.");
const atom = feedLesen(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Atom &amp; Meldung</title><link rel="alternate" href="https://beispiel.invalid/atom/1"/><updated>2026-11-10T09:59:00+01:00</updated><summary>Kurz.</summary></entry></feed>`);
gleich("Atom: Adresse aus href, Datum aus updated", atom, [{ titel: "Atom & Meldung", link: "https://beispiel.invalid/atom/1", datum: "2026-11-10T08:59:00.000Z", text: "Kurz." }]);
gleich("Kein Feed → leere Liste", feedLesen("<html><body>404</body></html>"), []);

const q = (key: string) => NEWS_QUELLEN.find((x) => x.key === key) as NewsQuelle;
const p = (titel: string, text = "") => ({ titel, link: "https://beispiel.invalid/x", datum: null, text });
ok("USCIS: Strafverfolgung fällt weg", !postenPasst(q("uscis"), p("Six Charged in Large-Scale Marriage Fraud Ring")) && !postenPasst(q("uscis"), p("Man Sentenced for Investor Visa Fraud", "E-2 investor")));
ok("USCIS: Visa für Unternehmer bleibt", postenPasst(q("uscis"), p("USCIS Updates Premium Processing Fees", "Form I-129")));
ok("EZB: Reden fallen weg, Beschlüsse bleiben", !postenPasst(q("ezb"), p("Philip R. Lane: The science of communication")) && postenPasst(q("ezb"), p("Monetary policy decisions")));
ok("IRS: Bürokratie-Anhörungen fallen weg", !postenPasst(q("irs"), p("Agency Information Collection Activities; Requesting Comment on Form 5472", "foreign corporation")));
ok("IRS: Meldepflicht für ausländisch gehaltene Gesellschaften bleibt", postenPasst(q("irs"), p("Information Returns of Foreign-Owned Disregarded Entities", "Form 5472")));
ok("FMA: tägliche Anleger-Warnungen fallen weg", !postenPasst(q("fma"), p("Die FMA warnt vor Angeboten von Beispiel")) && postenPasst(q("fma"), p("FMA veröffentlicht Rundschreiben zur Kreditvergabe")));
ok("FINMA: Sanktionsmeldungen fallen weg", !postenPasst(q("finma"), p("Aktualisierte Sanktionsmeldung: Beispielland")));
ok("Federal Reserve: jede Meldung der Geldpolitik zählt", postenPasst(q("fed"), p("Federal Reserve issues FOMC statement")));
rot("Strafverfolgung als Visa-Meldung gewertet", postenPasst(q("uscis"), p("Alien Charged with Illegal Voting")));

ok("Quellen: jede mit https-Adresse, eigenem Schlüssel und Obergrenze", NEWS_QUELLEN.every((x) => /^https:\/\//.test(x.url) && x.max > 0 && x.max <= 10) && new Set(NEWS_QUELLEN.map((x) => x.key)).size === NEWS_QUELLEN.length && NEWS_QUELLEN.length >= 6);
ok("Quellen: nur amtliche Stellen", NEWS_QUELLEN.every((x) => /(federalreserve\.gov|ecb\.europa\.eu|federalregister\.gov|uscis\.gov|fma\.gv\.at|finma\.ch)\//.test(x.url)) && /ecb\.europa\.eu/.test(NEWS_EZB_KURS_URL));

const EZB = `<gesmes:Envelope><Cube><Cube time="2026-11-12"><Cube currency="USD" rate="1.1081"/><Cube currency="JPY" rate="176.96"/></Cube><Cube time='2026-11-11'><Cube currency='USD' rate='1.1127'/></Cube><Cube time="2026-10-12"><Cube currency="USD" rate="1.1188"/></Cube><Cube time="2026-10-09"><Cube currency="JPY" rate="170"/></Cube></Cube></gesmes:Envelope>`;
const werte = ezbKursLesen(EZB);
gleich("EZB: Dollar-Kurse, älteste zuerst, beide Schreibweisen", werte, [{ tag: "2026-10-12", kurs: 1.1188 }, { tag: "2026-11-11", kurs: 1.1127 }, { tag: "2026-11-12", kurs: 1.1081 }]);
const ks = kursStand(werte)!;
gleich("Kurs: Stand, Vortag, Veränderung, vor 30 Tagen", [ks.tag, ks.kurs, ks.vortag?.tag, ks.veraenderungProzent, ks.vor30?.tag], ["2026-11-12", 1.1081, "2026-11-11", -0.41, "2026-10-12"]);
gleich("Kurs: ohne Werte kein Stand", kursStand([]), null);
gleich("EZB: Unsinn → leer", ezbKursLesen("<html/>"), []);

gleich("KI: saubere Antwort", newsKiLesen('{"kurz":"Die Notenbank lässt den Leitzins unverändert.","bedeutung":"Kredite in den USA bleiben gleich teuer.","relevanz":3}'), { kurz: "Die Notenbank lässt den Leitzins unverändert.", bedeutung: "Kredite in den USA bleiben gleich teuer.", relevanz: 3 });
ok("KI: Antwort im Code-Zaun wird gelesen", newsKiLesen('```json\n{"kurz":"Ein ganzer kurzer Satz.","bedeutung":"Kein direkter Bezug.","relevanz":0}\n```')?.relevanz === 0);
ok("KI: kein JSON, falsche Stufe, zu kurz, zu lang → abgelehnt", !newsKiLesen("Die Fed …") && !newsKiLesen('{"kurz":"Ein ganzer kurzer Satz.","bedeutung":"Kein direkter Bezug.","relevanz":7}')
  && !newsKiLesen('{"kurz":"kurz","bedeutung":"Kein direkter Bezug.","relevanz":1}') && !newsKiLesen(JSON.stringify({ kurz: "x".repeat(500), bedeutung: "Kein direkter Bezug.", relevanz: 1 })));
ok("KI: Auszeichnung in der Antwort wird entfernt", newsKiLesen('{"kurz":"<b>Die Notenbank</b> lässt den Zins gleich.","bedeutung":"Kein direkter Bezug.","relevanz":1}')?.kurz === "Die Notenbank lässt den Zins gleich.");
ok("KI-Eingabe: Quelle, Titel, Text — und der Hinweis, wenn der Feed keinen Text hat", newsKiEingabe(q("fed"), { titel: "T", text: "" }).includes("nur der Titel") && newsKiEingabe(q("fed"), { titel: "T", text: "Inhalt" }).includes("Federal Reserve"));
console.log(`  ${gut} bestanden, ${schlecht} durchgefallen`);

if (process.argv.includes("--lokal")) {
  const url = String(process.env.DATABASE_URL || "");
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error("Teil 2 läuft nur gegen eine lokale Datenbank — abgebrochen."); process.exit(3); }
  console.log("Teil 2 — lokale Prüf-Datenbank (Attrappen statt Netz und KI)");
  const { sqlPool } = await import("../server/lib/db-pool");
  const N = await import("../server/lib/fiaon-chef-news");
  const lauf = `p${Date.now()}`;
  const jetzt = new Date();
  const tag = (minus: number) => new Date(jetzt.getTime() - minus * 86_400_000).toUTCString();
  const adresse = (n: string) => `https://pruefstand.invalid/${lauf}/${n}`;
  const fed = RSS([1, 2, 3, 4, 5, 6, 7, 8].map((i) => POSTEN(`PRUEFSTAND Fed ${i}`, adresse(`fed-${i}`), tag(i), `Inhalt ${i}`)).join("") + POSTEN("PRUEFSTAND Fed uralt", adresse("fed-alt"), tag(90), "alt"));
  const fma = RSS(POSTEN("PRUEFSTAND FMA Rundschreiben", adresse("fma-1"), tag(1), "Inhalt") + POSTEN("Die FMA warnt vor Angeboten von PRUEFSTAND", adresse("fma-2"), tag(1), "Warnung"));
  let aufrufe = 0;
  const holen: import("../server/lib/fiaon-chef-news").Holen = async (u) => {
    aufrufe++;
    if (u === q("fed").url) return fed;
    if (u === q("fma").url) return fma;
    if (u === q("finma").url) throw new Error("HTTP 503");
    if (u === NEWS_EZB_KURS_URL) return EZB;
    return RSS("");
  };
  const [kursVorher] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'chef_kurs_eurusd'`) as any[];
  const [abrufVorher] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'chef_news_abruf_am'`) as any[];
  try {
    const [tab] = (await sqlPool`SELECT to_regclass('public.fiaon_global_news') AS t`) as any[];
    if (!tab?.t) { console.error("fiaon_global_news fehlt — erst scripts/run-migrations.mjs gegen die lokale DB laufen lassen."); process.exit(3); }
    const a1 = await N.newsHolen(holen, jetzt);
    gleich("Abruf: Obergrenze je Quelle, alte Meldung und Warnung fallen weg", [a1.jeQuelle.fed, a1.jeQuelle.fma, a1.neu], [q("fed").max, 1, q("fed").max + 1]);
    ok("Abruf: eine ausgefallene Quelle hält die anderen nicht auf", a1.fehler.finma === "HTTP 503" && Object.keys(a1.fehler).length === 1);
    gleich("Abruf: Kurs gelesen", a1.kurs, { tag: "2026-11-12", kurs: 1.1081 });
    ok("Abruf: jede Quelle und der Kurs wurden gerufen", aufrufe === NEWS_QUELLEN.length + 1, String(aufrufe));
    const a2 = await N.newsHolen(holen, jetzt);
    gleich("Zweiter Abruf: die schon bekannten Meldungen entstehen nicht doppelt", [a2.jeQuelle.fed, a2.jeQuelle.fma], [8 - q("fed").max, 0]);
    const [zahl] = (await sqlPool`SELECT COUNT(*)::int AS n, COUNT(DISTINCT link)::int AS d FROM fiaon_global_news WHERE link LIKE ${`https://pruefstand.invalid/${lauf}/%`}`) as any[];
    gleich("Datenbank: neun Zeilen, jede Adresse einmal", [zahl.n, zahl.d], [9, 9]);

    // Kurzfassungen mit Attrappe: erste gut, zweite unlesbar, dritte Pause.
    await sqlPool`UPDATE fiaon_global_news SET ki_versuche = ${NEWS_KI_VERSUCHE_MAX} WHERE ki_am IS NULL AND link NOT LIKE ${`https://pruefstand.invalid/${lauf}/%`}`; // fremde Zeilen der Kopie bleiben außen vor
    let n = 0;
    const frage: import("../server/lib/fiaon-chef-news").KiFrage = async (_s, nutzer) => {
      n++;
      if (n === 1) return { ok: true, modell: "attrappe", text: JSON.stringify({ kurz: "PRUEFSTAND Die Notenbank lässt den Leitzins gleich.", bedeutung: "Kredite in den USA bleiben gleich teuer.", relevanz: 3 }) };
      if (n === 2) return { ok: true, modell: "attrappe", text: "kein JSON" };
      if (n === 3) return { ok: true, modell: "attrappe", text: JSON.stringify({ kurz: "PRUEFSTAND Ohne Bezug für uns, nur am Rand.", bedeutung: "Kein direkter Bezug.", relevanz: 0 }) };
      return { ok: false, grund: "KI pausiert (Attrappe)", pause: true };
      void nutzer;
    };
    const an = async () => ({ an: true, grund: null });
    const k1 = await N.newsKi({ max: 6, frage, stand: an });
    gleich("Kurzfassungen: zwei geschrieben, bei der Pause aufgehört", [k1.geschrieben, n, k1.grund], [2, 4, "KI pausiert (Attrappe)"]);
    const zeilen = (await sqlPool`SELECT kurz_de, relevanz, ki_versuche, ki_fehler, ki_am IS NOT NULL AS fertig FROM fiaon_global_news WHERE link LIKE ${`https://pruefstand.invalid/${lauf}/%`} ORDER BY COALESCE(veroeffentlicht_am, erstellt_am) DESC`) as any[];
    ok("Unlesbare Antwort zählt als Versuch, die Pause nicht", zeilen.filter((z) => z.ki_versuche === 1 && z.ki_fehler === "Antwort nicht lesbar").length === 1 && zeilen.filter((z) => !z.fertig && z.ki_versuche === 0).length === 6);
    const aus = await N.newsKi({ max: 6, frage, stand: async () => ({ an: false, grund: "Der Tagesdeckel für Kurzfassungen ist erreicht (1 $)." }) });
    gleich("Deckel erreicht: nichts geschrieben, der Grund steht da", [aus.geschrieben, aus.grund, n], [0, "Der Tagesdeckel für Kurzfassungen ist erreicht (1 $).", 4]);

    const sicht = await N.newsLesen("inhaber");
    const eigene = sicht.meldungen.filter((m) => m.link.includes(`/${lauf}/`));
    ok("Anzeige: „kein Bezug“ (Stufe 0) steht nicht in der Lage, der Rest schon", eigene.length === 8 && !eigene.some((m) => (m.kurz ?? "").includes("Ohne Bezug")) && eigene.some((m) => m.relevanz === 3 && m.bedeutung === "Kredite in den USA bleiben gleich teuer."));
    ok("Anzeige: ohne Kurzfassung steht der Text des Feeds da, mit Kurzfassung nicht", eigene.filter((m) => !m.kurz).every((m) => (m.text ?? "").startsWith("Inhalt")) && eigene.filter((m) => m.kurz).every((m) => m.text === null));
    gleich("Anzeige: Kurs mit Veränderung", [sicht.kurs?.kurs, sicht.kurs?.veraenderungProzent], [1.1081, -0.41]);
    gleich("Leitung darf lesen, aber nicht steuern", [(await N.newsLesen("leitung")).darfSteuern, sicht.darfSteuern], [false, true]);
    const erste = eigene[0];
    ok("Ausblenden wirkt", (await N.newsAusblenden(erste.id, "Prüfstand")).ok && !(await N.newsLesen("inhaber")).meldungen.some((m) => m.id === erste.id));
    ok("Zweimal ausblenden geht nicht", !(await N.newsAusblenden(erste.id, "Prüfstand")).ok);
    const sofort = await N.newsJetzt();
    ok("„Jetzt abrufen“ direkt nach einem Abruf wird gebremst", !sofort.ok && (sofort as any).status === 429);
    console.log(`  gesamt ${gut} bestanden, ${schlecht} durchgefallen`);
  } finally {
    // Aufräumen läuft immer: Prüf-Meldungen weich ausblenden, fremde Zeilen wieder freigeben, Einstellungen zurück.
    await sqlPool`UPDATE fiaon_global_news SET ausgeblendet_am = COALESCE(ausgeblendet_am, NOW()), ausgeblendet_von = 'Prüfstand E-508' WHERE link LIKE 'https://pruefstand.invalid/%'`.catch(() => {});
    await sqlPool`UPDATE fiaon_global_news SET ki_versuche = 0 WHERE ki_am IS NULL AND ki_versuche = ${NEWS_KI_VERSUCHE_MAX} AND ki_fehler IS NULL`.catch(() => {});
    for (const [key, alt] of [["chef_kurs_eurusd", kursVorher], ["chef_news_abruf_am", abrufVorher]] as const) {
      if (alt) await sqlPool`UPDATE fiaon_settings SET value = ${alt.value} WHERE key = ${key}`.catch(() => {});
      else await sqlPool`DELETE FROM fiaon_settings WHERE key = ${key}`.catch(() => {});
    }
    await sqlPool.end({ timeout: 5 }).catch(() => {});
  }
}
if (schlecht) { console.error(`\nDURCHGEFALLEN: ${schlecht}`); process.exit(1); }
console.log(`\nALLES GRÜN: ${gut} Prüfungen`);
