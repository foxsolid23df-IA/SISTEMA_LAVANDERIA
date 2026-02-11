import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { FiUploadCloud, FiFileText, FiX, FiCheck, FiAlertTriangle, FiDownload } from 'react-icons/fi';
import { customerService } from '../../services/customerService';
import '../inventory/BulkImportModal.css'; // Reusing existing styles

const BulkCustomerImportModal = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    // Expected columns
    const EXPECTED_COLUMNS = ['Nombre', 'Apellidos', 'Email', 'Telefono', 'Municipio', 'Estado', 'Codigo postal', 'Notas'];

    // Download template
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                'Nombre': 'Juan',
                'Apellidos': 'Pérez García',
                'Email': 'juan@ejemplo.com',
                'Telefono': '5512345678',
                'Municipio': 'Benito Juárez',
                'Estado': 'CDMX',
                'Codigo postal': '03100',
                'Notas': 'Cliente frecuente'
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Clientes");
        XLSX.writeFile(wb, "plantilla_clientes.xlsx");
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

    // Helper to normalize strings for comparison (remove accents, trim, lowercase, remove ALL non-alphanumeric)
    const normalize = (str) => {
        if (!str) return "";
        return String(str)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^a-z0-9]/gi, "")      // Remove anything not letters or numbers
            .toLowerCase();
    };

    const getValFromRow = (row, keys) => {
        const normalizedSearchKeys = (Array.isArray(keys) ? keys : [keys]).map(k => normalize(k));
        const foundKey = Object.keys(row).find(k => {
            const normalizedRowKey = normalize(k);
            return normalizedSearchKeys.some(sk => normalizedRowKey.includes(sk));
        });
        return foundKey ? row[foundKey] : null;
    };

    // Process and Upload Data
    const handleUpload = async () => {
        if (uploading) return;
        setUploading(true);
        
        try {
            if (!previewData || previewData.length === 0) {
                throw new Error("No hay datos para importar.");
            }

            console.log('--- STARTING BULK IMPORT ---');
            console.log('Total input rows:', previewData.length);
            
            // Define keyword sets for mapping
            const NAME_KEYWORDS = ['nombre', 'nombres', 'cliente', 'name', 'fullname', 'nombrecompleto'];
            const LASTNAME_KEYWORDS = ['apellido', 'apellidos', 'lastname', 'surname'];
            const PHONE_KEYWORDS = ['telefono', 'phone', 'tel', 'celular', 'cel', 'movil', 'whatsapp', 'contacto', 'tel1', 'tel2'];
            const ADDRESS_KEYWORDS = ['direccion', 'address', 'ubicacion', 'domicilio', 'calle', 'domicilio1', 'domicilio2', 'colonia', 'municipio', 'ciudad'];
            const EMAIL_KEYWORDS = ['email', 'correo', 'mail', 'contactoemail'];
            const MUNICIP_KEYWORDS = ['municipio', 'localidad', 'ciudad', 'poblacion'];
            const STATE_KEYWORDS = ['estado', 'provincia', 'region'];
            const CP_KEYWORDS = ['codigopostal', 'cp', 'zip', 'zipcode', 'postcode'];
            const NOTES_KEYWORDS = ['notas', 'observaciones', 'comentarios', 'nota', 'info'];

            // Map Excel data to DB schema using a Collector pattern
            const mappedCustomers = previewData.map((row, idx) => {
                const nameParts = [];
                const lastnameParts = [];
                const phoneParts = [];
                const addressParts = [];
                const emailParts = [];
                const municipParts = [];
                const stateParts = [];
                const cpParts = [];
                const notesParts = [];

                Object.keys(row).forEach(columnKey => {
                    const normKey = normalize(columnKey);
                    const value = row[columnKey];
                    
                    // Skip null/empty/whitespace values
                    if (value === null || value === undefined || String(value).trim() === '') return;
                    const cleanVal = String(value).trim();

                    // Match NAME
                    if (NAME_KEYWORDS.some(k => normKey === k || normKey === k + 's')) {
                        nameParts.push(cleanVal);
                    } 
                    // Match LASTNAME
                    else if (LASTNAME_KEYWORDS.some(k => normKey === k || normKey === k + 's' || normKey.includes(k))) {
                        lastnameParts.push(cleanVal);
                    }
                    // Match PHONE
                    else if (PHONE_KEYWORDS.some(k => normKey === k || normKey.startsWith(k) || normKey.includes(k))) {
                        // Avoid duplicates
                        if (!phoneParts.includes(cleanVal)) phoneParts.push(cleanVal);
                    }
                    // Match ADDRESS
                    else if (ADDRESS_KEYWORDS.some(k => normKey === k || normKey.includes(k))) {
                        if (!addressParts.includes(cleanVal)) addressParts.push(cleanVal);
                    }
                    // Match EMAIL
                    else if (EMAIL_KEYWORDS.some(k => normKey === k || normKey.includes(k))) {
                        if (!emailParts.includes(cleanVal)) emailParts.push(cleanVal);
                    }
                    // Match MUNICIPIO
                    else if (MUNICIP_KEYWORDS.some(k => normKey === k || normKey.includes(k))) {
                        if (!municipParts.includes(cleanVal)) municipParts.push(cleanVal);
                    }
                    // Match STATE
                    else if (STATE_KEYWORDS.some(k => normKey === k || normKey.includes(k))) {
                        if (!stateParts.includes(cleanVal)) stateParts.push(cleanVal);
                    }
                    // Match CP
                    else if (CP_KEYWORDS.some(k => normKey === k || normKey.includes(k))) {
                        if (!cpParts.includes(cleanVal)) cpParts.push(cleanVal);
                    }
                    // Match NOTES
                    else if (NOTES_KEYWORDS.some(k => normKey === k || normKey.includes(k))) {
                        if (!notesParts.includes(cleanVal)) notesParts.push(cleanVal);
                    }
                });

                // Construct final name (Names + Surnames)
                const fullName = [...nameParts, ...lastnameParts].join(' ').trim();
                const primaryPhone = phoneParts[0] || null;
                const primaryEmail = emailParts[0] || null;
                
                // Construct full address using parts
                const addressArr = [...addressParts, ...municipParts, ...stateParts];
                if (cpParts[0]) addressArr.push(`CP ${cpParts[0]}`);
                const fullAddress = addressArr.join(', ').trim() || null;
                
                const notes = notesParts.join(' | ').trim() || null;

                return {
                    name: fullName,
                    phone: primaryPhone,
                    address: fullAddress,
                    email: primaryEmail,
                    notes: notes
                };
            }).filter(c => c.name && c.name.length > 0);

            console.log('Final count of valid customers:', mappedCustomers.length);

            if (mappedCustomers.length === 0) {
                const sampleKeys = Object.keys(previewData[0] || {}).join(', ');
                throw new Error(`No se pudo extraer ningún cliente válido. Asegúrate de que las columnas tengan nombres como 'Nombre', 'Apellido', 'Teléfono', etc. Columnas detectadas: ${sampleKeys}`);
            }

            // Chunk inserts if data is very large (Supabase limit check)
            const chunkSize = 500;
            for (let i = 0; i < mappedCustomers.length; i += chunkSize) {
                const chunk = mappedCustomers.slice(i, i + chunkSize);
                await customerService.bulkCreateCustomers(chunk);
            }

            Swal.fire({
                icon: 'success',
                title: 'Importación Exitosa',
                text: `Se han importado ${mappedCustomers.length} clientes.`,
                confirmButtonColor: '#10b981'
            });
            
            onSuccess();
            onClose();

        } catch (error) {
            console.error('Bulk upload error:', error);
            Swal.fire('Error de Importación', error.message || 'Error desconocido al guardar los datos.', 'error');
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
                    <h2><FiUploadCloud className="icon-mr" /> Importación Masiva de Clientes</h2>
                    <p>Sube tu base de datos de clientes usando una plantilla de Excel</p>
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
                                    <span className="badge">{previewData.length} clientes</span>
                                </div>
                                <button className="text-link" onClick={() => { setStep(1); setFile(null); }}>
                                    Cambiar archivo
                                </button>
                            </div>

                            <div className="preview-table-wrapper">
                                <table className="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Teléfono</th>
                                            <th>Email</th>
                                            <th>Dirección</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.slice(0, 10).map((row, index) => (
                                            <tr key={index}>
                                                <td>{getValFromRow(row, ['Nombre', 'Cliente', 'Name', 'FullName']) || '-'}</td>
                                                <td>{getValFromRow(row, ['Telefono', 'Phone', 'Tel', 'Celular']) || '-'}</td>
                                                <td>{getValFromRow(row, ['Email', 'Correo', 'Mail']) || '-'}</td>
                                                <td className="truncate max-w-[200px]">
                                                    {[
                                                        getValFromRow(row, ['Direccion', 'Domicilio', 'Calle']),
                                                        getValFromRow(row, ['Municipio', 'Localidad']),
                                                        getValFromRow(row, ['Estado'])
                                                    ].filter(Boolean).join(', ') || '-'}
                                                </td>
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
                                <p>Los clientes con el mismo nombre y teléfono serán omitidos si ya existen (según reglas del sistema (si aplica)).</p>
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
                            {uploading ? 'Importando...' : 'Importar Clientes'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkCustomerImportModal;
