import React, { useRef, useState } from "react";
import NotaRemision from "./NotaRemision";
import { printService } from "../../services/printService";
import { generateRemisionPDF } from "../../utils/remisionPdf";
import Swal from "sweetalert2";

const RemisionPreviewModal = ({ venta, settings, onClose }) => {
  const notaRef = useRef(null);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handlePrint = async () => {
    if (!notaRef.current || printing) return;
    setPrinting(true);
    try {
      const copies = settings?.remision_copies || 2;
      await printService.print(notaRef.current, settings?.printer_name, {
        copies,
        settings,
        paperSize: 'remision',
      });
    } catch (error) {
      console.error("Error al imprimir nota:", error);
      Swal.fire("Error", "No se pudo imprimir la nota de remisión.", "error");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!notaRef.current || downloading) return;
    setDownloading(true);
    try {
      const folio = venta?.folio
        ? venta.folio.toString().padStart(6, "0")
        : (venta?.id || "").toString().slice(-6);
      await generateRemisionPDF(notaRef.current, `nota-remision-${folio}`);
    } catch (error) {
      console.error("Error al generar PDF:", error);
      Swal.fire("Error", "No se pudo generar el PDF de la nota de remisión.", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in duration-300 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>

        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 text-center">
          Nota de Remisión
        </h3>

        <div className="flex-1 overflow-auto custom-scrollbar mb-4 flex justify-center">
          <NotaRemision
            venta={venta}
            settings={settings}
            ref={notaRef}
          />
        </div>

        <div className="space-y-2">
          <button
            onClick={handlePrint}
            disabled={printing}
            className={`w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${printing ? "bg-slate-400 cursor-not-allowed" : "bg-amber-600 hover:bg-amber-700"}`}
          >
            <span className={`material-symbols-outlined ${printing ? "animate-spin" : ""}`}>
              {printing ? "sync" : "print"}
            </span>
            {printing ? "IMPRIMIENDO..." : "IMPRIMIR"}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className={`w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 border-2 transition-all active:scale-95 ${downloading ? "border-slate-200 text-slate-400 cursor-not-allowed" : "border-amber-600 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
          >
            <span className={`material-symbols-outlined ${downloading ? "animate-spin" : ""}`}>
              {downloading ? "sync" : "picture_as_pdf"}
            </span>
            {downloading ? "GENERANDO..." : "DESCARGAR PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemisionPreviewModal;
