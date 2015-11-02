var app = require('app')
var BrowserWindow = require('browser-window')
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (process.platform != 'darwin') {
    app.quit();
  }
});

app.on('ready', function() {
  var mainWindow = new BrowserWindow({
    width: 1000,
    height: 600
  });

  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  mainWindow.setMenuBarVisibility(false);

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {

    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});
