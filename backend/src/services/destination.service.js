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

/** Apply an ordered list of {find, replace} rules to the DDL text. */
function applyReplacements(ddl, replacements) {
  if (!replacements || replacements.length === 0) return ddl;
  return replacements.reduce((text, { find, replace }) => {
    if (!find) return text;
    // Plain string replace — split/join handles all occurrences without regex escaping issues
    return text.split(find).join(replace || '');
  }, ddl);
}

/** Returns a DROP IF EXISTS statement for the given object type, or null for unsupported types. */
function getDropStatement(type, schema, name) {
  // Escape brackets inside identifiers
  const s = schema.replace(/]/g, ']]');
  const n = name.replace(/]/g, ']]');
  const obj = `[${s}].[${n}]`;
  switch (type) {
    case 'SP':      return `DROP PROCEDURE IF EXISTS ${obj}`;
    case 'VISTA':   return `DROP VIEW IF EXISTS ${obj}`;
    case 'FUNCION': return `DROP FUNCTION IF EXISTS ${obj}`;
    case 'TRIGGER': return `DROP TRIGGER IF EXISTS ${obj}`;
    default:        return null;
  }
}

async function executeScripts(connConfig, scripts, destSchema, replacements = [], overwrite = false) {
  // Sort: TABLA first, TRIGGER last
  const sorted = [...scripts].sort((a, b) => {
    return (TYPE_ORDER.indexOf(a.type) ?? 99) - (TYPE_ORDER.indexOf(b.type) ?? 99);
  });

  return withPool(connConfig, async (pool) => {
    const results = [];

    for (const script of sorted) {
      try {
        const rawDdl = applyReplacements(
          (destSchema
            ? rewriteSchema(script.ddl, script.schema, destSchema)
            : script.ddl).trim(),
          replacements
        );

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
          // required for CREATE VIEW/PROCEDURE/FUNCTION/TRIGGER to work
          // correctly as the first (and only) statement in the batch.
          if (overwrite) {
            const targetSchema = destSchema || script.schema;
            const dropSql = getDropStatement(script.type, targetSchema, script.name);
            if (dropSql) await pool.request().batch(dropSql);
          }
          await pool.request().batch(rawDdl);
        }

        results.push({
          id: script.id,
          name: script.name,
          schema: script.schema,
          type: script.type,
          status: 'success',
          success: true,
          error: null,
        });
      } catch (err) {
        // SQL Server error 2714: "There is already an object named '...' in the database."
        const alreadyExists =
          err.number === 2714 ||
          /already an object named/i.test(err.message);

        results.push({
          id: script.id,
          name: script.name,
          schema: script.schema,
          type: script.type,
          status: alreadyExists ? 'exists' : 'error',
          success: false,
          error: err.message || 'Error desconocido',
        });
      }
    }

    const succeeded = results.filter((r) => r.status === 'success').length;
    const exists    = results.filter((r) => r.status === 'exists').length;
    const failed    = results.filter((r) => r.status === 'error').length;
    return {
      results,
      summary: { total: results.length, succeeded, exists, failed },
    };
  });
}

function formatSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (Buffer.isBuffer(val)) return '0x' + val.toString('hex');
  // Buffer serialized as JSON { type:'Buffer', data:[...] }
  if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
    return '0x' + Buffer.from(val.data).toString('hex');
  }
  if (val instanceof Date) return `'${val.toISOString().slice(0, 23).replace('T', ' ')}'`;
  // ISO string produced by JSON.stringify of a Date
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    return `'${val.slice(0, 23).replace('T', ' ')}'`;
  }
  return `N'${String(val).replace(/'/g, "''")}'`;
}

async function insertRows(connConfig, tableSchema, tableName, destSchema, columns, rows) {
  const targetSchema = destSchema || tableSchema;
  const s = targetSchema.replace(/]/g, ']]');
  const n = tableName.replace(/]/g, ']]');
  const fullTable = `[${s}].[${n}]`;

  // Computed columns cannot appear in INSERT column lists
  const insertableCols = columns.filter((c) => !c.isComputed);
  const hasIdentity    = insertableCols.some((c) => c.isIdentity);
  const colList        = insertableCols.map((c) => `[${c.name.replace(/]/g, ']]')}]`).join(', ');

  return withPool(connConfig, async (pool) => {
    if (hasIdentity) {
      await pool.request().query(`SET IDENTITY_INSERT ${fullTable} ON`);
    }

    const results = [];
    let succeeded = 0;
    let failed    = 0;

    for (let i = 0; i < rows.length; i++) {
      const row     = rows[i];
      const values  = insertableCols.map((c) => formatSqlValue(row[c.name])).join(', ');
      const sqlStmt = `INSERT INTO ${fullTable} (${colList}) VALUES (${values})`;
      try {
        await pool.request().query(sqlStmt);
        succeeded++;
        results.push({ row: i + 1, status: 'success' });
      } catch (err) {
        failed++;
        results.push({ row: i + 1, status: 'error', error: err.message });
      }
    }

    if (hasIdentity) {
      try { await pool.request().query(`SET IDENTITY_INSERT ${fullTable} OFF`); } catch { /* ignore */ }
    }

    return { results, summary: { total: rows.length, succeeded, failed } };
  });
}

async function runScript(connConfig, script) {
  // Split on lines that contain only GO (case-insensitive), ignoring leading/trailing whitespace
  const batches = script
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter(Boolean);

  return withPool(connConfig, async (pool) => {
    const results = [];
    let succeeded = 0;
    let failed    = 0;

    for (let i = 0; i < batches.length; i++) {
      try {
        await pool.request().batch(batches[i]);
        succeeded++;
        results.push({ row: i + 1, status: 'success' });
      } catch (err) {
        failed++;
        results.push({ row: i + 1, status: 'error', error: err.message });
      }
    }

    return { results, summary: { total: batches.length, succeeded, failed } };
  });
}

module.exports = { testConnection, executeScripts, rewriteSchema, insertRows, runScript };
