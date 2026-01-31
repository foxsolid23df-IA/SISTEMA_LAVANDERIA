import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../hooks/useCart';

describe('useCart Hook', () => {
    it('debe iniciar con un carrito vacío', () => {
        const { result } = renderHook(() => useCart());
        expect(result.current.carrito).toEqual([]);
        expect(result.current.total).toBe(0);
    });

    it('debe agregar un producto correctamente', () => {
        const { result } = renderHook(() => useCart());
        const producto = { id: 1, name: 'Jabón', price: 10, stock: 5, category: 'product' };

        act(() => {
            result.current.agregarProducto(producto);
        });

        expect(result.current.carrito).toHaveLength(1);
        expect(result.current.carrito[0].quantity).toBe(1);
        expect(result.current.total).toBe(10);
    });

    it('debe incrementar cantidad si el producto ya existe', () => {
        const { result } = renderHook(() => useCart());
        const producto = { id: 1, name: 'Jabón', price: 10, stock: 5, category: 'product' };

        act(() => {
            result.current.agregarProducto(producto);
            result.current.agregarProducto(producto);
        });

        expect(result.current.carrito[0].quantity).toBe(2);
        expect(result.current.total).toBe(20);
    });

    it('no debe exceder el stock de productos físicos', () => {
        const mostrarError = vi.fn();
        const { result } = renderHook(() => useCart(mostrarError));
        const producto = { id: 1, name: 'Jabón', price: 10, stock: 1, category: 'product' };

        act(() => {
            result.current.agregarProducto(producto);
            result.current.agregarProducto(producto); // Intento agregar más de lo que hay
        });

        expect(result.current.carrito[0].quantity).toBe(1);
        expect(mostrarError).toHaveBeenCalledWith('No hay más stock para Jabón');
    });

    it('debe permitir decimales en servicios (lavandería por kg)', () => {
        const { result } = renderHook(() => useCart());
        const servicio = { id: 10, name: 'Lavado', price: 20, category: 'service' };

        act(() => {
            result.current.agregarProducto(servicio);
            result.current.cambiarCantidad(10, 2.5); // 2.5 kg
        });

        expect(result.current.carrito[0].quantity).toBe(2.5);
        expect(result.current.total).toBe(50);
    });

    it('debe vaciar el carrito correctamente', () => {
        const { result } = renderHook(() => useCart());
        const producto = { id: 1, name: 'Jabón', price: 10, stock: 5 };

        act(() => {
            result.current.agregarProducto(producto);
            result.current.vaciarCarrito();
        });

        expect(result.current.carrito).toEqual([]);
        expect(result.current.total).toBe(0);
    });
});
