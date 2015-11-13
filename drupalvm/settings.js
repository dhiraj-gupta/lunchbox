

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
