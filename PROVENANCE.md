# Procedencia de los datos

Documento generado por un script del proyecto (privado) el 2026-10-28 03:26 UTC. Sirve para demostrar qué se recolectó, cuándo, y que el archivo privado existía con este contenido.

## Recolección

- Evento: Steam Next Fest, octubre de 2026 (19 a 26 de octubre).
- Ejecución de la recolección: `{"id": 1, "started_at": "2026-10-25T01:00:06Z", "collector_version": "0.1.0", "status": "completed"}`
- Juegos descubiertos: 7322. Declaran IA: 2515. No declaran: 4580. Estado desconocido (página no comprobable): 227.
- Metadatos publicados en el dataset: `{"event": "Steam Next Fest — October 2026 (Oct 19–26)", "run_id": 1, "collected": "2026-10-25T01:00:06Z", "steam_reported": 7316, "discovered": 7322, "language": "english", "country": "US", "generated": "2026-10-26"}`

## Archivos públicos (verificables)

```
5851625152ea9ac7960c11c5a3c193edba334f6df94c58b3a7f641138bf1681f  docs/data/games.json
```

Comprobar: `sha256sum -c MANIFEST.sha256`

## Archivo privado (no publicado)

La base SQLite y el HTML crudo archivado no están en el repositorio. Se publican solo sus huellas:

| Elemento | SHA-256 |
|---|---|
| `data/nextfest.sqlite` (base completa, incluye anotaciones y procedencia) | `7a1f1cd5ae4fc1edfb3dfbbd828103b3dd96b73e5b09312c0c25580883959bbb` |
| Huella combinada de las 7322 páginas archivadas (sha256 de las líneas `appid:sha256` ordenadas) | `9abf9b76221336e030cf62a8b3d6ed2f075637d31194c29caf09eddbdafd3a5a` |

La fecha de estas huellas la fija el commit que las contiene en el historial de este repositorio.
