/**
 * Date: 10/31/12
 * Time: 3:01 AM
 * To change this template use File | Settings | File Templates.
 */


dbchat.directive('imgPath', function () {
    "use strict";
    return {
        //templateUrl : '/path/to/some/template.html', //(optional) the contents of this template can be downloaded and constructed into the element
        //replace : true, //whether or not to replace the inner data within the element
        compile: function (tElement, tAttrs, transclude) {
            return {
                pre: function (scope, iElement, iAttrs, controller) {

                }, //this is called before the directive element is attached to the DOM
                post: function (scope, iElement, iAttrs, controller) {

                    scope.$watch(function () {
                        if (scope.user && scope.user.picture.indexOf('gravatar') !== -1) {
                            // special handler for gravatar images
                            iElement.attr('src', scope.user.picture);

                        } else {
                            iElement.attr('src', scope.imgPath + scope.user.picture);
                        }
                    });
                } //this is called after the directive element is attached to the DOM (same as link)
            };
        }
    };
});

/**
 * directive that listens for user keypress of the enter key
 */
dbchat.directive('keyPress', function () {
    "use strict";
    return function (scope, elem, attrs) {
        elem.bind('keydown', function (e) {
            if ((e.keyCode || e.charCode) !== 13) {
                return true;
            }
            if (scope[attrs.keyPress]) {
                scope[attrs.keyPress]();
            }
            return false;
        });
    };
});

dbchat.directive('checkElem', function () {
    "use strict";

    var validateEmail = function (email) {
        var re = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
        return re.test(email);
    };

    return function (scope, elem, attrs) {
        elem.bind('blur', function () {
            var elem_val = angular.lowercase(elem.val()), id = elem.attr("id");
            if (elem_val.trim().length > 0 && validateEmail(elem_val)) {
                scope.check_field(elem_val, id);
            } else if (id === 'username') {
                scope.check_field(elem_val, id);
            }
        });
    };
});

dbchat.directive('showCurrentuser', function () {
    "use strict";
    return {
        restrict: 'A',
        link: function (scope, elem, attrs) {
            attrs.$observe('showCurrentuser', function (value) {
                if (value === 'false') {
                    elem.hide();
                } else {
                    elem.show();
                }
            });
        }

    };
});
