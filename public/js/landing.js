/* Landing page behaviour: mobile nav, scroll reveals, live pricing. */
(function () {
  'use strict';

  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navlinks');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (event) {
      if (event.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  var revealables = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    revealables.forEach(function (el) {
      el.classList.add('visible');
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.08 }
    );
    revealables.forEach(function (el, index) {
      el.style.transitionDelay = Math.min(index % 6, 5) * 60 + 'ms';
      observer.observe(el);
    });
  }

  // Keep the marketing prices honest: they come from the same source as billing.
  fetch('/api/billing/plans')
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (!data || !data.plans) return;
      var cards = document.querySelectorAll('#pricingGrid .price-card');
      data.plans.forEach(function (plan, index) {
        var card = cards[index];
        if (!card) return;
        var price = card.querySelector('.price');
        if (price) price.innerHTML = plan.price + ' <small>ر.س / شهريًا</small>';
      });
    })
    .catch(function () {
      /* Static prices already rendered; nothing to do. */
    });
})();
