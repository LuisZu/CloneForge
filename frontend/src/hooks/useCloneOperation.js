import { fetchDDL, executeScripts } from '../api/cloneforge';
import useAppStore from '../store/appStore';

const BATCH_SIZE = 5;

export function useCloneOperation() {
  const {
    sourceConfig,
    destConfig,
    destSchema,
    includeData,
    selectedObjects,
    setCloneLoading,
    setCloneResults,
    setShowResults,
    showToast,
  } = useAppStore();

  async function clone() {
    if (!selectedObjects.length) return;
    setCloneLoading(true);

    try {
      // Fetch DDLs in parallel batches of BATCH_SIZE
      const scriptsWithDDL = [];
      for (let i = 0; i < selectedObjects.length; i += BATCH_SIZE) {
        const batch = selectedObjects.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((obj) =>
            fetchDDL(sourceConfig, obj, obj.type === 'TABLA' ? includeData : false)
              .then((ddl) => ({ ...obj, ddl }))
          )
        );
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'fulfilled') {
            scriptsWithDDL.push(results[j].value);
          } else {
            // Record DDL fetch failure as a failed result
            scriptsWithDDL.push({
              ...batch[j],
              ddl: null,
              _ddlError: results[j].reason?.response?.data?.error || results[j].reason?.message,
            });
          }
        }
      }

      // Separate objects where DDL fetch failed
      const failed = scriptsWithDDL
        .filter((s) => !s.ddl)
        .map((s) => ({
          id: s.id,
          name: s.name,
          schema: s.schema,
          type: s.type,
          success: false,
          error: s._ddlError || 'No se pudo obtener el DDL',
        }));

      const toExecute = scriptsWithDDL.filter((s) => s.ddl);

      let execResults = { results: [], summary: { total: 0, succeeded: 0, failed: 0 } };
      if (toExecute.length > 0) {
        execResults = await executeScripts(destConfig, toExecute, destSchema);
      }

      const allResults = [...failed, ...execResults.results];
      const succeeded = allResults.filter((r) => r.success).length;

      setCloneResults({
        results: allResults,
        summary: {
          total: allResults.length,
          succeeded,
          failed: allResults.length - succeeded,
        },
      });
      setShowResults(true);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setCloneLoading(false);
    }
  }

  return { clone };
}
