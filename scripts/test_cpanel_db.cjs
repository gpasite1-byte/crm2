const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testConnection() {
  console.log('====================================================');
  console.log('🔍 TESTE DE CONEXÃO COM BANCO DE DADOS CPANEL (MYSQL)');
  console.log('====================================================');

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || 3306);

  console.log(`📡 Host:     ${host || '(Não definido no .env)'}`);
  console.log(`🚪 Porta:    ${port}`);
  console.log(`👤 Usuário:  ${user || '(Não definido no .env)'}`);
  console.log(`🗄️  Banco:    ${database || '(Não definido no .env)'}`);
  console.log('----------------------------------------------------');

  if (!host || !user || !database) {
    console.error('❌ ERRO: Faltam variáveis no arquivo .env!');
    console.error('Por favor, configure DB_HOST, DB_USER, DB_PASSWORD e DB_NAME no arquivo .env.');
    process.exit(1);
  }

  try {
    console.log('⏳ Tentando conectar ao MySQL do cPanel...');
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 10000
    });

    console.log('✅ CONEXÃO ESTABELECIDA COM SUCESSO!');

    const [rows] = await conn.query('SELECT VERSION() as version, DATABASE() as db, NOW() as current_time');
    console.log(`📌 Versão do MySQL: ${rows[0].version}`);
    console.log(`📌 Banco selecionado: ${rows[0].db}`);
    console.log(`📌 Hora no Servidor: ${rows[0].current_time}`);

    const [tables] = await conn.query('SHOW TABLES');
    console.log(`📊 Tabelas existentes no banco (${tables.length}):`, tables.map(t => Object.values(t)[0]));

    await conn.end();
    console.log('====================================================');
    console.log('🎉 TUDO PRONTO! O seu banco do cPanel está acessível!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ FALHA NA CONEXÃO:');
    console.error(err.message || err);
    console.log('\n💡 Dicas para resolver:');
    console.log('1. Se o erro for "ETIMEDOUT" ou "ECONNREFUSED":');
    console.log('   - Vá ao cPanel > "MySQL Remoto" (Remote MySQL) e adicione o seu IP público à lista de permissões.');
    console.log('2. Se o erro for "Access denied for user":');
    console.log('   - Verifique se o usuário tem permissões totais concedidas ao banco no cPanel.');
    console.log('3. Verifique se a senha informada no .env está correta.');
  }
}

testConnection();
