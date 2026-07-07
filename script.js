"use strict";

/* ====================================================================
   CONFIG
   Tweak these to change fret counts, scoring, and quiz timing without
   touching the logic below.
   ==================================================================== */
const CONFIG = {
  defaultFrets: 12,          // starting number of frets shown
  extendedFrets: 24,         // frets shown when "0-24" toggle is on
  markerFrets: [3, 5, 7, 9, 12, 15, 17, 19, 21, 24], // single-dot fret markers
  doubleMarkerFrets: [12, 24],                       // double-dot fret markers
  pointsPerNamedCorrect: 10, // "Name the Note" mode: points for a correct guess
  pointsPerFindCorrect: 5,   // "Find the Note" mode: points per correct instance found
  nextQuestionDelayMs: 900,  // pause after an answer before the next question
};

/* Note names, indexed by pitch class 0-11 (C=0 ... B=11). Every note in
   the app is identified internally by this pitch-class number; the
   sharp/flat toggle only changes which of these arrays is used for display. */
const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/* Standard tuning, listed top-to-bottom the way a tab/fretboard chart is
   usually drawn: high e string on top, low E string on bottom.
   `pc` = open-string pitch class. Edit this array to support alternate
   tunings later. */
const STRINGS = [
  { label: "e", longLabel: "High E (1st)", pc: 4 },
  { label: "B", longLabel: "B (2nd)", pc: 11 },
  { label: "G", longLabel: "G (3rd)", pc: 7 },
  { label: "D", longLabel: "D (4th)", pc: 2 },
  { label: "A", longLabel: "A (5th)", pc: 9 },
  { label: "E", longLabel: "Low E (6th)", pc: 4 },
];

/* ====================================================================
   APP STATE
   ==================================================================== */
const state = {
  frets: CONFIG.defaultFrets,
  accidental: "sharp",   // "sharp" | "flat"
  showNames: true,
  highlightPc: null,     // pitch class highlighted for study (or null)

  quiz: {
    active: false,
    mode: null,          // "find" | "name"
    scope: "all",        // "all" or a string index (0-5)
    score: 0,
    streak: 0,
    target: null,        // "name" mode: { stringIndex, fret, pc }
    findPc: null,        // "find" mode: pitch class being searched for
    findPositions: null, // "find" mode: Set of "stringIndex-fret" keys still to find
    findTotal: 0,
    findFound: 0,
    locked: false,       // true briefly after an answer, while feedback shows
  },
};

/* ====================================================================
   DOM REFERENCES
   ==================================================================== */
const fretboardEl = document.getElementById("fretboard");
const toggleShowNamesEl = document.getElementById("toggleShowNames");
const toggleFlatsEl = document.getElementById("toggleFlats");
const toggleFrets24El = document.getElementById("toggleFrets24");
const highlightNoteSelectEl = document.getElementById("highlightNoteSelect");

const modeButtonsEl = document.getElementById("modeButtons");
const scopeSelectEl = document.getElementById("scopeSelect");
const startQuizBtnEl = document.getElementById("startQuizBtn");
const stopQuizBtnEl = document.getElementById("stopQuizBtn");
const quizPromptEl = document.getElementById("quizPrompt");
const notePickerEl = document.getElementById("notePicker");
const scoreValEl = document.getElementById("scoreVal");
const streakValEl = document.getElementById("streakVal");
const feedbackMsgEl = document.getElementById("feedbackMsg");

/* ====================================================================
   NOTE HELPERS
   ==================================================================== */
function noteNames() {
  return state.accidental === "flat" ? NOTES_FLAT : NOTES_SHARP;
}

function pitchClassAt(stringIndex, fret) {
  return (STRINGS[stringIndex].pc + fret) % 12;
}

function noteNameAt(stringIndex, fret) {
  return noteNames()[pitchClassAt(stringIndex, fret)];
}

function cellKey(stringIndex, fret) {
  return stringIndex + "-" + fret;
}

/* ====================================================================
   BUILD STATIC UI PIECES (note selects, note picker, scope select)
   ==================================================================== */
function populateNoteBasedSelect(selectEl, includeNoneOption) {
  const names = noteNames();
  const previousValue = selectEl.value;
  selectEl.innerHTML = "";

  if (includeNoneOption) {
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "None";
    selectEl.appendChild(noneOpt);
  }

  names.forEach((name, pc) => {
    const opt = document.createElement("option");
    opt.value = String(pc);
    opt.textContent = name;
    selectEl.appendChild(opt);
  });

  if (previousValue !== "" && [...selectEl.options].some(o => o.value === previousValue)) {
    selectEl.value = previousValue;
  }
}

function populateScopeSelect() {
  scopeSelectEl.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All Strings (Random)";
  scopeSelectEl.appendChild(allOpt);

  STRINGS.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = s.longLabel;
    scopeSelectEl.appendChild(opt);
  });
}

function buildNotePicker() {
  const names = noteNames();
  notePickerEl.innerHTML = "";
  names.forEach((name, pc) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.pc = String(pc);
    btn.textContent = name;
    notePickerEl.appendChild(btn);
  });
}

/* ====================================================================
   FRETBOARD RENDERING
   ==================================================================== */
function buildFretboard() {
  fretboardEl.innerHTML = "";

  const fretCount = state.frets; // frets 0..fretCount
  const colCount = fretCount + 1; // +1 for open string column
  fretboardEl.style.gridTemplateColumns =
    "40px repeat(" + colCount + ", minmax(34px, 1fr))";
  fretboardEl.style.gridTemplateRows =
    "repeat(" + STRINGS.length + ", 44px) 20px";

  // one row per string
  STRINGS.forEach((s, stringIndex) => {
    const label = document.createElement("div");
    label.className = "string-label";
    label.textContent = s.label;
    fretboardEl.appendChild(label);

    for (let fret = 0; fret <= fretCount; fret++) {
      const cell = document.createElement("div");
      cell.className = "fret-cell" + (fret === 0 ? " open-fret nut-cell" : "");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "note-btn";
      btn.dataset.string = String(stringIndex);
      btn.dataset.fret = String(fret);

      cell.appendChild(btn);
      fretboardEl.appendChild(cell);
    }
  });

  // fret marker / number row along the bottom
  const cornerSpacer = document.createElement("div");
  fretboardEl.appendChild(cornerSpacer);

  for (let fret = 0; fret <= fretCount; fret++) {
    const markerCell = document.createElement("div");
    markerCell.className = "marker-cell";
    if (CONFIG.markerFrets.includes(fret)) {
      const dotCount = CONFIG.doubleMarkerFrets.includes(fret) ? 2 : 1;
      for (let d = 0; d < dotCount; d++) {
        const dot = document.createElement("span");
        dot.className = "marker-dot";
        markerCell.appendChild(dot);
      }
    }
    fretboardEl.appendChild(markerCell);
  }

  refreshFretboardDisplay();
}

/* Updates note text / colors on existing cells without rebuilding the
   whole grid. Called whenever a toggle, quiz state, or highlight changes. */
function refreshFretboardDisplay() {
  const buttons = fretboardEl.querySelectorAll(".note-btn");
  const quiz = state.quiz;

  buttons.forEach((btn) => {
    const stringIndex = Number(btn.dataset.string);
    const fret = Number(btn.dataset.fret);
    const pc = pitchClassAt(stringIndex, fret);
    const key = cellKey(stringIndex, fret);

    btn.textContent = noteNameAt(stringIndex, fret);

    // reset per-cell state classes, then re-apply what's relevant
    btn.classList.remove("name-hidden", "highlighted", "quiz-target", "found-correct");

    const isNameQuizRunning = quiz.active && quiz.mode === "name";
    const isThisTheNameTarget =
      isNameQuizRunning && quiz.target &&
      quiz.target.stringIndex === stringIndex && quiz.target.fret === fret;

    // hide all note names while a "Name the Note" quiz is running, so the
    // player has to guess. Reveal only briefly after they answer (locked).
    if (isNameQuizRunning && !quiz.locked) {
      btn.classList.add("name-hidden");
    } else if (!state.showNames && !(isNameQuizRunning && quiz.locked)) {
      btn.classList.add("name-hidden");
    }

    if (isThisTheNameTarget && !quiz.locked) {
      btn.classList.add("quiz-target");
    }

    if (state.highlightPc !== null && pc === state.highlightPc && !quiz.active) {
      btn.classList.add("highlighted");
    }

    if (quiz.active && quiz.mode === "find" && quiz.findPositions &&
        !quiz.findPositions.has(key) && pc === quiz.findPc) {
      // already-found instance in the current "Find the Note" round
      btn.classList.add("found-correct");
      btn.classList.remove("name-hidden");
    }
  });
}

/* ====================================================================
   LEARNING CONTROL HANDLERS
   ==================================================================== */
toggleShowNamesEl.addEventListener("change", () => {
  state.showNames = toggleShowNamesEl.checked;
  refreshFretboardDisplay();
});

toggleFlatsEl.addEventListener("change", () => {
  state.accidental = toggleFlatsEl.checked ? "flat" : "sharp";
  populateNoteBasedSelect(highlightNoteSelectEl, true);
  buildNotePicker();
  refreshFretboardDisplay();
  if (state.quiz.active) updateQuizPromptText();
});

toggleFrets24El.addEventListener("change", () => {
  state.frets = toggleFrets24El.checked ? CONFIG.extendedFrets : CONFIG.defaultFrets;
  if (state.quiz.active) stopQuiz();
  buildFretboard();
});

highlightNoteSelectEl.addEventListener("change", () => {
  const val = highlightNoteSelectEl.value;
  state.highlightPc = val === "" ? null : Number(val);
  refreshFretboardDisplay();
});

/* ====================================================================
   QUIZ SETUP HANDLERS
   ==================================================================== */
modeButtonsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-btn");
  if (!btn || state.quiz.active) return;
  state.quiz.mode = btn.dataset.mode;
  [...modeButtonsEl.children].forEach((b) => b.classList.toggle("active", b === btn));
});

function randomStringForScope() {
  if (state.quiz.scope === "all") {
    return Math.floor(Math.random() * STRINGS.length);
  }
  return Number(state.quiz.scope);
}

function startQuiz() {
  if (!state.quiz.mode) {
    flashPrompt("Pick a mode first: Find the Note or Name the Note.");
    return;
  }
  state.quiz.scope = scopeSelectEl.value;
  state.quiz.active = true;
  state.quiz.score = 0;
  state.quiz.streak = 0;
  state.quiz.locked = false;
  updateStatsUI();

  modeButtonsEl.querySelectorAll(".mode-btn").forEach((b) => (b.disabled = true));
  scopeSelectEl.disabled = true;
  highlightNoteSelectEl.disabled = true;
  startQuizBtnEl.hidden = true;
  stopQuizBtnEl.hidden = false;
  notePickerEl.hidden = state.quiz.mode !== "name";

  nextQuestion();
}

function stopQuiz() {
  state.quiz.active = false;
  state.quiz.target = null;
  state.quiz.findPc = null;
  state.quiz.findPositions = null;
  state.quiz.locked = false;

  modeButtonsEl.querySelectorAll(".mode-btn").forEach((b) => (b.disabled = false));
  scopeSelectEl.disabled = false;
  highlightNoteSelectEl.disabled = false;
  startQuizBtnEl.hidden = false;
  stopQuizBtnEl.hidden = true;
  notePickerEl.hidden = true;

  quizPromptEl.textContent = "Choose a mode and press Start Quiz.";
  feedbackMsgEl.textContent = "";
  feedbackMsgEl.className = "feedback-msg";
  refreshFretboardDisplay();
}

startQuizBtnEl.addEventListener("click", startQuiz);
stopQuizBtnEl.addEventListener("click", stopQuiz);

/* ====================================================================
   QUIZ QUESTION GENERATION
   ==================================================================== */
function nextQuestion() {
  state.quiz.locked = false;
  feedbackMsgEl.textContent = "";
  feedbackMsgEl.className = "feedback-msg";

  if (state.quiz.mode === "name") {
    const stringIndex = randomStringForScope();
    const fret = Math.floor(Math.random() * (state.frets + 1));
    state.quiz.target = { stringIndex, fret, pc: pitchClassAt(stringIndex, fret) };
    updateQuizPromptText();
  } else {
    // "find" mode: pick a random note, then collect every position on the
    // board (within the current scope) that matches it.
    const pc = Math.floor(Math.random() * 12);
    const positions = new Set();
    const scopeStrings = state.quiz.scope === "all"
      ? STRINGS.map((_, i) => i)
      : [Number(state.quiz.scope)];

    scopeStrings.forEach((stringIndex) => {
      for (let fret = 0; fret <= state.frets; fret++) {
        if (pitchClassAt(stringIndex, fret) === pc) {
          positions.add(cellKey(stringIndex, fret));
        }
      }
    });

    state.quiz.findPc = pc;
    state.quiz.findPositions = positions;
    state.quiz.findTotal = positions.size;
    state.quiz.findFound = 0;
    updateQuizPromptText();
  }

  refreshFretboardDisplay();
}

function updateQuizPromptText() {
  const names = noteNames();
  if (state.quiz.mode === "name") {
    quizPromptEl.textContent = "What note is highlighted?";
  } else {
    const found = state.quiz.findFound;
    const total = state.quiz.findTotal;
    quizPromptEl.textContent =
      "Find all " + names[state.quiz.findPc] + " notes  (" + found + "/" + total + ")";
  }
}

/* ====================================================================
   ANSWER HANDLING
   ==================================================================== */

// clicking a fret on the board (used by "Find the Note" mode)
fretboardEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".note-btn");
  if (!btn) return;
  if (!state.quiz.active || state.quiz.mode !== "find" || state.quiz.locked) return;

  const stringIndex = Number(btn.dataset.string);
  const fret = Number(btn.dataset.fret);
  const key = cellKey(stringIndex, fret);
  const pc = pitchClassAt(stringIndex, fret);

  if (pc === state.quiz.findPc && state.quiz.findPositions.has(key)) {
    state.quiz.findPositions.delete(key);
    state.quiz.findFound++;
    state.quiz.score += CONFIG.pointsPerFindCorrect;
    state.quiz.streak++;
    btn.classList.add("flash-correct");
    setTimeout(() => btn.classList.remove("flash-correct"), 500);
    updateStatsUI();
    updateQuizPromptText();
    refreshFretboardDisplay();

    if (state.quiz.findPositions.size === 0) {
      showFeedback(true, "All found!");
      state.quiz.locked = true;
      setTimeout(nextQuestion, CONFIG.nextQuestionDelayMs);
    }
  } else {
    state.quiz.streak = 0;
    btn.classList.add("flash-wrong");
    setTimeout(() => btn.classList.remove("flash-wrong"), 500);
    showFeedback(false, "Not it — keep looking");
    updateStatsUI();
  }
});

// clicking a note-name button (used by "Name the Note" mode)
notePickerEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (!state.quiz.active || state.quiz.mode !== "name" || state.quiz.locked) return;

  const guessedPc = Number(btn.dataset.pc);
  const target = state.quiz.target;
  const correct = guessedPc === target.pc;
  const targetBtn = fretboardEl.querySelector(
    '.note-btn[data-string="' + target.stringIndex + '"][data-fret="' + target.fret + '"]'
  );

  state.quiz.locked = true;

  if (correct) {
    state.quiz.score += CONFIG.pointsPerNamedCorrect;
    state.quiz.streak++;
    showFeedback(true, "Correct! " + noteNameAt(target.stringIndex, target.fret));
    if (targetBtn) {
      targetBtn.classList.add("flash-correct");
      setTimeout(() => targetBtn.classList.remove("flash-correct"), 500);
    }
  } else {
    state.quiz.streak = 0;
    showFeedback(false, "It was " + noteNameAt(target.stringIndex, target.fret));
    if (targetBtn) {
      targetBtn.classList.add("flash-wrong");
      setTimeout(() => targetBtn.classList.remove("flash-wrong"), 500);
    }
  }

  updateStatsUI();
  refreshFretboardDisplay(); // reveals the target's note name (locked = true)
  setTimeout(nextQuestion, CONFIG.nextQuestionDelayMs);
});

function showFeedback(isCorrect, text) {
  feedbackMsgEl.textContent = text;
  feedbackMsgEl.className = "feedback-msg " + (isCorrect ? "correct" : "wrong");
}

function flashPrompt(text) {
  quizPromptEl.textContent = text;
}

function updateStatsUI() {
  scoreValEl.textContent = String(state.quiz.score);
  streakValEl.textContent = String(state.quiz.streak);
}

/* ====================================================================
   INIT
   ==================================================================== */
function init() {
  populateNoteBasedSelect(highlightNoteSelectEl, true);
  populateScopeSelect();
  buildNotePicker();
  buildFretboard();
}

init();
