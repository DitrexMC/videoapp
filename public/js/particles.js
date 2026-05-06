(() => {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, scrollY = 0, time = 0;
    function sizeCv() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    sizeCv();
    window.addEventListener('resize', sizeCv);
    window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

    function isLight() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    // Particles use fraction-based positions (0-1) so they scale with viewport
    class P {
        constructor() { this.r(); }
        r() {
            this.fx = Math.random();
            this.fy = Math.random();
            this.vx = (Math.random() - .5) * .5;
            this.vy = (Math.random() - .5) * .5;
            this.s = Math.random() * 1.8 + .6;
            this.a = Math.random() * .5 + .18;
            this.pulse = Math.random() * Math.PI * 2;
        }
        u() {
            this.fx += (this.vx + Math.sin(time * .002 + this.pulse) * .15) / W;
            this.fy += (this.vy + Math.cos(time * .002 + this.pulse) * .15) / H;
            if (this.fx < -.02 || this.fx > 1.02 || this.fy < -.02 || this.fy > 1.02) this.r();
        }
        d() {
            const x = this.fx * W, y = this.fy * H;
            const alphaMul = isLight() ? .75 : 1;
            const alpha = this.a * alphaMul;
            const size = this.s + Math.sin(time * .008 + this.pulse) * .3;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(.4, size), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59,130,246,${alpha})`;
            ctx.fill();
        }
    }

    const pts = Array.from({ length: 200 }, () => new P());

    function lines() {
        const lineAlphaMul = isLight() ? .9 : 1;
        const maxDist = 200;
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const x1 = pts[i].fx * W, y1 = pts[i].fy * H;
                const x2 = pts[j].fx * W, y2 = pts[j].fy * H;
                const dx = x1 - x2, dy = y1 - y2;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < maxDist) {
                    const scrollFactor = 1 + Math.max(0, 1 - scrollY / 600) * .4;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = `rgba(59,130,246,${.15 * lineAlphaMul * scrollFactor * (1 - d / maxDist)})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    function anim(ts) {
        time = ts;
        ctx.clearRect(0, 0, W, H);
        pts.forEach(p => { p.u(); p.d(); });
        lines();
        requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);
})();

(() => {
    const nav = document.getElementById('nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
})();

(() => {
    const revEls = document.querySelectorAll('.reveal');
    if (!revEls.length) return;
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    revEls.forEach(el => io.observe(el));
    window.__revealObserver = io;
})();
