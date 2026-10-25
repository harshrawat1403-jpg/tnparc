module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3100/",
        "http://localhost:3100/about",
        "http://localhost:3100/placements",
        "http://localhost:3100/internships",
        "http://localhost:3100/for-recruiters",
      ],
      startServerCommand: "npx next start -p 3100",
      startServerReadyPattern: "(ready on|Ready in|Local:)",
      startServerReadyTimeout: 60000,
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.91 }],
        "categories:accessibility": ["error", { minScore: 0.96 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
