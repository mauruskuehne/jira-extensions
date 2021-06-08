// ==UserScript==
// @name        JIRA Extensions
// @version     1.5.4
// @namespace   https://github.com/mauruskuehne/jira-extensions/
// @updateURL   https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @download    https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @icon        https://fuse314.github.io/ico/jira-extensions.png
// @author      Daniel Dähler, Maurus Kühne, Gottfried Mayer
// @include     https://jira.innosolv.ch/*
// @grant       GM_log
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Set extra buttons: Uncomment, run extension once (reload jira page), comment again.
    // example 1: no extra buttons
    //GM_setValue("extraButtons", []);
    // example 2: two extra buttons for "Issue No." and "PV document name")
    //GM_setValue("extraButtons", [
    //    {text: "No.", title: "Vorgangnummer kopieren", format: "{0}"},
    //    {text: "PV", title: "PV Dateiname kopieren", format: "{0} PV.docx"}
    //]);

    GM_addStyle('#header>.aui-header.aui-dropdown2-trigger-group{border-bottom:1px solid #dedede;}'); // korrigiert dunkle Linie im Header

    var commitMessageButtonTimer;

    //https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
    function copyTextToClipboard(text) {
        var textArea = document.createElement("textarea");
        textArea.style="position:fixed;top:0;left:0;width=2em;height=2em;padding=0;border=none;outline=none;boxShadow=none;background=transparent;";

        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();

        var successful = false;
        try {
            successful = document.execCommand('copy');
        } catch (err) {
            console.log(err);
        }
        document.body.removeChild(textArea);
        return successful;
    }

    function addCopyCommitMessageHeaderButton() {
        var source = document.getElementById("opsbar-jira.issue.tools");

        if(source == null) {
            return;
        }

        var commitButtonId = "commit-header-btn";

        clearInterval(commitMessageButtonTimer);

        var existing = document.getElementById(commitButtonId);
        if(existing == null) {
            var clickFnc = function(e) {
                e = e || window.event;
                var targ = e.target || e.srcElement;
                if (targ.nodeType == 3) targ = targ.parentNode; // defeat Safari bug
                if(!targ.hasAttribute('data-format')) { targ = targ.parentNode; } // if click event target was sub-node (i.E. span), use parent node.
                if(targ.hasAttribute('data-format')) {
                  var fmt = targ.getAttribute('data-format');

                  var parentIssueSummary = document.getElementById("parent_issue_summary");
                  var taskNr = "";
                  var taskText = "";

                  if(parentIssueSummary != null) {
                    taskNr = parentIssueSummary.getAttribute("data-issue-key");
                    taskText = parentIssueSummary.title;
                  } else {
                    taskNr = document.getElementById("key-val").innerText;
                    taskText = document.getElementById("summary-val").innerText;
                  }
                  var txtToCopy = fmt.split("{0}").join(taskNr);
                  txtToCopy = txtToCopy.split("{1}").join(taskText);
                  var copied = copyTextToClipboard(txtToCopy);
                  var cleanupStyle = function() {
                    if(targ.hasAttribute('style')) {
                      targ.removeAttribute('style');
                    }
                  }
                  if(copied) {
                    targ.setAttribute('style','background-color:lightgreen;');
                    window.setTimeout(cleanupStyle,500);
                  } else {
                    targ.setAttribute('style','background-color:lightred;');
                    window.setTimeout(cleanupStyle,500);
                  }
                } else {
                    GM_log("ignoring click, attribute data-format not found.");
                }
                e.preventDefault();
                return false;
            }

            var createBtn = function(id, isMainBtn, txt, title, fmt, clFunc) {
                var a = document.createElement("a");
                a.id = id;
                a.className = "aui-button toolbar-trigger";
                a.href = "#";
                a.title = title;
                a.setAttribute('data-format',fmt);
                if(isMainBtn) {
                var ico = document.createElement("span");
                ico.className = "icon aui-icon aui-icon-small aui-iconfont-copy";
                ico.style="margin-right:4px;";
                a.appendChild(ico);
                }
                var lbl = document.createElement("span");
                lbl.className = "trigger-label";
                lbl.innerText = txt;
                a.appendChild(lbl);
                a.onclick = clFunc; // onclick function
                return a;
            }

            // create main button
            var btn = createBtn(commitButtonId, true, "Copy", "Commit Message Header kopieren", "{0}: {1}", clickFnc);
            source.appendChild(btn);

            // create additional buttons
            var extraButtons = GM_getValue("extraButtons", [
                {text: "No.", title: "Vorgangnummer kopieren", format: "{0}"}
            ]);
            extraButtons.forEach(function(e,i){
                var extraBtn = createBtn("commit-header-"+i, false, e.text, e.title, e.format, clickFnc);
                source.appendChild(extraBtn);
            });

            // create "edit preferences" buttons
            //TODO
        }
    }


    // I don't know of a better way of dealing with the ajax than to check every second until
    // we find the elements we want.
    GM_log("Timer starting.");
    commitMessageButtonTimer = setInterval(addCopyCommitMessageHeaderButton, 1000);

    document.body.addEventListener('click', function() {
        clearInterval(commitMessageButtonTimer);
        commitMessageButtonTimer = setInterval(addCopyCommitMessageHeaderButton, 1000);
    }, true);

})();
