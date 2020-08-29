## MeetupChan

MeetupChan is currently UNDER DEVELOPMENT

MeetupChan is a discord bot to organize virtual anime watching meetups. Each user can propose an anime, and during the meetup, random animes are selected from the proposals of users present, and the first episode is watched.

## Status

The bot can basically not do anything correctly right now (Why am I even writing a readme at this point?)
Proposing an anime via `propose title of the series` kinda works

## Running

We use the [yarn](https://yarnpkg.com/) package manager

First install dependencies with

```sh
    yarn install
```

Then run

```sh
    yarn start
```

Running the bot requires a mongo database and a discord bot account. The access configuration for these is in environment variables, or a .env file.

```
D_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ
M_URI=mongodb+srv://user:password@domain.com/path
```

For the mongo database, in my dev environment I'm using the free tier from [atlas](https://cloud.mongodb.com)
For the discord bot account, create an application in the [discord developer portal](https://discord.com/developers) and make a new bot under it

## Ideas that won't make it into an MVP

- Karma system for increasing luck over time for an old proposal
- Have the bot join a voicechat and stream anime
- anilist integration
- Queueing future proposals

## Contributing

We use eslint for linting and prettier for formatting. You can run `yarn lint` and `yarn format` to do so

Todos:

- Roll command (Mod only)
- Overwriting existing proposal
- Querying your current proposal
- Querying your past, watched, proposals
- Localization. We only really care about spanish at the moment, so this might not be worth doing and instead we just use spanish
- Setting the mod role
- Voting
- Anilist/Mal integration
- Validate moongose schema
- Setup CI (Testing, format checking, lint checking, deployment)
- Tests?
- Hosting
- Cleanup code a bit
