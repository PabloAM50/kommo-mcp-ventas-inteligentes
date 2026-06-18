# Kommo MCP Server — Ventas Inteligentes

MCP (Model Context Protocol) server para monitorear múltiples cuentas de **Kommo CRM** desde Claude Code, Claude Desktop, Cowork o cualquier cliente MCP.

Ideal para agencias, partners y consultores que manejan varias cuentas de clientes.

## Dos modos de uso

| Modo | Transporte | Comando | Para qué sirve |
|---|---|---|---|
| **Local** (stdio) | stdio | `npm start` | Claude Code, Claude Desktop |
| **Remoto** (HTTP) | Streamable HTTP | `npm run start:remote` | Cowork, clientes web, tareas programadas 24/7 |

## Funcionalidades

- **Multi-cuenta**: Monitorea 1, 10 o 100 cuentas desde un solo lugar
- **Leads**: Listar, buscar, crear y actualizar leads
- **Contactos**: Buscar, crear y actualizar contactos
- **Empresas**: Gestionar empresas/companies
- **Pipelines**: Ver embudos de venta y resumen por etapa
- **Tareas**: Ver pendientes, crear y completar tareas
- **Eventos**: Actividad reciente de cada cuenta
- **Conversaciones**: Ver chats activos, no leídos y por contacto
- **Salesbots**: Listar, lanzar y detener bots de ventas
- **Plantillas**: Crear, editar y eliminar plantillas de mensajes
- **Campos custom**: Ver campos personalizados, tags, fuentes y razones de pérdida
- **Dashboard**: Resumen rápido de todas las cuentas con un solo comando

## 40 herramientas disponibles

| Categoría | Herramientas |
|---|---|
| Cuentas | `list_accounts`, `get_account_info`, `multi_account_summary` |
| Leads | `get_leads`, `get_lead`, `create_lead`, `update_lead` |
| Contactos | `get_contacts`, `get_contact`, `create_contact`, `update_contact` |
| Empresas | `get_companies`, `get_company`, `create_company` |
| Pipelines | `get_pipelines`, `get_pipeline`, `get_pipeline_leads_summary` |
| Tareas | `get_tasks`, `get_task`, `create_task`, `update_task` |
| Eventos | `get_events`, `get_users` |
| Conversaciones | `get_talks`, `get_talk_by_contact`, `get_unread_talks` |
| Salesbots | `get_salesbots`, `get_salesbot`, `launch_salesbot`, `stop_salesbot` |
| Plantillas | `get_templates`, `get_template`, `create_templates`, `update_templates`, `delete_template` |
| Campos/Config | `get_custom_fields`, `get_sources`, `get_tags`, `get_loss_reasons`, `get_webhooks` |

---

## Opción A: Instalación local (Claude Code / Claude Desktop)

### 1. Clonar el repositorio

```bash
git clone https://github.com/feniaxcrm-cloud/kommo-mcp-ventas-inteligentes.git
cd kommo-mcp-ventas-inteligentes
```

### 2. Instalar dependencias y compilar

```bash
npm install
npm run build
```

### 3. Configurar tus cuentas

Copia el archivo de ejemplo y edítalo con tus datos:

```bash
cp accounts.example.json accounts.json
```

Edita `accounts.json` con los datos de cada cuenta:

```json
[
  {
    "name": "Mi Empresa",
    "subdomain": "miempresa",
    "token": "eyJ0eXAiOiJKV1QiLCJhbGci..."
  },
  {
    "name": "Cliente ABC",
    "subdomain": "clienteabc",
    "token": "eyJ0eXAiOiJKV1QiLCJhbGci..."
  }
]
```

### 4. Obtener el token de cada cuenta

Para cada cuenta de Kommo:

1. Inicia sesión en `https://TU-SUBDOMINIO.kommo.com`
2. Ve a **Configuración** (ruedita) > **Integraciones**
3. Click en **+ Crear integración** > **Integración privada**
4. Nombre: `MCP Monitor` (o el que quieras)
5. Activa todos los permisos que necesites
6. Guarda la integración
7. Ve a la pestaña **Keys and scopes**
8. Click en **Generar token de larga duración**
9. Selecciona **5 años** como expiración
10. **COPIA EL TOKEN INMEDIATAMENTE** (no se puede ver después)

Repite para cada cuenta que quieras monitorear.

### 5. Conectar a Claude Code

Agrega esto en `~/.claude/.mcp.json` (o en el `.mcp.json` de tu proyecto):

**Windows:**
```json
{
  "mcpServers": {
    "kommo": {
      "command": "node",
      "args": ["C:\\ruta\\a\\kommo-mcp\\dist\\index.js"]
    }
  }
}
```

**Mac/Linux:**
```json
{
  "mcpServers": {
    "kommo": {
      "command": "node",
      "args": ["/ruta/a/kommo-mcp/dist/index.js"]
    }
  }
}
```

### 6. Reiniciar Claude Code y probar

Algunos ejemplos de lo que puedes pedir:

- "Lista mis cuentas de Kommo"
- "Dame un resumen de todas las cuentas"
- "Cuantos leads tiene Mi Empresa?"
- "Que tareas pendientes hay en Cliente ABC?"
- "Muestra los pipelines de Mi Empresa"
- "Cuantos contactos nuevos hay hoy?"

---

## Opcion B: Deploy remoto (Cowork / Railway / cualquier servidor)

El modo remoto expone el MCP como un servidor HTTP con transporte Streamable HTTP. Esto permite:
- Conectar desde **Cowork** u otros clientes MCP web
- **Tareas programadas** que corren 24/7 sin depender de tu PC
- Acceso desde cualquier lugar

### 1. Deploy en Railway (recomendado, gratis para empezar)

1. Ve a [railway.app](https://railway.app) y conecta tu cuenta de GitHub
2. Crea un nuevo proyecto desde tu repo `kommo-mcp-ventas-inteligentes`
3. En **Variables de entorno**, agrega:

```
KOMMO_ACCOUNTS=[{"name":"Mi Empresa","subdomain":"miempresa","token":"eyJ0eXA..."},{"name":"Cliente ABC","subdomain":"clienteabc","token":"eyJ0eXA..."}]
PORT=3000
```

4. Railway detecta el Dockerfile y despliega automaticamente
5. Te da una URL publica tipo `https://kommo-mcp-xxx.up.railway.app`

### 2. Conectar a Cowork

En tu sesion de Cowork, configura el MCP remoto con la URL:

```
https://TU-URL-RAILWAY.up.railway.app/mcp
```

### 3. Probar localmente el modo remoto

```bash
npm run start:remote
# Servidor corre en http://localhost:3000
# Endpoint MCP: http://localhost:3000/mcp
# Health check: http://localhost:3000/health
```

### 4. Deploy manual (VPS, Docker, etc.)

```bash
# Compilar
npm run build

# Definir cuentas via variable de entorno
export KOMMO_ACCOUNTS='[{"name":"Mi Empresa","subdomain":"miempresa","token":"..."}]'

# Arrancar
npm run start:remote
```

O con Docker:

```bash
docker build -t kommo-mcp .
docker run -p 3000:3000 -e KOMMO_ACCOUNTS='[...]' kommo-mcp
```

---

## Requisitos

- Node.js 18+
- Cuenta(s) de Kommo con acceso de administrador
- Claude Code, Claude Desktop, Cowork u otro cliente MCP

## Seguridad

- El archivo `accounts.json` contiene tus tokens y **NO se sube a GitHub** (esta en `.gitignore`)
- Para deploy remoto, usa la variable de entorno `KOMMO_ACCOUNTS` en lugar de archivos
- Cada usuario debe crear su propia configuracion con sus tokens
- Los tokens de larga duracion duran hasta 5 anos
- Puedes revocar un token en cualquier momento desde Kommo

## Licencia

MIT
