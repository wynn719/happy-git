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

    console.log(pc.cyan("The following branches will be deleted: \n"), deleteList);
    const execRes = await exec(`git branch -d ${deleteList}`);
    console.log(pc.green("Delete completed!"), execRes.stdout);
  }
}

async function createGitBranch() {
  const resUserConfig = await exec("git config user.name");
  const username = resUserConfig.stdout.toString().trim();

  if (!username) {
    console.log(pc.red("Git username should be empty"));
    process.exit(1);
  }

  const { branch } = await prompts({
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

  if (!branch) {
    process.exit(1);
  }

  let baseBranch = 'develop';

  if (['feature', 'bugfix'].includes(branch)) {
    const res = await prompts({
      type: "select",
      name: "baseBranch",
      message: "Pick base branch",
      choices: [
        { title: "develop", value: "develop" },
        { title: "release", value: "release" },
      ],
      initial: 0,
    });

    baseBranch = res.baseBranch;
  } else if (branch === 'hotfix') {
    baseBranch = 'master';
  }

  const { branchName } = await prompts({
    type: "text",
    name: "branchName",
    message: `Branch name?`,
    validate: (name) => {
      if (!name.trim()) {
        return "Branch name should not be empty!";
      }

      return true;
    },
  });

  if (!branchName) {
    process.exit(1);
  }

  const fullBranchName = `${branch}/${username}/${branchName}`;

  console.log(pc.cyan(`Create branch: ${fullBranchName}, base on: origin/${baseBranch}`));
  const { stdout: resGitCo } = await exec(
    `git checkout -b ${fullBranchName} origin/${baseBranch}`
  );
  console.log(pc.green("Create done"), resGitCo);
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
