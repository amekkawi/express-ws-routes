# express-ws-routes #

Handle WebSocket connections using [ws](https://www.npmjs.com/package/ws) via express routes.

Differences from [express-ws](https://www.npmjs.com/package/express-ws):

  * Does not prefix the request URL with '.websocket' and instead uses a fake `WEBSOCKET` HTTP method
  * Websocket requests must be explicitly accepted (see ws's verifyClient option)
  * Websocket requests can be rejected or the route can pass control to the next handler using `next()` (just like express routes)
  * Supports detached routers (i.e. `express.Router()`)

## Installation ##

If using NPM v3, install express v4.5.0 or later:
`npm install express@^4.5.0`

`npm install express-ws-routes`

## Usage ##

Express routes are used to verify and handle socket connections.

```javascript
var express = require('express');

// Create an express app with websocket support
var app = require('express-ws-routes')();

// Add routes directly to the app... 
app.websocket('/myurl', function(info, cb, next) {
	// `info` is the same as ws's verifyClient
	console.log(
		'ws req from %s using origin %s',
		info.req.originalUrl || info.req.url,
		info.origin
	);

	// Accept connections by passing a function to cb that will handle the connected websocket
	cb(function(socket) {
		socket.send('connected!');
	});
});

// ... or to detached routers
var router = express.Router();
router.websocket('/sub/path', function(info, cb, next) {
	cb(function(socket) {
		socket.send('connected!');
	});
});
app.use('/attachment/path', router);

// Reject requests using cb just like you would with ws's verifyClient
app.websocket('/bad/path', function(info, cb, next) {
	cb(false);
	
	// Using the optional arguments...
	//cb(false, 401);
	//cb(false, 401, 'No access!');
});

// Skip handlers by calling next(), just like normal routes
app.websocket('/skipped', function(info, cb, next) {
	console.log('Skipped!');
	next();
});

// Using app.listen will also create a require('ws').Server
var server = app.listen(8080, function() {
	console.log('Server listening on port 8080...');
});

// The WebSocket server instance is available as a property of the HTTP server
server.wsServer.on('connection', function(socket) {
	console.log('connection to %s', socket.upgradeReq.url);
});
```

## Options ##

### Module Name for 'express'

By default the express module name is `express` but can be changed:

```javascript
// Extend express using a specific module name, instead of 'express'
var app = require('express-ws-routes')({
	moduleName: 'my-custom-express' // i.e. require('my-custom-express')
});
```

### Fake HTTP Method

By default the fake HTTP method is `WEBSOCKET` but can be changed:

```javascript
// Use a different web socket
var app = require('express-ws-routes')({
	methodName: 'WS'
});

// Note: Method for attaching handlers will always be lowercase
app.ws(function(info, cb, next) {
	// ...
});
```

## Manual Setup ##

Instead of using the helper method you can do the following:

```javascript
var options = {}; // See 'Options' above
var expressWs = require('express-ws-routes');
var app = expressWs.extendExpress(options)();

var server = http.createServer(app);
server.wsServer = expressWs.createWebSocketServer(server, app, options);
server.listen(8080, function() {
	console.log('Server listening on port 8080...');
});
```

## License ##

The MIT License (MIT)

Copyright (c) 2015 Andre Mekkawi &lt;github@andremekkawi.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
