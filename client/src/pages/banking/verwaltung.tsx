// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Empfänger, Sicherheit, Kontostand (E-228)
//
// Der Kontostand gehört dem Inhaber: Anfangsbestand, Einlage, Eingang,
// Ausgabe, Korrektur und Storno — jeweils mit TAN. Der Bankabgleich bewegt
// nichts, er hält fest, was die Bank zeigte.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { ruf, type Empfaenger, type Ich, type Lage, type Umsatz } from "./api";
import { centsAus, geld, geldVz, gestern, heute, ibanHuebsch, tag, zeit } from "./format";
import { Chip, Feld, Knopf, Laden, Leer, Meldung, Zeichen } from "./ui";
import { TanDialog } from "./tan";

// ═══════════════════════════════════════════════════════════════════════════
// EMPFÄNGER
// ═══════════════════════════════════════════════════════════════════════════
export function EmpfaengerSeite() {
  const [kartei, setKartei] = useState<(Empfaenger & { id: number })[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const laden = useCallback(() => {
    ruf<{ kartei: (Empfaenger & { id: number })[] }>("/buchhaltung/empfaenger/kartei").then((j) => setKartei(j.kartei)).catch((e) => setFehler(e.message));
  }, []);
  useEffect(() => { laden(); }, [laden]);
  const liste = useMemo(() => (kartei || []).filter((e) => !q || `${e.name} ${e.iban}`.toLowerCase().includes(q.toLowerCase())), [kartei, q]);

  const loeschen = async (e: Empfaenger & { id: number }) => {
    if (!window.confirm(`${e.name} aus der Kartei nehmen? Bereits gebuchte Zahlungen bleiben unverändert.`)) return;
    try { await ruf(`/buchhaltung/empfaenger/${e.id}/loeschen`, { body: {} }); laden(); } catch (err: any) { setFehler(err.message); }
  };

  return (
    <div className="bk-seite">
      <Meldung art="info">Jeder Empfänger, an den eine Überweisung angelegt wird, landet automatisch in der Kartei. Mitarbeiter mit hinterlegter Bankverbindung erscheinen beim Tippen zusätzlich — aus ihrer Akte, nicht aus dieser Liste.</Meldung>
      <section className="bk-karte">
        <header className="bk-karte-kopf">
          <h2>Empfänger-Kartei</h2>
          <div className="bk-such bk-such-klein"><Zeichen n="suche" g={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" aria-label="Kartei durchsuchen" /></div>
        </header>
        {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
        {!kartei ? <Laden /> : liste.length === 0 ? <Leer titel="Kartei leer" text="Der erste Eintrag entsteht mit der ersten Überweisung." /> : (
          <div className="bk-tabelle-rolle">
            <table className="bk-tabelle">
              <thead><tr><th>Name</th><th>IBAN</th><th>BIC</th><th>Kategorie</th><th>Zuletzt</th><th /></tr></thead>
              <tbody>{liste.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong></td>
                  <td className="bk-mono">{ibanHuebsch(e.iban)}</td>
                  <td className="bk-mono">{e.bic || "—"}</td>
                  <td>{e.kategorie || "—"}</td>
                  <td>{e.zuletztGenutzt ? tag(e.zuletztGenutzt) : "—"}</td>
                  <td className="bk-r"><Knopf klein art="still" onClick={() => void loeschen(e)}>Entfernen</Knopf></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SICHERHEIT
// ═══════════════════════════════════════════════════════════════════════════
interface SitzungZeile { sid: string; person: string; name: string; erstelltAm: string; zuletztAktiv: string; ip: string; geraet: string; aktiv: boolean; beendetAm: string | null; beendetGrund: string | null; diese: boolean }
interface ProtokollZeile { person: string | null; name: string; aktion: string; ziel: string | null; notiz: string | null; zeit: string }

export function SicherheitSeite({ ich }: { ich: Ich }) {
  const [daten, setDaten] = useState<{ sitzungen: SitzungZeile[]; gesperrt: string[]; leute: Ich[]; protokoll: ProtokollZeile[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [wer, setWer] = useState("");
  const laden = useCallback(() => {
    ruf<{ sitzungen: SitzungZeile[]; gesperrt: string[]; leute: Ich[]; protokoll: ProtokollZeile[] }>("/buchhaltung/sicherheit").then(setDaten).catch((e) => setFehler(e.message));
  }, []);
  useEffect(() => { laden(); }, [laden]);

  const andereBeenden = async () => {
    try { const j = await ruf<{ beendet: number }>("/buchhaltung/sitzungen/andere-beenden", { body: {} }); setMeldung(`${j.beendet} Sitzung(en) beendet.`); laden(); }
    catch (e: any) { setFehler(e.message); }
  };
  const sperre = async (email: string, gesperrt: boolean) => {
    if (gesperrt && !window.confirm("Zugang sofort sperren? Laufende Sitzungen enden, ein neuer PIN wird nicht mehr verschickt.")) return;
    try { await ruf("/buchhaltung/zugang/sperre", { body: { email, gesperrt } }); setMeldung(gesperrt ? "Zugang gesperrt." : "Zugang wieder geöffnet."); laden(); }
    catch (e: any) { setFehler(e.message); }
  };

  if (!daten) return <div className="bk-seite">{fehler ? <Meldung art="fehler">{fehler}</Meldung> : <Laden zeilen={8} />}</div>;
  const diese = daten.sitzungen.find((s) => s.diese);
  const protokoll = daten.protokoll.filter((p) => !wer || p.person === wer);

  return (
    <div className="bk-seite">
      {meldung ? <Meldung art="gut" onZu={() => setMeldung(null)}>{meldung}</Meldung> : null}
      {fehler ? <Meldung art="fehler" onZu={() => setFehler(null)}>{fehler}</Meldung> : null}
      <div className="bk-zwei">
        <section className="bk-karte">
          <header className="bk-karte-kopf"><h2>Diese Sitzung</h2><Chip art="gut" zeichen="schloss">Gesichert</Chip></header>
          <dl className="bk-dl">
            <dt>Angemeldet</dt><dd>{ich.name}</dd>
            <dt>Gerät</dt><dd>{diese?.geraet || "—"}</dd>
            <dt>Seit</dt><dd>{zeit(diese?.erstelltAm)}</dd>
            <dt>Adresse</dt><dd className="bk-mono">{diese?.ip || "—"}</dd>
          </dl>
          <ul className="bk-sicher-liste">
            <li><Zeichen n="schloss" g={15} /> Zwei Faktoren: Passwort und Einmal-PIN an die eigene Adresse</li>
            <li><Zeichen n="schild" g={15} /> TAN für jede Freigabe und jede Bewegung des Kontostands, gebunden an den Vorgang</li>
            <li><Zeichen n="uhr" g={15} /> Abmeldung nach 10 Minuten ohne Eingabe, spätestens nach 8 Stunden</li>
            <li><Zeichen n="auftraege" g={15} /> Jede Handlung mit Name und Uhrzeit im Protokoll</li>
          </ul>
          <div className="bk-knopfreihe"><Knopf onClick={() => void andereBeenden()} zeichen="abmelden">Alle anderen Sitzungen beenden</Knopf></div>
        </section>

        {ich.rolle === "inhaber" ? (
          <section className="bk-karte">
            <header className="bk-karte-kopf"><h2>Zugänge</h2></header>
            <ul className="bk-zugaenge">
              {daten.leute.map((p) => {
                const gesperrt = daten.gesperrt.includes(p.email);
                return (
                  <li key={p.email}>
                    <span><strong>{p.name}</strong><em>{p.titel} · {p.email}</em></span>
                    {p.rolle === "inhaber" ? <Chip art="tief">Inhaber</Chip>
                      : gesperrt ? <Knopf klein onClick={() => void sperre(p.email, false)}>Wieder öffnen</Knopf>
                      : <Knopf klein art="warnung" zeichen="schloss" onClick={() => void sperre(p.email, true)}>Sofort sperren</Knopf>}
                  </li>
                );
              })}
            </ul>
            <p className="bk-fussnote">Sperren beendet alle Sitzungen der Person sofort. Bei jeder Anmeldung der Buchhaltung bekommst du eine Mail.</p>
          </section>
        ) : null}
      </div>

      <section className="bk-karte">
        <header className="bk-karte-kopf"><h2>Sitzungen der letzten 30 Tage</h2></header>
        <div className="bk-tabelle-rolle">
          <table className="bk-tabelle">
            <thead><tr><th>Person</th><th>Gerät</th><th>Adresse</th><th>Beginn</th><th>Zuletzt aktiv</th><th>Stand</th></tr></thead>
            <tbody>{daten.sitzungen.map((s) => (
              <tr key={s.sid + s.erstelltAm}>
                <td><strong>{s.name}</strong>{s.diese ? <span className="bk-klein">diese Sitzung</span> : null}</td>
                <td>{s.geraet}</td>
                <td className="bk-mono">{s.ip}</td>
                <td>{zeit(s.erstelltAm)}</td>
                <td>{zeit(s.zuletztAktiv)}</td>
                <td>{s.aktiv ? <Chip art="gut">Aktiv</Chip> : <Chip art="still">{s.beendetGrund || "Abgelaufen"}</Chip>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="bk-karte">
        <header className="bk-karte-kopf">
          <h2>Protokoll</h2>
          <select className="bk-auswahl" value={wer} onChange={(e) => setWer(e.target.value)} aria-label="Person">
            <option value="">Alle</option>
            {daten.leute.map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}
          </select>
        </header>
        <div className="bk-tabelle-rolle">
          <table className="bk-tabelle">
            <thead><tr><th>Zeit</th><th>Wer</th><th>Was</th><th>Worauf</th></tr></thead>
            <tbody>{protokoll.map((p, i) => (
              <tr key={i}>
                <td className="bk-nw">{zeit(p.zeit)}</td>
                <td>{p.name}</td>
                <td>{p.aktion}{p.notiz ? <span className="bk-klein">{p.notiz}</span> : null}</td>
                <td className="bk-mono">{p.ziel || ""}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// KONTOSTAND — nur der Inhaber
// ═══════════════════════════════════════════════════════════════════════════
type Vorgang = Record<string, unknown> & { art: string };

export function KontostandSeite({ lage, onNeu }: { lage: Lage; onNeu: () => void }) {
  const k = lage.kasse;
  const [anfang, setAnfang] = useState({ betrag: "", am: gestern(), notiz: "" });
  const [buchung, setBuchung] = useState({ art: "einlage", betrag: "", wertAm: heute(), zweck: "", gegenpartei: "", beleg: "", minus: false });
  const [abgleich, setAbgleich] = useState({ betrag: "", am: gestern() });
  const [ueb, setUeb] = useState({ bisher: lage.uebergabe?.bisher ?? "", stichtag: lage.uebergabe?.stichtag ?? heute() });
  const [vorgang, setVorgang] = useState<Vorgang | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [manuell, setManuell] = useState<Umsatz[] | null>(null);
  const [storno, setStorno] = useState<{ id: number; grund: string } | null>(null);

  const ladeManuell = useCallback(() => {
    ruf<{ zeilen: Umsatz[] }>("/buchhaltung/umsaetze?arten=einlage,eingang,ausgabe,korrektur&limit=100").then((j) => setManuell(j.zeilen)).catch(() => setManuell([]));
  }, []);
  useEffect(() => { ladeManuell(); }, [ladeManuell]);

  const fertig = (text: string) => { setVorgang(null); setMeldung(text); onNeu(); ladeManuell(); };

  const buchungsVorgang = (): Vorgang => ({
    art: buchung.art, wertAm: buchung.wertAm, zweck: buchung.zweck, gegenpartei: buchung.gegenpartei, beleg: buchung.beleg,
    betrag: buchung.art === "korrektur" && buchung.minus ? `-${buchung.betrag.replace(/^-/, "")}` : buchung.betrag.replace(/^-/, ""),
  });

  const abgleichSpeichern = async () => {
    setFehler(null);
    try { await ruf("/buchhaltung/kasse/abgleich", { body: abgleich }); setMeldung("Bankabgleich erfasst."); onNeu(); }
    catch (e: any) { setFehler(e.message); }
  };
  const uebergabeSpeichern = async () => {
    setFehler(null);
    try { await ruf("/buchhaltung/uebergabe", { body: ueb }); setMeldung("Übergabe hinterlegt."); onNeu(); }
    catch (e: any) { setFehler(e.message); }
  };

  const titel = vorgang?.art === "anfang" ? "Anfangsbestand setzen" : vorgang?.art === "storno" ? "Buchung stornieren" : "Buchung ausführen";

  return (
    <div className="bk-seite">
      <Meldung art="info">Nur du bewegst den Kontostand. Jede Bewegung braucht eine TAN, steht mit deinem Namen im Protokoll und ist in Umsätzen und Auszügen als „von Hand“ gekennzeichnet.</Meldung>
      {meldung ? <Meldung art="gut" onZu={() => setMeldung(null)}>{meldung}</Meldung> : null}
      {fehler ? <Meldung art="fehler" onZu={() => setFehler(null)}>{fehler}</Meldung> : null}

      <div className="bk-zwei">
        <section className="bk-karte">
          <header className="bk-karte-kopf"><h2>Anfangsbestand</h2>{k.anfang ? <Chip art="gut">{geld(k.anfang.cents)} · Ende {tag(k.anfang.am)}</Chip> : <Chip art="warn">Nicht gesetzt</Chip>}</header>
          <p className="bk-hinweis">Der Endstand eines Tages laut Bank — ab dem Folgetag zählt das Buch jeden Eingang und jede Auszahlung selbst dazu.</p>
          <div className="bk-gitter">
            <Feld id="an-b" l="Kontostand laut Bank"><div className="bk-betrag-feld"><input id="an-b" inputMode="decimal" value={anfang.betrag} onChange={(e) => setAnfang({ ...anfang, betrag: e.target.value })} placeholder="0,00" /><span>EUR</span></div></Feld>
            <Feld id="an-a" l="Endstand am"><input id="an-a" type="date" value={anfang.am} max={heute()} onChange={(e) => setAnfang({ ...anfang, am: e.target.value })} /></Feld>
            <Feld id="an-n" l="Quelle" breit><input id="an-n" value={anfang.notiz} onChange={(e) => setAnfang({ ...anfang, notiz: e.target.value })} placeholder="z. B. Airwallex-Auszug vom 23.09." /></Feld>
          </div>
          <div className="bk-form-fuss"><span />
            <Knopf art="primaer" zeichen="schloss" disabled={!Number.isFinite(centsAus(anfang.betrag))} onClick={() => setVorgang({ art: "anfang", ...anfang })}>Mit TAN setzen</Knopf>
          </div>
        </section>

        <section className="bk-karte">
          <header className="bk-karte-kopf"><h2>Bankabgleich</h2>{k.abgleich ? <Chip art={k.abgleich.differenzCents === 0 ? "gut" : "warn"}>{k.abgleich.differenzCents == null ? "vor Buchbeginn" : k.abgleich.differenzCents === 0 ? "stimmt" : `Differenz ${geldVz(k.abgleich.differenzCents)}`}</Chip> : null}</header>
          <p className="bk-hinweis">Was die Bank am Ende eines Tages zeigte. Bewegt nichts — verglichen wird mit dem Buch am selben Tag.{k.live.ok ? " Airwallex liefert den Stand gerade live; der Abgleich von Hand ist dann nur zur Dokumentation nötig." : ""}</p>
          <div className="bk-gitter">
            <Feld id="ab-b" l="Kontostand laut Bank"><div className="bk-betrag-feld"><input id="ab-b" inputMode="decimal" value={abgleich.betrag} onChange={(e) => setAbgleich({ ...abgleich, betrag: e.target.value })} placeholder="0,00" /><span>EUR</span></div></Feld>
            <Feld id="ab-a" l="Endstand am"><input id="ab-a" type="date" value={abgleich.am} max={heute()} onChange={(e) => setAbgleich({ ...abgleich, am: e.target.value })} /></Feld>
          </div>
          <div className="bk-form-fuss"><span /><Knopf disabled={!Number.isFinite(centsAus(abgleich.betrag))} onClick={() => void abgleichSpeichern()}>Abgleich erfassen</Knopf></div>
        </section>
      </div>

      <section className="bk-karte">
        <header className="bk-karte-kopf"><h2>Buchung von Hand</h2></header>
        <p className="bk-hinweis">Für Geld, das nicht über einen Zahlungsauftrag, eine Auszahlung oder den Bankabruf läuft: Einlagen, Gebühren, Kartenzahlungen, Korrekturen.</p>
        <div className="bk-gitter">
          <Feld id="bu-art" l="Art">
            <select id="bu-art" value={buchung.art} onChange={(e) => setBuchung({ ...buchung, art: e.target.value })}>
              <option value="einlage">Einlage (Kapital von außen)</option>
              <option value="eingang">Eingang</option>
              <option value="ausgabe">Ausgabe</option>
              <option value="korrektur">Korrekturbuchung</option>
            </select>
          </Feld>
          <Feld id="bu-b" l="Betrag" hinweis={buchung.art === "korrektur" ? <label className="bk-inline"><input type="checkbox" checked={buchung.minus} onChange={(e) => setBuchung({ ...buchung, minus: e.target.checked })} /> mindert den Saldo</label> : undefined}>
            <div className="bk-betrag-feld"><input id="bu-b" inputMode="decimal" value={buchung.betrag} onChange={(e) => setBuchung({ ...buchung, betrag: e.target.value })} placeholder="0,00" /><span>EUR</span></div>
          </Feld>
          <Feld id="bu-w" l="Wertstellung"><input id="bu-w" type="date" value={buchung.wertAm} onChange={(e) => setBuchung({ ...buchung, wertAm: e.target.value })} /></Feld>
          <Feld id="bu-g" l={buchung.art === "ausgabe" ? "Empfänger" : "Von wem"}><input id="bu-g" value={buchung.gegenpartei} onChange={(e) => setBuchung({ ...buchung, gegenpartei: e.target.value })} /></Feld>
          <Feld id="bu-z" l="Zweck" breit><input id="bu-z" value={buchung.zweck} maxLength={140} onChange={(e) => setBuchung({ ...buchung, zweck: e.target.value })} placeholder="Wofür — eine Buchung ohne Zweck ist keine Buchung" /></Feld>
          <Feld id="bu-l" l="Beleg-Nr."><input id="bu-l" value={buchung.beleg} onChange={(e) => setBuchung({ ...buchung, beleg: e.target.value })} /></Feld>
        </div>
        <div className="bk-form-fuss"><span />
          <Knopf art="primaer" zeichen="schloss" disabled={!(centsAus(buchung.betrag.replace(/^-/, "")) > 0) || !buchung.zweck.trim()} onClick={() => setVorgang(buchungsVorgang())}>Mit TAN buchen</Knopf>
        </div>

        <h3 className="bk-unterkopf">Bisherige Buchungen von Hand</h3>
        {!manuell ? <Laden zeilen={3} /> : manuell.length === 0 ? <p className="bk-leise">Noch keine.</p> : (
          <div className="bk-tabelle-rolle">
            <table className="bk-tabelle">
              <thead><tr><th>Tag</th><th>Vorgang</th><th className="bk-r">Betrag</th><th /></tr></thead>
              <tbody>{manuell.map((u) => (
                <tr key={u.uid} className={u.storniert ? "bk-storniert" : ""}>
                  <td className="bk-nw">{tag(u.tag)}</td>
                  <td><strong>{u.gegenpartei}</strong><span className="bk-klein">{u.zweck}{u.notiz ? ` · Storno: ${u.notiz}` : ""}</span></td>
                  <td className="bk-r bk-zahl">{geldVz(u.cents)}</td>
                  <td className="bk-r">{!u.storniert ? <Knopf klein art="still" onClick={() => setStorno({ id: Number(u.uid.split(":")[1]), grund: "" })}>Stornieren</Knopf> : <Chip art="still">Storniert</Chip>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {storno ? (
          <div className="bk-einschub">
            <Feld id="st-g" l={`Grund für das Storno der Buchung Nr. ${storno.id}`}><input id="st-g" value={storno.grund} onChange={(e) => setStorno({ ...storno, grund: e.target.value })} autoFocus /></Feld>
            <div className="bk-knopfreihe">
              <Knopf art="warnung" zeichen="schloss" disabled={!storno.grund.trim()} onClick={() => setVorgang({ art: "storno", id: storno.id, grund: storno.grund })}>Mit TAN stornieren</Knopf>
              <Knopf art="still" onClick={() => setStorno(null)}>Abbrechen</Knopf>
            </div>
          </div>
        ) : null}
      </section>

      <section className="bk-karte">
        <header className="bk-karte-kopf"><h2>Übergabe an die Buchhaltung</h2></header>
        <p className="bk-hinweis">Erscheint im internen Übergabevermerk. Der Text gibt deine Angabe wieder — trag nur ein, was so stimmt.</p>
        <div className="bk-gitter">
          <Feld id="ue-b" l="Bisher geführt von"><input id="ue-b" value={ueb.bisher} onChange={(e) => setUeb({ ...ueb, bisher: e.target.value })} /></Feld>
          <Feld id="ue-s" l="Übergabe zum"><input id="ue-s" type="date" value={ueb.stichtag} onChange={(e) => setUeb({ ...ueb, stichtag: e.target.value })} /></Feld>
        </div>
        <div className="bk-form-fuss"><span />{lage.uebergabe?.bestaetigtVon ? <Chip art="gut" zeichen="haken">Bestätigt {zeit(lage.uebergabe.bestaetigtAm)}</Chip> : null}<Knopf disabled={!ueb.bisher.trim()} onClick={() => void uebergabeSpeichern()}>Übergabe hinterlegen</Knopf></div>
      </section>

      {vorgang ? (
        <TanDialog offen={!!vorgang} titel={titel}
          anfordern={() => ruf("/buchhaltung/kasse/tan", { body: vorgang })}
          bestaetigen={async (tan) => { await ruf("/buchhaltung/kasse/buchen", { body: { ...vorgang, tan } }); }}
          onZu={() => setVorgang(null)}
          onFertig={() => { const a = vorgang.art; setStorno(null); fertig(a === "anfang" ? "Anfangsbestand gesetzt." : a === "storno" ? "Buchung storniert." : "Buchung ausgeführt."); }}
          knopf="Bestätigen" />
      ) : null}
    </div>
  );
}
