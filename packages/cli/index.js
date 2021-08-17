const fetch = require('node-fetch');
const { exec } = require("child_process")
const { program } = require('commander');

if (!process.env.VRC_API_ENDPOINT) {
    console.log(`Please set VRC_API_ENDPOINT.`);
    process.exit(1);
}

if (!process.env.VRC_API_TOKEN) {
    console.log(`Please set VRC_API_TOKEN.`);
    process.exit(1);
}

program
  .command('run <image-name>')
  .description('runs a dev env for image name')
  .action(async (imageName) => {
    console.log(`Trying to start dev env for: ${imageName}`);

    await startDevEnv(imageName);
  });

program.parse(process.argv);

async function openVSCode({ dockerHost, containerId }) {
    const attachedContainerData = {
        containerName: `/${containerId}`
    };

    const containerURI = `vscode-remote://attached-container+${Buffer.from(JSON.stringify(attachedContainerData)).toString('hex')}/com.docker.devenvironments.code`;
    
    const command = `code --folder-uri=${containerURI}`;

    console.log(`Invoking "${command}"`);
    exec(command, {
        env: {
            ...(process.env),
            DOCKER_HOST: dockerHost,
        }
    }).unref();
}

async function startDevEnv(imageName) {
    const url = `${process.env.VRC_API_ENDPOINT}/vrc`;
    
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ imageName }),
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Failed to POST to ${url} - ${response.status} - ${response.statusText}`);
    }

    const containerData = await response.json();

    console.log(`Container is running: ${JSON.stringify(containerData)}`);

    openVSCode({
        dockerHost: containerData.dockerHost,
        containerId: containerData.containerId
    });
}