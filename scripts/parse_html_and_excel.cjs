const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const rootDir = path.resolve(__dirname, '..');

// Helper to strip HTML tags and decode entities
function cleanHtmlText(text) {
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

// Simple HTML table parser without external heavy libraries
function parseHtmlTable(htmlContent) {
  const rows = [];
  const trMatches = htmlContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  
  for (const tr of trMatches) {
    const row = [];
    const cellMatches = tr.match(/<(?:td|th)[^>]*>[\s\S]*?<\/(?:td|th)>/gi) || [];
    for (const cell of cellMatches) {
      const text = cleanHtmlText(cell);
      row.push(text);
    }
    if (row.length > 0 && row.some(c => c !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

// Find all HTML ficheiros folders
const relatorioDir = path.join(rootDir, 'RELATORIO CRM GPA');

function findFiles(dir, matchExt) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(findFiles(full, matchExt));
    } else if (matchExt(item.name)) {
      results.push(full);
    }
  }
  return results;
}

const htmlFiles = findFiles(relatorioDir, n => n.endsWith('.htm') || n.endsWith('.html'));
const xlsxFiles = [
  ...findFiles(path.join(rootDir, 'Ducumentos'), n => n.endsWith('.xlsx') && !n.startsWith('~$')),
  ...findFiles(relatorioDir, n => n.endsWith('.xlsx') && !n.startsWith('~$'))
];

console.log(`Found ${htmlFiles.length} HTML files and ${xlsxFiles.length} XLSX files.`);

const parsedReports = [];

// Parse each HTML sheet
htmlFiles.forEach(f => {
  const relPath = path.relative(rootDir, f);
  if (path.basename(f).startsWith('sheet002') || path.basename(f).startsWith('sheet004') || path.basename(f).startsWith('sheet005') || path.basename(f).startsWith('sheet003') || path.basename(f).startsWith('sheet001')) {
    try {
      const content = fs.readFileSync(f, 'latin1'); // Excel HTML exports often use windows-1252/latin1
      const table = parseHtmlTable(content);
      parsedReports.push({
        file: relPath,
        sheetType: path.basename(f),
        rowCount: table.length,
        header: table.slice(0, 5),
        sampleRows: table.slice(5, 15)
      });
      console.log(`HTML: ${relPath} -> ${table.length} rows`);
    } catch (e) {
      console.error(`Error parsing HTML ${relPath}:`, e.message);
    }
  }
});

// Parse each Excel file
xlsxFiles.forEach(f => {
  const relPath = path.relative(rootDir, f);
  try {
    const wb = XLSX.readFile(f);
    wb.SheetNames.forEach(sName => {
      const ws = wb.Sheets[sName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      parsedReports.push({
        file: relPath,
        sheetName: sName,
        rowCount: data.length,
        header: data.slice(0, 5),
        sampleRows: data.slice(5, 15)
      });
      console.log(`XLSX: ${relPath} [${sName}] -> ${data.length} rows`);
    });
  } catch (e) {
    console.error(`Error parsing XLSX ${relPath}:`, e.message);
  }
});

fs.writeFileSync(path.join(rootDir, 'scratch_parsed_reports_summary.json'), JSON.stringify(parsedReports, null, 2), 'utf-8');
console.log('Saved summary to scratch_parsed_reports_summary.json');
