const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const rootDir = path.resolve(__dirname, '..');

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#769;/g, '')
    .replace(/&#768;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlTable(html) {
  const rows = [];
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const row = [];
    const cellMatches = tr.match(/<(?:td|th)[^>]*>[\s\S]*?<\/(?:td|th)>/gi) || [];
    for (const c of cellMatches) {
      row.push(cleanText(c));
    }
    if (row.length > 0 && row.some(cell => cell !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

// Reports configuration
const reportSources = [
  {
    name: '24 a 28 de Agosto 2026',
    weekLabel: '24–28 Ago 2026',
    defaultDate: '2026-08-24',
    dir: path.join(rootDir, 'RELATORIO CRM GPA', 'RELATÓRIO COMERCIAL - 24 À 28 DE AGOSTO DE 2026 - Dashboard_Comercial_Grupo_GPA_V5_ficheiros'),
    sheets: { base: 'sheet002.htm', crm: 'sheet004.htm', comp: 'sheet005.htm', metas: 'sheet003.htm' }
  },
  {
    name: '17 a 21 de Agosto 2026 (10-14 Ago a 17-21 Ago)',
    weekLabel: '17–21 Ago 2026',
    defaultDate: '2026-08-17',
    dir: path.join(rootDir, 'RELATORIO CRM GPA', '10-14 Ago a 17-21 Ago', 'RELATÓRIO_COMERCIAL_17_A_21_AGOSTO_2026_DASHBOARD_V5_ACTUALIZADO_ficheiros'),
    sheets: { base: 'sheet002.htm', crm: 'sheet004.htm', comp: 'sheet005.htm', metas: 'sheet003.htm' }
  },
  {
    name: '10 a 14 de Agosto 2026 (03-07 Ago a 10-14 Ago)',
    weekLabel: '10–14 Ago 2026',
    defaultDate: '2026-08-10',
    dir: path.join(rootDir, 'RELATORIO CRM GPA', '03-07 Ago a 10-14 ago', 'RELATÓRIO COMERCIAL - 10 À 14 DE AGOSTO DE 2026 Dashboard_Comercial_Grupo_GPA_V5_Actualizado (1)_ficheiros'),
    sheets: { base: 'sheet002.htm', crm: 'sheet004.htm', comp: 'sheet005.htm', metas: 'sheet003.htm' }
  },
  {
    name: '03 a 07 de Agosto 2026 (27-31 Jul a 03-07 Ago)',
    weekLabel: '03–07 Ago 2026',
    defaultDate: '2026-08-03',
    dir: path.join(rootDir, 'RELATORIO CRM GPA', '27–31 Jul a 03–07 Ago', 'Dashboard_Comercial_Grupo_GPA_V5_Actualizado (2) (2)_ficheiros'),
    sheets: { base: 'sheet002.htm', crm: 'sheet004.htm', comp: 'sheet005.htm', metas: 'sheet003.htm' }
  },
  {
    name: 'Consolidado Mes de Julho 2026',
    weekLabel: 'Julho 2026',
    defaultDate: '2026-07-27',
    dir: path.join(rootDir, 'RELATORIO CRM GPA', 'Relatorio de mes de Julho', 'RELATÓRIO DE CONSOLIDADO - MÊS DE  JULHO DE 2026_ficheiros'),
    sheets: { base: 'sheet003.htm', comp: 'sheet005.htm' }
  },
  {
    name: '13 a 17 de Julho 2026 (06-10 Jul a 13-17 Jul)',
    weekLabel: '13–17 Jul 2026',
    defaultDate: '2026-07-13',
    dir: path.join(rootDir, 'RELATORIO CRM GPA', '06–10 Jul a 13–17 Jul', 'Cópia de Analise_Critica_Comercial_13-17_Julho_2026 (1)_ficheiros'),
    sheets: { base: 'sheet002.htm', crm: 'sheet004.htm', comp: 'sheet005.htm', metas: 'sheet003.htm' }
  }
];

const extractedDeals = [];
const comparativeSummaries = [];

// Commercials ID map
const commercialMap = {
  'luisa': { id: 'u15', nome: 'Luísa Baltazar' },
  'luísa': { id: 'u15', nome: 'Luísa Baltazar' },
  'amelia': { id: 'u1', nome: 'Amélia Cassinda' },
  'amélia': { id: 'u1', nome: 'Amélia Cassinda' },
  'marta': { id: 'u5', nome: 'Marta de Oliveira' },
  'jose': { id: 'u4', nome: 'José Neto' },
  'josé': { id: 'u4', nome: 'José Neto' },
  'david guedes': { id: 'u2', nome: 'David Guedes' },
  'guedes': { id: 'u2', nome: 'David Guedes' },
  'ilidio': { id: 'u6', nome: 'Ilídio Pedro' },
  'ilídio': { id: 'u6', nome: 'Ilídio Pedro' },
  'fernando': { id: 'u3', nome: 'Fernando Leite' },
  'carlos': { id: 'u8', nome: 'Carlos Francisco' },
  'david neto': { id: 'u9', nome: 'David Neto' },
  'suzete': { id: 'u16', nome: 'Suzete Francisco' }
};

function getCommercial(name) {
  if (!name) return { id: 'u9', nome: 'David Neto' };
  const lower = name.toLowerCase();
  for (const k of Object.keys(commercialMap)) {
    if (lower.includes(k)) return commercialMap[k];
  }
  return { id: 'u9', nome: name };
}

reportSources.forEach((src, srcIdx) => {
  console.log(`\n======================================================`);
  console.log(`Processing: ${src.name}`);
  console.log(`Directory: ${src.dir}`);
  
  if (!fs.existsSync(src.dir)) {
    console.warn(`Directory not found: ${src.dir}`);
    return;
  }

  // Parse Comparativo sheet
  if (src.sheets.comp) {
    const compFile = path.join(src.dir, src.sheets.comp);
    if (fs.existsSync(compFile)) {
      try {
        const html = fs.readFileSync(compFile, 'latin1');
        const rows = parseHtmlTable(html);
        comparativeSummaries.push({
          source: src.name,
          file: compFile,
          rows: rows
        });
        console.log(`Parsed Comparativo sheet: ${rows.length} rows`);
      } catch (e) {
        console.error(`Error reading comp sheet:`, e.message);
      }
    }
  }

  // Parse Base sheet
  if (src.sheets.base) {
    const baseFile = path.join(src.dir, src.sheets.base);
    if (fs.existsSync(baseFile)) {
      try {
        const html = fs.readFileSync(baseFile, 'latin1');
        const rows = parseHtmlTable(html);
        console.log(`Parsed Base sheet: ${rows.length} rows`);

        // Find header row
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const rText = rows[i].join(' ').toLowerCase();
          if (rText.includes('cliente') || rText.includes('empresa') || rText.includes('serviço') || rText.includes('servico') || rText.includes('proposta')) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx !== -1) {
          const headers = rows[headerRowIdx].map(h => h.toLowerCase().trim());
          console.log(`Found headers at row ${headerRowIdx}:`, headers);

          const getColVal = (row, keywords) => {
            for (const kw of keywords) {
              const idx = headers.findIndex(h => h.includes(kw));
              if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') {
                return String(row[idx]).trim();
              }
            }
            return '';
          };

          for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.every(c => c === '')) continue;

            const cliente = getColVal(row, ['cliente', 'empresa / cliente', 'entidade']);
            const servico = getColVal(row, ['serviço', 'servico', 'produto / serviço', 'descrição', 'proposta', 'título']);
            const gestor = getColVal(row, ['gestor', 'comercial', 'responsável']);
            const valProposta = parseNumber(getColVal(row, ['valor de proposta', 'valor da proposta', 'valor proposta', 'valor (kz)', 'valor total', 'montante']));
            const valAprovado = parseNumber(getColVal(row, ['valor aprovado', 'aprovado']));
            const valPerdido = parseNumber(getColVal(row, ['valor perdido', 'perdido']));
            const estado = getColVal(row, ['estado', 'status', 'situação', 'resultado', 'crm status']);
            const prioridade = getColVal(row, ['prioridade']) || 'Normal';
            const semanaCol = getColVal(row, ['semana', 'período', 'periodo']);
            const dataEnvioCol = getColVal(row, ['data de envio', 'data envio', 'data']);
            const proximaAcao = getColVal(row, ['próxima acção', 'proxima acao', 'próxima ação', 'acção']);
            const proximoContacto = getColVal(row, ['próximo contacto', 'proximo contacto', 'contacto']);
            const observacoes = getColVal(row, ['observações', 'observacoes', 'ponto de situação']);
            const diasEmAberto = parseInt(getColVal(row, ['dias em aberto', 'dias']), 10) || 5;

            if (!cliente && !servico && valProposta === 0) continue;

            // Determine stage
            const estLower = (estado || '').toLowerCase();
            let etapa = 'proposta';
            if (estLower.includes('aprov') || estLower.includes('fechad') || estLower.includes('ganh') || estLower.includes('adjudic')) etapa = 'fechado';
            else if (estLower.includes('perdid') || estLower.includes('recus') || estLower.includes('rejeit')) etapa = 'perdido';
            else if (estLower.includes('negoc')) etapa = 'negociacao';
            else if (estLower.includes('produc') || estLower.includes('produç')) etapa = 'producao';
            else if (estLower.includes('visit') || estLower.includes('reuni')) etapa = 'visita';

            // Determine date
            let finalDate = src.defaultDate;
            if (dataEnvioCol && dataEnvioCol.match(/\d{4}-\d{2}-\d{2}/)) {
              finalDate = dataEnvioCol;
            } else if (dataEnvioCol && dataEnvioCol.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/)) {
              const p = dataEnvioCol.split(/[\/\-]/);
              finalDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            }

            const commObj = getCommercial(gestor);

            const dealId = `d_rep_${srcIdx}_${r}`;

            extractedDeals.push({
              id: dealId,
              clienteNome: cliente || 'Cliente ' + r,
              empresa: cliente || 'GPA Angola',
              titulo: servico || 'Proposta Comercial ' + r,
              valor: valProposta || (etapa === 'fechado' ? valAprovado : 0),
              valorAprovado: etapa === 'fechado' ? (valAprovado || valProposta) : valAprovado,
              valorPerdido: etapa === 'perdido' ? (valPerdido || valProposta) : valPerdido,
              etapa: etapa,
              comercialId: commObj.id,
              comercialNome: commObj.nome,
              prioridade: prioridade || 'Normal',
              diasAberto: diasEmAberto,
              observacoes: observacoes,
              dataEnvio: finalDate,
              semana: semanaCol || src.weekLabel,
              probabilidade: etapa === 'fechado' ? '100%' : etapa === 'perdido' ? '0%' : etapa === 'negociacao' ? '60%' : '40%',
              proximaAcao: proximaAcao || 'Acompanhamento da proposta comercial',
              proximoContacto: proximoContacto || finalDate,
              classeCliente: 'B',
              crmStatus: estado || (etapa === 'fechado' ? 'Fechado ganho' : etapa === 'perdido' ? 'Fechado perdido' : 'Aberto'),
              sourceReport: src.name
            });
          }
        }
      } catch (e) {
        console.error(`Error reading base sheet:`, e.message);
      }
    }
  }
});

console.log(`\nExtracted ${extractedDeals.length} deals total across all report sources!`);
console.log(`Extracted ${comparativeSummaries.length} comparative summaries.`);

fs.writeFileSync(path.join(rootDir, 'scratch_extracted_deals.json'), JSON.stringify(extractedDeals, null, 2), 'utf-8');
fs.writeFileSync(path.join(rootDir, 'scratch_comparative_summaries.json'), JSON.stringify(comparativeSummaries, null, 2), 'utf-8');
