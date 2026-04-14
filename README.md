# Argenprop Scraper con Notificaciones por Telegram

Script automatizado para monitorear nuevos alquileres en Argenprop y recibir notificaciones por Telegram.

## Características

✅ Scraping automático cada 10 minutos (configurable)  
✅ Detección de nuevos alquileres  
✅ Almacenamiento en JSON  
✅ Notificaciones por Telegram con imágenes  
✅ Manejo de paginación automática  
✅ Delays entre mensajes para no saturar API  

## Instalación

1. **Clonar/descargar el proyecto**

```bash
cd bot-alquileres-caba
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env
```

Edita `.env` y agrega:
- `TELEGRAM_BOT_TOKEN`: Token de tu bot de Telegram (obtenido de BotFather)
- `TELEGRAM_CHAT_ID`: ID del chat donde recibirás las notificaciones

## Cómo obtener credenciales de Telegram

### 1. Crear el Bot (en Telegram)
- Busca `@BotFather` en Telegram
- Envía `/newbot`
- Sigue las instrucciones para crear tu bot
- Copia el **Token** que recibirás

### 2. Obtener tu Chat ID
- Busca en Telegram `@userinfobot` o `@getidsbot`
- Envía `/start`
- Te mostrará tu **Chat ID**

### 3. Actualizar `.env`
```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=1234567890
SCAN_INTERVAL=600000
BASE_URL=https://www.argenprop.com
```

## Uso

### Ejecutar el scraper

```bash
npm start
```

El scraper:
1. Iniciará inmediatamente y hará el primer escaneo
2. Enviará los nuevos alquileres encontrados por Telegram
3. Continuará ejecutándose cada 10 minutos
4. Se detendrá con `Ctrl+C`

### Modo desarrollo (con auto-recarga)

```bash
npm run dev
```

## Estructura de datos

Los alquileres se guardan en `data/listings.json`:

```json
[
  {
    "id": "listing-1234567",
    "link": "https://www.argenprop.com/alquiler/departamento/...",
    "image": "https://...",
    "price": "$600 USD",
    "address": "Palermo, CABA",
    "title": "Departamento 2 ambientes",
    "info": "Luminoso, balcón, cocina integrada...",
    "bedrooms": "2",
    "environments": "2",
    "scrapedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## Formato de notificaciones Telegram

**Resumen inicial:**
```
Se encontraron X nuevos alquileres:
```

**Por cada alquiler:**
- Imagen de la propiedad
- **Título del alquiler**
- Dirección
- **Precio**
- Información adicional (máx 250 caracteres)
- Botón "Ver Alquiler" con enlace

**Delays:** 4 segundos entre cada mensaje para no saturar la API

## Configuración

Edita `main.js` o `.env` para cambiar:

- `SCAN_INTERVAL`: Intervalo de escaneo en milisegundos (default: 600000 = 10 minutos)
- `BASE_URL`: URL base de Argenprop (default: https://www.argenprop.com)
- URL de búsqueda: Modifica `SCRAPE_URL` para cambiar los filtros

## Seleccionadores CSS utilizados

- `.listing__item` - Contenedor de cada alquiler
- `.card` - Link a la publicación
- `ul.card__photos li img` - Imagen principal
- `.card__price` - Precio
- `.card__address` - Dirección
- `.card__title` - Título
- `.card__info` - Información general
- `.basico1-icon-cantidad_dormitorios` - Cantidad de dormitorios (opcional)
- `.basico1-icon-cantidad_ambientes` - Cantidad de ambientes (opcional)
- `.pagination__page-next.pagination__page span[data-link-href]` - Link a siguiente página

## Solución de problemas

### Error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set"
- Verifica que el archivo `.env` existe y está correctamente configurado
- Reinicia el aplicación después de cambiar `.env`

### No se envían mensajes
- Confirma que el Token y Chat ID son correctos
- Verifica que el bot de Telegram está activo
- Asegúrate de tener conexión a internet

### El scraper no encuentra alquileres
- Revisa que la URL base sea correcta
- Verifica los selectores CSS si la página cambió
- Aumenta el timeout en `scraper.js` si es necesario

## Comandos útiles

```bash
# Instalar dependencias
npm install

# Ejecutar el scraper
npm start

# Modo desarrollo con auto-recarga
npm run dev

# Ver el archivo de datos guardados
cat data/listings.json

# Limpiar datos guardados (reinicious la búsqueda)
rm data/listings.json
```

## Notas

- Los datos se guardan automáticamente en `data/listings.json`
- El scraper detecta nuevos IDs automáticamente
- Los mensajes se envían con 4 segundos de separación
- El navegador se ejecuta en modo headless (sin UI)
- Presiona `Ctrl+C` para detener el scraper

## Dependencias

- **playwright**: Para web scraping
- **axios**: Para enviar solicitudes HTTP
- **dotenv**: Para gestionar variables de entorno
- **node-cron**: Para programación de tareas

## Licencia

MIT
