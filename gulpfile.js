const gulp = require('gulp');
const del = require('del');
const ts = require("gulp-typescript");
const tabify = require("gulp-tabify");
const fs = require("fs");
const rename = require("gulp-rename");
const path = require("path");
const stringify = require("json-stringify-pretty-compact");
const zip = require("gulp-zip");

const Package = JSON.parse(fs.readFileSync('package.json'));
const MATCH_ALL = "**/*";
const Directories = {
  Dist: 'dist/',
  Source: 'src/',
  Css: 'css/',
  Lang: 'lang/',
  Templates: 'templates/',
  DevDist: `${path.join(process.env.FoundryVTTModulesDir, Package.name)}/`,
  Bundle: 'package/',
};

const deleteDistDirHandler = (outDir) => {
  const deleteDistDir = () => del(outDir);
  return deleteDistDir;
};

const buildSourceHandler = (outDir) => {
  const buildSource = () =>
    gulp
      .src(`${Directories.Source}${MATCH_ALL}`)
      .pipe(ts.createProject('tsconfig.json')())
      .pipe(tabify(2, false))
      .pipe(gulp.dest(`${outDir}${Directories.Source}`));
  return buildSource;
};
const buildManifestHandler = (outDir) => {
  const files = [];
  const buildManifest = (resolve) =>
    gulp
      .src(Package.main)
      .pipe(rename({ extname: '.js' }))
      .pipe(gulp.src(`${Directories.Css}${MATCH_ALL}`))
      .on('data', (file) => files.push(path.relative(file.cwd, file.path)))
      .on('end', () => {
        if (files.length === 0) throw new Error(`No files found in ${Directories.Source} or ${Directories.Css}`);
        const { jsFiles, cssFiles } = files.reduce((acc, file) => {
          if (file.endsWith('js')) acc.jsFiles.push(file);
          if (file.endsWith('css')) acc.cssFiles.push(file);
          return acc;
        }, { jsFiles: [], cssFiles: [] });
        fs.readFile('module.json', (_, data) => {
          const module =
            data
              .toString()
              .replaceAll("{{name}}", Package.name)
              .replaceAll("{{title}}", Package.title)
              .replaceAll("{{version}}", Package.version)
              .replaceAll("{{description}}", Package.description)
              .replaceAll('"{{sources}}"', stringify(jsFiles, null, "\t").replaceAll("\n", "\n\t"))
              .replaceAll('"{{css}}"', stringify(cssFiles, null, "\t").replaceAll("\n", "\n\t"));
          fs.writeFile(`${outDir}module.json`, module, resolve);
        });
      });
  return buildManifest;
};

const outputFilesHandler = (source, destination) => {
  const outputFiles = () => gulp.src(source).pipe(gulp.dest(destination));
  return outputFiles;
};
const outputLanguagesHandler = (outDir) => outputFilesHandler(`${Directories.Lang}${MATCH_ALL}`, `${outDir}${Directories.Lang}`);
const outputTemplatesHandler = (outDir) => outputFilesHandler(`${Directories.Templates}${MATCH_ALL}`, `${outDir}${Directories.Templates}`);
const outputCSSHandler = (outDir) => outputFilesHandler(`${Directories.Css}${MATCH_ALL}`, `${outDir}${Directories.Css}`);
const outputMetaFilesHandler = (outDir) => outputFilesHandler(['LICENSE', 'README.md'], outDir);

const build = (outDir) =>
  gulp
    .series(
      deleteDistDirHandler(outDir),
      gulp.parallel(
        buildSourceHandler(outDir),
        buildManifestHandler(outDir),
        outputLanguagesHandler(outDir),
        outputTemplatesHandler(outDir),
        outputCSSHandler(outDir),
        outputMetaFilesHandler(outDir),
      ),
    );

const compressDist = () => {
  const subDir = `${Directories.Dist}/${Package.name}/`;
  const copyDistToSubdir = () =>
    gulp
      .src(`${Directories.Dist}${MATCH_ALL}`)
      .pipe(gulp.dest(subDir));
  const zipSubdir = () =>
    gulp
      .src(`${subDir}${MATCH_ALL}`)
      .pipe(zip(`${Package.name}.zip`))
      .pipe(gulp.dest(Directories.Bundle));
  const copyModuleJSON = () =>
    gulp
      .src(`${Directories.Dist}module.json`)
      .pipe(gulp.dest(Directories.Bundle));
  return gulp.series(
    build(Directories.Dist),
    copyDistToSubdir,
    zipSubdir,
    copyModuleJSON,
    deleteDistDirHandler(subDir),
  );
};

exports.default = build(Directories.Dist);
exports.devbuild = build(Directories.DevDist);
exports.compress = compressDist();