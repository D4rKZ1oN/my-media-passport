# My Media Passport — Vercel Edition


## V4 — Top 5 y UI móvil

Esta versión corrige el layout del Top 5, los títulos largos de “Viendo ahora”, usa DK08 como perfil por defecto y agrega administración/reordenamiento persistente del Top 5 mediante `FavoriteRank`.

Versión Next.js/TypeScript de My Media Passport. La app se publica en Vercel y lee/escribe directamente tu Google Sheet usando una cuenta de servicio. AniList y TMDb se consultan solo desde el servidor.

## Requisitos

- Google Sheets API habilitada.
- Una cuenta de servicio con una clave JSON.
- Tu Google Sheet compartido con el `client_email` de esa cuenta de servicio como **Editor**.
- API key de TMDb.

## Variables de entorno en Vercel

Añade estas 5:

- `GOOGLE_SHEET_ID`: ID de tu Google Sheet (entre `/d/` y `/edit` en la URL).
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: valor `client_email` del JSON de Google Cloud.
- `GOOGLE_PRIVATE_KEY`: valor completo `private_key` del JSON. Puedes pegarlo con los saltos de línea o con `\n`.
- `TMDB_API_KEY`: tu API key de TMDb.
- `NEXT_PUBLIC_APP_NAME`: `My Media Passport`.

Nunca subas el JSON de Google Cloud ni las claves a GitHub.

## Estructura esperada del Sheet

Se reutilizan las pestañas actuales `Media` y `Profile`.

La app reconoce tus columnas existentes: `ID`, `Title`, `Type`, `Status`, `Progress`, `Total`, `Score`, `Year`, `PosterURL`, `BackdropURL`, `Overview`, `Source`, `ExternalID`, `AniListID`, `TMDbID`, `MALID`, `StartDate`, `FinishDate`, `Notes`, `Favorite`, `CreatedAt`, `UpdatedAt`.

Si faltan `TrackUpdates` y `TrackPlanNews`, la app las agrega automáticamente al final de la cabecera de `Media`.

## Deploy

1. Descomprime el ZIP.
2. Sube **el contenido** de la carpeta a la raíz de tu repositorio `my-media-passport`.
3. En GitHub debes ver `package.json`, `app`, `components`, `lib`, `public` en la raíz.
4. En Vercel importa ese repositorio.
5. Vercel debe detectar `Next.js`.
6. Añade las 5 variables de entorno.
7. Deploy.

## Incluye

- Home: estadísticas, 5 favoritos, recientes, viendo ahora.
- Mi lista: filtros instantáneos, progreso +/−, editar, score, favoritos, eliminar.
- Búsqueda: AniList + TMDb, filtro por tipo y detección de títulos ya guardados.
- Descubrimiento: anime en tendencia y películas/series recientes.
- Novedades: seguimiento de anime/series seleccionadas con 🔔.
- PWA con iconos para iPhone.
- Animaciones CSS, skeleton loaders, optimistic UI y diseño responsive.
