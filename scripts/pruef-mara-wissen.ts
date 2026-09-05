// Prüfstand: Hat Mara wirklich alles Wissen? (05.09.2026, E-135)
// Läuft ohne Datenbank. Bricht ab, wenn ein Kernfakt im Haus-Wissen fehlt,
// wenn der Agent das Wissen kürzt oder wenn Konstanten und Text auseinanderlaufen.
import fs from "node:fs";
import { wissenFakten } from "../shared/fiaon-wissen";
import { SCHUFA_PREIS_EURO } from "../shared/fiaon-pakete";

const f = wissenFakten();
const agent = fs.readFileSync("server/lib/fiaon-postmeister-agent.ts", "utf8");
const konto = fs.readFileSync("server/lib/fiaon-konto-karte.ts", "utf8");
const minRaten = Number(konto.match(/KARTE_MIN_RATEN = (\d+)/)?.[1]);
const fehler: string[] = [];
const muss = (name: string, ok: boolean) => { if (!ok) fehler.push(name); };

muss("Kartenregel: drei Bedingungen", /drei Bedingungen/.test(f));
muss("Kartenregel: mindestens zwei Raten (KARTE_MIN_RATEN)", minRaten === 2 && /mindestens zwei Monatsraten/.test(f));
muss(`Kartenregel: Auskunft ${SCHUFA_PREIS_EURO} €`, f.includes(`${SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} €`));
muss("Kartenregel: erst Konto, dann Karte", /Erst das Girokonto, dann die Karte/.test(f));
muss("Kartenregel: Bank entscheidet, keine Karte/PIN von FIAON", /entscheidet immer die Bank/.test(f) && /keine Karte oder PIN/.test(f));
muss("Vertrag: zwölf Monatsraten ab 03.09.2026", /ab dem 03\.09\.2026 laufen über zwölf Monatsraten/.test(f));
muss("Vertrag: Kulanz, gestellte Rate bleibt", /bereits gestellte, offene Rate bleibt zu zahlen/.test(f));
muss("Vertrag: Kündigungsschreiben nach letzter Rate", /Kündigungsschreiben/.test(f));
muss("Vertrag: alte Fassung monatlich", /vor dem 03\.09\.2026: monatlich/.test(f));
muss("Storno unbezahlt", /unbezahlte Bestellung .* storniert/.test(f));
muss("Widerruf 14 Tage", /Widerruf: 14 Tage/.test(f));
muss("Gericht je Land", /Amtsgericht/.test(f) && /Bezirksgericht/.test(f) && /Betreibungsamt/.test(f));
muss("Zahlungsseite statt Bankdaten", /fiaon\.com\/zahlung\/<Referenz>/.test(f));
muss("Startgespräch Pflicht", /Startgespräch buchen \(Pflicht/.test(f));
muss("Passwort vergessen", /passwort-vergessen/.test(f));
muss("Kein Assistenten-Verhalten in den Fakten", !/keinen Zugriff auf Kundendaten/.test(f));
muss("Agent nutzt wissenFakten ungekürzt", /wissenFakten\(\)/.test(agent) && !/wissenFakten\(\)\.slice/.test(agent) && !/wissenText\(\)\.slice\(0, 6000\)/.test(agent));
muss("Wortverbot Affiliate", !/\baffiliate\b/i.test(f.replace(/nie „Affiliate"/g, "")));

if (fehler.length) { console.error("MARA-WISSEN: FEHLT\n- " + fehler.join("\n- ")); process.exit(1); }
console.log(`MARA-WISSEN: ${f.length} Zeichen, alle ${18} Kernfakten vorhanden.`);
