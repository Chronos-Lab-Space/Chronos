// Chronos Language v0.1
// ====================
// A language for describing futures. Any agent can reason using Chronos.
//
// Grammar (informal):
//   program       := (state | action | score | run)*
//   state         := "state" "{" assignment* "}"
//   action        := "action" STRING "{" (assignment | "risk" | "reward")* "}"
//   score         := "score" IDENT "(" IDENT ")" "{" statement* "}"
//   run           := "run" "{" pipeline "}"
//   pipeline      := "fork" ("evaluate" "with" IDENT)? ("collapse" IDENT)?
//   statement     := assignment | if-statement | return-statement
//   assignment    := IDENT ("." IDENT)* "=" expression
//   if-statement  := "if" expression "{" statement* "}"
//   return        := "return" expression
//   expression    := comparison | arithmetic | literal | field-access | call
//
// The interpreter compiles Chronos into the engine's types and runs it.

import type { WorldState, Action } from "./types";
import type { Branch } from "./entities";

// ---- Token types ----

type TokenType = "keyword" | "ident" | "string" | "number" | "bool" | "symbol" | "eof";

type Token = {
  type: TokenType;
  value: string;
  line: number;
  col: number;
};

const KEYWORDS = new Set([
  "state",
  "action",
  "score",
  "run",
  "fork",
  "evaluate",
  "collapse",
  "with",
  "if",
  "return",
  "clamp",
  "risk",
  "reward",
]);

// Reserved words that cannot be used as identifiers (even in soft positions).
const RESERVED = new Set(["if", "return", "with", "fork", "evaluate", "collapse"]);

function isIdentLike(t: Token): boolean {
  if (t.type === "ident") return true;
  if (t.type === "keyword" && !RESERVED.has(t.value)) return true;
  if (t.type === "bool") return true;
  return false;
}

// ---- Tokenizer ----

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  while (i < source.length) {
    const c = source[i];

    // whitespace
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      col++;
      continue;
    }
    if (c === "\n") {
      i++;
      line++;
      col = 1;
      continue;
    }

    // comment
    if (c === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    // string
    if (c === '"' || c === "'") {
      const quote = c;
      const startCol = col;
      i++;
      col++;
      let str = "";
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < source.length) {
          str += source[i + 1];
          i += 2;
          col += 2;
        } else {
          str += source[i];
          i++;
          col++;
        }
      }
      if (i >= source.length) throw new ChronosError("unterminated string", line, startCol);
      i++;
      col++;
      tokens.push({ type: "string", value: str, line, col: startCol });
      continue;
    }

    // number
    if (/[0-9]/.test(c)) {
      const startCol = col;
      let num = "";
      while (i < source.length && /[0-9.]/.test(source[i])) {
        num += source[i];
        i++;
        col++;
      }
      tokens.push({ type: "number", value: num, line, col: startCol });
      continue;
    }

    // identifier / keyword / bool
    if (/[a-zA-Z_]/.test(c)) {
      const startCol = col;
      let ident = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) {
        ident += source[i];
        i++;
        col++;
      }
      if (ident === "true" || ident === "false") {
        tokens.push({ type: "bool", value: ident, line, col: startCol });
      } else if (KEYWORDS.has(ident)) {
        tokens.push({ type: "keyword", value: ident, line, col: startCol });
      } else {
        tokens.push({ type: "ident", value: ident, line, col: startCol });
      }
      continue;
    }

    // symbols
    if (c === "=" && source[i + 1] === "=") {
      tokens.push({ type: "symbol", value: "==", line, col });
      i += 2;
      col += 2;
      continue;
    }
    if (c === ">" && source[i + 1] === "=") {
      tokens.push({ type: "symbol", value: ">=", line, col });
      i += 2;
      col += 2;
      continue;
    }
    if (c === "<" && source[i + 1] === "=") {
      tokens.push({ type: "symbol", value: "<=", line, col });
      i += 2;
      col += 2;
      continue;
    }
    if ("{}()=+-*/.,<>|".includes(c)) {
      tokens.push({ type: "symbol", value: c, line, col });
      i++;
      col++;
      continue;
    }

    throw new ChronosError(`unexpected character: '${c}'`, line, col);
  }

  tokens.push({ type: "eof", value: "", line, col });
  return tokens;
}

// ---- AST ----

type AST = {
  states: { key: string; value: Expression }[];
  actions: { name: string; body: ActionBody }[];
  scores: { name: string; param: string; body: Statement[] }[];
  run: { fork: boolean; evaluate: string | null; collapse: string | null } | null;
};

type ActionBody = {
  mutations: { path: string[]; value: Expression }[];
  risk: Expression | null;
  reward: Expression | null;
};

type Expression =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "ident"; name: string }
  | { kind: "field"; object: Expression; field: string }
  | { kind: "binary"; op: string; left: Expression; right: Expression }
  | { kind: "call"; name: string; args: Expression[] }
  | { kind: "object"; fields: { key: string; value: Expression }[] };

type Statement =
  | { kind: "assign"; path: string[]; value: Expression }
  | { kind: "if"; cond: Expression; body: Statement[] }
  | { kind: "return"; value: Expression };

// ---- Parser ----

class Parser {
  tokens: Token[];
  pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  peek(): Token {
    return this.tokens[this.pos];
  }

  next(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  expect(type: TokenType, value?: string): Token {
    const t = this.next();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new ChronosError(
        `expected ${value ? `'${value}'` : type}, got '${t.value}'`,
        t.line,
        t.col
      );
    }
    return t;
  }

  // Reads an identifier or a soft keyword (e.g., "state" as a parameter name).
  expectIdentLike(): Token {
    const t = this.peek();
    if (!isIdentLike(t)) {
      throw new ChronosError(`expected identifier, got '${t.value}'`, t.line, t.col);
    }
    return this.next();
  }

  match(type: TokenType, value?: string): boolean {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }

  parseProgram(): AST {
    const ast: AST = { states: [], actions: [], scores: [], run: null };

    while (!this.match("eof")) {
      const t = this.peek();
      if (t.type === "keyword") {
        if (t.value === "state") ast.states.push(this.parseState());
        else if (t.value === "action") ast.actions.push(this.parseAction());
        else if (t.value === "score") ast.scores.push(this.parseScore());
        else if (t.value === "run") ast.run = this.parseRun();
        else throw new ChronosError(`unexpected keyword '${t.value}'`, t.line, t.col);
      } else {
        throw new ChronosError(`unexpected token '${t.value}'`, t.line, t.col);
      }
    }

    return ast;
  }

  parseState(): { key: string; value: Expression } {
    this.expect("keyword", "state");
    // Optional identifier for namespaced state (e.g., `state agent { velocity = 68 }`)
    let namespace: string | null = null;
    if (this.match("ident")) {
      namespace = this.next().value;
    }
    this.expect("symbol", "{");
    const fields: { key: string; value: Expression }[] = [];
    while (!this.match("symbol", "}")) {
      // Support dotted assignments: `agent.velocity = 68`
      const path = this.parsePath();
      this.expect("symbol", "=");
      const value = this.parseExpression();
      const fieldKey = namespace ? `${namespace}.${path.join(".")}` : path.join(".");
      fields.push({ key: fieldKey, value });
      if (this.match("symbol", ",")) this.next();
    }
    this.expect("symbol", "}");
    return { key: namespace ?? "root", value: { kind: "object", fields } };
  }

  parseAction(): { name: string; body: ActionBody } {
    this.expect("keyword", "action");
    const name = this.expect("string").value;
    this.expect("symbol", "{");
    const body: ActionBody = { mutations: [], risk: null, reward: null };
    while (!this.match("symbol", "}")) {
      if (this.match("keyword", "risk")) {
        this.next();
        this.expect("symbol", "=");
        body.risk = this.parseExpression();
      } else if (this.match("keyword", "reward")) {
        this.next();
        this.expect("symbol", "=");
        body.reward = this.parseExpression();
      } else {
        const path = this.parsePath();
        this.expect("symbol", "=");
        const value = this.parseExpression();
        body.mutations.push({ path, value });
      }
      if (this.match("symbol", ",")) this.next();
    }
    this.expect("symbol", "}");
    return { name, body };
  }

  parseScore(): { name: string; param: string; body: Statement[] } {
    this.expect("keyword", "score");
    const name = this.expect("ident").value;
    this.expect("symbol", "(");
    const param = this.expectIdentLike().value;
    this.expect("symbol", ")");
    this.expect("symbol", "{");
    const body = this.parseStatements();
    this.expect("symbol", "}");
    return { name, param, body };
  }

  parseRun(): { fork: boolean; evaluate: string | null; collapse: string | null } {
    this.expect("keyword", "run");
    this.expect("symbol", "{");
    const result = {
      fork: false,
      evaluate: null as string | null,
      collapse: null as string | null,
    };
    while (!this.match("symbol", "}")) {
      const t = this.peek();
      if (t.type === "keyword" && t.value === "fork") {
        this.next();
        result.fork = true;
      } else if (t.type === "keyword" && t.value === "evaluate") {
        this.next();
        if (this.match("keyword", "with")) {
          this.next();
          result.evaluate = this.parseHyphenatedIdent();
        }
      } else if (t.type === "keyword" && t.value === "collapse") {
        this.next();
        result.collapse = this.parseHyphenatedIdent();
      } else {
        throw new ChronosError(`unexpected in run block: '${t.value}'`, t.line, t.col);
      }
    }
    this.expect("symbol", "}");
    return result;
  }

  // Reads an identifier that may contain hyphens (e.g., max-utility, min-risk).
  parseHyphenatedIdent(): string {
    let name = this.expect("ident").value;
    while (this.match("symbol", "-")) {
      this.next();
      name += "-" + this.expect("ident").value;
    }
    return name;
  }

  parseStatements(): Statement[] {
    const stmts: Statement[] = [];
    while (!this.match("symbol", "}")) {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  parseStatement(): Statement {
    const t = this.peek();
    if (t.type === "keyword" && t.value === "if") {
      this.next();
      const cond = this.parseExpression();
      this.expect("symbol", "{");
      const body = this.parseStatements();
      this.expect("symbol", "}");
      return { kind: "if", cond, body };
    }
    if (t.type === "keyword" && t.value === "return") {
      this.next();
      const value = this.parseExpression();
      return { kind: "return", value };
    }
    const path = this.parsePath();
    const eq = this.peek();
    if (eq.type === "symbol" && eq.value === ".") {
      throw new ChronosError(
        `unexpected '.' after '${path.join(".")}' — did you mean '${path.join(".")}.field = value'?`,
        eq.line,
        eq.col
      );
    }
    if (eq.type !== "symbol" || eq.value !== "=") {
      throw new ChronosError(
        `expected '=' after '${path.join(".")}', got '${eq.value}'`,
        eq.line,
        eq.col
      );
    }
    this.next();
    const value = this.parseExpression();
    return { kind: "assign", path, value };
  }

  parsePath(): string[] {
    const parts = [this.expectIdentLike().value];
    while (this.match("symbol", ".")) {
      this.next();
      if (!isIdentLike(this.peek())) {
        const t = this.peek();
        throw new ChronosError(
          `expected field name after '.', got '${t.value}' (did you mean '${parts.join(".")}.name = ...'?)`,
          t.line,
          t.col
        );
      }
      parts.push(this.expectIdentLike().value);
    }
    return parts;
  }

  parseExpression(): Expression {
    return this.parseComparison();
  }

  parseComparison(): Expression {
    let left = this.parseAdd();
    while (
      this.match("symbol", "==") ||
      this.match("symbol", ">") ||
      this.match("symbol", "<") ||
      this.match("symbol", ">=") ||
      this.match("symbol", "<=")
    ) {
      const op = this.next().value;
      const right = this.parseAdd();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  parseAdd(): Expression {
    let left = this.parseMul();
    while (this.match("symbol", "+") || this.match("symbol", "-")) {
      const op = this.next().value;
      const right = this.parseMul();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  parseMul(): Expression {
    let left = this.parseUnary();
    while (this.match("symbol", "*") || this.match("symbol", "/")) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  parseUnary(): Expression {
    if (this.match("symbol", "-")) {
      this.next();
      const expr = this.parsePrimary();
      return { kind: "binary", op: "*", left: { kind: "number", value: -1 }, right: expr };
    }
    return this.parsePrimary();
  }

  parsePrimary(): Expression {
    const t = this.peek();
    if (t.type === "number") {
      this.next();
      return { kind: "number", value: parseFloat(t.value) };
    }
    if (t.type === "string") {
      this.next();
      return { kind: "string", value: t.value };
    }
    if (t.type === "bool") {
      this.next();
      return { kind: "bool", value: t.value === "true" };
    }
    // identifiers + soft keywords (e.g., `state` used as a parameter name)
    if (isIdentLike(t)) {
      const name = this.next().value;
      if (this.match("symbol", "(")) {
        this.next();
        const args: Expression[] = [];
        while (!this.match("symbol", ")")) {
          args.push(this.parseExpression());
          if (this.match("symbol", ",")) this.next();
        }
        this.expect("symbol", ")");
        return { kind: "call", name, args };
      }
      if (this.match("symbol", ".")) {
        let expr: Expression = { kind: "ident", name };
        while (this.match("symbol", ".")) {
          this.next();
          const field = this.expectIdentLike().value;
          expr = { kind: "field", object: expr, field };
        }
        return expr;
      }
      return { kind: "ident", name };
    }
    if (this.match("symbol", "(")) {
      this.next();
      const expr = this.parseExpression();
      this.expect("symbol", ")");
      return expr;
    }
    throw new ChronosError(`unexpected token '${t.value}'`, t.line, t.col);
  }
}

// ---- Interpreter ----

type Env = Record<string, any>;

class ChronosError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

function evalExpression(expr: Expression, env: Env): any {
  switch (expr.kind) {
    case "number":
      return expr.value;
    case "string":
      return expr.value;
    case "bool":
      return expr.value;
    case "ident": {
      if (!(expr.name in env)) {
        throw new ChronosError(`undefined identifier: '${expr.name}'`, 0, 0);
      }
      return env[expr.name];
    }
    case "field": {
      const obj = evalExpression(expr.object, env);
      if (obj === null || obj === undefined) {
        throw new ChronosError(`cannot access field of null/undefined`, 0, 0);
      }
      if (typeof obj !== "object") {
        throw new ChronosError(`cannot access field '${expr.field}' of non-object`, 0, 0);
      }
      if (!(expr.field in obj)) {
        throw new ChronosError(`field '${expr.field}' not found`, 0, 0);
      }
      return obj[expr.field];
    }
    case "binary": {
      const left = evalExpression(expr.left, env);
      const right = evalExpression(expr.right, env);
      switch (expr.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return right === 0 ? 0 : left / right;
        case "==":
          return left === right;
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
        default:
          throw new ChronosError(`unknown operator: '${expr.op}'`, 0, 0);
      }
    }
    case "call": {
      if (expr.name === "clamp") {
        if (expr.args.length !== 3) throw new ChronosError("clamp requires 3 args", 0, 0);
        const v = evalExpression(expr.args[0], env);
        const lo = evalExpression(expr.args[1], env);
        const hi = evalExpression(expr.args[2], env);
        return Math.max(lo, Math.min(hi, v));
      }
      throw new ChronosError(`unknown function: '${expr.name}'`, 0, 0);
    }
  }
}

function execStatements(stmts: Statement[], env: Env): any {
  for (const stmt of stmts) {
    if (stmt.kind === "assign") {
      const value = evalExpression(stmt.value, env);
      let obj = env;
      for (let i = 0; i < stmt.path.length - 1; i++) {
        const key = stmt.path[i];
        if (!(key in obj)) obj[key] = {};
        obj = obj[key];
      }
      obj[stmt.path[stmt.path.length - 1]] = value;
    } else if (stmt.kind === "if") {
      const cond = evalExpression(stmt.cond, env);
      if (cond) {
        const result = execStatements(stmt.body, env);
        if (result !== undefined) return result;
      }
    } else if (stmt.kind === "return") {
      return evalExpression(stmt.value, env);
    }
  }
  return undefined;
}

// ---- Compile to engine types ----

export type CompileResult = {
  initialState: WorldState;
  actions: Action[];
  scoreFns: Record<string, (state: any) => number>;
  run: { fork: boolean; evaluate: string | null; collapse: string | null } | null;
};

export function compile(source: string): CompileResult {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const ast = parser.parseProgram();

  // Build initial state
  const initialState: WorldState = {
    robot: { x: 0, y: 0, armAngle: 0, gripOpen: true },
    object: { x: 0, y: 0, stable: true, grasped: false },
    environment: { humanPresent: false, wind: 0, lighting: "bright" },
    timestamp: 0,
  };

  for (const s of ast.states) {
    if (s.value.kind === "object") {
      for (const f of s.value.fields) {
        const parts = f.key.split(".");
        if (parts[0] === "agent") {
          const field = parts[1];
          const value = evalExpression(f.value, {});
          if (field === "velocity") initialState.robot.x = value;
          else if (field === "days_left") initialState.robot.y = value;
          else if (field === "quality") initialState.robot.armAngle = value;
          else if (field === "flag_ready") initialState.robot.gripOpen = value;
          else if (field === "loc_target") initialState.object.x = value;
          else if (field === "bugs") initialState.object.y = value;
          else if (field === "coverage") initialState.object.stable = value === "stable";
          else if (field === "shipped") initialState.object.grasped = value;
          else if (field === "stakeholder")
            initialState.environment.humanPresent = value === "watching";
          else if (field === "debt_pressure") initialState.environment.wind = value;
          else if (field === "morale") {
            initialState.environment.lighting =
              value === "high" ? "bright" : value === "medium" ? "dim" : "dark";
          }
        } else if (parts[0] === "position") {
          const field = parts[1];
          const value = evalExpression(f.value, {});
          if (field === "size") initialState.robot.x = value;
          else if (field === "vol") initialState.robot.y = value;
          else if (field === "conviction") initialState.robot.armAngle = value;
          else if (field === "exposure") initialState.robot.gripOpen = value === "flexible";
          else if (field === "minutes_to_print") initialState.object.x = value;
          else if (field === "pnl") initialState.object.y = value;
          else if (field === "tape") initialState.object.stable = value === "thick";
          else if (field === "holding") initialState.object.grasped = value;
          else if (field === "human_desk") initialState.environment.humanPresent = value === "on";
          else if (field === "macro_wind") initialState.environment.wind = value;
          else if (field === "signals") {
            initialState.environment.lighting =
              value === "clear" ? "bright" : value === "mixed" ? "dim" : "dark";
          }
        } else if (parts[0] === "company") {
          const field = parts[1];
          const value = evalExpression(f.value, {});
          if (field === "runway") initialState.robot.x = value;
          else if (field === "mrr") initialState.robot.y = value;
          else if (field === "momentum") initialState.robot.armAngle = value;
          else if (field === "optionality") initialState.robot.gripOpen = value === "open";
          else if (field === "churn") initialState.object.x = value;
          else if (field === "competitor") initialState.object.y = value;
          else if (field === "market") initialState.object.stable = value === "stable";
          else if (field === "positioned") initialState.object.grasped = value;
          else if (field === "board") initialState.environment.humanPresent = value === "watching";
          else if (field === "competitive_wind") initialState.environment.wind = value;
          else if (field === "clarity") {
            initialState.environment.lighting =
              value === "clear" ? "bright" : value === "mixed" ? "dim" : "dark";
          }
        }
      }
    }
  }

  // Build actions
  const actions: Action[] = ast.actions.map((a) => {
    return {
      id: a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: a.name,
      description: a.name,
      apply: (s: WorldState) => {
        // Build an env from the current state
        const env: any = {
          agent: {
            velocity: s.robot.x,
            days_left: s.robot.y,
            quality: s.robot.armAngle,
            flag_ready: s.robot.gripOpen,
            size: s.robot.x,
            vol: s.robot.y,
            conviction: s.robot.armAngle,
            exposure: s.robot.gripOpen ? "flexible" : "locked",
            runway: s.robot.x,
            mrr: s.robot.y,
            momentum: s.robot.armAngle,
            optionality: s.robot.gripOpen ? "open" : "committed",
          },
          world: {
            loc_target: s.object.x,
            bugs: s.object.y,
            coverage: s.object.stable ? "stable" : "fragile",
            shipped: s.object.grasped,
            minutes_to_print: s.object.x,
            pnl: s.object.y,
            tape: s.object.stable ? "thick" : "thin",
            holding: s.object.grasped,
            churn: s.object.x,
            competitor: s.object.y,
            market: s.object.stable ? "stable" : "shifting",
            positioned: s.object.grasped,
          },
          context: {
            stakeholder: s.environment.humanPresent ? "watching" : "clear",
            debt_pressure: s.environment.wind,
            morale:
              s.environment.lighting === "bright"
                ? "high"
                : s.environment.lighting === "dim"
                  ? "medium"
                  : "low",
            human_desk: s.environment.humanPresent ? "on" : "off",
            macro_wind: s.environment.wind,
            signals:
              s.environment.lighting === "bright"
                ? "clear"
                : s.environment.lighting === "dim"
                  ? "mixed"
                  : "cloudy",
            board: s.environment.humanPresent ? "watching" : "hands-off",
            competitive_wind: s.environment.wind,
            clarity:
              s.environment.lighting === "bright"
                ? "clear"
                : s.environment.lighting === "dim"
                  ? "mixed"
                  : "cloudy",
          },
          risk: a.body.risk ? evalExpression(a.body.risk, {}) : 0.5,
          reward: a.body.reward ? evalExpression(a.body.reward, {}) : 0.5,
        };

        // Apply mutations
        for (const m of a.body.mutations) {
          const value = evalExpression(m.value, env);
          let obj = env;
          for (let i = 0; i < m.path.length - 1; i++) {
            if (!(m.path[i] in obj)) obj[m.path[i]] = {};
            obj = obj[m.path[i]];
          }
          obj[m.path[m.path.length - 1]] = value;
        }

        // Map back to WorldState. Every namespace maps unconditionally:
        // untouched fields fall through to the current state via ?? / ||.
        const result: Partial<WorldState> = {};
        {
          const x = env.agent.size ?? env.agent.velocity ?? env.agent.runway;
          const y = env.agent.days_left ?? env.agent.vol ?? env.agent.mrr;
          const armAngle = env.agent.quality ?? env.agent.conviction ?? env.agent.momentum;
          const gripOpen =
            env.agent.flag_ready ??
            (env.agent.exposure === "flexible"
              ? true
              : env.agent.optionality === "open"
                ? true
                : undefined);
          result.robot = {
            x: x ?? s.robot.x,
            y: y ?? s.robot.y,
            armAngle: armAngle ?? s.robot.armAngle,
            gripOpen: gripOpen ?? s.robot.gripOpen,
          };
        }
        result.object = {
          x: env.world.loc_target ?? env.world.minutes_to_print ?? env.world.churn ?? s.object.x,
          y: env.world.bugs ?? env.world.pnl ?? env.world.competitor ?? s.object.y,
          stable:
            env.world.coverage === "stable" ||
            env.world.tape === "thick" ||
            env.world.market === "stable" ||
            s.object.stable,
          grasped:
            env.world.shipped ?? env.world.holding ?? env.world.positioned ?? s.object.grasped,
        };
        result.environment = {
          humanPresent:
            env.context.stakeholder === "watching" ||
            env.context.human_desk === "on" ||
            env.context.board === "watching" ||
            s.environment.humanPresent,
          wind:
            env.context.debt_pressure ??
            env.context.macro_wind ??
            env.context.competitive_wind ??
            s.environment.wind,
          lighting:
            env.context.morale === "high" ||
            env.context.signals === "clear" ||
            env.context.clarity === "clear"
              ? "bright"
              : env.context.morale === "low" ||
                  env.context.signals === "cloudy" ||
                  env.context.clarity === "cloudy"
                ? "dark"
                : "dim",
        };

        return result;
      },
      baseRisk: a.body.risk ? evalExpression(a.body.risk, {}) : 0.5,
      baseReward: a.body.reward ? evalExpression(a.body.reward, {}) : 0.5,
    };
  });

  // Build score functions
  const scoreFns: Record<string, (state: any) => number> = {};
  for (const s of ast.scores) {
    scoreFns[s.name] = (stateObj: any) => {
      const env: any = { [s.param]: stateObj };
      const result = execStatements(s.body, env);
      return typeof result === "number" ? result : 0;
    };
  }

  return {
    initialState,
    actions,
    scoreFns,
    run: ast.run,
  };
}

// ---- Execute a Chronos program end-to-end ----

export type ExecutionResult = {
  source: string;
  initialState: WorldState;
  actions: Action[];
  branches: Branch[];
  winner: Branch | null;
  error?: string;
};

export function execute(source: string): ExecutionResult {
  try {
    const compiled = compile(source);
    // Note: we don't actually run fork/evaluate/collapse here because that requires the engine.
    // The REPL UI handles that by calling the engine functions with the compiled actions.
    return {
      source,
      initialState: compiled.initialState,
      actions: compiled.actions,
      branches: [],
      winner: null,
    };
  } catch (e) {
    const err = e as ChronosError;
    return {
      source,
      initialState: {
        robot: { x: 0, y: 0, armAngle: 0, gripOpen: true },
        object: { x: 0, y: 0, stable: true, grasped: false },
        environment: { humanPresent: false, wind: 0, lighting: "bright" },
        timestamp: 0,
      },
      actions: [],
      branches: [],
      winner: null,
      error:
        err instanceof ChronosError
          ? `line ${err.line}, col ${err.col}: ${err.message}`
          : (e as Error).message,
    };
  }
}

// ---- Preset programs ----

export const presetPrograms: Record<string, { name: string; source: string }> = {
  forge: {
    name: "Forge · feature branch",
    source: `# Chronos Language v0.1
# Agent: Forge — the coding agent
# Problem: ship a feature in 3 days, tech debt climbing

state {
  agent.velocity = 68
  agent.days_left = 3
  agent.quality = 45
  agent.flag_ready = true

  world.loc_target = 240
  world.bugs = 7
  world.coverage = "fragile"
  world.shipped = false

  context.stakeholder = "watching"
  context.debt_pressure = 6
  context.morale = "medium"
}

action "Ship as-is" {
  agent.days_left = 0
  world.shipped = true
  context.debt_pressure = 9
  risk = 0.65
  reward = 0.85
}

action "Refactor first" {
  agent.days_left = 5
  agent.quality = 80
  world.bugs = 2
  world.coverage = "stable"
  risk = 0.2
  reward = 0.6
}

action "Write tests first" {
  agent.days_left = 4
  world.bugs = 3
  world.coverage = "stable"
  risk = 0.25
  reward = 0.72
}

action "Defer to next sprint" {
  agent.days_left = 7
  agent.quality = 30
  context.stakeholder = "clear"
  context.morale = "low"
  risk = 0.4
  reward = 0.3
}

score utility(state) {
  base = state.reward - 0.8 * state.risk
  if state.context.stakeholder == "watching" {
    base = base - 0.15
  }
  if state.context.debt_pressure > 5 {
    base = base - (state.context.debt_pressure - 5) * 0.04
  }
  return clamp(base, 0, 1)
}

run {
  fork
  evaluate with utility
  collapse max-utility
}
`,
  },
  oracle: {
    name: "Oracle · live position",
    source: `# Chronos Language v0.1
# Agent: Oracle — the trading agent
# Problem: $2.4M position, 34% vol, macro data in 40min

state {
  agent.size = 72
  agent.vol = 34
  agent.conviction = 15
  agent.exposure = "flexible"

  world.minutes_to_print = 40
  world.pnl = 4
  world.tape = "thin"
  world.holding = true

  context.human_desk = "off"
  context.macro_wind = 8
  context.signals = "mixed"
}

action "Add to position" {
  agent.size = 90
  agent.conviction = 55
  world.pnl = 12
  risk = 0.7
  reward = 0.85
}

action "Trim 30%" {
  agent.size = 50
  agent.conviction = 35
  world.pnl = 5
  risk = 0.3
  reward = 0.55
}

action "Hedge with puts" {
  agent.conviction = 40
  world.pnl = 2
  world.tape = "thick"
  risk = 0.15
  reward = 0.4
}

action "Flatten the book" {
  agent.size = 0
  agent.conviction = 0
  world.holding = false
  risk = 0.05
  reward = 0.15
}

score risk_adjusted(state) {
  base = state.reward - state.risk
  if state.agent.vol > 30 {
    base = base - 0.1
  }
  if state.world.tape == "thin" {
    base = base - 0.08
  }
  if state.world.pnl > 10 {
    base = base + 0.1
  }
  return clamp(base, 0, 1)
}

run {
  fork
  evaluate with risk_adjusted
  collapse min-risk
}
`,
  },
  atlas: {
    name: "Atlas · board decision",
    source: `# Chronos Language v0.1
# Agent: Atlas — the startup agent
# Problem: 12 mo runway, 4% churn, competitor raised $40M

state {
  agent.runway = 12
  agent.mrr = 180
  agent.momentum = 60
  agent.optionality = "open"

  world.churn = 4
  world.competitor = 40
  world.market = "shifting"
  world.positioned = false

  context.board = "watching"
  context.competitive_wind = 7
  context.clarity = "clear"
}

action "Raise Series A" {
  agent.runway = 24
  agent.mrr = 320
  context.board = "hands-off"
  risk = 0.4
  reward = 0.82
}

action "Ship enterprise tier" {
  agent.momentum = 78
  agent.mrr = 210
  world.competitor = 30
  risk = 0.45
  reward = 0.78
}

action "Cut prices 30%" {
  agent.mrr = 160
  agent.momentum = 55
  world.churn = 2
  world.competitor = 50
  risk = 0.55
  reward = 0.65
}

action "Extend runway, stay small" {
  agent.runway = 18
  agent.mrr = 150
  agent.momentum = 40
  context.competitive_wind = 9
  risk = 0.25
  reward = 0.35
}

score growth(state) {
  base = state.reward * 1.1 - state.risk * 0.9
  if state.context.board == "watching" {
    base = base - 0.1
  }
  if state.world.churn > 3 {
    base = base - 0.15
  }
  if state.context.competitive_wind > 5 {
    base = base - 0.05
  }
  if state.agent.momentum > 70 {
    base = base + 0.08
  }
  return clamp(base, 0, 1)
}

run {
  fork
  evaluate with growth
  collapse max-utility
}
`,
  },
};
