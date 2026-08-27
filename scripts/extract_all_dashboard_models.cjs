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

const allDashboardV5 = [];
const allComparativos = [];
const allMetasPerformance = [];
const allRecomendacoes = [];
const allAnaliseCritica = [];
const allAlinhamentoFinanceiro = [];
const allMonthlyConsolidated = [];

allExcelFiles.forEach(file => {
  try {
    const wb = XLSX.readFile(file);
    const fname = path.basename(file);
    const folder = path.basename(path.dirname(file));
    
    wb.SheetNames.forEach(sName => {
      const sheet = wb.Sheets[sName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const nonEmpty = data.filter(r => r.some(c => c !== ''));

      if (sName === 'Dashboard_V5' || sName === 'Dashboard') {
        allDashboardV5.push({ file: fname, folder, sheet: sName, rows: nonEmpty });
      } else if (sName.toLowerCase().includes('comparativ')) {
        allComparativos.push({ file: fname, folder, sheet: sName, rows: nonEmpty });
      } else if (sName.toLowerCase().includes('metas_performance') || sName.toLowerCase().includes('kpis_comerciais')) {
        allMetasPerformance.push({ file: fname, folder, sheet: sName, rows: nonEmpty });
      } else if (sName.toLowerCase().includes('crm_proxima_semana')) {
        allRecomendacoes.push({ file: fname, folder, sheet: sName, rows: nonEmpty });
      } else if (sName.toLowerCase().includes('analise_critica') || sName.toLowerCase().includes('resumo_executivo')) {
        allAnaliseCritica.push({ file: fname, folder, sheet: sName, rows: nonEmpty });
      } else if (sName.toLowerCase().includes('alinhamento_financeiro')) {
        allAlinhamentoFinanceiro.push({ file: fname, folder, sheet: sName, rows: nonEmpty });
      }
    });
  } catch(e) {
    console.error('Error on', file, e.message);
  }
});

const output = {
  dashboards: allDashboardV5,
  comparativos: allComparativos,
  metas: allMetasPerformance,
  recomendacoes: allRecomendacoes,
  analiseCritica: allAnaliseCritica,
  alinhamentoFinanceiro: allAlinhamentoFinanceiro
};

fs.writeFileSync('./scripts/all_dashboard_models.json', JSON.stringify(output, null, 2), 'utf-8');
console.log('Saved all dashboard models summary.');
