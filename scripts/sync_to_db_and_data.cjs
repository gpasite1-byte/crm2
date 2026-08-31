const fs = require('fs');
const path = require('path');
const { deduplicatedDeals, allClients } = require('./build_full_database.cjs');

const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'crm-db.json');

console.log(`Starting synchronization with ${deduplicatedDeals.length} deals and ${allClients.length} clients...`);

// 1. Update crm-db.json
let currentDb = {};
if (fs.existsSync(dbPath)) {
  try {
    currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (e) {
    currentDb = {};
  }
}

// Preserve existing users, add missing commercials
const initialComerciais = [
  { id: 'u1', nome: 'Amélia Cassinda', email: 'amelia.cassinda@gpaangola.co.ao', perfil: 'comercial', funcao: 'Sênior', metaMensal: 25000000, metaSemanal: 6250000, comissao: 0.03, pesoConversao: 0.4, telefone: '922111222', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' },
  { id: 'u2', nome: 'David Guedes', email: 'david.guedes@gpaangola.co.ao', perfil: 'comercial', funcao: 'Comercial', metaMensal: 15000000, metaSemanal: 3750000, comissao: 0.03, pesoConversao: 0.4, telefone: '923222333', foto: '', status: 'ativo', silencioso: false, provincia: 'Cabinda', senha: 'gpa2026' },
  { id: 'u3', nome: 'Fernando Leite', email: 'fernando.leite@gpaangola.co.ao', perfil: 'comercial', funcao: 'Comercial', metaMensal: 10000000, metaSemanal: 2500000, comissao: 0.03, pesoConversao: 0.4, telefone: '924333444', foto: '', status: 'ativo', silencioso: false, provincia: 'Huambo', senha: 'gpa2026' },
  { id: 'u4', nome: 'José Neto', email: 'jose.neto@gpaangola.co.ao', perfil: 'comercial', funcao: 'Sênior', metaMensal: 20000000, metaSemanal: 5000000, comissao: 0.03, pesoConversao: 0.4, telefone: '925444555', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' },
  { id: 'u5', nome: 'Marta de Oliveira', email: 'marta.graca@gpaangola.co.ao', perfil: 'comercial', funcao: 'Sênior', metaMensal: 25000000, metaSemanal: 6250000, comissao: 0.03, pesoConversao: 0.4, telefone: '926555666', foto: '', status: 'ativo', silencioso: false, provincia: 'Benguela', senha: 'gpa2026' },
  { id: 'u6', nome: 'Ilídio Pedro', email: 'ilidio.pedro@gpaangola.co.ao', perfil: 'comercial', funcao: 'Comercial', metaMensal: 10000000, metaSemanal: 2500000, comissao: 0.03, pesoConversao: 0.4, telefone: '927666777', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' },
  { id: 'u15', nome: 'Luísa Baltazar', email: 'luisa.baltazar@gpaangola.co.ao', perfil: 'comercial', funcao: 'Comercial', metaMensal: 30000000, metaSemanal: 7500000, comissao: 0.03, pesoConversao: 0.4, telefone: '928999888', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' },
  { id: 'u8', nome: 'Carlos Francisco', email: 'carlos.francisco@gpaangola.co.ao', perfil: 'comercial', funcao: 'Comercial', metaMensal: 15000000, metaSemanal: 3750000, comissao: 0.03, pesoConversao: 0.4, telefone: '922000000', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' },
  { id: 'u9', nome: 'David Neto', email: 'david.neto@gpaangola.co.ao', perfil: 'admin', funcao: 'Administrador Principal & Comercial', metaMensal: 30000000, metaSemanal: 7500000, comissao: 0.03, pesoConversao: 0.4, telefone: '923000000', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' },
  { id: 'u10', nome: 'Admin', email: 'admin', perfil: 'admin', funcao: 'Administrador Principal', metaMensal: 0, metaSemanal: 0, comissao: 0.0, pesoConversao: 0.0, telefone: '922000000', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' },
  { id: 'u16', nome: 'Suzete Francisco', email: 'suzete.francisco@gpaangola.co.ao', perfil: 'comercial', funcao: 'Comercial', metaMensal: 25000000, metaSemanal: 6250000, comissao: 0.03, pesoConversao: 0.4, telefone: '928777999', foto: '', status: 'ativo', silencioso: false, provincia: 'Luanda', senha: 'gpa2026' }
];

const existingComerciais = currentDb.comerciais || initialComerciais;
// Merge clients
const existingClients = currentDb.clients || [];
const mergedClientsMap = new Map();
allClients.forEach(c => mergedClientsMap.set((c.empresa || c.nome).toLowerCase(), c));
existingClients.forEach(c => {
  const k = (c.empresa || c.nome || '').toLowerCase();
  if (k && !mergedClientsMap.has(k)) {
    mergedClientsMap.set(k, c);
  }
});
const mergedClients = Array.from(mergedClientsMap.values());

const sanitizedDeals = deduplicatedDeals.filter(d => {
  if (!d) return false;
  if (d.id && (d.id.includes('Metas_Performance') || d.id.includes('Metas'))) return false;
  if (d.dataEnvio && (d.dataEnvio.includes('8744') || parseInt(d.dataEnvio.substring(0, 4), 10) > 2028)) return false;
  if (d.clienteNome && (/^\d+$/.test(d.clienteNome) || d.clienteNome.toLowerCase().includes('meta'))) return false;
  return true;
});

const updatedDb = {
  ...currentDb,
  comerciais: existingComerciais,
  clients: mergedClients,
  deals: sanitizedDeals,
  lastUpdated: new Date().toISOString()
};

fs.writeFileSync(dbPath, JSON.stringify(updatedDb, null, 2), 'utf-8');
console.log(`✅ Successfully updated crm-db.json with ${sanitizedDeals.length} deals and ${mergedClients.length} clients.`);

// 2. Update src/data/officialExcelProposals.ts
const proposalsTsContent = `// PROPOSTAS COMERCIAIS REAIS DO RELATORIO CRM GPA (Actualizado até 24–28 Ago 2026)
export const officialExcelProposals = ${JSON.stringify(sanitizedDeals, null, 2)};
`;
fs.writeFileSync(path.join(rootDir, 'src', 'data', 'officialExcelProposals.ts'), proposalsTsContent, 'utf-8');
console.log(`✅ Successfully updated src/data/officialExcelProposals.ts`);

// 3. Update src/data/baseDuasSemanasData.ts
const baseDuasSemanasFormat = sanitizedDeals.map((d, i) => ({
  id: d.id,
  semana: d.semana,
  cliente: d.clienteNome || d.empresa,
  servico: d.titulo,
  valorProposta: d.valor > 0 ? new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2 }).format(d.valor) + ' Kz' : '0,00 Kz',
  valorAprovado: d.valorAprovado > 0 ? new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2 }).format(d.valorAprovado) + ' Kz' : '0,00 Kz',
  valorPerdido: d.valorPerdido > 0 ? new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2 }).format(d.valorPerdido) + ' Kz' : '0,00 Kz',
  crmStatus: d.crmStatus || (d.etapa === 'fechado' ? 'Fechado ganho' : d.etapa === 'perdido' ? 'Fechado perdido' : 'Aberto'),
  gestorComercial: d.comercialNome,
  prioridade: d.prioridade,
  diasEmAberto: d.diasAberto,
  probabilidade: typeof d.probabilidade === 'number' ? `${d.probabilidade}%` : d.probabilidade,
  proximaAcao: d.proximaAcao,
  proximoContacto: d.proximoContacto,
  observacoes: d.observacoes,
  classeCliente: d.classeCliente || 'B',
  empresaGroup: d.empresa || 'GPA Angola',
  dataEnvio: d.dataEnvio
}));

const baseDuasSemanasTsContent = `// DADOS REAIS DAS DUAS SEMANAS E HISTÓRICO GPA CRM (Actualizado até 24–28 Ago 2026)
export const baseDuasSemanasData = ${JSON.stringify(baseDuasSemanasFormat, null, 2)};
`;
fs.writeFileSync(path.join(rootDir, 'src', 'data', 'baseDuasSemanasData.ts'), baseDuasSemanasTsContent, 'utf-8');
console.log(`✅ Successfully updated src/data/baseDuasSemanasData.ts`);

// 4. Update initialDeals in src/data.ts
const dataTsPath = path.join(rootDir, 'src', 'data.ts');
if (fs.existsSync(dataTsPath)) {
  let dataTs = fs.readFileSync(dataTsPath, 'utf-8');
  
  // Replace initialDeals with deduplicatedDeals export
  const dealsJson = JSON.stringify(deduplicatedDeals, null, 2);
  const regex = /export const initialDeals: Deal\[\] = \[[\s\S]*?\n\];/;
  if (regex.test(dataTs)) {
    dataTs = dataTs.replace(regex, `export const initialDeals: Deal[] = ${dealsJson};`);
    fs.writeFileSync(dataTsPath, dataTs, 'utf-8');
    console.log(`✅ Successfully updated initialDeals in src/data.ts`);
  }
}

console.log('Synchronization complete!');
