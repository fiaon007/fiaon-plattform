// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND ARAS-COCKPIT (20.10.2026), OFFLINE — rein und am Quelltext, ohne Datenbank, ohne Schlüssel.
//   npx tsx scripts/pruef-aras-cockpit.ts
//
// Justin (20.10.): „wenn ich auflege läuft der Kasten da mit ‚übernehmen‘ dennoch weiter … UI VIEL übersichtlicher“.
// 1. Der Live-Kasten (client/src/components/admin/aras/aras-live.ts): verschwindet beim Ende, spätes Prüf-Mara/Daumen
//    weckt ihn nicht, ohne Ende-Ereignis nimmt ihn der Abgleich weg — und die ALTE Regel ist hier rot (Rot-Probe).
// 2. Die Wörter (aras-texte.ts): keine rohen Systemwörter, kein „Probe Probe“, die Zeile als ein Satz.
// 3. Quelltext: ruhiger Grund, Live-Stand-Route, nichts doppelt in den Einstellungen.
// Erfundene Texte, keine Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra: unknown = "") => {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 300)}` : ""}`); }
};
const datei = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const ROH = /\b[a-z]+_[a-z_]+\b|entfaellt|auffaellig|\b\d+ ms\b/;

async function main() {
  const L = await import("../client/src/components/admin/aras/aras-live");
  const T = await import("../client/src/components/admin/aras/aras-texte");
  const t0 = 1_000_000;

  // ═════════════════════════════════════════════════════════════════════
  console.log("── 1 · Live-Kasten: erscheint beim Anruf, geht beim Auflegen, bleibt weg");
  {
    let s = L.LIVE_LEER;
    s = L.ereignisAnwenden(s, { art: "aras_gewaehlt", callId: 40, spielart: "probe", daten: { probe: true } }, t0);
    ok(s.sitzungen.length === 1 && s.sitzungen[0].probe, "gewählt → ein Kasten (Probe)");
    s = L.ereignisAnwenden(s, { art: "aras_angenommen", callId: 40, spielart: "probe" }, t0 + 3000);
    s = L.ereignisAnwenden(s, { art: "aras_transkript", callId: 40, wer: "aras", text: "Hallo, hier ist Aras von FIAON." }, t0 + 4000);
    s = L.ereignisAnwenden(s, { art: "aras_transkript", callId: 40, wer: "kunde", text: "Ja, am Apparat." }, t0 + 6000);
    ok(s.sitzungen[0].zeilen.length === 2 && s.sitzungen[0].zeilen[1].wer === "kunde", "Sätze laufen mit (Aras/Kunde)");
    s = L.ereignisAnwenden(s, { art: "aras_ende", callId: 40, spielart: "probe", text: "Ende: kunde_aufgelegt nach 9 s" }, t0 + 9000);
    ok(s.sitzungen.length === 0 && !!s.beendet["40"], "Ende-Ereignis → Kasten weg, Anruf als beendet gemerkt");
    s = L.ereignisAnwenden(s, { art: "aras_pruefung", callId: 40, spielart: "probe", text: "Harte Regel im Gespräch: …" }, t0 + 30_000);
    s = L.ereignisAnwenden(s, { art: "aras_pruefung", callId: 40, spielart: "probe", text: "Urteil von Chef #1: Daumen runter" }, t0 + 90_000);
    s = L.ereignisAnwenden(s, { art: "aras_werkzeug", callId: 40, spielart: "probe", text: "spät" }, t0 + 91_000);
    ok(s.sitzungen.length === 0, "spätes Prüf-Mara-Urteil, Daumen, Werkzeug → KEIN neuer Kasten (Justins Fund)");
    // Rot-Probe: die alte Regel (ArasLive bis 874450f8) legte für jedes Ereignis einen Kasten an
    const alt = (m: Map<number, string>, e: any) => { const n = new Map(m); const id = Number(e.callId); if (!id) return n; if (["aras_ende", "aras_mailbox", "aras_notaus"].includes(e.art)) { n.delete(id); return n; } n.set(id, e.art); return n; };
    let a = new Map<number, string>();
    for (const e of [{ art: "aras_gewaehlt", callId: 40 }, { art: "aras_ende", callId: 40 }, { art: "aras_pruefung", callId: 40 }]) a = alt(a, e);
    ok(a.size === 1, "Rot-Probe: die ALTE Regel hätte nach dem Prüf-Mara-Ereignis wieder einen Kasten (so sah Justin ihn)");
    for (const art of ["ende", "aras_beendet", "anruf_ende", "aras_aufgelegt"]) {
      const x = L.ereignisAnwenden(L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_angenommen", callId: 7 }, t0), { art, callId: 7 }, t0 + 1);
      ok(x.sitzungen.length === 0, `auch ein neu benanntes Ende („${art}“) nimmt den Kasten weg`);
    }
    const y = L.ereignisAnwenden(L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_angenommen", callId: 8 }, t0), { art: "aras_hallo", callId: 8, laeuft: false }, t0 + 1);
    ok(y.sitzungen.length === 0, "„laeuft: false“ (Probe-Strom) nimmt den Kasten weg");
    const z = L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_pruefung", callId: 9 }, t0);
    ok(z.sitzungen.length === 0, "ein Prüf-Ereignis allein legt nie einen Kasten an");
    const h = L.ereignisAnwenden(L.LIVE_LEER, { art: "herzschlag", laufend: 0 }, t0);
    ok(h.sitzungen.length === 0 && h === L.LIVE_LEER, "Herzschlag ohne Anruf ändert nichts");
  }

  // ═════════════════════════════════════════════════════════════════════
  console.log("── 2 · Gürtel und Hosenträger: Abgleich mit /chef/aras/live/stand");
  {
    // a) Brücke kannte ihn, jetzt nicht mehr → vorbei (Ende-Ereignis verloren)
    let s = L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_angenommen", callId: 50, spielart: "rate" }, t0);
    s = L.abgleichen(s, [{ callId: 50, spielart: "rate", zustand: "spricht", seitSek: 3 }], [], t0 + 500, t0 + 600);
    ok(s.sitzungen[0]?.imKern === true, "Abgleich: Brücke führt den Anruf → bestätigt");
    s = L.abgleichen(s, [], [], t0 + 10_000, t0 + 10_100);
    ok(s.sitzungen.length === 0 && !!s.beendet["50"], "Brücke führt ihn nicht mehr → Kasten weg, ohne Ende-Ereignis");
    // b) Klingelt (gewählt, keine Brücke): bleibt, solange die Datenbank „klingelt“ sagt
    let k = L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_gewaehlt", callId: 51, spielart: "probe" }, t0);
    k = L.abgleichen(k, [], [{ callId: 51, spielart: "probe", seitSek: 4 }], t0 + 4000, t0 + 4100);
    ok(k.sitzungen.length === 1 && k.sitzungen[0].zustand === "klingelt", "gewählt, noch keine Brücke → „klingelt“ bleibt");
    k = L.abgleichen(k, [], [], t0 + 9000, t0 + 9100);
    ok(k.sitzungen.length === 0, "nicht abgenommen (nicht mehr „klingelt“) → weg");
    // c) Geist: Ereignis ohne Anruf — der erste Abgleich nach der Gnadenfrist nimmt ihn
    let g = L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_angenommen", callId: 52 }, t0);
    g = L.abgleichen(g, [], [], t0 - 100, t0 + 200);
    ok(g.sitzungen.length === 1, "ein Abgleich, der VOR dem Ereignis begann, nimmt nichts weg (Gnade)");
    g = L.abgleichen(g, [], [], t0 + L.GNADE_MS + 100, t0 + L.GNADE_MS + 200);
    ok(g.sitzungen.length === 0, "nach der Gnadenfrist: unbestätigt → weg");
    // d) veralteter Abgleich weckt nichts, ein neuerer (Gespräch läuft weiter) schon
    let v = L.ereignisAnwenden(L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_angenommen", callId: 53 }, t0), { art: "aras_ende", callId: 53 }, t0 + 5000);
    v = L.abgleichen(v, [{ callId: 53, spielart: "rate", zustand: "spricht" }], [], t0 + 4000, t0 + 6000);
    ok(v.sitzungen.length === 0, "Abgleich von VOR dem Ende listet ihn noch → bleibt weg");
    v = L.abgleichen(v, [{ callId: 53, spielart: "rate", zustand: "spricht" }], [], t0 + 8000, t0 + 8100);
    ok(v.sitzungen.length === 1, "Abgleich von NACH dem Ende listet ihn (Gespräch läuft nach gescheiterter Übergabe weiter) → wieder da");
    // e) Herzschlag 0 laufend → Brücken-Anrufe vorbei
    let hz = L.abgleichen(L.LIVE_LEER, [{ callId: 54, spielart: "rate", zustand: "hoert" }], [], t0, t0 + 1);
    hz = L.herzschlagAnwenden(hz, { art: "herzschlag", laufend: 0 }, t0 + 15_000);
    ok(hz.sitzungen.length === 0, "Herzschlag „0 laufend“ → Brücken-Kasten weg");
    let hl = L.abgleichen(L.LIVE_LEER, [{ callId: 55, spielart: "rate" }, { callId: 56, spielart: "rate" }], [], t0, t0 + 1);
    hl = L.herzschlagAnwenden(hl, { art: "herzschlag", laufend: [{ callId: 56 }] }, t0 + 15_000);
    ok(hl.sitzungen.length === 1 && hl.sitzungen[0].callId === 56, "Herzschlag mit Liste → nur die gelisteten bleiben");
    // f) ohne Klingel-Liste (älterer Server): gewählt bleibt höchstens KLINGEL_HOECHSTENS_MS
    let o = L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_gewaehlt", callId: 57 }, t0);
    o = L.abgleichen(o, [], null, t0 + 10_000, t0 + 10_000);
    ok(o.sitzungen.length === 1, "ohne Klingel-Liste: gewählt bleibt erst einmal stehen");
    o = L.abgleichen(o, [], null, t0 + L.KLINGEL_HOECHSTENS_MS + 1000, t0 + L.KLINGEL_HOECHSTENS_MS + 1000);
    ok(o.sitzungen.length === 0, "… aber nicht länger als die Klingel-Frist");
    // g) Rettungsnetz: ohne jede Bestätigung verschwindet ein Kasten
    let r = L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_angenommen", callId: 58 }, t0);
    r = L.aufraeumen(r, t0 + L.STILL_HOECHSTENS_MS + 1);
    ok(r.sitzungen.length === 0, "Rettungsnetz: ohne Ereignis und Abgleich weg nach STILL_HOECHSTENS_MS");
    // h) „Auflegen“ gedrückt → „legt auf …“, neue Zustände überschreiben das nicht
    let e = L.endetMarkieren(L.ereignisAnwenden(L.LIVE_LEER, { art: "aras_angenommen", callId: 59 }, t0), 59);
    e = L.ereignisAnwenden(e, { art: "aras_werkzeug", callId: 59 }, t0 + 100);
    ok(e.sitzungen[0].endet && e.sitzungen[0].zustand === "endet", "„Auflegen“ gedrückt → bleibt „legt auf …“ bis zum Ende");
  }

  // ═════════════════════════════════════════════════════════════════════
  console.log("── 3 · Die Wörter: Klartext statt Systemwörter");
  {
    const zeile = { id: 1, callId: 34, am: "2026-10-20T12:27:00.000Z", spielart: "probe", personId: null, name: "Probe", ergebnis: "nicht_erreicht", dauerSek: 90, kostenCents: 16, pruefung: "entfaellt", uebergabe: null, endeGrund: "kunde_aufgelegt", angenommen: true, probeUrteil: null, gespielt: "rate" };
    ok(T.anrufSatz(zeile) === "Probe · Rate offen · 14:27 · 1:30 Min · 0,16 € · beendet von dir", "die Zeile als Satz: „Probe · Rate offen · 14:27 · 1:30 Min · 0,16 € · beendet von dir“", T.anrufSatz(zeile));
    ok(!/Probe · Probe|Probe Probe/.test(T.werText({ spielart: "probe", name: "Probe" })), "nie „Probe Probe“");
    ok(T.werText({ spielart: "rate", name: "Mila Muster" }) === "Mila Muster · Rate offen", "Kunde: „Mila Muster · Rate offen“");
    ok(T.ausgangText({ ...zeile, angenommen: false, dauerSek: 0, endeGrund: "nicht_erreicht" }) === "nicht abgenommen", "Probe nicht abgenommen → „nicht abgenommen“");
    ok(T.ausgangText({ ...zeile, spielart: "rate", ergebnis: "erreicht_zahlt_am" }) === "Zusage", "Kunde mit Zusage → „Zusage“");
    ok(T.ausgangText({ ...zeile, uebergabe: "angenommen" }) === "ans Team übergeben", "Übergabe → „ans Team übergeben“");
    for (const s of ["ok", "auffaellig", "fehler", "offen", "entfaellt"]) ok(!ROH.test(T.pruefText(s).text), `Prüf-Mara „${s}“ → „${T.pruefText(s).text}“`);
    const alleCodes = [...Object.keys(T.ERGEBNIS_TEXT).map(T.ergebnisText), ...["kunde_aufgelegt", "aras_beendet", "chef", "Chefbüro", "mailbox", "stille", "notaus", "fehler", "zeitlimit", "uebergabe", "deploy", "kein_stream", "nicht_erreicht", "haengend"].map((g) => T.endeText(g, true)),
      ...Object.keys(T.WERKZEUG_TEXT).map(T.werkzeugText), ...Object.keys(T.REGEL_TEXT).map((r) => T.regelText(r)), ...Object.keys(T.ZUSTAND_TEXT).map(T.zustandText)];
    ok(alleCodes.every((x) => x && !ROH.test(x)), `alle ${alleCodes.length} bekannten Codes → Worte ohne Unterstrich`, alleCodes.filter((x) => !x || ROH.test(x)));
    ok(T.lesbar("neue_regel_x") === "neue regel x", "unbekannte Codes werden wenigstens lesbar");
    ok(T.zusammenfassungText("Gespräch „probe“, 6 s, Ende: kunde_aufgelegt. Ohne Aufzeichnung.", true) === "Kurzes Gespräch (6 Sekunden), beendet von dir. Ohne Aufnahme.", "Technik-Zusammenfassung → Satz", T.zusammenfassungText("Gespräch „probe“, 6 s, Ende: kunde_aufgelegt. Ohne Aufzeichnung.", true));
    ok(T.zusammenfassungText("Gespräch „rate“, 184 s, Ende: kunde_aufgelegt. Werkzeuge: zahlungslink_senden, zahlungszusage_merken (fehlgeschlagen).") === "Gespräch über 3:04 Min, Kunde hat aufgelegt. Erledigt: Zahlungslink geschickt, Zusage notiert (hat nicht geklappt).", "… mit Werkzeugen in Worten");
    ok(T.zusammenfassungText("Gespräch „probe“, 0 s, Ende: nicht_erreicht. Ohne Aufzeichnung.", true) === "Kein Gespräch — nicht abgenommen.", "… 0 Sekunden → „Kein Gespräch — nicht abgenommen.“");
    ok(T.zusammenfassungText("Frau Muster zahlt am Donnerstag.") === "Frau Muster zahlt am Donnerstag.", "eine echte Zusammenfassung bleibt, wie sie ist");
    ok(T.regelText("druck", "Druck (KI-VO Art. 5) — verboten.") === "Druck (KI-VO Art. 5) — verboten." && T.regelText("url_vorgelesen") === "Eine Internetadresse vorgelesen." && T.regelText("x", "Live-Prüfung ohne Aufnahme: KI-Hinweis zu spät.") === "KI-Hinweis zu spät.", "Prüf-Mara-Punkte in Klartext");
    ok(T.tagPlus("2026-10-31", 1) === "2026-11-01" && T.tagPlus("2026-03-29", -1) === "2026-03-28" && T.tagName("2026-10-19", "2026-10-20") === "Gestern" && T.tagName("2026-10-20", "2026-10-20") === "Heute", "Tage blättern (auch über Monats- und Zeitumstellung)");
    const liste = [{ spielart: "probe", probeUrteil: "runter" }, { spielart: "rate", probeUrteil: null }, { spielart: "probe", probeUrteil: "hoch" }];
    ok(T.anrufFiltern(liste, "probe").length === 2 && T.anrufFiltern(liste, "kunden").length === 1 && T.anrufFiltern(liste, "daumen").length === 1 && T.anrufFiltern(liste, "alle").length === 3, "Filter Alle · Probe · Kunden · Daumen runter");
    ok(T.statusSatz({ an: false, notaus: false, stufe: 0 }, []).satz === "Aras ruft gerade niemanden an", "Statussatz in Ruhe: „Aras ruft gerade niemanden an“");
    ok(T.statusSatz({ an: false, notaus: true }, []).satz.startsWith("Not-Aus") && T.statusSatz({ an: true, notaus: false, leerlauf: true, stufe: 1 }, []).satz.startsWith("Leerlauf"), "Statussatz bei Not-Aus und Leerlauf");
    ok(T.statusSatz({ an: false, notaus: false }, [{ probe: true, zustand: "gewaehlt", zeilen: [] }]).satz === "Aras ruft dich gerade an" && T.statusSatz({ an: true, notaus: false }, [{ probe: false, zustand: "spricht", zeilen: [1] }, { probe: false, zustand: "hoert", zeilen: [1] }]).satz === "Aras telefoniert gerade · 2 Gespräche", "Statussatz während Gesprächen");
    const fb = T.feedbackLesen({ ok: true, feedback: [{ id: 3, grund: "Begrüßung zu lang", aenderung: "Kürzer grüßen", created_at: "2026-10-20T10:00:00Z", status: "Übernommen" }, { schluessel: "x", titel: "Zu schnell" }, { id: 9 }] });
    ok(fb.length === 2 && fb[0].status === "uebernommen" && fb[0].vorschlag === "Kürzer grüßen" && fb[1].status === "offen" && fb[1].id === "x", "Feedback des Kerns: verschiedene Feldnamen werden verstanden, leere Punkte fallen weg");
    ok(T.PROBE_SCHLUESSEL.includes("aras_dialekt") && T.PROBE_SCHLUESSEL.includes("aras_hintergrund") && T.PROBE_SCHLUESSEL.includes("aras_zuhoeren") && T.COCKPIT_SCHLUESSEL.includes("aras_leerlauf"), "Dialekt/Hintergrund/Zuhören stehen nur in „Probe“, Leerlauf nur oben");
  }

  // ═════════════════════════════════════════════════════════════════════
  console.log("── 4 · Quelltext: ruhiger Grund, Live-Stand, kein Browser-Datumsfeld, kein window.prompt");
  {
    const seiten = datei("client/src/components/admin/chef-seiten.tsx");
    ok((seiten.split("\n").find((z) => /slug: "aras",/.test(z)) ?? "").includes("stillerGrund: true"), "chef-seiten: /chef/s/aras hat einen ruhigen Grund (stillerGrund)");
    const shell = datei("client/src/components/admin/ChefShell.tsx");
    ok(/\{stillerGrund \? null : buehne \?/.test(shell) && /stillerGrund \? " cb-still" : ""/.test(shell), "ChefShell: mit stillerGrund kein Foto/Film, Klasse cb-still");
    ok(/\.cb\.cb-glas\.cb-apple\.cb-still \.cb-buehne \{ display: none; \}/.test(datei("client/src/styles/chefbuero-apple.css")), "CSS: cb-still blendet die Bühne aus (auch mit Apple-Bühne)");
    ok(/stillerGrund=\{!!seite\?\.stillerGrund/.test(datei("client/src/pages/chef.tsx")), "chef.tsx reicht stillerGrund an die Hülle");
    const ki = datei("server/routes/fiaon-chef-ki.ts");
    ok(/router\.get\("\/chef\/aras\/live\/stand", lesen/.test(ki) && /c\.status IN \('gewaehlt', 'laeuft'\)/.test(ki), "Server: GET /chef/aras/live/stand (Brücke + klingelt aus der DB)");
    ok(/pruefMara/.test(ki) && /bezug_art = 'aras_anruf'/.test(ki), "Server: Anruf-Detail mit Prüf-Mara in Klartext");
    // Ohne Kommentare (dort steht, wie es VORHER war).
    const ohneKommentar = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const client = ohneKommentar(["ArasAnrufe", "ArasPlan", "ArasWarteschlange", "ArasStufe", "ArasEinstellungen", "ArasCockpit", "ArasLive", "ArasFeedback", "aras-teile"].map((n) => datei(`client/src/components/admin/aras/${n}.tsx`)).join("\n") + datei("client/src/components/admin/ChefArasProbe.tsx") + datei("client/src/components/admin/ChefKiAras.tsx"));
    ok(!/JJJJ-MM-TT/.test(client) && !/window\.prompt/.test(client), "kein Textfeld „JJJJ-MM-TT“ und kein window.prompt mehr");
    ok(!/dauerMs/.test(datei("client/src/components/admin/aras/ArasAnrufe.tsx").replace(/\/\/.*$/gm, "")), "keine Millisekunden im Anruf-Detail");
    ok(!/\{z\.pruefung\}|Prüf-Mara: \{/.test(client), "kein rohes Prüf-Mara-Wort in der Oberfläche");
    ok(!existsSync("client/src/styles/chef-aras-probe.css") && /import "@\/styles\/chef-aras\.css";/.test(datei("client/src/components/admin/ChefKiAras.tsx")), "eine Stildatei für die Seite (chef-aras.css), die alte Probe-Stildatei ist weg");
    const css = datei("client/src/styles/chef-aras.css");
    ok(!/gold|#d4af37|#f59e0b|orange/i.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), "kein Gold, kein Orange im Stil");
    ok((css.match(/backdrop-filter/g) ?? []).length === 2, "genau EIN Glas (Cockpit) — backdrop-filter nur dort (mit -webkit-)");
    ok(/@media \(prefers-reduced-motion: reduce\)/.test(css) && /@media \(max-width: 760px\)/.test(css), "Bewegung reduzieren + Handy-Regeln vorhanden");
    const rg = datei("client/src/pages/agent/rundgaenge.ts");
    const aras = rg.slice(rg.indexOf("export const RUNDGANG_ARAS: RundgangSchritt[]"), rg.indexOf("export const RUNDGANG_KI_WERKZEUGE"));
    ok(/data-ki=\\"cockpit\\"/.test(aras) && /Als Nächstes/.test(aras) && !/RUNDGANG_ARAS_PROBE/.test(rg), "Rundgang: Cockpit, „Als Nächstes“ — EIN Rundgang für die Seite");
    ok(/raum="aras-cockpit"/.test(datei("client/src/components/admin/ChefKiAras.tsx")), "neuer Rundgang-Merker „aras-cockpit“ (Justin sieht ihn nach dem Umbau einmal)");
  }

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
