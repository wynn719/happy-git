#!/usr/bin/env node
import prompts from "prompts";
import Commander from "commander";
import util from "util";
import pc from "picocolors";
import cp from "child_process";
import packageJson from "./package.json";

const exec = util.promisify(cp.exec);

const program = new Commander.Command(packageJson.name)
  .version(packageJson.version)
  .option("-c, --clean", "Clean git redundancy branch")
  .allowUnknownOption()
  .parse(process.argv);

const options = program.opts();

const handleSigTerm = () => process.exit(0);

process.on("SIGINT", handleSigTerm);
process.on("SIGTERM", handleSigTerm);

async function cleanGitBranch() {
  const execRes = await exec(
    'git branch --merged=origin/develop | grep -vE "(develop|release|master)"'
  );
  const branchListString = execRes.stdout
    ? execRes.stdout.toString().trim()
    : "";

  if (branchListString) {
    const deleteList = branchListString
      .split("\n")
      .filter((str) => str)
      .map((str) => str.replace("*", "").trim())
      .join(" ");

    console.log("The following branches will be deleted: \n", deleteList);

    const execRes = await exec(`git branch -d ${deleteList}`);

    console.log("Delete completed!", execRes.stdout);
  }
}

async function createGitBranch() {
  const resUserConfig = await exec("git config user.name");
  const username = resUserConfig.stdout.toString().trim();

  if (!username) {
    console.log("Git username should be empty");
    process.exit(1);
  }

  const res = await prompts({
    type: "select",
    name: "branch",
    message: "Pick branch",
    choices: [
      { title: "feature", value: "feature" },
      { title: "bugfix", value: "bugfix" },
      { title: "hotfix", value: "hotfix" },
    ],
    initial: 0,
  });

  const { branch } = res;

  if (!branch) {
    process.exit(1);
  }

  const branchNameRes = await prompts({
    type: "text",
    name: "value",
    message: `Branch name?`,
    validate: (name) => {
      if (!name.trim()) {
        return "Branch name should not be empty!";
      }

      return true;
    },
  });
  const { value: branchName } = branchNameRes;

  if (!branchName) {
    process.exit(1);
  }

  const fullBranchName = `${branch}/${username}/${branchName}`;
  const originBaseBranch = {
    feature: "origin/develop",
    bugfix: "origin/develop",
    hotfix: "origin/master",
  };

  console.log(`Create branch: ${fullBranchName}`);

  const { stdout: resGitCo } = await exec(
    `git checkout -b ${fullBranchName} ${originBaseBranch[branch as keyof typeof originBaseBranch]}`
  );

  console.log("Create done", resGitCo);
}

async function run() {
  if (options.clean) {
    return cleanGitBranch();
  }

  return createGitBranch();
}

run().catch((error) => {
  console.error(pc.red(error));
});
