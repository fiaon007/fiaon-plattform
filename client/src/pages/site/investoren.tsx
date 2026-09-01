// ═══════════════════════════════════════════════════════════════════════════
// /investoren — DIE INVESTOREN-BÜHNE (Neubau 01.09.2026, Justins Auftrag)
//
// „Cinematischer, dynamischer — einfach WOW. Beim Öffnen DEUTSCH oder
// ENGLISCH fragen, im perfekten Stil. Weg mit der Kreditkarte."
//
// Was diese Fassung anders macht:
//   · SPRACHTOR: Beim ersten Besuch ein Vollbild-Vorhang mit der Wahl
//     Deutsch/English (localStorage merkt sie; oben rechts jederzeit
//     umschaltbar). Die GESAMTE Seite ist zweisprachig — jede Zeile lebt
//     im Wörterbuch T unten, nichts ist halb übersetzt.
//   · KINO: Statt der Kreditkarten-3D-Szene ein eigenes Sternenfeld-Canvas —
//     ein Netz aus Menschen-Punkten, das sich langsam zu Verbindungen
//     verknüpft und um einen pulsierenden Kern kreist (die Idee der Seite:
//     aus 100 Millionen Unsichtbaren wird ein verbundenes System). Dazu
//     Zähler, die beim Hereinscrollen hochlaufen.
//   · KEINE Kreditkarte mehr: Schicht 3 spricht von Zugang (Konto,
//     Finanzierung über Partner) — keine Kartenzahl, kein Kartenversprechen.
//   · MEHR SUBSTANZ: Markt, Maschine (die KI-Agenten des Hauses), Warum
//     jetzt, Nordstern, Roadmap, Team, Datenraum — Zahlen weiterhin nur
//     dort, wo sie belegt sind; Finanzzahlen bleiben im Datenraum (NDA).
//
// prefers-reduced-motion: Sternenfeld steht, Zähler springen auf Endwert.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dunkel, Hero, Block, Karten, Schritte, Zeilen, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import ArasCore from "@/components/home3d/ArasCore";
import { Team } from "@/components/site/Team";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

type Sprache = "de" | "en";
const SPRACHE_SCHLUESSEL = "fiaon-investoren-sprache";

const euroDe = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";
const euroEn = (cents: number) => "€" + (cents / 100).toFixed(2);

// ── Das Sternenfeld — aus Punkten wird ein System ───────────────────────────
function Sternenfeld() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let breit = 0, hoch = 0, dpr = 1, raf = 0;
    const messen = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      breit = canvas.clientWidth; hoch = canvas.clientHeight;
      canvas.width = breit * dpr; canvas.height = hoch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    messen();
    window.addEventListener("resize", messen);
    const N = 150;
    const S = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00025, vy: (Math.random() - 0.5) * 0.00025,
      r: 0.6 + Math.random() * 1.6, hell: 0.3 + Math.random() * 0.7,
    }));
    let t = ruhig ? 40 : 0;
    const malen = () => {
      t += 0.008;
      ctx.clearRect(0, 0, breit, hoch);
      // Der Kern: ein ruhiger Puls rechts der Mitte.
      const kx = breit * 0.72, ky = hoch * 0.44;
      const puls = 1 + Math.sin(t * 1.4) * 0.12;
      const kern = ctx.createRadialGradient(kx, ky, 2, kx, ky, 130 * puls);
      kern.addColorStop(0, "rgba(126,180,255,0.55)");
      kern.addColorStop(0.35, "rgba(40,141,250,0.18)");
      kern.addColorStop(1, "rgba(40,141,250,0)");
      ctx.fillStyle = kern; ctx.fillRect(0, 0, breit, hoch);
      // Punkte bewegen, zum Kern hin leicht angezogen.
      for (const s of S) {
        if (!ruhig) {
          s.x += s.vx + (kx / breit - s.x) * 0.00012;
          s.y += s.vy + (ky / hoch - s.y) * 0.00012;
          if (s.x < 0 || s.x > 1) s.vx *= -1;
          if (s.y < 0 || s.y > 1) s.vy *= -1;
        }
      }
      // Verbindungen: nahe Punkte verknüpfen sich — das System entsteht.
      ctx.lineWidth = 0.6;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = (S[i].x - S[j].x) * breit, dy = (S[i].y - S[j].y) * hoch;
          const d2 = dx * dx + dy * dy;
          if (d2 < 110 * 110) {
            const a = (1 - Math.sqrt(d2) / 110) * 0.16;
            ctx.strokeStyle = `rgba(126,180,255,${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(S[i].x * breit, S[i].y * hoch);
            ctx.lineTo(S[j].x * breit, S[j].y * hoch);
            ctx.stroke();
          }
        }
      }
      for (const s of S) {
        const funkeln = 0.55 + Math.sin(t * 2 + s.x * 20) * 0.25;
        ctx.fillStyle = `rgba(214,227,248,${(s.hell * funkeln * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x * breit, s.y * hoch, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!ruhig) raf = requestAnimationFrame(malen);
    };
    malen();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", messen); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
}

// ── Zähler, die beim Hereinscrollen hochlaufen ──────────────────────────────
function ZahlHoch({ bis, einheit, dauerMs = 1600 }: { bis: number; einheit: string; dauerMs?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [wert, setWert] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setWert(bis); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (jetzt: number) => {
        const p = Math.min(1, (jetzt - start) / dauerMs);
        setWert(Math.round(bis * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [bis, dauerMs]);
  return <span ref={ref}>{wert}{einheit}</span>;
}

// ── Das Sprachtor — der erste Eindruck ──────────────────────────────────────
function Sprachtor({ waehlen }: { waehlen: (s: Sprache) => void }) {
  return (
    <div className="iv-tor" role="dialog" aria-label="Sprache wählen / Choose language">
      <div className="iv-tor-sterne" aria-hidden="true"><Sternenfeld /></div>
      <div className="iv-tor-innen">
        <span className="iv-tor-marke">FIAON</span>
        <p className="iv-tor-satz">Das Betriebssystem für Bonität · The operating system for creditworthiness</p>
        <div className="iv-tor-wahl">
          <button type="button" onClick={() => waehlen("de")}>
            <b>Deutsch</b>
            <span>Für Investoren — die ganze Geschichte auf Deutsch.</span>
          </button>
          <button type="button" onClick={() => waehlen("en")}>
            <b>English</b>
            <span>For investors — the full story in English.</span>
          </button>
        </div>
      </div>
      <style>{`
        .iv-tor { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center;
          background: radial-gradient(1100px 600px at 70% 30%, rgba(40,141,250,.14), transparent 60%), #05091a;
          animation: ivTorAuf .8s ease; }
        @keyframes ivTorAuf { from { opacity: 0 } to { opacity: 1 } }
        .iv-tor-sterne { position: absolute; inset: 0; opacity: .8; }
        .iv-tor-innen { position: relative; z-index: 2; text-align: center; padding: 32px; max-width: 720px; }
        .iv-tor-marke { font: 700 44px/1 'Inter', sans-serif; letter-spacing: .06em; color: #fff;
          text-shadow: 0 0 46px rgba(40,141,250,.6); }
        .iv-tor-satz { margin: 14px 0 34px; font: 400 14px/1.5 'Inter', sans-serif; color: rgba(195,214,240,.7); }
        .iv-tor-wahl { display: grid; gap: 14px; grid-template-columns: 1fr; }
        @media (min-width: 620px) { .iv-tor-wahl { grid-template-columns: 1fr 1fr; } }
        .iv-tor-wahl button { text-align: left; cursor: pointer; padding: 22px 24px; border-radius: 18px;
          background: linear-gradient(180deg, rgba(20,32,64,.75), rgba(10,18,40,.75));
          border: 1px solid rgba(126,180,255,.22); color: #e7edf7; backdrop-filter: blur(10px);
          transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
        .iv-tor-wahl button:hover { transform: translateY(-3px); border-color: rgba(126,180,255,.55);
          box-shadow: 0 18px 50px rgba(40,141,250,.25); }
        .iv-tor-wahl b { display: block; font: 600 22px/1.2 'Inter', sans-serif; margin-bottom: 6px; }
        .iv-tor-wahl span { font: 400 13px/1.5 'Inter', sans-serif; color: rgba(195,214,240,.65); }
        @media (prefers-reduced-motion: reduce) { .iv-tor, .iv-tor-wahl button { animation: none; transition: none; } }
      `}</style>
    </div>
  );
}

export default function Investoren() {
  const [sprache, setSprache] = useState<Sprache | null>(() => {
    try {
      const s = localStorage.getItem(SPRACHE_SCHLUESSEL);
      return s === "de" || s === "en" ? s : null;
    } catch { return "de"; }
  });
  const waehlen = (s: Sprache) => {
    try { localStorage.setItem(SPRACHE_SCHLUESSEL, s); } catch { /* egal */ }
    setSprache(s);
  };
  if (!sprache) return <Sprachtor waehlen={waehlen} />;

  const de = sprache === "de";
  const euro = de ? euroDe : euroEn;
  const privat = PAKETE.filter((p) => p.art === "privat" && p.abo);
  const business = PAKETE.filter((p) => p.art === "business");
  const V = ({ children }: { children: ReactNode }) => <span className="dk-verlauf">{children}</span>;

  return (
    <Dunkel seite="investoren"
      titel={de ? "Für Investoren" : "For Investors"}
      beschreibung={de
        ? "FIAON besetzt den Platz zwischen Auskunftei und Bank: Einsicht, Aktion, Zugang für 100 Millionen Menschen im DACH-Raum. Datenraum auf Anfrage."
        : "FIAON occupies the space between credit bureaus and banks: insight, action, access for 100 million people in the DACH region. Data room on request."}>

      {/* Sprachumschalter — dezent, immer erreichbar */}
      <button type="button" className="iv-sprache" onClick={() => waehlen(de ? "en" : "de")}
              title={de ? "Switch to English" : "Auf Deutsch wechseln"}>
        {de ? "EN" : "DE"}
      </button>
      <style>{`
        .iv-sprache { position: fixed; right: 18px; top: 84px; z-index: 60; cursor: pointer;
          font: 600 12px/1 'Inter', sans-serif; letter-spacing: .08em; color: #cfe1ff;
          padding: 9px 13px; border-radius: 999px; background: rgba(10,18,40,.7);
          border: 1px solid rgba(126,180,255,.3); backdrop-filter: blur(8px); }
        .iv-sprache:hover { border-color: rgba(126,180,255,.6); }
        .iv-zahlen { display: grid; gap: 14px; grid-template-columns: repeat(2, 1fr); margin-top: 8px; }
        @media (min-width: 900px) { .iv-zahlen { grid-template-columns: repeat(4, 1fr); } }
        .iv-zahl { padding: 22px 20px; border-radius: 18px; text-align: left;
          background: linear-gradient(180deg, rgba(20,32,64,.6), rgba(10,18,40,.6));
          border: 1px solid rgba(126,180,255,.14); }
        .iv-zahl b { display: block; font: 650 clamp(28px,3.4vw,40px)/1 'Inter', sans-serif; color: #fff;
          font-variant-numeric: tabular-nums; text-shadow: 0 0 26px rgba(40,141,250,.4); }
        .iv-zahl span { display: block; margin-top: 8px; font: 400 12.5px/1.5 'Inter', sans-serif; color: rgba(195,214,240,.7); }
      `}</style>

      <Hero
        bild="/kino/investoren.jpg"
        pille={de ? "Für Investoren" : "For Investors"}
        titel={de
          ? <>Der größte unbesetzte Platz im Finanzleben von <V>100 Millionen Menschen.</V></>
          : <>The largest unoccupied position in the financial lives of <V>100 million people.</V></>}
        lead={de
          ? "Score-Apps zeigen eine Zahl. Banken entscheiden. Dazwischen steht niemand. FIAON besetzt diesen Platz: Wir zeigen die Bonität, reparieren sie mit dem Kunden – und öffnen dann die Tür zurück ins Finanzsystem."
          : "Score apps show a number. Banks decide. Nobody stands in between. FIAON occupies that space: we make creditworthiness visible, repair it together with the customer — and then open the door back into the financial system."}
        knoepfe={<>
          <Knopf href="#anfrage">{de ? "Datenraum anfragen" : "Request data room"}</Knopf>
          <Knopf href="/demo/kundenbereich" still>{de ? "Produkt-Präsentation ansehen" : "Watch the product tour"}</Knopf>
        </>}
        szene={<Sternenfeld />}
      />

      <Block eng>
        <div className="iv-zahlen">
          <Auf><div className="iv-zahl"><b><ZahlHoch bis={100} einheit={de ? " Mio." : "M"} /></b><span>{de ? "Menschen in Deutschland, Österreich und der Schweiz mit einem Eintrag bei SCHUFA, KSV oder CRIF" : "people in Germany, Austria and Switzerland with an entry at SCHUFA, KSV or CRIF"}</span></div></Auf>
          <Auf verzoegerung={80}><div className="iv-zahl"><b><ZahlHoch bis={6} einheit={de ? " Mio." : "M"} /></b><span>{de ? "Personen allein in Deutschland gelten als überschuldet – fast jede Akte enthält angreifbare Einträge" : "people in Germany alone are considered over-indebted — almost every file contains contestable entries"}</span></div></Auf>
          <Auf verzoegerung={160}><div className="iv-zahl"><b><ZahlHoch bis={3} einheit="" /></b><span>{de ? "Auskunfteien, bei denen FIAON die Auskunft für den Kunden beschafft – mit Vollmacht, ohne Formular" : "credit bureaus FIAON queries on the customer's behalf — with power of attorney, no forms"}</span></div></Auf>
          <Auf verzoegerung={240}><div className="iv-zahl"><b><ZahlHoch bis={12} einheit="" /></b><span>{de ? "Monatsraten je Paket – nach der zwölften entscheidet der Kunde ausdrücklich, ob er bleibt" : "monthly instalments per package — after the twelfth, the customer explicitly decides whether to stay"}</span></div></Auf>
        </div>
      </Block>

      <Block pille={de ? "Das Problem" : "The problem"}
             titel={de ? <>Ein Markt, der nur <V>anzeigt.</V></> : <>A market that only <V>displays.</V></>}
             lead={de
               ? "Bonität entscheidet über Konto, Wohnung und Finanzierung. Trotzdem ist sie für die meisten Menschen unsichtbar – und für die, die sie sehen, unveränderbar."
               : "Creditworthiness decides over bank accounts, housing and financing. Yet for most people it is invisible — and for those who can see it, unchangeable."}>
        <Karten items={de ? [
          { tag: "Der Kunde", titel: "Sieht nichts.", text: "Die Auskunft liegt bei der Auskunftei, die Entscheidung bei der Bank. Der Mensch dazwischen erfährt nur das Ergebnis: abgelehnt." },
          { tag: "Die Apps", titel: "Zeigen, handeln nicht.", text: "Score-Apps liefern eine Zahl und einen Tipp. Den Löschantrag, den Widerspruch, die Ratenvereinbarung schreibt keine von ihnen." },
          { tag: "Die Banken", titel: "Verlieren gute Kunden.", text: "Ein erledigter, aber nicht gelöschter Eintrag kostet die Bank einen Kunden, der längst zahlungsfähig ist. Niemand räumt auf." },
        ] : [
          { tag: "The customer", titel: "Sees nothing.", text: "The report sits at the bureau, the decision sits at the bank. The person in between only learns the outcome: declined." },
          { tag: "The apps", titel: "Display, but never act.", text: "Score apps deliver a number and a tip. Not one of them writes the deletion request, the objection, the instalment agreement." },
          { tag: "The banks", titel: "Lose good customers.", text: "A settled but undeleted entry costs the bank a customer who has long been solvent again. Nobody cleans up." },
        ]} />
      </Block>

      <Block id="modell" pille={de ? "Die Lösung" : "The solution"}
             titel={de ? <>Drei Schichten. <V>Der Burggraben liegt in der Mitte.</V></> : <>Three layers. <V>The moat sits in the middle.</V></>}
             lead={de
               ? "Einsicht können viele. Zugang vermitteln viele. Die Aktion – anwaltlich geprüfte Schreiben, versendet und verfolgt – macht FIAON zum Betriebssystem statt zur App."
               : "Many can show insight. Many can broker access. The action layer — legally reviewed letters, sent and tracked — is what makes FIAON an operating system instead of an app."}>
        <div className="dk-zweispaltig" style={{ marginTop: 44 }}>
          <Auf><div className="dk-szene gross"><ArasCore className="absolute inset-0" /></div></Auf>
          <div style={{ display: "grid", gap: 16 }}>
            <Auf><Glas tag={de ? "Schicht 1 · Einsicht" : "Layer 1 · Insight"} titel={de ? "Zuerst Klarheit." : "Clarity first."}>{de
              ? "Auskunft aus SCHUFA, KSV oder CRIF, Kontoauszug-Analyse durch FIAON, jeder Eintrag erklärt. Ziel: erste Einsicht innerhalb von 24 Stunden."
              : "Reports from SCHUFA, KSV or CRIF, bank-statement analysis by FIAON, every entry explained in plain language. Target: first insight within 24 hours."}</Glas></Auf>
            <Auf verzoegerung={100}><Glas tag={de ? "Schicht 2 · Aktion — der Burggraben" : "Layer 2 · Action — the moat"} titel={de ? "Dann Bewegung." : "Then movement."}>{de
              ? "Löschanträge, Berichtigungen, Widersprüche, Ratenvereinbarungen: vorbereitet, anwaltlich geprüft, mit einem Klick versendet, Antwort verfolgt. Jede Antwort macht das System besser."
              : "Deletion requests, corrections, objections, instalment agreements: prepared, legally reviewed, sent with one click, every reply tracked. Each reply makes the system smarter."}</Glas></Auf>
            <Auf verzoegerung={200}><Glas tag={de ? "Schicht 3 · Zugang" : "Layer 3 · Access"} titel={de ? "Dann die Tür." : "Then the door."}>{de
              ? "Ein Girokonto für jeden Kunden, später Finanzierung über Partnerbanken – für Menschen, deren Bonität dokumentiert und repariert ist. Hier entstehen Partnererlöse."
              : "A current account for every customer, later financing through partner banks — for people whose creditworthiness is documented and repaired. This is where partner revenue is created."}</Glas></Auf>
          </div>
        </div>
      </Block>

      <Zwischenruf
        text={de
          ? "Sie möchten die Plattform sehen, bevor Sie Zahlen sehen? Der Kundenweg ist öffentlich – vom ersten Klick bis zum Bereich."
          : "Want to see the platform before you see numbers? The customer journey is public — from the first click to the customer area."}
        knopf={de ? "Startseite ansehen" : "View the homepage"} href="/"
        still={{ knopf: de ? "Produkt-Präsentation" : "Product tour", href: "/demo/kundenbereich" }} />

      <Block pille={de ? "Die Maschine" : "The machine"}
             titel={de ? <>Eine Plattform, die <V>selbst arbeitet.</V></> : <>A platform that <V>works on its own.</V></>}
             lead={de
               ? "FIAON ist kein Callcenter mit Software, sondern Software mit Menschen an den richtigen Stellen. Die Plattform bucht, mahnt, prüft und antwortet selbst – dokumentiert im Logbuch seit Tag eins."
               : "FIAON is not a call centre with software — it is software with people in exactly the right places. The platform books, reminds, verifies and replies on its own, documented in a logbook since day one."}>
        <Karten items={de ? [
          { tag: "Zahlungen", titel: "Bankeingang bucht sich selbst", text: "Die Plattform liest das Geschäftskonto automatisch, verbucht eindeutige Eingänge live – Freischaltung, Kundenmail und Provision inklusive. Unklares wartet auf einen Menschen." },
          { tag: "E-Mail", titel: "Ein Agent liest jede Akte", text: "Der hauseigene E-Mail-Agent kennt vor jeder Antwort die komplette Kundenakte und antwortet in Minuten – Kündigungen und Beschwerden gehen immer an Menschen." },
          { tag: "Dokumente", titel: "Uploads werden sofort geprüft", text: "Falsche oder unvollständige Unterlagen erkennt die Plattform in der Sekunde des Hochladens und sagt dem Kunden, was fehlt – bevor ein Mitarbeiter sie je gesehen hat." },
          { tag: "Vertrieb", titel: "Jeder Handgriff protokolliert", text: "Arbeitslisten, Termine, Startgespräche, Vergütung: ein System, ein Verlauf je Kunde. Entscheidungsregister und Logbuch entstehen im Betrieb, nicht für die Due Diligence." },
        ] : [
          { tag: "Payments", titel: "Bank receipts book themselves", text: "The platform reads the business account automatically and books unambiguous receipts live — activation, customer email and commission included. Anything unclear waits for a human." },
          { tag: "Email", titel: "An agent that reads every file", text: "The in-house email agent knows the complete customer file before every reply and answers within minutes — cancellations and complaints always go to humans." },
          { tag: "Documents", titel: "Uploads verified instantly", text: "Wrong or incomplete documents are detected the second they are uploaded, and the customer is told what is missing — before any employee has seen them." },
          { tag: "Sales", titel: "Every action on the record", text: "Work queues, appointments, onboarding calls, compensation: one system, one timeline per customer. The decision register and logbook are written in operation — not for due diligence." },
        ]} zwei />
      </Block>

      <Block pille={de ? "Geschäftsmodell" : "Business model"}
             titel={de ? <>Drei Erlösquellen. <V>Eine Beziehung.</V></> : <>Three revenue streams. <V>One relationship.</V></>}
             lead={de
               ? "Der Kunde zahlt für Einsicht und Aktion. Der Partner zahlt für Zugang. Beides hängt an derselben Akte – deshalb wächst der Wert eines Kunden mit jeder Etappe."
               : "The customer pays for insight and action. The partner pays for access. Both hang on the same file — which is why a customer's value grows with every stage."}>
        <Karten items={de ? [
          { tag: "Abo", titel: `${euro(privat[0].preisCents)} bis ${euro(privat[privat.length - 1].preisCents)} im Monat`, text: "Vier Privatpakete, vier Geschäftspakete. Zwölf Raten, monatlich kündbar, danach die ausdrückliche Frage, ob der Kunde bleibt. Jede Rate wird vom eigenen Team begleitet." },
          { tag: "Auskunft", titel: `${euro(SCHUFA_PREIS_EURO * 100)} einmalig`, text: "Die Bonitätsauskunft als Einstieg für Kunden, die zuerst nur wissen wollen, was über sie gespeichert ist. Der erste Schritt in die Akte." },
          { tag: "Partner", titel: "Provision je Abschluss", text: "Konto und Finanzierung über Partnerbanken. Der Partner bekommt einen Kunden mit dokumentierter, reparierter Bonität – und zahlt dafür." },
        ] : [
          { tag: "Subscription", titel: `${euro(privat[0].preisCents)} to ${euro(privat[privat.length - 1].preisCents)} per month`, text: "Four consumer packages, four business packages. Twelve instalments, cancellable monthly, followed by the explicit question whether the customer stays. Every instalment is accompanied by our own team." },
          { tag: "Report", titel: `${euro(SCHUFA_PREIS_EURO * 100)} one-off`, text: "The credit report as the entry point for customers who first simply want to know what is stored about them. The first step into the file." },
          { tag: "Partners", titel: "Commission per completion", text: "Accounts and financing through partner banks. The partner receives a customer with documented, repaired creditworthiness — and pays for exactly that." },
        ]} />
        <div className="dk-raster zwei" style={{ marginTop: 24 }}>
          <Auf><Glas ruhig tag={de ? "Privatkunden · monatlich" : "Consumers · monthly"}><Zeilen items={privat.map((p) => [p.label, euro(p.preisCents)] as [string, string])} /></Glas></Auf>
          <Auf verzoegerung={100}><Glas ruhig tag={de ? "Geschäftskunden · monatlich" : "Business · monthly"}><Zeilen items={business.map((p) => [p.label, euro(p.preisCents)] as [string, string])} /></Glas></Auf>
        </div>
        <p className="dk-leise" style={{ marginTop: 16 }}>{de
          ? "Preise aus dem Paketkatalog der Plattform – dieselbe Quelle wie Antrag, Rechnung und Akte."
          : "Prices come from the platform's package catalogue — the same source used by application, invoice and customer file."}</p>
      </Block>

      <Block pille={de ? "Burggraben" : "The moat"}
             titel={de ? <>Warum das schwer zu <V>kopieren</V> ist.</> : <>Why this is hard to <V>copy.</V></>}>
        <Karten items={de ? [
          { tag: "Recht", titel: "Geprüfte Schreiben, verfolgte Antworten", text: "Jede Vorlage ist anwaltlich geprüft. Jede Antwort einer Auskunftei oder eines Gläubigers wird erfasst. Daraus entsteht Wissen, das keine App hat: Was funktioniert, bei wem, wie schnell." },
          { tag: "Daten", titel: "Auskunft + Kontoauszug + Ergebnis", text: "FIAON sieht, was über den Kunden gespeichert ist, wie seine Finanzen wirklich aussehen und was sich ändern ließ. Drei Datenquellen in einer Akte – mit Einwilligung." },
          { tag: "Vertrieb", titel: "Kunden werden Mitarbeiter", text: "Wer FIAON selbst erlebt hat, verkauft es am besten. Kunden arbeiten von zuhause auf Provision – nach Pflicht-Academy. Der Vertrieb wächst mit der Kundenzahl, nicht mit dem Budget." },
          { tag: "Zugang", titel: "Partner bekommen dokumentierte Bonität", text: "Banken sehen keinen Antrag, sondern eine Akte: bereinigte Einträge, Spielraum, Zahlungshistorie der Raten. Das ist ein besserer Kunde – und ein Grund, exklusiv mit FIAON zu arbeiten." },
        ] : [
          { tag: "Legal", titel: "Reviewed letters, tracked replies", text: "Every template is legally reviewed. Every reply from a bureau or creditor is captured. This builds knowledge no app has: what works, with whom, and how fast." },
          { tag: "Data", titel: "Report + bank statement + outcome", text: "FIAON sees what is stored about the customer, what their finances actually look like, and what could be changed. Three data sources in one file — with consent." },
          { tag: "Sales", titel: "Customers become employees", text: "Those who experienced FIAON themselves sell it best. Customers work from home on commission — after a mandatory academy. Sales grows with the customer base, not with the budget." },
          { tag: "Access", titel: "Partners receive documented creditworthiness", text: "Banks do not see an application, they see a file: cleaned entries, financial headroom, instalment payment history. That is a better customer — and a reason to work with FIAON exclusively." },
        ]} zwei />
      </Block>

      <Block pille={de ? "Warum jetzt" : "Why now"}
             titel={de ? <>Drei Kräfte treffen sich <V>in diesem Moment.</V></> : <>Three forces are converging <V>right now.</V></>}>
        <Karten items={de ? [
          { tag: "Recht", titel: "Die DSGVO hat die Tür geöffnet", text: "Auskunfts-, Berichtigungs- und Löschrechte sind einklagbar; die EuGH-Urteile von 2023 haben die Spielregeln für Auskunfteien verschärft. Kaum jemand nutzt diese Rechte – weil niemand sie für den Einzelnen operationalisiert." },
          { tag: "Technik", titel: "KI macht Betreuung skalierbar", text: "Was früher hundert Sachbearbeiter brauchte, erledigen heute Agenten mit Aktenzugriff: Mails lesen, Dokumente prüfen, Zahlungen buchen. FIAON hat diese Maschine bereits im Betrieb – nicht im Pitchdeck." },
          { tag: "Markt", titel: "Die Zielgruppe wächst leider", text: "Steigende Lebenshaltungskosten treiben Menschen in Zahlungsrückstände – und damit in Einträge, die lange nach der Rückzahlung bleiben. Der Bedarf an Reparatur wächst mit jedem Quartal." },
        ] : [
          { tag: "Legal", titel: "GDPR opened the door", text: "Rights to access, correction and deletion are enforceable; the 2023 ECJ rulings tightened the rules for credit bureaus. Hardly anyone uses these rights — because nobody operationalises them for the individual." },
          { tag: "Technology", titel: "AI makes care scalable", text: "What once required a hundred case workers is now done by agents with file access: reading mail, verifying documents, booking payments. FIAON already runs this machine in production — not in a pitch deck." },
          { tag: "Market", titel: "The audience is, sadly, growing", text: "Rising living costs push people into arrears — and into entries that outlive the repayment by years. The need for repair grows every quarter." },
        ]} />
      </Block>

      <Block pille={de ? "Nordstern" : "North star"}
             titel={de ? <>Woran wir uns <V>messen.</V></> : <>What we measure <V>ourselves against.</V></>}
             lead={de
               ? "Vier Kennzahlen, die Kundennutzen und Unternehmenswert gleichzeitig abbilden. Die aktuellen Werte liegen im Datenraum und werden monatlich aktualisiert."
               : "Four metrics that capture customer value and enterprise value at the same time. Current values live in the data room and are updated monthly."}>
        <Karten items={de ? [
          { tag: "Einsicht", titel: "Zeit bis zur ersten Einsicht", text: "Von der Anmeldung bis zur gelesenen Auskunft im Bereich. Ziel: unter 24 Stunden." },
          { tag: "Aktion", titel: "Antwortquote auf Schreiben", text: "Anteil der versendeten Löschanträge, Widersprüche und Ratenvorschläge, die eine Antwort erhalten – und wie viele davon positiv." },
          { tag: "Zugang", titel: "Graduation-Rate", text: "Anteil der Kunden, die aus dem Programm in ein Konto oder eine Finanzierung übergehen. Die Zahl, die Partner interessiert." },
          { tag: "Ertrag", titel: "Raten-Einzugsquote", text: "Anteil der fälligen Raten, die beim ersten Versuch eingezogen werden – und nach Begleitung durch das eigene Team." },
        ] : [
          { tag: "Insight", titel: "Time to first insight", text: "From sign-up to the first report read inside the customer area. Target: under 24 hours." },
          { tag: "Action", titel: "Reply rate on letters", text: "Share of deletion requests, objections and instalment proposals that receive a reply — and how many of those are positive." },
          { tag: "Access", titel: "Graduation rate", text: "Share of customers who graduate from the programme into an account or financing. The number partners care about." },
          { tag: "Revenue", titel: "Instalment collection rate", text: "Share of due instalments collected on first attempt — and after accompaniment by our own team." },
        ]} zwei />
      </Block>

      <Block pille="Roadmap"
             titel={de ? <>Erst ein Land <V>perfekt.</V> Dann die Nachbarn.</> : <>First one country, <V>perfected.</V> Then its neighbours.</>}>
        <Schritte items={de ? [
          { titel: "Deutschland", text: "SCHUFA-Auskunft, Löschanträge, Ratenvereinbarungen, Konto. Der Kundenweg wird bis ins Detail gemessen und verbessert." },
          { titel: "Österreich und Schweiz", text: "KSV und CRIF als Auskunfteien, Länder-Erkennung im Antrag, lokale Partnerbanken. Die Plattform ist dafür bereits gebaut." },
          { titel: "Finanzierung", text: "Die dritte Tür: Ratenkredit und Umschuldung über Partner – für Kunden, deren Akte es trägt." },
          { titel: "Europa", text: "Dasselbe Betriebssystem, weitere Auskunfteien. Der Burggraben – geprüfte Schreiben und verfolgte Antworten – reist mit." },
        ] : [
          { titel: "Germany", text: "SCHUFA reports, deletion requests, instalment agreements, accounts. The customer journey is measured and improved in detail." },
          { titel: "Austria and Switzerland", text: "KSV and CRIF as bureaus, country detection in the application, local partner banks. The platform is already built for this." },
          { titel: "Financing", text: "The third door: instalment loans and debt restructuring through partners — for customers whose file supports it." },
          { titel: "Europe", text: "The same operating system, additional bureaus. The moat — reviewed letters and tracked replies — travels with it." },
        ]} />
      </Block>

      <Block id="demo" pille={de ? "Das Produkt, live" : "The product, live"}
             titel={de ? <>Sehen Sie das Konto, <V>wie es gemeint ist.</V></> : <>See the account <V>the way it is meant.</V></>}
             lead={de
               ? "Ein Demo-Konto mit Platzhalterdaten zeigt den Kundenbereich im besten Fall – und daneben die Sicht des Mitarbeiters, der den Kunden im Startgespräch durch die Plattform führt. Kein Login, keine echten Daten."
               : "A demo account with placeholder data shows the customer area at its best — alongside the employee's view guiding the customer through the onboarding call. No login, no real data."}>
        <div className="dk-raster zwei">
          <Auf><Glas tag={de ? "Kundensicht" : "Customer view"} titel={de ? "Der Kundenbereich, 1:1" : "The customer area, 1:1"}>{de
            ? "Dieselbe Oberfläche, die ein zahlender Kunde sieht: Fahrplan, Bonität, Finanzen, Schreiben, Abo – alles auf dem Stand eines Kunden nach vier Monaten. Nur die Daten sind erfunden."
            : "The exact interface a paying customer sees: roadmap, creditworthiness, finances, letters, subscription — at the state of a four-month customer. Only the data is fictional."}</Glas></Auf>
          <Auf verzoegerung={100}><Glas tag={de ? "Mitarbeitersicht" : "Employee view"} titel={de ? "Das Startgespräch, geführt" : "The onboarding call, guided"}>{de
            ? "Sechs Schritte, kuratierte Stichpunkte, Notizen während des Gesprächs und ein Knopf, der am Ende freischaltet. So wird aus einem Antrag ein betreuter Kunde."
            : "Six steps, curated talking points, notes during the call and one button that activates the account at the end. This is how an application becomes a cared-for customer."}</Glas></Auf>
        </div>
        <div className="dk-knoepfe" style={{ marginTop: 28 }}>
          <Knopf href="/demo">{de ? "Demo-Konto öffnen" : "Open the demo account"}</Knopf>
          <Knopf href="/demo/kundenbereich" still>{de ? "Die Präsentation des Kundenbereichs" : "The guided tour of the customer area"}</Knopf>
        </div>
      </Block>

      <Block pille="Team" titel={de ? <>Wer das <V>baut.</V></> : <>Who is <V>building</V> this.</>}
             lead={de
               ? "Drei Gesellschafter, die selbst im Betrieb stehen – und ein Investor, der das möglich gemacht hat."
               : "Three shareholders who work in the business themselves — and one investor who made it possible."}>
        <Team kompakt />
        <div className="dk-knoepfe"><Knopf href="/team" still>{de ? "Das Team kennenlernen" : "Meet the team"}</Knopf></div>
      </Block>

      <Block eng schmal>
        <Zitat wer={de ? "Justin Schwarzott, Gründer FIAON" : "Justin Schwarzott, founder of FIAON"}
               text={de
                 ? "Bonität ist kein Urteil. Sie ist ein Zustand – und Zustände kann man ändern. Wer das für 100 Millionen Menschen tut, baut kein Produkt, sondern eine Infrastruktur."
                 : "Creditworthiness is not a verdict. It is a state — and states can be changed. Doing that for 100 million people is not building a product. It is building infrastructure."} />
      </Block>

      <Block id="anfrage" pille={de ? "Datenraum" : "Data room"}
             titel={de ? <>Zahlen gibt es <V>unter NDA.</V></> : <>Numbers are shared <V>under NDA.</V></>}
             lead={de
               ? "Entscheidungsregister, Kennzahlen, Verträge, Technik-Dokumentation. Schreiben Sie uns, wer Sie sind und was Sie suchen – Sie erhalten innerhalb von zwei Werktagen eine Antwort von Justin Schwarzott persönlich."
               : "Decision register, metrics, contracts, technical documentation. Tell us who you are and what you are looking for — you will receive a personal reply from Justin Schwarzott within two working days."} schmal>
        <Anfrage art="investor"
                 knopf={de ? "Datenraum anfragen" : "Request data room"}
                 hinweis={de ? "Antwort innerhalb von zwei Werktagen. Kein Newsletter." : "Reply within two working days. No newsletter."}
                 felder={de ? [
                   { name: "name", label: "Ihr Name", pflicht: true },
                   { name: "firma", label: "Fonds / Unternehmen", pflicht: true },
                   { name: "email", label: "E-Mail", typ: "email", pflicht: true },
                   { name: "telefon", label: "Telefon", typ: "tel" },
                   { name: "ticket", label: "Typische Ticketgröße", optionen: ["bis 250.000 €", "250.000 – 1 Mio. €", "1 – 5 Mio. €", "über 5 Mio. €", "Strategischer Partner"] },
                   { name: "rolle", label: "Was suchen Sie?", optionen: ["Seed / Pre-Seed", "Series A", "Strategische Beteiligung", "Übernahme", "Erst einmal verstehen"] },
                   { name: "text", label: "Ihre Nachricht", typ: "textarea", breit: true },
                 ] : [
                   { name: "name", label: "Your name", pflicht: true },
                   { name: "firma", label: "Fund / company", pflicht: true },
                   { name: "email", label: "Email", typ: "email", pflicht: true },
                   { name: "telefon", label: "Phone", typ: "tel" },
                   { name: "ticket", label: "Typical ticket size", optionen: ["up to €250k", "€250k – €1M", "€1M – €5M", "above €5M", "Strategic partner"] },
                   { name: "rolle", label: "What are you looking for?", optionen: ["Seed / pre-seed", "Series A", "Strategic stake", "Acquisition", "Just understanding for now"] },
                   { name: "text", label: "Your message", typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille={de ? "Häufige Fragen" : "Frequently asked"}>
        <Fragen items={de ? [
          { f: "Wie verdient FIAON Geld?", a: "Mit dem Abo des Kunden (7,99 € bis 99,99 € im Monat, zwölf Raten), mit der einmaligen Bonitätsauskunft und mit Provisionen der Partnerbanken, wenn ein Kunde über FIAON ein Konto oder eine Finanzierung erhält." },
          { f: "Ist FIAON eine Bank?", a: "Nein. FIAON ist kein Kreditinstitut. Über Konto und Finanzierung entscheidet immer die jeweilige Partnerbank. FIAON bereitet den Kunden vor und dokumentiert seine Bonität." },
          { f: "Wo sitzt das Unternehmen?", a: "FIAON LTD, London (Companies House No. 17318250). Die Kunden sitzen in Deutschland, Österreich und der Schweiz; die Plattform läuft auf EU-Servern (Frankfurt), die Zahlungen laufen per SEPA über einen verifizierten Kreditor." },
          { f: "Was bekomme ich im Datenraum?", a: "Sechs Kapitel: Unternehmen, Finanzen, Produkt und Technik, Recht und Datenschutz, Team und Verträge, Markt. Dazu das Entscheidungsregister und das Logbuch – beides wird seit dem ersten Tag geführt." },
        ] : [
          { f: "How does FIAON make money?", a: "Through the customer subscription (€7.99 to €99.99 per month, twelve instalments), the one-off credit report, and partner-bank commissions when a customer obtains an account or financing through FIAON." },
          { f: "Is FIAON a bank?", a: "No. FIAON is not a credit institution. Accounts and financing are always decided by the respective partner bank. FIAON prepares the customer and documents their creditworthiness." },
          { f: "Where is the company based?", a: "FIAON LTD, London (Companies House No. 17318250). Customers are in Germany, Austria and Switzerland; the platform runs on EU servers (Frankfurt) and payments run via SEPA through a verified creditor." },
          { f: "What is inside the data room?", a: "Six chapters: company, financials, product and technology, legal and privacy, team and contracts, market. Plus the decision register and the logbook — both kept since day one." },
        ]} />
      </Block>

      <Abschluss
        titel={de
          ? <>Jede Zahl beginnt mit einem Menschen, der seine Auskunft <V>zum ersten Mal sieht.</V></>
          : <>Every number starts with a person seeing their credit report <V>for the very first time.</V></>}
        text={de
          ? "Das ist der Zusammenhang: Einsicht wird Aktion, Aktion wird Zugang – und Zugang wird Umsatz. Für den Kunden zuerst. Dann für FIAON. Dann für Sie."
          : "That is the chain: insight becomes action, action becomes access — and access becomes revenue. For the customer first. Then for FIAON. Then for you."}
        knoepfe={<>
          <Knopf href="#anfrage">{de ? "Datenraum anfragen" : "Request data room"}</Knopf>
          <Knopf href="/datenraum" still>{de ? "Wie der Datenraum geführt wird" : "How the data room is maintained"}</Knopf>
        </>}
      />
    </Dunkel>
  );
}
