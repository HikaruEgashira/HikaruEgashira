require("dotenv").config();
import { WakaTimeClient, RANGE } from "wakatime-client";
import { Octokit } from "@octokit/rest";
import table from "markdown-table";

const {
  GH_TOKEN: githubToken,
  WAKATIME_API_KEY: wakatimeApiKey,
  GH_USER: user,
} = process.env;

const wakatime = new WakaTimeClient(wakatimeApiKey);

const octokit = new Octokit({ auth: `token ${githubToken}` });

/**
 * プログレスバーを表示
 */
const generateBarChart = (percent: number, size: number) => {
  const syms = ["░", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms[8].repeat(size);
  }
  const semi = frac % 8;

  return (syms[8].repeat(barsFull) + syms[semi]).padEnd(size, syms[0]);
};

/**
 * Wakatimeのデータを
 * Readmeに表示するデータに変換
 */
const statsToContent = (stats: any) => {
  const lines = [
    ["lang", "time"],
    ...(stats.data.languages as any[]).map((data: any) => {
      const { name, percent, text: time } = data;

      const line: string[] = [
        name.padEnd(11),
        time.padEnd(14),
        generateBarChart(percent, 21),
        String(percent.toFixed(1)).padStart(5) + "%",
      ];
      return line;
    }),
  ].slice(0, 5);

  return Buffer.from(table(lines)).toString("base64");
};

/**
 * Readmeをcontentに書き換える
 */
const updateGist = async (content: string) => {
  try {
    if (!githubToken || !wakatimeApiKey || !user) {
      throw new Error(
        `cannot find ${
          !githubToken
            ? "GH_TOKEN"
            : !wakatimeApiKey
            ? "WAKATIME_API_KEY"
            : "GH_USER"
        }`
      );
    }

    const repo = await octokit.repos.getContent({
      owner: user,
      repo: user,
      path: "README.md",
    });

    await octokit.repos.createOrUpdateFileContents({
      owner: user,
      repo: user,
      path: "README.md",
      message: "update README",
      content,
      sha: repo.data.sha,
    });
  } catch (error) {
    console.error(error);
  }
};

/**
 * Wakatimeからデータを持ってきて
 * Readmeにpushする
 */
async function main() {
  const stats = await wakatime.getMyStats({ range: RANGE.LAST_7_DAYS });
  const content = statsToContent(stats);
  await updateGist(content);
}

(async () => {
  await main();
})();
