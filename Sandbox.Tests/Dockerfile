# Sandbox.Tests: the Playwright end-to-end suite, in a container.
#
# The specs and the config live with the Angular app, where ESA keeps theirs
# (Sandbox.Web/e2e, Sandbox.Web/playwright.config.ts). This image adds the test
# runner and its browser, so nothing is installed on the host and the Angular
# app's package.json is left alone.
#
# Build from the repository root, so both folders are in the build context:
#
#   docker build -f Sandbox.Tests/Dockerfile -t sandbox/e2e .
#
# Run against a stack that is already up. The production stack (nginx):
#
#   docker run --rm --init --ipc=host --network sandbox-deploy_default \
#     -e BASE_URL=http://sandbox.web -e API_URL=http://sandbox.api:8080 \
#     -v "<repo>/Sandbox.Tests/results:/work/Sandbox.Tests/results" sandbox/e2e
#
# The dev stack. The Angular dev server answers 403 to a host name it was not
# told about, so until "sandbox.web" is in allowedHosts in angular.json, share
# the dev server's network and call it localhost:
#
#   docker run --rm --init --ipc=host --network container:sandbox-sandbox.web-1 \
#     -e BASE_URL=http://localhost:4200 -e API_URL=http://sandbox.api:8080 \
#     -v "<repo>/Sandbox.Tests/results:/work/Sandbox.Tests/results" sandbox/e2e
#
# With allowedHosts set, the defaults work: --network sandbox_default and no -e.
#
# Anything after the image name goes to "playwright test", for example
# "app.spec.ts", "--grep featured", or "--repeat-each 3".

# The image tag and @playwright/test in package.json must be the same version:
# the browsers in the image are the ones that version of the runner expects.
FROM mcr.microsoft.com/playwright:v1.65.0-noble

ENV CI=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    BASE_URL=http://sandbox.web:4200 \
    API_URL=http://sandbox.api:8080

# The image mirrors the repository layout, so the relative paths in
# playwright.config.ts mean the same thing here as in a checkout.
WORKDIR /work/Sandbox.Tests
COPY Sandbox.Tests/package.json Sandbox.Tests/package-lock.json ./
# The link lets the specs under /work/Sandbox.Web find @playwright/test: Node
# looks for node_modules in each parent folder, and /work is the shared parent.
RUN npm ci --no-audit --no-fund \
 && ln -s /work/Sandbox.Tests/node_modules /work/node_modules

COPY Sandbox.Web/playwright.config.ts /work/Sandbox.Web/playwright.config.ts
COPY Sandbox.Web/e2e /work/Sandbox.Web/e2e
# A file checked out on Windows has no execute bit, so set it here.
COPY --chmod=755 Sandbox.Tests/run-e2e.sh ./run-e2e.sh

ENTRYPOINT ["/work/Sandbox.Tests/run-e2e.sh"]
