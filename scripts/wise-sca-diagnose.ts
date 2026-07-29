/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WISE-SIGNATUR — FEHLERSUCHE AM LEBENDEN OBJEKT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ausgangslage: Das Schlüsselpaar ist geprüft, der Schlüssel bei Wise aktiv —
 * und Wise weist die Unterschrift trotzdem ab. Ein 403 von Wise sieht immer
 * gleich aus, egal woran es liegt. Raten hilft hier nicht weiter.
 *
 * Dieses Skript misst statt zu raten. Es macht dreierlei:
 *
 *   1. ZEIGT ALLES, was bei der Antwort ankommt: Status, sämtliche Kopfzeilen,
 *      der Antwortkörper im Klartext. Genau das fehlte bisher.
 *   2. BEWEIST OHNE NETZ, dass Verfahren und Kodierung stimmen — zwei
 *      unabhängige Wege in Node müssen dieselbe Unterschrift ergeben.
 *   3. PROBIERT DIE VERDÄCHTIGEN VARIANTEN EINZELN DURCH und meldet, welche
 *      Wise akzeptiert. Am Ende steht eine Tatsache, keine Vermutung.
 *
 * WICHTIG ZUR EINMAL-KENNUNG
 * Sie ist eine Einmal-Kennung. Jede Variante holt sich deshalb eine frische —
 * sonst misst man nur noch, dass die vorige verbraucht ist, und hält das
 * fälschlich für einen Signaturfehler.
 *
 * SICHERHEIT
 * Token und privater Schlüssel werden nicht ausgegeben, auch nicht gekürzt.
 * Von der Einmal-Kennung erscheint nur die Länge. Der öffentliche Schlüssel
 * wird vollständig gezeigt — der ist per Definition nicht geheim und genau der,
 * den man mit Wise vergleichen will. Es wird ausschliesslich gelesen.
 *
 * Ausführen:  npx tsx scripts/wise-sca-diagnose.ts
 */

import "dotenv/config";
import crypto from "node:crypto";
import {
  getBalances,
  getProfiles,
  holePrivatenSchluessel,
  kopfBericht,
  oeffentlicherFingerabdruck,
  oeffentlicherSchluesselPem,
  roherAufruf,
  schluesselStatus,
  signiereFreigabe,
  WiseError,
} from "../server/lib/wise-api";

// Der Zugang ist stillgelegt (Wise erlaubt Kontoauszüge über persönliche Token
// nicht für britische Konten). Genau dieses Skript soll ihn aber prüfen können —
// etwa nach einem Partnerschaftsabkommen. Deshalb schaltet es sich selbst frei.
process.env.WISE_AKTIV = "1";

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(76));

// ═══════════════════════════════════════════════════════════════════════════
// Varianten — jede prüft genau eine der möglichen Ursachen
// ═══════════════════════════════════════════════════════════════════════════

interface Variante {
  name: string;
  prueft: string;
  koepfe: (kennung: string, key: crypto.KeyObject) => Record<string, string>;
}

const sig = (kennung: string, key: crypto.KeyObject, padding: number, kodierung: BufferEncoding | "base64url") =>
  crypto
    .sign("sha256", Buffer.from(kennung, "utf8"), { key, padding })
    .toString(kodierung as BufferEncoding);

const VARIANTEN: Variante[] = [
  {
    name: "A — wie im Betrieb (PKCS#1 v1.5, Base64)",
    prueft: "Der aktuelle Stand. Entspricht der offiziellen Wise-Vorlage.",
    koepfe: (k, key) => ({
      "x-2fa-approval": k,
      "X-Signature": sig(k, key, crypto.constants.RSA_PKCS1_PADDING, "base64"),
    }),
  },
  {
    name: "B — Kopfzeilen exakt wie in der Wise-Vorlage",
    prueft:
      "Die Vorlage sendet 'Content-Type: application/json' und 'User-Agent: tw-statements-sca'. " +
      "Manche Schutzschicht vor der Schnittstelle wertet das aus.",
    koepfe: (k, key) => ({
      "x-2fa-approval": k,
      "X-Signature": sig(k, key, crypto.constants.RSA_PKCS1_PADDING, "base64"),
      "Content-Type": "application/json",
      "User-Agent": "tw-statements-sca",
    }),
  },
  {
    name: "C — Base64URL statt Standard-Base64",
    prueft: "Falls Wise die Unterschrift URL-sicher kodiert erwartet (- und _ statt + und /).",
    koepfe: (k, key) => ({
      "x-2fa-approval": k,
      "X-Signature": sig(k, key, crypto.constants.RSA_PKCS1_PADDING, "base64url"),
    }),
  },
  {
    name: "D — Hex statt Base64",
    prueft: "Falls die Unterschrift hexadezimal erwartet wird.",
    koepfe: (k, key) => ({
      "x-2fa-approval": k,
      "X-Signature": sig(k, key, crypto.constants.RSA_PKCS1_PADDING, "hex"),
    }),
  },
  {
    name: "E — PSS-Verfahren statt PKCS#1 v1.5",
    prueft:
      "Zum Ausschluss. Nach der Vorlage darf das NICHT funktionieren. Falls doch, " +
      "hat Wise das Verfahren geändert und die Dokumentation hinkt hinterher.",
    koepfe: (k, key) => ({
      "x-2fa-approval": k,
      "X-Signature": sig(k, key, crypto.constants.RSA_PKCS1_PSS_PADDING, "base64"),
    }),
  },
  {
    name: "F — nur Kennung, ohne Unterschrift",
    prueft:
      "Zum Ausschluss. Wise hat neben der Unterschrift ein neueres Verfahren, bei dem " +
      "die Kennung anders freigeschaltet wird. Ein Erfolg hier hiesse: keine Signatur nötig.",
    koepfe: (k) => ({ "x-2fa-approval": k }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Hilfsmittel
// ═══════════════════════════════════════════════════════════════════════════

async function zeigeAntwort(res: Response, einzug = "    "): Promise<string> {
  const body = await res.text().catch(() => "");
  log(`${einzug}Status ......... ${res.status} ${res.statusText}`);
  log(`${einzug}Kopfzeilen ..... ${kopfBericht(res)}`);
  log(`${einzug}Körper ......... ${body.trim() ? body.trim().slice(0, 500) : "(leer)"}`);
  return body;
}

/** Holt eine frische Einmal-Kennung, indem unsigniert angefragt wird. */
async function frischeKennung(pfad: string): Promise<{ kennung: string | null; status: number }> {
  const res = await roherAufruf(pfad);
  await res.text().catch(() => "");
  return { kennung: res.headers.get("x-2fa-approval"), status: res.status };
}

// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  log();
  log("WISE-SIGNATUR — FEHLERSUCHE");
  linie("═");

  // ── 1. Was liegt überhaupt vor ────────────────────────────────────────────
  const tok = String(process.env.WISE_API_TOKEN || "");
  log(`Token .......................... ${tok ? `gesetzt, ${tok.length} Zeichen` : "FEHLT"}`);
  const ks = schluesselStatus();
  log(`Privater Schlüssel ............. ${ks.text}`);
  if (!ks.ok || !tok) {
    log("\nOhne Token und Schlüssel ist keine Fehlersuche möglich. Abbruch.");
    process.exit(1);
  }

  log(`Fingerabdruck öffentl. Schlüssel SHA-256/${oeffentlicherFingerabdruck()}`);
  log();
  log("Öffentlicher Schlüssel, aus WISE_PRIVATE_KEY_B64 abgeleitet.");
  log("Er MUSS zeichengleich dem bei Wise hinterlegten entsprechen:");
  log();
  log(oeffentlicherSchluesselPem());
  log();

  // ── 2. Beweis ohne Netz ───────────────────────────────────────────────────
  linie();
  log("VERFAHREN UND KODIERUNG — ohne Netz nachgewiesen");
  linie();
  const key = holePrivatenSchluessel();
  const probe = "0f6a1c2e-9b3d-4a51-8e7f-2c4d6b8a0e13";

  const wegA = signiereFreigabe(probe, key);
  const wegB = crypto.createSign("RSA-SHA256").update(probe, "utf8").sign(key, "base64");

  log(`Zwei unabhängige Wege in Node ... ${wegA === wegB ? "IDENTISCH" : "UNTERSCHIEDLICH (!)"}`);
  log(`  crypto.sign mit PKCS#1 v1.5 und crypto.createSign('RSA-SHA256')`);
  log(`Länge der Unterschrift ......... ${wegA.length} Zeichen (RSA-2048 erwartet 344)`);
  log(`Zeichenvorrat .................. ${/^[A-Za-z0-9+/]+={0,2}$/.test(wegA) ? "Standard-Base64" : "KEIN Standard-Base64 (!)"}`);
  log(`Signiert wird .................. ausschliesslich der rohe Kennungstext als UTF-8`);
  log();
  log("Damit sind Punkt 2 (Verfahren) und Punkt 3 (Kodierung) als Ursache ausgeschlossen,");
  log("solange Wise die Unterschrift nach der eigenen Vorlage prüft.");
  log();

  // ── 3. Ziel bestimmen ─────────────────────────────────────────────────────
  linie();
  log("ZIEL BESTIMMEN — welcher Aufruf löst die Signatur aus");
  linie();

  const profile = await getProfiles();
  log(`Profile ........................ ${profile.map((p) => `${p.name} (${p.type}, ${p.id})`).join(" · ")}`);
  log("  Dass dieser Aufruf durchging, heisst: Der Token ist gültig und wird angenommen.");

  let ziel: string | null = null;
  let vorlagenZiel: string | null = null;
  for (const p of profile) {
    const balances = await getBalances(p.id);
    const eur = balances.find((b) => b.currency === "EUR") ?? balances[0];
    if (!eur) continue;
    log(`  ${p.name}: Konten ${balances.map((b) => b.currency).join(", ")} → geprüft wird ${eur.currency}`);
    const von = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const bis = new Date().toISOString();
    ziel =
      `/v1/profiles/${p.id}/balance-statements/${eur.id}/statement.json` +
      `?currency=${eur.currency}&intervalStart=${encodeURIComponent(von)}` +
      `&intervalEnd=${encodeURIComponent(bis)}&type=COMPACT`;
    // Der Weg aus der offiziellen Vorlage — anderer Pfad, gleiche Sache.
    vorlagenZiel =
      `/v3/profiles/${p.id}/borderless-accounts/${eur.id}/statement.json` +
      `?currency=${eur.currency}&intervalStart=${encodeURIComponent(von)}` +
      `&intervalEnd=${encodeURIComponent(bis)}&type=COMPACT`;
    break;
  }
  if (!ziel) {
    log("\nKein Währungskonto gefunden — ohne Konto gibt es keinen Kontoauszug. Abbruch.");
    process.exit(1);
  }
  log();

  // ── 4. Der Handschlag, Schritt für Schritt ────────────────────────────────
  linie();
  log("SCHRITT 1 — unsignierter Aufruf (hier MUSS 403 mit Kennung kommen)");
  linie();
  const erst = await roherAufruf(ziel);
  const erstKennung = erst.headers.get("x-2fa-approval");
  await zeigeAntwort(erst);
  log(`    Kennung ........ ${erstKennung ? `${erstKennung.length} Zeichen` : "KEINE"}`);

  if (erst.status === 200) {
    log("\nDieser Aufruf ging ohne Signatur durch. Dann liegt das Problem nicht bei SCA.");
    process.exit(0);
  }
  if (!erstKennung) {
    log();
    log("BEFUND: Wise sendet keine Freigabe-Kennung.");
    log("Dann ist es KEIN Signaturproblem, sondern eine fehlende Berechtigung des Tokens.");
    log("Die Signatur kommt in diesem Fall nie zum Einsatz.");
    process.exit(1);
  }

  // ── 5. Varianten einzeln ──────────────────────────────────────────────────
  log();
  linie();
  log("SCHRITT 2 — Varianten einzeln, jede mit FRISCHER Kennung");
  linie();

  const ergebnisse: Array<{ name: string; status: number; ergebnis: string }> = [];
  let erfolg: string | null = null;

  for (const v of VARIANTEN) {
    log();
    log(`▸ ${v.name}`);
    log(`  ${v.prueft}`);

    const frisch = await frischeKennung(ziel);
    if (!frisch.kennung) {
      log(`    Übersprungen — Wise gab keine frische Kennung (Status ${frisch.status}).`);
      continue;
    }

    const res = await roherAufruf(ziel, v.koepfe(frisch.kennung, key));
    const ergebnis = res.headers.get("x-2fa-approval-result") ?? "(nicht gesendet)";
    const neue = res.headers.get("x-2fa-approval");
    await zeigeAntwort(res);
    log(`    Freigabe ....... ${ergebnis}`);
    log(
      `    Kennung zurück . ${
        !neue ? "keine" : neue === frisch.kennung ? "dieselbe" : "eine ANDERE — Kette neu begonnen"
      }`,
    );

    ergebnisse.push({ name: v.name, status: res.status, ergebnis });
    if (res.ok) {
      erfolg = v.name;
      log("    ★ DIESE VARIANTE FUNKTIONIERT.");
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // ── 6. Der Weg aus der offiziellen Vorlage ────────────────────────────────
  if (!erfolg && vorlagenZiel) {
    log();
    linie();
    log("SCHRITT 3 — anderer Endpunkt: der aus der offiziellen Vorlage");
    linie();
    log("Die Vorlage nutzt /v3/…/borderless-accounts/… statt /v1/…/balance-statements/….");
    log("Wenn nur dieser Weg funktioniert, liegt es nicht an der Unterschrift.");
    const frisch = await frischeKennung(vorlagenZiel);
    if (frisch.kennung) {
      const res = await roherAufruf(vorlagenZiel, {
        "x-2fa-approval": frisch.kennung,
        "X-Signature": signiereFreigabe(frisch.kennung, key),
        "Content-Type": "application/json",
        "User-Agent": "tw-statements-sca",
      });
      await zeigeAntwort(res);
      ergebnisse.push({
        name: "G — Endpunkt der Vorlage (/v3/borderless-accounts)",
        status: res.status,
        ergebnis: res.headers.get("x-2fa-approval-result") ?? "(nicht gesendet)",
      });
      if (res.ok) erfolg = "G — Endpunkt der Vorlage (/v3/borderless-accounts)";
    } else {
      log(`    Keine frische Kennung erhalten (Status ${frisch.status}).`);
    }
  }

  // ── 7. Befund ─────────────────────────────────────────────────────────────
  log();
  linie("═");
  log("BEFUND");
  linie("═");
  for (const e of ergebnisse) log(`  ${String(e.status).padEnd(4)} ${e.ergebnis.padEnd(22)} ${e.name}`);
  log();

  if (erfolg) {
    log(`Funktioniert hat: ${erfolg}`);
    log("Diese Variante wird jetzt in server/lib/wise-api.ts fest eingebaut.");
    process.exit(0);
  }

  log("KEINE Variante wurde angenommen.");
  log();
  log("Damit ist die Ursache nicht mehr im Code zu suchen. Ausgeschlossen sind jetzt:");
  log("Verfahren, Kodierung, Kopfzeilen, Endpunkt und der Zustand der Kennung.");
  log();
  log("Bleibt: Der bei Wise hinterlegte öffentliche Schlüssel wird für diesen Token");
  log("nicht herangezogen. Das kommt vor, wenn der Schlüssel unter einem anderen");
  log("Wise-Benutzer oder einem anderen Profil hinterlegt ist als dem, dem der Token");
  log("gehört — die Anzeige in der Oberfläche sieht in beiden Fällen gleich aus.");
  log();
  log("Prüfen: Gehören Token und Schlüssel demselben Benutzer UND demselben Profil?");
  log("Den oben ausgegebenen öffentlichen Schlüssel dabei zum Vergleich heranziehen.");
  process.exit(1);
}

main().catch((err) => {
  log();
  if (err instanceof WiseError) {
    console.error(`❌ ${err.message}`);
  } else {
    console.error("❌ Unerwarteter Fehler:", err?.message || err);
  }
  log("Es wurde nichts verändert.");
  process.exit(1);
});
