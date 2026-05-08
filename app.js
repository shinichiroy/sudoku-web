'use strict';

// =============================================
//  定数・設定
// =============================================
const DIFFICULTY = {
  easy:   36, // 空白マス数
  medium: 46,
  hard:   55,
};

// =============================================
//  数独ロジック
// =============================================

/** 完成した9x9盤面をランダム生成する */
function generateSolvedBoard() {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(board, true);
  return board;
}

/** バックトラック法でパズルを解く (randomize=trueでランダム順) */
function solveSudoku(board, randomize = false) {
  const empty = findEmpty(board);
  if (!empty) return true;
  const [r, c] = empty;
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (randomize) shuffle(nums);
  for (const n of nums) {
    if (isValid(board, r, c, n)) {
      board[r][c] = n;
      if (solveSudoku(board, randomize)) return true;
      board[r][c] = 0;
    }
  }
  return false;
}

function findEmpty(board) {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0) return [r, c];
  return null;
}

function isValid(board, row, col, num) {
  if (board[row].includes(num)) return false;
  for (let r = 0; r < 9; r++) if (board[r][col] === num) return false;
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (board[r][c] === num) return false;
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** 完成盤面から指定数だけマスを空けてパズルを生成する */
function generatePuzzle(solved, blanks) {
  const puzzle = solved.map(row => [...row]);
  const positions = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      positions.push([r, c]);
  shuffle(positions);
  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= blanks) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    // 一意解チェック（簡易）
    const test = puzzle.map(row => [...row]);
    if (countSolutions(test, 2) === 1) {
      removed++;
    } else {
      puzzle[r][c] = backup;
    }
  }
  return puzzle;
}

function countSolutions(board, limit) {
  const empty = findEmpty(board);
  if (!empty) return 1;
  const [r, c] = empty;
  let count = 0;
  for (let n = 1; n <= 9 && count < limit; n++) {
    if (isValid(board, r, c, n)) {
      board[r][c] = n;
      count += countSolutions(board, limit);
      board[r][c] = 0;
    }
  }
  return count;
}

// =============================================
//  ゲーム状態
// =============================================
let solvedBoard = [];
let givenBoard  = [];
let userBoard   = [];
let memoBoard   = [];
let selectedCell = null;
let hintUsed = 0;
let memoMode = false;
let history  = [];
let currentDifficulty = 'medium';

// タイマー
let timerInterval = null;
let timerSeconds = 0;

function startTimer() {
  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => { timerSeconds++; updateTimerDisplay(); }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${String(s).padStart(2, '0')}秒`;
}

// 画面遷移
const DIFF_LABELS = { easy: 'かんたん', medium: 'ふつう', hard: 'むずかしい' };

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function goToMenu() {
  stopTimer();
  showScreen('screen-menu');
}

function showClearScreen() {
  stopTimer();
  document.getElementById('clear-difficulty').textContent = DIFF_LABELS[currentDifficulty];
  document.getElementById('clear-time').textContent = formatTime(timerSeconds);
  document.getElementById('clear-hints').textContent = `${hintUsed}回`;
  showScreen('screen-clear');
}

// =============================================
//  DOM 操作
// =============================================
const boardEl       = document.getElementById('board');
const messageEl     = document.getElementById('message');
const memoToggleBtn = document.getElementById('btn-memo-toggle');
const memoBadgeEl   = document.getElementById('memo-badge');
const hintBadgeEl   = document.getElementById('hint-badge');

function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function getConflictCells() {
  const conflicts = new Set();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = userBoard[r][c];
      if (val === 0) continue;
      // 行チェック
      for (let cc = 0; cc < 9; cc++) {
        if (cc !== c && userBoard[r][cc] === val) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${r},${cc}`);
        }
      }
      // 列チェック
      for (let rr = 0; rr < 9; rr++) {
        if (rr !== r && userBoard[rr][c] === val) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${rr},${c}`);
        }
      }
      // ブロックチェック
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) {
        for (let cc = bc; cc < bc + 3; cc++) {
          if ((rr !== r || cc !== c) && userBoard[rr][cc] === val) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${rr},${cc}`);
          }
        }
      }
    }
  }
  return conflicts;
}

function renderBoard() {
  const conflicts = getConflictCells();
  const cells = boardEl.querySelectorAll('.cell');
  cells.forEach(cell => {
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    cell.className = 'cell';
    cell.innerHTML = '';
    const val = userBoard[r][c];
    if (givenBoard[r][c] !== 0) {
      cell.classList.add('given');
      cell.textContent = givenBoard[r][c];
    } else if (val !== 0) {
      cell.classList.add('user');
      cell.textContent = val;
    } else if (memoBoard[r][c] && memoBoard[r][c].size > 0) {
      const memoDiv = document.createElement('div');
      memoDiv.className = 'cell-memos';
      for (let n = 1; n <= 9; n++) {
        const span = document.createElement('span');
        span.className = 'memo-num';
        span.textContent = memoBoard[r][c].has(n) ? n : '';
        memoDiv.appendChild(span);
      }
      cell.appendChild(memoDiv);
    }
    if (conflicts.has(`${r},${c}`)) {
      cell.classList.add('conflict');
    }
    if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
      cell.classList.add('selected');
    }
  });
  highlightRelated();
  renderNumpad();
}

function renderNumpad() {
  // 盤面上の各数字の出現数をカウント
  const count = Array(10).fill(0);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      count[userBoard[r][c]]++;

  document.querySelectorAll('.num-btn').forEach(btn => {
    const n = Number(btn.dataset.num);
    if (n === 0) return;
    if (count[n] >= 9) {
      btn.textContent = '✓';
      btn.disabled = true;
      btn.classList.add('completed');
    } else {
      btn.textContent = n;
      btn.disabled = false;
      btn.classList.remove('completed');
    }
  });
}

function highlightRelated() {
  if (!selectedCell) return;
  const { row, col } = selectedCell;
  // 選択セルの数字を取得
  const selectedVal = givenBoard[row][col] !== 0
    ? givenBoard[row][col]
    : userBoard[row][col];

  boardEl.querySelectorAll('.cell').forEach(cell => {
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    if (cell.classList.contains('selected')) return;

    const sameBlock = Math.floor(r / 3) === Math.floor(row / 3) &&
                      Math.floor(c / 3) === Math.floor(col / 3);
    if (r === row || c === col || sameBlock) {
      cell.classList.add('highlight');
    }
    // 同一数字ハイライト（highlightより強いので後から追加）
    if (selectedVal !== 0) {
      const cellVal = givenBoard[r][c] !== 0 ? givenBoard[r][c] : userBoard[r][c];
      if (cellVal === selectedVal) {
        cell.classList.add('same-num');
      }
    }
  });
}

function showMessage(text, type = '') {
  messageEl.textContent = text;
  messageEl.className = type;
}

// =============================================
//  イベントハンドラ
// =============================================
function onCellClick(r, c) {
  selectedCell = { row: r, col: c };
  renderBoard();
}

function pushHistory() {
  history.push({
    userBoard: userBoard.map(row => [...row]),
    memoBoard: memoBoard.map(row => row.map(s => new Set(s))),
  });
  if (history.length > 50) history.shift();
}

function undoHistory() {
  if (history.length === 0) return;
  const state = history.pop();
  userBoard = state.userBoard;
  memoBoard = state.memoBoard;
  renderBoard();
}

function toggleMemoMode() {
  memoMode = !memoMode;
  memoToggleBtn.classList.toggle('active', memoMode);
  memoBadgeEl.textContent = memoMode ? 'ON' : 'OFF';
  memoBadgeEl.classList.toggle('on', memoMode);
}

function onNumInput(num) {
  if (!selectedCell) return;
  const { row, col } = selectedCell;
  if (givenBoard[row][col] !== 0) return; // 与えられたマスは変更不可
  pushHistory();

  if (memoMode) {
    // メモモード：数字をトグル、0で全消去
    if (num === 0) {
      memoBoard[row][col].clear();
    } else {
      if (memoBoard[row][col].has(num)) {
        memoBoard[row][col].delete(num);
      } else {
        memoBoard[row][col].add(num);
      }
    }
    renderBoard();
  } else {
    // 通常モード：直接入力、確定数字入力時はメモをクリア
    userBoard[row][col] = num;
    if (num !== 0) memoBoard[row][col].clear();
    renderBoard();
    checkComplete();
  }
}

document.getElementById('btn-new-game').addEventListener('click', startNewGame);

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('最初からやり直しますか？')) return;
  userBoard = givenBoard.map(row => [...row]);
  memoBoard = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  selectedCell = null;
  history = [];
  if (memoMode) toggleMemoMode();
  renderBoard();
  showMessage('');
});

document.getElementById('btn-hint').addEventListener('click', () => {
  if (!selectedCell) { showMessage('マスを選択してください', 'info'); return; }
  const { row, col } = selectedCell;
  if (givenBoard[row][col] !== 0) { showMessage('ヒントは空白マスに使えます', 'info'); return; }
  pushHistory();
  userBoard[row][col] = solvedBoard[row][col];
  memoBoard[row][col].clear();
  hintUsed++;
  hintBadgeEl.textContent = hintUsed;
  hintBadgeEl.style.display = '';
  renderBoard();
  // ヒント演出
  const cellEl = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  cellEl.classList.add('hint');
  setTimeout(() => cellEl.classList.remove('hint'), 800);
  showMessage(`ヒント使用: ${hintUsed}回`, 'info');
  checkComplete();
});

document.querySelectorAll('.num-btn').forEach(btn => {
  btn.addEventListener('click', () => onNumInput(Number(btn.dataset.num)));
});

memoToggleBtn.addEventListener('click', toggleMemoMode);
document.getElementById('btn-undo').addEventListener('click', undoHistory);
document.getElementById('btn-erase').addEventListener('click', () => onNumInput(0));

document.getElementById('btn-start').addEventListener('click', () => {
  const checked = document.querySelector('input[name="difficulty"]:checked');
  currentDifficulty = checked ? checked.value : 'medium';
  startNewGame(currentDifficulty);
});

document.getElementById('btn-to-menu').addEventListener('click', () => {
  goToMenu();
});

document.getElementById('btn-new-game').addEventListener('click', () => startNewGame(currentDifficulty));

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('最初からやり直しますか？')) return;
  userBoard = givenBoard.map(row => [...row]);
  memoBoard = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  selectedCell = null;
  history = [];
  if (memoMode) toggleMemoMode();
  startTimer();
  renderBoard();
  showMessage('');
});

document.getElementById('btn-clear-menu').addEventListener('click', goToMenu);
document.getElementById('btn-clear-retry').addEventListener('click', () => startNewGame(currentDifficulty));

// キーボード入力
document.addEventListener('keydown', e => {
  // メモモードトグル（mキー）
  if (e.key === 'm' || e.key === 'M') {
    toggleMemoMode();
    return;
  }
  if (!selectedCell) return;
  const { row, col } = selectedCell;
  if (e.key >= '1' && e.key <= '9') { onNumInput(Number(e.key)); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { onNumInput(0); return; }
  // 矢印キー移動
  const moves = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    selectedCell = {
      row: Math.max(0, Math.min(8, row + dr)),
      col: Math.max(0, Math.min(8, col + dc)),
    };
    renderBoard();
  }
});

// =============================================
//  ゲームフロー
// =============================================
function startNewGame(difficulty = 'medium') {
  currentDifficulty = difficulty;
  showMessage('問題を生成中...', 'info');
  setTimeout(() => {
    const blanks = DIFFICULTY[difficulty];
    solvedBoard = generateSolvedBoard();
    givenBoard  = generatePuzzle(solvedBoard, blanks);
    userBoard   = givenBoard.map(row => [...row]);
    memoBoard   = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    selectedCell = null;
    hintUsed = 0;
    history = [];
    hintBadgeEl.style.display = 'none';
    if (memoMode) toggleMemoMode();
    document.getElementById('game-difficulty-label').textContent = DIFF_LABELS[difficulty];
    showScreen('screen-game');
    startTimer();
    renderBoard();
    showMessage('');
  }, 30);
}

function checkComplete() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (userBoard[r][c] !== solvedBoard[r][c]) return;
  showClearScreen();
}

// =============================================
//  初期化
// =============================================
buildBoard();
showScreen('screen-menu');
