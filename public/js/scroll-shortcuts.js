(() => {
    const rutaHabilitada = /^\/(altas|pedidos)(?:\/|$)/.test(window.location.pathname);
    if (!rutaHabilitada) return;

    const controles = document.getElementById('atajosDesplazamiento');
    const arriba = document.getElementById('atajoIrArriba');
    const abajo = document.getElementById('atajoIrAbajo');
    if (!controles || !arriba || !abajo) return;

    const margen = 12;

    function actualizar() {
        const maximo = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const desplazable = maximo > 160;
        controles.classList.toggle('d-none', !desplazable);
        arriba.disabled = window.scrollY <= margen;
        abajo.disabled = window.scrollY >= maximo - margen;
    }

    arriba.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    abajo.addEventListener('click', () => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });

    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);

    if ('ResizeObserver' in window) {
        new ResizeObserver(actualizar).observe(document.body);
    }

    actualizar();
})();
