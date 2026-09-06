// /app — Heute (Bauvorlage 3.2): Gruß, Ruhe-Zeile, Band, Rahmen-Karte (das eine
// Navy-Glas), Jetzt-Karte, In Arbeit bei FIAON, Brief-Karte, Ansprechperson.
// Der Primärknopf sitzt NICHT hier, sondern in der Aktionsleiste (Bereich.tsx).
import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { Rahmenweg } from "@shared/fiaon-rahmenweg";
import type { Bereich, Vorgang } from "./typen";
import { Zielkarte } from "./Weg";
import { api, eur, zeit } from "./Bausteine";

interface BerichtKurz { monat: string; monatText: string; grosseZahlCents: number; grosseZahlText: string; gelesen: boolean }
const DEMO_BERICHT: BerichtKurz = { monat: "2026-08", monatText: "August 2026", grosseZahlCents: 59742, grosseZahlText: "Im August für Sie geholt: 597,42 € im Monat.", gelesen: false };
const folgemonatText = () => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "Europe/Berlin" }).format(d); };

export function Heute({ b, rw, basis, post, demo, briefAn = true }: { b: Bereich; rw: Rahmenweg; basis: string; post: Vorgang[] | null; demo: boolean; briefAn?: boolean }) {
  const std = new Date().getHours();
  const gruss = std < 11 ? "Guten Morgen" : std < 18 ? "Guten Tag" : "Guten Abend";
  const startFertig = !!b.onboardingGelaufen || rw.schritte.some((s) => s.key === "startgespraech" && s.stand === "erledigt");
  const terminIso = b.termin?.beginn ? String(b.termin.beginn).slice(0, 10) : null;
  const terminGebucht = !!terminIso && terminIso >= new Date().toISOString().slice(0, 10) && b.termin!.status !== "abgesagt" && b.termin!.status !== "verpasst";
  const laufend = (post ?? []).filter((v) => v.offen).slice(0, 3);
  const briefeGesendet = (post ?? []).filter((v) => v.art === "brief").length;
  const ap = b.ansprechpartner;
  // Zahl des Monats: nur ein GESPEICHERTER Bericht (Beleg, nicht Anzeige). Isolierter Abruf — fällt er aus, fällt nur diese Karte.
  const [bericht, setBericht] = useState<BerichtKurz | null | undefined>(demo ? DEMO_BERICHT : undefined);
  useEffect(() => {
    if (demo) return;
    api(`/kunde/${encodeURIComponent(b.kunde.ref)}/app/bericht-letzter`).then((r) => setBericht(r.ok && r.json?.ok && r.json.bericht ? r.json.bericht : null)).catch(() => setBericht(null));
  }, [b.kunde.ref, demo]);

  // Band: genau ein Zustand, in dieser Reihenfolge.
  let band: { text: string; aktion: string | null; href: string | null } | null = null;
  if (!b.stufe.bezahlt) band = { text: `Ihre erste Zahlung ist noch offen${b.paket.monatlichCents ? `: ${eur(b.paket.monatlichCents)}` : ""}${b.paket.zahlungsreferenz ? ` · Verwendungszweck ${b.paket.zahlungsreferenz}` : ""}`, aktion: "Jetzt zahlen", href: `${basis}/geld/zahlen` };
  else if (rw.raten.ueberfaellig) band = { text: `Rate ${rw.raten.ueberfaellig.nr} ist${rw.raten.ueberfaellig.seit ? ` seit ${rw.raten.ueberfaellig.seit}` : ""} offen.`, aktion: "Rate zahlen", href: `${basis}/geld/zahlen` };
  else if (!startFertig && terminGebucht) band = { text: `Ihr Startgespräch: ${zeit(b.termin!.beginn)} Uhr am Telefon${b.termin!.agent ? ` mit ${b.termin!.agent}` : ""}. Halten Sie Ihr Handy bereit.`, aktion: null, href: null };
  else if (!startFertig) band = { text: "Ihr Startgespräch: Wählen Sie eine Zeit. Das Gespräch führen wir am Telefon.", aktion: "Zeit wählen", href: `${basis}/weg` };

  return (
    <>
      <h1 className="ap-gruss ap-auf">{gruss}, {b.kunde.vorname} {b.kunde.nachname}.</h1>
      <p className="ap-ruhe ap-auf">
        {rw.lage === "kunde_dran" && <><b>Eine Sache wartet auf Sie.</b></>}
        {rw.lage === "fiaon_dran" && <><b>Sie müssen heute nichts tun.</b> Wir arbeiten an: {rw.arbeitAn?.titel}{rw.arbeitAn?.seit ? ` — seit ${rw.arbeitAn.seit}` : ""}.</>}
        {rw.lage === "nichts_offen" && <><b>Sie müssen heute nichts tun.</b> Gerade liegt nichts an.</>}
      </p>

      {band && (band.href ? (
        <Link href={band.href} className="ap-band ap-auf v1"><div><b>{band.text}</b></div>{band.aktion && <span style={{ color: "var(--fi-primaer)", fontWeight: 500, whiteSpace: "nowrap" }}>{band.aktion} →</span>}</Link>
      ) : (
        <div className="ap-band ap-auf v1"><div><b>{band.text}</b></div></div>
      ))}

      <Link href={`${basis}/weg`} className="ap-auf v1" style={{ textDecoration: "none", display: "block" }}><Zielkarte rw={rw} /></Link>

      {rw.jetzt && (
        <section className="ap-abschnitt ap-auf v2">
          <h2 className="ap-abschnitt-titel">Jetzt dran</h2>
          <div className="ap-karte">
            <h3>{rw.jetzt.titel}</h3>
            <p>{rw.jetzt.text}</p>
            {rw.jetzt.wer === "fiaon" && <p style={{ fontSize: 14, marginTop: 8 }}>Liegt bei FIAON{rw.arbeitAn?.seit ? ` seit ${rw.arbeitAn.seit}` : ""}. Sie müssen dafür nichts tun.</p>}
          </div>
        </section>
      )}

      <section className="ap-abschnitt ap-auf v3">
        <h2 className="ap-abschnitt-titel">In Arbeit bei FIAON</h2>
        {laufend.length === 0 ? (
          <div className="ap-karte"><p style={{ margin: 0 }}>Noch kein Vorgang. Der erste entsteht in Ihrem Startgespräch – oder mit Ihrem ersten Brief. <Link href={`${basis}/brief`} className="ap-link">Brief fotografieren</Link></p></div>
        ) : (
          <div className="ap-karte" style={{ padding: "4px 16px" }}>
            {laufend.map((v) => (
              <div key={v.id} className="ap-zeile" style={{ minHeight: 56, alignItems: "center", borderTop: "1px solid var(--fi-linie)" }}>
                <span style={{ color: "var(--fi-text)", minWidth: 0 }}>{v.artText}{v.empfaenger ? ` · bei ${v.empfaenger}` : ""}{v.versandtAm ? ` seit ${v.versandtAm}` : v.eingegangenAm ? ` · eingegangen ${v.eingegangenAm}` : ""}</span>
                <b style={{ fontWeight: 500, fontSize: 13, color: v.stand === "nachfrage" ? "var(--fi-warnung)" : "var(--fi-text-leise)" }}>{v.stand === "nachfrage" ? "überfällig — wir haken nach" : v.fristAm ? `Antwort bis ${v.fristAm}` : v.standText}</b>
              </div>
            ))}
            <Link href={`${basis}/vorgaenge`} className="ap-link" style={{ display: "block", padding: "12px 0 8px", fontSize: 15 }}>Alle Vorgänge →</Link>
          </div>
        )}
      </section>

      <section className="ap-abschnitt ap-auf v3">

        {bericht ? (

          <Link href={`${basis}/geld/bericht/${bericht.monat}`} className="ap-karte" style={{ display: "block", textDecoration: "none" }}>

            <h2 className="ap-abschnitt-titel" style={{ padding: 0 }}>{bericht.monatText}</h2>

            <div className="ap-zahl" style={{ marginTop: 6 }}>{eur(bericht.grosseZahlCents)}</div>

            <p style={{ marginTop: 4 }}>{bericht.grosseZahlText}</p>

            <span className="ap-link" style={{ display: "inline-block", marginTop: 8 }}>Nachrechnen →</span>

          </Link>

        ) : bericht === null ? (

          <p className="ap-fuss">Ihr erster Monatsbericht erscheint am 1. {folgemonatText()}.</p>

        ) : null}

      </section>


      {briefeGesendet === 0 && briefAn && (
        <Link href={`${basis}/brief`} className="ap-karte ap-auf v3" style={{ display: "block", textDecoration: "none" }}>
          <h3>Ein Brief macht Ihnen Sorgen?</h3>
          <p>Fotografieren Sie ihn ab – wir ordnen ihn Ihrer Akte zu und sagen Ihnen, was wir daraus machen. Sie müssen nichts erklären.</p>
          <span className="ap-link" style={{ display: "inline-block", marginTop: 10 }}>Brief fotografieren →</span>
        </Link>
      )}

      <section className="ap-abschnitt ap-auf v4">
        <div className="ap-karte" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {ap ? (
            <>
              <span className="ap-avatar" style={{ flex: "none" }}>{ap.name.split(" ").map((t) => t[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block" }}>Bei FIAON kümmert sich <b style={{ fontWeight: 500 }}>{ap.name}</b> um Sie.</span><Link href={`${basis}/mehr/hilfe`} className="ap-link" style={{ fontSize: 14 }}>Nachricht schreiben</Link></div>
            </>
          ) : (
            <div style={{ flex: 1 }}><span>Ihr FIAON-Team kümmert sich um Sie.</span></div>
          )}
        </div>
      </section>
      {demo && <p className="ap-fuss">Demo-Ansicht mit festen Vorführdaten – kein echtes Konto.</p>}
    </>
  );
}
