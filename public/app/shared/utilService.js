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

  'use strict';

  angular.module('collabosphere').service('utilService', function(analyticsService, $cookies, $location, $q, $timeout) {

    // Cache the API domain and Course ID that were passed in through
    // the iFrame launch URL. These variables need to be used to construct
    // the base URL for all REST API requests
    var apiDomain = $location.search().api_domain;
    var courseId = $location.search().course_id;
    var toolUrl = $location.search().tool_url;

    /**
     * Get the parameters that were passed in through the iFrame launch URL
     *
     * @return {Object}                       The parameters that were passed in through the iFrame launch URL
     */
    var getLaunchParams = function() {
      var launchParams = {
        'apiDomain': apiDomain,
        'courseId': courseId,
        'toolUrl': toolUrl
      };
      return launchParams;
    };

    /**
     * Check cookie set on launch to see whether custom cross-window messaging is supported in this Canvas instance.
     *
     * @return {Boolean}                      Whether custom cross-window messaging is supported
     */
    var checkCustomMessagingSupport = function() {
      var customMessagingCookieName = apiDomain + '_supports_custom_messaging';
      return ($cookies.get(customMessagingCookieName) === 'true');
    };
    var isCustomMessagingSupported = checkCustomMessagingSupport();

    // If custom messaging is supported, hide the vertical toolbar when the tool is embedded in an iframe. At that
    // point, the scrolling script injected in the parent window will ensure that the iframe is always as high
    // as its content.
    // TODO: Whiteboards are currently excluded from this rule as there is an element below the whiteboard
    // that takes up space. This should be fixed and whiteboards should follow this rule
    if (isCustomMessagingSupported && (top != self || $location.path().indexOf('/whiteboards/') !== -1)) {
      document.documentElement.classList.add('embedded');
    }

    /**
     * Construct the full URL for a REST API request. All REST API requests should
     * be of the form `/api/<apiDomain>/<courseId>/<restAPI>`
     *
     * @param  {String}       url             The REST API for which the full REST API URL should be constructed
     * @return {String}                       The full REST API URL of the form `/api/<apiDomain>/<courseId>/<restAPI>`
     */
    var getApiUrl = function(url) {
      return '/api/' + apiDomain + '/' + courseId + url;
    };

    /**
     * Get the external tool URL for the current LTI tool placement
     */
    var getToolUrl = function() {
      return toolUrl;
    };

    /**
     * Adjust the height of the current iFrame to the size of its content.
     * This will only happen when Collabosphere is embedded as an LTI tool in
     * a different application
     */
    var resizeIFrame = function() {
      postIFrameMessage(function() {
        var height = document.body.offsetHeight;
        // If the Canvas instance supports custom cross-window messaging, send our custom 'changeParent' event; otherwise use
        // the standard Canvas event.
        var subject = isCustomMessagingSupported ? 'changeParent' : 'lti.frameResize';
        return {
          'subject': subject,
          'height': height
        };
      });
    };

    // Continuously check if there have been any changes to the content of the page
    // and resize accordingly
    setInterval(resizeIFrame, 250);

    /**
     * Scroll to the top of the window. When Collabosphere is being run stand-alone,
     * it will scroll the current window to the top. When Collabosphere is being run
     * as a BasicLTI tool, it will scroll the parent window to the top
     */
    var scrollToTop = function() {
      // Always scroll the current window to the top
      window.scrollTo(0, 0);
      // When running Collabosphere as a BasicLTI tool, also scroll the parent window to the top.
      if (window.parent) {
        // Use our custom 'changeParent' cross-window event, if the hosting Canvas instance supports it.
        if (isCustomMessagingSupported) {
          postIFrameMessage(function() {
            return {
              'subject': 'changeParent',
              'scrollToTop': true
            };
          });
        // Otherwise, use the standard Canvas event.
        } else {
          postIFrameMessage(function() {
            return {
              'subject': 'lti.scrollToTop'
            };
          });
        }
      }
    };

    /**
     * Scroll the window to a specified position. When Collabosphere is being run stand-alone,
     * it will scroll the current window to the specified position. When Collabosphere is being run
     * as a BasicLTI tool, it will scroll the parent window to the specified position
     *
     * @param  {Number}           position            The vertical scroll position to scroll to
     */
    var scrollTo = function(position) {
      // When running Collabosphere as a BasicLTI tool, scroll the parent window via our custom 'changeParent'
      // event, if the hosting Canvas instance supports it.
      if (window.parent && isCustomMessagingSupported) {
        postIFrameMessage(function() {
          return {
            'subject': 'changeParent',
            'scrollTo': position
          };
        });
      }
      // Otherwise, scroll the current window.
      if (!window.parent) {
        window.scrollTo(0, position);
      }
    };

    /**
     * Get the current scroll information. When Collabosphere is being run stand-alone,
     * it will return the scroll position of the current window. When Collabosphere is being run
     * as a BasicLTI tool, it will return the scroll information of the parent window
     *
     * @return {Promise<Object>}                      Promise returning the current scroll information
     */
    var getScrollInformation = function() {
      var deferred = $q.defer();
      // When running Collabosphere as a BasicLTI tool, request the scroll position of the parent window via cross-window
      // messaging, if the hosting Canvas instance supports it.
      if (window.parent && isCustomMessagingSupported) {
        postIFrameMessage(function() {
          return {
            'subject': 'getScrollInformation'
          };
        }, function(response) {
          deferred.resolve(response);
        });
      // Otherwise, retrieve the scroll information of the current window
      } else {
        var scrollPosition = (window.pageYOffset || document.documentElement.scrollTop) - (document.documentElement.clientTop || 0);
        var scrollToBottom =  document.body.offsetHeight - scrollPosition - document.documentElement.clientHeight;
        deferred.resolve({
          'scrollPosition': scrollPosition,
          'scrollToBottom': scrollToBottom
        });
      }
      return deferred.promise;
    };

    /**
     * Get the Collabosphere related data from the parent URL. This function assumes that
     * Collabosphere data in the query string or hash is prefixed with `col_`.
     *
     * For example:
     *
     *   Given the parent URL:
     *     http://bcourses.berkeley.edu/courses/1123123/external_tools/421312?col_user=1#col_category=2
     *
     *   The following data would be passed into the callback function:
     *     ```
     *     {
     *       "user": 1,
     *       "category": "2"
     *
     *     }
     *     ```
     *
     * @param  {Function}   callback          Standard callback function
     * @param  {Object}     callback.data     The Collabosphere data that's present in the parent's URL
     */
    var getParentUrlData = function(callback) {
      // This functionality requires our custom 'getParent' cross-window event to be supported in the hosting Canvas instance.
      if (!isCustomMessagingSupported) {
        return callback({});
      }

      postIFrameMessage(function() {
        return {
          'subject': 'getParent'
        };
      }, function(data) {
        if (!data || !data.location) {
          return callback({});
        }

        // Parse the URL
        var url = purl(data.location);
        var urlData = _.extend(url.param(), url.fparam());

        // Filter out all non-`col_` values
        var filteredUrlData = {};
        _.each(urlData, function(value, key) {
          if (key.indexOf('col_') === 0) {
            filteredUrlData[key.substring(4)] = value;
          }
        });
        return callback(filteredUrlData);

      });
    };

    /**
     * Set the parent's container hash value
     *
     * @param  {Object}  data    The data for the parent's hash container. Each key will be prefixed with `col_`. For example, `{'user': 1, 'category': 42}` would be serialized to `col_user=1&col_category=42`
     */
    var setParentHash = function(data) {
      // This functionality requires our custom 'setParentHash' cross-window event to be supported in the hosting Canvas instance.
      if (!isCustomMessagingSupported) {
        return;
      }

      if (window.parent) {
        var hash = [];
        _.each(data, function(val, key) {
          if (val) {
            hash.push('col_' + key + '=' + encodeURIComponent(val));
          }
        });
        hash = hash.join('&');
        postIFrameMessage(function() {
          return {
            'subject': 'setParentHash',
            'hash': hash
          };
        });
      }
    };

    /**
     * Utility function used to send a window event to the parent container. When running
     * Collabosphere as a BasicLTI tool, this is our main way of communicating with the container
     * application
     *
     * @param  {Function}   messageGenerator                          Function that will return the message to send to the parent container
     * @param  {Function}   [messageCallback]                         Function that will be called when a response from the parent container has been received
     * @param  {Number}     [messageCallback.currentIframeHeight]     The height of the LTI iFrame
     * @param  {Number}     [messageCallback.currentParentHeight]     The full height of the parent container
     * @param  {Number}     [messageCallback.currentScrollPosition]   The scroll position within the parent container
     * @param  {Number}     [messageCallback.scrollToBottom]          The distance between the bottom of the browser and the bottom of the page
     * @api private
     */
    var postIFrameMessage = function(messageGenerator, messageCallback) {
      // Only try to send the event when a parent container is present
      if (window.parent) {
        // Wait until Angular has finished rendering items on the screen
        $timeout(function() {
          // The parent container will respond with a message into the current window containing
          // the scroll information of the parent window
          if (messageCallback) {
            var callback = function(ev) {
              if (ev && ev.data) {
                var message;
                try {
                  message = JSON.parse(ev.data);
                } catch (err) {
                  // The message is not for us; ignore it
                  return;
                }

                messageCallback(message);
                window.removeEventListener('message', callback);
              }
            };
            window.addEventListener('message', callback);
          }

          // Retrieve the message to send to the parent container. Note that we can't pass the
          // message directly into this function, as we sometimes need to wait until Angular has
          // finished rendering before we can determine what message to send
          var message = messageGenerator();

          // Send the message to the parent container as a stringified object
          window.parent.postMessage(JSON.stringify(message), '*');
        });
      }
    };

    return {
      'getApiUrl': getApiUrl,
      'getLaunchParams': getLaunchParams,
      'getParentUrlData': getParentUrlData,
      'getScrollInformation': getScrollInformation,
      'getToolUrl': getToolUrl,
      'resizeIFrame': resizeIFrame,
      'scrollTo': scrollTo,
      'scrollToTop': scrollToTop,
      'setParentHash': setParentHash
    };

  });

}(window.angular));
