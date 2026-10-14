import { useState } from 'react';
import { fetchDDL, executeScripts, exportScripts, copyTableData } from '../api/cloneforge';
import useAppStore from '../store/appStore';

// How many DDLs are fetched from the source in parallel at once.
const DDL_FETCH_CONCURRENCY = 5;

// How many objects are sent to the destination per /execute request. Keeping
// this bounded — instead of sending all selected objects in a single request
// — matters once you're cloning hundreds/thousands of objects: it keeps each
// request well under the body-size limit, avoids tripping any reverse-proxy
// timeout (e.g. IIS/ARR) sitting in front of the backend, and means a single
// failed chunk doesn't wipe out the results of everything already done.
const EXECUTE_CHUNK_SIZE = 20;

// How many tables copy their data concurrently. Each copy opens two DB
// connections and streams rows server-to-server, so this stays modest.
const DATA_COPY_CONCURRENCY = 3;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function useCloneOperation() {
  const [exportLoading, setExportLoading] = useState(false);

  const {
    sourceConfig,
    destConfig,
    destSchema,
    includeData,
    truncateBeforeData,
    overwriteExisting,
    textReplacements,
    selectedObjects,
    setCloneLoading,
    setCloneResults,
    setShowResults,
    setCloneProgress,
    setCloneLiveLog,
    appendCloneLiveLog,
    patchCloneLiveLog,
    showToast,
  } = useAppStore();

  // Fetches DDL for a set of objects, DDL_FETCH_CONCURRENCY at a time.
  // Objects whose DDL fails to fetch are kept in the list with ddl: null so
  // the caller can report them as failed without aborting the rest.
  async function fetchDDLsFor(objects, { includeTableData } = {}) {
    const scriptsWithDDL = [];
    for (let i = 0; i < objects.length; i += DDL_FETCH_CONCURRENCY) {
      const batch = objects.slice(i, i + DDL_FETCH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((obj) => {
          const wantsData = includeTableData && obj.type === 'TABLA' && includeData;
          return fetchDDL(
            sourceConfig,
            obj,
            wantsData,
            wantsData ? truncateBeforeData : false
          ).then((ddl) => ({ ...obj, ddl }));
        })
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          scriptsWithDDL.push(results[j].value);
        } else {
          scriptsWithDDL.push({
            ...batch[j],
            ddl: null,
            _ddlError: results[j].reason?.response?.data?.error || results[j].reason?.message,
          });
        }
      }
    }
    return scriptsWithDDL;
  }

  // Copies table rows directly source DB -> destination DB (server-side,
  // paginated — see copyTableData), DATA_COPY_CONCURRENCY tables at a time.
  // Produces one synthetic "<table> (datos)" result row per table so its
  // outcome shows up in the results modal alongside the structure's.
  // `onItemDone` fires as soon as EACH table's copy resolves — not after the
  // whole DATA_COPY_CONCURRENCY-sized group finishes — so the live log can
  // show a table as done the moment it's actually done, while still never
  // running more than DATA_COPY_CONCURRENCY copies at once.
  async function copyDataForTables(tableObjects, onItemDone) {
    const results = [];
    for (let i = 0; i < tableObjects.length; i += DATA_COPY_CONCURRENCY) {
      const batch = tableObjects.slice(i, i + DATA_COPY_CONCURRENCY);
      await Promise.all(
        batch.map(async (obj) => {
          let result;
          try {
            const { copied } = await copyTableData(sourceConfig, destConfig, obj.schema, obj.name, destSchema, truncateBeforeData);
            result = {
              id: `${obj.id}__data`,
              schema: obj.schema,
              name: `${obj.name} (datos)`,
              type: obj.type,
              status: 'success',
              success: true,
              error: null,
              note: `${(copied ?? 0).toLocaleString()} fila${copied === 1 ? '' : 's'} copiada${copied === 1 ? '' : 's'}`,
            };
          } catch (err) {
            result = {
              id: `${obj.id}__data`,
              schema: obj.schema,
              name: `${obj.name} (datos)`,
              type: obj.type,
              status: 'error',
              success: false,
              error: err?.response?.data?.error || err?.message || 'Error al copiar los datos',
            };
          }
          results.push(result);
          onItemDone?.(result);
        })
      );
    }
    return results;
  }

  // `objectsOverride` lets a caller (e.g. "retry failed" from the results
  // modal) run the clone against a specific set of objects without first
  // having to call setSelectedObjects and wait for a re-render — this
  // function would otherwise still close over the stale `selectedObjects`
  // from the render that created it.
  async function clone(afterClone, objectsOverride) {
    const objectsToClone = objectsOverride ?? selectedObjects;
    if (!objectsToClone.length) return;
    setCloneLoading(true);

    const chunks = chunk(objectsToClone, EXECUTE_CHUNK_SIZE);
    const allResults = [];
    setCloneProgress({ done: 0, total: objectsToClone.length, batch: 0, batchCount: chunks.length });
    setCloneLiveLog([]);

    try {
      for (let c = 0; c < chunks.length; c++) {
        const chunkObjects = chunks[c];

        // Show every object in this chunk as "pending" right away — the
        // structure call below resolves them all at once (the backend runs
        // the whole chunk in one request), but the user sees them start
        // immediately instead of the log sitting empty until it returns.
        appendCloneLiveLog(
          chunkObjects.map((obj) => ({ id: obj.id, schema: obj.schema, name: obj.name, type: obj.type, status: 'pending' }))
        );

        try {
          // Structure only (CREATE TABLE/indexes/FKs, or the object's own
          // definition) — row data for tables is handled separately below,
          // server-to-server, so it never has to be held in memory here as
          // one giant embedded-INSERT string.
          const scriptsWithDDL = await fetchDDLsFor(chunkObjects, { includeTableData: false });

          const ddlFailed = scriptsWithDDL
            .filter((s) => !s.ddl)
            .map((s) => ({
              id: s.id,
              name: s.name,
              schema: s.schema,
              type: s.type,
              status: 'error',
              success: false,
              error: s._ddlError || 'No se pudo obtener el DDL',
            }));

          const toExecute = scriptsWithDDL.filter((s) => s.ddl);

          let execResults = [];
          if (toExecute.length > 0) {
            const activeReplacements = textReplacements.filter((r) => r.find.trim());
            const res = await executeScripts(destConfig, toExecute, destSchema, activeReplacements, overwriteExisting);
            execResults = res.results;
          }

          allResults.push(...ddlFailed, ...execResults);
          patchCloneLiveLog([...ddlFailed, ...execResults]);

          // Only copy data for tables whose structure is confirmed present
          // in destination this round (freshly created, or already there).
          if (includeData) {
            const readyIds = new Set(
              execResults.filter((r) => r.status === 'success' || r.status === 'exists').map((r) => r.id)
            );
            const tablesNeedingData = chunkObjects.filter(
              (obj) => obj.type === 'TABLA' && readyIds.has(obj.id)
            );
            if (tablesNeedingData.length > 0) {
              appendCloneLiveLog(
                tablesNeedingData.map((obj) => ({
                  id: `${obj.id}__data`, schema: obj.schema, name: `${obj.name} (datos)`, type: obj.type, status: 'pending',
                }))
              );
              const dataResults = await copyDataForTables(tablesNeedingData, (result) => patchCloneLiveLog([result]));
              allResults.push(...dataResults);
            }
          }
        } catch (err) {
          // The whole chunk's request failed (connection drop, destination
          // timeout, etc.) — record every object in this chunk as failed
          // with that reason, and keep going with the remaining chunks
          // instead of discarding everything processed so far.
          const message = err.response?.data?.error || err.message || 'Error al ejecutar el lote en destino';
          const failedEntries = chunkObjects.map((obj) => ({
            id: obj.id,
            name: obj.name,
            schema: obj.schema,
            type: obj.type,
            status: 'error',
            success: false,
            error: message,
          }));
          allResults.push(...failedEntries);
          patchCloneLiveLog(failedEntries);
        }

        setCloneProgress({
          done: Math.min((c + 1) * EXECUTE_CHUNK_SIZE, objectsToClone.length),
          total: objectsToClone.length,
          batch: c + 1,
          batchCount: chunks.length,
        });
      }

      const succeeded = allResults.filter((r) => r.status === 'success').length;
      const exists    = allResults.filter((r) => r.status === 'exists').length;
      const failed    = allResults.filter((r) => r.status === 'error').length;

      setCloneResults({
        mode: 'full',
        results: allResults,
        summary: { total: allResults.length, succeeded, exists, failed },
      });
      setShowResults(true);
      if (afterClone) afterClone();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setCloneLoading(false);
      setCloneProgress(null);
      setCloneLiveLog([]);
    }
  }

  // Copies table rows only — no CREATE TABLE/indexes/FKs — for when the
  // destination structure already matches and the user just wants to sync
  // data. Non-table objects in the selection can't do anything here (there's
  // no "data" to copy for a view/SP/trigger), so they're reported as skipped
  // instead of silently dropped.
  async function cloneDataOnly(afterClone, objectsOverride) {
    const objectsToClone = objectsOverride ?? selectedObjects;
    if (!objectsToClone.length) return;

    const tableObjects = objectsToClone.filter((o) => o.type === 'TABLA');
    const skipped = objectsToClone
      .filter((o) => o.type !== 'TABLA')
      .map((o) => ({
        id: o.id,
        name: o.name,
        schema: o.schema,
        type: o.type,
        status: 'error',
        success: false,
        error: 'Esta opción solo copia datos de tablas — el objeto fue omitido.',
      }));

    if (tableObjects.length === 0) {
      showToast('Selecciona al menos una tabla para cargar solo datos', 'error');
      return;
    }

    setCloneLoading(true);
    setCloneLiveLog([
      ...tableObjects.map((obj) => ({
        id: `${obj.id}__data`, schema: obj.schema, name: `${obj.name} (datos)`, type: obj.type, status: 'pending',
      })),
      ...skipped,
    ]);
    setCloneProgress({ done: 0, total: tableObjects.length, batch: 0, batchCount: 1 });

    let done = 0;
    try {
      const dataResults = await copyDataForTables(tableObjects, (result) => {
        patchCloneLiveLog([result]);
        done += 1;
        setCloneProgress({ done, total: tableObjects.length, batch: 1, batchCount: 1 });
      });

      const allResults = [...skipped, ...dataResults];
      const succeeded = allResults.filter((r) => r.status === 'success').length;
      const failed    = allResults.filter((r) => r.status === 'error').length;

      setCloneResults({
        mode: 'dataOnly',
        results: allResults,
        summary: { total: allResults.length, succeeded, exists: 0, failed },
      });
      setShowResults(true);
      if (afterClone) afterClone();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setCloneLoading(false);
      setCloneProgress(null);
      setCloneLiveLog([]);
    }
  }

  // Export still embeds table data as literal INSERT text, same as before —
  // the whole point here is one portable, self-contained .sql file, so for
  // tables with very large row counts this can still use significant memory.
  // Prefer "Clonar Seleccionados" (now server-to-server and paginated) over
  // "Exportar Script" when including data for very large tables.
  async function exportScript(onSql) {
    if (!selectedObjects.length) return;
    setExportLoading(true);
    try {
      const scriptsWithDDL = await fetchDDLsFor(selectedObjects, { includeTableData: true });
      const activeReplacements = textReplacements.filter((r) => r.find.trim());
      const sql = await exportScripts(
        scriptsWithDDL.filter((s) => s.ddl),
        destSchema,
        activeReplacements,
        overwriteExisting
      );
      if (onSql) onSql(sql);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setExportLoading(false);
    }
  }

  return { clone, cloneDataOnly, exportScript, exportLoading };
}
