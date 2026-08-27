const fs = require('fs');
const path = require('path');

// Read extracted unique proposals and dashboard models
const extractedProposals = JSON.parse(fs.readFileSync('./scripts/extracted_proposals.json', 'utf-8'));
const dashboardModels = JSON.parse(fs.readFileSync('./scripts/all_dashboard_models.json', 'utf-8'));

console.log('Loaded ' + extractedProposals.length + ' proposals.');

// Define official commercials according to the reports
const officialComerciais = [
  {
    id: "u15",
    nome: "Luísa Baltazar",
    email: "luisa.baltazar@gpaangola.co.ao",
    perfil: "comercial",
    funcao: "Sénior EDGE",
    metaMensal: 30000000,
    metaSemanal: 7500000,
    comissao: 0.03,
    pesoConversao: 0.4,
    telefone: "928999888",
    whatsappNumero: "928999888",
    foto: "",
    status: "ativo",
    silencioso: false,
    provincia: "Luanda",
    senha: "gpa2026"
  },
  {
    id: "u1",
    nome: "Amélia Cassinda",
    email: "amelia.cassinda@gpaangola.co.ao",
    perfil: "comercial",
    funcao: "Sénior",
    metaMensal: 25000000,
    metaSemanal: 6250000,
    comissao: 0.03,
    pesoConversao: 0.4,
    telefone: "922111222",
    whatsappNumero: "922111222",
    foto: "",
    status: "ativo",
    silencioso: false,
    provincia: "Luanda",
    senha: "gpa2026"
  },
  {
    id: "u5",
    nome: "Marta de Oliveira",
    email: "marta.oliveira@gpaangola.co.ao",
    perfil: "comercial",
    funcao: "Sénior",
    metaMensal: 25000000,
    metaSemanal: 6250000,
    comissao: 0.03,
    pesoConversao: 0.4,
    telefone: "926555666",
    whatsappNumero: "926555666",
    foto: "",
    status: "ativo",
    silencioso: false,
    provincia: "Benguela",
    senha: "gpa2026"
  },
  {
    id: "u4",
    nome: "José Neto",
    email: "jose.neto@gpaangola.co.ao",
    perfil: "comercial",
    funcao: "Sénior",
    metaMensal: 20000000,
    metaSemanal: 5000000,
    comissao: 0.03,
    pesoConversao: 0.4,
    telefone: "925444555",
    whatsappNumero: "925444555",
    foto: "",
    status: "ativo",
    silencioso: false,
    provincia: "Luanda",
    senha: "gpa2026"
  },
  {
    id: "u2",
    nome: "David Guedes",
    email: "david.guedes@gpaangola.co.ao",
    perfil: "comercial",
    funcao: "Comercial",
    metaMensal: 15000000,
    metaSemanal: 3750000,
    comissao: 0.03,
    pesoConversao: 0.4,
    telefone: "923222333",
    whatsappNumero: "923222333",
    foto: "",
    status: "ativo",
    silencioso: false,
    provincia: "Cabinda",
    senha: "gpa2026"
  },
  {
    id: "u6",
    nome: "Ilídio Pedro",
    email: "ilidio.pedro@gpaangola.co.ao",
    perfil: "comercial",
    funcao: "Comercial",
    metaMensal: 10000000,
    metaSemanal: 2500000,
    comissao: 0.03,
    pesoConversao: 0.4,
    telefone: "927666777",
    whatsappNumero: "927666777",
    foto: "",
    status: "ativo",
    silencioso: false,
    provincia: "Luanda",
    senha: "gpa2026"
  },
  {
    id: "u3",
    nome: "Fernando Leite",
    email: "fernando.leite@gpaangola.co.ao",
    perfil: "comercial",
    funcao: "Comercial",
    metaMensal: 10000000,
    metaSemanal: 2500000,
    comissao: 0.03,
    pesoConversao: 0.4,
    telefone: "924333444",
    whatsappNumero: "924333444",
    foto: "",
    status: "ativo",
    silencioso: false,
    provincia: "Huambo",
    senha: "gpa2026"
  }
];

// Map commercial name to ID
function getComercialId(nome) {
  const c = officialComerciais.find(com => com.nome.toLowerCase() === (nome || '').toLowerCase());
  return c ? c.id : 'u15';
}

// Convert proposals to CRM Deals
const deals = extractedProposals.map((p, idx) => {
  let etapa = 'proposta';
  const est = (p.estado || p.crmStatus || '').toLowerCase();
  if (est.includes('aprov') || est.includes('ganh')) etapa = 'fechado';
  else if (est.includes('perdid') || est.includes('rejeit')) etapa = 'perdido';
  else if (est.includes('negoc')) etapa = 'negociacao';
  else if (est.includes('produ')) etapa = 'producao';
  else if (est.includes('reuni') || est.includes('visit')) etapa = 'visita';
  else if (est.includes('contat') || est.includes('lead')) etapa = 'lead';

  let prioridade = p.prioridade || 'Normal';
  if (!['Normal', 'Média', 'Alta', 'Baixa'].includes(prioridade)) {
    if (prioridade.toLowerCase().includes('alta')) prioridade = 'Alta';
    else if (prioridade.toLowerCase().includes('méd') || prioridade.toLowerCase().includes('med')) prioridade = 'Média';
    else if (prioridade.toLowerCase().includes('baix')) prioridade = 'Baixa';
    else prioridade = 'Normal';
  }

  return {
    id: `deal_rel_${idx + 1}`,
    clienteNome: p.cliente,
    titulo: p.servico || `Proposta Comercial - ${p.cliente}`,
    valor: p.valorProp,
    valorAprovado: p.valorAprov,
    valorPerdido: p.valorPerd,
    etapa: etapa,
    comercialId: getComercialId(p.gestor),
    comercialNome: p.gestor,
    prioridade: prioridade,
    diasAberto: p.dias || 5,
    observacoes: p.obs,
    dataEnvio: p.dataEnvio,
    semana: p.semana || 'Semana Finda',
    probabilidade: (p.probabilidade * 100).toFixed(0) + '%',
    proximaAcao: p.acao || 'Acompanhamento comercial da proposta',
    proximoContacto: p.contacto || '2026-08-25',
    classeCliente: p.classe || 'B',
    empresa: p.empresa || 'GPA ANGOLA',
    crmStatus: p.crmStatus || (etapa === 'fechado' ? 'Fechado ganho' : (etapa === 'perdido' ? 'Fechado perdido' : 'Aberto'))
  };
});

// Build clients list
const clientsMap = new Map();
deals.forEach(d => {
  if (!clientsMap.has(d.clienteNome)) {
    clientsMap.set(d.clienteNome, {
      id: `cli_${clientsMap.size + 1}`,
      nome: d.clienteNome,
      empresa: d.empresa || 'GPA ANGOLA',
      nif: '541' + Math.floor(100000 + Math.random() * 900000),
      telefone: '92' + Math.floor(1000000 + Math.random() * 8999999),
      provincia: 'Luanda',
      segmento: 'Corporativo',
      status: 'ativo',
      responsavel: d.comercialNome,
      ultimaVisita: d.dataEnvio || '2026-08-10',
      proximaVisita: d.proximoContacto || '2026-08-28',
      historicoVendas: d.valorAprovado || 0
    });
  } else {
    const cli = clientsMap.get(d.clienteNome);
    if (d.valorAprovado) cli.historicoVendas = (cli.historicoVendas || 0) + d.valorAprovado;
  }
});
const clients = Array.from(clientsMap.values());

// Build Base_Duas_Semanas data format for BaseDuasSemanasView
const baseDuasSemanas = extractedProposals.map((p, idx) => ({
  id: idx + 1,
  semana: p.semana || 'Semana Finda',
  dataEnvio: p.dataEnvio,
  cliente: p.cliente,
  servico: p.servico,
  estadoProposta: p.estado,
  valorProposta: p.valorProp ? p.valorProp.toLocaleString('pt-AO') + ' Kz' : '0,00 Kz',
  valorAprovado: p.valorAprov ? p.valorAprov.toLocaleString('pt-AO') + ' Kz' : '0,00 Kz',
  valorPerdido: p.valorPerd ? p.valorPerd.toLocaleString('pt-AO') + ' Kz' : '0,00 Kz',
  probabilidade: p.probabilidade ? (p.probabilidade * 100).toFixed(0) + '%' : '40%',
  gestorComercial: p.gestor,
  proximaAcao: p.acao,
  proximoContacto: p.contacto,
  observacoes: p.obs,
  diasEmAberto: p.dias || 0,
  valorPonderado: (p.valorProp * (p.probabilidade || 0)).toLocaleString('pt-AO') + ' Kz',
  classeCliente: p.classe || 'B',
  prioridade: p.prioridade || 'Normal',
  estadoCRM: p.crmStatus || (p.estado.toLowerCase().includes('aprov') ? 'Fechado ganho' : (p.estado.toLowerCase().includes('perdid') ? 'Fechado perdido' : 'Aberto')),
  empresaGroup: p.empresa || 'GPA ANGOLA'
}));

// Build Weekly Snapshots
const historicoSemanas = [
  {
    id: "sem_jul_w1",
    rotulo: "06–10 Jul 2026",
    mes: "Julho 2026",
    propostas: 29,
    valorTotal: 150282285.88,
    valorAprovado: 19914950,
    valorPerdido: 11779700,
    forecast: 76353142.04,
    conversao: 0.1325,
    visitas: 14
  },
  {
    id: "sem_jul_w2",
    rotulo: "13–17 Jul 2026",
    mes: "Julho 2026",
    propostas: 32,
    valorTotal: 263450431.50,
    valorAprovado: 26762350,
    valorPerdido: 11712075,
    forecast: 123115722.45,
    conversao: 0.1016,
    visitas: 18
  },
  {
    id: "sem_jul_w3",
    rotulo: "20–24 Jul 2026",
    mes: "Julho 2026",
    propostas: 24,
    valorTotal: 259946674.50,
    valorAprovado: 50450557.00,
    valorPerdido: 25869353.00,
    forecast: 121034255.83,
    conversao: 0.1941,
    visitas: 16
  },
  {
    id: "sem_jul_w4",
    rotulo: "27–31 Jul 2026",
    mes: "Julho 2026",
    propostas: 16,
    valorTotal: 100153307.64,
    valorAprovado: 4225680,
    valorPerdido: 0,
    forecast: 50152308.00,
    conversao: 0.0422,
    visitas: 12
  },
  {
    id: "sem_ago_w1",
    rotulo: "03–07 Ago 2026",
    mes: "Agosto 2026",
    propostas: 37,
    valorTotal: 586709914.80,
    valorAprovado: 24712812,
    valorPerdido: 2095320,
    forecast: 229887731.88,
    conversao: 0.0421,
    visitas: 21
  },
  {
    id: "sem_ago_w2",
    rotulo: "10–14 Ago 2026",
    mes: "Agosto 2026",
    propostas: 39,
    valorTotal: 631254212.23,
    valorAprovado: 5949044.59,
    valorPerdido: 19397385.00,
    forecast: 220995706.35,
    conversao: 0.0094,
    visitas: 25
  },
  {
    id: "sem_ago_w3",
    rotulo: "17–21 Ago 2026",
    mes: "Agosto 2026",
    propostas: 66,
    valorTotal: 399761336.36,
    valorAprovado: 44313860.00,
    valorPerdido: 31362263.64,
    forecast: 167430176.13,
    conversao: 0.1109,
    visitas: 30
  }
];

// Build Monthly Snapshots
const historicoMeses = [
  {
    id: "mes_junho_2026",
    mes: "Junho 2026",
    propostas: 113,
    valorProposto: 754845125.74,
    valorAprovado: 57094129.62,
    valorPerdido: 26060058.10,
    taxaConversao: 0.0756,
    pipelinePonderado: 285400190.00,
    semanas: ["01–05 Jun", "08–12 Jun", "15–19 Jun", "22–26 Jun", "29–30 Jun"]
  },
  {
    id: "mes_julho_2026",
    mes: "Julho 2026",
    propostas: 110,
    valorProposto: 773832699.52,
    valorAprovado: 101353537.00,
    valorPerdido: 49361128.00,
    taxaConversao: 0.1310,
    pipelinePonderado: 370655428.32,
    semanas: ["06–10 Jul", "13–17 Jul", "20–24 Jul", "27–31 Jul"]
  },
  {
    id: "mes_agosto_2026",
    mes: "Agosto 2026",
    propostas: 142,
    valorProposto: 1617725463.39,
    valorAprovado: 74975716.59,
    valorPerdido: 52854968.64,
    taxaConversao: 0.0463,
    pipelinePonderado: 618313614.36,
    semanas: ["03–07 Ago", "10–14 Ago", "17–21 Ago", "24–28 Ago"]
  }
];

// Update crm-db.json
let currentDb = {};
try {
  if (fs.existsSync('./crm-db.json')) {
    currentDb = JSON.parse(fs.readFileSync('./crm-db.json', 'utf-8'));
  }
} catch(e) {}

const fullDb = {
  ...currentDb,
  comerciais: officialComerciais,
  deals: deals,
  clients: clients,
  historicoSemanas: historicoSemanas,
  historicoMeses: historicoMeses,
  baseDuasSemanas: baseDuasSemanas,
  lastUpdated: new Date().toISOString()
};

fs.writeFileSync('./crm-db.json', JSON.stringify(fullDb, null, 2), 'utf-8');
console.log('Successfully saved full crm-db.json with ' + deals.length + ' deals and ' + clients.length + ' clients.');

// Also generate TypeScript files for instant permanent loading
const baseDuasSemanasTs = `// DADOS REAIS EXTRAÍDOS DA PASTA RELATORIO CRM GPA (PERMANENTES)
export interface BasePropostaItem {
  id: number;
  semana: string;
  dataEnvio: string;
  cliente: string;
  servico: string;
  estadoProposta: string;
  valorProposta: string;
  valorAprovado: string;
  valorPerdido: string;
  probabilidade: string;
  gestorComercial: string;
  proximaAcao: string;
  proximoContacto: string;
  observacoes: string;
  diasEmAberto: number;
  valorPonderado: string;
  classeCliente: string;
  prioridade: string;
  estadoCRM: string;
  empresaGroup: string;
}

export const baseDuasSemanasData: BasePropostaItem[] = ${JSON.stringify(baseDuasSemanas, null, 2)};
`;

fs.writeFileSync('./src/data/baseDuasSemanasData.ts', baseDuasSemanasTs, 'utf-8');
console.log('Saved src/data/baseDuasSemanasData.ts');

const officialProposalsTs = `// 225+ PROPOSTAS COMERCIAIS REAIS DO RELATORIO CRM GPA
export const officialExcelProposals = ${JSON.stringify(deals, null, 2)};
`;
fs.writeFileSync('./src/data/officialExcelProposals.ts', officialProposalsTs, 'utf-8');
console.log('Saved src/data/officialExcelProposals.ts');

