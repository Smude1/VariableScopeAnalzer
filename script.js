/**
 * Variable Scope Analyzer - Phase 2: Variable Scope Analysis Engine
 * Compiler Construction Mini Project
 * 
 * Modular implementation providing:
 *  1. Comment & string literal masking (preserves exact line numbers & offsets)
 *  2. Lexical scanning & scope resolution for C, C++, and Java (brace-based)
 *  3. Lexical scanning & LEGB scope resolution for Python (indentation-based)
 *  4. Symbol table generation with shadowing support
 *  5. Scope hierarchy tree generation
 *  6. Scope violations, out-of-scope access, and undeclared identifier detection
 *  7. Dynamic UI rendering and metric updates
 */

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. DOM Element References
    // =========================================================================
    const languageSelect = document.getElementById('languageSelect');
    const badgeLanguageName = document.getElementById('badgeLanguageName');
    const editorLangIndicator = document.getElementById('editorLangIndicator');
    const sourceEditor = document.getElementById('sourceEditor');
    const charCount = document.getElementById('charCount');

    // Action Buttons
    const loadExampleBtn = document.getElementById('loadExampleBtn');
    const clearCodeBtn = document.getElementById('clearCodeBtn');
    const analyzeScopeBtn = document.getElementById('analyzeScopeBtn');

    // Status & Notification Elements
    const statusText = document.getElementById('statusText');
    const statusDot = document.querySelector('.status-dot');
    const noticeContainer = document.getElementById('noticeContainer');
    const noticeBox = document.getElementById('noticeBox');
    const noticeTitle = document.getElementById('noticeTitle');
    const noticeMessage = document.getElementById('noticeMessage');
    const noticeDismiss = document.getElementById('noticeDismiss');

    // Summary Metrics
    const varCountMetric = document.getElementById('varCountMetric');
    const errorCountMetric = document.getElementById('errorCountMetric');
    const scopeLevelMetric = document.getElementById('scopeLevelMetric');

    // Tab Buttons & Content Panes
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabErrors = document.getElementById('tabErrors');
    const symbolTableBody = document.getElementById('symbolTableBody');
    const tabScope = document.getElementById('tabScope');

    // Cache pristine initial HTML for reset operations
    const initialErrorsHTML = tabErrors.innerHTML;
    const initialSymbolTableHTML = symbolTableBody.innerHTML;
    const initialScopeHTML = tabScope.innerHTML;

    // =========================================================================
    // 2. Sample Programs for Each Supported Language
    // =========================================================================
    const samplePrograms = {
        'C': 
`#include <stdio.h>

// Global scope variable
int globalCounter = 100;

void calculate(int multiplier) {
    // Function scope: multiplier, localResult
    int localResult = multiplier * 2;
    
    // Block scope inside conditional statement
    if (localResult > 10) {
        int tempOffset = 5;
        localResult += tempOffset;
    }
}

int main() {
    // Local scope to main
    int count = 5;
    calculate(count);
    return 0;
}`,

        'C++': 
`#include <iostream>

// Global scope variable
int appConfigId = 42;

class ScopeDemo {
private:
    int classMemberVar; // Class scope

public:
    ScopeDemo(int val) : classMemberVar(val) {}

    void executeTask(int repeatCount) {
        // Method local scope
        int accumulator = 0;

        for (int i = 0; i < repeatCount; ++i) {
            // Loop block scope
            int iterationStep = i * 2;
            accumulator += iterationStep;
        }
    }
};

int main() {
    ScopeDemo demo(10);
    demo.executeTask(3);
    return 0;
}`,

        'Java': 
`public class VariableScopeDemo {
    // Class scope: static variable
    public static int globalSessionId = 999;
    
    // Class scope: instance variable
    private String instanceTag = "Analyzer";

    public void processData(int inputData) {
        // Method scope (local variable)
        int localSum = inputData + 10;

        if (localSum > 20) {
            // Block scope variable
            boolean isValidScope = true;
            System.out.println("Valid: " + isValidScope);
        }
    }

    public static void main(String[] args) {
        VariableScopeDemo demo = new VariableScopeDemo();
        demo.processData(15);
    }
}`,

        'Python': 
`# Global scope variables
app_version = "1.0.0"
counter = 0

def outer_function(factor):
    # Enclosing (function) scope
    multiplier = factor * 2

    def inner_function(step):
        # Local scope
        nested_val = step + multiplier
        return nested_val

    result = inner_function(5)
    return result

if __name__ == "__main__":
    final_score = outer_function(10)
    print("Result:", final_score)
`
    };

    // =========================================================================
    // 3. Preprocessing: Mask Comments & String Literals
    // =========================================================================

    /**
     * Replaces characters inside comments and string literals with spaces.
     * This preserves 100% of the original line numbers and character positions
     * while guaranteeing that variable detection does not inspect comments or strings.
     */
    function maskCommentsAndStrings(code, lang) {
        let result = '';
        let i = 0;
        const n = code.length;
        let inSingleComment = false;
        let inMultiComment = false;
        let inString = false;
        let stringChar = '';
        let inTripleString = false;
        let tripleChar = '';

        while (i < n) {
            const ch = code[i];
            const next = i + 1 < n ? code[i + 1] : '';
            const next2 = i + 2 < n ? code[i + 2] : '';

            // Handle newline resetting single-line comments
            if (ch === '\n') {
                if (inSingleComment) inSingleComment = false;
                result += '\n';
                i++;
                continue;
            }

            // Inside single-line comment
            if (inSingleComment) {
                result += ' ';
                i++;
                continue;
            }

            // Inside multi-line comment (/* ... */)
            if (inMultiComment) {
                if (ch === '*' && next === '/') {
                    inMultiComment = false;
                    result += '  ';
                    i += 2;
                } else {
                    result += ' ';
                    i++;
                }
                continue;
            }

            // Inside Python docstring / triple-quoted string
            if (inTripleString) {
                if (ch === tripleChar && next === tripleChar && next2 === tripleChar) {
                    inTripleString = false;
                    result += '   ';
                    i += 3;
                } else {
                    result += ' ';
                    i++;
                }
                continue;
            }

            // Inside normal quoted string / char literal
            if (inString) {
                if (ch === '\\') {
                    result += '  ';
                    i += 2;
                } else if (ch === stringChar) {
                    inString = false;
                    result += ' ';
                    i++;
                } else {
                    result += ' ';
                    i++;
                }
                continue;
            }

            // Start of comment or string
            if (lang === 'Python') {
                if (ch === '#') {
                    inSingleComment = true;
                    result += ' ';
                    i++;
                    continue;
                }
                if ((ch === '"' || ch === "'") && next === ch && next2 === ch) {
                    inTripleString = true;
                    tripleChar = ch;
                    result += '   ';
                    i += 3;
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    inString = true;
                    stringChar = ch;
                    result += ' ';
                    i++;
                    continue;
                }
            } else {
                // C, C++, Java
                if (ch === '/' && next === '/') {
                    inSingleComment = true;
                    result += '  ';
                    i += 2;
                    continue;
                }
                if (ch === '/' && next === '*') {
                    inMultiComment = true;
                    result += '  ';
                    i += 2;
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    inString = true;
                    stringChar = ch;
                    result += ' ';
                    i++;
                    continue;
                }
            }

            result += ch;
            i++;
        }

        return result;
    }

    // =========================================================================
    // 4. Data Structures for Scope & Symbol Representation
    // =========================================================================

    class Scope {
        constructor(id, name, type, parent = null, level = 0, startLine = 1, indent = 0) {
            this.id = id;
            this.name = name;           // e.g. "Global Scope", "Function: main()", "Nested Block (Line 4)"
            this.type = type;           // 'global', 'class', 'function', 'block'
            this.parent = parent;       // Parent Scope reference (for scope chain lookup)
            this.children = [];
            this.level = level;         // Nesting depth: 0 for Global, 1 for Function/Class, etc.
            this.startLine = startLine;
            this.endLine = null;
            this.indent = indent;       // Used by Python indentation parser
            this.symbols = new Map();   // varName -> SymbolEntry
        }
    }

    class SymbolEntry {
        constructor(name, dataType, line, scope) {
            this.name = name;
            this.dataType = dataType;
            this.line = line;
            this.scope = scope;
        }
    }

    // =========================================================================
    // 5. Analysis Engine for C, C++, and Java (Brace-Based Scopes)
    // =========================================================================

    function analyzeC_Family(rawCode, lang) {
        const maskedCode = maskCommentsAndStrings(rawCode, lang);
        const lines = maskedCode.split('\n');

        let scopeIdCounter = 1;
        const globalScope = new Scope(scopeIdCounter++, 'Global Scope', 'global', null, 0, 1);
        const allScopes = [globalScope];
        const closedScopes = [];
        const allSymbols = [];
        const errors = [];
        const warnings = [];

        let currentScope = globalScope;

        // Common language keywords to ignore as variable names
        const C_KEYWORDS = new Set([
            'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
            'break', 'continue', 'return', 'goto', 'sizeof', 'typedef',
            'struct', 'union', 'enum', 'const', 'static', 'extern', 'volatile',
            'register', 'inline', 'auto', 'public', 'private', 'protected',
            'class', 'namespace', 'using', 'new', 'delete', 'this', 'nullptr',
            'true', 'false', 'template', 'typename', 'try', 'catch', 'throw',
            'friend', 'virtual', 'override', 'final', 'abstract', 'package',
            'import', 'synchronized', 'native', 'transient', 'throws', 'instanceof',
            'null', 'super', 'include', 'define', 'pragma'
        ]);

        // Supported primitive & standard types
        const KNOWN_TYPES = new Set([
            'int', 'float', 'double', 'char', 'void', 'long', 'short', 'bool',
            'boolean', 'String', 'size_t', 'uint32_t', 'int32_t', 'auto'
        ]);

        // Common standard built-in functions / identifiers to avoid false positives
        const KNOWN_BUILTINS = new Set([
            'printf', 'scanf', 'puts', 'getchar', 'putchar', 'malloc', 'free', 'exit',
            'cout', 'cin', 'endl', 'cerr', 'string', 'vector', 'main',
            'System', 'out', 'println', 'print', 'Integer', 'Double', 'Math', 'Scanner'
        ]);

        const declaredClasses = new Set();
        const declaredFunctions = new Set();

        /**
         * Look up a symbol in the active scope hierarchy (inner -> outer -> global).
         */
        function lookupSymbol(name, scope) {
            let s = scope;
            while (s) {
                if (s.symbols.has(name)) {
                    return s.symbols.get(name);
                }
                s = s.parent;
            }
            return null;
        }

        /**
         * Look up a symbol in previously closed scopes (to detect out-of-scope access).
         */
        function lookupClosedScopes(name) {
            for (let i = closedScopes.length - 1; i >= 0; i--) {
                if (closedScopes[i].symbols.has(name)) {
                    return closedScopes[i].symbols.get(name);
                }
            }
            return null;
        }

        /**
         * Register a variable declaration in the target scope.
         * Detects duplicate declarations within the exact same scope while allowing shadowing across nested scopes.
         */
        function registerDeclaration(name, type, line, targetScope) {
            if (targetScope.symbols.has(name)) {
                const existing = targetScope.symbols.get(name);
                errors.push({
                    type: 'Duplicate Declaration',
                    variable: name,
                    line: line,
                    message: `Variable '${name}' is declared more than once in the same scope (previously declared on line ${existing.line}).`
                });
                return;
            }
            const sym = new SymbolEntry(name, type, line, targetScope);
            targetScope.symbols.set(name, sym);
            allSymbols.push(sym);
        }

        // Process line by line
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const lineNum = lineIdx + 1;
            const line = lines[lineIdx];
            const trimmed = line.trim();

            if (!trimmed) continue;
            if (trimmed.startsWith('#')) continue; // Ignore preprocessor directives like #include

            // Recognize class declarations: class Name { ... } or public class Name { ... }
            const classMatch = trimmed.match(/(?:public\s+|private\s+)?class\s+([A-Za-z_]\w*)/);
            if (classMatch) {
                declaredClasses.add(classMatch[1]);
            }

            const hasOpenBrace = line.includes('{');
            const hasCloseBrace = line.includes('}');

            // Scope entry via opening brace '{'
            if (hasOpenBrace) {
                let scopeName = `Nested Block (Line ${lineNum})`;
                let scopeType = 'block';

                const beforeBrace = line.substring(0, line.indexOf('{')).trim();
                const contextText = beforeBrace || (lineIdx > 0 ? lines[lineIdx - 1].trim() : '');

                const clsM = contextText.match(/(?:public\s+|private\s+)?class\s+([A-Za-z_]\w*)/);
                if (clsM) {
                    scopeName = `Class: ${clsM[1]}`;
                    scopeType = 'class';
                    const newScope = new Scope(scopeIdCounter++, scopeName, scopeType, currentScope, currentScope.level + 1, lineNum);
                    currentScope.children.push(newScope);
                    allScopes.push(newScope);
                    currentScope = newScope;
                } else {
                    // Match function or constructor signature: ReturnType funcName(params) or ClassName(params)
                    const funcM = contextText.match(/(?:([A-Za-z_]\w*[\s*&]+)+)?([A-Za-z_]\w*)\s*\(([^)]*)\)(?:\s*:[^{]*)?/);
                    if (funcM && !contextText.startsWith('if') && !contextText.startsWith('while') && !contextText.startsWith('for') && !contextText.startsWith('switch')) {
                        const funcName = funcM[2];
                        const paramList = (funcM[3] || '').trim();
                        declaredFunctions.add(funcName);
                        scopeName = `Function: ${funcName}()`;
                        scopeType = 'function';

                        const newScope = new Scope(scopeIdCounter++, scopeName, scopeType, currentScope, currentScope.level + 1, lineNum);
                        currentScope.children.push(newScope);
                        allScopes.push(newScope);
                        currentScope = newScope;

                        // Parse parameter declarations
                        if (paramList && paramList !== 'void') {
                            const params = paramList.split(',');
                            for (const p of params) {
                                const pParts = p.trim().replace(/[*&]/g, ' ').split(/\s+/).filter(Boolean);
                                if (pParts.length >= 2) {
                                    const pName = pParts[pParts.length - 1].replace(/\[\]/g, '');
                                    const pType = pParts.slice(0, pParts.length - 1).join(' ');
                                    if (!C_KEYWORDS.has(pName)) {
                                        registerDeclaration(pName, pType, lineNum, currentScope);
                                    }
                                }
                            }
                        }
                    } else {
                        // Ordinary block scope (if, while, or standalone compound block)
                        const newScope = new Scope(scopeIdCounter++, scopeName, scopeType, currentScope, currentScope.level + 1, lineNum);
                        currentScope.children.push(newScope);
                        allScopes.push(newScope);
                        currentScope = newScope;
                    }
                }
            }

            // Loop header declarations: for (int i = 0; ...; ...)
            const forMatch = trimmed.match(/for\s*\(\s*([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/);
            if (forMatch) {
                const fType = forMatch[1];
                const fVar = forMatch[2];
                if (KNOWN_TYPES.has(fType) || declaredClasses.has(fType)) {
                    registerDeclaration(fVar, fType, lineNum, currentScope);
                }
            }

            // Standard variable declarations: type name = expr; or type name;
            const isFuncDef = /\)\s*(?::[^{]*)?\{?$/.test(trimmed) && trimmed.includes('(') && !trimmed.includes('=') && !trimmed.endsWith(';');

            if (!isFuncDef && !trimmed.startsWith('for')) {
                let cleaned = trimmed
                    .replace(/^(public|private|protected|static|final|const|volatile|extern)\s+/g, '')
                    .replace(/^(public|private|protected|static|final|const|volatile|extern)\s+/g, '')
                    .replace(/^(public|private|protected|static|final|const|volatile|extern)\s+/g, '');

                const declMatch = cleaned.match(/^([A-Za-z_]\w*(?:\s*\[\s*\])?)\s+([*&]?\s*[A-Za-z_]\w*.*);/);
                if (declMatch) {
                    const possibleType = declMatch[1].trim();
                    const rest = declMatch[2].trim();

                    if ((KNOWN_TYPES.has(possibleType) || declaredClasses.has(possibleType) || /^[A-Z]/.test(possibleType)) && !C_KEYWORDS.has(possibleType)) {
                        const decls = rest.split(',');
                        for (const d of decls) {
                            const dTrim = d.trim();
                            const varMatch = dTrim.match(/^([*&]?\s*[A-Za-z_]\w*)\s*(?:=\s*(.*)|\((.*)\))?$/);
                            if (varMatch) {
                                const varName = varMatch[1].replace(/[*&\s]/g, '');
                                const initExpr = varMatch[2] || varMatch[3] || '';

                                if (!C_KEYWORDS.has(varName)) {
                                    registerDeclaration(varName, possibleType, lineNum, currentScope);
                                    if (initExpr) {
                                        checkReferencesInExpr(initExpr, lineNum, currentScope);
                                    }
                                }
                            }
                        }
                        continue;
                    }
                }
            }

            // Variable references in statements and expressions
            if (!isFuncDef) {
                checkReferencesInExpr(trimmed, lineNum, currentScope);
            }

            // Scope exit via closing brace '}'
            if (hasCloseBrace) {
                const closeCount = (line.match(/\}/g) || []).length;
                for (let c = 0; c < closeCount; c++) {
                    if (currentScope.parent) {
                        currentScope.endLine = lineNum;
                        closedScopes.push(currentScope);
                        currentScope = currentScope.parent;
                    }
                }
            }
        }

        /**
         * Checks identifier references in an expression against active and closed scopes.
         */
        function checkReferencesInExpr(expr, lineNum, scope) {
            const idRegex = /(?:(\.)|(\b))([A-Za-z_]\w*)/g;
            let match;

            while ((match = idRegex.exec(expr)) !== null) {
                const isDotMember = match[1] === '.';
                const id = match[3];
                const matchIndex = match.index;

                // Ignore member names after '.' (e.g. out in System.out, println in out.println)
                if (isDotMember) continue;

                // Ignore function invocations func(...) unless it's a known declared variable
                const afterIndex = matchIndex + match[0].length;
                const afterChar = expr.substring(afterIndex).trim()[0];
                if (afterChar === '(' && !scope.symbols.has(id)) {
                    continue;
                }

                if (C_KEYWORDS.has(id) || KNOWN_TYPES.has(id) || KNOWN_BUILTINS.has(id) || declaredClasses.has(id) || declaredFunctions.has(id)) {
                    continue;
                }

                // Lookup in active scope chain
                const sym = lookupSymbol(id, scope);
                if (sym) {
                    if (sym.line > lineNum) {
                        warnings.push({
                            type: 'Used Before Declaration',
                            variable: id,
                            line: lineNum,
                            message: `Variable '${id}' is referenced on line ${lineNum} before its declaration on line ${sym.line}.`
                        });
                    }
                    continue; // Valid reference in active scope
                }

                // Not in active scope; check closed scopes (out of scope reference)
                const closedSym = lookupClosedScopes(id);
                if (closedSym) {
                    errors.push({
                        type: 'Scope Error',
                        variable: id,
                        line: lineNum,
                        message: `Variable '${id}' is used outside its scope (declared on line ${closedSym.line} in a block that ended on line ${closedSym.scope.endLine || lineNum}).`
                    });
                } else {
                    // Undeclared identifier
                    warnings.push({
                        type: 'Undeclared Identifier',
                        variable: id,
                        line: lineNum,
                        message: `Variable '${id}' on line ${lineNum} is used without prior declaration in the current or enclosing scope.`
                    });
                }
            }
        }

        return { allScopes, allSymbols, errors, warnings };
    }

    // =========================================================================
    // 6. Analysis Engine for Python (Indentation-Based Scopes)
    // =========================================================================

    function analyzePython(rawCode) {
        const maskedCode = maskCommentsAndStrings(rawCode, 'Python');
        const lines = maskedCode.split('\n');

        let scopeIdCounter = 1;
        const moduleScope = new Scope(scopeIdCounter++, 'Module Scope', 'global', null, 0, 1, -1);
        const allScopes = [moduleScope];
        const closedScopes = [];
        const allSymbols = [];
        const errors = [];
        const warnings = [];

        let currentScope = moduleScope;
        const scopeStack = [moduleScope];

        const PYTHON_KEYWORDS = new Set([
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
            'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
            'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
            'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
            'try', 'while', 'with', 'yield'
        ]);

        const PYTHON_BUILTINS = new Set([
            'print', 'input', 'range', 'len', 'str', 'int', 'float', 'bool',
            'list', 'dict', 'set', 'tuple', 'open', 'type', 'sum', 'min', 'max',
            'abs', 'round', 'enumerate', 'zip', 'map', 'filter', 'sorted',
            'reversed', 'super', 'isinstance', 'issubclass', 'self',
            '__name__', '__main__', '__init__', '__file__', '__doc__'
        ]);

        const definedFunctions = new Set();

        function lookupSymbol(name, scope) {
            let s = scope;
            while (s) {
                if (s.symbols.has(name)) {
                    return s.symbols.get(name);
                }
                s = s.parent;
            }
            return null;
        }

        function lookupClosedScopes(name) {
            for (let i = closedScopes.length - 1; i >= 0; i--) {
                if (closedScopes[i].symbols.has(name)) {
                    return closedScopes[i].symbols.get(name);
                }
            }
            return null;
        }

        function registerDeclaration(name, type, line, targetScope) {
            if (targetScope.symbols.has(name)) {
                return; // Re-assignment in Python does not trigger duplicate error
            }
            const sym = new SymbolEntry(name, type, line, targetScope);
            targetScope.symbols.set(name, sym);
            allSymbols.push(sym);
        }

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const lineNum = lineIdx + 1;
            const line = lines[lineIdx];
            const trimmed = line.trim();

            if (!trimmed) continue;

            // Measure indentation
            let indent = 0;
            for (let c = 0; c < line.length; c++) {
                if (line[c] === ' ') indent += 1;
                else if (line[c] === '\t') indent += 4;
                else break;
            }

            // Dedent: close scopes that have an indent >= current line indent
            while (scopeStack.length > 1 && indent <= currentScope.indent) {
                const popped = scopeStack.pop();
                popped.endLine = lineNum - 1;
                closedScopes.push(popped);
                currentScope = scopeStack[scopeStack.length - 1];
            }

            // Function definition: def func_name(params):
            const defMatch = trimmed.match(/^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/);
            if (defMatch) {
                const funcName = defMatch[1];
                const paramList = defMatch[2].trim();

                definedFunctions.add(funcName);
                registerDeclaration(funcName, 'function', lineNum, currentScope);

                const funcScope = new Scope(
                    scopeIdCounter++,
                    `Function: ${funcName}()`,
                    'function',
                    currentScope,
                    currentScope.level + 1,
                    lineNum,
                    indent
                );
                currentScope.children.push(funcScope);
                allScopes.push(funcScope);
                scopeStack.push(funcScope);
                currentScope = funcScope;

                if (paramList) {
                    const params = paramList.split(',');
                    for (const p of params) {
                        const pName = p.trim().split('=')[0].trim();
                        if (pName && !PYTHON_KEYWORDS.has(pName)) {
                            registerDeclaration(pName, 'parameter', lineNum, currentScope);
                        }
                    }
                }
                continue;
            }

            // Class definition: class ClassName:
            const classMatch = trimmed.match(/^class\s+([A-Za-z_]\w*)/);
            if (classMatch) {
                const className = classMatch[1];
                definedFunctions.add(className);
                registerDeclaration(className, 'class', lineNum, currentScope);

                const classScope = new Scope(
                    scopeIdCounter++,
                    `Class: ${className}`,
                    'class',
                    currentScope,
                    currentScope.level + 1,
                    lineNum,
                    indent
                );
                currentScope.children.push(classScope);
                allScopes.push(classScope);
                scopeStack.push(classScope);
                currentScope = classScope;
                continue;
            }

            // Assignments: var = expr or var += expr
            const assignMatch = trimmed.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(=|\+=|-=|\*=|\/=)\s*(.*)$/);
            if (assignMatch && !trimmed.startsWith('if') && !trimmed.startsWith('while') && !trimmed.startsWith('return')) {
                const lhs = assignMatch[1].trim();
                const rhs = assignMatch[3].trim();

                const vars = lhs.split(',').map(v => v.trim()).filter(Boolean);
                for (const v of vars) {
                    if (!PYTHON_KEYWORDS.has(v)) {
                        registerDeclaration(v, 'inferred', lineNum, currentScope);
                    }
                }

                if (rhs) {
                    checkReferences(rhs, lineNum, currentScope);
                }
                continue;
            }

            // For loop variable: for item in sequence:
            const forMatch = trimmed.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.*):/);
            if (forMatch) {
                const loopVar = forMatch[1];
                const iterExpr = forMatch[2];
                if (!PYTHON_KEYWORDS.has(loopVar)) {
                    registerDeclaration(loopVar, 'inferred', lineNum, currentScope);
                }
                checkReferences(iterExpr, lineNum, currentScope);
                continue;
            }

            // General expressions & statements
            checkReferences(trimmed, lineNum, currentScope);
        }

        // Close any scopes still on stack at end of file
        while (scopeStack.length > 1) {
            const popped = scopeStack.pop();
            popped.endLine = lines.length;
            closedScopes.push(popped);
        }

        function checkReferences(expr, lineNum, scope) {
            const idRegex = /(?:(\.)|(\b))([A-Za-z_]\w*)/g;
            let match;

            while ((match = idRegex.exec(expr)) !== null) {
                const isDotMember = match[1] === '.';
                const id = match[3];

                if (isDotMember) continue;

                // Function call check
                const afterIndex = match.index + match[0].length;
                const afterChar = expr.substring(afterIndex).trim()[0];
                if (afterChar === '(' && (definedFunctions.has(id) || PYTHON_BUILTINS.has(id))) {
                    continue;
                }

                if (PYTHON_KEYWORDS.has(id) || PYTHON_BUILTINS.has(id) || definedFunctions.has(id)) {
                    continue;
                }

                // LEGB Scope lookup
                const sym = lookupSymbol(id, scope);
                if (sym) {
                    if (sym.scope === scope && sym.line > lineNum) {
                        warnings.push({
                            type: 'Used Before Assignment',
                            variable: id,
                            line: lineNum,
                            message: `Variable '${id}' on line ${lineNum} is referenced before assignment on line ${sym.line}.`
                        });
                    }
                    continue;
                }

                // Out of scope check
                const closedSym = lookupClosedScopes(id);
                if (closedSym) {
                    errors.push({
                        type: 'Scope Error',
                        variable: id,
                        line: lineNum,
                        message: `Variable '${id}' is used outside its scope (declared on line ${closedSym.line} in ${closedSym.scope.name}).`
                    });
                } else {
                    warnings.push({
                        type: 'Undeclared Identifier',
                        variable: id,
                        line: lineNum,
                        message: `Variable '${id}' on line ${lineNum} is not defined in the local, enclosing, or global scope.`
                    });
                }
            }
        }

        return { allScopes, allSymbols, errors, warnings };
    }

    // =========================================================================
    // 7. UI Rendering Functions
    // =========================================================================

    /**
     * Safely escapes strings to prevent XSS.
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Renders detected errors & warnings into Tab 1.
     */
    function renderErrorsAndWarnings(errors, warnings) {
        const totalIssues = errors.length + warnings.length;

        if (totalIssues === 0) {
            tabErrors.innerHTML = `
                <div class="success-state">
                    <div class="success-icon">✅</div>
                    <h3 class="success-title">No Scope Violations Detected</h3>
                    <p class="success-description">
                        All referenced variables resolve correctly within their active lexical scopes. No out-of-scope references or duplicate declarations were found.
                    </p>
                </div>
            `;
            return;
        }

        let html = '<div class="error-list">';

        // Render errors first
        for (const err of errors) {
            html += `
                <div class="error-item error-fatal">
                    <div class="error-item-header">
                        <span class="badge-error-type error-fatal">${escapeHtml(err.type)}</span>
                        <span class="error-line-badge">Line ${err.line}</span>
                        <span class="error-var-badge">var: ${escapeHtml(err.variable)}</span>
                    </div>
                    <p class="error-item-msg">${escapeHtml(err.message)}</p>
                </div>
            `;
        }

        // Render warnings
        for (const warn of warnings) {
            html += `
                <div class="error-item error-warning">
                    <div class="error-item-header">
                        <span class="badge-error-type error-warning">${escapeHtml(warn.type)}</span>
                        <span class="error-line-badge">Line ${warn.line}</span>
                        <span class="error-var-badge">var: ${escapeHtml(warn.variable)}</span>
                    </div>
                    <p class="error-item-msg">${escapeHtml(warn.message)}</p>
                </div>
            `;
        }

        html += '</div>';
        tabErrors.innerHTML = html;
    }

    /**
     * Renders detected variables into Tab 2 (Symbol Table).
     */
    function renderSymbolTable(symbols) {
        if (!symbols || symbols.length === 0) {
            symbolTableBody.innerHTML = `
                <tr class="empty-table-row">
                    <td colspan="4">
                        <div class="table-empty-message">
                            <span>📋</span> No variable declarations were detected in the provided code.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        for (const sym of symbols) {
            const scopeDesc = sym.scope ? `Level ${sym.scope.level} (${sym.scope.name})` : 'Global';
            html += `
                <tr>
                    <td><span class="sym-var-name">${escapeHtml(sym.name)}</span></td>
                    <td><span class="sym-type-badge">${escapeHtml(sym.dataType)}</span></td>
                    <td>Line ${sym.line}</td>
                    <td><span class="sym-scope-badge">${escapeHtml(scopeDesc)}</span></td>
                </tr>
            `;
        }
        symbolTableBody.innerHTML = html;
    }

    /**
     * Renders scope hierarchy cards into Tab 3 (Scope Information).
     */
    function renderScopeInformation(scopes) {
        if (!scopes || scopes.length === 0) {
            tabScope.innerHTML = initialScopeHTML;
            return;
        }

        let html = '<div class="scope-tree-container">';
        for (const scope of scopes) {
            const glyphMap = {
                'global': '🌐',
                'class': '🏛️',
                'function': '⚡',
                'block': '📦'
            };
            const glyph = glyphMap[scope.type] || '🔍';
            const declaredVars = Array.from(scope.symbols.values());

            let varsHtml = '';
            if (declaredVars.length === 0) {
                varsHtml = '<span class="scope-empty-vars">No local variables declared in this scope.</span>';
            } else {
                varsHtml = declaredVars.map(v => 
                    `<span class="scope-var-pill"><span class="var-name">${escapeHtml(v.name)}</span><span class="var-type">(${escapeHtml(v.dataType)})</span></span>`
                ).join('');
            }

            const lineSpan = scope.endLine 
                ? `Lines ${scope.startLine}–${scope.endLine}` 
                : (scope.startLine ? `From Line ${scope.startLine}` : 'Full File');

            const parentInfo = scope.parent ? `Parent: ${escapeHtml(scope.parent.name)}` : 'Root Scope';

            html += `
                <div class="scope-card">
                    <div class="scope-card-header">
                        <div class="scope-title-wrap">
                            <span class="scope-glyph">${glyph}</span>
                            <span class="scope-card-name">${escapeHtml(scope.name)}</span>
                        </div>
                        <span class="scope-level-tag">Level ${scope.level}</span>
                    </div>
                    <div class="scope-meta-info">
                        <span>${escapeHtml(lineSpan)}</span> &bull; <span>${escapeHtml(parentInfo)}</span>
                    </div>
                    <div class="scope-var-list">
                        <span class="scope-var-label">Declared Variables:</span>
                        ${varsHtml}
                    </div>
                </div>
            `;
        }
        html += '</div>';
        tabScope.innerHTML = html;
    }

    /**
     * Updates top-level metric summary cards.
     */
    function updateMetrics(varCount, errorCount, scopeCount) {
        varCountMetric.textContent = varCount;
        errorCountMetric.textContent = errorCount;
        scopeLevelMetric.textContent = scopeCount;
    }

    /**
     * Updates line and character counts in the editor footer.
     */
    function updateEditorStats() {
        const text = sourceEditor.value;
        const totalChars = text.length;
        const totalLines = text.length === 0 ? 1 : text.split('\n').length;
        charCount.textContent = `${totalChars} characters | ${totalLines} line${totalLines === 1 ? '' : 's'}`;
    }

    /**
     * Displays a notification banner above results.
     */
    function showNotice(title, message, isWarning = false) {
        noticeTitle.textContent = title;
        noticeMessage.textContent = message;
        if (isWarning) {
            noticeBox.classList.remove('info');
            noticeBox.style.borderColor = 'var(--warning-orange)';
        } else {
            noticeBox.classList.add('info');
            noticeBox.style.borderColor = '';
        }
        noticeContainer.style.display = 'block';
    }

    function hideNotice() {
        noticeContainer.style.display = 'none';
    }

    /**
     * Switch active tab by target button ID.
     */
    function switchTab(targetBtnId) {
        tabButtons.forEach(btn => {
            const isTarget = btn.id === targetBtnId;
            btn.classList.toggle('active', isTarget);
            btn.setAttribute('aria-selected', isTarget);
        });

        const targetContentId = document.getElementById(targetBtnId).getAttribute('aria-controls');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === targetContentId);
        });
    }

    /**
     * Resets the entire dashboard back to the pristine initial state.
     */
    function resetDashboardState() {
        sourceEditor.value = '';
        updateEditorStats();
        hideNotice();

        // Reset metrics to dash
        varCountMetric.textContent = '—';
        errorCountMetric.textContent = '—';
        scopeLevelMetric.textContent = '—';

        // Reset status indicator
        statusText.textContent = 'Ready to Analyze';
        if (statusDot) {
            statusDot.style.backgroundColor = 'var(--success-green)';
            statusDot.style.boxShadow = '0 0 8px var(--success-green)';
        }

        // Restore initial HTML for all result tabs
        tabErrors.innerHTML = initialErrorsHTML;
        symbolTableBody.innerHTML = initialSymbolTableHTML;
        tabScope.innerHTML = initialScopeHTML;

        // Switch back to the first tab
        switchTab('tabErrorsBtn');
    }

    // =========================================================================
    // 8. Event Listeners & Interaction Handlers
    // =========================================================================

    // Interaction 1: Changing target language updates labels & placeholders
    languageSelect.addEventListener('change', (e) => {
        const selectedLang = e.target.value;
        badgeLanguageName.textContent = selectedLang;
        editorLangIndicator.textContent = `Language: ${selectedLang}`;
        sourceEditor.placeholder = `// Enter or paste your ${selectedLang} source code here...\n// Or click 'Load Example' above to inspect a sample program.`;
        hideNotice();
    });

    // Interaction 2: Load Example inserts valid sample code for selected language
    loadExampleBtn.addEventListener('click', () => {
        const currentLang = languageSelect.value;
        const sample = samplePrograms[currentLang];

        if (sample) {
            sourceEditor.value = sample.trim();
            updateEditorStats();
            hideNotice();
            statusText.textContent = `Sample loaded (${currentLang})`;
            if (statusDot) {
                statusDot.style.backgroundColor = 'var(--accent-primary)';
                statusDot.style.boxShadow = '0 0 8px var(--accent-primary)';
            }
        }
    });

    // Interaction 3: Clear Code empties editor and restores initial pristine state
    clearCodeBtn.addEventListener('click', () => {
        resetDashboardState();
    });

    // Interaction 4: Analyze Scope performs basic variable declaration & scope analysis
    analyzeScopeBtn.addEventListener('click', () => {
        const currentLang = languageSelect.value;
        const code = sourceEditor.value.trim();

        // Test E: Empty input handling
        if (!code) {
            showNotice(
                'Source Code Required',
                `Please write or load sample ${currentLang} code before initiating scope analysis.`,
                true
            );
            return;
        }

        // Execute language-appropriate scope analysis
        let analysisResult;
        if (currentLang === 'Python') {
            analysisResult = analyzePython(code);
        } else {
            analysisResult = analyzeC_Family(code, currentLang);
        }

        const { allScopes, allSymbols, errors, warnings } = analysisResult;
        const totalIssues = errors.length + warnings.length;

        // Populate the three result tabs
        renderErrorsAndWarnings(errors, warnings);
        renderSymbolTable(allSymbols);
        renderScopeInformation(allScopes);

        // Update metric summary cards
        updateMetrics(allSymbols.length, errors.length, allScopes.length);

        // Update status indicator and notice
        if (errors.length > 0) {
            statusText.textContent = `Analysis Complete (${errors.length} Error${errors.length === 1 ? '' : 's'})`;
            if (statusDot) {
                statusDot.style.backgroundColor = '#f85149';
                statusDot.style.boxShadow = '0 0 8px #f85149';
            }
            showNotice(
                'Scope Violations Detected',
                `Analysis found ${errors.length} scope error(s) and ${warnings.length} warning(s). Check the Errors & Warnings tab for details.`,
                true
            );
            switchTab('tabErrorsBtn');
        } else if (warnings.length > 0) {
            statusText.textContent = `Analysis Complete (${warnings.length} Warning${warnings.length === 1 ? '' : 's'})`;
            if (statusDot) {
                statusDot.style.backgroundColor = 'var(--warning-orange)';
                statusDot.style.boxShadow = '0 0 8px var(--warning-orange)';
            }
            showNotice(
                'Analysis Completed with Warnings',
                `Identified ${allSymbols.length} variable(s) across ${allScopes.length} scope(s) with ${warnings.length} warning(s).`
            );
        } else {
            statusText.textContent = 'Analysis Complete (0 Errors)';
            if (statusDot) {
                statusDot.style.backgroundColor = 'var(--success-green)';
                statusDot.style.boxShadow = '0 0 8px var(--success-green)';
            }
            showNotice(
                'Analysis Succeeded',
                `Analysis completed for ${currentLang}. Found ${allSymbols.length} variable declaration(s) across ${allScopes.length} scope level(s) with 0 errors.`
            );
        }
    });

    // Tab switching interaction
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.id);
        });
    });

    // Dismiss notification banner
    noticeDismiss.addEventListener('click', () => {
        hideNotice();
    });

    // Real-time character & line counter
    sourceEditor.addEventListener('input', () => {
        updateEditorStats();
    });

    // Initialize character and line count on page load
    updateEditorStats();
});
