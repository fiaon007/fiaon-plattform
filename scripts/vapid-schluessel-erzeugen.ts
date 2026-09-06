// ═══════════════════════════════════════════════════════════════════════════
// VAPID-SCHLÜSSEL FÜR PUSH-MITTEILUNGEN ERZEUGEN (einmalig, 06.09.2026)
//
//   npx tsx scripts/vapid-schluessel-erzeugen.ts
//
// Gibt ein frisches Schlüsselpaar aus. Es wird NICHT gespeichert und steht
// nirgends im Quelltext: Die drei Zeilen kommen als Umgebungsvariablen zu
// Render (Frankfurt-Dienst) und in die lokale .env. Wer die Schlüssel später
// wechselt, entwertet alle bestehenden Abos — die Kunden schalten die
// Mitteilungen dann einmal neu ein (server/lib/fiaon-push.ts).
// Keine Datenbank, kein Netz — nur Zufall aus der Bibliothek web-push.
// ═══════════════════════════════════════════════════════════════════════════
import webpush from "web-push";

const paar = webpush.generateVAPIDKeys();

console.log("");
console.log("Neues VAPID-Schlüsselpaar — bitte in die Umgebung eintragen (Render + .env):");
console.log("");
console.log(`VAPID_PUBLIC_KEY=${paar.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${paar.privateKey}`);
console.log("VAPID_SUBJECT=mailto:support@fiaon.com");
console.log("");
console.log("Der öffentliche Schlüssel geht an den Browser (GET /kunde/:ref/app/push).");
console.log("Der private Schlüssel bleibt beim Server. Nie in Git, nie in einer Mail.");
console.log("");
