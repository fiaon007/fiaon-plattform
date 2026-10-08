// ═══════════════════════════════════════════════════════════════════════════
// KONTO UND KARTE IN DER AKTE (aus pipeline.tsx gezogen, E-IT-B 08.10.2026)
//
// Justin, 24.08.2026: „Der Kunde kommt ja mit der Erwartungshaltung: ‚Ich
// brauche eine Kreditkarte' — das müssen wir nun auch erfüllen … Binde ÜBERALL
// den Prozess ein, wo er notwendig ist und hingehört, es MUSS vermerkt werden,
// also wenn alle Bedingungen bei einem Kunden erfüllt sind, muss es der
// Mitarbeiter ja auch sehen!"
//
// Der Abschnitt ist NICHT als Sperre gebaut, sondern als Weg. Ein ausgegrauter
// Knopf sagt „geht nicht" und lässt den Mitarbeiter ratlos zurück. Hier steht
// stattdessen, WAS fehlt, WARUM es diese Bedingung gibt (in seinen Worten und
// in denen für den Kunden) und WAS der nächste Schritt ist — anklickbar.
//
// ── E-IT-B (08.10.2026): ERNEUT SENDEN, ADRESSE, ZUSTELLUNG ────────────────
// Seit der Automatik (E-206) stand fast jede Akte auf „Der Weg ist geschickt“
// — OHNE Knopf. Sagte der Kunde „nichts bekommen“, gab es keinen Weg, ihm den
// Link noch einmal zu schicken (das Sende-Menü ist seit 18.09. nur für Admins).
// Justin, 08.10.: jeder berechtigte Mitarbeiter, gleicher Link, kein neuer
// Vorgang, protokolliert, höchstens 3 am Tag und 15 Minuten Abstand, Adresse
// und Zustellung sichtbar, KEINE automatische Entsperrung bei Brevo. Der
// Kasten zeigt das jetzt, der Knopf „E-Mail erneut senden“ fragt in der Seite
// nach (kein window.confirm mehr), und wer ausgeschlossen ist (gekündigt,
// Sperre …), sieht den Grund statt „erfüllt alle Bedingungen“.
//
// Wortwahl bindend: KOOPERATIONSPARTNER, nie „Affiliate". Die Bank darf beim
// Namen genannt werden (DKB) — ihre Vorteile sind das Argument.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Mail } from "lucide-react";
import { api } from "@/pages/agent/shared";
import { KARTE_ERNEUT, KARTE_ADRESSE_HINWEIS } from "@shared/fiaon-karten-weg";
import "@/styles/office-konto-karte.css";

type Melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;

interface ZustellLage {
  zustellung: string; text: string; am: string | null; grund: string | null; problem: boolean;
  /** Gegenprüfung 08.10.: was der Mitarbeiter tun kann (nach Brevos Grund) und ob die Leitung die Sperre prüfen kann. */
  hinweis?: string | null; leitungPruefen?: boolean; sperrCode?: string | null;
}
export interface Einladung {
  personId: number;
  eingeladen: boolean;
  zuerstAm: string | null;
  zuerstVon: string | null;
  zuletztAm: string | null;
  zuletztVon: string | null;
  anzahl: number;
  erneutAnzahl: number;
  empfaenger: string | null;
  zustellung: { code: string; text: string; am: string | null; grund: string | null; problem: boolean } | null;
  adresseLage: ZustellLage | null;
  kontoEroeffnet: boolean;
  darfErneut: boolean;
  sperre: string | null;
  hinweis: string | null;
  /** Gegenprüfung 08.10.: Knopf „An die Leitung: Sperre prüfen“ (abgemeldet, Spam, Sperre — nicht beim Rückläufer). */
  sperreLeitung?: boolean;
  heuteNoch: number;
  naechsterMoeglichAm: string | null;
  verlauf: { am: string; von: string; status: string; zustellung: string | null; zustellText: string | null; problem?: boolean; an: string | null }[];
}

/** „TT.MM.JJJJ, HH:MM“ in Berliner Zeit. */
function zeit(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function tag(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}
function eur(c: number): string {
  return (Number(c || 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
/** Wer schickte — die Automatik heißt im Protokoll „Automatik (erste Rate)“. */
function vonText(v: string | null): string {
  if (!v) return "";
  return /^automatik/i.test(v) ? "automatisch nach der ersten Zahlung" : `von ${v}`;
}
/** Die Farbe der Zustell-Marke. */
function markeArt(code: string | null | undefined, problem: boolean): string {
  if (problem) return "rot";
  return code === "zugestellt" || code === "geoeffnet" || code === "geklickt" ? "gut" : "offen";
}

/** Lädt den Stand der Einladung (GET /agent/karte/:id/einladung). */
function useEinladung(personId: number) {
  const [einladung, setEinladung] = useState<Einladung | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await api(`/agent/karte/${personId}/einladung`);
    if (r.ok && r.json?.einladung) { setEinladung(r.json.einladung); setFehler(null); }
    else setFehler(r.json?.error || "Der Stand der Einladung lässt sich gerade nicht lesen.");
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);
  return { einladung, setEinladung, fehler, laden };
}

// ═══════════════════════════════════════════════════════════════════════════
// „AN DIE LEITUNG: SPERRE PRÜFEN“ (Gegenprüfung 08.10.2026)
// Die Adresse ist bei unserem Mailversand gesperrt, stimmt aber (meist hat sich
// der Kunde abgemeldet). Will er die Post ausdrücklich dorthin, prüft die
// Leitung die Sperre von Hand — der Knopf legt ihr die Aufgabe an. Nichts wird
// automatisch aufgehoben (Justin, 08.10.).
// ═══════════════════════════════════════════════════════════════════════════
function SperreLeitung({ personId, empfaenger, melden }: { personId: number; empfaenger: string | null; melden: Melden }) {
  const [offen, setOffen] = useState(false);
  const [wunsch, setWunsch] = useState("");
  const [sendet, setSendet] = useState(false);
  const [fertig, setFertig] = useState<string | null>(null);
  if (fertig) return <div className="kk2-hinweis" style={{ marginTop: 8 }}>{fertig}</div>;
  if (!offen) {
    return (
      <div style={{ marginTop: 8 }}>
        <button type="button" className="pi-knopf still klein" onClick={() => setOffen(true)}>An die Leitung: Sperre prüfen</button>
      </div>
    );
  }
  const schicken = async () => {
    setSendet(true);
    const r = await api(`/agent/karte/${personId}/sperre-leitung`, { method: "POST", body: JSON.stringify({ wunsch }) });
    setSendet(false);
    if (r.ok && r.json?.ok) { setFertig(String(r.json.meldung)); melden("gut", "An die Leitung", r.json.meldung); }
    else melden("schlecht", "Nicht angelegt", r.json?.error || r.json?.meldung || "Bitte gleich noch einmal versuchen.");
  };
  return (
    <div className="kk2-frage" style={{ marginTop: 8 }}>
      <p>Die Leitung prüft die Sperre für <b className="kk2-adresse">{empfaenger ?? "diese Adresse"}</b> von Hand — nur, wenn der Kunde die Post dorthin ausdrücklich möchte.</p>
      <textarea className="pi-eingabe" rows={2} maxLength={600} value={wunsch} onChange={(ev) => setWunsch(ev.target.value)}
                placeholder="Was hat der Kunde gesagt? (z. B. „will den Link an genau diese Adresse, hat sich nur versehentlich abgemeldet“)" />
      <div className="kk2-tun">
        <button type="button" className="pi-knopf klein" disabled={sendet || wunsch.trim().length < 5} onClick={() => void schicken()}>
          {sendet ? "Legt an …" : "Aufgabe an die Leitung"}
        </button>
        <button type="button" className="pi-link" onClick={() => { setOffen(false); setWunsch(""); }}>Abbrechen</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER KASTEN „EINLADUNG GESCHICKT“ — mit Knopf, Nachfrage und Verlauf.
// `kurz` für den Überblick: Marke, eine Zeile, der Knopf — ohne Verlauf.
// ═══════════════════════════════════════════════════════════════════════════
function EinladungKasten({ personId, einladung, melden, onNeu, onDaten, kurz, bonus }: {
  personId: number; einladung: Einladung; melden: Melden; onNeu: (e: Einladung | null) => void;
  onDaten?: () => void; kurz?: boolean;
  bonus?: { cents: number; status: string; fuer: string | null } | null;
}) {
  const [frage, setFrage] = useState(false);
  const [abgeglichen, setAbgeglichen] = useState(false);
  const [sendet, setSendet] = useState(false);
  const e = einladung;
  const z = e.zustellung;
  const problem = !!e.adresseLage?.problem || !!z?.problem;

  const senden = async () => {
    setSendet(true);
    const r = await api(`/agent/karte/${personId}/erneut`, { method: "POST", body: JSON.stringify({}) });
    setSendet(false);
    if (r.json?.einladung) onNeu(r.json.einladung);
    if (r.ok && r.json?.ok) {
      setFrage(false); setAbgeglichen(false);
      melden("gut", "Erneut geschickt", r.json.meldung);
    } else {
      melden("schlecht", "Nicht geschickt", r.json?.meldung || r.json?.error || "Bitte gleich noch einmal versuchen.");
    }
  };

  return (
    <div className={`kk2-kasten${problem ? " problem" : ""}`}>
      <div className="kk2-kopf">
        <span className="pi-kk-haken"><Check size={17} strokeWidth={2.5} /></span>
        <b>Einladung geschickt</b>
        {/* Der Text sagt bei einem Problem selbst „nicht angekommen“ (KARTE_ZUSTELL_TEXT) — die Farbe macht es rot. */}
        {z && <span className={`kk2-marke ${markeArt(z.code, z.problem)}`}>{z.text}</span>}
        {!z && <span className="kk2-marke offen">Zustellung noch nicht abgeglichen</span>}
      </div>

      <ul className="kk2-zeilen">
        <li>Zuerst am <b>{zeit(e.zuerstAm)}</b> {vonText(e.zuerstVon)}{e.anzahl > 1 ? ` · insgesamt ${e.anzahl}-mal geschickt` : ""}</li>
        {e.zuletztAm && <li>Zuletzt erneut am <b>{zeit(e.zuletztAm)}</b> {vonText(e.zuletztVon)}</li>}
        {!kurz && (
          <li>
            An: <span className="kk2-adresse">{e.empfaenger ?? "keine Adresse hinterlegt"}</span>
            {onDaten && <> · <button type="button" className="pi-link" onClick={onDaten}>Stimmt die Adresse? → Daten</button></>}
          </li>
        )}
        {!kurz && z?.grund && <li>Antwort des Postfachs: <em>{z.grund}</em></li>}
        {!kurz && bonus && (
          <li>
            {bonus.status === "bestaetigt"
              ? `Der Partner hat die Eröffnung bestätigt – ${eur(bonus.cents)} sind ${bonus.fuer ? `${bonus.fuer} ` : ""}gutgeschrieben.`
              : `${eur(bonus.cents)} stehen ${bonus.fuer ? `für ${bonus.fuer} ` : ""}als vorgemerkt – auszahlbar, sobald der Partner die Eröffnung bestätigt. Ein erneuter Versand ändert daran nichts.`}
          </li>
        )}
      </ul>

      {e.adresseLage?.problem && (
        <div className="kk2-warn">
          <b>An diese Adresse kommt nichts an.</b>
          Letzte Mail: {e.adresseLage.text}{e.adresseLage.grund ? ` (Grund: ${e.adresseLage.grund})` : " (einen Grund nennt unser Mailversand nicht)"}.{" "}
          {e.adresseLage.hinweis ?? KARTE_ADRESSE_HINWEIS}
          {onDaten && <div style={{ marginTop: 8 }}><button type="button" className="pi-knopf still klein" onClick={onDaten}>Adresse unter „Daten“ ändern</button></div>}
          {e.sperreLeitung && <SperreLeitung personId={personId} empfaenger={e.empfaenger} melden={melden} />}
        </div>
      )}
      {e.hinweis && <div className="kk2-hinweis">{e.hinweis}</div>}

      {!frage ? (
        <div className="kk2-tun">
          <button type="button" className="pi-knopf klein kk2-erneut" disabled={!e.darfErneut} onClick={() => setFrage(true)}>
            <Mail size={14} strokeWidth={1.75} /> E-Mail erneut senden
          </button>
          {e.darfErneut
            ? <span className="kk2-grund">Derselbe Link, keine neue Einladung · heute noch {e.heuteNoch} von {KARTE_ERNEUT.maxProTag}</span>
            : e.sperre && !e.adresseLage?.problem && <span className="kk2-grund">{e.sperre}</span>}
        </div>
      ) : (
        <div className="kk2-frage">
          <p>Die Einladung geht noch einmal an <b className="kk2-adresse">{e.empfaenger}</b> — derselbe Link wie beim ersten Mal, es entsteht keine neue Einladung.</p>
          <p>Bitte den Kunden auch im <b>Spam-Ordner</b> nachsehen lassen. Heute noch {e.heuteNoch} von {KARTE_ERNEUT.maxProTag} möglich, danach frühestens in {KARTE_ERNEUT.mindestAbstandMin} Minuten.</p>
          <label className="kk2-haken">
            <input type="checkbox" checked={abgeglichen} onChange={(ev) => setAbgeglichen(ev.target.checked)} />
            Die Adresse habe ich mit dem Kunden abgeglichen.
          </label>
          <div className="kk2-tun">
            <button type="button" className="pi-knopf klein" disabled={!abgeglichen || sendet} onClick={() => void senden()}>
              {sendet ? "Schickt …" : "Jetzt erneut senden"}
            </button>
            <button type="button" className="pi-link" onClick={() => { setFrage(false); setAbgeglichen(false); }}>Abbrechen</button>
          </div>
        </div>
      )}

      {!kurz && e.verlauf.length > 0 && (
        <details className="kk2-verlauf">
          <summary>Alle Versände ({e.verlauf.length})</summary>
          <ol>
            {e.verlauf.map((v) => (
              <li key={`${v.am}-${v.von}`}>
                <em>{zeit(v.am)}</em>
                <span>{/^automatik/i.test(v.von) ? "Automatik" : v.von}{v.an ? ` · an ${v.an}` : ""}{v.status !== "versandt" ? ` · ${v.status === "fehlgeschlagen" ? "nicht gesendet" : v.status}` : ""}</span>
                <span className={v.problem ? "rot" : ""}>{v.zustellText ?? (v.status === "versandt" ? "noch offen" : "")}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER GANZE ABSCHNITT — Reiter „Sein Antrag“
// ═══════════════════════════════════════════════════════════════════════════
export function KontoKarteAkte({ personId, name, melden, onProdukt, onDaten }: {
  personId: number; name: string; melden: Melden; onProdukt: () => void; onDaten?: () => void;
}) {
  const [stand, setStand] = useState<any | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [sendet, setSendet] = useState(false);
  const [warum, setWarum] = useState<string | null>(null);
  const { einladung, setEinladung, fehler: einladungFehler, laden: einladungLaden } = useEinladung(personId);

  const standLaden = useCallback(async () => {
    const r = await api(`/agent/karte/${personId}`);
    setStand(r.ok ? r.json.stand : null); setLaedt(false);
  }, [personId]);
  useEffect(() => { void standLaden(); }, [standLaden]);

  // Der ERSTE Versand („Karte bestellen“) — nur, wenn noch keine Einladung draußen ist.
  const bestellen = async () => {
    setSendet(true);
    const r = await api(`/agent/karte/${personId}/senden`, { method: "POST", body: JSON.stringify({}) });
    setSendet(false);
    if (!r.ok) { melden("schlecht", "Nicht geschickt", r.json?.error || "Bitte erneut versuchen."); void einladungLaden(); return; }
    setStand(r.json.stand ?? stand);
    void einladungLaden();
    melden("gut", r.json.meldung || "Unterwegs", r.json.hinweis);
  };

  if (laedt) return <section className="pi-sek"><div className="pi-sek-kopf"><div><b>Konto & Karte</b><p>Prüfe den Stand …</p></div></div><p className="pi-sek-satz leise">Einen Moment.</p></section>;
  if (!stand) return null;

  const vorname = String(name).split(" ")[0] || "der Kunde";
  const adresseGesperrt = !!einladung?.adresseLage?.problem;

  return (
    <section className="pi-sek kk2-sektion">
      <div className="pi-sek-kopf"><div><b>Konto & Karte</b>
        <p>{`Fast jeder kommt mit dem Satz „Ich brauche eine Kreditkarte“. Über unsere Partnerbank können wir ihn einlösen — sobald ${vorname} so weit ist.`}</p>
      </div></div>

      {/* ── WELCHE BANK? (25.08.2026) — Daniel und Florentine: „Auch intern ist nicht ersichtlich, welcher
          Kunde seine Karte von welcher Bank erhält." Die Angaben kommen vom Server (PARTNERBANKEN). */}
      {stand.bank && (
        <div className="pi-kk-bank">
          <div className="pi-kk-bank-kopf">
            <small>Partnerbank</small>
            <b>{stand.bank.name}</b>
          </div>
          <ul className="pi-kk-bank-liste">
            {stand.bank.vorteile.map((v: string) => <li key={v}>{v}</li>)}
          </ul>
          <p className="pi-kk-bank-fuss">
            Kreditkarte {stand.bank.kartePreisMonat} im Monat, zubuchbar aus dem fertigen Banking —
            {" "}{stand.bank.aktion}.
          </p>
        </div>
      )}

      {/* Schon geschickt: Zustellung, Adresse, erneut senden (E-IT-B). */}
      {stand.versand ? (
        einladung ? (
          <>
            <EinladungKasten personId={personId} einladung={einladung} melden={melden} onDaten={onDaten}
              onNeu={(neu) => { if (neu) setEinladung(neu); void standLaden(); }}
              bonus={{ cents: Number(stand.versand.bonusCents || 0), status: String(stand.versand.status), fuer: stand.versand.vonName ?? null }} />
            <p className="pi-sek-satz leise" style={{ marginTop: 8 }}>
              Ruf {vorname} in ein paar Tagen an und frag, ob es geklappt hat. Wer beim Video-Ident hängen bleibt,
              bricht ab und sagt es niemandem.
            </p>
          </>
        ) : einladungFehler ? (
          // E-IT-B Fertigstellung (08.10.2026, Befund 8a): Bei einem Ladefehler (403/500) stand hier für immer
          // „Lade …“ — jetzt der Grund und ein Knopf, es noch einmal zu versuchen.
          <p className="pi-sek-satz warn">
            {einladungFehler}{" "}
            <button type="button" className="pi-link" onClick={() => void einladungLaden()}>Erneut laden</button>
          </p>
        ) : <p className="pi-sek-satz leise">Lade den Stand der Einladung …</p>
      ) : stand.bereit ? (
        <>
          {stand.hinweis && <div className="kk2-hinweis" style={{ marginBottom: 10 }}>{stand.hinweis}</div>}
          {adresseGesperrt && (
            <div className="kk2-warn" style={{ marginBottom: 10 }}>
              <b>An {einladung?.empfaenger ?? "diese Adresse"} kommt nichts an.</b>
              Letzte Mail: {einladung?.adresseLage?.text}{einladung?.adresseLage?.grund ? ` (Grund: ${einladung.adresseLage.grund})` : ""}. {einladung?.adresseLage?.hinweis ?? KARTE_ADRESSE_HINWEIS}
              {onDaten && <div style={{ marginTop: 8 }}><button type="button" className="pi-knopf still klein" onClick={onDaten}>Adresse unter „Daten“ ändern</button></div>}
              {einladung?.adresseLage?.leitungPruefen && <SperreLeitung personId={personId} empfaenger={einladung?.empfaenger ?? null} melden={melden} />}
            </div>
          )}
          <div className="pi-kk-bereit">
            <div className="pi-kk-bereit-text">
              <b>{vorname} erfüllt alle Bedingungen.</b>
              <span>
                {stand.hinweis
                  ? "Die Automatik schickt die Einladung nicht (Hinweis oben) — der Knopf schickt sie, wenn der Kunde sie ausdrücklich möchte. "
                  : "Die Einladung geht nach der ersten Zahlung automatisch raus; der Knopf schickt sie sofort. "}
                <b>Erst das Konto, dann die Karte</b> — die
                Kreditkarte gibt es nur als Zubuchung aus dem fertigen Banking heraus. Wer direkt zur Karte
                geschickt wird, läuft in eine Ablehnung und schreibt sie uns zu.
              </span>
            </div>
            <button type="button" className="pi-knopf riesig gut pi-kk-knopf" disabled={sendet || adresseGesperrt} onClick={() => void bestellen()}>
              <CreditCard size={18} strokeWidth={1.75} /> {sendet ? "Schickt …" : "Karte bestellen"}
            </button>
          </div>
          <p className="pi-sek-satz leise">
            Für dich: <b>10 € je bestätigter Kontoeröffnung.</b> Sie stehen sofort als vorgemerkt in deinem
            Konto und werden auszahlbar, wenn der Partner die Eröffnung endgültig meldet — das dauert
            einige Wochen und kann auch entfallen, deshalb erst dann.
            {" "}<a href="/agent/academy/leitfaeden" className="pi-link" target="_blank" rel="noreferrer">
              Leitfaden für dieses Gespräch
            </a> — er sagt dir Satz für Satz, wie du es erklärst.
          </p>
        </>
      ) : stand.ausschluss ? (
        // E-IT-B: Ein Ausschluss ist kein „noch nicht“ — er hat einen Grund, und der steht hier.
        <div className="kk2-aus">
          <b>Kein Kartenlink</b>
          <span>{stand.ausschluss.text}.</span>
        </div>
      ) : (
        <div className="pi-kk-nochnicht">
          <b>Noch nicht so weit.</b>
          <span>{stand.esFehlt}. Sobald alles steht, geht die Einladung automatisch raus.</span>
        </div>
      )}

      {/* Die Tore — immer sichtbar, auch wenn erfüllt: Der Mitarbeiter soll dem Kunden sagen können, WARUM es sie gibt. */}
      <div className="pi-kk-tore">
        {stand.tore.map((t: any) => (
          <div key={t.schluessel} className={`pi-kk-tor${t.erfuellt ? " ja" : ""}`}>
            <span className="pi-kk-punkt">{t.erfuellt ? <Check size={13} strokeWidth={3} /> : <span className="pi-kk-offen" />}</span>
            <div>
              <b>{t.titel}</b>
              {!t.erfuellt && t.fehlt && <small className="pi-kk-fehlt">{t.fehlt}</small>}
              {!t.erfuellt && t.wieWeiter && <small className="pi-kk-weiter">{t.wieWeiter}</small>}
              <button type="button" className="pi-link pi-kk-warum"
                      onClick={() => setWarum(warum === t.schluessel ? null : t.schluessel)}>
                {warum === t.schluessel ? "Begründung schließen" : "Warum diese Bedingung?"}
              </button>
              {warum === t.schluessel && (
                <div className="pi-kk-grund">
                  <p><b>Für dich:</b> {t.warumIntern}</p>
                  <p><b>So sagst du es dem Kunden:</b> „{t.warumFuerKunden}“</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* WARUM NOCH KEINE RATE GELAUFEN IST — die wahre Antwort (27.08.2026, Justin: „Die Dame hat bereits bezahlt.“). */}
      {stand.zahlen.ratenBezahlt === 0 && (
        <div className="pi-sackgasse" style={{ marginTop: 12 }}>
          {!stand.zahlen.paketBezahlt ? (
            <span>
              <b>Noch keine Bestellung bezahlt</b>
              Ohne bezahltes Paket beginnt die Zählung der Raten nicht.
            </span>
          ) : (
            <span>
              <b>Paket bezahlt, aber noch keine Rate</b>
              Die Erstzahlung ist da. Für die Karte zählen die laufenden Raten —
              {stand.zahlen.naechsteRateAm
                ? ` die nächste ist am ${tag(stand.zahlen.naechsteRateAm)} fällig.`
                : " eine Ratenkette ist noch nicht angelegt."}
            </span>
          )}
          <button type="button" className="pi-knopf klein" onClick={onProdukt}>
            {stand.zahlen.paketBezahlt ? "Raten ansehen" : "Produkt ansehen"}
          </button>
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZEILE IM ÜBERBLICK (E-IT-B) — bisher stand Konto & Karte nur unter
// „Sein Antrag“. Wer den Kunden am Telefon hat und „Link nicht bekommen“ hört,
// soll den Knopf im ersten Reiter finden.
// ═══════════════════════════════════════════════════════════════════════════
export function KontoKarteKurz({ personId, melden, onAkte, onDaten }: {
  personId: number; melden: Melden; onAkte: () => void; onDaten?: () => void;
}) {
  const { einladung, setEinladung } = useEinladung(personId);
  if (!einladung) return null;
  return (
    <section className="pi-sek kk2-ueberblick">
      <div className="pi-sek-kopf"><div><b>Konto & Karte</b><p>Die Einladung unserer Partnerbank — was mit ihr ist, und erneut senden, wenn der Kunde sie nicht hat.</p></div>
        <button type="button" className="pi-link" onClick={onAkte}>Alles zu Konto & Karte</button>
      </div>
      {einladung.eingeladen && !einladung.kontoEroeffnet ? (
        <EinladungKasten personId={personId} einladung={einladung} melden={melden} onDaten={onDaten} kurz
          onNeu={(neu) => { if (neu) setEinladung(neu); }} />
      ) : (
        <div className="kk2-kurz">
          <span>{einladung.kontoEroeffnet ? <><b>Girokonto eröffnet.</b> Die Karte bucht der Kunde im Banking dazu.</> : <><b>Noch keine Einladung.</b> {einladung.sperre ?? ""}</>}</span>
        </div>
      )}
    </section>
  );
}

export default KontoKarteAkte;
