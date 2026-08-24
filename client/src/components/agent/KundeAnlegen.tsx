// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN ANLEGEN UND ABSCHLIESSEN — IN EINEM ZUG
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// „JEDER Agent kann einen Kunden komplett anlegen und pflegen — bis zu dem
// Punkt, an dem der Kunde zahlen kann.“ Und der Fluss endet mit dem Termin.
//
// ── WARUM EIN FLUSS UND KEIN FORMULAR ──────────────────────────────────────
// Der Agent hat den Menschen am TELEFON. Er kann nicht sagen „einen Moment, ich
// wechsle die Seite“ — viermal. Deshalb: ein Feld nach dem anderen, und nach
// dem Anlegen bleibt derselbe Dialog offen und zeigt die drei nächsten
// Schritte:
//
//   1. Zahlungsdaten senden   (Mail mit Verwendungszweck und Rechnung)
//   2. Zahlungsdaten kopieren (für WhatsApp — der Agent liest sie oft vor)
//   3. Termin anbieten        (Link senden oder kopieren)
//
// GEMESSEN am 24.08.2026: Alle 120 gebuchten Termine stammen aus einem
// verschickten Link. Der Hebel funktioniert — er wurde am Telefon nur nie
// angeboten.
//
// ── DER DUBLETTEN-CHECK LÄUFT WÄHREND DES TIPPENS ──────────────────────────
// Nicht erst beim Speichern: Wer den Namen schon eingetippt hat und dann hört
// „gibt es bereits“, hat umsonst gearbeitet. Der Hinweis erscheint, sobald
// E-Mail oder Nummer vollständig sind.
//
// ── PREISE ─────────────────────────────────────────────────────────────────
// Kommen aus /agent/katalog, also aus shared/fiaon-pakete.ts. Diese Datei
// hat KEINE eigene Preisliste — eine zweite Liste war der Grund, warum
// Ultra-Kunden für 79,99 kauften und 99,99 in Rechnung bekamen.
//
// ═══ UMBAU 24.08.2026 (Justin) ═════════════════════════════════════════════
// „Wenn man auf /agent/pipeline ‚neuen Kunden anlegen‘ klickt: 1. muss das neu
// und besser dargestellt werden und 2. wenn man es öffnet und einen neuen
// Kunden anlegt, muss alles synchronisiert verlaufen, alles richtig
// dargestellt, gespeichert und so weiter … es muss perfekt zu unserer CI
// passen, HIGH END Design!“
//
// AUSSEHEN — VORHER: alles in hellem Tailwind (bg-white, border-slate-200,
// text-slate-500), an der Aufrufstelle in den Rahmen .pi-hell gesteckt: ein
// weißer Kasten mitten im dunklen Office. NACHHER: dieselbe Formensprache wie
// Fokus-Karte und Akte (.pi-anl in office-pipeline.css) — Glas, Radien 12–26px,
// Schriftgewichte 300/400/500, Versalien-Labels in #93c5fd, EINE farbige
// Hauptaktion. Kein natives select mehr: Der Browser malt es in seinem eigenen
// Stil (weiße Liste im dunklen Glas), deshalb die Paketkarten .pi-pakete.
//
// FACHLICH — behoben in diesem Zug:
//   1. VORHER führte „Zur Akte“ (und „Akte öffnen“ am Dubletten-Treffer) auf
//      /agent/kunden?ref=… — die Seite liest aber NUR ?person=. Der Weg endete
//      also auf einer Seite ohne geöffnete Akte: der geschlossene Kasten, den
//      Justin meint. NACHHER geht der Weg über die personId; im selben Raum
//      öffnet er die Glas-Lade direkt (aufAkte), ohne Seitenwechsel.
//   2. VORHER prüfte die Oberfläche „E-Mail ODER Telefon“ nur auf „nicht
//      leer“, der Server dagegen auf ein echtes Adressmuster bzw. mindestens
//      sechs Ziffern. „max@“ oder „0176“ ließen den Knopf frei und liefen in
//      einen 400er. NACHHER prüft die Oberfläche DASSELBE und sagt am Feld,
//      was fehlt.
//   3. VORHER stand erst NACH dem Anlegen da, dass ohne Paket keine Bestellung
//      entsteht. NACHHER steht es VOR dem Klick — mit dem Ausweg dazu.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, type MouseEvent } from "react";
import { LABEL_VERTRIEB } from "@shared/fiaon-zustaendigkeit-text";
// Das Bauteil bringt seine Formensprache selbst mit: Es steht in pipeline.tsx
// (lädt die Datei ohnehin) UND in kunden-neu.tsx (/agent/kunden-alt, lädt sie
// nicht). Ohne diesen Import wäre es dort unformatiert. Die Datei enthält
// ausschließlich .pi-Klassen, sie kann keine fremde Seite umfärben.
import "@/styles/office-pipeline.css";

interface Paket {
  key: string; label: string; preisEuro: number;
  art: "privat" | "business"; abo: boolean;
}

interface Treffer {
  personId: number; name: string; ref: string | null;
  email: string | null; phone: string | null; treffer: string;
  bezahlt: boolean; agentName: string | null;
}

const euro = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

/** Dasselbe Muster wie normMail auf dem Server (fiaon-agent-anlage.ts). */
const MAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Dieselbe Grenze wie normNummer auf dem Server: unter sechs Ziffern → null. */
const NUMMER_MINDEST = 6;

/**
 * Der Weg zur Akte.
 *
 * VORHER: /agent/kunden?ref=FIAON-… — die Seite (pipeline.tsx) wertet aber nur
 * ?person= aus, der Parameter lief ins Leere und die Lade blieb zu.
 * NACHHER: über die personId. Nur wenn die fehlt (dann fehlt auch die Person),
 * bleibt die Referenz als letzte Spur.
 */
function akteWeg(personId: number | null | undefined, ref: string | null | undefined): string {
  if (personId != null && Number(personId) > 0) return `/agent/kunden?person=${Number(personId)}`;
  return `/agent/kunden${ref ? `?ref=${encodeURIComponent(String(ref))}` : ""}`;
}

async function ruf(pfad: string, koerper?: unknown): Promise<any> {
  const r = await fetch(`/api/fiaon${pfad}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(koerper ?? {}),
  }).catch(() => null);
  return (await r?.json().catch(() => null)) ?? { ok: false, error: "Nicht erreichbar." };
}

export function KundeAnlegen({ offen, aufKlappen, fertig, aufAkte }: {
  offen: boolean;
  aufKlappen: (v: boolean) => void;
  /** Wird nach erfolgreicher Anlage gerufen, damit die Liste neu lädt. */
  fertig?: (ref: string, personId?: number | null) => void;
  /**
   * Öffnet die Akte IM SELBEN RAUM (die Glas-Lade der Pipeline), statt die
   * Seite zu wechseln. Fehlt die Funktion, bleibt der Link als Weg — deshalb
   * ist „Zur Akte“ weiterhin ein echtes a-Element mit href.
   */
  aufAkte?: (personId: number) => void;
}) {
  const [pakete, setPakete] = useState<Paket[]>([]);
  const [f, setF] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    street: "", zip: "", city: "", birthdate: "", packKey: "",
  });
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  /** Nach dem Anlegen: der Abschluss-Bereich. */
  const [erfolg, setErfolg] = useState<any>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [terminLink, setTerminLink] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  // ── DER KATALOG ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!offen || pakete.length > 0) return;
    void fetch("/api/fiaon/agent/katalog", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setPakete(j.pakete ?? []); })
      .catch(() => {});
  }, [offen, pakete.length]);

  // ── DER DUBLETTEN-CHECK WÄHREND DES TIPPENS ─────────────────────────────
  // Mit Verzögerung: Ohne sie schickt jeder Tastendruck eine Abfrage, und bei
  // „max@muster.de“ wären das 13.
  useEffect(() => {
    const mailFertig = MAIL_MUSTER.test(f.email.trim());
    const nummerFertig = f.phone.replace(/[^\d]/g, "").length >= 9;
    if (!mailFertig && !nummerFertig) { setTreffer([]); return; }
    const t = setTimeout(() => {
      void ruf("/agent/kunden/pruefen", { email: f.email, phone: f.phone })
        .then((j) => setTreffer(j?.ok ? (j.treffer ?? []) : []));
    }, 450);
    return () => clearTimeout(t);
  }, [f.email, f.phone]);

  const anlegen = async () => {
    setLaeuft(true);
    setFehler(null);
    const j = await ruf("/agent/kunden/neu", f);
    setLaeuft(false);
    if (!j?.ok) {
      setFehler(String(j?.error ?? "Unbekannter Fehler"));
      // Bei 409 kommen Kandidaten mit — sie gehören in die Anzeige.
      if (j?.vorschlag) setTreffer([j.vorschlag]);
      if (Array.isArray(j?.kandidaten)) setTreffer(j.kandidaten);
      return;
    }
    setErfolg(j);
    fertig?.(String(j.ref), j.personId != null ? Number(j.personId) : null);
  };

  const kopieren = async (text: string, was: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setKopiert(was);
    setTimeout(() => setKopiert((k) => (k === was ? null : k)), 1600);
  };

  const zuruecksetzen = () => {
    setF({ firstName: "", lastName: "", email: "", phone: "",
           street: "", zip: "", city: "", birthdate: "", packKey: "" });
    setTreffer([]); setFehler(null); setErfolg(null);
    setTerminLink(null); setMeldung(null);
  };

  if (!offen) {
    return (
      <button type="button" onClick={() => aufKlappen(true)} className="pi-knopf gross">
        + Kunde anlegen
      </button>
    );
  }

  // ── WAS DER SERVER VERLANGT, VERLANGT AUCH DIE OBERFLÄCHE ───────────────
  // VORHER prüfte sie nur auf „nicht leer“ — „max@“ und „0176“ ließen den
  // Knopf frei, und der Server antwortete mit 400. NACHHER dieselbe Regel an
  // beiden Enden, und der Grund steht am Feld.
  const mailRoh = f.email.trim();
  const nummerZiffern = f.phone.replace(/[^\d]/g, "").length;
  const mailOk = MAIL_MUSTER.test(mailRoh);
  const nummerOk = nummerZiffern >= NUMMER_MINDEST;
  const mailKlemmt = mailRoh.length > 0 && !mailOk;
  const nummerKlemmt = f.phone.trim().length > 0 && !nummerOk;
  const erreichbar = mailOk || nummerOk;

  const fehlt: string[] = [];
  if (!f.firstName.trim()) fehlt.push("Vorname");
  if (!f.lastName.trim()) fehlt.push("Nachname");
  if (!erreichbar) fehlt.push("E-Mail oder Telefon");

  const kannAnlegen = fehlt.length === 0 && !laeuft;
  const gewaehlt = pakete.find((p) => p.key === f.packKey);
  const konten = pakete.filter((p) => p.key !== "schufa");
  const auskunft = pakete.filter((p) => p.key === "schufa");
  const akteZiel = akteWeg(erfolg?.personId, erfolg?.ref);

  /** „Zur Akte“ öffnet die Lade im selben Raum, wenn der Raum es anbietet. */
  const akteKlick = (e: MouseEvent) => {
    const id = erfolg?.personId != null ? Number(erfolg.personId) : 0;
    if (aufAkte && id > 0) { e.preventDefault(); aufAkte(id); }
  };

  return (
    /* data-fiaon="kunde-anlegen": Der Browsertest muss IN diesem Bauteil
       suchen können. Ohne Kennzeichen traf locator("select").first() die
       Sortier-Auswahl der Seite und getByPlaceholder("E-Mail") zusätzlich das
       Suchfeld — zwei Fehlalarme, die wie Fehler aussahen. (Dieselbe Lehre wie
       am 20.08.2026: Wer eine Tafel prüft, misst IN der Tafel.) */
    <div data-fiaon="kunde-anlegen" className="pi-anl">
      <div className="pi-anl-kopf">
        <div>
          <span className="pi-pille">{erfolg ? "Angelegt" : "Neuer Kunde"}</span>
          <h2>{erfolg ? "Kunde angelegt — und jetzt?" : "Kunde anlegen"}</h2>
          <p>
            {erfolg
              ? "Der Kunde steht auf „Zahlung offen“. Diese drei Schritte schließen das Gespräch ab."
              : "Vor- und Nachname, dazu E-Mail oder Telefon. Das Paket kannst du auch später wählen."}
          </p>
        </div>
        <button type="button" onClick={() => { zuruecksetzen(); aufKlappen(false); }}
                className="pi-anl-zu">
          Schließen
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          NACH DEM ANLEGEN: DIE DREI SCHRITTE
          ══════════════════════════════════════════════════════════════════ */}
      {erfolg ? (
        <>
          <div className="pi-anl-gut">
            <b>{erfolg.name} ist angelegt</b>
            {erfolg.paket ? (
              <>
                <span>{erfolg.paket.label} · {euro(erfolg.paket.preisEuro)}</span>
                <span className="zweck">Verwendungszweck {erfolg.zahlungsreferenz}</span>
              </>
            ) : (
              <span>Der Kunde gehört dir — er steht ab sofort in deiner Arbeitsliste.</span>
            )}
          </div>

          {/* Der seltene, aber teure Fall: Der Kontakt ist gespeichert, die
              Person nicht. Dann gehört der Kunde niemandem, steht in keiner
              Arbeitsliste und hat keinen Terminlink — das darf nicht still
              bleiben (der Server sagt es in „warnung“). */}
          {erfolg.warnung && <p className="pi-fehler">{erfolg.warnung}</p>}

          {/* Ohne Paket gibt es keine Bestellung: kein Betrag, keine Rechnung,
              kein Verwendungszweck. Das ehrlich sagen — mit dem Ausweg. */}
          {!erfolg.paket && (
            <div className="pi-sackgasse">
              <span>
                <b>Noch kein Paket gewählt</b>
                Ohne Produkt gibt es keine Rechnung und keinen Verwendungszweck — der
                Kunde kann noch nicht zahlen. In der Akte legst du es in einem Klick nach.
              </span>
              <a href={akteZiel} onClick={akteKlick} className="pi-knopf still">
                Produkt in der Akte hinzufügen
              </a>
            </div>
          )}

          {meldung && <p className="pi-meldung">{meldung}</p>}

          {/* ── 1. ZAHLUNGSDATEN ──────────────────────────────────────────── */}
          {erfolg.zahlungsreferenz && (
            <div className="pi-anl-schritt">
              <b><i>1</i> Zahlungsdaten</b>
              <div className="pi-reihe">
                <button type="button" disabled={laeuft}
                        onClick={async () => {
                          setLaeuft(true);
                          const j = await ruf(`/agent/customers/${encodeURIComponent(erfolg.ref)}/send-payment-email`);
                          setLaeuft(false);
                          setMeldung(j?.ok
                            ? "Zahlungsdaten sind unterwegs."
                            : `Die Mail ging nicht raus: ${j?.error ?? "unbekannt"}`);
                        }}
                        className="pi-knopf gross">
                  Zahlungsdaten senden
                </button>
                {/* ── DER WHATSAPP-WEG ────────────────────────────────────
                    Viele Kunden bekommen die Daten über WhatsApp, weil sie am
                    Telefon mitschreiben wollen. Ohne diesen Knopf tippt der
                    Agent den Verwendungszweck ab — und vertippt sich. */}
                <button type="button"
                        onClick={() => kopieren(
                          // Vom Server, mit IBAN — der frühere Text hier hatte keine,
                          // und ein Kunde konnte damit nicht überweisen.
                          (erfolg.zahlungsKlartext
                            ?? `FIAON — Zahlungsdaten\nVerwendungszweck: ${erfolg.zahlungsreferenz}\n`
                              + (erfolg.paket ? `Betrag: ${euro(erfolg.paket.preisEuro)}\n` : ""))
                          + `\nRechnung: ${window.location.origin}${erfolg.weiter?.rechnung ?? ""}`,
                          "zahlung")}
                        className="pi-knopf still gross">
                  {kopiert === "zahlung" ? "Kopiert" : "Zahlungsdaten kopieren"}
                </button>
                {erfolg.weiter?.rechnung && (
                  <a href={erfolg.weiter.rechnung} target="_blank" rel="noreferrer"
                     className="pi-knopf still gross">
                    Rechnung (PDF)
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── 2. TERMIN ─────────────────────────────────────────────────── */}
          <div className="pi-anl-schritt">
            <b><i>2</i> Termin anbieten</b>
            <p>
              Alle 120 gebuchten Termine kamen aus einem verschickten Link. Wer
              jetzt einen bekommt, bucht — später erreicht ihn niemand mehr.
            </p>
            <div className="pi-reihe">
              <button type="button" disabled={laeuft}
                      onClick={async () => {
                        setLaeuft(true);
                        const j = await ruf(`/agent/customers/${encodeURIComponent(erfolg.ref)}/termin-anbieten`,
                          { senden: true });
                        setLaeuft(false);
                        if (j?.link) setTerminLink(String(j.link));
                        setMeldung(j?.ok
                          ? `Terminlink ist unterwegs${j.an ? ` an ${j.an}` : ""}.`
                          : `${j?.error ?? "Der Versand ging nicht."}`);
                      }}
                      className="pi-knopf gross">
                Terminlink senden
              </button>
              <button type="button" disabled={laeuft}
                      onClick={async () => {
                        const j = await ruf(`/agent/customers/${encodeURIComponent(erfolg.ref)}/termin-anbieten`,
                          { senden: false });
                        if (j?.link) {
                          setTerminLink(String(j.link));
                          await kopieren(String(j.link), "termin");
                        } else {
                          setMeldung(String(j?.error ?? "Kein Link verfügbar."));
                        }
                      }}
                      className="pi-knopf still gross">
                {kopiert === "termin" ? "Kopiert" : "Terminlink kopieren"}
              </button>
            </div>
            {terminLink && <p className="pi-anl-link">{terminLink}</p>}
          </div>

          {/* ── 3. WEITER ─────────────────────────────────────────────────── */}
          <div className="pi-anl-schritt">
            <b><i>3</i> Weiter</b>
            <div className="pi-reihe">
              <a href={akteZiel} onClick={akteKlick} className="pi-knopf still gross">
                Zur Akte
              </a>
              <button type="button" onClick={zuruecksetzen} className="pi-link">
                Nächsten Kunden anlegen
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           DAS FORMULAR
           ══════════════════════════════════════════════════════════════════ */
        <>
          <div className="pi-anl-teil">
            <span className="pi-anl-titel">Wer ist es?</span>
            {/* Am Handy eine Spalte. Ab 700 px zwei — Vor- und Nachname gehören
                nebeneinander, weil sie zusammen gelesen werden. */}
            <div className="pi-anl-raster">
              <label className="pi-anl-feld">
                <span>Vorname</span>
                <input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })}
                       placeholder="Vorname" className="pi-eingabe" autoFocus />
              </label>
              <label className="pi-anl-feld">
                <span>Nachname</span>
                <input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })}
                       placeholder="Nachname" className="pi-eingabe" />
              </label>
              <label className={`pi-anl-feld${mailKlemmt ? " klemmt" : ""}`}>
                <span>E-Mail</span>
                <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
                       placeholder="E-Mail" type="email" inputMode="email" className="pi-eingabe" />
                {mailKlemmt && (
                  <em>Noch keine vollständige Adresse — es fehlt das @ oder die Endung.</em>
                )}
              </label>
              <label className={`pi-anl-feld${nummerKlemmt ? " klemmt" : ""}`}>
                <span>Telefon</span>
                <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })}
                       placeholder="Telefon" type="tel" inputMode="tel" className="pi-eingabe" />
                {nummerKlemmt && (
                  <em>
                    Zu kurz: {nummerZiffern} von mindestens {NUMMER_MINDEST} Ziffern. Mit 0
                    beginnen oder +49 davorsetzen — beides wird erkannt.
                  </em>
                )}
              </label>
            </div>
            <p className="pi-anl-hinweis">
              E-Mail <b>oder</b> Telefon genügt — aber eines von beiden muss da sein.
              Ohne Erreichbarkeit entsteht ein Datensatz, den niemand erreichen kann.
            </p>
          </div>

          {/* ── DER DUBLETTEN-HINWEIS ──────────────────────────────────────
              Er erscheint WÄHREND des Tippens, nicht erst beim Speichern. Wer
              alles eingetippt hat und dann hört „gibt es bereits“, hat umsonst
              gearbeitet. */}
          {treffer.length > 0 && (
            <div className="pi-anl-dublette">
              <b>
                {treffer.length === 1
                  ? "Diesen Menschen gibt es schon"
                  : `${treffer.length} Menschen tragen diese Daten`}
              </b>
              <ul>
                {treffer.map((t) => (
                  <li key={t.personId}>
                    <b>{t.name}</b>
                    <span>Treffer über {t.treffer}</span>
                    {/* Beschriftet statt „betreut von“ (30.08.2026) — siehe
                        shared/fiaon-zustaendigkeit-text.ts. */}
                    {t.agentName ? <span>· {LABEL_VERTRIEB}: {t.agentName}</span> : null}
                    {t.bezahlt ? <span className="pi-marke gut">zahlender Kunde</span> : null}
                    {/* VORHER ?ref= — die Seite liest nur ?person=, der Link
                        landete auf einer Seite ohne geöffnete Akte. */}
                    {t.personId > 0 && (
                      <a href={akteWeg(t.personId, t.ref)}
                         onClick={(e) => { if (aufAkte) { e.preventDefault(); aufAkte(Number(t.personId)); } }}>
                        Akte öffnen →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <p>
                Ein zweiter Datensatz für denselben Menschen lässt sich nur mit
                Aufwand zusammenführen. Wenn es derselbe ist: Akte öffnen und
                dort ein Produkt hinzufügen.
              </p>
            </div>
          )}

          {/* ── DAS PAKET AUS DEM KATALOG ────────────────────────────────
              VORHER ein natives select: Der Browser malt es in seinem eigenen
              Stil — auf dem Mac eine weiße Liste mitten im dunklen Glas.
              NACHHER Karten in der Office-Formensprache; die gewählte
              leuchtet, der Preis steht an der Karte. */}
          <div className="pi-anl-teil">
            <span className="pi-anl-titel">Paket (optional)</span>
            <div className="pi-pakete">
              <button type="button" onClick={() => setF({ ...f, packKey: "" })}
                      className={`pi-paket${f.packKey === "" ? " an" : ""}`}>
                <b>Noch kein Paket</b>
                <span>—</span>
                <em>später in der Akte</em>
              </button>
              {konten.map((p) => (
                <button key={p.key} type="button" onClick={() => setF({ ...f, packKey: p.key })}
                        className={`pi-paket${f.packKey === p.key ? " an" : ""}`}>
                  <b>{p.label}</b>
                  <span>{euro(p.preisEuro)}</span>
                  <em>{p.abo ? "monatlich" : "einmalig"}</em>
                </button>
              ))}
              {/* Die Auskunft steht am Ende: Sie ist ein Einmalkauf, kein Konto. */}
              {auskunft.map((p) => (
                <button key={p.key} type="button" onClick={() => setF({ ...f, packKey: p.key })}
                        className={`pi-paket${f.packKey === p.key ? " an" : ""}`}>
                  <b>{p.label}</b>
                  <span>{euro(p.preisEuro)}</span>
                  <em>einmalig</em>
                </button>
              ))}
            </div>
            {pakete.length === 0 && <p className="pi-anl-hinweis">Der Katalog lädt …</p>}
            {gewaehlt ? (
              <p className="pi-anl-hinweis">
                {euro(gewaehlt.preisEuro)}{gewaehlt.abo ? " monatlich" : " einmalig"} — der Preis
                kommt aus dem Katalog und ist nicht änderbar. Der Kunde steht danach sofort
                auf „Zahlung offen“ und bekommt einen Verwendungszweck.
              </p>
            ) : (
              <p className="pi-anl-hinweis warn">
                Ohne Paket entsteht nur der Kontakt, keine Bestellung: keine Rechnung,
                kein Verwendungszweck, keine Zahlung. Das ist in Ordnung, wenn das Paket
                noch offen ist — nachlegen kannst du es später in der Akte unter
                „Produkt hinzufügen“.
              </p>
            )}
          </div>

          {/* Adresse: eingeklappt, weil sie am Telefon selten sofort kommt. */}
          <details className="pi-anl-mehr">
            <summary>Adresse und Geburtsdatum (optional)</summary>
            <div>
              <div className="pi-anl-raster">
                <label className="pi-anl-feld">
                  <span>Straße</span>
                  <input value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })}
                         placeholder="Straße und Hausnummer" className="pi-eingabe" />
                </label>
                <label className="pi-anl-feld">
                  <span>PLZ</span>
                  <input value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })}
                         placeholder="PLZ" inputMode="numeric" className="pi-eingabe" />
                </label>
                <label className="pi-anl-feld">
                  <span>Ort</span>
                  <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}
                         placeholder="Ort" className="pi-eingabe" />
                </label>
                <label className="pi-anl-feld">
                  <span>Geburtsdatum</span>
                  <input value={f.birthdate} onChange={(e) => setF({ ...f, birthdate: e.target.value })}
                         type="date" className="pi-eingabe" />
                </label>
              </div>
            </div>
          </details>

          {fehler && <p className="pi-fehler">{fehler}</p>}

          <div className="pi-anl-fuss">
            <button type="button" onClick={() => void anlegen()} disabled={!kannAnlegen}
                    className="pi-knopf riesig">
              {laeuft ? "Legt an …" : "Kunde anlegen"}
            </button>
            {/* Eine gesperrte Schaltfläche ohne Grund ist eine Sackgasse. */}
            {!laeuft && fehlt.length > 0 && (
              <span className="pi-anl-fehlt">Es fehlt noch: <b>{fehlt.join(" · ")}</b></span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
