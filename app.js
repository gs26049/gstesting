(function () {
  "use strict";

  // ---------- State ----------
  let allQuestions = [];   // raw questions from JSON
  let queue = [];          // current round's question objects (shuffled, with shuffled options)
  let currentIndex = 0;
  let currentSelection = null;
  let answered = false;
  let isReviewRound = false;
  let wrongThisRound = [];
  let totalAnsweredFirstPass = 0;
  let correctFirstPass = 0;
  let roundNumber = 1;

  // ---------- DOM ----------
  const titleEl = document.getElementById("quiz-title");
  const quizArea = document.getElementById("quiz-area");
  const progressFill = document.getElementById("progress-fill");
  const progressText = document.getElementById("progress-text");
  const btnHint = document.getElementById("btn-hint");
  const btnSubmit = document.getElementById("btn-submit");
  const btnNext = document.getElementById("btn-next");

  // ---------- Utils ----------
  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildShuffledQuestion(q) {
    const shuffledOptions = shuffle(q.options).map((opt) => ({
      text: opt.text,
      isCorrect: opt.isCorrect,
      rationale: opt.rationale
    }));
    return {
      number: q.number,
      question: q.question,
      hint: q.hint,
      options: shuffledOptions
    };
  }

  function renderMath(container) {
    if (window.renderMathInElement) {
      window.renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false
      });
    }
  }

  function updateProgress() {
    const total = queue.length;
    const done = currentIndex;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    progressFill.style.width = pct + "%";
    const roundLabel = isReviewRound ? `재도전 ${roundNumber - 1}회차` : "본 풀이";
    progressText.textContent = `${roundLabel} · ${Math.min(done + 1, total)} / ${total}`;
  }

  // ---------- Rendering ----------
  function renderQuestion() {
    answered = false;
    currentSelection = null;
    btnNext.classList.add("hidden");
    btnSubmit.classList.remove("hidden");
    btnSubmit.disabled = true;
    btnHint.classList.remove("hidden");

    const q = queue[currentIndex];
    updateProgress();

    const optionsHtml = q.options
      .map(
        (opt, idx) => `
        <div class="option" data-idx="${idx}" role="button" tabindex="0">
          <span class="label">${String.fromCharCode(65 + idx)}</span>
          <span class="text">${opt.text}</span>
        </div>`
      )
      .join("");

    quizArea.innerHTML = `
      <div class="card">
        <div class="q-meta">
          <span>문제 ${q.number}</span>
          <span>${isReviewRound ? "오답 재도전" : "원본 퀴즈"}</span>
        </div>
        <p class="q-text">${q.question}</p>
        <div class="options">${optionsHtml}</div>
        <div id="hint-slot"></div>
        <div id="rationale-slot"></div>
      </div>
    `;

    quizArea.querySelectorAll(".option").forEach((el) => {
      el.addEventListener("click", () => selectOption(el));
    });

    renderMath(quizArea);
  }

  function selectOption(el) {
    if (answered) return;
    quizArea.querySelectorAll(".option").forEach((o) => o.classList.remove("selected"));
    el.classList.add("selected");
    currentSelection = Number(el.dataset.idx);
    btnSubmit.disabled = false;
  }

  function showHint() {
    const q = queue[currentIndex];
    const slot = document.getElementById("hint-slot");
    if (slot.querySelector(".hint-box")) return;
    slot.innerHTML = `<div class="hint-box">💡 힌트: ${q.hint}</div>`;
    renderMath(slot);
  }

  function submitAnswer() {
    if (currentSelection === null || answered) return;
    answered = true;
    btnSubmit.classList.add("hidden");
    btnHint.classList.add("hidden");
    btnNext.classList.remove("hidden");

    const q = queue[currentIndex];
    const selectedOpt = q.options[currentSelection];
    const wasCorrect = !!selectedOpt.isCorrect;

    quizArea.querySelectorAll(".option").forEach((el) => {
      el.classList.add("locked");
      const idx = Number(el.dataset.idx);
      const opt = q.options[idx];
      if (opt.isCorrect) {
        el.classList.add("correct-answer");
      } else if (idx === currentSelection) {
        el.classList.add("wrong-answer");
      }
      el.replaceWith(el.cloneNode(true)); // strip click listeners
    });

    const rationaleHtml = q.options
      .map((opt, idx) => {
        const tag = opt.isCorrect ? "correct" : idx === currentSelection ? "wrong" : "";
        if (!tag) return "";
        const label = opt.isCorrect ? "정답" : "선택한 답";
        return `<div class="rationale-item ${tag}">
          <span class="r-label">${label} (${String.fromCharCode(65 + idx)})</span>${opt.rationale}
        </div>`;
      })
      .join("");

    const banner = wasCorrect
      ? `<div class="result-banner correct">✅ 정답입니다!</div>`
      : `<div class="result-banner wrong">❌ 오답입니다.</div>`;

    document.getElementById("rationale-slot").innerHTML = `
      <div class="rationale-box">
        ${banner}
        ${rationaleHtml}
      </div>
    `;
    renderMath(document.getElementById("rationale-slot"));

    if (!isReviewRound) {
      totalAnsweredFirstPass++;
      if (wasCorrect) {
        correctFirstPass++;
      } else {
        wrongThisRound.push(q.number);
      }
    } else if (!wasCorrect) {
      wrongThisRound.push(q.number);
    }
  }

  function nextQuestion() {
    if (currentIndex < queue.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      finishRound();
    }
  }

  function finishRound() {
    if (wrongThisRound.length > 0) {
      showRoundSummary();
    } else {
      showFinalSummary();
    }
  }

  function showRoundSummary() {
    const missed = wrongThisRound.slice();
    quizArea.innerHTML = `
      <div class="card summary-card">
        <h2>${isReviewRound ? "재도전 결과" : "1차 풀이 완료"}</h2>
        <div class="score">${queue.length - missed.length} / ${queue.length}</div>
        <p>틀린 문제가 ${missed.length}개 있습니다. 틀린 문제만 다시 풀어볼까요?</p>
        <div class="summary-actions">
          <button id="btn-retry-wrong" class="btn btn-primary" type="button">틀린 문제 다시 풀기</button>
        </div>
        <div class="review-list">
          ${missed.map((n) => `<div class="review-item">문제 ${n}번을 다시 확인해보세요.</div>`).join("")}
        </div>
      </div>
    `;
    btnHint.classList.add("hidden");
    btnSubmit.classList.add("hidden");
    btnNext.classList.add("hidden");

    document.getElementById("btn-retry-wrong").addEventListener("click", () => {
      startReviewRound(missed);
    });
  }

  function startReviewRound(missedNumbers) {
    isReviewRound = true;
    roundNumber++;
    const missedQuestions = allQuestions.filter((q) => missedNumbers.includes(q.number));
    queue = shuffle(missedQuestions).map(buildShuffledQuestion);
    currentIndex = 0;
    wrongThisRound = [];
    renderQuestion();
  }

  function showFinalSummary() {
    quizArea.innerHTML = `
      <div class="card summary-card">
        <h2>🎉 모든 문제를 맞혔습니다!</h2>
        <div class="score">${correctFirstPass} / ${totalAnsweredFirstPass}</div>
        <p>최초 풀이 정답률입니다. 틀린 문제까지 모두 다시 맞히셨네요.</p>
        <div class="summary-actions">
          <button id="btn-restart" class="btn btn-primary" type="button">처음부터 다시 풀기</button>
        </div>
      </div>
    `;
    btnHint.classList.add("hidden");
    btnSubmit.classList.add("hidden");
    btnNext.classList.add("hidden");

    document.getElementById("btn-restart").addEventListener("click", startQuiz);
  }

  function startQuiz() {
    isReviewRound = false;
    roundNumber = 1;
    totalAnsweredFirstPass = 0;
    correctFirstPass = 0;
    wrongThisRound = [];
    currentIndex = 0;
    queue = shuffle(allQuestions).map(buildShuffledQuestion);
    btnHint.classList.remove("hidden");
    btnSubmit.classList.remove("hidden");
    btnNext.classList.add("hidden");
    renderQuestion();
  }

  // ---------- Init ----------
  function init() {
    btnHint.addEventListener("click", showHint);
    btnSubmit.addEventListener("click", submitAnswer);
    btnNext.addEventListener("click", nextQuestion);

    fetch("quiz-data.json")
      .then((res) => {
        if (!res.ok) throw new Error("퀴즈 데이터를 불러오지 못했습니다.");
        return res.json();
      })
      .then((data) => {
        allQuestions = data.questions;
        titleEl.textContent = data.title || "퀴즈";
        startQuiz();
      })
      .catch((err) => {
        quizArea.innerHTML = `<div class="card"><p>⚠️ ${err.message}</p><p>이 페이지를 로컬 서버(예: <code>python -m http.server</code>)로 열어야 quiz-data.json을 불러올 수 있습니다. 파일을 더블클릭해서 직접 열면 브라우저 보안 정책상 fetch가 차단됩니다.</p></div>`;
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
