-- ==========================================
-- SCRIPT: PERMITIR BORRAR PRODUCTOS CON HISTORIAL (ON DELETE SET NULL)
-- ==========================================
-- Descripción: Cuando intentas borrar un producto en el sistema, Supabase devuelve un 
-- Error 409 (Conflict) si ese producto ya fue vendido o apartado alguna vez en otra tabla 
-- (por ejemplo, sale_items o order_items). 
-- 
-- Este script cambia la regla de "Bloquear borrado" a "Poner product_id en NULL" pero 
-- dejando la información del producto de texto, permitiendo así borrar del catálogo
-- sin que se caiga o pierda el historial de ventas.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Obtenemos todas las tablas que apuntan a products(id) usando la llave product_id
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'products'
          AND ccu.column_name = 'id'
          AND kcu.column_name = 'product_id'
          AND tc.table_schema = 'public'
    ) LOOP
        -- Dropear llave actual
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        
        -- Si la tabla es un "carrito activo" (temporal), preferimos que si se borra el producto se elimine del carrito
        IF r.table_name = 'active_cart_items' THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' ADD CONSTRAINT ' || quote_ident(r.constraint_name) || ' FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE';
        ELSE
            -- Para ventas, historial, ordenes (permanente), solo desvinculamos el ID pero preservamos el registro
            EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' ADD CONSTRAINT ' || quote_ident(r.constraint_name) || ' FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL';
        END IF;
    END LOOP;
END;
$$;
