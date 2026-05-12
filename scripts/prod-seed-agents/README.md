# Seed de agentes Molinos en PROD

Script único `seed.js` que crea **8 agentes** en el cluster productivo:

- **7 especialistas** — Outlook, Calendar, OneDrive, Excel, SharePoint, Teams, Planner. Cada uno con sus tools curadas de Microsoft 365, regla de confirmación previa para operaciones write, y placeholder `{{current_date}}` al inicio del system prompt.
- **1 router** — "Asistente Molinos". Sin tools propias. Tiene 7 *handoff edges* hacia los especialistas, así que cuando hablás con él analiza la consulta y delega al especialista correcto.

Incluye:

- Inserción en colección `agents` con `provider: bedrock` y el inference profile de Haiku 4.5.
- Inyección del placeholder `{{current_date}}` al inicio del system prompt (se resuelve en runtime via `replaceSpecialVars`).
- ACL entries (`aclentries`) que dan OWNER al usuario admin sobre cada agente.
- Idempotente: si ya existe un agente con ese nombre + author, lo saltea.

> ⚠️ El agente router **requiere** que `chain` esté en `endpoints.agents.capabilities` del `librechat.yaml` productivo. Si no está, el agente router se crea igual pero no va a poder ejecutar handoffs en runtime.

## Pre-requisitos

1. Cluster productivo con LibreChat corriendo.
2. MongoDB accesible vía `kubectl exec` en el pod `mongodb-0` (namespace `librechat`).
3. Saber el `_id` del usuario admin de prod que va a ser el dueño nominal de los agentes.

## Paso 1 — Encontrar el OWNER_ID

Dentro del pod de mongo:

```bash
kubectl exec -it mongodb-0 -n librechat -- mongosh LibreChat --quiet --eval '
db.users.find({}, { _id: 1, email: 1, role: 1 }).forEach(u => print(JSON.stringify(u)));
'
```

Buscar el user con email del admin (ej. `franciso.lopeztancredi@molinos.com.ar`) y copiar su `_id`.

## Paso 2 — Editar `seed.js`

Reemplazar:

```js
const OWNER_ID = ObjectId('REPLACE_ME_WITH_ADMIN_USER_OBJECTID');
```

con el ObjectId obtenido en el paso 1.

Si en algún momento prod usa otro inference profile / model, también ajustar:

```js
const PROVIDER = 'bedrock';
const MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
```

## Paso 3 — Copiar al pod y ejecutar

```bash
# Copiar
kubectl cp seed.js mongodb-0:/tmp/seed.js -n librechat

# Correr
kubectl exec -it mongodb-0 -n librechat -- mongosh LibreChat --file /tmp/seed.js
```

Salida esperada:

```
Seeding 7 agentes — author: ..., provider: bedrock, model: us.anthropic.claude-haiku-4-5-...
  ✓ Outlook: creado (id agent_xxxxx) con 12 tools + 2 ACL entries
  ✓ Calendar: creado (id agent_xxxxx) con 9 tools + 2 ACL entries
  ✓ OneDrive: creado (id agent_xxxxx) con 11 tools + 2 ACL entries
  ✓ Excel: creado (id agent_xxxxx) con 14 tools + 2 ACL entries
  ✓ SharePoint: creado (id agent_xxxxx) con 11 tools + 2 ACL entries
  ✓ Teams: creado (id agent_xxxxx) con 9 tools + 2 ACL entries
  ✓ Planner: creado (id agent_xxxxx) con 8 tools + 2 ACL entries

Resultado: 7 creados, 0 salteados, 7 total en DB para este owner.
```

## Paso 4 — Verificar en LibreChat UI

Loguearse a la URL de prod con la cuenta admin. En el selector de modelo deberían aparecer los 7 agentes nuevos.

## Pendiente: visibilidad para todos los usuarios

Los agentes se crean con ACL OWNER **solo para el admin**. Para que los vea todo el tenant hay 2 caminos:

1. **Desde la UI** — admin abre cada agente en Agent Builder → "Share" → selecciona "Todos en el tenant" (si está habilitado).
2. **Vía script** — agregar ACL entries con `principalType: "group"` apuntando al grupo "all users" del tenant. Hoy `interface.agents.public` en prod está en `false`, lo cual restringe esta opción.

Decisión pendiente con el equipo: si conviene hacer estos 7 públicos a todos o limitarlos a un subgrupo.

## Si necesitás re-correr

El script es idempotente — corré las veces que quieras. Si querés **rehacer** un agente desde cero, primero borralo manualmente:

```js
// Dentro de mongosh
const agentName = 'Calendar';
const author = ObjectId('...');
const a = db.agents.findOne({ name: agentName, author });
if (a) {
  db.aclentries.deleteMany({ resourceId: a._id });
  db.agents.deleteOne({ _id: a._id });
  print('Eliminado: ' + agentName);
}
```

Y después volvés a correr `seed.js`.
