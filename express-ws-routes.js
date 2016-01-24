/*!
 * express-ws-routes
 * Copyright(c) 2015 Andre Mekkawi <github@andremekkawi.com>
 * MIT Licensed
 */

"use strict";

var debug = require('debug')('express-ws-routes');
var path = require('path');
var http = require('http');
var flatten = require('array-flatten');
var WebSocketServer = require('ws').Server;
var ServerResponse = require('http').ServerResponse;

var slice = Array.prototype.slice;
var toString = Object.prototype.toString;

/**
 * Create an express application with methods for handling web sockets.
 *
 * The application's 'listen' method will also create a websocket server for the default HTTP server.
 *
 * The websocket server is set to the 'wsServer' property on the HTTP server (i.e. <code>app.listen(8080).wsSserver</code>).
 *
 * @type {function}
 */
exports = module.exports = function(options) {
	var app = exports.extendExpress(options)();

	app.listen = function() {
		var server = http.createServer(this);
		server.wsServer = exports.createWebSocketServer(server, app, options);
		return server.listen.apply(server, arguments);
	};

	return app;
};

/**
 * Add proto methods to add websocket routes to express app and routers.
 *
 * See README.md for usage examples.
 *
 * @param {object} [options]
 * @param {string} [options.moduleName="express"] the require() module name for the express package
 * @param {string} [options.methodName="websocket"] the method name used for IncomingMessage objects
 * @return {function} express
 */
exports.extendExpress = function(options) {
	var moduleName = options && options.moduleName || 'express';
	var methodName = (options && options.methodName || 'websocket').toLowerCase();

	debug('extending module "%s" with method "%s"', moduleName, methodName);

	var express = require(moduleName);
	var Application = require(moduleName + '/lib/application');
	var Router = require(moduleName + '/lib/router/index');
	var Route = require(moduleName + '/lib/router/route');
	var Layer = require(moduleName + '/lib/router/layer');

	Route.prototype[methodName] = function() {
		var handles = flatten(slice.call(arguments));

		for (var i = 0; i < handles.length; i++) {
			var handle = handles[i];

			if (typeof handle !== 'function') {
				var type = toString.call(handle);
				var msg = 'Route.' + methodName + '() requires callback functions but got a ' + type;
				throw new Error(msg);
			}

			var layer = Layer('/', {}, handle);
			layer.method = methodName;

			this.methods[methodName] = true;
			this.stack.push(layer);
		}

		return this;
	};

	Application[methodName] = Router[methodName] = function(routePath) {
		debug('add %s route for %s', methodName, routePath);

		// Wrap the middleware to pass the correct arguments
		var middleware = Array.prototype.slice.call(arguments, 1).map(wrapWebsocketMiddleware);

		var route = this.route(routePath);
		route[methodName].apply(route, middleware);
		return this;
	};

	return express;
};

/**
 * Wrap websocket middleware to pass different arguments
 *
 * @private
 * @param {function} middleware
 * @returns {function} wrapped middleware
 */
function wrapWebsocketMiddleware(middleware) {
	return function(req, res, next) {
		if (res._websocket) {
			middleware(res._websocket.info, res._websocket.cb, next);
		}
		else {
			next();
		}
	};
}

exports.createWebSocketServer = function(server, app, options) {
	return new WebSocketServer({
		server: server,
		verifyClient: exports.verifyClient(app, options)
	})
		.on('connection', exports.onConnection());
};

/**
 * Pass as verifyClient option to require('ws').Server
 *
 * Uses express route handlers to verify web socket connections.
 *
 * See README.md for usage examples.
 *
 * @param {function} app Express app
 * @param {object} [options]
 * @param {string} [options.methodName="websocket"] the method name used for IncomingMessage objects
 * @returns {function}
 */
exports.verifyClient = function(app, options) {
	var methodName = (options && options.methodName || 'websocket').toLowerCase();

	return function(info, cb) {
		var reqUrl = info.req.originalUrl || info.req.url;
		var handled = false;
		var res = new ServerResponse(info.req);

		// Close the connection if attempting to send a normal HTTP response
		res.writeHead = function(statusCode) {
			if (handled) {
				debug('writing response headers for already handled request for %s', reqUrl);
			}
			else {
				debug('rejected due to writeHead %s for %s', statusCode, reqUrl);
				handled = true;
				cb(false, statusCode);
			}
		};

		res._websocket = {
			info: info,
			cb: routeCb
		};

		debug('verifying websocket connection for %s', reqUrl);

		// Set the fake HTTP methpd
		info.req.method = methodName.toUpperCase();

		// Route the request through the application
		app.handle(info.req, res, function() {
			// Close the connection if unhandled
			if (!handled) {
				debug('unhandled websocket connection for %s', reqUrl);
				handled = true;
				cb(false, 404);
			}
		});

		function routeCb(connectHandler) {
			if (handled) {
				debug('cb called for already handled request for %s', reqUrl);
				throw new Error('websocket already handled');
			}

			handled = true;
			if (!connectHandler) {
				debug('rejected websocket connection for %s', reqUrl);
				cb.apply(null, arguments);
			}
			else if (typeof connectHandler !== 'function') {
				debug('cb called with non-function for %s', reqUrl);
				cb(false, 500);
				throw new Error('Web socket route must pass a function when accepting a connection');
			}
			else {
				debug('accepted websocket connection for %s', reqUrl);
				info.req._websocketHandler = connectHandler;
				cb(true);
			}
		}
	};
};

/**
 * Handles the 'connection' websocket server events.
 *
 * See README.md for usage examples.
 *
 * @returns {function}
 */
exports.onConnection = function() {
	return function(webSocket) {
		var handler = webSocket.upgradeReq._websocketHandler;
		delete webSocket.upgradeReq._websocketHandler;

		// TODO: catch error?
		handler(webSocket, webSocket.upgradeReq);
	};
};
