/** Match Brackets from https://codemirror.net/addon/edit/matchbrackets.js */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    var ie_lt8 = /MSIE \d/.test(navigator.userAgent) &&
      (document.documentMode == null || document.documentMode < 8);

    var Pos = CodeMirror.Pos;

    var matching = {"(": ")>", ")": "(<", "[": "]>", "]": "[<", "{": "}>", "}": "{<", "<": ">>", ">": "<<"};

    function bracketRegex(config) {
      return config && config.bracketRegex || /[(){}[\]]/
    }

    function findMatchingBracket(cm, where, config) {
      var line = cm.getLineHandle(where.line), pos = where.ch - 1;
      var afterCursor = config && config.afterCursor
      if (afterCursor == null)
        afterCursor = /(^| )cm-fat-cursor($| )/.test(cm.getWrapperElement().className)
      var re = bracketRegex(config)

      // A cursor is defined as between two characters, but in in vim command mode
      // (i.e. not insert mode), the cursor is visually represented as a
      // highlighted box on top of the 2nd character. Otherwise, we allow matches
      // from before or after the cursor.
      var match = (!afterCursor && pos >= 0 && re.test(line.text.charAt(pos)) && matching[line.text.charAt(pos)]) ||
          re.test(line.text.charAt(pos + 1)) && matching[line.text.charAt(++pos)];
      if (!match) return null;
      var dir = match.charAt(1) == ">" ? 1 : -1;
      if (config && config.strict && (dir > 0) != (pos == where.ch)) return null;
      var style = cm.getTokenTypeAt(Pos(where.line, pos + 1));

      var found = scanForBracket(cm, Pos(where.line, pos + (dir > 0 ? 1 : 0)), dir, style || null, config);
      if (found == null) return null;
      return {from: Pos(where.line, pos), to: found && found.pos,
              match: found && found.ch == match.charAt(0), forward: dir > 0};
    }

    // bracketRegex is used to specify which type of bracket to scan
    // should be a regexp, e.g. /[[\]]/
    //
    // Note: If "where" is on an open bracket, then this bracket is ignored.
    //
    // Returns false when no bracket was found, null when it reached
    // maxScanLines and gave up
    function scanForBracket(cm, where, dir, style, config) {
      var maxScanLen = (config && config.maxScanLineLength) || 10000;
      var maxScanLines = (config && config.maxScanLines) || 1000;

      var stack = [];
      var re = bracketRegex(config)
      var lineEnd = dir > 0 ? Math.min(where.line + maxScanLines, cm.lastLine() + 1)
                            : Math.max(cm.firstLine() - 1, where.line - maxScanLines);
      for (var lineNo = where.line; lineNo != lineEnd; lineNo += dir) {
        var line = cm.getLine(lineNo);
        if (!line) continue;
        var pos = dir > 0 ? 0 : line.length - 1, end = dir > 0 ? line.length : -1;
        if (line.length > maxScanLen) continue;
        if (lineNo == where.line) pos = where.ch - (dir < 0 ? 1 : 0);
        for (; pos != end; pos += dir) {
          var ch = line.charAt(pos);
          if (re.test(ch) && (style === undefined || cm.getTokenTypeAt(Pos(lineNo, pos + 1)) == style)) {
            var match = matching[ch];
            if (match && (match.charAt(1) == ">") == (dir > 0)) stack.push(ch);
            else if (!stack.length) return {pos: Pos(lineNo, pos), ch: ch};
            else stack.pop();
          }
        }
      }
      return lineNo - dir == (dir > 0 ? cm.lastLine() : cm.firstLine()) ? false : null;
    }

    function matchBrackets(cm, autoclear, config) {
      // Disable brace matching in long lines, since it'll cause hugely slow updates
      var maxHighlightLen = cm.state.matchBrackets.maxHighlightLineLength || 1000;
      var marks = [], ranges = cm.listSelections();
      for (var i = 0; i < ranges.length; i++) {
        var match = ranges[i].empty() && findMatchingBracket(cm, ranges[i].head, config);
        if (match && cm.getLine(match.from.line).length <= maxHighlightLen) {
          var style = match.match ? "CodeMirror-matchingbracket" : "CodeMirror-nonmatchingbracket";
          marks.push(cm.markText(match.from, Pos(match.from.line, match.from.ch + 1), {className: style}));
          if (match.to && cm.getLine(match.to.line).length <= maxHighlightLen)
            marks.push(cm.markText(match.to, Pos(match.to.line, match.to.ch + 1), {className: style}));
        }
      }

      if (marks.length) {
        // Kludge to work around the IE bug from issue #1193, where text
        // input stops going to the textare whever this fires.
        if (ie_lt8 && cm.state.focused) cm.focus();

        var clear = function() {
          cm.operation(function() {
            for (var i = 0; i < marks.length; i++) marks[i].clear();
          });
        };
        if (autoclear) setTimeout(clear, 800);
        else return clear;
      }
    }

    function doMatchBrackets(cm) {
      cm.operation(function() {
        if (cm.state.matchBrackets.currentlyHighlighted) {
          cm.state.matchBrackets.currentlyHighlighted();
          cm.state.matchBrackets.currentlyHighlighted = null;
        }
        cm.state.matchBrackets.currentlyHighlighted = matchBrackets(cm, false, cm.state.matchBrackets);
      });
    }

    CodeMirror.defineOption("matchBrackets", false, function(cm, val, old) {
      if (old && old != CodeMirror.Init) {
        cm.off("cursorActivity", doMatchBrackets);
        if (cm.state.matchBrackets && cm.state.matchBrackets.currentlyHighlighted) {
          cm.state.matchBrackets.currentlyHighlighted();
          cm.state.matchBrackets.currentlyHighlighted = null;
        }
      }
      if (val) {
        cm.state.matchBrackets = typeof val == "object" ? val : {};
        cm.on("cursorActivity", doMatchBrackets);
      }
    });

    CodeMirror.defineExtension("matchBrackets", function() {matchBrackets(this, true);});
    CodeMirror.defineExtension("findMatchingBracket", function(pos, config, oldConfig){
      // Backwards-compatibility kludge
      if (oldConfig || typeof config == "boolean") {
        if (!oldConfig) {
          config = config ? {strict: true} : null
        } else {
          oldConfig.strict = config
          config = oldConfig
        }
      }
      return findMatchingBracket(this, pos, config)
    });
    CodeMirror.defineExtension("scanForBracket", function(pos, dir, style, config){
      return scanForBracket(this, pos, dir, style, config);
    });
  });

/** Show Hint from https://codemirror.net/addon/hint/show-hint.js */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    "use strict";

    var HINT_ELEMENT_CLASS        = "CodeMirror-hint";
    var ACTIVE_HINT_ELEMENT_CLASS = "CodeMirror-hint-active";

    // This is the old interface, kept around for now to stay
    // backwards-compatible.
    CodeMirror.showHint = function(cm, getHints, options) {
      if (!getHints) return cm.showHint(options);
      if (options && options.async) getHints.async = true;
      var newOpts = {hint: getHints};
      if (options) for (var prop in options) newOpts[prop] = options[prop];
      return cm.showHint(newOpts);
    };

    CodeMirror.defineExtension("showHint", function(options) {
      options = parseOptions(this, this.getCursor("start"), options);
      var selections = this.listSelections()
      if (selections.length > 1) return;
      // By default, don't allow completion when something is selected.
      // A hint function can have a `supportsSelection` property to
      // indicate that it can handle selections.
      if (this.somethingSelected()) {
        if (!options.hint.supportsSelection) return;
        // Don't try with cross-line selections
        for (var i = 0; i < selections.length; i++)
          if (selections[i].head.line != selections[i].anchor.line) return;
      }

      if (this.state.completionActive) this.state.completionActive.close();
      var completion = this.state.completionActive = new Completion(this, options);
      if (!completion.options.hint) return;

      CodeMirror.signal(this, "startCompletion", this);
      completion.update(true);
    });

    CodeMirror.defineExtension("closeHint", function() {
      if (this.state.completionActive) this.state.completionActive.close()
    })

    function Completion(cm, options) {
      this.cm = cm;
      this.options = options;
      this.widget = null;
      this.debounce = 0;
      this.tick = 0;
      this.startPos = this.cm.getCursor("start");
      this.startLen = this.cm.getLine(this.startPos.line).length - this.cm.getSelection().length;

      var self = this;
      cm.on("cursorActivity", this.activityFunc = function() { self.cursorActivity(); });
    }

    var requestAnimationFrame = window.requestAnimationFrame || function(fn) {
      return setTimeout(fn, 1000/60);
    };
    var cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;

    Completion.prototype = {
      close: function() {
        if (!this.active()) return;
        this.cm.state.completionActive = null;
        this.tick = null;
        this.cm.off("cursorActivity", this.activityFunc);

        if (this.widget && this.data) CodeMirror.signal(this.data, "close");
        if (this.widget) this.widget.close();
        CodeMirror.signal(this.cm, "endCompletion", this.cm);
      },

      active: function() {
        return this.cm.state.completionActive == this;
      },

      pick: function(data, i) {
        var completion = data.list[i];
        if (completion.hint) completion.hint(this.cm, data, completion);
        else this.cm.replaceRange(getText(completion), completion.from || data.from,
                                  completion.to || data.to, "complete");
        CodeMirror.signal(data, "pick", completion);
        this.close();
      },

      cursorActivity: function() {
        if (this.debounce) {
          cancelAnimationFrame(this.debounce);
          this.debounce = 0;
        }

        var pos = this.cm.getCursor(), line = this.cm.getLine(pos.line);
        if (pos.line != this.startPos.line || line.length - pos.ch != this.startLen - this.startPos.ch ||
            pos.ch < this.startPos.ch || this.cm.somethingSelected() ||
            (!pos.ch || this.options.closeCharacters.test(line.charAt(pos.ch - 1)))) {
          this.close();
        } else {
          var self = this;
          this.debounce = requestAnimationFrame(function() {self.update();});
          if (this.widget) this.widget.disable();
        }
      },

      update: function(first) {
        if (this.tick == null) return
        var self = this, myTick = ++this.tick
        fetchHints(this.options.hint, this.cm, this.options, function(data) {
          if (self.tick == myTick) self.finishUpdate(data, first)
        })
      },

      finishUpdate: function(data, first) {
        if (this.data) CodeMirror.signal(this.data, "update");

        var picked = (this.widget && this.widget.picked) || (first && this.options.completeSingle);
        if (this.widget) this.widget.close();

        this.data = data;

        if (data && data.list.length) {
          if (picked && data.list.length == 1) {
            this.pick(data, 0);
          } else {
            this.widget = new Widget(this, data);
            CodeMirror.signal(data, "shown");
          }
        }
      }
    };

    function parseOptions(cm, pos, options) {
      var editor = cm.options.hintOptions;
      var out = {};
      for (var prop in defaultOptions) out[prop] = defaultOptions[prop];
      if (editor) for (var prop in editor)
        if (editor[prop] !== undefined) out[prop] = editor[prop];
      if (options) for (var prop in options)
        if (options[prop] !== undefined) out[prop] = options[prop];
      if (out.hint.resolve) out.hint = out.hint.resolve(cm, pos)
      return out;
    }

    function getText(completion) {
      if (typeof completion == "string") return completion;
      else return completion.text;
    }

    function buildKeyMap(completion, handle) {
      var baseMap = {
        Up: function() {handle.moveFocus(-1);},
        Down: function() {handle.moveFocus(1);},
        PageUp: function() {handle.moveFocus(-handle.menuSize() + 1, true);},
        PageDown: function() {handle.moveFocus(handle.menuSize() - 1, true);},
        Home: function() {handle.setFocus(0);},
        End: function() {handle.setFocus(handle.length - 1);},
        Enter: handle.pick,
        Tab: handle.pick,
        Esc: handle.close
      };

      var mac = /Mac/.test(navigator.platform);

      if (mac) {
        baseMap["Ctrl-P"] = function() {handle.moveFocus(-1);};
        baseMap["Ctrl-N"] = function() {handle.moveFocus(1);};
      }

      var custom = completion.options.customKeys;
      var ourMap = custom ? {} : baseMap;
      function addBinding(key, val) {
        var bound;
        if (typeof val != "string")
          bound = function(cm) { return val(cm, handle); };
        // This mechanism is deprecated
        else if (baseMap.hasOwnProperty(val))
          bound = baseMap[val];
        else
          bound = val;
        ourMap[key] = bound;
      }
      if (custom)
        for (var key in custom) if (custom.hasOwnProperty(key))
          addBinding(key, custom[key]);
      var extra = completion.options.extraKeys;
      if (extra)
        for (var key in extra) if (extra.hasOwnProperty(key))
          addBinding(key, extra[key]);
      return ourMap;
    }

    function getHintElement(hintsElement, el) {
      while (el && el != hintsElement) {
        if (el.nodeName.toUpperCase() === "LI" && el.parentNode == hintsElement) return el;
        el = el.parentNode;
      }
    }

    function Widget(completion, data) {
      this.completion = completion;
      this.data = data;
      this.picked = false;
      var widget = this, cm = completion.cm;
      var ownerDocument = cm.getInputField().ownerDocument;
      var parentWindow = ownerDocument.defaultView || ownerDocument.parentWindow;

      var hints = this.hints = ownerDocument.createElement("ul");
      var theme = completion.cm.options.theme;
      hints.className = "CodeMirror-hints " + theme;
      this.selectedHint = data.selectedHint || 0;

      var completions = data.list;
      for (var i = 0; i < completions.length; ++i) {
        var elt = hints.appendChild(ownerDocument.createElement("li")), cur = completions[i];
        var className = HINT_ELEMENT_CLASS + (i != this.selectedHint ? "" : " " + ACTIVE_HINT_ELEMENT_CLASS);
        if (cur.className != null) className = cur.className + " " + className;
        elt.className = className;
        if (cur.render) cur.render(elt, data, cur);
        else elt.appendChild(ownerDocument.createTextNode(cur.displayText || getText(cur)));
        elt.hintId = i;
      }

      var container = completion.options.container || ownerDocument.body;
      var pos = cm.cursorCoords(completion.options.alignWithWord ? data.from : null);
      var left = pos.left, top = pos.bottom, below = true;
      var offsetLeft = 0, offsetTop = 0;
      if (container !== ownerDocument.body) {
        // We offset the cursor position because left and top are relative to the offsetParent's top left corner.
        var isContainerPositioned = ['absolute', 'relative', 'fixed'].indexOf(parentWindow.getComputedStyle(container).position) !== -1;
        var offsetParent = isContainerPositioned ? container : container.offsetParent;
        var offsetParentPosition = offsetParent.getBoundingClientRect();
        var bodyPosition = ownerDocument.body.getBoundingClientRect();
        offsetLeft = (offsetParentPosition.left - bodyPosition.left);
        offsetTop = (offsetParentPosition.top - bodyPosition.top);
      }
      hints.style.left = (left - offsetLeft) + "px";
      hints.style.top = (top - offsetTop) + "px";

      // If we're at the edge of the screen, then we want the menu to appear on the left of the cursor.
      var winW = parentWindow.innerWidth || Math.max(ownerDocument.body.offsetWidth, ownerDocument.documentElement.offsetWidth);
      var winH = parentWindow.innerHeight || Math.max(ownerDocument.body.offsetHeight, ownerDocument.documentElement.offsetHeight);
      container.appendChild(hints);
      var box = hints.getBoundingClientRect(), overlapY = box.bottom - winH;
      var scrolls = hints.scrollHeight > hints.clientHeight + 1
      var startScroll = cm.getScrollInfo();

      if (overlapY > 0) {
        var height = box.bottom - box.top, curTop = pos.top - (pos.bottom - box.top);
        if (curTop - height > 0) { // Fits above cursor
          hints.style.top = (top = pos.top - height - offsetTop) + "px";
          below = false;
        } else if (height > winH) {
          hints.style.height = (winH - 5) + "px";
          hints.style.top = (top = pos.bottom - box.top - offsetTop) + "px";
          var cursor = cm.getCursor();
          if (data.from.ch != cursor.ch) {
            pos = cm.cursorCoords(cursor);
            hints.style.left = (left = pos.left - offsetLeft) + "px";
            box = hints.getBoundingClientRect();
          }
        }
      }
      var overlapX = box.right - winW;
      if (overlapX > 0) {
        if (box.right - box.left > winW) {
          hints.style.width = (winW - 5) + "px";
          overlapX -= (box.right - box.left) - winW;
        }
        hints.style.left = (left = pos.left - overlapX - offsetLeft) + "px";
      }
      if (scrolls) for (var node = hints.firstChild; node; node = node.nextSibling)
        node.style.paddingRight = cm.display.nativeBarWidth + "px"

      cm.addKeyMap(this.keyMap = buildKeyMap(completion, {
        moveFocus: function(n, avoidWrap) { widget.changeActive(widget.selectedHint + n, avoidWrap); },
        setFocus: function(n) { widget.changeActive(n); },
        menuSize: function() { return widget.screenAmount(); },
        length: completions.length,
        close: function() { completion.close(); },
        pick: function() { widget.pick(); },
        data: data
      }));

      if (completion.options.closeOnUnfocus) {
        var closingOnBlur;
        cm.on("blur", this.onBlur = function() { closingOnBlur = setTimeout(function() { completion.close(); }, 100); });
        cm.on("focus", this.onFocus = function() { clearTimeout(closingOnBlur); });
      }

      cm.on("scroll", this.onScroll = function() {
        var curScroll = cm.getScrollInfo(), editor = cm.getWrapperElement().getBoundingClientRect();
        var newTop = top + startScroll.top - curScroll.top;
        var point = newTop - (parentWindow.pageYOffset || (ownerDocument.documentElement || ownerDocument.body).scrollTop);
        if (!below) point += hints.offsetHeight;
        if (point <= editor.top || point >= editor.bottom) return completion.close();
        hints.style.top = newTop + "px";
        hints.style.left = (left + startScroll.left - curScroll.left) + "px";
      });

      CodeMirror.on(hints, "dblclick", function(e) {
        var t = getHintElement(hints, e.target || e.srcElement);
        if (t && t.hintId != null) {widget.changeActive(t.hintId); widget.pick();}
      });

      CodeMirror.on(hints, "click", function(e) {
        var t = getHintElement(hints, e.target || e.srcElement);
        if (t && t.hintId != null) {
          widget.changeActive(t.hintId);
          if (completion.options.completeOnSingleClick) widget.pick();
        }
      });

      CodeMirror.on(hints, "mousedown", function() {
        setTimeout(function(){cm.focus();}, 20);
      });

      CodeMirror.signal(data, "select", completions[this.selectedHint], hints.childNodes[this.selectedHint]);
      return true;
    }

    Widget.prototype = {
      close: function() {
        if (this.completion.widget != this) return;
        this.completion.widget = null;
        this.hints.parentNode.removeChild(this.hints);
        this.completion.cm.removeKeyMap(this.keyMap);

        var cm = this.completion.cm;
        if (this.completion.options.closeOnUnfocus) {
          cm.off("blur", this.onBlur);
          cm.off("focus", this.onFocus);
        }
        cm.off("scroll", this.onScroll);
      },

      disable: function() {
        this.completion.cm.removeKeyMap(this.keyMap);
        var widget = this;
        this.keyMap = {Enter: function() { widget.picked = true; }};
        this.completion.cm.addKeyMap(this.keyMap);
      },

      pick: function() {
        this.completion.pick(this.data, this.selectedHint);
      },

      changeActive: function(i, avoidWrap) {
        if (i >= this.data.list.length)
          i = avoidWrap ? this.data.list.length - 1 : 0;
        else if (i < 0)
          i = avoidWrap ? 0  : this.data.list.length - 1;
        if (this.selectedHint == i) return;
        var node = this.hints.childNodes[this.selectedHint];
        if (node) node.className = node.className.replace(" " + ACTIVE_HINT_ELEMENT_CLASS, "");
        node = this.hints.childNodes[this.selectedHint = i];
        node.className += " " + ACTIVE_HINT_ELEMENT_CLASS;
        if (node.offsetTop < this.hints.scrollTop)
          this.hints.scrollTop = node.offsetTop - 3;
        else if (node.offsetTop + node.offsetHeight > this.hints.scrollTop + this.hints.clientHeight)
          this.hints.scrollTop = node.offsetTop + node.offsetHeight - this.hints.clientHeight + 3;
        CodeMirror.signal(this.data, "select", this.data.list[this.selectedHint], node);
      },

      screenAmount: function() {
        return Math.floor(this.hints.clientHeight / this.hints.firstChild.offsetHeight) || 1;
      }
    };

    function applicableHelpers(cm, helpers) {
      if (!cm.somethingSelected()) return helpers
      var result = []
      for (var i = 0; i < helpers.length; i++)
        if (helpers[i].supportsSelection) result.push(helpers[i])
      return result
    }

    function fetchHints(hint, cm, options, callback) {
      if (hint.async) {
        hint(cm, callback, options)
      } else {
        var result = hint(cm, options)
        if (result && result.then) result.then(callback)
        else callback(result)
      }
    }

    function resolveAutoHints(cm, pos) {
      var helpers = cm.getHelpers(pos, "hint"), words
      if (helpers.length) {
        var resolved = function(cm, callback, options) {
          var app = applicableHelpers(cm, helpers);
          function run(i) {
            if (i == app.length) return callback(null)
            fetchHints(app[i], cm, options, function(result) {
              if (result && result.list.length > 0) callback(result)
              else run(i + 1)
            })
          }
          run(0)
        }
        resolved.async = true
        resolved.supportsSelection = true
        return resolved
      } else if (words = cm.getHelper(cm.getCursor(), "hintWords")) {
        return function(cm) { return CodeMirror.hint.fromList(cm, {words: words}) }
      } else if (CodeMirror.hint.anyword) {
        return function(cm, options) { return CodeMirror.hint.anyword(cm, options) }
      } else {
        return function() {}
      }
    }

    CodeMirror.registerHelper("hint", "auto", {
      resolve: resolveAutoHints
    });

    CodeMirror.registerHelper("hint", "fromList", function(cm, options) {
      var cur = cm.getCursor(), token = cm.getTokenAt(cur)
      var term, from = CodeMirror.Pos(cur.line, token.start), to = cur
      if (token.start < cur.ch && /\w/.test(token.string.charAt(cur.ch - token.start - 1))) {
        term = token.string.substr(0, cur.ch - token.start)
      } else {
        term = ""
        from = cur
      }
      var found = [];
      for (var i = 0; i < options.words.length; i++) {
        var word = options.words[i];
        if (word.slice(0, term.length) == term)
          found.push(word);
      }

      if (found.length) return {list: found, from: from, to: to};
    });

    CodeMirror.commands.autocomplete = CodeMirror.showHint;

    var defaultOptions = {
      hint: CodeMirror.hint.auto,
      completeSingle: true,
      alignWithWord: true,
      closeCharacters: /[\s()\[\]{};:>,]/,
      closeOnUnfocus: true,
      completeOnSingleClick: true,
      container: null,
      customKeys: null,
      extraKeys: null
    };

    CodeMirror.defineOption("hintOptions", null);
  });

/** JavaScript hint from https://codemirror.net/addon/hint/javascript-hint.js */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    var Pos = CodeMirror.Pos;

    function forEach(arr, f) {
      for (var i = 0, e = arr.length; i < e; ++i) f(arr[i]);
    }

    function arrayContains(arr, item) {
      if (!Array.prototype.indexOf) {
        var i = arr.length;
        while (i--) {
          if (arr[i] === item) {
            return true;
          }
        }
        return false;
      }
      return arr.indexOf(item) != -1;
    }

    function scriptHint(editor, keywords, getToken, options) {
      // Find the token at the cursor
      var cur = editor.getCursor(), token = getToken(editor, cur);
      if (/\b(?:string|comment)\b/.test(token.type)) return;
      var innerMode = CodeMirror.innerMode(editor.getMode(), token.state);
      if (innerMode.mode.helperType === "json") return;
      token.state = innerMode.state;

      // If it's not a 'word-style' token, ignore the token.
      if (!/^[\w$_]*$/.test(token.string)) {
        token = {start: cur.ch, end: cur.ch, string: "", state: token.state,
                 type: token.string == "." ? "property" : null};
      } else if (token.end > cur.ch) {
        token.end = cur.ch;
        token.string = token.string.slice(0, cur.ch - token.start);
      }

      var tprop = token;
      // If it is a property, find out what it is a property of.
      while (tprop.type == "property") {
        tprop = getToken(editor, Pos(cur.line, tprop.start));
        if (tprop.string != ".") return;
        tprop = getToken(editor, Pos(cur.line, tprop.start));
        if (!context) var context = [];
        context.push(tprop);
      }
      return {list: getCompletions(token, context, keywords, options),
              from: Pos(cur.line, token.start),
              to: Pos(cur.line, token.end)};
    }

    function javascriptHint(editor, options) {
      return scriptHint(editor, javascriptKeywords,
                        function (e, cur) {return e.getTokenAt(cur);},
                        options);
    };
    CodeMirror.registerHelper("hint", "javascript", javascriptHint);

    function getCoffeeScriptToken(editor, cur) {
    // This getToken, it is for coffeescript, imitates the behavior of
    // getTokenAt method in javascript.js, that is, returning "property"
    // type and treat "." as indepenent token.
      var token = editor.getTokenAt(cur);
      if (cur.ch == token.start + 1 && token.string.charAt(0) == '.') {
        token.end = token.start;
        token.string = '.';
        token.type = "property";
      }
      else if (/^\.[\w$_]*$/.test(token.string)) {
        token.type = "property";
        token.start++;
        token.string = token.string.replace(/\./, '');
      }
      return token;
    }

    function coffeescriptHint(editor, options) {
      return scriptHint(editor, coffeescriptKeywords, getCoffeeScriptToken, options);
    }
    CodeMirror.registerHelper("hint", "coffeescript", coffeescriptHint);

    var stringProps = ("charAt charCodeAt indexOf lastIndexOf substring substr slice trim trimLeft trimRight " +
                       "toUpperCase toLowerCase split concat match replace search").split(" ");
    var arrayProps = ("length concat join splice push pop shift unshift slice reverse sort indexOf " +
                      "lastIndexOf every some filter forEach map reduce reduceRight ").split(" ");
    var funcProps = "prototype apply call bind".split(" ");
    var javascriptKeywords = ("break case catch class const continue debugger default delete do else export extends false finally for function " +
                    "if in import instanceof new null return super switch this throw true try typeof var void while with yield").split(" ");
    var coffeescriptKeywords = ("and break catch class continue delete do else extends false finally for " +
                    "if in instanceof isnt new no not null of off on or return switch then throw true try typeof until void while with yes").split(" ");

    function forAllProps(obj, callback) {
      if (!Object.getOwnPropertyNames || !Object.getPrototypeOf) {
        for (var name in obj) callback(name)
      } else {
        for (var o = obj; o; o = Object.getPrototypeOf(o))
          Object.getOwnPropertyNames(o).forEach(callback)
      }
    }

    function getCompletions(token, context, keywords, options) {
      var found = [], start = token.string, global = options && options.globalScope || window;
      function maybeAdd(str) {
        if (str.lastIndexOf(start, 0) == 0 && !arrayContains(found, str)) found.push(str);
      }
      function gatherCompletions(obj) {
        if (typeof obj == "string") forEach(stringProps, maybeAdd);
        else if (obj instanceof Array) forEach(arrayProps, maybeAdd);
        else if (obj instanceof Function) forEach(funcProps, maybeAdd);
        forAllProps(obj, maybeAdd)
      }

      if (context && context.length) {
        // If this is a property, see if it belongs to some object we can
        // find in the current environment.
        var obj = context.pop(), base;
        if (obj.type && obj.type.indexOf("variable") === 0) {
          if (options && options.additionalContext)
            base = options.additionalContext[obj.string];
          if (!options || options.useGlobalScope !== false)
            base = base || global[obj.string];
        } else if (obj.type == "string") {
          base = "";
        } else if (obj.type == "atom") {
          base = 1;
        } else if (obj.type == "function") {
          if (global.jQuery != null && (obj.string == '$' || obj.string == 'jQuery') &&
              (typeof global.jQuery == 'function'))
            base = global.jQuery();
          else if (global._ != null && (obj.string == '_') && (typeof global._ == 'function'))
            base = global._();
        }
        while (base != null && context.length)
          base = base[context.pop().string];
        if (base != null) gatherCompletions(base);
      } else {
        // If not, just look in the global object and any local scope
        // (reading into JS mode internals to get at the local and global variables)
        for (var v = token.state.localVars; v; v = v.next) maybeAdd(v.name);
        for (var v = token.state.globalVars; v; v = v.next) maybeAdd(v.name);
        if (!options || options.useGlobalScope !== false)
          gatherCompletions(global);
        forEach(keywords, maybeAdd);
      }
      return found;
    }
  });

/** HTML Hint from https://codemirror.net/addon/hint/html-hint.js */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"), require("./xml-hint"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror", "./xml-hint"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    "use strict";

    var langs = "ab aa af ak sq am ar an hy as av ae ay az bm ba eu be bn bh bi bs br bg my ca ch ce ny zh cv kw co cr hr cs da dv nl dz en eo et ee fo fj fi fr ff gl ka de el gn gu ht ha he hz hi ho hu ia id ie ga ig ik io is it iu ja jv kl kn kr ks kk km ki rw ky kv kg ko ku kj la lb lg li ln lo lt lu lv gv mk mg ms ml mt mi mr mh mn na nv nb nd ne ng nn no ii nr oc oj cu om or os pa pi fa pl ps pt qu rm rn ro ru sa sc sd se sm sg sr gd sn si sk sl so st es su sw ss sv ta te tg th ti bo tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa cy wo fy xh yi yo za zu".split(" ");
    var targets = ["_blank", "_self", "_top", "_parent"];
    var charsets = ["ascii", "utf-8", "utf-16", "latin1", "latin1"];
    var methods = ["get", "post", "put", "delete"];
    var encs = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
    var media = ["all", "screen", "print", "embossed", "braille", "handheld", "print", "projection", "screen", "tty", "tv", "speech",
                 "3d-glasses", "resolution [>][<][=] [X]", "device-aspect-ratio: X/Y", "orientation:portrait",
                 "orientation:landscape", "device-height: [X]", "device-width: [X]"];
    var s = { attrs: {} }; // Simple tag, reused for a whole lot of tags

    var data = {
      a: {
        attrs: {
          href: null, ping: null, type: null,
          media: media,
          target: targets,
          hreflang: langs
        }
      },
      abbr: s,
      acronym: s,
      address: s,
      applet: s,
      area: {
        attrs: {
          alt: null, coords: null, href: null, target: null, ping: null,
          media: media, hreflang: langs, type: null,
          shape: ["default", "rect", "circle", "poly"]
        }
      },
      article: s,
      aside: s,
      audio: {
        attrs: {
          src: null, mediagroup: null,
          crossorigin: ["anonymous", "use-credentials"],
          preload: ["none", "metadata", "auto"],
          autoplay: ["", "autoplay"],
          loop: ["", "loop"],
          controls: ["", "controls"]
        }
      },
      b: s,
      base: { attrs: { href: null, target: targets } },
      basefont: s,
      bdi: s,
      bdo: s,
      big: s,
      blockquote: { attrs: { cite: null } },
      body: s,
      br: s,
      button: {
        attrs: {
          form: null, formaction: null, name: null, value: null,
          autofocus: ["", "autofocus"],
          disabled: ["", "autofocus"],
          formenctype: encs,
          formmethod: methods,
          formnovalidate: ["", "novalidate"],
          formtarget: targets,
          type: ["submit", "reset", "button"]
        }
      },
      canvas: { attrs: { width: null, height: null } },
      caption: s,
      center: s,
      cite: s,
      code: s,
      col: { attrs: { span: null } },
      colgroup: { attrs: { span: null } },
      command: {
        attrs: {
          type: ["command", "checkbox", "radio"],
          label: null, icon: null, radiogroup: null, command: null, title: null,
          disabled: ["", "disabled"],
          checked: ["", "checked"]
        }
      },
      data: { attrs: { value: null } },
      datagrid: { attrs: { disabled: ["", "disabled"], multiple: ["", "multiple"] } },
      datalist: { attrs: { data: null } },
      dd: s,
      del: { attrs: { cite: null, datetime: null } },
      details: { attrs: { open: ["", "open"] } },
      dfn: s,
      dir: s,
      div: s,
      dl: s,
      dt: s,
      em: s,
      embed: { attrs: { src: null, type: null, width: null, height: null } },
      eventsource: { attrs: { src: null } },
      fieldset: { attrs: { disabled: ["", "disabled"], form: null, name: null } },
      figcaption: s,
      figure: s,
      font: s,
      footer: s,
      form: {
        attrs: {
          action: null, name: null,
          "accept-charset": charsets,
          autocomplete: ["on", "off"],
          enctype: encs,
          method: methods,
          novalidate: ["", "novalidate"],
          target: targets
        }
      },
      frame: s,
      frameset: s,
      h1: s, h2: s, h3: s, h4: s, h5: s, h6: s,
      head: {
        attrs: {},
        children: ["title", "base", "link", "style", "meta", "script", "noscript", "command"]
      },
      header: s,
      hgroup: s,
      hr: s,
      html: {
        attrs: { manifest: null },
        children: ["head", "body"]
      },
      i: s,
      iframe: {
        attrs: {
          src: null, srcdoc: null, name: null, width: null, height: null,
          sandbox: ["allow-top-navigation", "allow-same-origin", "allow-forms", "allow-scripts"],
          seamless: ["", "seamless"]
        }
      },
      img: {
        attrs: {
          alt: null, src: null, ismap: null, usemap: null, width: null, height: null,
          crossorigin: ["anonymous", "use-credentials"]
        }
      },
      input: {
        attrs: {
          alt: null, dirname: null, form: null, formaction: null,
          height: null, list: null, max: null, maxlength: null, min: null,
          name: null, pattern: null, placeholder: null, size: null, src: null,
          step: null, value: null, width: null,
          accept: ["audio/*", "video/*", "image/*"],
          autocomplete: ["on", "off"],
          autofocus: ["", "autofocus"],
          checked: ["", "checked"],
          disabled: ["", "disabled"],
          formenctype: encs,
          formmethod: methods,
          formnovalidate: ["", "novalidate"],
          formtarget: targets,
          multiple: ["", "multiple"],
          readonly: ["", "readonly"],
          required: ["", "required"],
          type: ["hidden", "text", "search", "tel", "url", "email", "password", "datetime", "date", "month",
                 "week", "time", "datetime-local", "number", "range", "color", "checkbox", "radio",
                 "file", "submit", "image", "reset", "button"]
        }
      },
      ins: { attrs: { cite: null, datetime: null } },
      kbd: s,
      keygen: {
        attrs: {
          challenge: null, form: null, name: null,
          autofocus: ["", "autofocus"],
          disabled: ["", "disabled"],
          keytype: ["RSA"]
        }
      },
      label: { attrs: { "for": null, form: null } },
      legend: s,
      li: { attrs: { value: null } },
      link: {
        attrs: {
          href: null, type: null,
          hreflang: langs,
          media: media,
          sizes: ["all", "16x16", "16x16 32x32", "16x16 32x32 64x64"]
        }
      },
      map: { attrs: { name: null } },
      mark: s,
      menu: { attrs: { label: null, type: ["list", "context", "toolbar"] } },
      meta: {
        attrs: {
          content: null,
          charset: charsets,
          name: ["viewport", "application-name", "author", "description", "generator", "keywords"],
          "http-equiv": ["content-language", "content-type", "default-style", "refresh"]
        }
      },
      meter: { attrs: { value: null, min: null, low: null, high: null, max: null, optimum: null } },
      nav: s,
      noframes: s,
      noscript: s,
      object: {
        attrs: {
          data: null, type: null, name: null, usemap: null, form: null, width: null, height: null,
          typemustmatch: ["", "typemustmatch"]
        }
      },
      ol: { attrs: { reversed: ["", "reversed"], start: null, type: ["1", "a", "A", "i", "I"] } },
      optgroup: { attrs: { disabled: ["", "disabled"], label: null } },
      option: { attrs: { disabled: ["", "disabled"], label: null, selected: ["", "selected"], value: null } },
      output: { attrs: { "for": null, form: null, name: null } },
      p: s,
      param: { attrs: { name: null, value: null } },
      pre: s,
      progress: { attrs: { value: null, max: null } },
      q: { attrs: { cite: null } },
      rp: s,
      rt: s,
      ruby: s,
      s: s,
      samp: s,
      script: {
        attrs: {
          type: ["text/javascript"],
          src: null,
          async: ["", "async"],
          defer: ["", "defer"],
          charset: charsets
        }
      },
      section: s,
      select: {
        attrs: {
          form: null, name: null, size: null,
          autofocus: ["", "autofocus"],
          disabled: ["", "disabled"],
          multiple: ["", "multiple"]
        }
      },
      small: s,
      source: { attrs: { src: null, type: null, media: null } },
      span: s,
      strike: s,
      strong: s,
      style: {
        attrs: {
          type: ["text/css"],
          media: media,
          scoped: null
        }
      },
      sub: s,
      summary: s,
      sup: s,
      table: s,
      tbody: s,
      td: { attrs: { colspan: null, rowspan: null, headers: null } },
      textarea: {
        attrs: {
          dirname: null, form: null, maxlength: null, name: null, placeholder: null,
          rows: null, cols: null,
          autofocus: ["", "autofocus"],
          disabled: ["", "disabled"],
          readonly: ["", "readonly"],
          required: ["", "required"],
          wrap: ["soft", "hard"]
        }
      },
      tfoot: s,
      th: { attrs: { colspan: null, rowspan: null, headers: null, scope: ["row", "col", "rowgroup", "colgroup"] } },
      thead: s,
      time: { attrs: { datetime: null } },
      title: s,
      tr: s,
      track: {
        attrs: {
          src: null, label: null, "default": null,
          kind: ["subtitles", "captions", "descriptions", "chapters", "metadata"],
          srclang: langs
        }
      },
      tt: s,
      u: s,
      ul: s,
      "var": s,
      video: {
        attrs: {
          src: null, poster: null, width: null, height: null,
          crossorigin: ["anonymous", "use-credentials"],
          preload: ["auto", "metadata", "none"],
          autoplay: ["", "autoplay"],
          mediagroup: ["movie"],
          muted: ["", "muted"],
          controls: ["", "controls"]
        }
      },
      wbr: s
    };

    var globalAttrs = {
      accesskey: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      "class": null,
      contenteditable: ["true", "false"],
      contextmenu: null,
      dir: ["ltr", "rtl", "auto"],
      draggable: ["true", "false", "auto"],
      dropzone: ["copy", "move", "link", "string:", "file:"],
      hidden: ["hidden"],
      id: null,
      inert: ["inert"],
      itemid: null,
      itemprop: null,
      itemref: null,
      itemscope: ["itemscope"],
      itemtype: null,
      lang: ["en", "es"],
      spellcheck: ["true", "false"],
      autocorrect: ["true", "false"],
      autocapitalize: ["true", "false"],
      style: null,
      tabindex: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      title: null,
      translate: ["yes", "no"],
      onclick: null,
      rel: ["stylesheet", "alternate", "author", "bookmark", "help", "license", "next", "nofollow", "noreferrer", "prefetch", "prev", "search", "tag"]
    };
    function populate(obj) {
      for (var attr in globalAttrs) if (globalAttrs.hasOwnProperty(attr))
        obj.attrs[attr] = globalAttrs[attr];
    }

    populate(s);
    for (var tag in data) if (data.hasOwnProperty(tag) && data[tag] != s)
      populate(data[tag]);

    CodeMirror.htmlSchema = data;
    function htmlHint(cm, options) {
      var local = {schemaInfo: data};
      if (options) for (var opt in options) local[opt] = options[opt];
      return CodeMirror.hint.xml(cm, local);
    }
    CodeMirror.registerHelper("hint", "html", htmlHint);
  });

/** XML Hint from https://codemirror.net/addon/hint/xml-hint.js */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    "use strict";

    var Pos = CodeMirror.Pos;

    function matches(hint, typed, matchInMiddle) {
      if (matchInMiddle) return hint.indexOf(typed) >= 0;
      else return hint.lastIndexOf(typed, 0) == 0;
    }

    function getHints(cm, options) {
      var tags = options && options.schemaInfo;
      var quote = (options && options.quoteChar) || '"';
      var matchInMiddle = options && options.matchInMiddle;
      if (!tags) return;
      var cur = cm.getCursor(), token = cm.getTokenAt(cur);
      if (token.end > cur.ch) {
        token.end = cur.ch;
        token.string = token.string.slice(0, cur.ch - token.start);
      }
      var inner = CodeMirror.innerMode(cm.getMode(), token.state);
      if (inner.mode.name != "xml") return;
      var result = [], replaceToken = false, prefix;
      var tag = /\btag\b/.test(token.type) && !/>$/.test(token.string);
      var tagName = tag && /^\w/.test(token.string), tagStart;

      if (tagName) {
        var before = cm.getLine(cur.line).slice(Math.max(0, token.start - 2), token.start);
        var tagType = /<\/$/.test(before) ? "close" : /<$/.test(before) ? "open" : null;
        if (tagType) tagStart = token.start - (tagType == "close" ? 2 : 1);
      } else if (tag && token.string == "<") {
        tagType = "open";
      } else if (tag && token.string == "</") {
        tagType = "close";
      }

      if (!tag && !inner.state.tagName || tagType) {
        if (tagName)
          prefix = token.string;
        replaceToken = tagType;
        var cx = inner.state.context, curTag = cx && tags[cx.tagName];
        var childList = cx ? curTag && curTag.children : tags["!top"];
        if (childList && tagType != "close") {
          for (var i = 0; i < childList.length; ++i) if (!prefix || matches(childList[i], prefix, matchInMiddle))
            result.push("<" + childList[i]);
        } else if (tagType != "close") {
          for (var name in tags)
            if (tags.hasOwnProperty(name) && name != "!top" && name != "!attrs" && (!prefix || matches(name, prefix, matchInMiddle)))
              result.push("<" + name);
        }
        if (cx && (!prefix || tagType == "close" && matches(cx.tagName, prefix, matchInMiddle)))
          result.push("</" + cx.tagName + ">");
      } else {
        // Attribute completion
        var curTag = tags[inner.state.tagName], attrs = curTag && curTag.attrs;
        var globalAttrs = tags["!attrs"];
        if (!attrs && !globalAttrs) return;
        if (!attrs) {
          attrs = globalAttrs;
        } else if (globalAttrs) { // Combine tag-local and global attributes
          var set = {};
          for (var nm in globalAttrs) if (globalAttrs.hasOwnProperty(nm)) set[nm] = globalAttrs[nm];
          for (var nm in attrs) if (attrs.hasOwnProperty(nm)) set[nm] = attrs[nm];
          attrs = set;
        }
        if (token.type == "string" || token.string == "=") { // A value
          var before = cm.getRange(Pos(cur.line, Math.max(0, cur.ch - 60)),
                                   Pos(cur.line, token.type == "string" ? token.start : token.end));
          var atName = before.match(/([^\s\u00a0=<>\"\']+)=$/), atValues;
          if (!atName || !attrs.hasOwnProperty(atName[1]) || !(atValues = attrs[atName[1]])) return;
          if (typeof atValues == 'function') atValues = atValues.call(this, cm); // Functions can be used to supply values for autocomplete widget
          if (token.type == "string") {
            prefix = token.string;
            var n = 0;
            if (/['"]/.test(token.string.charAt(0))) {
              quote = token.string.charAt(0);
              prefix = token.string.slice(1);
              n++;
            }
            var len = token.string.length;
            if (/['"]/.test(token.string.charAt(len - 1))) {
              quote = token.string.charAt(len - 1);
              prefix = token.string.substr(n, len - 2);
            }
            if (n) { // an opening quote
              var line = cm.getLine(cur.line);
              if (line.length > token.end && line.charAt(token.end) == quote) token.end++; // include a closing quote
            }
            replaceToken = true;
          }
          for (var i = 0; i < atValues.length; ++i) if (!prefix || matches(atValues[i], prefix, matchInMiddle))
            result.push(quote + atValues[i] + quote);
        } else { // An attribute name
          if (token.type == "attribute") {
            prefix = token.string;
            replaceToken = true;
          }
          for (var attr in attrs) if (attrs.hasOwnProperty(attr) && (!prefix || matches(attr, prefix, matchInMiddle)))
            result.push(attr);
        }
      }
      return {
        list: result,
        from: replaceToken ? Pos(cur.line, tagStart == null ? token.start : tagStart) : cur,
        to: replaceToken ? Pos(cur.line, token.end) : cur
      };
    }

    CodeMirror.registerHelper("hint", "xml", getHints);
  });

/** CSS Hint from https://codemirror.net/addon/hint/css-hint.js */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"), require("../../mode/css/css"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror", "../../mode/css/css"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    "use strict";

    var pseudoClasses = {link: 1, visited: 1, active: 1, hover: 1, focus: 1,
                         "first-letter": 1, "first-line": 1, "first-child": 1,
                         before: 1, after: 1, lang: 1};

    CodeMirror.registerHelper("hint", "css", function(cm) {
      var cur = cm.getCursor(), token = cm.getTokenAt(cur);
      var inner = CodeMirror.innerMode(cm.getMode(), token.state);
      if (inner.mode.name != "css") return;

      if (token.type == "keyword" && "!important".indexOf(token.string) == 0)
        return {list: ["!important"], from: CodeMirror.Pos(cur.line, token.start),
                to: CodeMirror.Pos(cur.line, token.end)};

      var start = token.start, end = cur.ch, word = token.string.slice(0, end - start);
      if (/[^\w$_-]/.test(word)) {
        word = ""; start = end = cur.ch;
      }

      var spec = CodeMirror.resolveMode("text/css");

      var result = [];
      function add(keywords) {
        for (var name in keywords)
          if (!word || name.lastIndexOf(word, 0) == 0)
            result.push(name);
      }

      var st = inner.state.state;
      if (st == "pseudo" || token.type == "variable-3") {
        add(pseudoClasses);
      } else if (st == "block" || st == "maybeprop") {
        add(spec.propertyKeywords);
      } else if (st == "prop" || st == "parens" || st == "at" || st == "params") {
        add(spec.valueKeywords);
        add(spec.colorKeywords);
      } else if (st == "media" || st == "media_parens") {
        add(spec.mediaTypes);
        add(spec.mediaFeatures);
      }

      if (result.length) return {
        list: result,
        from: CodeMirror.Pos(cur.line, start),
        to: CodeMirror.Pos(cur.line, end)
      };
    });
  });

  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
	  mod(require("../../lib/codemirror"), require("../fold/xml-fold"));
	else if (typeof define == "function" && define.amd) // AMD
	  define(["../../lib/codemirror", "../fold/xml-fold"], mod);
	else // Plain browser env
	  mod(CodeMirror);
  })(function(CodeMirror) {
	"use strict";

	CodeMirror.defineOption("matchTags", false, function(cm, val, old) {
	  if (old && old != CodeMirror.Init) {
		cm.off("cursorActivity", doMatchTags);
		cm.off("viewportChange", maybeUpdateMatch);
		clear(cm);
	  }
	  if (val) {
		cm.state.matchBothTags = typeof val == "object" && val.bothTags;
		cm.on("cursorActivity", doMatchTags);
		cm.on("viewportChange", maybeUpdateMatch);
		doMatchTags(cm);
	  }
	});

	function clear(cm) {
	  if (cm.state.tagHit) cm.state.tagHit.clear();
	  if (cm.state.tagOther) cm.state.tagOther.clear();
	  cm.state.tagHit = cm.state.tagOther = null;
	}

	function doMatchTags(cm) {
	  cm.state.failedTagMatch = false;
	  cm.operation(function() {
		clear(cm);
		if (cm.somethingSelected()) return;
		var cur = cm.getCursor(), range = cm.getViewport();
		range.from = Math.min(range.from, cur.line); range.to = Math.max(cur.line + 1, range.to);
		var match = CodeMirror.findMatchingTag(cm, cur, range);
		if (!match) return;
		if (cm.state.matchBothTags) {
		  var hit = match.at == "open" ? match.open : match.close;
		  if (hit) cm.state.tagHit = cm.markText(hit.from, hit.to, {className: "CodeMirror-matchingtag"});
		}
		var other = match.at == "close" ? match.open : match.close;
		if (other)
		  cm.state.tagOther = cm.markText(other.from, other.to, {className: "CodeMirror-matchingtag"});
		else
		  cm.state.failedTagMatch = true;
	  });
	}

	function maybeUpdateMatch(cm) {
	  if (cm.state.failedTagMatch) doMatchTags(cm);
	}

	CodeMirror.commands.toMatchingTag = function(cm) {
	  var found = CodeMirror.findMatchingTag(cm, cm.getCursor());
	  if (found) {
		var other = found.at == "close" ? found.open : found.close;
		if (other) cm.extendSelection(other.to, other.from);
	  }
	};
  });



  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
	  mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
	  define(["../../lib/codemirror"], mod);
	else // Plain browser env
	  mod(CodeMirror);
  })(function(CodeMirror) {
	var defaults = {
	  pairs: "()[]{}''\"\"",
	  closeBefore: ")]}'\":;>",
	  triples: "",
	  explode: "[]{}"
	};

	var Pos = CodeMirror.Pos;

	CodeMirror.defineOption("autoCloseBrackets", false, function(cm, val, old) {
	  if (old && old != CodeMirror.Init) {
		cm.removeKeyMap(keyMap);
		cm.state.closeBrackets = null;
	  }
	  if (val) {
		ensureBound(getOption(val, "pairs"))
		cm.state.closeBrackets = val;
		cm.addKeyMap(keyMap);
	  }
	});

	function getOption(conf, name) {
	  if (name == "pairs" && typeof conf == "string") return conf;
	  if (typeof conf == "object" && conf[name] != null) return conf[name];
	  return defaults[name];
	}

	var keyMap = {Backspace: handleBackspace, Enter: handleEnter};
	function ensureBound(chars) {
	  for (var i = 0; i < chars.length; i++) {
		var ch = chars.charAt(i), key = "'" + ch + "'"
		if (!keyMap[key]) keyMap[key] = handler(ch)
	  }
	}
	ensureBound(defaults.pairs + "`")

	function handler(ch) {
	  return function(cm) { return handleChar(cm, ch); };
	}

	function getConfig(cm) {
	  var deflt = cm.state.closeBrackets;
	  if (!deflt || deflt.override) return deflt;
	  var mode = cm.getModeAt(cm.getCursor());
	  return mode.closeBrackets || deflt;
	}

	function handleBackspace(cm) {
	  var conf = getConfig(cm);
	  if (!conf || cm.getOption("disableInput")) return CodeMirror.Pass;

	  var pairs = getOption(conf, "pairs");
	  var ranges = cm.listSelections();
	  for (var i = 0; i < ranges.length; i++) {
		if (!ranges[i].empty()) return CodeMirror.Pass;
		var around = charsAround(cm, ranges[i].head);
		if (!around || pairs.indexOf(around) % 2 != 0) return CodeMirror.Pass;
	  }
	  for (var i = ranges.length - 1; i >= 0; i--) {
		var cur = ranges[i].head;
		cm.replaceRange("", Pos(cur.line, cur.ch - 1), Pos(cur.line, cur.ch + 1), "+delete");
	  }
	}

	function handleEnter(cm) {
	  var conf = getConfig(cm);
	  var explode = conf && getOption(conf, "explode");
	  if (!explode || cm.getOption("disableInput")) return CodeMirror.Pass;

	  var ranges = cm.listSelections();
	  for (var i = 0; i < ranges.length; i++) {
		if (!ranges[i].empty()) return CodeMirror.Pass;
		var around = charsAround(cm, ranges[i].head);
		if (!around || explode.indexOf(around) % 2 != 0) return CodeMirror.Pass;
	  }
	  cm.operation(function() {
		var linesep = cm.lineSeparator() || "\n";
		cm.replaceSelection(linesep + linesep, null);
		cm.execCommand("goCharLeft");
		ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
		  var line = ranges[i].head.line;
		  cm.indentLine(line, null, true);
		  cm.indentLine(line + 1, null, true);
		}
	  });
	}

	function contractSelection(sel) {
	  var inverted = CodeMirror.cmpPos(sel.anchor, sel.head) > 0;
	  return {anchor: new Pos(sel.anchor.line, sel.anchor.ch + (inverted ? -1 : 1)),
			  head: new Pos(sel.head.line, sel.head.ch + (inverted ? 1 : -1))};
	}

	function handleChar(cm, ch) {
	  var conf = getConfig(cm);
	  if (!conf || cm.getOption("disableInput")) return CodeMirror.Pass;

	  var pairs = getOption(conf, "pairs");
	  var pos = pairs.indexOf(ch);
	  if (pos == -1) return CodeMirror.Pass;

	  var closeBefore = getOption(conf,"closeBefore");

	  var triples = getOption(conf, "triples");

	  var identical = pairs.charAt(pos + 1) == ch;
	  var ranges = cm.listSelections();
	  var opening = pos % 2 == 0;

	  var type;
	  for (var i = 0; i < ranges.length; i++) {
		var range = ranges[i], cur = range.head, curType;
		var next = cm.getRange(cur, Pos(cur.line, cur.ch + 1));
		if (opening && !range.empty()) {
		  curType = "surround";
		} else if ((identical || !opening) && next == ch) {
		  if (identical && stringStartsAfter(cm, cur))
			curType = "both";
		  else if (triples.indexOf(ch) >= 0 && cm.getRange(cur, Pos(cur.line, cur.ch + 3)) == ch + ch + ch)
			curType = "skipThree";
		  else
			curType = "skip";
		} else if (identical && cur.ch > 1 && triples.indexOf(ch) >= 0 &&
				   cm.getRange(Pos(cur.line, cur.ch - 2), cur) == ch + ch) {
		  if (cur.ch > 2 && /\bstring/.test(cm.getTokenTypeAt(Pos(cur.line, cur.ch - 2)))) return CodeMirror.Pass;
		  curType = "addFour";
		} else if (identical) {
		  var prev = cur.ch == 0 ? " " : cm.getRange(Pos(cur.line, cur.ch - 1), cur)
		  if (!CodeMirror.isWordChar(next) && prev != ch && !CodeMirror.isWordChar(prev)) curType = "both";
		  else return CodeMirror.Pass;
		} else if (opening && (next.length === 0 || /\s/.test(next) || closeBefore.indexOf(next) > -1)) {
		  curType = "both";
		} else {
		  return CodeMirror.Pass;
		}
		if (!type) type = curType;
		else if (type != curType) return CodeMirror.Pass;
	  }

	  var left = pos % 2 ? pairs.charAt(pos - 1) : ch;
	  var right = pos % 2 ? ch : pairs.charAt(pos + 1);
	  cm.operation(function() {
		if (type == "skip") {
		  cm.execCommand("goCharRight");
		} else if (type == "skipThree") {
		  for (var i = 0; i < 3; i++)
			cm.execCommand("goCharRight");
		} else if (type == "surround") {
		  var sels = cm.getSelections();
		  for (var i = 0; i < sels.length; i++)
			sels[i] = left + sels[i] + right;
		  cm.replaceSelections(sels, "around");
		  sels = cm.listSelections().slice();
		  for (var i = 0; i < sels.length; i++)
			sels[i] = contractSelection(sels[i]);
		  cm.setSelections(sels);
		} else if (type == "both") {
		  cm.replaceSelection(left + right, null);
		  cm.triggerElectric(left + right);
		  cm.execCommand("goCharLeft");
		} else if (type == "addFour") {
		  cm.replaceSelection(left + left + left + left, "before");
		  cm.execCommand("goCharRight");
		}
	  });
	}

	function charsAround(cm, pos) {
	  var str = cm.getRange(Pos(pos.line, pos.ch - 1),
							Pos(pos.line, pos.ch + 1));
	  return str.length == 2 ? str : null;
	}

	function stringStartsAfter(cm, pos) {
	  var token = cm.getTokenAt(Pos(pos.line, pos.ch + 1))
	  return /\bstring/.test(token.type) && token.start == pos.ch &&
		(pos.ch == 0 || !/\bstring/.test(cm.getTokenTypeAt(pos)))
	}
  });

  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

/**
 * Tag-closer extension for CodeMirror.
 *
 * This extension adds an "autoCloseTags" option that can be set to
 * either true to get the default behavior, or an object to further
 * configure its behavior.
 *
 * These are supported options:
 *
 * `whenClosing` (default true)
 *   Whether to autoclose when the '/' of a closing tag is typed.
 * `whenOpening` (default true)
 *   Whether to autoclose the tag when the final '>' of an opening
 *   tag is typed.
 * `dontCloseTags` (default is empty tags for HTML, none for XML)
 *   An array of tag names that should not be autoclosed.
 * `indentTags` (default is block tags for HTML, none for XML)
 *   An array of tag names that should, when opened, cause a
 *   blank line to be added inside the tag, and the blank line and
 *   closing line to be indented.
 * `emptyTags` (default is none)
 *   An array of XML tag names that should be autoclosed with '/>'.
 *
 * See demos/closetag.html for a usage example.
 */

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
	  mod(require("../../lib/codemirror"), require("../fold/xml-fold"));
	else if (typeof define == "function" && define.amd) // AMD
	  define(["../../lib/codemirror", "../fold/xml-fold"], mod);
	else // Plain browser env
	  mod(CodeMirror);
  })(function(CodeMirror) {
	CodeMirror.defineOption("autoCloseTags", false, function(cm, val, old) {
	  if (old != CodeMirror.Init && old)
		cm.removeKeyMap("autoCloseTags");
	  if (!val) return;
	  var map = {name: "autoCloseTags"};
	  if (typeof val != "object" || val.whenClosing)
		map["'/'"] = function(cm) { return autoCloseSlash(cm); };
	  if (typeof val != "object" || val.whenOpening)
		map["'>'"] = function(cm) { return autoCloseGT(cm); };
	  cm.addKeyMap(map);
	});

	var htmlDontClose = ["area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen", "link", "meta", "param",
						 "source", "track", "wbr"];
	var htmlIndent = ["applet", "blockquote", "body", "button", "div", "dl", "fieldset", "form", "frameset", "h1", "h2", "h3", "h4",
					  "h5", "h6", "head", "html", "iframe", "layer", "legend", "object", "ol", "p", "select", "table", "ul"];

	function autoCloseGT(cm) {
	  if (cm.getOption("disableInput")) return CodeMirror.Pass;
	  var ranges = cm.listSelections(), replacements = [];
	  var opt = cm.getOption("autoCloseTags");
	  for (var i = 0; i < ranges.length; i++) {
		if (!ranges[i].empty()) return CodeMirror.Pass;
		var pos = ranges[i].head, tok = cm.getTokenAt(pos);
		var inner = CodeMirror.innerMode(cm.getMode(), tok.state), state = inner.state;
		if (inner.mode.name != "xml" || !state.tagName) return CodeMirror.Pass;

		var html = inner.mode.configuration == "html";
		var dontCloseTags = (typeof opt == "object" && opt.dontCloseTags) || (html && htmlDontClose);
		var indentTags = (typeof opt == "object" && opt.indentTags) || (html && htmlIndent);

		var tagName = state.tagName;
		if (tok.end > pos.ch) tagName = tagName.slice(0, tagName.length - tok.end + pos.ch);
		var lowerTagName = tagName.toLowerCase();
		// Don't process the '>' at the end of an end-tag or self-closing tag
		if (!tagName ||
			tok.type == "string" && (tok.end != pos.ch || !/[\"\']/.test(tok.string.charAt(tok.string.length - 1)) || tok.string.length == 1) ||
			tok.type == "tag" && state.type == "closeTag" ||
			tok.string.indexOf("/") == (tok.string.length - 1) || // match something like <someTagName />
			dontCloseTags && indexOf(dontCloseTags, lowerTagName) > -1 ||
			closingTagExists(cm, tagName, pos, state, true))
		  return CodeMirror.Pass;

		var emptyTags = typeof opt == "object" && opt.emptyTags;
		if (emptyTags && indexOf(emptyTags, tagName) > -1) {
		  replacements[i] = { text: "/>", newPos: CodeMirror.Pos(pos.line, pos.ch + 2) };
		  continue;
		}

		var indent = indentTags && indexOf(indentTags, lowerTagName) > -1;
		replacements[i] = {indent: indent,
						   text: ">" + (indent ? "\n\n" : "") + "</" + tagName + ">",
						   newPos: indent ? CodeMirror.Pos(pos.line + 1, 0) : CodeMirror.Pos(pos.line, pos.ch + 1)};
	  }

	  var dontIndentOnAutoClose = (typeof opt == "object" && opt.dontIndentOnAutoClose);
	  for (var i = ranges.length - 1; i >= 0; i--) {
		var info = replacements[i];
		cm.replaceRange(info.text, ranges[i].head, ranges[i].anchor, "+insert");
		var sel = cm.listSelections().slice(0);
		sel[i] = {head: info.newPos, anchor: info.newPos};
		cm.setSelections(sel);
		if (!dontIndentOnAutoClose && info.indent) {
		  cm.indentLine(info.newPos.line, null, true);
		  cm.indentLine(info.newPos.line + 1, null, true);
		}
	  }
	}

	function autoCloseCurrent(cm, typingSlash) {
	  var ranges = cm.listSelections(), replacements = [];
	  var head = typingSlash ? "/" : "</";
	  var opt = cm.getOption("autoCloseTags");
	  var dontIndentOnAutoClose = (typeof opt == "object" && opt.dontIndentOnSlash);
	  for (var i = 0; i < ranges.length; i++) {
		if (!ranges[i].empty()) return CodeMirror.Pass;
		var pos = ranges[i].head, tok = cm.getTokenAt(pos);
		var inner = CodeMirror.innerMode(cm.getMode(), tok.state), state = inner.state;
		if (typingSlash && (tok.type == "string" || tok.string.charAt(0) != "<" ||
							tok.start != pos.ch - 1))
		  return CodeMirror.Pass;
		// Kludge to get around the fact that we are not in XML mode
		// when completing in JS/CSS snippet in htmlmixed mode. Does not
		// work for other XML embedded languages (there is no general
		// way to go from a mixed mode to its current XML state).
		var replacement;
		if (inner.mode.name != "xml") {
		  if (cm.getMode().name == "htmlmixed" && inner.mode.name == "javascript")
			replacement = head + "script";
		  else if (cm.getMode().name == "htmlmixed" && inner.mode.name == "css")
			replacement = head + "style";
		  else
			return CodeMirror.Pass;
		} else {
		  if (!state.context || !state.context.tagName ||
			  closingTagExists(cm, state.context.tagName, pos, state))
			return CodeMirror.Pass;
		  replacement = head + state.context.tagName;
		}
		if (cm.getLine(pos.line).charAt(tok.end) != ">") replacement += ">";
		replacements[i] = replacement;
	  }
	  cm.replaceSelections(replacements);
	  ranges = cm.listSelections();
	  if (!dontIndentOnAutoClose) {
		  for (var i = 0; i < ranges.length; i++)
			  if (i == ranges.length - 1 || ranges[i].head.line < ranges[i + 1].head.line)
				  cm.indentLine(ranges[i].head.line);
	  }
	}

	function autoCloseSlash(cm) {
	  if (cm.getOption("disableInput")) return CodeMirror.Pass;
	  return autoCloseCurrent(cm, true);
	}

	CodeMirror.commands.closeTag = function(cm) { return autoCloseCurrent(cm); };

	function indexOf(collection, elt) {
	  if (collection.indexOf) return collection.indexOf(elt);
	  for (var i = 0, e = collection.length; i < e; ++i)
		if (collection[i] == elt) return i;
	  return -1;
	}

	// If xml-fold is loaded, we use its functionality to try and verify
	// whether a given tag is actually unclosed.
	function closingTagExists(cm, tagName, pos, state, newTag) {
	  if (!CodeMirror.scanForClosingTag) return false;
	  var end = Math.min(cm.lastLine() + 1, pos.line + 500);
	  var nextClose = CodeMirror.scanForClosingTag(cm, pos, null, end);
	  if (!nextClose || nextClose.tag != tagName) return false;
	  var cx = state.context;
	  // If the immediate wrapping context contains onCx instances of
	  // the same tag, a closing tag only exists if there are at least
	  // that many closing tags of that type following.
	  for (var onCx = newTag ? 1 : 0; cx && cx.tagName == tagName; cx = cx.prev) ++onCx;
	  pos = nextClose.to;
	  for (var i = 1; i < onCx; i++) {
		var next = CodeMirror.scanForClosingTag(cm, pos, null, end);
		if (!next || next.tag != tagName) return false;
		pos = next.to;
	  }
	  return true;
	}
  });

  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
	  mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
	  define(["../../lib/codemirror"], mod);
	else // Plain browser env
	  mod(CodeMirror);
  })(function(CodeMirror) {
	"use strict";

	var Pos = CodeMirror.Pos;
	function cmp(a, b) { return a.line - b.line || a.ch - b.ch; }

	var nameStartChar = "A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
	var nameChar = nameStartChar + "\-\:\.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
	var xmlTagStart = new RegExp("<(/?)([" + nameStartChar + "][" + nameChar + "]*)", "g");

	function Iter(cm, line, ch, range) {
	  this.line = line; this.ch = ch;
	  this.cm = cm; this.text = cm.getLine(line);
	  this.min = range ? Math.max(range.from, cm.firstLine()) : cm.firstLine();
	  this.max = range ? Math.min(range.to - 1, cm.lastLine()) : cm.lastLine();
	}

	function tagAt(iter, ch) {
	  var type = iter.cm.getTokenTypeAt(Pos(iter.line, ch));
	  return type && /\btag\b/.test(type);
	}

	function nextLine(iter) {
	  if (iter.line >= iter.max) return;
	  iter.ch = 0;
	  iter.text = iter.cm.getLine(++iter.line);
	  return true;
	}
	function prevLine(iter) {
	  if (iter.line <= iter.min) return;
	  iter.text = iter.cm.getLine(--iter.line);
	  iter.ch = iter.text.length;
	  return true;
	}

	function toTagEnd(iter) {
	  for (;;) {
		var gt = iter.text.indexOf(">", iter.ch);
		if (gt == -1) { if (nextLine(iter)) continue; else return; }
		if (!tagAt(iter, gt + 1)) { iter.ch = gt + 1; continue; }
		var lastSlash = iter.text.lastIndexOf("/", gt);
		var selfClose = lastSlash > -1 && !/\S/.test(iter.text.slice(lastSlash + 1, gt));
		iter.ch = gt + 1;
		return selfClose ? "selfClose" : "regular";
	  }
	}
	function toTagStart(iter) {
	  for (;;) {
		var lt = iter.ch ? iter.text.lastIndexOf("<", iter.ch - 1) : -1;
		if (lt == -1) { if (prevLine(iter)) continue; else return; }
		if (!tagAt(iter, lt + 1)) { iter.ch = lt; continue; }
		xmlTagStart.lastIndex = lt;
		iter.ch = lt;
		var match = xmlTagStart.exec(iter.text);
		if (match && match.index == lt) return match;
	  }
	}

	function toNextTag(iter) {
	  for (;;) {
		xmlTagStart.lastIndex = iter.ch;
		var found = xmlTagStart.exec(iter.text);
		if (!found) { if (nextLine(iter)) continue; else return; }
		if (!tagAt(iter, found.index + 1)) { iter.ch = found.index + 1; continue; }
		iter.ch = found.index + found[0].length;
		return found;
	  }
	}
	function toPrevTag(iter) {
	  for (;;) {
		var gt = iter.ch ? iter.text.lastIndexOf(">", iter.ch - 1) : -1;
		if (gt == -1) { if (prevLine(iter)) continue; else return; }
		if (!tagAt(iter, gt + 1)) { iter.ch = gt; continue; }
		var lastSlash = iter.text.lastIndexOf("/", gt);
		var selfClose = lastSlash > -1 && !/\S/.test(iter.text.slice(lastSlash + 1, gt));
		iter.ch = gt + 1;
		return selfClose ? "selfClose" : "regular";
	  }
	}

	function findMatchingClose(iter, tag) {
	  var stack = [];
	  for (;;) {
		var next = toNextTag(iter), end, startLine = iter.line, startCh = iter.ch - (next ? next[0].length : 0);
		if (!next || !(end = toTagEnd(iter))) return;
		if (end == "selfClose") continue;
		if (next[1]) { // closing tag
		  for (var i = stack.length - 1; i >= 0; --i) if (stack[i] == next[2]) {
			stack.length = i;
			break;
		  }
		  if (i < 0 && (!tag || tag == next[2])) return {
			tag: next[2],
			from: Pos(startLine, startCh),
			to: Pos(iter.line, iter.ch)
		  };
		} else { // opening tag
		  stack.push(next[2]);
		}
	  }
	}
	function findMatchingOpen(iter, tag) {
	  var stack = [];
	  for (;;) {
		var prev = toPrevTag(iter);
		if (!prev) return;
		if (prev == "selfClose") { toTagStart(iter); continue; }
		var endLine = iter.line, endCh = iter.ch;
		var start = toTagStart(iter);
		if (!start) return;
		if (start[1]) { // closing tag
		  stack.push(start[2]);
		} else { // opening tag
		  for (var i = stack.length - 1; i >= 0; --i) if (stack[i] == start[2]) {
			stack.length = i;
			break;
		  }
		  if (i < 0 && (!tag || tag == start[2])) return {
			tag: start[2],
			from: Pos(iter.line, iter.ch),
			to: Pos(endLine, endCh)
		  };
		}
	  }
	}

	CodeMirror.registerHelper("fold", "xml", function(cm, start) {
	  var iter = new Iter(cm, start.line, 0);
	  for (;;) {
		var openTag = toNextTag(iter)
		if (!openTag || iter.line != start.line) return
		var end = toTagEnd(iter)
		if (!end) return
		if (!openTag[1] && end != "selfClose") {
		  var startPos = Pos(iter.line, iter.ch);
		  var endPos = findMatchingClose(iter, openTag[2]);
		  return endPos && cmp(endPos.from, startPos) > 0 ? {from: startPos, to: endPos.from} : null
		}
	  }
	});
	CodeMirror.findMatchingTag = function(cm, pos, range) {
	  var iter = new Iter(cm, pos.line, pos.ch, range);
	  if (iter.text.indexOf(">") == -1 && iter.text.indexOf("<") == -1) return;
	  var end = toTagEnd(iter), to = end && Pos(iter.line, iter.ch);
	  var start = end && toTagStart(iter);
	  if (!end || !start || cmp(iter, pos) > 0) return;
	  var here = {from: Pos(iter.line, iter.ch), to: to, tag: start[2]};
	  if (end == "selfClose") return {open: here, close: null, at: "open"};

	  if (start[1]) { // closing tag
		return {open: findMatchingOpen(iter, start[2]), close: here, at: "close"};
	  } else { // opening tag
		iter = new Iter(cm, to.line, to.ch, range);
		return {open: here, close: findMatchingClose(iter, start[2]), at: "open"};
	  }
	};

	CodeMirror.findEnclosingTag = function(cm, pos, range, tag) {
	  var iter = new Iter(cm, pos.line, pos.ch, range);
	  for (;;) {
		var open = findMatchingOpen(iter, tag);
		if (!open) break;
		var forward = new Iter(cm, pos.line, pos.ch, range);
		var close = findMatchingClose(forward, open.tag);
		if (close) return {open: open, close: close};
	  }
	};

	// Used by addon/edit/closetag.js
	CodeMirror.scanForClosingTag = function(cm, pos, name, end) {
	  var iter = new Iter(cm, pos.line, pos.ch, end ? {from: 0, to: end} : null);
	  return findMatchingClose(iter, name);
	};
  });
