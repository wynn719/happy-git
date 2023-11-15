#!/usr/bin/env node
const prompts = require("prompts");
// const Commander = require("commander");
// const packageJson = require("./package.json");
const { exec, execSync } = require('child_process');

// const program = new Commander.Command(packageJson.name)
//   .version(packageJson.version)
//   .parse(process.argv);

// const options = program.opts();

const handleSigTerm = () => process.exit(0)

process.on('SIGINT', handleSigTerm)
process.on('SIGTERM', handleSigTerm)

async function run() {
  let username = '';

  try {
    username = execSync('git config user.name').toString().trim();  
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  const res = await prompts({
    type: 'select',
    name: 'value',
    message: 'Pick branch',
    choices: [
      { title: 'feature', value: 'feature' },
      { title: 'bugfix', value: 'bugfix' },
      { title: 'hotfix', value: 'hotfix' }
    ],
    initial: 0
  });

  const { value: branch } = res;

  if (!branch) {
    process.exit(1);
  }

  const branchNameRes = await prompts({
    type: 'text',
    name: 'value',
    message: `Branch name?`
  });
  const { value: branchName } = branchNameRes;

  if (!branchName) {
    process.exit(1);
  }

  const fullBranchName = `${branch}/${username}/${branchName}`;
  const originBaseBranch = {
    feature: 'origin/develop',
    bugfix: 'origin/develop',
    hotfix: 'origin/master',
  }

  console.log(`Create branch: ${fullBranchName}`);

  exec(`git checkout -b ${fullBranchName} ${originBaseBranch[branch]}`, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log('Create done', stdout, stderr);
  });
}

run();