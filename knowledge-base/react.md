## React

### What is React, and why is it used?
React is a JavaScript library for building user interfaces from reusable components. It models the UI as a function of props and state, then updates the DOM when that data changes. Its component model, ecosystem, and declarative rendering help teams build interactive interfaces; the virtual DOM is an implementation detail, not a guarantee that every React update is automatically faster.
```jsx
function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>;
}

<Greeting name="Ada" />
```

### What is JSX?
JSX is syntax that lets you describe UI with markup-like expressions inside JavaScript. A build tool transforms it into React element calls. JSX uses JavaScript expressions in braces and React conventions such as `className`.

```jsx
const element = <h1>Hello, {name}!</h1>;
```

### How do function components differ from class components?
A function component is a JavaScript function that returns React elements and can use hooks for state, effects, and other React features. A class component extends `React.Component` and uses lifecycle methods and `this.state`. Function components are preferred in most new code, while class components remain supported and may exist in older applications.
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

```jsx
function Welcome({ name }) {
  return <h1>Hello, {name}!</h1>;
}

<Welcome name="Ada" />
```

### What is the purpose of the key prop in React?
A key gives each element in a rendered list a stable identity. React uses keys to match items between renders and preserve or update the correct component state. Prefer a unique ID from the data; array indexes can cause incorrect reuse when items are inserted, removed, or reordered.

```jsx
<ul>{users.map((user) => <li key={user.id}>{user.name}</li>)}</ul>
```

### How do useEffect and useLayoutEffect differ?
`useEffect` runs after React commits changes and generally after the browser paints, so it suits subscriptions, network requests, and other side effects. `useLayoutEffect` runs synchronously after DOM updates but before paint; use it when you must measure or adjust layout without showing a flicker. Because it can block painting, prefer `useEffect` when layout timing is not required.

```jsx
useLayoutEffect(() => {
  setWidth(ref.current.getBoundingClientRect().width);
}, []);
```

### How does React batch state updates?
React groups multiple state updates into one render when possible. React 18 with `createRoot` also batches updates from promises, timers, and native event handlers. When the next value depends on the previous one, use an updater function so queued updates compose correctly.

```jsx
setCount((count) => count + 1);
setCount((count) => count + 1); // Adds two in one event.
```

### What are controlled and uncontrolled components?
A controlled form input gets its current value from React state and reports changes through an event handler. An uncontrolled input keeps its value in the DOM and is read through a ref or `FormData` when needed. Controlled fields are useful for live validation and coordinated UI; uncontrolled fields can be simpler for basic forms.

```jsx
import { useState } from 'react';

const [email, setEmail] = useState('');
<input value={email} onChange={(event) => setEmail(event.target.value)} />
```

### How do props and state differ?
Props are inputs supplied by a parent; state is data a component owns and updates over time. Both affect rendering. Treat props as read-only and update state with its setter rather than mutating it directly.
```jsx
function LikeButton({ initialLikes }) {
  const [likes, setLikes] = useState(initialLikes);
  return <button onClick={() => setLikes((count) => count + 1)}>Likes: {likes}</button>;
}

<LikeButton initialLikes={3} />
```

### How do you handle a form with multiple input fields?
Keep the field values in state, give each input a `name`, and update the matching property from the change event. For larger forms, a form library or a reducer can centralize validation and submission behavior.

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
```jsx
function TodoList({ todos }) {
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

### What is code splitting, and how do you use it in React?
Code splitting divides the JavaScript bundle so the browser can load a feature when it is needed. `React.lazy` with `Suspense` is a common way to load a component on demand; bundlers create a separate chunk for the dynamic import.

```jsx
import { lazy, Suspense } from 'react';

const Settings = lazy(() => import('./Settings'));

function App() {
  return <Suspense fallback={<p>Loading settings…</p>}><Settings /></Suspense>;
}
```

### What are React refs, and how can they integrate third-party libraries?
A ref stores a mutable value across renders without causing a re-render. Refs are appropriate for DOM access, focus management, and integrating imperative libraries. Initialize the library after the DOM node exists and clean it up when the component unmounts.

```jsx
const canvasRef = useRef(null);

useEffect(() => {
  const chart = createChart(canvasRef.current);
  return () => chart.destroy();
}, []);
```

### What are Suspense and concurrent rendering in React?
`Suspense` shows a fallback while a child is waiting on a supported asynchronous resource, such as a component loaded with `lazy`. It does not automatically make every data-fetching promise suspend; data frameworks must integrate with Suspense. Concurrent rendering lets React prepare, pause, or reprioritize render work so urgent interactions can stay responsive; it is coordinated by React rather than manually controlling DOM updates.
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
