require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || '85.215.215.242',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root ',
  multipleStatements: true,
};

const dbName = process.env.DB_DATABASE || 'frigo_db';

const SQL = `
CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`${dbName}\`;

CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`email\` VARCHAR(255) NOT NULL UNIQUE,
  \`password\` VARCHAR(255) NOT NULL,
  \`role\` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  \`permissions\` JSON
);

CREATE TABLE IF NOT EXISTS \`clients\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`nom\` VARCHAR(255) NOT NULL,
  \`prenom\` VARCHAR(255) NOT NULL,
  \`cin\` VARCHAR(255) NOT NULL UNIQUE,
  \`telephone\` VARCHAR(255),
  \`email\` VARCHAR(255),
  \`caissesReservees\` INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS \`products\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`nom\` VARCHAR(255) NOT NULL,
  \`categorie\` VARCHAR(255) NOT NULL,
  \`codeBarres\` VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS \`rooms\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`nom\` VARCHAR(255) NOT NULL UNIQUE,
  \`nbCaisse\` INT NOT NULL
);

CREATE TABLE IF NOT EXISTS \`settings\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`companyName\` VARCHAR(255),
  \`companyAddress\` TEXT,
  \`companyWebsite\` VARCHAR(255),
  \`companyPhone\` VARCHAR(255),
  \`companyEmail\` VARCHAR(255),
  \`companyLogo\` LONGTEXT,
  \`companySignature\` LONGTEXT,
  \`fiscalId\` VARCHAR(255),
  \`currencySymbol\` VARCHAR(10),
  \`cautionPerCrate\` DECIMAL(10, 2),
  \`emptyCrateWeight\` DECIMAL(10, 2),
  \`taxRate\` DECIMAL(5, 2),
  \`rentPerCratePerDay\` DECIMAL(10, 2),
  \`totalAvailableCrates\` INT
);

CREATE TABLE IF NOT EXISTS \`contracts\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`date\` DATETIME NOT NULL,
  \`clientId\` VARCHAR(36) NOT NULL,
  \`type\` ENUM('Location', 'Prêt de caisses') NOT NULL,
  \`nbCaisse\` INT NOT NULL,
  \`caution\` DECIMAL(10, 2) NOT NULL,
  \`avance\` DECIMAL(10, 2) DEFAULT 0,
  \`periode\` VARCHAR(255),
  \`signature\` LONGTEXT,
  \`status\` ENUM('En attente', 'Actif', 'Terminé', 'Annulé') DEFAULT 'En attente'
);

CREATE TABLE IF NOT EXISTS \`movements\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`date\` DATETIME NOT NULL,
  \`clientId\` VARCHAR(36) NOT NULL,
  \`type\` TEXT NOT NULL,
  \`productId\` VARCHAR(36) DEFAULT NULL,
  \`nbCaisse\` INT DEFAULT NULL,
  \`roomId\` VARCHAR(36) DEFAULT NULL,
  \`poidsBrut\` DECIMAL(10, 2) DEFAULT NULL,
  \`prixUnitaire\` DECIMAL(10, 2) DEFAULT NULL,
  \`poidsNet\` DECIMAL(10, 2) DEFAULT NULL,
  \`montantTotal\` DECIMAL(10, 2) DEFAULT NULL,
  \`taxe\` DECIMAL(10, 2) DEFAULT NULL,
  \`nbCaisseRetournees\` INT DEFAULT NULL,
  \`loyer\` DECIMAL(10, 2) DEFAULT NULL,
  \`cautionAppliquee\` BOOLEAN DEFAULT NULL,
  \`caution\` DECIMAL(10, 2) DEFAULT NULL,
  \`paymentStatus\` ENUM('Payé', 'En attente') DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS \`locations\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`clientId\` VARCHAR(36) NOT NULL,
  \`productId\` VARCHAR(36) NOT NULL,
  \`roomId\` VARCHAR(36) NOT NULL,
  \`nbCaisse\` INT NOT NULL,
  \`initialNbCaisse\` INT NOT NULL,
  \`entryDate\` DATETIME NOT NULL,
  \`exitDate\` DATETIME,
  \`status\` ENUM('En cours', 'Terminé') NOT NULL DEFAULT 'En cours'
);

CREATE TABLE IF NOT EXISTS \`invoices\` (
  \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
  \`date\` DATETIME NOT NULL,
  \`clientId\` VARCHAR(36) NOT NULL,
  \`type\` TEXT NOT NULL,
  \`montantTotal\` DECIMAL(10, 2) DEFAULT NULL,
  \`loyer\` DECIMAL(10, 2) DEFAULT NULL,
  \`caution\` DECIMAL(10, 2) DEFAULT NULL,
  \`paymentStatus\` ENUM('Payé', 'En attente') DEFAULT NULL
);

INSERT IGNORE INTO \`users\` (\`id\`, \`email\`, \`password\`, \`role\`, \`permissions\`) VALUES
('admin-uuid-placeholder', 'admin@example.com', '$2a$10$RvGBSWUp.Bz7JwRKND7Xx.BBUTJ6PMCaWYcZ5ywVyVZ7D9w8k37.u', 'admin', NULL),
('user-uuid-placeholder', 'user@example.com', '$2a$10$NCZCli/fMvHhJcCCXdZ8k.BnOqZGK8EoyvWjIOth/7RMmMFaw81A.', 'user', JSON_OBJECT('dashboard', TRUE, 'clients', TRUE, 'products', TRUE, 'rooms', TRUE, 'locations', FALSE, 'ventes', TRUE, 'movements', TRUE, 'factures', FALSE, 'reports', FALSE));

INSERT IGNORE INTO \`settings\` (\`id\`, \`companyName\`, \`companyAddress\`, \`companyWebsite\`, \`companyPhone\`, \`companyLogo\`, \`fiscalId\`, \`currencySymbol\`, \`cautionPerCrate\`, \`emptyCrateWeight\`, \`taxRate\`, \`rentPerCratePerDay\`, \`totalAvailableCrates\`) VALUES
(1, 'Frigo Inc.', '123 Rue de la Glace, 75001 Paris, France', 'www.frigo-inc.com', '0123456789', '', 'FR123456789', 'DT', 15.00, 1.2, 19.0, 0.50, 1000);
`;

(async () => {
  let conn;
  try {
    console.log(`Connexion au serveur MySQL sur ${config.host}:${config.port}...`);
    conn = await mysql.createConnection(config);
    console.log('Connecté !');
    console.log(`Création de la base "${dbName}" et des tables...`);
    await conn.query(SQL);
    console.log('✅ Base de données initialisée avec succès !');
    console.log('   Vous pouvez maintenant démarrer le backend avec: npm start');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
