const { InstallProvider } = require('@slack/oauth');
const { WebClient } = require('@slack/web-api');
const express = require('express');
const Keyv = require('keyv');

const app = express();
const port = 3000;

const keyv = new Keyv();
const WorkspaceList = [];

var cors = require('cors')();
const bodyPaser = require('body-parser')

app.use(bodyPaser.json())
app.use(cors);

keyv.on('error', err => console.log('Connection Error', err));

const installer = new InstallProvider({
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    authVersion: 'v2',
    stateSecret: 'my-state-secret',
    installationStore: {
        storeInstallation: async (installation) => {
            if (installation.isEnterpriseInstall) {
                WorkspaceList.push(installation)
                return await keyv.set(installation.enterprise.id, installation);
            } else if (installation.team !== null && installation.team.id !== undefined) {
                // storing single team installation
                console.log("storeInstallation", installation.team.id)
                WorkspaceList.push(installation)
                return await keyv.set(installation.team.id, installation)
            }
            throw new Error('Failed saving installation data to installationStore')
        },
        fetchInstallation: async (installQuery) => {
            if (installQuery.isEnterpriseInstall) {
                if (installQuery.enterpriseId !== undefined) {
                    // fetching org installation
                    return await keyv.get(installQuery.enterpriseId)
                }
            }
            if (installQuery.teamId !== undefined) {
                // fetching single team installation
                console.log("fetchInstallation", installQuery.teamId)
                return await keyv.get(installQuery.teamId)
            }
            throw new Error('Failed fetching installation')
        },
        deleteInstallation: async (installQuery) => {
            if (installQuery.isEnterpriseInstall) {
                if (installQuery.enterpriseId !== undefined) {
                    // delete org installation
                    return await keyv.delete(installQuery.enterpriseId)
                }
            }
            if (installQuery.teamId !== undefined) {
                // delete single team installation
                console.log("deleteInstallation", installQuery.teamId)
                return await keyv.delete(installQuery.teamId)
            }
            throw new Error('Failed to delete installation')
        },
    },
});

app.get('/workspace/list', (req, res,next) => {
    res.send({ workspace: WorkspaceList })
})

app.post( '/user/list', async (req, res, next) => {
    let web = new WebClient(req.body.token)
    let result = await web.users.list()
    res.send(result)
})

app.post( '/post/message', async (req, res, next) => {
    console.log( req.body)
    let web = new WebClient(req.body.token)
    let result = await web.chat.postMessage({
        channel: req.body.channel,
        text: req.body.text
    })
    res.send(result)
})


app.get('/', async (req, res, next) => {
    try {
        const url = await installer.generateInstallUrl({
            scopes: ['chat:write', 'users:read'],
            metadata: 'security',
        })

        res.send(`<a href=${url}><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>`);
    } catch(error) {
        console.log(error)
    }
})

app.get('/slack/oauth_redirect', async (req, res) => {
    await installer.handleCallback(req, res);
});

app.listen(port, () => console.log(`Slack Agent port ${port}!`))
