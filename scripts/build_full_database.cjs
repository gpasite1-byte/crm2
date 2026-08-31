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

const commercialMap = {
  'luisa': { id: 'u15', nome: 'Luísa Baltazar', email: 'luisa.baltazar@gpaangola.co.ao', provincia: 'Luanda' },
  'luísa': { id: 'u15', nome: 'Luísa Baltazar', email: 'luisa.baltazar@gpaangola.co.ao', provincia: 'Luanda' },
  'amelia': { id: 'u1', nome: 'Amélia Cassinda', email: 'amelia.cassinda@gpaangola.co.ao', provincia: 'Luanda' },
  'amélia': { id: 'u1', nome: 'Amélia Cassinda', email: 'amelia.cassinda@gpaangola.co.ao', provincia: 'Luanda' },
  'marta': { id: 'u5', nome: 'Marta de Oliveira', email: 'marta.graca@gpaangola.co.ao', provincia: 'Benguela' },
  'jose': { id: 'u4', nome: 'José Neto', email: 'jose.neto@gpaangola.co.ao', provincia: 'Luanda' },
  'josé': { id: 'u4', nome: 'José Neto', email: 'jose.neto@gpaangola.co.ao', provincia: 'Luanda' },
  'david guedes': { id: 'u2', nome: 'David Guedes', email: 'david.guedes@gpaangola.co.ao', provincia: 'Cabinda' },
  'guedes': { id: 'u2', nome: 'David Guedes', email: 'david.guedes@gpaangola.co.ao', provincia: 'Cabinda' },
  'ilidio': { id: 'u6', nome: 'Ilídio Pedro', email: 'ilidio.pedro@gpaangola.co.ao', provincia: 'Luanda' },
  'ilídio': { id: 'u6', nome: 'Ilídio Pedro', email: 'ilidio.pedro@gpaangola.co.ao', provincia: 'Luanda' },
  'fernando': { id: 'u3', nome: 'Fernando Leite', email: 'fernando.leite@gpaangola.co.ao', provincia: 'Huambo' },
  'carlos': { id: 'u8', nome: 'Carlos Francisco', email: 'carlos.francisco@gpaangola.co.ao', provincia: 'Luanda' },
  'david neto': { id: 'u9', nome: 'David Neto', email: 'david.neto@gpaangola.co.ao', provincia: 'Luanda' },
  'suzete': { id: 'u16', nome: 'Suzete Francisco', email: 'suzete.francisco@gpaangola.co.ao', provincia: 'Luanda' }
};

function getCommercial(name) {
  if (!name) return { id: 'u9', nome: 'David Neto', email: 'david.neto@gpaangola.co.ao', provincia: 'Luanda' };
  const lower = name.toLowerCase();
  for (const k of Object.keys(commercialMap)) {
    if (lower.includes(k)) return commercialMap[k];
  }
  return { id: 'u9', nome: name, email: 'comercial@gpaangola.co.ao', provincia: 'Luanda' };
}

// Function to extract deals from a raw table
function extractDealsFromTable(rows, sourceName, weekLabel, defaultDate) {
  const deals = [];
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const rText = rows[i].join(' ').toLowerCase();
    if (rText.includes('cliente') || rText.includes('empresa') || rText.includes('serviço') || rText.includes('servico') || rText.includes('proposta')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) return deals;

  const headers = rows[headerRowIdx].map(h => String(h || '').toLowerCase().trim());

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

    const cliente = getColVal(row, ['cliente', 'empresa / cliente', 'entidade', 'empresa / entidade', 'empresa']);
    const servico = getColVal(row, ['serviço', 'servico', 'produto / serviço', 'produto', 'descrição', 'proposta', 'título']);
    const gestor = getColVal(row, ['gestor', 'comercial', 'responsável', 'gestor comercial']);
    const valProposta = parseNumber(getColVal(row, ['valor de proposta', 'valor da proposta', 'valor proposta', 'valor (kz)', 'valor total', 'montante', 'valor']));
    const valAprovado = parseNumber(getColVal(row, ['valor aprovado', 'aprovado']));
    const valPerdido = parseNumber(getColVal(row, ['valor perdido', 'perdido']));
    const estado = getColVal(row, ['estado', 'status', 'situação', 'resultado', 'crm status', 'estado da proposta']);
    const prioridade = getColVal(row, ['prioridade']) || (valProposta > 5000000 ? 'Alta' : 'Normal');
    const semanaCol = getColVal(row, ['semana', 'período', 'periodo']);
    const dataEnvioCol = getColVal(row, ['data de envio', 'data envio', 'data']);
    const proximaAcao = getColVal(row, ['próxima acção', 'proxima acao', 'próxima ação', 'acção']);
    const proximoContacto = getColVal(row, ['próximo contacto', 'proximo contacto', 'contacto']);
    const observacoes = getColVal(row, ['observações', 'observacoes', 'ponto de situação']);
    const diasEmAberto = parseInt(getColVal(row, ['dias em aberto', 'dias']), 10) || 3;

    if (!cliente && !servico && valProposta === 0) continue;
    if (cliente && (/^\d+$/.test(cliente) || cliente.toLowerCase().includes('total') || cliente.toLowerCase().includes('meta'))) continue;
    if (servico && /^\d+$/.test(servico) && valProposta === 0) continue;

    // Determine stage
    const estLower = (estado || '').toLowerCase();
    let etapa = 'proposta';
    if (estLower.includes('aprov') || estLower.includes('fechad') || estLower.includes('ganh') || estLower.includes('adjudic')) etapa = 'fechado';
    else if (estLower.includes('perdid') || estLower.includes('recus') || estLower.includes('rejeit')) etapa = 'perdido';
    else if (estLower.includes('negoc')) etapa = 'negociacao';
    else if (estLower.includes('produc') || estLower.includes('produç')) etapa = 'producao';
    else if (estLower.includes('visit') || estLower.includes('reuni')) etapa = 'visita';

    // Parse date
    let finalDate = defaultDate;
    if (dataEnvioCol && dataEnvioCol.match(/^\d{4}-\d{2}-\d{2}$/)) {
      finalDate = dataEnvioCol;
    } else if (dataEnvioCol && dataEnvioCol.match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/)) {
      const p = dataEnvioCol.split(/[\/\-\.]/);
      finalDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }

    // Sanity check year to prevent invalid 8744
    if (finalDate) {
      const parts = finalDate.split('-');
      if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        if (yr < 2025 || yr > 2028) {
          finalDate = `2026-${parts[1] || '08'}-${parts[2] || '24'}`;
        }
      }
    }

    const commObj = getCommercial(gestor);
    const cleanSource = sourceName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
    const dealId = `d_${cleanSource}_${r}`;

    deals.push({
      id: dealId,
      clienteNome: cliente || 'Cliente ' + r,
      empresa: cliente || 'GPA Angola',
      titulo: servico || (cliente ? `Fornecimento / Serviços para ${cliente}` : `Proposta Comercial ${r}`),
      valor: valProposta || (etapa === 'fechado' ? valAprovado : 0),
      valorAprovado: etapa === 'fechado' ? (valAprovado || valProposta) : valAprovado,
      valorPerdido: etapa === 'perdido' ? (valPerdido || valProposta) : valPerdido,
      etapa: etapa,
      comercialId: commObj.id,
      comercialNome: commObj.nome,
      prioridade: prioridade || 'Normal',
      diasAberto: diasEmAberto,
      observacoes: observacoes || 'Registo importado do relatório oficial',
      dataEnvio: finalDate,
      dataAprovacao: etapa === 'fechado' ? finalDate : undefined,
      dataPerda: etapa === 'perdido' ? finalDate : undefined,
      semana: semanaCol || weekLabel,
      probabilidade: etapa === 'fechado' ? 100 : etapa === 'perdido' ? 0 : etapa === 'negociacao' ? 60 : 40,
      proximaAcao: proximaAcao || 'Acompanhamento comercial da proposta',
      proximoContacto: proximoContacto || finalDate,
      classeCliente: 'B',
      crmStatus: estado || (etapa === 'fechado' ? 'Fechado ganho' : etapa === 'perdido' ? 'Fechado perdido' : 'Aberto'),
      sourceReport: sourceName
    });
  }

  return deals;
}

// 1. Scan and parse all HTML and Excel reports
const allDeals = [];
const allClients = new Map();

// Helper to add/merge clients
function registerClient(d) {
  const name = (d.empresa || d.clienteNome || '').trim();
  if (!name || allClients.has(name.toLowerCase())) return;
  const comm = getCommercial(d.comercialNome);
  allClients.set(name.toLowerCase(), {
    id: `c_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}`,
    nome: name,
    empresa: name,
    nif: '5417' + Math.floor(100000 + Math.random() * 900000),
    telefone: '+244 923 ' + Math.floor(100000 + Math.random() * 900000),
    provincia: comm.provincia || 'Luanda',
    segmento: 'Corporativo',
    status: 'ativo',
    responsavel: comm.id,
    ultimaVisita: d.dataEnvio || '2026-08-24',
    proximaVisita: '2026-09-05',
    endereco: `${comm.provincia || 'Luanda'}, Angola`
  });
}

// Extract from each known week folder
const sources = [
  {
    name: 'Relatorio_24_28_Ago_2026',
    weekLabel: '24–28 Ago 2026',
    defaultDate: '2026-08-24',
    htmlDir: path.join(rootDir, 'RELATORIO CRM GPA', 'RELATÓRIO COMERCIAL - 24 À 28 DE AGOSTO DE 2026 - Dashboard_Comercial_Grupo_GPA_V5_ficheiros'),
    htmlSheets: ['sheet002.htm', 'sheet004.htm']
  },
  {
    name: 'Relatorio_17_21_Ago_2026',
    weekLabel: '17–21 Ago 2026',
    defaultDate: '2026-08-17',
    htmlDir: path.join(rootDir, 'RELATORIO CRM GPA', '10-14 Ago a 17-21 Ago', 'RELATÓRIO_COMERCIAL_17_A_21_AGOSTO_2026_DASHBOARD_V5_ACTUALIZADO_ficheiros'),
    htmlSheets: ['sheet002.htm', 'sheet004.htm']
  },
  {
    name: 'Relatorio_10_14_Ago_2026',
    weekLabel: '10–14 Ago 2026',
    defaultDate: '2026-08-10',
    htmlDir: path.join(rootDir, 'RELATORIO CRM GPA', '03-07 Ago a 10-14 ago', 'RELATÓRIO COMERCIAL - 10 À 14 DE AGOSTO DE 2026 Dashboard_Comercial_Grupo_GPA_V5_Actualizado (1)_ficheiros'),
    htmlSheets: ['sheet002.htm', 'sheet004.htm']
  },
  {
    name: 'Relatorio_03_07_Ago_2026',
    weekLabel: '03–07 Ago 2026',
    defaultDate: '2026-08-03',
    htmlDir: path.join(rootDir, 'RELATORIO CRM GPA', '27–31 Jul a 03–07 Ago', 'Dashboard_Comercial_Grupo_GPA_V5_Actualizado (2) (2)_ficheiros'),
    htmlSheets: ['sheet002.htm', 'sheet004.htm']
  },
  {
    name: 'Relatorio_Consolidado_Julho_2026',
    weekLabel: '27–31 Jul 2026',
    defaultDate: '2026-07-27',
    htmlDir: path.join(rootDir, 'RELATORIO CRM GPA', 'Relatorio de mes de Julho', 'RELATÓRIO DE CONSOLIDADO - MÊS DE  JULHO DE 2026_ficheiros'),
    htmlSheets: ['sheet003.htm', 'sheet004.htm']
  },
  {
    name: 'Relatorio_13_17_Jul_2026',
    weekLabel: '13–17 Jul 2026',
    defaultDate: '2026-07-13',
    htmlDir: path.join(rootDir, 'RELATORIO CRM GPA', '06–10 Jul a 13–17 Jul', 'Cópia de Analise_Critica_Comercial_13-17_Julho_2026 (1)_ficheiros'),
    htmlSheets: ['sheet002.htm', 'sheet004.htm']
  }
];

sources.forEach(src => {
  if (fs.existsSync(src.htmlDir)) {
    src.htmlSheets.forEach(sheetFile => {
      const full = path.join(src.htmlDir, sheetFile);
      if (fs.existsSync(full)) {
        try {
          const html = fs.readFileSync(full, 'latin1');
          const rows = parseHtmlTable(html);
          const deals = extractDealsFromTable(rows, src.name + '_' + sheetFile, src.weekLabel, src.defaultDate);
          console.log(`Parsed ${deals.length} deals from ${src.name} [${sheetFile}]`);
          deals.forEach(d => {
            allDeals.push(d);
            registerClient(d);
          });
        } catch (e) {
          console.error(`Error parsing ${full}:`, e.message);
        }
      }
    });
  }
});

// Also parse Excel files in Ducumentos and RELATORIO CRM GPA
function scanExcel(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      scanExcel(full);
    } else if (item.name.endsWith('.xlsx') && !item.name.startsWith('~$')) {
      try {
        const wb = XLSX.readFile(full);
        wb.SheetNames.forEach(sheetName => {
          const lowerName = sheetName.toLowerCase();
          const skipSheets = ['metas', 'performance', 'manual', 'instrucoes', 'instruções', 'listas', 'capa', 'config'];
          if (skipSheets.some(s => lowerName.includes(s))) return;

          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          
          let weekLabel = '24–28 Ago 2026';
          let defaultDate = '2026-08-24';
          const lower = (full + ' ' + sheetName).toLowerCase();
          if (lower.includes('17') || (lower.includes('21') && lower.includes('ago'))) {
            weekLabel = '17–21 Ago 2026';
            defaultDate = '2026-08-17';
          } else if (lower.includes('10') || (lower.includes('14') && lower.includes('ago'))) {
            weekLabel = '10–14 Ago 2026';
            defaultDate = '2026-08-10';
          } else if (lower.includes('03') || (lower.includes('07') && lower.includes('ago'))) {
            weekLabel = '03–07 Ago 2026';
            defaultDate = '2026-08-03';
          } else if (lower.includes('27') || (lower.includes('31') && lower.includes('jul'))) {
            weekLabel = '27–31 Jul 2026';
            defaultDate = '2026-07-27';
          } else if (lower.includes('13') || (lower.includes('17') && lower.includes('jul'))) {
            weekLabel = '13–17 Jul 2026';
            defaultDate = '2026-07-13';
          }

          const deals = extractDealsFromTable(rows, path.basename(full) + '_' + sheetName, weekLabel, defaultDate);
          if (deals.length > 0) {
            console.log(`Parsed ${deals.length} deals from XLSX: ${path.basename(full)} [${sheetName}]`);
            deals.forEach(d => {
              allDeals.push(d);
              registerClient(d);
            });
          }
        });
      } catch (e) {
        console.error(`Error reading XLSX ${full}:`, e.message);
      }
    }
  }
}

scanExcel(path.join(rootDir, 'Ducumentos'));
scanExcel(path.join(rootDir, 'RELATORIO CRM GPA'));

console.log(`\n======================================================`);
console.log(`TOTAL RAW EXTRACTED DEALS: ${allDeals.length}`);
console.log(`TOTAL UNIQUE CLIENTS: ${allClients.size}`);

// Deduplicate deals based on (clienteNome + titulo + valor + semana)
const uniqueDealsMap = new Map();
allDeals.forEach((d, idx) => {
  const key = `${(d.clienteNome || '').toLowerCase()}_${(d.titulo || '').toLowerCase()}_${d.valor}_${d.dataEnvio}`;
  if (!uniqueDealsMap.has(key)) {
    uniqueDealsMap.set(key, { ...d, id: `deal_gpa_${uniqueDealsMap.size + 1}` });
  }
});

const deduplicatedDeals = Array.from(uniqueDealsMap.values());
console.log(`TOTAL DEDUPLICATED DEALS: ${deduplicatedDeals.length}`);

// Breakdown by Week:
const weekStats = {};
deduplicatedDeals.forEach(d => {
  const w = d.semana || d.dataEnvio;
  weekStats[w] = (weekStats[w] || 0) + 1;
});
console.log('\nDeals per Week:', weekStats);

module.exports = {
  deduplicatedDeals,
  allClients: Array.from(allClients.values())
};
