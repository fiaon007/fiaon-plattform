// ═══════════════════════════════════════════════════════════════════════════
// PERSÖNLICH IN MIAMI — die Navy-Bühne der Startseite (17.11.2026)
//
// Bis E-509 stand hier die Tafel „Global VIP“ (Nachtblau, laufende Lichtkante, Ticket nach Miami). Das Paket gibt es nicht
// mehr — Justin (17.11.): „nichts soll weg, nur erweitert und angepasst werden“. Die Bühne bleibt darum genau so stehen und
// sagt jetzt, was heute gilt (VERKAUF_TEXTE.buehne.kapitalSatz): ab einem Kapitalrahmen von 1 Mio. US-Dollar begleiten wir
// Sie persönlich in Miami — dasselbe Mandat, dieselben acht Bereiche; Ablauf und Termine klärt das Erstgespräch. Kein Preis,
// kein Versprechen zu Reise oder Hotel (das gehörte zum alten Paket).
// Bausteine unverändert aus GlobalVip.tsx (Bühne mit Neigung, Ticket) und GlobalTafel.tsx (Haken); Stil in global.css.
// ═══════════════════════════════════════════════════════════════════════════
import { GlobalVipBuehne, GlobalVipTicket } from "@/components/site/GlobalVip";
import { Haken } from "@/components/site/global/GlobalTafel";
import type { GlobalStartWoerter } from "@/i18n/global";

function Funke() {
  return <svg className="fg-funke" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" fill="currentColor" /></svg>;
}
function Pfeil() {
  return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function GlobalMiami({ w, onGespraech }: { w: GlobalStartWoerter["miami"]; onGespraech: () => void }) {
  return (
    <section className="fg-sek fg-miami-sek" aria-label={w.titel}>
      <div className="fg-rahmen">
        <GlobalVipBuehne id="miami" className="fg-tarif vip fg-miami" label={w.titel}>
          <div className="fg-vip-text">
            <div className="fg-vip-zeile"><span className="fg-vip-zeichen"><Funke />{w.zeichen}</span><span className="marke">{w.marke}</span></div>
            <h3>{w.titel}</h3>
            <p className="fuer">{w.text}</p>
            <div className="fg-vip-kapital">
              <span>{w.kapitalTitel}</span>
              <b className="fg-glanz">{w.kapitalWert}</b>
              <em>{w.kapitalSatz}</em>
            </div>
            <ul>{w.punkte.map((x) => <li key={x}><Haken />{x}</li>)}</ul>
          </div>
          <div className="fg-vip-seite">
            <GlobalVipTicket texte={w.ticket} />
            <div className="tun">
              <button type="button" className="fg-knopf voll" onClick={onGespraech}>{w.knopf}<Pfeil /></button>
            </div>
          </div>
        </GlobalVipBuehne>
      </div>
    </section>
  );
}
