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
const exec = require('child_process').execSync;
// for saving files
const files = require('fs');

// remove url.txt, if it exists
exec('del /q url.txt');
// save '3dgrapher' to url.txt
exec('echo 3dgrapher > url.txt');

// remove result folder, if it exists
if(files.existsSync('result')){
	// s for all subfiles, q for quiet
	exec('rmdir /s /q result');
}

// add results folder back, or newly
exec('mkdir result');

// copy entire src folder over
// (s subfiles, q quiet, y overwrite quiet)
exec('echo d | xcopy /s /q /r /y "..\\src" "result\\src"');

// copy entire imgs folder
exec('echo d | xcopy /s /q /r /y "..\\imgs" "result\\imgs"');

// only copy math.js and mathquill. There's some extra libraries that I might need later, 
// but we'll wait on that one
exec('mkdir "result\\libs"');
exec('copy "..\\libs\\math.js" "result\\libs\\math.js"')
exec('echo d | xcopy /s /q /r /y "..\\libs\\mathquill-0.10.1" "result\\libs\\mathquill-0.10.1"');




