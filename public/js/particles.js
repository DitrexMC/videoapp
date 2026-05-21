(function () {
    var rafId = 0;
    var canvas, ctx, W, H, scrollY = 0, time = 0;
    var pts = [];
    var MAX_DIST = 180;
    var DENSITY = 16000;

    function sizeCv() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }

    function isLight() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    function P() {
        this.fx = Math.random(); this.fy = Math.random();
        this.vx = (Math.random() - .5) * .5; this.vy = (Math.random() - .5) * .5;
        this.s = Math.random() * .9 + .3; this.a = Math.random() * .5 + .18;
        this.pulse = Math.random() * Math.PI * 2;
        this.life = 0;
        this.lifeSpeed = 0.008 + Math.random() * 0.012;
    }
    P.prototype.r = function () {
        this.fx = Math.random(); this.fy = Math.random();
        this.vx = (Math.random() - .5) * .5; this.vy = (Math.random() - .5) * .5;
        this.s = Math.random() * .9 + .3; this.a = Math.random() * .5 + .18;
        this.pulse = Math.random() * Math.PI * 2;
        this.life = 0;
        this.lifeSpeed = 0.008 + Math.random() * 0.012;
    };
    P.prototype.u = function () {
        this.fx += (this.vx + Math.sin(time * .002 + this.pulse) * .15) / W;
        this.fy += (this.vy + Math.cos(time * .002 + this.pulse) * .15) / H;
        if (this.fx < -.02 || this.fx > 1.02 || this.fy < -.02 || this.fy > 1.02) {
            this.life = Math.max(0, this.life - this.lifeSpeed * 3);
            if (this.life <= 0.01) this.r();
        } else if (this.life < 1) {
            this.life = Math.min(1, this.life + this.lifeSpeed);
        }
    };
    P.prototype.d = function () {
        if (this.life < 0.01) return;
        var x = this.fx * W, y = this.fy * H;
        var alphaMul = isLight() ? .75 : 1;
        var alpha = this.a * this.life * alphaMul;
        var size = (this.s + Math.sin(time * .008 + this.pulse) * .25) * this.life;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(.15, size), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59,130,246,' + alpha + ')';
        ctx.fill();
    };

    function lines() {
        var lineAlphaMul = isLight() ? .9 : 1;
        for (var i = 0; i < pts.length; i++) {
            for (var j = i + 1; j < pts.length; j++) {
                var x1 = pts[i].fx * W, y1 = pts[i].fy * H;
                var x2 = pts[j].fx * W, y2 = pts[j].fy * H;
                var dx = x1 - x2, dy = y1 - y2;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < MAX_DIST) {
                    var lifeFactor = pts[i].life * pts[j].life;
                    if (lifeFactor < 0.01) continue;
                    var scrollFactor = 1 + Math.max(0, 1 - scrollY / 600) * .4;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = 'rgba(59,130,246,' + (.13 * lineAlphaMul * scrollFactor * lifeFactor * (1 - d / MAX_DIST)) + ')';
                    ctx.lineWidth = 0.75;
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
        var count = Math.max(15, Math.floor(W * H / DENSITY));
        pts = [];
        for (var i = 0; i < count; i++) pts.push(new P());
        rafId = requestAnimationFrame(anim);
    }

    window.__initParticles = initParticles;

    var resizeHandler = function () { if (canvas) initParticles(); };
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
