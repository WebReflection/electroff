# electroff

<sup>**Social Media Photo by [Thais Ribeiro](https://unsplash.com/@thaisribeir_) on [Unsplash](https://unsplash.com/)**</sup>

A cross browser, electron-less helper, for **IoT** projects and **standalone** applications.

With this module, you can run arbitrary _Node.js_ code from the client, from any browser, and *without* needing [electron](https://www.electronjs.org/).


#### Previous Work / Alternatives

  * **[workway](https://github.com/WebReflection/workway#readme)**: the **safest way** to do this. The server explicitly enables things that should be usable from the client
  * **[trojan-horse](https://github.com/WebReflection/trojan-horse#readme)**: an early, and awkward, take on this approach <sup><sub>(it's ugly, but it *kinda* works, and it's *kinda* safer too)</sub></sup>



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
  <script src="electroff">/* it must be the first script */</script>
  <script>
  // whenever it's convenient
  addEventListener('DOMContentLoaded', () => {
    // pass an asynchronous callback to electroff
    // it will be invoked instantly with few helpers
    electroff(async ({require, __dirname}) => {
      const {arch, cpus, freemem} = require('os');
      const CPUs = await cpus();
      document.body.innerHTML = `
        <h1>${document.title}</h1>
        <h2> CPUs: ${CPUs.length} </h2>
        <h2> Architecture: ${await arch()} </h2>
        <h2> Free memory: ${await freemem()} </h2>
      `;
    });
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
const chunk = require('fs').promises.readFile('test.txt').slice(0, 1);
await chunk;
```

Would carry all information needed to execute all those operations at once, but only once any of its intermediate, or final result, is *awaited*.

  </div>
</details>

<details>
  <summary><strong>Is it safe?</strong></summary>
  <div>

Theoretically, this is either "_as safe as_", or "_as unsafe as_", _electron_ can be, but technically, the whole idea behind is based on client side code evaluation through a shared [vm](https://nodejs.org/api/vm.html) and always the [same context](https://nodejs.org/api/vm.html#vm_script_runincontext_contextifiedobject_options) per each client, although ensuring a "_share nothing_" `global` object per each context, so that multiple clients, with multiple instances/invokes, won't interfere with each other, given the same script on the page.

**⚠ Bear in mind** that even if the whole communication channel is somehow based on very hard to guess unique random _IDs_ per client, this project/module is **not suitable for websites**, but it can be used in any _IoT_ related project, or standalone applications, where we are sure there is no malicious code running arbitrary _JS_ on our machines, which is not always the case for online Web pages.

  </div>
</details>

<details>
  <summary><strong>Are Node.js instances possible?</strong></summary>
  <div>

Yes, but there are at least two things to keep in mind:

  * any _Node.js_ instance **must** be _awaited_ on creation, i.e.: `const instance = await new require('events').EventEmitter;`
  * there is currently no way to automatically free the _vm_ from previously created instances, if not by explicitly using `remove(instance)`

Last point means the _vm_ memory related to any client would be freed *only* once the client refreshes the page, or closes the tab, but there's the possibility that the client crashes or has no network all of a sudden, and in such case the _vm_ will trash any reference automatically, in about 5 minutes or more.

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
  * the purge mechanism is based on requests: no requests whatsoever in 5 minutes, nothing gets purged. On the other hand, a device that switches off and suddenly resumes the page, would find all its previously created _Node.js_ instances undefined, so this could break too

However, the latter situation is likely an edge case, and I might implement a hard client-side refresh, when such situation happens ... but the _TL;DR_ version of this _F.A.Q._ is that this is not an issue, until it is.

That means we can use this project in production, as long as its constrains are clear, and a user throwing errors at some point, after 5 minutes not interacting with the app, are an issue at all.

  </div>
</details>
