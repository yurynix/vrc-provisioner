const express = require('express');
const Docker = require('dockerode');
const { verifyAuthorizationForTokens } = require('./authorization');

const docker = new Docker({socketPath: '/var/run/docker.sock'});

async function getImageByName(name) {
    const images = await docker.listImages();
    const image = images.find(image => {
        if (!image.RepoTags) {
            return null;
        }

        return image.RepoTags.find(tag => {
            const tagParts = tag.split(':');
            return tagParts[0] === name.toLowerCase();
        })
    });

    return image;
}

async function getContainerForImage(imageId) {
    const containers = await docker.listContainers();
    return containers.find(container => container.ImageID === imageId);
}

async function startVRC(imageName) {
    const container = await docker.createContainer({
        Image: imageName,
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: false,
        Tty: true,
        Cmd: ['/bin/bash', '-c', "echo Container started ; trap \"exit 0\" 15; while sleep 1 & wait $! ; do : ; done"],
        OpenStdin: false,
        StdinOnce: false
      });

    return await container.start();
}


(async function main() {

    if (!process.env.VRC_SERVER_TOKEN) {
        console.error(`Please set VRC_SERVER_TOKEN`);
        process.exit(1);
    }

    const app = express();
    app.use(verifyAuthorizationForTokens(new Set([process.env.VRC_SERVER_TOKEN])));
    app.use(express.json());
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

    app.get('/', (req, res) => {
        res.send('Hello World!')
    });

    // curl -v --header "Content-Type: application/json"  -d '{"imageName": "thunderbolt"}' http://localhost:3000/vrc
    app.post('/vrc', async (req, res) => {
        //console.log(JSON.stringify(req.params), JSON.stringify(req.body));
        try {
            const { imageName } = req.body;

            const dockerImage = await getImageByName(imageName);
            if (!dockerImage) {
                return res.status(400).header({"Content-Type": "application/json"}).send({"error": `image ${imageName} is unavailible`});
            }

            let container = await getContainerForImage(dockerImage.Id);
            let isContainerStartedNow = false;

            if (!container) {
                //return res.status(200).header({"Content-Type": "application/json"}).send({ containerId: container.Id, imageId: container.ImageID, imageRepoTag: dockerImage.RepoTags[0] });
                await startVRC(dockerImage.RepoTags[0]);
                container = await getContainerForImage(dockerImage.Id);
                isContainerStartedNow = true;
            }

            if (!container) {
                return res.status(500).header({"Content-Type": "application/json"}).send({"error": `Unable to start container for ${imageName}`});
            }
            
            res.status(isContainerStartedNow ? 201 : 200).header({"Content-Type": "application/json"}).send({ containerId: container.Id, imageId: container.ImageID, imageRepoTag: dockerImage.RepoTags[0], dockerHost: 'localhost' });
        } catch (ex) {
            res.status(500).header({"Content-Type": "application/json"}).send({"error": `${ex.message}`})
        }
    });

    app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
    });
}());