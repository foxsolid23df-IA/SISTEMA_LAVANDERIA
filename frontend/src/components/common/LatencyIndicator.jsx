import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import "./LatencyIndicator.css";

export const LatencyIndicator = () => {
  const [latency, setLatency] = useState(null);
  const [status, setStatus] = useState("checking"); // 'checking', 'good', 'warning', 'error'
  const [lastChecked, setLastChecked] = useState(new Date());

  const checkLatency = async () => {
    setStatus("checking");
    const start = Date.now();

    try {
      // Hacemos una consulta muy ligera para medir el tiempo de respuesta
      const { error } = await supabase
        .from("exchange_rates")
        .select("id")
        .limit(1);

      if (error) throw error;

      const end = Date.now();
      const currentLatency = end - start;
      setLatency(currentLatency);

      if (currentLatency < 300) {
        setStatus("good");
      } else if (currentLatency < 1000) {
        setStatus("warning");
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("[Latency Monitor] Error checking connection:", error);
      setLatency(null);
      setStatus("error");
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    // Checar inmediátamente
    checkLatency();

    // Luego cada 30 segundos
    const intervalId = setInterval(checkLatency, 30000);

    return () => clearInterval(intervalId);
  }, []);

  let indicatorColor = "#808080"; // checking
  if (status === "good") indicatorColor = "#10b981"; // green
  if (status === "warning") indicatorColor = "#f59e0b"; // yellow
  if (status === "error") indicatorColor = "#ef4444"; // red

  let tooltipText = "Verificando red...";
  if (latency !== null) {
    if (status === "good") tooltipText = `Excelente: ${latency}ms`;
    if (status === "warning") tooltipText = `Lenta: ${latency}ms`;
    if (status === "error") tooltipText = `Crítica: ${latency}ms`;
  } else if (status === "error") {
    tooltipText = "Sin conexión a base de datos";
  }

  return (
    <div
      className="latency-indicator"
      title={tooltipText}
      onClick={checkLatency}
    >
      <div
        className={`latency-dot ${status}`}
        style={{ backgroundColor: indicatorColor }}
      ></div>
      <span className="latency-text">
        {latency !== null ? `${latency}ms` : "---"}
      </span>
    </div>
  );
};
