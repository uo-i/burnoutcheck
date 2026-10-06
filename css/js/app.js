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
        alert('Сначала войдите в аккаунт, чтобы сохранить курс в профиле.');
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
  var questions = [
    { q: "Как часто вы чувствуете, что у вас «не хватает сил» на обычные дела?", opts: ["Почти никогда","Иногда","Часто","Очень часто"] },
    { q: "Бывает ли, что вы раздражаетесь по мелочам?", opts: ["Редко","Периодически","Часто","Постоянно"] },
    { qWorker: "Насколько сложно вам отключиться от рабочих мыслей вечером?", qStudent: "Насколько сложно вам отключиться от учебных мыслей вечером?", opts: ["Легко","Иногда сложно","Часто сложно","Почти невозможно"] },
    { q: "Как вы оцениваете качество своего сна в последнее время?", opts: ["Отличное","Хорошее","Удовлетворительное","Плохое"] },
    { qWorker: "Чувствуете ли вы, что ваши усилия на работе не ценятся?", qStudent: "Чувствуете ли вы, что ваши усилия в учёбе не ценятся?", opts: ["Никогда","Редко","Часто","Всегда"] },
    { q: "Как часто вы пропускаете приёмы пищи из-за занятости?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { q: "Испытываете ли вы чувство вины, когда отдыхаете?", opts: ["Нет","Иногда","Часто","Постоянно"] },
    { qWorker: "Насколько вы удовлетворены своей работой сейчас?", qStudent: "Насколько вы удовлетворены своей учёбой сейчас?", opts: ["Полностью","В основном","Частично","Совсем не удовлетворён"] },
    { qWorker: "Как часто вы думаете о том, чтобы сменить работу?", qStudent: "Как часто вы думаете о том, чтобы бросить учёбу?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { qWorker: "Чувствуете ли вы, что стали более циничными по отношению к работе?", qStudent: "Чувствуете ли вы, что стали более циничными по отношению к учёбе?", opts: ["Нет","Немного","Значительно","Очень сильно"] },
    { q: "Как часто вы чувствуете себя эмоционально опустошённым?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { q: "Удаётся ли вам находить радость в вещах, которые раньше нравились?", opts: ["Да, всегда","Чаще да","Реже","Почти никогда"], reverse: true },
    { q: "Как часто вы чувствуете, что не справляетесь с обязанностями?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { q: "Насколько сильно вы переживаете из-за ошибок?", opts: ["Не переживаю","Немного","Сильно","Очень сильно"] },
    { qWorker: "Как часто вы чувствуете, что вас перегружают задачи на работе?", qStudent: "Как часто вы чувствуете, что вас перегружают заданиями в учёбе?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { q: "Считаете ли вы, что у вас нет времени на себя?", opts: ["Нет, время есть","Иногда не хватает","Часто не хватает","Никогда не хватает"] },
    { q: "Как часто вы чувствуете, что вам нужна поддержка?", opts: ["Никогда","Иногда","Часто","Постоянно"] },
    { qWorker: "Насколько вы уверены в своих профессиональных навыках?", qStudent: "Насколько вы уверены в своих учебных навыках?", opts: ["Полностью уверен","В основном уверен","Сомневаюсь","Совсем не уверен"], reverse: true },
    { qWorker: "Как часто вы чувствуете, что работа забирает все ваши ресурсы?", qStudent: "Как часто вы чувствуете, что учёба забирает все ваши ресурсы?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { q: "Испытываете ли вы физические симптомы стресса?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { q: "Как часто вы чувствуете, что не можете сказать «нет» новым задачам?", opts: ["Всегда могу отказать","Чаще могу","Чаще не могу","Никогда не могу"] },
    { qWorker: "Насколько вы чувствуете себя вовлечённым в работу?", qStudent: "Насколько вы чувствуете себя вовлечённым в учёбу?", opts: ["Полностью вовлечён","В основном вовлечён","Частично вовлечён","Совсем не вовлечён"], reverse: true },
    { q: "Как часто вы чувствуете, что ваши границы нарушаются?", opts: ["Никогда","Редко","Часто","Постоянно"] },
    { qWorker: "Считаете ли вы, что ваша работа имеет смысл?", qStudent: "Считаете ли вы, что ваша учёба имеет смысл?", opts: ["Полностью согласен","Скорее согласен","Скорее не согласен","Совсем не согласен"], reverse: true },
    { q: "Как вы оцениваете свой общий уровень стресса за последний месяц?", opts: ["Низкий","Умеренный","Высокий","Очень высокий"] }
  ];

  var currentQ = 0;
  var answers = new Array(questions.length).fill(null);
  var userRole = null;

  var qNumEl = document.getElementById('qNum');
  var qTextEl = document.getElementById('qText');
  var qOptsEl = document.getElementById('qOptions');
  var progressEl = document.getElementById('progressFill');
  var btnPrev = document.getElementById('btnPrev');
  var btnNext = document.getElementById('btnNext');

  function getQuestionText(item) {
    if (userRole === 'student' && item.qStudent) return item.qStudent;
    if (userRole === 'worker' && item.qWorker) return item.qWorker;
    return item.q;
  }

  window.selectRole = function(role) {
    userRole = role;
    document.getElementById('rolePicker').style.display = 'none';
    document.getElementById('quizCard').style.display = 'block';
    currentQ = 0;
    answers = new Array(questions.length).fill(null);
    renderQ();
  };

  function renderQ() {
    var item = questions[currentQ];
    qNumEl.textContent = currentQ + 1;
    qTextEl.textContent = getQuestionText(item);
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
    btnPrev.disabled = (currentQ === 0);
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

  window.prevQ = function() { if (currentQ > 0) { currentQ--; renderQ(); } };

  window.restartQuiz = function() {
    currentQ = 0;
    answers = new Array(questions.length).fill(null);
    userRole = null;
    document.getElementById('rolePicker').style.display = 'block';
    document.getElementById('quizCard').style.display = 'none';
    navigate('quiz');
  };

  function calcResults() {
    var score = 0;
    var maxScore = questions.length * 3;
    for (var i = 0; i < questions.length; i++) {
      var a = answers[i];
      if (a === null) a = 0;
      score += questions[i].reverse ? (3 - a) : a;
    }
    var pct = Math.round((score / maxScore) * 100);
    var isWorker = (userRole === 'worker');
    var title, desc, causes, color;

    if (pct < 33) {
      title = 'Низкий уровень выгорания';
      desc = isWorker ? 'Вы хорошо справляетесь с рабочей нагрузкой.' : 'Вы хорошо справляетесь с учёбой.';
      causes = [{text:'Стабильное состояние',type:'success'},{text:'Баланс работы и отдыха',type:'success'},{text:'Развитая саморегуляция',type:'success'}];
      color = '#7fa97c';
    } else if (pct < 66) {
      title = 'Умеренный уровень выгорания';
      desc = isWorker ? 'Вы периодически испытываете напряжение из-за работы.' : 'Вы периодически испытываете напряжение из-за учёбы.';
      causes = [{text:'Высокая нагрузка',type:'warning'},{text:'Недостаток отдыха',type:'warning'},{text:'Эмоциональное напряжение',type:'warning'}];
      color = '#d4a373';
    } else {
      title = 'Высокий уровень выгорания';
      desc = isWorker ? 'Вы в зоне сильного стресса, связанного с работой.' : 'Вы в зоне сильного стресса, связанного с учёбой.';
      causes = [{text:'Высокая нагрузка',type:'danger'},{text:'Недостаток отдыха',type:'danger'},{text:'Сложности с границами',type:'danger'},{text:'Тревожность',type:'danger'}];
      color = '#c97b6a';
    }

    document.getElementById('resTitle').textContent = title;
    document.getElementById('resDesc').textContent = desc;
    document.getElementById('resPercent').textContent = pct + '%';
    var donut = document.getElementById('donutFill');
    var circumference = 2 * Math.PI * 75;
    donut.setAttribute('stroke-dasharray', circumference);
    donut.setAttribute('stroke', color);
    donut.style.strokeDashoffset = circumference;
    setTimeout(function() { donut.style.strokeDashoffset = circumference - (pct / 100) * circumference; }, 100);

    var causesHtml = '';
    causes.forEach(function(c) { causesHtml += '<div class="cause-item"><span class="cause-dot ' + c.type + '"></span><span>' + c.text + '</span></div>'; });
    document.getElementById('resCauses').innerHTML = causesHtml;

    if (currentUser) {
      db.collection('users').doc(currentUser.uid).update({
        lastTest: { percent: pct, level: title, role: userRole, date: new Date().toISOString() }
      }).catch(function(err) { console.error(err); });
    }
    navigate('results');
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
      testBlock.innerHTML = '<div class="stat-row"><div class="stat-mini"><div class="num">' + t.percent + '%</div><div class="lbl">Уровень стресса</div></div><div class="stat-mini"><div class="num" style="font-size:1.1rem;">' + t.level.replace(' уровень выгорания','') + '</div><div class="lbl">Профиль</div></div><div class="stat-mini"><div class="num" style="font-size:1rem;">' + dateStr + '</div><div class="lbl">Дата теста</div></div></div>';
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
      'auth/missing-email': 'Введите почту.',
      'custom/login-taken': 'Этот логин уже занят. Придумайте другой.',
      'custom/user-not-found': 'Логин не найден. Проверьте написание.',
      'custom/email-mismatch': 'Указанная почта не совпадает с почтой аккаунта.'
    };
    return map[code] || 'Ошибка: ' + code;
  }

  // === РЕГИСТРАЦИЯ ===
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
        return cred.user.sendEmailVerification({
          url: window.location.origin + window.location.pathname
        }).then(function() { return cred.user; });
      })
      .then(function(user) {
        return db.collection('users').doc(user.uid).set({
          login: login,
          email: email,
          courses: [],
          subscription: 'inactive',
          emailVerified: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      })
      .then(function() { return auth.signOut(); })
      .then(function() {
        btn.disabled = false;
        btn.style.display = 'none';
        document.getElementById('resendBtn').style.display = 'block';
        infoEl.innerHTML = '<strong>📧 Письмо отправлено!</strong><br>Мы отправили ссылку для подтверждения на <b>' + email + '</b>. Перейдите по ссылке в письме — и сможете войти. Проверьте папку «Спам».';
        infoEl.classList.add('show');
      })
      .catch(function(err) {
        console.error(err);
        errEl.textContent = translateAuthError(err.code);
        btn.disabled = false;
        btn.textContent = 'Создать аккаунт';
      });
  };

  // === ВХОД ===
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
          errEl.textContent = 'Почта не подтверждена. Проверьте письмо — ссылка была отправлена при регистрации.';
          infoEl.innerHTML = '📧 Письмо было отправлено на <b>' + (pendingEmail || '') + '</b>. Не получили? Нажмите кнопку ниже.';
          infoEl.classList.add('show');
          document.getElementById('loginResendBtn').style.display = 'block';
        } else {
          errEl.textContent = translateAuthError(err.code);
        }
      });
  };

  // Повторная отправка письма (после регистрации)
  window.resendVerification = function() {
    if (!pendingEmail) { alert('Сначала введите email и пароль.'); return; }
    var password = document.getElementById('regPassword').value;
    var errEl = document.getElementById('authError');
    var infoEl = document.getElementById('authInfoBox');

    if (!password) {
      errEl.textContent = 'Введите пароль ещё раз, чтобы отправить письмо повторно.';
      return;
    }

    auth.signInWithEmailAndPassword(pendingEmail, password)
      .then(function(cred) {
        return cred.user.sendEmailVerification({
          url: window.location.origin + window.location.pathname
        }).then(function() { return auth.signOut(); });
      })
      .then(function() {
        infoEl.innerHTML = '📧 Письмо отправлено повторно на <b>' + pendingEmail + '</b>. Проверьте «Спам».';
        infoEl.classList.add('show');
      })
      .catch(function(err) {
        errEl.textContent = translateAuthError(err.code);
      });
  };

  // Повторная отправка письма (со вкладки «Вход»)
  window.resendFromLogin = function() {
    if (!pendingEmail) { alert('Сначала введите логин и пароль.'); return; }
    var password = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginError');
    var infoEl = document.getElementById('loginInfoBox');

    if (!password) { errEl.textContent = 'Введите пароль.'; return; }

    auth.signInWithEmailAndPassword(pendingEmail, password)
      .then(function(cred) {
        return cred.user.sendEmailVerification({
          url: window.location.origin + window.location.pathname
        }).then(function() { return auth.signOut(); });
      })
      .then(function() {
        infoEl.innerHTML = '📧 Письмо отправлено повторно на <b>' + pendingEmail + '</b>. Проверьте «Спам».';
        infoEl.classList.add('show');
      })
      .catch(function(err) {
        errEl.textContent = translateAuthError(err.code);
      });
  };

  // === ЗАБЫЛИ ПАРОЛЬ ===
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

  // === СЛЕЖЕНИЕ ЗА СОСТОЯНИЕМ ===
  auth.onAuthStateChanged(function(user) {
    if (user && user.emailVerified) {
      db.collection('users').doc(user.uid).onSnapshot(function(doc) {
        if (doc.exists) {
          currentUser = doc.data();
          currentUser.uid = user.uid;
          updateProfileIcon();
          if (profileOverlay.classList.contains('show')) openProfile();
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
