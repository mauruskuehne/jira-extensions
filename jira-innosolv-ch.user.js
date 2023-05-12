// ==UserScript==
// @name        JIRA Extensions
// @version     2.0.7
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
// @grant       GM_xmlhttpRequest
// @connect     api.tempo.io
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

/* global GM_getValue, GM_setValue, GM_log, GM_xmlhttpRequest */
(function () {
  'use strict';

  // tempo cloud API base URL.
  const tempoBaseUrl = 'https://api.tempo.io/core/3/';
  // tempo frontend link.
  const tempoLink = 'https://innosolv.atlassian.net/plugins/servlet/ac/io.tempo.jira/tempo-app';
  const tempoConfigLink = tempoLink + '#!/configuration/api-integration';
  // cache time periods for x days in local storage.
  const periodsCacheValidForDays = 1;
  // cache approval data for x hours in local storage.
  const approvalCacheValidForHours = 4;
  // delay to update tempo display: jira/wiki sometimes remove/recreate the "create" button.
  const tempoUpdateDelayMs = 1500;
  // setTimeout handle to avoid firing multiple times.
  let tempoUpdateTimer = 0;
  // configuration dialog id
  const extConfigDialogId = 'jiraExtConfigDialog';
  const extConfigDialogEditButtonId = 'jiraExtConfigDialogEditButtonDialog';
  const extConfigDialogTempoDetailsId = 'jiraExtConfigDialogTempoDetails';
  const extConfigDialogTempoApproverId = 'jiraExtConfigDialogTempoApprover';
  // tempo integration id
  const tempoId = 'inno-tempo';
  // configuration menu item id
  const configMenuItemId = 'inno-config-lnk';
  // disable extension for these urls
  const disabledUrls = ['/wiki/', '/plugins/'];

  /*
  svg icons source:
  https://www.svgrepo.com/collection/boxicons-interface-icons/
  github repo:
  https://github.com/atisawd/boxicons/tree/master/svg/regular
  */
  const svgMessageAltEdit = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8.586 18 12 21.414 15.414 18H19c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2H5c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h3.586zM5 4h14v12h-4.414L12 18.586 9.414 16H5V4z"/><path d="m12.479 7.219-4.977 4.969v1.799h1.8l4.975-4.969zm2.219-2.22 1.8 1.8-1.37 1.37-1.8-1.799z"/></svg>';
  const svgHash = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.018 3.815 15.232 8h-4.966l.716-3.815-1.964-.37L8.232 8H4v2h3.857l-.751 4H3v2h3.731l-.714 3.805 1.965.369L8.766 16h4.966l-.714 3.805 1.965.369.783-4.174H20v-2h-3.859l.751-4H21V8h-3.733l.716-3.815-1.965-.37zM14.106 14H9.141l.751-4h4.966l-.752 4z"/></svg>';
  const svgGitBranch = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.5 4C15.57 4 14 5.57 14 7.5c0 1.554 1.025 2.859 2.43 3.315-.146.932-.547 1.7-1.23 2.323-1.946 1.773-5.527 1.935-7.2 1.907V8.837c1.44-.434 2.5-1.757 2.5-3.337C10.5 3.57 8.93 2 7 2S3.5 3.57 3.5 5.5c0 1.58 1.06 2.903 2.5 3.337v6.326c-1.44.434-2.5 1.757-2.5 3.337C3.5 20.43 5.07 22 7 22s3.5-1.57 3.5-3.5c0-.551-.14-1.065-.367-1.529 2.06-.186 4.657-.757 6.409-2.35 1.097-.997 1.731-2.264 1.904-3.768C19.915 10.438 21 9.1 21 7.5 21 5.57 19.43 4 17.5 4zm-12 1.5C5.5 4.673 6.173 4 7 4s1.5.673 1.5 1.5S7.827 7 7 7s-1.5-.673-1.5-1.5zM7 20c-.827 0-1.5-.673-1.5-1.5a1.5 1.5 0 0 1 1.482-1.498l.13.01A1.495 1.495 0 0 1 7 20zM17.5 9c-.827 0-1.5-.673-1.5-1.5S16.673 6 17.5 6s1.5.673 1.5 1.5S18.327 9 17.5 9z"/></svg>';
  const svgData = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 17V7c0-2.168-3.663-4-8-4S4 4.832 4 7v10c0 2.168 3.663 4 8 4s8-1.832 8-4zM12 5c3.691 0 5.931 1.507 6 1.994C17.931 7.493 15.691 9 12 9S6.069 7.493 6 7.006C6.069 6.507 8.309 5 12 5zM6 9.607C7.479 10.454 9.637 11 12 11s4.521-.546 6-1.393v2.387c-.069.499-2.309 2.006-6 2.006s-5.931-1.507-6-2V9.607zM6 17v-2.393C7.479 15.454 9.637 16 12 16s4.521-.546 6-1.393v2.387c-.069.499-2.309 2.006-6 2.006s-5.931-1.507-6-2z"/></svg>';
  const svgTempo = '<svg width="18px" height="18px" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M9 2.02a6.98 6.98 0 1 1 0 13.96A6.98 6.98 0 0 1 9 2.02M9 18A9 9 0 1 0 9 0a9 9 0 0 0 0 18"/><path d="M11.2 6.07 8.32 8.73c-.1.09-.26.09-.36 0L6.8 7.63a.27.27 0 0 0-.36 0L5.07 8.89c-.1.1-.1.24 0 .33L8 11.93c.1.1.26.1.36 0l4.58-4.25c.1-.1.1-.24 0-.33l-1.38-1.28a.27.27 0 0 0-.36 0"/></g></svg>';
  const svgRefresh = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M10 11H7.101l.001-.009a4.956 4.956 0 0 1 .752-1.787 5.054 5.054 0 0 1 2.2-1.811c.302-.128.617-.226.938-.291a5.078 5.078 0 0 1 2.018 0 4.978 4.978 0 0 1 2.525 1.361l1.416-1.412a7.036 7.036 0 0 0-2.224-1.501 6.921 6.921 0 0 0-1.315-.408 7.079 7.079 0 0 0-2.819 0 6.94 6.94 0 0 0-1.316.409 7.04 7.04 0 0 0-3.08 2.534 6.978 6.978 0 0 0-1.054 2.505c-.028.135-.043.273-.063.41H2l4 4 4-4zm4 2h2.899l-.001.008a4.976 4.976 0 0 1-2.103 3.138 4.943 4.943 0 0 1-1.787.752 5.073 5.073 0 0 1-2.017 0 4.956 4.956 0 0 1-1.787-.752 5.072 5.072 0 0 1-.74-.61L7.05 16.95a7.032 7.032 0 0 0 2.225 1.5c.424.18.867.317 1.315.408a7.07 7.07 0 0 0 2.818 0 7.031 7.031 0 0 0 4.395-2.945 6.974 6.974 0 0 0 1.053-2.503c.027-.135.043-.273.063-.41H22l-4-4-4 4z"/></svg>';
  const svgInfoCircle = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/><path d="M11 11h2v6h-2zm0-4h2v2h-2z"/></svg>';

  const defaultButton = {
    text: 'Msg',
    title: 'git commit Nachricht kopieren',
    format: '{2}: {1} [{0}]',
    icon: svgMessageAltEdit,
  };
  const defaultExtraButtons = [
    {
      text: 'No.', title: 'Vorgangnummer kopieren', format: '{0}', icon: svgHash,
    },
    {
      text: 'Branch', title: 'git branch Name kopieren', format: 'feature/{0}', icon: svgGitBranch,
    },
    {
      text: 'Mig.', title: 'SQL Migration kopieren', format: '{0} {1}', icon: svgData,
    },
  ];

  /* style definitions */
  const copyButtonStyles = '.inno-btn{-webkit-box-align:baseline;align-items:baseline;border-width:0;' +
    'border-radius:0.22em;box-sizing:border-box;display:inline-flex;font-size:inherit;font-style:normal;' +
    'font-family:inherit;font-weight:500;max-width:100%;position:relative;text-align:center;text-decoration:none;' +
    'transition:background 0.1s ease-out 0s,box-shadow 0.15s cubic-bezier(0.47, 0.03, 0.49, 1.38) 0s;' +
    'white-space:nowrap;background:var(--ds-background-neutral);cursor:pointer;height:2.286em;line-height:2.286em;' +
    'padding:0 0.36em;vertical-align:middle;width:auto;-webkit-box-pack:center;justify-content:center;' +
    'color:var(--ds-icon-accent-blue);border:0.1em solid transparent;}' +
    '.inno-btn svg{vertical-align:text-bottom;width:1.36em;height:auto;fill:currentColor;}' +
    '.inno-btn:hover{background:var(--ds-background-neutral-hovered);text-decoration:inherit;' +
    'transition-duration:0s, 0.15s;color:var(--ds-icon-accent-blue);}' +
    '.inno-btn:focus{background:var(--ds-background-neutral);box-shadow:none;transition-duration:0s,0.2s;' +
    'outline:none;color:var(--ds-icon-accent-blue);}' +
    '.editing{border:0.1em solid var(--ds-border-danger);}' +
    '.inno-btn-container{display:inline-flex;overflow:hidden;animation-duration:0.5s;animation-iteration-count:1;' +
    'animation-name:none;animation-timing-function:linear;white-space:nowrap;text-overflow:ellipsis;' +
    'margin:0 0.43em;}';
  const tempoStyles = `#${tempoId}{margin-left:8px;display:inline-flex;place-items:center;font-size:10pt;}` +
    `#${tempoId} span{display:inline-block;padding:0.16em;margin:0 0.16em;border-radius:0.3em;z-index:20;` +
    'line-height:1.2em;color:var(--ds-text);border:0.16em solid transparent;cursor:default;text-align:center;}' +
    `#${tempoId} > a{color:var(--ds-icon-accent-blue);text-decoration:none;padding:0.75em;margin:0 0.3em;` +
    'border-radius:0.3em;background:var(--ds-background-subtleNeutral-resting);z-index:20;}' +
    `#${tempoId} > a:hover{color:var(--ds-icon-accent-blue);text-decoration:none;` +
    'background:var(--ds-background-subtleNeutral-hover);}' +
    `#${tempoId} .inno-cursor {cursor:pointer;}` +
    `#${tempoId} svg{vertical-align:text-bottom;fill:currentColor;max-width:1.35em;max-height:1.35em;}` +
    `#${tempoId} span.inno-orange{color:var(--ds-text-accent-orange);` +
    'background-color:var(--ds-background-accent-orange);border-color:var(--ds-border-accent-orange);}' +
    `#${tempoId} span.inno-red{color:var(--ds-text-accent-red);` +
    'background-color:var(--ds-background-accent-red);border-color:var(--ds-border-accent-red);}' +
    `#${tempoId} span.inno-blue{color:var(--ds-text-accent-blue);` +
    'background-color:var(--ds-background-accent-blue);border-color:var(--ds-border-accent-blue);}' +
    `#${tempoId} span.inno-refresh{cursor:pointer;align-self:flex-start;z-index:10;margin-left:-0.6em;` +
    'color:var(--ds-icon-accent-blue);background:transparent;font-size:0.8em;}' +
    `#${tempoId} span.inno-refresh:hover{color:var(--ds-icon-accent-blue);` +
    'background:var(--ds-background-subtleNeutral-hover);}';
  const configDialogBackgroundStyles = 'position:fixed;z-index:99999;top:0;right:0;bottom:0;left:0;' +
    'background:var(--ds-blanket);opacity:1;font-size:12pt;';
  const configDialogStyles = '.inno-dlg{width:500px;position:relative;margin:10% auto;padding:0 20px 20px;' +
    'background:var(--ds-surface-overlay);border-radius:4px;border:2px solid var(--ds-border-bold);' +
    'color:var(--ds-text);box-shadow:var(--ds-shadow-overlay)}' +
    '.innotitle{font-size:1.6em;padding-top:10px;margin-bottom:1em;}' +
    'hr{border:1px solid var(--ds-text-subtlest);margin:10px 0;}' +
    'h4{margin-top:0;margin-bottom:1em;}' +
    'svg{fill:currentColor;}' +
    'input:not([type=checkbox]):not([type=radio]){background:var(--ds-background-input);color:var(--ds-text);' +
    'border:1px solid var(--ds-border-input);border-radius:4px;padding:10px;width:450px;}' +
    'input:[type=checkbox]{width:40px;}' +
    'label{display:inline-block;}' +
    '.help{margin:15px 0;}.buttonrow{margin:10px 0}' +
    '.inno-hidden{display:none;}' +
    '.inno-margintop{margin-top:1em;}' +
    '.is-invalid{border:2px solid var(--ds-border-danger);}' +
    '.bigger{font-size:20pt;}' +
    'button{margin-right:10px;padding:10px;background:var(--ds-background-input);cursor:pointer;border-radius:4px;' +
    'border:1px solid var(--ds-border-input);}' +
    'button:hover{background:var(--ds-background-input-hovered);}' +
    '.inno-savebtn{background:var(--ds-background-success);border:1px solid var(--ds-border-success);' +
    'color:var(--ds-text-success);}' +
    '.inno-savebtn:hover{background:var(--ds-background-success-hovered);}' +
    '.inno-delbtn{background:var(--ds-background-danger);border:1px solid var(--ds-border-danger);' +
    'color:var(--ds-text-danger);}' +
    '.inno-delbtn:hover{background:var(--ds-background-danger-hovered);}';
  const configMenuItemStyles = `.${configMenuItemId}{display:flex;box-sizing:border-box;width:100%;min-height:40px;` +
    'margin:0px;padding:8px 20px;-webkit-box-align:center;align-items:center;border:0;font-size:14px;outline:0px;' +
    'text-decoration:none;user-select:none;background-color:transparent;color:currentColor;' +
    'cursor:pointer;}' +
    `.${configMenuItemId}:hover{background-color:var(--ds-background-neutral-subtle-hovered);color:currentColor;` +
    'text-decoration:none;}' +
    `.${configMenuItemId}:focus{background-color:transparent;color:currentColor;text-decoration:none;}`;

  const configHelpText1 = 'open tempo settings \n➡ api integration \n➡ new token \n➡ Name=\'jira extension\', ' +
    'Ablauf=\'5000 Tage\', Benutzerdefinierter Zugriff,\n\'Genehmigungsbereich: Genehmigungen anzeigen ' +
    '(und verwalten, falls "Periode einreichen" möglich sein soll) /\n' +
    'Bereich für Zeiträume: Zeiträume anzeigen /\nBereich der Zeitnachweise: Zeitnachweise anzeigen\'\n' +
    '➡ Bestätigen \n➡ Kopieren';

  // Set extra buttons: Uncomment, run extension once (reload jira page), comment again.
  // The main button (git commit message) cannot be changed or removed.
  //
  // example 1: no extra buttons (this removes the "No.", "Branch" and "SQL Migration" buttons)
  //GM_setValue("extraButtons", []);
  // example 2: remove "SQL Migration" button, add button for "Beer".
  // GM_setValue("extraButtons", [
  //     // this section was copied from above (L +-58) as to keep the "default" buttons, deleted "Mig." button.
  //     { text: "No.", title: "Vorgangnummer kopieren", format: "{0}", icon: svgHash },
  //     { text: "Branch", title: "git branch name kopieren", format: "feature/{0}", icon: svgGitBranch },
  //     // here we add an additional button using special text format including tab (\t) and newline (\r\n) characters
  //     { text: "Sch🍺ga", title: "Mein 🍺format", format: "{0}\t\tBeschreibung: {1}\r\nNächste Zeile, mehr Text 🍺" },
  // ]);
  //
  // if you do not declare an "icon", the "text" will be displayed.
  // The "text", "title" and "format" fields support emoji.
  //
  // Using "GM_setValue" (example above) persists the data even if the userscript is changed or updated.

  class CachedTempoApproval {
    /**
     * @class CachedTempoApproval
     * @param {string} cache datetime string of cache expiration
     * @param {number} required number of seconds
     * @param {number} logged number of seconds
     * @param {string} statusKey status of period
     * @param {string|null} submitAction url to submit period for review
     */
    constructor(cache, required, logged, statusKey, submitAction) {
      /** @type {string} */
      this.cache = cache;
      /** @type {number} */
      this.required = required;
      /** @type {number} */
      this.logged = logged;
      /** @type {string} */
      this.statusKey = statusKey;
      /** @type {string|null} */
      this.submitAction = submitAction;
    }
  }

  class TempoPeriod {
    /**
     * @class TempoPeriod
     * @param {string} from date string
     * @param {string} to date string
     */
    constructor(from, to) {
      /** @type {string} */
      this.from = from;
      /** @type {string} */
      this.to = to;
    }
    fromKey() {
      return this.from.replace(/-/g, '');
    }
  }

  /**
   * Momentarily changes button background to green/red, to inform the user of the result of the process.
   * @param {Event} e click event
   * @param {boolean} success result of the process
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
   * Jira issue data object
   * @typedef {object} jiraIssueData
   * @property {string} title of jira issue
   * @property {string} jiraNumber id of jira issue
   * @property {string} prefix either 'fix' or 'feat'
   */
  /**
   * Gets the Title, JIRA "Number" (ID, such as SU-1000), and prefix.
   * @returns {jiraIssueData|undefined} data of current jira issue.
   */
  function getData() {
    const issueLink = (
      // backlog view, detail view
      document.querySelector('[data-test-id*="current-issue"] a')
      // kanban view
      || document.querySelector('.ghx-selected a')
    );
    if (!issueLink) {
      GM_log('jira-innosolv-extensions: could not find issueLink.');
      return;
    }
    const jiraNumber = issueLink.dataset.tooltip || issueLink.innerText;

    const title = (
      // kanban view with ticket details in a modal
      document.querySelector('[data-test-id*="summary.heading"]')
      // kanban view
      || document.querySelector('.ghx-selected .ghx-summary')
      // backlog view, detail view
      || Array.from(document.querySelectorAll('h1')).pop()
    ).innerText;

    let prefix = 'fix';
    if (jiraNumber.startsWith('G3') && !title.startsWith('Issue: ')) {
      prefix = 'feat';
    } else if (jiraNumber.startsWith('EN')) {
      const aenderungstyp = document.querySelector('[data-testid*="customfield_10142.field-inline-edit-state"]');
      if (aenderungstyp && aenderungstyp.innerText == 'Anforderung') {
        prefix = 'feat';
      }
    }

    return {
      jiraNumber,
      title,
      prefix,
    };
  }

  /**
   * Gets the Title, JIRA ID and title using the provided format.
   * @param {string} format of the text
   * @returns {string|false} formatted value or false if data could not be gathered.
   */
  function getDataAndFormat(format) {
    const fmt = format || '{1} {2}';
    const { jiraNumber, title, prefix } = getData();
    if (!jiraNumber || !title || !prefix) return false;
    let txtToCopy = fmt.split('{0}').join(jiraNumber);
    txtToCopy = txtToCopy.split('{1}').join(title);
    if (txtToCopy.includes('{2}')) {
      txtToCopy = txtToCopy.split('{2}').join(prefix);
    }
    return txtToCopy;
  }

  /**
   * Gets the parent node with nodeName == @name
   * @param {Element} node to search parent
   * @param {string} name what to search for
   * @param {number} search current search depth
   * @returns {Element} parent node matching the name, or last node if not found.
   */
  function searchParentOfType(node, name, search = 0) {
    // current node matches.
    if (search == 0 && node.nodeName == name) {
      return node;
    }
    // break condition (max depth = 5)
    if (search >= 4) {
      return node;
    }
    if (node && node.parentNode) {
      const parent = node.parentNode;
      if (parent.nodeName == name) {
        return parent;
      }
      return searchParentOfType(parent, name, search + 1);
    } else {
      // either node or parentNode is empty
      return node;
    }
  }

  /**
   * Click event for copy buttons.
   * @param {Event} e click event
   */
  function buttonClicked(e) {
    e = e || window.event;
    let targ = e.target || e.srcElement;
    if (targ.nodeType == 3) targ = targ.parentNode; // defeat Safari bug
    const targBtn = searchParentOfType(targ, 'BUTTON');
    if (targBtn.hasAttribute('data-format')) {
      const fmt = targBtn.getAttribute('data-format');
      const txt = getDataAndFormat(fmt);
      if (txt === false) {
        flashCopiedMessage.bind(targBtn)(e, false);
      }
      // copy text to clipboard
      navigator.clipboard.writeText(txt).then(
        function () {
          flashCopiedMessage.bind(targBtn)(e, true);
        },
        function () {
          flashCopiedMessage.bind(targBtn)(e, false);
        }
      );
    } else {
      GM_log('jira-innosolv-extensions: ignoring click, attribute data-format not found.');
    }
  }

  /**
   * Adds a class to the classList of the node and removes this class from any siblings that have it assigned.
   * @param {Element} node to handle.
   * @param {string} className to clear from siblings and add to node.
   */
  function setClassAndRemoveFromSiblings(node, className) {
    const matchingSiblings = node.parentNode.getElementsByClassName(className);
    if (matchingSiblings.length > 0) {
      for (let i = 0; i < matchingSiblings.length; i++) {
        matchingSiblings[i].classList.remove(className);
      }
    }
    node.classList.add(className);
  }

  /**
   * Click event for copy buttons in preview mode.
   * @param {Event} e click event
   */
  function buttonClickedPreview(e) {
    e = e || window.event;
    let targ = e.target || e.srcElement;
    if (targ.nodeType == 3) targ = targ.parentNode; // defeat Safari bug
    const targBtn = searchParentOfType(targ, 'BUTTON');
    const editDialog = document.getElementById(extConfigDialogEditButtonId);
    if (!editDialog) {
      console.error('jira-innosolv-extensions: edit dialog is not open, ignoring PREVIEW click.');
    }
    // clear 'editing' class from all buttons, add class to currently clicked button
    if (targBtn.hasAttribute('data-buttondef')) {
      setClassAndRemoveFromSiblings(targBtn, 'editing');
    }
    if (targBtn.hasAttribute('data-editable') &&
      targBtn.getAttribute('data-editable') === 'true' &&
      targBtn.hasAttribute('data-buttondef')
    ) {
      const buttonDef = JSON.parse(targBtn.getAttribute('data-buttondef'));

      makeButtonEditForm(editDialog, buttonDef, undefined, targBtn.id);
    } else {
      makeButtonEditForm(
        editDialog,
        undefined,
        'Button ist nicht bearbeitbar oder besitzt keine Definition. (Erster Button kann nicht geändert werden!)',
        targBtn.id);
    }
  }

  /**
   * Creates a DOM Node with class and inner text.
   * @param {string} type DOM Element type
   * @param {string|undefined} cls ClassName of element
   * @param {string|undefined} txt InnerText of element
   * @param {string|undefined} id ID of element
   * @param {string|undefined} title Title of element
   * @returns {Element} DOM Element
   */
  function createNode(type, cls, txt, id, title) {
    const ret = document.createElement(type);
    if (cls) {
      ret.className = cls;
    }
    if (txt) {
      ret.innerText = txt;
    }
    if (id) {
      ret.id = id;
    }
    if (title) {
      ret.title = title;
    }
    return ret;
  }

  /**
   * Button definition
   * @typedef {object} buttonDefinition
   * @property {string} text to display on button, if @icon is not set
   * @property {string} title (tooltip) of button
   * @property {string} format of text to copy
   * @property {string|undefined} icon to diaplay, text if undefined.
   */
  /**
   * Creates an edit form for a custom button.
   * @param {Element} node container to add the edit form or error message to.
   * @param {buttonDefinition|undefined} buttonDefinition definition of button.
   * @param {string|undefined} message error message to display.
   * @param {string|undefined} id of active button.
   */
  function makeButtonEditForm(node, buttonDefinition, message, id) {
    // clean edit dialog children
    while (node.firstChild) {
      node.removeChild(node.lastChild);
    }
    if (node.hasAttribute('data-editing-id')) {
      node.removeAttribute('data-editing-id');
    }
    if (message) {
      const errDiv = createNode('div', 'is-error');
      errDiv.appendChild(createNode('p', undefined, message));
      node.appendChild(errDiv);
    } else {
      node.setAttribute('data-editing-id', id);
      const editDiv = createNode('div', 'editForm');
      addLabelAndInput(editDiv, 'buttonText', 'Text', buttonDefinition.text);
      addLabelAndInput(editDiv, 'buttonTitle', 'Titel', buttonDefinition.title, true);
      addLabelAndInput(editDiv, 'buttonFormat', 'Format', buttonDefinition.format, true);
      addLabelAndInput(editDiv, 'buttonIcon', 'Icon', buttonDefinition.icon);
      const actions = createNode('div', 'buttonrow');
      const save = createNode('button', 'inno-savebtn', 'save changes');
      save.onclick = () => window.alert('not implemented.');
      actions.appendChild(save);
      const del = createNode('button', 'inno-delbtn', 'delete');
      del.onclick = () => window.alert('not implemented.');
      actions.appendChild(del);
      editDiv.appendChild(actions);
      node.appendChild(editDiv);
    }
  }

  /**
   * Adds a label and input element to the (button-) edit dialog.
   * @param {Element} node container to add the label and input to.
   * @param {string} id node id for input element.
   * @param {string} title of the label.
   * @param {string} value of the input element.
   * @param {boolean} specialChars handle special chars like \t \r \n
   */
  function addLabelAndInput(node, id, title, value, specialChars = false) {
    const label = createNode('label', undefined, title + ':');
    label.setAttribute('for', id);
    node.appendChild(label);
    const input = createNode('input', undefined, undefined, id);
    input.type = 'text';
    input.value = specialChars ? transformSpecialChars(value) : value;
    node.appendChild(input);
  }

  /**
   * transforms special characters like \t \r or \n back to readable/editable characters.
   * @param {string} value string containing original value including tab and line-feed characters.
   * @returns {string} formatted value with readable tab and line-feed characters.
   */
  function transformSpecialChars(value) {
    let ret = value.split('\t').join('\\t');
    ret = ret.split('\r').join('\\r');
    ret = ret.split('\n').join('\\n');
    return ret;
  }

  /**
   * Checks the location.pathname for ignored patterns (disabledUrls). Returns true if it matches.
   * @returns {boolean} current location path should be ignored.
   */
  function isIgnoredPath() {
    // disable extension for certain urls (confluence, tempo)
    const path = window.location.pathname;
    return disabledUrls.some(d => path.startsWith(d));
  }

  /**
   * Adds configured copy buttons and styling to node.
   * @param {Element} node container to add the buttons to.
   * @param {boolean} preview preparation for configuration dialog
   */
  function addCopyButtons(node, preview = false) {
    if (isIgnoredPath()) {
      return;
    }

    const commitButtonId = preview ? 'commit-header-btn' : 'commit-header-btn-preview';
    if (!document.getElementById(commitButtonId)) {
      node.appendChild(createNode('style', undefined, copyButtonStyles));

      const createBtn = function (id, buttondef) {
        const btn = createNode('button', 'inno-btn', undefined, id, buttondef.title);
        btn.setAttribute('data-format', buttondef.format);
        const lbl = createNode('span');
        if (buttondef.icon) {
          lbl.innerHTML = buttondef.icon;
        } else {
          lbl.innerText = buttondef.text;
        }
        btn.appendChild(lbl);
        if (preview) {
          btn.setAttribute('data-buttondef', JSON.stringify(buttondef));
          btn.setAttribute('data-editable', id !== commitButtonId);
          btn.onclick = buttonClickedPreview; // onclick function for preview window
        } else {
          btn.onclick = buttonClicked; // onclick function
        }
        return btn;
      };

      const container = createNode('div', 'inno-btn-container');
      // create main button
      container.appendChild(
        createBtn(commitButtonId, defaultButton)
      );

      // create additional buttons
      const extraButtons = GM_getValue('extraButtons', defaultExtraButtons);
      extraButtons.forEach(function (btn, i) {
        container.appendChild(createBtn(commitButtonId + '-' + i, btn));
      });
      node.appendChild(container);
    }
  }

  /**
   * Adds Tempo integration label to header
   * @param {Element} node container for label
   */
  function addTempoIntegration(node) {
    if (isIgnoredPath()) {
      return;
    }

    if (!document.getElementById(tempoId)) {
      node.appendChild(createNode('style', undefined, tempoStyles));

      const span = createNode('span', undefined, 'innoTempo…', tempoId, 'innoTempo: initializing…');
      node.appendChild(span);
      if (tempoUpdateTimer) {
        clearTimeout(tempoUpdateTimer);
      }
      tempoUpdateTimer = setTimeout(() => { updateTempo(span); }, tempoUpdateDelayMs);
    }
  }

  /**
   * Update label with data from API.
   * @param {Element} node label to update.
   */
  function updateTempo(node) {
    if (!checkForCssVar(node)) {
      return;
    }
    if (!isTempoDisabled()) {
      if (isTempoConfigured()) {
        getTempoData(node, false);
      } else {
        node.innerText = 'innoTempo: ➡ configure Jira Extension in profile menu. ';
        const disable = createNode('a', undefined, 'or disable.');
        disable.href = '#';
        disable.onclick = () => {
          setTempoDisabled(true);
          node.innerText = 'innoTempo: integration disabled - refresh…';
          return false;
        };
        node.appendChild(disable);
      }
    }
  }

  /**
   * Checks, if css variable "--ds-text" is set in the :root element.
   * @param {Element} node DOM Node for Tempo integration.
   * @returns {boolean} check is ok.
   */
  function checkForCssVar(node) {
    const styles = getComputedStyle(document.querySelector(':root'));
    const textvar = styles.getPropertyValue('--ds-text');
    if (!textvar) {
      node.innerText = '';
      node.title = '';
      node.style = 'background-color:orangered;';
      const action = createNode('span');
      const pre = document.createTextNode('Aktiviere die Funktion "Helle und dunkle Themes" ');
      action.appendChild(pre);
      action.appendChild(createNode('br'));
      const link = createNode('a', undefined, 'in "Persönliche Einstellungen"');
      link.href = '/secure/ViewPersonalSettings.jspa';
      action.appendChild(link);
      const post = document.createTextNode(' und lade die Seite neu!');
      action.appendChild(post);
      node.appendChild(action);
      return false;
    }
    return true;
  }

  /**
   * Checks if tempo integration is disabled.
   * @returns {boolean} tempo integration is disabled.
   */
  function isTempoDisabled() {
    return GM_getValue('tempoDisabled', false) == true;
  }

  /**
   * Stores the state of "tempoDisabled".
   * @param {boolean} disabled state.
   */
  function setTempoDisabled(disabled) {
    GM_setValue('tempoDisabled', disabled);
  }

  /**
   * Stores the tempo access token for the api.
   * @param {string} token to access tempo api.
   */
  function setTempoToken(token) {
    GM_setValue('tempoToken', token);
  }

  /**
   * Checks, if the provided token can access the tempo api, stores the token on success.
   * @param {string} token to check and store if request was successful.
   * @returns {Promise<boolean>} success state.
   */
  function checkAndStoreTempoToken(token) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const now = new Date();
        const periods = await getTempoPeriods(now, true, token);
        if (periods) {
          setTempoToken(token);
          resolve(true);
        } else {
          reject();
        }
      }
      catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Checks, if the configuration for tempo integration is complete.
   * @returns {boolean} Configuration is complete.
   */
  function isTempoConfigured() {
    if (GM_getValue('jiraUserId', '') !== '') {
      if (GM_getValue('tempoToken', '') !== '') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get string formatted date.
   * @param {Date} date to translate.
   * @returns {string} date in the format of "yyyy-MM-dd".
   */
  function getYMD(date) {
    return `${date.getFullYear()}-${lZero(date.getMonth() + 1)}-${lZero(date.getDate())}`;
  }

  /**
   * Adds a leading zero if needed.
   * @param {number} num number to add a leading zero to.
   * @returns {string} number with leading zero.
   */
  function lZero(num) {
    return ('0' + (num)).slice(-2);
  }

  /**
   * Gathers approval data (past 3 periods) from tempo API and displays it.
   * @param {Element} node container for display.
   * @param {boolean} forceUpdate force update (ignore cache).
   */
  async function getTempoData(node, forceUpdate) {
    try {
      const now = new Date();
      const periods = await getTempoPeriods(now, forceUpdate);
      // clear node
      while (node.firstChild) {
        node.removeChild(node.lastChild);
      }
      node.title = '';

      if (!periods) {
        const err = createNode('span');
        err.innerHTML = 'Error retrieving periods from tempo api.<br>Check your browser logs!';
        node.appendChild(err);
        return;
      }

      if (now.getDay() == 1 || now.getDay() == 2) { // Mon/Tue => ignore last (current) period.
        periods.pop();
      }
      const displayPeriods = periods.slice(-4);
      // Tempo app link
      const lnk = createNode('a', undefined, undefined, undefined, 'Open Tempo app');
      lnk.href = tempoLink;
      lnk.innerHTML = svgTempo;
      node.appendChild(lnk);
      const periodsSeen = [];
      try {
        for (const p of displayPeriods) {
          periodsSeen.push(p.fromKey());
          const approvalStatus = await getApprovalStatus(p, forceUpdate);
          if (approvalStatus.statusKey == 'OPEN') {
            const toDate = new Date(p.to.slice(0, 4), Number(p.to.slice(-5).slice(0, 2)) - 1, p.to.slice(-2));
            const isCurrentWeek = new Date() < toDate;
            const span = createNode('span');
            span.appendChild(document.createTextNode(`${toDate.getDate()}.${toDate.getMonth() + 1}.`));
            span.appendChild(createNode('br'));
            span.appendChild(document.createTextNode('Open'));
            if (!isCurrentWeek && approvalStatus.submitAction && hasApprover()) {
              const einreichen = createNode('strong', 'inno-cursor', '👌', undefined, 'Periode einreichen');
              einreichen.onclick = () => { sendInForApproval(p, approvalStatus.submitAction); };
              span.appendChild(einreichen);
            }
            let missing = -(((approvalStatus.required - approvalStatus.logged) / 60 / 60).toFixed(2));
            if (missing > 0) {
              missing = 0;
            }
            if (isCurrentWeek) {
              span.className = 'inno-blue';
            } else {
              if (missing > -8) {
                span.className = 'inno-orange';
              } else {
                span.className = 'inno-red';
              }
            }
            const lastUpdate = new Date(approvalStatus.cache);
            lastUpdate.setTime(lastUpdate.getTime() - (approvalCacheValidForHours * 60 * 60 * 1000));
            span.title = (isCurrentWeek ? 'Current week\n' : '') +
              `${missing} hours\n` +
              `Updated: ${lZero(lastUpdate.getHours())}:${lZero(lastUpdate.getMinutes())}`;
            node.appendChild(span);
          }
        }
        const refresh = createNode('span', 'inno-refresh', undefined, undefined, 'force update');
        refresh.innerHTML = svgRefresh;
        refresh.onclick = () => { getTempoData(node, true); };
        node.appendChild(refresh);
      } catch (e) {
        console.error(e);
        return;
      }
      cleanupApprovalStatus(periodsSeen);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Check if approver has been set.
   * @returns {boolean} approver has been set.
   */
  function hasApprover() {
    const ret = GM_getValue('tempoApprover', '');
    return !!ret;
  }

  /**
   * Get approver value.
   * @returns {string} tempo time sheet approver.
   */
  function getApprover() {
    return GM_getValue('tempoApprover', '');
  }

  /**
   * Sets the approver value.
   * @param {string} approver tempo time sheet approver.
   */
  function setApprover(approver) {
    GM_setValue('tempoApprover', approver);
  }

  /**
   * Submits a period for approval.
   * @param {TempoPeriod} period to submit for approval.
   * @param {string} actionUrl action to use for approval request.
   */
  function sendInForApproval(period, actionUrl) {
    if (actionUrl) {
      if (confirm(`Send Period ${period.from} - ${period.to} for approval?`) == true) {
        GM_xmlhttpRequest({
          method: 'POST',
          url: actionUrl,
          data: `{"comment":"jira extension","reviewerAccountId": "${getApprover()}"}`,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GM_getValue('tempoToken', '')}`
          },
          responseType: 'json',
          onload: (resp) => {
            if (resp.status == 200) {
              const cacheExp = new Date();
              cacheExp.setTime(cacheExp.getTime() + (approvalCacheValidForHours * 60 * 60 * 1000));
              const submitAction = resp.response.actions ?
                (resp.response.actions.submit ? (resp.response.actions.submit.self) : null) : null;
              const ret = new CachedTempoApproval(
                cacheExp.toISOString(),
                resp.response.requiredSeconds,
                resp.response.timeSpentSeconds,
                resp.response.status.key,
                submitAction
              );
              saveApprovalStatus(period.fromKey(), ret);
              window.alert(`great success 😊 (refresh periods to update display) ${resp.response.status}`);
            } else {
              GM_log(`innoTempo: error submitting period for review.
            status:${resp.status} (${resp.statusText}), response:${resp.responseText}`);
            }
          }
        });
      }
    } else {
      GM_log('innoTempo: error submitting period (missing submit action)!');
    }
  }

  /**
   * Gets available "periods" from tempo api.
   * @param {Date} now current Date (for easeier access).
   * @param {boolean} forceUpdate forces update (ignore cache).
   * @param {string} withToken forces http request with this token, ignores cache.
   * @returns {Promise<TempoPeriod[]>} tempo periods within the past month.
   */
  function getTempoPeriods(now, forceUpdate, withToken) {
    return new Promise((resolve, reject) => {
      const cachedPeriods = GM_getValue('tempoPeriods', { cache: getYMD(now), periods: [] });
      const cachedDate = new Date(cachedPeriods.cache);
      if (cachedDate > now && !withToken && !forceUpdate) {
        /** @type {TempoPeriod[]} */
        const periods = [];
        for (let i = 0; i < cachedPeriods.periods.length; i++) {
          const period = cachedPeriods.periods[i];
          periods.push(new TempoPeriod(period.from, period.to));
        }
        resolve(periods);
        return;
      } else {
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
        const pastParam = getYMD(oneMonthAgo);
        const nowParam = getYMD(now);
        GM_xmlhttpRequest({
          method: 'GET',
          url: tempoBaseUrl + `periods?from=${pastParam}&to=${nowParam}`,
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${(withToken ? withToken : GM_getValue('tempoToken', ''))}`
          },
          responseType: 'json',
          onload: (resp) => {
            if (resp.status == 200) {
              const cacheExp = new Date();
              cacheExp.setDate(cacheExp.getDate() + periodsCacheValidForDays);
              /** @type {TempoPeriod[]} */
              const periods = [];
              for (let i = 0; i < resp.response.periods.length; i++) {
                const period = resp.response.periods[i];
                periods.push(new TempoPeriod(period.from, period.to));
              }
              GM_setValue('tempoPeriods', { cache: getYMD(cacheExp), periods: periods });
              resolve(periods);
            } else {
              GM_log(`innoTempo: error fetching periods.
            status:${resp.status} (${resp.statusText}), response:${resp.responseText}`);
              reject(resp.status);
            }
          }
        });
      }
    });
  }

  /**
   * Gets approval status of one period.
   * @param {TempoPeriod} period current period.
   * @param {boolean} forceUpdate force update (ignore cache).
   * @returns {Promise<CachedTempoApproval>} approval status of period.
   */
  function getApprovalStatus(period, forceUpdate) {
    return new Promise((resolve, reject) => {
      const approvals = getApprovalStatusAll();
      const fromKey = period.fromKey();
      if (approvals[fromKey]) {
        const approval = approvals[fromKey];
        const cachedDate = new Date(approval.cache);
        if (cachedDate > new Date() && !forceUpdate) {
          resolve(approval);
          return;
        }
      }
      GM_xmlhttpRequest({
        method: 'GET',
        url: tempoBaseUrl + `timesheet-approvals/user/${GM_getValue('jiraUserId', '')}` +
          `?from=${period.from}&to=${period.to}`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${GM_getValue('tempoToken', '')}`
        },
        responseType: 'json',
        onload: (resp) => {
          if (resp.status == 200) {
            const cacheExp = new Date();
            cacheExp.setTime(cacheExp.getTime() + (approvalCacheValidForHours * 60 * 60 * 1000));
            const submitAction = resp.response.actions ?
              (resp.response.actions.submit ? (resp.response.actions.submit.self) : null) : null;
            const ret = new CachedTempoApproval(
              cacheExp.toISOString(),
              resp.response.requiredSeconds,
              resp.response.timeSpentSeconds,
              resp.response.status.key,
              submitAction
            );
            saveApprovalStatus(fromKey, ret);
            resolve(ret);
          } else {
            GM_log(`innoTempo: error fetching approvals.
          status:${resp.status} (${resp.statusText}), response:${resp.responseText}`);
            reject(resp);
          }
        }
      });
    });
  }

  /**
   * Gets all approval statuses from storage.
   * @returns {object} all approvals from TamperMonkey storage.
   */
  function getApprovalStatusAll() {
    return GM_getValue('tempoApprovals', {});
  }

  /**
   * Stores the approval data.
   * @param {string} key for storage.
   * @param {CachedTempoApproval} approval data.
   */
  function saveApprovalStatus(key, approval) {
    const approvals = getApprovalStatusAll();
    approvals[key] = approval;
    GM_setValue('tempoApprovals', approvals);
  }

  /**
   * Removes old data from the "tempoApprovals" local storage object.
   * @param {Array<string>} periodsSeen periods that have been iterated through.
   */
  function cleanupApprovalStatus(periodsSeen) {
    const approvals = getApprovalStatusAll();
    let changed = false;
    Object.keys(approvals).forEach((key) => {
      if (!periodsSeen.includes(key)) {
        approvals[key] = undefined;
        changed = true;
      }
    });
    if (changed) {
      GM_setValue('tempoApprovals', approvals);
    }
  }

  /**
   * Checks configuration values for changes, saves configuration and closes the dialog.
   */
  function saveAndCloseInnoExtensionConfigDialog() {
    let hasChanges = false;
    const currentDisabled = isTempoDisabled();
    const settingDisabled = !document.getElementById('tempoIntegrationEnabled').checked;
    if (currentDisabled !== settingDisabled) {
      hasChanges = true;
      setTempoDisabled(settingDisabled);
    }
    const currentApprover = getApprover();
    const settingApprover = document.getElementById(extConfigDialogTempoApproverId).value;
    if (currentApprover !== settingApprover) {
      hasChanges = true;
      setApprover(settingApprover);
    }

    if (hasChanges) {
      window.alert('you need to reload the current page for changes to take effect.');
    }
    closeInnoExtensionConfigDialog();
  }

  /**
   * checks if click originated from target to avoid closing dialog on click in children and closes config dialog.
   * @param {Event} e click event.
   */
  function closeInnoExtensionConfigCheckTarget(e) {
    if (this === e.target) {
      closeInnoExtensionConfigDialog();
    }
  }

  /**
   * Closes the configuration dialog.
   */
  function closeInnoExtensionConfigDialog() {
    document.getElementById(extConfigDialogId).remove();
  }

  /**
   * Toggles class name on node.
   * @param {Element} node to toggle class
   * @param {string} className to add or remove
   * @param {boolean|undefined} addCond condition to add/remove class
   */
  function toggleClass(node, className, addCond) {
    if (node) {
      if (addCond === undefined) {
        addCond = !node.classList.contains(className);
      }
      if (addCond && !node.classList.contains(className)) {
        node.classList.add(className);
      } else if (!addCond && node.classList.contains(className)) {
        node.classList.remove(className);
      }
    }
  }

  /**
   * Shows the configuration dialog.
   * @param {Event} e click event.
   * @returns {boolean} false (to avoid following the link).
   */
  function showInnoExtensionConfigDialog(e) {
    if (!document.getElementById(extConfigDialogId)) {
      const background = createNode('div', undefined, undefined, extConfigDialogId);
      background.setAttribute('style', configDialogBackgroundStyles);
      background.appendChild(createNode('style', undefined, configDialogStyles));
      const dlg = createNode('div', 'inno-dlg');

      dlg.appendChild(createNode('h3', 'innotitle', 'jira Extension Configuration'));
      dlg.appendChild(createNode('hr'));
      dlg.appendChild(createNode('h4', undefined, 'Tempo integration'));
      const enabledInput = createNode('input', undefined, undefined, 'tempoIntegrationEnabled');
      enabledInput.type = 'checkbox';
      enabledInput.value = '1';
      const tempoDisabled = isTempoDisabled();
      if (!tempoDisabled) {
        enabledInput.setAttribute('checked', 'checked');
      }
      enabledInput.onchange = function (e) {
        const isChecked = e.target.checked;
        const grp = document.getElementById(extConfigDialogTempoDetailsId);
        toggleClass(grp, 'inno-hidden', !isChecked);
      };
      dlg.appendChild(enabledInput);
      const enabledLabel = createNode('label', undefined, 'Tempo integration enabled');
      enabledLabel.setAttribute('for', 'tempoIntegrationEnabled');
      dlg.appendChild(enabledLabel);
      const tempoGroup = createNode(
        'div',
        tempoDisabled ? 'inno-hidden' : undefined,
        undefined,
        extConfigDialogTempoDetailsId
      );
      const lbl = createNode('label', 'inno-margintop', 'Tempo API Token:');
      lbl.setAttribute('for', 'tempoTokenInput');
      tempoGroup.appendChild(lbl);
      const inp = createNode('input', undefined, undefined, 'tempoTokenInput');
      inp.type = 'text';
      inp.value = GM_getValue('tempoToken', '');
      inp.placeholder = 'tempo token';
      tempoGroup.appendChild(inp);
      const a = createNode('a', undefined, 'open tempo configuration dialog in new tab');
      a.href = tempoConfigLink;
      a.target = '_blank';
      tempoGroup.appendChild(a);
      const helpId = 'inno-tempo-config-help';
      const helpToggle = createNode('div');
      helpToggle.onclick = () => {
        const helpNode = document.getElementById(helpId);
        toggleClass(helpNode, 'inno-hidden');
      };
      helpToggle.title = 'click for more info.';
      helpToggle.innerHTML = svgInfoCircle;
      tempoGroup.appendChild(helpToggle);
      tempoGroup.appendChild(createNode('div', 'help inno-hidden', configHelpText1, helpId));
      const approverLbl = createNode('label', 'inno-margintop', 'Timesheet Approver (User ID):');
      approverLbl.setAttribute('for', extConfigDialogTempoApproverId);
      tempoGroup.appendChild(approverLbl);
      const approverInp = createNode('input', undefined, undefined, extConfigDialogTempoApproverId);
      approverInp.type = 'text';
      approverInp.value = getApprover();
      approverInp.placeholder = 'Timesheet Approver (User ID)';
      tempoGroup.appendChild(approverInp);
      const btnRow = createNode('div', 'buttonrow');
      const btn = createNode('button', 'inno-savebtn', 'check and save tempo data');
      btn.onclick = async function () {
        try {
          const inp = document.getElementById('tempoTokenInput');
          if (inp.classList.contains('is-invalid')) {
            inp.classList.remove('is-invalid');
          }
          const success = await checkAndStoreTempoToken(inp.value);
          if (success) {
            saveAndCloseInnoExtensionConfigDialog();
          } else {
            inp.classList.add('is-invalid');
          }
        } catch (e) {
          console.error(e);
          inp.classList.add('is-invalid');
        }
      };
      btnRow.appendChild(btn);
      tempoGroup.appendChild(btnRow);
      dlg.appendChild(tempoGroup);
      dlg.appendChild(createNode('hr'));
      dlg.appendChild(createNode('h4', undefined, 'Edit Buttons (preview)'));
      const previewDiv = createNode('div', 'bigger');
      dlg.appendChild(previewDiv);
      addCopyButtons(previewDiv, true);
      dlg.appendChild(createNode('div', undefined, undefined, extConfigDialogEditButtonId));
      dlg.appendChild(createNode('hr'));
      const closeRow = createNode('div', 'buttonrow');
      const save = createNode('button', 'inno-savebtn', 'save and close');
      save.onclick = saveAndCloseInnoExtensionConfigDialog;
      closeRow.appendChild(save);
      const close = createNode('button', undefined, 'cancel and close');
      close.onclick = closeInnoExtensionConfigDialog;
      closeRow.appendChild(close);
      dlg.appendChild(closeRow);
      background.onclick = closeInnoExtensionConfigCheckTarget;
      background.appendChild(dlg);
      document.body.append(background);
    }

    e.preventDefault();
    return false;
  }

  /**
   * Adds extension configuration button to profile menu in jira.
   * Bonus: Gets and stores the current user's id for Tempo queries.
   * @param {Element} node container to add configuration button.
   */
  function addInnoExtensionConfigMenuItem(node) {
    if (isIgnoredPath()) {
      return;
    }
    const headerText = node.innerText.toUpperCase();
    if (headerText == 'KONTO' || headerText == 'ACCOUNT') {
      if (!document.getElementById(configMenuItemId)) {
        const parent = node.parentNode;
        parent.appendChild(createNode('style', undefined, configMenuItemStyles));
        const lnk = createNode('a', configMenuItemId, '⚙ Jira Extension', configMenuItemId);
        lnk.href = '#';
        lnk.onclick = showInnoExtensionConfigDialog;
        parent.appendChild(lnk);
      }
    } else if (headerText == 'JIRA') {
      if (GM_getValue('jiraUserId', '') == '') {
        const link = node.nextSibling;
        let match;
        if (link && link.href && (match = /\/jira\/people\/([0-9a-f]+)$/.exec(link.href))) {
          GM_setValue('jiraUserId', match[1]);
        }
      }
    }
  }

  // source: https://gist.github.com/mjblay/18d34d861e981b7785e407c3b443b99b#file-waitforkeyelements-js
  /**
   * A utility function for Greasemonkey scripts, to detect and handle AJAXed content.
   * Forked for use without JQuery.
   * @param {string} selectorTxt jQuery selector that specifies the desired element(s).
   * @param {Function} actionFunction code to run when elements are found. It is passed as node to the matched element.
   * @param {boolean} bWaitOnce If false, will continue to scan for new elements even after the first match is found.
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
    let controlKey = selectorTxt.replace(/[^\w]/g, '_');
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

  // jira-extension relevant function calls

  // copy buttons
  const actionSelector = 'div[data-test-id="issue.views.issue-base.foundation.status.actions-wrapper"]';
  waitForKeyElements(actionSelector, addCopyButtons, false);

  // config menu for jira extension
  const configMenuSelector = 'div[data-ds--menu--heading-item="true"]';
  waitForKeyElements(configMenuSelector, addInnoExtensionConfigMenuItem, false);
  // tempo integration
  if (!isTempoDisabled()) {
    const createButtonSelector = 'div[data-testid="create-button-wrapper"]';
    waitForKeyElements(createButtonSelector, addTempoIntegration, false);
  }
})();
