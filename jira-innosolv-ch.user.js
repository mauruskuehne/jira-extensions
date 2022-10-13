// ==UserScript==
// @name        JIRA Extensions
// @version     2.0.1
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

  /*
  svg icons source:
  https://www.svgrepo.com/collection/boxicons-interface-icons
  */
  const svg_MessageAltEdit = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8.586 18 12 21.414 15.414 18H19c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2H5c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h3.586zM5 4h14v12h-4.414L12 18.586 9.414 16H5V4z"/><path d="m12.479 7.219-4.977 4.969v1.799h1.8l4.975-4.969zm2.219-2.22 1.8 1.8-1.37 1.37-1.8-1.799z"/></svg>';
  const svg_TargetLock = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M13 4.069V2h-2v2.069A8.008 8.008 0 0 0 4.069 11H2v2h2.069A8.007 8.007 0 0 0 11 19.931V22h2v-2.069A8.007 8.007 0 0 0 19.931 13H22v-2h-2.069A8.008 8.008 0 0 0 13 4.069zM12 18c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6z"/></svg>';
  const svg_Hash = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.018 3.815 15.232 8h-4.966l.716-3.815-1.964-.37L8.232 8H4v2h3.857l-.751 4H3v2h3.731l-.714 3.805 1.965.369L8.766 16h4.966l-.714 3.805 1.965.369.783-4.174H20v-2h-3.859l.751-4H21V8h-3.733l.716-3.815-1.965-.37zM14.106 14H9.141l.751-4h4.966l-.752 4z"/></svg>';
  const svg_GitBranch = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.5 4C15.57 4 14 5.57 14 7.5c0 1.554 1.025 2.859 2.43 3.315-.146.932-.547 1.7-1.23 2.323-1.946 1.773-5.527 1.935-7.2 1.907V8.837c1.44-.434 2.5-1.757 2.5-3.337C10.5 3.57 8.93 2 7 2S3.5 3.57 3.5 5.5c0 1.58 1.06 2.903 2.5 3.337v6.326c-1.44.434-2.5 1.757-2.5 3.337C3.5 20.43 5.07 22 7 22s3.5-1.57 3.5-3.5c0-.551-.14-1.065-.367-1.529 2.06-.186 4.657-.757 6.409-2.35 1.097-.997 1.731-2.264 1.904-3.768C19.915 10.438 21 9.1 21 7.5 21 5.57 19.43 4 17.5 4zm-12 1.5C5.5 4.673 6.173 4 7 4s1.5.673 1.5 1.5S7.827 7 7 7s-1.5-.673-1.5-1.5zM7 20c-.827 0-1.5-.673-1.5-1.5a1.5 1.5 0 0 1 1.482-1.498l.13.01A1.495 1.495 0 0 1 7 20zM17.5 9c-.827 0-1.5-.673-1.5-1.5S16.673 6 17.5 6s1.5.673 1.5 1.5S18.327 9 17.5 9z"/></svg>';
  const svg_Data = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 17V7c0-2.168-3.663-4-8-4S4 4.832 4 7v10c0 2.168 3.663 4 8 4s8-1.832 8-4zM12 5c3.691 0 5.931 1.507 6 1.994C17.931 7.493 15.691 9 12 9S6.069 7.493 6 7.006C6.069 6.507 8.309 5 12 5zM6 9.607C7.479 10.454 9.637 11 12 11s4.521-.546 6-1.393v2.387c-.069.499-2.309 2.006-6 2.006s-5.931-1.507-6-2V9.607zM6 17v-2.393C7.479 15.454 9.637 16 12 16s4.521-.546 6-1.393v2.387c-.069.499-2.309 2.006-6 2.006s-5.931-1.507-6-2z"/></svg>';

  /**
   * Momentarily changes button background to green, to inform the user of successful copy to clipboard
   * @param e
   */
  function flashCopiedMessage(e, success) {
    if (e) {
      const prevVal = this.hasAttribute('style') ? this.getAttribute('style') : null;
      if (success) {
        this.setAttribute('style', 'background-color:lightgreen;');
      } else {
        this.setAttribute('style', 'background-color:lightred;');
      }
      setTimeout(() => {
        if (prevVal !== null) {
          this.setAttribute('style', prevVal);
        } else {
          this.removeAttribute('style');
        }
      }, 1000);
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
      // no active issue found
      return;
    }
    const jiraNumber = issueLink.dataset.tooltip || issueLink.innerText;
    let prefix = "fix";
    if (jiraNumber.startsWith("G3")) {
      prefix = "feat";
    } else if (jiraNumber.startsWith("EN")) {
      const aenderungstyp = document.querySelector('[data-testid*="customfield_10142.field-inline-edit-state"]');
      if (aenderungstyp && aenderungstyp.innerText == "Anforderung") {
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
    if (!jiraNumber || !title || !prefix) return;
    let txtToCopy = fmt.split("{0}").join(jiraNumber);
    txtToCopy = txtToCopy.split("{1}").join(title);
    if (txtToCopy.includes("{2}")) {
      txtToCopy = txtToCopy.split("{2}").join(prefix);
    }
    return txtToCopy;
  }

  function searchParentOfType(node, name, search = 5) {
    if (search <= 1) {
      return node;
    }
    if (node && node.parentNode) {
      const parent = node.parentNode;
      if (parent.nodeName == name) {
        return parent;
      }
      return searchParentOfType(parent, name, search - 1);
    } else {
      return node;
    }
  }

  function buttonClicked(e) {
    e = e || window.event;
    let targ = e.target || e.srcElement;
    if (targ.nodeType == 3) targ = targ.parentNode; // defeat Safari bug
    const targBtn = searchParentOfType(targ, "BUTTON");
    if (targBtn.hasAttribute('data-format')) {
      const fmt = targBtn.getAttribute('data-format');
      const txt = getDataAndFormat(fmt);
      // copy text to clipboard
      navigator.clipboard.writeText(txt).then(
        function () {
          flashCopiedMessage.bind(targBtn)(e, true);
        },
        function (err) {
          flashCopiedMessage.bind(targBtn)(e, false);
        }
      );
    } else {
      GM_log("ignoring click, attribute data-format not found.");
    }
  }


  function addCopyCommitMessageHeaderButton(node) {
    const buttonStyles = ".inno-btn{-webkit-box-align:baseline;align-items:baseline;border-width:0px;border-radius:3px;box-sizing:border-box;display:inline-flex;font-size:inherit;font-style:normal;font-family:inherit;" +
      "font-weight:500;max-width:100%;position:relative;text-align:center;text-decoration:none;transition:background 0.1s ease-out 0s,box-shadow 0.15s cubic-bezier(0.47, 0.03, 0.49, 1.38) 0s;white-space:nowrap;" +
      "background:rgba(0,88,165,0.05);cursor:pointer;height:2.28571em;line-height:2.28571em;padding:0 5px;vertical-align:middle;width:auto;-webkit-box-pack:center;" +
      "justify-content:center;color:#0058a5;}" +
      ".inno-btn svg{vertical-align:text-bottom;width:19px;height:auto;fill:currentColor;}" +
      ".inno-btn:hover{background:rgba(0,88,165,0.15);text-decoration:inherit;transition-duration:0s, 0.15s;color:#0058a5;}" +
      ".inno-btn:focus{background:rgba(0,88,165,0.15);box-shadow:none;transition-duration:0s,0.2s;outline:none;color:#0058a5;}"+
      ".inno-btn-container{display:inline-flex;overflow:hidden;animation-duration:0.5s;animation-iteration-count:1;animation-name:none;animation-timing-function:linear;white-space:nowrap;text-overflow:ellipsis;margin:0 4px;}";
    const commitButtonId = "commit-header-btn";

    const existing = document.getElementById(commitButtonId);
    if (existing == null) {
      let style = document.createElement("style");
      style.innerText = buttonStyles;
      node.appendChild(style);

      let createBtn = function (id, txt, title, fmt, icon) {
        let btn = document.createElement("button");
        btn.id = id;
        btn.className = "inno-btn";
        btn.title = title;
        btn.setAttribute('data-format', fmt);
        let lbl = document.createElement("span");
        if (icon) {
          lbl.innerHTML = icon;
        } else {
          lbl.innerText = txt;
        }
        btn.appendChild(lbl);
        btn.onclick = buttonClicked; // onclick function
        return btn;
      }

      let container = document.createElement("div");
      container.className = "inno-btn-container";
      // create main button
      container.appendChild(createBtn(commitButtonId, "Msg", "git commit Nachricht kopieren", "{2}: {1} [{0}]", svg_MessageAltEdit));

      // create additional buttons
      let extraButtons = GM_getValue("extraButtons", [
        { text: "No.", title: "Vorgangnummer kopieren", format: "{0}", icon: svg_Hash },
        { text: "Branch", title: "git branch name kopieren", format: "feature/{0}", icon: svg_GitBranch },
        { text: "Mig.", title: "SQL Migration kopieren", format: "{0} {1}", icon: svg_Data },
      ]);
      extraButtons.forEach(function (e, i) {
        container.appendChild(createBtn("commit-header-" + i, e.text, e.title, e.format, e.icon));
      });
      node.appendChild(container);

      // create "edit preferences" buttons
      //TODO
    }
  }

  function addTempoIntegration(node) {
    let style = document.createElement("style");
    let div = document.createElement('div');
    let span = document.createElement('span');
    span.innerText = "Tempo";
    div.appendChild(span);
    node.parentNode.insertBefore(div, node.nextSibling);

  }

  function showTempoConfigDialog(e) {
    window.alert("not implemented yet.");

    e.preventDefault();
    return false;
  }

  function addTempoConfigMenuItem(node) {
    if(node.innerText == "KONTO") {
      const parent = node.parentNode;
      let style = document.createElement("style");
      style.innerText = ".inno-config-lnk{display:flex;box-sizing:border-box;width:100%;min-height:40px;margin:0px;padding:8px 20px;-webkit-box-align:center;align-items:center;border:0px;font-size:14px;outline:0px;"+
          "text-decoration:none;user-select:none;background-color:transparent;color:#0058a5;cursor:pointer;}"+
          ".inno-config-lnk:hover{background-color:rgba(0,88,165,0.15);color:#0058a5;text-decoration:none;}"+
          ".inno-config-lnk:focus{background-color:transparent;color:#0058a5;text-decoration:none;}";
      parent.appendChild(style);
      let lnk = document.createElement("a");
      lnk.className = "inno-config-lnk";
      lnk.href="#";
      lnk.innerText = "⚙ Jira Extension";
      lnk.onclick = showTempoConfigDialog;
      parent.appendChild(lnk);
    }
  }

  GM_log("Start watching for action bar.");

  // additional copy buttons
  waitForKeyElements('[data-test-id="issue.views.issue-base.foundation.status.actions-wrapper"]', addCopyCommitMessageHeaderButton, false);
  // config menu for tempo
  waitForKeyElements('div[data-ds--menu--heading-item="true"]', addTempoConfigMenuItem, false);
  // tempo integration
  waitForKeyElements('div[data-testid="create-button-wrapper"]', addTempoIntegration, false);
})();



// source: https://gist.github.com/mjblay/18d34d861e981b7785e407c3b443b99b#file-waitforkeyelements-js
/*--- waitForKeyElements():  A utility function, for Greasemonkey scripts,
    that detects and handles AJAXed content. Forked for use without JQuery.
    IMPORTANT: Without JQuery, this fork does not look into the content of
    iframes.
*/
/**
 *
 * @param {string} selectorTxt jQuery selector that specifies the desired element(s).
 * @param {function} actionFunction code to run when elements are found. It is passed as jNode to the matched element.
 * @param {bool} bWaitOnce If false, will continue to scan for new elements even after the first match is found.
 * @param {string} iframeSelector If set, identifies the iFrame to search.
 */
function waitForKeyElements(selectorTxt, actionFunction, bWaitOnce) {
  let targetNodes, btargetsFound;
  targetNodes = document.querySelectorAll(selectorTxt);

  if (targetNodes && targetNodes.length > 0) {
    btargetsFound = true;
    targetNodes.forEach(function (element) {
      const alreadyFound = element.dataset.found == 'alreadyFound' ? 'alreadyFound' : false;
      if (!alreadyFound) {
        const cancelFound = actionFunction(element);
        if (cancelFound) {
          btargetsFound = false;
        } else {
          element.dataset.found = 'alreadyFound';
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
    delete controlObj[controlKey];
  }
  else {
    //--- Set a timer, if needed.
    if (!timeControl) {
      timeControl = setInterval(function () {
        waitForKeyElements(selectorTxt, actionFunction, bWaitOnce);
      }, 300);
      controlObj[controlKey] = timeControl;
    }
  }
  waitForKeyElements.controlObj = controlObj;
}