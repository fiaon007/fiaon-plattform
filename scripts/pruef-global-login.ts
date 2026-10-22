// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: FIAON GLOBAL — DER PERSÖNLICHE ZUGANG (E-423, 22.10.2026)
//
// Ohne Datenbank, ohne Netz, ohne Browser. Was sich rechnen und lesen lässt:
//   1  CODE: sechs Ziffern (führende Null bleibt), Eingabe mit Leerzeichen/Bindestrich,
//      zehn Minuten, fünf Versuche (der fünfte falsche sperrt — dann hilft auch der
//      richtige nicht), verbraucht, „neu senden“ nach 60 s und höchstens dreimal.
//   2  LINKS: Einladung und Passwort signiert, Ablauf, jede Manipulation (Konto,
//      Ablauf, Marke, Art, Signatur, fremdes Geheimnis) ungültig.
//   3  PASSWORT: Regeln und Stärke, Wiederholung.
//   4  KEINE AUFZÄHLBARKEIT: ein Satz für unbekannte Adresse und falsches Passwort,
//      „Passwort vergessen“ antwortet auf jedem Weg gleich, die Sperre gilt je Adresse
//      (bekannt oder nicht) — am Quelltext UND an der reinen Sperre.
//   5  DIE AUTOMATIK-WAND (E-301/E-272): die drei Zugangs-Mails sind ausgenommen,
//      eine Etappen-Mail an dieselbe Firmenkundin bleibt gesperrt (Gegenprobe).
//   6  VERDRAHTUNG: Register, Typ, Mailwerk, Pflichtmails, Motor de/en, App-Routen vor
//      /business/:slug, Server kennt die Wege (kein 404), Sitzungs-Cookie (httpOnly,
//      Lax, 30 Tage nur mit „angemeldet bleiben“, secure in der Produktion).
//   7  TEXTE: Mails und Seiten de/en durch die Wortregeln (Wand + Global, englische
//      Gegenprobe), Sie-Form, britisches Englisch, kein Code im Betreff.
//   8  TRENNUNG: der Zugang schreibt in keine Privatkunden-Tabelle, ruft weder Make
//      noch Mara noch den Postmeister; Code und Links nie im Klartext im Protokoll.
//   9  WEITERLEITUNG: nur Pfade der Business-Welt (kein offener Redirect).
//
// Aufruf: npx tsx scripts/pruef-global-login.ts            (Exit 1 bei Fehlern)
// Rotprobe: PRUEF_ROT=1 — verbiegt im Speicher die Code-Regel (fünf Versuche → sechs)
//           und die Wand-Ausnahme; dann MUSS der Lauf rot werden.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { join } from "node:path";

process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
delete process.env.BREVO_API_KEY; delete process.env.MAKE_WEBHOOK_URL;
const ROT = process.env.PRUEF_ROT === "1";
const WURZEL = join(import.meta.dirname, "..");
const lies = (p: string) => readFileSync(join(WURZEL, p), "utf8");

let fehler = 0; let n = 0;
const ok = (b: boolean, was: string, zusatz?: unknown) => { n++; if (!b) { fehler++; console.log(`  FEHLER  ${was}`, zusatz !== undefined ? JSON.stringify(zusatz).slice(0, 400) : ""); } };
const gleich = (a: unknown, b: unknown, was: string) => ok(JSON.stringify(a) === JSON.stringify(b), was, { ist: a, soll: b });
const abschnitt = (t: string) => console.log(`\n── ${t}`);

const G = await import("../shared/fiaon-global-konto");
const R = await import("../server/lib/fiaon-global-konto-regeln");
const K = await import("../server/lib/fiaon-global-konto");
const F = await import("../server/lib/fiaon-global-firma-post");
const { mailRendern, hatVorlage, VORLAGEN_EN } = await import("../server/mail/motor");
const { GLOBAL_KONTO_PAARE } = await import("../server/mail/vorlagen/global-konto");
const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
const { PFLICHTMAILS } = await import("../server/lib/fiaon-mail-frequenz");
const { globalWortPruefen, globalWortPruefenEn } = await import("../shared/fiaon-global-wortregeln");
const { GLOBAL_KONTO_WOERTER } = await import("../client/src/i18n/global-konto");
const { seiteUnbekannt } = await import("../server/lib/fiaon-seiten-seo");

// ── Rotprobe: die Regeln im Speicher verbiegen ──────────────────────────────
const VERSUCHE = ROT ? G.KONTO_CODE_VERSUCHE + 1 : G.KONTO_CODE_VERSUCHE;
const AUSGENOMMEN = ROT ? new Set(["global_zugang"]) : F.FIRMA_ANGEFORDERT;

// ═══ 1 · CODE ════════════════════════════════════════════════════════════════
abschnitt("1 · Code: sechs Ziffern, zehn Minuten, fünf Versuche, neu senden");
{
  const codes = Array.from({ length: 4000 }, () => R.kontoCodeErzeugen());
  ok(codes.every((c) => /^\d{6}$/.test(c)), "jeder Code hat genau sechs Ziffern");
  ok(codes.some((c) => c.startsWith("0")), "führende Null bleibt erhalten (bei 4000 Codes erwartet ~400)");
  ok(new Set(codes).size > 3900, "Codes wiederholen sich kaum (Zufall)");
  gleich(R.kontoCodeEingabe(" 123 456 "), "123456", "Eingabe mit Leerzeichen");
  gleich(R.kontoCodeEingabe("123-456"), "123456", "Eingabe mit Bindestrich");
  gleich(R.kontoCodeEingabe("12345"), null, "fünf Ziffern sind kein Code");
  gleich(R.kontoCodeEingabe("12345a"), null, "Buchstabe ist kein Code");
  const v = R.kontoVorgangErzeugen();
  ok(R.KONTO_VORGANG_MUSTER.test(v), "Vorgang: 43 Zeichen Base64-URL");
  ok(R.kontoVorgangHash(v) !== v && R.kontoVorgangHash(v).length === 64, "Vorgang wird nur als Hash gespeichert");
  const jetzt = Date.parse("2026-10-22T10:00:00Z");
  const zeile = (versuche = 0, extra: Record<string, unknown> = {}) => ({ code_hash: R.kontoCodeHash(v, "042137"), gueltig_bis: new Date(jetzt + G.KONTO_CODE_MINUTEN * 60_000), versuche, ...extra });
  ok(R.kontoCodeHash(v, "042137") !== R.kontoCodeHash(R.kontoVorgangErzeugen(), "042137"), "derselbe Code in einem anderen Vorgang hat einen anderen Hash");
  gleich(R.kontoCodeUrteil(zeile(), v, "042137", jetzt).urteil, "ok", "richtiger Code → ok");
  gleich(R.kontoCodeUrteil(zeile(), v, "042137", jetzt + 9 * 60_000 + 59_000).urteil, "ok", "nach 9:59 noch gültig");
  gleich(R.kontoCodeUrteil(zeile(), v, "042137", jetzt + 10 * 60_000).urteil, "abgelaufen", "nach genau 10 Minuten abgelaufen");
  // fünf falsche Versuche: rest 4,3,2,1 → beim fünften gesperrt
  const reste: (string | number)[] = [];
  for (let i = 0; i < VERSUCHE; i++) { const u = R.kontoCodeUrteil(zeile(i), v, "999999", jetzt); reste.push(`${u.urteil}:${u.rest}`); }
  gleich(reste, ["falsch:4", "falsch:3", "falsch:2", "falsch:1", "gesperrt:0"], "fünf falsche Versuche: der fünfte sperrt");
  gleich(R.kontoCodeUrteil(zeile(G.KONTO_CODE_VERSUCHE), v, "042137", jetzt).urteil, "gesperrt", "nach fünf Fehlversuchen hilft auch der richtige Code nicht");
  gleich(R.kontoCodeUrteil(zeile(0, { eingeloest_am: new Date() }), v, "042137", jetzt).urteil, "verbraucht", "eingelöst = verbraucht (kein zweites Mal)");
  gleich(R.kontoCodeUrteil(zeile(0, { verworfen_am: new Date() }), v, "042137", jetzt).urteil, "verbraucht", "verworfen = verbraucht");
  gleich(R.kontoCodeUrteil(zeile(), v, null, jetzt).urteil, "falsch", "leere Eingabe zählt als falsch");
  // neu senden
  const t0 = new Date(jetzt);
  gleich(R.kontoCodeNeuUrteil(t0, 0, jetzt + 30_000), { erlaubt: false, warten: 30, genug: false }, "neu senden nach 30 s: noch 30 s warten");
  gleich(R.kontoCodeNeuUrteil(t0, 0, jetzt + 60_000).erlaubt, true, "neu senden nach 60 s erlaubt");
  gleich(R.kontoCodeNeuUrteil(t0, 3, jetzt + 3600_000), { erlaubt: false, warten: 0, genug: true }, "nach drei neuen Codes ist Schluss");
}

// ═══ 2 · LINKS ═══════════════════════════════════════════════════════════════
abschnitt("2 · Links: Einladung (7 Tage) und Passwort (60 Minuten), signiert, einmal");
{
  const jetzt = Date.parse("2026-10-22T10:00:00Z");
  const nonce = R.kontoNonceErzeugen();
  const e = R.kontoLinkErzeugen("einladung", 42, nonce, G.KONTO_EINLADUNG_TAGE * 864e5, jetzt);
  const p = R.kontoLinkErzeugen("passwort", 42, nonce, G.KONTO_PASSWORT_LINK_MINUTEN * 60_000, jetzt);
  const pe = R.kontoLinkPruefen(e, jetzt + 1000);
  ok(pe.ok && pe.art === "einladung" && pe.kontoId === 42 && pe.nonce === nonce, "Einladung gültig", pe);
  const pp = R.kontoLinkPruefen(p, jetzt + 1000);
  ok(pp.ok && pp.art === "passwort", "Passwort-Link gültig", pp);
  gleich(R.kontoLinkPruefen(e, jetzt + 7 * 864e5 - 1000).ok, true, "Einladung am siebten Tag noch gültig");
  gleich(R.kontoLinkPruefen(e, jetzt + 7 * 864e5 + 1), { ok: false, grund: "abgelaufen" }, "Einladung nach sieben Tagen abgelaufen");
  gleich(R.kontoLinkPruefen(p, jetzt + 61 * 60_000), { ok: false, grund: "abgelaufen" }, "Passwort-Link nach 60 Minuten abgelaufen");
  const teile = e.split(".");
  const mit = (i: number, w: string) => { const x = [...teile]; x[i] = w; return x.join("."); };
  gleich(R.kontoLinkPruefen(mit(0, "p"), jetzt).ok, false, "Art getauscht (Einladung → Passwort) ungültig");
  gleich(R.kontoLinkPruefen(mit(1, "43"), jetzt).ok, false, "fremdes Konto ungültig");
  gleich(R.kontoLinkPruefen(mit(2, String(jetzt + 99 * 864e5)), jetzt).ok, false, "verlängerter Ablauf ungültig");
  gleich(R.kontoLinkPruefen(mit(3, R.kontoNonceErzeugen()), jetzt).ok, false, "andere Einmal-Marke ungültig");
  gleich(R.kontoLinkPruefen(mit(4, "A".repeat(32)), jetzt).ok, false, "falsche Signatur ungültig");
  gleich(R.kontoLinkPruefen("unsinn", jetzt), { ok: false, grund: "ungueltig" }, "Unsinn ungültig");
  const alt = process.env.SESSION_SECRET; process.env.SESSION_SECRET = "ein-anderes-geheimnis";
  gleich(R.kontoLinkPruefen(e, jetzt).ok, false, "mit einem anderen Server-Geheimnis ungültig");
  if (alt === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = alt;
  ok(!e.includes("@") && !/[A-Za-z]{3,}@/.test(e), "der Link trägt keine Adresse");
  gleich(K.kontoZugangPfad("de", "einladung", "e.1.2.abc.def"), "/business/zugang#e=e.1.2.abc.def", "das Geheimnis steht im Anker (#), nicht in der Abfrage");
  gleich(K.kontoZugangPfad("en", "passwort", "p.1.2.abc.def"), "/en/business/access#p=p.1.2.abc.def", "englischer Pfad");
  const altEnv = process.env.NODE_ENV; const altS = process.env.SESSION_SECRET;
  process.env.NODE_ENV = "production"; delete process.env.SESSION_SECRET; delete process.env.PORTAL_SESSION_SECRET;
  let warf = false; try { R.kontoGeheimnis(); } catch { warf = true; }
  ok(warf, "in der Produktion ohne SESSION_SECRET: lauter Fehler statt Ersatzgeheimnis");
  process.env.NODE_ENV = altEnv; if (altS !== undefined) process.env.SESSION_SECRET = altS;
}

// ═══ 3 · PASSWORT ════════════════════════════════════════════════════════════
abschnitt("3 · Passwort: Regeln, Stärke, Wiederholung");
{
  const b = (pw: string, k: { email?: string; wiederholung?: unknown } = {}) => G.passwortBewerten(pw, k);
  gleich(b("kurz").fehler, "zu_kurz", "unter zehn Zeichen");
  gleich(b("Passwort123!").fehler, "zu_einfach", "„Passwort123!“ ist zu bekannt");
  gleich(b("1234567890123").fehler, "zu_einfach", "nur Ziffern");
  gleich(b("aaaaaaaaaaaa").fehler, "zu_einfach", "ein Zeichen wiederholt");
  gleich(b("maxmuster77-Dresden", { email: "maxmuster77@beispiel.example" }).fehler, "enthaelt_email", "Adresse im Passwort");
  gleich(b("Sonnenuntergang 7 am Rhein", { wiederholung: "Sonnenuntergang 7 am rhein" }).fehler, "ungleich", "Wiederholung weicht ab");
  const gut = b("Sonnenuntergang 7 am Rhein", { email: "m@x.example", wiederholung: "Sonnenuntergang 7 am Rhein" });
  ok(gut.ok && gut.staerke === 4, "ein Satz mit Ziffer ist erlaubt und sehr stark", gut);
  ok(b("zehnzeiche").ok && b("zehnzeiche").staerke === 1, "zehn Kleinbuchstaben: erlaubt, schwach");
  ok(b("x".repeat(201)).fehler === "zu_lang", "über 200 Zeichen");
  for (const f of ["zu_kurz", "zu_lang", "zu_einfach", "enthaelt_email", "ungleich"] as const) {
    ok(!!G.KONTO_SAETZE.de.passwort[f] && !!G.KONTO_SAETZE.en.passwort[f], `Satz für ${f} in beiden Sprachen`);
  }
}

// ═══ 4 · KEINE AUFZÄHLBARKEIT ════════════════════════════════════════════════
abschnitt("4 · Keine Aufzählbarkeit: ein Satz, gleiche Sperre, gleiche Antwort");
{
  const quelle = lies("server/lib/fiaon-global-konto.ts");
  const anmelden = quelle.slice(quelle.indexOf("export async function kontoAnmelden"), quelle.indexOf("/** Schritt 2: der Code."));
  const falsch = Array.from(anmelden.matchAll(/return nein\((\d+), ([^,]+), "([a-z_]+)"\)/g)).map((m) => `${m[1]}|${m[2]}|${m[3]}`);
  ok(falsch.filter((x) => x.includes("anmeldungFalsch")).length === 2 && falsch.filter((x) => x.includes("anmeldungFalsch")).every((x) => x.startsWith("401|")),
    "Anmeldung: unbekannte Adresse/leere Eingabe und falsches Passwort enden im SELBEN Satz mit demselben Status", falsch);
  ok(!/kein[ e]Konto|nicht gefunden|unbekannt/i.test(anmelden.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")), "Anmeldung: kein Satz verrät, ob es die Adresse gibt");
  ok(/passwortPasst\(darf \? k!\.passwort_hash : attrappeHash\(\), passwort\)/.test(anmelden), "unbekannte Adresse rechnet denselben scrypt-Vergleich (keine Zeitmessung als Verrat)");
  ok(/sperre\.fehlversuch\(email\)/.test(anmelden) && anmelden.indexOf("sperre.gesperrt(email)") < anmelden.indexOf("kontoNachEmail(email)"), "Sperre je ADRESSE — geprüft, bevor das Konto gelesen wird");
  const vergessen = quelle.slice(quelle.indexOf("export async function kontoPasswortVergessen"), quelle.indexOf("/** Was die Seite „Zugang einrichten“"));
  const returns = Array.from(vergessen.matchAll(/return ([^;]+);/g)).map((m) => m[1].trim());
  ok(returns.length >= 3 && returns.every((r) => r === "antwort"), "„Passwort vergessen“ antwortet auf jedem Weg gleich", returns);
  // Die reine Sperre: bekannte und unbekannte Adresse verhalten sich gleich.
  const sp = R.kontoSperre();
  const t = Date.parse("2026-10-22T10:00:00Z");
  for (let i = 0; i < G.KONTO_FEHLVERSUCHE; i++) { sp.fehlversuch("gibt-es@nicht.example", t + i); sp.fehlversuch("kunde@firma.example", t + i); }
  ok(sp.gesperrt("gibt-es@nicht.example", t + 10) && sp.gesperrt("kunde@firma.example", t + 10), "nach fünf Fehlversuchen: beide Adressen gesperrt");
  ok(!sp.gesperrt("kunde@firma.example", t + G.KONTO_SPERRE_MINUTEN * 60_000 + 10), "nach 15 Minuten wieder frei");
  ok(G.KONTO_SAETZE.de.anmeldungFalsch === "E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie beides — oder legen Sie über „Passwort vergessen“ ein neues fest.", "Wortlaut des einen Satzes (de) buchstabengetreu");
  ok(G.KONTO_SAETZE.en.anmeldungFalsch === "Email address or password is incorrect. Please check both — or set a new one via “Forgotten password”.", "Wortlaut des einen Satzes (en) buchstabengetreu");
  ok(/Wenn zu dieser Adresse ein Zugang gehört/.test(G.KONTO_SAETZE.de.vergessenOk) && /If this address belongs to an account/.test(G.KONTO_SAETZE.en.vergessenOk), "„vergessen“: Antwort im Konjunktiv, nie „Mail verschickt“");
  const fenster = R.kontoFenster(3, 1000);
  ok(!fenster.zuViel("a", 1) && !fenster.zuViel("a", 2) && !fenster.zuViel("a", 3) && fenster.zuViel("a", 4) && !fenster.zuViel("a", 1100), "Fenster-Bremse: drei je Fenster, danach frei");
}

// ═══ 5 · AUTOMATIK-WAND ══════════════════════════════════════════════════════
abschnitt("5 · Die Automatik-Wand (E-301/E-272): Zugangs-Mails kommen IMMER an");
{
  const firmenAkte = { bestaetigungen: { firmenangebot: true } };
  for (const e of G.KONTO_MAILS) {
    ok(AUSGENOMMEN.has(e), `${e} steht in FIRMA_ANGEFORDERT (ausdrücklich ausgenommen)`);
    if (!ROT) ok((await F.firmaGlobalMailSperre(e, firmenAkte, "kundin@firma.example", "System (FIAON Global, Zugang)")) === false, `${e}: die Wand lässt die Automatik an eine Firmenkundin durch`);
  }
  ok((await F.firmaGlobalMailSperre("global_etappe", firmenAkte, "kundin@firma.example", "System")) === true, "Gegenprobe: eine Etappen-Mail an dieselbe Firmenkundin bleibt gesperrt");
  const quelle = lies("server/lib/fiaon-global-konto.ts");
  ok(/firmaGlobalMailSperre\(event, null, k\.email, von\)/.test(quelle), "kontoMailSenden fragt die Wand (fällt die Ausnahme weg, sperrt sie sichtbar statt still)");
  ok(/E-423[\s\S]{0,200}AUSDRÜCKLICH AUSGENOMMEN/.test(lies("server/lib/fiaon-global-firma-post.ts")), "Kommentar an der Wand erklärt die Ausnahme");
  for (const e of G.KONTO_MAILS) ok(PFLICHTMAILS.has(e), `${e} ist Pflichtmail (keine Frequenzbremse)`);
}

// ═══ 6 · VERDRAHTUNG ═════════════════════════════════════════════════════════
abschnitt("6 · Verdrahtung: Register, Typ, Mailwerk, Motor, Routen, Cookie");
{
  for (const e of G.KONTO_MAILS) {
    ok(MAKE_EVENT_REGISTRY.some((d: any) => d.type === e), `${e} im Register`);
    ok(new RegExp(`\\| "${e}"`).test(lies("server/make-webhook.ts")), `${e} im Typ MakeEventType`);
    ok(new RegExp(`\\n  ${e}: \\{`).test(lies("server/lib/fiaon-mail-events.ts")), `${e} im Mailwerk`);
    ok(hatVorlage(e) && !!VORLAGEN_EN[e], `${e}: deutsche und englische Vorlage im Motor`);
  }
  const app = lies("client/src/App.tsx");
  for (const r of ["/business/login", "/business/passwort-vergessen", "/business/zugang", "/business/konto"]) {
    ok(app.includes(`path="${r}"`) && app.indexOf(`path="${r}"`) < app.indexOf(`path="/business/:slug"`), `App.tsx: ${r} vor /business/:slug`);
    ok(!seiteUnbekannt(r), `Server kennt ${r} (kein 404)`);
  }
  for (const r of ["/en/business/login", "/en/business/forgot-password", "/en/business/access", "/en/business/account"]) {
    ok(app.includes(`path="${r}"`) && app.indexOf(`path="${r}"`) < app.indexOf(`path="/en/business/:slug"`), `App.tsx: ${r} vor /en/business/:slug`);
    ok(!seiteUnbekannt(r), `Server kennt ${r} (kein 404)`);
  }
  ok(/'\/business\/login', '\/business\/passwort-vergessen', '\/business\/zugang', '\/business\/konto'/.test(lies("server/routes.ts")), "die Seiten des Zugangs: noindex, kein Referrer, kein Zwischenspeicher");
  ok(/fiaon-global-konto'\);\n  app\.use\('\/api\/fiaon', fiaonGlobalKontoRoutes\.default\)/.test(lies("server/routes.ts")), "Routen gemountet");
  // Cookie
  const gesetzt: any[] = [];
  const res: any = { cookie: (name: string, wert: string, o: any) => gesetzt.push({ name, wert, o }), clearCookie: () => {} };
  K.kontoCookieSetzen(res, "x".repeat(43), true); K.kontoCookieSetzen(res, "y".repeat(43), false);
  const altEnv = process.env.NODE_ENV; process.env.NODE_ENV = "production"; K.kontoCookieSetzen(res, "z".repeat(43), true); process.env.NODE_ENV = altEnv;
  ok(gesetzt.every((g) => g.name === "fiaon_global_sitzung" && g.o.httpOnly === true && g.o.sameSite === "lax" && g.o.path === "/"), "Cookie: httpOnly, SameSite=Lax, Pfad /", gesetzt.map((g) => g.o));
  ok(gesetzt[0].o.maxAge === 30 * 864e5 && gesetzt[1].o.maxAge === undefined, "„angemeldet bleiben“ = 30 Tage, sonst bis der Browser schließt");
  ok(gesetzt[2].o.secure === true, "Produktion: nur über HTTPS");
  ok(lies("server/routes/fiaon-global-bereich.ts").includes("globalPortalZutritt") && lies("server/routes/fiaon-global.ts").includes("globalPortalZutritt"), "alle Portal-Routen (mein-auftrag UND auftrag/vertrag/rechnung) gehen durch dieselbe Tür");
  ok(!/function zutritt\(req: Request, res: Response\): string \| null/.test(lies("server/routes/fiaon-global-bereich.ts") + lies("server/routes/fiaon-global.ts")), "kein alter Nur-Token-Zutritt mehr");
  const tuer = lies("server/lib/fiaon-global-konto.ts");
  const z = tuer.slice(tuer.indexOf("export async function globalPortalZutritt"));
  ok(z.indexOf("kontoDarfRef") < z.indexOf("opts.vorschau") && z.indexOf("opts.vorschau") < z.indexOf("refAktivesKonto"), "Reihenfolge der Tür: Sitzung → Vorschau der Leitung → eingerichteter Zugang sperrt den Link");
  ok(/code: "anmelden"/.test(z) && /urteil === "gueltig" \? \{ email: aktiv\.email \}/.test(z), "eingerichteter Zugang: Link führt zur Anmeldung — Adresse nur bei gültigem Link");
}

// ═══ 7 · TEXTE ═══════════════════════════════════════════════════════════════
abschnitt("7 · Texte: Mails und Seiten durch die Wortregeln, Sie-Form, britisch");
{
  const platzhalter = (b: unknown) => Array.from(new Set(Array.from(JSON.stringify(b).matchAll(/\{\{params\.([a-z_0-9]+)\}\}/g), (m) => m[1]))).sort();
  gleich(Object.keys(GLOBAL_KONTO_PAARE).sort(), [...G.KONTO_MAILS].sort(), "drei Paare, genau die KONTO_MAILS");
  for (const e of G.KONTO_MAILS) {
    const paar = (GLOBAL_KONTO_PAARE as any)[e];
    gleich(platzhalter(paar.en), platzhalter(paar.de), `${e}: Platzhalter de/en`);
    gleich([paar.en.knopf?.url, paar.en.daten?.length, paar.en.absaetze.length], [paar.de.knopf?.url, paar.de.daten?.length, paar.de.absaetze.length], `${e}: Aufbau de/en`);
    ok(!/\{\{/.test(paar.de.titel + paar.en.titel), `${e}: kein Platzhalter im Titel`);
    ok(!/login_code/.test(paar.de.betreff + paar.en.betreff + paar.de.preheader + paar.en.preheader), `${e}: kein Code in Betreff oder Vorschauzeile (Sperrbildschirm)`);
    const def = MAKE_EVENT_REGISTRY.find((d: any) => d.type === e)!;
    for (const sprache of ["de", "en"] as const) {
      // Die Nutzlast entsteht in der Sprache des Kontos (kontoMailNutzlast) — englisch also mit englischer Anrede und englischem Anlass.
      const mail = mailRendern(e, { ...def.example, sprache, ...(sprache === "en" ? { anrede_zeile: "Dear Mr Muster", code_anlass: "for signing in", gueltig_text: "Thursday, 29 October 2026" } : {}) });
      ok(!!mail && mail.fehlend.length === 0, `${e}/${sprache}: rendert ohne Lücke`, mail?.fehlend);
      if (!mail) continue;
      ok(mail.html.includes("FIAON Global") && !/Bonität ist machbar/.test(mail.html), `${e}/${sprache}: Kopf/Fuß von FIAON Global`);
      ok(!/\{\{|\}\}|undefined|null/.test(mail.text), `${e}/${sprache}: kein Rest eines Platzhalters`);
      const ohneLinks = mail.text.replace(/https?:\/\/\S+/g, "");
      if (sprache === "de") {
        for (const tr of globalWortPruefen(ohneLinks)) ok(false, `${e}: WORTWAHL „${tr.treffer}“ — ${tr.hinweis}`);
        ok(/\b(Sie|Ihr|Ihre|Ihren)\b/.test(mail.text) && !/\b(du|dein|dir|dich)\b/i.test(mail.text), `${e}: Sie-Form`);
      } else {
        for (const tr of globalWortPruefenEn(ohneLinks)) ok(false, `${e}/en: WORTWAHL „${tr.treffer}“`);
        ok(!/\b(Ihre?|Sie|und|der|die|das)\b/.test(ohneLinks.replace(/FIAON LTD[\s\S]*$/, "")), `${e}/en: deutscher Rest`);
        ok(!/\b(color|center|authorize|organization)\b/i.test(ohneLinks), `${e}/en: amerikanische Schreibweise`);
      }
      if (e === "global_login_code") ok(mail.html.includes("482913") && !mail.betreff.includes("482913"), `${e}/${sprache}: Code im Text, nicht im Betreff`);
    }
  }
  // Seitentexte und Server-Sätze
  const flach = (o: unknown, pfad = ""): [string, string][] => {
    if (typeof o === "string") return [[pfad, o]];
    if (typeof o === "function") return [[pfad, String((o as any)("m•••••@beispiel.example", 3))], [pfad + "#1", String((o as any)(1))]];
    if (Array.isArray(o)) return o.flatMap((x, i) => flach(x, `${pfad}[${i}]`));
    if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => flach(v, pfad ? `${pfad}.${k}` : k));
    return [];
  };
  const de = [...flach(GLOBAL_KONTO_WOERTER.de, "seite"), ...flach(G.KONTO_SAETZE.de, "server")];
  const en = [...flach(GLOBAL_KONTO_WOERTER.en, "page"), ...flach(G.KONTO_SAETZE.en, "server")];
  for (const [pfad, text] of de) for (const tr of globalWortPruefen(text)) ok(false, `WORTWAHL (de) ${pfad}: „${tr.treffer}“ — ${tr.hinweis}`);
  for (const [pfad, text] of en) for (const tr of globalWortPruefenEn(text)) ok(false, `WORTWAHL (en) ${pfad}: „${tr.treffer}“`);
  for (const [pfad, text] of de) ok(!/\b(du|dein|deine|dich|dir)\b/i.test(text), `Sie-Form (de) ${pfad}`, text);
  for (const [pfad, text] of en) ok(!/\b(Ihre?|Sie|bitte|und)\b/.test(text), `kein Deutsch (en) ${pfad}`, text);
  for (const [pfad, text] of en) ok(!/\b(color|center|organization|authorize|canceled)\b/i.test(text), `britisches Englisch ${pfad}`, text);
  ok(de.length > 60 && de.length === en.length, `Textsammlung vollständig (de ${de.length}, en ${en.length})`);
  // Gegenprobe der Wortprüfung: Sie KANN anschlagen.
  ok(globalWortPruefen("Wir garantieren Ihnen den Zugang.").length > 0, "Gegenprobe: die Wortprüfung schlägt an");
}

// ═══ 8 · TRENNUNG ════════════════════════════════════════════════════════════
abschnitt("8 · Trennung vom Privatkundenbereich, nichts im Klartext im Protokoll");
{
  const quellen = ["server/lib/fiaon-global-konto.ts", "server/lib/fiaon-global-konto-regeln.ts", "server/routes/fiaon-global-konto.ts"].map(lies).join("\n");
  const code = quellen.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(!/(INSERT INTO|UPDATE|DELETE FROM)\s+(fiaon_persons|fiaon_applications|fiaon_contact_log|fiaon_login_links|fiaon_leads)\b/i.test(code), "schreibt in keine Privatkunden-Tabelle");
  ok(!/make-webhook|versendenUndProtokollieren|fiaon-mara|postmeister|whatsapp|kundenSitzungSetzen/i.test(code) && !/\bmailSenden\(/.test(code), "kein Make, kein Mailwerk-Handversand, keine Mara, kein Postmeister, keine Privatkunden-Sitzung");
  ok(/mailDirektSenden/.test(code), "Versand direkt über den Motor");
  ok(!/DELETE\s+FROM/i.test(code) && !/DROP\s+/i.test(code), "keine Hard-Deletes (beendet_am, verworfen_am, entfernt_am)");
  ok(/GEHEIME_FELDER = \["login_code", "einrichten_url", "passwort_url"\]/.test(quellen) && /payload\[f\] = "\[verborgen\]"/.test(quellen), "Code und Links werden im Mailprotokoll verborgen");
  delete process.env.GLOBAL_KONTO_PROTOKOLL_KLARTEXT;
  ok(K.kontoKlartextImProtokoll() === false, "Klartext im Protokoll: aus ohne Schalter");
  process.env.GLOBAL_KONTO_PROTOKOLL_KLARTEXT = "1";
  ok(K.kontoKlartextImProtokoll() === true, "Klartext nur mit Schalter UND 127.0.0.1 (Prüfstand)");
  const altEnv = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  ok(K.kontoKlartextImProtokoll() === false, "Klartext nie in der Produktion — auch mit Schalter");
  process.env.NODE_ENV = altEnv;
  const altDb = process.env.DATABASE_URL; process.env.DATABASE_URL = "postgres://x:y@dpg-xyz.frankfurt-postgres.render.com/fiaon";
  ok(K.kontoKlartextImProtokoll() === false, "Klartext nie gegen eine entfernte Datenbank");
  process.env.DATABASE_URL = altDb; delete process.env.GLOBAL_KONTO_PROTOKOLL_KLARTEXT;
  const nl = K.kontoMailNutzlast({ email: "a@b.example", anrede: "Herr", nachname: "<Muster>", name: "Max <Muster>", firma: null, sprache: "de" });
  ok(nl.anrede_zeile === "Guten Tag Herr &lt;Muster&gt;" && nl.kunde === "Max &lt;Muster&gt;", "Nutzlast entschärft HTML (Name ohne Firma → Name)", nl);
  gleich(K.kontoAnredeZeile({ anrede: "Frau", nachname: "Muster", name: "Anna Muster", sprache: "en" }), "Dear Ms Muster", "englische Anrede britisch (Ms, ohne Punkt)");
  const vorlagen = lies("server/mail/vorlagen/global-konto.ts");
  ok(!/\{\{params\.login_code\}\}[\s\S]{0,5}betreff/.test(vorlagen), "Code-Platzhalter nicht im Betreff");
  ok(/E-423[\s\S]{0,400}transaktional|TRANSAKTIONAL/i.test(vorlagen), "Vorlagen erklären: transaktional");
  // Der Kunde selbst bekommt nie die Mailbox eines anderen: die Einladung geht an die Adresse aus Angebot/Akte.
  ok(/kundeAusAuftrag\(ref\)/.test(lies("server/lib/fiaon-global-konto.ts")) && !/req\.body\?\.email[\s\S]{0,80}kontoEinrichtenAusPortal/.test(lies("server/routes/fiaon-global-konto.ts")), "Banner „Zugang einrichten“: Adresse aus der Akte, nie aus der Eingabe");
}

// ═══ 8b · NUR LINK ═══════════════════════════════════════════════════════════
abschnitt("8b · „Nur Link erzeugen“: keine Systemmail, aber Protokoll und Verlauf");
{
  const q = lies("server/lib/fiaon-global-konto.ts");
  const e = q.slice(q.indexOf("export async function einladungSenden"), q.indexOf("/** Vermerk im Verlauf jeder verknüpften Akte"));
  const nur = e.slice(e.indexOf("if (opts.nurLink)"), e.indexOf("const mail = await kontoMailSenden"));
  ok(nur.length > 0 && !/kontoMailSenden|mailDirektSenden/.test(nur) && /return \{ ok: true, grund: null, gueltigBis: bis\.toISOString\(\), link \}/.test(nur), "nurLink kehrt VOR jedem Mailversand mit dem Link zurück");
  ok(/ereignis: "einladung_link"/.test(nur) && /einladungImVerlauf\(/.test(nur), "nurLink: Anmeldeprotokoll und Verlauf (Akte/Angebot)");
  ok(/hat\("--nur-link"\)/.test(lies("scripts/global-zugang-einladen.ts")) && /EINLADUNGSLINK/.test(lies("scripts/global-zugang-einladen.ts")), "Skript: --nur-link gibt den Link aus");
  ok(/Nur Link erzeugen/.test(lies("client/src/components/admin/ChefGlobalZugaenge.tsx")) && /nurLink/.test(lies("server/routes/fiaon-global-konto.ts")), "Chefbüro: zweiter Knopf „Nur Link erzeugen“");
  ok(/\(agent\|admin\|chef\)\\\/\)\?global/.test(lies("server/index.ts")), "Antworten der Chefbüro-Wege (mit Link) nie im Zugriffslog");
  ok(/fassung NOT LIKE 'IA-KOOP-%'/.test(q) && /startsWith\("IA-KOOP-"\)/.test(q), "Kooperationsverträge werden nie mit dem Kundenzugang verknüpft (Partnerbereich bleibt getrennt)");
}

// ═══ 9 · WEITERLEITUNG ═══════════════════════════════════════════════════════
abschnitt("9 · Weiterleitung nur innerhalb der Business-Welt");
{
  const w = G.kontoWeiterSicher;
  gleich(w("/business/auftrag/FIAON-MB2XK4LQ-7T9A"), "/business/auftrag/FIAON-MB2XK4LQ-7T9A", "eigener Auftrag");
  gleich(w("/en/business/auftrag/FIAON-X1Y2"), "/en/business/auftrag/FIAON-X1Y2", "englisch");
  gleich(w("/business/konto"), "/business/konto", "Übersicht");
  for (const boese of ["//boese.example/business/konto", "https://boese.example", "/\\boese.example", "/business/../admin", "/admin", "/business/auftrag/x\"><script>", "javascript:alert(1)", "/business/auftrag/FIAON-1?t=1.2&x=<"]) {
    gleich(w(boese), null, `abgewiesen: ${boese}`);
  }
}

// ═══ CLIENT: Code-Felder ═════════════════════════════════════════════════════
abschnitt("Client: sechs Felder, Einfügen, Auto-Ausfüllen, Haken oben");
{
  const seite = lies("client/src/pages/business-konto.tsx");
  ok(/autoComplete=\{i === 0 \? "one-time-code" : "off"\}/.test(seite) && /inputMode="numeric"/.test(seite) && /onPaste=/.test(seite), "Code: one-time-code, Ziffernblock, Einfügen");
  ok(/felder\.current\[0\]\?\.focus\(\)/.test(seite), "Code: Fokus auf dem ersten Feld");
  ok(/history\.replaceState\(window\.history\.state, "", window\.location\.pathname\)/.test(seite), "Einladungslink verschwindet sofort aus der Adresszeile");
  ok(/sessionStorage/.test(seite) && !/\?email=/.test(seite), "Vorbelegung über sessionStorage, nie ?email= in der Adresse");
  const leiste = lies("client/src/components/site/GlobalKontoLeiste.tsx");
  ok(/zurGlobalAnmeldung/.test(lies("client/src/pages/business-auftrag.tsx")) && /code === "anmelden"/.test(lies("client/src/pages/business-auftrag.tsx")), "Portal: eingerichteter Zugang → Anmeldung");
  ok(/data-fiaon="global-konto-banner"/.test(leiste) && /data-fiaon="global-konto-leiste"/.test(leiste), "Leiste und Banner tragen Kennzeichen für den Browsertest");
  ok(!/global-portal\.tsx/.test(lies("client/src/pages/business-auftrag.tsx").match(/import .*GlobalKontoLeiste.*$/m)?.[0] ?? ""), "global-portal.tsx bleibt unberührt");
}

console.log(`\n${n - fehler} von ${n} Prüfungen bestanden${fehler ? ` — ${fehler} FEHLER` : ""}.${ROT ? " (Rotprobe)" : ""}`);
process.exit(fehler ? 1 : 0);
