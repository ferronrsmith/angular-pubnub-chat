function UserCtrl($scope, $log, CurrentUser, settingsStorage, errorHandler) {
    "use strict";
    // code for current user goes here

    $scope.login = function (user) {
        $log.info('clicked!!');
        $log.info($scope);

        errorHandler.logRequired($scope.userlogin);

        if (errorHandler.isvalid($scope.userlogin)) {
            CurrentUser.get({username: angular.lowercase(user.username), password: user.password}, function (result) {
                if (result.success) {
                    settingsStorage.put(result);
                    window.location = 'main.html';
                } else {
                    $scope.message = result.cause;
                }
            });
        }
    };
}

function FriendListCtrl($scope, $log, User) {
    "use strict";
    $.mobile.loading('show', {
        text: 'loading contacts list ...',
        textVisible: true,
        theme: 'a',
        html: ""
    });

    User.get(function (data) {

        if (data.statusCode !== 'undefined' && data.statusCode === 401) {
            $log.info(data);
        } else {
            $log.info(data);
            var userArr = data.objects;
            // support in IE+9 & webkit browsers
            $scope.users = userArr.filter(function (elem) {
                return elem.username !== $scope.currentUser.username;
            });

            // $scope.users = data.objects;
            $scope.orderProp = 'firstname';
        }

        $.mobile.loading('hide');
    });

}

function FriendDetailsCtrl($scope, $log, User, chatUtilService, errorHandler, validateFields, changePassword) {
    "use strict";
    var $id = chatUtilService.getUrlVars().id, $friendPic = null;

    if ($id !== undefined || $id < 1) {
        User.get({id: $id }, function (data) {
            $scope.user = data;
            $log.info(data);

            $scope.$watch($scope.user, function () {
                var user = this.exp;

                if (user.cellPhone === null || user.cellPhone === "") {
                    $('#cPhone').remove();
                    $('#sPhone').remove();
                }
                if (user.picture) {
                    $friendPic = $('#friendPic');
                    if (user.picture.indexOf('gravatar') !== -1) {
                        $friendPic.attr('src', user.picture);
                    } else {
                        $friendPic.attr('src', $scope.imgPath + user.picture);
                    }
                }
            });
        });
    }

    $scope.register = function () {

        if ($scope.registration !== undefined && $scope.registration.$invalid) {
            errorHandler.logRequired($scope.registration);
            return; // invalid data
        }

        if ($scope.user !== undefined) {
            User.create($scope.user, function (result) {
                if (result) {
                    $log.info(result);
                    $('#message').popup('open', {transition: 'flip'});
                }
            }, function (error) {
                $log.info(error);
            });
            //$scope.chat.$save();
        }

    };

    $scope.changePassword = function () {

        var user = $scope.user;
        $scope.message = null;

        if (user === undefined || $scope.user.opassword === undefined || $scope.user.npassword === undefined || $scope.user.ccpassword === undefined || $.trim(user.opassword).length === 0) {
            $scope.message = 'password fields cannot be empty';
        } else {
            if (user.npassword === user.ccpassword) {
                changePassword.update(user, function (result) {
                    if (result.success) {
                        $('#message').popup('open', {transition: 'flip'});
                    } else {
                        $scope.message = result.reason;
                    }
                });
            } else {
                $scope.message = 'password does not match';
            }
        }
    };

    $scope.check_field = function (val, elem) {
        validateFields.get({field: elem, value: val, token: $scope.uuid()}, function (result) {
            if (result.success) {
                $scope.fieldcallback(result, elem);
            }
        });
    };

    $scope.fieldcallback = function (result, elem) {
        if (!result.available) {
            $('#servercheck-' + elem).text('Someone already has that ' + elem + '. Try Another ?');
            $('#' + elem).removeClass('ng-valid').addClass('ng-invalid');
        } else {
            $('#servercheck-' + elem).text('');
            $('#' + elem).removeClass('ng-invalid').addClass('ng-valid');
        }
    };
}

function MainCtrl() {
    "use strict";
    // empty base controller
}

function ChatCtrl($scope, settingsStorage, $log, dbStorage, chatUtilService, $compile) {
    "use strict";
    var channel  = "mobile-chat", randColor = chatUtilService.randomColor(), $chatLogArea = $("#textarea"), template, pubnub;


    $scope.authCheck = function () {
        // do not subscribe user if not authenticated
        if (!settingsStorage.isAuth()) {

            PUBNUB.unsubscribe({
                channel: channel
            });

            $scope.clear();
            $.mobile.changePage('index.html', "flow");

        }
        return;
    };

    template = angular.element("<div class='message'><span style='color:{{message.color}}'>{{message.chatName}} " +
        "&nbsp;<img ng-src='pics/flags/png/{{message.location}}.png'></span> : {{message.text}} </div>");


    $scope.subscribe = function () {

        // do not subscribe user if not authenticated
        $scope.authCheck();

        $.mobile.loading('show', {
            text: 'loading chat history ...',
            textVisible: true,
            theme: 'a',
            html: ""
        });

        pubnub = PUBNUB.init({
            uuid : $scope.currentUser.uid,
            publish_key   : 'pub-55c55aa6-bad5-4840-a763-856d5491c6e2',
            subscribe_key : 'sub-eaeeea59-1620-11e2-8227-41e039a6ef57',
            ssl           : false,
            origin        : 'pubsub.pubnub.com'
        });

        pubnub.subscribe({
            channel  : channel,
            connect : function () {
                $scope.fetchChatHistory($scope.loadChatHistory);
                $log.info('connected to pubnub');
            },
            error : function () {
                $.mobile.loading('hide');
            },
            callback : function (message) {

                $chatLogArea.append(
                    $scope.chatTemplate(message.color, message.chatName, message.text, message.location)
                );

                // add log to local database
                dbStorage.saveChatMessage(message.uid, message.groupId, $scope.currentUser.uid, message.text);

                $chatLogArea.scrollTop(
                    $chatLogArea[0].scrollHeight
                );
            }
        });
    };

    /**
     * Chat template
     * @param color     - hex color
     * @param chatName  - sender chat name
     * @param message   - user message
     * @param location  - user location
     * @return {string} - compiled message template
     */
    $scope.chatTemplate = function (color, chatName, message, location) {

        var cloneElement;
        $scope.message = {
            text: message,
            color : color,
            chatName : chatName,
            location : (location !== undefined) ? location.toLowerCase() : location
        };

        cloneElement = $scope.compileTemplate(template, $scope);

        return $("<div></div>").append(chatUtilService.emoticons(template.html(), null));
    };

    $scope.compileTemplate = function (template, context) {
        var cloneElement = $compile(template)(context);
        context.$apply(cloneElement);
        return cloneElement;
    };

    $scope.sendMessage = function () {

        var $messageText = $("#messageText"), $groupId = 0; // public chat group id

        // do not subscribe user if not authenticated
        $scope.authCheck();

        pubnub.publish({
            channel : channel,
            message : {
                chatName : $scope.currentUser.username,
                uid      : $scope.currentUser.uid,
                groupId  : $groupId,
                text     : $messageText.val(),
                color    : randColor,
                location : $scope.currentUser.location.countryCode,
                country  : $scope.currentUser.location.countryName
            },
            callback : function (response) {
                $messageText.val("");
            }
        });
    };

    /**
     * Callback function to iterate through a list of chat history messages and add to the chat textarea
     * @param messages - history messages
     */
    $scope.loadChatHistory = function (messages) {
        var $chatLogArea = $("#textarea");
        angular.forEach(messages, function (message, key) {
            $chatLogArea.append($scope.chatTemplate('#787878;font-weight:bold', message.chatName, message.text, message.location));
        });
    };

    /**
     * Fetch chat history from pubnub and pass to a callback function
     * @param callback - callback function
     */
    $scope.fetchChatHistory = function (callback) {
        pubnub.history({
            channel : channel,
            limit : 20,
            callback: function (messages) {
                if (callback) {
                    $log.info('running callback');
                    callback(messages);
                    $.mobile.loading('hide'); // fetching records

                    // scroll to bottom of window after adding data
                    $chatLogArea.scrollTop(
                        $chatLogArea[0].scrollHeight
                    );
                }
            }
        });
    };
}