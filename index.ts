#!/usr/bin/env node
import prompts from "prompts";
import Commander from "commander";
import pc from "picocolors";
import packageJson from "./package.json";
import { awaitSleep, exec } from "./src/utils";

const program = new Commander.Command(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .option("-i, --init", "Create git branch")
  .option("-r, --recent", "Show recent branch")
  .option("-hc, --hotfix_copy", "Create a new branch with hotfix commits")
  .option("-c, --clean", "Clean git redundancy branch")
  .allowUnknownOption()
  .parse(process.argv);

const options = program.opts();

const handleSigTerm = () => process.exit(0);

process.on("SIGINT", handleSigTerm);
process.on("SIGTERM", handleSigTerm);

async function cleanGitBranch() {
  await exec("git fetch --prune");
  const execRes = await exec(
    'git branch --merged=origin/develop | grep -vE "(develop|release|master)"'
  );
  const branchListString = execRes ? execRes.toString().trim() : "";

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
  const recentBranches = [
    ...new Set((resGitCo || "")?.trim().split(/\s/g)),
  ].filter(Boolean); // remove duplicate

  const branchExists = async (branch: string) => {
    try {
      const result = await exec(`git branch --list "${branch}"`);
      return result.length > 0;
    } catch (error) {
      return false;
    }
  };

  const branchesWithExistence = await Promise.all(
    recentBranches.map(async (branch) => ({
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
  });

  if (!branch) {
    process.exit(1);
  }

  const resGitCheckout = await exec(`git checkout ${branch}`);

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

async function copyHotfixBranch() {
  const currentBranch = await exec("git branch --show-current");

  if (!/hotfix\/.*\/.*/.test(currentBranch.trim())) {
    throw new Error(
      "Not a valid hotfix branch name, use 'hotfix/xxx/xxx' format"
    );
  }

  const newBranch = currentBranch.trim().replace("hotfix", "bugfix");

  const cherryPickCommits = async () => {
    await awaitSleep(1500);

    console.log(
      pc.green(
        "Create a new branch base on origin/release, now cherry pick from " +
          currentBranch
      )
    );
    const commits = await exec(
      `git log origin/master..${currentBranch} --pretty=format:"%H"`
    );

    for (const commitHash of commits.split("\n").reverse()) {
      console.log(`Cherry-picking commit ${commitHash}...`);
      await exec(`git cherry-pick ${commitHash}`);
    }

    console.log(pc.green("Cherry-pick done"));
  };

  await Promise.all([
    exec(`git checkout -b ${newBranch} origin/release`),
    cherryPickCommits(),
  ]);

  console.log(pc.green("Now you can push this branch to remote!"));
}

async function run() {
  const optionRuns: Record<string, () => Promise<void>> = {
    init: createGitBranch,
    hotfix_copy: copyHotfixBranch,
    clean: cleanGitBranch,
    recent: showRecentBranch,
    default: createGitBranch,
  };
  const optionKey = Object.keys(options)?.[0] as keyof typeof optionRuns;
  const strategy = optionRuns[optionKey || "default"];

  return strategy();
}

run().catch((error) => {
  console.error(pc.red(error));
});
