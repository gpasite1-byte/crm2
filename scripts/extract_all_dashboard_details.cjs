const fs = require('fs');
const path = require('path');

const folders = [
  { name: 'Relatorio de mes de Julho', path: 'RELATORIO CRM GPA/Relatorio de mes de Julho/RELATÓRIO DE CONSOLIDADO - MÊS DE  JULHO DE 2026_ficheiros' },
  { name: '06–10 Jul a 13–17 Jul', path: 'RELATORIO CRM GPA/06–10 Jul a 13–17 Jul/Cópia de Analise_Critica_Comercial_13-17_Julho_2026 (1)_ficheiros' },
  { name: '27–31 Jul a 03–07 Ago', path: 'RELATORIO CRM GPA/27–31 Jul a 03–07 Ago/Dashboard_Comercial_Grupo_GPA_V5_Actualizado (2) (2)_ficheiros' },
  { name: '03-07 Ago a 10-14 ago', path: 'RELATORIO CRM GPA/03-07 Ago a 10-14 ago/RELATÓRIO COMERCIAL - 10 À 14 DE AGOSTO DE 2026 Dashboard_Comercial_Grupo_GPA_V5_Actualizado (1)_ficheiros' },
  { name: '10-14 Ago a 17-21 Ago', path: 'RELATORIO CRM GPA/10-14 Ago a 17-21 Ago/RELATÓRIO_COMERCIAL_17_A_21_AGOSTO_2026_DASHBOARD_V5_ACTUALIZADO_ficheiros' }
];

folders.forEach(item => {
  console.log(`\n========================================\nREPORT: ${item.name}\n========================================`);
  if (!fs.existsSync(item.path)) return;
  const files = fs.readdirSync(item.path);
  const sheetFiles = files.filter(f => f.startsWith('sheet') && f.endsWith('.htm'));
  
  sheetFiles.forEach(sf => {
    const p = path.join(item.path, sf);
    const content = fs.readFileSync(p, 'latin1');
    const images = (content.match(/src="[^"]*image\d+\.png"/g) || []).map(s => s.replace(/src="|"/g, ''));
    // extract table text
    const clean = content.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '\t')
      .replace(/\t+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    console.log(`\n--- ${sf} (Images: ${images.join(', ') || 'none'}) ---`);
    console.log(clean.slice(0, 1500));
  });
});
