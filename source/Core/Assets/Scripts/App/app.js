﻿/// <reference path="../Libs/angular.min.js" />
/// <reference path="../Libs/angular-route.min.js" />

(function (angular) {
    var app = angular.module("ttIdm", []);
    
    app.service("idmApi", function ($http, $q) {
        var api;
        this.start = function () {
            var q = $q.defer();
            if (api) {
                q.resolve(api);
            }
            else {
                $http.get("api").then(function (resp) {
                    api = resp.data;
                    q.resolve(api);
                }, function (resp) {
                    q.reject('Error loading API');
                });
            }
            return q.promise;
        };
    });

    app.service("idmCurrentUser", function ($http, idmApi) {
        var user = {
            username:'Admin'
        };
        this.user = user;

        idmApi.start().then(function (config) {
            $http.get(config.currentUser).then(function (response) {
                if (response.data.username) {
                    user.username = response.data.username;
                }
            });
        });
    });

    app.service("idmUsers", function ($http) {
        function nop() {
        }
        function mapData(response) {
            return response.data;
        }
        function errorHandler(msg) {
            msg = msg || "Unexpected Error";
            return function (response) {
                throw (response.data.errors || msg);
            }
        }

        this.getUsers = function (filter, start, count) {
            return $http.get("api/users", { params: { filter: filter, start: start, count: count } })
                .then(mapData, errorHandler("Error Getting Users"));
        };
        this.getUser = function (subject) {
            return $http.get("api/users/" + encodeURIComponent(subject))
                .then(mapData, errorHandler("Error Getting User"));
        };

        this.createUser = function (username, password) {
            return $http.post("api/users", { username: username, password: password })
                .then(mapData, errorHandler("Error Creating User"));
        };
        this.deleteUser = function (subject) {
            return $http.delete("api/users/" + encodeURIComponent(subject))
                .then(nop, errorHandler("Error Deleting User"));
        };
        this.setPassword = function (subject, password) {
            return $http.put("api/users/" + encodeURIComponent(subject) + "/password", { password: password })
                .then(nop,  errorHandler("Error Setting Password"));
        };
        this.setEmail = function (subject, email) {
            return $http.put("api/users/" + encodeURIComponent(subject) + "/email", { email: email })
                .then(nop,  errorHandler("Error Setting Email"));
        };
        this.setPhone = function (subject, phone) {
            return $http.put("api/users/" + encodeURIComponent(subject) + "/phone", { phone: phone })
                .then(nop,  errorHandler("Error Setting Phone"));
        };
        this.addClaim = function (subject, type, value) {
            return $http.post("api/users/" + encodeURIComponent(subject) + "/claims" , { type: type, value: value })
                .then(nop,  errorHandler("Error Adding Claim"));
        };
        this.removeClaim = function (subject, type, value) {
            return $http.delete("api/users/" + encodeURIComponent(subject) + "/claims/" + encodeURIComponent(type) + "/" + encodeURIComponent(value))
                .then(nop,  errorHandler("Error Removing Claim"));
        };
    });
})(angular);

(function (angular) {

    function Feedback() {
        var self = this;
        var _errors;
        var _message;

        self.clear = function () {
            _errors = null;
            _message = null;
        };

        Object.defineProperty(this, "message", {
            get: function () {
                return _message;
            },
            set: function (value) {
                self.clear();
                _message = value;
            }
        });
        Object.defineProperty(this, "errors", {
            get: function () {
                return _errors;
            },
            set: function (value) {
                self.clear();
                if (value instanceof Array) {
                    _errors = value;
                }
                else {
                    _errors = [value];
                }
            }
        });

        self.messageHandler = function (message) {
            self.message = message;
        };
        self.errorHandler = function (errors) {
            self.errors = errors;
        };
        self.createMessageHandler = function (msg) {
            return function () {
                self.message = msg;
            };
        };
        self.createErrorHandler = function (msg) {
            return function (errors) {
                self.errors = errors || msg;
            };
        };
    }

    var app = angular.module("app", ['ngRoute', 'ttIdm']);
    app.config(function ($routeProvider) {
        $routeProvider
            .when("/", {
                controller: 'HomeCtrl',
                templateUrl: 'assets/Templates.home.html'
            })
            .when("/list/:filter?/:page?", {
                controller: 'ListUsersCtrl',
                templateUrl: 'assets/Templates.users.list.html'
            })
            .when("/create", {
                controller: 'NewUserCtrl',
                templateUrl: 'assets/Templates.users.new.html'
            })
            .when("/edit/:subject", {
                controller: 'EditUserCtrl',
                templateUrl: 'assets/Templates.users.edit.html'
            })
            .otherwise({
                redirectTo: '/'
            });
    });

    app.directive("idmMessage", function () {
        return {
            restrict: 'E',
            scope: {
                model:"=message"
            },
            templateUrl: 'assets/Templates.message.html',
            link: function (scope, elem, attrs) {

            }
        };
    });

    app.controller("LayoutCtrl", function ($scope, idmCurrentUser) {
        $scope.model = idmCurrentUser.user;
    });

    app.controller("HomeCtrl", function ($scope) {
        $scope.model = {};
    });

    app.controller("ListUsersCtrl", function ($scope, idmUsers, $sce, $routeParams, $location) {
        $scope.model = {};

        function PagerButton(text, page, enabled, current) {
            this.text = $sce.trustAsHtml(text + "");
            this.page = page;
            this.enabled = enabled;
            this.current = current;
        }

        function Pager(result, pageSize, filter) {
            this.start = result.start;
            this.count = result.count;
            this.total = result.total;
            this.pageSize = pageSize;
            this.filter = filter;

            this.totalPages = Math.ceil(this.total / pageSize);
            this.currentPage = (this.start / pageSize) + 1;
            this.canPrev = this.currentPage > 1;
            this.canNext = this.currentPage < this.totalPages;

            this.buttons = [];

            var totalButtons = 7; // ensure this is odd
            var pageSkip = 10;
            var startButton = 1;
            if (this.currentPage > Math.floor(totalButtons/2)) startButton = this.currentPage - Math.floor(totalButtons/2);

            var endButton = startButton + totalButtons - 1;
            if (endButton >= this.totalPages) endButton = this.totalPages;
            if (this.totalPages > totalButtons &&
                (endButton - startButton + 1) < totalButtons) {
                startButton = endButton - totalButtons + 1;
            }

            var prevPage = this.currentPage - pageSkip;
            if (prevPage < 1) prevPage = 1;

            var nextPage = this.currentPage + pageSkip;
            if (nextPage > this.totalPages) nextPage = this.totalPages;

            this.buttons.push(new PagerButton("<strong>&lt;&lt;</strong>", 1, endButton > totalButtons));
            this.buttons.push(new PagerButton("<strong>&lt;</strong>", prevPage, endButton > totalButtons));

            for (var i = startButton; i <= endButton; i++) {
                this.buttons.push(new PagerButton(i, i, true, i === this.currentPage));
            }

            this.buttons.push(new PagerButton("<strong>&gt;</strong>", nextPage, endButton < this.totalPages));
            this.buttons.push(new PagerButton("<strong>&gt;&gt;</strong>", this.totalPages, endButton < this.totalPages));
        }

        $scope.search = function (filter) {
            var url = "/list";
            if (filter) {
                url += "/" + filter;
            }
            $location.url(url);
        };

        var filter = $routeParams.filter;
        $scope.model.message = null;
        $scope.model.filter = filter;
        $scope.model.users = null;
        $scope.model.pager = null;
        $scope.model.waiting = true;

        var itemsPerPage = 10;
        var page = $routeParams.page || 1;
        var startItem = (page - 1) * itemsPerPage;

        idmUsers.getUsers(filter, startItem, itemsPerPage).then(function (result) {
            $scope.model.waiting = false;
            $scope.model.users = result.users;
            if (result.users && result.users.length) {
                $scope.model.pager = new Pager(result, itemsPerPage, filter);
            }
        }, function (error) {
            $scope.model.message = error;
            $scope.model.waiting = false;
        });
    });

    app.controller("NewUserCtrl", function ($scope, idmUsers) {
        var feedback = new Feedback();
        $scope.feedback = feedback;

        $scope.model = {
        };

        $scope.create = function (username, password) {
            idmUsers.createUser(username, password)
                .then(function (result) {
                    $scope.model.last = result.subject;
                    feedback.message = "Create Success";
                }, feedback.errorHandler);
        };
    });

    app.controller("EditUserCtrl", function ($scope, idmUsers, $routeParams) {
        var feedback = new Feedback();
        $scope.feedback = feedback;

        $scope.model = {};

        function loadUser() {
            idmUsers.getUser($routeParams.subject)
                .then(function (result) {
                    $scope.model.user = result;
                }, feedback.errorHandler);
        };
        loadUser();

        $scope.setPassword = function (subject, password, confirm) {
            if (password === confirm) {
                idmUsers.setPassword(subject, password)
                    .then(function () {
                        feedback.message = "Password Changed";
                    }, feedback.errorHandler);
            }
            else {
                feedback.errors = "Password and Confirmation do not match";
            }
        };

        $scope.setEmail = function (subject, email) {
            idmUsers.setEmail(subject, email)
                .then(feedback.createMessageHandler("Email Changed"), feedback.errorHandler);
        };

        $scope.setPhone = function (subject, phone) {
            idmUsers.setPhone(subject, phone)
                .then(feedback.createMessageHandler("Phone Changed"), feedback.errorHandler);
        };

        $scope.addClaim = function (subject, type, value) {
            idmUsers.addClaim(subject, type, value)
                .then(function () {
                    feedback.message = "Claim Added";
                    loadUser();
                }, feedback.errorHandler);
        };

        $scope.removeClaim = function (subject, type, value) {
            idmUsers.removeClaim(subject, type, value)
                .then(function () {
                    feedback.message = "Claim Removed";
                    loadUser();
                }, feedback.errorHandler);
        };

        $scope.deleteUser = function (subject) {
            idmUsers.deleteUser(subject)
                .then(function () {
                    feedback.message = "User Deleted";
                    $scope.model.user = null;
                }, feedback.errorHandler);
        };
    });

})(angular);
