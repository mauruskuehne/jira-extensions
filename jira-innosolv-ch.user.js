// ==UserScript==
// @name        JIRA Extensions
// @version     1.4.6
// @namespace   https://github.com/mauruskuehne/jira-extensions/
// @updateURL   https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @download    https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @icon        https://fuse314.github.io/ico/jira-extensions.png
// @author      Daniel Dähler, Maurus Kühne, Gottfried Mayer
// @include     https://jira.innosolv.ch/*
// @grant       GM_log
// @grant       GM_addStyle
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle('.aui-header .aui-header-logo img { margin-top:3px; }'); // korrigiert die vertikale Ausrichtung vom Logo im Header

    var summaryTimer;
    var commitMessageButtonTimer;

    //https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
    function copyTextToClipboard(text) {
        var textArea = document.createElement("textarea");
        textArea.style="position:fixed;top:0;left:0;width=2em;height=2em;padding=0;border=none;outline=none;boxShadow=none;background=transparent;";
        /*textArea.style.position = 'fixed';
        textArea.style.top = 0;
        textArea.style.left = 0;
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = 0;
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';*/

        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();

        try {
            var successful = document.execCommand('copy');
            var msg = successful ? 'successful' : 'unsuccessful';
            console.log('Copying text command was ' + msg);
        } catch (err) {
            console.log('Oops, unable to copy');
        }
        document.body.removeChild(textArea);
    }

    function addCopyCommitMessageHeaderButton() {
        var source = document.getElementById("opsbar-jira.issue.tools");

        if(source == null) {
            return;
        }

        clearInterval(commitMessageButtonTimer);

        var existing = document.getElementById("commit-header-btn");
        if(existing != null) {
            existing.parentNode.removeChild(existing);
        }

        var a = document.createElement("a");
        a.id = "commit-header-btn";
        a.className = "aui-button toolbar-trigger";
        a.href = "#";
        a.title = "Commit Message Header kopieren";
        var ico = document.createElement("span");
        ico.className = "icon aui-icon aui-icon-small aui-iconfont-copy";
        ico.style="margin-right:4px;";
        a.appendChild(ico);
        var lbl = document.createElement("span");
        lbl.className = "trigger-label";
        lbl.innerText = "Commit Header";
        a.appendChild(lbl);

        a.onclick = function(){

            var parentIssueSummary = document.getElementById("parent_issue_summary");
            var taskNr = "";
            var taskText = "";

            if(parentIssueSummary != null) {
                taskNr = parentIssueSummary.getAttribute("data-issue-key");
                taskText = parentIssueSummary.title;
            }
            else {
                taskNr = document.getElementById("key-val").innerText;
                taskText = document.getElementById("summary-val").innerText;
            }

            copyTextToClipboard(taskNr + ": " + taskText);
        };

        source.appendChild(a);
    }

    function fixTableSize() {
        var source = document.querySelector("#tempo-table > div > #issuetable > thead > tr:nth-child(2) > th.left.colHeaderLink.headerrow-summary.padding");
        var destination = document.querySelector("#stalker > div > div.content-container.tt-content-container > div > div > #issuetable > thead > tr:nth-child(2) > th.left.colHeaderLink.headerrow-summary.padding");

        if(destination != null && source != null) {
            destination.width = source.offsetWidth - 8;
        }
    }

    function expandSummaries() {

        var summaries = document.getElementsByClassName("summary");
        for (var i = 0; i < summaries.length; i++) {
            var summary = summaries[i];
            var parentLink = summary.getElementsByClassName("parentIssue")[0];
            if (parentLink)
            {
                if (!parentLink.name)
                {
                    parentLink.name = parentLink.innerText;
                }
                parentLink.innerText = parentLink.name + ": " + shortenDesc(parentLink.title,80);
            }
        }

        if(summaries.length > 0) {
            fixTableSize();
            window.onresize = fixTableSize;
            clearInterval(summaryTimer);
        }

        return;
    }
    function shortenDesc(desc, len) {
        if (typeof desc === 'string' || desc instanceof String) {
          if(desc.length > len) {
              return desc.substring(0,len)+"…";
          } else {
              return desc;
          }
        } else {
            return desc;
        }
    }

    // I don't know of a better way of dealing with the ajax than to check every second until
    // we find the elements we want.
    GM_log("Timer starting.");
    summaryTimer = setInterval(expandSummaries, 1000);
    commitMessageButtonTimer = setInterval(addCopyCommitMessageHeaderButton, 1000);
    
    document.body.addEventListener('click', function() {
        clearInterval(summaryTimer);
        clearInterval(commitMessageButtonTimer);
        summaryTimer = setInterval(expandSummaries, 1000);
        commitMessageButtonTimer = setInterval(addCopyCommitMessageHeaderButton, 1000);
    }, true);

})();
