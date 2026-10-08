// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-B (08.10.2026): KONTO & KARTE ERNEUT SENDEN · „WIRKSAM GEKÜNDIGT“
//
// IT-Feedback Punkt 2 und 11. Drei Teile:
//   1  OFFLINE — die eine Regel „wirksam gekündigt“ (shared/fiaon-kuendigung-regel.ts),
//      die Ausschlussregel des Links (shared/fiaon-karten-weg.ts), Phase, Drossel,
//      Kundentexte gegen die Wortwand.
//   2  QUELLTEXT — die Wege, die es nicht mehr geben darf (neue Zeile beim erneuten
//      Senden, gesendet_am vorrücken, window.confirm, Erneut-Zweig an der Funktion
//      vorbei), und dass Liste, Akte, Mara und Menü dieselbe Funktion nehmen.
//   3  DATENBANK (nur lokal, 127.0.0.1:54329) — echte Funktionen gegen eigene
//      Testzeilen (Personen 9480001–9480018, Mitarbeiter 948001–948003, Bestellungen
//      FIAON-ITB-…): Paar-Test TS gegen SQL, Liste ohne Gekündigte, erneut senden
//      (gleiche Zeile, gleicher Link, Drossel, Doppelklick, Adresse gesperrt,
//      gekündigt mit laufendem Vertrag), Nachfass-Zustände, kuendigungSetzen
//      nach Rücknahme, Portalsperre, Akten-Marke. Der Versand ist eine Attrappe
//      (KarteErneutHilfen.senden) — es geht keine Mail raus, kein Netz.
//      Testzeilen werden vorher und nachher entfernt (nur diese IDs).
//
//   Offline:  env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://x@127.0.0.1:1/x npx tsx scripts/pruef-it-b.ts
//   Mit DB:   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus \
//               DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_it_b?sslmode=require' npx tsx scripts/pruef-it-b.ts
//   Rotprobe: PRUEF_ROT=1 davor — verbiegt die Regel im Speicher; der Lauf MUSS rot enden.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

const URL_DB = String(process.env.DATABASE_URL || "");
const MIT_DB = /@127\.0\.0\.1:54329\//.test(URL_DB);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "DATABASE_URL_EXTERN", "OPENAI_API_KEY", "WHATSAPP_TOKEN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (URL_DB && !/@127\.0\.0\.1:\d+\//.test(URL_DB)) { console.error("ABBRUCH: DATABASE_URL muss lokal sein (127.0.0.1)."); process.exit(2); }
const ROT = process.env.PRUEF_ROT === "1";

let gruen = 0;
const roteListe: string[] = [];
function pruef(name: string, bedingung: unknown, detail?: unknown) {
  if (bedingung) { gruen++; console.log(`  ✓ ${name}`); }
  else { roteListe.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ""}`); }
}
const titel = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const regelMod = await import("../shared/fiaon-kuendigung-regel");
const weg = await import("../shared/fiaon-karten-weg");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
// Rotprobe: die Regel im Speicher verbiegen — eine gekündigte Auskunft zählt wieder als Kündigung.
const kuendigungsStand: typeof regelMod.kuendigungsStand = ROT
  ? (b) => ({ wirksam: b.some((x) => !!x.gekuendigt_am), am: null, ref: null })
  : regelMod.kuendigungsStand;
if (ROT) console.log("ROTPROBE: kuendigungsStand ist im Speicher verbogen — dieser Lauf MUSS rot werden.");

// ═════════════════════════════════════════════════════════════════════════
titel("1a · Die eine Regel „wirksam gekündigt“ (rein)");
// ═════════════════════════════════════════════════════════════════════════
const T = "2026-10-01T10:00:00Z";
const paket = (x: Record<string, unknown> = {}) => ({ ref: "FIAON-A", pack_key: "ultra", payment_status: "paid", merged_into: null, gekuendigt_am: null, ...x });
const auskunft = (x: Record<string, unknown> = {}) => ({ ref: "FIAON-SCHUFA-A", type: "schufa", pack_key: "schufa", payment_status: "paid", merged_into: null, gekuendigt_am: null, ...x });
const fall = (name: string, b: any[], soll: boolean) => {
  const s = kuendigungsStand(b);
  pruef(`${name} → ${soll ? "gekündigt" : "nicht gekündigt"}`, s.wirksam === soll, s);
};
fall("keine Kündigung", [paket()], false);
fall("Stufenpaket gekündigt, Vertrag läuft", [paket({ gekuendigt_am: T })], true);
fall("Kündigung zurückgenommen (gekuendigt_am wieder leer)", [paket({ gekuendigt_am: null })], false);
fall("Rücknahme, dann erneut gekündigt (alter Rücknahmetag steht noch)", [paket({ gekuendigt_am: T, kuendigung_zurueckgenommen_am: "2026-09-01T10:00:00Z" })], true);
fall("nur die Bonitätsauskunft gekündigt, Paket läuft (Fall 4919/11498)", [paket(), auskunft({ gekuendigt_am: T })], false);
fall("zwei Stufenpakete: altes gekündigt, neues bezahlt und ungekündigt", [paket({ ref: "FIAON-ALT", gekuendigt_am: T }), paket({ ref: "FIAON-NEU" })], false);
fall("zwei Stufenpakete: altes gekündigt, neues UNBEZAHLT", [paket({ ref: "FIAON-ALT", gekuendigt_am: T }), paket({ ref: "FIAON-NEU", payment_status: "pending_payment" })], true);
fall("Global-Bestellung gekündigt — keine Stufenpaket-Kündigung", [{ ref: "FIAON-G", pack_key: "global_struktur", payment_status: "paid", gekuendigt_am: T }], false);
fall("zusammengeführte (tote) Bestellung gekündigt", [paket({ merged_into: "FIAON-X", gekuendigt_am: T })], false);
fall("unbezahlte Bestellung storniert-gekündigt (Weg 1)", [paket({ payment_status: "cancelled", gekuendigt_am: T })], true);
{
  const s = regelMod.kuendigungsStand([paket({ ref: "R1", gekuendigt_am: "2026-09-01T00:00:00Z" }), paket({ ref: "R2", gekuendigt_am: T, payment_status: "cancelled" })]);
  pruef("die jüngste Kündigung trägt Tag und Bestellung", s.ref === "R2" && s.am === new Date(T).toISOString(), s);
}
pruef("Phase: ohne Kündigung „keine“", regelMod.kuendigungPhase(false, null, "2026-10-08") === "keine");
pruef("Phase: Ende offen (Jahresvertrag) „läuft bis zum Ende“", regelMod.kuendigungPhase(true, null, "2026-10-08") === "laeuft_bis_ende");
pruef("Phase: Ende in der Zukunft „läuft bis zum Ende“", regelMod.kuendigungPhase(true, "2026-10-27", "2026-10-08") === "laeuft_bis_ende");
pruef("Phase: Ende heute „läuft bis zum Ende“ (der Tag gilt noch)", regelMod.kuendigungPhase(true, "2026-10-08", "2026-10-08") === "laeuft_bis_ende");
pruef("Phase: Ende vorbei „beendet“", regelMod.kuendigungPhase(true, "2026-09-30", "2026-10-08") === "beendet");
pruef("SQL-Bausteine prüfen den Tabellenalias", (() => { try { regelMod.KUENDIGUNG_BESTELLUNG_SQL("a; DROP"); return false; } catch { return true; } })());
pruef("SQL-Regel liest nur gekuendigt_am (kein „zurückgenommen IS NULL“)", !/zurueckgenommen/.test(regelMod.KUENDIGUNG_WIRKSAM_SQL("p.id")));

// ═════════════════════════════════════════════════════════════════════════
titel("1b · Wer bekommt den Link — die Ausschlussregel (rein)");
// ═════════════════════════════════════════════════════════════════════════
const leer = { test: false, vertriebssperre: false, stufeMinus1: false, global: false, dsgvo: false, gekuendigt: false, storniert: false, hatEmail: true };
const code = (f: any, z: any) => weg.karteAusschluss({ ...leer, ...f }, z)?.code ?? null;
pruef("niemand ausgeschlossen → frei für jeden Zweck", ["liste", "automatik", "mara", "mensch"].every((z) => code({}, z) === null));
pruef("Reihenfolge: Testkonto vor Vertriebssperre", code({ test: true, vertriebssperre: true }, "liste") === "test");
pruef("Vertriebssperre sperrt auch den Menschen (die Mail-Tür lehnt sie ab: „Kontaktsperre“)", code({ vertriebssperre: true }, "mensch") === "vertriebssperre");
pruef("gekündigt sperrt Liste, Automatik und Mara", ["liste", "automatik", "mara"].every((z) => code({ gekuendigt: true }, z) === "gekuendigt"));
pruef("gekündigt, Vertrag läuft: der Mensch DARF (Justin, 08.10.)", code({ gekuendigt: true, phase: "laeuft_bis_ende" }, "mensch") === null);
pruef("gekündigt ohne bekannte Phase: der Mensch darf (Ende offen)", code({ gekuendigt: true }, "mensch") === null);
pruef("gekündigt, Vertrag beendet: auch der Mensch nicht — „Vertrag beendet“", code({ gekuendigt: true, phase: "beendet" }, "mensch") === "vertrag_beendet");
pruef("… und für die Liste ebenfalls „Vertrag beendet“", code({ gekuendigt: true, phase: "beendet" }, "liste") === "vertrag_beendet");
pruef("ohne E-Mail ist ein Ausschluss mit Satz", weg.karteAusschluss({ ...leer, hatEmail: false }, "mensch")?.text.includes("E-Mail") === true);
pruef("Global vor DSGVO vor gekündigt", code({ global: true, dsgvo: true, gekuendigt: true }, "liste") === "global" && code({ dsgvo: true, gekuendigt: true }, "liste") === "dsgvo");
{
  const a = weg.karteAusschluss({ ...leer, gekuendigt: true, gekuendigtAm: "2026-09-16T10:00:00Z", vertragEnde: "2026-09-30", phase: "beendet" }, "mensch");
  pruef("Satz nennt Kündigungstag und Vertragsende", !!a && a.text.includes("16.09.2026") && a.text.includes("30.09.2026"), a);
}
pruef("Hinweis bei laufendem Vertrag sagt „nur auf Wunsch“", (weg.karteHandHinweis({ ...leer, gekuendigt: true, phase: "laeuft_bis_ende", vertragEnde: "2026-10-27" }) ?? "").includes("ausdrücklich"));
pruef("kein Hinweis ohne Kündigung", weg.karteHandHinweis(leer) === null);
pruef("jeder Code hat Team- und Kundensatz", (Object.keys(weg.KARTE_AUSSCHLUSS_TEXT) as (keyof typeof weg.KARTE_AUSSCHLUSS_TEXT)[]).every((c) => !!weg.KARTE_AUSSCHLUSS_TEXT[c] && !!weg.KARTE_AUSSCHLUSS_KUNDE[c]));
pruef("Drossel aus einer Quelle: 3 am Tag, 15 Minuten", weg.KARTE_ERNEUT.maxProTag === 3 && weg.KARTE_ERNEUT.mindestAbstandMin === 15);
pruef("Zustellproblem: gesperrt, abgewiesen, Spam — nicht zugestellt/geklickt (ohne Grund die engere Lesart)", weg.zustellProblem("blockiert") && weg.zustellProblem("gebounct") && weg.zustellProblem("spam") && !weg.zustellProblem("zugestellt") && !weg.zustellProblem("geklickt") && !weg.zustellProblem(null));
pruef("Brevos Sperrgründe stehen in Worten", ["unsubscribedViaEmail", "hardBounce", "contactFlaggedAsSpam", "adminBlocked"].every((k) => !!weg.BREVO_SPERRGRUND_TEXT[k]));
pruef("Nachfass-Zustände: Reihenfolge Arbeit zuerst", weg.KARTE_NACHFASSEN_REIHENFOLGE[0] === "nicht_angekommen" && weg.KARTE_NACHFASSEN_REIHENFOLGE[3] === "frist");

// ═════════════════════════════════════════════════════════════════════════
titel("1c · Kundentexte gegen die Wortwand (Sie-Form, keine Zusage)");
// ═════════════════════════════════════════════════════════════════════════
const kundenTexte: [string, string][] = [["KARTE_ADRESSE_KUNDE", weg.KARTE_ADRESSE_KUNDE], ...Object.entries(weg.KARTE_AUSSCHLUSS_KUNDE).map(([k, v]) => [`KARTE_AUSSCHLUSS_KUNDE.${k}`, v] as [string, string])];
for (const [n, t] of kundenTexte) {
  const funde = wandPruefen(t).filter((f: any) => f.art === "verboten" || f.art === "zusage");
  pruef(`Wortwand: ${n}`, funde.length === 0, funde);
  pruef(`Sie-Form, kein Du: ${n}`, !/\b(du|dein|dir|dich)\b/i.test(t));
}
pruef("kein „kostenlos“/„Affiliate“ in den neuen Sätzen", ![...kundenTexte.map((x) => x[1]), ...Object.values(weg.KARTE_AUSSCHLUSS_TEXT), weg.KARTE_ADRESSE_HINWEIS].some((t) => /affiliate|kostenlos/i.test(t)));

// ═════════════════════════════════════════════════════════════════════════
titel("1d · Nachbesserung Gegenprüfung: von Hand, Kundensätze, Rückläufer, Leitung (rein)");
// ═════════════════════════════════════════════════════════════════════════
// Befund 3/9: Einstufung −1 und Storno sperren den Menschen nicht (Basis), die Vertriebssperre schon (Mail-Tür).
pruef("Einstufung −1 sperrt Liste, Automatik und Mara — NICHT den Menschen", ["liste", "automatik", "mara"].every((z) => code({ stufeMinus1: true }, z) === "stufe_minus1") && code({ stufeMinus1: true }, "mensch") === null);
pruef("Storno (Telefonkartei) sperrt Liste, Automatik und Mara — NICHT den Menschen", ["liste", "automatik", "mara"].every((z) => code({ storniert: true }, z) === "storniert") && code({ storniert: true }, "mensch") === null);
pruef("KARTE_NUR_VON_HAND = Einstufung −1 und Storno", weg.KARTE_NUR_VON_HAND.join(",") === "stufe_minus1,storniert");
pruef("Storno + Vertrag beendet: auch von Hand „Vertrag beendet“", code({ storniert: true, gekuendigt: true, phase: "beendet" }, "mensch") === "vertrag_beendet");
{
  // Jeder Kundensatz, der „auf Wunsch“ verspricht, darf nur stehen, wo der Mensch schicken DARF — alle Kombinationen.
  const schalter = ["test", "vertriebssperre", "stufeMinus1", "global", "dsgvo", "gekuendigt", "storniert"] as const;
  let falsch: any[] = []; let gezaehlt = 0;
  for (let m = 0; m < 1 << schalter.length; m++) {
    for (const phase of ["laeuft_bis_ende", "beendet"] as const) {
      for (const hatEmail of [true, false]) {
        const f: any = { ...leer, hatEmail, phase };
        schalter.forEach((k, i) => { f[k] = !!(m & (1 << i)); });
        const satz = weg.karteKundeSatz(f);
        gezaehlt++;
        if (satz && /auf Wunsch/.test(satz) && weg.karteAusschluss(f, "mensch")) falsch.push(f);
        if (f.gekuendigt && phase === "beendet" && satz && /auf Wunsch/.test(satz)) falsch.push({ beendet: f });
      }
    }
  }
  pruef(`Kundensatz „auf Wunsch“ nur, wo der Mensch schicken darf (${gezaehlt} Kombinationen)`, falsch.length === 0, falsch.slice(0, 3));
}
pruef("Vertriebssperre + gekündigt, Vertrag läuft: Kundensatz ohne Versprechen", !/auf Wunsch/.test(String(weg.karteKundeSatz({ ...leer, vertriebssperre: true, gekuendigt: true, phase: "laeuft_bis_ende" }))));
pruef("Vertriebssperre + gekündigt, Vertrag beendet: der Kunde liest „Vertrag beendet“ (12 Fälle in der Produktion)", weg.karteKundeSatz({ ...leer, vertriebssperre: true, gekuendigt: true, phase: "beendet" }) === weg.KARTE_AUSSCHLUSS_KUNDE.vertrag_beendet);
pruef("Einstufung −1 + gekündigt (läuft): der Kunde liest den Kündigungssatz", weg.karteKundeSatz({ ...leer, stufeMinus1: true, gekuendigt: true, phase: "laeuft_bis_ende" }) === weg.KARTE_AUSSCHLUSS_KUNDE.gekuendigt);
pruef("kein Ausschluss: kein Kundensatz", weg.karteKundeSatz(leer) === null);
pruef("Hinweis neben dem Knopf: Einstufung −1 nennt den Grund und „ausdrücklich“", /Einstufung −1/.test(String(weg.karteHandHinweis({ ...leer, stufeMinus1: true }))) && /ausdrücklich/.test(String(weg.karteHandHinweis({ ...leer, stufeMinus1: true }))));
pruef("Hinweis: Storno", /Telefonkartei storniert/.test(String(weg.karteHandHinweis({ ...leer, storniert: true }))));
pruef("Hinweis: keiner, wenn auch der Mensch nicht darf (Vertriebssperre)", weg.karteHandHinweis({ ...leer, vertriebssperre: true, gekuendigt: true }) === null);

// Fertigstellung: Mara an der Tagesgrenze — kein „gerade erst“, Sie-Form, Wortwand grün.
{
  const satz = weg.karteHeuteSchonSatz(" an m***@web.de");
  pruef("Tagesgrenze: „heute bereits“, Spam-Ordner, kein „gerade erst“, Adresse im Satz", /heute bereits/.test(satz) && /Spam-Ordner/.test(satz) && !/gerade erst/.test(satz) && /an m\*\*\*@web\.de/.test(satz));
  const w = wandPruefen(satz).filter((f: any) => f.art === "verboten" || f.art === "zusage");
  pruef("Tagesgrenze: Satz besteht die Wortwand (nichts Verbotenes, keine Zusage)", w.length === 0, w);
}

// Befund 6: weiche Rückläufer — echte Antworten aus der Produktion (08.10., 90 Tage, nur lesend).
const WEICH = [
  "452-4.2.2 The recipient's inbox is out of storage space. Please direct the 452-4.2.2 recipient to 452 4.2.2 https://support.google.com/mail/",
  "552-Requested mail action aborted: exceeded storage allocation 552-Quota exceeded. 552 For explanation visit https://postmaster.gmx.net/en/c",
  "connection timeout", "552 5.2.2 <a@icloud.com>: user is over quota",
  "450-Requested mail action not taken: mailbox unavailable 450 For explanation visit https://postmaster.gmx.net/en/case?c=r1602",
  "550-(grey defer DKIMr) 550-Your IP: 77.32.148.23 550-Mailhost: mailin28.t-online.de",
  "451 4.7.1 The email server [77.32.148.25] is being temporarily rate-limited due to a poor reputation.",
  "mailbox full", "522 5.7.1 <a@tutanota.com>: Recipient address rejected: Recipient mailbox full", "connection closed by recipient's server",
  "550 5.2.2 <a@aon.at>: Recipient address rejected: <a@aon.at> Quota exceeded",
];
const HART = [
  "550-5.1.1 The email account that you tried to reach does not exist. Please try 550-5.1.1 double-checking",
  "Unable to find MX of domain gogle.com", "Invalid MX of domain [MX issue]", "552 1 Requested mail action aborted, mailbox not found",
  "550 5.1.1 <a@icloud.com>: user does not exist", "553 a@b.management... Recipient-User must exist", "550 5.1.6 user no longer on system:a@icloud.com",
  "550 5.1.1 <a@abv.bg>: Recipient address rejected: User unknown in virtual mailbox table 421 4.7.0 pmx.abv.bg Error: too many errors",
  "550-Requested action not taken: mailbox unavailable 550 For explanation visit https://postmaster.web.de/en/case?c=r1601",
  "Message delivery failed", "", "554 5.7.1 Spam message rejected",
];
pruef(`weiche Rückläufer erkannt (${WEICH.length})`, WEICH.every((g) => weg.ruecklaeuferWeich(g)), WEICH.filter((g) => !weg.ruecklaeuferWeich(g)));
pruef(`endgültige oder unklare Rückläufer bleiben ein Problem (${HART.length})`, HART.every((g) => !weg.ruecklaeuferWeich(g)), HART.filter((g) => weg.ruecklaeuferWeich(g)));
pruef("zustellProblem: weicher Rückläufer mit Grund → kein Problem; ohne Grund → Problem", !weg.zustellProblem("gebounct", WEICH[0]) && weg.zustellProblem("gebounct") && weg.zustellProblem("gebounct", null) && weg.zustellProblem("gebounct", HART[0]));
pruef("zustellProblem: gesperrt/Spam bleiben Problem, auch mit „weichem“ Text", weg.zustellProblem("blockiert", WEICH[0]) && weg.zustellProblem("spam", WEICH[2]));
pruef("ZUSTELL_PROBLEM_SQL baut aus denselben Mustern", (() => { const q = weg.ZUSTELL_PROBLEM_SQL("z", "g"); return q.includes(weg.RUECKLAEUFER_WEICH_MUSTER) && q.includes(weg.RUECKLAEUFER_HART_MUSTER) && /'blockiert', 'spam'/.test(q); })());

// Befund 12: Sperre mit richtiger Adresse → Leitung.
pruef("abgemeldet: Hinweis „Adresse stimmt“, Leitung, nie automatisch", (() => { const h = weg.karteAdresseHinweis("blockiert", "unsubscribedViaEmail"); return /stimmt vermutlich/.test(h) && /An die Leitung: Sperre prüfen/.test(h) && /nie/.test(h); })());
pruef("Spam-Meldung: Leitung oder andere Adresse", /An die Leitung: Sperre prüfen/.test(weg.karteAdresseHinweis("spam", "contactFlaggedAsSpam")));
pruef("gesperrt ohne bekannten Grund: prüfen, sonst Leitung", /An die Leitung: Sperre prüfen/.test(weg.karteAdresseHinweis("blockiert", null)));
pruef("endgültiger Rückläufer: Adresse ändern (kein Leitungs-Knopf)", weg.karteAdresseHinweis("gebounct", "hardBounce") === weg.KARTE_ADRESSE_HINWEIS && !weg.karteSperreLeitungMoeglich("gebounct", true));
pruef("Leitungs-Knopf nur bei einer Sperre, die ein Problem ist", weg.karteSperreLeitungMoeglich("blockiert", true) && weg.karteSperreLeitungMoeglich("spam", true) && !weg.karteSperreLeitungMoeglich("blockiert", false));
pruef("brevoAbmeldung: unsubscribedViaEmail/ViaMA/ViaApi ja, hardBounce nein", ["unsubscribedViaEmail", "unsubscribedViaMA", "unsubscribedViaApi"].every((c) => weg.brevoAbmeldung(c)) && !weg.brevoAbmeldung("hardBounce") && !weg.brevoAbmeldung(null));

// Befund 13: die Ausnahme „neuer Antrag nach der Kündigung“ als Schalter der EINEN Regel.
{
  const opt = { neuerAntragSchlaegt: true };
  const K = (x: Record<string, unknown> = {}) => paket({ ref: "K", gekuendigt_am: "2026-09-01T10:00:00Z", created_at: "2026-08-01T10:00:00Z", ...x });
  const neu = paket({ ref: "N", payment_status: "pending_payment", created_at: "2026-09-05T10:00:00Z" });
  pruef("Schalter: späterer Paketantrag hebt die Kündigung auf (Lesart der Mail-Tür) — ohne Schalter nicht",
    !regelMod.kuendigungsStand([K(), neu], opt).wirksam && regelMod.kuendigungsStand([K(), neu]).wirksam);
  pruef("Schalter: eine spätere Bonitätsauskunft hebt nichts auf", regelMod.kuendigungsStand([K(), auskunft({ created_at: "2026-09-05T10:00:00Z" })], opt).wirksam);
  pruef("Schalter: die gekündigte Bestellung selbst zählt nie als „neuer Antrag“ (angelegt nach ihrem eigenen Kündigungstag — Altbestand)",
    regelMod.kuendigungsStand([K({ created_at: "2026-09-10T10:00:00Z" })], opt).wirksam);
  pruef("Schalter: eine zusammengeführte (tote) Bestellung zählt nicht als neuer Antrag", regelMod.kuendigungsStand([K(), { ...neu, merged_into: "K" }], opt).wirksam);
  pruef("Schalter: Antrag VOR der Kündigung hebt nichts auf", regelMod.kuendigungsStand([K(), paket({ ref: "N", payment_status: "pending_payment", created_at: "2026-08-15T10:00:00Z" })], opt).wirksam);
  pruef("SQL-Schalter baut die Ausnahme (kr_n), ohne Schalter nicht", /kr_n/.test(regelMod.KUENDIGUNG_WIRKSAM_SQL("p.id", opt)) && !/kr_n/.test(regelMod.KUENDIGUNG_WIRKSAM_SQL("p.id")));
}

// Befund 1/4/7/8: Worauf ein nie gebuchter Antrag gebucht wird (antragZiel, rein).
{
  const B = (ref: string, x: Record<string, unknown> = {}) => ({ ref, pack_key: "ultra", pack_name: "FIAON Ultra", payment_status: "paid", merged_into: null, gekuendigt_am: null, created_at: "2026-07-01T10:00:00Z", ...x });
  const A = { ref: "R1", am: "2026-08-01T10:00:00Z" };
  const z1 = regelMod.antragZiel(A, [B("R1")]);
  pruef("Antrag auf das laufende Paket: genau dieses, buchbar", z1.ziel === "R1" && z1.buchbar && !z1.umgezogen, z1);
  const z2 = regelMod.antragZiel(A, [B("R1"), B("R2", { created_at: "2026-08-10T10:00:00Z" })]);
  pruef("… danach kam ein neues Paket: die Leitung entscheidet (Vorschlag: das alte)", !z2.buchbar && z2.ziel === "R1" && /neues Paket/.test(z2.satz), z2);
  const z3 = regelMod.antragZiel(A, [B("R1", { merged_into: "R2", payment_status: "pending" }), B("R2", { created_at: "2026-07-02T10:00:00Z" })]);
  pruef("Antrag auf eine zusammengeführte Doppelbestellung: gebucht wird ihre Fortsetzung (#48)", z3.ziel === "R2" && z3.buchbar && z3.umgezogen && /zusammengeführt/.test(z3.satz), z3);
  const z4 = regelMod.antragZiel({ ref: "D", am: "2026-08-01T10:00:00Z" }, [
    B("D", { merged_into: "X", payment_status: "cancelled", gekuendigt_am: "2026-08-01T10:00:00Z", created_at: "2026-07-30T10:00:00Z" }),
    B("X", { created_at: "2026-07-30T11:00:00Z" })]);
  pruef("#114: Kündigung auf der toten Doppelbestellung gebucht — das bezahlte Paket ist das Ziel", z4.ziel === "X" && z4.buchbar && z4.umgezogen, z4);
  const z5 = regelMod.antragZiel(A, [B("R1", { payment_status: "cancelled" }), B("R2", { created_at: "2026-08-20T10:00:00Z", payment_status: "claimed_paid" })]);
  pruef("12363: Antrag auf storniertes Paket, neues danach — kein Ziel, nie die neue Bestellung, Leitung", z5.ziel === null && !z5.buchbar && /neues Paket/.test(z5.satz) && !/Vorschlag/.test(z5.satz), z5);
  const z6 = regelMod.antragZiel({ ref: "WEG", am: "2026-08-01T10:00:00Z" }, [B("X")]);
  pruef("Referenz gibt es nicht mehr (#29-Art): das eine Paket am Eingangstag, buchbar", z6.ziel === "X" && z6.buchbar && z6.umgezogen && /gibt es nicht mehr/.test(z6.satz), z6);
  const z7 = regelMod.antragZiel(A, [B("R1", { payment_status: "cancelled" }), B("X1", { payment_status: "pending_payment", created_at: "2026-07-20T10:00:00Z" }), B("X2")]);
  pruef("zwei Pakete am Eingangstag: Leitung, Vorschlag das bezahlte", !z7.buchbar && z7.ziel === "X2" && /mehrere Pakete/.test(z7.satz), z7);
  const z8 = regelMod.antragZiel(A, [B("R1", { merged_into: "R2", payment_status: "pending" }), B("R2", { created_at: "2026-08-05T10:00:00Z" })]);
  pruef("Fortsetzung, die erst NACH dem Antrag entstand (3499-Art): kein Ziel, Leitung", z8.ziel === null && !z8.buchbar, z8);
  pruef("kündbar: nur lebendes, ungekündigtes, nicht storniertes/abgelöstes/archiviertes Stufenpaket",
    regelMod.bestellungKuendbar(B("a")) && !regelMod.bestellungKuendbar(B("a", { payment_status: "superseded" })) && !regelMod.bestellungKuendbar(B("a", { payment_status: "cancelled" }))
    && !regelMod.bestellungKuendbar(B("a", { archived_at: T })) && !regelMod.bestellungKuendbar(auskunft()) && !regelMod.bestellungKuendbar(B("a", { gekuendigt_am: T })) && !regelMod.bestellungKuendbar(B("a", { merged_into: "b" })));
  pruef("Liste der Anträge: Rücknahme danach, wirksam gekündigt und „nichts zu kündigen“ stehen in der einen SQL", (() => { const q = regelMod.KUENDIGUNG_ANTRAEGE_SQL; return /kuendigung_zurueckgenommen_am >= kr_c\.created_at/.test(q) && /NOT \(\s*EXISTS/.test(q.replace(/\n/g, " ")) && /kr_k/.test(q) && /merged_into IS NOT NULL/.test(q); })());
}

// ═════════════════════════════════════════════════════════════════════════
titel("2 · Quelltext — keine zweiten Wege");
// ═════════════════════════════════════════════════════════════════════════
{
  const kk = quelle("server/lib/fiaon-konto-karte.ts");
  const rumpf = (f: string, kopf: string) => { const a = f.indexOf(kopf); if (a < 0) return ""; const n = f.indexOf("\nexport ", a + kopf.length); const m = f.indexOf("\nasync function ", a + kopf.length); const e = [n, m].filter((x) => x > 0); return f.slice(a, e.length ? Math.min(...e) : undefined); };
  const erneut = rumpf(kk, "export async function karteEinladungErneut(");
  const schicken = rumpf(kk, "async function einladungSchicken(");
  const mara = rumpf(kk, "export async function karteEinladungFuerPerson(");
  pruef("karteEinladungErneut legt NIE eine Zeile an", erneut.length > 0 && !/INSERT INTO fiaon_konto_karte/.test(erneut));
  pruef("… und rückt gesendet_am nicht vor", !/gesendet_am\s*=/.test(erneut));
  pruef("… baut den Link mit dem Mitarbeiter der Zeile (agent_id), nicht mit dem Klickenden", /partnerLink\(kopf, zeile\.agent_id/.test(erneut));
  pruef("… beansprucht die Zeile vor dem Versand (bedingtes UPDATE) und gibt sie bei Fehlern zurück", /UPDATE fiaon_konto_karte SET zuletzt_erneut_am = NOW\(\)/.test(erneut) && /zuletzt_erneut_am = \(\$\{vorher\}::text\)::timestamptz/.test(erneut));
  pruef("… prüft die Adresse vor dem Versand (keine Mail an Gesperrte, kein Entsperren)", erneut.indexOf("zustellLage(") > 0 && erneut.indexOf("zustellLage(") < erneut.indexOf("senden({") && !/brevoSperreAufheben/.test(kk));
  pruef("einladungSchicken kennt keinen Erneut-Zweig mehr", schicken.length > 0 && !/erneut/.test(schicken.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")) && !/gesendet_am = NOW\(\)/.test(schicken));
  pruef("Mara schickt erneut über karteEinladungErneut, zuerst über einladungSchicken", /karteEinladungErneut\(/.test(mara) && /einladungSchicken\(/.test(mara));
  pruef("bereiteKunden filtert mit der Ausschlussregel", /karteAusschlussSql\("x\.person_id"\)/.test(rumpf(kk, "export async function bereiteKunden(")));
  pruef("die Automatik hält gesperrte Adressen VOR dem Deckel zurück", /ADRESSE_PROBLEM_SQL\("p\.id"\)/.test(rumpf(kk, "export async function einladungenAutomatisch(")));
  const route = quelle("server/routes/fiaon-agent-kunden.ts");
  const senden = route.slice(route.indexOf('router.post("/agent/karte/:personId/senden"'), route.indexOf('router.get("/agent/karte/bereit/liste"'));
  pruef("Route senden: der Erneut-Fall geht an karteEinladungErneut", /karteEinladungErneut\(personId/.test(senden));
  pruef("Route senden: genau EIN INSERT (Erstversand), hinter der Versandsperre", (senden.match(/INSERT INTO fiaon_konto_karte/g) || []).length === 1 && senden.indexOf("karteVersandSperre(") < senden.indexOf("INSERT INTO fiaon_konto_karte"));
  pruef("Routen GET …/einladung und POST …/erneut mit darfAnKunde", /router\.get\("\/agent\/karte\/:personId\/einladung"[\s\S]{0,700}darfAnKunde/.test(route) && /router\.post\("\/agent\/karte\/:personId\/erneut"[\s\S]{0,700}darfAnKunde/.test(route));
  pruef("Liste „bereit“ liefert die Nachfass-Fälle", /karteNachfassen\(\{ agentId: req\.agent!\.id/.test(route));
  const menue = quelle("server/routes/fiaon-mail.ts");
  pruef("Sende-Menü (Mitarbeiter UND Verwaltung) nimmt für die Karte denselben Weg", (menue.match(/await karteMenueVersand\(personId/g) || []).length === 2);
  const komp = quelle("client/src/components/agent/KontoKarteAkte.tsx");
  pruef("Akte: Knopf „E-Mail erneut senden“, Nachfrage in der Seite, kein window.confirm", /E-Mail erneut senden/.test(komp) && !/window\.confirm\(/.test(komp) && /\/erneut`/.test(komp));
  pruef("Akte: Adresse, Zustellung und Verlauf stehen im Kasten", /kk2-adresse/.test(komp) && /Alle Versände/.test(komp) && /An diese Adresse kommt nichts an/.test(komp));
  const pipe = quelle("client/src/pages/agent/pipeline.tsx");
  pruef("Akte: Kasten in „Sein Antrag“ UND Zeile im Überblick", /<KontoKarteAkte /.test(pipe) && /<KontoKarteKurz /.test(pipe) && !/function KontoKarte\(/.test(pipe));
  const rg = quelle("client/src/pages/agent/rundgaenge.ts");
  pruef("Rundgänge nachgezogen (erneut senden, nachfassen)", /E-Mail erneut senden/.test(rg) && /Konto & Karte nachfassen/.test(rg) && /Konto & Karte – nachfassen/.test(rg));
  pruef("Schreibtisch und Bestand sprechen von „nachfassen“, nicht mehr „Bereit für Konto & Karte“",
    !/>Bereit für Konto &amp; Karte</.test(quelle("client/src/pages/agent/schreibtisch.tsx")) && /Konto & Karte nachfassen/.test(quelle("client/src/pages/agent/bestand.tsx")));
  const kue = quelle("server/lib/fiaon-kuendigung.ts");
  pruef("kuendigungSetzen setzt den Rücknahmetag bei JEDER Kündigung zurück (alle 5 Wege)",
    (kue.match(/gekuendigt_am = \$\{wann\}, kuendigung_zurueckgenommen_am = NULL/g) || []).length === 5
    && (kue.match(/gekuendigt_am = \$\{wann\}/g) || []).length === 5);
  pruef("Akten-Marke „Gekündigt“ aus der einen Regel", /KUENDIGUNG_WIRKSAM_SQL\("p\.id"\)/.test(quelle("server/routes/fiaon-agent-start.ts")));
  pruef("Migration 098 legt die Spalten sperrarm und wiederholbar an", /lock_timeout/.test(quelle("db/migrations/098_konto_karte_erneut.sql")) && /ADD COLUMN IF NOT EXISTS erneut_anzahl/.test(quelle("db/migrations/098_konto_karte_erneut.sql")));

  // ── Nachbesserung nach der Gegenprüfung ──────────────────────────────────
  const kroute = quelle("server/routes/fiaon-kuendigung.ts");
  const antragBuchenRumpf = kroute.slice(kroute.indexOf("export async function antragBuchen("), kroute.indexOf("/** GET /agent/kunden/:personId/kuendigung"));
  pruef("Befund 7: antragBuchen bucht zum Eingangstag (am: antrag.am), Quelle „formular“, auf das Ziel aus antragZiel",
    /quelle: "formular", am: antrag\.am/.test(antragBuchenRumpf) && /kuendigungDurchfuehren\(antrag\.ziel\.ziel/.test(antragBuchenRumpf) && /!antrag\.ziel\.buchbar && !opts\.alsLeitung/.test(antragBuchenRumpf));
  pruef("Befund 7: „Jetzt buchen“ (ausAntrag) geht über antragBuchen; „als Leitung“ nur für admin/vertriebsleiter",
    /ausAntrag[\s\S]{0,900}offeneKuendigungsantraege\(b\.personId, antragId\)[\s\S]{0,600}istLeitung\(req\)[\s\S]{0,400}antragBuchen\(antrag/.test(kroute) && /LEITUNG_ROLLEN = new Set\(\["admin", "vertriebsleiter"\]\)/.test(kroute));
  pruef("Befund 4/8: Akte liest den Antrag aus der einen Quelle (Personenebene), keine eigene SQL mehr",
    /offeneKuendigungsantraege\(b\.personId\)/.test(kroute) && !/KUENDIGUNG_ANTRAG_OFFEN_SQL|offenerAntragLaden|antragBuchbar/.test(kroute + quelle("shared/fiaon-kuendigung-regel.ts")));
  pruef("Befund 4: kuendigungDurchfuehren schließt auch Anträge auf zusammengeführte Bestellungen", /ref IN \(SELECT x\.ref FROM fiaon_applications x WHERE x\.merged_into = \$\{ref\}\)/.test(kroute));
  pruef("Leitung schließt einen Antrag ohne Kündigung (eigene Route, nur Leitung)", /kuendigung\/antrag\/:id\/schliessen"[\s\S]{0,500}istLeitung\(req\)/.test(kroute));
  const canc = quelle("server/routes/cancellation.ts");
  pruef("Chefbüro „Bestätigen“: dieselbe Quelle und Buchung wie die Akte, Eingangstag, keine Bestätigung nach Rücknahme",
    /offeneKuendigungsantraege\(null, Number\(id\)\)/.test(canc) && /antragBuchen\(offen/.test(canc) && /eingang_tz/.test(canc) && /zurückgenommen — der Kunde ist geblieben/.test(canc));
  pruef("Befund 1: die Rücknahme schließt offene Anträge des Menschen („withdrawn“)", /SET status = 'withdrawn'/.test(quelle("server/lib/fiaon-kuendigung.ts")));
  const pipe2 = quelle("client/src/pages/agent/pipeline.tsx");
  pruef("Akte: „Jetzt buchen“ schickt die Antrags-ID, „Als Leitung buchen“ und „ohne Kündigung schließen“ gibt es", /ausAntrag, alsLeitung/.test(pipe2) && /Als Leitung auf/.test(pipe2) && /Antrag ohne Kündigung schließen/.test(pipe2) && /au\.satz/.test(pipe2));
  const kk2 = quelle("server/lib/fiaon-konto-karte.ts");
  pruef("Befund 2: die Akte fällt DASSELBE Urteil wie die Mail-Tür (personenAnAdresse + sperrUrteil, von Hand)", /tuer\.sperrUrteil\("konto_karte_einladung", staende, \{ manuell: true \}\)/.test(kk2) && /tuer\.personenAnAdresse\(adresse\)/.test(kk2));
  pruef("Befund 5: Nachfassen filtert in SQL, begrenzt NACH dem Sortieren und liefert die Gesamtzahl", /gesamt: sortiert\.length/.test(kk2) && /LIMIT 5000/.test(kk2) && /anzahl: gesamt/.test(route));
  pruef("Befund 6: Automatik prüft vor jedem Versand die Zustelllage (Brevo), SQL-Listen nehmen ZUSTELL_PROBLEM_SQL", /if \(lage\?\.problem\) continue;/.test(rumpf(kk2, "export async function einladungenAutomatisch(")) && (kk2.match(/ZUSTELL_PROBLEM_SQL\(/g) || []).length >= 2 && !/KARTE_ZUSTELL_PROBLEM\.map/.test(kk2));
  pruef("Befund 10: „sie geht automatisch raus“ nur, wenn wirklich nichts ausschließt", !/Noch keine Einladung — sie geht nach der ersten Zahlung automatisch raus/.test(kk2));
  pruef("Befund 11: Kundenbereich und /app sagen „Link verschickt“, nie „beantragt / liegt beim Kartenpartner“",
    !/Ihre Karte ist beantragt/.test(quelle("client/src/pages/mein-bereich.tsx")) && !/Der Antrag liegt beim Kartenpartner/.test(quelle("client/src/pages/app/Weg.tsx")) && /Link verschickt/.test(quelle("client/src/pages/mein-bereich.tsx")) && /zustellProblem/.test(quelle("client/src/pages/app/Weg.tsx")));
  pruef("Befund 12: Knopf „An die Leitung: Sperre prüfen“ (Akte) → Route mit darfAnKunde → Aufgabe (Bereich brevo), Mara übergibt bei Abmeldung",
    /function SperreLeitung/.test(komp) && /\/sperre-leitung`/.test(komp) && /router\.post\("\/agent\/karte\/:personId\/sperre-leitung"[\s\S]{0,700}darfAnKunde/.test(route)
    && /bereich: "brevo"/.test(kk2) && /brevoAbmeldung\(adressLage\?\.sperrCode\)/.test(kk2));
  pruef("Rundgänge: Leitungs-Knopf, Eingangstag, Leitung entscheidet", /An die Leitung: Sperre prüfen/.test(rg) && /Eingangstag/.test(rg) && /entscheidet die Leitung/.test(rg));
  pruef("Einmal-Lauf: Teil D (Anträge nach Rücknahme) mit Trockenlauf, Rückweg und Mengenprüfung", /teilDPlan/.test(quelle("scripts/it-b-einmal.ts")) && /D \$\{planD\.length\}→\$\{d2\.length\}/.test(quelle("scripts/it-b-einmal.ts")));

  // ── Fertigstellung (08.10.2026): die restlichen Funde ────────────────────
  pruef("Fertigstellung: Ladefehler der Einladung zeigt Grund und „Erneut laden“ statt ewig „Lade …“",
    /fehler: einladungFehler/.test(komp) && /einladungFehler \? \(/.test(komp) && /onClick=\{\(\) => void einladungLaden\(\)\}>Erneut laden</.test(komp));
  const maraRumpf = kk2.slice(kk2.indexOf("const unterwegs = (intern: string"), kk2.indexOf("// Der Betreff, wie er rausging"));
  pruef("Fertigstellung: Mara an der Tagesgrenze mit eigenem Satz (karteHeuteSchonSatz), „gerade erst“ nur bei GERADE_ERST/UNTERWEGS/60 Min.",
    /if \(e\.code === "TAGESGRENZE"\) return unterwegs\(e\.meldung, true\);/.test(maraRumpf) && /heuteSchon \? `\$\{karteHeuteSchonSatz\(/.test(maraRumpf)
    && !/e\.code === "TAGESGRENZE" \|\|/.test(maraRumpf));
  const bestandQ = quelle("client/src/pages/agent/bestand.tsx");
  pruef("Fertigstellung: Bestand-Filter „Konto & Karte nachfassen“ zeigt genau die Arbeit, die die Kachel zählt (nicht angekommen · nicht geklickt)",
    /filter === "karte" && !\["nicht_angekommen", "nicht_geklickt"\]\.includes\(/.test(bestandQ)
    && /k\.zustand === "nicht_angekommen" \|\| k\.zustand === "nicht_geklickt"/.test(quelle("client/src/pages/agent/schreibtisch.tsx")));
  const mw = quelle("server/make-webhook.ts");
  pruef("Fertigstellung: die Mail-Tür hebt für die Konto-&-Karte-Einladung NIE eine Brevo-Sperre auf (auch kein „aufgehoben“-Hinweis)",
    /const ohneEntsperren = eventType === "konto_karte_einladung";/.test(mw) && /frequenz\.sperreAufheben && !ohneEntsperren\)/.test(mw)
    && /!\(ohneEntsperren && frequenz\.sperreAufheben\)/.test(mw));
}

// ═════════════════════════════════════════════════════════════════════════
// 3 · DATENBANK
// ═════════════════════════════════════════════════════════════════════════
if (!MIT_DB) {
  titel("3 · Datenbank — ÜBERSPRUNGEN (keine lokale Prüf-DB in DATABASE_URL)");
} else {
  const { sqlPool } = await import("../server/lib/db-pool");
  const kk = await import("../server/lib/fiaon-konto-karte");
  const kue = await import("../server/lib/fiaon-kuendigung");
  const { KARTE_SQL } = await import("../server/routes/fiaon-agent-start");
  const P = (n: number) => 9480000 + n;
  const REF = (n: number, s = "") => `FIAON-ITB-${n}${s}`;
  const AG = { betreuer: 948001, alt: 948002, klick: 948003 };
  const MAIL = (n: number) => `itb-${n}@pruefstand-itb.invalid`;
  const tage = (n: number) => new Date(Date.now() - n * 86_400_000);

  async function aufraeumen() {
    const ids = Array.from({ length: 40 }, (_, i) => P(i + 1));
    // Aufgaben aus „An die Leitung: Sperre prüfen“ (Schlüssel kk-sperre-<Person>-…).
    const todos = ((await sqlPool`SELECT id FROM fiaon_betreiber_todos WHERE schluessel LIKE 'kk-sperre-948%'`.catch(() => [])) as any[]).map((r) => Number(r.id));
    if (todos.length) {
      await sqlPool`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ANY(${todos})`.catch(() => {});
      await sqlPool`DELETE FROM fiaon_agent_events WHERE type = 'aufgabe_zugewiesen' AND (meta->>'todo_id')::int = ANY(${todos})`.catch(() => {});
      await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE id = ANY(${todos})`;
    }
    await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}) OR ref LIKE 'FIAON-ITB-%'`;
    await sqlPool`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids}) OR empfaenger LIKE '%@pruefstand-itb.invalid'`;
    await sqlPool`DELETE FROM fiaon_konto_karte WHERE person_id = ANY(${ids})`;
    await sqlPool`DELETE FROM fiaon_abo_raten WHERE ref LIKE 'FIAON-ITB-%'`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_vertragsannahmen WHERE ref LIKE 'FIAON-ITB-%'`.catch(() => {});
    await sqlPool`DELETE FROM cancellation_requests WHERE ref LIKE 'FIAON-ITB-%' OR ref LIKE 'FIAON-SCHUFA-ITB-%' OR email LIKE '%@pruefstand-itb.invalid'`;
    await sqlPool`DELETE FROM fiaon_applications WHERE ref LIKE 'FIAON-ITB-%' OR ref LIKE 'FIAON-SCHUFA-ITB-%'`;
    await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`;
    await sqlPool`DELETE FROM fiaon_agents WHERE id = ANY(${Object.values(AG)})`;
  }

  try {
    await kk.ensureKartenTabelle();
    await aufraeumen();
    titel("3a · Aufbau der Testzeilen");
    for (const [id, name] of [[AG.betreuer, "Prüf Betreuer ITB"], [AG.alt, "Prüf Erstversender ITB"], [AG.klick, "Prüf Klick ITB"]] as [number, string][]) {
      await sqlPool`INSERT INTO fiaon_agents (id, name, email, active, rolle) VALUES (${id}, ${name}, ${`agent-${id}@pruefstand-itb.invalid`}, TRUE, 'agent')`;
    }
    const person = async (n: number, x: Record<string, unknown> = {}) => {
      await sqlPool`INSERT INTO fiaon_persons ${sqlPool({
        id: P(n), person_ref: `FIAON-P-ITB-${n}`, first_name: "Prüf", last_name: `ITB${n}`, birthdate: "1980-05-05",
        street: "Teststraße 1", zip: "10115", city: "Berlin", primary_email: MAIL(n), assigned_agent_id: AG.betreuer, ...x,
      } as any)}`;
    };
    const bestellung = async (n: number, x: Record<string, unknown> = {}, s = "") => {
      await sqlPool`INSERT INTO fiaon_applications ${sqlPool({
        ref: REF(n, s), payment_reference: `ITB-${n}${s}`, person_id: P(n), first_name: "Prüf", last_name: `ITB${n}`,
        email: MAIL(n), pack_key: "ultra", pack_name: "FIAON Ultra", payment_status: "paid", paid_at: tage(20), created_at: tage(25), ...x,
      } as any)}`;
    };
    const einladung = async (n: number, x: Record<string, unknown> = {}) => {
      await sqlPool`INSERT INTO fiaon_konto_karte ${sqlPool({
        person_id: P(n), agent_id: AG.alt, agent_name: "Prüf Erstversender ITB", kanal: "mail", status: "gesendet", bonus_cents: 1000, gesendet_am: tage(10), ...x,
      } as any)}`;
    };
    const mail = async (n: number, x: Record<string, unknown> = {}) => {
      await sqlPool`INSERT INTO fiaon_mail_log ${sqlPool({
        event: "konto_karte_einladung", person_id: P(n), empfaenger: MAIL(n), status: "versandt", art: "echt",
        ausgeloest_von: "Automatik (erste Rate)", created_at: tage(10), zustellung: "zugestellt", ...x,
      } as any)}`;
    };
    // P1: bezahlt, eingeladen von A2 (Betreuer heute A1) — erneut senden muss den Link von A2 tragen.
    await person(1); await bestellung(1); await einladung(1); await mail(1);
    // P2: bereit, noch keine Einladung.
    await person(2); await bestellung(2);
    // P3: Konto gemeldet.
    await person(3); await bestellung(3); await einladung(3, { status: "gemeldet", gemeldet_am: tage(2) }); await mail(3);
    // P4: Vertriebssperre.
    await person(4, { is_blocked: true }); await bestellung(4); await einladung(4); await mail(4);
    // P5: gekündigt vor 2 Tagen, Altvertrag, Abrechnungsmonat läuft.
    await person(5); await bestellung(5, { gekuendigt_am: tage(2), paid_at: tage(10) }); await einladung(5); await mail(5);
    // P6: gekündigt vor 90 Tagen, Vertrag beendet vor 60 Tagen.
    await person(6); await bestellung(6, { gekuendigt_am: tage(90), vertrag_ende_am: tage(60), paid_at: tage(120), created_at: tage(125) }); await einladung(6); await mail(6, { created_at: tage(100) });
    // P7: Adresse bei unserem Mailversand gesperrt.
    await person(7); await bestellung(7); await einladung(7); await mail(7, { zustellung: "blockiert" });
    // P8: nur die Auskunft gekündigt, Paket läuft.
    await person(8); await bestellung(8);
    await sqlPool`INSERT INTO fiaon_applications ${sqlPool({ ref: `FIAON-SCHUFA-ITB-8`, payment_reference: "ITB-8S", person_id: P(8), type: "schufa", pack_key: "schufa", payment_status: "paid", paid_at: tage(15), gekuendigt_am: tage(3), email: MAIL(8) } as any)}`;
    // P9: altes Paket gekündigt, neues bezahlt und ungekündigt.
    await person(9); await bestellung(9, { gekuendigt_am: tage(40), created_at: tage(60), paid_at: tage(59) }, "A"); await bestellung(9, { created_at: tage(5), paid_at: tage(4) }, "B");
    // P10: Testkonto.
    await person(10, { ist_test_am: tage(1) }); await bestellung(10);
    // P11: nur Global gekündigt.
    await person(11); await bestellung(11, { pack_key: "global_struktur", pack_name: "FIAON Global Struktur", gekuendigt_am: tage(3) });
    // P12: eingeladen vor 6 Tagen, nie geklickt.
    await person(12); await bestellung(12); await einladung(12, { gesendet_am: tage(6) }); await mail(12, { created_at: tage(6), zustellung: "geoeffnet" });
    // P13: Widerrufsfrist (kein sofortiger Beginn), keine Einladung.
    await person(13); await bestellung(13);
    await sqlPool`INSERT INTO fiaon_vertragsannahmen ${sqlPool({ ref: REF(13), person_id: P(13), weg: "antrag_neu", angenommen_am: tage(2), paket: "ultra", rate_cents: 7999, gesamt_cents: 95988, vertrag_fassung: "t", leistung_fassung: "t", agb_fassung: "t", knopf_text: "t", haken: sqlPool.json({}), sofort_beginn: false, vertrag_html: "<p>t</p>", vertrag_sha256: "t" } as any)}`;
    // P14: unbezahlt, Kündigung früher zurückgenommen, jetzt ein offener Antrag aus dem Formular.
    await person(14); await bestellung(14, { payment_status: "pending_payment", paid_at: null, kuendigung_zurueckgenommen_am: tage(30) });
    await sqlPool`INSERT INTO cancellation_requests (ref, first_name, last_name, email, status, reason, created_at) VALUES (${REF(14)}, 'Prüf', 'ITB14', ${MAIL(14)}, 'pending', 'Prüfgrund', NOW() - INTERVAL '3 days')`;
    // P15: gekündigt UND alter Rücknahmetag (Altlast vor E-IT-B).
    await person(15); await bestellung(15, { gekuendigt_am: tage(4), kuendigung_zurueckgenommen_am: tage(30) });
    // P16: Drossel — heute schon dreimal (älter als 15 Minuten).
    await person(16); await bestellung(16); await einladung(16); await mail(16);
    // P17: Doppelklick.
    await person(17); await bestellung(17); await einladung(17); await mail(17);
    // P18: Versand scheitert.
    await person(18); await bestellung(18); await einladung(18); await mail(18);
    // ── Nachbesserung Gegenprüfung (08.10.2026) ──────────────────────────
    const antrag = async (n: number, ref: string, vorTagen: number, x: Record<string, unknown> = {}) => {
      const [r] = (await sqlPool`INSERT INTO cancellation_requests ${sqlPool({
        ref, first_name: "Prüf", last_name: `ITB${n}`, email: MAIL(n), status: "pending", reason: `Prüfgrund ${n}`, ...x,
      } as any)} RETURNING id`) as any[];
      // created_at in der Wanduhr der Sitzung (wie NOW() im Formular) — nicht als JS-Datum (Zeitzone des Prozesses).
      await sqlPool.unsafe(`UPDATE cancellation_requests SET created_at = (NOW() - INTERVAL '${vorTagen} days')::timestamp WHERE id = $1`, [r.id]);
      return Number(r.id);
    };
    // P19: Einstufung −1, eingeladen — von Hand erlaubt (Basis), Mara nicht.
    await person(19, { priority_tier: -1 }); await bestellung(19); await einladung(19); await mail(19);
    // P20: bezahlter Altvertrag, vor 2 Tagen gekündigt, vertrag_ende_am GESTERN (Kulanz/Altwert) — Abrechnungsmonat liefe noch.
    await person(20); await bestellung(20, { gekuendigt_am: tage(2), vertrag_ende_am: tage(1), paid_at: tage(10) }); await einladung(20); await mail(20);
    // P21: Antrag auf eine zusammengeführte Doppelbestellung, das bezahlte Paket bestand am Eingangstag (#48).
    await person(21); await bestellung(21, { created_at: tage(30) });
    await bestellung(21, { payment_status: "pending", paid_at: null, merged_into: REF(21), created_at: tage(31) }, "D");
    const a21 = await antrag(21, REF(21, "D"), 10);
    // P22: Antrag auf die Bonitätsauskunft, das Paket läuft.
    await person(22); await bestellung(22);
    await sqlPool`INSERT INTO fiaon_applications ${sqlPool({ ref: "FIAON-SCHUFA-ITB-22", payment_reference: "ITB-22S", person_id: P(22), type: "schufa", pack_key: "schufa", payment_status: "paid", paid_at: tage(15), email: MAIL(22) } as any)}`;
    await antrag(22, "FIAON-SCHUFA-ITB-22", 5);
    // P23: Antrag auf eine stornierte Bestellung, ein neues Paket kam DANACH (12363).
    await person(23); await bestellung(23, { payment_status: "cancelled", paid_at: null, created_at: tage(40) });
    await bestellung(23, { created_at: tage(10), paid_at: tage(9), payment_status: "claimed_paid" }, "N");
    const a23 = await antrag(23, REF(23), 20);
    // P24: Antrag mit einer Referenz, die es nicht mehr gibt — erkannt an der E-Mail-Adresse (#10/#29/#131).
    await person(24); await bestellung(24, { created_at: tage(30) });
    await antrag(24, "FIAON-ITB-WAISE-24", 5);
    // P25: #114 — am Antragstag auf die unbezahlte Doppelbestellung gebucht, das bezahlte Paket lief weiter.
    await person(25); await bestellung(25, { created_at: tage(12) });
    await bestellung(25, { payment_status: "cancelled", paid_at: null, merged_into: REF(25), gekuendigt_am: tage(9), created_at: tage(13) }, "D");
    await antrag(25, REF(25, "D"), 9);
    // P26: Antrag, danach gebucht UND zurückgenommen (Fall 11498) — über die echten Funktionen.
    await person(26); await bestellung(26);
    const a26 = await antrag(26, REF(26), 10);
    // P27: Altbestand — Antrag offen, die Rücknahme stand schon da (vor E-IT-B ließ sie den Antrag offen).
    await person(27); await bestellung(27, { kuendigung_zurueckgenommen_am: tage(5) });
    await antrag(27, REF(27), 10);
    // P28: zwei Pakete am Eingangstag, der Antrag hängt an einer stornierten dritten — Leitung mit Vorschlag.
    await person(28); await bestellung(28, { payment_status: "cancelled", paid_at: null, created_at: tage(50) }, "C");
    await bestellung(28, { created_at: tage(40) }, "A"); await bestellung(28, { payment_status: "pending_payment", paid_at: null, created_at: tage(35) }, "B");
    await antrag(28, REF(28, "C"), 20);
    // P29: gekündigt, danach ein unbezahlter neuer Paketantrag (Schalter neuerAntragSchlaegt).
    await person(29); await bestellung(29, { gekuendigt_am: tage(20), created_at: tage(60) }, "K");
    await bestellung(29, { payment_status: "pending_payment", paid_at: null, created_at: tage(10) }, "N");
    // P31: Altbestand — Bestellung NACH ihrem eigenen Kündigungstag angelegt (die 5 der Mail-Tür).
    await person(31); await bestellung(31, { gekuendigt_am: tage(30), created_at: tage(20) });
    // P33: eingeladen vor 8 Tagen, letzte Einladung WEICH zurück (Postfach voll).
    await person(33); await bestellung(33); await einladung(33, { gesendet_am: tage(8) });
    await mail(33, { created_at: tage(8), zustellung: "gebounct", zustellung_grund: "452-4.2.2 The recipient's inbox is out of storage space." });
    // P34: eingeladen vor 8 Tagen, letzte Einladung HART zurück (Postfach gibt es nicht).
    await person(34); await bestellung(34); await einladung(34, { gesendet_am: tage(8) });
    await mail(34, { created_at: tage(8), zustellung: "gebounct", zustellung_grund: "550-5.1.1 The email account that you tried to reach does not exist." });
    pruef("Testzeilen angelegt", true);

    // ── 3b · Paar-Test TS gegen SQL ────────────────────────────────────────
    titel("3b · Paar-Test: dieselbe Regel in TypeScript und SQL");
    const alle = [...Array.from({ length: 29 }, (_, i) => P(i + 1)), P(31), P(33), P(34)];
    const sqlWirksam = new Map<number, boolean>(((await sqlPool.unsafe(
      `SELECT p.id, ${regelMod.KUENDIGUNG_WIRKSAM_SQL("p.id")} AS w FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [alle])) as any[]).map((r) => [Number(r.id), !!r.w]));
    const zeilen = (await sqlPool`SELECT person_id, ref, type, pack_key, merged_into, payment_status, gekuendigt_am, kuendigung_zurueckgenommen_am FROM fiaon_applications WHERE person_id = ANY(${alle})`) as any[];
    let gleich = 0; const abweich: any[] = [];
    for (const id of alle) {
      const ts = kuendigungsStand(zeilen.filter((z) => Number(z.person_id) === id)).wirksam;
      if (ts === sqlWirksam.get(id)) gleich++; else abweich.push({ id, ts, sql: sqlWirksam.get(id) });
    }
    pruef(`kuendigungsStand (TS) = KUENDIGUNG_WIRKSAM_SQL für alle ${alle.length} Testmenschen`, abweich.length === 0, abweich);
    pruef("SQL: P5 (gekündigt) ja, P8 (nur Auskunft) nein, P9 (neuer Vertrag) nein, P11 (Global) nein, P15 (alter Rücknahmetag) ja",
      sqlWirksam.get(P(5)) && !sqlWirksam.get(P(8)) && !sqlWirksam.get(P(9)) && !sqlWirksam.get(P(11)) && sqlWirksam.get(P(15)));
    const ersterSql = new Map<number, string | null>(((await sqlPool.unsafe(
      `SELECT p.id, ${kk.karteAusschlussSql("p.id")} AS c FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [alle])) as any[]).map((r) => [Number(r.id), r.c ?? null]));
    const ausAbw: any[] = [];
    for (const id of alle) {
      const st = await kk.kartenStand(id);
      const ts = st?.ausschlussAutomatik?.code ?? null;
      // SQL kennt keine Phase — „Vertrag beendet“ ist dort „gekündigt“.
      const tsVgl = ts === "vertrag_beendet" ? "gekuendigt" : ts;
      if (tsVgl !== ersterSql.get(id)) ausAbw.push({ id, ts, sql: ersterSql.get(id) });
    }
    pruef("karteAusschluss (TS, über kartenStand) = karteAusschlussSql (erster Grund) für alle", ausAbw.length === 0, ausAbw);

    // ── 3c · Akte und Liste ────────────────────────────────────────────────
    titel("3c · kartenStand, Liste „bereit“ und Nachfassen");
    const st5 = await kk.kartenStand(P(5));
    pruef("P5 gekündigt, Vertrag läuft: Akte bereit für den MENSCHEN, mit Hinweis „nur auf Wunsch“", !!st5?.bereit && !st5?.ausschluss && !!st5?.hinweis && st5?.ausschlussAutomatik?.code === "gekuendigt", st5 && { bereit: st5.bereit, a: st5.ausschluss, h: st5.hinweis });
    const st6 = await kk.kartenStand(P(6));
    pruef("P6 Vertrag beendet: nicht bereit, Grund „Vertrag beendet“ statt „erfüllt alle Bedingungen“", st6?.bereit === false && st6?.ausschluss?.code === "vertrag_beendet" && /beendet/.test(String(st6?.esFehlt)), st6 && { a: st6.ausschluss, e: st6.esFehlt });
    const st4 = await kk.kartenStand(P(4));
    pruef("P4 Vertriebssperre: nicht bereit, Grund steht da", st4?.bereit === false && st4?.ausschluss?.code === "vertriebssperre");
    const st2 = await kk.kartenStand(P(2));
    pruef("P2 ohne Ausschluss: bereit wie bisher", st2?.bereit === true && !st2?.ausschluss);
    const bereitNeu = new Set((await kk.bereiteKunden({ agentId: AG.betreuer, ohneVersand: true, grenze: 500 })).map((k) => k.personId));
    const bereitAlt = new Set((await kk.bereiteKunden({ agentId: AG.betreuer, ohneVersand: true, grenze: 500, mitAusgeschlossenen: true })).map((k) => k.personId));
    pruef("Liste ohne Ausgeschlossene: P2 und P13 drin, Testkonto P10 und Global P11 nicht", bereitNeu.has(P(2)) && bereitNeu.has(P(13)) && !bereitNeu.has(P(10)) && !bereitNeu.has(P(11)), [...bereitNeu]);
    pruef("… die alte Lesart hätte das Testkonto gezeigt (Rotprobe der Daten)", bereitAlt.has(P(10)));
    pruef("… P8 (nur Auskunft gekündigt) und P9 (neuer Vertrag) sind bereit", bereitNeu.has(P(8)) && bereitNeu.has(P(9)));
    const nf = (await kk.karteNachfassen({ agentId: AG.betreuer, grenze: 500 })).faelle;
    const zustand = (n: number) => nf.find((f) => f.personId === P(n))?.zustand ?? null;
    pruef("Nachfassen: P7 „Mail kam nicht an“", zustand(7) === "nicht_angekommen", nf.filter((f) => f.personId >= P(1) && f.personId <= P(18)).map((f) => [f.personId - 9480000, f.zustand]));
    pruef("Nachfassen: P12 „eingeladen, nicht geklickt“", zustand(12) === "nicht_geklickt");
    pruef("Nachfassen: P2 „bereit“, P13 „wartet auf Widerrufsfrist“", zustand(2) === "bereit" && zustand(13) === "frist");
    pruef("Nachfassen: keine Gekündigten (P5, P6), kein Konto-steht (P3), keine Sperre (P4), kein Test (P10)", [3, 4, 5, 6, 10].every((n) => zustand(n) === null));
    pruef("Nachfassen: P1 (vor 10 Tagen eingeladen, zugestellt, nicht geklickt) ist „nicht geklickt“", zustand(1) === "nicht_geklickt");
    pruef("Nachfassen: Reihenfolge — „nicht angekommen“ vor „nicht geklickt“ vor „bereit“", (() => {
      const r = nf.map((f) => weg.KARTE_NACHFASSEN_REIHENFOLGE.indexOf(f.zustand)); return r.every((x, i) => i === 0 || r[i - 1] <= x);
    })());

    // ── 3d · Erneut senden ─────────────────────────────────────────────────
    titel("3d · karteEinladungErneut (Versand ist eine Attrappe)");
    const gesendet: any[] = [];
    const attrappe = async (ein: any) => {
      gesendet.push(ein);
      // Wie mailSenden: ein Protokolleintrag „versandt“ — die Drossel liest das Protokoll.
      await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, ausgeloest_von, ausgeloest_agent_id, payload)
                    VALUES ('konto_karte_einladung', ${ein.personId}, ${MAIL(ein.personId - 9480000)}, 'versandt', 'echt', ${ein.akteur.name}, ${ein.akteur.agentId}, ${sqlPool.json(ein.zusatz)})`;
      return { ok: true };
    };
    const akte = { agentId: AG.klick, name: "Prüf Klick ITB", rolle: "agent", quelle: "akte" as const };
    const vorher1 = (await sqlPool`SELECT id, agent_id, agent_name, bonus_cents, status, gesendet_am FROM fiaon_konto_karte WHERE person_id = ${P(1)}`) as any[];
    const e1 = await kk.karteEinladungErneut(P(1), akte, { senden: attrappe });
    const nach1 = (await sqlPool`SELECT id, agent_id, agent_name, bonus_cents, status, gesendet_am, erneut_anzahl, zuletzt_erneut_von, zuletzt_erneut_am FROM fiaon_konto_karte WHERE person_id = ${P(1)}`) as any[];
    pruef("P1: ERNEUT_GESENDET, genau ein Versand", e1.ok && e1.code === "ERNEUT_GESENDET" && gesendet.length === 1, e1);
    pruef("P1: derselbe Link — Kennung des ERSTEN Mitarbeiters (A948002), nicht des Klickenden", String(gesendet[0]?.zusatz?.partner_link) === kk.partnerLink(P(1), AG.alt), gesendet[0]?.zusatz);
    pruef("P1: weiter genau EINE Zeile, Geld und Erstversand unberührt", nach1.length === 1 && nach1[0].id === vorher1[0].id && nach1[0].agent_id === AG.alt && nach1[0].bonus_cents === 1000
      && nach1[0].status === "gesendet" && new Date(nach1[0].gesendet_am).getTime() === new Date(vorher1[0].gesendet_am).getTime(), nach1);
    pruef("P1: erneut_anzahl 1, zuletzt von „Prüf Klick ITB“", nach1[0]?.erneut_anzahl === 1 && nach1[0]?.zuletzt_erneut_von === "Prüf Klick ITB");
    const [vl] = (await sqlPool`SELECT note, agent_id FROM fiaon_contact_log WHERE person_id = ${P(1)} AND note LIKE 'Konto & Karte: Link der Partnerbank erneut%' ORDER BY id DESC LIMIT 1`) as any[];
    pruef("P1: Verlauf nennt Adresse (gekürzt) und Mitarbeiter", !!vl && /it…@pruefstand-itb\.invalid|itb…@|it…@/.test(vl.note) && /Prüf Klick ITB/.test(vl.note) && vl.agent_id === AG.klick, vl);
    pruef("P1: „heute noch 2“ in der Antwort", e1.heuteNoch === 2 && /Heute noch 2/.test(e1.meldung), e1);
    const e1b = await kk.karteEinladungErneut(P(1), akte, { senden: attrappe });
    pruef("P1 sofort noch einmal: GERADE_ERST (15 Minuten), keine Mail", e1b.code === "GERADE_ERST" && gesendet.length === 1 && !!e1b.naechsterMoeglichAm, e1b);
    const e2 = await kk.karteEinladungErneut(P(2), akte, { senden: attrappe });
    pruef("P2 ohne Einladung: KEINE_EINLADUNG, keine Mail, keine Zeile", e2.code === "KEINE_EINLADUNG" && gesendet.length === 1
      && ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_konto_karte WHERE person_id = ${P(2)}`) as any[])[0].n === 0);
    const e3 = await kk.karteEinladungErneut(P(3), akte, { senden: attrappe });
    pruef("P3 Konto gemeldet: KONTO_STEHT", e3.code === "KONTO_STEHT" && gesendet.length === 1);
    const e4 = await kk.karteEinladungErneut(P(4), akte, { senden: attrappe });
    pruef("P4 Vertriebssperre: GESPERRT mit Grund", e4.code === "GESPERRT" && /Vertriebssperre/.test(e4.meldung) && gesendet.length === 1);
    const e5 = await kk.karteEinladungErneut(P(5), akte, { senden: attrappe });
    pruef("P5 gekündigt, Vertrag läuft — von Hand ERLAUBT", e5.code === "ERNEUT_GESENDET" && gesendet.length === 2, e5);
    const e5m = await kk.karteEinladungErneut(P(5), { agentId: null, name: "Mara (WhatsApp)", rolle: "admin", quelle: "mara_wa" }, { senden: attrappe });
    pruef("P5 — Mara darf NICHT (nur von Hand)", e5m.code === "GESPERRT" && gesendet.length === 2, e5m);
    const e6 = await kk.karteEinladungErneut(P(6), akte, { senden: attrappe });
    pruef("P6 Vertrag beendet: GESPERRT „Vertrag beendet“", e6.code === "GESPERRT" && /beendet/.test(e6.meldung) && gesendet.length === 2, e6);
    const e7 = await kk.karteEinladungErneut(P(7), akte, { senden: attrappe });
    pruef("P7 Adresse gesperrt: ADRESSE_GESPERRT, keine Mail, Hinweis „prüfen/ändern“", e7.code === "ADRESSE_GESPERRT" && gesendet.length === 2 && /Daten/.test(e7.meldung) && e7.zustell?.problem === true, e7);
    const akte7 = await kk.karteEinladungAkte(P(7));
    pruef("P7 Akte: Adresse, Zustand „gesperrt“, Knopf aus mit Grund", !!akte7 && akte7.empfaenger === MAIL(7) && akte7.adresseLage?.problem === true && akte7.darfErneut === false && /nichts an/.test(String(akte7.sperre)), akte7 && { e: akte7.empfaenger, l: akte7.adresseLage, d: akte7.darfErneut, s: akte7.sperre });
    await sqlPool`UPDATE fiaon_persons SET primary_email = 'itb-7-neu@pruefstand-itb.invalid' WHERE id = ${P(7)}`;
    const e7b = await kk.karteEinladungErneut(P(7), akte, { senden: attrappe });
    pruef("P7 nach Adressänderung unter „Daten“: geht an die neue Adresse", e7b.code === "ERNEUT_GESENDET" && e7b.an === "itb-7-neu@pruefstand-itb.invalid" && gesendet.length === 3, e7b);
    // P16 Drossel: drei Versände heute, älter als 15 Minuten.
    const minutenSeitMitternacht = (() => { const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); return Number(t.find((x) => x.type === "hour")?.value) * 60 + Number(t.find((x) => x.type === "minute")?.value); })();
    if (minutenSeitMitternacht > 25) {
      for (const m of [16, 18, 20]) await mail(16, { created_at: new Date(Date.now() - m * 60_000), ausgeloest_von: "Prüf" });
      const e16 = await kk.karteEinladungErneut(P(16), akte, { senden: attrappe });
      pruef("P16 dreimal heute: TAGESGRENZE", e16.code === "TAGESGRENZE" && gesendet.length === 3, e16);
    } else console.log("  · P16 übersprungen (kurz nach Mitternacht Berlin — „heute“ ist zu kurz für drei ältere Versände)");
    // P17 Doppelklick: zwei Aufrufe zugleich → genau einer geht.
    const langsam = async (ein: any) => { await new Promise((r) => setTimeout(r, 250)); return attrappe(ein); };
    const [d1, d2] = await Promise.all([kk.karteEinladungErneut(P(17), akte, { senden: langsam }), kk.karteEinladungErneut(P(17), akte, { senden: langsam })]);
    pruef("P17 Doppelklick: genau EIN Versand", [d1, d2].filter((x) => x.ok).length === 1 && gesendet.filter((g) => g.personId === P(17)).length === 1, [d1.code, d2.code]);
    // P18 Versand scheitert: Anspruch zurück, Zähler unverändert.
    const e18 = await kk.karteEinladungErneut(P(18), akte, { senden: async () => ({ ok: false, grund: "Testfehler" }) });
    const [z18] = (await sqlPool`SELECT erneut_anzahl, zuletzt_erneut_am FROM fiaon_konto_karte WHERE person_id = ${P(18)}`) as any[];
    pruef("P18 Versand scheitert: NICHT_GESENDET, Anspruch zurückgegeben, Zähler 0", e18.code === "NICHT_GESENDET" && /Testfehler/.test(e18.meldung) && z18.erneut_anzahl === 0 && z18.zuletzt_erneut_am === null, { e18, z18 });
    const e18b = await kk.karteEinladungErneut(P(18), akte, { senden: attrappe });
    pruef("P18 danach sofort wieder möglich (kein hängender Anspruch)", e18b.code === "ERNEUT_GESENDET", e18b);
    const a1 = await kk.karteEinladungAkte(P(1));
    pruef("Akte P1: zuerst „Automatik“, zuletzt „Prüf Klick ITB“, 2 Versände, Verlauf", !!a1 && /^Automatik/.test(String(a1.zuerstVon)) && a1.zuletztVon === "Prüf Klick ITB" && a1.anzahl === 2 && a1.verlauf.length === 2 && a1.erneutAnzahl === 1, a1 && { zv: a1.zuerstVon, lv: a1.zuletztVon, n: a1.anzahl });
    pruef("Akte P1: gerade geschickt — Knopf aus, „wieder möglich ab …“", a1?.darfErneut === false && /wieder möglich ab/.test(String(a1?.sperre)));
    const a5 = await kk.karteEinladungAkte(P(5));
    pruef("Akte P5: Hinweis „nur auf Wunsch“ steht neben dem Knopf", !!a5?.hinweis && /ausdrücklich/.test(String(a5?.hinweis)));

    // ── 3e · Mara ──────────────────────────────────────────────────────────
    titel("3e · Mara: Adresse gesperrt → nichts schicken, nach der Adresse fragen");
    await sqlPool`UPDATE fiaon_persons SET primary_email = ${MAIL(7)} WHERE id = ${P(7)}`;
    const m7 = await kk.karteEinladungFuerPerson(P(7), { name: "Mara (WhatsApp)", quelle: "whatsapp" });
    pruef("Mara P7: aktion „adresse_gesperrt“, nichts gesendet, Satz fragt nach der Adresse (kein Spam-Ordner)", m7.aktion === "adresse_gesperrt" && !m7.gesendet && /E-Mail-Adresse/.test(String(m7.satz)) && !/Spam/.test(String(m7.satz)), m7);
    const m5 = await kk.karteEinladungFuerPerson(P(5), { name: "Mara (WhatsApp)", quelle: "whatsapp" });
    pruef("Mara P5 (gekündigt): gesperrt, Übergabe an den Menschen", m5.aktion === "gesperrt" && !m5.gesendet, m5);

    // ── 3f · Kündigung: Rücknahmetag, Portalsperre, Akten-Marke, ungebuchter Antrag ─
    titel("3f · Kündigung: eine Regel überall");
    const [u14a] = (await sqlPool.unsafe(`SELECT ${regelMod.KUENDIGUNG_UNGEBUCHT_SQL("$1::int")} AS u`, [P(14)])) as any[];
    pruef("P14: offener Formular-Antrag ohne Buchung zählt als „nicht gebucht“ — und NICHT als gekündigt", u14a.u === true && sqlWirksam.get(P(14)) === false);
    const k14 = await kue.kuendigungSetzen(REF(14), { quelle: "admin", grund: "Prüfstand E-IT-B" });
    const [a14] = (await sqlPool`SELECT gekuendigt_am, kuendigung_zurueckgenommen_am FROM fiaon_applications WHERE ref = ${REF(14)}`) as any[];
    pruef("kuendigungSetzen nach früherer Rücknahme: Rücknahmetag zurückgesetzt, Kündigung gilt", k14.ok && !!a14.gekuendigt_am && a14.kuendigung_zurueckgenommen_am === null, { k14, a14 });
    const [u14b] = (await sqlPool.unsafe(`SELECT ${regelMod.KUENDIGUNG_UNGEBUCHT_SQL("$1::int")} AS u`, [P(14)])) as any[];
    pruef("P14 nach der Buchung: nicht mehr „nicht gebucht“", u14b.u === false);
    const k15 = await kue.kuendigungSetzen(REF(15), { quelle: "admin", grund: "Prüfstand", probe: true });
    pruef("P15 (gekündigt + alter Rücknahmetag): „bereits gekündigt“ statt neuer Buchung", k15.weg === "bereits", k15);
    pruef("Portalsperre: P8 (nur Auskunft gekündigt) NICHT gesperrt", (await kue.neueLeistungGesperrt(REF(8))) === false);
    pruef("Portalsperre: P5 (Paket gekündigt) gesperrt — auch über die Auskunft-Bestellung eines Gekündigten", (await kue.neueLeistungGesperrt(REF(5))) === true);
    pruef("Portalsperre: P9 (neuer bezahlter Vertrag) NICHT gesperrt", (await kue.neueLeistungGesperrt(REF(9, "A"))) === false);
    const marke = new Map<number, any>(((await sqlPool.unsafe(`SELECT ${KARTE_SQL} FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [[P(5), P(8), P(9), P(11)]])) as any[]).map((r) => [Number(r.id), r.gekuendigt_am]));
    pruef("Akten-Marke „Gekündigt“: P5 ja; P8, P9, P11 nein", !!marke.get(P(5)) && !marke.get(P(8)) && !marke.get(P(9)) && !marke.get(P(11)), Object.fromEntries(marke));

    // ── 3g · Nachbesserung nach der Gegenprüfung ───────────────────────────
    titel("3g · Gegenprüfung: Tür = Akte, von Hand, Anträge, Rückläufer, Leitung");
    const tuer = await import("../server/lib/fiaon-mail-frequenz");
    const tuerUrteil = async (n: number) => tuer.sperrUrteil("konto_karte_einladung", await tuer.personSperren(await tuer.personenAnAdresse(MAIL(n))), { manuell: true });
    // Befund 2: Akte und Mail-Tür lesen das Vertragsende gleich.
    const st20 = await kk.kartenStand(P(20));
    pruef("P20 (vertrag_ende_am gestern, Abrechnungsmonat liefe): die Tür sperrt — und die Akte sagt „Vertrag beendet“",
      !!(await tuerUrteil(20)) && st20?.bereit === false && st20?.ausschluss?.code === "vertrag_beendet", { tuer: await tuerUrteil(20), a: st20?.ausschluss });
    const e20 = await kk.karteEinladungErneut(P(20), akte, { senden: attrappe });
    pruef("P20: erneut senden endet mit GESPERRT (Grund in der Akte), nicht erst an der Tür mit NICHT_GESENDET", e20.code === "GESPERRT" && /beendet/.test(e20.meldung), e20);
    {
      const paare: any[] = [];
      for (const n of [1, 5, 6, 12, 19, 20]) {
        const st = await kk.kartenStand(P(n));
        const tuerSperrt = !!(await tuerUrteil(n));
        const akteSperrt = st?.ausschluss?.code === "vertrag_beendet" || st?.ausschluss?.code === "test";
        if (tuerSperrt !== akteSperrt) paare.push({ n, tuerSperrt, akte: st?.ausschluss?.code ?? null });
      }
      pruef("Paartest Mail-Tür ↔ Akte (Vertragsende/Testkonto) für P1, P5, P6, P12, P19, P20", paare.length === 0, paare);
    }
    // Befund 3/9: Einstufung −1 — von Hand ja, Mara nein; der Kunde liest „auf Wunsch“ nur, wo es stimmt.
    const st19 = await kk.kartenStand(P(19));
    pruef("P19 Einstufung −1: Akte bereit für den Menschen, Hinweis nennt den Grund, Automatik gesperrt",
      !!st19?.bereit && !st19?.ausschluss && /Einstufung −1/.test(String(st19?.hinweis)) && st19?.ausschlussAutomatik?.code === "stufe_minus1", st19 && { b: st19.bereit, h: st19.hinweis });
    pruef("P19: Kundensatz „auf Wunsch“ (der Mensch darf)", /auf Wunsch/.test(String(st19?.kundeSatz)));
    const vor19 = gesendet.length;
    const e19 = await kk.karteEinladungErneut(P(19), akte, { senden: attrappe });
    pruef("P19: von Hand ERNEUT_GESENDET", e19.code === "ERNEUT_GESENDET" && gesendet.length === vor19 + 1, e19);
    const e19m = await kk.karteEinladungErneut(P(19), { agentId: null, name: "Mara (WhatsApp)", rolle: "admin", quelle: "mara_wa" }, { senden: attrappe });
    pruef("P19: Mara GESPERRT", e19m.code === "GESPERRT" && gesendet.length === vor19 + 1, e19m);
    pruef("P4 Vertriebssperre: Kundensatz ohne Versprechen", !/auf Wunsch/.test(String((await kk.kartenStand(P(4)))?.kundeSatz)));
    // Befund 10: die Akte sagt bei Ausgeschlossenen ohne Einladung nicht „geht automatisch raus“.
    const a10 = await kk.karteEinladungAkte(P(10));
    pruef("Akte P10 (Testkonto, keine Einladung): Grund statt „geht automatisch raus“", /Testkonto/.test(String(a10?.sperre)) && !/automatisch raus/.test(String(a10?.sperre)), a10?.sperre);
    const a2 = await kk.karteEinladungAkte(P(2));
    pruef("Akte P2 (bereit, keine Einladung): „sie geht mit dem nächsten Takt automatisch raus“", /nächsten Takt automatisch raus/.test(String(a2?.sperre)), a2?.sperre);
    // Befund 5: Grenze NACH dem Sortieren, echte Gesamtzahl.
    const nf2 = await kk.karteNachfassen({ agentId: AG.betreuer, grenze: 2 });
    pruef("Nachfassen mit Grenze 2: zwei Fälle, die dringendsten (nicht angekommen zuerst), Gesamtzahl stimmt",
      nf2.faelle.length === 2 && nf2.faelle[0].zustand === "nicht_angekommen" && nf2.gesamt === nf.length && nf2.gesamt > 2, { n: nf2.faelle.map((f) => f.zustand), g: nf2.gesamt, alle: nf.length });
    // Befund 6: weicher Rückläufer.
    pruef("Nachfassen: P33 (Postfach voll) ist „nicht geklickt“, P34 (Postfach gibt es nicht) „Mail kam nicht an“", zustand(33) === "nicht_geklickt" && zustand(34) === "nicht_angekommen", [zustand(33), zustand(34)]);
    const [ap] = (await sqlPool.unsafe(`SELECT ${kk.ADRESSE_PROBLEM_SQL("$1::int")} AS w, ${kk.ADRESSE_PROBLEM_SQL("$2::int")} AS h`, [P(33), P(34)])) as any[];
    pruef("ADRESSE_PROBLEM_SQL: weich → zustellbar, hart → Problem", ap.w === false && ap.h === true, ap);
    {
      const abw: any[] = [];
      for (const g of [...WEICH, ...HART, null]) {
        const [r] = (await sqlPool.unsafe(`SELECT ${weg.ZUSTELL_PROBLEM_SQL("'gebounct'", "$1::text")} AS p, ${weg.ZUSTELL_PROBLEM_SQL("'blockiert'", "$1::text")} AS b`, [g])) as any[];
        if (r.p !== weg.zustellProblem("gebounct", g) || r.b !== true) abw.push({ g, sql: r.p, ts: weg.zustellProblem("gebounct", g) });
      }
      pruef(`Paartest Rückläufer TS ↔ SQL (${WEICH.length + HART.length + 1} echte Antworten)`, abw.length === 0, abw);
    }
    const l33 = await kk.zustellLage(P(33), MAIL(33));
    pruef("zustellLage P33 ohne Brevo-Schlüssel: im Zweifel Problem (Sperrliste nicht lesbar) — nie ein Entsperren", l33?.problem === true && l33?.weich === false, l33);

    // Befund 12: An die Leitung.
    const kurzW = await kk.karteSperreAnLeitung(P(7), { agentId: AG.klick, name: "Prüf Klick ITB" }, "ja");
    pruef("Leitung: ohne Wunsch des Kunden keine Aufgabe", !kurzW.ok && kurzW.aufgabeId === null);
    const l1 = await kk.karteSperreAnLeitung(P(1), { agentId: AG.klick, name: "Prüf Klick ITB" }, "Kunde will die Post an diese Adresse");
    pruef("Leitung: keine Aufgabe, wenn keine Sperre vorliegt (P1)", !l1.ok, l1);
    const l7 = await kk.karteSperreAnLeitung(P(7), { agentId: AG.klick, name: "Prüf Klick ITB" }, "Kunde hat sich versehentlich abgemeldet und will die Post wieder an genau diese Adresse");
    const [t7] = (await sqlPool`SELECT bereich, text, link, status FROM fiaon_betreiber_todos WHERE schluessel = ${`kk-sperre-${P(7)}-${MAIL(7)}`}`) as any[];
    pruef("Leitung: Aufgabe „Sperre von Hand prüfen“ mit Adresse, Stand, Wunsch und Hinweis „nie automatisch“", l7.ok && !!t7 && t7.bereich === "brevo" && t7.text.includes(MAIL(7))
      && /versehentlich abgemeldet/.test(t7.text) && /automatisch heben wir nie/.test(t7.text) && /person=9480007/.test(String(t7.link)), { l7, t7 });
    const a7b = await kk.karteEinladungAkte(P(7));
    pruef("Akte P7: Knopf „An die Leitung“ ist angeboten (sperreLeitung)", a7b?.sperreLeitung === true && a7b?.adresseLage?.leitungPruefen === true, a7b && { s: a7b.sperreLeitung });

    // Befund 1/4/7/8: nie gebuchte Kündigungsanträge.
    const ungebucht = async (n: number) => ((await sqlPool.unsafe(`SELECT ${regelMod.KUENDIGUNG_UNGEBUCHT_SQL("$1::int")} AS u`, [P(n)])) as any[])[0].u === true;
    const offen = async (n: number) => kue.offeneKuendigungsantraege(P(n));
    pruef("P21 (Antrag auf zusammengeführte Doppelbestellung): in der Liste", await ungebucht(21));
    const o21 = (await offen(21))[0];
    pruef("P21: Ziel = das bezahlte Paket, buchbar, „umgezogen“", o21?.ziel.ziel === REF(21) && o21.ziel.buchbar && o21.ziel.umgezogen, o21);
    const { antragBuchen } = await import("../server/routes/fiaon-kuendigung");
    const b21 = await antragBuchen(o21, { grund: "Prüfstand E-IT-B (Formular)", personId: P(21), unterzeichner: { name: "Prüf Klick ITB", rolle: "Mitarbeiter", agentId: AG.klick }, mail: false });
    const [g21] = (await sqlPool`
      SELECT a.gekuendigt_am, a.kuendigung_quelle, ABS(EXTRACT(EPOCH FROM (a.gekuendigt_am - c.created_at::timestamptz)))::int AS abstand, c.status
        FROM fiaon_applications a, cancellation_requests c WHERE a.ref = ${REF(21)} AND c.id = ${a21}`) as any[];
    pruef("P21 gebucht: auf das Paket, ZUM EINGANGSTAG (nicht heute), Quelle „formular“, Antrag bestätigt",
      b21?.ok && b21.gebuchtAuf === REF(21) && g21?.abstand <= 1 && g21?.kuendigung_quelle === "formular" && g21?.status === "confirmed", { b21: { ok: b21?.ok, weg: b21?.weg, auf: b21?.gebuchtAuf }, g21 });
    pruef("P21 danach: wirksam gekündigt, nicht mehr in der Liste", !(await ungebucht(21))
      && ((await sqlPool.unsafe(`SELECT ${regelMod.KUENDIGUNG_WIRKSAM_SQL("$1::int")} AS w`, [P(21)])) as any[])[0].w === true);
    pruef("P22 (Antrag auf die Bonitätsauskunft): nicht in der Stufenpaket-Liste", !(await ungebucht(22)));
    pruef("P23 (stornierte Bestellung, neues Paket danach): in der Liste, aber KEIN Ziel — nie die neue Bestellung", await ungebucht(23)
      && (await offen(23))[0]?.ziel.ziel === null && (await offen(23))[0]?.ziel.buchbar === false);
    const o23 = (await offen(23))[0];
    const b23 = await antragBuchen(o23, { grund: "Prüfstand", personId: P(23), unterzeichner: { name: "Prüf", rolle: "Mitarbeiter" }, alsLeitung: true, mail: false });
    const [n23] = (await sqlPool`SELECT gekuendigt_am, payment_status FROM fiaon_applications WHERE ref = ${REF(23, "N")}`) as any[];
    pruef("P23: auch „als Leitung“ wird ohne Ziel nichts gebucht, die neue Bestellung bleibt unberührt", b23?.ok === false && !n23.gekuendigt_am && n23.payment_status === "claimed_paid", { b23, n23 });
    const zu23 = await kue.kuendigungsantragSchliessen(a23, { von: "Prüf Leitung ITB", grund: "Kunde kam mit neuem Paket zurück", personId: P(23) });
    const [c23] = (await sqlPool`SELECT status, processed_by FROM cancellation_requests WHERE id = ${a23}`) as any[];
    pruef("P23: Leitung schließt den Antrag ohne Kündigung — „rejected“, aus der Liste", zu23 && c23.status === "rejected" && c23.processed_by === "Prüf Leitung ITB" && !(await ungebucht(23)), c23);
    const o24 = (await offen(24))[0];
    pruef("P24 (Referenz gibt es nicht mehr): über die E-Mail-Adresse erkannt, Ziel das Paket, buchbar", await ungebucht(24) && o24?.ziel.ziel === REF(24) && o24.ziel.buchbar && o24.ziel.umgezogen, o24);
    const o25 = (await offen(25))[0];
    pruef("P25 (#114, gebucht nur auf der toten Doppelbestellung): in der Liste, Ziel das bezahlte Paket", await ungebucht(25) && o25?.ziel.ziel === REF(25) && o25.ziel.buchbar, o25);
    // P26: Antrag → gebucht (über einen anderen Weg) → zurückgenommen: kein „Jetzt buchen“ für einen geblieben Kunden.
    await kue.kuendigungSetzen(REF(26), { quelle: "admin", grund: "Prüfstand" });
    await sqlPool`UPDATE cancellation_requests SET status = 'pending' WHERE id = ${a26}`;
    await kue.kuendigungZuruecknehmen(REF(26), "Prüfstand: Kunde bleibt");
    const [c26] = (await sqlPool`SELECT status FROM cancellation_requests WHERE id = ${a26}`) as any[];
    pruef("P26 (11498-Art): die Rücknahme schließt den Antrag („withdrawn“), nicht in der Liste", c26.status === "withdrawn" && !(await ungebucht(26)), c26);
    pruef("P27 (Altbestand: Antrag offen, Rücknahme danach): nicht in der Liste", !(await ungebucht(27)));
    const o28 = (await offen(28))[0];
    pruef("P28 (zwei Pakete am Eingangstag): Leitung, Vorschlag das bezahlte", await ungebucht(28) && o28?.ziel.buchbar === false && o28.ziel.ziel === REF(28, "A") && /mehrere Pakete/.test(o28.ziel.satz), o28);
    const b28 = await antragBuchen(o28, { grund: "Prüfstand", personId: P(28), unterzeichner: { name: "Prüf", rolle: "Mitarbeiter" }, mail: false });
    pruef("P28: ohne Leitung bucht die Akte NICHT", b28?.ok === false && b28?.leitung === true && !((await sqlPool`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = ${REF(28, "A")}`) as any[])[0].gekuendigt_am);
    {
      // Kundenzentrale: Filter und Zähler aus derselben Quelle.
      const kz = await import("../server/lib/fiaon-kundenzentrale");
      const zahlen = await kz.filterZahlen().catch(() => null) as any;
      pruef("Kundenzentrale: Zähler „Kündigung nicht gebucht“ rechnet (ohne Fehler)", !!zahlen && Number.isInteger(Number(zahlen.kuendigung_ungebucht)), zahlen && zahlen.kuendigung_ungebucht);
    }

    // Befund 13: der Schalter in TS und SQL gleich, für alle Testmenschen.
    {
      const sqlInt = new Map<number, boolean>(((await sqlPool.unsafe(
        `SELECT p.id, ${regelMod.KUENDIGUNG_WIRKSAM_SQL("p.id", { neuerAntragSchlaegt: true })} AS w FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [alle])) as any[]).map((r) => [Number(r.id), !!r.w]));
      const z2 = (await sqlPool`SELECT person_id, ref, type, pack_key, merged_into, payment_status, gekuendigt_am, created_at FROM fiaon_applications WHERE person_id = ANY(${alle})`) as any[];
      const abw: any[] = [];
      for (const id of alle) {
        const ts = regelMod.kuendigungsStand(z2.filter((z) => Number(z.person_id) === id), { neuerAntragSchlaegt: true }).wirksam;
        if (ts !== sqlInt.get(id)) abw.push({ id, ts, sql: sqlInt.get(id) });
      }
      pruef(`Schalter neuerAntragSchlaegt: TS = SQL für alle ${alle.length} Testmenschen`, abw.length === 0, abw);
      pruef("P29 (gekündigt, danach unbezahlter Paketantrag): Vertrag gekündigt — mit Schalter nicht (Lesart der Mail-Tür)",
        ((await sqlPool.unsafe(`SELECT ${regelMod.KUENDIGUNG_WIRKSAM_SQL("$1::int")} AS w`, [P(29)])) as any[])[0].w === true && sqlInt.get(P(29)) === false);
      pruef("P31 (Bestellung nach ihrem eigenen Kündigungstag): auch mit Schalter gekündigt — die Mail-Tür zählt sie selbst als „neuen Antrag“ (gemessen 5 Menschen)",
        sqlInt.get(P(31)) === true);
    }
  } catch (e: any) {
    pruef("Datenbank-Teil ohne Ausnahme", false, String(e?.stack || e).slice(0, 600));
  } finally {
    await aufraeumen().catch((e) => console.log("  Aufräumen:", e?.message || e));
    const [rest] = (await sqlPool`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE id BETWEEN 9480001 AND 9480040)::int AS p,
                                          (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE 'FIAON-ITB-%' OR ref LIKE 'FIAON-SCHUFA-ITB-%')::int AS a,
                                          (SELECT COUNT(*) FROM fiaon_mail_log WHERE empfaenger LIKE '%@pruefstand-itb.invalid')::int AS m`) as any[];
    pruef("aufgeräumt: keine Testzeile bleibt liegen", rest.p === 0 && rest.a === 0 && rest.m === 0, rest);
    await sqlPool.end({ timeout: 5 }).catch(() => {});
  }
}

console.log(`\n${roteListe.length ? "✗" : "✓"} ${gruen}/${gruen + roteListe.length} Prüfungen bestanden${MIT_DB ? "" : " (offline)"}`);
if (roteListe.length) { console.log("Rot:"); for (const r of roteListe) console.log(`  · ${r}`); }
process.exit(roteListe.length ? 1 : 0);
