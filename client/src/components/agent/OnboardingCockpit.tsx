// ═══════════════════════════════════════════════════════════════════════════
// DIE GESPRÄCHSBÜHNE — ein Startgespräch, geführt statt improvisiert
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Der Kunde hat bezahlt, sein Konto wartet auf dieses Gespräch. Fünfzehn
// Minuten, sechs Schritte, danach ist er freigeschaltet. Diese Ebene ist alles,
// was der Mitarbeiter während des Gesprächs braucht — und nichts, was ihn
// ablenkt.
//
// ── WARUM EINE BÜHNE UND KEINE LISTE ───────────────────────────────────────
// Ein Startgespräch, das jeder anders führt, ist sechsmal ein anderes Produkt.
// Die Agenda steht im Repo (`shared/fiaon-onboarding-agenda.ts`), die Notizen
// entstehen WÄHREND des Gesprächs, und am Ende schaltet EIN Knopf frei. Wer
// hinterher aus dem Gedächtnis dokumentiert, dokumentiert das, was er behalten
// hat — nicht das, was gesagt wurde.
//
// ── DIE FORM ───────────────────────────────────────────────────────────────
// `FiaonEbene`: Glas nur auf den schwebenden Leisten, Körper ruhig und lesbar,
// Eintritt aus der Tiefe. Auf 380 px steht alles untereinander; die Fußleiste
// klebt unten, weil der Abschluss-Knopf immer erreichbar sein muss.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KernbotschaftKarte } from "@/components/KernbotschaftKarte";
import { FiaonEbene } from "@/components/FiaonEbene";
import {
  AGENDA, darfAbschliessen, fortschritt, type AgendaStand,
} from "@shared/fiaon-onboarding-agenda";

/** Haken — 20×20, 1,5 px, currentColor (AGENTS.md: keine Icon-Bibliotheken). */
function Haken({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m4.5 10.5 3.6 3.6L15.5 6.5" />
    </svg>
  );
}

/**
 * Eine Rufnummer zum ABLESEN gruppieren: +49 176 1234 5678.
 *
 * Ohne Gruppen ist eine zwölfstellige Zahl eine Wand, und wer sie abtippt,
 * verliert die Stelle. Die Gruppierung folgt der deutschen Lesegewohnheit
 * (Land · Vorwahl · Rest in Vierergruppen) und lässt unbekannte Formate
 * unverändert — eine falsch gruppierte Nummer ist schlimmer als eine
 * ungruppierte.
 */
function nummerGruppiert(nummer: string): string {
  const roh = String(nummer).replace(/\s+/g, "");
  const m = /^\+49(\d{3,4})(\d+)$/.exec(roh);
  if (!m) return nummer;
  const rest = m[2].replace(/(\d{4})(?=\d)/g, "$1 ");
  return `+49 ${m[1]} ${rest}`;
}

/** Hörer — für den Anrufen-Knopf. */
function Hoerer({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
    </svg>
  );
}

export interface CockpitTermin {
  id: number;
  personId: number;
  name: string;
  telefon: string | null;
  email: string | null;
  beginn: string;
  datumText: string;
  uhrzeit: string;
  dauerMin: number;
  status: string;
  paket?: string | null;
  zahlungsstand?: string | null;
}

interface Lage {
  paket: string | null;
  zahlungsstand: string | null;
  dokumente: { fehlt: string[]; stand: string | null } | null;
  bonitaet: string | null;
  stufe: string | null;
}

export function OnboardingCockpit({
  termin, onZu, onFertig, onAnrufen,
}: {
  termin: CockpitTermin;
  onZu: () => void;
  onFertig: (meldung: string) => void;
  /** Öffnet das Softphone MIT Kundenkontext — nicht ein zweites Telefon. */
  onAnrufen?: (nummer: string, personId: number, name: string) => void;
}) {
  const [stand, setStand] = useState<AgendaStand>({ erledigt: [], notizen: {} });
  const [offen, setOffen] = useState<string | null>(AGENDA[0]?.key ?? null);
  const [lage, setLage] = useState<Lage | null>(null);
  const [busy, setBusy] = useState<"" | "fertig" | "noshow">("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [sekunden, setSekunden] = useState(0);
  const gestartet = useRef(Date.now());

  // ── DIE UHR LÄUFT MIT ───────────────────────────────────────────────────
  // Nicht als Druckmittel, sondern als Auskunft: Fünfzehn Minuten sind
  // zugesagt. Wer bei Minute 24 ist, weiß es — und kann es ansprechen, statt
  // den Kunden zu überziehen.
  useEffect(() => {
    const t = setInterval(() => setSekunden(Math.round((Date.now() - gestartet.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Die Lage des Kunden: Zahlung, Unterlagen, Bonität. Wer im Gespräch nach
  // dem Kontoauszug fragt, muss wissen, ob er schon da ist.
  useEffect(() => {
    let weg = false;
    void fetch(`/api/fiaon/agent/onboarding/person/${termin.personId}/lage`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (!weg && j?.ok) setLage(j.lage ?? j); })
      .catch(() => {});
    return () => { weg = true; };
  }, [termin.personId]);

  const prozent = useMemo(() => fortschritt(stand), [stand]);
  const pruefung = useMemo(() => darfAbschliessen(stand), [stand]);

  const abhaken = useCallback((key: string) => {
    setStand((v) => ({
      ...v,
      erledigt: v.erledigt.includes(key) ? v.erledigt.filter((k) => k !== key) : [...v.erledigt, key],
    }));
    setFehler(null);
  }, []);

  const notieren = useCallback((key: string, text: string) => {
    setStand((v) => ({ ...v, notizen: { ...v.notizen, [key]: text } }));
    setFehler(null);
  }, []);

  const abschliessen = async () => {
    if (!pruefung.ok) {
      setFehler(`Es fehlt noch: ${pruefung.fehlt.join(" · ")}`);
      return;
    }
    setBusy("fertig");
    const r = await fetch(`/api/fiaon/agent/onboarding/termine/${termin.id}/ergebnis`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ergebnis: "erledigt",
        // Die gesammelten Notizen als EIN Verlaufseintrag, in der Reihenfolge
        // der Agenda — so liest es sich später wie ein Protokoll.
        notiz: AGENDA
          .filter((a) => (stand.notizen[a.key] ?? "").trim())
          .map((a) => `${a.titel}: ${stand.notizen[a.key].trim()}`)
          .join("\n"),
        agenda: stand,
        dauerSek: sekunden,
      }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy("");
    if (j?.ok) onFertig(j.hinweis || "Startgespräch abgeschlossen — das Konto ist freigeschaltet.");
    else setFehler(j?.error || "Der Abschluss hat nicht geklappt.");
  };

  const nichtErschienen = async () => {
    if (!confirm(
      `„${termin.name}" als NICHT ERSCHIENEN vermerken?\n\n`
      + "Das zählt als erfolgloser Versuch, und der Kunde wird erneut eingeladen. "
      + "Das Konto bleibt eingeschränkt.",
    )) return;
    setBusy("noshow");
    const r = await fetch(`/api/fiaon/agent/onboarding/termine/${termin.id}/ergebnis`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ergebnis: "verpasst",
        notiz: stand.notizen.begruessung || null,
        dauerSek: sekunden,
      }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy("");
    if (j?.ok) onFertig(j.hinweis || "Als nicht erschienen vermerkt.");
    else setFehler(j?.error || "Das hat nicht geklappt.");
  };

  const mmss = `${String(Math.floor(sekunden / 60)).padStart(2, "0")}:${String(sekunden % 60).padStart(2, "0")}`;
  const ueberzogen = sekunden > (termin.dauerMin || 15) * 60;

  return (
    <FiaonEbene
      offen
      onZu={onZu}
      titel={`Startgespräch mit ${termin.name}`}
      breite={720}
      marke={<span style={{ color: "#1d4ed8" }}><Hoerer size={16} /></span>}
      kopf={
        <div className="min-w-0 flex-1">
          <p className="fi-ob-ueber">Startgespräch · {termin.datumText}, {termin.uhrzeit} Uhr</p>
          <h2 className="fi-ob-titel">{termin.name}</h2>
          <p className="fi-ob-unter">
            {[
              lage?.paket || termin.paket,
              lage?.zahlungsstand || termin.zahlungsstand,
            ].filter(Boolean).join(" · ") || "Bezahlt — wartet auf die Freischaltung"}
          </p>

          {/* ══════════════════════════════════════════════════════════════
              DIE NUMMER GROSS (19.08.2026)

              ── WARUM SIE VORHER FEHLTE UND WARUM DAS EIN PROBLEM WAR ────
              Es gab nur den Anrufen-Knopf. Der reicht, solange das Softphone
              tut — aber genau zur Terminzeit ist der schlechteste Moment für
              „das Telefon lädt nicht". Dann braucht der Mitarbeiter die Nummer
              zum ABLESEN, um vom Diensthandy zu wählen. Sie im
              Gesprächsblatt zu suchen, kostet die Minute, in der der Kunde
              bereitsitzt.

              ── WARUM GROSS UND MIT ZIFFERNABSTAND ───────────────────────
              Sie wird ABGETIPPT. Eine Nummer in 12,5 px Grau, ohne Gruppen,
              vertippt sich — und ein Vertipper ruft einen fremden Menschen an.
              Deshalb 19 px, tabellarische Ziffern, in Gruppen.

              Der Anrufen-Knopf steht direkt daneben: Wer klicken kann, klickt.
              Wer nicht kann, liest. ══════════════════════════════════════ */}
          {termin.telefon ? (
            <div className="fi-ob-nummer-zeile">
              <a href={`tel:${termin.telefon}`} className="fi-ob-nummer"
                 title="Am Telefon dieses Geräts wählen">
                {nummerGruppiert(termin.telefon)}
              </a>
              {onAnrufen && (
                <button type="button"
                        onClick={() => onAnrufen(termin.telefon!, termin.personId, termin.name)}
                        className="fi-ob-nummer-knopf">
                  <Hoerer size={14} /> Anrufen
                </button>
              )}
            </div>
          ) : (
            <p className="fi-ob-nummer-fehlt">
              Keine Telefonnummer hinterlegt — dieses Gespräch kann nicht geführt werden.
              Bitte im Gesprächsblatt nachtragen.
            </p>
          )}
        </div>
      }
      fuss={
        <div className="fi-ob-fuss">
          {fehler && <p className="fi-ob-fehler">{fehler}</p>}
          <div className="fi-ob-fuss-zeile">
            <button type="button" onClick={() => void nichtErschienen()} disabled={busy !== ""}
                    className="fi-ob-knopf-still">
              {busy === "noshow" ? "Wird vermerkt …" : "Kunde nicht erschienen"}
            </button>
            <button type="button" onClick={() => void abschliessen()} disabled={busy !== ""}
                    className="fi-ob-knopf-haupt" data-bereit={pruefung.ok ? "ja" : undefined}>
              {busy === "fertig" ? "Wird abgeschlossen …" : "Gespräch abschließen & freischalten"}
            </button>
          </div>
          {!pruefung.ok && (
            <p className="fi-ob-fuss-hinweis">
              Noch offen: {pruefung.fehlt.join(" · ")}
            </p>
          )}
        </div>
      }
      kinder={
        <>
          <style>{COCKPIT_CSS}</style>

          {/* ── KOPFLEISTE: ANRUFEN, UHR, FORTSCHRITT ────────────────── */}
          <div className="fi-ob-leiste">
            {termin.telefon && onAnrufen && (
              <button type="button"
                      onClick={() => onAnrufen(termin.telefon!, termin.personId, termin.name)}
                      className="fi-ob-anrufen">
                <Hoerer /> Anrufen
              </button>
            )}
            <span className="fi-ob-uhr" data-ueber={ueberzogen ? "ja" : undefined}
                  title={`Zugesagt sind ${termin.dauerMin || 15} Minuten`}>
              {mmss}
            </span>
            <a href={`/agent/kunden?person=${termin.personId}`} className="fi-ob-blatt">
              Gesprächsblatt
            </a>
          </div>

          {/* ── FORTSCHRITT ──────────────────────────────────────────── */}
          <div className="fi-ob-balken-halter" role="progressbar"
               aria-valuenow={prozent} aria-valuemin={0} aria-valuemax={100}
               aria-label="Fortschritt der Agenda">
            <div className="fi-ob-balken" style={{ width: `${prozent}%` }} />
          </div>
          <p className="fi-ob-balken-text">
            {stand.erledigt.length} von {AGENDA.length} Schritten · {prozent} %
          </p>

          {/* ── DIE AGENDA ───────────────────────────────────────────── */}
          <ol className="fi-ob-agenda">
            {AGENDA.map((a, i) => {
              const getan = stand.erledigt.includes(a.key);
              const auf = offen === a.key;
              const notiz = stand.notizen[a.key] ?? "";
              const notizFehlt = a.notizPflicht && getan && notiz.trim().length < 10;
              return (
                <li key={a.key} className="fi-ob-schritt" data-getan={getan ? "ja" : undefined}
                    data-auf={auf ? "ja" : undefined}>
                  <div className="fi-ob-schritt-kopf">
                    <button type="button" onClick={() => abhaken(a.key)}
                            aria-label={getan ? `${a.titel} wieder öffnen` : `${a.titel} abhaken`}
                            aria-pressed={getan}
                            className="fi-ob-haken" data-an={getan ? "ja" : undefined}>
                      {getan ? <Haken /> : <span className="fi-ob-nr">{i + 1}</span>}
                    </button>
                    {/* ── ZWEI KNÖPFE, ZWEI NAMEN ──────────────────────────
                        Der Haken links und dieser Titel trugen beide den
                        Schritt-Namen. Für einen Screenreader (und für den
                        Prüfstand) waren sie damit nicht unterscheidbar: „Wähle
                        ‚Fahrplan erklärt'" — welchen von beiden?
                        Aufgefallen beim Browserlauf, der den falschen traf. */}
                    <button type="button" onClick={() => setOffen(auf ? null : a.key)}
                            aria-label={`${a.titel} — Anleitung ${auf ? "zuklappen" : "aufklappen"}`}
                            className="fi-ob-schritt-titel" aria-expanded={auf}>
                      <span>{a.titel}</span>
                      {a.notizPflicht && <span className="fi-ob-pflicht">Notiz nötig</span>}
                      {notizFehlt && <span className="fi-ob-mahnt">Notiz fehlt</span>}
                    </button>
                  </div>
                  {auf && (
                    <div className="fi-ob-schritt-koerper">
                      <p className="fi-ob-zweck">{a.zweck}</p>
                      <ul className="fi-ob-punkte">
                        {a.punkte.map((punkt) => <li key={punkt}>{punkt}</li>)}
                      </ul>
                      {/* ══════════════════════════════════════════════════
                          DIE KERNBOTSCHAFT — FÜR DAS KUNDENGESPRÄCH

                          Genau an diesem Schritt („Abo-Klarheit") wird sie
                          gebraucht: Der Mitarbeiter erklärt dem Kunden die
                          laufenden Kosten, und dabei gehört der Satz über
                          Bonität und SCHUFA-Meldung dazu — im freigegebenen
                          Wortlaut, nicht in eigenen Worten.

                          Sie steht hier eingeblendet und nicht als Link: Wer
                          im Gespräch eine Seite wechseln muss, sagt den Satz
                          aus dem Gedächtnis. Und dann fehlt die Hälfte.

                          Dasselbe Bauteil wie in der Academy — eine zweite
                          Fassung wären zwei Sätze, die auseinanderlaufen.
                          ══════════════════════════════════════════════════ */}
                      {a.key === "abo_klarheit" && (
                        <div style={{ margin: "12px 0 14px" }}>
                          <p style={{
                            margin: "0 0 8px", fontSize: 11, fontWeight: 700,
                            letterSpacing: ".1em", textTransform: "uppercase",
                            color: "var(--fi-text-still)",
                          }}>
                            Das sagst du dem Kunden — wörtlich
                          </p>
                          <KernbotschaftKarte />
                        </div>
                      )}
                      <textarea
                        value={notiz}
                        onChange={(e) => notieren(a.key, e.target.value)}
                        rows={2}
                        placeholder={a.notizFrage || "Notiz zu diesem Schritt (freiwillig)"}
                        aria-label={`Notiz zu ${a.titel}`}
                        className="fi-ob-notiz"
                      />
                      {a.notizPflicht && (
                        <p className="fi-ob-notiz-fuss" data-fehlt={notizFehlt ? "ja" : undefined}>
                          {notiz.trim().length >= 10
                            ? "Steht im Protokoll."
                            : `Pflicht — noch ${Math.max(0, 10 - notiz.trim().length)} Zeichen`}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* ── DIE LAGE DES KUNDEN ─────────────────────────────────── */}
          {lage && (
            <div className="fi-ob-lage">
              <p className="fi-ob-lage-titel">Was wir über ihn wissen</p>
              {lage.dokumente?.fehlt?.length
                ? <p className="fi-ob-lage-zeile" data-warn="ja">
                    Es fehlt: {lage.dokumente.fehlt.join(", ")}
                  </p>
                : <p className="fi-ob-lage-zeile">Unterlagen sind vollständig.</p>}
              {lage.bonitaet && <p className="fi-ob-lage-zeile">Bonitätsauskunft: {lage.bonitaet}</p>}
            </div>
          )}
        </>
      }
    />
  );
}

const COCKPIT_CSS = `
/* ── DIE NUMMER IM KOPF (19.08.2026) ─────────────────────────────────────
   Sie wird zur Terminzeit abgelesen und abgetippt. Deshalb 19 px,
   tabellarische Ziffern (damit die Gruppen untereinander stehen) und genug
   Abstand, um sie mit dem Finger zu treffen. */
.fi-ob-nummer-zeile{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}
.fi-ob-nummer{
  font-size:19px;font-weight:700;letter-spacing:.01em;
  font-variant-numeric:tabular-nums;color:#0f172a;text-decoration:none;
  padding:2px 0;border-bottom:1px solid rgba(15,23,42,.14);
}
.fi-ob-nummer:hover{border-bottom-color:#1d4ed8;color:#1d4ed8}
.fi-ob-nummer-knopf{
  display:inline-flex;align-items:center;gap:6px;flex-shrink:0;
  padding:5px 12px;border-radius:999px;border:0;cursor:pointer;
  font-size:12px;font-weight:700;color:#fff;background:#1d4ed8;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18);
}
.fi-ob-nummer-knopf:hover{background:#1e40af}
/* Keine Nummer heißt: Dieses Gespräch kann nicht stattfinden. Das ist ein
   Hinweis in Bernstein, keine graue Nebenbemerkung. */
.fi-ob-nummer-fehlt{
  margin-top:8px;font-size:12.5px;font-weight:600;line-height:1.45;color:#b45309;
}

.fi-ob-ueber { margin:0; font-size:11px; font-weight:700; letter-spacing:.08em;
  text-transform:uppercase; color:rgba(71,85,105,.7); }
.fi-ob-titel { margin:3px 0 0; font-size:19px; font-weight:800; letter-spacing:-.02em; color:#0f172a; }
.fi-ob-unter { margin:2px 0 0; font-size:12.5px; color:#64748b; }

.fi-ob-leiste { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
.fi-ob-anrufen { display:inline-flex; align-items:center; gap:7px; min-height:38px; padding:0 14px;
  border:0; border-radius:11px; background:#1d4ed8; color:#fff; font-size:13px; font-weight:700; }
.fi-ob-anrufen:hover { background:#1e40af; }
.fi-ob-uhr { font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; color:#334155;
  padding:0 10px; min-height:38px; display:inline-flex; align-items:center; border-radius:10px;
  background:rgba(15,23,42,.04); }
.fi-ob-uhr[data-ueber="ja"] { color:#b45309; background:rgba(180,83,9,.09); }
.fi-ob-blatt { margin-left:auto; font-size:12.5px; font-weight:600; color:#1d4ed8;
  text-decoration:underline; text-underline-offset:2px; }

.fi-ob-balken-halter { height:4px; border-radius:99px; background:rgba(15,23,42,.07); overflow:hidden; }
.fi-ob-balken { height:100%; border-radius:99px; background:linear-gradient(90deg,#2563eb,#1d4ed8);
  transition:width 320ms cubic-bezier(.32,.72,0,1); }
.fi-ob-balken-text { margin:6px 0 16px; font-size:11.5px; color:#64748b; font-variant-numeric:tabular-nums; }

.fi-ob-agenda { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.fi-ob-schritt { border:1px solid rgba(15,23,42,.08); border-radius:14px; background:#fff;
  transition:border-color 200ms, box-shadow 200ms; }
.fi-ob-schritt[data-auf="ja"] { border-color:rgba(37,99,235,.28); box-shadow:0 1px 3px rgba(15,23,42,.06); }
.fi-ob-schritt[data-getan="ja"] { background:rgba(5,150,105,.035); border-color:rgba(5,150,105,.2); }
.fi-ob-schritt-kopf { display:flex; align-items:center; gap:10px; padding:11px 13px; }
.fi-ob-haken { width:28px; height:28px; border-radius:9px; flex-shrink:0; display:inline-flex;
  align-items:center; justify-content:center; border:1px solid rgba(15,23,42,.14);
  background:#fff; color:#94a3b8; }
.fi-ob-haken[data-an="ja"] { background:#059669; border-color:#059669; color:#fff; }
.fi-ob-nr { font-size:12px; font-weight:700; color:#94a3b8; }
.fi-ob-schritt-titel { flex:1; min-width:0; text-align:left; background:none; border:0;
  font-size:13.5px; font-weight:700; color:#0f172a; display:flex; align-items:center;
  gap:8px; flex-wrap:wrap; }
.fi-ob-pflicht { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
  color:#64748b; background:rgba(15,23,42,.05); padding:2px 6px; border-radius:6px; }
.fi-ob-mahnt { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
  color:#b45309; background:rgba(180,83,9,.1); padding:2px 6px; border-radius:6px; }
.fi-ob-schritt-koerper { padding:0 13px 13px 51px; }
.fi-ob-zweck { margin:0 0 8px; font-size:12.5px; color:#475569; line-height:1.5; }
.fi-ob-punkte { margin:0 0 10px; padding-left:16px; display:grid; gap:5px; }
.fi-ob-punkte li { font-size:13px; line-height:1.5; color:#0f172a; }
.fi-ob-notiz { width:100%; border-radius:10px; padding:8px 10px; font-size:13px; line-height:1.5;
  color:#0f172a; background:#f8fafc; border:1px solid rgba(15,23,42,.1); outline:none; resize:vertical; }
.fi-ob-notiz:focus { border-color:rgba(37,99,235,.45); background:#fff; }
.fi-ob-notiz-fuss { margin:4px 0 0; font-size:11px; color:#94a3b8; }
.fi-ob-notiz-fuss[data-fehlt="ja"] { color:#b45309; font-weight:600; }

.fi-ob-lage { margin-top:16px; padding:12px 14px; border-radius:14px;
  border:1px solid rgba(15,23,42,.08); background:#f8fafc; }
.fi-ob-lage-titel { margin:0 0 6px; font-size:10.5px; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; color:#94a3b8; }
.fi-ob-lage-zeile { margin:0; font-size:12.5px; color:#475569; line-height:1.6; }
.fi-ob-lage-zeile[data-warn="ja"] { color:#b45309; font-weight:600; }

.fi-ob-fuss { width:100%; }
.fi-ob-fehler { margin:0 0 8px; font-size:12.5px; font-weight:600; color:#b91c1c; }
.fi-ob-fuss-zeile { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.fi-ob-knopf-still { min-height:44px; padding:0 14px; border-radius:12px; border:1px solid rgba(15,23,42,.12);
  background:#fff; font-size:13px; font-weight:600; color:#475569; }
.fi-ob-knopf-haupt { margin-left:auto; min-height:44px; padding:0 18px; border:0; border-radius:12px;
  background:rgba(15,23,42,.22); color:#fff; font-size:14px; font-weight:700; }
.fi-ob-knopf-haupt[data-bereit="ja"] { background:#059669; }
.fi-ob-knopf-haupt:disabled { opacity:.5; }
.fi-ob-fuss-hinweis { margin:7px 0 0; font-size:11.5px; color:#94a3b8; }

/* ── 380 px ────────────────────────────────────────────────────────────────
   Der Abschluss-Knopf darf nie außerhalb des Bildes liegen; deshalb rutschen
   die beiden Knöpfe untereinander und der Hauptknopf nach oben. */
@media (max-width: 460px) {
  .fi-ob-schritt-koerper { padding-left:13px; }
  .fi-ob-fuss-zeile { flex-direction:column-reverse; align-items:stretch; }
  .fi-ob-knopf-haupt { margin-left:0; width:100%; }
  .fi-ob-knopf-still { width:100%; }
  .fi-ob-blatt { margin-left:0; }
}
@media (prefers-reduced-motion: reduce) { .fi-ob-balken { transition:none; } }
`;
