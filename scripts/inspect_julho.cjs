const fs = require('fs');
const path = require('path');

const julPath = 'RELATORIO CRM GPA/Relatorio de mes de Julho/RELATÓRIO DE CONSOLIDADO - MÊS DE  JULHO DE 2026_ficheiros';

fs.readdirSync(julPath).filter(f => f.startsWith('sheet')).forEach(sf => {
  const content = fs.readFileSync(path.join(julPath, sf), 'latin1');
  const clean = content.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '\t')
    .replace(/\t+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  const images = (content.match(/src="[^"]*image\d+\.png"/g) || []).map(s => s.replace(/src="|"/g, ''));
  console.log(`\n=============================\nJULHO ${sf} (Images: ${images.join(', ')})\n=============================`);
  console.log(clean.slice(0, 2000));
});
