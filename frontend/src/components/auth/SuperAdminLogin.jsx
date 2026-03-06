import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import Swal from "sweetalert2";
import "./Login.css"; // Podemos reusar parte del CSS pero le daremos un giro dark/corporativo

export const SuperAdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirigir si ya tiene sesión y es admin
  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: superAdmin } = await supabase
          .from("super_admins")
          .select("id")
          .eq("email", session.user.email)
          .maybeSingle();

        if (superAdmin) {
          navigate("/super-admin/licencias");
        }
      }
    };
    checkExistingSession();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Iniciar sesión normal en Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 2. Inmediatamente verificar si es SuperAdmin de verdad
      const { data: superAdmin } = await supabase
        .from("super_admins")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!superAdmin) {
        // Es un usuario normal queriendo entrar al portal maestro
        await supabase.auth.signOut();
        throw new Error(
          "Acceso denegado. Esta área está restringida a administradores maestros.",
        );
      }

      // 3. Exito
      navigate("/super-admin/licencias");
    } catch (error) {
      console.error("Error de login SuperAdmin:", error);
      Swal.fire({
        icon: "error",
        title: "Acceso Denegado",
        text: error.message || "Credenciales incorrectas.",
        confirmButtonColor: "#3b82f6", // blue-500
        background: "#1e293b", // slate-800
        color: "#fff",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ background: "#0f172a" }}>
      {" "}
      {/* slate-900 */}
      <div
        className="login-card"
        style={{
          background: "#1e293b",
          borderColor: "#334155",
          borderWidth: "1px",
        }}
      >
        {" "}
        {/* slate-800 */}
        <div className="login-header">
          <span
            className="material-icons-outlined"
            style={{ fontSize: "48px", color: "#3b82f6" }}
          >
            admin_panel_settings
          </span>
          <h1 style={{ color: "#f8fafc", marginTop: "10px" }}>
            Portal Maestro
          </h1>
          <p style={{ color: "#cbd5e1" }}>
            Acceso restringido para administradores.
          </p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label style={{ color: "#94a3b8" }}>Correo Administrativo</label>
            <div className="input-group">
              <i
                className="material-icons-outlined"
                style={{ color: "#64748b" }}
              >
                email
              </i>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tudominio.com"
                required
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  borderColor: "#334155",
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ color: "#94a3b8" }}>Contraseña Maestra</label>
            <div className="input-group">
              <i
                className="material-icons-outlined"
                style={{ color: "#64748b" }}
              >
                lock
              </i>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  borderColor: "#334155",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
            style={{ background: "#3b82f6", marginTop: "1rem" }}
          >
            {loading ? "Verificando Credenciales..." : "Ingresar al Portal"}
          </button>

          <div className="text-center mt-6">
            <a
              href="/#/login"
              className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
            >
              ← Volver al Punto de Venta
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};
