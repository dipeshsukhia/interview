## JavaScript

### What are JavaScript’s data types?
JavaScript has seven primitive types: `undefined`, `null`, `boolean`, `number`, `bigint`, `string`, and `symbol`. All other values are objects; functions are callable objects. Primitives are immutable values, while objects can hold mutable properties.

### What is a closure in JavaScript?
A closure is a function together with access to the lexical variables from the scope where it was created. It lets inner functions retain data after the outer function has returned, which is useful for callbacks and private state.

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

### How do you handle asynchronous operations in JavaScript?
Use Promises and `async`/`await` for most asynchronous work. Handle failures with `try`/`catch`, and use `Promise.all` when independent operations can run concurrently. Callbacks are still used by some APIs, and can be wrapped in Promises when needed.

```js
async function loadUser(id) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
```

### What is the difference between == and ===?
`==` compares after applying type coercion rules; `===` compares without converting operand types. Strict equality is easier to reason about and is the usual choice. `== null` is a deliberate shorthand that matches either `null` or `undefined`, but should be used only when that behavior is intended.

```js
2 == '2';  // true
2 === '2'; // false
```

### What is a prototype in JavaScript?
A prototype is an object from which another object can inherit properties and methods. Property lookup follows the prototype chain. JavaScript classes provide syntax over this prototype-based model; use composition and clear APIs instead of modifying built-in prototypes.

### What do bind, call, and apply do?
They set the `this` value for a function. `call` invokes it immediately with positional arguments; `apply` invokes it with an array-like argument list; `bind` returns a new function with `this` (and optionally leading arguments) fixed for a later call.

```js
function greet(greeting, name) {
  return `${greeting}, ${name}!`;
}

greet.call({ label: 'ignored' }, 'Hello', 'Mina');
greet.apply(null, ['Hello', 'Mina']);
const greetMina = greet.bind(null, 'Hello');
greetMina('Mina');
```
