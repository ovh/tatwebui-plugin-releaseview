/*global angular,_,moment */

/**
 * @ngdoc controller
 * @name TatUi.controller:MessagesReleaseViewListCtrl
 * @requires TatUi.WebSocket            Websocket manager
 * @requires TatUi.TatEngineMessagesRsc Tat Engine Resource Messages
 * @requires TatUi.TatEngineMessageRsc  Tat Engine Resource Message
 * @requires TatUi.TatEngine            Global Tat Engine service
 *
 * @description List Messages controller
 */
angular.module('TatUi')
  .controller('MessagesReleaseViewListCtrl', function(
    $scope,
    $rootScope,
    $stateParams,
    Authentication,
    WebSocket,
    TatEngineMessagesRsc,
    TatEngineMessageRsc,
    TatEngineTopicsRsc,
    TatEngineUserRsc,
    TatEngine,
    Flash,
    $translate,
    $interval,
    $location,
    $localStorage,
    appConfiguration
  ) {
    'use strict';

    var self = this;
    this.topic = $stateParams.topic;

    self.tmpFilter = {};
    if (!$localStorage.messagesFilters) {
      $localStorage.messagesFilters = {};
    }
    if (!$localStorage.messagesFilters[this.topic]) {
      $localStorage.messagesFilters[this.topic] = {};
    }

    this.data = {
      messages: [],
      requestFrequency: 5000,
      count: 40,
      skip: 0,
      isTopicBookmarks: false,
      isTopicTasks: false,
      isTopicDeletableMsg: false,
      isTopicDeletableAllMsg: false,
      isTopicUpdatableMsg: false,
      isTopicUpdatableAllMsg: false,
      isTopicRw: true,
      isNoFilter: true,
      isSureWithNoFilter: true,
      displayOnCall: (this.topic.indexOf("OnCall") > 1),
      displayMore: true
    };

    this.filterPosition = {
      x: 380,
      y: 62,
      visible: false
    };

    this.filter = {

    };

    this.getCurrentDate = function() {
      return moment().format("YYYY/MM/DD-HH:MM");
    };

    this.currentDate = self.getCurrentDate();

    /**
     * @ngdoc function
     * @name loadMore
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Try to load more messages
     */
    this.loadMore = function() {
      if (!self.loading) {
        self.moreMessage();
      }
    };

    /**
     * @ngdoc function
     * @name createMessage
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Post a new message on the current topic
     * @param {string} msg Message to post
     */
    this.createMessage = function() {
      TatEngineMessageRsc.create({
        text: self.currentMessage,
        topic: self.topic
      }).$promise.then(function(data) {
        self.currentMessage = '';
        self.data.messages.unshift(data.message);
      }, function(err) {
        TatEngine.displayReturn(err);
      });
    };

    this.getBrightness = function(rgb) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(rgb);
      return result ?
        0.2126 * parseInt(result[1], 16) +
        0.7152 * parseInt(result[2], 16) +
        0.0722 * parseInt(result[3], 16) : 0;
    };

    /**
     * @ngdoc function
     * @name mergeMessages
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Merge messages in the current message list
     * @param {string} messages Message list to merge
     */
    this.mergeMessages = function(dest, source) {
      if (source && _.isArray(source)) {
        for (var i = 0; i < source.length; i++) {
          if (source[i].replies) {
            this.computeDetails(source[i]);
          }
          var origin = _.find(dest, {
            _id: source[i]._id
          });
          if (origin) {
            if (!origin.replies) {
              origin.replies = [];
            }
            self.mergeMessages(origin.replies, source[i].replies);
            origin.labels = source[i].labels;
            origin.tags = source[i].tags;
          } else {
            if (!self.data.intervalTimeStamp) {
              self.data.intervalTimeStamp = source[i].dateUpdate;
            } else if (source[i].dateUpdate > self.data.intervalTimeStamp) {
              self.data.intervalTimeStamp = source[i].dateUpdate;
            }
            dest.push(source[i]);
            dest.sort(function(a, b) {
              if (a.dateCreation > b.dateCreation) {
                return -1;
              }
              if (a.dateCreation < b.dateCreation) {
                return 1;
              }
              return 0;
            });
          }
        }
      }
      return dest;
    };

    /**
     * @ngdoc function
     * @name beginTimer
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Launch the timer to request messages at regular time interval
     * @param {Integer} timeInterval Milliseconds between calls
     */
    this.beginTimer = function(timeInterval) {
      if ('undefined' === typeof self.data.timer) {
        self.data.timer = $interval(self.getNewMessages, timeInterval);
        $scope.$on(
          "$destroy",
          function() {
            self.stopTimer();
          }
        );
      }
    };

    /**
     * @ngdoc function
     * @name stopTimer
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Stop the time that request messages at regular time interval
     */
    this.stopTimer = function() {
      $interval.cancel(self.data.timer);
      self.data.timer = undefined;
    };

    /**
     * @ngdoc function
     * @name buildFilter
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Build a filter to read messages
     * @param {object} data Custom data to send to the API
     * @return {object} Parameters to pass to the API
     */
    this.buildFilter = function(data) {
      return angular.extend({}, data, self.filter);
    };

    /**
     * @ngdoc function
     * @name filterSearch
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Filter messages
     */
    this.filterSearch = function() {
      self.data.skip = 0;
      self.data.displayMore = true;
      self.filter.text =
        self.tmpFilter.filterText ? self.tmpFilter.filterText : null;
      self.filter.label =
        self.tmpFilter.filterInLabel ? self.tmpFilter.filterInLabel : null;
      self.filter.andLabel =
        self.tmpFilter.filterAndLabel ? self.tmpFilter.filterAndLabel :
        null;
      self.filter.tag =
        self.tmpFilter.filterInTag ? self.tmpFilter.filterInTag : null;
      self.filter.andTag =
        self.tmpFilter.filterAndTag ? self.tmpFilter.filterAndTag : null;

      if (self.tmpFilter.idMessage === "-1") {
        $rootScope.$broadcast('topic-change', {
          topic: self.topic,
          reload: true
        });
      } else {
        self.filter.idMessage = $stateParams.idMessage;
      }

      self.setFilter('filterInLabel');
      self.setFilter('filterAndLabel');
      self.setFilter('filterInTag');
      self.setFilter('filterAndTag');

      if (self.data.isSureWithNoFilter || !self.data.isNoFilter) {
        this.refresh();
      }
    };

    this.setFilter = function(key) {
      if (self.tmpFilter[key] === "" || self.tmpFilter[key] === undefined) {
        $location.search(key, null);
      } else {
        self.data.isNoFilter = false;
        $location.search(key, self.tmpFilter[key]);
      }
      $localStorage.messagesFilters[self.topic][key] = self.tmpFilter[key];
    };

    this.onCall = function(text) {
      self.currentMessage = text;
    };

    /**
     * @ngdoc function
     * @name getNewMessages
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Request for new messages
     */
    this.getNewMessages = function() {
      if (self.data.isSureWithNoFilter || !self.data.isNoFilter) {
        self.loading = true;
        self.currentDate = self.getCurrentDate();
        var filter = self.buildFilter({
          topic: self.topic,
          treeView: 'onetree',
          dateMinUpdate: self.data.intervalTimeStamp
        });
        return TatEngineMessagesRsc.list(filter).$promise.then(function(
          data) {
          self.digestInformations(data);
        }, function(err) {
          TatEngine.displayReturn(err);
          self.loading = false;
        });
      }
    };

    /**
     * @ngdoc function
     * @name moreMessage
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Request more messages
     * @return {object} Promise
     */
    this.moreMessage = function() {
      self.loading = true;
      var filter = self.buildFilter({
        topic: self.topic,
        treeView: 'onetree',
        limit: self.data.count,
        skip: self.data.skip
      });
      return TatEngineMessagesRsc.list(filter).$promise.then(function(data) {
        if (!data.messages) {
          self.data.displayMore = false;
        } else {
          self.data.skip = self.data.skip + self.data.count;
          self.digestInformations(data);
        }
      }, function(err) {
        TatEngine.displayReturn(err);
        self.loading = false;
      });
    };

    /**
     * @ngdoc function
     * @name digestInformations
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description
     * @return
     */
    this.digestInformations = function(data) {
      self.data.isTopicRw = data.isTopicRw;
      if (_.contains(Authentication.getIdentity().favoritesTopics, '/' +
          self.topic)) {
        self.data.isFavoriteTopic = true;
      }
      self.data.messages = self.mergeMessages(self.data.messages, data.messages);
      self.loading = false;
    };

    /**
     * @ngdoc function
     * @name initFiltersFromParam
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description
     */
    this.initFiltersFromParam = function() {
      self.initFilterField("filterInLabel");
      self.initFilterField("filterAndLabel");
      self.initFilterField("filterInTag");
      self.initFilterField("filterAndTag");
    };

    /**
     * @ngdoc function
     * @name initFilterField
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description
     */
    this.initFilterField = function(key) {
      if ($stateParams[key]) {
        self.tmpFilter[key] = $stateParams[key];
      } else if ($localStorage.messagesFilters[self.topic][key]) {
        self.tmpFilter[key] = $localStorage.messagesFilters[self.topic][key];
      }
    };

    /**
     * @ngdoc function
     * @name init
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Initialize list messages page. Get list of messages from Tat Engine
     */
    this.init = function() {
      $rootScope.$broadcast('menu-expand', self.topic.split('/'));

      self.initFiltersFromParam();
      self.filterSearch();

      if (self.data.isSureWithNoFilter || !self.data.isNoFilter) {
        TatEngineTopicsRsc.list({
          topic: self.topic
        }).$promise.then(function(data) {
          if ((!data.topics) || (!data.topics.length)) {
            Flash.create('danger', $translate.instant('topics_notopic'));
            return;
          }
          self.data.topic = data.topics[0];
          self.data.isTopicUpdatableMsg = self.data.topic.canUpdateMsg;
          self.data.isTopicDeletableMsg = self.data.topic.canDeleteMsg;
          self.data.isTopicUpdatableAllMsg = self.data.topic.canUpdateAllMsg;
          self.data.isTopicDeletableAllMsg = self.data.topic.canDeleteAllMsg;
          if (self.data.topic.topic.indexOf("/Private/" +
              Authentication.getIdentity().username + "/Bookmarks") ===
            0) {
            self.data.isTopicBookmarks = true;
          } else if (self.data.topic.topic.indexOf("/Private/" +
              Authentication.getIdentity().username + "/Tasks") === 0) {
            self.data.isTopicTasks = true;
            self.data.isTopicDeletableMsg = true;
          } else if (self.data.topic.topic.indexOf("/Private/" +
              Authentication.getIdentity().username + "/DM/") === 0) {
            self.data.isTopicDeletableMsg = false;
          } else if (self.data.topic.topic.indexOf("/Private/" +
              Authentication.getIdentity().username) === 0) {
            self.data.isTopicDeletableMsg = true;
          }
          self.beginTimer(self.data.requestFrequency);
        }, function(err) {
          TatEngine.displayReturn(err);
        });
      }
    };


    /**
     * @ngdoc function
     * @name refresh
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Refresh all the messages
     */
    this.refresh = function() {
      $rootScope.$broadcast('loading', true);
      self.data.currentTimestamp = Math.ceil(new Date().getTime() / 1000);
      self.data.messages = [];
      self.moreMessage().then(function() {
        $rootScope.$broadcast('loading', false);
      });
    };

    this.setMessage = function(message) {
      message.displayed = true;
      $scope.message = message;
    };

    this.toggleMessage = function(message) {
      var same = false;
      if ($scope.message && $scope.message._id == message._id) {
        same = true;
      }
      if ($scope.message && $scope.message.displayed) {
        self.closeMessage($scope.message);
        setTimeout(function() {
          $scope.$apply(function() {
            if (!same) {
              self.setMessage(message);
            }
          });
        }, 100);
      } else {
        self.setMessage(message);
      }
    };

    this.closeMessage = function(message) {
      $scope.message.displayed = false;
      $scope.message = null;
    };

    this.computeRelease = function(message) {
      message.release = "";
      message.releaseDate = null;
      message.attrs = [];
      if (message && message.tags) {
        for (var i = 0; i < message.tags.length; i++) {
          if (message.tags[i].indexOf("release:") == 0) {
            message.release = message.tags[i].substring(8);
          }
          if (message.tags[i].indexOf("attr:") == 0) {
            message.attrs.push(message.tags[i].substring(5));
          }
          if (message.tags[i].indexOf("date:") == 0) {
            message.releaseDate = message.tags[i].substring(5);
          }
        }
      }
      // not a release msg, do not display it
      if (message.release === "") {
        message.hide = true;
      }
    };

    this.capitalizeFirstLetter = function(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }

    this.computeDetails = function(message) {
      var sections = {};
      var keyword = appConfiguration.releaseview.keyword;
      for (var i = 0; i < message.replies.length; i++) {
        if (message.replies[i].text.indexOf("#") == 0 && message.replies) {
          var mtype = message.replies[i].text
            .substring(0, message.replies[i].text.indexOf(" "));
          var mtype = this.capitalizeFirstLetter(mtype.replace("#", ""));
          // delete last ':'
          if (mtype.indexOf(":") == mtype.length - 1) {
            mtype = mtype.slice(0, -1);
          }
          var text = message.replies[i].text
            .substring(message.replies[i].text.indexOf(" "));
          // msg starting with a tags, store it
          if (!sections[mtype]) {
            sections[mtype] = [];
          }

          text = text.replace("#" + keyword + ":",
            appConfiguration.releaseview.tracker);

          sections[mtype].push(text);
        }
      }
      if (message.labels) {
        message.releaseColor = message.labels[0].color;
      } else {
        message.releaseColor = "transparent";
      }

      message.sections = sections;
    };

    this.getTitleExceptRelease = function(message)  {
      this.computeRelease(message);
      return message.text.replace(/#release:[\w\d\-@\.\/]*/g, "")
        .replace(/#attr:[\w\d\-@\.\/]*/g, "")
        .replace(/#date:[\w\d\-@\.\/]*/g, "");
    }

    this.containsLabel = function(message, labelText) {
      if (message.inReplyOfIDRoot) {
        return false;
      }
      var r = false;
      if (message.labels) {
        for (var i = 0; i < message.labels.length; i++) {
          var l = message.labels[i];
          if (l.text === labelText) {
            return true;
          }
        }
      }
      return r;
    };

    this.init();
  });
