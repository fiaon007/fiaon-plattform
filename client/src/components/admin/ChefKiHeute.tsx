// ═══════════════════════════════════════════════════════════════════════════
// /chef/ki · /chef/s/ki-heute — HEUTE: Mara und Aras an einem Tag (E-409, 19.10.2026)
//
// Die Bühne (ein Glas) zeigt die Zahlen des Tages. Darunter matt: Entscheidungs-
// karten (E-370/E-397 + Prüf-Mara), KI-Band und WhatsApp-Bremse, Kosten je Dienst,
// gelbe Werkzeuge der letzten 24 h. Not-Aus für Mara (Mail-Aktion, WhatsApp,
// Postfach in einem Zug) und — sobald verbunden — für Aras. Takt 30 s.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { akteLink } from "@/lib/akte-link";
import type { KiHeute } from "@shared/fiaon-ki-team";
import { Kopf, KiRundgang, NichtVerbunden, Fehler, Stand, Meldung, useMeldung, useTakt, senden, euro, zahl, seitKurz } from "./ki-teile";

interface KarteSicht {
  id: number; art: string; artText: string; personId: number | null; name: string | null; titel: string; text: string; empfehlung: string | null;
  optionen: { key: string; label: string; ton: "gut" | "neutral" | "vorsicht"; link: string | null; titel: string | null }[];
  status: string; ergebnis: string | null; fehler: string | null; createdAt: string;
}

export default function ChefKiHeute() {
  const { daten, fehler, laedt, neu, geladenAm } = useTakt<KiHeute & { ok: boolean }>("/chef/ki/heute", 30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  const d = daten;
  const maraAn = d ? d.mara.an.aktion || d.mara.an.whatsapp || d.mara.an.postfach : true;

  const maraSchalten = async (an: boolean) => {
    if (an && !window.confirm("Mara anhalten? Mail-Aktion, WhatsApp-Antworten und Postfach stoppen sofort. Laufendes endet normal.")) return;
    setBusy("mara");
    try { await senden("/chef/ki/mara/notaus", { an }); meld.gut(an ? "Mara angehalten." : "Mara läuft wieder."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const arasSchalten = async (notaus: boolean) => {
    if (notaus && !window.confirm("Aras Not-Aus? Laufende Gespräche enden mit einem Abschiedssatz.")) return;
    setBusy("aras");
    try { await senden(notaus ? "/chef/aras/notaus" : "/chef/aras/start", { grund: "Heute-Seite" }); meld.gut(notaus ? "Aras gestoppt." : "Aras darf wieder wählen."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const entscheiden = async (k: KarteSicht, option: string) => {
    setBusy(`k${k.id}`);
    try { await senden("/chef/mara/entscheidungen/entscheiden", { id: k.id, option }); meld.gut("Entschieden."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const spaeter = async (k: KarteSicht) => {
    setBusy(`k${k.id}`);
    try { await senden("/chef/mara/entscheidungen/spaeter", { id: k.id }); neu(); } catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };

  const karten = ((d?.karten ?? []) as KarteSicht[]);
  const kostenSumme = (d?.kosten ?? []).reduce((s, k) => s + k.euro, 0);

  return (
    <div className="ki ki-heute">
      <KiRundgang schluessel="kiHeute" raum="ki-heute" />
      <Kopf titel="KI-Team · Heute" satz="Was Mara und Aras heute getan haben — und was dich braucht." kinder={
        <>
          {d?.kiBand?.an ? <a className="ki-pille krit" href="/chef/s/mara" title="Die KI ist pausiert — im Mara-Steuerpult wieder aktivieren.">KI pausiert</a> : <span className="ki-pille gut" title={`Anbieter: ${d?.kiBand?.anbieter ?? "—"}`}>KI läuft</span>}
          {d?.waBremse?.pause ? <a className="ki-pille krit" href="/chef/s/mara" title={d.waBremse.satz ?? ""}>WhatsApp pausiert</a> : d?.waBremse?.qualitaet === "RED" ? <span className="ki-pille krit" title={d.waBremse.satz ?? ""}>Meta ROT</span> : d?.waBremse?.qualitaet === "YELLOW" ? <span className="ki-pille warn">Meta GELB</span> : null}
          <Stand am={geladenAm} neu={neu} />
        </>
      } />
      {fehler && !d ? <Fehler text={fehler} erneut={neu} /> : null}
      {laedt && !d ? <div className="ki-leer">lädt …</div> : null}
      {d && (
        <>
          <section className="ki-buehne" data-ki="buehne" aria-label="Heute in Zahlen">
            <div className="ki-raster zwei">
              <div>
                <div className="ki-chips" style={{ marginBottom: 10 }}>
                  <span className="ki-etikett">Mara</span>
                  <span className={`ki-pille ${maraAn ? "gut" : "krit"}`} title={`Mail-Aktion ${d.mara.an.aktion ? "an" : "aus"} · WhatsApp ${d.mara.an.whatsapp ? "an" : "aus"} · Postfach ${d.mara.an.postfach ? "an" : "aus"}`}>
                    <span className={`ki-punkt ${maraAn ? "gut" : "krit"}`} aria-hidden="true" />{maraAn ? "arbeitet" : "angehalten"}
                  </span>
                  <button type="button" className={`ki-knopf klein ${maraAn ? "krit" : "haupt"}`} data-ki="mara-notaus" disabled={busy === "mara"} onClick={() => maraSchalten(maraAn)} title="Mail-Aktion, WhatsApp-Antworten und Postfach in einem Zug.">
                    {maraAn ? "Not-Aus" : "Wieder an"}
                  </button>
                </div>
                <div className="ki-zahlen">
                  <div><span className="ki-zahl">{zahl(d.mara.mails.geschrieben)}</span><small title={`${zahl(d.mara.mails.entwuerfe)} Entwürfe warten`}>Mails geschrieben</small></div>
                  <div><span className="ki-zahl">{zahl(d.mara.whatsapps.raus)}</span><small title={`${zahl(d.mara.whatsapps.rein)} rein · ${zahl(d.mara.whatsapps.menschen)} Nummern`}>WhatsApps raus</small></div>
                  <div><span className="ki-zahl">{zahl(d.mara.termine)}</span><small>Termine gebucht</small></div>
                  <div><span className="ki-zahl">{zahl(d.mara.entscheidungen.offen)}</span><small title={`${zahl(d.mara.entscheidungen.geldRecht)} davon Geld/Recht`}>Entscheidungen offen</small></div>
                </div>
              </div>
              <div>
                <div className="ki-chips" style={{ marginBottom: 10 }}>
                  <span className="ki-etikett">Aras</span>
                  {d.aras?.verbunden ? (
                    <>
                      <span className={`ki-pille ${d.aras.notaus ? "krit" : d.aras.an ? "gut" : "warn"}`}><span className={`ki-punkt ${d.aras.notaus ? "krit" : d.aras.an ? "gut" : "warn"}`} aria-hidden="true" />{d.aras.notaus ? "Not-Aus" : d.aras.an ? "wählt" : "aus"}</span>
                      <button type="button" className={`ki-knopf klein ${d.aras.notaus ? "haupt" : "krit"}`} data-ki="aras-notaus" disabled={busy === "aras"} onClick={() => arasSchalten(!d.aras!.notaus)}>{d.aras.notaus ? "Wieder an" : "Not-Aus"}</button>
                    </>
                  ) : <a className="ki-pille" href="/chef/s/aras">noch nicht verbunden</a>}
                </div>
                {d.aras?.verbunden ? (
                  <div className="ki-zahlen">
                    <div><span className="ki-zahl">{zahl(d.aras.gewaehlt)}</span><small title={`${zahl(d.aras.erreicht)} erreicht`}>gewählt</small></div>
                    <div><span className="ki-zahl">{zahl(d.aras.gespraeche)}</span><small title={`${zahl(d.aras.laufend)} laufen gerade`}>Gespräche</small></div>
                    <div><span className="ki-zahl">{zahl(d.aras.zusagen)}</span><small>Zusagen</small></div>
                    <div><span className="ki-zahl klein">{euro(d.aras.euro)}</span><small>Kosten heute</small></div>
                  </div>
                ) : <NichtVerbunden />}
              </div>
            </div>
            <Meldung m={meld.m} />
          </section>

          <section className="ki-karte ki-abstand" data-ki="karten" aria-label="Entscheidungen">
            <h2>Was dich braucht <span className="ki-still ki-klein">· {zahl(d.mara.entscheidungen.offen)} offen{d.pruefung.offenKarten ? ` · ${zahl(d.pruefung.offenKarten)} von Prüf-Mara` : ""} · <a href="/chef/s/mara?reiter=entscheidungen">alle</a></span></h2>
            {karten.length === 0 ? <div className="ki-leer"><b>Nichts offen.</b>Mara hat heute keine Frage an dich.</div> : (
              <ul className="ki-liste">
                {karten.map((k) => {
                  const link = k.personId ? akteLink(k.personId, "chef") : null;
                  const empf = k.optionen.find((o) => o.key === k.empfehlung) ?? null;
                  const andere = k.optionen.filter((o) => o !== empf && !o.link);
                  return (
                    <li key={k.id} className="ki-zeile">
                      <div className="ki-zeile-kopf">
                        <span className="ki-etikett">{k.artText}</span>
                        {link ? <a href={link}>{k.name || `Person ${k.personId}`}</a> : null}
                        <b>{k.titel}</b>
                      </div>
                      <div className="ki-chips">
                        {empf ? <button type="button" className="ki-knopf klein haupt" disabled={busy === `k${k.id}`} title={empf.titel ?? "Maras Empfehlung"} onClick={() => entscheiden(k, empf.key)}>{empf.label}</button> : null}
                        {andere.slice(0, 2).map((o) => <button key={o.key} type="button" className={`ki-knopf klein${o.ton === "vorsicht" ? " warn" : ""}`} disabled={busy === `k${k.id}`} title={o.titel ?? undefined} onClick={() => entscheiden(k, o.key)}>{o.label}</button>)}
                        <button type="button" className="ki-knopf text ki-klein" disabled={busy === `k${k.id}`} onClick={() => spaeter(k)} title="Drei Tage aus der Liste">Später</button>
                      </div>
                      <span className="ki-zeile-satz">{k.text.length > 220 ? `${k.text.slice(0, 217)}…` : k.text}{k.fehler ? <span className="ki-krit-t"> · {k.fehler}</span> : null}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="ki-raster zwei ki-abstand">
            <section className="ki-karte" data-ki="kosten" aria-label="Kosten heute">
              <h2>Kosten heute <span className="ki-still ki-klein">· {euro(kostenSumme)} · <a href="/chef/s/ki-einstellungen#kasse">Kasse</a></span></h2>
              {d.kosten.length === 0 ? <p className="ki-still">Heute noch keine KI-Kosten.</p> : (
                <ul className="ki-liste">
                  {d.kosten.slice(0, 8).map((k) => {
                    const voll = k.deckel ? Math.min(100, Math.round((k.euro / k.deckel) * 100)) : null;
                    return (
                      <li key={k.dienst} className="ki-zeile ki-zeile-rechts" title={k.deckel ? `Deckel ${euro(k.deckel)} je Tag` : "kein Deckel"}>
                        <div className="ki-zeile-kopf"><b>{k.label}</b>{voll != null && voll >= 90 ? <span className="ki-pille warn">Deckel fast erreicht</span> : null}</div>
                        <span className="ki-zahl">{euro(k.euro)}</span>
                        <span className="ki-zeile-satz"><span className="ki-balken"><i className={voll != null && voll >= 90 ? "warn" : ""} style={{ width: `${voll ?? Math.round(k.anteil)}%` }} /></span></span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section className="ki-karte" data-ki="pruef" aria-label="Prüf-Mara und gelbe Werkzeuge">
              <h2>Prüf-Mara <span className="ki-still ki-klein">· <a href="/chef/s/ki-qualitaet">Qualität</a></span></h2>
              <div className="ki-zahlen">
                <div><span className="ki-zahl klein">{zahl(d.pruefung.heute)}</span><small>heute geprüft</small></div>
                <div><span className={`ki-zahl klein${d.pruefung.auffaellig ? " ki-warn-t" : ""}`}>{zahl(d.pruefung.auffaellig)}</span><small>auffällig</small></div>
              </div>
              <h3 className="ki-abstand">Gelbe Werkzeuge (24 h) <span className="ki-still ki-klein">· <a href="/chef/s/ki-werkzeuge">Ampel</a></span></h3>
              {d.mara.gelb.length === 0 ? <p className="ki-still ki-klein">Keines gelaufen — gelb heißt: Mara macht es, du siehst es hier.</p> : (
                <ul className="ki-liste">
                  {d.mara.gelb.slice(0, 6).map((g, i) => {
                    const link = g.personId ? akteLink(g.personId, "chef") : null;
                    return <li key={i} className="ki-zeile"><div className="ki-zeile-kopf"><span className="ki-punkt gelb" aria-hidden="true" /><span>{g.text}</span>{link ? <a href={link}>Akte</a> : null}</div><span className="ki-still ki-klein">{seitKurz(g.am)}</span></li>;
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
