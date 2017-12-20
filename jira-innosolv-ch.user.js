// ==UserScript==
// @name        JIRA Extensions
// @version     1.3.1
// @namespace   https://github.com/mauruskuehne/jira-extensions/
// @updateURL   https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @download   https://github.com/mauruskuehne/jira-extensions/raw/master/jira-innosolv-ch.user.js
// @icon        https://dl.dropboxusercontent.com/u/57161259/icons/cs-ohnoes-icon.png
// @author      Daniel Dähler, Maurus Kühne
// @include     https://jira.innosolv.ch/*
// @grant       GM_log
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    var timer;

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
            clearInterval(timer);
        }

        return;
    }

    // I don't know of a better way of dealing with the ajax than to check every second until
    // we find the elements we want.
    GM_log("Timer starting.");
    timer = setInterval(expandSummaries, 1000);

})();