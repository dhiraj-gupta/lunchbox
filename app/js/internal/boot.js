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
     * Loads & parses settings.yaml into the `window.lunchbox` object.
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

        var remote = require('remote');
        var app = remote.require('app');
        data.user_data_path = app.getPath('userData');
        data.plugins_path = data.user_data_path + '/plugins';
        data.app_path = app.getAppPath();
        data.public_path = data.app_path + '/app';

        window.lunchbox = data;

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
     * Ensures all plugins in window.lunchbox.plugins have codebases, and match Lunchbox
     * plugin requirements.
     * 
     * @param  {[type]} dialog [description]
     * @return {[type]}        [description]
     */
    checkPlugins: function (dialog) {
      var chain = Q.fcall(function (){});
      
      // individual plugins' code will live in this object
      if (typeof window.lunchbox_plugins == 'undefined') {
        window.lunchbox_plugins = {};
      }

      // no plugins present
      if (!window.lunchbox.plugins.length) {
        return chain;
      }
      
      // build a promise chain where each link handles a single plugin
      var found_plugins = [];
      window.lunchbox.plugins.forEach(function (plugin) {
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
                  var plugin_obj = require(plugin_main_path);

                  // rudimentary check for methods that must be implemented in the plugin
                  var required_methods = [
                    'init',
                    'getBootOps'
                  ];

                  var missing_methods = [];
                  for (var i in required_methods) {
                    if (typeof plugin_obj[required_methods[i]] !== 'function') {
                      missing_methods.push(required_methods[i] + '()');
                    }
                  }

                  plugin_obj.init(dialog);

                  if (missing_methods.length) {
                    deferred.reject('Malformed plugin: ' + plugin.name_nice + '. Missing implementation(s) of: ' + missing_methods.join(', ') + '.')
                    return;
                  }

                  window.lunchbox_plugins[plugin.name] = plugin_obj;

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
      // array of found plugins
      chain = chain.then(function () {
        window.lunchbox.plugins = found_plugins;
        storage.save(window.lunchbox, storage_save_callback);
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
      if (!window.lunchbox.plugins.length) {
        return chain;
      }
      
      dialog.append('Booting plugins.' + os.EOL);

      var operations = [];
      window.lunchbox.plugins.forEach(function (plugin) {
        if (!plugin.enabled) {
          return;
        }

        var plugin_obj = window.lunchbox_plugins[plugin.name];
        operations = operations.concat(plugin_obj.getBootOps());
      });

      var op_count = 0;
      operations.forEach(function (item) {
        var link = function () {
          var deferred = Q.defer();
          
          item.apply(item, [ dialog ]).then(function (result) {
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

          if (typeof item.href == 'undefined' || !item.href) {
            item.href = '#';
          }

          if (nav.plugin == 'lunchbox') {
            item.href = window.lunchbox.public_path + '/' + item.href;
          }
          else if (item.href != '#' && typeof nav.plugin_path != 'undefined') {
            item.href = nav.plugin_path + '/' + item.href;
          }

          if (typeof item.text == 'undefined' || !item.text) {
            item.text = '';
          }

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
            href: 'views/dashboard/dashboard.html',
            name: 'dashboard',
            text: '<i class="fa fa-cogs"></i> Dashboard',
          },
          {
            href: 'views/settings/settings.html',
            name: 'settings',
            text: '<i class="fa fa-cogs"></i> Settings',
          }
        ]
      };

      $('nav').append(build_nav(lunchbox_nav));

      // no plugins present
      if (!window.lunchbox.plugins.length) {
        deferred.resolve();
        return deferred.promise;
      }
      
      window.lunchbox.plugins.forEach(function (plugin, key) {
        if (!plugin.enabled) {
          return;
        }

        var plugin_obj = window.lunchbox_plugins[plugin.name];

        // a plugin doesn't have to implement a nav
        if (typeof plugin_obj.getNav !== 'function') {
          return;
        }

        var plugin_nav = plugin_obj.getNav();
        plugin_nav.plugin = plugin.name;
        plugin_nav.plugin_path = plugin.path;

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
