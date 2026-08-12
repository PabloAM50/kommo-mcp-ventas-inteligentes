---
name: reporteFernando
description: Genera el reporte semanal HTML de Molina Casasola Cirujanos con datos reales de Kommo CRM. Llama a las APIs, calcula métricas, construye el HTML con el diseño de marca y lo guarda con numeración incremental.
---

# Reporte Semanal — Molina Casasola Cirujanos

Genera automáticamente el reporte semanal HTML a partir de datos reales de Kommo CRM.

## ⚙️ Contexto de negocio (LECTURA OBLIGATORIA antes de generar)

La clínica trabaja con **dos embudos** que NO son equivalentes:

| Embudo | ID | Rol | Cómo tratarlo en el reporte |
|---|---|---|---|
| **Leads de Meta Ads** | `13858912` | **Embudo comercial REAL.** Aquí entran los leads de los anuncios de Facebook/Instagram y se procesan de principio a fin: WhatsApp → cita → confirmación → asistencia → contratación. Es el embudo **protagonista** del reporte. | Sección central con embudo completo, progresión semanal y tratamientos reales. |
| **Leads orgánicos** | `13401443` | **Pool anecdótico.** Comentarios de redes sociales y otros canales. Los leads entran aquí pero apenas se procesan (suelen acumularse en "PRIMER CONTACTO" sin tags ni avance). | Métrica mínima: total de leads como "pool de entrada". **No construir embudo detallado.** |

**Hecho verificado en datos:** los leads **NO se mueven** de un embudo a otro. Cada lead entra directamente al embudo que le corresponde según su origen. Por tanto, el valor del reporte está en la **progresión dentro de Meta Ads**, no en traslados entre embudos.

**Tratamientos reales:** los leads de Meta Ads llevan **tags** con el tratamiento de interés (Blefaroplastia, SmartLipo, Rinoplastia, Armonización facial…). Estos tags se cuentan para la sección de tratamientos. **Importante:** excluir los tags que empiezan por `fb` (son IDs internos de campaña de Facebook, no tratamientos).

## 0. Determinar fechas y detectar semanas atrasadas

**Regla de oro — NUNCA generar una semana que no ha terminado.** La última semana reportable es la última semana ISO completa (lunes-domingo) cuyo `week_end` (domingo) ya pasó respecto a hoy — `week_end < hoy`, nunca `>=`. Si hoy es miércoles y la semana en curso es lunes-domingo, esa semana NO se reporta todavía; la última reportable es la anterior. **Este fue exactamente el bug del 12/08/2026**: se generó "10-16 agosto" en miércoles con datos de solo 3 días (lunes-miércoles) etiquetados como si fuera la semana completa — hubo que borrar el archivo, su entrada en `reporte_semanal_history.json` y restaurar `reporte_semanal.html` desde el último reporte completo válido. Antes de generar cualquier semana, comprobar `week_end < hoy`; si no se cumple, esa semana se salta.

1. Calcular la última semana ISO completa (lunes-domingo) según la regla de oro anterior.
2. Leer `reporte_semanal_history.json` (raíz del proyecto) y mirar el `week_end` de la última entrada. Ese es el último reporte real generado — **no asumas que es la semana pasada**, puede haber huecos si el cron falló o se saltó ejecuciones.
3. Semanas a generar = todas las semanas completas entre ese `week_end` (exclusive) y la última semana completa del paso 1 (inclusive), **en orden cronológico**. Cada semana atrasada es una llamada a `get_events` con su propio rango de fechas exacto (ver sección 2.1); eso da datos 100% reales para la progresión de esa semana. Las secciones de estado actual (embudo, tratamientos, conversaciones, contactos) se generan igual en todas las semanas de la tanda porque Kommo no guarda fotos históricas — ver aviso en la sección 2.5.
4. Formatear las fechas en español: "14 – 21 de Junio 2026" (mismo mes) o "27 de Julio – 2 de Agosto 2026" (cruza de mes).
5. **Cadencia recomendada (cron semanal cada lunes):** si el cron corre el lunes por la mañana, la semana anterior (lunes-domingo, recién terminada la noche del domingo) ya cumple la regla de oro y es exactamente la que toca generar — no la semana que acaba de empezar ese lunes.

## 1. Llamadas a Kommo (en paralelo por bloques)

Cuenta Kommo: `molinacasasolacirujanos` (subdominio) o `Molina Casasola Cirujanos` (nombre).

### Bloque A — pipeline y estado actual (en paralelo)
- `get_pipelines` — lista etapas (referencia de nombres e IDs)
- `get_leads` (limit: 250, pipeline_id: 13858912) — leads activos en Meta Ads **(incluye tags)**
- `get_tasks` (is_completed: false) — tareas pendientes
- `get_unread_talks` — conversaciones sin leer
- `get_contacts` (limit: 250) — total contactos

### Bloque B — actividad de la semana (en paralelo)
- `get_events` (created_at_from: inicio_semana, created_at_to: fin_semana, limit: 100) — actividad general
- `get_events` (mismas fechas, types: ["lead_status_changed"], limit: 250) — movimientos dentro de Meta Ads
- `get_pipeline_leads_summary` (pipeline_id: 13858912) — Leads Meta Ads (reparto actual por etapa)
- `get_pipeline_leads_summary` (pipeline_id: 13401443) — Leads orgánicos (solo para total anecdótico)

### Bloque C — conversaciones (en paralelo)
- `get_talks` (status: "closed", limit: 250) — conversaciones cerradas
- `get_talks` (status: "in_work", limit: 250) — conversaciones activas

## 2. Calcular métricas de la semana

### 2.1 Progresión dentro de Meta Ads (lo importante)

Con los eventos `lead_status_changed` del Bloque B, contar cuántos leads se movieron a cada etapa del embudo Meta Ads. **Usa estos IDs REALES** (pipeline 13858912):

| Etapa | status_id | type |
|---|---|---|
| Leads Entrantes | `106938664` | entrada (1) |
| NO CONTESTA | `106938672` | — |
| ENVIAMOS WHATSAPP | `107341936` | — |
| CITA AGENDADA | `106941444` | — |
| LLAMAR MÁS TARDE | `106938668` | — |
| NO INTERESADO | `106938676` | — |
| CITA CONFIRMADA | `106941448` | — |
| ASISTIÓ A LA CITA | `106941452` | — |
| CONTRATA TRATAMIENTO | `107070800` | — |
| Logrado con éxito (ganado) | `142` | éxito |
| Ventas Perdidos (perdido) | `143` | pérdida |

Para cada evento, mirar `value_after[].status_id` (es un array; tomar el primer elemento) y contar cuántos eventos llegaron a cada etapa. Si un status_id del evento no está en la tabla, buscar su nombre en `get_pipelines` y contarlo igualmente.

**Métricas clave de progresión (esta semana):**
- WhatsApps enviados → count value_after = `107341936`
- Citas agendadas → count value_after = `106941444`
- Citas confirmadas → count value_after = `106941448`
- Asistencias a cita → count value_after = `106941452`
- Contrataciones de tratamiento → count value_after = `107070800`
- Tratamientos logrados (ganados) → count value_after = `142`

### 2.2 Pipeline Orgánico (anecdótico)

Estados reales del pipeline 13401443 (referencia, **no construir embudo**):
- `103371815` Leads Entrantes · `106481839` PRIMER CONTACTO · `106938628` NO CONTESTA · `106938632` NO INTERESADO · `103371835` CITA AGENDADA · `103371847` Cita confirmada · `103371851` ASISTIO A LA CITA · `142` Cita completada–ganado · `143` Cita cancelada–perdido

Solo reportar: **total de leads orgánicos** (campo `total` del summary). No desglosar por etapa.

### 2.3 Tratamientos más demandados (datos reales)

A partir de los leads del Bloque A (Meta Ads con tags):
1. Recolectar todos los `tags[].name` de los leads activos de Meta Ads.
2. **Excluir** los tags que empiecen por `fb` (IDs de campaña de Facebook).
3. **Unificar mayúsculas/minúsculas:** tratar "rinoplastia" y "Rinoplastia" como el mismo tratamiento (normalizar a Title Case).
4. Contar frecuencia y ordenar descendente.
5. Calcular porcentaje sobre el total de tags de tratamiento válidos.

Si no hay tags de tratamiento válidos, **omitir la sección** de tratamientos en vez de inventar datos.

### 2.4 Otras métricas
- Total leads activos en Meta Ads: `total` de `get_leads(pipeline_id: 13858912)`
- Total leads orgánicos: `total` de `get_pipeline_leads_summary(13401443)`
- Total contactos: campo `total` de `get_contacts`
- Nuevas conversaciones: campo `total` de `get_unread_talks`
- Conversaciones cerradas: campo `total` de `get_talks(closed)`
- Conversaciones en activo: campo `total` de `get_talks(in_work)`
- Tareas pendientes: contar items de `get_tasks`

**Cuidado con "total":** varias tools (`get_leads`, `get_contacts`, `get_talks`) devuelven `total` = número de items en esa página, no necesariamente el total real de la cuenta si hay más de `limit` registros. Si el `total` devuelto es exactamente igual al `limit` pedido, probablemente hay más datos de los que se ven — pedir `page: 2` si hace falta el conteo real (p.ej. para `lead_added` de una semana con mucho volumen).

### 2.5 Limitación importante: snapshot vs. histórico

Solo `get_events` y `get_pipeline_movements` tienen fecha real (log de eventos) y se pueden pedir con precisión para **cualquier** rango pasado. El resto de tools (`get_pipeline_leads_summary`, `get_leads` con sus tags, `get_talks`, `get_contacts`, `get_unread_talks`) **no aceptan fecha** — devuelven el estado *actual* del CRM, sin importar qué semana se esté reportando. Kommo no guarda una "foto" histórica de cómo estaba el pipeline en una fecha pasada.

**Consecuencia práctica:**
- Si el reporte se genera **en su semana correspondiente** (cadencia semanal real vía cron), esto no es un problema: el "estado actual" capturado ese día sí es el estado real de esa semana.
- Si se generan **varias semanas atrasadas de golpe** (catch-up), las secciones de embudo comercial, tratamientos más demandados, conversaciones y contactos saldrán **idénticas** en todas las semanas de la tanda, porque todas leen el mismo "ahora". Solo la progresión semanal (2.1) y los nuevos leads (2.4) son exactos y distintos por semana, porque vienen del log de eventos.
- En catch-up, añadir una nota breve en la sección de progresión indicando que el embudo/tratamientos reflejan el estado actual del CRM, no una foto de esa semana (ver ejemplo en `reporte_semanal_27_julio_2_agosto_26.html`).

### 2.6 Leer la semana anterior antes de escribir el resumen ejecutivo

Antes de redactar el resumen ejecutivo y los "Datos destacados", leer `reporte_semanal_history.json` y coger la **última entrada** (la semana inmediatamente anterior a la que se está generando). Usarla para:
- Frasear la evolución real: "las citas acumuladas se mantienen en 110" o "el tratamiento más demandado sigue siendo SmartLipo (41%)" en vez de repetir números sueltos sin contexto.
- Detectar si algún número acumulado (leads activos, citas en pipeline, contrataciones) cambió respecto a la semana anterior — si cambió, es una señal real de movimiento en el CRM y vale la pena destacarlo; si no cambió, es la limitación de snapshot descrita en 2.5, no una semana "sin actividad" (evitar decir eso, para no chocar con el tono positivo).
- No hace falta parsear el HTML anterior (pesa mucho por el logo en base64) — todos los números clave ya están en `reporte_semanal_history.json`.

## 3. Construir el HTML

### Diseño de marca (obligatorio — no cambiar)

```css
--cream:      #FAF8F3   /* fondo página */
--cream-card: #F5EFE6   /* fondo cards */
--gold:       #C5963A   /* ÚNICO acento — no usar otro color */
--gold-fade:  #F9F2E5
--gold-light: #E2C07A
--charcoal:   #1E1A17   /* headings */
--warm-mid:   #5A5047   /* body text */
--warm-lt:    #8A7D72   /* labels */
--divider:    #E5DDD3
--white:      #FFFFFF
```

**NUNCA usar** teal, azul navy, rojo, ni naranja — no pertenecen a la marca.

Tipografía: Cormorant Garamond (headings) + Inter (datos) — importar de Google Fonts.

### Logo

Leer el archivo `Assets/logo-molina-casasola.png`, convertirlo a base64 y embeber como `<img src="data:image/png;base64,..." height="64">` para que el HTML sea autónomo y compartible por email.

```python
import base64
with open("Assets/logo-molina-casasola.png", "rb") as f:
    logo_b64 = base64.b64encode(f.read()).decode()
```

### Header — markup exacto (obligatorio desde 12/08/2026)

```html
<header>
  <div class="header-back"><a href="/reportes/Molinacasasola" class="back-link">&larr; Volver a reportes</a></div>
  <div class="header-inner">
    <div class="brand">
      <a href="/reportes/Molinacasasola"><img src="data:image/png;base64,[LOGO_B64]" alt="Molina Casasola"></a>
    </div>
    <div class="report-info">
      <div class="report-type">Reporte Semanal de CRM</div>
      <div class="report-title">Resumen de Actividad</div>
      <div class="report-date">[RANGO DE FECHAS]</div>
    </div>
  </div>
</header>
```

Y en el `<style>`, junto al resto de reglas de `.brand`:

```css
.header-back{max-width:1080px;margin:0 auto 14px;}
.back-link{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);text-decoration:none;font-weight:500;}
.back-link:hover{text-decoration:underline;}
.brand a{display:flex;align-items:center;text-decoration:none;}
```

**Reglas:**
- **NUNCA** añadir el nombre de la clínica en texto junto al logo (nada de `<div class="brand-name">Molina Casasola</div>` / `<div class="brand-sub">...</div>`). El logo PNG ya incluye el nombre — ponerlo también en texto duplica visualmente la marca. Bug real: hasta el 12/08/2026 los 7 reportes más recientes tenían esta duplicación y hubo que arreglarlos uno a uno.
- El logo y la flecha "Volver" deben enlazar siempre a `/reportes/Molinacasasola` (el listado de reportes del cliente).
- La forma más segura de no romper esto: copiar el bloque `<header>...</header>` completo y su CSS tal cual del último `reporte_semanal_*.html` generado, y cambiar únicamente `[LOGO_B64]` (si cambia el logo) y `[RANGO DE FECHAS]`. No reescribir el header desde cero.

### Estructura de secciones

1. **Header** — logo base64 + "Reporte Semanal" + rango de fechas
2. **KPI Grid** (6 cards) — leads activos Meta Ads, citas agendadas esta semana, conversaciones gestionadas, contactos totales, contrataciones de tratamiento, leads orgánicos (pool)
3. **Embudo comercial Meta Ads (protagonista)** — barras del pipeline Meta Ads con todas sus etapas reales y el conteo actual por etapa (de `get_pipeline_leads_summary`). Etiquetar esta sección como el embudo comercial.
4. **Tratamientos más demandados** — barras horizontales con los tratamientos REALES (de los tags, excluyendo `fb*`). Si no hay tags válidos, omitir.
5. **Progresión semanal dentro de Meta Ads** (la sección destacada) — panel con cuántos leads avanzaron a cada etapa clave esta semana: WhatsApps enviados, citas agendadas, confirmadas, asistencias, contrataciones, logrados. Usar los conteos del punto 2.1. Este es el "movimiento" del embudo comercial.
6. **Conversaciones** (4 col) — cerradas, en activo, sin leer, tendencia
7. **Actividad + Datos destacados** (2 col) — timeline de eventos + highlights positivos
8. **Resumen ejecutivo** — panel `#1E1A17` con narrativa positiva centrada en el avance comercial dentro de Meta Ads + tabla stats en dorado
9. **Footer** — ver código exacto más abajo

**Pool orgánico:** no darle sección propia de embudo. Aparece solo como un KPI ("Leads orgánicos: X") y, si se quiere, una nota breve en el resumen ejecutivo indicando que es el pool de comentarios de redes. No destacar su inactividad.

### Tono — solo positivo, informativo

- NO usar: urgente, bloqueado, sin respuesta, vencido, se recomienda, mejorar, activar, salesbot
- SÍ usar: "X citas agendadas esta semana", "Y conversaciones gestionadas", "Z nuevos contactos"
- Reencuadrar cualquier dato neutral en positivo
- No mencionar automatizaciones ni herramientas de CRM por nombre
- La sección de highlights se llama **"Datos destacados"**, nunca "Alertas"

### Footer exacto

```html
<div class="footer-brand">Molina Casasola · Cirugía &amp; Medicina Estética</div>
<div class="footer-note">Reporte generado el [FECHA_HOY] · Datos extraídos de Kommo CRM · <em>Realzamos tu belleza natural</em></div>
<div class="footer-note" style="margin-top:6px;color:var(--gold);letter-spacing:1px;">Generado por <strong style="color:var(--gold);">Miaia.ai</strong></div>
```

## 4. Guardar el archivo

El nombre incluye el rango de fechas de la semana. Hay **dos patrones**, según si la semana cae dentro de un solo mes o cruza de mes:

```
reporte_semanal_DD_DD_mes_AA.html                (misma mes)
reporte_semanal_DD_mes1_DD_mes2_AA.html          (cruza de mes)
```

Ejemplos:
- `reporte_semanal_14_21_junio_26.html`
- `reporte_semanal_3_9_agosto_26.html`
- `reporte_semanal_27_julio_2_agosto_26.html` (cruza julio→agosto)

Reglas:
- DD = día sin cero inicial (14, 7, 1...)
- mes = nombre del mes en español en minúsculas
- AA = últimos 2 dígitos del año (26, 27...)

**Importante — mantener sincronizado con el servidor:** `src/server.ts` sirve `/reportes/Molinacasasola` leyendo el directorio del proyecto y filtrando con dos regex (`SAME_MONTH_RE` y `CROSS_MONTH_RE`) que deben coincidir exactamente con estos dos patrones. Si algún día cambia la convención de nombres, hay que actualizar esos regex (y el parseo del `sortKey` que ordena los reportes cronológicamente) en `src/server.ts`, o el reporte nuevo no aparecerá en la web aunque el archivo exista. El `Dockerfile` copia `reporte_semanal*.html` en build time — el archivo nuevo solo llega a producción si se commitea, se pushea a `main` y Dokploy redeploya.

También sobrescribir `reporte_semanal.html` como template base actualizado (solo con el reporte de la semana MÁS RECIENTE de la tanda).

## 5. Actualizar el historial

Añadir una entrada al final de `reporte_semanal_history.json` (raíz del proyecto) con los números clave de la semana recién generada: `week_start`, `week_end`, `file`, `leads_meta_ads_activos`, `citas_acumuladas_pipeline`, `citas_nuevas_semana`, `whatsapps_semana`, `confirmadas_semana`, `asistencias_semana`, `contrataciones_semana`, `logrados_semana`, `nuevos_leads_semana`, `contrataciones_acumuladas`, `leads_organicos_pool`, `conversaciones_cerradas`, `conversaciones_activas`, `conversaciones_sin_leer`, `tratamiento_top`, `tratamiento_top_pct`, `generated_at`. Si el reporte se generó en catch-up o a mitad de semana, añadir un `note` explicándolo (ver entradas existentes como ejemplo). Este archivo es lo que la sección 2.6 usa la próxima vez para comparar contra la semana anterior — si no se actualiza, el siguiente reporte pierde el contexto de evolución.

## 6. Confirmar al usuario

Indicar:
- Nombre(s) del archivo(s) guardado(s)
- Rango de fechas de cada reporte
- Las 3-4 métricas principales del resumen (leads Meta Ads, citas agendadas, contrataciones, conversaciones)
- El tratamiento más demandado (con dato real de tags)
- Si el reporte quedó solo en local o se commiteó/pusheó (recordar que el sitio desplegado necesita push + redeploy en Dokploy para reflejar el archivo nuevo). **Desde 12/08/2026** el cliente está montando su propio agente programado (Claude Code) con el MCP de Kommo y el MCP de GitHub conectados, que invoca este skill cada lunes y se encarga él mismo del commit/push — si te invocan dentro de ese flujo automatizado, procede con el commit/push; si te invocan sueltos/manualmente (como en una sesión de chat normal), pregunta antes de pushear.

## 7. Recuperación — si se generó una semana incompleta por error

Si el skill (o alguien manualmente) generó un reporte que rompe la regla de oro de la sección 0 (semana con `week_end >= hoy`), no lo "arregles" rellenando los días que faltan — bórralo y espera a que la semana termine de verdad:

1. Borrar el archivo `reporte_semanal_DD_DD_mes_AA.html` incompleto.
2. Borrar su entrada correspondiente en `reporte_semanal_history.json`.
3. Restaurar `reporte_semanal.html` (la plantilla base) copiando el contenido del último reporte **completo** válido — normalmente el que quedó como penúltima entrada del history antes del borrado.
4. La semana volverá a generarse sola, completa, la próxima vez que le toque por calendario (ver sección 0.5).
