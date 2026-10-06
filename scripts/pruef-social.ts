// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: SOCIAL-STUDIO (06.10.2026, E-294)
//
// Justin: „alles über die Plattform steuern: Claude spielt die Posts ein, wir
// prüfen, bearbeiten und posten dort". Regeln: shared/fiaon-social.ts, Server:
// server/lib/fiaon-social.ts, server/lib/fiaon-social-dateien.ts, Routen:
// server/routes/fiaon-social.ts.
//
//   1. Rein: Status-Übergänge, Aktionen je Status, Zeichengrenzen, 3:4-Zuschnitt,
//      Checkliste mit KI-Pflichthaken, Permalinks, Manifest-Prüfung, Planhinweise.
//   2. Rein: Wort-Check mit fester Ausnahmeliste — 03 Folie 7 grün, Caption mit
//      Komma rot, Garantie bei Marke fiaon rot, ohne Begleitsatz rot, „bis zu
//      500.000 $" rot, unbekannte Ausnahme nicht angewendet, Regelstand.
//   3. Dateien: Typ aus Bytes, Maße aus JPEG/MP4, moov vorne.
//   4. Import (echter Router, lokale DB): Zugang 503/401, neu 201, unverändert,
//      neue Fassung, Prüfsumme 422, _verworfen 422, fehlende Datei 422, Probe,
//      Token an Studio-Route 401.
//   5. Studio-Routen: Plan, Detail, Version 409, Freigeben grün (GF), Wort-Check rot:
//      GF 409, GF trotzdem 403, Inhaber ohne Grund 400, mit Grund 200 + Verlauf;
//      Leitung 403.
//   6. Veröffentlichen: KI-Haken fehlt 409, falscher Link 400, Haken + Link 200.
//   7. Re-Import nach Freigabe → neue Fassung zur Freigabe; nach Verschieben →
//      unverändert, Termin bleibt; verworfen → 409; zurück an Claude mit Pflichtnotiz.
//   8. Dateien ausliefern: 200, Range 206, 416, ETag 304, Download-Name, ZIP.
//   9. Instagram-Vorschau: Raster neueste zuerst, Zuschnitt 3:4, Symbole, Zeitregler.
//  10. Prüfung 06.10.2026: Token-Mindestlänge, Audit im fiaon_admin_log, Gesamtgrenze,
//      Verweis mit falschem Typ, Wertebereiche (sekunden, PNG-Maße, ids), KI-Pflicht
//      nicht abschaltbar (GF 403, Manifest 409, Freigabe fällt), Re-Import nach Studio-
//      KI = ODER + ki_konflikt, Re-Import veröffentlicht 409, Meldungen gefiltert,
//      Range-Deckel 8 MB, kaputte Range → 200, no-cache + Sandbox, Zähler-Weg,
//      heute_posts, bei_claude, nur_filter, Fehlversuche gedrosselt (429).
//  11. Website-Feed (E-296): reine Regeln (Bilder je Format, Sichtbarkeit, Text ohne
//      Hashtags ≤ 280 an der Wortgrenze, ≤ 5 Hashtags, Thema, Reihenfolge), Aktion
//      „website“ (Status, Version, Leitung, Verlauf, kein Bild, Wort-Check), „als
//      veröffentlicht melden“ schaltet beim ersten Melden mit ein, öffentlicher Feed
//      (Plantag, Status, Schalter, ohne Bild, Thema, Reihenfolge, Form), Bild-Route
//      (erlaubt / verborgen / Video / Plantag / 304), Web-Bilder 480 px (JPEG, Breite,
//      Seitenverhältnis, fremde Quelle, Video, doppelt, Leitung), neue Fassung → Schalter aus.
//
// NUR gegen die lokale Test-DB. Kein Netz außer localhost.
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e282' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-social.ts
// Testdaten: die 10 Launch-Posts aus 06_Marketing/…/04_Posts/2026-10-06_Launch (nur gelesen).
// Eigene Datensätze (extern_id „pruef294-…“ und „pruef296-…“) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "META_SYSTEM_TOKEN", "OPENAI_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHmac, createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import {
  SOCIAL_UEBERGAENGE, darfUebergang, erlaubteAktionen, zeichenZaehlen, zeichenStaende, rasterZuschnitt, rasterSymbol,
  checklisteSoll, offenePflichtpunkte, permalinkPruefen, manifestPruefen, planHinweise, socialWortcheck, socialFeldPruefen,
  ausnahmenAusManifest, SOCIAL_REGELSTAND, fingerabdruck, istVerworfenerOrdner, importKanon, KANAL_INFO,
} from "../shared/fiaon-social";
import { ANGEBOT_GARANTIE_FEST } from "../shared/fiaon-global-angebot";
import { dateiTypAusBytes } from "../server/lib/fiaon-social-dateien";
import {
  IMPORT_MAX_GESAMT_BYTES, feedBildEintraege, websiteStand, captionOhneHashtags, feedTextKuerzen, feedHashtags,
  feedThemaSlug, feedAnzahl, feedMarke, feedSortierung, feedNachThema, FEED_TEXT_MAX, FEED_HASHTAGS_MAX,
} from "../shared/fiaon-social";
import { SOZIAL_FEED_PFAD, sozialBildPfad, SOZIAL_WEBSITE_STATUS } from "../shared/fiaon-sozial-feed";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}${detail !== "" ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}` : ""}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);

const LAUNCH = path.join(os.homedir(), "Desktop/FIAON/06_Marketing/2026-10_Social_Media_Strategie/04_Posts/2026-10-06_Launch");
const ordnerVon = (nr: string) => fs.readdirSync(LAUNCH).find((n) => n.startsWith(`${nr}_`))!;
function launch(nr: string) {
  const o = path.join(LAUNCH, ordnerVon(nr));
  const metaText = fs.readFileSync(path.join(o, "meta.json"), "utf8");
  const meta = JSON.parse(metaText);
  const caption = fs.readFileSync(path.join(o, meta.caption_datei || "CAPTION.txt"), "utf8");
  const alt = meta.alt_text_datei && fs.existsSync(path.join(o, meta.alt_text_datei)) ? fs.readFileSync(path.join(o, meta.alt_text_datei), "utf8") : null;
  const dateien = (meta.dateien as any[]).map((d) => ({ name: String(d.datei), inhalt: fs.readFileSync(path.join(o, d.datei)) }));
  return { meta, caption, alt, dateien, ordner: ordnerVon(nr) };
}
/**
 * Post 03 mit der Caption vom Morgen des 06.10. („garantieren wir, sonst“ — Komma statt
 * Gedankenstrich, also ROT). Die Datei im Launch-Ordner ist seit 09:13 korrigiert; die
 * Prüfungen zur Wort-Check-Sperre brauchen aber genau die rote Fassung.
 */
const mitKomma03 = (l: ReturnType<typeof launch>) => ({ ...l, caption: l.caption.replace("garantieren wir — sonst", "garantieren wir, sonst") });

async function main() {
  // ═══ 1. Reine Regeln ═══════════════════════════════════════════════════════
  abschnitt("1. Reine Regeln");
  ok("zur_freigabe → freigegeben erlaubt", darfUebergang("zur_freigabe", "freigegeben"));
  ok("entwurf → freigegeben NICHT erlaubt (erst zur Freigabe)", !darfUebergang("entwurf", "freigegeben"));
  ok("veroeffentlicht → verworfen NICHT erlaubt", !darfUebergang("veroeffentlicht", "verworfen"));
  ok("verworfen ist Endstation", SOCIAL_UEBERGAENGE.verworfen.length === 0 && SOCIAL_UEBERGAENGE.ausgewertet.length === 0);
  ok("Aktionen zur_freigabe: freigeben, zurueck, verschieben, verwerfen", ["freigeben", "zurueck", "verschieben", "verwerfen"].every((a) => erlaubteAktionen("zur_freigabe").includes(a as any)) && !erlaubteAktionen("zur_freigabe").includes("veroeffentlicht"));
  ok("Aktionen freigegeben: veroeffentlicht ja, freigeben nein", erlaubteAktionen("freigegeben").includes("veroeffentlicht") && !erlaubteAktionen("freigegeben").includes("freigeben"));
  ok("Aktionen verworfen: keine", erlaubteAktionen("verworfen").length === 0);
  ok("Zeichen nach Codepunkten (Emoji zählt 1)", zeichenZaehlen("a😀b") === 3);
  const zs = zeichenStaende({ caption: "x".repeat(2300), erster_kommentar: null, kanaele: ["instagram", "linkedin_firma"] });
  ok("IG 2.200 überschritten, LinkedIn 3.000 nicht", zs.find((z) => z.kanal === "instagram")!.ueber && !zs.find((z) => z.kanal === "linkedin_firma")!.ueber);
  ok("Grenzen laut Konzept (IG 2200, LI 3000, TT 2200)", KANAL_INFO.instagram.captionMax === 2200 && KANAL_INFO.linkedin_firma.captionMax === 3000 && KANAL_INFO.tiktok.captionMax === 2200);
  const z45 = rasterZuschnitt(1080, 1350);
  ok("3:4 aus 4:5: seitlich je 3,13 %, Breite 93,75 %", z45.x === 3.13 && z45.breite === 93.75 && z45.y === 0 && z45.hoehe === 100, z45);
  const z916 = rasterZuschnitt(1080, 1920);
  ok("3:4 aus 9:16: oben/unten je 12,5 %", z916.y === 12.5 && z916.hoehe === 75 && z916.x === 0, z916);
  ok("Rastersymbole Reel/Karussell/Bild", rasterSymbol("reel") === "reel" && rasterSymbol("karussell") === "karussell" && rasterSymbol("bild") === null);
  const soll = checklisteSoll({ format: "reel", ki_noetig: true, link: "fiaon.com", kanaele: ["instagram", "facebook", "tiktok", "youtube_shorts"] });
  ok("KI nötig: KI-Haken in jedem Kanal Pflicht", (["instagram", "facebook", "tiktok", "youtube_shorts"] as const).every((k) => soll[k]!.some((p) => p.punkt === "ki_info" && p.pflicht)));
  ok("Reel: Instagram fragt Titelbild und Musik", soll.instagram!.some((p) => p.punkt === "titelbild") && soll.instagram!.some((p) => p.punkt === "musik"));
  ok("offene Pflichtpunkte ohne Haken = KI", offenePflichtpunkte(soll, {}, "instagram").map((p) => p.punkt).join() === "ki_info");
  ok("mit Haken keine offenen", offenePflichtpunkte(soll, { instagram: { ki_info: { am: "x", von: "y" } } }, "instagram").length === 0);
  const sollOhne = checklisteSoll({ format: "karussell", ki_noetig: false, link: "fiaon.com", kanaele: ["linkedin_firma"] });
  ok("ohne KI: kein Pflichtpunkt; LinkedIn: Link in den ersten Kommentar", !sollOhne.linkedin_firma!.some((p) => p.pflicht) && sollOhne.linkedin_firma!.some((p) => p.punkt === "link_kommentar"));
  ok("Permalink Instagram richtig", permalinkPruefen("instagram", "https://www.instagram.com/p/ABC123/") === null);
  ok("Permalink falscher Host abgelehnt", !!permalinkPruefen("instagram", "https://www.facebook.com/p/1"));
  ok("Permalink http abgelehnt", !!permalinkPruefen("instagram", "http://www.instagram.com/p/x"));
  ok("Permalink Startseite abgelehnt", !!permalinkPruefen("instagram", "https://instagram.com/"));
  ok("_verworfen-Ordner erkannt", istVerworfenerOrdner("2026-10-06_Launch/_verworfen_09_Bild") && !istVerworfenerOrdner("09_Karussell_Karriere"));
  const m01 = manifestPruefen(launch("01").meta);
  ok("Manifest 01 (Reel) gültig", m01.ok, m01);
  const kaputt = manifestPruefen({ schema: "fiaon-social-post/1", id: "A B", titel: "", format: "film", marke: "x", kanaele: ["myspace"], plan: { datum: "2026-02-30" }, dateien: [{ datei: "../x.jpg", rolle: "bild" }] });
  ok("Manifest kaputt: deutsche Fehler, mehrere", !kaputt.ok && (kaputt as any).fehler.length >= 6 && (kaputt as any).fehler.every((f: string) => /[a-zäöü]/.test(f)), kaputt);
  const ohneKi = manifestPruefen({ ...launch("02").meta, ki_kennzeichnung: undefined });
  ok("Manifest ohne KI-Kennzeichnung abgelehnt", !ohneKi.ok);
  const ph = planHinweise([
    { id: 1, format: "reel", status: "zur_freigabe", plan_datum: "2026-10-08", plan_zeit: "18:00" },
    { id: 2, format: "reel", status: "freigegeben", plan_datum: "2026-10-08", plan_zeit: "18:00" },
    { id: 3, format: "bild", status: "zur_freigabe", plan_datum: "2026-10-05", plan_zeit: null },
  ], "2026-10-05", "2026-10-10", "2026-10-06");
  ok("Plan: zwei Reels gleichzeitig gewarnt", ph.some((h) => h.art === "reels_gleichzeitig" && h.post_ids.length === 2));
  ok("Plan: Lücken nur ab heute", ph.filter((h) => h.art === "luecke").map((h) => h.datum).join() === "2026-10-06,2026-10-07,2026-10-09,2026-10-10", ph);
  ok("Plan: überfällige Freigabe gemeldet", ph.some((h) => h.art === "ueberfaellig" && h.post_ids[0] === 3));

  // ═══ 2. Wort-Check ═════════════════════════════════════════════════════════
  abschnitt("2. Wort-Check (Hülle um globalWortPruefen, feste Ausnahmen)");
  const l03 = mitKomma03(launch("03"));
  const ausn03 = ausnahmenAusManifest(l03.meta.wortcheck.ausnahmen);
  ok("Manifest-Freitext → garantie_annahme + vip_bis_zu", ausn03.schluessel.includes("garantie_annahme") && ausn03.schluessel.includes("vip_bis_zu") && !ausn03.unbekannt.length, ausn03);
  const wc03 = socialWortcheck({ marke: "global", titel: l03.meta.titel, caption: l03.caption, alt_text: l03.alt, hashtags: l03.meta.hashtags, bildtexte: l03.meta.bildtexte, ausnahmen: ausn03.schluessel, manifest: l03.meta.wortcheck });
  const f7 = wc03.felder.find((f) => f.feld === "bildtexte[6]");
  ok("03 Folie 7: Garantie-Satz per Ausnahme grün", !!f7 && f7.treffer.length === 0 && f7.ausnahmen_genutzt.includes("garantie_annahme"), f7);
  const f6 = wc03.felder.find((f) => f.feld === "bildtexte[5]");
  ok("03 Folie 6: „bis zu 1.000.000 $“ per Ausnahme grün", !!f6 && f6.treffer.length === 0 && f6.ausnahmen_genutzt.includes("vip_bis_zu"), f6);
  const cap = wc03.felder.find((f) => f.feld === "caption");
  ok("03 Caption mit Komma statt Gedankenstrich bleibt ROT", !!cap && cap.treffer.some((t) => /garant/i.test(t.treffer)), cap);
  ok("03 gesamt rot + Abweichung zum Manifest", wc03.ergebnis === "rot" && wc03.abweichung_zum_manifest);
  const g = ANGEBOT_GARANTIE_FEST.annahmeUnterKnopf;
  const begleit = "Es gelten Ziel, Frist und Bedingungen Ihres Vertrags.";
  ok("Garantie-Satz bei Marke fiaon bleibt rot", socialFeldPruefen(`${g} ${begleit}`, "fiaon", ["garantie_annahme"]).treffer.length > 0);
  ok("Garantie-Satz ohne Begleitsatz bleibt rot", socialFeldPruefen(g, "global", ["garantie_annahme"]).treffer.length > 0);
  ok("Garantie-Satz mit Begleitsatz grün", socialFeldPruefen(`${g} ${begleit}`, "global", ["garantie_annahme"]).treffer.length === 0);
  ok("„garantiert“ in anderem Satz bleibt rot", socialFeldPruefen(`${g} ${begleit} Ihr Erfolg ist garantiert.`, "global", ["garantie_annahme"]).treffer.length > 0);
  ok("„bis zu 500.000 $“ bleibt rot", socialFeldPruefen("Kapitalrahmen bis zu 500.000 $", "global", ["vip_bis_zu"]).treffer.length > 0);
  ok("Geschütztes Leerzeichen wird normalisiert", socialFeldPruefen("Kapitalrahmen bis zu 1.000.000 $", "global", ["vip_bis_zu"]).treffer.length === 0);
  ok("Ausnahme ohne Freigabe im Post greift nicht", socialFeldPruefen(`${g} ${begleit}`, "global", []).treffer.length > 0);
  const unbek = ausnahmenAusManifest(["„empfehlen“ ist hier okay"]);
  ok("unbekannte Ausnahme wird nicht angewendet", unbek.schluessel.length === 0 && unbek.unbekannt.length === 1);
  ok("Zusage „wir rufen Sie an“ bleibt rot (kein Werkzeug deckt sie)", socialWortcheck({ marke: "fiaon", caption: "Wir rufen Sie morgen an." }).ergebnis === "rot");
  ok("Regelstand ist ein fester Fingerabdruck; andere Quelle → anderer Stand", /^[0-9a-f]{14}$/.test(SOCIAL_REGELSTAND) && fingerabdruck("a") !== fingerabdruck("b"));
  for (const nr of ["01", "02", "04", "05", "06", "07", "08", "09", "10"]) {
    const l = launch(nr);
    const a = ausnahmenAusManifest(l.meta.wortcheck?.ausnahmen ?? []);
    const w = socialWortcheck({ marke: l.meta.marke, titel: l.meta.titel, caption: l.caption, alt_text: l.alt, hashtags: l.meta.hashtags, bildtexte: l.meta.bildtexte, ausnahmen: a.schluessel });
    ok(`Launch ${nr} grün`, w.ergebnis !== "rot", w.felder);
  }

  // ═══ 3. Dateien ════════════════════════════════════════════════════════════
  abschnitt("3. Dateien: Typ aus Bytes, Maße");
  const l01 = launch("01");
  const reel = dateiTypAusBytes(l01.dateien[0].inhalt);
  ok("Reel: video/mp4, 1080×1920, 14 s, moov vorne", reel?.mime === "video/mp4" && reel.breite === 1080 && reel.hoehe === 1920 && reel.sekunden === 14 && reel.moovVorne === true, reel);
  const jpg = dateiTypAusBytes(launch("02").dateien[0].inhalt);
  ok("Folie: image/jpeg, 1080×1350", jpg?.mime === "image/jpeg" && jpg.breite === 1080 && jpg.hoehe === 1350, jpg);
  ok("Text ist kein erlaubter Typ", dateiTypAusBytes(Buffer.from("Hallo Welt, kein Bild")) === null);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.from([0, 0, 4, 56, 0, 0, 7, 128])]);
  ok("PNG-Kopf: 1080×1920", dateiTypAusBytes(png)?.breite === 1080 && dateiTypAusBytes(png)?.hoehe === 1920);
  const pngRiesig = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.from([0xff, 0xff, 0xff, 0xff, 0, 0, 7, 128])]);
  ok("PNG mit 4,29 Mrd. Breite: Breite null statt Überlauf", dateiTypAusBytes(pngRiesig)?.breite === null && dateiTypAusBytes(pngRiesig)?.hoehe === 1920);
  const mSek = manifestPruefen({ ...launch("01").meta, dateien: launch("01").meta.dateien.map((d: any, i: number) => (i === 0 ? { ...d, sekunden: 1e7 } : d)) });
  ok("Manifest sekunden 1e7: gültig, aber null + Warnung", mSek.ok && mSek.manifest.dateien[0].sekunden === null && mSek.warnungen.some((w) => /sekunden/.test(w)), mSek);
  const kanon1 = importKanon(m01.ok ? m01.manifest : (null as any), "a\r\n", null, [{ pos: 1, rolle: "video", sha256: "x" }]);
  const kanon2 = importKanon(m01.ok ? { ...m01.manifest, status: "zur_freigabe", plan: { ...m01.manifest.plan, datum: "2026-12-24" } } : (null as any), "a\n", null, [{ pos: 1, rolle: "video", sha256: "x" }]);
  ok("Import-Prüfsumme ohne Status/Plan, CRLF egal", kanon1 === kanon2);

  // ═══ 11a. Website-Feed: reine Regeln (E-296) ═══════════════════════════════
  abschnitt("11a. Website-Feed: reine Regeln (E-296)");
  {
    const d = (datei_id: number, pos: number, rolle: string, mime = "image/jpeg") => ({ datei_id, pos, rolle, mime });
    ok("Reel: nur das Titelbild", feedBildEintraege("reel", [d(1, 1, "video", "video/mp4"), d(2, 2, "cover")]).map((x) => x.datei_id).join() === "2");
    ok("Karussell: Folien nach pos, Titelbild nicht", feedBildEintraege("karussell", [d(5, 3, "bild"), d(3, 1, "bild"), d(9, 4, "cover"), d(4, 2, "bild")]).map((x) => x.datei_id).join() === "3,4,5");
    ok("ohne Folie: Titelbild als Ersatz; PDF/Video nie", feedBildEintraege("dokument", [d(7, 1, "dokument", "application/pdf"), d(8, 2, "cover")]).map((x) => x.datei_id).join() === "8"
      && feedBildEintraege("bild", [d(7, 1, "dokument", "application/pdf")]).length === 0 && feedBildEintraege("reel", [d(1, 1, "video", "video/mp4")]).length === 0);
    ok("Story und Text: kein Bild (Rolle story zählt nicht)", feedBildEintraege("story", [d(1, 1, "story")]).length === 0 && feedBildEintraege("text", []).length === 0);
    ok("gleiche Datei zweimal: einmal", feedBildEintraege("karussell", [d(3, 1, "bild"), d(3, 2, "bild")]).length === 1);
    const st = (o: Partial<Parameters<typeof websiteStand>[0]>, heute = "2026-10-06") =>
      websiteStand({ website_sichtbar: true, status: "veroeffentlicht", plan_datum: "2026-10-06", format: "bild", dateien: [d(1, 1, "bild")], kanaele: ["instagram", "facebook"], gemeldet: ["instagram"], ...o }, heute);
    ok("Sichtbar: Schalter + auf Instagram veröffentlicht + Plantag heute + Bild", st({}).jetzt && st({}).grund === null);
    ok("Schalter aus → nicht sichtbar (Grund „aus“)", !st({ website_sichtbar: false }).jetzt && st({ website_sichtbar: false }).grund === "aus");
    ok("zur_freigabe/entwurf/verworfen → nicht sichtbar (Grund „status“)", ["zur_freigabe", "entwurf", "verworfen"].every((s) => st({ status: s }).grund === "status"));
    ok("Website-Status sind nur veröffentlicht und ausgewertet", SOZIAL_WEBSITE_STATUS.join() === "veroeffentlicht,ausgewertet" && SOZIAL_WEBSITE_STATUS.every((s) => st({ status: s }).jetzt));
    ok("freigegeben/eingeplant mit Schalter: vorgemerkt, NICHT sichtbar (Grund „instagram“), darf_an ja",
      ["freigegeben", "eingeplant"].every((s) => st({ status: s, gemeldet: [] }).grund === "instagram" && !st({ status: s, gemeldet: [] }).jetzt && st({ status: s, gemeldet: [], website_sichtbar: false }).darf_an));
    ok("veröffentlicht nur auf Facebook → nicht sichtbar (Grund „instagram“)", st({ gemeldet: ["facebook"] }).grund === "instagram" && /sobald/.test(st({ gemeldet: ["facebook"] }).satz));
    ok("ohne Instagram-Kanal → darf_an nein, Satz sagt es", !st({ kanaele: ["facebook"], website_sichtbar: false }).darf_an && /nicht auf Instagram/.test(st({ kanaele: ["facebook"], website_sichtbar: false }).satz) && st({ kanaele: ["facebook"] }).grund === "instagram");
    ok("Wort-Check rot bei Schalter an → nicht sichtbar (Grund „wortcheck“)", st({ wortcheck_rot: true }).grund === "wortcheck" && !st({ wortcheck_rot: true }).jetzt);
    ok("Plantag morgen → erst dann (Grund „plantag“, ab = Plantag)", st({ plan_datum: "2026-10-07" }).grund === "plantag" && st({ plan_datum: "2026-10-07" }).ab === "2026-10-07" && /07\.10\.2026/.test(st({ plan_datum: "2026-10-07" }).satz));
    ok("Plantag gestern → sichtbar", st({ plan_datum: "2026-10-05" }).jetzt);
    ok("ohne Bild → nie (Grund „kein_bild“), darf_an nein", st({ dateien: [] }).grund === "kein_bild" && !st({ dateien: [], website_sichtbar: false }).darf_an);
    ok("Wort-Check rot → darf nicht eingeschaltet werden", !st({ website_sichtbar: false, wortcheck_rot: true }).darf_an && st({ website_sichtbar: false }).darf_an);
    ok("Web-Bilder gezählt", st({ dateien: [d(1, 1, "bild"), d(2, 2, "bild")], web_480_ids: new Set([2]) }).web_480 === 1 && st({ dateien: [d(1, 1, "bild"), d(2, 2, "bild")] }).bilder === 2);
    ok("Aktion „website“ (vormerken) ab der Freigabe", erlaubteAktionen("freigegeben").includes("website") && erlaubteAktionen("ausgewertet").includes("website") && !erlaubteAktionen("zur_freigabe").includes("website") && !erlaubteAktionen("verworfen").includes("website"));

    const cap01 = launch("01").caption;
    const ohne01 = captionOhneHashtags(cap01);
    ok("Caption ohne Hashtags: kein „#“, Text und KI-Satz bleiben, keine Leerzeilen am Ende", !ohne01.includes("#") && ohne01.includes("Bildmaterial mit KI erstellt.") && ohne01.startsWith("Ihre Bonität") && ohne01 === ohne01.trim(), ohne01.slice(-80));
    ok("Hashtags mitten im Satz und Punkt-Zeilen weg, Umlaute erkannt", captionOhneHashtags("Hallo #Bonität Welt\n.\n.\n#SCHUFA #KSV") === "Hallo Welt", captionOhneHashtags("Hallo #Bonität Welt\n.\n.\n#SCHUFA #KSV"));
    ok("„C#“ und „Nr.#1“ (kein Leerzeichen davor) bleiben", captionOhneHashtags("Wir nutzen C# und Nr.#1") === "Wir nutzen C# und Nr.#1");
    const lang = "Wort ".repeat(80).trim();
    const k1 = feedTextKuerzen(lang);
    ok(`Text gekürzt: höchstens ${FEED_TEXT_MAX} Zeichen, endet mit „…“, an der Wortgrenze`, Array.from(k1).length <= FEED_TEXT_MAX && k1.endsWith("…") && /Wort…$/.test(k1), k1.length);
    ok("kurzer Text bleibt unverändert", feedTextKuerzen("Kurz und gut.") === "Kurz und gut.");
    const k05 = feedTextKuerzen(captionOhneHashtags(launch("05").caption));
    ok("Kürzen nach einem ganzen Satz („Die Bank erhöht nicht von selbst.“ bleibt ganz oder fehlt)", Array.from(k05).length <= FEED_TEXT_MAX && k05.endsWith(". …") && !/erhöht\s*…$/.test(k05) && (!k05.includes("Die Bank erhöht") || k05.includes("Die Bank erhöht nicht von selbst.")), k05.slice(-60));
    const abk = feedTextKuerzen(`${"Satz eins ist hier. ".repeat(7)}Seit 1. Juli gilt zzgl. Gebühr ${"weiter ".repeat(40)}`);
    ok("„1. Juli“ und „zzgl.“ sind kein Satzende", abk === `${"Satz eins ist hier. ".repeat(7).trimEnd()} …`, abk.slice(-40));
    const emoji = "😀".repeat(400);
    ok("Kürzen zählt Codepunkte (Emoji = 1), nie ein halbes Emoji", Array.from(feedTextKuerzen(emoji)).length === FEED_TEXT_MAX && !feedTextKuerzen(emoji).includes("�"));
    ok("Satzzeichen vor „…“ fallen weg", feedTextKuerzen(`${"abc ".repeat(68)}xyz, und weiter geht es hier`, 280).endsWith("…") && !/[,;:]…$/.test(feedTextKuerzen(`${"abc ".repeat(69)}, weiter und weiter und weiter`, 280)));
    const h = feedHashtags(["#Bonität", "#SCHUFA", "#bonität", "Finanzwissen", "#KSV", "#FIAON", "#Sechs", "#mit Leerzeichen"]);
    ok(`Hashtags: ohne „#“, ohne Doppelte, höchstens ${FEED_HASHTAGS_MAX}`, h.join() === "Bonität,SCHUFA,Finanzwissen,KSV,FIAON", h);
    ok("Hashtags ohne Liste: aus der Caption", feedHashtags([], cap01).join() === "Bonität,SCHUFA,Finanzwissen,KSV,FIAON", feedHashtags([], cap01));
    ok("thema: klein, nur a–z0–9-_, sonst keins", feedThemaSlug("SCHUFA") === "schufa" && feedThemaSlug("../x") === null && feedThemaSlug("") === null && feedThemaSlug("a".repeat(41)) === null && feedThemaSlug("p-konto") === "p-konto");
    ok("n: Standard 9, 1…12", feedAnzahl(undefined) === 9 && feedAnzahl("") === 9 && feedAnzahl("abc") === 9 && feedAnzahl("0") === 1 && feedAnzahl("99") === 12 && feedAnzahl("4") === 4);
    ok("marke: fiaon | global | sonst alle", feedMarke("fiaon") === "fiaon" && feedMarke("global") === "global" && feedMarke("FIAON") === "alle" && feedMarke(undefined) === "alle");
    const sort = [
      { id: 1, zeit_ms: 1000, reihenfolge: 2 }, { id: 2, zeit_ms: 3000, reihenfolge: null }, { id: 3, zeit_ms: 1000, reihenfolge: 7 }, { id: 4, zeit_ms: 1000, reihenfolge: 7 },
    ].sort(feedSortierung).map((x) => x.id).join();
    ok("Reihenfolge: neueste zuerst, dann höhere Reihenfolge, dann höhere id", sort === "2,4,3,1", sort);
    ok("Thema: passende zuerst, Reihenfolge sonst gleich", feedNachThema([{ id: 1, themen: ["a"] }, { id: 2, themen: ["schufa"] }, { id: 3, themen: [] }, { id: 4, themen: ["SCHUFA"] }], "schufa").map((x) => x.id).join() === "2,4,1,3");
  }

  // ═══ 4. Import über den echten Router ═════════════════════════════════════
  abschnitt("4. Import (echter Router, lokale DB)");
  const { sqlPool } = await import("../server/lib/db-pool");
  const { ensureSocialTabellen } = await import("../server/lib/fiaon-social");
  await ensureSocialTabellen();
  const aufraeumen = async () => {
    const ids = ((await sqlPool`SELECT id FROM fiaon_social_posts WHERE extern_id LIKE 'pruef294-%' OR extern_id LIKE 'pruef296-%'`) as any[]).map((r) => Number(r.id));
    if (ids.length) {
      await sqlPool`DELETE FROM fiaon_social_verlauf WHERE post_id = ANY(${ids}::int[])`;
      await sqlPool`DELETE FROM fiaon_social_dateien WHERE post_id = ANY(${ids}::int[])`;
      await sqlPool`DELETE FROM fiaon_social_posts WHERE id = ANY(${ids}::int[])`;
    }
  };
  await aufraeumen();
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const router = (await import("../server/routes/fiaon-social")).default;
  const app = express();
  app.use(cookieParser()); app.use(express.json());
  app.use("/api/fiaon", router);
  const server = app.listen(0);
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fiaon`;
  const keks = (stufe: "inhaber" | "geschaeftsfuehrung" | "leitung", agent = stufe === "inhaber" ? 900001 : stufe === "geschaeftsfuehrung" ? 900002 : 900003) => {
    const exp = Date.now() + 3_600_000;
    const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:${agent}:${stufe}:${exp}`).digest("hex").slice(0, 40);
    return `fiaon_chef=${agent}.${stufe}.${exp}.${sig}`;
  };
  const TOKEN = "pruef-294-lokal-token-mindestens-32-zeichen-lang";
  const holen = async (pfad: string, init: RequestInit & { stufe?: "inhaber" | "geschaeftsfuehrung" | "leitung" | null } = {}) => {
    const h: Record<string, string> = { ...(init.headers as any || {}) };
    if (init.stufe !== null) h.cookie = keks(init.stufe ?? "geschaeftsfuehrung");
    const r = await echtFetch(`${basis}${pfad}`, { ...init, headers: h });
    const typ = r.headers.get("content-type") || "";
    return { status: r.status, kopf: r.headers, json: typ.includes("json") ? (await r.json().catch(() => null)) as any : null, roh: typ.includes("json") ? null : Buffer.from(await r.arrayBuffer()) };
  };
  const aktion = (id: number, a: string, body: unknown, stufe: "inhaber" | "geschaeftsfuehrung" | "leitung" = "geschaeftsfuehrung") =>
    holen(`/chef/social/post/${id}/${a}`, { method: "POST", stufe, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const importieren = async (l: ReturnType<typeof launch>, opt: { id: string; caption?: string; dateien?: { name: string; inhalt: Buffer }[]; probe?: boolean; token?: string | null; ordner?: string; meta?: any }) => {
    const meta = { ...(opt.meta ?? l.meta), id: opt.id };
    const fd = new FormData();
    fd.append("meta", JSON.stringify(meta));
    fd.append("caption", opt.caption ?? l.caption);
    if (l.alt) fd.append("alt", l.alt);
    fd.append("ordner", opt.ordner ?? l.ordner);
    for (const d of opt.dateien ?? l.dateien) fd.append("dateien", new Blob([d.inhalt]), d.name);
    const headers: Record<string, string> = {};
    if (opt.token !== null) headers.authorization = `Bearer ${opt.token ?? TOKEN}`;
    return holen(`/social/import${opt.probe ? "?probe=1" : ""}`, { method: "POST", body: fd, headers, stufe: null });
  };

  try {
    delete process.env.SOCIAL_IMPORT_TOKEN;
    const l02 = launch("02");
    let r = await importieren(l02, { id: "pruef294-02" });
    ok("ohne SOCIAL_IMPORT_TOKEN am Server: 503", r.status === 503 && r.json?.code === "IMPORT_NICHT_EINGERICHTET", r.json);
    process.env.SOCIAL_IMPORT_TOKEN = "zu-kurz-1234";
    r = await importieren(l02, { id: "pruef294-02", token: "zu-kurz-1234" });
    ok("SOCIAL_IMPORT_TOKEN kürzer als 32 Zeichen: 503 (nicht eingerichtet)", r.status === 503 && r.json?.code === "IMPORT_NICHT_EINGERICHTET" && /32/.test(r.json?.error ?? ""), r.json);
    process.env.SOCIAL_IMPORT_TOKEN = TOKEN;
    r = await importieren(l02, { id: "pruef294-02", token: "falsch" });
    ok("falsches Token: 401", r.status === 401 && r.json?.code === "TOKEN_FALSCH", r.json);
    r = await importieren(l02, { id: "pruef294-02", token: null });
    ok("ohne Token und ohne Sitzung: 401 (Chef-Anmeldung)", r.status === 401, r.json);
    r = await holen("/chef/social/plan", { stufe: null, headers: { authorization: `Bearer ${TOKEN}` } });
    ok("Token an Studio-Route: 401 — der Token darf nur importieren", r.status === 401, r.json);
    r = await importieren(l02, { id: "pruef294-02", probe: true, dateien: [] });
    ok("Probe ohne Dateien: neu, nichts fehlt (Bytes liegen schon aus dem Launch-Import)", r.status === 200 && r.json?.probe && r.json?.ergebnis === "neu" && r.json?.dateien?.fehlend?.length === 0, r.json);
    r = await importieren(l02, { id: "pruef294-02" });
    ok("Import neu: 201, zur_freigabe, Fassung 1", r.status === 201 && r.json?.ergebnis === "neu" && r.json?.status === "zur_freigabe" && r.json?.fassung === 1, r.json);
    ok("Import neu: Manifest-Status „freigegeben“ ignoriert (Hinweis)", (r.json?.hinweise ?? []).some((h: string) => /ignoriert/.test(h)));
    const id02 = Number(r.json?.id);
    const audit = (await sqlPool`SELECT stufe, notiz FROM fiaon_admin_log WHERE ziel = ${"social:" + id02} ORDER BY id DESC LIMIT 1`) as any[];
    ok("Token-Import steht im fiaon_admin_log (stufe import, ohne Schlüssel)", audit[0]?.stufe === "import" && /Token/.test(audit[0]?.notiz ?? "") && !String(audit[0]?.notiz).includes(TOKEN), audit[0]);
    r = await importieren(l02, { id: "pruef294-02", dateien: [] });
    ok("zweiter Import ohne Dateien: unveraendert, 200", r.status === 200 && r.json?.ergebnis === "unveraendert" && r.json?.id === id02, r.json);
    const falsch = l02.dateien.map((d, i) => (i === 0 ? { name: d.name, inhalt: Buffer.concat([d.inhalt, Buffer.from([0])]) } : d));
    r = await importieren(l02, { id: "pruef294-02", dateien: falsch });
    ok("falsche Prüfsumme: 422 PRUEFSUMME", r.status === 422 && r.json?.code === "PRUEFSUMME", r.json);
    r = await importieren(l02, { id: "pruef294-02", ordner: "2026-10-06_Launch/_verworfen_09_Bild" });
    ok("Ordner _verworfen: 422", r.status === 422 && r.json?.code === "VERWORFENER_ORDNER", r.json);
    const fremdMeta = { ...l02.meta, dateien: [...l02.meta.dateien, { datei: "gibts_nicht.jpg", rolle: "bild", sha256: "0".repeat(64) }] };
    r = await importieren(l02, { id: "pruef294-02b", meta: fremdMeta, dateien: [] });
    ok("Datei weder hochgeladen noch in der DB: 422 DATEI_FEHLT mit Liste", r.status === 422 && r.json?.code === "DATEI_FEHLT" && r.json?.fehlend?.includes("0".repeat(64)), r.json);
    r = await importieren(l02, { id: "pruef294-02b", meta: fremdMeta, dateien: [], probe: true });
    ok("Probe nennt die fehlende sha256", r.status === 200 && r.json?.dateien?.fehlend?.length === 1, r.json);
    r = await importieren(l02, { id: "pruef294-02c", dateien: [{ name: "fremd.jpg", inhalt: l02.dateien[0].inhalt }] });
    ok("Datei, die nicht im Manifest steht: 422", r.status === 422 && /nicht in meta\.json/.test(r.json?.error ?? ""), r.json);
    const verweisFalsch = { ...l02.meta, dateien: l02.meta.dateien.map((d: any, i: number) => (i === 0 ? { ...d, rolle: "video" } : d)) };
    r = await importieren(l02, { id: "pruef294-02t", meta: { ...verweisFalsch, format: "reel" }, dateien: [] });
    ok("Verweis per sha256 auf ein JPEG als Rolle „video“: 422 DATEI_TYP", r.status === 422 && r.json?.code === "DATEI_TYP", r.json);
    r = await importieren(l02, { id: "pruef294-02", caption: l02.caption + "\nNeuer Satz." });
    ok("geänderte Caption: neue_version, Fassung 2, zur_freigabe", r.status === 200 && r.json?.ergebnis === "neue_version" && r.json?.fassung === 2 && r.json?.status === "zur_freigabe", r.json);

    // ═══ 5. Studio-Routen ═════════════════════════════════════════════════
    abschnitt("5. Studio: Plan, Detail, Freigeben, Wort-Check-Sperre");
    r = await holen("/chef/social/plan?von=2026-10-01&bis=2026-10-31");
    ok("Plan (GF): 200 mit Karten und Zählern", r.status === 200 && r.json?.ok && r.json.posts.some((p: any) => p.id === id02) && typeof r.json.zaehler.zur_freigabe === "number", r.json?.error);
    ok("Plan: ich.stufe GF, darfTrotzdem nein", r.json?.ich?.stufe === "geschaeftsfuehrung" && r.json?.ich?.darfTrotzdem === false);
    const karte = r.json?.posts?.find((p: any) => p.id === id02);
    ok("Karte: Vorschau-URL, 7 Dateien, Format", karte?.vorschau?.url?.startsWith("/api/fiaon/chef/social/datei/") && karte?.dateien_anzahl === 7 && karte?.format === "karussell", karte);
    r = await holen("/chef/social/plan", { stufe: "leitung" });
    ok("Leitung: 403", r.status === 403);
    r = await holen(`/chef/social/post/${id02}`);
    const d02 = r.json?.post;
    ok("Detail: Dateien mit Download-Namen „Folie-01“", r.status === 200 && d02?.dateien?.[0]?.download_name?.endsWith("_Folie-01.jpg"), d02?.dateien?.[0]);
    {
      // Die Bytes kamen per COPY-Strom in die DB (Upload) — Stück für Stück identisch?
      const erste = d02.dateien[0];
      const rr = await holen(`/chef/social/datei/${erste.id}`);
      const soll = l02.dateien.find((x) => x.name === l02.meta.dateien[0].datei)!.inhalt;
      ok("Upload per COPY-Strom: Bytes identisch (sha256, Länge)", rr.status === 200 && rr.roh?.length === soll.length && createHash("sha256").update(rr.roh!).digest("hex") === createHash("sha256").update(soll).digest("hex") && erste.sha256 === createHash("sha256").update(soll).digest("hex"));
    }
    ok("Detail: Verlauf mit import_neu und neue_version", ["import_neu", "neue_version"].every((a) => d02?.verlauf?.some((v: any) => v.art === a)));
    ok("Detail: Checkliste-Soll und Zeichen je Kanal", !!d02?.checkliste_soll?.instagram && d02?.zeichen?.some((z: any) => z.kanal === "instagram"));
    r = await aktion(id02, "freigeben", { version: d02.version - 1 });
    ok("Freigeben mit alter Version: 409 VERSION_VERALTET + aktuelle Version", r.status === 409 && r.json?.code === "VERSION_VERALTET" && r.json?.version === d02.version, r.json);
    r = await aktion(id02, "freigeben", { version: d02.version });
    ok("Freigeben (GF, grün): 200, freigegeben, version+1", r.status === 200 && r.json?.post?.status === "freigegeben" && r.json?.post?.version === d02.version + 1 && r.json?.post?.freigabe?.trotz_rot === false, r.json);
    const prot = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_admin_log WHERE ziel = ${"social:" + id02}`) as any[];
    ok("chefProtokoll: Zeile mit Ziel social:<id>", Number(prot[0]?.n) >= 1);

    const l03 = mitKomma03(launch("03"));
    r = await importieren(l03, { id: "pruef294-03", dateien: [] });
    ok("03 importiert (Bytes aus der DB kopiert), Wort-Check rot", r.status === 201 && r.json?.wortcheck?.ergebnis === "rot" && r.json?.wortcheck?.abweichung_zum_manifest === true, r.json);
    const id03 = Number(r.json?.id);
    let p03 = (await holen(`/chef/social/post/${id03}`)).json?.post;
    ok("Detail 03: Sperre „freigeben“ mit Satz", typeof p03?.sperren?.freigeben === "string" && /rot/.test(p03.sperren.freigeben));
    r = await aktion(id03, "freigeben", { version: p03.version });
    ok("Wort-Check rot, GF: 409 WORTCHECK_ROT mit Feldern", r.status === 409 && r.json?.code === "WORTCHECK_ROT" && r.json?.felder?.some((f: any) => f.feld === "caption"), r.json);
    r = await aktion(id03, "freigeben", { version: p03.version, trotzdem: true, grund: "Justin hat es geprüft und will es so." });
    ok("trotzdem freigeben als GF: 403 NUR_INHABER", r.status === 403 && r.json?.code === "NUR_INHABER", r.json);
    r = await aktion(id03, "freigeben", { version: p03.version, trotzdem: true, grund: "kurz" }, "inhaber");
    ok("Inhaber trotzdem ohne ausreichenden Grund: 400 GRUND_FEHLT", r.status === 400 && r.json?.code === "GRUND_FEHLT", r.json);
    r = await aktion(id03, "freigeben", { version: p03.version, trotzdem: true, grund: "Prüfstand: bewusst trotz Komma freigegeben." }, "inhaber");
    ok("Inhaber trotzdem mit Grund: 200, trotz_rot im Post", r.status === 200 && r.json?.post?.status === "freigegeben" && r.json?.post?.freigabe?.trotz_rot === true, r.json);
    ok("Verlauf: freigabe_trotz_rot mit Grund", r.json?.post?.verlauf?.some((v: any) => v.art === "freigabe_trotz_rot" && /Komma/.test(v.grund ?? "")));
    p03 = r.json.post;
    r = await aktion(id03, "ki-haken", { version: p03.version, noetig: false, grund: "kur" });
    ok("KI-Pflicht senken als GF: 403 NUR_INHABER", r.status === 403 && r.json?.code === "NUR_INHABER", r.json);
    r = await aktion(id03, "ki-haken", { version: p03.version, noetig: false, grund: "Inhaber meint: keine KI im Bild." }, "inhaber");
    ok("KI-Pflicht senken, wenn meta.json „nötig“ sagt: 409 (auch Inhaber)", r.status === 409 && r.json?.code === "UEBERGANG_UNZULAESSIG", r.json);
    p03 = (await holen(`/chef/social/post/${id03}`)).json.post;
    ok("… Post bleibt freigegeben mit KI-Pflicht", p03.status === "freigegeben" && p03.ki_noetig === true);

    // ═══ 6. Veröffentlichen ═══════════════════════════════════════════════
    abschnitt("6. Als veröffentlicht melden (KI-Haken, Permalink)");
    ok("03 ist KI-gekennzeichnet → Sperre am Melden", p03.ki_noetig === true && typeof p03.sperren?.veroeffentlicht === "string");
    r = await aktion(id03, "veroeffentlicht", { version: p03.version, meldungen: [{ kanal: "instagram", permalink: "https://www.instagram.com/p/PRUEF294/" }] });
    ok("ohne KI-Haken: 409 KI_HAKEN_FEHLT", r.status === 409 && r.json?.code === "KI_HAKEN_FEHLT" && r.json?.kanaele?.includes("instagram"), r.json);
    r = await aktion(id03, "checkliste", { version: p03.version, kanal: "instagram", punkt: "gibtsnicht", erledigt: true });
    ok("unbekannter Checklistenpunkt: 400", r.status === 400);
    r = await aktion(id03, "checkliste", { version: p03.version, kanal: "instagram", punkt: "ki_info", erledigt: true });
    ok("KI-Haken Instagram: 200", r.status === 200 && !!r.json?.post?.checkliste?.instagram?.ki_info, r.json);
    p03 = r.json.post;
    r = await aktion(id03, "veroeffentlicht", { version: p03.version, meldungen: [{ kanal: "instagram", permalink: "https://www.facebook.com/x/1" }] });
    ok("falscher Link: 400 PERMALINK_FEHLT", r.status === 400 && r.json?.code === "PERMALINK_FEHLT", r.json);
    r = await aktion(id03, "veroeffentlicht", { version: p03.version, meldungen: [{ kanal: "tiktok", permalink: "https://www.tiktok.com/@x/video/1" }] });
    ok("Kanal, der nicht zum Post gehört: 400", r.status === 400, r.json);
    r = await aktion(id03, "veroeffentlicht", { version: p03.version, meldungen: [{ kanal: "instagram", permalink: "https://www.instagram.com/p/PRUEF294/" }, { kanal: "instagram", permalink: "https://www.instagram.com/p/ANDERS/" }] });
    ok("derselbe Kanal zweimal in der Meldung: 400", r.status === 400 && /doppelt/.test(r.json?.error ?? ""), r.json);
    r = await aktion(id03, "veroeffentlicht", { version: p03.version, meldungen: [{ kanal: "instagram", permalink: "https://www.instagram.com/p/PRUEF294/", plattform_id: "x".repeat(500), boese: "y".repeat(5000) }] });
    ok("Haken + Link: 200, veröffentlicht, Link gespeichert", r.status === 200 && r.json?.post?.status === "veroeffentlicht" && r.json?.post?.veroeffentlicht?.instagram?.permalink === "https://www.instagram.com/p/PRUEF294/", r.json);
    p03 = r.json.post;
    ok("plattform_id auf 200 Zeichen gekürzt", p03.veroeffentlicht?.instagram?.plattform_id?.length === 200, p03.veroeffentlicht?.instagram?.plattform_id?.length);
    const vMeld = p03.verlauf.find((v: any) => v.art === "veroeffentlicht")?.nachher?.meldungen?.[0];
    ok("Verlauf: nur kanal, permalink, plattform_id — keine Zusatzfelder", !!vMeld && Object.keys(vMeld).sort().join() === "kanal,permalink,plattform_id", vMeld && Object.keys(vMeld));
    r = await aktion(id03, "verschieben", { version: p03.version, datum: "2026-10-20", zeit: "18:00" });
    ok("Veröffentlichtes verschieben: 409", r.status === 409);

    // ═══ 7. Re-Import ═════════════════════════════════════════════════════
    abschnitt("7. Re-Import nach Freigabe / Verschieben / Verwerfen; zurück an Claude");
    let p02 = (await holen(`/chef/social/post/${id02}`)).json.post;
    r = await importieren(l02, { id: "pruef294-02", caption: l02.caption + "\nNoch ein Satz." , dateien: [] });
    ok("Re-Import geänderter Inhalt nach Freigabe: neue_version, zur_freigabe, vorher freigegeben", r.json?.ergebnis === "neue_version" && r.json?.status === "zur_freigabe" && r.json?.vorher_status === "freigegeben", r.json);
    p02 = (await holen(`/chef/social/post/${id02}`)).json.post;
    ok("Freigabe nach neuer Fassung geleert, Fassung 3", p02.freigabe === null && p02.fassung === 3 && p02.status === "zur_freigabe");
    r = await aktion(id02, "verschieben", { version: p02.version, datum: "2026-10-21", zeit: "19:30" });
    ok("Verschieben: 200, neuer Termin", r.status === 200 && r.json?.post?.plan_datum === "2026-10-21" && r.json?.post?.plan_zeit === "19:30" && !!r.json?.post?.plan_zeitpunkt, r.json);
    ok("plan_zeitpunkt in Berliner Zeit (19:30 MESZ = 17:30Z)", r.json?.post?.plan_zeitpunkt === "2026-10-21T17:30:00.000Z", r.json?.post?.plan_zeitpunkt);
    r = await aktion(id02, "verschieben", { version: r.json.post.version, datum: "2026-13-01", zeit: null });
    ok("ungültiges Datum: 400", r.status === 400);
    r = await importieren(l02, { id: "pruef294-02", caption: l02.caption + "\nNoch ein Satz.", dateien: [] });
    p02 = (await holen(`/chef/social/post/${id02}`)).json.post;
    ok("gleicher Import nach Verschieben: unveraendert, Termin bleibt 21.10.", r.json?.ergebnis === "unveraendert" && p02.plan_datum === "2026-10-21", { r: r.json, plan: p02.plan_datum });
    r = await aktion(id02, "zurueck", { version: p02.version, notiz: "" });
    ok("Zurück an Claude ohne Notiz: 400", r.status === 400 && r.json?.code === "GRUND_FEHLT");
    r = await aktion(id02, "zurueck", { version: p02.version, notiz: "Folie 3 bitte ohne Fachwort, sonst gut." });
    ok("Zurück an Claude: entwurf, Notiz am Post", r.status === 200 && r.json?.post?.status === "entwurf" && /Fachwort/.test(r.json?.post?.zurueck_notiz ?? ""), r.json);
    p02 = r.json.post;
    r = await aktion(id02, "ki-haken", { version: p02.version, noetig: true, grund: "Hintergrund aus Higgsfield" });
    ok("KI-Kennzeichnung ändern: 200, im Studio bearbeitet", r.status === 200 && r.json?.post?.ki_noetig === true && r.json?.post?.im_studio_bearbeitet === true, r.json);
    p02 = r.json.post;
    r = await importieren(l02, { id: "pruef294-02", caption: l02.caption + "\nÜberarbeitet.", dateien: [] });
    ok("Claude liefert neue Fassung nach „zurück“: neue_version + konflikt (Studio-Bearbeitung)", r.json?.ergebnis === "neue_version" && r.json?.konflikt === true && r.json?.status === "zur_freigabe", r.json);
    p02 = (await holen(`/chef/social/post/${id02}`)).json.post;
    ok("Re-Import mit ki.noetig=false nach Studio „nötig“: bleibt nötig (ODER)", l02.meta.ki_kennzeichnung?.noetig === false && p02.ki_noetig === true && p02.ki_grund === "Hintergrund aus Higgsfield", { m: l02.meta.ki_kennzeichnung, ki: p02.ki_noetig, g: p02.ki_grund });
    ok("… eigene Verlaufszeile ki_konflikt", p02.verlauf.some((v: any) => v.art === "ki_konflikt"));
    // Freigabe → KI-Pflicht senken → Melden muss scheitern (Prüfung 06.10.2026)
    r = await aktion(id02, "freigeben", { version: p02.version });
    ok("02 freigegeben (GF)", r.status === 200 && r.json?.post?.status === "freigegeben", r.json);
    p02 = r.json.post;
    r = await aktion(id02, "ki-haken", { version: p02.version, noetig: false, grund: "egal, weg damit" });
    ok("freigegeben → KI senken als GF: 403", r.status === 403 && r.json?.code === "NUR_INHABER", r.json);
    r = await aktion(id02, "ki-haken", { version: p02.version, noetig: false, grund: "kurz" }, "inhaber");
    ok("KI senken als Inhaber mit zu kurzem Grund: 400", r.status === 400 && r.json?.code === "GRUND_FEHLT", r.json);
    r = await aktion(id02, "ki-haken", { version: p02.version, noetig: false, grund: "Echte Fotos, Text von Hand gesetzt." }, "inhaber");
    ok("KI senken als Inhaber (Manifest sagt nicht nötig): 200, Freigabe fällt → zur_freigabe", r.status === 200 && r.json?.post?.ki_noetig === false && r.json?.post?.status === "zur_freigabe" && r.json?.post?.freigabe === null, r.json?.post && { s: r.json.post.status, f: r.json.post.freigabe });
    p02 = r.json.post;
    r = await aktion(id02, "veroeffentlicht", { version: p02.version, meldungen: [{ kanal: "instagram", permalink: "https://www.instagram.com/p/PRUEF02/" }] });
    ok("… danach „als veröffentlicht melden“: 409 (erst neu freigeben)", r.status === 409 && r.json?.code === "UEBERGANG_UNZULAESSIG", r.json);
    p02 = (await holen(`/chef/social/post/${id02}`)).json.post;
    r = await aktion(id02, "verwerfen", { version: p02.version, grund: "zu" });
    ok("Verwerfen ohne Grund: 400", r.status === 400);
    r = await aktion(id02, "verwerfen", { version: p02.version, grund: "Thema doppelt mit Woche 1." });
    ok("Verwerfen mit Grund: verworfen", r.status === 200 && r.json?.post?.status === "verworfen" && r.json?.post?.erlaubte_aktionen?.length === 0, r.json);
    r = await importieren(l02, { id: "pruef294-02", caption: l02.caption + "\nNach dem Verwerfen.", dateien: [] });
    ok("Re-Import eines verworfenen Posts: 409 VERWORFEN", r.status === 409 && r.json?.code === "VERWORFEN", r.json);
    const neuText03 = l03.caption.replace("garantieren wir, sonst", "garantieren wir — sonst");
    r = await importieren(l03, { id: "pruef294-03", caption: neuText03, dateien: [] });
    ok("Re-Import eines veröffentlichten Posts mit neuem Text: 409 BEREITS_VEROEFFENTLICHT", r.status === 409 && r.json?.code === "BEREITS_VEROEFFENTLICHT", r.json);
    r = await importieren(l03, { id: "pruef294-03", caption: neuText03, dateien: [], probe: true });
    ok("… auch als Probe 409", r.status === 409 && r.json?.code === "BEREITS_VEROEFFENTLICHT", r.json);
    p03 = (await holen(`/chef/social/post/${id03}`)).json.post;
    ok("veröffentlichter Stand bleibt: Status und Link unverändert", p03.status === "veroeffentlicht" && p03.veroeffentlicht?.instagram?.permalink === "https://www.instagram.com/p/PRUEF294/" && p03.fassung === 1);
    r = await importieren(l03, { id: "pruef294-03b", caption: neuText03, dateien: [] });
    ok("neue id mit Gedankenstrich: Wort-Check grün mit Ausnahmen", r.status === 201 && r.json?.wortcheck?.ergebnis === "gruen_mit_ausnahmen", r.json?.wortcheck);

    // ═══ 8. Dateien ═══════════════════════════════════════════════════════
    abschnitt("8. Dateien ausliefern (Range, ETag, Download, ZIP)");
    r = await importieren(l01, { id: "pruef294-01", dateien: [] });
    const id01 = Number(r.json?.id);
    const p01 = (await holen(`/chef/social/post/${id01}`)).json.post;
    const video = p01.dateien.find((d: any) => d.rolle === "video");
    r = await holen(`/chef/social/datei/${video.id}`);
    ok("Video ganz: 200, Länge stimmt, sha256 stimmt", r.status === 200 && r.roh?.length === video.bytes && createHash("sha256").update(r.roh!).digest("hex") === video.sha256);
    ok("Video: Accept-Ranges, ETag, private no-cache, CSP sandbox", r.kopf.get("accept-ranges") === "bytes" && r.kopf.get("etag") === `"${video.sha256}"` && r.kopf.get("cache-control") === "private, no-cache" && /^sandbox/.test(r.kopf.get("content-security-policy") || ""), { cc: r.kopf.get("cache-control"), csp: r.kopf.get("content-security-policy") });
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { range: "bytes=0-41943039" } });
    ok("ausdrückliche große Spanne: auf 8 MB gekürzt, Content-Range ehrlich", r.status === 206 && (r.roh?.length ?? 0) === Math.min(video.bytes, 8 * 1024 * 1024) && r.kopf.get("content-range") === `bytes 0-${Math.min(video.bytes, 8 * 1024 * 1024) - 1}/${video.bytes}`, { s: r.status, n: r.roh?.length, cr: r.kopf.get("content-range") });
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { range: "bytes=0-1,5-6" } });
    ok("mehrteiliger Range-Kopf: ignoriert → 200 ganz", r.status === 200 && r.roh?.length === video.bytes, r.status);
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { range: "zeilen=1-2" } });
    ok("kaputter Range-Kopf: ignoriert → 200", r.status === 200, r.status);
    r = await holen(`/chef/social/datei/99999999999`);
    ok("Datei-id jenseits von INTEGER: 400 statt 500", r.status === 400, r.status);
    r = await holen(`/chef/social/post/99999999999`);
    ok("Post-id jenseits von INTEGER: 400 statt 500", r.status === 400, r.status);
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { range: "bytes=0-1" } });
    ok("Range bytes=0-1: 206, 2 Bytes, Content-Range", r.status === 206 && r.roh?.length === 2 && r.kopf.get("content-range") === `bytes 0-1/${video.bytes}`, { s: r.status, cr: r.kopf.get("content-range") });
    const ganz = fs.readFileSync(path.join(LAUNCH, ordnerVon("01"), l01.meta.dateien[0].datei));
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { range: "bytes=1000000-1000099" } });
    ok("Range mitten im Video: Bytes identisch mit der Datei", r.status === 206 && Buffer.compare(r.roh!, ganz.subarray(1000000, 1000100)) === 0);
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { range: "bytes=-100" } });
    ok("Range Ende (bytes=-100): letzte 100 Bytes", r.status === 206 && Buffer.compare(r.roh!, ganz.subarray(ganz.length - 100)) === 0);
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { range: `bytes=${video.bytes + 5}-` } });
    ok("Range hinter dem Ende: 416", r.status === 416);
    r = await holen(`/chef/social/datei/${video.id}`, { headers: { "if-none-match": `"${video.sha256}"` } });
    ok("If-None-Match: 304", r.status === 304);
    r = await holen(`/chef/social/datei/${video.id}?download=1`, { method: "HEAD" });
    ok("Download: attachment mit „…_Reel.mp4“", /attachment/.test(r.kopf.get("content-disposition") || "") && /pruef294-01_Reel\.mp4/.test(r.kopf.get("content-disposition") || ""), r.kopf.get("content-disposition"));
    r = await holen(`/chef/social/datei/${video.id}`, { stufe: null });
    ok("Datei ohne Sitzung: 401", r.status === 401);
    r = await holen(`/chef/social/post/${id01}/zip`);
    ok("ZIP: 200, application/zip, beginnt mit PK", r.status === 200 && /zip/.test(r.kopf.get("content-type") || "") && r.roh?.subarray(0, 2).toString() === "PK" && (r.roh?.length ?? 0) > video.bytes);
    const summe01 = p01.dateien.reduce((n: number, d: any) => n + d.bytes, 0);
    let eintraege = 0;
    for (let i = r.roh!.indexOf("PK\x01\x02", 0, "latin1"); i >= 0; i = r.roh!.indexOf("PK\x01\x02", i + 4, "latin1")) eintraege++;
    ok("ZIP (gestreamt): alle Dateien vollständig drin", eintraege === p01.dateien.length && (r.roh?.length ?? 0) >= summe01, { eintraege, n: p01.dateien.length, len: r.roh?.length, summe01 });

    // ═══ 9. Instagram-Vorschau ════════════════════════════════════════════
    abschnitt("9. Instagram-Vorschau");
    r = await holen(`/chef/social/vorschau/instagram?tage=30&marke=fiaon`);
    ok("Vorschau: 200, Profil, Kacheln", r.status === 200 && r.json?.profil?.handle === "@fiaon.ltd" && Array.isArray(r.json?.kacheln), r.json?.error);
    const k = r.json?.kacheln ?? [];
    const sortiert = k.every((x: any, i: number) => i === 0 || `${k[i - 1].plan_datum}` >= `${x.plan_datum}`);
    ok("Kacheln neueste zuerst", sortiert);
    const reelK = k.find((x: any) => x.post_id === id01);
    ok("Reel-Kachel: Symbol reel, Titelbild 9:16 → 3:4 (12,5 %)", reelK?.symbol === "reel" && reelK?.zuschnitt?.y === 12.5, reelK);
    const kar = k.find((x: any) => x.symbol === "karussell" && x.bild?.hoehe === 1350);
    ok("Karussell-Kachel 4:5 → 3:4 (x 3,13 %)", kar?.zuschnitt?.x === 3.13, kar);
    ok("geplante Posts als geplant markiert", k.some((x: any) => x.geplant === true));
    ok("marke=fiaon: Global-Posts nicht im Raster", !k.some((x: any) => x.post_id === id03));
    const ra = await holen(`/chef/social/vorschau/instagram?tage=30`);
    ok("Vorgabe „alle“: ein Raster mit FIAON und Global (Launch 1→10)", ra.json?.marke === "alle" && ra.json?.kacheln?.some((x: any) => x.post_id === id03) && ra.json?.kacheln?.some((x: any) => x.post_id === id01) && ra.json?.profil?.handle === "@fiaon.ltd", ra.json?.marke);
    const r0 = await holen(`/chef/social/vorschau/instagram?tage=0&marke=fiaon`);
    ok("Zeitregler: heute ≤ 30 Tage", (r0.json?.kacheln?.length ?? 0) <= k.length && r0.json?.tage === 0);
    const rg = await holen(`/chef/social/vorschau/instagram?tage=7&marke=global`);
    ok("Global-Raster enthält 03", rg.json?.marke === "global" && rg.json?.kacheln?.some((x: any) => x.post_id === id03), rg.json?.kacheln?.map((x: any) => x.post_id));
    ok("„nur Global“ ist ein Filter auf @fiaon.ltd (kein eigenes Konto)", rg.json?.nur_filter === true && rg.json?.profil?.handle === "@fiaon.ltd", { f: rg.json?.nur_filter, h: rg.json?.profil?.handle });
    ok("Vorgabe „alle“: kein Filter", ra.json?.nur_filter === false);

    // ═══ 10. Prüfung 06.10.2026 ═══════════════════════════════════════════
    abschnitt("10. Prüfung 06.10.2026: Zähler, Heute, bei Claude, Gesamtgrenze, Fehlversuche");
    r = await holen(`/chef/social/zaehler`);
    ok("GET /chef/social/zaehler: nur Zähler", r.status === 200 && typeof r.json?.zaehler?.zur_freigabe === "number" && !("posts" in (r.json ?? {})), r.json);
    r = await holen(`/chef/social/zaehler`, { stufe: "leitung" });
    ok("Zähler als Leitung: 403", r.status === 403);
    r = await holen(`/chef/social/plan?von=2027-03-01&bis=2027-03-07`);
    ok("Plan eines fernen Zeitraums: heute_posts trotzdem da (Array)", r.status === 200 && Array.isArray(r.json?.heute_posts) && Array.isArray(r.json?.bei_claude), r.json?.error);
    const heuteIso = r.json?.heute;
    ok("heute_posts sind alle von heute", (r.json?.heute_posts ?? []).every((x: any) => x.plan_datum === heuteIso));
    // bei_claude: ein Post im Entwurf mit Notiz
    r = await importieren(l01, { id: "pruef294-01z", dateien: [] });
    const id01z = Number(r.json?.id);
    let p01z = (await holen(`/chef/social/post/${id01z}`)).json.post;
    r = await aktion(id01z, "zurueck", { version: p01z.version, notiz: "Bitte Untertitel größer machen." });
    r = await holen(`/chef/social/plan`);
    ok("bei_claude listet den zurückgegebenen Post mit Notiz", (r.json?.bei_claude ?? []).some((x: any) => x.id === id01z && /Untertitel/.test(x.notiz)), r.json?.bei_claude);
    // Gesamtgrenze je Import
    const gross = Buffer.alloc(35 * 1024 * 1024, 1);
    const viel = [0, 1, 2, 3].map((i) => ({ name: `gross-${i}.jpg`, inhalt: gross }));
    let r413: any = null;
    try { r413 = await importieren(l02, { id: "pruef294-gross", dateien: viel }); } catch (e: any) { r413 = { status: "abgebrochen", fehler: String(e?.message ?? e) }; }
    ok(`Import über ${IMPORT_MAX_GESAMT_BYTES / 1024 / 1024} MB gesamt: 413 ZU_GROSS`, r413?.status === 413 && r413?.json?.code === "ZU_GROSS", r413?.json ?? r413);
    // ═══ 11. Website-Feed (E-296) ═════════════════════════════════════════
    abschnitt("11. Website-Feed: Aktion „website“, öffentlicher Feed, Bild-Route, Web-Bilder 480 px");
    {
      const { sozialFeedLeeren } = await import("../server/lib/fiaon-sozial-feed");
      const { berlinToday, berlinPlusTage } = await import("../server/lib/fiaon-time");
      const heute = berlinToday();
      const morgen = berlinPlusTage(1);
      const THEMA = "pruef296";
      const feedPfad = SOZIAL_FEED_PFAD.replace(/^\/api\/fiaon/, "");
      const feed = async (q = "") => (await holen(`${feedPfad}${q ? `?${q}` : ""}`, { stufe: null }));
      const feedIds = async (q = `thema=${THEMA}&n=12`) => ((await feed(q)).json?.posts ?? []).map((p: any) => p.id) as number[];
      const bildPfad = (id: number) => sozialBildPfad(id).replace(/^\/api\/fiaon/, "");
      const detail = async (id: number) => (await holen(`/chef/social/post/${id}`)).json?.post;
      const mitThema = (l: ReturnType<typeof launch>) => ({ ...l.meta, themen: [...(l.meta.themen ?? []), THEMA] });

      const vorher = await feed("marke=alle&n=12");
      ok("Feed öffentlich ohne Anmeldung: 200, Profile, Cache-Control public 300 s", vorher.status === 200 && Array.isArray(vorher.json?.profile) && vorher.json.profile.length === 2 && vorher.kopf.get("cache-control") === "public, max-age=300", { s: vorher.status, cc: vorher.kopf.get("cache-control") });
      const anzahlVorher = Number(vorher.json?.anzahl ?? 0);
      const anzahlFiaonVorher = Number((await feed("marke=fiaon")).json?.anzahl ?? 0);

      // Drei Posts: Karussell (FIAON), Reel (FIAON, KI), Bild (Global) — alle mit Thema „pruef296“.
      const l07 = launch("07");
      let r = await importieren(l02, { id: "pruef296-k", meta: mitThema(l02), dateien: [] });
      const idK = Number(r.json?.id);
      r = await importieren(l01, { id: "pruef296-r", meta: mitThema(l01), dateien: [] });
      const idR = Number(r.json?.id);
      r = await importieren(l07, { id: "pruef296-g", meta: mitThema(l07), dateien: [] });
      const idG = Number(r.json?.id);
      ok("drei Testposts eingespielt", idK > 0 && idR > 0 && idG > 0, { idK, idR, idG });

      let pK = await detail(idK);
      ok("Detail: website.sichtbar aus, darf_an nein (zur Freigabe), Web-Bilder 0/7", pK?.website?.sichtbar === false && pK?.website?.darf_an === false && pK?.website?.bilder === 7 && pK?.website?.web_480 === 0, pK?.website);
      r = await aktion(idK, "website", { version: pK.version, sichtbar: true });
      ok("„website“ an im Status zur_freigabe: 409", r.status === 409 && r.json?.code === "UEBERGANG_UNZULAESSIG", r.json);
      r = await aktion(idK, "freigeben", { version: pK.version });
      pK = r.json?.post;
      ok("Karussell freigegeben → Aktion „website“ angeboten, darf_an ja", pK?.erlaubte_aktionen?.includes("website") && pK?.website?.darf_an === true, pK?.website);
      ok("… aber noch nicht im Feed (Schalter aus)", !(await feedIds()).includes(idK));
      r = await aktion(idK, "website", { version: pK.version - 1, sichtbar: true });
      ok("„website“ mit alter Version: 409 VERSION_VERALTET", r.status === 409 && r.json?.code === "VERSION_VERALTET", r.json);
      r = await aktion(idK, "website", { version: pK.version, sichtbar: true }, "leitung");
      ok("„website“ als Leitung: 403", r.status === 403, r.json);
      r = await aktion(idK, "website", { version: pK.version, sichtbar: "ja" });
      ok("„website“ ohne an/aus (kein boolean): 400", r.status === 400 && r.json?.code === "UNGUELTIG", r.json);
      r = await aktion(idK, "website", { version: pK.version, sichtbar: true });
      ok("„website“ an (GF, freigegeben): 200, version+1, VORGEMERKT — Grund „instagram“, steht nicht", r.status === 200 && r.json?.post?.version === pK.version + 1 && r.json?.post?.website?.jetzt === false && r.json?.post?.website?.grund === "instagram" && r.json?.post?.website_sichtbar === true && /Vorgemerkt/.test(r.json?.meldung ?? ""), { w: r.json?.post?.website, m: r.json?.meldung });
      pK = r.json?.post;
      ok("Verlauf: Zeile „website“ mit vorher aus, nachher an", pK?.verlauf?.some((v: any) => v.art === "website" && v.vorher?.website_sichtbar === false && v.nachher?.website_sichtbar === true));
      const prot296 = (await sqlPool`SELECT notiz FROM fiaon_admin_log WHERE ziel = ${"social:" + idK} AND notiz LIKE 'website:%' ORDER BY id DESC LIMIT 1`) as any[];
      ok("chefProtokoll: „website: false→true“", /website: false→true/.test(prot296[0]?.notiz ?? ""), prot296[0]);
      r = await aktion(idK, "website", { version: pK.version, sichtbar: true });
      ok("noch einmal an: 200, keine neue version", r.status === 200 && r.json?.post?.version === pK.version, r.json?.meldung);
      const folien = [...pK.dateien].filter((x: any) => x.rolle === "bild").sort((a: any, b: any) => a.pos - b.pos);
      const erste = folien[0];
      ok("Prüfung 06.10.: freigegeben + Schalter an, aber nicht auf Instagram gemeldet → nicht im Feed", !(await feedIds()).includes(idK));
      let b = await holen(bildPfad(erste.id), { stufe: null });
      ok("… und sein Bild: 404, no-store, JSON, nicht der ETag des Bildes", b.status === 404 && b.kopf.get("cache-control") === "no-store" && !(b.kopf.get("etag") ?? "").includes(erste.sha256) && (b.kopf.get("content-type") ?? "").includes("json"), { s: b.status, cc: b.kopf.get("cache-control"), e: b.kopf.get("etag") });

      // Neue Fassung: Schalter aus (der Schalter galt dem alten Inhalt)
      r = await importieren(l02, { id: "pruef296-k", meta: mitThema(l02), caption: l02.caption + "\nNeue Fassung für den Prüfstand.", dateien: [] });
      ok("neue Fassung: Hinweis „Auf der Website zeigen“ aus", r.json?.ergebnis === "neue_version" && (r.json?.hinweise ?? []).some((x: string) => /Website/.test(x)), r.json?.hinweise);
      pK = await detail(idK);
      ok("… Schalter aus, Post zur Freigabe, nicht im Feed", pK?.website_sichtbar === false && pK?.status === "zur_freigabe" && !(await feedIds()).includes(idK), { w: pK?.website_sichtbar, s: pK?.status });
      r = await aktion(idK, "freigeben", { version: pK.version });
      pK = r.json?.post;
      r = await aktion(idK, "website", { version: pK.version, sichtbar: true });
      pK = r.json?.post;
      ok("neue Fassung freigegeben und vorgemerkt", r.status === 200 && pK?.website_sichtbar === true && pK?.website?.grund === "instagram", pK?.website);

      // Plantag: morgen → auch nach der Instagram-Meldung nicht vor dem Tag
      r = await aktion(idK, "verschieben", { version: pK.version, datum: morgen, zeit: null });
      pK = r.json?.post;
      r = await aktion(idK, "veroeffentlicht", { version: pK.version, meldungen: [{ kanal: "instagram", permalink: "https://www.instagram.com/p/PRUEF296K/" }] });
      pK = r.json?.post;
      ok("auf Instagram gemeldet, Plantag morgen: website.grund „plantag“", r.status === 200 && pK?.status === "veroeffentlicht" && pK?.website?.grund === "plantag" && pK?.website_jetzt === false, { s: r.status, w: pK?.website, e: r.json?.error });
      ok("… nicht im Feed (nie vor dem Plantag)", !(await feedIds()).includes(idK));
      b = await holen(bildPfad(erste.id), { stufe: null });
      ok("… Bild vor dem Plantag: 404", b.status === 404 && b.kopf.get("cache-control") === "no-store", b.status);
      // Veröffentlichtes lässt sich nicht verschieben — der Prüfstand setzt den Tag direkt zurück.
      await sqlPool`UPDATE fiaon_social_posts SET plan_datum = ${heute}::date, plan_zeit = NULL, plan_zeitpunkt = NULL WHERE id = ${idK}`;
      sozialFeedLeeren();
      pK = await detail(idK);

      let f = await feed(`thema=${THEMA}&n=12`);
      const fk = (f.json?.posts ?? []).find((p: any) => p.id === idK);
      ok("Plantag heute + Instagram gemeldet: Karussell im Feed, anzahl +1", !!fk && Number(f.json?.anzahl) === anzahlVorher + 1, { ids: (f.json?.posts ?? []).map((p: any) => p.id), anzahl: f.json?.anzahl, anzahlVorher });
      ok("Feed-Post: 7 Bilder in Folien-Reihenfolge, gross = Original, klein = Original (noch kein Web-Bild)", fk?.bilder?.length === 7 && fk.bilder.every((b: any, i: number) => b.gross.url === sozialBildPfad(folien[i].id) && b.klein.url === b.gross.url && b.gross.breite === 1080 && b.gross.hoehe === 1350), fk?.bilder?.[0]);
      ok("Feed-Post: Text ohne „#“, ≤ 280 Zeichen; Hashtags ≤ 5 ohne „#“", !!fk && !fk.text.includes("#") && Array.from(fk.text as string).length <= FEED_TEXT_MAX && fk.hashtags.length <= FEED_HASHTAGS_MAX && fk.hashtags.every((x: string) => !x.startsWith("#")), { text: fk?.text, h: fk?.hashtags });
      ok("Feed-Post: Form laut Vertrag (Format, Marke, Datum, Alt, ki, Instagram-Link, Themen)", fk?.format === "karussell" && fk?.marke === "fiaon" && fk?.datum === heute && typeof fk?.alt === "string" && fk.alt.length > 0 && fk?.ki === false && fk?.links?.instagram === "https://www.instagram.com/p/PRUEF296K/" && fk?.themen?.includes(THEMA), fk && { format: fk.format, marke: fk.marke, datum: fk.datum, ki: fk.ki, links: fk.links });
      ok("Feed-Post: keine internen Felder (Caption, Status, Version, Dateinamen)", !!fk && !("caption" in fk) && !("status" in fk) && !("version" in fk) && !JSON.stringify(fk).includes("FIAON_02_SCHUFA"), fk && Object.keys(fk));
      const plan296 = (await holen(`/chef/social/plan?von=${heute}&bis=${heute}`)).json;
      const karteK = plan296?.posts?.find((x: any) => x.id === idK);
      ok("Plan-Karte: website_sichtbar und website_jetzt (Marke „Web“)", karteK?.website_sichtbar === true && karteK?.website_jetzt === true, karteK && { s: karteK.website_sichtbar, j: karteK.website_jetzt });

      // Bild-Route
      b = await holen(bildPfad(erste.id), { stufe: null });
      ok("Bild sichtbarer Post: 200 ohne Anmeldung, JPEG, Bytes = Original", b.status === 200 && b.kopf.get("content-type") === "image/jpeg" && createHash("sha256").update(b.roh ?? Buffer.alloc(0)).digest("hex") === erste.sha256, { s: b.status, t: b.kopf.get("content-type") });
      ok("Bild: ETag = sha256, public max-age 86400, nosniff, CORP same-site", b.kopf.get("etag") === `"${erste.sha256}"` && b.kopf.get("cache-control") === "public, max-age=86400" && b.kopf.get("x-content-type-options") === "nosniff" && b.kopf.get("cross-origin-resource-policy") === "same-site", { e: b.kopf.get("etag"), cc: b.kopf.get("cache-control") });
      b = await holen(bildPfad(erste.id), { stufe: null, headers: { "if-none-match": `"${erste.sha256}"` } });
      ok("Bild: If-None-Match → 304", b.status === 304, b.status);
      b = await holen(bildPfad(erste.id), { stufe: null, method: "HEAD" });
      ok("Bild: HEAD 200 mit Content-Length", b.status === 200 && Number(b.kopf.get("content-length")) === erste.bytes, b.kopf.get("content-length"));
      b = await holen(`/social/bild/abc`, { stufe: null });
      ok("Bild mit unsinniger id: 404", b.status === 404, b.status);

      // Prüfung 06.10.: Ein Titelbild NEBEN Folien steht nirgends auf der Website — also auch nicht über die Bild-Route.
      const letzte = folien[folien.length - 1];
      await sqlPool`UPDATE fiaon_social_dateien SET rolle = 'cover' WHERE id = ${letzte.id}`;
      await sqlPool`UPDATE fiaon_social_posts SET dateien = (SELECT jsonb_agg(CASE WHEN (x->>'datei_id')::bigint = ${letzte.id} THEN jsonb_set(x, '{rolle}', '"cover"') ELSE x END) FROM jsonb_array_elements(dateien) x) WHERE id = ${idK}`;
      sozialFeedLeeren();
      b = await holen(bildPfad(letzte.id), { stufe: null });
      const fkCover = ((await feed(`thema=${THEMA}&n=12`)).json?.posts ?? []).find((p: any) => p.id === idK);
      ok("Karussell mit Titelbild: Feed zeigt nur die Folien, Bild-Route liefert das Titelbild NICHT (404)", b.status === 404 && fkCover?.bilder?.length === 6, { s: b.status, n: fkCover?.bilder?.length });
      await sqlPool`UPDATE fiaon_social_dateien SET rolle = 'bild' WHERE id = ${letzte.id}`;
      await sqlPool`UPDATE fiaon_social_posts SET dateien = (SELECT jsonb_agg(CASE WHEN (x->>'datei_id')::bigint = ${letzte.id} THEN jsonb_set(x, '{rolle}', '"bild"') ELSE x END) FROM jsonb_array_elements(dateien) x) WHERE id = ${idK}`;
      sozialFeedLeeren();
      ok("… zurückgesetzt: wieder 7 Folien, Bild 200", (await holen(bildPfad(letzte.id), { stufe: null })).status === 200);

      // Prüfung 06.10.: Wort-Check beim AUSLIEFERN nach den aktuellen Regeln (nicht nur beim Einschalten).
      const rotSatz = " Ihr Erfolg ist garantiert.";
      ok("(Vorbedingung) „… ist garantiert.“ ist bei Marke fiaon rot", socialWortcheck({ marke: "fiaon", caption: `Hallo.${rotSatz}` }).ergebnis === "rot");
      await sqlPool`UPDATE fiaon_social_posts SET caption = caption || ${rotSatz} WHERE id = ${idK}`;
      sozialFeedLeeren();
      b = await holen(bildPfad(erste.id), { stufe: null });
      ok("Caption nach dem Einschalten rot geworden: nicht im Feed, Bild 404", !(await feedIds()).includes(idK) && b.status === 404, b.status);
      await sqlPool`UPDATE fiaon_social_posts SET caption = left(caption, length(caption) - ${rotSatz.length}) WHERE id = ${idK}`;
      sozialFeedLeeren();
      ok("… Caption zurück: wieder im Feed", (await feedIds()).includes(idK));

      // Reel: „als veröffentlicht melden“ schaltet beim ersten Melden mit ein
      let pR = await detail(idR);
      r = await aktion(idR, "freigeben", { version: pR.version });
      pR = r.json?.post;
      r = await aktion(idR, "checkliste", { version: pR.version, kanal: "instagram", punkt: "ki_info", erledigt: true });
      pR = r.json?.post;
      ok("Reel freigegeben, Schalter noch aus", pR?.status === "freigegeben" && pR?.website_sichtbar === false);
      r = await aktion(idR, "veroeffentlicht", { version: pR.version, meldungen: [{ kanal: "instagram", permalink: "https://www.instagram.com/reel/PRUEF296/" }] });
      pR = r.json?.post;
      ok("als veröffentlicht gemeldet → Schalter an, Meldung sagt „Website“", r.status === 200 && pR?.website_sichtbar === true && /Website/.test(r.json?.meldung ?? ""), { s: r.status, m: r.json?.meldung });
      f = await feed(`thema=${THEMA}&n=12`);
      const fr = (f.json?.posts ?? []).find((p: any) => p.id === idR);
      const cover = pR.dateien.find((x: any) => x.rolle === "cover");
      const video = pR.dateien.find((x: any) => x.rolle === "video");
      ok("Feed: Reel mit genau dem Titelbild, ki=true, Instagram-Link", fr?.format === "reel" && fr?.bilder?.length === 1 && fr.bilder[0].gross.url === sozialBildPfad(cover.id) && fr?.ki === true && fr?.links?.instagram === "https://www.instagram.com/reel/PRUEF296/", fr && { b: fr.bilder, ki: fr.ki, l: fr.links });
      b = await holen(bildPfad(video.id), { stufe: null });
      ok("Bild-Route: Video eines sichtbaren Posts → 404 (falsche Rolle/kein Bild)", b.status === 404, b.status);
      b = await holen(bildPfad(cover.id), { stufe: null });
      ok("Bild-Route: Titelbild des Reels → 200", b.status === 200, b.status);
      r = await aktion(idR, "website", { version: pR.version, sichtbar: false });
      pR = r.json?.post;
      ok("Reel: Schalter aus → nicht im Feed", r.status === 200 && pR?.website_sichtbar === false && !(await feedIds()).includes(idR));
      r = await aktion(idR, "checkliste", { version: pR.version, kanal: "facebook", punkt: "ki_info", erledigt: true });
      pR = r.json?.post;
      r = await aktion(idR, "veroeffentlicht", { version: pR.version, meldungen: [{ kanal: "facebook", permalink: "https://www.facebook.com/fiaon/posts/296" }] });
      pR = r.json?.post;
      ok("weiteren Kanal melden schaltet NICHT wieder ein (Justins Aus bleibt)", r.status === 200 && pR?.website_sichtbar === false, { s: r.status, w: pR?.website_sichtbar });
      r = await aktion(idR, "website", { version: pR.version, sichtbar: true });
      pR = r.json?.post;
      ok("Reel wieder an (veröffentlicht): 200", r.status === 200 && pR?.website_jetzt === true, r.json?.error);

      // Global-Bild: bewusst AUS vor der ersten Meldung bleibt aus (Prüfung 06.10.2026)
      let pG = await detail(idG);
      r = await aktion(idG, "freigeben", { version: pG.version });
      pG = r.json?.post;
      r = await aktion(idG, "website", { version: pG.version, sichtbar: true });
      pG = r.json?.post;
      r = await aktion(idG, "website", { version: pG.version, sichtbar: false });
      pG = r.json?.post;
      ok("Global-Bild freigegeben, an und wieder aus", r.status === 200 && pG?.website_sichtbar === false, r.json?.error);
      r = await aktion(idG, "veroeffentlicht", { version: pG.version, meldungen: [{ kanal: "instagram", permalink: "https://www.instagram.com/p/PRUEF296G/" }] });
      pG = r.json?.post;
      ok("erste Meldung nach bewusstem Aus: Schalter bleibt AUS, nicht im Feed", r.status === 200 && pG?.status === "veroeffentlicht" && pG?.website_sichtbar === false && !(await feedIds()).includes(idG), { s: r.status, w: pG?.website_sichtbar, e: r.json?.error });
      r = await aktion(idG, "website", { version: pG.version, sichtbar: true });
      pG = r.json?.post;
      ok("Global-Bild von Hand an: steht jetzt", r.status === 200 && pG?.website_jetzt === true && /Steht jetzt/.test(r.json?.meldung ?? ""), { e: r.json?.error, m: r.json?.meldung });

      // Reihenfolge und Thema
      sozialFeedLeeren();
      const reihe = await feedIds();
      ok("Reihenfolge: neueste Instagram-Meldung zuerst (Global, Reel, Karussell)", reihe.indexOf(idG) === 0 && reihe.indexOf(idR) === 1 && reihe.indexOf(idK) === 2, reihe.slice(0, 5));
      const nurFiaon = await feed(`marke=fiaon&thema=${THEMA}&n=12`);
      ok("marke=fiaon: Global-Post nicht drin, anzahl zählt nur FIAON", !(nurFiaon.json?.posts ?? []).some((p: any) => p.id === idG) && Number(nurFiaon.json?.anzahl) === anzahlFiaonVorher + 2 && (nurFiaon.json?.posts ?? []).every((p: any) => p.marke === "fiaon"), nurFiaon.json?.anzahl);
      const nurGlobal = await feed(`marke=global&thema=${THEMA}`);
      ok("marke=global: nur Global", (nurGlobal.json?.posts ?? []).some((p: any) => p.id === idG) && (nurGlobal.json?.posts ?? []).every((p: any) => p.marke === "global"));
      const dsgvo = (await feed("thema=dsgvo&n=12")).json?.posts ?? [];
      const erstOhne = dsgvo.findIndex((p: any) => !p.themen.includes("dsgvo"));
      ok("thema=dsgvo: passende zuerst", dsgvo.some((p: any) => p.id === idK) && (erstOhne === -1 || dsgvo.slice(erstOhne).every((p: any) => !p.themen.includes("dsgvo"))), dsgvo.map((p: any) => [p.id, p.themen.includes("dsgvo")]));
      ok("n=1 liefert einen Post, anzahl bleibt die Gesamtzahl", ((await feed("n=1")).json?.posts ?? []).length === 1 && Number((await feed("n=1")).json?.anzahl) >= 3);
      ok("unsinnige Anfrage (n=-5, marke=xx, thema=../..): 200 statt Fehler", (await feed("n=-5&marke=xx&thema=../..")).status === 200);

      // Ohne Bild: nie auf der Website
      const nurVideo = { ...mitThema(l01), dateien: l01.meta.dateien.filter((x: any) => x.rolle === "video") };
      r = await importieren(l01, { id: "pruef296-n", meta: nurVideo, dateien: [] });
      const idN = Number(r.json?.id);
      let pN = await detail(idN);
      r = await aktion(idN, "freigeben", { version: pN.version });
      pN = r.json?.post;
      r = await aktion(idN, "website", { version: pN.version, sichtbar: true });
      ok("Reel ohne Titelbild: „website“ an → 409 KEIN_BILD", r.status === 409 && r.json?.code === "KEIN_BILD", r.json);
      const anzahlMitte = Number((await feed()).json?.anzahl);
      await sqlPool`UPDATE fiaon_social_posts SET website_sichtbar = TRUE, status = 'veroeffentlicht', veroeffentlicht = ${sqlPool.json({ instagram: { am: new Date().toISOString(), permalink: "https://www.instagram.com/reel/PRUEF296N/", plattform_id: null, von: "Prüfstand" } } as any)} WHERE id = ${idN}`;
      sozialFeedLeeren();
      const fN = await feed(`thema=${THEMA}&n=12`);
      ok("… auch per SQL eingeschaltet und gemeldet: nicht im Feed, anzahl zählt ihn nicht", !(fN.json?.posts ?? []).some((p: any) => p.id === idN) && Number(fN.json?.anzahl) === anzahlMitte, { a: fN.json?.anzahl, anzahlMitte });
      b = await holen(bildPfad(pN.dateien[0].id), { stufe: null });
      ok("… sein Video über die Bild-Route: 404", b.status === 404);

      // Ohne Instagram als Kanal: nie auf der Website (das Handy zeigt @fiaon.ltd)
      r = await importieren(l07, { id: "pruef296-o", meta: { ...mitThema(l07), kanaele: ["facebook"] }, dateien: [] });
      const idO = Number(r.json?.id);
      let pO = await detail(idO);
      r = await aktion(idO, "freigeben", { version: pO.version });
      pO = r.json?.post;
      ok("Post nur für Facebook: darf_an nein", r.status === 200 && pO?.website?.darf_an === false && /nicht auf Instagram/.test(pO?.website?.satz ?? ""), pO?.website);
      r = await aktion(idO, "website", { version: pO.version, sichtbar: true });
      ok("… „website“ an → 409 KEIN_INSTAGRAM", r.status === 409 && r.json?.code === "KEIN_INSTAGRAM", r.json);
      await sqlPool`UPDATE fiaon_social_posts SET website_sichtbar = TRUE, status = 'veroeffentlicht', veroeffentlicht = ${sqlPool.json({ facebook: { am: new Date().toISOString(), permalink: "https://www.facebook.com/fiaon/posts/2960", plattform_id: null, von: "Prüfstand" } } as any)} WHERE id = ${idO}`;
      sozialFeedLeeren();
      b = await holen(bildPfad(pO.dateien[0].id), { stufe: null });
      ok("… per SQL an und auf Facebook gemeldet: nicht im Feed, Bild 404", !(await feedIds()).includes(idO) && b.status === 404, b.status);

      // Status: zurück an Claude → weg (eigener, nur vorgemerkter Post — Veröffentlichtes geht nicht zurück)
      r = await importieren(l07, { id: "pruef296-z", meta: mitThema(l07), dateien: [] });
      const idZ = Number(r.json?.id);
      let pZ = await detail(idZ);
      r = await aktion(idZ, "freigeben", { version: pZ.version });
      pZ = r.json?.post;
      r = await aktion(idZ, "website", { version: pZ.version, sichtbar: true });
      pZ = r.json?.post;
      r = await aktion(idZ, "zurueck", { version: pZ.version, notiz: "Prüfstand: bitte anders formulieren." });
      pZ = r.json?.post;
      ok("vorgemerkt, dann zurück an Claude: Schalter bleibt, aber Grund „status“, nicht im Feed", r.status === 200 && pZ?.website?.sichtbar === true && pZ?.website?.grund === "status" && !(await feedIds()).includes(idZ), pZ?.website);
      b = await holen(bildPfad(pZ.dateien[0].id), { stufe: null });
      ok("… Bild eines Entwurfs: 404", b.status === 404, b.status);
      ok("… im Entwurf wird „website“ nicht angeboten", !pZ?.erlaubte_aktionen?.includes("website"), pZ?.erlaubte_aktionen);
      r = await aktion(idZ, "website", { version: pZ.version, sichtbar: false });
      ok("ausschalten geht in jedem Status (auch im Entwurf)", r.status === 200 && r.json?.post?.website_sichtbar === false, r.json);
      pZ = r.json?.post;
      r = await aktion(idZ, "website", { version: pZ.version, sichtbar: true });
      ok("einschalten im Entwurf: 409", r.status === 409 && r.json?.code === "UEBERGANG_UNZULAESSIG", r.json);

      // Wort-Check rot: nicht auf die Website
      const l03w = mitKomma03(launch("03"));
      r = await importieren(l03w, { id: "pruef296-w", meta: mitThema(l03w), dateien: [] });
      const idW = Number(r.json?.id);
      let pW = await detail(idW);
      r = await aktion(idW, "freigeben", { version: pW.version, trotzdem: true, grund: "Prüfstand E-296: trotz rot freigegeben." }, "inhaber");
      pW = r.json?.post;
      ok("trotz rot freigegeben: darf_an nein", pW?.status === "freigegeben" && pW?.website?.darf_an === false, pW?.website);
      r = await aktion(idW, "website", { version: pW.version, sichtbar: true }, "inhaber");
      ok("„website“ bei rotem Wort-Check: 409 WORTCHECK_ROT (auch Inhaber)", r.status === 409 && r.json?.code === "WORTCHECK_ROT", r.json);

      // Web-Bilder 480 px
      const jpeg = (breite: number, hoehe: number, salz = Math.random().toString(36)) => Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
        Buffer.from([0xff, 0xfe, 0x00, 2 + Buffer.byteLength(salz)]), Buffer.from(salz),
        Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, hoehe >> 8, hoehe & 255, breite >> 8, breite & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]),
        Buffer.from([0xff, 0xd9]),
      ]);
      const hochladen = async (id: number, teile: { feld: string; inhalt: Buffer }[], stufe: "geschaeftsfuehrung" | "leitung" = "geschaeftsfuehrung") => {
        const fd = new FormData();
        for (const t of teile) fd.append(t.feld, new Blob([t.inhalt], { type: "image/jpeg" }), "web.jpg");
        return holen(`/chef/social/post/${id}/web-varianten`, { method: "POST", body: fd, stufe });
      };
      const f1 = folien[0], f2 = folien[1], f3 = folien[2], f4 = folien[3];
      r = await hochladen(idK, [{ feld: String(f1.id), inhalt: jpeg(480, 600) }], "leitung");
      ok("Web-Bilder als Leitung: 403", r.status === 403, r.json);
      r = await hochladen(idK, [
        { feld: String(f1.id), inhalt: jpeg(480, 600) },
        { feld: String(f2.id), inhalt: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.from([0, 0, 1, 224, 0, 0, 2, 88])]) },
        { feld: String(f3.id), inhalt: jpeg(700, 875) },
        { feld: String(f4.id), inhalt: jpeg(480, 480) },
        { feld: String(cover.id), inhalt: jpeg(480, 853) },
        { feld: String(video.id), inhalt: jpeg(480, 853) },
      ]);
      const fehlerVon = (q: number) => (r.json?.fehler ?? []).find((x: any) => x.quelle_id === q)?.error ?? "";
      ok("Web-Bilder: 200, ein JPEG 480×600 angelegt", r.status === 200 && r.json?.angelegt?.length === 1 && r.json.angelegt[0].quelle_id === f1.id, r.json);
      ok("… PNG abgelehnt (muss JPEG sein)", /JPEG/.test(fehlerVon(f2.id)), fehlerVon(f2.id));
      ok("… 700 px breit abgelehnt (höchstens 600)", /600/.test(fehlerVon(f3.id)), fehlerVon(f3.id));
      ok("… falsches Seitenverhältnis abgelehnt", /Seitenverhältnis/.test(fehlerVon(f4.id)), fehlerVon(f4.id));
      ok("… Quelle aus einem anderen Post abgelehnt", /dieses Posts/.test(fehlerVon(cover.id)), fehlerVon(cover.id));
      ok("… Video als Quelle abgelehnt", fehlerVon(video.id).length > 0, fehlerVon(video.id));
      const webId = Number(r.json?.angelegt?.[0]?.id);
      const zeile = ((await sqlPool`SELECT variante, quelle_id, post_id, rolle, pos, mime, breite FROM fiaon_social_dateien WHERE id = ${webId}`) as any[])[0];
      ok("Zeile: variante web_480, quelle_id = Original, gleiche Rolle/pos, 480 breit", zeile?.variante === "web_480" && Number(zeile?.quelle_id) === f1.id && Number(zeile?.post_id) === idK && zeile?.rolle === "bild" && Number(zeile?.pos) === f1.pos && Number(zeile?.breite) === 480, zeile);
      r = await hochladen(idK, [{ feld: String(f1.id), inhalt: jpeg(480, 600) }]);
      ok("dasselbe Original noch einmal: schon_da, nichts Neues", r.status === 200 && r.json?.schon_da?.includes(f1.id) && r.json?.angelegt?.length === 0, r.json);
      r = await hochladen(idK, []);
      ok("ohne Datei: 400", r.status === 400, r.json);
      pK = await detail(idK);
      ok("Detail: web_480 an der Folie, website.web_480 = 1, Verlauf „web_varianten“", pK?.dateien?.find((x: any) => x.id === f1.id)?.web_480?.id === webId && pK?.website?.web_480 === 1 && pK?.verlauf?.some((v: any) => v.art === "web_varianten"), pK?.website);
      f = await feed(`thema=${THEMA}&n=12`);
      const fk2 = (f.json?.posts ?? []).find((p: any) => p.id === idK);
      ok("Feed: klein = Web-Bild (480), gross = Original", fk2?.bilder?.[0]?.klein?.url === sozialBildPfad(webId) && fk2?.bilder?.[0]?.klein?.breite === 480 && fk2?.bilder?.[0]?.gross?.url === sozialBildPfad(f1.id) && fk2?.bilder?.[1]?.klein?.url === sozialBildPfad(f2.id), fk2?.bilder?.slice(0, 2));
      b = await holen(bildPfad(webId), { stufe: null });
      ok("Bild-Route: Web-Bild eines sichtbaren Posts → 200", b.status === 200 && b.kopf.get("content-type") === "image/jpeg", b.status);
      r = await aktion(idK, "website", { version: pK.version, sichtbar: false });
      pK = r.json?.post;
      b = await holen(bildPfad(webId), { stufe: null });
      const bOrig = await holen(bildPfad(f1.id), { stufe: null });
      ok("Schalter aus: Web-Bild und Original → 404, Post nicht im Feed", b.status === 404 && bOrig.status === 404 && !(await feedIds()).includes(idK), { web: b.status, orig: bOrig.status });

      // Fehler → 200 mit leerer Liste (die Website bricht nie): Antwortform des Rückfalls.
      ok("Rückfall bei Fehlern: nur Profile, leere Liste, anzahl 0", JSON.stringify((await import("../server/lib/fiaon-sozial-feed")).sozialFeedLeer()) === JSON.stringify({ profile: vorher.json.profile, posts: [], anzahl: 0 }));
    }

    // Fehlversuche je IP: ab dem 10. gibt es 429 — auch mit richtigem Schlüssel (deshalb ganz am Ende).
    for (let i = 0; i < 10; i++) await importieren(l02, { id: "pruef294-02", token: `falsch-${i}` });
    r = await importieren(l02, { id: "pruef294-02", dateien: [] });
    ok("nach 10 falschen Schlüsseln: 429, bevor verglichen wird", r.status === 429, r.json);
  } finally {
    await aufraeumen();
    server.close();
    await sqlPool.end({ timeout: 5 });
  }

  console.log(`\n${gruen} grün, ${rot} rot`);
  if (rot) { console.log("ROT:\n  " + fehler.join("\n  ")); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
