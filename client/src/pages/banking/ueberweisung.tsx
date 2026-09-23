// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Überweisung und Daueraufträge (E-228)
//
// Justin: „Wenn man einen Namen eintippt, soll sich das Feld schon ausfüllen."
// Der Empfänger ist ein Suchfeld über die Kartei (wer schon einmal bezahlt
// wurde) und die Mitarbeiter mit hinterlegter Bankverbindung. Die Wahl füllt
// IBAN, BIC und Kategorie — der Mensch prüft, statt abzuschreiben.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useId, useRef, useState } from "react";
import { ruf, type Auftrag, type Dauerauftrag, type Empfaenger, type Ich } from "./api";
import { betragText, centsAus, geld, heute, ibanHuebsch, ibanMaske, ibanSauber, ibanZustand, tag } from "./format";
import { Chip, Feld, Knopf, Kopierfeld, Leer, Meldung, Zeichen, useEntprellt } from "./ui";
import { TanDialog } from "./tan";

export const KATEGORIEN = [
  "Gehalt / Vergütung", "Provision", "Dienstleister", "Software / Lizenzen", "Werbung",
  "Miete / Büro", "Erstattung an Kunden", "Steuern / Abgaben", "Sonstiges",
];

// ── Das Empfänger-Suchfeld ──────────────────────────────────────────────────
export function EmpfaengerFeld({ wert, onText, onWahl }: {
  wert: string; onText: (t: string) => void; onWahl: (e: Empfaenger) => void;
}) {
  const id = useId();
  const [offen, setOffen] = useState(false);
  const [liste, setListe] = useState<Empfaenger[]>([]);
  const [aktiv, setAktiv] = useState(0);
  const [gesucht, setGesucht] = useState(false);
  const suche = useEntprellt(wert, 180);
  const gewaehltRef = useRef(false);

  useEffect(() => {
    if (gewaehltRef.current) { gewaehltRef.current = false; return; }
    if (suche.trim().length < 2) { setListe([]); setGesucht(false); return; }
    let weg = false;
    ruf<{ vorschlaege: Empfaenger[] }>(`/buchhaltung/empfaenger?q=${encodeURIComponent(suche.trim())}`)
      .then((j) => { if (!weg) { setListe(j.vorschlaege); setAktiv(0); setGesucht(true); setOffen(true); } })
      .catch(() => { if (!weg) setListe([]); });
    return () => { weg = true; };
  }, [suche]);

  const waehlen = (e: Empfaenger) => {
    gewaehltRef.current = true;
    onWahl(e); setOffen(false); setListe([]);
  };

  return (
    <div className="bk-combo">
      <input id={id} role="combobox" aria-expanded={offen && liste.length > 0} aria-controls={`${id}-liste`} aria-autocomplete="list"
        aria-activedescendant={offen && liste[aktiv] ? `${id}-o${aktiv}` : undefined}
        value={wert} autoComplete="off" placeholder="Name oder Firma — Vorschläge erscheinen beim Tippen"
        onChange={(e) => { onText(e.target.value); setOffen(true); }}
        onFocus={() => liste.length && setOffen(true)}
        onBlur={() => setTimeout(() => setOffen(false), 150)}
        onKeyDown={(e) => {
          if (!offen || !liste.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((a) => Math.min(liste.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); waehlen(liste[aktiv]); }
          else if (e.key === "Escape") setOffen(false);
        }} />
      {offen && (liste.length > 0 || gesucht) ? (
        <ul className="bk-combo-liste" id={`${id}-liste`} role="listbox">
          {liste.length === 0 ? <li className="bk-combo-leer">Kein gespeicherter Empfänger — einfach weiter eintragen.</li> : null}
          {liste.map((e, i) => (
            <li key={e.schluessel} id={`${id}-o${i}`} role="option" aria-selected={i === aktiv}
              className={i === aktiv ? "aktiv" : ""} onMouseDown={(ev) => { ev.preventDefault(); waehlen(e); }} onMouseEnter={() => setAktiv(i)}>
              <span className="bk-combo-av">{e.quelle === "mitarbeiter" ? <Zeichen n="person" g={14} /> : <Zeichen n="kartei" g={14} />}</span>
              <span className="bk-combo-t">
                <strong>{e.name}</strong>
                <span className="bk-mono">{ibanMaske(e.iban)}</span>
              </span>
              <Chip art={e.quelle === "mitarbeiter" ? "tief" : "still"}>{e.hinweis ?? (e.quelle === "mitarbeiter" ? "Mitarbeiter" : "Kartei")}</Chip>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** IBAN-Feld: formatiert beim Verlassen, prüft beim Tippen. */
export function IbanFeld({ id, wert, onWert }: { id: string; wert: string; onWert: (w: string) => void }) {
  const z = ibanZustand(wert);
  return (
    <div className={`bk-iban-feld bk-iban-${z.art}`}>
      <input id={id} value={wert} spellCheck={false} autoComplete="off" placeholder="DE00 0000 0000 0000 0000 00"
        onChange={(e) => onWert(e.target.value.toUpperCase())}
        onBlur={() => onWert(ibanHuebsch(wert))} />
      <span className="bk-iban-zeichen" aria-hidden="true">
        {z.art === "gut" ? <Zeichen n="haken" g={16} /> : z.art === "falsch" ? <Zeichen n="warnung" g={16} /> : null}
      </span>
      <span className={`bk-feld-h bk-iban-text-${z.art}`} aria-live="polite">{z.text || "Wird mit der Prüfziffer geprüft."}</span>
    </div>
  );
}

// ── Die Überweisung ─────────────────────────────────────────────────────────
interface Entwurf {
  empfaenger: string; iban: string; bic: string; betrag: string; zweck: string; kategorie: string; faelligAm: string;
  beleg: { name: string; base64: string } | null; quelle: string | null;
}
const LEER: Entwurf = { empfaenger: "", iban: "", bic: "", betrag: "", zweck: "", kategorie: "", faelligAm: heute(), beleg: null, quelle: null };

export default function Ueberweisung({ ich, onFertig }: { ich: Ich; onFertig: () => void }) {
  const [f, setF] = useState<Entwurf>(LEER);
  const [schritt, setSchritt] = useState<"erfassen" | "pruefen" | "fertig">("erfassen");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [tanOffen, setTanOffen] = useState(false);
  const [ref, setRef] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const inhaber = ich.rolle === "inhaber";
  const setz = <K extends keyof Entwurf>(k: K, v: Entwurf[K]) => setF((x) => ({ ...x, [k]: v }));

  const cents = centsAus(f.betrag);
  const ibanOk = ibanZustand(f.iban).art === "gut";
  const probleme = [
    !f.empfaenger.trim() && "Empfänger fehlt",
    !ibanOk && "IBAN prüfen",
    !(cents > 0) && "Betrag fehlt",
    !f.zweck.trim() && "Verwendungszweck fehlt",
  ].filter(Boolean) as string[];

  const datei = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.files?.[0];
    if (!d) return;
    if (d.size > 6 * 1024 * 1024) { setFehler("Der Beleg ist größer als 6 MB."); return; }
    const leser = new FileReader();
    leser.onload = () => setz("beleg", { name: d.name, base64: String(leser.result || "").replace(/^data:[^,]+,/, "") });
    leser.readAsDataURL(d);
  };

  const anlegen = async (einreichen: boolean): Promise<Auftrag | null> => {
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf<{ auftrag: Auftrag }>("/buchhaltung/auftrag", {
        body: {
          empfaenger: f.empfaenger, iban: ibanSauber(f.iban), bic: f.bic, betrag: f.betrag, zweck: f.zweck,
          kategorie: f.kategorie, faelligAm: f.faelligAm, belegName: f.beleg?.name ?? null, belegBase64: f.beleg?.base64 ?? null,
          einreichen,
        },
      });
      setAuftrag(j.auftrag);
      return j.auftrag;
    } catch (e: any) { setFehler(e.message); return null; } finally { setLaeuft(false); }
  };

  const absenden = async () => {
    if (inhaber) {
      const a = auftrag ?? (await anlegen(false));
      if (a) setTanOffen(true);
    } else {
      const a = await anlegen(true);
      if (a) setSchritt("fertig");
    }
  };

  const ausfuehren = async () => {
    if (!auftrag) return;
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf<{ auftrag: Auftrag; hinweis: string | null }>(`/buchhaltung/auftrag/${auftrag.id}/ausfuehren`, { body: { bankReferenz: ref, wertAm: heute() } });
      setAuftrag(j.auftrag); setMeldung(j.hinweis || "Überweisung eingetragen. Die Zahlungsbestätigung liegt bereit.");
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const neu = () => { setF(LEER); setAuftrag(null); setSchritt("erfassen"); setRef(""); setMeldung(null); setFehler(null); onFertig(); };

  if (schritt === "fertig" && auftrag) {
    const freigegeben = auftrag.status === "freigegeben";
    const ausgefuehrt = auftrag.status === "ausgefuehrt";
    return (
      <div className="bk-seite bk-schmal">
        <section className="bk-karte bk-ergebnis">
          <div className={`bk-ergebnis-siegel${ausgefuehrt ? " gut" : ""}`}><Zeichen n={ausgefuehrt ? "haken" : freigegeben ? "schild" : "uhr"} g={26} /></div>
          <h2>{ausgefuehrt ? "Überweisung eingetragen" : freigegeben ? "Freigegeben" : "Zur Freigabe eingereicht"}</h2>
          <p className="bk-leise">
            {ausgefuehrt ? `${auftrag.nummer} ist gebucht.`
              : freigegeben ? `${auftrag.nummer} ist mit deiner TAN freigegeben. Jetzt im Geschäftskonto überweisen und danach die Bankreferenz eintragen.`
              : `${auftrag.nummer} liegt beim Inhaber zur Freigabe. Er bekommt eine Nachricht.`}
          </p>
          {freigegeben ? (
            <>
              <div className="bk-abschreib">
                <Kopierfeld l="Empfänger" w={auftrag.empfaenger} mono={false} />
                <Kopierfeld l="IBAN" w={ibanHuebsch(auftrag.iban)} />
                {auftrag.bic ? <Kopierfeld l="BIC" w={auftrag.bic} /> : null}
                <Kopierfeld l="Betrag" w={betragText(auftrag.betragCents)} />
                <Kopierfeld l="Verwendungszweck" w={auftrag.zweck} mono={false} />
              </div>
              <div className="bk-ausfuehren">
                <Feld id="bk-ref" l="Referenz der Bank" hinweis="Die Nummer, unter der die Überweisung im Konto steht.">
                  <input id="bk-ref" value={ref} onChange={(e) => setRef(e.target.value)} spellCheck={false} />
                </Feld>
                <Knopf art="primaer" zeichen="haken" disabled={!ref.trim() || laeuft} onClick={() => void ausfuehren()}>Überweisung eintragen</Knopf>
              </div>
            </>
          ) : null}
          {meldung ? <Meldung art="gut">{meldung}</Meldung> : null}
          {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
          <div className="bk-knopfreihe bk-mitte">
            {ausgefuehrt ? <a className="bk-knopf bk-knopf-neutral" href={`/api/fiaon/buchhaltung/auftrag/${auftrag.id}/bestaetigung.pdf`} target="_blank" rel="noreferrer"><Zeichen n="pdf" g={16} /><span>Zahlungsbestätigung</span></a> : null}
            <Knopf art="still" onClick={neu}>Weitere Überweisung</Knopf>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bk-seite bk-schmal">
      <div className="bk-schritte" aria-label="Fortschritt">
        <span className={schritt === "erfassen" ? "aktiv" : "fertig"}><i>1</i>Erfassen</span>
        <span className={schritt === "pruefen" ? "aktiv" : ""}><i>2</i>Prüfen</span>
        <span><i>3</i>{inhaber ? "Mit TAN freigeben" : "Einreichen"}</span>
      </div>

      {schritt === "erfassen" ? (
        <section className="bk-karte bk-formkarte">
          <div className="bk-gitter">
            <Feld id="bk-emp" l="Empfänger" breit hinweis={f.quelle ? <span className="bk-gut-text"><Zeichen n="haken" g={12} /> {f.quelle}</span> : "Tippen Sie den Namen — gespeicherte Empfänger füllen IBAN und BIC selbst."}>
              <EmpfaengerFeld wert={f.empfaenger}
                onText={(t) => setF((x) => ({ ...x, empfaenger: t, quelle: null }))}
                onWahl={(e) => setF((x) => ({
                  ...x, empfaenger: e.name, iban: ibanHuebsch(e.iban), bic: e.bic ?? "",
                  kategorie: x.kategorie || e.kategorie || "", quelle: e.quelle === "mitarbeiter" ? "Bankverbindung aus der Mitarbeiterakte übernommen" : "Aus der Empfänger-Kartei übernommen",
                }))} />
            </Feld>
            <Feld id="bk-iban" l="IBAN">
              <IbanFeld id="bk-iban" wert={f.iban} onWert={(w) => setz("iban", w)} />
            </Feld>
            <Feld id="bk-bic" l="BIC" hinweis="Innerhalb des SEPA-Raums nicht zwingend.">
              <input id="bk-bic" value={f.bic} onChange={(e) => setz("bic", e.target.value.toUpperCase())} spellCheck={false} maxLength={11} />
            </Feld>
            <Feld id="bk-betrag" l="Betrag">
              <div className="bk-betrag-feld">
                <input id="bk-betrag" value={f.betrag} inputMode="decimal" placeholder="0,00"
                  onChange={(e) => setz("betrag", e.target.value)}
                  onBlur={() => { if (cents > 0) setz("betrag", betragText(cents)); }} />
                <span>EUR</span>
              </div>
            </Feld>
            <Feld id="bk-datum" l="Ausführen am">
              <input id="bk-datum" type="date" value={f.faelligAm} min={heute()} onChange={(e) => setz("faelligAm", e.target.value)} />
            </Feld>
            <Feld id="bk-zweck" l="Verwendungszweck" breit hinweis={`${f.zweck.length} / 140 Zeichen`}>
              <input id="bk-zweck" value={f.zweck} maxLength={140} onChange={(e) => setz("zweck", e.target.value)} placeholder="Rechnung 2026-114 · September" />
            </Feld>
            <Feld id="bk-kat" l="Kategorie">
              <select id="bk-kat" value={f.kategorie} onChange={(e) => setz("kategorie", e.target.value)}>
                <option value="">— wählen —</option>
                {KATEGORIEN.map((k) => <option key={k}>{k}</option>)}
              </select>
            </Feld>
            <Feld id="bk-beleg" l="Beleg (PDF oder Bild)" hinweis={f.beleg ? `Angehängt: ${f.beleg.name}` : "Rechnung oder Nachweis — hilft bei der Freigabe."}>
              <input id="bk-beleg" type="file" accept=".pdf,image/*" onChange={datei} />
            </Feld>
          </div>
          {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
          <div className="bk-form-fuss">
            <span className="bk-leise">{probleme.length ? probleme.join(" · ") : "Alles vollständig."}</span>
            <Knopf art="primaer" zeichen="rechts" disabled={probleme.length > 0} onClick={() => setSchritt("pruefen")}>Weiter zur Prüfung</Knopf>
          </div>
        </section>
      ) : (
        <section className="bk-karte bk-beleg">
          <div className="bk-beleg-kopf">
            <span className="bk-beleg-art">Überweisung · SEPA</span>
            <span className="bk-beleg-betrag">{geld(cents)}</span>
          </div>
          <div className="bk-beleg-parteien">
            <div><span>Von</span><strong>FIAON LTD</strong><em className="bk-mono">Geschäftskonto</em></div>
            <Zeichen n="rechts" g={20} />
            <div><span>An</span><strong>{f.empfaenger}</strong><em className="bk-mono">{ibanHuebsch(f.iban)}{f.bic ? ` · ${f.bic}` : ""}</em></div>
          </div>
          <dl className="bk-dl">
            <dt>Verwendungszweck</dt><dd>{f.zweck}</dd>
            <dt>Ausführen am</dt><dd>{tag(f.faelligAm)}</dd>
            <dt>Kategorie</dt><dd>{f.kategorie || "—"}</dd>
            <dt>Beleg</dt><dd>{f.beleg ? f.beleg.name : "keiner"}</dd>
            <dt>Freigabe</dt><dd>{inhaber ? "Einzelzeichnung durch dich, mit TAN" : "Vier Augen — der Inhaber gibt mit TAN frei"}</dd>
          </dl>
          {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
          <div className="bk-form-fuss">
            <Knopf art="still" zeichen="links" disabled={laeuft} onClick={async () => {
              // Ein schon angelegter Entwurf gehört zu den alten Angaben — er wird verworfen, sonst gäbe die TAN den falschen frei.
              if (auftrag && auftrag.status === "entwurf") {
                await ruf(`/buchhaltung/auftrag/${auftrag.id}/zurueckziehen`, { body: {} }).catch(() => null);
                setAuftrag(null);
              }
              setSchritt("erfassen");
            }}>Ändern</Knopf>
            <Knopf art="primaer" zeichen={inhaber ? "schloss" : "senden"} disabled={laeuft} onClick={() => void absenden()}>
              {laeuft ? "Lege an …" : inhaber ? "Mit TAN freigeben" : "Zur Freigabe einreichen"}
            </Knopf>
          </div>
        </section>
      )}

      {auftrag ? (
        <TanDialog offen={tanOffen} titel={`Freigabe ${auftrag.nummer}`}
          anfordern={() => ruf<{ beschreibung: string; an: string }>(`/buchhaltung/auftrag/${auftrag.id}/tan`, { body: {} })}
          bestaetigen={async (tan) => { const j = await ruf<{ auftrag: Auftrag }>(`/buchhaltung/auftrag/${auftrag.id}/freigeben`, { body: { tan } }); setAuftrag(j.auftrag); }}
          onZu={() => setTanOffen(false)}
          onFertig={() => { setTanOffen(false); setSchritt("fertig"); }}
          knopf="Freigeben" />
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DAUERAUFTRÄGE
// ═══════════════════════════════════════════════════════════════════════════
export function Dauerauftraege({ liste, ich, onNeu }: { liste: Dauerauftrag[]; ich: Ich; onNeu: () => void }) {
  const [f, setF] = useState({ empfaenger: "", iban: "", bic: "", betrag: "", zweck: "", kategorie: "", tagImMonat: "1", ab: heute() });
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const aktiv = liste.filter((d) => !d.beendetAm);
  const beendet = liste.filter((d) => d.beendetAm);
  const ok = f.empfaenger.trim() && ibanZustand(f.iban).art === "gut" && centsAus(f.betrag) > 0 && f.zweck.trim();

  const anlegen = async () => {
    setLaeuft(true); setFehler(null);
    try {
      await ruf("/buchhaltung/dauerauftrag", { body: { ...f, iban: ibanSauber(f.iban), tagImMonat: Number(f.tagImMonat) } });
      setOffen(false); setF({ empfaenger: "", iban: "", bic: "", betrag: "", zweck: "", kategorie: "", tagImMonat: "1", ab: heute() });
      onNeu();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const beenden = async (id: number) => {
    if (!window.confirm("Diesen Dauerauftrag beenden? Bereits angelegte Zahlungsaufträge bleiben bestehen.")) return;
    try { await ruf(`/buchhaltung/dauerauftrag/${id}/beenden`, { body: {} }); onNeu(); } catch (e: any) { setFehler(e.message); }
  };

  return (
    <div className="bk-seite">
      <Meldung art="info">Ein Dauerauftrag überweist nie selbst. Am Fälligkeitstag legt er einen Zahlungsauftrag an und reicht ihn ein — freigegeben wird er wie jede Zahlung, mit TAN.</Meldung>
      <section className="bk-karte">
        <header className="bk-karte-kopf">
          <h2>Aktive Daueraufträge</h2>
          <Knopf art="primaer" zeichen="plus" klein onClick={() => setOffen((o) => !o)}>{offen ? "Schließen" : "Neuer Dauerauftrag"}</Knopf>
        </header>
        {offen ? (
          <div className="bk-einschub">
            <div className="bk-gitter">
              <Feld id="da-emp" l="Empfänger" breit>
                <EmpfaengerFeld wert={f.empfaenger} onText={(t) => setF((x) => ({ ...x, empfaenger: t }))}
                  onWahl={(e) => setF((x) => ({ ...x, empfaenger: e.name, iban: ibanHuebsch(e.iban), bic: e.bic ?? "", kategorie: x.kategorie || e.kategorie || "" }))} />
              </Feld>
              <Feld id="da-iban" l="IBAN"><IbanFeld id="da-iban" wert={f.iban} onWert={(w) => setF((x) => ({ ...x, iban: w }))} /></Feld>
              <Feld id="da-bic" l="BIC"><input id="da-bic" value={f.bic} onChange={(e) => setF((x) => ({ ...x, bic: e.target.value.toUpperCase() }))} maxLength={11} /></Feld>
              <Feld id="da-betrag" l="Betrag je Monat">
                <div className="bk-betrag-feld"><input id="da-betrag" inputMode="decimal" value={f.betrag} onChange={(e) => setF((x) => ({ ...x, betrag: e.target.value }))} placeholder="0,00" /><span>EUR</span></div>
              </Feld>
              <Feld id="da-tag" l="Am Tag des Monats" hinweis="Gibt es den Tag im Monat nicht, gilt der letzte.">
                <select id="da-tag" value={f.tagImMonat} onChange={(e) => setF((x) => ({ ...x, tagImMonat: e.target.value }))}>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}.</option>)}
                </select>
              </Feld>
              <Feld id="da-ab" l="Erstmals ab"><input id="da-ab" type="date" value={f.ab} min={heute()} onChange={(e) => setF((x) => ({ ...x, ab: e.target.value }))} /></Feld>
              <Feld id="da-zweck" l="Verwendungszweck" breit hinweis="Der Monat wird automatisch angehängt."><input id="da-zweck" value={f.zweck} maxLength={120} onChange={(e) => setF((x) => ({ ...x, zweck: e.target.value }))} /></Feld>
              <Feld id="da-kat" l="Kategorie">
                <select id="da-kat" value={f.kategorie} onChange={(e) => setF((x) => ({ ...x, kategorie: e.target.value }))}>
                  <option value="">— wählen —</option>{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}
                </select>
              </Feld>
            </div>
            {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
            <div className="bk-form-fuss"><span /><Knopf art="primaer" disabled={!ok || laeuft} onClick={() => void anlegen()}>{laeuft ? "Lege an …" : "Dauerauftrag anlegen"}</Knopf></div>
          </div>
        ) : null}
        {aktiv.length === 0 ? <Leer titel="Keine Daueraufträge" text="Wiederkehrende Zahlungen wie Miete oder Software lassen sich hier einmal anlegen." /> : (
          <div className="bk-tabelle-rolle">
            <table className="bk-tabelle">
              <thead><tr><th>Empfänger</th><th>Rhythmus</th><th>Nächste</th><th className="bk-r">Betrag</th><th /></tr></thead>
              <tbody>{aktiv.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.empfaenger}</strong><span className="bk-klein bk-mono">{ibanMaske(d.iban)}</span><span className="bk-klein">{d.zweck}</span></td>
                  <td>monatlich zum {d.tagImMonat}.</td>
                  <td>{tag(d.naechsteAm)}</td>
                  <td className="bk-r">{geld(d.betragCents)}</td>
                  <td className="bk-r">{(d.erstelltVon === ich.email || ich.rolle === "inhaber") ? <Knopf art="still" klein onClick={() => void beenden(d.id)}>Beenden</Knopf> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {beendet.length ? <p className="bk-fussnote">{beendet.length} beendete Daueraufträge im Protokoll.</p> : null}
      </section>
    </div>
  );
}
