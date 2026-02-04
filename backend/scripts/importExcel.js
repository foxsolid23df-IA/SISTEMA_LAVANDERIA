const xlsx = require('xlsx');
const path = require('path');
const { Product } = require('../models/Product');
const sequelize = require('../db/conexion');

async function importData() {
    try {
        console.log('🚀 Iniciando migración desde Excel...');

        // El archivo debe estar en la carpeta backend/import/base_datos.xlsx
        const filePath = path.join(__dirname, '../import/base_datos.xlsx');
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        console.log(`📊 Se encontraron ${data.length} registros en el Excel.`);

        // Sincronizar la base de datos para asegurar que las nuevas columnas existan
        await sequelize.sync({ alter: true });

        let importedCount = 0;

        // Usar una transacción para mayor velocidad y evitar bloqueos parciales
        await sequelize.transaction(async (t) => {
            for (const row of data) {
                // Mapeo basado en la captura del cliente
                const name = row['Producto'] || row['PRODUCTO'];
                const barcode = String(row['Código'] || row['CODIGO'] || '');
                const cost_price = parseFloat(row['P. Costo'] || 0);
                const price = parseFloat(row['P. Venta'] || 0);
                const wholesale_price = parseFloat(row['P. Mayoreo'] || 0);
                const category = row['Departamento'] || row['DEPARTAMENTO'] || 'General';
                const stock = parseInt(row['Existencia'] || 0) || 0;
                const min_stock = parseInt(row['Inv. Mínimo'] || 0) || 0;
                const max_stock = parseInt(row['Inv. Máximo'] || 0) || 0;
                const unit_type = row['Tipo de Venta'] || 'UNIDAD';

                if (!name) continue;

                // Lógica de clasificación: ¿Es Servicio o Producto?
                let type = 'PRODUCT';
                const catLower = category.toLowerCase();
                const nameLower = name.toLowerCase();

                if (
                    catLower.includes('ropa') ||
                    catLower.includes('edredon') ||
                    catLower.includes('cortina') ||
                    catLower.includes('servicio') ||
                    catLower.includes('planchado') ||
                    nameLower.includes('kg') ||
                    nameLower.includes('lavado') ||
                    nameLower.includes('secado')
                ) {
                    type = 'SERVICE';
                }

                // Upsert dentro de la transacción
                const [product, created] = await Product.findOrCreate({
                    where: { name: name },
                    defaults: {
                        barcode: barcode || null,
                        price,
                        cost_price,
                        wholesale_price,
                        stock: type === 'SERVICE' ? 999999 : stock,
                        min_stock,
                        max_stock,
                        category,
                        unit_type,
                        type
                    },
                    transaction: t
                });

                if (!created) {
                    await product.update({
                        price,
                        cost_price,
                        wholesale_price,
                        stock: type === 'SERVICE' ? 999999 : stock,
                        category,
                        type
                    }, { transaction: t });
                }

                importedCount++;
                if (importedCount % 20 === 0) console.log(`🔄 Procesados ${importedCount} artículos...`);
            }
        });

        console.log(`✅ ¡Migración completada! ${importedCount} artículos procesados.`);

    } catch (error) {
        console.error('❌ Error durante la migración:', error.message);
        console.log('💡 Tip: Asegúrate de que el archivo excel esté en backend/import/base_datos.xlsx');
        process.exit(1);
    }
}

importData();
