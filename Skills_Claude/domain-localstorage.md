# Domini: Persistència local (localStorage)

## Arxius involucrats

| Arxiu | Rol |
|-------|-----|
| `frontend/constants.ts` | Defineix `LOCAL_STORAGE_KEYS` — font de veritat de totes les claus |
| `frontend/hooks/useLocalStorage.ts` | Hook reactiu per llegir/escriure localStorage amb tipatge |
| Qualsevol component o context que usi `useLocalStorage` | Consumidor de les claus |

## Claus registrades

| Clau constant | Valor string | Descripció |
|--------------|-------------|------------|
| `SHORTCUTS` | `snlbpro_shortcuts` | Dreceres de teclat personalitzades |
| `EDITOR_STYLES` | `snlbpro_editor_styles` | **@deprecated** — migrat a `snlbpro_user_styles_<userId>` |
| `LIBRARY_WIDTH` | `snlbpro_library_width` | Amplada del panell de biblioteca (px) |
| `LIBRARY_NAME_COL_WIDTH` | `snlbpro_library_name_col_width` | Amplada columna Nom a la taula de Files (px) |
| `LIBRARY_FORMAT_COL_WIDTH` | `snlbpro_library_format_col_width` | Amplada columna Format (px) |
| `LIBRARY_DATE_COL_WIDTH` | `snlbpro_library_date_col_width` | Amplada columna Data i hora (px) |
| `TAKE_MARGIN` | `snlbpro_take_margin` | Marge de take (ms) |
| `TAKE_START_MARGIN` | `snlbpro_take_start_margin` | Marge d'inici de take (ms) |
| `MAX_LINES_SUBS` | `snlbpro_max_lines_subs` | Màxim de línies per subtítol |
| `SUB_GRID_OPACITY` | `snlbpro_sub_grid_opacity` | Opacitat de la graella de subtítols |
| `WAVEFORM_HOLD_MS` | `snlbpro_waveform_hold_ms` | Temps de retenció del waveform (ms) |
| `AUTOSAVE_SRT` | `snlbpro_autosave_srt` | Autoguardat SRT activat/desactivat |
| `TASKS_TRANSLATION` | `snlbpro_tasks_translation` | Tasques de traducció |
| `TASKS_TRANSCRIPTION` | `snlbpro_tasks_transcription` | Tasques de transcripció |
| `SRT_EDITOR_MODE` | `snlbpro_srt_editor_mode` | Mode d'editor per als SRT |
| `EDITOR_MIN_GAP_MS` | `snlbpro_editor_min_gap_ms` | Marge mínim entre subtítols (ms) |
| `THEME` | `snlbpro_theme` | Tema de color de la interfície |
| `CUSTOM_THEME_TOKENS` | `snlbpro_custom_theme_tokens` | Tokens del tema personalitzat (fallback local) |
| `TASKS_IA_HIDDEN_IDS` | `snlbpro_tasks_ia_hidden_ids` | IDs de tasques IA ocultes de l'historial |
| `PUJADES_HISTORY` | `snlbpro_pujades_history` | Historial de subides (Pujades) |
| `ACTIVE_PAGE` | `snlbpro_active_page` | Pestanya activa de la biblioteca (`library` / `media` / `projects`) |
| `ACTIVE_VIEW` | `snlbpro_active_view` | Vista activa de la biblioteca (`library` / `trash`). Gestionada des de `LibraryDataContext.tsx` via constant local `ACTIVE_VIEW_KEY` |
| `ACTIVE_FOLDER` | `snlbpro_active_folder` | Carpeta activa (ID). No s'escriu quan `view === 'trash'`. Gestionada des de `LibraryDataContext.tsx` via constant local `ACTIVE_FOLDER_KEY` |

## Regles

### Quan s'afegeix una clau nova
1. Definir la constant a `LOCAL_STORAGE_KEYS` en `constants.ts` amb el prefix `snlbpro_`.
2. Afegir una entrada a la taula "Claus registrades" d'aquest arxiu.
3. Usar sempre `useLocalStorage(LOCAL_STORAGE_KEYS.NOM_CLAU, defaultValue)` — mai strings literals.

### Quan s'elimina o es depreca una clau
1. Marcar-la com `@deprecated` amb comentari explicatiu a `constants.ts`.
2. **No eliminar-la immediatament** — mantenir-la per llegir-la en la primera arrencada i migrar si cal.
3. Actualitzar la taula d'aquest arxiu.

### Quan es renombra una clau
- Aplicar el mateix procés que deprecar + afegir nova. No canviar el valor string d'una clau existent si hi ha dades reals d'usuaris.

## Relacions indirectes

- `useLocalStorage` és un hook compartit — no modificar el seu comportament sense revisar tots els consumidors.
- Les claus d'amplades de columna (`LIBRARY_*_COL_WIDTH`) estan lligades a `SonilabLibraryView.tsx`.
- `ACTIVE_PAGE` és llegida per `App.tsx` i controlada via la prop `onChangePage` de `LibraryView`.
