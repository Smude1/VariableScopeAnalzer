# Verification & Test Report: Variable Scope Analyzer

**Course:** Compiler Construction  
**Project:** Multi-Language Variable Scope Analyzer  
**Environment:** Windows 10/11 & Modern Web Browsers (Chrome, Edge, Firefox)  
**Execution Engine:** Pure Vanilla JavaScript (Client-side execution)  

---

## 1. Summary of Test Outcomes

| Test ID | Test Description | Language | Status |
| :--- | :--- | :--- | :--- |
| **Test 1** | Valid C nested scope | C | **PASSED** |
| **Test 2** | Invalid C scope access (out-of-scope variable) | C | **PASSED** |
| **Test 3** | Valid C++ variable shadowing | C++ | **PASSED** |
| **Test 4** | Java class field and method local variable | Java | **PASSED** |
| **Test 5** | Python module and function scope (LEGB) | Python | **PASSED** |
| **Test 6** | Empty input handling | All | **PASSED** |
| **Test 7** | Repeated analysis & state cleanup | C | **PASSED** |

---

## 2. Detailed Test Cases & Results

### Test 1: Valid C Nested Scope
- **Source Code:**
  ```c
  int main() {
      int a = 10;
      {
          int b = 20;
          a = a + b;
      }
      return a;
  }
  ```
- **Expected Outcome:** `a` is accessible inside the nested block; `b` is used only within its scope; no out-of-scope errors reported.
- **Actual Outcome:**
  - Variables Found: `2` (`a` on Line 2, `b` on Line 4)
  - Errors Detected: `0`
  - Scope Levels: `3` (Global Scope, Function: `main()`, Nested Block Line 3)
  - Errors Tab: *"No Scope Violations Detected"*
- **Result:** **PASSED**

---

### Test 2: Invalid C Scope Access
- **Source Code:**
  ```c
  int main() {
      int a = 10;
      {
          int b = 20;
      }
      b = 5;
      return a;
  }
  ```
- **Expected Outcome:** Report that `b` is inaccessible at its reference on line 6 because its declaring block terminated on line 5.
- **Actual Outcome:**
  - Variables Found: `2` (`a`, `b`)
  - Errors Detected: `1`
  - Error Card: `Scope Error` &bull; Line 6 &bull; `var: b`  
    *Message:* `"Variable 'b' is used outside its scope (declared on line 4 in a block that ended on line 5)."`
- **Result:** **PASSED**

---

### Test 3: Valid C++ Variable Shadowing
- **Source Code:**
  ```cpp
  int main() {
      int x = 10;
      {
          int x = 20;
          x = x + 1;
      }
      return x;
  }
  ```
- **Expected Outcome:** Both declarations of `x` appear in the symbol table as separate entries. The inner declaration is not reported as a duplicate.
- **Actual Outcome:**
  - Variables Found: `2`
  - Errors Detected: `0`
  - Symbol Table Entries:
    1. `x` | `int` | Line 2 | Level 1 (`Function: main()`)
    2. `x` | `int` | Line 4 | Level 2 (`Nested Block (Line 3)`)
  - Result: Inner `x` shadows outer `x` without triggering duplicate declaration errors.
- **Result:** **PASSED**

---

### Test 4: Java Class Field and Local Variable
- **Source Code:**
  ```java
  class Main {
      int value = 10;

      void test() {
          int local = 20;
          {
              int temporary = 30;
          }
          System.out.println(value);
          System.out.println(local);
      }
  }
  ```
- **Expected Outcome:** `value` and `local` are recognized in their valid scopes. `value` (class field) is resolved from `test()` without error. `temporary` is recorded in its nested block.
- **Actual Outcome:**
  - Variables Found: `3`
  - Errors Detected: `0`
  - Scope Levels: `4` (`Global Scope`, `Class: Main`, `Function: test()`, `Nested Block (Line 6)`)
  - Symbol Table Entries:
    1. `value` | `int` | Line 2 | Level 1 (`Class: Main`)
    2. `local` | `int` | Line 5 | Level 2 (`Function: test()`)
    3. `temporary` | `int` | Line 7 | Level 3 (`Nested Block (Line 6)`)
  - `System.out.println(...)` calls resolve `value` and `local` correctly.
- **Result:** **PASSED**

---

### Test 5: Python Module and Function Scope (LEGB)
- **Source Code:**
  ```python
  x = 10

  def demo():
      y = 20
      print(x)
      print(y)

  demo()
  ```
- **Expected Outcome:** `x` can be resolved from the module scope inside `demo`, and `y` is recognized within the function. Neither `print` nor `demo` is flagged as an undeclared variable error.
- **Actual Outcome:**
  - Variables Found: `3` (`x` on Line 1, `demo` on Line 3, `y` on Line 4)
  - Errors Detected: `0`
  - Scope Hierarchy:
    - `Module Scope (Level 0)`: Declares `x`, `demo`
    - `Function: demo() (Level 1)`: Declares `y`
  - No false positive warnings or errors for `print`, `demo()`, or `x`.
- **Result:** **PASSED**

---

### Test 6: Empty Input Handling
- **Action:** Clicking **Analyze Scope** when the editor textarea is empty or contains only whitespace.
- **Expected Outcome:** Display a clear, non-crashing informational prompt asking the user to provide source code. No fabricated metrics.
- **Actual Outcome:**
  - Notice Banner displayed: *"Source Code Required: Please write or load sample [Language] code before initiating scope analysis."*
  - Summary metrics remain uncorrupted (`—`).
- **Result:** **PASSED**

---

### Test 7: Repeated Analysis & State Cleanup
- **Action:**
  1. Analyze program A: `int main() { int firstVar = 100; return firstVar; }` (Variables Found = 1).
  2. Modify code in the editor to program B: `int main() { int secondVar = 200; int thirdVar = 300; return secondVar + thirdVar; }`.
  3. Re-click **Analyze Scope**.
- **Expected Outcome:** All previous symbols and metrics are discarded; new analysis reflects exactly 2 variables without traces of `firstVar`.
- **Actual Outcome:**
  - Summary cards updated to: Variables Found = `2`, Scope Levels = `2`, Errors = `0`.
  - Symbol table contains only `secondVar` and `thirdVar`; `firstVar` is completely cleared.
- **Result:** **PASSED**

---

## 3. Remaining Issues or Regressions

- **Zero Breaking Issues:** All core features, language analyzers, and UI interactions execute properly.
- **Educational Scope:** Complex non-standard language constructs (e.g., C macros, Java reflection, Python metaclasses) are gracefully handled as unrecognized or cautiously noted as warnings rather than crashing the interface.
