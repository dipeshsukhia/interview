## JavaScript

### What are JavaScript’s data types?
JavaScript has seven primitive types: `undefined`, `null`, `boolean`, `number`, `bigint`, `string`, and `symbol`. All other values are objects; functions are callable objects. Primitives are immutable values, while objects can hold mutable properties.

A common pitfall is that `typeof null` returns `"object"` for historical reasons; test null directly with `value === null`.

- Arrays and dates are objects too, so use `Array.isArray()` or `instanceof Date` when you need to distinguish them.
- `Number.isNaN()` is more reliable than loose coercion checks.

```js
const values = [undefined, null, true, 42, 10n, "hello", Symbol("id"), { active: true }];
console.log(values.map((value) => typeof value));
```

### What is a closure in JavaScript?
A closure is a function together with access to the lexical variables from the scope where it was created. It lets inner functions retain data after the outer function has returned, which is useful for callbacks and private state.


Closures capture variable bindings from their lexical scope, not a frozen copy of each value.

- This makes them useful for factories, event handlers, and module-private state, but long-lived callbacks can also keep referenced objects in memory.
- Be deliberate about what a callback retains and remove event listeners when appropriate.

```js
function makeCounter() {
  let count = 0;
  return () => ++count;
}

const next = makeCounter();
next(); // 1
next(); // 2
```

### How do let and var differ?
`let` is block-scoped and cannot be redeclared in the same scope; it can be reassigned. `var` is function-scoped, is hoisted with an initial value of `undefined`, and can be redeclared, which can produce surprising behavior. Prefer `const` by default, then `let` when reassignment is needed.

`let` and `const` are scoped to the nearest block and remain in a temporal dead zone until their declaration executes.

- `var` is scoped to the containing function, which can make loop callbacks observe unexpected values.
- Use `const` for bindings that are not reassigned; it does not make referenced objects immutable.

```js
if (true) {
  let blockScoped = "inside";
  var functionScoped = "still visible outside this block";
}
console.log(functionScoped);
// blockScoped is not defined here.
```

### How do you handle asynchronous operations in JavaScript?
Use Promises and `async`/`await` for most asynchronous work. Handle failures with `try`/`catch`, and use `Promise.all` when independent operations can run concurrently. Callbacks are still used by some APIs, and can be wrapped in Promises when needed.


An `async` function always returns a Promise, and `await` pauses that function without blocking the JavaScript thread.

- Check HTTP response status because `fetch()` does not reject for ordinary 4xx or 5xx responses.
- Use `Promise.allSettled()` when every independent result should be collected even if some operations fail.

```js
async function loadUser(id) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
```

### What is the difference between == and ===?
`==` compares after applying type coercion rules; `===` compares without converting operand types. Strict equality is easier to reason about and is the usual choice. `== null` is a deliberate shorthand that matches either `null` or `undefined`, but should be used only when that behavior is intended.


Strict equality avoids implicit conversions such as numeric strings becoming numbers, reducing surprising branches.

- For objects and arrays, both operators compare identity rather than deep contents.
- If two separately created objects have equal fields, compare the fields or use a deliberate deep-equality strategy instead of expecting `===` to match.

```js
2 == '2';  // true
2 === '2'; // false
```

### What is a prototype in JavaScript?
A prototype is an object from which another object can inherit properties and methods. Property lookup follows the prototype chain. JavaScript classes provide syntax over this prototype-based model; use composition and clear APIs instead of modifying built-in prototypes.

When a property is not found on an object itself, JavaScript follows its prototype chain until it finds the property or reaches `null`.

- This supports shared methods without copying them onto every instance.
- `Object.create()` and class syntax can establish inheritance, but composition is often simpler for combining unrelated behaviors.

```js
const animal = { speak() { return "sound"; } };
const dog = Object.create(animal);
dog.speak(); // inherited through the prototype chain
```

### What do bind, call, and apply do?
They set the `this` value for a function. `call` invokes it immediately with positional arguments; `apply` invokes it with an array-like argument list; `bind` returns a new function with `this` (and optionally leading arguments) fixed for a later call.


These methods are useful when a function depends on a specific `this` value, such as borrowing a method for another object or adapting a callback API.

- Arrow functions capture `this` lexically and cannot have it replaced by `call`, `apply`, or `bind`.
- Avoid binding repeatedly inside hot render paths when a stable callback is needed.

```js
function greet(greeting, name) {
  return `${greeting}, ${name}!`;
}

greet.call({ label: 'ignored' }, 'Hello', 'Mina');
greet.apply(null, ['Hello', 'Mina']);
const greetMina = greet.bind(null, 'Hello');
greetMina('Mina');
```
