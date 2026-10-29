// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE EHRLICHE KI-KASSE (E-458, 29.10.2026)
//
// Justin 29.10. („go Plan“, Punkt 7): Gesamtdeckel in echtem Geld, ≈ 75 % B2B, Antworten an Menschen mit
// Vorrang, Reserve ≈ 5 %, Nachhol-Bremse nach einer Pause, Sparpaket E-262 (Prompt-Caching, kein eigener
// Formatierungs-Aufruf, Modell je Aufgabe).
//
//   1. Preise in Dollar-Cent, gecachte Eingabe, Responses- und Chat-Zählung, unbekanntes Modell = teuer
//   2. Der Berliner Tag (Sommer/Winter, Mitternacht)
//   3. Dienst → Bereich, Anteile (Grenze für Register und Oberfläche)
//   4. kasseEntscheiden: Anteil, Reserve, Vorrang, Gesamtdeckel, Kasse aus, Nachhol-Bremse (ROT-PROBEN)
//   5. Modell je Aufgabe (Texte an Kunden bleiben gpt-5.5)
//   6. Register: Schalter, Vorgaben, Grenzen; Umrechnung der alten Deckel
//   7. Quelltext-Wände: Kasse in openaiFetch, kein Formatierungs-Aufruf, Cache-Schlüssel, Reihenfolge der Aufträge
//   8. Gleicher Textanfang: Persona und Hauswissen sind für jeden Kunden gleich
//
// Offline, ohne Datenbank und ohne Netz:
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-ki-kasse.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as K from "../shared/fiaon-ki-kasse";
import { REGISTER, KI_SCHLUESSEL, wertPruefen, registerEintrag } from "../shared/fiaon-ki-schalter";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };
const nah = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lese = (p: string) => fs.readFileSync(path.join(WURZEL, p), "utf8");

console.log("── 1 · Preise und Zählung");
ok(K.KI_PREISE["gpt-5.5"].ein === 0.5 && K.KI_PREISE["gpt-5.5"].gecacht === 0.05 && K.KI_PREISE["gpt-5.5"].aus === 3.0, "gpt-5.5: 5 $ / 0,50 $ gecacht / 30 $ je 1 Mio. Token (E-258)");
for (const m of ["gpt-5.4", "gpt-5.4-mini", "gpt-4.1", "gpt-4.1-mini"]) ok(K.preisFuer(m).bekannt, `${m} steht in der Preistabelle`);
// 1 Mio. Eingabe + 100.000 Ausgabe bei gpt-5.5 = 5 $ + 3 $ = 800 Cent
ok(nah(K.centsFuer("gpt-5.5", { prompt_tokens: 1_000_000, completion_tokens: 100_000 }), 800), "gpt-5.5: 1 Mio. ein + 100.000 aus = 8,00 $");
// davon 800.000 aus dem Cache: 200.000 × 0,5 + 800.000 × 0,05 = 100 + 40 Cent, dazu 300 Cent Ausgabe
ok(nah(K.centsFuer("gpt-5.5", { prompt_tokens: 1_000_000, completion_tokens: 100_000, prompt_tokens_details: { cached_tokens: 800_000 } }), 440), "gecachte Eingabe zum Cache-Preis (Chat-Form): 4,40 $");
ok(nah(K.centsFuer("gpt-5.5", { input_tokens: 1_000_000, output_tokens: 100_000, input_tokens_details: { cached_tokens: 800_000 } }), 440), "dasselbe in der Responses-Form");
ok(nah(K.centsFuer("gpt-4.1-mini-2025-04-14", { prompt_tokens: 100_000, completion_tokens: 10_000 }), 5.6), "Modell mit Datum zählt wie ohne (gpt-4.1-mini: 4 + 1,6 Cent)");
ok(!K.preisFuer("gpt-6-luna").bekannt && nah(K.centsFuer("gpt-6-luna", { prompt_tokens: 1000 }), 0.5), "unbekanntes Modell → Preis von gpt-5.5 (lieber zu teuer)");
const z = K.zaehlungAus({ prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 500 }, completion_tokens: 40, completion_tokens_details: { reasoning_tokens: 90 } });
ok(z.gecacht === 100 && z.denken === 40, "Cache nie größer als die Eingabe, Denken nie größer als die Ausgabe");
ok(K.zaehlungAus(null).ein === 0 && K.zaehlungAus({ prompt_tokens: "kaputt" }).ein === 0, "fehlende oder kaputte Zählung → 0");
// Die Hausrechnung im Protokoll ist dieselbe Rechnung (fiaon-postmeister-schema.ts)
const S = await import("../server/lib/fiaon-postmeister-schema");
ok(nah(S.kostenCentsAus("gpt-5.5", { prompt_tokens: 20_000, completion_tokens: 800 }), K.centsFuer("gpt-5.5", { prompt_tokens: 20_000, completion_tokens: 800 })), "kostenCentsAus = Kasse (eine Rechnung)");
ok(nah(S.kostenCentsAus("gpt-5.5", { prompt_tokens: 20_000, completion_tokens: 800 }), 12.4), "ROT-PROBE Postfach-Aufruf 20.000/800: 12,4 Cent (alte Tabelle: 3,3 Cent)");

console.log("── 2 · Der Berliner Tag");
ok(K.kasseTag(new Date("2026-10-29T22:59:00Z")) === "2026-10-29", "29.10. 23:59 Berlin (Winterzeit) ist noch der 29.");
ok(K.kasseTag(new Date("2026-10-29T23:30:00Z")) === "2026-10-30", "29.10. 23:30 UTC ist in Berlin schon der 30. (vorher zählte die Kasse bis 01:00 weiter)");
ok(K.kasseTag(new Date("2026-07-01T22:30:00Z")) === "2026-07-02", "Sommerzeit: 22:30 UTC ist 00:30 Berlin am Folgetag");
ok(K.kasseMinuten(new Date("2026-10-29T07:15:00Z")) === 8 * 60 + 15, "Minuten seit Mitternacht in Berlin (08:15)");

console.log("── 3 · Bereiche und Anteile");
const bereiche: [string, K.KasseBereich][] = [
  ["radar", "b2b"], ["radar-faden", "b2b"], ["ratgeber", "b2b"], ["partner-crm", "b2b"],
  ["postmeister-antwort", "menschen"], ["postmeister-einordnen", "menschen"], ["mara-whatsapp", "menschen"], ["mara-anliegen", "menschen"], ["kontakt-chat", "menschen"],
  ["mara-aktion", "privat"], ["mara-auftrag", "privat"], ["ocr", "haus"], ["pruef-mara", "haus"], ["copilot", "haus"], ["unbekannt", "haus"],
];
for (const [d, b] of bereiche) ok(K.bereichFuer(d) === b, `${d} → ${b}`);
const v = K.KASSE_ANTEILE_VORGABE;
ok(v.b2b === 75 && v.reserve === 5 && K.KASSE_TOEPFE.reduce((x, k) => x + v[k], 0) === 100, "Vorgabe: B2B 75 %, Reserve 5 %, zusammen 100 %");
ok(K.anteileFehler(v) === null, "Vorgabe besteht die eigene Grenze");
ok(/100 %/.test(K.anteileFehler({ ...v, b2b: 70 }) ?? ""), "ROT-PROBE Summe 95 % → Fehler");
ok(/Unbekannter Topf/.test(K.anteileFehler({ ...v, radar: 1 } as any) ?? ""), "fremder Topf → Fehler");
ok(/mindestens 5/.test(K.anteileFehler({ b2b: 85, menschen: 0, privat: 5, haus: 5, reserve: 5 }) ?? ""), "Antworten an Menschen nie unter 5 %");
ok(!!K.anteileFehler({ ...v, b2b: 74.5, haus: 5.5 }), "nur ganze Prozent");
ok(JSON.stringify(K.anteileLesen("kaputt")) === JSON.stringify(v) && JSON.stringify(K.anteileLesen('{"b2b":10}')) === JSON.stringify(v), "kaputte oder unvollständige Zeile → Vorgabe");
ok(K.anteileLesen('{"b2b":60,"menschen":20,"privat":5,"haus":10,"reserve":5}').menschen === 20, "gültige Zeile gilt");

console.log("── 4 · Die Entscheidung (Gesamtdeckel 55 $)");
const E: K.KasseEinstellung = { an: true, tagUsd: 55, anteile: { ...v }, nachholUsd: 8 };
const stand = (h: Partial<Record<K.KasseBereich, number>>, extra: Partial<K.KasseStand> = {}): K.KasseStand =>
  ({ heuteCents: { b2b: 0, menschen: 0, privat: 0, haus: 0, ...h }, stundeCents: 0, nachholSeit: null, ...extra });
const jetzt = new Date("2026-10-29T12:00:00Z");
const u = (s: K.KasseStand, d: string, e: K.KasseEinstellung = E, j: Date = jetzt) => K.kasseEntscheiden(e, s, d, j);
ok(u(stand({}), "radar").erlaubt, "frischer Tag: Radar darf");
ok(K.topfCents(E, "b2b") === 4125 && K.topfCents(E, "reserve") === 275, "Töpfe: B2B 41,25 $, Reserve 2,75 $");
const b2bVoll = u(stand({ b2b: 4125 }), "radar");
ok(!b2bVoll.erlaubt && b2bVoll.art === "anteil" && /B2B-Neukunden/.test(b2bVoll.grund), "ROT-PROBE B2B-Topf leer → Radar wartet (Anteil)");
ok(u(stand({ b2b: 4125 }), "postmeister-antwort").erlaubt, "… Antworten an Menschen laufen weiter");
const menschenDrueber = u(stand({ menschen: 1200 }), "mara-whatsapp");
ok(menschenDrueber.erlaubt && menschenDrueber.ueberAnteil, "Vorrang: WhatsApp darf über ihren Topf (12 $ von 5,50 $)");
ok(u(stand({ menschen: 1200 }), "mara-aktion").erlaubt, "… und die anderen arbeiten weiter, solange vor der Reserve Platz ist");
const reserve = u(stand({ b2b: 4000, menschen: 1000, privat: 225 }), "ocr");
ok(!reserve.erlaubt && reserve.art === "reserve", "ROT-PROBE 52,25 $ erreicht: der Rest gehört den Antworten an Menschen");
ok(u(stand({ b2b: 4000, menschen: 1000, privat: 225 }), "postmeister-antwort").erlaubt, "… Postfach darf die Reserve nehmen");
const voll = u(stand({ b2b: 4125, menschen: 1375 }), "postmeister-antwort");
ok(!voll.erlaubt && voll.art === "gesamt" && /morgen um 0 Uhr/.test(voll.grund), "ROT-PROBE 55 $ erreicht: auch Antworten warten bis 0 Uhr");
ok(u(stand({ b2b: 9999, menschen: 9999 }), "radar", { ...E, an: false }).erlaubt, "Kasse aus: misst nur, bremst nie");
const nach = (min: number) => new Date(jetzt.getTime() - min * 60_000).toISOString();
const n1 = u(stand({}, { nachholSeit: nach(10) }), "radar");
ok(!n1.erlaubt && n1.art === "nachhol_vorrang", "Nachhol-Bremse: in der ersten halben Stunde nur Antworten (Radar wartet)");
ok(u(stand({}, { nachholSeit: nach(10) }), "postmeister-antwort").erlaubt, "… das Postfach holt sofort nach");
const n2 = u(stand({}, { nachholSeit: nach(10), stundeCents: 820 }), "postmeister-antwort");
ok(!n2.erlaubt && n2.art === "nachhol" && /in wenigen Minuten/.test(n2.grund), "ROT-PROBE 8,20 $ in der letzten Stunde: auch das Postfach wartet ein paar Minuten");
ok(u(stand({}, { nachholSeit: nach(40), stundeCents: 300 }), "radar").erlaubt, "nach 30 Minuten und unter 4 $ je Stunde: Radar wieder dabei");
ok(!u(stand({}, { nachholSeit: nach(40), stundeCents: 450 }), "radar").erlaubt, "… ab 4 $ (halbe Bremse) wartet der Radar wieder");
const fehlerText = (await import("../server/lib/fiaon-ki-pause")).kiPauseMeldung("kasse", "openai", n1.erlaubt ? "" : n1.grund);
ok(/^KI pausiert — KI-Kasse: /.test(fehlerText), "Meldung beginnt mit „KI pausiert“ — jeder Aufrufer lässt liegen wie in der Pause", fehlerText.slice(0, 80));

console.log("── 4b · Wann gilt die Nachhol-Bremse?");
const p = (seitMin: number, endeMin: number, an = false) => ({ an, seit: nach(seitMin), aufgehobenAm: nach(endeMin) });
ok(K.nachholSeitAus(p(180, 60), jetzt) === nach(60), "Pause 2 Stunden, vor 1 Stunde beendet → Bremse");
ok(K.nachholSeitAus(p(600, 420), jetzt) === null, "vor 7 Stunden beendet → keine Bremse mehr");
ok(K.nachholSeitAus(p(70, 60), jetzt) === null, "nur 10 Minuten Pause → kein Rückstand, keine Bremse");
ok(K.nachholSeitAus({ ...p(180, 60), an: true }, jetzt) === null && K.nachholSeitAus(null, jetzt) === null, "laufende Pause oder kein Zustand → keine Bremse");

console.log("── 5 · Modell je Aufgabe");
const a = (x: K.KiAufgabe["aufgabe"]) => K.KI_AUFGABEN.find((y) => y.aufgabe === x)!;
ok(K.KI_AUFGABEN.filter((x) => x.kunde).every((x) => x.vorgabe === "gpt-5.5" && !x.schluessel), "Texte an Kunden: gpt-5.5, nicht umschaltbar");
ok(K.modellWahl(a("postfach"), "gpt-5.4-mini", "") === "gpt-5.5", "ROT-PROBE ein gespeicherter Wert ändert das Postfach nie");
ok(K.modellWahl(a("einordnen"), "gpt-5.4-mini", "") === "gpt-5.4-mini" && K.modellWahl(a("einordnen"), "gpt-3", "") === "gpt-5.5", "Einordnen: nur erlaubte Modelle");
ok(K.modellWahl(a("whatsapp"), null, "gpt-5.4") === "gpt-5.4", "Notfall-Weiche auf Render (je Aufgabe eine eigene) gewinnt");
ok(new Set(K.KI_AUFGABEN.map((x) => x.env)).size === K.KI_AUFGABEN.length, "jede Aufgabe hat ihre eigene Weiche (nicht mehr EINE Variable für alle)");
ok(K.cacheSchluessel("postmeister-antwort", "kunde-wabc") === "fiaon-postmeister-antwort-kunde-wabc" && !/@|\s/.test(K.cacheSchluessel("x y@z", "a b")), "Cache-Schlüssel kurz, ohne Leerzeichen und Personenbezug");
ok(K.werkzeugSignatur([{ function: { name: "a" } }, { function: { name: "b" } }]) === K.werkzeugSignatur([{ name: "a" }, { name: "b" }]) && K.werkzeugSignatur([{ name: "a" }]) !== K.werkzeugSignatur([{ name: "b" }]), "Werkzeug-Fingerabdruck: gleiche Werkzeuge, gleicher Wert");

console.log("── 6 · Register und Umrechnung");
for (const k of ["ki_kasse_an", "ki_kasse_tag_usd", "ki_kasse_anteile", "ki_kasse_nachhol_je_stunde", "ki_modell_einordnen", "ki_modell_ratgeber"]) {
  const e = registerEintrag(k);
  ok(!!e && e.gruppe === "kasse" && KI_SCHLUESSEL.includes(k), `${k}: im Register (Kasse), Setzer /chef/ki/einstellung`);
}
ok(registerEintrag("ki_kasse_tag_usd")!.vorgabe === "55" && registerEintrag("ki_kasse_nachhol_je_stunde")!.vorgabe === "8", "Vorgaben: 55 $ je Tag, 8 $ je Stunde nach einer Pause");
ok(!wertPruefen(registerEintrag("ki_kasse_anteile")!, '{"b2b":70,"menschen":10,"privat":5,"haus":5,"reserve":5}').ok, "Register lehnt Anteile ab, die nicht 100 % ergeben");
ok(wertPruefen(registerEintrag("ki_kasse_anteile")!, registerEintrag("ki_kasse_anteile")!.vorgabe).ok, "Vorgabe der Anteile besteht das Register");
ok(!wertPruefen(registerEintrag("ki_modell_einordnen")!, "gpt-3").ok, "Modell außerhalb der Liste → abgelehnt");
ok(registerEintrag("postmeister_tag_euro")!.vorgabe === "40" && registerEintrag("mara_wa_tag_euro")!.vorgabe === "30" && registerEintrag("mara_aktion_tag_euro")!.vorgabe === "30", "Deckel je Dienst in echten Dollar: Postfach 40, WhatsApp 30, Mail-Aktion 30");
ok(REGISTER.filter((e) => /_tag_euro$/.test(e.schluessel) && e.gruppe === "kasse" && e.dienst !== "aras").every((e) => /Dollar/.test(e.satz)), "jeder KI-Deckel sagt „Dollar“");
const KS = await import("../server/lib/fiaon-ki-kasse");
ok(KS.deckelUmrechnen("mara_aktion_tag_euro", "80") === 30, "Umrechnung: Mail-Aktion 80 „€“ (≈ 264 $) → 30 $ (Notbremse)");
ok(KS.deckelUmrechnen("postmeister_tag_euro", "35") === 40 && KS.deckelUmrechnen("postmeister_tag_euro", "5") === 17, "Umrechnung: 35 → 40 $, ein bewusst kleiner Deckel 5 → 17 $ (×3,3)");
ok(KS.deckelUmrechnen("mara_wa_tag_euro", "") === null && KS.deckelUmrechnen("mara_wa_tag_euro", "abc") === null, "nichts gespeichert → nichts umzurechnen (die neue Vorgabe gilt)");
ok(JSON.stringify([...KS.KASSE_LESE_SCHLUESSEL].sort()) === JSON.stringify([...Object.values(K.KASSE_SCHLUESSEL), ...K.KI_AUFGABEN.map((x) => x.schluessel).filter(Boolean), "ki_pause"].sort()), "Die Kasse liest genau ihre Register-Schlüssel und ki_pause");

console.log("── 7 · Quelltext-Wände");
const pause = lese("server/lib/fiaon-ki-pause.ts");
const fetchKoerper = pause.slice(pause.indexOf("export async function openaiFetch("), pause.indexOf("export function kiLesenMoeglich"));
ok(/await kiBereit\(dienst, "openai"\);\s*await kasseBereit\(dienst, "openai"\);\s*const res = await rohFetch\(\)\(url, init\);/.test(fetchKoerper), "openaiFetch: erst Pause, dann Kasse, dann das Netz");
ok((pause.match(/await kasseBereit\(dienst/g) ?? []).length === 3, "Kasse auch im Request-Weg (SDK) und im Claude-Rückweg");
ok(/art === "kasse"/.test(pause) && /"drossel" \| "kasse"/.test(pause), "Art „kasse“: nie gespeichert, kein Alarm, kein Band");
const agent = lese("server/lib/fiaon-postmeister-agent.ts");
const schleife = agent.slice(agent.indexOf("const schemaSofort = aktiverAnbieter() !== \"claude\";"), agent.indexOf("return { ...leer, grund: \"Zu viele Werkzeugrunden ohne Antwort\""));
ok(schleife.length > 100 && /schema: mitSchema \? SCHEMA_B : undefined/.test(schleife), "Postfach: Schema ab der ersten Runde (OpenAI)");
ok(/if \(!mitSchema\) \{[\s\S]{0,400}Schreibe jetzt die Antwort an den Kunden im vorgegebenen Format/.test(schleife) && (agent.match(/Schreibe jetzt die Antwort an den Kunden im vorgegebenen Format/g) ?? []).length === 1, "ROT-PROBE kein eigener Formatierungs-Aufruf mehr (nur noch auf dem Claude-Rückweg)");
ok(/body\.prompt_cache_key = cacheSchluessel\(/.test(agent) && /cacheSchluesselAus = true/.test(agent), "kiAufruf: prompt_cache_key je Dienst und Werkzeug-Satz, mit Rückweg ohne ihn");
ok(/cached_tokens: Number\(u\.input_tokens_details\?\.cached_tokens/.test(agent), "Responses → Chat: gecachte Eingabe geht mit");
ok(/export const MODELL = \(\) => kiModell\("postfach"\)/.test(agent) && /const MODELL_KLEIN = \(\) => kiModell\("einordnen"\)/.test(agent), "Postfach und Einordnen: Modell je Aufgabe");
const sp = agent.slice(agent.indexOf("function systemPrompt("), agent.indexOf("function systemPrompt(") + 60_000);
const iHaus = sp.indexOf("`DAS HAUS — das darfst du nennen"), iPersona = sp.indexOf('personaText("mail"'), iHeute = sp.indexOf("`HEUTE ist ${ein.heute}.`"), iGed = sp.indexOf("`DEIN GEDÄCHTNIS ZU DIESEM MENSCHEN"), iLage = sp.indexOf("`LAGE DIESES KUNDEN");
ok(iHaus > 0 && iHaus < iPersona && iPersona < iHeute && iHeute < iGed && iGed < iLage, "Postfach-Auftrag: Hauswissen → Persona → HEUTE → Gedächtnis → Lage", `${iHaus}/${iPersona}/${iHeute}/${iGed}/${iLage}`);
ok((sp.slice(0, iLage + 20_000).match(/wissenFakten\(\),/g) ?? []).length === 1, "Hauswissen genau einmal im Postfach-Auftrag");
const wa = lese("server/lib/fiaon-whatsapp-mara.ts");
const auftragWa = wa.slice(wa.indexOf("function auftrag(ein: {"), wa.indexOf("/** Hat er nach dem Ende seines Vertrags über ein Formular neu angefragt? */"));
const wHaus = auftragWa.indexOf("`DAS HAUS IN FAKTEN"), wPersona = auftragWa.indexOf('personaText("whatsapp"'), wKi = auftragWa.indexOf("PFLICHT IN DIESER ANTWORT"), wJetzt = auftragWa.indexOf("`JETZT: ${ein.jetzt"), wWer = auftragWa.indexOf("`WER DIR SCHREIBT");
ok(wHaus > 0 && wHaus < wPersona && wPersona < wKi && wJetzt > wKi && wJetzt < wWer && wWer - wJetzt < 120, "WhatsApp-Auftrag: Hauswissen → Persona → Vorstellung … JETZT direkt vor WER DIR SCHREIBT", `${wHaus}/${wPersona}/${wKi}/${wJetzt}/${wWer}`);
ok((auftragWa.match(/`JETZT: \$\{ein\.jetzt/g) ?? []).length === 1, "ROT-PROBE die Uhrzeit mit Minute steht nur noch einmal — unten");
ok(!/import \{[^}]*\bMODELL\b[^}]*\} from "\.\/fiaon-postmeister-agent"/.test(wa) && /const MODELL = \(\) => kiModell\("whatsapp"\)/.test(wa), "WhatsApp: eigenes Modell (nicht mehr das des Postfachs)");
const aktion = lese("server/lib/fiaon-mara-aktion.ts");
const ap = aktion.slice(aktion.indexOf("function aktionsPrompt("), aktion.indexOf("export function absaetzeFassen("));
ok(ap.indexOf('personaText("mail"') > 0 && ap.indexOf('personaText("mail"') < ap.indexOf("`DEIN ZIEL:") && (ap.match(/personaText\("mail"/g) ?? []).length === 1, "Mail-Aktion: Persona direkt nach dem ersten Satz (einmal)");
ok(/const AKTION_MODELL = \(\) => kiModell\("aktion"\)/.test(aktion) && !/\bMODELL\(\)/.test(aktion.replace(/AKTION_MODELL\(\)/g, "")), "Mail-Aktion: eigenes Modell");
const ton = lese("shared/fiaon-mara-ton.ts");
const pt = ton.slice(ton.indexOf("export function personaText("), ton.indexOf("// ── Die Tonprüfung"));
ok(pt.indexOf("formText(kanal),") > 0 && pt.indexOf("formText(kanal),") < pt.indexOf("betreuerZeile,\n  ].join"), "Persona: SEIN Betreuer steht am Ende");
const schema = lese("server/lib/fiaon-postmeister-schema.ts");
ok(/cached_tokens, dauer_ms/.test(schema) && /ADD COLUMN IF NOT EXISTS cached_tokens/.test(schema), "Protokoll schreibt cached_tokens (Spalte wird angelegt)");
ok(/AT TIME ZONE 'Europe\/Berlin'/.test(schema.slice(schema.indexOf("export async function kostenHeute"))) && !/date_trunc\('day', NOW\(\)\)/.test(schema), "kostenHeute: Berliner Tag, nicht mehr UTC");
ok(!/const PREIS: Record/.test(schema) && /centsFuer\(ein\.modell, ein\.usage\)/.test(schema), "ROT-PROBE die alte Preistabelle ist weg");
ok(/kostenNachtragen\(ein\.dienst, kosten\)/.test(schema), "nutzungMerken meldet jeden Aufruf sofort der Kasse");
const routes = lese("server/routes.ts");
ok(/tageslauf\('ki_kasse', /.test(routes), "Takt ki_kasse (alle 10 Minuten)");
const ui = lese("client/src/components/admin/ChefKiEinstellungen.tsx");
ok(/useTakt<KasseLage>\("\/chef\/ki\/kasse"/.test(ui) && /data-ki="kasse-toepfe"/.test(ui) && /AnteileFeld/.test(ui) && /data-ki="kasse-modelle"/.test(ui), "Chefbüro › KI-Team › Einstellungen & Kasse zeigt Töpfe, Anteile und Modelle");
ok(/"\/chef\/ki\/kasse"/.test(lese("server/routes/fiaon-chef-ki.ts")), "Route GET /chef/ki/kasse");
const rg = lese("client/src/pages/agent/rundgaenge.ts");
const rgk = rg.slice(rg.indexOf("export const RUNDGANG_KI_EINSTELLUNGEN"), rg.indexOf("// CHEFBÜRO › BESUCHER"));
ok(/kasse-toepfe/.test(rgk) && /Nachhol-Bremse/.test(rgk) && /Modell je Aufgabe/.test(rgk), "Rundgang erklärt Töpfe, Nachhol-Bremse und Modell je Aufgabe");

console.log("── 8 · Gleicher Textanfang für jeden Kunden (Prompt-Caching)");
const T = await import("../shared/fiaon-mara-ton");
const gemeinsam = (x: string, y: string) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
for (const kanal of ["mail", "whatsapp"] as const) {
  const p1 = T.personaText(kanal, { betreuer: { nom: "Herr Stripling", dat: "Herrn Stripling" } } as any);
  const p2 = T.personaText(kanal, { betreuer: { nom: "Frau Lombardi", dat: "Frau Lombardi" } } as any);
  const anteil = gemeinsam(p1, p2) / p1.length;
  ok(anteil > 0.9, `Persona ${kanal}: ${Math.round(anteil * 100)} % gleich für zwei Kunden mit verschiedenen Betreuern`);
}

console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`);
process.exit(schlecht ? 1 : 0);
