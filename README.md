# electroff

![Raspberry Pi Oled](./electroff-head.jpg)

A cross browser, electron-less helper, for **IoT** projects and **standalone** applications.

With this module, you can run arbitrary _Node.js_ code from the client, from any browser, and *without* needing [electron](https://www.electronjs.org/).


## 📣 Announcement

Looking for a lighter, faster, much safer, yet slightly more limited alternative? Try **[proxied-node](https://github.com/WebReflection/proxied-node#readme)** out instead.


### Community

Please ask questions in the [dedicated forum](https://webreflection.boards.net/) to help the community around this project grow ♥

---

## Getting Started

Considering the following `app.js` file content:

```js
const {PORT = 3000} = process.env;

const express = require('express');
const electroff = require('electroff');

const app = express();
app.use(electroff);
app.use(express.static(`${__dirname}/public`));
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
```

The `public/index.html` folder can contain something like this:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Electroff Basic Test</title>
  <script type="module">
  // use <script src="electroff"> instead for a global utility
  import CommonJS from '/electroff?module';

  // pass an asynchronous callback to electroff
  // it will be invoked instantly with few helpers
  CommonJS(async ({require}) => {
    const {arch, cpus, freemem} = require('os');
    document.body.innerHTML = `
      <h1>${document.title}</h1>
      <h2> CPUs: ${await cpus().length} </h2>
      <h2> Architecture: ${await arch()} </h2>
      <h2> Free memory: ${await freemem()} </h2>
    `;
  });
  </script>
</head>
</html>
```


### Helpers passed as callback object / API

  * `require`, usable to require any module or file, same as you would do in _CommonJS_
  * `global`, usable to share a mirrored state across multiple `electroff(...)` calls <sup><sub>(but not shared across multiple clients)</sub></sup>
  * `remove`, usable to remove instances when these are not available anymore <sup><sub>(a _WeakRef_ implementation is coming soon)</sub></sup>
  * `__dirname`, which points at the _Node.js_ path that is currently running the module
  * `until`, usable to `await` emitters events on the client-side <sup><sub>(read more in F.A.Q.)</sub></sup>



## F.A.Q.

<details>
  <summary><strong>How does it work?</strong></summary>
  <div>

The _JS_ on the page is exactly like any regular _JS_, but anything referencing _Node.js_ environment, through any `require(...)`, is executed on a shared *sandbox* in _Node.js_, where each user gets its own *global* namespace a part.

Such *sandbox* is in charge of executing code from the client, but only when the client *await* some value.

```js
const {debug} = require('process').features;
console.log('debug is', await debug);

const {join} = require('path');
const {readFile} = require('fs').promises;
const content = await readFile(join(__dirname, 'public', 'index.html'));
console.log(content);
```

**In depth**: every time we `await something` in _JS_, an implicit lookup for the `.then(...)` method is performed, and that's when *electroff* can perform a fancy client/server asynchronous interaction, through all the paths reached through the various references, which are nothing more than _Proxies_ with special abilities.

In few words, the following code:
```js
await require('fs').promises.readFile('file.txt');
```

would evaluated, within the _vm_ sandbox, the following code:
```js
await require("fs").promises.readFile.apply(
  require("fs").promises,
  ["test.txt"]
)
```

All operations are inevitably repeated because every single `.property` access, `.method(...)` invoke, or even `new module.Thing(...)`, is a branch of the code a part.

### The foreign vs local scope

It is important to keep in mind that there is a huge difference between _foreign_ code, and _scoped_ code, where _foreign_ code cannot reach _scoped_ code, and vive-versa.
```js
electroff(async ({require}) => {
  // local scope code
  const num = Math.random();

  // foreign code (needs to be awaited)
  const {EventEmitter} = require('events');
  const ee = await new EventEmitter;
  await ee.on('stuff', async function (value) {
    // nothing in this scope can reach
    // `num`, as example, is not accessible
    // and neither is `ee` ... but `this` works fine
    console.log(this);
    // this log will be on the Node.js site, it won't log
    // anything on the browser
    console.log('stuff', value);
  });

  // DOM listeners should be async if these need to signal
  // or interact with the foreign code because ...
  someButtom.addEventListener('click', async () => {
    // ... foreign code always need to be awaited!
    await ee.emit('stuff', 123);
  });
});
```

  </div>
</details>

<details>
  <summary><strong>Is it safe?</strong></summary>
  <div>

Theoretically, this is either "_as safe as_", or "_as unsafe as_", _electron_ can be, but technically, the whole idea behind is based on client side code evaluation through a shared [vm](https://nodejs.org/api/vm.html) and always the [same context](https://nodejs.org/api/vm.html#vm_script_runincontext_contextifiedobject_options) per each client, although ensuring a "_share nothing_" `global` object per each context, so that multiple clients, with multiple instances/invokes, won't interfere with each other, given the same script on the page.

If the `ELECTROFF_ONCE=1` environment variable is present, *electroff* will increase security in the following way:

  * a client can use *electroff* only via `import electroff from '/electroff?module'`, and any attempt to retrieve the electroff script in a different way will fail
  * previous point ensures that the module can be executed *only once*, so there's one single room/window in the page to define its behavior, anot nothing else can interfeer with the server side *vm*
  * using *CSP* would also work so that only known code on the page can safely run, and there's no `eval` nor `Function` call in here, so that nothing else can be injected

Regardless of the `ELECTROFF_ONCE=1` security guard though, please **bear in mind** that even if the whole communication channel is somehow based on very hard to guess unique random _IDs_ per client, this project/module is **not suitable for websites**, but it can be used in any _IoT_ related project, kiosk, or standalone applications, where we are sure there is no malicious code running arbitrary _JS_ on our machines, which is not always the case for online Web pages.

  </div>
</details>

<details>
  <summary><strong>Are Node.js instances possible?</strong></summary>
  <div>

Yes, but there are at least two things to keep in mind:

  * any _Node.js_ instance *should* be _awaited_ on creation, i.e.: `const instance = await new require('events').EventEmitter;`, unless we're waiting for a specific listener, in which case it's better to await `until(thing).is('ready')` (see next F.A.Q.)
  * there is currently no way to automatically free the _vm_ from previously created instances, if not by explicitly using `remove(instance)`

Last point means the _vm_ memory related to any client would be freed *only* once the client refreshes the page, or closes the tab, but there's the possibility that the client crashes or has no network all of a sudden, and in such case the _vm_ will trash any reference automatically, in about 5 minutes or more.

  </div>
</details>

<details>
  <summary><strong>How to react to/until Node.js events?</strong></summary>
  <div>

The `until` utility keeps the _POST_ request hanging *until* the observed event is triggered _once_. It pollutes the _emitter_, if not polluted already, with an `is(eventName)` that returns a promise resolved once the event name happens.

Following an example of how this could work in practice.

```js
CommonJS(async ({require, until}) => {
  const five = require('johnny-five');

  // no need to await here, or ready could
  // be fired before the next request is performed
  const board = new five.Board();

  // simply await everything at once in here
  await until(board).is('ready');

  // now all board dependent instances can be awaited
  const led = await new five.Led(13);
  // so that it's possible to await each method/invoke/property
  await led.blink(500);

  document.body.textContent = `it's blinking!`;
});
```

  </div>
</details>

<details>
  <summary><strong>Any best practice?</strong></summary>
  <div>

At this early stage, I can recommend only few best-practices I've noticed while playing around with this module:

  * don't _overdo_ server side instances/references, try to reach *only* the utilities you need the most, instead of creating everything on the _vm_ side
  * when a server side reference *method* is invoked, you *must await* it, i.e. `await emitter.setMaxListeners(20)`. This grants next time you `await emitter.getMaxListeners()` you'll receive the answer you expect
  * template literals are passed as plain arrays. If your library optimizes on template literals uniqueness, it will always re-parse/re-do any dance, because the array on the server side will be always a different one. Create a file that queries the DB, and simply `require("./db-helper")` instead of writing all SQL queries on the client side, and use _Node.js_ regular helpers/files whenever it works
  * try to keep `global` references to a minimum amount, as the back and forward dance is quite expensive, and most of the time you won't need it
  * if any needed instance has an emit once ready, `const instance = new Thing; await until(instance).is('ready')` instead of `const instance = await new Thing; await instance.once('ready', doThing)`, so you ensure your instance is ready within the client side scope, instead of needing a foreign callback that cannot reach such scope

  </div>
</details>

<details>
  <summary><strong>What about performance?</strong></summary>
  <div>

The _JS_ that runs on the browsers is as fast as it can get, but every _Node.js_ handled setter, getter, or method invoke, will pass through a _POST_ request, with some _vm_ evaluation, recursive-capable serving and parsing, and eventually a result on the client.

This won't exactly be high performance but, for what I could try, performance is *good enough*, for most _IoT_ or standalone application.

  </div>
</details>

<details>
  <summary><strong>What kind of data can be exchanged?</strong></summary>
  <div>

Any *JSON* serializable data, with the nice touch that [flatted](https://github.com/WebReflection/flatted#readme) gives to responses objects, where even circular references can be returned to the client.

**However**, you cannot send circular references to the server, *but* you can send *callbacks* that will be passed along as string to evaluate, meaning any surrounding closure variable won't be accessible once on the server so ... be careful when passing callbacks around.

**On Node.js side** though, be sure you use _promisify_ or any already promisified version of its API, as utilities with callbacks can't be awaited, hence will likely throw errors, unless these are needed to operate exclusively on the _Node.js_ side.

  </div>
</details>

<details>
  <summary><strong>How is this different from electron?</strong></summary>
  <div>

_electron_ is an awesome project, and I love it with all my heart ♥

However, it has its own caveats:

  * _electron_ itself is a huge dependency, and there are multiple versions, where different apps might use/need different versions, so its size is exponential, and it doesn't play too well with the fast pace _Node.js_ and its modules ecosystem get updated
  * _electron_ uses modules that are not the same one used in _Node.js_. If we update a module in the system, _electron_ might still use its own version of such module
  * _electron_ doesn't work cross browser, because it brings its own browser itself. This is both great, for application reliability across platforms, and bad, for platforms where there is already a better browser, and all it's missing is the ability to seamlessly interact with the system version of _Node.js_. As example, the best browser for _IoT_ devices is [WPE WebKit](https://wpewebkit.org/), and not _Chrome/ium_, because _WPE WebKit_ offers Hardware Acceleration, with a minimal footprint, and great performance for embedded solutions
  * _electron_ cannot serve multiple clients, as each client would need an instance of the same _electron_ app. This module provides the ability, for any reasonably modern browser, to perform _Node.js_ operations through the Web, meaning that you don't need anyone to install _electron_, as everything is already working/available through this module to the masses

  </div>
</details>

<details>
  <summary><strong>Is this ready for production?</strong></summary>
  <div>

This module is currently in its early development stage, and there are at least two main concerns regarding it:

  * the `remove(...)` utility requires user-land care, 'cause if it's not performed, the _vm_ behind the scene could retain in RAM references "_forever_", or at least up to the time the associated _UID_ to each client gets purged (once every 5 minutes)
  * the purge mechanism is based on requests: no requests whatsoever in 5 minutes, nothing gets purged

This means we can use this project in _IoT_ or standalone projects, as long as its constrains are clear, and user being redirected to a fake 404 page that requires them to reload is acceptable.

  </div>
</details>

<details>
  <summary><strong>Which browser is compatible?</strong></summary>
  <div>

All evergreen browsers should work just fine, but these are the requirements for this module to work on the client:

  * `async/await` [native capability](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function#Browser_compatibility) 
  * `fetch` [native API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API#Browser_compatibility)
  * `navigator.sendBeacon` [native method](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon#Browser_compatibility)

  </div>
</details>

<details>
  <summary><strong>How to debug?</strong></summary>
  <div>

If there is a `DEBUG=1` or a `DEBUG=true` environment variable, a lot of helpful details are logged in the terminal, either via `console.log`, or via `console.error`, when something has been caught as an error.

  </div>
</details>


## Examples

  * [Raspberri Pi + oled](./examples/oled/README.md), write on the RPi oled screen from any browser
