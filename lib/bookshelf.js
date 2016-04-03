var fs = require('fs'),
	contentParser = require('./content-parser'),
	createRefsStore = require('./refs-store'),
	bookmarksBuilder = require('./bookmarks-builder'),
	chapterRenderer = require('./chapter-renderer'),
	path = require('path');

module.exports = function() {

	var bookshelf = {},
		uniqueUrls = {},
		refsStore = createRefsStore();

	return {
		add: function(content) {
			var parsedFile = contentParser(content),
				meta = parsedFile.meta;

			if (!meta) {
				throw new Error('Meta data for file is not found')
			}

			if (!meta.book) {
				throw new Error('Undefined book property');
			}

			var bookRef = refsStore.create(meta.book);
			var book = bookshelf[bookRef];
			if (!book) {
				book = bookshelf[bookRef] = {
					id: bookRef,
					title: meta.book,
					chapters: []
				};
			}
			
			var chapterRef = refsStore.unique(meta.chapter, bookRef),
				chapterUrl = meta.url || '/' + bookRef + '/' + chapterRef;

			var urlRef = uniqueUrls[chapterUrl];
			if (urlRef) {
				console.log(chapterUrl + ' url is already defined for book: ' + urlRef.book + ', chapter: ' + urlRef.chapter);
				chapterUrl = '/' + bookRef + '/' + chapterRef;
			}

			uniqueUrls[chapterUrl] = {
				book: bookRef,
				chapter: chapterRef
			};
			
			var bookmarks = bookmarksBuilder();
			var chapterHtml = chapterRenderer.render(parsedFile.content, bookmarks);
			var chapterMeta = {
				id: chapterRef,
				bookId: bookRef,
				title: meta.chapter,
				url: chapterUrl,
				bookmarks: bookmarks.get()
			}			
			book.chapters.push(chapterMeta);	
			return {
				meta: chapterMeta,
				html: chapterHtml
			};
		},
		get: function() {
			return bookshelf;
		}
	}
}