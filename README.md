# loop-visualizer

A tool to help you visualize iteration in your code. Keep track of the current iteration, see the state of variables, and what conditional branches are executed.

Write JavaScript against an array, then step through it forwards and backwards, one loop iteration or one line at a time. It's built for working through LeetCode-style array problems: two pointers, nested loops, sorting and searching.

**Live app:** https://www.loopvisualizer.com

## Quick start

To run it locally instead:

Requires Node.js 20+.

```sh
git clone https://github.com/errpoulos/loop-visualizer.git
cd loop-visualizer
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Usage guide

### 1. Enter an array

Type into the **Array** box. These forms all work:

```
[2, 7, 11, 15]
2, 7, 11, 15
["a", "b", "c"]
```

Only flat arrays are supported. The array is available in your code as `arr`. Your code gets a copy, so the input box never changes.

### 2. Write code

The **Code** editor is real JavaScript and runs in strict mode. A typical starting point:

```js
const n = arr.length;
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    // your code here
  }
}
```

- Use any JS: `if`/`else`, `while`, `do`/`while`, `for...of`, functions, recursion, `Map`/`Set`, destructuring swaps.
- `return` a value to see it in the **Output** panel at the end.
- `console.log(...)` output appears in the **Output** panel, up to the step you're on.
- The code re-runs a moment after you stop typing.

### 3. Or build loops with the form

The **Loops** panel and the code stay in sync. Change either one and the other updates.

| Control | What it does |
| --- | --- |
| Direction | `forward ++` or `reverse --`. Switching fills in sensible defaults (`j = i + 1; j < n` forward, `j = n - 1; j > i` reverse). |
| start / end | Any JS expression, e.g. `0`, `n - 1`, `i + 1`, `Math.floor(n / 2)`. Can use outer loop variables. |
| Comparison | `<` / `<=` for forward loops, `>` / `>=` for reverse loops. |
| + Add nested loop | Wraps the innermost loop's body in a new loop (up to 3 deep from the form). |
| ✕ | Removes the innermost loop and keeps its body. |

The form edits the chain of nested `for` loops, starting with the first one in your code. A loop that isn't a simple `for (let v = start; v < end; v++)` (for example `for (let i = 0, j = n - 1; i < j; i++, j--)`) shows as read-only. Edit it in the code instead.

### 4. Step through it

| Control | Keyboard |
| --- | --- |
| ⏮ First step | `Home` |
| ◀ Previous step | `←` |
| ▶ / ⏸ Play / pause | `Space` |
| ▶\| Next step | `→` |
| ⏭ Last step | `End` |
| Slider | Drag to jump to any step |
| Speed | Playback delay per step |

Keyboard shortcuts work when focus isn't in the editor or a form field. Click an empty part of the page first.

**Step by:**

- **loop iteration**: one step each time any loop starts a new iteration. Good for watching indices move.
- **every line**: one step before each statement runs, like a debugger. Good for watching a loop body work.

Switching modes keeps your place.

### 5. Read the views

**Code**: the line about to run is highlighted. Amber means a loop was skipped because its condition was false on entry (e.g. `j = i + 1` when `i` is the last index). Red marks the line where an error happened.

**Array**
- Each variable used as an index (`arr[i]`, `arr[left]`, `arr[mid]`) gets a colored pointer. For-loop variables are always pointers.
- The pointer for the loop that just advanced (or the variable that just changed) is bold. The others are dimmed.
- An index past either end of the array shows as a red dashed cell: an off-by-one in action.
- Cells your code just changed flash amber, so swaps and writes are easy to spot.

**Variables**
- Every variable in scope at this step, with its value and `arr[name]` for index variables.
- Rows that changed since the previous step are highlighted.

**Branches since last step**: every `if` and ternary (`a ? b : c`) condition evaluated since the previous step:

| line | condition | evaluated | branch |
| --- | --- | --- | --- |
| 4 | `if (arr[j] > arr[j + 1])` | `5 > 2` **true** | then → line 5 |
| 4 | `if (arr[j] > arr[j + 1])` | `2 > 4` **false** | else → line 7 |

- For a comparison, both sides show with their actual values.
- If the condition ran several times between steps (common in "loop iteration" mode), you see the latest result plus a count, e.g. `(×4: 3 true, 1 false)`.
- `false` with no `else` shows as "no branch (skipped)".

**Output**: `console.log` lines up to the current step, then `↩ returned …` or `✓ finished` at the end.

### Examples to try

Brute-force two sum (array `[2, 7, 11, 15]`):

```js
const target = 9;
const n = arr.length;
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    if (arr[i] + arr[j] === target) return [i, j];
  }
}
return [];
```

Two pointers: reverse in place (array `[1, 2, 3, 4, 5]`):

```js
let left = 0;
let right = arr.length - 1;
while (left < right) {
  [arr[left], arr[right]] = [arr[right], arr[left]];
  left++;
  right--;
}
return arr;
```

Bubble sort (array `[5, 1, 4, 2, 8]`):

```js
const n = arr.length;
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n - i - 1; j++) {
    if (arr[j] > arr[j + 1]) {
      [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
    } else {
      console.log('in order', j);
    }
  }
}
return arr;
```

Binary search (array `[1, 3, 5, 7, 9, 11]`):

```js
const target = 7;
let lo = 0;
let hi = arr.length - 1;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  if (arr[mid] === target) return mid;
  else if (arr[mid] < target) lo = mid + 1;
  else hi = mid - 1;
}
return -1;
```

### Tips and limits

- **LeetCode function signatures**: a pasted `var twoSum = function (nums, target) { ... }` only defines the function. Add a call such as `return twoSum(arr, 9);` at the end.
- **Infinite loops** are stopped after 10,000 steps with a warning.
- **Not tracked as branches**: `switch` cases, `&&` / `||` short-circuits, and `while` / `for` conditions. For `if (a > b && c)` you see the overall result, not each piece.
- **Heavy built-ins**: your code runs in the page. Loops are capped, but a single huge built-in call (e.g. `new Array(1e9).fill(0)`) can still freeze the tab.
- Your last array, code and step mode are saved in the browser's localStorage.

## Development

```sh
npm test          # unit tests (Vitest)
npm run lint      # Oxlint
npm run build     # production build in dist/
npm start         # serve dist/ on $PORT (default 3000), as on Heroku
```

### How it works

1. `src/lib/instrument.js` parses your code with [acorn](https://github.com/acornjs/acorn) and inserts hooks into the source text (insertions only, so line numbers stay the same):
   - before every statement
   - at the top of every loop iteration
   - after every loop
   - around every `if`/ternary condition
   
   Each hook snapshots the variables in scope at that point.
2. `src/lib/runCode.js` runs the instrumented code with `new Function` in strict mode against a copy of the array. It records a frame per hook, plus `console` output, branch evaluations, the return value and any error.
3. The UI precomputes all frames, so stepping backwards is as cheap as stepping forwards.
4. `src/lib/loopSync.js` keeps the loop form and the code in sync by rewriting only the affected `for (...)` header.

```
src/
  App.jsx                 state, stepping, keyboard shortcuts
  components/
    ArrayInput.jsx        array text box
    ArrayView.jsx         cells, pointers, changed-cell flash
    CodeEditor.jsx        CodeMirror editor with step/error line highlights
    Controls.jsx          step buttons, scrubber, step mode, speed
    LoopConfig.jsx        loop form
    OutputPanel.jsx       console output and return value
    VarsPanel.jsx         variables and branches tables
  lib/
    instrument.js         code instrumentation
    runCode.js            runs instrumented code, records frames
    loopSync.js           form <-> code loop sync
    parseArray.js         array input parsing
```

## License

[GPL-3.0](LICENSE)
