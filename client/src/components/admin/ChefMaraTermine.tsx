// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara?reiter=termine — MARAS TERMINE (29.09.2026, E-260)
//
// Justin: „ALLE Termine, die MARA macht, muss ich sehen können als Chef auf
// einer eigenen übersichtlichen cleanen Seite — ich arbeite gerade alleine an
// den Kunden, meine einzige Aufgabe ist es, so viel Geld wie möglich
// reinzuholen … Die anderen Mitarbeiter arbeiten erst wieder am Freitag. Bis
// dahin schupfe ich das ganze."
//
// Keine neue Chef-Seite (Hausregel „Keine neuen Chef-Seiten"): der vierte
// Reiter im Mara-Steuerpult, mit eigener Adresse (?reiter=termine,
// &termin=<id> springt zur Zeile). Von oben nach unten:
//   · Statuszeile mit EINEM Schalter: „Team abwesend — Mara bucht bei dir"
//     (bis wann, wer anruft, für wen). Mara bucht dann neue Rückrufe nur in
//     den Kalender des Vertreters; die Kunden bleiben bei ihren Betreuern.
//   · Filter: Alle Termine | Nur Mara | Bei Abwesenden.
//   · Jetzt — die EINE Glasfläche: wen du als Nächstes anrufst (ein Termin,
//     der gerade dran ist; sonst der dringendste wartende Kunde; sonst der
//     nächste Termin — fokusArt in shared/) mit Geld, Maras Zusage, Anrufen,
//     Akte, Erledigt, Nicht erreicht.
//   · Kunde wartet (rot gerahmt) · Heute · Morgen · Diese Woche · Später ·
//     Erledigt & abgesagt (die letzten beiden eingeklappt).
//   · Rückruf-Notizen des Teams und Maras Übergaben an Abwesende.
// Bausteine aus E-252 (mara-lage.tsx, chef-mara.css): Statuszeile, Schalter,
// Pillen, Klappen, Meldung am Auslöser, eine Glasfläche. Die Daten holt die
// Wurzel des Steuerpults (Quelle „termine", jede Minute bei offenem Reiter).
// Server: GET /chef/mara/termine, POST /chef/mara/abwesenheit,
// POST /chef/mara/termine/:id/ergebnis (server/routes/fiaon-mara-steuerpult.ts).
// E-263 (29.09.2026): darunter die Karte „Termine in deinem Kalender" (.mt-abo) —
// zwei Kalender-Abos (meine / alle des Teams), GET/POST /chef/mara/kalender-abo.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API, eur, zahl, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { useMaraDaten, useMaraLage, useMaraRundgang, useMeldung, Meldung, InfoKnopf, MARA_QUELLEN, berlinTag, uhrBerlin, tagNur } from "./mara-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  gruppieren, filtern, istOffen, istWartend, fokusArt, TERMIN_GRUPPEN, VERPASST_OFFEN_TAGE,
  type TerminUebersicht, type TerminZeile, type TerminFilter, type TerminGruppe, type AbwesenheitSicht,
} from "@shared/fiaon-termin-uebersicht";
import { KALENDER_TEXT, kalenderZustandSatz, type KalenderAboSicht, type KalenderAboUmfang } from "@shared/fiaon-kalender-abo";

async function post(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt — bitte noch einmal.");
  return j;
}

/** Telefon in der Hand? Dann speichert „Anrufen" zuerst den Kontakt (wie in der Telefonkartei). */
function istHandy(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || !!window.matchMedia?.("(pointer: coarse)").matches;
}

const WOCHE = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short" });
const wtag = (d: Date) => WOCHE.format(d).replace(/\.$/, "");
/** „heute", „morgen", „gestern" oder „Mi 30.09." (Berliner Zeit). */
function tagWort(iso: string): string {
  const d = new Date(iso);
  const t = berlinTag(d);
  if (t === berlinTag()) return "heute";
  if (t === berlinTag(new Date(Date.now() + 86_400_000))) return "morgen";
  if (t === berlinTag(new Date(Date.now() - 86_400_000))) return "gestern";
  return `${wtag(d)} ${tagNur(t)}`;
}
/** „seit 10:00", „seit gestern 10:00", „seit Mi 23.09. 10:00" — für wartende Kunden. */
function seit(iso: string): string {
  const w = tagWort(iso);
  return `seit ${w === "heute" ? uhrBerlin(iso) : `${w} ${uhrBerlin(iso)}`}`;
}
/** „in 42 Min.", „läuft seit 5 Min.", „in 3 Std." */
function abstand(iso: string): string {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (min > 0) return min < 90 ? `in ${min} Min.` : min < 24 * 60 ? `in ${Math.round(min / 60)} Std.` : tagWort(iso);
  if (min > -20) return min === 0 ? "jetzt" : `läuft seit ${-min} Min.`;
  return `seit ${tagWort(iso) === "heute" ? uhrBerlin(iso) : `${tagWort(iso)} ${uhrBerlin(iso)}`}`;
}

const STUFE_KURZ: Record<string, string> = { A: "A", B: "B", C: "C", rate: "Rate", bezahlt: "bezahlt", abbrecher: "Abbrecher", ausgeschlossen: "gesperrt", storniert: "storniert" };
const STUFE_TON: Record<string, string> = { A: "warn", B: "akz", rate: "warn", C: "", bezahlt: "gut" };

function geldText(t: TerminZeile): string | null {
  const g = t.geld;
  if (!g || !g.betragCents) return null;
  if (g.art === "rate") return `Rate ${g.rateNr ?? ""} · ${eur(g.betragCents)} fällig${g.faelligAm ? ` seit ${tagNur(g.faelligAm)}` : ""}`.replace("Rate  ·", "Rate ·");
  return `${eur(g.betragCents)} offen`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE ZEILE (und groß: die Glasfläche „Jetzt")
// ═══════════════════════════════════════════════════════════════════════════
function Termin({ t, gross, busy, frage, handy, gespeichert, onGespeichert, onErgebnis, onFrage }: {
  t: TerminZeile; gross?: boolean; busy: string | null; frage: number | null; handy: boolean; gespeichert: boolean;
  onGespeichert: (personId: number) => void; onErgebnis: (t: TerminZeile, e: "erledigt" | "verpasst") => void; onFrage: (id: number | null) => void;
}) {
  const offen = istOffen(t);
  // E-260 (Gegenprüfung 29.09.): auch in der Glasfläche (gruppe „jetzt") kann ein wartender Kunde stehen.
  const wartet = istWartend(t, new Date());
  const tel = t.telefonWaehlbar ? `tel:${t.telefonWaehlbar}` : null;
  const zuerstSpeichern = handy && !gespeichert && !!tel;
  const anruf = zuerstSpeichern ? `${API}/chef/telefonkartei/${t.person.id}/kontakt.vcf` : tel;
  const geld = geldText(t);
  const stufe = t.person.stufe ? STUFE_KURZ[t.person.stufe] ?? t.person.stufe : null;
  const statusPille = t.status === "erledigt" ? { text: "erledigt", ton: "gut" }
    : t.status === "abgesagt" ? { text: t.abgesagtVon === "verschoben" ? "verschoben" : "abgesagt", ton: "" }
    : t.status === "verpasst" ? { text: t.abgeschlossen ? "nicht erreicht" : "verpasst — offen", ton: t.abgeschlossen ? "" : "krit" } : null;
  const beiText = `bei ${t.bei.vorname}${t.bei.istVertreter ? " (du)" : ""}`;
  // Maras Anliegen — fehlt es (z. B. ein Termin aus einer Mail ohne Protokoll), die Notiz des Termins.
  const anliegen = t.mara ? (t.mara.anliegen ?? t.notiz) : gross ? t.notiz : null;
  const betreuerText = t.betreuer && t.betreuer.id !== t.bei.id ? `Betreuer ${t.betreuer.vorname}` : null;

  return (
    <article className={`mt-termin${gross ? " gross" : ""}${wartet ? " wartet" : ""}${offen ? "" : " zu"}`} data-termin={t.id} tabIndex={-1}>
      <div className="mt-zeit">
        {gross ? (
          <>
            <span className="mt-uhr">{uhrBerlin(t.beginn)}</span>
            <span className="mt-wann">{wartet ? (t.status === "verpasst" ? "verpasst" : "über der Zeit") : abstand(t.beginn)}</span>
          </>
        ) : wartet ? (
          <>
            <span className="mt-uhr">{uhrBerlin(t.beginn)}</span>
            <span className="mt-wann">{tagWort(t.beginn) === "heute" ? "wartet" : tagWort(t.beginn)}</span>
          </>
        ) : (
          <>
            <span className="mt-uhr">{uhrBerlin(t.beginn)}</span>
            {t.gruppe !== "heute" && t.gruppe !== "jetzt" ? <span className="mt-wann">{tagWort(t.beginn)}</span> : null}
          </>
        )}
      </div>
      <div className="mt-inhalt">
        <div className="mt-kopf">
          <span className="mt-name">{t.person.name}</span>
          {stufe && <span className={`mara-pille ${STUFE_TON[t.person.stufe ?? ""] ?? ""}`} title={t.person.stufeText ?? undefined}>{stufe}</span>}
          {t.mara && <span className="mara-pille akz" title={`${t.weg.text}`}>{t.mara.text} · {t.mara.kanal}</span>}
          {t.neu && offen && <span className="mara-pille">neu</span>}
          {t.beiAbwesendem && <span className="mara-pille warn" title={`${t.bei.vorname} ist nicht im Haus — du rufst an. Der Kunde bleibt bei ${t.betreuer?.vorname ?? t.bei.vorname}.`}>Betreuer abwesend — du rufst an</span>}
          {statusPille && <span className={`mara-pille ${statusPille.ton}`}>{statusPille.text}</span>}
          {t.mara && t.mara.pruefungOk === false && <span className="mara-pille krit" title={t.mara.pruefung ?? undefined}>Prüfung rot</span>}
        </div>
        <p className="mt-zeile">
          {[geld ? <b key="g" className="mt-geld">{geld}</b> : null,
            <span key="b">{beiText}</span>,
            betreuerText ? <span key="be">{betreuerText}</span> : null,
            <span key="a">{t.art.text}</span>,
            wartet && !gross ? <span key="w" className="mara-krit-t">wartet {seit(t.beginn)}</span> : null,
          ].filter(Boolean).reduce<ReactNode[]>((acc, x, i) => (i ? [...acc, <span key={`p${i}`} className="mt-punkt" aria-hidden="true">·</span>, x] : [x]), [])}
        </p>
        {t.mara?.zusage && (
          <blockquote className="mt-zusage" title="Maras Zusage an den Kunden — ihre WhatsApp nach der Buchung mit genau dieser Zeit">„{t.mara.zusage}“</blockquote>
        )}
        {t.mara?.verschobenVon && (
          <p className="mt-anliegen mara-warn-t" title="Ein Mensch hat die Zeit nach Maras Buchung geändert — ihre Zusage an den Kunden nannte die alte Zeit.">
            Seit Maras Zusage verschoben (vorher {tagWort(t.mara.verschobenVon)}, {uhrBerlin(t.mara.verschobenVon)})
          </p>
        )}
        {anliegen && (
          <p className="mt-anliegen"><span className="mara-still">Anliegen:</span> {anliegen}</p>
        )}
        {t.gleichzeitigMit.length > 0 && offen && (
          <p className="mt-gleich mara-warn-t">gleichzeitig: {t.gleichzeitigMit.map((g) => `${g.uhrzeit} bei ${g.bei}`).join(" · ")}</p>
        )}
        {offen && (
          <div className="mt-knoepfe">
            {anruf
              ? <a className="mara-knopf haupt" href={anruf} onClick={() => { if (zuerstSpeichern) onGespeichert(t.person.id); }}>
                  {zuerstSpeichern ? "Anrufen · Kontakt sichern" : "Anrufen"}{t.telefonAnzeige && !handy ? <span className="mt-nummer">{t.telefonAnzeige}</span> : null}
                </a>
              : <span className="mara-knopf" aria-disabled="true" title="Keine wählbare Nummer hinterlegt">Keine Nummer</span>}
            {t.akteLink && <a className="mara-knopf" href={t.akteLink} target="_blank" rel="noreferrer">Akte</a>}
            {t.abschliessbar ? (
              <>
                <button type="button" className="mara-knopf" disabled={!!busy} onClick={() => onErgebnis(t, "erledigt")}>
                  {busy === `e${t.id}` ? "Speichert …" : "Erledigt"}
                </button>
                <button type="button" className="mara-knopf" disabled={!!busy} aria-expanded={frage === t.id} onClick={() => onFrage(frage === t.id ? null : t.id)}>
                  Nicht erreicht
                </button>
              </>
            ) : <span className="mara-still mara-klein mt-hinweis">{t.art.text === "FIAON Global" ? "im Firmen-Cockpit abschließen" : "Startgespräch — in der Akte abschließen"}</span>}
          </div>
        )}
        {frage === t.id && offen && (
          <div className="mara-rueckfrage mt-frage" role="group" aria-label="Nicht erreicht bestätigen">
            Zählt als erfolgloser Anrufversuch — ab dem sechsten bekommt der Kunde die Mail mit seinem Terminlink.{t.mara && t.mara.weg !== "mara_mail" ? " Schreibt er Mara wieder, bietet sie ihm von sich aus neue Zeiten an." : ""}
            <div className="mara-knoepfe">
              <button type="button" className="mara-knopf warn" disabled={!!busy} onClick={() => onErgebnis(t, "verpasst")}>{busy === `v${t.id}` ? "Speichert …" : "Ja, nicht erreicht"}</button>
              <button type="button" className="mara-knopf" onClick={() => onFrage(null)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ABWESENHEIT — Schalter, Auswahl, Zustand
// ═══════════════════════════════════════════════════════════════════════════
function Abwesenheit({ a, neu, melden }: { a: AbwesenheitSicht; neu: () => void; melden: (t: string, f?: boolean) => void }) {
  const [waehlen, setWaehlen] = useState(false);
  const [bisWahl, setBisWahl] = useState<string>("");
  const [eigen, setEigen] = useState("");
  const [vertreter, setVertreter] = useState<number | null>(null);
  const [einzelne, setEinzelne] = useState(false);
  const [fuer, setFuer] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  // Vorgabe beim Öffnen: der nächste Freitag 09:00 (sonst der erste Vorschlag), der bisherige Vertreter, „für alle".
  const oeffnen = () => {
    const fr = a.vorschlaege.find((v) => v.text.startsWith("Fr")) ?? a.vorschlaege[0];
    setBisWahl(a.gesetzt && a.bis ? "bisher" : fr?.iso ?? "eigen");
    setVertreter(a.vertreter?.id ?? a.kandidaten[0]?.id ?? null);
    setEinzelne(a.fuer.length > 0);
    setFuer(a.fuer);
    setWaehlen(true);
  };
  const bisIso = bisWahl === "bisher" ? a.bis : bisWahl === "eigen" ? (eigen ? eigen.replace("T", " ") : null) : bisWahl || null;

  const setzen = async (an: boolean) => {
    if (an && !bisIso) { melden("Bitte sag, bis wann das Team weg ist.", true); return; }
    setBusy(true);
    try {
      const j = await post("/chef/mara/abwesenheit", an ? { an: true, bis: bisIso, vertreterId: vertreter, fuer: einzelne ? fuer : [] } : { an: false });
      melden(an ? `Aktiv — ${j.was?.replace(/^(an|geändert): /, "") ?? "Mara bucht bei dir"}. Die Kunden bleiben bei ihren Betreuern.` : "Beendet — Mara bucht wieder bei den Betreuern.");
      setWaehlen(false);
      neu();
    } catch (e: any) { melden(e.message, true); } finally { setBusy(false); }
  };

  const bisText = a.bis ? a.vorschlaege.find((v) => v.iso === a.bis)?.text ?? tagZeitKurz(a.bis) : null;
  const frei = a.an && a.freieBisEnde != null
    ? (a.freieHeute ? `heute noch ${zahl(a.freieHeute)} ${a.freieHeute === 1 ? "Platz" : "Plätze"} frei` : a.freieBisEnde ? `heute nichts mehr frei · bis dahin ${zahl(a.freieBisEnde)} Plätze` : "bis dahin kein Platz frei — Mara übergibt dann an dich")
    : null;

  return (
    <div className="mt-abw">
      <div className="mara-status mt-status" aria-label="Team und Vertretung">
        <div className="st voll">
          <button type="button" className={`mara-schalter mt-schalter${a.an ? " an" : ""}`} data-mara-schalter="termine" aria-pressed={a.an} disabled={busy}
            onClick={() => (a.an ? void setzen(false) : waehlen ? setWaehlen(false) : oeffnen())}>
            <span className="bahn" aria-hidden="true" />
            <span>{a.an ? "Team abwesend — Mara bucht bei dir" : "Team im Haus — Mara bucht bei den Betreuern"}</span>
          </button>
          <InfoKnopf offen={infoOffen} onClick={() => setInfoOffen((x) => !x)} label="Was der Schalter tut" />
        </div>
        {a.an && a.vertreter ? (
          <div className="st mt-st-text">
            <div className="st-text">
              <div>bis {bisText} · {a.vertreter.name} ruft an</div>
              <small>{[a.zeitenHeute ? `Zeiten heute ${a.zeitenHeute}` : "heute keine Zeiten eingetragen", frei].filter(Boolean).join(" · ")}</small>
            </div>
          </div>
        ) : !a.gesetzt && a.endeteAm ? (
          <div className="st mt-st-text"><div className="st-text"><div>{a.endeteWie === "abgelaufen" ? "Abwesenheit endete" : "Beendet"} {tagZeitKurz(a.endeteAm)}</div><small>Mara bucht wieder bei den Betreuern.</small></div></div>
        ) : null}
        {a.an ? (
          <div className="st rechts">
            <button type="button" className="mara-knopf klein" disabled={busy} onClick={() => (waehlen ? setWaehlen(false) : oeffnen())}>Ändern</button>
            <button type="button" className="mara-knopf klein" disabled={busy} onClick={() => void setzen(false)}>{busy ? "…" : "Beenden"}</button>
          </div>
        ) : !a.gesetzt && a.endeteAm && a.endeteWie === "abgelaufen" ? (
          <div className="st rechts"><button type="button" className="mara-knopf klein" disabled={busy} onClick={oeffnen}>Verlängern</button></div>
        ) : null}
      </div>
      {infoOffen && (
        <p className="mara-info">
          <b>Solange der Schalter an ist,</b> bucht Mara neue Rückrufe (WhatsApp und Mail) nur in den Kalender von {a.vertreter?.name ?? "dir"} — in {a.vertreter?.vorname ?? "deinem"} Raster, mit 20 Minuten Vorlauf, und nie gleichzeitig mit einem Termin, den du für das Team anrufst.
          {" "}Sie nennt dem Kunden den, der wirklich anruft; statt eines Terminlinks bietet sie zwei Zeiten an. Maras Übergaben landen auf deinem Board. <b>Die Kunden bleiben bei ihren Betreuern</b> — auch die eines gesperrten Betreuers: keine Zuordnung, keine Provision, keine Verteilung ändert sich.
          {" "}Zeiten nach „bis“ bucht Mara wieder wie sonst — beim Betreuer, ohne Betreuer im Team. Nach „bis“ ist der Schalter von selbst aus.
        </p>
      )}
      {a.gesetzt && !a.an && a.problem && (
        <div className="mara-hinweise"><p className="mara-hinweis krit"><span className="mara-punkt krit" aria-hidden="true" /><span>Die Abwesenheit ist gesetzt, greift aber nicht: {a.problem} Bis das behoben ist, bucht Mara wie ohne Abwesenheit.</span></p></div>
      )}
      {a.an && a.abwesend.length > 0 && (
        <p className="mara-still mara-klein mt-leise">Abwesend: {a.abwesend.map((x) => x.vorname).join(", ")}. Kunden bleiben bei ihren Betreuern.</p>
      )}

      {waehlen && (
        <div className="mt-wahl" role="group" aria-label="Abwesenheit einstellen">
          <div className="mara-feld">
            <label htmlFor="mt-bis">Team weg bis</label>
            <select id="mt-bis" className="mara-eingabe" value={bisWahl} onChange={(e) => setBisWahl(e.target.value)}>
              {a.gesetzt && a.bis ? <option value="bisher">wie bisher · {bisText}</option> : null}
              {a.vorschlaege.map((v) => <option key={v.iso} value={v.iso}>{v.text}</option>)}
              <option value="eigen">eigene Zeit …</option>
            </select>
            {bisWahl === "eigen" && (
              <input type="datetime-local" className="mara-eingabe" value={eigen} onChange={(e) => setEigen(e.target.value)} aria-label="Eigene Zeit (Berliner Zeit)" />
            )}
            <small>Danach bucht Mara wieder bei den Betreuern — der Schalter geht von selbst aus.</small>
          </div>
          <div className="mara-feld">
            <label htmlFor="mt-vertreter">Wer ruft an</label>
            <select id="mt-vertreter" className="mara-eingabe" value={vertreter ?? ""} onChange={(e) => setVertreter(Number(e.target.value) || null)}>
              {a.kandidaten.map((k) => <option key={k.id} value={k.id} disabled={!k.zeiten}>{k.name}{k.zeiten ? "" : " — keine Zeiten eingetragen"}</option>)}
            </select>
            <small>Mara bucht in dessen Kalender und Raster.</small>
          </div>
          <div className="mara-feld breit">
            <span className="mara-feld-titel">Für wen</span>
            <div className="mara-reihe">
              <button type="button" className={`mara-knopf klein${!einzelne ? " an" : ""}`} aria-pressed={!einzelne} onClick={() => setEinzelne(false)}>das ganze Team</button>
              <button type="button" className={`mara-knopf klein${einzelne ? " an" : ""}`} aria-pressed={einzelne} onClick={() => setEinzelne(true)}>nur einzelne</button>
            </div>
            {einzelne && (
              <div className="mara-reihe mt-team">
                {a.team.filter((t) => t.id !== vertreter).map((t) => {
                  const drin = fuer.includes(t.id);
                  return (
                    <button key={t.id} type="button" className={`mara-knopf klein${drin ? " an" : ""}`} aria-pressed={drin}
                      onClick={() => setFuer((f) => (drin ? f.filter((x) => x !== t.id) : [...f, t.id]))}>{t.vorname}</button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mara-startreihe">
            <button type="button" className="mara-knopf haupt" disabled={busy || !bisIso || !vertreter || (einzelne && fuer.length === 0)} onClick={() => void setzen(true)}>
              {busy ? "Speichert …" : a.an ? "Übernehmen" : "Team abwesend — Mara bucht bei mir"}
            </button>
            <button type="button" className="mara-knopf" onClick={() => setWaehlen(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINE IN DEINEM KALENDER (29.09.2026, E-263)
//
// Justin: „… ‚Alle Termine zu Kalender hinzufügen' … pflegen sich automatisch
// ein … wenn ich nochmal drauf klicke und 1 neuer Termin ist hinzugekommen dann
// nur der 1 Termin, nicht alle anderen doppelt."
// Zwei ABOS (kein Import — nichts doppelt): „Meine Termine" (dein Konto:
// Gründer + Vertretung) und „Termine des Teams" (die der Mitarbeiter, OHNE
// deine). Sie überschneiden sich nicht: Wer beide abonniert, hat jeden Termin
// genau einmal (Gegenprüfung 29.09.2026 — vorher stand jeder Gründer-Termin in
// beiden). Je iPhone/Mac, Google, Link kopieren, Zustand, neuer Link, beenden.
// Zugeklappt, damit die Liste unten bleibt; die Zeile sagt den Zustand in Worten.
// ═══════════════════════════════════════════════════════════════════════════
type AboAntwort = { ok: true; eingerichtet: boolean; eigene: KalenderAboSicht | null; team: KalenderAboSicht | null };
const ABO_TITEL: Record<KalenderAboUmfang, { titel: string; satz: string }> = {
  eigene: { titel: "Meine Termine", satz: "Alles, was bei deinem Konto steht — Gründer-Gespräche und die Rückrufe, die Mara in Abwesenheit bei dir bucht." },
  team: { titel: "Termine des Teams (ohne deine)", satz: "Jeder Termin der Mitarbeiter, mit dem Namen vorn. Deine eigenen stehen nur unter „Meine Termine“." },
};

function KalenderAbos() {
  const d = useDaten<AboAntwort>("/chef/mara/kalender-abo");
  const [abos, setAbos] = useState<Partial<Record<KalenderAboUmfang, KalenderAboSicht | null>>>({});
  const [frage, setFrage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);
  const { meldung, melden, zu } = useMeldung();

  const abo = (u: KalenderAboUmfang): KalenderAboSicht | null => (u in abos ? abos[u] ?? null : d.daten?.[u] ?? null);
  const kurz = (u: KalenderAboUmfang) => {
    const a = abo(u);
    return !a ? "aus" : a.aktiv ? "aktiv" : a.zuletztAbgerufenAm ? "ruht" : "nicht abonniert";
  };
  const kopieren = async (a: KalenderAboSicht) => {
    try { await navigator.clipboard.writeText(a.links.ics); melden("Link kopiert. In Outlook: Kalender hinzufügen → Aus dem Internet → einfügen.", "abo"); }
    catch { melden(`Kopieren ging nicht — bitte markieren: ${a.links.ics}`, "abo", true); }
  };
  const aendern = async (u: KalenderAboUmfang, aktion: "erneuern" | "beenden") => {
    setBusy(`${u}:${aktion}`);
    try {
      const j = await post(`/chef/mara/kalender-abo/${u}/${aktion}`, {});
      setAbos((x) => ({ ...x, [u]: j.abo ?? null }));
      melden(aktion === "beenden" ? `${ABO_TITEL[u].titel}: Abo beendet — der Kalender wird beim nächsten Abruf leer; danach kannst du ihn dort löschen.`
        : `${ABO_TITEL[u].titel}: neuer Link — der alte gilt nicht mehr. Einmal neu abonnieren und das alte, leere Abo im Kalender löschen.`, "abo");
      setFrage(null);
    } catch (e: any) { melden(e.message, "abo", true); } finally { setBusy(null); }
  };
  const neuEinrichten = (u: KalenderAboUmfang) => { setAbos((x) => { const y = { ...x }; delete y[u]; return y; }); d.neu(); };

  return (
    <details className="mara-klappe mt-abo" open={offen} onToggle={(e) => setOffen((e.target as HTMLDetailsElement).open)}>
      <summary>
        Termine in deinem Kalender
        <span className="mara-still">&nbsp;· {d.daten ? (d.daten.eingerichtet ? `Meine: ${kurz("eigene")} · Team: ${kurz("team")}` : "noch nicht eingerichtet") : d.fehler ? "nicht geladen" : "…"}</span>
      </summary>
      {d.fehler && !d.daten ? <Fehlermeldung text={d.fehler} erneut={d.neu} /> : null}
      {d.daten && !d.daten.eingerichtet ? <p className="mara-still mara-klein">Die Tabelle für die Abos fehlt noch (Migration 085). Die Knöpfe in den Termin-Mails funktionieren trotzdem.</p> : null}
      {d.daten?.eingerichtet ? (
        <div className="mt-abo-liste">
          <p className="mara-klein mt-abo-beide">{KALENDER_TEXT.chefBeide}</p>
          {(["eigene", "team"] as KalenderAboUmfang[]).map((u) => {
            const a = abo(u);
            return (
              <section key={u} className="mt-abo-zeile" data-abo={u} aria-label={ABO_TITEL[u].titel}>
                <div className="mt-abo-kopf">
                  <h3>{ABO_TITEL[u].titel}</h3>
                  <p className="mara-still mara-klein">{ABO_TITEL[u].satz}</p>
                </div>
                {a ? (
                  <>
                    <p className={`mt-abo-zustand${a.aktiv ? " aktiv" : ""}`}>{kalenderZustandSatz(a)}</p>
                    <div className="mt-knoepfe">
                      <a className="mara-knopf haupt klein" href={a.links.webcal}>iPhone / Mac</a>
                      <a className="mara-knopf klein" href={a.links.google} target="_blank" rel="noreferrer noopener">Google</a>
                      <button type="button" className="mara-knopf klein" onClick={() => void kopieren(a)}>Link kopieren</button>
                      <button type="button" className="mara-knopf klein" disabled={!!busy} aria-expanded={frage === `${u}:erneuern`} onClick={() => setFrage(frage === `${u}:erneuern` ? null : `${u}:erneuern`)}>Neuen Link erzeugen</button>
                      <button type="button" className="mara-knopf klein" disabled={!!busy} aria-expanded={frage === `${u}:beenden`} onClick={() => setFrage(frage === `${u}:beenden` ? null : `${u}:beenden`)}>Abo beenden</button>
                    </div>
                    {frage === `${u}:erneuern` || frage === `${u}:beenden` ? (
                      <div className="mara-rueckfrage" role="group" aria-label="Bestätigen">
                        {frage.endsWith("erneuern") ? KALENDER_TEXT.neuFrage : KALENDER_TEXT.endeFrage}
                        <div className="mara-knoepfe">
                          <button type="button" className="mara-knopf warn" disabled={!!busy} onClick={() => void aendern(u, frage.endsWith("erneuern") ? "erneuern" : "beenden")}>
                            {busy ? "Speichert …" : frage.endsWith("erneuern") ? "Ja, neuen Link erzeugen" : "Ja, Abo beenden"}
                          </button>
                          <button type="button" className="mara-knopf" onClick={() => setFrage(null)}>Abbrechen</button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-knoepfe"><span className="mara-still mara-klein">Kein Abo aktiv.</span> <button type="button" className="mara-knopf klein" onClick={() => neuEinrichten(u)}>Neu einrichten</button></div>
                )}
              </section>
            );
          })}
          <Meldung m={meldung} ort="abo" onZu={zu} />
          <p className="mara-still mara-klein mt-abo-text">{KALENDER_TEXT.tempo} {KALENDER_TEXT.nichtDoppelt} {KALENDER_TEXT.apple} {KALENDER_TEXT.googleWecker} {KALENDER_TEXT.ohne}</p>
        </div>
      ) : null}
    </details>
  );
}

function tagZeitKurz(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${wtag(d)} ${tagNur(berlinTag(d))}, ${uhrBerlin(d)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER REITER
// ═══════════════════════════════════════════════════════════════════════════
export default function ChefMaraTermine() {
  const d = useMaraDaten<TerminUebersicht>("termine", MARA_QUELLEN.termine);
  const lage = useMaraLage();
  const rg = useMaraRundgang();
  const { meldung, melden, zu } = useMeldung();
  const [filter, setFilter] = useState<TerminFilter>("alle");
  const [busy, setBusy] = useState<string | null>(null);
  const [frage, setFrage] = useState<number | null>(null);
  const [gespeichert, setGespeichert] = useState<number[]>([]);
  const [klappen, setKlappen] = useState<Record<string, boolean>>({});
  const handy = useMemo(istHandy, []);
  const gesprungen = useRef(false);

  const daten = d.daten;
  const zeilen = useMemo(() => (daten ? gruppieren(filtern(daten.termine, filter), new Date()) : []), [daten, filter]);
  const jetzt = zeilen.find((t) => t.gruppe === "jetzt") ?? null;
  const fokus = jetzt ? fokusArt(jetzt, new Date()) : null;
  const je = (g: TerminGruppe) => zeilen.filter((t) => t.gruppe === g);

  // ?termin=<id> — einmal nach dem ersten Laden zur Zeile springen (auch in eine zugeklappte Gruppe).
  useEffect(() => {
    if (!daten || gesprungen.current) return;
    gesprungen.current = true;
    let id: number | null = null;
    try { id = Number(new URLSearchParams(window.location.search).get("termin")) || null; } catch { id = null; }
    if (!id) return;
    const t = daten.termine.find((x) => x.id === id);
    if (!t) { melden(`Termin #${id} steht nicht (mehr) in der Übersicht — sie zeigt 14 Tage voraus, offene verpasste ${VERPASST_OFFEN_TAGE} Tage zurück, Erledigtes 3 Tage.`, "liste", true); return; }
    if (t.gruppe === "spaeter" || t.gruppe === "erledigt") setKlappen((k) => ({ ...k, [t.gruppe]: true }));
    lage?.zeigen(`[data-termin="${id}"]`, { hervor: true });
  }, [daten, lage, melden]);

  const ergebnis = async (t: TerminZeile, e: "erledigt" | "verpasst") => {
    setBusy(`${e === "erledigt" ? "e" : "v"}${t.id}`);
    try {
      const j = await post(`/chef/mara/termine/${t.id}/ergebnis`, { ergebnis: e });
      melden(`${t.person.name}: ${j.hinweis}`, t.gruppe === "jetzt" ? "jetzt" : "liste");
      setFrage(null);
      d.neu();
    } catch (err: any) { melden(err.message, t.gruppe === "jetzt" ? "jetzt" : "liste", true); d.neu(); } finally { setBusy(null); }
  };
  const merken = (pid: number) => setGespeichert((g) => (g.includes(pid) ? g : [...g, pid]));
  const zeileProps = { busy, frage, handy, onGespeichert: merken, onErgebnis: (t: TerminZeile, e: "erledigt" | "verpasst") => void ergebnis(t, e), onFrage: setFrage };

  if (d.fehler && !daten) return <div className="mt"><Rundgang raum="mara-termine" titel="Termine" schritte={RUNDGAENGE.maraTermine.schritte} {...rg} /><Fehlermeldung text={d.fehler} erneut={d.neu} /></div>;
  if (!daten) return <div className="mt"><Rundgang raum="mara-termine" titel="Termine" schritte={RUNDGAENGE.maraTermine.schritte} {...rg} /><Geruest zeilen={8} /></div>;

  const z = daten.zaehler;
  const nFilter = (f: TerminFilter) => filtern(daten.termine, f).filter(istOffen).length;
  const filterText = (f: TerminFilter, titel: string, leer: string) => { const n = nFilter(f); return n ? `${titel} · ${zahl(n)}` : `${titel} · ${leer}`; };
  const liste = (g: TerminGruppe) => {
    const r = je(g);
    return r.length ? r.map((t) => <Termin key={t.id} t={t} gespeichert={gespeichert.includes(t.person.id)} {...zeileProps} />) : null;
  };
  const titel = (g: TerminGruppe) => TERMIN_GRUPPEN.find((x) => x.key === g)!.titel;
  const leer = (g: TerminGruppe) => TERMIN_GRUPPEN.find((x) => x.key === g)!.leer;

  return (
    <div className="mt">
      <Rundgang raum="mara-termine" titel="Termine" schritte={RUNDGAENGE.maraTermine.schritte} {...rg} />

      <Abwesenheit a={daten.abwesenheit} neu={d.neu} melden={(t, f) => melden(t, "abwesenheit", f)} />
      <Meldung m={meldung} ort="abwesenheit" onZu={zu} />
      {/* E-263: Termine im eigenen Kalender (Abo) — zugeklappt, die Zeile nennt den Zustand. */}
      <KalenderAbos />

      {/* ── Wie viel liegt an ─────────────────────────────────────────── */}
      <div className="mara-kette mt-kette" aria-label="Was ansteht">
        <span className="mara-etikett">Offen</span>
        {z.wartet ? <span><b className="mara-krit-t">{zahl(z.wartet)}</b>{z.wartet === 1 ? "Kunde wartet" : "Kunden warten"}</span> : <span>niemand wartet</span>}
        {z.heute ? <span><b>{zahl(z.heute)}</b>heute</span> : <span>heute keiner mehr</span>}
        {z.geldOffenCents ? <span title="Offene Erstzahlungen und fällige Raten der Menschen mit offenem Termin — dieselbe Rechnung wie in der Telefonkartei."><b>{eur(z.geldOffenCents)}</b>hängen daran</span> : <span>kein offenes Geld daran</span>}
        {z.beiAbwesenden ? <span className="mara-warn-t mara-klein">{zahl(z.beiAbwesenden)} bei Abwesenden</span> : null}
        <span className="mara-still mara-klein mt-stand" title="lädt jede Minute neu, solange der Reiter offen ist">
          Stand {uhrBerlin(daten.stand)}
          {d.fehler ? <> · <button type="button" className="mara-knopf text" onClick={d.neu}>Neu laden gescheitert — nochmal</button></> : null}
        </span>
      </div>

      {/* ── Filter ─────────────────────────────────────────────────────── */}
      <div className="mara-reiter-zeile mt-filter">
        <div className="mara-ansicht" role="group" aria-label="Welche Termine">
          <button type="button" aria-pressed={filter === "alle"} onClick={() => setFilter("alle")}>{filterText("alle", "Alle", "keiner offen")}</button>
          <button type="button" aria-pressed={filter === "mara"} onClick={() => setFilter("mara")}>{filterText("mara", "Nur Mara", "keiner offen")}</button>
          <button type="button" aria-pressed={filter === "abwesend"} onClick={() => setFilter("abwesend")}
            title={daten.abwesenheit.an ? undefined : "Erst wenn „Team abwesend“ an ist, zählt ein Termin als „bei Abwesenden“."}>
            {filterText("abwesend", "Bei Abwesenden", daten.abwesenheit.an ? "keiner" : "Schalter aus")}
          </button>
        </div>
      </div>

      {/* ── Jetzt: die EINE Glasfläche ─────────────────────────────────── */}
      <section className="mara-glas mt-jetzt" aria-labelledby="mt-jetzt-titel">
        <h2 id="mt-jetzt-titel" className="mara-etikett mt-etikett">
          {!jetzt ? "Jetzt" : fokus === "wartet" ? `Wartet ${seit(jetzt.beginn)} — zuerst anrufen` : fokus === "jetzt" ? "Jetzt" : "Als Nächstes"}
        </h2>
        {/* Leer nur, wenn unter dem Filter wirklich nichts mehr offen ist — sonst stünde das Glas über der roten Liste. */}
        {jetzt
          ? <Termin t={jetzt} gross gespeichert={gespeichert.includes(jetzt.person.id)} {...zeileProps} />
          : <p className="mt-leer">{filter === "mara" ? "Mara hat keinen offenen Termin mehr." : filter === "abwesend" ? "Bei Abwesenden ist nichts mehr offen." : "Kein offener Termin mehr — Zeit für die Telefonkartei."}</p>}
        <Meldung m={meldung} ort="jetzt" onZu={zu} />
      </section>

      <Meldung m={meldung} ort="liste" onZu={zu} />

      {/* ── Kunde wartet ───────────────────────────────────────────────── */}
      {je("wartet").length > 0 && (
        <section className="mt-gruppe wartet" aria-labelledby="mt-g-wartet">
          <h2 id="mt-g-wartet">{titel("wartet")} <span className="mara-still">· {zahl(je("wartet").length)}{fokus === "wartet" ? " weitere" : ""} · A vor B vor Rate vor C, dann nach Betrag</span></h2>
          {liste("wartet")}
        </section>
      )}

      {(["heute", "morgen", "woche"] as TerminGruppe[]).map((g) => (
        <section key={g} className="mt-gruppe" aria-labelledby={`mt-g-${g}`}>
          <h2 id={`mt-g-${g}`}>{titel(g)}{je(g).length ? <span className="mara-still"> · {zahl(je(g).length)}</span> : null}</h2>
          {liste(g) ?? <p className="mt-leer">{g === "heute" && filter === "mara" ? "Mara: heute keiner mehr." : leer(g)}</p>}
        </section>
      ))}

      {(["spaeter", "erledigt"] as TerminGruppe[]).map((g) => (
        <details key={g} className="mara-klappe mt-klappe" open={!!klappen[g]} onToggle={(e) => { const o = (e.target as HTMLDetailsElement).open; setKlappen((k) => (k[g] === o ? k : { ...k, [g]: o })); }}>
          <summary>{titel(g)}{je(g).length ? ` · ${zahl(je(g).length)}` : " · keiner"}</summary>
          {klappen[g] ? (liste(g) ?? <p className="mt-leer">{leer(g)}</p>) : null}
        </details>
      ))}

      {/* ── Rückruf-Notizen des Teams (nur unter „Alle") ────────────────── */}
      {filter === "alle" && daten.teamRueckrufe.length > 0 && (
        <details className="mara-klappe mt-klappe mt-team-rr">
          <summary>{daten.teamRueckrufe.length === 1 ? "Ein Rückruf, den das Team notiert hat" : `${zahl(daten.teamRueckrufe.length)} Rückrufe, die das Team notiert hat`} · kein Kalendertermin</summary>
          <ol className="mara-liste">
            {daten.teamRueckrufe.map((r) => (
              <li key={r.id} className="mt-rr">
                <span className="mt-uhr klein">{uhrBerlin(r.am)}</span>
                <span className="mt-rr-inhalt">
                  <span className="mt-name">{r.name}</span> <span className="mara-still">{tagWort(r.am)} · notiert von {r.agentVorname ?? "dem Team"}</span>
                  {r.notiz ? <span className="mt-rr-notiz">{r.notiz}</span> : null}
                </span>
                <span className="mt-rr-knoepfe">
                  {r.telefonWaehlbar ? <a className="mara-knopf klein" href={`tel:${r.telefonWaehlbar}`}>Anrufen</a> : <span className="mara-still mara-klein">keine Nummer</span>}
                  {r.akteLink ? <a className="mara-knopf klein" href={r.akteLink} target="_blank" rel="noreferrer">Akte</a> : null}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* ── Maras Übergaben an Abwesende ─────────────────────────────────── */}
      {daten.abwesenheit.an && daten.uebergaben.offen > 0 && (
        <p className="mara-hinweis warn mt-uebergaben">
          <span className="mara-punkt warn" aria-hidden="true" />
          <span>
            {zahl(daten.uebergaben.offen)} Übergaben von Mara liegen noch bei Abwesenden{daten.uebergaben.letzte48h ? ` (${zahl(daten.uebergaben.letzte48h)} seit gestern)` : ""} — Zusagen ohne Uhrzeit. Neue landen jetzt auf deinem Board.
            {" "}<a href="/chef/s/todo">Meine Liste →</a>
          </span>
        </p>
      )}
    </div>
  );
}
