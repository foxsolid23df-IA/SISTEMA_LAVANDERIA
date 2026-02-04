const express = require('express');
const router = express.Router();
const supplyController = require('../controllers/supplyController');

router.get('/', supplyController.getAllSupplies);
router.post('/', supplyController.createSupply);
router.post('/add-weekly', supplyController.addWeeklySupply);
router.post('/record-usage', supplyController.recordUsage);
router.post('/reconciliation', supplyController.closeWeek);

module.exports = router;
