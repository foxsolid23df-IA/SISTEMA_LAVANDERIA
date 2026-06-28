// Configuración de Hyperframes y GSAP
window.addEventListener("DOMContentLoaded", () => {
    const DURATION = 10;
    const COMP_ID = window.COMPOSITION_ID || "hook-tiktok";

    // Crear la línea de tiempo principal
    const tl = gsap.timeline({ paused: true });

    // Registrar la línea de tiempo GLOBALMENTE
    window.__timelines = window.__timelines || {};
    window.__timelines[COMP_ID] = tl;

    // --- ANIMACIONES DETERMINISTAS ---

    // 1. Escaneo Láser
    tl.to("#laser-line", {
        top: "100%",
        duration: 1.5,
        ease: "none",
        repeat: 5
    }, 0);

    // 2. Fondo
    tl.to("#grid-container", {
        transform: "perspective(500px) rotateX(60deg) translateY(0%)",
        duration: DURATION,
        ease: "none"
    }, 0);

    // 3. Escena 1: El Gancho (0.5s - 3s)
    tl.to("#hook-box", {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)"
    }, 0.5);

    tl.to("#hook-box", {
        opacity: 0,
        scale: 1.2,
        duration: 0.3,
        ease: "power2.in"
    }, 2.8);

    // 4. Escena 2: El Proceso (3.2s - 7.5s)
    tl.to("#process-box", {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: "power3.out"
    }, 3.2);

    const efficiencyObj = { val: 0 };
    tl.to(efficiencyObj, {
        val: 100,
        duration: 3.5,
        ease: "none",
        onUpdate: () => {
            const counter = document.getElementById("efficiency-counter");
            if (counter) counter.innerText = `EFFICIENCY: ${Math.floor(efficiencyObj.val)}%`;
            
            const fill = document.getElementById("progress-fill");
            if (fill) fill.style.width = `${efficiencyObj.val}%`;
        }
    }, 3.2);

    tl.to("#process-box", {
        opacity: 0,
        y: -50,
        duration: 0.4,
        ease: "power2.in"
    }, 7.2);

    // 5. Escena 3: CTA Final (7.8s - 10s)
    tl.fromTo("#cta-box", 
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.75)" },
        7.8
    );

    tl.to("#qr-app", {
        scale: 1.1,
        duration: 0.5,
        repeat: 4,
        yoyo: true,
        ease: "power1.inOut"
    }, 8.0);

    console.log(`[Hyperframes] Timeline '${COMP_ID}' successfully registered.`);
});
