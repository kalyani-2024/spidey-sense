(function () {
  var WORDS = [
    { word: "JAVASCRIPT", category: "Programming Language", hint: "Runs the web in every browser" },
    { word: "PYTHON", category: "Programming Language", hint: "Named after a comedy troupe, loved by data folks" },
    { word: "RUST", category: "Programming Language", hint: "Memory-safe systems language with a borrow checker" },
    { word: "TYPESCRIPT", category: "Programming Language", hint: "JavaScript with a suit of armor (types)" },
    { word: "KOTLIN", category: "Programming Language", hint: "Modern favorite for Android apps" },
    { word: "COMPILER", category: "Coding Term", hint: "Turns your source code into machine code" },
    { word: "ALGORITHM", category: "Coding Term", hint: "A step-by-step recipe for solving a problem" },
    { word: "VARIABLE", category: "Coding Term", hint: "A named box that holds a value" },
    { word: "FUNCTION", category: "Coding Term", hint: "A reusable block of code you can call" },
    { word: "RECURSION", category: "Coding Term", hint: "When a function calls itself" },
    { word: "BOOLEAN", category: "Coding Term", hint: "Only ever true or false" },
    { word: "ITERATION", category: "Coding Term", hint: "Looping through items one by one" },
    { word: "FIREWALL", category: "Cybersecurity", hint: "Guards a network from unwanted traffic" },
    { word: "ENCRYPTION", category: "Cybersecurity", hint: "Scrambles data so only the key holder can read it" },
    { word: "MALWARE", category: "Cybersecurity", hint: "Software built to do harm" },
    { word: "PHISHING", category: "Cybersecurity", hint: "A scam that baits you into giving up secrets" },
    { word: "DATABASE", category: "Tech Concept", hint: "Where an app keeps its organized data" },
    { word: "KEYBOARD", category: "Hardware", hint: "How you type these very guesses" },
    { word: "BANDWIDTH", category: "Networking", hint: "How much data a connection can carry" },
    { word: "PROTOCOL", category: "Networking", hint: "The agreed rules that let machines talk" }
  ];

  var ERROR_LINES = [
    { code: "ERR_0x1F", message: "Unexpected input token" },
    { code: "WARN_42", message: "Memory leak detected... 37%" },
    { code: "NET_503", message: "Web connection unstable... 68%" },
    { code: "FATAL_88", message: "Kernel panic imminent... 94%" },
    { code: "SYS_DEAD", message: "SYSTEM FAILURE \u2014 SHUTTING DOWN" }
  ];

  var ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  var MAX_MISTAKES = 5;
  var WORDS_TO_WIN = 2;

  var entry, guessed, mistakes, gameOver, wordsWon = 0;

  var bezelEl = document.getElementById("hsg-bezel");
  var titlebarEl = document.getElementById("hsg-titlebar");
  var statusEl = document.getElementById("hsg-status");
  var consoleEl = document.getElementById("hsg-console");
  var meterEl = document.getElementById("hsg-crashmeter");
  var hintCatEl = document.getElementById("hsg-hint-cat");
  var hintTextEl = document.getElementById("hsg-hint-text");
  var wordEl = document.getElementById("hsg-word");
  var keysEl = document.getElementById("hsg-keys");
  var overlayEl = document.getElementById("hsg-overlay");
  var headlineEl = document.getElementById("hsg-headline");
  var sublineEl = document.getElementById("hsg-subline");
  var revealCatEl = document.getElementById("hsg-reveal-cat");
  var revealWordEl = document.getElementById("hsg-reveal-word");
  var againBtn = document.getElementById("hsg-again");

  function pickWord(exclude) {
    var pool = exclude ? WORDS.filter(function (w) { return w.word !== exclude; }) : WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function renderConsole() {
    var crashed = mistakes >= MAX_MISTAKES;
    titlebarEl.classList.toggle("crashed", crashed);
    statusEl.textContent = crashed ? "OFFLINE" : "ONLINE";
    bezelEl.classList.toggle("shake", crashed);

    if (mistakes === 0) {
      consoleEl.innerHTML = "<p>&gt; system stable.<br>&gt; awaiting operator input_</p>";
    } else {
      var html = "";
      for (var i = 0; i < mistakes; i++) {
        var line = ERROR_LINES[i];
        var fatal = i === MAX_MISTAKES - 1;
        html += '<div class="hsg-errline' + (fatal ? " fatal" : "") + '">' +
          '<span class="code">[' + line.code + "]</span><span>" + line.message + "</span></div>";
      }
      consoleEl.innerHTML = html;
    }

    meterEl.innerHTML = "";
    "CRASH".split("").forEach(function (ch, i) {
      var s = document.createElement("span");
      s.textContent = ch;
      if (i < mistakes) s.classList.add("active");
      meterEl.appendChild(s);
    });
  }

  function renderHint() {
    hintCatEl.textContent = entry.category.toUpperCase();
    hintTextEl.textContent = entry.hint;
  }

  function renderWord() {
    wordEl.innerHTML = "";
    entry.word.split("").forEach(function (ch) {
      var revealed = guessed.indexOf(ch) !== -1 || gameOver;
      var missed = gameOver && guessed.indexOf(ch) === -1;
      var wrap = document.createElement("div");
      wrap.className = "hsg-letter";
      var top = document.createElement("div");
      top.className = "ch" + (missed ? " missed" : "");
      top.textContent = revealed ? ch : "";
      var bar = document.createElement("div");
      bar.className = "bar";
      wrap.appendChild(top);
      wrap.appendChild(bar);
      wordEl.appendChild(wrap);
    });
  }

  function renderKeys() {
    keysEl.innerHTML = "";
    ROWS.forEach(function (row) {
      var rowEl = document.createElement("div");
      rowEl.className = "hsg-row";
      row.split("").forEach(function (L) {
        var btn = document.createElement("button");
        btn.className = "hsg-key";
        btn.textContent = L;
        var isGuessed = guessed.indexOf(L) !== -1;
        var correct = isGuessed && entry.word.indexOf(L) !== -1;
        var wrong = isGuessed && entry.word.indexOf(L) === -1;
        if (correct) btn.classList.add("correct");
        if (wrong) btn.classList.add("wrong");
        btn.disabled = gameOver || isGuessed;
        btn.addEventListener("click", function () { guess(L); });
        rowEl.appendChild(btn);
      });
      keysEl.appendChild(rowEl);
    });
  }

  function checkGameOver() {
    var won = entry.word.split("").every(function (ch) { return guessed.indexOf(ch) !== -1; });
    var lost = mistakes >= MAX_MISTAKES;
    gameOver = won || lost;
    if (gameOver) showResult(won);
    return gameOver;
  }

  function showResult(won) {
    overlayEl.style.display = "flex";
    revealCatEl.textContent = entry.category;
    revealWordEl.textContent = entry.word;

    if (won) {
      wordsWon++;
      var finished = wordsWon >= WORDS_TO_WIN;
      headlineEl.textContent = finished ? "CASE CRACKED!" : "WORD CRACKED!";
      headlineEl.className = "headline won";
      sublineEl.textContent = finished
        ? "The web-head saves the day"
        : wordsWon + " of " + WORDS_TO_WIN + " words down \u2014 one more to go";
      if (finished) {
        // Challenge complete: no retries after the 2nd word win, game locks
        // here. The pause lets "CASE CRACKED!" actually register before
        // completeGame() takes over with the shared CLEARED! card.
        againBtn.style.display = "none";
        setTimeout(function () {
          completeGame('1', { message: "Mainframe descrambled. Next threat incoming…" });
        }, 1500);
      } else {
        againBtn.textContent = "\u2192 Next Word";
        againBtn.style.display = "block";
      }
    } else {
      headlineEl.textContent = "CRASH!";
      headlineEl.className = "headline lost";
      sublineEl.textContent = "The system went down \u2014 try again";
      againBtn.textContent = "\u21ba Sling Again";
      againBtn.style.display = "block";
    }
  }

  function guess(letter) {
    if (gameOver || guessed.indexOf(letter) !== -1) return;
    guessed.push(letter);
    if (entry.word.indexOf(letter) === -1) mistakes++;
    renderConsole();
    renderWord();
    renderKeys();
    checkGameOver();
  }

  function newGame() {
    entry = pickWord(entry ? entry.word : undefined);
    guessed = [];
    mistakes = 0;
    gameOver = false;
    overlayEl.style.display = "none";
    renderConsole();
    renderHint();
    renderWord();
    renderKeys();
  }

  document.addEventListener("keydown", function (e) {
    var key = (e.key || "").toUpperCase();
    if (/^[A-Z]$/.test(key)) guess(key);
  });

  againBtn.addEventListener("click", newGame);

  newGame();
})();
