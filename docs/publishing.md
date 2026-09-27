# Publishing a Linux build

Linux is the default distribution target. The GitHub Actions workflow runs on Ubuntu 24.04 (x86-64, glibc), with Java 21 and Node 22. It checks shell scripts, tests/builds the frontend, runs Java tests including real PTYs, packages Quarkus, and uploads a Linux archive and checksum. Other Linux architectures, musl distributions and macOS are not validated release targets.

To build locally, install the prerequisites in README, plus GNU tar and sha256sum:

```sh
cd frontend
npm ci
npm test
npm run build
cd ..
mvn -B clean package
bash scripts/package-linux.sh
```

The resulting `dist/p-dash-linux.tar.gz` contains `run.sh`, README, docs, and the entire `target/quarkus-app` directory. The packaging script does not rebuild: run it only after a successful clean build. An explicit file allowlist excludes user state, tokens, environment files, logs and portable tools. Do not add `.pdash` or personalized configuration to an archive.

Before publishing, require a green Linux workflow on the exact commit, download its artifact, and smoke-test it in a fresh writable directory:

```sh
sha256sum -c p-dash-linux.tar.gz.sha256
mkdir p-dash
tar -xzf p-dash-linux.tar.gz -C p-dash
cd p-dash
bash run.sh --no-build --no-browser
```

Open http://127.0.0.1:4310, start a demo, confirm terminal output, stop it, and confirm Ctrl+C shuts the dashboard down. The runtime requires Java 21+, Bash and jq; Node and Maven are unnecessary. Publish the archive and checksum together as release assets after verification. The workflow only uploads CI artifacts; it does not create a public release automatically. Choose and add a project license before distributing this as open source; no license grant is currently included in this repository.

Use an absolute `PDASH_DATA` outside the extracted installation to preserve configuration across replacements. Keep it private and back it up separately. This application binds loopback and controls processes as the current user; run it as your normal account. No root service, container image, public hosting configuration or system package is supplied. SIGTERM/Ctrl+C permits graceful cleanup; SIGKILL and host failure do not. Never run two instances against one state directory.
