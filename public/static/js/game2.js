/*
 * MINI-GAME #2: "Villain Lockdown" -- The Daily Bugle "Bury Job" (a 404 hunt)
 * ===========================================================================
 * Loaded only on /game/2 (see templates/games/game2.html).
 *
 * The player browses a living fake Daily Bugle website (a DOM router; swaps the
 * innerHTML of #g2-screen -- window.location is NEVER touched) and tracks down
 * JJJ's buried Spider-Man scoop: a hidden 404. Landing on it and tapping CASE
 * CLOSED calls completeGame('2').
 *
 * WHY IT CAN'T BE BRUTE-FORCED: the buried file is genuinely UNLISTED -- there
 * is no link to it anywhere. A real 404 is a page nothing points at, so the only
 * way in is to know its exact CASE NUMBER (F-#### -- 10,000 possibilities) and
 * type it into the Archive's "morgue lookup". That number is hidden in prose, in
 * a spot that ROTATES each play (Opinion Corrections, the Home photo caption, a
 * City reader comment, or a News classified ad); Home only riddles at where --
 * it never names the section -- and 1-2 decoy case numbers are planted on OTHER
 * pages in an unrelated context, so spotting *a* number proves nothing. Every
 * Archive row also has its own real (if wrong) case number, openable from the
 * lookup, so guessing wastes a look, not a dead end. So you must actually READ
 * and reason to find the number -- spamming the list gets you nowhere.
 *
 * The Green Goblin heckles you; a ticker, ads and comments make the site feel
 * alive; a two-tier spider-sense hint (vague, then explicit) plus an absolute
 * stall-safety timer make sure nobody truly gets stuck. Asset-free, scoped g2-.
 */
(function () {
  "use strict";

  var HINT_DELAY_1 = 80000;
  var HINT_DELAY_2 = 150000;
  var ARCHIVE_HINT_DELAY_1 = 95000;
  var ARCHIVE_HINT_DELAY_2 = 165000;
  var STALL_SAFETY_DELAY = 180000;

  var SPIDEY_SVG =
    '<svg class="g2-spidey" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<line x1="100" y1="0" x2="100" y2="60" stroke="#f4f0e6" stroke-width="2.5"/>' +
    '<circle cx="100" cy="62" r="4" fill="#f4f0e6"/>' +
    '<g class="g2-swing-g">' +
    '<ellipse cx="100" cy="150" rx="62" ry="74" fill="#d3231d" stroke="#0a0a12" stroke-width="4"/>' +
    '<g stroke="#0a0a12" stroke-width="1.6" fill="none" opacity="0.85">' +
    '<path d="M100 78 V222"/><path d="M46 100 Q100 128 154 100"/><path d="M40 150 H160"/>' +
    '<path d="M46 200 Q100 172 154 200"/><path d="M62 88 Q100 150 62 212"/><path d="M138 88 Q100 150 138 212"/>' +
    '</g>' +
    '<path class="g2-eye" d="M52 200 C40 174 78 160 96 178 C100 196 78 214 52 200 Z" fill="#fff" stroke="#0a0a12" stroke-width="4"/>' +
    '<path class="g2-eye" d="M148 200 C160 174 122 160 104 178 C100 196 122 214 148 200 Z" fill="#fff" stroke="#0a0a12" stroke-width="4"/>' +
    '</g></svg>';

  var SKYLINE_SVG =
    '<svg class="g2-found-skyline" viewBox="0 0 470 160" preserveAspectRatio="none" aria-hidden="true"><g fill="#05030f">' +
    '<rect x="0" y="70" width="40" height="90"/><rect x="46" y="40" width="30" height="120"/>' +
    '<rect x="82" y="86" width="46" height="74"/><rect x="132" y="20" width="26" height="140"/>' +
    '<rect x="166" y="60" width="52" height="100"/><rect x="224" y="90" width="34" height="70"/>' +
    '<rect x="262" y="34" width="30" height="126"/><rect x="298" y="72" width="48" height="88"/>' +
    '<rect x="352" y="48" width="28" height="112"/><rect x="386" y="84" width="44" height="76"/>' +
    '<rect x="434" y="56" width="36" height="104"/></g></svg>';

  var TICKER = [
    "SPIDER-MAN: STILL A MENACE, says man who has never met him",
    "OSCORP DENIES EVERYTHING &mdash; again",
    "MAN ON 6 TRAIN SWEARS HE SAW A GIANT LIZARD",
    "AUNT MAY&#39;S WHEATCAKES: a Bugle investigation",
    "CITY HALL: &lsquo;the webs are not our problem&rsquo;",
    "PARKER STILL HASN&#39;T TURNED IN HIS PHOTOS",
    "RAVENCROFT INSTITUTE EXTENDS VISITING HOURS"
  ];
  var ADS = [
    { label: "Advertisement", head: "OSCORP", body: "Building a Better Tomorrow.&trade; (Please disregard the explosions.)" },
    { label: "Community", head: "F.E.A.S.T. Shelter", body: "Hot meals, open doors. Ask for Mr. Li." },
    { label: "Classified", head: "PARKER PHOTOGRAPHY", body: "Will photograph anything. Cheap. Desperate, even." },
    { label: "Notice", head: "RAVENCROFT INSTITUTE", body: "Now accepting&hellip; long-term guests." }
  ];
  var COMMENTS = [
    { user: "web_hater_99", text: "menace!!! lock him up &#128548;" },
    { user: "queens_mom", text: "he literally saved my cat. leave the kid alone" },
    { user: "finance_bro", text: "is THIS why my Oscorp stock tanked" },
    { user: "real_jjj", text: "SLANDER. Every word of it. I&#39;ll sue. &mdash; JJJ" }
  ];
  var GOBLIN_TAUNTS = [
    "Well, well&hellip; the wall-crawler&#39;s little errand-runner. That file&#39;s <i>unlisted</i> &mdash; no link, no button. You&#39;ll never reach it without the number. Hahaha!",
    "Snooping in the morgue? Clicking won&#39;t help you, gumshoe &mdash; that page isn&#39;t on the list. You need its case number. &#127875;",
    "Tick, tock. The scoop stays buried unless you can find the number I hid. Good luck <i>reading</i>."
  ];

  // where the case number hides this play; how Home points (a riddle, not a
  // named tab -- the player has to connect it to a section themselves); the
  // two-tier hint text (nudge = vague stage-1, msg = explicit stage-2)
  var CLUES = {
    corrections: {
      section: "opinion",
      ptr: "somewhere in the fine print where this paper&#39;s forced to eat its own words &mdash; right next to my own two cents on everything",
      target: '#g2-nav [data-goto="opinion"]',
      nudge: "Something about where Jonah&#39;s made to admit fault is nagging at you&hellip; worth a second look.",
      msg: "Jonah slipped it into the Corrections &mdash; read the Opinion page&hellip;",
      where: "in the Opinion Corrections"
    },
    caption: {
      section: "home",
      ptr: "closer than you&#39;d think &mdash; practically under my own nose, right here on this very page",
      target: '#g2-nav [data-goto="home"]',
      nudge: "Your spider-sense says the answer&#39;s hiding in plain sight, closer than you&#39;d guess&hellip;",
      msg: "It&#39;s in the photo caption, right on the front page&hellip;",
      where: "under the front-page photo"
    },
    comment: {
      section: "city",
      ptr: "let slip by one of these mouthy New Yorkers grumbling about their own block &mdash; same place I let the public grumble right back at me",
      target: '#g2-nav [data-goto="city"]',
      nudge: "Somebody&#39;s been running their mouth about this somewhere&hellip; keep your ears open.",
      msg: "A reader quoted it &mdash; read the City comments&hellip;",
      where: "in a City reader comment"
    },
    ad: {
      section: "news",
      ptr: "printed in a classified some fool paid good money for, tucked between the day&#39;s dispatches from every borough",
      target: '#g2-nav [data-goto="news"]',
      nudge: "Somebody paid to advertise this, buried in the everyday print&hellip;",
      msg: "Somebody ran an ad about it &mdash; check the News classifieds&hellip;",
      where: "in a News classified ad"
    }
  };

  // ---- runtime state ----------------------------------------------------
  var app, screen, urlBar, nav, dateEl;
  var hintTimer1 = null, hintTimer2 = null, stallTimer = null, urlTyper = null, won = false, goblinShown = false;
  var buriedCase = "", buriedNum = 0, buriedSlug = "", archiveRows = [], decoyNums = {}, clueSpot = "corrections", lookupWrongs = 0, goblinTaunted = false, currentPageId = "home";

  function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[ri(0, arr.length - 1)]; }
  function caseTag(str) { return '<span class="g2-case">' + (str || buriedCase) + "</span>"; }

  var NORMAL_TITLES = [
    "Rhino escapes zoo, blames &ldquo;the wall&rdquo;",
    "Aunt&#39;s bake sale raises $412 for shelter",
    "Web-fluid: miracle adhesive or menace?",
    "Oscorp unveils Q3 &ldquo;synergy&rdquo; initiative",
    "Subway &ldquo;lizard&rdquo; sightings: MTA responds",
    "Coffee-cart turf war grips Midtown",
    "Bugle wins libel suit &mdash; again",
    "Times Square billboard glitches, day 3",
    "Harbor ferry breaks its own record",
    "Op-ed: Vigilantes are ruining this city"
  ];

  function redactBars() {
    var n = ri(3, 4), out = "[RETRACTED] ";
    for (var i = 0; i < n; i++) out += '<span class="g2-redact" style="width:' + ri(22, 48) + 'px"></span>';
    return out;
  }

  function buildPuzzle() {
    var used = {};
    function uniqNum() { var n; do { n = ri(1000, 9999); } while (used[n]); used[n] = 1; return n; }

    buriedNum = uniqNum();
    buriedCase = "F-" + buriedNum;
    buriedSlug = "retracted-file-" + buriedNum;
    clueSpot = pick(["corrections", "caption", "comment", "ad"]);
    lookupWrongs = 0;
    goblinTaunted = false;

    // 1-2 decoy case numbers, planted on OTHER sections in a context that's
    // clearly unrelated to the Spider-Man scoop on a careful read -- so
    // spotting *a* case number isn't proof it's the one Home pointed to.
    var others = ["corrections", "caption", "comment", "ad"].filter(function (k) { return k !== clueSpot; });
    for (var o = others.length - 1; o > 0; o--) { var oj = ri(0, o); var ot = others[o]; others[o] = others[oj]; others[oj] = ot; }
    decoyNums = {};
    var decoyCount = ri(1, 2);
    for (var d = 0; d < decoyCount; d++) decoyNums[others[d]] = uniqNum();

    // The buried file is UNLISTED, and every visible row has its own real
    // case number -- but none of them is the buried file, so scanning,
    // clicking, or looking one up can only ever reach a decoy, never the 404.
    var rows = [];
    var titles = NORMAL_TITLES.slice();
    for (var s = titles.length - 1; s > 0; s--) { var j = ri(0, s); var t = titles[s]; titles[s] = titles[j]; titles[j] = t; }
    for (var i = 0; i < 9; i++) rows.push({ type: "normal", title: titles[i], caseStr: "F-" + uniqNum() });
    for (var r = 0; r < 4; r++) rows.push({ type: "sealed", title: redactBars(), caseStr: "F-" + uniqNum() });
    for (var k = rows.length - 1; k > 0; k--) { var m = ri(0, k); var tmp = rows[k]; rows[k] = rows[m]; rows[m] = tmp; }
    archiveRows = rows;

    armStallTimer();
  }

  // ---- content builders -------------------------------------------------
  function teaser(title, goto) {
    return '<div class="g2-row"><div class="g2-row-main"><div class="g2-row-title">' + title +
      '</div></div><button type="button" class="g2-view" data-goto="' + goto + '">Read</button></div>';
  }
  function adBox(ad, isClue) {
    return '<div class="g2-ad"' + (isClue ? ' id="g2-clue"' : '') + '>' +
      '<span class="g2-ad-label">' + ad.label + '</span>' +
      '<div class="g2-ad-head">' + ad.head + '</div>' +
      '<div class="g2-ad-body">' + ad.body + '</div></div>';
  }
  function commentRow(c, isClue) {
    return '<div class="g2-comment"' + (isClue ? ' id="g2-clue"' : '') + '>' +
      '<div class="g2-comment-av">' + c.user.charAt(0).toUpperCase() + '</div>' +
      '<div><span class="g2-comment-user">@' + c.user + '</span> ' + c.text + '</div></div>';
  }

  // ---- pages ------------------------------------------------------------
  var PAGES = {
    home: {
      url: "dailybugle.web",
      html: function () {
        var capClue = clueSpot === "caption";
        return (
          '<div class="g2-mission"><span aria-hidden="true">&#128373;&#65039;</span>' +
            '<div><b>FROM THE EDITOR&#39;S DESK:</b> Some saboteur pulled my Spider-Man exclusive to ' +
            'the <b>morgue</b> and scrubbed every link to it &mdash; you can only pull it by its ' +
            '<b>case number</b>. I saw that number ' + CLUES[clueSpot].ptr + '. Find it, then punch it ' +
            'into the <b>Archive</b>&#39;s file lookup.</div></div>' +
          '<div class="g2-kicker">Exclusive &bull; Front Page</div>' +
          '<h1 class="g2-headline">Spider-Man: Threat or Menace?</h1>' +
          '<div class="g2-byline">By J. Jonah Jameson, Editor-in-Chief</div>' +
          '<div class="g2-photo">[ Exclusive Photo &mdash; Pulled for Review ]</div>' +
          '<div class="g2-caption"' + (capClue ? ' id="g2-clue"' : '') + '>' +
            (capClue ? "Photo pulled to morgue, cat. no. " + caseTag() + " &mdash; pending retraction"
                     : "Photo removed pending retraction &mdash; filed to the morgue") + '</div>' +
          '<div class="g2-body"><p>I had that masked menace dead to rights. Now the file is buried ' +
            'in our own archive, unlisted, and nobody will hand me the number. Unbelievable.</p></div>' +
          adBox(ADS[0], false) +
          '<div class="g2-section-label">More From Today</div>' +
          teaser("City Council debates web-fluid cleanup costs", "story") +
          teaser("Oscorp stock soars on &ldquo;synergy&rdquo; buzz", "story") +
          (decoyNums.caption
            ? teaser("Metro parking dispute drags into month three, case " + caseTag("F-" + decoyNums.caption) + " still under review", "story")
            : teaser("Best pretzel cart in Queens? We ranked them", "story"))
        );
      }
    },

    news: {
      url: "dailybugle.web/news",
      html: function () {
        var adClue = clueSpot === "ad";
        return (
          '<div class="g2-kicker">City News</div>' +
          '<h1 class="g2-headline">Around the Boroughs</h1>' +
          '<div class="g2-byline">The latest from the five boroughs</div>' +
          teaser("Subway delays blamed on &ldquo;giant lizard&rdquo;", "story") +
          teaser("Web-fluid cleanup bill hits City Hall", "story") +
          teaser("Oscorp opens third Manhattan lab", "story") +
          (adClue ? adBox({ label: "Classified", head: "LOST: ONE PRESS FILE",
              body: "Retracted photo file, catalogue no. " + caseTag() + ". If found, do NOT return it to J. Jameson." }, true)
                  : decoyNums.ad
                    ? adBox({ label: "Classified", head: "LOST DOG: MAX",
                        body: "Answers to &ldquo;Max.&rdquo; Reward if found. Ref. case " + caseTag("F-" + decoyNums.ad) + " with the pound." }, false)
                    : adBox(ADS[2], false)) +
          '<div class="g2-note">Editor&#39;s note: retracted files are unlisted &mdash; open them from the ' +
            'Archive by their case number.</div>'
        );
      }
    },

    city: {
      url: "dailybugle.web/city",
      html: function () {
        var comClue = clueSpot === "comment";
        var out =
          '<div class="g2-kicker">City Life</div>' +
          '<h1 class="g2-headline">The Big Apple, Daily</h1>' +
          '<div class="g2-byline">Food, culture, and complaining about rent</div>' +
          teaser("We ranked every dollar-slice in Manhattan", "story") +
          teaser("Rooftop gardens are the new penthouse", "story") +
          '<div class="g2-section-label">Letters &amp; Comments</div><div class="g2-comments">';
        out += commentRow(COMMENTS[0], false);
        out += commentRow(comClue
          ? { user: "morgue_intern", text: "lol they filed the spidey photo as cat. no. " + caseTag() + " and just left it unlisted in the archive" }
          : decoyNums.comment
            ? { user: "landlord_hater", text: "my noise complaint against 4B&#39;s been open since March, case " + caseTag("F-" + decoyNums.comment) + ", nobody at 311 cares" }
            : COMMENTS[1], comClue);
        out += commentRow(COMMENTS[2], false);
        out += "</div>";
        return out;
      }
    },

    opinion: {
      url: "dailybugle.web/opinion",
      html: function () {
        var corrClue = clueSpot === "corrections";
        return (
          '<div class="g2-kicker">Opinion &amp; Editorial</div>' +
          '<h1 class="g2-headline">Why I&#39;m Always Right</h1>' +
          '<div class="g2-byline">By J. Jonah Jameson</div>' +
          '<div class="g2-body"><p>Every so often the lawyers make me print a &ldquo;correction.&rdquo; ' +
            'I&#39;ve never been wrong a day in my life &mdash; but rules are rules, so here they are, ' +
            'buried at the bottom where they belong.</p></div>' +
          '<div class="g2-section-label">Corrections &amp; Retractions</div>' +
          (corrClue
            ? '<div class="g2-corrections" id="g2-clue"><span class="g2-corr-label">&#9888; Pending Retraction Review</span>' +
                'The Bugle has pulled and unlisted one report pending review &mdash; catalogued ' + caseTag() +
                ', subject: the wall-crawler &mdash; and its headline is struck from the public record.</div>'
            : decoyNums.corrections
              ? '<div class="g2-corrections"><span class="g2-corr-label">Correction</span>' +
                  'We misidentified the winner of Tuesday&#39;s county-fair hot-dog-eating contest &mdash; the file&#39;s ' +
                  'been reopened for review, catalogue ' + caseTag("F-" + decoyNums.corrections) + '. The Bugle regrets the error.</div>'
              : '<div class="g2-corrections"><span class="g2-corr-label">Correction</span>' +
                  'Tuesday&#39;s edition misspelled the Mayor&#39;s name. It also misspelled &ldquo;menace.&rdquo; ' +
                  'We regret nothing.</div>') +
          '<div class="g2-note">Retracted files are unlisted &mdash; open them from the <b>Archive</b> by ' +
            'their case number.</div>'
        );
      }
    },

    archive: {
      url: "dailybugle.web/archive",
      html: function () {
        var out =
          '<div class="g2-kicker">The Morgue</div>' +
          '<h1 class="g2-headline">Filed Reports</h1>' +
          '<div class="g2-byline">Retracted files are unlisted &mdash; pull them by case number</div>' +
          '<div class="g2-lookup" id="g2-lookup">' +
            '<div class="g2-lookup-label">&#128269; Morgue file lookup</div>' +
            '<div class="g2-lookup-row"><span class="g2-lookup-prefix">F-</span>' +
              '<input class="g2-lookup-input" id="g2-lookup-input" type="text" inputmode="numeric" ' +
                'maxlength="4" placeholder="0000" autocomplete="off" aria-label="case number">' +
              '<button type="button" class="g2-lookup-btn" data-goto="pull">Pull</button></div>' +
            '<div class="g2-lookup-msg" id="g2-lookup-msg"></div>' +
          '</div>' +
          '<div class="g2-section-label">On the record</div>';
        for (var i = 0; i < archiveRows.length; i++) {
          var row = archiveRows[i];
          if (row.type === "normal") {
            out += '<div class="g2-row"><div class="g2-row-main"><div class="g2-row-title">' + row.title +
              '</div><div class="g2-row-meta">Case ' + row.caseStr + ' &middot; filed</div></div>' +
              '<button type="button" class="g2-view" data-goto="story">Open</button></div>';
          } else {
            out += '<div class="g2-row g2-retracted"><div class="g2-row-main"><div class="g2-row-title">' + row.title +
              '</div><div class="g2-row-meta">Case ' + row.caseStr + ' &middot; unlisted</div></div>' +
              '<button type="button" class="g2-view g2-view-sealed" data-goto="sealed">Sealed</button></div>';
          }
        }
        out += adBox(ADS[1], false);
        return out;
      }
    },

    story: {
      url: "dailybugle.web/archive/story",
      html: function () {
        return (
          '<div class="g2-kicker">Archived Story</div>' +
          '<h1 class="g2-headline">Just an old clipping</h1>' +
          '<div class="g2-body"><p>This isn&#39;t the buried Spider-Man file &mdash; nothing to see. ' +
            'The scoop you want was <i>retracted and unlisted</i>: no link points to it. You can only ' +
            'reach it by pulling its case number in the morgue.</p></div>' +
          '<div class="g2-comments">' + commentRow(COMMENTS[3], false) + commentRow(COMMENTS[1], false) + '</div>' +
          '<button type="button" class="g2-cta" data-goto="archive">&larr; Back to the Archive</button>'
        );
      }
    },

    // clicking a listed retracted row -> it can't be opened from the list
    sealed: {
      url: "dailybugle.web/archive/sealed",
      html: function () {
        return (
          '<div class="g2-sealed-taunt"><div class="g2-sealed-face" aria-hidden="true">&#127875;</div>' +
            '<div class="g2-kicker">Access Sealed</div>' +
            '<h1 class="g2-headline">No Link. No Button.</h1></div>' +
          '<div class="g2-body"><p><b>&ldquo;Clicking won&#39;t help you, web-head!&rdquo;</b> cackles a voice. ' +
            'Retracted files are <i>unlisted</i> &mdash; you can&#39;t open one from the list. Find its exact ' +
            'case number in today&#39;s paper, then punch it into the <b>morgue lookup</b>.</p></div>' +
          '<button type="button" class="g2-cta" data-goto="archive">&larr; Back to the Archive</button>'
        );
      }
    },

    notfound: {
      url: function () { return "dailybugle.web/morgue/" + buriedSlug; },
      html: function () {
        return (
          '<div class="g2-404">' + SKYLINE_SVG + SPIDEY_SVG +
            '<div class="g2-404-code">404</div>' +
            '<div class="g2-404-title">Page Not Found</div>' +
            '<p class="g2-404-copy">&hellip;but you found <b>me.</b> This is the scoop Jonah tried ' +
              'to bury &mdash; and I hear the Goblin&#39;s hopping mad you dug up the number. Nice work, kid.</p>' +
            '<p class="g2-404-sign">&mdash; your friendly neighborhood Spider-Man</p>' +
            '<button type="button" class="g2-win" id="g2-win">Case Closed &#10003;</button>' +
          '</div>'
        );
      }
    }
  };

  var ACTIVE_FOR = { story: "archive", sealed: "archive" };

  // ---- hint scheduling (adapts to where the clue hides) -----------------
  function pageHint(pageId, tier) {
    var c = CLUES[clueSpot];
    if (pageId === "archive") {
      return tier === 2
        ? { sel: "#g2-lookup", msg: "&#128374; The number&#39;s " + c.where + " &mdash; go read it, then type it in here.", delay: ARCHIVE_HINT_DELAY_2, strong: true }
        : { sel: "#g2-lookup", msg: "&#128374; Type the case number here once you&#39;ve tracked it down&hellip;", delay: ARCHIVE_HINT_DELAY_1 };
    }
    if (pageId === c.section) {
      return { sel: "#g2-clue", msg: "&#128374; There&#39;s the case number &mdash; now punch it into the Archive lookup&hellip;", delay: HINT_DELAY_1 };
    }
    return {
      sel: c.target,
      msg: tier === 2 ? "&#128374; " + c.msg : "&#128374; " + c.nudge,
      delay: tier === 2 ? HINT_DELAY_2 : HINT_DELAY_1,
      strong: tier === 2
    };
  }

  // ---- juice: typing omnibox + page-turn --------------------------------
  function setUrl(text) {
    if (urlTyper) { clearInterval(urlTyper); urlTyper = null; }
    function frame(n) {
      var shown = text.slice(0, n), slash = shown.indexOf("/");
      var html = slash === -1 ? "<b>" + shown + "</b>" : "<b>" + shown.slice(0, slash) + "</b>" + shown.slice(slash);
      urlBar.innerHTML = html + (n < text.length ? '<span class="g2-caret">&#9613;</span>' : "");
    }
    var i = 0; frame(0);
    urlTyper = setInterval(function () {
      i++; frame(i);
      if (i >= text.length) { clearInterval(urlTyper); urlTyper = null; }
    }, 13);
  }
  function playTurn() { screen.classList.remove("g2-turn"); void screen.offsetWidth; screen.classList.add("g2-turn"); }
  function pulseLoadbar() { app.classList.remove("is-loading"); void app.offsetWidth; app.classList.add("is-loading"); }

  function showHint(h) {
    var target = app.querySelector(h.sel);
    if (!target || won) return;
    target.classList.add("g2-hint");
    target.classList.toggle("g2-hint-strong", !!h.strong);
    var cap = document.getElementById("g2-tingle-cap");
    if (cap) cap.innerHTML = h.msg;
    app.classList.add("is-tingling");
    app.classList.toggle("is-tingling-strong", !!h.strong);
  }
  function clearHint() {
    if (hintTimer1) { clearTimeout(hintTimer1); hintTimer1 = null; }
    if (hintTimer2) { clearTimeout(hintTimer2); hintTimer2 = null; }
    app.classList.remove("is-tingling", "is-tingling-strong");
    var lit = app.querySelectorAll(".g2-hint, .g2-hint-strong");
    for (var i = 0; i < lit.length; i++) lit[i].classList.remove("g2-hint", "g2-hint-strong");
  }
  function armHint(pageId) {
    if (pageId === "notfound") return;
    var h1 = pageHint(pageId, 1);
    hintTimer1 = setTimeout(function () { showHint(h1); }, h1.delay);
    var h2 = pageHint(pageId, 2);
    if (h2.delay !== h1.delay) hintTimer2 = setTimeout(function () { showHint(h2); }, h2.delay);
  }
  // absolute ceiling independent of per-page navigation: clearHint() resets
  // hintTimer1/2 on every go(), so a player bouncing between tabs faster than
  // HINT_DELAY_1 could otherwise never see a hint at all. Armed once per
  // puzzle and never cleared by navigation, so nobody can truly stall.
  function armStallTimer() {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(function () {
      if (won) return;
      showHint(pageHint(currentPageId, 2));
    }, STALL_SAFETY_DELAY);
  }

  // ---- Green Goblin heckler ---------------------------------------------
  function showGoblin(msg) {
    var g = document.getElementById("g2-goblin"), m = document.getElementById("g2-goblin-msg");
    if (!g || !m || won) return;
    m.innerHTML = msg;
    g.classList.add("is-open");
  }
  function hideGoblin() { var g = document.getElementById("g2-goblin"); if (g) g.classList.remove("is-open"); }

  function setActiveTab(pageId) {
    var active = ACTIVE_FOR[pageId] || pageId;
    var tabs = nav.querySelectorAll(".g2-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("is-active", tabs[i].dataset.goto === active);
  }

  // ---- the morgue lookup (the ONLY way to the buried 404) ---------------
  function doPull() {
    var inp = document.getElementById("g2-lookup-input");
    if (!inp) return;
    var val = (inp.value || "").replace(/\D/g, "");
    var msg = document.getElementById("g2-lookup-msg");
    if (val === String(buriedNum)) { go("notfound"); return; }

    // A real, filed case number that just isn't the buried one -- open it
    // like clicking its own row would, instead of a blanket "no match" that
    // wastes the player's time on a file that does actually exist.
    var hit = null;
    for (var i = 0; i < archiveRows.length; i++) {
      if (archiveRows[i].caseStr === "F-" + val) { hit = archiveRows[i]; break; }
    }
    if (hit) { go(hit.type === "sealed" ? "sealed" : "story"); return; }

    lookupWrongs++;
    var box = document.getElementById("g2-lookup");
    if (box) { box.classList.remove("g2-shake"); void box.offsetWidth; box.classList.add("g2-shake"); }
    if (msg) msg.textContent = val ? "No file matches #F-" + val + " in the morgue." : "Enter the 4-digit case number.";
    if (lookupWrongs >= 3 && !goblinTaunted) {
      goblinTaunted = true;
      showGoblin("Still <i>guessing</i>, gumshoe? Ten thousand numbers and you&#39;re stabbing in the dark. The real one&#39;s printed in today&#39;s paper &mdash; if you&#39;d bother to READ it. &#127875;");
    }
  }

  function go(pageId) {
    var page = PAGES[pageId];
    if (!page || won) return;
    currentPageId = pageId;
    clearHint();
    app.classList.toggle("is-404", pageId === "notfound");
    screen.innerHTML = page.html();
    screen.scrollTop = 0;
    playTurn();
    setUrl(typeof page.url === "function" ? page.url() : page.url);
    setActiveTab(pageId);
    pulseLoadbar();
    armHint(pageId);
    if (pageId === "archive") {
      var inp = document.getElementById("g2-lookup-input");
      if (inp) inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doPull(); } });
      if (!goblinShown) { goblinShown = true; setTimeout(function () { showGoblin(pick(GOBLIN_TAUNTS)); }, 520); }
    }
  }

  function win() {
    if (won) return;
    won = true;
    clearHint();
    if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    var btn = document.getElementById("g2-win");
    if (btn) { btn.disabled = true; btn.textContent = "Webbing up…"; }
    app.classList.add("is-won");
    setTimeout(function () {
      completeGame("2");
      // completeGame() (game.js) navigates away on success; on failure it only
      // re-enables the default #complete-btn, which this game replaces. If we're
      // still here a few seconds later the submit failed -- restore the button so
      // the player can retry instead of being stranded. `won` blocks a double-submit.
      setTimeout(function () {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = "Case Closed ✓";
        app.classList.remove("is-won");
        won = false;
      }, 2600);
    }, 800);
  }

  function onTap(evt) {
    var el = evt.target.closest("[data-goto], #g2-win");
    if (!el) return;
    evt.preventDefault();
    if (el.id === "g2-win") { win(); return; }
    var dest = el.dataset.goto;
    if (dest === "pull") { doPull(); return; }
    go(dest);
  }

  function setDate() {
    if (!dateEl) return;
    try {
      var d = new Date();
      var mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
      dateEl.textContent = "Late City Edition · " + mon + " " + d.getDate();
    } catch (e) { /* keep static fallback */ }
  }

  function buildTicker() {
    var track = document.getElementById("g2-ticker-track");
    if (!track) return;
    var one = "";
    for (var i = 0; i < TICKER.length; i++) one += '<span style="padding:0 22px">&#9670; ' + TICKER[i] + "</span>";
    track.innerHTML = one + one;
    // duration is derived from the actual rendered width of one copy so the
    // loop always completes a clean pass regardless of ticker content length
    // (a fixed duration would drift out of sync with -50% and visibly jump).
    var TICKER_SPEED_PX_S = 45;
    var oneCopyWidth = track.scrollWidth / 2;
    var duration = oneCopyWidth / TICKER_SPEED_PX_S;
    track.style.animationDuration = (isFinite(duration) && duration > 0 ? duration : 18) + "s";
  }

  function wireEasterEgg() {
    var mh = document.getElementById("g2-masthead");
    if (!mh) return;
    var clicks = 0, timer = null;
    mh.addEventListener("click", function () {
      clicks++;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { clicks = 0; }, 1200);
      if (clicks >= 3) {
        clicks = 0;
        var t = document.getElementById("g2-jjj-toast");
        if (t) { t.classList.remove("is-show"); void t.offsetWidth; t.classList.add("is-show"); }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    app = document.getElementById("g2-app");
    if (!app) return;
    screen = document.getElementById("g2-screen");
    urlBar = document.getElementById("g2-url");
    nav = document.getElementById("g2-nav");
    dateEl = document.getElementById("g2-date");
    if (!screen || !urlBar || !nav) return;

    buildPuzzle();
    buildTicker();
    setDate();
    wireEasterEgg();

    app.addEventListener("click", onTap);
    var goblin = document.getElementById("g2-goblin");
    if (goblin) goblin.addEventListener("click", function (e) {
      if (e.target === goblin || e.target.id === "g2-goblin-x") hideGoblin();
    });

    go("home");
  });
})();
