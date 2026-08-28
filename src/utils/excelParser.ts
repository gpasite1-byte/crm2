/**
 * Comprehensive Excel Parser for GPA Angola CRM v8.0 PRO
 * Parses 20+ fields from Excel sheets with Portuguese/Angolan header variations
 * Supports real GPA report headers: "Gestor Comercial", "Estado da Proposta",
 * "Valor de Proposta (Kz)", "Valor Aprovado (Kz)", "Produto/Serviço", etc.
 * Works in both browser and server Node.js environments.
 */

import { parseExcelDate, calculateDaysOpen } from './temporalEngine';
import { Deal, Cliente, Visita, Usuario } from '../types';

export function normalizeHeader(h: string): string {
  if (!h) return '';
  return String(h)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()\/.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseValor(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);
  // Remove currency labels (Kz, AOA, etc.) and whitespace
  let str = String(val)
    .replace(/[Kk][Zz]/g, '')
    .replace(/AOA/gi, '')
    .replace(/\s/g, '')
    .trim();
  // Strip anything that is not a digit, dot, comma, or minus
  str = str.replace(/[^\d.,\-]/g, '');
  if (!str) return 0;

  // Portuguese/Angolan format: 1.385.100,48  →  1385100.48
  const commaIdx = str.lastIndexOf(',');
  const dotIdx   = str.lastIndexOf('.');
  if (commaIdx > dotIdx) {
    // comma is decimal separator → remove dots, replace comma with dot
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  // Standard decimal dot → remove commas (thousands)
  const cleaned = str.replace(/,/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    // Multiple dots used as thousands separators e.g. 1.385.100
    const joined = parts.join('');
    const n = parseFloat(joined);
    return isNaN(n) ? 0 : n;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseEtapa(val: any): Deal['etapa'] {
  const str = normalizeHeader(String(val || ''));
  if (!str) return 'proposta';

  // ── Ganho / Aprovado / Adjudicado ─────────────────────────────────────────
  if (str.includes('adjudic') || str.includes('adjudicad')) return 'fechado';
  if (str.includes('aprovad') || str.includes('aprovada') || str.includes('aprovado')) return 'fechado';
  if (str.includes('fechad') || str.includes('ganha') || str.includes('ganho')) return 'fechado';
  if (str.includes('conclu') || str.includes('executad') || str.includes('entregue')) return 'fechado';
  if (str.includes('adjudicacao')) return 'fechado';

  // ── Perdido / Recusado / Cancelado ─────────────────────────────────────────
  if (str.includes('perdid') || str.includes('rejeit') || str.includes('recusad')) return 'perdido';
  if (str.includes('cancel') || str.includes('desistid') || str.includes('sem sucesso')) return 'perdido';
  if (str.includes('nao adjudic') || str.includes('nao aprovad')) return 'perdido';

  // ── Em Negociação / Em Análise ─────────────────────────────────────────────
  if (str.includes('negoc') || str.includes('negociacao')) return 'negociacao';
  if (str.includes('em analise') || str.includes('analise') || str.includes('avaliacao')) return 'negociacao';
  if (str.includes('em avaliacao') || str.includes('em estudo')) return 'negociacao';

  // ── Produção / Execução ────────────────────────────────────────────────────
  if (str.includes('producao') || str.includes('em producao')) return 'producao';
  if (str.includes('em execucao') || str.includes('execucao') || str.includes('em curso')) return 'producao';

  // ── Visita / Reunião ───────────────────────────────────────────────────────
  if (str.includes('visita') || str.includes('reuniao') || str.includes('encontro')) return 'visita';

  // ── Lead / Prospecção ──────────────────────────────────────────────────────
  if (str.includes('lead') || str.includes('prospecto') || str.includes('potencial')) return 'lead';

  // ── Contacto ───────────────────────────────────────────────────────────────
  if (str.includes('contat') || str.includes('contacto') || str.includes('primeiro contacto')) return 'contato';

  // ── Proposta (default) ─────────────────────────────────────────────────────
  if (str.includes('propost') || str.includes('enviada') || str.includes('submetid')) return 'proposta';

  return 'proposta';
}

export function parsePrioridade(val: any, valor: number): Deal['prioridade'] {
  const str = normalizeHeader(String(val || ''));
  if (str.includes('alt') || str.includes('urgente') || str.includes('critica')) return 'Alta';
  if (str.includes('med') || str.includes('normal')) return 'Média';
  if (str.includes('baix') || str.includes('baixa')) return 'Baixa';

  // Auto-classify by AOA value
  if (valor >= 50000000) return 'Alta';
  if (valor >= 15000000) return 'Alta';
  if (valor >= 5000000) return 'Média';
  return 'Normal';
}

export function parseClasseCliente(val: any): string {
  const str = String(val || '').trim().toUpperCase();
  if (str === 'A' || str === 'B' || str === 'C') return str;
  if (str.includes('ALTO') || str.includes('VIP')) return 'A';
  if (str.includes('MEDIO') || str.includes('MÉDIO')) return 'B';
  return 'C';
}

export interface ParsedExcelDealRow {
  clienteNome: string;
  empresa: string;
  titulo: string;
  valor: number;
  valorAprovado: number;
  valorPerdido: number;
  etapa: Deal['etapa'];
  comercialNome: string;
  prioridade: Deal['prioridade'];
  diasAberto: number;
  semana: string;
  probabilidade: string;
  proximaAcao: string;
  proximoContacto: string;
  observacoes: string;
  observacaoFinal: string;
  dataEnvio: string;
  dataAprovacao: string;
  dataPerda: string;
  classeCliente: string;
  crmStatus: string;
  nif: string;
  telefone: string;
  provincia: string;
  segmento: string;
  numProposta: string;
}

/**
 * Extracts all 20+ fields from any row object parsed from Excel.
 * Supports real GPA Angola report column headers:
 *   "N.º" | "Empresa / Entidade" | "Produto / Serviço" | "Gestor Comercial"
 *   "Valor de Proposta (Kz)" | "Valor Aprovado (Kz)" | "Estado da Proposta"
 *   "Observação Final" | "Semana de Referência" | "Data de Envio"
 */
export function extractFieldsFromRow(row: Record<string, any>, idx: number): ParsedExcelDealRow {
  let clienteNome = '';
  let empresa = '';
  let titulo = '';
  let valor = 0;
  let valorAprovado = 0;
  let valorPerdido = 0;
  let etapaRaw = '';
  let comercialNome = '';
  let prioridadeRaw = '';
  let semana = '';
  let probabilidade = '';
  let proximaAcao = '';
  let proximoContacto = '';
  let observacoes = '';
  let dataEnvioRaw: any = null;
  let dataAprovacaoRaw: any = null;
  let dataPerdaRaw: any = null;
  let classeClienteRaw = '';
  let crmStatus = '';
  let nif = '';
  let telefone = '';
  let provincia = '';
  let segmento = '';

  Object.keys(row).forEach(key => {
    const norm = normalizeHeader(key);
    const val = row[key];
    if (val === undefined || val === null || val === '') return;
    const valStr = String(val).trim();

    // ── EMPRESA / CLIENTE / ENTIDADE ──────────────────────────────────────────
    if (
      norm.includes('empresa entidade') || norm.includes('empresa') ||
      norm.includes('entidade') || norm.includes('razao social') ||
      norm.includes('firma') || norm.includes('cliente') ||
      norm.includes('nome cliente') || norm.includes('nome da empresa')
    ) {
      if (!empresa) empresa = valStr;
      if (!clienteNome) clienteNome = valStr;

    // ── PRODUTO / SERVIÇO / TÍTULO ────────────────────────────────────────────
    } else if (
      norm.includes('produto servico') || norm.includes('produto ou servico') ||
      norm.includes('produto') || norm.includes('servico') ||
      norm.includes('titulo') || norm.includes('descricao') ||
      norm.includes('negocio') || norm.includes('objeto') ||
      norm.includes('assunto') || norm.includes('tipo de servico') ||
      norm.includes('fornecimento')
    ) {
      if (!titulo) titulo = valStr;

    // ── VALOR APROVADO (verificar ANTES do valor genérico) ────────────────────
    } else if (
      norm.includes('valor aprovad') || norm.includes('receita aprovad') ||
      norm.includes('total aprovad') || norm.includes('montante aprovad') ||
      norm.includes('valor ganho') || norm.includes('receita ganha') ||
      norm === 'aprovado' || norm === 'receita'
    ) {
      const v = parseValor(val);
      if (v > 0) valorAprovado = v;

    // ── VALOR PERDIDO ─────────────────────────────────────────────────────────
    } else if (
      norm.includes('valor perdid') || norm.includes('total perdid') ||
      norm.includes('montante perdid') || norm.includes('valor rejeit') ||
      norm === 'perdido'
    ) {
      const v = parseValor(val);
      if (v > 0) valorPerdido = v;

    // ── VALOR DE PROPOSTA / VALOR TOTAL ───────────────────────────────────────
    } else if (
      norm.includes('valor de proposta') || norm.includes('valor proposta') ||
      norm.includes('valor total proposto') || norm.includes('total proposto') ||
      (norm.includes('valor') && !norm.includes('aprovad') && !norm.includes('perdid')) ||
      norm.includes('montante') || norm.includes('preco') ||
      (norm.includes('total') && !norm.includes('aprovad') && !norm.includes('perdid')) ||
      norm === 'kz' || norm === 'aoa'
    ) {
      const v = parseValor(val);
      if (!valor && v > 0) valor = v;

    // ── ESTADO DA PROPOSTA / ETAPA ────────────────────────────────────────────
    } else if (
      norm.includes('estado da proposta') || norm.includes('estado proposta') ||
      norm.includes('estado') || norm.includes('etapa') ||
      norm.includes('status') || norm.includes('fase') ||
      norm.includes('situacao') || norm.includes('situacao da proposta')
    ) {
      if (!etapaRaw) etapaRaw = valStr;

    // ── GESTOR COMERCIAL / VENDEDOR ───────────────────────────────────────────
    } else if (
      norm.includes('gestor comercial') || norm.includes('gestor') ||
      norm.includes('vendedor') || norm.includes('comercial') ||
      norm.includes('responsavel') || norm.includes('colaborador') ||
      norm.includes('agente comercial') || norm.includes('rep comercial')
    ) {
      if (!comercialNome) comercialNome = valStr;

    // ── PRIORIDADE ────────────────────────────────────────────────────────────
    } else if (norm.includes('priorid')) {
      prioridadeRaw = valStr;

    // ── SEMANA / PERÍODO ──────────────────────────────────────────────────────
    } else if (
      norm.includes('semana de referencia') || norm.includes('semana ref') ||
      norm.includes('semana') || norm.includes('periodo') || norm === 'week'
    ) {
      if (!semana) semana = valStr;

    // ── PROBABILIDADE ─────────────────────────────────────────────────────────
    } else if (norm.includes('probabilid') || norm.includes('chance') || norm.includes('perc')) {
      probabilidade = valStr.includes('%') ? valStr : `${parseValor(val)}%`;

    // ── PRÓXIMA AÇÃO ──────────────────────────────────────────────────────────
    } else if (
      norm.includes('proxima acao') || norm.includes('proximo passo') ||
      norm.includes('acao a tomar') || norm.includes('proxima ac') ||
      norm.includes('follow up') || norm.includes('acompanhamento')
    ) {
      if (!proximaAcao) proximaAcao = valStr;

    // ── PRÓXIMO CONTACTO ──────────────────────────────────────────────────────
    } else if (
      norm.includes('proximo contac') || norm.includes('data contac') ||
      norm.includes('data de contacto') || norm.includes('data reuniao')
    ) {
      const p = parseExcelDate(val);
      if (!proximoContacto) proximoContacto = p.pt || valStr;

    // ── OBSERVAÇÃO FINAL (prioridade sobre obs genérico) ──────────────────────
    } else if (
      norm.includes('observacao final') || norm.includes('obs final') ||
      norm.includes('nota final') || norm.includes('comentario final') ||
      norm.includes('conclusao')
    ) {
      if (!observacaoFinal) observacaoFinal = valStr;

    // ── OBSERVAÇÕES GERAIS ────────────────────────────────────────────────────
    } else if (
      norm.includes('obs') || norm.includes('nota') || norm.includes('comentar') ||
      norm.includes('observaca') || norm.includes('descricao adicional') ||
      norm.includes('informacao adicional') || norm.includes('detalhe')
    ) {
      if (!observacoes) observacoes = valStr;

    // ── DATA DE APROVAÇÃO ─────────────────────────────────────────────────────
    } else if (
      norm.includes('data aprov') || norm.includes('data ganho') ||
      norm.includes('data adjudicacao') || norm.includes('data fechado')
    ) {
      dataAprovacaoRaw = val;

    // ── DATA DE PERDA ─────────────────────────────────────────────────────────
    } else if (
      norm.includes('data perd') || norm.includes('data rejei') ||
      norm.includes('data cancel')
    ) {
      dataPerdaRaw = val;

    // ── DATA DE ENVIO / PROPOSTA ──────────────────────────────────────────────
    } else if (
      norm.includes('data de envio') || norm.includes('data envio') ||
      norm.includes('data proposta') || norm.includes('data registo') ||
      norm.includes('data de submissao') || norm.includes('data submissao') ||
      norm === 'data'
    ) {
      if (!dataEnvioRaw) dataEnvioRaw = val;

    // ── CLASSE DE CLIENTE ─────────────────────────────────────────────────────
    } else if (
      norm.includes('classe') || norm.includes('classificac') ||
      norm.includes('segmento cliente') || norm.includes('tipo cliente')
    ) {
      classeClienteRaw = valStr;

    // ── NIF ───────────────────────────────────────────────────────────────────
    } else if (norm === 'nif' || norm.includes('nif') || norm.includes('numero fiscal')) {
      nif = valStr;

    // ── TELEFONE ──────────────────────────────────────────────────────────────
    } else if (
      norm.includes('tel') || norm.includes('telemovel') ||
      norm.includes('telefone') || norm.includes('fone') ||
      norm.includes('contacto telefonico')
    ) {
      telefone = valStr;

    // ── PROVÍNCIA / LOCALIZAÇÃO ───────────────────────────────────────────────
    } else if (
      norm.includes('provinc') || norm.includes('localizac') ||
      norm.includes('cidade') || norm.includes('municipio') ||
      norm.includes('local') || norm.includes('regiao')
    ) {
      if (!provincia) provincia = valStr;

    // ── SEGMENTO / SECTOR ─────────────────────────────────────────────────────
    } else if (
      norm.includes('segment') || norm.includes('setor') ||
      norm.includes('area de negocio') || norm.includes('industria') ||
      norm.includes('ramo') || norm.includes('area')
    ) {
      if (!segmento) segmento = valStr;
    }
  });

  // ── DEFAULTS E FALLBACKS ───────────────────────────────────────────────────
  if (!clienteNome && !empresa) {
    clienteNome = `Cliente Excel #${idx + 1}`;
    empresa = clienteNome;
  }
  if (!clienteNome) clienteNome = empresa;
  if (!empresa) empresa = clienteNome;
  if (!titulo) titulo = `Proposta Comercial – ${clienteNome}`;

  const parsedEnvio = parseExcelDate(dataEnvioRaw);
  const parsedAprov = parseExcelDate(dataAprovacaoRaw);
  const parsedPerda = parseExcelDate(dataPerdaRaw);

  const dataEnvio = parsedEnvio.pt || '';
  const dataAprovacao = parsedAprov.pt || '';
  const dataPerda = parsedPerda.pt || '';

  const etapa = parseEtapa(etapaRaw);
  const prioridade = parsePrioridade(prioridadeRaw, valor);
  const classeCliente = parseClasseCliente(classeClienteRaw);

  if (etapa === 'fechado' && valorAprovado === 0) {
    valorAprovado = valor;
  }
  if (etapa === 'perdido' && valorPerdido === 0) {
    valorPerdido = valor;
  }

  // CRM status — linguagem dos relatórios reais GPA Angola
  if (etapa === 'fechado') crmStatus = 'Aprovada / Adjudicada';
  else if (etapa === 'perdido') crmStatus = 'Perdida / Recusada';
  else if (etapa === 'negociacao') crmStatus = 'Em Negociação';
  else if (etapa === 'producao') crmStatus = 'Em Produção / Execução';
  else if (etapa === 'visita') crmStatus = 'Visita / Reunião Agendada';
  else if (etapa === 'lead') crmStatus = 'Lead / Prospecção';
  else if (etapa === 'contato') crmStatus = 'Primeiro Contacto';
  else crmStatus = 'Proposta Enviada / Em Análise';

  const diasAberto = calculateDaysOpen(dataEnvio);

  // Probabilidade padrão por etapa
  let probDefault = '50%';
  if (etapa === 'fechado') probDefault = '100%';
  else if (etapa === 'perdido') probDefault = '0%';
  else if (etapa === 'negociacao') probDefault = '60%';
  else if (etapa === 'producao') probDefault = '80%';
  else if (etapa === 'proposta') probDefault = '40%';

  return {
    clienteNome,
    empresa,
    titulo,
    valor,
    valorAprovado,
    valorPerdido,
    etapa,
    comercialNome: comercialNome || 'David Neto',
    prioridade,
    diasAberto,
    semana: semana || 'Esta Semana',
    probabilidade: probabilidade || probDefault,
    proximaAcao: proximaAcao || 'Acompanhamento e seguimento do processo',
    proximoContacto: proximoContacto || dataEnvio,
    observacoes: observacoes || 'Importado via ficheiro Excel',
    observacaoFinal: observacaoFinal || observacoes || 'Dados importados via Excel',
    dataEnvio,
    dataAprovacao,
    dataPerda,
    classeCliente,
    crmStatus,
    nif,
    telefone,
    provincia: provincia || 'Luanda',
    segmento: segmento || 'Geral',
    numProposta: `#${idx + 1}`
  };
}
