var yaml = require('yamljs');
var shell = require('shell');
var bootbox = require('bootbox');

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

$("#menu_drupalvm_tools").click(function() {
  drupalvmBuildTools();
});

$("#menu_drupalvm_settings").click(function() {
  drupalvmBuildSettings();
});

$("#provisionLink").click(function() {
  if(drupalvm_running) {
    controlVM(DRUPALVM_PROVISION);
  }
  else {
    controlVM(DRUPALVM_START);
  }
});

$("#drupalvm_start").click(function() {
  controlVM(DRUPALVM_START);
});


$("#drupalvm_stop").click(function() {
  controlVM(DRUPALVM_STOP);
});


$("#drupalvm_provision").click(function() {
  controlVM(DRUPALVM_PROVISION);
});

$("#vagrant_ip").change(function() {
  saveVMSettings("vagrant_ip");
});

$("#vagrant_hostname").change(function() {
  saveVMSettings("vagrant_hostname");
});

$("#vagrant_synced_folders").change(function() {
  saveVMSettings("vagrant_synced_folders");
});

$("#vagrant_memory").change(function() {
  saveVMSettings("vagrant_memory");
});

$("#vagrant_cpus").change(function() {
  saveVMSettings("vagrant_cpus");
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

$("#btnAdminer").click(function() {
  shell.openExternal('http://adminer.drupalvm.dev');
})

$("#btnPimpMyLog").click(function() {
  shell.openExternal('http://pimpmylog.drupalvm.dev');
})

$("#btnXHProf").click(function() {
  shell.openExternal('http://xhprof.drupalvm.dev');
})


$("#addSite").click(function() {
  collectNewSiteDetails();
})

$("#drupalVMReset>button").click(function() {
  bootbox.confirm("Reset all settings?", function(result) {
    if(result) {
      drupalVMResetSettings();
    }
  });
});


// ------ Event Handlers ------ //

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


function checkPrerequisites() {
  // on failure, disable menu items, load status report into dashboard
}


function detectDrupalVM() {
  var spawn = require('child_process').spawn;
  var child = spawn('vagrant', ['global-status']);

  var stdout = '';
  child.stdout.on('data',
    function (buf) {
        stdout+= buf;
        $("#processingLog pre").append(document.createTextNode(buf));
        $("#processingLog pre").scrollTop($("#processingLog pre")[0].scrollHeight);
    }
  );

  child.on('exit', function (exitCode) {
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
  updateVMStatus();
  drupalvmBuildDashboard();
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
  }

  drupalVMProcessing(title);

  $("#processingLog pre").text("");

  var spawn = require('child_process').spawn;
  var child = spawn('vagrant',
    [cmd, drupalvm_id]);

  child.stdout.on('data',
    function (buf) {
        $("#processingLog pre").append(document.createTextNode(buf));
        $("#processingLog pre").scrollTop($("#processingLog pre")[0].scrollHeight);
    }
  );

  child.on('exit', function (exitCode) {

    switch(action) {
      case DRUPALVM_START:
        if(drupalvm_needsprovision) {
          bootbox.hideAll();

          controlVM(DRUPALVM_PROVISION);
        }
        else {
          updateVMStatus();
        }
        break;

      case DRUPALVM_STOP:
        updateVMStatus();
        break;

      case DRUPALVM_PROVISION:
        drupalvm_needsprovision = false;
        $("#reprovisionAlert").hide("fast");
        updateVMStatus();
        break;
    }
  });
}


function updateVMStatus() {
  // Check if DrupalVM is running
  var spawn = require('child_process').spawn;
  var child = spawn('vagrant',
    ['status', drupalvm_id]);

  var stdout = '';
  child.stdout.on('data',
    function (buf) {
        stdout += buf;
    }
  );

  child.on('exit', function (exitCode) {
    // Search for the status
    if(stdout.indexOf("poweroff") > -1) {
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
    bootbox.hideAll();
  });
}


function drupalvmHidePanels() {
  $("#panel_drupalvm_dashboard").hide();
  $("#menu_drupalvm_dashboard").removeClass("active");

  $("#panel_drupalvm_sites").hide();
  $("#menu_drupalvm_sites").removeClass("active");

  $("#panel_drupalvm_tools").hide();
  $("#menu_drupalvm_tools").removeClass("active");

  $("#panel_drupalvm_settings").hide();
  $("#menu_drupalvm_settings").removeClass("active");
}


function drupalvmBuildDashboard() {
  drupalvmHidePanels();
  $("#menu_drupalvm_dashboard").addClass("active");
  $("#panel_drupalvm_dashboard").fadeIn();
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
  link.click(function() {
    shell.openExternal("http://" + servername);
  })
  row.append(td_dns);

  var td_dbname = $('<td>');
  td_dbname.html(name);
  row.append(td_dbname);


  var td_actions = $('<td class="drupalvm_sites_icons">');
  var button_github = $("<a href='#'><i class='fa fa-2 fa-git'></i></a>");
  button_github.click(function(){
    shell.openExternal('https://github.com/');
  });
  td_actions.append(button_github);

  var button_install = $("<a href='#'><i class='fa fa-2 fa-arrow-down'></i></a>");
  button_install.click(function(){
    alert("When implemented, this button will invoke a 'composer install' to set up the docroot for the project.")
  });
  td_actions.append(button_install);


  row.append(td_actions);

  var td_edit = $('<td class="drupalvm_sites_icons">');

  var button_edit = $('<a href="#"><i class="fa fa-2 fa-pencil"></i></a>');
  button_edit.click(function(){
    alert("When implemented, this button will allow you to edit this site entry.")
  });
  td_edit.append(button_edit);

  var button_delete = $('<a href="#"><i class="fa fa-2 fa-ban"></i></a>');
  button_delete.click(function(){
    promptDeleteDetails(name);
  });
  td_edit.append(button_delete);

  row.append(td_edit);

  return row;
}


function collectNewSiteDetails() {
  bootbox.prompt({
    title: "New empty project",
    value: "ProjectName",
    callback: function(result) {
      if (result === null) {
        // Do nothing.
      } else {
        //TODO: Check for existing entry
        createNewSite(result.toLowerCase());
      }
    }
  });
}


function createNewSite(projectName) {
  // Create the directory
  var fs = require('fs');
  var dir = drupalvm_config.vagrant_synced_folders[0].local_path + "/" + projectName;

  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
  }

  //TODO: perform a git init?

  // Create the apache vhost
  var newSite = new Object();
  newSite.servername = projectName + ".drupalvm.dev";
  newSite.documentroot = "/var/www/" + projectName;
  drupalvm_config.apache_vhosts.push(newSite);

  //TODO: nginx?

  //TODO: Create the database
  var newDatabase = new Object();
  newDatabase.name = projectName;
  newDatabase.encoding = "utf8";
  newDatabase.collation = "utf8_general_ci";
  drupalvm_config.mysql_databases.push(newDatabase);

  saveConfigFile();

  drupalvmBuildSitesList();
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
        callback: function() {
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
  fs.writeFile(drupalvm_home + '/config.yml', yamlString, function(err) {
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
