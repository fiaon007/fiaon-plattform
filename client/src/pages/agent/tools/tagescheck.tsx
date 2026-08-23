// ═══════════════════════════════════════════════════════════════════════════
// /agent/tools/tagescheck — Tages-Check (23.08.2026, Plan §4/§11)
//
// Mein Tag in Zahlen: dokumentierte Kontakte, erreichte Kunden, Termine und
// Abschlüsse heute; Ziel 5 Abschlüsse am Tag als Ring. „Was jetzt am meisten
// bringt“: Rückrufe/Zusagen fällig > heiße A-Kunden > B-Kunden ohne Kontakt
// seit 3 Tagen – mit Anruf- und Akte-Knopf.
// Daten: GET /agent/start (Zahlen, Zusagen, Rückrufe), /agent/termine,
// /agent/tickets/zaehler, /agent/leistung?from=heute (Kontakte, Ergebnisse,
// Abschlüsse), /agent/kunden/liste (Stufen A/B, letzter Kontakt).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Phone, FileText, PhoneCall, Users, Calendar, Trophy, ListChecks, RefreshCw } from "lucide-react";
import { AgentShell, api } from "../shared";
import { useOffice } from "../OfficeShell";
import "@/styles/office-tools.css";

const ZIEL = 5;
const heuteBerlin = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
/** Mitternacht Berlin als echter Zeitpunkt (für ?from= an /agent/leistung). */
function tagesbeginnBerlin(): Date {
  const probe = new Date(heuteBerlin() + "T00:00:00Z");
  const off = new Date(probe.toLocaleString("en-US", { timeZone: "Europe/Berlin" })).getTime() - new Date(probe.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(probe.getTime() - off);
}
const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const anrufen = (nummer: string | null | undefined, personId: number, name: string) => { if (!nummer) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } })); };
const kontaktTage = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);

interface Vorschlag { personId: number; name: string; grund: "rueckruf" | "zusage" | "A" | "B"; text: string; nummer: string | null }

export default function AgentTagescheckPage() { return <AgentShell><TagescheckInnen /></AgentShell>; }

function TagescheckInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tools · Tages-Check"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [start, setStart] = useState<any>(null);
  const [termine, setTermine] = useState<any[]>([]);
  const [tickets, setTickets] = useState(0);
  const [leistung, setLeistung] = useState<any>(null);
  const [kunden, setKunden] = useState<any[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  const laden = () => {
    setLaedt(true);
    const von = tagesbeginnBerlin().toISOString();
    Promise.all([
      api("/agent/start"), api("/agent/termine"), api("/agent/tickets/zaehler"),
      api(`/agent/leistung?from=${encodeURIComponent(von)}`), api("/agent/kunden/liste?limit=500"),
    ]).then(([s, t, z, l, k]) => {
      if (s.ok) setStart(s.json); else setFehler(s.json?.error || "Die Zahlen konnten nicht geladen werden.");
      if (t.ok) setTermine(t.json.termine || []);
      if (z.ok) setTickets((z.json.meine || 0) + (z.json.pool || 0));
      if (l.ok) setLeistung(l.json);
      if (k.ok) setKunden(k.json.kunden || []);
      setLaedt(false);
    }).catch(() => { setFehler("Keine Verbindung."); setLaedt(false); });
  };
  useEffect(() => { laden(); const i = setInterval(laden, 120_000); return () => clearInterval(i); }, []);

  const heute = heuteBerlin();
  const termineHeute = useMemo(() => termine.filter((t) => new Date(t.beginn).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) === heute), [termine, heute]);
  const me = leistung?.me || null;
  const kontakte = Number(me?.kontakte ?? 0);
  const erreicht = me?.outcomes ? Object.entries(me.outcomes as Record<string, number>).filter(([k]) => k.startsWith("erreicht") || k === "rueckruf_termin").reduce((s, [, n]) => s + Number(n), 0) : 0;
  const abschluesse = Number(me?.abschluesse ?? 0);
  const anteil = Math.min(1, abschluesse / ZIEL);

  const vorschlaege = useMemo<Vorschlag[]>(() => {
    const liste: Vorschlag[] = []; const drin = new Set<number>();
    const nummerVon = (id: number) => kunden.find((k) => k.personId === id)?.telefonWaehlbar ?? null;
    const jetzt = Date.now(); const tagEnde = new Date(heute + "T23:59:59").getTime();
    for (const r of (start?.rueckrufe || [])) {
      if (new Date(r.am).getTime() > tagEnde) continue;
      if (drin.has(r.personId)) continue; drin.add(r.personId);
      liste.push({ personId: r.personId, name: r.name, grund: "rueckruf", text: `${new Date(r.am).getTime() <= jetzt ? "fällig seit" : "heute"} ${uhr(r.am)}${r.notiz ? ` · ${r.notiz}` : ""}`, nummer: nummerVon(r.personId) });
    }
    for (const z of (start?.zusagen || [])) {
      if (!z.zusagedatum || z.zusagedatum.slice(0, 10) > heute) continue;
      if (drin.has(z.personId)) continue; drin.add(z.personId);
      liste.push({ personId: z.personId, name: z.name, grund: "zusage", text: `Zahlungszusage ${z.zusagedatum.slice(0, 10) < heute ? "überfällig" : "heute"}${z.produkt ? ` · ${z.produkt}` : ""}`, nummer: z.telefonWaehlbar ?? nummerVon(z.personId) });
    }
    for (const k of kunden.filter((x) => x.stufe?.marke === "A")) {
      if (drin.has(k.personId)) continue; drin.add(k.personId);
      liste.push({ personId: k.personId, name: k.name, grund: "A", text: `Zahlung gemeldet · ${k.produkt || "Paket"}${k.letzterKontakt ? ` · Kontakt vor ${kontaktTage(k.letzterKontakt)} Tagen` : ""}`, nummer: k.telefonWaehlbar });
    }
    for (const k of kunden.filter((x) => x.stufe?.marke === "B")) {
      const t = kontaktTage(k.letzterKontakt);
      if (t != null && t < 3) continue;
      if (drin.has(k.personId)) continue; drin.add(k.personId);
      liste.push({ personId: k.personId, name: k.name, grund: "B", text: `${t == null ? "noch kein Kontakt" : `seit ${t} Tagen kein Kontakt`} · ${k.produkt || "Antrag fertig"}`, nummer: k.telefonWaehlbar });
    }
    return liste.slice(0, 15);
  }, [start, kunden, heute]);

  const GRUND: Record<Vorschlag["grund"], string> = { rueckruf: "Rückruf", zusage: "Zusage", A: "Stufe A", B: "Stufe B" };
  const stunde = Number(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", hour12: false, timeZone: "Europe/Berlin" }).slice(0, 2));
  const lage = abschluesse >= ZIEL ? "Ziel erreicht – alles darüber ist Bonus." : stunde < 11 ? `Noch ${ZIEL - abschluesse} bis zum Ziel. Der Vormittag ist die beste Zeit für A-Kunden.` : stunde < 15 ? `Noch ${ZIEL - abschluesse} bis zum Ziel. Jetzt Rückrufe und Zusagen nachfassen.` : `Noch ${ZIEL - abschluesse} bis zum Ziel. Am Nachmittag erreichst du die meisten – dranbleiben.`;

  return (
    <div className="to">
      <section className="to-kopf">
        <div>
          <span className="to-pille">Tools · Tages-Check</span>
          <h1>{laedt ? <>Lade <span className="to-verlauf">deinen Tag …</span></> : abschluesse >= ZIEL ? <>Ziel erreicht – <span className="to-verlauf">{abschluesse} Abschlüsse.</span></> : <>Heute <span className="to-verlauf">{abschluesse} von {ZIEL}</span> Abschlüssen.</>}</h1>
          <p>{laedt ? "Zahlen, Termine und Kunden kommen gleich." : lage}</p>
        </div>
        <div className="to-reihe">
          <button type="button" className="to-zurueck" onClick={laden}><RefreshCw size={14} strokeWidth={1.75} /> Neu laden</button>
          <Link href="/agent/tools" className="to-zurueck"><ArrowLeft size={15} strokeWidth={1.75} /> Alle Tools</Link>
        </div>
      </section>

      {fehler && <p className="to-fehler">{fehler}</p>}

      <div className="to-spalten breit">
        <div style={{ display: "grid", gap: 14 }}>
          <section className="to-kacheln">
            <div className="to-kachel-zahl"><i><PhoneCall size={18} strokeWidth={1.75} /></i><b>{kontakte}</b><span>Kontakte dokumentiert</span></div>
            <div className="to-kachel-zahl"><i><Users size={18} strokeWidth={1.75} /></i><b>{erreicht}</b><span>Kunden erreicht</span></div>
            <div className="to-kachel-zahl"><i><Calendar size={18} strokeWidth={1.75} /></i><b>{termineHeute.length}</b><span>Termine heute</span></div>
            <div className="to-kachel-zahl"><i><ListChecks size={18} strokeWidth={1.75} /></i><b>{tickets}</b><span>Aufgaben und Anliegen</span></div>
          </section>

          <section className="to-block">
            <div className="to-block-kopf"><b>Was jetzt am meisten bringt</b><small>Rückrufe fällig · dann Stufe A · dann B ohne Kontakt seit 3 Tagen</small></div>
            {!laedt && vorschlaege.length === 0 && <p className="leise">Nichts Dringendes. Öffne die Pipeline und nimm dir die nächsten Leads vor.</p>}
            {vorschlaege.map((v) => (
              <div key={`${v.grund}-${v.personId}`} className="to-zeile">
                <span className={`grund ${v.grund === "zusage" ? "rueckruf" : v.grund}`}>{GRUND[v.grund]}</span>
                <div className="wer"><b>{v.name}</b><small>{v.text}</small></div>
                <div className="tun">
                  <button type="button" className="to-knopf klein" disabled={!v.nummer} onClick={() => anrufen(v.nummer, v.personId, v.name)}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>
                  <Link href={`/agent/pipeline?person=${v.personId}`} className="to-knopf still klein"><FileText size={14} strokeWidth={1.75} /> Akte</Link>
                </div>
              </div>
            ))}
          </section>

          {termineHeute.length > 0 && (
            <section className="to-block leicht">
              <div className="to-block-kopf"><b>Termine heute</b><small>nach Uhrzeit</small></div>
              {termineHeute.map((t) => (
                <div key={t.id} className="to-zeile">
                  <span className="grund">{uhr(t.beginn)}</span>
                  <div className="wer"><b>{t.name}</b><small>{t.terminArtText || t.quelle || "Gespräch"}{t.status === "verpasst" ? " · verpasst" : ""}</small></div>
                  <div className="tun">
                    <button type="button" className="to-knopf klein" disabled={!t.telefon} onClick={() => anrufen(t.telefon, t.personId, t.name)}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>
                    <Link href={`/agent/pipeline?person=${t.personId}`} className="to-knopf still klein">Akte</Link>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <section className="to-block hervor">
            <div className="to-block-kopf"><b>Ziel: {ZIEL} Abschlüsse am Tag</b><small>bankbestätigt</small></div>
            <div className={`to-ring${abschluesse >= ZIEL ? " voll" : ""}`} aria-label={`${abschluesse} von ${ZIEL}`}>
              <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="spur" cx="50" cy="50" r="46" /><circle className="lauf" cx="50" cy="50" r="46" style={{ strokeDashoffset: 289 * (1 - anteil) }} /></svg>
              <div className="to-ring-innen"><b>{abschluesse}</b><small>von {ZIEL}</small></div>
            </div>
            <p style={{ textAlign: "center" }}>{abschluesse >= ZIEL ? <><Trophy size={14} strokeWidth={1.75} style={{ verticalAlign: "-2px" }} /> Stark. Jeder weitere Abschluss ist Bonus.</> : `${ZIEL - abschluesse} fehlen noch. Du bekommst ${Math.round(Number(start?.verdienst?.satzBp ?? 2500) / 100)} % jeder bezahlten Rate – zwölf Monate lang.`}</p>
          </section>
          <section className="to-block">
            <div className="to-block-kopf"><b>Dein Vorrat</b><small>Pipeline nach Stufe</small></div>
            <div className="to-zahlen">
              <div className="to-zahl"><small>A</small><b>{start?.kunden?.tier1 ?? "–"}</b><span>Zahlung gemeldet</span></div>
              <div className="to-zahl"><small>B</small><b>{start?.kunden?.tier2 ?? "–"}</b><span>Antrag fertig</span></div>
              <div className="to-zahl"><small>C</small><b>{start?.kunden?.tier3 ?? "–"}</b><span>Leads</span></div>
            </div>
            <div className="to-reihe">
              <Link href="/agent/pipeline" className="to-knopf still">Zur Pipeline</Link>
              <Link href="/agent/kalender" className="to-knopf still">Calendar</Link>
            </div>
            <p className="to-fussnote">Kontakte und erreichte Kunden zählen, was du heute als Ergebnis gebucht hast. Ein Anruf ohne Ergebnis zählt nicht – buche ihn in der Akte.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
