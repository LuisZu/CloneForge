const sql = require('mssql');

/**
 * Creates a short-lived connection pool, executes a callback, then closes it.
 * @param {object} connConfig  - { server, port, database, user, password, trustServerCertificate }
 * @param {function} callback  - async (pool) => result
 */
async function withPool(connConfig, callback) {
  const config = {
    server: connConfig.server,
    port: Number(connConfig.port) || 1433,
    database: connConfig.database,
    user: connConfig.user,
    password: connConfig.password,
    options: {
      trustServerCertificate: connConfig.trustServerCertificate !== false,
      encrypt: connConfig.encrypt || false,
    },
    connectionTimeout: 15000,
    // Per-statement timeout. Bumped from the previous 60s: with "incluir
    // datos" a single table's INSERT block can take a while on large tables,
    // and this fires per statement/batch, not for the whole clone operation.
    requestTimeout: 120000,
  };

  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    return await callback(pool);
  } finally {
    await pool.close().catch(() => {});
  }
}

module.exports = { withPool, sql };
