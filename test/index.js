const {readFileSync} = require('fs');
const {join} = require('path');

const electroff = require('../cjs');

const index = readFileSync(join(__dirname, 'index.html'));

require('http')
  .createServer((request, response) => {
    if (electroff(request, response)) return;
    response.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
    response.end(index);
  })
  .listen(8080, () => console.log('http://localhost:8080/'));
