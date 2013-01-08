/**
 * Date: 10/29/12
 * Time: 4:29 AM
 */


/*global $, PUBNUB, angular, INVALID_STATE_ERR, navigator, dbchat, setTimeout, clearTimeout, window, localStorage */
/*jslint bitwise: true */

angular.module('localDbStorage', ['localStorage']).
    factory('dbStorage', function ($http, $log, $rootScope, settingsStorage) {
        "use strict";

        // private object literal for managing private scope within the dbStorage service
        var dbApp = {
            mydb : false,
            arrQueueRecords : null,     // list of Queue records currently being processed
            isProcessing : false,       // indicates whether queue records are currently being processed or not
            oQueueTimer : null,
            maxSynchedQueueId : 0,
            delay : 1000                // how long to wait before syncing the chat logs with server
        };
        // db error handler - prevents the rest of the transaction going ahead on failure
        dbApp.errorHandler = function (transaction, error) {
            $log.error("error: " + error.message);// returns true to rollback the transaction
            return true;
        };

        // null db data handler
        dbApp.nullDataHandler = function (transaction, results) {
        };

        // starting processing of Queue records
        dbApp.startQueueProcessing = function () {
            // console.log('Start Queue Processing -- Still processing the last queue push? ' + isProcessing);
            if (dbApp.isProcessing === false) {
                dbApp.isProcessing = true;
                dbApp.arrQueueRecords = null;
                dbApp.getQueueRecords(dbApp.setQueueRecordList);
                //console.log('Processing Log: ' + isProcessing);
            } else {
                try {
                    clearTimeout(this.oQueueTimer);
                    dbApp.isProcessing = false;
                } catch (err) {
                }

                this.oQueueTimer = setTimeout(dbApp.startQueueProcessing(), dbApp.delay);	// try again in a second if you were blocked this time
            }
        };

        // starting processing of Queue records
        dbApp.stopQueueProcessing = function () {
            //console.log('stopQueueProcessing');
            dbApp.arrQueueRecords = null;
            //isProcessing = false;
        };

        // Clear the queue
        dbApp.clearQueue = function () {
            $log.info('entering clear function');
            setTimeout(dbApp.emptyQueue(dbApp.maxSynchedQueueId), dbApp.delay);
            //	isProcessing =false;
        };

        // being processing of the queue records specified
        dbApp.setQueueRecordList = function (rQueueRecords) {
            dbApp.arrQueueRecords = [];
            var queueRecordCounter = 0, queueLength = 0, queueObj = [], i, sJsonObject;

            if (rQueueRecords.rows && rQueueRecords.rows.length > 0) {
                queueLength = rQueueRecords.rows.length;
                // record the max id we're running against so other calls can move beyond it
                dbApp.maxSynchedQueueId = rQueueRecords.rows.item(0).QueueId;

                for (i = 0; i < queueLength; i += 1) {

                    sJsonObject = {
                        mobileQueueId: rQueueRecords.rows.item(i).QueueId,
                        data: rQueueRecords.rows.item(i).Data,
                        event: rQueueRecords.rows.item(i).EventType
                    };

                    queueObj.push(sJsonObject);
                }

                dbApp.postQueueRecord(JSON.stringify(queueObj));

            }
            queueObj = [];

        };

        //handles the successful posting of queue data
        dbApp.queuePostSuccess = function () {
            //remove successfully posted queue record from the database
            dbApp.arrQueueRecords = null;
            //isProcessing = false;
            dbApp.stopQueueProcessing();
        };

        //post the current queue record being processed
        dbApp.postQueueRecord = function (jsonData) {
            var self = this;
            dbApp.postQueueData(jsonData);
        };

        //send queue record to the server
        dbApp.postQueueData = function (sJSONData) {

            if (!settingsStorage.isAuth()) {
                return; // user not authenticated ! cannot process log
            }

            $http.post($rootScope.secUrl + '/sendQueueData', sJSONData, {
                'headers' : {
                    'X-Auth-Header' : settingsStorage.auth()
                }
            }).success(function (data, status, headers, config) {
                // this callback will be called asynchronously
                // when the response is available
                if (data !== undefined && data.success) {
                    dbApp.clearQueue();
                    dbApp.queuePostSuccess();
                    dbApp.isProcessing = false;
                    //console.log("No longer processing the last queue push");
                } else {
                    // allow future requests to attempt to be processed
                    // need to rollback the max queue id, too -- set it to 0 so that next pass
                    // will pick up all records
                    dbApp.maxSynchedQueueId = 0;
                    dbApp.stopQueueProcessing();
                    dbApp.isProcessing = false;
                }

                $log.info(data);
            }).error(function (data, status, headers, config) {
                // called asynchronously if an error occurs
                // or server returns response with status
                // code outside of the <200, 400) range

                // need to rollback the max queue id, too -- set it to 0 so that next pass
                // will pick up all records
                dbApp.maxSynchedQueueId = 0;
                dbApp.stopQueueProcessing();
                dbApp.isProcessing = false;
                //console.log("No longer processing the last queue push");
            });
        };

        //inserts new record into the queue table based on the data specified
        dbApp.saveToQueue = function (iEventType, sData) {
            try {
                dbApp.mydb.transaction(
                    function (transaction) {
                        transaction.executeSql('INSERT INTO Queue (EventType, Data) VALUES (?,?);',
                            [iEventType, JSON.stringify(sData)], dbApp.nullDataHandler, dbApp.errorHandler);
                    }
                );
            } catch (e) {
                $log.error(e.message);
            }
        };

        dbApp.emptyQueue =  function (maxQueueId) {
            try {
                dbApp.mydb.transaction(
                    function (transaction) {
                        transaction.executeSql('DELETE FROM Queue WHERE QueueId <= ?;', [maxQueueId], dbApp.nullDataHandler, dbApp.errorHandler);
                    }
                );
                // the queue id resets back to 0 in the table
                dbApp.maxSynchedQueueId = 0;
            } catch (e) {
                $log.error(e.message);
            }

        };

        //retrieve all records currently in the queue, beyond the last processed index
        dbApp.getQueueRecords = function (fnCallback) {
            try {
                dbApp.mydb.transaction(
                    function (transaction) {
                        transaction.executeSql('SELECT * FROM Queue WHERE QueueId > ? Order By QueueId DESC;', [dbApp.maxSynchedQueueId],
                            function (transaction, results) {
                                fnCallback(results);
                            },
                            dbApp.errorHandler);
                    }
                );
            } catch (e) {
                $log.error(e.message);
            }
        };

        //populate the specified table by calling the fnCallback function if the table has no rows
        dbApp.populateTable = function (tableName, fnCallback, fnResultsCallback) {
            var sql = "SELECT * FROM " + tableName + ";";
            try {
                dbApp.mydb.transaction(
                    function (transaction) {
                        transaction.executeSql(sql, [],
                            function (transaction, results) {
                                if (results.rows.length === 0) {
                                    fnCallback();
                                } else {
                                    if (fnResultsCallback) {
                                        fnResultsCallback(results);
                                    }
                                }
                            }, dbApp.errorHandler);
                    }
                );
            } catch (e) {
                $log.error(e.message);
            }
        };

        dbApp.createGroupTypes = function () {
            try {
                dbApp.mydb.transaction(
                    function (transaction) {

                        transaction.executeSql('INSERT INTO UserGroup (value, name) VALUES (1, "private");', [], dbApp.nullDataHandler, dbApp.errorHandler);
                        transaction.executeSql('INSERT INTO UserGroup (value, name) VALUES (2, "love");', [], dbApp.nullDataHandler, dbApp.errorHandler);
                        transaction.executeSql('INSERT INTO UserGroup (value, name) VALUES (3, "geeks");', [], dbApp.nullDataHandler, dbApp.errorHandler);
                        transaction.executeSql('INSERT INTO UserGroup (value, name) VALUES (4, "hackers");', [], dbApp.nullDataHandler, dbApp.errorHandler);
                        transaction.executeSql('INSERT INTO UserGroup (value, name) VALUES (5, "tech");', [], dbApp.nullDataHandler, dbApp.errorHandler);
                    }
                );
            } catch (e) {
                $log.error(e.message);
            }
        };

        /***
         * Function drops the specified table from the SQLite database
         * @param sTableName - name of table to drop
         */
        dbApp.dropTable = function (sTableName) {
            var sqlInstruction = 'DROP TABLE IF EXISTS ' + sTableName + ';	';

            dbApp.mydb.transaction(
                function (transaction) {
                    transaction.executeSql(sqlInstruction, [], dbApp.nullDataHandler, dbApp.errorHandler);
                }
            );
        };

        /***
         * Function cleans all the database tables for the currently logged in user
         * No parameters are required to run this function
         */
        dbApp.cleanDBTables = function () {
            //List of database tables to clean
            dbApp.dropTable('Chat');
            dbApp.dropTable('UserGroup');
            dbApp.dropTable('Queue');
            //After dropping of tables are complete then recreate
            setTimeout(this.createTables(), dbApp.delay);
        };

        /***
         * Function deletes all rows in a specified table
         * @param sTableName - name of table to drop
         */
        dbApp.cleanTable = function (sTableName) {
            var sqlInstruction = 'DELETE FROM ' + sTableName + ';	';
            dbApp.mydb.transaction(
                function (transaction) {
                    transaction.executeSql(sqlInstruction, [], dbApp.nullDataHandler, dbApp.errorHandler);
                }
            );
            $log.info("Cleaning " + sTableName);
        };

        // initialize the database
        dbApp.initDB = function () {
            try {
                var shortName = 'chatApp', version = '1.0', displayName = 'Chat Database', maxSize = 65536; // in bytes
                if (!window.openDatabase) {
                    $log.warn('not supported');
                } else {
                    dbApp.mydb = window.openDatabase(shortName, version, displayName, maxSize);
                }
            } catch (e) {

                $log.error(e);
                // Error handling code goes here.
                if (e === INVALID_STATE_ERR) {
                    // Version number mismatch.
                    $log.error("Invalid database version.");
                } else {
                    $log.error("Unknown error " + e + ".");
                }
            }
        };

        dbApp.createTables = function () {
            try {
                dbApp.mydb.transaction(
                    function (transaction) {
                        transaction.executeSql('CREATE TABLE IF NOT EXISTS UserGroup (value INT PRIMARY KEY, Name TEXT NOT NULL);', [], dbApp.nullDataHandler, dbApp.errorHandler);
                        transaction.executeSql('CREATE TABLE IF NOT EXISTS Chat (ID INTEGER PRIMARY KEY AUTOINCREMENT, UID INT NOT NULL, GID TEXT NOT NULL, RID INT NOT NULL, MESSAGE TEXT NOT NULL);', [], dbApp.nullDataHandler, dbApp.errorHandler);
                        transaction.executeSql('CREATE TABLE IF NOT EXISTS Queue(QueueId INTEGER PRIMARY KEY AUTOINCREMENT, EventType TEXT NOT NULL, Data TEXT NOT NULL);', [], dbApp.nullDataHandler, dbApp.errorHandler);
                    }
                );
            } catch (e) {
                $log.error(e.message);
            }
        };

        dbApp.initDBTables = function () {
            dbApp.populateTable('UserGroup', dbApp.createGroupTypes);
        };

        /** the following function deletes all record within user specific tables **/
        dbApp.clearDBTables = function () {
            //list of tables to be cleaned
            dbApp.cleanTable('Chat');
            dbApp.cleanTable('UserGroup');
            // cleanTable('Queue'); /** Review security issue of this */
        };

        return {

            // facade :- keep it simple ^_^

            setup : function () {
                dbApp.initDB();
                dbApp.createTables();
                dbApp.initDBTables();
            },

            teardown : function () {
                dbApp.clearDBTables();
            },

            saveChatMessage: function (senderId, groupId, recieverId, message) {
                // UID INT NOT NULL, GID TEXT NOT NULL, RID INT NOT NULL, MESSAGE TEXT NOT NULL

                try {
                    dbApp.mydb.transaction(
                        function (transaction) {
                            transaction.executeSql('INSERT INTO Chat (UID, GID, RID, MESSAGE) VALUES(?,?,?,?);',
                                [senderId, groupId, recieverId, message], function () {
                                    dbApp.saveToQueue('ChatLog', {
                                        senderId: senderId,
                                        groupId: groupId,
                                        recieverId: recieverId,
                                        message: message
                                    });
                                }, dbApp.errorHandler);
                        }
                    );

                } catch (e) {
                    $log.error(e.message);
                    return;
                }

                try {
                    clearTimeout(dbApp.oQueueTimer);
                } catch (err) {
                }	// if there was another timer waiting to start the queue, erase it and only consider this one (to make the batch bigger)
                dbApp.oQueueTimer = setTimeout(dbApp.startQueueProcessing, dbApp.delay);

            }

        };
    });

angular.module('userServices', ['ngResource', 'localStorage']).
    factory('User', function ($resource, $rootScope, settingsStorage) {
        "use strict";

        return $resource($rootScope.serverUrl + 'user/:id', {id: '@id'}, {
            get: { method: 'GET', headers: {'X-Auth-Header': settingsStorage.auth()}}, //this can also be called index or all
            save: { method: 'PUT' }, //this is the update method
            create: { method: 'POST' }
            //    destroy : { method : 'DELETE' }
        });
    });

angular.module('loginServices', ['ngResource']).
    factory('CurrentUser', function ($resource, $rootScope) {
        "use strict";
        return $resource($rootScope.mainUrl + '/currentuser/:username/:password', {username: '@username', password: '@password'}, {
            query: {method: 'GET'}
        });
    });

angular.module('RegistrationServices', ['ngResource']).
    factory('validateFields', function ($resource, $rootScope) {
        "use strict";

        return $resource($rootScope.mainUrl + '/fieldcheck/:field/:value/:token', {field: '@field', value: '@value', token: '@token'}, {
            get: {method: 'GET'}
        });
    });

angular.module('PasswordService', ['ngResource', 'localStorage']).
    factory('changePassword', function ($resource, $rootScope, settingsStorage) {
        "use strict";

        return $resource($rootScope.mainUrl + '/changepassword', {}, {
            update: { method: 'POST', headers : {'X-Auth-Header': settingsStorage.auth()}}
        });
    });

angular.module('localStorage', []).
    factory('settingsStorage', function ($log) {
        "use strict";
        var STORAGE_ID = 'user-chat-settings', USER_TTL = 'user-ttl', DEFAULT_TTL = 1800000; //30 * 60 * 1000;
        return {
            get: function () {
                return JSON.parse(window.localStorage.getItem(STORAGE_ID) || null);
            },
            isExpired : function () {
                try {
                    // has a break-in functionality
                    // if default ttl does not exists within the current version
                    // it will return null, hence expired will be false & the TTL gets updated
                    // on the next pass it will be checked
                    // NB : not the ideal way to handle TTL in a web-app,
                    var result = parseInt(window.localStorage.getItem(USER_TTL), 10);
                    return (new Date().getTime() > result);
                } catch (e) {
                    $log.error(e.message);
                    return true;
                }
            },
            updateTTL : function () {
                localStorage.setItem(USER_TTL, new Date().getTime() + DEFAULT_TTL);
            },
            auth: function () {
                var cache = this.get();
                return cache !== null ? cache.token : null;
            },
            put: function (settings) {
                localStorage.setItem(STORAGE_ID, JSON.stringify(settings));         // set USER-INFO
                localStorage.setItem(USER_TTL, new Date().getTime() + DEFAULT_TTL); // set TTL
            },
            clear: function () {
                localStorage.clear();
            },
            destroy: function (settings) {
                localStorage.removeItem(STORAGE_ID);
            },
            isAuth: function () {
                var cache = this.get(), expired = this.isExpired();

                if (!expired) {
                    // if the ttl is not expired & the user navigated to a another page
                    // then update the TTL
                    this.updateTTL();
                }

                return cache !== null && cache.token !== null && !expired;
            }
        };
    });

angular.module('errorHandler', []).
    factory('errorHandler', function ($log) {
        "use strict";

        return {
            logRequired : function ($constructor) {
                if ($constructor === undefined) {
                    $log.warn('object is null & cannot be profiled');
                }
                if ($constructor.$invalid) {
                    var $reqErrs = $constructor.$error.required, errCount = $reqErrs.length, i;
                    $log.error(errCount + " invalid fields detected");
                    for (i = 0; i < errCount; i += 1) {
                        $log.error("missing field : " + $reqErrs[i].$name);
                    }
                } else {
                    $log.info("no invalid objects detected");
                }
            },
            isvalid : function ($constructor) {
                return $constructor !== undefined && $constructor.$valid;
            }
        };
    });

angular.module('chatUtilService', []).
    factory('chatUtilService', function () {
        "use strict";
        return {
            randomColor : function () {
                return '#' + ('00000' + (Math.random() * 16777216 << 0).toString(16)).substr(-6);
            },
            getUrlVars : function () {
                var vars = [], hash, $href, hashes, i;
                $href = window.location.href;
                hashes = $href.slice($href.indexOf('?') + 1).split('&');
                for (i = 0; i < hashes.length; i += 1) {
                    hash = hashes[i].split('=');
                    vars.push(hash[0]);
                    vars[hash[0]] = hash[1];
                }
                return vars;
            },
            emoticons : function (message, icon_folder) {
                icon_folder = icon_folder || "pics/emoticons";
                var html = message, emotes, emoticon, i;

                /* keys are the emoticons
                 * values are the ways of writing the emoticon
                 *
                 * for each emoticons should be an image with filename
                 * 'face-emoticon.png'
                 * so for example, if we want to add a cow emoticon
                 * we add "cow" : ["(C)"] to emotes
                 * and an image called 'face-cow.png' under the emoticons folder
                 */
                emotes = {
                    "smile": [":-)", ":)", "=]", "=)"],
                    "sad": [":-(", "=(", ":[", ":&lt;", ":("],
                    "wink": [";-)", ";)", ";]", "*)"],
                    "smile-big": [":D", "=D", "XD", "BD", "8D", "xD"],
                    "shock": [":O", "=O", ":-O", "=-O"],
                    "devil": ["(6)"],
                    "angel": ["(A)"],
                    "crying": [":'(", ":'-("],
                    "confused": [":s", ":S"],
                    "neutral": [":|"],
                    "glasses-nerdy": ["8)", "8-)"],
                    "kiss": ["(K)", ":-*"],
                    "tongue": [":p", ":P"]
                };

                /* Replaces all ocurrences of emoticons in the given html with images
                 */
                for (emoticon in emotes) {
                    if (emotes.hasOwnProperty(emoticon)) {
                        for (i = 0; i < emotes[emoticon].length; i += 1) {
                            /* css class of images is emoticon img for styling them */
                            html = html.replace(emotes[emoticon][i], "<img src=\"" + icon_folder + "/" + emoticon + ".png\" class=\"emoticonimg\" alt=\"" + emotes[emoticon][i] + "\"/>", "g");
                        }
                    }
                }
                return html;
            }
        };
    });