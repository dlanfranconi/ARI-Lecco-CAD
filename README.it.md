# ARI Lecco CAD

Applicazione web interna di dispacciamento assistito (CAD) per gare ed eventi radio.

## Cosa include

- Log gara con archiviazione persistente su SQLite, aggiornato in tempo reale su ogni scheda/dispositivo aperto — nessun aggiornamento manuale necessario per cronometro gara, log dispacciamento o coda notizie
- Configurazione gara modificabile per utenti/operatori e stazioni APRS
- Menu utente con nominativo tattico/postazione, nominativo operatore, stato e localita libera
- Assegnazione stazione APRS opzionale per utente
- Ultima posizione APRS allegata alle voci di log quando disponibile
- Flusso di richiesta notizie per utenti non dispatch
- Coda di approvazione dispatch con popup per le nuove richieste di notizia
- Schermata annunciatore aggiornata in tempo reale via WebSocket con fallback a polling
- Esportazione CSV del log, CSV waypoint APRS ed esportazione GeoJSON waypoint
- Cancellazione dati gara dopo l'esportazione
- Monitoraggio dispositivi di rete con stato online/offline in tempo reale e avvisi (pagina Rete)
- Test qualita del collegamento con iperf3 tra il server e le postazioni radio remote
- Test di velocita da telefono/dispositivo verso il server di dispacciamento, direttamente dalla pagina Rete
- Individuazione del server sulla rete locale via mDNS (`cad-server.local`) — niente piu ricerca manuale dell'IP
- HTTPS opzionale con certificato autofirmato generato automaticamente
- App Android (vedi "App mobile" piu sotto) con selezione server sicura offline, accesso persistente e pulsante Indietro nativo che si comporta come un'app, non come un browser
- Numero di versione mostrato nel piede pagina, per capire a colpo d'occhio quale build sta effettivamente eseguendo un dispositivo
- Distribuzione compatibile con Docker e Portainer

## Avvio rapido con Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Apri:

- App dispatch: `http://IP-SERVER`
- Vista annunciatore: `http://IP-SERVER/announcer`
- Invio notizia: `http://IP-SERVER/submit-notification`

L'app ascolta sulla porta 80 per impostazione predefinita, quindi non serve indicare la porta nell'URL. Imposta `PORT` in `.env` per cambiarla (per esempio se qualcos'altro sull'host usa gia la porta 80).

## Immagine Docker pronta all'uso

GitHub Actions compila e pubblica un'immagine a ogni push su `main` o `WIP`:

```text
ghcr.io/dlanfranconi/ari-lecco-cad:latest   # da main — la release vera e propria
ghcr.io/dlanfranconi/ari-lecco-cad:wip      # da WIP — per testare prima di una release
```

Entrambi i tag hanno anche una build `:<git-sha>` per fissare un commit esatto. Usa `:wip` per testare lavoro in corso su Portainer prima di unire `WIP` in `main` per fare una release vera — `:latest` si aggiorna solo quando cambia `main`.

Stack Portainer con l'immagine pronta all'uso:

```yaml
services:
  cad:
    image: ghcr.io/dlanfranconi/ari-lecco-cad:latest
    container_name: ari-lecco-cad
    restart: unless-stopped
    # Rete host cosi mDNS (cad-server.local) raggiunge la LAN. Solo host Docker
    # Linux; richiede la porta 80 libera sull'host. Vedi "Individuazione server (mDNS)" piu sotto.
    network_mode: host
    environment:
      CAD_ADMIN_USERNAME: dispatch
      CAD_ADMIN_PASSWORD: dispatch
      SESSION_SECRET: replace-with-a-long-random-string
      APRSFI_API_KEY: ""
      APRS_POLL_SECONDS: 60
      DRATS_INGEST_TOKEN: change-this-token
      TZ: Europe/Rome
      LANG: it_IT.UTF-8
      NTP_SERVER: pool.ntp.org
      DATABASE_PATH: /data/cad.sqlite3
      MDNS_HOSTNAME: cad-server
      PORT: 80
    volumes:
      - ari-lecco-cad-data:/data

volumes:
  ari-lecco-cad-data:
    # Nome esplicito e fisso — senza questo, Docker aggiunge come prefisso
    # il nome dello stack/progetto al volume (es. uno stack chiamato "cad"
    # ottiene "cad_ari-lecco-cad-data"). Se in futuro ridistribuisci lo
    # stack con un nome diverso, o esegui `docker compose up` da una
    # cartella con nome diverso, Compose crea silenziosamente un nuovo
    # volume vuoto invece di riusare quello vecchio — i dati non vengono
    # distrutti, restano solo orfani sotto il vecchio nome, e sembra
    # esattamente che tutto sia stato cancellato. Fissare il nome qui
    # garantisce che il volume sia sempre lo stesso, indipendentemente
    # da come distribuisci lo stack.
    name: ari-lecco-cad-data
```

Il primo accesso predefinito e `dispatch` / `dispatch` quando il database non contiene utenti. Questo account di avvio viene creato anche se `CAD_ADMIN_PASSWORD` contiene ancora un vecchio valore. Cambia la password in Configurazione, e cambia `SESSION_SECRET` e `APRSFI_API_KEY` in Portainer prima dell'uso in gara.

### Quale build sta effettivamente eseguendo?

Ogni piede pagina mostra una stringa di versione, per esempio `vmain@a1b2c3d` (branch + commit abbreviato) oppure `vdev` per un `docker compose up --build` locale senza CI. Questo e il primo posto da controllare prima di pensare che qualcosa sia rotto — una distribuzione vecchia e non aggiornata che mostra un comportamento vecchio non e un bug, e il piede pagina lo rende visibile a colpo d'occhio invece di dover collegarsi via SSH e confrontare i file a mano.

## Individuazione server (mDNS)

Il server si annuncia sulla rete locale come `cad-server.local` (via mDNS/Bonjour) cosi gli utenti possono digitare un nome invece di cercare un IP a ogni gara — e questo che il campo "nome server" dell'app mobile risolve. Configura con:

```bash
MDNS_HOSTNAME=cad-server   # produce cad-server.local
MDNS_ENABLED=true       # imposta a false per disabilitare
```

Richiede `network_mode: host` in Docker (impostato sopra) perche il multicast mDNS non attraversa la rete bridge predefinita di Docker — con la rete bridge l'app si avvia comunque normalmente, ma nessuno sulla rete locale vedra l'annuncio. Se sulla stessa rete girano due server CAD, assegna loro valori diversi di `MDNS_HOSTNAME`.

## Strumenti di rete (pagina Rete)

La pagina **Rete** (nel menu in alto) e un pannello per lo stato di salute della rete su cui gira effettivamente la gara — separato dai dati gara. Stato dispositivi, eventi e target iperf3 sono gestiti dagli admin, ma qualsiasi utente/operatore autenticato puo vedere lo stato ed eseguire test, perche lo scopo e permettere agli operatori di autotestarsi da dove si trovano, non solo agli admin da una postazione fissa.

### Monitoraggio dispositivi

Aggiungi un dispositivo con nome e indirizzo IP; il server lo interroga (ping) ogni `NETWORK_MONITOR_POLL_SECONDS` (30 secondi predefiniti) e mostra lo stato online/offline in tempo reale con l'orario dell'ultimo controllo. I cambi di stato appaiono immediatamente su ogni pagina Rete aperta (senza ricaricare) con una notifica a comparsa, e vengono registrati in uno storico eventi. Puoi assegnare opzionalmente un dispositivo a un utente da notificare — per ora e solo un'etichetta (mostrata nel flusso eventi), non ancora una notifica push su un telefono.

```bash
NETWORK_MONITOR_ENABLED=true
NETWORK_MONITOR_POLL_SECONDS=30
```

### Test qualita del collegamento con iperf3

Per testare il throughput reale sui collegamenti wireless PTMP (non solo la raggiungibilita), aggiungi un target con host/porta di un server `iperf3` gia in esecuzione in quella postazione:

```bash
# Sul PC/Pi lato radio in ogni postazione da testare:
iperf3 -s
```

Poi clicca **Esegui test** accanto a quel target nella pagina Rete — il server CAD esegue `iperf3 -c <host>` e mostra il risultato (Mbps) in linea, con storico. Serve un server `iperf3` effettivamente in esecuzione all'altro capo; il server CAD agisce solo da client. `IPERF_TEST_SECONDS` (5 secondi predefiniti) controlla la durata di ogni test.

### Test di velocita

In cima alla pagina Rete, **Esegui test** sotto Test di velocita misura throughput di download/upload e latenza tra il dispositivo corrente (telefono, portatile, qualsiasi cosa tu stia usando per vedere la pagina) e il server di dispacciamento stesso. E un test basato su HTTP semplice (non protocollo iperf3) quindi funziona da qualsiasi browser o dall'app mobile senza software aggiuntivo — un buon controllo rapido "la mia connessione al dispatch funziona davvero" da qualunque postazione si trovi l'operatore.

## HTTPS (opzionale)

Disattivato per impostazione predefinita. Il server puo anche ascoltare su una seconda porta via HTTPS, usando un certificato autofirmato che genera da solo al primo avvio e riusa a ogni riavvio (salvato sotto `CERT_DIR`, per impostazione predefinita dentro il volume dati persistente):

```bash
HTTPS_ENABLED=false   # imposta a true per abilitare
HTTPS_PORT=443
CERT_DIR=/data/certs
```

Essendo autofirmato (non emesso da una CA pubblica — non c'e un dominio pubblico per cui ottenerne uno su una rete locale privata), browser e app mostreranno un avviso "non affidabile" una tantum; procedi/fidati del certificato. Non c'e modo di evitarlo senza un dominio pubblico reale o installare manualmente il certificato come attendibile su ogni dispositivo, quindi e un comportamento atteso, non un bug.

**Limite noto:** al momento HTTP e HTTPS girano come due processi server separati (necessario per aggirare un bug specifico dell'ambiente — vedi lo storico dei commit `62c8c12`/`7defca9` se curioso). Questo significa che gli aggiornamenti live via WebSocket (nuove notizie, stato dispositivi, cronometro gara) raggiungono solo i client connessi tramite la porta/protocollo che stanno effettivamente usando — una scheda HTTP e una scheda HTTPS non vedranno istantaneamente gli aggiornamenti live l'una dell'altra, anche se entrambe ricevono comunque i dati corretti a ogni caricamento/ricaricamento della pagina.

## Fuso orario e NTP

Imposta `TZ` al fuso orario della gara, per esempio `Europe/Rome`. L'app espone anche i campi Fuso orario, Locale e Server NTP in Configurazione. `NTP_SERVER` usa `pool.ntp.org` come valore predefinito; su una rete di gara isolata, impostalo al tuo server NTP locale. L'host o la VM devono comunque essere configurati per sincronizzare l'ora di sistema con quella sorgente NTP.

## Portainer

Crea un nuovo stack usando `docker-compose.yml`.

Bind mount persistente consigliato:

```text
./data:/data
```

Imposta le variabili d'ambiente in Portainer oppure copia `.env.example` in `.env`.

### Rete host (richiesta per mDNS) — cosa aspettarsi

`docker-compose.yml` usa `network_mode: host`, ed e questo che fa funzionare `cad-server.local` sulla rete locale. Cambia anche il modo in cui il container ottiene la sua porta, in modi che possono sorprendere se non li aspetti:

- **Non c'e una mappatura "Published Ports".** Con `network_mode: host` il container comunica direttamente sulla rete dell'host stesso — Portainer non mostrera un campo porte per esso, ed e corretto, non un bug. Non aggiungere di nuovo una voce `ports:`; viene ignorata (e puo mascherare conflitti reali) con la rete host.
- **La porta 80 (o quella impostata in `PORT`) deve essere completamente libera sull'host stesso** prima che il container si avvii — non "libera dentro Docker", libera sulla macchina reale. Qualsiasi cosa gia in ascolto su quella porta (incluso un vecchio container di questa stessa app non completamente fermato) fara fallire il nuovo container immediatamente con:
  ```text
  ERROR: [Errno 98] error while attempting to bind on address ('0.0.0.0', 80): address already in use
  ```
  La porta 80 e comoda (nessun numero di porta nell'URL) ma e anche la porta web piu usata su una macchina — se l'host esegue gia qualcos'altro sulla porta 80 (un reverse proxy, l'interfaccia di Pi-hole, un'altra app), imposta `PORT` a qualcos'altro, per esempio `8420`, nel tuo ambiente.
- **Solo host Docker Linux.** Docker Desktop su Mac/Windows non supporta la vera rete host. Se distribuisci li, vedi "Non vuoi la rete host?" piu sotto.
- Collegarsi alla porta 80 richiede privilegi di root; il container gira gia come root al suo interno, quindi funziona senza configurazioni aggiuntive.

### Risolvere "address already in use"

Questo significa quasi sempre che qualcosa e gia collegato alla porta su cui stai distribuendo — piu comunemente un vecchio container `ari-lecco-cad` ancora in esecuzione (subito dopo aver passato uno stack a `network_mode: host`, o dopo un aggiornamento Portainer che non ha ripulito completamente il container precedente), oppure un altro servizio che gia usa la porta 80.

1. In Portainer, vai su **Containers** e cerca qualsiasi container chiamato `ari-lecco-cad`. Se ne vedi piu di uno, o uno ancora `running` da prima del tuo aggiornamento, selezionalo e clicca **Stop**, poi **Remove**.
2. Torna su **Stacks**, apri questo stack e clicca di nuovo **Update the stack** (o **Deploy**).
3. Ancora bloccato, o non sai quale container sia? Collegati via SSH all'host Docker ed esegui (sostituisci la tua porta se hai cambiato `PORT`):
   ```bash
   docker ps --filter "publish=80"
   ```
   Questo trova esattamente il container che tiene ancora la *vecchia* mappatura di porta in modalita bridge (i suoi log mostreranno un processo `docker-proxy` se controlli con `sudo ss -tlnp | grep :80` — quel processo e il port-forwarder di Docker per un container in modalita bridge, conferma che si tratta di un container residuo e non di un servizio non correlato). Fermalo e rimuovilo:
   ```bash
   docker stop <nome-o-id>
   docker rm <nome-o-id>
   ```
   Poi ridistribuisci lo stack. Se `docker ps --filter "publish=80"` non restituisce nulla, qualcos'altro *oltre* a Docker sta usando quella porta — ferma quel servizio, oppure imposta `PORT` a qualcos'altro nel tuo ambiente (per esempio `PORT=8420`) e ridistribuisci.

### Non vuoi la rete host?

Se sei su Docker Desktop, non ti serve `cad-server.local`, o vuoi semplicemente la configurazione piu semplice/sicura: elimina la riga `network_mode: host` dal tuo stack e aggiungi invece una normale mappatura di porta:

```yaml
    # network_mode: host   <- rimuovi questa riga
    ports:
      - "80:80"             <- aggiungi questa invece
```

Tutto funziona allo stesso modo tranne l'individuazione mDNS — gli utenti dovranno digitare l'indirizzo IP reale del server nell'app invece di `cad-server.local`. Docker gestisce completamente la porta in questo modo, quindi il problema "address already in use" descritto sopra non si presenta (Docker ti dira chiaramente se la porta e occupata, invece che il container prova silenziosamente a collegarsi a tutta la rete dell'host).

## Raspberry Pi

Il modo piu semplice per gestire un server CAD dedicato e un Raspberry Pi (3B+ o piu recente, 64-bit) — economico, a basso consumo, e facile da portare sul luogo della gara. Due modi per configurarne uno, dal piu semplice al piu flessibile:

### Opzione A: flasha l'immagine appliance pronta all'uso (consigliata)

Ogni [GitHub Release](https://github.com/dlanfranconi/ARI-Lecco-CAD/releases) include `ari-lecco-cad-pi-vX.Y.Z.img.xz` — un'immagine Raspberry Pi OS che si configura completamente da sola al primo avvio. Nessun SSH, nessuna digitazione, nessuna finestra di personalizzazione di Raspberry Pi Imager necessaria.

1. Scarica il file `.img.xz` dalla release e flashalo su una scheda microSD con [Raspberry Pi Imager](https://www.raspberrypi.com/software/) ("Use custom" → scegli il file) o `balenaEtcher` — non usare la finestra di personalizzazione OS di Imager, l'immagine ha gia tutto configurato.
2. Inserisci la scheda, collega il Pi alla rete con un **cavo Ethernet** (l'immagine non ha credenziali Wi-Fi precaricate), e accendilo.
3. Attendi 3-5 minuti per il primo avvio (l'installazione di Docker e il download dell'immagine richiedono la maggior parte di questo tempo). Poi apri `http://cad-server.local` da qualsiasi dispositivo sulla stessa rete.
4. Accedi con `dispatch` / `dispatch` — ti verra chiesto di cambiare subito la password.

L'accesso al sistema operativo del Pi stesso (console o SSH, es. `ssh pi@cad-server.local`) usa di default `pi` / `arilecco` e **richiede anch'esso il cambio password al primo accesso**, indipendentemente dal login dell'app. Cambiala la prima volta che ti colleghi davvero via SSH.

Per usare il Wi-Fi al posto dell'Ethernet, o per cambiare il nome host mDNS predefinito prima del primo avvio, inserisci la scheda flashata in un PC e modifica `user-data` / `network-config` nella piccola partizione di boot (testo semplice, formato [cloud-init](https://cloudinit.readthedocs.io/)) prima di accendere il Pi.

### Opzione B: script di bootstrap su un'installazione esistente

Se hai gia Raspberry Pi OS installato e raggiungibile via SSH (per esempio flashato e configurato tu stesso tramite la finestra di personalizzazione di Raspberry Pi Imager), esegui:

```bash
curl -fsSL https://github.com/dlanfranconi/ARI-Lecco-CAD/releases/latest/download/bootstrap.sh | sudo sh
```

Questo installa Docker, genera un session secret casuale, e avvia il container CAD nello stesso modo in cui lo fa l'immagine dell'Opzione A — vedi `pi-setup/INSTALL.md` per i dettagli e il pacchetto completo `pi-setup/` allegato a ogni release.

## APRS.fi

Imposta una chiave API APRS.fi:

```bash
APRSFI_API_KEY=your-key-here
```

Non serve l'elenco completo delle stazioni al momento della build. Aggiungi le stazioni nella pagina di configurazione prima di ogni gara, poi assegna una stazione a ogni utente/operatore secondo necessita.

L'app salva le posizioni APRS localmente durante il polling, cosi le esportazioni post-gara possono includere lo storico dei waypoint.

## Accesso predefinito

Configurato in `.env`:

```bash
CAD_ADMIN_USERNAME=dispatch
CAD_ADMIN_PASSWORD=dispatch
```

Cambia la password prima dell'uso reale, anche su una rete interna.

## App mobile (Android)

La cartella `mobile/` e un progetto [Capacitor](https://capacitorjs.com) che avvolge questa stessa applicazione web in un guscio nativo Android — non e un'app separata con una propria interfaccia, e una WebView leggera che si collega al tuo vero server di dispacciamento. Non c'e interfaccia offline inclusa oltre a una schermata di connessione una tantum per "inserire il nome del server".

### Compilare l'APK

Richiede Node.js, un JDK (17 o 21; **non** l'ultimissimo JDK — Gradle non supporta i JDK appena rilasciati immediatamente), e gli strumenti da riga di comando dell'Android SDK.

```bash
cd mobile
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```

L'APK di debug viene scritto in `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Installalo manualmente (`adb install -r app-debug.apk`, oppure copialo sul telefono e aprilo — dovrai consentire "installa app sconosciute" per qualunque app tu usi per aprirlo, dato che non e una build del Play Store).

### Come si collega

Al primo avvio, l'app chiede un nome server o IP — digita il nome mDNS (`cad-server.local`) o l'indirizzo IP del server; nessuna porta necessaria se il server e sulla porta predefinita 80. Verifica la raggiungibilita, poi passa alle pagine del server live, come farebbe un browser. L'accesso resta valido per 30 giorni (un vero cookie di sessione, non credenziali salvate), quindi in genere ci si autentica una sola volta per installazione.

### Comportamenti specifici dell'app

- **Pulsante Indietro**: da qualsiasi altra schermata dell'app (Annunciatore, Configurazione, Rete, ecc.) torna alla schermata principale di dispacciamento invece di uscire dall'app o tornare indietro nella cronologia delle pagine. Dalla schermata principale, premere Indietro due volte entro 2 secondi chiude l'app.
- **Nessun service worker**: l'app non usa lo stesso meccanismo di cache offline della versione web (non c'e alcun vantaggio in un'app nativa gia installata, e in passato ha causato veri bug di contenuto non aggiornato — vedi lo storico dei commit se curioso). Se una pagina sembra non aggiornata dopo una distribuzione, riavviare l'app o reinstallare l'APK risolve.
- **I link `target="_blank"`** (come il link Annunciatore, che su desktop apre una seconda scheda) vengono automaticamente modificati per navigare nella stessa pagina — non c'e un'interfaccia a schede in una WebView su cui far atterrare una "nuova scheda".
- **Il logout** si trova nello stesso menu a tendina del resto della navigazione (vedi sotto), non in un elemento nativo separato.

### Menu a tendina responsivo

Su qualsiasi schermo stretto (web o app, sotto circa 860px di larghezza) la navigazione in alto si comprime in un menu a hamburger — tocca per aprire, tocca fuori o un link per chiudere. Non e specifico di Android; anche un browser su telefono riceve lo stesso trattamento.

## D-RATS / D-STAR

Il PC radio esegue D-RATS. Il server CAD gira sul server. Per spostare le posizioni GPS D-STAR in CAD, il PC radio deve inviare (POST) ogni posizione ricevuta al server CAD.

In Portainer, imposta un token condiviso:

```yaml
DRATS_INGEST_TOKEN: change-this-token
```

L'endpoint CAD e:

```text
POST http://IP-SERVER/api/dstar/positions
```

Payload JSON:

```json
{
  "callsign": "IU2ABC",
  "lat": 45.85,
  "lon": 9.39,
  "source": "d-rats",
  "comment": "opzionale"
}
```

Test manuale dal PC D-RATS:

```bash
python3 scripts/post_dstar_position.py \
  --cad-url http://IP-SERVER \
  --token change-this-token \
  --callsign IU2ABC \
  --lat 45.85 \
  --lon 9.39
```

Oppure con curl:

```bash
curl -X POST http://IP-SERVER/api/dstar/positions \
  -H "Content-Type: application/json" \
  -H "X-D-RATS-Token: change-this-token" \
  -d '{"callsign":"IU2ABC","lat":45.85,"lon":9.39,"source":"d-rats"}'
```

Nella Configurazione CAD, assegna lo stesso nominativo D-STAR all'utente/operatore. Le nuove voci di log da quell'utente allegheranno l'ultima posizione APRS o D-STAR disponibile.

D-RATS di per se non espone attualmente un semplice target HTTP integrato per l'invio a CAD. Il ponte puo essere alimentato da qualsiasi fonte disponibile sul PC D-RATS: un'esportazione D-RATS, uno script locale che legge i dati di posizione D-RATS, o un'utilita D-PRS/GPS D-STAR che puo richiamare un comando quando arriva un frame GPS.

Osservatore continuo del flusso D-RATS:

```bash
python3 scripts/watch_dstar_positions.py \
  --cad-url http://IP-SERVER \
  --token change-this-token \
  --file dstar_positions.csv
```

Aggiungi righe a `dstar_positions.csv` in questo formato:

```csv
IU2ABC,45.85,9.39,commento opzionale
```

Qualsiasi helper lato D-RATS, utilita D-PRS o software radio in grado di scrivere i frame GPS ricevuti come CSV puo alimentare quel file.

## Import CSV atleti

Importa gli atleti da Configurazione usando un file CSV. Il modello consigliato e:

```csv
bib_number,first_name,last_name,hometown
101,Mario,Rossi,Lecco
102,Giulia,Bianchi,Como
103,Luca,Verdi,
```

`hometown` e facoltativo. Se resta vuoto, la pagina annunciatore non mostra la colonna citta/localita per quell'atleta.

L'importatore accetta anche intestazioni piu semplici/vecchie, incluse `bib number,name,home town`, `bib,name,hometown`, e intestazioni italiane comuni come `pettorale,nome,cognome,citta`. I file CSV possono usare virgola, punto e virgola o tab come separatore. Dopo l'import, Configurazione mostra quante righe sono state importate e quante sono state saltate. Le righe vengono saltate quando CAD non trova sia un numero di pettorale sia un nome utilizzabile.

Quando si invia una notizia, inserisci il numero di pettorale e seleziona una postazione. CAD generera una notizia usando l'impostazione configurata per la visualizzazione del nome atleta. La modalita italiana usa il modello di arrivo in italiano.

## Download archivi

Quando avvii una nuova gara o usi Cancella tutto, inserisci un nome file archivio come:

```text
race-name-final.json
```

L'app archivia i log attivi, le notizie, le posizioni APRS e D-STAR, cancella i dati gara attivi, poi reindirizza il browser per scaricare il file archivio sul PC locale in uso.

Le gare archiviate restano anche navigabili da Configurazione.

## Gestione atleti

Configurazione supporta l'import CSV e l'aggiunta/modifica/disabilitazione/eliminazione manuale degli atleti. Importare un CSV sostituisce la lista atleti: i numeri di pettorale gia presenti vengono aggiornati, i nuovi numeri di pettorale vengono aggiunti e gli atleti i cui numeri di pettorale non sono presenti nel CSV caricato vengono rimossi. Intestazioni CSV consigliate:

```csv
bib_number,first_name,last_name,hometown
101,Mario,Rossi,Lecco
```

Il modello incluso e `examples/athlete-list-template.csv`.

## Preposizioni postazione

I nominativi tattici/postazioni possono includere una preposizione in Configurazione, come `a`, `al`, `alla`. Le notizie degli atleti usano quel valore quando generano automaticamente i messaggi di arrivo.

## Nominativi tattici

I nominativi tattici restano tra una gara e l'altra. Gestiscili in Configurazione: aggiungi, modifica, disabilita o rimuovi. Rimuovere un nominativo tattico lo scollega dagli utenti/operatori ma non elimina quegli utenti.
