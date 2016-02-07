var gulp = require('gulp');
var gutil = require('gulp-util');
var webpack = require("webpack");
var coffeelint = require('gulp-coffeelint');
var livereload = require('gulp-livereload');

var webpackConfig = require("./webpack.config.js");
var baseClientPath = '.';
var baseServerTemplatesPath = '../views';
var cssFilesBasePath = '../public/client/css';

gulp.task('coffeelint', function () {
    gulp.src(baseClientPath + '/**/*.coffee')
        .pipe(coffeelint())
        .pipe(coffeelint.reporter());
});

gulp.task("dev", ["coffeelint", "webpack-dev"], function() {
    livereload.listen({quiet: true});
    gulp.watch([baseClientPath + '/**/*', baseServerTemplatesPath + '/**/*', cssFilesBasePath + '/**/*'], ["coffeelint", "webpack-dev", "all-livereload"]);
    // sudo sysctl fs.inotify.max_user_watches=100000 to prevent failure
});

gulp.task("prod", ["coffeelint","webpack-prod"], function() { });


gulp.task("webpack-prod", function(callback) {
	// modify some webpack config options
	var myConfig = Object.create(webpackConfig);
	myConfig.plugins = myConfig.plugins.concat(
		new webpack.DefinePlugin({
			"process.env": {
				// This has effect on the react lib size
				"NODE_ENV": JSON.stringify("production")
			}
		}),
		new webpack.optimize.DedupePlugin(),
		new webpack.optimize.UglifyJsPlugin()
	);

	// run webpack
	webpack(myConfig, function(err, stats) {
		if(err) throw new gutil.PluginError("webpack-prod", err);
		gutil.log("[webpack-build]", stats.toString({
			colors: true
		}));
		callback();
	});
});


// modify some webpack config options
var myDevConfig = Object.create(webpackConfig);
myDevConfig.devtool = "sourcemap";
myDevConfig.debug = true;

// create a single instance of the compiler to allow caching
var devCompiler = webpack(myDevConfig);

gulp.task("webpack-dev", function(callback) {
    // run webpack
    devCompiler.run(function(err, stats) {
        if (err) return callback(err);
        gutil.log("[webpack-dev]", stats.toString({
            colors: true
        }));
        callback();
    });
});

// No need to reload all files maybe??
gulp.task("all-livereload", function() {
    gulp.src([baseClientPath + '/**/*', cssFilesBasePath + '/**/*'])
    .pipe(livereload());
});
