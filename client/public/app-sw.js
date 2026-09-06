/* ═══════════════════════════════════════════════════════════════════════════
   Service Worker für /app — Mein FIAON (Scheibe 6, Modul B, 06.09.2026)

   Registriert aus client/src/pages/app/Mitteilungen.tsx mit Scope "/app/".
   Drei Aufgaben, nicht mehr:
     1. Push-Mitteilung anzeigen  (push)            { title, body, url }
     2. Antippen öffnet das Ziel  (notificationclick) data.url, nur /app
     3. App-Hülle offline halten  (fetch)           NUR gehashte Vite-Bauteile
                                                    unter /assets/ und Schriften

   NIE im Cache: die index.html-Schale (sonst läuft ein Handy nach dem Deploy
   tagelang das alte Bündel — Befund 23.08.2026), alles unter /api/, alles
   mit Anmeldung. Wer hier eine API-Antwort cached, zeigt dem Kunden alte
   Zahlen. Kein Banner, kein „Installieren“-Hinweis — das macht die Seite.
   ═══════════════════════════════════════════════════════════════════════════ */

// Versionierter Cache (TFO-Vorgabe 06.09.): Die Registrierung hängt die Kennung des
// aktuellen Bündels als ?v= an — jede Auslieferung bekommt so einen neuen Worker und
// einen neuen Cache-Namen; alte Caches räumt activate weg.
var VERSION = (function () { try { return new URL(self.location.href).searchParams.get("v") || "1"; } catch (e) { return "1"; } })();
var CACHE = "fiaon-app-huelle-" + VERSION;

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Was in den Cache darf: gehashte Bauteile (/assets/…-abc123.js|css) und Schriftdateien. */
function darfInDenCache(url) {
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf("/api/") === 0) return false;
    if (url.pathname.indexOf("/assets/") === 0) return true;
    return /\.(woff2?|ttf|otf)$/i.test(url.pathname);
  }
  return url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") return; // die Schale kommt immer frisch vom Server
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (!darfInDenCache(url)) return;
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (treffer) {
        if (treffer) return treffer;
        return fetch(req).then(function (antwort) {
          if (antwort && antwort.ok && (antwort.type === "basic" || antwort.type === "cors")) cache.put(req, antwort.clone());
          return antwort;
        });
      });
    })
  );
});

/* Push: eine Mitteilung, ein Ziel. Ohne lesbare Nutzlast wird nichts gezeigt. */
self.addEventListener("push", function (event) {
  var daten = null;
  try { daten = event.data ? event.data.json() : null; } catch (e) { daten = null; }
  if (!daten || !daten.title) return;
  var url = typeof daten.url === "string" && daten.url.indexOf("/app") === 0 ? daten.url : "/app";
  event.waitUntil(
    self.registration.showNotification(String(daten.title), {
      body: daten.body ? String(daten.body) : "",
      icon: "/icon-maskable-512.png",
      badge: "/favicon-32.png",
      lang: "de",
      tag: daten.anlass ? "fiaon-" + String(daten.anlass) : "fiaon",
      renotify: false,
      data: { url: url },
    })
  );
});

/* Antippen: ein offenes Fenster von Mein FIAON übernimmt das Ziel, sonst ein neues. */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var ziel = event.notification.data && event.notification.data.url ? event.notification.data.url : "/app";
  if (ziel.indexOf("/app") !== 0) ziel = "/app";
  var absolut = new URL(ziel, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (fenster) {
      for (var i = 0; i < fenster.length; i++) {
        var f = fenster[i];
        if (f.url && f.url.indexOf(self.location.origin + "/app") === 0 && "focus" in f) {
          if ("navigate" in f) return f.navigate(absolut).then(function (n) { return n ? n.focus() : f.focus(); });
          return f.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(absolut);
      return null;
    })
  );
});
