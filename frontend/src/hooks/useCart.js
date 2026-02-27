import { useState } from 'react'

// 1. HOOK PARA MANEJAR EL CARRITO DE VENTAS
// Este hook maneja todo lo relacionado con el carrito: agregar, quitar, calcular totales
export const useCart = (mostrarError) => {
    // 2. ESTADO DEL CARRITO (lista de productos seleccionados)
    const [carrito, setCarrito] = useState([])

    // 3. FUNCIÓN PARA AGREGAR UN PRODUCTO AL CARRITO
    const agregarProducto = (producto, initialQuantity = 1) => {
        setCarrito(carritoAnterior => {
            // Buscar si el producto ya está en el carrito
            const productoExistente = carritoAnterior.find(item => item.id === producto.id)

            if (productoExistente) {
                const qtyToAdd = parseFloat(initialQuantity) || 1;
                // Si es un servicio (cobro por kg o unitario sin stock crítico), simplemente incrementamos
                if (producto.type === 'SERVICE') {
                    return carritoAnterior.map(item =>
                        item.id === producto.id
                            ? { ...item, quantity: item.quantity + qtyToAdd }
                            : item
                    )
                }

                // Si es producto físico, verificar stock
                if (productoExistente.quantity + qtyToAdd <= producto.stock) {
                    return carritoAnterior.map(item =>
                        item.id === producto.id
                            ? { ...item, quantity: item.quantity + qtyToAdd }
                            : item
                    )
                } else {
                    mostrarError?.(`No hay más stock para ${producto.name}`)
                    return carritoAnterior
                }
            } else {
                // Si no existe, verificar si es servicio o tiene stock
                const qtyToAdd = parseFloat(initialQuantity) || 1;
                if (producto.type === 'SERVICE' || producto.stock >= qtyToAdd) {
                    return [...carritoAnterior, {
                        ...producto,
                        quantity: qtyToAdd
                    }]
                } else {
                    mostrarError?.(`${producto.name} está sin stock o cantidad excede disponible`)
                    return carritoAnterior
                }
            }
        })
    }

    // 4. FUNCIÓN PARA CAMBIAR LA CANTIDAD DE UN PRODUCTO (Soporta decimales para kg)
    const cambiarCantidad = (idProducto, nuevaCantidad) => {
        // No permitir cantidades negativas
        if (nuevaCantidad < 0) return;

        setCarrito(carritoAnterior =>
            carritoAnterior.map(item => {
                if (item.id === idProducto) {
                    // Si es servicio, permitimos decimales y no hay tope de stock
                    if (item.type === 'SERVICE') {
                        return { ...item, quantity: parseFloat(nuevaCantidad) || 0 }
                    }

                    // Si es producto físico, aplicamos reglas normales
                    const cantidadMaxima = item.stock
                    const cantidadValida = Math.min(nuevaCantidad, cantidadMaxima)

                    if (nuevaCantidad > cantidadMaxima) {
                        mostrarError?.(`Máximo disponible: ${cantidadMaxima}`)
                    }

                    return { ...item, quantity: Math.floor(cantidadValida) }
                }
                return item
            })
        )
    }

    // 5. FUNCIÓN PARA QUITAR UN PRODUCTO DEL CARRITO
    const quitarProducto = (idProducto) => {
        setCarrito(carritoAnterior =>
            carritoAnterior.filter(item => item.id !== idProducto)
        )
    }

    // 6. FUNCIÓN PARA VACIAR TODO EL CARRITO
    const vaciarCarrito = () => {
        setCarrito([])
    }

    // 7. CALCULAR EL TOTAL A PAGAR
    const total = carrito.reduce((suma, item) => suma + (item.price * item.quantity), 0)

    // 8. CALCULAR TOTAL DE PRODUCTOS EN EL CARRITO
    const totalProductos = carrito.reduce((suma, item) => suma + item.quantity, 0)

    // 9. DEVOLVER TODAS LAS FUNCIONES Y DATOS DEL CARRITO
    return {
        carrito,           // Lista de productos en el carrito
        agregarProducto,   // Función para agregar productos
        cambiarCantidad,   // Función para cambiar cantidades
        quitarProducto,    // Función para quitar productos
        vaciarCarrito,     // Función para vaciar el carrito
        total,             // Total a pagar
        totalProductos     // Cantidad total de productos
    }
}
