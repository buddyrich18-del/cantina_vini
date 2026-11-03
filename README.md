# Cantina

App Android per gestire la cantina di vini. Scansioni il codice a barre di una bottiglia e la carichi o scarichi; foto e prezzo medio si compilano da soli quando disponibili.

## Funzioni

- **Carica / scarica** con scanner del codice a barre (EAN/UPC), anche in modalità continua
- **Dati automatici**: nome, produttore e foto da Open Food Facts; ripiego su UPCitemdb
- **Prezzo medio**: media dei prezzi di mercato in EUR da Open Prices; se manca, media di quanto hai pagato
- **Foto** della bottiglia (fotocamera o galleria)
- Annata, tipo, posizione in cantina, valutazione, finestra di consumo, note di degustazione, abbinamenti
- **Scopri**: scansioni una bottiglia (anche al ristorante) e ottieni che vino è, note sensoriali attese, abbinamenti e servizio. Gratis e offline: profilo tipico per denominazione/vitigno (circa 50 stili) riconosciuto dal nome. Facoltativo: con una tua chiave API di Claude in *Altro* la scheda è più precisa
- Storico movimenti, statistiche (valore, spesa, per tipo, da bere presto)
- Backup/ripristino JSON ed export CSV
- Tutto salvato sul telefono, funziona offline (la ricerca online no)

Ispirata a Oeni (inventario, valore, maturità) e MyVinapp (diario, note, foto).

## Ottenere l'APK

1. Carica questo progetto in un repository GitHub.
2. Vai in **Actions → Build APK → Run workflow** (parte anche a ogni push su `main`).
3. A fine build scarichi `cantina.apk` da **Releases** (o dagli artifact del run) e lo installi sul telefono, consentendo le "origini sconosciute".

L'APK è di tipo *debug*: si installa subito, ma non è adatto al Play Store (serve una firma release).

## Sviluppo locale

```bash
npm install
npm run dev            # anteprima nel browser (scanner non disponibile, codice manuale sì)
npm run sync           # build web + copia in android/
cd android && ./gradlew assembleDebug
```

Richiede Node 22 e JDK 21 (+ Android SDK per la build locale).

## Limiti noti

- Open Food Facts e Open Prices sono banche dati collaborative: molti vini, soprattutto di nicchia, non hanno dati o prezzi. In quel caso inserisci tu nome e prezzo.
- Lo stesso codice a barre può valere per più annate: l'app distingue le voci per codice + annata.
