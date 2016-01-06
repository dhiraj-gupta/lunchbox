'use strict';

var qc = require('../qchain');
var fs = require('fs');
var os = require('os');

/**
 * Storage API.
 */
module.exports = (function () {
  var remote = require('remote');
  var app = remote.require('app');

  var filepath = app.getPath('userData') + '/settings.json';

  var data = {};

  var init = qc.defer();
  var load = qc.defer();

  fs.open(filepath, 'a', '0666', function (error, fd) {
    if (error == null) {
      init.resolve();

      return;
    }

    init.reject('Could not open/create settings.json file.');
  });

  init.promise.then(function () {
    fs.readFile(filepath, 'utf-8', function (error, contents) {
      if (!error) {
        if (contents == '') {
          contents = '{}';
        }

        try {
          data = JSON.parse(contents);
          load.resolve();
        }
        catch (exception) {
          load.reject('Could not parse settings.json. Exception: ' + exception);
        }
      }
    });
  });

  /**
   * Saves entire data structure to file.
   * 
   * @param  {Function} callback [description]
   * @return {[type]}            [description]
   */
  function save(callback) {
    var callback = callback || function () {};
  }

  return {
    /**
     * Returns a promise that resolves when the settings.js is parsed.
     * 
     * @return {[type]} [description]
     */
    load: function (callback) {
      load.promise.then(function () {
        callback(null, data);
      })
      .catch(function (error) {
        callback(error, null);
      });
    },
    
    /**
     * Saves object to settings.js
     * 
     * @param  {[type]}   new_data [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    save: function (new_data, callback) {
      callback = callback || function () {};

      load.promise.then(function () {
        fs.writeFile(filepath, JSON.stringify(new_data), function (error) {
          if (error) {
            callback(error);
            return;
          }

          data = new_data;
          callback();
        });
      });
    }
  }
})();
