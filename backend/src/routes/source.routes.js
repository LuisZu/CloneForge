const { Router } = require('express');
const ctrl = require('../controllers/source.controller');

const router = Router();

router.post('/test', ctrl.testConnection);
router.post('/objects', ctrl.getObjects);
router.post('/ddl', ctrl.getDDL);

module.exports = router;
