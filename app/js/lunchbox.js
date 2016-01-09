var yaml = require('yamljs');
var shell = require('shell');
var bootbox = require('bootbox');
var Q = require('q');
var os = require('os');

/***************************************************************
    Global items for access from all modules / files
***************************************************************/

// container for lunchbox data
window.lunchbox = {
  settings: {
    vm: {
      needs_reprovision: false,
      config: {}
    },
  },
};

/**
 * Helper to load custom modules. Alleviates the need to provide a
 * relative filepath when loading a custom module from somewhere other than 
 * a file in /app/
 * 
 * @param  {[type]} src [description]
 * @return {[type]}     [description]
 */
window.load_mod = function (src) {
  return require('./' + src + '.js');
}

/**
 * Callback for storage.save()
 * 
 * @param  {[type]} error [description]
 * @param  {[type]} data  [description]
 * @return {[type]}       [description]
 */
window.storage_save_callback = function (error, data) {
  if (error !== null) {
    console.log('Error: ' + error);
    return;
  }

  window.lunchbox.settings = data;
};

/**
 * Updates reprovision status in settings.
 * 
 * @param {[type]}   status   [description]
 * @param {Function} callback [description]
 */
window.set_reprovision_status = function (status, callback) {
  callback = callback || function () {};

  window.lunchbox.settings.vm.needs_reprovision = true;
  // console.log('in set_reprovision_status');
  // console.log(window.lunchbox.settings);
  storage.save(window.lunchbox.settings, function (error, data) {
    storage_save_callback(error, data);

    if (error !== null) {
      return;
    }

    // console.log('callback time');
    // console.log(window.lunchbox.settings);

    callback();
  });
}

/**
 * Shows alert to reprovision the vm
 * 
 * @return {[type]} [description]
 */
window.show_reprovision_notice = function () {
  set_reprovision_status(true, function () {
    $('#reprovisionAlert').show('fast');
  });
}

/**
 * Hides alert to reprovision the vm
 * 
 * @return {[type]} [description]
 */
window.hide_reprovision_notice = function () {
  set_reprovision_status(false, function () {
    $("#reprovisionAlert").hide("fast");
  });
}


// shortcut reference
var settings = window.lunchbox.settings;

var qc = load_mod('tools/qchain');
var storage = load_mod('internal/storage');
var nav = load_mod('components/nav');

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
    op: boot.loadSettings,
    args: [
      dialog
    ]
  });

  operations.push({
    op: boot.checkProvisionStatus,
    args: [
      dialog
    ]
  });

  operations.push({
    op: boot.checkPrerequisites,
    args: [
      dialog
    ]
  });

  operations.push({
    op: boot.detectDrupalVM,
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

    // storage.save(settings);
  }, function (error) {
    dialog.append(error, 'error');
  });
});

// ------ Event Hookups ------ //

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

  var dialog = load_mod('components/dialog').create(title);
  dialog.logProcess(child);

  child.on('exit', function (exitCode) {
    switch(action) {
      case DRUPALVM_START:
        if (!window.lunchbox.settings.vm.needs_reprovision) {
          updateVMStatus(dialog);
          return;
        }

        controlVM(DRUPALVM_PROVISION);

        break;

      case DRUPALVM_STOP:
      case DRUPALVM_RELOAD:
        updateVMStatus(dialog);

        break;

      case DRUPALVM_PROVISION:
        hide_reprovision_notice();
        updateVMStatus(dialog);

        break;
    }
  });
}
