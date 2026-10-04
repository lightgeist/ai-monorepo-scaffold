#!/usr/bin/env node
// Modified for atlascode-rs, 2026; see NOTICE and PROVENANCE.json.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveRepoRoot } from "../shared/repo-root.mjs";
import {
  PLATFORM_PACKAGES,
  installArchiveBaseName,
  installArchiveName,
  readCargoPackageMetadata
} from "../shared/npm-package-config.mjs";
import { envWithoutSystemRuntimePath, resolveExecutablesOnPath } from "../npm/smoke-npm-package-install.mjs";
import {
  extractArchive,
  findSingleTopLevelDirectory,
  normalizePath,
  readArgValue
} from "../shared/install-archive-common.mjs";

const repoRoot = resolveRepoRoot(import.meta.url);

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const cargoPackage = readCargoPackageMetadata(path.join(repoRoot, "Cargo.toml"));
const version = options.version ?? cargoPackage.version;
const archiveRoot = path.resolve(repoRoot, options.archiveRoot ?? "dist-install");
const platformDir = options.platform ?? "linux-x64-gnu";
const platformPackage = PLATFORM_PACKAGES.find((entry) => entry.dir === platformDir);

if (!platformPackage) {
  throw new Error(
    `Unknown platform package directory: ${platformDir}. Expected one of: ${PLATFORM_PACKAGES.map((entry) => entry.dir).join(", ")}`
  );
}

assertHostCanSmokePlatform(platformPackage);

const archiveName = installArchiveName(platformPackage, version);
const archivePath = path.join(archiveRoot, archiveName);
if (!fs.existsSync(archivePath)) {
  throw new Error(`Missing install archive: ${path.relative(repoRoot, archivePath)}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "atlascode-rs-install-smoke-"));
try {
  const extractDir = path.join(tempDir, "extract");
  extractArchive({ archivePath, destinationDir: extractDir });
  const appRoot = findSingleTopLevelDirectory(extractDir);
  if (path.basename(appRoot) !== installArchiveBaseName(platformPackage, version)) {
    throw new Error(`Unexpected extracted app root: ${path.basename(appRoot)}`);
  }

  smokeExtractedApp(appRoot, platformPackage);
} finally {
  if (options.keepTemp) {
    console.log(`Kept install archive smoke root at ${tempDir}`);
  } else {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

console.log(`Smoke-tested install archive ${archiveName}`);

function assertHostCanSmokePlatform(platformPackage) {
  const expectedOs = platformPackage.os[0];
  const expectedCpu = platformPackage.cpu[0];
  if (process.platform !== expectedOs || process.arch !== expectedCpu) {
    throw new Error(
      `Cannot smoke-test ${platformPackage.dir} on ${process.platform}:${process.arch}. ` +
        "Run this smoke on a matching host or pass a matching --platform."
    );
  }

  if (expectedOs === "linux" && platformPackage.libc?.includes("glibc") && currentLinuxLibc() !== "glibc") {
    throw new Error(`Cannot smoke-test ${platformPackage.dir} on a non-glibc Linux host`);
  }
}

function smokeExtractedApp(appRoot, platformPackage) {
  if (!options.realBinary && platformPackage.os.includes("win32")) {
    assertWindowsMockBinary(appRoot, platformPackage.binaryName);
    assertWindowsMockBinary(appRoot, platformPackage.bundledRuntimeName);
    return;
  }

  const commandState = prepareCommandState(appRoot, platformPackage);
  const versionOutput = runCommand(commandState, ["--version"]);
  const helpOutput = runCommand(commandState, ["--help"]);

  if (!options.realBinary) {
    assertMockOutput(versionOutput.stdout, "atlascode-rs --version");
    assertMockOutput(helpOutput.stdout, "atlascode-rs --help");
    return;
  }

  if (versionOutput.stdout.trim() !== `atlascode-rs ${version}`) {
    throw new Error(`Packaged identity/version mismatch: ${versionOutput.stdout}`);
  }
  printCommandOutput("atlascode-rs --version", versionOutput);
  printCommandOutput("atlascode-rs --help", helpOutput);

  const completionOutput = runCommand(commandState, ["completions", "powershell"]);
  if (!completionOutput.stdout.includes("permission-mode")) {
    throw new Error("Installed CLI completions do not include startup flags");
  }
  const manualDir = path.join(path.dirname(appRoot), "generated-manuals");
  runCommand(commandState, ["man", manualDir]);
  if (!fs.existsSync(path.join(manualDir, "atlascode-rs.1"))) {
    throw new Error("Installed CLI did not generate its manual");
  }

  const doctorOutput = runCommand(commandState, ["doctor", "--json", "--strict"]);
  const doctorDetails = assertDoctorReportsArchiveRuntime(doctorOutput.stdout, appRoot);
  printCommandOutput("atlascode-rs doctor --json --strict", doctorOutput);
  runBridgeRuntimeContract(doctorDetails.runtimePath, doctorDetails.bridgeScriptPath, appRoot, commandState.env);
  assertMissingOwnedFileFails(commandState, doctorDetails.runtimePath, "bridge_runtime");
  assertMissingOwnedFileFails(commandState, doctorDetails.bridgeScriptPath, "bridge_script");
}

function prepareCommandState(appRoot, platformPackage) {
  const baseEnv = options.noSystemRuntime ? portableEnvironment() : { ...process.env };
  const pathKey = Object.keys(baseEnv).find((key) => key.toLowerCase() === "path") ?? "PATH";
  const commandEnv = { ...baseEnv };

  if (platformPackage.os.includes("win32")) {
    commandEnv[pathKey] = [appRoot, commandEnv[pathKey] ?? ""].filter(Boolean).join(path.delimiter);
    return {
      command: path.join(appRoot, platformPackage.binaryName),
      args: (commandArgs) => commandArgs,
      cwd: appRoot,
      env: commandEnv
    };
  }

  const binDir = path.join(path.dirname(appRoot), "bin");
  const launcherPath = path.join(binDir, "atlascode-rs");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    launcherPath,
    `#!/bin/sh\nexec ${shellQuote(path.join(appRoot, platformPackage.binaryName))} "$@"\n`,
    "utf8"
  );
  fs.chmodSync(launcherPath, 0o755);
  commandEnv[pathKey] = [binDir, commandEnv[pathKey] ?? ""].filter(Boolean).join(path.delimiter);
  return {
    command: "atlascode-rs",
    args: (commandArgs) => commandArgs,
    cwd: appRoot,
    env: commandEnv
  };
}

function runCommand(commandState, args) {
  try {
    const stdout = execFileSync(commandState.command, commandState.args(args), {
      cwd: commandState.cwd,
      env: commandState.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    return { stdout, stderr: "" };
  } catch (error) {
    const stdout = bufferToString(error.stdout);
    const stderr = bufferToString(error.stderr);
    throw new Error(
      `Install archive command failed: ${args.join(" ")}\n` +
        `status: ${error.status ?? "unknown"}\nstdout:\n${stdout}\nstderr:\n${stderr}`
    );
  }
}

function assertDoctorReportsArchiveRuntime(stdout, appRoot) {
  const report = JSON.parse(stdout);
  const runtimeCheck = report.checks?.find((check) => check.id === "bridge_runtime");
  const runtimeVersionCheck = report.checks?.find((check) => check.id === "bridge_runtime_version");
  const bridgeCheck = report.checks?.find((check) => check.id === "bridge_script");

  if (!runtimeCheck || runtimeCheck.status !== "pass") {
    throw new Error(`bridge_runtime did not pass: ${runtimeCheck?.message ?? "missing"}`);
  }
  if (runtimeCheck.details?.runtime_kind !== "bundled_bun") {
    throw new Error(`bridge_runtime kind was not bundled_bun: ${runtimeCheck.details?.runtime_kind}`);
  }
  if (!runtimeVersionCheck || runtimeVersionCheck.status !== "pass") {
    throw new Error(`bridge_runtime_version did not pass: ${runtimeVersionCheck?.message ?? "missing"}`);
  }
  if (!bridgeCheck || bridgeCheck.status !== "pass") {
    throw new Error(`bridge_script did not pass: ${bridgeCheck?.message ?? "missing"}`);
  }

  const runtimePath = resolvedDoctorPath(runtimeCheck.message, "bridge_runtime");
  const bridgeScriptPath = resolvedDoctorPath(bridgeCheck.message, "bridge_script");
  if (!pathInside(runtimePath, appRoot)) {
    throw new Error(`bridge_runtime resolved outside extracted app: ${runtimePath}`);
  }
  if (!pathInside(bridgeScriptPath, appRoot)) {
    throw new Error(`bridge_script resolved outside extracted app: ${bridgeScriptPath}`);
  }

  return {
    runtimePath,
    bridgeScriptPath
  };
}

function runBridgeRuntimeContract(runtimePath, bridgeScriptPath, appRoot, env) {
  const contractScript = path.join(repoRoot, "agent-sdk", "scripts", "bridge-runtime-contract.mjs");
  execFileSync(process.execPath, [contractScript, "--runtime", runtimePath, "--bridge", bridgeScriptPath], {
    cwd: appRoot,
    env,
    stdio: "inherit",
    windowsHide: true
  });
}

function resolvedDoctorPath(message, checkId) {
  const prefix = "resolved ";
  if (typeof message !== "string" || !message.startsWith(prefix)) {
    throw new Error(`${checkId} did not report a resolved path: ${message ?? "missing"}`);
  }
  const resolvedPath = message.slice(prefix.length);
  if (resolvedPath.length === 0) {
    throw new Error(`${checkId} reported an empty resolved path`);
  }
  return resolvedPath;
}

function assertMockOutput(output, commandName) {
  if (!output.includes("atlascode-rs 0.0.0-mock")) {
    throw new Error(`${commandName} did not run the mock binary. Output:\n${output}`);
  }
}

function assertWindowsMockBinary(appRoot, fileName) {
  const filePath = path.join(appRoot, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Windows mock binary is missing: ${fileName}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  if (!content.startsWith("@echo off") || !content.includes("echo ")) {
    throw new Error(`Windows mock binary does not contain expected mock content: ${fileName}`);
  }
}

function printCommandOutput(commandName, output) {
  const stdout = output.stdout.trim();
  const stderr = output.stderr.trim();
  if (stdout) {
    console.log(`${commandName} stdout:\n${stdout}`);
  }
  if (stderr) {
    console.log(`${commandName} stderr:\n${stderr}`);
  }
}

function currentLinuxLibc() {
  if (process.platform !== "linux") {
    return undefined;
  }
  try {
    const glibcVersion = process.report?.getReport?.()?.header?.glibcVersionRuntime;
    return typeof glibcVersion === "string" && glibcVersion.length > 0 ? "glibc" : "musl";
  } catch {
    return "musl";
  }
}

function pathInside(candidate, root) {
  const normalizedCandidate = normalizePathForCompare(candidate);
  const normalizedRoot = normalizePathForCompare(root);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

function normalizePathForCompare(filePath) {
  let resolved = path.resolve(stripExtendedLengthPrefix(filePath));
  try {
    // Canonicalize so both sides match how `doctor` reports the resolved path:
    // it resolves the macOS `/var` -> `/private/var` symlink and Windows 8.3
    // short names, which a plain `path.resolve` leaves divergent from the raw
    // mkdtemp path.
    resolved = fs.realpathSync.native(resolved);
  } catch {
    // The path may not exist in mock scenarios; fall back to the resolved form.
  }
  resolved = stripExtendedLengthPrefix(resolved);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function stripExtendedLengthPrefix(filePath) {
  if (process.platform !== "win32") {
    return filePath;
  }
  if (filePath.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${filePath.slice("\\\\?\\UNC\\".length)}`;
  }
  if (filePath.startsWith("\\\\?\\")) {
    return filePath.slice("\\\\?\\".length);
  }
  return filePath;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function bufferToString(value) {
  if (!value) {
    return "";
  }
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}

function parseArgs(args) {
  const parsed = {
    help: false,
    platform: undefined,
    archiveRoot: undefined,
    version: undefined,
    realBinary: false,
    noSystemRuntime: false,
    keepTemp: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--platform":
        parsed.platform = readArgValue(args, ++index, arg);
        break;
      case "--archive-root":
        parsed.archiveRoot = readArgValue(args, ++index, arg);
        break;
      case "--version":
        parsed.version = readArgValue(args, ++index, arg);
        break;
      case "--real-binary":
        parsed.realBinary = true;
        break;
      case "--no-system-runtime":
        parsed.noSystemRuntime = true;
        break;
      case "--keep-temp":
        parsed.keepTemp = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/install/smoke-install-archive.mjs [options]

Options:
  --platform <dir>        Platform archive to smoke. Defaults to linux-x64-gnu.
  --archive-root <dir>    Directory containing install archives. Defaults to dist-install.
  --version <version>     Expected package version. Defaults to Cargo.toml.
  --real-binary           Run doctor and bridge-runtime-contract against a real binary.
  --no-system-runtime     Strip directories containing bun from PATH before running atlascode-rs.
  --keep-temp             Keep the temporary extraction root for inspection.
  -h, --help              Show this help.
`);
}


// The verification harness uses an absolute Node path; the app and Bun child
// receive a PATH from which *both* system runtimes have been removed.
function portableEnvironment() {
  const env = envWithoutSystemRuntimePath();
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === "path") ?? "PATH";
  const blocked = new Set();
  for (const executable of resolveExecutablesOnPath("node", env, process.platform, { includeWhere: false })) {
    blocked.add(normalizePathForCompare(path.dirname(executable.path)));
    if (executable.realPath) blocked.add(normalizePathForCompare(path.dirname(executable.realPath)));
  }
  env[pathKey] = (env[pathKey] ?? "").split(path.delimiter)
    .filter(entry => entry && !blocked.has(normalizePathForCompare(entry))).join(path.delimiter);
  for (const command of ["node", "bun"]) {
    if (resolveExecutablesOnPath(command, env, process.platform, { includeWhere: false }).length) {
      throw new Error(`Portable test PATH still exposes ${command}`);
    }
  }
  for (const key of ["ATLASCODE_RS_AGENT_BRIDGE", "ATLASCODE_RS_AGENT_BRIDGE_RUNTIME", "NODE_OPTIONS"]) delete env[key];
  console.log("Verified application PATH has no system Node.js or Bun executable.");
  return env;
}

function assertMissingOwnedFileFails(commandState, filename, checkId) {
  const hidden = `${filename}.qualification-missing`;
  if (fs.existsSync(hidden)) throw new Error(`Unexpected negative-control path: ${hidden}`);
  fs.renameSync(filename, hidden);
  try {
    let result;
    try {
      execFileSync(commandState.command, commandState.args(["doctor", "--json", "--strict"]), {
        cwd: commandState.cwd, env: commandState.env, encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      });
    } catch (error) { result = error; }
    if (!result || result.status !== 1) throw new Error(`${checkId} missing-file control did not fail with status 1`);
    const report = JSON.parse(bufferToString(result.stdout));
    const check = report.checks?.find(entry => entry.id === checkId);
    if (check?.status !== "fail" || check.hard_failure !== true) {
      throw new Error(`${checkId} missing-file control did not fail its owned-path check`);
    }
    console.log(`Negative control passed: missing ${checkId} fails closed without a system-runtime fallback.`);
  } finally {
    fs.renameSync(hidden, filename);
  }
}
