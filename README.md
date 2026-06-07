# Kommo MCP Server

MCP (Model Context Protocol) server para monitorear múltiples cuentas de **Kommo CRM** desde Claude Code, Claude Desktop o cualquier cliente MCP.

Ideal para agencias, partners y consultores que manejan varias cuentas de clientes.

## Funcionalidades

- **Multi-cuenta**: Monitorea 1, 10 o 100 cuentas desde un solo lugar
- **Leads**: Listar, buscar, crear y actualizar leads
- **Contactos**: Buscar, crear y actualizar contactos
- **Empresas**: Gestionar empresas/companies
- **Pipelines**: Ver embudos de venta y resumen por etapa
- **Tareas**: Ver pendientes, crear y completar tareas
- **Eventos**: Actividad reciente de cada cuenta
- **Dashboard**: Resumen rápido de todas las cuentas con un solo comando

## 20 herramientas disponibles

| Categoría | Herramientas |
|---|---|
| Cuentas | `list_accounts`, `get_account_info`, `multi_account_summary` |
| Leads | `get_leads`, `get_lead`, `create_lead`, `update_lead` |
| Contactos | `get_contacts`, `get_contact`, `create_contact`, `update_contact` |
| Empresas | `get_companies`, `get_company`, `create_company` |
| Pipelines | `get_pipelines`, `get_pipeline`, `get_pipeline_leads_summary` |
| Tareas | `get_tasks`, `get_task`, `create_task`, `update_task` |
| Eventos | `get_events`, `get_users` |

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/kommo-mcp.git
cd kommo-mcp
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
- "¿Cuántos leads tiene Mi Empresa?"
- "¿Qué tareas pendientes hay en Cliente ABC?"
- "Muéstrame los pipelines de Mi Empresa"
- "¿Cuántos contactos nuevos hay hoy?"

## Requisitos

- Node.js 18+
- Cuenta(s) de Kommo con acceso de administrador
- Claude Code, Claude Desktop u otro cliente MCP

## Seguridad

- El archivo `accounts.json` contiene tus tokens y **NO se sube a GitHub** (está en `.gitignore`)
- Cada usuario debe crear su propio `accounts.json` con sus tokens
- Los tokens de larga duración duran hasta 5 años
- Puedes revocar un token en cualquier momento desde Kommo

## Licencia

MIT
