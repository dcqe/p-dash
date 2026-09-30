# Linux distribution

The supported release target is Linux x86-64 with glibc. CI tests real PTYs and uploads an archive and checksum; it does not publish releases.

## Build

With the [development prerequisites](../README.md), GNU tar, and sha256sum:

```sh
cd frontend
npm ci
npm test
npm run build
cd ..
mvn -B clean package
bash scripts/package-linux.sh
```

`dist/p-dash-linux.tar.gz` contains the launcher, docs, and complete Quarkus package. Packaging uses the existing build; never include user state or credentials.

## Verify and release

Require green Linux CI for the release commit, then extract its artifact into a fresh writable directory:

```sh
sha256sum -c p-dash-linux.tar.gz.sha256
mkdir p-dash
tar -xzf p-dash-linux.tar.gz -C p-dash
cd p-dash
./run.sh --no-build --no-browser
```

The packaged app needs Java 21+, Bash, and jq. Check the dashboard, start and stop a demo, and confirm Ctrl+C shuts it down. Publish the archive and checksum together. Add a project license before open-source distribution; none is currently included.
