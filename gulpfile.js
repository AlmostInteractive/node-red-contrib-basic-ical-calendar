const gulp = require('gulp');
const ts = require('gulp-typescript');
require('dotenv').config();
const sourcemaps = require('gulp-sourcemaps');
const nodemon = require('gulp-nodemon');
const watch = require('gulp-watch');
const minify = require('gulp-minify');
const replace = require('gulp-replace');

const fs = require('fs');
const paths = {
  pages: ['src/nodes/*.html'],
  src: 'src',
  dist: 'dist'
};

function copyResources() {
  const tsProjectResources = ts.createProject('tsconfig.resources.json');
  return tsProjectResources.src()
    .pipe(sourcemaps.init())
    .pipe(tsProjectResources())
    .js
    .pipe(gulp.dest('resources'));
}

function copyHtml() {
  const prepareCalEvents = fs.readFileSync('./resources/prepareCalEvents.js', 'utf8');
  const calNodeDefaultConfig = fs.readFileSync('./resources/calNodeDefaultConfig.js', 'utf8');
  const calNodeTemplate = fs.readFileSync('./src/resources/calNodeTemplate.html', 'utf8');
  return gulp.src('src/nodes/*.html', { base: 'src/nodes' })
    .pipe(replace('<!-- calNodeTemplate.html -->', calNodeTemplate))
    .pipe(replace('//<<prepareCalEvents>>', prepareCalEvents))
    .pipe(replace('//<<calNodeDefaultConfig>>', calNodeDefaultConfig))
    .pipe(gulp.dest(paths.dist));
}

gulp.task('copy-html', copyHtml);
gulp.task('copy-resources', copyResources);

gulp.task('develop', function (done) {
  const stream = nodemon({
    legacyWatch: true,
    exec: `node --inspect=9229 --preserve-symlinks --experimental-modules --trace-warnings ${process.env.NODEJS_PATH}`,
    ext: '*.js',
    watch: [paths.dist],
    ignore: ['*.map'],
    done: done,
    verbose: true,
    delay: 2000,
    env: { 'NO_UPDATE_NOTIFIER': '1' }
  });

  copyResources();
  copyHtml();
  const tsProject = ts.createProject('tsconfig.json');
  const tsProjectResources = ts.createProject('tsconfig.resources.json');

  tsProjectResources.src()
    .pipe(sourcemaps.init())
    .pipe(tsProjectResources())
    .js
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('resources'));

  tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .js
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(paths.dist));

  watch(paths.pages).on('change', () => {
    copyHtml();
    stream.emit('restart', 10);
  });

  watch('src/resources/*.html').on('change', () => {
    copyHtml();
    stream.emit('restart', 10);
  });

  watch('src/**/*.ts').on('change', () => {
    gulp.series(() => {
      tsProjectResources.src()
        .pipe(sourcemaps.init())
        .pipe(tsProjectResources())
        .js
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('resources'));
    }, () => {
      tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .js
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(paths.dist));
    });
    stream.emit('restart', 10);
  });

  stream
    .on('restart', function () {
      console.log('restarted!');
    })
    .on('crash', function () {
      console.error('Application has crashed!\n');
      stream.emit('restart', 10);  // restart the server in 10 seconds
    });
});

gulp.task('default',
  gulp.series('copy-resources', 'copy-html',
    () => {
      const tsProject = ts.createProject('tsconfig.json');
      return tsProject.src()
        .pipe(tsProject())
        .js
        .pipe(minify({
          ext: {
            min: '.js' // Set the file extension for minified files to just .js
          },
          noSource: true // Don’t output a copy of the source file
        }))
        .pipe(gulp.dest(paths.dist));
    })
);
