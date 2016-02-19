/*global angular */

/**
 * @ngdoc directive
 * @name TatUi.directive:messagesItem
 * @restrict AE
 * @description
 * display a route message
 */
angular.module('TatUi').directive('messagesReleaseviewItem', function($compile) {
  'use strict';

  return {
    restrict: 'E',
    scope: {
      message: '=',
      topic: '=',
      isTopicDeletableMsg: "=",
      isTopicUpdatableMsg: "=",
      isTopicDeletableAllMsg: "=",
      isTopicUpdatableAllMsg: "=",
      isTopicRw: "="
    },
    replace: true,
    templateUrl: '../build/tatwebui-plugin-releaseview/releaseview/list/releaseview-item.directive.html',
    controllerAs: 'ctrl',
    /**
     * @ngdoc controller
     * @name TatUi.controller:messagesItem
     * @requires TatUi.Authentication       Tat Authentication
     * @requires TatUi.TatEngineMessageRsc  Tat Engine Resource Message
     * @requires TatUi.TatEngine            Global Tat Engine service
     *
     * @description Directive controller
     */
    controller: function($scope, $rootScope, TatEngineMessageRsc,
      TatEngineMessagesRsc, TatEngine, TatMessage, Authentication) {
      var self = this;

      this.getBrightness = function(rgb) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(rgb);
        return result ?
          0.2126 * parseInt(result[1], 16) +
          0.7152 * parseInt(result[2], 16) +
          0.0722 * parseInt(result[3], 16) : 0;
      };

      this.setTo = function(message, label) {
        var choices = {};
        choices["done"] = "#14892c";
        choices["preprod"] = "#ec971f";
        choices["staging"] = "#3d85c6";
        choices["develop"] = "#cccccc";

        if (self.containsLabel(message, label)) {
          return;
        }
        for (var l in choices) {
          if (l != label) {
            self.removeLabel(message, l);
          }
        };
        TatMessage.addLabel(message, $scope.topic.topic, label, choices[label]);
      };

      /**
       * @ngdoc function
       * @name deleteMessage
       * @methodOf TatUi.controller:messagesItem
       * @description delete a message from a Private topic
       */
      this.deleteMessage = function(message) {
        TatEngineMessagesRsc.delete({
          'idMessageToDelete': message._id,
          'cascade': 'cascade/'
        }).$promise.then(function(resp) {
          TatEngine.displayReturn(resp);
          message.hide = true;
          message.displayed = false;
        }, function(response) {
          TatEngine.displayReturn(response);
        });
      };

      /**
       * @ngdoc function
       * @name updateMessage
       * @methodOf TatUi.controller:messagesItem
       * @description Update a message
       */
      this.updateMessage = function(message) {
        message.updating = false;
        TatEngineMessageRsc.update({
          'topic': $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
          'idReference': message._id,
          'text': message.text,
          'action': 'update',
        }).$promise.then(function(resp) {
          message.text = resp.message.text;
        }, function(resp) {
          message.updating = true;
          TatEngine.displayReturn(resp);
        });
      };

      /**
       * @ngdoc function
       * @name removeLabel
       * @methodOf TatUi.controller:messagesItem
       * @description remove a label
       * @param {object} message Message on which to add a label
       * @param {object} label   Label {text} to remove
       */
      this.removeLabel = function(message, labelText) {
        if (!message.labels) {
          return;
        }
        if (!self.containsLabel(message, labelText)) {
          return;
        }
        var toRefresh = false;
        var newList = [];
        for (var i = 0; i < message.labels.length; i++) {
          var l = message.labels[i];
          if (l.text === labelText ||  (labelText === 'doing' && l.text
              .indexOf('doing:') === 0)) {
            toRefresh = true;
            TatEngineMessageRsc.update({
              'action': 'unlabel',
              'topic': $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
              'idReference': $scope.message._id,
              'text': l.text
            }).$promise.then(function(resp) {
              //nothing here
            }, function(resp) {
              TatEngine.displayReturn(resp);
            });
          } else {
            newList.push(l);
          }
        }

        if (toRefresh)  {
          message.labels = newList;
        }
      };

      this.urlMessage = function(message) {
        $rootScope.$broadcast('topic-change', {
          topic: $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
          idMessage: message._id,
          reload: true
        });
      };

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

    }
  };
});
