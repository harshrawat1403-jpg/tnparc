import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  line: number;
  content: string;
  marker: string;
}

const VIOLATION_PATTERNS = [
  {
    pattern: /\b(test|it|describe)\.only\b/,
    name: "test.only / it.only / describe.only",
  },
  {
    pattern: /\b(test|it|describe)\.skip\b/,
    name: "test.skip / it.skip / describe.skip",
  },
  {
    pattern: /\b(test|it|describe)\.todo\b/,
    name: "test.todo / it.todo / describe.todo",
  },
  { pattern: /\b(xit|xdescribe)\b/, name: "xit / xdescribe" },
  {
    pattern: /\b(plan_skip_all|skip|todo|todo_start|todo_end)\s*\(/,
    name: "pgTAP skip / todo",
  },
];

function scanDirectory(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: Violation[] = [];
  const isSql = filePath.endsWith(".sql");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const trimmed = rawLine.trim();

    // Skip empty lines and single-line comment lines
    if (!trimmed) continue;
    if (isSql && trimmed.startsWith("--")) continue;
    if (
      !isSql &&
      (trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*"))
    )
      continue;

    for (const { pattern, name } of VIOLATION_PATTERNS) {
      // Only apply pgTAP patterns to SQL files
      if (name.includes("pgTAP") && !isSql) continue;
      // Only apply JS/TS test patterns to TS/JS files
      if (!name.includes("pgTAP") && isSql) continue;

      if (pattern.test(rawLine)) {
        violations.push({
          file: filePath,
          line: i + 1,
          content: trimmed,
          marker: name,
        });
      }
    }
  }

  return violations;
}

function main() {
  const testFiles = [
    ...scanDirectory(path.resolve(process.cwd(), "tests"), [".ts", ".js"]),
    ...scanDirectory(path.resolve(process.cwd(), "supabase/tests"), [".sql"]),
  ];

  console.log(
    `Scanning ${testFiles.length} test files for test control markers (only/skip/todo)...`
  );

  const allViolations: Violation[] = [];
  for (const file of testFiles) {
    allViolations.push(...checkFile(file));
  }

  if (allViolations.length > 0) {
    console.error(
      `\n❌ Found ${allViolations.length} test control marker violation(s):`
    );
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line} - [${v.marker}] ${v.content}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ Test hygiene check passed: 0 skipped, 0 todo, 0 only markers found across ${testFiles.length} files.`
  );
}

main();
