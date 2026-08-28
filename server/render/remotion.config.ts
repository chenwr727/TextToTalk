import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

const concurrency = Number(process.env.RENDER_CONCURRENCY) || 4;
Config.setConcurrency(concurrency);