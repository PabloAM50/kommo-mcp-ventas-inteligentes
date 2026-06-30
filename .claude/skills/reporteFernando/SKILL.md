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

## 0. Determinar fechas y número de reporte

1. Calcular el lunes y domingo de la semana actual (o semana anterior si es lunes antes de las 10h).
2. Listar archivos `reporte_semanal_NN.html` en el directorio del proyecto para determinar el último número. El siguiente será NN+1 (con cero a la izquierda, e.g., `02`, `03`...).
3. Formatear las fechas en español: "14 – 21 de Junio 2026".

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

El nombre incluye el rango de fechas de la semana:

```
reporte_semanal_DD_DD_mes_AA.html
```

Ejemplos:
- `reporte_semanal_14_21_junio_26.html`
- `reporte_semanal_22_28_junio_26.html`
- `reporte_semanal_01_07_julio_26.html`

Reglas:
- DD = día sin cero inicial (14, 7, 1...)
- mes = nombre del mes en español en minúsculas (enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre)
- AA = últimos 2 dígitos del año (26, 27...)

También sobrescribir `reporte_semanal.html` como template base actualizado.

## 5. Confirmar al usuario

Indicar:
- Nombre del archivo guardado (`reporte_semanal_NN.html`)
- Rango de fechas del reporte
- Las 3-4 métricas principales del resumen (leads Meta Ads, citas agendadas, contrataciones, conversaciones)
- El tratamiento más demandado (con dato real de tags)
