var fs = require('fs');
var yaml = require('yamljs');
var shell = require('shell');

var drupalvm_id = '';
var drupalvm_name = '';
var drupalvm_home = '';

var drupalvm_config = '';

var drupalvm_needsprovision = false;
var drupalvm_running = false;

var DRUPALVM_START = "start";
var DRUPALVM_STOP = "stop";
var DRUPALVM_PROVISION = "provision";

$( document ).ready( function() {
  drupalVMProcessing("Reading configurations ...")
  checkPrerequisites();
  detectDrupalVM();
});


// ------ Event Hookups ------ //

$("#menu_drupalvm_dashboard").click(function() {
  drupalvmBuildDashboard();
});


$("#menu_drupalvm_sites").click(function() {
  drupalvmBuildSitesList();
});


$("#menu_drupalvm_logs").click(function() {
  if(drupalvm_running) {
    shell.openExternal('http://pimpmylog.drupalvm.dev');
  }
  else {
    drupalVMAlert(
      "DrupalVM not started",
      "You need to start DrupalVM before using this functionality."
    );
  }
});


$("#menu_drupalvm_databases").click(function() {
  if(drupalvm_running) {
    shell.openExternal('http://adminer.drupalvm.dev');
  }
  else {
    drupalVMAlert(
      "DrupalVM not started",
      "You need to start DrupalVM before using this functionality."
    );
  }
});


$("#menu_drupalvm_xhprof").click(function() {
  if(drupalvm_running) {
    shell.openExternal('http://xhprof.drupalvm.dev');
  }
  else {
    drupalVMAlert(
      "DrupalVM not started",
      "You need to start DrupalVM before using this functionality."
    );
  }
});


$("#menu_drupalvm_settings").click(function() {
  drupalvmBuildSettings();
});


$("#menu_drupalvm_start").click(function() {
  controlVM(DRUPALVM_START);
});


$("#menu_drupalvm_stop").click(function() {
  controlVM(DRUPALVM_STOP);
});


$("#menu_drupalvm_provision").click(function() {
  controlVM(DRUPALVM_PROVISION);
});

$("#drupalvm_settings_filesync_default").click(function() {
  saveFileSyncType("");
})

$("#drupalvm_settings_filesync_rsync").click(function() {
  saveFileSyncType("rsync");
})

$("#drupalvm_settings_filesync_nfs").click(function() {
  saveFileSyncType("nfs");
})


// ------ Event Handlers ------ //

function drupalVMAlert(title, message) {
  $('#drupalvmAlertLabel').text(title)
  $('#drupalvmAlertBody').text(message)
  $('#drupalvmAlert').modal({
    keyboard: false,
    backdrop: 'static'
  });
  $('#drupalvmAlert').modal('show');
}


function drupalVMProcessing(title) {
  $('#drupalvmProcessingLabel').text(title)
  $('#drupalvmProcessing').modal({
    keyboard: false,
    backdrop: 'static'
  });
  $('#drupalvmProcessing').modal('show');
}


function checkPrerequisites() {
  // on failure, disable menu items, load status report into dashboard
}


function detectDrupalVM() {
  var exec = require('child_process').exec,
    child;

  // Run vagrant global-status
  child = exec('vagrant global-status',
    function (error, stdout, stderr) {

      console.log('stdout: ' + stdout);
      if (error !== null) {
        console.log('stderr: ' + stderr);
        console.log('exec error: ' + error);
      }

      // Search for the drupalvm entry
      lines = stdout.split("\n");
      for (var x in lines) {
        var line = lines[x];

        if(line.indexOf("drupalvm") > -1) {
          // Sample: d21e8e6  drupalvm virtualbox poweroff /home/nate/Projects/drupal-vm
          line = line.trim();
          var parts = line.split(/\s+/);
          setVagrantDetails(parts);
          break;
        }
      }
    });
}


function setVagrantDetails(details) {
  drupalvm_id = details[0];
  drupalvm_name = details[1];
  drupalvm_state = details[3];
  drupalvm_home = details[4];

  var config_file = drupalvm_home + '/config.yml';
  drupalvm_config = yaml.load(config_file);

  runDrupalVMLunchbox();
}


function runDrupalVMLunchbox() {
  updateVMStatus()
  drupalvmBuildSitesList();
}


function controlVM(action) {
  var title = '';
  var exec = require('child_process').exec,
    child;

  var cmd = 'vagrant';

  switch(action) {
    case DRUPALVM_START:
      cmd += ' up '
      title = 'Starting VM';
      break;

    case DRUPALVM_STOP:
      cmd += ' halt ';
      title = 'Stopping VM';
      break;

    case DRUPALVM_PROVISION:
      cmd += ' provision ';
      title = 'Re-provisioning VM';
      drupalvm_needsprovision = false;
      break;
  }

  drupalVMProcessing(title);

  cmd += drupalvm_id;

  child = exec(cmd,
    function (error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      if (error !== null) {
        console.log('stderr: ' + stderr);
        console.log('exec error: ' + error);
      }
      updateVMStatus();
    });
}


function updateVMStatus() {
  // Check if DrupalVM is running
  var exec = require('child_process').exec,
    child;

  // Run vagrant global-status
  child = exec('vagrant status ' + drupalvm_id,
    function (error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      if (error !== null) {
        console.log('stderr: ' + stderr);
        console.log('exec error: ' + error);
      }

      // Search for the status
      if(stdout.indexOf("poweroff") > -1) {
        $('#drupalvm_status').removeClass('fa-circle');
        $('#drupalvm_status').addClass('fa-circle-o');

        $('#menu_drupalvm_start').removeClass('disabled');
        $('#menu_drupalvm_stop').addClass('disabled');
        $('#menu_drupalvm_provision').addClass('disabled');

        drupalvm_running = false;
      }
      else {
        $('#drupalvm_status').removeClass('fa-circle-o');
        $('#drupalvm_status').addClass('fa-circle');

        $('#menu_drupalvm_start').addClass('disabled');
        $('#menu_drupalvm_stop').removeClass('disabled');
        $('#menu_drupalvm_provision').removeClass('disabled');

        drupalvm_running = true;
      }
      if(!drupalvm_needsprovision) {
        $("#controlLabel").text("");
      }

      $('#drupalvmProcessing').modal('hide');
    });
}


function drupalvmHidePanels() {
  $("#panel_drupalvm_dashboard").hide();
  $("#panel_drupalvm_sites").hide();
  $("#panel_drupalvm_settings").hide();
}


function drupalvmBuildDashboard() {
  drupalvmHidePanels();
  $("#panel_drupalvm_dashboard").fadeIn();
}


function drupalvmBuildSitesList() {
  drupalvmHidePanels();
  $('#drupalvmSites').html("");

  for(var x in drupalvm_config.apache_vhosts) {
    var servername = drupalvm_config.apache_vhosts[x].servername;

    switch(servername) {
      case "{{ drupal_domain }}":
      case "adminer.drupalvm.dev":
      case "xhprof.drupalvm.dev":
      case "pimpmylog.drupalvm.dev":
        // Don't process
        break;

      default:
        $('#drupalvmSites').append(renderSitesRow(servername))
        break;
    }
  }

  $("#panel_drupalvm_sites").fadeIn();
}

function renderSitesRow(servername) {
  var name = servername.split(".")[0];
  var row = $('<tr>');

  var td_name = $('<td>');
  td_name.html(name);
  row.append(td_name);

  var td_dns = $('<td>');
  var link = $('<a>');
  link.attr('href', '#');
  link.html(servername);
  td_dns.append(link);
  link.click(function() {
    shell.openExternal("http://" + servername);
  })
  row.append(td_dns);

  var td_actions = $('<td class="drupalvm_sites_icons">');
  var button_github = $("<a href='#'><i class='fa fa-2 fa-git'></i></a>");
  button_github.click(function(){
    shell.openExternal('https://github.com/');
  });
  td_actions.append(button_github);

  var button_install = $("<a href='#'><i class='fa fa-2 fa-arrow-down'></i></a>");
  button_install.click(function(){
    drupalVMAlert("Composer install", "When implemented, this button will invoke a 'composer install' to set up the docroot for the project.")
  });
  td_actions.append(button_install);


  row.append(td_actions);

  var td_edit = $('<td class="drupalvm_sites_icons">');

  var button_edit = $('<a href="#"><i class="fa fa-2 fa-pencil"></i></a>');
  button_edit.click(function(){
    drupalVMAlert("Edit entry", "When implemented, this button will allow you to edit this site entry.")
  });
  td_edit.append(button_edit);

  var button_delete = $('<a href="#"><i class="fa fa-2 fa-ban"></i></a>');
  button_delete.click(function(){
    drupalVMAlert("Delete entry", "When implemented, this button will allow you to delete this site entry.")
  });
  td_edit.append(button_delete);

  row.append(td_edit);

  return row;
}


function drupalvmBuildSettings() {
  drupalvmHidePanels();

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

  $("#panel_drupalvm_settings").fadeIn();
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
  fs.writeFile(drupalvm_home + '/config.yml', yamlString, function(err) {
      if(err) {
          return console.log(err);
      }
  });
  $("#controlLabel").text("Needs re-provisioning");
  drupalvm_needsprovision = true;
}
