# PRODUCT_CONTEXT.md

# Sonilab — contexto de producto

## Qué es Sonilab

Sonilab es una aplicación web grande y modular orientada al trabajo real de producción con media, transcripción, subtítulos, guion y revisión. No debe entenderse como una herramienta pequeña, aislada o únicamente centrada en subtítulos.

La app combina una biblioteca de trabajo con flujos de edición y control sobre vídeo, audio, subtítulos, timeline, waveform, guion, traducción, revisión y proyectos. Su objetivo es permitir trabajo operativo sobre materiales audiovisuales y textuales sin perder coherencia funcional entre módulos.

---

## Qué problema resuelve

Sonilab intenta resolver un problema de trabajo real: gestionar y reutilizar media canónica, producir y revisar subtítulos/transcripciones, trabajar con guiones, coordinar proyectos y mantener materiales organizados sin romper la relación entre los distintos tipos de elemento.

El producto necesita distinguir claramente entre:

- **media audiovisual real** que debe tratarse como asset canónico
- **documentos de trabajo** que sí deben comportarse como ficheros clásicos
- **referencias** que permiten usar media desde espacios de trabajo sin duplicar binario
- **proyectos** que agrupan materiales y estado de producción

---

## Usuarios y uso esperado

El usuario típico no interactúa con piezas aisladas, sino con conjuntos de materiales relacionados:

- vídeo o audio original
- subtítulos / transcripción
- guion
- documentos auxiliares
- estructura de carpetas
- referencias a media
- un proyecto de trabajo con estado propio

Por eso cualquier cambio debe proteger continuidad entre biblioteca, editores, subtítulos, media, proyectos y flujos de producción.

---

## Módulos principales del producto

## 1. Biblioteca

La biblioteca es la superficie donde conviven organización, acceso y operaciones de trabajo.

No es un único modelo homogéneo. Funcionalmente contiene varios dominios distintos:

- **Media**
- **Files** (antes "Arxius")
- **LNK**
- **Projectes**

### Media
Repositorio canónico de vídeo/audio.

### Files (antes "Arxius")
Sistema clásico de trabajo para documentos como `txt`, `srt`, `pdf`, `docx` y similares.

### LNK
Referencia desde Files hacia un asset real de Media, sin duplicar binario.

### Projectes
Capa especial que agrupa carpeta, media, srt, guion y estado de trabajo.

---

## 2. Media audiovisual

La media no debe tratarse como un fichero clásico más. El producto ya ha fijado esta separación funcional:

- un asset audiovisual real pertenece a **Media**
- no debe duplicarse con semántica de “copiar archivo”
- puede reutilizarse desde otras zonas
- puede referenciarse mediante LNK
- su identidad depende del asset, no de la carpeta visual donde se vea

La subida, deduplicación, streaming y waveform están ligadas a esta lógica.

---

## 3. Subtítulos y transcripción

Sonilab trabaja con subtítulos y transcripciones como materiales de trabajo reales.

A día de hoy el núcleo operativo gira especialmente en torno a:
- `srt`
- texto plano (`txt`) para guiones u otras representaciones textuales

Los subtítulos/transcripciones no deben mezclarse con el modelo de Media. Son documentos de trabajo, no assets audiovisuales canónicos.

---

## 4. Guion

El guion es otro material de trabajo importante del producto.

Puede provenir de formatos documentales como:
- `pdf`
- `docx`

pero el sistema los convierte a una representación textual útil para la app. Por eso el comportamiento documental de estos formatos debe protegerse y no confundirse con media audiovisual.

---

## 5. Timeline y waveform

Timeline y waveform son superficies sensibles del producto porque dependen de que la relación entre media, subtítulos y edición se mantenga coherente.

No deben tocarse como efecto lateral de cambios en biblioteca, salvo encargo explícito. Cualquier intervención aquí debe tratarse como cambio delicado.

---

## 6. Traducción y revisión

Traducción y revisión forman parte del producto como módulos propios, no como extras cosméticos.

Pueden depender de:
- textos normalizados
- subtítulos
- guiones
- estados de proyecto
- sincronización entre biblioteca y editor

No deben verse afectados por cambios locales en biblioteca salvo que exista una dependencia real y demostrada.

---

## 7. Proyectos

Projectes es una capa funcional propia del producto.

No es simplemente “otra carpeta”. Un proyecto relaciona materiales y estado:

- carpeta de trabajo
- media vinculada
- srt vinculado
- guion opcional
- estado de procesamiento / preparación / revisión

Cualquier cambio en biblioteca debe proteger explícitamente la lógica ya existente de proyectos.

---

## Principios de producto que no deben romperse

1. **La app no es solo de subtítulos.**
2. **Media y Arxius no son lo mismo.**
3. **LNK es el puente correcto entre ambos.**
4. **Projectes se conserva como capa propia.**
5. **Los módulos sensibles no deben tocarse por arrastre.**
6. **La coherencia entre vistas importa más que el arreglo local rápido.**
7. **No todo lo que comparte árbol o UI comparte semántica funcional.**

---

## Regla práctica para futuras IAs

Cuando analices o cambies esta app:

- no presupongas que el dominio principal es solo subtítulos
- no presupongas que biblioteca = sistema de archivos clásico puro
- no conviertas media en fichero clásico por conveniencia
- no simplifiques Projectes
- no rompas la relación entre media, srt, guion y proyecto
- no mezcles flujos documentales con flujos de asset audiovisual
- protege continuidad entre biblioteca, editor, timeline, waveform, guion, traducción y revisión

---

## Qué se considera un cambio prudente

Un cambio prudente en Sonilab es aquel que:

- delimita bien el alcance
- distingue qué se quiere tocar y qué no
- minimiza regresiones
- protege módulos no relacionados
- evita refactors grandes si no son imprescindibles
- respeta la semántica funcional real de cada dominio

Este documento existe para dar contexto de producto y evitar que una IA trate Sonilab como un proyecto pequeño o monolítico de “archivos y subtítulos”.
