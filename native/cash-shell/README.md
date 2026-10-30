# Installerbar kassadel: reservfilens kodgrund

Detta är kodgrunden för appens lokala reservlogg, **inte en färdig eller publicerad kassaapp**. Tauri-skalets första sida innehåller ingen inloggning. Ingen installatör eller Android-app har byggts.

`src-tauri/src/lib.rs` begränsar filskrivningen till `kassareserv/VF26-reserv-<kassa-ID>.txt` i appens lokala datakatalog. Sidan anger aldrig filplats. Filen är vanlig UTF-8-text. Native-delen jämför köade händelse-ID med filen och vägrar radera obekräftade händelser. Tillfällig fil skrivs och synkas före byte till gällande reservfil.

`src/cash-local-backup.js` använder detta gränssnitt när den körs i den installerade miljön. Den vanliga webbversionen behåller tills vidare den manuella filväljaren och är inte slutlösningen. Efter serverns bekräftelse skrivs reservfilen om före den lokala databaskön kortas. Vid fel stoppas nya kassahändelser.

För att appen ska bli användbar återstår:

1. Inloggning i **systemets webbläsare**, med säker återgång och sessionskontroll för den lokalt paketerade appen. Google-inloggning får inte ske i en inbäddad WebView.
2. Koppling mellan den lokalt paketerade kassan och den privata Google-kontrollen utan den nuvarande `window.opener`-kopplingen mellan två webbfönster.
3. En behörighetsskyddad vy för att läsa och exportera reservfilen om webbläsardatabasen går förlorad.
4. Byggning och prov på Windows och Android, inklusive avbrott, omstart, fullt lagringsutrymme och förlorad lokal databas. Rust- och Android-verktyg finns ännu inte i denna arbetsmiljö.

Inga Google-nycklar eller medlemsuppgifter ingår i detta kodskal. Inga nya leverantörer eller faktureringskonton behövs för koden.
