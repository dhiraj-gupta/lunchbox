'use strict';

var os      = require('os');
var fs      = require('fs');
var Q       = require('q');
var yaml    = require('yamljs');

var qc      = load_mod('tools/qchain');
var storage = load_mod('internal/storage');

/**
 * Boot tasks.
 */
module.exports = (function () {
  return {
    /**
     * Loads & parses settings.yaml into the `window.lunchbox.settings` object.
     * 
     * @param  {[type]} dialog [description]
     * @return {[type]}        [description]
     */
    loadSettings: function (dialog) {
      var deferred = Q.defer();

      dialog.append('Loading Lunchbox settings.' + os.EOL);

      storage.load(function (error, data) {
        if (error !== null) {
          deferred.reject(error);
        }

        if (data == null) {
          data = {};
        }

        if (typeof data.plugins == 'undefined') {
          data.plugins = [];
        }

        if (typeof data.views == 'undefined') {
          data.views = {
            dashboard: {},
            settings: {}
          };
        }

        // set useful paths
        var remote = require('remote');
        var app = remote.require('app');

        window.lunchbox.user_data_path = app.getPath('userData');
        window.lunchbox.plugins_path = app.getPath('userData') + '/plugins';
        window.lunchbox.app_path = app.getAppPath();
        window.lunchbox.public_path = app.getAppPath() + '/app';

        // settings class
        var Settings = function () {};
        // helper to re-save the settings
        Settings.prototype.save = function (callback) {
          var callback = callback || function () {};

          // the plugins stored in window.lunchbox.settings.plugins contains an
          // 'instance' property, which is an instantiated plugin object; that
          // object contains its own 'plugin' property, which is a reference to
          // the appropriate plugin in window.lunchbox.settings.plugins; this
          // circular inheritance will cause issues if we try to stringify the
          // object as-is; the workaround is to build a temporary plain settings 
          // object (just for yaml~ification purposes) that doesn't contain
          // functions or object instances
          var plain_settings = {};
          for (var i in this) {
            if (this.hasOwnProperty(i)) {
              plain_settings[i] = this[i];
            }
          }

          var instances = [];
          for (var j in plain_settings.plugins) {
            instances[j] = plain_settings.plugins[j].instance;
            delete plain_settings.plugins[j].instance;
          }

          var storage = load_mod('internal/storage');
          storage.save(plain_settings, function (error, returned_data) {
            if (error) {
              callback(error);

              return;
            }

            // re-populate the temporarily removed 'instance' objects
            for (var k in returned_data.plugins) {
              returned_data.plugins[k].instance = instances[k];
            }

            callback(null);
          });
        };

        // re-create the settings object
        window.lunchbox.settings = new Settings();

        // re-populate the settings object with newly loaded data
        for (var key in data) {
          if (data.hasOwnProperty(key)) {
            window.lunchbox.settings[key] = data[key];
          }
        }

        deferred.resolve();
      });

      return deferred.promise;
    },

    /**
     * Checks for presense of plugins directory; creates it if missing.
     * @param  {[type]} dialog [description]
     * @return {[type]}        [description]
     */
    checkPluginsDir: function (dialog) {
      var deferred = Q.defer();

      dialog.append('Checking for plugins.' + os.EOL);

      fs.stat(window.lunchbox.plugins_path, function (error, stats) {
        if (error || !stats.isDirectory()) {
          dialog.append('Plugins directory not found; attepting to create.' + os.EOL);

          var mode = parseInt('0700', 8);
          fs.mkdir(window.lunchbox.plugins_path, mode, function (error) {
            if (error) {
              deferred.reject('Could not create plugins directory: ' + window.lunchbox.plugins_path);

              return;
            }

            dialog.append('Created plugins directory: ' + window.lunchbox.plugins_path + '.' + os.EOL);
            deferred.resolve();
          });

          return;
        }

        dialog.append('Found plugins directory: ' + window.lunchbox.plugins_path + '.' + os.EOL);
        deferred.resolve();
      });

      return deferred.promise;
    },

    /**
     * Ensures all plugins in window.lunchbox.settings.plugins have codebases, and match Lunchbox
     * plugin requirements.
     * 
     * @param  {[type]} dialog [description]
     * @return {[type]}        [description]
     */
    checkPlugins: function (dialog) {
      var chain = Q.fcall(function (){});
      
      // no plugins present
      if (!window.lunchbox.settings.plugins.length) {
        return chain;
      }
      
      // build a promise chain where each link handles a single plugin
      var found_plugins = [];
      window.lunchbox.settings.plugins.forEach(function (plugin) {
        var link = function () {
          var deferred = Q.defer();

          fs.stat(plugin.path, function (error, stats) {
            dialog.append('Checking plugin: ' + plugin.name_nice + '.' + os.EOL);
            
            // plugin files found; check for main.js entry-point
            if (!error && stats.isDirectory()) {
              var plugin_main_path = plugin.path + '/main.js';
              fs.stat(plugin_main_path, function (error, stats) {
                // entry-point found; load the plugin & save this plugin to the "found" array
                if (!error && stats.isFile()) {
                  var plugin_class = require(plugin_main_path);

                  plugin.instance = new plugin_class(plugin, dialog);

                  found_plugins.push(plugin);

                  deferred.resolve();
                  return;
                }

                deferred.reject('Malformed plugin: ' + plugin.name_nice + '. Missing main.js.');
                return;
              });

              return;
            }
            
            dialog.append('Plugin files not found in ' + plugin.path + '. Removing plugin.' + os.EOL);
            deferred.resolve();
          });
          
          return deferred.promise;
        }
        
        chain = chain.then(link);
      });
      
      // now that we've checked all plugins, update the plugin object with the
      // array of found plugins, and write to settings file
      chain = chain.then(function () {
        var deferred = Q.defer();

        window.lunchbox.settings.plugins = found_plugins;

        window.lunchbox.settings.save(function () {
          deferred.resolve();
        });

        return deferred.promise;
      });
      
      return chain;
    },

    /**
     * Runs boot scripts in all plugins.
     * 
     * @return {[type]} [description]
     */
    bootPlugins: function (dialog) {
      var chain = Q.fcall(function (){});

      // no plugins present
      if (!window.lunchbox.settings.plugins.length) {
        return chain;
      }
      
      dialog.append('Booting plugins.' + os.EOL);

      var operations = [];
      window.lunchbox.settings.plugins.forEach(function (plugin) {
        if (!plugin.enabled) {
          return;
        }

        plugin.instance.getBootOps().forEach(function (op) {
          operations.push({
            op: op,
            self: plugin.instance
          });
        });
      });

      var op_count = 0;
      operations.forEach(function (item) {
        var link = function () {
          var deferred = Q.defer();
          
          // we pass the plugin instance as the 'this' context to the operation
          item.op.apply(item.self, [ dialog ]).then(function (result) {
            op_count++;
            dialog.setProgress(op_count / operations.length * 100);

            deferred.resolve(result);
          }, function (error) {
            deferred.reject(error);
          });

          return deferred.promise;
        };

        chain = chain.then(link);
      });

      return chain;
    },

    /**
     * Builds main navigation from core & plugin links.
     * 
     * @param  {[type]} dialog [description]
     * @return {[type]}        [description]
     */
    buildNavigation: function (dialog) {
      var deferred = Q.defer();

      dialog.append('Building navigation.' + os.EOL);

      var build_nav = function (nav) {
        var template = '';

        if (nav.title) {
          template += '<li class="title">' + nav.title + '</li>';
        }

        for (var i in nav.items) {
          var item = nav.items[i];

          template += '<li class="view"><a href="' + item.href + '">' + item.text + '</a></li>';
        }

        template = '<ul class="nav nav-stacked" id="nav-' + nav.plugin + '">' + template + '</ul>';

        return template;
      };

      var lunchbox_nav = {
        plugin: 'lunchbox',
        title: 'Lunchbox',
        items: [
          {
            href: window.lunchbox.public_path + '/' + 'views/dashboard/dashboard.html',
            name: 'dashboard',
            text: '<i class="fa fa-cogs"></i> Dashboard',
          },
          {
            href: window.lunchbox.public_path + '/' + 'views/settings/settings.html',
            name: 'settings',
            text: '<i class="fa fa-cogs"></i> Settings',
          }
        ]
      };

      $('nav').append(build_nav(lunchbox_nav));

      // no plugins present
      if (!window.lunchbox.settings.plugins.length) {
        deferred.resolve();
        return deferred.promise;
      }
      
      window.lunchbox.settings.plugins.forEach(function (plugin, key) {
        if (!plugin.enabled) {
          return;
        }

        // a plugin doesn't have to implement a nav
        if (typeof plugin.instance.getNav !== 'function') {
          return;
        }

        var plugin_nav = plugin.instance.getNav();
        plugin_nav.plugin = plugin.instance.getUniqueName();

        for (var i in plugin_nav.items) {
          // each menu item must have a value for href
          if (typeof plugin_nav.items[i].href == 'undefined' || !plugin_nav.items[i]) {
            plugin_nav.items[i] = '#';
          }
          // the href must be an absolute value
          else {
            plugin_nav.items[i].href = plugin.path + '/' + plugin_nav.items[i].href;
          }

          // each menu item must have a value for text
          if (typeof plugin_nav.items[i].text == 'undefined' || !plugin_nav.items[i].text) {
            plugin_nav.items[i].text = '';
          }
        }

        $('nav').append(build_nav(plugin_nav));
      });

      deferred.resolve();
      return deferred.promise;
    },

    /**
     * Sets up links between menu items and their associated view files.
     * 
     * @param  {[type]} dialog [description]
     * @return {[type]}        [description]
     */
    linkNavigation: function (dialog) {
      var nav = load_mod('components/nav');
      nav.setContainer('#view-wrap');

      var deferred = Q.defer();

      var items = [];

      $('nav a').each(function (i, el) {
        el = $(el);
        items.push(el);

        if (el.attr('href') != '#') {
          nav.addNavItem(el, function (err) {
            if (err) {
              console.log('error: ' + err);
              return;
            }

            // remove 'active' class from all nav items
            items.forEach(function (item, i) {
              $(item).parent().removeClass('active');
            });

            // add 'active' class to clicked nav item
            el.parent().addClass('active');
          });
        }
      });

      deferred.resolve();
      
      return deferred.promise;
    },
  }
})();
