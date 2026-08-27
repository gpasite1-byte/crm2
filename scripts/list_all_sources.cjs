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
const all = [...relatorioFiles, ...docFiles];

const allWorkbooks = all.filter(f => f.endsWith('.xlsx') && !f.includes('~$'));
const allHtml = all.filter(f => f.endsWith('.htm') && !f.includes('_ficheiros'));

console.log('=== ALL WORKBOOKS (' + allWorkbooks.length + ') ===');
allWorkbooks.forEach(wbPath => {
  console.log('\n>>> WORKBOOK:', wbPath);
  try {
    const wb = XLSX.readFile(wbPath);
    console.log('    Sheets:', wb.SheetNames.join(', '));
  } catch(e) {
    console.log('    Error:', e.message);
  }
});

console.log('\n=== ALL HTML DASHBOARDS (' + allHtml.length + ') ===');
allHtml.forEach(htmPath => {
  console.log('\n>>> HTML DASHBOARD:', htmPath);
  try {
    const content = fs.readFileSync(htmPath, 'utf-8');
    const title = content.match(/<title>(.*?)<\/title>/i)?.[1] || '(no title)';
    console.log('    Title:', title);
    // Find sheet links in html
    const sheetMatches = content.match(/href="[^"]*sheet\d+\.htm"/g) || [];
    console.log('    Sheet references in HTML:', sheetMatches.slice(0, 8));
  } catch(e) {
    console.log('    Error:', e.message);
  }
});
