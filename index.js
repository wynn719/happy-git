#!/usr/bin/env node
const prompts = require("prompts");
const Commander = require("commander");
const util = require("util");
const pc = require('picocolors');
const exec = util.promisify(require("child_process").exec);
const packageJson = require("./package.json");

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
  const branchListString = execRes.stdout ? execRes.stdout.toString().trim() : "";

  if (branchListString) {
    const deleteList = branchListString
      .split("\n")
      .filter((str) => str)
      .map((str) => str.replace('*', '').trim())
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
    console.log('Git username should be empty');
    process.exit(1);
  }

  const res = await prompts({
    type: "select",
    name: "value",
    message: "Pick branch",
    choices: [
      { title: "feature", value: "feature" },
      { title: "bugfix", value: "bugfix" },
      { title: "hotfix", value: "hotfix" },
    ],
    initial: 0,
  });

  const { value: branch } = res;

  if (!branch) {
    process.exit(1);
  }

  const branchNameRes = await prompts({
    type: "text",
    name: "value",
    message: `Branch name?`,
    validate: (name) => {
      if (!name.trim()) {
        return 'Branch name should not be empty!';
      }
    }
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

  const { stdout: resGitCo } = await exec(`git checkout -b ${fullBranchName} ${originBaseBranch[branch]}`);

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
