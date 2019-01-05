// For compiling koval's 3D grapher into the build folder
// final file structure:
// url.txt
// /result
//		src
//			index.html
//     		mystyles.css
//     		mesh.js
//     		grapher.js
//     		expression-sorter.js
//     		latex-parser.js
//			...
//     	imgs
//      	close-icon.svg
//			download-icon.svg 
//			embed-icon.svg
//			help-icon.svg
//			invert-normal-icon.svg
//			link-icon.svg
//			more-icon.svg
//			settings-icon.svg
//			...
//     	libs
//      	math.js
//      	mathquill
//          	...

// for running command line args
const shell = require('child_process');
// for saving files
const files = require('fs');

// remove url.txt, if it exists
shell.exec('rm url.txt');
// save '3dgrapher' to url.txt
shell.exec('echo 3dgrapher > url.txt');

// remove result folder, if it exists
if(files.existsSync('result')){
	// s for all subfiles, q for quiet
	shell.exec('rm -r result');
}

// add results folder back, or newly
shell.exec('mkdir result');

// copy entire src folder over
// (s subfiles, q quiet, y overwrite quiet)
shell.exec('cp -r ../src result/');

// copy entire imgs folder
shell.exec('cp -r ../imgs result/');

// only copy math.js and mathquill. There's some extra libraries that I might need later, 
// but we'll wait on that one
shell.exec('mkdir result/libs');
shell.exec('cp ../libs/math.js result/libs/');
shell.exec('cp -r ../libs/mathquill-0.10.1 result/libs/');




