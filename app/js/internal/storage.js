'use strict';

var fs = require('fs');
var os = require('os');

var qc = load_mod('tools/qchain');

/**
 * Storage API.
 */
module.exports = (function () {
  var remote = require('remote');
  var app = remote.require('app');

  var settings_filepath = app.getPath('userData') + '/settings.json';

  var data = {};

  var init = qc.defer();
  var load = qc.defer();

  fs.open(settings_filepath, 'a', '0666', function (error, fd) {
    if (error == null) {
      init.resolve();

      return;
    }

    init.reject('Could not open/create settings.json file.');
  });

  init.promise.then(function () {
    fs.readFile(settings_filepath, 'utf-8', function (error, contents) {
      if (!error) {
        try {
          if (!contents) {
            contents = '{}';
          }

          data = JSON.parse(contents);
          load.resolve();
        }
        catch (exception) {
          load.reject('Could not parse settings.json. Exception: ' + exception);
        }
      }
    });
  });

  return {
    /**
     * Returns a promise that resolves when the settings.json is parsed.
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
     * Saves main settings object to settings.json.
     * 
     * @param  {[type]}   new_data [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    save: function (new_data, callback) {
      callback = callback || function () {};

      // save the main settings file
      load.promise.then(function () {
        fs.writeFile(settings_filepath, JSON.stringify(new_data, 10, 2), function (error) {
          if (error) {
            callback(error, null);
            return;
          }

          data = new_data;
          callback(null, data);
        });
      });
    }
  }
})();
