// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-409 NACHBESSERUNG (20.10.2026), OFFLINE — Teil 2 der Prüfer-Funde, rein und am Quelltext.
// Je Fund mindestens ein Fall, der auf dem Stand VOR der Korrektur rot ist. Erfundene Texte, keine Kundendaten.
//   npx tsx scripts/pruef-e409-nachbesserung.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra: unknown = "") => {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 400)}` : ""}`); }
};
const datei = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
/** Ein Abschnitt für sich: fehlt auf dem alten Stand eine Funktion, zählt das als rot statt den Prüfstand abzubrechen. */
const abschnitt = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); } catch (e) { ok(false, `${name}: Abbruch`, String((e as Error)?.message ?? e).slice(0, 200)); }
};

async function main() {
  const R: any = await import("../shared/fiaon-ki-pruefung-regeln");
  const regeln = (text: string, telefon: any) => (R.harteRegeln(text, { kanal: "telefon", telefon }) as { regel: string; schwere: string }[]);
  const hart = (l: { regel: string; schwere: string }[]) => l.filter((p) => p.schwere === "hart").map((p) => p.regel);

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 7 · Telefon: die Regeln lesen nur, was ARAS sagt");
  await abschnitt("Fund 7", () => {
    const zeilen = [
      { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, ich bin der digitale Assistent, also eine KI. Spreche ich mit Herrn Beispielmann?" },
      { wer: "kunde", text: "Ja. Und hören Sie auf mich anzurufen, sonst gehe ich zum Anwalt!" },
      { wer: "aras", text: "Das verstehe ich gut. Ich trage ein, dass wir Sie nicht mehr anrufen. Einen schönen Tag noch." },
    ];
    const text = zeilen.map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${z.text}`).join("\n");
    const r = regeln(text, { kiHinweisSek: 3, aufnahmeJaSek: 10, aufnahmeGestartetSek: 11, transkript: zeilen });
    ok(!hart(r).some((x) => ["druck", "drohung"].includes(x)), "„Sonst gehe ich zum Anwalt“ vom KUNDEN ist kein Druck von Aras", r);
    const zeilen2 = [...zeilen.slice(0, 2), { wer: "aras", text: "Wenn Sie nicht zahlen, geht das an Inkasso." }];
    const text2 = zeilen2.map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${z.text}`).join("\n");
    ok(hart(regeln(text2, { kiHinweisSek: 3, transkript: zeilen2 })).some((x) => ["druck", "drohung"].includes(x)), "… droht ARAS selbst, bleibt es ein harter Fehler");
    ok(R.arasText("ARAS: Hallo.\nKUNDE: Sonst Anwalt!\nnoch Kunde\nARAS: Tschüss.") === "Hallo.\nTschüss.", "arasText: Kundenzeilen (auch Folgezeilen) fallen weg", R.arasText?.("ARAS: Hallo.\nKUNDE: Sonst Anwalt!\nnoch Kunde\nARAS: Tschüss."));
    ok(R.arasText("Guten Tag.\nBis bald.") === "Guten Tag.\nBis bald.", "ohne Marken bleibt alles Aras (Teams 1 Live-Text)");
    const t1 = R.telefonRegeln("Guten Tag, hier ist Aras von FIAON, eine KI.", { kiHinweisSek: 2, transkript: [{ wer: "kunde", text: "Hallo?" }, { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, eine KI. Es geht um Ihre Rate über 59,99 Euro." }] });
    ok(t1.some((p: any) => p.regel === "anliegen_vor_identitaet") && !t1.some((p: any) => /^ton_/.test(p.regel)), "telefonRegeln (Teams 1 Form, ohne Ton) mit derselben Identitäts-Regel", t1.map((p: any) => p.regel));
    const live = R.liveBefundPunkte({ live: true, punkte: [{ regel: "druck", schwere: "hart" }, { regel: "amd_widerspruch", schwere: "weich" }] });
    ok(live.length === 2 && live[0].schwere === "hart" && /Live-Prüfung ohne Aufnahme/.test(live[0].hinweis) && live[0].treffer === "", "Teams 1 Live-Befund wird gelesen (Schlüssel + Schwere, kein Wortlaut)", live);
    ok(R.liveBefundPunkte(null).length === 0 && R.liveBefundPunkte({ punkte: [{ regel: "druck", schwere: "hart" }] }).length === 0 && R.liveBefundPunkte("kaputt").length === 0, "ohne live: true oder kaputt → nichts");
    const zus = R.punkteZusammen([{ regel: "druck", schwere: "hart", treffer: "x", hinweis: "" }], live);
    ok(zus.length === 2 && zus[0].treffer === "x", "punkteZusammen: jede Regel einmal", zus.map((p: any) => p.regel));
    const srv = datei("server/lib/fiaon-ki-pruefung.ts");
    ok(/regelText: zeilen \? arasText\(text\) : ""/.test(srv) && /modellText: zeilen \? text : ""/.test(srv), "Server: ohne Transkript keine Textregeln und kein Modell auf der Zusammenfassung");
    ok(/Bewerte NUR die ARAS-Zeilen/.test(srv), "Anweisung ans Modell: nur ARAS bewerten");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 8 · Anliegen erst nach Identität — über das ganze Gespräch, und nur mit Gesprächsanfang");
  await abschnitt("Fund 8", () => {
    const pruefer = [{ wer: "kunde", text: "Hallo?" }, { wer: "aras", text: "Hier ist Aras von FIAON. Es geht um Ihre Rate über 59,99 €." }, { wer: "kunde", text: "Wer?" }];
    ok(!!R.anliegenVorIdentitaet(pruefer), "Beispiel des Prüfers: [Hallo?] [… Rate 59,99 €] [Wer?] → Treffer");
    const dritte = [
      { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, ich bin eine KI. Spreche ich mit Herrn Beispielmann?" },
      { wer: "kunde", text: "Nein, hier ist seine Frau." },
      { wer: "aras", text: "Danke. Es geht um seine Rate über 59,99 Euro." },
    ];
    ok(!!R.anliegenVorIdentitaet(dritte), "Dritte am Telefon („hier ist seine Frau“) → Treffer");
    const sauber = [
      { wer: "kunde", text: "Hallo?" },
      { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON — ich bin eine KI. Spreche ich mit Frau Beispiel?" },
      { wer: "kunde", text: "Ja, am Apparat." },
      { wer: "aras", text: "Schön. Es geht um Ihre Rate 2 über 59,99 Euro." },
    ];
    ok(R.anliegenVorIdentitaet(sauber) === null, "Ja NACH der Identitätsfrage, dann die Rate → in Ordnung");
    const jaVorher = [{ wer: "kunde", text: "Ja?" }, { wer: "aras", text: "Hier ist Aras von FIAON, eine KI. Es geht um Ihre Rate." }];
    ok(!!R.anliegenVorIdentitaet(jaVorher), "ein „Ja?“ beim Abheben bestätigt nichts");
    const abJa = [{ wer: "aras", text: "Danke! Dann kurz zu Ihrer Rate 3 über 59,99 Euro." }, { wer: "kunde", text: "Ja, ich zahle am Freitag." }];
    ok(R.anliegenVorIdentitaet(abJa) === null, "Transkript erst ab dem Aufnahme-Ja (kein Anfang) → nicht prüfbar, kein Fehler");
    const r = regeln(abJa.map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${z.text}`).join("\n"), { kiHinweisSek: null, transkript: abJa });
    ok(!hart(r).length && r.some((p) => p.regel === "ki_hinweis_unbelegt" && p.schwere === "weich"), "… und kein harter „KI-Hinweis fehlt“ — nur ein weicher Punkt", r);
    const t1 = [{ wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, ich bin der digitale Assistent, also eine KI. Spreche ich mit Herrn Beispielmann?" }, { wer: "kunde", text: "Ja." }, { wer: "aras", text: "Ich rufe wegen Ihrer Rate 2 über 59,99 Euro an." }];
    ok(R.anliegenVorIdentitaet(t1) === null && hart(regeln("ARAS: x", { kiHinweisSek: null, transkript: [{ wer: "aras", text: "Hallo, hier ist Aras." }, { wer: "kunde", text: "Ja?" }] })).includes("ki_hinweis_fehlt"), "mit Anfang ohne KI-Hinweis bleibt es hart (wie bisher)");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 16 · „gelb → grün“ je Werkzeug, Takt-Deckel, Historie nur bei Arbeit");
  await abschnitt("Fund 16", () => {
    const fq = R.fehlerquoteRechnen(
      [{ kanal: "whatsapp", schluessel: "antwort", n: 40, auffaellig: 0 }, { kanal: "mail", schluessel: "postfach:support", n: 30, auffaellig: 0 }],
      { tage: 28, gelb: ["ratenpause_setzen"], werkzeuge: [{ schluessel: "ratenpause_setzen", n: 24, auffaellig: 0 }] },
    );
    ok(fq.vorschlaege.length === 1 && fq.vorschlaege[0].includes("ratenpause_setzen"), "Vorschlag aus der Quote je Werkzeug (die Kanal-Schlüssel heißen nie wie ein Werkzeug)", fq.vorschlaege);
    ok(fq.gesamt.n === 70, "die Werkzeug-Zeilen zählen nicht doppelt in die Gesamtquote", fq.gesamt);
    const srv = datei("server/lib/fiaon-ki-pruefung.ts");
    ok(/export const MODELL_JE_LAUF = 2;/.test(srv) && /export const MODELL_JE_STUNDE = 60;/.test(srv), "höchstens 2 Modell-Fragen je Lauf, 60 je Stunde");
    ok(/modell = \$\{modell\.urteil \? modell\.modell : "regeln"\}/.test(srv), "die Spalte modell nennt ein Modell nur mit Urteil");
    const routes = datei("server/routes.ts");
    ok(/tageslauf\('ki_pruefung',[^\n]*pruefungTaktFuerHistorie\(\)[^\n]*nurMitErgebnis: true/.test(routes), "Takt mit nurMitErgebnis (keine 720 Historienzeilen am Tag)");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Aras an EINEM Ort (Justin 20.10.): Probe im KI-Team, alte Adresse leitet weiter, keine Vertrieb-Kachel");
  await abschnitt("Aras ein Ort", () => {
    const seiten = datei("client/src/components/admin/chef-seiten.tsx");
    const probeZeile = (seiten.split("\n").find((z) => /slug: "aras-probe"/.test(z)) ?? "");
    ok(/raum: ""/.test(probeZeile) && /Seite: ArasProbeUmzug/.test(probeZeile), "/chef/s/aras-probe: keine Kachel mehr (Raum leer), nur Weiterleitung", probeZeile.slice(0, 160));
    ok(/ArasProbeUmzug = \(\) => <Umzug nach="\/chef\/s\/aras#probe"/.test(seiten), "… nach /chef/s/aras#probe (mit replace — der Zurück-Knopf springt nicht hin und her)");
    ok(!seiten.split("\n").some((z) => /slug: "aras-probe"/.test(z) && /raum: "vertrieb"/.test(z)), "keine Aras-Kachel im Raum „Vertrieb“");
    const kiAras = datei("client/src/components/admin/ChefKiAras.tsx");
    ok(/lazy\(\(\) => import\("\.\/ChefArasProbe"\)\)/.test(kiAras) && /reiter === "probe" \? <ArasProbe eingebettet ohneSchalter=\{verbunden\} \/>/.test(kiAras), "KI-Team › Aras zeigt die Probe aus Teil 1 (dieselbe Komponente)");
    ok(/\{ key: "probe", label: "Probe" \}, \{ key: "plan"/.test(kiAras) && !/key: "stimme"/.test(kiAras), "Reiter „Probe“ zuerst, kein doppelter Reiter „Stimme“");
    ok(/if \(\/\^#probe\\b\/\.test\(hash\)\) return "probe";/.test(kiAras), "#probe öffnet den Reiter „Probe“ (Ziel der Weiterleitung)");
    ok(!existsSync("client/src/components/admin/aras/ArasStimme.tsx") && !existsSync("client/src/components/admin/aras/ArasProbe.tsx"), "die doppelten KI-Team-Teile „Stimme“/„Probeanruf“ sind weg");
    const probe = datei("client/src/components/admin/ChefArasProbe.tsx");
    ok(/"\/chef\/aras\/probe\/anrufen"/.test(probe) && /"\/chef\/aras\/probe\/stand"/.test(probe) && /\/chef\/aras\/probe\/live\?callId=/.test(probe), "„Mich anrufen“ unverändert über /chef/aras/probe/*");
    ok(/\{ eingebettet = false, ohneSchalter = false \}/.test(probe) && /ohneSchalter \? \(/.test(probe), "eingebettet: kein zweiter Not-Aus/Leerlauf, wenn der Seitenkopf sie hat");
    const rg = datei("client/src/pages/agent/rundgaenge.ts");
    const aras = rg.slice(rg.indexOf("export const RUNDGANG_ARAS: RundgangSchritt[]"), rg.indexOf("export const RUNDGANG_KI_WERKZEUGE"));
    ok(/ziel: "\[data-ki-reiter=\\"probe\\"\]"/.test(aras.slice(0, 200)) && !/data-ki-reiter=\\"stimme\\"/.test(aras), "Rundgang KI-Team › Aras: zuerst die Probe, kein Schritt für den alten Reiter „Stimme“");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 12 + 13 · Seiten stürzen bei Fehler nicht ab; im Hintergrund kein Nachladen; günstigere Abfragen");
  await abschnitt("Fund 12 + 13", () => {
    const teile = datei("client/src/components/admin/ki-teile.tsx");
    const takt = teile.slice(teile.indexOf("export function useTakt"), teile.indexOf("/** Rückmeldung am Auslöser"));
    ok(takt.length > 100 && !/setDaten\(f\.daten/.test(takt), "eine Fehlerantwort (auch „Anmeldung abgelaufen“) wird nie als Daten übernommen");
    ok(/visibilityState !== "visible" && geladenRef\.current\) return;/.test(takt) && /geladenRef\.current = Date\.now\(\)/.test(takt), "Hintergrund-Bremse über einen Ref (vorher immer null im Abschluss)");
    ok(/export function Stand\(\{ am, neu, fehler \}/.test(teile) && /nicht aktuell: \{fehler\}/.test(teile), "die Stand-Zeile sagt, wenn der gezeigte Stand nicht mehr frisch ist");
    const seiten = ["ChefKiHeute", "ChefKiQualitaet", "ChefKiWerkzeuge", "ChefKiEinstellungen", "ChefKiAras"].map((n) => datei(`client/src/components/admin/${n}.tsx`));
    ok(seiten.every((q) => /<Stand am=\{geladenAm\} neu=\{neu\} fehler=\{fehler\} \/>/.test(q)), "alle fünf KI-Seiten zeigen den Fehler neben dem alten Stand");
    ok(/useTakt<KiHeute & \{ ok: boolean \}>\("\/chef\/ki\/heute", 60_000\)/.test(seiten[0]), "„Heute“ fragt alle 60 s statt alle 30 s");
    const heute = datei("server/lib/fiaon-ki-heute.ts");
    const kosten = heute.slice(heute.indexOf("export async function kiKostenJeDienst"), heute.indexOf("/** Verlauf:"));
    ok(kosten.length > 100 && !/AT TIME ZONE 'Europe\/Berlin'\)::date = \$\{tag\}/.test(kosten) && /created_at >= t\.ab AND created_at < t\.bis/.test(kosten), "Kosten je Tag: Zeitraum statt Umrechnung je Zeile");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 14 · ein Deckel von 0 heißt 0");
  await abschnitt("Fund 14", async () => {
    const S: any = await import("../shared/fiaon-ki-schalter");
    ok(S.zahlLesen("0", 30) === 0 && S.zahlLesen(0, 30) === 0, "„0“ bleibt 0 (vorher: `|| 30` → 30)");
    ok(S.zahlLesen(null, 30) === 30 && S.zahlLesen(undefined, 40) === 40 && S.zahlLesen("", 30) === 30 && S.zahlLesen("  ", 30) === 30 && S.zahlLesen("abc", 30) === 30, "fehlt/leer/kaputt → Vorgabe");
    ok(S.zahlLesen("12,5", 0) === 12.5 && S.zahlLesen("900", 40, 0, 500) === 500 && S.zahlLesen("-3", 40, 0, 500) === 0, "Komma geht, Grenzen gelten");
    const wa = datei("server/lib/fiaon-whatsapp-mara.ts");
    ok((wa.match(/zahlLesen\(await einstellung\("mara_wa_tag_euro", "30"\), 30, 0, 200\)/g) ?? []).length === 2 && !/mara_wa_tag_euro", "30"\)\) \|\| 30/.test(wa), "WhatsApp-Deckel an beiden Stellen");
    const nf = datei("server/lib/fiaon-mara-nachfass.ts");
    ok(/zahlLesen\(deckelZeile\?\.value, NACHFASS_TAG_VORGABE, 0, 500\)/.test(nf) && !/\|\| NACHFASS_TAG_VORGABE/.test(nf), "Nachfassen je Tag");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 17 · folgenreiche Schalter fragen nach; Werbe-Anrufe nur mit LEXR-Vermerk");
  await abschnitt("Fund 17", async () => {
    const S: any = await import("../shared/fiaon-ki-schalter");
    const e = (k: string) => S.REGISTER.find((x: any) => x.schluessel === k);
    ok(!!S.rueckfrageFuer(e("aras_an"), "an") && S.rueckfrageFuer(e("aras_an"), "aus") === null, "„Aras wählt“ an → Rückfrage; aus → keine");
    ok(!!S.rueckfrageFuer(e("mara_aktion_runde_seit"), "Jetzt") && S.rueckfrageFuer(e("mara_aktion_runde_seit"), "aus") === null, "Runde „jetzt“ → Rückfrage");
    ok(!!S.rueckfrageFuer(e("postmeister_altbestand_ablegen"), "an"), "alte Entwürfe ablegen → Rückfrage");
    const lexr = e("ki_lexr_freigabe");
    ok(!!lexr && S.wertPruefen(lexr, "").ok && S.wertPruefen(lexr, "LEXR-Freigabe am 25.10.2026 (Az. 12)").ok && !S.wertPruefen(lexr, "ok").ok, "Register: LEXR-Vermerk „LEXR-Freigabe am TT.MM.JJJJ“ oder leer");
    ok(JSON.stringify(S.lexrSpielartenAn('{"lead":"an","rate":"an","rueckholung":true}')) === '["lead","rueckholung"]' && S.lexrSpielartenAn("kaputt").length === 0, "welche Werbe-Spielarten ein Wert einschaltet");
    const feld = datei("client/src/components/admin/ChefKiEinstellungen.tsx");
    ok(/if \(!fragen\(neu\)\) return; setW\(neu\); void onSpeichern\(e, neu\);/.test(feld) && /pruef\.ok && fragen\(pruef\.wert\)/.test(feld), "die Einstellungen-Seite fragt VOR dem Speichern (Knopf, Auswahl, Feld)");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 19 · Team-Neuigkeit ehrlich");
  await abschnitt("Fund 19", () => {
    const up = datei("client/src/pages/agent/updates-data.ts");
    const eintrag = up.slice(up.indexOf('id: "2026-10-19-ki-team"'), up.indexOf('id: "2026-10-19-mara-unterlagen"'));
    ok(eintrag.length > 100 && !/Die Leitung kann Maras Werkzeuge/.test(eintrag) && /Justin stellt ein/.test(eintrag), "umstellen darf nur Justin (nicht „die Leitung“)");
    ok(!/ein Mensch entscheidet per Karte/.test(eintrag) && /Karte, oder Mara lässt es weg/.test(eintrag), "Rot: Karte ODER weglassen — je nach Werkzeug");
    ok(!/zählt bei „Versuche je Person“ mit dir zusammen/.test(eintrag) && /ruft noch keine Kunden an/.test(eintrag), "keine Aras-Zählregel, die noch nicht gilt");
  });

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
