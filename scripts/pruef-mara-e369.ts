// Prüfstand E-369 (15.10.2026): Mara erledigt selbst — Selbst-Senden statt Übergabe, Rückfrage bei nicht gebuchter
// Kündigung, Knopf passt zum Text, Kunde über Rechnungs-/Vorgangsnummer, Namen entdoppelt, Bündeln, „bitte nicht e mail“.
// Offline, ohne KI, ohne Datenbank (nur reine Funktionen). Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-mara-e369.ts

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

async function main() {
  const agent = await import("../server/lib/fiaon-postmeister-agent");
  const lauf = await import("../server/lib/fiaon-postmeister-lauf");
  const dossier = await import("../server/lib/fiaon-postmeister-dossier");
  const text = await import("../server/lib/fiaon-postmeister-antworttext");
  const werkzeuge = await import("../server/lib/fiaon-postmeister-werkzeuge");

  console.log("── 1 · Selbst senden statt Übergabe (maraSelbstSendbar)");
  const ruhig = "Das tut mir leid. Ich habe mir Ihren Vertrag angesehen: Er stammt vom 12.08.2026. Schicken Sie mir gern den Nachweis, dann prüfe ich es sofort.";
  const fordert = "Bitte überweisen Sie die offene Rate heute.";
  ok(agent.maraSelbstSendbar({ flags: { beschwerde: true }, lage: "rate_ueberfaellig", global: false, text: ruhig, ruhe: true }), "Beschwerde, ruhige Antwort → Mara sendet selbst");
  ok(!agent.maraSelbstSendbar({ flags: { beschwerde: true }, lage: "rate_ueberfaellig", global: false, text: fordert, ruhe: true }), "Beschwerde mit Zahlungsbitte → nicht selbst");
  ok(agent.maraSelbstSendbar({ flags: { bestreitet: true }, lage: "bestreitet", global: false, text: ruhig, ruhe: true }), "Bestreiten → Mara selbst (Akte, Vertragsdatum, Nachweis)");
  ok(agent.maraSelbstSendbar({ flags: { zahlungsunfaehig: true }, lage: "unbezahlt", global: false, text: ruhig, ruhe: true }), "„kann nicht zahlen“ → Mara selbst");
  ok(agent.maraSelbstSendbar({ flags: { zahlung_behauptet: true }, lage: "zahlung_gemeldet", global: false, text: ruhig, ruhe: false }), "„habe bezahlt“ → Mara selbst");
  ok(!agent.maraSelbstSendbar({ flags: { droht_anwalt: true }, lage: "rate_ueberfaellig", global: false, text: ruhig, ruhe: true }), "Anwalt → Mensch (Justin)");
  ok(!agent.maraSelbstSendbar({ flags: { rechtlich: true }, lage: "aktiv", global: false, text: ruhig, ruhe: false }), "rechtlich → Mensch");
  ok(!agent.maraSelbstSendbar({ flags: { widerruf: true }, lage: "aktiv", global: false, text: ruhig, ruhe: true }), "Widerruf nach Zahlung → Mensch");
  ok(agent.maraSelbstSendbar({ flags: { widerruf: true }, lage: "unbezahlt", global: false, text: ruhig, ruhe: true, stornoGebucht: true }), "Widerruf als Storno der unbezahlten Bestellung gebucht → Mara selbst");
  ok(!agent.maraSelbstSendbar({ flags: {}, lage: "aktiv", global: true, text: ruhig, ruhe: false }), "Global-Kunde → Justin");
  ok(!agent.maraSelbstSendbar({ flags: {}, lage: "unklar", global: false, text: ruhig, ruhe: false }), "Person unklar → nicht selbst");
  ok(!agent.maraSelbstSendbar({ flags: {}, lage: "gesperrt", global: false, text: fordert, ruhe: false }), "Lage gesperrt mit Zahlungsbitte → nicht selbst");
  ok(agent.maraSelbstSendbar({ flags: {}, lage: "gesperrt", global: false, text: "Ihr Vertrag ist beendet; es ist nichts mehr offen.", ruhe: false }), "Lage gesperrt (Vertrag beendet), sachliche Antwort → selbst");
  ok(!agent.maraSelbstSendbar({ flags: { stopp: true }, lage: "unbezahlt", global: false, text: "Sie bekommen keine Werbung mehr.", ruhe: true, stoppOffen: true }), "E-371: „Stopp“, Werbesperre nicht gesetzt → nie automatisch");

  console.log("── 2 · Kündigung nicht gebucht → Rückfrage, keine Zahlungsbitte");
  const k = (flags: any, handlungen: any[] = [], akte: any = {}) => ({ einordnung: { flags }, handlungen, akte, kontext: { ref: "FIAON-REF" } });
  ok(agent.kuendigungNichtGebucht(k({ kuendigung: true })), "#6520 „Stonie“: Lampe kuendigung, nichts gebucht → offen");
  ok(!agent.kuendigungNichtGebucht(k({ kuendigung: true }, [{ ok: true, werkzeug: "kuendigung_vormerken" }])), "Mara hat gebucht → nicht offen");
  ok(!agent.kuendigungNichtGebucht(k({ kuendigung: true }, [], { kuendigung: { giltZum: "31.10.2026" } })), "Kündigung steht in der Akte → nicht offen");
  ok(!agent.kuendigungNichtGebucht(k({ kuendigung: true }, [], { bestellungen: [{ ref: "FIAON-REF", status: "cancelled" }] })), "Bestellung storniert → nicht offen");
  ok(!agent.kuendigungNichtGebucht(k({})), "keine Lampe → nicht offen");
  ok(agent.rueckfrageGestellt("Möchten Sie, dass ich Ihren Vertrag jetzt kündige? Ein kurzes Ja genügt."), "Rückfrage erkannt");
  ok(agent.rueckfrageGestellt("Soll ich die Bestellung für Sie stornieren?"), "eigene Rückfrage des Modells erkannt");
  ok(!agent.rueckfrageGestellt("Ihre Rate über 7,99 € ist offen."), "keine Rückfrage");

  console.log("── 3 · Knopf passt zum Text (knopfWiderspruch)");
  const Z = { art: "zahlung", text: "Rechnung ansehen und bezahlen" }, B = { art: "bereich", text: "Zu meinem Bereich" }, T = { art: "termin", text: "Termin wählen" };
  ok(!!agent.knopfWiderspruch("Wählen Sie Ihren Termin einfach über den Knopf unten.", Z), "#6621: Text Termin, Knopf Zahlung → Befund");
  ok(!!agent.knopfWiderspruch("Die Zahlungsseite finden Sie unten.", B), "#6687: Text Zahlungsseite, Knopf Bereich → Befund");
  ok(agent.knopfWiderspruch("Über den Knopf unten sehen Sie Ihre Rechnung und den QR-Code.", Z) === null, "Text Zahlung, Knopf Zahlung → passt");
  ok(agent.knopfWiderspruch("Unten wählen Sie Ihren Termin.", T) === null, "Text Termin, Knopf Termin → passt");
  ok(agent.knopfWiderspruch("Ihre Rate über 7,99 € ist offen. Bitte überweisen Sie sie heute.", B) === null, "kein Knopfbezug im Text → kein Befund");
  ok(!!agent.knopfWiderspruch("Über den Knopf gelangen Sie zu Ihrem Bereich.", { art: "erledigt", text: "" }), "Knopf im Text, aber keiner unter der Mail → Befund");
  // Der Auskunftsknopf überschreibt keinen bewusst gewählten anderen Schritt mehr (#6706).
  const roh = { naechster_schritt: { art: "antrag", url: null, text: "Antrag starten" } };
  const wd = { auskunft_anbieten: { verkaufen: true, knopf: "https://fiaon.com/auskunft/kauf/x" }, antrag_link: { url: "https://fiaon.com/antrag/x" } };
  const s1 = agent.schrittBestimmen(roh, "interessent", wd, true, {});
  ok(String(s1.schritt?.art) === "antrag", "#6706: Modell wählt Antrag → Knopf bleibt Antrag (nicht „Bonitätsauskunft bestellen“)");
  const s2 = agent.schrittBestimmen({ naechster_schritt: { art: "auskunft" } }, "interessent", wd, true, {});
  ok(String(s2.schritt?.art) === "auskunft", "Modell wählt Auskunft → Auskunftsknopf");

  console.log("── 4 · Kunde über Nummern in Betreff und Text (nummernImText)");
  const n1 = dossier.nummernImText("Re: Rechnung FIAON-INV-2026-01881\nHallo, wann kommt die Karte?");
  ok(n1.length === 1 && n1[0].art === "rechnung" && n1[0].imBetreff, "#6679: Rechnungsnummer im Betreff erkannt");
  const n2 = dossier.nummernImText("x\nVerwendungszweck FIAONAB12CD");
  ok(n2.length === 1 && n2[0].art === "zahlung" && n2[0].wert === "FIAONAB12CD", "Zahlungsreferenz ohne Bindestrich (neues Format)");
  const n3 = dossier.nummernImText("x\nVorgang FIAON-MRNJX91O-49VD, Rate FIAON-AB12CD-2");
  ok(n3.map((x) => x.art).join(",") === "vorgang,rate", "Vorgangsnummer und Raten-Zweck, nichts doppelt");
  ok(dossier.nummernImText("x\nFIAONINV202").length === 0, "„FIAONINV…“ ist keine Zahlungsreferenz");

  console.log("── 5 · Namen entdoppeln, fremder Absender");
  const e = (v: string, n: string) => JSON.stringify(text.namenEntdoppeln(v, n));
  ok(e("Mihaela", "Robiban Robiban") === JSON.stringify({ vor: "Mihaela", nach: "Robiban" }), "„Frau Robiban Robiban“ → Robiban");
  ok(e("Gaetano", "Gaetano") === JSON.stringify({ vor: "", nach: "Gaetano" }), "„Gaetano Gaetano“ → einmal");
  ok(e("Kurt Bucher", "Bucher") === JSON.stringify({ vor: "Kurt", nach: "Bucher" }), "Nachname im Vornamenfeld → raus");
  ok(e("Hans", "Fug Fugmann") === JSON.stringify({ vor: "Hans", nach: "Fugmann" }), "„Herr Fug Fugmann“ → Fugmann");
  ok(e("Ana", "Anaya") === JSON.stringify({ vor: "Ana", nach: "Anaya" }), "ähnlicher, aber anderer Vorname bleibt");
  ok(e("Anna-Lena", "Müller-Lüdenscheidt") === JSON.stringify({ vor: "Anna-Lena", nach: "Müller-Lüdenscheidt" }), "Doppelnamen bleiben");
  ok(text.absenderPasstNicht("Gerda Molk <g@example.org>", "Franz"), "#6478: Gerda schreibt von Franz' Adresse → Anrede ohne Namen");
  ok(!text.absenderPasstNicht("Franz Molk <f@example.org>", "Franz"), "passender Absender");
  ok(!text.absenderPasstNicht("Info <i@example.org>", "Franz"), "„Info“ ist kein Personenname");
  ok(!text.absenderPasstNicht("\"Molk, Gerda\" <g@example.org>", "Gerda"), "„Nachname, Vorname“ erkannt");

  console.log("── 6 · Bündeln (buendelEntscheiden)");
  const jetzt = Date.parse("2026-10-15T12:00:00Z");
  const min = 60_000;
  ok(lauf.buendelEntscheiden({ am: jetzt - 2 * min, seit: jetzt - 2 * min }, [], jetzt).art === "warten", "frische Mail (2 min) wartet einen Takt");
  ok(lauf.buendelEntscheiden({ am: jetzt - 10 * min, seit: jetzt - 9 * min }, [], jetzt).art === "jetzt", "keine neuere Mail → jetzt beantworten");
  ok(lauf.buendelEntscheiden({ am: jetzt - 10 * min, seit: jetzt - 9 * min }, [{ id: 2, am: jetzt - 8 * min, aktion: "vorgeordnet", gesendetAm: null }], jetzt).art === "mitgenommen", "#6584/#6586: neuere, offene Mail nimmt diese mit");
  ok(lauf.buendelEntscheiden({ am: jetzt - 10 * min, seit: jetzt - 9 * min }, [{ id: 2, am: jetzt - 8 * min, aktion: "auto_beantwortet", gesendetAm: jetzt - 1 * min }], jetzt).art === "mitgenommen", "neuere schon beantwortet, nachdem diese im Haus war → mitbeantwortet");
  ok(lauf.buendelEntscheiden({ am: jetzt - 10 * min, seit: jetzt - 9 * min }, [{ id: 2, am: jetzt - 8 * min, aktion: "geordnet", gesendetAm: null }], jetzt).art === "jetzt", "neuere war nur ein Doppel (geordnet) → diese selbst beantworten");
  ok(lauf.buendelEntscheiden({ am: jetzt - 10 * min, seit: jetzt - 9 * min }, [{ id: 2, am: jetzt - 8 * min, aktion: "ignoriert", gesendetAm: null }], jetzt).art === "jetzt", "neuere ignoriert (Automat) → diese selbst beantworten");
  ok(lauf.buendelEntscheiden({ am: jetzt - 5 * 3_600_000, seit: jetzt - 5 * 3_600_000 }, [{ id: 2, am: jetzt - 10 * min, aktion: "vorgeordnet", gesendetAm: null }], jetzt).art === "jetzt", "neuere erst Stunden später (außerhalb des Fensters) → eigene Antwort");

  console.log("── 7 · Übergabe nur noch, wo ein Mensch entscheidet (menschNoetig)");
  const E = (kat: string[], flags: Record<string, boolean> = {}) => ({ kategorien: kat, flags, dringend: false });
  ok(lauf.menschNoetig(E(["zahlung"], { beschwerde: true }), "Schon wieder eine Mahnung!") === null, "Beschwerde → Mara");
  ok(lauf.menschNoetig(E(["zahlung"], { bestreitet: true }), "Nie bestellt.") === null, "Bestreiten → Mara");
  ok(lauf.menschNoetig(E(["vertrieb_komplex"]), "Ich habe drei Fragen zu Ihrem Paket.") === null, "vertrieb_komplex → Mara");
  ok(lauf.menschNoetig(E(["zahlung"], { droht_anwalt: true }), "Mein Anwalt …") === lauf.UEBERGABE_GRUND.rechtlich, "Anwalt → Mensch");
  ok(lauf.menschNoetig(E(["zahlung"], { widerruf: true }), "Ich widerrufe.") === lauf.UEBERGABE_GRUND.widerruf, "Widerruf → Mensch (außer als Storno gebucht, im Lauf)");
  ok(lauf.menschNoetig(E(["termin"]), "Bitte rufen Sie mich morgen an.") === lauf.UEBERGABE_GRUND.ansprechpartner, "ausdrücklicher Rückruf bleibt (bis Mara den Termin einplant)");

  console.log("── 8 · Stopp: „bitte nicht e mail“ (#6763)");
  ok(werkzeuge.ausdruecklicherStopp("bitte nicht e mail", ""), "Betreff „bitte nicht e mail“ → Stopp");
  ok(werkzeuge.ausdruecklicherStopp("", "Bitte nicht mehr E-Mails schicken."), "„Bitte nicht mehr E-Mails“ → Stopp");
  ok(!werkzeuge.ausdruecklicherStopp("", "Bitte nicht e-mail adresse ändern, die alte stimmt."), "„e-mail adresse“ ist kein Stopp");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
