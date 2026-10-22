# Kassan och EKO – verifierad nulägesmappning

Granskad 2026-10-21 mot EKO-testkopian i Google Sheets (flikarna `Kassabok` och `Grunddata`) och den lokala förlagan `VF-EKO_4.4.xlsx`. Detta beskriver den nuvarande testfilens formler och beslutet för kassan; det är inte ett driftsgodkännande eller en granskning av hela EKO:s förenlighet med bokföringsregler.

## Så fungerar Swish i nuvarande EKO

- `Kassabok` har en inmatningsrad per bokförd betalning med A datum, B typ, C kategori, D betalsätt, E beskrivning, F belopp och G unikt kvitto-/fakturanummer. H–L kontrollerar radens giltighet. Endast rader med giltig status (I = 1) räknas in i översikten.
- `Kassabok!F8` beräknar Swishavgiften utifrån antalet **giltiga Swish-inkomstrader** plus giltiga Swishinbetalda medlemsavgifter, multiplicerat med `Grunddata!B18`. I testkopian är avgiften 1,90 kr per betalning. `Kassabok!B9` drar därefter av avgiften från bankens beräknade utgående saldo. Detta är EKO:s egen beräkning, inte en uppgift appen ska räkna fram.
- En mottagen Swishbetalning som innehåller flera varor ska därför föras in av kassören som **en** inkomstpost för betalningens totala belopp. Varorna specificeras i kassans separata logg. Kassören väljer en aktiv och relevant kategori i EKO, exempelvis `Fika` eller en kategori som har lagts till i `Grunddata`. `Café` och `Kiosk` finns inte som förvalda kategorier i den granskade testkopian. Kassan ska inte lägga till en extra kategorifråga i köpflödet.
- Varje faktisk Swishbetalning bokförs manuellt och separat av kassören, inte som kassatillfällets totalsumma och inte genom en automatisk appskrivning. Använd köp-ID som unik hänvisning i G så att EKO-raden kan stämmas av mot logg och bank. Om Swishbetalningen mottogs men köpet senare återbetalades kontant, ska ursprunglig Swishinkomst ligga kvar som egen betalning; kontantutbetalningen redovisas separat.

## Kassans övriga EKO-underlag

| Uppgift | EKO | Hantering |
| --- | --- | --- |
| Kontantförsäljning | `Kassabok` B `Inkomst`, D `Kontant` | Efter kassörens avstämning sammanförs den per vara med kategori `Försäljning`, beskrivning med vara/antal, belopp i F och unik kassa-referens i G. Ett sådant köp har skrivits till EKO-testkopian i liveprovet 2026-10-22. |
| Kontant återbetalning | `Kassabok` B `Utgift`, D `Kontant` | Förs in med spårbar hänvisning till kassa/köp och minskar förväntade kontanter. Lokal adapter är byggd men ännu inte driftsatt eller provad mot en skrivbar EKO-kopia. |
| Växelkassa | Inte en försäljningsintäkt | Ingår i avstämningen av den fysiska kassan. Insättning eller uttag gentemot bank kräver korrekt separat överföringsrad i EKO, inte en extra försäljningsrad. |
| Swishförsäljning | `Kassabok` B `Inkomst`, D `Swish` | Kassören bokför varje mottagen betalning manuellt som en enda rad med hela beloppet och rätt aktiv kategori. |

Förlagans `Kassabok!F8` räknade redan en avgift per giltig Swishrad. I Sheets-testkopian pekar medlemsdelen av samma formel på `Medlemmar!W12:W1011` i stället för Excel-filens äldre kontrollkolumn R, i linje med att appkolumner har lagts till. Formeln returnerar 1,90 kr för den befintliga testbetalningen och är inte ändrad i denna granskning. Detta riktade prov verifierar inte årsskifte eller hela bokslutet.

`src/cash-posting.mjs` skapar en radplan för **kontanter** och en separat lista över Swishbetalningar som kassören själv för in. Kassörens godkännande startar kontantöverföringen utan ett extra menyval. `CashEko.gs` använder unika referenser för att återuppta en avbruten kontantskrivning utan dubbletter och kontrollerar i ett senare steg att varje Swishbetalning finns som en egen giltig EKO-rad. Den beräknar ingen Swishavgift. Formler för giltighetskontroll finns i den aktuella testkopian även på sista kassaboksraden 2011; detta kontrollerades med läsåtkomst. Kodproven använder simulerade Sheets-svar.

I liveprovet 2026-10-22 skrev kassörens godkännande en rad i `Kassabok!A14:G14`: datum 2026-10-22, `Inkomst`, `Försäljning`, `Kontant`, `Testkaffe · 1 st`, 10 kr och `K-2026-0001-CASH-001`. Raden lästes tillbaka och de tre följande raderna var tomma vid kontrollen. Det visar att detta enskilda kontantköp bokfördes en gång. Avbruten skrivning, omräkning av hela EKO och slutligt driftprov återstår.

Kassans QR-underlag använder [Swishs dokumenterade förifyllda QR-gränssnitt](https://developer.swish.nu/api/qr-codes/v1) med föreningens nummer, exakt belopp och unik köpreferens. En QR-kod visar ett betalningsförslag, inte ett bankbekräftat köp. Den tekniska kopplingen är bara lokalt kodprovad och är avstängd tills föreningens verkliga nummer kan konfigureras och flödet provas i den skyddade appen.
