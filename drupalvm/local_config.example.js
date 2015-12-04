// rename this file to local_config.js for changes to take effect
'use strict';

module.exports.appOnReady = function(mainWindow) {
  mainWindow.setSize(1400, 900);

  // Open the DevTools.
  mainWindow.webContents.openDevTools({
    detach: true
  });
};