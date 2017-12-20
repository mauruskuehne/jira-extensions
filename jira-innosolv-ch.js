// ==UserScript==
// @name        JIRA Extensions
// @version     1.2.2
// @namespace   https://www.khanacademy.org/profile/KnowMoreStuff/
// @updateURL   https://openuserjs.org/meta/KnowMoreStuff/Oh_Yes!.meta.js
// @downloadURL https://openuserjs.org/src/scripts/KnowMoreStuff/Oh_Yes!.user.js
// @icon        https://dl.dropboxusercontent.com/u/57161259/icons/cs-ohnoes-icon.png
// @homepageURL http://codeyourown.site/
// @author      Robert Stone
// @description Oh Yes! Oh Noes! The Error Buddy is now much less annoying on Khan Academy.
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

        return;
    }

    // I don't know of a better way of dealing with the ajax than to check every second until
    // we find the elements we want.
    GM_log("Oh Yes: Timer starting.");
    timer = setInterval(expandSummaries, 1000);

})();