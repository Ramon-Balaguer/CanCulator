# Documentación de CanCulator

Índice de las features de la app y de las decisiones de arquitectura (ADR). La guía de uso está en el [README](../README.md); las pruebas manuales en móvil, en [mobile-checklist.md](mobile-checklist.md).

## Features

1. [Stock](features/01-stock.md)
2. [Caducidad](features/02-caducidad.md)
3. [A reponer](features/03-a-reponer.md)
4. [Imprimir](features/04-imprimir.md)
5. [Estadísticas](features/05-estadisticas.md)
6. [Alta de lotes y escáner](features/06-alta-de-lotes-y-escaner.md)
7. [Open Food Facts](features/07-open-food-facts.md)
8. [Fotos](features/08-fotos.md)
9. [Ajustes: categorías y ubicaciones](features/09-ajustes-categorias-y-ubicaciones.md)
10. [Sincronización entre móviles](features/10-sincronizacion-entre-moviles.md)
11. [Copia de seguridad y reset](features/11-copia-de-seguridad-y-reset.md)
12. [Idioma](features/12-idioma.md)
13. [App instalable y sin conexión](features/13-pwa-sin-conexion.md)
14. [Peso, volumen y precio del producto](features/14-peso-volumen-y-precio.md)

## Decisiones de arquitectura (ADR)

Las decisiones se reconstruyeron del historial de commits, de `CLAUDE.md` y del código en octubre de 2026, porque el proyecto no tenía registro de ADR antes. Cada una indica su fecha de estado y, cuando aplica, qué commit la introdujo.

| ADR | Decisión | Estado |
| :--- | :--- | :--- |
| [0001](adr/0001-app-web-estatica-sin-paso-de-compilacion.md) | App web estática, sin paso de compilación | Aceptada |
| [0002](adr/0002-datos-en-indexeddb-del-movil.md) | Datos en IndexedDB, en el propio móvil | Aceptada |
| [0003](adr/0003-datos-personales-fuera-del-repositorio.md) | Datos personales fuera del repositorio | Aceptada |
| [0004](adr/0004-sincronizacion-p2p-webrtc.md) | Sincronización directa entre móviles por WebRTC (PeerJS) | Aceptada |
| [0005](adr/0005-sin-servidor-ni-hoja-de-calculo.md) | Sin Apps Script ni hoja de cálculo como servidor | Aceptada |
| [0006](adr/0006-conflictos-gana-el-cambio-mas-reciente.md) | Conflictos: gana el cambio más reciente | Aceptada |
| [0007](adr/0007-service-worker-red-primero.md) | Service worker con red primero y caché de respaldo | Aceptada |
| [0008](adr/0008-open-food-facts-con-cache-local.md) | Open Food Facts con caché local y tolerancia a fallos | Aceptada |
| [0009](adr/0009-idioma-por-movil-en-localstorage.md) | Idioma por móvil, guardado en localStorage | Aceptada |
| [0010](adr/0010-tdd-y-una-rama-por-cambio.md) | TDD y una rama por cambio | Aceptada |
| [0011](adr/0011-despliegue-github-pages-con-ci.md) | Despliegue en GitHub Pages desde CI | Aceptada |
| [0012](adr/0012-reset-con-confirmacion-por-suma.md) | Reset con copia previa y confirmación por suma | Aceptada |
| [0013](adr/0013-fotos-comprimidas-en-el-navegador.md) | Fotos comprimidas en el navegador | Aceptada |
| [0014](adr/0014-volumen-en-ml-para-bebidas-y-salsas.md) | Volumen en ml para bebidas, tomate, salsas y aceites | Aceptada |

Para añadir un ADR: el siguiente número, `NNNN-titulo-en-kebab.md`, con las secciones Estado, Contexto, Decisión y Consecuencias, y un enlace nuevo en esta tabla. `tests/unit/docs-features-adr.test.js` comprueba la estructura.
