// ═══════════════════════════════════════════════════════════════════════════
// /kontakt — Kontakt & Support (23.08.2026, Justin: „eine gesamte Seite,
// Support-Telefon, E-Mail, ein KI-Chat-Agent, der alles kennt, und eine
// Funktion, mit der der Kunde Dringendes direkt ins Admin-Dashboard oder an
// einen Mitarbeiter senden kann — hochmodern, CI, 3D.")
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Glas, Fragen } from "@/components/site/DunkleBuehne";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import KiChat from "@/components/site/KiChat";
import { SUPPORT } from "@shared/fiaon-wissen";
import "@/styles/kontakt.css";

export default function Kontakt() {
  const [f, setF] = useState({ name: "", email: "", telefon: "", text: "", an: "geschaeftsfuehrung" as "geschaeftsfuehrung" | "ansprechpartner" });
  const [stand, setStand] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [eingeloggt, setEingeloggt] = useState<{ ref: string; vorname: string | null } | null>(null);
  useEffect(() => { fetch("/api/fiaon/kunde/me", { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.eingeloggt) setEingeloggt({ ref: j.ref, vorname: j.vorname || null }); }).catch(() => {}); }, []);

  const senden = async (e: React.FormEvent) => {
    e.preventDefault(); setLaeuft(true); setStand(null);
    try {
      const r = await fetch("/api/fiaon/kontakt/dringend", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setStand({ ok: true, text: `Angekommen – Vorgang Nr. ${j.nummer}. Ihre Meldung liegt jetzt bei ${j.an}. Wir melden uns so schnell wie möglich.` }); setF({ ...f, text: "" }); }
      else setStand({ ok: false, text: j?.error || "Das hat nicht geklappt – bitte rufen Sie uns an." });
    } catch { setStand({ ok: false, text: "Keine Verbindung – bitte rufen Sie uns an." }); }
    finally { setLaeuft(false); }
  };

  return (
    <Dunkel seite="kontakt" titel="Kontakt & Support" beschreibung={`FIAON Support: Telefon ${SUPPORT.telefon}, E-Mail ${SUPPORT.email}. KI-Assistent für alle Fragen zur Plattform, Dringendes direkt an die Geschäftsführung.`}>
      <section className="dk-hero kt-hero">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" fetchPriority="high" /><div className="schleier" /></div>
        <div className="dk-rahmen dk-zweispaltig">
          <Auf>
            <span className="dk-pille">Kontakt &amp; Support</span>
            <h1 className="dk-h1">Wir sind <span className="dk-verlauf">erreichbar.</span></h1>
            <p className="dk-lead">Ein Mensch am Telefon, eine Antwort per E-Mail, ein Assistent, der die Plattform kennt – und ein direkter Draht für alles, was nicht warten kann.</p>
            <div className="kt-wege">
              <a href={`tel:${SUPPORT.telefonTel}`} className="kt-weg"><small>Telefon</small><b>{SUPPORT.telefon}</b><span>Werktags · Deutsch</span></a>
              <a href={`mailto:${SUPPORT.email}`} className="kt-weg"><small>E-Mail</small><b>{SUPPORT.email}</b><span>Antwort in der Regel am selben Werktag</span></a>
              <a href="#dringend" className="kt-weg hervor"><small>Dringend</small><b>Direkt an die Geschäftsführung</b><span>Landet sofort im Dashboard – Priorität heute</span></a>
            </div>
          </Auf>
          <Auf verzoegerung={150}><div className="dk-szene gross kt-szene"><NeuralSphere className="absolute inset-0" /></div></Auf>
        </div>
      </section>

      <Block id="assistent" pille="Der FIAON-Assistent" titel={<>Fragen Sie, <span className="dk-verlauf">was Sie wollen.</span></>}
             lead="Pakete, Ablauf, Zahlung, Startgespräch, Ihre Rechte gegenüber SCHUFA, KSV und CRIF – der Assistent kennt die Plattform im Detail und antwortet sofort. Er sieht keine Kundendaten und ersetzt keine Rechtsberatung.">
        <div style={{ marginTop: 40 }}><Auf><KiChat /></Auf></div>
      </Block>

      <Licht>
        <Block id="dringend" pille="Dringend melden" titel={<>Wenn es <span className="dk-verlauf">nicht warten kann.</span></>}
               lead="Eine Frist läuft morgen ab, eine Zahlung ist falsch zugeordnet, ein Brief der Gegenseite braucht sofort eine Antwort: Ihre Meldung landet direkt als Aufgabe mit Priorität „heute“ bei der Geschäftsführung – oder bei Ihrer Ansprechpartnerin, wenn Sie angemeldet sind." mitte>
          <form className="kt-form" onSubmit={senden}>
            <div className="kt-form-raster">
              <label><span>Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={eingeloggt?.vorname ? `${eingeloggt.vorname} …` : "Max Mustermann"} autoComplete="name" /></label>
              <label><span>E-Mail</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="max@beispiel.de" autoComplete="email" /></label>
              <label><span>Telefon</span><input type="tel" value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} placeholder="+49 170 1234567" autoComplete="tel" /></label>
              <label><span>An wen</span>
                <select value={f.an} onChange={(e) => setF({ ...f, an: e.target.value as typeof f.an })}>
                  <option value="geschaeftsfuehrung">Geschäftsführung (Justin Schwarzott)</option>
                  <option value="ansprechpartner" disabled={!eingeloggt}>{eingeloggt ? "Meine Ansprechpartnerin / mein Ansprechpartner" : "Mein Ansprechpartner (bitte anmelden)"}</option>
                </select>
              </label>
            </div>
            <label><span>Was ist passiert – und bis wann muss etwas geschehen?</span><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={5} placeholder="Kurz und konkret: Worum geht es, welche Frist, welche Referenz?" required /></label>
            {stand && <p className={`kt-stand ${stand.ok ? "ok" : "fehler"}`}>{stand.text}</p>}
            <div className="kt-form-fuss">
              <button type="submit" className="dk-knopf" disabled={laeuft}>{laeuft ? "Wird gesendet …" : "Dringend melden"}</button>
              <span className="dk-leise">{eingeloggt ? `Angemeldet als ${eingeloggt.ref} – Ihre Meldung wird Ihrer Akte zugeordnet.` : "Kunde? Nach der Anmeldung erreicht die Meldung direkt Ihre Ansprechpartnerin."}</span>
            </div>
          </form>
        </Block>

        <Block pille="Was Sie erwarten können" mitte>
          <div className="dk-raster" style={{ textAlign: "left", marginTop: 28 }}>
            <Auf><Glas tag="Am Telefon" titel="Ein Mensch, der die Akte kennt">Kunden erreichen ihre Ansprechpartnerin direkt; Interessenten den Vertrieb. Keine Warteschleife mit Musik, keine Nummern, die Sie tippen müssen.</Glas></Auf>
            <Auf verzoegerung={80}><Glas tag="Per E-Mail" titel="Antwort am selben Werktag">Schreiben Sie an {SUPPORT.email} – mit Referenz, wenn Sie Kunde sind. Anhänge wie Briefe der Gegenseite gern als Foto.</Glas></Auf>
            <Auf verzoegerung={160}><Glas tag="Im Bereich" titel="Anliegen in der Akte">Angemeldete Kunden stellen Fragen unter „Hilfe“ im Kundenbereich. Jede Antwort bleibt in der Akte nachlesbar.</Glas></Auf>
          </div>
        </Block>

        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Wann erreiche ich FIAON telefonisch?", a: `Werktags unter ${SUPPORT.telefon}. Außerhalb der Zeiten nutzen Sie „Dringend melden“ – die Meldung liegt am nächsten Werktag als Erstes oben.` },
            { f: "Ich bin Kunde – wo stelle ich Fragen zu meiner Akte?", a: "Am besten im Kundenbereich unter „Hilfe“: Dort sieht Ihre Ansprechpartnerin die Akte gleich mit. Dringendes über diese Seite mit „An meine Ansprechpartnerin“." },
            { f: "Kann der Assistent meine Zahlung oder meinen Termin prüfen?", a: "Nein – er hat keinen Zugriff auf Kundendaten. Zahlung, Termin und Unterlagen sehen Sie im Kundenbereich; bei Unstimmigkeiten hilft der Support." },
            { f: "Wie schnell reagiert die Geschäftsführung auf „Dringend“?", a: "Die Meldung erscheint sofort mit Priorität „heute“ in der Aufgabenliste der Geschäftsführung. Eine Rückmeldung erhalten Sie in der Regel am selben Werktag per Telefon oder E-Mail." },
            { f: "Wohin mit Post, Rechnungen oder rechtlichen Schreiben?", a: `${SUPPORT.firma}, ${SUPPORT.adresse}. Rechtlich relevante Post bitte zusätzlich als Foto per E-Mail – das spart Tage.` },
          ]} />
        </Block>
      </Licht>

      <section className="dk-block" style={{ paddingTop: 30 }}>
        <div className="dk-rahmen mitte"><p className="dk-leise">{SUPPORT.firma} · {SUPPORT.adresse} · {SUPPORT.register}</p></div>
      </section>
    </Dunkel>
  );
}
