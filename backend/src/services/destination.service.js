const { withPool, sql } = require('../config/db');

const TYPE_ORDER = ['TABLA', 'FUNCION', 'VISTA', 'SP', 'TRIGGER'];

async function testConnection(connConfig) {
  return withPool(connConfig, async (pool) => {
    const result = await pool.request().query('SELECT @@VERSION AS version');
    const raw = result.recordset[0].version || '';
    const match = raw.match(/Microsoft SQL Server[^\n]*/);
    return { connected: true, serverVersion: match ? match[0].trim() : raw.split('\n')[0].trim() };
  });
}

/**
 * Replaces all occurrences of [sourceSchema]. and sourceSchema. in DDL
 * with [destSchema]. to redirect objects to a different schema.
 */
function rewriteSchema(ddl, sourceSchema, destSchema) {
  if (!destSchema || destSchema === sourceSchema) return ddl;
  // Replace bracketed form: [sourceSchema].
  const bracketedPattern = new RegExp(`\\[${escapeRegex(sourceSchema)}\\]\\.`, 'gi');
  // Replace unbracketed form: sourceSchema.  (word boundary to avoid partial matches)
  const unbracketedPattern = new RegExp(`\\b${escapeRegex(sourceSchema)}\\.`, 'gi');
  return ddl
    .replace(bracketedPattern, `[${destSchema}].`)
    .replace(unbracketedPattern, `[${destSchema}].`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function executeScripts(connConfig, scripts, destSchema) {
  // Sort: TABLA first, TRIGGER last
  const sorted = [...scripts].sort((a, b) => {
    return (TYPE_ORDER.indexOf(a.type) ?? 99) - (TYPE_ORDER.indexOf(b.type) ?? 99);
  });

  return withPool(connConfig, async (pool) => {
    const results = [];

    for (const script of sorted) {
      try {
        const rawDdl = (destSchema
          ? rewriteSchema(script.ddl, script.schema, destSchema)
          : script.ddl).trim();

        if (script.type === 'TABLA') {
          // Tables may produce multiple statements (CREATE TABLE + indexes + FKs + data).
          // Split on blank lines and execute each statement individually so errors are precise.
          const stmts = rawDdl
            .split(/\n\s*\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          for (const stmt of stmts) {
            await pool.request().batch(stmt);
          }
        } else {
          // For VISTAs, SPs, FUNCIONs and TRIGGERs use .batch() — it sends the SQL
          // directly to SQL Server without wrapping in sp_executesql, which is
          // required for CREATE OR ALTER VIEW/PROCEDURE/FUNCTION/TRIGGER to work
          // correctly as the first (and only) statement in the batch.
          await pool.request().batch(rawDdl);
        }

        results.push({
          id: script.id,
          name: script.name,
          schema: script.schema,
          type: script.type,
          success: true,
          error: null,
        });
      } catch (err) {
        results.push({
          id: script.id,
          name: script.name,
          schema: script.schema,
          type: script.type,
          success: false,
          error: err.message || 'Error desconocido',
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return {
      results,
      summary: {
        total: results.length,
        succeeded,
        failed: results.length - succeeded,
      },
    };
  });
}

module.exports = { testConnection, executeScripts, rewriteSchema };
