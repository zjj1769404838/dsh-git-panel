window.__ModuleLoader__.load({ id: "@zjj/dsh-git-panel", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/prismjs/prism.js
var require_prism = __commonJS({
  "node_modules/prismjs/prism.js"(exports, module2) {
    var _self = typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope ? self : {};
    var Prism3 = (function(_self2) {
      var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
      var uniqueId = 0;
      var plainTextGrammar = {};
      var _ = {
        /**
         * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
         * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
         * additional languages or plugins yourself.
         *
         * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
         *
         * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
         * empty Prism object into the global scope before loading the Prism script like this:
         *
         * ```js
         * window.Prism = window.Prism || {};
         * Prism.manual = true;
         * // add a new <script> to load Prism's script
         * ```
         *
         * @default false
         * @type {boolean}
         * @memberof Prism
         * @public
         */
        manual: _self2.Prism && _self2.Prism.manual,
        /**
         * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
         * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
         * own worker, you don't want it to do this.
         *
         * By setting this value to `true`, Prism will not add its own listeners to the worker.
         *
         * You obviously have to change this value before Prism executes. To do this, you can add an
         * empty Prism object into the global scope before loading the Prism script like this:
         *
         * ```js
         * window.Prism = window.Prism || {};
         * Prism.disableWorkerMessageHandler = true;
         * // Load Prism's script
         * ```
         *
         * @default false
         * @type {boolean}
         * @memberof Prism
         * @public
         */
        disableWorkerMessageHandler: _self2.Prism && _self2.Prism.disableWorkerMessageHandler,
        /**
         * A namespace for utility methods.
         *
         * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
         * change or disappear at any time.
         *
         * @namespace
         * @memberof Prism
         */
        util: {
          encode: function encode(tokens) {
            if (tokens instanceof Token) {
              return new Token(tokens.type, encode(tokens.content), tokens.alias);
            } else if (Array.isArray(tokens)) {
              return tokens.map(encode);
            } else {
              return tokens.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
            }
          },
          /**
           * Returns the name of the type of the given value.
           *
           * @param {any} o
           * @returns {string}
           * @example
           * type(null)      === 'Null'
           * type(undefined) === 'Undefined'
           * type(123)       === 'Number'
           * type('foo')     === 'String'
           * type(true)      === 'Boolean'
           * type([1, 2])    === 'Array'
           * type({})        === 'Object'
           * type(String)    === 'Function'
           * type(/abc+/)    === 'RegExp'
           */
          type: function(o) {
            return Object.prototype.toString.call(o).slice(8, -1);
          },
          /**
           * Returns a unique number for the given object. Later calls will still return the same number.
           *
           * @param {Object} obj
           * @returns {number}
           */
          objId: function(obj) {
            if (!obj["__id"]) {
              Object.defineProperty(obj, "__id", { value: ++uniqueId });
            }
            return obj["__id"];
          },
          /**
           * Creates a deep clone of the given object.
           *
           * The main intended use of this function is to clone language definitions.
           *
           * @param {T} o
           * @param {Record<number, any>} [visited]
           * @returns {T}
           * @template T
           */
          clone: function deepClone(o, visited) {
            visited = visited || {};
            var clone;
            var id;
            switch (_.util.type(o)) {
              case "Object":
                id = _.util.objId(o);
                if (visited[id]) {
                  return visited[id];
                }
                clone = /** @type {Record<string, any>} */
                {};
                visited[id] = clone;
                for (var key in o) {
                  if (o.hasOwnProperty(key)) {
                    clone[key] = deepClone(o[key], visited);
                  }
                }
                return (
                  /** @type {any} */
                  clone
                );
              case "Array":
                id = _.util.objId(o);
                if (visited[id]) {
                  return visited[id];
                }
                clone = [];
                visited[id] = clone;
                /** @type {Array} */
                /** @type {any} */
                o.forEach(function(v, i) {
                  clone[i] = deepClone(v, visited);
                });
                return (
                  /** @type {any} */
                  clone
                );
              default:
                return o;
            }
          },
          /**
           * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
           *
           * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
           *
           * @param {Element} element
           * @returns {string}
           */
          getLanguage: function(element) {
            while (element) {
              var m = lang.exec(element.className);
              if (m) {
                return m[1].toLowerCase();
              }
              element = element.parentElement;
            }
            return "none";
          },
          /**
           * Sets the Prism `language-xxxx` class of the given element.
           *
           * @param {Element} element
           * @param {string} language
           * @returns {void}
           */
          setLanguage: function(element, language) {
            element.className = element.className.replace(RegExp(lang, "gi"), "");
            element.classList.add("language-" + language);
          },
          /**
           * Returns the script element that is currently executing.
           *
           * This does __not__ work for line script element.
           *
           * @returns {HTMLScriptElement | null}
           */
          currentScript: function() {
            if (typeof document === "undefined") {
              return null;
            }
            if (document.currentScript && document.currentScript.tagName === "SCRIPT" && 1 < 2) {
              return (
                /** @type {any} */
                document.currentScript
              );
            }
            try {
              throw new Error();
            } catch (err) {
              var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
              if (src) {
                var scripts = document.getElementsByTagName("script");
                for (var i in scripts) {
                  if (scripts[i].src == src) {
                    return scripts[i];
                  }
                }
              }
              return null;
            }
          },
          /**
           * Returns whether a given class is active for `element`.
           *
           * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
           * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
           * given class is just the given class with a `no-` prefix.
           *
           * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
           * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
           * ancestors have the given class or the negated version of it, then the default activation will be returned.
           *
           * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
           * version of it, the class is considered active.
           *
           * @param {Element} element
           * @param {string} className
           * @param {boolean} [defaultActivation=false]
           * @returns {boolean}
           */
          isActive: function(element, className, defaultActivation) {
            var no = "no-" + className;
            while (element) {
              var classList = element.classList;
              if (classList.contains(className)) {
                return true;
              }
              if (classList.contains(no)) {
                return false;
              }
              element = element.parentElement;
            }
            return !!defaultActivation;
          }
        },
        /**
         * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
         *
         * @namespace
         * @memberof Prism
         * @public
         */
        languages: {
          /**
           * The grammar for plain, unformatted text.
           */
          plain: plainTextGrammar,
          plaintext: plainTextGrammar,
          text: plainTextGrammar,
          txt: plainTextGrammar,
          /**
           * Creates a deep copy of the language with the given id and appends the given tokens.
           *
           * If a token in `redef` also appears in the copied language, then the existing token in the copied language
           * will be overwritten at its original position.
           *
           * ## Best practices
           *
           * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
           * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
           * understand the language definition because, normally, the order of tokens matters in Prism grammars.
           *
           * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
           * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
           *
           * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
           * @param {Grammar} redef The new tokens to append.
           * @returns {Grammar} The new language created.
           * @public
           * @example
           * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
           *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
           *     // at its original position
           *     'comment': { ... },
           *     // CSS doesn't have a 'color' token, so this token will be appended
           *     'color': /\b(?:red|green|blue)\b/
           * });
           */
          extend: function(id, redef) {
            var lang2 = _.util.clone(_.languages[id]);
            for (var key in redef) {
              lang2[key] = redef[key];
            }
            return lang2;
          },
          /**
           * Inserts tokens _before_ another token in a language definition or any other grammar.
           *
           * ## Usage
           *
           * This helper method makes it easy to modify existing languages. For example, the CSS language definition
           * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
           * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
           * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
           * this:
           *
           * ```js
           * Prism.languages.markup.style = {
           *     // token
           * };
           * ```
           *
           * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
           * before existing tokens. For the CSS example above, you would use it like this:
           *
           * ```js
           * Prism.languages.insertBefore('markup', 'cdata', {
           *     'style': {
           *         // token
           *     }
           * });
           * ```
           *
           * ## Special cases
           *
           * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
           * will be ignored.
           *
           * This behavior can be used to insert tokens after `before`:
           *
           * ```js
           * Prism.languages.insertBefore('markup', 'comment', {
           *     'comment': Prism.languages.markup.comment,
           *     // tokens after 'comment'
           * });
           * ```
           *
           * ## Limitations
           *
           * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
           * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
           * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
           * deleting properties which is necessary to insert at arbitrary positions.
           *
           * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
           * Instead, it will create a new object and replace all references to the target object with the new one. This
           * can be done without temporarily deleting properties, so the iteration order is well-defined.
           *
           * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
           * you hold the target object in a variable, then the value of the variable will not change.
           *
           * ```js
           * var oldMarkup = Prism.languages.markup;
           * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
           *
           * assert(oldMarkup !== Prism.languages.markup);
           * assert(newMarkup === Prism.languages.markup);
           * ```
           *
           * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
           * object to be modified.
           * @param {string} before The key to insert before.
           * @param {Grammar} insert An object containing the key-value pairs to be inserted.
           * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
           * object to be modified.
           *
           * Defaults to `Prism.languages`.
           * @returns {Grammar} The new grammar object.
           * @public
           */
          insertBefore: function(inside, before, insert, root) {
            root = root || /** @type {any} */
            _.languages;
            var grammar = root[inside];
            var ret = {};
            for (var token in grammar) {
              if (grammar.hasOwnProperty(token)) {
                if (token == before) {
                  for (var newToken in insert) {
                    if (insert.hasOwnProperty(newToken)) {
                      ret[newToken] = insert[newToken];
                    }
                  }
                }
                if (!insert.hasOwnProperty(token)) {
                  ret[token] = grammar[token];
                }
              }
            }
            var old = root[inside];
            root[inside] = ret;
            _.languages.DFS(_.languages, function(key, value) {
              if (value === old && key != inside) {
                this[key] = ret;
              }
            });
            return ret;
          },
          // Traverse a language definition with Depth First Search
          DFS: function DFS(o, callback, type, visited) {
            visited = visited || {};
            var objId = _.util.objId;
            for (var i in o) {
              if (o.hasOwnProperty(i)) {
                callback.call(o, i, o[i], type || i);
                var property = o[i];
                var propertyType = _.util.type(property);
                if (propertyType === "Object" && !visited[objId(property)]) {
                  visited[objId(property)] = true;
                  DFS(property, callback, null, visited);
                } else if (propertyType === "Array" && !visited[objId(property)]) {
                  visited[objId(property)] = true;
                  DFS(property, callback, i, visited);
                }
              }
            }
          }
        },
        plugins: {},
        /**
         * This is the most high-level function in Prism’s API.
         * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
         * each one of them.
         *
         * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
         *
         * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
         * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
         * @memberof Prism
         * @public
         */
        highlightAll: function(async, callback) {
          _.highlightAllUnder(document, async, callback);
        },
        /**
         * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
         * {@link Prism.highlightElement} on each one of them.
         *
         * The following hooks will be run:
         * 1. `before-highlightall`
         * 2. `before-all-elements-highlight`
         * 3. All hooks of {@link Prism.highlightElement} for each element.
         *
         * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
         * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
         * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
         * @memberof Prism
         * @public
         */
        highlightAllUnder: function(container, async, callback) {
          var env = {
            callback,
            container,
            selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
          };
          _.hooks.run("before-highlightall", env);
          env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));
          _.hooks.run("before-all-elements-highlight", env);
          for (var i = 0, element; element = env.elements[i++]; ) {
            _.highlightElement(element, async === true, env.callback);
          }
        },
        /**
         * Highlights the code inside a single element.
         *
         * The following hooks will be run:
         * 1. `before-sanity-check`
         * 2. `before-highlight`
         * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
         * 4. `before-insert`
         * 5. `after-highlight`
         * 6. `complete`
         *
         * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
         * the element's language.
         *
         * @param {Element} element The element containing the code.
         * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
         * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
         * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
         * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
         *
         * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
         * asynchronous highlighting to work. You can build your own bundle on the
         * [Download page](https://prismjs.com/download.html).
         * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
         * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
         * @memberof Prism
         * @public
         */
        highlightElement: function(element, async, callback) {
          var language = _.util.getLanguage(element);
          var grammar = _.languages[language];
          _.util.setLanguage(element, language);
          var parent = element.parentElement;
          if (parent && parent.nodeName.toLowerCase() === "pre") {
            _.util.setLanguage(parent, language);
          }
          var code = element.textContent;
          var env = {
            element,
            language,
            grammar,
            code
          };
          function insertHighlightedCode(highlightedCode) {
            env.highlightedCode = highlightedCode;
            _.hooks.run("before-insert", env);
            env.element.innerHTML = env.highlightedCode;
            _.hooks.run("after-highlight", env);
            _.hooks.run("complete", env);
            callback && callback.call(env.element);
          }
          _.hooks.run("before-sanity-check", env);
          parent = env.element.parentElement;
          if (parent && parent.nodeName.toLowerCase() === "pre" && !parent.hasAttribute("tabindex")) {
            parent.setAttribute("tabindex", "0");
          }
          if (!env.code) {
            _.hooks.run("complete", env);
            callback && callback.call(env.element);
            return;
          }
          _.hooks.run("before-highlight", env);
          if (!env.grammar) {
            insertHighlightedCode(_.util.encode(env.code));
            return;
          }
          if (async && _self2.Worker) {
            var worker = new Worker(_.filename);
            worker.onmessage = function(evt) {
              insertHighlightedCode(evt.data);
            };
            worker.postMessage(JSON.stringify({
              language: env.language,
              code: env.code,
              immediateClose: true
            }));
          } else {
            insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
          }
        },
        /**
         * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
         * and the language definitions to use, and returns a string with the HTML produced.
         *
         * The following hooks will be run:
         * 1. `before-tokenize`
         * 2. `after-tokenize`
         * 3. `wrap`: On each {@link Token}.
         *
         * @param {string} text A string with the code to be highlighted.
         * @param {Grammar} grammar An object containing the tokens to use.
         *
         * Usually a language definition like `Prism.languages.markup`.
         * @param {string} language The name of the language definition passed to `grammar`.
         * @returns {string} The highlighted HTML.
         * @memberof Prism
         * @public
         * @example
         * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
         */
        highlight: function(text, grammar, language) {
          var env = {
            code: text,
            grammar,
            language
          };
          _.hooks.run("before-tokenize", env);
          if (!env.grammar) {
            throw new Error('The language "' + env.language + '" has no grammar.');
          }
          env.tokens = _.tokenize(env.code, env.grammar);
          _.hooks.run("after-tokenize", env);
          return Token.stringify(_.util.encode(env.tokens), env.language);
        },
        /**
         * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
         * and the language definitions to use, and returns an array with the tokenized code.
         *
         * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
         *
         * This method could be useful in other contexts as well, as a very crude parser.
         *
         * @param {string} text A string with the code to be highlighted.
         * @param {Grammar} grammar An object containing the tokens to use.
         *
         * Usually a language definition like `Prism.languages.markup`.
         * @returns {TokenStream} An array of strings and tokens, a token stream.
         * @memberof Prism
         * @public
         * @example
         * let code = `var foo = 0;`;
         * let tokens = Prism.tokenize(code, Prism.languages.javascript);
         * tokens.forEach(token => {
         *     if (token instanceof Prism.Token && token.type === 'number') {
         *         console.log(`Found numeric literal: ${token.content}`);
         *     }
         * });
         */
        tokenize: function(text, grammar) {
          var rest = grammar.rest;
          if (rest) {
            for (var token in rest) {
              grammar[token] = rest[token];
            }
            delete grammar.rest;
          }
          var tokenList = new LinkedList();
          addAfter(tokenList, tokenList.head, text);
          matchGrammar(text, tokenList, grammar, tokenList.head, 0);
          return toArray(tokenList);
        },
        /**
         * @namespace
         * @memberof Prism
         * @public
         */
        hooks: {
          all: {},
          /**
           * Adds the given callback to the list of callbacks for the given hook.
           *
           * The callback will be invoked when the hook it is registered for is run.
           * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
           *
           * One callback function can be registered to multiple hooks and the same hook multiple times.
           *
           * @param {string} name The name of the hook.
           * @param {HookCallback} callback The callback function which is given environment variables.
           * @public
           */
          add: function(name, callback) {
            var hooks = _.hooks.all;
            hooks[name] = hooks[name] || [];
            hooks[name].push(callback);
          },
          /**
           * Runs a hook invoking all registered callbacks with the given environment variables.
           *
           * Callbacks will be invoked synchronously and in the order in which they were registered.
           *
           * @param {string} name The name of the hook.
           * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
           * @public
           */
          run: function(name, env) {
            var callbacks = _.hooks.all[name];
            if (!callbacks || !callbacks.length) {
              return;
            }
            for (var i = 0, callback; callback = callbacks[i++]; ) {
              callback(env);
            }
          }
        },
        Token
      };
      _self2.Prism = _;
      function Token(type, content, alias, matchedStr) {
        this.type = type;
        this.content = content;
        this.alias = alias;
        this.length = (matchedStr || "").length | 0;
      }
      Token.stringify = function stringify(o, language) {
        if (typeof o == "string") {
          return o;
        }
        if (Array.isArray(o)) {
          var s = "";
          o.forEach(function(e) {
            s += stringify(e, language);
          });
          return s;
        }
        var env = {
          type: o.type,
          content: stringify(o.content, language),
          tag: "span",
          classes: ["token", o.type],
          attributes: {},
          language
        };
        var aliases = o.alias;
        if (aliases) {
          if (Array.isArray(aliases)) {
            Array.prototype.push.apply(env.classes, aliases);
          } else {
            env.classes.push(aliases);
          }
        }
        _.hooks.run("wrap", env);
        var attributes = "";
        for (var name in env.attributes) {
          attributes += " " + name + '="' + (env.attributes[name] || "").replace(/"/g, "&quot;") + '"';
        }
        return "<" + env.tag + ' class="' + env.classes.join(" ") + '"' + attributes + ">" + env.content + "</" + env.tag + ">";
      };
      function matchPattern(pattern, pos, text, lookbehind) {
        pattern.lastIndex = pos;
        var match = pattern.exec(text);
        if (match && lookbehind && match[1]) {
          var lookbehindLength = match[1].length;
          match.index += lookbehindLength;
          match[0] = match[0].slice(lookbehindLength);
        }
        return match;
      }
      function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
        for (var token in grammar) {
          if (!grammar.hasOwnProperty(token) || !grammar[token]) {
            continue;
          }
          var patterns = grammar[token];
          patterns = Array.isArray(patterns) ? patterns : [patterns];
          for (var j = 0; j < patterns.length; ++j) {
            if (rematch && rematch.cause == token + "," + j) {
              return;
            }
            var patternObj = patterns[j];
            var inside = patternObj.inside;
            var lookbehind = !!patternObj.lookbehind;
            var greedy = !!patternObj.greedy;
            var alias = patternObj.alias;
            if (greedy && !patternObj.pattern.global) {
              var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
              patternObj.pattern = RegExp(patternObj.pattern.source, flags + "g");
            }
            var pattern = patternObj.pattern || patternObj;
            for (var currentNode = startNode.next, pos = startPos; currentNode !== tokenList.tail; pos += currentNode.value.length, currentNode = currentNode.next) {
              if (rematch && pos >= rematch.reach) {
                break;
              }
              var str = currentNode.value;
              if (tokenList.length > text.length) {
                return;
              }
              if (str instanceof Token) {
                continue;
              }
              var removeCount = 1;
              var match;
              if (greedy) {
                match = matchPattern(pattern, pos, text, lookbehind);
                if (!match || match.index >= text.length) {
                  break;
                }
                var from = match.index;
                var to = match.index + match[0].length;
                var p = pos;
                p += currentNode.value.length;
                while (from >= p) {
                  currentNode = currentNode.next;
                  p += currentNode.value.length;
                }
                p -= currentNode.value.length;
                pos = p;
                if (currentNode.value instanceof Token) {
                  continue;
                }
                for (var k = currentNode; k !== tokenList.tail && (p < to || typeof k.value === "string"); k = k.next) {
                  removeCount++;
                  p += k.value.length;
                }
                removeCount--;
                str = text.slice(pos, p);
                match.index -= pos;
              } else {
                match = matchPattern(pattern, 0, str, lookbehind);
                if (!match) {
                  continue;
                }
              }
              var from = match.index;
              var matchStr = match[0];
              var before = str.slice(0, from);
              var after = str.slice(from + matchStr.length);
              var reach = pos + str.length;
              if (rematch && reach > rematch.reach) {
                rematch.reach = reach;
              }
              var removeFrom = currentNode.prev;
              if (before) {
                removeFrom = addAfter(tokenList, removeFrom, before);
                pos += before.length;
              }
              removeRange(tokenList, removeFrom, removeCount);
              var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
              currentNode = addAfter(tokenList, removeFrom, wrapped);
              if (after) {
                addAfter(tokenList, currentNode, after);
              }
              if (removeCount > 1) {
                var nestedRematch = {
                  cause: token + "," + j,
                  reach
                };
                matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);
                if (rematch && nestedRematch.reach > rematch.reach) {
                  rematch.reach = nestedRematch.reach;
                }
              }
            }
          }
        }
      }
      function LinkedList() {
        var head = { value: null, prev: null, next: null };
        var tail = { value: null, prev: head, next: null };
        head.next = tail;
        this.head = head;
        this.tail = tail;
        this.length = 0;
      }
      function addAfter(list, node, value) {
        var next = node.next;
        var newNode = { value, prev: node, next };
        node.next = newNode;
        next.prev = newNode;
        list.length++;
        return newNode;
      }
      function removeRange(list, node, count) {
        var next = node.next;
        for (var i = 0; i < count && next !== list.tail; i++) {
          next = next.next;
        }
        node.next = next;
        next.prev = node;
        list.length -= i;
      }
      function toArray(list) {
        var array = [];
        var node = list.head.next;
        while (node !== list.tail) {
          array.push(node.value);
          node = node.next;
        }
        return array;
      }
      if (!_self2.document) {
        if (!_self2.addEventListener) {
          return _;
        }
        if (!_.disableWorkerMessageHandler) {
          _self2.addEventListener("message", function(evt) {
            var message = JSON.parse(evt.data);
            var lang2 = message.language;
            var code = message.code;
            var immediateClose = message.immediateClose;
            _self2.postMessage(_.highlight(code, _.languages[lang2], lang2));
            if (immediateClose) {
              _self2.close();
            }
          }, false);
        }
        return _;
      }
      var script = _.util.currentScript();
      if (script) {
        _.filename = script.src;
        if (script.hasAttribute("data-manual")) {
          _.manual = true;
        }
      }
      function highlightAutomaticallyCallback() {
        if (!_.manual) {
          _.highlightAll();
        }
      }
      if (!_.manual) {
        var readyState = document.readyState;
        if (readyState === "loading" || readyState === "interactive" && script && script.defer) {
          document.addEventListener("DOMContentLoaded", highlightAutomaticallyCallback);
        } else {
          if (window.requestAnimationFrame) {
            window.requestAnimationFrame(highlightAutomaticallyCallback);
          } else {
            window.setTimeout(highlightAutomaticallyCallback, 16);
          }
        }
      }
      return _;
    })(_self);
    if (typeof module2 !== "undefined" && module2.exports) {
      module2.exports = Prism3;
    }
    if (typeof global !== "undefined") {
      global.Prism = Prism3;
    }
    Prism3.languages.markup = {
      "comment": {
        pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
        greedy: true
      },
      "prolog": {
        pattern: /<\?[\s\S]+?\?>/,
        greedy: true
      },
      "doctype": {
        // https://www.w3.org/TR/xml/#NT-doctypedecl
        pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
        greedy: true,
        inside: {
          "internal-subset": {
            pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
            lookbehind: true,
            greedy: true,
            inside: null
            // see below
          },
          "string": {
            pattern: /"[^"]*"|'[^']*'/,
            greedy: true
          },
          "punctuation": /^<!|>$|[[\]]/,
          "doctype-tag": /^DOCTYPE/i,
          "name": /[^\s<>'"]+/
        }
      },
      "cdata": {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        greedy: true
      },
      "tag": {
        pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
        greedy: true,
        inside: {
          "tag": {
            pattern: /^<\/?[^\s>\/]+/,
            inside: {
              "punctuation": /^<\/?/,
              "namespace": /^[^\s>\/:]+:/
            }
          },
          "special-attr": [],
          "attr-value": {
            pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
            inside: {
              "punctuation": [
                {
                  pattern: /^=/,
                  alias: "attr-equals"
                },
                {
                  pattern: /^(\s*)["']|["']$/,
                  lookbehind: true
                }
              ]
            }
          },
          "punctuation": /\/?>/,
          "attr-name": {
            pattern: /[^\s>\/]+/,
            inside: {
              "namespace": /^[^\s>\/:]+:/
            }
          }
        }
      },
      "entity": [
        {
          pattern: /&[\da-z]{1,8};/i,
          alias: "named-entity"
        },
        /&#x?[\da-f]{1,8};/i
      ]
    };
    Prism3.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism3.languages.markup["entity"];
    Prism3.languages.markup["doctype"].inside["internal-subset"].inside = Prism3.languages.markup;
    Prism3.hooks.add("wrap", function(env) {
      if (env.type === "entity") {
        env.attributes["title"] = env.content.replace(/&amp;/, "&");
      }
    });
    Object.defineProperty(Prism3.languages.markup.tag, "addInlined", {
      /**
       * Adds an inlined language to markup.
       *
       * An example of an inlined language is CSS with `<style>` tags.
       *
       * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addInlined('style', 'css');
       */
      value: function addInlined2(tagName, lang) {
        var includedCdataInside = {};
        includedCdataInside["language-" + lang] = {
          pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
          lookbehind: true,
          inside: Prism3.languages[lang]
        };
        includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
        var inside = {
          "included-cdata": {
            pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
            inside: includedCdataInside
          }
        };
        inside["language-" + lang] = {
          pattern: /[\s\S]+/,
          inside: Prism3.languages[lang]
        };
        var def = {};
        def[tagName] = {
          pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
            return tagName;
          }), "i"),
          lookbehind: true,
          greedy: true,
          inside
        };
        Prism3.languages.insertBefore("markup", "cdata", def);
      }
    });
    Object.defineProperty(Prism3.languages.markup.tag, "addAttribute", {
      /**
       * Adds an pattern to highlight languages embedded in HTML attributes.
       *
       * An example of an inlined language is CSS with `style` attributes.
       *
       * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addAttribute('style', 'css');
       */
      value: function(attrName, lang) {
        Prism3.languages.markup.tag.inside["special-attr"].push({
          pattern: RegExp(
            /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
            "i"
          ),
          lookbehind: true,
          inside: {
            "attr-name": /^[^\s=]+/,
            "attr-value": {
              pattern: /=[\s\S]+/,
              inside: {
                "value": {
                  pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                  lookbehind: true,
                  alias: [lang, "language-" + lang],
                  inside: Prism3.languages[lang]
                },
                "punctuation": [
                  {
                    pattern: /^=/,
                    alias: "attr-equals"
                  },
                  /"|'/
                ]
              }
            }
          }
        });
      }
    });
    Prism3.languages.html = Prism3.languages.markup;
    Prism3.languages.mathml = Prism3.languages.markup;
    Prism3.languages.svg = Prism3.languages.markup;
    Prism3.languages.xml = Prism3.languages.extend("markup", {});
    Prism3.languages.ssml = Prism3.languages.xml;
    Prism3.languages.atom = Prism3.languages.xml;
    Prism3.languages.rss = Prism3.languages.xml;
    (function(Prism4) {
      var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
      Prism4.languages.css = {
        "comment": /\/\*[\s\S]*?\*\//,
        "atrule": {
          pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
          inside: {
            "rule": /^@[\w-]+/,
            "selector-function-argument": {
              pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
              lookbehind: true,
              alias: "selector"
            },
            "keyword": {
              pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
              lookbehind: true
            }
            // See rest below
          }
        },
        "url": {
          // https://drafts.csswg.org/css-values-3/#urls
          pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
          greedy: true,
          inside: {
            "function": /^url/i,
            "punctuation": /^\(|\)$/,
            "string": {
              pattern: RegExp("^" + string.source + "$"),
              alias: "url"
            }
          }
        },
        "selector": {
          pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
          lookbehind: true
        },
        "string": {
          pattern: string,
          greedy: true
        },
        "property": {
          pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
          lookbehind: true
        },
        "important": /!important\b/i,
        "function": {
          pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
          lookbehind: true
        },
        "punctuation": /[(){};:,]/
      };
      Prism4.languages.css["atrule"].inside.rest = Prism4.languages.css;
      var markup = Prism4.languages.markup;
      if (markup) {
        markup.tag.addInlined("style", "css");
        markup.tag.addAttribute("style", "css");
      }
    })(Prism3);
    Prism3.languages.clike = {
      "comment": [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      "string": {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      "class-name": {
        pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
        lookbehind: true,
        inside: {
          "punctuation": /[.\\]/
        }
      },
      "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
      "boolean": /\b(?:false|true)\b/,
      "function": /\b\w+(?=\()/,
      "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
      "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
      "punctuation": /[{}[\];(),.:]/
    };
    Prism3.languages.javascript = Prism3.languages.extend("clike", {
      "class-name": [
        Prism3.languages.clike["class-name"],
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
          lookbehind: true
        }
      ],
      "keyword": [
        {
          pattern: /((?:^|\})\s*)catch\b/,
          lookbehind: true
        },
        {
          pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
          lookbehind: true
        }
      ],
      // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
      "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
      "number": {
        pattern: RegExp(
          /(^|[^\w$])/.source + "(?:" + // constant
          (/NaN|Infinity/.source + "|" + // binary integer
          /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
          /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
          /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
          /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
          /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
        ),
        lookbehind: true
      },
      "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
    });
    Prism3.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
    Prism3.languages.insertBefore("javascript", "keyword", {
      "regex": {
        pattern: RegExp(
          // lookbehind
          // eslint-disable-next-line regexp/no-dupe-characters-character-class
          /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
          // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
          // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
          // with the only syntax, so we have to define 2 different regex patterns.
          /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
          /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
          /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "regex-source": {
            pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
            lookbehind: true,
            alias: "language-regex",
            inside: Prism3.languages.regex
          },
          "regex-delimiter": /^\/|\/$/,
          "regex-flags": /^[a-z]+$/
        }
      },
      // This must be declared before keyword because we use "function" inside the look-forward
      "function-variable": {
        pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
        alias: "function"
      },
      "parameter": [
        {
          pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        }
      ],
      "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
    });
    Prism3.languages.insertBefore("javascript", "string", {
      "hashbang": {
        pattern: /^#!.*/,
        greedy: true,
        alias: "comment"
      },
      "template-string": {
        pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
        greedy: true,
        inside: {
          "template-punctuation": {
            pattern: /^`|`$/,
            alias: "string"
          },
          "interpolation": {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
            lookbehind: true,
            inside: {
              "interpolation-punctuation": {
                pattern: /^\$\{|\}$/,
                alias: "punctuation"
              },
              rest: Prism3.languages.javascript
            }
          },
          "string": /[\s\S]+/
        }
      },
      "string-property": {
        pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
        lookbehind: true,
        greedy: true,
        alias: "property"
      }
    });
    Prism3.languages.insertBefore("javascript", "operator", {
      "literal-property": {
        pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
        lookbehind: true,
        alias: "property"
      }
    });
    if (Prism3.languages.markup) {
      Prism3.languages.markup.tag.addInlined("script", "javascript");
      Prism3.languages.markup.tag.addAttribute(
        /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
        "javascript"
      );
    }
    Prism3.languages.js = Prism3.languages.javascript;
    (function() {
      if (typeof Prism3 === "undefined" || typeof document === "undefined") {
        return;
      }
      if (!Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
      }
      var LOADING_MESSAGE = "Loading\u2026";
      var FAILURE_MESSAGE = function(status, message) {
        return "\u2716 Error " + status + " while fetching file: " + message;
      };
      var FAILURE_EMPTY_MESSAGE = "\u2716 Error: File does not exist or is empty";
      var EXTENSIONS = {
        "js": "javascript",
        "py": "python",
        "rb": "ruby",
        "ps1": "powershell",
        "psm1": "powershell",
        "sh": "bash",
        "bat": "batch",
        "h": "c",
        "tex": "latex"
      };
      var STATUS_ATTR = "data-src-status";
      var STATUS_LOADING = "loading";
      var STATUS_LOADED = "loaded";
      var STATUS_FAILED = "failed";
      var SELECTOR = "pre[data-src]:not([" + STATUS_ATTR + '="' + STATUS_LOADED + '"]):not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';
      function loadFile(src, success, error) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", src, true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            if (xhr.status < 400 && xhr.responseText) {
              success(xhr.responseText);
            } else {
              if (xhr.status >= 400) {
                error(FAILURE_MESSAGE(xhr.status, xhr.statusText));
              } else {
                error(FAILURE_EMPTY_MESSAGE);
              }
            }
          }
        };
        xhr.send(null);
      }
      function parseRange(range) {
        var m = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || "");
        if (m) {
          var start = Number(m[1]);
          var comma = m[2];
          var end = m[3];
          if (!comma) {
            return [start, start];
          }
          if (!end) {
            return [start, void 0];
          }
          return [start, Number(end)];
        }
        return void 0;
      }
      Prism3.hooks.add("before-highlightall", function(env) {
        env.selector += ", " + SELECTOR;
      });
      Prism3.hooks.add("before-sanity-check", function(env) {
        var pre = (
          /** @type {HTMLPreElement} */
          env.element
        );
        if (pre.matches(SELECTOR)) {
          env.code = "";
          pre.setAttribute(STATUS_ATTR, STATUS_LOADING);
          var code = pre.appendChild(document.createElement("CODE"));
          code.textContent = LOADING_MESSAGE;
          var src = pre.getAttribute("data-src");
          var language = env.language;
          if (language === "none") {
            var extension = (/\.(\w+)$/.exec(src) || [, "none"])[1];
            language = EXTENSIONS[extension] || extension;
          }
          Prism3.util.setLanguage(code, language);
          Prism3.util.setLanguage(pre, language);
          var autoloader = Prism3.plugins.autoloader;
          if (autoloader) {
            autoloader.loadLanguages(language);
          }
          loadFile(
            src,
            function(text) {
              pre.setAttribute(STATUS_ATTR, STATUS_LOADED);
              var range = parseRange(pre.getAttribute("data-range"));
              if (range) {
                var lines = text.split(/\r\n?|\n/g);
                var start = range[0];
                var end = range[1] == null ? lines.length : range[1];
                if (start < 0) {
                  start += lines.length;
                }
                start = Math.max(0, Math.min(start - 1, lines.length));
                if (end < 0) {
                  end += lines.length;
                }
                end = Math.max(0, Math.min(end, lines.length));
                text = lines.slice(start, end).join("\n");
                if (!pre.hasAttribute("data-start")) {
                  pre.setAttribute("data-start", String(start + 1));
                }
              }
              code.textContent = text;
              Prism3.highlightElement(code);
            },
            function(error) {
              pre.setAttribute(STATUS_ATTR, STATUS_FAILED);
              code.textContent = error;
            }
          );
        }
      });
      Prism3.plugins.fileHighlight = {
        /**
         * Executes the File Highlight plugin for all matching `pre` elements under the given container.
         *
         * Note: Elements which are already loaded or currently loading will not be touched by this method.
         *
         * @param {ParentNode} [container=document]
         */
        highlight: function highlight2(container) {
          var elements = (container || document).querySelectorAll(SELECTOR);
          for (var i = 0, element; element = elements[i++]; ) {
            Prism3.highlightElement(element);
          }
        }
      };
      var logged = false;
      Prism3.fileHighlight = function() {
        if (!logged) {
          console.warn("Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.");
          logged = true;
        }
        Prism3.plugins.fileHighlight.highlight.apply(this, arguments);
      };
    })();
  }
});

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  isNewer: () => isNewer,
  parseVersion: () => parseVersion
});
module.exports = __toCommonJS(index_exports);
var import_react8 = require("react");
var import_react_dom2 = require("react-dom");

// src/client/shared.tsx
var import_react = require("react");
var import_react_dom = require("react-dom");

// src/client/prism-env.ts
var scope = globalThis;
scope.Prism = scope.Prism ?? {};
scope.Prism.manual = true;

// src/client/highlight.ts
var import_prismjs = __toESM(require_prism(), 1);

// node_modules/prismjs/components/prism-markup.js
Prism.languages.markup = {
  "comment": {
    pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
    greedy: true
  },
  "prolog": {
    pattern: /<\?[\s\S]+?\?>/,
    greedy: true
  },
  "doctype": {
    // https://www.w3.org/TR/xml/#NT-doctypedecl
    pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
    greedy: true,
    inside: {
      "internal-subset": {
        pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
        lookbehind: true,
        greedy: true,
        inside: null
        // see below
      },
      "string": {
        pattern: /"[^"]*"|'[^']*'/,
        greedy: true
      },
      "punctuation": /^<!|>$|[[\]]/,
      "doctype-tag": /^DOCTYPE/i,
      "name": /[^\s<>'"]+/
    }
  },
  "cdata": {
    pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
    greedy: true
  },
  "tag": {
    pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
    greedy: true,
    inside: {
      "tag": {
        pattern: /^<\/?[^\s>\/]+/,
        inside: {
          "punctuation": /^<\/?/,
          "namespace": /^[^\s>\/:]+:/
        }
      },
      "special-attr": [],
      "attr-value": {
        pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
        inside: {
          "punctuation": [
            {
              pattern: /^=/,
              alias: "attr-equals"
            },
            {
              pattern: /^(\s*)["']|["']$/,
              lookbehind: true
            }
          ]
        }
      },
      "punctuation": /\/?>/,
      "attr-name": {
        pattern: /[^\s>\/]+/,
        inside: {
          "namespace": /^[^\s>\/:]+:/
        }
      }
    }
  },
  "entity": [
    {
      pattern: /&[\da-z]{1,8};/i,
      alias: "named-entity"
    },
    /&#x?[\da-f]{1,8};/i
  ]
};
Prism.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism.languages.markup["entity"];
Prism.languages.markup["doctype"].inside["internal-subset"].inside = Prism.languages.markup;
Prism.hooks.add("wrap", function(env) {
  if (env.type === "entity") {
    env.attributes["title"] = env.content.replace(/&amp;/, "&");
  }
});
Object.defineProperty(Prism.languages.markup.tag, "addInlined", {
  /**
   * Adds an inlined language to markup.
   *
   * An example of an inlined language is CSS with `<style>` tags.
   *
   * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
   * case insensitive.
   * @param {string} lang The language key.
   * @example
   * addInlined('style', 'css');
   */
  value: function addInlined(tagName, lang) {
    var includedCdataInside = {};
    includedCdataInside["language-" + lang] = {
      pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
      lookbehind: true,
      inside: Prism.languages[lang]
    };
    includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
    var inside = {
      "included-cdata": {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        inside: includedCdataInside
      }
    };
    inside["language-" + lang] = {
      pattern: /[\s\S]+/,
      inside: Prism.languages[lang]
    };
    var def = {};
    def[tagName] = {
      pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
        return tagName;
      }), "i"),
      lookbehind: true,
      greedy: true,
      inside
    };
    Prism.languages.insertBefore("markup", "cdata", def);
  }
});
Object.defineProperty(Prism.languages.markup.tag, "addAttribute", {
  /**
   * Adds an pattern to highlight languages embedded in HTML attributes.
   *
   * An example of an inlined language is CSS with `style` attributes.
   *
   * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
   * case insensitive.
   * @param {string} lang The language key.
   * @example
   * addAttribute('style', 'css');
   */
  value: function(attrName, lang) {
    Prism.languages.markup.tag.inside["special-attr"].push({
      pattern: RegExp(
        /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
        "i"
      ),
      lookbehind: true,
      inside: {
        "attr-name": /^[^\s=]+/,
        "attr-value": {
          pattern: /=[\s\S]+/,
          inside: {
            "value": {
              pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
              lookbehind: true,
              alias: [lang, "language-" + lang],
              inside: Prism.languages[lang]
            },
            "punctuation": [
              {
                pattern: /^=/,
                alias: "attr-equals"
              },
              /"|'/
            ]
          }
        }
      }
    });
  }
});
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;
Prism.languages.xml = Prism.languages.extend("markup", {});
Prism.languages.ssml = Prism.languages.xml;
Prism.languages.atom = Prism.languages.xml;
Prism.languages.rss = Prism.languages.xml;

// node_modules/prismjs/components/prism-css.js
(function(Prism3) {
  var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
  Prism3.languages.css = {
    "comment": /\/\*[\s\S]*?\*\//,
    "atrule": {
      pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
      inside: {
        "rule": /^@[\w-]+/,
        "selector-function-argument": {
          pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
          lookbehind: true,
          alias: "selector"
        },
        "keyword": {
          pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
          lookbehind: true
        }
        // See rest below
      }
    },
    "url": {
      // https://drafts.csswg.org/css-values-3/#urls
      pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
      greedy: true,
      inside: {
        "function": /^url/i,
        "punctuation": /^\(|\)$/,
        "string": {
          pattern: RegExp("^" + string.source + "$"),
          alias: "url"
        }
      }
    },
    "selector": {
      pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
      lookbehind: true
    },
    "string": {
      pattern: string,
      greedy: true
    },
    "property": {
      pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
      lookbehind: true
    },
    "important": /!important\b/i,
    "function": {
      pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
      lookbehind: true
    },
    "punctuation": /[(){};:,]/
  };
  Prism3.languages.css["atrule"].inside.rest = Prism3.languages.css;
  var markup = Prism3.languages.markup;
  if (markup) {
    markup.tag.addInlined("style", "css");
    markup.tag.addAttribute("style", "css");
  }
})(Prism);

// node_modules/prismjs/components/prism-clike.js
Prism.languages.clike = {
  "comment": [
    {
      pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
      lookbehind: true,
      greedy: true
    },
    {
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true,
      greedy: true
    }
  ],
  "string": {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true
  },
  "class-name": {
    pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
    lookbehind: true,
    inside: {
      "punctuation": /[.\\]/
    }
  },
  "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
  "boolean": /\b(?:false|true)\b/,
  "function": /\b\w+(?=\()/,
  "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
  "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
  "punctuation": /[{}[\];(),.:]/
};

// node_modules/prismjs/components/prism-javascript.js
Prism.languages.javascript = Prism.languages.extend("clike", {
  "class-name": [
    Prism.languages.clike["class-name"],
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
      lookbehind: true
    }
  ],
  "keyword": [
    {
      pattern: /((?:^|\})\s*)catch\b/,
      lookbehind: true
    },
    {
      pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
      lookbehind: true
    }
  ],
  // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
  "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
  "number": {
    pattern: RegExp(
      /(^|[^\w$])/.source + "(?:" + // constant
      (/NaN|Infinity/.source + "|" + // binary integer
      /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
      /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
      /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
      /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
      /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
    ),
    lookbehind: true
  },
  "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});
Prism.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
Prism.languages.insertBefore("javascript", "keyword", {
  "regex": {
    pattern: RegExp(
      // lookbehind
      // eslint-disable-next-line regexp/no-dupe-characters-character-class
      /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
      // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
      // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
      // with the only syntax, so we have to define 2 different regex patterns.
      /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
      /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
      /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
    ),
    lookbehind: true,
    greedy: true,
    inside: {
      "regex-source": {
        pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
        lookbehind: true,
        alias: "language-regex",
        inside: Prism.languages.regex
      },
      "regex-delimiter": /^\/|\/$/,
      "regex-flags": /^[a-z]+$/
    }
  },
  // This must be declared before keyword because we use "function" inside the look-forward
  "function-variable": {
    pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
    alias: "function"
  },
  "parameter": [
    {
      pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    }
  ],
  "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});
Prism.languages.insertBefore("javascript", "string", {
  "hashbang": {
    pattern: /^#!.*/,
    greedy: true,
    alias: "comment"
  },
  "template-string": {
    pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
    greedy: true,
    inside: {
      "template-punctuation": {
        pattern: /^`|`$/,
        alias: "string"
      },
      "interpolation": {
        pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
        lookbehind: true,
        inside: {
          "interpolation-punctuation": {
            pattern: /^\$\{|\}$/,
            alias: "punctuation"
          },
          rest: Prism.languages.javascript
        }
      },
      "string": /[\s\S]+/
    }
  },
  "string-property": {
    pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
    lookbehind: true,
    greedy: true,
    alias: "property"
  }
});
Prism.languages.insertBefore("javascript", "operator", {
  "literal-property": {
    pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
    lookbehind: true,
    alias: "property"
  }
});
if (Prism.languages.markup) {
  Prism.languages.markup.tag.addInlined("script", "javascript");
  Prism.languages.markup.tag.addAttribute(
    /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
    "javascript"
  );
}
Prism.languages.js = Prism.languages.javascript;

// node_modules/prismjs/components/prism-typescript.js
(function(Prism3) {
  Prism3.languages.typescript = Prism3.languages.extend("javascript", {
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
      lookbehind: true,
      greedy: true,
      inside: null
      // see below
    },
    "builtin": /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
  });
  Prism3.languages.typescript.keyword.push(
    /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
    // keywords that have to be followed by an identifier
    /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
    // This is for `import type *, {}`
    /\btype\b(?=\s*(?:[\{*]|$))/
  );
  delete Prism3.languages.typescript["parameter"];
  delete Prism3.languages.typescript["literal-property"];
  var typeInside = Prism3.languages.extend("typescript", {});
  delete typeInside["class-name"];
  Prism3.languages.typescript["class-name"].inside = typeInside;
  Prism3.languages.insertBefore("typescript", "function", {
    "decorator": {
      pattern: /@[$\w\xA0-\uFFFF]+/,
      inside: {
        "at": {
          pattern: /^@/,
          alias: "operator"
        },
        "function": /^[\s\S]+/
      }
    },
    "generic-function": {
      // e.g. foo<T extends "bar" | "baz">( ...
      pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
      greedy: true,
      inside: {
        "function": /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
        "generic": {
          pattern: /<[\s\S]+/,
          // everything after the first <
          alias: "class-name",
          inside: typeInside
        }
      }
    }
  });
  Prism3.languages.ts = Prism3.languages.typescript;
})(Prism);

// node_modules/prismjs/components/prism-jsx.js
(function(Prism3) {
  var javascript = Prism3.util.clone(Prism3.languages.javascript);
  var space = /(?:\s|\/\/.*(?!.)|\/\*(?:[^*]|\*(?!\/))\*\/)/.source;
  var braces = /(?:\{(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*\})/.source;
  var spread = /(?:\{<S>*\.{3}(?:[^{}]|<BRACES>)*\})/.source;
  function re(source, flags) {
    source = source.replace(/<S>/g, function() {
      return space;
    }).replace(/<BRACES>/g, function() {
      return braces;
    }).replace(/<SPREAD>/g, function() {
      return spread;
    });
    return RegExp(source, flags);
  }
  spread = re(spread).source;
  Prism3.languages.jsx = Prism3.languages.extend("markup", javascript);
  Prism3.languages.jsx.tag.pattern = re(
    /<\/?(?:[\w.:-]+(?:<S>+(?:[\w.:$-]+(?:=(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s{'"/>=]+|<BRACES>))?|<SPREAD>))*<S>*\/?)?>/.source
  );
  Prism3.languages.jsx.tag.inside["tag"].pattern = /^<\/?[^\s>\/]*/;
  Prism3.languages.jsx.tag.inside["attr-value"].pattern = /=(?!\{)(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s'">]+)/;
  Prism3.languages.jsx.tag.inside["tag"].inside["class-name"] = /^[A-Z]\w*(?:\.[A-Z]\w*)*$/;
  Prism3.languages.jsx.tag.inside["comment"] = javascript["comment"];
  Prism3.languages.insertBefore("inside", "attr-name", {
    "spread": {
      pattern: re(/<SPREAD>/.source),
      inside: Prism3.languages.jsx
    }
  }, Prism3.languages.jsx.tag);
  Prism3.languages.insertBefore("inside", "special-attr", {
    "script": {
      // Allow for two levels of nesting
      pattern: re(/=<BRACES>/.source),
      alias: "language-javascript",
      inside: {
        "script-punctuation": {
          pattern: /^=(?=\{)/,
          alias: "punctuation"
        },
        rest: Prism3.languages.jsx
      }
    }
  }, Prism3.languages.jsx.tag);
  var stringifyToken = function(token) {
    if (!token) {
      return "";
    }
    if (typeof token === "string") {
      return token;
    }
    if (typeof token.content === "string") {
      return token.content;
    }
    return token.content.map(stringifyToken).join("");
  };
  var walkTokens = function(tokens) {
    var openedTags = [];
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var notTagNorBrace = false;
      if (typeof token !== "string") {
        if (token.type === "tag" && token.content[0] && token.content[0].type === "tag") {
          if (token.content[0].content[0].content === "</") {
            if (openedTags.length > 0 && openedTags[openedTags.length - 1].tagName === stringifyToken(token.content[0].content[1])) {
              openedTags.pop();
            }
          } else {
            if (token.content[token.content.length - 1].content === "/>") {
            } else {
              openedTags.push({
                tagName: stringifyToken(token.content[0].content[1]),
                openedBraces: 0
              });
            }
          }
        } else if (openedTags.length > 0 && token.type === "punctuation" && token.content === "{") {
          openedTags[openedTags.length - 1].openedBraces++;
        } else if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces > 0 && token.type === "punctuation" && token.content === "}") {
          openedTags[openedTags.length - 1].openedBraces--;
        } else {
          notTagNorBrace = true;
        }
      }
      if (notTagNorBrace || typeof token === "string") {
        if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces === 0) {
          var plainText = stringifyToken(token);
          if (i < tokens.length - 1 && (typeof tokens[i + 1] === "string" || tokens[i + 1].type === "plain-text")) {
            plainText += stringifyToken(tokens[i + 1]);
            tokens.splice(i + 1, 1);
          }
          if (i > 0 && (typeof tokens[i - 1] === "string" || tokens[i - 1].type === "plain-text")) {
            plainText = stringifyToken(tokens[i - 1]) + plainText;
            tokens.splice(i - 1, 1);
            i--;
          }
          tokens[i] = new Prism3.Token("plain-text", plainText, null, plainText);
        }
      }
      if (token.content && typeof token.content !== "string") {
        walkTokens(token.content);
      }
    }
  };
  Prism3.hooks.add("after-tokenize", function(env) {
    if (env.language !== "jsx" && env.language !== "tsx") {
      return;
    }
    walkTokens(env.tokens);
  });
})(Prism);

// node_modules/prismjs/components/prism-tsx.js
(function(Prism3) {
  var typescript = Prism3.util.clone(Prism3.languages.typescript);
  Prism3.languages.tsx = Prism3.languages.extend("jsx", typescript);
  delete Prism3.languages.tsx["parameter"];
  delete Prism3.languages.tsx["literal-property"];
  var tag = Prism3.languages.tsx.tag;
  tag.pattern = RegExp(/(^|[^\w$]|(?=<\/))/.source + "(?:" + tag.pattern.source + ")", tag.pattern.flags);
  tag.lookbehind = true;
})(Prism);

// node_modules/prismjs/components/prism-json.js
Prism.languages.json = {
  "property": {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    lookbehind: true,
    greedy: true
  },
  "string": {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    lookbehind: true,
    greedy: true
  },
  "comment": {
    pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
    greedy: true
  },
  "number": /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
  "punctuation": /[{}[\],]/,
  "operator": /:/,
  "boolean": /\b(?:false|true)\b/,
  "null": {
    pattern: /\bnull\b/,
    alias: "keyword"
  }
};
Prism.languages.webmanifest = Prism.languages.json;

// node_modules/prismjs/components/prism-yaml.js
(function(Prism3) {
  var anchorOrAlias = /[*&][^\s[\]{},]+/;
  var tag = /!(?:<[\w\-%#;/?:@&=+$,.!~*'()[\]]+>|(?:[a-zA-Z\d-]*!)?[\w\-%#;/?:@&=+$.~*'()]+)?/;
  var properties = "(?:" + tag.source + "(?:[ 	]+" + anchorOrAlias.source + ")?|" + anchorOrAlias.source + "(?:[ 	]+" + tag.source + ")?)";
  var plainKey = /(?:[^\s\x00-\x08\x0e-\x1f!"#%&'*,\-:>?@[\]`{|}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]|[?:-]<PLAIN>)(?:[ \t]*(?:(?![#:])<PLAIN>|:<PLAIN>))*/.source.replace(/<PLAIN>/g, function() {
    return /[^\s\x00-\x08\x0e-\x1f,[\]{}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]/.source;
  });
  var string = /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/.source;
  function createValuePattern(value, flags) {
    flags = (flags || "").replace(/m/g, "") + "m";
    var pattern = /([:\-,[{]\s*(?:\s<<prop>>[ \t]+)?)(?:<<value>>)(?=[ \t]*(?:$|,|\]|\}|(?:[\r\n]\s*)?#))/.source.replace(/<<prop>>/g, function() {
      return properties;
    }).replace(/<<value>>/g, function() {
      return value;
    });
    return RegExp(pattern, flags);
  }
  Prism3.languages.yaml = {
    "scalar": {
      pattern: RegExp(/([\-:]\s*(?:\s<<prop>>[ \t]+)?[|>])[ \t]*(?:((?:\r?\n|\r)[ \t]+)\S[^\r\n]*(?:\2[^\r\n]+)*)/.source.replace(/<<prop>>/g, function() {
        return properties;
      })),
      lookbehind: true,
      alias: "string"
    },
    "comment": /#.*/,
    "key": {
      pattern: RegExp(/((?:^|[:\-,[{\r\n?])[ \t]*(?:<<prop>>[ \t]+)?)<<key>>(?=\s*:\s)/.source.replace(/<<prop>>/g, function() {
        return properties;
      }).replace(/<<key>>/g, function() {
        return "(?:" + plainKey + "|" + string + ")";
      })),
      lookbehind: true,
      greedy: true,
      alias: "atrule"
    },
    "directive": {
      pattern: /(^[ \t]*)%.+/m,
      lookbehind: true,
      alias: "important"
    },
    "datetime": {
      pattern: createValuePattern(/\d{4}-\d\d?-\d\d?(?:[tT]|[ \t]+)\d\d?:\d{2}:\d{2}(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d{2})?))?|\d{4}-\d{2}-\d{2}|\d\d?:\d{2}(?::\d{2}(?:\.\d*)?)?/.source),
      lookbehind: true,
      alias: "number"
    },
    "boolean": {
      pattern: createValuePattern(/false|true/.source, "i"),
      lookbehind: true,
      alias: "important"
    },
    "null": {
      pattern: createValuePattern(/null|~/.source, "i"),
      lookbehind: true,
      alias: "important"
    },
    "string": {
      pattern: createValuePattern(string),
      lookbehind: true,
      greedy: true
    },
    "number": {
      pattern: createValuePattern(/[+-]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\.inf|\.nan)/.source, "i"),
      lookbehind: true
    },
    "tag": tag,
    "important": anchorOrAlias,
    "punctuation": /---|[:[\]{}\-,|>?]|\.\.\./
  };
  Prism3.languages.yml = Prism3.languages.yaml;
})(Prism);

// node_modules/prismjs/components/prism-bash.js
(function(Prism3) {
  var envVars = "\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|GDMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HOSTTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHONE|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OSTYPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRENT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b";
  var commandAfterHeredoc = {
    pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
    lookbehind: true,
    alias: "punctuation",
    // this looks reasonably well in all themes
    inside: null
    // see below
  };
  var insideString = {
    "bash": commandAfterHeredoc,
    "environment": {
      pattern: RegExp("\\$" + envVars),
      alias: "constant"
    },
    "variable": [
      // [0]: Arithmetic Environment
      {
        pattern: /\$?\(\([\s\S]+?\)\)/,
        greedy: true,
        inside: {
          // If there is a $ sign at the beginning highlight $(( and )) as variable
          "variable": [
            {
              pattern: /(^\$\(\([\s\S]+)\)\)/,
              lookbehind: true
            },
            /^\$\(\(/
          ],
          "number": /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
          // Operators according to https://www.gnu.org/software/bash/manual/bashref.html#Shell-Arithmetic
          "operator": /--|\+\+|\*\*=?|<<=?|>>=?|&&|\|\||[=!+\-*/%<>^&|]=?|[?~:]/,
          // If there is no $ sign at the beginning highlight (( and )) as punctuation
          "punctuation": /\(\(?|\)\)?|,|;/
        }
      },
      // [1]: Command Substitution
      {
        pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
        greedy: true,
        inside: {
          "variable": /^\$\(|^`|\)$|`$/
        }
      },
      // [2]: Brace expansion
      {
        pattern: /\$\{[^}]+\}/,
        greedy: true,
        inside: {
          "operator": /:[-=?+]?|[!\/]|##?|%%?|\^\^?|,,?/,
          "punctuation": /[\[\]]/,
          "environment": {
            pattern: RegExp("(\\{)" + envVars),
            lookbehind: true,
            alias: "constant"
          }
        }
      },
      /\$(?:\w+|[#?*!@$])/
    ],
    // Escape sequences from echo and printf's manuals, and escaped quotes.
    "entity": /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,2})/
  };
  Prism3.languages.bash = {
    "shebang": {
      pattern: /^#!\s*\/.*/,
      alias: "important"
    },
    "comment": {
      pattern: /(^|[^"{\\$])#.*/,
      lookbehind: true
    },
    "function-name": [
      // a) function foo {
      // b) foo() {
      // c) function foo() {
      // but not “foo {”
      {
        // a) and c)
        pattern: /(\bfunction\s+)[\w-]+(?=(?:\s*\(?:\s*\))?\s*\{)/,
        lookbehind: true,
        alias: "function"
      },
      {
        // b)
        pattern: /\b[\w-]+(?=\s*\(\s*\)\s*\{)/,
        alias: "function"
      }
    ],
    // Highlight variable names as variables in for and select beginnings.
    "for-or-select": {
      pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
      alias: "variable",
      lookbehind: true
    },
    // Highlight variable names as variables in the left-hand part
    // of assignments (“=” and “+=”).
    "assign-left": {
      pattern: /(^|[\s;|&]|[<>]\()\w+(?:\.\w+)*(?=\+?=)/,
      inside: {
        "environment": {
          pattern: RegExp("(^|[\\s;|&]|[<>]\\()" + envVars),
          lookbehind: true,
          alias: "constant"
        }
      },
      alias: "variable",
      lookbehind: true
    },
    // Highlight parameter names as variables
    "parameter": {
      pattern: /(^|\s)-{1,2}(?:\w+:[+-]?)?\w+(?:\.\w+)*(?=[=\s]|$)/,
      alias: "variable",
      lookbehind: true
    },
    "string": [
      // Support for Here-documents https://en.wikipedia.org/wiki/Here_document
      {
        pattern: /((?:^|[^<])<<-?\s*)(\w+)\s[\s\S]*?(?:\r?\n|\r)\2/,
        lookbehind: true,
        greedy: true,
        inside: insideString
      },
      // Here-document with quotes around the tag
      // → No expansion (so no “inside”).
      {
        pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
        lookbehind: true,
        greedy: true,
        inside: {
          "bash": commandAfterHeredoc
        }
      },
      // “Normal” string
      {
        // https://www.gnu.org/software/bash/manual/html_node/Double-Quotes.html
        pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
        lookbehind: true,
        greedy: true,
        inside: insideString
      },
      {
        // https://www.gnu.org/software/bash/manual/html_node/Single-Quotes.html
        pattern: /(^|[^$\\])'[^']*'/,
        lookbehind: true,
        greedy: true
      },
      {
        // https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
        pattern: /\$'(?:[^'\\]|\\[\s\S])*'/,
        greedy: true,
        inside: {
          "entity": insideString.entity
        }
      }
    ],
    "environment": {
      pattern: RegExp("\\$?" + envVars),
      alias: "constant"
    },
    "variable": insideString.variable,
    "function": {
      pattern: /(^|[\s;|&]|[<>]\()(?:add|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bzip2|cal|cargo|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|docker|docker-compose|du|egrep|eject|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|java|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|node|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|podman|podman-compose|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|sysctl|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vcpkg|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    "keyword": {
      pattern: /(^|[\s;|&]|[<>]\()(?:case|do|done|elif|else|esac|fi|for|function|if|in|select|then|until|while)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    // https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
    "builtin": {
      pattern: /(^|[\s;|&]|[<>]\()(?:\.|:|alias|bind|break|builtin|caller|cd|command|continue|declare|echo|enable|eval|exec|exit|export|getopts|hash|help|let|local|logout|mapfile|printf|pwd|read|readarray|readonly|return|set|shift|shopt|source|test|times|trap|type|typeset|ulimit|umask|unalias|unset)(?=$|[)\s;|&])/,
      lookbehind: true,
      // Alias added to make those easier to distinguish from strings.
      alias: "class-name"
    },
    "boolean": {
      pattern: /(^|[\s;|&]|[<>]\()(?:false|true)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    "file-descriptor": {
      pattern: /\B&\d\b/,
      alias: "important"
    },
    "operator": {
      // Lots of redirections here, but not just that.
      pattern: /\d?<>|>\||\+=|=[=~]?|!=?|<<[<-]?|[&\d]?>>|\d[<>]&?|[<>][&=]?|&[>&]?|\|[&|]?/,
      inside: {
        "file-descriptor": {
          pattern: /^\d/,
          alias: "important"
        }
      }
    },
    "punctuation": /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
    "number": {
      pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
      lookbehind: true
    }
  };
  commandAfterHeredoc.inside = Prism3.languages.bash;
  var toBeCopied = [
    "comment",
    "function-name",
    "for-or-select",
    "assign-left",
    "parameter",
    "string",
    "environment",
    "function",
    "keyword",
    "builtin",
    "boolean",
    "file-descriptor",
    "operator",
    "punctuation",
    "number"
  ];
  var inside = insideString.variable[1].inside;
  for (var i = 0; i < toBeCopied.length; i++) {
    inside[toBeCopied[i]] = Prism3.languages.bash[toBeCopied[i]];
  }
  Prism3.languages.sh = Prism3.languages.bash;
  Prism3.languages.shell = Prism3.languages.bash;
})(Prism);

// node_modules/prismjs/components/prism-markdown.js
(function(Prism3) {
  var inner = /(?:\\.|[^\\\n\r]|(?:\n|\r\n?)(?![\r\n]))/.source;
  function createInline(pattern) {
    pattern = pattern.replace(/<inner>/g, function() {
      return inner;
    });
    return RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + "(?:" + pattern + ")");
  }
  var tableCell = /(?:\\.|``(?:[^`\r\n]|`(?!`))+``|`[^`\r\n]+`|[^\\|\r\n`])+/.source;
  var tableRow = /\|?__(?:\|__)+\|?(?:(?:\n|\r\n?)|(?![\s\S]))/.source.replace(/__/g, function() {
    return tableCell;
  });
  var tableLine = /\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?(?:\n|\r\n?)/.source;
  Prism3.languages.markdown = Prism3.languages.extend("markup", {});
  Prism3.languages.insertBefore("markdown", "prolog", {
    "front-matter-block": {
      pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
      lookbehind: true,
      greedy: true,
      inside: {
        "punctuation": /^---|---$/,
        "front-matter": {
          pattern: /\S+(?:\s+\S+)*/,
          alias: ["yaml", "language-yaml"],
          inside: Prism3.languages.yaml
        }
      }
    },
    "blockquote": {
      // > ...
      pattern: /^>(?:[\t ]*>)*/m,
      alias: "punctuation"
    },
    "table": {
      pattern: RegExp("^" + tableRow + tableLine + "(?:" + tableRow + ")*", "m"),
      inside: {
        "table-data-rows": {
          pattern: RegExp("^(" + tableRow + tableLine + ")(?:" + tableRow + ")*$"),
          lookbehind: true,
          inside: {
            "table-data": {
              pattern: RegExp(tableCell),
              inside: Prism3.languages.markdown
            },
            "punctuation": /\|/
          }
        },
        "table-line": {
          pattern: RegExp("^(" + tableRow + ")" + tableLine + "$"),
          lookbehind: true,
          inside: {
            "punctuation": /\||:?-{3,}:?/
          }
        },
        "table-header-row": {
          pattern: RegExp("^" + tableRow + "$"),
          inside: {
            "table-header": {
              pattern: RegExp(tableCell),
              alias: "important",
              inside: Prism3.languages.markdown
            },
            "punctuation": /\|/
          }
        }
      }
    },
    "code": [
      {
        // Prefixed by 4 spaces or 1 tab and preceded by an empty line
        pattern: /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
        lookbehind: true,
        alias: "keyword"
      },
      {
        // ```optional language
        // code block
        // ```
        pattern: /^```[\s\S]*?^```$/m,
        greedy: true,
        inside: {
          "code-block": {
            pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
            lookbehind: true
          },
          "code-language": {
            pattern: /^(```).+/,
            lookbehind: true
          },
          "punctuation": /```/
        }
      }
    ],
    "title": [
      {
        // title 1
        // =======
        // title 2
        // -------
        pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
        alias: "important",
        inside: {
          punctuation: /==+$|--+$/
        }
      },
      {
        // # title 1
        // ###### title 6
        pattern: /(^\s*)#.+/m,
        lookbehind: true,
        alias: "important",
        inside: {
          punctuation: /^#+|#+$/
        }
      }
    ],
    "hr": {
      // ***
      // ---
      // * * *
      // -----------
      pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
      lookbehind: true,
      alias: "punctuation"
    },
    "list": {
      // * item
      // + item
      // - item
      // 1. item
      pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
      lookbehind: true,
      alias: "punctuation"
    },
    "url-reference": {
      // [id]: http://example.com "Optional title"
      // [id]: http://example.com 'Optional title'
      // [id]: http://example.com (Optional title)
      // [id]: <http://example.com> "Optional title"
      pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
      inside: {
        "variable": {
          pattern: /^(!?\[)[^\]]+/,
          lookbehind: true
        },
        "string": /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
        "punctuation": /^[\[\]!:]|[<>]/
      },
      alias: "url"
    },
    "bold": {
      // **strong**
      // __strong__
      // allow one nested instance of italic text using the same delimiter
      pattern: createInline(/\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\b|\*\*(?:(?!\*)<inner>|\*(?:(?!\*)<inner>)+\*)+\*\*/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^..)[\s\S]+(?=..$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /\*\*|__/
      }
    },
    "italic": {
      // *em*
      // _em_
      // allow one nested instance of bold text using the same delimiter
      pattern: createInline(/\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\b|\*(?:(?!\*)<inner>|\*\*(?:(?!\*)<inner>)+\*\*)+\*/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^.)[\s\S]+(?=.$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /[*_]/
      }
    },
    "strike": {
      // ~~strike through~~
      // ~strike~
      // eslint-disable-next-line regexp/strict
      pattern: createInline(/(~~?)(?:(?!~)<inner>)+\2/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^~~?)[\s\S]+(?=\1$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /~~?/
      }
    },
    "code-snippet": {
      // `code`
      // ``code``
      pattern: /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
      lookbehind: true,
      greedy: true,
      alias: ["code", "keyword"]
    },
    "url": {
      // [example](http://example.com "Optional title")
      // [example][id]
      // [example] [id]
      pattern: createInline(/!?\[(?:(?!\])<inner>)+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)|[ \t]?\[(?:(?!\])<inner>)+\])/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "operator": /^!/,
        "content": {
          pattern: /(^\[)[^\]]+(?=\])/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "variable": {
          pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/,
          lookbehind: true
        },
        "url": {
          pattern: /(^\]\()[^\s)]+/,
          lookbehind: true
        },
        "string": {
          pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
          lookbehind: true
        }
      }
    }
  });
  ["url", "bold", "italic", "strike"].forEach(function(token) {
    ["url", "bold", "italic", "strike", "code-snippet"].forEach(function(inside) {
      if (token !== inside) {
        Prism3.languages.markdown[token].inside.content.inside[inside] = Prism3.languages.markdown[inside];
      }
    });
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    if (env.language !== "markdown" && env.language !== "md") {
      return;
    }
    function walkTokens(tokens) {
      if (!tokens || typeof tokens === "string") {
        return;
      }
      for (var i = 0, l = tokens.length; i < l; i++) {
        var token = tokens[i];
        if (token.type !== "code") {
          walkTokens(token.content);
          continue;
        }
        var codeLang = token.content[1];
        var codeBlock = token.content[3];
        if (codeLang && codeBlock && codeLang.type === "code-language" && codeBlock.type === "code-block" && typeof codeLang.content === "string") {
          var lang = codeLang.content.replace(/\b#/g, "sharp").replace(/\b\+\+/g, "pp");
          lang = (/[a-z][\w-]*/i.exec(lang) || [""])[0].toLowerCase();
          var alias = "language-" + lang;
          if (!codeBlock.alias) {
            codeBlock.alias = [alias];
          } else if (typeof codeBlock.alias === "string") {
            codeBlock.alias = [codeBlock.alias, alias];
          } else {
            codeBlock.alias.push(alias);
          }
        }
      }
    }
    walkTokens(env.tokens);
  });
  Prism3.hooks.add("wrap", function(env) {
    if (env.type !== "code-block") {
      return;
    }
    var codeLang = "";
    for (var i = 0, l = env.classes.length; i < l; i++) {
      var cls = env.classes[i];
      var match = /language-(.+)/.exec(cls);
      if (match) {
        codeLang = match[1];
        break;
      }
    }
    var grammar = Prism3.languages[codeLang];
    if (!grammar) {
      if (codeLang && codeLang !== "none" && Prism3.plugins.autoloader) {
        var id = "md-" + (/* @__PURE__ */ new Date()).valueOf() + "-" + Math.floor(Math.random() * 1e16);
        env.attributes["id"] = id;
        Prism3.plugins.autoloader.loadLanguages(codeLang, function() {
          var ele = document.getElementById(id);
          if (ele) {
            ele.innerHTML = Prism3.highlight(ele.textContent, Prism3.languages[codeLang], codeLang);
          }
        });
      }
    } else {
      env.content = Prism3.highlight(textContent(env.content), grammar, codeLang);
    }
  });
  var tagPattern = RegExp(Prism3.languages.markup.tag.pattern.source, "gi");
  var KNOWN_ENTITY_NAMES = {
    "amp": "&",
    "lt": "<",
    "gt": ">",
    "quot": '"'
  };
  var fromCodePoint = String.fromCodePoint || String.fromCharCode;
  function textContent(html) {
    var text = html.replace(tagPattern, "");
    text = text.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(m, code) {
      code = code.toLowerCase();
      if (code[0] === "#") {
        var value;
        if (code[1] === "x") {
          value = parseInt(code.slice(2), 16);
        } else {
          value = Number(code.slice(1));
        }
        return fromCodePoint(value);
      } else {
        var known = KNOWN_ENTITY_NAMES[code];
        if (known) {
          return known;
        }
        return m;
      }
    });
    return text;
  }
  Prism3.languages.md = Prism3.languages.markdown;
})(Prism);

// node_modules/prismjs/components/prism-python.js
Prism.languages.python = {
  "comment": {
    pattern: /(^|[^\\])#.*/,
    lookbehind: true,
    greedy: true
  },
  "string-interpolation": {
    pattern: /(?:f|fr|rf)(?:("""|''')[\s\S]*?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2)/i,
    greedy: true,
    inside: {
      "interpolation": {
        // "{" <expression> <optional "!s", "!r", or "!a"> <optional ":" format specifier> "}"
        pattern: /((?:^|[^{])(?:\{\{)*)\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}])+\})+\})+\}/,
        lookbehind: true,
        inside: {
          "format-spec": {
            pattern: /(:)[^:(){}]+(?=\}$)/,
            lookbehind: true
          },
          "conversion-option": {
            pattern: /![sra](?=[:}]$)/,
            alias: "punctuation"
          },
          rest: null
        }
      },
      "string": /[\s\S]+/
    }
  },
  "triple-quoted-string": {
    pattern: /(?:[rub]|br|rb)?("""|''')[\s\S]*?\1/i,
    greedy: true,
    alias: "string"
  },
  "string": {
    pattern: /(?:[rub]|br|rb)?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/i,
    greedy: true
  },
  "function": {
    pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
    lookbehind: true
  },
  "class-name": {
    pattern: /(\bclass\s+)\w+/i,
    lookbehind: true
  },
  "decorator": {
    pattern: /(^[\t ]*)@\w+(?:\.\w+)*/m,
    lookbehind: true,
    alias: ["annotation", "punctuation"],
    inside: {
      "punctuation": /\./
    }
  },
  "keyword": /\b(?:_(?=\s*:)|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
  "builtin": /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
  "boolean": /\b(?:False|None|True)\b/,
  "number": /\b0(?:b(?:_?[01])+|o(?:_?[0-7])+|x(?:_?[a-f0-9])+)\b|(?:\b\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\B\.\d+(?:_\d+)*)(?:e[+-]?\d+(?:_\d+)*)?j?(?!\w)/i,
  "operator": /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
  "punctuation": /[{}[\];(),.:]/
};
Prism.languages.python["string-interpolation"].inside["interpolation"].inside.rest = Prism.languages.python;
Prism.languages.py = Prism.languages.python;

// node_modules/prismjs/components/prism-go.js
Prism.languages.go = Prism.languages.extend("clike", {
  "string": {
    pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"|`[^`]*`/,
    lookbehind: true,
    greedy: true
  },
  "keyword": /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go(?:to)?|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
  "boolean": /\b(?:_|false|iota|nil|true)\b/,
  "number": [
    // binary and octal integers
    /\b0(?:b[01_]+|o[0-7_]+)i?\b/i,
    // hexadecimal integers and floats
    /\b0x(?:[a-f\d_]+(?:\.[a-f\d_]*)?|\.[a-f\d_]+)(?:p[+-]?\d+(?:_\d+)*)?i?(?!\w)/i,
    // decimal integers and floats
    /(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?[\d_]+)?i?(?!\w)/i
  ],
  "operator": /[*\/%^!=]=?|\+[=+]?|-[=-]?|\|[=|]?|&(?:=|&|\^=?)?|>(?:>=?|=)?|<(?:<=?|=|-)?|:=|\.\.\./,
  "builtin": /\b(?:append|bool|byte|cap|close|complex|complex(?:64|128)|copy|delete|error|float(?:32|64)|u?int(?:8|16|32|64)?|imag|len|make|new|panic|print(?:ln)?|real|recover|rune|string|uintptr)\b/
});
Prism.languages.insertBefore("go", "string", {
  "char": {
    pattern: /'(?:\\.|[^'\\\r\n]){0,10}'/,
    greedy: true
  }
});
delete Prism.languages.go["class-name"];

// node_modules/prismjs/components/prism-rust.js
(function(Prism3) {
  var multilineComment = /\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|<self>)*\*\//.source;
  for (var i = 0; i < 2; i++) {
    multilineComment = multilineComment.replace(/<self>/g, function() {
      return multilineComment;
    });
  }
  multilineComment = multilineComment.replace(/<self>/g, function() {
    return /[^\s\S]/.source;
  });
  Prism3.languages.rust = {
    "comment": [
      {
        pattern: RegExp(/(^|[^\\])/.source + multilineComment),
        lookbehind: true,
        greedy: true
      },
      {
        pattern: /(^|[^\\:])\/\/.*/,
        lookbehind: true,
        greedy: true
      }
    ],
    "string": {
      pattern: /b?"(?:\\[\s\S]|[^\\"])*"|b?r(#*)"(?:[^"]|"(?!\1))*"\1/,
      greedy: true
    },
    "char": {
      pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u\{(?:[\da-fA-F]_*){1,6}\}|.)|[^\\\r\n\t'])'/,
      greedy: true
    },
    "attribute": {
      pattern: /#!?\[(?:[^\[\]"]|"(?:\\[\s\S]|[^\\"])*")*\]/,
      greedy: true,
      alias: "attr-name",
      inside: {
        "string": null
        // see below
      }
    },
    // Closure params should not be confused with bitwise OR |
    "closure-params": {
      pattern: /([=(,:]\s*|\bmove\s*)\|[^|]*\||\|[^|]*\|(?=\s*(?:\{|->))/,
      lookbehind: true,
      greedy: true,
      inside: {
        "closure-punctuation": {
          pattern: /^\||\|$/,
          alias: "punctuation"
        },
        rest: null
        // see below
      }
    },
    "lifetime-annotation": {
      pattern: /'\w+/,
      alias: "symbol"
    },
    "fragment-specifier": {
      pattern: /(\$\w+:)[a-z]+/,
      lookbehind: true,
      alias: "punctuation"
    },
    "variable": /\$\w+/,
    "function-definition": {
      pattern: /(\bfn\s+)\w+/,
      lookbehind: true,
      alias: "function"
    },
    "type-definition": {
      pattern: /(\b(?:enum|struct|trait|type|union)\s+)\w+/,
      lookbehind: true,
      alias: "class-name"
    },
    "module-declaration": [
      {
        pattern: /(\b(?:crate|mod)\s+)[a-z][a-z_\d]*/,
        lookbehind: true,
        alias: "namespace"
      },
      {
        pattern: /(\b(?:crate|self|super)\s*)::\s*[a-z][a-z_\d]*\b(?:\s*::(?:\s*[a-z][a-z_\d]*\s*::)*)?/,
        lookbehind: true,
        alias: "namespace",
        inside: {
          "punctuation": /::/
        }
      }
    ],
    "keyword": [
      // https://github.com/rust-lang/reference/blob/master/src/keywords.md
      /\b(?:Self|abstract|as|async|await|become|box|break|const|continue|crate|do|dyn|else|enum|extern|final|fn|for|if|impl|in|let|loop|macro|match|mod|move|mut|override|priv|pub|ref|return|self|static|struct|super|trait|try|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\b/,
      // primitives and str
      // https://doc.rust-lang.org/stable/rust-by-example/primitives.html
      /\b(?:bool|char|f(?:32|64)|[ui](?:8|16|32|64|128|size)|str)\b/
    ],
    // functions can technically start with an upper-case letter, but this will introduce a lot of false positives
    // and Rust's naming conventions recommend snake_case anyway.
    // https://doc.rust-lang.org/1.0.0/style/style/naming/README.html
    "function": /\b[a-z_]\w*(?=\s*(?:::\s*<|\())/,
    "macro": {
      pattern: /\b\w+!/,
      alias: "property"
    },
    "constant": /\b[A-Z_][A-Z_\d]+\b/,
    "class-name": /\b[A-Z]\w*\b/,
    "namespace": {
      pattern: /(?:\b[a-z][a-z_\d]*\s*::\s*)*\b[a-z][a-z_\d]*\s*::(?!\s*<)/,
      inside: {
        "punctuation": /::/
      }
    },
    // Hex, oct, bin, dec numbers with visual separators and type suffix
    "number": /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:f32|f64|[iu](?:8|16|32|64|size)?))?\b/,
    "boolean": /\b(?:false|true)\b/,
    "punctuation": /->|\.\.=|\.{1,3}|::|[{}[\];(),:]/,
    "operator": /[-+*\/%!^]=?|=[=>]?|&[&=]?|\|[|=]?|<<?=?|>>?=?|[@?]/
  };
  Prism3.languages.rust["closure-params"].inside.rest = Prism3.languages.rust;
  Prism3.languages.rust["attribute"].inside["string"] = Prism3.languages.rust["string"];
})(Prism);

// node_modules/prismjs/components/prism-java.js
(function(Prism3) {
  var keywords = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|exports|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record(?!\s*[(){}[\]<>=%~.:,;?+\-*/&|^])|requires|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/;
  var classNamePrefix = /(?:[a-z]\w*\s*\.\s*)*(?:[A-Z]\w*\s*\.\s*)*/.source;
  var className = {
    pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z](?:[\d_A-Z]*[a-z]\w*)?\b/.source),
    lookbehind: true,
    inside: {
      "namespace": {
        pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
        inside: {
          "punctuation": /\./
        }
      },
      "punctuation": /\./
    }
  };
  Prism3.languages.java = Prism3.languages.extend("clike", {
    "string": {
      pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"/,
      lookbehind: true,
      greedy: true
    },
    "class-name": [
      className,
      {
        // variables, parameters, and constructor references
        // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
        pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z]\w*(?=\s+\w+\s*[;,=()]|\s*(?:\[[\s,]*\]\s*)?::\s*new\b)/.source),
        lookbehind: true,
        inside: className.inside
      },
      {
        // class names based on keyword
        // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
        pattern: RegExp(/(\b(?:class|enum|extends|implements|instanceof|interface|new|record|throws)\s+)/.source + classNamePrefix + /[A-Z]\w*\b/.source),
        lookbehind: true,
        inside: className.inside
      }
    ],
    "keyword": keywords,
    "function": [
      Prism3.languages.clike.function,
      {
        pattern: /(::\s*)[a-z_]\w*/,
        lookbehind: true
      }
    ],
    "number": /\b0b[01][01_]*L?\b|\b0x(?:\.[\da-f_p+-]+|[\da-f_]+(?:\.[\da-f_p+-]+)?)\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?\d[\d_]*)?[dfl]?/i,
    "operator": {
      pattern: /(^|[^.])(?:<<=?|>>>?=?|->|--|\+\+|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?)/m,
      lookbehind: true
    },
    "constant": /\b[A-Z][A-Z_\d]+\b/
  });
  Prism3.languages.insertBefore("java", "string", {
    "triple-quoted-string": {
      // http://openjdk.java.net/jeps/355#Description
      pattern: /"""[ \t]*[\r\n](?:(?:"|"")?(?:\\.|[^"\\]))*"""/,
      greedy: true,
      alias: "string"
    },
    "char": {
      pattern: /'(?:\\.|[^'\\\r\n]){1,6}'/,
      greedy: true
    }
  });
  Prism3.languages.insertBefore("java", "class-name", {
    "annotation": {
      pattern: /(^|[^.])@\w+(?:\s*\.\s*\w+)*/,
      lookbehind: true,
      alias: "punctuation"
    },
    "generics": {
      pattern: /<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&))*>)*>)*>)*>/,
      inside: {
        "class-name": className,
        "keyword": keywords,
        "punctuation": /[<>(),.:]/,
        "operator": /[?&|]/
      }
    },
    "import": [
      {
        pattern: RegExp(/(\bimport\s+)/.source + classNamePrefix + /(?:[A-Z]\w*|\*)(?=\s*;)/.source),
        lookbehind: true,
        inside: {
          "namespace": className.inside.namespace,
          "punctuation": /\./,
          "operator": /\*/,
          "class-name": /\w+/
        }
      },
      {
        pattern: RegExp(/(\bimport\s+static\s+)/.source + classNamePrefix + /(?:\w+|\*)(?=\s*;)/.source),
        lookbehind: true,
        alias: "static",
        inside: {
          "namespace": className.inside.namespace,
          "static": /\b\w+$/,
          "punctuation": /\./,
          "operator": /\*/,
          "class-name": /\w+/
        }
      }
    ],
    "namespace": {
      pattern: RegExp(
        /(\b(?:exports|import(?:\s+static)?|module|open|opens|package|provides|requires|to|transitive|uses|with)\s+)(?!<keyword>)[a-z]\w*(?:\.[a-z]\w*)*\.?/.source.replace(/<keyword>/g, function() {
          return keywords.source;
        })
      ),
      lookbehind: true,
      inside: {
        "punctuation": /\./
      }
    }
  });
})(Prism);

// node_modules/prismjs/components/prism-sql.js
Prism.languages.sql = {
  "comment": {
    pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
    lookbehind: true
  },
  "variable": [
    {
      pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
      greedy: true
    },
    /@[\w.$]+/
  ],
  "string": {
    pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
    greedy: true,
    lookbehind: true
  },
  "identifier": {
    pattern: /(^|[^@\\])`(?:\\[\s\S]|[^`\\]|``)*`/,
    greedy: true,
    lookbehind: true,
    inside: {
      "punctuation": /^`|`$/
    }
  },
  "function": /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
  // Should we highlight user defined functions too?
  "keyword": /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:COL|_INSERT)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURN(?:ING|S)?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
  "boolean": /\b(?:FALSE|NULL|TRUE)\b/i,
  "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?|\B\.\d+\b/i,
  "operator": /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|DIV|ILIKE|IN|IS|LIKE|NOT|OR|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
  "punctuation": /[;[\]()`,.]/
};

// node_modules/prismjs/components/prism-diff.js
(function(Prism3) {
  Prism3.languages.diff = {
    "coord": [
      // Match all kinds of coord lines (prefixed by "+++", "---" or "***").
      /^(?:\*{3}|-{3}|\+{3}).*$/m,
      // Match "@@ ... @@" coord lines in unified diff.
      /^@@.*@@$/m,
      // Match coord lines in normal diff (starts with a number).
      /^\d.*$/m
    ]
    // deleted, inserted, unchanged, diff
  };
  var PREFIXES = {
    "deleted-sign": "-",
    "deleted-arrow": "<",
    "inserted-sign": "+",
    "inserted-arrow": ">",
    "unchanged": " ",
    "diff": "!"
  };
  Object.keys(PREFIXES).forEach(function(name) {
    var prefix = PREFIXES[name];
    var alias = [];
    if (!/^\w+$/.test(name)) {
      alias.push(/\w+/.exec(name)[0]);
    }
    if (name === "diff") {
      alias.push("bold");
    }
    Prism3.languages.diff[name] = {
      pattern: RegExp("^(?:[" + prefix + "].*(?:\r\n?|\n|(?![\\s\\S])))+", "m"),
      alias,
      inside: {
        "line": {
          pattern: /(.)(?=[\s\S]).*(?:\r\n?|\n)?/,
          lookbehind: true
        },
        "prefix": {
          pattern: /[\s\S]/,
          alias: /\w+/.exec(name)[0]
        }
      }
    };
  });
  Object.defineProperty(Prism3.languages.diff, "PREFIXES", {
    value: PREFIXES
  });
})(Prism);

// src/client/highlight.ts
var ALIAS = {
  typescript: "typescript",
  javascript: "javascript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "css",
  less: "css",
  xml: "markup",
  markdown: "markdown",
  yaml: "yaml",
  bash: "bash",
  shell: "bash",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  sql: "sql",
  diff: "diff"
};
function hasGrammar(lang) {
  const key = ALIAS[lang] ?? lang;
  return typeof import_prismjs.default.languages[key] === "object" && import_prismjs.default.languages[key] !== null;
}
function highlight(code, lang) {
  const key = ALIAS[lang] ?? lang;
  const grammar = import_prismjs.default.languages[key];
  if (!grammar) return "";
  try {
    return import_prismjs.default.highlight(code, grammar, key);
  } catch {
    return "";
  }
}
var TOKEN_CSS = `
.dgp-dv-code .token.keyword,.dgp-fb-code .token.keyword{color:#a626a4}
.dgp-dv-code .token.string,.dgp-fb-code .token.string{color:#50a14f}
.dgp-dv-code .token.number,.dgp-fb-code .token.number{color:#986801}
.dgp-dv-code .token.comment,.dgp-fb-code .token.comment{color:var(--dgp-faint);font-style:italic}
.dgp-dv-code .token.function,.dgp-fb-code .token.function{color:#4078f2}
.dgp-dv-code .token.operator,.dgp-fb-code .token.operator{color:var(--dgp-muted)}
.dgp-dv-code .token.punctuation,.dgp-fb-code .token.punctuation{color:var(--dgp-muted)}
.dgp-dv-code .token.class-name,.dgp-fb-code .token.class-name{color:#c18401}
.dgp-dv-code .token.tag,.dgp-fb-code .token.tag{color:#e45649}
.dgp-dv-code .token.attr-name,.dgp-fb-code .token.attr-name{color:#986801}
.dgp-dv-code .token.property,.dgp-fb-code .token.property{color:#4078f2}
`;

// src/client/shared.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var NS = "dsh-git-panel";
var ROUTE = "/dsh-git-panel";
function routeUrl(path) {
  const base = document.baseURI || location.href;
  return new URL(ROUTE + path, base).toString();
}
async function api(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2e4);
  try {
    const response = await fetch(routeUrl(path), {
      method: body === void 0 ? "GET" : "POST",
      headers: body === void 0 ? void 0 : { "content-type": "application/json" },
      body: body === void 0 ? void 0 : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!json) throw new Error(`\u63A5\u53E3\u8FD4\u56DE\u975E JSON\uFF08HTTP ${response.status}\uFF09`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}
var REPO_PERMISSIONS = ["full", "read", "none"];
var PREF_DIFF_LAYOUT = "dgp.diffLayout";
var PREF_HIGHLIGHT = "dgp.highlight";
function readPref(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null || value === "" ? fallback : value;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
  }
}
var CSS = `
/* \u4F5C\u7528\u57DF\uFF1A\u53EA\u5F71\u54CD\u63D2\u4EF6\u81EA\u5DF1\u7684 DOM\u3002\u989C\u8272/\u5706\u89D2/\u52A8\u6548\u4E00\u5F8B\u53D6\u5BBF\u4E3B\u4E3B\u9898 token\uFF0C
   \u5E76\u5E26\u6D45\u8272\u4E3B\u9898\u771F\u5B9E\u53D6\u503C\u4F5C fallback\uFF08\u5BBF\u4E3B\u672A\u6CE8\u5165\u65F6\u4E5F\u4E0D\u81F3\u4E8E\u8D70\u6837\uFF09\u3002
   .dgp-portal \u7528\u4E8E portal \u5230 body \u7684\u6D6E\u5C42\uFF08\u8131\u79BB .dgp-root \u540E\u53D8\u91CF\u5FC5\u987B\u81EA\u5E26\uFF09\u3002 */
.dgp-root,.dgp-portal{
  --dgp-fg:var(--dsw-alias-label-primary,#0f1115);
  --dgp-fg2:var(--dsw-alias-label-secondary,#61666b);
  --dgp-muted:var(--dsw-alias-label-tertiary,#81858c);
  --dgp-faint:var(--dsw-alias-label-caption,#adb2b8);
  --dgp-line:var(--dsw-alias-border-l2,#0000001a);
  --dgp-line2:var(--dsw-alias-border-l3,#0000001f);
  --dgp-inset:var(--dsw-alias-bg-module-platform,#f5f6f7);
  --dgp-hover:var(--dsw-alias-interactive-bg-hover,#2631480f);
  --dgp-accent:var(--dsw-alias-state-business-primary,#4176e6);
  --dgp-danger:var(--dsw-alias-state-error-primary,#ec1313);
  --dgp-ok:var(--dsw-alias-state-success-primary,#22c55e);
  --dgp-warn:#b45309;
  --dgp-r-xs:var(--dsw-radius-xs,4px);
  --dgp-r-sm:var(--dsw-radius-sm,8px);
  --dgp-ease:var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));
  --dgp-fast:var(--ds-transition-duration-fast,.1s);
  --dgp-code:var(--ds-font-family-code,"SF Mono","JetBrains Mono",Consolas,Menlo,monospace);
  color:var(--dgp-fg);font-family:inherit;font-size:14px;line-height:22px;-webkit-font-smoothing:antialiased;
}
.dgp-section{display:flex;flex-direction:column;padding:2px 0 8px;max-width:100%}
.dgp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:0 0 14px;border-bottom:.5px solid var(--dgp-line)}
.dgp-title{font-size:14px;font-weight:500;line-height:22px;color:var(--dgp-fg);display:flex;align-items:center;gap:7px}
.dgp-sub{font-size:12px;line-height:18px;color:var(--dgp-muted);margin-top:4px}
.dgp-tabs,.dgp-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:var(--dgp-r-sm);background:var(--dgp-inset);align-self:flex-start;max-width:100%;overflow:hidden}
.dgp-tab,.dgp-seg button{appearance:none;border:0;margin:0;background:transparent;color:var(--dgp-muted);height:26px;padding:0 12px;border-radius:calc(var(--dgp-r-sm) - 3px);font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease),box-shadow var(--dgp-fast) var(--dgp-ease)}
.dgp-tab:hover,.dgp-seg button:hover{color:var(--dgp-fg2)}
.dgp-tab[data-on="1"],.dgp-seg button[data-on="1"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);box-shadow:var(--dsw-shadow-lv1,0 2px 4px 0 #0000000d)}
.dgp-tab:focus-visible,.dgp-seg button:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:-1px}
.dgp-group{display:flex;flex-direction:column}
.dgp-group-title{font-size:11px;line-height:16px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--dgp-faint);padding:18px 0 4px}
.dgp-row{display:flex;align-items:center;gap:8px;min-width:0}
.dgp-line{border-bottom:.5px solid var(--dgp-line);padding:13px 0;display:flex;align-items:center;justify-content:space-between;gap:24px}
.dgp-line:last-of-type{border-bottom:none}
.dgp-line-main{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.dgp-line-side{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.dgp-line-sep{width:1px;height:16px;background:var(--dgp-line);margin:0 2px;flex:0 0 auto}
.dgp-repo[data-saving="1"]{opacity:.6}
.dgp-name{font-size:14px;line-height:22px;font-weight:500;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-meta{font-size:12px;line-height:18px;color:var(--dgp-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dgp-meta code,.dgp-mono{font-family:var(--dgp-code);font-size:11.5px}
.dgp-hint{font-size:12px;line-height:18px;color:var(--dgp-muted);margin-top:5px}
.dgp-err{font-size:12px;line-height:18px;color:var(--dgp-danger);margin-top:6px;word-break:break-word}
.dgp-ok{font-size:12px;line-height:18px;color:var(--dgp-ok);margin-top:6px}
.dgp-dot{width:6px;height:6px;border-radius:50%;background:var(--dgp-faint);flex:0 0 auto;box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-faint) 14%,transparent)}
.dgp-dot[data-state="connected"]{background:var(--dgp-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-ok) 16%,transparent)}
.dgp-dot[data-state="expired"],.dgp-dot[data-state="error"]{background:var(--dgp-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-danger) 16%,transparent)}
.dgp-badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:var(--dgp-r-xs);border:.5px solid var(--dgp-line2);font-size:11px;line-height:16px;font-weight:500;color:var(--dgp-muted);white-space:nowrap}
.dgp-badge[data-tone="mono"]{font-family:var(--dgp-code)}
.dgp-badge[data-state="connected"]{color:var(--dgp-ok);border-color:color-mix(in srgb,var(--dgp-ok) 40%,transparent);background:color-mix(in srgb,var(--dgp-ok) 10%,transparent)}
.dgp-badge[data-state="expired"],.dgp-badge[data-state="error"]{color:var(--dgp-danger);border-color:color-mix(in srgb,var(--dgp-danger) 40%,transparent);background:color-mix(in srgb,var(--dgp-danger) 9%,transparent)}
.dgp-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;padding:0 11px;border-radius:var(--dgp-r-sm);border:.5px solid var(--dgp-line2);background:transparent;color:var(--dgp-fg2);font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-btn:hover:not(:disabled){background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-btn:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-btn:disabled{opacity:.45;cursor:not-allowed}
.dgp-btn.primary{background:var(--dsw-alias-button-primary-fill,#0f1115);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}
.dgp-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#3c3c3d);color:var(--dsw-alias-label-primary-inverted,#fff)}
.dgp-btn.danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger,#ec13130d);border-color:color-mix(in srgb,var(--dgp-danger) 45%,transparent);color:var(--dgp-danger)}
.dgp-btn.ghost{border-color:transparent}
.dgp-field{display:flex;flex-direction:column;padding:13px 0;border-bottom:.5px solid var(--dgp-line)}
.dgp-field:last-of-type{border-bottom:none}
.dgp-label{font-size:12px;line-height:18px;font-weight:500;color:var(--dgp-fg2);margin-bottom:7px}
.dgp-input,.dgp-select,.dgp-area{width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font:inherit;font-size:13px;line-height:20px;outline:none;transition:border-color var(--dgp-fast) var(--dgp-ease),box-shadow var(--dgp-fast) var(--dgp-ease)}
.dgp-input,.dgp-select{max-width:340px}
.dgp-select{appearance:none;padding-right:26px;background-image:linear-gradient(45deg,transparent 50%,var(--dgp-muted) 50%),linear-gradient(135deg,var(--dgp-muted) 50%,transparent 50%);background-position:calc(100% - 14px) 14px,calc(100% - 9px) 14px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.dgp-area{height:auto;min-height:76px;padding:8px 10px;resize:vertical;font-family:var(--dgp-code);font-size:12px;line-height:20px}
.dgp-input::placeholder,.dgp-area::placeholder{color:var(--dgp-faint)}
.dgp-input:focus,.dgp-select:focus,.dgp-area:focus{border-color:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 18%,transparent)}
.dgp-check{display:flex;align-items:flex-start;gap:10px;padding:13px 0;border-bottom:.5px solid var(--dgp-line);cursor:pointer}
.dgp-check:last-of-type{border-bottom:none}
.dgp-check input{appearance:none;flex:0 0 auto;width:16px;height:16px;margin:3px 0 0;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-xs);background:var(--dsw-alias-bg-layer-1,#fff);cursor:pointer;position:relative;transition:background var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-check input:checked{background:var(--dgp-accent);border-color:var(--dgp-accent)}
.dgp-check input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(42deg)}
.dgp-check input:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-check-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.dgp-check-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dgp-fg)}
.dgp-card{background:var(--dgp-inset);border-radius:var(--dgp-r-sm);padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.dgp-kv{display:grid;grid-template-columns:88px minmax(0,1fr);gap:6px 12px;font-size:12px;line-height:18px;margin:0}
.dgp-kv dt{color:var(--dgp-muted);margin:0}
.dgp-kv dd{color:var(--dgp-fg2);margin:0;overflow-wrap:anywhere}
.dgp-code{font-family:var(--dgp-code);font-size:20px;line-height:28px;font-weight:600;letter-spacing:.14em;color:var(--dgp-fg);font-variant-numeric:tabular-nums}
.dgp-link{color:var(--dsw-alias-link,var(--dgp-accent));text-decoration:none;border-bottom:.5px solid color-mix(in srgb,currentColor 40%,transparent)}
.dgp-link:hover{border-bottom-color:currentColor}
.dgp-sep{height:.5px;background:var(--dgp-line);margin:2px 0}
.dgp-chip{display:inline-flex;align-items:center;gap:5px;height:22px;max-width:240px;padding:0 6px;margin:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-muted);cursor:pointer;font-family:var(--dgp-code);font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease)}
.dgp-chip:hover{background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-chip:active{background:var(--dsw-alias-interactive-bg-active,#2631481a)}
.dgp-chip:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-chip svg{flex:0 0 auto;opacity:.7;transition:opacity var(--dgp-fast) var(--dgp-ease)}
.dgp-chip:hover svg{opacity:1}
.dgp-chip-name{overflow:hidden;text-overflow:ellipsis;max-width:150px}
.dgp-chip-aux{color:var(--dgp-faint);font-variant-numeric:tabular-nums}
.dgp-chip[data-warn="1"]{color:var(--dgp-danger)}
.dgp-chip[data-warn="1"] svg{opacity:1}
.dgp-chip[data-norepo="1"]{color:var(--dgp-faint)}
.dgp-chip[data-dirty="1"]{color:var(--dgp-warn,#b45309)}
.dgp-chip[data-dirty="1"] svg{opacity:1}
.dgp-chip[data-open="1"]{background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-chip-wrap{position:relative;display:inline-flex;align-items:center;gap:4px}
.dgp-menu{display:flex;flex-direction:column;position:fixed;z-index:1200;min-width:236px;max-width:320px;max-height:min(340px,60vh);overflow-y:auto;padding:4px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-md);background:var(--dsw-alias-bg-layer-1,var(--dgp-bg,#fff));box-shadow:var(--dsw-elevation-prominent,0 8px 28px #00000026);font-family:var(--dsw-font-family,inherit);font-size:12px;line-height:18px;color:var(--dgp-fg2);box-sizing:border-box}
.dgp-menu-head{padding:7px 9px 6px;display:flex;align-items:center;gap:6px;color:var(--dgp-faint);font-size:11px;line-height:16px;letter-spacing:.02em;text-transform:uppercase}
.dgp-menu-sum{padding:0 9px 7px;color:var(--dgp-muted);font-size:11px;line-height:16px;font-family:var(--dgp-code);word-break:break-all}
.dgp-menu[data-graph="1"]{width:min(440px,calc(100vw - 16px));min-width:0;max-width:min(440px,calc(100vw - 16px));max-height:min(520px,72vh)}
.dgp-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:var(--dgp-r-sm);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background var(--dgp-fast) var(--dgp-ease)}
.dgp-menu-item:hover:not(:disabled){background:var(--dgp-hover)}
.dgp-menu-item:disabled{opacity:.55;cursor:default}
.dgp-menu-item svg{flex:0 0 auto;opacity:.75}
.dgp-menu-item-main{display:flex;flex-direction:column;min-width:0;gap:1px}
.dgp-menu-item-title{color:var(--dgp-fg);font-size:12px;line-height:17px}
.dgp-menu-item-hint{color:var(--dgp-faint);font-size:11px;line-height:15px}
.dgp-menu-item[data-primary="1"] .dgp-menu-item-title{font-weight:500}
.dgp-menu-item[data-primary="1"] svg{color:var(--dgp-accent);opacity:1}
.dgp-menu-note{padding:7px 9px;color:var(--dgp-muted);font-size:11px;line-height:16px}
.dgp-menu-note[data-tone="error"]{color:var(--dgp-danger)}
.dgp-menu-note[data-tone="ok"]{color:var(--dsw-alias-state-success-primary,#22c55e)}
.dgp-menu-note[data-tone="warn"]{color:var(--dgp-warn,#b45309)}
a.dgp-menu-note{display:block;text-decoration:none;border-radius:6px}
a.dgp-menu-note:hover{background:var(--dgp-hover,rgba(127,127,127,.1))}
.dgp-menu-sep{height:.5px;background:var(--dgp-line);margin:3px 6px}
/* \u83DC\u5355\u5206\u7EC4\u6807\u9898\uFF1A\u628A\u300C\u4ED3\u5E93\u52A8\u4F5C\u300D\u4E0E\u300C\u6253\u5F00/\u8BBE\u7F6E\u300D\u5206\u5F00\uFF0C\u907F\u514D\u4E00\u5806\u540C\u7EA7\u9879\u5E73\u94FA\u3002 */
.dgp-menu-group{padding:6px 9px 3px;color:var(--dgp-faint);font-size:10.5px;line-height:15px;letter-spacing:.03em;text-transform:uppercase}
.dgp-root,.dgp-portal{
  --dgp-lane-0:#4176e6;--dgp-lane-1:#1f9d63;--dgp-lane-2:#c98a06;--dgp-lane-3:#8b5cf6;
  --dgp-lane-4:#0ea5e9;--dgp-lane-5:#e0526a;--dgp-lane-6:#e2762e;--dgp-lane-7:#64748b;
}
body[data-ds-dark-theme] .dgp-root,body[data-ds-dark-theme] .dgp-portal{
  --dgp-lane-0:#7aaaff;--dgp-lane-1:#4ecf9a;--dgp-lane-2:#e9b949;--dgp-lane-3:#b18cff;
  --dgp-lane-4:#56c8f5;--dgp-lane-5:#f57e94;--dgp-lane-6:#f59a63;--dgp-lane-7:#94a3b8;
  --dgp-warn:#e9b949;
}
.dgp-graph{display:flex;flex-direction:column;min-width:0}
.dgp-graph-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px 5px;color:var(--dgp-faint);font-size:11px;line-height:16px;letter-spacing:.02em;text-transform:uppercase}
.dgp-graph-meta{text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums;color:var(--dgp-faint)}
.dgp-graph-body{display:flex;align-items:flex-start;max-height:min(320px,46vh);overflow:auto;overscroll-behavior:contain;padding:2px 4px 4px}
.dgp-graph-row{display:flex;align-items:center;gap:8px;height:34px;padding:0 5px;border-radius:var(--dgp-r-xs);cursor:default;min-width:0;transition:background var(--dgp-fast) var(--dgp-ease)}
.dgp-graph-row:hover{background:var(--dgp-hover)}
.dgp-graph-row[data-active="1"]{background:var(--dgp-hover)}
.dgp-graph-row[data-current="1"] .dgp-graph-subject{color:var(--dgp-fg)}
.dgp-graph-svg{flex:0 0 auto;display:block;overflow:visible}
.dgp-graph-dot{stroke:var(--dsw-alias-bg-layer-1,var(--dgp-bg,#fff));stroke-width:1.5;transition:r var(--dgp-fast) var(--dgp-ease)}
.dgp-graph-line{fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.dgp-graph-main{display:flex;flex-direction:column;min-width:0;gap:0;flex:1 1 auto}
.dgp-graph-subject{color:var(--dgp-fg2);font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dgp-graph-sub{display:flex;align-items:center;gap:6px;min-width:0;color:var(--dgp-faint);font-size:10px;line-height:13px;font-family:var(--dgp-code);white-space:nowrap;overflow:hidden}
.dgp-graph-hash{flex:0 0 auto;opacity:.85}
.dgp-graph-author{overflow:hidden;text-overflow:ellipsis;min-width:0}
.dgp-graph-refs{display:flex;align-items:center;gap:4px;flex:0 0 auto}
.dgp-graph-ref{display:inline-flex;align-items:center;height:15px;padding:0 5px;border-radius:var(--dgp-r-xs);border:.5px solid var(--dgp-line2);background:transparent;color:var(--dgp-muted);font-family:var(--dgp-code);font-size:10px;line-height:15px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-graph-ref[data-kind="head"]{border-color:transparent;background:var(--dgp-accent);color:#fff;font-weight:500}
.dgp-graph-ref[data-kind="tag"]{border-color:var(--dgp-line2);color:var(--dgp-warn,#b45309)}
.dgp-graph-ref[data-kind="remote"]{color:var(--dgp-faint)}
.dgp-graph-note{padding:6px 9px 8px;color:var(--dgp-faint);font-size:11px;line-height:16px}
.dgp-graph-note[data-tone="error"]{color:var(--dgp-danger)}
.dgp-graph-detail{display:flex;align-items:center;gap:6px;padding:6px 9px 2px;border-top:.5px solid var(--dgp-line);margin-top:2px;color:var(--dgp-muted);font-size:11px;line-height:16px;min-width:0}
.dgp-graph-detail-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dgp-code)}
.dgp-graph-copy{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);cursor:pointer}
.dgp-graph-copy:hover{background:var(--dgp-hover);color:var(--dgp-fg2)}
/* \u6982\u89C8\u5E26\uFF1A\u4E00\u884C\u6458\u8981\uFF0C\u53D6\u4EE3\u56DB\u683C\u7EDF\u8BA1\u5361\uFF08\u4FE1\u606F\u5BC6\u5EA6\u9AD8\u3001\u4E0D\u62A2\u89C6\u89C9\u91CD\u5FC3\uFF09\u3002 */
.dgp-overview{display:flex;align-items:center;flex-wrap:wrap;gap:0;margin:12px 0 14px;padding:7px 2px;border-top:.5px solid var(--dgp-line);border-bottom:.5px solid var(--dgp-line)}
.dgp-overview-item{display:inline-flex;align-items:baseline;gap:5px;padding:0 11px;min-width:0;white-space:nowrap}
.dgp-overview-item:first-child{padding-left:0}
.dgp-overview-label{font-size:11px;line-height:16px;color:var(--dgp-faint);letter-spacing:.02em}
.dgp-overview-num{font-family:var(--dgp-code);font-size:13px;line-height:18px;font-weight:600;color:var(--dgp-fg2);font-variant-numeric:tabular-nums}
.dgp-overview-hint{font-size:11px;line-height:16px;color:var(--dgp-warn,#b45309)}
.dgp-overview-item[data-tone="ok"] .dgp-overview-num{color:var(--dgp-ok)}
.dgp-overview-item[data-tone="warn"] .dgp-overview-num{color:var(--dgp-warn,#b45309)}
.dgp-overview-sep{width:1px;height:12px;background:var(--dgp-line);flex:0 0 auto}
.dgp-overview-gap,.dgp-acct-gap{flex:1 1 auto;min-width:8px}
.dgp-callout{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:8px 10px 8px 12px;border:.5px solid var(--dgp-line2);border-left:2px solid var(--dgp-accent);border-radius:var(--dgp-r-xs);background:var(--dgp-inset);color:var(--dgp-fg2);font-size:12px;line-height:18px}
.dgp-callout-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dgp-empty{display:flex;flex-direction:column;align-items:center;gap:7px;padding:26px 16px 24px;text-align:center;color:var(--dgp-muted)}
.dgp-empty-art{color:var(--dgp-faint);opacity:.85}
.dgp-empty-title{font-size:13px;line-height:19px;font-weight:500;color:var(--dgp-fg2)}
.dgp-empty-hint{font-size:12px;line-height:18px;color:var(--dgp-muted);max-width:44ch}
.dgp-skel{display:flex;flex-direction:column;gap:7px;padding:9px 0}
.dgp-skel-line{height:11px;border-radius:var(--dgp-r-xs);background:linear-gradient(90deg,var(--dgp-inset) 0%,var(--dgp-hover) 42%,var(--dgp-inset) 84%);background-size:220% 100%;animation:dgp-shimmer 1.25s linear infinite}
@keyframes dgp-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}
@media (prefers-reduced-motion:reduce){.dgp-skel-line{animation:none;background:var(--dgp-inset)}}
.dgp-changes{display:flex;flex-direction:column;min-width:0}
.dgp-changes-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:5px 9px 6px;color:var(--dgp-faint);font-size:11px;line-height:16px;letter-spacing:.02em;text-transform:uppercase}
.dgp-changes-count{text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums;color:var(--dgp-faint)}
.dgp-change{display:flex;align-items:center;gap:7px;padding:4px 9px;min-width:0;border-radius:var(--dgp-r-xs);transition:background var(--dgp-fast) var(--dgp-ease)}
.dgp-change:hover{background:var(--dgp-hover)}
.dgp-change-code{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:16px;padding:0 4px;border-radius:3px;background:var(--dgp-inset);color:var(--dgp-muted);font-family:var(--dgp-code);font-size:10px;line-height:16px;font-weight:600}
.dgp-change-code[data-code="A"]{color:var(--dgp-ok);background:color-mix(in srgb,var(--dgp-ok) 12%,transparent)}
.dgp-change-code[data-code="D"]{color:var(--dgp-danger);background:color-mix(in srgb,var(--dgp-danger) 11%,transparent)}
.dgp-change-code[data-code="R"],.dgp-change-code[data-code="C"]{color:var(--dgp-lane-3);background:color-mix(in srgb,var(--dgp-lane-3) 12%,transparent)}
.dgp-change-code[data-code="??"]{color:var(--dgp-warn,#b45309);background:color-mix(in srgb,var(--dgp-warn,#b45309) 12%,transparent)}
.dgp-change-path{flex:1 1 auto;min-width:0;color:var(--dgp-fg2);font-family:var(--dgp-code);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.dgp-change[data-staged="1"] .dgp-change-path{color:var(--dgp-fg)}
.dgp-change-stat{flex:0 0 auto;font-family:var(--dgp-code);font-size:10.5px;line-height:15px;font-variant-numeric:tabular-nums}
.dgp-change-stat[data-sign="add"]{color:var(--dgp-ok)}
.dgp-change-stat[data-sign="del"]{color:var(--dgp-danger)}
.dgp-change-stat[data-sign="staged"]{color:var(--dgp-accent)}
.dgp-changes-note{padding:6px 9px 8px;color:var(--dgp-faint);font-size:11px;line-height:16px}
.dgp-changes-note[data-tone="error"]{color:var(--dgp-danger)}
.dgp-toast-wrap{position:fixed;right:18px;bottom:18px;z-index:1300;pointer-events:none}
.dgp-toast{display:flex;align-items:center;gap:8px;max-width:340px;padding:9px 13px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 28px #00000026);color:var(--dgp-fg);font-size:12px;line-height:18px;animation:dgp-toast-in .18s var(--dgp-ease) both}
.dgp-toast-dot{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--dgp-faint)}
.dgp-toast[data-tone="ok"] .dgp-toast-dot{background:var(--dgp-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-ok) 16%,transparent)}
.dgp-toast[data-tone="error"] .dgp-toast-dot{background:var(--dgp-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-danger) 16%,transparent)}
.dgp-toast[data-tone="info"] .dgp-toast-dot{background:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 16%,transparent)}
.dgp-toast-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
@keyframes dgp-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.dgp-toast{animation:none}}

/* ------------------------------------------------------------------ */
/* Git \u5DE5\u4F5C\u53F0\uFF08dgp-v18\uFF1A\u5C45\u4E2D\u6A21\u6001\u6846\uFF09                                    */
/* ------------------------------------------------------------------ */
.dgp-gw-mask{position:fixed;inset:0;z-index:1140;background:color-mix(in srgb,#000 34%,transparent)}
.dgp-gw{position:fixed;z-index:1150;top:50%;left:50%;transform:translate(-50%,-50%);width:min(1040px,calc(100vw - 96px));height:min(660px,calc(100vh - 96px));display:flex;flex-direction:column;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-lg,12px);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 24px 64px #00000040;overflow:hidden;font-size:12px;line-height:18px;animation:dgp-gw-in .18s var(--dgp-ease) both}
@keyframes dgp-gw-in{from{transform:translate(-50%,-48%) scale(.985);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.dgp-gw{animation:none}}
.dgp-gw-top{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:.5px solid var(--dgp-line);flex:0 0 auto;flex-wrap:wrap}
.dgp-gw-crumb{font-weight:500;color:var(--dgp-fg)}
.dgp-gw-repo{display:inline-flex;align-items:center;gap:5px;font-weight:500;color:var(--dgp-fg);min-width:0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-branch{appearance:none;display:inline-flex;align-items:center;gap:4px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-fg2);height:24px;padding:0 8px;font:inherit;font-size:11.5px;font-family:var(--dgp-code);cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-branch:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-branch[data-current="1"]{color:var(--dgp-fg);border-color:color-mix(in srgb,var(--dgp-accent) 40%,var(--dgp-line2))}
.dgp-gw-caret{color:var(--dgp-faint);font-size:9px}
.dgp-gw-aux{font-family:var(--dgp-code);font-size:11px;color:var(--dgp-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.dgp-gw-spacer{flex:1 1 auto}
.dgp-gw-btnbar{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto}
.dgp-gw .dgp-btn{height:24px;padding:0 9px;font-size:11px}
.dgp-gw .dgp-btn.primary{height:24px}
.dgp-gw-icon{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);cursor:pointer}
.dgp-gw-icon:hover:not(:disabled){background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-gw-icon:disabled{opacity:.45;cursor:not-allowed}
.dgp-gw-x{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);cursor:pointer;font-size:15px;line-height:1}
.dgp-gw-x:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-state{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:34px 20px;overflow-y:auto}
.dgp-gw-initform{display:flex;flex-direction:column;gap:10px;align-items:stretch;width:min(420px,100%)}
.dgp-gw-initform .dgp-input{max-width:none;width:100%}
/* \u4E3B\u4F53\uFF1A\u5DE6\u4FA7\u7AD6\u6392\u5BFC\u822A + \u4E3B\u533A\uFF08\u4E00\u6B21\u53EA\u5448\u73B0\u4E00\u4EF6\u4E8B\uFF09 */
.dgp-gw-body{display:flex;flex:1 1 auto;min-height:0}
.dgp-gw-rail{flex:0 0 132px;display:flex;flex-direction:column;gap:1px;padding:8px 6px;border-right:.5px solid var(--dgp-line);background:var(--dgp-inset);min-height:0;overflow-y:auto}
.dgp-gw-railbtn{appearance:none;display:flex;align-items:center;gap:6px;width:100%;padding:7px 9px;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-fg2);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease)}
.dgp-gw-railbtn:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-railbtn[data-on="1"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font-weight:500;box-shadow:0 0 0 .5px var(--dgp-line2)}
.dgp-gw-railbtn-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-railbtn-count{flex:0 0 auto;font-family:var(--dgp-code);font-size:10.5px;color:var(--dgp-faint);font-variant-numeric:tabular-nums}
.dgp-gw-main{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0}
/* \u6539\u52A8\u89C6\u56FE\uFF1A\u63D0\u4EA4\u533A\u5728\u4E0A\uFF0C\u5217\u8868\u5728\u4E0B */
.dgp-gw-commit{display:flex;flex-direction:column;gap:6px;padding:10px 12px 9px;border-bottom:.5px solid var(--dgp-line);flex:0 0 auto}
.dgp-gw-msg{box-sizing:border-box;width:100%;min-height:56px;max-height:140px;padding:7px 10px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font:inherit;font-size:12px;line-height:18px;resize:vertical;outline:none}
.dgp-gw-msg:focus{border-color:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 18%,transparent)}
.dgp-gw-commitbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dgp-gw-amend{display:inline-flex;align-items:center;gap:5px;color:var(--dgp-muted);font-size:11px;white-space:nowrap;cursor:pointer}
.dgp-gw-amend input{accent-color:var(--dgp-accent)}
.dgp-gw-staged-count{font-family:var(--dgp-code);font-size:11px;color:var(--dgp-faint);font-variant-numeric:tabular-nums;min-width:12px;text-align:right}
.dgp-gw-lists{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;min-height:0;padding:2px 0 10px}
.dgp-gw-group{display:flex;flex-direction:column;align-items:stretch}
.dgp-gw-grouphead{display:flex;align-items:center;gap:7px;padding:7px 12px 3px;font-size:11px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--dgp-faint)}
.dgp-gw-checkall{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.dgp-gw-checkall input{accent-color:var(--dgp-accent);margin:0}
.dgp-gw-count{font-family:var(--dgp-code);font-variant-numeric:tabular-nums}
.dgp-gw-textbtn{appearance:none;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);font:inherit;font-size:10.5px;padding:2px 6px;cursor:pointer}
.dgp-gw-textbtn:hover:not(:disabled){background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-textbtn:disabled{opacity:.45;cursor:not-allowed}
.dgp-gw-textbtn[data-danger="1"]:hover{color:var(--dgp-danger)}
.dgp-gw-row{display:flex;align-items:center;gap:7px;padding:3px 12px;min-width:0}
.dgp-gw-row:hover{background:var(--dgp-hover)}
.dgp-gw-row input{accent-color:var(--dgp-accent);flex:0 0 auto;margin:0}
.dgp-gw-code{flex:0 0 auto;appearance:none;display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:16px;padding:0 4px;border:0;border-radius:3px;background:var(--dgp-inset);color:var(--dgp-muted);font-family:var(--dgp-code);font-size:10px;font-weight:600;cursor:pointer}
.dgp-gw-code[data-code="A"]{color:var(--dgp-ok);background:color-mix(in srgb,var(--dgp-ok) 12%,transparent)}
.dgp-gw-code[data-code="D"]{color:var(--dgp-danger);background:color-mix(in srgb,var(--dgp-danger) 11%,transparent)}
.dgp-gw-code[data-code="??"]{color:var(--dgp-warn,#b45309);background:color-mix(in srgb,var(--dgp-warn,#b45309) 12%,transparent)}
.dgp-gw-path{flex:1 1 auto;min-width:0;appearance:none;border:0;background:transparent;color:var(--dgp-fg2);font-family:var(--dgp-code);font-size:11px;line-height:16px;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0}
.dgp-gw-row[data-staged="1"] .dgp-gw-path{color:var(--dgp-fg)}
.dgp-gw-path:hover{color:var(--dgp-fg);text-decoration:underline}
.dgp-gw-stat{flex:0 0 auto;display:inline-flex;gap:5px;font-family:var(--dgp-code);font-size:10.5px;font-variant-numeric:tabular-nums}
.dgp-gw-stat b{font-weight:600}
.dgp-gw-stat b[data-sign="add"]{color:var(--dgp-ok)}
.dgp-gw-stat b[data-sign="del"]{color:var(--dgp-danger)}
.dgp-gw-rowact{flex:0 0 auto;appearance:none;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);font:inherit;font-size:10.5px;padding:2px 6px;cursor:pointer;opacity:0;transition:opacity var(--dgp-fast) var(--dgp-ease)}
.dgp-gw-row:hover .dgp-gw-rowact{opacity:1}
.dgp-gw-rowact:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-rowact[data-danger="1"]:hover{color:var(--dgp-danger)}
.dgp-gw-batch{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:.5px solid var(--dgp-line);flex:0 0 auto;flex-wrap:wrap}
.dgp-gw-batch-count{font-family:var(--dgp-code);font-size:11px;color:var(--dgp-muted);font-variant-numeric:tabular-nums}
/* \u5386\u53F2 / \u5206\u652F\u56FE\u89C6\u56FE */
.dgp-gw-scroll{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;min-height:0}
.dgp-gw-log{display:flex;flex-direction:column;padding:4px 0 10px}
.dgp-gw-logrow{display:flex;align-items:center;gap:7px;width:100%;padding:5px 12px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}
.dgp-gw-logrow:hover{background:var(--dgp-hover)}
.dgp-gw-loghash{flex:0 0 auto;font-family:var(--dgp-code);font-size:10.5px;color:var(--dgp-accent)}
.dgp-gw-logmsg{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dgp-fg2)}
.dgp-gw-logmeta{flex:0 0 auto;color:var(--dgp-faint);font-family:var(--dgp-code);font-size:10px;font-variant-numeric:tabular-nums;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-diff{margin:0;padding:2px 0;font-family:var(--dgp-code);font-size:10.5px;line-height:15px;color:var(--dgp-fg2);white-space:pre;overflow:auto;max-height:min(420px,50vh)}
.dgp-gw-detail .dgp-kv{margin:0 0 8px}
.dgp-gw-msgtext{margin:0 0 8px;padding:8px 10px;background:var(--dgp-inset);border-radius:var(--dgp-r-sm);font:inherit;font-size:12px;white-space:pre-wrap;color:var(--dgp-fg2)}
.dgp-gw-secttitle{padding:8px 0 4px;color:var(--dgp-faint);font-size:11px;letter-spacing:.02em;text-transform:uppercase}
/* \u5206\u652F / \u8FDC\u7A0B\u7BA1\u7406\uFF08\u4E8C\u7EA7\u5F39\u7A97\u5185\uFF09 */
.dgp-gw-branchcols{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
.dgp-gw-branchrow{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:.5px solid var(--dgp-line);min-width:0}
.dgp-gw-branchrow[data-current="1"] .dgp-gw-branchname{color:var(--dgp-accent);font-weight:500}
.dgp-gw-branchname{font-family:var(--dgp-code);font-size:11.5px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto}
.dgp-gw-branchmeta{font-family:var(--dgp-code);font-size:10px;color:var(--dgp-muted);white-space:nowrap}
.dgp-gw-remoteurl{font-size:10.5px;color:var(--dgp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto}
/* ------------------------------------------------------------------ */
/* \u8D26\u53F7 \u2192 \u8FDC\u7A0B\u4ED3\u5E93\u6743\u9650\uFF08\u591A\u8D26\u53F7\u7BA1\u7406\uFF09                                    */
/* ------------------------------------------------------------------ */
.dgp-repos{display:flex;flex-direction:column;gap:2px;padding:6px 0 2px 10px;border-left:1.5px solid var(--dgp-line);margin-top:2px}
.dgp-repo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:.5px solid var(--dgp-line);min-width:0}
.dgp-repo:last-child{border-bottom:none}
.dgp-repo-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.dgp-repo-name{font-family:var(--dgp-code);font-size:12px;line-height:18px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-repo-meta{font-size:11px;line-height:16px;color:var(--dgp-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dgp-perm{flex:0 0 auto;display:flex;align-items:center;gap:6px}
/* \u4E09\u6863\u6743\u9650\uFF1A\u5206\u6BB5\u63A7\u4EF6\uFF08\u4E00\u773C\u770B\u5168\u4E09\u6863\uFF0C\u70B9\u4E00\u4E0B\u5C31\u6539\uFF0C\u53D6\u4EE3\u539F\u6765\u7684\u4E0B\u62C9\u6846\uFF09\u3002 */
.dgp-perm-seg{flex:0 0 auto;display:inline-flex;align-items:center;gap:1px;padding:1px;border-radius:var(--dgp-r-xs);background:var(--dgp-inset)}
.dgp-perm-seg button{appearance:none;border:0;background:transparent;color:var(--dgp-muted);font:inherit;font-size:11px;line-height:16px;padding:2px 8px;border-radius:calc(var(--dgp-r-xs) - 1px);cursor:pointer;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease)}
.dgp-perm-seg button:hover{background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-perm-seg button[data-on="1"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font-weight:500;box-shadow:0 0 0 .5px var(--dgp-line2)}
.dgp-perm-seg button[data-perm="full"][data-on="1"]{color:var(--dgp-ok)}
.dgp-perm-seg button[data-perm="none"][data-on="1"]{color:var(--dgp-danger)}
.dgp-perm-seg button:disabled{cursor:default;opacity:.55}
.dgp-perm-seg[data-saving="1"] button{cursor:progress}
.dgp-perm-saving{font-size:10.5px;line-height:16px;color:var(--dgp-faint);white-space:nowrap}
/* \u4ED3\u5E93\u5DE5\u5177\u884C\uFF1A\u641C\u7D22 + \u6743\u9650\u7B5B\u9009 + \u8BA1\u6570 + \u5237\u65B0\u3002 */
.dgp-repos-toolbar{display:flex;align-items:center;gap:8px;padding:8px 0 6px;flex-wrap:wrap}
.dgp-search{flex:1 1 150px;min-width:110px;height:26px;font-size:12px;padding:0 8px}
.dgp-filter{flex:0 0 auto}
.dgp-filter button{font-size:11px;padding:2px 7px}
.dgp-repos-count{font-size:11px;line-height:16px;color:var(--dgp-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
/* \u8D26\u53F7\u5361\uFF1A\u4E00\u4E2A\u8D26\u53F7\u4E00\u5F20\uFF0C\u4ED3\u5E93\u6743\u9650\u76F4\u63A5\u5185\u8054\uFF0C\u64CD\u4F5C\u6536\u5728\u5934\u90E8\u53F3\u4FA7\u3002 */
.dgp-acct{display:flex;flex-direction:column;gap:0;margin:0 0 12px;padding:10px 12px 12px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff)}
.dgp-acct[data-status="error"],.dgp-acct[data-status="expired"]{border-color:color-mix(in srgb,var(--dgp-warn,#b45309) 45%,var(--dgp-line2))}
.dgp-acct-head{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap}
.dgp-acct-name{font-size:13px;line-height:19px;font-weight:600;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(260px,45vw)}
.dgp-acct-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:3px 0 0;font-size:11px;line-height:16px;color:var(--dgp-muted);min-width:0}
.dgp-acct .dgp-repos{margin-top:8px;padding-left:0;border-left:0}
/* \u9AD8\u7EA7\u8BBE\u7F6E\u6298\u53E0\u533A\uFF1A\u672C\u5730\u76EE\u5F55\u767D\u540D\u5355 + \u5168\u5C40\u515C\u5E95\u4ED3\u5E93 + \u5199\u5F00\u5173\u3002 */
.dgp-adv{margin:2px 0 12px;padding:11px 12px 12px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dgp-inset)}
/* ------------------------------------------------------------------ */
/* \u521D\u59CB\u5316\u5411\u5BFC\uFF08\u5355\u9875\u8868\u5355 + \u53F3\u4FA7\u5B9E\u65F6\u8BA1\u5212\uFF09                                */
/* ------------------------------------------------------------------ */
.dgp-iw{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.78fr);gap:16px;min-width:0;align-items:start}
.dgp-iw-left{display:flex;flex-direction:column;gap:14px;min-width:0}
.dgp-iw-right{display:flex;flex-direction:column;gap:10px;min-width:0;padding:11px 12px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dgp-inset);position:sticky;top:0}
.dgp-iw-sect{display:flex;flex-direction:column;gap:7px;min-width:0}
.dgp-iw-secthead{font-size:11px;line-height:16px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dgp-muted)}
.dgp-iw-secthead[data-tone="ok"]{color:var(--dgp-ok)}
.dgp-iw-secthead[data-tone="error"]{color:var(--dgp-danger)}
.dgp-iw-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 12px}
.dgp-iw-inline{display:flex;flex-direction:column;gap:6px;margin-top:2px}
.dgp-iw-actions{display:flex;align-items:center;gap:8px;margin-top:2px}
.dgp-iw-actions .dgp-btn{flex:0 0 auto}
.dgp-iw-create{display:flex;align-items:center;gap:8px;margin-top:6px;padding:6px 8px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dgp-inset)}
.dgp-iw-create .dgp-input{flex:1 1 auto;min-width:0;height:26px}
.dgp-iw-create .dgp-check{flex:0 0 auto;white-space:nowrap}
.dgp-iw-create .dgp-btn{flex:0 0 auto;white-space:nowrap}
.dgp-options{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.dgp-option{display:flex;align-items:center;gap:9px;padding:7px 9px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);cursor:pointer;min-width:0;transition:background var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-option:hover{background:var(--dgp-hover)}
.dgp-option[data-on="1"]{border-color:var(--dgp-accent);background:color-mix(in srgb,var(--dgp-accent) 9%,transparent)}
.dgp-option input{flex:0 0 auto;accent-color:var(--dgp-accent);margin:0}
.dgp-option-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto}
.dgp-option-title{font-size:12.5px;line-height:18px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-option-hint{font-size:11px;line-height:16px;color:var(--dgp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-plan{display:flex;flex-direction:column;gap:5px;margin:0;padding:0;list-style:none}
.dgp-plan li{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:18px;color:var(--dgp-fg2);overflow-wrap:anywhere}
.dgp-plan li::before{content:"";flex:0 0 auto;width:5px;height:5px;margin-top:6px;border-radius:50%;background:var(--dgp-accent)}
.dgp-plan[data-tone="error"] li::before{background:var(--dgp-danger)}
/* ------------------------------------------------------------------ */
/* \u5F53\u524D\u5206\u652F\u8BE6\u60C5\uFF08\u63D0\u4EA4\u65F6\u95F4\u7EBF\uFF09                                          */
/* ------------------------------------------------------------------ */
.dgp-tl{display:flex;flex-direction:column;margin:0;padding:0 0 0 4px;list-style:none}
.dgp-tl-item{position:relative;display:flex;align-items:flex-start;gap:11px;padding:0 0 12px 14px;border-left:.5px solid var(--dgp-line2);min-width:0}
.dgp-tl-item:last-child{border-left-color:transparent;padding-bottom:0}
.dgp-tl-node{position:absolute;left:-3.5px;top:4px;width:6px;height:6px;border-radius:50%;background:var(--dgp-line2)}
.dgp-tl-item[data-first="1"] .dgp-tl-node{background:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 18%,transparent)}
.dgp-tl-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.dgp-tl-subject{font-size:12.5px;line-height:18px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-tl-meta{display:flex;align-items:center;gap:8px;font-size:11px;line-height:16px;color:var(--dgp-muted);flex-wrap:wrap;min-width:0}
.dgp-tl-hash{font-family:var(--dgp-code);color:var(--dgp-accent);flex:0 0 auto}
.dgp-tl-author{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
.dgp-tl-date{font-family:var(--dgp-code);font-variant-numeric:tabular-nums;color:var(--dgp-faint);flex:0 0 auto}
.dgp-modal-mask{position:fixed;inset:0;z-index:1250;background:color-mix(in srgb,#000 32%,transparent);display:flex;align-items:center;justify-content:center}
.dgp-modal{max-height:min(560px,80vh);display:flex;flex-direction:column;border-radius:var(--dgp-r-lg,12px);border:.5px solid var(--dgp-line2);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 18px 56px #00000040;overflow:hidden}
.dgp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:.5px solid var(--dgp-line);flex:0 0 auto}
.dgp-modal-title{font-weight:500;color:var(--dgp-fg);font-size:13px}
.dgp-modal-x{appearance:none;border:0;background:transparent;color:var(--dgp-faint);width:24px;height:24px;border-radius:var(--dgp-r-xs);cursor:pointer;font-size:15px;line-height:1}
.dgp-modal-x:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-modal-body{padding:10px 14px 14px;overflow-y:auto;min-height:0}
.dgp-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:.5px solid var(--dgp-line);flex:0 0 auto}
.dgp-modal-text{margin:0 0 8px;color:var(--dgp-fg2);font-size:12px;line-height:18px}
.dgp-modal-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-family:var(--dgp-code);font-size:11px;color:var(--dgp-fg2)}
.dgp-modal-list li{display:flex;align-items:center;gap:8px;justify-content:space-between;word-break:break-all}
.dgp-modal-foot .dgp-btn{min-width:78px}
/* ------------------------------------------------------------------ */
/* \u5DEE\u5F02\u89C6\u56FE\uFF08dgp-v19\uFF1A\u884C\u53F7 + \u67E5\u627E + \u5E76\u6392/\u7EDF\u4E00 + \u8BCD\u7EA7\u9AD8\u4EAE + \u6298\u53E0\uFF09        */
/* ------------------------------------------------------------------ */
.dgp-dv{display:flex;flex-direction:column;gap:0;min-width:0;min-height:0;flex:1 1 auto}
.dgp-dv-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 0 8px;flex:0 0 auto}
.dgp-dv-bar .dgp-seg{flex:0 0 auto}
.dgp-dv-find{display:flex;align-items:center;gap:6px;flex:1 1 200px;min-width:140px}
.dgp-dv-find .dgp-input{flex:1 1 auto;min-width:0;height:26px;font-size:12px;padding:0 8px}
.dgp-dv-findcount{font-size:11px;line-height:16px;color:var(--dgp-faint);font-variant-numeric:tabular-nums;white-space:nowrap;flex:0 0 auto}
.dgp-dv-findcount[data-empty="1"]{color:var(--dgp-danger)}
.dgp-dv-body{flex:1 1 auto;min-height:0;overflow:auto;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dgp-inset)}
.dgp-dv-table{display:flex;flex-direction:column;min-width:100%;font-family:var(--dgp-code);font-size:10.5px;line-height:16px}
.dgp-dv-row{display:flex;align-items:stretch;min-width:0}
.dgp-dv-row[data-kind="hunk"]{background:color-mix(in srgb,var(--dgp-accent) 7%,transparent);color:var(--dgp-muted)}
.dgp-dv-row[data-kind="meta"]{color:var(--dgp-faint)}
.dgp-dv-row[data-kind="add"]{background:color-mix(in srgb,#16a34a 9%,transparent)}
.dgp-dv-row[data-kind="del"]{background:color-mix(in srgb,#dc2626 9%,transparent)}
.dgp-dv-row[data-kind="fold"]{background:var(--dgp-hover);cursor:pointer;color:var(--dgp-muted)}
.dgp-dv-row[data-kind="fold"]:hover{color:var(--dgp-fg)}
.dgp-dv-side{display:flex;min-width:0;flex:1 1 0;border-right:.5px solid var(--dgp-line)}
.dgp-dv-side:last-child{border-right:0}
.dgp-dv-no{flex:0 0 auto;width:38px;padding:0 6px;text-align:right;color:var(--dgp-faint);font-variant-numeric:tabular-nums;user-select:none;background:color-mix(in srgb,#000 3%,transparent)}
.dgp-dv-sign{flex:0 0 auto;width:10px;text-align:center;color:var(--dgp-muted);user-select:none}
.dgp-dv-code{flex:1 1 auto;min-width:0;padding:0 6px 0 2px;white-space:pre;overflow:hidden;text-overflow:clip}
.dgp-dv-code[data-hit="1"]{background:color-mix(in srgb,var(--dgp-warn,#b45309) 26%,transparent);border-radius:2px}
.dgp-dv-code[data-hit="2"]{background:color-mix(in srgb,var(--dgp-warn,#b45309) 52%,transparent)}
.dgp-dv-word[data-w="add"]{background:color-mix(in srgb,#16a34a 30%,transparent);border-radius:2px}
.dgp-dv-word[data-w="del"]{background:color-mix(in srgb,#dc2626 30%,transparent);border-radius:2px}
.dgp-dv-tok[data-t="kw"]{color:#a626a4}
.dgp-dv-tok[data-t="str"]{color:#50a14f}
.dgp-dv-tok[data-t="num"]{color:#986801}
.dgp-dv-tok[data-t="cmt"]{color:var(--dgp-faint);font-style:italic}
.dgp-dv-tok[data-t="fn"]{color:#4078f2}
.dgp-dv-empty{padding:16px;text-align:center;color:var(--dgp-muted);font-size:12px}
/* ------------------------------------------------------------------ */
/* \u6587\u4EF6\u6D4F\u89C8\uFF08dgp-v19\uFF1A\u61D2\u52A0\u8F7D\u6811 + \u9884\u89C8\uFF09                                 */
/* ------------------------------------------------------------------ */
.dgp-fb{display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:0;min-height:0;flex:1 1 auto;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);overflow:hidden}
.dgp-fb-tree{display:flex;flex-direction:column;min-height:0;overflow:auto;border-right:.5px solid var(--dgp-line);background:var(--dgp-inset);padding:4px 0}
.dgp-fb-row{display:flex;align-items:center;gap:5px;appearance:none;border:0;background:transparent;color:var(--dgp-fg2);font:inherit;font-size:12px;line-height:20px;padding:2px 8px;cursor:pointer;text-align:left;min-width:0;border-radius:0}
.dgp-fb-row:hover{background:var(--dgp-hover)}
.dgp-fb-row[data-on="1"]{background:color-mix(in srgb,var(--dgp-accent) 12%,transparent);color:var(--dgp-fg)}
.dgp-fb-row[data-ignored="1"]{opacity:.5}
.dgp-fb-caret{flex:0 0 auto;width:9px;color:var(--dgp-faint);font-size:9px;line-height:1}
.dgp-fb-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-fb-view{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:auto;background:var(--dgp-bg,#fff)}
.dgp-fb-head{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:.5px solid var(--dgp-line);position:sticky;top:0;background:inherit;flex:0 0 auto}
.dgp-fb-path{flex:1 1 auto;min-width:0;font-family:var(--dgp-code);font-size:11px;color:var(--dgp-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-fb-code{margin:0;padding:8px 10px;font-family:var(--dgp-code);font-size:11px;line-height:17px;color:var(--dgp-fg2);white-space:pre;overflow:auto;flex:1 1 auto;min-height:0}
.dgp-fb-code[data-wrap="1"]{white-space:pre-wrap;overflow-wrap:anywhere}
.dgp-fb-img{max-width:100%;max-height:100%;object-fit:contain;padding:10px}
/* ------------------------------------------------------------------ */
/* \u7A84\u5C4F\uFF08dgp-v19\uFF1A\u2264760px \u5355\u680F\u94BB\u53D6\uFF1B\u5BBF\u4E3B\u4FA7\u680F\u9762\u677F\u5E38\u5728\u6B64\u5BBD\u5EA6\uFF09             */
/* ------------------------------------------------------------------ */
@media (max-width:760px){
  .dgp-gw{width:calc(100vw - 16px);height:calc(100vh - 16px);border-radius:var(--dgp-r-md,10px)}
  .dgp-gw-body{flex-direction:column}
  .dgp-gw-rail{flex:0 0 auto;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:.5px solid var(--dgp-line);padding:0 4px}
  .dgp-gw-railbtn{flex:0 0 auto;white-space:nowrap}
  .dgp-gw-top{flex-wrap:wrap;gap:6px}
  .dgp-gw-repo{max-width:100%}
  .dgp-gw-main{min-height:0}
  .dgp-fb{grid-template-columns:minmax(0,1fr)}
  .dgp-fb-tree{border-right:0;border-bottom:.5px solid var(--dgp-line);max-height:40%}
  .dgp-fb[data-focus="1"] .dgp-fb-tree{display:none}
  .dgp-fb[data-focus="0"] .dgp-fb-view{display:none}
  .dgp-dv-side[data-role="right"]{display:none}
  .dgp-dv-row[data-kind="add"] .dgp-dv-side[data-role="left"],.dgp-dv-row[data-kind="del"] .dgp-dv-side[data-role="right"]{flex:1 1 100%}
  .dgp-modal{width:calc(100vw - 20px) !important;max-height:calc(100vh - 20px)}
  .dgp-iw{grid-template-columns:minmax(0,1fr)}
  .dgp-iw-right{position:static}
  .dgp-iw-grid2{grid-template-columns:minmax(0,1fr)}
  .dgp-gw-commitbar{flex-wrap:wrap}
  .dgp-gw-batch{flex-wrap:wrap}
}
${TOKEN_CSS}
`;
function useStyles() {
  (0, import_react.useEffect)(() => {
    const id = "dgp-style";
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.textContent !== CSS) existing.textContent = CSS;
      return;
    }
    const node = document.createElement("style");
    node.id = id;
    node.textContent = CSS;
    document.head.appendChild(node);
  }, []);
}
function Dot({ state }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dgp-dot", "data-state": state ?? "none", "aria-hidden": "true" });
}
function BranchIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "4.8", cy: "3.6", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "4.8", cy: "12.4", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "11.2", cy: "6.2", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.8 5.1v5.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M11.2 7.7v.5a2.5 2.5 0 0 1-2.5 2.5H6.3" })
  ] });
}
function RefreshIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 8a5 5 0 1 1-1.6-3.7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 2.8V5.6h-2.8" })
  ] });
}
function CopyIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "6", y: "6", width: "7", height: "7", rx: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 4.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v4.5A1.5 1.5 0 0 0 4 10h.5" })
  ] });
}
function GearIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 1.8v1.4M8 12.8v1.4M2.6 8H1.2M14.8 8h-1.4M4.2 4.2 3.2 3.2M12.8 12.8l-1-1M11.8 4.2l1-1M3.2 12.8l1-1" })
  ] });
}
function PlusIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3.5v9M3.5 8h9" }) });
}
function EmptyState({ title, hint }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dgp-empty", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { className: "dgp-empty-art", width: "88", height: "60", viewBox: "0 0 88 60", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "6", y: "8", width: "34", height: "44", rx: "6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 22h16M15 30h16M15 38h10" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M52 30h14M59 23v14" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "66", cy: "30", r: "13", strokeDasharray: "3 4" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dgp-empty-title", children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dgp-empty-hint", children: hint })
  ] });
}
function Skeleton({ rows = 3 }) {
  const widths = ["62%", "44%", "78%", "55%", "70%"];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dgp-skel", "aria-hidden": "true", children: Array.from({ length: rows }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dgp-skel-line", style: { width: widths[index % widths.length] } }, index)) });
}
function Toast({ tone, text, onDone }) {
  (0, import_react.useEffect)(() => {
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dgp-portal dgp-toast-wrap", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dgp-toast", "data-tone": tone, role: "status", "aria-live": "polite", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dgp-toast-dot", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dgp-toast-text", children: text })
    ] }) }),
    document.body
  );
}
function fmt(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, key) => key in params ? String(params[key]) : match);
}

// src/client/workbench.tsx
var import_react5 = require("react");

// src/client/graphview.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var LANE_W = 13;
var ROW_H = 34;
var LANE_PAD = 9;
var DOT_R = 4;
function laneColor(lane) {
  return `var(--dgp-lane-${(lane % 8 + 8) % 8})`;
}
function laneX(lane) {
  return LANE_PAD + lane * LANE_W;
}
function rowY(row) {
  return row * ROW_H + ROW_H / 2;
}
function curvePath(from, to, row) {
  const x1 = laneX(from);
  const y1 = rowY(row);
  const x2 = laneX(to);
  const y2 = rowY(row + 1);
  const half = ROW_H / 2;
  return `M${x1} ${y1} C${x1} ${y1 + half} ${x2} ${y2 - half} ${x2} ${y2}`;
}
function GraphView({ t, graph, loading, error }) {
  const [active, setActive] = (0, import_react2.useState)("");
  const [copied, setCopied] = (0, import_react2.useState)("");
  const rows = graph?.rows ?? [];
  const laneCount = Math.max(1, graph?.laneCount ?? 1);
  const width = LANE_PAD * 2 + (laneCount - 1) * LANE_W;
  const height = Math.max(ROW_H, rows.length * ROW_H);
  const selected = rows.find((item) => item.hash === active) ?? null;
  const copyHash = async (hash) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(hash);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  };
  if (loading && !graph) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-graph-head", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("graphTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-graph-note", children: t("graphLoading") })
    ] });
  }
  if (error.length > 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-graph-head", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("graphTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph-note", "data-tone": "error", children: [
        t("graphFailed"),
        "\uFF1A",
        error
      ] })
    ] });
  }
  if (!graph || rows.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-graph-head", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("graphTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-graph-note", children: t("graphEmpty") })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("graphTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-graph-meta", children: [
        t("graphLanes").replace("{n}", String(laneCount)),
        graph.truncated ? ` \xB7 ${t("graphTruncated").replace("{n}", String(rows.length))}` : ""
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { className: "dgp-graph-svg", width, height, viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true", children: [
        rows.map(
          (item) => item.through.map((lane) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "line",
            {
              className: "dgp-graph-line",
              x1: laneX(lane),
              y1: rowY(item.row),
              x2: laneX(lane),
              y2: rowY(item.row + 1),
              stroke: laneColor(lane)
            },
            `t-${item.row}-${lane}`
          ))
        ),
        rows.map(
          (item) => item.segments.map(
            (seg) => (
              // 同车道：垂直直落；跨车道：S 形贝塞尔。两种都用 stroke 上色，交接处不跳色。
              seg.from === seg.to ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "line",
                {
                  className: "dgp-graph-line",
                  x1: laneX(seg.from),
                  y1: rowY(item.row),
                  x2: laneX(seg.to),
                  y2: rowY(item.row + 1),
                  stroke: laneColor(seg.from)
                },
                `s-${item.row}-${seg.from}-${seg.to}`
              ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "path",
                {
                  className: "dgp-graph-line",
                  d: curvePath(seg.from, seg.to, item.row),
                  stroke: laneColor(seg.to)
                },
                `s-${item.row}-${seg.from}-${seg.to}`
              )
            )
          )
        ),
        rows.map((item) => {
          const isHead = item.refs.some((ref) => ref.kind === "head");
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "circle",
            {
              className: "dgp-graph-dot",
              cx: laneX(item.lane),
              cy: rowY(item.row),
              r: isHead ? DOT_R + 1.4 : DOT_R,
              fill: laneColor(item.lane)
            },
            `d-${item.hash}`
          );
        }),
        rows.filter((item) => item.refs.some((ref) => ref.kind === "head")).map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "circle",
          {
            cx: laneX(item.lane),
            cy: rowY(item.row),
            r: DOT_R + 4,
            fill: "none",
            stroke: laneColor(item.lane),
            strokeWidth: "1",
            opacity: "0.45"
          },
          `h-${item.hash}`
        ))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { minWidth: 0, flex: "1 1 auto" }, children: rows.map((item) => {
        const isHead = item.refs.some((ref) => ref.kind === "head");
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            className: "dgp-graph-row",
            "data-active": active === item.hash ? "1" : "0",
            "data-current": isHead ? "1" : "0",
            title: `${item.short} \xB7 ${item.author} \xB7 ${item.date}
${item.subject}`,
            onMouseEnter: () => setActive(item.hash),
            onMouseLeave: () => setActive((current) => current === item.hash ? "" : current),
            onClick: () => setActive(item.hash),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-graph-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-graph-subject", children: item.subject || item.short }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-graph-sub", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-graph-hash", children: item.short }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-graph-author", children: [
                    item.author,
                    " \xB7 ",
                    item.date
                  ] })
                ] })
              ] }),
              item.refs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-graph-refs", children: item.refs.slice(0, 3).map((ref) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-graph-ref", "data-kind": ref.kind, title: ref.name, children: ref.name }, `${item.hash}-${ref.kind}-${ref.name}`)) }) : null
            ]
          },
          `r-${item.hash}`
        );
      }) })
    ] }),
    selected ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-graph-detail", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-graph-detail-text", title: `${selected.hash}
${selected.subject}`, children: [
        selected.short,
        " \xB7 ",
        selected.author,
        " \xB7 ",
        selected.date
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          className: "dgp-graph-copy",
          title: copied === selected.hash ? t("graphCopied") : t("graphCopyHash"),
          "aria-label": t("graphCopyHash"),
          onMouseDown: (event) => event.preventDefault(),
          onClick: () => void copyHash(selected.hash),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CopyIcon, {})
        }
      )
    ] }) : null
  ] });
}

// src/client/diffview.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var FOLD_MIN = 6;
var FOLD_KEEP = 3;
function parseDiff(text) {
  const rows = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of text.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(raw);
      if (match) {
        oldNo = Number(match[1]);
        newNo = Number(match[2]);
      }
      rows.push({ kind: "hunk", text: raw, oldNo: null, newNo: null });
      continue;
    }
    if (raw.startsWith("diff --git") || raw.startsWith("index ") || raw.startsWith("--- ") || raw.startsWith("+++ ") || raw.startsWith("new file") || raw.startsWith("deleted file") || raw.startsWith("similarity index") || raw.startsWith("rename ") || raw.startsWith("old mode") || raw.startsWith("new mode") || raw.startsWith("Binary files") || raw.startsWith("\\ No newline")) {
      rows.push({ kind: "meta", text: raw, oldNo: null, newNo: null });
      continue;
    }
    if (raw.startsWith("+")) {
      rows.push({ kind: "add", text: raw.slice(1), oldNo: null, newNo });
      newNo += 1;
      continue;
    }
    if (raw.startsWith("-")) {
      rows.push({ kind: "del", text: raw.slice(1), oldNo, newNo: null });
      oldNo += 1;
      continue;
    }
    if (raw.startsWith(" ") || raw.length === 0) {
      rows.push({ kind: "ctx", text: raw.slice(1), oldNo, newNo });
      oldNo += 1;
      newNo += 1;
      continue;
    }
    rows.push({ kind: "meta", text: raw, oldNo: null, newNo: null });
  }
  while (rows.length > 0 && rows[rows.length - 1].kind === "ctx" && rows[rows.length - 1].text === "") rows.pop();
  return rows;
}
function buildSplit(rows) {
  const pairs = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (row.kind === "del" || row.kind === "add") {
      const dels = [];
      const adds = [];
      while (index < rows.length && rows[index].kind === "del") {
        dels.push(rows[index]);
        index += 1;
      }
      while (index < rows.length && rows[index].kind === "add") {
        adds.push(rows[index]);
        index += 1;
      }
      const span = Math.max(dels.length, adds.length);
      for (let offset = 0; offset < span; offset += 1) {
        pairs.push({ left: dels[offset] ?? null, right: adds[offset] ?? null });
      }
      continue;
    }
    pairs.push({ left: row, right: row });
    index += 1;
  }
  return pairs;
}
function tokenize(value) {
  return value.match(/[A-Za-z0-9_$]+|\s+|[^A-Za-z0-9_$\s]/gu) ?? [];
}
var NO_SPAN = { aPre: 0, aMid: 0, bPre: 0, bMid: 0 };
function diffSegments(a, b) {
  const at = tokenize(a);
  const bt = tokenize(b);
  let pre = 0;
  while (pre < at.length && pre < bt.length && at[pre] === bt[pre]) pre += 1;
  let suf = 0;
  while (suf < at.length - pre && suf < bt.length - pre && at[at.length - 1 - suf] === bt[bt.length - 1 - suf]) suf += 1;
  return {
    aPre: at.slice(0, pre).join("").length,
    aMid: at.slice(pre, at.length - suf).join("").length,
    bPre: bt.slice(0, pre).join("").length,
    bMid: bt.slice(pre, bt.length - suf).join("").length
  };
}
function segmentize(text, span, role, query) {
  const wordStart = role === "left" ? span.aPre : span.bPre;
  const wordLen = role === "left" ? span.aMid : span.bMid;
  const word = role === "left" ? "del" : "add";
  const wordRange = wordLen > 0 ? [{ start: wordStart, end: wordStart + wordLen }] : [];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const hits = [];
  if (needle.length > 0) {
    let from = 0;
    while (from <= lower.length) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      hits.push({ start: at, end: at + needle.length });
      from = at + Math.max(1, needle.length);
    }
  }
  const cuts = /* @__PURE__ */ new Set([0, text.length]);
  for (const item of [...wordRange, ...hits]) {
    cuts.add(Math.max(0, Math.min(text.length, item.start)));
    cuts.add(Math.max(0, Math.min(text.length, item.end)));
  }
  const points = [...cuts].sort((x, y) => x - y);
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const inWord = wordRange.some((item) => start >= item.start && end <= item.end);
    const hitIndex = hits.findIndex((item) => start >= item.start && end <= item.end);
    segments.push({
      text: text.slice(start, end),
      hit: hitIndex < 0 ? 0 : hitIndex === 0 ? 2 : 1,
      word: inWord ? word : ""
    });
  }
  return segments.length > 0 ? segments : [{ text, hit: 0, word: "" }];
}
function foldRows(pairs, expanded) {
  const out = [];
  let index = 0;
  while (index < pairs.length) {
    const pair = pairs[index];
    const isCtx = pair.left?.kind === "ctx" && pair.right?.kind === "ctx";
    if (!isCtx) {
      out.push({ type: "pair", pair, index });
      index += 1;
      continue;
    }
    let end = index;
    while (end < pairs.length && pairs[end].left?.kind === "ctx" && pairs[end].right?.kind === "ctx") end += 1;
    const run = end - index;
    const key = `fold-${index}`;
    if (run > FOLD_MIN && !expanded.has(key)) {
      for (let cursor = index; cursor < index + FOLD_KEEP; cursor += 1) out.push({ type: "pair", pair: pairs[cursor], index: cursor });
      out.push({ type: "fold", hidden: run - FOLD_KEEP * 2, key });
      for (let cursor = end - FOLD_KEEP; cursor < end; cursor += 1) out.push({ type: "pair", pair: pairs[cursor], index: cursor });
    } else {
      for (let cursor = index; cursor < end; cursor += 1) out.push({ type: "pair", pair: pairs[cursor], index: cursor });
    }
    index = end;
  }
  return out;
}
function pairKind(pair) {
  if (pair.left?.kind === "hunk" || pair.right?.kind === "hunk") return "hunk";
  if (pair.left?.kind === "meta" || pair.right?.kind === "meta") return "meta";
  if (pair.left?.kind === "ctx" && pair.right?.kind === "ctx") return "ctx";
  if (pair.left?.kind === "del" && pair.right?.kind === "add") return "chg";
  return pair.right?.kind === "add" ? "add" : "del";
}
function DiffView({
  t,
  text,
  truncated,
  lang = ""
}) {
  useStyles();
  const [layout, setLayout] = (0, import_react3.useState)(
    () => readPref(PREF_DIFF_LAYOUT, "split") === "unified" ? "unified" : "split"
  );
  const [highlightOn, setHighlightOn] = (0, import_react3.useState)(() => readPref(PREF_HIGHLIGHT, "1") !== "0");
  const [query, setQuery] = (0, import_react3.useState)("");
  const [active, setActive] = (0, import_react3.useState)(0);
  const [expanded, setExpanded] = (0, import_react3.useState)(() => /* @__PURE__ */ new Set());
  const findRef = (0, import_react3.useRef)(null);
  const bodyRef = (0, import_react3.useRef)(null);
  const rows = (0, import_react3.useMemo)(() => parseDiff(text), [text]);
  const pairs = (0, import_react3.useMemo)(() => buildSplit(rows), [rows]);
  const display = (0, import_react3.useMemo)(() => foldRows(pairs, expanded), [pairs, expanded]);
  const spans = (0, import_react3.useMemo)(() => {
    const out = [];
    let pendingDel = null;
    for (const item of display) {
      if (item.type === "fold") {
        out.push(NO_SPAN);
        pendingDel = null;
        continue;
      }
      const { left, right } = item.pair;
      if (left?.kind === "del" && right?.kind === "add") {
        out.push(diffSegments(left.text, right.text));
        pendingDel = null;
        continue;
      }
      if (right?.kind === "add" && left?.kind !== "del") {
        out.push(pendingDel === null ? NO_SPAN : diffSegments(pendingDel, right.text));
        pendingDel = null;
        continue;
      }
      if (left?.kind === "del") {
        pendingDel = left.text;
        out.push(NO_SPAN);
        continue;
      }
      out.push(NO_SPAN);
      pendingDel = null;
    }
    return out;
  }, [display]);
  const hitRows = (0, import_react3.useMemo)(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];
    const found = [];
    display.forEach((item, position) => {
      if (item.type !== "pair") return;
      const haystack = `${item.pair.left?.text ?? ""}\0${item.pair.right?.text ?? ""}`.toLowerCase();
      if (haystack.includes(needle)) found.push(position);
    });
    return found;
  }, [display, query]);
  const jump = (step) => {
    if (hitRows.length === 0) return;
    setActive((prev) => (prev + step + hitRows.length) % hitRows.length);
  };
  (0, import_react3.useEffect)(() => {
    const onKey = (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "f") {
        event.preventDefault();
        event.stopPropagation();
        findRef.current?.focus();
        findRef.current?.select();
        return;
      }
      if (key === "f3") {
        event.preventDefault();
        event.stopPropagation();
        setActive((prev) => hitRows.length === 0 ? 0 : (prev + (event.shiftKey ? -1 : 1) + hitRows.length) % hitRows.length);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [hitRows.length]);
  const activeRow = hitRows.length > 0 ? hitRows[Math.min(active, hitRows.length - 1)] : -1;
  (0, import_react3.useEffect)(() => {
    if (activeRow < 0) return;
    const target = bodyRef.current?.querySelector('[data-hitrow="1"]');
    target?.scrollIntoView({ block: "center" });
  }, [activeRow, layout, expanded]);
  const pickLayout = (next) => {
    setLayout(next);
    writePref(PREF_DIFF_LAYOUT, next);
  };
  const toggleHighlight = () => {
    const next = !highlightOn;
    setHighlightOn(next);
    writePref(PREF_HIGHLIGHT, next ? "1" : "0");
  };
  const renderCell = (row, role, span) => {
    if (!row) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-dv-side", "data-role": role, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-no" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-sign" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-code" })
      ] });
    }
    const no = role === "left" ? row.oldNo : row.newNo;
    const sign = row.kind === "add" ? "+" : row.kind === "del" ? "-" : row.kind === "ctx" ? " " : "\xB7";
    const segments = segmentize(row.text, span, role, query.trim());
    const plain = segments.every((segment) => segment.hit === 0 && segment.word === "");
    if (plain && highlightOn && lang !== "" && hasGrammar(lang)) {
      const html = highlight(row.text, lang);
      if (html !== "") {
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-dv-side", "data-role": role, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-no", children: no ?? "" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-sign", children: sign }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-code", dangerouslySetInnerHTML: { __html: html } })
        ] });
      }
    }
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-dv-side", "data-role": role, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-no", children: no ?? "" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-sign", children: sign }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-code", children: segments.map((segment, offset) => {
        if (segment.hit === 0 && segment.word === "") return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: segment.text }, offset);
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            className: segment.word === "" ? "dgp-dv-hit" : "dgp-dv-word",
            "data-hit": segment.hit === 0 ? void 0 : segment.hit === 2 ? "2" : "1",
            "data-w": segment.word === "" ? void 0 : segment.word,
            children: segment.text
          },
          offset
        );
      }) })
    ] });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-dv", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-dv-bar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-seg", role: "group", "aria-label": t("diffLayout"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", "data-on": layout === "split" ? "1" : "0", onClick: () => pickLayout("split"), children: t("diffSplit") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", "data-on": layout === "unified" ? "1" : "0", onClick: () => pickLayout("unified"), children: t("diffUnified") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-dv-find", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            ref: findRef,
            className: "dgp-input",
            type: "search",
            value: query,
            placeholder: t("diffFindPlaceholder"),
            "aria-label": t("diffFind"),
            onChange: (event) => {
              setQuery(event.target.value);
              setActive(0);
            },
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jump(event.shiftKey ? -1 : 1);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setQuery("");
                findRef.current?.blur();
              }
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-findcount", "data-empty": query.trim() !== "" && hitRows.length === 0 ? "1" : "0", children: query.trim() === "" ? "" : `${hitRows.length === 0 ? 0 : Math.min(active + 1, hitRows.length)}/${hitRows.length}` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-btn ghost", "data-on": highlightOn ? "1" : "0", onClick: toggleHighlight, "aria-pressed": highlightOn, children: t("diffHighlight") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-dv-body", ref: bodyRef, children: rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-dv-empty", children: t("diffEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-dv-table", "data-layout": layout, children: display.map((item, position) => {
      if (item.type === "fold") {
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "dgp-dv-row",
            "data-kind": "fold",
            onClick: () => setExpanded((prev) => new Set(prev).add(item.key)),
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dv-code", children: `\u22EF ${item.hidden} ${t("diffFoldHint")}` })
          },
          item.key
        );
      }
      const kind = pairKind(item.pair);
      const hitHere = position === activeRow;
      const span = spans[position] ?? NO_SPAN;
      if (layout === "unified") {
        if (item.pair.left?.kind === "del" && item.pair.right?.kind === "add") {
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-dv-row", "data-kind": "chg", "data-hitrow": hitHere ? "1" : "0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-dv-row", "data-kind": "del", children: renderCell(item.pair.left, "left", span) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-dv-row", "data-kind": "add", children: renderCell(item.pair.right, "right", span) })
          ] }, `u-${item.index}`);
        }
        const row = item.pair.left ?? item.pair.right;
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-dv-row", "data-kind": kind, "data-hitrow": hitHere ? "1" : "0", children: renderCell(row, "left", span) }, `u-${item.index}`);
      }
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-dv-row", "data-kind": kind, "data-hitrow": hitHere ? "1" : "0", children: [
        renderCell(item.pair.left, "left", span),
        renderCell(item.pair.right, "right", span)
      ] }, `s-${item.index}`);
    }) }) }),
    truncated ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-hint", children: t("diffTruncated") }) : null
  ] });
}

// src/client/filebrowser.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function toNodes(entries, depth) {
  return entries.map((entry) => ({
    entry,
    depth,
    open: false,
    loading: false,
    loaded: false,
    error: "",
    children: []
  }));
}
function patchNode(nodes, path, patch) {
  return nodes.map((node) => {
    if (node.entry.path === path) return patch(node);
    if (node.children.length === 0) return node;
    return { ...node, children: patchNode(node.children, path, patch) };
  });
}
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function FileBrowser({ t, cwd }) {
  useStyles();
  const [nodes, setNodes] = (0, import_react4.useState)([]);
  const [rootLoading, setRootLoading] = (0, import_react4.useState)(false);
  const [rootError, setRootError] = (0, import_react4.useState)("");
  const [truncated, setTruncated] = (0, import_react4.useState)(false);
  const [picked, setPicked] = (0, import_react4.useState)("");
  const [file, setFile] = (0, import_react4.useState)(null);
  const [fileLoading, setFileLoading] = (0, import_react4.useState)(false);
  const [fileError, setFileError] = (0, import_react4.useState)("");
  const [wrap, setWrap] = (0, import_react4.useState)(false);
  const [focus, setFocus] = (0, import_react4.useState)("tree");
  const pickedRef = (0, import_react4.useRef)("");
  const loadDir = (0, import_react4.useCallback)(async (path) => {
    try {
      const data = await api(
        `/repo/tree?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(path)}`
      );
      if (!data.ok) return { entries: [], truncated: false, error: data.error ?? t("fbLoadFailed") };
      return { entries: data.entries ?? [], truncated: data.truncated === true, error: "" };
    } catch (error) {
      return { entries: [], truncated: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, [cwd, t]);
  (0, import_react4.useEffect)(() => {
    let alive = true;
    setNodes([]);
    setRootError("");
    setTruncated(false);
    setPicked("");
    pickedRef.current = "";
    setFile(null);
    setFileError("");
    setFocus("tree");
    if (cwd === "") return () => {
      alive = false;
    };
    setRootLoading(true);
    void loadDir("").then((result) => {
      if (!alive) return;
      setRootLoading(false);
      setRootError(result.error);
      setTruncated(result.truncated);
      setNodes(toNodes(result.entries, 0));
    });
    return () => {
      alive = false;
    };
  }, [cwd, loadDir]);
  const toggleDir = async (node) => {
    if (node.loading) return;
    if (node.open) {
      setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({ ...item, open: false })));
      return;
    }
    if (node.loaded) {
      setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({ ...item, open: true })));
      return;
    }
    setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({ ...item, open: true, loading: true })));
    const result = await loadDir(node.entry.path);
    setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({
      ...item,
      loading: false,
      loaded: true,
      error: result.error,
      children: toNodes(result.entries, item.depth + 1)
    })));
  };
  const openFile = async (entry) => {
    if (pickedRef.current === entry.path && file !== null) {
      setFocus("view");
      return;
    }
    pickedRef.current = entry.path;
    setPicked(entry.path);
    setFocus("view");
    setFileLoading(true);
    setFileError("");
    setFile(null);
    try {
      const data = await api(`/repo/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(entry.path)}`);
      if (!data.ok) {
        setFileError(data.error ?? t("fbReadFailed"));
      } else {
        setFile(data);
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setFileLoading(false);
    }
  };
  const renderNodes = (list) => list.flatMap((node) => {
    const isDir = node.entry.kind === "dir";
    const ignored = node.entry.name === "node_modules" || node.entry.name === ".git" || node.entry.name === "dist" || node.entry.name === "lib";
    const row = /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "button",
      {
        type: "button",
        className: "dgp-fb-row",
        "data-on": picked === node.entry.path ? "1" : "0",
        "data-ignored": ignored ? "1" : "0",
        title: node.entry.path,
        onClick: () => {
          if (isDir) void toggleDir(node);
          else void openFile(node.entry);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-fb-caret", "data-open": node.open ? "1" : "0", "data-dir": isDir ? "1" : "0", children: isDir ? node.loading ? "\u2026" : node.open ? "\u25BE" : "\u25B8" : "" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-fb-name", style: { paddingLeft: `${node.depth * 12}px` }, children: node.entry.name }),
          isDir ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-fb-size", children: humanSize(node.entry.size) })
        ]
      },
      node.entry.path
    );
    const children = node.open ? node.error !== "" ? [/* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-hint", style: { paddingLeft: `${(node.depth + 1) * 12}px` }, children: node.error }, `${node.entry.path}-err`)] : renderNodes(node.children) : [];
    return [row, ...children];
  });
  const lang = file?.lang ?? "";
  const canHighlight = lang !== "" && hasGrammar(lang);
  const body = (0, import_react4.useMemo)(() => {
    if (file === null || !file.ok) return "";
    if (file.binary) return "";
    return file.content;
  }, [file]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-fb", "data-focus": focus, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-fb-tree", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-fb-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BranchIcon, {}),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-fb-path", title: cwd, children: cwd })
      ] }),
      rootLoading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Skeleton, { rows: 6 }) : null,
      rootError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-hint", children: rootError }) : null,
      !rootLoading && rootError === "" && nodes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(EmptyState, { title: t("fbEmpty"), hint: t("fbEmptyHint") }) : null,
      truncated ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-hint", children: t("fbTruncated") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-fb-list", children: renderNodes(nodes) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-fb-view", children: picked === "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(EmptyState, { title: t("fbPick"), hint: t("fbPickHint") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-fb-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-btn ghost dgp-fb-back", onClick: () => setFocus("tree"), children: t("fbBack") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-fb-path", title: picked, children: picked }),
        file !== null && !file.binary ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-fb-size", children: humanSize(file.size) }) : null,
        file !== null && !file.binary ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-btn ghost", "data-on": wrap ? "1" : "0", onClick: () => setWrap(!wrap), children: t("fbWrap") }) : null
      ] }),
      fileLoading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Skeleton, { rows: 8 }) : null,
      fileError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-hint", children: fileError }) : null,
      file !== null && file.binary ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-hint", children: t("fbBinary") }) : null,
      file !== null && !file.binary && file.truncated ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-hint", children: t("fbTruncatedFile") }) : null,
      file !== null && !file.binary ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "dgp-fb-code", "data-wrap": wrap ? "1" : "0", children: canHighlight ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { dangerouslySetInnerHTML: { __html: highlight(body, lang) } }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: body }) }) : null
    ] }) })
  ] });
}

// src/client/workbench.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var COMMIT_PAGE = 80;
var LANG_BY_EXT = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "xml",
  htm: "xml",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  markdown: "markdown",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  sql: "sql",
  diff: "diff",
  patch: "diff"
};
function langOfPath(path) {
  if (!path) return "";
  const name = path.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return LANG_BY_EXT[name.slice(dot + 1).toLowerCase()] ?? "";
}
function parseRefs(refs) {
  if (!refs) return [];
  return refs.split(", ").map((item) => item.trim()).filter((item) => item.length > 0).map((item) => {
    if (item.startsWith("HEAD -> ")) return { text: item.slice("HEAD -> ".length), kind: "head" };
    if (item.startsWith("tag: ")) return { text: item.slice("tag: ".length), kind: "tag" };
    if (item.startsWith("origin/") || item.includes("/")) return { text: item, kind: "remote" };
    return { text: item, kind: "other" };
  });
}
function shortDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function Modal({
  title,
  onClose,
  children,
  footer,
  width = 520
}) {
  (0, import_react5.useEffect)(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-portal dgp-modal-mask", onMouseDown: (event) => event.target === event.currentTarget && onClose(), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-modal", role: "dialog", "aria-label": title, style: { width: `min(${width}px, calc(100vw - 48px))` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-modal-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-modal-title", children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-modal-x", "aria-label": "close", onClick: onClose, children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-modal-body", children }),
      footer ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-modal-foot", children: footer }) : null
    ] }) }),
    document.body
  );
}
function Workbench({ t, cwd, status, onStatusChange, onClose, onOpenSettings }) {
  useStyles();
  const [view, setView] = (0, import_react5.useState)("changes");
  const [changes, setChanges] = (0, import_react5.useState)(null);
  const [changesLoading, setChangesLoading] = (0, import_react5.useState)(false);
  const [changesError, setChangesError] = (0, import_react5.useState)("");
  const [commits, setCommits] = (0, import_react5.useState)([]);
  const [commitsLoading, setCommitsLoading] = (0, import_react5.useState)(false);
  const [commitsError, setCommitsError] = (0, import_react5.useState)("");
  const [graph, setGraph] = (0, import_react5.useState)(null);
  const [graphLoading, setGraphLoading] = (0, import_react5.useState)(false);
  const [graphError, setGraphError] = (0, import_react5.useState)("");
  const [branches, setBranches] = (0, import_react5.useState)([]);
  const [currentBranch, setCurrentBranch] = (0, import_react5.useState)("");
  const [remotes, setRemotes] = (0, import_react5.useState)([]);
  const [upstream, setUpstream] = (0, import_react5.useState)("");
  const [selected, setSelected] = (0, import_react5.useState)(/* @__PURE__ */ new Set());
  const [message, setMessage] = (0, import_react5.useState)("");
  const [amend, setAmend] = (0, import_react5.useState)(false);
  const [busy, setBusy] = (0, import_react5.useState)("none");
  const [toast, setToast] = (0, import_react5.useState)(null);
  const [layer, setLayer] = (0, import_react5.useState)("none");
  const [detailRev, setDetailRev] = (0, import_react5.useState)("");
  const [diffText, setDiffText] = (0, import_react5.useState)("");
  const [diffError, setDiffError] = (0, import_react5.useState)("");
  const [diffLoading, setDiffLoading] = (0, import_react5.useState)(false);
  const [diffTruncated, setDiffTruncated] = (0, import_react5.useState)(false);
  const [diffPath, setDiffPath] = (0, import_react5.useState)("");
  const [diffMode, setDiffMode] = (0, import_react5.useState)("worktree");
  const isRepo = status !== null && status.isRepo;
  const authorized = status !== null && status.authorized !== false;
  const [initRemote, setInitRemote] = (0, import_react5.useState)("");
  const [discardPending, setDiscardPending] = (0, import_react5.useState)(null);
  const [commitQuery, setCommitQuery] = (0, import_react5.useState)("");
  const [commitSearch, setCommitSearch] = (0, import_react5.useState)("");
  const [commitsMore, setCommitsMore] = (0, import_react5.useState)(false);
  const [commitsExhausted, setCommitsExhausted] = (0, import_react5.useState)(false);
  const [tags, setTags] = (0, import_react5.useState)([]);
  const [tagsLoading, setTagsLoading] = (0, import_react5.useState)(false);
  const [tagsError, setTagsError] = (0, import_react5.useState)("");
  const [stashes, setStashes] = (0, import_react5.useState)([]);
  const [stashesLoading, setStashesLoading] = (0, import_react5.useState)(false);
  const [stashesError, setStashesError] = (0, import_react5.useState)("");
  const [repos, setRepos] = (0, import_react5.useState)([]);
  const [repoMenu, setRepoMenu] = (0, import_react5.useState)(false);
  const [activeRoot, setActiveRoot] = (0, import_react5.useState)("");
  const [suggesting, setSuggesting] = (0, import_react5.useState)(false);
  const dir = activeRoot || cwd;
  const showToast = (tone, text) => setToast({ tone, text });
  const loadStatus = async () => {
    try {
      const data = await api(`/repo/status?dir=${encodeURIComponent(dir)}`);
      if (data.ok && data.status) onStatusChange(data.status);
    } catch {
    }
  };
  const loadChanges = async () => {
    if (!dir || !isRepo) return;
    setChangesLoading(true);
    try {
      const data = await api(`/repo/changes?dir=${encodeURIComponent(dir)}`);
      if (data.ok && data.changes) {
        setChanges(data.changes);
        setChangesError("");
      } else {
        setChanges(null);
        setChangesError(
          String(data.error ?? "").includes("\u4E0D\u652F\u6301\u7684\u8BF7\u6C42\u65B9\u6CD5") ? t("changesStaleNode") : data.error || t("changesFailed")
        );
      }
    } catch (error) {
      setChanges(null);
      setChangesError(error.message || t("changesFailed"));
    } finally {
      setChangesLoading(false);
    }
  };
  const loadCommits = async (search = commitSearch, offset = 0) => {
    if (!dir || !isRepo) return;
    const appending = offset > 0;
    if (appending) setCommitsMore(true);
    else setCommitsLoading(true);
    try {
      const params = new URLSearchParams({ cwd: dir, limit: String(COMMIT_PAGE), offset: String(offset) });
      if (search.trim()) params.set("search", search.trim());
      const data = await api(
        `/repo/commits?${params.toString()}`
      );
      if (data.ok && Array.isArray(data.commits)) {
        const rows = data.commits;
        setCommits((prev) => appending ? [...prev, ...rows] : rows);
        setCommitsExhausted(data.truncated === false && rows.length < COMMIT_PAGE);
        setCommitsError("");
      } else {
        if (!appending) setCommits([]);
        setCommitsError(data.error || "");
      }
    } catch (error) {
      if (!appending) setCommits([]);
      setCommitsError(error.message);
    } finally {
      setCommitsLoading(false);
      setCommitsMore(false);
    }
  };
  const loadBranches = async () => {
    if (!dir || !isRepo) return;
    try {
      const data = await api(`/repo/branches?dir=${encodeURIComponent(dir)}`);
      if (data.ok) {
        setBranches(data.branches ?? []);
        setCurrentBranch(data.current ?? "");
      }
    } catch {
    }
  };
  const loadRemotes = async () => {
    if (!dir || !isRepo) return;
    try {
      const data = await api(`/repo/remotes?dir=${encodeURIComponent(dir)}`);
      if (data.ok) {
        setRemotes(data.remotes ?? []);
        setUpstream(data.upstream ?? "");
      }
    } catch {
    }
  };
  const loadGraph = async () => {
    if (!dir || !isRepo) return;
    setGraphLoading(true);
    try {
      const data = await api(`/repo/graph?dir=${encodeURIComponent(dir)}&limit=40`);
      if (data.ok && data.graph) {
        setGraph(data.graph);
        setGraphError("");
      } else {
        setGraph(null);
        setGraphError(data.error || "");
      }
    } catch (error) {
      setGraph(null);
      setGraphError(error.message);
    } finally {
      setGraphLoading(false);
    }
  };
  const loadTags = async () => {
    if (!dir || !isRepo) return;
    setTagsLoading(true);
    try {
      const data = await api(`/repo/tags?dir=${encodeURIComponent(dir)}`);
      if (data.ok && Array.isArray(data.tags)) {
        setTags(data.tags);
        setTagsError("");
      } else {
        setTags([]);
        setTagsError(data.error || "");
      }
    } catch (error) {
      setTags([]);
      setTagsError(error.message);
    } finally {
      setTagsLoading(false);
    }
  };
  const loadStashes = async () => {
    if (!dir || !isRepo) return;
    setStashesLoading(true);
    try {
      const data = await api(`/repo/stash?dir=${encodeURIComponent(dir)}`);
      if (data.ok && Array.isArray(data.stashes)) {
        setStashes(data.stashes);
        setStashesError("");
      } else {
        setStashes([]);
        setStashesError(data.error || "");
      }
    } catch (error) {
      setStashes([]);
      setStashesError(error.message);
    } finally {
      setStashesLoading(false);
    }
  };
  const loadRepos = async () => {
    try {
      const data = await api("/repo/discover");
      if (data.ok && Array.isArray(data.repos)) setRepos(data.repos);
    } catch {
    }
  };
  const loadDiff = async (mode, path) => {
    if (!dir || !isRepo) return;
    setDiffLoading(true);
    setDiffError("");
    try {
      const params = new URLSearchParams({ cwd: dir, mode });
      if (path) params.set("path", path);
      const data = await api(`/repo/diff?${params.toString()}`);
      if (data.ok) {
        setDiffText(data.diff ?? "");
        setDiffTruncated(data.truncated === true);
      } else {
        setDiffText("");
        setDiffError(data.error || t("diffFailed"));
      }
    } catch (error) {
      setDiffText("");
      setDiffError(error.message || t("diffFailed"));
    } finally {
      setDiffLoading(false);
    }
  };
  const refreshAll = async () => {
    if (!dir) return;
    await Promise.all([loadStatus(), loadChanges(), loadCommits(), loadBranches(), loadRemotes()]);
  };
  (0, import_react5.useEffect)(() => {
    if (!dir) return;
    void refreshAll();
    if (isRepo) void loadGraph();
  }, [dir, isRepo]);
  (0, import_react5.useEffect)(() => {
    void loadRepos();
  }, []);
  (0, import_react5.useEffect)(() => {
    if (view === "graph" && isRepo && !graph) void loadGraph();
    if (view === "tags" && isRepo && tags.length === 0 && !tagsLoading) void loadTags();
    if (view === "stash" && isRepo && stashes.length === 0 && !stashesLoading) void loadStashes();
  }, [view, isRepo]);
  (0, import_react5.useEffect)(() => {
    if (layer !== "none") return;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeAll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [layer]);
  const unstaged = (changes?.files ?? []).filter((file) => !file.staged);
  const stagedFiles = (changes?.files ?? []).filter((file) => file.staged);
  const untracked = unstaged.filter((file) => file.worktree === "?");
  const modified = unstaged.filter((file) => file.worktree !== "?");
  const toggleSelect = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const selectAll = (paths, on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const path of paths) {
        if (on) next.add(path);
        else next.delete(path);
      }
      return next;
    });
  };
  const run = async (kind, action, okText) => {
    if (busy !== "none") return false;
    setBusy(kind);
    try {
      const result = await action();
      if (result.ok) {
        showToast("ok", okText);
        await refreshAll();
        return true;
      }
      const friendly = result.conflicted ? t("syncConflicted") : result.rejected ? t("syncRejected") : "";
      showToast("error", friendly || result.error || t("actionFailed"));
      return false;
    } catch (error) {
      showToast("error", `${t("actionFailed")}\uFF1A${error.message}`);
      return false;
    } finally {
      setBusy("none");
    }
  };
  const stageSelected = (paths) => run("stage", () => api("/repo/stage", { cwd: dir, paths }), t("toastStaged"));
  const unstageSelected = (paths) => run("unstage", () => api("/repo/unstage", { cwd: dir, paths }), t("toastUnstaged"));
  const doDiscard = (paths) => run("discard", () => api("/repo/discard", { cwd: dir, paths, confirmed: true }), t("toastDiscarded"));
  const doCommit = () => run("commit", () => api("/repo/commit", { cwd: dir, message, amend }), amend ? t("toastAmended") : t("toastCommitted")).then(
    (ok) => {
      if (ok) {
        setMessage("");
        setAmend(false);
        setSelected(/* @__PURE__ */ new Set());
      }
    }
  );
  const doFetch = () => run("fetch", () => api("/repo/fetch", { cwd: dir }), t("toastFetched"));
  const doPull = (strategy) => run(
    "pull",
    () => api("/repo/pull", { cwd: dir, strategy, remote: remotes[0]?.name ?? "", branch: currentBranch }),
    strategy === "rebase" ? t("toastPulledRebase") : t("toastPulledMerge")
  ).then((ok) => {
    if (!ok) void loadStatus();
  });
  const doPush = (setUpstream2) => run("push", () => api("/repo/push", { cwd: dir, remote: remotes[0]?.name ?? "", branch: currentBranch, setUpstream: setUpstream2 }), t("toastPushed")).then((ok) => {
    if (!ok) void loadStatus();
  });
  const doInit = () => run("init", () => api("/repo/init", { cwd: dir, branch: "main" }), t("initDone"));
  const doInitWithForm = async () => {
    const ok = await doInit();
    if (!ok) return;
    const url = initRemote.trim();
    if (!url) return;
    try {
      const added = await api("/repo/remotes/add", { cwd: dir, name: "origin", url });
      showToast(added.ok ? "ok" : "error", added.ok ? t("toastRemoteAdded") : added.error || t("actionFailed"));
      await refreshAll();
    } catch (error) {
      showToast("error", `${t("actionFailed")}\uFF1A${error.message}`);
    }
  };
  const openDetail = (rev) => {
    setDetailRev(rev);
    setLayer("commit");
  };
  const openDiff = (mode, path) => {
    setDiffMode(mode);
    setDiffPath(path);
    setLayer("diff");
    void loadDiff(mode, path);
  };
  const switchRepo = (next) => {
    setRepoMenu(false);
    if (!next || next === dir) return;
    setActiveRoot(next);
    setCommits([]);
    setCommitsExhausted(false);
    setTags([]);
    setStashes([]);
    setGraph(null);
    setChanges(null);
    setSelected(/* @__PURE__ */ new Set());
    setMessage("");
  };
  const submitCommitSearch = () => {
    setCommitSearch(commitQuery.trim());
    setCommitsExhausted(false);
    void loadCommits(commitQuery.trim(), 0);
  };
  const loadMoreCommits = () => {
    if (commitsMore) return;
    void loadCommits(commitSearch, commits.length);
  };
  const doSuggest = async () => {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const data = await api("/repo/suggest-message", {
        cwd: dir,
        hint: message.trim()
      });
      if (data.ok && data.message) {
        setMessage(data.message);
        showToast("ok", t("toastSuggested"));
      } else {
        showToast("error", data.error || t("suggestFailed"));
      }
    } catch (error) {
      showToast("error", `${t("suggestFailed")}\uFF1A${error.message}`);
    } finally {
      setSuggesting(false);
    }
  };
  const doTagCreate = (name, message2) => run("tag", () => api("/repo/tags/create", { cwd: dir, name, message: message2 }), t("toastTagCreated")).then(
    (ok) => ok && loadTags()
  );
  const doTagDelete = (name) => run("tag", () => api("/repo/tags/delete", { cwd: dir, name }), t("toastTagDeleted")).then(
    (ok) => ok && loadTags()
  );
  const doTagPush = (name) => run("tag", () => api("/repo/tags/push", { cwd: dir, name, remote: remotes[0]?.name ?? "" }), t("toastTagPushed")).then(
    (ok) => ok && loadTags()
  );
  const doStashSave = (text, includeUntracked) => run("stash", () => api("/repo/stash/save", { cwd: dir, message: text, includeUntracked }), t("toastStashed")).then(
    (ok) => ok && loadStashes()
  );
  const doStashAction = (action, index) => run(
    "stash",
    () => api("/repo/stash/action", { cwd: dir, action, index }),
    action === "drop" ? t("toastStashDropped") : action === "pop" ? t("toastStashPopped") : t("toastStashApplied")
  ).then((ok) => ok && loadStashes());
  const currentBranchRow = branches.find((branch) => branch.kind === "local" && branch.current);
  const hasRemote = remotes.length > 0;
  const canCommit = stagedFiles.length > 0 && message.trim().length > 0 && busy === "none";
  const canPull = isRepo && authorized && busy === "none";
  const canPush = isRepo && authorized && hasRemote && currentBranch.length > 0 && busy === "none";
  const closeAll = () => {
    onClose();
  };
  if (!status) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-portal dgp-gw-mask", onMouseDown: (event) => event.target === event.currentTarget && closeAll() }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-root dgp-gw", role: "dialog", "aria-label": t("wbTitle"), "data-state": "loading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-top", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-crumb", children: t("wbTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-x", onClick: closeAll, "aria-label": "close", children: "\xD7" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-state", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Skeleton, { rows: 5 }) })
      ] })
    ] });
  }
  if (!isRepo) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-portal dgp-gw-mask", onMouseDown: (event) => event.target === event.currentTarget && closeAll() }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-root dgp-gw", role: "dialog", "aria-label": t("wbTitle"), "data-state": "no-repo", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-top", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-crumb", children: t("wbTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-x", onClick: closeAll, "aria-label": "close", children: "\xD7" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-state", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("notRepo"), hint: t("wbInitHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-initform", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-label", children: t("wbInitRemote") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "dgp-input", value: initRemote, onChange: (event) => setInitRemote(event.target.value), placeholder: "https://github.com/user/repo.git" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "dgp-btn primary", disabled: busy !== "none", onClick: () => void doInitWithForm(), children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PlusIcon, {}),
              t("menuInit")
            ] })
          ] })
        ] }),
        toast ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Toast, { tone: toast.tone, text: toast.text, onDone: () => setToast(null) }) : null
      ] })
    ] });
  }
  if (!authorized) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-portal dgp-gw-mask", onMouseDown: (event) => event.target === event.currentTarget && closeAll() }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-root dgp-gw", role: "dialog", "aria-label": t("wbTitle"), "data-state": "unauthorized", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-top", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-crumb", children: t("wbTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-x", onClick: closeAll, "aria-label": "close", children: "\xD7" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-state", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("unauthorizedRoot"), hint: t("wbUnauthorizedHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "button",
            {
              type: "button",
              className: "dgp-btn",
              onClick: () => {
                closeAll();
                onOpenSettings();
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GearIcon, {}),
                t("menuSettings")
              ]
            }
          )
        ] })
      ] })
    ] });
  }
  const railItems = [
    { key: "changes", label: t("wbChangesTab"), count: changes?.files.length ?? 0 },
    { key: "history", label: t("wbHistory"), count: commits.length },
    { key: "graph", label: t("wbGraph"), count: graph?.rows.length ?? 0 },
    { key: "files", label: t("wbFilesTab"), count: 0 },
    { key: "tags", label: t("wbTagsTab"), count: tags.length },
    { key: "stash", label: t("wbStashTab"), count: stashes.length }
  ];
  const repoOptions = (() => {
    const list = repos.slice();
    if (!list.some((item) => item.root.toLowerCase() === dir.toLowerCase())) {
      list.unshift({ root: dir, name: status?.root?.split(/[\\/]/).pop() || dir, branch: currentBranch, remotes: [] });
    }
    return list;
  })();
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-portal dgp-gw-mask", onMouseDown: (event) => event.target === event.currentTarget && closeAll() }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-root dgp-gw", role: "dialog", "aria-label": t("wbTitle"), "data-state": "ready", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-top", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "button",
          {
            type: "button",
            className: "dgp-gw-repo",
            title: status.root || dir,
            "aria-haspopup": "menu",
            "aria-expanded": repoMenu,
            onClick: () => setRepoMenu((prev) => !prev),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BranchIcon, {}),
              status.root?.split(/[\\/]/).pop() || dir,
              repoOptions.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-caret", children: "\u25BE" }) : null
            ]
          }
        ),
        repoMenu ? (0, import_react_dom.createPortal)(
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-portal dgp-repomenu", role: "menu", "aria-label": t("wbSwitchRepo"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-repomenu-head", children: t("wbSwitchRepo") }),
            repoOptions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitem",
                className: "dgp-repomenu-row",
                "data-on": item.root.toLowerCase() === dir.toLowerCase() ? "1" : "0",
                title: item.root,
                onClick: () => switchRepo(item.root),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-repomenu-name", children: item.name }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-repomenu-meta", children: item.branch || "HEAD" })
                ]
              },
              item.root
            )),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-repomenu-foot", children: t("wbSwitchRepoHint") })
          ] }),
          document.body
        ) : null,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "dgp-gw-branch", "data-current": currentBranchRow ? "1" : "0", onClick: () => setLayer("branches"), children: [
          currentBranch || "HEAD",
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-caret", children: "\u25BE" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-aux", children: [
          status.ahead > 0 ? `\u2191${status.ahead}` : "",
          status.behind > 0 ? `\u2193${status.behind}` : "",
          status.changed > 0 ? `${status.changed}*` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-btnbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn ghost", disabled: !canPull, onClick: () => void doFetch(), children: t("wbFetch") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", disabled: !canPull, onClick: () => setLayer("pull"), children: t("wbPull") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn primary", disabled: !canPush, onClick: () => void doPush(false), children: t("wbPush") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-btnbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn ghost", onClick: () => setLayer("remote"), children: t("wbRemoteTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-icon", disabled: busy !== "none", onClick: () => void refreshAll(), "aria-label": t("refresh"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RefreshIcon, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-icon", onClick: () => {
            closeAll();
            onOpenSettings();
          }, "aria-label": t("menuSettings"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GearIcon, {}) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-x", onClick: closeAll, "aria-label": "close", children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("nav", { className: "dgp-gw-rail", "aria-label": t("wbTitle"), children: railItems.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "button",
          {
            type: "button",
            className: "dgp-gw-railbtn",
            "data-on": view === item.key ? "1" : "0",
            onClick: () => setView(item.key),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-railbtn-label", children: item.label }),
              item.count > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-railbtn-count", children: item.count }) : null
            ]
          },
          item.key
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-main", children: [
          view === "changes" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-commit", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "textarea",
                {
                  className: "dgp-gw-msg",
                  placeholder: t("wbMsgPlaceholder"),
                  value: message,
                  onChange: (event) => setMessage(event.target.value),
                  rows: 3
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-commitbar", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-gw-amend", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: amend, onChange: (event) => setAmend(event.target.checked) }),
                  t("wbAmend")
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dgp-gw-textbtn",
                    disabled: suggesting || busy !== "none",
                    onClick: () => void doSuggest(),
                    title: t("wbSuggestHint"),
                    children: suggesting ? t("wbSuggesting") : t("wbSuggest")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-staged-count", children: stagedFiles.length }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn primary", disabled: !canCommit, onClick: () => void doCommit(), children: t("wbCommit") })
              ] }),
              stagedFiles.length === 0 && (message.trim().length > 0 || amend) ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-hint", children: t("wbCommitNeedsStaged") }) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-lists", children: changesLoading && !changes ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Skeleton, { rows: 6 }) : changesError ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-err", children: changesError }) : !changes || changes.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("changesEmpty"), hint: t("wbCleanHint") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
              stagedFiles.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "dgp-gw-group", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "dgp-gw-grouphead", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-gw-checkall", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "input",
                      {
                        type: "checkbox",
                        checked: stagedFiles.every((file) => selected.has(file.path)),
                        onChange: (event) => selectAll(stagedFiles.map((file) => file.path), event.target.checked)
                      }
                    ),
                    t("changesStaged")
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-count", children: stagedFiles.length }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy !== "none", onClick: () => void unstageSelected(stagedFiles.map((file) => file.path)), children: t("wbUnstage") })
                ] }),
                stagedFiles.map((file) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  ChangeRow,
                  {
                    file,
                    checked: selected.has(file.path),
                    onToggle: () => toggleSelect(file.path),
                    onPreview: () => openDiff("staged", file.path),
                    onAction: () => void unstageSelected([file.path]),
                    actionLabel: t("wbUnstage"),
                    danger: false
                  },
                  `s-${file.path}`
                ))
              ] }) : null,
              modified.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "dgp-gw-group", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "dgp-gw-grouphead", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-gw-checkall", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "input",
                      {
                        type: "checkbox",
                        checked: modified.every((file) => selected.has(file.path)),
                        onChange: (event) => selectAll(modified.map((file) => file.path), event.target.checked)
                      }
                    ),
                    t("wbUnstaged")
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-count", children: modified.length }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy !== "none", onClick: () => void stageSelected(modified.map((file) => file.path)), children: t("wbStageAll") })
                ] }),
                modified.map((file) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  ChangeRow,
                  {
                    file,
                    checked: selected.has(file.path),
                    onToggle: () => toggleSelect(file.path),
                    onPreview: () => openDiff("worktree", file.path),
                    onAction: () => void stageSelected([file.path]),
                    actionLabel: t("wbStage"),
                    danger: false
                  },
                  `w-${file.path}`
                ))
              ] }) : null,
              untracked.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "dgp-gw-group", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "dgp-gw-grouphead", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-gw-checkall", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "input",
                      {
                        type: "checkbox",
                        checked: untracked.every((file) => selected.has(file.path)),
                        onChange: (event) => selectAll(untracked.map((file) => file.path), event.target.checked)
                      }
                    ),
                    t("wbUntracked")
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-count", children: untracked.length }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy !== "none", onClick: () => void stageSelected(untracked.map((file) => file.path)), children: t("wbStageAll") })
                ] }),
                untracked.map((file) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  ChangeRow,
                  {
                    file,
                    checked: selected.has(file.path),
                    onToggle: () => toggleSelect(file.path),
                    onPreview: () => void 0,
                    onAction: () => void stageSelected([file.path]),
                    actionLabel: t("wbStage"),
                    danger: false
                  },
                  `u-${file.path}`
                ))
              ] }) : null
            ] }) }),
            selected.size > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-batch", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-batch-count", children: selected.size }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", disabled: busy !== "none", onClick: () => void stageSelected([...selected]), children: t("wbStage") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", disabled: busy !== "none", onClick: () => void unstageSelected([...selected]), children: t("wbUnstage") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn danger", disabled: busy !== "none", onClick: () => setDiscardPending([...selected]), children: t("wbDiscard") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-spacer" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", onClick: () => setSelected(/* @__PURE__ */ new Set()), children: t("wbCancel") })
            ] }) : null
          ] }) : null,
          view === "history" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-searchbar", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "input",
                {
                  className: "dgp-input dgp-gw-search",
                  placeholder: t("wbSearchCommit"),
                  value: commitQuery,
                  onChange: (event) => setCommitQuery(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") submitCommitSearch();
                    if (event.key === "Escape") setCommitQuery("");
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", onClick: submitCommitSearch, children: t("wbSearch") }),
              commitSearch ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  type: "button",
                  className: "dgp-gw-textbtn",
                  onClick: () => {
                    setCommitQuery("");
                    setCommitSearch("");
                    void loadCommits("", 0);
                  },
                  children: t("wbSearchClear")
                }
              ) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-scroll", children: commitsLoading && commits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Skeleton, { rows: 8 }) : commitsError ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-err", children: commitsError }) : commits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: commitSearch ? t("wbSearchEmpty") : t("wbNoCommits"), hint: commitSearch ? t("wbSearchEmptyHint") : t("wbNoCommitsHint") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-log", role: "list", children: commits.map((commit) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "dgp-gw-logrow", role: "listitem", onClick: () => openDetail(commit.hash), children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-loghash", children: commit.shortHash }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-logmsg", title: commit.subject, children: commit.subject }),
                parseRefs(commit.refs).map((ref) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-graph-ref", "data-kind": ref.kind === "head" ? "head" : ref.kind, children: ref.text }, ref.text)),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-logmeta", children: [
                  commit.author,
                  " \xB7 ",
                  shortDate(commit.date)
                ] })
              ] }, commit.hash)) }),
              commitsExhausted ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-hint", children: t("wbNoMoreCommits") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-more", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", disabled: commitsMore, onClick: loadMoreCommits, children: commitsMore ? t("wbLoadingMore") : t("wbLoadMore") }) })
            ] }) })
          ] }) : null,
          view === "graph" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GraphView, { t, graph, loading: graphLoading, error: graphError }) }) : null,
          view === "files" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FileBrowser, { t, cwd: dir }) : null,
          view === "tags" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            TagsPanel,
            {
              t,
              tags,
              loading: tagsLoading,
              error: tagsError,
              busy: busy !== "none",
              hasRemote,
              onCreate: doTagCreate,
              onDelete: doTagDelete,
              onPush: doTagPush,
              onRefresh: loadTags
            }
          ) : null,
          view === "stash" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            StashPanel,
            {
              t,
              stashes,
              loading: stashesLoading,
              error: stashesError,
              busy: busy !== "none",
              onSave: doStashSave,
              onAction: doStashAction,
              onRefresh: loadStashes
            }
          ) : null
        ] })
      ] }),
      toast ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Toast, { tone: toast.tone, text: toast.text, onDone: () => setToast(null) }) : null,
      discardPending ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Modal, { title: t("wbDiscardTitle"), onClose: () => setDiscardPending(null), width: 440, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dgp-modal-text", children: t("wbDiscardText") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { className: "dgp-modal-list", children: discardPending.map((path) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: path }) }, path)) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-modal-foot", style: { borderTop: "none", padding: "10px 0 0" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => setDiscardPending(null), children: t("wbCancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: "dgp-btn danger",
              disabled: busy !== "none",
              onClick: () => {
                const paths = discardPending;
                setDiscardPending(null);
                void doDiscard(paths);
              },
              children: t("wbDiscard")
            }
          )
        ] })
      ] }) : null,
      layer === "diff" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Modal, { title: `${t("wbDiffTitle")} \xB7 ${diffPath || (diffMode === "staged" ? t("changesStaged") : t("wbUnstaged"))}`, onClose: () => setLayer("none"), width: 1040, children: [
        diffLoading ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Skeleton, { rows: 8 }) : diffError ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-err", children: diffError }) : diffText ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DiffView, { t, text: diffText, truncated: diffTruncated, lang: langOfPath(diffPath) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("diffEmpty"), hint: t("diffEmptyHint") }),
        diffTruncated ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-hint", children: t("diffTruncated") }) : null
      ] }) : null,
      layer === "branches" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        BranchesModal,
        {
          t,
          cwd: dir,
          branches,
          current: currentBranch,
          onClose: () => setLayer("none"),
          onChanged: refreshAll,
          run,
          onNewBranch: () => setLayer("newBranch")
        }
      ) : null,
      layer === "newBranch" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(NewBranchModal, { t, cwd: dir, onClose: () => setLayer("none"), onChanged: refreshAll, run }) : null,
      layer === "commit" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CommitDetailModal, { t, cwd: dir, rev: detailRev, onClose: () => setLayer("none") }) : null,
      layer === "remote" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RemoteModal, { t, cwd: dir, remotes, onClose: () => setLayer("none"), onChanged: refreshAll, run }) : null,
      layer === "pull" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        PullModal,
        {
          t,
          onClose: () => setLayer("none"),
          onPull: (strategy) => {
            setLayer("none");
            void doPull(strategy);
          },
          upstream,
          hasRemote
        }
      ) : null
    ] })
  ] });
}
function TagsPanel({
  t,
  tags,
  loading,
  error,
  busy,
  hasRemote,
  onCreate,
  onDelete,
  onPush,
  onRefresh
}) {
  const [name, setName] = (0, import_react5.useState)("");
  const [tagNote, setTagNote] = (0, import_react5.useState)("");
  const [confirmDelete, setConfirmDelete] = (0, import_react5.useState)("");
  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void onCreate(trimmed, tagNote.trim()).then(() => {
      setName("");
      setTagNote("");
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-searchbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "dgp-input dgp-gw-search", placeholder: t("wbTagName"), value: name, onChange: (event) => setName(event.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "dgp-input dgp-gw-search", placeholder: t("wbTagNote"), value: tagNote, onChange: (event) => setTagNote(event.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn primary", disabled: busy || name.trim().length === 0, onClick: create, children: t("wbTagCreate") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy, onClick: () => void onRefresh(), children: t("refresh") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-scroll", children: loading && tags.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Skeleton, { rows: 6 }) : error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-err", children: error }) : tags.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("wbNoTags"), hint: t("wbNoTagsHint") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-log", role: "list", children: tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-logrow", role: "listitem", "data-tag": tag.annotated ? "1" : "0", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-loghash", children: tag.hash }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-logmsg", title: tag.subject, children: tag.name }),
      tag.annotated ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-graph-ref", "data-kind": "tag", children: t("wbTagAnnotated") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-logmeta", children: shortDate(tag.date) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy || !hasRemote, onClick: () => void onPush(tag.name), children: t("wbTagPush") }),
      confirmDelete === tag.name ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          className: "dgp-gw-textbtn",
          "data-danger": "1",
          disabled: busy,
          onClick: () => {
            setConfirmDelete("");
            void onDelete(tag.name);
          },
          children: t("wbConfirmDelete")
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", "data-danger": "1", onClick: () => setConfirmDelete(tag.name), children: t("wbDelete") })
    ] }, tag.name)) }) })
  ] });
}
function StashPanel({
  t,
  stashes,
  loading,
  error,
  busy,
  onSave,
  onAction,
  onRefresh
}) {
  const [stashNote, setStashNote] = (0, import_react5.useState)("");
  const [withUntracked, setWithUntracked] = (0, import_react5.useState)(true);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-searchbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          className: "dgp-input dgp-gw-search",
          placeholder: t("wbStashNote"),
          value: stashNote,
          onChange: (event) => setStashNote(event.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-gw-amend", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: withUntracked, onChange: (event) => setWithUntracked(event.target.checked) }),
        t("wbStashUntracked")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          className: "dgp-btn primary",
          disabled: busy,
          onClick: () => void onSave(stashNote.trim(), withUntracked).then(() => setStashNote("")),
          children: t("wbStashSave")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy, onClick: () => void onRefresh(), children: t("refresh") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-scroll", children: loading && stashes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Skeleton, { rows: 5 }) : error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-err", children: error }) : stashes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("wbNoStashes"), hint: t("wbNoStashesHint") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-log", role: "list", children: stashes.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-logrow", role: "listitem", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-loghash", children: item.ref }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-logmsg", title: item.subject, children: item.subject || t("wbStashNoSubject") }),
      item.branch ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-graph-ref", "data-kind": "head", children: item.branch }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy, onClick: () => void onAction("pop", item.index), children: t("wbStashPop") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", disabled: busy, onClick: () => void onAction("apply", item.index), children: t("wbStashApply") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", "data-danger": "1", disabled: busy, onClick: () => void onAction("drop", item.index), children: t("wbStashDrop") })
    ] }, item.ref)) }) })
  ] });
}
function ChangeRow({
  file,
  checked,
  onToggle,
  onPreview,
  onAction,
  actionLabel,
  danger
}) {
  const code = file.staged ? file.index || "M" : file.worktree === "?" ? "??" : file.worktree || "M";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-row", "data-staged": file.staged ? "1" : "0", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked, onChange: onToggle, "aria-label": file.path }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-code", "data-code": code, onClick: onPreview, children: code }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-path", onClick: onPreview, title: file.path, children: file.path }),
    file.added > 0 || file.deleted > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-stat", children: [
      file.added > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("b", { "data-sign": "add", children: [
        "+",
        file.added
      ] }) : null,
      file.deleted > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("b", { "data-sign": "del", children: [
        "-",
        file.deleted
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-rowact", "data-danger": danger ? "1" : "0", onClick: onAction, children: actionLabel })
  ] });
}
function BranchesModal({
  t,
  cwd,
  branches,
  current,
  onClose,
  onChanged,
  run,
  onNewBranch
}) {
  const local = branches.filter((branch) => branch.kind === "local");
  const remote = branches.filter((branch) => branch.kind === "remote");
  const [confirmDelete, setConfirmDelete] = (0, import_react5.useState)("");
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    Modal,
    {
      title: t("wbBranchTitle"),
      onClose,
      width: 520,
      footer: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn primary", onClick: onNewBranch, children: t("wbNewBranch") }),
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-branchcols", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-secttitle", children: t("wbLocalBranches") }),
          local.map((branch) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-branchrow", "data-current": branch.current ? "1" : "0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-branchname", children: [
              branch.name,
              branch.current ? " \u2713" : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-branchmeta", children: [
              branch.ahead > 0 ? `\u2191${branch.ahead}` : "",
              branch.behind > 0 ? `\u2193${branch.behind}` : ""
            ] }),
            !branch.current ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", onClick: () => void run("branch", () => api("/repo/branches/checkout", { cwd, name: branch.name }), t("toastCheckedOut")).then((ok) => ok && onChanged()).then(() => onClose()), children: t("wbCheckout") }),
              confirmDelete === branch.name ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", "data-danger": "1", onClick: () => void run("branch", () => api("/repo/branches/delete", { cwd, name: branch.name, force: false }), t("toastBranchDeleted")).then((ok) => ok && onChanged()).then(() => setConfirmDelete("")), children: t("wbConfirmDelete") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", "data-danger": "1", onClick: () => setConfirmDelete(branch.name), children: t("wbDelete") })
            ] }) : null
          ] }, branch.name))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-secttitle", children: t("wbRemoteBranches") }),
          remote.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-hint", children: t("wbNoRemoteBranches") }) : null,
          remote.map((branch) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-branchrow", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-branchname", children: branch.name }) }, branch.name))
        ] })
      ] })
    }
  );
}
function NewBranchModal({
  t,
  cwd,
  onClose,
  onChanged,
  run
}) {
  const [name, setName] = (0, import_react5.useState)("");
  const [checkout, setCheckout] = (0, import_react5.useState)(true);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    Modal,
    {
      title: t("wbNewBranch"),
      onClose,
      width: 440,
      footer: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", onClick: onClose, children: t("wbCancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            className: "dgp-btn primary",
            disabled: name.trim().length === 0,
            onClick: () => void run("branch", () => api("/repo/branches/create", { cwd, name: name.trim(), checkout }), t("toastBranchCreated")).then((ok) => ok && onChanged()).then(() => onClose()),
            children: t("wbCreate")
          }
        )
      ] }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-label", children: t("wbBranchName") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "dgp-input", value: name, onChange: (event) => setName(event.target.value), autoFocus: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: checkout, onChange: (event) => setCheckout(event.target.checked) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-check-title", children: t("wbCheckoutAfterCreate") })
        ] })
      ]
    }
  );
}
function CommitDetailModal({ t, cwd, rev, onClose }) {
  const [detail, setDetail] = (0, import_react5.useState)(null);
  const [error, setError] = (0, import_react5.useState)("");
  const [loading, setLoading] = (0, import_react5.useState)(true);
  (0, import_react5.useEffect)(() => {
    let alive = true;
    setLoading(true);
    api(
      `/repo/commit?cwd=${encodeURIComponent(cwd)}&rev=${encodeURIComponent(rev)}`
    ).then((data) => {
      if (!alive) return;
      if (data.ok && data.commit) setDetail({ commit: data.commit, files: data.files ?? [], diff: data.diff ?? "" });
      else setError(data.error || t("wbDetailFailed"));
    }).catch((err) => alive && setError(err.message)).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [cwd, rev, t]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Modal, { title: `${t("wbCommitDetail")} ${rev.slice(0, 8)}`, onClose, width: 760, children: loading ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Skeleton, { rows: 6 }) : error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-err", children: error }) : detail ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-detail", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dl", { className: "dgp-kv", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "hash" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: detail.commit.hash }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: t("wbAuthor") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dd", { children: [
        detail.commit.author,
        " <",
        detail.commit.email,
        ">"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: t("wbDate") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: shortDate(detail.commit.date) }),
      detail.commit.refs ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "refs" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: detail.commit.refs })
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { className: "dgp-gw-msgtext", children: detail.commit.message || detail.commit.subject }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-secttitle", children: [
      t("wbFiles"),
      " \xB7 ",
      detail.files.length
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { className: "dgp-modal-list", children: detail.files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: file.path }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-gw-stat", children: [
        file.added > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("b", { "data-sign": "add", children: [
          "+",
          file.added
        ] }) : null,
        file.deleted > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("b", { "data-sign": "del", children: [
          "-",
          file.deleted
        ] }) : null
      ] })
    ] }, file.path)) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-gw-secttitle", children: "diff" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DiffView, { t, text: detail.diff, lang: langOfPath(detail.files[0]?.path ?? "") })
  ] }) : null });
}
function RemoteModal({
  t,
  cwd,
  remotes,
  onClose,
  onChanged,
  run
}) {
  const [name, setName] = (0, import_react5.useState)("");
  const [url, setUrl] = (0, import_react5.useState)("");
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Modal, { title: t("wbRemoteTitle"), onClose, width: 560, children: [
    remotes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-hint", children: t("wbNoRemotes") }) : null,
    remotes.map((remote) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-gw-branchrow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-gw-branchname", children: remote.name }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { className: "dgp-gw-remoteurl", children: remote.url }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-gw-textbtn", "data-danger": "1", onClick: () => void run("remote", () => api("/repo/remotes/remove", { cwd, name: remote.name }), t("toastRemoteRemoved")).then((ok) => ok && onChanged()), children: t("wbRemove") })
    ] }, remote.name)),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-sep" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-label", children: t("wbRemoteName") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "dgp-input", value: name, onChange: (event) => setName(event.target.value), placeholder: "origin" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-label", children: t("wbRemoteUrl") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "dgp-input", value: url, onChange: (event) => setUrl(event.target.value), placeholder: "https://github.com/user/repo.git" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-modal-foot", style: { borderTop: "none", padding: "10px 0 0" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        className: "dgp-btn primary",
        disabled: name.trim().length === 0 || url.trim().length === 0,
        onClick: () => void run("remote", () => api("/repo/remotes/add", { cwd, name: name.trim(), url: url.trim() }), t("toastRemoteAdded")).then((ok) => {
          if (ok) {
            setName("");
            setUrl("");
            return onChanged();
          }
          return void 0;
        }),
        children: t("wbAdd")
      }
    ) })
  ] });
}
function PullModal({
  t,
  onClose,
  onPull,
  upstream,
  hasRemote
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    Modal,
    {
      title: t("wbPullTitle"),
      onClose,
      width: 460,
      footer: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", onClick: onClose, children: t("wbCancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn", disabled: !hasRemote, onClick: () => onPull("rebase"), children: t("wbPullRebase") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-btn primary", disabled: !hasRemote, onClick: () => onPull("merge"), children: t("wbPullMerge") })
      ] }),
      children: [
        !hasRemote ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-err", children: t("syncMissingConfig") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dgp-modal-text", children: upstream ? `${t("wbPullUpstream")}: ${upstream}` : t("wbPullNoUpstream") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dgp-hint", children: t("wbPullHint") })
      ]
    }
  );
}

// src/client/settings.tsx
var import_react6 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var PERM_FILTERS = ["all", "full", "read", "none"];
function permKey(perm) {
  return perm === "full" ? "permFull" : perm === "read" ? "permRead" : "permNone";
}
function permFilterKey(filter) {
  return filter === "all" ? "filterAll" : permKey(filter);
}
function RepoRow({
  t,
  repo,
  permission,
  saving,
  onPermission
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-repo", "data-saving": saving ? "1" : "0", "data-perm": permission, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-repo-main", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-repo-name", title: repo.fullName, children: repo.fullName }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-repo-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: repo.private ? t("repoPrivate") : t("repoPublic") }),
        repo.defaultBranch ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
          "\xB7 ",
          fmt(t("repoDefaultBranch"), { branch: repo.defaultBranch })
        ] }) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-perm-seg", role: "group", "aria-label": `${t("permLabel")} ${repo.fullName}`, "data-saving": saving ? "1" : "0", children: REPO_PERMISSIONS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "button",
      {
        type: "button",
        "data-on": permission === item ? "1" : "0",
        "data-perm": item,
        disabled: saving,
        "aria-pressed": permission === item,
        onClick: () => onPermission(item),
        children: t(permKey(item))
      },
      item
    )) }),
    saving ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-perm-saving", children: t("permSaving") }) : null
  ] });
}
function AccountCard({
  t,
  account,
  isDefault,
  busy,
  reposState,
  search,
  filter,
  permissionOf,
  savingOf,
  onSearch,
  onFilter,
  onPermission,
  onReload,
  onEdit,
  onRecheck,
  onDisconnect,
  onSetDefault
}) {
  const all = reposState?.repos ?? [];
  const needle = search.trim().toLowerCase();
  const shown = all.filter((repo) => {
    if (needle && !repo.fullName.toLowerCase().includes(needle)) return false;
    if (filter === "all") return true;
    return permissionOf(repo.fullName) === filter;
  });
  const statusText = account.status === "connected" ? t("connected") : account.status === "expired" ? t("expired") : t("errored");
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-acct", "data-status": account.status, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-acct-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Dot, { state: account.status }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-acct-name", title: account.login, children: account.login || account.displayName || "(unknown)" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-badge", children: account.provider }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-badge", "data-tone": "mono", children: account.kind === "oauth" ? "OAuth" : "PAT" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-badge", "data-state": account.status, children: statusText }),
      isDefault ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-badge", "data-tone": "accent", children: t("isDefault") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-btn ghost", disabled: busy, onClick: onSetDefault, children: t("setDefault") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-acct-gap" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-btn ghost", disabled: busy, title: t("editHint"), onClick: onEdit, children: t("accountEdit") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-btn ghost", disabled: busy, onClick: onRecheck, children: t("recheck") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-line-sep", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-btn danger", disabled: busy, onClick: onDisconnect, children: t("disconnect") })
    ] }),
    account.host || account.scopes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-acct-meta", children: [
      account.host ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: account.host }) : null,
      account.scopes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: account.scopes.join(" ") }) : null
    ] }) : null,
    account.lastError ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-err", children: account.lastError }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-repos-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "input",
        {
          className: "dgp-input dgp-search",
          value: search,
          placeholder: t("repoSearch"),
          "aria-label": t("repoSearch"),
          onChange: (event) => onSearch(event.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-seg dgp-filter", role: "group", "aria-label": t("repoFilter"), children: PERM_FILTERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", "data-on": filter === item ? "1" : "0", onClick: () => onFilter(item), children: t(permFilterKey(item)) }, item)) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-repos-count", "aria-live": "polite", children: fmt(t("reposCount"), { n: shown.length, m: all.length }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "button",
        {
          type: "button",
          className: "dgp-btn ghost",
          onClick: onReload,
          "aria-label": t("reposReload"),
          title: t("reposReload"),
          children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(RefreshIcon, {})
        }
      )
    ] }),
    reposState?.loading && all.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { rows: 3 }) : null,
    !reposState?.loading && reposState?.error ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-err", children: [
      t("reposFailed"),
      "\uFF1A",
      reposState.error
    ] }) : null,
    !reposState?.loading && !reposState?.error && all.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { title: t("reposEmpty"), hint: t("reposEmptyHint") }) : null,
    all.length > 0 && shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: t("reposNoMatch") }) : null,
    shown.map((repo) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      RepoRow,
      {
        t,
        repo,
        permission: permissionOf(repo.fullName),
        saving: savingOf(repo.fullName),
        onPermission: (perm) => onPermission(repo.fullName, perm)
      },
      `${account.id}:${repo.fullName}`
    )),
    !reposState?.loading && !reposState?.error && reposState?.truncated ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: t("reposTruncated") }) : null
  ] });
}
function ConnectModal({
  t,
  providers,
  initial,
  onClose,
  onConnected
}) {
  const [provider, setProvider] = (0, import_react6.useState)(initial?.provider || "github");
  const [accountLabel, setAccountLabel] = (0, import_react6.useState)("");
  const [method, setMethod] = (0, import_react6.useState)(initial?.method ?? "pat");
  const [token, setToken] = (0, import_react6.useState)("");
  const [clientId, setClientId] = (0, import_react6.useState)("");
  const [host, setHost] = (0, import_react6.useState)(initial?.host || "");
  const [apiBase, setApiBase] = (0, import_react6.useState)(initial?.apiBase || "");
  const [flow, setFlow] = (0, import_react6.useState)(null);
  const [flowMsg, setFlowMsg] = (0, import_react6.useState)("");
  const [copied, setCopied] = (0, import_react6.useState)(false);
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)("");
  const timerRef = (0, import_react6.useRef)(null);
  const stopPolling = (0, import_react6.useCallback)(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  (0, import_react6.useEffect)(() => {
    return () => stopPolling();
  }, [stopPolling]);
  const pollOnce = (0, import_react6.useCallback)(
    async (pollKey, interval) => {
      try {
        const data = await api("/oauth/poll", { pollKey });
        if (data.status === "authorized") {
          stopPolling();
          setFlow(null);
          onConnected(data.state);
          return;
        }
        if (data.status === "denied" || data.status === "expired" || data.status === "error") {
          stopPolling();
          setFlow(null);
          setFlowMsg(data.error || t("authFailed"));
          return;
        }
        const wait = data.retryAfter > 0 ? data.retryAfter : interval;
        timerRef.current = window.setTimeout(() => void pollOnce(pollKey, interval), Math.max(wait, 3) * 1e3);
      } catch (err) {
        stopPolling();
        setFlowMsg(err instanceof Error ? err.message : String(err));
      }
    },
    [onConnected, stopPolling, t]
  );
  const startOAuth = async () => {
    setBusy(true);
    setError("");
    setFlowMsg("");
    try {
      const data = await api("/oauth/start", { provider, clientId, host, apiBase });
      if (!data.ok) {
        setError(data.error ?? t("authFailed"));
        return;
      }
      const pollKey = String(data.pollKey ?? "");
      setFlow({ pollKey, userCode: data.flow.userCode, verificationUri: data.flow.verificationUri, interval: data.flow.interval });
      setFlowMsg(t("waiting"));
      if (pollKey) {
        timerRef.current = window.setTimeout(() => void pollOnce(pollKey, data.flow.interval), Math.max(data.flow.interval, 3) * 1e3);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const connectPat = async () => {
    if (token.trim().length === 0) {
      setError(t("tokenRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api("/pat/connect", { provider, token, host, apiBase, label: accountLabel.trim() });
      if (!data.ok) {
        setError(data.error ?? t("connectFailed"));
        return;
      }
      setToken("");
      onConnected(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const currentProvider = (0, import_react6.useMemo)(() => providers.find((item) => item.id === provider), [providers, provider]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    Modal,
    {
      title: initial ? t("accountEdit") : t("connectAccount"),
      onClose: () => {
        stopPolling();
        onClose();
      },
      width: 520,
      children: [
        initial ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", style: { marginTop: 0 }, children: t("editHint") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("provider") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("select", { className: "dgp-select", value: provider, onChange: (event) => setProvider(event.target.value), children: (providers.length > 0 ? providers : [{ id: "github", label: "GitHub" }]).map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: item.id, children: item.label }, item.id)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("accountLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              className: "dgp-input",
              value: accountLabel,
              onChange: (event) => setAccountLabel(event.target.value),
              placeholder: t("accountLabelHint")
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("method") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-seg", role: "group", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", "data-on": method === "pat" ? "1" : "0", onClick: () => setMethod("pat"), children: t("pat") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", "data-on": method === "oauth" ? "1" : "0", onClick: () => setMethod("oauth"), children: t("oauth") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: method === "pat" ? currentProvider?.patHint ?? t("patPro") : currentProvider?.oauthHint ?? t("oauthPro") })
        ] }),
        provider === "gitea" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("hostLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { className: "dgp-input", value: host, placeholder: t("hostPlaceholder"), onChange: (event) => setHost(event.target.value) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("apiBaseLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { className: "dgp-input", value: apiBase, placeholder: t("apiBasePlaceholder"), onChange: (event) => setApiBase(event.target.value) })
          ] })
        ] }) : null,
        method === "pat" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("tokenLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              className: "dgp-input",
              type: "password",
              autoComplete: "off",
              spellCheck: false,
              value: token,
              placeholder: t("tokenPlaceholder"),
              onChange: (event) => setToken(event.target.value)
            }
          ),
          currentProvider?.patUrl ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("a", { className: "dgp-link", href: currentProvider.patUrl, target: "_blank", rel: "noreferrer noopener", children: currentProvider.patUrl }) }) : null
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("clientIdLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { className: "dgp-input", value: clientId, placeholder: "Iv1.xxxxxxxxxxxx", onChange: (event) => setClientId(event.target.value) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: t("clientIdHint") })
        ] }),
        flow ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", style: { marginTop: 0 }, children: t("userCode") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-code", children: flow.userCode }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("a", { className: "dgp-btn", href: flow.verificationUri, target: "_blank", rel: "noreferrer noopener", children: flow.verificationUri || "open" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "button",
              {
                type: "button",
                className: "dgp-btn",
                onClick: () => {
                  void navigator.clipboard?.writeText(flow.userCode);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                },
                children: copied ? t("copied") : t("copy")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "button",
              {
                type: "button",
                className: "dgp-btn ghost",
                onClick: () => {
                  stopPolling();
                  setFlow(null);
                  setFlowMsg("");
                },
                children: t("cancel")
              }
            )
          ] }),
          flowMsg ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: flowMsg }) : null
        ] }) : null,
        error ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-err", children: error }) : null,
        !flow && flowMsg ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-ok", children: flowMsg }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-row", style: { justifyContent: "flex-end", paddingTop: 14 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              className: "dgp-btn ghost",
              onClick: () => {
                stopPolling();
                onClose();
              },
              children: t("cancel")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              className: "dgp-btn primary",
              disabled: busy || method === "pat" && token.trim().length === 0 || method === "oauth" && Boolean(flow),
              onClick: () => void (method === "pat" ? connectPat() : startOAuth()),
              children: busy ? t("connecting") : t("connect")
            }
          )
        ] })
      ]
    }
  );
}
function AdvancedPanel({
  t,
  reposText,
  rootsText,
  allowWrite,
  requireConfirm,
  busy,
  savedTick,
  discovered,
  discovering,
  onReposText,
  onRootsText,
  onAllowWrite,
  onRequireConfirm,
  onSave,
  onDiscover,
  onUseRoot
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-adv", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-group-title", children: t("groupScopeRoots") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("scopeRoots") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "textarea",
          {
            className: "dgp-area",
            value: rootsText,
            onChange: (event) => onRootsText(event.target.value),
            placeholder: "D:\\work\\my-repo"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: t("scopeRootsHint") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-group-title", children: t("scopeDiscoverTitle") }),
      discovering ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { rows: 2 }) : discovered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", style: { padding: "2px 0 6px" }, children: t("scopeDiscoverEmpty") }) : discovered.map((repo) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-line", style: { padding: "9px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-line-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-name", children: repo.name }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-meta", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: repo.root }),
            repo.branch ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
              "\xB7 ",
              repo.branch
            ] }) : null,
            repo.remotes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
              "\xB7 ",
              repo.remotes.join(", ")
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
              "\xB7 ",
              t("scopeDiscoverNoRemote")
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-line-side", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => onUseRoot(repo.root), children: t("scopeDiscoverUse") }) })
      ] }, repo.root)),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-line-side", style: { paddingTop: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { type: "button", className: "dgp-btn ghost", onClick: onDiscover, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(RefreshIcon, {}),
        t("scopeDiscoverReload")
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-group-title", children: t("groupScopeRepos") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "dgp-label", children: t("scopeRepos") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "textarea",
          {
            className: "dgp-area",
            value: reposText,
            onChange: (event) => onReposText(event.target.value),
            placeholder: "owner/repo\nanother-owner/another-repo"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: t("scopeReposHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", children: t("scopeReposNote") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-group-title", children: t("groupPolicy") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: "dgp-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: allowWrite, onChange: (event) => onAllowWrite(event.target.checked) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-check-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-check-title", children: t("allowWrite") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-hint", style: { marginTop: 0 }, children: t("allowWriteHint") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: "dgp-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: requireConfirm, onChange: (event) => onRequireConfirm(event.target.checked) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-check-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-check-title", children: t("requireConfirm") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-hint", style: { marginTop: 0 }, children: t("requireConfirmHint") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-row", style: { paddingTop: 12 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-btn primary", disabled: busy, onClick: onSave, children: t("save") }),
        savedTick > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-ok", style: { marginTop: 0 }, children: t("saved") }) : null
      ] })
    ] })
  ] });
}
function GitSection({ t }) {
  useStyles();
  const [state, setState] = (0, import_react6.useState)(null);
  const [providers, setProviders] = (0, import_react6.useState)([]);
  const [error, setError] = (0, import_react6.useState)("");
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [advanced, setAdvanced] = (0, import_react6.useState)(false);
  const [connectOpen, setConnectOpen] = (0, import_react6.useState)(false);
  const [editTarget, setEditTarget] = (0, import_react6.useState)(null);
  const [reposText, setReposText] = (0, import_react6.useState)("");
  const [rootsText, setRootsText] = (0, import_react6.useState)("");
  const [allowWrite, setAllowWrite] = (0, import_react6.useState)(false);
  const [requireConfirm, setRequireConfirm] = (0, import_react6.useState)(true);
  const [savedTick, setSavedTick] = (0, import_react6.useState)(0);
  const [toast, setToast] = (0, import_react6.useState)(null);
  const [discovered, setDiscovered] = (0, import_react6.useState)([]);
  const [discovering, setDiscovering] = (0, import_react6.useState)(false);
  const [accountRepos, setAccountRepos] = (0, import_react6.useState)({});
  const [permSaving, setPermSaving] = (0, import_react6.useState)({});
  const [permOverride, setPermOverride] = (0, import_react6.useState)({});
  const [reposFetchedAt, setReposFetchedAt] = (0, import_react6.useState)({});
  const [search, setSearch] = (0, import_react6.useState)({});
  const [filter, setFilter] = (0, import_react6.useState)({});
  const toastTimerRef = (0, import_react6.useRef)(null);
  const showToast = (0, import_react6.useCallback)((tone, text) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ tone, text });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  (0, import_react6.useEffect)(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);
  const applyState = (0, import_react6.useCallback)((next) => {
    setState(next);
    setReposText(next.settings.allowedRepos.join("\n"));
    setRootsText(next.settings.allowedRoots.join("\n"));
    setAllowWrite(next.settings.allowWrite);
    setRequireConfirm(next.settings.requireConfirm);
  }, []);
  const load = (0, import_react6.useCallback)(async () => {
    try {
      const data = await api("/state");
      if (!data.ok) {
        setError(data.error ?? t("errLoad"));
        return;
      }
      setError("");
      setProviders(data.providers ?? []);
      applyState(data.state);
    } catch (err) {
      setError(t("errLoad") + "\uFF1A" + (err instanceof Error ? err.message : String(err)));
    }
  }, [applyState, t]);
  (0, import_react6.useEffect)(() => {
    void load();
  }, [load]);
  const loadAccountRepos = (0, import_react6.useCallback)(
    async (accountId) => {
      setAccountRepos((prev) => ({
        ...prev,
        [accountId]: { loading: true, error: "", repos: prev[accountId]?.repos ?? [], truncated: prev[accountId]?.truncated }
      }));
      try {
        const data = await api(
          `/account/repos?accountId=${encodeURIComponent(accountId)}`
        );
        if (!data.ok) {
          setAccountRepos((prev) => ({
            ...prev,
            [accountId]: { loading: false, error: data.error || t("reposFailed"), repos: [] }
          }));
          return;
        }
        setAccountRepos((prev) => ({
          ...prev,
          [accountId]: {
            loading: false,
            error: "",
            repos: Array.isArray(data.repos) ? data.repos : [],
            truncated: data.truncated === true
          }
        }));
        setReposFetchedAt((prev) => ({ ...prev, [accountId]: Date.now() }));
      } catch (err) {
        setAccountRepos((prev) => ({
          ...prev,
          [accountId]: { loading: false, error: err instanceof Error ? err.message : t("reposFailed"), repos: [] }
        }));
      }
    },
    [t]
  );
  const accounts = state?.accounts ?? [];
  (0, import_react6.useEffect)(() => {
    for (const account of accounts) {
      const cached = accountRepos[account.id];
      if (!cached) void loadAccountRepos(account.id);
    }
  }, [accounts, accountRepos, loadAccountRepos]);
  const dropAccountCache = (0, import_react6.useCallback)((accountId) => {
    setAccountRepos((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
    setReposFetchedAt((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
    setPermOverride((prev) => {
      const next = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith(`${accountId}:`)) next[key] = value;
      }
      return next;
    });
  }, []);
  const currentPermission = (0, import_react6.useCallback)(
    (accountId, repoFullName) => {
      const override = permOverride[`${accountId}:${repoFullName}`];
      if (override) return override;
      const hit = (accountRepos[accountId]?.repos ?? []).find((item) => item.fullName === repoFullName);
      return hit?.permission ?? "full";
    },
    [permOverride, accountRepos]
  );
  const permissionSaving = (0, import_react6.useCallback)(
    (accountId, repoFullName) => permSaving[`${accountId}:${repoFullName}`] === true,
    [permSaving]
  );
  const saveRepoPermission = (0, import_react6.useCallback)(
    async (accountId, repoFullName, perm) => {
      const key = `${accountId}:${repoFullName}`;
      const previous = currentPermission(accountId, repoFullName);
      if (previous === perm) return;
      setPermOverride((prev) => ({ ...prev, [key]: perm }));
      setPermSaving((prev) => ({ ...prev, [key]: true }));
      try {
        const data = await api("/repo/permission", {
          accountId,
          repo: repoFullName,
          permission: perm
        });
        if (data.state) setState(data.state);
        if (data.ok) {
          showToast("ok", t("permSaved"));
        } else {
          setPermOverride((prev) => ({ ...prev, [key]: previous }));
          showToast("error", data.error || t("permSaveFailed"));
        }
      } catch (err) {
        setPermOverride((prev) => ({ ...prev, [key]: previous }));
        showToast("error", `${t("permSaveFailed")}\uFF1A${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setPermSaving((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [currentPermission, showToast, t]
  );
  const loadDiscovered = (0, import_react6.useCallback)(async () => {
    setDiscovering(true);
    try {
      const data = await api(
        "/repo/discover"
      );
      setDiscovered(data.ok && Array.isArray(data.repos) ? data.repos : []);
    } catch {
      setDiscovered([]);
    } finally {
      setDiscovering(false);
    }
  }, []);
  (0, import_react6.useEffect)(() => {
    if (!advanced) return;
    void loadDiscovered();
  }, [advanced, loadDiscovered]);
  const addRoot = (0, import_react6.useCallback)((root) => {
    setRootsText((prev) => {
      const lines = prev.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.includes(root)) return prev;
      lines.push(root);
      return lines.join("\n");
    });
  }, []);
  const disconnect = async (id) => {
    if (!window.confirm(t("removeConfirm"))) return;
    setBusy(true);
    try {
      const data = await api("/accounts/remove", { id });
      if (data.state) applyState(data.state);
      if (!data.ok && data.error) {
        showToast("error", data.error);
      } else {
        dropAccountCache(id);
        showToast("ok", t("toastSaved"));
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const recheck = async (id) => {
    setBusy(true);
    try {
      const data = await api("/accounts/recheck", { id });
      if (data.state) applyState(data.state);
      if (!data.ok && data.error) {
        showToast("error", data.error);
      } else {
        showToast("ok", t("toastRecheck"));
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const setDefaultAccount = async (id) => {
    setBusy(true);
    try {
      const data = await api("/settings", { defaultAccountId: id });
      if (data.state) applyState(data.state);
      if (data.ok) {
        showToast("ok", t("toastDefault"));
      } else {
        showToast("error", data.error ?? t("errLoad"));
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const saveScope = async () => {
    setBusy(true);
    try {
      const data = await api("/settings", {
        allowedRepos: reposText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        allowedRoots: rootsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        allowWrite,
        requireConfirm
      });
      if (data.state) applyState(data.state);
      if (data.ok) {
        setSavedTick((value) => value + 1);
        showToast("ok", t("toastSaved"));
      } else {
        showToast("error", data.error ?? t("errLoad"));
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const settings = state?.settings;
  const connectedCount = accounts.filter((item) => item.status === "connected").length;
  const unhealthyCount = accounts.filter((item) => item.status !== "connected").length;
  const roots = settings?.allowedRoots ?? [];
  const allowAllRoots = roots.includes("*");
  const allowAllRepos = (settings?.allowedRepos ?? []).includes("*");
  const defaultAccountId = settings?.defaultAccountId ?? "";
  const permTables = Object.values(settings?.repoPermissions ?? {});
  const perAccountGrants = permTables.reduce(
    (sum, table) => sum + Object.values(table ?? {}).filter((perm) => perm !== "none").length,
    0
  );
  const hasPermTable = permTables.some((table) => Object.keys(table ?? {}).length > 0);
  const repoGrantCount = allowAllRepos ? Infinity : (settings?.allowedRepos ?? []).length + perAccountGrants;
  const primaryState = accounts.find((item) => item.status === "connected")?.status ?? accounts[0]?.status;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-root dgp-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Dot, { state: primaryState }),
          t("panelTitle")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-sub", children: t("panelSubtitle") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-line-side", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "button",
        {
          type: "button",
          className: "dgp-btn primary",
          onClick: () => {
            setEditTarget(null);
            setConnectOpen(true);
          },
          children: t("connectAccount")
        }
      ) })
    ] }),
    error ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-err", children: error }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-overview", role: "group", "aria-label": t("statsTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-overview-item", "data-tone": unhealthyCount > 0 ? "warn" : connectedCount > 0 ? "ok" : "neutral", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-label", children: t("statsAccounts") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-num", children: accounts.length }),
        unhealthyCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-hint", children: fmt(t("statsAccountsHintMixed"), { n: connectedCount, m: unhealthyCount }) }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-sep", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-overview-item", "data-tone": allowAllRoots ? "warn" : roots.length > 0 ? "ok" : "neutral", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-label", children: t("statsRoots") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-num", children: allowAllRoots ? "\u221E" : roots.length })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-sep", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-overview-item", "data-tone": allowAllRepos ? "warn" : repoGrantCount > 0 ? "ok" : "neutral", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-label", children: t("statsRepos") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-num", children: allowAllRepos ? "\u221E" : repoGrantCount }),
        hasPermTable && !allowAllRepos ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-hint", children: t("statsReposHintDefault") }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-sep", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-overview-item", "data-tone": settings?.allowWrite ? "warn" : "ok", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-label", children: t("statsWrite") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-overview-num", children: settings?.allowWrite ? t("statsWriteOn") : t("statsWriteOff") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-acct-gap" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "button",
        {
          type: "button",
          className: "dgp-btn ghost",
          "aria-expanded": advanced,
          onClick: () => setAdvanced((value) => !value),
          children: advanced ? t("advancedHide") : t("advancedShow")
        }
      )
    ] }),
    accounts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { title: t("noAccount"), hint: t("noAccountHint") }) : accounts.map((account) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      AccountCard,
      {
        t,
        account,
        isDefault: defaultAccountId === account.id,
        busy,
        reposState: accountRepos[account.id],
        search: search[account.id] ?? "",
        filter: filter[account.id] ?? "all",
        permissionOf: (repoFullName) => currentPermission(account.id, repoFullName),
        savingOf: (repoFullName) => permissionSaving(account.id, repoFullName),
        onSearch: (value) => setSearch((prev) => ({ ...prev, [account.id]: value })),
        onFilter: (value) => setFilter((prev) => ({ ...prev, [account.id]: value })),
        onPermission: (repoFullName, perm) => void saveRepoPermission(account.id, repoFullName, perm),
        onReload: () => void loadAccountRepos(account.id),
        onEdit: () => {
          setEditTarget({
            provider: account.provider,
            host: account.host || "",
            apiBase: account.apiBase || "",
            method: account.kind === "oauth" ? "oauth" : "pat",
            login: account.login || ""
          });
          setConnectOpen(true);
        },
        onRecheck: () => void recheck(account.id),
        onDisconnect: () => void disconnect(account.id),
        onSetDefault: () => void setDefaultAccount(account.id)
      },
      account.id
    )),
    advanced ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      AdvancedPanel,
      {
        t,
        reposText,
        rootsText,
        allowWrite,
        requireConfirm,
        busy,
        savedTick,
        discovered,
        discovering,
        onReposText: setReposText,
        onRootsText: setRootsText,
        onAllowWrite: setAllowWrite,
        onRequireConfirm: setRequireConfirm,
        onSave: () => void saveScope(),
        onDiscover: () => void loadDiscovered(),
        onUseRoot: addRoot
      }
    ) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-adv", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-hint", style: { marginTop: 0, lineHeight: "20px" }, children: t("helpText") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-sep" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dl", { className: "dgp-kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: t("oauth") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: t("oauthPro") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: t("pat") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: t("patPro") })
      ] })
    ] }) }),
    connectOpen ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ConnectModal,
      {
        t,
        providers,
        initial: editTarget,
        onClose: () => {
          setConnectOpen(false);
          setEditTarget(null);
        },
        onConnected: (next) => {
          if (next) applyState(next);
          else void load();
          setConnectOpen(false);
          setEditTarget(null);
          setAccountRepos({});
          showToast("ok", t("toastSaved"));
        }
      }
    ) : null,
    toast ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Toast, { tone: toast.tone, text: toast.text, onDone: () => setToast(null) }) : null
  ] });
}

// src/client/onboard.tsx
var import_react7 = require("react");
var import_jsx_runtime7 = require("react/jsx-runtime");
function InitWizard({ t, cwd, accounts, authorizedRepos, onQuickInit, onClose, onDone }) {
  const [accountId, setAccountId] = (0, import_react7.useState)("");
  const [repos, setRepos] = (0, import_react7.useState)([]);
  const [reposLoading, setReposLoading] = (0, import_react7.useState)(false);
  const [reposError, setReposError] = (0, import_react7.useState)("");
  const [remoteMode, setRemoteMode] = (0, import_react7.useState)("existing");
  const [repoFullName, setRepoFullName] = (0, import_react7.useState)("");
  const [remoteUrl, setRemoteUrl] = (0, import_react7.useState)("");
  const [branchName, setBranchName] = (0, import_react7.useState)("main");
  const [commitMessage, setCommitMessage] = (0, import_react7.useState)("");
  const [busy, setBusy] = (0, import_react7.useState)(false);
  const [error, setError] = (0, import_react7.useState)("");
  const [result, setResult] = (0, import_react7.useState)(null);
  const [createOpen, setCreateOpen] = (0, import_react7.useState)(false);
  const [createName, setCreateName] = (0, import_react7.useState)("");
  const [createPrivate, setCreatePrivate] = (0, import_react7.useState)(true);
  const [createBusy, setCreateBusy] = (0, import_react7.useState)(false);
  const [createError, setCreateError] = (0, import_react7.useState)("");
  (0, import_react7.useEffect)(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);
  (0, import_react7.useEffect)(() => {
    if (!accountId) {
      setRepos([]);
      return;
    }
    let alive = true;
    setReposLoading(true);
    setReposError("");
    api(`/account/repos?accountId=${encodeURIComponent(accountId)}`).then((data) => {
      if (!alive) return;
      if (!data.ok) {
        setRepos([]);
        setReposError(data.error || t("reposFailed"));
        return;
      }
      setRepos(Array.isArray(data.repos) ? data.repos : []);
    }).catch((err) => {
      if (!alive) return;
      setRepos([]);
      setReposError(err.message || t("reposFailed"));
    }).finally(() => {
      if (alive) setReposLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [accountId, t]);
  const selectedRepo = repos.find((item) => item.fullName === repoFullName);
  const manualRepos = accountId ? authorizedRepos(accountId) : [];
  const defaultBranch = selectedRepo?.defaultBranch || "main";
  (0, import_react7.useEffect)(() => {
    if (branchName === "" || branchName === "main" || branchName === defaultBranch) setBranchName(defaultBranch);
  }, [defaultBranch]);
  const remoteReady = remoteMode === "existing" ? repoFullName.trim() !== "" : remoteUrl.trim() !== "";
  const canSubmit = accountId !== "" && remoteReady && branchName.trim() !== "" && !busy && !result;
  const runBootstrap = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/repo/bootstrap", {
        cwd,
        accountId,
        remoteMode,
        ...remoteMode === "existing" ? { repoFullName: repoFullName.trim() } : { remoteUrl: remoteUrl.trim() },
        branchMode: "new",
        branchName: branchName.trim(),
        ...commitMessage.trim() ? { initialCommitMessage: commitMessage.trim() } : {}
      });
      if (!data.ok) {
        setError(data.error || t("initFailed"));
        return;
      }
      setResult({
        root: data.root ?? cwd,
        branch: data.branch ?? branchName.trim(),
        remoteName: data.remoteName ?? "origin",
        remoteUrl: data.remoteUrl ?? (remoteMode === "new" ? remoteUrl.trim() : ""),
        steps: Array.isArray(data.steps) ? data.steps : []
      });
      onDone();
    } catch (err) {
      setError(err.message || t("initFailed"));
    } finally {
      setBusy(false);
    }
  };
  const runCreateRepo = async () => {
    setCreateBusy(true);
    setCreateError("");
    try {
      const data = await api("/repo/create", {
        cwd,
        accountId,
        name: createName.trim(),
        private: createPrivate
      });
      if (!data.ok || !data.repo) {
        setCreateError(data.error || t("repoCreateFailed"));
        return;
      }
      const created = {
        fullName: data.repo.fullName,
        name: data.repo.name,
        owner: data.repo.fullName.split("/").slice(0, -1).join("/"),
        url: data.repo.url,
        private: data.repo.private,
        defaultBranch: data.repo.defaultBranch,
        permission: "full"
      };
      setRepos((prev) => prev.some((item) => item.fullName === created.fullName) ? prev : [created, ...prev]);
      setRemoteMode("existing");
      setRepoFullName(created.fullName);
      setRemoteUrl(created.url);
      setCreateOpen(false);
      setCreateName("");
    } catch (err) {
      setCreateError(err.message || t("repoCreateFailed"));
    } finally {
      setCreateBusy(false);
    }
  };
  if (accounts.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      Modal,
      {
        title: t("initTitle"),
        onClose,
        width: 480,
        footer: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-btn", onClick: onClose, children: t("initCancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-btn primary", disabled: busy, onClick: onQuickInit, children: t("initQuickLocal") })
        ] }),
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(EmptyState, { title: t("initNoAccount"), hint: t("initManualRepoHint") })
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    Modal,
    {
      title: t("initTitle"),
      onClose,
      width: 860,
      footer: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-btn", onClick: onClose, children: t("initCancel") }),
        result ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-btn primary", onClick: onClose, children: t("initClose") }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-btn primary", disabled: !canSubmit, onClick: () => void runBootstrap(), children: busy ? t("initRunning") : t("initStart") })
      ] }),
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-iw", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-iw-left", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "dgp-iw-sect", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-iw-secthead", children: t("initStepAccount") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { className: "dgp-options", children: accounts.map((account) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "dgp-option", "data-on": accountId === account.id ? "1" : "0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "input",
                {
                  type: "radio",
                  name: "dgp-iw-account",
                  checked: accountId === account.id,
                  onChange: () => {
                    setAccountId(account.id);
                    setRepoFullName("");
                    setRemoteMode("existing");
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-option-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-option-title", children: account.login || account.displayName || account.id }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-option-hint", children: [
                  account.provider,
                  " \xB7 ",
                  account.kind === "oauth" ? "OAuth" : "PAT",
                  " \xB7 ",
                  account.status
                ] })
              ] })
            ] }) }, account.id)) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "dgp-iw-sect", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-iw-secthead", children: t("initStepRemote") }),
            reposLoading ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Skeleton, { rows: 2 }) : null,
            !reposLoading && reposError ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-err", children: fmt(t("initRepoListFailed"), { reason: reposError }) }) : null,
            !reposLoading && !reposError && repos.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-hint", children: t("initRepoListEmpty") }) : null,
            !reposLoading && repos.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { className: "dgp-options", children: repos.slice(0, 30).map((repo) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "dgp-option", "data-on": remoteMode === "existing" && repoFullName === repo.fullName ? "1" : "0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "input",
                {
                  type: "radio",
                  name: "dgp-iw-repo",
                  checked: remoteMode === "existing" && repoFullName === repo.fullName,
                  onChange: () => {
                    setRemoteMode("existing");
                    setRepoFullName(repo.fullName);
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-option-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-option-title", children: repo.fullName }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-option-hint", children: [
                  repo.private ? t("repoPrivate") : t("repoPublic"),
                  " \xB7",
                  " ",
                  fmt(t("repoDefaultBranch"), { branch: repo.defaultBranch || "-" })
                ] })
              ] })
            ] }) }, repo.fullName)) }) : null,
            !reposLoading && manualRepos.length > 0 && repos.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { className: "dgp-options", children: manualRepos.map((fullName) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "dgp-option", "data-on": remoteMode === "existing" && repoFullName === fullName ? "1" : "0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "input",
                {
                  type: "radio",
                  name: "dgp-iw-repo-manual",
                  checked: remoteMode === "existing" && repoFullName === fullName,
                  onChange: () => {
                    setRemoteMode("existing");
                    setRepoFullName(fullName);
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-option-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-option-title", children: fullName }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-option-hint", children: t("initAuthorizedRepos") })
              ] })
            ] }) }, fullName)) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-iw-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dgp-gw-textbtn",
                  "data-on": remoteMode === "new" ? "1" : "0",
                  onClick: () => setRemoteMode(remoteMode === "new" ? "existing" : "new"),
                  children: [
                    remoteMode === "new" ? "\u2713 " : "+ ",
                    t("initNewRemote")
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dgp-gw-textbtn",
                  "data-on": createOpen ? "1" : "0",
                  onClick: () => {
                    setCreateOpen(!createOpen);
                    setCreateError("");
                    if (!createOpen && !createName) {
                      const guess = cwd.split(/[\\/]/).filter(Boolean).pop() || "";
                      setCreateName(guess);
                    }
                  },
                  children: [
                    createOpen ? "\u2713 " : "+ ",
                    t("repoCreateOpen")
                  ]
                }
              )
            ] }),
            createOpen ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-iw-create", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "input",
                {
                  className: "dgp-input",
                  value: createName,
                  onChange: (event) => setCreateName(event.target.value),
                  placeholder: t("repoCreateName"),
                  "aria-label": t("repoCreateName")
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "dgp-check", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "checkbox", checked: createPrivate, onChange: (event) => setCreatePrivate(event.target.checked) }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t("repoCreatePrivate") })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "button",
                {
                  type: "button",
                  className: "dgp-btn primary",
                  disabled: createBusy || createName.trim() === "" || accountId === "",
                  onClick: () => void runCreateRepo(),
                  children: createBusy ? t("repoCreating") : t("repoCreateSubmit")
                }
              )
            ] }) : null,
            createOpen ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-hint", children: fmt(t("repoCreateHint"), { account: accounts.find((item) => item.id === accountId)?.login || "-" }) }) : null,
            createOpen && createError ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-err", children: createError }) : null,
            remoteMode === "new" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "dgp-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-label", children: t("initRemoteUrl") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: "dgp-input", value: remoteUrl, onChange: (event) => setRemoteUrl(event.target.value), placeholder: "https://github.com/user/repo.git" }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-hint", children: t("initRemoteUrlHint") })
            ] }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "dgp-iw-sect", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-iw-secthead", children: t("initStepBranch") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-iw-grid2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "dgp-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-label", children: t("initBranchName") }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: "dgp-input", value: branchName, onChange: (event) => setBranchName(event.target.value), placeholder: defaultBranch })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "dgp-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-label", children: t("initCommitMessage") }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: "dgp-input", value: commitMessage, onChange: (event) => setCommitMessage(event.target.value), placeholder: "chore: init" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-hint", children: t("initNoBranches") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("aside", { className: "dgp-iw-right", children: [
          error ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-iw-secthead", "data-tone": "error", children: t("initFailed") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-err", children: error })
          ] }) : null,
          result ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-iw-secthead", "data-tone": "ok", children: t("initSuccess") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dl", { className: "dgp-kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: t("initResultRoot") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: result.root }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: t("initResultBranch") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: result.branch }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: t("initResultRemote") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: result.remoteUrl || "-" })
            ] }),
            result.steps.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-iw-secthead", children: t("initStepsTitle") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { className: "dgp-plan", children: result.steps.map((step) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: step }, step)) })
            ] }) : null
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-iw-secthead", children: t("initConfirmTitle") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("ul", { className: "dgp-plan", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: t("initPlanInit") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("li", { children: [
                t("initPlanRemote"),
                remoteMode === "existing" ? repoFullName.trim() ? ` \xB7 ${repoFullName.trim()}` : "" : remoteUrl.trim() ? ` \xB7 ${remoteUrl.trim()}` : ""
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: fmt(t("initPlanBranch"), { branch: branchName.trim() || defaultBranch }) }),
              commitMessage.trim() ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: t("initPlanCommit") }) : null
            ] }),
            !remoteReady ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-hint", children: t("initRepoRequired") }) : null
          ] })
        ] })
      ] })
    }
  );
}
function BranchDetailModal({ t, cwd, branch, onClose }) {
  const [commits, setCommits] = (0, import_react7.useState)([]);
  const [loading, setLoading] = (0, import_react7.useState)(true);
  const [error, setError] = (0, import_react7.useState)("");
  const [truncated, setTruncated] = (0, import_react7.useState)(false);
  (0, import_react7.useEffect)(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api(
      `/repo/commits?cwd=${encodeURIComponent(cwd)}&ref=${encodeURIComponent(branch)}`
    ).then((data) => {
      if (!alive) return;
      if (!data.ok) {
        setError(data.error || t("branchDetailFailed"));
        setCommits([]);
        return;
      }
      setCommits(Array.isArray(data.commits) ? data.commits : []);
      setTruncated(data.truncated === true);
    }).catch((err) => {
      if (!alive) return;
      setError(err.message || t("branchDetailFailed"));
      setCommits([]);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [cwd, branch, t]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    Modal,
    {
      title: `${t("branchDetailTitle")} \xB7 ${branch}`,
      onClose,
      width: 620,
      footer: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-btn", onClick: onClose, children: t("branchDetailClose") }),
      children: [
        loading ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Skeleton, { rows: 5 }) : null,
        !loading && error ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-err", children: [
          t("branchDetailFailed"),
          "\uFF1A",
          error
        ] }) : null,
        !loading && !error && commits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(EmptyState, { title: t("branchDetailEmpty"), hint: t("branchDetailEmptyHint") }) : null,
        !loading && !error && commits.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ol", { className: "dgp-tl", children: commits.map((commit, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("li", { className: "dgp-tl-item", "data-first": index === 0 ? "1" : "0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-tl-node", "aria-hidden": "true" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-tl-main", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-tl-subject", title: commit.subject, children: commit.subject || "(no subject)" }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-tl-meta", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { className: "dgp-tl-hash", children: commit.shortHash || commit.hash.slice(0, 7) }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-tl-author", children: commit.author }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("time", { className: "dgp-tl-date", children: commit.date })
              ] })
            ] })
          ] }, commit.hash || commit.shortHash)) }),
          truncated ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-hint", children: fmt(t("branchDetailTruncated"), { n: commits.length }) }) : null
        ] }) : null
      ]
    }
  );
}

// src/client/index.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "locale", "shortcuts"];
var BUILD = "dgp-v19";
var ZH = {
  entry: "Git",
  entryTitle: "\u5F53\u524D\u4ED3\u5E93\u72B6\u6001",
  navLabel: "Git",
  panelTitle: "Git \u8D26\u53F7\u4E0E\u4ED3\u5E93\u6388\u6743",
  panelSubtitle: "\u8FDE\u63A5\u8D26\u53F7\uFF0C\u5E76\u9650\u5B9A Agent \u53EF\u4EE5\u89E6\u8FBE\u7684\u4ED3\u5E93\u4E0E\u76EE\u5F55",
  accountLabel: "\u8D26\u53F7\u5907\u6CE8\u540D\uFF08\u53EF\u9009\uFF09",
  accountLabelHint: "\u540C\u4E00\u5E73\u53F0\u591A\u4E2A\u8D26\u53F7\u65F6\u7528\u4E8E\u533A\u5206\uFF0C\u5982\u300C\u5DE5\u4F5C\u300D\u300C\u4E2A\u4EBA\u300D",
  groupScopeRepos: "\u8FDC\u7AEF\u4ED3\u5E93",
  groupScopeRoots: "\u672C\u5730\u76EE\u5F55",
  groupPolicy: "\u5199\u64CD\u4F5C\u7B56\u7565",
  noAccount: "\u5C1A\u672A\u8FDE\u63A5\u4EFB\u4F55 Git \u8D26\u53F7",
  noAccountHint: "\u8FDE\u63A5\u540E\uFF0CAgent \u624D\u80FD\u5728\u6388\u6743\u8303\u56F4\u5185\u8BFB\u53D6\u4ED3\u5E93\u4FE1\u606F\u3001\u5206\u652F\u3001\u5DEE\u5F02\u4E0E\u63D0\u4EA4\u8BB0\u5F55\u3002",
  connected: "\u5DF2\u8FDE\u63A5",
  expired: "\u6388\u6743\u5DF2\u5931\u6548",
  errored: "\u51ED\u636E\u5F02\u5E38",
  disconnect: "\u65AD\u5F00",
  recheck: "\u6821\u9A8C",
  provider: "\u5E73\u53F0",
  method: "\u63A5\u5165\u65B9\u5F0F",
  oauth: "OAuth \u8BBE\u5907\u7801",
  pat: "\u4E2A\u4EBA\u8BBF\u95EE\u4EE4\u724C\uFF08PAT\uFF09",
  oauthPro: "\u9002\u5408\u672C\u673A\u4EA4\u4E92\u5F0F\u4F7F\u7528\uFF1A\u6D4F\u89C8\u5668\u6253\u5F00\u4E00\u6B21\u6388\u6743\u9875\u3001\u8F93\u5165\u4EE3\u7801\u5373\u53EF\uFF0C\u4E0D\u9700\u8981\u590D\u5236\u4EE4\u724C\uFF0C\u6743\u9650\u7531\u5E73\u53F0\u6388\u6743\u9875\u63A7\u5236\u3002",
  patPro: "\u9002\u5408\u65E0\u4EBA\u503C\u5B88/CI/\u81EA\u5EFA\u5B9E\u4F8B\uFF1A\u53EF\u7CBE\u786E\u9650\u5236\u5230\u5355\u4E2A\u4ED3\u5E93\u4E0E\u53EA\u8BFB scope\uFF0C\u4EE4\u724C\u53EA\u5728\u672C\u673A\u52A0\u5BC6\u4FDD\u5B58\u3002",
  tokenLabel: "\u8BBF\u95EE\u4EE4\u724C",
  tokenPlaceholder: "\u7C98\u8D34 PAT\uFF08\u4EC5\u672C\u6B21\u63D0\u4EA4\uFF0C\u4FDD\u5B58\u540E\u4E0D\u518D\u56DE\u663E\uFF09",
  clientIdLabel: "OAuth App Client ID",
  clientIdHint: "\u9700\u8981\u4F60\u5728\u5E73\u53F0\u4E0A\u81EA\u5EFA OAuth App \u5E76\u586B\u5165\u5176 Client ID\uFF1B\u672C\u63D2\u4EF6\u4E0D\u5185\u7F6E\u4EFB\u4F55\u7B2C\u4E09\u65B9\u5E94\u7528\u51ED\u636E\u3002",
  hostLabel: "\u5B9E\u4F8B\u5730\u5740\uFF08\u81EA\u5EFA\u65F6\u586B\uFF09",
  hostPlaceholder: "\u4F8B\u5982 git.example.com",
  apiBaseLabel: "API \u5730\u5740\uFF08\u53EF\u9009\uFF09",
  apiBasePlaceholder: "\u4F8B\u5982 https://git.example.com/api/v1",
  connect: "\u8FDE\u63A5",
  connecting: "\u8FDE\u63A5\u4E2D\u2026",
  cancel: "\u53D6\u6D88",
  save: "\u4FDD\u5B58\u8303\u56F4",
  saved: "\u5DF2\u4FDD\u5B58",
  scopeRepos: "\u5141\u8BB8 Agent \u64CD\u4F5C\u7684\u8FDC\u7AEF\u4ED3\u5E93",
  scopeReposHint: "\u6BCF\u884C\u4E00\u4E2A owner/repo\uFF1B\u586B * \u8868\u793A\u5168\u90E8\u4ED3\u5E93\uFF08\u4E0D\u63A8\u8350\uFF09\u3002\u7559\u7A7A\u8868\u793A\u4E0D\u5141\u8BB8\u4EFB\u4F55\u8FDC\u7AEF\u64CD\u4F5C\u3002",
  scopeReposNote: "\u8FD9\u91CC\u662F\u5168\u5C40\u515C\u5E95\u540D\u5355\uFF1A\u53EA\u6709\u8FD8\u6CA1\u6709\u8D26\u53F7\u7EA7\u6743\u9650\u8868\u7684\u8D26\u53F7\uFF08\u8001\u8D26\u53F7/\u521A\u5347\u7EA7\uFF09\u624D\u6309\u5B83\u5224\u5B9A\uFF1B\u8D26\u53F7\u9875\u91CC\u9010\u4ED3\u5E93\u8BBE\u8FC7\u6863\u4F4D\u7684\uFF0C\u4EE5\u8D26\u53F7\u9875\u4E3A\u51C6\u3002",
  scopeRoots: "\u5141\u8BB8 Agent \u64CD\u4F5C\u7684\u672C\u5730\u4ED3\u5E93\u76EE\u5F55",
  scopeDiscoverTitle: "\u68C0\u6D4B\u5230\u7684\u4ED3\u5E93",
  scopeDiscoverEmpty: "\u6388\u6743\u6839\u76EE\u5F55\u4E0B\u6682\u672A\u626B\u63CF\u5230 Git \u4ED3\u5E93\uFF08\u4FDD\u5B58\u6388\u6743\u76EE\u5F55\u540E\u70B9\u300C\u91CD\u65B0\u626B\u63CF\u300D\uFF09",
  scopeDiscoverNoRemote: "\u65E0\u8FDC\u7A0B",
  scopeDiscoverUse: "\u52A0\u5165\u6388\u6743",
  scopeDiscoverReload: "\u91CD\u65B0\u626B\u63CF",
  scopeRootsHint: "\u6BCF\u884C\u4E00\u4E2A\u7EDD\u5BF9\u8DEF\u5F84\u3002\u672C\u5730 git \u547D\u4EE4\u53EA\u4F1A\u5728\u8FD9\u4E9B\u76EE\u5F55\uFF08\u542B\u5B50\u76EE\u5F55\uFF09\u5185\u6267\u884C\uFF1B\u586B * \u8868\u793A\u4E0D\u9650\u5236\u76EE\u5F55\uFF08\u7B49\u540C\u4E8E\u653E\u5F00\u672C\u673A\u5168\u90E8\u4ED3\u5E93\uFF0C\u8C28\u614E\u4F7F\u7528\uFF09\u3002",
  allowWrite: "\u5141\u8BB8 Agent \u4FEE\u6539\u4ED3\u5E93",
  allowWriteHint: "\u8FD9\u662F\u5199\u64CD\u4F5C\u7684\u552F\u4E00\u603B\u5F00\u5173\uFF1A\u5F00\u542F\u540E Agent \u4E0E\u672C\u9875\u6309\u94AE\u90FD\u80FD\u6682\u5B58\u3001\u63D0\u4EA4\u3001\u63A8\u9001\uFF1B\u5173\u95ED\u540E\u6240\u6709\u5199\u63A5\u53E3\u4E00\u5F8B 403\uFF08\u542B\u624B\u70B9\u6309\u94AE\uFF09\u3002",
  requireConfirm: "\u5199\u64CD\u4F5C\u524D\u9700\u8981\u6211\u786E\u8BA4",
  requireConfirmHint: "\u53EA\u4F5C\u7528\u4E8E Agent \u5DE5\u5177\u8C03\u7528\uFF1A\u5F00\u542F\u540E Agent \u7684\u5199\u64CD\u4F5C\u5148\u8FD4\u56DE\u5F85\u786E\u8BA4\uFF0C\u4F60\u786E\u8BA4\u540E\u624D\u6267\u884C\u3002\u672C\u9875\u6309\u94AE\u662F\u4F60\u4EB2\u624B\u70B9\u7684\uFF0C\u4E0D\u53D7\u6B64\u9879\u7EA6\u675F\u3002",
  userCode: "\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u4E0B\u9762\u7684\u5730\u5740\uFF0C\u8F93\u5165\u4EE3\u7801\u5B8C\u6210\u6388\u6743",
  copy: "\u590D\u5236",
  copied: "\u5DF2\u590D\u5236",
  waiting: "\u7B49\u5F85\u6388\u6743\u2026",
  authFailed: "\u6388\u6743\u5931\u8D25",
  notRepo: "\u5F53\u524D\u4F1A\u8BDD\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93",
  menuInit: "\u521D\u59CB\u5316 Git \u9879\u76EE",
  menuInitHint: "\u6253\u5F00\u521D\u59CB\u5316\u9875\uFF1A\u53EF\u53EA\u5EFA\u672C\u5730\u4ED3\u5E93\uFF0C\u4E5F\u53EF\u987A\u5E26\u5173\u8054\u6216\u65B0\u5EFA\u8FDC\u7A0B\u4ED3\u5E93",
  menuSettings: "\u6253\u5F00 Git \u8BBE\u7F6E",
  menuNewVersion: "\u6709\u65B0\u7248\u672C {v}",
  menuOpenDir: "\u6253\u5F00\u9879\u76EE\u76EE\u5F55",
  menuGroupRepo: "\u4ED3\u5E93",
  menuGroupOpen: "\u6253\u5F00",
  toastOpened: "\u5DF2\u5728\u6587\u4EF6\u7BA1\u7406\u5668\u4E2D\u6253\u5F00\u9879\u76EE\u76EE\u5F55",
  openFailed: "\u6253\u5F00\u9879\u76EE\u76EE\u5F55\u5931\u8D25",
  menuRefresh: "\u5237\u65B0\u72B6\u6001",
  menuRefreshHint: "\u91CD\u65B0\u8BFB\u53D6\u5206\u652F\u3001\u9886\u5148\u843D\u540E\u4E0E\u6539\u52A8\u6570",
  menuChecking: "\u6B63\u5728\u68C0\u6D4B\u4ED3\u5E93\u72B6\u6001\u2026",
  menuDetectFailed: "\u65E0\u6CD5\u68C0\u6D4B\u4ED3\u5E93\u72B6\u6001",
  menuRetry: "\u91CD\u65B0\u68C0\u6D4B",
  alreadyRepo: "\u5F53\u524D\u76EE\u5F55\u5DF2\u7ECF\u662F Git \u4ED3\u5E93\uFF0C\u65E0\u9700\u521D\u59CB\u5316",
  initRunning: "\u6B63\u5728\u521D\u59CB\u5316\u2026",
  initDone: "\u4ED3\u5E93\u5DF2\u521D\u59CB\u5316",
  initFailed: "\u521D\u59CB\u5316\u5931\u8D25",
  menuTitle: "\u4ED3\u5E93",
  unauthorizedRoot: "\u5F53\u524D\u76EE\u5F55\u672A\u5728\u6388\u6743\u8303\u56F4\u5185",
  graphTitle: "\u5206\u652F\u62D3\u6251",
  graphLoading: "\u6B63\u5728\u8BFB\u53D6\u63D0\u4EA4\u56FE\u2026",
  graphEmpty: "\u4ED3\u5E93\u8FD8\u6CA1\u6709\u4EFB\u4F55\u63D0\u4EA4",
  graphFailed: "\u8BFB\u53D6\u63D0\u4EA4\u56FE\u5931\u8D25",
  graphTruncated: "\u4EC5\u663E\u793A\u6700\u8FD1 {n} \u6761\u63D0\u4EA4",
  graphLanes: "{n} \u6761\u8F66\u9053",
  graphCopyHash: "\u590D\u5236\u63D0\u4EA4\u54C8\u5E0C",
  graphCopied: "\u5DF2\u590D\u5236\u54C8\u5E0C",
  refresh: "\u5237\u65B0",
  errLoad: "\u65E0\u6CD5\u8BFB\u53D6\u9762\u677F\u72B6\u6001\uFF0C\u8BF7\u786E\u8BA4\u63D2\u4EF6\u5DF2\u52A0\u8F7D\u5E76\u91CD\u8BD5",
  helpText: "\u6388\u6743\u8FB9\u754C\uFF1A\u672C\u5730\u547D\u4EE4\u53EA\u5728\u300C\u9AD8\u7EA7\u8BBE\u7F6E \u2192 \u672C\u5730\u76EE\u5F55\u300D\u5217\u51FA\u7684\u76EE\u5F55\u5185\u6267\u884C\uFF1B\u8FDC\u7AEF\u4ED3\u5E93\u6309\u300C\u8D26\u53F7\u5361\u7247\u91CC\u6BCF\u4E2A\u4ED3\u5E93\u7684\u4E09\u6863\u300D\u5224\u5B9A\uFF0C\u672A\u5355\u72EC\u8BBE\u8FC7\u7684\u4ED3\u5E93\u9ED8\u8BA4\u5B8C\u6574\u6743\u9650\uFF0C\u663E\u5F0F\u8BBE\u4E3A\u53EA\u8BFB\u6216\u65E0\u6743\u9650\u624D\u53D7\u9650\u3002\u672A\u6388\u6743\u3001\u6388\u6743\u5931\u6548\u3001\u4ED3\u5E93\u4E0D\u5B58\u5728\u6216 git \u547D\u4EE4\u5931\u8D25\u65F6\uFF0C\u5DE5\u5177\u90FD\u4F1A\u8FD4\u56DE\u53EF\u8BFB\u7684\u539F\u56E0\uFF0C\u4E0D\u4F1A\u9759\u9ED8\u5931\u8D25\u3002\u4EE4\u724C\u53EA\u4EE5 AES-256-GCM \u52A0\u5BC6\u4FDD\u5B58\u5728\u672C\u673A ~/.dsh/git-panel/state.json\uFF0C\u754C\u9762\u4E0E\u65E5\u5FD7\u4E2D\u90FD\u4E0D\u4F1A\u51FA\u73B0\u660E\u6587\u3002",
  removeConfirm: "\u65AD\u5F00\u540E\u8BE5\u8D26\u53F7\u7684\u4EE4\u724C\u4F1A\u88AB\u7ACB\u5373\u5220\u9664\uFF0CAgent \u5C06\u65E0\u6CD5\u518D\u4F7F\u7528\u5B83\u3002\u786E\u5B9A\u65AD\u5F00\uFF1F",
  /* ---- 授权概览（统计条） ---- */
  statsTitle: "\u6388\u6743\u6982\u89C8",
  statsAccounts: "\u8D26\u53F7",
  statsAccountsHintMixed: "{n} \u4E2A\u5DF2\u8FDE\u63A5 \xB7 {m} \u4E2A\u5F02\u5E38",
  statsRoots: "\u6388\u6743\u76EE\u5F55",
  statsRepos: "\u6388\u6743\u4ED3\u5E93",
  statsReposHintDefault: "\u672A\u5355\u5217\u7684\u4ED3\u5E93\u9ED8\u8BA4\u5B8C\u6574\u6743\u9650",
  statsWrite: "\u5199\u64CD\u4F5C",
  statsWriteOn: "\u5DF2\u5141\u8BB8",
  statsWriteOff: "\u5DF2\u5173\u95ED",
  /* ---- 账号卡片增强 ---- */
  setDefault: "\u8BBE\u4E3A\u9ED8\u8BA4",
  isDefault: "\u9ED8\u8BA4\u8D26\u53F7",
  /* ---- 工作区改动 ---- */
  changesEmpty: "\u5DE5\u4F5C\u533A\u5E72\u51C0\uFF0C\u6CA1\u6709\u672A\u63D0\u4EA4\u6539\u52A8",
  changesFailed: "\u8BFB\u53D6\u6539\u52A8\u5931\u8D25",
  changesStaleNode: "\u63D2\u4EF6\u670D\u52A1\u7AEF\u662F\u65E7\u7248\u672C\uFF08DSH \u7684 node \u534A\u8FB9\u4E0D\u70ED\u91CD\u8F7D\uFF09\uFF0C\u91CD\u542F DSH \u684C\u9762\u7AEF\u540E\u6062\u590D",
  changesStaged: "\u5DF2\u6682\u5B58",
  /* ---- 轻提示 ---- */
  toastSaved: "\u5DF2\u4FDD\u5B58\u6388\u6743\u8303\u56F4",
  toastDefault: "\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u8D26\u53F7",
  toastRecheck: "\u8D26\u53F7\u6821\u9A8C\u5B8C\u6210",
  /* ---- Git 工作台（IDEA 式主面板） ---- */
  wbTitle: "Git \u5DE5\u4F5C\u53F0",
  wbOpenHint: "\u6253\u5F00\u5B8C\u6574 Git \u64CD\u4F5C\u9762\u677F\uFF08\u53D8\u66F4 / \u63D0\u4EA4 / \u62C9\u53D6 / \u63A8\u9001 / \u5206\u652F / \u5386\u53F2\uFF09",
  wbFetch: "Fetch",
  wbPull: "Pull",
  wbPush: "Push",
  wbUnstaged: "\u672A\u6682\u5B58",
  wbUntracked: "\u672A\u8DDF\u8E2A",
  wbStage: "\u6682\u5B58",
  wbUnstage: "\u53D6\u6D88\u6682\u5B58",
  wbDiscard: "\u4E22\u5F03",
  wbHistory: "\u5386\u53F2",
  wbGraph: "\u5206\u652F\u56FE",
  wbChangesTab: "\u6539\u52A8",
  wbStageAll: "\u5168\u90E8\u6682\u5B58",
  wbDiffTitle: "\u5DEE\u5F02\u9884\u89C8",
  wbMsgPlaceholder: "\u63D0\u4EA4\u4FE1\u606F\uFF08\u5FC5\u586B\uFF09",
  wbAmend: "\u4FEE\u8865\u4E0A\u6B21\u63D0\u4EA4",
  wbCommit: "\u63D0\u4EA4",
  wbCommitNeedsStaged: "\u6682\u5B58\u533A\u4E3A\u7A7A\uFF1A\u5148\u5728\u4E0B\u65B9\u52FE\u9009\u6587\u4EF6\u5E76\u6682\u5B58\uFF0C\u518D\u586B\u5199\u63D0\u4EA4\u4FE1\u606F",
  wbCleanHint: "\u6CA1\u6709\u53EF\u63D0\u4EA4\u7684\u6539\u52A8\u3002\u7F16\u8F91\u6587\u4EF6\u540E\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002",
  wbInitHint: "\u6B64\u76EE\u5F55\u8FD8\u4E0D\u662F Git \u4ED3\u5E93\u3002\u521D\u59CB\u5316\u540E\u5373\u53EF\u5728\u8FD9\u91CC\u6682\u5B58\u3001\u63D0\u4EA4\u4E0E\u67E5\u770B\u5386\u53F2\u3002",
  wbInitRemote: "\u8FDC\u7A0B\u4ED3\u5E93\u5730\u5740\uFF08\u53EF\u9009\uFF0C\u7559\u7A7A\u5219\u4EC5\u672C\u5730\u521D\u59CB\u5316\uFF09",
  wbUnauthorizedHint: "\u8BE5\u76EE\u5F55\u4E0D\u5728\u6388\u6743\u8303\u56F4\u5185\u3002\u5230\u300C\u8BBE\u7F6E \u2192 Git \u2192 \u9AD8\u7EA7\u8BBE\u7F6E \u2192 \u672C\u5730\u76EE\u5F55\u300D\u52A0\u5165\u540E\u5373\u53EF\u64CD\u4F5C\u3002",
  wbNoCommits: "\u4ED3\u5E93\u8FD8\u6CA1\u6709\u63D0\u4EA4",
  wbNoCommitsHint: "\u5B8C\u6210\u9996\u6B21\u63D0\u4EA4\u540E\uFF0C\u5386\u53F2\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
  wbBranchTitle: "\u5206\u652F\u7BA1\u7406",
  wbLocalBranches: "\u672C\u5730\u5206\u652F",
  wbRemoteBranches: "\u8FDC\u7A0B\u5206\u652F",
  wbNoRemoteBranches: "\u5C1A\u65E0\u8FDC\u7A0B\u5206\u652F\uFF08\u5148 fetch \u6216\u63A8\u9001\uFF09",
  wbNewBranch: "\u65B0\u5EFA\u5206\u652F",
  wbBranchName: "\u5206\u652F\u540D",
  wbCheckoutAfterCreate: "\u521B\u5EFA\u540E\u7ACB\u5373\u5207\u6362",
  wbCreate: "\u521B\u5EFA",
  wbCancel: "\u53D6\u6D88",
  wbCheckout: "\u5207\u6362",
  wbDelete: "\u5220\u9664",
  wbConfirmDelete: "\u786E\u8BA4\u5220\u9664",
  wbCommitDetail: "\u63D0\u4EA4\u8BE6\u60C5",
  wbDetailFailed: "\u8BFB\u53D6\u63D0\u4EA4\u8BE6\u60C5\u5931\u8D25",
  wbAuthor: "\u4F5C\u8005",
  wbDate: "\u65E5\u671F",
  wbFiles: "\u53D8\u66F4\u6587\u4EF6",
  wbRemoteTitle: "\u8FDC\u7A0B\u4ED3\u5E93",
  wbNoRemotes: "\u8FD8\u6CA1\u6709\u914D\u7F6E\u8FDC\u7A0B\u4ED3\u5E93\u3002\u6DFB\u52A0\u540E\u624D\u80FD Push / Pull\u3002",
  wbRemoteName: "\u540D\u79F0",
  wbRemoteUrl: "URL\uFF08https:// \u6216 git@\uFF09",
  wbAdd: "\u6DFB\u52A0",
  wbRemove: "\u79FB\u9664",
  wbPullTitle: "\u62C9\u53D6\uFF08Pull\uFF09",
  wbPullMerge: "\u5408\u5E76\uFF08merge\uFF09",
  wbPullRebase: "\u53D8\u57FA\uFF08rebase\uFF09",
  wbPullUpstream: "\u5C06\u62C9\u53D6\u81EA",
  wbPullNoUpstream: "\u5F53\u524D\u5206\u652F\u6CA1\u6709\u4E0A\u6E38\uFF0CPull \u4F1A\u6309\u8FDC\u7A0B\u540C\u540D\u5206\u652F\u62C9\u53D6",
  wbPullHint: "\u5408\u5E76\u628A\u8FDC\u7A0B\u63D0\u4EA4\u5E76\u5165\u5F53\u524D\u5206\u652F\u5E76\u4EA7\u751F\u5408\u5E76\u63D0\u4EA4\uFF1B\u53D8\u57FA\u628A\u672C\u5730\u63D0\u4EA4\u632A\u5230\u8FDC\u7A0B\u4E4B\u540E\uFF0C\u5386\u53F2\u66F4\u7EBF\u6027\u3002",
  wbDiscardTitle: "\u4E22\u5F03\u672A\u63D0\u4EA4\u6539\u52A8",
  wbDiscardText: "\u4EE5\u4E0B\u6587\u4EF6\u7684\u6539\u52A8\u5C06\u88AB\u6C38\u4E45\u4E22\u5F03\uFF08\u672A\u8DDF\u8E2A\u6587\u4EF6\u4F1A\u88AB\u5220\u9664\uFF09\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF1A",
  /* ---- 工作台 toast ---- */
  toastStaged: "\u5DF2\u6682\u5B58\u6240\u9009\u6587\u4EF6",
  toastUnstaged: "\u5DF2\u53D6\u6D88\u6682\u5B58",
  toastDiscarded: "\u5DF2\u4E22\u5F03\u6240\u9009\u6539\u52A8",
  toastCommitted: "\u63D0\u4EA4\u6210\u529F",
  toastAmended: "\u5DF2\u4FEE\u8865\u4E0A\u6B21\u63D0\u4EA4",
  toastFetched: "Fetch \u5B8C\u6210",
  toastPulledMerge: "Pull\uFF08merge\uFF09\u5B8C\u6210",
  toastPulledRebase: "Pull\uFF08rebase\uFF09\u5B8C\u6210",
  toastPushed: "Push \u5B8C\u6210",
  toastCheckedOut: "\u5DF2\u5207\u6362\u5206\u652F",
  toastBranchDeleted: "\u5206\u652F\u5DF2\u5220\u9664",
  toastBranchCreated: "\u5206\u652F\u5DF2\u521B\u5EFA",
  toastRemoteAdded: "\u8FDC\u7A0B\u4ED3\u5E93\u5DF2\u6DFB\u52A0",
  toastRemoteRemoved: "\u8FDC\u7A0B\u4ED3\u5E93\u5DF2\u79FB\u9664",
  /* ---- 工作台错误与状态 ---- */
  actionFailed: "\u64CD\u4F5C\u5931\u8D25",
  syncConflicted: "\u4EA7\u751F\u5408\u5E76\u51B2\u7A81\uFF1A\u8BF7\u89E3\u51B3\u51B2\u7A81\u540E\u91CD\u65B0\u63D0\u4EA4\uFF08\u53EF\u7528\u547D\u4EE4\u884C\u6216 IDE \u5904\u7406\uFF09",
  syncRejected: "\u63A8\u9001\u88AB\u62D2\u7EDD\uFF1A\u8FDC\u7AEF\u6709\u65B0\u63D0\u4EA4\uFF0C\u8BF7\u5148 Pull \u518D Push",
  syncMissingConfig: "\u672A\u914D\u7F6E\u8FDC\u7A0B\u4ED3\u5E93\u6216\u4E0A\u6E38\u5206\u652F\uFF1A\u70B9\u5206\u652F\u540D\u6253\u5F00\u5206\u652F\u7BA1\u7406\uFF0C\u6216\u5230\u8BBE\u7F6E\u9875\u914D\u7F6E\u8FDC\u7A0B",
  diffFailed: "\u8BFB\u53D6 diff \u5931\u8D25",
  diffEmpty: "\u6CA1\u6709\u5DEE\u5F02",
  diffEmptyHint: "\u8BE5\u6587\u4EF6\u5F53\u524D\u6CA1\u6709\u672A\u63D0\u4EA4\u6539\u52A8\uFF0C\u6216\u5DF2\u5168\u90E8\u6682\u5B58\u3002",
  diffTruncated: "diff \u8FC7\u957F\u5DF2\u622A\u65AD\uFF0C\u5B8C\u6574\u5185\u5BB9\u8BF7\u7528\u547D\u4EE4\u884C\u67E5\u770B",
  /* ---- 账号 → 远程仓库权限（多账号管理） ---- */
  reposEmpty: "\u8BE5\u8D26\u53F7\u6CA1\u6709\u53EF\u8BBF\u95EE\u7684\u8FDC\u7A0B\u4ED3\u5E93",
  reposEmptyHint: "\u53EF\u4EE5\u5728\u672C\u9875\u300C\u65B0\u5EFA\u4ED3\u5E93\u300D\u76F4\u63A5\u521B\u5EFA\uFF0C\u6216\u53BB\u5E73\u53F0\u4FA7\u5EFA\u597D\u540E\u70B9\u5237\u65B0\u3002",
  reposFailed: "\u8BFB\u53D6\u8FDC\u7A0B\u4ED3\u5E93\u5931\u8D25",
  repoPrivate: "\u79C1\u6709",
  repoPublic: "\u516C\u5F00",
  repoDefaultBranch: "\u9ED8\u8BA4\u5206\u652F {branch}",
  permLabel: "\u6743\u9650",
  permFull: "\u5B8C\u6574",
  permRead: "\u53EA\u8BFB",
  permNone: "\u65E0\u6743\u9650",
  permSaved: "\u5DF2\u66F4\u65B0\u4ED3\u5E93\u6743\u9650",
  permSaveFailed: "\u4FDD\u5B58\u4ED3\u5E93\u6743\u9650\u5931\u8D25",
  permSaving: "\u4FDD\u5B58\u4E2D\u2026",
  reposReload: "\u5237\u65B0\u4ED3\u5E93\u5217\u8868",
  reposTruncated: "\u4ED3\u5E93\u8F83\u591A\uFF0C\u4EC5\u663E\u793A\u524D 500 \u4E2A\uFF1B\u672A\u5217\u51FA\u7684\u4ED3\u5E93\u6309\u8BE5\u8D26\u53F7\u9ED8\u8BA4\u6863\u4F4D\u5904\u7406\u3002",
  accountEdit: "\u7F16\u8F91\u8D26\u53F7",
  editHint: "\u4FEE\u6539\u540E\u9700\u8981\u91CD\u65B0\u6821\u9A8C\uFF0C\u51ED\u636E\u53EA\u5728\u4FDD\u5B58\u65F6\u5199\u4E00\u6B21",
  connectAccount: "\u8FDE\u63A5\u8D26\u53F7",
  connectFailed: "\u8FDE\u63A5\u5931\u8D25",
  tokenRequired: "\u8BF7\u586B\u5199\u8BBF\u95EE\u4EE4\u724C",
  repoSearch: "\u641C\u7D22\u4ED3\u5E93",
  repoFilter: "\u6309\u6743\u9650\u7B5B\u9009",
  filterAll: "\u5168\u90E8",
  reposCount: "\u5171 {n} / {m} \u4E2A\u4ED3\u5E93",
  reposNoMatch: "\u6CA1\u6709\u5339\u914D\u7684\u4ED3\u5E93",
  advancedShow: "\u9AD8\u7EA7\u8BBE\u7F6E",
  advancedHide: "\u6536\u8D77\u9AD8\u7EA7\u8BBE\u7F6E",
  /* ---- 当前分支详情 ---- */
  branchDetail: "\u5F53\u524D\u5206\u652F\u8BE6\u60C5",
  branchDetailTitle: "\u5F53\u524D\u5206\u652F\u8BE6\u60C5",
  branchDetailEmpty: "\u8BE5\u5206\u652F\u8FD8\u6CA1\u6709\u63D0\u4EA4",
  branchDetailEmptyHint: "\u5B8C\u6210\u9996\u6B21\u63D0\u4EA4\u540E\uFF0C\u63D0\u4EA4\u8BB0\u5F55\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
  branchDetailFailed: "\u8BFB\u53D6\u63D0\u4EA4\u8BB0\u5F55\u5931\u8D25",
  branchDetailTruncated: "\u4EC5\u663E\u793A\u6700\u8FD1 {n} \u6761\u63D0\u4EA4",
  branchDetailClose: "\u5173\u95ED",
  /* ---- 分步初始化向导 ---- */
  initTitle: "\u521D\u59CB\u5316 Git \u9879\u76EE",
  initStepAccount: "\u8D26\u53F7",
  initStepRemote: "\u8FDC\u7A0B\u4ED3\u5E93",
  initStepBranch: "\u5206\u652F",
  initStart: "\u5F00\u59CB\u521D\u59CB\u5316",
  initCancel: "\u53D6\u6D88",
  initClose: "\u5173\u95ED",
  initNoAccount: "\u5C1A\u672A\u8FDE\u63A5 Git \u8D26\u53F7",
  initNewRemote: "\u586B\u5199\u5176\u5B83\u8FDC\u7A0B\u5730\u5740",
  initRemoteUrl: "\u8FDC\u7A0B\u4ED3\u5E93\u5730\u5740",
  initRemoteUrlHint: "\u586B\u5199\u5DF2\u5B58\u5728\u7684\u8FDC\u7A0B\u5730\u5740\uFF1B\u4E5F\u53EF\u4EE5\u70B9\u4E0A\u65B9\u300C\u5728\u8BE5\u8D26\u53F7\u4E0B\u65B0\u5EFA\u4ED3\u5E93\u300D",
  repoCreateOpen: "\u5728\u8BE5\u8D26\u53F7\u4E0B\u65B0\u5EFA\u4ED3\u5E93",
  repoCreateName: "\u4ED3\u5E93\u540D",
  repoCreatePrivate: "\u79C1\u6709\u4ED3\u5E93",
  repoCreateHint: "\u5C06\u5728 {account} \u540D\u4E0B\u521B\u5EFA\u4E00\u4E2A\u7A7A\u4ED3\u5E93\uFF0C\u5E76\u81EA\u52A8\u6388\u6743\u4E3A\u300C\u5B8C\u6574\u300D",
  repoCreateSubmit: "\u521B\u5EFA\u5E76\u9009\u7528",
  repoCreating: "\u521B\u5EFA\u4E2D\u2026",
  repoCreateFailed: "\u521B\u5EFA\u8FDC\u7A0B\u4ED3\u5E93\u5931\u8D25",
  initManualRepoHint: "\u8FDE\u4E0A\u8D26\u53F7\u540E\u4F1A\u81EA\u52A8\u5217\u51FA\u4ED3\u5E93\uFF1B\u73B0\u5728\u4E5F\u53EF\u4EE5\u53EA\u521D\u59CB\u5316\u672C\u5730\u4ED3\u5E93",
  initQuickLocal: "\u4EC5\u521D\u59CB\u5316\u672C\u5730\u4ED3\u5E93",
  initRepoListFailed: "\u8BFB\u53D6\u4ED3\u5E93\u5217\u8868\u5931\u8D25\uFF1A{reason}",
  initRepoListEmpty: "\u8BE5\u8D26\u53F7\u6CA1\u6709\u53EF\u7528\u7684\u8FDC\u7A0B\u4ED3\u5E93",
  initAuthorizedRepos: "\u5DF2\u6388\u6743\u7684\u4ED3\u5E93",
  initBranchName: "\u5206\u652F\u540D",
  initNoBranches: "\u5206\u652F\u540D\u53EF\u81EA\u7531\u586B\u5199\uFF1B\u7559\u7A7A\u5219\u7528\u8FDC\u7A0B\u9ED8\u8BA4\u5206\u652F",
  initCommitMessage: "\u9996\u6B21\u63D0\u4EA4\u4FE1\u606F\uFF08\u53EF\u9009\uFF09",
  initConfirmTitle: "\u5C06\u8981\u6267\u884C\u7684\u64CD\u4F5C",
  initPlanInit: "\u521D\u59CB\u5316\u672C\u5730\u4ED3\u5E93",
  initPlanRemote: "\u6DFB\u52A0\u8FDC\u7A0B origin",
  initPlanBranch: "\u5207\u6362\u6216\u521B\u5EFA\u5206\u652F {branch}",
  initPlanCommit: "\u521B\u5EFA\u9996\u6B21\u63D0\u4EA4",
  initSuccess: "\u521D\u59CB\u5316\u5B8C\u6210",
  initResultRoot: "\u4ED3\u5E93\u76EE\u5F55",
  initResultBranch: "\u5206\u652F",
  initResultRemote: "\u8FDC\u7A0B\u5730\u5740",
  initStepsTitle: "\u6267\u884C\u6B65\u9AA4",
  initRepoRequired: "\u8BF7\u9009\u62E9\u6216\u586B\u5199\u4E00\u4E2A\u8FDC\u7A0B\u4ED3\u5E93",
  /* ---- dgp-v19：差异视图 ---- */
  diffFind: "\u67E5\u627E",
  diffFindPlaceholder: "\u5728\u5DEE\u5F02\u91CC\u67E5\u627E\uFF08Ctrl/\u2318+F\uFF09",
  diffLayout: "\u5E03\u5C40",
  diffSplit: "\u5E76\u6392",
  diffUnified: "\u7EDF\u4E00",
  diffHighlight: "\u8BED\u6CD5\u9AD8\u4EAE",
  diffFoldHint: "\u5C55\u5F00 {n} \u884C\u672A\u53D8\u66F4\u5185\u5BB9",
  split: "\u5E76\u6392",
  unified: "\u7EDF\u4E00",
  /* ---- dgp-v19：文件浏览 ---- */
  fbBack: "\u8FD4\u56DE\u76EE\u5F55",
  fbBinary: "\u4E8C\u8FDB\u5236\u6587\u4EF6\uFF0C\u65E0\u6CD5\u9884\u89C8",
  fbEmpty: "\u8FD9\u4E2A\u76EE\u5F55\u662F\u7A7A\u7684",
  fbEmptyHint: "\u6362\u4E2A\u76EE\u5F55\u770B\u770B\uFF0C\u6216\u786E\u8BA4\u4ED3\u5E93\u91CC\u786E\u5B9E\u6CA1\u6709\u5185\u5BB9",
  fbLoadFailed: "\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25",
  fbPick: "\u4ECE\u5DE6\u4FA7\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6",
  fbPickHint: "\u652F\u6301\u4EE3\u7801\u3001Markdown\u3001\u56FE\u7247\u7B49\u5E38\u89C1\u683C\u5F0F\u7684\u53EA\u8BFB\u9884\u89C8",
  fbReadFailed: "\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25",
  fbTruncated: "\u76EE\u5F55\u6761\u76EE\u8FC7\u591A\uFF0C\u4EC5\u663E\u793A\u524D {n} \u9879",
  fbTruncatedFile: "\u6587\u4EF6\u8FC7\u5927\uFF0C\u4EC5\u663E\u793A\u524D {n} KB",
  fbWrap: "\u81EA\u52A8\u6362\u884C",
  /* ---- dgp-v19：历史搜索 ---- */
  wbSearchCommit: "\u641C\u7D22\u63D0\u4EA4\u4FE1\u606F",
  wbSearch: "\u641C\u7D22",
  wbSearchClear: "\u6E05\u7A7A",
  wbSearchEmpty: "\u6CA1\u6709\u5339\u914D\u7684\u63D0\u4EA4",
  wbSearchEmptyHint: "\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u6E05\u7A7A\u641C\u7D22\u770B\u5168\u90E8\u5386\u53F2",
  wbNoMoreCommits: "\u5DF2\u7ECF\u5230\u5E95\u4E86",
  wbLoadMore: "\u52A0\u8F7D\u66F4\u591A",
  wbLoadingMore: "\u6B63\u5728\u52A0\u8F7D\u2026",
  /* ---- dgp-v19：仓库切换 ---- */
  wbSwitchRepo: "\u5207\u6362\u4ED3\u5E93",
  wbSwitchRepoHint: "\u5728\u5DE5\u4F5C\u533A\u91CC\u53D1\u73B0\u7684\u5176\u4ED6\u4ED3\u5E93",
  /* ---- dgp-v19：AI 生成提交信息 ---- */
  wbSuggest: "AI \u751F\u6210",
  wbSuggesting: "\u751F\u6210\u4E2D\u2026",
  wbSuggestHint: "\u6309\u5F53\u524D\u6682\u5B58\u6539\u52A8\u548C\u8FD1\u671F\u63D0\u4EA4\u98CE\u683C\u751F\u6210\u4E00\u884C\u63D0\u4EA4\u4FE1\u606F",
  toastSuggested: "\u5DF2\u751F\u6210\u63D0\u4EA4\u4FE1\u606F",
  suggestFailed: "\u751F\u6210\u63D0\u4EA4\u4FE1\u606F\u5931\u8D25",
  /* ---- dgp-v19：标签 ---- */
  wbTagsTab: "\u6807\u7B7E",
  wbTagName: "\u6807\u7B7E\u540D\uFF0C\u4F8B\u5982 v1.0.0",
  wbTagNote: "\u9644\u6CE8\u4FE1\u606F\uFF08\u7559\u7A7A\u4E3A\u8F7B\u91CF\u6807\u7B7E\uFF09",
  wbTagCreate: "\u521B\u5EFA\u6807\u7B7E",
  wbTagAnnotated: "\u9644\u6CE8",
  wbTagPush: "\u63A8\u9001",
  wbNoTags: "\u8FD8\u6CA1\u6709\u6807\u7B7E",
  wbNoTagsHint: "\u5728\u4E0A\u9762\u586B\u6807\u7B7E\u540D\u5373\u53EF\u521B\u5EFA\u4E00\u4E2A\u6307\u5411\u5F53\u524D\u63D0\u4EA4\u7684\u6807\u7B7E",
  toastTagCreated: "\u6807\u7B7E\u5DF2\u521B\u5EFA",
  toastTagDeleted: "\u6807\u7B7E\u5DF2\u5220\u9664",
  toastTagPushed: "\u6807\u7B7E\u5DF2\u63A8\u9001",
  /* ---- dgp-v19：贮藏 ---- */
  wbStashTab: "\u8D2E\u85CF",
  wbStashNote: "\u8D2E\u85CF\u8BF4\u660E\uFF08\u53EF\u9009\uFF09",
  wbStashUntracked: "\u5305\u542B\u672A\u8DDF\u8E2A\u6587\u4EF6",
  wbStashSave: "\u8D2E\u85CF\u5F53\u524D\u6539\u52A8",
  wbStashPop: "\u6062\u590D\u5E76\u5220\u9664",
  wbStashApply: "\u6062\u590D",
  wbStashDrop: "\u5220\u9664",
  wbStashNoSubject: "\uFF08\u65E0\u8BF4\u660E\uFF09",
  wbNoStashes: "\u8FD8\u6CA1\u6709\u8D2E\u85CF",
  wbNoStashesHint: "\u628A\u5F53\u524D\u6539\u52A8\u6682\u5B58\u8D77\u6765\uFF0C\u5DE5\u4F5C\u533A\u4F1A\u56DE\u5230\u5E72\u51C0\u72B6\u6001",
  toastStashed: "\u5DF2\u8D2E\u85CF",
  toastStashPopped: "\u5DF2\u6062\u590D\u5E76\u5220\u9664\u8BE5\u8D2E\u85CF",
  toastStashApplied: "\u5DF2\u6062\u590D\u8BE5\u8D2E\u85CF",
  toastStashDropped: "\u5DF2\u5220\u9664\u8BE5\u8D2E\u85CF",
  /* ---- dgp-v19：文件浏览视图 ---- */
  wbFilesTab: "\u6587\u4EF6"
  /* ---- 刷新 ---- */
};
var EN = {
  entry: "Git",
  entryTitle: "Current repository status",
  navLabel: "Git",
  panelTitle: "Git account access",
  panelSubtitle: "Connect accounts and limit which repositories the agent may touch",
  accountLabel: "Account label (optional)",
  accountLabelHint: "Distinguish multiple accounts on the same host, e.g. work / personal",
  groupScopeRepos: "Remote repositories",
  groupScopeRoots: "Local directories",
  groupPolicy: "Write policy",
  noAccount: "No Git account connected yet",
  noAccountHint: "Once connected, the agent can read repository info, branches, diffs and commits within the authorized scope.",
  connected: "Connected",
  expired: "Authorization expired",
  errored: "Credential error",
  disconnect: "Disconnect",
  recheck: "Verify",
  provider: "Provider",
  method: "Method",
  oauth: "OAuth device flow",
  pat: "Personal access token (PAT)",
  oauthPro: "Best for interactive local use: open one browser page, type the code, no token copying.",
  patPro: "Best for unattended/CI/self-hosted: scope it to a single repository, read-only; stored encrypted locally.",
  tokenLabel: "Access token",
  tokenPlaceholder: "Paste a PAT (submitted once, never shown again)",
  clientIdLabel: "OAuth App Client ID",
  clientIdHint: "Create your own OAuth App on the provider and paste its Client ID; this plugin ships no third-party credentials.",
  hostLabel: "Instance host (self-hosted)",
  hostPlaceholder: "e.g. git.example.com",
  apiBaseLabel: "API base (optional)",
  apiBasePlaceholder: "e.g. https://git.example.com/api/v1",
  connect: "Connect",
  connecting: "Connecting\u2026",
  cancel: "Cancel",
  save: "Save scope",
  saved: "Saved",
  scopeRepos: "Remote repositories the agent may use",
  scopeReposHint: "One owner/repo per line; * means all repositories (not recommended). Empty means no remote access.",
  scopeReposNote: "This is the global fallback list, used only for accounts that have no per-repository table yet. Per-repository settings on the Accounts tab take precedence.",
  scopeRoots: "Local repository directories the agent may use",
  scopeDiscoverTitle: "Discovered repositories",
  scopeDiscoverEmpty: "No Git repositories found under authorized roots yet (save roots, then rescan)",
  scopeDiscoverNoRemote: "no remote",
  scopeDiscoverUse: "Authorize",
  scopeDiscoverReload: "Rescan",
  scopeRootsHint: "One absolute path per line. Local git commands only run inside these directories. * means no directory limit (the whole machine \u2014 use with care).",
  allowWrite: "Allow the agent to modify repositories",
  allowWriteHint: "This is the single switch for writes: when on, both the agent and the buttons here can stage, commit and push; when off, every write endpoint returns 403, including manual clicks.",
  requireConfirm: "Ask me before every write",
  requireConfirmHint: "Applies to agent tool calls only: when on, an agent write returns a pending confirmation you must approve. Buttons you click here are not gated by it.",
  userCode: "Open the URL below in a browser and enter the code",
  copy: "Copy",
  copied: "Copied",
  waiting: "Waiting for authorization\u2026",
  authFailed: "Authorization failed",
  notRepo: "The current session directory is not a Git repository",
  menuInit: "Initialize Git project",
  menuInitHint: "Opens the setup page: local-only init, or also attach / create a remote repository",
  menuSettings: "Open Git settings",
  menuNewVersion: "Update available {v}",
  menuOpenDir: "Open project folder",
  menuGroupRepo: "Repository",
  menuGroupOpen: "Open",
  toastOpened: "Project folder opened in file manager",
  openFailed: "Failed to open project folder",
  menuRefresh: "Refresh status",
  menuRefreshHint: "Re-read branch, ahead/behind and change count",
  menuChecking: "Checking repository status\u2026",
  menuDetectFailed: "Cannot detect repository status",
  menuRetry: "Check again",
  alreadyRepo: "This directory is already a Git repository",
  initRunning: "Initializing\u2026",
  initDone: "Repository initialized",
  initFailed: "Initialization failed",
  menuTitle: "Repository",
  unauthorizedRoot: "The current directory is outside the authorized scope",
  graphTitle: "Branch topology",
  graphLoading: "Loading commit graph\u2026",
  graphEmpty: "This repository has no commits yet",
  graphFailed: "Failed to load the commit graph",
  graphTruncated: "Showing the latest {n} commits",
  graphLanes: "{n} lanes",
  graphCopyHash: "Copy commit hash",
  graphCopied: "Hash copied",
  refresh: "Refresh",
  errLoad: "Cannot read panel state; make sure the plugin is loaded and retry",
  helpText: "Authorization boundary: the agent can only read the repositories and directories listed in \u201CScope\u201D. Unauthorized repos, expired grants, missing repositories and failing git commands all return a readable reason. Tokens are stored with AES-256-GCM in ~/.dsh/git-panel/state.json and never appear in the UI or logs.",
  removeConfirm: "Disconnecting deletes this token immediately; the agent will no longer be able to use it. Continue?",
  /* ---- Authorization overview ---- */
  statsTitle: "Authorization overview",
  statsAccounts: "Accounts",
  statsAccountsHintMixed: "{n} connected \xB7 {m} unhealthy",
  statsRoots: "Directories",
  statsRepos: "Repositories",
  statsReposHintDefault: "Unlisted repos default to full access",
  statsWrite: "Writes",
  statsWriteOn: "Allowed",
  statsWriteOff: "Disabled",
  /* ---- Account cards ---- */
  setDefault: "Set as default",
  isDefault: "Default account",
  /* ---- Workspace changes ---- */
  changesEmpty: "Working tree is clean \u2014 no uncommitted changes",
  changesFailed: "Failed to read changes",
  changesStaleNode: "Plugin backend is stale (DSH node side does not hot-reload) \u2014 restart the DSH desktop app to fix",
  changesStaged: "staged",
  /* ---- Toasts ---- */
  toastSaved: "Scope saved",
  toastDefault: "Default account updated",
  toastRecheck: "Account verification finished",
  /* ---- Misc ---- */
  /* ---- Git 工作台（IDEA 式主面板） ---- */
  wbTitle: "Git Workbench",
  wbOpenHint: "Open the full Git panel (changes / commit / pull / push / branches / history)",
  wbFetch: "Fetch",
  wbPull: "Pull",
  wbPush: "Push",
  wbUnstaged: "Unstaged",
  wbUntracked: "Untracked",
  wbStage: "Stage",
  wbUnstage: "Unstage",
  wbDiscard: "Discard",
  wbHistory: "History",
  wbGraph: "Graph",
  wbChangesTab: "Changes",
  wbStageAll: "Stage all",
  wbDiffTitle: "Diff preview",
  wbMsgPlaceholder: "Commit message (required)",
  wbAmend: "Amend last commit",
  wbCommit: "Commit",
  wbCommitNeedsStaged: "Nothing staged: tick files below and stage them, then write a commit message",
  wbCleanHint: "No changes to commit. Edited files will appear here.",
  wbInitHint: "This directory is not a Git repository yet. Initialize it to stage, commit and browse history here.",
  wbInitRemote: "Remote URL (optional, leave empty for local only)",
  wbUnauthorizedHint: "This directory is not authorized. Add it in Settings \u2192 Git \u2192 Advanced \u2192 Local directories.",
  wbNoCommits: "No commits yet",
  wbNoCommitsHint: "History will appear here after the first commit.",
  wbBranchTitle: "Manage branches",
  wbLocalBranches: "Local",
  wbRemoteBranches: "Remote",
  wbNoRemoteBranches: "No remote branches yet (fetch or push first)",
  wbNewBranch: "New branch",
  wbBranchName: "Branch name",
  wbCheckoutAfterCreate: "Check out after create",
  wbCreate: "Create",
  wbCancel: "Cancel",
  wbCheckout: "Check out",
  wbDelete: "Delete",
  wbConfirmDelete: "Confirm delete",
  wbCommitDetail: "Commit",
  wbDetailFailed: "Failed to load commit detail",
  wbAuthor: "Author",
  wbDate: "Date",
  wbFiles: "Files",
  wbRemoteTitle: "Manage remotes",
  wbNoRemotes: "No remotes configured yet. Add one to enable Push / Pull.",
  wbRemoteName: "Name",
  wbRemoteUrl: "URL (https:// or git@)",
  wbAdd: "Add",
  wbRemove: "Remove",
  wbPullTitle: "Pull",
  wbPullMerge: "Merge",
  wbPullRebase: "Rebase",
  wbPullUpstream: "Pulling from",
  wbPullNoUpstream: "Current branch has no upstream; Pull will use the same-named remote branch",
  wbPullHint: "Merge folds remote commits into this branch with a merge commit; rebase moves local commits after remote ones for a linear history.",
  wbDiscardTitle: "Discard uncommitted changes",
  wbDiscardText: "Changes in the following files will be permanently discarded (untracked files deleted). This cannot be undone:",
  toastStaged: "Files staged",
  toastUnstaged: "Unstaged",
  toastDiscarded: "Changes discarded",
  toastCommitted: "Committed",
  toastAmended: "Last commit amended",
  toastFetched: "Fetch done",
  toastPulledMerge: "Pull (merge) done",
  toastPulledRebase: "Pull (rebase) done",
  toastPushed: "Push done",
  toastCheckedOut: "Branch switched",
  toastBranchDeleted: "Branch deleted",
  toastBranchCreated: "Branch created",
  toastRemoteAdded: "Remote added",
  toastRemoteRemoved: "Remote removed",
  actionFailed: "Action failed",
  syncConflicted: "Merge conflicts: resolve them and commit again (CLI or IDE)",
  syncRejected: "Push rejected: remote has new commits. Pull first, then push",
  syncMissingConfig: "No remote or upstream configured: click the branch name to manage branches, or configure remotes in Settings",
  diffFailed: "Failed to load diff",
  diffEmpty: "No differences",
  diffEmptyHint: "This file has no uncommitted changes, or everything is staged.",
  diffTruncated: "Diff is truncated; view the full output in a terminal",
  /* ---- Account → remote repository permissions ---- */
  reposEmpty: "No accessible remote repository for this account",
  reposEmptyHint: "Create one with \u201CNew repository\u201D above, or make it on the platform and hit refresh.",
  reposFailed: "Failed to load remote repositories",
  repoPrivate: "private",
  repoPublic: "public",
  repoDefaultBranch: "default branch {branch}",
  permLabel: "Access",
  permFull: "Full",
  permRead: "Read-only",
  permNone: "No access",
  permSaved: "Repository access updated",
  permSaveFailed: "Failed to save repository access",
  permSaving: "Saving\u2026",
  reposReload: "Reload repositories",
  reposTruncated: "Too many repositories; showing the first 500. Unlisted repositories use the account default.",
  accountEdit: "Edit account",
  editHint: "Changes need a recheck; the credential is written only once on save",
  connectAccount: "Connect account",
  connectFailed: "Connection failed",
  tokenRequired: "Enter an access token",
  repoSearch: "Search repositories",
  repoFilter: "Filter by access",
  filterAll: "All",
  reposCount: "{n} of {m} repositories",
  reposNoMatch: "No matching repositories",
  advancedShow: "Advanced settings",
  advancedHide: "Hide advanced settings",
  /* ---- Current branch details ---- */
  branchDetail: "Current branch details",
  branchDetailTitle: "Current branch details",
  branchDetailEmpty: "This branch has no commits yet",
  branchDetailEmptyHint: "Commits will appear here after the first commit.",
  branchDetailFailed: "Failed to load commits",
  branchDetailTruncated: "Showing the latest {n} commits",
  branchDetailClose: "Close",
  /* ---- Step-by-step initialization wizard ---- */
  initTitle: "Initialize Git project",
  initStepAccount: "Account",
  initStepRemote: "Remote",
  initStepBranch: "Branch",
  initStart: "Start initialization",
  initCancel: "Cancel",
  initClose: "Close",
  initNoAccount: "No Git account connected yet",
  initNewRemote: "Enter another remote URL",
  initRemoteUrl: "Remote repository URL",
  initRemoteUrlHint: "Provide an existing remote URL, or create a repository in the account above",
  repoCreateOpen: "Create repository in this account",
  repoCreateName: "Repository name",
  repoCreatePrivate: "Private repository",
  repoCreateHint: "Creates an empty repository under {account} and grants it full access",
  repoCreateSubmit: "Create and use",
  repoCreating: "Creating\u2026",
  repoCreateFailed: "Failed to create the remote repository",
  initManualRepoHint: "Repositories are listed once an account is connected; you can also init a local-only repository now",
  initQuickLocal: "Initialize local repository only",
  initRepoListFailed: "Failed to list repositories: {reason}",
  initRepoListEmpty: "No remote repository available for this account",
  initAuthorizedRepos: "Authorized repositories",
  initBranchName: "Branch name",
  initNoBranches: "Type any branch name; leave it empty to use the remote default branch",
  initCommitMessage: "First commit message (optional)",
  initConfirmTitle: "Actions to run",
  initPlanInit: "Initialize the local repository",
  initPlanRemote: "Add remote origin",
  initPlanBranch: "Switch to or create branch {branch}",
  initPlanCommit: "Create the first commit",
  initSuccess: "Initialization finished",
  initResultRoot: "Repository folder",
  initResultBranch: "Branch",
  initResultRemote: "Remote URL",
  initStepsTitle: "Executed steps",
  initRepoRequired: "Pick or enter a remote repository",
  /* ---- dgp-v19: diff view ---- */
  diffFind: "Find",
  diffFindPlaceholder: "Find in diff (Ctrl/\u2318+F)",
  diffLayout: "Layout",
  diffSplit: "Side by side",
  diffUnified: "Unified",
  diffHighlight: "Syntax highlight",
  diffFoldHint: "Show {n} unchanged lines",
  split: "Side by side",
  unified: "Unified",
  /* ---- dgp-v19: file browser ---- */
  fbBack: "Back to folder",
  fbBinary: "Binary file; preview unavailable",
  fbEmpty: "This folder is empty",
  fbEmptyHint: "Try another folder, or check that the repository really has content",
  fbLoadFailed: "Failed to read the folder",
  fbPick: "Pick a file on the left",
  fbPickHint: "Read-only preview for code, Markdown, images and more",
  fbReadFailed: "Failed to read the file",
  fbTruncated: "Too many entries; showing the first {n}",
  fbTruncatedFile: "File too large; showing the first {n} KB",
  fbWrap: "Wrap lines",
  /* ---- dgp-v19: history search ---- */
  wbSearchCommit: "Search commit messages",
  wbSearch: "Search",
  wbSearchClear: "Clear",
  wbSearchEmpty: "No matching commits",
  wbSearchEmptyHint: "Try another keyword, or clear the search to see all history",
  wbNoMoreCommits: "No more commits",
  wbLoadMore: "Load more",
  wbLoadingMore: "Loading\u2026",
  /* ---- dgp-v19: repo switching ---- */
  wbSwitchRepo: "Switch repository",
  wbSwitchRepoHint: "Other repositories found in the workspace",
  /* ---- dgp-v19: AI commit message ---- */
  wbSuggest: "Generate",
  wbSuggesting: "Generating\u2026",
  wbSuggestHint: "Draft one commit message line from the staged diff and recent commit style",
  toastSuggested: "Commit message generated",
  suggestFailed: "Failed to generate a commit message",
  /* ---- dgp-v19: tags ---- */
  wbTagsTab: "Tags",
  wbTagName: "Tag name, e.g. v1.0.0",
  wbTagNote: "Annotation (leave empty for a lightweight tag)",
  wbTagCreate: "Create tag",
  wbTagAnnotated: "Annotated",
  wbTagPush: "Push",
  wbNoTags: "No tags yet",
  wbNoTagsHint: "Enter a tag name above to tag the current commit",
  toastTagCreated: "Tag created",
  toastTagDeleted: "Tag deleted",
  toastTagPushed: "Tag pushed",
  /* ---- dgp-v19: stash ---- */
  wbStashTab: "Stashes",
  wbStashNote: "Stash note (optional)",
  wbStashUntracked: "Include untracked files",
  wbStashSave: "Stash changes",
  wbStashPop: "Pop",
  wbStashApply: "Apply",
  wbStashDrop: "Drop",
  wbStashNoSubject: "(no note)",
  wbNoStashes: "No stashes yet",
  wbNoStashesHint: "Stash the current changes to leave a clean working tree",
  toastStashed: "Changes stashed",
  toastStashPopped: "Stash popped",
  toastStashApplied: "Stash applied",
  toastStashDropped: "Stash dropped",
  /* ---- dgp-v19: files view ---- */
  wbFilesTab: "Files"
};
var SETTINGS_PANEL_SELECTOR = '[data-shortcut-modal="settings"]';
var SETTINGS_TRIGGER_SELECTORS = [
  'button[aria-haspopup="dialog"][aria-keyshortcuts]',
  'button[aria-haspopup="dialog"]'
];
var SETTINGS_TRIGGER_LABEL = /设置|設定|Settings|Preferences/i;
var SETTINGS_TRIGGER_EXCLUDE = '[data-team-action],[data-team-panel],[aria-label*="\u56E2\u961F"],[aria-label*="Team"]';
var ACCOUNT_MENU_SELECTORS = ['button[aria-haspopup="menu"]', 'button[aria-haspopup="true"]'];
var ACCOUNT_MENU_LABEL = /账号菜单|账户菜单|帐号菜单|Account\s*Menu|Account/i;
var SETTINGS_MENU_ITEM_LABEL = /^(设置|設定|Settings|Preferences)/i;
function isSettingsOpen() {
  return document.querySelector(SETTINGS_PANEL_SELECTOR) !== null;
}
function findSettingsTrigger() {
  for (const selector of SETTINGS_TRIGGER_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll(selector));
    const labeled = nodes.find((node) => {
      if (node.disabled) return false;
      if (node.getAttribute("aria-expanded") === "true") return false;
      if (node.closest(SETTINGS_TRIGGER_EXCLUDE) !== null) return false;
      const name = node.getAttribute("aria-label") ?? node.textContent ?? "";
      return SETTINGS_TRIGGER_LABEL.test(name);
    });
    if (labeled !== void 0) return labeled;
  }
  return void 0;
}
function nextFrame() {
  return new Promise((resolve) => {
    try {
      window.requestAnimationFrame(() => resolve());
    } catch {
      window.setTimeout(resolve, 16);
    }
  });
}
function findAccountMenuTrigger() {
  for (const selector of ACCOUNT_MENU_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll(selector));
    const matched = nodes.find((node) => {
      if (node.disabled) return false;
      const name = node.getAttribute("aria-label") ?? node.textContent ?? "";
      return ACCOUNT_MENU_LABEL.test(name);
    });
    if (matched !== void 0) return matched;
  }
  return void 0;
}
async function openSettingsViaAccountMenu() {
  const trigger = findAccountMenuTrigger();
  if (trigger === void 0) return false;
  if (trigger.getAttribute("aria-expanded") === "true") {
  } else {
    trigger.click();
    await nextFrame();
    await nextFrame();
  }
  const menus = Array.from(document.querySelectorAll('[role="menu"]'));
  for (const menu of menus) {
    const items = Array.from(menu.querySelectorAll('[role="menuitem"],button'));
    const target = items.find((item) => {
      const text = (item.textContent ?? "").trim();
      return SETTINGS_MENU_ITEM_LABEL.test(text);
    });
    if (target === void 0) continue;
    target.click();
    await nextFrame();
    await nextFrame();
    if (isSettingsOpen()) return true;
  }
  return isSettingsOpen();
}
async function attempt(open) {
  if (isSettingsOpen()) return true;
  try {
    open();
  } catch {
    return false;
  }
  await nextFrame();
  if (isSettingsOpen()) return true;
  await nextFrame();
  return isSettingsOpen();
}
async function selectSettingsSection(label) {
  const panel = document.querySelector(SETTINGS_PANEL_SELECTOR);
  if (panel === null) return;
  const rows = Array.from(panel.querySelectorAll("nav button"));
  const target = rows.find((row) => {
    const text = (row.textContent ?? "").trim();
    return text === label;
  });
  if (target === void 0) return;
  if (target.getAttribute("aria-current") === "true") return;
  target.click();
  await nextFrame();
}
async function openSettingsSection(ctx, sectionLabel) {
  if (!isSettingsOpen()) {
    const viaMenu = await openSettingsViaAccountMenu();
    if (!viaMenu) {
      const trigger = findSettingsTrigger();
      if (trigger !== void 0) {
        const opened = await attempt(() => trigger.click());
        if (!opened) await openSettingsFallback(ctx);
      } else {
        await openSettingsFallback(ctx);
      }
    }
  }
  if (sectionLabel !== void 0 && sectionLabel !== "") await selectSettingsSection(sectionLabel);
}
async function openSettingsFallback(ctx) {
  const invoke = ctx?.shortcuts?.registry?.invoke;
  if (typeof invoke === "function") {
    const opened = await attempt(
      () => invoke("settings.open", {
        region: "page",
        modal: null,
        target: document.activeElement,
        source: "menu"
      })
    );
    if (opened) return;
  }
  const variants = [
    { ctrlKey: true, altKey: false },
    { ctrlKey: true, altKey: true }
  ];
  for (const variant of variants) {
    const opened = await attempt(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: ",",
          code: "Comma",
          ctrlKey: variant.ctrlKey,
          altKey: variant.altKey,
          bubbles: true,
          cancelable: true
        })
      );
    });
    if (opened) return;
  }
}
var VERSION_REPO = "zjj1769404838/dsh-git-panel";
var versionPromise = null;
function parseVersion(raw) {
  const text = raw.trim().replace(/^v/iu, "");
  const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(text);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function isNewer(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return false;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}
function fetchLatestVersion() {
  if (versionPromise !== null) return versionPromise;
  versionPromise = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5e3);
    try {
      const response = await fetch(`https://api.github.com/repos/${VERSION_REPO}/releases/latest`, {
        signal: controller.signal,
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!response.ok) return "";
      const data = await response.json();
      if (data.prerelease === true) return "";
      const tag = typeof data.tag_name === "string" ? data.tag_name : "";
      return /-\w+/u.test(tag) ? "" : tag;
    } catch {
      return "";
    } finally {
      window.clearTimeout(timer);
    }
  })();
  return versionPromise;
}
function useLatestVersion(enabled) {
  const [latest, setLatest] = (0, import_react8.useState)("");
  (0, import_react8.useEffect)(() => {
    if (!enabled) return;
    let alive = true;
    void fetchLatestVersion().then((tag) => {
      if (alive && tag !== "" && isNewer(tag, BUILD)) setLatest(tag);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return latest;
}
function BranchChip({ t, sessionId, sessions, shortcuts }) {
  useStyles();
  const [status, setStatus] = (0, import_react8.useState)(null);
  const [detectError, setDetectError] = (0, import_react8.useState)("");
  const [checking, setChecking] = (0, import_react8.useState)(false);
  const [open, setOpen] = (0, import_react8.useState)(false);
  const [workbench, setWorkbench] = (0, import_react8.useState)(false);
  const [wizardOpen, setWizardOpen] = (0, import_react8.useState)(false);
  const [branchDetailOpen, setBranchDetailOpen] = (0, import_react8.useState)(false);
  const [accounts, setAccounts] = (0, import_react8.useState)([]);
  const [repoPermissions, setRepoPermissions] = (0, import_react8.useState)({});
  const [busy, setBusy] = (0, import_react8.useState)(false);
  const [toast, setToast] = (0, import_react8.useState)(null);
  const toastTimerRef = (0, import_react8.useRef)(null);
  const [anchor, setAnchor] = (0, import_react8.useState)({ left: 0, bottom: 0 });
  const latestVersion = useLatestVersion(open);
  const wrapRef = (0, import_react8.useRef)(null);
  const menuRef = (0, import_react8.useRef)(null);
  const cwd = (0, import_react8.useSyncExternalStore)(
    (0, import_react8.useMemo)(() => {
      return (listener) => {
        try {
          const list = sessions?.list;
          return typeof list?.subscribe === "function" ? list.subscribe(listener) : () => {
          };
        } catch {
          return () => {
          };
        }
      };
    }, [sessions]),
    (0, import_react8.useCallback)(() => {
      try {
        if (!sessionId || !sessions) return "";
        const value = sessions.list?.getSnapshot?.()?.byId?.[sessionId]?.cwd;
        return typeof value === "string" ? value : "";
      } catch {
        return "";
      }
    }, [sessionId, sessions]),
    () => ""
  );
  const reload = (0, import_react8.useCallback)(async () => {
    if (!cwd) {
      setStatus(null);
      setDetectError("");
      return;
    }
    setChecking(true);
    try {
      const data = await api(
        `/repo/status?cwd=${encodeURIComponent(cwd)}`
      );
      if (data.ok && data.status) {
        setStatus(data.status);
        setDetectError("");
      } else {
        setStatus(null);
        setDetectError(data.error || t("menuDetectFailed"));
      }
    } catch (error) {
      setStatus(null);
      setDetectError(error.message || t("menuDetectFailed"));
    } finally {
      setChecking(false);
    }
  }, [cwd, t]);
  const loadAccounts = (0, import_react8.useCallback)(async () => {
    try {
      const data = await api("/state");
      if (!data.ok || !data.state) return;
      setAccounts(Array.isArray(data.state.accounts) ? data.state.accounts : []);
      setRepoPermissions(data.state.settings?.repoPermissions ?? {});
    } catch {
    }
  }, []);
  const showToast = (0, import_react8.useCallback)((tone, text) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ tone, text });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  (0, import_react8.useEffect)(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);
  (0, import_react8.useEffect)(() => {
    setStatus(null);
    setDetectError("");
    if (!cwd) return;
    let alive = true;
    const load = () => {
      if (alive && document.visibilityState !== "hidden") void reload();
    };
    load();
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cwd, reload]);
  (0, import_react8.useEffect)(() => {
    if (!open) return;
    const onDown = (event) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  if (!cwd) return null;
  const isRepo = status !== null && status.isRepo;
  const invalidPath = status !== null && !isRepo && status.reason === "invalid";
  const canInit = status !== null && !isRepo && (status.reason ? status.reason === "no-repo" : true);
  const detectFailed = !isRepo && (detectError.length > 0 || invalidPath);
  const detectMessage = detectError || (invalidPath ? status?.error || "" : "") || t("menuDetectFailed");
  const label = !status ? t("entry") : status.detached ? status.head || "HEAD" : status.branch || status.head || t("entry");
  const aux = isRepo ? [status.ahead > 0 ? `\u2191${status.ahead}` : "", status.behind > 0 ? `\u2193${status.behind}` : "", status.changed > 0 ? `${status.changed}*` : ""].filter(Boolean).join(" ") : "";
  const warn = isRepo && status.authorized === false;
  const dirty = isRepo && status.changed > 0;
  const title = !status ? detectFailed ? `${t("entryTitle")} \xB7 ${t("menuDetectFailed")}` : t("entryTitle") : isRepo ? `${t("entryTitle")}${status.root ? " \xB7 " + status.root : ""}${warn ? " \xB7 " + t("unauthorizedRoot") : ""}` : detectFailed ? `${t("entryTitle")} \xB7 ${t("menuDetectFailed")}` : `${t("entryTitle")} \xB7 ${t("notRepo")}`;
  const placeMenu = (0, import_react8.useCallback)(() => {
    const chip = wrapRef.current?.getBoundingClientRect();
    if (!chip) return;
    const menu = menuRef.current?.getBoundingClientRect();
    const gap = 6;
    const width = menu?.width && menu.width > 0 ? menu.width : 260;
    const height = menu?.height && menu.height > 0 ? menu.height : 260;
    const left = Math.min(Math.max(8, chip.left), Math.max(8, window.innerWidth - width - 8));
    const spaceAbove = chip.top - gap;
    const spaceBelow = window.innerHeight - chip.bottom - gap;
    if (spaceAbove >= height || spaceAbove >= spaceBelow) {
      setAnchor({ left: Math.round(left), bottom: Math.round(window.innerHeight - chip.top + gap) });
    } else {
      setAnchor({ left: Math.round(left), top: Math.round(chip.bottom + gap) });
    }
  }, []);
  (0, import_react8.useLayoutEffect)(() => {
    if (!open) return;
    placeMenu();
    const onMove = () => placeMenu();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, placeMenu]);
  const toggle = () => {
    const next = !open;
    if (next) {
      placeMenu();
      void reload();
    }
    setOpen(next);
  };
  const runInit = async () => {
    setBusy(true);
    showToast("info", t("initRunning"));
    try {
      const data = await api("/repo/init", {
        cwd,
        branch: "main"
      });
      if (data.ok) {
        const branch = data.result?.branch ? " \xB7 " + data.result.branch : "";
        showToast("ok", data.result?.created === false ? `${t("alreadyRepo")}${branch}` : `${t("initDone")}${branch}`);
        await reload();
      } else {
        showToast("error", data.error || t("initFailed"));
        await reload();
      }
    } catch (error) {
      showToast("error", `${t("initFailed")}\uFF1A${error.message}`);
    } finally {
      setBusy(false);
    }
  };
  const openDir = async () => {
    try {
      const data = await api(`/repo/open?cwd=${encodeURIComponent(cwd)}`);
      if (data.ok) showToast("ok", t("toastOpened"));
      else showToast("error", data.error || t("openFailed"));
    } catch (error) {
      showToast("error", `${t("openFailed")}\uFF1A${error.message}`);
    }
  };
  const summary = checking && !status ? `${cwd} \xB7 ${t("menuChecking")}` : detectFailed ? `${cwd} \xB7 ${t("menuDetectFailed")}` : !status ? cwd : isRepo ? `${status.root || cwd}${status.branch ? " \xB7 " + status.branch : status.head ? " \xB7 " + status.head : ""}` : `${cwd} \xB7 ${t("notRepo")}`;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dgp-root dgp-chip-wrap", ref: wrapRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "button",
      {
        type: "button",
        className: "dgp-chip",
        "data-warn": warn ? "1" : "0",
        "data-norepo": isRepo ? "0" : "1",
        "data-dirty": dirty ? "1" : "0",
        "data-open": open ? "1" : "0",
        title,
        "aria-label": `${t("entryTitle")}: ${label}`,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        onMouseDown: (event) => event.preventDefault(),
        onClick: toggle,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BranchIcon, {}),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-chip-name", children: label }),
          aux ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-chip-aux", children: aux }) : null,
          warn ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Dot, { state: "error" }) : null
        ]
      }
    ),
    toast ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Toast, { tone: toast.tone, text: toast.text, onDone: () => setToast(null) }) : null,
    open ? (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "span",
        {
          className: "dgp-portal dgp-menu",
          role: "menu",
          ref: menuRef,
          style: {
            left: `${anchor.left}px`,
            ...anchor.top !== void 0 ? { top: `${anchor.top}px` } : { bottom: `${anchor.bottom}px` }
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dgp-menu-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BranchIcon, {}),
              t("menuTitle")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-sum", children: summary }),
            latestVersion !== "" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "a",
              {
                className: "dgp-menu-note",
                "data-tone": "warn",
                href: `https://github.com/${VERSION_REPO}/releases/latest`,
                target: "_blank",
                rel: "noreferrer",
                onMouseDown: (e) => e.preventDefault(),
                onClick: () => setOpen(false),
                children: fmt(t("menuNewVersion"), { v: latestVersion })
              }
            ) : null,
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-sep" }),
            !status && !detectFailed ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-note", "data-tone": "plain", children: t("menuChecking") }) : null,
            detectFailed ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dgp-menu-note", "data-tone": "error", children: [
                t("menuDetectFailed"),
                "\uFF1A",
                detectMessage
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dgp-menu-item",
                  role: "menuitem",
                  disabled: checking,
                  onMouseDown: (e) => e.preventDefault(),
                  onClick: () => void reload(),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RefreshIcon, {}),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-main", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-title", children: t("menuRetry") }) })
                  ]
                }
              )
            ] }) : null,
            canInit ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
              "button",
              {
                type: "button",
                className: "dgp-menu-item",
                role: "menuitem",
                "data-primary": "1",
                disabled: busy,
                onMouseDown: (e) => e.preventDefault(),
                onClick: () => {
                  setOpen(false);
                  setWizardOpen(true);
                  void loadAccounts();
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PlusIcon, {}),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dgp-menu-item-main", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-title", children: t("menuInit") }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-hint", children: t("menuInitHint") })
                  ] })
                ]
              }
            ) : null,
            isRepo ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-group", children: t("menuGroupRepo") }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dgp-menu-item",
                  role: "menuitem",
                  "data-primary": "1",
                  onMouseDown: (e) => e.preventDefault(),
                  onClick: () => {
                    setOpen(false);
                    setWorkbench(true);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BranchIcon, {}),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dgp-menu-item-main", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-title", children: t("wbTitle") }),
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-hint", children: t("wbOpenHint") })
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { type: "button", className: "dgp-menu-item", role: "menuitem", onMouseDown: (e) => e.preventDefault(), onClick: () => void reload(), children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RefreshIcon, {}),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dgp-menu-item-main", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-title", children: t("menuRefresh") }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-hint", children: aux || t("menuRefreshHint") })
                ] })
              ] }),
              status?.branch ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dgp-menu-item",
                  role: "menuitem",
                  onMouseDown: (e) => e.preventDefault(),
                  onClick: () => {
                    setOpen(false);
                    setBranchDetailOpen(true);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BranchIcon, {}),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dgp-menu-item-main", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-title", children: t("branchDetail") }),
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-hint", children: status.branch })
                    ] })
                  ]
                }
              ) : null,
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-sep" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-group", children: t("menuGroupOpen") }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { type: "button", className: "dgp-menu-item", role: "menuitem", onMouseDown: (e) => e.preventDefault(), onClick: () => {
                setOpen(false);
                void openDir();
              }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FolderIcon, {}),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-main", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-title", children: t("menuOpenDir") }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-sep" })
            ] }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
              "button",
              {
                type: "button",
                className: "dgp-menu-item",
                role: "menuitem",
                onMouseDown: (e) => e.preventDefault(),
                onClick: () => {
                  setOpen(false);
                  void openSettingsSection({ shortcuts }, t("navLabel"));
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GearIcon, {}),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-main", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dgp-menu-item-title", children: t("menuSettings") }) })
                ]
              }
            )
          ]
        }
      ),
      document.body
    ) : null,
    workbench ? (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Workbench,
        {
          t,
          cwd,
          status,
          onStatusChange: (next) => setStatus(next),
          onClose: () => {
            setWorkbench(false);
            void reload();
          },
          onOpenSettings: () => void openSettingsSection({ shortcuts }, t("navLabel"))
        }
      ),
      document.body
    ) : null,
    wizardOpen ? (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        InitWizard,
        {
          t,
          cwd,
          accounts,
          authorizedRepos: (accountId) => Object.keys(repoPermissions[accountId] ?? {}),
          shortcuts,
          onQuickInit: () => {
            setWizardOpen(false);
            void runInit();
          },
          onClose: () => setWizardOpen(false),
          onDone: () => {
            void reload();
          }
        }
      ),
      document.body
    ) : null,
    branchDetailOpen && status?.branch ? (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        BranchDetailModal,
        {
          t,
          cwd,
          branch: status.branch,
          onClose: () => setBranchDetailOpen(false)
        }
      ),
      document.body
    ) : null
  ] });
}
function FolderIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M1.8 4.5A1.5 1.5 0 0 1 3.3 3h3l1.5 1.7h4.9A1.5 1.5 0 0 1 14.2 6.2v5.3a1.5 1.5 0 0 1-1.5 1.5H3.3a1.5 1.5 0 0 1-1.5-1.5V4.5Z" }) });
}
function apply(ctx) {
  let t = (key) => ZH[key] ?? key;
  try {
    ctx.locale?.register?.(NS, { zh: ZH, en: EN });
    const bound = ctx.locale?.bind?.(NS);
    if (typeof bound === "function") {
      t = (key) => {
        const value = bound(key);
        return typeof value === "string" && value.length > 0 && value !== key ? value : ZH[key] ?? key;
      };
    }
  } catch (error) {
    ctx.logger?.warn?.(`[${NS}] locale \u6CE8\u518C\u5931\u8D25\uFF1A${String(error)}`);
  }
  const sessions = ctx.sessions;
  const shortcuts = (typeof ctx.get === "function" ? ctx.get("shortcuts") : void 0) ?? ctx.shortcuts;
  try {
    ctx.slots?.inject?.("settings.section", () => {
      try {
        return ctx.slots?.register?.(
          {
            name: "settings.section",
            id: "git-panel",
            order: 20,
            label: () => t("navLabel"),
            locale: NS,
            inject: () => ({ t })
          },
          GitSection
        );
      } catch (error) {
        ctx.logger?.error?.(`[${NS}] settings.section \u6CE8\u518C\u5931\u8D25\uFF1A${String(error)}`);
        return void 0;
      }
    });
    ctx.logger?.info?.(`[${NS}] \u8BBE\u7F6E\u5206\u8282\u5DF2\u6CE8\u518C\uFF08${BUILD}\uFF09`);
  } catch (error) {
    ctx.logger?.error?.(`[${NS}] settings.section \u6CE8\u5165\u5931\u8D25\uFF1A${String(error)}`);
  }
  try {
    ctx.slots?.inject?.("conversation.input.left", () => {
      try {
        return ctx.slots?.register?.(
          {
            name: "conversation.input.left",
            id: "dsh-git-panel-branch",
            order: 30,
            locale: NS,
            inject: (sessionId) => ({ t, sessionId, sessions, shortcuts })
          },
          BranchChip
        );
      } catch (error) {
        ctx.logger?.error?.(`[${NS}] \u5165\u53E3\u6CE8\u518C\u5931\u8D25\uFF1A${String(error)}`);
        return void 0;
      }
    });
    ctx.logger?.info?.(`[${NS}] \u5206\u652F chip \u5DF2\u6CE8\u518C\u5230 conversation.input.left\uFF08${BUILD}\uFF09`);
  } catch (error) {
    ctx.logger?.error?.(`[${NS}] conversation.input.left \u6CE8\u5165\u5931\u8D25\uFF1A${String(error)}`);
  }
}
/*! Bundled license information:

prismjs/prism.js:
  (**
   * Prism: Lightweight, robust, elegant syntax highlighting
   *
   * @license MIT <https://opensource.org/licenses/MIT>
   * @author Lea Verou <https://lea.verou.me>
   * @namespace
   * @public
   *)
*/
return module.exports; } });
