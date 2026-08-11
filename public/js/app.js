/* MOHTAWA app shell: routing, state and page rendering. */
(function () {
  'use strict';

  var state = {
    config: { plans: [], aiEnabled: false },
    user: null,
    brands: [],
    brandId: null,
    usage: null,
    page: 'home',
    options: null,
    lastPackage: null,
    lastProbe: null,
    calendar: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
  };

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var pageEl = $('#page');

  /* ---------------- utilities ---------------- */

  function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function num(value) {
    var n = Number(value) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function toast(message, type) {
    var box = document.createElement('div');
    box.className = 'toast ' + (type || 'success');
    box.textContent = message;
    $('#toasts').appendChild(box);
    setTimeout(function () {
      box.style.opacity = '0';
      setTimeout(function () {
        box.remove();
      }, 300);
    }, 3600);
  }

  function fail(error) {
    toast(error && error.message ? error.message : 'حدث خطأ غير متوقع.', 'error');
    if (error && error.status === 401) logout();
  }

  function busy(button, on) {
    if (!button) return;
    button.disabled = !!on;
    if (on) {
      button.dataset.label = button.innerHTML;
      button.innerHTML = '<span class="spinner"></span>';
    } else if (button.dataset.label) {
      button.innerHTML = button.dataset.label;
    }
  }

  function arabicDate(iso, withWeekday) {
    if (!iso) return '—';
    var options = { day: 'numeric', month: 'long' };
    if (withWeekday) options.weekday = 'long';
    try {
      return new Date(iso).toLocaleDateString('ar-u-ca-gregory-nu-latn', options);
    } catch {
      return String(iso).slice(0, 10);
    }
  }

  function deltaTag(value) {
    if (value === null || value === undefined) return '<span class="delta flat">— لا مقارنة</span>';
    var dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    var arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
    return '<span class="delta ' + dir + '">' + arrow + ' ' + Math.abs(value) + '%</span>';
  }

  function currentBrand() {
    return (
      state.brands.filter(function (brand) {
        return brand.id === state.brandId;
      })[0] || state.brands[0] || null
    );
  }

  function skeleton(count) {
    var out = '';
    for (var i = 0; i < (count || 4); i += 1) out += '<div class="skeleton"></div>';
    return '<div class="grid grid-2">' + out + '</div>';
  }

  function optionList(items, selected, valueKey, labelKey) {
    return items
      .map(function (item) {
        var value = item[valueKey || 'id'];
        var label = item[labelKey || 'label'];
        return (
          '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>'
        );
      })
      .join('');
  }

  /* ---------------- modal ---------------- */

  function openModal(html, onMount) {
    var root = $('#modalRoot');
    root.innerHTML = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    var backdrop = $('.modal-backdrop', root);
    backdrop.addEventListener('mousedown', function (event) {
      if (event.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', escClose);
    if (onMount) onMount(root);
    var focusable = root.querySelector('input, select, textarea, button');
    if (focusable) focusable.focus();
  }

  function escClose(event) {
    if (event.key === 'Escape') closeModal();
  }

  function closeModal() {
    $('#modalRoot').innerHTML = '';
    document.removeEventListener('keydown', escClose);
  }

  /* ---------------- auth ---------------- */

  function showAuth(tab) {
    $('#authScreen').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    switchAuthTab(tab === 'register' ? 'register' : 'login');
  }

  function switchAuthTab(tab) {
    var isRegister = tab === 'register';
    $('#tabLogin').setAttribute('aria-selected', String(!isRegister));
    $('#tabRegister').setAttribute('aria-selected', String(isRegister));
    $('#loginForm').classList.toggle('hidden', isRegister);
    $('#registerForm').classList.toggle('hidden', !isRegister);
    $('#authError').classList.add('hidden');
  }

  function authError(message) {
    var box = $('#authError');
    box.textContent = message;
    box.classList.remove('hidden');
  }

  function logout() {
    api.setToken(null);
    state.user = null;
    state.brands = [];
    location.hash = '#login';
    showAuth('login');
  }

  function afterLogin(payload) {
    api.setToken(payload.token);
    return api
      .get('/auth/me')
      .then(function (me) {
        state.user = me.user;
        state.brands = me.brands || [];
        state.usage = me.usage;
        state.brandId = (state.brands[0] || {}).id || null;
        $('#authScreen').classList.add('hidden');
        $('#appShell').classList.remove('hidden');
        history.replaceState(null, '', '/app');
        renderChrome();
        if (!state.brands.length) startOnboarding();
        else go('home');
      });
  }

  /* ---------------- chrome ---------------- */

  function renderChrome() {
    var brand = currentBrand();
    $('#profileName').textContent = state.user ? state.user.name : '—';
    $('#profilePlan').textContent = state.usage ? 'باقة ' + state.usage.planName : '';
    $('#avatar').textContent = state.user ? state.user.name.trim().charAt(0) : 'م';

    var select = $('#brandSwitch');
    select.innerHTML = state.brands
      .map(function (item) {
        return '<option value="' + esc(item.id) + '"' + (brand && item.id === brand.id ? ' selected' : '') + '>' + esc(item.name) + '</option>';
      })
      .join('');

    var meter = $('#usageMeter');
    if (!state.usage) {
      meter.innerHTML = '';
      return;
    }
    var rows = [
      { key: 'generations', label: 'توليد المحتوى' },
      { key: 'videoAnalyses', label: 'تحليل الفيديو' },
    ];
    meter.innerHTML = rows
      .map(function (row) {
        var item = state.usage[row.key];
        if (!item) return '';
        var pct = item.unlimited ? 12 : Math.min(100, Math.round((item.used / Math.max(1, item.limit)) * 100));
        var right = item.unlimited ? 'غير محدود' : item.used + ' / ' + item.limit;
        return (
          '<div><small><span>' + esc(row.label) + '</span><span dir="ltr">' + esc(right) + '</span></small>' +
          '<div class="meter"><i style="width:' + pct + '%"></i></div></div>'
        );
      })
      .join('');
  }

  function refreshMe() {
    return api.get('/auth/me').then(function (me) {
      state.user = me.user;
      state.brands = me.brands || [];
      state.usage = me.usage;
      if (!currentBrand() && state.brands.length) state.brandId = state.brands[0].id;
      renderChrome();
    });
  }

  function go(page) {
    state.page = page;
    Array.prototype.forEach.call(document.querySelectorAll('#menu button'), function (button) {
      button.classList.toggle('active', button.dataset.page === page);
    });
    var render = pages[page] || pages.home;
    pageEl.innerHTML = '';
    pageEl.scrollTop = 0;
    render();
  }

  function header(kicker, title, actionsHtml) {
    return (
      '<div class="topbar"><div><div class="kicker">' + esc(kicker) + '</div><h1>' + esc(title) + '</h1></div>' +
      '<div class="top-actions">' + (actionsHtml || '') + '</div></div>'
    );
  }

  /* ---------------- onboarding ---------------- */

  function startOnboarding() {
    var draft = { name: '', niche: 'marketing', goal: 'reach', audience: '', tone: 'saudi', postsPerWeek: 3, platforms: ['instagram'] };
    var step = 0;

    var niches = [
      { id: 'marketing', label: 'تسويق وصناعة محتوى' },
      { id: 'ecommerce', label: 'تجارة إلكترونية' },
      { id: 'realestate', label: 'عقار' },
      { id: 'beauty', label: 'تجميل وعناية' },
      { id: 'food', label: 'مطاعم وأغذية' },
      { id: 'fitness', label: 'رياضة ولياقة' },
      { id: 'education', label: 'تعليم وتدريب' },
    ];
    var goals = [
      { id: 'reach', label: 'زيادة الوصول' },
      { id: 'trust', label: 'بناء الثقة' },
      { id: 'conversion', label: 'جذب عملاء' },
      { id: 'sales', label: 'مبيعات مباشرة' },
    ];
    var platforms = [
      { id: 'instagram', label: 'Instagram' },
      { id: 'tiktok', label: 'TikTok' },
      { id: 'linkedin', label: 'LinkedIn' },
      { id: 'youtube', label: 'YouTube' },
    ];

    function body() {
      if (step === 0) {
        return (
          '<h2>خلينا نبني Brand Brain 🧠</h2>' +
          '<p style="color:var(--text-2)">هذي المعلومات تُحفظ مرة واحدة، وتُطبَّق على كل فكرة وسكربت بعدها.</p>' +
          '<div class="field"><label for="obName">اسم البراند</label>' +
          '<input class="input" id="obName" value="' + esc(draft.name) + '" placeholder="مثال: Raghad Studio" /></div>' +
          '<div class="field"><label for="obNiche">المجال</label><select class="input" id="obNiche">' +
          optionList(niches, draft.niche) + '</select></div>'
        );
      }
      if (step === 1) {
        return (
          '<h2>وش هدفك الأساسي؟</h2>' +
          '<p style="color:var(--text-2)">الهدف يحدد توزيع محتواك في التقويم ونوع الفورمات المقترح.</p>' +
          '<div class="field"><label for="obGoal">الهدف</label><select class="input" id="obGoal">' +
          optionList(goals, draft.goal) + '</select></div>' +
          '<div class="field"><label for="obAudience">لمن تتحدث؟</label>' +
          '<input class="input" id="obAudience" value="' + esc(draft.audience) + '" placeholder="مثال: أصحاب متاجر إلكترونية في السعودية" /></div>'
        );
      }
      return (
        '<h2>أين تنشر، وكم مرة؟</h2>' +
        '<p style="color:var(--text-2)">نبني عليها خطتك الأسبوعية.</p>' +
        '<div class="field"><label>المنصات</label><div class="chips" id="obPlatforms">' +
        platforms
          .map(function (item) {
            var on = draft.platforms.indexOf(item.id) !== -1;
            return '<button type="button" class="chip" data-id="' + item.id + '" aria-pressed="' + on + '">' + esc(item.label) + '</button>';
          })
          .join('') +
        '</div></div>' +
        '<div class="field"><label for="obCadence">عدد المنشورات أسبوعيًا</label>' +
        '<input class="input" id="obCadence" type="number" min="1" max="14" value="' + draft.postsPerWeek + '" /></div>'
      );
    }

    function render() {
      openModal(
        '<div class="stepdots">' +
          [0, 1, 2].map(function (i) { return '<i class="' + (i <= step ? 'on' : '') + '"></i>'; }).join('') +
          '</div>' + body() +
          '<div class="modal-actions">' +
          '<button class="btn btn-quiet" id="obBack">' + (step === 0 ? 'تخطٍّ' : 'رجوع') + '</button>' +
          '<button class="btn btn-primary" id="obNext">' + (step === 2 ? 'إنشاء البراند' : 'التالي') + '</button>' +
          '</div>',
        function (root) {
          var chips = $('#obPlatforms', root);
          if (chips) {
            chips.addEventListener('click', function (event) {
              var chip = event.target.closest('.chip');
              if (!chip) return;
              var id = chip.dataset.id;
              var index = draft.platforms.indexOf(id);
              if (index === -1) draft.platforms.push(id);
              else if (draft.platforms.length > 1) draft.platforms.splice(index, 1);
              chip.setAttribute('aria-pressed', String(draft.platforms.indexOf(id) !== -1));
            });
          }

          $('#obBack', root).addEventListener('click', function () {
            if (step === 0) {
              closeModal();
              go('home');
              return;
            }
            step -= 1;
            render();
          });

          $('#obNext', root).addEventListener('click', function (event) {
            var nextBtn = event.currentTarget;
            if (step === 0) {
              draft.name = $('#obName', root).value.trim();
              draft.niche = $('#obNiche', root).value;
              if (draft.name.length < 2) return toast('اكتب اسم البراند أولًا.', 'error');
            } else if (step === 1) {
              draft.goal = $('#obGoal', root).value;
              draft.audience = $('#obAudience', root).value.trim();
            } else {
              draft.postsPerWeek = Number($('#obCadence', root).value) || 3;
              busy(nextBtn, true);
              return api
                .post('/brands', draft)
                .then(function () {
                  closeModal();
                  toast('تم إنشاء البراند. صار كل شيء مخصصًا لك.');
                  return refreshMe().then(function () { go('home'); });
                })
                .catch(function (error) {
                  busy(nextBtn, false);
                  fail(error);
                });
            }
            step += 1;
            render();
          });
        }
      );
    }

    render();
  }

  /* ---------------- pages ---------------- */

  var pages = {};

  pages.home = function () {
    var brand = currentBrand();
    if (!brand) {
      pageEl.innerHTML =
        header('البداية', 'أنشئ أول براند') +
        '<div class="panel empty-state"><div class="big">🧠</div><p>ما عندك براند بعد. أنشئ واحدًا لتبدأ.</p>' +
        '<button class="btn btn-primary" id="newBrand">إنشاء براند</button></div>';
      $('#newBrand').addEventListener('click', startOnboarding);
      return;
    }

    var greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
    pageEl.innerHTML =
      header(
        arabicDate(new Date().toISOString(), true),
        greeting + ' ' + (state.user ? state.user.name.split(' ')[0] : ''),
        '<button class="btn btn-ghost" data-goto="calendar">التقويم</button>' +
          '<button class="btn btn-primary" data-goto="studio">إنشاء محتوى</button>'
      ) + '<div id="homeBody">' + skeleton(4) + '</div>';

    pageEl.addEventListener('click', function (event) {
      var target = event.target.closest('[data-goto]');
      if (target) go(target.dataset.goto);
    });

    api
      .query('/analytics/summary', { brandId: brand.id })
      .then(function (data) {
        var overview = data.overview;
        var metrics = overview.metrics
          .map(function (metric) {
            return (
              '<div class="metric"><div class="label">' + esc(metric.label) + ' · 30 يومًا</div>' +
              '<div class="value">' + num(metric.value) + '</div>' + deltaTag(metric.delta) + '</div>'
            );
          })
          .join('');

        var bars = overview.series
          .map(function (point) {
            var max = Math.max.apply(
              null,
              overview.series.map(function (p) { return p.views; })
            ) || 1;
            var height = Math.max(4, Math.round((point.views / max) * 100));
            return '<div class="bar" style="height:' + height + '%" title="' + esc(point.label) + ': ' + num(point.views) + '"></div>';
          })
          .join('');

        var labels = overview.series
          .map(function (point) { return '<span>' + esc(point.label) + '</span>'; })
          .join('');

        // Fill the panel with what the platform learned when there are few actions to suggest.
        var cards = data.recommendations.map(function (rec) {
          return { title: rec.icon + ' ' + rec.title, body: rec.body };
        });
        (data.learnings || []).forEach(function (item) {
          if (cards.length < 3) cards.push({ title: '📌 ' + item.title, body: item.body });
        });
        var recs = cards
          .map(function (card) {
            return '<div class="insight"><b>' + esc(card.title) + '</b><span>' + esc(card.body) + '</span></div>';
          })
          .join('');

        var upcoming = data.upcoming.length
          ? data.upcoming
              .map(function (item) {
                return (
                  '<div class="insight"><b>' + esc(item.title) + '</b><span>' +
                  esc(arabicDate(item.scheduledFor, true) + ' · ' + item.format) + '</span></div>'
                );
              })
              .join('')
          : '<div class="insight"><b>لا يوجد محتوى مجدول</b><span>افتح التقويم واقبل الخطة المقترحة لهذا الأسبوع.</span></div>';

        $('#homeBody').innerHTML =
          '<div class="grid grid-4">' + metrics + '</div>' +
          '<div class="grid grid-wide" style="margin-top:15px">' +
          '<div class="panel"><div class="panel-head"><h3>المشاهدات خلال 30 يومًا</h3>' +
          '<span class="badge">' + esc(overview.postsPublished + ' منشور') + '</span></div>' +
          (overview.postsPublished
            ? '<div class="bars">' + bars + '</div><div class="bar-labels">' + labels + '</div>'
            : '<div class="empty-state"><div class="big">📊</div><p>ما سجّلت أداء أي منشور بعد.</p>' +
              '<button class="btn btn-ghost btn-sm" data-goto="analytics">سجّل أول منشور</button></div>') +
          '<p class="hint" style="margin-top:10px">' + esc(overview.dataBasis) + '</p></div>' +
          '<div class="panel"><h3>الخطوة التالية</h3>' + recs + '</div>' +
          '</div>' +
          '<div class="grid grid-2" style="margin-top:15px">' +
          '<div class="panel"><div class="panel-head"><h3>القادم هذا الأسبوع</h3>' +
          '<button class="btn btn-quiet btn-sm" data-goto="calendar">فتح التقويم</button></div>' + upcoming + '</div>' +
          '<div class="panel"><h3>ملخص المحتوى</h3>' +
          '<div class="grid grid-3">' +
          '<div class="metric"><div class="label">أفكار</div><div class="value">' + data.counts.ideas + '</div></div>' +
          '<div class="metric"><div class="label">مجدول</div><div class="value">' + data.counts.scheduled + '</div></div>' +
          '<div class="metric"><div class="label">منشور</div><div class="value">' + data.counts.published + '</div></div>' +
          '</div></div></div>';
      })
      .catch(fail);
  };

  pages.trends = function () {
    var brand = currentBrand();
    pageEl.innerHTML =
      header('اكتشاف الفورمات', 'Trend Radar', '<button class="btn btn-ghost" id="reloadTrends">تحديث</button>') +
      '<div class="toolbar" id="trendFilters"></div><div id="trendGrid" class="grid grid-3">' + skeleton(6) + '</div>' +
      '<p class="hint" id="trendSource" style="margin-top:14px"></p>';

    api.get('/trends/filters').then(function (filters) {
      $('#trendFilters').innerHTML =
        '<select class="input" id="fPlatform">' + optionList(filters.platforms, (brand.platforms || [])[0]) + '</select>' +
        '<select class="input" id="fNiche">' + optionList(filters.niches, brand.niche) + '</select>' +
        '<select class="input" id="fRegion">' + optionList(filters.regions, brand.region) + '</select>' +
        '<select class="input" id="fGoal">' + optionList(filters.goals, brand.goal) + '</select>';
      ['fPlatform', 'fNiche', 'fRegion', 'fGoal'].forEach(function (id) {
        $('#' + id).addEventListener('change', load);
      });
      load();
    }).catch(fail);

    $('#reloadTrends').addEventListener('click', load);

    function load() {
      var grid = $('#trendGrid');
      grid.innerHTML = skeleton(6);
      api
        .query('/trends', {
          brandId: brand.id,
          platform: $('#fPlatform') ? $('#fPlatform').value : '',
          niche: $('#fNiche') ? $('#fNiche').value : '',
          region: $('#fRegion') ? $('#fRegion').value : '',
          goal: $('#fGoal') ? $('#fGoal').value : '',
        })
        .then(function (data) {
          $('#trendSource').textContent = data.source;
          grid.innerHTML = data.trends
            .map(function (trend) {
              return (
                '<article class="trend-card">' +
                '<div class="trend-top"><span class="badge ' + esc(trend.tone) + '">' + esc(trend.stageLabel) + '</span>' +
                '<span class="badge">' + esc(trend.formats.join(' · ')) + '</span></div>' +
                '<h3>' + esc(trend.title) + '</h3>' +
                '<p>' + esc(trend.summary) + '</p>' +
                '<div class="trend-hook">' + esc(trend.hook) + '</div>' +
                '<div class="trend-foot"><div><small style="color:var(--muted)">درجة الفورمات</small>' +
                '<div class="score-num">' + trend.score + '</div></div>' +
                '<button class="btn btn-ghost btn-sm" data-use="' + esc(trend.key) + '" data-title="' + esc(trend.title) + '">استخدمه</button>' +
                '</div></article>'
              );
            })
            .join('');
        })
        .catch(fail);
    }

    pageEl.addEventListener('click', function (event) {
      var button = event.target.closest('[data-use]');
      if (!button) return;
      go('studio');
      setTimeout(function () {
        var topic = $('#stTopic');
        if (topic) {
          topic.value = button.dataset.title;
          topic.dataset.trendKey = button.dataset.use;
          topic.focus();
        }
      }, 60);
    });
  };

  pages.studio = function () {
    var brand = currentBrand();
    pageEl.innerHTML =
      header(
        'Content Studio',
        'حوّل الهدف إلى محتوى',
        state.config.aiEnabled
          ? '<span class="badge purple">Claude مفعّل</span>'
          : '<span class="badge">المولّد الداخلي</span>'
      ) + '<div class="grid grid-form"><div class="panel" id="studioForm"></div><div id="studioOut">' +
      '<div class="generated"><div class="empty-state"><div class="big">✦</div>' +
      '<p>اختر إعداداتك واضغط «ولّد المحتوى».</p></div></div></div></div>';

    api.get('/studio/options').then(function (options) {
      state.options = options;
      $('#studioForm').innerHTML =
        '<div class="field"><label for="stTopic">الموضوع</label>' +
        '<input class="input" id="stTopic" placeholder="مثال: كيف تخلي المحتوى يجيب عملاء؟" /></div>' +
        '<div class="field"><label for="stGoal">الهدف</label><select class="input" id="stGoal">' +
        optionList(options.goals, brand.goal) + '</select></div>' +
        '<div class="field"><label for="stPlatform">المنصة</label><select class="input" id="stPlatform">' +
        optionList(options.platforms, (brand.platforms || [])[0]) + '</select></div>' +
        '<div class="field"><label for="stExecution">طريقة التنفيذ</label><select class="input" id="stExecution">' +
        optionList(options.executions, 'faceless') + '</select></div>' +
        '<div class="field"><label for="stTone">الأسلوب</label><select class="input" id="stTone">' +
        optionList(options.tones, brand.tone) + '</select></div>' +
        '<button class="btn btn-primary btn-block" id="stGenerate">✦ ولّد المحتوى</button>' +
        '<p class="hint">' +
        (options.aiEnabled
          ? 'يُولَّد عبر Claude، ويعود المولّد الداخلي تلقائيًا عند أي انقطاع.'
          : 'يعمل بالمولّد الداخلي. أضف ANTHROPIC_API_KEY لتشغيل Claude.') +
        '</p>';

      $('#stGenerate').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var topicEl = $('#stTopic');
        var topic = topicEl.value.trim();
        if (topic.length < 3) return toast('اكتب موضوعًا أوضح (3 أحرف فأكثر).', 'error');
        busy(button, true);
        $('#studioOut').innerHTML = '<div class="generated">' + skeleton(3) + '</div>';
        api
          .post('/studio/generate', {
            brandId: brand.id,
            topic: topic,
            goal: $('#stGoal').value,
            platform: $('#stPlatform').value,
            execution: $('#stExecution').value,
            tone: $('#stTone').value,
            trendKey: topicEl.dataset.trendKey || null,
          })
          .then(function (data) {
            busy(button, false);
            state.lastPackage = data.package;
            renderPackage(data.package);
            refreshMe();
          })
          .catch(function (error) {
            busy(button, false);
            $('#studioOut').innerHTML =
              '<div class="generated"><div class="empty-state"><div class="big">⚠️</div><p>' + esc(error.message) + '</p></div></div>';
            fail(error);
          });
      });
    }).catch(fail);

    function renderPackage(pkg) {
      $('#studioOut').innerHTML =
        '<div class="generated">' +
        '<div class="panel-head"><div><span class="badge purple">' + esc(pkg.platformLabel + ' · ' + pkg.goalLabel) + '</span>' +
        (pkg.source === 'ai' ? ' <span class="badge rise">Claude</span>' : ' <span class="badge">مولّد داخلي</span>') +
        '</div><div style="display:flex;gap:8px">' +
        '<button class="btn btn-ghost btn-sm" id="copyAll">نسخ الكل</button>' +
        '<button class="btn btn-primary btn-sm" id="toCalendar">أضف للتقويم</button></div></div>' +
        '<h2 style="font-size:22px;margin:6px 0 0">' + esc(pkg.title) + '</h2>' +
        '<h4>الهوك (وبدائله)</h4><ul>' +
        pkg.hooks.map(function (hook) { return '<li>' + esc(hook) + '</li>'; }).join('') + '</ul>' +
        '<h4>السكربت</h4>' +
        pkg.script
          .map(function (beat) {
            return '<div class="script-beat"><b>' + esc(beat.label) + '</b><span>' + esc(beat.text) + '</span></div>';
          })
          .join('') +
        '<h4>قائمة اللقطات</h4><ol>' +
        pkg.shotList.map(function (shot) { return '<li>' + esc(shot) + '</li>'; }).join('') + '</ol>' +
        '<h4>الكابشن</h4><div class="copyable">' + esc(pkg.caption) + '</div>' +
        '<h4>الهاشتاقات</h4><div class="chips">' +
        pkg.hashtags.map(function (tag) { return '<span class="chip">' + esc(tag) + '</span>'; }).join('') + '</div>' +
        '<h4>الـCTA</h4><div class="copyable">' + esc(pkg.cta) + '</div>' +
        '<h4>ملاحظات</h4><ul>' +
        pkg.notes.map(function (note) { return '<li>' + esc(note) + '</li>'; }).join('') + '</ul>' +
        '</div>';

      $('#copyAll').addEventListener('click', function () {
        var text = [
          pkg.title,
          '',
          'الهوك: ' + pkg.hook,
          '',
          'السكربت:',
          pkg.script.map(function (b) { return b.label + ' — ' + b.text; }).join('\n'),
          '',
          'اللقطات:',
          pkg.shotList.join('\n'),
          '',
          'الكابشن:',
          pkg.caption,
          '',
          pkg.hashtags.join(' '),
          '',
          'CTA: ' + pkg.cta,
        ].join('\n');
        navigator.clipboard
          .writeText(text)
          .then(function () { toast('نُسخ المحتوى كاملًا.'); })
          .catch(function () { toast('تعذّر النسخ من المتصفح.', 'error'); });
      });

      $('#toCalendar').addEventListener('click', function (event) {
        var button = event.currentTarget;
        busy(button, true);
        var when = new Date();
        when.setDate(when.getDate() + 1);
        api
          .post('/content', {
            brandId: currentBrand().id,
            title: pkg.title,
            hook: pkg.hook,
            caption: pkg.caption,
            cta: pkg.cta,
            format: pkg.platform === 'linkedin' ? 'Post' : 'Reel',
            platform: pkg.platform,
            pillar: pkg.goal === 'sales' ? 'conversion' : pkg.goal,
            status: 'scheduled',
            scheduledFor: when.toISOString(),
          })
          .then(function () {
            busy(button, false);
            toast('أُضيف إلى التقويم غدًا. عدّل الموعد من صفحة التقويم.');
          })
          .catch(function (error) {
            busy(button, false);
            fail(error);
          });
      });
    }
  };

  pages.video = function () {
    pageEl.innerHTML =
      header('Video Intelligence', 'حلّل أي فيديو قبل نشره') +
      '<div class="drop" id="drop">' +
      '<div style="font-size:38px" aria-hidden="true">🎬</div>' +
      '<h3>اسحب الفيديو هنا</h3>' +
      '<p>MP4 أو MOV · التحليل يتم داخل متصفحك ولا يُرفع الملف إلى أي خادم.</p>' +
      '<input id="videoInput" type="file" accept="video/*" class="sr-only" />' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px">' +
      '<button class="btn btn-primary" id="pickVideo">اختيار فيديو</button></div>' +
      '<div id="probeStatus" class="hint" style="margin-top:12px"></div></div>' +
      '<div id="videoResult"></div>' +
      '<div class="panel" style="margin-top:16px"><h3>آخر التحليلات</h3><div id="videoHistory"></div></div>';

    var drop = $('#drop');
    var input = $('#videoInput');

    $('#pickVideo').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function (event) {
      if (event.target.files && event.target.files[0]) handleFile(event.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.remove('drag');
      });
    });
    drop.addEventListener('drop', function (event) {
      var file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    loadHistory();

    function handleFile(file) {
      if (file.type && file.type.indexOf('video/') !== 0) {
        return toast('الملف ليس فيديو.', 'error');
      }
      var max = state.config.maxVideoBytes || 200 * 1024 * 1024;
      if (file.size > max) {
        return toast('حجم الملف أكبر من الحد المسموح (' + Math.round(max / 1048576) + 'MB).', 'error');
      }
      var status = $('#probeStatus');
      status.textContent = 'جارٍ قياس الفيديو داخل المتصفح… 0%';

      probeVideo(file, function (ratio) {
        status.textContent = 'جارٍ قياس الفيديو داخل المتصفح… ' + Math.round(ratio * 100) + '%';
      })
        .then(function (probe) {
          state.lastProbe = probe;
          status.textContent =
            'اكتمل القياس: ' + probe.durationSeconds.toFixed(1) + ' ثانية · ' + probe.cuts.length + ' تغيّر مشهد.';
          renderInputs(probe);
        })
        .catch(function (error) {
          status.textContent = '';
          fail(error);
        });
    }

    function renderInputs(probe) {
      $('#videoResult').innerHTML =
        '<div class="video-result">' +
        '<div class="video-preview"><video src="' + esc(probe.url) + '" controls playsinline></video></div>' +
        '<div class="panel"><h3>أكمل التحليل</h3>' +
        '<p class="hint">قِسنا الملف. اكتب الهوك والـCTA حتى نقيّمهما أيضًا.</p>' +
        '<div class="field"><label for="vHook">نص الهوك (أول جملة)</label>' +
        '<input class="input" id="vHook" placeholder="مثال: ليش محتواك ما يجيب عملاء؟" /></div>' +
        '<div class="field"><label for="vCta">نص الـCTA</label>' +
        '<input class="input" id="vCta" placeholder="مثال: احفظ الفيديو وطبّقه هذا الأسبوع" /></div>' +
        '<div class="field"><label class="chips"><button type="button" class="chip" id="vCaptions" aria-pressed="false">فيه نصوص محروقة على الفيديو</button></label></div>' +
        '<button class="btn btn-primary btn-block" id="vAnalyze">حلّل الآن</button></div></div>';

      var captionsOn = false;
      $('#vCaptions').addEventListener('click', function (event) {
        captionsOn = !captionsOn;
        event.currentTarget.setAttribute('aria-pressed', String(captionsOn));
      });

      $('#vAnalyze').addEventListener('click', function (event) {
        var button = event.currentTarget;
        busy(button, true);
        api
          .post('/video/analyze', {
            brandId: currentBrand().id,
            durationSeconds: probe.durationSeconds,
            width: probe.width,
            height: probe.height,
            sizeBytes: probe.sizeBytes,
            cuts: probe.cuts,
            fileName: probe.fileName,
            hookText: $('#vHook').value,
            ctaText: $('#vCta').value,
            hasCaptions: captionsOn,
            platform: (currentBrand().platforms || [])[0],
          })
          .then(function (data) {
            busy(button, false);
            renderAnalysis(data.analysis, probe.url);
            refreshMe();
            loadHistory();
          })
          .catch(function (error) {
            busy(button, false);
            fail(error);
          });
      });
    }

    function renderAnalysis(analysis, url) {
      var tone = analysis.overall >= 85 ? 'rise' : analysis.overall >= 70 ? 'steady' : 'peak';
      $('#videoResult').innerHTML =
        '<div class="video-result">' +
        '<div class="video-preview"><video src="' + esc(url) + '" controls playsinline></video></div>' +
        '<div class="panel">' +
        '<div class="big-score"><div><small style="color:var(--muted)">Video Score · ' + esc(analysis.platformName) + '</small>' +
        '<h2>' + analysis.overall + ' / 100</h2></div><span class="badge ' + tone + '">' + esc(analysis.verdict) + '</span></div>' +
        analysis.dimensions
          .map(function (dim) {
            return (
              '<div class="score-row"><span>' + esc(dim.label) + '</span>' +
              '<div class="progress"><i style="width:' + dim.score + '%"></i></div><b>' + dim.score + '</b></div>'
            );
          })
          .join('') +
        '<div class="grid grid-3" style="margin:16px 0">' +
        '<div class="metric"><div class="label">المدة</div><div class="value" style="font-size:20px">' + esc(analysis.measurements.durationLabel) + '</div></div>' +
        '<div class="metric"><div class="label">تغيّرات المشهد</div><div class="value" style="font-size:20px">' + analysis.measurements.cuts + '</div></div>' +
        '<div class="metric"><div class="label">الأبعاد</div><div class="value" style="font-size:20px">' + esc(analysis.measurements.aspectLabel) + '</div></div>' +
        '</div>' +
        (analysis.risks.length
          ? '<h3>لحظات فقدان الانتباه</h3>' +
            analysis.risks
              .map(function (risk) {
                return '<div class="insight"><b>⚠️ ' + esc(risk.atLabel) + '</b><span>' + esc(risk.message) + '</span></div>';
              })
              .join('')
          : '<div class="insight"><b>✅ الإيقاع متماسك</b><span>لا توجد مشاهد ثابتة طويلة.</span></div>') +
        '<h3 style="margin-top:16px">أهم التحسينات</h3>' +
        analysis.recommendations
          .map(function (rec) {
            return '<div class="insight"><b>' + esc(rec.title) + '</b><span>' + esc(rec.body) + '</span></div>';
          })
          .join('') +
        '<p class="hint">' + esc(analysis.disclaimer) + '</p>' +
        '</div></div>';
    }

    function loadHistory() {
      api
        .query('/video/history', { brandId: currentBrand().id, limit: 5 })
        .then(function (data) {
          $('#videoHistory').innerHTML = data.analyses.length
            ? data.analyses
                .map(function (row) {
                  return (
                    '<div class="insight"><b>' + esc(row.fileName || 'فيديو') + ' · ' + row.overall + '/100</b>' +
                    '<span>' + esc(row.durationLabel + ' · أضعف عنصر: ' + row.weakest.label) + '</span></div>'
                  );
                })
                .join('')
            : '<p class="hint">لا يوجد تحليل سابق بعد.</p>';
        })
        .catch(function () {
          $('#videoHistory').innerHTML = '<p class="hint">تعذّر تحميل السجل.</p>';
        });
    }
  };

  pages.calendar = function () {
    var monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    function render() {
      pageEl.innerHTML =
        header(
          monthNames[state.calendar.month - 1] + ' ' + state.calendar.year,
          'تقويم المحتوى',
          '<button class="btn btn-ghost btn-sm" id="prevMonth">الشهر السابق</button>' +
            '<button class="btn btn-ghost btn-sm" id="nextMonth">الشهر التالي</button>' +
            '<button class="btn btn-primary" id="applyPlan">اعتمد الخطة المقترحة</button>'
        ) + '<div class="panel" id="calendarPanel">' + skeleton(2) + '</div>';

      $('#prevMonth').addEventListener('click', function () { shift(-1); });
      $('#nextMonth').addEventListener('click', function () { shift(1); });

      load();
    }

    function shift(step) {
      var month = state.calendar.month + step;
      var year = state.calendar.year;
      if (month < 1) { month = 12; year -= 1; }
      if (month > 12) { month = 1; year += 1; }
      state.calendar = { year: year, month: month };
      render();
    }

    function load() {
      api
        .query('/calendar', {
          brandId: currentBrand().id,
          year: state.calendar.year,
          month: state.calendar.month,
        })
        .then(function (data) {
          var dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
          var first = new Date(Date.UTC(data.year, data.month - 1, 1)).getUTCDay();
          var cells = dayNames
            .map(function (name) { return '<div class="day-name">' + name + '</div>'; })
            .join('');
          for (var blank = 0; blank < first; blank += 1) cells += '<div class="day blank"></div>';

          var today = new Date().toISOString().slice(0, 10);
          for (var day = 1; day <= data.plan.daysInMonth; day += 1) {
            var iso =
              data.year + '-' + String(data.month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var scheduled = data.scheduled.filter(function (item) {
              return (item.scheduledFor || '').slice(0, 10) === iso;
            });
            var suggestions = data.plan.slots.filter(function (slot) { return slot.date === iso; });

            cells +=
              '<div class="day' + (iso === today ? ' today' : '') + '"><div class="num">' + day + '</div>' +
              scheduled
                .map(function (item) {
                  var tone = item.pillar === 'trust' ? 'green' : item.pillar === 'conversion' ? 'yellow' : '';
                  return (
                    '<button class="event ' + tone + '" data-content="' + esc(item.id) + '">' +
                    esc(item.title) + '<br><small>' + esc(item.format) + ' · ' + (item.status === 'published' ? 'منشور' : 'مجدول') + '</small></button>'
                  );
                })
                .join('') +
              suggestions
                .map(function (slot) {
                  return (
                    '<button class="event ghost" data-slot=\'' + esc(JSON.stringify(slot)) + '\'>' +
                    '+ ' + esc(slot.suggestion) + '<br><small>' + esc(slot.pillarLabel + ' · ' + slot.format) + '</small></button>'
                  );
                })
                .join('') +
              '</div>';
          }

          $('#calendarPanel').innerHTML =
            '<div class="panel-head"><h3>الخطة</h3><span class="badge purple">' + esc(data.plan.rationale) + '</span></div>' +
            '<div class="calendar">' + cells + '</div>' +
            '<p class="hint" style="margin-top:12px">الخانات المتقطعة اقتراحات — اضغطها لتضيفها إلى التقويم.</p>';

          $('#applyPlan').addEventListener('click', function (event) {
            var button = event.currentTarget;
            if (!data.plan.slots.length) return toast('كل الأيام المقترحة ممتلئة بالفعل.');
            busy(button, true);
            api
              .post('/calendar/apply', { brandId: currentBrand().id, slots: data.plan.slots })
              .then(function (result) {
                busy(button, false);
                toast('أُضيف ' + result.count + ' منشورًا إلى التقويم.');
                load();
              })
              .catch(function (error) {
                busy(button, false);
                fail(error);
              });
          });

          $('#calendarPanel').addEventListener('click', function (event) {
            var slotBtn = event.target.closest('[data-slot]');
            if (slotBtn) {
              var slot = JSON.parse(slotBtn.dataset.slot);
              return api
                .post('/calendar/apply', { brandId: currentBrand().id, slots: [slot] })
                .then(function () {
                  toast('أُضيف إلى التقويم.');
                  load();
                })
                .catch(fail);
            }
            var contentBtn = event.target.closest('[data-content]');
            if (contentBtn) {
              var content = data.scheduled.filter(function (item) { return item.id === contentBtn.dataset.content; })[0];
              if (content) openContentModal(content, load);
            }
          });
        })
        .catch(fail);
    }

    render();
  };

  function openContentModal(content, onSaved) {
    openModal(
      '<h2>' + esc(content.title) + '</h2>' +
        '<p style="color:var(--text-2)">' + esc(arabicDate(content.scheduledFor, true)) + '</p>' +
        '<div class="field"><label for="cTitle">العنوان</label><input class="input" id="cTitle" value="' + esc(content.title) + '" /></div>' +
        '<div class="field"><label for="cStatus">الحالة</label><select class="input" id="cStatus">' +
        optionList(
          [
            { id: 'scheduled', label: 'مجدول' },
            { id: 'published', label: 'منشور' },
            { id: 'idea', label: 'فكرة' },
            { id: 'archived', label: 'مؤرشف' },
          ],
          content.status
        ) +
        '</select></div>' +
        '<div class="field"><label for="cDate">التاريخ</label><input class="input" id="cDate" type="date" value="' +
        esc((content.scheduledFor || '').slice(0, 10)) + '" /></div>' +
        '<div class="grid grid-3">' +
        ['views', 'saves', 'shares'].map(function (key) {
          var labels = { views: 'مشاهدات', saves: 'حفظ', shares: 'مشاركات' };
          return (
            '<div class="field"><label for="m_' + key + '">' + labels[key] + '</label>' +
            '<input class="input" id="m_' + key + '" type="number" min="0" value="' +
            esc((content.metrics && content.metrics[key]) || 0) + '" /></div>'
          );
        }).join('') +
        '</div>' +
        '<div class="modal-actions"><button class="btn btn-danger" id="cDelete">حذف</button>' +
        '<div style="display:flex;gap:8px"><button class="btn btn-quiet" id="cCancel">إلغاء</button>' +
        '<button class="btn btn-primary" id="cSave">حفظ</button></div></div>',
      function (root) {
        $('#cCancel', root).addEventListener('click', closeModal);

        $('#cSave', root).addEventListener('click', function (event) {
          var button = event.currentTarget;
          busy(button, true);
          var date = $('#cDate', root).value;
          api
            .patch('/content/' + content.id, {
              title: $('#cTitle', root).value,
              status: $('#cStatus', root).value,
              scheduledFor: date ? date + 'T09:00:00.000Z' : null,
              metrics: {
                views: Number($('#m_views', root).value) || 0,
                saves: Number($('#m_saves', root).value) || 0,
                shares: Number($('#m_shares', root).value) || 0,
              },
            })
            .then(function () {
              closeModal();
              toast('تم الحفظ.');
              if (onSaved) onSaved();
            })
            .catch(function (error) {
              busy(button, false);
              fail(error);
            });
        });

        $('#cDelete', root).addEventListener('click', function () {
          api
            .del('/content/' + content.id)
            .then(function () {
              closeModal();
              toast('تم الحذف.');
              if (onSaved) onSaved();
            })
            .catch(fail);
        });
      }
    );
  }

  pages.analytics = function () {
    pageEl.innerHTML =
      header(
        'Performance Intelligence',
        'التحليلات',
        '<select class="input" id="range" style="width:auto"><option value="30">آخر 30 يومًا</option>' +
          '<option value="7">آخر 7 أيام</option><option value="90">آخر 90 يومًا</option></select>' +
          '<button class="btn btn-primary" id="logPost">سجّل منشورًا</button>'
      ) + '<div id="analyticsBody">' + skeleton(4) + '</div>';

    $('#range').addEventListener('change', load);
    $('#logPost').addEventListener('click', openLogModal);
    load();

    function load() {
      api
        .query('/analytics/overview', { brandId: currentBrand().id, days: $('#range').value })
        .then(function (data) {
          var overview = data.overview;
          var maxViews = Math.max.apply(null, overview.series.map(function (p) { return p.views; })) || 1;
          var points = overview.series
            .map(function (point, index) {
              var x = 700 - (index / Math.max(1, overview.series.length - 1)) * 700;
              var y = 210 - (point.views / maxViews) * 180;
              return x.toFixed(0) + ',' + y.toFixed(0);
            })
            .join(' ');

          $('#analyticsBody').innerHTML =
            '<div class="grid grid-4">' +
            overview.metrics
              .map(function (metric) {
                return (
                  '<div class="metric"><div class="label">' + esc(metric.label) + '</div>' +
                  '<div class="value">' + num(metric.value) + '</div>' + deltaTag(metric.delta) + '</div>'
                );
              })
              .join('') +
            '</div>' +
            '<div class="grid grid-wide" style="margin-top:15px">' +
            '<div class="panel"><div class="panel-head"><h3>نمو المشاهدات</h3>' +
            '<span class="badge">' + esc(overview.dataBasis) + '</span></div>' +
            (overview.postsPublished
              ? '<div class="linebox"><svg viewBox="0 0 700 230" preserveAspectRatio="none">' +
                '<polyline fill="none" stroke="#a78bfa" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" points="' + points + '" />' +
                '</svg></div>'
              : '<div class="empty-state"><div class="big">📈</div><p>سجّل منشورًا واحدًا على الأقل لرسم المنحنى.</p></div>') +
            '</div>' +
            '<div class="panel"><h3>ماذا تعلّمت المنصة</h3>' +
            (data.learnings.length
              ? data.learnings
                  .map(function (item) {
                    return '<div class="insight"><b>' + esc(item.title) + '</b><span>' + esc(item.body) + '</span></div>';
                  })
                  .join('')
              : '<div class="insight"><b>عيّنة غير كافية</b><span>' + esc(data.message || '') + '</span></div>') +
            '</div></div>' +
            '<div class="panel" style="margin-top:15px"><div class="panel-head"><h3>أفضل المحتوى</h3>' +
            '<span class="badge">متوسط وقت المشاهدة ' + overview.avgWatchTime + ' ث</span></div>' +
            (data.top.length
              ? '<div class="table-wrap"><table class="table"><thead><tr><th>المحتوى</th><th>النوع</th><th>الفورمات</th>' +
                '<th>مشاهدات</th><th>حفظ</th><th>مشاركات</th></tr></thead><tbody>' +
                data.top
                  .map(function (row) {
                    return (
                      '<tr><td>' + esc(row.title) + '</td><td>' + esc(row.pillarLabel) + '</td><td>' + esc(row.format) + '</td>' +
                      '<td>' + num(row.views) + '</td><td>' + num(row.saves) + '</td><td>' + num(row.shares) + '</td></tr>'
                    );
                  })
                  .join('') +
                '</tbody></table></div>'
              : '<div class="empty-state"><div class="big">🗂️</div><p>لا يوجد محتوى منشور مسجّل بعد.</p></div>') +
            '</div>';
        })
        .catch(fail);
    }

    function openLogModal() {
      api
        .query('/content', { brandId: currentBrand().id })
        .then(function (data) {
          var candidates = data.contents.filter(function (item) { return item.status !== 'archived'; });
          openModal(
            '<h2>سجّل أداء منشور</h2>' +
              '<p style="color:var(--text-2)">اختر منشورًا موجودًا أو أنشئ سجلًا جديدًا.</p>' +
              '<div class="field"><label for="logPick">المحتوى</label><select class="input" id="logPick">' +
              '<option value="">— محتوى جديد —</option>' +
              candidates
                .map(function (item) {
                  return '<option value="' + esc(item.id) + '">' + esc(item.title) + '</option>';
                })
                .join('') +
              '</select></div>' +
              '<div class="field" id="newTitleField"><label for="logTitle">عنوان المحتوى</label>' +
              '<input class="input" id="logTitle" placeholder="عنوان المنشور" /></div>' +
              '<div class="grid grid-3">' +
              [
                { key: 'views', label: 'مشاهدات' },
                { key: 'saves', label: 'حفظ' },
                { key: 'shares', label: 'مشاركات' },
                { key: 'comments', label: 'تعليقات' },
                { key: 'leads', label: 'عملاء محتملون' },
                { key: 'watchTimeSeconds', label: 'وقت المشاهدة (ث)' },
              ]
                .map(function (metric) {
                  return (
                    '<div class="field"><label for="lg_' + metric.key + '">' + metric.label + '</label>' +
                    '<input class="input" id="lg_' + metric.key + '" type="number" min="0" value="0" /></div>'
                  );
                })
                .join('') +
              '</div>' +
              '<div class="modal-actions"><button class="btn btn-quiet" id="logCancel">إلغاء</button>' +
              '<button class="btn btn-primary" id="logSave">حفظ الأداء</button></div>',
            function (root) {
              $('#logCancel', root).addEventListener('click', closeModal);
              $('#logPick', root).addEventListener('change', function (event) {
                $('#newTitleField', root).classList.toggle('hidden', !!event.target.value);
              });

              $('#logSave', root).addEventListener('click', function (event) {
                var button = event.currentTarget;
                var metrics = {};
                ['views', 'saves', 'shares', 'comments', 'leads', 'watchTimeSeconds'].forEach(function (key) {
                  metrics[key] = Number($('#lg_' + key, root).value) || 0;
                });
                var picked = $('#logPick', root).value;
                busy(button, true);

                var request = picked
                  ? api.patch('/content/' + picked, { status: 'published', metrics: metrics })
                  : api.post('/content', {
                      brandId: currentBrand().id,
                      title: $('#logTitle', root).value.trim() || 'منشور',
                      status: 'published',
                      metrics: metrics,
                    });

                request
                  .then(function () {
                    closeModal();
                    toast('تم تسجيل الأداء.');
                    load();
                  })
                  .catch(function (error) {
                    busy(button, false);
                    fail(error);
                  });
              });
            }
          );
        })
        .catch(fail);
    }
  };

  pages.settings = function () {
    var brand = currentBrand();
    pageEl.innerHTML =
      header('الإعدادات', 'البراند والحساب والباقة') +
      '<div class="grid grid-2">' +
      '<div class="panel" id="brandPanel"></div>' +
      '<div><div class="panel" id="accountPanel" style="margin-bottom:15px"></div>' +
      '<div class="panel" id="planPanel"></div></div></div>';

    var niches = [
      { id: 'marketing', label: 'تسويق وصناعة محتوى' },
      { id: 'ecommerce', label: 'تجارة إلكترونية' },
      { id: 'realestate', label: 'عقار' },
      { id: 'beauty', label: 'تجميل وعناية' },
      { id: 'food', label: 'مطاعم وأغذية' },
      { id: 'fitness', label: 'رياضة ولياقة' },
      { id: 'education', label: 'تعليم وتدريب' },
    ];
    var goals = [
      { id: 'reach', label: 'زيادة الوصول' },
      { id: 'trust', label: 'بناء الثقة' },
      { id: 'conversion', label: 'جذب عملاء' },
      { id: 'sales', label: 'مبيعات مباشرة' },
    ];
    var tones = [
      { id: 'saudi', label: 'سعودي أبيض' },
      { id: 'msa', label: 'فصحى' },
      { id: 'casual', label: 'ودّي' },
      { id: 'professional', label: 'مهني' },
    ];

    $('#brandPanel').innerHTML =
      '<div class="panel-head"><h3>Brand Brain</h3><button class="btn btn-ghost btn-sm" id="addBrand">+ براند جديد</button></div>' +
      '<div class="field"><label for="bName">اسم البراند</label><input class="input" id="bName" value="' + esc(brand.name) + '" /></div>' +
      '<div class="field"><label for="bNiche">المجال</label><select class="input" id="bNiche">' + optionList(niches, brand.niche) + '</select></div>' +
      '<div class="field"><label for="bGoal">الهدف الأساسي</label><select class="input" id="bGoal">' + optionList(goals, brand.goal) + '</select></div>' +
      '<div class="field"><label for="bTone">النبرة</label><select class="input" id="bTone">' + optionList(tones, brand.tone) + '</select></div>' +
      '<div class="field"><label for="bAudience">الجمهور</label><input class="input" id="bAudience" value="' + esc(brand.audience || '') + '" /></div>' +
      '<div class="field"><label for="bVoice">صوت البراند</label><textarea class="input" id="bVoice">' + esc(brand.voice || '') + '</textarea></div>' +
      '<div class="field"><label for="bOffer">ما الذي تبيعه؟</label><input class="input" id="bOffer" value="' + esc(brand.offer || '') + '" /></div>' +
      '<div class="field"><label for="bCadence">منشورات أسبوعيًا</label><input class="input" id="bCadence" type="number" min="1" max="14" value="' + (brand.postsPerWeek || 3) + '" /></div>' +
      '<button class="btn btn-primary btn-block" id="saveBrand">حفظ البراند</button>';

    $('#accountPanel').innerHTML =
      '<h3>الحساب</h3>' +
      '<div class="field"><label for="uName">الاسم</label><input class="input" id="uName" value="' + esc(state.user.name) + '" /></div>' +
      '<div class="field"><label>البريد الإلكتروني</label><input class="input" value="' + esc(state.user.email) + '" disabled /></div>' +
      '<button class="btn btn-ghost btn-block" id="saveUser">حفظ</button>';

    $('#planPanel').innerHTML = '<h3>الباقة</h3><div id="planBody">' + skeleton(1) + '</div>';

    $('#addBrand').addEventListener('click', startOnboarding);

    $('#saveBrand').addEventListener('click', function (event) {
      var button = event.currentTarget;
      busy(button, true);
      api
        .put('/brands/' + brand.id, {
          name: $('#bName').value.trim(),
          niche: $('#bNiche').value,
          goal: $('#bGoal').value,
          tone: $('#bTone').value,
          audience: $('#bAudience').value.trim(),
          voice: $('#bVoice').value.trim(),
          offer: $('#bOffer').value.trim(),
          postsPerWeek: Number($('#bCadence').value) || 3,
          region: brand.region,
          platforms: brand.platforms,
        })
        .then(function () {
          busy(button, false);
          toast('تم تحديث البراند.');
          return refreshMe();
        })
        .catch(function (error) {
          busy(button, false);
          fail(error);
        });
    });

    $('#saveUser').addEventListener('click', function (event) {
      var button = event.currentTarget;
      busy(button, true);
      api
        .patch('/auth/me', { name: $('#uName').value.trim() })
        .then(function () {
          busy(button, false);
          toast('تم تحديث الحساب.');
          return refreshMe();
        })
        .catch(function (error) {
          busy(button, false);
          fail(error);
        });
    });

    api.get('/billing/subscription').then(function (data) {
      $('#planBody').innerHTML =
        '<div class="insight"><b>' + esc(data.plan.name) + ' · ' + data.plan.price + ' ' + esc(data.plan.currency) + ' شهريًا</b>' +
        '<span>' + esc(data.plan.tagline) + '</span></div>' +
        '<div class="field"><label for="planPick">تغيير الباقة</label><select class="input" id="planPick">' +
        optionList(
          state.config.plans.map(function (plan) {
            return { id: plan.id, label: plan.name + ' — ' + plan.price + ' ر.س' };
          }),
          data.plan.id
        ) +
        '</select></div>' +
        '<button class="btn btn-ghost btn-block" id="savePlan">تحديث الباقة</button>' +
        '<p class="hint">' + esc(data.note) + '</p>';

      $('#savePlan').addEventListener('click', function (event) {
        var button = event.currentTarget;
        busy(button, true);
        api
          .post('/billing/subscription', { plan: $('#planPick').value })
          .then(function () {
            busy(button, false);
            toast('تم تحديث الباقة.');
            return refreshMe();
          })
          .catch(function (error) {
            busy(button, false);
            fail(error);
          });
      });
    }).catch(fail);
  };

  /* ---------------- events ---------------- */

  $('#tabLogin').addEventListener('click', function () { switchAuthTab('login'); });
  $('#tabRegister').addEventListener('click', function () { switchAuthTab('register'); });

  $('#loginForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    busy(button, true);
    api
      .post('/auth/login', { email: $('#loginEmail').value.trim(), password: $('#loginPassword').value })
      .then(afterLogin)
      .catch(function (error) {
        busy(button, false);
        authError(error.message);
      });
  });

  $('#registerForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    busy(button, true);
    api
      .post('/auth/register', {
        name: $('#regName').value.trim(),
        email: $('#regEmail').value.trim(),
        password: $('#regPassword').value,
        plan: $('#regPlan').value,
      })
      .then(afterLogin)
      .catch(function (error) {
        busy(button, false);
        authError(error.message);
      });
  });

  $('#demoBtn').addEventListener('click', function (event) {
    var button = event.currentTarget;
    busy(button, true);
    api
      .post('/auth/login', { email: 'demo@mohtawa.app', password: 'Mohtawa2026' })
      .then(afterLogin)
      .catch(function (error) {
        busy(button, false);
        authError('الحساب التجريبي غير متاح على هذا الخادم. أنشئ حسابًا جديدًا.');
        void error;
      });
  });

  $('#menu').addEventListener('click', function (event) {
    var button = event.target.closest('button[data-page]');
    if (button) go(button.dataset.page);
  });

  $('#brandSwitch').addEventListener('change', function (event) {
    state.brandId = event.target.value;
    go(state.page);
  });

  $('#logoutBtn').addEventListener('click', logout);

  /* ---------------- boot ---------------- */

  function boot() {
    api
      .get('/config')
      .then(function (config) {
        state.config = config;
        $('#regPlan').innerHTML = config.plans
          .map(function (plan) {
            return (
              '<option value="' + esc(plan.id) + '"' + (plan.popular ? ' selected' : '') + '>' +
              esc(plan.name + ' — ' + plan.price + ' ر.س/شهر') + '</option>'
            );
          })
          .join('');
      })
      .catch(function () {
        /* Config is optional for rendering the auth screen. */
      })
      .then(function () {
        var hash = (location.hash || '').replace('#', '');
        if (!api.token) {
          showAuth(hash.indexOf('register') === 0 ? 'register' : 'login');
          if (hash === 'demo') $('#demoBtn').click();
          return;
        }
        return refreshMe()
          .then(function () {
            $('#authScreen').classList.add('hidden');
            $('#appShell').classList.remove('hidden');
            if (!state.brands.length) startOnboarding();
            else go('home');
          })
          .catch(function () {
            api.setToken(null);
            showAuth('login');
          });
      });
  }

  boot();
})();
