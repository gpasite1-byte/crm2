const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const rootDir = __dirname + '/..';

console.log('--- Inspecting Ducumentos & RELATORIO CRM GPA ---');

function scanDir(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results = results.concat(scanDir(full));
    } else if (e.name.endsWith('.xlsx') && !e.name.startsWith('~$')) {
      results.push(full);
    }
  }
  return results;
}

const excelFiles = [
  ...scanDir(path.join(rootDir, 'Ducumentos')),
  ...scanDir(path.join(rootDir, 'RELATORIO CRM GPA'))
];

console.log('Found Excel files:', excelFiles.length);
excelFiles.forEach(f => {
  console.log('\n=============================================');
  console.log('FILE:', path.basename(f));
  try {
    const wb = XLSX.readFile(f);
    console.log('Sheets:', wb.SheetNames);
    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log(`Sheet "${sheetName}" has ${data.length} rows`);
      if (data.length > 0) {
        console.log('Sample row 0-3:', data.slice(0, 4));
      }
    });
  } catch (err) {
    console.error('Error reading file:', f, err.message);
  }
});
