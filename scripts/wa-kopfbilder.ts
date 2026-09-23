// Kopfbilder der WhatsApp-Vorlagen im FIAON-CI — 1200 × 628, PNG.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Aufruf: PLAYWRIGHT_BROWSERS_PATH=.playwright npx tsx scripts/wa-kopfbilder.ts [zielordner]
// Die Bilder liegen unter client/public/wa/ und werden als Kopf der Bildvorlagen
// (fiaon_kkb_*) bei Meta hinterlegt. Jedes Motiv muss für JEDEN Empfänger
// wahr sein: keine Häkchen, kein „Zahlung eingegangen“, kein Kartennetz-Logo.
const ZIEL = process.argv[2] ?? new URL("../client/public/wa", import.meta.url).pathname;
mkdirSync(ZIEL, { recursive: true });

function guilloche(breite = 1200, hoehe = 220, linien = 26): string {
  const pfade: string[] = [];
  for (let k = 0; k < linien; k++) {
    const phase = (k / linien) * Math.PI * 2;
    let d = "";
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * Math.PI * 2;
      const x = (i / 300) * breite;
      const y = hoehe / 2 + hoehe * 0.34 * Math.sin(t * 2.4 + phase) * Math.cos(t * 1.2 - phase / 2) + hoehe * 0.06 * Math.sin(t * 11 + phase * 2);
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    pfade.push(`<path d="${d}"/>`);
  }
  return `<svg viewBox="0 0 ${breite} ${hoehe}" width="${breite}" height="${hoehe}" preserveAspectRatio="none"><g fill="none" stroke="#9CCBFF" stroke-width="0.8">${pfade.join("")}</g></svg>`;
}

function qr(): string {
  const n = 25, z = 7;
  let feld = "";
  let x = 12345;
  const zufall = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const ecke = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    if (ecke) continue;
    if (zufall() > 0.52) feld += `<rect x="${c * z}" y="${r * z}" width="${z}" height="${z}"/>`;
  }
  const auge = (ox: number, oy: number) => `<rect x="${ox}" y="${oy}" width="${7 * z}" height="${7 * z}" rx="6" fill="none" stroke="#0E1A2E" stroke-width="${z}"/><rect x="${ox + 2 * z}" y="${oy + 2 * z}" width="${3 * z}" height="${3 * z}" rx="3"/>`;
  return `<svg viewBox="-${z / 2} -${z / 2} ${n * z + z} ${n * z + z}" width="150" height="150"><g fill="#0E1A2E">${feld}${auge(z / 2, z / 2)}${auge((n - 7) * z + z / 2, z / 2)}${auge(z / 2, (n - 7) * z + z / 2)}</g></svg>`;
}

const HAKEN = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const MOTIVE: Record<string, { zeile: string; unter: string; motiv: string }> = {
  karte: {
    zeile: "Ihr Weg zur Kreditkarte",
    unter: "Persönlich begleitet · Schritt für Schritt",
    motiv: `
      <div class="karte">
        <div class="glanz"></div>
        <div class="chip"><i></i><i></i><i></i></div>
        <svg class="nfc" viewBox="0 0 24 24"><path d="M8 7.5a6.5 6.5 0 0 1 0 9M11.5 5a10 10 0 0 1 0 14M15 3a13.5 13.5 0 0 1 0 18" fill="none" stroke="#9CCBFF" stroke-width="1.6" stroke-linecap="round"/></svg>
        <div class="nummer">••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;4821</div>
        <div class="unten"><span>GÜLTIG BIS&nbsp;&nbsp;09/31</span></div>
      </div>`,
  },
  antrag: {
    zeile: "Ihr Antrag",
    unter: "In wenigen Minuten abgeschlossen",
    motiv: `
      <div class="blatt">
        <div class="blatt-titel">Ihr Weg in drei Schritten</div>
        ${["Antrag abschließen", "Konto aktivieren", "Link der Partnerbank"].map((t, i) => `
          <div class="schritt ${i === 0 ? "jetzt" : "spaeter"}"><i>${i + 1}</i><b>${t}</b></div>`).join("")}
      </div>`,
  },
  zahlung: {
    zeile: "Zahlung und Aktivierung",
    unter: "Nach dem Eingang geht es sofort weiter",
    motiv: `
      <div class="beleg">
        <div class="beleg-t">Überweisung</div>
        <div class="beleg-betrag">••,•• <small>EUR</small></div>
        <div class="beleg-z"><span>Empfänger</span><b>FIAON LTD</b></div>
        <div class="beleg-z"><span>Verwendungszweck</span><b class="mono">FIAON-•••••</b></div>
        <div class="beleg-knopf">Überweisen</div>
        <div class="beleg-fuss">Alle Daten über den Knopf in der Nachricht</div>
      </div>`,
  },
  termin: {
    zeile: "Ihr persönlicher Termin",
    unter: "Fünf Minuten am Telefon",
    motiv: `
      <div class="kalender">
        <div class="kal-kopf"><span>Ihr Gespräch</span></div>
        <div class="kal-raster">
          ${["09:00", "11:30", "14:30", "16:00", "18:30"].map((z, i) => `<div class="slot${i === 2 ? " an" : ""}">${z}</div>`).join("")}
        </div>
        <div class="kal-fuss">${HAKEN}<span>Zeitfenster gewählt</span></div>
      </div>`,
  },
  kontakt: {
    zeile: "Ihr direkter Draht",
    unter: "Antworten Sie einfach auf diese Nachricht",
    motiv: `
      <div class="chat">
        <div class="blase wir">Eine kurze Frage zu Ihrer Anfrage …</div>
        <div class="blase kunde">Gern, ich bin da.</div>
        <div class="blase wir tippen"><i></i><i></i><i></i></div>
      </div>`,
  },
};

function html(key: string): string {
  const m = MOTIVE[key];
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@200;300;400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 628px; overflow: hidden; font-family: Inter, sans-serif; }
  .buehne { position: relative; width: 1200px; height: 628px; overflow: hidden;
    background: radial-gradient(760px 420px at 12% -10%, rgba(40,141,250,.30), transparent 65%),
                radial-gradient(700px 500px at 105% 115%, rgba(29,78,216,.28), transparent 60%),
                linear-gradient(158deg, #0B1220 0%, #13203a 55%, #1A2744 100%); }
  .band { position: absolute; left: 0; right: 0; bottom: 70px; opacity: .13; }
  .kante { position: absolute; inset: 0; border-radius: 0; box-shadow: inset 0 1px 0 rgba(170,210,255,.16); }
  .marke { position: absolute; left: 72px; top: 64px; font-family: Outfit; font-weight: 200; font-size: 58px; letter-spacing: .34em; color: #fff; line-height: 1; }
  .marke .ltd { font-family: Outfit; font-weight: 300; font-size: 26px; letter-spacing: .08em; color: #9CCBFF; margin-left: 6px; }
  .text { position: absolute; left: 72px; bottom: 76px; width: 560px; }
  .strich { width: 56px; height: 2px; background: #288DFA; margin-bottom: 22px; }
  .zeile { font-family: Outfit; font-weight: 300; font-size: 50px; line-height: 1.08; color: #fff; }
  .unter { margin-top: 16px; font-size: 21px; color: #A9BDD8; letter-spacing: .01em; }
  .rechts { position: absolute; right: 64px; top: 50%; transform: translateY(-50%); width: 460px; height: 470px; display: grid; place-items: center; }

  /* Karte */
  .karte { position: relative; width: 420px; height: 264px; border-radius: 22px; transform: rotate(-9deg);
    background: linear-gradient(135deg, #263a63 0%, #152241 45%, #0d1629 100%);
    border: 1px solid rgba(156,203,255,.28);
    box-shadow: 0 40px 80px rgba(0,0,0,.5), 0 10px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(200,225,255,.25); overflow: hidden; }
  .glanz { position: absolute; inset: -40% -10% auto -30%; height: 90%; background: linear-gradient(115deg, transparent 30%, rgba(156,203,255,.18) 48%, transparent 60%); }
  .chip { position: absolute; left: 36px; top: 70px; width: 58px; height: 44px; border-radius: 8px;
    background: linear-gradient(135deg, #dfe8f5, #9fb3cf); display: grid; grid-template-rows: repeat(3, 1fr); padding: 7px 6px; gap: 4px; }
  .chip i { display: block; border-top: 1px solid rgba(40,60,90,.35); }
  .nfc { position: absolute; left: 108px; top: 76px; width: 32px; height: 32px; }
  .nummer { position: absolute; left: 36px; bottom: 74px; font-family: "JetBrains Mono"; font-size: 22px; color: #e7eefb; letter-spacing: .04em; }
  .unten { position: absolute; left: 36px; right: 32px; bottom: 30px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; letter-spacing: .18em; color: #8fa6c4; }
  .kreise { display: flex; }
  .kreise i { width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid rgba(156,203,255,.55); }
  .kreise i + i { margin-left: -12px; background: rgba(40,141,250,.18); }

  /* Antrag */
  .blatt { width: 390px; background: #fff; border-radius: 22px; padding: 30px 30px 26px; box-shadow: 0 40px 80px rgba(0,0,0,.45); transform: rotate(-4deg); }
  .blatt-titel { font-family: Outfit; font-weight: 300; font-size: 26px; color: #0E1A2E; margin-bottom: 8px; }
  .schritt { display: grid; grid-template-columns: 44px 1fr; align-items: center; column-gap: 14px; margin-top: 16px; padding: 12px 14px; border-radius: 14px; border: 1.5px solid #E1E8F2; }
  .schritt i { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-family: Outfit; font-size: 20px; }
  .schritt.jetzt { border-color: #1D4ED8; background: #EEF4FF; }
  .schritt.jetzt i { background: #1D4ED8; color: #fff; }
  .schritt.spaeter i { border: 1.5px solid #C9D5E5; color: #526277; }
  .schritt b { font-weight: 500; font-size: 19px; color: #0E1A2E; }

  /* Zahlung */
  .beleg { width: 380px; background: #fff; border-radius: 22px; padding: 28px 30px 24px; box-shadow: 0 40px 80px rgba(0,0,0,.45); transform: rotate(3deg); }
  .beleg-t { font-family: Outfit; font-weight: 300; font-size: 26px; color: #0E1A2E; text-align: center; }
  .qr { display: grid; place-items: center; margin: 18px auto 14px; width: 170px; height: 170px; border-radius: 14px; border: 1.5px solid #E1E8F2; }
  .beleg-z { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; border-bottom: 1px solid #EEF3FA; }
  .beleg-z span { color: #526277; }
  .beleg-z b { color: #0E1A2E; font-weight: 500; }
  .beleg-z b.mono { font-family: "JetBrains Mono"; font-weight: 400; }
  .beleg-betrag { text-align: center; font-family: Outfit; font-weight: 200; font-size: 54px; color: #0E1A2E; margin: 14px 0 12px; letter-spacing: .02em; }
  .beleg-betrag small { font-family: Inter; font-size: 15px; color: #526277; letter-spacing: .14em; margin-left: 6px; }
  .beleg-knopf { margin-top: 18px; background: #1D4ED8; color: #fff; text-align: center; border-radius: 12px; padding: 13px; font-size: 18px; font-weight: 500; }
  .beleg-fuss { margin-top: 12px; text-align: center; font-size: 14px; color: #526277; }

  /* Termin */
  .kalender { width: 390px; background: #fff; border-radius: 22px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,.45); transform: rotate(-4deg); }
  .kal-kopf { background: linear-gradient(135deg, #1D4ED8, #288DFA); padding: 22px 28px; color: #fff; font-family: Outfit; font-weight: 300; font-size: 26px; }
  .kal-raster { padding: 22px 26px 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .slot { border: 1.5px solid #C9D5E5; border-radius: 12px; padding: 14px; font-family: "JetBrains Mono"; font-size: 19px; color: #22324A; text-align: center; }
  .slot.an { background: #1D4ED8; border-color: #1D4ED8; color: #fff; }
  .kal-fuss { display: flex; align-items: center; gap: 10px; padding: 12px 26px 24px; color: #12704F; font-size: 17px; }
  .kal-fuss svg { width: 22px; height: 22px; }

  /* Kontakt */
  .chat { width: 400px; display: grid; gap: 18px; }
  .blase { max-width: 330px; padding: 18px 22px; border-radius: 22px; font-size: 20px; line-height: 1.35; box-shadow: 0 20px 44px rgba(0,0,0,.35); }
  .blase.wir { background: #fff; color: #0E1A2E; border-bottom-left-radius: 6px; justify-self: start; }
  .blase.kunde { background: #1D4ED8; color: #fff; border-bottom-right-radius: 6px; justify-self: end; }
  .tippen { display: flex; gap: 8px; padding: 20px 24px; }
  .tippen i { width: 11px; height: 11px; border-radius: 50%; background: #9FB3CF; display: block; }
  .tippen i:nth-child(2) { background: #7F96B8; } .tippen i:nth-child(3) { background: #5F7AA1; }
</style></head><body><div class="buehne">
  <div class="band">${guilloche()}</div>
  <div class="kante"></div>
  <div class="marke">FIAON<span class="ltd">Ltd.</span></div>
  <div class="text"><div class="strich"></div><div class="zeile">${m.zeile}</div><div class="unter">${m.unter}</div></div>
  <div class="rechts">${m.motiv}</div>
</div></body></html>`;
}

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 628 }, deviceScaleFactor: 1 });
for (const key of Object.keys(MOTIVE)) {
  await page.setContent(html(key), { waitUntil: "networkidle" });
  await page.evaluate(async () => { await (document as any).fonts.ready; });
  await page.screenshot({ path: `${ZIEL}/fiaon-${key}.png`, clip: { x: 0, y: 0, width: 1200, height: 628 } });
  console.log(`fiaon-${key}.png`);
}
await browser.close();
