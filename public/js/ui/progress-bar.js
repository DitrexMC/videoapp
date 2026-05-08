/**
 * Thin top progress bar — activates automatically during API requests.
 *
 * Include as a regular <script> in every page, before any API calls.
 * Sets window.__progressBar for api.js to consume via lazy reference.
 */
(function () {
  var BAR_HEIGHT = 3;
  var TRICKLE_SPEED = 0.15;
  var TRICKLE_INTERVAL = 400;
  var FADE_DURATION = 300;

  var el = null;
  var activeCount = 0;
  var width = 0;
  var trickleTimer = null;
  var fadeTimer = null;

  function ensureEl() {
    if (el) return;
    if (!document.body) return;
    el = document.createElement('div');
    el.id = '__pb';
    var s = el.style;
    s.position = 'fixed';
    s.top = '0';
    s.left = '0';
    s.width = '0%';
    s.height = BAR_HEIGHT + 'px';
    s.background = 'var(--accent, #3b82f6)';
    s.zIndex = '99999';
    s.transition = 'width ' + TRICKLE_INTERVAL + 'ms linear, opacity ' + FADE_DURATION + 'ms ease';
    s.opacity = '0';
    s.pointerEvents = 'none';
    document.body.appendChild(el);
  }

  function trickle() {
    if (activeCount <= 0) return;
    if (width < 20) {
      width += TRICKLE_SPEED * 3;
    } else if (width < 80) {
      width += TRICKLE_SPEED;
    } else if (width < 95) {
      width += TRICKLE_SPEED * 0.3;
    }
    if (width > 95) width = 95;
    el.style.width = width + '%';
    trickleTimer = setTimeout(trickle, TRICKLE_INTERVAL);
  }

  window.__progressBar = {
    start: function () {
      ensureEl();
      if (!el) return;
      activeCount++;
      if (activeCount === 1) {
        width = 0;
        el.style.width = '0%';
        el.style.opacity = '1';
        trickle();
      }
    },
    done: function () {
      if (activeCount <= 0 || !el) return;
      activeCount--;
      if (activeCount <= 0) {
        activeCount = 0;
        clearTimeout(trickleTimer);
        trickleTimer = null;

        el.style.width = '100%';
        el.style.transition = 'width 150ms ease-out, opacity ' + FADE_DURATION + 'ms ease';

        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () {
          if (!el) return;
          el.style.opacity = '0';
          fadeTimer = setTimeout(function () {
            if (!el) return;
            width = 0;
            el.style.width = '0%';
            el.style.transition = 'width ' + TRICKLE_INTERVAL + 'ms linear, opacity ' + FADE_DURATION + 'ms ease';
          }, FADE_DURATION);
        }, 200);
      }
    },
    hide: function () {
      activeCount = 0;
      clearTimeout(trickleTimer);
      clearTimeout(fadeTimer);
      trickleTimer = null;
      width = 0;
      if (el) {
        el.style.width = '0%';
        el.style.opacity = '0';
      }
    },
  };
})();
