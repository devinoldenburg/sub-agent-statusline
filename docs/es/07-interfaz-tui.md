# Interfaz TUI

La interfaz principal del plugin es una sección en la sidebar de OpenCode. Su objetivo es mostrar actividad de subagentes sin obligarte a salir del flujo de trabajo actual.

## Superficies visuales

El plugin registra varias superficies TUI:

| Superficie        | Uso                                        |
| ----------------- | ------------------------------------------ |
| `sidebar_content` | Lista principal de subagentes y resumen.   |
| `home_prompt`     | Wrapper del prompt para conservar foco.    |
| `session_prompt`  | Wrapper del prompt dentro de sesiones.     |

La parte visible para usuarios está principalmente en `sidebar_content`.

## Sidebar de subagentes

La sidebar muestra una lista compacta de work items relacionados con subagentes y una línea de resumen agregado:

```txt
> 1 | + 0 | ! 0 | # 2
```

Puede incluir:

- título humano de la tarea;
- estado;
- duración;
- tokens/contexto si están disponibles;
- indicador de sesión navegable;
- agrupación por sesión actual u otras sesiones.

Ejemplo conceptual:

```txt
Subagentes

RUN Review current diff        00:42
OK Run focused tests          01:10 | 1.5k ctx 12%
ERR Typecheck                  00:08
```

## Sesión actual y otras sesiones

La sidebar intenta priorizar subagentes relacionados con la sesión actual de OpenCode.

Si no hay subagentes de la sesión actual, o si hay actividad relevante fuera de ella, puede mostrar una sección de “otras sesiones”.

Esto ayuda en dos casos:

1. cuando navegás entre sesiones;
2. cuando el plugin hidrata actividad previa o concurrente.

## Estados visuales

| Estado interno | Significado para la UI                                            |
| -------------- | ----------------------------------------------------------------- |
| `running`      | Trabajo activo o pendiente. Se lleva arriba de la lista.          |
| `done`         | Trabajo terminado. Se lista debajo de las filas en ejecución.     |
| `error`        | Trabajo fallido. Se lista debajo de las filas en ejecución.       |

Todos los subagentes de la sesión siguen listados: el trabajo en ejecución queda fijado arriba (los más nuevos primero) y el trabajo terminado debajo. Las filas terminadas solo se quitan por el pruning del estado, no por el render.

## Foco de la lista

La sidebar tiene un modo de foco para navegación con teclado.

El atajo principal es:

```txt
Alt+B
```

Ese atajo alterna entre:

- foco en la lista de subagentes;
- foco de vuelta en el prompt.

Cuando la lista está enfocada, los atajos de navegación se aplican a la lista. Cuando no está enfocada, el prompt mantiene el control normal.

## Atajos de teclado

| Atajo        | Acción                                       |
| ------------ | -------------------------------------------- |
| `Alt+B`      | Alterna foco entre lista y prompt.           |
| `j`          | Selecciona el siguiente subagente visible.   |
| `ArrowDown`  | Selecciona el siguiente subagente visible.   |
| `k`          | Selecciona el subagente anterior.            |
| `ArrowUp`    | Selecciona el subagente anterior.            |
| `Enter`      | Abre la sesión seleccionada si es navegable. |
| `h`          | Colapsa la sección.                          |
| `ArrowLeft`  | Colapsa la sección.                          |
| `l`          | Expande la sección.                          |
| `ArrowRight` | Expande la sección.                          |
| `Esc`        | Sale del modo foco y vuelve al prompt.       |

## Comandos registrados

El plugin registra comandos para la command palette de OpenCode.

| Comando                             | Acción                         |
| ----------------------------------- | ------------------------------ |
| `Subagents: Focus sidebar list`     | Enfoca la lista de subagentes. |
| `Subagents: Toggle sidebar section` | Activa o desactiva la sección. |

Internamente, el plugin registra ambas APIs cuando están disponibles:
`keymap.registerLayer` mantiene el atajo `Alt+B`, y `command.register` mantiene
los comandos visibles en la command palette de OpenCode. Si solo existe una API,
el plugin usa esa ruta sin fallar.

## Abrir una sesión hija

`Enter` o click pueden abrir una sesión hija cuando la fila tiene un `targetSessionID` navegable.

Condición típica:

```txt
targetSessionID = "ses_..."
```

Si el plugin solo conoce un wrapper técnico `tool:*` o un subtask sin sesión real, la fila puede no ser navegable.

Esto es intencional: navegar requiere una sesión real de OpenCode.

## Expansión, colapso y preferencias

La sección puede expandirse o colapsarse.

El plugin guarda preferencias en `api.kv` de OpenCode:

| Preferencia                  | Uso                                     |
| ---------------------------- | --------------------------------------- |
| `subagents.sidebar.expanded` | Recuerda si la sección está expandida.  |
| `subagents.sidebar.enabled`  | Recuerda si la sección está habilitada. |

Estas preferencias pertenecen al entorno TUI de OpenCode, no al archivo `state.json` del runtime plugin.

## Scroll y selección

La lista mantiene selección y scroll para que navegar no sea incómodo cuando hay varios subagentes visibles.

Comportamiento esperado:

- la selección se mueve dentro de filas visibles;
- si una fila desaparece por deduplicación o filtro, la selección se ajusta;
- el scroll intenta conservar contexto;
- `Esc` devuelve el control al prompt.

## Relación con deduplicación

La sidebar consume filas ya procesadas por la lógica de render/dedupe.

Eso evita mostrar wrappers técnicos como subagentes independientes cuando hay evidencia de que corresponden al mismo trabajo.

Ejemplo:

```txt
Estado interno:
- tool:prt_task
- subtask:prt_1
- ses_child

Sidebar:
- Review current diff
```

La UI busca responder “qué trabajo delegado está pasando”, no “cuántas señales técnicas llegaron”.

## Información de tokens/contexto

Cuando hay datos, la fila puede mostrar uso de contexto en forma compacta.

Ejemplos:

```txt
1.5k ctx 12%
12.3% used
```

Si no hay datos, no se muestra nada extra. Eso no significa que el subagente no haya usado tokens; solo significa que OpenCode o las fuentes consultadas no expusieron esa información de forma disponible para el plugin.

## Hydration en la TUI

Cuando cambiás de sesión, la TUI intenta reconstruir subagentes previos consultando APIs de OpenCode.

Esto hace que la sidebar pueda mostrar actividad que ocurrió antes de que el plugin recibiera eventos live en la sesión actual.

El flujo es:

```txt
route/session change
  ↓
consultar children/messages/status
  ↓
crear eventos sintéticos internos
  ↓
aplicar pipeline normal
  ↓
actualizar sidebar
```

## Mantenimiento periódico

La TUI corre tareas periódicas:

- refrescar duración visible;
- intentar hidratar tokens/contexto;
- persistir snapshots auxiliares;
- reconciliar subagentes viejos que quedaron `running`.

La reconciliación es conservadora. No cierra filas viejas solo porque pasó tiempo; primero busca evidencia.

## Límites actuales

La documentación y los tests cubren bien la lógica que alimenta la UI, pero hay un límite importante:

> No hay automatización E2E profunda de la UI visual completa dentro del host OpenCode/OpenTUI.

Lo que sí está cubierto automáticamente:

- registro de comandos;
- fallback de comandos legacy;
- keybinding `Alt+B`;
- lógica de estado/render/reconcile que alimenta la UI.

Para cambios visuales o de interacción completa, se recomienda hacer smoke test manual en OpenCode.

## Smoke test manual sugerido

Para validar la TUI después de cambios:

1. Ejecutar build local:

   ```sh
   pnpm build
   ```

2. Configurar OpenCode con ruta absoluta a `dist/tui.js`.
3. Reiniciar OpenCode.
4. Ejecutar una delegación/subagente.
5. Verificar que aparece en la sidebar.
6. Probar `Alt+B`.
7. Probar `j/k`, flechas y `Esc`.
8. Si hay sesión navegable, probar `Enter`.
9. Confirmar que las completions aparecen debajo del trabajo en ejecución sin causar saltos de scroll.

## Archivos relacionados

| Archivo               | Qué mirar                                     |
| --------------------- | --------------------------------------------- |
| `src/tui.tsx`         | UI, slots, hydration, reconcile y navegación. |
| `src/tui-commands.ts` | Comandos y keybindings.                       |
| `src/render.ts`       | Filas visibles y deduplicación previa a UI.   |
| `src/tui.test.ts`     | Tests de registro de comandos.                |
| `README.md`           | Tabla de shortcuts para usuarios.             |
