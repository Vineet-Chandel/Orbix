(function () {
  var intro = document.getElementById('orbix-preloader-root');
  if (!intro) return;
  var counter = intro.querySelector('.orbix-intro__counter');
  var start = performance.now();
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var readyAt = null;
  var completionStart = null;
  var completionFrom = 0;
  var value = 0;
  var frame;
  var exiting = false;

  function ready() {
    if (readyAt === null) readyAt = performance.now();
  }
  function remove() {
    cancelAnimationFrame(frame);
    window.removeEventListener('orbix:ready', ready);
    intro.remove();
  }
  function exit() {
    if (exiting) return;
    exiting = true;
    counter.textContent = '100';
    intro.classList.add('is-leaving');
    intro.addEventListener('animationend', function (event) {
      if (event.target === intro) remove();
    });
    // Fallback covers reduced motion and backgrounded tabs.
    window.setTimeout(remove, reducedMotion ? 0 : 650);
  }
  function tick(now) {
    if (exiting) return;
    var elapsed = now - start;
    // Intro progress, not a measure of downloaded bytes. Only a committed
    // React render can advance the counter to 100.
    if (readyAt !== null && (reducedMotion || elapsed >= 850)) {
      if (completionStart === null) {
        completionStart = now;
        completionFrom = value;
      }
      var progress = reducedMotion ? 1 : Math.min(1, (now - completionStart) / 160);
      value = Math.round(completionFrom + (100 - completionFrom) * progress);
      if (progress === 1) { exit(); return; }
    } else {
      value = Math.min(94, Math.round(94 * (1 - Math.exp(-elapsed / 650))));
    }
    var next = String(value).padStart(3, '0');
    if (counter.textContent !== next) counter.textContent = next;
    frame = requestAnimationFrame(tick);
  }
  window.addEventListener('orbix:ready', ready);
  frame = requestAnimationFrame(tick);
}());
