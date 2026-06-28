window.addEventListener("DOMContentLoaded", () => {
    const COMP_ID = window.COMPOSITION_ID || "explainer-bascula";
    const tl = gsap.timeline({ paused: true });
    window.__timelines[COMP_ID] = tl;

    // --- CONFIGURACIÓN GLOBAL ---
    gsap.set(".scene", { opacity: 0, visibility: "visible" });
    gsap.set(".hud-layer", { opacity: 1, visibility: "visible" });

    // --- ESCENA 1: INTRO (0 - 2.5s) ---
    tl.to("#intro-scene", { opacity: 1, duration: 0.5 }, 0);
    tl.from(".main-title", { y: 50, opacity: 0, duration: 0.8, ease: "power4.out" }, 0.2);
    tl.to("#intro-scene", { opacity: 0, duration: 0.4 }, 2.1);

    // --- ESCENA 2: PESAJE (2.5 - 6s) ---
    tl.to("#step1-scene", { opacity: 1, duration: 0.5 }, 2.5);
    tl.from("#scale-ui", { scale: 0.8, opacity: 0, duration: 0.6, ease: "back.out(1.7)" }, 2.7);

    // Contador de peso dinámico
    const weightObj = { val: 0 };
    tl.to(weightObj, {
        val: 4.5,
        duration: 2.5,
        ease: "power2.inOut",
        onUpdate: () => {
            const display = document.getElementById("weight-display");
            if (display) display.innerText = `${weightObj.val.toFixed(2)} KG`;
        }
    }, 3.0);

    tl.to("#step1-scene", { opacity: 0, duration: 0.4 }, 5.6);

    // --- ESCENA 3: CÁLCULO (6 - 8.5s) ---
    tl.to("#step2-scene", { opacity: 1, duration: 0.5 }, 6.0);
    tl.from(".math-box", { x: -100, opacity: 0, duration: 0.6, ease: "power3.out" }, 6.2);

    // Animación de cálculo
    const priceObj = { total: 0 };
    tl.to(priceObj, {
        total: 67.50, // 4.5 * 15
        duration: 1.5,
        ease: "none",
        onUpdate: () => {
            const priceDisplay = document.getElementById("total-price");
            if (priceDisplay) priceDisplay.innerText = `$${priceObj.total.toFixed(2)}`;
        }
    }, 6.5);

    tl.to("#step2-scene", { opacity: 0, duration: 0.4 }, 8.1);

    // --- ESCENA 4: FINAL (8.5 - 10s) ---
    tl.to("#final-scene", { opacity: 1, duration: 0.5 }, 8.5);
    tl.from(".success-icon", { scale: 0, rotation: -180, duration: 0.8, ease: "elastic.out(1, 0.5)" }, 8.7);
    
    // HUD Animation (Constant)
    tl.to(".grid", { backgroundPosition: "0 600px", duration: 10, ease: "none" }, 0);
    
    console.log(`[Hyperframes] Explainer '${COMP_ID}' initialized.`);
});
