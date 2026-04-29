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
 */
export function generateInsertScript(table, columns, rows, destSchema) {
  const targetSchema = destSchema || table.schema;
  const udfMode      = isUdfTable(columns);
  const hasIdentity  = columns.some((c) => c.isIdentity);

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

    const lines = [];
    if (hasIdentity) {
      lines.push(`SET IDENTITY_INSERT [${targetSchema}].[${table.name}] ON`);
    }
    lines.push(buildInsert(targetSchema, table.name, columns, row));
    if (hasIdentity) {
      lines.push(`SET IDENTITY_INSERT [${targetSchema}].[${table.name}] OFF`);
    }

    batches.push(`-- Fila ${i + 1}\n${lines.join('\n')}`);

    if (udfMode) {
      const alter = buildAlterTable(targetSchema, row);
      if (alter) {
        batches.push(alter);
      }
    }
  }

  return batches.join('\nGO\n\n') + '\nGO';
}
