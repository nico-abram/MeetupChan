require('dotenv').config();

const char_to_emoji = require('./emoji_characters');
const emoji_to_char = Object.entries(char_to_emoji).reduce((ret, entry) => {
	ret[entry.value] = entry.key;
	return ret;
}, {});
const Discord = require('discord.js');
const axios = require('axios');
const mongoose = require('mongoose');
var Schema = mongoose.Schema;

const DEFAULT_PREFIX = '|';

const AnimeEntryObject = new Schema({
	votes: [{ user_id: String, score: Number }],
	user_id: String,
	date_proposed: Date,
	date_watched: Date, // Null if not watched
	watched: Boolean,
	title: String,
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

function get_server_proposals(server) {
	return server.anime_queue.filter(
		(anime_entry) => anime_entry.watched == false
	);
}

function modcommand_wrapper(fn) {
	return async function (server, msg, args) {
		if (await is_mod(msg.member, server)) {
			fn(server, msg, args);
		} else {
			msg.reply("You're not a mod!");
		}
	};
}

async function search_anilist(title, page, perPage) {
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
				page: page || 1,
				perPage: perPage || 10,
			},
		})
		.catch(console.log);
	return res.data.data.Page;
}

function proposal_from_anilist_media(msg, media) {
	return {
		votes: [],
		user_id: msg.author.id,
		date_proposed: Date.now(),
		date_watched: null,
		watched: false,
		title: media.title.english || media.title.romaji,
		anilist_id: media.id,
		mal_id: media.idMal,
	};
}

async function get_anilist_media_by_id(anilist_id) {
	const url = 'https://graphql.anilist.co/';
	const query = `query ($anilist_id: Int) {
			Media(id: $anilist_id, type: ANIME) {
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
		`;
	const res = await axios
		.post(url, {
			query,
			variables: {
				anilist_id,
			},
		})
		.catch(console.log);
	return res.data.data.Media;
}

async function get_mal_media_by_id(mal_id) {
	//TODO
}

function proposal_from_mal_media(msg, mal_media) {
	//TODO
}

async function validate_conflicting_anime_entry(msg, server, filter) {
	const conflicting_anime_entry = server.anime_queue.find(filter);
	if (conflicting_anime_entry != null) {
		const member_who_already_proposed = await msg.guild.members.fetch(
			conflicting_anime_entry.user_id
		);
		//TODO: What do if member left server?
		msg.reply(
			`${conflicting_anime_entry.title} has already been proposed by ${
				member_who_already_proposed.nickname ||
				member_who_already_proposed.user.username
			}`
		);
		return true;
	}
	return false;
}
const client = new Discord.Client();

const commands = {
	setprefix: modcommand_wrapper(async function (server, msg, args) {
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
	}),
	roll: modcommand_wrapper(async function (server, msg, args) {
		const proposals = get_server_proposals(server);
		if (proposals.length == 0) {
			msg.reply('There are no proposals to roll from!');
			return;
		}
		const rolled_proposal =
			proposals[Math.floor(Math.random() * proposals.length)];
		msg.reply(rolled_proposal.title);
		rolled_proposal.watched = true;
		rolled_proposal.date_watched = Date.now();
		server.save();
	}),
	mal: async function (server, msg, args) {
		const title = args[0];
		if (title == null || title.length == 0) {
			msg.reply(`Invalid anime title`);
			return;
		}

		const res_page = await search_anilist(title, 1, 10);
		//msg.reply(JSON.stringify(res_page.media, null, '\t'));
		msg.channel.send(
			new Discord.MessageEmbed().setTitle(`Results for '${title}'`).addFields(
				res_page.media.map((media) => {
					return {
						name: media.title.english || media.title.romaji,
						value: 'x',
					};
				})
			)
		);
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
	unchecked_test_title_propose: async function (server, msg, args) {
		const title = args[0];
		if (title == null || title.length == 0) {
			msg.reply(`Missing anime title`);
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
			date_watched: null,
			watched: false,
			title: title,
			anilist_id: null,
			mal_id: null,
		};
		server.anime_queue.push(proposal);
		server.save();

		msg.reply(`Your proposal is now set to ${title}`);
	},
	malpropose: async function (server, msg, args) {
		const title = msg.content.substr(msg.content.indexOf(' ') + 1);
		if (title == null || title.length == 0) {
			msg.reply(`Missing anime title`);
			return;
		}

		const existing_proposal = get_user_proposal(server, msg.author.id);
		if (existing_proposal) {
			msg.reply(`You have already proposed ${existing_proposal.title}`);
			return;
		}

		const anilist_prefix = 'anilist.co/anime/';
		const anilist_suffix = '/';
		if (title.includes(anilist_prefix)) {
			const prefix_end_idx =
				title.indexOf(anilist_prefix) + anilist_prefix.length;
			let anilist_id = title.substring(
				prefix_end_idx,
				title.indexOf(anilist_suffix, prefix_end_idx)
			);

			const anilist_media = await get_anilist_media_by_id(anilist_id);
			const proposal = proposal_from_anilist_media(msg, anilist_media);

			if (
				validate_conflicting_anime_entry(
					msg,
					server,
					(anime_entry) => anime_entry.anilist_id == proposal.anilist_id
				)
			) {
				return;
			}

			server.anime_queue.push(proposal);
			server.save();

			msg.reply(`Your proposal is now set to ${proposal.title}`);
			return;
		}

		const mal_prefix = 'myanimelist.net/anime/';
		const mal_suffix = '/';
		if (title.includes(mal_prefix)) {
			const prefix_end_idx = title.indexOf(mal_prefix) + mal_prefix.length;
			let mal_id = title.substring(
				prefix_end_idx,
				title.indexOf(mal_suffix, prefix_end_idx)
			);
			//TODO: get_mal_media_by_id and proposal_from_mal_media
			msg.reply(`MyAnimeList is not supported yet (Found id: ${mal_id})`);
			// dummy condition to avoid eslint warn
			if (msg != null) {
				return;
			}

			const mal_media = await get_mal_media_by_id(mal_id);
			const proposal = proposal_from_mal_media(msg, mal_media);

			if (
				validate_conflicting_anime_entry(
					msg,
					server,
					(anime_entry) => anime_entry.mal_id == proposal.mal_id
				)
			) {
				return;
			}

			server.anime_queue.push(proposal);
			server.save();

			msg.reply(`Your proposal is now set to ${proposal.title}`);
		}

		// dummy condition to avoid eslint warn
		if (msg != null) {
			msg.reply(`Anilist search and reaction choice is not supported yet`);
			return;
		}

		const res_page = await search_anilist(title, 1, 10);
		// TODO: Make this message pretty and react with number emojis
		// TODO: Pagination (React with prev/next emojis, allow them in the collector,
		//       and handle them to query the next/prev page from anilist and edit the message)
		const list_msg = await msg.channel.send(
			new Discord.MessageEmbed().setTitle(`Results for '${title}'`).addFields(
				res_page.media.map((media) => {
					return {
						name: media.title.english || media.title.romaji,
						value: 'x',
					};
				})
			)
		);

		const filter = (reaction, user) => {
			const char = emoji_to_char[reaction.emoji.name];
			//TODO: Allow prev/next emojis
			return user.id == msg.author.id && char != null && Number.isInteger(char);
		};

		list_msg
			.awaitReactions(filter, { max: 1, time: 15000, errors: ['time'] })
			.then((collected) => {
				//TODO: Get the corresponding anilist media from the search response
				//      and make the proposal from that
				//TODO: Will probably also have to check for next/prev page emoji reactions here
				const proposal = {
					votes: [],
					user_id: msg.author.id,
					date_proposed: Date.now(),
					date_watched: null,
					watched: false,
					title: title,
					anilist_id: null,
					mal_id: null,
				};
				server.anime_queue.push(proposal);
				server.save();

				msg.reply(`Your proposal is now set to ${title}`);
			})
			.catch((collected) => {
				msg.reply(`Selection timed out!`);
			});
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
