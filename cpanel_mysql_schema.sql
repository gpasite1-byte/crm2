-- ============================================================
-- GPA ANGOLA CRM - ESQUEMA DE BANCO DE DADOS MYSQL / CPANEL
-- Execute este script no phpMyAdmin do seu cPanel.
-- ============================================================

-- 1. TABELA PRINCIPAL DE SINCRONIZAÇÃO COMPLETA (crm_data)
-- Armazena o JSON unificado do CRM para sincronização rápida em tempo real
CREATE TABLE IF NOT EXISTS `crm_data` (
    `id` VARCHAR(100) NOT NULL PRIMARY KEY DEFAULT 'gpa_angola_main_db',
    `payload` LONGTEXT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABELA DE COMERCIAIS / USUÁRIOS (crm_comerciais)
CREATE TABLE IF NOT EXISTS `crm_comerciais` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY,
    `nome` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `perfil` VARCHAR(50) DEFAULT 'comercial',
    `funcao` VARCHAR(100) DEFAULT 'Comercial',
    `meta_mensal` DECIMAL(15,2) DEFAULT 0,
    `meta_semanal` DECIMAL(15,2) DEFAULT 0,
    `comissao` DECIMAL(6,4) DEFAULT 0.03,
    `peso_conversao` DECIMAL(6,2) DEFAULT 0.4,
    `telefone` VARCHAR(50) DEFAULT '',
    `whatsapp_numero` VARCHAR(50) DEFAULT '',
    `foto` LONGTEXT,
    `status` VARCHAR(20) DEFAULT 'ativo',
    `silencioso` TINYINT(1) DEFAULT 0,
    `provincia` VARCHAR(100) DEFAULT 'Luanda',
    `senha` VARCHAR(255) DEFAULT 'gpa2026',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABELA DE CLIENTES (crm_clientes)
CREATE TABLE IF NOT EXISTS `crm_clientes` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY,
    `nome` VARCHAR(255) NOT NULL,
    `empresa` VARCHAR(255) NOT NULL,
    `nif` VARCHAR(50) DEFAULT '',
    `responsavel` VARCHAR(50) DEFAULT '',
    `email` VARCHAR(255) DEFAULT '',
    `telefone` VARCHAR(50) DEFAULT '',
    `provincia` VARCHAR(100) DEFAULT 'Luanda',
    `segmento` VARCHAR(100) DEFAULT 'Geral',
    `status` VARCHAR(20) DEFAULT 'ativo',
    `ultima_visita` VARCHAR(50) DEFAULT '',
    `proxima_visita` VARCHAR(50) DEFAULT '',
    `endereco` TEXT,
    `historico_vendas` DECIMAL(15,2) DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABELA DE PROPOSTAS & NEGÓCIOS (crm_deals)
CREATE TABLE IF NOT EXISTS `crm_deals` (
    `id` VARCHAR(100) NOT NULL PRIMARY KEY,
    `cliente_nome` VARCHAR(255) NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `valor` DECIMAL(15,2) DEFAULT 0,
    `valor_aprovado` DECIMAL(15,2) DEFAULT NULL,
    `valor_perdido` DECIMAL(15,2) DEFAULT NULL,
    `etapa` VARCHAR(50) DEFAULT 'proposta',
    `comercial_id` VARCHAR(50) DEFAULT '',
    `comercial_nome` VARCHAR(255) DEFAULT '',
    `prioridade` VARCHAR(20) DEFAULT 'Normal',
    `dias_aberto` INT DEFAULT 0,
    `data_envio` VARCHAR(50) DEFAULT '',
    `semana` VARCHAR(50) DEFAULT '',
    `empresa_grupo` VARCHAR(100) DEFAULT 'GPA Angola',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABELA DE REGISTO DE VISITAS (crm_visitas)
CREATE TABLE IF NOT EXISTS `crm_visitas` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY,
    `cliente_nome` VARCHAR(255) DEFAULT '',
    `empresa` VARCHAR(255) NOT NULL,
    `comercial_nome` VARCHAR(255) DEFAULT '',
    `data` VARCHAR(50) DEFAULT '',
    `hora` VARCHAR(50) DEFAULT '',
    `localizacao` VARCHAR(255) DEFAULT 'Luanda',
    `resultado` VARCHAR(50) DEFAULT 'Aguardando',
    `produtos` TEXT,
    `necessidade` TEXT,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABELA DE MENSAGENS DE CHAT EM TEMPO REAL (crm_chat_messages)
CREATE TABLE IF NOT EXISTS `crm_chat_messages` (
    `id` VARCHAR(100) NOT NULL PRIMARY KEY,
    `sender_id` VARCHAR(50) NOT NULL,
    `sender_name` VARCHAR(255) DEFAULT '',
    `target_user_id` VARCHAR(50) DEFAULT NULL,
    `channel_id` VARCHAR(50) DEFAULT 'general',
    `text` LONGTEXT,
    `media_url` LONGTEXT,
    `media_type` VARCHAR(50) DEFAULT NULL,
    `reactions` LONGTEXT,
    `created_at` BIGINT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TABELA DE METADADOS & CONFIGURAÇÃO GERAL (crm_meta)
CREATE TABLE IF NOT EXISTS `crm_meta` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY DEFAULT 'gpa_angola_main',
    `crm_name` VARCHAR(255) DEFAULT 'GPA Angola CRM',
    `tel_sede` VARCHAR(100) DEFAULT '+244 922 000 000',
    `logo` LONGTEXT,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
