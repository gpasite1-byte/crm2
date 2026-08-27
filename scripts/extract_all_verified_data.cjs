const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walk(full));
    } else {
      results.push(full);
    }
  });
  return results;
}

const relatorioFiles = walk('./RELATORIO CRM GPA');
const docFiles = walk('./Ducumentos');
const allExcelFiles = [...relatorioFiles, ...docFiles].filter(f => f.endsWith('.xlsx') && !f.includes('~$'));

console.log('Found ' + allExcelFiles.length + ' excel files.');

const allProposals = [];
const clientsMap = new Map();
const commercialsMap = new Map();
const weeklySnapshots = [];
const monthlySnapshots = [];
const analiseCriticaRecords = [];
const recommendations = [];

function excelDateToJS(excelDate) {
  if (!excelDate) return '';
  if (typeof excelDate === 'string') {
    const str = excelDate.trim();
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
    if (str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)) {
      const [_, d, m, y] = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return str;
  }
  if (typeof excelDate === 'number') {
    const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return jsDate.toISOString().split('T')[0];
  }
  return '';
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

allExcelFiles.forEach(filePath => {
  try {
    const wb = XLSX.readFile(filePath);
    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      // Check if this sheet is Base_Duas_Semanas or Pipeline
      if (sheetName.toLowerCase().includes('base_duas_semanas') || sheetName.toLowerCase() === 'pipeline') {
        const headerRowIdx = data.findIndex(row => 
          row.some(c => String(c).toLowerCase().includes('cliente') || String(c).toLowerCase().includes('proposta'))
        );
        if (headerRowIdx >= 0) {
          const header = data[headerRowIdx].map(c => String(c).toLowerCase().trim());
          const colSemana = header.findIndex(c => c.includes('semana'));
          const colId = header.findIndex(c => c === 'id');
          const colData = header.findIndex(c => c.includes('data'));
          const colCliente = header.findIndex(c => c.includes('cliente') && !c.includes('classe'));
          const colServico = header.findIndex(c => c.includes('serviço') || c.includes('servico'));
          const colEstado = header.findIndex(c => c.includes('estado') && !c.includes('crm'));
          const colValorProp = header.findIndex(c => c.includes('valor proposta') || c.includes('valor proposto') || c.includes('volume proposto') || c === 'valor');
          const colValorAprov = header.findIndex(c => c.includes('valor aprovado') || c.includes('aprovado'));
          const colValorPerd = header.findIndex(c => c.includes('valor perdido') || c.includes('perdido'));
          const colProb = header.findIndex(c => c.includes('probab'));
          const colGestor = header.findIndex(c => c.includes('gestor') || c.includes('comercial'));
          const colAcao = header.findIndex(c => c.includes('acção') || c.includes('acao'));
          const colContacto = header.findIndex(c => c.includes('contacto') || c.includes('contato'));
          const colObs = header.findIndex(c => c.includes('observa'));
          const colDias = header.findIndex(c => c.includes('dias'));
          const colClasse = header.findIndex(c => c.includes('classe'));
          const colPrioridade = header.findIndex(c => c.includes('prioridade'));
          const colEstadoCrm = header.findIndex(c => c.includes('estado crm'));
          const colEmpresa = header.findIndex(c => c.includes('empresa'));

          for (let r = headerRowIdx + 1; r < data.length; r++) {
            const row = data[r];
            const cliente = colCliente >= 0 ? String(row[colCliente] || '').trim() : '';
            const servico = colServico >= 0 ? String(row[colServico] || '').trim() : '';
            const valorProp = colValorProp >= 0 ? parseNumber(row[colValorProp]) : 0;
            
            if (!cliente && !servico && valorProp === 0) continue;
            if (cliente.toLowerCase().includes('total') || cliente.toLowerCase().includes('indicador')) continue;

            const gestor = colGestor >= 0 ? String(row[colGestor] || '').trim() : 'Não atribuído';
            const rawData = colData >= 0 ? row[colData] : '';
            const dataEnvio = excelDateToJS(rawData) || '2026-07-27';
            const estado = colEstado >= 0 ? String(row[colEstado] || 'Proposta enviada').trim() : 'Proposta enviada';
            const semana = colSemana >= 0 ? String(row[colSemana] || '').trim() : '';
            const valorAprov = colValorAprov >= 0 ? parseNumber(row[colValorAprov]) : 0;
            const valorPerd = colValorPerd >= 0 ? parseNumber(row[colValorPerd]) : 0;
            const probRaw = colProb >= 0 ? row[colProb] : 0.4;
            const prob = typeof probRaw === 'number' ? (probRaw <= 1 ? probRaw : probRaw / 100) : (parseNumber(probRaw) > 1 ? parseNumber(probRaw)/100 : parseNumber(probRaw));
            const acao = colAcao >= 0 ? String(row[colAcao] || '').trim() : '';
            const contacto = colContacto >= 0 ? excelDateToJS(row[colContacto]) : '';
            const obs = colObs >= 0 ? String(row[colObs] || '').trim() : '';
            const dias = colDias >= 0 ? parseNumber(row[colDias]) : 0;
            const classe = colClasse >= 0 ? String(row[colClasse] || 'B').trim() : 'B';
            const prioridade = colPrioridade >= 0 ? String(row[colPrioridade] || 'Normal').trim() : 'Normal';
            const crmStatus = colEstadoCrm >= 0 ? String(row[colEstadoCrm] || '').trim() : '';
            const empresa = colEmpresa >= 0 ? String(row[colEmpresa] || 'GPA ANGOLA').trim() : 'GPA ANGOLA';

            allProposals.push({
              sourceFile: path.basename(filePath),
              sourceSheet: sheetName,
              semana,
              cliente,
              servico,
              estado,
              valorProp,
              valorAprov,
              valorPerd,
              probabilidade: prob,
              gestor,
              acao,
              contacto,
              obs,
              dias,
              classe,
              prioridade,
              crmStatus,
              empresa,
              dataEnvio
            });
          }
        }
      }
    });
  } catch (e) {
    console.log('Error reading ' + filePath + ': ' + e.message);
  }
});

console.log('Extracted ' + allProposals.length + ' raw proposal rows across all workbooks.');

// Let's deduplicate and aggregate
const dedupKey = (p) => `${p.cliente.toLowerCase().trim()}_${p.servico.toLowerCase().trim()}_${p.valorProp}_${p.dataEnvio}`;
const uniqueMap = new Map();
allProposals.forEach(p => {
  const k = dedupKey(p);
  if (!uniqueMap.has(k)) {
    uniqueMap.set(k, p);
  } else {
    // Merge extra info if available
    const existing = uniqueMap.get(k);
    if (!existing.acao && p.acao) existing.acao = p.acao;
    if (!existing.obs && p.obs) existing.obs = p.obs;
    if (!existing.semana && p.semana) existing.semana = p.semana;
  }
});

console.log('Total UNIQUE proposals: ' + uniqueMap.size);

// Save extracted data summary
const extractedUnique = Array.from(uniqueMap.values());
fs.writeFileSync('./scripts/extracted_proposals.json', JSON.stringify(extractedUnique, null, 2), 'utf-8');

