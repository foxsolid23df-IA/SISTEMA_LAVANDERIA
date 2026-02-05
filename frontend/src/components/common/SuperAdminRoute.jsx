import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const SuperAdminRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Cargando...</div>;
    }

    // Verificar si el usuario tiene el rol 'super_admin' en su perfil de Supabase
    // user contiene {...user, ...profile} gracias al AuthProvider
    if (!user || user.role !== 'super_admin') {
        console.warn('Acceso denegado: Se requiere rol super_admin');
        return <Navigate to="/" replace />;
    }

    return children;
};
