// ==UserScript==
// @name        WaniKani SRS Level Progress
// @namespace   hitechbunny
// @description Review schedule explorer for WaniKani
// @version     0.0.4
// @include     https://www.wanikani.com/dashboard
// @include     https://www.wanikani.com/
// @run-at      document-end
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    var api_key;

    var css =
        '.srs-innner-progress {'+
        '    position: relative;'+
        '    color: #fff;'+
        '}'+
        '.srs-progress .srs-innner-progress span.srs-inner-progress-count {'+
        '    display: inline;'+
        '    font-size: 15px;'+
        '    font-weight: initial;'+
        '    text-shadow: initial;'+
        '}'+
        '.dashboard section.srs-progress span {'+
        '    margin-bottom: 4px;'+
        '}'+
        '.dashboard section.srs-progress .srs-innner-progress .leech-count .leech-breakdown {'+
        '    background-color: black;'+
        '    font-size: 0.8em;'+
        '    font-weight: 100;'+
        '    opacity: 0.75;'+
        '    display: none;'+
        '}'+
        '.dashboard section.srs-progress .srs-innner-progress .leech-count {'+
        '    background-color: black;'+
        '    position: absolute;'+
        '    right: -1.0em;'+
        '    bottom: -2.5em;'+
        '    padding-left: 0.3em;'+
        '    padding-right: 0.3em;'+
        '    font-size: 1em;'+
        '    opacity: 0.25;'+
        '    font-weight: 100;'+
        '}'+
        '.dashboard section.srs-progress .srs-innner-progress .leech-count a {'+
        '    color: white;'+
        '}'+
        '.dashboard section.srs-progress li:hover .srs-innner-progress .leech-count {'+
        '    opacity: 1.0;'+
        '}'+
        '.dashboard section.srs-progress li:hover .srs-innner-progress .leech-count .leech-breakdown {'+
        '    display: inline;'+
        '}'+
        '';

    var head = document.getElementsByTagName('head')[0];
    if (head) {
        var style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.textContent = css;
        head.appendChild(style);
    }

    ['apprentice', 'guru', 'master', 'enlightened', 'burned'].forEach(function(level, _) {
        $('li#'+level+' span').after('<div class="srs-innner-progress"><span class="srs-inner-progress-count">&nbsp;</span></div>');
    });

    //-------------------------------------------------------------------
    // Fetch a document from the server.
    //-------------------------------------------------------------------
    function ajax_retry(url, retries, timeout) {
        //console.log(url, retries, timeout);
        retries = retries || 3;
        timeout = timeout || 3000;
        function action(resolve, reject) {
            $.ajax({
                url: url,
                timeout: timeout
            })
            .done(function(data, status){
                //console.log(status, data);
                if (status === 'success') {
                    resolve(data);
                } else {
                    //console.log("done (reject)", status, data);
                    reject();
                }
            })
            .fail(function(xhr, status, error){
                //console.log(status, error);
                if ((status === 'error' || status === 'timeout') && --retries > 0) {
                    //console.log("fail", status, error);
                    action(resolve, reject);
                } else {
                    reject();
                }
            });
        }
        return new Promise(action);
    }

    //-------------------------------------------------------------------
    // Fetch API key from account page.
    //-------------------------------------------------------------------
    function get_api_key() {
        return new Promise(function(resolve, reject) {
            api_key = localStorage.getItem('apiKey_v2');
            if (typeof api_key === 'string' && api_key.length == 36) return resolve();

            // status_div.html('Fetching API key...');
            ajax_retry('/settings/account').then(function(page) {

                // --[ SUCCESS ]----------------------
                // Make sure what we got is a web page.
                if (typeof page !== 'string') {return reject();}

                // Extract the user name.
                page = $(page);

                // Extract the API key.
                api_key = page.find('#user_api_key_v2').attr('value');
                if (typeof api_key !== 'string' || api_key.length !== 36) {
                    return reject(new Error('generate_apikey'));
                }

                localStorage.setItem('apiKey_v2', api_key);
                resolve();

            },function(result) {
                // --[ FAIL ]-------------------------
                reject(new Error('Failed to fetch API key!'));

            });
        });
    }

    var update = function(json) {
        $('.srs-inner-progress-count').remove();
        var level_counts = {};
        var srs_numeric_to_inner_level = [0, 1, 2, 3, 4, 1, 2, 1, 1, 1];
        var srs_to_number_of_inner_levels = {
            apprentice: 4,
            guru: 2
        };
        ['apprentice', 'guru'].forEach(function(level, _) {
            var level_data = json.levels[level];
            var missing_data = false;
            var number_of_inner_levels = srs_to_number_of_inner_levels[level] || 1;
            var html = '';
            var running_total = 0;
            for(var inner_level = 1; inner_level <= number_of_inner_levels; inner_level++) {
                var total = level_data.srs_level_totals[inner_level-1];
                running_total += total;
                if (inner_level == number_of_inner_levels) {
                    var true_total = parseInt($('.srs-progress li#'+level+' span').html());
                    var delta = true_total - running_total;

                    // assume that the missing items are at the most advanced level
                    if (delta > 0) {
                        //total += delta;
                        missing_data = true;
                    }
                }
                if (html) {
                    html += '&nbsp;/&nbsp;';
                } else {
                    html = '<div class="srs-innner-progress">';
                }
                html += '<span class="srs-inner-progress-count">'+total+(missing_data ? '.' : '')+'</span>';
            }
            html += '</div>';
            $('.srs-progress li#'+level+' span').after(html);
        });
        ['master', 'enlightened', 'burned'].forEach(function(level, _) {
            $('li#'+level+' span').after('<div class="srs-innner-progress"><span class="srs-inner-progress-count">&nbsp;</span></div>');
        });
        json.levels.order.forEach(function(level) {
            var leech_total = json.levels[level].leeches_total;
            if (leech_total) {
                var html = '<span class="leech-count" title="'+leech_total+' '+(leech_total > 1 ? 'leeches' : 'leech')+'">'+
                    '<a href="https://wanikanitools.curiousattemptbunny.com/leeches.html?sort_by=srs&api_key='+api_key+'#'+level+'" target="_blank">';
                if (level == 'apprentice' || level == 'guru') {
                    html += '<span class="leech-breakdown">(';
                    json.levels[level].srs_level_leeches_totals.forEach(function(subtotal, i) {
                        if (i>0) {
                            html += ' / ';
                        }
                        html += subtotal;
                    });
                    html += ')&nbsp</span>';
                }
                html += leech_total+
                    '</a></span>';
                $('.srs-progress li#'+level+' .srs-innner-progress').append(html);
            }
        });
    };
    window.raw_user_data = null;
    get_api_key().then(function() {
        console.log('v2 api_key is', api_key);
        if (api_key) {
            ajax_retry('https://wanikanitools.curiousattemptbunny.com/srs/status?api_key='+api_key, 3, 120000).then(function(json) {
                update(json);
            });
        }
    });
})();