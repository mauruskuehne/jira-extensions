// ==UserScript==
// @name        JIRA Extensions
// @version     2.0.0
// @namespace   https://github.com/mauruskuehne/jira-extensions/
// @updateURL   https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @downloadURL https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @icon        https://github.com/mauruskuehne/jira-extensions/raw/master/icon/jira-extensions.png
// @author      Daniel Dähler, Maurus Kühne, Gottfried Mayer
// @description Additional buttons for jira
// @match       https://innosolv.atlassian.net/*
// @grant       GM_log
// @grant       GM_getValue
// @grant       GM_setValue
// @require     https://code.jquery.com/jquery-3.6.1.min.js
// @run-at      document-idle
// ==/UserScript==

/* Inspirations:
https://gist.github.com/garrettheath4/129a2a70a2dcbfa0136efe43c52b820c
https://gist.github.com/dennishall/6cb8487f6ee8a3705ecd94139cd97b45
*/

/**
 * Ersetzungsvariablen Format:
 * {0} Vorgangsnummer (z.B. EN-121)
 * {1} Zusammenfassung (z.B. Erweiterung foobar)
 * {2} Prefix für Commit (z.B. fix oder feat) -- "feat" bei Änderungstyp=Anforderung, sonst "fix".
 *
 *
 */

 (function () {
  'use strict';

  // Set extra buttons: Uncomment, run extension once (reload jira page), comment again.
  // example 1: no extra buttons
  //GM_setValue("extraButtons", []);
  // example 2: two extra buttons for "Issue No." and "PV document name")
  //GM_setValue("extraButtons", [
  //    {text: "No.", title: "Vorgangnummer kopieren", format: "{0}"},
  //    {text: "PV", title: "PV Dateiname kopieren", format: "{0} PV.docx"}
  //]);

  let commitMessageButtonTimer;

  /**
     * Copies text to the clipboard
     * @param text
     */
  function copy(text) {
    navigator.clipboard.writeText(text).then(
      function () {
        console.log('success, copied text.');
      },
      function (err) {
        console.error('Could not copy text: ', err);
      }
    );
  }

  /**
   * Momentarily changes button background to green, to inform the user of successful copy to clipboard
   * @param e
   */
  function flashCopiedMessage(e) {
    if (e) {
      const prevVal = this.hasAttribute('style') ? this.getAttribute('style') : null;
      this.setAttribute('style', 'background-color:lightgreen;');
      setTimeout(() => {
        if (prevVal !== null) {
          this.setAttribute('style', prevVal);
        } else {
          this.removeAttribute('style');
        }
      }, 500);
    }
  }

  /**
 * Gets the Title, JIRA "Number" (ID, such as NOW-1000), and title in
 * @return {{}|{title: String, jiraNumber: String, prefix: String}}
 */
  function getData() {
    const issueLink = (
      // backlog view, detail view
      document.querySelector('[data-test-id*="current-issue"] a')
      // kanban view
      || document.querySelector('.ghx-selected a')
    );
    if (!issueLink) {
      // alert('No active issue, please select an issue first.');
      return;
    }
    const jiraNumber = issueLink.dataset.tooltip || issueLink.innerText;
    let prefix = "fix";
    if(jiraNumber.startsWith("EN")) {
      const aenderungstyp = document.querySelector('[data-testid*="customfield_10142.field-inline-edit-state"]');
      if(aenderungstyp && aenderungstyp.innerText == "Anforderung") {
        prefix = "feat"
      }
    }
    const title = (
      // kanban view with ticket details in a modal
      document.querySelector('[data-test-id*="summary.heading"]')
      // kanban view
      || document.querySelector('.ghx-selected .ghx-summary')
      // backlog view, detail view
      || Array.from(document.querySelectorAll('h1')).pop()
    ).innerText;

    return {
      jiraNumber,
      title,
      prefix,
    };
  }

  function getDataAndFormat(format) {
    const fmt = format || "{1} {2}";
    const { jiraNumber, title, prefix } = getData();
    if(!jiraNumber || !title || !prefix) return;
    let txtToCopy = fmt.split("{0}").join(jiraNumber);
    txtToCopy = txtToCopy.split("{1}").join(title);
    if (txtToCopy.includes("{2}")) {
      txtToCopy = txtToCopy.split("{2}").join(prefix);
    }
    return txtToCopy;
  }

  function buttonClicked (e) {
    e = e || window.event;
    let targ = e.target || e.srcElement;
    if (targ.nodeType == 3) targ = targ.parentNode; // defeat Safari bug
    if (!targ.hasAttribute('data-format')) { targ = targ.parentNode; } // if click event target was sub-node (i.E. span), use parent node.
    if (targ.hasAttribute('data-format')) {
      const fmt = targ.getAttribute('data-format');
      const txt = getDataAndFormat(fmt);
      copy(txt);
      flashCopiedMessage.bind(targ)(e);
      //return txt;
    } else {
      GM_log("ignoring click, attribute data-format not found.");
    }
    e.preventDefault();
    return false;
  }


  function addCopyCommitMessageHeaderButton(jNode) {
    const classes = jNode.children('button').first().attr('class');
    const commitButtonId = "commit-header-btn";

    clearInterval(commitMessageButtonTimer);

    const existing = document.getElementById(commitButtonId);
    if (existing == null) {

      let createBtn = function (id, isMainBtn, txt, title, fmt) {
        let btn = document.createElement("button");
        btn.id = id;
        btn.className = classes;
        btn.href = "#";
        btn.title = title;
        btn.setAttribute('data-format', fmt);
        //if (isMainBtn) {
        //  let ico = document.createElement("span");
        //  ico.className = "icon aui-icon aui-icon-small aui-iconfont-copy";
        //  ico.style = "margin-right:4px;";
        //  btn.appendChild(ico);
        //}
        let lbl = document.createElement("span");
        //lbl.className = "trigger-label";
        lbl.innerText = txt;
        btn.appendChild(lbl);
        btn.onclick = buttonClicked; // onclick function
        return btn;
      }

      // create main button
      let button = createBtn(commitButtonId, true, "📃", "git commit Nachricht kopieren", "{2}: {1} [{0}]");
      jNode.append(button);

      // create additional buttons
      let extraButtons = GM_getValue("extraButtons", [
        { text: "🍕", title: "Vorgangnummer kopieren", format: "{0}" },
        { text: "💩", title: "SQL Migration", format: "{0} {1}" },
        { text: "🌲", title: "git branch name", format: "feature/{0}" }
      ]);
      extraButtons.forEach(function (e, i) {
        jNode.append(createBtn("commit-header-" + i, false, e.text, e.title, e.format));
      });

      // create "edit preferences" buttons
      //TODO
    }
  }

  GM_log("Start watching for action bar.");

  waitForKeyElements('[data-test-id*="status.actions-wrapper"] div', addCopyCommitMessageHeaderButton, false);
})();



/* global $ */

/*--- waitForKeyElements():  A utility function, for Greasemonkey scripts,
      that detects and handles AJAXed content.
Source: https://gist.githubusercontent.com/raw/2625891/waitForKeyElements.js

      IMPORTANT: This function requires your script to have loaded jQuery.
*/
/**
 *
 * @param {string} selectorTxt jQuery selector that specifies the desired element(s).
 * @param {function} actionFunction code to run when elements are found. It is passed as jNode to the matched element.
 * @param {bool} bWaitOnce If false, will continue to scan for new elements even after the first match is found.
 * @param {string} iframeSelector If set, identifies the iFrame to search.
 */
function waitForKeyElements(selectorTxt, actionFunction, bWaitOnce, iframeSelector) {
  let targetNodes, btargetsFound;

  if (typeof iframeSelector == "undefined") {
    targetNodes = $(selectorTxt);
  } else {
    targetNodes = $(iframeSelector).contents().find(selectorTxt);
  }

  if (targetNodes && targetNodes.length > 0) {
    btargetsFound = true;
    targetNodes.each(function () {
      let jThis = $(this);
      let alreadyFound = jThis.data('alreadyFound') || false;

      if (!alreadyFound) {
        let cancelFound = actionFunction(jThis);
        if (cancelFound) {
          btargetsFound = false;
        } else {
          jThis.data('alreadyFound', true);
        }
      }
    });
  }
  else {
    btargetsFound = false;
  }

  //--- Get the timer-control variable for this selector.
  let controlObj = waitForKeyElements.controlObj || {};
  let controlKey = selectorTxt.replace(/[^\w]/g, "_");
  let timeControl = controlObj[controlKey];

  //--- Now set or clear the timer as appropriate.
  if (btargetsFound && bWaitOnce && timeControl) {
    //--- The only condition where we need to clear the timer.
    clearInterval(timeControl);
    delete controlObj[controlKey]
  }
  else {
    //--- Set a timer, if needed.
    if (!timeControl) {
      timeControl = setInterval(function () {
        waitForKeyElements(selectorTxt, actionFunction, bWaitOnce, iframeSelector);
      }, 300);
      controlObj[controlKey] = timeControl;
    }
  }
  waitForKeyElements.controlObj = controlObj;
}