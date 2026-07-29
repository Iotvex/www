/** @type {import('semantic-release').GlobalConfig} */
const semanticReleaseConfig = {
    branches: [
        { name: 'main', channel: 'latest' },
        { name: 'next', channel: 'next', prerelease: 'next' },
    ],
    plugins: [
        [
            '@semantic-release/commit-analyzer',
            {
                preset: 'conventionalcommits',
                parserOpts: {
                    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
                },
                releaseRules: [
                    { breaking: true, release: 'major' },
                    { type: 'feat', scope: 'BREAKING CHANGE', release: 'major' },
                    { type: 'feat', release: 'minor' },
                    { type: 'feature', release: 'minor' },
                    { type: 'fix', release: 'patch' },
                    { type: 'bugfix', release: 'patch' },
                    { type: 'hotfix', release: 'patch' },
                    { type: 'perf', release: 'patch' },
                    { type: 'refactor', release: 'patch' },
                    { type: 'refactor', scope: '*-logic', release: 'patch' },
                    { type: 'docs', release: false },
                    { type: 'style', release: false },
                    { type: 'test', release: false },
                    { type: 'build', release: false },
                    { type: 'ci', release: false },
                    { type: 'chore', release: false },
                    { type: 'maint', release: false },
                ],
            },
        ],
        [
            '@semantic-release/release-notes-generator',
            {
                preset: 'conventionalcommits',
                parserOpts: {
                    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
                },
                writerOpts: {
                    groupBy: 'type',
                    commitsSort: ['subject', 'scope'],
                },
            },
        ],
        [
            '@semantic-release/changelog',
            {
                changelogFile: 'CHANGELOG.md',
                changelogTitle:
                    '# 📜 Changelog\n\nAll notable changes to this project will be documented in this file.\n\n',
            },
        ],
        ['@semantic-release/npm'],
        [
            '@semantic-release/git',
            {
                message:
                    process.env.GITHUB_REF && process.env.GITHUB_REF.includes('refs/heads/next')
                        ? 'chore(pre-release): ${nextRelease.version} [skip ci]'
                        : 'chore(release): ${nextRelease.version} [skip ci]',
                assets: ['CHANGELOG.md', 'package.json'],
            },
        ],
        [
            '@semantic-release/github',
            {
                releasedLabels: ['released'],
                addReleases: 'bottom',
            },
        ],
    ],
    tagFormat: 'v${version}',
}

export default semanticReleaseConfig
