const { Supply } = require('../models/Supply');
const { SupplyMovement } = require('../models/SupplyMovement');
const { WeeklyReconciliation } = require('../models/WeeklyReconciliation');
const { Op } = require('sequelize');

// Obtener todos los insumos
exports.getAllSupplies = async (req, res) => {
    try {
        const supplies = await Supply.findAll();
        res.json(supplies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Crear un nuevo insumo (Catálogo)
exports.createSupply = async (req, res) => {
    const { name, unit_measure, min_stock } = req.body;
    try {
        const supply = await Supply.create({
            name,
            unit_measure,
            min_stock: parseFloat(min_stock) || 0,
            current_stock: 0
        });
        res.json(supply);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Registrar entrada semanal (Administradora)
exports.addWeeklySupply = async (req, res) => {
    const { supply_id, quantity, notes } = req.body;
    try {
        const supply = await Supply.findByPk(supply_id);
        if (!supply) return res.status(404).json({ message: 'Insumo no encontrado' });

        await SupplyMovement.create({
            supply_id,
            type: 'ENTRY_WEEKLY',
            quantity,
            notes
        });

        // Actualizar stock actual
        supply.current_stock += parseFloat(quantity);
        await supply.save();

        res.json({ message: 'Entrada registrada con éxito', current_stock: supply.current_stock });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Registrar consumo de turno (Cajera)
exports.recordUsage = async (req, res) => {
    const { supply_id, quantity, type, notes, user_name, usage_date } = req.body; // type: USAGE_MORNING o USAGE_AFTERNOON
    try {
        const supply = await Supply.findByPk(supply_id);
        if (!supply) return res.status(404).json({ message: 'Insumo no encontrado' });

        await SupplyMovement.create({
            supply_id,
            type,
            quantity,
            notes,
            user_name: user_name || 'Desconocido', // Valor por defecto si no se envía
            usage_date: usage_date || new Date()
        });


        // Restar del stock actual
        supply.current_stock -= parseFloat(quantity);
        await supply.save();

        res.json({ message: 'Consumo registrado con éxito', current_stock: supply.current_stock });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Realizar cierre/reconciliación semanal
// Realizar cierre/reconciliación semanal
exports.closeWeek = async (req, res) => {
    const { reconciliations, responsible, reconciliation_date } = req.body;
    try {
        const results = [];
        for (const item of reconciliations) {
            const supply = await Supply.findByPk(item.supply_id);
            if (supply) {
                const theoretical = supply.current_stock;
                const physical = parseFloat(item.physical_stock);
                const diff = physical - theoretical;

                await WeeklyReconciliation.create({
                    supply_id: supply.id,
                    theoretical_stock: theoretical,
                    physical_stock: physical,
                    difference: diff,
                    status: 'CLOSED',
                    responsible: responsible || 'Admin',
                    reconciliation_date: reconciliation_date || new Date()
                });

                // Ajustar stock real al físico
                supply.current_stock = physical;
                await supply.save();

                results.push({ name: supply.name, theoretical, physical_stock: physical, diff, last_count: item.last_count });
            }
        }
        res.json({ message: 'Cierre de semana completado', summary: results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Obtener historial de reconciliaciones
exports.getReconciliationHistory = async (req, res) => {
    try {
        const history = await WeeklyReconciliation.findAll({
            include: [{
                model: Supply,
                as: 'supply',
                attributes: ['name']
            }],
            order: [['reconciliation_date', 'DESC']]
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Generar tabla de corte semanal de insumos
exports.getWeeklyCutTable = async (req, res) => {
    try {
        const supplies = await Supply.findAll();
        const results = [];

        for (const supply of supplies) {
            // Último corte (reconciliation cerrado)
            const lastReconciliation = await WeeklyReconciliation.findOne({
                where: { supply_id: supply.id, status: 'CLOSED' },
                order: [['reconciliation_date', 'DESC']]
            });

            let ultimo_corte = 0;
            let fecha_ultimo_corte = null;
            let conditionDate = {};

            if (lastReconciliation) {
                ultimo_corte = lastReconciliation.physical_stock;
                fecha_ultimo_corte = lastReconciliation.reconciliation_date;
                // Filtrar movimientos posteriores a la fecha del último corte
                conditionDate = {
                    createdAt: { [Op.gt]: fecha_ultimo_corte }
                };
            }

            // Suma de entradas (compras) desde el último corte
            const movements = await SupplyMovement.findAll({
                where: {
                    supply_id: supply.id,
                    type: 'ENTRY_WEEKLY',
                    ...conditionDate
                }
            });

            const ultima_compra = movements.reduce((sum, mov) => sum + parseFloat(mov.quantity), 0);
            const stock_sistema = supply.current_stock;
            
            // Fórmula corregida según confirmación: (Corte + Compras) - Stock
            const total_gastado = (ultimo_corte + ultima_compra) - stock_sistema;

            results.push({
                insumo: supply.name,
                ultima_compra: ultima_compra,
                ultimo_corte: ultimo_corte,
                fecha_ultimo_corte: fecha_ultimo_corte,
                stock_sistema: stock_sistema,
                total_gastado: total_gastado
            });
        }

        res.json(results);
    } catch (error) {
        console.error("Error en getWeeklyCutTable:", error);
        res.status(500).json({ message: error.message });
    }
};

