// Prüfstand E-409 (19.10.2026): das Schalter-Register — jeder Eintrag hat Setzer (Route im Code, Schlüssel in dessen
// Erlaubnisliste), Leser (Datei im Code), Vorgabe innerhalb der Grenze; die Werkzeug-Ampel kennt nur Werkzeuge, die es
// im Code gibt. Offline, ohne Datenbank:
//   npx tsx scripts/pruef-ki-schalter.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { REGISTER, KI_SCHLUESSEL, ARAS_SCHLUESSEL, wertPruefen, setzerKoerper, registerSetzer, grenzeText } from "../shared/fiaon-ki-schalter";
import { MARA_AMPEL, ampelStandLesen, ampelStufeAus, ampelZeilen } from "../shared/fiaon-ki-team";

let gut = 0, schlecht = 0, offen = 0;
const ok = (b: unknown, was: string, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };
const warte = (was: string) => { offen++; console.log(`  … ${was} (wartet auf Team 1 / E-408)`); };

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lese = (p: string) => fs.readFileSync(path.join(WURZEL, p), "utf8");
const dateien = (dir: string): string[] => fs.readdirSync(path.join(WURZEL, dir)).filter((f) => f.endsWith(".ts")).map((f) => `${dir}/${f}`);
const serverCode = [...dateien("server/routes"), ...dateien("server/lib"), "server/routes.ts"].map((p) => ({ p, t: lese(p) }));

// Setzer-Route → Datei mit ihrer Erlaubnisliste
const SETZER_DATEI: Record<string, string[]> = {
  "/chef/ki/einstellung": ["server/routes/fiaon-chef-ki.ts", "shared/fiaon-ki-schalter.ts"],
  "/chef/mara/einstellung": ["server/lib/fiaon-mara-aktion.ts"],
  "/admin/postmeister/einstellung": ["server/routes/fiaon-postmeister.ts"],
  "/chef/rueckholung/einstellung": ["server/routes/fiaon-chef-rueckholung.ts"],
  "/chef/auskunft/einstellung": ["server/lib/fiaon-auskunft-verkauf.ts"],
  "/chef/mara/nicht-erreicht": ["shared/fiaon-nicht-erreicht-nachfass.ts"],
  "/admin/postmeister/frist": ["shared/fiaon-entwurf-frist.ts"],
};

console.log("── 1 · Register: Form, Grenzen, Eindeutigkeit");
const schluessel = new Set<string>();
for (const e of REGISTER) {
  ok(!schluessel.has(e.schluessel), `${e.schluessel}: einmalig`); schluessel.add(e.schluessel);
  ok(e.label.length <= 40, `${e.schluessel}: Label ≤ 40 (${e.label.length})`);
  ok(e.satz.length <= 80, `${e.schluessel}: Satz ≤ 80 (${e.satz.length})`);
  const p = wertPruefen(e, e.vorgabe);
  ok(p.ok, `${e.schluessel}: Vorgabe besteht die eigene Grenze`, p.ok ? "" : p.fehler);
  ok(grenzeText(e).includes("Setzer:"), `${e.schluessel}: Tooltip nennt den Setzer`);
}

console.log("── 2 · Setzer: Route im Code und Schlüssel in der Erlaubnisliste");
for (const e of REGISTER) {
  const route = e.setzer.route;
  const routeDa = serverCode.some(({ t }) => t.includes(`"${route}"`) || t.includes(`'${route}'`));
  ok(routeDa, `${e.schluessel}: Route ${route} existiert`);
  if (e.dienst === "aras") { ok(ARAS_SCHLUESSEL.includes(e.schluessel), `${e.schluessel}: in ARAS_SCHLUESSEL`); continue; }
  if (route === "/chef/ki/einstellung") { ok(KI_SCHLUESSEL.includes(e.schluessel), `${e.schluessel}: in KI_SCHLUESSEL`); continue; }
  const quellen = SETZER_DATEI[route] ?? [];
  const inListe = quellen.some((q) => {
    const t = lese(q);
    if (t.includes(`"${e.schluessel}"`) || t.includes(`'${e.schluessel}'`)) return true;
    // postmeister_modus_<postfach> wird aus POSTFAECHER gebaut; postmeister_name/nachname sind Sonderfälle der Route.
    if (route === "/admin/postmeister/einstellung" && (/^postmeister_modus_/.test(e.schluessel) || /^postmeister_(name|nachname)$/.test(e.schluessel))) return true;
    return false;
  });
  ok(inListe, `${e.schluessel}: steht in der Erlaubnisliste von ${route}`);
}

console.log("── 3 · Leser: Datei vorhanden, Schlüssel wird gelesen");
for (const e of REGISTER) {
  const [datei, fn] = e.leser.split(":");
  const treffer = serverCode.find(({ p }) => p.endsWith(`/${datei}`));
  if (e.dienst === "aras") { if (!treffer) warte(`${e.schluessel}: Leser ${datei}`); else ok(true, `${e.schluessel}: Leser ${datei} da`); continue; }
  ok(!!treffer, `${e.schluessel}: Leser-Datei ${datei} existiert`);
  if (!treffer) continue;
  const liest = treffer.t.includes(e.schluessel) || (/^postmeister_modus_/.test(e.schluessel) && treffer.t.includes("postmeister_modus_"))
    || (/^rueckhol_s\d_an$/.test(e.schluessel) && treffer.t.includes("rueckhol_${kurz}_an")) || (/^gruender_termin_/.test(e.schluessel) && treffer.t.includes("gruender_termin_"))
    || (e.schluessel === "mara_wa_nachfass" && treffer.t.includes("NACHFASS_SCHALTER")) || (e.schluessel === "mara_wa_nachfass_tag" && treffer.t.includes("NACHFASS_TAG_SCHLUESSEL"))
    || (e.schluessel === "mara_nicht_erreicht_mail" && treffer.t.includes("NACHFASS_SCHALTER")) || (e.schluessel === "postmeister_altbestand_ablegen" && treffer.t.includes("ALTBESTAND_SCHALTER"))
    || (/^auskunft_erinnerung/.test(e.schluessel) && treffer.t.includes("auskunft_erinnerung")) || (/^auskunft_(verkauf|liefermodus)/.test(e.schluessel) && treffer.t.includes("SCHALTER_"))
    || (/^frequenz_pro_/.test(e.schluessel) && treffer.t.includes(e.schluessel));
  ok(liest, `${e.schluessel}: ${datei} liest den Schlüssel`);
  if (fn) ok(treffer.t.includes(fn), `${e.schluessel}: Funktion ${fn} in ${datei}`);
}

console.log("── 4 · Grenzen (wertPruefen) und Setzer-Körper");
const z = REGISTER.find((e) => e.schluessel === "mara_wa_tag_euro")!;
ok(!wertPruefen(z, "999").ok, "zahl über max → Fehler");
ok(wertPruefen(z, "30").ok && (wertPruefen(z, "30") as any).wert === "30", "zahl im Rahmen → normiert");
ok(!wertPruefen(z, "abc").ok, "zahl mit Text → Fehler");
const an = REGISTER.find((e) => e.schluessel === "mara_wa_an")!;
ok((wertPruefen(an, "1") as any).wert === "an" && (wertPruefen(an, "nein") as any).wert === "aus", "an_aus nimmt 1/nein und normiert");
const q = REGISTER.find((e) => e.schluessel === "pruef_mara_quote")!;
ok(wertPruefen(q, '{"telefon":100,"mail":10,"whatsapp":5}').ok, "Quote-JSON gültig");
ok(!wertPruefen(q, '{"telefon":120}').ok && !wertPruefen(q, '{"sms":1}').ok && !wertPruefen(q, "kaputt").ok, "Quote-JSON: Grenze, fremder Kanal, kein JSON → Fehler");
const kih = REGISTER.find((e) => e.schluessel === "aras_ki_hinweis_satz")!;
ok(!wertPruefen(kih, "Guten Tag, hier ist Aras.").ok && wertPruefen(kih, "Hier ist Aras, der digitale Assistent von FIAON.").ok, "KI-Hinweis muss KI/digitale enthalten");
const fen = REGISTER.find((e) => e.schluessel === "aras_fenster")!;
ok(!wertPruefen(fen, '{"verkauf":{"0":["09:00","12:00"]}}').ok, "Fenster: Sonntag verboten");
ok(!wertPruefen(fen, '{"verkauf":{"1-5":["07:00","19:00"]}}').ok, "Fenster: vor 08:00 verboten");
ok(wertPruefen(fen, fen.vorgabe).ok, "Fenster: Vorgabe gültig");
const nr = REGISTER.find((e) => e.schluessel === "aras_probe_nummer")!;
ok(wertPruefen(nr, "+4915112345678").ok && wertPruefen(nr, "").ok && !wertPruefen(nr, "+1555123").ok, "Probe-Nummer: DACH oder leer");
ok(JSON.stringify(setzerKoerper(REGISTER.find((e) => e.schluessel === "rueckhol_pro_tag")!, "5")) === '{"key":"rueckhol_pro_tag","value":"5"}', "Setzer-Körper key/value");
ok(JSON.stringify(setzerKoerper(REGISTER.find((e) => e.schluessel === "mara_nicht_erreicht_mail")!, "aus")) === '{"an":false}', "Setzer-Körper an_boolean");
ok(JSON.stringify(setzerKoerper(REGISTER.find((e) => e.schluessel === "postmeister_altbestand_ablegen")!, "an")) === '{"altbestand":true}', "Setzer-Körper altbestand_boolean");
ok(registerSetzer("gibt_es_nicht") === null, "unbekannter Schlüssel → kein Setzer");

console.log("── 5 · Werkzeug-Ampel: jedes Werkzeug existiert im Code, feste Zeilen bleiben");
const wa = lese("server/lib/fiaon-whatsapp-mara.ts"), pm = lese("server/lib/fiaon-postmeister-werkzeuge.ts"), au = lese("server/lib/fiaon-mara-auftrag.ts");
for (const w of MARA_AMPEL) {
  if (w.fest && w.stufen.length === 1 && w.stufen[0] === "rot") { ok(true, `${w.key}: fest rot (nie ein Werkzeug)`); continue; }
  const quelle = w.kanal === "whatsapp" ? wa : w.kanal === "mail" ? pm : w.kanal === "auftrag" ? au : wa + pm;
  ok(quelle.includes(`name: "${w.key}"`), `${w.key}: Werkzeug im Code (${w.kanal})`);
  ok(w.stufen.includes(w.vorgabe), `${w.key}: Vorgabe ${w.vorgabe} ist erlaubt`);
}
const gate = ["server/lib/fiaon-whatsapp-mara.ts", "server/lib/fiaon-postmeister-agent.ts", "server/lib/fiaon-mara-auftrag.ts"].every((p) => lese(p).includes("ampelPruefen"));
ok(gate, "ampelPruefen steht an allen drei Ausführ-Stellen");
const stand = ampelStandLesen(JSON.stringify({ stufen: { rueckruf_eintragen: "rot", geld_buchen: "gruen", freie_zeiten: "rot", unbekannt: "gelb" }, verlauf: [] }));
ok(ampelStufeAus(MARA_AMPEL, stand, "rueckruf_eintragen") === "rot", "gespeichertes rot gilt");
ok(ampelStufeAus(MARA_AMPEL, stand, "geld_buchen") === "rot", "fest rot bleibt rot — auch wenn jemand grün speichert");
ok(ampelStufeAus(MARA_AMPEL, stand, "freie_zeiten") === "gruen", "fest grün bleibt grün");
ok(ampelStandLesen("kaputt").stufen && Object.keys(ampelStandLesen("kaputt").stufen).length === 0, "kaputtes JSON → leer");
ok(ampelZeilen(MARA_AMPEL, stand).find((x) => x.key === "rueckruf_eintragen")?.stufe === "rot", "Zeilen tragen die wirksame Stufe");

console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot, ${offen} warten auf Team 1.`);
process.exit(schlecht ? 1 : 0);
