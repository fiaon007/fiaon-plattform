// ═══════════════════════════════════════════════════════════════════════════
// FIAON Startseite v4 — „Kino" (22.08.2026)
//
// Justin: „Die gesamte Startseite bleibt von der Länge und den Inhalten in den
// Sektionen, aber das Design darf sich verändern — cinematisch, ein Erlebnis,
// dunkle Töne, gute Animationen, die 3D-Elemente der fünf Seiten, Gänsehaut."
//
// Dieselben zwölf Abschnitte wie v3 (Hero · Zahlen · Problem · So funktioniert
// es · Vertrauen · Plattform · Für wen · Pakete · Ablauf · Kundenstimmen · FAQ ·
// Abschluss) — jetzt auf der dunklen Bühne (DunkleBuehne), mit Video-Hero,
// echter 3D-Karte, Gyroskop-Kern, Glasplatten und ruhiger Schlusskugel.
// Preise kommen aus dem Paketkatalog. Marke: FIAON — sonst nichts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from "react";
import { Dunkel, Block, Karten, Kennzahlen, Schritte, Glas, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Licht } from "@/components/site/DunkleBuehne";
import { FlugHero } from "@/components/site/FlugHero";
import ArasCore from "@/components/home3d/ArasCore";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";
import { paket as paketVon, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

const preisText = (key: string) => ((paketVon(key)?.preisCents ?? 0) / 100).toFixed(2).replace(".", ",");

/* ── Kundenart-Modal (Privat / Geschäft) — hell, es liegt über der Bühne ── */
function CustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center" style={{ animation: "modalFadeIn .2s ease" }}>
      <div className="absolute inset-0" style={{ background: "rgba(15,23,42,.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} onClick={onClose} />
      <div className="relative w-full sm:max-w-[440px] bg-white rounded-t-[28px] sm:rounded-[28px] px-6 pt-5 pb-7 sm:p-8 sm:mx-4 overflow-hidden text-gray-900" style={{ boxShadow: "0 30px 80px rgba(15,23,42,.4)", animation: "sheetUp .38s cubic-bezier(.22,1,.36,1)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors" aria-label="Schließen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div className="relative z-10">
          <div className="sm:hidden w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#2563eb] text-[11px] font-medium uppercase tracking-[.16em] mb-4">Konto er&ouml;ffnen</div>
            <h3 className="text-[24px] font-semibold tracking-tight leading-snug">F&uuml;r wen m&ouml;chten Sie <span className="fiaon-gradient-text-animated">starten</span>?</h3>
          </div>
          <div className="space-y-3">
            {[
              { href: "/antrag", titel: "Privatkunde", text: "Bonität einsehen, reparieren, Zugang erhalten", von: "#2563eb", bis: "#60a5fa" },
              { href: "/business-antrag", titel: "Geschäftskunde", text: "Firmenbonität und Geschäftskonto", von: "#1e40af", bis: "#2563eb" },
            ].map((w) => (
              <a key={w.href} href={w.href} className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: `linear-gradient(135deg,${w.von},${w.bis})`, boxShadow: "0 8px 20px rgba(37,99,235,.28)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{w.href === "/antrag" ? <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></> : <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>}</svg>
                </div>
                <div className="flex-1 min-w-0 text-left"><p className="text-[15.5px] font-semibold">{w.titel}</p><p className="text-[13px] text-gray-500">{w.text}</p></div>
                <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#2563eb] flex items-center justify-center text-gray-400 group-hover:text-white transition-all duration-300 shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg></span>
              </a>
            ))}
          </div>
          <p className="mt-6 text-center text-[11.5px] text-gray-400">Kostenlos &amp; unverbindlich · SSL-verschl&uuml;sselt</p>
        </div>
      </div>
    </div>
  );
}

const PRIVATE_PACKS = [
  { key: "start", name: "FIAON Start", sub: "Der Einstieg", scenario: "Einsicht in Ihre Bonität", feats: ["Bonitätsauskunft einsehen und verstehen", "Kontoauszug-Analyse mit Spielraum", "Ihr Bereich mit Fahrplan", "Unterstützung per E-Mail"] },
  { key: "pro", name: "FIAON Pro", sub: "Standard", scenario: "Einträge bereinigen, Konto eröffnen", rec: true, feats: ["Alles aus Start", "Löschanträge und Widersprüche – vorbereitet und versendet", "Ratenvereinbarungen mit Antwort-Verfolgung", "Startgespräch und fester Ansprechpartner"] },
  { key: "ultra", name: "FIAON Ultra", sub: "Mit Karte", scenario: "Kreditkarte bis 25.000 € bei guter Bonität", feats: ["Alles aus Pro", "Begleitung bis zur Kreditkarte", "Bevorzugte Bearbeitung Ihrer Schreiben", "Telefonische Betreuung"] },
  { key: "highend", name: "FIAON High End", sub: "Das Maximum", scenario: "Finanzierung und persönliche Betreuung", feats: ["Alles aus Ultra", "Persönlicher Betreuer für Ihre Akte", "Vorbereitung auf Finanzierungen", "Erreichbar auch außerhalb der Bürozeiten"] },
];
const BUSINESS_PACKS = [
  { key: "business_starter", name: "FIAON Business Starter", sub: "Der Einstieg", scenario: "Firmenrahmen bis 5.000 €", feats: ["Firmeneintrag prüfen und verstehen", "Geschäftskonto-Zugang", "Unterstützung für Ihr Unternehmen", "Monatliche Übersicht"] },
  { key: "business_pro", name: "FIAON Business Pro", sub: "Standard", scenario: "Firmenrahmen bis 25.000 €", rec: true, feats: ["Alles aus Starter", "Löschanträge und Widersprüche für das Unternehmen", "Firmenkarte mit Rahmen", "Bevorzugte Bearbeitung"] },
  { key: "business_ultra", name: "FIAON Business Ultra", sub: "Mit Betreuung", scenario: "Firmenrahmen bis 75.000 €", feats: ["Alles aus Pro", "Fester Ansprechpartner", "Mehrere Nutzer im Bereich", "Vorbereitung auf Finanzierungen"] },
  { key: "business_enterprise", name: "FIAON Business Enterprise", sub: "Das Maximum", scenario: "Firmenrahmen bis 250.000 €", feats: ["Alles aus Ultra", "Betreuung auch außerhalb der Bürozeiten", "Schnittstelle zu Ihrer Buchhaltung", "Unbegrenzte Nutzer"] },
];

function Pakete({ tab, setTab }: { tab: "privat" | "business"; setTab: (t: "privat" | "business") => void }) {
  const packs = tab === "privat" ? PRIVATE_PACKS : BUSINESS_PACKS;
  const antragHref = tab === "privat" ? "/antrag" : "/business-antrag";
  return (
    <Block id="setups" pille="Ihr Paket" titel={<>W&auml;hlen Sie, wie weit Sie gehen. <span className="dk-verlauf">Nicht, ob.</span></>}
           lead="Jedes Paket beginnt mit Ihrer Auskunft. Je weiter Sie gehen, desto mehr nimmt FIAON Ihnen ab – bis zu Konto, Karte und Finanzierung. Über die Vergabe entscheidet immer die Bank; FIAON bereitet Sie darauf vor." mitte>
      <Auf>
        <div className="dk-tabs" role="tablist">
          {(["privat", "business"] as const).map((t) => <button key={t} type="button" role="tab" data-an={tab === t ? "1" : undefined} onClick={() => setTab(t)}>{t === "privat" ? "Privatkunde" : "Geschäftskunde"}</button>)}
        </div>
      </Auf>
      <div className="dk-preise" style={{ textAlign: "left" }}>
        {packs.map((p, i) => (
          <Auf key={`${tab}-${p.key}`} verzoegerung={i * 90}>
            <div className="dk-preis" data-top={p.rec ? "1" : undefined} style={{ height: "100%" }}>
              {p.rec && <span className="band">Beliebt</span>}
              <p className="name">{p.name}</p>
              <p className="sub">{p.sub}</p>
              <p className="betrag dk-verlauf zahl">{preisText(p.key)} &euro;<small>/ Monat</small></p>
              <p className="ziel">Ziel: {p.scenario}</p>
              <ul className="dk-liste">{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
              <a href={antragHref} className={`dk-knopf${p.rec ? "" : " still"}`}>Konto er&ouml;ffnen</a>
            </div>
          </Auf>
        ))}
      </div>
      <p className="dk-leise" style={{ marginTop: 28, maxWidth: "72ch", marginLeft: "auto", marginRight: "auto" }}>
        {tab === "privat"
          ? `Alle Pakete: monatlich per SEPA-Lastschrift · zwölf Raten, danach entscheiden Sie, ob Sie bleiben · Nur die Auskunft? Bonitätsauskunft ${SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} € einmalig. Über Konto, Karte und Rahmen entscheidet die jeweilige Bank.`
          : "Alle Pakete: monatlich per SEPA-Lastschrift · zwölf Raten, danach entscheiden Sie, ob Sie bleiben. Über Konto, Karte und Rahmen entscheidet die jeweilige Bank."}
      </p>
    </Block>
  );
}

export default function FiaonHome() {
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<"privat" | "business">("privat");
  const openModal = useCallback(() => setShowModal(true), []);
  const chooseSetup = useCallback((t: "privat" | "business") => { setTab(t); document.getElementById("setups")?.scrollIntoView({ behavior: "smooth" }); }, []);

  return (
    <Dunkel seite="startseite" titel="Das Betriebssystem für Bonität" beschreibung="FIAON zeigt Ihnen, was SCHUFA, KSV und CRIF über Sie wissen, repariert es mit Ihnen – und öffnet die Tür zu Konto, Karte und Finanzierung. Für Deutschland, Österreich und die Schweiz.">
      <FlugHero knoepfe={<><Knopf onClick={openModal}>Jetzt starten</Knopf><Knopf href="#aras" still>So funktioniert es</Knopf></>} />

      <Block eng>
        <Kennzahlen items={[
          { wert: "3", label: "Auskunfteien: SCHUFA, KSV und CRIF – beantragt durch FIAON" },
          { wert: "< 24 h", label: "Von der Anmeldung bis zur ersten Einsicht" },
          { wert: "25.000 €", label: "Kreditkartenrahmen bei guter Bonität" },
          { wert: "100 Mio.", label: "Menschen im DACH-Raum, für die FIAON gebaut ist" },
        ]} />
      </Block>

      <Block pille="Das Problem" titel={<>Ihre Bonit&auml;t entscheidet &uuml;ber Konto, Karte und Kredit. <span className="dk-verlauf">Nur Sie selbst sehen sie nie.</span></>}
             lead="100 Millionen Menschen in Deutschland, Österreich und der Schweiz haben einen Eintrag bei SCHUFA, KSV oder CRIF. Allein in Deutschland gelten sechs Millionen als überschuldet. Die meisten wissen nicht, was dort steht – und niemand hilft ihnen, es zu ändern.">
        <Karten items={[
          { tag: "Die Bank", titel: "„Abgelehnt. Ohne Erklärung.“", text: "Banken entscheiden nach einer Auskunft, die Sie nie gesehen haben. Wer seinen eigenen Eintrag nicht kennt, kann ihn auch nicht ändern." },
          { tag: "Der Eintrag", titel: "„Längst erledigt – steht aber noch.“", text: "Bezahlte Forderungen, veraltete Daten, falsche Zuordnungen: Millionen Einträge im DACH-Raum sind löschbar – wenn jemand den Antrag stellt." },
          { tag: "Die Apps", titel: "„Zeigen an. Und tun nichts.“", text: "Score-Apps zeigen eine Zahl. Dann lassen sie Sie allein. Der schwere Teil – Widerspruch, Berichtigung, Ratenvereinbarung – bleibt an Ihnen hängen." },
        ]} />
        <Auf><p className="dk-lead" style={{ marginTop: 40, color: "#e5e7eb" }}>Genau hier setzt FIAON an: <span className="dk-verlauf">Einsicht. Aktion. Zugang.</span></p></Auf>
      </Block>

      <Block id="aras" pille="So funktioniert es" titel={<>Drei Schichten. <span className="dk-verlauf">Ein Weg.</span></>}
             lead="Score-Apps zeigen Ihnen eine Zahl. FIAON geht drei Schritte weiter: Wir zeigen, was dahintersteht, wir ändern es mit Ihnen – und wir öffnen danach die Tür. Im Kern arbeitet die FIAON-Analyse, gebaut für Bonität im DACH-Raum.">
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <Auf><div className="dk-szene gross"><ArasCore className="absolute inset-0" /></div></Auf>
          <div style={{ display: "grid", gap: 18 }}>
            <Auf><Glas tag="Schicht 1" titel="Einsicht – zuerst Klarheit.">FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF und liest Ihren Kontoauszug. Sie sehen Ihren Wert als Bogen, jeden Eintrag erklärt, Ihre Einnahmen, Fixkosten und Ihren monatlichen Spielraum.</Glas></Auf>
            <Auf verzoegerung={100}><Glas tag="Schicht 2" titel="Aktion – dann Bewegung.">Löschanträge, Berichtigungen, Widersprüche, Ratenvereinbarungen: vorbereitet, anwaltlich geprüft, mit einem Klick versendet. FIAON erinnert Sie an jede Frist und verfolgt jede Antwort.</Glas></Auf>
            <Auf verzoegerung={200}><Glas tag="Schicht 3" titel="Zugang – dann die Tür.">Girokonto für jeden Kunden, Kreditkarte bis 25.000 € bei guter Bonität, Finanzierung später. Niemand geht leer aus. Jeder hat ein nächstes Ziel.</Glas></Auf>
            <Auf verzoegerung={300}><p className="dk-leise" style={{ borderLeft: "2px solid rgba(96,165,250,.4)", paddingLeft: 14 }}>FIAON liefert Analysen und vorbereitete Schreiben, keine Rechts- oder Steuerberatung. Jedes Schreiben geht erst hinaus, wenn Sie es freigeben.</p></Auf>
          </div>
        </div>
      </Block>

      <Zwischenruf text="Ihr Konto ist in zwei Minuten angelegt – Ihre Auskunft liegt innerhalb von 24 Stunden in Ihrem Bereich." knopf="Jetzt starten" href="/antrag" still={{ knopf: "Pakete ansehen", href: "#setups" }} />

      <Licht>
      <Block pille="Ihr Vertrauen" titel={<>Gef&uuml;hrt wie ein Finanzinstitut. <span className="dk-verlauf">Gebaut wie eine App.</span></>}
             lead="FIAON LTD mit Sitz in London, Kunden in Deutschland, Österreich und der Schweiz. Jedes Schreiben, das Sie über FIAON versenden, ist anwaltlich geprüft. Jede Zahlung läuft per SEPA-Lastschrift über einen verifizierten Kreditor.">
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <div className="dk-raster zwei" style={{ marginTop: 0 }}>
            {[
              { tag: "01", titel: "Anwaltlich geprüft", text: "Löschanträge, Widersprüche und Ratenvereinbarungen entstehen aus Vorlagen, die unser Anwaltsteam geprüft hat – und gehen erst hinaus, wenn Sie sie freigeben." },
              { tag: "02", titel: "SEPA-Lastschrift", text: "Monatliche Raten per SEPA über einen verifizierten Kreditor. Keine Kreditkarte nötig, keine Vorkasse, jede Abbuchung angekündigt." },
              { tag: "03", titel: "Verschlüsselt und DSGVO-konform", text: "Ihre Auskunft und Ihr Kontoauszug liegen verschlüsselt auf Servern in der EU. Sie entscheiden, was Sie hochladen – und können es jederzeit löschen lassen." },
              { tag: "04", titel: "Ein Mensch am Telefon", text: "Jeder Kunde beginnt mit einem Startgespräch. Danach kennen Sie Ihren Ansprechpartner mit Namen – und er kennt Ihre Akte." },
            ].map((k, i) => <Auf key={k.tag} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
          </div>
          <Auf verzoegerung={150}><div className="dk-szene gross"><SchichtenSzene namen={["Anwaltlich geprüft", "SEPA-Lastschrift", "EU-Server"]} className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Block pille="Die Plattform" titel={<>Einsicht. Aktion. Zugang. <span className="dk-verlauf">Alles in Ihrem Bereich.</span></>} mitte>
        <div style={{ textAlign: "left" }}>
          <Karten items={[
            { tag: "Die Auskunft", titel: "Bonitätsauskunft", text: "FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF – Sie füllen kein Formular aus. Innerhalb von 24 Stunden wissen Sie, was dort steht." },
            { tag: "Die Analyse", titel: "Kontoauszug-Analyse", text: "Laden Sie Ihren Kontoauszug hoch. FIAON erkennt Einnahmen, Fixkosten, Abos und Risiken – und zeigt Ihren monatlichen Spielraum." },
            { tag: "Die Aktion", titel: "Löschanträge und Widersprüche", text: "Jeder Eintrag bekommt eine Einschätzung: erledigt, löschbar, berichtigbar, angreifbar. Das Schreiben ist vorbereitet – Sie geben frei, FIAON versendet." },
            { tag: "Die Einigung", titel: "Ratenvereinbarungen", text: "Offene Forderungen werden zu Plänen: FIAON schlägt Raten vor, die zu Ihrem Spielraum passen, und verfolgt die Antwort des Gläubigers." },
            { tag: "Der Zugang", titel: "Konto und Karte", text: "Girokonto für jeden Kunden, Kreditkarte bis 25.000 € bei guter Bonität. Ihr Fahrplan zeigt, wie weit Sie noch davon entfernt sind." },
            { tag: "Der Mensch", titel: "Startgespräch und Betreuung", text: "Ein Startgespräch zu Beginn, ein fester Ansprechpartner danach. Fragen beantwortet ein Mensch – am Telefon oder in Ihrem Bereich." },
          ]} />
        </div>
      </Block>

      <Block pille="Für wen" titel={<>Eine Plattform. <span className="dk-verlauf">Zwei Welten.</span></>} mitte>
        <div className="dk-raster zwei" style={{ textAlign: "left" }}>
          {[
            { key: "privat" as const, titel: "Für Privatkunden", text: "Vom ersten Eintrag bis zur Kreditkarte: Sie sehen Ihre Auskunft, räumen auf, was nicht hineingehört, und arbeiten Etappe für Etappe auf Konto und Karte zu – mit einem Ansprechpartner, der Ihre Akte kennt.", ziele: "Typische Ziele: Eintrag löschen lassen · Ratenvereinbarung treffen · Girokonto eröffnen · Kreditkarte bis 25.000 €" },
            { key: "business" as const, titel: "Für Geschäftskunden", text: "Firmenbonität entscheidet über Lieferantenkredit, Leasing und Geschäftskonto. FIAON Business zeigt Selbstständigen und Unternehmen, was Auskunfteien über sie führen – und hilft, es in Ordnung zu bringen.", ziele: "Typische Ziele: Firmeneintrag prüfen · Geschäftskonto eröffnen · Firmenkarte mit Rahmen · Privat und Geschäft trennen" },
          ].map((w, i) => (
            <Auf key={w.key} verzoegerung={i * 120}>
              <Glas titel={w.titel} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <p className="dk-text">{w.text}</p>
                <p className="dk-leise" style={{ marginTop: 14, fontStyle: "italic" }}>{w.ziele}</p>
                <div style={{ marginTop: "auto", paddingTop: 24 }}><Knopf onClick={() => chooseSetup(w.key)} still>Paket wählen</Knopf></div>
              </Glas>
            </Auf>
          ))}
        </div>
      </Block>

      <Pakete tab={tab} setTab={setTab} />

      <Block id="ablauf" pille="Ablauf" titel={<>In drei Schritten zu <span className="dk-verlauf">Ihrer Bonit&auml;t.</span></>} mitte>
        <div style={{ textAlign: "left" }}>
          <Schritte items={[
            { titel: "Konto anlegen", text: "E-Mail-Adresse, wenige Angaben, zwei Minuten. Ihr Bereich ist sofort aktiv – am Handy wie am Rechner." },
            { titel: "Auskunft erhalten", text: "FIAON beantragt Ihre Auskunft. Innerhalb von 24 Stunden sehen Sie, was SCHUFA, KSV oder CRIF über Sie führen – und was sich ändern lässt." },
            { titel: "Handeln und Zugang erhalten", text: "Schreiben freigeben, Raten vereinbaren, Etappen abschließen. Am Ende stehen Konto, Karte und – wenn Sie möchten – die Finanzierung." },
          ]} />
        </div>
        <Auf><p className="dk-leise" style={{ marginTop: 36 }}>Kein Papierkram. Keine Filiale. Ein Ansprechpartner, der Ihre Akte kennt.</p></Auf>
      </Block>

      </Licht>

      <Block pille="Kundenstimmen" titel={<>Klarheit, <span className="dk-verlauf">die bleibt.</span></>} mitte>
        <div style={{ textAlign: "left" }}>
          <Karten items={[
            { tag: "Sara W. · Angestellte", titel: "„Zwei Einträge waren längst erledigt.“", text: "Zum ersten Mal habe ich gesehen, was die SCHUFA über mich gespeichert hat – und zwei Einträge waren längst erledigt. Der Löschantrag war in einer Minute unterwegs." },
            { tag: "Markus R. · Selbstständiger", titel: "„Die Forderung ist vom Tisch.“", text: "Als Selbstständiger bin ich überall durchgefallen. Mit der Ratenvereinbarung über FIAON ist die Forderung vom Tisch, und das Geschäftskonto steht." },
            { tag: "Julia B. · Studentin", titel: "„Bonität ist ein Zustand, kein Urteil.“", text: "Ich dachte, meine Bonität sei ein Urteil. Sie ist ein Zustand. Den kann man ändern – das hat mir vorher niemand gesagt." },
          ]} />
        </div>
      </Block>

      <Block id="faq" schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Beantragt FIAON die Auskunft für mich?", a: "Ja. Sie geben uns einmal Ihre Daten, FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF. Sie müssen kein Formular ausfüllen und nichts hochladen. Innerhalb von 24 Stunden sehen Sie in Ihrem Bereich, was dort steht." },
          { f: "Was passiert mit meinen Einträgen?", a: "Jeder Eintrag bekommt eine Einschätzung: erledigt, löschbar, berichtigbar oder angreifbar. Für alles, was sich ändern lässt, bereitet FIAON das Schreiben vor. Sie geben es frei – FIAON versendet es und verfolgt die Antwort." },
          { f: "Bekomme ich eine Kreditkarte?", a: "Über die Vergabe entscheidet immer die Bank. FIAON bringt Ihre Bonität in Ordnung und bereitet Sie vor: Ein Girokonto ist für jeden Kunden erreichbar, eine Kreditkarte mit Rahmen bis 25.000 € bei guter Bonität. Ihr Fahrplan zeigt, wie weit Sie noch entfernt sind." },
          { f: "Wie arbeitet die FIAON-Analyse?", a: "Sie liest Auskünfte und Kontoauszüge, erklärt Einträge in Klartext und bereitet Schreiben vor. Sie ersetzt keine Rechts- oder Steuerberatung – jedes Schreiben ist anwaltlich geprüft und geht erst hinaus, wenn Sie es freigeben." },
          { f: "Wie lange läuft ein Paket?", a: "Zwölf monatliche Raten per SEPA-Lastschrift. Nach der zwölften Rate fragen wir Sie, ob Sie bleiben möchten – keine stille Verlängerung." },
          { f: "Wo liegen meine Daten?", a: "Verschlüsselt auf Servern in der EU, DSGVO-konform. Sie entscheiden, was Sie hochladen, und können es jederzeit löschen lassen." },
        ]} />
      </Block>

      <Block pille="Werkzeuge" titel={<>Kostenlos, sofort, <span className="dk-verlauf">ohne Anmeldung.</span></>} lead="Zwei Rechner, die Ihnen heute schon etwas bringen – keine Anfrage bei einer Auskunftei, keine Spur im Score, nichts wird gespeichert." mitte>
        <div className="hw-raster">
          <Auf><a href="/werkzeuge/karten-check" className="hw-karte"><span className="hw-tag">Karten-Check</span><h3>Welche Kreditkarte ist für mich realistisch?</h3><p>Fünf Angaben – eine ehrliche Einordnung: Debit, Prepaid oder Rahmen. Und der Schritt, der die nächste Tür öffnet.</p><span className="hw-mehr">Jetzt prüfen</span></a></Auf>
          <Auf verzoegerung={90}><a href="/werkzeuge/spielraum" className="hw-karte"><span className="hw-tag">Spielraum-Rechner</span><h3>Was bleibt im Monat – und was liest eine Bank daraus?</h3><p>Einnahmen und Fixkosten eingeben: Spielraum, Fixkostenquote und der Richtwert für einen Kartenrahmen.</p><span className="hw-mehr">Jetzt rechnen</span></a></Auf>
        </div>
        <p className="dk-leise" style={{ marginTop: 22 }}><a href="/ratgeber#werkzeuge" style={{ color: "#93c5fd" }}>Alle sieben Werkzeuge im Ratgeber →</a></p>
      </Block>

      <Abschluss
        titel={<>Ihr Weg beginnt <span className="dk-verlauf">mit einer E-Mail-Adresse.</span></>}
        text="Konto in zwei Minuten. Ihre Auskunft innerhalb von 24 Stunden. Ein Mensch, der Sie durch alles Weitere begleitet. SEPA-Lastschrift · EU-Hosting · DSGVO-konform · Anwaltlich geprüft."
        knoepfe={<><Knopf onClick={openModal}>Jetzt starten</Knopf><Knopf href="/was-ist-fiaon" still>Die Plattform kennenlernen</Knopf></>}
      />

      <CustomerModal open={showModal} onClose={() => setShowModal(false)} />
    </Dunkel>
  );
}
