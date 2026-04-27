import { supabase } from '../supabase';

const ADMIN_API_URL = 'http://127.0.0.1:3001/api/admin';

// Obtener la URL de Supabase desde las variables de entorno de Vite
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CLOUD_API_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/admin-service` : null;

export const maintenanceService = {
  /**
   * Obtiene el estado de salud del sistema desde la API Administrativa local
   */
  async getSystemHealth(masterPin) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) return { status: 'offline', database: 'n/a' };

    try {
      const response = await fetch(`${ADMIN_API_URL}/health?masterPin=${masterPin}`);
      if (!response.ok) throw new Error('Offline');
      return await response.json();
    } catch (error) {
      return { status: 'offline', database: 'error' };
    }
  },

  /**
   * Obtiene el estado de salud desde la Edge Function de Supabase (Global)
   */
  async getGlobalHealth(masterPin) {
    if (!CLOUD_API_URL) return { status: 'offline', database: 'error' };
    try {
      // Necesitamos la llave de Supabase para poder llamar a la función si tiene JWT activado
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(CLOUD_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ action: 'health', masterPin })
      });
      if (!response.ok) throw new Error('Offline');
      return await response.json();
    } catch (error) {
      console.error('Cloud Health Error:', error);
      return { status: 'offline', database: 'error' };
    }
  },

  /**
   * Obtiene los logs de auditoria
   */
  async getAdminLogs(masterPin) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) throw new Error('Logs locales solo disponibles en entorno local');

    try {
      const response = await fetch(`${ADMIN_API_URL}/logs?masterPin=${masterPin}`);
      if (!response.ok) throw new Error('Error al obtener logs');
      return await response.json();
    } catch (error) {
      console.error('Error in maintenanceService.getAdminLogs:', error);
      throw error;
    }
  },

  /**
   * Resets project data in the database and cleans up local storage.
   * @param {Object} options - Reset options
   */
  async resetProjectData({ resetTerminals = true, resetTransactions = true, resetProfiles = false, factoryReset = false, masterPin }) {
    try {
      let endpoint = '';
      if (factoryReset) {
        endpoint = '/reset/factory';
      } else if (resetProfiles) {
        endpoint = '/users/reset-secondary';
      } else if (resetTransactions) {
        endpoint = '/reset/sales';
      } else if (resetTerminals) {
        endpoint = '/reset/devices';
      }

      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (endpoint && isLocalhost) {
        // Intentar usar la nueva API Administrativa local solo si estamos en localhost
        try {
          const response = await fetch(`${ADMIN_API_URL}${endpoint}?masterPin=${masterPin}`, {
            method: 'POST'
          });
          if (response.ok) {
            const data = await response.json();
            if (resetTerminals || factoryReset) {
              this.resetLocalTerminal();
            }
            return data;
          }
        } catch (e) {
          console.warn('API Local no disponible, cayendo a Supabase RPC:', e);
        }
      }

      // Fallback a la función RPC de Supabase (comportamiento original)
      // Asegurarse de que los parámetros coincidan con lo que espera el RPC restaurado
      const { data, error } = await supabase.rpc('reset_project_data', {
        p_reset_terminals: resetTerminals,
        p_reset_transactions: resetTransactions,
        p_reset_profiles: resetProfiles,
        p_factory_reset: factoryReset
      });

      if (error) throw error;

      if (data?.success) {
        if (resetTerminals || factoryReset) {
          this.resetLocalTerminal();
        }
        return data;
      } else {
        throw new Error(data?.message || 'Error desconocido durante el reset');
      }
    } catch (error) {
      console.error('Error in maintenanceService.resetProjectData:', error);
      throw error;
    }
  },

  resetLocalTerminal() {
    localStorage.removeItem('pos_terminal_id');
    localStorage.removeItem('pos_terminal_name');
    localStorage.removeItem('pos_is_main_terminal');
  },

  /**
   * Fuerza el cierre de todas las sesiones de caja abiertas
   */
  async forceCloseAllSessions() {
    const { data, error } = await supabase
      .from('cash_sessions')
      .update({ 
        status: 'closed', 
        closed_at: new Date().toISOString() 
      })
      .eq('status', 'open');

    if (error) throw error;
    return { success: true };
  }
};
