// ═══════════════════════════════════════════════════════════════════════════
// DIE FIAON FINANZ- UND BONITÄTSAUSWERTUNG IM KUNDENBEREICH (E-IT-D, 08.10.2026, 4b)
//
// Eine Komponente für /app/auswertung und /mein-bereich („Meine Finanzen").
// Sie RECHNET NICHTS: Ampeln, FIAON-Finanzwert, Schritte und Texte kommen
// eingefroren vom Server (GET /kunde/:ref/finanzauswertung) — so, wie sie
// freigegeben wurden. Der Wert steht nie ohne seine Kennzeichnung (kein
// SCHUFA-Score, keine Bonitätsauskunft, keine Zusage). Kein Ampel-Bauteil aus
// dem Mitarbeiter-Office (BoniAmpel), keine Weitergabe (Prüfstand
// pruef-boni-ampel.ts, Abschnitt „Einsatzort Finanzauswertung").
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AMPEL_WORT, BEREICHE, FINANZWERT_KENNZEICHNUNG, FRIST_TEXT, VORBEHALT_TEXTE, FA_WERT_NAME,
  type Ampel, type AuswertungInhalt, type Frist,
} from "@shared/fiaon-finanzauswertung";
import "@/styles/finanzauswertung.css";

const FARBE: Record<Ampel, string> = { gruen: "#0F9D6B", gelb: "#D99A06", rot: "#D93A3A", offen: "#94A3B8" };
const eur = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;
const datum = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const tag = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

interface Fassung { id: number; nummer: string; fassung: number; freigegebenAm: string | null; status: string }
interface Antwort { ok: boolean; gelesen?: boolean; aktuell: (Fassung & { inhalt: AuswertungInhalt | null }) | null; fruehere: Fassung[]; error?: string }

async function laden(kundeRef: string, opts: { kurz?: boolean; gelesen?: boolean } = {}): Promise<Antwort | null> {
  const q = new URLSearchParams();
  if (opts.kurz) q.set("kurz", "1");
  if (opts.gelesen) q.set("gelesen", "1");
  const r = await fetch(`/api/fiaon/kunde/${encodeURIComponent(kundeRef)}/finanzauswertung${q.toString() ? `?${q}` : ""}`, { credentials: "include" }).catch(() => null);
  if (!r) return null;
  return r.json().catch(() => null);
}

const pdfUrl = (kundeRef: string, id: number, ansehen = false) => `/api/fiaon/kunde/${encodeURIComponent(kundeRef)}/finanzauswertung/${id}/pdf${ansehen ? "?ansehen=1" : ""}`;

/** Die Skala 100–999 — der Bogen füllt sich einmal bis zum Wert. */
function Skala({ wert }: { wert: number }) {
  const [an, setAn] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setAn(true), 60); return () => window.clearTimeout(t); }, []);
  const cx = 170, cy = 170, r = 140;
  const winkel = (v: number) => Math.PI * (1 - (Math.max(100, Math.min(999, v)) - 100) / 899);
  const p = (v: number, rr = r) => [cx + rr * Math.cos(winkel(v)), cy - rr * Math.sin(winkel(v))];
  const [x1, y1] = p(100); const [x2, y2] = p(999);
  const laenge = Math.PI * r;
  const anteil = (Math.max(100, Math.min(999, wert)) - 100) / 899;
  const [mx, my] = p(an ? wert : 100);
  return (
    <svg className="fa-skala" viewBox="-26 -22 392 214" role="img" aria-label={`${FA_WERT_NAME} ${wert} von 999`}>
      <defs><linearGradient id="fa-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#288DFA" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient></defs>
      <path d={`M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={18} strokeLinecap="round" />
      <path className="fa-bogen" d={`M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke="url(#fa-v)" strokeWidth={18} strokeLinecap="round"
        strokeDasharray={laenge} strokeDashoffset={an ? laenge * (1 - anteil) : laenge} />
      {[100, 400, 550, 700, 850, 999].map((g) => { const [tx, ty] = p(g, r + 26); return <text key={g} x={tx} y={ty + 3} fontSize={9} textAnchor="middle" fill="rgba(255,255,255,.6)">{g}</text>; })}
      <circle cx={mx} cy={my} r={10} fill="#0B1220" stroke="#fff" strokeWidth={3} style={{ transition: "cx 1.2s, cy 1.2s" }} />
    </svg>
  );
}

function wirkungText(w: AuswertungInhalt["schritte"][number]["wirkung"]): string | null {
  if (!w) return null;
  if (w.art === "ruecklage") return `Rücklage rund ${eur(w.bisCents)} im Monat`;
  if (w.vonCents === w.bisCents) return `rund ${eur(w.bisCents)} im Monat`;
  return `${w.vonCents > 0 ? `${eur(w.vonCents)}–` : "bis zu "}${eur(w.bisCents)} im Monat`;
}

/** Die ganze Ansicht (Vollbild in /app, Abschnitt in /mein-bereich). */
export function FinanzauswertungAnsicht({ kundeRef, demo = false, zurueck }: { kundeRef: string; demo?: boolean; zurueck?: { href: string; text: string } }) {
  const [a, setA] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    if (demo || !kundeRef) return;
    let an = true;
    void laden(kundeRef, { gelesen: true }).then((r) => { if (!an) return; if (r?.ok) setA(r); else setFehler(r?.error || "Ihre Auswertung lässt sich gerade nicht laden."); });
    return () => { an = false; };
  }, [kundeRef, demo]);

  if (demo) return <div className="fa"><div className="fa-karte fa-leer">In der Demo-Ansicht gibt es keine persönliche Auswertung.</div></div>;
  if (fehler) return <div className="fa"><div className="fa-karte fa-leer">{fehler}</div></div>;
  if (!a) return <div className="fa"><div className="fa-karte fa-leer fa-still">Wird geladen …</div></div>;
  const x = a.aktuell?.inhalt ?? null;
  if (!a.aktuell || !x) {
    return (
      <div className="fa">
        <div className="fa-karte fa-leer">
          <b>Ihre Finanz- und Bonitätsauswertung</b>
          <p className="fa-still" style={{ marginTop: 6 }}>Sobald Ihre Unterlagen vollständig sind und Ihre Ansprechperson die Auswertung freigegeben hat, finden Sie sie hier — mit Ampel, Plan und PDF.</p>
        </div>
      </div>
    );
  }
  const f = x.fakten;
  const fristen: Frist[] = ["sofort", "30", "90", "365"];
  return (
    <div className="fa">
      {zurueck && <Link className="fa-link" href={zurueck.href} style={{ display: "inline-block", marginBottom: 10 }}>← {zurueck.text}</Link>}
      <section className="fa-buehne" aria-label="Ihr FIAON-Finanzwert">
        <div className="fa-art">Finanz- und Bonitätsauswertung · {x.nummer}</div>
        <Skala wert={x.finanzwert.wert} />
        <div className="fa-wert">{x.finanzwert.wert}<small>{FA_WERT_NAME} · 100–999</small></div>
        <div className="fa-band">{x.finanzwert.band.charAt(0).toUpperCase() + x.finanzwert.band.slice(1)}</div>
        <div className="fa-pillen">
          <span className="fa-pille"><i className="fa-punkt" style={{ background: FARBE[x.gesamt.ampel] }} />Gesamt: {AMPEL_WORT[x.gesamt.ampel]}</span>
        </div>
        <p className="fa-kenn">{FINANZWERT_KENNZEICHNUNG}</p>
      </section>

      <p style={{ marginTop: 16, fontSize: 16 }}>{x.einordnung.zusammenfassung}</p>
      <p className="fa-still">Grundlage: Ihr Kontoauszug vom {tag(x.zeitraum.von)} bis {tag(x.zeitraum.bis)} · freigegeben am {datum(a.aktuell.freigegebenAm)}</p>
      {x.vorbehalte.length > 0 && <div className="fa-hinweis vorbehalt"><b>Vorbehalt.</b> {x.vorbehalte.map((v) => VORBEHALT_TEXTE[v] ?? v).join(" ")}</div>}

      <div className="fa-kacheln">
        <div className="fa-kachel"><span>Ø Einnahmen</span><b>{eur(f.einnahmenJeMonatCents)}</b></div>
        <div className="fa-kachel"><span>Ø Ausgaben</span><b>{eur(f.ausgabenJeMonatCents)}</b></div>
        <div className="fa-kachel"><span>Ø Überschuss</span><b style={{ color: f.ueberschussJeMonatCents >= 0 ? "#0F7A55" : "#B42318" }}>{eur(f.ueberschussJeMonatCents)}</b></div>
        <div className="fa-kachel"><span>Sparpotenzial</span><b>{x.sparpotenzial.bisCents > 0 ? `bis ${eur(x.sparpotenzial.bisCents)}` : "—"}</b></div>
      </div>

      <h2 className="fa-titel">Ihre Ampel je Bereich</h2>
      <div className="fa-karte">
        {x.ampeln.map((b) => (
          <div key={b.key} className="fa-bereich">
            <span className="fa-punkt" style={{ background: FARBE[b.ampel] }} aria-hidden="true" />
            <div>
              <b>{b.titel}</b> <span className="fa-still">· {AMPEL_WORT[b.ampel]}</span>
              <p>{b.grund}</p>
              {x.einordnung.bereiche[b.key] && x.einordnung.bereiche[b.key] !== b.grund && <p className="fa-still">{x.einordnung.bereiche[b.key]}</p>}
              <p className="fa-still" style={{ fontSize: 12 }}>{BEREICHE.find((k) => k.key === b.key)?.frage}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="fa-titel">Ihr Plan</h2>
      {fristen.map((fr) => {
        const liste = x.schritte.filter((s) => s.frist === fr);
        if (!liste.length) return null;
        return (
          <div key={fr}>
            <div className="fa-frist">{FRIST_TEXT[fr]}</div>
            {liste.map((s) => (
              <div key={s.art} className="fa-schritt">
                <div className="fa-schritt-kopf"><b>{s.titel}</b>{wirkungText(s.wirkung) && <span className={`fa-wirkung${s.wirkung?.art === "ruecklage" ? " ruecklage" : ""}`}>{wirkungText(s.wirkung)}</span>}</div>
                <div className="fa-still">{s.warum}</div>
                <ul>{s.wie.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            ))}
          </div>
        );
      })}
      <p className="fa-still" style={{ marginTop: 8 }}>Die Beträge sind Spannen aus Ihren eigenen Buchungen — keine Zusage.</p>

      {f.vertraege.length > 0 && (
        <>
          <h2 className="fa-titel">Ihre Verträge und Abos</h2>
          <div className="fa-karte" style={{ padding: "4px 16px" }}>
            <table className="fa-tabelle"><tbody>
              {f.vertraege.slice(0, 12).map((v, i) => <tr key={i}><td>{v.name}<div className="fa-still">{v.kategorie}</div></td><td className="r">{eur(v.jeMonatCents)}</td></tr>)}
            </tbody></table>
          </div>
        </>
      )}

      <a className="fa-knopf" href={pdfUrl(kundeRef, a.aktuell.id)}>Auswertung als PDF speichern</a>
      <a className="fa-knopf still" href={pdfUrl(kundeRef, a.aktuell.id, true)} target="_blank" rel="noreferrer">PDF im Browser ansehen</a>

      {a.fruehere.length > 0 && (
        <>
          <h2 className="fa-titel">Frühere Fassungen</h2>
          <div className="fa-karte" style={{ padding: "4px 16px" }}>
            <table className="fa-tabelle"><tbody>
              {a.fruehere.map((v) => <tr key={v.id}><td>{v.nummer}<div className="fa-still">freigegeben am {datum(v.freigegebenAm)}</div></td><td className="r"><a className="fa-link" href={pdfUrl(kundeRef, v.id)}>PDF</a></td></tr>)}
            </tbody></table>
          </div>
        </>
      )}
      <p className="fa-still" style={{ marginTop: 16, fontSize: 12 }}>Diese Auswertung dient Ihrer Information und der Ordnung Ihrer Finanzen. Sie ist keine Anlage-, Kredit-, Versicherungs-, Steuer- oder Rechtsberatung und keine Vermittlung. Alle Hinweise dazu stehen im PDF unter „Methodik, Grenzen und Rechtliches“.</p>
    </div>
  );
}

/** Die kleine Karte (Heute, Geld): nur, wenn eine freigegebene Auswertung da ist. Ohne Zahlen. */
export function FinanzauswertungKarte({ kundeRef, demo = false, href, nurNeu = false }: { kundeRef: string; demo?: boolean; href: string; nurNeu?: boolean }) {
  const [a, setA] = useState<Antwort | null>(null);
  useEffect(() => {
    if (demo || !kundeRef) return;
    let an = true;
    void laden(kundeRef, { kurz: true }).then((r) => { if (an && r?.ok) setA(r); });
    return () => { an = false; };
  }, [kundeRef, demo]);
  if (!a?.aktuell) return null;
  if (nurNeu && a.gelesen) return null;
  return (
    <Link href={href} className="fa" style={{ display: "block", textDecoration: "none" }}>
      <div className="fa-karte" style={{ borderColor: "#D6E3F7", background: "#F7FAFE" }}>
        <b style={{ color: "#0B1220" }}>{a.gelesen ? "Ihre Finanz- und Bonitätsauswertung" : "Ihre Finanz- und Bonitätsauswertung liegt bereit"}</b>
        <p className="fa-still" style={{ margin: "4px 0 0" }}>Ampel je Bereich, Ihr Plan mit konkreten Schritten und das PDF — freigegeben am {datum(a.aktuell.freigegebenAm)}.</p>
        <span className="fa-link" style={{ display: "inline-block", marginTop: 8 }}>Ansehen →</span>
      </div>
    </Link>
  );
}
