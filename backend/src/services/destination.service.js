const { withPool, sql } = require('../config/db');
const { queryColumns, queryPrimaryKeyColumnNames, formatSqlValue: formatSourceSqlValue } = require('./source.service');

const TYPE_ORDER = ['TABLA', 'INDICE', 'FUNCION', 'VISTA', 'SP', 'TRIGGER'];

// Rows are read from the source in pages this big (bounded memory — a
// multi-million-row table is never held in memory at once), and each page is
// written to the destination as one INSERT statement. Kept equal to
// INSERT_CHUNK_SIZE (SQL Server's hard limit for a multi-row VALUES list) so
// every single request the destination connection makes — one page's worth
// of rows — stays small regardless of how many indexes/triggers/FKs make
// that destination table slow to write to. A larger page here was timing
// out mid-INSERT on heavily-indexed destination tables, because 5000 rows'
// worth of index/trigger work in one statement could exceed the per-request
// timeout even though the copy as a whole was healthy.
const COPY_PAGE_SIZE = 1000;
const INSERT_CHUNK_SIZE = 1000;

// Rows removed per DELETE statement when "vaciar tabla destino" is on — a
// single unbatched `DELETE FROM table` on a large, heavily-referenced table
// is itself a single request that can run past the timeout.
const DELETE_BATCH_SIZE = 5000;

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

/** Returns a DROP INDEX IF EXISTS statement for an index on a given table. */
function getIndexDropStatement(schema, tableName, indexName) {
  const s = schema.replace(/]/g, ']]');
  const t = tableName.replace(/]/g, ']]');
  const i = indexName.replace(/]/g, ']]');
  return `DROP INDEX IF EXISTS [${i}] ON [${s}].[${t}]`;
}

function exportScripts(scripts, destSchema, replacements = [], overwrite = false) {
  const sorted = [...scripts].sort((a, b) =>
    (TYPE_ORDER.indexOf(a.type) ?? 99) - (TYPE_ORDER.indexOf(b.type) ?? 99)
  );

  const parts = [];
  for (const script of sorted) {
    const targetSchema = destSchema || script.schema;
    const rawDdl = applyReplacements(
      destSchema ? rewriteSchema(script.ddl, script.schema, destSchema) : script.ddl,
      replacements
    ).trim();

    if (script.type === 'INDICE') {
      parts.push(`-- INDICE: [${targetSchema}].[${script.table}] -> [${script.indexName}]`);
    } else {
      parts.push(`-- ${script.type}: [${targetSchema}].[${script.name}]`);
    }

    if (overwrite && script.type === 'INDICE' && script.table && script.indexName) {
      const dropIdxSql = getIndexDropStatement(targetSchema, script.table, script.indexName);
      parts.push(dropIdxSql); parts.push('GO');
    } else if (script.type !== 'TABLA' && script.type !== 'INDICE' && overwrite) {
      const dropSql = getDropStatement(script.type, targetSchema, script.name);
      if (dropSql) { parts.push(dropSql); parts.push('GO'); }
    }

    parts.push(rawDdl);
    parts.push('GO');
    parts.push('');
  }

  return { sql: parts.join('\n') };
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

        if (script.type === 'TABLA' || script.type === 'INDICE') {
          if (script.type === 'INDICE' && overwrite && script.table && script.indexName) {
            const targetSchema = destSchema || script.schema;
            await pool.request().batch(getIndexDropStatement(targetSchema, script.table, script.indexName));
          }
          // Tables (and single-index scripts) may produce multiple statements
          // (CREATE TABLE + indexes + FKs + data). Split on blank lines and
          // execute each statement individually so errors are precise.
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
    let exists    = 0;
    let failed    = 0;

    for (let i = 0; i < batches.length; i++) {
      try {
        const result = await pool.request().batch(batches[i]);
        // Batches generated with the "validar existencia" option end with
        // `SELECT @__inserted AS outcome` (0 = skipped because it already
        // existed, 1 = actually inserted). Batches without that trailing
        // SELECT (e.g. plain inserts, ALTER TABLE) have no recordset here
        // and are simply counted as successful, same as before.
        const outcome = result?.recordset?.[0]?.outcome;
        if (outcome === 0) {
          exists++;
          results.push({ row: i + 1, status: 'exists' });
        } else {
          succeeded++;
          results.push({ row: i + 1, status: 'success' });
        }
      } catch (err) {
        failed++;
        results.push({ row: i + 1, status: 'error', error: err.message });
      }
    }

    return { results, summary: { total: batches.length, succeeded, exists, failed } };
  });
}

/** Keyset ("seek") WHERE clause: pk > last-seen-pk, tuple-compared across
 * every PK column so paging stays correct for composite keys. */
function buildKeysetWhereClause(pkCols, lastValues) {
  const clauses = pkCols.map((col, i) => {
    const equalParts = pkCols.slice(0, i).map((c, j) => `[${c}] = ${formatSourceSqlValue(lastValues[j])}`);
    const gtPart = `[${col}] > ${formatSourceSqlValue(lastValues[i])}`;
    return `(${[...equalParts, gtPart].join(' AND ')})`;
  });
  return clauses.join(' OR ');
}

/**
 * Copies a table's rows directly from the source database to the
 * destination database, entirely server-side — row data never passes
 * through the browser and is never held in memory for the whole table at
 * once (unlike the DDL-embedded data used for "Exportar Script").
 *
 * Reads are paginated by keyset ("seek method": WHERE pk > last-seen-pk,
 * ORDER BY pk, TOP N) when the table has a primary key, and each page is
 * written as one or more multi-row INSERT statements. This keeps memory
 * bounded regardless of table size, same as before — but unlike a plain
 * OFFSET/FETCH (which has to scan and discard every prior row on every
 * page, making the copy of a large table quadratically slower the deeper
 * it gets, and was timing out partway through million-row tables), a
 * keyset seek on the PK's index costs roughly the same per page no matter
 * how far into the table it is.
 */
async function copyTableData(sourceConnConfig, destConnConfig, schema, name, destSchema, truncateFirst = false) {
  const targetSchema = destSchema || schema;
  const s = targetSchema.replace(/]/g, ']]');
  const n = name.replace(/]/g, ']]');
  const fullTable = `[${s}].[${n}]`;

  return withPool(sourceConnConfig, async (sourcePool) => {
    return withPool(destConnConfig, async (destPool) => {
      const cols = await queryColumns(sourcePool, schema, name);
      const insertableCols = cols.filter((c) => !c.computed_definition);
      if (insertableCols.length === 0) {
        throw Object.assign(new Error(`La tabla "${schema}.${name}" no tiene columnas insertables.`), { status: 422 });
      }
      const colNames = insertableCols.map((c) => c.column_name);
      const colList = colNames.map((c) => `[${c}]`).join(', ');
      const hasIdentity = insertableCols.some((c) => c.is_identity);

      if (truncateFirst) {
        for (;;) {
          const result = await destPool.request().query(`DELETE TOP (${DELETE_BATCH_SIZE}) FROM ${fullTable}`);
          if (!result.rowsAffected[0]) break;
        }
      }

      const pkCols = await queryPrimaryKeyColumnNames(sourcePool, schema, name);

      let copied = 0;

      async function insertRowsPage(rows) {
        const lines = [];
        if (hasIdentity) lines.push(`SET IDENTITY_INSERT ${fullTable} ON`);
        for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
          const slice = rows.slice(i, i + INSERT_CHUNK_SIZE);
          const valuesList = slice
            .map((row) => `(${colNames.map((c) => formatSourceSqlValue(row[c])).join(', ')})`)
            .join(',\n');
          lines.push(`INSERT INTO ${fullTable} (${colList}) VALUES\n${valuesList}`);
        }
        if (hasIdentity) lines.push(`SET IDENTITY_INSERT ${fullTable} OFF`);
        await destPool.request().batch(lines.join('\n'));
      }

      if (pkCols.length > 0) {
        const orderBy = pkCols.map((c) => `[${c}]`).join(', ');
        let lastValues = null;

        for (;;) {
          const where = lastValues ? `WHERE ${buildKeysetWhereClause(pkCols, lastValues)}` : '';
          const pageResult = await sourcePool.request()
            .query(`
              SELECT TOP (${COPY_PAGE_SIZE}) * FROM [${schema}].[${name}] WITH (NOLOCK)
              ${where}
              ORDER BY ${orderBy}
            `);
          const rows = pageResult.recordset;
          if (rows.length === 0) break;

          await insertRowsPage(rows);

          copied += rows.length;
          const lastRow = rows[rows.length - 1];
          lastValues = pkCols.map((c) => lastRow[c]);

          if (rows.length < COPY_PAGE_SIZE) break; // last page
        }
      } else {
        // No primary key to seek on — fall back to OFFSET/FETCH with a
        // stable arbitrary order. Slower on very large tables (OFFSET has to
        // scan and discard every prior row each page), but there's no
        // indexable key available to do better, and tables without a PK are
        // typically small reference/staging tables.
        let offset = 0;
        for (;;) {
          const pageResult = await sourcePool.request()
            .query(`
              SELECT * FROM [${schema}].[${name}] WITH (NOLOCK)
              ORDER BY (SELECT NULL)
              OFFSET ${offset} ROWS FETCH NEXT ${COPY_PAGE_SIZE} ROWS ONLY
            `);
          const rows = pageResult.recordset;
          if (rows.length === 0) break;

          await insertRowsPage(rows);

          copied += rows.length;
          offset += COPY_PAGE_SIZE;

          if (rows.length < COPY_PAGE_SIZE) break; // last page
        }
      }

      return { copied };
    });
  });
}

module.exports = { testConnection, exportScripts, executeScripts, rewriteSchema, insertRows, runScript, copyTableData };
