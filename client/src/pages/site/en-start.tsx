// ═══════════════════════════════════════════════════════════════════════════
// /en — the English start page (02.09.2026)
//
// Die deutsche Startseite ist eine 3D-Bühne mit vielen Szenen; ihre englische
// Schwester beginnt bewusst kompakt auf der dunklen Bühne: was FIAON ist, was
// es kostet, wie es abläuft, wo die Grenzen liegen — und die Wege zu den
// englischen Seiten, die es schon gibt. Wächst mit jeder übersetzten Seite.
// Britisches Englisch. Kopf und Korpus: shared/fiaon-seo-seiten.ts ("/" → en).
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Hero, Block, Licht, Knopf, Karten, Kennzahlen, Schritte, Fragen, Glas, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import "@/styles/seo-seiten.css";

const preis = (c: number) => "€" + (c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 });

export default function EnStart() {
  const privat = PAKETE.filter((p) => p.art === "privat" && p.abo);
  return (
    <Dunkel seite="startseite" titel="FIAON in English" beschreibung="Your credit file, explained and acted on.">
      <Hero pille="FIAON · English" titel={<>Your credit file, <span className="dk-verlauf">explained — and acted on.</span></>}
            lead="FIAON is for people in Germany, Austria and Switzerland whose credit file stands between them and a bank account, a card or a flat. We obtain the report, explain it in plain language, send the letters and prepare the account. The bank decides — we make sure your file is ready."
            knoepfe={<><Knopf href="/en/pricing">Pricing & plans</Knopf><Knopf href="/kontakt" still>Talk to us</Knopf></>}
            szene={<Szenenbild src="/kino/akten.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={[{ wert: "3", label: "countries: Germany, Austria, Switzerland" }, { wert: "24 h", label: "from receipt of your report to your explanation" }, { wert: "12", label: "monthly instalments, then you decide" }, { wert: "1", label: "named person who stays with you" }]} /></div>
      </section>

      <Block pille="Three layers" titel={<>Insight, action, <span className="dk-verlauf">access.</span></>} lead="Every FIAON plan follows the same three layers. Nothing is promised that a bank would have to decide.">
        <Karten items={[
          { tag: "1 · Insight", titel: "Your report, explained", text: "We obtain your credit report from SCHUFA (Germany's main credit bureau), KSV1870 (Austria) or CRIF and Intrum (Switzerland) with your authorisation and explain every entry: what it is, why it is there, when it will be deleted." },
          { tag: "2 · Action", titel: "Letters that are sent and followed up", text: "For entries that can be challenged there are reviewed letters: deletion requests under Art. 17 GDPR, objections, corrections, a request for your free data copy (Art. 15). You approve, FIAON sends, tracks the deadlines and assesses the replies." },
          { tag: "3 · Access", titel: "An account, then a card", text: "A current account for every customer, regardless of their file. A card once your file meets the partner's threshold. Card, account and limit are goals, never promises — the bank decides." },
        ]} />
      </Block>

      <Licht>
        <Block pille="How it works" titel={<>From application to <span className="dk-verlauf">first letter.</span></>} lead="The application takes about two minutes. It is currently in German; our team speaks English on the phone." mitte>
          <Schritte items={[
            { titel: "Choose a plan and apply", text: "E-mail, name, date of birth, phone, address. Accept the contract and you are in your customer area straight away." },
            { titel: "Pay the first instalment by bank transfer", text: "Payment details with a QR code in your area. Later instalments by SEPA direct debit — or by transfer, if you prefer." },
            { titel: "Onboarding call, 15 minutes", text: "A named person goes through your goal and your situation with you and activates your area fully." },
            { titel: "Report, analysis, letters", text: "We request your report with your authorisation. About 24 hours after it arrives you see every entry explained — and the letters that make sense, ready for your approval." },
          ]} />
        </Block>
      </Licht>

      <Block pille="What it costs" titel={<>Plans from {preis(privat[0].preisCents)} <span className="dk-verlauf">a month.</span></>} lead={`Twelve instalments, cancellable at any time to the end of the current month. Just the credit report on its own: ${"€" + SCHUFA_PREIS_EURO.toFixed(2)} one-off. No commission on limits, no fee per letter.`}>
        <div className="sx-vertiefen">
          {privat.map((p) => <a key={p.key} href={`/antrag?pack=${p.key}&src=en`}><b>{p.label.replace(" (Standard)", "")}</b><span>{preis(p.preisCents)} a month · twelve instalments</span></a>)}
        </div>
        <div className="dk-knoepfe" style={{ marginTop: 24 }}><Knopf href="/en/pricing">Compare every service</Knopf></div>
      </Block>

      <Licht>
        <Block schmal pille="Honest limits">
          <Glas tag="What FIAON does not do" titel="No advice, no guarantees, no decisions on your behalf">
            <p>FIAON does not give legal advice in individual cases and does not guarantee deletions. Entries that are correct, current and lawfully reported stay — what we can do is make sure that nothing incorrect, outdated or unlawfully reported remains. Whether you get a card, and with what limit, is decided by the bank alone.</p>
          </Glas>
        </Block>
        <Block schmal pille="Frequently asked questions">
          <Fragen items={[
            { f: "Is FIAON available in English?", a: "The website is being translated page by page; the application and the customer area are currently in German. Our team speaks English on the phone and by e-mail." },
            { f: "Which credit bureaus does FIAON work with?", a: "SCHUFA in Germany, KSV1870 and CRIF in Austria, CRIF and Intrum in Switzerland — always with your written authorisation." },
            { f: "Can I cancel?", a: "Yes, at any time to the end of the current month, informally. The plan runs for twelve instalments; after that we ask you whether you want to stay — no silent renewal." },
            { f: "How long does a settled debt stay on file?", a: "Under the credit bureaus' code of conduct, three years after settlement to the day; if you settle within 100 days of the entry and have no other entries, 18 months. FIAON tracks the exact date for every entry." },
          ]} />
        </Block>
      </Licht>

      <Abschluss titel={<>Your journey starts <span className="dk-verlauf">with an e-mail address.</span></>} text="Application in two minutes, report within 24 hours, a person who guides you through everything else." knoepfe={<><Knopf href="/antrag">Get started</Knopf><Knopf href="/en/pricing" still>Pricing & plans</Knopf></>} />
    </Dunkel>
  );
}
