/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TESTS DER WISE-SIGNATUR (SCA) — ohne Wise, ohne Netz, ohne Datenbank
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wise weist den ersten Aufruf auf Kontoauszüge absichtlich mit 403 ab und
 * legt eine Einmal-Kennung in den Antwortkopf `x-2fa-approval`. Nur wer den
 * privaten Schlüssel besitzt, kann sie unterschreiben.
 *
 * Das Problem: Ob unsere Unterschrift stimmt, sagt uns sonst erst Wise selbst —
 * und zwar mit einem nackten 403, das genauso aussieht wie „keine Berechtigung".
 * Deshalb prüfen wir hier gegen ein selbst erzeugtes Schlüsselpaar: Wir
 * unterschreiben mit dem privaten Teil und lassen den öffentlichen Teil die
 * Unterschrift bestätigen. Verifiziert er sie, ist das Format richtig —
 * SHA-256, PKCS#1 v1.5, Ergebnis Base64.
 *
 * Ausführen:  npx tsx scripts/wise-sca-test.ts
 */

import crypto from "node:crypto";
import { signiereFreigabe } from "../server/lib/wise-api";

let bestanden = 0, fehlgeschlagen = 0;

function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function gruppe(titel: string): void {
  console.log(`\n── ${titel} ${"─".repeat(Math.max(0, 62 - titel.length))}`);
}

/** Prüft eine Unterschrift so, wie Wise sie prüfen würde. */
function verifiziere(kennung: string, signaturB64: string, oeffentlich: crypto.KeyObject): boolean {
  return crypto.verify(
    "sha256",
    Buffer.from(kennung, "utf8"),
    { key: oeffentlich, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(signaturB64, "base64"),
  );
}

function main(): void {
  console.log("\nWISE-SIGNATUR (SCA) — TESTS");
  console.log("═".repeat(70));

  // Ein echtes Schlüsselpaar, wie es der Betreiber bei Wise hinterlegt.
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const fremd = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

  const kennung = "0f6a1c2e-9b3d-4a51-8e7f-2c4d6b8a0e13";

  gruppe("Grundfall");
  const signatur = signiereFreigabe(kennung, privateKey);
  ok("Unterschrift wird erzeugt", typeof signatur === "string" && signatur.length > 0);
  ok("Ergebnis ist gültiges Base64", /^[A-Za-z0-9+/]+={0,2}$/.test(signatur), signatur.slice(0, 20));
  ok("Länge passt zu RSA-2048 (256 Byte)", Buffer.from(signatur, "base64").length === 256);
  ok("Der öffentliche Schlüssel bestätigt sie", verifiziere(kennung, signatur, publicKey));

  gruppe("Was Wise ablehnen MUSS");
  ok(
    "Ein fremder Schlüssel bestätigt sie NICHT",
    !verifiziere(kennung, signatur, fremd.publicKey),
  );
  ok(
    "Eine andere Kennung bestätigt sie NICHT",
    !verifiziere("eine-voellig-andere-kennung", signatur, publicKey),
  );
  ok(
    "Eine verfälschte Unterschrift fällt durch",
    !verifiziere(kennung, Buffer.from("kaputt").toString("base64"), publicKey),
  );

  gruppe("Verfahren ist wirklich PKCS#1 v1.5, nicht PSS");
  // Der häufigste Fehler bei SCA: Node signiert mit PSS, Wise erwartet v1.5.
  // Beides ist „RSA mit SHA-256" — aber die Unterschriften sind unvereinbar.
  const pss = crypto
    .sign("sha256", Buffer.from(kennung, "utf8"), {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    })
    .toString("base64");
  ok("Unsere Unterschrift ist NICHT die PSS-Variante", signatur !== pss);
  ok(
    "PSS würde die v1.5-Prüfung nicht bestehen",
    !verifiziere(kennung, pss, publicKey),
  );
  ok(
    "Unsere Unterschrift ist bei gleicher Kennung immer identisch",
    signiereFreigabe(kennung, privateKey) === signatur,
  );

  gruppe("Schlüssel als PEM-Text (so kommt er aus der Umgebung)");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const ausB64 = Buffer.from(Buffer.from(pem, "utf8").toString("base64"), "base64").toString("utf8");
  ok("Base64-Umweg verändert das PEM nicht", ausB64 === pem);
  ok(
    "Signieren funktioniert auch mit PEM-Text statt Schlüsselobjekt",
    verifiziere(kennung, signiereFreigabe(kennung, ausB64), publicKey),
  );

  console.log("\n" + "═".repeat(70));
  console.log(`ERGEBNIS: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
  if (fehlgeschlagen > 0) {
    console.log("Die Signatur ist fehlerhaft — Wise würde jeden Abruf mit 403 abweisen.");
    process.exit(1);
  }
  console.log("Signaturformat bewiesen: SHA-256, PKCS#1 v1.5, Base64.");
  console.log("Bleibt ein 403, liegt es am Schlüsselpaar oder an den Rechten — nicht am Format.");
}

main();
