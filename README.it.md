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
      DATABASE_PATH: /data/cad.sqlite3
    ports:
      - "8000:8000"
    volumes:
      - ari-lecco-cad-data:/data

volumes:
  ari-lecco-cad-data:
```

Apri `http://IP-SERVER:8000` dalla rete interna.

## Ruoli

- Admin: log gara, configurazione, import atleti, notifiche, esportazioni e archivi.
- Utente: visualizza log/mappa e invia notizie.
- Annunciatore: visualizza solo notizie e pagina annunciatore.

## URL utili

- Log gara: `http://IP-SERVER:8000/`
- Invio notizia: `http://IP-SERVER:8000/invia-notizia`
- Annunciatore: `http://IP-SERVER:8000/annunciatore`
- Configurazione: `http://IP-SERVER:8000/setup`

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
