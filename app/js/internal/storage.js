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

      var save_config = qc.defer();
      var config_data = {};

      // save the config property into the appropriate vm's config.yaml
      load.promise.then(function () {
        if (typeof new_data.vm == 'undefined'
            || typeof new_data.vm.home == 'undefined' 
            || typeof new_data.vm.config == 'undefined') {
          save_config.resolve();
          return;
        }

        var config_filepath = new_data.vm.home + '/config.yml';
        fs.writeFile(config_filepath, yaml.stringify(new_data.vm.config, 2), function (error) {
          if (error) {
            save_config.reject();
            callback(error);
            return;
          }

          config_data = new_data.vm.config;
          delete new_data.vm.config;
          save_config.resolve();
        });
      });

      // save the main settings in user's settings.yaml
      save_config.promise.then(function () {
        fs.writeFile(settings_filepath, yaml.stringify(new_data), function (error) {
          if (error) {
            callback(error);
            return;
          }

          // re-populate the config object after save
          new_data.vm.config = config_data;

          data = new_data;
          callback(null, data);
        });
      });
    }
  }
})();
