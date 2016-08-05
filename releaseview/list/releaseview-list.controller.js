/*global angular,_,moment */

/**
 * @ngdoc controller
 * @name TatUi.controller:MessagesReleaseViewListCtrl
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
    $translate,
    $interval,
    Authentication,
    appConfiguration,
    Flash,
    TatEngineMessagesRsc,
    TatEngineMessageRsc,
    TatEngineTopicRsc,
    TatEngine,
    TatFilter,
    TatTopic
  ) {
    'use strict';

    var self = this;
    self.filter = TatFilter.getCurrent();
    self.topic = $stateParams.topic;

    self.data = {
      messages: [],
      requestFrequency: 5000,
      count: 40,
      skip: 0,
      isTopicDeletableMsg: false,
      isTopicDeletableAllMsg: false,
      isTopicUpdatableMsg: false,
      isTopicUpdatableAllMsg: false,
      isTopicRw: true,
      displayMore: true
    };

    $scope.$on('filter-changed', function(ev, filter){
      self.data.skip = 0;
      self.data.displayMore = true;
      self.filter = angular.extend(self.filter, filter);
      self.refresh();
    });

    self.getCurrentDate = function() {
      return moment().format('YYYY/MM/DD-HH:MM');
    };

    self.currentDate = self.getCurrentDate();

    /**
     * @ngdoc function
     * @name loadMore
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Try to load more messages
     */
    self.loadMore = function() {
      if (!self.loading) {
        self.moreMessage();
      }
    };

    self.getBrightness = function(rgb) {
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
             if (origin.replies) {
               this.computeDetails(origin);
             }
           } else {
             if (!self.data.intervalTimeStamp) {
               self.data.intervalTimeStamp = source[i].dateUpdate;
             } else if (source[i].dateUpdate > self.data.intervalTimeStamp) {
               self.data.intervalTimeStamp = source[i].dateUpdate;
             }
             if (source[i].replies) {
               this.computeDetails(source[i]);
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
     */
    self.beginTimer = function() {
      self.data = angular.extend(self.data, TatTopic.getDataTopic());
      var timeInterval = self.data.requestFrequency;
      if ('undefined' === typeof self.data.timer) {
        self.getNewMessages(); // Don't wait to execute first call
        self.data.timer = $interval(self.getNewMessages, timeInterval);
        $scope.$on("$destroy", function() { self.stopTimer(); });
      }
    };

    /**
     * @ngdoc function
     * @name stopTimer
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Stop the time that request messages at regular time interval
     */
    self.stopTimer = function() {
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
    self.buildFilter = function(data) {
      return angular.extend({}, data, self.filter);
    }

    /**
     * @ngdoc function
     * @name getNewMessages
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Request for new messages
     */
    self.getNewMessages = function() {
      if (self.loading) {
        console.log("messages list already in refresh...");
        return;
      }
      self.loading = true;
      self.currentDate = self.getCurrentDate();
      var filterAttrs = {
        topic: self.topic,
        treeView: 'onetree',
        onlyMsgRoot: 'true'
      };
      if (!TatFilter.containsDateFilter) {
        filterAttrs.dateMinUpdate = self.data.intervalTimeStamp;
      }
      var filter = self.buildFilter(filterAttrs);
      return TatEngineMessagesRsc.list(filter).$promise.then(function(data) {
        self.digestInformations(data);
      }, function(err) {
        TatEngine.displayReturn(err);
        self.loading = false;
      });
    };

    /**
     * @ngdoc function
     * @name moreMessage
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Request more messages
     * @return {object} Promise
     */
    self.moreMessage = function() {
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
    self.digestInformations = function(data) {
      self.data.isTopicRw = data.isTopicRw;
      if (_.includes(Authentication.getIdentity().favoritesTopics, '/' + self.topic)) {
        self.data.isFavoriteTopic = true;
      }
      self.data.messages = self.mergeMessages(self.data.messages, data.messages);
      self.loading = false;
    };

    /**
     * @ngdoc function
     * @name init
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Initialize list messages page. Get list of messages from Tat Engine
     */
    self.init = function() {
      TatTopic.computeTopic(self.topic, self.beginTimer);
    };

    /**
     * @ngdoc function
     * @name refresh
     * @methodOf TatUi.controller:MessagesReleaseViewListCtrl
     * @description Refresh all the messages
     */
    self.refresh = function() {
      self.data.currentTimestamp = Math.ceil(new Date().getTime() / 1000);
      self.data.messages = [];
      self.moreMessage();
    };

    self.setMessage = function(message) {
      message.displayed = true;
      $scope.message = message;
    };

    self.toggleMessage = function(message) {
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

    self.closeMessage = function(message) {
      $scope.message.displayed = false;
      $scope.message = null;
    };

    self.containsLabel = function(message, labelText) {
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
      var keyword = "";
      if (appConfiguration.releaseview) {
        keyword = appConfiguration.releaseview.keyword;
      }
      var replies = _.sortBy(message.replies, function(s) { return s.text; });
      for (var i = 0; i < replies.length; i++) {
        if (replies[i].text.indexOf("#") == 0 && replies) {
          var mtype = replies[i].text.substring(0, replies[i].text.indexOf(" "));
          var mtype = this.capitalizeFirstLetter(mtype.replace("#", ""));
          // delete last ':'
          if (mtype.indexOf(":") == mtype.length - 1) {
            mtype = mtype.slice(0, -1);
          }
          var text = replies[i].text.substring(replies[i].text.indexOf(" "));
          // msg starting with a tags, store it
          if (!sections[mtype]) {
            sections[mtype] = [];
          }

          if (appConfiguration.releaseview) {
            var regex = new RegExp("#" + keyword + ":", 'g');
            text = text.replace(regex, appConfiguration.releaseview.tracker);
          }
          sections[mtype].push(text);
          sections[mtype] = _.sortBy(sections[mtype], function(s) { return s.text; });
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

    self.init();
  });
