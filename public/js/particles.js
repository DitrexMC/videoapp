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

    class P {
        constructor() { this.r(); }
        r() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.vx = (Math.random() - .5) * .5;
            this.vy = (Math.random() - .5) * .5;
            this.s = Math.random() * 1.8 + .6;
            this.a = Math.random() * .5 + .18;
            this.pulse = Math.random() * Math.PI * 2;
        }
        u() {
            this.x += this.vx + Math.sin(time * .002 + this.pulse) * .15;
            this.y += this.vy + Math.cos(time * .002 + this.pulse) * .15;
            if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.r();
        }
        d() {
            const alpha = isLight() ? this.a * .45 : this.a;
            const size = this.s + Math.sin(time * .008 + this.pulse) * .3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, Math.max(.4, size), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59,130,246,${alpha})`;
            ctx.fill();
        }
    }

    const pts = Array.from({ length: 200 }, () => new P());

    function lines() {
        const lineAlphaMul = isLight() ? .78 : 1;
        const maxDist = 200;
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < maxDist) {
                    const midX = (pts[i].x + pts[j].x) / 2;
                    const midY = (pts[i].y + pts[j].y) / 2;
                    const scrollFactor = 1 + Math.max(0, 1 - scrollY / 600) * .4;
                    ctx.beginPath();
                    ctx.moveTo(pts[i].x, pts[i].y);
                    ctx.lineTo(pts[j].x, pts[j].y);
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
