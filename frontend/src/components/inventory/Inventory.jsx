import React, { useState, useEffect } from 'react';
import './Inventory.css';
import { productService } from '../../services/productService';
import Swal from 'sweetalert2';
import { useProducts } from '../../contexts/ProductContext';
import { supabase } from '../../supabase';

// Icons
import * as XLSX from 'xlsx';
import { 
    FiPlus, 
    FiEdit2, 
    FiTrash2, 
    FiX, 
    FiSave, 
    FiMoreVertical, 
    FiFilter, 
    FiSettings,
    FiDownload,
    FiUpload
} from 'react-icons/fi';

const Inventory = ({ mode = 'SERVICE' }) => {
    const isServiceMode = mode === 'SERVICE';

    const { 
        productos: products, 
        loading, 
        loadProducts: fetchProducts 
    } = useProducts();
    
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Actions Menu State
    const [activeMenuId, setActiveMenuId] = useState(null);

    // Filters State
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [filters, setFilters] = useState({
        category: 'all',
        minPrice: '',
        maxPrice: ''
    });

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category: '',
        pricing_type: 'unit',
        cost_price: '',
        wholesale_price: '',
        stock: '9999',
        min_stock: '0',
        barcode: '',
        type: mode
    });



    // Modal State de Semilla
    const [isSeeding, setIsSeeding] = useState(false);

    // Categories Management State
    const [showCategoriesModal, setShowCategoriesModal] = useState(false);
    const [customCategories, setCustomCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editedCategoryName, setEditedCategoryName] = useState('');

    // Cargar categorías personalizadas desde localStorage
    useEffect(() => {
        const savedCategories = localStorage.getItem('customCategories');
        if (savedCategories) {
            try {
                setCustomCategories(JSON.parse(savedCategories));
            } catch (error) {
                console.error('Error al cargar categorías personalizadas:', error);
            }
        }
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
            setFormData({
                name: '',
                price: '',
                category: '',
                pricing_type: 'unit',
                cost_price: '',
                wholesale_price: '',
                stock: isServiceMode ? '9999' : '0',
                min_stock: '0',
                barcode: '',
                type: mode
            });

        setEditingProduct(null);
    };


    const handleOpenModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                price: product.price,
                category: product.category || 'General',
                pricing_type: product.pricing_type || 'unit',
                cost_price: product.cost_price || '',
                wholesale_price: product.wholesale_price || '',
                stock: product.stock !== undefined ? String(product.stock) : '9999',
                min_stock: product.min_stock !== undefined ? String(product.min_stock) : '0',
                barcode: product.barcode || '',
                type: product.type || 'SERVICE'
            });

        } else {
            resetForm();
        }
        setShowModal(true);
    };


    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.price || !formData.category) {
            Swal.fire('Error', 'Por favor completa todos los campos obligatorios', 'warning');
            return;
        }

        try {
            const productData = {
                name: formData.name,
                price: parseFloat(formData.price),
                cost_price: parseFloat(formData.cost_price || 0),
                wholesale_price: parseFloat(formData.wholesale_price || 0),
                stock: parseInt(formData.stock || 0),
                min_stock: parseInt(formData.min_stock || 0),
                barcode: formData.barcode || null,
                category: formData.category,
                pricing_type: formData.pricing_type || 'unit',
                type: formData.type || mode
            };


            if (editingProduct) {
                await productService.updateProduct(editingProduct.id, productData);
                Swal.fire('Actualizado', `${isServiceMode ? 'Servicio' : 'Producto'} actualizado correctamente`, 'success');
            } else {
                await productService.createProduct(productData);
                Swal.fire('Creado', `${isServiceMode ? 'Servicio' : 'Producto'} creado correctamente`, 'success');
            }

            handleCloseModal();
            fetchProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            Swal.fire('Error', `Error al guardar el ${isServiceMode ? 'servicio' : 'producto'}`, 'error');
        }
    };


    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "Se eliminará este servicio del catálogo",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await productService.deleteProduct(id);
                Swal.fire('Eliminado', `${isServiceMode ? 'Servicio' : 'Producto'} eliminado`, 'success');
                fetchProducts();
            } catch (error) {
                console.error('Error deleting product:', error);
                Swal.fire('Error', `No se pudo eliminar el ${isServiceMode ? 'servicio' : 'producto'}`, 'error');
            }
        }

    };

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredProducts.map(p => ({
                'Código': p.barcode || '',
                'Producto': p.name,
                'P. Costo': p.cost_price || 0,
                'P. Venta': p.price || 0,
                'P. Mayoreo': p.wholesale_price || 0,
                'Departamento': p.category || 'General',
                'Existencia': p.stock || 0,
                'Inv. Mínimo': p.min_stock || 0,
                'Tipo de Venta': p.pricing_type === 'kg' ? 'Por Kilo' : 'Por Unidad'
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, isServiceMode ? "Servicios" : "Productos");

            
            // Auto-ajustar ancho de columnas
            const maxWidths = [
                { wch: 15 }, // Código
                { wch: 40 }, // Producto
                { wch: 10 }, // P. Costo
                { wch: 10 }, // P. Venta
                { wch: 10 }, // P. Mayoreo
                { wch: 20 }, // Departamento
                { wch: 10 }, // Existencia
                { wch: 10 }, // Inv. Mínimo
                { wch: 15 }  // Tipo de Venta
            ];
            worksheet['!cols'] = maxWidths;

            XLSX.writeFile(workbook, isServiceMode ? "Catalogo_Servicios_Lavanderia.xlsx" : "Catalogo_Productos_Lavanderia.xlsx");

        } catch (error) {
            console.error('Error exporting excel:', error);
            Swal.fire('Error', 'No se pudo exportar el archivo Excel', 'error');
        }
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const dataArray = new Uint8Array(evt.target.result);
                const wb = XLSX.read(dataArray, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    Swal.fire('Error', 'El archivo está vacío o no tiene el formato correcto.', 'error');
                    return;
                }

                console.log('[Import] Datos crudos detectados:', data[0]);

                // Ayudante robusto para obtener valores (ignora espacios, puntos, acentos y mayúsculas)
                const getVal = (row, searchKeys) => {
                    const rowKeys = Object.keys(row);
                    const normalize = (s) => s.toString().toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
                        .replace(/[^a-z0-9]/g, ''); // Quitar todo lo no alfanumérico

                    for (const searchKey of searchKeys) {
                        const normalizedSearchKey = normalize(searchKey);
                        const foundKey = rowKeys.find(k => normalize(k) === normalizedSearchKey);
                        if (foundKey !== undefined) return row[foundKey];
                    }
                    return null;
                };

                // Validar si encontramos al menos la columna del nombre del producto
                const firstRow = data[0];
                const hasName = getVal(firstRow, ['Producto', 'Servicio', 'Nombre', 'Descripción', 'Descripcion', 'Articulo']);
                
                if (!hasName && hasName !== 0) {
                    console.warn('[Import] Encabezados encontrados:', Object.keys(firstRow));
                    Swal.fire({
                        title: 'Error de Formato',
                        text: 'No se encontró la columna "Producto" o "Servicio". Asegúrate de que tu Excel tenga encabezados en la primera fila.',
                        icon: 'error'
                    });
                    return;
                }

                const servicesToImport = data.map(item => {
                    // Mapeo exacto basado en la captura de consola: 
                    // { Código: "1", Producto: "ROPA KG", P. Costo: "$100.00", P. Venta: "$10.00", P. Mayoreo: "$0.00", ... }
                    const rawName = getVal(item, ['Producto', 'Servicio', 'Descripcion', 'Nombre', 'Articulo']);
                    
                    // Función interna para limpiar precios con símbolos de moneda o formato texto
                    const parseMoney = (val) => {
                        if (val === null || val === undefined) return 0;
                        if (typeof val === 'number') return val;
                        const cleaned = val.toString().replace(/[^0-9.-]/g, '');
                        return parseFloat(cleaned) || 0;
                    };

                    const rawPrice = getVal(item, ['P. Venta', 'Venta', 'Precio Venta', 'PVenta', 'Precio']);
                    const rawCost = getVal(item, ['P. Costo', 'Costo', 'Precio Costo', 'PCosto']);
                    const rawWholesale = getVal(item, ['P. Mayoreo', 'Mayoreo', 'Precio Mayoreo', 'PMayoreo']);
                    const rawCategory = getVal(item, ['Departamento', 'Categoría', 'Categoria', 'Depto', 'Seccion']);
                    const rawStock = getVal(item, ['Existencia', 'Stock', 'Cantidad', 'Cant']);
                    const rawMinStock = getVal(item, ['Inv. Mínimo', 'Inv. Minimo', 'Mínimo', 'Minimo', 'Stock Mínimo', 'Stock Minimo']);
                    const rawBarcode = getVal(item, ['Código', 'Codigo', 'Barcode', 'Cód. Barras', 'Cod. Barras', 'Cod']);
                    const rawType = getVal(item, ['Tipo de Venta', 'Tipo de Cobro', 'Unidad', 'Tipo']);

                    const parsedStock = (rawStock !== null && rawStock !== undefined && rawStock.toString().trim() !== '') 
                        ? parseInt(rawStock.toString().replace(/[^0-9]/g, '')) 
                        : 9999;
                    
                    const parsedMinStock = (rawMinStock !== null && rawMinStock !== undefined && rawMinStock.toString().trim() !== '')
                        ? parseInt(rawMinStock.toString().replace(/[^0-9]/g, ''))
                        : 0;

                    return {
                        name: rawName,
                        category: rawCategory || 'General',
                        price: parseMoney(rawPrice),
                        cost_price: parseMoney(rawCost),
                        wholesale_price: parseMoney(rawWholesale),
                        stock: isNaN(parsedStock) ? (isServiceMode ? 9999 : 0) : parsedStock,
                        min_stock: isNaN(parsedMinStock) ? 0 : parsedMinStock,
                        barcode: rawBarcode ? String(rawBarcode).trim() : null,
                        pricing_type: (rawType?.toString().toLowerCase().includes('kilo') || rawName?.toString().toLowerCase().includes(' kg')) ? 'kg' : 'unit',
                        unit_type: (rawType?.toString().toLowerCase().includes('kilo') || rawName?.toString().toLowerCase().includes(' kg')) ? 'kg' : 'unit',
                        type: mode
                    };

                }).filter(s => s.name && s.name.trim() !== ''); // Filtro simplificado para no fallar por el precio 0.00

                if (servicesToImport.length === 0) {
                    console.error('[Import] Error: No se generaron registros válidos después del mapeo.');
                    Swal.fire('Atención', 'No se pudieron procesar los registros. Verifica que la columna "Producto" tenga texto.', 'warning');
                    return;
                }

                const confirm = await Swal.fire({
                    title: 'Confirmar Importación',
                    text: `Se detectaron ${servicesToImport.length} ítems. ¿Deseas importarlos como ${isServiceMode ? 'servicios' : 'productos'} ahora?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, importar todo',
                    cancelButtonText: 'Cancelar'
                });


                if (confirm.isConfirmed) {
                    setIsSeeding(true);
                    await productService.bulkCreateProducts(servicesToImport);
                    Swal.fire('¡Listo!', `${isServiceMode ? 'Servicios' : 'Productos'} importados correctamente.`, 'success');
                    fetchProducts();

                }
            } catch (error) {
                console.error('Error importing excel:', error);
                Swal.fire('Error', 'Hubo un problema al procesar el archivo. Revisa que no esté protegido con contraseña.', 'error');
            } finally {
                setIsSeeding(false);
                e.target.value = ''; // Reset input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const seedServices = async () => {
        const services = [
            {"name": "Carga (4 kg)", "price": 90, "stock": 9999, "category": "Lavado de Ropa", "pricing_type": "unit"},
            {"name": "Kilo a partir de 5 kg", "price": 19, "stock": 9999, "category": "Lavado de Ropa", "pricing_type": "kg"},
            {"name": "Servicio de secado (Carga 4 kg)", "price": 65, "stock": 9999, "category": "Lavado de Ropa", "pricing_type": "unit"},
            {"name": "Carga toalla y sabanas (3kg)", "price": 90, "stock": 9999, "category": "Lavado de Ropa", "pricing_type": "unit"},
            {"name": "Kilo a partir de 4 kg", "price": 30, "stock": 9999, "category": "Lavado de Ropa", "pricing_type": "kg"},
            {"name": "Almohada Extra Grande", "price": 65, "stock": 9999, "category": "Blancos/Sabanas", "pricing_type": "unit"},
            {"name": "Almohada grande", "price": 40, "stock": 9999, "category": "Blancos/Sabanas", "pricing_type": "unit"},
            {"name": "Almohada mediana", "price": 30, "stock": 9999, "category": "Blancos/Sabanas", "pricing_type": "unit"},
            {"name": "Almohada chica", "price": 25, "stock": 9999, "category": "Blancos/Sabanas", "pricing_type": "unit"},
            {"name": "Bolsas", "price": 30, "stock": 9999, "category": "Varios", "pricing_type": "unit"},
            {"name": "Chamarra grande", "price": 60, "stock": 9999, "category": "Prendas", "pricing_type": "unit"},
            {"name": "Chamarra mediana", "price": 40, "stock": 9999, "category": "Prendas", "pricing_type": "unit"},
            {"name": "Chamarra chica", "price": 25, "stock": 9999, "category": "Prendas", "pricing_type": "unit"},
            {"name": "Cobertor especial", "price": 110, "stock": 9999, "category": "Cobertores", "pricing_type": "unit"},
            {"name": "Cobertor sencillo", "price": 80, "stock": 9999, "category": "Cobertores", "pricing_type": "unit"},
            {"name": "Colcha", "price": 100, "stock": 9999, "category": "Cama", "pricing_type": "unit"},
            {"name": "Colcha pequeña", "price": 50, "stock": 9999, "category": "Cama", "pricing_type": "unit"},
            {"name": "Cortina pza grande", "price": 70, "stock": 9999, "category": "Hogar", "pricing_type": "unit"},
            {"name": "Cortina pza mediana", "price": 50, "stock": 9999, "category": "Hogar", "pricing_type": "unit"},
            {"name": "Cortina pza chica", "price": 35, "stock": 9999, "category": "Hogar", "pricing_type": "unit"},
            {"name": "Cubre colchón (Según tamaño)", "price": 100, "stock": 9999, "category": "Cama", "pricing_type": "unit"},
            {"name": "Edredón (Matrimonial e individual)", "price": 150, "stock": 9999, "category": "Cama", "pricing_type": "unit"},
            {"name": "Gorras", "price": 15, "stock": 9999, "category": "Accesorios", "pricing_type": "unit"},
            {"name": "Hamaca", "price": 100, "stock": 9999, "category": "Hogar", "pricing_type": "unit"},
            {"name": "Mantel grande", "price": 55, "stock": 9999, "category": "Hogar", "pricing_type": "unit"},
            {"name": "Mantel mediano", "price": 40, "stock": 9999, "category": "Hogar", "pricing_type": "unit"},
            {"name": "Mantel chico", "price": 35, "stock": 9999, "category": "Hogar", "pricing_type": "unit"},
            {"name": "Peluches (Según tamaño desde)", "price": 25, "stock": 9999, "category": "Varios", "pricing_type": "unit"},
            {"name": "Tapete grande (Según tamaño)", "price": 70, "stock": 9999, "category": "Tapetes", "pricing_type": "unit"},
            {"name": "Tapete mediano", "price": 50, "stock": 9999, "category": "Tapetes", "pricing_type": "unit"},
            {"name": "Tapete chico", "price": 35, "stock": 9999, "category": "Tapetes", "pricing_type": "unit"},
            {"name": "Zarape", "price": 70, "stock": 9999, "category": "Prendas", "pricing_type": "unit"}
        ];

        const confirm = await Swal.fire({
            title: 'Cargar Lista de Precios',
            text: "¿Deseas cargar los servicios predefinidos de la lista de precios? Esto no eliminará tus servicios actuales.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cargar',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            setIsSeeding(true);
            try {
                await productService.bulkCreateProducts(services);
                Swal.fire('¡Éxito!', 'Catálogo de servicios actualizado correctamente', 'success');
                fetchProducts();
            } catch (error) {
                console.error('Error seeding services:', error);
                Swal.fire('Error', 'No se pudieron cargar los servicios', 'error');
            } finally {
                setIsSeeding(false);
            }
        }
    };

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
        setCurrentPage(1);
    };

    const handleClearFilters = () => {
        setFilters({
            category: 'all',
            minPrice: '',
            maxPrice: ''
        });
        setCurrentPage(1);
    };

    // Aplicar filtros, búsqueda y MODO (Service vs Product)
    const filteredProducts = products.filter(product => {
        // 1. Filtrar por tipo (si es nulo, asumimos SERVICE por compatibilidad con datos viejos)
        const productType = product.type || 'SERVICE';
        if (productType !== mode) return false;

        const matchesSearch = (product.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (filters.category !== 'all') {
            if (product.category !== filters.category) return false;
        }

        if (filters.minPrice && product.price < parseFloat(filters.minPrice)) return false;
        if (filters.maxPrice && product.price > parseFloat(filters.maxPrice)) return false;

        return true;
    });


    // Obtener categorías únicas
    const predefinedCategories = isServiceMode 
        ? ['Lavado de Ropa', 'Cama', 'Cobertores', 'Hogar', 'Tapetes', 'Prendas', 'Blancos/Sabanas', 'Varios', 'Accesorios', 'General']
        : ['Venta', 'Limpieza', 'Químicos', 'Bolsas', 'Accesorios', 'Hogar', 'General'];

    const existingCategories = Array.from(new Set(products
        .filter(p => (p.type || 'SERVICE') === mode)
        .map(p => p.category || 'General')));

    const uniqueCategories = Array.from(new Set([...predefinedCategories, ...customCategories, ...existingCategories])).sort();

    const getFilterCount = () => {
        let count = 0;
        if (filters.category !== 'all') count++;
        if (filters.minPrice) count++;
        if (filters.maxPrice) count++;
        return count;
    };

    const handleAddCategory = () => {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName || uniqueCategories.includes(trimmedName)) return;
        const updatedCategories = [...customCategories, trimmedName];
        setCustomCategories(updatedCategories);
        localStorage.setItem('customCategories', JSON.stringify(updatedCategories));
        setNewCategoryName('');
    };

    const handleStartEditCategory = (cat) => {
        setEditingCategoryId(cat);
        setEditedCategoryName(cat);
    };

    const handleRenameCategory = async (oldName) => {
        const newName = editedCategoryName.trim();
        if (!newName || oldName === newName) {
            setEditingCategoryId(null);
            return;
        }

        try {
            // Actualizar productos en Supabase
            const { error } = await supabase
                .from('products')
                .update({ category: newName })
                .eq('category', oldName);

            if (error) throw error;

            // Actualizar customCategories si aplica
            if (customCategories.includes(oldName)) {
                const updated = customCategories.map(c => c === oldName ? newName : c);
                setCustomCategories(updated);
                localStorage.setItem('customCategories', JSON.stringify(updated));
            }

            setEditingCategoryId(null);
            fetchProducts();
            Swal.fire('Éxito', 'Categoría renombrada correctamente', 'success');
        } catch (error) {
            console.error('Error renaming category:', error);
            Swal.fire('Error', 'No se pudo renombrar la categoría', 'error');
        }
    };

    const handleDeleteCategory = async (cat) => {
        const result = await Swal.fire({
            title: '¿Eliminar categoría?',
            text: `Todos los ítems en "${cat}" pasarán a ser "General".`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });


        if (result.isConfirmed) {
            try {
                // Mover productos a 'General'
                const { error } = await supabase
                    .from('products')
                    .update({ category: 'General' })
                    .eq('category', cat);

                if (error) throw error;

                // Quitar de customCategories
                const updated = customCategories.filter(c => c !== cat);
                setCustomCategories(updated);
                localStorage.setItem('customCategories', JSON.stringify(updated));

                fetchProducts();
                Swal.fire('Eliminada', 'Categoría eliminada correctamente', 'success');
            } catch (error) {
                console.error('Error deleting category:', error);
                Swal.fire('Error', 'No se pudo eliminar la categoría', 'error');
            }
        }
    };

    return (
        <div className="inventory-page">
            <header className="inventory-header">
                <div>
                    <h1 className="inventory-title">{isServiceMode ? 'Catálogo de Servicios' : 'Catálogo de Productos'}</h1>
                    <p className="inventory-subtitle">
                        {isServiceMode ? 'Gestiona los servicios y precios de la lavandería' : 'Gestiona los productos de venta al público'}
                    </p>
                </div>

                <div className="flex gap-2 items-center">
                    {isServiceMode && (
                        <button 
                            onClick={seedServices}
                            disabled={isSeeding}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all font-bold text-xs"
                        >
                            <span className="material-symbols-outlined text-[18px]">list_alt</span>
                            <span className="hidden sm:inline">{isSeeding ? 'Cargando...' : 'Cargar Lista Precios'}</span>
                        </button>
                    )}

                    
                    <button 
                        onClick={() => {
                            document.documentElement.classList.toggle('dark');
                            localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
                    >
                        <span className="material-symbols-outlined text-[18px]">dark_mode</span>
                        <span className="hidden sm:inline">Tema</span>
                    </button>
                </div>
            </header>

            <div className="inventory-content">
                <div className="search-controls">
                    <div className="search-container">
                        <span className="material-symbols-outlined search-icon">search</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder={isServiceMode ? "Buscar servicio..." : "Buscar producto..."}

                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="control-buttons">
                        <button 
                            className="control-btn"
                            onClick={handleExportExcel}
                            title="Exportar a Excel"
                        >
                            <FiDownload className="btn-icon" />
                            <span className="hidden md:inline">Exportar</span>
                        </button>

                        <button 
                            className="control-btn"
                            onClick={() => document.getElementById('excel-import-input').click()}
                            title="Importar desde Excel"
                        >
                            <FiUpload className="btn-icon" />
                            <span className="hidden md:inline">Importar</span>
                            <input 
                                id="excel-import-input"
                                type="file" 
                                accept=".xlsx, .xls" 
                                onChange={handleImportExcel} 
                                style={{ display: 'none' }} 
                            />
                        </button>

                        <button 
                            className={`control-btn ${getFilterCount() > 0 ? 'has-filters' : ''}`}
                            onClick={() => setShowFiltersModal(true)}
                        >
                            <FiFilter className="btn-icon" />
                            Filtros
                            {getFilterCount() > 0 && (
                                <span className="filter-badge">{getFilterCount()}</span>
                            )}
                        </button>
                        <button className="control-btn primary" onClick={() => handleOpenModal()}>
                            <FiPlus className="btn-icon" />
                            {isServiceMode ? 'Nuevo Servicio' : 'Nuevo Producto'}
                        </button>

                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">Cargando catálogo...</div>
                ) : (
                    <div className="table-container">
                        <table className="products-table">
                            <thead>
                                <tr>
                                    <th>{isServiceMode ? 'Servicio' : 'Producto'}</th>
                                    <th>Categoría</th>
                                    <th>Precio</th>
                                    {!isServiceMode && <th>Stock</th>}
                                    <th>{isServiceMode ? 'Tipo de Cobro' : 'Tipo Venta'}</th>

                                    <th className="actions-col">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => {
                                        const isMenuOpen = activeMenuId === product.id;
                                        return (
                                            <tr key={product.id} className="table-row">
                                                <td>
                                                    <div className="product-cell">
                                                        <div className="product-icon-placeholder">
                                                            <span className="material-symbols-outlined">
                                                                {product.pricing_type === 'kg' ? 'fitness_center' : (isServiceMode ? 'local_laundry_service' : 'shopping_bag')}
                                                            </span>
                                                        </div>
                                                        <div className="product-info">
                                                            <div className="product-name">{product.name}</div>
                                                            {product.barcode && <div className="text-[10px] text-slate-400 font-mono">#{product.barcode}</div>}
                                                        </div>

                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="category-badge category-blue">
                                                        {product.category || 'General'}
                                                    </span>
                                                </td>
                                                <td className="price-cell">${product.price.toFixed(2)}</td>
                                                {!isServiceMode && (
                                                    <td>
                                                        {(product.type === 'SERVICE' || product.stock >= 9999) ? (
                                                            <span className="text-slate-400 text-xs italic">Infinito</span>
                                                        ) : (
                                                            <span className={`text-sm font-black ${product.stock <= (product.min_stock || 0) ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {product.stock}
                                                            </span>
                                                        )}
                                                    </td>
                                                )}

                                                <td>
                                                    <span className="text-xs font-bold uppercase text-slate-500">
                                                        {product.pricing_type === 'kg' ? 'Por Kilo' : 'Por Unidad'}
                                                    </span>
                                                </td>

                                                <td className="actions-col">
                                                    <div className="actions-menu-container">
                                                        <button
                                                            className="actions-button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveMenuId(isMenuOpen ? null : product.id);
                                                            }}
                                                        >
                                                            <FiMoreVertical />
                                                        </button>
                                                        {isMenuOpen && (
                                                            <div className="actions-dropdown">
                                                                <button
                                                                    className="dropdown-item"
                                                                    onClick={() => {
                                                                        handleOpenModal(product);
                                                                        setActiveMenuId(null);
                                                                    }}
                                                                >
                                                                    <FiEdit2 />
                                                                    Editar
                                                                </button>
                                                                <button
                                                                    className="dropdown-item danger"
                                                                    onClick={() => {
                                                                        handleDelete(product.id);
                                                                        setActiveMenuId(null);
                                                                    }}
                                                                >
                                                                    <FiTrash2 />
                                                                    Eliminar
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="empty-state-cell">
                                            <div className="empty-state">
                                                <p>No se encontraron {isServiceMode ? 'servicios' : 'productos'}</p>
                                            </div>

                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="new-product-modal-overlay" onClick={handleCloseModal}>
                    <div className="new-product-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="new-product-close-btn" onClick={handleCloseModal}>
                            <FiX />
                        </button>

                        <div className="new-product-modal-header">
                            <h2 className="new-product-title">
                                {editingProduct ? (isServiceMode ? 'Editar Servicio' : 'Editar Producto') : (isServiceMode ? 'Nuevo Servicio' : 'Nuevo Producto')}
                            </h2>
                        </div>


                        <div className="new-product-modal-body">
                            <form id="new-product-form" onSubmit={handleSubmit} className="new-product-form">
                                <div className="new-product-form-grid">
                                    <div className="new-product-form-group col-span-12 md:col-span-12">
                                        <label className="new-product-label">Clasificación (¿Dónde aparecerá?)</label>
                                        <select
                                            className="new-product-select !bg-blue-50 dark:!bg-blue-900/20 !border-blue-200 dark:!border-blue-800 font-bold"
                                            name="type"
                                            value={formData.type}
                                            onChange={handleInputChange}
                                        >
                                            <option value="SERVICE">🧺 Catálogo de Servicios</option>
                                            <option value="PRODUCT">🛍️ Catálogo de Productos (con Stock)</option>
                                        </select>
                                    </div>

                                    <div className="new-product-form-group col-span-12 md:col-span-8">
                                        <label className="new-product-label">Nombre del {isServiceMode ? 'Servicio' : 'Producto'}</label>

                                        <input
                                            className="new-product-input"
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="new-product-form-group col-span-12 md:col-span-4">
                                        <label className="new-product-label">Código (Opcional)</label>
                                        <input
                                            className="new-product-input"
                                            type="text"
                                            name="barcode"
                                            value={formData.barcode}
                                            onChange={handleInputChange}
                                            placeholder="Código de barras..."
                                        />
                                    </div>


                                    <div className="new-product-form-group col-span-12 md:col-span-6">
                                        <div className="new-product-category-header">
                                            <label className="new-product-label">Categoría</label>
                                            <button type="button" onClick={() => setShowCategoriesModal(true)} className="text-[10px] text-blue-500 font-bold uppercase">
                                                <FiSettings className="inline mr-1" /> Gestionar
                                            </button>
                                        </div>
                                        <select
                                            className="new-product-select"
                                            name="category"
                                            value={formData.category}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            {uniqueCategories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="new-product-form-group col-span-12 md:col-span-6">
                                        <label className="new-product-label">Tipo de Cobro</label>
                                        <select
                                            className="new-product-select"
                                            name="pricing_type"
                                            value={formData.pricing_type}
                                            onChange={handleInputChange}
                                        >
                                            <option value="unit">Por Unidad</option>
                                            <option value="kg">Por Kilo</option>
                                        </select>
                                    </div>

                                    <div className="new-product-form-group col-span-12 md:col-span-4">
                                        <label className="new-product-label">Precio de Venta</label>
                                        <div className="new-product-price-wrapper">
                                            <span className="new-product-price-symbol">$</span>
                                            <input
                                                className="new-product-input new-product-price-input"
                                                type="number"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleInputChange}
                                                step="0.01"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {formData.type === 'PRODUCT' && (
                                        <>
                                            <div className="new-product-form-group col-span-12 md:col-span-4">
                                                <label className="new-product-label">Precio Costo</label>
                                                <div className="new-product-price-wrapper">
                                                    <span className="new-product-price-symbol">$</span>
                                                    <input
                                                        className="new-product-input new-product-price-input"
                                                        type="number"
                                                        name="cost_price"
                                                        value={formData.cost_price}
                                                        onChange={handleInputChange}
                                                        step="0.01"
                                                    />
                                                </div>
                                            </div>

                                            <div className="new-product-form-group col-span-12 md:col-span-4">
                                                <label className="new-product-label">Precio Mayoreo</label>
                                                <div className="new-product-price-wrapper">
                                                    <span className="new-product-price-symbol">$</span>
                                                    <input
                                                        className="new-product-input new-product-price-input"
                                                        type="number"
                                                        name="wholesale_price"
                                                        value={formData.wholesale_price}
                                                        onChange={handleInputChange}
                                                        step="0.01"
                                                    />
                                                </div>
                                            </div>

                                            <div className="new-product-form-group col-span-12 md:col-span-6">
                                                <label className="new-product-label">Stock Actual</label>
                                                <input
                                                    className="new-product-input"
                                                    type="number"
                                                    name="stock"
                                                    value={formData.stock}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </div>

                                            <div className="new-product-form-group col-span-12 md:col-span-6">
                                                <label className="new-product-label">Stock Mínimo (Alerta)</label>
                                                <input
                                                    className="new-product-input"
                                                    type="number"
                                                    name="min_stock"
                                                    value={formData.min_stock}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </>
                                    )}


                                </div>
                            </form>
                        </div>

                        <div className="new-product-modal-footer">
                            <button className="new-product-btn-cancel" onClick={handleCloseModal}>Cancelar</button>
                            <button type="submit" form="new-product-form" className="new-product-btn-save">
                                <FiSave className="mr-2" /> {editingProduct ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCategoriesModal && (
                <div className="modal-overlay" onClick={() => setShowCategoriesModal(false)}>
                    <div className="categories-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="categories-modal-header">
                            <h2>Gestionar Categorías</h2>
                            <button onClick={() => setShowCategoriesModal(false)}><FiX /></button>
                        </div>
                        <div className="categories-modal-content">
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    value={newCategoryName} 
                                    onChange={(e) => setNewCategoryName(e.target.value)} 
                                    className="categories-input"
                                    placeholder="Nueva categoría..."
                                />
                                <button onClick={handleAddCategory} className="categories-add-btn">Agregar</button>
                            </div>
                            <div className="categories-list">
                                {uniqueCategories.map(cat => (
                                    <div key={cat} className="categories-item">
                                        {editingCategoryId === cat ? (
                                            <div className="flex items-center gap-2 w-full">
                                                <input 
                                                    type="text" 
                                                    value={editedCategoryName} 
                                                    onChange={(e) => setEditedCategoryName(e.target.value)}
                                                    className="categories-input flex-1"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameCategory(cat);
                                                        if (e.key === 'Escape') setEditingCategoryId(null);
                                                    }}
                                                />
                                                <button onClick={() => handleRenameCategory(cat)} className="text-emerald-500 p-1"><FiSave /></button>
                                                <button onClick={() => setEditingCategoryId(null)} className="text-gray-500 p-1"><FiX /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <span>{cat}</span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleStartEditCategory(cat)} 
                                                        className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                                                        title="Renombrar"
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </button>
                                                    {cat !== 'General' && (
                                                        <button 
                                                            onClick={() => handleDeleteCategory(cat)} 
                                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showFiltersModal && (
                <div className="modal-overlay" onClick={() => setShowFiltersModal(false)}>
                    <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="filters-modal-header">
                            <h2>Filtros</h2>
                            <button onClick={() => setShowFiltersModal(false)}><FiX /></button>
                        </div>
                        <div className="filters-modal-content">
                            <div className="filter-group">
                                <label className="filter-label">Categoría</label>
                                <select className="filter-select" value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
                                    <option value="all">Todas</option>
                                    {uniqueCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button onClick={handleClearFilters} className="filter-clear-btn">Limpiar</button>
                                <button onClick={() => setShowFiltersModal(false)} className="filter-apply-btn">Aplicar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export { Inventory };
