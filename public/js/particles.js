(() => {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    function sizeCv() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    sizeCv();
    window.addEventListener('resize', sizeCv);

    function isLight() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    class P {
        constructor() { this.r(); }
        r() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.vx = (Math.random() - .5) * .4;
            this.vy = (Math.random() - .5) * .4;
            this.s = Math.random() * 1.4 + .5;
            this.a = Math.random() * .45 + .15;
        }
        u() {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.r();
        }
        d() {
            const alpha = isLight() ? this.a * .5 : this.a;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59,130,246,${alpha})`;
            ctx.fill();
        }
    }

    const pts = Array.from({ length: 150 }, () => new P());

    function lines() {
        const lineAlphaMul = isLight() ? .85 : 1;
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 160) {
                    ctx.beginPath();
                    ctx.moveTo(pts[i].x, pts[i].y);
                    ctx.lineTo(pts[j].x, pts[j].y);
                    ctx.strokeStyle = `rgba(59,130,246,${.18 * lineAlphaMul * (1 - d / 160)})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    function anim() {
        ctx.clearRect(0, 0, W, H);
        pts.forEach(p => { p.u(); p.d(); });
        lines();
        requestAnimationFrame(anim);
    }
    anim();
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

