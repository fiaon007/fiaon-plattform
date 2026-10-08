// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-F (08.10.2026) — AUFTRÄGE: EINE STATUSWAHRHEIT, NÄCHSTER
// AUFTRAG, SORTIERUNG NACH EINGANG, AUTOMATISCHE ERLEDIGUNG, KUNDENNAME
//
//   A. REIN (immer): Art-Katalog, Kunde aus Link/Schlüssel (nie die Mail-ID als
//      Person), Name aus Titel, die EINE Reihenfolge und der nächste Auftrag,
//      Statusspalte, „Eingang: TT.MM. HH:MM" in Berliner Zeit (Sommer/Winter),
//      Ereignis-Zuordnung (nie nurHand), Bedienelemente im Quelltext.
//   B. --lokal (nur gegen eine LOKALE Datenbank mit Migration 102): die Wand
//      (Trigger), auftragFuerKunden (Anlass neu/zustand, kein Umhängen gegen
//      einen aktiven Zuständigen, kein Doppeltext), Zuordnung (Wurzelperson,
//      Mail-Marke, nie postmeister:<n>:aufgabe), Ereignisse direkt und über die
//      echten Ketten (ergebnisNachbereiten, ratenErgebnisAnwenden,
//      rueckrufErledigen, terminErgebnisSetzen), Popup (neu_seit).
//   C. --server <url> (laufender lokaler Server auf DERSELBEN lokalen Datenbank):
//      die Routen, wie die Oberfläche sie ruft — Liste nur offen und sortiert,
//      Erledigen idempotent mit Nachfolger, Pflichtsatz, Wieder-Öffnen,
//      „liegt nicht mehr bei dir", Detail mit ganzer Zeitleiste, Popup-Ziel.
//
//   env -i HOME="$HOME" PATH="$PATH" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_it_f?sslmode=require' \
//     DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-it-f.ts --lokal [--server http://127.0.0.1:5316]
//
// Teil B/C schreiben NUR in die lokale Datenbank (Wache unten) und räumen ihre
// Zeilen am Ende weg; das Testkonto wird stillgelegt (AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import {
  auftragArtVon, kundeAusAuftrag, nameAusTitel, auftraegeSortieren, naechsterAuftrag, auftragStatus,
  eingangText, berlinTagZeit, vorTagen, artenFuerEreignis, AUFTRAG_ARTEN, AUFTRAG_ART_LISTE, AUFTRAG_EREIGNISSE,
  istAuftragArt, refAusLink, unterlagePasst, istKontaktEreignis, artStrenger, artNachInhalt, heikelArt, mailUebergabeGruende, MAIL_GRUENDE_KONTAKT,
  type AuftragEreignis,
} from "../shared/fiaon-auftrag-arten";

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund: unknown = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund !== "" ? `  →  ${typeof fund === "string" ? fund : JSON.stringify(fund)}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(76)}\n${t}\n${"─".repeat(76)}`); }

const LOKAL = process.argv.includes("--lokal");
const SERVER = (() => { const i = process.argv.indexOf("--server"); return i > 0 ? String(process.argv[i + 1] || "") : ""; })();

// ═══════════════════════════════════════════════════════════════════════════
// A. REIN
// ═══════════════════════════════════════════════════════════════════════════
function teilA(): void {
  titel("A1  Art aus Schlüssel, Quelle und Titel (alle gemessenen Formen)");
  const faelle: [Record<string, string | null>, string][] = [
    [{ schluessel: "postmeister:antwort:10986", quelle: "postmeister", titel: "Kunde hat geschrieben — bitte antworten" }, "mara_mail"],
    [{ schluessel: "postmeister:antwort:10986:betreiber", quelle: "postmeister", titel: "Zur Kenntnis (heikel): Kunde hat geschrieben" }, "mara_mail"],
    [{ schluessel: "postmeister:antwort:mail:5612", quelle: "postmeister", titel: "Kunde hat geschrieben" }, "mara_mail"],
    [{ schluessel: "postmeister:13223:aufgabe", quelle: "postmeister", titel: "Adresse von Isabela Petrisan ändern" }, "mara_aufgabe"],
    [{ schluessel: "postmeister:13223:aufgabe:2026-09-10", quelle: "postmeister", titel: "Bitte die Kundin zurückrufen" }, "mara_rueckruf"],
    [{ schluessel: "postmeister:13223:aufgabe-mensch", quelle: "postmeister", titel: "Abmeldung FIAON Global umsetzen — Kunde bitte anrufen" }, "mara_aufgabe"],
    [{ schluessel: "postmeister:11190:2026-09-24", quelle: "postmeister", titel: "Andrea Höfer: Hinweis von Mara" }, "mara_hinweis"],
    [{ schluessel: "postmeister:unbekannt:2026-09-24", quelle: "postmeister", titel: "Hinweis vom Postmeister" }, "mara_hinweis"],
    [{ schluessel: "postmeister:eskalation:FIAON-MT47KW23-8NV7", quelle: "postmeister", titel: "Zahlung verweigert — Anruf vor Eskalation" }, "mara_eskalation"],
    [{ schluessel: null, quelle: "postmeister", titel: "Zahlung verweigert — Anruf vor Eskalation" }, "mara_eskalation"],
    [{ schluessel: "postmeister:auskunft:13223", quelle: "postmeister", titel: "Hat keine Bonitätsauskunft — bitte heute nachfassen" }, "mara_auskunft"],
    [{ schluessel: "postmeister:kuendigung-nach-ende:FIAON-MPMFG4DM-S2EX", quelle: "postmeister", titel: "Entscheidung: Rate nach Vertragsende" }, "kuendigung"],
    [{ schluessel: "wa-11145-anliegen-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Anliegen — bitte übernehmen" }, "mara_wa_anliegen"],
    [{ schluessel: "wa-11145-heikel-2026-10-01:betreiber", quelle: "mara-whatsapp", titel: "Zur Kenntnis (heikel)" }, "mara_wa_heikel"],
    [{ schluessel: "wa-4366-geld-2026-10-01:vertreter", quelle: "mara-whatsapp", titel: "Rückruf (heikel)" }, "mara_wa_geld"],
    [{ schluessel: "wa-13183-rueckruf-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Rückruf-Wunsch" }, "mara_wa_rueckruf"],
    [{ schluessel: "wa-13507-pruefung-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Mara war unsicher" }, "mara_wa_pruefung"],
    [{ schluessel: "wa-4950-ki-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Mara konnte nicht antworten" }, "mara_wa_anliegen"],
    [{ schluessel: "wa-11145-2026-09-24", quelle: "mara-whatsapp", titel: "WhatsApp: bitte jetzt übernehmen" }, "mara_wa_anliegen"],
    [{ schluessel: "wa-n4917612345-anliegen-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Anliegen" }, "mara_wa_anliegen"],
    [{ schluessel: "wa-auskunft-13223-2026-09-25", quelle: "mara-whatsapp", titel: "Keine Auskunft" }, "mara_auskunft"],
    [{ schluessel: "antrag:FIAON-MS1MWM95-PJMM:unzustellbar", quelle: "antrag", titel: "Erstzahlung: E-Mail unzustellbar" }, "unzustellbar_erstzahlung"],
    [{ schluessel: "abo:FIAON-MT8HFA7L-PN5W:unzustellbar", quelle: "abo", titel: "Rate 2: E-Mail unzustellbar" }, "unzustellbar_rate"],
    [{ schluessel: "einladung-nachholen:FIAON-MTCY1CQB-NVHE", quelle: "system", titel: "Einladung zum Startgespräch ging nicht raus" }, "einladung_fehlt"],
    [{ schluessel: "bonitaet:FIAON-MRLWN0V3-ZJIS:loeschantrag", quelle: "bonitaet", titel: "Schreiben an SCHUFA versenden" }, "loeschantrag"],
    [{ schluessel: "app-antrag-versand:11", quelle: "kundenbereich", titel: "Antrag versenden" }, "vorgang"],
    [{ schluessel: "frist7:22", quelle: "kundenbereich", titel: "Frist" }, "vorgang"],
    [{ schluessel: "bewerbung:10", quelle: "website", titel: "Bewerbung: Alexander K — Produkt" }, "bewerbung"],
    [{ schluessel: "global:FIAON-MU5VQVYZ-A0BD:auftrag", quelle: "global", titel: "FIAON Global: neuer Auftrag" }, "global"],
    [{ schluessel: "bank-nachholen:teilzahlung:AWX-1", quelle: "bankbuch", titel: "Teilzahlung" }, "zahlung"],
    [{ schluessel: "auskunft-beschaffung:FIAON-SCHUFA-MUS1", quelle: "bestellung", titel: "Auskunft beschaffen" }, "auskunft"],
    [{ schluessel: "auskunft:FIAON-SCHUFA-X:offen-30", quelle: "auskunft", titel: "Auskunft seit 30 Tagen offen" }, "auskunft"],
    [{ schluessel: "kuendigung:5:unterschrieben", quelle: "kuendigung", titel: "hat die Kündigung unterschrieben" }, "kuendigung"],
    [{ schluessel: null, quelle: "hand", titel: "Dirk Ladewig: echten Kontoauszug anfordern — hochgeladen ist eine Gehaltsabrechnung" }, "unterlage"],
    [{ schluessel: null, quelle: "hand", titel: "Bitte Konto & Karte erklären" }, "konto_karte"],
    [{ schluessel: null, quelle: "hand", titel: "Bitte das Gespräch nachbereiten" }, "hand"],
    [{ schluessel: null, quelle: "kontakt", titel: "Kontaktanfrage über die Website" }, "kontakt"],
    [{ schluessel: "termintreue-termin-5", quelle: "termintreue", titel: "Termin" }, "verwaltung"],
    [{ schluessel: null, quelle: "Claude 24.08.2026", titel: "Make: Zweig anlegen" }, "verwaltung"],
    [{ schluessel: "mara-termin-pruefung-1759", quelle: "mara-whatsapp", titel: "Mara-Termin #1759 stimmt nicht" }, "verwaltung"],
    // Gegenprüfung 08.10.: bezahlte/gemeldete Auskunft = nur von Hand; Recht mit Frist nie als Rückruf.
    [{ schluessel: "postmeister:auskunft:13223", quelle: "postmeister", titel: "Anna Muster schreibt, die Bonitätsauskunft fehle — bitte heute klären" }, "auskunft_lieferung"],
    [{ schluessel: "postmeister:auskunft:13223", quelle: "postmeister", titel: "Hat keine Bonitätsauskunft — bitte nachfassen", text: "Laut Akte ist die Auskunft bezahlt (FIAON-SCHUFA-X) — bitte prüfen, wo die Lieferung steht" }, "auskunft_lieferung"],
    [{ schluessel: "postmeister:13223:aufgabe", quelle: "postmeister", titel: "Beschwerde – bitte zurückrufen" }, "beschwerde"],
    [{ schluessel: "postmeister:13223:aufgabe", quelle: "postmeister", titel: "Kunde verlangt Auskunft nach DSGVO — bitte melden" }, "beschwerde"],
    [{ schluessel: "wa-11145-rueckruf-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Kunde droht mit Anwalt — Rückruf" }, "beschwerde"],
    [{ schluessel: null, quelle: "kontakt", titel: "Beschwerde über die Beratung" }, "beschwerde"],
    [{ schluessel: null, quelle: "system", titel: "Datenschutzhinweis im Footer prüfen" }, "verwaltung"],
    // Gegenprüfung 08.10. (zweite Runde): Heikles schließt nie das System — auch nicht über Übergabegrund,
    // WhatsApp-Klasse, alten Tages-Schlüssel oder den Text eines Hinweises/Kontaktformulars.
    [{ schluessel: "postmeister:antwort:10986", quelle: "postmeister", titel: "Kunde hat geschrieben — bitte antworten", text: "Widerruf. Betreff „Vertrag“ an info@fiaon.com: Kunde widerruft. Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #5633]" }, "mara_mail_heikel"],
    [{ schluessel: "postmeister:antwort:10986", quelle: "postmeister", titel: "Kunde hat geschrieben — bitte antworten", text: "Mara hat einen Entwurf vorbereitet, aber nicht gesendet.. Betreff „Frage“ an info@fiaon.com: Wann kommt die Karte? Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #5634]" }, "mara_mail"],
    [{ schluessel: "postmeister:antwort:10986", quelle: "postmeister", titel: "Kunde hat geschrieben — bitte antworten", text: "Kunde möchte mit seinem Ansprechpartner sprechen. Betreff „Rückruf“ an info@fiaon.com: Bitte rufen Sie mich an. Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #5635]" }, "mara_mail"],
    [{ schluessel: "postmeister:antwort:10986", quelle: "postmeister", titel: "Kunde hat geschrieben — bitte antworten", text: "dringend. Betreff „Eilig“ an info@fiaon.com: Eilt. Mara hat … [Mail #1]\n\nBeschwerde. Betreff „Ärger“ an info@fiaon.com: Unzufrieden. Mara hat … [Mail #2]" }, "mara_mail_heikel"],
    [{ schluessel: "postmeister:antwort:10986", quelle: "postmeister", titel: "Kunde hat geschrieben — bitte antworten", text: "Freier Text ohne Mail-Marke" }, "mara_mail_heikel"],
    [{ schluessel: "wa-11145-loeschen-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Löschwunsch (Daten löschen) — bitte jetzt übernehmen" }, "mara_wa_heikel"],
    [{ schluessel: "wa-11145-bestreitet-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Kunde bestreitet Antrag — bitte jetzt übernehmen" }, "mara_wa_heikel"],
    [{ schluessel: "wa-11145-in_ruhe-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Will keinen Kontakt mehr — bitte übernehmen" }, "mara_wa_heikel"],
    [{ schluessel: "wa-11145-wut-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Verärgert — bitte ansehen — bitte übernehmen" }, "mara_wa_heikel"],
    [{ schluessel: "wa-11145-global-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: FIAON Global — Mara antwortet nicht" }, "global"],
    [{ schluessel: "wa-11145-rueckfrage-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Weiß nicht, wofür er zahlen soll — bitte jetzt übernehmen" }, "mara_wa_geld"],
    [{ schluessel: "wa-11145-falsche_nummer-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Falsche Nummer — bitte korrigieren — bitte jetzt übernehmen" }, "mara_aufgabe"],
    [{ schluessel: "wa-11145-2026-09-24", quelle: "mara-whatsapp", titel: "WhatsApp: Kündigung, Widerruf oder Beschwerde — bitte jetzt übernehmen" }, "beschwerde"],
    [{ schluessel: "wa-11145-2026-09-24", quelle: "mara-whatsapp", titel: "WhatsApp: bitte jetzt übernehmen", text: "Kunde will den Vertrag widerrufen." }, "kuendigung"],
    [{ schluessel: "wa-11145-anliegen-2026-10-01", quelle: "mara-whatsapp", titel: "WhatsApp: Anliegen — bitte übernehmen", text: "Kunde möchte sein Geld zurück." }, "beschwerde"],
    [{ schluessel: "postmeister:11190:2026-09-24", quelle: "postmeister", titel: "Andrea Höfer: Hinweis von Mara", text: "Kundin verlangt eine Erstattung der ersten Rate." }, "beschwerde"],
    [{ schluessel: "postmeister:11190:2026-09-24", quelle: "postmeister", titel: "Andrea Höfer: Hinweis von Mara", text: "Mara hat die Ankündigung der zweiten Rate geschickt." }, "mara_hinweis"],
    [{ schluessel: null, quelle: "kontakt", titel: "Kontaktanfrage über die Website", text: "Hiermit widerrufe ich meinen Vertrag." }, "kuendigung"],
    [{ schluessel: "postmeister:13223:aufgabe", quelle: "postmeister", titel: "Fake-Vorwurf — bitte klären" }, "beschwerde"],
  ];
  for (const [z, soll] of faelle) {
    const ist = auftragArtVon(z);
    ok(`${String(z.schluessel ?? `(ohne Schlüssel, ${z.quelle})`).slice(0, 52).padEnd(52)} → ${soll}`, ist === soll, ist);
  }
  ok("Jede Art im Katalog hat ein Label, und die Liste ist vollständig", AUFTRAG_ART_LISTE.every((a) => istAuftragArt(a) && AUFTRAG_ARTEN[a].label.length > 3));

  titel("A2  Kunde aus Link und Schlüssel — nie die Mail-Kennung als Person");
  const k1 = kundeAusAuftrag({ link: "/agent/kunden?person=10986", schluessel: "postmeister:antwort:10986" });
  ok("Link ?person= → Person aus dem Link", k1.personId === 10986 && k1.personQuelle === "link", k1);
  const k2 = kundeAusAuftrag({ link: "/agent/pipeline?ref=FIAON-X&person=77", schluessel: null });
  ok("Link mit ?…&person= → Person", k2.personId === 77, k2);
  const k3 = kundeAusAuftrag({ link: "/chef/s/whatsapp", schluessel: "wa-11145-2026-09-24" });
  ok("WhatsApp-Schlüssel wa-<p>- (Altform) → Person", k3.personId === 11145 && k3.personQuelle === "schluessel", k3);
  const k4 = kundeAusAuftrag({ link: null, schluessel: "wa-auskunft-13223-2026-09-25" });
  ok("wa-auskunft-<p>- → Person", k4.personId === 13223, k4);
  const k5 = kundeAusAuftrag({ link: null, schluessel: "wa-n4917612345-anliegen-2026-10-01" });
  ok("wa-n<nummer> (ohne Person) → keine Person", k5.personId === null, k5);
  const k6 = kundeAusAuftrag({ link: "/admin/kunde/FIAON-MS1MWM95-PJMM", schluessel: "postmeister:5612:aufgabe" });
  ok("postmeister:<n>:aufgabe → NIE Person (Mail-Kennung) — Referenz aus dem Link", k6.personId === null && k6.ref === "FIAON-MS1MWM95-PJMM", k6);
  const k7 = kundeAusAuftrag({ link: null, schluessel: "postmeister:5612:aufgabe", text: "Grund. Betreff „Hallo“ an info@: … [Mail #5612]" });
  ok("Mail-Marke [Mail #id] wird erkannt (für fiaon_postmeister.person_id)", k7.mailId === 5612 && k7.personId === null, k7);
  const k8 = kundeAusAuftrag({ link: null, schluessel: "abo:FIAON-MT8HFA7L-PN5W:unzustellbar" });
  ok("Referenz aus dem Schlüssel (abo:<ref>:unzustellbar)", k8.ref === "FIAON-MT8HFA7L-PN5W", k8);
  ok("refAusLink: /chef/s/akte?ref=… und /admin/kunde/…", refAusLink("/chef/s/akte?ref=FIAON-MOK20XNL-KL2A") === "FIAON-MOK20XNL-KL2A" && refAusLink("/admin/kunde/fiaon-abc123-x") === "FIAON-ABC123-X");

  titel("A3  Name aus dem Titel, wenn es keinen Kunden gibt");
  ok("„Andrea Höfer: Hinweis von Mara“ → Andrea Höfer", nameAusTitel("Andrea Höfer: Hinweis von Mara") === "Andrea Höfer", nameAusTitel("Andrea Höfer: Hinweis von Mara"));
  ok("„Einladung … ging nicht raus — Frank Von Overheidt“ → Name", nameAusTitel("Einladung zum Startgespräch ging nicht raus — Frank Von Overheidt") === "Frank Von Overheidt");
  ok("„Bewerbung: Alexander Claude Kroeg — Produkt & Technik“ → Name", nameAusTitel("Bewerbung: Alexander Claude Kroeg — Produkt & Technik") === "Alexander Claude Kroeg", nameAusTitel("Bewerbung: Alexander Claude Kroeg — Produkt & Technik"));
  ok("„WhatsApp: Anliegen — bitte übernehmen“ → kein Name", nameAusTitel("WhatsApp: Anliegen — bitte übernehmen") === null, nameAusTitel("WhatsApp: Anliegen — bitte übernehmen"));
  ok("„Zur Kenntnis (heikel): …“ → kein Name", nameAusTitel("Zur Kenntnis (heikel): Kunde hat geschrieben — bitte antworten") === null);
  ok("„Rate 2: E-Mail unzustellbar — Adresse klären oder anrufen“ → kein Name", nameAusTitel("Rate 2: E-Mail unzustellbar — Adresse klären oder anrufen") === null, nameAusTitel("Rate 2: E-Mail unzustellbar — Adresse klären oder anrufen"));
  ok("„… — Anna von der Heide“ → Name mit Partikel", nameAusTitel("Einladung ging nicht raus — Anna von der Heide") === "Anna von der Heide", nameAusTitel("Einladung ging nicht raus — Anna von der Heide"));

  titel("A4  Die EINE Reihenfolge und der nächste Auftrag");
  const L = [
    { id: 5, status: "offen", prioritaet: 2, eingangAm: "2026-09-04T08:00:00Z" },
    { id: 3, status: "offen", prioritaet: 1, eingangAm: "2026-10-07T08:00:00Z" },
    { id: 4, status: "offen", prioritaet: 1, eingangAm: "2026-09-10T08:00:00Z" },
    { id: 9, status: "wartet", prioritaet: 1, frageOffen: true, eingangAm: "2026-08-01T08:00:00Z" },
    { id: 7, status: "in_arbeit", prioritaet: 2, frageAnAgent: true, eingangAm: "2026-10-08T08:00:00Z" },
    { id: 2, status: "offen", prioritaet: 2, eingangAm: "2026-09-04T08:00:00Z" },
    { id: 8, status: "erledigt", prioritaet: 1, eingangAm: "2026-08-01T08:00:00Z" },
  ];
  const alt = auftraegeSortieren(L, "alt").map((a) => a.id);
  ok("älteste zuerst: Frage an mich · dringend (alt→neu) · Rest (alt→neu, Gleichstand nach Kennung) · wartet · erledigt", JSON.stringify(alt) === JSON.stringify([7, 4, 3, 2, 5, 9, 8]), alt);
  const neu = auftraegeSortieren(L, "neu").map((a) => a.id);
  ok("neueste zuerst: innerhalb der Gruppen umgedreht", JSON.stringify(neu) === JSON.stringify([7, 3, 4, 5, 2, 9, 8]), neu);
  ok("zweimal sortiert = dieselbe Reihenfolge (stabil)", JSON.stringify(auftraegeSortieren([...L].reverse(), "alt").map((a) => a.id)) === JSON.stringify(alt));
  ok("nächster: nicht erledigt, nicht „wartet“", naechsterAuftrag(L, [], "alt")?.id === 7);
  ok("nächster ohne den eben geschlossenen", naechsterAuftrag(L, [7], "alt")?.id === 4);
  ok("nächster ohne mehrere", naechsterAuftrag(L, [7, 4, 3, 2, 5], "alt") === null);
  const F = [
    { id: 21, status: "offen", prioritaet: 1, eingangAm: "2026-09-02T08:00:00Z" },
    { id: 22, status: "offen", prioritaet: 1, art: "mara_wa_heikel", eingangAm: "2026-10-08T08:00:00Z" },
    { id: 23, status: "offen", prioritaet: 2, art: "kuendigung", eingangAm: "2026-10-08T09:00:00Z" },
    { id: 24, status: "offen", prioritaet: 2, art: "mara_hinweis", frageAnAgent: true, eingangAm: "2026-10-08T10:00:00Z" },
    { id: 25, status: "offen", prioritaet: 1, art: "beschwerde", eingangAm: "2026-10-07T08:00:00Z" },
  ];
  const fr = auftraegeSortieren(F, "alt").map((a) => a.id);
  ok("Recht mit Frist (Widerruf, Kündigung, Beschwerde) vor dringenden Altfällen — nach „Justin fragt dich“", JSON.stringify(fr) === JSON.stringify([24, 25, 22, 23, 21]), fr);
  ok("nächster Auftrag = der heikle Neueingang, nicht der Altfall", naechsterAuftrag(F, [24], "alt")?.id === 25);
  ok("Eingang fehlt → createdAt zählt", auftraegeSortieren([{ id: 1, status: "offen", createdAt: "2026-10-02T00:00:00Z" }, { id: 2, status: "offen", createdAt: "2026-10-01T00:00:00Z" }], "alt")[0].id === 2);

  titel("A5  Spalte „Status“");
  ok("erledigt von Hand", auftragStatus({ status: "erledigt", erledigtArt: "hand", erledigtVon: "Daniel" }).text === "Erledigt" && auftragStatus({ status: "erledigt", erledigtArt: "hand", erledigtVon: "Daniel" }).grund === "von Daniel");
  const auto = auftragStatus({ status: "erledigt", erledigtArt: "auto", erledigtEreignis: "Gesprächsergebnis erfasst – Daniel" });
  ok("automatisch erledigt mit Ereignis", auto.text === "Automatisch erledigt" && auto.grund === "Gesprächsergebnis erfasst – Daniel", auto);
  ok("Frage an mich vor allem", auftragStatus({ status: "offen", frageAnAgent: true, ungelesen: true }).text === "Justin fragt dich");
  ok("wartet auf Justin", auftragStatus({ status: "wartet", frageOffen: true }).ton === "wartet");
  const w = auftragStatus({ status: "offen", wiederOffenAm: "2026-10-08T10:00:00Z", wiederOffenGrund: "neue Meldung von Mara" });
  ok("wieder offen MIT Grund", w.text === "Wieder offen" && w.grund === "neue Meldung von Mara", w);
  ok("neu / in Arbeit / offen", auftragStatus({ status: "offen", ungelesen: true }).text === "Neu" && auftragStatus({ status: "in_arbeit" }).text === "In Arbeit" && auftragStatus({ status: "offen" }).text === "Offen");

  titel("A6  „Eingang: TT.MM. HH:MM“ in Berliner Zeit");
  ok("Sommerzeit: 12:32 UTC → 14:32", eingangText("2026-10-08T12:32:00Z") === "Eingang: 08.10. 14:32", eingangText("2026-10-08T12:32:00Z"));
  ok("Winterzeit: 09:05 UTC → 10:05", eingangText("2026-12-01T09:05:00Z") === "Eingang: 01.12. 10:05", eingangText("2026-12-01T09:05:00Z"));
  ok("Zeitumstellung 25.10.: 00:30 UTC → 02:30, 01:30 UTC → 02:30", berlinTagZeit("2026-10-25T00:30:00Z") === "25.10. 02:30" && berlinTagZeit("2026-10-25T01:30:00Z") === "25.10. 02:30");
  ok("Mitternacht Berlin: 22:10 UTC (Sommer) → nächster Tag 00:10", berlinTagZeit("2026-09-30T22:10:00Z") === "01.10. 00:10", berlinTagZeit("2026-09-30T22:10:00Z"));
  ok("ohne Zeit → „unbekannt“, nie „NaN“", eingangText(null) === "Eingang: unbekannt" && eingangText("kaputt") === "Eingang: unbekannt");
  const jetzt = new Date("2026-10-08T10:00:00Z");
  ok("vor Tagen nach Kalendertagen", vorTagen("2026-10-08T05:00:00Z", jetzt) === "heute" && vorTagen("2026-10-07T21:00:00Z", jetzt) === "gestern" && vorTagen("2026-09-04T08:00:00Z", jetzt) === "vor 34 Tagen", [vorTagen("2026-10-07T21:00:00Z", jetzt), vorTagen("2026-09-04T08:00:00Z", jetzt)]);

  titel("A7  Ereignisse: wer schließt was — nie eine nurHand-Art");
  for (const e of Object.keys(AUFTRAG_EREIGNISSE) as AuftragEreignis[]) {
    const a = artenFuerEreignis(e);
    ok(`${e.padEnd(22)} schließt [${a.join(", ") || "nichts"}] — keine nurHand-Art`, a.every((x) => !AUFTRAG_ARTEN[x].nurHand));
  }
  ok("ein erfolgloser Versuch schließt nichts", artenFuerEreignis("ergebnis_versuch").length === 0);
  ok("Gesprächsergebnis schließt Rückruf/Hinweis/WhatsApp-Anliegen, nicht heikel/Geld/Eskalation/Aufgabe",
    ["mara_rueckruf", "mara_hinweis", "mara_wa_anliegen", "mara_wa_rueckruf", "mara_wa_pruefung", "mara_mail", "einladung_fehlt"].every((x) => artenFuerEreignis("ergebnis_erreicht").includes(x as any))
    && !["mara_wa_heikel", "mara_wa_geld", "mara_eskalation", "mara_aufgabe", "loeschantrag", "kuendigung", "vorgang", "zahlung"].some((x) => artenFuerEreignis("ergebnis_erreicht").includes(x as any)));
  // Integration 08.10.2026: dazu „Zahlung gemeldet, nicht da – klären“ (Stufe A, Mara-Topsales) — die gebuchte Zahlung IST die Klärung.
  ok("Zahlung gebucht schließt nur „Erstzahlung: E-Mail unzustellbar“ und die Stufe-A-Klärung — eine Rate heilt die Adresse nicht", JSON.stringify(artenFuerEreignis("zahlung_gebucht")) === JSON.stringify(["stufe_a_klaeren", "unzustellbar_erstzahlung"]) && AUFTRAG_ARTEN.unzustellbar_rate.schliesstBei.length === 0, artenFuerEreignis("zahlung_gebucht"));
  ok("Stufe-A-Klärung (antrag:<ref>:a-klaeren) hat ihre Art; ein Versuch schließt sie nie", auftragArtVon({ schluessel: "antrag:FIAON-X1:a-klaeren", quelle: "antrag", titel: "Zahlung gemeldet, nicht da — anrufen und klären" }) === "stufe_a_klaeren" && !artenFuerEreignis("ergebnis_versuch").includes("stufe_a_klaeren") && artenFuerEreignis("ergebnis_erreicht").includes("stufe_a_klaeren"));
  ok("„Unterlage erhalten“ schließt keine Auskunft-Aufträge (Ausweis ≠ Auskunft, eigene Auskunft = Leistung klären)", !artenFuerEreignis("unterlage_erhalten").some((a) => a === "mara_auskunft" || a === "auskunft_lieferung"));
  ok("bezahlte Auskunft und Beschwerde: nur von Hand, Recht mit Frist", AUFTRAG_ARTEN.auskunft_lieferung.nurHand && AUFTRAG_ARTEN.beschwerde.nurHand && !!AUFTRAG_ARTEN.beschwerde.frist && !!AUFTRAG_ARTEN.kuendigung.frist && !!AUFTRAG_ARTEN.mara_wa_heikel.frist);
  ok("Kontakt-Ereignisse vs. Tatsachen", istKontaktEreignis("ergebnis_erreicht") && istKontaktEreignis("whatsapp_beantwortet") && !istKontaktEreignis("zahlung_gebucht") && !istKontaktEreignis("unterlage_erhalten") && !istKontaktEreignis("kartenlink_gesendet"));
  ok("Unterlage passt: Kontoauszug-Auftrag + Ausweis → nein", !unterlagePasst({ titel: "Kontoauszug fehlt – bitte anfordern" }, "Ausweis"));
  ok("Unterlage passt: Kontoauszug-Auftrag + Kontoauszug → ja", unterlagePasst({ titel: "Kontoauszug fehlt – bitte anfordern" }, "Kontoauszug"));
  ok("Unterlage passt: „echten Kontoauszug anfordern — hochgeladen ist eine Gehaltsabrechnung“ + Kontoauszug → ja", unterlagePasst({ titel: "Dirk Ladewig: echten Kontoauszug anfordern — hochgeladen ist eine Gehaltsabrechnung" }, "Kontoauszug"));
  ok("Unterlage passt: Titel ohne Unterlage, Text nennt den Ausweis → Ausweis ja, Kontoauszug nein", unterlagePasst({ titel: "Unterlage fehlt – bitte anfordern", text: "Bitte den Ausweis anfordern." }, "Ausweis") && !unterlagePasst({ titel: "Unterlage fehlt – bitte anfordern", text: "Bitte den Ausweis anfordern." }, "Kontoauszug"));
  ok("Unterlage passt: Auftrag nennt keine Unterlage → nie automatisch", !unterlagePasst({ titel: "Unterlagen fehlen – bitte anfordern" }, "Ausweis, Kontoauszug"));
  ok("WhatsApp-Antwort schließt nie „Kunde hat geschrieben (E-Mail)“ (Entwurf!)", !artenFuerEreignis("whatsapp_beantwortet").includes("mara_mail"));
  ok("WhatsApp-Antwort schließt keinen Rückrufwunsch und keinen Hinweis — nur Anliegen und „Mara war unsicher“",
    !["mara_rueckruf", "mara_wa_rueckruf", "mara_hinweis"].some((x) => artenFuerEreignis("whatsapp_beantwortet").includes(x as any))
    && ["mara_wa_anliegen", "mara_wa_pruefung"].every((x) => artenFuerEreignis("whatsapp_beantwortet").includes(x as any)), artenFuerEreignis("whatsapp_beantwortet"));
  ok("„Kunde hat geschrieben: Beschwerde, Widerruf o. Ä.“ nur von Hand, mit Satz", AUFTRAG_ARTEN.mara_mail_heikel.nurHand && AUFTRAG_ARTEN.mara_mail_heikel.ergebnisPflicht);
  ok("artNachInhalt: gespeicherter Hinweis ohne Schlüssel + „Erstattung“ im Text → Beschwerde; „Kunde hat geschrieben“ + Widerruf-Block → heikel",
    artNachInhalt("mara_hinweis", { titel: "Hinweis", text: "Kundin verlangt eine Erstattung." }) === "beschwerde"
    && artNachInhalt("mara_mail", { text: "Widerruf. Betreff „x“ an info@fiaon.com: y [Mail #3]" }) === "mara_mail_heikel"
    && artNachInhalt("mara_hinweis", { titel: "Hinweis", text: "Karte kommt morgen." }) === "mara_hinweis");
  ok("artStrenger: gespeichert auto + jetzt heikel → heikel; nie umgekehrt; „sonstiges“ verdrängt nichts",
    artStrenger("mara_mail", "mara_mail_heikel") === "mara_mail_heikel" && artStrenger("mara_wa_heikel", "mara_wa_anliegen") === "mara_wa_heikel"
    && artStrenger("mara_hinweis", "sonstiges") === "mara_hinweis" && artStrenger(null, "mara_hinweis") === "mara_hinweis");
  ok("heikelArt: Ankündigung ≠ Kündigung; Vertragskündigung, Storno, DSGVO, Erstattung erkannt",
    heikelArt("Ankündigung der Rate") === null && heikelArt("Vertragskündigung") === "kuendigung" && heikelArt("Storno bitte") === "kuendigung"
    && heikelArt("Auskunft nach DSGVO") === "beschwerde" && heikelArt("Rückerstattung") === "beschwerde" && heikelArt("Wann kommt die Karte?") === null);
  // Fertigstellung 08.10. (Nachprüfung, Blocker): Sammelgrund „Zentrale“/„Ansprechpartner“ mit heiklem INHALT.
  const zentrale = (betreff: string, zus: string) => `Kunde wartet auf eine Antwort (Entwurf lag in der Zentrale). Betreff „${betreff}“ an welcome@fiaon.com: ${zus} Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #3289]`;
  ok("„Kunde hat geschrieben“: Grund Zentrale + Betreff „Widerruf liegt lange vor“ → nur von Hand (Art und artNachInhalt)",
    auftragArtVon({ schluessel: "postmeister:antwort:1", titel: "Kunde hat geschrieben — bitte antworten", text: zentrale("Widerruf liegt lange vor", "Der Kunde erklärt, der Vertrag sei beendet.") }) === "mara_mail_heikel"
    && artNachInhalt("mara_mail", { schluessel: "postmeister:antwort:1", text: zentrale("Widerruf liegt lange vor", "Der Kunde erklärt, der Vertrag sei beendet.") }) === "mara_mail_heikel");
  ok("„Kunde hat geschrieben“: Grund Zentrale + Anwaltsdrohung / Bestreiten / DSGVO-Löschung → nur von Hand",
    ["Sie droht, die Angelegenheit an ihren Anwalt zu geben.", "Der Kunde bestreitet die Anmeldung.", "Die Kundin möchte, dass sämtliche Kontaktdaten gelöscht werden."]
      .every((z) => artNachInhalt("mara_mail", { text: zentrale("Re: Ihre Zahlung", z) }) === "mara_mail_heikel"));
  ok("„Kunde hat geschrieben“: Grund Ansprechpartner + „möchte den Antrag stornieren“ → nur von Hand",
    artNachInhalt("mara_mail", { text: "Kunde möchte mit seinem Ansprechpartner sprechen. Betreff „x“ an welcome@fiaon.com: Der Kunde möchte seine Anfrage und den Antrag stornieren. [Mail #13323]" }) === "mara_mail_heikel");
  ok("„Kunde hat geschrieben“: Grund Zentrale + harmlose Frage → bleibt automatisch schließbar",
    artNachInhalt("mara_mail", { text: zentrale("Wann kommt die Karte?", "Der Kunde fragt, wann die Karte kommt.") }) === "mara_mail"
    && auftragArtVon({ schluessel: "postmeister:antwort:1", titel: "Kunde hat geschrieben — bitte antworten", text: zentrale("Wann kommt die Karte?", "Der Kunde fragt, wann die Karte kommt.") }) === "mara_mail");
  ok("heikelArt (Messung 08.10.): Löschung der Daten, „nicht mehr kontaktiert“, „keine weitere Kontaktaufnahme“, rechtliche Schritte, Gericht → Beschwerde",
    heikelArt("Herr H. bittet um Löschung seiner Anfrage und Entfernung seiner Daten.") === "beschwerde"
    && heikelArt("…und nicht mehr kontaktiert werden möchte.") === "beschwerde" && heikelArt("möchte keine weitere Kontaktaufnahme durch Florentine") === "beschwerde"
    && heikelArt("kündigt rechtliche Schritte an") !== null && heikelArt("Brief vom Gericht") === "beschwerde");
  ok("heikelArt: „Starter Abo beenden“, „Vertrag beenden“ → Kündigung; „eingerichtetes Konto“, „Bankeinzug eingerichtet“ → nichts",
    heikelArt("Kunde möchte sein FIAON Starter Abo beenden") === "kuendigung" && heikelArt("ob er den Vertrag beenden möchte") === "kuendigung"
    && heikelArt("er verweist auf ein von Justin eingerichtetes Konto") === null && heikelArt("wie der Bankeinzug eingerichtet wird") === null
    && heikelArt("Gespräch beenden") === null);
  ok("Recht und Lage verlangen einen Satz", AUFTRAG_ARTEN.mara_wa_heikel.ergebnisPflicht && AUFTRAG_ARTEN.loeschantrag.ergebnisPflicht && AUFTRAG_ARTEN.unzustellbar_rate.ergebnisPflicht && AUFTRAG_ARTEN.einladung_fehlt.ergebnisPflicht && !AUFTRAG_ARTEN.mara_hinweis.ergebnisPflicht);
}

async function teilA8(): Promise<void> {
  titel("A8  Gesprächs- und Ratenergebnis → Ereignis (eine Übersetzung)");
  process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
  const { ereignisAusErgebnis, ereignisAusRatenErgebnis } = await import("../server/lib/fiaon-auftraege");
  ok("erreicht_* und rueckruf_termin → ergebnis_erreicht", ["erreicht_zahlt_gleich", "erreicht_zahlt_am", "erreicht_abgelehnt", "erreicht_sonstiges", "rueckruf_termin"].every((e) => ereignisAusErgebnis(e) === "ergebnis_erreicht"));
  ok("nicht_erreicht/mailbox/nummer_falsch → Versuch", ["nicht_erreicht", "mailbox", "nummer_falsch"].every((e) => ereignisAusErgebnis(e) === "ergebnis_versuch"));
  ok("nummer_blockiert und Notiz → kein Ereignis", ereignisAusErgebnis("nummer_blockiert") === null && ereignisAusErgebnis(null) === null);
  ok("Raten: zahlt_am/beleg/pause/eskalation → erreicht; nicht_erreicht → Versuch; blockiert → nichts",
    ["zahlt_am", "ueberwiesen_beleg", "ratenpause", "eskalation"].every((e) => ereignisAusRatenErgebnis(e) === "ergebnis_erreicht")
    && ereignisAusRatenErgebnis("nicht_erreicht") === "ergebnis_versuch" && ereignisAusRatenErgebnis("nummer_blockiert") === null);

  titel("A8b Übergabegründe: eine Lesart mit dem Postmeister (fiaon-postmeister-lauf.ts)");
  const PL = await import("../server/lib/fiaon-postmeister-lauf");
  const grundWerte = Object.values(PL.UEBERGABE_GRUND) as string[];
  ok("Jeder „Kontakt“-Grund steht wörtlich in UEBERGABE_GRUND, und GRUENDE_NUR_ANTWORT ist darin enthalten",
    MAIL_GRUENDE_KONTAKT.every((g) => grundWerte.includes(g)) && PL.GRUENDE_NUR_ANTWORT.every((g) => MAIL_GRUENDE_KONTAKT.includes(g)), MAIL_GRUENDE_KONTAKT);
  ok("Heikle Gründe (Beschwerde, Widerruf, bestreitet, rechtlich, Kündigung, kann nicht zahlen, Mensch, Global) sind kein „Kontakt“-Grund",
    [PL.UEBERGABE_GRUND.beschwerde, PL.UEBERGABE_GRUND.widerruf, PL.UEBERGABE_GRUND.bestreitet, PL.UEBERGABE_GRUND.rechtlich, PL.UEBERGABE_GRUND.kuendigung,
      PL.UEBERGABE_GRUND.zahlungsunfaehig, PL.UEBERGABE_GRUND.mensch, PL.UEBERGABE_GRUND.global, PL.UEBERGABE_GRUND.vorgeschichte].every((g) => !MAIL_GRUENDE_KONTAKT.includes(g)));
  const bl = [PL.uebergabeBlock({ id: 7, postfach: "info@fiaon.com", betreff: "A", zusammenfassung: "x", grund: PL.UEBERGABE_GRUND.entwurf }),
    PL.uebergabeBlock({ id: 8, postfach: "info@fiaon.com", betreff: "B", zusammenfassung: "y", grund: PL.UEBERGABE_GRUND.widerruf })].join("\n\n");
  ok("mailUebergabeGruende liest dieselben Gründe wie uebergabeBloecke", JSON.stringify(mailUebergabeGruende(bl)) === JSON.stringify((PL.uebergabeBloecke(bl) ?? []).map((b) => b.grund)), mailUebergabeGruende(bl));
  ok("… und ein Block mit Widerruf macht die Übergabe „nur von Hand“", auftragArtVon({ schluessel: "postmeister:antwort:1", text: bl }) === "mara_mail_heikel");

  titel("A9  Bedienbar: die Knöpfe stehen in der Oberfläche (Quelltext; Browserabnahme siehe Bericht)");
  const todoRoute = readFileSync("server/routes/fiaon-betreiber-todo.ts", "utf8");
  ok("Erledigt bei „Kunde hat geschrieben“ verwirft Maras Entwurf (uebergabeEntwuerfeUebernehmen + entwurfLoeschen)",
    /uebergabeEntwuerfeUebernehmen\(t\.text/.test(todoRoute) && todoRoute.includes("entwurfLoeschen(v.postfach, v.draftId)"));
  ok("Auskunft-Rückstand: jede Meldung trägt „Neu übernommen …“ (öffnet die Sammelaufgabe wieder)",
    readFileSync("server/lib/fiaon-auskunft-lieferung.ts", "utf8").includes("Neu übernommen: ${neu}"));
  ok("Mara „an die Leitung“ / genannter Kollege: vorrang gesetzt (Postfach und WhatsApp)",
    readFileSync("server/lib/fiaon-postmeister-werkzeuge.ts", "utf8").includes("vorrang: !zahlungGewollt && !vtUeb && !!gewuenscht?.id")
    && readFileSync("server/lib/fiaon-whatsapp-mara.ts", "utf8").includes("{ agentId: leitung, vorrang: true }"));
  const tasks = readFileSync("client/src/pages/agent/tasks.tsx", "utf8");
  const leiste = readFileSync("client/src/components/AuftragLeiste.tsx", "utf8");
  const popup = readFileSync("client/src/components/AufgabenErinnerung.tsx", "utf8");
  const rg = readFileSync("client/src/pages/agent/rundgaenge.ts", "utf8");
  const board = readFileSync("client/src/pages/admin-todo.tsx", "utf8");
  ok("Liste: Spalten Kunde · Art · Eingang · Status", /columnheader">Kunde<.*columnheader">Art<.*columnheader">Eingang<.*columnheader">Status</s.test(tasks));
  ok("Liste: Umschalter „Älteste zuerst“/„Neueste zuerst“", tasks.includes("Älteste zuerst") && tasks.includes("Neueste zuerst"));
  ok("Liste: „Erledigt“ in jeder Zeile, „Ich mach das“ nicht mehr angeboten", /className="ta-knopf gut klein"[^>]*onClick=\{\(\) => void onErledigen\(\)\}/.test(tasks) && !tasks.includes("Ich mach das<"));
  ok("Liste: nach „Erledigt“ den nächsten aufklappen (naechsterAuftrag)", tasks.includes("naechsterAufklappen([a.id], r.json?.naechster"));
  ok("Liste: Reiter „Erledigt“ zeigt Aufträge mit „Wieder öffnen“", tasks.includes("ErledigteAuftraege") && tasks.includes("wieder-oeffnen"));
  ok("Liste: kein Block „Zuletzt erledigt (n)“ mehr im Reiter „Aufträge“", !tasks.includes("Zuletzt erledigt ({"));
  ok("Liste: Neuladen bei Fokus, Sichtbarkeit, pageshow, Takt", tasks.includes('addEventListener("focus"') && tasks.includes('"visibilitychange"') && tasks.includes('"pageshow"') && tasks.includes("TAKT_MS"));
  ok("Liste: Akte per App-Navigation (wouter Link) mit &auftrag=", tasks.includes("<Link href={akte}") && tasks.includes("&auftrag=${a.id}"));
  ok("Akte-Leiste hängt am Office-Rahmen (AufgabenErinnerung)", popup.includes("<AuftragLeiste />") && leiste.includes("Nächster Auftrag →") && leiste.includes("fiaon-akte-oeffnen"));
  ok("Popup verwirft seine gemerkte Lage bei jeder Änderung", popup.includes('addEventListener("agent-aufgaben-geaendert", () => { letzteLage = null; })'));
  ok("Rundgang „Tasks“ angelegt und auf der Seite eingebunden", rg.includes("RUNDGANG_TASKS") && rg.includes("tasks:       { titel: \"Tasks\"") && tasks.includes("RUNDGAENGE.tasks"));
  ok("Board zeigt Kunde · Art · Eingang", board.includes("td-kunde") && board.includes("eingangText("));
  // Fertigstellung 08.10.: Gegenprüfung Funde 14 und 15, Update-Text „nur ankündigen, was live ist“.
  ok("Liste: eine Antwort, die vor „Erledigt“ angefragt wurde, holt die Zeile nicht zurück (Stand-Zähler)",
    tasks.includes("if (r.ok && beimStart !== stand.current) return;") && (tasks.match(/stand\.current \+= 1/g) || []).length >= 3);
  ok("Akte-Leiste: gehört der Auftrag zu einem anderen Kunden als ?person=, keine Leiste (kein „Erledigt“ beim Falschen)",
    leiste.includes("if (personInAdresse && a.personId && personInAdresse !== a.personId) return null;"));
  ok("Update verspricht den Kundennamen nur bei „fast jedem Auftrag“", readFileSync("client/src/pages/agent/updates-data.ts", "utf8").includes("Der Kundenname steht jetzt bei fast jedem Auftrag")
    && !readFileSync("client/src/pages/agent/updates-data.ts", "utf8").includes("Der Kundenname steht jetzt bei jedem Auftrag"));
  ok("WhatsApp: dieselbe Bitte nach „Erledigt“ am selben Tag wird mit Zeit neu (öffnet wieder)", readFileSync("server/lib/fiaon-whatsapp-mara.ts", "utf8").includes("(erneut gemeldet ${berlinTagZeit(new Date())})"));
  ok("Anhängen atomar (strpos/CONCAT_WS in derselben Anweisung)", todoRoute.includes("strpos(COALESCE(text, ''), ${text}::text) > 0 THEN text"));
}

// ═══════════════════════════════════════════════════════════════════════════
// B. LOKAL
// ═══════════════════════════════════════════════════════════════════════════
async function teilB(): Promise<{ aufraeumen: () => Promise<void>; daten: any }> {
  const url = String(process.env.DATABASE_URL || "");
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("Teil B/C nur gegen eine LOKALE Datenbank — DATABASE_URL zeigt woanders hin.");
  const { sqlPool } = await import("../server/lib/db-pool");
  const T = await import("../server/routes/fiaon-betreiber-todo");
  const A = await import("../server/lib/fiaon-auftraege");
  await T.ensureTodoTabelle();
  A.statusWandVergessen();
  const MARKE = `PRUEFSTAND-IT-F-${Date.now().toString(36)}`;
  const todoIds: number[] = [];
  const personIds: number[] = [];
  const refs: string[] = [];
  const zusatz: { tabelle: string; id: number }[] = [];
  const merke = (id: number | null | undefined) => { if (id) todoIds.push(Number(id)); return Number(id); };
  const todo = async (f: Record<string, any>) => {
    const [r] = (await sqlPool`
      INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, link, quelle, status, zustaendig_art, zustaendig_agent_id, zustaendig_name,
                                         erledigt_am, erledigt_von, ergebnis, person_id, ref, art, zugeordnet_am, frage_an_agent, created_at)
      VALUES (${f.schluessel ?? null}, ${f.titel ?? `${MARKE} Auftrag`}, ${f.text ?? null}, ${f.bereich ?? "postmeister"}, ${f.prioritaet ?? 2}, ${f.link ?? null}, ${f.quelle ?? "postmeister"},
              ${f.status ?? "offen"}, ${f.zustaendig_art ?? "agent"}, ${f.agent ?? 8}, ${f.agentName ?? "Daniel Stripling"},
              ${f.erledigt_am ?? null}, ${f.erledigt_von ?? null}, ${f.ergebnis ?? null}, ${f.person_id ?? null}, ${f.ref ?? null}, ${f.art ?? null},
              ${f.art ? new Date() : null}, ${!!f.frage_an_agent}, ${f.created_at ?? new Date()})
      RETURNING *`) as any[];
    return merke(r.id);
  };
  const lade = async (id: number) => ((await sqlPool`SELECT * FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[])[0];
  const beitraege = async (id: number) => (await sqlPool`SELECT * FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ${id} ORDER BY id`) as any[];

  // ── Saat: drei Personen (P2 in P1 zusammengeführt), zwei Bestellungen ──
  const neuePerson = async (vor: string, nach: string, agent: number | null) => {
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, assigned_agent_id) VALUES (${`${MARKE}-${vor}-${nach}`}, ${vor}, ${nach}, ${agent}) RETURNING id`) as any[];
    personIds.push(Number(p.id)); return Number(p.id);
  };
  const P1 = await neuePerson("Prüfa", "Erstling", 8);
  const P2 = await neuePerson("Prüfa", "Doppel", 8);
  const P3 = await neuePerson("Prüfb", "Zweitling", 10);
  await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = ${P1} WHERE id = ${P2}`;
  const neueBestellung = async (person: number) => {
    const ref = `FIAON-PRF${Date.now().toString(36).toUpperCase()}${refs.length}-ITF`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, first_name, last_name) VALUES (${ref}, ${`PRF${ref.slice(-10)}`}, ${person}, 'Prüf', 'Bestellung')`;
    refs.push(ref); return ref;
  };
  const R1 = await neueBestellung(P1);
  const R3 = await neueBestellung(P3);

  const aufraeumen = async () => {
    await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE id = ANY(${todoIds}::int[]) OR titel LIKE ${`%${MARKE}%`} OR schluessel LIKE ${`%${MARKE}%`}`.catch((e) => log(`  (Aufräumen Aufträge: ${e})`));
    for (const z of zusatz) await sqlPool.unsafe(`DELETE FROM ${z.tabelle} WHERE id = $1`, [z.id]).catch(() => {});
    await sqlPool`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs}::text[])`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_raten_arbeit WHERE ref = ANY(${refs}::text[])`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs}::text[])`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${refs}::text[])`.catch(() => {});
    await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = NULL WHERE id = ANY(${personIds}::int[])`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${personIds}::int[])`.catch((e) => log(`  (Aufräumen Personen: ${e})`));
  };

  try {
    titel("B1  Die Wand (Trigger fiaon_todo_status_wand)");
    ok("Wand steht (Migration 102)", await A.statusWandDa());
    const w1 = await todo({ titel: `${MARKE} Wand 1`, status: "erledigt" });
    const z1 = await lade(w1);
    ok("INSERT erledigt OHNE erledigt_am → erledigt_am gesetzt, Art „auto“ (kein Name)", !!z1.erledigt_am && z1.erledigt_art === "auto", z1);
    await sqlPool`UPDATE fiaon_betreiber_todos SET erledigt_von = 'Daniel Stripling', ergebnis = 'Kunde erreicht, Termin steht' WHERE id = ${w1}`;
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'offen' WHERE id = ${w1}`;
    const z1b = await lade(w1); const b1 = await beitraege(w1);
    ok("erledigt → offen (alter Schreiber, ohne Grund): Spuren weg, Zähler 1, Grund „vom System neu gemeldet“",
      !z1b.erledigt_am && !z1b.erledigt_von && !z1b.ergebnis && !z1b.erledigt_art && z1b.wieder_offen_zahl === 1 && z1b.wieder_offen_grund === "vom System neu gemeldet" && !!z1b.wieder_offen_am, z1b);
    ok("… und EIN Beitrag „Wieder offen: …“ mit dem früheren Ergebnis", b1.length === 1 && b1[0].text.startsWith("Wieder offen: vom System neu gemeldet") && b1[0].text.includes("Kunde erreicht, Termin steht"), b1.map((b: any) => b.text));
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_von = 'Florentine' WHERE id = ${w1}`;
    const z1c = await lade(w1);
    ok("offen → erledigt mit Namen → Art „hand“, erledigt_am gesetzt", z1c.erledigt_art === "hand" && !!z1c.erledigt_am, z1c.erledigt_art);
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'in_arbeit', wieder_offen_grund = 'Prüfgrund A' WHERE id = ${w1}`;
    const z1d = await lade(w1); const b1d = await beitraege(w1);
    ok("Grund aus derselben Anweisung zählt; Zähler 2", z1d.wieder_offen_grund === "Prüfgrund A" && z1d.wieder_offen_zahl === 2 && b1d[b1d.length - 1].text === "Wieder offen: Prüfgrund A", { g: z1d.wieder_offen_grund, n: z1d.wieder_offen_zahl });
    await sqlPool`UPDATE fiaon_betreiber_todos SET titel = ${`${MARKE} Wand 1b`} WHERE id = ${w1}`;
    ok("Änderung an einem OFFENEN Auftrag schreibt keinen Beitrag", (await beitraege(w1)).length === b1d.length);
    // Der Fall von fiaon-app-antraege.ts:1116 (status ohne erledigt_am)
    const wand2 = await todo({ titel: `${MARKE} Wand 2` });
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', updated_at = NOW() WHERE id = ${wand2}`;
    ok("status = 'erledigt' ohne erledigt_am (app-antraege:1116) → erledigt_am gesetzt", !!(await lade(wand2)).erledigt_am);
    // Neustart-Simulation: ensureTodoTabelle ändert nichts mehr
    const vorher = (await sqlPool`SELECT id, status, erledigt_am FROM fiaon_betreiber_todos WHERE id = ANY(${todoIds}::int[]) ORDER BY id`) as any[];
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt' WHERE erledigt_am IS NOT NULL AND status <> 'erledigt' AND id = ANY(${todoIds}::int[])`;
    const nachher = (await sqlPool`SELECT id, status, erledigt_am FROM fiaon_betreiber_todos WHERE id = ANY(${todoIds}::int[]) ORDER BY id`) as any[];
    ok("Der alte Start-Abgleich fände nichts mehr zu tun (offene Zeilen haben kein erledigt_am)", JSON.stringify(vorher) === JSON.stringify(nachher));

    titel("B2  Zuordnung: Person (Wurzel), Referenz, Art — nie die Mail-Kennung");
    const z2a = await todo({ titel: `${MARKE} Z1`, link: `/agent/kunden?person=${P2}`, schluessel: `postmeister:antwort:${P2}${MARKE}`, quelle: "postmeister" });
    const z2b = await todo({ titel: `${MARKE} Z2`, link: "/chef/s/whatsapp", schluessel: `wa-${P3}-2026-09-24-${MARKE}`, quelle: "mara-whatsapp" });
    const z2c = await todo({ titel: `${MARKE} Z3`, link: `/admin/kunde/${R3}`, schluessel: `abo:${R3}:unzustellbar:${MARKE}`, quelle: "abo" });
    const z2d = await todo({ titel: `${MARKE} Z4`, link: null, schluessel: `postmeister:${P1}:aufgabe:${MARKE}`, quelle: "postmeister" });
    const z2e = await todo({ titel: `${MARKE} Z5`, link: null, schluessel: `postmeister:999999:aufgabe:${MARKE}`, quelle: "postmeister" });
    const n = await A.auftraegeZuordnen({ ids: [z2a, z2b, z2c, z2d, z2e] });
    ok("fünf Zeilen eingeordnet", n === 5, n);
    const [ra, rb, rc, rd, re] = await Promise.all([z2a, z2b, z2c, z2d, z2e].map(lade));
    ok("Link ?person=<Dublette> → Wurzelperson", Number(ra.person_id) === P1 && ra.art === "mara_mail", { p: ra.person_id, art: ra.art });
    ok("WhatsApp-Schlüssel → Person, Art WhatsApp-Anliegen", Number(rb.person_id) === P3 && rb.art === "mara_wa_anliegen", { p: rb.person_id, art: rb.art });
    ok("Referenz im Link → Person der Bestellung, Art „Rate unzustellbar“", Number(rc.person_id) === P3 && rc.ref === R3 && rc.art === "unzustellbar_rate", { p: rc.person_id, ref: rc.ref, art: rc.art });
    ok("postmeister:<n>:aufgabe ohne Link → KEINE Person (Mail-Kennung-Falle)", rd.person_id === null && re.person_id === null, { d: rd.person_id, e: re.person_id });
    const z2f = await todo({ titel: `${MARKE} Z6`, link: `/agent/kunden?person=999999`, quelle: "postmeister" });
    await A.auftraegeZuordnen({ ids: [z2f] });
    ok("Person aus dem Link, die es nicht gibt → keine Person (nicht falsch benannt)", (await lade(z2f)).person_id === null);

    titel("B3  auftragFuerKunden: Anlass, kein Doppeltext, kein Umhängen");
    const s1 = `pruef:${MARKE}:wa`;
    const e1 = await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Kunde fragt nach dem Termin.", schluessel: s1, quelle: "mara-whatsapp", agentId: 8, link: `/agent/kunden?person=${P1}` });
    merke(e1.id);
    const a1 = await lade(e1.id!);
    ok("neu: person_id, Art, Eingang und neu_seit gesetzt, beim gewünschten Mitarbeiter", Number(a1.person_id) === P1 && !!a1.art && !!a1.eingang_am && !!a1.neu_seit && Number(a1.zustaendig_agent_id) === 8, { p: a1.person_id, art: a1.art, ag: a1.zustaendig_agent_id });
    const nB1 = (await beitraege(e1.id!)).length;
    await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Kunde fragt nach dem Termin.", schluessel: s1, quelle: "mara-whatsapp", agentId: 8 });
    ok("gleicher Text noch einmal → kein Beitrag, kein Anhängen", (await beitraege(e1.id!)).length === nB1 && (await lade(e1.id!)).text === "Kunde fragt nach dem Termin.");
    // Hand-Übergabe an Florentine, dann meldet der Erzeuger mit Daniel → bleibt bei Florentine
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_agent_id = 10, zustaendig_name = 'Florentine Lombardi' WHERE id = ${e1.id}`;
    const e1b = await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Zweite Nachricht.", schluessel: s1, quelle: "mara-whatsapp", agentId: 8 });
    const a1b = await lade(e1.id!);
    ok("Hand-Übergabe A→B, Erzeuger nennt A → bleibt bei B (kein Pendeln)", Number(a1b.zustaendig_agent_id) === 10 && e1b.agentId === 10, { ag: a1b.zustaendig_agent_id, erg: e1b.agentId });
    ok("neue Nachricht am offenen Auftrag → ungelesen, neu_seit neu, Text angehängt", a1b.agent_gelesen_am === null && new Date(a1b.neu_seit).getTime() >= new Date(a1.neu_seit).getTime() && String(a1b.text).includes("Zweite Nachricht."));
    // Zuständiger gesperrt → Umhängen erlaubt
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_agent_id = 12, zustaendig_name = 'Lucas Böhnert' WHERE id = ${e1.id}`;
    await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Dritte Nachricht.", schluessel: s1, quelle: "mara-whatsapp", agentId: 8 });
    ok("Zuständiger gesperrt (Lucas) → an den Ableitungs-Empfänger übergeben", Number((await lade(e1.id!)).zustaendig_agent_id) === 8, (await lade(e1.id!)).zustaendig_agent_id);
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_agent_id = 12, zustaendig_name = 'Lucas Böhnert' WHERE id = ${e1.id}`;
    const eB = await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Nachricht an die Zahlungsstelle.", schluessel: s1, quelle: "mara-whatsapp", anBetreiber: true });
    ok("Zuständiger gesperrt + Zahlungsstelle → zurück aufs Board (nie unsichtbar beim Gesperrten)", (await lade(e1.id!)).zustaendig_art === "betreiber" && eB.anBetreiber === true, { za: (await lade(e1.id!)).zustaendig_art, erg: eB });
    const eB2 = await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Und wieder ein normales Anliegen.", schluessel: s1, quelle: "mara-whatsapp", agentId: 8 });
    ok("liegt beim Betreiber → kein Bumerang zurück an einen Mitarbeiter", (await lade(e1.id!)).zustaendig_art === "betreiber" && eB2.anBetreiber === true, (await lade(e1.id!)).zustaendig_art);
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_art = 'agent', zustaendig_agent_id = 8, zustaendig_name = 'Daniel Stripling' WHERE id = ${e1.id}`;
    // Erledigt + Anlass neu + neuer Text → wieder offen MIT Grund, Eingang neu
    await A.auftragErledigen(e1.id!, { art: "hand", von: "Daniel Stripling", autorArt: "agent", autorAgentId: 8, ergebnis: "Geklärt." });
    const vorEingang = (await lade(e1.id!)).eingang_am;
    await new Promise((r) => setTimeout(r, 20));
    await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Vierte Nachricht — neue Frage.", schluessel: s1, quelle: "mara-whatsapp", agentId: 8 });
    const a1c = await lade(e1.id!); const bz = await beitraege(e1.id!);
    ok("erledigt + neue Nachricht → wieder offen, Grund sichtbar, Eingang = jetzt, ungelesen",
      a1c.status === "offen" && String(a1c.wieder_offen_grund).startsWith("neue Meldung von Mara") && new Date(a1c.eingang_am).getTime() > new Date(vorEingang).getTime() && a1c.agent_gelesen_am === null,
      { st: a1c.status, g: a1c.wieder_offen_grund });
    ok("… die Zeitleiste sagt „Wieder offen: neue Meldung …“", bz.some((b: any) => /^Wieder offen: neue Meldung von Mara/.test(b.text)));
    // still: nie wieder öffnen
    await A.auftragErledigen(e1.id!, { art: "hand", von: "Daniel Stripling", autorArt: "agent", autorAgentId: 8 });
    await T.auftragFuerKunden({ personId: P1, ref: null, titel: `${MARKE} WhatsApp`, text: "Fünfte, still.", schluessel: s1, quelle: "mara-whatsapp", agentId: 8, still: true });
    ok("still: ein erledigter Auftrag bleibt zu", (await lade(e1.id!)).status === "erledigt");
    // Anlass zustand
    const s2 = `abo:${R1}:unzustellbar:${MARKE}`;
    const e2 = await T.auftragFuerKunden({ personId: P1, ref: R1, titel: "Rate 2: E-Mail unzustellbar — Adresse klären oder anrufen", text: "Die Adresse ist unzustellbar.", schluessel: s2, quelle: "abo", bereich: "konten", autorName: "Abo-Motor", dringend: true, anlass: "zustand", agentId: 8 });
    merke(e2.id);
    ok("Lage-Auftrag: Art „Rate unzustellbar“ mit Bezug auf die Bestellung", (await lade(e2.id!)).art === "unzustellbar_rate" && (await lade(e2.id!)).ref === R1);
    await A.auftragErledigen(e2.id!, { art: "hand", von: "Daniel Stripling", autorArt: "agent", autorAgentId: 8, ergebnis: "Neue Adresse eingetragen." });
    await T.auftragFuerKunden({ personId: P1, ref: R1, titel: "Rate 2: E-Mail unzustellbar — Adresse klären oder anrufen", text: "Die Adresse ist unzustellbar (Rate 3).", schluessel: s2, quelle: "abo", anlass: "zustand", agentId: 8 });
    ok("Lage meldet sich binnen 7 Tagen erneut → bleibt erledigt (kein Pendeln wie #966)", (await lade(e2.id!)).status === "erledigt");
    await sqlPool`UPDATE fiaon_betreiber_todos SET erledigt_am = NOW() - INTERVAL '8 days' WHERE id = ${e2.id}`;
    await T.auftragFuerKunden({ personId: P1, ref: R1, titel: "Rate 2: E-Mail unzustellbar — Adresse klären oder anrufen", text: "Die Adresse ist unzustellbar (Rate 4).", schluessel: s2, quelle: "abo", anlass: "zustand", agentId: 8 });
    const a2 = await lade(e2.id!);
    ok("… nach 8 Tagen → wieder offen, Grund „Lage besteht weiter“", a2.status === "offen" && String(a2.wieder_offen_grund).startsWith("Lage besteht weiter"), { st: a2.status, g: a2.wieder_offen_grund });

    titel("B4  Ereignisse direkt (auftraegeDurchEreignis)");
    const t = {
      hinweis: await todo({ titel: `${MARKE} Hinweis`, schluessel: `postmeister:${P1}:2026-10-01-${MARKE}`, person_id: P1, art: "mara_hinweis" }),
      wa: await todo({ titel: `${MARKE} WA Anliegen`, person_id: P1, art: "mara_wa_anliegen", agent: 10, agentName: "Florentine Lombardi" }),
      heikel: await todo({ titel: `${MARKE} WA heikel`, person_id: P1, art: "mara_wa_heikel" }),
      geld: await todo({ titel: `${MARKE} WA Geld`, person_id: P1, art: "mara_wa_geld" }),
      aufgabe: await todo({ titel: `${MARKE} Adresse ändern`, person_id: P1, art: "mara_aufgabe" }),
      frage: await todo({ titel: `${MARKE} mit Frage`, person_id: P1, art: "mara_hinweis", frage_an_agent: true }),
      leitung: await todo({ titel: `${MARKE} beim Betreiber`, person_id: P1, art: "mara_hinweis", zustaendig_art: "betreiber", agent: null, agentName: null }),
      fremd: await todo({ titel: `${MARKE} anderer Kunde`, person_id: P3, art: "mara_hinweis" }),
      zukunft: await todo({ titel: `${MARKE} neuere Nachricht`, person_id: P1, art: "mara_wa_rueckruf" }),
      mail: await todo({ titel: `${MARKE} Kunde hat geschrieben`, person_id: P1, art: "mara_mail" }),
    };
    await sqlPool`UPDATE fiaon_betreiber_todos SET neu_seit = NOW() + INTERVAL '1 hour' WHERE id = ${t.zukunft}`;
    // Ein wartender Antwortentwurf für P1 (lokale Postfach-Zeile)
    const [pm] = (await sqlPool`INSERT INTO fiaon_postmeister (gmail_id, postfach, thread_id, person_id, aktion) VALUES (${`${MARKE}-g`}, 'info@fiaon.com', ${`${MARKE}-t`}, ${P1}, 'entwurf') RETURNING id`.catch(() => [])) as any[];
    if (pm?.id) zusatz.push({ tabelle: "fiaon_postmeister", id: Number(pm.id) });
    const versuch = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_versuch", personId: P1, akteur: { id: 8, name: "Daniel Stripling" }, detail: "Nicht erreicht" });
    ok("Versuch ohne Erfolg schließt nichts, steht aber im Verlauf der passenden Aufträge", versuch.geschlossen.length === 0 && versuch.vermerkt >= 2 && (await lade(t.hinweis)).status === "offen", versuch);
    const w = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P2, ref: R1, akteur: { id: 8, name: "Daniel Stripling" }, detail: "Erreicht – Sonstiges" });
    const zu = new Set(w.geschlossen.map((g) => g.id));
    ok("Ergebnis über die DUBLETTE (P2) schließt den Hinweis der Wurzel (beim Handelnden selbst)", zu.has(t.hinweis), w);
    ok("… das WhatsApp-Anliegen beim KOLLEGEN bleibt offen, mit „Kontakt durch Daniel Stripling … – bitte prüfen“",
      !zu.has(t.wa) && (await lade(t.wa)).status === "offen" && (await beitraege(t.wa)).some((b: any) => /^Kontakt durch Daniel Stripling \(Gesprächsergebnis erfasst \(Erreicht – Sonstiges\)\) – bitte prüfen/.test(b.text)),
      (await beitraege(t.wa)).map((b: any) => b.text));
    const nWa = (await beitraege(t.wa)).length;
    await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P2, ref: R1, akteur: { id: 8, name: "Daniel Stripling" }, detail: "Erreicht – Sonstiges" });
    ok("… dasselbe Ereignis noch einmal → kein zweiter Hinweis", (await beitraege(t.wa)).length === nWa);
    const wBetr = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P1, akteur: { id: null, name: "Justin (Telefonkartei)" }, detail: "Erreicht – Sonstiges" });
    ok("Kontakt ohne Mitarbeiterkonto (Betreiber/Telefonkartei) schließt nichts, gibt nur Bescheid", wBetr.geschlossen.length === 0 && (await lade(t.wa)).status === "offen" && wBetr.ausgelassen.some((x) => x.grund === "anderer Zuständiger"), wBetr);
    ok("nie: heikel, Geld, konkrete Aufgabe", !zu.has(t.heikel) && !zu.has(t.geld) && !zu.has(t.aufgabe));
    ok("nie: mit offener Frage, beim Betreiber, anderer Kunde, neuere Nachricht", !zu.has(t.frage) && !zu.has(t.leitung) && !zu.has(t.fremd) && !zu.has(t.zukunft));
    ok("„Kunde hat geschrieben“ bleibt offen, solange Maras Entwurf wartet — mit Hinweis", pm?.id ? (!zu.has(t.mail) && (await beitraege(t.mail)).some((b: any) => b.text.includes("Antwortentwurf von Mara"))) : true);
    const zh = await lade(t.hinweis); const bh = await beitraege(t.hinweis);
    ok("erledigt_art „auto“, Ereignis und Name stehen am Auftrag", zh.erledigt_art === "auto" && String(zh.erledigt_ereignis).startsWith("Gesprächsergebnis erfasst (Erreicht – Sonstiges) – Daniel Stripling"), { a: zh.erledigt_art, e: zh.erledigt_ereignis });
    ok("Verlauf: „Automatisch erledigt durch Gesprächsergebnis erfasst … – Daniel Stripling, TT.MM. HH:MM“", bh.some((b: any) => /^Automatisch erledigt durch Gesprächsergebnis erfasst \(Erreicht – Sonstiges\) – Daniel Stripling, \d{2}\.\d{2}\. \d{2}:\d{2}$/.test(b.text)), bh.map((b: any) => b.text));
    const w2 = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P1, akteur: { id: 8, name: "Daniel Stripling" } });
    ok("zweites Ereignis: nichts mehr doppelt zu schließen", w2.geschlossen.length === 0, w2.geschlossen);
    if (pm?.id) {
      await sqlPool`UPDATE fiaon_postmeister SET aktion = 'geordnet', gesendet_am = NOW() WHERE id = ${pm.id}`;
      const w3 = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P1, akteur: { id: 8, name: "Daniel Stripling" } });
      ok("ohne wartenden Entwurf schließt das Gespräch auch „Kunde hat geschrieben“", w3.geschlossen.some((g) => g.id === t.mail), w3);
    }
    const unz1 = await todo({ titel: `${MARKE} unzustellbar R1`, person_id: P1, ref: R1, art: "unzustellbar_erstzahlung" });
    const unz3 = await todo({ titel: `${MARKE} unzustellbar R3`, person_id: P3, ref: R3, art: "unzustellbar_erstzahlung" });
    const unzRate = await todo({ titel: `${MARKE} Rate unzustellbar R1`, person_id: P1, ref: R1, art: "unzustellbar_rate" });
    const wz = await A.auftraegeDurchEreignis({ ereignis: "zahlung_gebucht", ref: R1, akteur: { id: null, name: "System" }, detail: "Erstzahlung" });
    ok("Zahlung auf R1 schließt nur „Erstzahlung unzustellbar“ von R1", wz.geschlossen.some((g) => g.id === unz1) && !wz.geschlossen.some((g) => g.id === unz3), wz);
    await A.auftraegeDurchEreignis({ ereignis: "zahlung_gebucht", ref: R1, akteur: { id: null, name: "System" }, detail: "Rate 2" });
    ok("Rate bezahlt → „Rate: E-Mail unzustellbar“ bleibt OFFEN (Adresse weiter kaputt, sonst fällt der Kunde aus der Mahnkette)", (await lade(unzRate)).status === "offen");
    // Der Erzeuger-Filter (fiaon-abo.ts unzustellbareMelden / fiaon-antrag.ts): offen oder < 7 Tage erledigt = nichts melden.
    const meldet = async (schl: string) => ((await sqlPool`
      SELECT NOT EXISTS (SELECT 1 FROM fiaon_betreiber_todos t WHERE t.schluessel = ${schl}
        AND (t.status <> 'erledigt' OR COALESCE(t.erledigt_am, NOW()) > NOW() - INTERVAL '7 days')) AS meldet`) as any[])[0].meldet;
    const sL = `abo:${R3}:unzustellbar:${MARKE}-lage`;
    const lageId = await todo({ titel: `${MARKE} Lage`, schluessel: sL, person_id: P3, ref: R3, art: "unzustellbar_rate", agent: 10 });
    const m1 = await meldet(sL);
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() - INTERVAL '3 days', erledigt_von = 'Florentine Lombardi' WHERE id = ${lageId}`;
    const m2 = await meldet(sL);
    await sqlPool`UPDATE fiaon_betreiber_todos SET erledigt_am = NOW() - INTERVAL '8 days' WHERE id = ${lageId}`;
    const m3 = await meldet(sL);
    ok("Erzeuger meldet: offen → nein, 3 Tage erledigt → nein, 8 Tage erledigt → ja (dann öffnet „zustand“ wieder)", m1 === false && m2 === false && m3 === true, { m1, m2, m3 });
    const eL = await T.auftragFuerKunden({ personId: P3, ref: R3, titel: "Rate 3: E-Mail unzustellbar — Adresse klären oder anrufen", text: "Die Adresse ist weiter unzustellbar (Rate 3).", schluessel: sL, quelle: "abo", bereich: "konten", autorName: "Abo-Motor", dringend: true, anlass: "zustand" });
    ok("… und auftragFuerKunden(anlass zustand) öffnet ihn sichtbar wieder", (await lade(eL.id!)).status === "offen" && String((await lade(eL.id!)).wieder_offen_grund).startsWith("Lage besteht weiter"), (await lade(eL.id!)).status);
    const wa2 = await todo({ titel: `${MARKE} WA Rückruf`, person_id: P3, art: "mara_wa_rueckruf", agent: 10 });
    const geld3 = await todo({ titel: `${MARKE} WA Geld 3`, person_id: P3, art: "mara_wa_geld", agent: 10 });
    const waAnl = await todo({ titel: `${MARKE} WA Anliegen 3`, person_id: P3, art: "mara_wa_anliegen", agent: 10 });
    const ww = await A.auftraegeDurchEreignis({ ereignis: "whatsapp_beantwortet", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" } });
    ok("WhatsApp-Antwort eines Menschen: Anliegen zu; Rückrufwunsch (braucht ein Gespräch) und Geld bleiben offen",
      ww.geschlossen.some((g) => g.id === waAnl) && !ww.geschlossen.some((g) => g.id === wa2) && !ww.geschlossen.some((g) => g.id === geld3)
      && (await lade(wa2)).status === "offen", ww);
    await A.auftragErledigen(wa2, { art: "hand", von: "Prüfstand", autorArt: "system" });
    const unt = await todo({ titel: `${MARKE} Kontoauszug anfordern`, person_id: P3, art: "unterlage", agent: 10, quelle: "hand" });
    const kk = await todo({ titel: `${MARKE} Konto & Karte`, person_id: P3, art: "konto_karte", agent: 10, quelle: "hand" });
    const wu = await A.auftraegeDurchEreignis({ ereignis: "unterlage_angefordert", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" }, detail: "Kontoauszug" });
    const wk = await A.auftraegeDurchEreignis({ ereignis: "kartenlink_gesendet", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" } });
    ok("Unterlage angefordert → „Unterlage anfordern“ zu; Kartenlink → „Konto & Karte“ zu", wu.geschlossen.some((g) => g.id === unt) && wk.geschlossen.some((g) => g.id === kk), { wu, wk });
    const untK = await todo({ titel: `${MARKE} Kontoauszug fehlt – bitte anfordern`, person_id: P3, art: "unterlage", agent: 10, quelle: "hand" });
    const ausk = await todo({ titel: `${MARKE} Auskunft bezahlt`, person_id: P3, art: "auskunft_lieferung", agent: 10 });
    const auskF = await todo({ titel: `${MARKE} hat keine Bonitätsauskunft`, person_id: P3, art: "mara_auskunft", agent: 10 });
    const wAus = await A.auftraegeDurchEreignis({ ereignis: "unterlage_erhalten", personId: P3, akteur: { id: null, name: "Kunde (Upload)" }, detail: "Ausweis" });
    ok("Upload Ausweis: „Kontoauszug fehlt“ bleibt offen (mit Beitrag), Auskunft-Aufträge bleiben offen",
      !wAus.geschlossen.length && (await lade(untK)).status === "offen" && (await lade(ausk)).status === "offen" && (await lade(auskF)).status === "offen"
      && (await beitraege(untK)).some((b: any) => b.text.includes("nicht die Unterlage aus diesem Auftrag")), wAus);
    const wSch = await A.auftraegeDurchEreignis({ ereignis: "unterlage_erhalten", personId: P3, akteur: { id: null, name: "Kunde (Upload)" }, detail: "eigene Bonitätsauskunft" });
    ok("Upload eigene Auskunft: Auskunft-Aufträge bleiben offen, Beitrag „Kunde hat eigene Auskunft hochgeladen – Leistung klären“",
      !wSch.geschlossen.some((g) => g.id === ausk || g.id === auskF) && (await lade(ausk)).status === "offen"
      && (await beitraege(ausk)).some((b: any) => b.text.startsWith("Kunde hat eigene Auskunft hochgeladen – Leistung klären"))
      && (await beitraege(auskF)).some((b: any) => b.text.startsWith("Kunde hat eigene Auskunft hochgeladen – Leistung klären")), wSch);
    const wKa = await A.auftraegeDurchEreignis({ ereignis: "unterlage_erhalten", personId: P3, akteur: { id: null, name: "Kunde (Upload)" }, detail: "Kontoauszug" });
    ok("Upload Kontoauszug → „Kontoauszug fehlt“ automatisch erledigt", wKa.geschlossen.some((g) => g.id === untK), wKa);
    // Auskunft: Erst-Angebot (mara_auskunft), danach meldet Mara „bezahlt“ → die Art wird „nur von Hand“.
    const sA = `postmeister:auskunft:${P3}${MARKE}`;
    const eA = await T.auftragFuerKunden({ personId: P3, ref: null, titel: "Prüfb Zweitling hat keine Bonitätsauskunft — bitte heute nachfassen (Karte/Limit)", text: "Mara konnte sie in dieser Lage nicht selbst anbieten.", schluessel: sA, quelle: "postmeister", agentId: 10 });
    merke(eA.id);
    const artVor = (await lade(eA.id!)).art;
    await T.auftragFuerKunden({ personId: P3, ref: null, titel: "Prüfb Zweitling schreibt, die Bonitätsauskunft fehle — bitte heute klären", text: "Laut Akte ist die Auskunft bezahlt — bitte prüfen, wo die Lieferung steht.", schluessel: sA, quelle: "postmeister", agentId: 10 });
    ok("Auskunft-Auftrag: Angebot = „fehlt“, später „bezahlt“ → Art „Lieferung klären“ (nur von Hand)", artVor === "mara_auskunft" && (await lade(eA.id!)).art === "auskunft_lieferung", { vor: artVor, nach: (await lade(eA.id!)).art });

    titel("B4b Heikles schließt nie das System (Gegenprüfung 08.10., zweite Runde)");
    // Der Blocker: Übergabe mit Grund „Widerruf“, KEIN wartender Entwurf, alt als „mara_mail“ eingeordnet →
    // das Ergebnis des Zuständigen schließt sie NICHT; die Art wird „nur von Hand“.
    const widerrufText = `Widerruf. Betreff „Vertrag“ an info@fiaon.com: Kundin widerruft den Vertrag. Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #99999${Date.now() % 1000}]`;
    const wid = await todo({ titel: `${MARKE} Kunde hat geschrieben (Widerruf)`, schluessel: `postmeister:antwort:${P3}${MARKE}`, text: widerrufText, person_id: P3, art: "mara_mail", agent: 10, agentName: "Florentine Lombardi" });
    const wWid = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" }, detail: "Erreicht – abgelehnt" });
    const zWid = await lade(wid);
    ok("Widerruf-Übergabe + „erreicht“ des Zuständigen → bleibt offen, Art „Kunde hat geschrieben: Beschwerde, Widerruf o. Ä.“",
      zWid.status === "offen" && zWid.art === "mara_mail_heikel" && !wWid.geschlossen.some((g) => g.id === wid) && wWid.ausgelassen.some((x) => x.id === wid && x.grund === "nur von Hand"), { st: zWid.status, art: zWid.art, w: wWid });
    // Alter WhatsApp-Tages-Schlüssel: zuerst ein Anliegen, dann hängt Mara einen Widerruf an → die strengere Art gewinnt.
    const sWa = `wa-${P3}-2026-09-24-${MARKE}`;
    const eWa = await T.auftragFuerKunden({ personId: P3, ref: null, titel: "WhatsApp: Anliegen — bitte übernehmen", text: "Kunde fragt nach dem Termin.", schluessel: sWa, quelle: "mara-whatsapp", agentId: 10 });
    merke(eWa.id);
    const artWa1 = (await lade(eWa.id!)).art;
    await T.auftragFuerKunden({ personId: P3, ref: null, titel: "WhatsApp: Kündigung, Widerruf oder Beschwerde — bitte jetzt übernehmen", text: "Kunde will den Vertrag widerrufen.", schluessel: sWa, quelle: "mara-whatsapp", agentId: 10, dringend: true });
    const wWa = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" } });
    ok("alter WhatsApp-Schlüssel: Anliegen, dann Widerruf angehängt → Art „nur von Hand“ (Beschwerde/Widerruf), schließt nicht",
      artWa1 === "mara_wa_anliegen" && ["kuendigung", "beschwerde"].includes((await lade(eWa.id!)).art) && (await lade(eWa.id!)).status === "offen" && !wWa.geschlossen.some((g) => g.id === eWa.id), { vor: artWa1, nach: (await lade(eWa.id!)).art });
    // Text kam an der Art vorbei (alter Schreiber hängt an, Art bleibt „Hinweis“) → das Ereignis prüft selbst nach.
    const hinwH = await todo({ titel: `${MARKE} Hinweis`, text: "Kundin verlangt eine Erstattung.", person_id: P3, art: "mara_hinweis", agent: 10, agentName: "Florentine Lombardi" });
    await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" } });
    ok("gespeichert „Hinweis“, Text verlangt Erstattung → Ereignis schließt nicht, Art wird „Beschwerde“", (await lade(hinwH)).status === "offen" && (await lade(hinwH)).art === "beschwerde", (await lade(hinwH)).art);
    // Erledigt von Hand: Maras wartender Entwurf wird übernommen, nicht stehen gelassen.
    const [pmW] = (await sqlPool`INSERT INTO fiaon_postmeister (gmail_id, postfach, thread_id, person_id, aktion) VALUES (${`${MARKE}-g2`}, 'info@fiaon.com', ${`${MARKE}-t2`}, ${P3}, 'entwurf') RETURNING id`.catch(() => [])) as any[];
    if (pmW?.id) {
      zusatz.push({ tabelle: "fiaon_postmeister", id: Number(pmW.id) });
      const v = await A.uebergabeEntwuerfeUebernehmen(`dringend. Betreff „x“ an info@fiaon.com: y [Mail #${pmW.id}]`, "Florentine Lombardi", "Kundin angerufen");
      const [pz] = (await sqlPool`SELECT aktion, begruendung FROM fiaon_postmeister WHERE id = ${pmW.id}`) as any[];
      ok("„Erledigt“ bei „Kunde hat geschrieben“: Entwurf → geordnet, „Vom Betreuer übernommen (…)“", v.length === 1 && pz.aktion === "geordnet" && String(pz.begruendung).startsWith("Vom Betreuer übernommen (Florentine Lombardi)"), { v, pz });
      ok("… ein zweites Mal ändert nichts (schon übernommen)", (await A.uebergabeEntwuerfeUebernehmen(`[Mail #${pmW.id}]`, "X", "Y")).length === 0);
    } else ok("Postfach-Zeile für den Entwurf angelegt", false);
    // Ausdrückliche Zuweisung (Mara „an die Leitung“): gilt auch gegen einen aktiven Zuständigen.
    const sV = `postmeister:${P3}:aufgabe:${MARKE}`;
    const eV = await T.auftragFuerKunden({ personId: P3, ref: null, titel: "Adresse ändern", text: "Neue Adresse eintragen.", schluessel: sV, quelle: "postmeister", agentId: 10 });
    merke(eV.id);
    await T.auftragFuerKunden({ personId: P3, ref: null, titel: "Erstattung prüfen", text: "Kunde will Geld zurück — Leitung entscheidet.", schluessel: sV, quelle: "postmeister", agentId: 8 });
    const vOhne = Number((await lade(eV.id!)).zustaendig_agent_id);
    const eV2 = await T.auftragFuerKunden({ personId: P3, ref: null, titel: "Erstattung prüfen", text: "Zweite Bitte an die Leitung.", schluessel: sV, quelle: "postmeister", agentId: 8, vorrang: true });
    ok("ohne vorrang bleibt der Auftrag beim aktiven Kollegen; mit vorrang (Leitung) geht er hin — mit Grund im Verlauf",
      vOhne === 10 && Number((await lade(eV.id!)).zustaendig_agent_id) === 8 && eV2.agentId === 8 && (await beitraege(eV.id!)).some((b: any) => b.text.startsWith("Ausdrücklich an ")), { vOhne, nach: (await lade(eV.id!)).zustaendig_agent_id });

    titel("B4c Fertigstellung 08.10. (Nachprüfung und Gegenprüfung, Rest)");
    // Blocker: Grund „Zentrale“, Inhalt Widerruf, KEIN wartender Entwurf → das „erreicht“ des Zuständigen schließt nicht.
    const zentrText = `Kunde wartet auf eine Antwort (Entwurf lag in der Zentrale). Betreff „Widerruf liegt lange vor“ an welcome@fiaon.com: Der Kunde erklärt, der Vertrag sei längst widerrufen. Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #98${Date.now() % 1000}]`;
    const zentr = await todo({ titel: `${MARKE} Kunde hat geschrieben (Zentrale)`, schluessel: `postmeister:antwort:${P3}${MARKE}z`, text: zentrText, person_id: P3, art: "mara_mail", agent: 10, agentName: "Florentine Lombardi" });
    await sqlPool`UPDATE fiaon_postmeister SET aktion = 'geordnet', gesendet_am = NOW() WHERE person_id = ${P3} AND gesendet_am IS NULL AND gmail_id LIKE ${`${MARKE}%`}`.catch(() => {});
    const wZentr = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" }, detail: "Erreicht – Sonstiges" });
    const zZentr = await lade(zentr);
    ok("Grund „Zentrale“ + Widerruf im Betreff, kein Entwurf, „erreicht“ des Zuständigen → bleibt offen, Art „nur von Hand“",
      zZentr.status === "offen" && zZentr.art === "mara_mail_heikel" && wZentr.ausgelassen.some((x) => x.id === zentr && x.grund === "nur von Hand"), { st: zZentr.status, art: zZentr.art });
    // Justins Regel (08.10.): Aufträge anderer Mitarbeiter schließt das System nie — auch nicht über Kartenlink/Unterlage eines Kollegen.
    const kkF = await todo({ titel: `${MARKE} Konto & Karte bei Florentine`, person_id: P3, art: "konto_karte", agent: 10, agentName: "Florentine Lombardi", quelle: "hand" });
    const wKk = await A.auftraegeDurchEreignis({ ereignis: "kartenlink_gesendet", personId: P3, akteur: { id: 8, name: "Daniel Stripling" } });
    ok("Kartenlink durch einen KOLLEGEN → Auftrag bleibt offen, Hinweis „Kartenlink gesendet durch … – bitte prüfen“",
      (await lade(kkF)).status === "offen" && !wKk.geschlossen.some((g) => g.id === kkF)
      && (await beitraege(kkF)).some((b: any) => b.text === "Kartenlink gesendet durch Daniel Stripling – bitte prüfen, ob der Auftrag damit erledigt ist."), (await beitraege(kkF)).map((b: any) => b.text));
    const wKk2 = await A.auftraegeDurchEreignis({ ereignis: "kartenlink_gesendet", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" } });
    ok("… durch die Zuständige selbst → automatisch erledigt", wKk2.geschlossen.some((g) => g.id === kkF));
    // Fund 16: von Hand wieder geöffnet → kein Ereignis schließt ihn erneut.
    const hand = await todo({ titel: `${MARKE} Hinweis von Hand wieder offen`, person_id: P3, art: "mara_hinweis", agent: 10, agentName: "Florentine Lombardi" });
    await A.auftragErledigen(hand, { art: "auto", von: "Florentine Lombardi", autorArt: "system", ereignis: "Prüfstand" });
    await A.auftragWiederOeffnen(hand, "von Florentine Lombardi wieder geöffnet: war zu früh zu", { gelesen: true, status: "in_arbeit" });
    const wHand = await A.auftraegeDurchEreignis({ ereignis: "ergebnis_erreicht", personId: P3, akteur: { id: 10, name: "Florentine Lombardi" } });
    ok("von Hand wieder geöffnet + nächstes „erreicht“ → bleibt offen (kein Pendeln)", (await lade(hand)).status !== "erledigt" && wHand.ausgelassen.some((x) => x.id === hand && x.grund === "von Hand wieder geöffnet"), { st: (await lade(hand)).status, w: wHand.ausgelassen });
    // Fund 10 Teil 3: Ein wieder geöffneter Auftrag geht an den, der JETZT zuständig ist.
    const jetztZust = await T.auftragEmpfaenger(P3);
    const anderer = jetztZust.id === 8 ? 10 : 8;
    const sR = `pruef:${MARKE}:reopen`;
    const eR = await T.auftragFuerKunden({ personId: P3, ref: null, titel: `${MARKE} Rückfrage`, text: "Erste Frage.", schluessel: sR, quelle: "mara-whatsapp", agentId: anderer });
    merke(eR.id);
    await A.auftragErledigen(eR.id!, { art: "hand", von: "Prüfstand", autorArt: "system" });
    const eR2 = await T.auftragFuerKunden({ personId: P3, ref: null, titel: `${MARKE} Rückfrage`, text: "Neue Frage, Tage später.", schluessel: sR, quelle: "mara-whatsapp" });
    const zR = await lade(eR.id!);
    ok("erledigt bei einem früheren Bearbeiter + neue Meldung → wieder offen beim jetzt Zuständigen (mit Satz im Verlauf)",
      !!jetztZust.id && zR.status === "offen" && Number(zR.zustaendig_agent_id) === jetztZust.id && eR2.agentId === jetztZust.id
      && (await beitraege(eR.id!)).some((b: any) => /^Wieder geöffnet und an .+ gegeben/.test(b.text)), { soll: jetztZust.id, ist: zR.zustaendig_agent_id, st: zR.status });
    const eR3 = await T.auftragFuerKunden({ personId: P3, ref: null, titel: `${MARKE} Rückfrage`, text: "Noch eine Frage, Auftrag offen.", schluessel: sR, quelle: "mara-whatsapp", agentId: anderer });
    ok("… ein OFFENER Auftrag hängt weiterhin nicht um (kein Pendeln)", Number((await lade(eR.id!)).zustaendig_agent_id) === jetztZust.id && eR3.agentId === jetztZust.id);
    await A.auftragErledigen(eR.id!, { art: "hand", von: "Prüfstand", autorArt: "system" });
    const eR4 = await T.auftragFuerKunden({ personId: P3, ref: null, titel: `${MARKE} Rückfrage`, text: "Kunde meldet eine Zahlung.", schluessel: sR, quelle: "mara-whatsapp", anBetreiber: true });
    ok("erledigt + neue Meldung für die Zahlungsstelle → wieder offen auf dem Board", (await lade(eR.id!)).status === "offen" && (await lade(eR.id!)).zustaendig_art === "betreiber" && eR4.anBetreiber === true, (await lade(eR.id!)).zustaendig_art);
    // Fund 13: zwei Meldungen desselben Schlüssels zugleich → beide Blöcke stehen im Text.
    const sP = `pruef:${MARKE}:parallel`;
    const eP = await T.auftragFuerKunden({ personId: P3, ref: null, titel: `${MARKE} Parallel`, text: "Block A [Mail #1]", schluessel: sP, quelle: "postmeister", agentId: 10 });
    merke(eP.id);
    await Promise.all([
      T.auftragFuerKunden({ personId: P3, ref: null, titel: `${MARKE} Parallel`, text: "Block B [Mail #2]", schluessel: sP, quelle: "postmeister", agentId: 10 }),
      T.auftragFuerKunden({ personId: P3, ref: null, titel: `${MARKE} Parallel`, text: "Block C [Mail #3]", schluessel: sP, quelle: "postmeister", agentId: 10 }),
    ]);
    const tP = String((await lade(eP.id!)).text);
    ok("zwei gleichzeitige Meldungen → alle drei Blöcke im Text, keiner doppelt", ["Block A [Mail #1]", "Block B [Mail #2]", "Block C [Mail #3]"].every((b) => tP.split(b).length === 2), tP);
    // Fund 6: WhatsApp — dieselbe Bitte (fester Satz) nach „Erledigt“ am selben Tag öffnet wieder.
    try {
      const wa = await import("../server/lib/fiaon-whatsapp-mara");
      const satz = "Der Mensch möchte mit jemandem aus dem Team sprechen (WhatsApp).";
      await wa.aufgabeFuerMenschen("4915177700099", P3, null, satz, false, "anliegen");
      const [w1] = (await sqlPool`SELECT id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`wa-${P3}-anliegen-%`} ORDER BY id DESC LIMIT 1`) as any[];
      merke(w1?.id);
      await A.auftragErledigen(Number(w1.id), { art: "hand", von: "Florentine Lombardi", autorArt: "agent", autorAgentId: 10 });
      await wa.aufgabeFuerMenschen("4915177700099", P3, null, satz, false, "anliegen");
      const zW = await lade(Number(w1.id));
      ok("WhatsApp: gleiche Bitte nach „Erledigt“ am selben Tag → wieder offen, „erneut gemeldet“ im Text",
        zW.status === "offen" && String(zW.text).includes("(erneut gemeldet ") && String(zW.wieder_offen_grund || "").startsWith("neue Meldung"), { st: zW.status, text: zW.text });
    } catch (e) { ok("WhatsApp-Weg im Prüfstand aufrufbar", false, String(e).slice(0, 300)); }

    // Ein Fehler im Ereignis darf die Transaktion des Aufrufers nie töten (Sicherungspunkt).
    const sp = await todo({ titel: `${MARKE} Sicherungspunkt`, person_id: P3, art: "mara_hinweis", agent: 10 });
    const spErg = await sqlPool.begin(async (tx: any) => {
      const w = await A.ereignisMelden({ ereignis: "ergebnis_erreicht", personId: P3, akteur: { id: "kaputt" as any, name: "Prüfstand" } }, tx);
      const [z] = (await tx`SELECT status FROM fiaon_betreiber_todos WHERE id = ${sp}`) as any[];
      return { w, status: z?.status, weiter: true };
    }).catch((e: any) => ({ fehler: String(e) }));
    ok("Fehler im Ereignis (in einer Transaktion) → Sicherungspunkt zurück, Transaktion lebt, Auftrag unverändert", (spErg as any).weiter === true && (spErg as any).status === "offen" && (spErg as any).w.geschlossen.length === 0, spErg);

    titel("B5  Die echten Ketten (Akte, Forderungsmanagement, Rückruf, Termin)");
    const kette1 = await todo({ titel: `${MARKE} Kette Ergebnis`, person_id: P3, art: "mara_hinweis", agent: 10 });
    const { ergebnisNachbereiten } = await import("../server/lib/fiaon-kontakt-ergebnis");
    await ergebnisNachbereiten({ ref: R3, personId: P3, ergebnis: "erreicht_sonstiges", notiz: "Prüfstand: Kunde erreicht, alles besprochen.", akteur: { id: 10, name: "Florentine Lombardi" }, herkunft: "liste" }).catch((e) => log(`  (ergebnisNachbereiten: ${String(e).slice(0, 160)})`));
    ok("ergebnisNachbereiten(erreicht) erledigt den Hinweis automatisch", (await lade(kette1)).status === "erledigt" && (await lade(kette1)).erledigt_art === "auto", (await lade(kette1)).status);
    const kette2 = await todo({ titel: `${MARKE} Kette Versuch`, person_id: P3, art: "mara_wa_anliegen", agent: 10 });
    await ergebnisNachbereiten({ ref: R3, personId: P3, ergebnis: "nicht_erreicht", akteur: { id: 10, name: "Florentine Lombardi" }, herkunft: "liste" }).catch(() => {});
    ok("ergebnisNachbereiten(nicht erreicht): bleibt offen, Versuch im Verlauf", (await lade(kette2)).status === "offen" && (await beitraege(kette2)).some((b: any) => b.text.startsWith("Anrufversuch ohne Erfolg")));
    // Forderungsmanagement
    const [rate] = (await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status)
      VALUES (${R3}, 2, ${`PRF-${MARKE}`.slice(0, 40)}, 9900, (CURRENT_DATE - 5), 'offen') RETURNING id`.catch((e) => { log(`  (Rate anlegen: ${e})`); return []; })) as any[];
    if (rate?.id) {
      const kette3 = await todo({ titel: `${MARKE} Kette Rate`, person_id: P3, art: "mara_wa_anliegen", agent: 10 });
      const { ratenErgebnisAnwenden } = await import("../server/lib/fiaon-inkasso");
      const morgen = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
      const re = await ratenErgebnisAnwenden({ rateId: Number(rate.id), ergebnis: "zahlt_am", agentId: 10, agentName: "Florentine Lombardi", zusageDatum: morgen }).catch((e) => ({ ok: false, fehler: String(e) }));
      ok("ratenErgebnisAnwenden(zahlt am) erledigt das WhatsApp-Anliegen automatisch", (re as any).ok && (await lade(kette3)).status === "erledigt", { re, st: (await lade(kette3)).status });
    } else ok("Rate für den Ratenweg angelegt", false);
    // Rückruf
    const [rr] = (await sqlPool`
      INSERT INTO fiaon_rueckrufe (person_id, ref, quelle, anliegen, frist_bis, status, zustaendig_agent_id)
      VALUES (${P1}, ${R1}, 'manuell', ${`${MARKE} Rückruf`}, NOW() + INTERVAL '4 hours', 'offen', 8) RETURNING id`.catch((e) => { log(`  (Rückruf anlegen: ${e})`); return []; })) as any[];
    if (rr?.id) {
      zusatz.push({ tabelle: "fiaon_rueckrufe", id: Number(rr.id) });
      const kette4 = await todo({ titel: `${MARKE} Kette Rückruf`, person_id: P1, art: "mara_wa_rueckruf" });
      const { rueckrufErledigen } = await import("../server/lib/fiaon-rueckruf");
      const r4 = await rueckrufErledigen(Number(rr.id), { name: "Daniel Stripling", agentId: 8 }, "Prüfstand: zurückgerufen, alles klar.");
      ok("rueckrufErledigen erledigt den Rückrufwunsch automatisch", r4.ok && (await lade(kette4)).status === "erledigt", { r4, st: (await lade(kette4)).status });
    } else ok("Rückruf für den Rückrufweg angelegt", false);
    // Termin geführt
    const [tm] = (await sqlPool`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle)
      VALUES (${P3}, 10, NOW() - INTERVAL '1 hour', 30, 'gebucht', 'agent') RETURNING id`.catch((e) => { log(`  (Termin anlegen: ${e})`); return []; })) as any[];
    if (tm?.id) {
      zusatz.push({ tabelle: "fiaon_termine", id: Number(tm.id) });
      const kette5 = await todo({ titel: `${MARKE} Kette Termin`, person_id: P3, art: "einladung_fehlt", agent: 10 });
      const { terminErgebnisSetzen } = await import("../server/lib/fiaon-termin-ergebnis");
      await terminErgebnisSetzen({ terminId: Number(tm.id), personId: P3, beginn: new Date(), ergebnis: "erledigt", notiz: null, akteur: { id: 10, name: "Florentine Lombardi" } }).catch((e) => log(`  (Termin-Ergebnis: ${String(e).slice(0, 160)})`));
      ok("terminErgebnisSetzen(erledigt) erledigt „Einladung fehlt“ automatisch", (await lade(kette5)).status === "erledigt", (await lade(kette5)).status);
    } else ok("Termin für den Terminweg angelegt", false);

    titel("B6  Popup „Neu von Mara“: neu_seit statt letzter Bewegung");
    const P = await import("../server/routes/fiaon-agent-aufgaben-popup");
    const alt1 = await todo({ titel: `${MARKE} Altfall`, person_id: P3, art: "mara_hinweis", agent: 505, agentName: "Hans-Jürgen Gerhold", created_at: new Date(Date.now() - 20 * 864e5) });
    await sqlPool`UPDATE fiaon_betreiber_todos SET neu_seit = created_at, letzte_aktivitaet = NOW(), delegiert_am = NOW(), agent_gelesen_am = NULL WHERE id = ${alt1}`;
    const neu1 = await todo({ titel: `${MARKE} Neu`, person_id: P3, art: "mara_hinweis", agent: 505, agentName: "Hans-Jürgen Gerhold" });
    const lage = await P.neueAufgaben(505);
    ok("Übertrag (letzte_aktivitaet = jetzt) macht einen Altfall NICHT neu", !lage.aufgaben.some((a) => a.id === alt1), lage.aufgaben.map((a) => a.id));
    ok("eine echte Neuigkeit steht im Popup — mit Kundenname und Akte-Ziel samt &auftrag=", lage.aufgaben.some((a) => a.id === neu1 && a.kunde === "Prüfb Zweitling" && a.ziel.href === `/agent/kunden?person=${P3}&auftrag=${neu1}`), lage.aufgaben.find((a) => a.id === neu1));
    await sqlPool`UPDATE fiaon_betreiber_todos SET agent_gelesen_am = NOW() WHERE id = ${neu1}`;
    ok("gesehen → nicht mehr neu", !(await P.neueAufgaben(505)).aufgaben.some((a) => a.id === neu1));
    await sqlPool`UPDATE fiaon_betreiber_todos SET neu_seit = NOW() + INTERVAL '1 second' WHERE id = ${neu1}`;
    ok("neue Kundennachricht nach dem Lesen → wieder neu", (await P.neueAufgaben(505)).aufgaben.some((a) => a.id === neu1));
  } catch (e) {
    ok("Teil B ohne Ausnahme", false, String((e as any)?.stack || e).slice(0, 600));
  }
  return { aufraeumen, daten: { P1, P3, R1, R3, MARKE, todoIds, merke, todo, lade } };
}

// ═══════════════════════════════════════════════════════════════════════════
// C. SERVER
// ═══════════════════════════════════════════════════════════════════════════
async function teilC(d: any): Promise<void> {
  const { sqlPool } = await import("../server/lib/db-pool");
  const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruefstand-itf-${Date.now().toString(36)}@pruefstand-itf.test`;
  const pass = `P-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  const [ag] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account, distribution_active, created_at)
    VALUES ('Prüfstand Aufträge (Testkonto)', ${mail}, ${await bcrypt.hash(pass, 10)}, 'agent', TRUE, TRUE, FALSE, NOW()) RETURNING id`) as any[];
  const AG = Number(ag.id);
  // Das Onboarding-Gate (Zustimmungen, Vertrag) wie in pruef-abrechnung-zentrale.ts — Nachweise mit
  // der Marke PRUEFSTAND, nur in der lokalen Datenbank, am Ende entfernt. Keine Verpflichtungserklärung.
  const { ONBOARDING_DOCS } = await import("../server/routes/fiaon-onboarding-content");
  for (const doc of ONBOARDING_DOCS as any[]) {
    await sqlPool`INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${AG}, ${doc.key}, ${doc.version}, NOW(), '127.0.0.1', 'PRUEFSTAND') ON CONFLICT DO NOTHING`.catch(() => {});
  }
  const [vorlage] = (await sqlPool`SELECT version FROM fiaon_contract_templates WHERE status = 'active' ORDER BY version DESC LIMIT 1`.catch(() => [])) as any[];
  if (vorlage) {
    await sqlPool`INSERT INTO fiaon_agent_contracts (agent_id, template_version, variables_json, rendered_html, signature_name, signature_mode, signed_at, ip, user_agent, doc_hash, status)
      VALUES (${AG}, ${vorlage.version}, '{}', '<p>PRUEFSTAND</p>', 'PRUEFSTAND', 'typed', NOW(), '127.0.0.1', 'PRUEFSTAND', 'PRUEFSTAND', 'signed')`.catch(() => {});
  }
  let cookie = "";
  const rufe = async (pfad: string, init: RequestInit = {}) => {
    const r = await fetch(`${SERVER}/api/fiaon${pfad}`, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers || {}) } });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(/,(?=\s*\w+=)/).map((c) => c.split(";")[0]).join("; ");
    return { status: r.status, body: await r.json().catch(() => null) as any };
  };
  try {
    titel("C   Routen über den laufenden Server");
    const an = await rufe("/agent/login", { method: "POST", body: JSON.stringify({ email: mail, password: pass }) });
    ok("Testkonto meldet sich an", an.status === 200, an);
    const t = (f: any) => d.todo({ agent: AG, agentName: "Prüfstand Aufträge (Testkonto)", ...f });
    const tag = (n: number) => new Date(Date.now() - n * 864e5);
    const a = await t({ titel: `${d.MARKE} C alt`, person_id: d.P1, art: "mara_hinweis", created_at: tag(30) });
    const b = await t({ titel: `${d.MARKE} C dringend`, person_id: d.P3, art: "mara_wa_anliegen", prioritaet: 1, created_at: tag(2) });
    const c = await t({ titel: `${d.MARKE} C neu`, person_id: d.P3, art: "mara_hinweis", created_at: tag(1) });
    const lage = await t({ titel: `${d.MARKE} C Lage`, person_id: d.P1, ref: d.R1, art: "unzustellbar_rate", created_at: tag(5) });
    const zu = await t({ titel: `${d.MARKE} C erledigt`, person_id: d.P1, art: "mara_hinweis", status: "erledigt", erledigt_von: "Prüfstand", created_at: tag(3) });
    const ohne = await t({ titel: "Bewerbung: Paula Prüf — Vertrieb", art: "bewerbung", quelle: "website", created_at: tag(4) });
    await sqlPool`UPDATE fiaon_betreiber_todos SET eingang_am = created_at, neu_seit = created_at WHERE id = ANY(${[a, b, c, lage, zu, ohne]}::int[])`;
    let l = await rufe("/agent/auftraege");
    const ids = (l.body?.auftraege || []).map((x: any) => x.id);
    ok("Liste: nur offene Aufträge, Erledigtes NICHT in „auftraege“", l.status === 200 && !ids.includes(zu) && ids.includes(a), ids);
    ok("Liste: Erledigtes im Teil „erledigt“ (für den Reiter)", (l.body?.erledigt || []).some((x: any) => x.id === zu));
    ok("Reihenfolge: dringend zuerst, dann die ältesten", JSON.stringify(ids) === JSON.stringify([b, a, lage, ohne, c]), ids);
    const za = (l.body.auftraege as any[]).find((x) => x.id === a);
    ok("Zeile trägt Kunde, Art, Eingang, Status", za.kundeAnzeige === "Prüfa Erstling" && za.artLabel === "Hinweis von Mara" && !!za.eingangAm && za.status === "offen", za && { k: za.kundeAnzeige, a: za.artLabel, e: za.eingangAm });
    ok("ohne Kunden: Name aus dem Titel (Bewerbung)", (l.body.auftraege as any[]).find((x) => x.id === ohne)?.kundeAnzeige === "Paula Prüf");
    ok("Server nennt den nächsten (gleiche Reihenfolge)", l.body.naechster === b, l.body.naechster);
    const e1 = await rufe(`/agent/auftraege/${b}/erledigt`, { method: "POST", body: JSON.stringify({ richtung: "alt" }) });
    ok("„Erledigt“ mit einem Klick (aus „offen“, ohne Annehmen) → 200 + nächster", e1.status === 200 && e1.body?.todo?.status === "erledigt" && e1.body?.naechster?.id === a, { s: e1.status, n: e1.body?.naechster });
    const e2 = await rufe(`/agent/auftraege/${b}/erledigt`, { method: "POST", body: JSON.stringify({}) });
    ok("zweiter Klick → 200 schonErledigt (kein „Schon erledigt.“-Fehler)", e2.status === 200 && e2.body?.schonErledigt === true, e2);
    const e3 = await rufe(`/agent/auftraege/${lage}/erledigt`, { method: "POST", body: JSON.stringify({}) });
    ok("Lage-Auftrag ohne Satz → 400 ERGEBNIS_PFLICHT", e3.status === 400 && e3.body?.code === "ERGEBNIS_PFLICHT", e3);
    const e4 = await rufe(`/agent/auftraege/${lage}/erledigt`, { method: "POST", body: JSON.stringify({ ergebnis: "Neue Adresse eingetragen und Kunde informiert." }) });
    ok("… mit Satz → erledigt, Ergebnis gespeichert", e4.status === 200 && e4.body?.todo?.ergebnis === "Neue Adresse eingetragen und Kunde informiert.");
    const det = await rufe(`/agent/auftraege/${a}`);
    ok("Detail: ganzer Auftrag mit Zeitleiste und weiteren Aufträgen zum Kunden", det.status === 200 && Array.isArray(det.body?.todo?.zeitleiste) && typeof det.body?.todo?.weitereZumKunden === "number", det.body?.todo && Object.keys(det.body.todo).length);
    const nx = await rufe(`/agent/auftraege/naechster?nach=${a}`);
    ok("GET naechster?nach= überspringt den genannten", nx.body?.naechster?.id === ohne, nx.body);
    const wo = await rufe(`/agent/auftraege/${b}/wieder-oeffnen`, { method: "POST", body: JSON.stringify({ grund: "zu früh" }) });
    ok("„Wieder öffnen“ → in Arbeit, Grund in der Zeitleiste", wo.status === 200 && wo.body?.todo?.status === "in_arbeit" && (wo.body?.todo?.zeitleiste || []).some((x: any) => String(x.text).startsWith("Wieder offen: von Prüfstand Aufträge (Testkonto) wieder geöffnet: zu früh")), wo.body?.todo?.zeitleiste?.slice(-2));
    l = await rufe("/agent/auftraege");
    ok("… und steht wieder in der offenen Liste", (l.body?.auftraege || []).some((x: any) => x.id === b));
    await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_agent_id = 8, zustaendig_name = 'Daniel Stripling' WHERE id = ${c}`;
    const weg = await rufe(`/agent/auftraege/${c}/erledigt`, { method: "POST", body: JSON.stringify({}) });
    ok("veraltete Liste (inzwischen umverteilt) → 404 mit Code NICHT_BEI_DIR", weg.status === 404 && weg.body?.code === "NICHT_BEI_DIR", weg);
    const an2 = await rufe(`/agent/auftraege/${lage}/annehmen`, { method: "POST" });
    ok("altes „Ich mach das“ auf Erledigtes → 200 ohne Fehler", an2.status === 200 && an2.body?.schonErledigt === true, an2);
    // Fertigstellung 08.10.: „Erledigt“ bei „Kunde hat geschrieben“ über die ROUTE — heikler Inhalt verlangt den Satz,
    // danach ist Maras wartender Entwurf übernommen (nicht mehr sendbar aus der Zentrale).
    const [pmC] = (await sqlPool`INSERT INTO fiaon_postmeister (gmail_id, postfach, thread_id, person_id, aktion) VALUES (${`${d.MARKE}-gc`}, 'info@fiaon.com', ${`${d.MARKE}-tc`}, ${d.P3}, 'entwurf') RETURNING id`.catch(() => [])) as any[];
    if (pmC?.id) {
      const mailT = await t({ titel: `${d.MARKE} C Kunde hat geschrieben`, schluessel: `postmeister:antwort:${d.P3}${d.MARKE}c`, person_id: d.P3, art: "mara_mail",
        text: `Kunde wartet auf eine Antwort (Entwurf lag in der Zentrale). Betreff „Widerruf liegt lange vor“ an info@fiaon.com: Kunde widerruft. Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #${pmC.id}]` });
      const m1 = await rufe(`/agent/auftraege/${mailT}/erledigt`, { method: "POST", body: JSON.stringify({}) });
      ok("Route: „Kunde hat geschrieben“ mit Widerruf im Betreff ohne Satz → 400 ERGEBNIS_PFLICHT", m1.status === 400 && m1.body?.code === "ERGEBNIS_PFLICHT", m1);
      const m2 = await rufe(`/agent/auftraege/${mailT}/erledigt`, { method: "POST", body: JSON.stringify({ ergebnis: "Widerruf bestätigt, Kunde informiert." }) });
      const [pz] = (await sqlPool`SELECT aktion, begruendung FROM fiaon_postmeister WHERE id = ${pmC.id}`) as any[];
      ok("Route: mit Satz erledigt → Maras Entwurf „Vom Betreuer übernommen“, Beitrag im Verlauf",
        m2.status === 200 && m2.body?.todo?.status === "erledigt" && pz?.aktion === "geordnet" && String(pz?.begruendung).startsWith("Vom Betreuer übernommen (Prüfstand Aufträge (Testkonto))")
        && (m2.body?.todo?.zeitleiste || []).some((x: any) => String(x.text).startsWith(`Maras Entwurf zu Mail #${pmC.id} verworfen`)), { s: m2.status, pz });
      await sqlPool`DELETE FROM fiaon_postmeister WHERE id = ${pmC.id}`.catch(() => {});
    } else ok("Postfach-Zeile für Teil C angelegt", false);
    const pop = await rufe("/agent/aufgaben/neu");
    ok("Popup-Route antwortet (eigene Aufgaben, Ziel mit &auftrag=)", pop.status === 200 && (pop.body?.aufgaben || []).every((x: any) => !x.personId || /&auftrag=\d+$/.test(x.ziel.href)), pop.body?.aufgaben?.map((x: any) => x.ziel));
  } catch (e) {
    ok("Teil C ohne Ausnahme", false, String((e as any)?.stack || e).slice(0, 500));
  } finally {
    await testkontoStilllegen(AG).catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id = ${AG} AND doc_hash = 'PRUEFSTAND'`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id = ${AG} AND user_agent = 'PRUEFSTAND'`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE zustaendig_agent_id = ${AG}`.catch(() => {});
  }
}

async function main(): Promise<void> {
  teilA();
  await teilA8();
  if (LOKAL) {
    const b = await teilB();
    if (SERVER) await teilC(b.daten);
    await b.aufraeumen();
    const { sqlPool } = await import("../server/lib/db-pool");
    const rest = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE titel LIKE ${`%${b.daten.MARKE}%`}`) as any[];
    ok("Aufräumen: keine Prüfstand-Aufträge übrig", Number(rest[0]?.n) === 0, rest[0]);
    await sqlPool.end({ timeout: 2 });
  } else {
    log("\n  (Teil B/C übersprungen — mit --lokal [--server http://127.0.0.1:5316] gegen die lokale Datenbank)");
  }
  log(`\n${"═".repeat(76)}\n  ${gut} grün, ${schlecht} rot\n${"═".repeat(76)}`);
  process.exit(schlecht ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
