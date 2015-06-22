'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var _ = require('lodash');
var fs = require('fs');
var del = require('del');
var mainBowerFiles = require('main-bower-files');
var electronServer = require('electron-connect').server;
var packager = require('electron-packager');
var merge = require('merge2');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var packageJson = require('./package.json');

var srcDir      = 'src';      // source directory
var serveDir    = '.serve';   // directory for serve task
var distDir     = 'dist';     // directory for serve:dist task
var releaseDir  = 'release';  // directory for application packages

// Compile *.scss files with sourcemaps
gulp.task('compile:styles', function () {
  return gulp.src([srcDir + '/styles/**/*.scss'])
    .pipe($.sourcemaps.init())
    .pipe($.sass())
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(serveDir + '/styles'))
    ;
});

// Inject *.css(compiled and depedent) files into *.html
gulp.task('inject:css', ['compile:styles'], function() {
  return gulp.src(srcDir + '/**/*.html')
    .pipe($.inject(gulp.src(mainBowerFiles().concat([serveDir + '/styles/**/*.css'])), {
      relative: true,
      ignorePath: ['../../.serve', '..'],
      addPrefix: '..'
    }))
    .pipe(gulp.dest(serveDir))
  ;
});

// Copy assets
gulp.task('misc', function () {
  return gulp.src(srcDir + '/assets/**/*')
    .pipe(gulp.dest(serveDir + '/assets'))
    .pipe(gulp.dest(distDir + '/assets'))
  ;
});

// Incremental compile ES6, JSX files with sourcemaps
gulp.task('compile:scripts:watch', function (done) {
  gulp.src('src/**/*.{js,jsx}')
    .pipe($.watch('src/**/*.{js,jsx}', {verbose: true}))
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.babel({stage: 0}))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(serveDir))
  ;
  done();
});

// Compile scripts for distribution
gulp.task('compile:scripts', function () {
  return gulp.src('src/**/*.{js,jsx}')
    .pipe($.babel({stage: 0}))
    .pipe($.uglify())
    .pipe(gulp.dest(distDir))
  ;
});

// Make HTML and concats CSS files.
gulp.task('html', ['inject:css'], function () {
  var assets = $.useref.assets({searchPath: ['bower_components', serveDir + '/styles']});
  return gulp.src(serveDir + '/renderer/**/*.html')
    .pipe(assets)
    .pipe($.if('*.css', $.minifyCss()))
    .pipe(assets.restore())
    .pipe($.useref())
    .pipe(gulp.dest(distDir + '/renderer'))
  ;
});

// Copy fonts file. You don't need to copy *.ttf nor *.svg nor *.otf.
gulp.task('copy:fonts', function () {
  return gulp.src('bower_components/**/fonts/*.woff')
    .pipe($.flatten())
    .pipe(gulp.dest(distDir + '/fonts'))
  ;
});

// Minify dependent modules.
gulp.task('bundle:dependencies', function () {
  var streams = [], dependencies = [];
  var defaultModules = ['assert', 'buffer', 'console', 'constants', 'crypto', 'domain', 'events', 'http', 'https', 'os', 'path', 'punycode', 'querystring', 'stream', 'string_decoder', 'timers', 'tty', 'url', 'util', 'vm', 'zlib'],
      electronModules = ['app', 'auto-updater', 'browser-window', 'content-tracing', 'dialog', 'global-shortcut', 'ipc', 'menu', 'menu-item', 'power-monitor', 'protocol', 'tray', 'remote', 'web-frame', 'clipboard', 'crash-reporter', 'native-image', 'screen', 'shell'];

  // Because Electron's node integration, bundle files don't need to include browser-specific shim.
  var excludeModules = defaultModules.concat(electronModules);

  for(var name in packageJson.dependencies) {
    dependencies.push(name);
  }

  // create a list of dependencies' main files
  var modules = dependencies.map(function (dep) {
    var packageJson = require(dep + '/package.json');
    var main;
    if(!packageJson.main) {
      main = ['index.js'];
    }else if(Array.isArray(packageJson.main)){
      main = packageJson.main;
    }else{
      main = [packageJson.main];
    }
    return {name: dep, main: main};
  });

  // add babel/polyfill module
  modules.push({name: 'babel', main: ['polyfill.js']});

  // create bundle file and minify for each main files
  modules.forEach(function (it) {
    it.main.forEach(function (entry) {
      streams.push(
        browserify(
          'node_modules/' + it.name + '/' + entry, {
          detectGlobal: false,
          exclude: excludeModules,
          standalone: entry
        }).bundle()
          .pipe(source(entry))
          .pipe(buffer())
          .pipe($.uglify())
          .pipe(gulp.dest(distDir + '/node_modules/' + it.name))
      );
    });
    streams.push(
      // copy modules' package.json
      gulp.src('node_modules/' + it.name + '/package.json')
        .pipe(gulp.dest(distDir + '/node_modules/' + it.name))
    );
  });

  return merge(streams);
});

// Write a package.json for distribution
gulp.task('packageJson', ['bundle:dependencies'], function (done) {
  var json = _.cloneDeep(packageJson);
  json.main = 'app.js';
  fs.writeFile(distDir + '/package.json', JSON.stringify(json), function (err) {
    done();
  });
});

// Package for each platforms
gulp.task('package', ['win32', 'darwin', 'linux'].map(function (platform) {
  var taskName = 'package:' + platform;
  gulp.task(taskName, ['build'], function (done) {
    packager({
      dir: distDir,
      name: 'ElectronApp',
      arch: 'x64',
      platform: platform,
      out: releaseDir + '/' + platform,
      version: '0.28.1'
    }, function (err) {
      done();
    });
  });
  return taskName;
}));

// Delete generated directories.
gulp.task('clean', function (done) {
  del([serveDir, distDir, releaseDir], function () {
    done();
  });
});

gulp.task('serve', ['inject:css', 'compile:scripts:watch', 'compile:styles', 'misc'], function () {
  var electron = electronServer.create();
  electron.start();
  gulp.watch(['bower.json', srcDir + '/renderer/index.html'], ['inject:css']);
  gulp.watch([serveDir + '/app.js', serveDir + '/browser/**/*.js'], electron.restart);
  gulp.watch([serveDir + '/styles/**/*.css', serveDir + '/renderer/**/*.html', serveDir + '/renderer/**/*.js'], electron.reload);
});

gulp.task('build', ['html', 'compile:scripts', 'packageJson', 'copy:fonts', 'misc']);

gulp.task('serve:dist', ['build'], function () {
  electronServer.create({path: distDir}).start();
});

gulp.task('default', ['build']);

