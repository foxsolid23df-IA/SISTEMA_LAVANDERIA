import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { FiUploadCloud, FiFileText, FiX, FiCheck, FiAlertTriangle, FiDownload } from 'react-icons/fi';
import { productService } from '../../services/productService';
import './BulkImportModal.css';

const BulkImportModal = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    // Expected columns based on user template
    const EXPECTED_COLUMNS = [
        'Nombre', 'Categoría', 'Tipo_Cobro', 'Precio_Venta', 
        'Precio_Costo', 'Existencia', 'Stock_Minimo'
    ];

    // Download template
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                'Nombre': 'Servicio Ejemplo',
                'Categoría': 'Lavandería',
                'Tipo_Cobro': 'kg',
                'Precio_Venta': 20.00,
                'Precio_Costo': 5.00,
                'Existencia': 100,
                'Stock_Minimo': 10,
                'Codigo_Barras': '',
                'Descripcion': 'Ejemplo de servicio'
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_lavanderia.xlsx");
    };

    // Handle File Selection
    const handleFile = (selectedFile) => {
        if (!selectedFile) return;

        const fileType = selectedFile.name.split('.').pop().toLowerCase();
        if (fileType !== 'xlsx' && fileType !== 'xls') {
            Swal.fire('Error', 'Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
            return;
        }

        setFile(selectedFile);
        parseExcel(selectedFile);
    };

    // Parse Excel File
    const parseExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (jsonData.length === 0) {
                    Swal.fire('Error', 'El archivo parece estar vacío', 'warning');
                    setFile(null);
                    return;
                }

                // Basic validation of columns (check if at least some key columns exist)
                const headers = Object.keys(jsonData[0]);
                const missingColumns = EXPECTED_COLUMNS.filter(col => 
                    !headers.some(h => h.trim().toLowerCase() === col.toLowerCase())
                );
                
                // Allow some flexibility, but warn
                /* 
                if (missingColumns.length > 3) {
                     Swal.fire('Error', `Faltan columnas importantes: ${missingColumns.join(', ')}`, 'error');
                     return;
                }
                */

                setPreviewData(jsonData);
                setStep(2);
            } catch (error) {
                console.error('Error parsing excel:', error);
                Swal.fire('Error', 'No se pudo leer el archivo Excel', 'error');
                setFile(null);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Drag and Drop handlers
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    // Process and Upload Data
    const handleUpload = async () => {
        setUploading(true);
        try {
            // Map Excel data to DB schema
            const mappedProducts = previewData.map(row => {
                // Helper to safely get value case-insensitively and handle spaces/underscores
                const getVal = (keys) => {
                    const normalizedKeys = Array.isArray(keys) ? keys : [keys];
                    for (const key of normalizedKeys) {
                        const foundKey = Object.keys(row).find(k => 
                            k.trim().toLowerCase().replace(/_/g, ' ') === key.toLowerCase().replace(/_/g, ' ') ||
                            k.trim().toLowerCase() === key.toLowerCase()
                        );
                        if (foundKey) return row[foundKey];
                    }
                    return null;
                };

                return {
                    barcode: getVal(['Codigo_Barras', 'Codigo', 'Barcode']) ? String(getVal(['Codigo_Barras', 'Codigo', 'Barcode'])) : null,
                    name: getVal(['Nombre', 'Producto', 'Descripcion']) || 'Producto Sin Nombre',
                    cost_price: parseFloat(getVal(['Precio_Costo', 'Precio Costo', 'Costo']) || 0),
                    price: parseFloat(getVal(['Precio_Venta', 'Precio Venta', 'Precio']) || 0),
                    wholesale_price: parseFloat(getVal(['Precio_Mayoreo', 'Precio Mayoreo', 'Mayoreo']) || 0),
                    stock: parseInt(getVal(['Existencia', 'Stock', 'Cantidad']) || 0),
                    min_stock: parseInt(getVal(['Stock_Minimo', 'Inv. Minimo', 'Minimo']) || 0),
                    category: getVal(['Categoría', 'Categoria', 'Departamento']) || 'General',
                    pricing_type: getVal(['Tipo_Cobro', 'Unidad']) || 'unit', // kg o unit
                    description: getVal(['Descripcion', 'Notas']) || ''
                };
            }).filter(p => p.name && p.price >= 0); // Basic filter

            if (mappedProducts.length === 0) {
                throw new Error("No se encontraron productos válidos para importar");
            }

            // Send to backend
            // Note: Currently using bulkCreateProducts which performs inserts.
            // Ideally we would check for duplicates or use upsert if supported by backend logic.
            // For now, we assume new products or rely on DB constraints (though no unique constraint on barcode yet).
            // A robust way would be to check barcodes first, but for bulk speed we might just try insert.
            
            await productService.bulkCreateProducts(mappedProducts);

            Swal.fire({
                icon: 'success',
                title: 'Importación Completada',
                text: `Se han procesado ${mappedProducts.length} productos correctamente.`,
            });
            onSuccess();
            onClose();

        } catch (error) {
            console.error('Upload error:', error);
            Swal.fire('Error', 'Hubo un problema al guardar los productos. ' + (error.message || ''), 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content bulk-import-modal" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    <FiX />
                </button>

                <div className="modal-header">
                    <h2><FiUploadCloud className="icon-mr" /> Importación Masiva</h2>
                    <p>Sube tu inventario usando una plantilla de Excel</p>
                </div>

                <div className="modal-body">
                    {step === 1 && (
                        <div className="upload-step">
                            <div 
                                className={`drop-zone ${dragActive ? 'active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current.click()}
                            >
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    onChange={(e) => handleFile(e.target.files[0])}
                                    style={{ display: 'none' }} 
                                />
                                <div className="drop-content">
                                    <FiUploadCloud className="upload-icon" />
                                    <h3>Arrastra tu archivo Excel aquí</h3>
                                    <p>o haz clic para seleccionar</p>
                                    <span className="file-types">Soporta .xlsx, .xls</span>
                                </div>
                            </div>
                            
                            <div className="template-section">
                                <p>¿No tienes la plantilla?</p>
                                <button className="text-btn" onClick={handleDownloadTemplate}>
                                    <FiDownload /> Descargar Plantilla de Ejemplo
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="preview-step">
                            <div className="preview-header">
                                <div className="file-info">
                                    <FiFileText />
                                    <span>{file?.name}</span>
                                    <span className="badge">{previewData.length} productos</span>
                                </div>
                                <button className="text-link" onClick={() => { setStep(1); setFile(null); }}>
                                    Cambiar archivo
                                </button>
                            </div>

                            <div className="preview-table-wrapper">
                                <table className="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Código</th>
                                            <th>Descripción</th>
                                            <th>Costo</th>
                                            <th>Venta</th>
                                            <th>Existencia</th>
                                            <th>Depto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.slice(0, 10).map((row, index) => (
                                            <tr key={index}>
                                                <td>{row['Codigo'] || row['codigo'] || '-'}</td>
                                                <td>{row['Descripcion'] || row['descripcion'] || '-'}</td>
                                                <td>${Number(row['Precio Costo'] || 0).toFixed(2)}</td>
                                                <td>${Number(row['Precio Venta'] || 0).toFixed(2)}</td>
                                                <td>{row['Existencia'] || 0}</td>
                                                <td>{row['Departamento'] || 'General'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {previewData.length > 10 && (
                                    <div className="preview-footer">
                                        ... y {previewData.length - 10} más
                                    </div>
                                )}
                            </div>

                            <div className="validation-warning">
                                <FiAlertTriangle />
                                <p>Asegúrate de que los códigos de barras sean únicos para evitar duplicados.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose} disabled={uploading}>
                        Cancelar
                    </button>
                    {step === 2 && (
                        <button 
                            className="confirm-btn" 
                            onClick={handleUpload}
                            disabled={uploading}
                        >
                            {uploading ? 'Importando...' : 'Importar Productos'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkImportModal;
