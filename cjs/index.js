'use strict';
/*!
 * ISC License
 * Copyright (c) 2020, Andrea Giammarchi, @WebReflection
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
 * OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

const crypto = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('crypto'));
const {readFileSync} = require('fs');
const {basename, dirname, join} = require('path');
const vm = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('vm'));

const {stringify} = require('flatted');

const umeta = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('umeta'));
const { freemem } = require('os');
const {dirName, require: $require} = umeta(({url: require('url').pathToFileURL(__filename).href}));

const {isArray} = Array;
const {create, getPrototypeOf} = Object;
const {parse} = JSON;

const cache = new Map;
const rand = length => crypto.randomBytes(length).toString('hex');

const CHANNEL = rand(32);
const EXPIRE = 300000; // expires in 5 minutes

const cleanup = () => {
  const now = Date.now();
  const drop = [];
  cache.forEach((value, key) => {
    if (value < now)
      drop.push(key);
  });
  drop.forEach(UID => {
    cache.delete(UID);
    delete sandbox.global[UID];
  });
};

const js = ''.replace.call(
  readFileSync(join(dirName, '..', 'client', 'index.js')),
  '{{channel}}',
  CHANNEL
).replace(
  '{{__dirname}}',
  dirName
).replace(
  '"{{Flatted}}"',
  readFileSync(
    join(dirname($require.resolve('flatted')), '..', 'es.js')
  ).toString()
);

const sandbox = vm.createContext({
  global: create(null),
  require: $require
});

module.exports = (request, response, next) => {
  const {method, url} = request;
  if (basename(url) === 'electroff') {
    if (method === 'POST') {
      const data = [];
      request.on('data', chunk => {
        data.push(chunk);
      });
      request.on('end', async () => {
        try {
          const {UID, channel, code, exit} = parse(data.join(''));
          if (channel === CHANNEL && UID) {
            cache.set(UID, Date.now() + EXPIRE);
            cleanup();
            if (!(UID in sandbox.global)) {
              sandbox.global[UID] = {'\x00': create(null)};
            }
            if (exit) {
              cache.delete(UID);
              delete sandbox.global[UID];
              response.writeHead(200);
              response.end('');
              return;
            }
            response.writeHead(200, {
              'Content-Type': 'text/plain;charset=utf-8'
            });
            // #YOLO
            vm.runInContext(
              `try {
                global['\x00'] = {result: (${code})};
              }
              catch (e) {
                global['\x00'] = {error: e.message}
              }`,
              sandbox
            );
            const {result, error} = sandbox.global['\x00'];
            sandbox.global['\x00'] = null;
            if (error)
              response.end(stringify({error}));
            else {
              try {
                result.then(
                  result => {
                    if (result instanceof Buffer)
                      result = result.toString();
                    response.end(stringify({result}));
                  },
                  e => response.end(stringify({error: e.message}))
                );
              }
              catch (e) {
                if (typeof result === 'object') {
                  switch (!!result) {
                    case isArray(result):
                    case !getPrototypeOf(getPrototypeOf(result)):
                    case result instanceof Date:
                      break;
                    default:
                      const instances = sandbox.global[UID]['\x00'];
                      for (const key in instances) {
                        if (instances[key] === result) {
                          response.end(stringify({result: {[CHANNEL]: `global['${UID}']['\x00'][${key}]`}}));
                          return;
                        }
                      }
                  }
                }
                response.end(stringify({result}));
              }
            }
          }
          else {
            response.writeHead(403);
            response.end();
          }
        } catch (e) {
          response.writeHead(500);
          response.end();
        }
      });
    }
    else {
      response.writeHead(200, {
        'Content-Type': 'application/javascript;charset=utf-8'
      });
      response.end(js.replace('{{UID}}', rand(16)));
    }
    return true;
  }
  try {
    return false;
  }
  finally {
    if (next)
      next();
  }
};
