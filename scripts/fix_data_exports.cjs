import { Usuario, Cliente, Visita, Deal, Guideline, NotificationItem, ActivityFeed, RelatorioDiario, HistoricoSemanal, HistoricoMensal } from "./types";

const fullDb = JSON.parse(fs.readFileSync('./crm-db.json', 'utf-8'));

const dataTsContent = `import { Usuario, Cliente, Visita, Deal, Guideline, NotificationItem, ActivityFeed, RelatorioDiario, HistoricoSemanal, HistoricoMensal } from "./types";

export const initialComerciais: Usuario[] = ${JSON.stringify(fullDb.comerciais, null, 2)};

export const initialClients: Cliente[] = ${JSON.stringify(fullDb.clients, null, 2)};

export const initialVisits: Visita[] = [
  {
    "id": "v_1",
    "clienteNome": "FINSTAR/ZAP",
    "empresa": "FINSTAR/ZAP",
    "comercialNome": "Luísa Baltazar",
    "data": "2026-08-18",
    "hora": "10:00",
    "localizacao": "Luanda",
    "resultado": "Reunião de alinhamento para fornecimento de merchandising",
    "produtos": "T-Shirts e Materiais Promocionais",
    "necessidade": "Necessidade urgente para arranque de campanha"
  },
  {
    "id": "v_2",
    "clienteNome": "ALIANÇA SEGUROS",
    "empresa": "ALIANÇA SEGUROS",
    "comercialNome": "Luísa Baltazar",
    "data": "2026-08-19",
    "hora": "14:30",
    "localizacao": "Luanda",
    "resultado": "Apresentação de proposta de flyers e monofolhas",
    "produtos": "Impressão Gráfica",
    "necessidade": "Renovação de material de activação"
  }
];
export const initialVisitas = initialVisits;

export const initialDeals: Deal[] = ${JSON.stringify(fullDb.deals, null, 2)};

export const initialGuidelines: Guideline[] = [
  {
    "id": 1,
    "acao": "Contacto telefónico / Reunião com Decisor",
    "criterio": "Propostas enviadas com mais de 48h sem retorno",
    "proximoPasso": "Obter validação formal ou agendar reunião de fecho",
    "chipClass": "bg-blue-100 text-blue-800"
  },
  {
    "id": 2,
    "acao": "Revisão Comercial / Negociação Final",
    "criterio": "Propostas em negociação há mais de 7 dias",
    "proximoPasso": "Ajustar condições de pagamento e fechar proposta",
    "chipClass": "bg-amber-100 text-amber-800"
  },
  {
    "id": 3,
    "acao": "Transição para Produção / Entrega",
    "criterio": "Propostas adjudicadas / aprovadas",
    "proximoPasso": "Emitir ordem de produção e acompanhar prazos",
    "chipClass": "bg-emerald-100 text-emerald-800"
  }
];

export const initialNotifications: NotificationItem[] = [
  {
    "id": 1,
    "type": "info",
    "title": "Dados Oficiais do Relatório Carregados",
    "text": "Todos os dados da pasta RELATORIO CRM GPA (225+ propostas, modelos V5.0 e consolidados) foram sincronizados com sucesso.",
    "dataHora": new Date().toISOString()
  }
];

export const initialActivityFeed: ActivityFeed[] = [
  {
    "id": "act_1",
    "tipo": "deal_criado",
    "descricao": "Base de dados oficial sincronizada com o Relatório CRM GPA.",
    "dataHora": new Date().toISOString(),
    "autorNome": "Sistema CRM GPA"
  }
];
export const initialActivities = initialActivityFeed;

export const initialRelatoriosDiarios: RelatorioDiario[] = [
  {
    "id": "rel_dia_1",
    "data": "2026-08-21",
    "semana": "17–21 Ago 2026",
    "comercialNome": "Equipa Comercial GPA",
    "resumoActividades": "Fecho da semana comercial com 66 propostas e 44.3M Kz aprovados.",
    "propostasEnviadas": 66,
    "valorTotalPropostas": 399761336.36,
    "visitasRealizadas": 30,
    "cobrancasPendentes": "Sem pendências críticas.",
    "observacoesGerais": "Cumprimento expressivo com 744% de crescimento em aprovações vs semana anterior.",
    "logsComerciais": []
  }
];

export const initialHistoricoSemanas: HistoricoSemanal[] = ${JSON.stringify(fullDb.historicoSemanas, null, 2)};

export const initialHistoricoMeses: HistoricoMensal[] = ${JSON.stringify(fullDb.historicoMeses, null, 2)};

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading from localStorage', key, e);
  }
  return defaultValue;
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage', key, e);
  }
}
`;

fs.writeFileSync('./src/data.ts', dataTsContent, 'utf-8');
console.log('src/data.ts completely updated.');
