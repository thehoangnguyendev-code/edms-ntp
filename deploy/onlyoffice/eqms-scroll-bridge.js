/*
 * EQMS side-by-side scroll bridge. Added by deploy/onlyoffice/Dockerfile to the document editor page of this Document Server.
 *
 * The EQMS page cannot read or move the scroll position of an editor in another origin, and the DocsAPI has no scroll call. This script runs inside the editor page and does
 * only that: after the page that embeds the editor asks ("attach"), it reports the vertical scroll position and moves it on request. It reads and changes nothing of the
 * document. It listens to its parent window only. It uses the editor's internal WordControl, so it is tied to the pinned ONLYOFFICE_VERSION: if those names change,
 * it never answers "ready" and EQMS says that synchronised scrolling is unavailable.
 */
(function () {
  "use strict";
  var CHANNEL = "eqms-scroll";
  var parentOrigin = null;
  var timer = null;
  var last = "";

  function control() {
    var editor = window.Asc && window.Asc.editor;
    var word = editor && editor.WordControl;
    if (!word || !word.m_oScrollVerApi || typeof word.m_oScrollVerApi.scrollToY !== "function") return null;
    if (typeof word.m_dScrollY !== "number" || typeof word.m_nZoomValue !== "number" || word.m_nZoomValue <= 0) return null;
    return word;
  }

  /* Positions are given at 100 % zoom, so two editors at different zoom still agree on the place in the text. */
  function position(word) {
    var scale = word.m_nZoomValue / 100;
    return { y: word.m_dScrollY / scale, max: (word.m_dScrollY_max || 0) / scale };
  }

  function send(kind, extra) {
    if (!parentOrigin) return;
    var message = { channel: CHANNEL, kind: kind };
    for (var name in extra) message[name] = extra[name];
    window.parent.postMessage(message, parentOrigin);
  }

  function watch() {
    var word = control();
    if (!word) return;
    var now = position(word);
    var signature = now.y.toFixed(1) + "|" + now.max.toFixed(1);
    if (signature !== last) {
      last = signature;
      send("position", now);
    }
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent || !event.data || event.data.channel !== CHANNEL) return;
    var word = control();
    if (!word) return;
    if (event.data.kind === "attach") {
      parentOrigin = event.origin;
      var now = position(word);
      last = now.y.toFixed(1) + "|" + now.max.toFixed(1);
      send("ready", now);
      if (!timer) timer = window.setInterval(watch, 40);
    } else if (event.data.kind === "scrollTo" && event.origin === parentOrigin && typeof event.data.y === "number") {
      var scale = word.m_nZoomValue / 100;
      var target = Math.max(0, Math.min(event.data.y * scale, word.m_dScrollY_max || 0));
      word.m_oScrollVerApi.scrollToY(target);
      /* The move that was asked for is not reported back as the user's own scrolling. */
      var after = position(word);
      last = after.y.toFixed(1) + "|" + after.max.toFixed(1);
    }
  });
})();
