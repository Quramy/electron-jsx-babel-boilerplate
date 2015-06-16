'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var mainBowerFiles = require('main-bower-files');
var electron = require('electron-connect').server.create();

var srcDir      = 'src';
var serveDir    = '.serve';
var distDir     = 'dist';
var releaseDir  = 'release';


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
gulp.task('inject:css', function() {
  return gulp.src(srcDir + '/**/*.html')
    .pipe($.inject(gulp.src(mainBowerFiles().concat([serveDir + '/styles/**/*.css'])), {
      relative: true,
      ignorePath: ['../.serve/']
    }))
    .pipe(gulp.dest(serveDir))
  ;
});

// Transform from ES6 fashion JSX files to ES5 JavaScript files
[{
  suffix: ':browser',
  sources: [srcDir + '/app.js', srcDir + '/{browser,.tmp}/**/*.js'],
  dest: serveDir
}, {
  suffix: ':renderer',
  sources: [srcDir + '/renderer/**/*.js', srcDir + '/renderer/**/*.jsx'],
  dest: serveDir + '/renderer'
}].forEach(function (it) {
  gulp.task('compile:scripts' + it.suffix, function () {
    return gulp.src(it.sources)
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.babel({
      stage: 0
    }))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(it.dest))
    ;
  });
});
gulp.task('compile:scripts', ['compile:scripts:browser', 'compile:scripts:renderer']);

// Copy assets
gulp.task('misc', function () {
  return gulp.src(srcDir + '/assets/**/*')
    .pipe(gulp.dest(serveDir + '/assets'))
  ;
});

gulp.task('build', ['inject:css', 'compile:scripts', 'compile:styles', 'misc']);

gulp.task('serve', ['build'], function () {
  electron.start();
  gulp.watch(['boewr.json', srcDir + '/renderer/index.html'], ['inject:css']);
  gulp.watch([srcDir + '/styles/**/*.scss'], ['compile:styles']);
  gulp.watch([srcDir + '/app.js', srcDir + '/browser/**/*.js'], ['compile:scripts:browser']);
  gulp.watch([srcDir + '/renderer/**/*.js', srcDir + '/renderer/**/*.jsx'], ['compile:scripts:renderer']);
  gulp.watch([serveDir + '/app.js', serveDir + '/browser/**/*.js'], electron.restart);
  gulp.watch([serveDir + '/styles/**/*.css', serveDir + '/renderer/**/*.html', serveDir + '/renderer/**/*.js'], electron.reload);
});

gulp.task('clean', function (done) {
  del([serveDir, distDir, releaseDir], function () {
    done();
  });
});


