const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');

// Listar impresoras del sistema
router.get('/list', printerController.getPrinters);

// Imprimir ticket
router.post('/print', printerController.printTicket);

module.exports = router;
