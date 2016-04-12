var fs = require('fs'),
	contentParser = require('./content-parser'),
	createRefsStore = require('./refs-store'),
	createPermalinksStore = require('./permalinks-store'),
	bookmarksBuilder = require('./bookmarks-builder'),
	resourcesCapturer = require('./resources-capturer'),
	chapterRenderer = require('./chapter-renderer'),
	path = require('path'),
	_ = require('lodash'),
	joinUrl = require('url-join');

var q = require('q'),
	readFile = q.denodeify(fs.readFile);

module.exports = function() {

	var bookshelf = {},
		chapterFiles = {},
		permalinks = createPermalinksStore(),
		refsStore = createRefsStore();


	function parseFile(filePath, encoding) {
		return readFile(filePath, encoding || 'utf8')
		.then(function(content) {
			return _.assign({
				path: filePath
			}, contentParser(content));
		});
	}

	function getBook(bookTitle) {
		var bookRef = refsStore.create(bookTitle),
			book = bookshelf[bookRef];
		
		if (!book) {
			book = bookshelf[bookRef] = {
				ref: bookRef,
				title: bookTitle,
				chapters: []
			};
		}

		return book;
	}

	function getFileUrl(filePath, bookRef, chapterRef) {
		var basename = path.basename(filePath).replace('md', 'html');
		return joinUrl('/docs', bookRef, chapterRef, basename); 
	}

	function prepareChapter(file, bookRef) {
		var chapterRef = refsStore.unique(file.chapter, bookRef);
			
		if (!chapterRef) {
			console.log('Chapter title ' + file.chapter + ' of ' + file.path + ' is not unique');
			throw new Error('Chapter title ' + file.chapter + ' of ' + file.path + ' is not unique');
		}

		var chapterMeta = {
			ref: chapterRef,
			bookRef: bookRef,
			title: file.chapter,
			permalink: permalinks.create(file.permalink, bookRef, chapterRef),
			fileUrl: getFileUrl(file.path, bookRef, chapterRef)
		};

		var bookmarks = bookmarksBuilder(),
			resources = resourcesCapturer(path.dirname(chapterMeta.fileUrl));

		var chapterHtml = chapterRenderer.render(file.content, bookmarks, resources);
		
		chapterMeta.bookmarks = bookmarks.get();

		return {
			path: file.path,
			meta: chapterMeta,
			html: chapterHtml,
			images: resources.getImages()
		};
	}

	function updateChapter(filePath, encoding) {
		return parseFile(filePath, encoding)
		.then(function(file) {
			var book = getBook(file.book),
				bookRef = book.ref;
			
			var chapter = chapterFiles[filePath];
			if (!chapter) {
				console.log('Chapter does not exist: ' + filePath);
				return addChapter(filePath, encoding);
			}

			if (chapter.bookRef !== bookRef) {
				deleteChapter(filePath);
				return addChapter(filePath, encoding);
			}
			refsStore.unlinkRef(chapter.ref, bookRef);

			var chapterDoc = prepareChapter(file, bookRef);
			_.assign(chapter, chapterDoc.meta);
			console.log(chapterDoc);	
			return chapterDoc;
		});
	}

	function addChapter(filePath, encoding) {
		return parseFile(filePath, encoding)
		.then(function(file) {
			var book = getBook(file.book),
				bookRef = book.ref,
				chapterDoc = prepareChapter(file, bookRef);
				
			book.chapters.push(chapterDoc.meta);	
			chapterFiles[filePath] = chapterDoc.meta;	
			console.log(chapterFiles);
			return chapterDoc;
		});
	}

	function deleteChapter(filePath) {
		var chapter = chapterFiles[filePath];
		if (chapter) {
			var book = bookshelf[chapter.bookRef],
				chapters = book.chapters;
			
			var index = chapters.indexOf(chapter);
			if (index > -1) {
				console.log('deleted');
				refsStore.unlinkRef(chapter.ref, chapter.bookRef);
				chapters.splice(index, 1);
				delete chapterFiles[filePath];
				if (chapters.length === 0) {
					delete bookshelf[chapter.bookRef];
				}
			}
		}
	} 

	return {

		addChapter: addChapter,
		updateChapter: updateChapter,
		deleteChapter: deleteChapter,
		get: function() {
			return bookshelf;
		}
	};
};