// ═══════════════════════════════════════════════════════════════════════════
// /agent/onboarding — Raum „Onboarding“ (24.08.2026, Plan §20 / E-051)
//
// VORHER: Die Startgespräche lebten als Reiter im Calendar — Kennzahl-Kacheln
// ohne Wirkung, „Wartet auf Gespräch 374“ (global statt eigene), und der Raum,
// in dem der Mitarbeiter sein Onboarding MACHT, existierte nicht.
// NACHHER: Dieser Raum führt durch die Onboarding-Termine:
//   · Fokus-Karte „Dein nächstes Onboarding“ mit Countdown, Kunde, Lage-
//     Kurzzeile und großem „Gespräch führen“ (OnboardingCockpit).
//   · Kacheln = Filter (heute geplant · heute erledigt · nicht erschienen ·
//     wartet auf Gespräch) — Klick filtert die Liste darunter. Die Zahlen
//     rechnet der Server seit E-051 auf die EIGENEN Kunden (Rolle agent).
//   · Ziel-Leiste: 74-€-Auskunftszahlung (10 € Bonus) und Aktivierung.
//   · Komplette Sektion aus calendar.tsx übernommen: Offen/Erledigt/Wartende,
//     Nachtragen/Nicht erschienen/Einladung, Notiz + Verlauf, Wartende
//     einladen/anrufen, ZusageTafel ton="dunkel" bei 403.
//
// Daten:    GET  /agent/onboarding/termine · /kennzahlen · /wartende
//           GET  /agent/onboarding/person/:id/verlauf · /lage
// Aktionen: POST /agent/onboarding/termine/:id/ergebnis { ergebnis, notiz }
//           POST /agent/onboarding/person/:id/notiz { notiz } · /einladung
//           POST /agent/onboarding/wartende/:id/einladung
// Anruf: Ereignis `fiaon-anrufen`. Akte: /agent/kunden?person=<ID>.
// Datei heißt onboarding-raum.tsx, weil onboarding.tsx das Vertrags-Gate ist.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Phone, Check, ExternalLink, Headset, ChevronRight } from "lucide-react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import { ZusageTafel } from "./vertrieb-zusage";
import { LageTafel } from "./vertrieb-service";
import { OnboardingCockpit } from "@/components/agent/OnboardingCockpit";
import "@/styles/office-onboarding.css";

const uhr = (d: Date) => new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const zeitTag = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const datumLang = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
const anrufen = (nummer: string | null | undefined, personId: number | null | undefined, name: string) => { if (!nummer) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId: personId ?? null, name } })); };

interface SgTermin {
  id: number; personId: number; name: string; vorname: string | null; telefon: string | null; email: string | null;
  beginn: string; datum: string; datumText: string; uhrzeit: string; dauerMin: number; status: string; notiz: string | null;
  heute: boolean; vorbei: boolean; erledigtAm?: string | null; abgesagtAm?: string | null; quelle?: string | null;
  terminArtText?: string | null; terminArtTon?: string | null;
}
interface Kennzahlen {
  heuteGeplant?: number; heuteErledigt?: number; heuteNoShow?: number; wartend?: number; wartendOhneTermin?: number;
  freigeschaltetWoche?: number; dieseWoche?: number; nurEigene?: boolean;
}
interface Wartender { personId: number; name: string; telefon: string | null; email: string | null; paket: string | null; tage: number | null; terminAm: string | null; eingeladenAm: string | null; verpasst: number }
const sgErledigt = (t: SgTermin) => t.status === "erledigt" || t.status === "verpasst" || !!t.erledigtAm || !!t.abgesagtAm;
type Filter = "offen" | "heute" | "erledigt" | "noshow" | "wartende";

/** Countdown zum nächsten Gespräch — kurz, menschlich, live (30-s-Takt). */
function countdown(beginn: string, jetzt: Date): { text: string; dran: boolean } {
  const diff = new Date(beginn).getTime() - jetzt.getTime();
  const min = Math.round(Math.abs(diff) / 60000);
  if (diff <= 0) return min < 2 ? { text: "jetzt", dran: true } : { text: `seit ${min < 60 ? `${min} min` : `${Math.floor(min / 60)} Std`} überfällig`, dran: true };
  if (min < 60) return { text: `in ${min} min`, dran: min <= 10 };
  if (min < 24 * 60) return { text: `in ${Math.floor(min / 60)} Std ${min % 60} min`, dran: false };
  return { text: `in ${Math.round(min / (24 * 60))} Tagen`, dran: false };
}

export default function AgentOnboardingRaumPage() { return <AgentShell><OnboardingInnen /></AgentShell>; }

function OnboardingInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Onboarding"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [termine, setTermine] = useState<SgTermin[]>([]);
  const [zahlen, setZahlen] = useState<Kennzahlen | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zusageOffen, setZusageOffen] = useState(false);
  const [filter, setFilter] = useState<Filter>("offen");
  const [offen, setOffen] = useState<number | null>(null);
  const [cockpit, setCockpit] = useState<SgTermin | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; warn?: boolean } | null>(null);
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setJetzt(new Date()), 30_000); return () => clearInterval(i); }, []);
  const flash = (text: string, warn = false) => { setMeldung({ text, warn }); setTimeout(() => setMeldung(null), 4500); };

  const laden = useCallback(async () => {
    const r = await api("/agent/onboarding/termine");
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { setZusageOffen(true); setLaedt(false); return; }
    if (r.status === 404) { setFehler("Dieser Raum steht deiner Rolle nicht zur Verfügung."); setLaedt(false); return; }
    if (r.ok) { setTermine(r.json.termine || []); setFehler(null); }
    else setFehler(r.json?.error || "Die Termine konnten nicht geladen werden.");
    const k = await api("/agent/onboarding/kennzahlen");
    if (k.ok) setZahlen(k.json);
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const offene = useMemo(() => termine.filter((t) => !sgErledigt(t)), [termine]);
  const erledigte = useMemo(() => termine.filter(sgErledigt).sort((a, b) => +new Date(b.erledigtAm ?? b.beginn) - +new Date(a.erledigtAm ?? a.beginn)), [termine]);
  const heutige = useMemo(() => termine.filter((t) => t.heute), [termine]);
  const noshows = useMemo(() => termine.filter((t) => t.status === "verpasst"), [termine]);
  // Das Herz der Seite: der nächste offene Termin (überfällige zuerst — die sind JETZT dran).
  const naechster = offene.find((t) => t.status === "gebucht") ?? null;

  const liste = filter === "erledigt" ? erledigte : filter === "heute" ? heutige : filter === "noshow" ? noshows : offene;
  const tage = useMemo(() => {
    const map = new Map<string, SgTermin[]>();
    for (const t of liste) { const l = map.get(t.datum) || []; l.push(t); map.set(t.datum, l); }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [liste]);

  if (zusageOffen) return <div className="ob"><div className="ob-hell"><ZusageTafel basis="/agent/onboarding/zusage" ton="dunkel" onAngenommen={() => { setZusageOffen(false); setLaedt(true); void laden(); }} /></div></div>;

  const kacheln: { k: Filter; label: string; wert: number | undefined; hinweis: string }[] = [
    { k: "heute", label: "Heute geplant", wert: zahlen?.heuteGeplant, hinweis: "Startgespräche, die heute stattfinden sollen. Klick zeigt den heutigen Tag." },
    { k: "erledigt", label: "Heute erledigt", wert: zahlen?.heuteErledigt, hinweis: "Heute geführte Gespräche – jedes hat ein Konto freigeschaltet. Klick zeigt alle abgeschlossenen." },
    { k: "noshow", label: "Nicht erschienen", wert: zahlen?.heuteNoShow, hinweis: "Heute nicht erschienen. Diese Kunden werden automatisch erneut eingeladen. Klick zeigt alle offenen No-Shows." },
    { k: "wartende", label: "Wartet auf Gespräch", wert: zahlen?.wartend, hinweis: "Bezahlte Kunden, deren Konto bis zum Startgespräch eingeschränkt bleibt. Klick öffnet die Liste zum Einladen." },
  ];

  return (
    <div className="ob">
      <section className="ob-kopf">
        <span className="ob-pille">{datumLang(jetzt)} · Onboarding</span>
        <h1>{naechster ? <>Dein nächstes <span className="ob-verlauf">Onboarding</span>.</> : (zahlen?.wartend ?? 0) > 0 ? <><span className="ob-verlauf">{zahlen?.wartend}</span> {zahlen?.wartend === 1 ? "Kunde wartet" : "Kunden warten"} auf ihr Gespräch.</> : <>Alle Gespräche <span className="ob-verlauf">geführt.</span></>}</h1>
        <p>Hier machst du deine Startgespräche: Cockpit öffnen, Gespräch führen, Konto freischalten. Wer noch keinen Termin hat, bekommt mit einem Klick die Einladung.</p>
      </section>

      {fehler && <p className="ob-fehler">{fehler}</p>}
      {meldung && <p className={`ob-meldung${meldung.warn ? " warn" : ""}`}>{meldung.text}</p>}

      {!fehler && (
        <section className={`ob-fokus${naechster ? "" : " leer"}`} aria-label="Dein nächstes Onboarding">
          {laedt ? <p className="ob-lade">Lade …</p> : naechster ? (
            <FokusKarte t={naechster} jetzt={jetzt} onCockpit={() => setCockpit(naechster)} />
          ) : (
            <div className="ob-fokus-leer">
              <b>Kein offenes Startgespräch.</b>
              <span>{(zahlen?.wartendOhneTermin ?? 0) > 0 ? `${zahlen?.wartendOhneTermin} Wartende haben noch keinen Termin – lade sie unten ein.` : "Sobald ein Kunde bucht, steht das Gespräch hier."}</span>
              {(zahlen?.wartendOhneTermin ?? 0) > 0 && <button type="button" className="ob-knopf" onClick={() => setFilter("wartende")}>Wartende ansehen <ChevronRight size={15} /></button>}
            </div>
          )}
        </section>
      )}

      <p className="ob-ziel">Ziel jedes Gesprächs: die <b>74-€-Auskunftszahlung</b> (10 € für dich) und die Aktivierung.</p>

      <section className="ob-kacheln" aria-label="Kennzahlen und Filter">
        {kacheln.map((k) => (
          <button key={k.k} type="button" title={k.hinweis} className={`ob-kachel${filter === k.k ? " an" : ""}${k.k === "wartende" ? " hervor" : ""}`}
                  onClick={() => setFilter(filter === k.k ? "offen" : k.k)} aria-pressed={filter === k.k}>
            <small>{k.label}</small>
            <b>{zahlen ? (k.wert ?? 0) : "–"}</b>
            {k.k === "wartende" && zahlen != null && <span>{zahlen.wartendOhneTermin ?? 0} ohne Termin</span>}
          </button>
        ))}
      </section>
      {zahlen && <p className="ob-fussnote">{zahlen.nurEigene ? "Zahlen aus deinem Bestand" : "Zahlen hausweit"} · Freigeschaltet in 7 Tagen: {zahlen.freigeschaltetWoche ?? 0}{filter !== "offen" ? " · Kachel erneut klicken = alle offenen" : ""}</p>}

      {filter === "wartende" && <Wartende onGeaendert={() => void laden()} flash={flash} />}

      {filter !== "wartende" && (
        <section className="ob-liste">
          {laedt && <p className="ob-lade">Lade …</p>}
          {!laedt && tage.length === 0 && (
            <div className="ob-block"><p className="ob-leer">{filter === "erledigt" ? "Noch nichts abgeschlossen. Geführte und verpasste Gespräche stehen hier – mit Haken und Uhrzeit." : filter === "noshow" ? "Kein offener No-Show. Gut so." : filter === "heute" ? "Heute steht kein Startgespräch an." : `Kein offenes Startgespräch. Bezahlte Kunden werden beim ersten Login eingeladen und wählen ihre Zeit selbst.${erledigte.length ? ` ${erledigte.length} bereits bearbeitete stehen unter „Heute erledigt“.` : ""}`}</p></div>
          )}
          {!laedt && tage.map(([datum, dl]) => (
            <div key={datum}>
              <span className={`ob-tag-titel${dl[0].heute ? " heute" : ""}`}>{dl[0].heute ? "Heute" : dl[0].datumText}</span>
              <div className="ob-liste">
                {dl.map((t) => <SgKarte key={t.id} t={t} offen={offen === t.id} onOeffnen={() => setOffen(offen === t.id ? null : t.id)} onFertig={() => void laden()} onCockpit={() => setCockpit(t)} flash={flash} />)}
              </div>
            </div>
          ))}
        </section>
      )}

      {cockpit && (
        <OnboardingCockpit
          termin={{ id: cockpit.id, personId: cockpit.personId, name: cockpit.name, telefon: cockpit.telefon ?? null, email: cockpit.email ?? null, beginn: cockpit.beginn, datumText: cockpit.datumText, uhrzeit: cockpit.uhrzeit, dauerMin: cockpit.dauerMin, status: cockpit.status }}
          onZu={() => setCockpit(null)}
          onFertig={(m) => { setCockpit(null); flash(`Startgespräch abgeschlossen. ${m || ""}`); void laden(); }}
          onAnrufen={(nummer, personId, name) => anrufen(nummer, personId, name)}
        />
      )}
    </div>
  );
}

// ── Fokus-Karte: nächster Termin, Countdown, Lage-Kurzzeile, großer Knopf ────
function FokusKarte({ t, jetzt, onCockpit }: { t: SgTermin; jetzt: Date; onCockpit: () => void }) {
  const [lage, setLage] = useState<{ paket?: string | null; zahlungsstand?: string | null; bonitaet?: string | null } | null>(null);
  useEffect(() => {
    let weg = false;
    setLage(null);
    void api(`/agent/onboarding/person/${t.personId}/lage`).then((r) => { if (!weg && r.ok) setLage(r.json); });
    return () => { weg = true; };
  }, [t.personId]);
  const cd = countdown(t.beginn, jetzt);
  const kurz = lage ? [lage.paket, lage.zahlungsstand, lage.bonitaet].filter(Boolean).join(" · ") : null;
  return (
    <div className="ob-fokus-innen">
      <div className="ob-fokus-links">
        <small>Dein nächstes Onboarding</small>
        <b className="ob-fokus-name">{t.name}</b>
        <span className="ob-fokus-zeit">{t.heute ? "Heute" : t.datumText} · {t.uhrzeit} Uhr · {t.dauerMin} min{t.terminArtText ? <em className="ob-marke blau" style={t.terminArtTon ? { color: t.terminArtTon, borderColor: `${t.terminArtTon}66` } : undefined}>{t.terminArtText}</em> : null}</span>
        <span className="ob-fokus-lage">{kurz || (lage === null ? "Lade Lage …" : "Lage in der Karte unten")}</span>
      </div>
      <div className="ob-fokus-rechts">
        <b className={`ob-countdown${cd.dran ? " dran" : ""}`}>{cd.text}</b>
        <div className="ob-fokus-knoepfe">
          <button type="button" className="ob-knopf gross" onClick={onCockpit}><Headset size={17} strokeWidth={1.75} /> Gespräch führen</button>
          {t.telefon && <button type="button" className="ob-knopf still" onClick={() => anrufen(t.telefon, t.personId, t.name)}><Phone size={15} strokeWidth={1.75} /> Anrufen</button>}
          <Link href={`/agent/kunden?person=${t.personId}`} className="ob-knopf still"><ExternalLink size={15} strokeWidth={1.75} /> Akte</Link>
        </div>
      </div>
    </div>
  );
}

// ── Eine Terminkarte (übernommen aus calendar.tsx, E-051) ────────────────────
function SgKarte({ t, offen, onOeffnen, onFertig, onCockpit, flash }: { t: SgTermin; offen: boolean; onOeffnen: () => void; onFertig: () => void; onCockpit: () => void; flash: (text: string, warn?: boolean) => void }) {
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  const [notizFehler, setNotizFehler] = useState<string | null>(null);
  useEffect(() => {
    if (!offen) return;
    let weg = false;
    void api(`/agent/onboarding/person/${t.personId}/verlauf`).then((r) => { if (!weg) setVerlauf(r.ok ? (r.json.verlauf ?? []) : []); });
    return () => { weg = true; };
  }, [offen, t.personId]);
  const notizSpeichern = async () => {
    const text = notiz.trim();
    if (text.length < 2) { setNotizFehler("Bitte etwas mehr als ein Zeichen."); return; }
    setBusy("notiz"); setNotizFehler(null);
    const r = await api(`/agent/onboarding/person/${t.personId}/notiz`, { method: "POST", body: JSON.stringify({ notiz: text }) });
    setBusy(null);
    if (!r.ok) { setNotizFehler(r.json?.error || "Die Notiz wurde nicht gespeichert."); return; }
    setNotiz(""); setVerlauf(r.json.verlauf ?? []); flash("Notiz gespeichert – sie steht im Verlauf des Kunden.");
  };
  const dokumentieren = async (ergebnis: "erledigt" | "verpasst") => {
    setBusy(ergebnis);
    const r = await api(`/agent/onboarding/termine/${t.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis, notiz: notiz.trim() || undefined }) });
    setBusy(null);
    if (!r.ok) { flash(r.json?.error || "Nicht gespeichert – bitte erneut versuchen.", true); return; }
    flash(r.json.hinweis || "Festgehalten."); setNotiz(""); onFertig();
  };
  const einladen = async () => {
    setBusy("einladung");
    const r = await api(`/agent/onboarding/person/${t.personId}/einladung`, { method: "POST" });
    setBusy(null);
    flash(r.ok ? `Einladung verschickt an ${t.email}` : (r.json?.error || r.json?.grund || "Nicht verschickt – bitte später erneut."), !r.ok);
  };
  return (
    <div className={`ob-karte${t.heute ? " heute" : ""}`}>
      <div className="ob-karte-kopf">
        <div className="ob-zeit"><b>{t.uhrzeit}</b><small>{t.dauerMin} min</small></div>
        <div className="ob-wer" onClick={onOeffnen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOeffnen(); }}>
          <b>{t.name}</b>
          <small>
            {t.terminArtText && <span className="ob-marke blau" style={t.terminArtTon ? { color: t.terminArtTon, borderColor: `${t.terminArtTon}66` } : undefined}>{t.terminArtText}</span>}
            <span>{t.telefon || "keine Nummer hinterlegt"}</span>
            {t.status === "erledigt" && <span className="ob-marke kunde"><Check size={10} style={{ marginRight: 3 }} />erledigt{t.erledigtAm ? ` · ${uhr(new Date(t.erledigtAm))}` : ""}</span>}
            {t.status === "verpasst" && <span className="ob-marke warn">nicht erschienen</span>}
            {!!t.abgesagtAm && <span className="ob-marke">vom Kunden abgesagt · {zeitTag(t.abgesagtAm)}</span>}
          </small>
        </div>
        <div className="ob-aktion">
          {t.status === "gebucht" && <button type="button" className="ob-knopf klein" onClick={onCockpit}>Gespräch führen</button>}
          {t.telefon && <button type="button" className="ob-knopf klein still" onClick={() => anrufen(t.telefon, t.personId, t.name)}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>}
          <button type="button" className="ob-knopf klein still" onClick={onOeffnen}>{offen ? "Zu" : "Mehr"}</button>
        </div>
      </div>
      {offen && (
        <div className="ob-auf">
          <div><span className="ob-titel">Lage des Kunden</span><div className="ob-hell"><LageTafel personId={t.personId} basis="/agent/onboarding/person" /></div></div>
          {t.status === "gebucht" && (
            <div>
              <span className="ob-titel">Ergebnis festhalten</span>
              <div className="ob-aktion" style={{ justifyContent: "flex-start" }}>
                <button type="button" className="ob-knopf klein" onClick={onCockpit} disabled={!!busy}>Gespräch führen</button>
                <button type="button" className="ob-knopf klein still" onClick={() => void dokumentieren("erledigt")} disabled={!!busy}>{busy === "erledigt" ? "…" : "Nachtragen: geführt"}</button>
                <button type="button" className="ob-knopf klein still" onClick={() => void dokumentieren("verpasst")} disabled={!!busy}>{busy === "verpasst" ? "…" : "Nicht erschienen"}</button>
                <button type="button" className="ob-knopf klein still" onClick={() => void einladen()} disabled={!!busy}>{busy === "einladung" ? "…" : "Einladung erneut senden"}</button>
              </div>
              {/* VORHER (bis 24.08.2026): „…und lädt den Kunden erneut ein."
                  Das stimmte nicht: Nach einem No-Show ging tagelang gar nichts
                  raus, frühestens nach 48 Stunden die generische Einladung.
                  NACHHER: Der Server verschickt sofort das Ereignis
                  `termin_verpasst`. Der Satz sagt jetzt, was wirklich geschieht.
                  GRUND: Auftrag des Inhabers vom 24.08.2026. */}
              <p className="ob-lade" style={{ marginTop: 8 }}>„Nicht erschienen“ zählt wie ein erfolgloser Anruf. Der Kunde bekommt sofort eine E-Mail mit dem Link für einen neuen Termin.</p>
            </div>
          )}
          <div>
            <span className="ob-titel">Notiz zum Kunden</span>
            <textarea className="ob-feld" rows={2} value={notiz} onChange={(e) => { setNotiz(e.target.value); setNotizFehler(null); }} placeholder="Was ist zu wissen? Steht danach im Verlauf des Kunden." aria-label="Notiz zum Kunden" />
            <div className="ob-form-knoepfe" style={{ marginTop: 8 }}>
              <button type="button" className="ob-knopf klein still" onClick={() => void notizSpeichern()} disabled={busy === "notiz" || notiz.trim().length < 2}>{busy === "notiz" ? "Speichert …" : "Notiz speichern"}</button>
              {notizFehler && <small style={{ color: "#f87171" }} role="alert">{notizFehler}</small>}
            </div>
            {!verlauf && <p className="ob-lade" style={{ marginTop: 8 }}>Lade Verlauf …</p>}
            {verlauf && verlauf.length === 0 && <p className="ob-lade" style={{ marginTop: 8 }}>Noch kein Eintrag.</p>}
            {verlauf && verlauf.length > 0 && <ul className="ob-verlauf-liste">{verlauf.map((v: any, i: number) => <li key={i}><b>{zeitTag(v.am)}</b> · <span>{v.agent_name || "System"}</span>{v.notiz && <> — {v.notiz}</>}</li>)}</ul>}
          </div>
          {t.notiz && <p className="ob-notiz">Gesprächsnotiz: {t.notiz}</p>}
          <Link href={`/agent/kunden?person=${t.personId}`} className="ob-link"><ExternalLink size={14} /> Zur Akte</Link>
        </div>
      )}
    </div>
  );
}

// ── Die Wartenden (übernommen aus calendar.tsx, E-051) ───────────────────────
function Wartende({ onGeaendert, flash }: { onGeaendert: () => void; flash: (text: string, warn?: boolean) => void }) {
  const [zeilen, setZeilen] = useState<Wartender[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nur, setNur] = useState<"ohne_termin" | "alle">("ohne_termin");
  const [busy, setBusy] = useState<number | null>(null);
  const [link, setLink] = useState<Record<number, string>>({});
  const laden = useCallback(async () => {
    const r = await api("/agent/onboarding/wartende");
    if (r.ok) { setZeilen(r.json.wartende || []); setFehler(null); } else setFehler(r.json?.error || `Die Liste kam nicht (HTTP ${r.status}).`);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const einladen = async (w: Wartender) => {
    setBusy(w.personId);
    const r = await api(`/agent/onboarding/wartende/${w.personId}/einladung`, { method: "POST" });
    setBusy(null);
    if (r.json?.terminLink) setLink((l) => ({ ...l, [w.personId]: r.json.terminLink }));
    if (r.ok) { flash(`Einladung verschickt – ${w.name} hat den Terminlink per E-Mail bekommen.`); void laden(); onGeaendert(); }
    else flash(r.json?.error || r.json?.grund || "Nicht verschickt – bitte anrufen und den Link durchgeben.", true);
  };
  const sichtbar = (zeilen ?? []).filter((w) => nur === "alle" || !w.terminAm);
  return (
    <section className="ob-block">
      <div className="ob-block-kopf">
        <div><b>Bezahlt, aber noch kein Startgespräch</b><br /><small>Nach Wartezeit sortiert. Ohne Termin: Terminlink mit einem Klick. Ohne Reaktion: anrufen.</small></div>
        <div className="ob-wartend-filter">{([["ohne_termin", "Ohne Termin"], ["alle", "Alle Wartenden"]] as const).map(([k, l]) => <button key={k} type="button" className={nur === k ? "an" : ""} onClick={() => setNur(k)}>{l}</button>)}</div>
      </div>
      {fehler && <p className="ob-fehler">{fehler} <button type="button" className="ob-knopf klein still" style={{ marginLeft: 8 }} onClick={() => void laden()}>Noch einmal laden</button></p>}
      {!zeilen && !fehler && <p className="ob-lade">Lade …</p>}
      {zeilen && sichtbar.length === 0 && <p className="ob-leer">Niemand wartet{nur === "ohne_termin" ? " ohne Termin" : ""}.</p>}
      {sichtbar.map((w) => (
        <div key={w.personId} className="ob-zeile">
          <div className="ob-wer">
            <b>{w.name}</b>
            <small><span>{w.paket || "Paket"}</span>{w.tage != null && <span>· bezahlt vor {w.tage} {w.tage === 1 ? "Tag" : "Tagen"}</span>}{w.verpasst > 0 && <span>· {w.verpasst}× nicht erschienen</span>}</small>
            <span className={`ob-stand ${w.terminAm ? "gut" : w.eingeladenAm ? "warn" : "rot"}`}>{w.terminAm ? `Termin gebucht: ${zeitTag(w.terminAm)}` : w.eingeladenAm ? `Eingeladen am ${zeitTag(w.eingeladenAm)} — noch keine Buchung` : "Noch nie eingeladen"}</span>
            {link[w.personId] && <span className="ob-code">Terminlink zum Durchgeben: {link[w.personId]}</span>}
          </div>
          <div className="ob-aktion">
            {w.telefon && <button type="button" className="ob-knopf klein" onClick={() => anrufen(w.telefon, w.personId, w.name)}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>}
            {!w.terminAm && <button type="button" className="ob-knopf klein still" disabled={busy === w.personId} onClick={() => void einladen(w)}>{busy === w.personId ? "Sendet …" : w.eingeladenAm ? "Erneut einladen" : "Einladung senden"}</button>}
            <Link href={`/agent/kunden?person=${w.personId}`} className="ob-knopf klein still">Akte</Link>
          </div>
        </div>
      ))}
    </section>
  );
}
