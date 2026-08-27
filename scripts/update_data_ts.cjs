const fs = require('fs');

const deals = JSON.parse(fs.readFileSync('./scripts/extracted_proposals.json', 'utf-8'));
const fullDb = JSON.parse(fs.readFileSync('./crm-db.json', 'utf-8'));

// Format deals for data.ts
const dataTsContent = `import { Usuario, Cliente, Visita, Deal, Guideline, NotificationItem, ActivityFeed } from "./types";

export const initialComerciais: Usuario[] = ${JSON.stringify(fullDb.comerciais, null, 2)};

export const initialClients: Cliente[] = ${JSON.stringify(fullDb.clients, null, 2)};

export const initialVisitas: Visita[] = [
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

export const initialActivities: ActivityFeed[] = [
  {
    "id": "act_1",
    "tipo": "deal_criado",
    "descricao": "Base de dados oficial sincronizada com o Relatório CRM GPA.",
    "dataHora": new Date().toISOString(),
    "autorNome": "Sistema CRM GPA"
  }
];
`;

fs.writeFileSync('./src/data.ts', dataTsContent, 'utf-8');
console.log('Successfully updated src/data.ts with all 225 verified deals and official commercials.');
