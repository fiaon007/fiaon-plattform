import { useCallback, useEffect, useMemo, useState } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import SeoDaten from "@/components/site/SeoDaten";
import "./gruender-termin.css";

// ═══════════════════════════════════════════════════════════════════════════
// /justin — Termin beim Gründer (05.09.2026, E-124)
//
// Justin: „Eine eigene ‚Calendly'-Seite, wo die Leute bei mir einen Termin
// buchen können — maximal drei Termine am Tag, die wählbar sind."
//
// Drei Schritte auf einer Seite: Tag, Uhrzeit, Angaben. Kein Login, kein
// Token — die Adresse ist die Einladung. Sie-Form durchgehend; die Zeiten
// kommen aus Justins Sprechzeiten, der Server deckelt sie auf drei je Tag.
// ═══════════════════════════════════════════════════════════════════════════

interface Slot { beginn: string; datum: string; uhrzeit: string; agentId: number; agentVorname: string }
interface Tag { datum: string; zeiten: number; sprechzeit: boolean }
interface Angebot {
  gruender: { vorname: string; name: string; titel: string; bild: string | null };
  slots: Slot[];
  tage: Tag[];
  slotMinuten: number;
  proTag: number;
}
interface Fertig { beginn: string; datumText: string; uhrzeit: string; stornoToken: string; agentName: string }

const WT_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WT_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function berlinHeute(plus = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(Date.now() + plus * 86_400_000));
}
function teile(datum: string) {
  const [y, m, d] = datum.split("-").map(Number);
  return { y, m, d, wt: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
/** „Mittwoch, 9. September" — ausgeschrieben, die Seite soll Ruhe ausstrahlen. */
function tagLang(datum: string): string {
  const t = teile(datum);
  if (datum === berlinHeute()) return `Heute, ${t.d}. ${MONATE[t.m - 1]}`;
  if (datum === berlinHeute(1)) return `Morgen, ${t.d}. ${MONATE[t.m - 1]}`;
  return `${WT_LANG[t.wt]}, ${t.d}. ${MONATE[t.m - 1]}`;
}

const THEMEN = [
  "Partnerschaft oder Kooperation",
  "Beteiligung / Investment",
  "Presse und Medien",
  "Ich bin Kunde und möchte den Gründer sprechen",
  "Ich möchte Kunde werden",
  "Bewerbung / Mitarbeit",
  "Etwas anderes",
];

export default function GruenderTermin() {
  const [daten, setDaten] = useState<Angebot | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [bucht, setBucht] = useState(false);
  const [fertig, setFertig] = useState<(Fertig & { email: string }) | null>(null);
  const [f, setF] = useState({ anrede: "", vorname: "", nachname: "", email: "", telefon: "", thema: "", nachricht: "", website: "" });

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await fetch("/api/fiaon/gruender-termin").catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok || !json?.ok) {
      setFehler(json?.error || "Die freien Zeiten konnten nicht geladen werden. Bitte laden Sie die Seite neu.");
      setLaedt(false);
      return;
    }
    setDaten(json);
    setLaedt(false);
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  // Der erste Tag mit Zeiten ist vorgewählt — niemand soll erst suchen müssen.
  useEffect(() => {
    if (!daten) return;
    if (tag && daten.tage.some((t) => t.datum === tag && t.zeiten > 0)) return;
    const erster = daten.tage.find((t) => t.zeiten > 0);
    setTag(erster ? erster.datum : null);
  }, [daten, tag]);

  const zeiten = useMemo(() => (daten && tag ? daten.slots.filter((s) => s.datum === tag) : []), [daten, tag]);
  const naechster = useMemo(() => daten?.tage.find((t) => t.zeiten > 0) ?? null, [daten]);

  const buchen = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!slot || bucht) return;
    setFehler(null);
    setBucht(true);
    const res = await fetch("/api/fiaon/gruender-termin/buchen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, beginn: slot.beginn }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBucht(false);
    if (!json?.ok || !json.termin) {
      setFehler(json?.error || "Die Buchung hat nicht geklappt. Bitte versuchen Sie es noch einmal.");
      if (json?.grund === "nicht_angeboten" || json?.grund === "kein_angebot") { setSlot(null); void laden(); }
      return;
    }
    setFertig({ ...json.termin, email: f.email });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const g = daten?.gruender;
  const initialen = (g?.name || "Justin Schwarzott").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="gt-seite">
      <SeoDaten pfad="/justin" titel="Termin mit Justin Schwarzott, Gründer von FIAON"
                beschreibung="Wählen Sie eine Zeit — Justin Schwarzott ruft Sie an. 30 Minuten, telefonisch, höchstens drei Gespräche am Tag." />
      <GlassNav activePage="kontakt" />

      <main className="gt-rahmen">
        <aside className="gt-person" aria-label="Ihr Gesprächspartner">
          <div className="gt-bild">
            {g?.bild ? <img src={g.bild} alt={g.name} width={90} height={90} /> : <span aria-hidden="true">{initialen}</span>}
          </div>
          <p className="gt-eyebrow">Termin mit dem Gründer</p>
          <h1 className="gt-name">{g?.name || "Justin Schwarzott"}</h1>
          <p className="gt-titel">{g?.titel || "Gründer & Geschäftsführer"}, FIAON</p>
          <p className="gt-zitat">
            „Sie möchten direkt mit mir sprechen — über eine Partnerschaft, eine Beteiligung, Presse oder Ihre eigene
            Bonität? Wählen Sie eine Zeit. Ich rufe Sie an.“
          </p>
          <ul className="gt-fakten">
            <li>
              <Zeichen art="uhr" />
              <span><b>{daten?.slotMinuten ?? 30} Minuten</b> — ein Gespräch, kein Verkaufstermin.</span>
            </li>
            <li>
              <Zeichen art="telefon" />
              <span><b>Telefonisch.</b> {g?.vorname || "Justin"} ruft Sie zur gewählten Zeit an — Sie müssen nichts einrichten.</span>
            </li>
            <li>
              <Zeichen art="kalender" />
              <span><b>Höchstens {daten?.proTag ?? 3} Gespräche am Tag.</b> Deshalb sind die Zeiten knapp — und dafür ungeteilt.</span>
            </li>
            <li>
              <Zeichen art="haken" />
              <span><b>Kostenlos und unverbindlich.</b> Absagen oder verschieben geht jederzeit über den Link in der Bestätigung.</span>
            </li>
          </ul>
        </aside>

        <section className="gt-buchung" aria-label="Termin wählen">
          {fehler && !fertig && <div className="gt-fehler" role="alert">{fehler}</div>}

          {laedt && <div className="gt-laden">Freie Zeiten werden geladen …</div>}

          {!laedt && fertig && (
            <div className="gt-fertig" role="status">
              <div className="gt-haken" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2>Ihr Termin steht</h2>
              <p className="wann"><b>{fertig.datumText} um {fertig.uhrzeit} Uhr</b></p>
              <p>{fertig.agentName} ruft Sie zur vereinbarten Zeit an — halten Sie bitte Ihr Telefon bereit.</p>
              <p>Die Bestätigung mit dem Link zum Verschieben oder Absagen ist unterwegs an <b>{fertig.email}</b>.</p>
            </div>
          )}

          {!laedt && daten && !fertig && (
            <>
              {/* ── 1 · Tag ─────────────────────────────────────────────── */}
              <div className="gt-schritt">
                <div className="gt-schritt-kopf">
                  <span className="gt-nr" aria-hidden="true">1</span>
                  <div>
                    <h2>Wählen Sie einen Tag</h2>
                    <p>Die nächsten zwei Wochen. Graue Tage haben keine Sprechzeit oder sind bereits voll.</p>
                  </div>
                </div>
                <div className="gt-tage" role="listbox" aria-label="Tage">
                  {daten.tage.map((t) => {
                    const p = teile(t.datum);
                    const heute = t.datum === berlinHeute();
                    const status = t.zeiten > 0 ? `${t.zeiten} ${t.zeiten === 1 ? "Zeit" : "Zeiten"}` : t.sprechzeit ? "voll" : "—";
                    return (
                      <button key={t.datum} type="button" className="gt-tag" disabled={t.zeiten === 0}
                              aria-pressed={tag === t.datum}
                              onClick={() => { setTag(t.datum); setSlot(null); setFehler(null); }}
                              title={tagLang(t.datum)}>
                        <span className="wt">{heute ? "Heute" : WT_KURZ[p.wt]}</span>
                        <span className="nr">{p.d}</span>
                        <span className="st">{status}</span>
                      </button>
                    );
                  })}
                </div>
                {!naechster && (
                  <div className="gt-leer">
                    <b>Im Moment ist keine Zeit frei.</b> Die nächsten zwei Wochen sind ausgebucht — schauen Sie in ein paar Tagen
                    noch einmal vorbei oder schreiben Sie an <a href="mailto:welcome@fiaon.com">welcome@fiaon.com</a>.
                  </div>
                )}
              </div>

              {/* ── 2 · Uhrzeit ─────────────────────────────────────────── */}
              {tag && (
                <div className="gt-schritt">
                  <div className="gt-schritt-kopf">
                    <span className="gt-nr" aria-hidden="true">2</span>
                    <div>
                      <h2>{tagLang(tag)}</h2>
                      <p>Wählen Sie eine Uhrzeit. Alle Zeiten in Ihrer Zeitzone Berlin/Wien/Zürich.</p>
                    </div>
                  </div>
                  <div className="gt-zeiten" role="listbox" aria-label="Uhrzeiten">
                    {zeiten.map((s) => (
                      <button key={s.beginn} type="button" className="gt-zeit" aria-pressed={slot?.beginn === s.beginn}
                              onClick={() => { setSlot(slot?.beginn === s.beginn ? null : s); setFehler(null); }}>
                        {s.uhrzeit} Uhr
                        <small>{daten.slotMinuten} Minuten</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 3 · Angaben ─────────────────────────────────────────── */}
              {slot && (
                <form className="gt-schritt" onSubmit={(e) => void buchen(e)} noValidate>
                  <div className="gt-schritt-kopf">
                    <span className="gt-nr" aria-hidden="true">3</span>
                    <div>
                      <h2>Ihre Angaben</h2>
                      <p>Damit {g?.vorname || "Justin"} weiß, wen er anruft und worum es geht.</p>
                    </div>
                  </div>

                  <div className="gt-wahl">
                    <p className="k">Ihre Zeit</p>
                    <p className="z"><b>{tagLang(slot.datum)}</b> · {slot.uhrzeit} Uhr</p>
                    <p className="u">{daten.slotMinuten} Minuten · {g?.name || "Justin Schwarzott"} ruft Sie an</p>
                    <button type="button" onClick={() => setSlot(null)}>Andere Zeit</button>
                  </div>

                  <div className="gt-formular">
                    <div className="gt-feld">
                      <span>Anrede</span>
                      <div className="gt-anrede" role="group" aria-label="Anrede">
                        {["Herr", "Frau"].map((a) => (
                          <button key={a} type="button" aria-pressed={f.anrede === a}
                                  onClick={() => setF({ ...f, anrede: f.anrede === a ? "" : a })}>{a}</button>
                        ))}
                      </div>
                    </div>
                    <div className="gt-reihe">
                      <label className="gt-feld"><span>Vorname</span>
                        <input value={f.vorname} onChange={(e) => setF({ ...f, vorname: e.target.value })} autoComplete="given-name" required />
                      </label>
                      <label className="gt-feld"><span>Nachname</span>
                        <input value={f.nachname} onChange={(e) => setF({ ...f, nachname: e.target.value })} autoComplete="family-name" required />
                      </label>
                    </div>
                    <div className="gt-reihe">
                      <label className="gt-feld"><span>E-Mail-Adresse</span>
                        <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" inputMode="email" required />
                      </label>
                      <label className="gt-feld"><span>Telefonnummer — unter dieser Nummer werden Sie angerufen</span>
                        <input type="tel" value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} autoComplete="tel" inputMode="tel" placeholder="+49 …" required />
                      </label>
                    </div>
                    <label className="gt-feld"><span>Worum geht es?</span>
                      <select value={f.thema} onChange={(e) => setF({ ...f, thema: e.target.value })}>
                        <option value="">Bitte wählen</option>
                        {THEMEN.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="gt-feld"><span>Ihre Nachricht (optional)</span>
                      <textarea value={f.nachricht} onChange={(e) => setF({ ...f, nachricht: e.target.value })}
                                placeholder="Ein, zwei Sätze, damit das Gespräch direkt beim Thema beginnen kann." maxLength={2000} />
                    </label>
                    {/* Honigtopf — für Menschen unsichtbar, Roboter füllen ihn. */}
                    <label className="gt-honig" aria-hidden="true">
                      Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
                    </label>
                    <button type="submit" className="gt-knopf" disabled={bucht}>
                      {bucht ? "Wird gebucht …" : "Termin verbindlich buchen"}
                    </button>
                    <p className="gt-klein">
                      Sie erhalten sofort eine Bestätigung per E-Mail — mit einem Link, über den Sie jederzeit verschieben oder absagen können.
                      Ihre Angaben verwenden wir nur für dieses Gespräch.
                    </p>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </main>

      <PremiumFooter />
    </div>
  );
}

function Zeichen({ art }: { art: "uhr" | "telefon" | "kalender" | "haken" }) {
  const gemeinsam = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (art === "uhr") return <svg {...gemeinsam}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (art === "telefon") return <svg {...gemeinsam}><path d="M7 3.5c.8 0 1.5.6 1.7 1.4l.6 2.4a1.9 1.9 0 0 1-.6 1.9l-1 .9a10.5 10.5 0 0 0 4.7 4.7l.9-1a1.9 1.9 0 0 1 1.9-.6l2.4.6c.8.2 1.4.9 1.4 1.7v2c0 1-.9 1.9-1.9 1.8C9.9 19.8 4.2 14.1 3.5 5.4 3.4 4.4 4.3 3.5 5.3 3.5H7Z" /></svg>;
  if (art === "kalender") return <svg {...gemeinsam}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
  return <svg {...gemeinsam}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.3 2.3L15.5 10" /></svg>;
}
