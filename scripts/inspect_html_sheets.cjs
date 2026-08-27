const fs = require('fs');
const path = require('path');

const folders = [
  'RELATORIO CRM GPA/Relatorio de mes de Julho/RELATÓRIO DE CONSOLIDADO - MÊS DE  JULHO DE 2026_ficheiros',
  'RELATORIO CRM GPA/03-07 Ago a 10-14 ago/RELATÓRIO COMERCIAL - 10 À 14 DE AGOSTO DE 2026 Dashboard_Comercial_Grupo_GPA_V5_Actualizado (1)_ficheiros',
  'RELATORIO CRM GPA/06–10 Jul a 13–17 Jul/Cópia de Analise_Critica_Comercial_13-17_Julho_2026 (1)_ficheiros',
  'RELATORIO CRM GPA/10-14 Ago a 17-21 Ago/RELATÓRIO_COMERCIAL_17_A_21_AGOSTO_2026_DASHBOARD_V5_ACTUALIZADO_ficheiros',
  'RELATORIO CRM GPA/27–31 Jul a 03–07 Ago/Dashboard_Comercial_Grupo_GPA_V5_Actualizado (2) (2)_ficheiros'
];

folders.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log('Dir not found:', dir);
    return;
  }
  console.log('\n========================================');
  console.log('DIR:', dir);
  const files = fs.readdirSync(dir);
  console.log('Files:', files);
  
  files.filter(f => f.startsWith('sheet') && f.endsWith('.htm')).forEach(sheetFile => {
    const filePath = path.join(dir, sheetFile);
    const content = fs.readFileSync(filePath, 'latin1'); // Excel web pages often use windows-1252 / latin1 / utf8
    // Extract plain text or table rows
    const textPreview = content.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    console.log(`  * ${sheetFile}: ${textPreview}`);
  });
});
