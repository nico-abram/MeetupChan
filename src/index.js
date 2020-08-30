require('dotenv').config();

const Discord = require('discord.js');
const axios = require('axios');
const mongoose = require('mongoose');
var Schema = mongoose.Schema;

const DEFAULT_PREFIX = '|';

const AnimeEntryObject = new Schema({
	votes: [{ user_id: String, score: Number }],
	user_id: String,
	date_proposed: Date,
	date_watched: Date, // Nullable si no se vio
	watched: Boolean, //(no se si es necesario si metemos fecha_visto, podemos filtrar por nulo ahi)
	title: String, //(ingresado por comando, hay que ver si validamos para que solo sean alguno que encontremos en anilist o mal)
	anilist_id: String,
	mal_id: String,
});
const Server = mongoose.model(
	'Server',
	new Schema({
		server_id: String,
		//serverName: String,
		config: {
			prefix: String,
			mod_role_id: String,
		},
		anime_queue: [AnimeEntryObject],
	})
);

async function is_mod(member, server) {
	if (server == null) {
		server = await Server.find({ serverId: member.guild.id }).exec();
	}
	return (
		member.hasPermission('ADMINISTRATOR') ||
		member.roles.cache.find((role) => role.id === server.config.mod_role_id)
	);
}

async function ensure_guild_initialization(guild) {
	const server = await Server.find({ serverId: guild.id }).exec();
	if (server[0] == null) {
		await Server.create({
			server_id: guild.id,
			config: { prefix: DEFAULT_PREFIX, mod_role_id: null },
			anime_queue: [],
		});
	}
}

function get_user_proposal(server, user_id) {
	return server.anime_queue.find(
		(anime_entry) =>
			anime_entry.watched == false && anime_entry.user_id == user_id
	);
}

function get_user_watched_proposals(server, user_id) {
	return server.anime_queue.filter(
		(anime_entry) =>
			anime_entry.watched == true && anime_entry.user_id == user_id
	);
}

const client = new Discord.Client();

const commands = {
	setprefix: async function (server, msg, args) {
		if (await is_mod(msg.member, server)) {
			const new_prefix = args[0];
			if (new_prefix != null && new_prefix.length == 1) {
				server.config.prefix = new_prefix;
				msg.reply(`Prefix set to ${new_prefix}`);
				server.save();
			} else {
				msg.reply(
					`${new_prefix} is not a valid prefix! It must be a single character`
				);
			}
		} else {
			msg.reply("You're not a mod!");
		}
	},
	mal: async function (server, msg, args) {
		const title = args[0];
		if (title == null || title.length == 0) {
			msg.reply(`Invalid anime title`);
			return;
		}
		const url = 'https://graphql.anilist.co/';
		const query = `query ($search: String, $page: Int, $perPage: Int) {
			Page(page: $page, perPage: $perPage) {
				pageInfo {
					total
					currentPage
				}
				media(search: $search, type: ANIME, sort: START_DATE) {
					id
					idMal
					startDate {
						year
						month
						day
					}
					title {
						english(stylised: true)
						romaji(stylised: true)
					}
				}
			}
		}
		`;
		const res = await axios
			.post(url, {
				query,
				variables: {
					search: title,
					page: 1,
					perPage: 7,
				},
			})
			.catch(console.log);
		msg.reply(JSON.stringify(res.data.data.Page.media, null, '\t'));
	},
	myproposal: async function (server, msg, args) {
		const existing_proposal = get_user_proposal(server, msg.author.id);
		if (existing_proposal != null) {
			const dateTimeFormat = new Intl.DateTimeFormat('es', {
				year: 'numeric',
				month: 'numeric',
				day: '2-digit',
				hour: 'numeric',
				minute: 'numeric',
				second: 'numeric',
			});
			const [
				{ value: month },
				,
				{ value: day },
				,
				{ value: year },
				,
				{ value: hour },
				,
				{ value: minute },
				,
				{ value: second },
			] = dateTimeFormat.formatToParts(existing_proposal.date_proposed);

			msg.reply(
				`Your active proposal is ${existing_proposal.title} (${year}-${month}-${day} ${hour}:${minute}:${second})`
			);
		} else {
			msg.reply(`You do not have an active proposal`);
		}
	},
	propose: async function (server, msg, args) {
		const title = args[0];
		if (title == null || title.length == 0) {
			msg.reply(`Invalid anime title`);
			return;
		}
		const anime_entry_with_same_title = server.anime_queue.find(
			(anime_entry) => anime_entry.title == title
		);
		const existing_proposal = get_user_proposal(server, msg.author.id);
		if (anime_entry_with_same_title) {
			const member_who_already_proposed = await msg.guild.members.fetch(
				anime_entry_with_same_title.user_id
			);
			//TODO: What do if member left server?
			msg.reply(
				`${title} has already been proposed by ${
					member_who_already_proposed.nickname ||
					member_who_already_proposed.user.username
				}`
			);
		}
		if (existing_proposal) {
			msg.reply(`You have already proposed ${existing_proposal.title}`);
		}
		if (existing_proposal || anime_entry_with_same_title) {
			return;
		}
		const proposal = {
			votes: [],
			user_id: msg.author.id,
			date_proposed: Date.now(),
			date_watched: null, // Nullable si no se vio
			watched: false, //(no se si es necesario si metemos fecha_visto, podemos filtrar por nulo ahi)
			title: title, //(ingresado por comando, hay que ver si validamos para que solo sean alguno que encontremos en anilist o mal)
			anilist_id: null,
			mal_id: null,
		};
		server.anime_queue.push(proposal);
		server.save();

		msg.reply(`Your proposal is now set to ${title}`);
	},
};

async function run() {
	try {
		await mongoose
			.connect(process.env.M_URI, { useUnifiedTopology: true })
			.catch((error) => {
				console.log(`Error connecting to mongodb: ${error}`);
				process.exit();
			});
		console.log('Succesfully connected to mongo database!');

		client.on('ready', async () => {
			console.log(`Logged in as ${client.user.tag}!`);

			await Promise.all(client.guilds.cache.map(ensure_guild_initialization));
		});
		client.on('guildCreate', async ({ guild }) => {
			await ensure_guild_initialization(guild);
		});

		client.on('message', async (msg) => {
			const [server] = await Server.find({ serverId: msg.guild.id }).exec();
			const prefix = server.config.prefix;
			if (!msg.content.startsWith(prefix) || msg.author.bot) return;

			const args = msg.content.slice(prefix.length).trim().split(/ +/);
			const command = args.shift().toLowerCase(); // lowercase and shift() to remove prefix

			const command_fn = commands[command];
			if (command_fn != null) {
				command_fn(server, msg, args);
			}
		});

		await client.login(process.env.D_TOKEN);
		console.log('Succesfully initialized discord bot!');
	} catch (error) {
		console.log(`Error: ${error}`);
		process.exit();
		throw error;
	}
}
run().catch(console.dir);
