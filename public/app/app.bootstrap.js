/**
 * Copyright ©2017. The Regents of the University of California (Regents). All Rights Reserved.
 *
 * Permission to use, copy, modify, and distribute this software and its documentation
 * for educational, research, and not-for-profit purposes, without fee and without a
 * signed licensing agreement, is hereby granted, provided that the above copyright
 * notice, this paragraph and the following two paragraphs appear in all copies,
 * modifications, and distributions.
 *
 * Contact The Office of Technology Licensing, UC Berkeley, 2150 Shattuck Avenue,
 * Suite 510, Berkeley, CA 94720-1620, (510) 643-7201, otl@berkeley.edu,
 * http://ipira.berkeley.edu/industry-info for commercial licensing opportunities.
 *
 * IN NO EVENT SHALL REGENTS BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL,
 * INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF
 * THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF REGENTS HAS BEEN ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * REGENTS SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE
 * SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED
 * "AS IS". REGENTS HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES,
 * ENHANCEMENTS, OR MODIFICATIONS.
 */

(function(angular) {

  var collabosphere = angular.module('collabosphere', [
    'ngAria',
    'ngCookies',
    'ng.deviceDetector',
    'ngFileUpload',
    'ngMessages',
    'ngMoment',
    'ngSanitize',
    'analytics.mixpanel',
    'common.fabric',
    'common.fabric.utilities',
    'common.fabric.constants',
    'luegg.directives',
    'mgcrea.ngStrap',
    'monospaced.elastic',
    'oi.select',
    'ui.router',

    // This module gets generated by the production build. It will expose all of the HTML partials
    // through the `templateCache`. This allows us to cache and revision HTML partials in production
    'collabosphere.templates'
  ]);

  /**
   * Extract parameter value from URI using regex pattern
   *
   * @param  {String}       uri           Query string of current URL
   * @param  {Object}       pattern       Regex for identifying parameter value
   * @return {String}                     Value of query arg or null
   */
  var getParameter = function(uri, pattern) {
    var match = uri.match(pattern);
    return (match && match.length > 0) ? decodeURIComponent(match[1]) : null;
  };

  /**
   * Get the parsed querystring parameters from the current URL
   *
   * @return {Object}                     The parsed querystring parameters from the current URL
   * @see https://css-tricks.com/snippets/jquery/get-query-params-object/
   */
  var getParameters = function() {
    var uri = decodeURIComponent(document.location.search).replace(/(^\?)/, '');
    var params = uri.split('&').map(function(n) {
      return n = n.split('='), this[n[0]] = n[1], this;
    }.bind({}))[0];

    // Bundle info on referring tool if required param is present
    var referringTool = getParameter(uri, /.*[\?&]_referring_tool=([a-z]+).*/);

    if (referringTool) {
      params.crossToolRequest = {
        id: getParameter(uri, /.*[\?&]_id=([%0-9a-zA-Z\-\.]+).*/),
        state: getParameter(uri, /.*[\?&]_state=([0-9a-zA-Z\-]+).*/),
        referringTool: referringTool,
        referringId: getParameter(uri, /.*[\?&]_referring_id=([0-9a-zA-Z]+).*/),
        referringState: getParameter(uri, /.*[\?&]_referring_state=([0-9a-zA-Z\-]+).*/)
      };
    }

    return params;
  };

  /**
   * Get and cache the config feed and me data before bootstrapping
   * the Collabosphere angular app to remove the need for asynchronous
   * operations during the configuration phase
   *
   * @return {Promise}                      $q promise
   */
  var initData = function() {
    var initInjector = angular.injector([ 'ng' ]);
    var $http = initInjector.get('$http');
    var $q = initInjector.get('$q');

    // Construct the base REST API URL
    var params = getParameters();
    var baseUrl = '/api/' + params.api_domain + '/' + params.course_id;

    return $q.all({
      'me': $http.get(baseUrl + '/users/me'),
      'config': $http.get(baseUrl + '/config')
    }).then(function(results) {
      collabosphere.constant('me', results.me.data);
      collabosphere.constant('config', results.config.data);
      collabosphere.constant('apiError', null);
      collabosphere.constant('crossToolRequest', params.crossToolRequest || null);

    }, function(error) {
      // Store the error to be handled after bootstrapping.
      collabosphere.constant('apiError', error);

      collabosphere.constant('me', null);
      collabosphere.constant('config', null);
      collabosphere.constant('crossToolRequest', null);
    });
  };

  /**
   * @return {Object}                       Function executed when DOM is done loading
   */
  var bootstrap = function() {
    angular.element(document).ready(function() {
      angular.bootstrap(document, [ 'collabosphere' ]);
    });
  };

  initData().then(bootstrap);

}(window.angular));
