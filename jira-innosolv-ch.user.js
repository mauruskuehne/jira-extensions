// ==UserScript==
// @name        JIRA Extensions
// @version     2.0.3
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
  // disable extension for these urls
  const disabledUrls = ['/wiki/', '/plugins/'];

  /*
  svg icons source:
  https://www.svgrepo.com/collection/boxicons-interface-icons/
  github repo:
  https://github.com/atisawd/boxicons/tree/master/svg/regular
  */
  const svgMessageAltEdit = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8.586 18 12 21.414 15.414 18H19c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2H5c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h3.586zM5 4h14v12h-4.414L12 18.586 9.414 16H5V4z"/><path d="m12.479 7.219-4.977 4.969v1.799h1.8l4.975-4.969zm2.219-2.22 1.8 1.8-1.37 1.37-1.8-1.799z"/></svg>';
  const svgTargetLock = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M13 4.069V2h-2v2.069A8.008 8.008 0 0 0 4.069 11H2v2h2.069A8.007 8.007 0 0 0 11 19.931V22h2v-2.069A8.007 8.007 0 0 0 19.931 13H22v-2h-2.069A8.008 8.008 0 0 0 13 4.069zM12 18c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6z"/></svg>';
  const svgHash = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.018 3.815 15.232 8h-4.966l.716-3.815-1.964-.37L8.232 8H4v2h3.857l-.751 4H3v2h3.731l-.714 3.805 1.965.369L8.766 16h4.966l-.714 3.805 1.965.369.783-4.174H20v-2h-3.859l.751-4H21V8h-3.733l.716-3.815-1.965-.37zM14.106 14H9.141l.751-4h4.966l-.752 4z"/></svg>';
  const svgGitBranch = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.5 4C15.57 4 14 5.57 14 7.5c0 1.554 1.025 2.859 2.43 3.315-.146.932-.547 1.7-1.23 2.323-1.946 1.773-5.527 1.935-7.2 1.907V8.837c1.44-.434 2.5-1.757 2.5-3.337C10.5 3.57 8.93 2 7 2S3.5 3.57 3.5 5.5c0 1.58 1.06 2.903 2.5 3.337v6.326c-1.44.434-2.5 1.757-2.5 3.337C3.5 20.43 5.07 22 7 22s3.5-1.57 3.5-3.5c0-.551-.14-1.065-.367-1.529 2.06-.186 4.657-.757 6.409-2.35 1.097-.997 1.731-2.264 1.904-3.768C19.915 10.438 21 9.1 21 7.5 21 5.57 19.43 4 17.5 4zm-12 1.5C5.5 4.673 6.173 4 7 4s1.5.673 1.5 1.5S7.827 7 7 7s-1.5-.673-1.5-1.5zM7 20c-.827 0-1.5-.673-1.5-1.5a1.5 1.5 0 0 1 1.482-1.498l.13.01A1.495 1.495 0 0 1 7 20zM17.5 9c-.827 0-1.5-.673-1.5-1.5S16.673 6 17.5 6s1.5.673 1.5 1.5S18.327 9 17.5 9z"/></svg>';
  const svgData = '<svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 17V7c0-2.168-3.663-4-8-4S4 4.832 4 7v10c0 2.168 3.663 4 8 4s8-1.832 8-4zM12 5c3.691 0 5.931 1.507 6 1.994C17.931 7.493 15.691 9 12 9S6.069 7.493 6 7.006C6.069 6.507 8.309 5 12 5zM6 9.607C7.479 10.454 9.637 11 12 11s4.521-.546 6-1.393v2.387c-.069.499-2.309 2.006-6 2.006s-5.931-1.507-6-2V9.607zM6 17v-2.393C7.479 15.454 9.637 16 12 16s4.521-.546 6-1.393v2.387c-.069.499-2.309 2.006-6 2.006s-5.931-1.507-6-2z"/></svg>';
  const svgTempo = '<svg width="18px" height="18px" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M9 2.02a6.98 6.98 0 1 1 0 13.96A6.98 6.98 0 0 1 9 2.02M9 18A9 9 0 1 0 9 0a9 9 0 0 0 0 18"/><path d="M11.2 6.07 8.32 8.73c-.1.09-.26.09-.36 0L6.8 7.63a.27.27 0 0 0-.36 0L5.07 8.89c-.1.1-.1.24 0 .33L8 11.93c.1.1.26.1.36 0l4.58-4.25c.1-.1.1-.24 0-.33l-1.38-1.28a.27.27 0 0 0-.36 0"/></g></svg>';

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

  /**
   * Momentarily changes button background to green/red, to inform the user of the result of the process.
   * 
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
   * 
   * @typedef {object} jiraIssueData
   * @property {string} title of jira issue
   * @property {string} jiraNumber id of jira issue
   * @property {string} prefix either 'fix' or 'feat'
   */
  /**
   * Gets the Title, JIRA "Number" (ID, such as SU-1000), and prefix.
   * 
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
   * 
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
   * 
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
   * 
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
   * 
   * @param {Element} node to handle.
   * @param {string} className to clear from siblings and add to node.
   */
  function setClassAndRemoveFromSiblings(node, className) {
    const matchingSiblings = node.parentNode.getElementsByClassName(className);
    if(matchingSiblings.length > 0) {
      for(let i = 0;i<matchingSiblings.length;i++) {
        matchingSiblings[i].classList.remove(className);
      }
    }
    node.classList.add(className);
  }

  /**
   * Click event for copy buttons in preview mode.
   * 
   * @param {Event} e click event
   */
  function buttonClickedPreview(e) {
    e = e || window.event;
    let targ = e.target || e.srcElement;
    if (targ.nodeType == 3) targ = targ.parentNode; // defeat Safari bug
    const targBtn = searchParentOfType(targ, 'BUTTON');
    const editDialog = document.getElementById(extConfigDialogEditButtonId);
    if(!editDialog) {
      console.error('jira-innosolv-extensions: edit dialog is not open, ignoring PREVIEW click.');
    }
    // clear 'editing' class from all buttons, add class to currently clicked button
    if(targBtn.hasAttribute('data-buttondef')) {
      setClassAndRemoveFromSiblings(targBtn, 'editing');
    }
    if(targBtn.hasAttribute('data-editable') &&
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
   * Button definition
   * 
   * @typedef {object} buttonDefinition
   * @property {string} text to display on button, if @icon is not set
   * @property {string} title (tooltip) of button
   * @property {string} format of text to copy
   * @property {string|undefined} icon to diaplay, text if undefined.
   */
  /**
   * Creates an edit form for a custom button.
   * 
   * @param {Element} node container to add the edit form or error message to.
   * @param {buttonDefinition|undefined} buttonDefinition definition of button.
   * @param {string|undefined} message error message to display.
   * @param {string|undefined} id of active button.
   */
  function makeButtonEditForm(node, buttonDefinition, message, id) {
    // clean edit dialog children
    while(node.firstChild) {
      node.removeChild(node.lastChild);
    }
    if(node.hasAttribute('data-editing-id')) {
      node.removeAttribute('data-editing-id');
    }
    if(message) {
      let errDiv = document.createElement('div');
      errDiv.className = 'is-error';
      let errMsg = document.createElement('p');
      errMsg.innerText = message;
      errDiv.appendChild(errMsg);
      node.appendChild(errDiv);
    } else {
      node.setAttribute('data-editing-id', id);
      let editDiv = document.createElement('div');
      editDiv.className = 'editForm';
      addLabelAndInput(editDiv, 'buttonText', 'Text', buttonDefinition.text);
      addLabelAndInput(editDiv, 'buttonTitle', 'Titel', buttonDefinition.title);
      addLabelAndInput(editDiv, 'buttonFormat', 'Format', buttonDefinition.format);
      addLabelAndInput(editDiv, 'buttonIcon', 'Icon', buttonDefinition.icon);
      let actions = document.createElement('div');
      actions.className = 'buttonrow';
      let save = document.createElement('button');
      save.innerText = 'save changes';
      save.onclick = function() {window.alert('not implemented.');};
      actions.appendChild(save);
      let del = document.createElement('button');
      del.innerText = 'delete';
      del.onclick = function() {window.alert('not implemented.');};
      actions.appendChild(del);
      editDiv.appendChild(actions);
      node.appendChild(editDiv);
    }
  }

  /**
   * Adds a label and input element to the (button-) edit dialog.
   * 
   * @param {Element} node container to add the label and input to.
   * @param {string} id node id for input element.
   * @param {string} title of the label.
   * @param {string} value of the input element.
   */
  function addLabelAndInput(node, id, title, value) {
    let label = document.createElement('label');
    label.setAttribute('for', id);
    label.innerText = title + ':';
    node.appendChild(label);
    let input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.value = value;
    node.appendChild(input);
  }


  /**
   * Adds configured copy buttons and styling to node.
   * 
   * @param {Element} node container to add the buttons to.
   * @param {boolean} preview preparation for configuration dialog
   */
  function addCopyButtons(node, preview = false) {
    const buttonStyles = '.inno-btn{-webkit-box-align:baseline;align-items:baseline;border-width:0;' +
      'border-radius:0.22em;box-sizing:border-box;display:inline-flex;font-size:inherit;font-style:normal;' +
      'font-family:inherit;font-weight:500;max-width:100%;position:relative;text-align:center;text-decoration:none;' +
      'transition:background 0.1s ease-out 0s,box-shadow 0.15s cubic-bezier(0.47, 0.03, 0.49, 1.38) 0s;' +
      'white-space:nowrap;background:rgba(0,88,165,0.05);cursor:pointer;height:2.28571em;line-height:2.28571em;' +
      'padding:0 0.36em;vertical-align:middle;width:auto;-webkit-box-pack:center;justify-content:center;' +
      'color:#0058a5;}' +
      '.inno-btn svg{vertical-align:text-bottom;width:1.36em;height:auto;fill:currentColor;}' +
      '.inno-btn:hover{background:rgba(0,88,165,0.15);text-decoration:inherit;transition-duration:0s, 0.15s;' +
      'color:#0058a5;}' +
      '.inno-btn:focus{background:rgba(0,88,165,0.15);box-shadow:none;transition-duration:0s,0.2s;outline:none;' +
      'color:#0058a5;}' +
      '.editing{border:0.1em solid #F00;}' +
      '.inno-btn-container{display:inline-flex;overflow:hidden;animation-duration:0.5s;animation-iteration-count:1;' +
      'animation-name:none;animation-timing-function:linear;white-space:nowrap;text-overflow:ellipsis;' +
      'margin:0 0.43em;}';

    const commitButtonId = preview ? 'commit-header-btn' : 'commit-header-btn-preview';
    if (!document.getElementById(commitButtonId)) {
      let style = document.createElement('style');
      style.innerText = buttonStyles;
      node.appendChild(style);

      let createBtn = function (id, buttondef) {
        let btn = document.createElement('button');
        btn.id = id;
        btn.className = 'inno-btn';
        btn.title = buttondef.title;
        btn.setAttribute('data-format', buttondef.format);
        let lbl = document.createElement('span');
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

      let container = document.createElement('div');
      container.className = 'inno-btn-container';
      // create main button
      container.appendChild(
        createBtn(commitButtonId, defaultButton)
      );

      // create additional buttons
      let extraButtons = GM_getValue('extraButtons', defaultExtraButtons);
      extraButtons.forEach(function (btn, i) {
        container.appendChild(createBtn(commitButtonId + '-' + i, btn));
      });
      node.appendChild(container);
    }
  }

  /**
   * Adds Tempo integration label to header
   * 
   * @param {Element} node container for label
   */
  function addTempoIntegration(node) {
    const tempoId = 'inno-tempo';
    if (!document.getElementById(tempoId)) {
      let style = document.createElement('style');
      style.innerText = `#${tempoId}{margin-left:8px;display:inline-flex;place-items:center;font-size:10pt;}` +
        `#${tempoId} span{display:inline-block;padding:0.16em;margin:0 0.16em;border-radius:0.3em;` +
        'line-height:1.2em;color:#222;border:0.16em solid rgba(0,0,0,0);cursor:default;text-align:center;}' +
        `#${tempoId} > a{color:#0058a5;text-decoration:none;padding:0.75em;margin:0 0.3em;` +
        'border-radius:0.3em;background:#f2f6fa;}' +
        `#${tempoId} > a:hover{color:#0058a5;text-decoration:none;background:#d9e6f2;}` +
        `#${tempoId} svg{vertical-align:text-bottom;fill:currentColor;max-width:1.35em;max-height:1.35em;}` +
        `#${tempoId} span.inno-orange{background-color:#FDB;border-color:#F96;}` +
        `#${tempoId} span.inno-red{background-color:#FCC;border-color:#F77;}` +
        `#${tempoId} span.inno-blue{background-color:#CCF;border-color:#77F;}`;
      node.appendChild(style);

      let span = document.createElement('span');
      span.id = tempoId;
      span.title = 'innoTempo: initializing…';
      span.innerText = 'innoTempo…';
      node.appendChild(span);
      if (tempoUpdateTimer) {
        clearTimeout(tempoUpdateTimer);
      }
      tempoUpdateTimer = setTimeout(() => { updateTempo(span); }, tempoUpdateDelayMs);
    }
  }

  /**
   * Update label with data from API.
   * 
   * @param {Element} node label to update.
   */
  function updateTempo(node) {
    if (!isTempoDisabled()) {
      if (isTempoConfigured()) {
        getTempoData(node);
      } else {
        node.innerText = 'innoTempo: ➡ configure Jira Extension in profile menu. ';
        let disable = document.createElement('a');
        disable.href = '#';
        disable.onclick = () => {
          setTempoDisabled(true);
          node.innerText = 'innoTempo: integration disabled - refresh…';
          return false;
        };
        disable.innerText = 'or disable.';
        node.appendChild(disable);
      }
    }
  }

  /**
   * Checks if tempo integration is disabled.
   * 
   * @returns {boolean} tempo integration is disabled.
   */
  function isTempoDisabled() {
    return GM_getValue('tempoDisabled', false) == true;
  }

  /**
   * Stores the state of "tempoDisabled".
   * 
   * @param {boolean} disabled state.
   */
  function setTempoDisabled(disabled) {
    GM_setValue('tempoDisabled', disabled);
  }

  /**
   * Stores the tempo access token for the api.
   * 
   * @param {string} token to access tempo api.
   */
  function setTempoToken(token) {
    GM_setValue('tempoToken', token);
  }

  /**
   * Checks, if the provided token can access the tempo api, stores the token on success.
   * 
   * @param {string} token to check and store if request was successful.
   * @returns {Promise<boolean>} success state.
   */
  function checkAndStoreTempoToken(token) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const now = new Date();
        const periods = await getTempoPeriods(now, token);
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
   * 
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
   * 
   * @param {Date} date to translate.
   * @returns {string} date in the format of "yyyy-MM-dd".
   */
  function getYMD(date) {
    return date.toLocaleDateString('en-CA');
  }

  /**
   * Adds a leading zero if needed.
   * 
   * @param {number} num number to add a leading zero to.
   * @returns {string} number with leading zero.
   */
  function lZero(num) {
    return ('0' + (num)).slice(-2);
  }

  /**
   * Gathers approval data (past 3 periods) from tempo API and displays it.
   * 
   * @param {Element} node container for display.
   */
  async function getTempoData(node) {
    try {
      const now = new Date();
      const periods = await getTempoPeriods(now);
      // clear node
      while (node.firstChild) {
        node.removeChild(node.lastChild);
      }
      node.title = '';

      if (!periods) {
        let err = document.createElement('span');
        err.innerHTML = 'Error retrieving periods from tempo api.<br>Check your browser logs!';
        node.appendChild(err);
        return;
      }

      if (now.getDay() == 1 || now.getDay() == 2) { // Mon/Tue => ignore last (current) period.
        periods.pop();
      }
      const displayPeriods = periods.slice(-3);
      // Tempo app link
      let lnk = document.createElement('a');
      lnk.href = tempoLink;
      lnk.title = 'Open Tempo app';
      lnk.innerHTML = svgTempo;
      node.appendChild(lnk);
      let periodsSeen = [];
      try {
        displayPeriods.forEach(async (p) => {
          periodsSeen.push(getFromKey(p));
          const approvalStatus = await getApprovalStatus(p);
          if (approvalStatus.statusKey == 'OPEN') {
            const toDate = new Date(p.to.slice(0, 4), Number(p.to.slice(-5).slice(0, 2)) - 1, p.to.slice(-2));
            const isCurrentWeek = new Date() < toDate;
            let span = document.createElement('span');
            span.innerHTML = `${toDate.getDate()}.${toDate.getMonth() + 1}.<br>${approvalStatus.statusKey}`;
            const missing = Math.round((approvalStatus.required - approvalStatus.logged) / 60 / 60);
            if (isCurrentWeek) {
              span.className = 'inno-blue';
            } else {
              if (missing < 8) {
                span.className = 'inno-orange';
              } else {
                span.className = 'inno-red';
              }
            }
            let lastUpdate = new Date(approvalStatus.cache);
            lastUpdate.setTime(lastUpdate.getTime() - (approvalCacheValidForHours * 60 * 60 * 1000));
            span.title = (isCurrentWeek ? 'Current week\n' : '') +
              `-${missing} hours\n` +
              `Updated: ${lZero(lastUpdate.getHours())}:${lZero(lastUpdate.getMinutes())}`;
            node.appendChild(span);
          }
        });
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
   * Gets available "periods" from tempo api.
   * 
   * @param {Date} now current Date (for easeier access).
   * @param {string} withToken forces http request with this token, ignores cache.
   * @returns {Promise} tempo periods within the past month.
   */
  function getTempoPeriods(now, withToken) {
    return new Promise((resolve, reject) => {
      let cachedPeriods = GM_getValue('tempoPeriods', { cache: getYMD(now), periods: [] });
      let cachedDate = new Date(cachedPeriods.cache);
      if (cachedDate > now && !withToken) {
        resolve(cachedPeriods.periods);
        return;
      } else {
        let oneMonthAgo = new Date();
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
              let cacheExp = new Date();
              cacheExp.setDate(cacheExp.getDate() + periodsCacheValidForDays);
              GM_setValue('tempoPeriods', { cache: getYMD(cacheExp), periods: resp.response.periods });
              resolve(resp.response.periods);
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
   * 
   * @param {period} period current period.
   * @returns {Promise} approval status of period.
   */
  function getApprovalStatus(period) {
    return new Promise((resolve, reject) => {
      let approvals = getApprovalStatusAll();
      const fromKey = getFromKey(period);
      if (approvals[fromKey]) {
        let approval = approvals[fromKey];
        let cachedDate = new Date(approval.cache);
        if (cachedDate > new Date()) {
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
            let cacheExp = new Date();
            cacheExp.setTime(cacheExp.getTime() + (approvalCacheValidForHours * 60 * 60 * 1000));
            const ret = {
              cache: cacheExp.toISOString(),
              required: resp.response.requiredSeconds,
              logged: resp.response.timeSpentSeconds,
              statusKey: resp.response.status.key
            };
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
   * 
   * @returns {object} all approvals from TamperMonkey storage.
   */
  function getApprovalStatusAll() {
    return GM_getValue('tempoApprovals', {});
  }

  /**
   * Stores the approval data.
   * 
   * @param {string} key for storage.
   * @param {any} approval data.
   */
  function saveApprovalStatus(key, approval) {
    let approvals = getApprovalStatusAll();
    approvals[key] = approval;
    GM_setValue('tempoApprovals', approvals);
  }

  /**
   * Removes old data from the "tempoApprovals" local storage object.
   * 
   * @param {Array<string>} periodsSeen periods that have been iterated through.
   */
  function cleanupApprovalStatus(periodsSeen) {
    let approvals = getApprovalStatusAll();
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
   * Gets the "from" key of the period for storage.
   * 
   * @param {any} p time period.
   * @returns {string} identification key.
   */
  function getFromKey(p) {
    return p.from.replace(/-/g, '');
  }

  /**
   * Checks configuration values for changes, saves configuration and closes the dialog.
   */
  function saveAndCloseInnoExtensionConfigDialog() {
    let hasChanges = false;
    const currentDisabled = isTempoDisabled();
    const settingDisabled = !document.getElementById('tempoIntegrationEnabled').checked;
    if(currentDisabled !== settingDisabled) {
      hasChanges = true;
      setTempoDisabled(settingDisabled);
    }

    if(hasChanges) {
      window.alert('you need to reload the current page for changes to take effect.');
    }
    closeInnoExtensionConfigDialog();
  }

  /**
   * checks if click originated from target to avoid closing dialog on click in children and closes config dialog.
   * 
   * @param {Event} e click event.
   */
  function closeInnoExtensionConfigCheckTarget(e) {
    if(this === e.target) {
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
   * Shows the configuration dialog.
   * 
   * @param {Event} e click event.
   * @returns {boolean} false (to avoid following the link).
   */
  function showInnoExtensionConfigDialog(e) {
    if (!document.getElementById(extConfigDialogId)) {
      const background = document.createElement('div');
      background.setAttribute('style', 'position:fixed;z-index:99999;top:0;right:0;bottom:0;left:0;' +
        'background:rgba(0,0,0,0.4);opacity:1;font-size:12pt;');
      background.id = extConfigDialogId;
      const style = document.createElement('style');
      style.innerText = '.inno-dlg{width:400px;position:relative;margin:10% auto;padding:0 20px 20px;' +
        'background:#FFF;border-radius:15px;border:2px solid #36D;}' +
        '.innotitle{font-size:1.6em;padding-top:10px;margin-bottom:1em;}' +
        'hr{border:1px solid #DDD;margin:10px 0;}' +
        'h4{margin-top:0;margin-bottom:1em;}' +
        'input:not([type=checkbox]):not([type=radio]){background:white;color:black;border:1px solid black;' +
        'border-radius:4px;padding:10px;width:350px;}' +
        'input:[type=checkbox]{width:40px;}' +
        '.help{margin:15px 0;}.buttonrow{margin:10px 0}' +
        '.inno-hidden{display:none;}' +
        `#${extConfigDialogTempoDetailsId}{padding-top:1em;}` +
        '.is-invalid{border:2px solid #f00;}' +
        '.bigger{font-size:20pt;}' +
        'button{margin-right:10px;padding:10px;background:#EEF;cursor:pointer;}';
      background.appendChild(style);
      const dlg = document.createElement('div');
      dlg.className = 'inno-dlg';

      const title = document.createElement('h3');
      title.className = 'innotitle';
      title.innerText = 'jira Extension Configuration';
      dlg.appendChild(title);
      dlg.appendChild(document.createElement('hr'));
      const tokenTitle = document.createElement('h4');
      tokenTitle.innerText = 'Tempo integration';
      dlg.appendChild(tokenTitle);
      const enabledInput = document.createElement('input');
      enabledInput.type = 'checkbox';
      enabledInput.id = 'tempoIntegrationEnabled';
      enabledInput.value = '1';
      const tempoDisabled = isTempoDisabled();
      if(!tempoDisabled) {
        enabledInput.setAttribute('checked','checked');
      }
      enabledInput.onchange = function(e) {
        const isChecked = e.target.checked;
        const grp = document.getElementById(extConfigDialogTempoDetailsId);
        if(grp) {
          if(isChecked) {
            grp.className = '';
          } else {
            grp.className = 'inno-hidden';
          }
        }
      };
      dlg.appendChild(enabledInput);
      const enabledLabel = document.createElement('label');
      enabledLabel.innerText = 'Tempo integration enabled';
      enabledLabel.setAttribute('for','tempoIntegrationEnabled');
      dlg.appendChild(enabledLabel);
      const tempoGroup = document.createElement('div');
      tempoGroup.id = extConfigDialogTempoDetailsId;
      if(tempoDisabled) {
        tempoGroup.className = 'inno-hidden';
      }
      const lbl = document.createElement('label');
      lbl.innerText = 'Tempo API Token:';
      lbl.className = 'inno-margintop';
      lbl.setAttribute('for', 'tempoTokenInput');
      tempoGroup.appendChild(lbl);
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'tempoTokenInput';
      inp.value = GM_getValue('tempoToken', '');
      inp.placeholder = 'tempo token';
      tempoGroup.appendChild(inp);
      const a = document.createElement('a');
      a.href = tempoConfigLink;
      a.target = '_blank';
      a.innerText = 'open tempo configuration dialog in new tab';
      tempoGroup.appendChild(a);
      const help = document.createElement('div');
      help.className = 'help';
      help.innerText = 'open tempo settings \n➡ api integration \n➡ new token \n➡ Name=\'jira extension\', ' +
        'Ablauf=\'5000 Tage\', Benutzerdefinierter Zugriff, \'Genehmigungsbereich: Genehmigungen anzeigen / ' +
        'Bereich für Zeiträume: Zeiträume anzeigen / Bereich der Zeitnachweise: Zeitnachweise anzeigen\' \n' +
        '➡ Bestätigen \n➡ Kopieren';
      tempoGroup.appendChild(help);
      const btnRow = document.createElement('div');
      btnRow.className = 'buttonrow';
      const btn = document.createElement('button');
      btn.innerText = 'check and save token';
      btn.onclick = async function () {
        try {
          let inp = document.getElementById('tempoTokenInput');
          if(inp.classList.contains('is-invalid')) {
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
      dlg.appendChild(document.createElement('hr'));
      const buttonTitle = document.createElement('h4');
      buttonTitle.innerText = 'Edit Buttons (preview)';
      dlg.appendChild(buttonTitle);
      let previewDiv = document.createElement('div');
      previewDiv.className = 'bigger';
      dlg.appendChild(previewDiv);
      addCopyButtons(previewDiv, true);
      let editDlgDiv = document.createElement('div');
      editDlgDiv.id = extConfigDialogEditButtonId;
      dlg.appendChild(editDlgDiv);
      dlg.appendChild(document.createElement('hr'));
      const closeRow = document.createElement('div');
      closeRow.className = 'buttonrow';
      const save = document.createElement('button');
      save.innerText = 'save and close';
      save.onclick = saveAndCloseInnoExtensionConfigDialog;
      closeRow.appendChild(save);
      const close = document.createElement('button');
      close.innerText = 'cancel and close';
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
   * 
   * @param {Element} node container to add configuration button.
   */
  function addInnoExtensionConfigMenuItem(node) {
    const headerText = node.innerText.toUpperCase();
    if (headerText == 'KONTO' || headerText == 'ACCOUNT') {
      const configId = 'inno-config-lnk';
      if (!document.getElementById(configId)) {
        const parent = node.parentNode;
        let style = document.createElement('style');
        style.innerText = `.${configId}{display:flex;box-sizing:border-box;width:100%;min-height:40px;margin:0px;` +
          'padding:8px 20px;-webkit-box-align:center;align-items:center;border:0;font-size:14px;outline:0px;' +
          'text-decoration:none;user-select:none;background-color:transparent;color:#0058a5;cursor:pointer;}' +
          `.${configId}:hover{background-color:rgba(0,88,165,0.15);color:#0058a5;text-decoration:none;}` +
          `.${configId}:focus{background-color:transparent;color:#0058a5;text-decoration:none;}`;
        parent.appendChild(style);
        let lnk = document.createElement('a');
        lnk.id = configId;
        lnk.className = configId;
        lnk.href = '#';
        lnk.innerText = '⚙ Jira Extension';
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
   * 
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

  // disable extension for certain urls (confluence, tempo)
  const path = window.location.pathname;
  if (!disabledUrls.some(d => path.startsWith(d))) {
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
  }
})();
