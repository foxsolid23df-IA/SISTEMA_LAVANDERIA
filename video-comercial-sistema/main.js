window.addEventListener("DOMContentLoaded", () => {
    const COMP_ID = window.COMPOSITION_ID || "comercial-90s";
    const tl = gsap.timeline({ paused: true });
    window.__timelines[COMP_ID] = tl;

    // --- SETUP INICIAL ---
    gsap.set(".scene-group", { opacity: 0, visibility: "visible" });
    gsap.set(".screenshot", { opacity: 0, scale: 1.2, rotationY: -20 });

    // --- 1. HOOK (0-5s) ---
    tl.to("#hook-content", { opacity: 1, duration: 0.5 }, 0);
    tl.from(".giant-text", { scale: 1.5, opacity: 0, duration: 1, ease: "expo.out" }, 0.2);
    
    // Animación de fuga de dinero
    const dollarSigns = document.querySelectorAll(".dollar-sign");
    dollarSigns.forEach((s, i) => {
        tl.fromTo(s, 
            { y: 0, x: 0, opacity: 0, scale: 0.5 },
            { y: 200, x: (i - 1) * 100, opacity: 1, scale: 1.5, duration: 1.5, repeat: 2, ease: "power1.in" },
            0.5 + (i * 0.3)
        );
    });
    tl.to("#hook-content", { opacity: 0, duration: 0.5 }, 4.5);

    // --- 2. PAIN (5-15s) ---
    tl.to("#pain-content", { opacity: 1, duration: 0.5 }, 5);
    tl.fromTo("#pw1", { x: -500, opacity: 0 }, { x: -200, y: -200, opacity: 1, duration: 0.5 }, 5.5);
    tl.fromTo("#pw2", { x: 500, opacity: 0 }, { x: 200, y: 0, opacity: 1, duration: 0.5 }, 6.5);
    tl.fromTo("#pw3", { scale: 0, opacity: 0 }, { scale: 1.2, y: 200, opacity: 1, duration: 0.5 }, 7.5);
    
    // Zoom out dramático al final del dolor
    tl.to("#pain-content", { scale: 0.5, opacity: 0, duration: 1, ease: "power4.in" }, 14);

    // --- 3. SOLUTION (15-35s) ---
    tl.to("#solution-content", { opacity: 1, duration: 0.5 }, 15);
    
    // Mostrar Capturas (Dashboard)
    tl.to("#cap-dashboard", { opacity: 1, scale: 1, rotationY: 0, duration: 1, ease: "power3.out" }, 16);
    tl.from(".section-title", { y: 100, opacity: 0, duration: 1 }, 16.5);
    
    // Cambio a órdenes
    tl.to("#cap-dashboard", { x: -1000, opacity: 0, duration: 0.8 }, 24);
    tl.to("#cap-orders", { opacity: 1, scale: 1, rotationY: 0, duration: 1 }, 24.2);
    
    // Cambio a login (Profesionalismo)
    tl.to("#cap-orders", { x: 1000, opacity: 0, duration: 0.8 }, 30);
    tl.to("#cap-login", { opacity: 1, scale: 1, rotationY: 0, duration: 1 }, 30.2);
    
    tl.to(["#solution-content", "#cap-login"], { opacity: 0, duration: 0.5 }, 34.5);

    // --- 4. BENEFITS (35-60s) ---
    tl.to("#benefits-content", { opacity: 1, duration: 0.5 }, 35);
    
    // Mostrar tickets
    tl.to("#cap-tickets", { opacity: 1, scale: 0.9, y: -100, duration: 1 }, 35.5);
    tl.from("#b1", { x: 1000, duration: 0.8, ease: "back.out" }, 36);
    
    // Mostrar Reportes
    tl.to("#cap-tickets", { x: 1000, opacity: 0, duration: 0.8 }, 45);
    tl.to("#cap-reports", { opacity: 1, scale: 0.9, y: -100, duration: 1 }, 45.2);
    tl.from("#b2", { x: -1000, duration: 0.8, ease: "back.out" }, 46);
    
    tl.from("#b3", { y: 500, opacity: 0, duration: 0.8 }, 54);
    
    tl.to("#benefits-content", { opacity: 0, duration: 0.5 }, 59.5);

    // --- 5. AUTHORITY (60-75s) ---
    // Animación de tickets volando (simulando volumen)
    for(let i=0; i<10; i++) {
        tl.fromTo("#cap-tickets", 
            { x: -1000, y: (i-5)*100, scale: 0.5, opacity: 0 },
            { x: 1000, opacity: 1, duration: 2, ease: "none" },
            60 + (i * 0.5)
        );
    }
    
    // --- 6. CTA FINAL (75-90s) ---
    tl.to("#cta-content", { opacity: 1, duration: 0.5 }, 75);
    tl.from(".final-text", { scale: 0.8, opacity: 0, duration: 1, ease: "elastic.out(1, 0.5)" }, 75.5);
    tl.from(".cta-button", { y: 100, opacity: 0, duration: 0.8 }, 76.5);
    
    // Animación de pulso en el botón
    tl.to(".cta-button", { scale: 1.05, duration: 0.5, repeat: 20, yoyo: true }, 77);

    // Fondo en movimiento constante
    tl.to(".bg-layer", { backgroundPosition: "1000px 1000px", duration: 90, ease: "none" }, 0);
    
    console.log(`[Hyperframes] Commercial 90s initialized. Duration: ${tl.totalDuration()}s`);
});
