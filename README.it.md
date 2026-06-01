# ARI Lecco CAD

Applicazione CAD interna via web per gare ed eventi radio.

## Avvio con Portainer

Usa l'immagine Docker pubblicata da GitHub:

```text
ghcr.io/dlanfranconi/ari-lecco-cad:latest
```

Stack Portainer di base:

```yaml
services:
  cad:
    image: ghcr.io/dlanfranconi/ari-lecco-cad:latest
    container_name: ari-lecco-cad
    restart: unless-stopped
    environment:
      CAD_ADMIN_USERNAME: dispatch
      CAD_ADMIN_PASSWORD: change-me
      SESSION_SECRET: replace-with-a-long-random-string
      APRSFI_API_KEY: ""
      APRS_POLL_SECONDS: 60
      DRATS_INGEST_TOKEN: change-this-token
      TZ: Europe/Rome
      LANG: it_IT.UTF-8
      NTP_SERVER: pool.ntp.org
      DATABASE_PATH: /data/cad.sqlite3
    ports:
      - "8000:8000"
    volumes:
      - ari-lecco-cad-data:/data

volumes:
  ari-lecco-cad-data:
```

Apri `http://IP-SERVER:8000` dalla rete interna.

## Fuso orario e NTP

Imposta `TZ` al fuso orario della gara, per esempio `Europe/Rome`. In Configurazione sono disponibili anche i campi Fuso orario, Locale e Server NTP. `NTP_SERVER` usa `pool.ntp.org` come valore predefinito; su una rete senza internet puoi indicare un server NTP locale. Il server/VM che ospita Docker deve comunque sincronizzare l'ora di sistema con quella sorgente NTP.

## Ruoli

- Admin: log gara, cronometro gara, configurazione, import atleti, notizie, approvazioni, esportazioni e archivi.
- Utente: visualizza log/mappa e invia notizie da approvare.
- Pagina annunciatore: accesso diretto senza credenziali da `/annunciatore` o `/announcer`.

## URL utili

- Log gara: `http://IP-SERVER:8000/`
- Invio notizia: `http://IP-SERVER:8000/invia-notizia`
- Annunciatore: `http://IP-SERVER:8000/annunciatore`
- Configurazione: `http://IP-SERVER:8000/setup`

## Cronometro gara e tempo crono

Dal Log gara un admin puo premere `Avvia cronometro`. CAD salva automaticamente una voce log "Gara iniziata" con i metadati dell'admin che l'ha generata. La voce resta nei dati esportati anche se non serve mostrarla diversamente nella tabella.

Nei log e nelle notizie puoi inserire un `Tempo crono` manuale. Se il campo viene lasciato vuoto, CAD usa il cronometro gara avviato dal Log gara.

## Notizie e log per piu atleti

Nei campi `Pettorale` di Log gara, Invio notizia e notizia diretta da dispatch puoi inserire piu numeri separati da virgole o da righe separate, per esempio:

```text
101, 102, 118
```

CAD crea una voce ordinata per ogni atleta, recupera nome e citta dall'elenco atleti e genera il testo automatico usando la postazione selezionata. Puoi comunque scrivere un testo libero; in quel caso viene usato per tutte le voci create.

## Approvazione notizie

Quando un utente invia una notizia, dispatch riceve un popup in qualunque schermata del CAD. Dal popup o dalla pagina Notizie l'admin puo modificare testo e tempo crono prima di approvare, oppure rifiutare la notizia.

## Schermata annunciatore

La pagina annunciatore non richiede login. Mostra la notizia piu recente in grande e mantiene le notizie precedenti in carattere piu piccolo.

Comandi disponibili:

- Freccia sinistra: mostra una notizia precedente.
- Freccia destra: torna verso le notizie piu recenti.
- Click sulla meta sinistra dello schermo: mostra una notizia precedente.
- Click sulla meta destra dello schermo: torna verso le notizie piu recenti.
- Pulsante con luna: alterna contrasto chiaro/scuro.

## Import atleti

Formato CSV:

```csv
bib number,name,home town
101,Mario Rossi,Lecco
102,Giulia Bianchi,Como
```

Un modello e disponibile in:

```text
examples/athlete-list-template.csv
```

## D-RATS / D-STAR

Il PC radio con D-RATS puo inviare posizioni GPS al server CAD con:

```bash
python3 scripts/watch_dstar_positions.py \
  --cad-url http://IP-SERVER:8000 \
  --token change-this-token \
  --file dstar_positions.csv
```

Formato righe CSV osservate:

```csv
IU2ABC,45.85,9.39,commento opzionale
```

Nel setup CAD assegna lo stesso nominativo D-STAR all'utente/operatore.

## Archivi

Quando usi `Cancella tutto` o cambi nome gara, inserisci un nome file archivio. Il browser scarica un file JSON sul PC locale. Gli archivi restano anche visualizzabili, scaricabili, eliminabili e reimportabili dalla pagina Configurazione.


## Preposizioni postazione

I nominativi tattici/postazioni possono includere una preposizione nel Setup, per esempio `a`, `al`, `alla`. Le notizie generate per gli atleti usano quel valore nel testo automatico.


## Nominativi tattici

I nominativi tattici restano tra una gara e l'altra. Gestiscili in Configurazione: aggiungi, modifica, disabilita o rimuovi. La rimozione toglie l'assegnazione dagli utenti/operatori ma non elimina gli utenti.
