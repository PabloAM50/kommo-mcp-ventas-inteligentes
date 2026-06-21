---
name: reporteFernando
description: Genera el reporte semanal HTML de Molina Casasola Cirujanos con datos reales de Kommo CRM. Llama a las APIs, calcula métricas, construye el HTML con el diseño de marca y lo guarda con numeración incremental.
---

# Reporte Semanal — Molina Casasola Cirujanos

Genera automáticamente el reporte semanal HTML a partir de datos reales de Kommo CRM.

## 0. Determinar fechas y número de reporte

1. Calcular el lunes y domingo de la semana actual (o semana anterior si es lunes antes de las 10h).
2. Listar archivos `reporte_semanal_NN.html` en el directorio del proyecto para determinar el último número. El siguiente será NN+1 (con cero a la izquierda, e.g., `02`, `03`...).
3. Formatear las fechas en español: "14 – 21 de Junio 2026".

## 1. Llamadas a Kommo (en paralelo por bloques)

Cuenta Kommo: `molinacasasolacirujanos`

### Bloque A — pipeline y estado actual (en paralelo)
- `get_pipelines` — lista etapas
- `get_leads` (limit: 250) — total leads activos
- `get_tasks` (is_completed: false) — tareas pendientes
- `get_unread_talks` — conversaciones sin leer
- `get_contacts` (limit: 250) — total contactos

### Bloque B — datos de la semana (en paralelo)
- `get_events` (created_at_from: inicio_semana, created_at_to: fin_semana, limit: 100) — actividad general
- `get_events` (mismas fechas, types: ["lead_status_changed"], limit: 100) — movimientos de pipeline
- `get_pipeline_leads_summary` (pipeline_id: 13401443) — Leads Orgánicos
- `get_pipeline_leads_summary` (pipeline_id: 13858912) — Leads Meta Ads

### Bloque C — conversaciones (en paralelo)
- `get_talks` (status: "closed", limit: 250) — conversaciones cerradas
- `get_talks` (status: "in_work", limit: 250) — conversaciones activas

## 2. Calcular métricas de la semana

Con los eventos `lead_status_changed` del bloque B, contar cuántos leads se movieron a cada etapa:

**Pipeline Meta Ads (13858912):**
- Citas Agendadas: value_after.id = `106941444`
- WhatsApps Enviados: value_after.id = `107341936`
- Citas Confirmadas: value_after.id = `106941448`
- No Interesados: value_after.id = `106938676`
- Conversiones (Ganado): value_after.id = `142`

**Pipeline Orgánico (13401443):**
- Citas Agendadas: value_after.id = `103371835`
- Citas Confirmadas: value_after.id = `103371847`
- Conversiones (Ganado): value_after.id = `142`

**Otras métricas:**
- Total leads activos: campo `total` de `get_leads`
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
2. **KPI Grid** (6 cards) — leads activos, citas agendadas, conversaciones gestionadas, contactos totales, conversiones, nuevas semana
3. **Embudo de ventas** (2 col) — barras de pipeline Meta Ads + tratamientos más demandados
4. **Conversaciones** (4 col) — cerradas, en activo, sin leer, tendencia
5. **Movimientos de pipeline** (5 col) — citas agendadas, WhatsApps, leads cualificados, cita confirmada, conversiones
6. **Actividad + Datos destacados** (2 col) — timeline de eventos + highlights positivos
7. **Resumen ejecutivo** — panel `#1E1A17` con narrativa positiva de la semana + tabla stats en dorado
8. **Footer** — ver código exacto más abajo

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
- Las 3-4 métricas principales del resumen (leads, citas, conversaciones, conversiones)
