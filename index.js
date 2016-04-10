var temp = require('temp');

function createTempOutputDir() {
	var temp = require('temp').track();
		tempDir = temp.mkdirSync('docsplayer');

	process.on('SIGINT', function() {
		temp.cleanupSync();			
		process.exit();
	});

	return tempDir;
}

function startDocs(docsSrcPattern, options) {
	var docsServer = require('./server'),
		filesScanner = require('./lib/files-scanner'),
		options = options || {},
		docsDestDir = options.docsDestDir || createTempOutputDir();

	filesScanner.scan(docsSrcPattern, docsDestDir, function() {
		docsServer.start({
			playerSrc: 'player/dist',
			docsSrc: docsDestDir,
			port: 8000
		});		
	});
}

module.exports = {
	start: startDocs
}