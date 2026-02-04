const { Supply } = require('../models/Supply');
const { SupplyMovement } = require('../models/SupplyMovement');
const { WeeklyReconciliation } = require('../models/WeeklyReconciliation');

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

                results.push({ name: supply.name, theoretical, physical, diff });
            }
        }
        res.json({ message: 'Cierre de semana completado', summary: results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

