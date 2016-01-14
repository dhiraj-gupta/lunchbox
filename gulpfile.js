// get the dependencies
var gulp        = require('gulp'), 
  childProcess  = require('child_process'), 
  electron      = require('electron-prebuilt');

var less = require('gulp-less');
var path = require('path');

// create the gulp task
gulp.task('default', function () { 
  // generate .css files from .less files
  gulp.src('./app/css/*.less').pipe(less({
    paths: [ path.join(__dirname, 'less', 'includes') ]
  }))
  .pipe(gulp.dest('./app/css'));

  // spawn electron
  childProcess.spawn(electron, ['.'], { stdio: 'inherit' }); 
});