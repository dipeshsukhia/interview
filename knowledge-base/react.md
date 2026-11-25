## React

### What is React, and why is it used?
React is a JavaScript library for building user interfaces from reusable components. It models the UI as a function of props and state, then updates the DOM when that data changes. Its component model, ecosystem, and declarative rendering help teams build interactive interfaces; the virtual DOM is an implementation detail, not a guarantee that every React update is automatically faster.

Components can be composed into larger interfaces and reused with different props, while state represents data that changes over time.

- React’s declarative model lets developers describe the desired UI rather than manually synchronizing every DOM mutation.
- It does not provide every application concern—routing, server rendering, and data fetching usually come from additional tools.

```jsx
function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>;
}

<Greeting name="Ada" />
```

### What is JSX?
JSX is syntax that lets you describe UI with markup-like expressions inside JavaScript. A build tool transforms it into React element calls. JSX uses JavaScript expressions in braces and React conventions such as `className`.


JSX is compiled syntax, not HTML embedded directly in the browser, and expressions inside braces must evaluate to JavaScript values.

- A component name beginning with a capital letter is treated as a component, while lowercase tags represent built-in elements.
- JSX also requires escaping rules and accessibility attributes appropriate to the rendered HTML.

```jsx
const element = <h1>Hello, {name}!</h1>;
```

### How do function components differ from class components?
A function component is a JavaScript function that returns React elements and can use hooks for state, effects, and other React features. A class component extends `React.Component` and uses lifecycle methods and `this.state`. Function components are preferred in most new code, while class components remain supported and may exist in older applications.

Hooks must be called in the same order on every render and only from React components or custom hooks. Classes still support lifecycle methods and are useful to understand when maintaining older code, but new code generally uses functions because hooks allow stateful behavior to be extracted and shared without inheritance.

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>{count}</button>;
}

class LegacyCounter extends React.Component {
  state = { count: 0 };
  render() { return <button onClick={() => this.setState(({ count }) => ({ count: count + 1 }))}>{this.state.count}</button>; }
}
```

### What are props in React?
Props are read-only inputs passed from a parent component to a child. They let a parent configure a reusable component; the child should not mutate them. To change displayed data, the parent changes the prop or the component manages its own state.


Props form a component’s public input contract and can contain primitives, objects, callbacks, or React nodes.

- A child should call a callback supplied by its parent when it needs to request a change.
- Avoid copying props into state unless the component intentionally needs an independent initial value, because copied values can drift out of sync.

```jsx
function Welcome({ name }) {
  return <h1>Hello, {name}!</h1>;
}

<Welcome name="Ada" />
```

### What is the purpose of the key prop in React?
A key gives each element in a rendered list a stable identity. React uses keys to match items between renders and preserve or update the correct component state. Prefer a unique ID from the data; array indexes can cause incorrect reuse when items are inserted, removed, or reordered.


Keys are only used by React during reconciliation and are not passed to the component as a normal prop.

- If a component needs the identifier, pass it separately.
- Avoid generating random keys during render because that makes React treat every item as new, resetting local state and causing unnecessary DOM work.

```jsx
<ul>{users.map((user) => <li key={user.id}>{user.name}</li>)}</ul>
```

### How do useEffect and useLayoutEffect differ?
`useEffect` runs after React commits changes and generally after the browser paints, so it suits subscriptions, network requests, and other side effects. `useLayoutEffect` runs synchronously after DOM updates but before paint; use it when you must measure or adjust layout without showing a flicker. Because it can block painting, prefer `useEffect` when layout timing is not required.


Effects should describe synchronization with an external system and include every reactive value they use in the dependency list.

- Cleanup runs before an effect is repeated and when the component unmounts.
- In server-rendered applications, layout effects do not run on the server, so reserve them for client-side layout work that truly must happen before paint.

```jsx
useLayoutEffect(() => {
  setWidth(ref.current.getBoundingClientRect().width);
}, []);
```

### How does React batch state updates?
React groups multiple state updates into one render when possible. React 18 with `createRoot` also batches updates from promises, timers, and native event handlers. When the next value depends on the previous one, use an updater function so queued updates compose correctly.


React batches updates to avoid rendering once for every setter call in an event.

- If the next state depends on the prior state, a functional updater is important because multiple updates may be queued before the component renders again.
- State setters do not mutate the current render’s variable; they schedule a future render.

```jsx
setCount((count) => count + 1);
setCount((count) => count + 1); // Adds two in one event.
```

### What are controlled and uncontrolled components?
A controlled form input gets its current value from React state and reports changes through an event handler. An uncontrolled input keeps its value in the DOM and is read through a ref or `FormData` when needed. Controlled fields are useful for live validation and coordinated UI; uncontrolled fields can be simpler for basic forms.


Controlled inputs make React state the source of truth, which makes validation and conditional UI straightforward but requires handling each change.

- Uncontrolled inputs can reduce state wiring and integrate naturally with native form submission.
- Choose one approach deliberately per field and avoid switching an input between controlled and uncontrolled during its lifetime.

```jsx
import { useState } from 'react';

const [email, setEmail] = useState('');
<input value={email} onChange={(event) => setEmail(event.target.value)} />
```

### How do props and state differ?
Props are inputs supplied by a parent; state is data a component owns and updates over time. Both affect rendering. Treat props as read-only and update state with its setter rather than mutating it directly.

Both are immutable snapshots for a given render, but they have different owners: a parent supplies props, while a component schedules state updates.

- State should be lifted to the closest common owner when sibling components need to coordinate.
- Avoid duplicating the same value in multiple state stores unless there is a clear synchronization rule.

```jsx
function LikeButton({ initialLikes }) {
  const [likes, setLikes] = useState(initialLikes);
  return <button onClick={() => setLikes((count) => count + 1)}>Likes: {likes}</button>;
}

<LikeButton initialLikes={3} />
```

### How do you handle a form with multiple input fields?
Keep the field values in state, give each input a `name`, and update the matching property from the change event. For larger forms, a form library or a reducer can centralize validation and submission behavior.


For production forms, also define validation timing, accessible labels, error messages, submission state, and how server-side validation errors map back to fields.

- Keep values controlled when the UI must react immediately; otherwise native `FormData` can simplify basic forms.
- Do not rely on client validation alone for security or data integrity.

```jsx
import { useState } from 'react';

const [form, setForm] = useState({ name: '', email: '' });

function handleChange(event) {
  const { name, value } = event.target;
  setForm((current) => ({ ...current, [name]: value }));
}

<input name="name" value={form.name} onChange={handleChange} />
<input name="email" value={form.email} onChange={handleChange} />
```

### How does React reconciliation work?
Reconciliation is React’s process for comparing the newly returned element tree with the previous one and determining which DOM updates are needed. Element type and position help React decide whether to update or replace a subtree; keys help it match list items. Keep keys stable and avoid mutating state so the comparison reflects the intended change.

Reconciliation is an implementation process, so application code should focus on stable element types, immutable state updates, and unique keys rather than assuming exact DOM operations.

- If an element’s type changes, React generally replaces that subtree and resets its local state.
- Profile with React DevTools before adding memoization, since it has maintenance costs.

```jsx
function TodoList({ todos }) {
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

### What is code splitting, and how do you use it in React?
Code splitting divides the JavaScript bundle so the browser can load a feature when it is needed. `React.lazy` with `Suspense` is a common way to load a component on demand; bundlers create a separate chunk for the dynamic import.


A split point should align with code users do not need immediately, such as a route or rarely used editor. Too many tiny chunks add network and scheduling overhead, while a single large bundle delays startup. Provide a meaningful loading state and an error boundary for chunk-load failures.

```jsx
import { lazy, Suspense } from 'react';

const Settings = lazy(() => import('./Settings'));

function App() {
  return <Suspense fallback={<p>Loading settings…</p>}><Settings /></Suspense>;
}
```

### What are React refs, and how can they integrate third-party libraries?
A ref stores a mutable value across renders without causing a re-render. Refs are appropriate for DOM access, focus management, and integrating imperative libraries. Initialize the library after the DOM node exists and clean it up when the component unmounts.


Changing `ref.current` does not trigger a render, so refs are not a replacement for state that affects visible output.

- Use callback refs or effects to handle nodes that may appear conditionally.
- For third-party widgets, synchronize updates as props change and dispose resources during cleanup to avoid duplicate listeners or memory leaks.

```jsx
const canvasRef = useRef(null);

useEffect(() => {
  const chart = createChart(canvasRef.current);
  return () => chart.destroy();
}, []);
```

### What are Suspense and concurrent rendering in React?
`Suspense` shows a fallback while a child is waiting on a supported asynchronous resource, such as a component loaded with `lazy`. It does not automatically make every data-fetching promise suspend; data frameworks must integrate with Suspense. Concurrent rendering lets React prepare, pause, or reprioritize render work so urgent interactions can stay responsive; it is coordinated by React rather than manually controlling DOM updates.

Suspense boundaries let an application choose which portion of the interface shows a fallback, which can prevent the entire page from flashing into a loading state. Concurrent rendering is interruptible and allows React to prioritize urgent work, but render functions still need to be pure because React may start and discard render attempts.

```jsx
const Profile = lazy(() => import('./Profile'));

function App() {
  return (
    <Suspense fallback={<p>Loading profile…</p>}>
      <Profile />
    </Suspense>
  );
}
```

### How do you build a custom hook to debounce input?
A debounce hook delays publishing a value until it has stayed unchanged for a specified interval. Clear the previous timer whenever the value or delay changes, and clean it up on unmount. This reduces repeated work such as search requests while a user is typing.


Debouncing is useful when only the final value after a pause matters, such as a search query; throttling instead limits how often work runs during continuous activity.

- Keep the hook generic and debounce the value or callback according to the desired API.
- Cancel pending work on unmount, and handle stale requests when older responses may arrive later.

```jsx
import { useEffect, useState } from 'react';

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```
