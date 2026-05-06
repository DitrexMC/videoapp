(function () {
  'use strict';

  var cfg = window.__previewConfig;
  if (!cfg) return;

  /* ── Video ── */
  function initVideo() {
    var vid = document.getElementById('vid');
    var src = document.getElementById('vid-src');
    var err = document.getElementById('media-err');
    if (!vid) return;

    function showErr() {
      vid.style.display = 'none';
      if (err) err.style.display = 'flex';
    }

    vid.addEventListener('error', showErr);
    if (src) src.addEventListener('error', showErr);
    vid.addEventListener('loadedmetadata', function () {
      if (isNaN(vid.duration) || vid.duration === 0) showErr();
    });
  }

  /* ── Image ── */
  function initImage() {
    var img = document.getElementById('preview-img');
    var lb = document.getElementById('lightbox');
    var lbClose = document.getElementById('lb-close');
    var zoomBtn = document.getElementById('zoom-btn');
    var checkerBtn = document.getElementById('checker-toggle');
    var wrap = document.getElementById('img-wrap');

    if (checkerBtn) {
      checkerBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        wrap.classList.toggle('checker');
      });
    }

    function openLb() { if (lb) lb.classList.add('open'); }
    function closeLb() { if (lb) lb.classList.remove('open'); }

    if (img) img.addEventListener('click', openLb);
    if (zoomBtn) zoomBtn.addEventListener('click', function (e) { e.stopPropagation(); openLb(); });
    if (lbClose) lbClose.addEventListener('click', closeLb);
    if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLb(); });

    if (wrap) {
      wrap.addEventListener('click', function (e) {
        if (e.target !== wrap) return;
        if (img && img.style.display !== 'none') openLb();
      });
    }
  }

  /* ── Audio ── */
  function initAudio() {
    var aud = document.getElementById('aud');
    var playBtn = document.getElementById('aud-play');
    var playIcon = document.getElementById('aud-play-icon');
    var seek = document.getElementById('aud-seek');
    var cur = document.getElementById('aud-cur');
    var dur = document.getElementById('aud-dur');
    var vol = document.getElementById('aud-vol');
    var rewBtn = document.getElementById('aud-rew');
    var fwdBtn = document.getElementById('aud-fwd');
    var loopBtn = document.getElementById('aud-loop');
    var canvas = document.getElementById('aud-spectrum');

    if (!aud || !playBtn) return;

    function setRangeFill(input, value, max) {
      if (!input) return;
      var min = parseFloat(input.min || '0');
      var upper = typeof max === 'number' ? max : parseFloat(input.max || '100');
      var current = typeof value === 'number' ? value : parseFloat(input.value || String(min));
      var denom = upper - min;
      var pct = denom <= 0 ? 0 : ((current - min) / denom) * 100;
      input.style.setProperty('--range-pct', Math.max(0, Math.min(100, pct)).toFixed(3) + '%');
    }

    function fmt(s) {
      if (!isFinite(s) || s < 0) return '—';
      var m = Math.floor(s / 60);
      var ss = Math.floor(s % 60);
      return m + ':' + (ss < 10 ? '0' : '') + ss;
    }

    var PLAY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    var PAUSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    function syncPlay() {
      playIcon.innerHTML = aud.paused ? PLAY_ICON : PAUSE_ICON;
    }

    function setArtSpin(on) {
      var a = document.getElementById('aud-art-box');
      if (a) a.classList.toggle('playing', on);
    }

    if (aud.readyState >= 1) dur.textContent = fmt(aud.duration);

    aud.addEventListener('loadedmetadata', function () {
      dur.textContent = fmt(aud.duration);
    });
    aud.addEventListener('timeupdate', function () {
      cur.textContent = fmt(aud.currentTime);
      if (seek && aud.duration && !seekDrag) {
        seek.value = (aud.currentTime / aud.duration * 100);
        setRangeFill(seek, parseFloat(seek.value), 100);
      }
    });
    aud.addEventListener('play', function () { syncPlay(); setArtSpin(true); });
    aud.addEventListener('pause', function () { syncPlay(); setArtSpin(false); });
    aud.addEventListener('ended', function () {
      if (seek) seek.value = 0;
      setRangeFill(seek, 0, 100);
      cur.textContent = '0:00';
      syncPlay();
      setArtSpin(false);
    });
    aud.addEventListener('error', function () { dur.textContent = 'エラー'; });

    var seekDrag = false;

    if (seek) {
      setRangeFill(seek, parseFloat(seek.value), 100);
      seek.addEventListener('mousedown', function () { seekDrag = true; });
      seek.addEventListener('touchstart', function () { seekDrag = true; }, { passive: true });
      seek.addEventListener('mouseup', function () { seekDrag = false; });
      seek.addEventListener('touchend', function () { seekDrag = false; });
      seek.addEventListener('input', function () {
        setRangeFill(seek, parseFloat(seek.value), 100);
        if (aud.duration) aud.currentTime = (seek.value / 100) * aud.duration;
      });
      seek.addEventListener('change', function () {
        seekDrag = false;
        setRangeFill(seek, parseFloat(seek.value), 100);
      });
    }

    if (rewBtn) rewBtn.addEventListener('click', function () {
      aud.currentTime = Math.max(0, aud.currentTime - 10);
    });
    if (fwdBtn) fwdBtn.addEventListener('click', function () {
      if (aud.duration) aud.currentTime = Math.min(aud.duration, aud.currentTime + 10);
    });
    if (vol) {
      setRangeFill(vol, parseFloat(vol.value), 1);
      vol.addEventListener('input', function () {
        aud.volume = parseFloat(vol.value);
        setRangeFill(vol, parseFloat(vol.value), 1);
      });
    }

    // On mobile devices, show note about hardware volume buttons
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      var volRow = document.getElementById('aud-vol-row');
      var volIos = document.getElementById('aud-vol-ios');
      if (volRow) volRow.style.display = 'flex';
      if (volIos) volIos.style.display = '';
    }

    if (loopBtn) {
      loopBtn.addEventListener('click', function () {
        aud.loop = !aud.loop;
        loopBtn.classList.toggle('active', aud.loop);
      });
    }

    /* ── AudioContext + Spectrum ── */
    var audioCtx = null;
    var analyser = null;
    var srcNode = null;
    var rafId = null;
    var freqData = null;
    var prevData = null;
    var sqrtPrev = null;

    function cleanupSpectrum() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (srcNode) {
        try { srcNode.disconnect(); } catch (e) { }
        srcNode = null;
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        try { audioCtx.close(); } catch (e) { }
      }
      audioCtx = null;
      analyser = null;
      freqData = null;
      prevData = null;
      sqrtPrev = null;
    }

    function initSpectrum() {
      if (!canvas) return false;
      if (audioCtx) return true;

      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var anl = ctx.createAnalyser();
        anl.fftSize = 2048;
        anl.smoothingTimeConstant = 0.5;
        audioCtx = ctx;
        analyser = anl;

        var s = ctx.createMediaElementSource(aud);
        s.connect(anl);
        anl.connect(ctx.destination);
        srcNode = s;

        var binCount = anl.frequencyBinCount;
        freqData = new Uint8Array(binCount);
        sqrtPrev = new Float32Array(128);

        var cctx = canvas.getContext('2d');
        var lastTime = 0;

        function draw(time) {
          rafId = requestAnimationFrame(draw);
          if (!audioCtx || !canvas || canvas.offsetWidth === 0) return;

          var cw = canvas.width = canvas.offsetWidth;
          var ch = canvas.height = canvas.offsetHeight;
          anl.getByteFrequencyData(freqData);
          cctx.clearRect(0, 0, cw, ch);

          var BARS = Math.max(24, Math.min(96, Math.floor(cw / 8)));
          var barMaxW = Math.max(2, (cw / BARS) - 2);
          var gap = barMaxW < 4 ? 0.6 : 1.2;
          var barW = barMaxW - gap;
          if (barW < 1.5) barW = 1.5;
          var totalBarWidth = BARS * barW + (BARS - 1) * gap;
          var cx = Math.max(0, (cw - totalBarWidth) / 2);
          var startBin = 2;
          var endBin = binCount - 1;
          var binRange = endBin - startBin;

          for (var i = 0; i < BARS; i++) {
            var t = i / (BARS - 1);
            var logIdx = startBin + Math.round(Math.pow(t, 1.9) * binRange);
            var val = freqData[logIdx];

            var smooth = sqrtPrev[i] || val;
            smooth = smooth * 0.5 + val * 0.5;
            sqrtPrev[i] = smooth;

            var bh = Math.max(1, (smooth / 255) * ch * 0.88);
            var x = cx + i * (barW + gap);
            var y = ch - bh;

            var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
            var grad = cctx.createLinearGradient(0, y, 0, ch);
            if (isDark) {
              grad.addColorStop(0, 'rgba(99,102,241,.95)');
              grad.addColorStop(0.35, 'rgba(59,130,246,.75)');
              grad.addColorStop(0.7, 'rgba(139,92,246,.4)');
              grad.addColorStop(1, 'rgba(139,92,246,.15)');
            } else {
              grad.addColorStop(0, 'rgba(79,70,229,.85)');
              grad.addColorStop(0.35, 'rgba(37,99,235,.75)');
              grad.addColorStop(0.7, 'rgba(109,40,217,.5)');
              grad.addColorStop(1, 'rgba(109,40,217,.15)');
            }
            cctx.fillStyle = grad;

            var radius = Math.min(barW / 2, 2.5);
            cctx.beginPath();
            cctx.moveTo(x, ch);
            cctx.lineTo(x, y + radius);
            cctx.quadraticCurveTo(x, y, x + radius, y);
            cctx.lineTo(x + barW - radius, y);
            cctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
            cctx.lineTo(x + barW, ch);
            cctx.closePath();
            cctx.fill();
          }

          if (!seekDrag && aud.duration && seek) {
            seek.value = (aud.currentTime / aud.duration * 100);
            setRangeFill(seek, parseFloat(seek.value), 100);
          }
          lastTime = time;
        }
        requestAnimationFrame(draw);
        return true;
      } catch (e) {
        cleanupSpectrum();
        return false;
      }
    }

    playBtn.addEventListener('click', function () {
      function doToggle() {
        if (aud.paused) {
          var p = aud.play();
          if (p && p.catch) p.catch(function () { });
        } else {
          aud.pause();
        }
      }

      if (!audioCtx) {
        var ok = initSpectrum();
        if (!ok) {
          doToggle();
          return;
        }
      }

      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(doToggle).catch(doToggle);
      } else {
        doToggle();
      }
    });

    // Metadata fetch
    if (cfg.fileId) {
      fetch('/f/' + cfg.fileId + '/meta')
        .then(function (r) { return r.json(); })
        .then(function (meta) {
          if (!meta || (!meta.title && !meta.artist && !meta.album)) return;
          var titleEl = document.getElementById('aud-title');
          var metaEl = document.getElementById('aud-meta');
          var artImg = document.getElementById('aud-art-img');
          var artIcon = document.getElementById('aud-art-icon');
          if (meta.title && titleEl) { titleEl.textContent = meta.title; titleEl.title = meta.title; }
          var parts = [];
          if (meta.artist) parts.push(meta.artist);
          if (meta.album) parts.push(meta.album);
          if (meta.year) parts.push(String(meta.year));
          if (parts.length > 0 && metaEl) { metaEl.hidden = false; metaEl.textContent = parts.join(' · '); }
          if (meta.coverArt && artImg && artIcon) {
            artImg.src = meta.coverArt;
            artImg.style.display = '';
            artIcon.style.display = 'none';
          }
        }).catch(function () { });
    }
  }

  /* ── Text / Code ── */
  function initText() {
    var MAX_BYTES = 512 * 1024;
    var rawUrl = cfg.rawUrl;
    var lang = cfg.hljsLang || 'plaintext';
    var isMarkdown = cfg.isMarkdown;
    var rawText = '';
    var mdMode = false;

    function fmtLineNums(text) {
      var lines = text.split('\n');
      return lines.map(function (_, i) { return i + 1; }).join('\n');
    }

    function renderCode(text) {
      var container = document.getElementById('code-container');
      var highlighted;
      try {
        if (window.hljs && lang !== 'plaintext' && typeof hljs.highlight === 'function') {
          highlighted = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
        } else {
          highlighted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
      } catch (e) {
        highlighted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      var nums = fmtLineNums(text);
      container.innerHTML = '<div class="ln-wrap"><pre class="ln-nums">' + nums.replace(/&/g, '&amp;') + '</pre><div class="ln-code"><pre class="hljs-pre"><code class="hljs">' + highlighted + '</code></pre></div></div>';
    }

    function renderMd(text) {
      var md = document.getElementById('md-container');
      if (window.marked && md && typeof marked.parse === 'function') {
        md.innerHTML = '<div class="markdown-body">' + marked.parse(text) + '</div>';
      }
    }

    fetch(rawUrl).then(function (r) {
      var reader = r.body.getReader();
      var chunks = [];
      var total = 0;
      var truncated = false;

      function read() {
        return reader.read().then(function (d) {
          if (d.done || truncated) {
            var blob = new Blob(chunks);
            return blob.text().then(function (txt) {
              rawText = txt;
              if (truncated) {
                var warn = document.getElementById('code-truncated-warn');
                if (warn) warn.style.display = 'flex';
              }
              renderCode(txt);
              if (isMarkdown) renderMd(txt);
            });
          }
          chunks.push(d.value);
          total += d.value.length;
          if (total >= MAX_BYTES) { truncated = true; reader.cancel(); }
          return read();
        });
      }
      return read();
    }).catch(function () {
      var container = document.getElementById('code-container');
      if (container) container.innerHTML = '<div class="code-error">ファイルの読み込みに失敗しました</div>';
    });

    var copyBtn = document.getElementById('code-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!rawText) return;
        navigator.clipboard.writeText(rawText).then(function () {
          copyBtn.textContent = 'コピー済み';
          copyBtn.classList.add('copied');
          setTimeout(function () { copyBtn.textContent = 'コードコピー'; copyBtn.classList.remove('copied'); }, 2000);
        }).catch(function () {
          var ta = document.createElement('textarea');
          ta.value = rawText;
          ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.textContent = 'コピー済み';
          copyBtn.classList.add('copied');
          setTimeout(function () { copyBtn.textContent = 'コードコピー'; copyBtn.classList.remove('copied'); }, 2000);
        });
      });
    }

    var mdToggle = document.getElementById('md-toggle');
    if (mdToggle && isMarkdown) {
      mdToggle.addEventListener('click', function () {
        mdMode = !mdMode;
        var codeContainer = document.getElementById('code-container');
        var mdContainer = document.getElementById('md-container');
        if (codeContainer) codeContainer.style.display = mdMode ? 'none' : 'block';
        if (mdContainer) mdContainer.style.display = mdMode ? 'block' : 'none';
        mdToggle.textContent = mdMode ? 'ソース表示' : 'レンダリング表示';
        if (mdMode && rawText) renderMd(rawText);
      });
    }
  }

  /* ── Font ── */
  function initFont() {
    var slider = document.getElementById('font-slider');
    var lbl = document.getElementById('font-size-lbl');
    var sample = document.getElementById('font-sample');
    if (slider) {
      slider.addEventListener('input', function () {
        var s = slider.value + 'px';
        sample.style.fontSize = s;
        lbl.textContent = slider.value + 'px';
      });
    }
  }

  /* ── Dispatch ── */
  switch (cfg.category) {
    case 'video': initVideo(); break;
    case 'image': initImage(); break;
    case 'audio': initAudio(); break;
    case 'text': initText(); break;
    case 'font': initFont(); break;
  }
})();
