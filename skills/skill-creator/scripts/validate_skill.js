#!/usr/bin/env node
/**
 * Validate a Pi skill directory for SKILL.md format/frontmatter requirements.
 *
 * Usage:
 *   scripts/validate_skill.js <skill_directory>
 */

const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

const ALLOWED_FRONTMATTER_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "disable-model-invocation",
]);

const NAME_PATTERN = /^[a-z0-9-]+$/;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

function readFrontmatter(skillMdPath) {
  const content = fs.readFileSync(skillMdPath, "utf8");
  if (!content.startsWith("---")) {
    return { frontmatter: null, error: "No YAML frontmatter found" };
  }

  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { frontmatter: null, error: "Invalid frontmatter format" };
  }

  try {
    const frontmatter = YAML.parse(match[1]);
    if (
      frontmatter === null ||
      typeof frontmatter !== "object" ||
      Array.isArray(frontmatter)
    ) {
      return { frontmatter: null, error: "Frontmatter must be a YAML mapping" };
    }
    return { frontmatter, error: null };
  } catch (err) {
    return {
      frontmatter: null,
      error: `Invalid YAML in frontmatter: ${err.message}`,
    };
  }
}

function validateFrontmatter(frontmatter, skillDir) {
  const errors = [];
  const warnings = [];

  const keys = Object.keys(frontmatter);
  const unknown = keys
    .filter((key) => !ALLOWED_FRONTMATTER_FIELDS.has(key))
    .sort();
  if (unknown.length) {
    warnings.push(`Unknown frontmatter field(s): ${unknown.join(", ")}`);
  }

  const name = frontmatter.name;
  if (typeof name !== "string" || !name.trim()) {
    errors.push("Missing or invalid 'name' in frontmatter");
  } else {
    const normalized = name.trim();
    const parentDir = path.basename(skillDir);

    if (normalized !== parentDir) {
      errors.push(
        `Frontmatter name '${normalized}' does not match directory '${parentDir}'`
      );
    }
    if (normalized.length > MAX_NAME_LENGTH) {
      errors.push(
        `Name is too long (${normalized.length}). Max ${MAX_NAME_LENGTH}.`
      );
    }
    if (!NAME_PATTERN.test(normalized)) {
      errors.push("Name must be lowercase letters, digits, and hyphens only");
    }
    if (normalized.startsWith("-") || normalized.endsWith("-")) {
      errors.push("Name must not start or end with a hyphen");
    }
    if (normalized.includes("--")) {
      errors.push("Name must not contain consecutive hyphens");
    }
  }

  const description = frontmatter.description;
  if (typeof description !== "string" || !description.trim()) {
    errors.push("Missing or invalid 'description' in frontmatter");
  } else {
    const desc = description.trim();
    if (desc.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(
        `Description is too long (${desc.length}). Max ${MAX_DESCRIPTION_LENGTH}.`
      );
    }
  }

  const allowedTools = frontmatter["allowed-tools"];
  if (allowedTools !== undefined && typeof allowedTools !== "string") {
    warnings.push("'allowed-tools' should be a space-delimited string");
  }

  const compatibility = frontmatter.compatibility;
  if (compatibility !== undefined && typeof compatibility !== "string") {
    warnings.push("'compatibility' should be a string");
  }

  const licenseValue = frontmatter.license;
  if (licenseValue !== undefined && typeof licenseValue !== "string") {
    warnings.push("'license' should be a string");
  }

  const metadata = frontmatter.metadata;
  if (
    metadata !== undefined &&
    (metadata === null || typeof metadata !== "object" || Array.isArray(metadata))
  ) {
    warnings.push("'metadata' should be a mapping");
  }

  const disableInvocation = frontmatter["disable-model-invocation"];
  if (disableInvocation !== undefined && typeof disableInvocation !== "boolean") {
    warnings.push("'disable-model-invocation' should be a boolean");
  }

  return { errors, warnings };
}

function validateSkill(skillPath) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(skillPath)) {
    return { errors: [`Skill directory not found: ${skillPath}`], warnings };
  }

  const stat = fs.statSync(skillPath);
  if (!stat.isDirectory()) {
    return { errors: [`Skill path is not a directory: ${skillPath}`], warnings };
  }

  const skillMd = path.join(skillPath, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    errors.push("SKILL.md not found");
    return { errors, warnings };
  }

  const { frontmatter, error: frontmatterError } = readFrontmatter(skillMd);
  if (frontmatterError) {
    errors.push(frontmatterError);
    return { errors, warnings };
  }

  const fmResult = validateFrontmatter(frontmatter, skillPath);
  errors.push(...fmResult.errors);
  warnings.push(...fmResult.warnings);

  return { errors, warnings };
}

function main() {
  if (process.argv.length !== 3) {
    console.log("Usage: scripts/validate_skill.js <skill_directory>");
    process.exit(1);
  }

  const skillPath = path.resolve(process.argv[2]);
  const { errors, warnings } = validateSkill(skillPath);

  if (warnings.length) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
    console.log();
  }

  if (errors.length) {
    console.log("Errors:");
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("Skill is valid!");
  process.exit(0);
}

if (require.main === module) {
  main();
}
