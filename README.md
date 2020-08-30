## MeetupChan

MeetupChan is currently UNDER DEVELOPMENT

MeetupChan is a discord bot to organize virtual anime watching meetups. Each user can propose an anime, and during the meetup, random animes are selected from the proposals of users present, and the first episode is watched.

## Status

The bot can add a proposal for as user with an anilist link ("|propose anilist-url") and roll ("|roll"). Rolling currently increases chances every 1 week since proposed (Linearly, starts at a chance of 1 and increases by 1 every week). You can also query your current proposal using "|myproposal" and mods can change the command prefix with "|setprefix"

## Running

We use the [yarn](https://yarnpkg.com/) package manager

First install dependencies with

```sh
    yarn install
```

Then run

```sh
    yarn dev
```

Running the bot requires a mongo database and a discord bot account. The access configuration for these is in environment variables, or a .env file.

```
D_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ
M_URI=mongodb+srv://user:password@domain.com/path
```

For the mongo database, in my dev environment I'm using the free tier from [atlas](https://cloud.mongodb.com)
For the discord bot account, create an application in the [discord developer portal](https://discord.com/developers) and make a new bot under it

You can run

```sh
    yarn watch dev
```

To automatically restart the bot upon changing code

To run using [pm2](https://pm2.keymetrics.io/), use

```sh
    yarn prod
```

And to stop

```sh
    yarn prod-stop
```

To avoid the yarn/npm process, if you wish, you can run the bash scripts in /scripts instead

## Ideas that won't make it into an MVP

- Have the bot join a voicechat and stream anime (It seems there is not even an official discord API for this yet)
- Queueing future proposals

## Contributing

We use eslint for linting and prettier for formatting. You can run `yarn lint` and `yarn format` to do so

Todos:

- TODOs in the code
- Validate if our moongose schema makes sense
- Overwriting existing proposal
- Voting
- Querying your past, watched, proposals
- Localization. We only really care about spanish at the moment, so this might not be worth doing and instead we just use spanish
- Setup CI (Testing, format checking, lint checking, deployment). Github actions?
- Tests?
- Hosting
- Cleanup code a bit
