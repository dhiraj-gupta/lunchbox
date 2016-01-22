'use strict';

var yaml = require('yamljs');
var fs = require('fs');
var os = require('os');

var qc = load_mod('tools/qchain');

/**
 * Storage API.
 */
module.exports = (function () {
  var remote = require('remote');
  var app = remote.require('app');

  var settings_filepath = app.getPath('userData') + '/settings.yaml';

  var data = {};

  var init = qc.defer();
  var load = qc.defer();

  fs.open(settings_filepath, 'a', '0666', function (error, fd) {
    if (error == null) {
      init.resolve();

      return;
    }

    init.reject('Could not open/create settings.yaml file.');
  });

  init.promise.then(function () {
    fs.readFile(settings_filepath, 'utf-8', function (error, contents) {
      if (!error) {
        try {
          data = yaml.parse(contents);
          load.resolve();
        }
        catch (exception) {
          load.reject('Could not parse settings.yaml. Exception: ' + exception);
        }
      }
    });
  });

  return {
    /**
     * Returns a promise that resolves when the settings.yaml is parsed.
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
     * Saves main settings object to settings.yaml, and vm config to
     * vm's config.yaml.
     * 
     * @param  {[type]}   new_data [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    save: function (new_data, callback) {
      callback = callback || function () {};

      // save the main settings file
      load.promise.then(function () {
        fs.writeFile(settings_filepath, yaml.stringify(new_data, 10, 2), function (error) {
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
