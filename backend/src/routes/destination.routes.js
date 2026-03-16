const { Router } = require('express');
const ctrl = require('../controllers/destination.controller');

const router = Router();

router.post('/test', ctrl.testConnection);
router.post('/execute', ctrl.executeScripts);

module.exports = router;
