// ==UserScript==
// @name        JIRA Extensions
// @version     2.0.16
// @namespace   https://github.com/mauruskuehne/jira-extensions/
// @updateURL   https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @downloadURL https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @icon        data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath fill='%23fff' d='M0 0h48v48H0z' style='fill:%23224f9b;fill-opacity:1'/%3E%3Cpath fill='none' d='M0 0h48v48H0z'/%3E%3Cpath fill='%23224f9b' d='M19.88 44.926V11.46l8.24-8.385v41.852h-8.24' style='fill:%23fff;fill-opacity:1'/%3E%3Cpath d='M4.463 35.31H5.56v-2.922a1.461 1.461 0 0 1 1.462-1.462h2.922v-1.097a1.828 1.828 0 0 1 3.656 0v1.097h2.922a1.455 1.455 0 0 1 1.455 1.461l.003 2.778h-1.092a1.974 1.974 0 0 0-1.973 1.973 1.974 1.974 0 0 0 1.973 1.973h1.093l.004 2.777a1.46 1.46 0 0 1-1.461 1.462h-2.778v-1.095a1.974 1.974 0 0 0-1.973-1.975 1.974 1.974 0 0 0-1.974 1.975v1.095H7.022a1.461 1.461 0 0 1-1.462-1.46v-2.924H4.465a1.828 1.828 0 0 1 0-3.655z' style='fill:none;stroke:%23000;stroke-width:.770397;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1'/%3E%3C/svg%3E
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
 * {2} Prefix für Commit (z.B. fix oder feat) -- "feat" bei Änderungstyp=Anforderung oder G3-Vorgang, sonst "fix".
 */

/* global GM_getValue, GM_setValue, GM_log, GM_xmlhttpRequest */
(() => {
  'use strict';

  // tempo cloud API base URL.
  const tempoBaseUrl = 'https://api.tempo.io/4/';
  // tempo frontend link.
  const tempoLink = 'https://innosolv.atlassian.net/plugins/servlet/ac/io.tempo.jira/tempo-app';
  const tempoEditLink = `${tempoLink}#!/my-work/week?type=TIME&date=`;
  const tempoConfigLink = `${tempoLink}#!/configuration/api-integration`;
  // cache time periods for x days in local storage.
  const periodsCacheValidForDays = 1;
  // cache time schedules for x days in local storage.
  const scheduleCacheValidForDays = 2;
  // cache approval data for x hours in local storage.
  const approvalCacheValidForHours = 4;
  // mark periods as "too old" (complete now!!) after x days.
  const tempoMarkPeriodTooOldAfterDays = 14;
  // delay to update tempo display: jira/wiki sometimes remove/recreate the "create" button.
  const tempoUpdateDelayMs = 1500;
  const tempoFetchPastDate = 40;
  // setTimeout handle to avoid firing multiple times.
  let tempoUpdateTimer = 0;
  // configuration dialog id
  const extConfigDialogId = 'jiraExtConfigDialog';
  const extConfigDialogEditButtonId = 'jiraExtConfigDialogEditButtonDialog';
  const extConfigDialogTempoDetailsId = 'jiraExtConfigDialogTempoDetails';
  // tempo integration id
  const tempoId = 'inno-tempo';
  // configuration menu item id
  const configMenuItemId = 'inno-config-lnk';
  // disable extension for these urls
  const disabledUrls = ['/wiki/', '/plugins/'];

  const persistKeyJiraUser = 'jiraUserId';
  const persistKeyTempoDisabled = 'tempoDisabled';
  const persistKeyTempoToken = 'tempoToken';
  const persistKeyTempoTokenAllowsSchedule = 'tempoTokenAllowsSchedule';
  const persistKeyTempoPeriods = 'tempoPeriods';
  const persistKeyTempoSchedule = 'tempoSchedule';
  const persistKeyTempoApprovals = 'tempoApprovals';
  const persistKeyButtonDef = 'buttonsDefinition';
  const persistKeyButtonDefVersion = 'buttonsDefinitionVersion';

  const innoButtonId = 'innoJiraButtons';
  const innoButtonPreviewId = 'innoJiraButtonsPreview';

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

  const defaultButtons = [
    {
      text: 'Msg', title: 'git commit Nachricht kopieren', format: '{2}: {1} [{0}]', icon: svgMessageAltEdit,
    },
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
  const copyButtonStyles =
    '.inno-btn{-webkit-box-align:baseline;align-items:baseline;border-width:0;' +
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
  const tempoStyles =
    '#inno-tempo{margin-left:8px;display:inline-flex;place-items:center;font-size:10pt;}' +
    '#inno-tempo span{display:inline-block;padding:0.16em;margin:0 0.16em;border-radius:0.3em;z-index:20;' +
    'line-height:1.2em;color:var(--ds-text);border:0.16em solid transparent;cursor:default;text-align:center;' +
    'position:relative;}' +
    '#inno-tempo a{text-decoration:none;}#inno-tempo a:hover{text-decoration:none;}' +
    '#inno-tempo > a{color:var(--ds-icon-accent-blue);padding:0.75em;margin:0 0.3em;' +
    'border-radius:0.3em;background:var(--ds-background-neutral);z-index:20;}' +
    '#inno-tempo > a:hover{color:var(--ds-icon-accent-blue);background:var(--ds-background-neutral-hovered);}' +
    '#inno-tempo .inno-cursor {cursor:pointer;}' +
    '#inno-tempo svg{vertical-align:text-bottom;fill:currentColor;max-width:1.35em;max-height:1.35em;}' +
    '#inno-tempo i.small {font-style:normal;font-size:0.75rem;}' +
    '#inno-tempo i.small a {font-size:0.6rem;margin-left:0.2rem;}' +
    '#inno-tempo span.inno-orange{color:var(--ds-text-accent-orange);' +
    'background-color:var(--ds-background-accent-orange-subtler);border-color:var(--ds-border-accent-orange);}' +
    '#inno-tempo span.inno-red{color:var(--ds-text-accent-red);' +
    'background-color:var(--ds-background-accent-red-subtler);border-color:var(--ds-border-accent-red);}' +
    '#inno-tempo span.inno-yellow{color:var(--ds-text-accent-yellow);' +
    'background-color:var(--ds-background-accent-yellow-subtler);border-color:var(--ds-border-accent-yellow);}' +
    '#inno-tempo span:after{content:" ";display:block;position:absolute;width:100%;top:0;left:0;right:0;' +
    'background:color-mix(in srgb,color-mix(in srgb,currentColor 70%,var(--ds-surface)) 30%, transparent);' +
    'height:var(--innoprogress,0%);pointer-events:none;}' +
    '#inno-tempo span.inno-refresh{cursor:pointer;align-self:flex-start;z-index:10;margin-left:-0.6em;' +
    'color:var(--ds-icon-accent-blue);background:transparent;font-size:0.8em;}' +
    '#inno-tempo span.inno-refresh:hover{color:var(--ds-icon-accent-blue);' +
    'background:var(--ds-background-neutral-hovered);}' +
    '@media only screen and (max-width:780px) {#inno-tempo{display:none;}}';
  const configDialogBackgroundStyles =
    'position:fixed;z-index:99999;top:0;right:0;bottom:0;left:0;' +
    'background:var(--ds-blanket);opacity:1;font-size:12pt;';
  const configDialogStyles =
    '.inno-dlg{width:500px;position:relative;margin:10% auto;padding:0 20px 20px;' +
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
  const configMenuItemStyles =
    '.inno-config-lnk{display:flex;box-sizing:border-box;width:100%;min-height:40px;' +
    'margin:0px;padding:8px 20px;-webkit-box-align:center;align-items:center;border:0;font-size:14px;outline:0px;' +
    'text-decoration:none;user-select:none;background-color:transparent;color:currentColor;' +
    'cursor:pointer;}' +
    '.inno-config-lnk:hover{background-color:var(--ds-background-neutral-subtle-hovered);color:currentColor;' +
    'text-decoration:none;}' +
    '.inno-config-lnk:focus{background-color:transparent;color:currentColor;text-decoration:none;}';
  const configHelpText1 =
    "open tempo settings \n➡ api integration \n➡ new token \n➡ Name='jira extension', " +
    "Ablauf='365 Tage', Benutzerdefinierter Zugriff,\n'Genehmigungsbereich: Genehmigungen anzeigen /\n" +
    'Bereich für Zeiträume: Zeiträume anzeigen /\nBereich der Schemata: Schemata anzeigen /\n' +
    "Bereich der Zeitnachweise: Zeitnachweise anzeigen'\n" +
    '➡ Bestätigen \n➡ Kopieren';
  const couldNotReadUserScheduleText =
    'tempo token does not allow reading users schedule information!' +
    ' -- create new tempo token including schema => "read" access rights and save it in the extensions config dialog.';

  class CachedTempoApproval {
    /**
     * @class CachedTempoApproval
     * @param {string} cache datetime string of cache expiration
     * @param {number} required number of seconds
     * @param {number} logged number of seconds
     * @param {string} statusKey status of period
     * @param {string|null} errorText error text, if statusKey == "ERROR"
     */
    constructor(cache, required, logged, statusKey, errorText) {
      /** @type {string} */
      this.cache = cache;
      /** @type {number} */
      this.required = required;
      /** @type {number} */
      this.logged = logged;
      /** @type {string} */
      this.statusKey = statusKey;
      /** @type {string|null} */
      this.errorText = errorText;
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

  class TempoSchedule {
    /**
     * @class TempoSchedule
     * @param {string} date date string
     * @param {number} requiredSeconds required time in seconds
     * @param {string} type schedule type
     */
    constructor(date, requiredSeconds, type) {
      /** @type {string} */
      this.date = date;
      /** @type {number} */
      this.requiredSeconds = requiredSeconds;
      /** @type {string} */
      this.type = type;
    }
  }

  class ButtonDefinition {
    /**
     * @class ButtonDefinition
     * @param {string} text display text of the button.
     * @param {string} title title of the button.
     * @param {string} format copy format of the button, including replacement variables {0}-{2}.
     * @param {string} icon icon of the button. This overrides the "text" property.
     */
    constructor(text, title, format, icon) {
      /** @type {string} */
      this.text = text;
      /** @type {string} */
      this.title = title;
      /** @type {string} */
      this.format = format;
      /** @type {string} */
      this.icon = icon;
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
   * @property {string|undefined} title of jira issue
   * @property {string|undefined} jiraNumber id of jira issue
   * @property {'fix'|'feat'|undefined} prefix commit text prefix
   */
  /**
   * Gets the Title, JIRA "Number" (ID, such as SU-1000), and prefix.
   * @returns {jiraIssueData} data of current jira issue.
   */
  function getData() {
    const emptyData = {
      jiraNumber: undefined,
      title: undefined,
      prefix: undefined,
    };
    const issueLink =
      // backlog view, detail view
      document.querySelector('[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]') ||
      // kanban view
      document.querySelector('.ghx-selected a');
    if (!issueLink) {
      GM_log('jira-innosolv-extensions: could not find issueLink.');
      return emptyData;
    }
    const jiraNumber = issueLink.dataset.tooltip || issueLink.innerText;
    if (!jiraNumber) {
      GM_log('jira-innosolv-extensions: could not find issue number.');
      return emptyData;
    }

    const title =
      (
      // kanban view with details in a modal, standalone view
        document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]') ||
      // backlog view, detail view
        Array.from(document.querySelectorAll('h1')).pop()
    ).innerText;
    if (!title) {
      GM_log('jira-innosolv-extensions: could not find issue title.');
      return emptyData;
    }

    return {
      jiraNumber,
      title,
      prefix: getPrefix(jiraNumber, title),
    };
  }

  /**
   * Gets the commit prefix from issue number and issue title
   * @param {string} issueNumber issue number
   * @param {string} title issue title
   * @returns {'feat'|'fix'} commit text prefix
   */
  function getPrefix(issueNumber, title) {
    if (issueNumber.startsWith('G3') && !title.startsWith('Issue: ')) {
      return 'feat';
    } else if (issueNumber.startsWith('EN')) {
      const aenderungstyp = document.querySelector('[data-testid*="customfield_10142.field-inline-edit-state"]');
      if (aenderungstyp && aenderungstyp.innerText == 'Anforderung') {
        return 'feat';
      }
    }
    return 'fix';
  }

  /**
   * Gets the Title, JIRA ID and title using the provided format.
   * @param {string} format of the text
   * @returns {string|false} formatted value or false if data could not be gathered.
   */
  function getDataAndFormat(format) {
    const fmt = format || '{0} {1}';
    const { jiraNumber, title, prefix } = getData();
    if (!jiraNumber || !title || !prefix) return false;
    let txtToCopy = fmt.split('{0}').join(jiraNumber);
    txtToCopy = txtToCopy.split('{1}').join(title);
    txtToCopy = txtToCopy.split('{2}').join(prefix);
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
        () => {
          flashCopiedMessage.bind(targBtn)(e, true);
        },
        () => {
          flashCopiedMessage.bind(targBtn)(e, false);
        },
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
      GM_log('jira-innosolv-extensions: edit dialog is not open, ignoring PREVIEW click.');
    }
    // clear 'editing' class from all buttons, add class to currently clicked button
    if (targBtn.hasAttribute('data-buttondef')) {
      setClassAndRemoveFromSiblings(targBtn, 'editing');
    }
    if (targBtn.hasAttribute('data-buttondef')) {
      const buttonDef = JSON.parse(targBtn.getAttribute('data-buttondef'));

      makeButtonEditForm(editDialog, buttonDef, undefined, targBtn.id);
    } else {
      makeButtonEditForm(
        editDialog,
        undefined,
        'Button ist nicht bearbeitbar oder besitzt keine Definition.',
        targBtn.id,
      );
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
      addLabelAndInput(editDiv, 'buttonText', 'Text', 'Nur wenn Icon leer ist.', buttonDefinition.text);
      addLabelAndInput(editDiv, 'buttonTitle', 'Titel', undefined, buttonDefinition.title, true);
      addLabelAndInput(
        editDiv,
        'buttonFormat',
        'Format',
        '{0}=Vorgang-Nr., {1}=Titel, {2}=Prefix \\t=tab \\r=CR \\n=LF',
        buttonDefinition.format,
        true,
      );
      addLabelAndInput(editDiv, 'buttonIcon', 'Icon', undefined, buttonDefinition.icon);
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
   * @param {string|undefined} subtitle of the label.
   * @param {string} value of the input element.
   * @param {boolean} specialChars handle special chars like \t \r \n
   */
  function addLabelAndInput(node, id, title, subtitle, value, specialChars = false) {
    if (subtitle === undefined) {
      const label = createNode('label', undefined, `${title}: `);
      label.setAttribute('for', id);
      node.appendChild(label);
    } else {
      const label = createNode('label');
      label.setAttribute('for', id);
      const labelText = document.createTextNode(`${title}: `);
      label.appendChild(labelText);
      const hint = createNode('small', undefined, subtitle);
      label.appendChild(hint);
      node.appendChild(label);
    }
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
    return disabledUrls.some((d) => path.startsWith(d));
  }

  /**
   * Returns the currently stored button definitions or default definitions.
   * Checks migration status and migrates old button definitions (extraButtons) to new format.
   * @returns {Promise<ButtonDefinition[]>} button definitions.
   */
  function getButtonDefinitions() {
    return new Promise((resolve, reject) => {
      try {
        // check migration state
        if (GM_getValue(persistKeyButtonDefVersion, 2) < 2) {
          // migration to v2 disabled.
          GM_setValue(persistKeyButtonDefVersion, 2);
        }
        // already migrated, get button definitions.
        const buttonDefs = GM_getValue(persistKeyButtonDef, defaultButtons);
        /** @type {ButtonDefinition[]} */
        const ret = [];
        buttonDefs.forEach((e) => {
          ret.push(new ButtonDefinition(e.text, e.title, e.format, e.icon));
        });
        resolve(ret);
      } catch (ex) {
        reject(ex);
      }
    });
  }

  /**
   * Creates extension button for custom "copy" commands.
   * @param {ButtonDefinition} buttondef button definition.
   * @param {boolean} preview create preview of button.
   * @returns {Element} button node.
   */
  function createButton(buttondef, preview) {
    const btn = createNode('button', 'inno-btn', undefined, undefined, buttondef.title);
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
      btn.onclick = buttonClickedPreview; // onclick function for preview window
    } else {
      btn.onclick = buttonClicked; // onclick function
    }
    return btn;
  }

  /**
   * Adds configured copy buttons and styling to node.
   * @param {Element} node container to add the buttons to.
   * @param {boolean} preview preparation for configuration dialog
   */
  async function addCopyButtons(node, preview = false) {
    if (isIgnoredPath()) {
      return;
    }

    const buttonsId = preview ? innoButtonPreviewId : innoButtonId;
    if (!document.getElementById(buttonsId)) {
      node.appendChild(createNode('style', undefined, copyButtonStyles));
      const container = createNode('div', 'inno-btn-container', undefined, buttonsId);
      const buttons = await getButtonDefinitions();
      buttons.forEach((btn) => {
        container.appendChild(createButton(btn, preview));
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
    if (!isTempoDisabled()) {
      if (!checkForCssVar()) {
        // page has not finished loading yet, wait some time and re-run function...
        window.setTimeout(() => updateTempo(node), 300);
        return;
      }
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
   * @returns {boolean} css variable is present.
   */
  function checkForCssVar() {
    const styles = getComputedStyle(document.querySelector(':root'));
    const textvar = styles.getPropertyValue('--ds-text');
    if (!textvar) {
      return false;
    }
    return true;
  }

  /**
   * Checks if tempo integration is disabled.
   * @returns {boolean} tempo integration is disabled.
   */
  function isTempoDisabled() {
    return GM_getValue(persistKeyTempoDisabled, false) == true;
  }

  /**
   * Stores the state of "tempoDisabled".
   * @param {boolean} disabled state.
   */
  function setTempoDisabled(disabled) {
    GM_setValue(persistKeyTempoDisabled, disabled);
  }

  /**
   * Stores the tempo access token for the api.
   * @param {string} token to access tempo api.
   */
  function setTempoToken(token) {
    GM_setValue(persistKeyTempoToken, token);
  }

  /**
   * Checks if tempo token allows getting the user's schedule information
   * @returns {boolean} tempo token allows requesting user's schedule information
   */
  function getTempoTokenAllowsSchedule() {
    return GM_getValue(persistKeyTempoTokenAllowsSchedule, true) == true;
  }

  /**
   * Stores, wether the tempo token allowed accessing the user's schedule information
   * @param {boolean} isAllowed user's schedule was retrieved successfully
   */
  function setTempoTokenAllowsSchedule(isAllowed) {
    GM_setValue(persistKeyTempoTokenAllowsSchedule, isAllowed);
  }

  /**
   * Fetches data from tempo API.
   * @param {string} relativeUrl relative URL.
   * @param {string|undefined} withToken use specific token.
   * @returns {Promise<any>} data.
   */
  function fetchData(relativeUrl, withToken) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      GM_xmlhttpRequest({
        ...getPropsForGetRequest(relativeUrl, withToken),
        onload: (resp) => {
          if (resp.status == 200) {
            const shortUrl = /^.*?(?=\/|\?|$)/.exec(relativeUrl)[0];
            GM_log(`fetchData ${Math.round(performance.now() - start)}ms for ${shortUrl}`);
            resolve(resp.response);
          } else {
            if (resp.status == 403 && withToken === undefined) {
              // unauthorized => token invalid or expired.
              reject("fetchData: Error 403 Unauthorized. Check your token!");
            }
            reject(resp.status);
          }
        },
        fetch: true,
      });
    });
  }

  /**
   * Checks, if the provided token can access the tempo api, stores the token on success.
   * @param {string} token to check and store if request was successful.
   * @returns {Promise<boolean|string>} success state. If string is returned, it contains the "yes, but" reason.
   */
  function checkAndStoreTempoToken(token) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const now = new Date();
        const periods = await getTempoPeriods(now, true, token);
        if (periods) {
          setTempoToken(token);
          try {
            if (!getTempoTokenAllowsSchedule()) {
              setTempoTokenAllowsSchedule(true);
            }
            const schedule = await getSchedule(periods[periods.length - 1], true, now, token);
            if (schedule) {
              resolve(true);
            }
          } catch (ex) {
            resolve(ex);
          }
          resolve(true);
        } else {
          reject('The webservice returned no periods. Check "jiraUserId" in Tampermonkey under "storage"!');
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Checks, if the configuration for tempo integration is complete.
   * @returns {boolean} Configuration is complete.
   */
  function isTempoConfigured() {
    if (GM_getValue(persistKeyJiraUser, '') !== '') {
      if (GM_getValue(persistKeyTempoToken, '') !== '') {
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
   * Get Date object from date string.
   * @param {string} date date string in format of "yyyy-MM-dd".
   * @returns {Date} date object.
   */
  function getDateFromString(date) {
    return new Date(date.slice(0, 4), Number(date.slice(-5).slice(0, 2)) - 1, date.slice(-2));
  }

  /**
   * Adds a leading zero if needed.
   * @param {number} num number to add a leading zero to.
   * @returns {string} number with leading zero.
   */
  function lZero(num) {
    return String(num).padStart(2, '0');
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

      /** @type {TempoPeriod|null} */
      let nowPeriod = null;
      if (now.getDay() == 1 || now.getDay() == 2) {
        // Mon/Tue => ignore last (current) period.
        periods.pop();
      } else {
        nowPeriod = periods[periods.length - 1];
      }
      const displayPeriods = periods.slice(-4);
      // Tempo app link
      const lnk = createNode('a', undefined, undefined, undefined, 'Open Tempo app');
      lnk.href = tempoLink;
      lnk.innerHTML = svgTempo;
      node.appendChild(lnk);
      const periodsSeen = [];
      for (const p of displayPeriods) {
        periodsSeen.push(p.fromKey());
        const approvalStatus = await getApprovalStatus(p, forceUpdate, now);

        const fromDate = getDateFromString(p.from);
        const toDate = getDateFromString(p.to);
        const isCurrentWeek = now < toDate;
        const lastUpdate = new Date(approvalStatus.cache);
        lastUpdate.setTime(lastUpdate.getTime() - approvalCacheValidForHours * 60 * 60 * 1000);

        if (approvalStatus.statusKey == 'OPEN') {
          // start of period was more than x days ago - and thus should be completed immediately.
          const tooOldDate = new Date();
          tooOldDate.setDate(tooOldDate.getDate() - tempoMarkPeriodTooOldAfterDays);
          const isTooOld = fromDate < tooOldDate;
          const useSchedule = nowPeriod !== null && nowPeriod == p;
          const required = await getRequiredTime(approvalStatus.required, useSchedule, nowPeriod, forceUpdate, now);
          const span = createNode('span');
          span.appendChild(
            document.createTextNode(`${isTooOld ? '❌ ' : ''}${fromDate.getDate()}.${fromDate.getMonth() + 1}.`),
          );
          span.appendChild(createNode('br'));
          const i = createNode('i', 'small');
          i.appendChild(document.createTextNode('Open'));
          if (!isCurrentWeek) {
            const edit = createNode('a', undefined, '✏️', undefined, 'In Tempo bearbeiten');
            edit.href = `${tempoEditLink}${getYMD(fromDate)}`;
            i.appendChild(edit);
          }
          span.appendChild(i);
          const missing = -((required - approvalStatus.logged) / 60 / 60).toFixed(2);
          span.className = getClassForPeriod(isCurrentWeek, isTooOld, missing > -8);
          let missingPercent = 0;
          if (required > 0) {
            missingPercent = 100 - Math.min(Math.round((100.0 / required) * approvalStatus.logged), 100);
          }
          span.style = `--innoprogress:${missingPercent}%;`;
          span.title =
            (isCurrentWeek ? 'Current week\n' : '') +
            (isTooOld ? 'Do it now‼️\n' : '') +
            `${missing} hours\n` +
            `Updated: ${lZero(lastUpdate.getHours())}:${lZero(lastUpdate.getMinutes())}`;
          node.appendChild(span);
        }
        if (approvalStatus.statusKey == 'ERROR') {
          const span = createNode('span', 'inno-red');
          span.appendChild(document.createTextNode(`❌ ${fromDate.getDate()}.${fromDate.getMonth() + 1}.`));
          span.appendChild(createNode('br'));
          const i = createNode('i', 'small');
          i.appendChild(document.createTextNode('ERROR'));
          const edit = createNode('a', undefined, '✏️', undefined, 'In Tempo bearbeiten');
          edit.href = `${tempoEditLink}${getYMD(fromDate)}`;
          i.appendChild(edit);
          span.appendChild(i);
          span.title =
            `Error!\n${approvalStatus.errorText}\n` +
            `Updated: ${lZero(lastUpdate.getHours())}:${lZero(lastUpdate.getMinutes())}`;
          node.appendChild(span);
        }
      }
      cleanupApprovalStatus(periodsSeen);
    } catch (e) {
      GM_log(`getTempoData: Exception ${e}`);
      const span = createNode('span', 'inno-red');
      span.appendChild(document.createTextNode('⚠️ Error'));
      span.appendChild(createNode('br'));
      span.appendChild(document.createTextNode('See Tooltip.'));
      span.title = `Error:\n${e}`;
      node.appendChild(span);
    }
    const refresh = createNode('span', 'inno-refresh', undefined, undefined, 'force update');
    refresh.innerHTML = svgRefresh;
    refresh.onclick = () => {
      getTempoData(node, true);
    };
    node.appendChild(refresh);
  }

  /**
   * Returns the default properties object for a XMLHttp "GET" request.
   * @param {string} relativeUrl relative request url.
   * @param {string|undefined} withToken use a specific token (optional).
   * @returns {object} default properties for XMLHttp Request.
   */
  function getPropsForGetRequest(relativeUrl, withToken) {
    return {
      method: 'GET',
      url: `${tempoBaseUrl}${relativeUrl}`,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${withToken ? withToken : GM_getValue(persistKeyTempoToken, '')}`,
      },
      responseType: 'json',
    };
  }

  /**
   * Gets available "periods" from tempo api.
   * @param {Date} now current Date (for easeier access).
   * @param {boolean} forceUpdate forces update (ignore cache).
   * @param {string} withToken forces http request with this token, ignores cache.
   * @returns {Promise<TempoPeriod[]>} tempo periods within the past month.
   */
  async function getTempoPeriods(now, forceUpdate, withToken) {
    const cachedPeriods = GM_getValue(persistKeyTempoPeriods, {
      cache: getYMD(now),
      periods: [],
    });
    const cachedDate = new Date(cachedPeriods.cache);
    if (cachedDate > now && !withToken && !forceUpdate) {
      /** @type {TempoPeriod[]} */
      const periods = [];
      for (let i = 0; i < cachedPeriods.periods.length; i++) {
        const period = cachedPeriods.periods[i];
        periods.push(new TempoPeriod(period.from, period.to));
      }
      return periods;
    } else {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - tempoFetchPastDate);
      const pastParam = getYMD(pastDate);
      const nowParam = getYMD(now);
      const result = await fetchData(`periods?from=${pastParam}&to=${nowParam}`, withToken);
      const cacheExp = new Date();
      cacheExp.setDate(cacheExp.getDate() + periodsCacheValidForDays);
      /** @type {TempoPeriod[]} */
      const periods = [];
      for (let i = 0; i < result.periods.length; i++) {
        const period = result.periods[i];
        periods.push(new TempoPeriod(period.from, period.to));
      }
      GM_setValue(persistKeyTempoPeriods, {
        cache: getYMD(cacheExp),
        periods: periods,
      });
      return periods;
    }
  }

  /**
   * Returns css class name for period, according to status.
   * @param {boolean} isCurrentWeek period is the current week.
   * @param {boolean} isTooOld period is too old.
   * @param {boolean} missingLessThanADay period is missing less than a day's time.
   * @returns {string} css class name for display.
   */
  function getClassForPeriod(isCurrentWeek, isTooOld, missingLessThanADay) {
    if (isCurrentWeek) {
      return 'inno-yellow';
    } else {
      if (isTooOld) {
        return 'inno-red';
      } else {
        if (missingLessThanADay) {
          return 'inno-yellow';
        } else {
          return 'inno-orange';
        }
      }
    }
  }

  /**
   * Gets Workload (required time per day) for current user.
   * @param {TempoPeriod} period current period.
   * @param {boolean} forceUpdate ignore cache, force update.
   * @param {Date} now now Date, for easy access.
   * @param {string|undefined} token use this token for request.
   * @returns {Promise<TempoSchedule[]>} tempo schedule for user.
   */
  async function getSchedule(period, forceUpdate, now, token) {
    return new Promise((resolve, reject) => {
      if (!getTempoTokenAllowsSchedule() && !forceUpdate) {
        reject(couldNotReadUserScheduleText);
      }
      const cachedSchedule = GM_getValue(persistKeyTempoSchedule, {
        cache: getYMD(now),
        schedule: [],
      });
      const cachedDate = new Date(cachedSchedule.cache);
      if (cachedDate > now && !forceUpdate) {
        /** @type {TempoSchedule[]} */
        const schedule = [];
        for (let i = 0; i < cachedSchedule.schedule.length; i++) {
          const sched = cachedSchedule.schedule[i];
          schedule.push(new TempoSchedule(sched.date, sched.requiredSeconds, sched.type));
        }
        resolve(schedule);
        return;
      } else {
        const start = performance.now();
        GM_xmlhttpRequest({
          ...getPropsForGetRequest(`user-schedule?from=${period.from}&to=${period.to}`, token),
          onload: (resp) => {
            if (resp.status == 200) {
              const gotResult = performance.now();
              if (resp.response.results && resp.response.results.length > 0) {
                const cacheExp = new Date();
                cacheExp.setDate(cacheExp.getDate() + scheduleCacheValidForDays);
                /** @type {TempoSchedule[]} */
                const schedule = [];
                for (let i = 0; i < resp.response.results.length; i++) {
                  const sched = resp.response.results[i];
                  schedule.push(new TempoSchedule(sched.date, sched.requiredSeconds, sched.type));
                }
                GM_setValue(persistKeyTempoSchedule, {
                  cache: getYMD(cacheExp),
                  schedule: schedule,
                });
                GM_log(`getSchedule: Request ${Math.round(gotResult - start)}ms.`);
                resolve(schedule);
                return;
              }
            } else if (resp.status == 403) {
              if (getTempoTokenAllowsSchedule()) {
                setTempoTokenAllowsSchedule(false);
                reject(couldNotReadUserScheduleText);
              }
            }
            reject(resp);
          },
        });
      }
    });
  }

  /**
   * Returns the number of required seconds for the current period.
   * If useScheduleTime is false, the requiredFromApproval is always returned.
   * If useScheduleTime is true, the time is calculated from the user's schedule.
   * @param {number} requiredFromApproval required time from approvalStatus.
   * @param {boolean} useScheduleTime use schedule to get required seconds until today.
   * @param {TempoPeriod} period current period.
   * @param {boolean} forceUpdate force update, ignore cache.
   * @param {Date} now now Date for easy access.
   * @returns {Promise<number>} required seconds for period.
   */
  async function getRequiredTime(requiredFromApproval, useScheduleTime, period, forceUpdate, now) {
    if (useScheduleTime) {
      try {
        let requiredSeconds = 0;
        const schedule = await getSchedule(period, forceUpdate, now);
        schedule.forEach((v) => {
          const schedDate = getDateFromString(v.date);
          if (schedDate <= now) {
            requiredSeconds += v.requiredSeconds;
          }
        });
        return requiredSeconds;
      } catch (e) {
        GM_log(`getRequiredTime: Exception ${e}`);
        return requiredFromApproval;
      }
    } else {
      return requiredFromApproval;
    }
  }

  /**
   * Gets approval status of one period.
   * @param {TempoPeriod} period current period.
   * @param {boolean} forceUpdate force update (ignore cache).
   * @param {Date} now current Date for easier access.
   * @returns {Promise<CachedTempoApproval>} approval status of period.
   */
  async function getApprovalStatus(period, forceUpdate, now) {
    const approvals = getApprovalStatusAll();
    const fromKey = period.fromKey();
    if (approvals[fromKey]) {
      const approval = approvals[fromKey];
      const cachedDate = new Date(approval.cache);
      if (cachedDate > now && !forceUpdate) {
        return approval;
      }
    }
    const cacheExp = new Date();
    cacheExp.setTime(cacheExp.getTime() + approvalCacheValidForHours * 60 * 60 * 1000);

    try {
      const result = await fetchData(
        `timesheet-approvals/user/${GM_getValue(persistKeyJiraUser, '')}?from=${period.from}&to=${period.to}`,
      );
      const ret = new CachedTempoApproval(
        cacheExp.toISOString(),
        result.requiredSeconds,
        result.timeSpentSeconds,
        result.status.key,
        null,
      );
      saveApprovalStatus(fromKey, ret);
      return ret;
    } catch (e) {
      const ret = new CachedTempoApproval(cacheExp.toISOString(), 0, 0, 'ERROR', e);
      saveApprovalStatus(fromKey, ret);
      return ret;
    }
  }

  /**
   * Gets all approval statuses from storage.
   * @returns {object} all approvals from TamperMonkey storage.
   */
  function getApprovalStatusAll() {
    return GM_getValue(persistKeyTempoApprovals, {});
  }

  /**
   * Stores the approval data.
   * @param {string} key for storage.
   * @param {CachedTempoApproval} approval data.
   */
  function saveApprovalStatus(key, approval) {
    const approvals = getApprovalStatusAll();
    approvals[key] = approval;
    GM_setValue(persistKeyTempoApprovals, approvals);
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
      GM_setValue(persistKeyTempoApprovals, approvals);
    }
  }

  /**
   * Checks configuration values for changes, saves configuration and closes the dialog.
   */
  function saveAndCloseInnoExtensionConfigDialog() {
    let changed = false;
    const integrationEnabledElement = document.getElementById('tempoIntegrationEnabled');
    if (integrationEnabledElement) {
      const currentDisabled = isTempoDisabled();
      const settingDisabled = !integrationEnabledElement.checked;
      if (currentDisabled !== settingDisabled) {
        changed = true;
        setTempoDisabled(settingDisabled);
      }

      if (changed) {
        window.alert('you need to reload the current page for changes to take effect.');
      }
      closeInnoExtensionConfigDialog();
    } else {
      // dialog no longer exists, bail out.
      return;
    }
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
    const dlg = document.getElementById(extConfigDialogId);
    if (dlg) {
      dlg.remove();
    }
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
      enabledInput.onchange = (e) => {
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
        extConfigDialogTempoDetailsId,
      );
      const lbl = createNode('label', 'inno-margintop', 'Tempo API Token:');
      lbl.setAttribute('for', 'tempoTokenInput');
      tempoGroup.appendChild(lbl);
      const inp = createNode('input', undefined, undefined, 'tempoTokenInput');
      inp.type = 'text';
      inp.value = GM_getValue(persistKeyTempoToken, '');
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
      const btnRow = createNode('div', 'buttonrow');
      const btn = createNode('button', 'inno-savebtn', 'check and save tempo data');
      btn.onclick = async () => {
        try {
          const inp = document.getElementById('tempoTokenInput');
          if (inp && inp.classList) {
            inp.classList.remove('is-invalid');
            const success = await checkAndStoreTempoToken(inp.value);
            if (success === true) {
              saveAndCloseInnoExtensionConfigDialog();
            } else if (typeof success === 'string') {
              // display warning about reading user's schedule, close after 5 seconds.
              const parent = inp.parentNode;
              const info = createNode('div', 'help is-invalid', success);
              parent.appendChild(info);
              window.setTimeout(() => {
                parent.removeChild(info);
                saveAndCloseInnoExtensionConfigDialog();
              }, 5000);
            } else {
              inp.classList.add('is-invalid');
            }
          } else {
            throw 'tempoTokenInput could not be found in DOM!';
          }
        } catch (e) {
          GM_log(`check and save tempo data, onClick: Exception ${e}`);
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
        const lnk = createNode('a', configMenuItemId, '⚙️ inno-Jira Extension', configMenuItemId);
        lnk.href = '#';
        lnk.onclick = showInnoExtensionConfigDialog;
        parent.appendChild(lnk);
      }
    } else if (headerText == 'JIRA') {
      if (GM_getValue(persistKeyJiraUser, '') == '') {
        const link = node.nextSibling.querySelector('a[href^="/jira/people/');
        let match;
        if (link && link.href && (match = /\/jira\/people\/([0-9a-f]+)$/.exec(link.href))) {
          GM_setValue(persistKeyJiraUser, match[1]);
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
    let btargetsFound;
    const targetNodes = document.querySelectorAll(selectorTxt);

    if (targetNodes && targetNodes.length > 0) {
      btargetsFound = true;
      targetNodes.forEach((element) => {
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
    } else {
      btargetsFound = false;
    }

    //--- Get the timer-control variable for this selector.
    const controlObj = waitForKeyElements.controlObj || {};
    const controlKey = selectorTxt.replace(/[^\w]/g, '_');
    let timeControl = controlObj[controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound && bWaitOnce && timeControl) {
      //--- The only condition where we need to clear the timer.
      clearInterval(timeControl);
      delete controlObj[controlKey];
    } else {
      //--- Set a timer, if needed.
      if (!timeControl) {
        timeControl = setInterval(() => {
          waitForKeyElements(selectorTxt, actionFunction, bWaitOnce);
        }, 300);
        controlObj[controlKey] = timeControl;
      }
    }
    waitForKeyElements.controlObj = controlObj;
  }

  // jira-extension relevant function calls

  // copy buttons
  const actionSelector = 'div[data-testid="issue.views.issue-base.foundation.status.actions-wrapper"]';
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
