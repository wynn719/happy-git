import util from "util";
import cp from "child_process";

export function awaitSleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exec(cmd: string) {
  const res = await util.promisify(cp.exec)(cmd);

  if (res.stderr) {
    throw res.stderr;
  }

  return res.stdout?.trim();
}
