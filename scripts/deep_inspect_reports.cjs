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
console.log('=== LIST OF FILES IN RELATORIO CRM GPA ===');
relatorioFiles.forEach(f => console.log(f));

const excelFiles = relatorioFiles.filter(f => f.endsWith('.xlsx'));
const htmFiles = relatorioFiles.filter(f => f.endsWith('.htm') && !f.includes('_ficheiros'));

console.log('\n=== EXCEL WORKBOOKS ANALYSIS ===');
const allProposalsExtracted = [];
const allDashboardConfigs = [];

excelFiles.forEach(file => {
  console.log('\n----------------------------------------');
  console.log('FILE:', file);
  try {
    const wb = XLSX.readFile(file);
    console.log('SHEET NAMES:', wb.SheetNames);
    wb.SheetNames.forEach(s => {
      const sheet = wb.Sheets[s];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const nonEmpty = data.filter(r => r.some(c => c !== ''));
      console.log(`- Sheet "${s}": ${nonEmpty.length} non-empty rows`);
      // Print first 5 non-empty rows
      console.log('  Header/Sample:');
      nonEmpty.slice(0, 4).forEach((r, idx) => {
        console.log(`    [${idx}]`, r.slice(0, 10));
      });
    });
  } catch (e) {
    console.log('Error reading', file, e.message);
  }
});

