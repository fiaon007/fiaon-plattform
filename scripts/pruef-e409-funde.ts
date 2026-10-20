// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-409 × E-406 (20.10.2026), OHNE DATENBANK: die Funde des unabhängigen Prüfers — je Fund mindestens ein Fall,
// der auf dem Stand VOR der Korrektur rot ist (reine Regeln und Quelltext). Die DB-Fälle stehen in pruef-e409-funde-db.ts.
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-e409-funde.ts
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "DATABASE_URL_EXTERN"]) delete process.env[k];
let netz = 0;
globalThis.fetch = (async () => { netz++; return new Response("kein Netz im Prüfstand", { status: 599 }); }) as any;

import { readFileSync, existsSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const pfad = (p: string) => new URL(`../${p}`, import.meta.url);
const quelle = (p: string) => (existsSync(pfad(p)) ? readFileSync(pfad(p), "utf8") : "");
const ohneKommentar = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

async function main() {
  const KT = await import("../shared/fiaon-ki-team");
  const SCH = await import("../shared/fiaon-ki-schalter");
  const MA = await import("../shared/fiaon-mara-ampel");
  const w = (k: string) => KT.MARA_AMPEL.find((x) => x.key === k);
  // Quelltexte, die mehrere Abschnitte lesen (oben, damit jeder Abschnitt für sich laufen kann — auch im Rot-Probelauf).
  const heuteSeite = quelle("client/src/components/admin/ChefKiHeute.tsx");
  const ein = quelle("server/lib/fiaon-ki-einstellungen.ts");
  const auftrag = quelle("server/lib/fiaon-mara-auftrag.ts");
  /** Ein Abschnitt für sich: bricht er ab (z. B. weil es eine Funktion auf dem alten Stand nicht gibt), zählt das als rot. */
  const abschnitt = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); } catch (e) { ok(false, `${name}: Abbruch`, String((e as Error)?.message ?? e).slice(0, 160)); }
  };

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 1 · EINE Ampel (ein Schlüssel, echte Werkzeugnamen), keine Trainerin-Stichprobe, EINE Quelle für „Heute“");
  await abschnitt("Fund 1", async () => {
  ok(!("MARA_AMPEL" in MA) && !("ampelSetzen" in MA) && !("AMPEL_SCHALTER" in MA), "shared/fiaon-mara-ampel.ts führt keine zweite Ampel-Liste mehr");
  ok(!existsSync(pfad("server/lib/fiaon-mara-ampel.ts")), "kein zweites Ampel-Modul auf dem Server (fiaon-mara-ampel.ts ist weg)");
  ok(!existsSync(pfad("client/src/components/admin/ChefMaraAmpel.tsx")), "keine zweite Ampel-Oberfläche im Mara-Steuerpult");
  ok(KT.MARA_AMPEL_SCHALTER === "mara_ampel" && !/["']mara_ampel["']/.test(ohneKommentar(quelle("shared/fiaon-mara-ampel.ts"))), "ein Speicher-Schlüssel (mara_ampel), nur in shared/fiaon-ki-team.ts");
  ok(!w("termin_eintragen") && !w("ratenpause") && !w("mail_antworten") && !w("whatsapp_antworten"), "die erfundenen B3-Namen gibt es nicht mehr");
  ok(!!w("rueckruf_eintragen") && !!w("ratenpause_setzen") && !!w("antwort_senden") && !!w("vereinbarten_termin_eintragen"), "die echten Namen stehen in der Liste");
  ok(new Set(KT.MARA_AMPEL.map((x) => x.key)).size === KT.MARA_AMPEL.length, "kein Werkzeug doppelt");
  ok(KT.MARA_AMPEL.every((x) => x.label.length <= 40 && x.satz.length <= 80), "kurze Texte (Label ≤ 40, Satz ≤ 80)");
  ok(!existsSync(pfad("server/lib/fiaon-mara-stichprobe.ts")) && !existsSync(pfad("client/src/components/agent/MaraStichprobe.tsx")), "Stichprobe: kein Server-Modul, keine Oberfläche");
  ok(!/MaraStichprobe|mara-stichprobe/.test(quelle("client/src/pages/agent/schulung.tsx")), "Schulung: keine Stichprobe für die Trainerin");
  ok(!/mara-stichprobe|tageslauf\("mara-stichprobe"/.test(quelle("server/routes/fiaon-mara-heute.ts")) && !/Mara-Stichprobe|mara-stichprobe|Trainerin/.test(ohneKommentar(quelle("client/src/pages/agent/updates-data.ts"))), "keine Stichproben-Route, kein Takt, kein Team-Update dazu");
  const chefMara = quelle("client/src/components/admin/ChefMara.tsx");
  ok(/href="\/chef\/s\/ki-werkzeuge"[^>]*data-mara="ampel-link"/.test(chefMara) && !/MaraAmpel/.test(chefMara), "Mara-Steuerpult: „Ampel“ ist nur ein Link nach KI-Team › Werkzeuge");
  const kiHeute = quelle("server/lib/fiaon-ki-heute.ts");
  ok(/maraHeuteLesen\(\)/.test(kiHeute) && !/maraTag\(/.test(kiHeute), "KI-Team › Heute liest Maras Zahlen aus maraHeuteLesen (dieselbe Quelle)");
  ok(/maraHeuteKurz\(await maraHeuteLesen\(\)\)/.test(quelle("server/routes/fiaon-mara-heute.ts")), "Lagezimmer liest aus derselben Quelle (kurz)");
  const lage = quelle("client/src/components/admin/ChefMaraHeute.tsx");
  ok(/Mehr in KI-Team/.test(lage) && !/rueckgaengig/.test(lage), "Lagezimmer-Karte: kurze Zusammenfassung mit Link, „Rückgängig“ nur in KI-Team › Heute");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 2 · „Wieder an“ stellt GENAU den Stand von vorher her und fragt vorher");
  await abschnitt("Fund 2", async () => {
  ok(/NOTAUS_VORHER = "mara_notaus_vorher"/.test(ein) && /if \(!merker\) \{[\s\S]{0,300}werte\[k\] = jetzt\.get\(k\) \?\? null/.test(ein), "Not-Aus merkt den Stand jedes Schalters (fehlt = Vorgabe), überschreibt einen Merker nie");
  ok(/if \(alt == null\) await tx`DELETE FROM fiaon_settings/.test(ein) && /DELETE FROM fiaon_settings WHERE key = \$\{NOTAUS_VORHER\}/.test(ein), "„Wieder an“ stellt genau den Merker her (auch „fehlte“) und löscht ihn");
  ok(/Mara ist nicht angehalten/.test(ein), "„Wieder an“ ohne Not-Aus: nichts wird angeschaltet (409)");
  ok(/const maraWiederAn = async \(\) => \{[\s\S]{0,400}window\.confirm\(/.test(heuteSeite), "„Wieder an“ fragt vorher — mit der Liste, was wieder angeht und was aus bleibt");
  ok(KT.AMPEL_TEXT.rot !== "nur per Karte", "Ampel-Text verspricht keine Karte, die es nicht gibt");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 3 · „Mails geschrieben“ / „WhatsApps raus“ zählen Maras eigene Arbeit (nicht immer 0, nicht fremde)");
  await abschnitt("Fund 3", async () => {
  ok(!/entwurf IS NOT NULL/.test(auftrag) && /p\.aktion = 'entwurf'/.test(auftrag), "maraTag: die Spalte „entwurf“ gibt es nicht — Entwurf = aktion 'entwurf'");
  ok(/fiaon_mara_aktion m, tag WHERE m\.status = 'gesendet'/.test(auftrag) && /von ILIKE 'mara%'/.test(auftrag), "maraTag: Mail-Aktion zählt mit, WhatsApp nur von Mara");
  const heuteLib = quelle("server/lib/fiaon-mara-heute.ts");
  ok(/MAIL_ARTEN: readonly HandlungArt\[\] = \["mail_beantwortet", "aktion_mail"/.test(heuteLib) && /WA_ARTEN: readonly HandlungArt\[\] = \["wa_antwort", "nachfass_wa"\]/.test(heuteLib), "„Heute“: Mails = Postfach + Aktion + Wege aus E-406; WhatsApp = Maras Antworten");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 4 · „Mara anweisen“ trifft bei einer Aktionsmail die Hausanweisung der Mail-Aktion");
  await abschnitt("Fund 4", async () => {
  const P = await import("../server/lib/fiaon-ki-pruefung");
  ok(P.pruefBereich("mara_aktion", "mail") === "aktion", "Aktionsmail → Bereich „aktion“");
  ok(P.pruefBereich("postmeister", "mail") === "postfach" && P.pruefBereich("whatsapp", "whatsapp") === "whatsapp" && P.pruefBereich("aras_anruf", "telefon") === "telefon", "Postfach, WhatsApp, Telefon wie bisher");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 5 · Karten auf „Heute“: Links bleiben Links, vorsichtige Wahl fragt nach");
  await abschnitt("Fund 5", async () => {
  ok(/if \(o\.link\) return <a className=\{klasse\} href=\{o\.link\}/.test(heuteSeite), "eine Link-Empfehlung („Akte öffnen“, „Selbst antworten“) ist ein Link — kein Klick an den Server (kein 400)");
  ok(/o\.ton === "vorsicht" && o\.key !== empfehlung && !o\.link/.test(heuteSeite) && /if \(mussNachfragen\(o, k\.empfehlung\) && !window\.confirm/.test(heuteSeite), "„Widerruf annehmen“ (vorsicht) fragt vorher — wie im Mara-Steuerpult");
  ok(/<KartenWahl o=\{empf\} haupt/.test(heuteSeite), "auch die Empfehlung geht durch denselben Weg (Link oder Knopf)");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 6 · Rot ist ehrlich, Kündigung fest grün, Gelb nur nach echtem Lauf, Lesefehler = streng");
  await abschnitt("Fund 6", async () => {
  ok(w("kuendigung_aufnehmen")?.fest && w("kuendigung_aufnehmen")?.vorgabe === "gruen" && w("kuendigung_vormerken")?.fest && w("kuendigung_vormerken")?.vorgabe === "gruen", "Kündigung aufnehmen/vormerken: fest grün");
  ok(!!KT.ampelSetzenPruefen(KT.MARA_AMPEL, "kuendigung_aufnehmen", "rot") && !!KT.ampelSetzenPruefen(KT.MARA_AMPEL, "kuendigung_vormerken", "rot"), "Kündigung lässt sich nicht auf Rot stellen");
  ok(w("konto_freischalten")?.fest === true, "Konto freischalten: fest (läuft nie per KI) — kein Gelb, das „ausgeführt“ meldet");
  ok(KT.MARA_AMPEL.filter((x) => !x.fest && x.stufen.includes("rot")).every((x) => !!x.rot && !!x.rotWeg), "jede Zeile mit Rot sagt ehrlich, was Rot tut (Karte oder weglassen)");
  ok(KT.ampelStrengste(w("rueckruf_eintragen")!) === "rot" && KT.ampelStrengste(w("karte_senden")!) === "gelb" && KT.ampelStrengste(w("kuendigung_aufnehmen")!) === "gruen", "Lesefehler: die strengste Stufe des Werkzeugs (fest bleibt fest)");
  const amp = quelle("server/lib/fiaon-ki-ampel.ts");
  ok(/return stand \? ampelStufeAus\(liste, stand, key\) : ampelStrengste\(w\);/.test(amp) && !/catch\(\(\) => "gruen"/.test(amp), "ampelStufe: Lesefehler → strengste Stufe (nicht grün)");
  const pruefenBody = amp.slice(amp.indexOf("export async function ampelPruefen"), amp.indexOf("export async function ampelGelbMerken"));
  ok(!/ampel_gelb/.test(pruefenBody) && /urteil\.stufe !== "gelb" \|\| !ok/.test(amp), "Gelb steht erst NACH dem Lauf im Protokoll — und nur, wenn er wirklich lief");
  const wa = quelle("server/lib/fiaon-whatsapp-mara.ts");
  ok(/vorlegen: `Ampel rot \(\$\{ampel\.werkzeug\?\.label \?\? name\}\)/.test(wa), "WhatsApp: Rot (Rot-Weg Karte) legt eine echte Karte vor");
  const agent = quelle("server/lib/fiaon-postmeister-agent.ts");
  ok(/ampelRotWerkzeuge\.push/.test(agent) && /automatischErlaubt: false, grund: mailAmpelWerkzeugRotGrund\(ampelRotWerkzeuge/.test(agent), "Postfach: ein rotes Werkzeug macht die Antwort zur Karte (nie stilles Senden ohne das Werkzeug)");
  ok(MA.mailAmpelWerkzeugRotGrund(["Zahlungslink"], "x").startsWith(MA.AMPEL_ROT_KOPF), "… mit dem Kopf „Ampel rot:“ (Karte „Ampel rot — Maras Antwort senden?“)");
  const ui = quelle("client/src/components/admin/ChefKiWerkzeuge.tsx");
  ok(!/nur per Karte an dich/.test(ui) && /Rot: \{z\.rot\}/.test(ui), "Werkzeuge-Seite: kein Pauschal-Versprechen „Karte“, jede Zeile sagt ihr Rot");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 9 · Der Not-Aus umfasst ALLE Mara-Wege");
  await abschnitt("Fund 9", async () => {
  const alle = SCH.NOTAUS_SCHALTER.map((n) => n.schluessel);
  for (const k of ["mara_aktion_an", "mara_wa_an", "postmeister_an", "mara_wa_nachfass", "mara_nicht_erreicht_mail", "mara_rate_erinnerung", "mara_anliegen", "mara_nacharbeit_mail", "mara_kyc_nachfordern", "unterlagen_umhaengen"]) {
    ok(alle.includes(k), `Not-Aus hält „${k}“ an`);
  }
  ok(/maraNotausAktiv\(\)\) return \{ geplant: 0, ausgefuehrt: 0, wartend: 0 \}/.test(auftrag), "Maras Daueraufträge warten während des Not-Aus");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 11 · Probe-Nummer überall verdeckt, keine Kundennamen für die Leitung auf „Heute“");
  await abschnitt("Fund 11", async () => {
  ok(SCH.nummerMaskiert("+4915112345678") === "••• 678" && SCH.nummerMaskiert("") === "" && SCH.nummerMaskiert(null) === "", "nur die letzten 3 Ziffern");
  ok(SCH.wertOeffentlich("aras_probe_nummer", "+4915112345678") === "••• 678" && SCH.wertOeffentlich("mara_wa_tag_euro", "45") === "45", "nur geheime Schlüssel werden verdeckt");
  const routen = quelle("server/routes/fiaon-chef-ki.ts");
  ok(/const sichtbar = wertOeffentlich\(schluessel, r\.wert\);[\s\S]{0,80}chefProtokoll\(req, schluessel, sichtbar/.test(routen), "Chef-Protokoll: verdeckt");
  ok(/const maskiert = nummer \? nummerMaskiert\(nummer\) : null;/.test(routen), "„Mich anrufen“: nur die letzten 3 Ziffern");
  ok(/wertOeffentlich\(schluessel, p\.wert\)\.slice\(0, 60\)\} \(\$\{von\}\)/.test(ein) && /e\.geheim \? wertOeffentlich/.test(ein), "Server-Log und Einstellungen-Antwort: verdeckt");
  ok(/kiHeute\(\{ karten: Number\(req\.query\.karten\) \|\| 6, nameZeigen: nameZeigen\(req\)/.test(routen), "„Heute“: Namen nur für Inhaber/Geschäftsführung (wie „Qualität“)");
  const H = await import("../server/lib/fiaon-ki-heute");
  ok(H.namenVerdecken("Herr Müller zahlt am Freitag, Frau Abel nicht") === "Herr … zahlt am Freitag, Frau … nicht", "Namen im Kartentext verdeckt", H.namenVerdecken("Herr Müller zahlt am Freitag, Frau Abel nicht"));
  const kl = H.karteFuerLeitung({ name: "Erika Mustermann", text: "Frau Mustermann schreibt", titel: "x", belege: [{ text: "Zitat" }] });
  ok(kl.name === null && kl.belege.length === 0 && !/Mustermann/.test(kl.text), "Karte für die Leitung: ohne Name, ohne Zitate");
  });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\nFund 18 · Kein Gold, kein Orange; ruhige Hülle auch für /chef/ki");
  await abschnitt("Fund 18", async () => {
  const css = quelle("client/src/styles/chef-ki.css");
  const ohnePunkt = css.split("\n").filter((z) => !/^\.ki-punkt\.gelb/.test(z)).join("\n");
  ok(!/#b8842f/i.test(css) && !/rgba\(242,\s*182,\s*76/.test(ohnePunkt), "keine Gold-/Orange-Flächen, -Ränder oder -Verläufe (nur der Ampel-Punkt ist gelb)");
  const warnNutzung = (css.match(/var\(--k-warn\)/g) ?? []).length;
  ok(warnNutzung === 1 && /\.ki-punkt\.gelb, \.ki-punkt\.warn \{ background: var\(--k-warn\)/.test(css), "Gelb nur noch als kleiner Ampel-Punkt", warnNutzung);
  ok(/\.ki-warn-t \{ color: var\(--k-licht-text\); \}/.test(css), "Hinweis-Text in Glasblau statt Gold");
  ok(/ruhigeHuelle=\{!!seite\?\.ruhig \|\| \(!istSeite && raum\.key === "ki"\)/.test(quelle("client/src/pages/chef.tsx")), "/chef/ki läuft in der ruhigen Hülle (kein Alpen-Film unter dem Glas)");
  ok(!/#fcd34d|#fbbf24/i.test(quelle("client/src/components/admin/ChefMaraHeute.tsx")), "Lagezimmer-Karte ohne Gold-Schrift");

  });
  ok(netz === 0, "kein Netz benutzt");
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
