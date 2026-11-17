/* =========================================================
 * 中国象棋 · 双人对战
 * 纯前端实现，无任何依赖
 * ======================================================= */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */

  var ROWS = 10;
  var COLS = 9;
  var RED = 'r';
  var BLACK = 'b';

  var PIECE_NAME = {
    r: { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵' },
    b: { K: '将', A: '士', B: '象', N: '马', R: '车', C: '炮', P: '卒' }
  };

  var CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var AR_NUM = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  /* 小写代表红方，大写代表黑方，'.' 为空 */
  var INIT = [
    'RNBAKABNR',   // row 0 黑方底线
    '.........',
    '.C.....C.',   // row 2 黑炮
    'P.P.P.P.P',   // row 3 黑卒
    '.........',
    '.........',
    'p.p.p.p.p',   // row 6 红兵
    '.c.....c.',   // row 7 红炮
    '.........',
    'rnbakabnr'    // row 9 红方底线
  ];

  /* ---------------- 棋盘状态 ---------------- */

  var board = [];
  var turn = RED;
  var selected = null;      // [row, col]
  var targets = [];         // [[row, col], ...]
  var history = [];         // { board, turn, lastMove, note }
  var lastMove = null;      // { from:[r,c], to:[r,c], color }
  var gameOver = false;
  var soundOn = true;
  var uidCounter = 1;

  /* 尺寸 */
  var cell = 56;
  var pad = 39;

  /* DOM */
  var canvas = document.getElementById('boardCanvas');
  var ctx = canvas.getContext('2d');
  var wrap = document.getElementById('boardWrap');
  var stage = document.getElementById('stage');
  var piecesLayer = document.getElementById('piecesLayer');
  var hintsLayer = document.getElementById('hintsLayer');

  var statusMain = document.getElementById('statusMain');
  var statusSub = document.getElementById('statusSub');
  var redBar = document.getElementById('redBar');
  var blackBar = document.getElementById('blackBar');
  var redTag = document.getElementById('redTag');
  var blackTag = document.getElementById('blackTag');
  var logList = document.getElementById('logList');
  var moveCount = document.getElementById('moveCount');

  var btnUndo = document.getElementById('btnUndo');
  var btnRestart = document.getElementById('btnRestart');
  var btnSound = document.getElementById('btnSound');

  var overlay = document.getElementById('overlay');
  var dialogIcon = document.getElementById('dialogIcon');
  var resultTitle = document.getElementById('resultTitle');
  var resultDesc = document.getElementById('resultDesc');
  var btnPlayAgain = document.getElementById('btnPlayAgain');
  var btnCloseDialog = document.getElementById('btnCloseDialog');

  var pieceEls = new Map();

  /* ---------------- 工具函数 ---------------- */

  function inside(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  function inPalace(r, c, color) {
    if (c < 3 || c > 5) return false;
    return color === RED ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }

  function cloneBoard(bd) {
    var out = new Array(ROWS);
    for (var r = 0; r < ROWS; r++) {
      var row = new Array(COLS);
      for (var c = 0; c < COLS; c++) {
        var p = bd[r][c];
        row[c] = p ? { type: p.type, color: p.color, id: p.id } : null;
      }
      out[r] = row;
    }
    return out;
  }

  function createInitialBoard() {
    var bd = new Array(ROWS);
    for (var r = 0; r < ROWS; r++) {
      var row = new Array(COLS);
      for (var c = 0; c < COLS; c++) {
        var ch = INIT[r].charAt(c);
        if (ch === '.') {
          row[c] = null;
        } else {
          var isRed = (ch === ch.toLowerCase());
          row[c] = {
            type: ch.toUpperCase(),
            color: isRed ? RED : BLACK,
            id: uidCounter++
          };
        }
      }
      bd[r] = row;
    }
    return bd;
  }

  /* ---------------- 走法生成 ---------------- */

  function pseudoMoves(bd, r, c) {
    var p = bd[r][c];
    if (!p) return [];
    var out = [];
    var dr, dc, rr, cc, i;

    function push(r2, c2) {
      if (!inside(r2, c2)) return false;
      var t = bd[r2][c2];
      if (t && t.color === p.color) return false;
      out.push([r2, c2]);
      return !t; /* 空格可以继续延伸 */
    }

    switch (p.type) {
      /* 车：直线滑行，遇子停止 */
      case 'R': {
        var dirsR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (i = 0; i < 4; i++) {
          dr = dirsR[i][0];
          dc = dirsR[i][1];
          rr = r + dr;
          cc = c + dc;
          while (push(rr, cc)) {
            rr += dr;
            cc += dc;
          }
        }
        break;
      }

      /* 炮：走直线不吃子，吃子必须隔一个炮架 */
      case 'C': {
        var dirsC = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (i = 0; i < 4; i++) {
          dr = dirsC[i][0];
          dc = dirsC[i][1];
          rr = r + dr;
          cc = c + dc;
          while (inside(rr, cc) && !bd[rr][cc]) {
            out.push([rr, cc]);
            rr += dr;
            cc += dc;
          }
          if (!inside(rr, cc)) continue; /* 走到界外，无炮架 */
          rr += dr;
          cc += dc;
          while (inside(rr, cc)) {
            if (bd[rr][cc]) {
              if (bd[rr][cc].color !== p.color) out.push([rr, cc]);
              break;
            }
            rr += dr;
            cc += dc;
          }
        }
        break;
      }

      /* 马：日字，蹩马腿 */
      case 'N': {
        var jumps = [
          [-2, -1, -1, 0], [-2, 1, -1, 0],
          [2, -1, 1, 0], [2, 1, 1, 0],
          [-1, -2, 0, -1], [1, -2, 0, -1],
          [-1, 2, 0, 1], [1, 2, 0, 1]
        ];
        for (i = 0; i < jumps.length; i++) {
          var j = jumps[i];
          var nr = r + j[0];
          var nc = c + j[1];
          if (!inside(nr, nc)) continue;
          if (bd[r + j[2]][c + j[3]]) continue; /* 马腿被蹩 */
          push(nr, nc);
        }
        break;
      }

      /* 相/象：田字，塞象眼，不过河 */
      case 'B': {
        var diag = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
        for (i = 0; i < 4; i++) {
          var br = r + diag[i][0];
          var bc = c + diag[i][1];
          if (!inside(br, bc)) continue;
          if (bd[r + diag[i][0] / 2][c + diag[i][1] / 2]) continue; /* 象眼 */
          if (p.color === RED && br < 5) continue;   /* 红相不过河 */
          if (p.color === BLACK && br > 4) continue; /* 黑象不过河 */
          push(br, bc);
        }
        break;
      }

      /* 仕/士：九宫内斜走一格 */
      case 'A': {
        var adiag = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (i = 0; i < 4; i++) {
          var ar = r + adiag[i][0];
          var ac = c + adiag[i][1];
          if (!inPalace(ar, ac, p.color)) continue;
          push(ar, ac);
        }
        break;
      }

      /* 帅/将：九宫内直走一格，另加「飞将」 */
      case 'K': {
        var kdir = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (i = 0; i < 4; i++) {
          var kr = r + kdir[i][0];
          var kc = c + kdir[i][1];
          if (!inPalace(kr, kc, p.color)) continue;
          push(kr, kc);
        }
        /* 白脸将：同列且中间无子的对方将可直接吃掉 */
        for (i = 0; i < 2; i++) {
          var d = i === 0 ? -1 : 1;
          var sr = r + d;
          while (inside(sr, c)) {
            var sp = bd[sr][c];
            if (sp) {
              if (sp.type === 'K' && sp.color !== p.color) out.push([sr, c]);
              break;
            }
            sr += d;
          }
        }
        break;
      }

      /* 兵/卒：向前一格，过河后可横走 */
      case 'P': {
        var fwd = p.color === RED ? -1 : 1;
        push(r + fwd, c);
        var crossed = p.color === RED ? (r <= 4) : (r >= 5);
        if (crossed) {
          push(r, c - 1);
          push(r, c + 1);
        }
        break;
      }
    }

    return out;
  }

  /* 某方是否被将军（含白脸将） */
  function isInCheck(bd, color) {
    var kr = -1, kc = -1, r, c, i;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var q = bd[r][c];
        if (q && q.type === 'K' && q.color === color) {
          kr = r;
          kc = c;
        }
      }
    }
    if (kr < 0) return false;

    var enemy = color === RED ? BLACK : RED;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var e = bd[r][c];
        if (!e || e.color !== enemy) continue;
        var moves = pseudoMoves(bd, r, c);
        for (i = 0; i < moves.length; i++) {
          if (moves[i][0] === kr && moves[i][1] === kc) return true;
        }
      }
    }
    return false;
  }

  /* 合法走法：过滤掉会导致自己被将军的着法 */
  function legalMoves(bd, r, c) {
    var p = bd[r][c];
    if (!p) return [];
    var raw = pseudoMoves(bd, r, c);
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var r2 = raw[i][0];
      var c2 = raw[i][1];
      var nb = cloneBoard(bd);
      nb[r2][c2] = nb[r][c];
      nb[r][c] = null;
      if (!isInCheck(nb, p.color)) out.push([r2, c2]);
    }
    return out;
  }

  function hasAnyLegalMove(bd, color) {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var p = bd[r][c];
        if (!p || p.color !== color) continue;
        if (legalMoves(bd, r, c).length > 0) return true;
      }
    }
    return false;
  }

  /* ---------------- 中文棋谱记法 ---------------- */

  function fileNum(col, color) {
    return color === RED ? CN_NUM[8 - col] : AR_NUM[col];
  }

  function stepNum(n, color) {
    return color === RED ? CN_NUM[n - 1] : AR_NUM[n - 1];
  }

  function notation(bd, from, to, piece) {
    var r1 = from[0], c1 = from[1];
    var r2 = to[0], c2 = to[1];
    var name = PIECE_NAME[piece.color][piece.type];

    /* 同一列有多个同类棋子时，用「前 / 中 / 后」代替列号 */
    var sameFile = [];
    for (var r = 0; r < ROWS; r++) {
      var q = bd[r][c1];
      if (q && q.color === piece.color && q.type === piece.type) sameFile.push(r);
    }

    var prefix;
    if (sameFile.length > 1) {
      sameFile.sort(function (a, b) {
        return piece.color === RED ? a - b : b - a;
      });
      var idx = sameFile.indexOf(r1);
      if (sameFile.length === 2) {
        prefix = idx === 0 ? '前' : '后';
      } else if (sameFile.length === 3) {
        prefix = ['前', '中', '后'][idx];
      } else {
        prefix = fileNum(c1, piece.color);
      }
    } else {
      prefix = fileNum(c1, piece.color);
    }

    var action, target;
    if (r1 === r2) {
      action = '平';
      target = fileNum(c2, piece.color);
    } else {
      var forward = piece.color === RED ? (r2 < r1) : (r2 > r1);
      action = forward ? '进' : '退';
      if (c1 === c2) {
        target = stepNum(Math.abs(r2 - r1), piece.color);
      } else {
        target = fileNum(c2, piece.color);
      }
    }
    return name + prefix + action + target;
  }

  /* ---------------- 绘制棋盘 ---------------- */

  function drawBoard() {
    var w = pad * 2 + (COLS - 1) * cell;
    var h = pad * 2 + (ROWS - 1) * cell;
    var dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    function X(c) { return pad + c * cell; }
    function Y(r) { return pad + r * cell; }

    /* 底纹 */
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#f4ddb3');
    g.addColorStop(0.5, '#eecd97');
    g.addColorStop(1, '#e3bd81');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    /* 木纹细线 */
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 1;
    for (var i = 0; i < 26; i++) {
      var yy = (h / 26) * i + 6;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(w * 0.3, yy + 4, w * 0.7, yy - 4, w, yy + 2);
      ctx.stroke();
    }
    ctx.restore();

    /* 外框 */
    ctx.strokeStyle = '#7a5230';
    var margin = cell * 0.16;
    ctx.lineWidth = Math.max(1.6, cell * 0.032);
    ctx.strokeRect(X(0) - margin, Y(0) - margin,
      (COLS - 1) * cell + margin * 2, (ROWS - 1) * cell + margin * 2);

    /* 棋盘线 */
    ctx.lineWidth = Math.max(1, cell * 0.018);
    ctx.strokeStyle = 'rgba(104, 68, 38, 0.85)';
    ctx.lineCap = 'round';

    /* 横线：10 条，全部贯通用 */
    for (var r = 0; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(r));
      ctx.lineTo(X(COLS - 1), Y(r));
      ctx.stroke();
    }

    /* 竖线：最外两侧贯通，中间 7 条在河界断开 */
    for (var c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) {
        ctx.beginPath();
        ctx.moveTo(X(c), Y(0));
        ctx.lineTo(X(c), Y(ROWS - 1));
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(X(c), Y(0));
        ctx.lineTo(X(c), Y(4));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(X(c), Y(5));
        ctx.lineTo(X(c), Y(ROWS - 1));
        ctx.stroke();
      }
    }

    /* 九宫斜线 */
    ctx.beginPath();
    ctx.moveTo(X(3), Y(0));
    ctx.lineTo(X(5), Y(2));
    ctx.moveTo(X(5), Y(0));
    ctx.lineTo(X(3), Y(2));
    ctx.moveTo(X(3), Y(7));
    ctx.lineTo(X(5), Y(9));
    ctx.moveTo(X(5), Y(7));
    ctx.lineTo(X(3), Y(9));
    ctx.stroke();

    /* 兵位、炮位的定位角标 */
    var marks = [
      [2, 1], [2, 7], [7, 1], [7, 7],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
      [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]
    ];
    var len = cell * 0.17;
    var gap = cell * 0.075;
    ctx.lineWidth = Math.max(1, cell * 0.017);

    marks.forEach(function (m) {
      var mr = m[0], mc = m[1];
      var x = X(mc), y = Y(mr);
      var left = mc > 0;
      var right = mc < COLS - 1;

      if (left) {
        line(x - gap, y - gap, x - gap - len, y - gap);
        line(x - gap, y + gap, x - gap - len, y + gap);
      }
      if (right) {
        line(x + gap, y - gap, x + gap + len, y - gap);
        line(x + gap, y + gap, x + gap + len, y + gap);
      }
    });

    function line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    /* 楚河汉界 */
    ctx.save();
    ctx.fillStyle = 'rgba(104, 68, 38, 0.55)';
    ctx.font = '700 ' + Math.round(cell * 0.46) + 'px "KaiTi", "STKaiti", "楷体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var midY = (Y(4) + Y(5)) / 2;
    var wordGap = cell * 0.66;
    drawWord('楚河', X(2), midY, wordGap);
    drawWord('漢界', X(6), midY, wordGap);

    function drawWord(text, cx, cy, gap) {
      ctx.fillText(text.charAt(0), cx - gap / 2, cy);
      ctx.fillText(text.charAt(1), cx + gap / 2, cy);
    }
    ctx.restore();
  }

  /* ---------------- 棋子渲染 ---------------- */

  function renderPieces() {
    var size = Math.round(cell * 0.86);
    var seen = {};

    /* 被将军的一方，将/帅发光警示 */
    var checkColor = null;
    if (!gameOver && isInCheck(board, turn)) checkColor = turn;

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var p = board[r][c];
        if (!p) continue;
        seen[p.id] = true;

        var el = pieceEls.get(p.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'piece ' + (p.color === RED ? 'red' : 'black');
          var span = document.createElement('span');
          span.textContent = PIECE_NAME[p.color][p.type];
          el.appendChild(span);
          piecesLayer.appendChild(el);
          pieceEls.set(p.id, el);
        }

        var isSel = !!(selected && selected[0] === r && selected[1] === c);
        var isChecked = (p.type === 'K' && p.color === checkColor);
        if (isSel !== el.classList.contains('selected')) {
          el.classList.toggle('selected', isSel);
        }
        if (isChecked !== el.classList.contains('in-check')) {
          el.classList.toggle('in-check', isChecked);
        }

        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.fontSize = Math.round(size * 0.6) + 'px';

        var x = pad + c * cell - size / 2;
        var y = pad + r * cell - size / 2;
        el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
        el.style.zIndex = isSel ? 5 : 2;
      }
    }

    pieceEls.forEach(function (el, id) {
      if (!seen[id]) {
        el.classList.add('captured');
        el.style.transform += ' scale(0.4)';
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 240);
        pieceEls.delete(id);
      }
    });
  }

  /* ---------------- 高亮层 ---------------- */

  function renderHints() {
    hintsLayer.innerHTML = '';

    var dotSize = Math.round(Math.max(9, cell * 0.26));
    var capSize = Math.round(cell * 0.82);

    if (lastMove) {
      var pts = [lastMove.from, lastMove.to];
      pts.forEach(function (pt) {
        var d = document.createElement('div');
        d.className = 'hint-last';
        var s = Math.round(cell * 0.68);
        d.style.width = s + 'px';
        d.style.height = s + 'px';
        d.style.left = (pad + pt[1] * cell) + 'px';
        d.style.top = (pad + pt[0] * cell) + 'px';
        hintsLayer.appendChild(d);
      });
    }

    targets.forEach(function (t) {
      var occupied = !!board[t[0]][t[1]];
      var d = document.createElement('div');
      d.className = occupied ? 'hint-cap' : 'hint-dot';
      var s = occupied ? capSize : dotSize;
      d.style.width = s + 'px';
      d.style.height = s + 'px';
      d.style.left = (pad + t[1] * cell) + 'px';
      d.style.top = (pad + t[0] * cell) + 'px';
      hintsLayer.appendChild(d);
    });
  }

  /* ---------------- 状态与界面 ---------------- */

  function updateStatus() {
    var isRed = turn === RED;
    var sideName = isRed ? '红方' : '黑方';

    if (gameOver) {
      redBar.classList.remove('active');
      blackBar.classList.remove('active');
      return;
    }

    redBar.classList.toggle('active', isRed);
    blackBar.classList.toggle('active', !isRed);

    var inCheck = isInCheck(board, turn);
    redTag.textContent = isRed ? (inCheck ? '被将军！' : '行棋中') : '等待中';
    blackTag.textContent = !isRed ? (inCheck ? '被将军！' : '行棋中') : '等待中';
    redTag.style.color = (isRed && inCheck) ? '#c0392b' : '';
    blackTag.style.color = (!isRed && inCheck) ? '#c0392b' : '';

    if (inCheck) {
      statusMain.textContent = sideName + '被将军！';
      statusMain.className = 'status-main check';
      statusSub.textContent = '必须应将，无法应将即告负';
    } else {
      statusMain.textContent = sideName + '行棋';
      statusMain.className = 'status-main';
      statusSub.textContent = isRed
        ? '红先黑后，点击棋子选择'
        : '轮到黑方，点击棋子选择';
    }
  }

  function renderLog() {
    logList.innerHTML = '';
    if (history.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'log-empty';
      empty.textContent = '尚未落子';
      logList.appendChild(empty);
      moveCount.textContent = '0 手';
      return;
    }

    for (var i = 0; i < history.length; i += 2) {
      var row = document.createElement('div');
      row.className = 'log-row' + (i >= history.length - 2 ? ' fresh' : '');

      var idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = (i / 2 + 1);

      var a = document.createElement('span');
      a.className = 'r';
      a.textContent = history[i] ? history[i].note : '';

      var b = document.createElement('span');
      b.className = 'b';
      b.textContent = (history[i + 1] && history[i + 1].note) || '';

      row.appendChild(idx);
      row.appendChild(a);
      row.appendChild(b);
      logList.appendChild(row);
    }

    moveCount.textContent = history.length + ' 手';
    logList.scrollTop = logList.scrollHeight;
  }

  /* ---------------- 音效 ---------------- */

  var audioCtx = null;

  function playSound(kind) {
    if (!soundOn) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      var t = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();

      osc.type = 'triangle';
      if (kind === 'capture') {
        osc.frequency.setValueAtTime(330, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.11);
        gain.gain.setValueAtTime(0.3, t);
      } else if (kind === 'check') {
        osc.frequency.setValueAtTime(680, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.16);
        gain.gain.setValueAtTime(0.26, t);
      } else {
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(190, t + 0.08);
        gain.gain.setValueAtTime(0.24, t);
      }
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch (err) {
      /* 静默忽略 */
    }
  }

  /* ---------------- 交互 ---------------- */

  function hitTest(clientX, clientY) {
    var rect = wrap.getBoundingClientRect();
    var x = clientX - rect.left - pad;
    var y = clientY - rect.top - pad;
    var c = Math.round(x / cell);
    var r = Math.round(y / cell);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;

    var dx = x - c * cell;
    var dy = y - r * cell;
    if (Math.sqrt(dx * dx + dy * dy) > cell * 0.66) return null;
    return [r, c];
  }

  function clearSelection() {
    selected = null;
    targets = [];
    renderPieces();
    renderHints();
  }

  function select(r, c) {
    selected = [r, c];
    targets = legalMoves(board, r, c);
    renderPieces();
    renderHints();
  }

  function onBoardClick(e) {
    if (gameOver) return;

    var pt = hitTest(e.clientX, e.clientY);
    if (!pt) {
      clearSelection();
      return;
    }

    var r = pt[0], c = pt[1];
    var p = board[r][c];

    if (selected) {
      /* 点击可走位置 → 落子 */
      for (var i = 0; i < targets.length; i++) {
        if (targets[i][0] === r && targets[i][1] === c) {
          doMove(selected, [r, c]);
          return;
        }
      }
      /* 点击己方另一枚棋 → 改选 */
      if (p && p.color === turn) {
        select(r, c);
        return;
      }
      clearSelection();
      return;
    }

    if (p && p.color === turn) select(r, c);
  }

  function doMove(from, to) {
    var r1 = from[0], c1 = from[1];
    var r2 = to[0], c2 = to[1];
    var piece = board[r1][c1];
    var captured = board[r2][c2];

    /* 先存档，再执行 */
    history.push({
      board: cloneBoard(board),
      turn: turn,
      lastMove: lastMove ? { from: lastMove.from.slice(), to: lastMove.to.slice(), color: lastMove.color } : null,
      note: notation(board, from, to, piece)
    });

    board[r2][c2] = piece;
    board[r1][c1] = null;

    lastMove = { from: [r1, c1], to: [r2, c2], color: piece.color };
    selected = null;
    targets = [];

    turn = turn === RED ? BLACK : RED;

    renderPieces();
    renderHints();
    renderLog();

    var inCheck = isInCheck(board, turn);
    playSound(captured ? 'capture' : (inCheck ? 'check' : 'move'));

    updateStatus();
    checkEnd(inCheck);

    btnUndo.disabled = false;
  }

  function checkEnd(inCheck) {
    var hasMove = hasAnyLegalMove(board, turn);
    if (hasMove) return;

    gameOver = true;
    var winnerColor = turn === RED ? BLACK : RED;
    var winnerName = winnerColor === RED ? '红方' : '黑方';
    var loserName = turn === RED ? '红方' : '黑方';
    var reason = inCheck ? '绝杀' : '困毙';

    statusMain.textContent = winnerName + '胜！';
    statusMain.className = 'status-main win';
    statusSub.textContent = loserName + (inCheck ? '被将死' : '无子可动');

    redBar.classList.remove('active');
    blackBar.classList.remove('active');
    redTag.textContent = winnerColor === RED ? '胜' : '负';
    blackTag.textContent = winnerColor === BLACK ? '胜' : '负';

    showResult(winnerColor, reason);
  }

  function showResult(winnerColor, reason) {
    var winnerName = winnerColor === RED ? '红方' : '黑方';
    var loserName = winnerColor === RED ? '黑方' : '红方';

    dialogIcon.textContent = '🏆';
    if (reason === '和棋') {
      dialogIcon.textContent = '🤝';
      resultTitle.textContent = '和棋';
      resultDesc.textContent = '双方握手言和';
    } else {
      resultTitle.textContent = winnerName + '胜';
      resultDesc.textContent = loserName + (reason === '绝杀' ? '被将死，' : '无子可动，') + '恭喜获胜方';
    }

    overlay.classList.remove('hidden');
  }

  /* ---------------- 操作按钮 ---------------- */

  function undo() {
    if (history.length === 0) return;

    var last = history.pop();
    board = last.board;
    turn = last.turn;
    lastMove = last.lastMove;
    selected = null;
    targets = [];
    gameOver = false;

    overlay.classList.add('hidden');
    statusMain.className = 'status-main';

    renderPieces();
    renderHints();
    renderLog();
    updateStatus();

    btnUndo.disabled = history.length === 0;
  }

  function restart() {
    board = createInitialBoard();
    turn = RED;
    selected = null;
    targets = [];
    history = [];
    lastMove = null;
    gameOver = false;

    pieceEls.forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    pieceEls.clear();

    overlay.classList.add('hidden');
    statusMain.className = 'status-main';
    btnUndo.disabled = true;

    renderPieces();
    renderHints();
    renderLog();
    updateStatus();
  }

  /* ---------------- 尺寸计算 ---------------- */

  function resize() {
    var rect = stage.getBoundingClientRect();
    var availW = rect.width;
    var availH = rect.height;

    if (!availW) availW = window.innerWidth - 40;
    if (!availH || availH < 160) availH = window.innerHeight * 0.55;

    var padRatio = 0.72;
    var byW = availW / ((COLS - 1) + padRatio * 2);
    var byH = availH / ((ROWS - 1) + padRatio * 2);

    cell = Math.floor(Math.min(byW, byH, 70));
    if (cell < 26) cell = 26;
    pad = Math.round(cell * padRatio);

    drawBoard();
    renderPieces();
    renderHints();
  }

  /* ---------------- 事件绑定 ---------------- */

  wrap.addEventListener('click', onBoardClick);

  btnUndo.addEventListener('click', undo);
  btnRestart.addEventListener('click', restart);

  btnSound.addEventListener('click', function () {
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? '音效：开' : '音效：关';
    if (soundOn) playSound('move');
  });

  btnPlayAgain.addEventListener('click', restart);

  btnCloseDialog.addEventListener('click', function () {
    overlay.classList.add('hidden');
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
    if (e.key === 'Escape') {
      overlay.classList.add('hidden');
      clearSelection();
    }
  });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  });

  /* ---------------- 启动 ---------------- */

  board = createInitialBoard();
  btnUndo.disabled = true;
  resize();
  renderPieces();
  renderLog();
  updateStatus();

  /* 暴露给控制台调试（可选） */
  window.ChessGame = {
    getBoard: function () { return board; },
    legalMoves: function (r, c) { return legalMoves(board, r, c); },
    reset: restart
  };

})();
