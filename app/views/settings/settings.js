var storage = load_mod('internal/storage');
var alert = load_mod('components/alert');

var gitparse = require('git-url-parse');

var settings = null;

$(document).ready(function () {
  settings = window.lunchbox;
  
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
        path: settings.plugins_path + '/' + name_value,
        enabled: 0 // disabled by default
      };

      // TODO: ensure filepath doesn't exist

      var spawn = require('child_process').spawn;
      var child = spawn('git', ['clone', git_value.href, settings.plugins_path + '/' + name_value]);

      child.on('exit', function (exit_code) {
        alert.bind(add_plugin_trigger.parent());

        if (exit_code) {
          alert.error('Could not clone Git repository to ' + settings.plugins_path + '/' + name_value + '.');
          return;
        }

        // add plugin to main settings & save
        settings.plugins.push(plugin);
        storage.save(settings, function (error, data) {
          if (error !== null) {
            alert.error(error);
          }

          field_git.val('');
          field_name.val('');

          alert.status('Added "' + name_value_nice + '" plugin.');
          update_plugins_list();

          storage_save_callback(error, data);
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

      storage.save(settings, function (error, data) {
        var alert = load_mod('components/alert');
        alert.bind(manage_plugins_trigger.parent());

        if (error !== null) {
          alert.error(error);
        }

        alert.status('Updated plugins.');

        storage_save_callback(error, data);
      });
    }); 
  }







  /*
  console.log(settings);
  console.log('loaded settings.js');

  

  // populate settings vm form
  var vagrant_ip = $("input[name=vagrant_ip]");
  vagrant_ip.val(settings.vm.config.vagrant_ip);

  var vagrant_hostname = $("input[name=vagrant_hostname]");
  vagrant_hostname.val(settings.vm.config.vagrant_hostname);

  var vagrant_synced_folders = $("input[name=vagrant_synced_folders]");
  vagrant_synced_folders.val(settings.vm.config.vagrant_synced_folders[0].local_path);
  
  var vagrant_memory = $("input[name=vagrant_memory]");
  vagrant_memory.val(settings.vm.config.vagrant_memory);
  
  var vagrant_cpus = $("input[name=vagrant_cpus]");
  vagrant_cpus.val(settings.vm.config.vagrant_cpus);

  // setup filesync method widget & activate selected item
  var filesync_wrap = $('#filesync_method')
  if (filesync_wrap) {
    var filesync = settings.vm.config.vagrant_synced_folders[0].type;
    if (!filesync) {
      filesync = 'default';
    }

    setFilesync(filesync);
    function setFilesync(value) {
      filesync_wrap.find('label').removeClass('active');
      filesync_wrap.find('label input[type=radio]').removeAttr('checked');

      var input = filesync_wrap.find('label input[type=radio][value=' + value + ']');
      input.attr('checked', 'checked');
      input.parent().addClass('active');
    }

    filesync_wrap.find('label').each(function (i, label) {
      label = $(label);
      label.click(function (e) {
        e.preventDefault();

        setFilesync(label.find('input[type=radio]').attr('value'));
      });
    });
  }

  // populate installed extras form
  var extras = $('#installed_extras');
  extras.find('input[name=installed_extras]').removeAttr('checked'); // reset
  if (settings.vm.config.installed_extras) {
    settings.vm.config.installed_extras.forEach(function (item) {
      extras.find('input[type=checkbox][value=' + item + ']').attr('checked', 'checked');
    });
  }

  // callback for use with storage.save();
  var save_callback = function (error, data) {
    storage_save_callback(error, data);

    if (error !== null) {
      return;
    }

    // reload view & show notice
    $('#menu_drupalvm_settings a').click();
    show_reprovision_notice();
  };

  // form actions
  $('#save_settings').click(function (e) {
    e.preventDefault();

    // set general vagrant info
    settings.vm.config.vagrant_ip = vagrant_ip.val();
    settings.vm.config.vagrant_hostname = vagrant_hostname.val();
    settings.vm.config.vagrant_synced_folders[0].local_path = vagrant_synced_folders.val();
    settings.vm.config.vagrant_memory = vagrant_memory.val();
    settings.vm.config.vagrant_cpus = vagrant_cpus.val();

    // set synced folders
    var synced_folders = $('input[name=filesync_method]:checked').val();
    if (synced_folders == 'default') {
      synced_folders = '';
    }

    settings.vm.config.vagrant_synced_folders[0].type = synced_folders;

    // set installed extras
    settings.vm.config.installed_extras = [];
    $('input[name=installed_extras]:checked').each(function (i, item) {
      item = $(item);
      settings.vm.config.installed_extras.push(item.val());
    });

    // save
    storage.save(settings, save_callback);
  });

  $('#reset_settings').click(function (e) {
    e.preventDefault();

    bootbox.confirm('Reset all settings?', function (result) {
      if (result) {
        var yaml = require('yamljs');

        // reset config object & save
        var config_filepath = settings.vm.home + '/example.config.yml';
        settings.vm.config = yaml.load(config_filepath);
        storage.save(settings, save_callback);
      }
    });
  });
  */
});