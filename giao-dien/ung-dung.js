(function () {
  'use strict';
  const outline = window.tutuBookOutline || {};
  const lessonPages = window.tutuLessonPages || {};
  const zip = window.tutuZipContent || {lessons: {}, grammar: {}, vocab: {}};
  const vocab = Object.assign({}, window.tutuVocab40 || {}, zip.vocab, {hsk1: window.tutuHsk1VocabAll || []});
  const extras = window.tutuCurriculumExtras || {};
  const levels = ['hsk1', 'hsk2', 'hsk3'];
  const labels = {hsk1: 'HSK 1', hsk2: 'HSK 2', hsk3: 'HSK 3'};
  const modes = {flashcards: 'Lật thẻ', quiz: 'Trắc nghiệm', typing: 'Gõ chữ', strokes: 'Nét vẽ'};
  const state = {index: 0, flipped: false, answered: false, quizOrder: null, quizPhase: 'meaning'};
  let previousRoute = currentRoute();
  let modeScroll = null;
  let memoryMarks = [];
  let strokeWriters = [];
  let strokeSelected = 0;
  let strokeRun = 0;

  function readMarks() {
    try {
      const saved = JSON.parse(window.localStorage.getItem('tutu-marked-words-v1') || '[]');
      return Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : [];
    } catch (_) { return memoryMarks; }
  }
  function writeMarks(marks) {
    memoryMarks = marks;
    try { window.localStorage.setItem('tutu-marked-words-v1', JSON.stringify(marks)); } catch (_) {}
  }
  function markId(level, word) { return level + '|' + word.chinese + '|' + word.pinyin; }
  function toggleMark(id) {
    const marks = readMarks();
    writeMarks(marks.includes(id) ? marks.filter(x => x !== id) : [id, ...marks]);
  }
  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function clozeExample(word) {
    if (!word.example || !word.chinese) return '';
    const sentence = word.example.replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1');
    return sentence.includes(word.chinese) ? sentence.replace(word.chinese, '____') : '';
  }
  function markedShortcut() {
    return '<button class="saved-link" data-route="vocab/saved">★ Từ đã đánh dấu <span>' + readMarks().length + '</span></button>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  }
  function routeButton(route, title, subtitle, index) {
    return '<button class="hierarchy-card" data-route="' + esc(route) + '"><span class="hierarchy-index">' + esc(index) + '</span><span class="hierarchy-copy"><strong>' + esc(title) + '</strong><small>' + esc(subtitle) + '</small></span><span class="hierarchy-arrow" aria-hidden="true">›</span></button>';
  }
  function crumb(parts) {
    return '<nav class="crumbs" aria-label="Đường dẫn">' + parts.map((p, i) => (p.route ? '<button data-route="' + esc(p.route) + '">' + esc(p.text) + '</button>' : '<span>' + esc(p.text) + '</span>') + (i < parts.length - 1 ? '<span aria-hidden="true">/</span>' : '')).join('') + '</nav>';
  }
  function heading(title, subtitle, count) {
    return '<div class="outline-heading"><div><h1>' + esc(title) + '</h1><p>' + esc(subtitle) + '</p></div>' + (count ? '<span class="count-badge">' + esc(count) + '</span>' : '') + '</div>';
  }
  function levelPage(level) {
    const lessons = outline[level] || [];
    return crumb([{text: 'Trang chủ', route: 'home'}, {text: labels[level]}]) + heading(labels[level], 'Chọn bài học để mở Bài giảng, Ngữ pháp và Luyện tập.', lessons.length + ' bài') + '<div class="hierarchy-list">' + lessons.map((l) => routeButton(level + '/lesson/' + l.number + '/lecture', l.chinese, l.vietnamese, 'Bài ' + l.number)).join('') + '</div>';
  }
  function lessonHead(level, lesson) {
    return crumb([{text: 'Trang chủ', route: 'home'}, {text: labels[level], route: level}, {text: 'Bài ' + lesson.number}]) + '<div class="detail-head"><span class="lesson-label">' + labels[level] + ' · BÀI ' + lesson.number + '</span><h1 lang="zh-CN">' + esc(lesson.chinese) + '</h1><p>' + esc(lesson.vietnamese) + '</p></div>';
  }
  function lessonTabs(level, n, tab) {
    const base = level + '/lesson/' + n + '/';
    return '<nav class="detail-tabs" aria-label="Nội dung bài học">' + [['lecture', 'Bài giảng'], ['grammar', 'Ngữ pháp'], ['practice/flashcards', 'Luyện tập']].map(([key, label]) => '<button data-route="' + base + key + '"' + (tab === key.split('/')[0] ? ' aria-current="page"' : '') + '>' + label + '</button>').join('') + '</nav>';
  }
  function lessonWords(level, lesson) {
    return ((zip.lessons[level] || [])[lesson.number - 1] || {}).words || [];
  }
  function lecture(level, lesson) {
    const words = lessonWords(level, lesson);
    const page = (lessonPages[level] || {})[lesson.number];
    if (page) return '<section class="lecture-viewer" aria-label="Bài giảng tương tác"><div class="lecture-toolbar"><h2>Bài giảng · Bài ' + lesson.number + '</h2><a href="' + esc(page.src) + '" target="_blank" rel="noopener">Mở bài giảng trong tab riêng ↗</a></div><iframe data-lecture-frame class="lecture-frame" src="' + esc(page.src) + '" title="' + esc(page.title) + '" sandbox="allow-scripts" allow="autoplay; fullscreen" allowfullscreen></iframe></section>';
    return '<div class="study-panel"><h2>Bài giảng · Bài ' + lesson.number + '</h2><div class="study-chinese" lang="zh-CN">' + esc(lesson.chinese) + '</div><p class="study-translation">' + esc(lesson.vietnamese) + '</p><div class="study-tools"><button data-speak="' + esc(lesson.chinese) + '">▶ Nghe tên bài</button></div></div><h2 class="section-head">Từ mới trong bài · ' + words.length + ' từ</h2><div class="word-grid">' + words.map((word, i) => '<div class="word-row"><div class="word-core"><span class="number">' + (i + 1) + '</span><span class="han" lang="zh-CN">' + esc(word.chinese) + '</span><span class="word-meta"><b>' + esc(word.pinyin) + '</b><small>' + esc(word.vietnamese) + (word.partOfSpeech ? ' · ' + esc(word.partOfSpeech) : '') + '</small></span><button class="round-btn" data-speak="' + esc(word.chinese) + '" aria-label="Nghe từ ' + esc(word.chinese) + '">▶</button></div>' + (word.example ? '<div class="word-example"><span lang="zh-CN">' + esc(word.example) + '</span><button data-speak="' + esc(word.example) + '" aria-label="Nghe ví dụ">▶</button>' + (word.exampleVi ? '<small>' + esc(word.exampleVi) + '</small>' : '') + '</div>' : '') + '</div>').join('') + '</div>';
  }
  function grammar(level, lesson) {
    const points = (zip.grammar[level] || {})[lesson.number] || [];
    return '<h2 class="section-head">Ngữ pháp · Bài ' + lesson.number + '</h2>' + (points.length ? '<div class="grammar-points">' + points.map((point, i) => '<div class="study-panel grammar-point"><span class="lesson-label">ĐIỂM ' + (i + 1) + '</span><h3>' + esc(point.cn) + '</h3><p>' + esc(point.vi || '') + '</p>' + (point.ex ? '<p class="grammar-explain">' + esc(point.ex) + '</p>' : '') + (point.eg ? '<div class="grammar-examples">' + (Array.isArray(point.eg) ? point.eg : [point.eg]).map(example => '<div class="example" lang="zh-CN">' + esc(example) + '</div>').join('') + '</div>' : '') + '</div>').join('') + '</div>' : '<div class="study-panel"><p>Tài liệu nguồn chưa có điểm ngữ pháp riêng cho bài này.</p></div>');
  }
  function modeTabs(base, active) {
    return '<nav class="practice-modes" aria-label="Hình thức luyện tập">' + Object.entries(modes).map(([key, label]) => '<button data-route="' + esc(base + key) + '" aria-pressed="' + (active === key) + '">' + label + '</button>').join('') + '</nav>';
  }
  function lessonPage(level, n, tab, mode) {
    const lesson = (outline[level] || [])[n - 1];
    if (!lesson) return levelPage(level);
    const base = level + '/lesson/' + n + '/practice/';
    const body = tab === 'grammar' ? grammar(level, lesson) : tab === 'practice' ? '<h2 class="section-head">Luyện tập · ' + lessonWords(level, lesson).length + ' từ</h2>' + modeTabs(base, mode) + practice('lesson', lessonWords(level, lesson), level, mode) : lecture(level, lesson);
    return lessonHead(level, lesson) + lessonTabs(level, n, tab) + body;
  }
  function vocabHome() {
    return crumb([{text: 'Trang chủ', route: 'home'}, {text: 'Từ vựng tiêu chuẩn'}]) + heading('Từ vựng tiêu chuẩn', 'Chọn cấp độ và nhóm từ để học theo từng bước.', 'HSK 3.0') + markedShortcut() + '<div class="vocab-levels">' + levels.map(level => routeButton('vocab/' + level, labels[level], vocab[level].length + ' từ · ' + Math.ceil(vocab[level].length / 20) + ' mục', '词')).join('') + '</div>';
  }
  function vocabLevel(level) {
    const total = vocab[level].length;
    return crumb([{text: 'Từ vựng tiêu chuẩn', route: 'vocab'}, {text: labels[level]}]) + heading('Từ vựng ' + labels[level], 'Mỗi mục có tối đa 20 từ và phần luyện tập riêng.', total + ' từ') + markedShortcut() + '<div class="hierarchy-list">' + Array.from({length: Math.ceil(total / 20)}, (_, i) => routeButton('vocab/' + level + '/' + (i + 1) + '/flashcards', 'Mục ' + (i + 1) + ': Từ ' + (i * 20 + 1) + '–' + Math.min((i + 1) * 20, total), Math.min(20, total - i * 20) + ' từ · lật thẻ, trắc nghiệm, gõ chữ, nét vẽ', String(i + 1).padStart(2, '0'))).join('') + '</div>';
  }
  function savedPage() {
    const saved = readMarks();
    const found = [];
    for (const id of saved) {
      for (const level of levels) {
        const index = vocab[level].findIndex(w => markId(level, {chinese: w[0], pinyin: w[1]}) === id);
        if (index >= 0) { found.push({id, level, index, word: vocab[level][index]}); break; }
      }
    }
    return crumb([{text: 'Từ vựng tiêu chuẩn', route: 'vocab'}, {text: 'Từ đã đánh dấu'}]) + heading('Từ đã đánh dấu', 'Xem lại các từ bạn đã lưu khi lật thẻ.', found.length + ' từ') + (found.length ? '<div class="word-grid">' + found.map(item => '<div class="word-row"><div class="word-core"><span class="han" lang="zh-CN">' + esc(item.word[0]) + '</span><span class="word-meta"><b>' + esc(item.word[1]) + '</b><small>' + esc(item.word[2]) + ' · ' + labels[item.level] + '</small></span><button class="round-btn" data-speak="' + esc(item.word[0]) + '" aria-label="Nghe từ ' + esc(item.word[0]) + '">▶</button></div><div class="saved-actions"><button data-route="vocab/' + item.level + '/' + (Math.floor(item.index / 20) + 1) + '/flashcards">Xem mục gốc</button><button data-unmark="' + esc(item.id) + '">Bỏ đánh dấu</button></div></div>').join('') + '</div>' : '<div class="study-panel"><p>Chưa có từ nào được đánh dấu. Mở một mục từ vựng và chọn “Đánh dấu” khi lật thẻ.</p></div>');
  }
  function vocabChunk(level, chunk, mode) {
    const all = vocab[level] || [];
    const start = (chunk - 1) * 20;
    const words = all.slice(start, start + 20);
    const title = 'Mục ' + chunk + ': Từ ' + (start + 1) + '–' + (start + words.length);
    const entries = words.map((w, i) => ({chinese: w[0], pinyin: w[1], vietnamese: w[2], example: w[3] || '', exampleVi: w[4] || '', examplePinyin: w[5] || '', number: start + i + 1}));
    return crumb([{text: 'Từ vựng tiêu chuẩn', route: 'vocab'}, {text: labels[level], route: 'vocab/' + level}, {text: title}]) + heading(title, labels[level] + ' · Từ vựng tiêu chuẩn', words.length + ' từ') + markedShortcut() + '<div class="word-grid">' + entries.map(w => '<div class="word-row"><div class="word-core"><span class="number">' + w.number + '</span><span class="han" lang="zh-CN">' + esc(w.chinese) + '</span><span class="word-meta"><b>' + esc(w.pinyin) + '</b><small>' + esc(w.vietnamese) + '</small></span><button class="round-btn" data-speak="' + esc(w.chinese) + '" aria-label="Nghe từ ' + esc(w.chinese) + '">▶</button></div>' + (w.example ? '<div class="word-example"><span lang="zh-CN">' + esc(w.example) + '</span><button data-speak="' + esc(w.example) + '" aria-label="Nghe ví dụ">▶</button>' + (w.examplePinyin ? '<small>' + esc(w.examplePinyin) + '</small>' : '') + '<small>' + esc(w.exampleVi) + '</small></div>' : '') + '</div>').join('') + '</div><h2>Luyện tập</h2>' + modeTabs('vocab/' + level + '/' + chunk + '/', mode) + practice('vocab', entries, level, mode);
  }
  function practice(kind, entries, level, mode) {
    if (!entries.length) return '<p>Chưa có dữ liệu luyện tập.</p>';
    state.index = Math.min(state.index, entries.length - 1);
    if (mode === 'quiz' && (!state.quizOrder || state.quizOrder.length !== entries.length)) state.quizOrder = shuffle(entries.map((_, i) => i));
    const current = entries[mode === 'quiz' ? state.quizOrder[state.index] : state.index];
    const progress = '<p class="practice-caption">Từ ' + (state.index + 1) + '/' + entries.length + '</p>';
    if (mode === 'quiz') {
      const cloze = clozeExample(current);
      if (state.quizPhase === 'fill' && cloze) {
        return '<div class="quiz-card"><span class="quiz-step">ĐIỀN TỪ VÀO VÍ DỤ · BƯỚC 2/2</span>' + progress + '<h3 lang="zh-CN">' + esc(cloze) + '</h3><p class="practice-caption">' + esc(current.exampleVi) + '</p><form class="typing-form quiz-fill-form"><input name="answer" autocomplete="off" aria-label="Điền từ Hán vào chỗ trống" required><button type="submit">Kiểm tra</button></form><p class="quiz-feedback" aria-live="polite"></p><button class="quiz-next" data-next disabled>Câu tiếp theo</button></div>';
      }
      const pool = entries.map(w => w.vietnamese);
      const distractors = shuffle([...new Set(pool.filter(x => x !== current.vietnamese))]).slice(0, 2);
      const choices = shuffle([current.vietnamese, ...distractors]);
      return '<div class="quiz-card"><span class="quiz-step">TRẮC NGHIỆM NGHĨA' + (cloze ? ' · BƯỚC 1/2' : '') + '</span>' + progress + '<h3>“<span lang="zh-CN">' + esc(current.chinese) + '</span>” nghĩa là gì?</h3><div class="study-tools"><button data-speak="' + esc(current.chinese) + '">▶ Nghe từ</button></div><div class="quiz-options">' + choices.map(choice => '<button class="quiz-option" data-answer="' + esc(choice) + '" data-correct="' + esc(current.vietnamese) + '">' + esc(choice) + '</button>').join('') + '</div><p class="quiz-feedback" aria-live="polite"></p><button class="quiz-next" ' + (cloze ? 'data-quiz-fill' : 'data-next') + ' disabled>' + (cloze ? 'Điền từ trong ví dụ' : 'Câu tiếp theo') + '</button></div>';
    }
    if (mode === 'typing') return '<div class="study-panel"><h2>Gõ chữ Hán</h2>' + progress + '<p>Gõ chữ Hán phù hợp với nghĩa tiếng Việt.</p><p class="study-chinese">' + esc(current.vietnamese) + '</p>' + (current.pinyin ? '<details class="typing-hint"><summary>Xem gợi ý pinyin</summary><b>' + esc(current.pinyin) + '</b></details>' : '') + '<form class="typing-form"><input name="answer" autocomplete="off" aria-label="Nhập chữ Hán" required><button type="submit">Kiểm tra</button></form><p class="quiz-feedback" aria-live="polite"></p><div class="practice-actions"><button data-next>Tiếp theo</button><button data-speak="' + esc(current.chinese) + '">▶ Nghe đáp án</button></div></div>';
    if (mode === 'strokes') {
      const chars = [...current.chinese].filter(c => /\p{Script=Han}/u.test(c));
      return '<div class="stroke-workshop" data-stroke-board><h2>Hướng dẫn viết nét chữ Hán</h2>' + progress + '<div class="stroke-intro"><strong lang="zh-CN">' + esc(current.chinese) + '</strong><span>Xem và luyện viết chữ từng nét một</span><button data-speak="' + esc(current.chinese) + '" aria-label="Nghe từ">♫</button></div><div class="stroke-tiles">' + chars.map((char, i) => '<div class="stroke-tile' + (i === 0 ? ' active' : '') + '" data-char="' + esc(char) + '" data-select-char="' + i + '" tabindex="0" role="button" aria-label="Chọn chữ ' + esc(char) + '"><div class="stroke-glyph" id="stroke-char-' + i + '"></div></div>').join('') + '</div><div class="stroke-actions"><button data-stroke-action="single">▷ Vẽ nét</button><button data-stroke-action="all">↺ Tuần tự</button><button data-stroke-action="quiz">✎ Tự viết thử</button></div><p class="stroke-status" aria-live="polite">Chọn một chữ rồi bấm “Vẽ nét”, hoặc xem cả từ theo thứ tự.</p><p class="stroke-note">Ở chế độ tự viết, dùng chuột hoặc ngón tay vẽ từng nét trên chữ đang được chọn.</p><div class="practice-actions"><button data-next>Từ tiếp theo</button></div><p class="stroke-credit">Nét viết: <a href="https://hanziwriter.org/" target="_blank" rel="noopener">Hanzi Writer</a> · <a href="data/giay-phep/stroke-data-ARPHICPL.txt" target="_blank" rel="noopener">Giấy phép dữ liệu</a></p></div>';
    }
    if (mode === 'strokes') return '<div class="study-panel"><h2>Nét vẽ</h2>' + progress + '<p>Tập viết tự do theo chữ gợi ý. Bảng viết chưa chấm thứ tự nét.</p><div class="study-chinese" lang="zh-CN">' + esc(current.chinese) + '</div><canvas class="writing-board" width="600" height="400" aria-label="Bảng tập viết chữ Hán"></canvas><div class="practice-actions"><button data-clear>Bỏ nét đã viết</button><button data-next>Chữ tiếp theo</button><button data-speak="' + esc(current.chinese) + '">▶ Nghe từ</button></div></div>';
    const id = markId(level, current);
    const marked = readMarks().includes(id);
    return '<div class="study-panel"><h2>Lật thẻ</h2>' + progress + '<button class="flashcard" data-flip aria-label="Lật thẻ"><span class="flash-main" lang="zh-CN">' + esc(state.flipped ? current.vietnamese : current.chinese) + '</span><span class="flash-sub">' + esc(state.flipped ? (current.pinyin || 'Chạm để xem lại tiếng Trung') : 'Chạm để xem nghĩa') + '</span></button><div class="practice-actions"><button data-next>Thẻ tiếp theo</button><button data-speak="' + esc(current.chinese) + '">▶ Nghe từ</button>' + (kind === 'vocab' ? '<button data-mark="' + esc(id) + '" aria-pressed="' + marked + '">' + (marked ? '★ Đã đánh dấu' : '☆ Đánh dấu') + '</button>' : '') + '</div></div>';
  }
  function drawBoard() {
    const canvas = document.querySelector('.writing-board');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const redraw = () => {
      ctx.clearRect(0, 0, 600, 400);
      ctx.strokeStyle = '#e7edf7'; ctx.lineWidth = 1; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(300, 400); ctx.moveTo(0, 200); ctx.lineTo(600, 200); ctx.stroke(); ctx.setLineDash([]);
    };
    redraw();
    canvas._clear = redraw;
    let drawing = false;
    const point = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * 600 / r.width, (e.clientY - r.top) * 400 / r.height]; };
    canvas.addEventListener('pointerdown', e => { drawing = true; canvas.setPointerCapture(e.pointerId); const p = point(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); });
    canvas.addEventListener('pointermove', e => { if (!drawing) return; const p = point(e); ctx.strokeStyle = '#173f83'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineTo(p[0], p[1]); ctx.stroke(); });
    canvas.addEventListener('pointerup', () => { drawing = false; });
    canvas.addEventListener('pointercancel', () => { drawing = false; });
  }
  function initStrokeBoard() {
    strokeRun++;
    for (const writer of strokeWriters) writer.cancelQuiz();
    strokeWriters = [];
    strokeSelected = 0;
    const board = document.querySelector('[data-stroke-board]');
    if (!board) return;
    const status = board.querySelector('.stroke-status');
    const tiles = [...board.querySelectorAll('[data-char]')];
    if (!window.HanziWriter) {
      for (const tile of tiles) tile.querySelector('.stroke-glyph').innerHTML = '<span class="stroke-fallback">' + esc(tile.dataset.char) + '</span>';
      status.textContent = 'Không tải được hướng dẫn nét. Bạn vẫn có thể xem chữ và nghe phát âm.';
      return;
    }
    const size = window.matchMedia('(max-width:700px)').matches ? 119 : 150;
    strokeWriters = tiles.map((tile) => window.HanziWriter.create(tile.querySelector('.stroke-glyph'), tile.dataset.char, {
      width: size, height: size, padding: 8, showCharacter: true, showOutline: false,
      strokeColor: '#2e7a75', radicalColor: '#d79649', outlineColor: '#c5d5cd', drawingColor: '#c87744',
      strokeAnimationSpeed: 1.7, delayBetweenStrokes: 100,
      charDataLoader(char, onComplete, onError) {
        const data = (window.tutuStrokeData || {})[char];
        if (data) onComplete(data);
        else onError(new Error('Không có dữ liệu nét cho ' + char));
      }
    }));
  }
  function selectStroke(index) {
    const board = document.querySelector('[data-stroke-board]');
    if (!board || index < 0 || index >= strokeWriters.length) return;
    strokeSelected = index;
    board.querySelectorAll('[data-select-char]').forEach((tile, i) => tile.classList.toggle('active', i === index));
    board.querySelector('.stroke-status').textContent = 'Đã chọn ký tự ' + (index + 1) + '. Bấm “Vẽ nét” hoặc “Tự viết thử”.';
  }
  async function runStrokeAction(action) {
    const board = document.querySelector('[data-stroke-board]');
    if (!board || !strokeWriters.length) return;
    const status = board.querySelector('.stroke-status');
    const session = ++strokeRun;
    for (const writer of strokeWriters) writer.cancelQuiz();
    if (action === 'quiz') {
      const startQuiz = async (index) => {
        if (session !== strokeRun || !board.isConnected) return;
        if (index >= strokeWriters.length) { status.textContent = 'Bạn đã viết xong toàn bộ từ!'; return; }
        selectStroke(index);
        status.textContent = 'Tự viết ký tự ' + (index + 1) + '/' + strokeWriters.length + ' bằng chuột hoặc ngón tay.';
        const writer = strokeWriters[index];
        await writer.hideCharacter({duration: 0});
        await writer.showOutline({duration: 0});
        if (session !== strokeRun || !board.isConnected) return;
        writer.quiz({onComplete: () => startQuiz(index + 1)});
      };
      startQuiz(0);
      return;
    }
    if (action === 'single') {
      status.textContent = 'Đang vẽ nét ký tự ' + (strokeSelected + 1) + '...';
      await strokeWriters[strokeSelected].animateCharacter();
      if (session === strokeRun && board.isConnected) status.textContent = 'Đã vẽ xong ký tự ' + (strokeSelected + 1) + '.';
      return;
    }
    if (action === 'all') {
      for (let i = 0; i < strokeWriters.length; i++) {
        if (session !== strokeRun || !board.isConnected) return;
        selectStroke(i);
        status.textContent = 'Đang vẽ ký tự ' + (i + 1) + '/' + strokeWriters.length + '...';
        await strokeWriters[i].animateCharacter();
      }
      if (session === strokeRun && board.isConnected) status.textContent = 'Đã vẽ xong toàn bộ từ.';
    }
  }
  function currentRoute() { return decodeURIComponent(location.hash.slice(1)).replace(/^\/+|\/+$/g, '') || 'home'; }
  function isPracticeModeChange(from, to) {
    const oldParts = from.split('/');
    const newParts = to.split('/');
    if (oldParts.length !== newParts.length || !modes[oldParts[oldParts.length - 1]] || !modes[newParts[newParts.length - 1]]) return false;
    const sameExercise = oldParts.slice(0, -1).join('/') === newParts.slice(0, -1).join('/');
    return sameExercise && ((oldParts[0] === 'vocab' && oldParts.length === 4) || (levels.includes(oldParts[0]) && oldParts[1] === 'lesson' && oldParts[3] === 'practice' && oldParts.length === 5));
  }
  function navigate(route) {
    if (currentRoute() === route) { render(); return; }
    modeScroll = isPracticeModeChange(currentRoute(), route) ? {route, y: window.scrollY} : null;
    location.hash = route;
  }
  function render() {
    // Unload the previous lesson so its audio stops when navigating away.
    document.querySelectorAll('[data-lecture-frame]').forEach(frame => frame.remove());
    const parts = currentRoute().split('/');
    let root = parts[0];
    if (!['home', 'explore', 'vocab', ...levels].includes(root)) root = 'home';
    document.querySelectorAll('[data-view]').forEach(el => { el.hidden = el.id !== root; });
    document.querySelectorAll('[data-page]').forEach(el => { const active = el.dataset.page === root; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    if (levels.includes(root)) {
      const n = Number(parts[2]);
      const tab = ['lecture', 'grammar', 'practice'].includes(parts[3]) ? parts[3] : 'lecture';
      const mode = modes[parts[4]] ? parts[4] : 'flashcards';
      document.getElementById(root).innerHTML = parts[1] === 'lesson' && n >= 1 ? lessonPage(root, n, tab, mode) : levelPage(root);
    } else if (root === 'vocab') {
      const level = levels.includes(parts[1]) ? parts[1] : null;
      const chunk = Number(parts[2]);
      const mode = modes[parts[3]] ? parts[3] : 'flashcards';
      document.getElementById('vocab').innerHTML = parts[1] === 'saved' ? savedPage() : level ? (chunk >= 1 && chunk <= Math.ceil(vocab[level].length / 20) ? vocabChunk(level, chunk, mode) : vocabLevel(level)) : vocabHome();
    }
    document.title = (root === 'home' ? 'Trang chủ' : root === 'explore' ? 'Khám phá' : root === 'vocab' ? (parts[1] === 'saved' ? 'Từ đã đánh dấu' : 'Từ vựng tiêu chuẩn') : labels[root]) + ' — TUTU Chinese';
    drawBoard();
    initStrokeBoard();
  }
  document.addEventListener('click', e => {
    const route = e.target.closest('[data-route], [data-open], [data-page]');
    if (route) { navigate(route.dataset.route || route.dataset.open || route.dataset.page); return; }
    const speak = e.target.closest('[data-speak]');
    if (speak) { if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(speak.dataset.speak); u.lang = 'zh-CN'; u.rate = 0.85; speechSynthesis.speak(u); } return; }
    const mark = e.target.closest('[data-mark], [data-unmark]');
    if (mark) { toggleMark(mark.dataset.mark || mark.dataset.unmark); render(); return; }
    const selectedChar = e.target.closest('[data-select-char]');
    if (selectedChar) { selectStroke(Number(selectedChar.dataset.selectChar)); return; }
    const strokeAction = e.target.closest('[data-stroke-action]');
    if (strokeAction) { runStrokeAction(strokeAction.dataset.strokeAction).catch(() => { const status = document.querySelector('.stroke-status'); if (status) status.textContent = 'Không thể tải nét viết lúc này. Vui lòng thử lại.'; }); return; }
    if (e.target.closest('[data-flip]')) { state.flipped = !state.flipped; render(); return; }
    if (e.target.closest('[data-clear]')) { const canvas = document.querySelector('.writing-board'); if (canvas && canvas._clear) canvas._clear(); return; }
    if (e.target.closest('[data-quiz-fill]')) { state.quizPhase = 'fill'; state.answered = false; render(); return; }
    if (e.target.closest('[data-next]')) { state.index++; state.flipped = false; state.answered = false; state.quizPhase = 'meaning'; const route = currentRoute(); const pieces = route.split('/'); const total = pieces[0] === 'vocab' ? vocab[pieces[1]].slice((Number(pieces[2]) - 1) * 20, Number(pieces[2]) * 20).length : lessonWords(pieces[0], {number: Number(pieces[2])}).length; if (state.index >= total) { state.index = 0; if (route.endsWith('/quiz')) state.quizOrder = null; } render(); return; }
    const answer = e.target.closest('[data-answer]');
    if (answer && !state.answered) {
      state.answered = true;
      document.querySelectorAll('[data-answer]').forEach(button => { button.disabled = true; if (button.dataset.answer === button.dataset.correct) button.classList.add('correct'); });
      if (answer.dataset.answer !== answer.dataset.correct) answer.classList.add('incorrect');
      const feedback = document.querySelector('.quiz-feedback');
      feedback.textContent = answer.dataset.answer === answer.dataset.correct ? 'Chính xác!' : 'Đáp án: ' + answer.dataset.correct;
      document.querySelector('.quiz-next').disabled = false;
    }
  });
  document.addEventListener('keydown', e => {
    const tile = e.target.closest('[data-select-char]');
    if (tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectStroke(Number(tile.dataset.selectChar)); }
  });
  document.addEventListener('submit', e => {
    if (!e.target.matches('.typing-form')) return;
    e.preventDefault();
    const parts = currentRoute().split('/');
    const entries = parts[0] === 'vocab' ? (vocab[parts[1]] || []).slice((Number(parts[2]) - 1) * 20, Number(parts[2]) * 20).map(w => w[0]) : lessonWords(parts[0], {number: Number(parts[2])}).map(w => w.chinese);
    const expected = entries[e.target.matches('.quiz-fill-form') ? state.quizOrder[state.index] : state.index] || '';
    const clean = s => String(s).replace(/[\s，。！？、,.!?]/g, '');
    const feedback = document.querySelector('.quiz-feedback');
    feedback.textContent = clean(e.target.elements.answer.value) === clean(expected) ? 'Chính xác!' : 'Đáp án: ' + expected;
    if (e.target.matches('.quiz-fill-form')) document.querySelector('.quiz-next').disabled = false;
  });
  window.addEventListener('hashchange', () => {
    const route = currentRoute();
    const switchingMode = isPracticeModeChange(previousRoute, route);
    const scrollY = modeScroll && modeScroll.route === route ? modeScroll.y : window.scrollY;
    previousRoute = route;
    modeScroll = null;
    if (!switchingMode) state.index = 0;
    state.flipped = false;
    state.answered = false;
    state.quizOrder = null;
    state.quizPhase = 'meaning';
    render();
    window.scrollTo(0, switchingMode ? scrollY : 0);
  });
  render();
})();
