var storage = load_mod('internal/storage');
var alert = load_mod('components/alert');

var gitparse = require('git-url-parse');

var settings = null;

$(document).ready(function () {
  settings = window.lunchbox.settings;
  
  // process "add plugin" form
  var add_plugin_form = $('#lunchbox-settings-add-plugin');
  if (add_plugin_form.length) {
    var add_plugin_trigger = add_plugin_form.find('button.submit');
    add_plugin_trigger.click(function () {
      var field_git = add_plugin_form.find('input[name=git]');
      var git_value = gitparse(field_git.val());

      if (!git_value.name) {
        alert.bind(field_git);
        alert.error('Cannot parse provided Git URL.');
        return;
      }

      var field_name = add_plugin_form.find('input[name=name]');
      
      // we store the original user input in name_value_nice, to be used for
      // user-facing plugin names; name_value is a lowercase version (machine
      // name)
      var name_value = field_name.val();
      var name_value_nice = '';

      if (name_value) {
        name_value_nice = name_value;
      }
      // no user-provided name, default to git repository name
      else {
        name_value_nice = git_value.name;
        name_value = git_value.name;
      }

      // force machine name to be all lowercase, and strip non-alphanumeric
      // characters
      name_value = name_value.toLowerCase();
      name_value = name_value.replace(/\W/g, '');
      
      // ensure plugin name is not already in use
      for (var i in settings.plugins) {
        var plugin = settings.plugins[i];

        if (plugin.name == name_value) {
          alert.bind(field_name);
          alert.error('Plugin name "' + name_value_nice + ' (' + name_value + ')" already exists.');
          return;
        }
      }

      // basic plugin settings
      var plugin = {
        name: name_value,
        name_nice: name_value_nice,
        git: git_value.href,
        path: window.lunchbox.plugins_path + '/' + name_value,
        enabled: 0 // disabled by default
      };

      // TODO: ensure filepath doesn't exist

      var spawn = require('child_process').spawn;
      var child = spawn('git', ['clone', git_value.href, window.lunchbox.plugins_path + '/' + name_value]);

      child.on('exit', function (exit_code) {
        alert.bind(add_plugin_trigger.parent());

        if (exit_code) {
          alert.error('Could not clone Git repository to ' + window.lunchbox.plugins_path + '/' + name_value + '.');
          return;
        }

        // add plugin to main settings & save
        settings.plugins.push(plugin);
        settings.save(function (error, data) {
          if (error !== null) {
            alert.error(error);
          }

          field_git.val('');
          field_name.val('');

          alert.status('Added "' + name_value_nice + '" plugin.');
          update_plugins_list();
        });
      });
    });
  }

  // load existing plugins
  update_plugins_list();
  function update_plugins_list () {
    // build plugins checkboxes
    var template = '';

    for (var i in settings.plugins) {
      var plugin = settings.plugins[i];

      var checked = plugin.enabled ? ' checked="checked" ' : '';

      template +=  '<div class="checkbox">';
      template += '  <label><input type="checkbox" ' + checked + ' name="' + plugin.name + '"> ' + plugin.name_nice + '</label>';
      template += '</div>';
    }

    var manage_plugins_form = $('#lunchbox-settings-manage-plugins');
    if (manage_plugins_form.length) {
      manage_plugins_form.find('.dynamic').empty().append(template);
    }
  }

  // process "manage plugins" form
  var manage_plugins_form = $('#lunchbox-settings-manage-plugins');
  if (manage_plugins_form.length) {
    var manage_plugins_trigger = manage_plugins_form.find('button.submit');
    manage_plugins_trigger.click(function () {
      manage_plugins_form.find('input[type=checkbox]').each(function (i, el) {
        el = $(el);

        var name = el.attr('name');
        var enabled = el.is(':checked') ? 1 : 0;

        for (var i in settings.plugins) {
          var plugin = settings.plugins[i];

          if (plugin.name == name) {
            settings.plugins[i].enabled = enabled;
          }
        }
      });

      settings.save(function (error, data) {
        var alert = load_mod('components/alert');
        alert.bind(manage_plugins_trigger.parent());

        if (error !== null) {
          alert.error(error);
        }

        alert.status('Updated plugins.');

        // re-run the plugin and nav startup operations to instantly reflect
        // the updated plugins
        var dialog = load_mod('components/dialog').create('Updating configuration...');

        var success = function (result) {
          dialog.hide();
        };

        runOps(['plugins', 'nav'], [dialog], success, error);
      });
    }); 
  }
});