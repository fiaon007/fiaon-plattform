// ═══════════════════════════════════════════════════════════════════════════
// MARKEN IM KONTOAUSZUG — wer hinter einer Gegenpartei steht (21.09.2026, E-207)
//
// Eine Liste für die Bereinigung (fiaon-kontoauszug-bereinigen.ts) und die
// Tiefenanalyse (fiaon-kontoauszug-tiefe.ts). Sie beantwortet zwei Fragen:
//   · Wie heißt der Posten? „TELEFONICA GERMANY GMBH & CO OHG" und „o2" sind
//     derselbe Anbieter; „PAYPAL … NETFLIX.COM" ist Netflix.
//   · Was ist das für eine Gegenpartei? Ein Wettanbieter, ein Abo, ein Amt —
//     daran hängen die Sparpunkte und die Regeln der Bereinigung.
//
// DIE REIHENFOLGE IST DIE RANGFOLGE: Der erste Treffer gewinnt. Deshalb steht
// „Renten Service der Deutschen Post" vor „Deutsche Post", „PayPal
// Ratenzahlung" vor „PayPal", „Amazon Prime" vor „Amazon", „Uber Eats" vor
// „Uber", „A1 Telekom" vor „Telekom" und alle Zahldienste ganz am Ende.
// ═══════════════════════════════════════════════════════════════════════════

/** Kleinbuchstaben, Umlaute ausgeschrieben, nur Buchstaben/Ziffern/Leerzeichen. */
export function flachText(s: string): string {
  return String(s ?? "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export type Markentyp =
  | "zahldienst" | "bnpl" | "spiel" | "abo" | "liefer" | "essen" | "karte"
  | "handel" | "mobil" | "telefon" | "amt";

export interface Marke { muster: RegExp; name: string; typ: Markentyp }

const ROH: [string, string, Markentyp][] = [
  // ── Ämter und Kassen (vor „Deutsche Post": die Rente kommt vom Renten Service) ──
  ["renten service|rentenservice|deutsche post renten|renten zahlung deutsche post", "Renten Service (Deutsche Post)", "amt"],
  ["rentenversicherung|\\bdrv\\b", "Deutsche Rentenversicherung", "amt"], ["\\bvbl\\b", "VBL (Zusatzrente)", "amt"],
  ["jobcenter", "Jobcenter", "amt"], ["familienkasse", "Familienkasse", "amt"],
  ["bundesagentur|arbeitsagentur|agentur fuer arbeit", "Bundesagentur für Arbeit", "amt"],
  ["\\bams\\b|arbeitsmarktservice", "AMS", "amt"], ["finanzamt", "Finanzamt", "amt"], ["bundeskasse", "Bundeskasse", "amt"],
  ["hauptzollamt", "Hauptzollamt (Kfz-Steuer)", "amt"], ["beitragsservice|ard zdf|rundfunkbeitrag|rundfunk", "Rundfunkbeitrag", "amt"],
  ["stadtkasse|gemeindekasse|kreiskasse|landeshauptkasse|amtskasse", "Stadt-/Gemeindekasse", "amt"],
  // ── Ratenkauf (PayPal-Ratenzahlung vor PayPal) ──
  ["paypal ratenzahlung|paypal pay later|paypal spaeter bezahlen|pay in 30|in 3 raten", "PayPal Ratenzahlung", "bnpl"],
  ["klarna", "Klarna", "bnpl"], ["riverty|afterpay", "Riverty", "bnpl"], ["ratepay", "Ratepay", "bnpl"], ["billpay", "Billpay", "bnpl"],
  ["scalapay", "Scalapay", "bnpl"], ["easycredit|ratenkauf by", "easyCredit", "bnpl"],
  // ── Glücksspiel und Wetten ──
  ["tipico", "Tipico", "spiel"], ["bwin", "bwin", "spiel"], ["bet365", "bet365", "spiel"], ["betano", "Betano", "spiel"],
  ["interwetten", "Interwetten", "spiel"], ["lottoland", "Lottoland", "spiel"], ["lotto24", "Lotto24", "spiel"],
  ["toto lotto|lotto toto|westlotto|lotto bayern|lotto hessen|lotto niedersachsen|lotto nrw|lotto bw|lotto rlp|lotto brandenburg|lotto berlin|lotto hamburg|lotto sachsen|next lotto|lotto", "Lotto", "spiel"],
  ["win2day", "win2day", "spiel"], ["tippland", "Tippland", "spiel"], ["pokerstars", "PokerStars", "spiel"], ["betway", "Betway", "spiel"],
  ["sportwetten|oddset", "Sportwetten", "spiel"], ["casino|spielbank|spielothek|spielhalle|novoline|wildz|mr green|mrgreen|jackpot", "Casino / Spielhalle", "spiel"],
  ["aktion mensch", "Aktion Mensch (Lotterie)", "spiel"], ["postcode lotterie", "Postcode Lotterie", "spiel"],
  ["\\bskl\\b|\\bnkl\\b|klassenlotterie|sofortlotto|eurojackpot", "Lotterie", "spiel"],
  // ── Abos und Mitgliedschaften ──
  ["netflix", "Netflix", "abo"], ["spotify", "Spotify", "abo"], ["disney", "Disney+", "abo"], ["dazn", "DAZN", "abo"],
  ["sky deutschland|sky de|sky x|sky ticket|wow tv", "Sky / WOW", "abo"],
  ["amazon prime|prime video|amazon video|amazon music|amzn prime|amazon digital|kindle unlimited", "Amazon Prime & Digital", "abo"],
  ["audible", "Audible", "abo"], ["youtube", "YouTube Premium", "abo"], ["apple com|apple services|itunes|app store|appstore|icloud", "Apple (App Store & Abos)", "abo"],
  ["google play|google one|google storage|google youtube", "Google Play & Abos", "abo"], ["deezer", "Deezer", "abo"], ["joyn", "Joyn", "abo"],
  ["rtl plus|rtlplus|tvnow", "RTL+", "abo"], ["paramount", "Paramount+", "abo"], ["waipu", "waipu.tv", "abo"], ["zattoo", "Zattoo", "abo"],
  ["magenta tv|magentatv", "MagentaTV", "abo"], ["playstation|sony interactive|\\bpsn\\b", "PlayStation", "abo"], ["xbox", "Xbox", "abo"],
  ["nintendo", "Nintendo", "abo"], ["steam|valve", "Steam", "abo"], ["twitch", "Twitch", "abo"], ["onlyfans", "OnlyFans", "abo"],
  ["tinder", "Tinder", "abo"], ["parship", "Parship", "abo"], ["elitepartner", "ElitePartner", "abo"], ["lovoo", "Lovoo", "abo"], ["bumble", "Bumble", "abo"],
  ["openai|chatgpt", "ChatGPT", "abo"], ["microsoft|msft", "Microsoft", "abo"], ["dropbox", "Dropbox", "abo"], ["adobe", "Adobe", "abo"],
  ["mcfit|fitx|clever fit|john reed|urban sports|fitness first|easyfit|kieser|holmes place|injoy|fitnessstudio", "Fitnessstudio", "abo"],
  ["hellofresh|marley spoon", "Kochbox", "abo"],
  // ── Lieferdienste und Essen unterwegs (Uber Eats vor Uber) ──
  ["lieferando", "Lieferando", "liefer"], ["wolt", "Wolt", "liefer"], ["uber eats|ubereats", "Uber Eats", "liefer"], ["deliveroo", "Deliveroo", "liefer"],
  ["flink", "Flink", "liefer"], ["getir", "Getir", "liefer"], ["gorillas", "Gorillas", "liefer"], ["domino s|dominos", "Domino's", "liefer"], ["foodora", "foodora", "liefer"],
  ["mcdonald", "McDonald's", "essen"], ["burger king", "Burger King", "essen"], ["\\bkfc\\b", "KFC", "essen"], ["subway", "Subway", "essen"], ["starbucks", "Starbucks", "essen"],
  // ── Kreditkarten: die Einzelausgaben stehen auf der Kartenabrechnung ──
  ["american express|\\bamex\\b", "American Express", "karte"], ["advanzia|gebuhrenfrei com|gebuehrenfrei com", "Advanzia", "karte"],
  ["barclaycard|barclays", "Barclays", "karte"], ["hanseatic bank|genialcard", "Hanseatic Bank", "karte"], ["tf bank", "TF Bank", "karte"],
  // ── Telefon und Internet (A1 vor Telekom) ──
  ["a1 telekom", "A1", "telefon"], ["telekom|t mobile", "Telekom", "telefon"], ["vodafone", "Vodafone", "telefon"], ["telefonica|\\bo2\\b", "o2 / Telefónica", "telefon"],
  ["1 1|1und1", "1&1", "telefon"], ["congstar", "congstar", "telefon"], ["aldi talk", "ALDI TALK", "telefon"], ["lebara", "Lebara", "telefon"],
  ["lycamobile", "Lycamobile", "telefon"], ["freenet", "freenet", "telefon"], ["klarmobil", "klarmobil", "telefon"], ["winsim|drillisch", "Drillisch / winSIM", "telefon"],
  ["pyur", "PŸUR", "telefon"], ["magenta", "Magenta", "telefon"],
  // ── Handel, Lebensmittel, Drogerie (Amazon Prime steht oben bei den Abos) ──
  ["amazon|amzn", "Amazon", "handel"], ["rewe", "REWE", "handel"], ["edeka", "EDEKA", "handel"], ["lidl", "Lidl", "handel"], ["aldi", "ALDI", "handel"],
  ["hofer", "Hofer", "handel"], ["netto", "Netto", "handel"], ["penny", "Penny", "handel"], ["kaufland", "Kaufland", "handel"], ["norma", "Norma", "handel"],
  ["globus", "Globus", "handel"], ["tegut", "tegut", "handel"], ["billa", "BILLA", "handel"], ["interspar|eurospar|spar food|\\bspar\\b", "SPAR", "handel"],
  ["\\bdm\\b|dm drogerie|dm fil", "dm", "handel"], ["rossmann", "Rossmann", "handel"], ["mueller drogerie|drogerie mueller", "Müller", "handel"],
  ["zalando", "Zalando", "handel"], ["\\botto\\b", "OTTO", "handel"], ["ebay", "eBay", "handel"], ["temu", "Temu", "handel"], ["shein", "SHEIN", "handel"],
  ["aliexpress", "AliExpress", "handel"], ["ikea", "IKEA", "handel"], ["media markt|mediamarkt|media saturn|saturn", "MediaMarkt / Saturn", "handel"],
  ["primark", "Primark", "handel"], ["\\baction\\b", "Action", "handel"], ["\\btedi\\b", "TEDi", "handel"], ["\\bkik\\b", "KiK", "handel"],
  ["decathlon", "Decathlon", "handel"], ["deutsche post|\\bdhl\\b", "Deutsche Post / DHL", "handel"],
  // ── Mobilität ──
  ["\\bshell\\b", "Shell", "mobil"], ["\\baral\\b", "Aral", "mobil"], ["\\besso\\b", "Esso", "mobil"], ["\\bjet\\b", "JET", "mobil"],
  ["totalenergies|total tankstelle", "TotalEnergies", "mobil"], ["\\bomv\\b", "OMV", "mobil"],
  ["deutsche bahn|db vertrieb|db fernverkehr|db regio|\\bdb\\b", "Deutsche Bahn", "mobil"], ["\\bbvg\\b", "BVG", "mobil"], ["\\bmvg\\b", "MVG", "mobil"],
  ["\\bhvv\\b", "HVV", "mobil"], ["flixbus|flixtrain", "Flix", "mobil"], ["\\buber\\b", "Uber", "mobil"], ["\\bbolt\\b", "Bolt", "mobil"],
  ["free now", "FREE NOW", "mobil"], ["\\bsixt\\b", "Sixt", "mobil"],
  // ── Zahldienste ganz am Ende: Der eigentliche Händler steht meist im Zweck ──
  ["paypal", "PayPal", "zahldienst"], ["sumup", "SumUp", "zahldienst"], ["stripe", "Stripe", "zahldienst"], ["adyen", "Adyen", "zahldienst"],
  ["payone", "Payone", "zahldienst"], ["computop", "Computop", "zahldienst"], ["unzer", "Unzer", "zahldienst"], ["mollie", "Mollie", "zahldienst"],
  ["nexi", "Nexi", "zahldienst"], ["worldline", "Worldline", "zahldienst"], ["global collect|globalcollect", "GlobalCollect", "zahldienst"],
  ["gocardless|gc re", "GoCardless", "zahldienst"], ["trustly", "Trustly", "zahldienst"], ["skrill", "Skrill", "zahldienst"],
  ["neteller", "Neteller", "zahldienst"], ["paysafe", "Paysafe", "zahldienst"],
];

export const MARKEN: Marke[] = ROH.map(([m, name, typ]) => ({
  muster: new RegExp(m.split("|").map((t) => (t.startsWith("\\b") ? t : `\\b${t}\\b`)).join("|")),
  name, typ,
}));

/** Die erste passende Marke im Text (Rangfolge = Reihenfolge der Liste). */
export function markeIn(text: string): Marke | null {
  const t = flachText(text);
  if (!t) return null;
  for (const m of MARKEN) if (m.muster.test(t)) return m;
  return null;
}

/** Händler, von denen kein Einkommen kommt — eine Gutschrift von dort ist eine Erstattung. */
export const HAENDLER_TYPEN = new Set<Markentyp>(["abo", "liefer", "essen", "karte", "bnpl", "handel", "mobil", "telefon", "zahldienst"]);

/** Gegenparteien, die nichts über den Empfänger sagen — dann zählt der Zweck. */
export const GENERISCHE_GEGENPARTEI = new Set(["", "privatperson", "pos", "sepa", "lastschrift", "sepa lastschrift", "basislastschrift",
  "sepa basislastschrift", "kartenzahlung", "kartenumsatz", "ueberweisung", "dauerauftrag", "gutschrift", "einzahlung", "auszahlung", "bank",
  "buchung", "zahlung", "unbekannt", "sonstige", "sonstige ausgabe", "sonstige einnahme", "geldautomat", "bargeld", "bargeldauszahlung", "bareinzahlung"]);

/**
 * Die Marke einer Buchung: aus der Gegenpartei — oder, wenn die nichts sagt
 * (Zahldienst wie PayPal, „Privatperson", „Lastschrift"), aus dem Zweck.
 * Bei einer Firma mit eigenem Namen zählt der Zweck NICHT: „DB Fernverkehr …
 * Verdienstabrechnung" im Zweck einer Gehaltszahlung macht den Arbeitgeber
 * nicht zur Bahnfahrt.
 */
export function markeDerBuchung(empfaenger: string, zweck: string, kategorieLabel = ""): Marke | null {
  const ausName = markeIn(empfaenger);
  if (ausName && ausName.typ !== "zahldienst") return ausName;
  const gegen = flachText(empfaenger);
  const generisch = GENERISCHE_GEGENPARTEI.has(gegen) || (kategorieLabel !== "" && gegen === flachText(kategorieLabel));
  if (ausName || generisch) {
    const ausZweck = markeIn(zweck);
    if (ausZweck && ausZweck.typ !== "zahldienst") return ausZweck;
  }
  return ausName;
}

