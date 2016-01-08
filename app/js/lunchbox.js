var yaml = require('yamljs');
var shell = require('shell');
var bootbox = require('bootbox');
var Q = require('q');
var os = require('os');

/**
 * Global helper to load custom modules. Alleviates the need to provide a
 * relative filepath when loading a custom module from somewhere other than 
 * a file in /app/
 * 
 * @param  {[type]} src [description]
 * @return {[type]}     [description]
 */
window['load_mod'] = function (src) {
  return require('./' + src + '.js');
}

var qc = load_mod('tools/qchain');
var storage = load_mod('internal/storage');
var nav = load_mod('components/nav');

var settings = {};

var drupalvm_needsprovision = false;
var drupalvm_running = false;

var DRUPALVM_START = "start";
var DRUPALVM_STOP = "stop";
var DRUPALVM_PROVISION = "provision";
var DRUPALVM_RELOAD = "reload";

$(document).ready(function () {
  var boot = load_mod('internal/boot');
  var dialog = load_mod('components/dialog').create('Reading configuration...');

  // these will be performed sequentially; each operation will only execute
  // if the previous one completed successfully
  var operations = [];

  operations.push({
    op: boot.setupNavigation,
    args: [
      dialog
    ]
  });

  operations.push({
    op: loadSettings,
    args: [
      dialog
    ]
  });

  operations.push({
    op: checkPrerequisites,
    args: [
      dialog
    ]
  });

  operations.push({
    op: detectDrupalVM,
    args: [
      dialog
    ]
  });

  operations.push({
    op: updateVMStatus,
    args: [
      dialog
    ]
  });

  var chain = Q.fcall(function (){});

  var op_count = 0;
  operations.forEach(function (item) {
    var link = function () {
      var deferred = Q.defer();
      
      item.op.apply(item.op, item.args).then(function (result) {
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

  chain.then(function (result) {
    dialog.hide();

    nav.loadFile('views/dashboard.html', function (error) {
      if (error) {
        console.log('Error: ' + error);
      }
    });

    // settings.id = '';
    // settings.name = '';
    // settings.home = '';
    // settings.config = '';
    // settings.needsprovision = false;
    // settings.running = false;

    // storage.save(settings);
  }, function (error) {
    dialog.append(error, 'error');
  });
});

// ------ Event Hookups ------ //

$("#menu_drupalvm_tools").click(function () {
  drupalvmBuildTools();
});

$("#menu_drupalvm_settings").click(function () {
  drupalvmBuildSettings();
});

$("#provisionLink").click(function () {
  if(drupalvm_running) {
    controlVM(DRUPALVM_PROVISION);
  }
  else {
    controlVM(DRUPALVM_START);
  }
});

$("#drupalvm_start").click(function () {
  controlVM(DRUPALVM_START);
});


$("#drupalvm_stop").click(function () {
  controlVM(DRUPALVM_STOP);
});


$("#drupalvm_provision").click(function () {
  if(drupalvm_running) {
    controlVM(DRUPALVM_PROVISION);
  }
  else {
    controlVM(DRUPALVM_START);
  }
});

$("#vagrant_ip").change(function () {
  saveVMSettings("vagrant_ip");
});

$("#vagrant_hostname").change(function () {
  saveVMSettings("vagrant_hostname");
});

$("#vagrant_synced_folders").change(function () {
  saveVMSettings("vagrant_synced_folders");
});

$("#vagrant_memory").change(function () {
  saveVMSettings("vagrant_memory");
});

$("#vagrant_cpus").change(function () {
  saveVMSettings("vagrant_cpus");
});

$("#drupalvm_settings_filesync_default").click(function () {
  saveFileSyncType("");
})

$("#drupalvm_settings_filesync_rsync").click(function () {
  saveFileSyncType("rsync");
})

$("#drupalvm_settings_filesync_nfs").click(function () {
  saveFileSyncType("nfs");
})

$("#btnAdminer").click(function () {
  shell.openExternal('http://adminer.drupalvm.dev');
})

$("#btnPimpMyLog").click(function () {
  shell.openExternal('http://pimpmylog.drupalvm.dev');
})

$("#btnXHProf").click(function () {
  shell.openExternal('http://xhprof.drupalvm.dev');
})




$("#drupalVMReset>button").click(function () {
  bootbox.confirm("Reset all settings?", function (result) {
    if(result) {
      drupalVMResetSettings();
    }
  });
});

// ------ Event Handlers ------ //

/**
 * Loads & parses settings.json into the `settings` object.
 * 
 * @param  {[type]} dialog [description]
 * @return {[type]}        [description]
 */
function loadSettings(dialog) {
  var deferred = qc.defer();

  dialog.append('Loading Lunchbox settings.' + os.EOL);
  
  storage.load(function (error, data) {
    if (error !== null) {
      deferred.reject(error);
    }

    window['lunchbox_settings'] = settings = data;

    deferred.resolve();
  });

  return deferred.promise;
}

/**
 * Runs through a series of Promise-based checks against npm and general
 * software dependencies. 
 * 
 * @return {Object} A promise object (wrapper for all individual promises).
 */
function checkPrerequisites(dialog) {
  // npm dependencies
  qc.add(function () {
    var deferred = qc.defer();

    require('check-dependencies')().then(function (result) {
      if (!result.depsWereOk) {
        deferred.reject('Unmet npm dependencies. Please run "npm install" in the project directory.');
        return;
      }

      deferred.resolve(null);
    });

    return deferred.promise;
  });

  // general software dependencies
  var software = [{
    // virtualbox
    name: 'VirtualBox',
    command: 'vboxmanage --version',
    regex: /(\d+\.\d+\.\d+)/i,
    version: '5.0.10'
  }, {
    // vagrant
    name: 'Vagrant',
    command: 'vagrant --version',
    regex: /Vagrant (\d+\.\d+\.\d+)/i,
    version: '1.7.4',
    help: {
      darwin: [
        'Vagrant can be installed via a binary: http://www.vagrantup.com/downloads, or',
        'using Homebrew: http://sourabhbajaj.com/mac-setup/Vagrant/README.html'
      ],
      linux: [
        'Vagrant can be installed via a binary: http://www.vagrantup.com/downloads, or',
        'via command line: http://www.olindata.com/blog/2014/07/installing-vagrant-and-virtual-box-ubuntu-1404-lts'
      ],
      win32: 'Vagrant can be installed via a binary: http://www.vagrantup.com/downloads'
    }
  }, {
    // vagrant vbguest plugin
    name: 'Vagrant VBGuest Plugin',
    command: 'vagrant plugin list',
    regex: /vagrant-vbguest \((\d+\.\d+\.\d+)\)/i,
    version: '0.11.0',
    help: "Vagrant VBGuest Plugin can be installed by running 'vagrant plugin install vagrant-vbguest'."
  }, {
    // vagrant hostsupdater  plugin
    name: 'Vagrant HostsUpdater Plugin',
    command: 'vagrant plugin list',
    regex: /vagrant-hostsupdater \((\d+\.\d+\.\d+)\)/i,
    version: '1.0.1',
    help: "Vagrant HostsUpdater Plugin can be installed by running 'vagrant plugin install vagrant-hostsupdater'."
  }];

  /*
   {
    // ansible
    name: 'Ansible',
    command: 'ansible --version',
    regex: /ansible (\d+\.\d+\.\d+)/i,
    version: '1.9.4',
    help: {
      darwin: [
        'Ansible installation instructions: https://valdhaus.co/writings/ansible-mac-osx,',
        'http://docs.ansible.com/ansible/intro_installation.html',
        '',
        'If you encounter the "Error: cannot find role" issue, ensure that /etc/ansible/roles is owned by your user.'
      ],
      linux: [
        'Ansible installation instructions: http://docs.ansible.com/ansible/intro_installation.html',
        '',
        'If you encounter the "Error: cannot find role" issue, ensure that /etc/ansible/roles is owned by your user.'
      ],
      win32: 'Ansible installation instructions: http://docs.ansible.com/ansible/intro_windows.html'
    }
  }
  */

  var exec = require('child_process').exec;

  software.forEach(function (item) {
    qc.add(function () {
      var deferred = qc.defer();
      
      exec(item.command, [], function (error, stdout, stderr) {
        if (error !== null) {
          var error_text = [
            'Could not find ' + item.name + '; ensure it is installed and available in PATH.',
            '\tTried to execute: ' + item.command,
            '\tGot error: ' + stderr
          ];

          if (item.help) {
            // generic help for all platforms
            if (typeof item.help == 'string') {
              error_text.push(item.help);
            }
            // platform-specific help
            else if (typeof item.help == 'object') {
              if (item.help[process.platform]) {
                // array-ize the string
                if (typeof item.help[process.platform] !== 'object') {
                  item.help[process.platform] = [item.help[process.platform]];
                }

                for (var i in item.help[process.platform]) {
                  error_text.push(item.help[process.platform][i]);
                }
              }
            }
          }

          deferred.reject(error_text.join(os.EOL));

          return;
        }

        if (item.regex) {
          var matches = stdout.match(item.regex);
          if (matches) {
            var cv = require('compare-version');

            // >= 0 is all good
            if (cv(matches[1], item.version) < 0) {
              deferred.reject(item.name + ' was found, but a newer version is required. Please upgrade ' + item.name + ' to version ' + item.version + ' or higher.');
            }

            item.found_version = matches[1];
          }
          else {
            deferred.reject(item.name + ' was found, but the version could not be determined.');
          }
        }

        dialog.append(item.name + ' found.' + os.EOL);
        deferred.resolve(item);
      });

      return deferred.promise;
    });
  });

  // // test process w/ required user input
  // qc.add(function () {
  //   var deferred = qc.defer();

  //   // commands that require sudo should be ran with a -S flag; ex: "sudo -S ls"
  //   var child = require('child_process').exec('drush cc', []);

  //   dialog.setChildProcess(child);
  //   dialog.logProcess(child);

  //   child.on('close', function () {
  //     deferred.resolve(null);
  //   });

  //   return deferred.promise;
  // });

  // check for ansible, and if it is present, ensure ansible-galaxy install has
  // been run
  qc.add(function () {
    var deferred = qc.defer();

    exec('ansible --version', [], function (error) {
      // no ansible on host, no problem
      if (error !== null) {
        deferred.resolve(null);
        return;
      }

      // no error, so we have ansible and need to ensure all roles are in place
      dialog.append('Ansible found. Checking role requirements.' + os.EOL);

      var https = require('https');
      var source = 'https://raw.githubusercontent.com/geerlingguy/drupal-vm/master/provisioning/requirements.yml';

      https.get(source, function(res) {
        if (res.statusCode != 200) {
          deferred.reject('Could not get list of ansible roles. Expected list to be available at:' + os.EOL + '\t' + source);
          return;
        }

        var response = '';
        res.on('data', function(d) {
          response += d.toString('utf8');
        });

        res.on('end', function(d) {
          // build list of required roles
          var required = [];
          response.split("\n").forEach(function (line) {
            var parts = line.split(' ');
            if (parts.length == 3) {
              required.push(parts.pop());
            }
          });

          var present = [];
          // build list of present roles
          exec('ansible-galaxy list', [], function (error, stdout, stderr) {
            if (error !== null) {
              deferred.reject('Could not execute "ansible-galaxy list".');
            }

            stdout.split("\n").forEach(function (line) {
              var parts = line.split(' ');
              if (parts.length == 3) {
                present.push(parts[1].replace(',', ''));
              }
            });

            delta = required.filter(function (item) {
              return (present.indexOf(item) == -1);
            });

            if (delta.length) {
              var error_text = [
                'The following required ansible-galaxy roles are missing:'
              ];

              delta.forEach(function (item) {
                error_text.push("\t" + item);
              });

              error_text.push('This can be fixed by running "ansible-galaxy install" as specified in the DrupalVM quickstart:');
              error_text.push("\t" + ' https://github.com/geerlingguy/drupal-vm');
              error_text.push('If you encounter the "Error: cannot find role" issue, ensure that /etc/ansible/roles is owned by your user.');

              deferred.reject(error_text.join(os.EOL));
              return;
            }

            deferred.resolve(null);
          });

        });

      }).on('error', function(error) {
        deferred.reject('Could not parse list of ansible roles. Received error:' + os.EOL + '\t' + error);
      });
    });

    return deferred.promise;
  });

  return qc.chain();
}

/**
 * Sets vagrant-related globals based on output of "vagrant global-status"
 *
 * TODO: refactor to avoid globals
 */
function detectDrupalVM(dialog) {
  var deferred = Q.defer();

  var spawn = require('child_process').spawn;
  var child = spawn('vagrant', ['global-status']);

  var stdout = '';
  dialog.logProcess(child, function (output) {
    stdout += output;
  });

  child.on('exit', function (exitCode) {
    // Search for the drupalvm entry and parse it into global config variables
    lines = stdout.split("\n");
    for (var x in lines) {
      var parts = lines[x].split(/\s+/);

      // simply checking for the presense of 'drupalvm' in the line can cause
      // an issue if a non-drupalvm machine's filepath contains that string;
      // we need to check the machine name itself

      // Sample: d21e8e6  drupalvm virtualbox poweroff /home/nate/Projects/drupal-vm
      if (parts.length >= 5 && parts[1] == 'drupalvm') {
        settings.vm = {};
        settings.vm.id = parts[0];
        settings.vm.name = parts[1];
        settings.vm.state = parts[3];
        settings.vm.home = parts[4];

        var config_file = settings.vm.home + '/config.yml';
        settings.vm.config = yaml.load(config_file);
        storage.save(settings);

        deferred.resolve();
        return;
      }
    }

    deferred.reject('Could not find "drupalvm" virtualbox.');
  });

  return deferred.promise;
}

/**
 * Updates UI running status based on output of "vagrant status drupalvm"
 
 * @param  {[type]} dialog [description]
 * @return {[type]}        [description]
 */
function updateVMStatus(dialog) {
  var deferred = Q.defer();

  // Check if DrupalVM is running
  var spawn = require('child_process').spawn;
  var child = spawn('vagrant', ['status', settings.vm.id]);

  var stdout = '';
  dialog.logProcess(child, function (output) {
    stdout += output;
  });

  child.on('exit', function (exitCode) {
    // Search for the status
    if (stdout.indexOf('poweroff') > -1) {
      $('#drupalvm_start').removeClass('disabled');
      $('#drupalvm_stop').addClass('disabled');
      $('.drupalVMHeaderStatus').text("Stopped");

      drupalvm_running = false;
    }
    else {
      $('#drupalvm_start').addClass('disabled');
      $('#drupalvm_stop').removeClass('disabled');
      $('.drupalVMHeaderStatus').text("Running");

      drupalvm_running = true;
    }

    deferred.resolve();
    dialog.setProgress(100);
  });

  return deferred.promise;
}

function drupalVMProcessing(modalTitle) {

  var contents = "<div class='progress'>";
  contents+= "<div class='progress-bar progress-bar-striped active' role=progressbar' aria-valuenow='100' aria-valuemin='0' aria-valuemax='100' style='width: 100%''>";
  contents+= "<span class='sr-only'>100% Complete</span>";
  contents+= "</div>";
  contents+= "</div>";
  contents+= "Details";
  contents+= "<div id='processingLog'>";
  contents+= "<pre></pre>";
  contents+= "</div>";

  var dialog = bootbox.dialog({
    title: modalTitle,
    message: contents
  });
}

function controlVM(action) {
  var title = '';
  var cmd = '';

  switch(action) {
    case DRUPALVM_START:
      cmd = 'up'
      title = 'Starting VM';
      break;

    case DRUPALVM_STOP:
      cmd = 'halt';
      title = 'Stopping VM';
      break;

    case DRUPALVM_PROVISION:
      cmd = 'provision';
      title = 'Re-provisioning VM';
      break;

    case DRUPALVM_RELOAD:
      cmd = 'reload';
      title = 'Reloading VM';
      break;
  }

  var spawn = require('child_process').spawn;
  var child = spawn('vagrant', [cmd, settings.vm.id]);

  var dialog = require('components/dialog').create(title);
  dialog.logProcess(child);

  child.on('exit', function (exitCode) {
    switch(action) {
      case DRUPALVM_START:
        if (drupalvm_needsprovision) {
          controlVM(DRUPALVM_PROVISION);
        }
        else {
          updateVMStatus(dialog);
        }
        break;

      case DRUPALVM_STOP:
      case DRUPALVM_RELOAD:
        updateVMStatus(dialog);
        break;

      case DRUPALVM_PROVISION:
        drupalvm_needsprovision = false;
        $("#reprovisionAlert").hide("fast");
        updateVMStatus(dialog);
        break;
    }
  });
}

/**
 * Deactivates active menu links and hides all DOM sections.
 * 
 * @return {[type]} [description]
 */
function drupalvmHidePanels() {
  // hide all sections
  $('.main .drupalvm_section').hide();
  $('.sidebar li').removeClass('active');
}

function drupalvmBuildTools() {
  drupalvmHidePanels();
  $("#menu_drupalvm_tools").addClass("active");
  $("#panel_drupalvm_tools").fadeIn();
}





function runComposer(dir) {
  var spawn = require('child_process').spawn;
  var child = spawn('composer',
    [
      'install',
      '--working-dir=' + dir,
      '-n',
      '-vvv',
      '--dev'
    ]);

  var dialog = require('components/dialog').create('Running composer...');
  dialog.logProcess(child);
}

function promptDeleteDetails(projectName) {
  //TODO: Prompt to ask how much of the record to delete
  var deleteSettings = {
    "removeDirectory": true,
    "removeApacheVhost": true,
    "removeDatabase": true
  }

  bootbox.dialog({
    title: "Delete site: " + projectName,
    message: 'This will delete:'
      + '<ul>'
      + '<li>apache vhost</li>'
      + '<li>database</li>'
      + '<li>site directory and files</li>'
      + '</ul>',
    buttons: {
      success: {
        label: "Cancel",
        className: "btn-default",
        callback: function () {
          // Do nothing.
        }
      },
      delete: {
        label: "Delete",
        className: "btn-danger",
        callback: function () {
          deleteSite(projectName, deleteSettings);
        }
      }
    }
  });
}


function deleteSite(projectName, deleteSettings) {
  // Remove apache vhost entry
  if(deleteSettings.removeDirectory) {
    //TODO:
  }

  if(deleteSettings.removeApacheVhost) {
    for(var x in settings.vm.config.apache_vhosts) {
      var servername = settings.vm.config.apache_vhosts[x].servername;
      var name = servername.split(".")[0];
      if(name == projectName) {
        settings.vm.config.apache_vhosts.splice(x, 1);
      }
    }
  }

  if(deleteSettings.removeDatabase) {
    //TODO:
  }

  saveConfigFile();
  drupalvmBuildSitesList();
}




function drupalvmBuildSettings() {
  drupalvmHidePanels();

  // IP address
  $("#vagrant_ip").val(settings.vm.config.vagrant_ip);

  // Hostname
  $("#vagrant_hostname").val(settings.vm.config.vagrant_hostname);

  // Local files
  $("#vagrant_synced_folders").val(settings.vm.config.vagrant_synced_folders[0].local_path);

  // Memory
  $("#vagrant_memory").val(settings.vm.config.vagrant_memory);

  // CPUs
  $("#vagrant_cpus").val(settings.vm.config.vagrant_cpus);

  // VM file sync mechanism
  var file_sync_type = settings.vm.config.vagrant_synced_folders[0].type;
  switch(file_sync_type) {
    case "rsync":
      $("#drupalvm_settings_filesync_rsync").button('toggle');
      break;

    case "nfs":
      $("#drupalvm_settings_filesync_nfs").button('toggle');
      break;

    default:
      $("#drupalvm_settings_filesync_default").button('toggle');
  }

  // Installed extras
  $('#drupalvm_settings_installedextras input').prop('checked', false); // reset
  var installed_extras = settings.vm.config.installed_extras;
  for(x in installed_extras) {
    var extra = installed_extras[x];
    $('#drupalvm_settings_' + extra).prop('checked', true);
  }

  $("#menu_drupalvm_settings").addClass("active");
  $("#panel_drupalvm_settings").fadeIn();
}


function saveVMSettings(el) {
  switch(el) {
    case "vagrant_ip":
      settings.vm.config.vagrant_ip = $("#vagrant_ip").val();
      break;

    case "vagrant_hostname":
      settings.vm.config.vagrant_hostname = $("#vagrant_hostname").val();
      break;

    case "vagrant_memory":
      settings.vm.config.vagrant_memory = parseInt($("#vagrant_memory").val());
      break;

    case "vagrant_cpus":
      settings.vm.config.vagrant_cpus = parseInt( $("#vagrant_cpus").val() );
      break;

    case "vagrant_synced_folders":
      settings.vm.config.vagrant_synced_folders[0].local_path = $("#vagrant_synced_folders").val();
      break;
  }
  saveConfigFile();
}


function saveFileSyncType(file_sync_type) {
  // Only update if the value is actually different.
  if(file_sync_type != settings.vm.config.vagrant_synced_folders[0].type) {
    settings.vm.config.vagrant_synced_folders[0].type = file_sync_type;
    saveConfigFile();
  }
}


function saveConfigFile() {
  yamlString = YAML.stringify(settings.vm.config, 2);
  var fs = require('fs');
  fs.writeFile(settings.vm.home + '/config.yml', yamlString, function (err) {
    if(err) {
      return console.log(err);
    }
  });
  drupalvm_needsprovision = true;
  $("#reprovisionAlert").show("fast");
}



function drupalVMResetSettings() {
  var config_file = settings.vm.home + '/example.config.yml';
  settings.vm.config = yaml.load(config_file);
  saveConfigFile();

  drupalvmBuildSettings();
}
