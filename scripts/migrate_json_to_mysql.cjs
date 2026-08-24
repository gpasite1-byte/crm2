const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function migrateData() {
  console.log('====================================================');
  console.log('📦 MIGRAÇÃO: CRM-DB.JSON -> MYSQL DO CPANEL');
  console.log('====================================================');

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || 3306);

  if (!host || !user || !database) {
    console.error('❌ ERRO: Faltam variáveis no arquivo .env (DB_HOST, DB_USER, DB_NAME).');
    process.exit(1);
  }

  const jsonDbPath = path.join(__dirname, '..', 'crm-db.json');
  if (!fs.existsSync(jsonDbPath)) {
    console.error('❌ ERRO: Arquivo crm-db.json não encontrado.');
    process.exit(1);
  }

  const crmData = JSON.parse(fs.readFileSync(jsonDbPath, 'utf-8'));
  console.log(`📄 crm-db.json lido com sucesso!`);
  console.log(`   - Comerciais: ${(crmData.comerciais || []).length}`);
  console.log(`   - Clientes:    ${(crmData.clients || []).length}`);
  console.log(`   - Deals:       ${(crmData.deals || []).length}`);
  console.log(`   - Visitas:     ${(crmData.visits || []).length}`);

  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 10000
    });

    console.log('\n⏳ 1. Criando tabelas MySQL caso não existam...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'cpanel_mysql_schema.sql'), 'utf-8');
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log('✅ Tabelas criadas/verificadas com sucesso!');

    console.log('\n⏳ 2. Inserindo payload unificado na tabela `crm_data`...');
    await conn.query(
      `INSERT INTO \`crm_data\` (id, payload, updated_at) 
       VALUES ('gpa_angola_main_db', ?, NOW()) 
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()`,
      [JSON.stringify(crmData)]
    );
    console.log('✅ `crm_data` sincronizado com sucesso!');

    console.log('\n⏳ 3. Populando tabelas relacionais...');

    // Inserir comerciais
    if (Array.isArray(crmData.comerciais) && crmData.comerciais.length > 0) {
      for (const c of crmData.comerciais) {
        await conn.query(
          `INSERT INTO \`crm_comerciais\` (id, nome, email, perfil, funcao, meta_mensal, meta_semanal, comissao, peso_conversao, telefone, whatsapp_numero, foto, status, silencioso, provincia, senha)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nome = VALUES(nome), email = VALUES(email), perfil = VALUES(perfil), funcao = VALUES(funcao), meta_mensal = VALUES(meta_mensal), meta_semanal = VALUES(meta_semanal), comissao = VALUES(comissao), peso_conversao = VALUES(peso_conversao), telefone = VALUES(telefone), whatsapp_numero = VALUES(whatsapp_numero), foto = VALUES(foto), status = VALUES(status), silencioso = VALUES(silencioso), provincia = VALUES(provincia), senha = VALUES(senha)`,
          [
            c.id,
            c.nome || '',
            c.email || `${c.id}@gpaangola.co.ao`,
            c.perfil || 'comercial',
            c.funcao || 'Comercial',
            c.metaMensal || 0,
            c.metaSemanal || 0,
            c.comissao || 0.03,
            c.pesoConversao || 0.4,
            c.telefone || '',
            c.whatsappNumero || '',
            c.foto || '',
            c.status || 'ativo',
            c.silencioso ? 1 : 0,
            c.provincia || 'Luanda',
            c.senha || 'gpa2026'
          ]
        );
      }
      console.log(`   ✅ ${(crmData.comerciais).length} comerciais inseridos/atualizados.`);
    }

    // Inserir clientes
    if (Array.isArray(crmData.clients) && crmData.clients.length > 0) {
      for (const cl of crmData.clients) {
        await conn.query(
          `INSERT INTO \`crm_clientes\` (id, nome, empresa, nif, responsavel, email, telefone, provincia, segmento, status, ultima_visita, proxima_visita, endereco, historico_vendas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nome = VALUES(nome), empresa = VALUES(empresa), nif = VALUES(nif), responsavel = VALUES(responsavel), email = VALUES(email), telefone = VALUES(telefone), provincia = VALUES(provincia), segmento = VALUES(segmento), status = VALUES(status), ultima_visita = VALUES(ultima_visita), proxima_visita = VALUES(proxima_visita), endereco = VALUES(endereco), historico_vendas = VALUES(historico_vendas)`,
          [
            cl.id,
            cl.nome || cl.empresa || '',
            cl.empresa || cl.nome || '',
            cl.nif || '',
            cl.responsavel || '',
            cl.email || '',
            cl.telefone || '',
            cl.provincia || 'Luanda',
            cl.segmento || 'Geral',
            cl.status || 'ativo',
            cl.ultimaVisita || '',
            cl.proximaVisita || '',
            cl.endereco || '',
            cl.historicoVendas || 0
          ]
        );
      }
      console.log(`   ✅ ${(crmData.clients).length} clientes inseridos/atualizados.`);
    }

    // Inserir deals
    if (Array.isArray(crmData.deals) && crmData.deals.length > 0) {
      for (const d of crmData.deals) {
        await conn.query(
          `INSERT INTO \`crm_deals\` (id, cliente_nome, titulo, valor, valor_aprovado, valor_perdido, etapa, comercial_id, comercial_nome, prioridade, dias_aberto, data_envio, semana, empresa_grupo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE cliente_nome = VALUES(cliente_nome), titulo = VALUES(titulo), valor = VALUES(valor), valor_aprovado = VALUES(valor_aprovado), valor_perdido = VALUES(valor_perdido), etapa = VALUES(etapa), comercial_id = VALUES(comercial_id), comercial_nome = VALUES(comercial_nome), prioridade = VALUES(prioridade), dias_aberto = VALUES(dias_aberto), data_envio = VALUES(data_envio), semana = VALUES(semana), empresa_grupo = VALUES(empresa_grupo)`,
          [
            d.id,
            d.clienteNome || '',
            d.titulo || '',
            d.valor || 0,
            d.valorAprovado || null,
            d.valorPerdido || null,
            d.etapa || 'proposta',
            d.comercialId || '',
            d.comercialNome || '',
            d.prioridade || 'Normal',
            d.diasAberto || 0,
            d.dataEnvio || '',
            d.semana || '',
            d.empresaGrupo || 'GPA Angola'
          ]
        );
      }
      console.log(`   ✅ ${(crmData.deals).length} deals inseridos/atualizados.`);
    }

    // Inserir visitas
    if (Array.isArray(crmData.visits) && crmData.visits.length > 0) {
      for (const v of crmData.visits) {
        await conn.query(
          `INSERT INTO \`crm_visitas\` (id, cliente_nome, empresa, comercial_nome, data, hora, localizacao, resultado, produtos, necessidade)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE cliente_nome = VALUES(cliente_nome), empresa = VALUES(empresa), comercial_nome = VALUES(comercial_nome), data = VALUES(data), hora = VALUES(hora), localizacao = VALUES(localizacao), resultado = VALUES(resultado), produtos = VALUES(produtos), necessidade = VALUES(necessidade)`,
          [
            v.id,
            v.clienteNome || '',
            v.empresa || '',
            v.comercialNome || '',
            v.data || '',
            v.hora || '',
            v.localizacao || 'Luanda',
            v.resultado || 'Aguardando',
            v.produtos || '',
            v.necessidade || ''
          ]
        );
      }
      console.log(`   ✅ ${(crmData.visits).length} visitas inseridas/atualizadas.`);
    }

    await conn.end();
    console.log('\n====================================================');
    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO NO MYSQL DO CPANEL!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ Erro durante a migração:', err);
  }
}

migrateData();
