document.addEventListener('DOMContentLoaded', function() {

  // === FIREBASE ===
  var firebaseConfig = {
    apiKey: "AIzaSyAsGZ661cK8obTVlQvfyzKdqY9ppOC5hlE",
    authDomain: "balance-ap.firebaseapp.com",
    projectId: "balance-ap",
    storageBucket: "balance-ap.firebasestorage.app",
    messagingSenderId: "36002433553",
    appId: "1:36002433553:web:71896fe22a7a8aeaf1ffb0"
  };
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var currentUser = null;
  var pendingEmail = null;

  // === ТЕМА ===
  (function initTheme() {
    var saved = localStorage.getItem('bc_theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
  })();

  // === НАВИГАЦИЯ ===
  window.navigate = function(pageId) {
    document.querySelectorAll('.page').forEach(function(el){ el.classList.remove('active'); });
    document.querySelectorAll('.nav-menu a').forEach(function(el){ el.classList.remove('active'); });
    var page = document.getElementById(pageId);
    if (page) page.classList.add('active');
    document.querySelectorAll('.nav-menu a').forEach(function(link) {
      var oc = link.getAttribute('onclick') || '';
      if (oc.indexOf("'" + pageId + "'") !== -1) link.classList.add('active');
    });
    document.getElementById('navMenu').classList.remove('open');

    document.querySelectorAll('.bottom-nav-item').forEach(function(el){ el.classList.remove('active'); });
    document.querySelectorAll('.bottom-nav-item').forEach(function(link) {
      var oc = link.getAttribute('onclick') || '';
      if (oc.indexOf("'" + pageId + "'") !== -1) link.classList.add('active');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.toggleMobileMenu = function() { document.getElementById('navMenu').classList.toggle('open'); };

  window.filterCourses = function(cat, btn) {
    document.querySelectorAll('.courses-tab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('#coursesGrid .course-card').forEach(function(card) {
      card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
    });
  };

  window.switchMaterial = function(cat, btn) {
    document.querySelectorAll('.materials-sidebar li').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('#materialsGrid .material-card').forEach(function(card) {
      card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
    });
  };

  window.searchMaterials = function(query) {
    var q = query.toLowerCase().trim();
    document.querySelectorAll('#materialsGrid .material-card').forEach(function(card) {
      var title = (card.dataset.title || '').toLowerCase();
      card.style.display = (q === '' || title.indexOf(q) !== -1) ? '' : 'none';
    });
  };

  // === МОДАЛКА КУРСОВ ===
  var modalOverlay = document.getElementById('modalOverlay');
  var modalCurrentAction = '';
  var modalCurrentCourse = null;

  window.openModal = function(title, price, type) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalPrice').textContent = price;
    var emoji = '🎓';
    var text = 'Функционал оплаты находится в разработке. Мы сохранили ваш запрос.';
    if (price === 'Бесплатно' || price === '0 ₽') { emoji = '✅'; text = 'Регистрация на бесплатный материал.'; }
    if (price === '14 дней бесплатно') { emoji = '🎁'; text = 'Пробный период 14 дней — бесплатно. Отмена в любой момент.'; }
    document.getElementById('modalEmoji').textContent = emoji;
    document.getElementById('modalText').textContent = text;
    modalCurrentAction = title + ' — ' + price;
    modalCurrentCourse = (type === 'course') ? { title: title, price: price } : null;
    modalOverlay.classList.add('show');
  };

  window.closeModal = function() { modalOverlay.classList.remove('show'); };

  window.confirmAction = function() {
    if (modalCurrentCourse) {
      if (!currentUser) {
        alert('Чтобы записаться на курс, нужно войти в аккаунт.');
        closeModal(); openAuth(); return;
      }
      saveCourseToUser(modalCurrentCourse.title, modalCurrentCourse.price);
    }
    closeModal();
    alert('Спасибо! Запрос принят: ' + modalCurrentAction);
  };

  modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) closeModal(); });

  function saveCourseToUser(title, price) {
    if (!currentUser) return;
    var courses = currentUser.courses || [];
    var exists = courses.some(function(c) { return c.title === title; });
    if (exists) return;
    courses.push({ title: title, price: price, date: new Date().toISOString() });
    var update = { courses: courses };
    if (price !== '0 ₽' && price !== 'Бесплатно') update.subscription = 'active';
    db.collection('users').doc(currentUser.uid).update(update).catch(function(err) { console.error(err); });
  }

  // === ВОПРОСЫ ===
  var OPT4 = ["Никогда", "Иногда", "Часто", "Постоянно"];
  var OPT4R = ["Почти никогда", "Иногда", "Часто", "Очень часто"];
  var OPT_QUALITY = ["Отличное", "Хорошее", "Удовлетворительное", "Плохое"];

  var questions = [
    { scale: "EI", q: "Как часто вы чувствуете, что у вас «не хватает сил» на обычные дела?", qTeen: "Как часто у тебя не хватает сил даже на простые дела?", opts: OPT4R },
    { scale: "EI", q: "Как часто вы чувствуете себя эмоционально опустошённым?", qTeen: "Как часто ты чувствуешь себя эмоционально выжатым?", opts: OPT4 },
    { scale: "EI", q: "Просыпаетесь ли вы уже уставшим, даже после сна?", opts: OPT4R },
    { scale: "EI", q: "Как вы оцениваете качество своего сна в последнее время?", opts: OPT_QUALITY },
    { scale: "EI", q: "Как часто вы чувствуете физическую усталость без причины?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете, что работа / учёба вытягивает из вас все силы?", qTeen: "Как часто учёба забирает у тебя все силы?", qSenior: "Как часто рабочие задачи забирают у вас все силы?", opts: OPT4 },
    { scale: "EI", q: "Как часто у вас болит голова или напряжены мышцы из-за нагрузки?", opts: OPT4 },
    { scale: "EI", q: "Пропускаете ли вы приёмы пищи из-за занятости?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете себя «на пределе»?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы работаете (учитесь) без перерыва по несколько часов подряд?", qTeen: "Как часто ты сидишь за уроками без перерыва?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете сонливость в течение дня?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете, что не успеваете восстановиться за выходные?", qTeen: "Как часто ты не успеваешь отдохнуть за выходные?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете, что напряжены даже в спокойной обстановке?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете, что у вас нет времени на себя?", qTeen: "Как часто у тебя нет времени на себя?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете себя измотанным к концу дня?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы замечаете, что стали хуже переносить шум и суету?", opts: OPT4 },
    { scale: "EI", q: "Как часто вы чувствуете, что вам нужна пауза, но вы не можете её взять?", opts: OPT4 },

    { scale: "DP", q: "Как часто вы раздражаетесь по мелочам?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы чувствуете, что стали циничнее по отношению к работе?", qTeen: "Как часто ты относишься к учёбе с раздражением?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы замечаете, что стали безразличны к тому, что раньше волновало?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы срываетесь на близких или коллегах?", qTeen: "Как часто ты срываешься на близких?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы чувствуете, что окружающие вас раздражают?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы хотите остаться один, чтобы никто не трогал?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы чувствуете, что ваши усилия на работе не ценятся?", qTeen: "Как часто ты чувствуешь, что твои старания в учёбе не замечают?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы думаете о том, чтобы всё бросить?", qTeen: "Как часто ты хочешь всё бросить?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы сомневаетесь, что ваша работа (учёба) имеет смысл?", qTeen: "Как часто ты сомневаешься, что учёба имеет смысл?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы замечаете, что вам сложно сочувствовать другим?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы обсуждаете других с раздражением или пренебрежением?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы считаете, что «всё бессмысленно»?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы чувствуете, что от вас все чего-то хотят, а вы ничего не хотите?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы откладываете дела, которые раньше делали легко?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы чувствуете, что всё вокруг стало «серым»?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы замечаете, что стали безразличны к результату своей работы?", qTeen: "Как часто ты относишься к своим оценкам безразлично?", opts: OPT4 },
    { scale: "DP", q: "Как часто вы хотите, чтобы все оставили вас в покое?", opts: OPT4 },

    { scale: "RD", q: "Как часто вы чувствуете, что не справляетесь с обязанностями?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы сомневаетесь в своих профессиональных навыках?", qTeen: "Как часто ты сомневаешься в своих учебных способностях?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что работаете (учитесь) хуже, чем раньше?", qTeen: "Как часто тебе кажется, что ты стал учиться хуже?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы переживаете из-за мелких ошибок?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что не соответствуете ожиданиям других?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что теряете интерес к тому, что раньше нравилось?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы думаете, что «ничего не изменится к лучшему»?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что ваши усилия не приводят к результату?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы сравниваете себя с другими и чувствуете себя хуже?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что не контролируете свою жизнь?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что потеряли цель?", qTeen: "Как часто тебе кажется, что ты не знаешь, куда идти?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы испытываете чувство вины, когда отдыхаете?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что ваша работа (учёба) бессмысленна?", qTeen: "Как часто ты чувствуешь, что учёба — пустая трата времени?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что не реализуете себя?", opts: OPT4 },
    { scale: "RD", q: "Как часто вам сложно радоваться успехам (своим или чужим)?", opts: OPT4 },
    { scale: "RD", q: "Как часто вы чувствуете, что «застряли» на месте?", opts: OPT4 },

    /* Персонализация — определяет, какие курсы показать */
    { scale: "HOBBY", q: "Какое хобби помогло бы вам расслабиться и восстановиться?", opts: [
      "Йога / медитация",
      "Рисование / арт-терапия",
      "Вязание / бисер",
      "Спорт / танцы",
      "Психология / самопознание",
      "Другое"
    ] }
  ];

  var currentQ = 0;
  var answers = new Array(questions.length).fill(null);
  var ageGroup = null;
  var lastTestResult = null;

  var qNumEl = document.getElementById('qNum');
  var qTextEl = document.getElementById('qText');
  var qOptsEl = document.getElementById('qOptions');
  var progressEl = document.getElementById('progressFill');
  var btnPrev = document.getElementById('btnPrev');
  var btnNext = document.getElementById('btnNext');

  function getQuestionText(item) {
    var map = { teen: item.qTeen, young: item.qYoung, adult: item.qAdult, mature: item.qMature, senior: item.qSenior };
    return (ageGroup && map[ageGroup]) ? map[ageGroup] : item.q;
  }

  window.selectAge = function(age) {
    ageGroup = age;
    document.getElementById('rolePicker').style.display = 'none';
    document.getElementById('quizCard').style.display = 'block';
    currentQ = 0;
    answers = new Array(questions.length).fill(null);
    renderQ();
  };

  function renderQ() {
    var item = questions[currentQ];
    qNumEl.textContent = currentQ + 1;
    var qTotalEl = document.getElementById('qTotal');
    if (qTotalEl) qTotalEl.textContent = questions.length;
    progressEl.style.width = ((currentQ + 1) / questions.length) * 100 + '%';

    var html = '';
    for (var i = 0; i < item.opts.length; i++) {
      var cls = (answers[currentQ] === i) ? ' selected' : '';
      html += '<button class="quiz-option' + cls + '" data-idx="' + i + '">' + item.opts[i] + '</button>';
    }
    qOptsEl.innerHTML = html;
    qOptsEl.querySelectorAll('.quiz-option').forEach(function(el) {
      el.addEventListener('click', function() { selectAns(parseInt(this.getAttribute('data-idx'), 10)); });
    });

    btnPrev.disabled = false;
    btnPrev.textContent = (currentQ === 0) ? '← К выбору возраста' : '← Назад';
    btnNext.disabled = (answers[currentQ] === null);
    btnNext.textContent = (currentQ === questions.length - 1) ? 'Получить результат →' : 'Далее →';
  }

  function selectAns(idx) {
    answers[currentQ] = idx;
    qOptsEl.querySelectorAll('.quiz-option').forEach(function(el, i) { el.classList.toggle('selected', i === idx); });
    btnNext.disabled = false;
  }

  window.nextQ = function() {
    if (answers[currentQ] === null) return;
    if (currentQ < questions.length - 1) { currentQ++; renderQ(); }
    else calcResults();
  };

  window.prevQ = function() {
    if (currentQ > 0) {
      currentQ--;
      renderQ();
    } else {
      document.getElementById('quizCard').style.display = 'none';
      document.getElementById('rolePicker').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  window.restartQuiz = function() {
    currentQ = 0;
    answers = new Array(questions.length).fill(null);
    ageGroup = null;
    document.getElementById('rolePicker').style.display = 'block';
    document.getElementById('quizCard').style.display = 'none';
    navigate('quiz');
  };

  function calcResults() {
    var scaleScores = { EI: 0, DP: 0, RD: 0 };
    var scaleMaxes = { EI: 0, DP: 0, RD: 0 };

    for (var i = 0; i < questions.length; i++) {
      if (questions[i].scale === 'HOBBY') continue;
      var a = answers[i];
      if (a === null) a = 0;
      var val = questions[i].reverse ? (3 - a) : a;
      var s = questions[i].scale;
      scaleScores[s] += val;
      scaleMaxes[s] += 3;
    }

    var totalScore = scaleScores.EI + scaleScores.DP + scaleScores.RD;
    var totalMax = scaleMaxes.EI + scaleMaxes.DP + scaleMaxes.RD;
    var pct = Math.round((totalScore / totalMax) * 100);

    var pctEI = Math.round((scaleScores.EI / scaleMaxes.EI) * 100);
    var pctDP = Math.round((scaleScores.DP / scaleMaxes.DP) * 100);
    var pctRD = Math.round((scaleScores.RD / scaleMaxes.RD) * 100);

    var maxScale = Math.max(pctEI, pctDP, pctRD);
    var type = '', typeDesc = '';

    if (maxScale === pctEI && pctEI >= 40) {
      type = 'Истощение';
      typeDesc = 'Ваш тип выгорания — истощение. Вы в первую очередь физически и эмоционально вымотаны.';
    } else if (maxScale === pctDP && pctDP >= 40) {
      type = 'Цинизм';
      typeDesc = 'Ваш тип выгорания — цинизм. Вы теряете интерес и вовлечённость, стали раздражительны и отстранены.';
    } else if (maxScale === pctRD && pctRD >= 40) {
      type = 'Потеря смысла';
      typeDesc = 'Ваш тип выгорания — редукция достижений. Вам кажется, что ничего не получается и ничего не имеет смысла.';
    } else {
      type = 'Смешанный';
      typeDesc = 'У вас смешанный тип — признаки всех трёх шкал выражены примерно одинаково.';
    }

    var level, color;
    if (pct < 33) { level = 'Низкий'; color = '#7fa97c'; }
    else if (pct < 66) { level = 'Умеренный'; color = '#d4a373'; }
    else { level = 'Высокий'; color = '#c97b6a'; }

    document.getElementById('resTitle').textContent = level + ' уровень выгорания';
    document.getElementById('resDesc').textContent = typeDesc + ' Это не диагноз, а ориентир для дальнейших шагов.';
    document.getElementById('resPercent').textContent = pct + '%';

    var donut = document.getElementById('donutFill');
    var circumference = 2 * Math.PI * 75;
    donut.setAttribute('stroke-dasharray', circumference);
    donut.setAttribute('stroke', color);
    donut.style.strokeDashoffset = circumference;
    setTimeout(function() { donut.style.strokeDashoffset = circumference - (pct / 100) * circumference; }, 100);

    var causesHtml = '';
    causesHtml += '<div class="cause-item"><span class="cause-dot ' + (pctEI >= 60 ? 'danger' : (pctEI >= 33 ? 'warning' : 'success')) + '"></span><span>Эмоциональное истощение — ' + pctEI + '%</span></div>';
    causesHtml += '<div class="cause-item"><span class="cause-dot ' + (pctDP >= 60 ? 'danger' : (pctDP >= 33 ? 'warning' : 'success')) + '"></span><span>Цинизм и отстранённость — ' + pctDP + '%</span></div>';
    causesHtml += '<div class="cause-item"><span class="cause-dot ' + (pctRD >= 60 ? 'danger' : (pctRD >= 33 ? 'warning' : 'success')) + '"></span><span>Потеря смысла и достижений — ' + pctRD + '%</span></div>';
    document.getElementById('resCauses').innerHTML = causesHtml;

    var hobbyIdx = -1;
    for (var k = 0; k < questions.length; k++) {
      if (questions[k].scale === 'HOBBY') { hobbyIdx = k; break; }
    }
    var hobbyAnswer = (hobbyIdx >= 0 && answers[hobbyIdx] !== null) ? questions[hobbyIdx].opts[answers[hobbyIdx]] : null;

    lastTestResult = { percent: pct, level: level + ' уровень выгорания', type: type, ageGroup: ageGroup, scales: { EI: pctEI, DP: pctDP, RD: pctRD }, hobby: hobbyAnswer, date: new Date().toISOString() };

    if (currentUser) {
      db.collection('users').doc(currentUser.uid).update({ lastTest: lastTestResult }).catch(function(err) { console.error(err); });
    }

    showHobbyRecommendation(hobbyAnswer);
    showSaveBanner();
    navigate('results');
  }

  function showHobbyRecommendation(hobby) {
    var old = document.getElementById('hobbyBlock');
    if (old) old.remove();
    if (!hobby) return;

    var map = {
      'Йога / медитация':           { cat: 'yoga',  label: 'Йога и медитация' },
      'Рисование / арт-терапия':    { cat: 'art',   label: 'Рисование и арт-терапия' },
      'Вязание / бисер':            { cat: 'art',   label: 'Рукоделие' },
      'Спорт / танцы':              { cat: 'sport', label: 'Спорт' },
      'Психология / самопознание':  { cat: 'psych', label: 'Психология' }
    };
    var rec = map[hobby];

    var block = document.createElement('div');
    block.id = 'hobbyBlock';
    block.style.cssText = 'margin-top:1.5rem;padding:1.25rem;background:var(--primary-light);border-radius:16px;text-align:center;';
    block.innerHTML =
      '<div style="font-size:0.8rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">Ваше хобби для восстановления</div>' +
      '<div style="font-family:\'Cormorant Garamond\', serif; font-size:1.6rem; font-weight:600; color:var(--primary-dark); margin-bottom:1rem;">' + hobby + '</div>' +
      (rec ? '<button class="btn btn-primary btn-sm" onclick="goToCoursesFiltered(\'' + rec.cat + '\')">Показать курсы: ' + rec.label + ' →</button>' : '');

    var target = document.querySelector('#results .result-card');
    if (target) {
      var noteEl = target.querySelector('.result-note');
      if (noteEl) target.insertBefore(block, noteEl);
      else target.appendChild(block);
    }
  }

  window.goToCoursesFiltered = function(cat) {
    navigate('courses');
    setTimeout(function() {
      var tabs = document.querySelectorAll('.courses-tab');
      for (var i = 0; i < tabs.length; i++) {
        var oc = tabs[i].getAttribute('onclick') || '';
        if (oc.indexOf("'" + cat + "'") !== -1) {
          filterCourses(cat, tabs[i]);
          break;
        }
      }
    }, 100);
  };

  function showSaveBanner() {
    var old = document.getElementById('saveBanner');
    if (old) old.remove();
    if (currentUser) return;

    var banner = document.createElement('div');
    banner.id = 'saveBanner';
    banner.style.cssText = 'margin-top:1.5rem;padding:1.25rem;background:var(--primary-light);border-radius:16px;text-align:center;';
    banner.innerHTML =
      '<div style="font-size:0.95rem;color:var(--primary-dark);margin-bottom:0.75rem;font-weight:500;">' +
        '💾 Хотите сохранить результат и получить персональный маршрут?' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" onclick="openAuth()">Войти или зарегистрироваться</button>';

    var target = document.querySelector('#results .result-card');
    if (target) target.appendChild(banner);
  }

  // === НАСТРОЙКИ ===
  var settingsOverlay = document.getElementById('settingsOverlay');
  window.openSettings = function() { settingsOverlay.classList.add('show'); syncThemeSwitch(); syncNotifySwitch(); };
  window.closeSettings = function() { settingsOverlay.classList.remove('show'); };
  settingsOverlay.addEventListener('click', function(e) { if (e.target === settingsOverlay) closeSettings(); });

  window.toggleTheme = function() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('bc_theme', next);
    syncThemeSwitch();
  };

  function syncThemeSwitch() {
    document.getElementById('themeSwitch').classList.toggle('on', document.documentElement.getAttribute('data-theme') === 'dark');
  }

  window.toggleNotify = function() {
    var current = localStorage.getItem('bc_notify') === 'on';
    localStorage.setItem('bc_notify', current ? 'off' : 'on');
    syncNotifySwitch();
  };

  function syncNotifySwitch() {
    document.getElementById('notifySwitch').classList.toggle('on', localStorage.getItem('bc_notify') === 'on');
  }

  // === АВТОРИЗАЦИЯ ===
  var authOverlay = document.getElementById('authOverlay');
  var profileOverlay = document.getElementById('profileOverlay');

  window.openAuth = function() {
    if (currentUser) { openProfile(); return; }
    authOverlay.classList.add('show');
    setAuthMode('register');
  };

  window.closeAuth = function() {
    authOverlay.classList.remove('show');
    ['authError','authSuccess','loginError','loginSuccess','forgotError','forgotSuccess'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    ['authInfoBox','loginInfoBox'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
    document.getElementById('regLogin').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regPassword2').value = '';
    document.getElementById('loginLogin').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('forgotLogin').value = '';
    document.getElementById('forgotEmail').value = '';
    document.getElementById('pwdStrengthBox').style.display = 'none';
    document.getElementById('pwdStrengthFill').style.width = '0%';
    document.getElementById('resendBtn').style.display = 'none';
    document.getElementById('loginResendBtn').style.display = 'none';
    document.getElementById('authSubmitBtn').style.display = 'block';
  };

  authOverlay.addEventListener('click', function(e) { if (e.target === authOverlay) closeAuth(); });

  window.closeProfile = function() { profileOverlay.classList.remove('show'); };
  profileOverlay.addEventListener('click', function(e) { if (e.target === profileOverlay) closeProfile(); });

  window.openProfile = function() {
    if (!currentUser) return;
    var initial = currentUser.login ? currentUser.login.charAt(0).toUpperCase() : '?';
    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('profileName').textContent = currentUser.login;
    document.getElementById('profileLogin').textContent = currentUser.email || '';
    var subBadge = document.getElementById('profileSubBadge');
    if (currentUser.subscription === 'active') { subBadge.textContent = 'Premium активна'; subBadge.className = 'sub-status sub-active'; }
    else { subBadge.textContent = 'Подписка не активна'; subBadge.className = 'sub-status sub-inactive'; }

    var testBlock = document.getElementById('profileTestBlock');
    if (currentUser.lastTest) {
      var t = currentUser.lastTest;
      var d = new Date(t.date);
      var dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      testBlock.innerHTML = '<div class="stat-row"><div class="stat-mini"><div class="num">' + t.percent + '%</div><div class="lbl">Уровень</div></div><div class="stat-mini"><div class="num" style="font-size:1rem;">' + (t.type || '—') + '</div><div class="lbl">Тип</div></div><div class="stat-mini"><div class="num" style="font-size:1rem;">' + dateStr + '</div><div class="lbl">Дата</div></div></div>';
    } else {
      testBlock.innerHTML = '<div class="empty-state">Вы ещё не проходили тест</div>';
    }

    var coursesBlock = document.getElementById('profileCoursesBlock');
    if (currentUser.courses && currentUser.courses.length > 0) {
      var html = '';
      currentUser.courses.forEach(function(c) { html += '<div class="profile-course-row"><span class="name">' + c.title + '</span><span class="status">' + c.price + '</span></div>'; });
      coursesBlock.innerHTML = html;
    } else {
      coursesBlock.innerHTML = '<div class="empty-state">Вы ещё не записались ни на один курс</div>';
    }
    profileOverlay.classList.add('show');
  };

  window.logoutUser = function() {
    if (confirm('Выйти из аккаунта?')) auth.signOut().then(function() { closeProfile(); });
  };

  window.setAuthMode = function(mode) {
    var regForm = document.getElementById('registerForm');
    var loginForm = document.getElementById('loginForm');
    var forgotForm = document.getElementById('forgotForm');
    var tabs = document.getElementById('authTabs');
    var title = document.getElementById('authTitle');

    regForm.style.display = 'none';
    loginForm.style.display = 'none';
    forgotForm.style.display = 'none';

    if (mode === 'register') {
      regForm.style.display = 'block';
      tabs.style.display = 'flex';
      title.textContent = 'Регистрация';
      document.getElementById('tabRegister').classList.add('active');
      document.getElementById('tabLogin').classList.remove('active');
    } else if (mode === 'login') {
      loginForm.style.display = 'block';
      tabs.style.display = 'flex';
      title.textContent = 'Вход';
      document.getElementById('tabRegister').classList.remove('active');
      document.getElementById('tabLogin').classList.add('active');
    } else if (mode === 'forgot') {
      forgotForm.style.display = 'block';
      tabs.style.display = 'none';
      title.textContent = 'Восстановление пароля';
    }
  };

  window.togglePassword = function(inputId, btn) {
    var input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; btn.classList.add('visible'); }
    else { input.type = 'password'; btn.classList.remove('visible'); }
  };

  function checkPasswordRules(pwd) {
    return { length: pwd.length >= 8, upper: /[A-ZА-Я]/.test(pwd), lower: /[a-zа-я]/.test(pwd), digit: /\d/.test(pwd), special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd) };
  }

  window.updatePwdStrength = function() {
    var box = document.getElementById('pwdStrengthBox');
    var fill = document.getElementById('pwdStrengthFill');
    var text = document.getElementById('pwdStrengthText');
    var rulesEl = document.getElementById('pwdRules');
    var pwd = document.getElementById('regPassword').value;
    if (pwd.length === 0) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    var rules = checkPasswordRules(pwd);
    var passed = 0;
    Object.keys(rules).forEach(function(key) {
      var li = rulesEl.querySelector('[data-rule="' + key + '"]');
      if (li) li.classList.toggle('ok', rules[key]);
      if (rules[key]) passed++;
    });
    fill.style.width = (passed / 5) * 100 + '%';
    text.classList.remove('weak', 'medium', 'strong');
    if (passed <= 2) { fill.style.background = 'var(--danger)'; text.classList.add('weak'); text.textContent = 'Слабый пароль'; }
    else if (passed <= 4) { fill.style.background = 'var(--warning)'; text.classList.add('medium'); text.textContent = 'Средний пароль'; }
    else { fill.style.background = 'var(--success)'; text.classList.add('strong'); text.textContent = 'Надёжный пароль'; }
  };

  function updateProfileIcon() {
    document.getElementById('profileBtn').classList.toggle('logged-in', !!currentUser);
  }

  function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  function translateAuthError(code) {
    var map = {
      'auth/email-already-in-use': 'Эта почта уже зарегистрирована.',
      'auth/invalid-email': 'Неверный формат почты.',
      'auth/weak-password': 'Слишком слабый пароль.',
      'auth/user-not-found': 'Пользователь не найден.',
      'auth/wrong-password': 'Неверный пароль.',
      'auth/invalid-credential': 'Неверный логин или пароль.',
      'auth/too-many-requests': 'Слишком много попыток. Подождите немного.',
      'auth/network-request-failed': 'Проблема с интернетом.',
      'auth/email-not-verified': 'Почта не подтверждена. Проверьте письмо.',
      'custom/login-taken': 'Этот логин уже занят. Придумайте другой.',
      'custom/user-not-found': 'Логин не найден. Проверьте написание.',
      'custom/email-mismatch': 'Указанная почта не совпадает с почтой аккаунта.'
    };
    return map[code] || 'Ошибка: ' + code;
  }

  window.submitRegister = function() {
    var errEl = document.getElementById('authError');
    var okEl = document.getElementById('authSuccess');
    var infoEl = document.getElementById('authInfoBox');
    errEl.textContent = ''; okEl.textContent = ''; infoEl.classList.remove('show');

    var login = document.getElementById('regLogin').value.trim();
    var email = document.getElementById('regEmail').value.trim().toLowerCase();
    var password = document.getElementById('regPassword').value;
    var password2 = document.getElementById('regPassword2').value;
    var btn = document.getElementById('authSubmitBtn');

    if (login.length < 2) { errEl.textContent = 'Логин не короче 2 символов.'; return; }
    if (!/^[a-zA-Z0-9._-]+$/.test(login)) { errEl.textContent = 'Логин: только английские буквы, цифры, точка, дефис, подчёркивание.'; return; }
    if (!isValidEmail(email)) { errEl.textContent = 'Введите корректную почту.'; return; }
    if (password.length < 8) { errEl.textContent = 'Пароль не короче 8 символов.'; return; }
    var pwdRules = checkPasswordRules(password);
    var passed = 0;
    Object.keys(pwdRules).forEach(function(k) { if (pwdRules[k]) passed++; });
    if (passed < 3) { errEl.textContent = 'Пароль слишком слабый. Нужно минимум 3 условия из 5.'; return; }
    if (password !== password2) { errEl.textContent = 'Пароли не совпадают.'; return; }

    pendingEmail = email;
    btn.disabled = true;
    btn.textContent = 'Подождите...';

    db.collection('users').where('login', '==', login.toLowerCase()).limit(1).get()
      .then(function(snapshot) {
        if (!snapshot.empty) throw { code: 'custom/login-taken' };
        return auth.createUserWithEmailAndPassword(email, password);
      })
      .then(function(cred) {
        return cred.user.sendEmailVerification({ url: window.location.origin + window.location.pathname }).then(function() { return cred.user; });
      })
      .then(function(user) {
        return db.collection('users').doc(user.uid).set({
          login: login, email: email, courses: [], subscription: 'inactive', emailVerified: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      })
      .then(function() { return auth.signOut(); })
      .then(function() {
        btn.disabled = false;
        btn.style.display = 'none';
        document.getElementById('resendBtn').style.display = 'block';
        infoEl.innerHTML = '<strong>📧 Письмо отправлено!</strong><br>Мы отправили ссылку для подтверждения на <b>' + email + '</b>. Перейдите по ссылке в письме. Проверьте папку «Спам».';
        infoEl.classList.add('show');
      })
      .catch(function(err) {
        console.error(err);
        errEl.textContent = translateAuthError(err.code);
        btn.disabled = false;
        btn.textContent = 'Создать аккаунт';
      });
  };

  window.submitLogin = function() {
    var errEl = document.getElementById('loginError');
    var okEl = document.getElementById('loginSuccess');
    var infoEl = document.getElementById('loginInfoBox');
    errEl.textContent = ''; okEl.textContent = ''; infoEl.classList.remove('show');

    var login = document.getElementById('loginLogin').value.trim();
    var password = document.getElementById('loginPassword').value;
    var btn = document.getElementById('loginSubmitBtn');

    if (!login) { errEl.textContent = 'Введите логин.'; return; }
    if (!password) { errEl.textContent = 'Введите пароль.'; return; }

    btn.disabled = true;
    btn.textContent = 'Подождите...';

    db.collection('users').where('login', '==', login.toLowerCase()).limit(1).get()
      .then(function(snapshot) {
        if (snapshot.empty) throw { code: 'custom/user-not-found' };
        var userData = snapshot.docs[0].data();
        return auth.signInWithEmailAndPassword(userData.email, password);
      })
      .then(function(cred) {
        if (!cred.user.emailVerified) {
          pendingEmail = cred.user.email;
          return auth.signOut().then(function() { throw { code: 'auth/email-not-verified' }; });
        }
        okEl.textContent = 'С возвращением!';
        btn.disabled = false;
        btn.textContent = 'Войти';
        setTimeout(closeAuth, 1000);
      })
      .catch(function(err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = 'Войти';
        if (err.code === 'auth/email-not-verified') {
          errEl.textContent = 'Почта не подтверждена. Проверьте письмо.';
          infoEl.innerHTML = '📧 Письмо было отправлено на <b>' + (pendingEmail || '') + '</b>. Не получили? Нажмите кнопку ниже.';
          infoEl.classList.add('show');
          document.getElementById('loginResendBtn').style.display = 'block';
        } else {
          errEl.textContent = translateAuthError(err.code);
        }
      });
  };

  window.resendVerification = function() {
    if (!pendingEmail) { alert('Сначала введите email и пароль.'); return; }
    var password = document.getElementById('regPassword').value;
    var errEl = document.getElementById('authError');
    var infoEl = document.getElementById('authInfoBox');
    if (!password) { errEl.textContent = 'Введите пароль ещё раз.'; return; }

    auth.signInWithEmailAndPassword(pendingEmail, password)
      .then(function(cred) {
        return cred.user.sendEmailVerification({ url: window.location.origin + window.location.pathname }).then(function() { return auth.signOut(); });
      })
      .then(function() {
        infoEl.innerHTML = '📧 Письмо отправлено повторно на <b>' + pendingEmail + '</b>. Проверьте «Спам».';
        infoEl.classList.add('show');
      })
      .catch(function(err) { errEl.textContent = translateAuthError(err.code); });
  };

  window.resendFromLogin = function() {
    if (!pendingEmail) { alert('Сначала введите логин и пароль.'); return; }
    var password = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginError');
    var infoEl = document.getElementById('loginInfoBox');
    if (!password) { errEl.textContent = 'Введите пароль.'; return; }

    auth.signInWithEmailAndPassword(pendingEmail, password)
      .then(function(cred) {
        return cred.user.sendEmailVerification({ url: window.location.origin + window.location.pathname }).then(function() { return auth.signOut(); });
      })
      .then(function() {
        infoEl.innerHTML = '📧 Письмо отправлено повторно на <b>' + pendingEmail + '</b>. Проверьте «Спам».';
        infoEl.classList.add('show');
      })
      .catch(function(err) { errEl.textContent = translateAuthError(err.code); });
  };

  window.submitForgot = function() {
    var errEl = document.getElementById('forgotError');
    var okEl = document.getElementById('forgotSuccess');
    errEl.textContent = ''; okEl.textContent = '';

    var login = document.getElementById('forgotLogin').value.trim();
    var email = document.getElementById('forgotEmail').value.trim().toLowerCase();
    var btn = document.getElementById('forgotSubmitBtn');

    if (!login) { errEl.textContent = 'Введите логин.'; return; }
    if (!isValidEmail(email)) { errEl.textContent = 'Введите корректную почту.'; return; }

    btn.disabled = true;
    btn.textContent = 'Отправляем...';

    db.collection('users').where('login', '==', login.toLowerCase()).limit(1).get()
      .then(function(snapshot) {
        if (snapshot.empty) throw { code: 'custom/user-not-found' };
        var userData = snapshot.docs[0].data();
        if (userData.email !== email) throw { code: 'custom/email-mismatch' };
        return auth.sendPasswordResetEmail(email);
      })
      .then(function() {
        okEl.textContent = 'Письмо для сброса пароля отправлено на ' + email + '. Проверьте «Спам».';
        btn.disabled = false;
        btn.textContent = 'Отправить письмо';
        setTimeout(function() { setAuthMode('login'); }, 3000);
      })
      .catch(function(err) {
        console.error(err);
        errEl.textContent = translateAuthError(err.code);
        btn.disabled = false;
        btn.textContent = 'Отправить письмо';
      });
  };

  auth.onAuthStateChanged(function(user) {
    if (user && user.emailVerified) {
      db.collection('users').doc(user.uid).onSnapshot(function(doc) {
        if (doc.exists) {
          currentUser = doc.data();
          currentUser.uid = user.uid;
          updateProfileIcon();
          if (profileOverlay.classList.contains('show')) openProfile();
          if (lastTestResult) {
            db.collection('users').doc(user.uid).update({ lastTest: lastTestResult }).catch(function(err) { console.error(err); });
            var banner = document.getElementById('saveBanner');
            if (banner) banner.remove();
          }
        }
      }, function(err) { console.error(err); });
    } else {
      currentUser = null;
      updateProfileIcon();
    }
  });

  updateProfileIcon();
  syncThemeSwitch();
  syncNotifySwitch();
});
