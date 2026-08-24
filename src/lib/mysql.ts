import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function isMySqlConfigured(): boolean {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  return Boolean(host && user && database);
}

export function getMySqlPool(): mysql.Pool | null {
  if (pool) return pool;

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || 3306);

  if (!host || !user || !database) {
    return null;
  }

  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    return pool;
  } catch (err) {
    console.error('❌ Erro ao criar Pool MySQL:', err);
    return null;
  }
}

export async function testMySqlConnection(): Promise<{ success: boolean; message: string; version?: string }> {
  const p = getMySqlPool();
  if (!p) {
    return {
      success: false,
      message: 'Variáveis de ambiente DB_HOST, DB_USER ou DB_NAME não estão configuradas no .env'
    };
  }

  try {
    const conn = await p.getConnection();
    try {
      const [rows]: any = await conn.query('SELECT VERSION() as version, NOW() as current_time');
      const version = rows?.[0]?.version || 'MySQL desconhecido';
      return {
        success: true,
        message: `Conexão bem sucedida com o banco MySQL do cPanel! Servidor: ${version}`,
        version
      };
    } finally {
      conn.release();
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Falha na conexão MySQL: ${err.message || err}`
    };
  }
}

export async function initMySqlTables(): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;

  try {
    const conn = await p.getConnection();
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`crm_data\` (
            \`id\` VARCHAR(100) NOT NULL PRIMARY KEY DEFAULT 'gpa_angola_main_db',
            \`payload\` LONGTEXT NOT NULL,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`crm_chat_messages\` (
            \`id\` VARCHAR(100) NOT NULL PRIMARY KEY,
            \`sender_id\` VARCHAR(50) NOT NULL,
            \`sender_name\` VARCHAR(255) DEFAULT '',
            \`target_user_id\` VARCHAR(50) DEFAULT NULL,
            \`channel_id\` VARCHAR(50) DEFAULT 'general',
            \`text\` LONGTEXT,
            \`media_url\` LONGTEXT,
            \`media_type\` VARCHAR(50) DEFAULT NULL,
            \`reactions\` LONGTEXT,
            \`created_at\` BIGINT NOT NULL,
            \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      return true;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.warn('Aviso ao inicializar tabelas no MySQL:', err);
    return false;
  }
}

export async function loadCrmDataFromMySql(): Promise<any | null> {
  const p = getMySqlPool();
  if (!p) return null;

  try {
    const conn = await p.getConnection();
    try {
      const [rows]: any = await conn.query(
        'SELECT payload FROM `crm_data` WHERE id = ? LIMIT 1',
        ['gpa_angola_main_db']
      );

      if (rows && rows.length > 0 && rows[0].payload) {
        const parsed = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
        return parsed;
      }
      return null;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.warn('Aviso ao carregar dados do MySQL:', err);
    return null;
  }
}

export async function saveCrmDataToMySql(payload: any): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;

  try {
    const conn = await p.getConnection();
    try {
      const payloadStr = JSON.stringify(payload);
      await conn.query(
        `INSERT INTO \`crm_data\` (id, payload, updated_at) 
         VALUES (?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()`,
        ['gpa_angola_main_db', payloadStr]
      );
      return true;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Erro ao salvar dados no MySQL:', err);
    return false;
  }
}
