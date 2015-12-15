/*global angular*/
angular.module('TatUi').config(function($stateProvider, PluginProvider) {
  'use strict';

  PluginProvider.addPlugin({
    'name': 'Release View',
    'route': 'releaseview-list',
    'type': 'messages-views',
    'default': false
  });

  $stateProvider.state('releaseview-list', {
    url: '/releaseview/list/{topic:topicRoute}?idMessage&filterInLabel&filterAndLabel&filterNotLabel&filterInTag&filterAndTag&filterNotTag',
    templateUrl: '../build/tatwebui-plugin-releaseview/releaseview/list/releaseview-list.view.html',
    controller: 'MessagesReleaseViewListCtrl',
    controllerAs: 'ctrl',
    reloadOnSearch: false,
    translations: [
      'plugins/tatwebui-plugin-releaseview/releaseview'
    ]
  });
});
