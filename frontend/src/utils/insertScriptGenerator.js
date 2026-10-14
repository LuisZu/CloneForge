/**
 * Generates T-SQL INSERT (and optional ALTER TABLE) scripts from row data.
 *
 * UDF mode activates automatically when the table has the columns:
 *   TABLA, UDF, TIPO, LARGO, PERMITE_NULOS
 * In that case, each row also produces an ALTER TABLE ... ADD [U_<UDF>] statement.
 */

const UDF_REQUIRED = ['TABLA', 'UDF', 'TIPO', 'LARGO', 'PERMITE_NULOS'];

/** True when the column list matches the UDF definition table pattern. */
export function isUdfTable(columns) {
  const upper = new Set(columns.map((c) => c.name.toUpperCase()));
  return UDF_REQUIRED.every((req) => upper.has(req));
}

/** Case-insensitive field lookup in a row object. */
function colVal(row, colName) {
  const key = Object.keys(row).find((k) => k.toUpperCase() === colName.toUpperCase());
  return key !== undefined ? row[key] : null;
}

/** Converts a JS value to a T-SQL literal. */
function formatSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (val && typeof val === 'object' && val.type === 'Buffer') return '0x00'; // binary placeholder
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    return `'${val.slice(0, 19).replace('T', ' ')}'`;
  }
  return `N'${String(val).replace(/'/g, "''")}'`;
}

function buildInsert(schema, tableName, columns, row) {
  const cols = columns.filter((c) => !c.isComputed);
  const colList = cols.map((c) => `[${c.name}]`).join(', ');
  const values  = cols.map((c) => formatSqlValue(row[c.name])).join(', ');
  return `INSERT INTO [${schema}].[${tableName}] (${colList}) VALUES (${values})`;
}

/**
 * Columns used to decide whether a row "already exists" in the destination.
 * Prefers the table's primary key (fast, correct — matches the same record
 * SQL Server itself would reject as a duplicate); falls back to every
 * non-computed column (full-row match) when the table has no primary key.
 */
function getExistenceKeyColumns(columns) {
  const pkCols = columns.filter((c) => c.isPrimaryKey);
  return pkCols.length > 0 ? pkCols : columns.filter((c) => !c.isComputed);
}

/** WHERE clause that matches a specific row by its key columns' values. */
function buildKeyWhereClause(keyColumns, row) {
  return keyColumns
    .map((c) => {
      const val = row[c.name];
      return val === null || val === undefined
        ? `[${c.name}] IS NULL`
        : `[${c.name}] = ${formatSqlValue(val)}`;
    })
    .join(' AND ');
}

/**
 * Wraps an INSERT so it only runs when no row matching the key columns
 * already exists, and reports the outcome via a trailing SELECT so the
 * caller (runScript) can tell "inserted" apart from "already existed"
 * without a separate round trip.
 */
function buildGuardedInsert(schema, tableName, insertLines, keyColumns, row) {
  const where = buildKeyWhereClause(keyColumns, row);
  return [
    'DECLARE @__inserted INT = 0',
    `IF NOT EXISTS (SELECT 1 FROM [${schema}].[${tableName}] WHERE ${where})`,
    'BEGIN',
    ...insertLines.map((l) => `    ${l}`),
    '    SET @__inserted = 1',
    'END',
    'SELECT @__inserted AS outcome',
  ].join('\n');
}

function buildEncTablaUdf(schema, tablaValue) {
  const escaped = String(tablaValue).replace(/'/g, "''");
  return (
    `IF NOT EXISTS (SELECT 1 FROM [${schema}].[ENC_TABLA_UDF] WHERE TABLA = '${escaped}')\n` +
    `BEGIN\n` +
    `    INSERT INTO [${schema}].[ENC_TABLA_UDF](TABLA, NOTAS, TIPO, ETIQUETA)\n` +
    `    VALUES('${escaped}', 'TABLA ${escaped}', 'E', '${escaped}')\n` +
    `END`
  );
}

function buildAlterTable(schema, row) {
  const tabla        = colVal(row, 'TABLA');
  const udf          = colVal(row, 'UDF');
  const tipo         = colVal(row, 'TIPO');
  const largo        = colVal(row, 'LARGO');
  const permiteNulos = colVal(row, 'PERMITE_NULOS');
  const valorDefault = colVal(row, 'VALOR_DEFAULT'); // optional column

  if (!tabla || !udf) return null;

  const colName = `U_${udf}`;
  const tipoUp  = String(tipo || '').toUpperCase();

  let colType;
  if (tipoUp === 'A') {
    colType = `[varchar](${parseInt(largo, 10) || 50})`;
  } else if (tipoUp === 'N') {
    colType = '[decimal](18,4)';
  } else if (tipoUp === 'F') {
    colType = '[datetime]';
  } else {
    colType = `[varchar](${parseInt(largo, 10) || 50})`;
  }

  const nullable = String(permiteNulos || '').toUpperCase() === 'S' ? 'NULL' : 'NOT NULL';
  const defaultClause =
    valorDefault !== null && valorDefault !== undefined && String(valorDefault).trim() !== ''
      ? ` DEFAULT '${String(valorDefault).replace(/'/g, "''")}'`
      : '';

  return (
    `ALTER TABLE [${schema}].[${tabla}] ADD\n` +
    `[${colName}] ${colType}${defaultClause} ${nullable}`
  );
}

/**
 * Generates the full T-SQL script for the given rows.
 *
 * - Always generates an INSERT per row.
 * - If the table matches the UDF pattern, also generates ALTER TABLE per row.
 * - Wraps identity inserts with SET IDENTITY_INSERT ON/OFF in the same batch.
 * - Batches are separated by GO.
 * - When `validateExists` is true, each INSERT is guarded by an
 *   `IF NOT EXISTS` check against the table's primary key (or every column
 *   when there is no primary key), so rows that already exist in the
 *   destination are skipped instead of erroring out on a duplicate key.
 */
export function generateInsertScript(table, columns, rows, destSchema, validateExists = false) {
  const targetSchema = destSchema || table.schema;
  const udfMode      = isUdfTable(columns);
  const hasIdentity  = columns.some((c) => c.isIdentity);
  const keyColumns   = validateExists ? getExistenceKeyColumns(columns) : null;

  const batches = [];
  const encTablaEmitted = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (udfMode) {
      const tabla = colVal(row, 'TABLA');
      if (tabla && !encTablaEmitted.has(tabla)) {
        batches.push(buildEncTablaUdf(targetSchema, tabla));
        encTablaEmitted.add(tabla);
      }
    }

    const insertLines = [];
    if (hasIdentity) {
      insertLines.push(`SET IDENTITY_INSERT [${targetSchema}].[${table.name}] ON`);
    }
    insertLines.push(buildInsert(targetSchema, table.name, columns, row));
    if (hasIdentity) {
      insertLines.push(`SET IDENTITY_INSERT [${targetSchema}].[${table.name}] OFF`);
    }

    const stmt = keyColumns
      ? buildGuardedInsert(targetSchema, table.name, insertLines, keyColumns, row)
      : insertLines.join('\n');

    batches.push(`-- Fila ${i + 1}\n${stmt}`);

    if (udfMode) {
      const alter = buildAlterTable(targetSchema, row);
      if (alter) {
        batches.push(alter);
      }
    }
  }

  return batches.join('\nGO\n\n') + '\nGO';
}
