const http = require('http');
const { parse } = require('url');
const next = require('next');

const socketPath = process.env.LSNODE_SOCKET;
if (socketPath) {
  const originalListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function (...args) {
    const callback = args.find((a) => typeof a === 'function');
    return originalListen.call(this, socketPath, callback);
  };
}

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port}`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
