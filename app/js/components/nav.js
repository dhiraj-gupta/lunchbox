"use strict";

var fs = require('fs');

var remote = require('remote');
var app = remote.require('app');
var public_path = app.getAppPath() + '/app';

/**
 * Module for managing Bootbox dialogs.
 */
var nav = (function() {
  // private
  var container = '';

  /**
   * Updates the container with given data.
   * @param  {[type]}   data     [description]
   * @param  {Function} callback [description]
   * @return {[type]}            [description]
   */
  function updateContent (data, callback) {
    if (!container) {
      callback('No container set.');
      return;
    }

    container.html(data.toString('utf8'));
    callback();
  }

  // public
  return {
    /**
     * Sets the container which will recieve loaded file content.
     * @param {[type]} selector [description]
     */
    setContainer: function (selector) {
      var el = $(selector);
      if (el) {
        container = $(selector);

        return true;
      }

      return false;
    },

    /**
     * Binds to given element's click event and loads its file.
     * @param {[type]}   el       [description]
     * @param {Function} callback [description]
     */
    addNavItem: function (el, callback) {
      var self = this;
      el = $(el);

      el.off('click');

      el.click(function (e) {
        e.preventDefault();

        self.loadFile(el.attr('href'), callback);
      });
    },

    /**
     * Reads file and loads content into container.
     * @param  {[type]}   src      [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    loadFile: function (src, callback) {
      if (typeof callback != 'function') {
        callback = function () {};
      }

      fs.readFile(public_path + '/' + src, function (err, data) {
        if (err) {
          callback('Could not load ' + src);
          return;
        }

        updateContent(data, callback);
      });
    },

    /**
     * Forces file to reload by invalidating cache.
     * @param  {[type]} src [description]
     * @return {[type]}     [description]
     */
    reloadModule: function (src) {
      var src = '../' + src + '.js';
      // invalidate cache
      delete require.cache[require.resolve(src)];
      // load file
      require(src);
    }
  };
})();

module.exports = nav;