const electroff = (function (fetch) {'use strict';

  const self = {};
  "{{Flatted}}";

  const UID = '{{UID}}';
  const channel = '{{channel}}';

  const secret = Symbol('electroff');
  const {parse} = self.Flatted;
  const {stringify} = JSON;

  const apply = (target, self, args) =>
    `${target()}.apply(${json(self)},${json(args)})`
  ;

  let NetworkOK = true;
  const exec = body => fetch('electroff', {
    headers: {'Content-Type': 'application/json;charset=utf-8'},
    method: 'POST',
    body: json(body)
  }).then(b => b.text()).then(parse, (e = {message: 'Network Error'}) => {
    NetworkOK = false;
    document.documentElement.innerHTML = `
      <!doctype html>
      <html lang="en">
        <head>
          <title>Network Error</title>
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <style>*{font-family:sans-serif;}</style>
        </head>
        <body>
          <h1>Network Error</h1>
          <p>
            Please <button onclick="location.reload(!0)">Reload</button>
          </p>
        </body>
      </html>
    `.trim();
    return {error: e.message};
  });

  const json = any => stringify(any, (_, any) => {
    if (typeof any === 'function')
      return `(\xFF${any[secret] || any}\xFF)`;
    return any;
  });

  (function poll() {
    if (NetworkOK)
      setTimeout(
        () => exec({UID, channel, code: 'true'}).then(poll),
        60000
      );
  }());

  addEventListener('beforeunload', e => {
    navigator.sendBeacon('electroff', stringify({UID, channel, exit: true}));
  });

  let calls = 0;
  let once = '{{once}}';
  return function electroff(fn) {
    // avoid invoking CommonJS/electroff more than once
    // whenever the ELECTROFF_ONCE flag is passed
    if (once && calls++)
      throw new Error('Unhautorized script');

    let instances = 0;
    let run = Promise.resolve();

    const evaluate = code => (run = run.then(() =>
      exec({UID, channel, code}).then(response => {
        const {result, error} = response;
        if (error)
          return Promise.reject(new Error(error));
        if (result && result[channel]) {
          const global = result[channel];
          return new Proxy(() => global, $handler);
        }
        return result;
      })
    ));

    const handler = {
      apply(target, self, args) {
        return new Proxy(
          function () {
            return apply(target, self, args);
          },
          handler
        );
      },
      construct(target, args) {
        const ref = `global['${UID}']['\x00'][${instances++}]`;
        const text = `(${ref}||(${ref}=new(${target()})(...${json(args)})))`;
        return new Proxy(() => text, handler);
      },
      get(target, key) {
        switch (key) {
          case secret:
          case 'toJSON':
            return target();
          case 'apply':
            return (self, args) => this.apply(target, self, args);
          case 'bind':
            return (self, ...args) => (...extras) => new Proxy(
              function () {
                return apply(target, self, args.concat(extras));
              },
              handler
            );
          case 'call':
            return (self, ...args) => this.apply(target, self, args);
          case 'then':
            return fn => evaluate(target()).then(fn);
        }
        return new Proxy(
          function () {
            return `${target()}[${stringify(key)}]`;
          },
          handler
        );
      },
      has(target, key) {
        throw new Error(`invalid "${key}" in ${target()} operation`);
      },
      set(target, k, v) {
        evaluate(`${target()}[${stringify(k)}]=${json(v)}`);
        return true;
      }
    };

    const $handler = {
      ...handler,
      get(target, key) {
        return key === 'then' ? void 0 : handler.get(target, key);
      }
    };

    fn({
      __dirname: '{{__dirname}}',
      global: new Proxy(
        () => `global['${UID}']`,
        handler
      ),
      remove: target => exec({UID, channel, code: `delete ${target[secret]}`})
                        .then(({result}) => result),
      require: module => new Proxy(
        function () {
          return `require(${stringify(module)})`;
        },
        handler
      ),
      until: emitter => new Proxy(
        () => `(e=>((e.is||(e.is=t=>new Promise($=>{e.once(t,$)}))),e))(${
          emitter[secret]
        })`,
        handler
      )
    });
  };
}(fetch));
