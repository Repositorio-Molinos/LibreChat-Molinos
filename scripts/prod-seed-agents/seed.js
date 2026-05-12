// =============================================================================
// Seed de 7 agentes Molinos (Outlook, Calendar, OneDrive, Excel, SharePoint,
// Teams, Planner) para PROD.
//
// IMPORTANTE: este script es idempotente — no recrea agentes que ya existan
// con el mismo nombre y autor.
//
// Cómo correrlo:
//   1. Ajustar OWNER_ID abajo con el ObjectId del usuario admin de prod (ver
//      README.md para cómo obtenerlo).
//   2. Copiar al pod de mongo:
//        kubectl cp seed.js mongodb-0:/tmp/ -n librechat
//   3. Ejecutar:
//        kubectl exec -it mongodb-0 -n librechat -- \
//          mongosh LibreChat --file /tmp/seed.js
//
// Adaptado de los scripts usados en dev (create-agents + grant-acls +
// inject-date), fusionado en un solo paso e idempotente.
// =============================================================================

// ---------------- CONFIGURACIÓN — AJUSTAR ANTES DE CORRER ---------------------

// ObjectId del usuario admin de prod que va a ser el "author" de los agentes.
// Para obtenerlo, dentro del pod de mongo:
//   db.users.findOne({ email: "admin@molinos.com.ar" }, { _id: 1 })
const OWNER_ID = ObjectId('REPLACE_ME_WITH_ADMIN_USER_OBJECTID');

// Provider y model — en prod estamos en Bedrock, no Anthropic directo
const PROVIDER = 'bedrock';
const MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

// El MCP server registrado en librechat.yaml — debería ser "office365" igual
// que en dev. Si cambia el nombre, ajustar acá.
const MCP_SERVER_NAME = 'office365';

// ---------------- NO EDITAR DE ACÁ PARA ABAJO ---------------------------------

if (OWNER_ID.toString() === 'REPLACE_ME_WITH_ADMIN_USER_OBJECTID') {
  print('ERROR: OWNER_ID no está configurado. Editar el archivo antes de correr.');
  quit(1);
}

const sysServer = `sys__server__sys_${MCP_SERVER_NAME}`;

function withSuffix(toolNames) {
  return toolNames.map(t => `${t}_mcp_${MCP_SERVER_NAME}`);
}

function genId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = '';
  for (let i = 0; i < 21; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `agent_${id}`;
}

const STYLE =
  'Respondé en español rioplatense neutro. Breve y directo, sin preámbulos ' +
  '("¡Claro!", "Por supuesto") ni resúmenes de lo ya dicho. Si la pregunta es ' +
  'ambigua, asumí lo más probable y aclaralo en una línea al final.';

const DATE_LINE =
  'Fecha actual: {{current_date}}. Usá esto como referencia siempre que el ' +
  'usuario diga "hoy", "mañana", "esta semana", etc.\n\n';

// Tools "write" por agente — las que requieren confirmación previa del usuario.
// Mantener sincronizado con los toolNames del array AGENTS abajo.
const WRITE_TOOLS = {
  Outlook: [
    'send-mail', 'send-draft-message', 'reply-mail-message',
    'forward-mail-message', 'delete-mail-message',
  ],
  Calendar: [
    'create-calendar-event', 'update-calendar-event', 'delete-calendar-event',
    'accept-calendar-event', 'decline-calendar-event',
  ],
  OneDrive: [
    'delete-onedrive-file', 'move-rename-onedrive-item', 'upload-file-content',
    'copy-drive-item', 'create-onedrive-folder', 'create-drive-item-share-link',
  ],
  Excel: [
    'copy-drive-item', 'update-excel-range', 'add-excel-table-rows',
    'create-excel-table', 'format-excel-range', 'create-excel-chart',
  ],
  SharePoint: [
    'create-sharepoint-list-item', 'update-sharepoint-list-item', 'upload-file-content',
  ],
  Teams: [
    'send-chat-message', 'reply-to-chat-message',
    'send-channel-message', 'reply-to-channel-message',
    'create-chat', 'create-online-meeting',
  ],
  Planner: [
    'create-todo-task', 'update-todo-task',
    'create-planner-task', 'update-planner-task',
  ],
};

function buildConfirmationBlock(agentName) {
  const tools = WRITE_TOOLS[agentName];
  if (!tools || tools.length === 0) return '';
  const toolLines = tools.map(t => '- ' + t).join('\n');
  return (
    'REGLA DE CONFIRMACIÓN (CRÍTICA):\n' +
    'Antes de ejecutar cualquier acción con efecto lateral, seguí este flujo:\n\n' +
    '1. NO ejecutes la tool todavía.\n' +
    '2. Mostrale al usuario un resumen claro y conciso de qué vas a hacer, incluyendo los datos clave (destinatarios, asunto, fecha, archivo, etc.).\n' +
    '3. Terminá con "¿Confirmás?" o equivalente.\n' +
    '4. Esperá un "sí", "ok", "dale" o "mandalo" explícito en el siguiente mensaje del usuario antes de ejecutar.\n' +
    '5. Si el usuario corrige, ajustá y volvé a pedir confirmación.\n' +
    '6. La confirmación es POR ACCIÓN — no asumas autorización de mensajes anteriores; pedí confirmación cada vez que vayas a ejecutar una nueva acción.\n\n' +
    'Tools que requieren confirmación previa:\n' + toolLines + '\n\n' +
    'El resto de las tools (lectura, búsqueda, listado) podés ejecutarlas directamente — no tienen efecto lateral.\n\n'
  );
}

const AGENTS = [
  {
    name: 'Outlook',
    description: 'Asistente de correo (Outlook / Microsoft 365).',
    toolNames: [
      'list-mail-messages', 'list-mail-folders', 'get-mail-message',
      'send-mail', 'create-draft-email', 'send-draft-message',
      'create-reply-draft', 'create-forward-draft', 'reply-mail-message',
      'forward-mail-message', 'delete-mail-message', 'search-query',
    ],
    body:
      'Sos un asistente especializado en Outlook del equipo Molinos.\n\n' +
      STYLE + '\n\n' +
      'Tenés tools para leer, mandar, responder, reenviar y buscar mails en la ' +
      'cuenta del usuario logueado. Ya están todas las que necesitás — no busques otras.\n\n' +
      'Patrones típicos:\n' +
      '- Mandar mail: send-mail directo.\n' +
      '- Responder: reply-mail-message si está claro, o create-reply-draft + send-draft-message si conviene revisar antes.\n' +
      '- Buscar mails viejos: search-query.\n' +
      '- Listar inbox: list-mail-messages.',
  },
  {
    name: 'Calendar',
    description: 'Asistente de calendario y reuniones (Outlook Calendar / Microsoft 365).',
    toolNames: [
      'list-calendars', 'list-calendar-events', 'get-calendar-event',
      'create-calendar-event', 'update-calendar-event', 'delete-calendar-event',
      'find-meeting-times', 'accept-calendar-event', 'decline-calendar-event',
    ],
    body:
      'Sos un asistente especializado en Calendario y reuniones del equipo Molinos.\n\n' +
      STYLE + '\n\n' +
      'Tenés tools para listar, leer, crear, actualizar y cancelar eventos del ' +
      'calendario del usuario; aceptar/rechazar invitaciones; y encontrar slots ' +
      'libres para coordinar reuniones. Ya están todas las que necesitás.\n\n' +
      'Patrones típicos:\n' +
      '- "Qué reuniones tengo el martes": list-calendar-events con rango de fechas.\n' +
      '- "Agendar reunión con María mañana 10 a 11": create-calendar-event.\n' +
      '- "Cuándo nos podemos juntar todos": find-meeting-times.\n\n' +
      'Usá la zona horaria del usuario (America/Argentina/Buenos_Aires) cuando ' +
      'no se especifique otra.',
  },
  {
    name: 'OneDrive',
    description: 'Asistente de archivos en OneDrive (Microsoft 365).',
    toolNames: [
      'list-drives', 'get-drive-root-item', 'list-folder-files', 'get-drive-item',
      'create-onedrive-folder', 'upload-file-content', 'delete-onedrive-file',
      'move-rename-onedrive-item', 'copy-drive-item', 'create-drive-item-share-link',
      'search-onedrive-files',
    ],
    body:
      'Sos un asistente especializado en OneDrive del equipo Molinos.\n\n' +
      STYLE + '\n\n' +
      'Tenés tools para navegar, buscar, subir, mover, copiar, borrar y compartir ' +
      'archivos del OneDrive del usuario. Ya están todas las que necesitás.\n\n' +
      'Patrones típicos:\n' +
      '- "Buscame el informe Q1": search-onedrive-files.\n' +
      '- "Subir este archivo": upload-file-content.\n' +
      '- "Compartir este archivo": create-drive-item-share-link.\n' +
      '- "Mover este archivo a la carpeta X": move-rename-onedrive-item.\n\n' +
      'No intentes crear archivos Excel (.xlsx) desde cero — para eso usá el ' +
      'agente Excel sobre una plantilla existente.',
  },
  {
    name: 'Excel',
    description: 'Asistente para editar planillas Excel en OneDrive (Microsoft 365).',
    toolNames: [
      'search-onedrive-files', 'get-drive-item', 'get-drive-root-item', 'copy-drive-item',
      'list-excel-worksheets', 'list-excel-tables', 'get-excel-table',
      'get-excel-range', 'get-excel-used-range', 'update-excel-range',
      'create-excel-table', 'add-excel-table-rows', 'format-excel-range', 'create-excel-chart',
    ],
    body:
      'Sos un asistente especializado en planillas Excel del equipo Molinos.\n\n' +
      STYLE + '\n\n' +
      'Tenés tools para localizar workbooks en OneDrive y editar su contenido ' +
      '(hojas, rangos, tablas, gráficos). Ya están todas las que necesitás.\n\n' +
      'Limitación importante: NO podés crear un workbook .xlsx desde cero. Si el ' +
      'usuario pide un Excel nuevo:\n' +
      '1. Preguntale qué plantilla querés copiar (o sugerí buscar una existente con search-onedrive-files).\n' +
      '2. Duplicala con copy-drive-item al nombre nuevo.\n' +
      '3. Escribí el contenido pedido con update-excel-range o add-excel-table-rows.\n\n' +
      'Usá notación A1 estándar (A1, B5:D10, etc) para los rangos.',
  },
  {
    name: 'SharePoint',
    description: 'Asistente para sitios y listas de SharePoint (Microsoft 365).',
    toolNames: [
      'search-sharepoint-sites', 'get-sharepoint-site', 'get-sharepoint-site-by-path',
      'list-sharepoint-site-drives', 'list-sharepoint-site-items',
      'get-sharepoint-site-list', 'list-sharepoint-list-columns',
      'get-sharepoint-site-list-item', 'create-sharepoint-list-item',
      'update-sharepoint-list-item', 'upload-file-content',
    ],
    body:
      'Sos un asistente especializado en SharePoint del equipo Molinos.\n\n' +
      STYLE + '\n\n' +
      'Tenés tools para encontrar sitios, navegar bibliotecas de documentos, ' +
      'leer y editar listas de SharePoint, y subir archivos. Ya están todas las ' +
      'que necesitás.\n\n' +
      'Patrones típicos:\n' +
      '- "Buscar el sitio del proyecto X": search-sharepoint-sites.\n' +
      '- "Listar archivos del sitio": list-sharepoint-site-drives + list-sharepoint-site-items.\n' +
      '- "Agregar entrada a la lista X": get-sharepoint-site-list para conocer la estructura, después create-sharepoint-list-item.\n' +
      '- "Subir documento a la biblioteca": upload-file-content.',
  },
  {
    name: 'Teams',
    description: 'Asistente de Microsoft Teams (chats, canales, reuniones online).',
    toolNames: [
      'list-chats', 'get-chat', 'list-chat-messages',
      'send-chat-message', 'reply-to-chat-message', 'create-chat',
      'get-team', 'list-team-channels', 'list-channel-messages',
      'get-channel-message', 'send-channel-message', 'reply-to-channel-message',
      'create-online-meeting',
    ],
    body:
      'Sos un asistente especializado en Microsoft Teams del equipo Molinos.\n\n' +
      STYLE + '\n\n' +
      'Tenés tools para listar y leer chats 1-a-1 y de grupo, mandar y responder ' +
      'mensajes (tanto en chats como en canales), navegar teams y canales, y ' +
      'crear reuniones online. Ya están todas las que necesitás.\n\n' +
      'Patrones típicos:\n' +
      '- "Qué dijo Juan en Teams": list-chats + list-chat-messages.\n' +
      '- "Mensajes del canal General de equipo X": list-team-channels + list-channel-messages.\n' +
      '- "Mandale un mensaje a Juan en Teams": list-chats para encontrar el chat, después send-chat-message.\n' +
      '- "Responder al mensaje X en el canal Y": reply-to-channel-message.\n' +
      '- "Crear reunión de Teams": create-online-meeting.\n\n' +
      'Nota: para mensajes recientes, list-chat-messages devuelve por fecha descendente.',
  },
  {
    name: 'Planner',
    description: 'Asistente de tareas (To Do y Planner / Microsoft 365).',
    toolNames: [
      'list-todo-task-lists', 'list-todo-tasks', 'create-todo-task', 'update-todo-task',
      'get-planner-plan', 'list-plan-tasks', 'create-planner-task', 'update-planner-task',
    ],
    body:
      'Sos un asistente de tareas (To Do y Planner) del equipo Molinos.\n\n' +
      STYLE + '\n\n' +
      'Tenés tools para listar y manejar tareas personales (Microsoft To Do) y ' +
      'tareas de equipo (Planner). Ya están todas las que necesitás.\n\n' +
      'Diferencia clave:\n' +
      '- To Do = tareas personales del usuario. Tools: list-todo-tasks, create-todo-task, update-todo-task.\n' +
      '- Planner = tareas dentro de un plan (típicamente atado a un Group/Team). Tools: get-planner-plan, list-plan-tasks, create-planner-task, update-planner-task.\n\n' +
      'Preguntale al usuario cuál de los dos si no es claro.',
  },
];

// Lookup access role _ids
const agentOwnerRole = db.accessroles.findOne({ accessRoleId: 'agent_owner' });
const remoteOwnerRole = db.accessroles.findOne({ accessRoleId: 'remoteAgent_owner' });

if (!agentOwnerRole || !remoteOwnerRole) {
  print('ERROR: no se encontraron los access roles agent_owner / remoteAgent_owner. ' +
        '¿LibreChat fue inicializado correctamente en este cluster?');
  quit(1);
}

print(`Seeding ${AGENTS.length} agentes — author: ${OWNER_ID}, provider: ${PROVIDER}, model: ${MODEL}`);

let created = 0;
let skipped = 0;

AGENTS.forEach(spec => {
  // Idempotencia: no crear si ya existe un agente con este nombre + author
  const existing = db.agents.findOne({ name: spec.name, author: OWNER_ID });
  if (existing) {
    print(`  - ${spec.name}: ya existe (id ${existing.id}), salteando`);
    skipped++;
    return;
  }

  const id = genId();
  const now = new Date();
  const instructions = DATE_LINE + buildConfirmationBlock(spec.name) + spec.body;
  const tools = [sysServer, sysServer].concat(withSuffix(spec.toolNames));

  const version = {
    id, name: spec.name, description: spec.description, instructions,
    provider: PROVIDER, model: MODEL, artifacts: '',
    tools, edges: [], model_parameters: {},
    support_contact: { name: '', email: '' },
    category: 'general',
    createdAt: now, updatedAt: now,
  };

  const doc = {
    id, name: spec.name, description: spec.description, instructions,
    provider: PROVIDER, model: MODEL, artifacts: '',
    tools, tool_kwargs: [], tool_options: {},
    mcpServerNames: [MCP_SERVER_NAME],
    author: OWNER_ID,
    agent_ids: [], edges: [], conversation_starters: [],
    end_after_tools: false, hide_sequential_outputs: false, is_promoted: false,
    category: 'general',
    support_contact: { name: '', email: '' },
    versions: [version],
    createdAt: now, updatedAt: now,
    __v: 0,
  };

  const insertResult = db.agents.insertOne(doc);
  const agentObjectId = insertResult.insertedId;

  // ACL entries: el author es OWNER (permBits 15) sobre el recurso
  // como tipo "agent" Y como tipo "remoteAgent" (LibreChat usa ambos
  // para distintos flujos — list normal y remote-agent invocation).
  db.aclentries.insertOne({
    principalType: 'user', principalModel: 'User', principalId: OWNER_ID,
    resourceType: 'agent', resourceId: agentObjectId,
    permBits: 15, roleId: agentOwnerRole._id,
    grantedBy: OWNER_ID, grantedAt: now,
    createdAt: now, updatedAt: now, __v: 0,
  });
  db.aclentries.insertOne({
    principalType: 'user', principalModel: 'User', principalId: OWNER_ID,
    resourceType: 'remoteAgent', resourceId: agentObjectId,
    permBits: 15, roleId: remoteOwnerRole._id,
    grantedBy: OWNER_ID, grantedAt: now,
    createdAt: now, updatedAt: now, __v: 0,
  });

  print(`  ✓ ${spec.name}: creado (id ${id}) con ${spec.toolNames.length} tools + 2 ACL entries`);
  created++;
});

// ============================================================================
// PARTE 2 — Agente Router ("Asistente Molinos")
//
// Sin tools propias. Tiene 7 handoff edges hacia los especialistas, así que el
// LLM le ve 7 transfer tools (transfer_to_outlook, transfer_to_calendar, etc).
// Analiza el intent del usuario y delega al agente correcto. Requiere que la
// `chain` capability esté habilitada en endpoints.agents.capabilities del
// librechat.yaml.
// ============================================================================

const ROUTER_NAME = 'Asistente Molinos';

const HANDOFF_DESCRIPTIONS = {
  Outlook: 'Delegá al agente Outlook cuando el usuario quiera leer, mandar, responder o buscar mails.',
  Calendar: 'Delegá al agente Calendar cuando el usuario quiera ver, crear, modificar o cancelar eventos del calendario, o coordinar reuniones.',
  OneDrive: 'Delegá al agente OneDrive cuando el usuario quiera buscar, navegar, subir, mover, copiar, compartir o eliminar archivos del OneDrive.',
  Excel: 'Delegá al agente Excel cuando el usuario quiera editar contenido de planillas Excel (rangos, tablas, gráficos).',
  SharePoint: 'Delegá al agente SharePoint cuando el usuario quiera navegar sitios, leer/editar listas o subir documentos a SharePoint.',
  Teams: 'Delegá al agente Teams cuando el usuario quiera leer chats, mandar mensajes, postear en canales o crear reuniones online de Teams.',
  Planner: 'Delegá al agente Planner cuando el usuario quiera manejar tareas personales (To Do) o de equipo (Planner).',
};

const ROUTER_INSTRUCTIONS = DATE_LINE +
  'Sos el asistente principal del equipo Molinos. Tu rol es analizar la consulta ' +
  'del usuario y delegar al agente especializado correcto. NO tenés tools propias ' +
  'de Microsoft 365 — siempre delegás.\n\n' +
  STYLE + '\n\n' +
  'Reglas de routing:\n' +
  '- Mail, inbox, mandar/responder/leer correos → Outlook\n' +
  '- Calendario, reuniones, eventos, disponibilidad → Calendar\n' +
  '- Archivos en OneDrive, carpetas, compartir documentos → OneDrive\n' +
  '- Planillas Excel (escribir celdas, tablas, gráficos) → Excel\n' +
  '- Sitios SharePoint, listas, bibliotecas de documentos → SharePoint\n' +
  '- Chats de Teams, canales, mensajes, reuniones online → Teams\n' +
  '- Tareas To Do o Planner → Planner\n\n' +
  'Si la consulta es ambigua o genérica (saludos, preguntas no relacionadas con ' +
  'M365), respondela vos directamente sin delegar.\n\n' +
  'IMPORTANTE: cuando delegues, hacelo en una sola llamada — no expliques al ' +
  'usuario que vas a delegar, simplemente hacelo. El sub-agente ya sabe responder ' +
  'con su propio estilo.';

const existingRouter = db.agents.findOne({ name: ROUTER_NAME, author: OWNER_ID });
if (existingRouter) {
  print(`\n  - ${ROUTER_NAME}: ya existe (id ${existingRouter.id}), salteando`);
} else {
  const routerId = genId();
  const now = new Date();

  // Construir edges hacia cada especialista (lookup por nombre + author)
  const edges = [];
  AGENTS.forEach(spec => {
    const specialist = db.agents.findOne({ name: spec.name, author: OWNER_ID });
    if (!specialist) {
      print(`  WARN: especialista ${spec.name} no encontrado, edge salteado`);
      return;
    }
    edges.push({
      from: routerId,
      to: specialist.id,
      edgeType: 'handoff',
      description: HANDOFF_DESCRIPTIONS[spec.name] || `Delegá al agente ${spec.name}.`,
    });
  });

  const routerVersion = {
    id: routerId, name: ROUTER_NAME,
    description: 'Asistente principal — delega al agente especializado según la consulta del usuario.',
    instructions: ROUTER_INSTRUCTIONS,
    provider: PROVIDER, model: MODEL, artifacts: '',
    tools: [], edges, model_parameters: {},
    support_contact: { name: '', email: '' },
    category: 'general',
    createdAt: now, updatedAt: now,
  };

  const routerDoc = {
    id: routerId, name: ROUTER_NAME,
    description: 'Asistente principal — delega al agente especializado según la consulta del usuario.',
    instructions: ROUTER_INSTRUCTIONS,
    provider: PROVIDER, model: MODEL, artifacts: '',
    tools: [], tool_kwargs: [], tool_options: {},
    mcpServerNames: [],            // sin MCPs — solo delega
    author: OWNER_ID,
    agent_ids: [], edges,
    conversation_starters: [],
    end_after_tools: false, hide_sequential_outputs: false, is_promoted: false,
    category: 'general',
    support_contact: { name: '', email: '' },
    versions: [routerVersion],
    createdAt: now, updatedAt: now,
    __v: 0,
  };

  const routerResult = db.agents.insertOne(routerDoc);
  const routerObjectId = routerResult.insertedId;

  db.aclentries.insertOne({
    principalType: 'user', principalModel: 'User', principalId: OWNER_ID,
    resourceType: 'agent', resourceId: routerObjectId,
    permBits: 15, roleId: agentOwnerRole._id,
    grantedBy: OWNER_ID, grantedAt: now,
    createdAt: now, updatedAt: now, __v: 0,
  });
  db.aclentries.insertOne({
    principalType: 'user', principalModel: 'User', principalId: OWNER_ID,
    resourceType: 'remoteAgent', resourceId: routerObjectId,
    permBits: 15, roleId: remoteOwnerRole._id,
    grantedBy: OWNER_ID, grantedAt: now,
    createdAt: now, updatedAt: now, __v: 0,
  });

  print(`\n  ✓ ${ROUTER_NAME}: creado (id ${routerId}) con ${edges.length} handoff edges + 2 ACL entries`);
}

print(`\nResultado: ${created} creados, ${skipped} salteados, ${db.agents.countDocuments({ author: OWNER_ID })} total en DB para este owner.`);
print('\nNOTA 1: estos agentes solo son visibles para el OWNER. Para que todos los');
print('usuarios del tenant los vean, hay que compartirlos (UI: Agent Builder');
print('→ Share, o ACL entries adicionales con principalType: "group").');
print('\nNOTA 2: el agente "Asistente Molinos" requiere que la `chain` capability');
print('esté habilitada en endpoints.agents.capabilities del librechat.yaml de prod.');
