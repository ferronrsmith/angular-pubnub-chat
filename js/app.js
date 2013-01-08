/**
 * The main ChatMVC app module.
 *
 * @type {angular.Module}
 */

/*global $, angular, navigator,window */
/*jslint bitwise: true */

var dbchat = angular.module('dbchat', ['userServices', 'loginServices', 'localStorage', 'localDbStorage', 'errorHandler', 'chatUtilService', 'RegistrationServices', 'PasswordService']);

dbchat.run(function ($rootScope, $window, $log, settingsStorage, dbStorage) {
    "use strict";

    // default configuration object
    // do not add anything here - use the extend
    var config = (function () {
        var mode, nav, url, url2, href, path, imgPath, lastIdx;
        nav = navigator.userAgent.toLocaleLowerCase();
        mode = nav.match(/(ip[ao]d|iphone|android)/i) ? "PROD" : "DEV";     //DEV or PROD
        url = (mode === 'PROD') ? 'http://ferronrsmith.pythonanywhere.com' : 'http://localhost\\:5000';
        url2 = (mode === 'PROD') ? url : 'http://localhost:5000';
        href = $window.location.href;
        path = '/api/v1/';
        imgPath = '/static/img/users/';
        lastIdx = href.lastIndexOf('/');
        return {
            $href : href,
            $currentPage : href.substr(lastIdx + 1, href.length),
            authPage : 'login.html',                // login page
            registerPage : 'register.html',         // registration page
            anchorPage : 'main.html',               // main page (user has to be authenticated to view this)
            openPage : 'index.html',                // default start-up page
            url : url,
            url2 : url2,
            serverUrl : url + path,
            imgPath : url2 + imgPath
        };
    }());

    // db initialization functionality
    dbStorage.setup();
    $.fn.jqmHijackable();


    angular.extend($rootScope, {
        serverUrl : config.serverUrl,
        imgPath : config.imgPath,
        mainUrl : config.url,
        secUrl : config.url2,
        currPage : config.$currentPage,
        currentUser : settingsStorage.get(),
        clear : function () {
            settingsStorage.destroy();
            dbStorage.teardown();
        },
        back : function () {
            window.history.back();
        },
        cancel : function () {
            window.location = "index.html";
        },
        signout : function () {
            $rootScope.clear();
            $.mobile.changePage(config.openPage, "flow");
        },
        uuid : function () {
            var mask = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
            return (function (mask) {
                return mask.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }(mask));
        }
    });

    // current page
    $log.info(config.$currentPage);

    /**************************************************
     Controls site wide authentication redirect
     **************************************************/

    // check if user has a token
    // check if the user not on allowed pages <login.html,register.html>
    if (!settingsStorage.isAuth() && config.$currentPage !== config.authPage &&
            config.$currentPage !== config.registerPage && config.$currentPage !== config.openPage) {
        $rootScope.clear();
        $.mobile.changePage(config.openPage, "flow");
    } else if (settingsStorage.isAuth() && (config.$currentPage === config.authPage ||
        config.$currentPage === config.registerPage || config.$currentPage === config.openPage)) {
        $.mobile.changePage(config.anchorPage, 'flow');
    }

});