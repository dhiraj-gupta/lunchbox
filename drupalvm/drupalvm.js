var yaml = require('yamljs');
var shell = require('shell');
var bootbox = require('bootbox');
var Q = require('q');
var os = require('os');

var drupalvm_id = '';
var drupalvm_name = '';
var drupalvm_home = '';

var drupalvm_config = '';

var drupalvm_needsprovision = false;
var drupalvm_running = false;

var DRUPALVM_START = "start";
var DRUPALVM_STOP = "stop";
var DRUPALVM_PROVISION = "provision";
var DRUPALVM_RELOAD = "reload";

$(document).ready(function () {
  var dialog = require('./modules/dialog').create('Reading configuration...');

  // these will be performed sequentially; each operation will only execute
  // if the previous one completed successfully
  var operations = [];

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
    // all done
    drupalvmBuildDashboard();
  }, function (error) {
    dialog.append(error, 'error');
  });
});

// ------ Event Hookups ------ //

$("#menu_drupalvm_dashboard").click(function () {
  drupalvmBuildDashboard();
});

$("#menu_drupalvm_sites").click(function () {
  drupalvmBuildSitesList();
});

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


$("#addSite").click(function () {
  collectNewSiteDetails();
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
 * Runs through a series of Promise-based checks against npm and general
 * software dependencies. 
 * 
 * @return {Object} A promise object (wrapper for all individual promises).
 */
function checkPrerequisites(dialog) {
  // all items added to the chain will be processed sequentially
  var chain = Q.fcall(function (){});

  // npm dependencies
  var npm_deferred = Q.defer();
  require('check-dependencies')().then(function (result) {
    if (!result.depsWereOk) {
      npm_deferred.reject('Unmet npm dependencies. Please run "npm install" in the project directory.');
      return;
    }

    npm_deferred.resolve(null);
  });

  chain = chain.then(npm_deferred.promise);

  // software dependencies
  var dependencies = [{
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

  dependencies.forEach(function (item) {
    var link = function() {
      var deferred = Q.defer();
      
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
    };

    chain = chain.then(link);
  });

  return chain;
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
        drupalvm_id = parts[0];
        drupalvm_name = parts[1];
        drupalvm_state = parts[3];
        drupalvm_home = parts[4];

        var config_file = drupalvm_home + '/config.yml';
        drupalvm_config = yaml.load(config_file);

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
  var child = spawn('vagrant', ['status', drupalvm_id]);

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
    dialog.hide();
  });

  return deferred.promise;
}

function drupalvmBuildDashboard() {
  drupalvmHidePanels();
  $("#menu_drupalvm_dashboard").addClass("active");
  $("#panel_drupalvm_dashboard").fadeIn();
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
  var child = spawn('vagrant', [cmd, drupalvm_id]);

  var dialog = require('./modules/dialog').create(title);
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

function drupalvmBuildSitesList() {
  drupalvmHidePanels();
  $('#drupalvmSites').html("");

  for(var x in drupalvm_config.apache_vhosts) {
    var servername = drupalvm_config.apache_vhosts[x].servername;

    switch(servername) {
      // We don't want to include these default entries.
      case "{{ drupal_domain }}":
      case "adminer.drupalvm.dev":
      case "xhprof.drupalvm.dev":
      case "pimpmylog.drupalvm.dev":
        // Don't process
        break;

      default:
        $('#drupalvmSites').append(renderSitesRow(servername));
        break;
    }
  }

  $("#menu_drupalvm_sites").addClass("active");
  $("#panel_drupalvm_sites").fadeIn();
}

function drupalvmBuildTools() {
  drupalvmHidePanels();
  $("#menu_drupalvm_tools").addClass("active");
  $("#panel_drupalvm_tools").fadeIn();
}

function renderSitesRow(servername) {
  var name = servername.split(".")[0];
  var row = $('<tr>');

  var td_dns = $('<td>');
  var link = $('<a>');
  link.attr('href', '#');
  link.html(servername);
  td_dns.append(link);
  link.click(function () {
    shell.openExternal("http://" + servername);
  })
  row.append(td_dns);

  var td_dbname = $('<td>');
  td_dbname.html(name);
  row.append(td_dbname);


  var td_actions = $('<td class="drupalvm_sites_icons">');
  var button_github = $("<a href='#'><i class='fa fa-2 fa-git'></i></a>");
  button_github.click(function (){
    shell.openExternal('https://github.com/');
  });
  td_actions.append(button_github);

  var button_install = $("<a href='#'><i class='fa fa-2 fa-arrow-down'></i></a>");
  button_install.click(function (){
    alert("When implemented, this button will invoke a 'composer install' to set up the docroot for the project.")
  });
  td_actions.append(button_install);


  row.append(td_actions);

  var td_edit = $('<td class="drupalvm_sites_icons">');

  var button_edit = $('<a href="#"><i class="fa fa-2 fa-pencil"></i></a>');
  button_edit.click(function (){
    alert("When implemented, this button will allow you to edit this site entry.")
  });
  td_edit.append(button_edit);

  var button_delete = $('<a href="#"><i class="fa fa-2 fa-ban"></i></a>');
  button_delete.click(function (){
    promptDeleteDetails(name);
  });
  td_edit.append(button_delete);

  row.append(td_edit);

  return row;
}

function collectNewSiteDetails() {
  bootbox.dialog({
    title: "New project",
    message: '<div class="row">  ' +
      '<div class="col-md-12"> ' +
      '<form class="form-horizontal"> ' +
      '<div class="form-group"> ' +
      '<label class="col-md-3 control-label" for="project_name">Project name</label> ' +
      '<div class="col-md-9"> ' +
      '<input id="project_name" name="project_name" type="text" placeholder="" class="form-control input-md"> ' +
      '</div> ' +
      '</div> ' +
      '<div class="form-group"> ' +
      '<label class="col-md-3 control-label" for="project_git_url">Git URL</label> ' +
      '<div class="col-md-9"> ' +
      '<input id="project_git_url" name="project_git_url" type="text" placeholder="" class="form-control input-md"> ' +
      '</div> ' +
      '</div> ' +
      '<div class="form-group"> ' +
      '<label class="col-md-3 control-label" for="awesomeness">Composer</label> ' +
      '<div class="col-md-4"> <div class="radio"> <label for="awesomeness-0"> ' +
      '<input type="radio" name="project_composer" id="composer-0" value="false" checked="checked"> ' +
      'No </label> ' +
      '</div><div class="radio"> <label for="composer-1"> ' +
      '<input type="radio" name="project_composer" id="composer-1" value="true"> Yes </label> ' +
      '</div> ' +
      '</div> </div>' +
      '<div class="form-group"> ' +
      '<label class="col-md-3 control-label" for="project_webroot">Webroot </label> ' +
      '<div class="col-md-9"> ' +
      '<input id="project_webroot" name="project_webroot" type="text" placeholder="" class="form-control input-md"> ' +
      '</div> ' +
      '</div> ' +
      '</form> </div>  </div>',
    buttons: {
      success: {
        label: "Create",
        className: "btn-primary",
        callback: function () {
          var name = $('#project_name').val();
          var git_url = $('#project_git_url').val();
          var composer = $("input[name='project_composer']:checked").val()
          var webroot = $('#project_webroot').val();
          createNewSite(name.toLowerCase(), git_url, composer, webroot);
        }
      }
    }
  });
}


function createNewSite(name, gitUrl, composer, webroot) {
  // Create the directory
  var fs = require('fs');
  var dir = drupalvm_config.vagrant_synced_folders[0].local_path + "/" + name;

  // Perform a git init
  if(gitUrl) {
    createSiteGit(dir, gitUrl, composer);
  }
  else {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
  }

  // Create the apache vhost
  var newSite = new Object();
  newSite.servername = name + "." + drupalvm_config.vagrant_hostname;
  newSite.projectroot = "/var/www/" + name;
  newSite.documentroot = "/var/www/" + name + "/" + webroot;
  drupalvm_config.apache_vhosts.push(newSite);


  // Create the database
  var newDatabase = new Object();
  newDatabase.name = name;
  newDatabase.encoding = "utf8";
  newDatabase.collation = "utf8_general_ci";
  drupalvm_config.mysql_databases.push(newDatabase);

  saveConfigFile();

  drupalvmBuildSitesList();
}

function createSiteGit(dir, projectGitUrl, composer){
  var spawn = require('child_process').spawn;
  var child = spawn('git',
    ['clone', projectGitUrl, dir]);

  var stdout = '';
  var dialog = require('./modules/dialog').create('Cloning from git ...');
  dialog.logProcess(child, function (output) {
    stdout += output;
  });

  child.on('exit', function (exitCode) {
    dialog.hide();

    if (composer) {
      runComposer(dir);
    }
  });
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

  var dialog = require('./modules/dialog').create('Running composer...');
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
    for(var x in drupalvm_config.apache_vhosts) {
      var servername = drupalvm_config.apache_vhosts[x].servername;
      var name = servername.split(".")[0];
      if(name == projectName) {
        drupalvm_config.apache_vhosts.splice(x, 1);
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
  $("#vagrant_ip").val(drupalvm_config.vagrant_ip);

  // Hostname
  $("#vagrant_hostname").val(drupalvm_config.vagrant_hostname);

  // Local files
  $("#vagrant_synced_folders").val(drupalvm_config.vagrant_synced_folders[0].local_path);

  // Memory
  $("#vagrant_memory").val(drupalvm_config.vagrant_memory);

  // CPUs
  $("#vagrant_cpus").val(drupalvm_config.vagrant_cpus);

  // VM file sync mechanism
  var file_sync_type = drupalvm_config.vagrant_synced_folders[0].type;
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
  var installed_extras = drupalvm_config.installed_extras;
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
      drupalvm_config.vagrant_ip = $("#vagrant_ip").val();
      break;

    case "vagrant_hostname":
      drupalvm_config.vagrant_hostname = $("#vagrant_hostname").val();
      break;

    case "vagrant_memory":
      drupalvm_config.vagrant_memory = parseInt($("#vagrant_memory").val());
      break;

    case "vagrant_cpus":
      drupalvm_config.vagrant_cpus = parseInt( $("#vagrant_cpus").val() );
      break;

    case "vagrant_synced_folders":
      drupalvm_config.vagrant_synced_folders[0].local_path = $("#vagrant_synced_folders").val();
      break;
  }
  saveConfigFile();
}


function saveFileSyncType(file_sync_type) {
  // Only update if the value is actually different.
  if(file_sync_type != drupalvm_config.vagrant_synced_folders[0].type) {
    drupalvm_config.vagrant_synced_folders[0].type = file_sync_type;
    saveConfigFile();
  }
}


function saveConfigFile() {
  yamlString = YAML.stringify(drupalvm_config, 2);
  var fs = require('fs');
  fs.writeFile(drupalvm_home + '/config.yml', yamlString, function (err) {
    if(err) {
      return console.log(err);
    }
  });
  drupalvm_needsprovision = true;
  $("#reprovisionAlert").show("fast");
}



function drupalVMResetSettings() {
  var config_file = drupalvm_home + '/example.config.yml';
  drupalvm_config = yaml.load(config_file);
  saveConfigFile();

  drupalvmBuildSettings();
}
