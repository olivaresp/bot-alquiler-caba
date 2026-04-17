# Instrucciones para Copilot

## Descripción del proyecto

Bot en Node.js que monitorea nuevos alquileres en Argenprop y envía notificaciones por Telegram. Usa Playwright para navegación headless y `setInterval` (no expresiones cron) para el scheduling.

## Comandos

```bash
npm start          # Ejecuta el bot (monitoreo continuo)
npm run scan       # Escaneo único para poblar data/listings.json sin enviar notificaciones a Telegram
npm run dev        # Ejecuta con --watch para recarga automática al modificar archivos
```

No hay suite de tests ni linter configurados.

## Arquitectura

Tres clases ESM conectadas en `main.js`:

- **`ArgenpropScraper`** (`src/scraper.js`) — Scraper basado en Playwright. Sigue la paginación de forma recursiva en `scrapeListings()`. Persiste los alquileres vistos en `data/listings.json` (array JSON plano). `scanForNewListings()` compara contra los IDs almacenados y retorna `{ newListings, newCount, totalScraped, isFirstRun }`. En la primera ejecución (`isFirstRun: true`), no se envían notificaciones.
- **`TelegramBot`** (`src/telegram.js`) — Envuelve la API de Telegram Bot via axios. `sendListingsNotification()` envía un mensaje resumen y luego uno por alquiler (4s de delay entre cada uno para no saturar la API). Las imágenes se descargan y envían en stream via `sendPhotoAsBase64()`; si falla, cae a texto.
- **`Scheduler`** (`src/scheduler.js`) — Envuelve `setInterval`. Ejecuta el callback inmediatamente al llamar `start()`, luego cada `intervalMs`. Nota: importa `node-cron` pero no lo usa — el scheduling se hace con `setInterval`.

Se crean dos instancias de `TelegramBot` en paralelo: `telegramBot` (notificaciones al usuario) y `monitorBot` (mensajes de estado operacional). El scraper recibe referencia a `monitorBot` via `setMonitorBot()`.

## Variables de entorno

Se definen en `.env` (copiar desde `.env.example`):

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Token de BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | — | Chat destino para alertas de alquileres |
| `TELEGRAM_MONITOR_CHAT_ID` | ❌ | — | Chat separado para estado operacional (mensajes 🟢/🔴) |
| `SCAN_INTERVAL` | ❌ | `600000` | Intervalo de escaneo en milisegundos |
| `BASE_URL` | ❌ | `https://www.argenprop.com` | URL base de Argenprop |

La URL de búsqueda (`SCRAPE_URL`) está hardcodeada en `main.js` y debe editarse directamente para cambiar barrios o rango de precio.

## Convenciones clave

- **ESM en todo el proyecto** — todos los archivos usan `import`/`export`, con `"type": "module"` en `package.json`. Usar `fileURLToPath(import.meta.url)` + `dirname` como equivalente de `__dirname`.
- **Deduplicación por id del DOM** — los alquileres se identifican por el atributo `id` del elemento `.listing__item`. Los IDs almacenados se cargan de `data/listings.json` y se convierten en un `Set` en cada escaneo.
- **Extracción de imagen con cadena de fallback** — el scraper prueba múltiples selectores CSS y atributos (`src`, `data-src`, `data-lazy`) en orden; gana el primer valor no nulo.
- **Telegram en modo HTML** — todos los mensajes usan `parse_mode: 'HTML'`. Usar etiquetas `<b>`, `<a href="">` en los captions, no Markdown.
- **Rate limiting** — se inserta un `delay()` de 4 segundos entre cada mensaje en `sendListingsNotification()`. No eliminar este delay.
- **`data/listings.json` es estado en tiempo de ejecución** — eliminarlo reinicia el bot y dispara un nuevo escaneo inicial. No se commitea al repositorio.
