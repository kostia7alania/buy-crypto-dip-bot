module.exports = {
  apps: [
    {
      name: "dcaguard-api",
      script: "apps/api/dist/server.js",
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "dcaguard-bot",
      script: "apps/bot/dist/index.js",
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "dcaguard-web",
      cwd: "apps/web",
      script: ".output/server/index.mjs",
      node_args: "--env-file=../../.env",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
    },
  ],
};
