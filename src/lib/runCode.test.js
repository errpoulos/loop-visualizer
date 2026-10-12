import { describe, expect, it } from 'vitest'
import { MAX_STEPS, runCode } from './runCode.js'

const iters = (result) => result.frames.filter((f) => f.kind === 'iter')

describe('runCode', () => {
  const arr = [10, 20, 30, 40]

  it('records each loop iteration with its variable', () => {
    const result = runCode('const n = arr.length;\nfor (let i = 0; i < n; i++) {\n}', arr)
    expect(result.error).toBeNull()
    expect(iters(result).map((f) => f.vars.i)).toEqual([0, 1, 2, 3])
    expect(result.loops[0]).toMatchObject({ var: 'i', level: 0, line: 2 })
    expect(result.pointerVars).toEqual(['i'])
  })

  it('handles nested loops whose bounds depend on outer vars', () => {
    const code = `const n = arr.length;
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
  }
}`
    const result = runCode(code, arr)
    const inner = iters(result).filter((f) => f.level === 1)
    expect(inner.map((f) => [f.vars.i, f.vars.j])).toEqual([[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]])
    const skip = result.frames.filter((f) => f.kind === 'skip')
    expect(skip).toHaveLength(1)
    expect(skip[0].vars.i).toBe(3)
  })

  it('runs the body and captures array mutation and locals', () => {
    const code = `let sum = 0;
for (let i = arr.length - 1; i >= 0; i--) {
  sum += arr[i];
  arr[i] = 0;
}
return sum;`
    const result = runCode(code, arr)
    expect(result.returned).toBe(100)
    const lastZeroing = result.frames.filter((f) => f.line === 4).at(-1)
    expect(lastZeroing.vars).toMatchObject({ i: 0, sum: 100, arr: [10, 0, 0, 0] })
  })

  it('supports while loops with two pointers', () => {
    const code = `let left = 0, right = arr.length - 1;
while (left < right) {
  [arr[left], arr[right]] = [arr[right], arr[left]];
  left++; right--;
}`
    const result = runCode(code, [1, 2, 3, 4, 5])
    expect(iters(result)).toHaveLength(2)
    expect(result.frames.at(-1).vars.arr).toEqual([5, 4, 3, 2, 1])
    expect(result.pointerVars).toEqual(['left', 'right'])
  })

  it('does not break non-block bodies, labels, or switch', () => {
    const code = `let hits = 0;
outer: for (let i = 0; i < 3; i++)
  for (let j = 0; j < 3; j++) {
    if (j === 1) continue outer;
    else hits++;
  }
switch (hits) { case 3: hits = 'three'; break; default: hits = 'other' }
return hits;`
    const result = runCode(code, arr)
    expect(result.error).toBeNull()
    expect(result.returned).toBe('three')
  })

  it('does not snapshot variables before they are declared', () => {
    const result = runCode('let a = 1;\nlet b = a + 1;\nreturn b;', arr)
    expect(result.frames[0].vars).toEqual({ arr })
    expect(result.frames[1].vars).toEqual({ arr, a: 1 })
    expect(result.returned).toBe(2)
  })

  it('instruments function bodies', () => {
    const code = 'function double(x) {\n  return x * 2;\n}\nreturn arr.map(double);'
    const result = runCode(code, [1, 2])
    expect(result.returned).toEqual([2, 4])
    expect(result.frames.filter((f) => f.line === 2).map((f) => f.vars.x)).toEqual([1, 2])
  })

  it('captures console.log against the current frame', () => {
    const result = runCode('for (let i = 0; i < 2; i++) {\n  console.log("i is", i, [i]);\n}', arr)
    expect(result.logs.map((l) => l.text)).toEqual(['i is 0 [0]', 'i is 1 [1]'])
    expect(result.logs[0].frame).toBe(2)
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3]
    runCode('arr[0] = 99;', input)
    expect(input).toEqual([1, 2, 3])
  })

  it('reports syntax errors with a line', () => {
    const result = runCode('let x = 1;\nfor (let i = 0; i < 3; i++ {\n}', arr)
    expect(result.error).toMatchObject({ kind: 'syntax', line: 2 })
  })

  it('reports runtime errors with the failing line', () => {
    const result = runCode('let x = 1;\nnope();', arr)
    expect(result.error).toMatchObject({ kind: 'runtime', line: 2 })
    expect(result.error.message).toContain('nope')
  })

  it('stops infinite loops', () => {
    const result = runCode('while (true) {}', arr)
    expect(result.truncated).toBe(true)
    expect(result.frames).toHaveLength(MAX_STEPS)
  })

  it('runs in strict mode so typos do not leak globals', () => {
    const result = runCode('leaked = 1;', arr)
    expect(result.error?.message).toContain('leaked')
  })
})

describe('branch tracking', () => {
  it('records which branch of an if/else-if/else ran, with comparison operands', () => {
    const code = `const out = [];
for (let i = 0; i < arr.length; i++) {
  if (arr[i] > 2) out.push('big');
  else if (arr[i] === 2) out.push('two');
  else out.push('small');
}
return out;`
    const result = runCode(code, [1, 2, 3])
    expect(result.error).toBeNull()
    expect(result.returned).toEqual(['small', 'two', 'big'])
    const summary = result.branches.map((b) => [result.conditions[b.cond].text, b.operands, b.taken])
    expect(summary).toEqual([
      ['arr[i] > 2', [1, 2], false],
      ['arr[i] === 2', [1, 2], false],
      ['arr[i] > 2', [2, 2], false],
      ['arr[i] === 2', [2, 2], true],
      ['arr[i] > 2', [3, 2], true],
    ])
    expect(result.conditions[0]).toMatchObject({ kind: 'if', line: 3, operator: '>', elseIsIf: true })
  })

  it('tags each evaluation with the frame of the if statement', () => {
    const result = runCode('let x = 1;\nif (x) {\n  x = 2;\n}', [])
    expect(result.branches).toHaveLength(1)
    expect(result.frames[result.branches[0].frame].line).toBe(2)
    expect(result.conditions[0]).toMatchObject({ operator: null, thenLine: 3, elseLine: null })
  })

  it('tracks ternaries, including nested ones, without changing results', () => {
    const code = 'const f = (a, b) => (a > b ? (a > 10 ? "huge" : "big") : "small");\nreturn [f(20, 1), f(5, 1), f(1, 5)];'
    const result = runCode(code, [])
    expect(result.returned).toEqual(['huge', 'big', 'small'])
    expect(result.branches.map((b) => `${result.conditions[b.cond].text}:${b.taken}`)).toEqual([
      'a > b:true', 'a > 10:true', 'a > b:true', 'a > 10:false', 'a > b:false',
    ])
  })

  it('keeps operands paired correctly through recursion inside a condition', () => {
    const code = `function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
if (fib(5) > fib(4)) return 'yes';
return 'no';`
    const result = runCode(code, [])
    expect(result.returned).toBe('yes')
    const outer = result.branches.at(-1)
    expect(result.conditions[outer.cond].text).toBe('fib(5) > fib(4)')
    expect(outer.operands).toEqual([5, 3])
  })

  it('does not evaluate short-circuited operands', () => {
    const result = runCode('const a = null;\nif (a && a.x > 1) return 1;\nreturn 0;', [])
    expect(result.error).toBeNull()
    expect(result.returned).toBe(0)
  })
})
