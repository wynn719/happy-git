#!/usr/bin/env node
import prompts from "prompts";
import Commander from "commander";
import util from "util";
import pc from "picocolors";
import cp from "child_process";
import packageJson from "./package.json";

async function exec(cmd: string) {
  const res = await util.promisify(cp.exec)(cmd);

  if (res.stderr) {
    throw res.stderr;  
  }

  return res.stdout;
}

const program = new Commander.Command(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .option("-c, --clean", "Clean git redundancy branch")
  .option("-r, --recent", "Show recent branch")
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
  const branchListString = execRes
    ? execRes.toString().trim()
    : "";

  if (branchListString) {
    const deleteList = branchListString
      .split("\n")
      .filter((str) => str)
      .map((str) => str.replace("*", "").trim())
      .join(" ");

    console.log(
      pc.cyan("The following branches will be deleted: \n"),
      deleteList
    );
    const execRes = await exec(`git branch -d ${deleteList}`);
    console.log(pc.green("Delete completed!"), execRes);
  }
}

async function showRecentBranch() {
  console.log(pc.cyan("Recent branch:"));
  const resGitCo = await exec(
    `git reflog | grep "checkout: moving from" | head -n 10 | awk '{print $NF}' | sed 's/[^a-zA-Z0-9/_-]//g'`
  );
  const recentBranches = [...new Set((resGitCo || '')?.trim().split(/\s/g))].filter(Boolean); // remove duplicate

  const branchExists = async (branch: string) => {
    try {
      const result = (await exec(`git branch --list "${branch}"`));
      return result.length > 0;
    } catch (error) {
      return false;      
    }
  }

  const branchesWithExistence = await Promise.all(
    recentBranches.map(async branch => ({
      branch,
      exists: await branchExists(branch),
    }))
  );

  const existingBranches = branchesWithExistence
    .filter(({ exists }) => exists)
    .map(({ branch }) => branch);

  if (!existingBranches.length) {
    console.log(pc.red("No recent branch"));
    return;
  }

  const { branch } = await prompts({
    type: "select",
    name: "branch",
    message: "Pick branch",
    choices: existingBranches.map((branch) => ({
      title: branch,
      value: branch,  
    })),
  })

  if (!branch) {
    process.exit(1);
  }

  const resGitCheckout = await exec(
    `git checkout ${branch}`
  );

  console.log(pc.green("Checkout done"), resGitCheckout);
}

async function createGitBranch() {
  const resUserConfig = await exec("git config user.name");
  const username = resUserConfig.toString().trim();

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

  let baseBranch = "develop";

  if (["feature", "bugfix"].includes(branch)) {
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
  } else if (branch === "hotfix") {
    baseBranch = "master";
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

  console.log(
    pc.cyan(`Create branch: ${fullBranchName}, base on: origin/${baseBranch}`)
  );
  const resGitCo = await exec(
    `git checkout -b ${fullBranchName} origin/${baseBranch}`
  );
  console.log(pc.green("Create done"), resGitCo);

  const { shouldUpdateSubmodule } = await prompts({
    type: "confirm",
    name: "shouldUpdateSubmodule",
    message: "Should update submodules?",
  });

  if (!shouldUpdateSubmodule) {
    process.exit(1);
  }

  await exec(`git submodule update`);
  console.log(pc.green("Update submodule done"));
}

async function run() {
  const optionRuns: Record<string, () => Promise<void>> = {
    clean: cleanGitBranch,
    recent: showRecentBranch,
    default: createGitBranch,
  }
  const optionKey = Object.keys(options)?.[0] as keyof typeof optionRuns;
  const strategy = optionRuns[optionKey || 'default'];

  return strategy();
}

run().catch((error) => {
  console.error(pc.red(error));
});
