/*
 * MINI-GAME #2: "Villain Lockdown" -- The Daily Bugle "Bury Job" (a 404 hunt)
 * ===========================================================================
 * Loaded only on /game/2 (see templates/games/game2.html).
 *
 * The player browses a living fake Daily Bugle website (a DOM router; swaps the
 * innerHTML of #g2-screen -- window.location is NEVER touched) and tracks down
 * JJJ's buried Spider-Man scoop: a hidden 404. Landing on it IS the solve --
 * no confirmation click. A "Case Closed" stamp animates in, then it auto-calls
 * completeGame('2') and hands off to the next challenge.
 *
 * WHY IT CAN'T BE BRUTE-FORCED: the buried file is genuinely UNLISTED -- there
 * is no link to it anywhere. A real 404 is a page nothing points at, so the only
 * way in is to know its exact CASE NUMBER (F-#### -- 10,000 possibilities) and
 * type it into the Archive's "morgue lookup".
 *
 * v6: the case number is torn in HALF. The first two digits and the last two
 * digits are hidden by two INDEPENDENT carriers, chosen fresh every play from a
 * pool of five: three text clues (Opinion Corrections / a City reader comment /
 * a News classified ad) and two interactive ones (hold the front-page photo
 * down to "develop" it; hold down [RETRACTED] archive bars until one gives).
 * Exactly one text carrier + one interactive carrier are picked each round, and
 * which one gets the prefix vs. the suffix is random too -- so it's never pure
 * reading and never pure fumbling, and never the same hiding spot twice running.
 * A case-tag strip (hidden until the first half surfaces) fills in as each half
 * is found (F-2?-- then F-2705), and the win screen recaps both sources.
 * Decoys: the two unused text carriers always carry an unrelated 2-digit "ref"
 * number in unrelated prose, and the unused interactive carrier always reacts
 * to a hold too (a joke instead of a real fragment) -- so trying any of them is
 * never itself a tell for which ones are real this round.
 *
 * The Green Goblin heckles you; a ticker, ads and comments make the site feel
 * alive; a two-tier spider-sense hint (vague, then explicit) per missing half,
 * plus an absolute stall-safety timer, make sure nobody truly gets stuck.
 * Asset-free (CSS + inline SVG), scoped g2-.
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

  // live ticker flashes: the breaking-news strip reacts to what the player
  // just did, so the site feels alive without adding any new UI surface or
  // extra reading -- it's peripheral flavor, easy to ignore.
  var TICKER_WRONG_FLASHES = [
    "MYSTERY SLEUTH STRIKES OUT AGAIN AT THE MORGUE",
    "MORGUE CLERK: &lsquo;still no luck out there, still guessing&rsquo;",
    "ANOTHER WRONG NUMBER PUNCHED INTO THE ARCHIVE"
  ];
  var TICKER_DECOY_FLASHES = [
    "DEAD-END FILE SURFACES AT THE MORGUE, SOURCES SAY",
    "ANOTHER RETRACTED REPORT PULLED &mdash; WRONG ONE",
    "MORGUE TRAFFIC UP AS SOMEONE DIGS THROUGH OLD FILES"
  ];
  var TICKER_GOBLIN_FLASHES = [
    "GREEN GOBLIN SPOTTED LURKING NEAR BUGLE OFFICES",
    "WITNESSES REPORT CACKLING HEARD OVER MIDTOWN, AGAIN",
    "OSCORP DECLINES TO COMMENT ON GOBLIN SIGHTING"
  ];
  var TICKER_FRAGMENT_FLASHES = [
    "PIECE OF FILE SURFACES AT THE MORGUE, SOURCES SAY",
    "HALF THE STORY RESURFACES, JONAH DEMANDS THE REST",
    "MORGUE CLERK CONFIRMS: &lsquo;SOMETHING&#39;S COME LOOSE&rsquo;"
  ];
  var TICKER_MATCH_FLASHES = [
    "BOTH HALVES OF THE FILE FINALLY MATCH UP",
    "MYSTERY SLEUTH ASSEMBLES THE FULL CASE NUMBER",
    "THE PIECES FIT &mdash; MORGUE LOOKUP INCOMING"
  ];

  // ---- the five possible carriers for a fragment (one text pool member +
  // one interactive pool member are chosen each puzzle -- see buildPuzzle()).
  // `ptr` is the riddle Home uses (never names the section); `nudge`/`msg` are
  // the two-tier off-page hints; `foundSel` is what gets outlined once the
  // player is on the right page; `where`/`target` back the Archive-page hint.
  var CARRIER_INFO = {
    corrections: {
      section: "opinion",
      target: '#g2-nav [data-goto="opinion"]',
      foundSel: "#g2-clue",
      ptr: "somewhere in the fine print where this paper&#39;s forced to eat its own words &mdash; right next to my own two cents on everything",
      nudge: "Something about where Jonah&#39;s made to admit fault is nagging at you&hellip; worth a second look.",
      msg: "Jonah slipped it into the Corrections &mdash; read the Opinion page&hellip;",
      where: "in the Opinion Corrections"
    },
    comment: {
      section: "city",
      target: '#g2-nav [data-goto="city"]',
      foundSel: "#g2-clue",
      ptr: "let slip by one of these mouthy New Yorkers grumbling about their own block &mdash; same place I let the public grumble right back at me",
      nudge: "Somebody&#39;s been running their mouth about this somewhere&hellip; keep your ears open.",
      msg: "A reader quoted it &mdash; read the City comments&hellip;",
      where: "in a City reader comment"
    },
    ad: {
      section: "news",
      target: '#g2-nav [data-goto="news"]',
      foundSel: "#g2-clue",
      ptr: "printed in a classified some fool paid good money for, tucked between the day&#39;s dispatches from every borough",
      nudge: "Somebody paid to advertise this, buried in the everyday print&hellip;",
      msg: "Somebody ran an ad about it &mdash; check the News classifieds&hellip;",
      where: "in a News classified ad"
    },
    photo: {
      section: "home",
      target: '#g2-nav [data-goto="home"]',
      foundSel: "#g2-photo",
      ptr: "closer than you&#39;d think &mdash; practically under my own nose. Try holding down on that ruined front-page photo and give it a second to develop",
      nudge: "That ruined front-page photo of mine&hellip; try holding it down like you&#39;re coaxing an old Polaroid.",
      msg: "Press and hold the front-page photo &mdash; give it a moment to develop&hellip;",
      where: "under the front-page photo (press and hold it)"
    },
    redact: {
      section: "archive",
      target: '#g2-nav [data-goto="archive"]',
      foundSel: "#g2-lookup",
      ptr: "sitting in plain sight in the Archive, hiding under one of those blacked-out bars &mdash; you&#39;ll have to lean on the right one",
      nudge: "One of those retracted bars in the Archive isn&#39;t just for show&hellip; try holding a few down.",
      msg: "One specific [RETRACTED] bar in the Archive is hiding it &mdash; hold bars down until one gives.",
      where: "under one of the [RETRACTED] bars in the Archive (press and hold it)"
    }
  };
  var CARRIER_ICON = { corrections: "&#128240;", comment: "&#128172;", ad: "&#128227;", photo: "&#128248;", redact: "&#128193;" };
  var CARRIER_LABEL = { corrections: "Corrections", comment: "City Comments", ad: "Classifieds", photo: "Developed Photo", redact: "Redacted Bar" };

  // ---- runtime state ----------------------------------------------------
  var app, screen, urlBar, nav, dateEl;
  var hintTimer1 = null, hintTimer2 = null, stallTimer = null, urlTyper = null, won = false, goblinShown = false;
  var buriedCase = "", buriedNum = 0, buriedSlug = "", archiveRows = [], decoyNums = {},
    lookupWrongs = 0, goblinTaunted = false, currentPageId = "home";
  var prefixStr = "", suffixStr = "", proseCarrier = "corrections", trickCarrier = "photo",
    prefixCarrier = "corrections", suffixCarrier = "photo", fragPrefixFound = false, fragSuffixFound = false;
  var tickerItems = TICKER.slice();

  function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[ri(0, arr.length - 1)]; }
  function caseTag(str) { return '<span class="g2-case">' + (str || buriedCase) + "</span>"; }

  // ---- sound: tiny synthesized WebAudio blips, no asset files -----------
  // Muting persists per-device (a shared event phone shouldn't relearn the
  // preference every play) and audio only ever plays from a user gesture
  // (tap handlers), so autoplay policies never block it.
  var audioCtx = null, muted = false;
  try { muted = localStorage.getItem("g2-muted") === "1"; } catch (e) { /* private mode etc -- default unmuted */ }
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }
  function beep(freq, dur, type, delay, peak) {
    if (muted) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak || 0.05, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function sfxWrong() { beep(160, 0.16, "sawtooth", 0, 0.05); beep(105, 0.22, "sawtooth", 0.08, 0.05); }
  function sfxDecoyOpen() { beep(320, 0.09, "square", 0, 0.035); beep(230, 0.13, "square", 0.07, 0.035); }
  function sfxGoblin() { beep(130, 0.09, "sawtooth", 0, 0.05); beep(190, 0.09, "sawtooth", 0.09, 0.05); beep(95, 0.18, "sawtooth", 0.18, 0.05); }
  function sfxFound() { beep(392, 0.1, "triangle", 0, 0.05); beep(587.33, 0.22, "triangle", 0.09, 0.055); }
  function sfxWin() { beep(523.25, 0.11, "square", 0, 0.05); beep(659.25, 0.11, "square", 0.1, 0.05); beep(783.99, 0.24, "square", 0.2, 0.06); }
  function sfxFragment() { beep(440, 0.09, "triangle", 0, 0.045); beep(659.25, 0.14, "triangle", 0.07, 0.05); }
  function sfxMatch() { beep(659.25, 0.09, "square", 0, 0.05); beep(880, 0.09, "square", 0.08, 0.05); beep(1046.5, 0.18, "square", 0.16, 0.055); }
  function setMuteUI() {
    var btn = document.getElementById("g2-mute");
    if (!btn) return;
    btn.innerHTML = muted ? "&#128263;" : "&#128266;";
    btn.classList.toggle("is-muted", muted);
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
  }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem("g2-muted", muted ? "1" : "0"); } catch (e) { /* ignore */ }
    setMuteUI();
    if (!muted) beep(500, 0.05, "square", 0, 0.04);
  }

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

  // words hidden under most black bars -- purely decorative (holding one down
  // just "declassifies" a joke word). When this round's interactive carrier is
  // "redact", exactly one bar in one row secretly hides a real digit-pair
  // fragment instead -- same styling, same interaction, no visual tell.
  var REDACT_WORDS = [
    "MENACE", "WALL-CRAWLER", "WEB-FLUID", "OSCORP", "THE MASK", "VIGILANTE",
    "THE SUIT", "GOBLIN", "THE PHOTO", "COSTUME", "THE WEBS", "TRACKER", "MJ", "GG"
  ];
  function redactBars(fragValue) {
    var n = ri(3, 4), out = "[RETRACTED] ";
    var fragIdx = fragValue ? ri(0, n - 1) : -1;
    for (var i = 0; i < n; i++) {
      if (i === fragIdx) {
        out += '<span class="g2-redact" data-frag="1" tabindex="0" role="button" aria-label="Hold to declassify">' +
          '<span class="g2-redact-word">' + fragValue + '</span><span class="g2-redact-cover"></span></span>';
      } else {
        out += '<span class="g2-redact" tabindex="0" role="button" aria-label="Hold to declassify">' +
          '<span class="g2-redact-word">' + pick(REDACT_WORDS) + '</span><span class="g2-redact-cover"></span></span>';
      }
    }
    return out;
  }

  var PHOTO_JOKES = [
    "Just Aunt May&#39;s meatloaf recipe, splattered across the negative.",
    "A blurry pigeon. Definitely not evidence of anything.",
    "Static. Somebody left the darkroom light on again.",
    "A parking ticket. Jonah&#39;s, apparently."
  ];

  function buildPuzzle() {
    var used = {};
    function uniqNum() { var n; do { n = ri(1000, 9999); } while (used[n]); used[n] = 1; return n; }

    buriedNum = uniqNum();
    buriedCase = "F-" + buriedNum;
    buriedSlug = "retracted-file-" + buriedNum;
    var numStr = String(buriedNum);
    prefixStr = numStr.slice(0, 2);
    suffixStr = numStr.slice(2, 4);

    // one text carrier + one interactive carrier, and a coin flip for which
    // half each one gets -- five carriers, two pools, never the same shape
    // of hunt twice running.
    proseCarrier = pick(["corrections", "comment", "ad"]);
    trickCarrier = pick(["photo", "redact"]);
    if (ri(0, 1) === 0) { prefixCarrier = proseCarrier; suffixCarrier = trickCarrier; }
    else { prefixCarrier = trickCarrier; suffixCarrier = proseCarrier; }

    lookupWrongs = 0;
    goblinTaunted = false;
    fragPrefixFound = false;
    fragSuffixFound = false;
    updateCaseTag();

    // the two text carriers NOT chosen this round always carry an unrelated
    // 2-digit "ref" number in an unrelated context -- same visual weight as a
    // real fragment, so spotting a short number is never proof by itself.
    decoyNums = {};
    var otherProse = ["corrections", "comment", "ad"].filter(function (k) { return k !== proseCarrier; });
    for (var d = 0; d < otherProse.length; d++) decoyNums[otherProse[d]] = ri(10, 99);

    // The buried file is UNLISTED, and every visible row has its own real
    // case number -- but none of them is the buried file, so scanning,
    // clicking, or looking one up can only ever reach a decoy, never the 404.
    var rows = [];
    var titles = NORMAL_TITLES.slice();
    for (var s = titles.length - 1; s > 0; s--) { var j = ri(0, s); var t = titles[s]; titles[s] = titles[j]; titles[j] = t; }
    for (var i = 0; i < 9; i++) rows.push({ type: "normal", title: titles[i], caseStr: "F-" + uniqNum() });

    var sealedFragValue = trickCarrier === "redact" ? ((prefixCarrier === "redact") ? prefixStr : suffixStr) : null;
    var fragRowIdx = sealedFragValue ? ri(0, 3) : -1;
    for (var r = 0; r < 4; r++) {
      rows.push({ type: "sealed", title: redactBars(r === fragRowIdx ? sealedFragValue : null), caseStr: "F-" + uniqNum() });
    }
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
  function halfLabel(role) { return role === "prefix" ? "first two digits" : "last two digits"; }

  // ---- pages ------------------------------------------------------------
  var PAGES = {
    home: {
      url: "dailybugle.web",
      html: function () {
        var prefixInfo = CARRIER_INFO[prefixCarrier], suffixInfo = CARRIER_INFO[suffixCarrier];
        return (
          '<div class="g2-mission"><span aria-hidden="true">&#128373;&#65039;</span>' +
            '<div><b>FROM THE EDITOR&#39;S DESK:</b> Some saboteur pulled my Spider-Man exclusive to ' +
            'the <b>morgue</b> and tore the case number clean in half before scrubbing every link. ' +
            'The <b>first two digits</b> are ' + prefixInfo.ptr + '. The <b>last two digits</b> are ' + suffixInfo.ptr + '. ' +
            'Find both halves, then punch the whole number into the <b>Archive</b>&#39;s file lookup.</div></div>' +
          '<div class="g2-kicker">Exclusive &bull; Front Page</div>' +
          '<h1 class="g2-headline">Spider-Man: Threat or Menace?</h1>' +
          '<div class="g2-byline">By J. Jonah Jameson, Editor-in-Chief</div>' +
          '<div class="g2-photo" id="g2-photo" tabindex="0" role="button" aria-label="Hold to develop the photo">' +
            '<span class="g2-photo-reveal" id="g2-photo-reveal"></span>' +
            '<span class="g2-photo-cover"></span>' +
            '<span class="g2-photo-label">[ Exclusive Photo &mdash; Pulled for Review ]<small>(press and hold)</small></span>' +
          '</div>' +
          '<div class="g2-caption">Photo removed pending retraction &mdash; filed to the morgue</div>' +
          '<div class="g2-body"><p>I had that masked menace dead to rights. Now the file is buried ' +
            'in our own archive, unlisted, and nobody will hand me the number. Unbelievable.</p></div>' +
          adBox(ADS[0], false) +
          '<div class="g2-section-label">More From Today</div>' +
          teaser("City Council debates web-fluid cleanup costs", "story") +
          teaser("Oscorp stock soars on &ldquo;synergy&rdquo; buzz", "story") +
          teaser("Best pretzel cart in Queens? We ranked them", "story")
        );
      }
    },

    news: {
      url: "dailybugle.web/news",
      html: function () {
        var adClue = proseCarrier === "ad";
        var role = adClue ? ((prefixCarrier === "ad") ? "prefix" : "suffix") : null;
        return (
          '<div class="g2-kicker">City News</div>' +
          '<h1 class="g2-headline">Around the Boroughs</h1>' +
          '<div class="g2-byline">The latest from the five boroughs</div>' +
          teaser("Subway delays blamed on &ldquo;giant lizard&rdquo;", "story") +
          teaser("Web-fluid cleanup bill hits City Hall", "story") +
          teaser("Oscorp opens third Manhattan lab", "story") +
          (adClue
            ? adBox({ label: "Classified", head: "LOST: ONE PRESS FILE",
                body: "Retracted photo file &mdash; the " + halfLabel(role) + " of the catalogue number read " +
                  caseTag(role === "prefix" ? prefixStr : suffixStr) + ". If found, do NOT return it to J. Jameson." }, true)
            : adBox({ label: "Classified", head: "LOST DOG: MAX",
                body: "Answers to &ldquo;Max.&rdquo; Reward if found. Ref. " + caseTag(decoyNums.ad) + " with the pound." }, false)) +
          '<div class="g2-note">Editor&#39;s note: retracted files are unlisted &mdash; open them from the ' +
            'Archive by their case number.</div>'
        );
      }
    },

    city: {
      url: "dailybugle.web/city",
      html: function () {
        var comClue = proseCarrier === "comment";
        var role = comClue ? ((prefixCarrier === "comment") ? "prefix" : "suffix") : null;
        var out =
          '<div class="g2-kicker">City Life</div>' +
          '<h1 class="g2-headline">The Big Apple, Daily</h1>' +
          '<div class="g2-byline">Food, culture, and complaining about rent</div>' +
          teaser("We ranked every dollar-slice in Manhattan", "story") +
          teaser("Rooftop gardens are the new penthouse", "story") +
          '<div class="g2-section-label">Letters &amp; Comments</div><div class="g2-comments">';
        out += commentRow(COMMENTS[0], false);
        out += commentRow(comClue
          ? { user: "morgue_intern", text: "lol the " + halfLabel(role) + " of the spidey file&#39;s catalogue number is " +
              caseTag(role === "prefix" ? prefixStr : suffixStr) + " &mdash; still unlisted in the archive though" }
          : { user: "landlord_hater", text: "my noise complaint against 4B&#39;s been open since March, ref. " +
              caseTag(decoyNums.comment) + ", nobody at 311 cares" }, comClue);
        out += commentRow(COMMENTS[2], false);
        out += "</div>";
        return out;
      }
    },

    opinion: {
      url: "dailybugle.web/opinion",
      html: function () {
        var corrClue = proseCarrier === "corrections";
        var role = corrClue ? ((prefixCarrier === "corrections") ? "prefix" : "suffix") : null;
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
                'The Bugle has pulled and unlisted one report pending review &mdash; the ' + halfLabel(role) +
                ' of its catalogue number read ' + caseTag(role === "prefix" ? prefixStr : suffixStr) +
                ', subject: the wall-crawler.</div>'
            : '<div class="g2-corrections"><span class="g2-corr-label">Correction</span>' +
                'We misidentified the winner of Tuesday&#39;s county-fair hot-dog-eating contest &mdash; the file&#39;s ' +
                'been reopened for review, ref. ' + caseTag(decoyNums.corrections) + '. The Bugle regrets the error.</div>') +
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
            corkboard() +
            '<p class="g2-404-sign">&mdash; your friendly neighborhood Spider-Man</p>' +
          '</div>'
        );
      }
    }
  };

  // ---- win-screen recap: a corkboard showing where BOTH halves came from,
  // feeding into the matched case number -- a quick visual instead of prose.
  function corkboard() {
    return (
      '<div class="g2-corkboard">' +
        '<div class="g2-cork-row">' +
          '<div class="g2-cork-item"><span class="g2-cork-pin" aria-hidden="true">&#128204;</span>' +
            '<span class="g2-cork-ico">' + CARRIER_ICON[prefixCarrier] + ' ' + prefixStr + '</span>' +
            '<span class="g2-cork-lbl">' + CARRIER_LABEL[prefixCarrier] + '</span></div>' +
          '<div class="g2-cork-item"><span class="g2-cork-pin" aria-hidden="true">&#128204;</span>' +
            '<span class="g2-cork-ico">' + CARRIER_ICON[suffixCarrier] + ' ' + suffixStr + '</span>' +
            '<span class="g2-cork-lbl">' + CARRIER_LABEL[suffixCarrier] + '</span></div>' +
        '</div>' +
        '<div class="g2-cork-item"><span class="g2-cork-pin" aria-hidden="true">&#128204;</span>' +
          '<span class="g2-cork-ico g2-cork-case">' + buriedCase + '</span>' +
          '<span class="g2-cork-lbl">Matched</span></div>' +
      '</div>'
    );
  }

  var ACTIVE_FOR = { story: "archive", sealed: "archive" };

  // ---- fragment discovery: the shared "you found a half" hook, no matter
  // which of the 5 carriers it came from (text glimpse or a hold-reveal). ----
  function nextMissingCarrier() {
    if (!fragPrefixFound) return { role: "prefix", key: prefixCarrier };
    if (!fragSuffixFound) return { role: "suffix", key: suffixCarrier };
    return null;
  }
  function updateCaseTag() {
    var tag = document.getElementById("g2-casetag"), txt = document.getElementById("g2-casetag-txt");
    if (!tag || !txt) return;
    if (!fragPrefixFound && !fragSuffixFound) { tag.hidden = true; return; }
    txt.textContent = "F-" + (fragPrefixFound ? prefixStr : "--") + (fragSuffixFound ? suffixStr : "--");
    tag.hidden = false;
    tag.classList.toggle("g2-casetag-complete", fragPrefixFound && fragSuffixFound);
  }
  function onFragmentFound(role) {
    if (won) return;
    if (role === "prefix") { if (fragPrefixFound) return; fragPrefixFound = true; }
    else { if (fragSuffixFound) return; fragSuffixFound = true; }
    sfxFragment();
    flashTicker(pick(TICKER_FRAGMENT_FLASHES));
    updateCaseTag();
    if (fragPrefixFound && fragSuffixFound) {
      setTimeout(function () { sfxMatch(); flashTicker(pick(TICKER_MATCH_FLASHES)); }, 260);
    }
  }

  // ---- hint scheduling (adapts to whichever half is still missing) ------
  function pageHint(pageId, tier) {
    var missing = nextMissingCarrier();

    if (!missing) {
      var full = "F-" + prefixStr + suffixStr;
      if (pageId !== "archive") {
        return { sel: '#g2-nav [data-goto="archive"]', msg: "&#128374; You&#39;ve got both halves &mdash; head to the Archive and punch " + full + " into the lookup.", delay: tier === 2 ? HINT_DELAY_2 : HINT_DELAY_1, strong: tier === 2 };
      }
      return { sel: "#g2-lookup", msg: "&#128374; You&#39;ve got both halves &mdash; " + full + ". Punch it into the lookup.", delay: tier === 2 ? ARCHIVE_HINT_DELAY_2 : ARCHIVE_HINT_DELAY_1, strong: true };
    }

    var c = CARRIER_INFO[missing.key];
    var half = halfLabel(missing.role);

    if (pageId === "archive") {
      if (missing.key === "redact") {
        return tier === 2
          ? { sel: "#g2-lookup", msg: "&#128374; The " + half + " are under one specific [RETRACTED] bar right here &mdash; keep holding bars down until one gives.", delay: ARCHIVE_HINT_DELAY_2, strong: true }
          : { sel: "#g2-lookup", msg: "&#128374; Not every bar in this list is just for show&hellip;", delay: ARCHIVE_HINT_DELAY_1 };
      }
      return tier === 2
        ? { sel: "#g2-lookup", msg: "&#128374; The " + half + " are " + c.where + " &mdash; go track them down, then type the full number here.", delay: ARCHIVE_HINT_DELAY_2, strong: true }
        : { sel: "#g2-lookup", msg: "&#128374; Type the case number here once you&#39;ve tracked down both halves&hellip;", delay: ARCHIVE_HINT_DELAY_1 };
    }
    if (pageId === c.section) {
      return { sel: c.foundSel, msg: "&#128374; That&#39;s the " + half + " &mdash; now find the other half.", delay: HINT_DELAY_1 };
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
  // ---- tier-0 cue: a barely-there shimmer the FIRST time a text-carrier's
  // clue box scrolls into view, well before the timed hints (armHint) arm at
  // all. It's a single soft pulse, not the persistent red/gold outline --
  // reward for reading carefully, not a shortcut, and it never repeats once
  // that half is found (interactive carriers get their own reveal instead).
  function wireClueGlimpse() {
    var el = document.getElementById("g2-clue");
    if (!el || !("IntersectionObserver" in window)) return;
    var role = (prefixCarrier === proseCarrier) ? "prefix" : "suffix";
    if ((role === "prefix" && fragPrefixFound) || (role === "suffix" && fragSuffixFound)) return;
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          el.classList.add("g2-clue-glimpse");
          setTimeout(function () { el.classList.remove("g2-clue-glimpse"); }, 900);
          onFragmentFound(role);
          io.disconnect();
          break;
        }
      }
    }, { root: screen, threshold: 0.6 });
    io.observe(el);
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
    sfxGoblin();
    flashTicker(pick(TICKER_GOBLIN_FLASHES));
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
    if (hit) { sfxDecoyOpen(); flashTicker(pick(TICKER_DECOY_FLASHES)); go(hit.type === "sealed" ? "sealed" : "story"); return; }

    lookupWrongs++;
    sfxWrong();
    if (val) flashTicker(pick(TICKER_WRONG_FLASHES));
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
    if (pageId === "notfound") sfxFound();
    app.classList.toggle("is-404", pageId === "notfound");
    screen.innerHTML = page.html();
    screen.scrollTop = 0;
    playTurn();
    setUrl(typeof page.url === "function" ? page.url() : page.url);
    setActiveTab(pageId);
    pulseLoadbar();
    armHint(pageId);
    wireClueGlimpse();
    // No "Case Closed" confirmation click -- finding the buried 404 IS the
    // solve, so auto-advance straight into the win stamp + redirect. The
    // delay just lets the found-page reveal (corkboard, Spidey art) land
    // before the stamp slams down on top of it.
    if (pageId === "notfound") setTimeout(win, 1400);
    if (pageId === "archive") {
      var inp = document.getElementById("g2-lookup-input");
      if (inp) inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doPull(); } });
      if (!goblinShown) { goblinShown = true; setTimeout(function () { showGoblin(pick(GOBLIN_TAUNTS)); }, 520); }
    }
  }

  function win() {
    if (won) return;
    won = true;
    sfxWin();
    clearHint();
    if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    app.classList.add("is-won");
    setTimeout(function () {
      completeGame("2", { message: "Story unburied. Next threat incoming…" });
      // completeGame() (game.js) navigates away on success and alert()s on
      // failure. There's no button here for the player to retry with, so if
      // we're still here after a grace window the submit failed -- clear
      // `won` and silently retry rather than stranding them.
      setTimeout(function () {
        app.classList.remove("is-won");
        won = false;
        if (currentPageId === "notfound") setTimeout(win, 400);
      }, 2600);
    }, 800);
  }

  function onTap(evt) {
    var el = evt.target.closest("[data-goto]");
    if (!el) return;
    evt.preventDefault();
    var dest = el.dataset.goto;
    if (dest === "pull") { doPull(); return; }
    go(dest);
  }

  // ---- hold-to-reveal: redaction bars + the front-page photo -------------
  var REDACT_HOLD_MS = 420, REDACT_RESEAL_MS = 1500;
  var PHOTO_HOLD_MS = 650, PHOTO_RESEAL_MS = 1600;
  var redactHoldTimer = null, redactHoldEl = null, photoHoldTimer = null;

  function redactCancel() {
    if (redactHoldTimer) { clearTimeout(redactHoldTimer); redactHoldTimer = null; }
    if (redactHoldEl) { redactHoldEl.classList.remove("is-holding"); redactHoldEl = null; }
  }
  function redactPeel(el) {
    if (redactHoldTimer) { clearTimeout(redactHoldTimer); redactHoldTimer = null; }
    redactHoldEl = null;
    el.classList.remove("is-holding");
    el.classList.add("is-peeled");
    if (el.dataset.frag === "1") onFragmentFound(prefixCarrier === "redact" ? "prefix" : "suffix");
    setTimeout(function () { el.classList.remove("is-peeled"); }, REDACT_RESEAL_MS);
  }
  function photoCancel() {
    if (photoHoldTimer) { clearTimeout(photoHoldTimer); photoHoldTimer = null; }
    var el = document.getElementById("g2-photo");
    if (el) el.classList.remove("is-developing");
  }
  function photoDevelop(el) {
    if (photoHoldTimer) { clearTimeout(photoHoldTimer); photoHoldTimer = null; }
    el.classList.remove("is-developing");
    el.classList.add("is-developed");
    var reveal = document.getElementById("g2-photo-reveal");
    var isCarrier = prefixCarrier === "photo" || suffixCarrier === "photo";
    if (reveal) {
      if (isCarrier) {
        var role = prefixCarrier === "photo" ? "prefix" : "suffix";
        reveal.innerHTML = "The " + halfLabel(role) + ", barely legible: " + caseTag(role === "prefix" ? prefixStr : suffixStr);
      } else {
        reveal.innerHTML = pick(PHOTO_JOKES);
      }
    }
    if (isCarrier) onFragmentFound(prefixCarrier === "photo" ? "prefix" : "suffix");
    setTimeout(function () { el.classList.remove("is-developed"); }, PHOTO_RESEAL_MS);
  }
  function wireHoldReveal() {
    app.addEventListener("pointerdown", function (e) {
      var redactEl = e.target.closest(".g2-redact");
      if (redactEl && !redactEl.classList.contains("is-peeled")) {
        redactCancel();
        redactHoldEl = redactEl;
        redactEl.classList.add("is-holding");
        redactHoldTimer = setTimeout(function () { redactPeel(redactEl); }, REDACT_HOLD_MS);
        return;
      }
      var photoEl = e.target.closest("#g2-photo");
      if (photoEl && !photoEl.classList.contains("is-developed")) {
        if (photoHoldTimer) clearTimeout(photoHoldTimer);
        photoEl.classList.add("is-developing");
        photoHoldTimer = setTimeout(function () { photoDevelop(photoEl); }, PHOTO_HOLD_MS);
      }
    });
    ["pointerup", "pointercancel"].forEach(function (evtName) {
      app.addEventListener(evtName, function () { redactCancel(); photoCancel(); });
    });
    app.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var el = e.target;
      if (el.classList && el.classList.contains("g2-redact") && !el.classList.contains("is-peeled")) {
        e.preventDefault();
        redactPeel(el);
      } else if (el.id === "g2-photo" && !el.classList.contains("is-developed")) {
        e.preventDefault();
        photoDevelop(el);
      }
    });
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
    for (var i = 0; i < tickerItems.length; i++) one += '<span style="padding:0 22px">&#9670; ' + tickerItems[i] + "</span>";
    track.innerHTML = one + one;
    // duration is derived from the actual rendered width of one copy so the
    // loop always completes a clean pass regardless of ticker content length
    // (a fixed duration would drift out of sync with -50% and visibly jump).
    var TICKER_SPEED_PX_S = 45;
    var oneCopyWidth = track.scrollWidth / 2;
    var duration = oneCopyWidth / TICKER_SPEED_PX_S;
    track.style.animationDuration = (isFinite(duration) && duration > 0 ? duration : 18) + "s";
  }
  // the ticker reacts to what the player just did -- a wrong guess, a decoy
  // opened, the Goblin showing up, a fragment found -- so the site feels
  // alive without adding any new reading or UI surface. Capped so it can't
  // grow unbounded over a long, guess-heavy play.
  function flashTicker(text) {
    tickerItems.unshift(text);
    if (tickerItems.length > 9) tickerItems.length = 9;
    buildTicker();
    var t = document.getElementById("g2-ticker-badge");
    if (t) { t.classList.remove("g2-ticker-pop"); void t.offsetWidth; t.classList.add("g2-ticker-pop"); }
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
    wireHoldReveal();
    var goblin = document.getElementById("g2-goblin");
    if (goblin) goblin.addEventListener("click", function (e) {
      if (e.target === goblin || e.target.id === "g2-goblin-x") hideGoblin();
    });
    var muteBtn = document.getElementById("g2-mute");
    if (muteBtn) { setMuteUI(); muteBtn.addEventListener("click", toggleMute); }

    go("home");
  });
})();
