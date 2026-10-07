(() => {
    const rutaHabilitada = /^\/(altas|pedidos)(?:\/|$)/.test(window.location.pathname);
    if (!rutaHabilitada) return;

    const controles = document.getElementById('atajosDesplazamiento');
    const arriba = document.getElementById('atajoIrArriba');
    const abajo = document.getElementById('atajoIrAbajo');
    if (!controles || !arriba || !abajo) return;

    const margen = 12;

    function obtenerSuperficieDesplazamiento() {
        return document.scrollingElement || document.documentElement || document.body;
    }

    function posicionActual() {
        const superficie = obtenerSuperficieDesplazamiento();
        return Number(superficie?.scrollTop || window.pageYOffset || window.scrollY || 0);
    }

    function desplazarA(top) {
        const superficie = obtenerSuperficieDesplazamiento();
        const destino = Math.max(0, Number(top) || 0);

        if (typeof superficie?.scrollTo === 'function') {
            superficie.scrollTo({ top: destino, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: destino, behavior: 'smooth' });
        }

        // Respaldo para navegadores que exponen scrollingElement pero ignoran
        // su scrollTo con desplazamiento suave.
        window.setTimeout(() => {
            const actual = posicionActual();
            if (Math.abs(actual - destino) <= margen) return;
            if (superficie) superficie.scrollTop = destino;
            window.scrollTo(0, destino);
            actualizar();
        }, 350);
    }

    function actualizar() {
        const superficie = obtenerSuperficieDesplazamiento();
        const maximo = Math.max(0, Number(superficie?.scrollHeight || 0) - window.innerHeight);
        const actual = posicionActual();
        const desplazable = maximo > 160;
        controles.classList.toggle('d-none', !desplazable);
        arriba.disabled = actual <= margen;
        abajo.disabled = actual >= maximo - margen;
    }

    arriba.addEventListener('click', () => {
        desplazarA(0);
    });

    abajo.addEventListener('click', () => {
        const superficie = obtenerSuperficieDesplazamiento();
        desplazarA(Number(superficie?.scrollHeight || 0));
    });

    window.addEventListener('scroll', actualizar, { passive: true });
    document.addEventListener('scroll', actualizar, { passive: true, capture: true });
    window.addEventListener('resize', actualizar);

    if ('ResizeObserver' in window) {
        new ResizeObserver(actualizar).observe(document.body);
    }

    actualizar();
})();
