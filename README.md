# AFTERSPACE

Eine immersive Endlosfahrt durch einen gebogenen Lichttunnel mit echten perspektivischen WebGL-Shadern. Eigenständiges Design, keine Framework- oder Paketinstallation.

## Start

`index.html` im Browser öffnen. Für Audio-Reaktivität den lokalen Server nutzen: `npm.cmd start` (Windows) oder `npm start`, danach http://localhost:3000 öffnen. Node.js wird nur für den Server benötigt.

## Bedienung

- „Reise beginnen“ blendet den Titel aus, startet die Fahrt und die Musik.
- Maus oder Touch auf dem Raum: Blick lenken.
- Im Raum gedrückt halten oder Leertaste: Warp. Loslassen beendet ihn.
- Scrollen über dem Raum: Tempo ändern; alternativ Regler in Mission Control.
- Die drei Kapitel wechseln Farbwelt und Lichtstimmung, die Fahrt bleibt endlos.
- Mission Control: Tempo, Lautstärke, Bewegungspause, Vollbild und eigene Musik.
- Escape: Bewegung pausieren. Reduzierte Bewegung des Betriebssystems startet die Szene als Standbild. Musik bleibt separat bedienbar.

## Musik

Der vorhandene Song liegt unter `music/track.mp3`. Kein Autoplay beim Öffnen. Oben in `app.js`: `SONG_RESTART_AT_SECONDS = 50` startet nach ungefähr 50 Songsekunden wieder bei 0. Mit `null` wird der ganze Song wiederholt. Der Dateiwähler verarbeitet Dateien ausschließlich lokal.

Das Licht reagiert über die Web Audio API auf den Bass, wenn über HTTP gestartet oder eine lokale Datei über den Dateiwähler ausgewählt wurde. Beim direkten Öffnen einer HTML-Datei wird die Standarddatei ohne Analyse abgespielt, um lokale Browser-Sicherheitsbeschränkungen zu vermeiden.

## Darstellung

WebGL erforderlich; ein Hinweis wird angezeigt, falls es nicht verfügbar ist. Bei anhaltend niedriger Bildrate wird die Renderauflösung automatisch reduziert. Rendering pausiert in unsichtbaren Tabs. WebGL-Kontextverlust wird behandelt. Google Fonts sind optional, Ersatzschriften sind hinterlegt.
