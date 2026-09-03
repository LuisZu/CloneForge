const { Router } = require('express');
const ctrl = require('../controllers/destination.controller');

const router = Router();

router.post('/test', ctrl.testConnection);
router.post('/objects', ctrl.getObjects);
router.post('/columns', ctrl.getTableColumns);
router.post('/export-scripts', ctrl.exportScripts);
router.post('/execute', ctrl.executeScripts);
router.post('/insert-rows', ctrl.insertRows);
router.post('/run-script', ctrl.runScript);

module.exports = router;
