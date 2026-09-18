// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FÜR WEN (19.09.2026, E-191)
// Vier Unternehmensformen (Mittelstand, Onlinehandel, Agenturen und Software,
// Bau und Immobilien) und zwei Herkunftsländer (Deutschland, Schweiz).
// Österreich bekommt erst eine eigene Seite, wenn die gewerberechtliche Frage
// geklärt ist (E-187) — bis dahin nennen die Seiten Österreich nur allgemein.
//
// Jede Seite sagt ehrlich, wann eine US-Gesellschaft passt — und wann nicht.
// Kein Steuerversprechen, keine Zahl ohne Quelle, kein Bankname.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, globalPreisText, globalPlanungText } from "../fiaon-global";
import type { GlobalSeite } from "./typen";

const S = "2026-09-19";

export const ZIELGRUPPEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/tochtergesellschaft-usa",
    art: "zielgruppe",
    seo: {
      titel: "Tochtergesellschaft in den USA gründen — FIAON Global",
      beschreibung: "US-Tochter für den Mittelstand: Gründung, EIN, Konto und Pflichtenkalender aus einer Hand. Mit Partner-Steuerberater, Anwalt und Team vor Ort. Festpreis.",
    },
    stand: S,
    kennung: "FG · 11",
    auge: "Für wen · Mittelstand",
    h1: "Die Tochter in den USA.",
    h1b: "Für Unternehmen mit echtem US-Geschäft.",
    lead: "Kunden in den USA, ein Lieferant in Texas, ein Projekt in Florida: Wer dort Geschäft macht, braucht dort früher oder später eine eigene Gesellschaft. Wir gründen Ihre US-Tochter, holen die Steuernummern, bereiten das Konto vor und führen den Pflichtenkalender — abgestimmt mit Ihrem Steuerberater zu Hause.",
    ziffern: [
      { wert: `ab ${globalPreisText("global_struktur")}`, label: "Festpreis, einmalig, alle Gebühren inklusive" },
      { wert: "LLC oder Corporation", label: "geprüft vor der Gründung" },
      { wert: "Miami", label: "Termine vor Ort mit unserem Team" },
    ],
    blick: [
      ["Gesellschafterin", "Ihre GmbH, AG oder Holding — oder Sie persönlich"],
      ["Rechtsform", "LLC oder Corporation, je nach Konzernstruktur und Plänen"],
      ["Abstimmung", "Mit Ihrem Steuerberater und unserem Partner-Steuerberater"],
      ["Konto", "Antrag für die Tochter vollständig vorbereitet"],
      ["Pflichten", "US-Meldungen im Kalender, Meldung zu Hause mit Ihrem Steuerberater"],
      ["Vertragspartner", "FIAON LTD, London"],
    ],
    kurz: "Eine US-Tochtergesellschaft gründet Ihr Unternehmen, wenn es in den USA verkauft, einkauft, Verträge schließt oder Mitarbeiter einsetzt. Gesellschafterin ist meist die GmbH, AG oder Holding im Heimatland. FIAON Global übernimmt Gründung, EIN, Registered Agent, Adresse und die Vorbereitung des Kontos; die steuerliche Abstimmung zwischen beiden Ländern prüft unser Partner-Steuerberater vor der Gründung.",
    bloecke: [
      {
        typ: "text", id: "wann", h2: "Wann eine US-Tochter sinnvoll ist",
        absaetze: ["Eine eigene Gesellschaft in den USA lohnt sich, wenn dort echtes Geschäft entsteht — nicht als Formalität. Typische Anlässe sind:"],
        punkte: [
          "US-Kunden verlangen einen Vertragspartner mit Sitz in den USA",
          "Einkauf, Lager oder Fertigung in den USA",
          "Projekte vor Ort, etwa im Bau oder im Anlagenbau",
          "Mitarbeiter oder Vertriebspartner in den USA",
          "Haftung für das US-Geschäft soll vom Stammhaus getrennt sein",
        ],
        nach: "Fehlt ein solcher Anlass, sagen wir Ihnen das im ersten Gespräch.",
      },
      {
        typ: "karten", id: "form", h2: "LLC oder Corporation für die Tochter", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Schlank und flexibel", text: "Ein Operating Agreement statt fester Organe, keine Mindestkapitalregeln. Für den Einstieg in den US-Markt oft die einfachere Form." },
          { tag: "Corporation", titel: "Wenn Anteile wandern sollen", text: "Die übliche Form, wenn US-Investoren, Joint-Venture-Partner oder Mitarbeiter beteiligt werden sollen." },
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "So entsteht die US-Tochter",
        etappen: [
          { titel: "Abstimmung", text: "Startgespräch mit Ihnen, Prüfung durch unseren Partner-Steuerberater, auf Wunsch gemeinsam mit Ihrem Steuerberater." },
          { titel: "Beschluss und Unterlagen", text: "Registerauszug der Muttergesellschaft, Pässe der Geschäftsführung, Name und Tätigkeitsbeschreibung der Tochter." },
          { titel: "Gründung und EIN", text: "Einreichung beim Bundesstaat durch unser Team vor Ort, Operating Agreement oder Satzung durch unseren Partner-Anwalt, EIN bei der IRS." },
          { titel: "Konto und Pflichten", text: "Kontoantrag vollständig vorbereitet, Pflichtenkalender für US-Meldungen und Staatsgebühren." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Wird die US-Tochter tatsächlich aus Deutschland, Österreich oder der Schweiz geleitet, kann sie dort steuerpflichtig sein. Wer die Tochter wo führt, gehört deshalb in die Prüfung vor der Gründung.",
          "Die Beteiligung an einer ausländischen Gesellschaft ist dem Finanzamt zu melden — in Deutschland nach § 138 AO. Gehört eine Florida-LLC einer GmbH oder AG, gibt diese in Florida zudem eine eigene Steuererklärung ab (Form F-1120).",
          "Verrechnungspreise zwischen Mutter und Tochter, Lohnbuchhaltung in den USA und Visa sind nicht Teil der Pakete; wir nennen Ihnen Partner dafür.",
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Für die Tochter mit Konto und Kartenleiter: Global Banking.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Kann meine GmbH Gesellschafterin der US-Gesellschaft sein?", a: "Ja. Gesellschafterin einer LLC oder Corporation kann eine GmbH, AG oder Holding ebenso sein wie eine natürliche Person. Wir benötigen dann den Registerauszug der Muttergesellschaft." },
      { f: "Muss die US-Tochter in den USA versteuert werden?", a: "Das hängt von Rechtsform, Tätigkeit und Ort der Leitung ab. Unser Partner-Steuerberater prüft das vor der Gründung; die laufende Steuererklärung übernimmt Ihr Steuerberater." },
      { f: "Übernimmt FIAON auch Visa für Mitarbeiter?", a: "Nein. Visa, Lohnbuchhaltung und Verrechnungspreise sind nicht Teil der Pakete. Wir nennen Ihnen auf Wunsch Partner dafür." },
      { f: "Wie lange dauert die Gründung der Tochter?", a: "Die Gesellschaft steht in der Regel nach wenigen Wochen, sobald die Unterlagen vollständig sind. Die EIN vergibt die IRS in eigener Frist." },
    ],
    paket: "global_banking",
    weiter: ["/business/us-firmengruendung", "/business/wissen/llc-oder-corporation", "/business/aus-deutschland", "/business/us-pflichten"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/onlinehandel",
    art: "zielgruppe",
    seo: {
      titel: "US-Firma für Onlinehändler und Marken — FIAON Global",
      beschreibung: "Onlinehandel in den USA mit eigener Gesellschaft: EIN, US-Konto, Adresse und Pflichtenkalender aus einer Hand — ehrlich zu Steuern und Sales Tax.",
    },
    stand: S,
    kennung: "FG · 12",
    auge: "Für wen · Onlinehandel",
    h1: "Onlinehandel in den USA.",
    h1b: "Mit eigener Gesellschaft vor Ort.",
    lead: "Marktplätze, Zahlungsdienste und Logistiker in den USA arbeiten am liebsten mit US-Gesellschaften: mit EIN, US-Konto und US-Adresse. Wir bauen diese Struktur für Ihre Marke — und sagen Ihnen offen, welche Pflichten der Verkauf in den USA mit sich bringt.",
    ziffern: [
      { wert: `ab ${globalPreisText("global_struktur")}`, label: "Festpreis, einmalig" },
      { wert: "EIN, Konto, Adresse", label: "die Grundausstattung für den US-Handel" },
      { wert: "Pflichtenkalender", label: "ab Global Banking" },
    ],
    blick: [
      ["Für", "Eigene Marken, Onlineshops, Händler auf US-Marktplätzen"],
      ["Sie bekommen", "US-Gesellschaft, EIN, US-Adresse, Konto- und Kartenantrag"],
      ["Umsatzsteuer", "In den USA erheben die Bundesstaaten eigene Umsatzsteuern — das prüfen Sie mit einem US-CPA"],
      ["Zu Hause", "Steuerpflicht dort, wo die Gesellschaft geführt wird"],
      ["Nicht enthalten", "Buchhaltung, Umsatzsteuer-Registrierungen, Marktplatz-Konten"],
      ["Festpreis", `ab ${globalPreisText("global_struktur")}, alle Gebühren inklusive`],
    ],
    kurz: "Wer an Kunden in den USA verkauft, profitiert von einer eigenen US-Gesellschaft mit EIN, US-Konto und US-Adresse — viele Marktplätze, Zahlungsdienste und Logistiker erwarten genau das. FIAON Global baut diese Struktur. Die Umsatzsteuern der Bundesstaaten, die Buchhaltung und die Steuerpflicht im Heimatland bleiben Themen für Ihren Steuerberater und einen US-CPA.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Warum eine US-Gesellschaft für den Handel",
        absaetze: ["Für den Verkauf an US-Kunden ist eine eigene Gesellschaft kein Muss, aber oft der einfachere Weg:"],
        punkte: [
          "Marktplätze und Zahlungsdienste in den USA arbeiten mit US-Gesellschaften mit EIN meist unkomplizierter",
          "Auszahlungen in US-Dollar auf ein US-Konto sparen Umrechnung und Wartezeit",
          "US-Logistiker und Lager verlangen oft einen US-Vertragspartner",
          "Die Haftung für das US-Geschäft liegt bei der US-Gesellschaft",
        ],
      },
      {
        typ: "hinweis", id: "steuern", h2: "Was der Verkauf in den USA mit sich bringt",
        punkte: [
          "Umsatzsteuer: In den USA erheben die Bundesstaaten eigene Umsatzsteuern mit eigenen Schwellen. Ob und wo Ihre Gesellschaft sich registrieren muss, prüfen Sie mit einem US-CPA — das ist nicht Teil der Pakete.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
      {
        typ: "karten", id: "passt", h2: "Passt — und passt nicht", spalten: 2,
        karten: [
          { tag: "Passt", titel: "Marken mit echtem US-Geschäft", text: "Sie verkaufen bereits an US-Kunden oder starten dort mit Lager, Marktplatz oder eigenem Shop — und wollen Konto, Karten und Zahlungen in den USA." },
          { tag: "Passt nicht", titel: "Wer nur aus Steuergründen gründen will", text: "Eine US-Gesellschaft, die aus Deutschland, Österreich oder der Schweiz geführt wird, ist dort in der Regel steuerpflichtig. Als Steuermodell taugt sie nicht." },
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Mit Konto, weiteren Kartenanträgen und Pflichtenkalender: Global Banking.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Brauche ich für den Verkauf in die USA eine US-Firma?", a: "Nicht zwingend. Viele Marktplätze, Zahlungsdienste und Logistiker arbeiten aber einfacher mit einer US-Gesellschaft mit EIN, US-Konto und US-Adresse." },
      { f: "Muss meine US-Gesellschaft Umsatzsteuer abführen?", a: "Das hängt vom Bundesstaat und Ihren Umsätzen dort ab. Die Bundesstaaten erheben eigene Umsatzsteuern mit eigenen Schwellen; das prüfen Sie mit einem US-CPA." },
      { f: "Ist die Buchhaltung enthalten?", a: "Nein. Die Pakete enthalten die erste jährliche US-Meldung durch unseren US-CPA, nicht die laufende Buchhaltung." },
      { f: "Spare ich mit einer US-LLC Steuern?", a: "In der Regel nicht. Wird die Gesellschaft aus Deutschland, Österreich oder der Schweiz geführt, ist sie dort steuerpflichtig." },
    ],
    paket: "global_banking",
    weiter: ["/business/us-geschaeftskonto", "/business/wissen/us-llc-steuern", "/business/us-pflichten", "/business/wyoming"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/agenturen-software",
    art: "zielgruppe",
    seo: {
      titel: "US-Firma für Agenturen und Software — FIAON Global",
      beschreibung: "Agenturen, Software und Dienstleister mit US-Kunden: US-Gesellschaft, EIN, Konto und Verträge mit US-Partnern — aus einer Hand, zum Festpreis.",
    },
    stand: S,
    kennung: "FG · 13",
    auge: "Für wen · Agenturen und Software",
    h1: "Agenturen und Software.",
    h1b: "Verträge mit US-Kunden auf Augenhöhe.",
    lead: "US-Kunden unterschreiben lieber mit einer US-Gesellschaft: US-Rechnung, US-Konto, US-Steuernummer. Für Agenturen, Softwarehäuser und Dienstleister bauen wir diese Struktur — und für Gründer, die Investoren in den USA ansprechen wollen, die passende Corporation.",
    ziffern: [
      { wert: `ab ${globalPreisText("global_struktur")}`, label: "Festpreis, einmalig" },
      { wert: "LLC oder Corporation", label: "je nach Kunden- und Investorenplänen" },
      { wert: "EIN", label: "US-Kunden fragen eine US-Steuernummer ab" },
    ],
    blick: [
      ["Für", "Agenturen, Softwarehäuser, Dienstleister und freie Berufe mit US-Kunden, Gründer mit US-Investoren"],
      ["Sie bekommen", "US-Gesellschaft, EIN, US-Adresse und Telefon, Kontoantrag"],
      ["Investoren", "Wer US-Kapital anspricht, gründet meist eine Corporation"],
      ["Verträge", "US-Kunden fragen Steuernummer und Steuerformular (W-9 oder W-8) ab"],
      ["Zu Hause", "Steuerpflicht dort, wo die Gesellschaft geführt wird"],
      ["Festpreis", `ab ${globalPreisText("global_struktur")}, alle Gebühren inklusive`],
    ],
    kurz: "Dienstleister mit US-Kunden stellen mit einer US-Gesellschaft Rechnungen aus den USA, erhalten Zahlungen auf ein US-Konto und geben bei Vertragsschluss eine US-Steuernummer an. Wer Investoren in den USA ansprechen will, gründet in der Regel eine Corporation. FIAON Global übernimmt Gründung, EIN, Adresse und die Vorbereitung des Kontos.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Warum US-Kunden eine US-Gesellschaft bevorzugen",
        absaetze: [
          "Einkaufsabteilungen in den USA arbeiten mit festen Abläufen: ein Lieferant mit US-Steuernummer, das passende Steuerformular, Zahlung per US-Überweisung. Ein ausländischer Dienstleister passt oft nicht in dieses Raster — eine US-Gesellschaft schon.",
          "Hinzu kommt die Haftung: Verträge nach US-Recht mit US-Kunden liegen bei der US-Gesellschaft, nicht beim Unternehmen zu Hause.",
        ],
      },
      {
        typ: "karten", id: "form", h2: "LLC oder Corporation", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Für Dienstleister", text: "Schlank, ohne feste Organe. Passt, wenn die US-Gesellschaft Aufträge abwickelt und keine Investoren aufnimmt." },
          { tag: "Corporation", titel: "Für Gründer mit US-Investoren", text: "Investoren in den USA erwarten in der Regel eine Corporation. Welche Staatenwahl dazu passt, prüfen wir vor der Gründung mit Ihnen." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Arbeiten Sie selbst oder Ihre Mitarbeiter in den USA, sind Visa und US-Arbeitsrecht zu beachten. Beides ist nicht Teil der Pakete.",
          "Verträge mit US-Kunden prüft ein US-Anwalt; die Pakete enthalten das Operating Agreement Ihrer Gesellschaft, nicht Ihre Kundenverträge.",
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Gesellschaft, Steuernummern und der erste Konto- und Kartenantrag: Global Struktur.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "Warum verlangen US-Kunden eine US-Steuernummer?", a: "US-Unternehmen fragen bei Lieferanten eine Steuernummer und ein Steuerformular ab (W-9 oder W-8), weil sie Zahlungen der Steuerbehörde melden. Mit einer eigenen US-Gesellschaft und EIN beantworten Sie diese Abfrage aus den USA; welches Formular Ihre Gesellschaft ausfüllt, klärt unser US-CPA." },
      { f: "Brauche ich für US-Investoren eine Corporation?", a: "In der Regel ja. Investoren in den USA erwarten meist eine Corporation. Die passende Wahl prüfen wir vor der Gründung." },
      { f: "Prüft FIAON meine Kundenverträge?", a: "Nein. Die Pakete enthalten das Operating Agreement durch unseren Partner-Anwalt. Kundenverträge prüft ein US-Anwalt auf eigenes Mandat." },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-firmengruendung", "/business/wissen/llc-oder-corporation", "/business/delaware", "/business/ein-itin"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/bau-immobilien",
    art: "zielgruppe",
    seo: {
      titel: "US-Gesellschaft für Bau und Immobilien — FIAON Global",
      beschreibung: "Projekte und Objekte in den USA über eine eigene Gesellschaft: Gründung, EIN, Konto, Kennzahlen für Finanzierungsgespräche — mit Team vor Ort in Miami.",
    },
    stand: S,
    kennung: "FG · 14",
    auge: "Für wen · Bau und Immobilien",
    h1: "Bau und Immobilien.",
    h1b: "Projekte in den USA, sauber aufgestellt.",
    lead: "Wer in den USA baut, saniert oder Objekte hält, trennt jedes Projekt in eine eigene Gesellschaft. Wir gründen sie, holen die Steuernummern, bereiten Konto und Kennzahlen vor — und begleiten mit unserem Team in Miami und der Schwarzott Capital Partners AG in Zürich die Kapital-Etappe.",
    ziffern: [
      { wert: globalPlanungText("global_kapital"), label: "Kapitalrahmen Global Kapital, als Ziel" },
      { wert: "Miami", label: "Team vor Ort für Termine" },
      { wert: "Kennzahlen-Mappe", label: "für Finanzierungsgespräche, ab Global Kapital" },
    ],
    blick: [
      ["Für", "Bauunternehmen, Projektentwickler, Bestandshalter"],
      ["Struktur", "Eine Gesellschaft je Projekt oder Objekt — meist LLC"],
      ["Kapital", "Kennzahlen und Unterlagen für Finanzierungsgespräche"],
      ["Vor Ort", "Termine in Miami mit der Schwarzott Global LLC"],
      ["Entscheidung", "Über jede Finanzierung entscheidet das Institut"],
      ["Paket", "Global Kapital oder Global VIP"],
    ],
    kurz: "Für Projekte und Objekte in den USA wird üblicherweise je Projekt eine eigene Gesellschaft gegründet, meist eine LLC. FIAON Global gründet sie, beantragt die EIN, bereitet Konto und eine Kennzahlen-Mappe für Finanzierungsgespräche vor. Über jede Finanzierung entscheidet das jeweilige Institut; FIAON vergibt und vermittelt keine Kredite.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Eine Gesellschaft je Projekt",
        absaetze: [
          "In den USA ist es üblich, jedes Bauprojekt und jedes Objekt in einer eigenen Gesellschaft zu halten. Das trennt die Haftung, macht Finanzierungen und Verkäufe einfacher und hält die Zahlen je Projekt sauber.",
          "Für Unternehmen aus Deutschland, Österreich oder der Schweiz kommt hinzu: Ein Team vor Ort, das Termine wahrnimmt und Unterlagen einreicht, spart Reisen — und die Schwarzott Capital Partners AG in Zürich, zu deren Geschäft Immobilieninvestitionen im Ausland gehören, begleitet die Kapital-Etappe.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "Vom Projekt zur Finanzierung",
        etappen: [
          { titel: "Projektgesellschaft", text: "Gründung, EIN, Registered Agent, Operating Agreement — je Projekt eine eigene Gesellschaft." },
          { titel: "Konto und Karten", text: "Konto für die Projektgesellschaft, Kartenleiter für laufende Ausgaben." },
          { titel: "Kennzahlen-Mappe", text: "Projektzahlen, Kosten, Zeitplan und Unterlagen, aufbereitet für Finanzierungsgespräche." },
          { titel: "Finanzierungsgespräch", text: "Den Antrag stellen Sie beim Institut; die Entscheidung trifft das Institut nach seinen Regeln." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "FIAON ist keine Bank, vergibt keine Kredite und vermittelt keine. Über jede Finanzierung entscheidet das jeweilige Institut.",
          "Der Erwerb von Immobilien in den USA bringt eigene Steuer- und Meldepflichten mit sich. Das prüfen Sie mit einem US-CPA und Ihrem Steuerberater.",
          GLOBAL_PFLICHTHINWEIS.de[0],
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Global Kapital begleitet bis zur Kennzahlen-Mappe für ein Bankdarlehen — mit Vorrang bei Terminen vor Ort.", paket: "global_kapital" },
      { typ: "standorte", id: "standorte", h2: "Miami und Zürich", lead: "Termine vor Ort mit der Schwarzott Global LLC, Kapital-Etappe mit der Schwarzott Capital Partners AG." },
    ],
    fragen: [
      { f: "Brauche ich für jedes Projekt eine eigene Gesellschaft?", a: "Üblich ist es: Eine Gesellschaft je Projekt trennt Haftung und Zahlen und erleichtert Finanzierung und Verkauf. Ob es in Ihrem Fall passt, klären wir im Startgespräch." },
      { f: "Finanziert FIAON mein Projekt?", a: "Nein. FIAON vergibt keine Kredite und vermittelt keine. Wir bereiten Kennzahlen und Unterlagen für Finanzierungsgespräche vor; entscheiden tut das Institut." },
      { f: "Kann ich Termine vor Ort wahrnehmen lassen?", a: "Ja. Unser Team in Miami nimmt Termine bei Behörden und Instituten wahr. Im Paket Global VIP reisen Sie auf Wunsch selbst zum Auftakt an." },
    ],
    paket: "global_kapital",
    weiter: ["/business/firmenkarten-kapital", "/business/miami", "/business/florida", "/business/partner"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/aus-deutschland",
    art: "land",
    seo: {
      titel: "US-Firma aus Deutschland gründen — FIAON Global",
      beschreibung: "US-LLC oder Corporation aus Deutschland: Steuerpflicht nach Ort der Geschäftsleitung, Meldung nach § 138 AO, Typenvergleich — ehrlich erklärt.",
    },
    stand: S,
    kennung: "FG · 15",
    auge: "Für wen · Aus Deutschland",
    h1: "Aus Deutschland in die USA.",
    h1b: "Mit allem, was das Finanzamt wissen muss.",
    lead: "Eine US-Gesellschaft zu gründen ist aus Deutschland unkompliziert. Wichtig ist, was danach zu Hause gilt: Wo die Gesellschaft geführt wird, dort ist sie in der Regel steuerpflichtig, und die Beteiligung ist dem Finanzamt zu melden. Das prüft unser Partner-Steuerberater vor der Gründung.",
    ziffern: [
      { wert: "§ 138 AO", label: "Meldung der ausländischen Beteiligung" },
      { wert: "§ 10 AO", label: "Ort der Geschäftsleitung" },
      { wert: "Typenvergleich", label: "wie das Finanzamt die LLC einordnet" },
    ],
    blick: [
      ["Steuerpflicht", "Dort, wo die Gesellschaft tatsächlich geleitet wird (§ 10 AO, § 1 KStG)"],
      ["Einordnung", "Typenvergleich: Wie eine GmbH oder wie eine Personengesellschaft?"],
      ["Meldung", "Beteiligung an einer ausländischen Gesellschaft nach § 138 AO"],
      ["Vor der Gründung", "Prüfung durch unseren Partner-Steuerberater — im Festpreis"],
      ["Laufend", "Steuererklärung zu Hause mit Ihrem Steuerberater"],
      ["Festpreis", `ab ${globalPreisText("global_struktur")}, alle Gebühren inklusive`],
    ],
    kurz: "Unternehmer aus Deutschland können eine US-LLC oder Corporation ohne Wohnsitz in den USA gründen. Wird die Gesellschaft von Deutschland aus geleitet, liegt der Ort ihrer Geschäftsleitung in Deutschland (§ 10 AO) und sie ist hier in der Regel steuerpflichtig. Die Beteiligung ist dem Finanzamt nach § 138 AO zu melden. Wie das Finanzamt eine LLC einordnet, entscheidet ein Typenvergleich.",
    bloecke: [
      {
        typ: "text", id: "geschaeftsleitung", h2: "Ort der Geschäftsleitung — der entscheidende Punkt",
        absaetze: [
          "Nach § 10 AO ist die Geschäftsleitung der Mittelpunkt der geschäftlichen Oberleitung — dort, wo die wichtigen Entscheidungen getroffen werden. Eine Kapitalgesellschaft mit Geschäftsleitung in Deutschland ist hier unbeschränkt körperschaftsteuerpflichtig (§ 1 KStG), auch wenn ihr Sitz in den USA liegt.",
          "Für die meisten Unternehmer bedeutet das: Wer seine US-Gesellschaft vom Schreibtisch in Deutschland aus führt, versteuert sie in Deutschland. In den USA kommen die jährlichen Meldepflichten hinzu. Das ist kein Nachteil der US-Gesellschaft — es ist nur kein Steuermodell.",
        ],
      },
      {
        typ: "text", id: "typenvergleich", h2: "Der Typenvergleich",
        absaetze: [
          "Das deutsche Steuerrecht kennt keine LLC. Deshalb prüft das Finanzamt anhand ihrer Merkmale, ob sie eher einer Kapitalgesellschaft wie der GmbH oder einer Personengesellschaft entspricht — der sogenannte Typenvergleich. Die Kriterien hat das Bundesfinanzministerium für die US-LLC in einem eigenen Schreiben festgelegt (BMF vom 19. März 2004); die Einordnung in den USA, das sogenannte Check-the-box-Wahlrecht, spielt dafür keine Rolle.",
          "Das Ergebnis hängt vom Operating Agreement ab: Wer entscheidet, wie Gewinne verteilt werden, ob Anteile übertragbar sind. Deshalb prüft unser Partner-Steuerberater die Einordnung, bevor das Operating Agreement geschrieben wird.",
        ],
      },
      {
        typ: "text", id: "meldung", h2: "Die Meldung nach § 138 AO",
        absaetze: [
          "Wer eine Beteiligung an einer Gesellschaft im Ausland gründet oder erwirbt — ab zehn Prozent oder mehr als 150.000 Euro Anschaffungskosten —, meldet das dem Finanzamt. Für Gesellschaften in Drittstaaten wie den USA gilt das zusätzlich, sobald Sie erstmals beherrschenden Einfluss haben. Gemeldet wird elektronisch mit der Einkommen- oder Körperschaftsteuererklärung, spätestens 14 Monate nach Ablauf des Jahres. Wer die Meldung versäumt, riskiert ein Bußgeld von höchstens 25.000 Euro (§ 379 AO).",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Eine US-Gesellschaft ist kein Weg, Steuern in Deutschland zu vermeiden. Wer das verspricht, verschweigt den Ort der Geschäftsleitung.",
          "Die Prüfung vor der Gründung durch unseren Partner-Steuerberater ist im Festpreis enthalten; die laufende Steuererklärung übernimmt Ihr Steuerberater.",
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Gründung, Steuernummern und die Prüfung vor der Gründung: Global Struktur.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "Kann ich als Deutscher eine US-LLC gründen?", a: "Ja, ohne Wohnsitz und ohne Staatsbürgerschaft in den USA. Sie brauchen einen Reisepass, einen Adressnachweis und bei einer Firma als Gesellschafterin deren Registerauszug." },
      { f: "Muss ich meine US-LLC in Deutschland versteuern?", a: "In der Regel ja, wenn Sie sie von Deutschland aus leiten: Der Ort der Geschäftsleitung liegt dann in Deutschland (§ 10 AO). Unser Partner-Steuerberater prüft Ihren Fall vor der Gründung." },
      { f: "Muss ich die US-Gesellschaft dem Finanzamt melden?", a: "Ja. Nach § 138 AO ist die Gründung oder der Erwerb einer Beteiligung an einer ausländischen Gesellschaft zu melden — elektronisch mit der Steuererklärung, spätestens 14 Monate nach Ablauf des Jahres. Versäumnisse können mit einem Bußgeld geahndet werden." },
      { f: "Wie ordnet das Finanzamt eine LLC ein?", a: "Über einen Typenvergleich: Je nach Operating Agreement wie eine Kapitalgesellschaft oder wie eine Personengesellschaft. Deshalb wird die Einordnung vor dem Operating Agreement geprüft." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/wissen/llc-oder-gmbh", "/business/us-pflichten", "/business/privatpersonen"],
    quellen: [
      { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
      { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
      { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
      { titel: "§ 379 AO — Steuergefährdung", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
      { titel: "BMF-Schreiben vom 19.03.2004 zur US-LLC (KStH 2022, Anlage 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/aus-der-schweiz",
    art: "land",
    seo: {
      titel: "US-Firma aus der Schweiz gründen — FIAON Global",
      beschreibung: "US-Gesellschaft aus der Schweiz: tatsächliche Verwaltung, Steuerpflicht, Partner in Zürich — Gründung, EIN und Konto aus einer Hand, zum Festpreis.",
    },
    stand: S,
    kennung: "FG · 16",
    auge: "Für wen · Aus der Schweiz",
    h1: "Aus der Schweiz in die USA.",
    h1b: "Mit einem Partner in Zürich.",
    lead: "Für Unternehmen aus der Schweiz ist der Weg in die USA kurz: Wir gründen Ihre US-Gesellschaft, holen die Steuernummern und bereiten das Konto vor — mit der Schwarzott Capital Partners AG in Zürich als Partner vor Ort und unserem Team in Miami.",
    ziffern: [
      { wert: "Zürich", label: "Partner vor Ort: Schwarzott Capital Partners AG" },
      { wert: "Art. 50 DBG", label: "Steuerpflicht bei tatsächlicher Verwaltung" },
      { wert: `ab ${globalPreisText("global_struktur")}`, label: "Festpreis, einmalig" },
    ],
    blick: [
      ["Steuerpflicht", "Bei Sitz oder tatsächlicher Verwaltung in der Schweiz (Art. 50 DBG)"],
      ["Partner", "Schwarzott Capital Partners AG, Schifflände 26, Zürich"],
      ["Vor Ort in den USA", "Schwarzott Global LLC, Miami"],
      ["Vor der Gründung", "Prüfung durch unseren Partner-Steuerberater — im Festpreis"],
      ["Laufend", "Steuererklärung in der Schweiz mit Ihrer Treuhand"],
      ["Vertragspartner", "FIAON LTD, London"],
    ],
    kurz: "Unternehmen und Unternehmer aus der Schweiz können eine US-Gesellschaft ohne Wohnsitz in den USA gründen. Wird die Gesellschaft tatsächlich von der Schweiz aus verwaltet, ist sie hier nach Art. 50 DBG unbeschränkt steuerpflichtig. FIAON Global übernimmt Gründung, EIN, Registered Agent und die Vorbereitung des Kontos — mit einem Partner in Zürich und einem Team in Miami.",
    bloecke: [
      {
        typ: "text", id: "verwaltung", h2: "Die tatsächliche Verwaltung",
        absaetze: [
          "Das Schweizer Recht knüpft die Steuerpflicht einer juristischen Person an ihren Sitz oder den Ort ihrer tatsächlichen Verwaltung (Art. 50 DBG). Wer seine US-Gesellschaft von der Schweiz aus führt, muss deshalb damit rechnen, dass sie hier steuerpflichtig ist.",
          "Wie die Gesellschaft in der Schweiz eingeordnet wird und welche Pflichten daraus folgen, prüft unser Partner-Steuerberater vor der Gründung; die laufende Erklärung übernimmt Ihre Treuhand.",
        ],
      },
      {
        typ: "text", id: "zuerich", h2: "Ein Partner in Zürich",
        absaetze: [
          "Die Schwarzott Capital Partners AG mit Sitz an der Schifflände in Zürich begleitet für FIAON Global die Kapital-Etappe und ist Ansprechpartner für Unternehmen aus der Schweiz. Sie ist eine Beteiligungs- und Investmentgesellschaft — keine Bank, und sie vergibt keine Kredite.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Eine US-Gesellschaft ist kein Weg, Steuern in der Schweiz zu vermeiden, wenn sie von hier aus verwaltet wird.",
          GLOBAL_PFLICHTHINWEIS.de[1],
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Die Schwarzott Capital Partners AG und die Schwarzott Global LLC sind mit FIAON über unseren Gründer Justin Schwarzott verbunden. Ihr Vertragspartner ist in jedem Fall die FIAON LTD.",
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Gründung, Steuernummern und die Prüfung vor der Gründung: Global Struktur.", paket: "global_struktur" },
      { typ: "standorte", id: "standorte", h2: "Zürich, Miami, London", lead: "Partner in Zürich, Team in Miami, Vertragspartner in London." },
    ],
    fragen: [
      { f: "Kann ich als Schweizer Unternehmer eine US-LLC gründen?", a: "Ja, ohne Wohnsitz in den USA. Sie brauchen einen Reisepass, einen Adressnachweis und bei einer Firma als Gesellschafterin deren Handelsregisterauszug." },
      { f: "Ist meine US-Gesellschaft in der Schweiz steuerpflichtig?", a: "Wenn sie tatsächlich von der Schweiz aus verwaltet wird, in der Regel ja (Art. 50 DBG). Unser Partner-Steuerberater prüft Ihren Fall vor der Gründung." },
      { f: "Wer ist mein Vertragspartner?", a: "Die FIAON LTD in London. Die Schwarzott Capital Partners AG in Zürich und die Schwarzott Global LLC in Miami sind Partner von FIAON Global." },
    ],
    paket: "global_struktur",
    weiter: ["/business/partner", "/business/wissen/us-llc-steuern", "/business/aus-deutschland", "/business/us-firmengruendung"],
    quellen: [
      { titel: "Art. 50 DBG — Persönliche Zugehörigkeit", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" },
    ],
  },
];
