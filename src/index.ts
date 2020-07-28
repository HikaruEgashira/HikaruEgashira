require("dotenv").config();
import { WakaTimeClient, RANGE } from "wakatime-client";
import { Octokit } from "@octokit/rest";
import table from "markdown-table";
import { readFileSync } from "fs";

const { GH_TOKEN: githubToken, WAKATIME_API_KEY: wakatimeApiKey, GITHUB_ACTOR: user } = process.env;

if (!githubToken) {
  throw new Error(`cannot find "GH_TOKEN"`);
}
if (!wakatimeApiKey) {
  throw new Error(`cannot find "WAKATIME_API_KEY"`);
}
if (!user) {
  throw new Error(`cannot find "GH_USER"`);
}

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
const statsToTable = (stats: any) => {
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
  ].slice(0, 6);

  return table(lines);
};

/**
 * Readmeをcontentに書き換える
 */
const updateReadme = async (content: string) => {
  try {
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
      content: Buffer.from(content).toString("base64"),
      sha: repo.data.sha,
    });
  } catch (error) {
    throw new Error(error);
  }
};

const parseContent = (table: string, layoutPath = "./LAYOUT.md") => {
  const layout = readFileSync(layoutPath);
  return layout.toString().split("{{ table }}").join(table);
};

/**
 * Wakatimeからデータを持ってきて
 * Readmeにpushする
 */
(async () => {
  const stats = await wakatime.getMyStats({ range: RANGE.LAST_7_DAYS });
  const table = statsToTable(stats);
  const content = parseContent(table);
  await updateReadme(content);
})();
