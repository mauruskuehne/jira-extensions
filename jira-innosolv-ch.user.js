// ==UserScript==
// @name        JIRA Extensions
// @version     1.3.3
// @namespace   https://github.com/mauruskuehne/jira-extensions/
// @updateURL   https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @download    https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @icon        https://dl.dropboxusercontent.com/u/57161259/icons/cs-ohnoes-icon.png
// @author      Daniel Dähler, Maurus Kühne
// @include     https://jira.innosolv.ch/*
// @grant       GM_log
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    var summaryTimer;
    var commitMessageButtonTimer;

    //https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
    function copyTextToClipboard(text) {
        var textArea = document.createElement("textarea");

        //
        // *** This styling is an extra step which is likely not required. ***
        //
        // Why is it here? To ensure:
        // 1. the element is able to have focus and selection.
        // 2. if element was to flash render it has minimal visual impact.
        // 3. less flakyness with selection and copying which **might** occur if
        //    the textarea element is not visible.
        //
        // The likelihood is the element won't even render, not even a flash,
        // so some of these are just precautions. However in IE the element
        // is visible whilst the popup box asking the user for permission for
        // the web page to copy to the clipboard.
        //

        // Place in top-left corner of screen regardless of scroll position.
        textArea.style.position = 'fixed';
        textArea.style.top = 0;
        textArea.style.left = 0;

        // Ensure it has a small width and height. Setting to 1px / 1em
        // doesn't work as this gives a negative w/h on some browsers.
        textArea.style.width = '2em';
        textArea.style.height = '2em';

        // We don't need padding, reducing the size if it does flash render.
        textArea.style.padding = 0;

        // Clean up any borders.
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';

        // Avoid flash of white box if rendered for any reason.
        textArea.style.background = 'transparent';

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

        var newBtn = document.createElement("LI");
        var a = document.createElement("A");
        a.innerText = "Copy Commit Header";
        newBtn.appendChild(a);
        newBtn.className = "toolbar-item";

        a.className = "toolbar-trigger viewissue-share";
        a.href = "#";
        a.title = "Commit Message Header kopieren";

        a.onclick = function(){
            copyTextToClipboard("Hallo Welt");
        };

        source.appendChild(newBtn);
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
                parentLink.innerText = parentLink.name + ": " + parentLink.title;
            }
        }

        if(summaries.length > 0) {
            fixTableSize();
            window.onresize = fixTableSize;
            clearInterval(summaryTimer);
        }

        return;
    }

    // I don't know of a better way of dealing with the ajax than to check every second until
    // we find the elements we want.
    GM_log("Timer starting.");
    summaryTimer = setInterval(expandSummaries, 1000);
    commitMessageButtonTimer = setInterval(addCopyCommitMessageHeaderButton, 1000);

})();