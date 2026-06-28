import { useState, useEffect, useRef } from 'react'
import { storage } from '../utils/storage'

const CART_KEY = 'persistent_cart'
const SAVE_DELAY = 500

export const useCart = (mostrarError) => {
  const [carrito, setCarrito] = useState([])
  const [initialized, setInitialized] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    storage.getObject(CART_KEY).then((saved) => {
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setCarrito(saved)
      }
      setInitialized(true)
    })
  }, [])

  const scheduleSave = (cart) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      storage.setObject(CART_KEY, cart)
    }, SAVE_DELAY)
  }

  const agregarProducto = (producto, initialQuantity = 1) => {
    setCarrito(carritoAnterior => {
      const productoExistente = carritoAnterior.find(item => item.id === producto.id)
      let newCart
      if (productoExistente) {
        const qtyToAdd = parseFloat(initialQuantity) || 1
        if (producto.type === 'SERVICE') {
          newCart = carritoAnterior.map(item =>
            item.id === producto.id ? { ...item, quantity: item.quantity + qtyToAdd } : item
          )
        } else if (productoExistente.quantity + qtyToAdd <= producto.stock) {
          newCart = carritoAnterior.map(item =>
            item.id === producto.id ? { ...item, quantity: item.quantity + qtyToAdd } : item
          )
        } else {
          mostrarError?.(`No hay m\u00e1s stock para ${producto.name}`)
          return carritoAnterior
        }
      } else {
        const qtyToAdd = parseFloat(initialQuantity) || 1
        if (producto.type === 'SERVICE' || producto.stock >= qtyToAdd) {
          newCart = [...carritoAnterior, { ...producto, quantity: qtyToAdd }]
        } else {
          mostrarError?.(`${producto.name} est\u00e1 sin stock o cantidad excede disponible`)
          return carritoAnterior
        }
      }
      scheduleSave(newCart)
      return newCart
    })
  }

  const cambiarCantidad = (idProducto, nuevaCantidad) => {
    if (nuevaCantidad < 0) return
    setCarrito(carritoAnterior => {
      const newCart = carritoAnterior.map(item => {
        if (item.id === idProducto) {
          if (item.type === 'SERVICE') {
            return { ...item, quantity: parseFloat(nuevaCantidad) || 0 }
          }
          const cantidadMaxima = item.stock
          const cantidadValida = Math.min(nuevaCantidad, cantidadMaxima)
          if (nuevaCantidad > cantidadMaxima) {
            mostrarError?.(`M\u00e1ximo disponible: ${cantidadMaxima}`)
          }
          return { ...item, quantity: Math.floor(cantidadValida) }
        }
        return item
      })
      scheduleSave(newCart)
      return newCart
    })
  }

  const quitarProducto = (idProducto) => {
    setCarrito(carritoAnterior => {
      const newCart = carritoAnterior.filter(item => item.id !== idProducto)
      scheduleSave(newCart)
      return newCart
    })
  }

  const vaciarCarrito = () => {
    setCarrito([])
    storage.remove(CART_KEY)
  }

  const total = carrito.reduce((suma, item) => suma + (item.price * item.quantity), 0)
  const totalProductos = carrito.reduce((suma, item) => suma + item.quantity, 0)

  return {
    carrito,
    agregarProducto,
    cambiarCantidad,
    quitarProducto,
    vaciarCarrito,
    total,
    totalProductos,
    initialized
  }
}
