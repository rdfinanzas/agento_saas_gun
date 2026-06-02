const fs = require('fs');
const path = require('path');

// Tenant ID de rdfinanzas
const tenantId = '73b7dff9-0f04-4f38-9cee-6c6b6e5ef3bb';

// Ruta de almacenamiento
const storagePath = path.join(__dirname, '../../storage/tenants', tenantId);
const configPath = path.join(storagePath, 'config.json');

// Configuración por defecto para accomplish
const config = {
  tenantId,
  mode: 'FULL',

  // Identidad del agente
  agentName: 'Asistente IA',
  agentRole: 'Soy un asistente de IA capacitado para ayudarte con diversas tareas.',
  agentStyle: 'profesional, amigable y conciso',
  agentLanguage: 'español',

  // Información del negocio
  businessName: 'rdfinanzas',
  businessType: 'Servicios financieros',
  businessDescription: 'Asistente inteligente para tareas financieras y administrativas',
  businessHours: {
    'monday': '9:00 - 18:00',
    'tuesday': '9:00 - 18:00',
    'wednesday': '9:00 - 18:00',
    'thursday': '9:00 - 18:00',
    'friday': '9:00 - 18:00',
  },
  businessPolicies: {
    'responseTime': 'Respondemos en menos de 24 horas',
    'privacy': 'Tu información es confidencial',
  },

  // Conocimiento
  knowledgeBase: {},
  faq: {},

  // Configuración LLM (usar DeepSeek configurado)
  provider: 'deepseek',
  model: 'deepseek-chat',

  // Tools
  allowedTools: [
    'read_file',
    'write_file',
    'list_files',
    'search_files',
    'web_search',
    'execute_command'
  ],
  blockedTools: [],
};

// Crear directorio si no existe
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}

// Guardar configuración
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✓ Configuración creada para tenant rdfinanzas:');
console.log(`  Path: ${configPath}`);
console.log(`  Provider: ${config.provider}`);
console.log(`  Model: ${config.model}`);
