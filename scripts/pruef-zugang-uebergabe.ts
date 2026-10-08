// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND „ZUGANG DIGITAL ÜBERGEBEN" (08.10.2026)
//
// Teil A — offline (immer): Schlüssel (kein Rückfallwert), Verschlüsselung rund
//   (auch Gegenproben: falsches Token, falscher Schlüssel, verändertes Chiffrat),
//   Token/Code, Eingabeprüfung, Stand, Quelltext-Wände (Protokollzeile in
//   server/index.ts, Route vor /zugang/:ref, keine Messung, Kachel, Reiter,
//   keine Namen im Code).
// Teil B — lokale Datenbank-Kopie (nur, wenn DATABASE_URL auf 127.0.0.1 zeigt):
//   die echten Routen in einem eigenen Express auf einem freien Port:
//   Rechte · ohne Schlüssel gesperrt · ausstellen → falscher Code ×3 → gesperrt
//   · richtiger Code → Anzeige → Bestätigen → gelöscht · Ablauf 48 h (Link und
//   Takt) · Ersetzen · Zurückziehen · Datenbank-Wände · Drossel je Anschluss ·
//   und: das Passwort steht nirgends im Klartext (Tabelle, Chef-Protokoll,
//   Konsole, Antworten) außer in der EINEN Anzeige.
//
// Das Passwort ist erfunden und entsteht in diesem Lauf. Schlüssel und Sitzungs-
// geheimnis auch. Es wird nichts verschickt, keine Produktion berührt.
//
//   cd <repo>; NODEDIR=$(dirname "$(which node)")
//   env -i HOME="$HOME" PATH="$NODEDIR:/usr/bin:/bin" DATABASE_URL=postgresql://x@127.0.0.1:1/x \
//     node_modules/.bin/tsx scripts/pruef-zugang-uebergabe.ts                     # Teil A
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e282 fiaon_zugang_test
//   env -i … DATABASE_URL="postgresql://fiaon@127.0.0.1:54329/fiaon_zugang_test?sslmode=require" \
//     node_modules/.bin/tsx scripts/pruef-zugang-uebergabe.ts                     # A + B
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; if (process.env.LAUT) echt.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); echt.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { echt.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── Mitschnitt aller Ausgaben (Teil B prüft ihn auf Klartext) ──────────────
const echt = { log: console.log.bind(console) };
let mitschnitt = "";
function mitschneiden(): () => void {
  const alt = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  const schreiben = process.stdout.write.bind(process.stdout);
  const fSchreiben = process.stderr.write.bind(process.stderr);
  const fang = (...a: unknown[]) => { mitschnitt += a.map((x) => (typeof x === "string" ? x : (x instanceof Error ? `${x.message}\n${x.stack}` : JSON.stringify(x)))).join(" ") + "\n"; };
  console.log = fang; console.info = fang; console.warn = fang; console.error = fang; console.debug = fang;
  (process.stdout as any).write = (c: any, ...r: any[]) => { mitschnitt += String(c); return schreiben(c, ...r); };
  (process.stderr as any).write = (c: any, ...r: any[]) => { mitschnitt += String(c); return fSchreiben(c, ...r); };
  return () => {
    Object.assign(console, alt);
    (process.stdout as any).write = schreiben;
    (process.stderr as any).write = fSchreiben;
  };
}

// Erfunden, nur für diesen Lauf. Mit Umlaut und Sonderzeichen, damit die Kodierung mitgeprüft wird.
const PASSWORT = `Prüf-Start#${randomBytes(6).toString("hex")}-Ä!`;
const SCHLUESSEL = randomBytes(32).toString("base64");

async function main(): Promise<void> {
  process.env.APP_BASE_URL = process.env.APP_BASE_URL || "https://www.fiaon.com";
  const lib = await import("../server/lib/fiaon-zugang-uebergabe");
  const geteilt = await import("../shared/fiaon-zugang-uebergabe");

  // ═════════════════════════════════════════════════════════════════════════
  titel("A1  Der Schlüssel — ohne ZUGANG_SCHLUESSEL kein Ausstellen, kein Rückfallwert");
  // ═════════════════════════════════════════════════════════════════════════
  delete process.env.ZUGANG_SCHLUESSEL;
  const ohne = lib.zugangSchluessel();
  pruef("ohne Variable: nicht bereit", !ohne.ok);
  pruef("ohne Variable: die Meldung nennt ZUGANG_SCHLUESSEL und Render", !ohne.ok && /ZUGANG_SCHLUESSEL/.test(ohne.grund) && /Render/.test(ohne.grund));
  const ohneAus = await lib.uebergabeAusstellen({ name: "Erika Muster", zugang: "erika@beispiel.test", anmeldeadresse: "mail.google.com", passwort: PASSWORT, ansprechName: "Max Muster" }, { agentId: null, name: "Prüfstand", stufe: "leitung" });
  pruef("ohne Variable: Ausstellen verweigert (503 SCHLUESSEL_FEHLT)", !ohneAus.ok && ohneAus.status === 503 && ohneAus.code === "SCHLUESSEL_FEHLT");
  pruef("ohne Variable: die Verweigerung trägt kein Passwort", !JSON.stringify(ohneAus).includes(PASSWORT));
  process.env.ZUGANG_SCHLUESSEL = randomBytes(16).toString("base64");
  const kurz = lib.zugangSchluessel();
  pruef("16 statt 32 Byte: nicht bereit, Meldung nennt die Länge", !kurz.ok && /16 statt 32/.test(kurz.grund));
  process.env.ZUGANG_SCHLUESSEL = "kein base64 !";
  pruef("kein base64: nicht bereit", !lib.zugangSchluessel().ok);
  process.env.ZUGANG_SCHLUESSEL = SCHLUESSEL;
  const mit = lib.zugangSchluessel();
  pruef("32 Byte base64: bereit", mit.ok && mit.schluessel.length === 32);
  process.env.ZUGANG_SCHLUESSEL = Buffer.from(SCHLUESSEL, "base64").toString("base64url");
  pruef("32 Byte base64url: ebenso bereit", lib.zugangSchluessel().ok);
  process.env.ZUGANG_SCHLUESSEL = SCHLUESSEL;
  const libQ = quelle("server/lib/fiaon-zugang-uebergabe.ts");
  pruef("Quelltext: ZUGANG_SCHLUESSEL ohne Vorgabewert gelesen (kein „|| …“)", /process\.env\.ZUGANG_SCHLUESSEL \?\? ""\)/.test(libQ) && !/ZUGANG_SCHLUESSEL\s*\|\|/.test(libQ));
  const master = (mit as any).schluessel as Buffer;

  // ═════════════════════════════════════════════════════════════════════════
  titel("A2  Verschlüsselung rund — AES-256-GCM, je Übergabe mit dem Token abgeleitet");
  // ═════════════════════════════════════════════════════════════════════════
  const tok = lib.tokenErzeugen();
  const geheim = lib.passwortVerschluesseln(PASSWORT, tok, master);
  const mig = quelle("db/migrations/107_zugang_uebergabe.sql");
  const formRoh = mig.match(/passwort_geheim ~ '([^']+)'/)?.[1] ?? "";
  pruef("Chiffrat-Form steht in Migration 107", !!formRoh);
  pruef("Chiffrat passt auf die Wand der Tabelle (Form v1.iv.tag.chiffre)", !!formRoh && new RegExp(formRoh.replace(/\\\./g, "\\.")).test(geheim));
  pruef("Rund: entschlüsselt ergibt genau das Passwort (mit Umlaut)", lib.passwortEntschluesseln(geheim, tok, master) === PASSWORT);
  pruef("Chiffrat enthält das Passwort nicht (weder Klartext noch base64)", !geheim.includes(PASSWORT) && !geheim.includes(Buffer.from(PASSWORT).toString("base64").slice(0, 12)) && !geheim.includes(Buffer.from(PASSWORT).toString("base64url").slice(0, 12)));
  pruef("Zweimal verschlüsselt ≠ gleich (zufälliger IV)", lib.passwortVerschluesseln(PASSWORT, tok, master) !== geheim);
  const wirft = (f: () => unknown) => { try { f(); return null; } catch (e: any) { return String(e?.message ?? e); } };
  const m1 = wirft(() => lib.passwortEntschluesseln(geheim, lib.tokenErzeugen(), master));
  pruef("Gegenprobe: anderes Token → nicht lesbar", m1 != null);
  const m2 = wirft(() => lib.passwortEntschluesseln(geheim, tok, randomBytes(32)));
  pruef("Gegenprobe: anderer Schlüssel → nicht lesbar", m2 != null);
  const teile = geheim.split(".");
  const kaputt = [teile[0], teile[1], teile[2], Buffer.from(Buffer.from(teile[3], "base64url").map((b, i) => (i === 0 ? b ^ 1 : b))).toString("base64url")].join(".");
  const m3 = wirft(() => lib.passwortEntschluesseln(kaputt, tok, master));
  pruef("Gegenprobe: ein Bit im Chiffrat verändert → nicht lesbar (GCM-Prüfsumme)", m3 != null);
  pruef("Fehlermeldungen tragen kein Passwort", [m1, m2, m3].every((m) => m != null && !m.includes(PASSWORT)));

  // ═════════════════════════════════════════════════════════════════════════
  titel("A3  Token und Code — hohe Entropie, nur Prüfsummen, zeitkonstant");
  // ═════════════════════════════════════════════════════════════════════════
  const tokens = Array.from({ length: 200 }, () => lib.tokenErzeugen());
  pruef("Token: 43 Zeichen base64url (256 Bit)", tokens.every((t) => /^[A-Za-z0-9_-]{43}$/.test(t)));
  pruef("Token: 200 Stück, alle verschieden", new Set(tokens).size === 200);
  pruef("Token-Hash: 64 Hex-Zeichen, verrät das Token nicht", /^[0-9a-f]{64}$/.test(lib.tokenHash(tok)) && !lib.tokenHash(tok).includes(tok));
  pruef("Token-Form: Fremdes erreicht die Datenbank nicht", !lib.tokenGeformt("../etc") && !lib.tokenGeformt(tok + "x") && lib.tokenGeformt(tok));
  const codes = Array.from({ length: 2000 }, () => lib.codeErzeugen());
  pruef("Code: immer sechs Ziffern (auch mit führender Null)", codes.every((c) => /^\d{6}$/.test(c)) && codes.some((c) => c.startsWith("0")));
  pruef("Code: gestreut (2.000 Stück, über 1.990 verschieden)", new Set(codes).size > 1990);
  const tH = lib.tokenHash(tok);
  const c = "042917";
  const hm = lib.codeHmac(c, tH, master);
  pruef("Code-HMAC: richtig → passt", lib.codePasst(c, tH, hm, master));
  pruef("Code-HMAC: falsch → passt nicht", !lib.codePasst("042918", tH, hm, master));
  pruef("Code-HMAC: anderer Link → passt nicht", !lib.codePasst(c, lib.tokenHash(lib.tokenErzeugen()), hm, master));
  pruef("Code-HMAC: anderer Schlüssel → passt nicht", !lib.codePasst(c, tH, hm, randomBytes(32)));
  pruef("Code-HMAC ist kein reiner SHA-256 des Codes", hm !== createHash("sha256").update(c).digest("hex") && hm !== createHash("sha256").update(`${tH}:${c}`).digest("hex"));
  pruef("Vergleich zeitkonstant (timingSafeEqual im Quelltext)", /timingSafeEqual\(a, b\)/.test(libQ));
  pruef("Leerer gespeicherter Wert passt nie", !lib.codePasst(c, tH, "", master));

  // ═════════════════════════════════════════════════════════════════════════
  titel("A4  Eingabe der Leitung — Meldungen nennen nie einen Inhalt");
  // ═════════════════════════════════════════════════════════════════════════
  const gut = { name: "Erika Muster", rolle: "Praktikum Buchhaltung", zugang: "Erika@Beispiel.test", anmeldeadresse: "mail.google.com", passwort: PASSWORT, ansprechName: "Max Muster", ansprechFunktion: "Geschäftsführung", ansprechEmail: "max@beispiel.test", ansprechTelefon: "+49 30 000000" };
  const e1 = geteilt.uebergabeEingabePruefen(gut);
  pruef("gültige Eingabe: ok, Adresse klein, Passwort unverändert", e1.ok && e1.wert.zugang === "erika@beispiel.test" && e1.wert.passwort === PASSWORT);
  const faelle: [string, Record<string, unknown>, string][] = [
    ["ohne Namen", { ...gut, name: " " }, "name"],
    ["Zugang keine E-Mail", { ...gut, zugang: "erika" }, "zugang"],
    ["Anmeldeadresse mit Leerzeichen", { ...gut, anmeldeadresse: "mail google" }, "anmeldeadresse"],
    ["Passwort zu kurz", { ...gut, passwort: "Ab1!" }, "passwort"],
    ["Passwort mit Leerzeichen am Rand", { ...gut, passwort: ` ${PASSWORT}` }, "passwort"],
    ["Passwort mit Zeilenumbruch", { ...gut, passwort: `${PASSWORT}\nx` }, "passwort"],
    ["ohne Ansprechperson", { ...gut, ansprechName: "" }, "ansprechName"],
    ["Ansprech-E-Mail kaputt", { ...gut, ansprechEmail: "max@" }, "ansprechEmail"],
  ];
  for (const [n, roh, feld] of faelle) {
    const r = geteilt.uebergabeEingabePruefen(roh as any);
    pruef(`abgelehnt: ${n} (Feld ${feld})`, !r.ok && r.feld === feld);
    pruef(`… Meldung ohne Passwort: ${n}`, !r.ok && !r.fehler.includes(PASSWORT) && !r.fehler.includes("Ab1!"));
  }
  pruef("Vorname = erstes Wort", geteilt.uebergabeVorname("  Erika  Muster ") === "Erika");
  pruef("Google erkannt: mail.google.com, gmail.com; nicht: fiaon.com/agent", geteilt.uebergabeIstGoogle("mail.google.com") && geteilt.uebergabeIstGoogle("https://gmail.com") && !geteilt.uebergabeIstGoogle("fiaon.com/agent"));

  // ═════════════════════════════════════════════════════════════════════════
  titel("A5  Der Stand einer Übergabe — eine Funktion, Vorrang richtig");
  // ═════════════════════════════════════════════════════════════════════════
  const J = Date.parse("2026-10-08T12:00:00Z");
  const S = geteilt.uebergabeStandAus;
  const morgen = "2026-10-09T12:00:00Z", gestern = "2026-10-07T12:00:00Z";
  pruef("neu → offen", S({ gueltig_bis: morgen }, J) === "offen");
  pruef("angesehen → angesehen", S({ gueltig_bis: morgen, angesehen_am: gestern }, J) === "angesehen");
  pruef("Zeit um → abgelaufen (auch ohne Lauf)", S({ gueltig_bis: gestern, angesehen_am: gestern }, J) === "abgelaufen");
  pruef("bestätigt bleibt bestätigt nach Ablauf", S({ gueltig_bis: gestern, bestaetigt_am: gestern, geloescht_grund: "bestaetigt" }, J) === "bestaetigt");
  pruef("gesperrt bleibt gesperrt nach Ablauf", S({ gueltig_bis: gestern, gesperrt_am: gestern, geloescht_grund: "gesperrt" }, J) === "gesperrt");
  pruef("zurückgezogen / ersetzt", S({ gueltig_bis: morgen, geloescht_grund: "zurueckgezogen" }, J) === "zurueckgezogen" && S({ gueltig_bis: morgen, geloescht_grund: "ersetzt" }, J) === "ersetzt");
  pruef("nur offen/angesehen leben", geteilt.uebergabeLebt("offen") && geteilt.uebergabeLebt("angesehen") && !geteilt.uebergabeLebt("abgelaufen") && !geteilt.uebergabeLebt("bestaetigt"));
  pruef("neu ausstellen: alles außer bestätigt", !geteilt.uebergabeNeuAusstellbar("bestaetigt") && geteilt.uebergabeNeuAusstellbar("gesperrt") && geteilt.uebergabeNeuAusstellbar("abgelaufen"));
  pruef("Grenzen: 48 Stunden, 3 Versuche, 6 Ziffern", geteilt.UEBERGABE_GUELTIG_STUNDEN === 48 && geteilt.UEBERGABE_MAX_FEHLVERSUCHE === 3 && geteilt.UEBERGABE_CODE_STELLEN === 6);
  pruef("Link: Token im Anker, nicht im Pfad", lib.uebergabeLink(tok) === `https://www.fiaon.com/zugang/uebergabe#${tok}` || lib.uebergabeLink(tok).endsWith(`/zugang/uebergabe#${tok}`));

  // ═════════════════════════════════════════════════════════════════════════
  titel("A6  Quelltext-Wände — Protokoll, Route, Messung, Kachel, Reiter, Namen");
  // ═════════════════════════════════════════════════════════════════════════
  const index = quelle("server/index.ts");
  const zeile = index.split("\n").find((l) => /const ohneAntwort = /.test(l)) ?? "";
  const ausdruck = zeile.replace(/^\s*const ohneAntwort = /, "").replace(/;\s*$/, "");
  let ohneAntwort: ((p: string) => boolean) | null = null;
  try { ohneAntwort = new Function("path", `return (${ausdruck});`) as any; } catch { ohneAntwort = null; }
  pruef("server/index.ts: die Zeile „ohneAntwort“ ist auswertbar", !!ohneAntwort);
  for (const p of ["/api/fiaon/zugang-uebergabe/oeffnen", "/api/fiaon/zugang-uebergabe/bestaetigen", "/api/fiaon/zugang-uebergabe/stand", "/api/fiaon/chef/zugang-uebergabe", "/api/fiaon/chef/zugang-uebergabe/7/zurueckziehen"]) {
    pruef(`Protokoll schreibt KEINE Antwort für ${p}`, !!ohneAntwort && ohneAntwort(p) === true);
  }
  pruef("Gegenprobe: andere Pfade werden weiter mitgeschrieben (/api/fiaon/chef/zahlen)", !!ohneAntwort && ohneAntwort("/api/fiaon/chef/zahlen") === false);
  const altAusdruck = ausdruck.replace(/\s*\|\|\s*\/\\\/zugang-uebergabe[^]*$/, "");
  const alt = new Function("path", `return (${altAusdruck});`) as (p: string) => boolean;
  pruef("Gegenprobe: ohne die Ergänzung stünde die Anzeige im Protokoll", alt("/api/fiaon/zugang-uebergabe/oeffnen") === false);

  const routen = quelle("server/routes.ts");
  pruef("routes.ts: Router eingehängt", /import\('\.\/routes\/fiaon-zugang-uebergabe'\)/.test(routen) && /app\.use\('\/api\/fiaon', fiaonZugangUebergabe\.default\)/.test(routen));
  pruef("routes.ts: Seite /zugang/uebergabe mit noindex, no-store, no-referrer", /app\.get\(\['\/zugang\/uebergabe', '\/zugang\/uebergabe\/\*'\][^]{0,200}X-Robots-Tag', 'noindex, nofollow'[^]{0,120}no-referrer[^]{0,120}no-store/.test(routen));
  pruef("routes.ts: Ablauf-Takt angemeldet (nur im Betrieb, still)", /tageslauf\('zugang_uebergabe_ablauf'[^;]*abgelaufeneLoeschen\(\)[^;]*nurMitErgebnis: true/.test(routen));
  const seo = quelle("server/lib/fiaon-seiten-seo.ts") + quelle("shared/fiaon-seo-seiten.ts");
  pruef("nicht vorgerendert: kein SEO-Eintrag für /zugang", !/["']\/zugang/.test(seo));
  const app = quelle("client/src/App.tsx");
  const iU = app.indexOf('<Route path="/zugang/uebergabe"');
  const iR = app.indexOf('<Route path="/zugang/:ref"');
  pruef("App.tsx: Empfängerseite VOR dem Setz-Link /zugang/:ref", iU > 0 && iR > 0 && iU < iR);
  const ew = quelle("client/src/components/site/EinwilligungsHinweis.tsx");
  const ohneMessung = ew.match(/const OHNE_MESSUNG = (\/.*\/);/)?.[1] ?? "";
  let messRe: RegExp | null = null;
  try { messRe = new Function(`return ${ohneMessung};`)() as RegExp; } catch { messRe = null; }
  pruef("keine Messung (Clarity) auf /zugang/uebergabe", !!messRe && messRe.test("/zugang/uebergabe") && messRe.test("/business/angebot/x") && !messRe.test("/zugang/FIA-123"));
  const seite = quelle("client/src/pages/zugang-uebergabe.tsx");
  pruef("Empfängerseite: Passwortzeile für Aufzeichnungen maskiert", /className="zu-pw" data-clarity-mask="True"/.test(seite));
  pruef("Empfängerseite: Token aus dem Anker, Anfragen ohne Token im Pfad", /window\.location\.hash/.test(seite) && /\/api\/fiaon\/zugang-uebergabe\/\$\{pfad\}/.test(seite) && !/zugang-uebergabe\/\$\{token\}/.test(seite));
  pruef("Empfängerseite: Passwort standardmäßig verdeckt", /useState\(false\);\s*\n\s*const \[kopiert/.test(seite) && /sichtbar\s*\n?\s*\?/.test(seite));
  const kacheln = quelle("client/src/components/admin/chef-seiten.tsx");
  pruef("Chefbüro: Kachel „Zugang übergeben“ im Raum Team (Team-Zentrale, ?tab=zugang)", /slug: "zugang-uebergeben", label: "Zugang übergeben"[^}]*Seite: TeamZentrale, raum: "team", suche: "tab=zugang"/.test(kacheln));
  const team = quelle("client/src/pages/admin-team-zentrale.tsx");
  pruef("Team-Zentrale: Reiter und Kopfknopf „Zugang übergeben“", /\["zugang", "Zugang übergeben"\]/.test(team) && /reiterWechseln\("zugang"\)/.test(team) && /reiter === "zugang" && <ZugangUebergabe \/>/.test(team));
  const routenDatei = quelle("server/routes/fiaon-zugang-uebergabe.ts");
  pruef("Chef-Routen: requireChef(\"leitung\") an allen drei", (routenDatei.match(/router\.(get|post)\("\/chef\/zugang-uebergabe[^"]*", requireChef\("leitung"\)/g) ?? []).length === 3);
  pruef("Empfänger-Routen: Token im Körper, nie im Pfad", !/router\.post\("\/zugang-uebergabe\/:/.test(routenDatei));
  const neu = [
    "db/migrations/107_zugang_uebergabe.sql", "shared/fiaon-zugang-uebergabe.ts", "server/lib/fiaon-zugang-uebergabe.ts",
    "server/routes/fiaon-zugang-uebergabe.ts", "client/src/pages/zugang-uebergabe.tsx", "client/src/components/admin/ZugangUebergabe.tsx",
    "client/src/styles/zugang-uebergabe.css", "scripts/pruef-zugang-uebergabe.ts",
  ];
  // Der erste Fall heißt hier nie mit Namen — die Wand sucht nach dem Wort, ohne es selbst zu enthalten.
  const verboten = new RegExp(["R", "ifka"].join(""), "i");
  pruef("Keine echten Namen der Empfängerin im Code (öffentliches Repo)", neu.every((p) => !verboten.test(quelle(p))));
  pruef("Kein Passwort-Klartext in irgendeinem console-Aufruf der Server-Dateien", !/console\.[a-z]+\([^)]*passwort[^)]*\)/i.test(libQ + routenDatei));

  // ═════════════════════════════════════════════════════════════════════════
  // Teil B — lokale Datenbank
  // ═════════════════════════════════════════════════════════════════════════
  const DB = process.env.DATABASE_URL ?? "";
  let host = "", port = "";
  try { const u = new URL(DB); host = u.hostname; port = u.port; } catch { /* kein URL */ }
  const lokal = (host === "127.0.0.1" || host === "localhost") && port !== "1" && port !== "";
  if (!lokal) {
    echt.log(`\nTeil B übersprungen — DATABASE_URL zeigt auf keine lokale Datenbank-Kopie (nur 127.0.0.1 mit Port).`);
    return;
  }
  await teilB(lib, PASSWORT);
}

async function teilB(lib: typeof import("../server/lib/fiaon-zugang-uebergabe"), PASSWORT: string): Promise<void> {
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const { sqlPool } = await import("../server/lib/db-pool");
  const routenMod = await import("../server/routes/fiaon-zugang-uebergabe");
  process.env.SESSION_SECRET = randomBytes(24).toString("hex");
  process.env.ZUGANG_SCHLUESSEL = SCHLUESSEL;

  const geheimnisse = new Set<string>([PASSWORT]);
  const antworten: { pfad: string; text: string }[] = [];
  const stop = mitschneiden();
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/fiaon", routenMod.default);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fiaon`;

  const chefKeks = (stufe: string, agentId = 999_999) => {
    const exp = Date.now() + 3_600_000;
    const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:${agentId}:${stufe}:${exp}`).digest("hex").slice(0, 40);
    return `fiaon_chef=${agentId}.${stufe}.${exp}.${sig}`;
  };
  const LEITUNG = chefKeks("leitung");
  async function rufen(pfad: string, opt: { methode?: string; koerper?: unknown; keks?: string; ip?: string } = {}) {
    const r = await fetch(`${basis}${pfad}`, {
      method: opt.methode ?? (opt.koerper ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(opt.keks ? { Cookie: opt.keks } : {}), ...(opt.ip ? { "X-Forwarded-For": opt.ip } : {}) },
      body: opt.koerper ? JSON.stringify(opt.koerper) : undefined,
    });
    const text = await r.text();
    antworten.push({ pfad, text });
    let json: any = null; try { json = JSON.parse(text); } catch { /* kein JSON */ }
    return { status: r.status, json, kopf: r.headers };
  }
  const daten = (zusatz: Record<string, unknown> = {}) => ({
    name: "Erika Muster", rolle: "Praktikum Buchhaltung", zugang: `pruef-${randomBytes(4).toString("hex")}@beispiel.test`,
    anmeldeadresse: "mail.google.com", passwort: PASSWORT, ansprechName: "Max Muster", ansprechFunktion: "Geschäftsführung",
    ansprechEmail: "max@beispiel.test", ansprechTelefon: "+49 30 000000", ...zusatz,
  });
  const ausstellen = async (zusatz: Record<string, unknown> = {}) => {
    const r = await rufen("/chef/zugang-uebergabe", { koerper: daten(zusatz), keks: LEITUNG });
    const token = String(r.json?.link ?? "").split("#")[1] ?? "";
    if (token) geheimnisse.add(token);
    if (r.json?.code) geheimnisse.add(String(r.json.code));
    return { ...r, token, code: String(r.json?.code ?? ""), id: Number(r.json?.id) };
  };
  const zeile = async (id: number) => ((await sqlPool`SELECT *, row_to_json(z)::text AS roh FROM fiaon_zugang_uebergaben z WHERE id = ${id}`) as any[])[0] ?? {};
  const falscherCode = (richtig: string) => String((Number(richtig) + 1) % 1_000_000).padStart(6, "0");
  const startZeit = ((await sqlPool`SELECT NOW() AS t`) as any[])[0].t;

  try {
    // ═══════════════════════════════════════════════════════════════════════
    titel("B0  Tabelle — Migration 107 über den Wächter, wiederholbar");
    // ═══════════════════════════════════════════════════════════════════════
    await lib.ensureZugangUebergabeTabelle();
    const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_zugang_uebergaben') AS t`) as any[];
    pruef("Tabelle fiaon_zugang_uebergaben steht", !!t?.t);
    const wand = (await sqlPool`SELECT conname FROM pg_constraint WHERE conrelid = 'fiaon_zugang_uebergaben'::regclass AND contype = 'c' ORDER BY conname`) as any[];
    pruef("drei Wände (Chiffrat-Form, geleert, Grund)", wand.length === 3);
    let zweimal = true;
    try {
      const text = quelle("db/migrations/107_zugang_uebergabe.sql").replace(/^SET lock_timeout\b/m, "SET LOCAL lock_timeout");
      await sqlPool.begin(async (tx: any) => { await tx.unsafe(text); await tx.unsafe(text); });
    } catch { zweimal = false; }
    pruef("Migration 107 zweimal hintereinander ohne Fehler (idempotent)", zweimal);
    const spalten = ((await sqlPool`SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_zugang_uebergaben'`) as any[]).map((r) => r.column_name);
    pruef("keine Spalte für Klartext-Passwort, Token oder Code", !spalten.some((s: string) => /^(passwort|token|code)$/.test(s)) && spalten.includes("token_hash") && spalten.includes("code_hmac"));

    // ═══════════════════════════════════════════════════════════════════════
    titel("B1  Rechte — nur mit Chef-Sitzung");
    // ═══════════════════════════════════════════════════════════════════════
    const ohneKeks = await rufen("/chef/zugang-uebergabe");
    pruef("ohne Sitzung: 401", ohneKeks.status === 401);
    const ohneKeksPost = await rufen("/chef/zugang-uebergabe", { koerper: daten() });
    pruef("ohne Sitzung: Ausstellen 401", ohneKeksPost.status === 401);
    const gefaelscht = await rufen("/chef/zugang-uebergabe", { keks: LEITUNG.replace(/.$/, (x) => (x === "0" ? "1" : "0")) });
    pruef("gefälschte Sitzung: 401", gefaelscht.status === 401);
    const liste0 = await rufen("/chef/zugang-uebergabe", { keks: LEITUNG });
    pruef("Stufe Leitung: Liste 200, Schlüssel da", liste0.status === 200 && liste0.json?.schluessel?.da === true);
    pruef("Antwort: Cache-Control no-store, X-Robots-Tag noindex", /no-store/.test(liste0.kopf.get("cache-control") ?? "") && /noindex/.test(liste0.kopf.get("x-robots-tag") ?? ""));

    // ═══════════════════════════════════════════════════════════════════════
    titel("B2  Ohne ZUGANG_SCHLUESSEL — Ausstellen verweigert, Chefbüro sagt es");
    // ═══════════════════════════════════════════════════════════════════════
    delete process.env.ZUGANG_SCHLUESSEL;
    const ohneS = await rufen("/chef/zugang-uebergabe", { koerper: daten(), keks: LEITUNG });
    pruef("Ausstellen 503 SCHLUESSEL_FEHLT mit klarer Meldung", ohneS.status === 503 && ohneS.json?.code === "SCHLUESSEL_FEHLT" && /ZUGANG_SCHLUESSEL/.test(ohneS.json?.error ?? ""));
    const ohneSListe = await rufen("/chef/zugang-uebergabe", { keks: LEITUNG });
    pruef("Liste meldet „Schlüssel fehlt“ mit Grund", ohneSListe.json?.schluessel?.da === false && /ZUGANG_SCHLUESSEL/.test(ohneSListe.json?.schluessel?.grund ?? ""));
    const [{ n: nachOhne }] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_zugang_uebergaben WHERE ausgestellt_am >= ${startZeit}`) as any[];
    pruef("ohne Schlüssel wurde nichts gespeichert", nachOhne === 0);
    process.env.ZUGANG_SCHLUESSEL = SCHLUESSEL;

    // ═══════════════════════════════════════════════════════════════════════
    titel("B3  Ausstellen — Link + Code einmal, Tabelle ohne Klartext");
    // ═══════════════════════════════════════════════════════════════════════
    const a = await ausstellen();
    pruef("Ausstellen 200 mit Link und sechsstelligem Code", a.status === 200 && /\/zugang\/uebergabe#[A-Za-z0-9_-]{43}$/.test(a.json?.link ?? "") && /^\d{6}$/.test(a.code));
    pruef("Antwort: no-store", /no-store/.test(a.kopf.get("cache-control") ?? ""));
    const za = await zeile(a.id);
    pruef("Zeile: Chiffrat liegt, Form v1", /^v1\./.test(za.passwort_geheim ?? ""));
    pruef("Zeile: weder Passwort noch Token noch Code im Klartext", !!za.roh && !za.roh.includes(PASSWORT) && !za.roh.includes(a.token) && !za.roh.includes(`"${a.code}"`) && !new RegExp(`\\b${a.code}\\b`).test(za.roh));
    pruef("Zeile: token_hash = SHA-256 des Tokens", za.token_hash === lib.tokenHash(a.token));
    pruef("Zeile: gilt genau 48 Stunden", Math.abs(new Date(za.gueltig_bis).getTime() - new Date(za.ausgestellt_am).getTime() - 48 * 3600_000) < 2000);
    pruef("Zeile: Audit „ausgestellt von“ ohne Passwort", typeof za.ausgestellt_von_name === "string" && za.ausgestellt_von_stufe === "leitung");
    const fehlEingabe = await rufen("/chef/zugang-uebergabe", { koerper: daten({ passwort: " kurz" }), keks: LEITUNG });
    pruef("falsche Eingabe: 400 mit Feld, ohne Inhalt", fehlEingabe.status === 400 && fehlEingabe.json?.feld === "passwort" && !fehlEingabe.json?.error?.includes("kurz"));

    // ═══════════════════════════════════════════════════════════════════════
    titel("B4  Falscher Code ×3 → gesperrt, Passwort gelöscht");
    // ═══════════════════════════════════════════════════════════════════════
    routenMod.drosselLeeren();
    const st = await rufen("/zugang-uebergabe/stand", { koerper: { token: a.token } });
    pruef("Stand vor dem Code: offen, 3 Versuche, KEIN Name", st.status === 200 && st.json?.stand === "offen" && st.json?.rest === 3 && !JSON.stringify(st.json).includes("Erika"));
    pruef("Stand: X-Robots-Tag noindex, Referrer-Policy no-referrer", /noindex/.test(st.kopf.get("x-robots-tag") ?? "") && /no-referrer/.test(st.kopf.get("referrer-policy") ?? ""));
    const f1 = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: a.token, code: falscherCode(a.code) } });
    pruef("1. falscher Code: 401, noch 2", f1.status === 401 && f1.json?.rest === 2);
    const f2 = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: a.token, code: falscherCode(a.code) } });
    pruef("2. falscher Code: 401, noch 1", f2.status === 401 && f2.json?.rest === 1);
    const f3 = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: a.token, code: falscherCode(a.code) } });
    pruef("3. falscher Code: 410 gesperrt", f3.status === 410 && f3.json?.stand === "gesperrt");
    const zg = await zeile(a.id);
    pruef("Tabelle: Passwort gelöscht, gesperrt_am gesetzt, 3 Fehlversuche, Grund gesperrt", zg.passwort_geheim == null && !!zg.gesperrt_am && Number(zg.fehlversuche) === 3 && zg.geloescht_grund === "gesperrt");
    const fr = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: a.token, code: a.code } });
    pruef("danach der RICHTIGE Code: 410 gesperrt, kein Passwort", fr.status === 410 && fr.json?.stand === "gesperrt" && !JSON.stringify(fr.json).includes(PASSWORT));
    const fmt = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: a.token, code: "12a" } });
    pruef("falsch geformter Code: 400 (zählt nicht, verrät nichts)", fmt.status === 400);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B5  Richtiger Code → Anzeige → Bestätigen → gelöscht");
    // ═══════════════════════════════════════════════════════════════════════
    routenMod.drosselLeeren();
    const b = await ausstellen();
    const auf = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: b.token, code: b.code } });
    pruef("richtiger Code: 200 mit Passwort (die EINE Anzeige)", auf.status === 200 && auf.json?.anzeige?.passwort === PASSWORT);
    pruef("Anzeige: Vorname, Zugang, Anmeldeadresse, Google, Ansprechperson", auf.json?.anzeige?.vorname === "Erika" && auf.json?.anzeige?.anmeldeadresse === "mail.google.com" && auf.json?.anzeige?.google === true && auf.json?.anzeige?.ansprech?.name === "Max Muster");
    pruef("Anzeige: no-store, noindex", /no-store/.test(auf.kopf.get("cache-control") ?? "") && /noindex/.test(auf.kopf.get("x-robots-tag") ?? ""));
    const zb1 = await zeile(b.id);
    pruef("Audit: angesehen_am gesetzt, 1 Ansicht", !!zb1.angesehen_am && Number(zb1.ansichten) === 1);
    const auf2 = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: b.token, code: b.code } });
    const zb2 = await zeile(b.id);
    pruef("erneut öffnen (Neuladen): geht bis zur Bestätigung, 2 Ansichten, erstes „angesehen“ bleibt", auf2.status === 200 && Number(zb2.ansichten) === 2 && new Date(zb2.angesehen_am).getTime() === new Date(zb1.angesehen_am).getTime());
    const lb = await rufen("/chef/zugang-uebergabe", { keks: LEITUNG });
    const eintrag = (lb.json?.liste ?? []).find((x: any) => x.id === b.id);
    pruef("Chefbüro: Stand „angesehen“ mit Zeitpunkt", eintrag?.stand === "angesehen" && !!eintrag?.angesehenAm);
    pruef("Chefbüro-Liste: kein Passwort, kein Chiffrat, keine Prüfsumme", !lb.json || (!JSON.stringify(lb.json).includes(PASSWORT) && !/passwort_geheim|code_hmac|token_hash|"v1\./.test(JSON.stringify(lb.json))));
    const bf = await rufen("/zugang-uebergabe/bestaetigen", { koerper: { token: b.token, code: falscherCode(b.code) } });
    pruef("Bestätigen mit falschem Code: 401 (zählt als Versuch)", bf.status === 401 && bf.json?.rest === 2);
    const bok = await rufen("/zugang-uebergabe/bestaetigen", { koerper: { token: b.token, code: b.code } });
    pruef("Bestätigen: 200 mit Zeitpunkt, ohne Passwort", bok.status === 200 && !!bok.json?.bestaetigtAm && !JSON.stringify(bok.json).includes(PASSWORT));
    const zb3 = await zeile(b.id);
    pruef("Tabelle: Passwort gelöscht, bestaetigt_am, Grund bestaetigt", zb3.passwort_geheim == null && !!zb3.bestaetigt_am && zb3.geloescht_grund === "bestaetigt");
    const nach = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: b.token, code: b.code } });
    pruef("danach öffnen: 410 bestätigt, kein Passwort", nach.status === 410 && nach.json?.stand === "bestaetigt" && !JSON.stringify(nach.json).includes(PASSWORT));
    const lb2 = await rufen("/chef/zugang-uebergabe", { keks: LEITUNG });
    pruef("Chefbüro: „bestätigt am …“", (lb2.json?.liste ?? []).find((x: any) => x.id === b.id)?.stand === "bestaetigt");

    // ═══════════════════════════════════════════════════════════════════════
    titel("B6  Ablauf nach 48 Stunden — am Link und im Takt");
    // ═══════════════════════════════════════════════════════════════════════
    routenMod.drosselLeeren();
    const c1 = await ausstellen();
    await sqlPool`UPDATE fiaon_zugang_uebergaben SET gueltig_bis = NOW() - INTERVAL '1 minute' WHERE id = ${c1.id}`;
    const sc = await rufen("/zugang-uebergabe/stand", { koerper: { token: c1.token } });
    pruef("Link nach Ablauf: Stand abgelaufen", sc.status === 200 && sc.json?.stand === "abgelaufen");
    const zc = await zeile(c1.id);
    pruef("schon der Stand-Aufruf löscht das Passwort (Grund abgelaufen)", zc.passwort_geheim == null && zc.geloescht_grund === "abgelaufen");
    const oc = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: c1.token, code: c1.code } });
    pruef("richtiger Code nach Ablauf: 410 abgelaufen", oc.status === 410 && oc.json?.stand === "abgelaufen");
    const c2 = await ausstellen();
    await sqlPool`UPDATE fiaon_zugang_uebergaben SET gueltig_bis = NOW() - INTERVAL '1 second' WHERE id = ${c2.id}`;
    const geleert = await lib.abgelaufeneLoeschen();
    const zc2 = await zeile(c2.id);
    pruef("Takt (abgelaufeneLoeschen) leert ohne Aufruf des Links", geleert >= 1 && zc2.passwort_geheim == null && zc2.geloescht_grund === "abgelaufen");
    const c3 = await ausstellen();
    await sqlPool`UPDATE fiaon_zugang_uebergaben SET gueltig_bis = NOW() + INTERVAL '1 hour' WHERE id = ${c3.id}`;
    await lib.abgelaufeneLoeschen();
    pruef("Gegenprobe: eine noch gültige Übergabe bleibt unberührt", !!(await zeile(c3.id)).passwort_geheim);
    const lc = await rufen("/chef/zugang-uebergabe", { keks: LEITUNG });
    pruef("Chefbüro: „abgelaufen“", (lc.json?.liste ?? []).find((x: any) => x.id === c1.id)?.stand === "abgelaufen");

    // ═══════════════════════════════════════════════════════════════════════
    titel("B7  Neu ausstellen ersetzt — ein Zugang, ein gültiger Link");
    // ═══════════════════════════════════════════════════════════════════════
    routenMod.drosselLeeren();
    const zugangE = `pruef-${randomBytes(4).toString("hex")}@beispiel.test`;
    const e1 = await ausstellen({ zugang: zugangE });
    const e2 = await ausstellen({ zugang: zugangE.toUpperCase(), ersetzt: e1.id });
    const ze1 = await zeile(e1.id);
    pruef("alte Übergabe: Passwort gelöscht, Grund ersetzt, ersetzt_durch = neue", ze1.passwort_geheim == null && ze1.geloescht_grund === "ersetzt" && Number(ze1.ersetzt_durch_id) === e2.id);
    pruef("Antwort nennt die ersetzte Übergabe", (e2.json?.ersetzt ?? []).includes(e1.id));
    const oe1 = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: e1.token, code: e1.code } });
    pruef("alter Link mit richtigem Code: 410 ersetzt", oe1.status === 410 && oe1.json?.stand === "ersetzt");
    const oe2 = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: e2.token, code: e2.code } });
    pruef("neuer Link: 200", oe2.status === 200 && oe2.json?.anzeige?.passwort === PASSWORT);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B8  Zurückziehen");
    // ═══════════════════════════════════════════════════════════════════════
    const g = await ausstellen();
    const zz = await rufen(`/chef/zugang-uebergabe/${g.id}/zurueckziehen`, { koerper: {}, keks: LEITUNG });
    pruef("Zurückziehen: 200", zz.status === 200);
    const zg2 = await zeile(g.id);
    pruef("Tabelle: Passwort gelöscht, Grund zurückgezogen, von wem", zg2.passwort_geheim == null && zg2.geloescht_grund === "zurueckgezogen" && !!zg2.zurueckgezogen_von_name);
    const og = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: g.token, code: g.code } });
    pruef("Link danach: 410 zurückgezogen", og.status === 410 && og.json?.stand === "zurueckgezogen");
    const zz2 = await rufen(`/chef/zugang-uebergabe/${g.id}/zurueckziehen`, { koerper: {}, keks: LEITUNG });
    pruef("zweites Zurückziehen: 409 mit Klartext", zz2.status === 409 && !!zz2.json?.error);
    const zzOhne = await rufen(`/chef/zugang-uebergabe/${c3.id}/zurueckziehen`, { koerper: {} });
    pruef("Zurückziehen ohne Sitzung: 401", zzOhne.status === 401);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B9  Die Wände der Tabelle");
    // ═══════════════════════════════════════════════════════════════════════
    const wandTreffer = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (x: any) { return String(x?.code ?? "?"); } };
    pruef("Klartext in passwort_geheim: abgewiesen (23514)", await wandTreffer(() => sqlPool`UPDATE fiaon_zugang_uebergaben SET passwort_geheim = ${"erfunden-" + randomBytes(4).toString("hex")} WHERE id = ${c3.id}`) === "23514");
    pruef("bestätigt mit liegendem Passwort: abgewiesen (23514)", await wandTreffer(() => sqlPool`UPDATE fiaon_zugang_uebergaben SET bestaetigt_am = NOW() WHERE id = ${c3.id}`) === "23514");
    pruef("unbekannter Löschgrund: abgewiesen (23514)", await wandTreffer(() => sqlPool`UPDATE fiaon_zugang_uebergaben SET geloescht_grund = 'irgendwas' WHERE id = ${a.id}`) === "23514");
    pruef("Gegenprobe: ein echtes Chiffrat geht durch", await wandTreffer(() => sqlPool`UPDATE fiaon_zugang_uebergaben SET passwort_geheim = ${lib.passwortVerschluesseln("x".repeat(12), lib.tokenErzeugen(), Buffer.from(SCHLUESSEL, "base64"))} WHERE id = ${c3.id}`) === "");

    // ═══════════════════════════════════════════════════════════════════════
    titel("B10  Drossel je Anschluss — zusätzlich zu den 3 Versuchen je Link");
    // ═══════════════════════════════════════════════════════════════════════
    routenMod.drosselLeeren();
    const ip = "198.51.100.23";
    let letzte = 0;
    for (let i = 0; i < 10; i++) letzte = (await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: lib.tokenErzeugen(), code: "123456" }, ip })).status;
    pruef("10 Fehlversuche über fremde Links: jeweils 404", letzte === 404);
    const h = await ausstellen();
    const elf = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: h.token, code: h.code }, ip });
    pruef("11. Anfrage desselben Anschlusses: 429 — auch mit richtigem Code", elf.status === 429 && !!elf.json?.minuten);
    const anders = await rufen("/zugang-uebergabe/oeffnen", { koerper: { token: h.token, code: h.code }, ip: "198.51.100.99" });
    pruef("Gegenprobe: ein anderer Anschluss kommt durch", anders.status === 200);
    const zh = await zeile(h.id);
    pruef("die gedrosselte Anfrage hat am Link nichts gezählt", Number(zh.fehlversuche) === 0);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B11  Nie Klartext — Konsole, Chef-Protokoll, Antworten (außer der einen Anzeige)");
    // ═══════════════════════════════════════════════════════════════════════
    const anzeigeAntworten = antworten.filter((x) => x.pfad === "/zugang-uebergabe/oeffnen" && x.text.includes('"anzeige"'));
    const uebrige = antworten.filter((x) => !(x.pfad === "/zugang-uebergabe/oeffnen" && x.text.includes('"anzeige"')));
    pruef("Passwort steht in keiner anderen Antwort", uebrige.every((x) => !x.text.includes(PASSWORT)), uebrige.filter((x) => x.text.includes(PASSWORT)).map((x) => x.pfad).join(", "));
    pruef("… und in den Anzeige-Antworten genau dort (Positivprobe)", anzeigeAntworten.length >= 3 && anzeigeAntworten.every((x) => x.text.includes(PASSWORT)));
    const tokensUndCodes = Array.from(geheimnisse).filter((s) => s !== PASSWORT);
    pruef("Token und Codes stehen in keiner Antwort außer der Ausstell-Antwort", antworten.filter((x) => x.pfad !== "/chef/zugang-uebergabe" || !x.text.includes('"link"')).every((x) => tokensUndCodes.every((s) => s.length < 40 ? !new RegExp(`"${s}"`).test(x.text) : !x.text.includes(s))));
    const geheimImMitschnitt = Array.from(geheimnisse).filter((s) => mitschnitt.includes(s));
    pruef("Konsole/Ausgabe: weder Passwort noch Token noch Code", geheimImMitschnitt.length === 0, `${geheimImMitschnitt.length} Treffer`);
    const proto = (await sqlPool`SELECT COALESCE(string_agg(concat_ws('|', methode, pfad, ziel, notiz), E'\n'), '') AS t FROM fiaon_admin_log WHERE zeit >= ${startZeit}`) as any[];
    const protoText = String(proto[0]?.t ?? "");
    pruef("Chef-Protokoll: Einträge da (ausgestellt, zurückgezogen)", /zugang-uebergabe:\d+/.test(protoText) && /zurückgezogen/.test(protoText));
    pruef("Chef-Protokoll: ohne Passwort, Token, Code", Array.from(geheimnisse).every((s) => !protoText.includes(s)));
    const alle = (await sqlPool`SELECT COALESCE(string_agg(row_to_json(z)::text, E'\n'), '') AS t FROM fiaon_zugang_uebergaben z WHERE ausgestellt_am >= ${startZeit}`) as any[];
    const alleText = String(alle[0]?.t ?? "");
    pruef("Tabelle (alle Zeilen dieses Laufs): kein Passwort, kein Token im Klartext", !alleText.includes(PASSWORT) && tokensUndCodes.filter((s) => s.length > 40).every((s) => !alleText.includes(s)));
    pruef("Gegenprobe Scanner: ein Text MIT Passwort wird gefunden", `{"x":"${PASSWORT}"}`.includes(PASSWORT) && [`… ${PASSWORT} …`].some((t2) => t2.includes(PASSWORT)));
    const [{ offen }] = (await sqlPool`SELECT COUNT(*)::int AS offen FROM fiaon_zugang_uebergaben WHERE ausgestellt_am >= ${startZeit} AND passwort_geheim IS NOT NULL`) as any[];
    pruef("am Ende liegen nur noch Chiffrate offener Übergaben (keine abgeschlossenen)", Number(offen) >= 1);
  } finally {
    stop();
    server.close();
    // Die Prüf-Übergaben bleiben als Nachweis in der Wegwerf-Kopie; offene werden geleert.
    try { await sqlPool`UPDATE fiaon_zugang_uebergaben SET passwort_geheim = NULL, geloescht_am = NOW(), geloescht_grund = 'zurueckgezogen', zurueckgezogen_von_name = 'Prüfstand' WHERE passwort_geheim IS NOT NULL AND zugang LIKE 'pruef-%@beispiel.test'`; } catch { /* Wegwerf-Kopie */ }
    await sqlPool.end({ timeout: 5 });
  }
}

main()
  .catch((e) => { rot++; fehler.push(`Abbruch: ${String(e?.message ?? e).slice(0, 200)}`); echt.log(`ABBRUCH ${String(e?.message ?? e).slice(0, 200)}`); })
  .finally(() => {
    echt.log(`\n${"═".repeat(72)}\nZUGANG ÜBERGEBEN: ${ok} ok, ${rot} rot${rot ? `\n  - ${fehler.join("\n  - ")}` : ""}\n${"═".repeat(72)}`);
    process.exit(rot ? 1 : 0);
  });
