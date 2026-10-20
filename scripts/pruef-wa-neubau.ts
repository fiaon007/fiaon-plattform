// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER WHATSAPP-RAUM NEU (20.10.2026)
//
// Justin: „mach das bitte neu und richtig – das es schön, cleanes WhatsApp ist
// … und schau das ALLES 100% funktioniert!"
//
// Was NEU an Logik dazukam, wird hier geprüft — jeweils mit einer Rot-Probe
// (eine Prüfung, die mit dem alten Stand scheitern würde):
//   1  rein, ohne Datenbank (immer):
//      · medienAusMeldung: Bild, Sprachnachricht, Dokument (Name ohne Pfad),
//        Standort, Kontakt, Reaktion — Text und Müll ergeben null.
//      · auslieferung: nur Bild/Ton/Video inline, PDF/HTML/SVG als Download,
//        nie text/html; medienAdresseErlaubt: nur Meta (https), nie fremd.
//      · vorlageAnzeige: Kopfbild, Kopfzeile, Fuß, Knöpfe aus dem Register.
//      · Filter „Wartet", liestMit (zwei Minuten, nie ich selbst).
//      · wr-format (die Oberfläche): Initialen, Farbe, Häkchen, Vorschau mit
//        Medien, Reaktionen an der Blase, Streifen „N ungelesene Nachrichten".
//      · Quelltext: Chefbüro-Vollfläche (flex gegen flow-root), keine
//        halbdurchsichtige Kontaktinfo, Akte über /akte/…, waEingang merkt
//        Medien NACH dem Speichern, Medien-Route mit nosniff.
//   2  mit der LOKALEN Test-DB (PRUEF_DB=1, nur 127.0.0.1:54329/fiaon_pruefstand*):
//      · Liste: „Wartet" (alt: alles), Häkchen/Medien in der Vorschau,
//        bearbeiter.name, Gegenprobe Sicht.
//      · Gespräch: ungelesenVorher (2, danach 0), vorlageAnzeige, medien.
//      · waEingang: Foto mit Unterschrift → Zeile + Medien; Text → keine Medien;
//        dieselbe Meldung zweimal → nichts doppelt; medienMerken wirft nie.
//      · Medien-Route: 503 ohne Zugang, 200 mit Graph-Ersatz auf 127.0.0.1,
//        Range 206, 403 fremd, 404 ohne Datei, HTML → Download, fremde Adresse
//        → 502, bei Meta gelöscht → 410.
// Aufruf:
//   Teil 1:   DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine npx tsx scripts/pruef-wa-neubau.ts
//   Teil 1+2: env -i PATH="$PATH" HOME="$HOME" PRUEF_DB=1 PGSSLMODE=require \
//               DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_wa?sslmode=require' \
//               npx tsx scripts/pruef-wa-neubau.ts
// Eigene Datensätze tragen die Marke PRUEF-WANEU und werden am Ende entfernt. Kein Netz außer 127.0.0.1.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL ||= "postgresql://pruef@127.0.0.1:9/keine";
const MIT_DB = process.env.PRUEF_DB === "1";
if (MIT_DB) {
  if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) {
    console.error("Teil 2 NUR gegen die lokale Test-DB (127.0.0.1:54329/fiaon_pruefstand*)!"); process.exit(3);
  }
  for (const k of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_WABA_ID", "META_SYSTEM_TOKEN", "META_TOKEN", "BREVO_API_KEY", "OPENAI_API_KEY", "TWILIO_AUTH_TOKEN", "ANTHROPIC_API_KEY"]) {
    if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
  }
  process.env.CRONS = "aus";
}

// Kein Netz außer localhost.
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

const WURZEL = new URL("..", import.meta.url).pathname;
const lies = (p: string) => readFileSync(join(WURZEL, p), "utf8");

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: unknown, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 900)}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const M = await import("../server/lib/fiaon-wa-medien");
const R = await import("../shared/fiaon-wa-raum");
const F = await import("../client/src/components/whatsapp/wr-format");
const route = await import("../server/routes/fiaon-whatsapp-postfach");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1a  medienAusMeldung — was eine Meta-Meldung trägt");
// ═══════════════════════════════════════════════════════════════════════════
{
  const bild = M.medienAusMeldung({ type: "image", image: { id: "123456", mime_type: "image/jpeg", caption: "Mein Beleg" } });
  ok("Foto: Kennung, Typ, Bildunterschrift", bild?.art === "bild" && bild.mediaId === "123456" && bild.mime === "image/jpeg" && bild.titel === "Mein Beleg", bild);
  const ton = M.medienAusMeldung({ type: "audio", audio: { id: "998", mime_type: "audio/ogg; codecs=opus", voice: true } });
  ok("Sprachnachricht: voice → sprache, Typ ohne Zusatz", ton?.art === "audio" && ton.sprache === true && ton.mime === "audio/ogg", ton);
  const dok = M.medienAusMeldung({ type: "document", document: { id: "77", mime_type: "application/pdf", filename: "../../etc/Meldebescheinigung.pdf" } });
  ok("Dokument: Name ohne Pfadzeichen", dok?.art === "dokument" && dok.name === ".._.._etc_Meldebescheinigung.pdf" && !/[\\/]/.test(String(dok.name)), dok);
  const ort = M.medienAusMeldung({ type: "location", location: { latitude: 50.11, longitude: 8.68, name: "Büro", address: "Musterstraße 1" } });
  ok("Standort: Koordinaten und Ort", ort?.art === "standort" && ort.lat === 50.11 && ort.lng === 8.68 && ort.ort === "Büro · Musterstraße 1", ort);
  ok("Standort ohne gültige Koordinaten → null", M.medienAusMeldung({ type: "location", location: { latitude: 200, longitude: 8 } }) === null);
  const k = M.medienAusMeldung({ type: "contacts", contacts: [{ name: { formatted_name: "Erika Muster" }, phones: [{ phone: "+49 30 123456" }] }] });
  ok("Kontaktkarte: Name und Nummer", k?.art === "kontakt" && k.kontakte?.[0]?.name === "Erika Muster" && k.kontakte?.[0]?.nummer === "+49 30 123456", k);
  const re = M.medienAusMeldung({ type: "reaction", reaction: { message_id: "wamid.ABC", emoji: "👍" } });
  ok("Reaktion: Zeichen und Ziel", re?.art === "reaktion" && re.emoji === "👍" && re.auf === "wamid.ABC", re);
  ok("Rot-Probe: Text, Knopf und Müll tragen nichts (null)", [
    { type: "text", text: { body: "Hallo" } }, { type: "button", button: { text: "Passt" } }, null, "x", {}, { type: "image" }, { type: "image", image: "x" },
  ].every((m) => M.medienAusMeldung(m) === null));
  const boese = M.medienAusMeldung({ type: "image", image: { id: "../../x?y", mime_type: "text/html<script>" } });
  ok("Kaputte Kennung/kaputter Typ werden verworfen (keine Abholung möglich)", boese?.mediaId === null && boese?.mime === null, boese);
  const lang = M.medienAusMeldung({ type: "image", image: { id: "1", caption: "x".repeat(5000) } });
  ok("Bildunterschrift gekappt (1.000 Zeichen)", (lang?.titel ?? "").length === 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1b  auslieferung und medienAdresseErlaubt — sicher ausliefern");
// ═══════════════════════════════════════════════════════════════════════════
{
  const a = M.auslieferung("image/jpeg", null);
  ok("Foto inline mit festem Typ", a.inline && a.typ === "image/jpeg");
  ok("Ton (ogg) inline", M.auslieferung("audio/ogg", null).inline);
  const pdf = M.auslieferung("application/pdf", "Meldebescheinigung");
  ok("PDF als Download mit .pdf", !pdf.inline && pdf.typ === "application/pdf" && pdf.dateiname === "Meldebescheinigung.pdf", pdf);
  const html = M.auslieferung("text/html", "seite.html");
  ok("Rot-Probe: HTML nie als text/html, sondern als Download (octet-stream)", !html.inline && html.typ === "application/octet-stream", html);
  const svg = M.auslieferung("image/svg+xml", "bild.svg");
  ok("Rot-Probe: SVG (kann Skript tragen) nie inline", !svg.inline && svg.typ === "application/octet-stream", svg);
  ok("Dateiname ohne Anführungszeichen, Pfade, Steuerzeichen", !/["\\/\n;]/.test(M.auslieferung("application/pdf", 'a"b/c\\d\ne;f.pdf').dateiname));
  ok("Meta-Adresse (lookaside.fbsbx.com, https) erlaubt", M.medienAdresseErlaubt("https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1"));
  ok("Rot-Probe: fremde Adressen nie (http, andere Domain, Anhängsel)", ![
    "http://lookaside.fbsbx.com/x", "https://evil.example/x", "https://fbsbx.com.evil.example/x", "file:///etc/passwd", "javascript:alert(1)", "", null,
  ].some((u) => M.medienAdresseErlaubt(u)));
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1c  vorlageAnzeige, Filter „Wartet“, liestMit");
// ═══════════════════════════════════════════════════════════════════════════
{
  const bild = route.vorlageAnzeige("fiaon_kkb_anfrage");
  ok("Bildfassung: Kopfbild auf derselben Seite, Knöpfe in Reihenfolge", bild?.bild === "/wa/fiaon-karte.png" && bild.knoepfe[0]?.art === "link" && bild.knoepfe[0]?.text === "Antrag öffnen" && bild.knoepfe.length === 3, bild);
  const text = route.vorlageAnzeige("fiaon_kk_aktiviert");
  ok("Textfassung: Kopfzeile und Fuß aus dem Register", text?.kopf === "Ihr Konto ist aktiviert" && !text.bild && /Wir bleiben an Ihrer Seite/.test(String(text.fuss)), text);
  ok("Neue Fassung (_v2) findet ihr Register", !!route.vorlageAnzeige("fiaon_kk_anfrage_v2")?.knoepfe.length);
  ok("Unbekannte Vorlage → null", route.vorlageAnzeige("gibt_es_nicht") === null && route.vorlageAnzeige(null) === null);
  ok("Filter „Wartet“ steht in der Reihe und wird gelesen", R.LISTEN_FILTER.some((f) => f.wert === "wartet" && f.text === "Wartet") && R.filterLesen("wartet") === "wartet");
  ok("Standard bleibt „Mit Antwort“ (Justin, 08.10.), erster Chip", R.STANDARD_FILTER === "antwort" && R.LISTEN_FILTER[0].wert === "antwort");
  ok("Beim Suchen bleibt „Wartet“ (nur „Mit Antwort“ wird zu „Alle“)", R.wirksamerFilter("wartet", "Lena") === "wartet" && R.wirksamerFilter("antwort", "Lena") === "alle");
  const jetzt = Date.parse("2026-10-20T10:00:00Z");
  ok("liestMit: ein anderer vor 30 s → ja", R.liestMit({ id: 7, seit: new Date(jetzt - 30_000).toISOString() }, 5, jetzt));
  ok("Rot-Probe liestMit: derselbe Kollege vor 3 Tagen → nein (vorher stand „jemand liest mit“ für immer)", !R.liestMit({ id: 7, seit: new Date(jetzt - 3 * 86_400_000).toISOString() }, 5, jetzt));
  ok("liestMit: ich selbst nie, ohne Zeit nie, ohne Bearbeiter nie", !R.liestMit({ id: 5, seit: new Date(jetzt).toISOString() }, 5, jetzt) && !R.liestMit({ id: 7, seit: null }, 5, jetzt) && !R.liestMit(null, 5, jetzt));
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1d  Oberfläche (wr-format): Bild, Häkchen, Vorschau, Reaktion, ungelesen");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("Initialen: „Lena Sommer“ → LS, „Mara“ → M", F.initialen("Lena Sommer") === "LS" && F.initialen("Mara") === "M");
  ok("Initialen: Umlaute und fremde Alphabete", F.initialen("Ölçek Şahin") === "ÖŞ" && F.initialen("  émile   zola ") === "ÉZ");
  ok("Initialen: nur Nummer → leer (Silhouette)", F.initialen("+44 770 0900111") === "" && F.initialen(null) === "");
  ok("Farbe bleibt je Nummer gleich, fünf Töne", F.avatarTon("447700900101") === F.avatarTon("447700900101") && [..."0123456789"].every((z) => F.avatarTon(`4477${z}`) >= 0 && F.avatarTon(`4477${z}`) < F.AVATAR_TOENE));
  ok("Häkchen: gelesen > zugestellt > gesendet, Fehler", F.hakenStufe({ status: "read" }) === "gelesen" && F.hakenStufe({ status: "delivered" }) === "zugestellt"
    && F.hakenStufe({ status: "gesendet" }) === "gesendet" && F.hakenStufe({ status: "fehler", gelesen_am: "x" }) === "fehler"
    && F.hakenStufe({ status: "delivered", gelesen_am: "2026-10-20T10:00:00Z" }) === "gelesen");
  const g = (letzte: any) => ({ nummer: "1", name: "X", personId: 1, leadId: null, stufe: null, betreuer: null, ungelesen: 0, maraAn: true, fensterBis: null, bearbeiter: null, notiz: null, letzte: { text: "", richtung: "rein", am: "2026-10-20T10:00:00Z", status: "empfangen", ...letzte } });
  const v1 = F.listenVorschau(g({ typ: "image", text: null, medien: { art: "bild", titel: "Mein Beleg" } }) as any);
  ok("Vorschau: Foto mit Unterschrift", v1.medien === "bild" && v1.text === "Mein Beleg", v1);
  const v2 = F.listenVorschau(g({ typ: "audio", text: null, medien: { art: "audio", titel: null, sprache: true } }) as any);
  ok("Vorschau: Sprachnachricht", v2.medien === "audio" && v2.text === "Sprachnachricht", v2);
  const v3 = F.listenVorschau(g({ typ: "image", text: null }) as any);
  ok("Vorschau: altes Foto ohne Medien-Zeile → „Foto“", v3.medien === "bild" && v3.text === "Foto", v3);
  const v4 = F.listenVorschau(g({ richtung: "raus", von: "Mara", vorlage: "fiaon_kkb_anfrage", vorlageName: "Erstkontakt nach der Anfrage", text: "Hallo …" }) as any);
  ok("Vorschau: Vorlage mit Klartextnamen, „Mara:“ davor", v4.vorlage && v4.wer === "Mara" && v4.text === "Vorlage · Erstkontakt nach der Anfrage", v4);

  const n = (id: number, richtung: string, extra: any = {}) => ({
    id, richtung, text: `t${id}`, vorlage: null, knopf: null, status: richtung === "raus" ? "gesendet" : "empfangen", fehler: null,
    von: richtung === "raus" ? "Mara" : null, typ: "text", empfangen_am: richtung === "rein" ? `2026-10-20T08:0${id}:00Z` : null,
    gesendet_am: richtung === "raus" ? `2026-10-20T08:0${id}:00Z` : null, zugestellt_am: null, gelesen_am: null, created_at: `2026-10-20T08:0${id}:00Z`,
    wa_id: `wamid.${id}`, ...extra,
  });
  const verlauf = [
    n(1, "raus"), n(2, "rein"), n(3, "rein", { typ: "reaction", text: null, medien: { art: "reaktion", emoji: "👍", auf: "wamid.1" } }),
    n(4, "rein"), n(5, "rein"), n(6, "rein", { typ: "reaction", text: null, medien: { art: "reaktion", emoji: "❤️", auf: "wamid.alt-nicht-geladen" } }),
  ];
  const e = F.eintraegeBauen(verlauf as any, [], new Date("2026-10-20T12:00:00Z"), { ungelesen: 2 });
  const blasen = e.filter((x) => x.art === "nachricht") as any[];
  ok("Reaktion hängt an der Ziel-Blase (keine eigene Blase)", blasen.length === 4 && blasen.find((b) => b.n.id === 1)?.reaktionen?.[0] === "👍", blasen.map((b) => [b.n.id, b.reaktionen]));
  ok("Reaktion ohne geladenes Ziel → leise Zeile", e.some((x) => x.art === "hinweis" && /❤️/.test((x as any).text)));
  const i = e.findIndex((x) => x.art === "ungelesen");
  ok("„2 ungelesene Nachrichten“ steht vor der vorletzten Kundennachricht (Reaktionen zählen nicht)", i >= 0 && (e[i + 1] as any)?.n?.id === 4 && (e[i] as any).anzahl === 2, e.map((x) => x.art + ((x as any).n ? (x as any).n.id : "")));
  ok("Rot-Probe: ohne Ungelesene kein Streifen", !F.eintraegeBauen(verlauf as any, [], new Date("2026-10-20T12:00:00Z")).some((x) => x.art === "ungelesen"));
  const zurueck = F.eintraegeBauen([...verlauf, n(7, "rein", { typ: "reaction", text: null, medien: { art: "reaktion", emoji: null, auf: "wamid.1" } })] as any, [], new Date("2026-10-20T12:00:00Z"));
  ok("Zurückgenommene Reaktion (leer) nimmt das Zeichen weg", !(zurueck.find((x) => x.art === "nachricht" && (x as any).n.id === 1) as any)?.reaktionen?.length);
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1e  Quelltext: Hülle, Raum, Server");
// ═══════════════════════════════════════════════════════════════════════════
{
  const glas = lies("client/src/styles/chefbuero-glas.css");
  const css = lies("client/src/styles/whatsapp-raum.css");
  const raum = lies("client/src/components/whatsapp/WhatsAppRaum.tsx");
  const liste = lies("client/src/components/whatsapp/Gespraechsliste.tsx");
  const fall = lies("client/src/components/whatsapp/FallSpalte.tsx");
  const eingabe = lies("client/src/components/whatsapp/Eingabe.tsx");
  const wa = lies("server/lib/fiaon-whatsapp.ts");
  const rt = lies("server/routes/fiaon-whatsapp-postfach.ts");
  ok("Chefbüro: Glas-Schicht setzt flow-root (Rot-Probe: das schlug .cb-voll) — und die Vollfläche bekommt flex zurück",
    /\.cb\.cb-glas \{ display: flow-root; \}/.test(glas) && /\.cb\.cb-glas\.cb-voll \{ display: flex; \}/.test(glas)
    && glas.indexOf(".cb.cb-glas.cb-voll { display: flex; }") > glas.indexOf(".cb.cb-glas { display: flow-root; }"));
  ok("Chefbüro: keine halbdurchsichtige Fläche mehr im Raum (sonst schien der Chat-Kopf durch die Kontaktinfo)", !/\.cb\.cb-glas \.wr \{[^}]*--wr-flaeche/.test(glas) && /\.cb\.cb-glas \.wr-raum \{/.test(glas));
  ok("Kontaktinfo über der Chatfläche: ganze Höhe, deckend", /\.wr-chat > \.wr-person\.schublade \{ grid-row: 1 \/ 4;/.test(css) && /--wr-flaeche: #0b1526;/.test(css));
  ok("Akte über die EINE Adresse (akteLink), nicht mehr /agent/pipeline?person=", /import \{ akteLink \} from "@\/lib\/akte-link";/.test(raum) && !/href=\{`\/agent\/pipeline\?person=/.test(fall + raum) && /akteLink=\{akte\}/.test(raum));
  ok("Kein Seitenkopf mit Knopfwand mehr: „WhatsApp“, Stift und ⋮ oben in der Liste", /<h1>WhatsApp<\/h1>/.test(liste) && /wr-menue-knopf/.test(liste) && !/wr-kopf-knoepfe[\s\S]*wr-schrift-knopf/.test(raum));
  ok("Senden scheitert sichtbar: Grund über dem Feld, Text bleibt (kein Schein-Erfolg)", /setSendeFehler\(\{ nummer, text: j\?\.error/.test(raum) && /Nicht gesendet\./.test(eingabe) && !/entwurfSetzen\(nummer[^\n]*\n[^\n]*setSendeFehler/.test(raum));
  ok("Doppelversand-Sperre bleibt ein Ref", /if \(!nummer \|\| sperre\.current\) return;/.test(raum) && /sperre\.current = true; setSendet\(true\); setSendeFehler\(null\);/.test(raum));
  ok("waEingang merkt Medien NACH dem Speichern der Zeile (nie davor, nie statt)", wa.indexOf("ON CONFLICT (wa_id) DO NOTHING RETURNING id`) as any[];") > 0
    && wa.indexOf("await medienMerken(Number(zeilen[0].id), nummer, medienAusMeldung(m), lauf);") > wa.indexOf("ON CONFLICT (wa_id) DO NOTHING RETURNING id`) as any[];"));
  ok("Medien-Route: Sicht wie das Gespräch, nosniff, Download für alles außer Bild/Ton/Video", /r\.get\("\/medien\/:zeile"/.test(rt) && /darfAnNummer\(blick, String\(z\.nummer\)\)/.test(rt)
    && /X-Content-Type-Options", "nosniff"/.test(rt) && /a\.inline \? "inline" : "attachment"/.test(rt));
  ok("Liste: „Wartet“ in SQL (letzte Nachricht vom Kunden, keine Autoantwort, keine Reaktion)", /\$\{filter !== "wartet"\} OR \(l\.richtung = 'rein' AND l\.auto_antwort IS NOT TRUE AND COALESCE\(l\.typ, 'text'\) <> 'reaction'\)/.test(rt));
  ok("Bremse-Hinweis und „Fenster zu“ bleiben im Raum (andere Prüfstände lesen sie)", /\/bremse`/.test(raum) && /wr-bremse/.test(raum) && /Fenster zu/.test(raum));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 2 — LOKALE TEST-DB
// ═══════════════════════════════════════════════════════════════════════════
const MARKE = "PRUEF-WANEU";
const PRE = "4477009009"; // Ofcom-Bereich für Film/Fernsehen — garantiert niemandes Nummer
if (MIT_DB) {
  const { sqlPool } = await import("../server/lib/db-pool");
  const wa = await import("../server/lib/fiaon-whatsapp");
  await wa.waTabellen();
  await M.medienTabelle();
  const express = (await import("express")).default;

  const aufraeumen = async () => {
    await sqlPool`DELETE FROM fiaon_wa_medien WHERE nummer LIKE ${PRE + "%"}`;
    await sqlPool`DELETE FROM fiaon_whatsapp WHERE nummer LIKE ${PRE + "%"}`;
    await sqlPool`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer LIKE ${PRE + "%"}`;
    await sqlPool`DELETE FROM fiaon_leads WHERE telefon LIKE ${"+" + PRE + "%"}`;
    await sqlPool`DELETE FROM fiaon_persons WHERE person_ref LIKE ${MARKE + "-%"}`;
    await sqlPool`DELETE FROM fiaon_agents WHERE email LIKE ${"pruef-waneu-%@pruefstand.test"}`;
  };
  // Mara schweigt im Prüfstand (sonst denkt sie im Hintergrund über die Test-Eingänge nach).
  const [maraVorher] = await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mara_wa_an'`.catch(() => []) as any[];
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('mara_wa_an', 'aus', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'aus', updated_at = NOW()`;

  let blick: { agentId: number | null; name: string; alles: boolean } = { agentId: null, name: "Prüfstand", alles: false };
  const app = express();
  app.use(express.json());
  app.use("/raum", route.raumRouten(() => blick));
  const server = await new Promise<any>((res) => { const s = app.listen(0, "127.0.0.1", () => res(s)); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/raum`;
  const holen = async (pfad: string, als: typeof blick, kopf: Record<string, string> = {}) => {
    blick = als;
    const r = await echtFetch(`${url}${pfad}`, { headers: kopf });
    const typ = r.headers.get("content-type") ?? "";
    const roh = Buffer.from(await r.arrayBuffer());
    let j: any = null;
    if (/json/.test(typ)) { try { j = JSON.parse(roh.toString("utf8")); } catch { j = null; } }
    return { status: r.status, j, roh, kopf: r.headers };
  };

  // Der Graph-Ersatz: beantwortet /v25.0/<id> und /datei/<id> auf 127.0.0.1 — so wie Meta, nur lokal.
  const BYTES = Buffer.from(Array.from({ length: 64 }, (_x, i) => i));
  let graphAufrufe = 0;
  const graph = createServer((req, res) => {
    graphAufrufe++;
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const id = u.pathname.split("/").pop() ?? "";
    if (u.pathname.startsWith("/datei/")) {
      if (req.headers.authorization !== "Bearer pruef-token") { res.writeHead(401); return res.end(); }
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": String(BYTES.length) });
      return res.end(BYTES);
    }
    if (id === "geloescht") { res.writeHead(404, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: "Unsupported get request", code: 100 } })); }
    const basis = `http://127.0.0.1:${(graph.address() as AddressInfo).port}`;
    const mime = id === "html" ? "text/html" : id === "pdf" ? "application/pdf" : "image/jpeg";
    const ziel = id === "fremd" ? "https://evil.example/x" : `${basis}/datei/${id}`;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ url: ziel, mime_type: mime, file_size: BYTES.length, id }));
  });
  await new Promise<void>((r) => graph.listen(0, "127.0.0.1", () => r()));

  try {
    await aufraeumen();
    const [a] = await sqlPool`INSERT INTO fiaon_agents (name, first_name, email, rolle, active, is_test_account, distribution_active, created_at)
                              VALUES ('Prüf Anna', 'Anna', 'pruef-waneu-a@pruefstand.test', 'agent', TRUE, TRUE, FALSE, NOW()) RETURNING id`;
    const [b] = await sqlPool`INSERT INTO fiaon_agents (name, first_name, email, rolle, active, is_test_account, distribution_active, created_at)
                              VALUES ('Prüf Bernd', 'Bernd', 'pruef-waneu-b@pruefstand.test', 'agent', TRUE, TRUE, FALSE, NOW()) RETURNING id`;
    const A = Number(a.id), B = Number(b.id);
    const alsA = { agentId: A, name: "Anna", alles: false };
    const alsB = { agentId: B, name: "Bernd", alles: false };
    const person = async (n: number, betreuer: number) => {
      const nummer = `${PRE}${String(n).padStart(2, "0")}`;
      const [p] = await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, assigned_agent_id, updated_at)
                                VALUES (${`${MARKE}-${nummer}`}, 'Prüf', ${`Kunde ${n}`}, ${`+${nummer}`}, ${betreuer}, NOW()) RETURNING id`;
      return { id: Number(p.id), nummer };
    };
    const t0 = Date.now() - 3 * 3600_000;
    const zeile = async (p: { id: number; nummer: string }, r: "rein" | "raus", min: number, extra: Record<string, unknown> = {}) => {
      const am = new Date(t0 + min * 60_000);
      const [z] = await sqlPool`
        INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, vorlage, status, von, empfangen_am, gesendet_am, zugestellt_am, gelesen_am, created_at, auto_antwort)
        VALUES (${`wamid.${MARKE}.${p.nummer}.${min}`}, ${r}, ${p.nummer}, ${p.id}, ${String(extra.typ ?? (extra.vorlage ? "vorlage" : "text"))}, ${(extra.text as string) ?? `${MARKE} ${min}`},
                ${(extra.vorlage as string) ?? null}, ${r === "rein" ? "empfangen" : String(extra.status ?? "gesendet")}, ${r === "raus" ? String(extra.von ?? "Mara") : null},
                ${r === "rein" ? am : null}, ${r === "raus" ? am : null}, ${extra.zugestellt ? am : null}, ${extra.gelesen ? am : null}, ${am}, ${(extra.auto as boolean) ?? null})
        RETURNING id`;
      return Number(z.id);
    };
    const gespraech = async (nummer: string, p: number, gelesenBis: number, bearbeiter: number | null = null) => {
      await sqlPool`INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, gelesen_bis, bearbeiter_id, bearbeiter_seit, mara_an, updated_at)
                    VALUES (${nummer}, ${p}, ${gelesenBis}, ${bearbeiter}, ${bearbeiter ? new Date() : null}, FALSE, NOW())`;
    };
    // P1: Vorlage (gelesen), Kunde schreibt zweimal → wartet, 2 ungelesen; Bernd hat es gerade offen.
    const p1 = await person(1, A);
    const v1 = await zeile(p1, "raus", 0, { vorlage: "fiaon_kkb_anfrage", text: "Hallo …", gelesen: true });
    await zeile(p1, "rein", 10); await zeile(p1, "rein", 11);
    await gespraech(p1.nummer, p1.id, v1, B);
    // P2: Kunde schreibt, wir antworten (zugestellt) → wartet NICHT.
    const p2 = await person(2, A);
    await zeile(p2, "rein", 20); const p2l = await zeile(p2, "raus", 21, { von: "Anna", zugestellt: true });
    await gespraech(p2.nummer, p2.id, p2l);
    // P3: Vorlage, dann Autoantwort → wartet NICHT.
    const p3 = await person(3, A);
    await zeile(p3, "raus", 30, { vorlage: "fiaon_kk_anfrage" }); const p3l = await zeile(p3, "rein", 31, { auto: true, text: "Vielen Dank für Ihre Nachricht, ich melde mich." });
    await gespraech(p3.nummer, p3.id, p3l);
    // P4: Kunde schreibt, dann nur eine Reaktion → wartet NICHT.
    const p4 = await person(4, A);
    await zeile(p4, "raus", 40); await zeile(p4, "rein", 41); const p4l = await zeile(p4, "rein", 42, { typ: "reaction", text: null });
    await gespraech(p4.nummer, p4.id, p4l);
    // P5: gehört Bernd, wartet → für Anna unsichtbar.
    const p5 = await person(5, B);
    const p5l = await zeile(p5, "rein", 50);
    await gespraech(p5.nummer, p5.id, p5l);

    abschnitt("2a  Liste: „Wartet“, Häkchen, Medien, wer liest mit");
    {
      const nur = (l: any[]) => (l ?? []).map((g: any) => String(g.nummer)).filter((x: string) => x.startsWith(PRE)).sort();
      const wartet = await holen(`/gespraeche?filter=wartet&limit=1000`, alsA);
      ok("„Wartet“ zeigt genau P1 (Kunde schrieb zuletzt) — nicht beantwortet, Autoantwort, Reaktion, fremd", JSON.stringify(nur(wartet.j?.gespraeche)) === JSON.stringify([p1.nummer]), nur(wartet.j?.gespraeche));
      const alle = await holen(`/gespraeche?filter=alle&limit=1000`, alsA);
      ok("Rot-Probe: „Alle“ zeigt alle vier eigenen (vorher bekam „wartet“ genau diese Liste)", nur(alle.j?.gespraeche).length === 4 && nur(wartet.j?.gespraeche).length === 1, nur(alle.j?.gespraeche));
      const zb = await holen(`/gespraeche?filter=wartet&limit=1000`, alsB);
      ok("Bernd sieht unter „Wartet“ nur seinen Kunden (Sicht bleibt)", JSON.stringify(nur(zb.j?.gespraeche)) === JSON.stringify([p5.nummer]));
      const z2 = (alle.j?.gespraeche ?? []).find((g: any) => g.nummer === p2.nummer);
      ok("Vorschau trägt Häkchen-Stand (zugestellt) und wer schrieb", z2?.letzte?.zugestellt === true && z2?.letzte?.gelesen === false && z2?.letzte?.absender === "mensch", z2?.letzte);
      const z1 = (alle.j?.gespraeche ?? []).find((g: any) => g.nummer === p1.nummer);
      ok("bearbeiter trägt den Namen (für „Bernd liest mit“), Ungelesen 2", z1?.bearbeiter?.id === B && z1?.bearbeiter?.name === "Prüf Bernd" && z1?.ungelesen === 2, z1);
      ok("maraAusGrund in der Liste (aus = mensch, wenn kein Grund gespeichert)", z1?.maraAn === false && z1?.maraAusGrund === "mensch");
    }

    abschnitt("2b  Gespräch: ungelesenVorher, Vorlage wie beim Kunden");
    {
      const erst = await holen(`/gespraech/${p1.nummer}`, alsA);
      ok("Beim ersten Öffnen: ungelesenVorher = 2", erst.status === 200 && erst.j?.ungelesenVorher === 2, { status: erst.status, u: erst.j?.ungelesenVorher });
      ok("… und Bernd liest mit (Name und Zeit kommen mit)", erst.j?.bearbeiter === B && erst.j?.bearbeiterName === "Prüf Bernd" && !!erst.j?.bearbeiterSeit);
      const vorlage = (erst.j?.verlauf ?? []).find((v: any) => v.vorlage);
      ok("Vorlage: Kopfbild und Knöpfe aus dem Register", vorlage?.vorlageAnzeige?.bild === "/wa/fiaon-karte.png" && vorlage?.vorlageAnzeige?.knoepfe?.length === 3, vorlage?.vorlageAnzeige);
      const zweit = await holen(`/gespraech/${p1.nummer}`, alsA);
      ok("Rot-Probe: beim zweiten Öffnen 0 (schon gelesen) — der Streifen erscheint nur einmal", zweit.j?.ungelesenVorher === 0);
      const fremd = await holen(`/gespraech/${p5.nummer}`, alsA);
      ok("Fremdes Gespräch: 403 wie bisher", fremd.status === 403);
    }

    abschnitt("2c  waEingang: Foto mit Unterschrift → Zeile + Medien; Text → keine; doppelt → einmal");
    let bildZeile = 0;
    {
      const meldung = (id: string, m: Record<string, unknown>) => ({
        messages: [{ from: p1.nummer, id, timestamp: String(Math.floor(Date.now() / 1000)), ...m }],
      });
      const e1 = await wa.waEingang(meldung(`wamid.${MARKE}.bild`, { type: "image", image: { id: "pruefbild1", mime_type: "image/jpeg", caption: "Hier mein Beleg" } }));
      const [z] = await sqlPool`SELECT w.id, w.typ, w.text, m.media_id, m.titel, m.art FROM fiaon_whatsapp w LEFT JOIN fiaon_wa_medien m ON m.zeile_id = w.id WHERE w.wa_id = ${`wamid.${MARKE}.bild`}`;
      bildZeile = Number(z?.id ?? 0);
      ok("Foto: Zeile gespeichert (Typ image, Text unverändert leer), Medien mit Kennung und Unterschrift", e1.neu === 1 && z?.typ === "image" && z?.text === null && z?.media_id === "pruefbild1" && z?.titel === "Hier mein Beleg" && z?.art === "bild", { e1, z });
      const e2 = await wa.waEingang(meldung(`wamid.${MARKE}.bild`, { type: "image", image: { id: "pruefbild1", mime_type: "image/jpeg" } }));
      const [c] = await sqlPool`SELECT (SELECT COUNT(*)::int FROM fiaon_whatsapp WHERE wa_id = ${`wamid.${MARKE}.bild`}) AS w, (SELECT COUNT(*)::int FROM fiaon_wa_medien WHERE nummer = ${p1.nummer}) AS m`;
      ok("Dieselbe Meldung zweimal: nichts doppelt", e2.neu === 0 && c.w === 1 && c.m === 1, { e2, c });
      await wa.waEingang(meldung(`wamid.${MARKE}.text`, { type: "text", text: { body: `Danke (${MARKE})` } }));
      const [t] = await sqlPool`SELECT w.id, m.zeile_id FROM fiaon_whatsapp w LEFT JOIN fiaon_wa_medien m ON m.zeile_id = w.id WHERE w.wa_id = ${`wamid.${MARKE}.text`}`;
      ok("Rot-Probe: Textnachricht → keine Medien-Zeile", !!t?.id && t.zeile_id === null);
      const kaputt = (() => { throw new Error("DB weg"); }) as any;
      ok("medienMerken wirft nie (kaputte Datenbank → false)", (await M.medienMerken(123, p1.nummer, { art: "bild", mediaId: "x" }, kaputt)) === false);
      await wa.waEingangNachlauf();
      // Maras Aufruf läuft im Hintergrund — er soll enden, solange ihr Schalter im Prüfstand aus ist.
      await new Promise((r) => setTimeout(r, 800));
    }

    abschnitt("2d  Medien-Route: Zugang, Abholung, Range, Sicht, Typen");
    {
      const ohne = await holen(`/medien/${bildZeile}`, alsA);
      ok("Ohne Meta-Zugang: 503 mit Klartext (ehrlich statt kaputtes Bild)", ohne.status === 503 && /nicht eingerichtet/.test(String(ohne.j?.error)), { s: ohne.status, j: ohne.j });
      process.env.META_SYSTEM_TOKEN = "pruef-token";
      process.env.META_GRAPH_URL = `http://127.0.0.1:${(graph.address() as AddressInfo).port}`;
      M.medienZwischenspeicherLeeren();
      const voll = await holen(`/medien/${bildZeile}`, alsA);
      ok("Mit Zugang: 200, image/jpeg, nosniff, inline, Bytes wie bei Meta", voll.status === 200 && voll.kopf.get("content-type") === "image/jpeg"
        && voll.kopf.get("x-content-type-options") === "nosniff" && /^inline/.test(String(voll.kopf.get("content-disposition"))) && voll.roh.equals(BYTES),
        { s: voll.status, typ: voll.kopf.get("content-type"), cd: voll.kopf.get("content-disposition"), n: voll.roh.length });
      const vorher = graphAufrufe;
      const teil = await holen(`/medien/${bildZeile}`, alsA, { Range: "bytes=0-9" });
      ok("Range (Safari): 206, 10 Bytes, Content-Range", teil.status === 206 && teil.roh.length === 10 && teil.kopf.get("content-range") === `bytes 0-9/${BYTES.length}` && teil.roh.equals(BYTES.subarray(0, 10)), { s: teil.status, cr: teil.kopf.get("content-range") });
      ok("… aus dem Zwischenspeicher (kein zweiter Abruf bei Meta)", graphAufrufe === vorher);
      const kaputtRange = await holen(`/medien/${bildZeile}`, alsA, { Range: "bytes=999-1000" });
      ok("Range außerhalb → 416", kaputtRange.status === 416);
      const fremd = await holen(`/medien/${bildZeile}`, alsB);
      ok("Fremder Mitarbeiter: 403 (dieselbe Sicht wie das Gespräch)", fremd.status === 403);
      const [txt] = await sqlPool`SELECT id FROM fiaon_whatsapp WHERE wa_id = ${`wamid.${MARKE}.text`}`;
      ok("Nachricht ohne Datei: 404", (await holen(`/medien/${txt.id}`, alsA)).status === 404);
      ok("Unbekannte Nachricht: 404, Unsinn: 400", (await holen(`/medien/999999999`, alsA)).status === 404 && (await holen(`/medien/abc`, alsA)).status === 400);
      let lfd = 90;
      const neu = async (mediaId: string, art: string, mime: string | null, name: string | null) => {
        const id = await zeile(p1, "rein", lfd++, { typ: art === "dokument" ? "document" : "image", text: null });
        await M.medienMerken(id, p1.nummer, { art: art as any, mediaId, mime, name });
        return id;
      };
      const html = await holen(`/medien/${await neu("html", "dokument", "text/html", "seite.html")}`, alsA);
      ok("Rot-Probe: Meta nennt text/html → Download als octet-stream, nie HTML im Browser", html.status === 200 && html.kopf.get("content-type") === "application/octet-stream" && /^attachment/.test(String(html.kopf.get("content-disposition"))), { typ: html.kopf.get("content-type") });
      const pdf = await holen(`/medien/${await neu("pdf", "dokument", "application/pdf", "Meldebescheinigung.pdf")}`, alsA);
      ok("PDF: Download mit Dateinamen", pdf.status === 200 && /^attachment; filename\*=UTF-8''Meldebescheinigung\.pdf$/.test(String(pdf.kopf.get("content-disposition"))), pdf.kopf.get("content-disposition"));
      const fremdAdr = await holen(`/medien/${await neu("fremd", "bild", "image/jpeg", null)}`, alsA);
      ok("Rot-Probe: Meta nennt eine fremde Adresse → 502, nichts abgeholt", fremdAdr.status === 502 && !FREMD.some((u) => /evil\.example/.test(u)), { s: fremdAdr.status, fremd: FREMD });
      const weg = await holen(`/medien/${await neu("geloescht", "bild", "image/jpeg", null)}`, alsA);
      ok("Bei Meta nicht mehr da → 410 „nicht mehr abrufbar“", weg.status === 410 && /nicht mehr abrufbar/.test(String(weg.j?.error)), { s: weg.status, j: weg.j });
      const gesp = await holen(`/gespraech/${p1.nummer}`, alsA);
      const mitMedien = (gesp.j?.verlauf ?? []).find((v: any) => Number(v.id) === bildZeile);
      ok("Gespräch liefert medien an der Zeile — ohne Metas Kennung", mitMedien?.medien?.art === "bild" && mitMedien.medien.datei === true && mitMedien.medien.titel === "Hier mein Beleg" && !JSON.stringify(mitMedien.medien).includes("pruefbild1"), mitMedien?.medien);
      const liste = await holen(`/gespraeche?filter=alle&limit=1000`, alsA);
      const z1 = (liste.j?.gespraeche ?? []).find((g: any) => g.nummer === p1.nummer);
      ok("Liste: die letzte Nachricht (ein Foto) trägt ihre Medien in der Vorschau", z1?.letzte?.typ === "image" && z1?.letzte?.medien?.art === "bild", z1?.letzte);
      const z2 = (liste.j?.gespraeche ?? []).find((g: any) => g.nummer === p2.nummer);
      ok("… und eine Textnachricht trägt keine (null)", z2 && "medien" in z2.letzte && z2.letzte.medien === null, z2?.letzte);
      delete process.env.META_SYSTEM_TOKEN; delete process.env.META_GRAPH_URL;
    }
  } catch (e) {
    ok("Teil 2 ohne Ausnahme", false, String((e as Error)?.stack ?? e).slice(0, 1500));
  } finally {
    server.close(); graph.close();
    await aufraeumen().catch((e) => ok("Aufräumen", false, String(e)));
    if (maraVorher?.value != null) await sqlPool`UPDATE fiaon_settings SET value = ${maraVorher.value}, updated_at = NOW() WHERE key = 'mara_wa_an'`;
    else await sqlPool`DELETE FROM fiaon_settings WHERE key = 'mara_wa_an'`;
    const [rest] = await sqlPool`SELECT (SELECT COUNT(*)::int FROM fiaon_whatsapp WHERE nummer LIKE ${PRE + "%"}) AS w,
                                        (SELECT COUNT(*)::int FROM fiaon_wa_medien WHERE nummer LIKE ${PRE + "%"}) AS m,
                                        (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${MARKE + "-%"}) AS p`;
    ok("aufgeräumt: keine Prüf-Nachrichten, -Medien, -Personen mehr; Mara-Schalter wie vorher", rest.w === 0 && rest.m === 0 && rest.p === 0, rest);
    await sqlPool.end({ timeout: 2 }).catch(() => {});
  }
}

ok("kein fremder Netzaufruf (auch nicht zur fremden Adresse, die „Meta“ nannte)", FREMD.length === 0, FREMD);
console.log(`\nWhatsApp-Neubau: ${gruen} grün, ${rot} rot${rot ? `\n  ${fehler.join("\n  ")}` : ""}`);
process.exit(rot ? 1 : 0);
