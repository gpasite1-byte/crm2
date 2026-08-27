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

const allRelatorioFiles = walk('./RELATORIO CRM GPA');
const allDocFiles = walk('./Ducumentos');
const allFiles = [...allRelatorioFiles, ...allDocFiles];

const report = [];

allFiles.forEach(filePath => {
  const ext = path.extname(filePath).toLowerCase();
  const fileInfo = {
    path: filePath,
    ext: ext,
    name: path.basename(filePath)
  };

  if (ext === '.xlsx') {
    try {
      const wb = XLSX.readFile(filePath);
      fileInfo.sheets = wb.SheetNames.map(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const nonEmptyRows = data.filter(row => row.some(c => c !== ''));
        return {
          sheetName,
          rowCount: data.length,
          nonEmptyRowCount: nonEmptyRows.length,
          sampleRows: nonEmptyRows.slice(0, 15)
        };
      });
    } catch (e) {
      fileInfo.error = e.message;
    }
    report.push(fileInfo);
  } else if (ext === '.htm' || ext === '.html') {
    if (!filePath.includes('_ficheiros')) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        fileInfo.contentLength = content.length;
        fileInfo.titleMatch = content.match(/<title>(.*?)<\/title>/i)?.[1] || '';
      } catch (e) {
        fileInfo.error = e.message;
      }
      report.push(fileInfo);
    }
  }
});

fs.writeFileSync('./scripts/report_summary.json', JSON.stringify(report, null, 2), 'utf-8');
console.log('Inspected ' + report.length + ' key report files.');
