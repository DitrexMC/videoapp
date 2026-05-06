(function () {
    var rafId = 0;
    var canvas, ctx, W, H, scrollY = 0, time = 0;
    var pts = [];

    function sizeCv() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }

    function isLight() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    function P() {
        this.fx = Math.random(); this.fy = Math.random();
        this.vx = (Math.random() - .5) * .5; this.vy = (Math.random() - .5) * .5;
        this.s = Math.random() * 1.8 + .6; this.a = Math.random() * .5 + .18;
        this.pulse = Math.random() * Math.PI * 2;
    }
    P.prototype.r = function () {
        this.fx = Math.random(); this.fy = Math.random();
        this.vx = (Math.random() - .5) * .5; this.vy = (Math.random() - .5) * .5;
        this.s = Math.random() * 1.8 + .6; this.a = Math.random() * .5 + .18;
        this.pulse = Math.random() * Math.PI * 2;
    };
    P.prototype.u = function () {
        this.fx += (this.vx + Math.sin(time * .002 + this.pulse) * .15) / W;
        this.fy += (this.vy + Math.cos(time * .002 + this.pulse) * .15) / H;
        if (this.fx < -.02 || this.fx > 1.02 || this.fy < -.02 || this.fy > 1.02) this.r();
    };
    P.prototype.d = function () {
        var x = this.fx * W, y = this.fy * H;
        var alphaMul = isLight() ? .75 : 1;
        var alpha = this.a * alphaMul;
        var size = this.s + Math.sin(time * .008 + this.pulse) * .3;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(.4, size), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59,130,246,' + alpha + ')';
        ctx.fill();
    };

    function lines() {
        var lineAlphaMul = isLight() ? .9 : 1;
        var maxDist = 200;
        for (var i = 0; i < pts.length; i++) {
            for (var j = i + 1; j < pts.length; j++) {
                var x1 = pts[i].fx * W, y1 = pts[i].fy * H;
                var x2 = pts[j].fx * W, y2 = pts[j].fy * H;
                var dx = x1 - x2, dy = y1 - y2;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < maxDist) {
                    var scrollFactor = 1 + Math.max(0, 1 - scrollY / 600) * .4;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = 'rgba(59,130,246,' + (.15 * lineAlphaMul * scrollFactor * (1 - d / maxDist)) + ')';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    function anim(ts) {
        time = ts;
        if (!document.body.contains(canvas)) { rafId = 0; return; }
        ctx.clearRect(0, 0, W, H);
        pts.forEach(function (p) { p.u(); p.d(); });
        lines();
        rafId = requestAnimationFrame(anim);
    }

    function initParticles() {
        canvas = document.getElementById('canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        scrollY = window.scrollY || 0;
        sizeCv();
        pts = [];
        for (var i = 0; i < 200; i++) pts.push(new P());
        rafId = requestAnimationFrame(anim);
    }

    window.__initParticles = initParticles;

    var resizeHandler = function () { if (canvas) sizeCv(); };
    var scrollHandler = function () { scrollY = window.scrollY || 0; };

    function setup() {
        window.addEventListener('resize', resizeHandler, { passive: true });
        window.addEventListener('scroll', scrollHandler, { passive: true });
        initParticles();
    }
    setup();
})();

(function () {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var scrolled = false;
    function update() {
        var s = window.scrollY > 10;
        if (s !== scrolled) { nav.classList.toggle('scrolled', s); scrolled = s; }
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
})();

(function () {
    var revEls = document.querySelectorAll('.reveal');
    if (!revEls.length) return;
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    revEls.forEach(function (el) { io.observe(el); });
    window.__revealObserver = io;
})();
