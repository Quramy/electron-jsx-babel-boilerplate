'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var _ = require('lodash');
var fs = require('fs');
var del = require('del');
var mainBowerFiles = require('main-bower-files');
var electron = require('electron-connect').server.create();

var srcDir      = 'src';
var serveDir    = '.serve';
var distDir     = 'dist';
var releaseDir  = 'release';
var packageJson = require('./package.json');

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

gulp.task('compile:scripts', function () {
  return gulp.src('src/**/*.{js,jsx}')
    .pipe($.babel({stage: 0}))
    .pipe(gulp.dest(distDir))
  ;
});

gulp.task('html', ['inject:css'], function () {
  var assets = $.useref.assets({searchPath: ['bower_components', serveDir + '/styles']});
  return gulp.src(serveDir + '/renderer/**/*.html')
    .pipe(assets)
    .pipe(assets.restore())
    .pipe($.useref())
    .pipe(gulp.dest(distDir + '/renderer'))
  ;
});

gulp.task('copy:dependencies', function () {
  var dependencies = [];
  for(var name in packageJson.dependencies) {
    dependencies.push(name);
  }
  return gulp.src('node_modules/{' + dependencies.join(',') + '}/**/*')
    .pipe(gulp.dest(distDir + '/node_modules'))
  ;
});

gulp.task('copy:fonts', function () {
  return gulp.src('bower_components/**/fonts/*.woff')
    .pipe($.flatten())
    .pipe(gulp.dest(distDir + '/fonts'))
  ;
});

gulp.task('packageJson', function (done) {
  var json = _.cloneDeep(packageJson);
  json.main = 'app.js';
  fs.writeFile(distDir + '/package.json', JSON.stringify(json), function (err) {
    done();
  });
});

gulp.task('build', ['html', 'compile:scripts', 'copy:dependencies', 'packageJson', 'copy:fonts', 'misc']);

gulp.task('serve', ['inject:css', 'compile:scripts:watch', 'compile:styles', 'misc'], function () {
  electron.start();
  gulp.watch(['boewr.json', srcDir + '/renderer/index.html'], ['inject:css']);
  gulp.watch([serveDir + '/app.js', serveDir + '/browser/**/*.js'], electron.restart);
  gulp.watch([serveDir + '/styles/**/*.css', serveDir + '/renderer/**/*.html', serveDir + '/renderer/**/*.js'], electron.reload);
});

gulp.task('clean', function (done) {
  del([serveDir, distDir, releaseDir], function () {
    done();
  });
});


